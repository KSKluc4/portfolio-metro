/* ===================================================================
 *  TRAÇADOS — trilhos com cantos arredondados e a "régua" do trem
 * -------------------------------------------------------------------
 *  Um trilho é uma lista de pontos (as curvas). Aqui ele vira:
 *    • partes: retas e curvas (Bézier quadrática) nos cantos;
 *    • o atributo `d` do <path> do SVG;
 *    • uma régua: dado "andei X pixels", diz onde o trem está e para
 *      onde ele aponta. O trem anda pelas mesmas partes que o desenho.
 * =================================================================== */

/** Remove os pontos do meio dos trechos retos: sobram só as curvas. */
export function simplify(points) {
  if (points.length <= 2) return points.slice();
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = out.at(-1);
    const [bx, by] = points[i];
    const [cx, cy] = points[i + 1];
    const sameWay = Math.sign(bx - ax) === Math.sign(cx - bx) && Math.sign(by - ay) === Math.sign(cy - by);
    if (!sameWay) out.push(points[i]);
  }
  out.push(points.at(-1));
  return out;
}

/** Pontos → partes, com os cantos arredondados (raio máximo `radius`). */
export function roundedParts(points, radius) {
  const parts = [];
  let [cx, cy] = points[0];

  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i];
    const next = points[i + 1];
    if (!next) {
      parts.push(line(cx, cy, px, py));
      break;
    }
    const [ax, ay] = points[i - 1];
    const [nx, ny] = next;
    const inLen = Math.hypot(px - ax, py - ay);
    const outLen = Math.hypot(nx - px, ny - py);
    // Cada canto usa no máximo metade do trecho, para dois cantos não se encostarem
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const startX = px - ((px - ax) / inLen) * r;
    const startY = py - ((py - ay) / inLen) * r;
    const endX = px + ((nx - px) / outLen) * r;
    const endY = py + ((ny - py) / outLen) * r;

    parts.push(line(cx, cy, startX, startY), quad(startX, startY, px, py, endX, endY));
    [cx, cy] = [endX, endY];
  }
  return parts.filter((part) => part.length > 0.01);
}

/** Partes → atributo `d` do SVG. Partes seguidas viram um caminho só. */
export function partsToD(parts) {
  if (!parts.length) return '';
  const n = (value) => Math.round(value * 100) / 100;
  let d = '';
  let last = null;
  for (const part of parts) {
    // Só levanta a caneta (M) quando a parte não continua de onde a anterior parou
    if (!last || Math.hypot(part.x0 - last[0], part.y0 - last[1]) > 0.5) d += `${d ? ' ' : ''}M${n(part.x0)} ${n(part.y0)}`;
    d += part.type === 'L' ? ` L${n(part.x1)} ${n(part.y1)}` : ` Q${n(part.cx)} ${n(part.cy)} ${n(part.x1)} ${n(part.y1)}`;
    last = [part.x1, part.y1];
  }
  return d;
}

/**
 * Régua para andar sobre as partes: `at(s)` devolve { x, y, angle }
 * no ponto a `s` pixels do começo (angle em graus).
 */
export function createRuler(parts) {
  const starts = [];
  let length = 0;
  for (const part of parts) {
    starts.push(length);
    length += part.length;
  }

  function at(s) {
    const dist = Math.min(Math.max(s, 0), length);
    let i = parts.length - 1;
    while (i > 0 && starts[i] > dist) i--;
    const part = parts[i];
    const local = dist - starts[i];
    return part.type === 'L' ? pointOnLine(part, local) : pointOnQuad(part, local);
  }

  return { length, at };
}

// ---------- partes ----------

function line(x0, y0, x1, y1) {
  return { type: 'L', x0, y0, x1, y1, length: Math.hypot(x1 - x0, y1 - y0) };
}

function quad(x0, y0, cx, cy, x1, y1) {
  // Comprimento da curva medido em 16 pedacinhos (tabela usada pela régua)
  const table = [0];
  let length = 0;
  let prev = [x0, y0];
  for (let i = 1; i <= 16; i++) {
    const point = quadPoint(x0, y0, cx, cy, x1, y1, i / 16);
    length += Math.hypot(point[0] - prev[0], point[1] - prev[1]);
    table.push(length);
    prev = point;
  }
  return { type: 'Q', x0, y0, cx, cy, x1, y1, length, table };
}

function quadPoint(x0, y0, cx, cy, x1, y1, t) {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}

function pointOnLine(part, local) {
  const t = part.length ? local / part.length : 0;
  return {
    x: part.x0 + (part.x1 - part.x0) * t,
    y: part.y0 + (part.y1 - part.y0) * t,
    angle: (Math.atan2(part.y1 - part.y0, part.x1 - part.x0) * 180) / Math.PI,
  };
}

function pointOnQuad(part, local) {
  // Acha o t da curva pela tabela de comprimentos
  const { table } = part;
  let i = 1;
  while (i < table.length - 1 && table[i] < local) i++;
  const span = table[i] - table[i - 1] || 1;
  const t = (i - 1 + (local - table[i - 1]) / span) / (table.length - 1);

  const [x, y] = quadPoint(part.x0, part.y0, part.cx, part.cy, part.x1, part.y1, t);
  const dx = 2 * (1 - t) * (part.cx - part.x0) + 2 * t * (part.x1 - part.cx);
  const dy = 2 * (1 - t) * (part.cy - part.y0) + 2 * t * (part.y1 - part.cy);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}
