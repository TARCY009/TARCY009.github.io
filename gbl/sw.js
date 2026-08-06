// GBL対面シミュレーター用のService Worker
// 目的: 電波の悪い場所でも起動できるようにする(PWAインストール要件も満たす)
const CACHE = 'gbl-v2';
// 起動に必要な一式。データ本体(pvp_data.js)と共有モジュールはページ外のパスだが、
// このSWが管理するページからの読み込みは全てfetchイベントを通るのでキャッシュできる
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  '/pvp_data.js',
  '/assets/pvp-engine.js', '/assets/meta_lists.js', '/assets/type-icons.js', '/assets/shadow-icon.css',
  '/assets/icons/gbl/icon-192.png', '/assets/icons/gbl/icon-512.png',
  '/assets/icons/gbl/favicon-32.png', '/assets/icons/gbl/apple-touch-icon.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// ネットワーク優先(環境リストの更新をすぐ反映)、オフライン時のみキャッシュを使う
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const cp = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
