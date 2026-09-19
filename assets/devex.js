/* 開発者だけの「このポケモンを一覧から外す」（2026-09-19タダシさん指示）

   このサイトは**近々登場するポケモンを先行して入れている**（メガムクホークなど）。
   動画を作るときに「まだ出ていないポケモン」が一覧に混ざると困るので、
   **ピンポイントで指定して外せる**ようにする。

   ⚠ 開発者の端末だけ（home.js の GonaviDev()）。ふつうの人の画面には
      ボタンも出ないし、除外も一切かからない（has() が常に false を返す）。
   ⚠ 除外した状態は**リンクで渡せる**: ?devex=メガムクホーク,ウッウ
      （開いた端末に覚えさせて、住所からはすぐ消す。?dev=1 と同じ流儀）。
      ?devex= だけ（空）を付けて開くと、その端末の除外を全部外す。

   使い方（ページ側）:
     1) </body> の直前に <script src="/assets/devex.js"></script>（home.js より後）
     2) 一覧を作るところで  if (GonaviDevEx.has(名前)) continue;
     3) 作り直しの合図       GonaviDevEx.on(() => 描き直す関数())
     4) キャッシュの鍵に     GonaviDevEx.sig()
     5) ボタンの置き場所     GonaviDevEx.mount(要素, () => そのページの名前の一覧)
   ⚠ has() は**「シャドウ」を外した名前**で見る＝通常もシャドウもまとめて外れる。
   保存キーは site_devex（開発者だけの設定なので「データの引っ越し」からは外してある）。 */
