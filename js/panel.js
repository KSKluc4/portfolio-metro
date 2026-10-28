/* ===================================================================
 *  PAINEL — a placa da estação e o painel de embarque
 * -------------------------------------------------------------------
 *  No computador abre na lateral; no celular, como gaveta de baixo
 *  para cima (dá para arrastar para baixo e fechar).
 *  Os dados do projeto aparecem num painel de partidas de palhetas
 *  (cada letra numa plaquinha que gira até parar no valor certo).
 * =================================================================== */

import { CONFIG } from '../config.js';
import { HUB_ID } from './network.js';
import { lineStyle } from './render.js';
import { icon } from './icons.js';
import { escapeHtml, formatDate, formatMonth, joinList, prefersReducedMotion, timeAgo } from './utils.js';

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DRAWER = window.matchMedia('(max-width: 720px)');

export function createPanel({ root, network, onClose, onSelect }) {
  const body = root.querySelector('.panel__body');
  const lineById = new Map(network.lines.map((line) => [line.id, line]));
  const order = [network.hub.id, ...network.stations.map((station) => station.id)];
  let current = null;
  let flapTimer = 0;

  root.querySelector('.panel__close').addEventListener('click', () => onClose());

  // Cliques dentro do painel: navegar entre estações e "próximas partidas"
  body.addEventListener('click', (event) => {
    const target = event.target.closest('[data-go]');
    if (target) onSelect(target.dataset.go, { fromPanel: true });
  });

  enableDrawerDrag();

  function open(id) {
    const isHub = id === HUB_ID;
    const station = network.stations.find((item) => item.id === id);
    if (!isHub && !station) return;

    current = id;
    body.innerHTML = isHub ? hubHtml() : stationHtml(station);
    body.scrollTop = 0;
    root.querySelector('.panel__scroll')?.scrollTo?.(0, 0);
    root.hidden = false;
    root.style.removeProperty('--drag');
    document.body.classList.add('has-panel');
    // Próximo quadro: deixa o navegador pintar o estado fechado antes de animar.
    // O foco vai para o título só depois: painel invisível não recebe foco.
    requestAnimationFrame(() => {
      root.classList.add('is-open');
      if (current === id) body.querySelector('h2')?.focus({ preventScroll: true });
    });
    startFlaps();
  }

  function close() {
    if (!current) return;
    current = null;
    clearInterval(flapTimer);
    root.classList.remove('is-open');
    document.body.classList.remove('has-panel');
    const hide = () => {
      if (!current) root.hidden = true;
    };
    if (prefersReducedMotion()) hide();
    else root.addEventListener('transitionend', hide, { once: true });
  }

  // ---------- conteúdo ----------

  function stationHtml(station) {
    const { project } = station;
    const lines = station.lines.map((id) => lineById.get(id));
    const index = order.indexOf(station.id);
    const prev = order[index - 1];
    const next = order[index + 1];
    const titleOf = (id) => (id === HUB_ID ? network.hub.title : network.stations.find((s) => s.id === id).project.title);

    const board = [
      ['Inaugurada', formatDate(project.createdAt), ''],
      ['Atualizada', formatDate(project.updatedAt), timeAgo(project.updatedAt)],
      ['Estrelas', String(project.stars), ''],
    ];

    return `
      <header class="sign" style="${lineStyle(lines[0])}">
        <div class="sign__bands" aria-hidden="true">${lines.map((line) => `<span style="${lineStyle(line)}"></span>`).join('')}</div>
        <h2 class="sign__title" id="panel-title" tabindex="-1">${escapeHtml(project.title)}</h2>
        <ul class="sign__lines" aria-label="${station.interchange ? 'Estação de baldeação' : 'Linha'}">
          ${station.interchange ? '<li class="sign__kind">Baldeação</li>' : ''}
          ${lines.map((line) => `<li>${lineBadge(line)}<span>${escapeHtml(line.language)}</span></li>`).join('')}
        </ul>
        ${station.isNewest ? '<p class="sign__new">Nova estação</p>' : ''}
      </header>

      ${project.image ? `<figure class="shot"><img src="${escapeHtml(project.image)}" alt="Print do projeto ${escapeHtml(project.title)}" loading="lazy"></figure>` : ''}

      ${project.description ? `<p class="desc">${escapeHtml(project.description)}</p>` : '<p class="desc desc--empty">Projeto sem descrição por enquanto.</p>'}

      <section class="board" aria-label="Painel de embarque">
        <dl class="board__rows">
          ${board
            .map(
              ([key, value, note]) =>
                `<div class="board__row"><dt>${key}</dt><dd>${flap(value, key === 'Estrelas' ? 'star' : '')}${note ? `<small class="board__note">${escapeHtml(note)}</small>` : ''}</dd></div>`
            )
            .join('')}
        </dl>
      </section>

      <section class="block" aria-labelledby="langs-title">
        <h3 class="block__title" id="langs-title">Linguagens</h3>
        ${languagesHtml(project.languages)}
      </section>

      ${
        project.tech.length
          ? `<section class="block" aria-labelledby="tech-title">
              <h3 class="block__title" id="tech-title">Tecnologias</h3>
              <ul class="chips">${project.tech.map((tech) => `<li>${escapeHtml(tech)}</li>`).join('')}</ul>
            </section>`
          : ''
      }

      <div class="actions">
        ${
          project.demoUrl
            ? `<a class="btn btn--board" style="${lineStyle(lines[0])}" href="${escapeHtml(project.demoUrl)}" target="_blank" rel="noopener noreferrer">Embarcar ${icon('board')}</a>`
            : ''
        }
        ${
          project.repoUrl
            ? `<a class="btn btn--code" href="${escapeHtml(project.repoUrl)}" target="_blank" rel="noopener noreferrer">${icon('code')} Ver código</a>`
            : ''
        }
      </div>

      <nav class="hop" aria-label="Outras estações">
        ${prev ? `<button class="hop__btn" type="button" data-go="${escapeHtml(prev)}">${icon('prev')}<span>${escapeHtml(titleOf(prev))}<small>Estação anterior</small></span></button>` : '<span></span>'}
        ${next ? `<button class="hop__btn hop__btn--next" type="button" data-go="${escapeHtml(next)}"><span>${escapeHtml(titleOf(next))}<small>Próxima estação</small></span>${icon('next')}</button>` : ''}
      </nav>`;
  }

  function hubHtml() {
    const profile = `https://github.com/${encodeURIComponent(CONFIG.githubUser)}`;
    const links = (CONFIG.links || []).filter((link) => /^(https?:|mailto:)/i.test(link?.url ?? ''));
    const stations = network.stations.length;

    return `
      <header class="sign sign--hub">
        <div class="sign__bands" aria-hidden="true">${network.lines.map((line) => `<span style="${lineStyle(line)}"></span>`).join('')}</div>
        <h2 class="sign__title" id="panel-title" tabindex="-1">${escapeHtml(network.hub.title)}</h2>
        <p class="sign__sub">Todas as linhas partem daqui</p>
      </header>

      <p class="desc">
        Cada linha é uma linguagem e cada estação é um projeto de ${escapeHtml(CONFIG.name)}, na ordem em que foram criados.
        Projetos com mais de uma linguagem viram estações de baldeação.
      </p>

      <section class="board board--departures" aria-labelledby="departures-title">
        <h3 class="board__title" id="departures-title">Próximas partidas</h3>
        <ol class="departures">
          ${network.stations
            .map(
              (station) => `
            <li>
              <button type="button" class="departure" data-go="${escapeHtml(station.id)}">
                <span class="departure__lines">${station.lines.map((id) => lineBadge(lineById.get(id))).join('')}</span>
                <span class="departure__name">${escapeHtml(station.project.title)}</span>
                <span class="departure__when">${station.isNewest ? '<b>Nova</b>' : escapeHtml(formatMonth(station.project.createdAt))}</span>
              </button>
            </li>`
            )
            .join('')}
        </ol>
      </section>

      <p class="hub-note">${stations} ${stations === 1 ? 'estação' : 'estações'} em ${network.lines.length} ${network.lines.length === 1 ? 'linha' : 'linhas'}. Arraste para mover o mapa e use a roda do mouse ou dois dedos para o zoom.</p>

      <div class="actions">
        <a class="btn btn--code" href="${profile}" target="_blank" rel="noopener noreferrer">${icon('github')} Perfil no GitHub</a>
        ${links.map((link) => `<a class="btn btn--code" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${icon('external')} ${escapeHtml(link.label)}</a>`).join('')}
      </div>`;
  }

  function languagesHtml(languages) {
    if (!languages.length) return '<p class="desc desc--empty">O GitHub não informou as linguagens.</p>';
    // Linguagens que viraram linha usam a cor da linha; as outras ficam em tons neutros
    const colorOf = (name) => network.lines.find((line) => line.language === name)?.color;
    const shown = languages.slice(0, 5);
    const rest = languages.slice(5).reduce((sum, lang) => sum + lang.percent, 0);
    if (rest > 0) shown.push({ name: 'Outras', percent: rest });
    const pct = (value) => (value >= 1 ? `${Math.round(value)}%` : '<1%');

    return `
      <div class="langbar" aria-hidden="true">
        ${shown.map((lang, i) => `<span style="flex:${Math.max(lang.percent, 0.6)};--c:${colorOf(lang.name) ?? `var(--neutral-${(i % 3) + 1})`}"></span>`).join('')}
      </div>
      <ul class="langs">
        ${shown
          .map(
            (lang, i) => `<li style="--c:${colorOf(lang.name) ?? `var(--neutral-${(i % 3) + 1})`}">
              <span class="langs__dot"></span><span class="langs__name">${escapeHtml(lang.name)}</span><span class="langs__pct">${pct(lang.percent)}</span>
            </li>`
          )
          .join('')}
      </ul>`;
  }

  const lineBadge = (line) =>
    `<span class="line-badge" style="${lineStyle(line)}" title="Linha ${line.number}${line.colorName ? ` · ${escapeHtml(line.colorName)}` : ''}">${line.number}</span>`;

  /** Valor do painel de palhetas: uma plaquinha por caractere (o texto real fica para leitores de tela). */
  function flap(value, iconName) {
    const text = String(value).toUpperCase();
    const tiles = [...text]
      .map((char) => (char === ' ' ? '<span class="flap__gap"></span>' : `<span class="flap__tile" data-char="${escapeHtml(char)}">${escapeHtml(char)}</span>`))
      .join('');
    return `${iconName ? icon(iconName, 'board__icon') : ''}<span class="sr-only">${escapeHtml(value)}</span><span class="flap" aria-hidden="true">${tiles}</span>`;
  }

  /** Gira as palhetas: cada uma passa por letras aleatórias e para no valor certo. */
  function startFlaps() {
    clearInterval(flapTimer);
    const tiles = [...body.querySelectorAll('.flap__tile')];
    if (!tiles.length || prefersReducedMotion()) return;
    const stops = tiles.map((tile, i) => 4 + (i % 9) + Math.floor(i / 9) * 2);
    let tick = 0;
    tiles.forEach((tile) => tile.classList.add('is-spinning'));
    flapTimer = setInterval(() => {
      tick++;
      let spinning = 0;
      tiles.forEach((tile, i) => {
        if (tick < stops[i]) {
          spinning++;
          tile.textContent = /\d/.test(tile.dataset.char)
            ? String(Math.floor(Math.random() * 10))
            : /[A-ZÀ-Ú]/.test(tile.dataset.char)
              ? FLAP_CHARS[Math.floor(Math.random() * 26)]
              : tile.dataset.char;
        } else if (tile.classList.contains('is-spinning')) {
          tile.textContent = tile.dataset.char;
          tile.classList.remove('is-spinning');
        }
      });
      if (!spinning) clearInterval(flapTimer);
    }, 55);
  }

  // ---------- gaveta do celular: arrastar para baixo fecha ----------

  function enableDrawerDrag() {
    const grip = root.querySelector('.panel__grip');
    let start = null;

    root.addEventListener('pointerdown', (event) => {
      if (!DRAWER.matches) return;
      const onGrip = event.target.closest('.panel__grip, .sign');
      const scroller = root.querySelector('.panel__body');
      // Pela alça/placa sempre arrasta; pelo conteúdo, só quando ele já está no topo
      if (!onGrip && scroller.scrollTop > 0) return;
      if (event.target.closest('a, button')) return;
      start = { y: event.clientY, time: performance.now(), id: event.pointerId, moved: false };
    });

    root.addEventListener('pointermove', (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dy = Math.max(0, event.clientY - start.y);
      if (!start.moved && dy > 8) {
        start.moved = true;
        root.setPointerCapture(event.pointerId);
        root.classList.add('is-dragging');
      }
      if (start.moved) root.style.setProperty('--drag', `${dy}px`);
    });

    const end = (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dy = Math.max(0, event.clientY - start.y);
      const fast = dy / Math.max(1, performance.now() - start.time) > 0.6;
      root.classList.remove('is-dragging');
      if (start.moved && (dy > root.offsetHeight * 0.28 || (fast && dy > 30))) onClose();
      else root.style.removeProperty('--drag');
      start = null;
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    grip?.addEventListener('click', () => onClose());
  }

  return {
    open,
    close,
    get current() {
      return current;
    },
    get isOpen() {
      return current !== null;
    },
    /** Quanto do mapa o painel cobre agora (para centralizar o resto). */
    insets() {
      if (!current) return {};
      const box = root.getBoundingClientRect();
      return DRAWER.matches ? { bottom: box.height } : { right: box.width };
    },
  };
}

/** Texto curto das linhas de uma estação, para dicas e anúncios. */
export function describeLines(station, network) {
  const names = station.lines.map((id) => network.lines.find((line) => line.id === id).language);
  return station.interchange ? `Baldeação: ${joinList(names)}` : `Linha ${names[0]}`;
}
