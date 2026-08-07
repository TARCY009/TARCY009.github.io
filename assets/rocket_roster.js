// GOロケット団リーダー（シエラ・クリフ・アルロ）とサカキの手持ちデータ
// ------------------------------------------------------------------
// 手持ちはイベントやシーズンの切り替わりで入れ替わる。更新するときは updated の日付と
// slots の中身だけを直せばよい（画面・URL共有は自動で追従する）。
// slots = [1匹目の候補, 2匹目の候補, 3匹目の候補]。1匹目は固定なので候補は1つ。
// 中身は pvp_data.js のポケモンキー。あいては必ずシャドウなので、ここには書かない。
// わざは公開情報が安定しないため持たない（画面の選択欄で選ぶ／既定はおぼえるわざの先頭）。
//
// 出典: 外部攻略情報を複数つき合わせて集計し、ユーザーが確認済み（2026-08-07時点）
window.ROCKET_ROSTER = {
  updated: '2026年8月7日',
  list: {
    leader: [
      { id: 'sierra', name: 'シエラ', slots: [
        ['amaura'],
        ['ferrothorn', 'flygon', 'blastoise'],
        ['houndoom', 'steelix', 'milotic'],
      ] },
      { id: 'cliff', name: 'クリフ', slots: [
        ['axew'],
        ['snorlax', 'golurk', 'weezing_galarian'],
        ['tyranitar', 'gallade', 'camerupt'],
      ] },
      { id: 'arlo', name: 'アルロ', slots: [
        ['tyrunt'],
        ['slowbro', 'steelix', 'golurk'],
        ['scizor', 'alakazam', 'charizard'],
      ] },
    ],
    boss: [
      { id: 'giovanni', name: 'サカキ', slots: [
        ['persian'],
        ['rhyperior', 'kangaskhan', 'machamp'],
        ['reshiram'],
      ] },
    ],
  },
};
