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
    n.innerHTML = '<a href="/about/">運営者情報</a><a href="/privacy/">プライバシーポリシー</a><a href="/contact/">お問い合わせ</a><a href="/backup/">データの引っ越し</a>';
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

  // ==== 名前の検索欄の守り（全ツール共通・2026-09-10タダシさん報告で新設） ====
  // 候補をタップせずにキーボードの「✓」や「完了」で入力を終えると、入力欄には打った名前が残るのに
  // 枠の中身は前のポケモンのまま・候補の一覧も開いたまま、になっていた（iPhoneで実際に起きた。
  // 模擬戦でヘルガーと打ったのにキュウコンのわざのまま＝「新わざが反映されていない」と誤解された）。
  // 各ツールがそれぞれ持っている検索欄を1か所で守る。ページ側の追加は要らない（home.js を読むだけ）:
  //   ・候補を選ばずに入力を終えたら、名前が完全に一致する候補（無ければ候補が1つだけのとき）を選んだことにする
  //   ・どれとも決まらなければ、入力欄を入力前の名前に戻して候補を閉じる（入力欄と中身を食い違わせない）
  //   ・キーボードの改行キーでも候補を選べる（一致する候補、無ければいちばん上）
  //   ・パソコンで候補を押したとき入力欄のフォーカスを外さない（押した瞬間に一覧が消えるのを防ぐ）
  // 対象は「.sugg または .searchbox の中にある入力欄」と、その中の候補一覧（.sugg-list／#sugg／#suggest）。
  // ⚠ 新しく名前の検索欄を作るときも、この形（入れ物 .sugg・一覧 .sugg-list・候補は一覧の直下の要素で、
  //   選べないものは class="dup" か disabled）にそろえること。そろえれば自動でこの守りが効く
  (function suggGuard() {
    var BOX = '.sugg,.searchbox', LIST = '.sugg-list,#sugg,#suggest';
    // 一覧の直下の要素(＝候補1つ)。⚠ LIST + ' > *' と書くと最後の #suggest にしか効かない(カンマ区切りのため)。
    //   その書き方だと候補を押しても「選んだ」と分からず、入力欄を離れた瞬間に元の名前へ戻してしまう(実際に踏んだ)
    var ITEM = LIST.split(',').map(function (x) { return x + ' > *'; }).join(',');
    var cur = null;   // いま入力中の検索欄
    function boxOf(el) { return el && el.closest ? el.closest(BOX) : null; }
    function listOf(inp) { var b = boxOf(inp); return b ? b.querySelector(LIST) : null; }
    function isSearch(el) {
      return !!(el && el.tagName === 'INPUT' && /^(search|text)$/.test(el.type || 'text') && listOf(el));
    }
    function shown(l) { return !!(l && l.children.length && getComputedStyle(l).display !== 'none'); }
    function items(l) {
      return [].filter.call(l.children, function (c) {
        return !c.classList.contains('dup') && !c.classList.contains('sep') && !c.disabled;
      });
    }
    function kata(s) { return (s || '').replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }).replace(/\s+/g, ''); }
    function nameOf(c) {
      var n = c.querySelector('.srow') || c.firstElementChild || c;
      var x = n.cloneNode(true);
      [].forEach.call(x.querySelectorAll('i,small,.evtag,.unrel,.mvtag,.dupn,.bs'), function (e) { e.remove(); });
      return kata(x.textContent);
    }
    function match(inp, l, orFirst) {
      var it = items(l); if (!it.length) return null;
      var v = kata(inp.value).replace(/^シャドウ/, '');
      for (var i = 0; i < it.length; i++) if (nameOf(it[i]) === v) return it[i];
      return (orFirst || it.length === 1) ? it[0] : null;
    }
    // 入力を始めたときの状態を控える。**毎回取り直す**（同じ欄で続けて入力したとき、前回の「選んだ」を引きずらない）。
    // ただし抜けた直後(0.25秒以内)に戻ってきたとき(✕で消して打ち直す等)は、同じ入力の続きとして扱う
    document.addEventListener('focusin', function (e) {
      var inp = e.target; if (!isSearch(inp)) return;
      if (cur === inp && inp._sgOutAt && Date.now() - inp._sgOutAt < 250) return;
      cur = inp; inp._sgBefore = inp.value; inp._sgPicked = false; inp._sgShown = shown(listOf(inp)); inp._sgOutAt = 0;
    });
    // 打つたびに「候補が出たか」を控える（候補が一度も出ない欄＝CPの数字欄などは守りの対象にしない）
    document.addEventListener('input', function (e) {
      var inp = e.target; if (!isSearch(inp)) return;
      setTimeout(function () { if (shown(listOf(inp))) inp._sgShown = true; }, 0);
    });
    // 候補を押した＝選んだ（一覧の直下の、選べる候補だけ）
    document.addEventListener('click', function (e) {
      var l = e.target.closest && e.target.closest(LIST); if (!l) return;
      var c = e.target.closest(ITEM);
      var b = boxOf(l), inp = b && b.querySelector('input');
      if (inp && c && items(l).indexOf(c) >= 0) inp._sgPicked = true;
    }, true);
    // パソコン: 候補を押した瞬間に入力欄のフォーカスが外れて一覧が消えるのを防ぐ（スクロールは妨げない）
    document.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest(LIST)) e.preventDefault();
    }, true);
    document.addEventListener('keydown', function (e) {
      var inp = e.target; if (!isSearch(inp)) return;
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;   // 日本語の変換の確定は除く
      var l = listOf(inp); if (!shown(l)) return;
      var c = match(inp, l, true); if (!c) return;
      e.preventDefault(); c.click(); inp._sgPicked = true; cur = null; inp.blur();
    });
    document.addEventListener('focusout', function (e) {
      var inp = e.target; if (!isSearch(inp)) return;
      inp._sgOutAt = Date.now();
      setTimeout(function () {
        if (!inp.isConnected || document.activeElement === inp) return;   // 戻ってきた(✕で消して打ち直す等)
        if (cur === inp) cur = null;
        if (inp._sgPicked || !inp._sgShown) return;
        var l = listOf(inp);
        var c = shown(l) ? match(inp, l, false) : null;
        if (c) { c.click(); return; }
        // 決まらなかった: 入力前の名前に戻して閉じる（空にしたときは、ページ側の「消す」操作を尊重してそのまま）
        if (inp.value && inp.value !== inp._sgBefore) inp.value = inp._sgBefore || '';
        if (l) l.style.display = 'none';
      }, 200);
    });
  })();
})();
