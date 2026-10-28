/* ===================================================================
 *  LAYOUT — o mapa é gerado a partir dos dados
 * -------------------------------------------------------------------
 *  O mapa é montado numa grade (como papel quadriculado) e só usa os
 *  8 rumos dos mapas de metrô: horizontal, vertical e diagonais de 45°.
 *
 *  1. Todas as linhas partem da Estação Central, no ponto (0, 0).
 *  2. As estações entram em ordem cronológica. Cada uma é testada em
 *     várias posições logo depois da última estação das suas linhas e
 *     fica na de menor "custo" (trilho curto, poucas curvas, sem ficar
 *     espremida). Um projeto novo estica a linha; as estações antigas
 *     não saem do lugar.
 *  3. Os trilhos são traçados por busca A* na grade: curva de 45° custa
 *     pouco, de 90° custa mais, e uma linha nunca corre por cima de
 *     outra nem atravessa uma estação (só cruza em "X").
 *  4. Na ponta de cada linha entra um trecho "em obras", e cada nome de
 *     estação procura ao redor dela o lugar que não encosta em nada.
 *  5. Por último, um rio atravessa a rede por onde não há estações nem
 *     nomes (as linhas passam por cima, como pontes).
 *
 *  Este arquivo não mexe no DOM: recebe a rede e devolve as posições em
 *  pixels. Quem desenha é o render.js.
 * =================================================================== */

import { HUB_ID } from './network.js';
import { simplify } from './path.js';

/** Tamanho de um quadradinho da grade, em pixels. */
export const UNIT = 34;

/** Medidas do desenho (px). O render.js usa as mesmas. */
export const SIZES = { line: 9, station: 10, interchange: 13, hub: 20, terminus: 11, hit: 22 };

/** Raio das curvas dos trilhos (px). O trem anda pelas mesmas curvas. */
export const CORNER = UNIT * 0.75;

// Os 8 rumos (y cresce para baixo, como no SVG): L, SE, S, SO, O, NO, N, NE
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const NO_DIR = 8;
// Ordem das saídas da Estação Central. Tela deitada: leste, oeste, diagonais e
// por fim norte e sul. Tela em pé (celular): o mesmo girado, a rede cresce na vertical.
const PORTS_LANDSCAPE = [0, 4, 7, 3, 1, 5, 6, 2];
const PORTS_PORTRAIT = [2, 6, 3, 7, 1, 5, 4, 0];
let PORTS = PORTS_LANDSCAPE;
const STEP = 4; // distância entre estações na reta (na diagonal: 3, que dá ~4,2)
const DIAG_STEP = 3;
// Desvios testados a partir do rumo da linha: [giro em passos de 45°, custo extra]
const TURNS = [[0, 0], [-1, 0.3], [1, 0.3], [-2, 2], [2, 2]];

// Pesos do custo. Mexer aqui muda o "estilo" do mapa.
const COST = {
  turn45: 0.8,
  turn90: 4,
  cross: 2, // cruzar outra linha
  nearStation: 1, // trilho passando colado numa estação que não é a sua
  port: 0.5, // por posição na fila de saídas da Estação Central
  heading: [0, 1, 6, 30], // estação fora do rumo da linha: 0°, 45°, 90°, 135°+
  crowdStation: 1.5, // outra estação a 2 quadradinhos
  crowdTrack: 0.5, // trilho encostado na posição
  hubRouteMax: 15, // linha nova só vem desde a Central se o caminho não for longo demais
  startHere: 15, // linha nova começando na própria estação (igual ao limite: nunca "compensa" fugir da Central)
};

const LABEL = { font: '700 15px "Roboto Condensed", "Arial Narrow", sans-serif', lineHeight: 17, maxWidth: 150, gap: 6 };
const BADGE = { font: '800 9.5px Inter, system-ui, sans-serif', letterSpacing: 0.8, height: 17, padX: 7 };
const LABEL_SPOTS = [['S', 0], ['N', 0.3], ['E', 0.6], ['W', 0.8], ['SE', 1.2], ['NE', 1.3], ['SW', 1.5], ['NW', 1.6]];

