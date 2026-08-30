// 対戦記録(GBL)用のService Worker
// 目的: 電波の悪い場所(対戦の合間)でも起動できるようにする(PWAインストール要件も満たす)
const CACHE = 'blg-v8';
// 起動に必要な一式。データ本体(pvp_data.js)と共有モジュールはページ外のパスだが、
// このSWが管理するページからの読み込みは全てfetchイベントを通るのでキャッシュできる
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  '/pvp_data.js',
  '/assets/pvp-engine.js', '/assets/meta_lists.js', '/assets/meta_moves.js',
  '/assets/type-icons.js', '/assets/shadow-icon.css',
  '/assets/rocket_roster.js', '/assets/gbl.css', '/assets/gbl-app.js',
  '/assets/theme.css', '/assets/theme.js',
  '/assets/explain.css', '/assets/explain.js',
  '/assets/icons/battlelog/icon-192.png', '/assets/icons/battlelog/icon-512.png',
  '/assets/icons/battlelog/favicon-32.png', '/assets/icons/battlelog/apple-touch-icon.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // 自分の古いキャッシュ(blg-)だけ消す。他ツールのキャッシュは消さない
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k.startsWith('blg-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// ネットワーク優先(更新をすぐ反映)、オフライン時のみキャッシュを使う。
// 公開先(GitHub Pages)はHTML等を10分間ブラウザにキャッシュさせる設定のため、
// 同一サイトのファイルは cache:'reload' でブラウザのキャッシュを使わずに取りに行く(更新が即座に届く)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameSite = url.origin === self.location.origin;
  e.respondWith((async () => {
    try {
      const res = sameSite ? await fetch(url.href, { cache: 'reload' }) : await fetch(e.request);
      const cp = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
      return res;
    } catch (err) {
      return (await caches.match(e.request)) || (await caches.match('./index.html'));
    }
  })());
});
