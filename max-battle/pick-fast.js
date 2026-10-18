/* マックスバトル対策: ダイマックス勢が撃つ「マックスわざのタイプ」＝ノーマルアタックを決める。

   ⚠ 決めるのは**ここ1か所**。画面（max-battle/index.html）と答え合わせ（.claude/checks/max-check.html）が
      同じ関数を呼ぶので、片方だけ直して食い違う事故が起きない。

   並び順は **①与ダメージがいちばん大きいわざ ②同じなら0.5秒わざ ③同じなら選出スコア
   ④同じなら「PL20〜50で選出スコアを計算し直し、上回ったPLが多いほう」（2026-10-18・切り捨てで実際のダメージが同じになったとき用）
   ⑤同じならわざ性能のDPS（威力×タイプ一致÷時間＝図鑑のDPS） ⑥同じならEPS（SPゲージ÷時間）（2026-10-17のフライゴン すなかけ7＞マッドショット6 もここ）
   ⑦同じなら特別わざでないもの**。④〜⑦は gonaviPlTie（キョダイ・特別枠とタンクも同じものを使う）。

   ⚠ 2026-09-19タダシさん報告の不具合の再発防止（ランキングの致命的な誤り）:
      以前は「ボスの弱点を突けるか」を**あるなしの2つ**でしか見ていなかったため、
      **二重弱点（2.56倍）と単弱点（1.6倍）が同じ扱い**になり、次の順位である
      「0.5秒わざを優先」が勝って**60%も弱いわざを選んでいた**。
      例: オムスター（いわ／みず）対ファイヤー（ほのお／ひこう）で、
          いわおとし 2.56倍 ではなく みずでっぽう 1.6倍（0.5秒）を選び、**3位相当が20位**まで落ちていた。
      マックスわざの威力は固定なので、**ダメージがいちばん大きいタイプを選ぶ**のが正しい。
      0.5秒わざの速さ（マックスメーターの溜まり）は順位の数字に入っていないので、
      ダメージを削ってまで優先してはいけない（速さは行のチップで伝える）。 */
(function () {
  'use strict';
  // 小数のごくわずかな誤差（0.625×1.6 が 1.0000000000000002 になる等）で順番が入れ替わらないように丸める
  var r6 = function (v) { return Math.round((+v || 0) * 1e6) / 1e6; };
  var sec = function (x) { return x.f && x.f.d ? x.f.d / 1000 : 0; };
  // わざ性能のDPS＝図鑑のDPS（威力×タイプ一致÷秒）・EPS＝SPゲージ÷秒。相手によらない
  var dpsOf = function (x) { return sec(x) ? (x.f.p || 0) * (x.stab || 1) / sec(x) : 0; };
  var epsOf = function (x) { return sec(x) ? (x.f.en || 0) / sec(x) : 0; };

  // 引き分けの決め手（2026-10-18タダシさん指示）。sorted＝それまでの決まりで並べ終えた候補（いちばん上が最有力）、
  // same(a,b)＝それまでの決まりで同じか、valAt(x, cpm)＝引き分けた段階の値をそのPLの係数で計算し直したもの、cpms＝PL20〜50の係数。
  // ①PLごとに比べて上回った回数が多いほう ②わざ性能のDPS ③EPS ④特別わざでないもの
  window.gonaviPlTie = function (sorted, same, valAt, cpms) {
    if (!sorted || !sorted.length) return null;
    var g = sorted.filter(function (x) { return same(sorted[0], x); });
    if (g.length < 2) return sorted[0];
    var w = g.map(function () { return 0; });
    if (valAt && cpms && cpms.length) {
      cpms.forEach(function (c) {
        var v = g.map(function (x) { return r6(valAt(x, c)); });
        for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) {
          if (v[i] > v[j]) w[i]++; else if (v[j] > v[i]) w[j]++;
        }
      });
    }
    return g.map(function (x, i) { return { x: x, w: w[i] }; }).sort(function (a, b) {
      return b.w - a.w
        || r6(dpsOf(b.x)) - r6(dpsOf(a.x))
        || r6(epsOf(b.x)) - r6(epsOf(a.x))
        || ((a.x.f && a.x.f.e ? 1 : 0) - (b.x.f && b.x.f.e ? 1 : 0));
    })[0].x;
  };

  // list = [{ f, dmg, half, sel, stab }]（f.e が真なら特別わざ・レガシー）。いちばんふさわしい1つを返す。
  // selAt(x, cpm)・cpms は省略可（省けばPLごとの比べ直しをしない＝答え合わせ用）
  window.pickMaxFast = function (list, selAt, cpms) {
    if (!list || !list.length) return null;
    var sorted = list.slice().sort(function (a, b) {
      return r6(b.dmg) - r6(a.dmg)
        || (b.half ? 1 : 0) - (a.half ? 1 : 0)
        || r6(b.sel) - r6(a.sel);
    });
    return window.gonaviPlTie(sorted, function (a, b) {
      return r6(a.dmg) === r6(b.dmg) && (a.half ? 1 : 0) === (b.half ? 1 : 0) && r6(a.sel) === r6(b.sel);
    }, selAt, cpms);
  };
})();