/**
 * Gera o mapa. `measure(texto, fonte)` devolve a largura do texto em px
 * (no navegador vem de um <canvas>; nos testes, uma estimativa).
 * `portrait: true` gera a rede crescendo na vertical (tela de celular em pé).
 */
export function computeLayout(network, { measure = estimateText, portrait = false } = {}) {
  PORTS = portrait ? PORTS_PORTRAIT : PORTS_LANDSCAPE;
  const grid = new Grid();
  grid.addStation(0, 0, HUB_ID);

  const ports = preferredPorts(network);
  const lineState = new Map(
    network.lines.map((line) => [line.id, { line, head: null, node: null, dir: null, ports: ports.get(line.id) ?? PORTS }])
  );
  const edges = [];
  const cells = new Map([[HUB_ID, { x: 0, y: 0 }]]);

  // 1) Estações, uma a uma, em ordem cronológica
  for (const station of network.stations) {
    const states = station.lines.map((id) => lineState.get(id));
    const { pos, routes, startsHere } = placeStation(grid, states);
    grid.addStation(pos.x, pos.y, station.id);
    cells.set(station.id, pos);

    for (const { state, route } of routes) {
      edges.push({ line: state.line.id, a: state.node ?? HUB_ID, b: station.id, cells: route.nodes });
      Object.assign(state, { head: pos, node: station.id, dir: route.dirs.at(-1) });
    }
    for (const state of startsHere) {
      Object.assign(state, { head: pos, node: station.id, dir: freeDirection(grid, pos) });
    }
  }

  // 2) Trecho "em obras" na ponta de cada linha (onde o próximo projeto vai entrar)
  const works = new Map();
  for (const state of lineState.values()) {
    const extension = extendLine(grid, state);
    if (extension) works.set(state.line.id, extension);
  }

  // 3) Tudo em pixels
  const toPx = ([x, y]) => [x * UNIT, y * UNIT];
  const lines = network.lines.map((line) => {
    const extension = works.get(line.id);
    let terminus = null;
    if (extension) {
      const [ex, ey] = toPx(extension.cells.at(-1));
      const [ux, uy] = DIRS[extension.dir];
      const k = (SIZES.terminus + 3) / Math.hypot(ux, uy);
      terminus = { x: ex + ux * k, y: ey + uy * k };
    }
    return {
      ...line,
      edges: edges.filter((edge) => edge.line === line.id).map((edge) => simplify(edge.cells).map(toPx)),
      works: extension ? simplify(extension.cells).map(toPx) : null,
      terminus,
    };
  });

  const hubCell = cells.get(HUB_ID);
  const hub = { id: HUB_ID, title: network.hub.title, x: hubCell.x * UNIT, y: hubCell.y * UNIT, r: SIZES.hub };
  const stations = network.stations.map((station) => {
    const cell = cells.get(station.id);
    return {
      id: station.id,
      title: station.project.title,
      x: cell.x * UNIT,
      y: cell.y * UNIT,
      r: station.interchange ? SIZES.interchange : SIZES.station,
      interchange: station.interchange,
      isNewest: station.isNewest,
      lines: station.lines,
    };
  });

  // 4) Nomes das estações
  const segments = lines.flatMap((line) => [...line.edges, ...(line.works ? [line.works] : [])].flatMap(toSegments));
  const circles = [
    { id: hub.id, x: hub.x, y: hub.y, r: hub.r + 2 },
    ...stations.map((s) => ({ id: s.id, x: s.x, y: s.y, r: s.r + 2 })),
    ...lines.filter((line) => line.terminus).map((line) => ({ id: `t-${line.id}`, ...line.terminus, r: SIZES.terminus + 2 })),
  ];
  hub.badge = { text: 'Você está aqui', kind: 'here' };
  stations.forEach((s) => (s.badge = s.isNewest ? { text: 'Nova estação', kind: 'new' } : null));
  placeLabels([hub, ...stations], segments, circles, measure);

  const bounds = boundsOf(lines, [hub, ...stations], circles);
  return {
    hub,
    stations,
    lines,
    edges: edges.map((edge) => ({ line: edge.line, a: edge.a, b: edge.b, points: simplify(edge.cells).map(toPx) })),
    river: riverPath(bounds, circles, [hub, ...stations].map((item) => item.label.box), segments),
    bounds,
  };
}

