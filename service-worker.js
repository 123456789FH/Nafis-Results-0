'use strict';

const CACHE_NAME = 'nafis-results-v7.1.4-pptx-analysis-fix';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/css/app.css',
  './assets/vendor/pptxgen.bundle.js',
  './assets/js/app.js', './assets/js/ai-reader.js', './assets/js/runtime-config.js', './assets/js/pwa.js', './assets/js/config.js', './assets/js/file-reader.js',
  './assets/js/parser.js', './assets/js/analysis.js', './assets/js/worksheets.js',
  './assets/js/worksheets-g9.js', './assets/js/ooxml.js',
  './assets/images/logo.jpg', './assets/icons/icon-192.png',
  './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // لا نخزن المكتبات الخارجية أو أي طلب خارجي.

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  const scope = new URL(self.registration.scope);
  const relative = `./${url.pathname.slice(scope.pathname.length)}`;
  if (!SHELL.includes(relative)) return; // لا تخزين مؤقت لملفات المستخدم أو موارد غير معروفة.
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
