// PARTY: [{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"medicham","fast":"COUNTER","c1":"POWER_UP_PUNCH","c2":"ICE_PUNCH"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: venusaur~0~RAZOR_LEAF~FRENZY_PLANT~SLUDGE_BOMB,skarmory~0~AIR_SLASH~SKY_ATTACK~BRAVE_BIRD,azumarill~0~BUBBLE~ICE_BEAM~PLAY_ROUGH
// 瀕死の控えへ交代 → 相手の打ちかけのノーマルアタック1発で、出てきたその場で倒れる → 次のポケモンを選ぶ
window.__scenario = function (orig, picks, foes) {
  var sum = function (bt) { return bt.legs.map(function (l) {
    return { li: l.li, me: l.meName, foe: l.foeName, turns: l.res.turns, sw0: l.swapped0, meDown: l.meDown, foeDown: l.foeDown,
             hp0start: l.hud.hp0, hp0end: l.res.final[0].hp, swapHit: l.swapHit || null }; }); };
  // ① マリルリのHPがいちばん少なくなる切れ目でチャーレムへ交代
  var best = null;
  for (var t1 = 60; t1 >= 1; t1--) {
    var a = {}; a['0:0:msw:' + t1 + ':0'] = { a: 'toq', to: 1, p: t1 };
    var bt = orig(picks, foes, a, false);
    var l0 = bt.legs[0];
    if (!l0 || !l0.swapped0) continue;
    var hp = l0.res.final[0].hp;
    if (hp > 0 && (!best || hp < best.hp)) best = { t1: t1, hp: hp, a: a };
    if (best && best.hp <= 12) break;
  }
  if (!best) return { err: '①の交代が作れない' };
  // ② あとの対面で、相手のノーマルアタックの途中にマリルリへ交代する位置を探す
  for (var li = 1; li <= 5; li++) for (var t2 = 1; t2 <= 80; t2++) {
    var a2 = Object.assign({}, best.a); a2[li + ':0:msw:' + t2 + ':0'] = { a: 'toq', to: 0, p: t2 };
    var b2 = orig(picks, foes, a2, false);
    for (var i = 1; i < b2.legs.length; i++) {
      var L = b2.legs[i];
      if (L.meName.indexOf('マリルリ') >= 0 && b2.legs[i - 1].swapped0 && L.res.turns === 1 && L.meDown) {
        var draw = 'ok'; try { var box = document.createElement('div'); document.body.appendChild(box); gbRender(box, b2, picks, foes);
          draw = { rows: box.querySelectorAll('.fi').length, ko: (box.textContent.match(/マリルリ[^。]{0,12}たおれ/g) || []).length }; } catch (e) { draw = 'ERR ' + (e && e.stack || e); }
        return { draw: draw, azuHpAtSwapOut: best.hp, found: { li: li, t2: t2 }, outcome: b2.outcome, legs: sum(b2).slice(Math.max(0, i - 1), i + 3),
                 koRow: L.res.rows, clockBase: [b2.legs[i].base, b2.legs[i + 1] && b2.legs[i + 1].base] };
      }
    }
  }
  return { azuHpAtSwapOut: best.hp, err: '②の交代が作れない' };
};
