/* ===================================================================
 *  REDE — transforma os projetos em linhas e estações
 * -------------------------------------------------------------------
 *  • Cada linguagem vira uma LINHA, com número, cor e nome da cor.
 *  • Cada projeto vira uma ESTAÇÃO nas linhas das linguagens que têm
 *    pelo menos CONFIG.minLanguageShare do código dele.
 *  • Estação com mais de uma linha é de BALDEAÇÃO.
 *  • As linhas são numeradas na ordem em que aparecem: a linha 1 é a
 *    da linguagem do projeto mais antigo.
 * =================================================================== */

import { CONFIG } from '../config.js';
import { hashString } from './utils.js';

export const HUB_ID = 'hub';

// A Estação Central tem 8 saídas (os 8 rumos do mapa); se houver mais
// linguagens que isso, as com menos estações dividem a linha "Outras".
const MAX_LINES = 8;
const OTHERS = 'Outras';

// Cores para linguagens que não estão no config (pulando as já usadas)
const AUTO_COLORS = [
  { color: '#e8577b', name: 'Rosa' },
  { color: '#00a78e', name: 'Jade' },
  { color: '#c9a227', name: 'Ouro' },
  { color: '#ff7a59', name: 'Coral' },
  { color: '#3d4db7', name: 'Índigo' },
  { color: '#7cb342', name: 'Lima' },
  { color: '#26c6da', name: 'Água' },
  { color: '#a1887f', name: 'Areia' },
  { color: '#8d6e63', name: 'Marrom' },
  { color: '#455a64', name: 'Chumbo' },
];
const OTHERS_STYLE = { color: '#8a939c', name: 'Cinza' };

export function buildNetwork(projects) {
  const minShare = (CONFIG.minLanguageShare ?? 0.1) * 100;
  const maxPerStation = Math.max(1, CONFIG.maxLinesPerStation ?? 3);
  const ignored = new Set((CONFIG.ignoreLanguages || []).map((name) => name.toLowerCase()));

  // 1) Linguagens de cada projeto que contam como linha (a principal sempre conta)
  const picked = projects.map((project) => {
    if (project.lines) return unique(project.lines).slice(0, maxPerStation);
    const names = project.languages
      .filter((lang) => !ignored.has(lang.name.toLowerCase()))
      .filter((lang, i) => i === 0 || lang.percent >= minShare)
      .map((lang) => lang.name);
    return names.length ? names.slice(0, maxPerStation) : [OTHERS];
  });

  // 2) Linguagens com mais estações ganham linha própria; o excedente vira "Outras"
  const stats = new Map();
  picked.forEach((names, index) =>
    names.forEach((name) => {
      const entry = stats.get(name) ?? { name, count: 0, first: index };
      entry.count++;
      stats.set(name, entry);
    })
  );
  let kept = [...stats.values()].sort((a, b) => b.count - a.count || a.first - b.first).map((entry) => entry.name);
  if (kept.length > MAX_LINES) kept = [...kept.filter((name) => name !== OTHERS).slice(0, MAX_LINES - 1), OTHERS];
  const keep = new Set(kept);
  const stationLangs = picked.map((names) => unique(names.map((name) => (keep.has(name) ? name : OTHERS))));

  // 3) Linhas, numeradas pela ordem de aparição
  const usedColors = new Set();
  const lines = unique(stationLangs.flat()).map((language, i) => {
    const style = lineStyle(language, usedColors);
    return { id: slug(language), language, number: i + 1, color: style.color, colorName: style.name, stations: [] };
  });
  const lineByLanguage = new Map(lines.map((line) => [line.language, line]));

  // 4) Estações, em ordem cronológica (os projetos já chegam ordenados)
  const stations = projects.map((project, index) => {
    const stationLines = stationLangs[index].map((name) => lineByLanguage.get(name));
    stationLines.forEach((line) => line.stations.push(project.id));
    return {
      id: project.id,
      project,
      order: index,
      lines: stationLines.map((line) => line.id),
      interchange: stationLines.length > 1,
      isNewest: index === projects.length - 1,
    };
  });

  return {
    hub: { id: HUB_ID, title: CONFIG.hubName || 'Estação Central' },
    stations,
    lines,
    newest: stations.at(-1)?.id ?? null,
  };
}

/** Cor e nome da cor de uma linha: do config, senão da paleta automática. */
function lineStyle(language, used) {
  if (language === OTHERS) return OTHERS_STYLE;

  const key = Object.keys(CONFIG.lineColors || {}).find((name) => name.toLowerCase() === language.toLowerCase());
  const custom = key ? CONFIG.lineColors[key] : null;
  const style = typeof custom === 'string' ? { color: custom, name: '' } : custom && { color: custom.color, name: custom.name || '' };
  if (style && validColor(style.color)) {
    used.add(style.color.toLowerCase());
    return style;
  }

  const auto = AUTO_COLORS.find((item) => !used.has(item.color)) ?? AUTO_COLORS[hashString(language) % AUTO_COLORS.length];
  used.add(auto.color);
  return auto;
}

/** "C#" → "c-sharp", "Jupyter Notebook" → "jupyter-notebook". */
function slug(text) {
  return (
    text
      .toLowerCase()
      .replaceAll('#', '-sharp')
      .replaceAll('+', '-plus')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'linha'
  );
}

const unique = (list) => [...new Set(list)];

const validColor = (color) =>
  typeof color === 'string' && (globalThis.CSS?.supports?.('color', color) ?? /^#([\da-f]{3}|[\da-f]{6})$/i.test(color));
