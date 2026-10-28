/* ===================================================================
 *  DADOS — de onde vêm as estações
 * -------------------------------------------------------------------
 *  Ordem de tentativa:
 *    1. cache no localStorage (se tiver menos de CONFIG.cacheMinutes)
 *    2. API pública do GitHub: os repos com o topic configurado e as
 *       linguagens de cada um (/repos/USUARIO/NOME/languages)
 *    3. cache vencido (se a API falhar, é melhor que nada)
 *    4. projects.json (fallback local)
 *
 *  O cache guarda só os dados do GitHub. Os ajustes do config.js são
 *  aplicados depois, então mudanças no config aparecem na hora.
 * =================================================================== */

import { CONFIG } from '../config.js';

const API = 'https://api.github.com';
const TOPIC = CONFIG.topic.toLowerCase();
const CACHE_KEY = `metro:repos:${CONFIG.githubUser}:${TOPIC}`.toLowerCase();
const CACHE_TTL = CONFIG.cacheMinutes * 60 * 1000;
const FALLBACK_URL = 'projects.json';
const REQUEST_TIMEOUT = 8000;

/**
 * Carrega os projetos em ordem cronológica (o mais antigo primeiro).
 * `source` diz de onde vieram: 'api' | 'cache' | 'stale-cache' | 'fallback'.
 */
export async function loadProjects({ forceRefresh = false } = {}) {
  // O projects.json é pequeno e local: já começa a baixar em paralelo
  const fallbackRequest = getJSON(FALLBACK_URL, { cache: 'no-cache' })
    .then((data) => (Array.isArray(data) ? data : []))
    .catch((error) => {
      console.warn('[metro] Não consegui ler o projects.json:', error.message);
      return [];
    });

  let repos = null;
  let source = 'api';
  let savedAt = Date.now();

  const cached = readCache();
  if (cached && !forceRefresh && Date.now() - cached.savedAt < CACHE_TTL) {
    ({ repos, savedAt } = cached);
    source = 'cache';
  } else {
    try {
      const result = await fetchTaggedRepos(fallbackRequest);
      repos = result.repos;
      // Se alguma linguagem falhou (ex.: limite da API), não guarda: tenta de novo na próxima visita
      if (result.complete) writeCache(repos);
    } catch (error) {
      console.warn('[metro] A API do GitHub falhou:', error.message);
      if (cached) {
        ({ repos, savedAt } = cached);
        source = 'stale-cache';
      }
    }
  }

  let list = repos;
  if (!repos?.length) {
    if (repos) console.info(`[metro] Nenhum repositório com o topic "${TOPIC}" ainda. Usando o projects.json.`);
    list = await fallbackRequest;
    source = 'fallback';
    savedAt = null;
  }

  if (!list.length) throw new Error('Nenhum projeto encontrado: a API e o projects.json falharam.');

  return { projects: list.map(toProject).sort(byCreation), source, savedAt };
}

/** Busca os repositórios do usuário, fica só com os que têm o topic e pega as linguagens. */
async function fetchTaggedRepos(fallbackRequest) {
  const user = encodeURIComponent(CONFIG.githubUser);
  const all = [];

  // A API devolve no máximo 100 por página; quase sempre uma página basta
  for (let page = 1; page <= 10; page++) {
    const batch = await getJSON(`${API}/users/${user}/repos?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }

  const tagged = all.filter((repo) => (repo.topics || []).map((t) => t.toLowerCase()).includes(TOPIC));
  let complete = true;

  // Linguagens com o tamanho de cada uma (1 requisição por repo, em paralelo).
  // Se uma falhar, usa as do projects.json (ou só a linguagem principal).
  const repos = await Promise.all(
    tagged.map(async (repo) => {
      let languages = await getJSON(`${API}/repos/${user}/${encodeURIComponent(repo.name)}/languages`).catch(() => null);
      if (!languages) {
        complete = false;
        languages = (await fallbackRequest).find((item) => item.name === repo.name)?.languages ?? null;
      }
      return { ...pickFields(repo), languages };
    })
  );

  return { repos, complete };
}

/** Guarda só os campos usados, no mesmo formato do projects.json. */
function pickFields(repo) {
  return {
    name: repo.name,
    description: repo.description,
    html_url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    topics: repo.topics || [],
    stargazers_count: repo.stargazers_count,
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
  };
}

/** Junta os dados do GitHub com os ajustes do config.js. */
function toProject(repo) {
  const custom = CONFIG.projects?.[repo.name] ?? {};
  const topics = (repo.topics || []).filter((topic) => topic.toLowerCase() !== TOPIC);

  return {
    id: repo.name,
    title: custom.title || prettyName(repo.name),
    description: custom.description || repo.description?.trim() || '',
    languages: languageList(repo.languages, repo.language),
    lines: Array.isArray(custom.lines) && custom.lines.length ? custom.lines : null,
    tech: Array.isArray(custom.tech) ? custom.tech : topics.map((topic) => topic.replaceAll('-', ' ')),
    stars: repo.stargazers_count ?? 0,
    createdAt: validDate(custom.createdAt) || repo.created_at || null,
    // pushed_at = último push de código (updated_at muda até quando alguém dá estrela)
    updatedAt: repo.pushed_at || repo.updated_at || null,
    repoUrl: safeUrl(repo.html_url || `https://github.com/${CONFIG.githubUser}/${repo.name}`),
    demoUrl: safeUrl(custom.demo !== undefined ? custom.demo : repo.homepage),
    image: custom.image || null,
  };
}

/** "meu-projeto_legal" → "Meu projeto legal" (o config.js pode dar um nome melhor). */
function prettyName(name) {
  const text = name.replace(/[-_.]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** { JavaScript: 6400, CSS: 300 } → [{ name, percent }], da maior para a menor. */
function languageList(bytesByLanguage, mainLanguage) {
  const entries = Object.entries(bytesByLanguage || {}).filter(([, bytes]) => bytes > 0);
  if (!entries.length) return mainLanguage ? [{ name: mainLanguage, percent: 100 }] : [];

  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, percent: (bytes / total) * 100 }));
}

/** Mais antigo primeiro; empate pelo nome, para a ordem nunca mudar sozinha. */
const byCreation = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id);

// "2026-07-26" vira meio-dia UTC: assim a data não muda de dia no fuso do Brasil
const validDate = (value) => {
  const text = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : null;
};

/** Aceita só links http(s); "site.com" vira "https://site.com". */
function safeUrl(value) {
  if (!value) return null;
  const text = String(value).trim();
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: url.startsWith(API) ? { Accept: 'application/vnd.github+json' } : undefined,
    signal: AbortSignal.timeout?.(REQUEST_TIMEOUT),
    ...options,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.json();
}

function readCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY));
    return data && Array.isArray(data.repos) && typeof data.savedAt === 'number' ? data : null;
  } catch {
    return null;
  }
}

function writeCache(repos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), repos }));
  } catch {
    // aba anônima ou armazenamento cheio: segue sem cache
  }
}
