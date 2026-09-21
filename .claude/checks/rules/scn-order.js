// PARTY: [{"key":"medicham","fast":"COUNTER","c1":"ICE_PUNCH","c2":"POWER_UP_PUNCH"},{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: altaria~0~DRAGON_BREATH~SKY_ATTACK~MOONBLAST,azumarill~0~BUBBLE~ICE_BEAM~PLAY_ROUGH,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB
// 同じターンのノーマルとSPの順番(2026-09-22タダシさん確定):
//  (1)ふつうは、SPを入力したターンに当たるノーマルが先  (2)そのノーマルで倒れてしまうならSPが先・そのノーマルは入らない
//  (3)打ちかけ(途中)のノーマルの最中にSPを撃たれたらSPが先
window.__scenario = function (orig, picks, foes) {
  var cfg = function (P, x) { return Object.assign({}, P.base, { fast: P.pol.fast, charged: P.pol.charged.slice(0, 1), timing: 'asap', shields: 0 }, x || {}); };
  var turn = function (res, n) {   // nターン目の出来事を処理された順に
    var out = [], tn = 0;
    res.rows.forEach(function (r) { if (r.tn !== '-') tn = r.tn; if (tn !== n) return;
      [0, 1].forEach(function (s) { var e = r.ev[s]; if (e) out.push((s ? '右 ' : '左 ') + e.move + (e.full !== undefined ? '(SP)' : e.forwarded ? '(差し込み)' : '') + ' -' + e.dmg); }); });
    return out;
  };
  var hpAt = function (res, n, s) { var tn = 0, hp = null; res.rows.forEach(function (r) { if (r.tn !== '-') tn = r.tn; if (tn === n) hp = r.state[s].hp; }); return hp; };
  var o = { buffMode: 'none' }, out = {};
  // (1) 左=チャーレム(ゲージ満タン・HP満タン) 対 右=チルタリス(りゅうのいぶき＝1ターンわざ): 1ターン目に両方が起きる
  var r1 = PvpEngine.simulate(D, cfg(picks[0], { startEn: 100 }), cfg(foes[0], { charged: [] }), o);
  out.normal = { turn1: turn(r1, 1) };
  // (2) 同じ場面で、チャーレムのHPが残りわずか(その1発で倒れてしまう)
  var r2 = PvpEngine.simulate(D, cfg(picks[0], { startEn: 100, startHpPct: 1 }), cfg(foes[0], { charged: [] }), o);
  out.lethal = { turn1: turn(r2, 1), leftHpAfterTurn1: hpAt(r2, 1, 0), turn2: turn(r2, 2), leftHpAfterTurn2: hpAt(r2, 2, 0) };
  // (3) 右=マリルリ(あわ＝3ターン)の真ん中の2ターン目に、左=チルタリス(1ターンわざなので2ターン目に動ける)がSP
  var r3 = PvpEngine.simulate(D, cfg(foes[0], { timing: 'plan', plan: [{ on: 2, move: foes[0].pol.charged[0] }], startEn: 100 }), cfg(picks[1], { charged: [] }), o);
  out.midFast = { turn2: turn(r3, 2), turn3: turn(r3, 3), turn4: turn(r3, 4) };
  return out;
};
