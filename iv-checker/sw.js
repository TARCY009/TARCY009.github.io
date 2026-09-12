// 個体値チェッカー用のService Worker
//  - 更新をすぐ届ける: 公開先はHTML等を10分間ブラウザにキャッシュさせるため、
//    同一サイトのファイルは cache:'reload' でブラウザのキャッシュを使わずに取りに行く
//  - オフラインでも開ける: 通信できないときだけ保存済みを使う
const CACHE='ivc-v34';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  '/assets/theme.css','/assets/theme.js','/assets/explain.css', '/assets/wordmark.css','/assets/explain.js','/assets/home.css','/assets/home.js','/assets/snap.js','/assets/feedback.css','/assets/feedback.js','/assets/tabs.css','/assets/pageheader.css',
  '/assets/type-icons.js'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  // 自分の古いキャッシュ(ivc-)だけ消す。他ツールのキャッシュは消さない
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k.startsWith('ivc-')&&k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
// ページを開くとき(navigate)の転送はブラウザに任せる(redirect:'manual')。転送をたどった応答をページとして返すと
// ブラウザが表示を断る(Response served by service worker has redirections・2026-09-12にiPhoneで発生)
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  const sameSite=url.origin===self.location.origin;
  e.respondWith((async()=>{
    try{
      const res=sameSite?await fetch(url.href, { cache: 'reload', redirect: e.request.mode === 'navigate' ? 'manual' : 'follow' }):await fetch(e.request);
      if(sameSite&&res.ok){
        const cp=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});
      }
      return res;
    }catch(err){
      return (await caches.match(e.request)) ||
             (await caches.match(e.request,{ignoreSearch:true})) ||
             (await caches.match('./index.html'));
    }
  })());
});
