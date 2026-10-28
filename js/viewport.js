/* ===================================================================
 *  VIEWPORT — arrastar e dar zoom no mapa
 * -------------------------------------------------------------------
 *  O mapa inteiro fica num <g> com translate + scale. Daqui saem:
 *    • arrastar com mouse, caneta ou um dedo;
 *    • zoom com a roda do mouse, pinça (dois dedos) ou botões;
 *    • teclado: setas movem, + e - mudam o zoom, 0 centraliza;
 *    • "centralizar" (enquadra a rede toda) e "mostrar este ponto".
 * =================================================================== */

import { clamp, prefersReducedMotion } from './utils.js';

const DRAG_THRESHOLD = 6; // px até um clique virar arrasto
const FIT_MAX = 1.5; // não aproxima demais quando a rede é pequena
const ZOOM_STEP = 1.45;
const PAN_STEP = 90;

export function createViewport({ svg, world, getInsets = () => ({}) }) {
  const view = { x: 0, y: 0, k: 1 };
  const limits = { min: 0.3, max: 2.6 };
  const pointers = new Map();
  const listeners = new Set();
  let bounds = { x: 0, y: 0, width: 1, height: 1 };
  let gesture = null;
  let dragged = false;
  let swallowClick = false;
  let animation = 0;
  let touched = false; // a pessoa já mexeu no mapa?

  function apply() {
    world.setAttribute('transform', `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.k.toFixed(4)})`);
    listeners.forEach((fn) => fn(view));
  }

  const rect = () => svg.getBoundingClientRect();

  /** Área livre do mapa (descontando painel e legenda), em px da tela. */
  function freeArea() {
    const { width, height } = rect();
    const insets = { top: 0, right: 0, bottom: 0, left: 0, ...getInsets() };
    return { x: insets.left, y: insets.top, width: width - insets.left - insets.right, height: height - insets.top - insets.bottom };
  }

  /** O enquadramento que mostra a rede toda na área livre. */
  function fitTarget() {
    const area = freeArea();
    const pad = Math.min(56, area.width * 0.06);
    const k = clamp(Math.min((area.width - pad * 2) / bounds.width, (area.height - pad * 2) / bounds.height), 0.15, FIT_MAX);
    limits.min = Math.min(k * 0.6, 0.5);
    return {
      k,
      x: area.x + area.width / 2 - (bounds.x + bounds.width / 2) * k,
      y: area.y + area.height / 2 - (bounds.y + bounds.height / 2) * k,
    };
  }

  function animateTo(target, duration = 520) {
    cancelAnimationFrame(animation);
    if (duration === 0 || prefersReducedMotion()) {
      Object.assign(view, target);
      apply();
      return Promise.resolve();
    }
    const from = { ...view };
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = t === 1 ? 1 : 1 - 2 ** (-10 * t); // desacelera no fim (ease-out exponencial)
        view.x = from.x + (target.x - from.x) * e;
        view.y = from.y + (target.y - from.y) * e;
        view.k = from.k + (target.k - from.k) * e;
        apply();
        if (t < 1) animation = requestAnimationFrame(step);
        else resolve();
      };
      animation = requestAnimationFrame(step);
    });
  }

  /** Zoom mantendo parado o ponto (px, py) da tela. */
  function zoomAround(k, px, py, duration = 0) {
    const nk = clamp(k, limits.min, limits.max);
    const wx = (px - view.x) / view.k;
    const wy = (py - view.y) / view.k;
    touched = true;
    return animateTo({ k: nk, x: px - wx * nk, y: py - wy * nk }, duration);
  }

  function zoomBy(factor) {
    const area = freeArea();
    return zoomAround(view.k * factor, area.x + area.width / 2, area.y + area.height / 2, 260);
  }

  function panBy(dx, dy) {
    touched = true;
    return animateTo({ ...view, x: view.x + dx, y: view.y + dy }, 220);
  }

  // ---------- arrastar e pinça ----------

  svg.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelAnimationFrame(animation);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragged = false;
      gesture = { type: 'pan', x: event.clientX, y: event.clientY, view: { ...view }, id: event.pointerId };
    } else if (pointers.size === 2) {
      startPinch();
    }
  });

  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture?.type === 'pan') {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragged = true;
        touched = true;
        // Só "prende" o ponteiro depois que virou arrasto: um clique simples continua chegando na estação
        svg.setPointerCapture?.(event.pointerId);
        svg.classList.add('is-panning');
        listeners.forEach((fn) => fn(view, 'drag-start'));
      }
      if (dragged) {
        view.x = gesture.view.x + dx;
        view.y = gesture.view.y + dy;
        apply();
      }
    } else if (gesture?.type === 'pinch') {
      const [a, b] = [...pointers.values()];
      const box = rect();
      const mid = { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top };
      const k = clamp((gesture.view.k * Math.hypot(b.x - a.x, b.y - a.y)) / gesture.distance, limits.min, limits.max);
      view.k = k;
      view.x = mid.x - gesture.world.x * k;
      view.y = mid.y - gesture.world.y * k;
      apply();
    }
  });

  function startPinch() {
    const [a, b] = [...pointers.values()];
    const box = rect();
    const mid = { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top };
    gesture = {
      type: 'pinch',
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      view: { ...view },
      world: { x: (mid.x - view.x) / view.k, y: (mid.y - view.y) / view.k },
    };
    dragged = true;
    touched = true;
    svg.classList.add('is-panning');
    listeners.forEach((fn) => fn(view, 'drag-start'));
  }

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size === 1 && gesture?.type === 'pinch') {
      // Tirou um dedo da pinça: continua arrastando com o outro
      const [[id, point]] = [...pointers.entries()];
      gesture = { type: 'pan', x: point.x, y: point.y, view: { ...view }, id };
    } else if (pointers.size === 0) {
      if (dragged) {
        swallowClick = true;
        setTimeout(() => (swallowClick = false), 0);
      }
      gesture = null;
      svg.classList.remove('is-panning');
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  // ---------- roda do mouse e teclado ----------

  svg.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const box = rect();
      // Pinça no trackpad chega como roda + Ctrl, com passos bem menores
      const speed = event.deltaMode === 1 ? 0.05 : event.ctrlKey ? 0.012 : 0.0018;
      zoomAround(view.k * Math.exp(-event.deltaY * speed), event.clientX - box.left, event.clientY - box.top);
    },
    { passive: false }
  );

  svg.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const moves = { ArrowLeft: [PAN_STEP, 0], ArrowRight: [-PAN_STEP, 0], ArrowUp: [0, PAN_STEP], ArrowDown: [0, -PAN_STEP] };
    if (moves[event.key]) {
      event.preventDefault();
      panBy(...moves[event.key]);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      fit();
    }
  });

  // Janela mudou de tamanho: se a pessoa ainda não mexeu, reenquadra; senão mantém o centro
  let lastSize = rect();
  new ResizeObserver(() => {
    const now = rect();
    if (!touched) {
      Object.assign(view, fitTarget());
    } else {
      view.x += (now.width - lastSize.width) / 2;
      view.y += (now.height - lastSize.height) / 2;
    }
    lastSize = now;
    apply();
  }).observe(svg);

  function fit({ animate = true } = {}) {
    touched = false;
    return animateTo(fitTarget(), animate ? 560 : 0);
  }

  return {
    view,
    setBounds(next) {
      bounds = next;
    },
    fit,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),

    /** Enquadra a rede toda na área livre, se ela couber sem ficar pequena demais. */
    fitIfReadable(minK) {
      const target = fitTarget();
      if (target.k < minK) return false;
      animateTo(target);
      return true;
    },

    /** Leva o ponto (do mapa) para dentro da área livre, se ele estiver escondido. */
    reveal(x, y, margin = 90) {
      const area = freeArea();
      const sx = view.x + x * view.k;
      const sy = view.y + y * view.k;
      const inside =
        sx >= area.x + margin && sx <= area.x + area.width - margin && sy >= area.y + margin && sy <= area.y + area.height - margin;
      if (inside) return Promise.resolve();
      return animateTo({ ...view, x: area.x + area.width / 2 - x * view.k, y: area.y + area.height / 2 - y * view.k });
    },

    /** Ponto do mapa → posição na tela (relativa ao SVG). */
    toScreen: (x, y) => ({ x: view.x + x * view.k, y: view.y + y * view.k }),

    /** true se a pessoa mexeu no mapa (arrastou ou deu zoom) desde o último enquadramento. */
    get touched() {
      return touched;
    },

    /** true logo depois de um arrasto: o clique que vem junto deve ser ignorado. */
    consumeDrag: () => swallowClick,

    onChange(fn) {
      listeners.add(fn);
    },
  };
}
