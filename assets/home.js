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
    b = document.getElementById('reloadBtn');
    // 出た場所が分かるように、右上のボタンを数秒光らせる(2026-09-08タダシさん報告「画面下にボタンが出た」＝この知らせを
    // ボタンだと思った。本物は右上)
    if (dev && b) { b.classList.add('hey'); setTimeout(function () { b.classList.remove('hey'); }, 4000); }
    toast(dev ? (b ? '開発者モード ON：右上に「↻ 更新」ボタンを出しました' : '開発者モード ON：ホーム画面のアプリで開くと右上に「↻ 更新」が出ます')
              : '開発者モード OFF');
  }
  function armLongPress() {
    var h = document.querySelector('header h1') || document.querySelector('h1');
    if (!h || h.dataset.devlp) return;
    h.dataset.devlp = '1';
    var timer = null, sx = 0, sy = 0;
    var clear = function () { if (timer) { clearTimeout(timer); timer = null; } };
    var start = function (x, y) { sx = x; sy = y; clear(); timer = setTimeout(function () { timer = null; setDev(!dev); }, 1500); };
    var moved = function (x, y) { if (Math.abs(x - sx) > 12 || Math.abs(y - sy) > 12) clear(); };
    // ⚠ iPhoneでは長押しが「コピー」の吹き出し(文字の選択)になって、pointercancel で計測が途中で切れていた
    //   (2026-09-08タダシさん報告)。選択と吹き出しを止め(selectstart/contextmenu・CSSのuser-select:none)、
    //   計測は touch イベントで持つ(pointercancel では切らない)
    var touch = ('ontouchstart' in window);
    if (touch) {
      h.addEventListener('touchstart', function (e) { var t = e.touches[0]; if (t) start(t.clientX, t.clientY); }, { passive: true });
      h.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) moved(t.clientX, t.clientY); }, { passive: true });
      ['touchend', 'touchcancel'].forEach(function (ev) { h.addEventListener(ev, clear); });
    } else {
      h.addEventListener('pointerdown', function (e) { start(e.clientX, e.clientY); });
      h.addEventListener('pointermove', function (e) { moved(e.clientX, e.clientY); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { h.addEventListener(ev, clear); });
    }
    // 長押しが効かない端末向け: **素早く7回タップ**でも切り替える(タップならコピーの吹き出しは出ない・2026-09-08)
    var taps = 0, tapAt = 0;
    h.addEventListener('click', function () {
      var now = Date.now();
      taps = (now - tapAt < 700) ? taps + 1 : 1; tapAt = now;
      if (taps >= 7) { taps = 0; setDev(!dev); }
    });
    h.addEventListener('selectstart', function (e) { e.preventDefault(); });   // 長押しで文字を選択させない
    h.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // 長押しのメニュー(コピー)を出さない
  }
  // ---- ページのいちばん下の案内リンク(2026-09-10・公開に向けて) ----
  // 運営者情報・プライバシーポリシー・お問い合わせの3つを、すべてのツールの最下部に出す。
  // トップページは自前のフッターに同じリンクを持つので出さない。管理用の /feedback/ にも出さない
  function footLinks() {
    if (isTop || /^\/feedback\//.test(path) || document.getElementById('sitefoot')) return;
    var n = document.createElement('nav');
    n.id = 'sitefoot'; n.className = 'sitefoot'; n.setAttribute('aria-label', 'サイトの案内');
    n.innerHTML = '<a href="/about/">運営者情報</a><a href="/privacy/">プライバシーポリシー</a><a href="/contact/">お問い合わせ</a>';
    document.body.appendChild(n);
  }
  function build() {
    footLinks();
    armLongPress();
    var box = document.getElementById('themesw');
    if (!box) return;
    if (dev && standalone && !document.getElementById('reloadBtn')) {
      box.insertAdjacentHTML('beforeend',
        '<button id="reloadBtn" class="reloadsw" type="button" ' +
        'title="最新の内容に更新します（ホーム画面から開いたときだけ出ます。更新が反映されるまで1〜2分かかることがあります）">' +
        '<i class="hi">↻</i><span class="ht">更新</span></button>');
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
