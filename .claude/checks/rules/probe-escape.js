// PARTY: [{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"}]
// FOES: medicham~0~COUNTER~ICE_PUNCH~PSYCHIC,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB,bastiodon~0~SMACK_DOWN~STONE_EDGE~FLAMETHROWER
// 倒されそうなときに逃げて、控えに起点を作らせる(2026-09-23タダシさん指示・w=2)の確かめ。
// じぶん1匹(＝交代で逃げられない)×あいての先頭を総当たりし、控えには「じぶんのポケモンをノーマルアタックだけで倒せる」ものを置く。
// 逃げが働いた場面は、同じ場面で「逃げない」と答えさせた結果とくらべる
window.__scenario = function (orig, picks0, foes0) {
  var LIST = ['azumarill','medicham','venusaur','bastiodon','registeel','altaria','skarmory','swampert','lanturn','dewgong',
              'umbreon','talonflame','trevenant','galvantula','cresselia','stunfisk_galarian','jellicent','quagsire','lickitung','toxapex'];
  LIST = LIST.filter(function (k) { return D.pokemon[k] && canFight(k); });
  var mk = function (k) {
    var mv = mockDefaultMoves(k, false);
    var f = { key: k, shadow: false, fast: mv.fast, c1: mv.c1, c2: mv.c2 };
    return { m: f, base: ptBase(f), pol: { fast: mv.fast, charged: spOf(k, [mv.c1, mv.c2]) }, name: ptName(f) };
  };
  var P = {}; LIST.forEach(function (k) { P[k] = mk(k); });
  // 控え: じぶんのポケモンにノーマルアタックだけで勝ち、HPを6割以上残せる
  var farmer = function (u, not) {
    for (var i = 0; i < LIST.length; i++) {
      var b = LIST[i]; if (b === u || b === not) continue;
      var L = Object.assign({}, P[u].base, { fast: P[u].pol.fast, charged: P[u].pol.charged, shields: 2, timing: 'optimal', bluff: false });
      var R = Object.assign({}, P[b].base, { fast: P[b].pol.fast, charged: P[b].pol.charged, shields: 2, timing: 'shots', shotPlan: [], shotRest: null });
      var r = PvpEngine.simulate(D, L, R, SIMOPT);
      if (r.winner === 1 && r.final[1].hp >= 0.6 * r.final[1].hpMax) return b;
    }
    return null;
  };
  var out = { tried: 0, esc: [] };
  ['normal', 'hard'].forEach(function (lv) {
    MK.ai = lv;
    LIST.forEach(function (u) {
      LIST.forEach(function (l) {
        if (l === u) return;
        var b = farmer(u, l) || LIST.filter(function (k) { return k !== u && k !== l; })[0];
        var z = LIST.filter(function (k) { return k !== u && k !== l && k !== b; })[0];
        var picks = [P[u]], foes = [P[l], P[b], P[z]];
        var base = { '0:1:lead:0:0': { a: 'stay' } };
        out.tried++;
        var bt = orig(picks, foes, base, false);
        var keys = [];
        bt.legs.forEach(function (L) { (L.points || []).forEach(function (x) { if (x.side === 1 && x.kind === 'swap' && x.w === 2 && x.ans && x.ans.a !== 'stay') keys.push(x); }); });
        if (!keys.length) return;
        // くらべる相手は「最後まで逃げない」: 逃げが出なくなるまで、出た逃げを「このまま」に固定して回し直す
        var no = Object.assign({}, base), bt2 = null;
        for (var it = 0; it < 12; it++) {
          bt2 = orig(picks, foes, no, false);
          var more = [];
          bt2.legs.forEach(function (L) { (L.points || []).forEach(function (x) { if (x.side === 1 && x.kind === 'swap' && x.w === 2 && x.ans && x.ans.a !== 'stay') more.push(x); }); });
          if (!more.length) break;
          more.forEach(function (x) { no[x.key] = { a: 'stay' }; });
        }
        keys.forEach(function (x) { no[x.key] = { a: 'stay' }; });
        var sum = function (t) { return { outcome: t.outcome, foeLeft: t.foeLeft, foeHp: t.foeHpLeft, turns: t.turns }; };
        out.esc.push({ lv: lv, u: u, lead: l, bench: b, at: keys.map(function (x) { return x.tn + '→' + JSON.stringify(x.ans); }), withEsc: sum(bt), noEsc: sum(bt2) });
      });
    });
  });
  MK.ai = 'easy';
  return out;
};