/* ------------------------------------------------------------------
 *  O rio
 * ------------------------------------------------------------------
 *  Corre na direção curta do mapa (rede larga → rio de cima a baixo),
 *  numa faixa sem estações nem nomes. Cada metade pode escolher a sua
 *  faixa; as duas se juntam com uma curva de 45°. Se não houver faixa
 *  livre, o mapa fica sem rio.
 * ------------------------------------------------------------------ */

const RIVER = { width: 34, clearance: 10, reach: 2600 };

function riverPath(bounds, circles, boxes, segments) {
  // Trabalha sempre com o rio "em pé"; se a rede for alta, gira tudo 90°
  const tall = bounds.height > bounds.width;
  const flip = ([x, y]) => (tall ? [y, x] : [x, y]);
  const b = tall ? { x: bounds.y, y: bounds.x, width: bounds.height, height: bounds.width } : bounds;
  const dots = circles.map((c) => ({ ...c, x: tall ? c.y : c.x, y: tall ? c.x : c.y }));
  const rects = boxes.map((r) => (tall ? { x: r.y, y: r.x, width: r.height, height: r.width } : r));
  const lines = segments.map(([x1, y1, x2, y2]) => (tall ? [y1, x1, y2, x2] : [x1, y1, x2, y2]));
  const half = RIVER.width / 2;
  const middle = b.y + b.height / 2;

  // Custo de o rio passar na coluna x entre as alturas top e bottom
  const cost = (x, top, bottom) => {
    let total = Math.abs(x - (b.x + b.width / 2)) * 0.03;
    for (const c of dots) {
      if (c.y >= top - c.r && c.y <= bottom + c.r && Math.abs(c.x - x) < c.r + half + RIVER.clearance) total += 1000;
    }
    for (const r of rects) {
      if (r.y < bottom && r.y + r.height > top && r.x < x + half + 4 && r.x + r.width > x - half - 4) total += 400;
    }
    for (const [x1, y1, x2, y2] of lines) {
      const vertical = Math.abs(x1 - x2) < 1;
      if (vertical && Math.abs(x1 - x) < half + 12 && Math.max(y1, y2) > top && Math.min(y1, y2) < bottom) total += 300;
    }
    return total;
  };

  const best = (top, bottom) => {
    let pick = null;
    for (let x = b.x + UNIT; x <= b.x + b.width - UNIT; x += UNIT / 4) {
      const value = cost(x, top, bottom);
      if (!pick || value < pick.value) pick = { x, value };
    }
    return pick;
  };

  const whole = best(b.y - UNIT, b.y + b.height + UNIT);
  const upper = best(b.y - UNIT, middle);
  const lower = best(middle, b.y + b.height + UNIT);
  if (!upper || !lower || (upper.value >= 400 && (!whole || whole.value >= 400))) return null;

  // Fora da rede (acima e abaixo) o rio faz uma curva de 45° para cada lado:
  // assim ele parece um rio atravessando a cidade, não uma faixa reta
  const bend = UNIT * 3;
  const above = b.y - UNIT * 1.5;
  const below = b.y + b.height + UNIT * 1.5;
  const course = (topX, inner, bottomX) => [
    [topX - bend, b.y - RIVER.reach],
    [topX - bend, above - bend],
    [topX, above],
    ...inner,
    [bottomX, below],
    [bottomX + bend, below + bend],
    [bottomX + bend, b.y + b.height + RIVER.reach],
  ];

  let points;
  const shift = Math.abs(lower.x - upper.x);
  const bendFree =
    shift > 0 &&
    shift <= UNIT * 5 &&
    upper.value < 400 &&
    lower.value < 400 &&
    dots.every((c) => distanceToSegment(c, [upper.x, middle - shift / 2], [lower.x, middle + shift / 2]) > c.r + half + RIVER.clearance);

  if (bendFree) {
    points = course(upper.x, [[upper.x, middle - shift / 2], [lower.x, middle + shift / 2]], lower.x);
  } else if (whole.value < 400) {
    points = course(whole.x, [], whole.x);
  } else {
    return null;
  }
  return { width: RIVER.width, points: points.map(flip) };
}

