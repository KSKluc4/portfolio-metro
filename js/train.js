/* ===================================================================
 *  TREM — passeia pela rede e atende os chamados
 * -------------------------------------------------------------------
 *  A rede vira um grafo: as estações são os nós e cada trecho de
 *  trilho entre duas estações é uma aresta. O trem anda sobre a mesma
 *  curva desenhada no mapa (a "régua" do path.js) e assume a cor da
 *  linha em que está; na baldeação, troca de cor.
 *
 *  • Passeio: vai de estação em estação, preferindo a que visitou há
 *    mais tempo, e para um pouco em cada uma.
 *  • Chamado: travelTo(id) calcula o caminho mais curto (Dijkstra) a
 *    partir de onde ele estiver, inclusive no meio de um trecho.
 * =================================================================== */

import { CORNER } from './layout.js';
import { HUB_ID } from './network.js';
import { createRuler, roundedParts } from './path.js';
import { clamp, easeInOut, prefersReducedMotion } from './utils.js';

const NS = 'http://www.w3.org/2000/svg';
const TOUR_SPEED = 95; // px/s no passeio
const TRIP_SPEED = 560; // px/s quando alguém chama
const DWELL = 1600; // ms parado em cada estação no passeio

export function createTrain({ layer, geometry, onStop = () => {} }) {
  const colors = new Map(geometry.lines.map((line) => [line.id, line.color]));
  const edges = geometry.edges.map((edge, id) => {
    const ruler = createRuler(roundedParts(edge.points, CORNER));
    return { id, a: edge.a, b: edge.b, line: edge.line, color: colors.get(edge.line), ruler, length: ruler.length };
  });
  const adjacency = new Map();
  for (const edge of edges) {
    for (const node of [edge.a, edge.b]) {
      if (!adjacency.has(node)) adjacency.set(node, []);
      adjacency.get(node).push(edge);
    }
  }

  const element = buildTrain();
  layer.append(element);

  const position = { node: HUB_ID, edge: null, s: 0 };
  const lastVisit = new Map([[HUB_ID, 0]]);
  let job = null; // viagem em andamento
  let mode = 'parked'; // 'tour' | 'trip' | 'held' | 'parked'
  let resumeAt = 0;
  let frame = 0;
  let running = false;
  let hiddenSince = 0;

  place(nodePoint(HUB_ID));

  // O laço de animação só roda enquanto há viagem ou passeio
  function ensureLoop() {
    if (running || document.hidden) return;
    running = true;
    frame = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (job) {
      const t = Math.min(1, (now - job.start) / job.duration);
      const distance = job.length * job.ease(t);
      moveAlong(job, distance);
      if (t >= 1) finish(now);
    } else if (mode === 'tour' && now >= resumeAt) {
      nextHop(now);
    }
    if (job || mode === 'tour') {
      frame = requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }

  /** Escolhe o próximo trecho do passeio: a estação vizinha visitada há mais tempo. */
  function nextHop(now) {
    const options = adjacency.get(position.node) ?? [];
    if (!options.length) return;
    const edge = options.reduce((best, item) => {
      const other = (e) => (e.a === position.node ? e.b : e.a);
      return (lastVisit.get(other(item)) ?? -1) < (lastVisit.get(other(best)) ?? -1) ? item : best;
    });
    const forward = edge.a === position.node;
    const steps = [{ edge, from: forward ? 0 : edge.length, to: forward ? edge.length : 0 }];
    startJob(steps, now, edge.length / TOUR_SPEED, forward ? edge.b : edge.a);
  }

  function startJob(steps, now, seconds, target) {
    const length = steps.reduce((sum, step) => sum + Math.abs(step.to - step.from), 0);
    job = { steps, length, target, start: now, duration: Math.max(1, seconds * 1000), ease: easeInOut };
    position.node = null;
  }

  function finish(now) {
    const done = job;
    job = null;
    const last = done.steps.at(-1);
    Object.assign(position, { node: done.target, edge: null, s: 0 });
    if (last) place(last.edge.ruler.at(last.to), last.edge.color);
    lastVisit.set(done.target, now);

    if (mode === 'trip') {
      mode = 'held';
      done.resolve?.();
    } else {
      resumeAt = now + DWELL;
    }
    onStop(done.target, mode);
  }

  /** Põe o trem no ponto `distance` da viagem. */
  function moveAlong(trip, distance) {
    let left = distance;
    for (const step of trip.steps) {
      const span = Math.abs(step.to - step.from);
      if (left <= span || step === trip.steps.at(-1)) {
        const s = step.from + Math.sign(step.to - step.from) * Math.min(left, span);
        Object.assign(position, { edge: step.edge, s });
        place(step.edge.ruler.at(s), step.edge.color);
        return;
      }
      left -= span;
    }
  }

  function place(point, color) {
    if (!point) return;
    // O trem é simétrico: girar 180° não muda nada, então o ângulo fica entre -90° e 90°
    let angle = point.angle ?? 0;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    element.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
    if (color && element.dataset.color !== color) {
      element.dataset.color = color;
      element.style.setProperty('--c', color);
    }
  }

  function nodePoint(id) {
    const edge = adjacency.get(id)?.[0];
    if (!edge) return null;
    return edge.ruler.at(edge.a === id ? 0 : edge.length);
  }

  /** Menor caminho entre duas estações (Dijkstra; a rede é pequena). */
  function route(from, to) {
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const done = new Set();
    for (;;) {
      let node = null;
      let best = Infinity;
      for (const [candidate, d] of dist) if (!done.has(candidate) && d < best) [node, best] = [candidate, d];
      if (node === null) return null;
      if (node === to) break;
      done.add(node);
      for (const edge of adjacency.get(node) ?? []) {
        const other = edge.a === node ? edge.b : edge.a;
        if (best + edge.length < (dist.get(other) ?? Infinity)) {
          dist.set(other, best + edge.length);
          prev.set(other, edge);
        }
      }
    }
    const steps = [];
    for (let node = to; node !== from; ) {
      const edge = prev.get(node);
      const other = edge.a === node ? edge.b : edge.a;
      steps.unshift({ edge, from: other === edge.a ? 0 : edge.length, to: other === edge.a ? edge.length : 0 });
      node = other;
    }
    return { steps, length: dist.get(to) };
  }

  /** Caminho a partir de onde o trem está agora (numa estação ou no meio de um trecho). */
  function planFromHere(target) {
    if (position.node) return route(position.node, target);
    const { edge, s } = position;
    const options = [
      { lead: { edge, from: s, to: 0 }, via: edge.a, extra: s },
      { lead: { edge, from: s, to: edge.length }, via: edge.b, extra: edge.length - s },
    ].map(({ lead, via, extra }) => {
      const rest = route(via, target);
      return rest && { steps: [lead, ...rest.steps], length: extra + rest.length };
    });
    return options.filter(Boolean).sort((a, b) => a.length - b.length)[0] ?? null;
  }

  // Aba escondida: para de desenhar e, na volta, continua de onde estava
  function onVisibility() {
    if (document.hidden) {
      hiddenSince = performance.now();
      cancelAnimationFrame(frame);
      running = false;
    } else {
      const pause = performance.now() - hiddenSince;
      if (job) job.start += pause;
      resumeAt += pause;
      ensureLoop();
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    /** Começa o passeio (sem movimento contínuo para quem pediu menos animação).
     *  Se alguém já chamou o trem, a viagem pedida vem primeiro. */
    start() {
      if (mode === 'parked' && !prefersReducedMotion()) mode = 'tour';
      ensureLoop();
    },

    /** Vai até a estação e resolve a promessa quando chegar. Lá ele espera até `release()`. */
    travelTo(target) {
      const now = performance.now();
      if (job?.resolve) job.resolve = null; // chamado anterior foi trocado por este
      const plan = planFromHere(target);
      mode = 'trip';
      if (!plan || !plan.steps.length || prefersReducedMotion()) {
        if (plan?.steps.length) {
          const last = plan.steps.at(-1);
          place(last.edge.ruler.at(last.to), last.edge.color);
        }
        job = null;
        Object.assign(position, { node: target, edge: null, s: 0 });
        mode = 'held';
        onStop(target, mode);
        return Promise.resolve();
      }
      const seconds = clamp(plan.length / TRIP_SPEED, 0.7, 2.6);
      startJob(plan.steps, now, seconds, target);
      ensureLoop();
      return new Promise((resolve) => (job.resolve = resolve));
    },

    /** Põe o trem parado numa estação, sem viagem (usado ao redesenhar o mapa). */
    jumpTo(target) {
      const point = nodePoint(target);
      const edge = adjacency.get(target)?.[0];
      job = null;
      mode = 'held';
      Object.assign(position, { node: target, edge: null, s: 0 });
      place(point, edge?.color);
    },

    /** Para tudo e tira o trem do mapa. */
    destroy() {
      cancelAnimationFrame(frame);
      running = false;
      document.removeEventListener('visibilitychange', onVisibility);
      job = null;
      element.remove();
    },

    /** Libera o trem para voltar ao passeio depois de um tempinho. */
    release(delay = 1400) {
      if (mode !== 'held' && mode !== 'trip') return;
      if (mode === 'trip' && job) job.resolve = null;
      mode = prefersReducedMotion() ? 'parked' : 'tour';
      resumeAt = performance.now() + delay;
      ensureLoop();
    },

    get station() {
      return position.node;
    },
  };
}

/** Um vagão: corpo na cor da tinta, faixa na cor da linha e janelas. */
function buildTrain() {
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('class', 'train');
  group.setAttribute('aria-hidden', 'true');
  group.innerHTML = `
    <rect class="train__body" x="-16" y="-7" width="32" height="14" rx="7"/>
    <rect class="train__stripe" x="-12.5" y="-3.4" width="25" height="6.8" rx="2"/>
    <rect class="train__window" x="-9.5" y="-2" width="5" height="4" rx="1"/>
    <rect class="train__window" x="-2.5" y="-2" width="5" height="4" rx="1"/>
    <rect class="train__window" x="4.5" y="-2" width="5" height="4" rx="1"/>`;
  return group;
}
