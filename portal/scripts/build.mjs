import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { categories, validateCatalog, articlePath, categoryOf } from '../src/model.mjs';
import { layout, home, listing, articlePage, timelinePage, sourcesPage, changesPage, policyPage, policyKeys, notFound } from '../src/template.mjs';
import { createArtwork } from './artwork.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = path.join(root, 'dist');
const catalog = JSON.parse(await readFile(path.join(root, 'content/catalog.json'), 'utf8'));
validateCatalog(catalog);
let origin = process.env.SITE_ORIGIN?.replace(/\/$/, '') || '';
if (!origin) {
  try { origin = JSON.parse(await readFile(path.join(root, '.openai/site-origin.json'), 'utf8')).origin; } catch { /* Le développement local ne requiert pas d'origine publique. */ }
}
if (origin && !/^https?:\/\/[^/]+$/.test(origin)) throw new Error('SITE_ORIGIN debe ser un origen HTTP(S) sin ruta');
await mkdir(out, { recursive: true });
const routes = [];
async function page(route, title, description, content, active = '', article = null) {
  const directory = path.join(out, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), layout({ title, description, content, active, path: route, catalog, origin, article }));
  routes.push(route);
}
await page('/es/', 'El archivo de Grand Theft Auto VI', 'Una wiki independiente sobre GTA VI. Personajes, lugares, anuncios y cronología con fuentes oficiales, sin filtraciones.', home(catalog), 'home');
await page('/es/buscar/', 'Explora el archivo', 'Busca y filtra artículos por tema y estado de verificación.', listing(catalog), 'search');
await page('/es/guardados/', 'Tus artículos guardados', 'Tu colección de artículos para volver a leer, guardada solo en este navegador.', listing(catalog, { saved: true }), 'saved');
for (const category of categories.filter(c => c.id !== 'all')) await page(`/es/${category.id}/`, category.label, category.description, listing(catalog, { category: category.id }), category.id);
for (const article of catalog.articles) await page(articlePath(article), article.title, article.summary, articlePage(article, catalog), categoryOf(article), article);
await page('/es/cronologia/', 'Cronología de anuncios', 'Los anuncios oficiales de Grand Theft Auto VI ordenados por fecha y con su contexto histórico.', timelinePage(catalog), 'timeline');
await page('/es/fuentes/', 'Fuentes oficiales', 'Registro de fuentes primarias y fechas de verificación del archivo.', sourcesPage(catalog), 'sources');
await page('/es/cambios-recientes/', 'Cambios recientes', 'Consulta las verificaciones del catálogo y el acceso al historial editorial.', changesPage(catalog), 'changes');
for (const key of policyKeys) {
  const policy = policyPage(key);
  await page(`/es/${key}/`, policy.title, policy.description, policy.content, key);
}
await writeFile(path.join(out, '404.html'), layout({ title: 'Página no encontrada', description: 'Esta pieza no está en el archivo.', content: notFound(), catalog, origin }));
await writeFile(path.join(out, 'index.html'), layout({ title: 'El archivo de Grand Theft Auto VI', description: 'Wiki independiente con fuentes oficiales de GTA VI.', content: home(catalog), catalog, origin, active: 'home', path: '/es/' }));
for (const name of ['styles.css', 'app.mjs', 'model.mjs', 'template.mjs']) await cp(path.join(root, 'src', name), path.join(out, name));
await createArtwork(path.join(out, 'assets'));
await writeFile(path.join(out, 'assets/favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#191a1c"/><path d="M8 9h9l3 4 3-4h9v22h-9l-3 2-3-2H8Z" fill="none" stroke="#f0927d" stroke-width="2"/><path d="M20 14v14m-8-12h4m-4 5h4m8-5h4m-4 5h4" stroke="#f0927d" stroke-width="1.5"/></svg>');
await writeFile(path.join(out, 'catalog.json'), JSON.stringify(catalog));
await writeFile(path.join(out, 'runtime.json'), JSON.stringify({ wikiAvailable: false }));
const lastmod = catalog.verifiedAt;
const publicRoutes = routes.filter(route => !['/es/guardados/', '/es/buscar/', '/es/cambios-recientes/'].includes(route));
await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin ? publicRoutes.map(route => `<url><loc>${origin}${route}</loc><lastmod>${lastmod}</lastmod></url>`).join('') : ''}</urlset>`);
await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /wiki/\nDisallow: /es/guardados/\nDisallow: /es/buscar/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`);
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
await writeFile(path.join(out, '_headers'), `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Strict-Transport-Security: max-age=31536000\n`);
await writeFile(path.join(out, 'build-info.json'), JSON.stringify({ catalogHash: createHash('sha256').update(JSON.stringify(catalog)).digest('hex'), verifiedAt: lastmod, articles: catalog.articles.length, routes: routes.length, origin }));
console.log(`Archivo listo: ${routes.length} páginas, ${catalog.articles.length} artículos, ${catalog.sources.length} fuentes. Salida: ${out}`);
