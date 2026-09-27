/* 開発者だけの「✎ わざカスタム」（2026-09-27タダシさん指示・まずタイプ別火力ランキング）

   ポケモンを選んで、覚えていないわざ（既存のどのわざでも・自分で作った新しいわざでも）を覚えさせ、
   ランキングに反映する。動画で「このわざを覚えたら何位？」「新わざが来たら？」を見せるため。
   **覚えるわざに足すだけ**＝わざの組み合わせはツールがいつもどおり選ぶ（計算はツールと同じ）。

   ⚠ 開発者の端末だけ（home.js の GonaviDev()）。ふつうの人にはボタンも出ないし、extra() は常に null。
   ⚠ 何匹でも足せる（ポケモンごとに1行）。同じポケモンにわざを何本でも足せる。
   ⚠ リンクで渡せる: 「🔗 このリンクをコピー」で ?devmv=... を作る（開いた端末に覚えさせて住所からすぐ消す）。
      ?devmv= だけ（空）で全部外す。
   ⚠ 名前は「シャドウ」を外して比べる＝通常とシャドウの両方に効く（devex.js と同じ）。

   使い方（ページ側）:
     1) <head> に <script src="/assets/devmove.js"></script>（devex.js・devadd.js の直後・ページ本体より先）
     2) データを読んだら GonaviDevMv.mount(置き場所, {names:()=>名前の一覧, moves:わざの表(D.moves), typeJa:D.typeJa, curType:()=>いまのタイプ})
        （作ったわざは moves に DEVMV_… の番号で書き込まれる＝名前・タイプ・威力はほかのわざと同じに引ける）
     3) わざ構成を決めるところで  const x=GonaviDevMv.extra(名前)  → {q:[ノーマルのID], c:[SPのID]} か null
     4) 作り直しの合図 GonaviDevMv.on(()=>描き直す)・キャッシュの鍵に GonaviDevMv.sig()
   保存キーは site_devmv（開発者だけの設定なので「データの引っ越し」からは外してある）。 */
