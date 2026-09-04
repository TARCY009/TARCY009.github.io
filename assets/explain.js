// 説明ありモード(📖)の切り替え＋長押し照準の説明ウィンドウ（全ツール共通）
//
// 文字数を減らすために画面から外した補足は class="expl" で隠してある（恒久ルール）。
// このスイッチはルート要素に explain クラスを付け外しして、それを一斉に出し入れする
// （各ツールのCSSが .expl{display:none} / .explain .expl{display:revert} を持つ）。
//
// さらに📖ONのあいだは「長押し照準」が使える:
//   ・説明(title属性 or data-help属性)を持つ部品に点線の印が付く
//   ・スマホ: 長押し(0.4秒)で照準モードに入り、指の位置の部品が光って説明ウィンドウが出る。
//     指をスライドすると照準が別の部品へ移り、ウィンドウが差し替わる（照準中はスクロールしない）。
//     指を離すとウィンドウは残り、次にどこかをタップすると閉じる
//   ・パソコン: マウスを乗せるだけで同じウィンドウが出る
// 説明文は各ページがもともと持っている title 属性をそのまま使う（新規は data-help でもよい）。
// title は最初に触れた時点で data-help へ移す（素のツールチップと二重に出さないため）。
// 📖OFFに戻すと title へ戻す。
//
// 使い方は explain.css の冒頭コメントを参照（ページ側の追加は3行だけ）。
// ボタンはテーマスイッチ(#themesw)の先頭に差し込むので、必ず theme.js の後に読み込むこと。
//
// 選んだ状態は端末に覚えさせる。キーは全ツール共通の site_explain。既定はOFF。
(function () {
  var KEY = 'site_explain';
  var LP_MS = 400;    // 長押しと判定するまでの時間(iOSの文字選択より先に取るため短め)
  var MOVE_TOL = 12;  // 長押しの成立前にこれ以上動いたらスクロールとみなす(px)
  var root = document.documentElement;

  // ---- 説明ウィンドウ(長押し照準) ----
  var tip = null;      // ウィンドウ本体(#exptip)
  var hl = null;       // いま照準が合っている部品
  var press = null;    // 長押しの計測中 {x, y, t}
  var aiming = false;  // 照準モード中か
  var sticky = false;  // 指を離してウィンドウを残している状態か

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ensureTip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'exptip';
      document.body.appendChild(tip);
    }
    return tip;
  }
  // title は最初に触れたときに data-help へ移す(素のツールチップと二重に出さないため)
  function helpOf(el) {
    if (el.hasAttribute('title')) {
      el.setAttribute('data-help', el.getAttribute('title'));
      el.removeAttribute('title');
    }
    return el.getAttribute('data-help');
  }
  function targetAt(x, y) {
    var el = document.elementFromPoint(x, y);
    // タイプアイコン(.tbadge)と class="noexp" は説明の対象にしない(絵を見ればわかるもの。
    // titleはライトテーマのCSSと読み上げが使うので残してある)
    return el && el.closest('[title]:not(.tbadge):not(.noexp),[data-help]:not(.tbadge):not(.noexp)');
  }
  // 照準が合った部品の名前(ウィンドウの見出しに出す)
  function labelOf(el) {
    var t = ((el.innerText || el.value || '') + '').trim().split('\n')[0];
    return t.length > 14 ? t.slice(0, 14) + '…' : t;
  }
  function showTip(el, x, y) {
    var help = helpOf(el);
    if (!help) return;
    if (hl !== el) {
      if (hl) hl.classList.remove('expaimhl');
      hl = el;
      hl.classList.add('expaimhl');
      var lb = labelOf(el);
      ensureTip().innerHTML = (lb ? '<b>' + esc(lb) + '</b>' : '') + esc(help);
    }
    var t = ensureTip();
    t.style.display = 'block';
    // 指(カーソル)の上に出す。画面からはみ出すなら位置を詰め、上に入らなければ下へ
    var r = t.getBoundingClientRect();
    var left = Math.min(Math.max(8, x - r.width / 2), innerWidth - r.width - 8);
    var top = y - r.height - 20;
    if (top < 8) top = y + 26;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  function hideTip() {
    if (tip) tip.style.display = 'none';
    if (hl) { hl.classList.remove('expaimhl'); hl = null; }
    sticky = false;
  }
  function cancelPress() {
    if (press) { clearTimeout(press.t); press = null; }
  }
  // 照準のあとの指離しで、照準していた部品のタップ操作が発動しないように1回だけ握りつぶす
  function suppressNextClick() {
    var h = function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener('click', h, true);
    };
    document.addEventListener('click', h, true);
    setTimeout(function () { document.removeEventListener('click', h, true); }, 400);
  }

  function onDown(e) {
    if (!e.isPrimary) return;
    if (sticky) hideTip();  // 残していたウィンドウは次のタップで閉じる
    if (!root.classList.contains('explain')) return;
    if (e.pointerType === 'mouse') return;  // マウスはホバーで出すので長押しは不要
    var x = e.clientX, y = e.clientY;
    press = { x: x, y: y, t: setTimeout(function () {
      press = null;
      aiming = true;
      root.classList.add('expaiming');
      var el = targetAt(x, y);
      if (el) showTip(el, x, y);
    }, LP_MS) };
  }
  function onMove(e) {
    if (!e.isPrimary) return;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOL) cancelPress();
    if (aiming) {
      var el = targetAt(e.clientX, e.clientY);
      if (el) showTip(el, e.clientX, e.clientY);
      // 照準が対象から外れているあいだは、最後のウィンドウを出したままにする(チラつかせない)
    } else if (e.pointerType === 'mouse' && root.classList.contains('explain')) {
      var m = targetAt(e.clientX, e.clientY);
      if (m) showTip(m, e.clientX, e.clientY);
      else if (!sticky) hideTip();
    }
  }
  function onUp(e) {
    if (!e.isPrimary) return;
    cancelPress();
    if (aiming) {
      aiming = false;
      root.classList.remove('expaiming');
      if (hl) sticky = true; else hideTip();  // 何かに照準していたら読めるように残す
      suppressNextClick();
    }
  }

  function initAim() {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    // 照準中はスクロールさせない(指のスライド＝照準合わせのため)
    document.addEventListener('touchmove', function (e) { if (aiming) e.preventDefault(); }, { passive: false });
    // 照準中・長押し計測中はブラウザの長押しメニューを出さない
    document.addEventListener('contextmenu', function (e) { if (aiming || press) e.preventDefault(); });
    // 画面がスクロールしたら残しているウィンドウを閉じる
    document.addEventListener('scroll', function () { if (sticky) hideTip(); }, true);
  }

  // ---- 切り替えスイッチ ----
  function apply(on, save) {
    root.classList.toggle('explain', on);
    var b = document.getElementById('explainBtn');
    if (b) b.setAttribute('aria-pressed', String(on));
    if (!on) {
      hideTip();
      // 移した説明文を title へ戻す(OFFでは素のツールチップに戻る)
      document.querySelectorAll('[data-help]').forEach(function (el) {
        el.setAttribute('title', el.getAttribute('data-help'));
        el.removeAttribute('data-help');
      });
    }
    if (save) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} }
  }

  function build() {
    var box = document.getElementById('themesw');
    if (!box || document.getElementById('explainBtn')) return;
    box.insertAdjacentHTML('afterbegin',
      '<button id="explainBtn" class="explainsw" type="button" aria-label="説明ありモード" ' +
      'title="説明ありモード：画面に補足の説明を表示します。点線の印は長押しで説明が出ます">' +
      '<i class="eb">📖</i><span class="et">説明</span></button>');
    document.getElementById('explainBtn').onclick = function () {
      apply(!root.classList.contains('explain'), true);
    };
    apply(root.classList.contains('explain'), false);
    initAim();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
