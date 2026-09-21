// PARTY: [{"key":"mimikyu","fast":"SHADOW_CLAW","c1":"SHADOW_SNEAK","c2":"PLAY_ROUGH"},{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: azumarill~0~BUBBLE~ICE_BEAM~PLAY_ROUGH,skarmory~0~AIR_SLASH~SKY_ATTACK~BRAVE_BIRD,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB
// ① SP直後の交代は1ターン消費なし／ふつうの交代は1ターン消費  ② ミミッキュのばれたすがたの防御-1は交代しても残る
window.__scenario = function (orig, picks, foes) {
  var first = function (bt) {   // 次の対面の1ターン目にじぶんが動けなかったか
    var l = bt.legs[1]; if (!l) return null;
    var r = l.res.rows[0];
    return { me: l.meName, stalled0: !!(r.stalled && r.stalled[0]), b0: l.hud.b0, sw0: bt.legs[0].swapped0, t0: bt.legs[0].res.turns,
             swapHit: l.swapHit || null };
  };
  // シールドは使わない(ばけのかわを使わせる)
  var base = { '0:0:sh:0:0': { a: 'no' }, '0:0:sh:1:0': { a: 'no' } };
  var bt0 = orig(picks, foes, Object.assign({}, base), false);
  var rows = bt0.legs[0].res.rows, spT = null, foeSpT = null, tn = 0;
  rows.forEach(function (r) {
    if (r.tn !== '-') tn = r.tn;
    if (r.ev[0] && r.ev[0].full !== undefined && spT == null) spT = tn;
    if (r.ev[1] && r.ev[1].full !== undefined && foeSpT == null) foeSpT = tn;
  });
  var out = { mySpTurn: spT, foeSpTurn: foeSpT };
  var run = function (t) {
    var a = Object.assign({}, base); a['0:0:msw:' + t + ':0'] = { a: 'toq', to: 1, p: t };
    for (var li = 1; li < 9; li++) a[li + ':0:next:0:0'] = { a: 'to', to: 0 };
    return orig(picks, foes, a, false);
  };
  if (spT) out.afterMySp = first(run(spT));
  if (foeSpT) {
    var b = run(foeSpT);
    out.afterFoeSp = first(b);
    // ミミッキュが戻ってきた対面の開始時の能力変化
    out.mimikyuBack = b.legs.filter(function (l, i) { return i > 1 && l.meName.indexOf('ミミッキュ') >= 0; })
      .map(function (l) { return { li: l.li, b0: l.hud.b0 }; })[0] || null;
  }
  out.normalSwap = first(run(4));   // SPの無いターンの交代(シャドークローは2ターン)
  return out;
};