(function () {
  'use strict';
  var KEY = 'site_devmv';
  var st = { defs: [], mons: [] }, subs = [], mounted = [], cssDone = false, opt = null, cur = null;

  function dev() { try { return !!(window.GonaviDev && window.GonaviDev()); } catch (e) { return false; } }
  function norm(s) { return String(s == null ? '' : s).replace(/^シャドウ/, '').trim(); }
  function toKata(s) { return String(s).replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  // 全角の数字・小数点も読む（入力中には書き換えず、押したときに読むだけ）
  function numOf(v) { var x = parseFloat(String(v || '').replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })); return isFinite(x) ? x : NaN; }

  function clean(v) {
    var o = { defs: [], mons: [] };
    if (!v || typeof v !== 'object') return o;
    (Array.isArray(v.defs) ? v.defs : []).forEach(function (d) {
      if (d && typeof d.id === 'string' && /^DEVMV_\d+$/.test(d.id) && d.n && d.t && isFinite(d.p) && isFinite(d.d) && isFinite(d.e) && d.e !== 0)
        o.defs.push({ id: d.id, n: String(d.n).slice(0, 30), t: String(d.t), p: +d.p, d: +d.d, e: +d.e });
    });
    (Array.isArray(v.mons) ? v.mons : []).forEach(function (m) {
      if (!m || !m.n) return;
      var n = norm(m.n); if (!n || o.mons.some(function (x) { return x.n === n; })) return;
      o.mons.push({ n: n, mv: (Array.isArray(m.mv) ? m.mv : []).filter(function (x) { return typeof x === 'string'; }) });
    });
    return o;
  }
  function load() { try { st = clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { st = clean(null); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }
  // 文字列 ⇔ リンク用（日本語を含むので UTF-8 → base64url）
  function enc(o) { var b = new TextEncoder().encode(JSON.stringify(o)), s = ''; b.forEach(function (x) { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function dec(t) { var s = atob(t.replace(/-/g, '+').replace(/_/g, '/')), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return JSON.parse(new TextDecoder().decode(b)); }

  // ---- リンクで受け取る。⚠ location.search だけで見ない（住所を書き直すページがあるため・?dev=1 と同じ） ----
  function fromUrl() {
    var v = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('devmv')) v = q.get('devmv');
      if (v == null) {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.name) { var q2 = new URLSearchParams(new URL(nav.name, location.href).search); if (q2.has('devmv')) v = q2.get('devmv'); }
      }
    } catch (e) { }
    if (v == null) return;
    try { st = v ? clean(dec(v)) : clean(null); save(); } catch (e) { }
    try { var u = new URL(location.href); u.searchParams.delete('devmv'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (e) { }
  }
  load(); fromUrl();

  // 作ったわざをページのわざの表へ書き込む（消したものは表から外す）
  function inject() {
    if (!opt || !opt.moves) return;
    Object.keys(opt.moves).forEach(function (k) { if (/^DEVMV_/.test(k) && !st.defs.some(function (d) { return d.id === k; })) delete opt.moves[k]; });
    st.defs.forEach(function (d) { opt.moves[d.id] = { n: d.n, t: d.t, p: d.p, d: d.d, e: d.e, w: d.d, we: d.d, dev: 1 }; });
  }
  // どのポケモンも覚えていない自作のわざは片づける
  function gc() { st.defs = st.defs.filter(function (d) { return st.mons.some(function (m) { return m.mv.indexOf(d.id) >= 0; }); }); }
  function changed() { gc(); save(); inject(); subs.forEach(function (f) { try { f(); } catch (e) { } }); render(); }
  function monOf(n) { n = norm(n); for (var i = 0; i < st.mons.length; i++) if (st.mons[i].n === n) return st.mons[i]; return null; }
  function mv(id) { return opt && opt.moves ? opt.moves[id] : null; }
  function tja(t) { return (opt && opt.typeJa && opt.typeJa[t]) || t; }
  function icon(t, sz) { try { return window.typeIconHTML ? window.typeIconHTML(tja(t), sz || 16) : ''; } catch (e) { return ''; } }
  function mvLabel(id) {
    var m = mv(id); if (!m) return id;
    return /^HIDDEN_POWER_/.test(id) ? 'めざめるパワー（' + tja(m.t) + '）' : m.n;
  }
  function kindOf(m) { return m.e > 0 ? 'ノーマル' : 'SP'; }

  // ---- 見た目（開発者だけが見る。除外の紫・未実装の青緑と分けて琥珀色。ほかのツールのCSSに触らない） ----
  function css() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style');
    s.textContent = [
      '.dvmwrap{margin:8px 0;font-family:inherit}',
      '.dvmbtn{font:inherit;font-size:.76rem;font-weight:800;cursor:pointer;border-radius:999px;',
      '  border:1px solid #b7791f;background:linear-gradient(180deg,#4d3714,#33240c);color:#ffe9c7;padding:5px 12px}',
      '.dvmbtn[aria-expanded="true"]{background:linear-gradient(160deg,#ffe8b0,#ffb63d 55%,#d98a00);color:#2b1a00;border-color:transparent}',
      '.dvmbtn b{margin-left:5px;background:rgba(255,255,255,.22);border-radius:999px;padding:0 6px}',
      '.dvmpanel{display:none;margin-top:7px;border:1px solid #b7791f;border-radius:12px;padding:10px 11px;',
      '  background:rgba(52,36,10,.96);color:#ffe9c7;font-size:.76rem;line-height:1.7;max-width:460px}',
      '.dvmpanel.open{display:block}',
      '.dvmpanel .dvmnote{color:#e6c790;font-size:.71rem;margin:0 0 7px}',
      '.dvmpanel .dvmlab{font-weight:800;margin:8px 0 3px;font-size:.72rem;color:#ffd28a}',
      '.dvmpanel .sugg{position:relative}',
      '.dvmpanel input,.dvmpanel select{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:6px 9px;border-radius:9px;',
      '  border:1px solid #b7791f;background:rgba(0,0,0,.34);color:#fff}',
      '.dvmpanel select option{background:#2b1d08;color:#fff}',
      '.dvmpanel .sugg-list{position:absolute;left:0;right:0;top:100%;z-index:60;max-height:260px;overflow:auto;',
      '  background:#2b1d08;border:1px solid #b7791f;border-radius:9px;margin-top:3px;display:none}',
      '.dvmpanel .sugg-list.open{display:block}',
      '.dvmpanel .sugg-list>div{display:flex;align-items:center;gap:6px;padding:6px 10px;cursor:pointer;font-size:.8rem}',
      '.dvmpanel .sugg-list>div:hover{background:rgba(255,182,61,.18)}',
      '.dvmpanel .sugg-list>div.dup{opacity:.45;cursor:default}',
      '.dvmpanel .sugg-list>div.on{background:rgba(255,182,61,.24);font-weight:800}',
      '.dvmpanel .sugg-list>div small{opacity:.72;font-weight:600;margin-left:auto;white-space:nowrap}',
      '.dvmcur{display:none;margin-top:8px;border-top:1px dashed #b7791f;padding-top:6px}',
      '.dvmcur.show{display:block}',
      '.dvmcur .dvmwho{font-weight:900;font-size:.82rem;color:#fff}',
      '.dvmnew{display:none;margin-top:7px;border:1px dashed #b7791f;border-radius:10px;padding:8px}',
      '.dvmnew.open{display:block}',
      '.dvmgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '.dvmgrid label{display:flex;flex-direction:column;font-size:.68rem;font-weight:700;color:#e6c790;gap:2px}',
      '.dvmgrid label.w2{grid-column:1/-1}',
      '.dvmgrid label[hidden]{display:none}',
      '.dvmerr{color:#ffb4a8;font-size:.7rem;margin-top:4px;min-height:1em}',
      '.dvmlist{margin:9px 0 0;display:flex;flex-direction:column;gap:5px}',
      '.dvmlist .row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;background:rgba(255,182,61,.10);border:1px solid #7a5415;border-radius:10px;padding:5px 6px}',
      '.dvmlist .row.cur{border-color:#ffb63d;background:rgba(255,182,61,.2)}',
      '.dvmlist .who{font:inherit;font-weight:900;cursor:pointer;border:0;background:none;color:#fff;padding:0 4px;font-size:.78rem}',
      '.dvmlist .mvc{display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,.3);border-radius:999px;padding:1px 3px 1px 8px;font-size:.72rem}',
      '.dvmlist .mvc.own{outline:1px dashed #ffb63d}',
      '.dvmlist button.x{font:inherit;cursor:pointer;border:0;background:rgba(0,0,0,.35);color:#ffe9c7;border-radius:999px;width:19px;height:19px;line-height:1;padding:0}',
      '.dvmlist .row>button.x{margin-left:auto}',
      '.dvmrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}',
      '.dvmrow button,.dvmpanel .dvmsub{font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;border-radius:999px;',
      '  border:1px solid #b7791f;background:rgba(0,0,0,.28);color:#ffe9c7;padding:4px 10px}',
      '.dvmpanel .dvmgo{margin-top:7px;color:#2b1a00;border-color:transparent;background:linear-gradient(160deg,#ffe8b0,#ffb63d 55%,#d98a00)}',
      '.dvmmsg{color:#a8ffd0;font-size:.71rem;margin-left:4px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // 候補の一覧（ポケモン・わざ共通の作り）。onPick(値) を呼び、keep=true なら選んでも閉じない
  function suggest(inp, ul, rowsFn, onPick, keep) {
    function show() {
      var q = inp.value.trim();
      if (!q) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      var rows = rowsFn(toKata(q)).slice(0, 60);
      ul.innerHTML = rows.length ? rows.join('') : '<div class="dup">見つかりません</div>';
      // ⚠ 共通の守り(home.js の suggGuard)が書いた display:none を消す（残ると2回目から候補が出ない・devex.js と同じ）
      ul.style.display = '';
      ul.classList.add('open');
    }
    inp.addEventListener('input', show);
    inp.addEventListener('focus', show);
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });   // 入力欄のフォーカスを外さない
    ul.addEventListener('click', function (e) {
      var d = e.target.closest('div[data-v]'); if (!d) return;
      onPick(d.getAttribute('data-v'));
      if (keep) show(); else { inp.value = ''; ul.classList.remove('open'); ul.innerHTML = ''; }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!ul.classList.contains('open') || e.target.closest('.sugg') === inp.parentNode) return;
      // 打ちかけの文字は消す（共通の守りが「打った名前に一致する候補」を勝手に押さないように）
      inp.value = ''; ul.classList.remove('open'); ul.innerHTML = '';
    }, true);
    return show;
  }

  function build(host) {
    css();
    var wrap = document.createElement('div');
    wrap.className = 'dvmwrap';
    var typeOpts = Object.keys((opt && opt.typeJa) || {});
    try { if (window.sortTypes) typeOpts = window.sortTypes(typeOpts); } catch (e) { }
    wrap.innerHTML =
      '<button type="button" class="dvmbtn" aria-expanded="false" title="開発者だけの機能です。ポケモンに好きなわざを覚えさせて、ランキングに反映します（動画用）">✎ わざカスタム<b>0</b></button>' +
      '<div class="dvmpanel">' +
      '<p class="dvmnote">ポケモンに好きなわざを覚えさせて、この端末のランキングにだけ反映します（開発者だけ・ふつうの人の画面は変わりません）。<br>' +
      'わざの組み合わせはいつもどおり自動で選びます。新しいわざを作ることもできます。何匹でも足せます。</p>' +
      '<div class="dvmlab">① ポケモン</div>' +
      '<div class="sugg"><input type="search" class="dvmpk" placeholder="ポケモン名で探す" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
      '<div class="dvmcur">' +
      '<div class="dvmlab">② <span class="dvmwho"></span> に覚えさせるわざ（押すたびに足す／外す）</div>' +
      '<div class="sugg"><input type="search" class="dvmmv" placeholder="わざ名で探す" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
      '<button type="button" class="dvmsub dvmnewbtn" style="margin-top:6px">＋ 新しいわざを作る</button>' +
      '<div class="dvmnew">' +
      '<div class="dvmgrid">' +
      '<label class="w2">わざの名前<input type="text" class="f-n" maxlength="30" placeholder="例: しんわざ"></label>' +
      '<label>タイプ<select class="f-t">' + typeOpts.map(function (t) { return '<option value="' + t + '">' + esc(tja(t)) + '</option>'; }).join('') + '</select></label>' +
      '<label>種類<select class="f-k"><option value="f">ノーマル</option><option value="c">SP</option></select></label>' +
      '<label>威力<input type="text" class="f-p" inputmode="decimal" placeholder="例: 12"></label>' +
      '<label>わざ全体の時間（秒）<input type="text" class="f-d" inputmode="decimal" placeholder="例: 1.0"></label>' +
      '<label class="f-ef">ゲージ増加<input type="text" class="f-e" inputmode="decimal" placeholder="例: 8"></label>' +
      '<label class="f-ec" hidden>ゲージ<select class="f-g"><option value="-100">1本（100）</option><option value="-50">2本（50）</option><option value="-33">3本（33）</option></select></label>' +
      '</div><div class="dvmerr"></div>' +
      '<button type="button" class="dvmsub dvmgo">作って覚えさせる</button>' +
      '</div></div>' +
      '<div class="dvmlist"></div>' +
      '<div class="dvmrow"><button type="button" class="dvmclear">すべて外す</button>' +
      '<button type="button" class="dvmcopy">🔗 このリンクをコピー</button><span class="dvmmsg"></span></div>' +
      '</div>';
    host.appendChild(wrap);
    var btn = wrap.querySelector('.dvmbtn'), panel = wrap.querySelector('.dvmpanel');
    var pk = wrap.querySelector('.dvmpk'), mvIn = wrap.querySelector('.dvmmv');
    var msg = wrap.querySelector('.dvmmsg'), nw = wrap.querySelector('.dvmnew'), err = wrap.querySelector('.dvmerr');

    btn.onclick = function () {
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && !cur) pk.focus();
    };
    // ① ポケモン: 選ぶと「いま覚えさせている1匹」になる（一覧に行を足す）
    suggest(pk, pk.nextElementSibling, function (qk) {
      var all = []; try { all = (opt.names ? opt.names() : []) || []; } catch (e) { }
      var seen = {}, hit = [];
      all.forEach(function (n) { var b = norm(n); if (!b || seen[b]) return; seen[b] = 1; if (toKata(b).indexOf(qk) >= 0) hit.push(b); });
      hit.sort(function (a, b) { return (toKata(a).indexOf(qk) - toKata(b).indexOf(qk)) || a.localeCompare(b, 'ja'); });
      return hit.map(function (n) { var m = monOf(n); return '<div data-v="' + esc(n) + '"' + (m ? ' class="on"' : '') + '>' + esc(n) + (m ? '<small>わざ' + m.mv.length + '本</small>' : '') + '</div>'; });
    }, function (n) {
      if (!monOf(n)) st.mons.push({ n: norm(n), mv: [] });
      cur = norm(n); changed();
      setTimeout(function () { mvIn.focus(); }, 0);
    }, false);
    // ② わざ: 既存のわざ（全部）と作ったわざ。押すたびに足す／外す（続けて選べる）
    suggest(mvIn, mvIn.nextElementSibling, function (qk) {
      var m = monOf(cur); if (!m || !opt.moves) return [];
      var hit = [];
      Object.keys(opt.moves).forEach(function (id) {
        var x = opt.moves[id]; if (!x || !x.e) return;
        var lb = mvLabel(id);
        if (toKata(lb).indexOf(qk) >= 0) hit.push({ id: id, lb: lb, x: x });
      });
      hit.sort(function (a, b) { return (toKata(a.lb).indexOf(qk) - toKata(b.lb).indexOf(qk)) || a.lb.localeCompare(b.lb, 'ja'); });
      return hit.map(function (h) {
        var on = m.mv.indexOf(h.id) >= 0;
        return '<div data-v="' + h.id + '"' + (on ? ' class="on"' : '') + '>' + (on ? '✓ ' : '') + icon(h.x.t, 16) + esc(h.lb) +
          '<small>' + kindOf(h.x) + '・威力' + h.x.p + (h.x.dev ? '・自作' : '') + '</small></div>';
      });
    }, function (id) {
      var m = monOf(cur); if (!m) return;
      var i = m.mv.indexOf(id); if (i >= 0) m.mv.splice(i, 1); else m.mv.push(id);
      changed();
    }, true);

    // 新しいわざを作る
    var fk = wrap.querySelector('.f-k');
    wrap.querySelector('.dvmnewbtn').onclick = function () {
      nw.classList.toggle('open');
      try { var t = opt.curType && opt.curType(); if (t) wrap.querySelector('.f-t').value = t; } catch (e) { }
    };
    fk.onchange = function () { var c = fk.value === 'c'; wrap.querySelector('.f-ef').hidden = c; wrap.querySelector('.f-ec').hidden = !c; };
    wrap.querySelector('.dvmgo').onclick = function () {
      var m = monOf(cur); if (!m) return;
      var n = wrap.querySelector('.f-n').value.trim(), t = wrap.querySelector('.f-t').value, c = fk.value === 'c';
      var p = numOf(wrap.querySelector('.f-p').value), d = numOf(wrap.querySelector('.f-d').value);
      var e = c ? +wrap.querySelector('.f-g').value : numOf(wrap.querySelector('.f-e').value);
      if (!n) { err.textContent = 'わざの名前を入れてください'; return; }
      if (!(p >= 0)) { err.textContent = '威力を数字で入れてください'; return; }
      if (!(d > 0)) { err.textContent = '時間を0より大きい数字で入れてください（秒）'; return; }
      if (!c && !(e > 0)) { err.textContent = 'ゲージ増加を0より大きい数字で入れてください'; return; }
      var k = 1; st.defs.forEach(function (x) { k = Math.max(k, +x.id.slice(6) + 1); });
      var id = 'DEVMV_' + k;
      st.defs.push({ id: id, n: n, t: t, p: p, d: d, e: e });
      m.mv.push(id);
      err.textContent = ''; ['.f-n', '.f-p', '.f-d', '.f-e'].forEach(function (s) { wrap.querySelector(s).value = ''; });
      nw.classList.remove('open');
      changed();
    };
    // 一覧: ポケモン名を押すとそのポケモンに切り替え・×で外す
    wrap.querySelector('.dvmlist').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var row = b.closest('.row'), n = row && row.getAttribute('data-n');
      var m = monOf(n); if (!m) return;
      if (b.classList.contains('who')) { cur = m.n; render(); setTimeout(function () { mvIn.focus(); }, 0); return; }
      var id = b.getAttribute('data-mv');
      if (id) { m.mv = m.mv.filter(function (x) { return x !== id; }); }
      else { st.mons = st.mons.filter(function (x) { return x !== m; }); if (cur === m.n) cur = null; }
      changed();
    });
    wrap.querySelector('.dvmclear').onclick = function () { if (st.mons.length || st.defs.length) { st = clean(null); cur = null; changed(); } };
    wrap.querySelector('.dvmcopy').onclick = function () {
      var u = location.origin + location.pathname + '?devmv=' + (st.mons.length ? enc(st) : '');
      var done = function () { msg.textContent = 'コピーしました'; setTimeout(function () { msg.textContent = ''; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, function () { prompt('このリンクをコピーしてください', u); });
      else prompt('このリンクをコピーしてください', u);
    };
    mounted.push(wrap);
  }

  function render() {
    mounted.forEach(function (wrap) {
      var n = 0; st.mons.forEach(function (m) { if (m.mv.length) n++; });
      var b = wrap.querySelector('.dvmbtn b'); if (b) b.textContent = n;
      if (cur && !monOf(cur)) cur = null;
      var c = wrap.querySelector('.dvmcur'); c.classList.toggle('show', !!cur);
      wrap.querySelector('.dvmwho').textContent = cur || '';
      var list = wrap.querySelector('.dvmlist');
      list.innerHTML = st.mons.length ? st.mons.map(function (m) {
        return '<div class="row' + (m.n === cur ? ' cur' : '') + '" data-n="' + esc(m.n) + '">' +
          '<button type="button" class="who" title="このポケモンにわざを足す">' + esc(m.n) + '</button>' +
          (m.mv.length ? m.mv.map(function (id) {
            var x = mv(id);
            return '<span class="mvc' + (x && x.dev ? ' own' : '') + '">' + (x ? icon(x.t, 14) : '') + esc(mvLabel(id)) +
              '<button type="button" class="x" data-mv="' + id + '" title="このわざを外す">×</button></span>';
          }).join('') : '<em style="opacity:.6">わざをまだ選んでいません</em>') +
          '<button type="button" class="x" title="このポケモンごと外す">×</button></div>';
      }).join('') : '<em style="opacity:.6">いまは1匹もカスタムしていません</em>';
    });
  }

  window.GonaviDevMv = {
    // ⚠ 開発者の端末でなければ必ず null（ふつうの人のランキングは変わらない）
    extra: function (name) {
      if (!dev() || !st.mons.length) return null;
      var m = monOf(name); if (!m || !m.mv.length) return null;
      var q = [], c = [];
      m.mv.forEach(function (id) { var x = mv(id); if (!x) return; (x.e > 0 ? q : c).push(id); });
      return { q: q, c: c };
    },
    sig: function () { return dev() && st.mons.length ? JSON.stringify(st) : ''; },
    on: function (fn) { if (typeof fn === 'function') subs.push(fn); },
    // host=ボタンの置き場所 ／ o={names, moves, typeJa, curType}
    // ⚠ 開発者かどうかは home.js の GonaviDev() で決まるので、**読み込みが終わってから**置く
    mount: function (host, o) {
      if (!host || !o) return;
      var go = function () {
        if (!dev()) return;
        opt = o; inject();
        build(host); render();
        if (st.mons.length) setTimeout(function () { subs.forEach(function (f) { try { f(); } catch (e) { } }); }, 0);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
    }
  };
})();
