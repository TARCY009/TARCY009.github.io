// PARTY: [{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"ninetales","fast":"FIRE_SPIN","c1":"WEATHER_BALL_FIRE","c2":"OVERHEAT"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: azumarill~0~BUBBLE~ICE_BEAM~PLAY_ROUGH,skarmory~0~AIR_SLASH~SKY_ATTACK~BRAVE_BIRD,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB
// パーティのルール: 同じポケモン(図鑑番号)は入れられない・メタモン/ヌケニンは候補に出ない。ロケット団戦では同じポケモンを使える
window.__scenario = function () {
  var out = {
    banInAll: ['ditto', 'shedinja'].map(function (k) { return KEYS_ALL.indexOf(k) >= 0; }),
    banCanFight: ['ditto', 'shedinja'].map(function (k) { return canFight(k); }),
    sameMon: partyNg(PT, 'azumarill', 1),          // 1枠目と同じ
    sameSlot: partyNg(PT, 'azumarill', 0),         // 自分の枠を入れ直すのはOK
    alolan: partyNg(PT, 'ninetales_alolan', 2),    // 地方のすがたも同じポケモン
    other: partyNg(PT, 'medicham', 2),
    foeSide: partyNg(GBT, 'skarmory', 0)
  };
  var save = mode; mode = 'rocket';
  out.rocketSameMon = partyNg(PT, 'azumarill', 1);  // ロケット団戦は使える
  mode = save;
  return out;
};
