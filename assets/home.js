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
(function () {
  var path = location.pathname.replace(/index\.html$/, '');
  var isTop = (path === '/' || path === '');   // トップページでは🏠は出さない(自分自身へのリンクになる)
  var standalone = false;
  try {
    standalone = (navigator.standalone === true) ||
      (window.matchMedia && ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) {
        return window.matchMedia('(display-mode: ' + m + ')').matches; }));
  } catch (e) {}

  function build() {
    var box = document.getElementById('themesw');
    if (!box) return;
    if (standalone && !document.getElementById('reloadBtn')) {
      box.insertAdjacentHTML('beforeend',
        '<button id="reloadBtn" class="reloadsw" type="button" ' +
        'title="最新の内容に更新します（ホーム画面から開いたときだけ出ます。更新が反映されるまで1〜2分かかることがあります）">' +
        '<i class="hi">↻</i></button>');
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
})();
