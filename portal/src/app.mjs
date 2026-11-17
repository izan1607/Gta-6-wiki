import { filterArticles, categoryOf, articlePath, escapeHTML as e } from './model.mjs';
import { card, icon } from './template.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const storage = {
  get(key, fallback) { try { const value = localStorage.getItem(`archivo:${key}`); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`archivo:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
};
let saved = storage.get('saved', []);
if (!Array.isArray(saved)) saved = [];
let consent = storage.get('consent', { youtube: false });
if (!consent || typeof consent !== 'object') consent = { youtube: false };
$('#cookie-banner').hidden = consent.decided === true;
let catalog;
let toastTimeout;
let pendingVideo = null;
const theme = storage.get('theme', 'dark');
document.documentElement.dataset.theme = ['light', 'dark'].includes(theme) ? theme : 'dark';

function toast(message) {
  const target = $('#toast');
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { target.hidden = true; }, 3000);
}

function syncThemeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  $('[data-theme-toggle]').innerHTML = icon(light ? 'moon' : 'sun');
  $('[data-theme-toggle]').setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  $('meta[name="theme-color"]').content = light ? '#f5f3ee' : '#171819';
}
syncThemeButton();

function syncBookmarks() {
  $$('[data-save]').forEach(button => {
    const isSaved = saved.includes(button.dataset.save);
    button.setAttribute('aria-pressed', String(isSaved));
    const article = catalog?.articles.find(a => a.id === button.dataset.save);
    if (article) button.setAttribute('aria-label', `${isSaved ? 'Quitar de guardados' : 'Guardar'} ${article.title}`);
    if (button.classList.contains('small-button')) button.innerHTML = `${icon('bookmark')} ${isSaved ? 'Guardado' : 'Guardar'}`;
  });
}

function updateCollection({ writeURL = true } = {}) {
  if (!catalog || !$('#filter-form')) return;
  const query = $('#collection-query').value;
  const category = $('#collection-category').value;
  const status = $('#collection-status').value;
  const savedOnly = $('#article-grid').hasAttribute('data-saved-only');
  const results = filterArticles(catalog.articles, { query, category, status, saved: savedOnly ? saved : null });
  $('#article-grid').innerHTML = results.map(a => card(a)).join('');
  $('#empty-results').hidden = results.length > 0;
  $('#result-count').textContent = `${results.length} ${results.length === 1 ? 'artículo' : 'artículos'}${query ? ` para «${query}»` : ''}`;
  syncBookmarks();
  if (writeURL) {
    const url = new URL(location.href);
    url.searchParams.delete('q'); url.searchParams.delete('categoria'); url.searchParams.delete('estado');
    if (query) url.searchParams.set('q', query);
    if (category !== 'all') url.searchParams.set('categoria', category);
    if (status !== 'all') url.searchParams.set('estado', status);
    history.replaceState(null, '', url);
  }
}

function updateSearch() {
  if (!catalog) return;
  const query = $('#global-search').value;
  const results = filterArticles(catalog.articles, { query }).slice(0, 7);
  $('#search-results').innerHTML = results.length ? `${!query ? '<p class="search-empty suggested">Un buen lugar para empezar</p>' : ''}${results.map(a => `<a class="search-result" href="${articlePath(a)}">${icon(categoryOf(a) === 'personajes' ? 'users' : categoryOf(a) === 'mundo' ? 'map' : 'file')}<div><strong>${e(a.title)}</strong><small>${e(a.categoryLabel)} · ${a.readingMinutes} min de lectura</small></div>${icon('arrow')}</a>`).join('')}` : `<div class="search-empty">No hay resultados para «${e(query)}». Prueba con otro nombre o tema.</div>`;
}

function openSearch() {
  closeMenu();
  const dialog = $('#search-dialog');
  if (!dialog.open) dialog.showModal();
  updateSearch();
  $('#global-search').focus();
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  $('[data-menu]').setAttribute('aria-expanded', 'false');
  $('[data-close-menu]').hidden = true;
}

function openPreferences() {
  $('#youtube-consent').checked = consent.youtube === true;
  if (!$('#preferences-dialog').open) $('#preferences-dialog').showModal();
}

function removeVideo() { $('#video-container').replaceChildren(); }
function loadVideo(id) {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || consent.youtube !== true) return;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  iframe.title = 'Vídeo oficial de Rockstar Games en YouTube';
  iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  $('#video-container').replaceChildren(iframe);
  $('#video-dialog').showModal();
}

document.addEventListener('click', event => {
  const save = event.target.closest('[data-save]');
  if (save) {
    const id = save.dataset.save;
    const exists = saved.includes(id);
    saved = exists ? saved.filter(value => value !== id) : [...saved, id];
    const persisted = storage.set('saved', saved);
    syncBookmarks();
    if ($('#article-grid')?.hasAttribute('data-saved-only')) updateCollection();
    toast(persisted ? exists ? 'Artículo eliminado de tus guardados.' : 'Artículo guardado para volver a leer.' : 'Guardado durante esta visita. El almacenamiento está desactivado.');
  }
  if (event.target.closest('[data-theme-toggle]')) {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    storage.set('theme', document.documentElement.dataset.theme);
    syncThemeButton();
  }
  if (event.target.closest('[data-search-open]')) openSearch();
  if (event.target.closest('[data-menu]')) {
    const open = document.body.classList.toggle('menu-open');
    $('[data-menu]').setAttribute('aria-expanded', String(open));
    $('[data-close-menu]').hidden = !open;
  }
  if (event.target.closest('[data-close-menu]')) closeMenu();
  if (event.target.closest('[data-cookie-open]')) { pendingVideo = null; openPreferences(); }
  if (event.target.closest('[data-cookie-reject]')) {
    consent = { youtube: false, decided: true };
    $('#cookie-banner').hidden = true;
    storage.set('consent', consent);
    removeVideo();
    if ($('#video-dialog').open) $('#video-dialog').close();
    pendingVideo = null;
    $('#preferences-dialog').close();
    toast('Vídeos externos desactivados.');
  }
  if (event.target.closest('[data-cookie-save]')) {
    consent = { youtube: $('#youtube-consent').checked, decided: true };
    $('#cookie-banner').hidden = true;
    const persisted = storage.set('consent', consent);
    $('#preferences-dialog').close();
    if (!consent.youtube) removeVideo();
    toast(persisted ? 'Preferencias guardadas.' : 'Preferencias aplicadas durante esta visita.');
    if (pendingVideo && consent.youtube) loadVideo(pendingVideo);
    pendingVideo = null;
  }
  const video = event.target.closest('[data-video]');
  if (video) {
    if (consent.youtube) loadVideo(video.dataset.video);
    else { pendingVideo = video.dataset.video; openPreferences(); }
  }
  const category = event.target.closest('[data-category-filter]');
  if (category && catalog) {
    $$('[data-category-filter]').forEach(button => {
      const active = button === category;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const results = filterArticles(catalog.articles, { category: category.dataset.categoryFilter });
    $('#article-grid').innerHTML = results.slice(0, category.dataset.categoryFilter === 'all' ? 9 : 30).map(a => card(a)).join('');
    $('#empty-results').hidden = results.length > 0;
    syncBookmarks();
  }
});

document.addEventListener('keydown', event => {
  const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !input)) {
    event.preventDefault(); openSearch();
  }
  if (event.key === 'Escape') closeMenu();
});

$('#global-search').addEventListener('input', updateSearch);
$('#global-search').addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); $('#search-results a')?.focus(); }
  if (event.key === 'Enter' && catalog) {
    event.preventDefault();
    location.assign(`/es/buscar/?q=${encodeURIComponent($('#global-search').value)}`);
  }
});

$('#search-results').addEventListener('keydown', event => {
  const links = $$('#search-results a');
  const index = links.indexOf(document.activeElement);
  if (event.key === 'ArrowDown') { event.preventDefault(); links[Math.min(index + 1, links.length - 1)]?.focus(); }
  if (event.key === 'ArrowUp') { event.preventDefault(); if (index <= 0) $('#global-search').focus(); else links[index - 1]?.focus(); }
});
$('#video-dialog').addEventListener('close', removeVideo);
$('#preferences-dialog').addEventListener('close', () => { if (!consent.youtube) pendingVideo = null; });
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
}));

$('#timeline-year')?.addEventListener('change', event => {
  $$('[data-year]').forEach(item => { item.hidden = event.target.value !== 'all' && item.dataset.year !== event.target.value; });
});
$('#filter-form')?.addEventListener('submit', event => { event.preventDefault(); updateCollection(); });
$('#collection-query')?.addEventListener('input', () => updateCollection());
$('#collection-category')?.addEventListener('change', () => updateCollection());
$('#collection-status')?.addEventListener('change', () => updateCollection());

try {
  const response = await fetch('/catalog.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('No se ha podido abrir el catálogo.');
  catalog = await response.json();
  saved = saved.filter(id => catalog.articles.some(a => a.id === id));
  syncBookmarks();
  if ($('#filter-form')) {
    const params = new URLSearchParams(location.search);
    $('#collection-query').value = params.get('q') ?? '';
    if ([...$('#collection-category').options].some(o => o.value === params.get('categoria'))) $('#collection-category').value = params.get('categoria');
    if ([...$('#collection-status').options].some(o => o.value === params.get('estado'))) $('#collection-status').value = params.get('estado');
    updateCollection({ writeURL: false });
  }
  if ($('#search-dialog').open) updateSearch();
} catch {
  if ($('#filter-form') || $('#search-dialog').open) toast('No se ha podido cargar la búsqueda. Recarga la página para reintentar.');
}

// La edición se muestra solo cuando el servidor local confirma un MediaWiki vivo.
try {
  const response = await fetch('/runtime.json', { cache: 'no-store' });
  if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
    const runtime = await response.json();
    if (runtime.wikiAvailable === true) {
      const probe = await fetch('/wiki/api.php?action=query&meta=siteinfo&format=json', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      const siteInfo = await probe.json();
      if (probe.ok && typeof siteInfo?.query?.general?.sitename === 'string') $$('[data-wiki]').forEach(element => { element.hidden = false; });
    }
  }
} catch { /* El portal publicado puede funcionar como catálogo lector independiente. */ }
