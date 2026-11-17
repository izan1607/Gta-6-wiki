import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const portalRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const maxResponseBytes = 16 * 1024 * 1024;
const reservedSections = new Set(['datos verificados', 'datos y evidencia', 'fuentes', 'referencias', 'references']);
const normalizeTitle = value => value.normalize('NFC').replaceAll('_', ' ').replace(/\s+/gu, ' ').trim().replace(/^./u, letter => letter.toLocaleUpperCase('es'));
const normalizedHeading = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? all;
    const number = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '';
  });
}

function removeTemplates(text) {
  let result = '', depth = 0;
  for (let index = 0; index < text.length; index++) {
    const pair = text.slice(index, index + 2);
    if (pair === '{{') { depth++; index++; continue; }
    if (pair === '}}' && depth) { depth--; index++; continue; }
    if (!depth) result += text[index];
  }
  return result;
}

/** Conservative text projection, never a general wikitext/HTML renderer. */
export function plainWikiText(input) {
  if (typeof input !== 'string') throw new Error('El wikitext debe ser una cadena');
  return decodeEntities(removeTemplates(input))
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '')
    .replace(/\[\[\s*(?:Category|Categoría|File|Archivo|Image|Imagen)\s*:[\s\S]*?\]\]/gi, '')
    .replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g, (_, target, label) => label || target.replaceAll('_', ' '))
    .replace(/\[(?:https?:\/\/|\/\/)[^\s\]]+(?:\s+([^\]]+))?\]/gi, (_, label) => label || '')
    .replace(/<[^>]*>/g, '')
    .replace(/'{2,5}/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

export function parseWikitext(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 2_000_000) throw new Error('Contenido wiki inválido o demasiado grande');
  const sections = [];
  let current = { title: 'Contexto editorial', paragraphs: [] }, pending = [], skipLevel = 0;
  const flushParagraph = () => {
    const value = plainWikiText(pending.join(' '));
    pending = [];
    if (value) current.paragraphs.push(value);
  };
  const flushSection = () => {
    flushParagraph();
    if (current.paragraphs.length) sections.push(current);
  };
  // Remove constructs spanning lines before splitting, without evaluating them.
  const text = removeTemplates(content.replace(/\r\n?/g, '\n'))
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|iframe|object|svg|math|ref)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\{\|[\s\S]*?(?:\|\}|$)/g, '');
  for (const line of text.split('\n')) {
    const heading = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (skipLevel && level > skipLevel) continue;
      flushSection();
      const title = plainWikiText(heading[2]).slice(0, 200) || 'Información editorial';
      skipLevel = reservedSections.has(normalizedHeading(title)) ? level : 0;
      current = { title, paragraphs: [] };
      continue;
    }
    if (skipLevel || /^\s*\[\[\s*(Category|Categoría|File|Archivo|Image|Imagen)\s*:/i.test(line)) continue;
    if (/^\s*''Información sujeta a cambios\./.test(line) || /^Última actualización editorial:/.test(line)) continue;
    if (!line.trim()) { flushParagraph(); continue; }
    if (/^[*#;:]+\s*/.test(line)) {
      flushParagraph();
      const value = plainWikiText(line.replace(/^[*#;:]+\s*/, ''));
      if (value) current.paragraphs.push('• ' + value);
      continue;
    }
    pending.push(line);
  }
  flushSection();
  return sections.map((section, index) => ({
    id: `wiki-${normalizedHeading(section.title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seccion'}-${index + 1}`,
    title: section.title,
    paragraphs: section.paragraphs,
  }));
}

function requireTimestamp(value, context) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value.replace('Z', '.000Z')) {
    throw new Error(`Fecha inválida en ${context}`);
  }
  return value;
}

export function validateEndpoint(value) {
  const endpoint = new URL(value);
  if (endpoint.username || endpoint.password || endpoint.hash || endpoint.search || !endpoint.pathname.endsWith('/api.php')) throw new Error('Usa la URL limpia de api.php, sin credenciales, consulta ni fragmento');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback)) throw new Error('La API debe usar HTTPS; HTTP solo se permite en loopback local');
  return endpoint;
}

async function fetchJSON(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`La API devolvió HTTP ${response.status}`);
  if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error('La respuesta de la API no es JSON');
  if (Number(response.headers.get('content-length')) > maxResponseBytes) throw new Error('La respuesta supera el límite de tamaño');
  let text = '', total = 0;
  const decoder = new TextDecoder();
  if (!response.body) throw new Error('La API devolvió una respuesta vacía');
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maxResponseBytes) { await response.body.cancel().catch(() => {}); throw new Error('La respuesta supera el límite de tamaño'); }
    text += decoder.decode(chunk, { stream: true });
  }
  text += decoder.decode();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('La API devolvió JSON mal formado'); }
  if (!json || typeof json !== 'object' || Array.isArray(json) || json.error) throw new Error('La API devolvió un error o una estructura inválida');
  return json;
}

