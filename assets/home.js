// 「🏠 ツール一覧」ボタン（全ツール共通・2026-09-01）
//
// どのツールからでも1タップでトップページ（ツール一覧）へ戻れるようにする。
// ボタンはテーマスイッチ(#themesw)の先頭に差し込むので、ページ側のHTMLに追加する要素は無い。
// 必ず theme.js（#themesw を innerHTML で書き換える）と explain.js の「後」に読み込むこと。
// explain.js より後に読むと、この🏠が並びのいちばん左に来る（読む順: 🏠 → 📖 → テーマ）。
//
// トップページそのものでは出さない（自分自身へのリンクになるため）。
// 見た目は home.css に閉じてあるので、どのツールに置いても同じになる。
//
// 「↻ 更新」ボタン（2026-09-08タダシさん報告）: ホーム画面に追加したアイコンから開くと、アドレスバーも
// 更新ボタンも無く、下に引っ張っても更新されない（iPhone）。そのときだけ右上に「↻」を出して、
// 押したら最新の内容を読み込み直す（Service Workerの更新も先に頼む）。ふつうのブラウザでは出さない。
// **開発者の端末だけ**（一度 ?dev=1 を開いた端末・?dev=0 で解除）。使う人には出さない。
(function () {
  var path = location.pathname.replace(/index\.html$/, '');
  var isTop = (path === '/' || path === '');   // トップページでは🏠は出さない(自分自身へのリンクになる)
  var standalone = false, dev = false;
  try {
    // ⚠ 開発者の端末だけに出す(2026-09-08タダシさん判断: 使う人には意味が薄く、模擬戦の途中で押すと消える)。
    //   一度 ?dev=1 を開いた端末に印(site_dev)を残す。印は住所からすぐ消す(共有で広がらないように)
    // ⚠ location.search だけを見ない(feedback.js と同じ落とし穴): GBL系は自分で住所を書き直すツールで、
    //   その処理がこのスクリプトより先に走ると dev=1 が消えている。「最初に開いた住所」も見る
    var q = new URLSearchParams(location.search);
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var q0 = nav && nav.name ? new URL(nav.name).searchParams : q;
    var devQ = q.get('dev') || q0.get('dev');
    if (devQ === '1') { localStorage.setItem('site_dev', '1'); }
    if (devQ === '0') localStorage.removeItem('site_dev');
    if (q.get('dev') != null) { q.delete('dev');
      var u = location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash;
      history.replaceState(null, '', u); }
    dev = localStorage.getItem('site_dev') === '1';
    standalone = (navigator.standalone === true) ||
      (window.matchMedia && ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) {
        return window.matchMedia('(display-mode: ' + m + ')').matches; }));
  } catch (e) {}

  // ⚠ iPhoneではホーム画面のアプリとSafariの保存領域が別なので、Safariで ?dev=1 を開いても印はアプリに届かない
  //   (2026-09-08タダシさん報告「そのURLで開いても出てこない」)。アプリの中から印を付けられるよう、
  //   **ページのタイトル(h1)を1.5秒長押し**で開発者モードをON/OFFする(小さな知らせを出す)
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'devtoast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800);
  }
  function setDev(on) {
    dev = !!on;
    try { if (dev) localStorage.setItem('site_dev', '1'); else localStorage.removeItem('site_dev'); } catch (e) {}
    var b = document.getElementById('reloadBtn');
    if (!dev && b) b.remove();
    if (dev) build();
    toast(dev ? '開発者モード ON（ホーム画面から開くと ↻ が出ます）' : '開発者モード OFF');
  }
  function armLongPress() {
    var h = document.querySelector('header h1') || document.querySelector('h1');
    if (!h || h.dataset.devlp) return;
    h.dataset.devlp = '1';
    var timer = null, sx = 0, sy = 0;
    var clear = function () { if (timer) { clearTimeout(timer); timer = null; } };
    h.addEventListener('pointerdown', function (e) {
      sx = e.clientX; sy = e.clientY; clear();
      timer = setTimeout(function () { timer = null; setDev(!dev); }, 1500);
    });
    h.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12) clear(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { h.addEventListener(ev, clear); });
    h.addEventListener('contextmenu', function (e) { if (timer || dev) e.preventDefault(); });   // 長押しのメニューを出さない
  }
  function build() {
    armLongPress();
    var box = document.getElementById('themesw');
    if (!box) return;
    if (dev && standalone && !document.getElementById('reloadBtn')) {
      box.insertAdjacentHTML('beforeend',
        '<button id="reloadBtn" class="reloadsw" type="button" ' +
        'title="最新の内容に更新します（ホーム画面から開いたときだけ出ます。更新が反映されるまで1〜2分かかることがあります）">' +
        '<i class="hi">↻</i></button>');
      document.getElementById('reloadBtn').onclick = function () {
        var b = this; b.disabled = true; b.classList.add('busy');
        var go = function () { location.reload(); };
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then(function (rs) {
              return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); }));
            }).then(go, go);
            setTimeout(go, 2500);   // 更新の確認に時間がかかっても待ちすぎない
            return;
          }
        } catch (e) {}
        go();
      };
    }
    if (isTop || document.getElementById('homeBtn')) return;
    box.insertAdjacentHTML('afterbegin',
      '<a id="homeBtn" class="homesw" href="/" ' +
      'title="このサイトのツール一覧（トップページ）へ移動します">' +
      '<i class="hi">🏠</i><span class="ht">ツール一覧</span></a>');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
