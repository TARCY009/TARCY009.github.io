// メガレベルの切り替え（全ツール共通の部品）
//
// メガシンカの追加SPアタック「＋わざ」は、メガレベルが上がるほど威力が上がる。
//   Lv1(ベース) 1.0 ／ Lv2(高レベル) 1.1 ／ Lv3(マックス) 1.2 ／ Lv4(スーパーマックス) 1.3
// 既定は Lv4(1.3)。選んだレベルは端末に覚えさせ、サイト内のどのツールでも同じ値を使う。
//
// 使い方(ページ側):
//   1) <link rel="stylesheet" href="/assets/mega-lv.css"> と <script src="/assets/mega-lv.js"></script>
//   2) 置きたい場所に <div id="megalv"></div> を用意して MegaLv.mount(要素)
//   3) MegaLv.apply(D.moves, ids) で威力を書き換え、MegaLv.onChange(fn) で再計算をつなぐ
(function () {
  var MULT = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3 };
  var KEY = 'site_megalv';
  var DEFAULT = 4;
  var HELP = 'メガシンカの追加SPアタック（わざ名の最後が「+」）は、メガレベルが上がるほど威力が上がります。' +
             'Lv1=1.0倍 ／ Lv2(高レベル)=1.1倍 ／ Lv3(マックス)=1.2倍 ／ Lv4(スーパーマックス)=1.3倍。' +
             '既定はLv4です。ほかのわざには効きません。';
  var lv = DEFAULT;
  try { var v = parseInt(localStorage.getItem(KEY), 10); if (MULT[v]) lv = v; } catch (e) {}

  var boxes = [], subs = [];
  function paint() {
    for (var i = 0; i < boxes.length; i++) {
      var bs = boxes[i].querySelectorAll('button');
      for (var j = 0; j < bs.length; j++) bs[j].setAttribute('aria-pressed', String(+bs[j].dataset.lv === lv));
    }
  }
  function set(v) {
    v = +v;
    if (!MULT[v] || v === lv) return;
    lv = v;
    try { localStorage.setItem(KEY, String(v)); } catch (e) {}
    paint();
    for (var i = 0; i < subs.length; i++) subs[i](lv);
  }
  function mount(el) {
    if (!el || el.dataset.mlv) return;
    el.dataset.mlv = '1';
    el.className = (el.className ? el.className + ' ' : '') + 'megalv';
    var html = '<span class="mlvl" title="' + HELP + '">メガLv</span><span class="mlvseg">';
    for (var v = 1; v <= 4; v++) {
      html += '<button type="button" data-lv="' + v + '" aria-pressed="' + (v === lv) +
              '" title="' + HELP + '">' + v + '</button>';
    }
    // メガLvが効くのは「＋わざ」だけ。これを言っておかないと
    // 「押しても数字が変わらない＝壊れている」と見えてしまう(タダシさん報告)
    el.innerHTML = html + '</span><span class="mlvnote">＋わざの威力だけ変わります</span>';
    var bs = el.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) bs[i].onclick = (function (b) { return function () { set(b.dataset.lv); }; })(bs[i]);
    boxes.push(el); paint();
  }
  // わざの威力をいまのメガレベルに合わせて書き換える。
  // 元の値は _p0 に控えるので、何度呼んでも二重に掛からない(レベルを戻せば元に戻る)
  function apply(moves, ids) {
    if (!moves || !ids) return;
    var m = MULT[lv];
    for (var i = 0; i < ids.length; i++) {
      var mv = moves[ids[i]];
      if (!mv) continue;
      if (mv._p0 == null) mv._p0 = mv.p;
      mv.p = Math.round(mv._p0 * m * 10) / 10;
    }
  }
  window.MegaLv = {
    mult: function () { return MULT[lv]; },
    level: function () { return lv; },
    isDefault: function () { return lv === DEFAULT; },
    help: HELP,
    set: set, mount: mount, apply: apply,
    onChange: function (f) { subs.push(f); }
  };
})();
