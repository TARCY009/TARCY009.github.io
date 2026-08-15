// 説明ありモード(💡)の切り替え（全ツール共通）
//
// 文字数を減らすために画面から外した補足は class="expl" で隠してある（恒久ルール）。
// このスイッチはルート要素に explain クラスを付け外しして、それを一斉に出し入れする
// （各ツールのCSSが .expl{display:none} / .explain .expl{display:revert} を持つ）。
//
// 使い方は explain.css の冒頭コメントを参照（ページ側の追加は3行だけ）。
// ボタンはテーマスイッチ(#themesw)の先頭に差し込むので、必ず theme.js の後に読み込むこと。
//
// 選んだ状態は端末に覚えさせる。キーは全ツール共通なので、
// サイト内のどのツールへ移っても同じ状態になる（localStorageは同一オリジンで共有される）。
// 既定はOFF（補足を隠したすっきり表示）。
(function () {
  var KEY = 'site_explain';
  var root = document.documentElement;

  function apply(on, save) {
    root.classList.toggle('explain', on);
    var b = document.getElementById('explainBtn');
    if (b) b.setAttribute('aria-pressed', String(on));
    if (save) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} }
  }

  function build() {
    var box = document.getElementById('themesw');
    if (!box || document.getElementById('explainBtn')) return;
    box.insertAdjacentHTML('afterbegin',
      '<button id="explainBtn" class="explainsw" type="button" aria-label="説明ありモード" ' +
      'title="説明ありモード：画面に補足の説明を表示します">' +
      '<i class="eb">💡</i><span class="et">説明</span></button>');
    document.getElementById('explainBtn').onclick = function () {
      apply(!root.classList.contains('explain'), true);
    };
    apply(root.classList.contains('explain'), false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
