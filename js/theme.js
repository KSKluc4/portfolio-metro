/* ===================================================================
 *  TEMA — mapa diurno (claro) e noturno (escuro)
 * -------------------------------------------------------------------
 *  A escolha fica salva no navegador. Sem escolha, segue o sistema.
 *  (O <head> do index.html aplica o tema antes de pintar a página,
 *  para não piscar.)
 * =================================================================== */

import { icon } from './icons.js';

const KEY = 'metro:theme';

export function initTheme(button) {
  const render = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span class="tool__label">${dark ? 'Modo diurno' : 'Modo noturno'}</span>`;
    button.title = dark ? 'Voltar para o mapa claro' : 'Mapa noturno';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1120' : '#14213d');
  };

  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // sem armazenamento (aba anônima): vale só nesta visita
    }
    render();
  });

  render();
}
