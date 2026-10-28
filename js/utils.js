/* ===================================================================
 *  UTILITÁRIOS — funções pequenas usadas por vários módulos
 * =================================================================== */

/** Espera `ms` milissegundos. Uso: `await wait(300)`. */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** true se a pessoa pediu "reduzir movimento" nas configurações do sistema. */
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Prende um número entre um mínimo e um máximo. */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Curva de aceleração "sai devagar, chega devagar" (0 → 1). */
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Escapa um texto para inserir com segurança dentro de HTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Hash FNV-1a: transforma um texto num número inteiro estável. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Data no formato brasileiro: 27/10/2026. */
export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '--/--/----';
}

/** Mês e ano curtos: "jun. 2026". */
export function formatMonth(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(' de ', ' ') : '';
}

/** Tempo relativo em português: "hoje", "há 3 dias", "há 2 meses". */
export function timeAgo(iso) {
  if (!iso) return '';
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  // Compara dias do calendário (não horas): algo de hoje às 00:05 continua sendo "hoje"
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month');
  return rtf.format(Math.round(days / 365), 'year');
}

/** "Linhas 1 e 2", "Linhas 1, 2 e 3". */
export function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}
