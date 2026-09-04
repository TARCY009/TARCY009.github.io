/* レイドバトル(PvE)エンジン — /raid/ が使う。対戦用(pvp-engine.js)とはわざの数値から別物なので共用しない。
   仕様の根拠は CLAUDE.md「レイドバトル(PvE)の戦闘仕様」(2026-08-20確定・実測で裏取り):
   ・こちらの1手目は0.7秒。以後わざの長さの間隔で撃ち続け、ゲージがたまり次第SPアタックを撃つ
   ・ボスは1.6秒・2.6秒・4.6秒に撃ち始め(開幕3発はわざの性能を無視)、4発目以降は「わざの長さ+2秒」ごと
   ・ダメージが入るのは「撃ち始め + そのわざのダメージ発生時間(w)」
   ・ゲージ: わざぶんも被弾ぶんも「ダメージが入った瞬間」に入る(被弾は0.5×ダメージ)。
     ボスは参加者全員の与ダメージ×0.5でためる
   ・ボスのSPアタックは「即打ち」「2回に1回(交互・乱数なし)」「ランダム(撃てるとき1/2)」
   ・SPのみ回避(cfg.dodgeSp): ボスのSPだけ回避する。被ダメージ75%カット(最低1)・
     回避に0.5秒かかるぶん、こちらの次の攻撃が0.5秒遅れる(公開データの回避仕様)
   ・天候ブースト(cfg.wxTypes=対象タイプの配列): 対象タイプのわざが1.2倍。
     こちらだけでなく「ボスのわざ」にも掛かる(2026-08-20タダシさん確認。例: 曇りのきあいだま)
   ・ひんし→次のポケモンは1秒固定。全滅→再突入は既定10秒(設定で変更可)
   ・メガシンカ・ゲンシカイキ(team[i].mega)はパーティに1匹しか入れられないので、そのポケモンがひんしになったら
     控えに関係なく「再突入」(rejoin秒)してパーティの先頭からやり直す(2026-09-04タダシさん指示。
     メガは火力が高いので、メガ1匹で何度も再突入するほうがメガ無しの6匹より速いことがある＝実戦の動き)
   ・チームパワー(cfg.tp=わざ1回あたりの上昇P。2人=1/3人=2/4人=3・0でオフ):
     メーター最大18P。自分のわざ1回ごと(ノーマルもSPも)に+tpされ、満タンなら次のSPアタックが
     2倍になって0Pへ戻る(点灯したら即使う想定)。瀕死交代しても引き継ぐ。
     2026-08-28に外部攻略情報とカネール氏の検証で数値が一致した仕様(タダシさん確認)
   検証: 外部シミュレーターのタイムライン5例(タダシさん提供のスクショ)と完全一致 */
