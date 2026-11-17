export const categories = [
  { id: 'all', label: 'Todo el archivo', icon: 'grid', description: 'Todas las piezas de una historia en construcción.' },
  { id: 'juego', label: 'El juego', icon: 'game', description: 'El punto de partida: anuncios, plataformas y lo que sabemos.' },
  { id: 'personajes', label: 'Personajes', icon: 'users', description: 'Nombres, historias y conexiones publicadas por Rockstar.' },
  { id: 'mundo', label: 'Mundo y lugares', icon: 'map', description: 'Una mirada documentada a Leonida y sus localizaciones.' },
  { id: 'trailers', label: 'Tráilers', icon: 'play', description: 'Cada vídeo oficial, con su fuente y su contexto.' },
  { id: 'jugabilidad', label: 'Jugabilidad', icon: 'game', description: 'Mecánicas confirmadas y preguntas todavía abiertas.' },
  { id: 'musica', label: 'Música', icon: 'music', description: 'La música del material oficial, sin alojar audio.' },
  { id: 'vehiculos', label: 'Vehículos y objetos', icon: 'car', description: 'Lo que aparece en las fuentes, sin extrapolar sus funciones.' },
  { id: 'saga', label: 'La saga', icon: 'book', description: 'Contexto para situar un nuevo capítulo.' }
];

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function categoryOf(article) {
  const value = normalize(article.category);
  const label = normalize(article.categoryLabel);
  if (/person|protagon/.test(value + label)) return 'personajes';
  if (/mundo|lugar|localiz|region|ambient/.test(value + label)) return 'mundo';
  if (/trail|video/.test(value + label)) return 'trailers';
  if (/music|banda/.test(value + label)) return 'musica';
  if (/vehicul|arma|objeto/.test(value + label)) return 'vehiculos';
  if (/jugab|modos|online/.test(value + label)) return 'jugabilidad';
  if (/saga|historia/.test(value + label)) return 'saga';
  return 'juego';
}

export function filterArticles(articles, { query = '', category = 'all', status = 'all', saved = null } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return articles.filter(article => {
    if (category !== 'all' && categoryOf(article) !== category) return false;
    if (status !== 'all' && article.status !== status) return false;
    if (saved && !saved.includes(article.id)) return false;
    const haystack = normalize([article.title, article.summary, article.categoryLabel, ...(article.tags ?? [])].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

export function validateCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.articles) || !Array.isArray(catalog.sources) || !Array.isArray(catalog.timeline)) throw new Error('Catálogo incompleto');
  const sourceIds = new Set();
  for (const source of catalog.sources) {
    if (!source.id || sourceIds.has(source.id)) throw new Error('Identificador de fuente duplicado');
    const url = new URL(source.url);
    if (url.protocol !== 'https:') throw new Error('Las fuentes deben usar HTTPS');
    if (!/(^|\.)(rockstargames\.com|take2games\.com|youtube\.com|youtu\.be|rockstargames\.com|sec\.gov|playstation\.com|xbox\.com)$/.test(url.hostname)) throw new Error(`Emisor no autorizado: ${url.hostname}`);
    sourceIds.add(source.id);
  }
  const ids = new Set();
  const slugs = new Set();
  for (const article of catalog.articles) {
    if (!article.id || ids.has(article.id) || slugs.has(article.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error('Artículo duplicado o slug no válido');
    ids.add(article.id); slugs.add(article.slug);
    if (!['confirmed', 'pending', 'analysis'].includes(article.status)) throw new Error('Estado no permitido');
    for (const fact of article.facts ?? []) {
      if (fact.status === 'confirmed' && !fact.sourceIds?.length) throw new Error(`Afirmación sin evidencia: ${article.id}`);
      for (const id of fact.sourceIds ?? []) if (!sourceIds.has(id)) throw new Error(`Fuente inexistente: ${id}`);
    }
  }
  for (const event of catalog.timeline) if (!sourceIds.has(event.sourceId) || !ids.has(event.articleId)) throw new Error('Cronología sin evidencia o artículo');
  return true;
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function articlePath(article) { return `/es/articulos/${article.slug}/`; }

export function dateLabel(date, options = {}) {
  if (!date) return 'Fecha no indicada';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...options }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
