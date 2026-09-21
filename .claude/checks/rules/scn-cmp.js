// PARTY: [{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"medicham","fast":"COUNTER","c1":"POWER_UP_PUNCH","c2":"ICE_PUNCH"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: azumarill~0~BUBBLE~ICE_BEAM~PLAY_ROUGH,skarmory~0~AIR_SLASH~SKY_ATTACK~BRAVE_BIRD,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB
// 同時発動(CMP): ①攻撃がまったく同じならランダム(模擬戦はバトルごとの種) ②シャドウの1.2倍と能力変化は先後に関係しない
window.__scenario = function (orig, picks, foes) {
  var firstSp = function (res) {   // 両者のSPが同じターンに解決した最初の場面で、先に解決した側
    var rows = res.rows, tn = 0, seen = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (r.tn !== '-') tn = r.tn;
      for (var s = 0; s < 2; s++) if (r.ev[s] && r.ev[s].full !== undefined) { (seen[tn] = seen[tn] || []).push(s); }
    }
    for (var k in seen) if (seen[k].length === 2) return seen[k][0];
    return null;
  };
  var cfg = function (P, extra) { return Object.assign({}, P.base, { fast: P.pol.fast, charged: P.pol.charged.slice(0, 2), timing: 'asap', shields: 0 }, extra || {}); };
  var out = {};
  // ① ミラー: 模擬戦の通しを種を変えて20回。先に動く側が両方出ること・同じ種なら同じ結果
  var cnt = [0, 0], same = true;
  for (var seed = 1; seed <= 20; seed++) {
    RB.rseed = seed * 7919;
    var a = firstSp(orig(picks, foes, {}, false).legs[0].res), b = firstSp(orig(picks, foes, {}, false).legs[0].res);
    if (a !== b) same = false;
    if (a != null) cnt[a]++;
  }
  out.mirror = { meFirst: cnt[0], foeFirst: cnt[1], sameSeedSameResult: same };
  // ② 攻撃の低い側をシャドウにしても先後は変わらない(素の攻撃で比べる)
  var L = cfg(picks[0]), R = cfg(foes[0], { ivs: [15, 15, 15] });
  var aL = PvpEngine.buildStats(D, L).atk, aR = PvpEngine.buildStats(D, R).atk;
  var lo = aL < aR ? 0 : 1;
  var plain = firstSp(PvpEngine.simulate(D, L, R, { buffMode: 'none' }));
  var sh = [L, R]; sh[lo] = Object.assign({}, sh[lo], { shadow: true });
  var shAtk = PvpEngine.buildStats(D, sh[lo]).atk;
  out.shadow = { atk: [aL, aR], lowSide: lo, lowSideShadowAtk: shAtk, firstPlain: plain, firstWithShadow: firstSp(PvpEngine.simulate(D, sh[0], sh[1], { buffMode: 'none' })) };
  return out;
};
