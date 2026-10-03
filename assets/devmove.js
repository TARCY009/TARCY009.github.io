/* 開発者だけの「✎ わざカスタム」（2026-09-27タダシさん指示・まずタイプ別火力ランキング）

   ポケモンを選んで、覚えていないわざ（既存のどのわざでも・自分で作った新しいわざでも）を覚えさせ、
   ランキングに反映する。動画で「このわざを覚えたら何位？」「新わざが来たら？」を見せるため。
   **覚えるわざに足すだけ**＝わざの組み合わせはツールがいつもどおり選ぶ（計算はツールと同じ）。

   ⚠ 開発者の端末だけ（home.js の GonaviDev()）。ふつうの人にはボタンも出ないし、extra() は常に null。
   ⚠ 何匹でも足せる（ポケモンごとに1行）。同じポケモンにわざを何本でも足せる。
   ⚠ リンクで渡せる: 「🔗 このリンクをコピー」で ?devmv=... を作る（開いた端末に覚えさせて住所からすぐ消す）。
      ?devmv= だけ（空）で全部外す。
   ⚠ 名前は「シャドウ」を外して比べ、通常とシャドウは「シャドウ」ボタンで分ける（sh。2026-10-03から・以前の保存は通常として読む）。

   使い方（ページ側）:
     1) <head> に <script src="/assets/devmove.js"></script>（devex.js・devadd.js の直後・ページ本体より先）
     2) データを読んだら GonaviDevMv.mount(置き場所, {names:()=>名前の一覧, moves:わざの表(D.moves), typeJa:D.typeJa, curType:()=>いまのタイプ,
                                        learn:名前=>{q:[覚えるノーマル], c:[覚えるSP]}（省略可・わざの欄の「覚えるわざ」に使う）})
        （作ったわざは moves に DEVMV_… の番号で書き込まれる＝名前・タイプ・威力はほかのわざと同じに引ける）
     3) わざ構成を決めるところで  const x=GonaviDevMv.extra(名前)  → {q:[ノーマルのID], c:[SPのID]} か null
     4) 作り直しの合図 GonaviDevMv.on(()=>描き直す)・キャッシュの鍵に GonaviDevMv.sig()
   保存キーは site_devmv（開発者だけの設定なので「データの引っ越し」からは外してある）。 */