(function (root) {
  'use strict';

  var PLAYER_START = 0.7;          // こちらの1手目
  var BOSS_STARTS = [1.6, 2.6, 4.6]; // ボスの開幕3発の撃ち始め(性能無視)
  var BOSS_GAP = 2.0;              // 4発目以降の硬直(ジム防衛と同じ)
  var SWAP_SEC = 1.0;              // ひんし→次のポケモン(固定)
  var ENERGY_PER_HP = 0.5;         // 被弾1ダメージあたりのゲージ(両者共通)
  var MAX_ENERGY = 100;
  var DODGE_SEC = 0.5;             // 回避モーション(公開データ dodgeDurationMs=500)
  var DODGE_CUT = 0.25;            // 回避時に受けるダメージの割合(75%カット)
  var TP_MAX = 18;                 // チームパワーのメーター最大(外部攻略情報とカネール氏の検証で一致)
  // スーパーメガレイドのシールド(cfg.t7shield・壊さない前提の暫定モデル。レイド火力チェッカーと同じ):
  // ボスのHPが80%を切るとシールドが張られ、以後ずっと ボス防御×4(暫定)・ボス攻撃×1.8(実測確定)
  var SH_AT = 0.8, SH_DEF = 4, SH_ATK = 1.8;

  // 再現できる乱数(同じseedなら同じ結果)。ランダムSPの試行に使う
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // PvEのダメージ式: floor(0.5×威力×攻÷防×タイプ一致×相性×補正)+1
  function damage(pow, atk, def, stab, eff, mult) {
    return Math.floor(0.5 * pow * (atk / def) * stab * eff * (mult || 1)) + 1;
  }

  /* cfg:
     limit  … 制限時間(秒)
     eff    … function(わざタイプ, まもり側タイプ[]) → 相性倍率
     boss   … {types, atk, def, hp, fast, chg}   わざ={n,t,p,d,e,w}
     team   … こちらのパーティ(最大6匹・上から順に出す)。各={types, atk, def, hp, fast, chg, mult, mega}
              mult=シャドウ1.2など攻撃補正。全滅したら同じ6匹で再突入する
     N      … 人数(全員が同じパーティの想定。ボスの被ダメ・ゲージに掛かる)
     spMode … 'asap'(即打ち・既定) | 'alt'(撃てる機会の2回に1回・交互) | 'coin'(撃てるとき1/2)
     tp     … チームパワーのわざ1回あたりの上昇P(0=なし/1=2人/2=3人/3=4人)
     t7shield … trueならスーパーメガのシールド(HP80%から防御4倍・攻撃1.8倍・壊さない前提の暫定モデル)
     rejoin … 全滅→再突入の秒数
     seed   … 乱数の種(coin用)
     wantLog… タイムラインを返すか */
  function simulate(cfg) {
    var LB = cfg.limit, team = cfg.team, bs = cfg.boss, N = cfg.N;
    var rng = mulberry32(cfg.seed || 1);
    var eff = cfg.eff;
    function stab(p, mv) { return p.types.indexOf(mv.t) >= 0 ? 1.2 : 1; }
    function dmgOf(a, d, mv, ap, dp, mult) {
      return damage(mv.p, a, d, stab(ap, mv), eff(mv.t, dp.types), mult);
    }
    // 天候ブースト: 対象タイプのわざは両者とも1.2倍(ボスのわざにも掛かる)
    var wx = cfg.wxTypes || [];
    function wxMul(mv) { return wx.indexOf(mv.t) >= 0 ? 1.2 : 1; }
    // 6匹ぶんのダメージを前計算(与ダメ2種・被ダメ2種)
    // 6匹ぶんのダメージを前計算。[0]=通常 / [1]=シールド中(スーパーメガ・防御4倍/攻撃1.8倍)
    var myF = [[], []], myC = [[], []], myC2 = [[], []], bF = [[], []], bC = [[], []];
    for (var s = 0; s < 2; s++) {
      var bd = s ? bs.def * SH_DEF : bs.def, ba = s ? bs.atk * SH_ATK : bs.atk;
      for (var i = 0; i < team.length; i++) {
        var m = team[i];
        myF[s][i] = dmgOf(m.atk, bd, m.fast, m, bs, m.mult * wxMul(m.fast));
        myC[s][i] = m.chg ? dmgOf(m.atk, bd, m.chg, m, bs, m.mult * wxMul(m.chg)) : 0;
        // チームパワーが乗ったSPアタック(2倍は切り捨ての前に掛ける)
        myC2[s][i] = m.chg ? dmgOf(m.atk, bd, m.chg, m, bs, m.mult * wxMul(m.chg) * 2) : 0;
        bF[s][i] = dmgOf(ba, m.def, bs.fast, bs, m, wxMul(bs.fast));
        bC[s][i] = bs.chg ? dmgOf(ba, m.def, bs.chg, bs, m, wxMul(bs.chg)) : 0;
      }
    }

    // イベント処理: 同じ時刻なら pr の小さい順。
    //   行動判断(こちら0 → ボス0.5) → ダメージ(こちら1 → ボス1.5)
    // 行動判断がダメージより先＝同じ瞬間に入るゲージはその判断に間に合わない(実測どおり)。
    // 同時刻のダメージは「こちらが先」(外部シミュレーターの表示順と同じ)
    var ev = [];
    function pop() {
      var bi = 0;
      for (var i = 1; i < ev.length; i++) {
        if (ev[i].t < ev[bi].t - 1e-9 || (Math.abs(ev[i].t - ev[bi].t) < 1e-9 && ev[i].pr < ev[bi].pr)) bi = i;
      }
      return ev.splice(bi, 1)[0];
    }

    var t = 0, myGen = 0, mon = 0, faints = 0, wipes = 0;
    var myHP = team[0].hp, myE = 0, bE = 0, total = 0, win = false, endT = null;
    var tp = cfg.tp || 0, tpMeter = 0;   // チームパワー(瀕死交代しても引き継ぐのでポケモンごとに戻さない)
    var sh = 0;                          // スーパーメガのシールド(0=展開前 1=展開中。ダメージ表の添字)
    var spOpp = 0;        // 'alt'用: SPを撃てた機会の数(2回に1回撃つ)
    var activeFrom = 0;   // この時刻までこちらのポケモンは場にいない(交代・再突入の待ち)
    var pendAct = null;   // 予約中のこちらの行動(回避したらこの開始を0.5秒うしろへずらす)
    var log = [];
    function L(o) { if (cfg.wantLog) log.push(o); }
    function pushAct(tt, g) { pendAct = { t: tt, pr: 0, k: 'act', g: g }; ev.push(pendAct); }

    pushAct(PLAYER_START, 0);
    ev.push({ t: BOSS_STARTS[0], pr: 0.5, k: 'bact', n: 1 });

    while (ev.length) {
      var e = pop(); t = e.t;
      if (t > LB + 1e-9) break;
      if (e.k === 'act') {                       // こちらの行動(わざを選んで撃ち始める)
        if (e.g !== myGen) continue;             // ひんし前に予約した行動は無効
        var cur = team[mon];
        var useC = cur.chg && myE >= Math.abs(cur.chg.e);
        var mv = useC ? cur.chg : cur.fast;
        if (useC) myE -= Math.abs(cur.chg.e);
        // チームパワー: 満タンならこのSPアタックが2倍(点灯したら即使う想定)。
        // メーターはノーマルもSPも「使うたび」に+tp(先に2倍の判定をしてから足す)
        var tpBoost = false;
        if (tp) {
          if (useC && tpMeter >= TP_MAX) { tpBoost = true; tpMeter = 0; }
          tpMeter = Math.min(TP_MAX, tpMeter + tp);
        }
        // ダメージは当たった瞬間のシールド状態で決める(hit側で表を引く)
        ev.push({ t: t + mv.w, pr: 1, k: 'hit', g: myGen, mv: mv, sp: useC, tp: tpBoost, mi: mon });
        pushAct(t + mv.d, myGen);
      } else if (e.k === 'hit') {                // こちらのダメージが入る(ゲージもこの瞬間に入る)
        if (e.g !== myGen) continue;             // 撃っている途中で倒れたぶんは消える
        var md = e.sp ? (e.tp ? myC2[sh][e.mi] : myC[sh][e.mi]) : myF[sh][e.mi];
        total += md;
        if (!e.sp) myE = Math.min(MAX_ENERGY, myE + e.mv.e);
        bE = Math.min(MAX_ENERGY, bE + md * ENERGY_PER_HP * N);   // ボスは全員ぶんでためる
        L({ t: t, side: 'me', mv: e.mv, dmg: md, sp: e.sp, tp: e.tp, mi: e.mi,
            bl: Math.max(0, bs.hp - total * N), mh: myHP });
        if (total * N >= bs.hp) { win = true; endT = t; break; }
        // スーパーメガ: HPが80%を切った瞬間にシールド展開(壊さない前提の暫定モデル)
        if (cfg.t7shield && !sh && total * N >= bs.hp * (1 - SH_AT)) {
          sh = 1;
          L({ t: t, side: 'sys', note: 'ボスがシールドを展開（以後 防御4倍・攻撃1.8倍の暫定値・壊さない前提）', bl: Math.max(0, bs.hp - total * N), mh: myHP });
        }
      } else if (e.k === 'bact') {               // ボスの行動
        var canC = bs.chg && bE >= Math.abs(bs.chg.e);
        var bUseC = false;
        if (canC) {
          if (cfg.spMode === 'coin') bUseC = rng() < 0.5;
          else if (cfg.spMode === 'alt') { spOpp++; bUseC = spOpp % 2 === 0; }  // 2回に1回(交互)
          else bUseC = true;                                                    // 即打ち
        }
        var bmv = bUseC ? bs.chg : bs.fast;
        if (bUseC) bE -= Math.abs(bs.chg.e);
        // 被ダメージは当たった瞬間に「そのとき場にいるポケモン」で計算する
        ev.push({ t: t + bmv.w, pr: 1.5, k: 'bhit', mv: bmv, sp: bUseC });
        var nt = e.n < 3 ? BOSS_STARTS[e.n] : t + bmv.d + BOSS_GAP;
        ev.push({ t: nt, pr: 0.5, k: 'bact', n: e.n + 1 });
      } else if (e.k === 'bhit') {               // ボスのダメージが入る
        if (t < activeFrom - 1e-9) {             // 交代・再突入の待ちの間は当たらない
          L({ t: t, side: 'boss', mv: e.mv, dmg: 0, sp: e.sp, miss: true, bl: Math.max(0, bs.hp - total * N), mh: myHP });
          continue;
        }
        var d = e.sp ? bC[sh][mon] : bF[sh][mon];
        var dodged = false;
        if (e.sp && cfg.dodgeSp) {               // SPのみ回避: 75%カット+次の攻撃が0.5秒遅れる
          d = Math.max(1, Math.floor(d * DODGE_CUT));
          if (pendAct && pendAct.g === myGen && pendAct.t > t - 1e-9) pendAct.t += DODGE_SEC;
          dodged = true;
        }
        myHP -= d;
        myE = Math.min(MAX_ENERGY, myE + d * ENERGY_PER_HP);
        if (!e.sp) bE = Math.min(MAX_ENERGY, bE + e.mv.e);   // ボスも自分のわざぶんをためる
        L({ t: t, side: 'boss', mv: e.mv, dmg: d, sp: e.sp, mi: mon, dodged: dodged,
            bl: Math.max(0, bs.hp - total * N), mh: Math.max(0, myHP) });
        if (myHP <= 0) {
          myGen++; faints++;
          myE = 0;
          var blNow = Math.max(0, bs.hp - total * N);
          if (team[mon].mega) {
            // メガシンカ・ゲンシカイキは1匹だけ → ひんしになったら控えを出さずに再突入してやり直す
            wipes++; mon = 0;
            activeFrom = t + cfg.rejoin;
            L({ t: t, side: 'sys', note: 'メガシンカ・ゲンシカイキがひんし → 再突入(' + cfg.rejoin + '秒・メガは1匹だけなので控えは出さない)', bl: blNow, mh: 0 });
          } else if (mon < team.length - 1) {
            mon++;
            activeFrom = t + SWAP_SEC;
            L({ t: t, side: 'sys', note: 'ひんし → 次のポケモン(1秒)', bl: blNow, mh: 0 });
          } else {
            wipes++; mon = 0;
            activeFrom = t + cfg.rejoin;
            L({ t: t, side: 'sys', note: '全滅 → 再突入(' + cfg.rejoin + '秒)', bl: blNow, mh: 0 });
          }
          myHP = team[mon].hp;
          pushAct(activeFrom, myGen);
        }
      }
    }
    return {
      win: win, t: win ? endT : LB, faints: faints, wipes: wipes,
      dmg: total, bossLeft: Math.max(0, bs.hp - total * N), log: log
    };
  }

  root.RaidEngine = { simulate: simulate, damage: damage,
    PLAYER_START: PLAYER_START, BOSS_STARTS: BOSS_STARTS, BOSS_GAP: BOSS_GAP };
})(typeof window !== 'undefined' ? window : globalThis);
