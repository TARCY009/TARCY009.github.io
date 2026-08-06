// サイト共通のService Worker（scope: サイト全体）
// 目的は2つ:
//  1. 更新をすぐ届ける — 公開先はHTML等を10分間ブラウザにキャッシュさせるため、
//     同一サイトのファイルは cache:'reload' でブラウザのキャッシュを使わずに取りに行く
//  2. オフラインでも開ける — 一度見たページ・ファイルは保存しておき、通信できないときだけ使う
// ※ /gbl/ と /iv-checker/ はそれぞれ専用のSWを持つため、そちらが優先される
const CACHE = 'site-v1';
const PREFIX = 'site-';   // 他ツールのキャッシュ(gbl-/ivc-)を消さないよう自分の分だけ整理する

self.addEventListener('install', e => {
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameSite = url.origin === self.location.origin;
  e.respondWith((async () => {
    try {
      const res = sameSite ? await fetch(url.href, { cache: 'reload' }) : await fetch(e.request);
      if (sameSite && res.ok) {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
      }
      return res;
    } catch (err) {
      // オフライン: 保存済みを使う(URLのパラメータ違いは無視して探す)
      return (await caches.match(e.request)) ||
             (await caches.match(e.request, { ignoreSearch: true })) ||
             Response.error();
    }
  })());
});
