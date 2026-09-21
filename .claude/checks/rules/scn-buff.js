// PARTY: [{"key":"medicham","fast":"COUNTER","c1":"POWER_UP_PUNCH","c2":"ICE_PUNCH"},{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: bastiodon~0~SMACK_DOWN~STONE_EDGE~FLAMETHROWER,skarmory~0~AIR_SLASH~SKY_ATTACK~BRAVE_BIRD,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB
// チャーレムがグロウパンチで攻撃を上げてから交代 → 出し直したとき攻撃の上昇が残っているか
window.__scenario = function (orig, picks, foes) {
  var ans = {};
  ans['0:0:msw:24:0'] = { a: 'toq', to: 1, p: 24 };
  for (var li = 1; li < 9; li++) ans[li + ':0:next:0:0'] = { a: 'to', to: 0 };
  var bt = orig(picks, foes, ans, false);
  return { outcome: bt.outcome, legs: bt.legs.map(function (l) {
    return { li: l.li, me: l.meName, foe: l.foeName, turns: l.res.turns, sw0: l.swapped0, sw1: l.swapped1,
      b0: l.hud.b0, b1: l.hud.b1, hp0: l.hud.hp0, endBuff0: l.res.final[0].buffs };
  }) };
};
