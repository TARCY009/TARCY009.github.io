// 「🏠 ツール一覧」ボタン（全ツール共通・2026-09-01）
//
// どのツールからでも1タップでトップページ（ツール一覧）へ戻れるようにする。
// ボタンはテーマスイッチ(#themesw)の先頭に差し込むので、ページ側のHTMLに追加する要素は無い。
// 必ず theme.js（#themesw を innerHTML で書き換える）と explain.js の「後」に読み込むこと。
// explain.js より後に読むと、この🏠が並びのいちばん左に来る（読む順: 🏠 → 📖 → テーマ）。
//
// トップページそのものでは出さない（自分自身へのリンクになるため）。
// 見た目は home.css に閉じてあるので、どのツールに置いても同じになる。
(function () {
  var path = location.pathname.replace(/index\.html$/, '');
  if (path === '/' || path === '') return;   // トップページでは出さない

  function build() {
    var box = document.getElementById('themesw');
    if (!box || document.getElementById('homeBtn')) return;
    box.insertAdjacentHTML('afterbegin',
      '<a id="homeBtn" class="homesw" href="/" ' +
      'title="このサイトのツール一覧（トップページ）へ移動します">' +
      '<i class="hi">🏠</i><span class="ht">ツール一覧</span></a>');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