function distanceToSegment(p, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (ax + dx * t), p.y - (ay + dy * t));
}

/* ------------------------------------------------------------------
 *  Escolha da posição de uma estação
 * ------------------------------------------------------------------ */

function placeStation(grid, states) {
  const existing = states.filter((state) => state.head);
  const fresh = states.filter((state) => !state.head);

  const best =
    pickBest(grid, candidatesFor(existing, fresh), existing, fresh) ??
    pickBest(grid, ringCandidates(grid, existing), existing, fresh);
  if (!best) throw new Error('Não achei lugar para uma estação no mapa.');

  // Refaz os trilhos da posição vencedora, agora para valer
  const routes = [];
  const startsHere = [];
  for (const state of [...existing, ...fresh]) {
    const route = routeFor(grid, state, best.pos, isAnchor(state, existing, fresh));
    if (route) {
      grid.commitRoute(route, state.line.id);
      routes.push({ state, route });
    } else {
      startsHere.push(state);
    }
  }
  grid.forgetLog();
  return { pos: best.pos, routes, startsHere };
}

/** Testa as posições candidatas e devolve a de menor custo. */
function pickBest(grid, candidates, existing, fresh) {
  let best = null;

  for (const spot of candidates) {
    if (!grid.isFreeSpot(spot.x, spot.y)) continue;

    let total = spot.bias + grid.crowdCost(spot.x, spot.y);
    for (const state of existing) total += COST.heading[headingBucket(state, spot)];
    if (best && total >= best.total) continue;

    // Traça os trilhos de mentirinha e desfaz no fim
    const checkpoint = grid.checkpoint();
    for (const state of [...existing, ...fresh]) {
      const anchor = isAnchor(state, existing, fresh);
      const route = routeFor(grid, state, spot, anchor);
      if (!route) {
        if (state.head || anchor) {
          total = Infinity;
          break;
        }
        total += COST.startHere;
        continue;
      }
      total += route.cost;
      grid.commitRoute(route, state.line.id);
      if (best && total >= best.total) break;
    }
    grid.rollback(checkpoint);

    if (total < (best?.total ?? Infinity)) best = { pos: { x: spot.x, y: spot.y }, total };
  }
  return best;
}

/**
 * Saída preferida de cada linha que nasce na Central: as linhas com mais
 * estações ficam com os rumos mais largos (na tela deitada, leste e oeste).
 */
function preferredPorts(network) {
  const anchors = [];
  const started = new Set();
  for (const station of network.stations) {
    if (station.lines.every((id) => !started.has(id))) anchors.push(station.lines[0]);
    station.lines.forEach((id) => started.add(id));
  }
  const size = (id) => network.lines.find((line) => line.id === id).stations.length;
  const ranked = [...anchors].sort((a, b) => size(b) - size(a) || anchors.indexOf(a) - anchors.indexOf(b));
  return new Map(ranked.map((id, i) => [id, [PORTS[i % 8], ...PORTS.filter((d) => d !== PORTS[i % 8])]]));
}

/** A estação sem nenhuma linha existente precisa de um trilho até a Central. */
const isAnchor = (state, existing, fresh) => existing.length === 0 && state === fresh[0];

function routeFor(grid, state, spot, anchor) {
  if (state.head) return findPath(grid, state.head, state.dir ?? NO_DIR, spot);
  const route = findPath(grid, { x: 0, y: 0 }, NO_DIR, spot, { fromHub: true, ports: state.ports });
  return route && (anchor || route.cost <= COST.hubRouteMax) ? route : null;
}

