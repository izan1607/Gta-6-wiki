import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto no válido');
let building = false;
let rebuildQueued = false;
async function build() {
  if (building) { rebuildQueued = true; return; }
  building = true;
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('exit', resolve);
  });
  building = false;
  if (code) console.error('No se pudo reconstruir el portal.');
  if (rebuildQueued) { rebuildQueued = false; await build(); }
}
await build();
let timeout;
for (const directory of ['src', 'content', 'scripts']) watch(path.join(root, directory), { recursive: true }, () => { clearTimeout(timeout); timeout = setTimeout(build, 250); });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD, POST' }); res.end(); return; }
  if (req.url.startsWith('/wiki/') || req.url === '/wiki') {
    const upstream = httpRequest({ hostname: '127.0.0.1', port: 8081, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('El espacio editorial todavía no está conectado. Inicia MediaWiki con scripts/start-local.ps1.'); } });
    req.pipe(upstream); return;
  }
  if (req.method === 'POST') { res.writeHead(405); res.end(); return; }
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.url.split('?')[0] === '/runtime.json') {
    let wikiAvailable = false;
    try {
      const response = await fetch('http://127.0.0.1:8081/wiki/api.php?action=query&meta=siteinfo&format=json', { signal: AbortSignal.timeout(1500) });
      const body = await response.json();
      wikiAvailable = response.ok && typeof body?.query?.general?.sitename === 'string';
    } catch { /* Mode lecture indépendant. */ }
    res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ wikiAvailable })); return;
  }
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname); } catch { res.writeHead(400); res.end(); return; }
  if (requestPath === '/') { res.writeHead(302, { Location: '/es/' }); res.end(); return; }
  let candidate = path.resolve(dist, `.${requestPath.replace(/\\/g, '/')}`);
  const safePrefix = dist + path.sep;
  if (!candidate.startsWith(safePrefix) || /(^|\/)\./.test(requestPath)) { res.writeHead(403); res.end(); return; }
  try {
    if ((await stat(candidate)).isDirectory()) {
      if (!requestPath.endsWith('/')) { res.writeHead(301, { Location: requestPath + '/' + new URL(req.url, 'http://localhost').search }); res.end(); return; }
      candidate = path.join(candidate, 'index.html');
    }
    const content = await readFile(candidate);
    res.writeHead(200, { 'Content-Type': types[path.extname(candidate)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404, { 'Content-Type': types['.html'] });
    res.end(req.method === 'HEAD' ? undefined : await readFile(path.join(dist, '404.html')));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/es/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); process.exit(0); });
