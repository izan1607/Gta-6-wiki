import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWikitext, plainWikiText, synchronize, validateEndpoint } from '../scripts/sync-wiki.mjs';

const stamp = '2026-11-17T12:00:00Z';
const catalog = { sources: [{ id: 'official' }], articles: [
  { id: 'one', title: 'Artículo uno', facts: [{ sourceIds: ['official'] }] },
  { id: 'two', title: 'Artículo dos', facts: [] },
  { id: 'deleted', title: 'Artículo eliminado', facts: [] },
] };
const publicPage = (id, title) => ({ pageid: id, title, content: '== Contexto ==\nTexto original.', revision: id + 100, timestamp: stamp, url: 'http://127.0.0.1:4173/wiki/index.php?title=' + encodeURIComponent(title) });
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
function fixture(pages) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Cookie, undefined);
    const parsed = new URL(url); calls.push(parsed);
    if (parsed.searchParams.get('action') === 'query') return response({ query: { general: { generator: 'MediaWiki 1.43.11', server: 'http://127.0.0.1:4173', scriptpath: '/wiki' } } });
    const index = Number(parsed.searchParams.get('from'));
    return response({ archivoexport: { articles: pages[index]?.articles || [], generatedAt: stamp, ...(pages[index]?.next !== undefined ? { next: pages[index].next } : {}) } });
  } };
}

test('text projection removes executable HTML, templates, embeds and references without creating links', () => {
  const text = plainWikiText('Antes {{plantilla|{{anidada}}}} <script>alert(1)</script> <img src=x onerror=alert(2)> [[File:robo.jpg]] [[Jason|Jason]] [https://example.invalid etiqueta] &amp; después');
  assert.equal(text, 'Antes Jason etiqueta & después');
  assert.ok(!text.includes('alert') && !text.includes('<') && !text.includes('{{'));
  assert.equal(plainWikiText('&#60;script&#62;alert(1)&#60;/script&#62;Texto'), 'Texto');
});

test('sections omit facts and sources including nested headings, preserving only editorial context', () => {
  const sections = parseWikitext("Resumen propio.\n\n== Datos y evidencia ==\nDato de catálogo.\n=== Detalle ===\nNo duplicar.\n== Contexto ==\nUn párrafo.\n\n* Una lista\n== Fuentes ==\n[https://example.invalid Fuente]\n[[Category:Prueba]]");
  assert.deepEqual(sections.map(section => section.title), ['Contexto editorial', 'Contexto']);
  assert.deepEqual(sections[1].paragraphs, ['Un párrafo.', '• Una lista']);
  assert.ok(!JSON.stringify(sections).includes('No duplicar'));
});

test('pagination yields complete public snapshot, marks deletions, and does not invent evidence for unmatched pages', async () => {
  const mock = fixture({ 0: { articles: [publicPage(1, 'Artículo uno')], next: 1 },
    1: { articles: [publicPage(2, 'Artículo dos'), publicPage(3, 'Artículo nuevo')] } });
  const snapshot = await synchronize({ endpoint: 'http://127.0.0.1:8081/wiki/api.php', catalog, fetchImpl: mock.fetchImpl });
  assert.equal(snapshot.complete, true);
  assert.deepEqual(snapshot.articles.map(article => article.id), ['one', 'two']);
  assert.deepEqual(snapshot.articles[0].sourceIds, ['official']);
  assert.equal(snapshot.articles[0].contentHash.length, 64);
  assert.deepEqual(snapshot.missingArticleIds, ['deleted']);
  assert.equal(snapshot.unmatched[0].title, 'Artículo nuevo');
  assert.equal(mock.calls.length, 3);
  assert.equal(mock.calls[2].searchParams.get('from'), '1');
});

test('invalid cursors and hostile article URLs abort the complete snapshot', async () => {
  const looping = fixture({ 0: { articles: [publicPage(1, 'Artículo uno')], next: 0 } });
  await assert.rejects(synchronize({ endpoint: 'http://localhost/wiki/api.php', catalog, fetchImpl: looping.fetchImpl }), /cursor/);
  const hostile = publicPage(1, 'Artículo uno'); hostile.url = 'https://attacker.invalid/wiki/index.php?title=Artículo_uno';
  const wrongOrigin = fixture({ 0: { articles: [hostile] } });
  await assert.rejects(synchronize({ endpoint: 'http://localhost/wiki/api.php', catalog, fetchImpl: wrongOrigin.fetchImpl }), /URL de artículo/);
});

test('endpoint validation refuses credentials, query injection and remote HTTP', () => {
  for (const value of ['https://user:secret@example.invalid/wiki/api.php', 'http://example.invalid/wiki/api.php', 'https://example.invalid/wiki/api.php?action=login']) {
    assert.throws(() => validateEndpoint(value));
  }
  assert.equal(validateEndpoint('https://example.invalid/wiki/api.php').pathname, '/wiki/api.php');
});
