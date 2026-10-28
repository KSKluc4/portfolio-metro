/* ===================================================================
 *  INTERFACE — placa, legenda, dica, avisos e o balão das estações
 * =================================================================== */

import { CONFIG } from '../config.js';
import { lineStyle } from './render.js';
import { icon } from './icons.js';
import { escapeHtml, formatMonth, joinList } from './utils.js';

const SOURCE_TEXT = {
  api: 'GitHub · ao vivo',
  cache: 'GitHub · cache',
  'stale-cache': 'GitHub · cache antigo',
  fallback: 'projects.json (offline)',
};

/** Textos fixos da página que vêm do config. */
export function renderHeader(network) {
  document.querySelector('#plate-name').textContent = CONFIG.name;
  document.querySelector('#plate-sub').textContent = CONFIG.subtitle;
  document.querySelector('#github-link').href = `https://github.com/${encodeURIComponent(CONFIG.githubUser)}`;
  document.title = `${CONFIG.name} · ${CONFIG.subtitle}`;

  if (network) {
    const stations = network.stations.length;
    const lines = network.lines.length;
    document.querySelector('#stats').innerHTML =
      `<b>${stations}</b> ${stations === 1 ? 'estação' : 'estações'} <span aria-hidden="true">·</span> <b>${lines}</b> ${lines === 1 ? 'linha' : 'linhas'}`;
    // Faixa da placa com as cores das linhas, na ordem delas
    document.querySelector('#plate-stripe').innerHTML = network.lines.map((line) => `<span style="${lineStyle(line)}"></span>`).join('');
  }
}

/** Legenda: linhas (passar o mouse destaca a linha no mapa) e símbolos. */
export function renderLegend(root, network, { source, savedAt, onHighlight }) {
  const body = root.querySelector('.legend__body');
  const count = (n) => `${n} ${n === 1 ? 'estação' : 'estações'}`;

  body.innerHTML = `
    <h2 class="legend__title">Linhas</h2>
    <ul class="legend__lines">
      ${network.lines
        .map(
          (line) => `
        <li>
          <button class="legend__line" type="button" data-line="${escapeHtml(line.id)}" style="${lineStyle(line)}" aria-pressed="false">
            <span class="line-badge">${line.number}</span>
            <span class="legend__swatch" aria-hidden="true"></span>
            <span class="legend__name">${escapeHtml(line.language)}<small>${line.colorName ? `Linha ${escapeHtml(line.colorName)} · ` : ''}${count(line.stations.length)}</small></span>
          </button>
        </li>`
        )
        .join('')}
    </ul>
    <h2 class="legend__title">Símbolos</h2>
    <ul class="legend__symbols">
      <li><svg viewBox="0 0 36 20" aria-hidden="true"><path class="sym-track" d="M2 10h32"/><circle class="sym-station" cx="18" cy="10" r="6"/></svg>Estação: um projeto</li>
      <li><svg viewBox="0 0 36 20" aria-hidden="true"><path class="sym-track" d="M2 10h32"/><circle class="sym-interchange" cx="18" cy="10" r="7.5"/></svg>Baldeação: mais de uma linguagem</li>
      <li><svg viewBox="0 0 36 20" aria-hidden="true"><path class="sym-works" d="M3 10h30"/></svg>Em obras: o próximo projeto entra aqui</li>
    </ul>
    <p class="legend__source"><span class="source-dot" data-source="${escapeHtml(source)}"></span>Dados: ${SOURCE_TEXT[source] ?? source}${savedAt && source !== 'api' ? ` de ${new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>`;

  // Destaque de linha: mouse/foco mostram; clique fixa (bom para toque)
  let pinned = null;
  const show = (id) => onHighlight(id ?? pinned);
  body.querySelectorAll('.legend__line').forEach((button) => {
    const id = button.dataset.line;
    button.addEventListener('pointerenter', () => show(id));
    button.addEventListener('pointerleave', () => show(null));
    button.addEventListener('focus', () => show(id));
    button.addEventListener('blur', () => show(null));
    button.addEventListener('click', () => {
      pinned = pinned === id ? null : id;
      body.querySelectorAll('.legend__line').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.line === pinned)));
      show(null);
    });
  });

  // Abre/fecha a legenda (no celular começa fechada)
  const toggle = root.querySelector('.legend__toggle');
  const setOpen = (open) => {
    root.classList.toggle('is-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  setOpen(!window.matchMedia('(max-width: 720px)').matches);
  toggle.addEventListener('click', () => setOpen(root.classList.contains('is-collapsed')));
  root.hidden = false;

  return {
    clearPin() {
      pinned = null;
      body.querySelectorAll('.legend__line').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      show(null);
    },
    get pinned() {
      return pinned;
    },
  };
}

/** Balão com o nome da estação, ao passar o mouse ou focar com o teclado. */
export function createTooltip(root) {
  let currentId = null;
  return {
    show(station, network, point) {
      currentId = station?.id ?? 'hub';
      if (station) {
        const lines = station.lines.map((id) => network.lines.find((line) => line.id === id));
        root.innerHTML = `
          <strong>${escapeHtml(station.project.title)}</strong>
          <span class="tooltip__lines">${lines.map((line) => `<span class="line-badge" style="${lineStyle(line)}">${line.number}</span>`).join('')}
          ${escapeHtml(joinList(lines.map((line) => line.language)))} · ${escapeHtml(formatMonth(station.project.createdAt))}</span>`;
      } else {
        root.innerHTML = `<strong>${escapeHtml(network.hub.title)}</strong><span class="tooltip__lines">Todas as linhas partem daqui</span>`;
      }
      this.move(point);
      root.hidden = false;
    },
    move(point) {
      root.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
    },
    hide() {
      currentId = null;
      root.hidden = true;
    },
    get current() {
      return currentId;
    },
  };
}

/** Mensagens no meio do mapa: carregando e erro. */
export function createStatus(root) {
  return {
    loading() {
      root.innerHTML = `<p class="status__box">${icon('train', 'status__train')}<span>Carregando a rede…</span></p>`;
      root.hidden = false;
    },
    error(onRetry) {
      root.innerHTML = `
        <div class="status__box status__box--error" role="alert">
          <p><strong>Não consegui carregar os projetos.</strong> A API do GitHub e o arquivo de reserva falharam.</p>
          <button type="button" class="btn btn--code">${icon('refresh')} Tentar de novo</button>
        </div>`;
      root.querySelector('button').addEventListener('click', onRetry);
      root.hidden = false;
    },
    clear() {
      root.hidden = true;
      root.innerHTML = '';
    },
  };
}

/** Dica de primeira visita; some na primeira interação. */
export function showHint(root) {
  const touch = window.matchMedia('(hover: none)').matches;
  root.innerHTML = `${icon('train')}<span>${touch ? 'Toque' : 'Clique'} numa estação para embarcar</span>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-visible'));
  let gone = false;
  return () => {
    if (gone) return;
    gone = true;
    root.classList.remove('is-visible');
    setTimeout(() => (root.hidden = true), 400);
  };
}

/** Avisos para leitores de tela. */
export function announce(text) {
  const region = document.querySelector('#announcer');
  region.textContent = '';
  setTimeout(() => (region.textContent = text), 30);
}