/** Fetch a complete public snapshot. This never sends authentication/cookies. */
export async function synchronize({ endpoint: rawEndpoint, catalog, fetchImpl = fetch }) {
  const endpoint = validateEndpoint(rawEndpoint);
  if (!catalog || !Array.isArray(catalog.articles) || !Array.isArray(catalog.sources)) throw new Error('Catálogo incompleto');
  const byTitle = new Map();
  const knownSources = new Set(catalog.sources.map(source => source.id));
  for (const article of catalog.articles) {
    const title = normalizeTitle(article.title);
    if (byTitle.has(title)) throw new Error('El catálogo contiene títulos wiki duplicados');
    byTitle.set(title, article);
  }
  const infoUrl = new URL(endpoint);
  infoUrl.search = new URLSearchParams({ action: 'query', meta: 'siteinfo', siprop: 'general', format: 'json', formatversion: '2' }).toString();
  const info = (await fetchJSON(infoUrl, fetchImpl)).query?.general;
  if (!info || typeof info.generator !== 'string' || !/^MediaWiki \d+\./.test(info.generator) || typeof info.server !== 'string' || typeof info.scriptpath !== 'string') throw new Error('El endpoint no identifica una instalación MediaWiki válida');
  const canonical = new URL(info.server);
  if (!['http:', 'https:'].includes(canonical.protocol) || canonical.username || canonical.password || canonical.hash || canonical.search || !info.scriptpath.startsWith('/')) throw new Error('El origen canónico de MediaWiki no es válido');
  const canonicalApiPath = info.scriptpath.replace(/\/$/, '') + '/api.php';
  if (canonicalApiPath !== endpoint.pathname) throw new Error('La ruta de la API no coincide con la instalación MediaWiki');
  const articles = [], unmatched = [], ids = new Set(), titles = new Set();
  let from = 0, complete = false;
  for (let page = 0; page < 100; page++) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ action: 'archivoexport', format: 'json', formatversion: '2', limit: '50', from: String(from) }).toString();
    const data = (await fetchJSON(url, fetchImpl)).archivoexport;
    if (!data || !Array.isArray(data.articles) || data.articles.length > 50) throw new Error('La exportación editorial tiene un formato inválido');
    requireTimestamp(data.generatedAt, 'generatedAt');
    for (const item of data.articles) {
      if (!item || !Number.isSafeInteger(item.pageid) || item.pageid <= from || ids.has(item.pageid) || !Number.isSafeInteger(item.revision) || item.revision <= 0 || typeof item.title !== 'string' || item.title.length > 255 || typeof item.content !== 'string') throw new Error('La exportación contiene una página o revisión inválida/duplicada');
      const normalized = normalizeTitle(item.title);
      if (!normalized || titles.has(normalized) || /[\u0000-\u001f\u007f]/.test(item.title)) throw new Error('Título público inválido/duplicado');
      const articleUrl = new URL(item.url);
      if (articleUrl.origin !== canonical.origin || articleUrl.pathname !== info.scriptpath.replace(/\/$/, '') + '/index.php' || normalizeTitle(articleUrl.searchParams.get('title') || '') !== normalized || articleUrl.username || articleUrl.password || articleUrl.hash) throw new Error('URL de artículo ajena a la instalación wiki');
      ids.add(item.pageid); titles.add(normalized);
      requireTimestamp(item.timestamp, item.title);
      const original = byTitle.get(normalized);
      if (!original) {
        unmatched.push({ title: item.title, pageid: item.pageid, revision: item.revision });
        continue;
      }
      const sourceIds = [...new Set((original.facts || []).flatMap(fact => fact.sourceIds || []))];
      if (sourceIds.some(id => !knownSources.has(id))) throw new Error(`El artículo ${original.id} referencia una fuente inexistente`);
      articles.push({ id: original.id, title: item.title, pageid: item.pageid, revision: item.revision,
        timestamp: item.timestamp, url: articleUrl.href,
        contentHash: createHash('sha256').update(item.content, 'utf8').digest('hex'),
        sourceIds, sections: parseWikitext(item.content) });
    }
    if (data.next === undefined) { complete = true; break; }
    if (!Number.isSafeInteger(data.next) || data.next <= from || !data.articles.some(item => item.pageid === data.next)) throw new Error('La API contiene un cursor de paginación inválido');
    from = data.next;
  }
  if (!complete) throw new Error('La exportación excede el límite de páginas; no se ha guardado un snapshot parcial');
  const present = new Set(articles.map(article => article.id));
  return { schemaVersion: 1, complete: true, generatedAt: new Date().toISOString(), endpoint: endpoint.href,
    wikiOrigin: canonical.origin, generator: info.generator,
    catalogHash: createHash('sha256').update(JSON.stringify(catalog), 'utf8').digest('hex'),
    articles, missingArticleIds: catalog.articles.filter(article => !present.has(article.id)).map(article => article.id), unmatched };
}

async function main() {
  const args = process.argv.slice(2);
  let endpoint = process.env.WIKI_API_URL || 'http://127.0.0.1:4173/wiki/api.php';
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== '--endpoint' || !args[index + 1]) throw new Error('Uso: node scripts/sync-wiki.mjs [--endpoint https://dominio/wiki/api.php]');
    endpoint = args[++index];
  }
  const catalog = JSON.parse(await readFile(path.join(portalRoot, 'content/catalog.json'), 'utf8'));
  const snapshot = await synchronize({ endpoint, catalog });
  const target = path.join(portalRoot, 'content/wiki-pages.json');
  const temporary = target + '.tmp-' + process.pid + '-' + randomBytes(4).toString('hex');
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  console.log(`Sincronizados ${snapshot.articles.length} artículos públicos; ${snapshot.missingArticleIds.length} ausentes y ${snapshot.unmatched.length} páginas sin metadatos del catálogo.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`No se ha actualizado el snapshot: ${error.message}`); process.exitCode = 1; });
}
