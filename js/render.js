/* ===================================================================
 *  DESENHO — monta o SVG do mapa a partir do layout
 * -------------------------------------------------------------------
 *  Camadas, de baixo para cima: rio, linhas, estações, nomes e o trem.
 *  Cada linha leva por baixo uma faixa da cor do fundo: onde duas
 *  linhas se cruzam, a de cima abre um vão na de baixo, como nos
 *  mapas impressos.
 * =================================================================== */

import { CORNER, SIZES } from './layout.js';
import { roundedParts, partsToD } from './path.js';
import { joinList } from './utils.js';

const NS = 'http://www.w3.org/2000/svg';

export function renderMap(world, geometry, network) {
  world.replaceChildren();
  const layers = {};
  for (const name of ['river', 'lines', 'stations', 'labels', 'train']) {
    layers[name] = el('g', { class: `map__${name}` });
    world.append(layers[name]);
  }
  const lineById = new Map(network.lines.map((line) => [line.id, line]));

  if (geometry.river) {
    layers.river.append(el('path', { class: 'river', d: partsToD(roundedParts(geometry.river.points, 70)), 'stroke-width': geometry.river.width }));
  }

  // Linhas: faixa de respiro + trilho, trecho "em obras" e o número na ponta.
  // pathLength=1 deixa a animação de entrada "desenhar" cada linha a partir da Central.
  const lines = new Map();
  geometry.lines.forEach((line, index) => {
    const group = el('g', { class: 'line', 'data-line': line.id, style: `${lineStyle(line)};--i:${index}` });
    const d = partsToD(line.edges.flatMap((points) => roundedParts(points, CORNER)));
    if (d) group.append(el('path', { class: 'line__casing', d, pathLength: 1 }), el('path', { class: 'line__track', d, pathLength: 1 }));
    if (line.works) group.append(el('path', { class: 'line__works', d: partsToD(roundedParts(line.works, CORNER)) }));
    if (line.terminus) {
      const badge = el('g', { class: 'line__terminus', transform: `translate(${round(line.terminus.x)} ${round(line.terminus.y)})` });
      badge.append(el('circle', { r: SIZES.terminus }), el('text', { y: 4.2 }, String(line.number)));
      group.append(badge);
    }
    layers.lines.append(group);
    lines.set(line.id, group);
  });

  // Estações (a Central primeiro)
  const stations = new Map();
  const labels = new Map();
  [geometry.hub, ...geometry.stations].forEach((station, order) => {
    const isHub = station === geometry.hub;
    const first = !isHub && lineById.get(station.lines[0]);
    const classes = ['station', isHub && 'station--hub', station.interchange && 'station--interchange', station.isNewest && 'is-newest'];

    const group = el('g', {
      class: classes.filter(Boolean).join(' '),
      'data-id': station.id,
      'data-lines': isHub ? '' : station.lines.join(' '),
      transform: `translate(${round(station.x)} ${round(station.y)})`,
      tabindex: 0,
      role: 'button',
      'aria-label': isHub ? `${station.title}: todas as linhas partem daqui. Abrir o painel.` : stationLabel(station, lineById),
      style: `${first && !station.interchange ? `${lineStyle(first)};` : ''}--i:${order}`,
    });
    group.append(
      el('circle', { class: 'station__hit', r: Math.max(SIZES.hit, station.r + 8) }),
      el('circle', { class: 'station__pulse', r: station.r }),
      el('circle', { class: 'station__dot', r: station.r })
    );
    if (isHub) group.append(el('circle', { class: 'station__core', r: 6 }));
    layers.stations.append(group);
    stations.set(station.id, group);

    labels.set(station.id, renderLabel(station, isHub, order));
    layers.labels.append(labels.get(station.id));
  });

  return { layers, lines, stations, labels };
}

/** Nome da estação (e o selo "Nova estação" / "Você está aqui", se houver). */
function renderLabel(station, isHub, order) {
  const { label } = station;
  const group = el('g', { class: `label${isHub ? ' label--hub' : ''}`, 'data-id': station.id, 'aria-hidden': 'true', style: `--i:${order}` });

  if (label.badge) {
    const { badge } = label;
    const tag = el('g', { class: `tag tag--${badge.kind}`, transform: `translate(${round(badge.x)} ${round(badge.y)})` });
    tag.append(
      el('rect', { width: round(badge.width), height: badge.height, rx: 3 }),
      el('text', { x: round(badge.width / 2), y: 12 }, badge.text.toUpperCase())
    );
    group.append(tag);
  }

  const text = el('text', { class: 'label__text', 'text-anchor': label.anchor });
  for (const line of label.lines) text.append(el('tspan', { x: round(line.x), y: round(line.y) }, line.text));
  group.append(text);
  return group;
}

/** Texto lido por leitores de tela ao focar a estação. */
function stationLabel(station, lineById) {
  const names = station.lines.map((id) => `${lineById.get(id).number} (${lineById.get(id).language})`);
  const where = station.interchange ? `baldeação das linhas ${joinList(names)}` : `linha ${names[0]}`;
  return `Estação ${station.title}, ${where}${station.isNewest ? ', nova estação' : ''}. Embarcar.`;
}

/** Variáveis de cor de uma linha: a cor e a cor do texto que vai em cima dela. */
export const lineStyle = (line) => `--c:${line.color};--on:${textOn(line.color)}`;

/** Branco ou azul-marinho: o que tiver mais contraste sobre a cor. */
export function textOn(color) {
  const rgb = parseColor(color);
  if (!rgb) return '#fff';
  const lum = luminance(rgb);
  const onWhite = 1.05 / (lum + 0.05);
  const onInk = (lum + 0.05) / (luminance([0x14, 0x21, 0x3d]) + 0.05);
  return onWhite >= onInk ? '#fff' : '#14213d';
}

function parseColor(color) {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color?.trim() ?? '')?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null && value !== false) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

const round = (value) => Math.round(value * 100) / 100;
