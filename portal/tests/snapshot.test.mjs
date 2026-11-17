import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mergeWikiSnapshot } from '../scripts/catalog.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const fixture = () => ({ schemaVersion: 1, complete: true, catalogHash: createHash('sha256').update(JSON.stringify(catalog)).digest('hex'), missingArticleIds: [], articles: catalog.articles.map(a => ({ id: a.id, title: a.title, revision: 42, timestamp: '2026-11-17T18:00:00Z', sections: [{ id: 'wiki-contexto-1', title: 'Contexto', paragraphs: ['Texto editorial publicado.'] }] })) });

test('sincronizar revisiones públicas no inventa verificaciones ni modifica evidencia', () => {
  const merged = mergeWikiSnapshot(catalog, fixture());
  assert.equal(merged.articles[0].sections[0].paragraphs[0], 'Texto editorial publicado.');
  assert.equal(merged.articles[0].wikiRevision.id, 42);
  assert.deepEqual(merged.articles[0].facts, catalog.articles[0].facts);
  assert.equal(merged.articles[0].updatedAt, catalog.articles[0].updatedAt);
  assert.notEqual(merged.articles[0], catalog.articles[0]);
});

test('un artículo retirado de la wiki impide reconstruir una versión pública obsoleta', () => {
  const snapshot = fixture(); snapshot.missingArticleIds = [catalog.articles[0].id];
  assert.throws(() => mergeWikiSnapshot(catalog, snapshot), /retirados/);
});

test('cambiar metadatos obliga a sincronizar de nuevo antes de publicar', () => {
  const changed = structuredClone(catalog); changed.articles[0].facts[0].text = 'Otra afirmación';
  assert.throws(() => mergeWikiSnapshot(changed, fixture()), /ha cambiado/);
});

test('una exportación incompleta o con artículos repetidos se rechaza', () => {
  const snapshot = fixture(); snapshot.articles.pop();
  assert.throws(() => mergeWikiSnapshot(catalog, snapshot), /Faltan artículos/);
  snapshot.articles.push(snapshot.articles[0]);
  assert.throws(() => mergeWikiSnapshot(catalog, snapshot), /no coincide/);
});
