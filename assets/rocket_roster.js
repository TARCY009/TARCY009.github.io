// GOロケット団（したっぱ・リーダー・サカキ）の手持ちデータ
// ------------------------------------------------------------------
// ⚠ build_rocket.py が毎日つくる生成物。3つの外部攻略情報を読み、3つとも一致した人だけを書き換える
// （そろうまでは前のまま）。手で直したいときもこのファイルを直してよいが、3つの情報がそろって
// 別の中身になった日に上書きされる。
// slots = [1匹目の候補, 2匹目の候補, 3匹目の候補]。候補が1つなら固定、2つ以上ならランダム。
// 中身は pvp_data.js のポケモンキー。あいては必ずシャドウなので、ここには書かない。
// わざは公開情報が安定しないため持たない（画面の選択欄で選ぶ／既定はおぼえるわざの先頭）。
// grunt の id は「タイプ」（同じタイプに2人いれば _m=♂ / _f=♀）、none=セリフにタイプなし、decoy=おとり。
window.ROCKET_ROSTER = {
  updated: '2026年10月10日',
  list: {
    leader: [
      { id: 'sierra', name: 'シエラ', slots: [
        ['pancham'],
        ['blastoise', 'flygon', 'ferrothorn'],
        ['milotic', 'houndoom', 'steelix'],
      ] },
      { id: 'cliff', name: 'クリフ', slots: [
        ['cubone'],
        ['snorlax', 'golurk', 'weezing_galarian'],
        ['tyranitar', 'camerupt', 'gallade'],
      ] },
      { id: 'arlo', name: 'アルロ', slots: [
        ['grimer_alolan'],
        ['steelix', 'golurk', 'slowbro'],
        ['alakazam', 'charizard', 'scizor'],
      ] },
    ],
    boss: [
      { id: 'giovanni', name: 'サカキ', slots: [
        ['persian'],
        ['kangaskhan', 'rhyperior', 'machamp'],
        ['zekrom'],
      ] },
    ],
    grunt: [
      { id: 'normal', name: 'ノーマル', slots: [
        ['teddiursa', 'hoothoot', 'porygon'],
        ['loudred', 'stufful', 'starly'],
        ['ursaring', 'swellow', 'kangaskhan'],
      ] },
      { id: 'grass', name: 'くさ', slots: [
        ['phantump', 'fomantis', 'tangela'],
        ['lileep', 'sceptile', 'morelull'],
        ['chesnaught', 'trevenant', 'cradily'],
      ] },
      { id: 'fire', name: 'ほのお', slots: [
        ['litwick', 'ponyta', 'torchic'],
        ['magmar', 'blaziken', 'camerupt'],
        ['darmanitan_standard', 'delphox', 'magmortar'],
      ] },
      { id: 'water_f', name: 'みず♀', slots: [
        ['mudkip', 'tentacool', 'krabby'],
        ['dewpider', 'swampert', 'sharpedo'],
        ['walrein', 'greninja', 'tentacruel'],
      ] },
      { id: 'water_m', name: 'みず♂', slots: [
        ['magikarp', 'feebas'],
        ['magikarp'],
        ['magikarp', 'gyarados'],
      ] },
      { id: 'electric', name: 'でんき', slots: [
        ['voltorb', 'shinx', 'helioptile'],
        ['geodude_alolan', 'magnemite', 'electabuzz'],
        ['ampharos', 'luxray', 'galvantula'],
      ] },
      { id: 'ice', name: 'こおり', slots: [
        ['seel', 'delibird', 'spheal'],
        ['sealeo', 'froslass', 'ninetales_alolan'],
        ['aurorus', 'froslass', 'glalie'],
      ] },
      { id: 'rock', name: 'いわ', slots: [
        ['onix', 'kabuto', 'cranidos'],
        ['shieldon', 'graveler', 'cranidos'],
        ['tyrantrum', 'golem', 'aurorus'],
      ] },
      { id: 'flying', name: 'ひこう', slots: [
        ['taillow', 'rookidee', 'swablu'],
        ['scyther', 'zubat', 'gligar'],
        ['dragonite', 'toucannon', 'swanna'],
      ] },
      { id: 'bug', name: 'むし', slots: [
        ['venonat', 'weedle', 'wimpod'],
        ['pinsir', 'anorith', 'dewpider'],
        ['scizor', 'scolipede', 'vikavolt'],
      ] },
      { id: 'psychic', name: 'エスパー', slots: [
        ['wobbuffet', 'ralts', 'drowzee'],
        ['drowzee', 'duosion', 'wobbuffet'],
        ['gallade', 'malamar', 'reuniclus'],
      ] },
      { id: 'ghost', name: 'ゴースト', slots: [
        ['duskull', 'sandygast', 'yamask'],
        ['dusclops', 'sableye', 'cofagrigus'],
        ['gengar', 'froslass', 'cofagrigus'],
      ] },
      { id: 'fighting', name: 'かくとう', slots: [
        ['timburr', 'mankey', 'makuhita'],
        ['hitmontop', 'hitmonlee', 'hitmonchan'],
        ['conkeldurr', 'annihilape', 'infernape'],
      ] },
      { id: 'ground', name: 'じめん', slots: [
        ['rhyhorn', 'gligar', 'trapinch'],
        ['gligar', 'claydol', 'vibrava'],
        ['golurk', 'hippowdon', 'flygon'],
      ] },
      { id: 'poison', name: 'どく', slots: [
        ['oddish', 'zubat', 'qwilfish'],
        ['weezing_galarian', 'nidorino', 'nidorina'],
        ['weezing', 'toxicroak', 'amoonguss'],
      ] },
      { id: 'dragon', name: 'ドラゴン', slots: [
        ['noibat', 'deino', 'axew'],
        ['exeggutor_alolan', 'dragonair', 'gabite'],
        ['dragonite', 'garchomp', 'salamence'],
      ] },
      { id: 'steel', name: 'はがね', slots: [
        ['sandshrew_alolan', 'aron', 'beldum'],
        ['lairon', 'skarmory', 'metang'],
        ['aggron', 'sandslash_alolan', 'probopass'],
      ] },
      { id: 'dark', name: 'あく', slots: [
        ['carvanha', 'poochyena', 'rattata_alolan'],
        ['sneasel', 'houndour', 'absol'],
        ['liepard', 'hydreigon'],
      ] },
      { id: 'fairy', name: 'フェアリー', slots: [
        ['ralts', 'snubbull', 'vulpix_alolan'],
        ['snubbull', 'weezing_galarian', 'kirlia'],
        ['ninetales_alolan', 'weezing_galarian', 'granbull'],
      ] },
      { id: 'none_f', name: 'タイプなし♀', slots: [
        ['snorlax', 'lapras'],
        ['poliwrath', 'gardevoir', 'snorlax'],
        ['gyarados', 'dragonite', 'snorlax'],
      ] },
      { id: 'none_m', name: 'タイプなし♂', slots: [
        ['bulbasaur', 'charmander', 'squirtle'],
        ['ivysaur', 'charmeleon', 'wartortle'],
        ['venusaur', 'charizard', 'blastoise'],
      ] },
      { id: 'decoy', name: 'おとり', slots: [
        ['bellsprout'],
        ['raticate', 'weepinbell'],
        ['raticate', 'snorlax'],
      ] },
    ],
  },
};
