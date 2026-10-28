/* ===================================================================
 *  MAPA DE METRÔ — ponto de entrada
 * -------------------------------------------------------------------
 *  Carrega os projetos, monta a rede e o layout, desenha o mapa e liga
 *  as interações:
 *    • passar o mouse numa estação mostra o nome;
 *    • clicar manda o trem até lá e abre o painel da estação;
 *    • legenda destaca linhas; botões e gestos dão zoom e centralizam;
 *    • link direto: #nome-do-repo já abre aquela estação.
 *  Em tela "em pé" (celular) o layout é gerado na vertical; se a tela
 *  girar, o mapa é refeito.
 * =================================================================== */

import { loadProjects } from './data.js';
import { buildNetwork, HUB_ID } from './network.js';
import { computeLayout } from './layout.js';
import { renderMap } from './render.js';
import { createViewport } from './viewport.js';
import { createTrain } from './train.js';
import { createPanel } from './panel.js';
import { initTheme } from './theme.js';
import { icon } from './icons.js';
import { announce, createStatus, createTooltip, renderHeader, renderLegend, showHint } from './ui.js';
import { prefersReducedMotion, wait } from './utils.js';

const $ = (selector) => document.querySelector(selector);
const MOBILE = window.matchMedia('(max-width: 720px)');
const svg = $('#map-svg');
const world = $('#map-world');
const legendRoot = $('#legend');
const panelRoot = $('#panel');
const status = createStatus($('#map-status'));
const tooltip = createTooltip($('#tooltip'));
const forceRefresh = new URLSearchParams(location.search).has('refresh');

// Largura de texto medida com a fonte de verdade (o layout precisa dela para os nomes)
const ruler = document.createElement('canvas').getContext('2d');
const measure = (text, font) => {
  ruler.font = font;
  return ruler.measureText(text).width;
};

// Estado do mapa desenhado (refeito quando a tela gira)
let network = null;
let geometry = null;
let map = null;
let nodes = new Map();
let train = null;
let panel = null;
let legend = null;
let portrait = false;
let selection = 0;
let selected = null;
let returnFocus = null;
let dismissHint = () => {};

const viewport = createViewport({ svg, world, getInsets: insets });

initTheme($('#theme-btn'));
renderHeader(null);
document.querySelectorAll('[data-zoom]').forEach((button) => {
  button.innerHTML = icon({ in: 'plus', out: 'minus', fit: 'center' }[button.dataset.zoom]);
});
$('.legend__toggle').insertAdjacentHTML('afterbegin', icon('map'));
$('.legend__toggle').insertAdjacentHTML('beforeend', icon('chevron', 'legend__chevron'));
$('.panel__close').innerHTML = icon('close');

start();

async function start() {
  status.loading();
  try {
    // As fontes entram na conta do layout; se demorarem, segue com a reserva
    const fonts = Promise.race([
      Promise.all(['700 15px "Roboto Condensed"', '800 9.5px Inter'].map((font) => document.fonts.load(font))),
      wait(2500),
    ]).catch(() => {});
    const data = await loadProjects({ forceRefresh });
    await fonts;
    status.clear();
    mount(data);
  } catch (error) {
    console.error('[metro]', error);
    status.error(() => location.reload());
  }
}

/** Primeira montagem: rede, cabeçalho, legenda, painel e o mapa. */
function mount({ projects, source, savedAt }) {
  network = buildNetwork(projects);
  renderHeader(network);
  panel = createPanel({ root: panelRoot, network, onClose: closePanel, onSelect: select });
  // A legenda entra antes do enquadramento: o mapa é centralizado no espaço que sobra
  legend = renderLegend(legendRoot, network, { source, savedAt, onHighlight: highlightLine });

  draw();

  // Tela girou (ou a janela mudou muito de formato): refaz o layout na outra orientação
  let timer = 0;
  new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => isPortrait() !== portrait && draw(), 250);
  }).observe(svg);

  bindControls();

  // Entrada: as linhas se desenham a partir da Central, na ordem em que nasceram
  if (!prefersReducedMotion()) {
    svg.classList.add('is-intro');
    setTimeout(() => svg.classList.remove('is-intro'), 2600);
  }

  const deepLink = decodeURIComponent(location.hash.slice(1));
  if (nodes.has(deepLink)) select(deepLink);
  else dismissHint = showHint($('#hint'));
}

/** Gera o layout para o formato atual da tela e desenha o mapa. */
function draw() {
  portrait = isPortrait();
  train?.destroy();
  tooltip.hide();

  geometry = computeLayout(network, { measure, portrait });
  map = renderMap(world, geometry, network);
  nodes = new Map([[HUB_ID, geometry.hub], ...geometry.stations.map((station) => [station.id, station])]);

  viewport.setBounds(geometry.bounds);
  viewport.fit({ animate: false });

  train = createTrain({ layer: map.layers.train, geometry, onStop: pulse });
  // Na primeira vez o trem sai depois que as linhas terminam de se desenhar
  const firstDraw = !selected && !svg.dataset.drawn;
  svg.dataset.drawn = 'yes';
  if (firstDraw && !prefersReducedMotion()) setTimeout(() => train.start(), 1500);
  else train.start();
  if (selected) {
    map.stations.get(selected)?.classList.add('is-selected');
    train.jumpTo(selected);
    const node = nodes.get(selected);
    viewport.reveal(node.x, node.y);
  }
  if (legend?.pinned) highlightLine(legend.pinned);

  bindStations();
}

const isPortrait = () => {
  const box = svg.getBoundingClientRect();
  return box.height > box.width * 1.15;
};