(function () {
  'use strict';
  var KEY = 'site_devex';
  var list = [], subs = [], mounted = [], cssDone = false;

  function dev() { try { return !!(window.GonaviDev && window.GonaviDev()); } catch (e) { return false; } }
  // 「シャドウ○○」も「○○」と同じ扱いにする（指定は1つで済む）
  function norm(s) { return String(s == null ? '' : s).replace(/^シャドウ/, '').trim(); }
  function toKata(s) { return String(s).replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      list = Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x; }).map(norm) : [];
    } catch (e) { list = []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { } }
  function fire() { subs.forEach(function (f) { try { f(); } catch (e) { } }); render(); }

  // ---- リンクで受け取る。⚠ location.search だけで見ない（住所を書き直すページがあるため・?dev=1 と同じ） ----
  function fromUrl() {
    var v = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('devex')) v = q.get('devex');
      if (v == null) {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.name) {
          var q2 = new URLSearchParams(new URL(nav.name, location.href).search);
          if (q2.has('devex')) v = q2.get('devex');
        }
      }
    } catch (e) { }
    if (v == null) return;
    list = v.split(',').map(norm).filter(Boolean);
    // 同じ名前は1つに
    list = list.filter(function (x, i) { return list.indexOf(x) === i; });
    save();
    try {
      var u = new URL(location.href);
      u.searchParams.delete('devex');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { }
  }

  load(); fromUrl();

  // ---- 見た目（開発者だけが見るので、紫の控えめな形。ほかのツールのCSSに触らない） ----
  function css() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style');
    s.textContent = [
      '.dvxwrap{margin:8px 0;font-family:inherit}',
      '.dvxbtn{font:inherit;font-size:.76rem;font-weight:800;cursor:pointer;border-radius:999px;',
      '  border:1px solid #6b46c1;background:linear-gradient(180deg,#3b2a63,#2a1d49);color:#e6dcff;padding:5px 12px}',
      '.dvxbtn[aria-expanded="true"]{background:linear-gradient(160deg,#d8c4ff,#a970ff 55%,#7a3cff);color:#1b1030;border-color:transparent}',
      '.dvxbtn b{margin-left:5px;background:rgba(255,255,255,.22);border-radius:999px;padding:0 6px}',
      '.dvxpanel{display:none;margin-top:7px;border:1px solid #6b46c1;border-radius:12px;padding:10px 11px;',
      '  background:rgba(38,26,68,.94);color:#e6dcff;font-size:.76rem;line-height:1.7;max-width:460px}',
      '.dvxpanel.open{display:block}',
      '.dvxpanel .dvxnote{color:#b9a6e8;font-size:.71rem;margin:0 0 7px}',
      '.dvxpanel .sugg{position:relative}',
      '.dvxpanel input{width:100%;box-sizing:border-box;font-size:16px;padding:6px 9px;border-radius:9px;',
      '  border:1px solid #6b46c1;background:rgba(0,0,0,.34);color:#fff}',
      '.dvxpanel .sugg-list{position:absolute;left:0;right:0;top:100%;z-index:60;max-height:260px;overflow:auto;',
      '  background:#1d1433;border:1px solid #6b46c1;border-radius:9px;margin-top:3px;display:none}',
      '.dvxpanel .sugg-list.open{display:block}',
      '.dvxpanel .sugg-list>div{padding:6px 10px;cursor:pointer;font-size:.8rem}',
      '.dvxpanel .sugg-list>div:hover{background:rgba(169,112,255,.22)}',
      '.dvxpanel .sugg-list>div.dup{opacity:.45;cursor:default}',
      '.dvxchips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 0}',
      '.dvxchips span{display:inline-flex;align-items:center;gap:5px;background:rgba(169,112,255,.2);',
      '  border:1px solid #6b46c1;border-radius:999px;padding:2px 4px 2px 10px;font-size:.74rem}',
      '.dvxchips button{font:inherit;cursor:pointer;border:0;background:rgba(0,0,0,.3);color:#e6dcff;',
      '  border-radius:999px;width:19px;height:19px;line-height:1;padding:0}',
      '.dvxrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}',
      '.dvxrow button{font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;border-radius:999px;',
      '  border:1px solid #6b46c1;background:rgba(0,0,0,.28);color:#e6dcff;padding:4px 10px}',
      '.dvxmsg{color:#a8ffd0;font-size:.71rem;margin-left:4px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---- ボタンとパネル ----
  function build(host, namesFn) {
    css();
    var wrap = document.createElement('div');
    wrap.className = 'dvxwrap';
    wrap.innerHTML =
      '<button type="button" class="dvxbtn" aria-expanded="false" title="開発者だけの機能です。指定したポケモンをこの一覧から外します（動画用）">🚫 除外<b>0</b></button>' +
      '<div class="dvxpanel">' +
      '<p class="dvxnote">この端末の一覧から外します（開発者だけ・ふつうの人の画面は変わりません）。<br>' +
      '近々登場するポケモンを先行して入れているので、動画用に一時的に外すのに使います。</p>' +
      '<div class="sugg"><input type="search" placeholder="ポケモン名で探す" autocomplete="off" ' +
      'autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
      '<div class="dvxchips"></div>' +
      '<div class="dvxrow"><button type="button" class="dvxclear">すべて戻す</button>' +
      '<button type="button" class="dvxcopy">🔗 このリンクをコピー</button><span class="dvxmsg"></span></div>' +
      '</div>';
    host.appendChild(wrap);
    var btn = wrap.querySelector('.dvxbtn'), panel = wrap.querySelector('.dvxpanel');
    var inp = wrap.querySelector('input'), ul = wrap.querySelector('.sugg-list');
    var msg = wrap.querySelector('.dvxmsg');

    btn.onclick = function () {
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) inp.focus();
    };
    // 候補。⚠ 変換中も出す（iPhoneの日本語入力は確定まで isComposing のまま・共通ルール）
    function showSugg() {
      var q = norm(inp.value);
      if (!q) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      // ⚠ ひらがなで打ってもカタカナの名前に当たるようにするが、**名前の側もそろえて**比べる。
      //    片側だけカタカナに直すと「ケルディオ(かくご)」のようなひらがな入りの名前が探せない（実際に踏んだ）
      var qk = toKata(q);
      var all = [];
      try { all = (namesFn ? namesFn() : []) || []; } catch (e) { all = []; }
      var seen = {}, hit = [];
      all.forEach(function (n) {
        var b = norm(n);
        if (!b || seen[b]) return; seen[b] = 1;
        if (b.indexOf(q) >= 0 || toKata(b).indexOf(qk) >= 0) hit.push(b);
      });
      hit.sort(function (a, b) { return (toKata(a).indexOf(qk) - toKata(b).indexOf(qk)) || a.localeCompare(b, 'ja'); });
      hit = hit.slice(0, 60);
      ul.innerHTML = hit.length
        ? hit.map(function (n) {
            var on = list.indexOf(n) >= 0;
            return '<div' + (on ? ' class="dup"' : '') + ' data-n="' + n.replace(/"/g, '&quot;') + '">' +
              n + (on ? '<small>（すでに外しています）</small>' : '') + '</div>';
          }).join('')
        : '<div class="dup">見つかりません</div>';
      ul.classList.add('open');
    }
    inp.addEventListener('input', showSugg);
    inp.addEventListener('focus', showSugg);
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });   // 入力欄のフォーカスを外さない
    ul.addEventListener('click', function (e) {
      var d = e.target.closest('div[data-n]'); if (!d) return;
      add(d.dataset.n);
      inp.value = ''; ul.classList.remove('open'); ul.innerHTML = '';
    });
    wrap.querySelector('.dvxclear').onclick = function () { if (list.length) { list = []; save(); fire(); } };
    wrap.querySelector('.dvxcopy').onclick = function () {
      var u = location.origin + location.pathname + (list.length ? '?devex=' + encodeURIComponent(list.join(',')) : '?devex=');
      var done = function () { msg.textContent = 'コピーしました'; setTimeout(function () { msg.textContent = ''; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, function () { prompt('このリンクをコピーしてください', u); });
      else prompt('このリンクをコピーしてください', u);
    };
    mounted.push(wrap);
    return wrap;
  }

  function render() {
    mounted.forEach(function (wrap) {
      var b = wrap.querySelector('.dvxbtn b'); if (b) b.textContent = list.length;
      var chips = wrap.querySelector('.dvxchips');
      if (chips) chips.innerHTML = list.length
        ? list.map(function (n) { return '<span>' + n + '<button type="button" data-n="' + n.replace(/"/g, '&quot;') + '" title="戻す">×</button></span>'; }).join('')
        : '<em style="opacity:.6">いまは1匹も外していません</em>';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.dvxchips button[data-n]'); if (!b) return;
    remove(b.dataset.n);
  });

  function add(n) { n = norm(n); if (!n || list.indexOf(n) >= 0) return; list.push(n); save(); fire(); }
  function remove(n) { n = norm(n); var i = list.indexOf(n); if (i < 0) return; list.splice(i, 1); save(); fire(); }

  window.GonaviDevEx = {
    // ⚠ 開発者の端末でなければ必ず false（ふつうの人の一覧は1匹も減らない）
    has: function (name) { return dev() && list.length > 0 && list.indexOf(norm(name)) >= 0; },
    list: function () { return dev() ? list.slice() : []; },
    // わざ構成などをためこむキャッシュの鍵に混ぜる（除外を変えたら作り直させる）
    sig: function () { return dev() && list.length ? list.join(',') : ''; },
    on: function (fn) { if (typeof fn === 'function') subs.push(fn); },
    // host=ボタンの置き場所 ／ namesFn=そのページに出るポケモン名の一覧を返す関数
    // ⚠ 開発者かどうかは home.js の GonaviDev() で決まるので、**読み込みが終わってから**置く
    //   （ページ本体のスクリプトは home.js より先に走ることがある）。
    //   置いたあと、外しているポケモンがあれば一覧を作り直す（最初の描画には間に合っていないため）
    mount: function (host, namesFn) {
      if (!host) return null;
      var go = function () {
        if (!dev()) return;
        build(host, namesFn); render();
        if (list.length) setTimeout(fire, 0);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
      return null;
    }
  };
})();
