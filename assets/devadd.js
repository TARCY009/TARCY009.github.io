/* 開発者だけの「未実装のポケモンを一覧に足す」（2026-09-24タダシさん指示）

   ランキングには実装済みのポケモンしか出さない（build_data.py が未実装を外している）。
   ただ動画で「近々登場するポケモンがどのくらい強いか」を見せたいので、
   **開発者の端末だけ、指定した未実装ポケモンを1匹ずつ足せる**ようにする。devex.js（外す）の逆。

   データ: 未実装ポケモンは毎朝の自動更新で別ファイルに書き出してある（ふつうの人は読まない）
     /pokedex/unreleased.json              … ジム・レイド側の性能（godata.json と同じ形）
     /gym-attack/data/gym_unreleased.json  … ジム挑戦の形（build_gym.py が同じ変換で作る）
     /gym-defense/data/defense_unreleased.json … ジム防衛の点数（build_defense.py が同じ計算で作る）
   ⚠ 計算はツールと同じ（ページ側は一覧に足すだけで、数字を別に作らない）。

   ⚠ 開発者の端末だけ（home.js の GonaviDev()）。ふつうの人にはボタンも出ないし、データも読まない。
   ⚠ リンクで渡せる: ?devadd=テツノツツミ,コライドン（開いた端末に覚えさせて住所からすぐ消す）。
      ?devadd= だけ（空）で全部外す。
   ⚠ 名前はツールごとに書き方が違う（全角・半角の括弧、「ガラル◯◯」と「◯◯(ガラル)」）ので、
      そろえてから比べる（canon）。1か所で足せば全ツールで同じポケモンが入る。

   使い方（ページ側）:
     1) <head> に <script src="/assets/devadd.js"></script>（devex.js の直後・ページ本体より先）
     2) データを読み込んだあとで
        GonaviDevAdd.mount(置き場所, 'データのURL', (data, on) => {
          … data のうち on(名前) が true のものを一覧に足し、false のものを外す
          … キャッシュを捨てて描き直す
        }, { shadowNames: () => 実装済みでシャドウが無いポケモンの名前 });   ← 4つ目は省略可
   ⚠ shadowNames を渡したページだけ「シャドウ」ボタンが出る（2026-10-03タダシさん指示・タイプ別火力とレイド火力）。
      押すと、実装済みでシャドウがまだ無いポケモンを「シャドウ◯◯」として足せる。ページ側は apply の中で
      on('シャドウ' + 名前) を見て、そのポケモンにシャドウの行を足す（計算はツールのシャドウと同じ）。
   ⚠ 4つ目に modes を渡したページだけ「ダイマックス｜キョダイマックス」のボタンが出る（2026-10-08タダシさん指示・マックスバトル タイプ別）。
      足したときに点いていたボタンを名前ごとに覚え（site_devadd_mode）、ページは GonaviDevAdd.modeOf(名前)（'D'・'G'・'DG'）で見る。
      allow(名前, 'D'|'G') を渡すと、その形で足せない候補を薄くする。リンクでは「名前~G」の形で渡る。
   ⚠ 4つ目に megaPlus を渡したページだけ「メガの新しい＋わざ」の欄が出る（2026-10-10タダシさん指示・レイド火力とタイプ別火力）。
      スーパーマックスレベル解禁と同時に発表される＋わざを、公式の威力だけで先に足す。
      ＋わざの時間（全体・ダメージ発生・判定終了）は元のわざと同じ・ゲージは1本（これまでの＋わざがすべてそう）・タイプも元のわざ。
      威力はメガLv1の値（公式発表の値）で、メガLvの倍率はページ側の MegaLv.apply がいつもどおり掛ける。
      ページ側: apply の中で GonaviDevAdd.plusSync(D.moves, PLUS_IDS) → MegaLv.apply(D.moves, PLUS_IDS)、
      わざの候補を作るところで GonaviDevAdd.plusFor(名前)（わざIDの配列・開発者でなければ常に空）。
      保存キーは site_devadd_plus・リンクは ?devplus=名前~元のわざID~威力,…（空で全部外す）。
   ⚠ 同じ欄の「新しいメガを作る」（2026-10-10タダシさん指示）: データにまだ無いメガ（例: メガヒードラン）を、元のポケモン・タイプ・種族値から作る。
      わざは元のポケモンのものを引き継ぐ。種族値は「原作（ゲーム機版）の6つ」か「GOの3つ」で入れる。
      原作からGOへの変換はいまのデータで確かめた式（メガ・ゲンシ62匹すべて一致・2026-10-10）:
        攻撃=round(round(2×(7/8×高い方+1/8×低い方))×素早さ補正)・防御=同じく5/8と3/8・HP=floor(1.75×HP+50)・素早さ補正=1+(素早さ−75)/500
        ふつうのメガは補正なし（CPが4000を超えても）。元のポケモンが弱体化（PL40で4000超え→×0.91）されているメガだけ×0.97（このときは3つとも round）
      番号は「元の番号_MEGA」（名前の最後が X／Y なら _MEGA_X／_MEGA_Y）。データに同じ番号があれば作らない（本物が入ったらそちらが優先）。
      ページ側: apply の最初で GonaviDevAdd.megaSync(D.pokemon, KEYS)（外したメガは一覧 KEYS から外すだけ・D.pokemon には残す＝ボスや登録欄で選んでいても壊れない）。
      保存キーは site_devadd_mega・リンクは ?devmega=名前~元の番号~タイプ1/タイプ2~ms|go~数値.数値…~0|1
   保存キーは site_devadd（開発者だけの設定なので「データの引っ越し」からは外してある）。 */
