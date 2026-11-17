import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog, filterArticles, escapeHTML, articlePath, categoryOf } from '../src/model.mjs';
import { layout, articlePage } from '../src/template.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalog = JSON.parse(await readFile(path.join(root, 'content/catalog.json'), 'utf8'));
const clone = value => structuredClone(value);

test('el catálogo solo publica estados definidos y evidencia primaria en cada dato confirmado', () => {
  assert.equal(validateCatalog(catalog), true);
  assert.ok(catalog.articles.length >= 12);
  for (const article of catalog.articles) {
    assert.ok(article.facts.length, article.id);
    for (const fact of article.facts) {
      assert.match(fact.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(['confirmed', 'pending', 'analysis'].includes(fact.status));
    }
    for (const id of article.relatedIds ?? []) assert.ok(catalog.articles.some(a => a.id === id));
  }
});

test('una afirmación confirmada sin fuente detiene la publicación', () => {
  const broken = clone(catalog);
  broken.articles[0].facts[0].sourceIds = [];
  assert.throws(() => validateCatalog(broken), /sin evidencia/);
});

test('se rechazan fuentes no autorizadas y protocolos ejecutables', () => {
  const broken = clone(catalog);
  broken.sources[0].url = 'https://rockstargames.com.ejemplo.invalid/noticia';
  assert.throws(() => validateCatalog(broken), /Emisor no autorizado/);
  broken.sources[0].url = 'javascript:alert(1)';
  assert.throws(() => validateCatalog(broken), /HTTPS/);
});

test('la búsqueda encuentra temas con acentos y combina categoría y fiabilidad', () => {
  const accents = filterArticles(catalog.articles, { query: 'TRAILERS' });
  assert.ok(accents.some(a => categoryOf(a) === 'trailers'));
  const characters = filterArticles(catalog.articles, { query: 'Lucia', category: 'personajes', status: 'confirmed' });
  assert.ok(characters.some(a => a.id === 'lucia-caminos'));
  assert.ok(characters.every(a => categoryOf(a) === 'personajes' && a.status === 'confirmed'));
  assert.deepEqual(filterArticles(catalog.articles, { query: 'noexisteqzx' }), []);
});

test('los guardados limitan la colección y no cambian los artículos originales', () => {
  assert.equal(filterArticles(catalog.articles, { saved: [catalog.articles[2].id] }).length, 1);
  assert.deepEqual(filterArticles(catalog.articles, { saved: [] }), []);
  assert.equal(catalog.articles.length, 16);
});

test('títulos, párrafos y metadatos se escapan contra inyección de HTML', () => {
  const article = clone(catalog.articles[0]);
  const attack = '</script><img src=x onerror=alert(1)>';
  article.title = attack;
  article.summary = attack;
  article.sections[0].paragraphs = [attack];
  const content = articlePage(article, catalog);
  const html = layout({ title: attack, description: attack, content, catalog, article });
  assert.ok(html.includes('&lt;/script&gt;&lt;img'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('"headline":"</script>'));
  assert.equal(escapeHTML('"<&'), '&quot;&lt;&amp;');
});

async function files(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await files(full));
    else output.push(full);
  }
  return output;
}

test('todas las páginas y enlaces internos del portal tienen destino, título e identificación accesible', async () => {
  const dist = path.join(root, 'dist');
  const pages = (await files(dist)).filter(file => file.endsWith('.html'));
  assert.ok(pages.length >= 38);
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, file);
    assert.match(html, /<html lang="es"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, /href="#contenido"/);
    assert.ok(!/<img\b(?![^>]*\balt=")[^>]*>/g.test(html), `Imagen sin alternativa: ${file}`);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
      const route = match[1];
      if (route.startsWith('/wiki')) continue;
      const target = path.join(dist, route, route.endsWith('/') ? 'index.html' : '');
      assert.ok((await stat(target).catch(() => null))?.isFile(), `Destino inexistente ${route} en ${file}`);
    }
    for (const match of html.matchAll(/href="#([^"?]+)"/g)) assert.ok(html.includes(`id="${match[1]}"`), `Ancla inexistente #${match[1]} en ${file}`);
    assert.ok(!/<(?:iframe|script)[^>]+src="https?:/i.test(html), 'Carga externa anterior a consentimiento');
  }
  for (const article of catalog.articles) assert.ok(pages.includes(path.join(dist, articlePath(article), 'index.html')));
});

test('el arte es local, el portal publicado no inventa un backend y el sitemap usa el origen configurado', async () => {
  const dist = path.join(root, 'dist');
  const runtime = JSON.parse(await readFile(path.join(dist, 'runtime.json'), 'utf8'));
  assert.equal(runtime.wikiAvailable, false);
  const header = await readFile(path.join(dist, '_headers'), 'utf8');
  assert.match(header, /object-src 'none'/);
  assert.match(header, /frame-ancestors 'none'/);
  assert.match(header, /X-Content-Type-Options: nosniff/);
  const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
  assert.ok(!sitemap.includes('localhost'));
  for (const asset of ['city.svg', 'coast.svg', 'people.svg', 'film.svg']) {
    const svg = await readFile(path.join(dist, 'assets', asset), 'utf8');
    assert.ok(!/(?:href|src)=["']https?:/i.test(svg));
    assert.ok(!/<script/i.test(svg));
  }
});
