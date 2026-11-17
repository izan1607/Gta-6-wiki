import { createHash } from 'node:crypto';

/** Public revisions never change the verification date or evidence of a fact. */
export function mergeWikiSnapshot(catalog, snapshot) {
  if (!snapshot) return structuredClone(catalog);
  if (snapshot.schemaVersion !== 1 || snapshot.complete !== true || !Array.isArray(snapshot.articles) || !Array.isArray(snapshot.missingArticleIds)) throw new Error('La exportación editorial está incompleta');
  const hash = createHash('sha256').update(JSON.stringify(catalog), 'utf8').digest('hex');
  if (snapshot.catalogHash !== hash) throw new Error('El catálogo ha cambiado. Repite sync-wiki antes de construir');
  if (snapshot.missingArticleIds.length) throw new Error('Hay artículos retirados de MediaWiki. Revisa el catálogo y sincroniza antes de publicar: ' + snapshot.missingArticleIds.join(', '));
  const ids = new Set();
  const articles = snapshot.articles.map(page => {
    const original = catalog.articles.find(a => a.id === page.id);
    if (!original || ids.has(page.id) || original.title !== page.title) throw new Error('La exportación no coincide con los artículos del catálogo');
    ids.add(page.id);
    if (!Number.isSafeInteger(page.revision) || page.revision < 1 || !/^\d{4}-\d{2}-\d{2}T/.test(page.timestamp) || !Array.isArray(page.sections)) throw new Error('Revisión editorial inválida');
    const sections = page.sections.map(section => {
      if (typeof section.id !== 'string' || !/^wiki-[a-z0-9-]+$/.test(section.id) || typeof section.title !== 'string' || !Array.isArray(section.paragraphs) || !section.paragraphs.every(p => typeof p === 'string')) throw new Error('Sección editorial inválida');
      return { id: section.id, title: section.title, paragraphs: [...section.paragraphs] };
    });
    return { ...structuredClone(original), sections, wikiRevision: { id: page.revision, timestamp: page.timestamp } };
  });
  if (ids.size !== catalog.articles.length) throw new Error('Faltan artículos en la exportación completa');
  const map = new Map(articles.map(a => [a.id, a]));
  return { ...structuredClone(catalog), articles: catalog.articles.map(a => map.get(a.id)) };
}