/** Posições a testar: seguindo o rumo de cada linha, ou nas saídas da Central. */
function candidatesFor(existing, fresh) {
  const list = [];
  const seen = new Set();
  const add = (x, y, bias) => {
    const key = cell(x, y);
    if (!seen.has(key)) {
      seen.add(key);
      list.push({ x, y, bias });
    }
  };

  if (existing.length) {
    for (const state of existing) {
      for (const [turn, bias] of TURNS) {
        const d = ((state.dir ?? 0) + turn + 8) % 8;
        const step = d % 2 ? DIAG_STEP : STEP;
        for (let extra = 0; extra <= 2; extra++) {
          add(state.head.x + DIRS[d][0] * (step + extra), state.head.y + DIRS[d][1] * (step + extra), bias + extra * 0.5);
        }
      }
    }
  } else {
    for (const d of fresh[0].ports) {
      const step = d % 2 ? DIAG_STEP : STEP;
      for (let extra = 0; extra <= 2; extra++) add(DIRS[d][0] * (step + extra), DIRS[d][1] * (step + extra), extra * 0.5);
    }
  }
  return list;
}

/** Plano B: qualquer ponto livre em volta da linha principal (ou da Central). */
function ringCandidates(grid, existing) {
  const center = existing[0]?.head ?? { x: 0, y: 0 };
  const list = [];
  for (let r = 2; r <= 12; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        if (grid.isFreeSpot(x, y)) list.push({ x, y, bias: r * 0.5 });
      }
    }
    if (list.length >= 40) break;
  }
  return list;
}

/** Quanto a posição foge do rumo da linha: 0 (reto), 1 (45°), 2 (90°), 3 (para trás). */
function headingBucket(state, spot) {
  if (state.dir == null) return 0;
  const vx = spot.x - state.head.x;
  const vy = spot.y - state.head.y;
  const [ux, uy] = DIRS[state.dir];
  const cos = (vx * ux + vy * uy) / (Math.hypot(vx, vy) * Math.hypot(ux, uy));
  const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  return angle <= 22.6 ? 0 : angle <= 67.6 ? 1 : angle <= 112.6 ? 2 : 3;
}

/** Um rumo livre saindo do ponto (para linha que começa numa estação). */
function freeDirection(grid, pos) {
  return (
    PORTS.find((d) => {
      const x = pos.x + DIRS[d][0];
      const y = pos.y + DIRS[d][1];
      return !grid.edges.has(edgeKey(pos.x, pos.y, x, y)) && !grid.stations.has(cell(x, y)) && !grid.tracks.has(cell(x, y));
    }) ?? 0
  );
}