(function () {
  'use strict';
  var KEY = 'site_devmv';
  var st = { defs: [], mons: [] }, subs = [], mounted = [], cssDone = false, opt = null;

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
      var n = norm(m.n), sh = m.sh ? 1 : 0;
      if (!n || o.mons.some(function (x) { return x.n === n && x.sh === sh; })) return;
      o.mons.push({ n: n, sh: sh, mv: (Array.isArray(m.mv) ? m.mv : []).filter(function (x) { return typeof x === 'string'; }) });
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
  // sh: 通常(0)とシャドウ(1)は別の行（2026-10-03タダシさん指示でシャドウを選べるようにした）
  function monOf(n, sh) { n = norm(n); sh = sh ? 1 : 0; for (var i = 0; i < st.mons.length; i++) if (st.mons[i].n === n && st.mons[i].sh === sh) return st.mons[i]; return null; }
  function anyOf(n) { return monOf(n, 0) || monOf(n, 1); }
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
      '.dvmsel{margin-top:8px}',
      '.dvmsel .sugg{display:block}',
      '.dvmsel .sugg-list{font-size:.8rem;font-weight:600;color:#ffe9c7}',
      '.dvmsel .sugg-list{min-width:250px}',
      '.dvmsel label:last-child .sugg-list{left:auto;right:0}',
      '.dvmsel .sugg-list>div{white-space:nowrap}',
      '.dvmpkrow{display:flex;gap:6px;align-items:stretch}',
      '.dvmpkrow .sugg{flex:1 1 auto}',
      '.dvmsh{font:inherit;font-size:.74rem;font-weight:800;cursor:pointer;border-radius:9px;white-space:nowrap;',
      '  border:1px solid #8a5cd6;background:rgba(0,0,0,.28);color:#d9c2ff;padding:0 11px}',
      '.dvmsh[aria-pressed="true"]{background:linear-gradient(160deg,#d9b8ff,#9b5cf0 55%,#6a2fc0);color:#fff;border-color:transparent}',
      '.dvmsh .shadowmark,.dvmlist .who .shadowmark{margin-right:3px;color:#c79bff}',
      '.dvmsh[aria-pressed="true"] .shadowmark{color:#fff}',
      '.dvmapply{display:block;width:100%;font-size:.8rem!important;padding:8px 10px!important;margin-top:9px}',
      '.dvmnew{display:none;margin-top:7px;border:1px dashed #b7791f;border-radius:10px;padding:8px}',
      '.dvmnew.open{display:block}',
      '.dvmgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '.dvmgrid label{display:flex;flex-direction:column;font-size:.68rem;font-weight:700;color:#e6c790;gap:2px}',
      '.dvmgrid label.w2{grid-column:1/-1}',
      '.dvmgrid label[hidden]{display:none}',
      '.dvmerr{color:#ffb4a8;font-size:.7rem;margin-top:4px;min-height:1em}',
      '.dvmlist{margin:9px 0 0;display:flex;flex-direction:column;gap:5px}',
      '.dvmlist .row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;background:rgba(255,182,61,.10);border:1px solid #7a5415;border-radius:10px;padding:5px 6px}',
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

  // ---- 画面（2026-10-03タダシさん指示で作り直し: GBLシミュレーターと同じく「ポケモン名・ノーマルアタック・SPアタック」の3つの欄。
  //      入れた中身は消さずに残し、「ランキングに反映」を押したときだけ反映する。反映したポケモンは下の一覧に何匹でも並ぶ） ----
  function moveIds(kind) {   // kind: 'f'=ノーマル / 'c'=SP
    var out = [];
    Object.keys((opt && opt.moves) || {}).forEach(function (id) {
      var x = opt.moves[id]; if (!x || !x.e) return;
      // ⚠ 名前が番号のままのわざ（データ元の古い＋わざの番号など）は出さない（2026-10-03タダシさん指摘「謎の番号」）
      if (!/[ぁ-んァ-ヶ一-龥]/.test(mvLabel(id))) return;
      if ((x.e > 0) === (kind === 'f')) out.push(id);
    });
    out.sort(function (a, b) { return mvLabel(a).localeCompare(mvLabel(b), 'ja'); });
    return out;
  }
  function learnOf(n) { try { return (opt.learn && opt.learn(n)) || null; } catch (e) { return null; } }


  function build(host) {
    css();
    var wrap = document.createElement('div');
    wrap.className = 'dvmwrap';
    var typeOpts = Object.keys((opt && opt.typeJa) || {});
    try { if (window.sortTypes) typeOpts = window.sortTypes(typeOpts); } catch (e) { }
    wrap.innerHTML =
      '<button type="button" class="dvmbtn" aria-expanded="false" title="開発者だけの機能です。ポケモンに好きなわざを覚えさせて、ランキングに反映します（動画用）">✎ わざカスタム<b>0</b></button>' +
      '<div class="dvmpanel">' +
      '<p class="dvmnote">ポケモンに好きなわざを覚えさせて、この端末のランキングにだけ反映します（開発者だけ・ふつうの人の画面は変わりません）。' +
      '選んだわざは覚えるわざに足され、組み合わせはいつもどおり自動で選びます。</p>' +
      '<div class="dvmlab">ポケモン</div>' +
      '<div class="dvmpkrow"><div class="sugg"><input type="text" class="dvmpk" placeholder="ポケモン名で探す" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
      '<button type="button" class="dvmsh" aria-pressed="false" title="シャドウとして反映します（シャドウがまだ無いポケモンでもシャドウの行が増えます。ランキングのシャドウを点けているときに出ます）"><i class="shadowmark"></i>シャドウ</button></div>' +
      '<div class="dvmgrid dvmsel">' +
      '<label>ノーマルアタック<span class="sugg"><input type="text" class="s-f" placeholder="わざ名で探す" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="sugg-list"></span></span></label>' +
      '<label>SPアタック<span class="sugg"><input type="text" class="s-c" placeholder="わざ名で探す" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="sugg-list"></span></span></label>' +
      '</div>' +
      '<div class="dvmnew">' +
      '<div class="dvmlab dvmnewttl">新しいわざを作る</div>' +
      '<div class="dvmgrid">' +
      '<label class="w2">わざの名前<input type="text" class="f-n" maxlength="30" placeholder="例: しんわざ"></label>' +
      '<label>タイプ<select class="f-t">' + typeOpts.map(function (t) { return '<option value="' + t + '">' + esc(tja(t)) + '</option>'; }).join('') + '</select></label>' +
      '<label>威力<input type="text" class="f-p" inputmode="decimal" placeholder="例: 12"></label>' +
      '<label>わざ全体の時間（秒）<input type="text" class="f-d" inputmode="decimal" placeholder="例: 1.0"></label>' +
      '<label class="f-ef">ゲージ増加<input type="text" class="f-e" inputmode="decimal" placeholder="例: 8"></label>' +
      '<label class="f-ec" hidden>ゲージ<select class="f-g"><option value="-100">1本（100）</option><option value="-50">2本（50）</option><option value="-33">3本（33）</option></select></label>' +
      '</div><div class="dvmerr dvmnerr"></div>' +
      '<div class="dvmrow" style="margin-top:4px"><button type="button" class="dvmsub dvmgo">作ってこの欄に入れる</button><button type="button" class="dvmsub dvmnewx">やめる</button></div>' +
      '</div>' +
      '<div class="dvmerr dvmferr"></div>' +
      '<button type="button" class="dvmsub dvmgo dvmapply">ランキングに反映</button>' +
      '<div class="dvmlist"></div>' +
      '<div class="dvmrow"><button type="button" class="dvmclear">すべて外す</button>' +
      '<button type="button" class="dvmcopy">🔗 このリンクをコピー</button><span class="dvmmsg"></span></div>' +
      '</div>';
    host.appendChild(wrap);
    var btn = wrap.querySelector('.dvmbtn'), panel = wrap.querySelector('.dvmpanel');
    var pk = wrap.querySelector('.dvmpk'), ul = pk.nextElementSibling;
    var sf = wrap.querySelector('.s-f'), sc = wrap.querySelector('.s-c');   // わざの入力欄（選んだIDは dataset.id）
    var msg = wrap.querySelector('.dvmmsg'), nw = wrap.querySelector('.dvmnew'), nerr = wrap.querySelector('.dvmnerr'), ferr = wrap.querySelector('.dvmferr');
    var picked = '', newKind = 'f', shOn = false, shBtn = wrap.querySelector('.dvmsh');
    function syncSh() { shBtn.setAttribute('aria-pressed', shOn ? 'true' : 'false'); }
    shBtn.onclick = function () {
      shOn = !shOn; syncSh(); ferr.textContent = '';
      var m = picked && monOf(picked, shOn); if (m) loadMv(m);   // そちらの行があれば中身を出す。無ければ欄はそのまま
    };

    btn.onclick = function () {
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && !picked) pk.focus();
    };

    // わざの欄（2026-10-03タダシさん指示で、選ぶだけでなく打って探せる欄に）: 選んだわざのIDは dataset.id に持つ。
    // 候補は そのポケモンが覚えるわざ → その他のわざ（自作を含む）→「＋ 新しいわざを作る…」。空にすると「足さない」
    function idOf(inp) { return inp.dataset.id || ''; }
    function setMv(inp, id) {
      id = id && mv(id) ? id : '';
      inp.dataset.id = id;
      var x = mv(id);
      inp.value = id ? mvLabel(id) + (x && x.dev ? '（自作）' : '') : '';
    }
    function fillBoth(f, c) { setMv(sf, f); setMv(sc, c); }
    function mvRows(inp, kind) {
      var q = toKata(inp.value.trim()), cur = idOf(inp);
      if (cur && inp.value === mvLabel(cur) + (mv(cur) && mv(cur).dev ? '（自作）' : '')) q = '';   // 選んだままなら全部見せる
      var lr = learnOf(picked), mine = lr ? (kind === 'f' ? lr.q : lr.c) || [] : [];
      var all = moveIds(kind), hit = all.filter(function (id) { return !q || toKata(mvLabel(id)).indexOf(q) >= 0; });
      hit.sort(function (a, b) {
        return ((mine.indexOf(a) >= 0 ? 0 : 1) - (mine.indexOf(b) >= 0 ? 0 : 1)) ||
          (q ? toKata(mvLabel(a)).indexOf(q) - toKata(mvLabel(b)).indexOf(q) : 0) || mvLabel(a).localeCompare(mvLabel(b), 'ja');
      });
      return hit.slice(0, 80).map(function (id) {
        var x = mv(id), own = mine.indexOf(id) >= 0;
        return '<div data-v="' + id + '"' + (id === cur ? ' class="on"' : '') + '>' + icon(x.t, 16) + esc(mvLabel(id)) +
          '<small>' + (x.dev ? '自作・' : own ? '覚える・' : '') + '威力' + x.p + '</small></div>';
      }).concat(['<div data-v="__new">＋ 新しいわざを作る…</div>']);
    }
    function openNew(kind) {
      newKind = kind;
      nw.classList.add('open');
      wrap.querySelector('.dvmnewttl').textContent = '新しい' + (kind === 'f' ? 'ノーマルアタック' : 'SPアタック') + 'を作る';
      wrap.querySelector('.f-ef').hidden = kind !== 'f'; wrap.querySelector('.f-ec').hidden = kind === 'f';
      try { var t = opt.curType && opt.curType(); if (t) wrap.querySelector('.f-t').value = t; } catch (e) { }
      var n = wrap.querySelector('.f-n'), typed = (kind === 'f' ? sf : sc).value.trim();
      if (typed && !idOf(kind === 'f' ? sf : sc)) n.value = typed;   // 打った名前が見つからなければ、その名前で作れるように
      nerr.textContent = '';
    }
    [[sf, 'f'], [sc, 'c']].forEach(function (a) {
      var inp = a[0], kind = a[1], list = inp.nextElementSibling;
      function show() {
        list.innerHTML = mvRows(inp, kind).join('');
        // ⚠ 共通の守り(home.js の suggGuard)が書いた display:none を消す
        list.style.display = '';
        list.classList.add('open');
      }
      function close() { list.classList.remove('open'); list.innerHTML = ''; }
      inp.addEventListener('input', show);
      inp.addEventListener('focus', show);
      list.addEventListener('mousedown', function (e) { e.preventDefault(); });
      list.addEventListener('click', function (e) {
        e.preventDefault();   // ⚠ 外側の label が入力欄へフォーカスを戻して一覧が開き直すのを止める
        var d = e.target.closest('div[data-v]'); if (!d) return;
        var v = d.getAttribute('data-v');
        close();
        if (v === '__new') { openNew(kind); setMv(inp, idOf(inp)); return; }
        setMv(inp, v); ferr.textContent = ''; inp.blur();
      });
      // 選ばずに離れたら: 空なら「足さない」、それ以外は選んでいたわざに戻す
      inp.addEventListener('blur', function () {
        setTimeout(function () {
          if (document.activeElement === inp) return;
          close();
          if (!inp.value.trim()) inp.dataset.id = ''; else setMv(inp, idOf(inp));
        }, 220);
      });
    });

    // ポケモン名: 候補から選ぶと欄に名前が残る。選ばずに離れたら、選んでいた名前に戻す
    function pickRows(qk) {
      var all = []; try { all = (opt.names ? opt.names() : []) || []; } catch (e) { }
      var seen = {}, hit = [];
      all.forEach(function (n) { var b = norm(n); if (!b || seen[b]) return; seen[b] = 1; if (toKata(b).indexOf(qk) >= 0) hit.push(b); });
      hit.sort(function (a, b) { return (toKata(a).indexOf(qk) - toKata(b).indexOf(qk)) || a.localeCompare(b, 'ja'); });
      return hit.slice(0, 60).map(function (n) { var m = anyOf(n); return '<div data-v="' + esc(n) + '"' + (m ? ' class="on"' : '') + '>' + esc(n) + (m ? '<small>反映中</small>' : '') + '</div>'; });
    }
    function showSugg() {
      var q = pk.value.trim();
      if (!q || q === picked) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      var rows = pickRows(toKata(q));
      ul.innerHTML = rows.length ? rows.join('') : '<div class="dup">見つかりません</div>';
      // ⚠ 共通の守り(home.js の suggGuard)が書いた display:none を消す（残ると2回目から候補が出ない・devex.js と同じ）
      ul.style.display = '';
      ul.classList.add('open');
    }
    function loadMv(m) {
      var ex = { f: '', c: '' };
      if (m) m.mv.forEach(function (id) { var x = mv(id); if (!x) return; if (x.e > 0) { if (!ex.f) ex.f = id; } else if (!ex.c) ex.c = id; });
      fillBoth(ex.f, ex.c);
    }
    function setPicked(n, sh) {
      picked = n; pk.value = n; ul.classList.remove('open'); ul.innerHTML = '';
      if (sh != null) { shOn = !!sh; syncSh(); }
      loadMv(monOf(n, shOn));
      ferr.textContent = '';
    }
    pk.addEventListener('input', showSugg);
    pk.addEventListener('focus', showSugg);
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });   // 入力欄のフォーカスを外さない
    ul.addEventListener('click', function (e) {
      var d = e.target.closest('div[data-v]'); if (!d) return;
      setPicked(d.getAttribute('data-v'));
      pk.blur();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!ul.classList.contains('open') || e.target.closest('.sugg') === pk.parentNode) return;
      pk.value = picked; ul.classList.remove('open'); ul.innerHTML = '';
    }, true);
    pk.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== pk && !ul.classList.contains('open')) pk.value = picked; }, 250); });

    // 新しいわざを作る（作ったわざは欄に入るだけ。反映は「ランキングに反映」で）
    wrap.querySelector('.dvmnewx').onclick = function () { nw.classList.remove('open'); };
    wrap.querySelector('.dvmnew .dvmgo').onclick = function () {
      var n = wrap.querySelector('.f-n').value.trim(), t = wrap.querySelector('.f-t').value, c = newKind === 'c';
      var p = numOf(wrap.querySelector('.f-p').value), d = numOf(wrap.querySelector('.f-d').value);
      var e = c ? +wrap.querySelector('.f-g').value : numOf(wrap.querySelector('.f-e').value);
      if (!n) { nerr.textContent = 'わざの名前を入れてください'; return; }
      if (!(p >= 0)) { nerr.textContent = '威力を数字で入れてください'; return; }
      if (!(d > 0)) { nerr.textContent = '時間を0より大きい数字で入れてください（秒）'; return; }
      if (!c && !(e > 0)) { nerr.textContent = 'ゲージ増加を0より大きい数字で入れてください'; return; }
      var k = 1; st.defs.forEach(function (x) { k = Math.max(k, +x.id.slice(6) + 1); });
      var id = 'DEVMV_' + k;
      st.defs.push({ id: id, n: n, t: t, p: p, d: d, e: e });
      inject();
      nerr.textContent = ''; ['.f-n', '.f-p', '.f-d', '.f-e'].forEach(function (s) { wrap.querySelector(s).value = ''; });
      nw.classList.remove('open');
      if (c) fillBoth(idOf(sf), id); else fillBoth(id, idOf(sc));
    };

    // ランキングに反映: そのポケモンの1行を作る（同じポケモンなら置きかえる）。欄の中身はそのまま残す
    wrap.querySelector('.dvmapply').onclick = function () {
      if (!picked) { ferr.textContent = 'ポケモンを選んでください'; pk.focus(); return; }
      var ids = [idOf(sf), idOf(sc)].filter(function (id) { return id && mv(id); });
      if (!ids.length) { ferr.textContent = 'ノーマルアタックかSPアタックを選んでください'; return; }
      ferr.textContent = '';
      var m = monOf(picked, shOn);
      if (m) m.mv = ids; else st.mons.push({ n: picked, sh: shOn ? 1 : 0, mv: ids });
      changed();
      msg.textContent = '反映しました'; setTimeout(function () { msg.textContent = ''; }, 1600);
    };
    // 一覧: ポケモン名を押すと欄に戻す・×で外す
    wrap.querySelector('.dvmlist').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var row = b.closest('.row'), n = row && row.getAttribute('data-n');
      var m = monOf(n, row && row.getAttribute('data-sh') === '1'); if (!m) return;
      if (b.classList.contains('who')) { setPicked(m.n, m.sh); return; }
      var id = b.getAttribute('data-mv');
      if (id) { m.mv = m.mv.filter(function (x) { return x !== id; }); if (!m.mv.length) st.mons = st.mons.filter(function (x) { return x !== m; }); }
      else st.mons = st.mons.filter(function (x) { return x !== m; });
      changed();
    });
    wrap.querySelector('.dvmclear').onclick = function () { if (st.mons.length || st.defs.length) { st = clean(null); changed(); } };
    wrap.querySelector('.dvmcopy').onclick = function () {
      var u = location.origin + location.pathname + '?devmv=' + (st.mons.length ? enc(st) : '');
      var done = function () { msg.textContent = 'コピーしました'; setTimeout(function () { msg.textContent = ''; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, function () { prompt('このリンクをコピーしてください', u); });
      else prompt('このリンクをコピーしてください', u);
    };
    fillBoth('', '');
    wrap._refill = function () { fillBoth(idOf(sf), idOf(sc)); };
    mounted.push(wrap);
  }

  function render() {
    mounted.forEach(function (wrap) {
      var n = 0; st.mons.forEach(function (m) { if (m.mv.length) n++; });
      var b = wrap.querySelector('.dvmbtn b'); if (b) b.textContent = n;
      if (wrap._refill) wrap._refill();   // 自作わざが片づいたら欄からも消す
      var list = wrap.querySelector('.dvmlist');
      list.innerHTML = st.mons.length ? '<div class="dvmlab">反映中</div>' + st.mons.map(function (m) {
        return '<div class="row" data-n="' + esc(m.n) + '" data-sh="' + (m.sh ? 1 : 0) + '">' +
          '<button type="button" class="who" title="このポケモンを上の欄に戻す">' + (m.sh ? '<i class="shadowmark"></i>' : '') + esc(m.n) + '</button>' +
          m.mv.map(function (id) {
            var x = mv(id);
            return '<span class="mvc' + (x && x.dev ? ' own' : '') + '">' + (x ? icon(x.t, 14) : '') + esc(mvLabel(id)) +
              '<button type="button" class="x" data-mv="' + id + '" title="このわざを外す">×</button></span>';
          }).join('') +
          '<button type="button" class="x" title="このポケモンごと外す">×</button></div>';
      }).join('') : '';
    });
  }

  window.GonaviDevMv = {
    // ⚠ 開発者の端末でなければ必ず null（ふつうの人のランキングは変わらない）
    // shadow=true ならシャドウの行のぶん（通常とシャドウは別々に覚えさせる）
    extra: function (name, shadow) {
      if (!dev() || !st.mons.length) return null;
      var m = monOf(name, shadow); if (!m || !m.mv.length) return null;
      var q = [], c = [];
      m.mv.forEach(function (id) { var x = mv(id); if (!x) return; (x.e > 0 ? q : c).push(id); });
      return { q: q, c: c };
    },
    // シャドウとして反映したポケモンか（シャドウが未実装でもシャドウの行を作るため）
    hasShadow: function (name) { if (!dev() || !st.mons.length) return false; var m = monOf(name, 1); return !!(m && m.mv.length); },
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