(function () {
  'use strict';
  var KEY = 'site_devadd', MKEY = 'site_devadd_mode', PKEY = 'site_devadd_plus', GKEY = 'site_devadd_mega';
  var list = [], mounted = [], cssDone = false, cache = {}, modes = {}, plus = [], megas = [];
  // 弱体化（PL40のCPが4000超え→種族値×0.91）されているポケモン。メガにすると×0.97になる。
  // 原作の種族値からの変換といまのデータを突き合わせて確かめた一覧（2026-10-10・PL40で4000を超えるものと完全に一致。メルメタルは攻撃・防御は×0.91どおりでHPだけ4高い）
  var NERFED = ['BAXCALIBUR', 'BUZZWOLE', 'DIALGA', 'DIALGA_ORIGIN', 'ETERNATUS', 'GIRATINA_ORIGIN', 'GROUDON', 'HOOPA_UNBOUND',
    'HO_OH', 'KARTANA', 'KYOGRE', 'KYUREM', 'KYUREM_BLACK', 'KYUREM_WHITE', 'LUNALA', 'MELMETAL', 'MEWTWO', 'PALKIA', 'PALKIA_ORIGIN',
    'RAYQUAZA', 'REGIGIGAS', 'RESHIRAM', 'SLAKING', 'SOLGALEO', 'XERNEAS', 'YVELTAL', 'ZEKROM', 'ZYGARDE_COMPLETE'];
  var REGION = ['ガラル', 'アローラ', 'ヒスイ', 'パルデア'];

  function dev() { try { return !!(window.GonaviDev && window.GonaviDev()); } catch (e) { return false; } }
  function toKata(s) { return String(s).replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }
  // 比べるための名前: 括弧は半角・地方の頭は後ろの (地方) へ（build_gym.py の norm と同じ）
  function canon(s) {
    s = String(s == null ? '' : s).trim().replace(/（/g, '(').replace(/）/g, ')');
    for (var i = 0; i < REGION.length; i++) {
      if (s.indexOf(REGION[i]) === 0 && s.length > REGION[i].length) { s = s.slice(REGION[i].length) + '(' + REGION[i] + ')'; break; }
    }
    return s;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      list = Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x; }) : [];
    } catch (e) { list = []; }
    try { var w = JSON.parse(localStorage.getItem(MKEY) || '{}'); modes = w && typeof w === 'object' ? w : {}; } catch (e) { modes = {}; }
    try {
      var x = JSON.parse(localStorage.getItem(PKEY) || '[]');
      plus = Array.isArray(x) ? x.filter(okPlus) : [];
    } catch (e) { plus = []; }
    try {
      var g = JSON.parse(localStorage.getItem(GKEY) || '[]');
      megas = Array.isArray(g) ? g.filter(okMega) : [];
    } catch (e) { megas = []; }
  }
  // メガの新しい＋わざ: {n:メガの名前, b:元のわざID, p:威力(メガLv1)}
  function okPlus(x) { return x && typeof x.n === 'string' && x.n && typeof x.b === 'string' && /^[A-Z0-9_]+$/.test(x.b) && +x.p > 0 && +x.p < 10000; }
  function plusId(x) { return 'DEVPLUS_' + x.b + '_' + Math.round(x.p * 10); }
  function savePlus() { try { localStorage.setItem(PKEY, JSON.stringify(plus)); } catch (e) { } }
  // 新しいメガ: {n:名前, b:元の番号, ty:[タイプ], src:'ms'(原作6つ)|'go'(GO3つ), v:[数値], nf:0|1(×0.97)}
  function okMega(x) {
    return x && typeof x.n === 'string' && x.n && typeof x.b === 'string' && /^[A-Z0-9_]+$/.test(x.b) &&
      Array.isArray(x.ty) && x.ty.length >= 1 && x.ty.length <= 2 && x.ty.every(function (t) { return /^[A-Z]+$/.test(t); }) &&
      (x.src === 'ms' || x.src === 'go') && Array.isArray(x.v) && x.v.length === (x.src === 'ms' ? 6 : 3) &&
      x.v.every(function (n) { return +n > 0 && +n < 1000; });
  }
  function saveMega() { try { localStorage.setItem(GKEY, JSON.stringify(megas)); } catch (e) { } }
  function rnd(x) { return Math.floor(x + 0.5); }
  // 原作の6つ [HP, 攻撃, 防御, 特攻, 特防, 素早さ] → GOの [攻撃, 防御, HP]
  function goStats(v, nf) {
    var hp = v[0], at = v[1], df = v[2], sa = v[3], sd = v[4], spd = v[5];
    var sp = 1 + (spd - 75) / 500, k = nf ? 0.97 : 1;
    var a = rnd(rnd(2 * (7 / 8 * Math.max(at, sa) + 1 / 8 * Math.min(at, sa))) * sp * k);
    var d = rnd(rnd(2 * (5 / 8 * Math.max(df, sd) + 3 / 8 * Math.min(df, sd))) * sp * k);
    var h = nf ? rnd((1.75 * hp + 50) * k) : Math.floor(1.75 * hp + 50);
    return [a, d, h];
  }
  function statsOf(x) { return x.src === 'ms' ? goStats(x.v.map(Number), x.nf) : x.v.map(Number); }
  function megaKey(x) {
    var m = String(x.n).match(/([XYＸＹ])$/);
    return x.b + '_MEGA' + (m ? '_' + (m[1] === 'Ｘ' ? 'X' : m[1] === 'Ｙ' ? 'Y' : m[1]) : '');
  }
  function num(s) {
    return parseFloat(String(s).replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }));
  }
  function save() {
    try {
      // 外した名前の形は捨てる
      var keep = {}; list.forEach(function (n) { var c = canon(n); if (modes[c]) keep[c] = modes[c]; }); modes = keep;
      localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(MKEY, JSON.stringify(modes));
    } catch (e) { }
  }
  function has(n) { var c = canon(n); for (var i = 0; i < list.length; i++) if (canon(list[i]) === c) return true; return false; }

  // ---- リンクで受け取る。⚠ location.search だけで見ない（住所を書き直すページがあるため・?dev=1 と同じ） ----
  function fromUrlMega() {
    var v = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('devmega')) v = q.get('devmega');
      if (v == null) {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.name) {
          var q2 = new URLSearchParams(new URL(nav.name, location.href).search);
          if (q2.has('devmega')) v = q2.get('devmega');
        }
      }
    } catch (e) { }
    if (v == null) return;
    megas = v.split(',').map(function (s) {
      var a = s.split('~');
      return { n: (a[0] || '').trim(), b: (a[1] || '').trim(), ty: (a[2] || '').split('/').filter(Boolean),
        src: a[3], v: (a[4] || '').split('.').map(Number), nf: a[5] === '1' ? 1 : 0 };
    }).filter(okMega);
    saveMega();
    try {
      var u = new URL(location.href);
      u.searchParams.delete('devmega');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { }
  }
  function fromUrlPlus() {
    var v = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('devplus')) v = q.get('devplus');
      if (v == null) {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.name) {
          var q2 = new URLSearchParams(new URL(nav.name, location.href).search);
          if (q2.has('devplus')) v = q2.get('devplus');
        }
      }
    } catch (e) { }
    if (v == null) return;
    plus = v.split(',').map(function (s) {
      var a = s.split('~'); return { n: (a[0] || '').trim(), b: (a[1] || '').trim(), p: +a[2] };
    }).filter(okPlus);
    savePlus();
    try {
      var u = new URL(location.href);
      u.searchParams.delete('devplus');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { }
  }
  function fromUrl() {
    var v = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('devadd')) v = q.get('devadd');
      if (v == null) {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.name) {
          var q2 = new URLSearchParams(new URL(nav.name, location.href).search);
          if (q2.has('devadd')) v = q2.get('devadd');
        }
      }
    } catch (e) { }
    if (v == null) return;
    var seen = {};
    modes = {};
    list = v.split(',').map(function (s) {
      // 「名前~G」＝形つき（マックスバトル）
      s = s.trim(); var i = s.lastIndexOf('~');
      if (i > 0) { var mk = s.slice(i + 1); s = s.slice(0, i).trim(); if (/^(D|G|DG)$/.test(mk)) modes[canon(s)] = mk; }
      return s;
    }).filter(function (s) {
      var c = canon(s); if (!s || seen[c]) return false; seen[c] = 1; return true;
    });
    save();
    try {
      var u = new URL(location.href);
      u.searchParams.delete('devadd');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { }
  }

  load(); fromUrl(); fromUrlPlus(); fromUrlMega();

  // データの中の名前（形はファイルごとに違う）
  function namesOf(data) {
    if (!data) return [];
    if (Array.isArray(data.entries)) return data.entries.map(function (e) { return e.n; });
    if (Array.isArray(data.pokemon)) return data.pokemon.map(function (p) { return p.name; });
    if (data.pokemon) return Object.keys(data.pokemon).map(function (k) { return data.pokemon[k].n; });
    return [];
  }
  function fetchData(url) {
    if (!cache[url]) cache[url] = fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status); return r.json();
    });
    return cache[url];
  }

  // ---- 見た目（開発者だけが見る。除外の紫と分けて青緑。ほかのツールのCSSに触らない） ----
  function css() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style');
    s.textContent = [
      '.dvawrap{margin:8px 0;font-family:inherit}',
      '.dvabtn{font:inherit;font-size:.76rem;font-weight:800;cursor:pointer;border-radius:999px;',
      '  border:1px solid #1f8f86;background:linear-gradient(180deg,#1d4b4a,#133534);color:#d6fff8;padding:5px 12px}',
      '.dvabtn[aria-expanded="true"]{background:linear-gradient(160deg,#c6fff4,#4fd8c4 55%,#16a08e);color:#062b27;border-color:transparent}',
      '.dvabtn b{margin-left:5px;background:rgba(255,255,255,.22);border-radius:999px;padding:0 6px}',
      '.dvapanel{display:none;margin-top:7px;border:1px solid #1f8f86;border-radius:12px;padding:10px 11px;',
      '  background:rgba(14,48,47,.95);color:#d6fff8;font-size:.76rem;line-height:1.7;max-width:460px}',
      '.dvapanel.open{display:block}',
      '.dvapanel .dvanote{color:#97d9cf;font-size:.71rem;margin:0 0 7px}',
      '.dvapanel .sugg{position:relative}',
      '.dvapanel input{width:100%;box-sizing:border-box;font-size:16px;padding:6px 9px;border-radius:9px;',
      '  border:1px solid #1f8f86;background:rgba(0,0,0,.34);color:#fff}',
      '.dvapanel .sugg-list{position:absolute;left:0;right:0;top:100%;z-index:60;max-height:260px;overflow:auto;',
      '  background:#0f2d2c;border:1px solid #1f8f86;border-radius:9px;margin-top:3px;display:none}',
      '.dvapanel .sugg-list.open{display:block}',
      '.dvapanel .sugg-list>div{padding:6px 10px;cursor:pointer;font-size:.8rem}',
      '.dvapanel .sugg-list>div:hover{background:rgba(79,216,196,.2)}',
      '.dvapanel .sugg-list>div.dup{opacity:.45;cursor:default}',
      '.dvapanel .sugg-list>div.on{background:rgba(79,216,196,.22);font-weight:800}',
      '.dvapanel .sugg-list>div small{opacity:.7;margin-left:4px;font-weight:600}',
      '.dvachips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 0}',
      '.dvachips span{display:inline-flex;align-items:center;gap:5px;background:rgba(79,216,196,.16);',
      '  border:1px solid #1f8f86;border-radius:999px;padding:2px 4px 2px 10px;font-size:.74rem}',
      '.dvachips span.miss{opacity:.5}',
      '.dvachips button{font:inherit;cursor:pointer;border:0;background:rgba(0,0,0,.3);color:#d6fff8;',
      '  border-radius:999px;width:19px;height:19px;line-height:1;padding:0}',
      '.dvarow{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}',
      '.dvarow button{font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;border-radius:999px;',
      '  border:1px solid #1f8f86;background:rgba(0,0,0,.28);color:#d6fff8;padding:4px 10px}',
      '.dvamsg{color:#a8ffd0;font-size:.71rem;margin-left:4px}',
      '.dvashrow{margin:0 0 7px}',
      '.dvashrow button.dvash{font:inherit;font-size:.74rem;font-weight:800;cursor:pointer;border-radius:999px;',
      '  border:1px solid #8a5cd6;background:rgba(0,0,0,.28);color:#d9c2ff;padding:4px 11px}',
      '.dvashrow button.dvash[aria-pressed="true"]{background:linear-gradient(160deg,#d9b8ff,#9b5cf0 55%,#6a2fc0);color:#fff;border-color:transparent}',
      '.dvashrow .shadowmark{margin-right:3px}',
      '.dvamoderow{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 7px}',
      '.dvamoderow button{font:inherit;font-size:.74rem;font-weight:800;cursor:pointer;border-radius:999px;',
      '  border:1px solid #c0408f;background:rgba(0,0,0,.28);color:#ffc6e8;padding:4px 11px}',
      '.dvamoderow button[aria-pressed="true"]{background:linear-gradient(160deg,#ffc1e6,#e0479e 55%,#a1206d);color:#fff;border-color:transparent}',
      '.dvachips span i{font-style:normal;font-size:.66rem;opacity:.85;margin-left:-1px}',
      '.dvaplus{margin-top:11px;padding-top:9px;border-top:1px dashed #1f8f86}',
      '.dvaplus .dvaplushd{font-weight:800;color:#ffc6e8;margin-bottom:3px}',
      '.dvaplus .dvaform{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.dvaplus .dvaform .sugg{flex:1 1 100%}',
      '.dvaplus select,.dvaplus .dvapw{font-size:16px;padding:5px 8px;border-radius:9px;border:1px solid #1f8f86;background:rgba(0,0,0,.34);color:#fff}',
      '.dvaplus select{flex:1 1 160px;min-width:0}',
      '.dvaplus .dvapw{width:92px;box-sizing:border-box}',
      '.dvaplus .dvapadd,.dvaplus .dvamadd{font:inherit;font-size:.76rem;font-weight:800;cursor:pointer;border-radius:999px;border:0;padding:5px 14px;',
      '  background:linear-gradient(160deg,#ffc1e6,#e0479e 55%,#a1206d);color:#fff}',
      '.dvaplus .dvapmsg,.dvaplus .dvammsg{flex:1 1 100%;color:#ffb3c8;font-size:.71rem}',
      '.dvaplus .dvachips span{background:rgba(224,71,158,.16);border-color:#c0408f}',
      '.dvaplus .dvachips b{color:#f08ccd}',
      '.dvaplus .dvachips em.dvapt{font-style:normal}',
      '.dvamega{margin:8px 0 10px}',
      '.dvamtog{font:inherit;font-size:.74rem;font-weight:800;cursor:pointer;border-radius:999px;border:1px solid #c0408f;',
      '  background:rgba(0,0,0,.28);color:#ffc6e8;padding:4px 11px}',
      '.dvamtog[aria-expanded="true"]{background:linear-gradient(160deg,#ffc1e6,#e0479e 55%,#a1206d);color:#fff;border-color:transparent}',
      '.dvamform{display:none;margin-top:7px;border:1px solid #c0408f;border-radius:10px;padding:8px 9px;background:rgba(0,0,0,.18)}',
      '.dvamform.open{display:block}',
      '.dvamform .dvaform{margin-top:5px}',
      '.dvamform input.dvamname{flex:1 1 100%;font-size:16px;padding:5px 8px;border-radius:9px;border:1px solid #1f8f86;background:rgba(0,0,0,.34);color:#fff;box-sizing:border-box}',
      '.dvamform .dvamseg{display:flex;gap:2px}',
      '.dvamform .dvamseg button{font:inherit;font-size:.72rem;font-weight:800;cursor:pointer;border:1px solid #1f8f86;background:rgba(0,0,0,.28);color:#d6fff8;padding:4px 10px}',
      '.dvamform .dvamseg button:first-child{border-radius:999px 0 0 999px}',
      '.dvamform .dvamseg button:last-child{border-radius:0 999px 999px 0}',
      '.dvamform .dvamseg button[aria-pressed="true"]{background:linear-gradient(160deg,#c6fff4,#4fd8c4 55%,#16a08e);color:#062b27;border-color:transparent}',
      '.dvamstats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px}',
      '.dvamstats label{display:flex;flex-direction:column;font-size:.68rem;color:#97d9cf}',
      '.dvamstats input{font-size:16px;padding:4px 7px;border-radius:8px;border:1px solid #1f8f86;background:rgba(0,0,0,.34);color:#fff;width:100%;box-sizing:border-box}',
      '.dvamnf{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:.72rem}',
      '.dvamnf input{width:auto;flex:none;margin:0}',
      '.dvamprev{margin-top:5px;font-size:.74rem;color:#ffe3f3;font-weight:700}',
      '.dvamchips span{background:rgba(224,71,158,.16)!important;border-color:#c0408f!important}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // m = {wrap, url, apply, data}
  function build(m, host) {
    css();
    var wrap = document.createElement('div');
    wrap.className = 'dvawrap';
    wrap.innerHTML =
      '<button type="button" class="dvabtn" aria-expanded="false" title="開発者だけの機能です。まだ実装されていないポケモンをこの一覧に足します（動画用）">＋ 未実装<b>0</b></button>' +
      '<div class="dvapanel">' +
      '<p class="dvanote">' + (m.note || 'まだ実装されていないポケモンを、この端末の一覧にだけ足します（開発者だけ・ふつうの人の画面は変わりません）。<br>' +
      '性能はゲーム内データのいまの値です。実装までに変わることがあります。ここで足したポケモンは、ほかのランキングにも入ります。') + '</p>' +
      (m.shadowNames ? '<div class="dvashrow"><button type="button" class="dvash" aria-pressed="false" ' +
        'title="押しているあいだは、実装済みでシャドウがまだ無いポケモンを探します（シャドウ◯◯として足します）">' +
        '<i class="shadowmark"></i>シャドウ未実装</button></div>' : '') +
      (m.modes ? '<div class="dvamoderow">' + m.modes.map(function (o, i) {
        return '<button type="button" data-mk="' + o.k + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '" title="' + esc(o.title || '') + '">' + esc(o.label) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="sugg"><input type="search" placeholder="' + esc(m.placeholder || '未実装のポケモン名で探す') + '" autocomplete="off" ' +
      'autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
      '<div class="dvachips"></div>' +
      (m.megaPlus ? '<div class="dvaplus"><div class="dvaplushd">メガの新しい＋わざ</div>' +
        '<p class="dvanote">公式発表の威力だけで、まだ無い＋わざをメガシンカポケモンに足します。時間とタイプは元のわざと同じ・ゲージは1本（これまでの＋わざと同じ）。' +
        '威力は発表の値（メガLv1）を入れてください。メガLvの倍率はいつもどおり掛かります。ランキングに出すには「メガ・ゲンシ」を点けてください。</p>' +
        '<div class="dvamega"><button type="button" class="dvamtog" aria-expanded="false" title="データにまだ無いメガを、元のポケモン・タイプ・種族値から作ります">＋ 新しいメガを作る</button>' +
        '<div class="dvamform">' +
        '<p class="dvanote">データにまだ無いメガを作ります。わざは元のポケモンのものを引き継ぎます。作ったあと、下の欄で＋わざも足せます。</p>' +
        '<div class="dvaform"><div class="sugg"><input type="search" class="dvamb" placeholder="元のポケモン名で探す" autocomplete="off" ' +
        'autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
        '<input type="text" class="dvamname" placeholder="メガの名前（例: メガヒードラン）" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<select class="dvamt1" title="タイプ1"></select><select class="dvamt2" title="タイプ2"></select></div>' +
        '<div class="dvaform"><div class="dvamseg"><button type="button" data-src="ms" aria-pressed="true" title="ゲーム機版の種族値6つを入れると、GOの種族値に自動で直します">原作の種族値</button>' +
        '<button type="button" data-src="go" aria-pressed="false" title="GOの種族値（攻撃・防御・HP）をそのまま入れます">GOの種族値</button></div></div>' +
        '<div class="dvamstats"></div>' +
        '<label class="dvamnf"><input type="checkbox" class="dvamnfc">元のポケモンが弱体化されている（×0.97）</label>' +
        '<div class="dvamprev"></div>' +
        '<div class="dvaform"><button type="button" class="dvamadd">作る</button><span class="dvammsg"></span></div>' +
        '</div><div class="dvachips dvamchips"></div></div>' +
        '<div class="dvaform"><div class="sugg"><input type="search" class="dvapn" placeholder="メガシンカポケモン名で探す" autocomplete="off" ' +
        'autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
        '<select class="dvapb" title="＋わざの元になるSPアタック"><option value="">元のわざ</option></select>' +
        '<input type="text" class="dvapw" inputmode="decimal" placeholder="威力" title="公式発表の威力（メガLv1の値）" autocomplete="off">' +
        '<button type="button" class="dvapadd">足す</button><span class="dvapmsg"></span></div>' +
        '<div class="dvachips dvapchips"></div></div>' : '') +
      '<div class="dvarow"><button type="button" class="dvaclear">すべて外す</button>' +
      '<button type="button" class="dvacopy">🔗 このリンクをコピー</button><span class="dvamsg"></span></div>' +
      '</div>';
    host.appendChild(wrap);
    m.wrap = wrap;
    var btn = wrap.querySelector('.dvabtn'), panel = wrap.querySelector('.dvapanel');
    var inp = wrap.querySelector('input'), ul = wrap.querySelector('.sugg-list');
    var msg = wrap.querySelector('.dvamsg');
    var shBtn = wrap.querySelector('.dvash'), shMode = false;
    if (shBtn) shBtn.onclick = function () {
      shMode = !shMode;
      shBtn.setAttribute('aria-pressed', shMode ? 'true' : 'false');
      inp.placeholder = shMode ? 'シャドウが未実装のポケモン名で探す' : (m.placeholder || '未実装のポケモン名で探す');
      inp.focus(); showSugg();
    };

    // 形のボタン（両方点けてもよい・最低1つ）。足すときに点いている形で覚える
    var curMode = function () {
      var s2 = ''; wrap.querySelectorAll('.dvamoderow button[aria-pressed="true"]').forEach(function (b) { s2 += b.dataset.mk; });
      return s2;
    };
    m.curMode = curMode;
    wrap.querySelectorAll('.dvamoderow button').forEach(function (b) {
      b.onclick = function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        if (!on && wrap.querySelectorAll('.dvamoderow button[aria-pressed="true"]').length <= 1) return;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        showSugg();
      };
    });

    btn.onclick = function () {
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) inp.focus();
    };
    // 候補。⚠ 変換中も出す（iPhoneの日本語入力は確定まで isComposing のまま・共通ルール）
    function showSugg() {
      var q = inp.value.trim();
      if (!q) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      if (!shMode && !m.data) { ul.innerHTML = '<div class="dup">' + (m.err ? '未実装のデータを読めませんでした' : '読み込み中…') + '</div>'; ul.classList.add('open'); return; }
      var qk = toKata(q), seen = {}, hit = [];
      var src = shMode ? (m.shadowNames() || []).map(function (n) { return 'シャドウ' + n; }) : namesOf(m.data);
      src.forEach(function (n) {
        if (!n || seen[n]) return; seen[n] = 1;
        if (toKata(n).indexOf(qk) >= 0) hit.push(n);
      });
      hit.sort(function (a, b) { return (toKata(a).indexOf(qk) - toKata(b).indexOf(qk)) || a.localeCompare(b, 'ja'); });
      hit = hit.slice(0, 60);
      // 足しているものは「✓」を付けて残し、もう一度押すと外す（続けて何匹でも選べる・2026-09-27タダシさん指示）
      ul.innerHTML = hit.length
        ? hit.map(function (n) {
            var on = has(n), cm = m.modes ? curMode() : '';
            var ok = !m.allow || cm.split('').some(function (k) { return m.allow(n, k); });
            var same = on && (!m.modes || modeOf(n) === cm);
            var note = !on ? '' : same ? '（足しています・押すと外す）' : '（' + modeLabel(m, modeOf(n)) + 'で足しています・押すと形を変える）';
            if (!ok && !on) return '<div class="dup" data-x="1">' + esc(n) + '<small>（この形では足せません）</small></div>';
            return '<div' + (on ? ' class="on"' : '') + ' data-n="' + esc(n) + '">' +
              (on ? '✓ ' : '') + esc(n) + (note ? '<small>' + note + '</small>' : '') + '</div>';
          }).join('')
        : '<div class="dup">' + (shMode ? 'シャドウが未実装のポケモンにありません' : 'このツールに足せる未実装のポケモンにありません') + '</div>';
      // ⚠ 共通の守り(suggGuard)が書いた display:none を消す（残ると2匹目から候補が出ない・devex.js と同じ）
      ul.style.display = '';
      ul.classList.add('open');
    }
    inp.addEventListener('input', showSugg);
    inp.addEventListener('focus', showSugg);
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });   // 入力欄のフォーカスを外さない
    // 選んでも一覧は閉じない（続けて選べる）。一覧の外を触ったら閉じる
    ul.addEventListener('click', function (e) {
      var d = e.target.closest('div[data-n]'); if (!d) return;
      var n = d.dataset.n;
      if (m.modes) {
        var cm = curMode();
        if (has(n) && modeOf(n) === cm) remove(n);
        else { modes[canon(n)] = cm; if (has(n)) { save(); fire(); } else add(n); }
      } else if (has(n)) remove(n); else add(n);
      showSugg();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!ul.classList.contains('open') || e.target.closest('.sugg') === inp.parentNode) return;
      inp.value = ''; ul.classList.remove('open'); ul.innerHTML = '';
    }, true);
    wrap.querySelector('.dvaclear').onclick = function () {
      if (list.length || plus.length || megas.length) { list = []; save(); plus = []; savePlus(); megas = []; saveMega(); fire(); }
    };
    if (m.megaPlus) { buildMega(m, wrap); buildPlus(m, wrap); }
    wrap.querySelector('.dvacopy').onclick = function () {
      var u = location.origin + location.pathname + '?devadd=' + (list.length ? encodeURIComponent(list.map(function (n) {
        var k = modes[canon(n)]; return k ? n + '~' + k : n;
      }).join(',')) : '');
      if (m.megaPlus) u += '&devmega=' + encodeURIComponent(megas.map(function (x) {
        return [x.n, x.b, x.ty.join('/'), x.src, x.v.join('.'), x.nf ? 1 : 0].join('~');
      }).join(',')) + '&devplus=' + encodeURIComponent(plus.map(function (x) { return x.n + '~' + x.b + '~' + x.p; }).join(','));
      var done = function () { msg.textContent = 'コピーしました'; setTimeout(function () { msg.textContent = ''; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, function () { prompt('このリンクをコピーしてください', u); });
      else prompt('このリンクをコピーしてください', u);
    };
  }

  // ---- 新しいメガを作る欄 ----
  function buildMega(m, wrap) {
    var mp = m.megaPlus, box = wrap.querySelector('.dvamega');
    var tog = box.querySelector('.dvamtog'), form = box.querySelector('.dvamform');
    var inp = box.querySelector('.dvamb'), ul = inp.parentNode.querySelector('.sugg-list');
    var nm = box.querySelector('.dvamname'), t1 = box.querySelector('.dvamt1'), t2 = box.querySelector('.dvamt2');
    var grid = box.querySelector('.dvamstats'), nfc = box.querySelector('.dvamnfc'), nfl = box.querySelector('.dvamnf');
    var prev = box.querySelector('.dvamprev'), msg = box.querySelector('.dvammsg');
    var src = 'ms', baseKey = '';
    var types = Object.keys(mp.typeJa);
    if (window.sortTypes) types = window.sortTypes(types, function (t) { return t; });
    var topt = function (first) { return '<option value="">' + first + '</option>' + types.map(function (t) { return '<option value="' + t + '">' + esc(mp.typeJa[t]) + '</option>'; }).join(''); };
    t1.innerHTML = topt('タイプ1'); t2.innerHTML = topt('タイプ2（なし）');
    var LABEL = { ms: ['HP', '攻撃', '防御', '特攻', '特防', '素早さ'], go: ['攻撃', '防御', 'HP'] };
    function drawGrid() {
      grid.innerHTML = LABEL[src].map(function (l, i) {
        return '<label>' + l + '<input type="text" inputmode="numeric" data-i="' + i + '" autocomplete="off"></label>';
      }).join('');
      nfl.style.display = src === 'ms' ? '' : 'none';
      showPrev();
    }
    function vals() { return [].map.call(grid.querySelectorAll('input'), function (e) { return num(e.value); }); }
    function showPrev() {
      var v = vals();
      if (!v.every(function (n) { return n > 0 && n < 1000; })) { prev.textContent = ''; return; }
      var g = src === 'ms' ? goStats(v, nfc.checked) : v;
      var c = Math.floor((g[0] + 15) * Math.sqrt(g[1] + 15) * Math.sqrt(g[2] + 15) * 0.7903 * 0.7903 / 10);
      prev.textContent = 'GOの種族値: 攻撃' + g[0] + '・防御' + g[1] + '・HP' + g[2] + '（PL40のCP' + c + '）';
    }
    tog.onclick = function () {
      var o = form.classList.toggle('open'); tog.setAttribute('aria-expanded', o ? 'true' : 'false');
    };
    box.querySelectorAll('.dvamseg button').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.src === src) return; src = b.dataset.src;
        box.querySelectorAll('.dvamseg button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        drawGrid();
      };
    });
    grid.addEventListener('input', showPrev); nfc.onchange = showPrev;
    drawGrid();
    function pick(k) {
      var p = mp.pokemon[k]; if (!p) return;
      baseKey = k; inp.value = p.n;
      if (!nm.value || /^メガ/.test(nm.value)) nm.value = 'メガ' + p.n.replace(/[（(].*$/, '');
      t1.value = p.ty[0] || ''; t2.value = p.ty[1] || '';
      nfc.checked = NERFED.indexOf(k) >= 0; showPrev();
    }
    function showSugg() {
      var q = inp.value.trim();
      if (!q) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      var qk = toKata(q);
      var hit = (mp.keys || []).filter(function (k) {
        var p = mp.pokemon[k]; return p && !p.mega && !p._dev && !/_PRIMAL$/.test(k) && toKata(p.n).indexOf(qk) >= 0;
      });
      hit.sort(function (a, b) { var x = mp.pokemon[a].n, y = mp.pokemon[b].n; return (toKata(x).indexOf(qk) - toKata(y).indexOf(qk)) || x.localeCompare(y, 'ja'); });
      ul.innerHTML = hit.length ? hit.slice(0, 60).map(function (k) { return '<div data-k="' + esc(k) + '">' + esc(mp.pokemon[k].n) + '</div>'; }).join('')
        : '<div class="dup">ポケモンが見つかりません</div>';
      ul.style.display = '';   // 共通の守り(suggGuard)が書いた display:none を消す
      ul.classList.add('open');
    }
    inp.addEventListener('input', function () { baseKey = ''; showSugg(); });
    inp.addEventListener('focus', showSugg);
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ul.addEventListener('click', function (e) {
      var d = e.target.closest('div[data-k]'); if (!d) return;
      pick(d.dataset.k); ul.classList.remove('open'); ul.innerHTML = ''; msg.textContent = '';
    });
    document.addEventListener('pointerdown', function (e) {
      if (!ul.classList.contains('open') || e.target.closest('.sugg') === inp.parentNode) return;
      ul.classList.remove('open'); ul.innerHTML = '';
    }, true);
    box.querySelector('.dvamadd').onclick = function () {
      var n = nm.value.trim(), v = vals();
      if (!baseKey) { msg.textContent = '元のポケモンを候補から選んでください'; return; }
      if (!n) { msg.textContent = 'メガの名前を入れてください'; return; }
      if (!t1.value) { msg.textContent = 'タイプ1を選んでください'; return; }
      if (!v.every(function (x) { return x > 0 && x < 1000; })) { msg.textContent = '種族値をすべて数字で入れてください'; return; }
      var x = { n: n, b: baseKey, ty: t2.value && t2.value !== t1.value ? [t1.value, t2.value] : [t1.value], src: src, v: v, nf: src === 'ms' && nfc.checked ? 1 : 0 };
      var key = megaKey(x), ex = mp.pokemon[key];
      if (ex && !ex._dev) { msg.textContent = 'このメガはもうデータにあります（' + ex.n + '）'; return; }
      var clash = (mp.keys || []).some(function (k) { var p = mp.pokemon[k]; return p && !p._dev && p.n === n; });
      if (clash) { msg.textContent = '同じ名前のポケモンがもうあります'; return; }
      // 同じ番号・同じ名前は置きかえ（打ち直し）
      megas = megas.filter(function (y) { return y.n !== x.n && megaKey(y) !== key; });
      megas.push(x); saveMega(); fire();
      msg.textContent = '作りました（「メガ・ゲンシ」を点けると一覧に出ます）';
    };
  }

  // ---- メガの新しい＋わざの欄 ----
  function buildPlus(m, wrap) {
    var mp = m.megaPlus, box = wrap.querySelector('.dvaplus');
    var inp = box.querySelector('.dvapn'), ul = inp.parentNode.querySelector('.sugg-list');
    var sel = box.querySelector('.dvapb'), pw = box.querySelector('.dvapw'), msg = box.querySelector('.dvapmsg');
    var cur = '';
    var isChg = function (id) { var v = mp.moves[id]; return v && v.e < 0 && !/_PLUS$|^DEVPLUS_|^DEVMV_/.test(id) && !/^[0-9]+$/.test(v.n); };
    function fillMoves() {
      var learn = (cur && mp.learn(cur) || []).filter(isChg);
      var seen = {}; learn.forEach(function (id) { seen[id] = 1; });
      var others = Object.keys(mp.moves).filter(function (id) { return isChg(id) && !seen[id]; })
        .sort(function (a, b) { return mp.moves[a].n.localeCompare(mp.moves[b].n, 'ja'); });
      var opt = function (id) { return '<option value="' + esc(id) + '">' + esc(mp.moves[id].n) + '</option>'; };
      sel.innerHTML = '<option value="">元のわざ</option>' +
        (learn.length ? '<optgroup label="覚えるわざ">' + learn.map(opt).join('') + '</optgroup>' : '') +
        '<optgroup label="その他のわざ">' + others.map(opt).join('') + '</optgroup>';
    }
    fillMoves();
    function showSugg() {
      var q = inp.value.trim();
      if (!q) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      var qk = toKata(q), hit = (mp.megas() || []).filter(function (n) { return toKata(n).indexOf(qk) >= 0; });
      hit.sort(function (a, b) { return (toKata(a).indexOf(qk) - toKata(b).indexOf(qk)) || a.localeCompare(b, 'ja'); });
      ul.innerHTML = hit.length ? hit.slice(0, 60).map(function (n) { return '<div data-n="' + esc(n) + '">' + esc(n) + '</div>'; }).join('')
        : '<div class="dup">メガシンカポケモンにありません</div>';
      ul.style.display = '';   // 共通の守り(suggGuard)が書いた display:none を消す
      ul.classList.add('open');
    }
    inp.addEventListener('input', showSugg);
    inp.addEventListener('focus', showSugg);
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ul.addEventListener('click', function (e) {
      var d = e.target.closest('div[data-n]'); if (!d) return;
      cur = d.dataset.n; inp.value = cur; ul.classList.remove('open'); ul.innerHTML = '';
      fillMoves(); msg.textContent = '';
    });
    document.addEventListener('pointerdown', function (e) {
      if (!ul.classList.contains('open') || e.target.closest('.sugg') === inp.parentNode) return;
      ul.classList.remove('open'); ul.innerHTML = '';
    }, true);
    // ⚠ 打っている最中は書き換えない。全角の数字は足すときに半角へ直して読む
    box.querySelector('.dvapadd').onclick = function () {
      var n = inp.value.trim(), b = sel.value;
      var p = parseFloat(pw.value.replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }));
      if ((mp.megas() || []).indexOf(n) < 0) { msg.textContent = 'メガシンカポケモンを候補から選んでください'; return; }
      if (!b) { msg.textContent = '元のわざを選んでください'; return; }
      if (!(p > 0 && p < 10000)) { msg.textContent = '威力を数字で入れてください'; return; }
      var x = { n: n, b: b, p: Math.round(p * 10) / 10 };
      // 同じポケモン・同じ元のわざは置きかえ（威力の打ち直し）
      plus = plus.filter(function (y) { return !(y.n === x.n && y.b === x.b); });
      plus.push(x); savePlus(); fire();
      msg.textContent = ''; pw.value = '';
    };
  }

  function render() {
    mounted.forEach(function (m) {
      if (m.wrap && m.megaPlus) {
        var mc = m.wrap.querySelector('.dvamchips'), tj = m.megaPlus.typeJa || {};
        if (mc) mc.innerHTML = megas.map(function (x, i) {
          var g = statsOf(x), real = m.megaPlus.pokemon[megaKey(x)];
          var note = real && !real._dev ? '（データに入ったので使っていません）' : '';
          return '<span><em class="dvapt">' + esc(x.n) + '　' + x.ty.map(function (t) { return esc(tj[t] || t); }).join('/') +
            '　' + g.join('/') + (x.nf ? '（×0.97）' : '') + note + '</em><button type="button" data-mi="' + i + '" title="外す">×</button></span>';
        }).join('');
        var pc = m.wrap.querySelector('.dvapchips'), mv = m.megaPlus.moves;
        if (pc) pc.innerHTML = plus.length ? plus.map(function (x, i) {
          var bn = mv[x.b] ? mv[x.b].n : x.b;
          return '<span><em class="dvapt">' + esc(x.n) + '　<b>' + esc(bn) + '+</b>　威力' + x.p + '</em>' +
            '<button type="button" data-pi="' + i + '" title="外す">×</button></span>';
        }).join('') : '<em style="opacity:.6">いまは足していません</em>';
      }
      if (!m.wrap) return;
      var names = m.data ? namesOf(m.data).concat(m.shadowNames ? (m.shadowNames() || []).map(function (n) { return 'シャドウ' + n; }) : []).map(canon) : null;
      var b = m.wrap.querySelector('.dvabtn b'); if (b) b.textContent = list.length;
      var chips = m.wrap.querySelector('.dvachips');
      // このツールのデータに無い名前（ジム防衛の伝説など）は薄く出す
      if (chips) chips.innerHTML = list.length
        ? list.map(function (n) {
            var miss = names && names.indexOf(canon(n)) < 0;
            return '<span' + (miss ? ' class="miss" title="このツールには入らないポケモンです（ほかのランキングには入ります）"' : '') + '>' +
              esc(n) + (m.modes ? '<i>（' + esc(modeLabel(m, modeOf(n), true)) + '）</i>' : '') + '<button type="button" data-n="' + esc(n) + '" title="外す">×</button></span>';
          }).join('')
        : '<em style="opacity:.6">いまは1匹も足していません</em>';
    });
  }
  document.addEventListener('click', function (e) {
    var mb = e.target.closest('.dvamchips button[data-mi]');
    if (mb) { megas.splice(+mb.dataset.mi, 1); saveMega(); fire(); return; }
    var pb = e.target.closest('.dvapchips button[data-pi]');
    if (pb) { plus.splice(+pb.dataset.pi, 1); savePlus(); fire(); return; }
    var b = e.target.closest('.dvachips button[data-n]'); if (!b) return;
    remove(b.dataset.n);
  });

  function modeOf(n) { return modes[canon(n)] || 'D'; }
  function modeLabel(m, k, short) {
    return (m.modes || []).filter(function (o) { return k.indexOf(o.k) >= 0; })
      .map(function (o) { return short && o.short ? o.short : o.label; }).join('・');
  }
  function applyOne(m) {
    if (!m.data) return;
    try { m.apply(m.data, function (n) { return dev() && list.length > 0 && has(n); }); }
    catch (e) { console.warn('devadd', e); }
  }
  function fire() { mounted.forEach(applyOne); render(); }
  function add(n) { if (!n || has(n)) return; list.push(n); save(); fire(); }
  function remove(n) {
    var c = canon(n), before = list.length;
    list = list.filter(function (x) { return canon(x) !== c; });
    if (list.length !== before) { save(); fire(); }
  }

  window.GonaviDevAdd = {
    // ⚠ 開発者の端末でなければ必ず false（ふつうの人の一覧には1匹も足さない）
    has: function (name) { return dev() && list.length > 0 && has(name); },
    list: function () { return dev() ? list.slice() : []; },
    // メガの新しい＋わざ（わざIDの配列）。⚠ 開発者の端末でなければ必ず空
    plusFor: function (name) {
      if (!dev()) return [];
      return plus.filter(function (x) { return x.n === name; }).map(plusId);
    },
    // 新しいメガを一覧に入れる。外したメガは keys から外すだけ（pokemon には残す＝選んでいる画面が壊れない）。
    // ⚠ データに同じ番号の本物があれば触らない
    megaSync: function (pokemon, keys) {
      if (!pokemon || !keys) return;
      var want = {};
      if (dev()) megas.forEach(function (x) {
        var k = megaKey(x), ex = pokemon[k], b = pokemon[x.b];
        if (!b || (ex && !ex._dev)) return;
        var g = statsOf(x);
        pokemon[k] = { n: x.n, a: g[0], df: g[1], h: g[2], ty: x.ty.slice(), q: b.q.slice(), c: b.c.slice(),
          eq: (b.eq || []).slice(), ec: (b.ec || []).slice(), shadow: false, mega: true, fe: 1, _dev: 1 };
        if (b.lg) pokemon[k].lg = 1;
        want[k] = 1;
      });
      Object.keys(pokemon).forEach(function (k) {
        if (!pokemon[k]._dev) return;
        var i = keys.indexOf(k);
        if (want[k]) { if (i < 0) keys.push(k); } else if (i >= 0) keys.splice(i, 1);
      });
    },
    // わざの表に＋わざを作り（時間・タイプは元のわざ・ゲージ1本）、外したものは消す。ids（PLUS_IDS）にも足し外しする
    plusSync: function (moves, ids) {
      if (!moves) return;
      Object.keys(moves).forEach(function (id) { if (id.indexOf('DEVPLUS_') === 0) delete moves[id]; });
      if (ids) for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i]).indexOf('DEVPLUS_') === 0) ids.splice(i, 1);
      if (!dev()) return;
      plus.forEach(function (x) {
        var b = moves[x.b], id = plusId(x);
        if (!b || moves[id]) return;
        moves[id] = { n: b.n + '+', t: b.t, p: x.p, d: b.d, e: -100, w: b.w, we: b.we };
        if (ids && ids.indexOf(id) < 0) ids.push(id);
      });
    },
    // 形（'D'・'G'・'DG'）。形を選ばずに足した名前は 'D'
    modeOf: function (name) { return modeOf(name); },
    // host=ボタンの置き場所 ／ url=未実装のデータ ／ apply(data, on)=一覧に足し・外して描き直す関数
    // ⚠ 開発者かどうかは home.js の GonaviDev() で決まるので、**読み込みが終わってから**置く
    mount: function (host, url, apply, opts) {
      if (!host || typeof apply !== 'function') return;
      var go = function () {
        if (!dev()) return;
        var m = { url: url, apply: apply, data: null, wrap: null,
          shadowNames: opts && typeof opts.shadowNames === 'function' ? opts.shadowNames : null,
          modes: opts && Array.isArray(opts.modes) && opts.modes.length ? opts.modes : null,
          allow: opts && typeof opts.allow === 'function' ? opts.allow : null,
          note: opts && opts.note || '', placeholder: opts && opts.placeholder || '',
          megaPlus: opts && opts.megaPlus && typeof opts.megaPlus.megas === 'function' ? opts.megaPlus : null };
        mounted.push(m);
        build(m, host); render();
        fetchData(url).then(function (d) {
          m.data = d;
          if (list.length || plus.length || megas.length) applyOne(m);
          render();
        }, function () { m.err = true; });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
    }
  };
})();
