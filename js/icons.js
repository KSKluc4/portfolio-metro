/* ===================================================================
 *  ÍCONES — desenhados em SVG, todos com o mesmo traço
 * -------------------------------------------------------------------
 *  Uso: icon('plus') devolve o HTML do <svg>. A cor vem do texto em
 *  volta (currentColor).
 * =================================================================== */

const PATHS = {
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  minus: '<path d="M4.5 10h11"/>',
  center: '<circle cx="10" cy="10" r="5"/><path d="M10 1.75v3.5M10 14.75v3.5M1.75 10h3.5M14.75 10h3.5"/><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  moon: '<path d="M15.6 12.4A6.6 6.6 0 0 1 7.6 4.4a6.6 6.6 0 1 0 8 8z"/>',
  sun: '<circle cx="10" cy="10" r="3.4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.35 4.35l1.4 1.4M14.25 14.25l1.4 1.4M4.35 15.65l1.4-1.4M14.25 5.75l1.4-1.4"/>',
  board: '<path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5"/>',
  code: '<path d="M6.5 6L2.75 10l3.75 4M13.5 6l3.75 4-3.75 4M11.4 4.25l-2.8 11.5"/>',
  external: '<path d="M8.5 4.5h-4v11h11v-4M11.5 3.5h5v5M16.5 3.5l-7.25 7.25"/>',
  star: '<path d="M10 2.9l2.15 4.4 4.85.7-3.5 3.4.83 4.8L10 13.95 5.67 16.2l.83-4.8L3 8l4.85-.7z"/>',
  calendar: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5"/>',
  refresh: '<path d="M16.25 10a6.25 6.25 0 1 1-1.9-4.5"/><path d="M14.75 2.75v3.25H11.5"/>',
  train: '<rect x="5" y="2.75" width="10" height="11.5" rx="3"/><path d="M5 8h10"/><circle cx="7.75" cy="11.1" r=".9" fill="currentColor" stroke="none"/><circle cx="12.25" cy="11.1" r=".9" fill="currentColor" stroke="none"/><path d="M7.5 14.25L5.5 17.5M12.5 14.25l2 3.25"/>',
  prev: '<path d="M12.5 4.5L7 10l5.5 5.5"/>',
  next: '<path d="M7.5 4.5L13 10l-5.5 5.5"/>',
  map: '<path d="M2.75 5.25l4.75-2 5 2 4.75-2v11.5l-4.75 2-5-2-4.75 2z"/><path d="M7.5 3.25v11.5M12.5 5.25v11.5"/>',
  chevron: '<path d="M5 7.5l5 5 5-5"/>',
  github: '<path d="M7.5 15.5c-3.5 1-3.5-1.75-5-2M12.5 17.5v-2.9a2.5 2.5 0 0 0-.7-1.95c2.35-.26 4.7-1.15 4.7-5.2a4 4 0 0 0-1.1-2.8 3.75 3.75 0 0 0-.07-2.8s-.88-.26-2.88 1.08a9.9 9.9 0 0 0-5.2 0C5.25 1.6 4.37 1.86 4.37 1.86a3.75 3.75 0 0 0-.07 2.8 4 4 0 0 0-1.1 2.8c0 4.03 2.35 4.92 4.7 5.2a2.5 2.5 0 0 0-.7 1.92v2.92"/>',
};

export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] ?? ''}</svg>`;
}