// ---------- estações ----------

function bindStations() {
  for (const [id, element] of map.stations) {
    element.addEventListener('click', () => {
      if (viewport.consumeDrag()) return;
      returnFocus = element;
      select(id);
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        returnFocus = element;
        select(id);
      }
    });
    element.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && showTip(id));
    element.addEventListener('pointerleave', () => tooltip.hide());
    element.addEventListener('focus', () => showTip(id));
    element.addEventListener('blur', () => tooltip.hide());
  }
  // O nome também é clicável
  for (const [id, element] of map.labels) {
    element.addEventListener('click', () => !viewport.consumeDrag() && select(id));
  }
}

function tipPoint(id) {
  const node = nodes.get(id);
  const point = viewport.toScreen(node.x, node.y);
  return { x: point.x, y: point.y - node.r * viewport.view.k - 10 };
}

function showTip(id) {
  tooltip.show(
    network.stations.find((station) => station.id === id),
    network,
    tipPoint(id)
  );
}

viewport.onChange((view, event) => {
  if (event === 'drag-start') {
    dismissHint();
    tooltip.hide();
  } else if (tooltip.current && nodes.size) {
    tooltip.move(tipPoint(tooltip.current));
  }
});

// ---------- escolher uma estação: o trem vai até lá e o painel abre ----------

async function select(id, { fromPanel = false } = {}) {
  const node = nodes.get(id);
  if (!node) return;
  const ticket = ++selection;
  dismissHint();
  tooltip.hide();
  markSelected(id);

  if (fromPanel && panel.isOpen) {
    // Navegando pelo painel: troca o conteúdo já e o trem vai junto
    showPanel(id);
    viewport.reveal(node.x, node.y);
    train.travelTo(id);
    return;
  }

  if (panel.isOpen) panel.close(); // fecha para a viagem ficar à vista
  announce(`Trem a caminho de ${titleOf(id)}.`);
  viewport.reveal(node.x, node.y);
  await train.travelTo(id);
  if (ticket !== selection) return; // escolheram outra estação no caminho
  showPanel(id);
}

function showPanel(id) {
  panel.open(id);
  history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  announce(`Estação ${titleOf(id)}.`);
  // Depois que o painel entra: se a rede cabe inteira no espaço livre, mostra tudo;
  // senão, só garante que a estação não ficou escondida atrás dele
  setTimeout(() => {
    const node = nodes.get(id);
    if (!node) return;
    if (!viewport.touched && viewport.fitIfReadable(0.75)) return;
    viewport.reveal(node.x, node.y, 70);
  }, 80);
}

function closePanel() {
  if (!panel.isOpen) return;
  const hadFocus = panelRoot.contains(document.activeElement);
  panel.close();
  markSelected(null);
  train.release();
  selection++;
  history.replaceState(null, '', location.pathname + location.search);
  // Se a pessoa não mexeu no mapa, volta a mostrar a rede inteira
  if (!viewport.touched) viewport.fit();
  if (hadFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function markSelected(id) {
  if (selected) map.stations.get(selected)?.classList.remove('is-selected');
  selected = id;
  if (id) map.stations.get(id)?.classList.add('is-selected');
}

const titleOf = (id) => (id === HUB_ID ? network.hub.title : network.stations.find((s) => s.id === id).project.title);

/** Anel que se espalha quando o trem para numa estação. */
function pulse(id) {
  const element = map.stations.get(id);
  if (!element) return;
  element.classList.remove('is-boarding');
  void element.getBoundingClientRect(); // reinicia a animação
  element.classList.add('is-boarding');
}

/** Destaca uma linha (o resto do mapa fica apagado). */
function highlightLine(lineId) {
  if (!map) return;
  svg.classList.toggle('has-focus-line', Boolean(lineId));
  map.lines.forEach((element, id) => element.classList.toggle('is-focus', id === lineId));
  const onLine = (element) => !lineId || element.dataset.id === HUB_ID || (element.dataset.lines ?? '').split(' ').includes(lineId);
  map.stations.forEach((element) => element.classList.toggle('is-focus', onLine(element)));
  map.labels.forEach((element, id) => element.classList.toggle('is-focus', onLine(map.stations.get(id))));
}

// ---------- botões, teclado e link direto ----------

function bindControls() {
  $('[data-zoom="in"]').addEventListener('click', () => viewport.zoomIn());
  $('[data-zoom="out"]').addEventListener('click', () => viewport.zoomOut());
  $('[data-zoom="fit"]').addEventListener('click', () => viewport.fit());

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (panel.isOpen) closePanel();
    else if (legend.pinned) legend.clearPin();
  });

  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (nodes.has(id) && id !== panel.current) select(id);
  });
}

/** Quanto do mapa está coberto por cabeçalho, legenda e painel (para enquadrar o resto). */
function insets() {
  const box = svg.getBoundingClientRect();
  const result = { top: 0, right: 0, bottom: 0, left: 0 };
  if (MOBILE.matches) {
    result.top = $('.topbar').getBoundingClientRect().bottom - box.top;
    result.bottom = 76;
  } else if (!legendRoot.hidden && !legendRoot.classList.contains('is-collapsed')) {
    // A legenda fica no canto esquerdo: o mapa se centraliza na faixa à direita dela
    result.left = legendRoot.getBoundingClientRect().right - box.left + 8;
  }
  const covered = panel?.insets() ?? {};
  if (covered.right) result.right = covered.right;
  if (covered.bottom) result.bottom = Math.max(result.bottom, covered.bottom);
  return result;
}
