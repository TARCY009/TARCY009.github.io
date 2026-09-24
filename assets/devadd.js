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
        });
   保存キーは site_devadd（開発者だけの設定なので「データの引っ越し」からは外してある）。 */
(function () {
  'use strict';
  var KEY = 'site_devadd';
  var list = [], mounted = [], cssDone = false, cache = {};
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
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { } }
  function has(n) { var c = canon(n); for (var i = 0; i < list.length; i++) if (canon(list[i]) === c) return true; return false; }

  // ---- リンクで受け取る。⚠ location.search だけで見ない（住所を書き直すページがあるため・?dev=1 と同じ） ----
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
    list = v.split(',').map(function (s) { return s.trim(); }).filter(function (s) {
      var c = canon(s); if (!s || seen[c]) return false; seen[c] = 1; return true;
    });
    save();
    try {
      var u = new URL(location.href);
      u.searchParams.delete('devadd');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { }
  }

  load(); fromUrl();

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
      '.dvachips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 0}',
      '.dvachips span{display:inline-flex;align-items:center;gap:5px;background:rgba(79,216,196,.16);',
      '  border:1px solid #1f8f86;border-radius:999px;padding:2px 4px 2px 10px;font-size:.74rem}',
      '.dvachips span.miss{opacity:.5}',
      '.dvachips button{font:inherit;cursor:pointer;border:0;background:rgba(0,0,0,.3);color:#d6fff8;',
      '  border-radius:999px;width:19px;height:19px;line-height:1;padding:0}',
      '.dvarow{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}',
      '.dvarow button{font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;border-radius:999px;',
      '  border:1px solid #1f8f86;background:rgba(0,0,0,.28);color:#d6fff8;padding:4px 10px}',
      '.dvamsg{color:#a8ffd0;font-size:.71rem;margin-left:4px}'
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
      '<p class="dvanote">まだ実装されていないポケモンを、この端末の一覧にだけ足します（開発者だけ・ふつうの人の画面は変わりません）。<br>' +
      '性能はゲーム内データのいまの値です。実装までに変わることがあります。ここで足したポケモンは、ほかのランキングにも入ります。</p>' +
      '<div class="sugg"><input type="search" placeholder="未実装のポケモン名で探す" autocomplete="off" ' +
      'autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><div class="sugg-list"></div></div>' +
      '<div class="dvachips"></div>' +
      '<div class="dvarow"><button type="button" class="dvaclear">すべて外す</button>' +
      '<button type="button" class="dvacopy">🔗 このリンクをコピー</button><span class="dvamsg"></span></div>' +
      '</div>';
    host.appendChild(wrap);
    m.wrap = wrap;
    var btn = wrap.querySelector('.dvabtn'), panel = wrap.querySelector('.dvapanel');
    var inp = wrap.querySelector('input'), ul = wrap.querySelector('.sugg-list');
    var msg = wrap.querySelector('.dvamsg');

    btn.onclick = function () {
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) inp.focus();
    };
    // 候補。⚠ 変換中も出す（iPhoneの日本語入力は確定まで isComposing のまま・共通ルール）
    function showSugg() {
      var q = inp.value.trim();
      if (!q) { ul.classList.remove('open'); ul.innerHTML = ''; return; }
      if (!m.data) { ul.innerHTML = '<div class="dup">' + (m.err ? '未実装のデータを読めませんでした' : '読み込み中…') + '</div>'; ul.classList.add('open'); return; }
      var qk = toKata(q), seen = {}, hit = [];
      namesOf(m.data).forEach(function (n) {
        if (!n || seen[n]) return; seen[n] = 1;
        if (toKata(n).indexOf(qk) >= 0) hit.push(n);
      });
      hit.sort(function (a, b) { return (toKata(a).indexOf(qk) - toKata(b).indexOf(qk)) || a.localeCompare(b, 'ja'); });
      hit = hit.slice(0, 60);
      ul.innerHTML = hit.length
        ? hit.map(function (n) {
            var on = has(n);
            return '<div' + (on ? ' class="dup"' : '') + ' data-n="' + esc(n) + '">' +
              esc(n) + (on ? '<small>（足しています）</small>' : '') + '</div>';
          }).join('')
        : '<div class="dup">このツールに足せる未実装のポケモンにありません</div>';
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
    wrap.querySelector('.dvaclear').onclick = function () { if (list.length) { list = []; save(); fire(); } };
    wrap.querySelector('.dvacopy').onclick = function () {
      var u = location.origin + location.pathname + '?devadd=' + (list.length ? encodeURIComponent(list.join(',')) : '');
      var done = function () { msg.textContent = 'コピーしました'; setTimeout(function () { msg.textContent = ''; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, function () { prompt('このリンクをコピーしてください', u); });
      else prompt('このリンクをコピーしてください', u);
    };
  }

  function render() {
    mounted.forEach(function (m) {
      if (!m.wrap) return;
      var names = m.data ? namesOf(m.data).map(canon) : null;
      var b = m.wrap.querySelector('.dvabtn b'); if (b) b.textContent = list.length;
      var chips = m.wrap.querySelector('.dvachips');
      // このツールのデータに無い名前（ジム防衛の伝説など）は薄く出す
      if (chips) chips.innerHTML = list.length
        ? list.map(function (n) {
            var miss = names && names.indexOf(canon(n)) < 0;
            return '<span' + (miss ? ' class="miss" title="このツールには入らないポケモンです（ほかのランキングには入ります）"' : '') + '>' +
              esc(n) + '<button type="button" data-n="' + esc(n) + '" title="外す">×</button></span>';
          }).join('')
        : '<em style="opacity:.6">いまは1匹も足していません</em>';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.dvachips button[data-n]'); if (!b) return;
    remove(b.dataset.n);
  });

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
    // host=ボタンの置き場所 ／ url=未実装のデータ ／ apply(data, on)=一覧に足し・外して描き直す関数
    // ⚠ 開発者かどうかは home.js の GonaviDev() で決まるので、**読み込みが終わってから**置く
    mount: function (host, url, apply) {
      if (!host || typeof apply !== 'function') return;
      var go = function () {
        if (!dev()) return;
        var m = { url: url, apply: apply, data: null, wrap: null };
        mounted.push(m);
        build(m, host); render();
        fetchData(url).then(function (d) {
          m.data = d;
          if (list.length) applyOne(m);
          render();
        }, function () { m.err = true; });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
    }
  };
})();