/** Trecho "em obras": 2 quadradinhos (ou 1) seguindo a ponta da linha. */
function extendLine(grid, state) {
  if (!state.head || state.dir == null) return null;

  for (const length of [2, 1]) {
    for (const d of [state.dir, (state.dir + 7) % 8, (state.dir + 1) % 8]) {
      const path = [[state.head.x, state.head.y]];
      let ok = true;
      for (let i = 0; i < length && ok; i++) {
        const [px, py] = path.at(-1);
        const x = px + DIRS[d][0];
        const y = py + DIRS[d][1];
        ok =
          !grid.stations.has(cell(x, y)) &&
          !grid.tracks.has(cell(x, y)) &&
          !grid.edges.has(edgeKey(px, py, x, y)) &&
          !(d % 2 && grid.edges.has(edgeKey(x, py, px, y))) &&
          grid.stationsAround(x, y, state.head, null) === 0;
        path.push([x, y]);
      }
      if (ok) {
        grid.commitRoute({ nodes: path, dirs: Array(length).fill(d) }, state.line.id);
        grid.addTrack(path.at(-1), state.line.id, d, d); // a ponta também fica ocupada
        grid.forgetLog();
        return { cells: path, dir: d };
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------
 *  Busca A* de um trilho na grade
 * ------------------------------------------------------------------ */

function findPath(grid, from, fromDir, to, { fromHub = false, ports = PORTS } = {}) {
  const box = grid.searchBox(from, to, 6);
  const height = box.maxY - box.minY + 1;
  const stateId = (x, y, d) => ((x - box.minX) * height + (y - box.minY)) * 9 + d;
  // Distância "octilinear" (o menor caminho sem obstáculos), um pouco inflada:
  // a busca fica bem mais rápida e o trilho sai quase igual ao ótimo
  const estimate = (x, y) => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * 1.15;
  };

  const bestCost = new Map([[stateId(from.x, from.y, fromDir), 0]]);
  const open = new MinHeap();
  open.push({ x: from.x, y: from.y, d: fromDir, g: 0, f: estimate(from.x, from.y), prev: null });

  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    if (cur.g > bestCost.get(stateId(cur.x, cur.y, cur.d))) continue; // entrada velha da fila
    if (cur.x === to.x && cur.y === to.y) return rebuild(cur);
    if (++expanded > 40000) break;

    const crossingHere = cur.prev !== null && grid.tracks.has(cell(cur.x, cur.y));

    for (let nd = 0; nd < 8; nd++) {
      let cost = nd % 2 ? Math.SQRT2 : 1;
      if (cur.d !== NO_DIR) {
        const turn = turnSize(cur.d, nd);
        // Nada de curvas fechadas (135°+), e quem cruza outra linha segue reto
        if (turn > 2 || (crossingHere && turn > 0)) continue;
        cost += turn === 1 ? COST.turn45 : turn === 2 ? COST.turn90 : 0;
      } else if (fromHub) {
        cost += COST.port * ports.indexOf(nd);
      }

      const nx = cur.x + DIRS[nd][0];
      const ny = cur.y + DIRS[nd][1];
      if (nx < box.minX || nx > box.maxX || ny < box.minY || ny > box.maxY) continue;
      if (grid.edges.has(edgeKey(cur.x, cur.y, nx, ny))) continue; // trilho já ocupado

      if (nx !== to.x || ny !== to.y) {
        if (grid.stations.has(cell(nx, ny))) continue;
        const tracks = grid.tracks.get(cell(nx, ny));
        if (tracks) {
          // Só cruza em "X": as duas linhas passam retas e em rumos diferentes
          if (tracks.some((t) => t.dirIn !== t.dirOut || t.dirIn % 4 === nd % 4)) continue;
          cost += COST.cross;
        }
        cost += COST.nearStation * grid.stationsAround(nx, ny, from, to);
      }
      // Diagonal que corta outra diagonal no meio do quadradinho
      if (nd % 2 && grid.edges.has(edgeKey(nx, cur.y, cur.x, ny))) cost += COST.cross;

      const g = cur.g + cost;
      const id = stateId(nx, ny, nd);
      if (g < (bestCost.get(id) ?? Infinity)) {
        bestCost.set(id, g);
        open.push({ x: nx, y: ny, d: nd, g, f: g + estimate(nx, ny), prev: cur });
      }
    }
  }
  return null;
}

function rebuild(end) {
  const nodes = [];
  const dirs = [];
  for (let step = end; step; step = step.prev) {
    nodes.push([step.x, step.y]);
    if (step.prev) dirs.push(step.d);
  }
  return { nodes: nodes.reverse(), dirs: dirs.reverse(), cost: end.g };
}

const turnSize = (a, b) => {
  const t = Math.abs(a - b) % 8;
  return Math.min(t, 8 - t);
};

const cell = (x, y) => `${x},${y}`;
const edgeKey = (ax, ay, bx, by) => (ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`);

/** O que já está ocupado no papel quadriculado. */
class Grid {
  constructor() {
    this.stations = new Map(); // "x,y" → id
    this.stationList = [];
    this.tracks = new Map(); // "x,y" → [{ line, dirIn, dirOut }] (pontos por onde passa trilho)
    this.edges = new Map(); // "a|b" → id da linha (trechos de trilho)
    this.log = []; // o que foi gravado, para poder desfazer
    this.box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  addStation(x, y, id) {
    this.stations.set(cell(x, y), id);
    this.stationList.push({ x, y, id });
    this.grow(x, y);
  }

  addTrack([x, y], line, dirIn, dirOut) {
    const key = cell(x, y);
    if (!this.tracks.has(key)) this.tracks.set(key, []);
    this.tracks.get(key).push({ line, dirIn, dirOut });
    this.log.push(['track', key]);
    this.grow(x, y);
  }

  commitRoute({ nodes, dirs }, line) {
    for (let i = 0; i < dirs.length; i++) {
      const key = edgeKey(...nodes[i], ...nodes[i + 1]);
      this.edges.set(key, line);
      this.log.push(['edge', key]);
    }
    for (let i = 1; i < nodes.length - 1; i++) this.addTrack(nodes[i], line, dirs[i - 1], dirs[i]);
  }

  checkpoint() {
    return this.log.length;
  }

  rollback(checkpoint) {
    while (this.log.length > checkpoint) {
      const [type, key] = this.log.pop();
      if (type === 'edge') {
        this.edges.delete(key);
      } else {
        const list = this.tracks.get(key);
        list.pop();
        if (!list.length) this.tracks.delete(key);
      }
    }
  }

  forgetLog() {
    this.log.length = 0;
  }

  grow(x, y) {
    this.box.minX = Math.min(this.box.minX, x);
    this.box.maxX = Math.max(this.box.maxX, x);
    this.box.minY = Math.min(this.box.minY, y);
    this.box.maxY = Math.max(this.box.maxY, y);
  }

  searchBox(a, b, margin) {
    return {
      minX: Math.min(this.box.minX, a.x, b.x) - margin,
      maxX: Math.max(this.box.maxX, a.x, b.x) + margin,
      minY: Math.min(this.box.minY, a.y, b.y) - margin,
      maxY: Math.max(this.box.maxY, a.y, b.y) + margin,
    };
  }

  /** Livre para uma estação: sem trilho, sem estação a menos de 2 quadradinhos (3 da Central). */
  isFreeSpot(x, y) {
    const key = cell(x, y);
    if (this.stations.has(key) || this.tracks.has(key)) return false;
    return this.stationList.every((s) => Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) >= (s.id === HUB_ID ? 3 : 2));
  }

  crowdCost(x, y) {
    let cost = 0;
    for (const s of this.stationList) {
      if (Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= 2) cost += COST.crowdStation;
    }
    for (const [dx, dy] of DIRS) if (this.tracks.has(cell(x + dx, y + dy))) cost += COST.crowdTrack;
    return cost;
  }

  /** Quantas estações encostam no ponto (sem contar as pontas do trilho). */
  stationsAround(x, y, from, to) {
    let count = 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.stations.has(cell(nx, ny)) && !(from && nx === from.x && ny === from.y) && !(to && nx === to.x && ny === to.y)) count++;
    }
    return count;
  }
}

/** Fila de prioridade (heap binário) para a busca A*. */
class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let min = i;
        if (left < items.length && items[left].f < items[min].f) min = left;
        if (right < items.length && items[right].f < items[min].f) min = right;
        if (min === i) break;
        [items[min], items[i]] = [items[i], items[min]];
        i = min;
      }
    }
    return top;
  }
}

/* ------------------------------------------------------------------
 *  Nomes das estações
 * ------------------------------------------------------------------ */

function placeLabels(items, segments, circles, measure) {
  const placed = [];

  for (const item of items) {
    const block = labelBlock(item, measure);
    let best = null;

    // Primeiro tenta colado na estação; se tudo encostar em algo, um pouco mais longe
    for (const distance of [1, 1.9, 2.8]) {
      for (const [spot, preference] of LABEL_SPOTS) {
        const box = spotBox(spot, item, block, distance);
        const padded = inflate(box, SIZES.line / 2 + 2);
        const score =
          preference +
          (distance - 1) * 4 +
          20 * segments.filter((segment) => segmentHitsBox(segment, padded)).length +
          20 * circles.filter((circle) => circle.id !== item.id && circleHitsBox(circle, box)).length +
          40 * placed.filter((other) => boxesOverlap(other, box, 4)).length;
        if (!best || score < best.score) best = { score, box };
      }
      if (best.score < 4) break;
    }

    placed.push(best.box);
    item.label = finishLabel(block, best.box);
  }
}

function labelBlock(item, measure) {
  const lines = splitTitle(item.title, measure);
  const textWidth = Math.max(...lines.map((text) => measure(text, LABEL.font)));
  const badge = item.badge
    ? {
        ...item.badge,
        width: measure(item.badge.text.toUpperCase(), BADGE.font) + item.badge.text.length * BADGE.letterSpacing + BADGE.padX * 2,
        height: BADGE.height,
      }
    : null;
  return {
    lines,
    badge,
    width: Math.max(textWidth, badge?.width ?? 0),
    height: lines.length * LABEL.lineHeight + (badge ? badge.height + 4 : 0),
  };
}

/** Nome comprido quebra em duas linhas, no espaço mais perto do meio. */
function splitTitle(title, measure) {
  if (measure(title, LABEL.font) <= LABEL.maxWidth) return [title];
  const spaces = [...title.matchAll(/ /g)].map((match) => match.index);
  if (!spaces.length) return [title];
  const middle = spaces.reduce((a, b) => (Math.abs(b - title.length / 2) < Math.abs(a - title.length / 2) ? b : a));
  return [title.slice(0, middle), title.slice(middle + 1)];
}

function spotBox(spot, item, block, distance) {
  const gap = (item.r + LABEL.gap) * distance;
  const diag = gap * 0.75;
  const { width: w, height: h } = block;
  const { x, y } = item;
  const boxes = {
    E: { x: x + gap, y: y - h / 2, anchor: 'start' },
    W: { x: x - gap - w, y: y - h / 2, anchor: 'end' },
    N: { x: x - w / 2, y: y - gap - h, anchor: 'middle' },
    S: { x: x - w / 2, y: y + gap, anchor: 'middle' },
    NE: { x: x + diag, y: y - diag - h, anchor: 'start' },
    NW: { x: x - diag - w, y: y - diag - h, anchor: 'end' },
    SE: { x: x + diag, y: y + diag, anchor: 'start' },
    SW: { x: x - diag - w, y: y + diag, anchor: 'end' },
  };
  return { ...boxes[spot], w, h };
}

function finishLabel(block, box) {
  const alignX = (width) => (box.anchor === 'start' ? box.x : box.anchor === 'end' ? box.x + box.w - width : box.x + (box.w - width) / 2);
  let top = box.y;
  let badge = null;
  if (block.badge) {
    badge = { text: block.badge.text, kind: block.badge.kind, x: alignX(block.badge.width), y: top, width: block.badge.width, height: block.badge.height };
    top += block.badge.height + 4;
  }
  const textX = box.anchor === 'start' ? box.x : box.anchor === 'end' ? box.x + box.w : box.x + box.w / 2;
  return {
    anchor: box.anchor,
    lines: block.lines.map((text, i) => ({ text, x: textX, y: top + i * LABEL.lineHeight + 13 })),
    badge,
    box: { x: box.x, y: box.y, width: box.w, height: box.h },
  };
}

/* ------------------------------------------------------------------
 *  Geometria de apoio
 * ------------------------------------------------------------------ */

function toSegments(points) {
  const list = [];
  for (let i = 1; i < points.length; i++) list.push([...points[i - 1], ...points[i]]);
  return list;
}

const inflate = (box, m) => ({ x: box.x - m, y: box.y - m, w: box.w + 2 * m, h: box.h + 2 * m });

const boxesOverlap = (a, b, margin = 0) =>
  a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;

function circleHitsBox(c, box) {
  const nx = Math.max(box.x, Math.min(c.x, box.x + box.w));
  const ny = Math.max(box.y, Math.min(c.y, box.y + box.h));
  return Math.hypot(c.x - nx, c.y - ny) < c.r;
}

/** Corte de segmento por retângulo (Liang–Barsky). */
function segmentHitsBox([x1, y1, x2, y2], box) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks = [[-dx, x1 - box.x], [dx, box.x + box.w - x1], [-dy, y1 - box.y], [dy, box.y + box.h - y1]];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

function boundsOf(lines, items, circles) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x, y, pad = 0) => {
    minX = Math.min(minX, x - pad);
    minY = Math.min(minY, y - pad);
    maxX = Math.max(maxX, x + pad);
    maxY = Math.max(maxY, y + pad);
  };
  lines.forEach((line) => [...line.edges, line.works ?? []].flat().forEach(([x, y]) => add(x, y, SIZES.line)));
  circles.forEach((c) => add(c.x, c.y, c.r));
  items.forEach(({ label }) => {
    add(label.box.x, label.box.y);
    add(label.box.x + label.box.width, label.box.y + label.box.height);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Estimativa de largura de texto (para testes fora do navegador). */
function estimateText(text, font) {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 15);
  return text.length * size * 0.52;
}
