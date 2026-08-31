// GBL対面シミュレーター(/gbl/)とロケット団対策(/rocket/)の共通アプリ本体。
// 2ページは見た目・入口が別のツールだが、計算と画面の中身はこの1ファイルを共有する。
// ページの違いは PAGE_ROCKET / PAGE_BLOG で分岐する(各ページの index.html が読み込み前にフラグを立てる)
const PAGE_ROCKET = !!window.PAGE_ROCKET;
const PAGE_BLOG = !!window.PAGE_BLOG;   // 対戦記録ページ(/battlelog/)。モードは 'blog' に固定

// ---- 画面の骨組み(両ページ共通。ここで注入して二重管理を防ぐ) ----
document.getElementById('app').innerHTML = `
<div class="wrap">
<header>
  <h1><span>GOバトルリーグ</span> <b>対面シミュレーター</b></h1>
  <div id="themesw"></div>
</header>

<div class="easyrow"><button class="easybtn" id="easybtn" title="はじめての方向けの案内。質問に答えると、目的に合った画面へ設定済みの状態で移動します"><span class="lf">🔰</span>かんたん案内</button></div>

<div class="leagues" id="leagues">
  <button class="lgbtn" data-cap="1500" aria-pressed="true" title="CP1500以下で戦うリーグ">スーパー</button>
  <button class="lgbtn" data-cap="2500" aria-pressed="false" title="CP2500以下で戦うリーグ">ハイパー</button>
  <button class="lgbtn" data-cap="0" aria-pressed="false" title="CP制限なしのリーグ">マスター</button>
  <button class="lgbtn" id="cupTab" aria-pressed="false" title="特殊レギュレーションの一覧を開く">特殊カップ</button>
</div>
<div class="popwin cupwin" id="cupwin" style="display:none">
  <div class="popttl">特殊カップを選ぶ</div>
  <div class="slots cupslots" id="cupslots"></div>
  <button class="pasttab" id="pasttab" aria-expanded="false" title="過去に開催された特殊カップの環境。そのカップが最後に開催されたときの上位100匹を残してあります">🕘 過去のカップ</button>
  <div class="slots cupslots pastslots" id="pastslots" style="display:none"></div>
</div>

<div class="modes" id="modes">
  <div class="modegrp">じっくり分析する</div>
  <button data-m="duel" aria-pressed="true" title="1匹どうしの対面を、わざ・個体値・シールドまで指定して詳しくシミュレートする">1対1シミュ</button>
  <button data-m="multi" aria-pressed="false" title="じぶんのポケモンを環境上位50匹と一括対戦">環境一覧</button>
  <button data-m="counter" aria-pressed="false" title="あいてに勝てるポケモン（対策）を環境上位から総当たりで探す">対策さがし</button>
  <button data-m="party" aria-pressed="false" title="パーティ3匹で環境上位に何匹勝てるかを調べ、穴(3匹とも負ける相手)を洗い出す">パーティ診断</button>
  <button data-m="blog" aria-pressed="false" title="GBLで戦った相手のパーティを記録して、自分のレート帯の環境(採用率)と刺さるポケモンを分析する">対戦記録</button>
  <div class="modegrp">実戦を戦う</div>
  <button class="mockhero" data-m="mock" aria-pressed="false" title="じぶん3匹×あいて3匹の対人戦を通しでシミュレート。SPアタック・シールド・交代を、決断の場面ごとに自分で選べます"><span class="pl">▶</span><span class="tx"><b class="t1">模擬戦</b><span class="t2">実戦形式で3対3をためす</span></span></button>
  <button data-m="rocket" aria-pressed="false" title="GOロケット団(したっぱ/リーダー/サカキ)との戦いを再現する。相手はSPアタックのあと動けなくなる(硬直)">ロケット団戦</button>
</div>

<div class="rocket" id="rocket" style="display:none">
  <div class="rkrow rkmoderow">
    <div class="opts rkmode" id="rkmode">
      <button data-v="0" aria-pressed="true" title="1匹どうしの対面だけを計算します">1対1モード</button><button class="mockhero" data-v="1" aria-pressed="false" title="じぶんの3匹とあいての手持ちを、倒れたら次…と通しで戦います。SPアタックを撃つ・温存する・シールドを使う・交代するを、決断の場面ごとに自分で選べます"><span class="pl">▶</span><span class="tx"><b class="t1">模擬戦モード</b><span class="t2">実戦形式で3匹の通しをためす</span></span></button>
    </div>
  </div>
  <div class="rkrow">
    <span class="lbl">あいて</span>
    <div class="opts rkkind" id="rkkind">
      <button data-v="grunt" aria-pressed="true" title="したっぱ・ムサシ・コジロウ。シールドを使いません">したっぱ</button><button data-v="leader" aria-pressed="false" title="シエラ・クリフ・アルロ。こちらの最初の2発のSPアタックを必ずシールドで防ぎます">リーダー</button><button data-v="boss" aria-pressed="false" title="サカキ。こちらの最初の2発のSPアタックを必ずシールドで防ぎます">サカキ</button>
    </div>
  </div>
  <div class="rkroster" id="rkroster" style="display:none">
    <div class="rkrow">
      <span class="lbl">だれと</span>
      <div class="opts rkwho" id="rkwho"></div>
    </div>
    <div class="rklineup" id="rklineup"></div>
  </div>
  <div class="rkrow rksep" id="rkenterrow">
    <span class="lbl" title="この対面が始まった時点で、あいてが動けない状態かどうか">敵硬直</span>
    <div class="opts rkenter" id="rkenter">
      <button data-v="first" aria-pressed="true" title="開幕から出ている1匹目。硬直なしで動き出します">開幕</button><button data-v="ko" aria-pressed="false" title="ポケモンが倒れて（自分or敵）次が出てきた直後。あいては4秒(8ターン)動けません">撃破後</button><button data-v="swap" aria-pressed="false" title="自分から交代した直後。あいては4.5秒(9ターン)動けませんが、自分も0.5秒(1ターン)動けません">交代後</button>
    </div>
  </div>
  <!-- 1対1のときだけ: 対策(おすすめランキング / シミュレート)と絞り込み -->
  <div class="rkrow rkviewrow rksep" id="rkviewrow" style="display:none">
    <span class="lbl">対策</span>
    <div class="opts" id="rkviewbtns">
      <button data-v="power" aria-pressed="true" title="ノーマルアタックだけで攻撃したとき、火力が高い順に並べます">火力</button><button data-v="safe" aria-pressed="false" title="あいてのノーマルアタックで先に倒されない中から、火力が高い順に並べます">高火力＋安定</button><button data-v="sim" aria-pressed="false" title="1匹どうしの対面を1ターンずつ詳しく計算します">シミュレート</button>
    </div>
    <button class="mdettab" id="rksimdet" aria-expanded="false" style="display:none" title="こまかい設定（敵硬直・能力変化わざ）を開きます"><i class="gear">⚙</i> 詳細</button>
  </div>
  <!-- シミュレート表示の「⚙ 詳細」の中身(敵硬直の行と能力変化わざをここへ移す) -->
  <div class="rkentbox" id="rksimbox" style="display:none"></div>
</div>


<div class="duel">
  <div class="side mine" id="sideL">
    <h2>じぶん<button class="shadowtab" aria-pressed="false" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする"><i class="shadowmark"></i></button></h2>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="opts mypkbar"><button class="mypktab" aria-pressed="false" title="★登録したポケモンの一覧を開く">★登録リスト</button></div>
    <div class="popwin mypklist" style="display:none"></div>
    <div class="pkview" style="display:none">
      <div class="pkhead"><span class="nm"></span><span class="ticons"></span><span class="scp" title="SCP＝攻撃・防御・HPを総合した対戦(PvP)向けの評価値です。この値が最大になる個体が理想個体です"></span><button class="savepk" title="このポケモン(個体値・わざ込み)を登録し、「★登録リスト」タブから1タップで呼び出せます">★登録</button></div>
      <div class="ivline"></div>
      <div class="smaxwrap" style="display:none">
        <div class="opts smax">
          <button data-lv="52" title="メガLv4(スーパーマックスレベル)でPL上限+2(52まで)">メガ<wbr>Lv4</button><button data-lv="53" title="メガLv4+最高の相棒でPL上限53まで">メガLv4<wbr>＋相棒</button><button data-lv="55" title="イベントのメガシンカCPブースト中はPL上限+5(55まで。最高の相棒でも55が上限)">CP<wbr>ブースト<small>イベント<wbr>ボーナス</small></button>
        </div>
      </div>
      <select class="selFast" title="ノーマルアタック"></select>
      <select class="selC1" title="SPアタック"></select>
      <div class="c2row"><select class="selC2" title="SPアタック2（わざ開放で覚えさせた2本目。選ぶと対面ごとに2本を使い分けます）"></select><button class="c2clear" style="display:none" title="SPアタック2を外す（1本に戻す）">×</button></div>
      <div class="bluffwrap" style="display:none">
        <label class="f" title="消費ゲージの少ないSPアタックを撃って、相手にシールドを使わせる駆け引き">ブラフ</label>
        <div class="opts bluff">
          <button data-v="0" aria-pressed="true" title="ブラフはせず、常にダメージ効率が高いSPを撃つ">しない</button><button data-v="1" aria-pressed="false" title="相手にシールドが残っている間は、消費の軽いSPを撃ってシールドを使わせにいく">する</button>
        </div>
      </div>
      <label class="f">個体値・PL</label>
      <div class="opts ivmode">
        <button data-v="auto" aria-pressed="true" title="リーグ上限内でSCPが最大になる理想個体値を自動計算">理想(自動)</button><button data-v="manual" aria-pressed="false" title="手持ちポケモンの個体値とPLを入力">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custIv" style="display:none">
        <div class="popttl ivpresetttl">入手別の1位個体（タップで反映）</div>
        <div class="slots ivpresets">
          <button data-f="5" title="交換入手(個体値の下限5)の中での1位個体">大親友交換</button><button data-f="6" title="シャドウレイド産(下限6)の中での1位個体">シャドウレイド</button><button data-f="10" title="レイド・ふか・リワード産(下限10)の中での1位個体">レイド,ふか,リワード</button>
        </div>
        <div class="popttl" style="margin-top:10px">手動入力（PLは自動調整）</div>
        <div class="ivgrid">
          <label>攻撃<input type="number" class="ivA" min="0" max="15" inputmode="numeric"></label>
          <label>防御<input type="number" class="ivD" min="0" max="15" inputmode="numeric"></label>
          <label>HP<input type="number" class="ivH" min="0" max="15" inputmode="numeric"></label>
          <label>PL<input type="number" class="ivL" min="1" max="51" step="0.5" inputmode="decimal"></label>
        </div>
        <div class="ivnote"></div>
      </div>
      <label class="f">シールド</label>
      <div class="opts sh shields">
        <button data-v="2" aria-pressed="true">2枚</button><button data-v="1" aria-pressed="false">1枚</button><button data-v="0" aria-pressed="false">0枚</button><button data-v="plan" aria-pressed="false" title="敵のSPアタック何発目で使うかを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custShield" style="display:none">
        <div class="popttl">SPアタック何発目で使う？</div>
        <div class="slots shslots">
          <button data-slot="1">1発目</button><button data-slot="2">2発目</button><button data-slot="3">3発目</button><button data-slot="4">4発目</button><button data-slot="5">5発目</button><button data-slot="6">6発目〜</button>
        </div>
      </div>
      <label class="f">SPアタックタイミング</label>
      <div class="opts timing">
        <button data-v="never" aria-pressed="false" style="display:none" title="SPアタックを撃たずにノーマルアタックだけで戦う">撃たない</button><button data-v="optimal" aria-pressed="true" title="相手のノーマルアタックの最終ターンに合わせて撃つ(上級者の動き)">最適</button><button data-v="asap" aria-pressed="false" title="ゲージが溜まりしだいすぐ撃つ">最短</button><button data-v="sync" aria-pressed="false" title="相手がSPアタックを撃つターンに合わせて撃つ(先に当たるのは攻撃の実数値が高いほう)。相手が撃たないままゲージが満タンになったら合わせるのをやめて撃つ">同時</button><button data-v="stock" aria-pressed="false" style="display:none" title="自分の能力が下がるわざを2発分ためてから2連射します（ためても2発分に届かないわざはゲージが無駄になる一歩手前まで）。実戦の「ためて連続で撃って交代」の撃ち方です。2連射のあとは最適と同じ撃ち方に戻ります">溜め打ち</button><button data-v="plan" aria-pressed="false" title="打つターンを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <label class="f">連戦</label>
      <div class="opts carry">
        <button data-v="off" aria-pressed="true" title="満タン・ゲージ0の状態から開始する">なし</button><button data-v="on" aria-pressed="false" title="前の対面から引き継いだHP・ゲージで開始する">設定する</button>
      </div>
      <div class="popwin custCarry" style="display:none">
        <div class="popttl">開始HP％とゲージを指定</div>
        <div class="cgrid">
          <label>開始HP（％）<input type="number" class="cHp" min="1" max="100" inputmode="numeric"></label>
          <label>開始ゲージ<input type="number" class="cEn" min="0" max="100" inputmode="numeric"></label>
        </div>
        <div class="slots cpre">
          <button data-hp="100">HP満タン</button><button data-hp="75">HP75%</button><button data-hp="50">HP50%</button><button data-hp="25">HP25%</button>
        </div>
      </div>
      <div class="popwin custSp" style="display:none">
        <div class="popttl">発ごとのSP設定</div>
        <div class="legend"></div>
        <div class="sprows"></div>
      </div>
    </div>
  </div>
  <div class="side foe" id="sideR">
    <h2>あいて<button class="shadowtab" aria-pressed="false" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする"><i class="shadowmark"></i></button></h2>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="opts mypkbar"><button class="mypktab" aria-pressed="false" title="★登録したポケモンの一覧を開く">★登録リスト</button></div>
    <div class="popwin mypklist" style="display:none"></div>
    <div class="pkview" style="display:none">
      <div class="pkhead"><span class="nm"></span><span class="ticons"></span><span class="scp" title="SCP＝攻撃・防御・HPを総合した対戦(PvP)向けの評価値です。この値が最大になる個体が理想個体です"></span><button class="savepk" title="このポケモン(個体値・わざ込み)を登録し、「★登録リスト」タブから1タップで呼び出せます">★登録</button></div>
      <div class="ivline"></div>
      <div class="smaxwrap" style="display:none">
        <div class="opts smax">
          <button data-lv="52" title="メガLv4(スーパーマックスレベル)でPL上限+2(52まで)">メガ<wbr>Lv4</button><button data-lv="53" title="メガLv4+最高の相棒でPL上限53まで">メガLv4<wbr>＋相棒</button><button data-lv="55" title="イベントのメガシンカCPブースト中はPL上限+5(55まで。最高の相棒でも55が上限)">CP<wbr>ブースト<small>イベント<wbr>ボーナス</small></button>
        </div>
      </div>
      <select class="selFast" title="ノーマルアタック"></select>
      <select class="selC1" title="SPアタック"></select>
      <div class="c2row"><select class="selC2" title="SPアタック2（わざ開放で覚えさせた2本目。選ぶと対面ごとに2本を使い分けます）"></select><button class="c2clear" style="display:none" title="SPアタック2を外す（1本に戻す）">×</button></div>
      <div class="bluffwrap" style="display:none">
        <label class="f" title="消費ゲージの少ないSPアタックを撃って、相手にシールドを使わせる駆け引き">ブラフ</label>
        <div class="opts bluff">
          <button data-v="0" aria-pressed="true" title="ブラフはせず、常にダメージ効率が高いSPを撃つ">しない</button><button data-v="1" aria-pressed="false" title="相手にシールドが残っている間は、消費の軽いSPを撃ってシールドを使わせにいく">する</button>
        </div>
      </div>
      <label class="f">個体値・PL</label>
      <div class="opts ivmode">
        <button data-v="auto" aria-pressed="true" title="リーグ上限内でSCPが最大になる理想個体値を自動計算">理想(自動)</button><button data-v="manual" aria-pressed="false" title="手持ちポケモンの個体値とPLを入力">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custIv" style="display:none">
        <div class="popttl ivpresetttl">入手別の1位個体（タップで反映）</div>
        <div class="slots ivpresets">
          <button data-f="5" title="交換入手(個体値の下限5)の中での1位個体">大親友交換</button><button data-f="6" title="シャドウレイド産(下限6)の中での1位個体">シャドウレイド</button><button data-f="10" title="レイド・ふか・リワード産(下限10)の中での1位個体">レイド,ふか,リワード</button>
        </div>
        <div class="popttl" style="margin-top:10px">手動入力（PLは自動調整）</div>
        <div class="ivgrid">
          <label>攻撃<input type="number" class="ivA" min="0" max="15" inputmode="numeric"></label>
          <label>防御<input type="number" class="ivD" min="0" max="15" inputmode="numeric"></label>
          <label>HP<input type="number" class="ivH" min="0" max="15" inputmode="numeric"></label>
          <label>PL<input type="number" class="ivL" min="1" max="51" step="0.5" inputmode="decimal"></label>
        </div>
        <div class="ivnote"></div>
      </div>
      <label class="f">シールド</label>
      <div class="opts sh shields">
        <button data-v="2" aria-pressed="true">2枚</button><button data-v="1" aria-pressed="false">1枚</button><button data-v="0" aria-pressed="false">0枚</button><button data-v="plan" aria-pressed="false" title="敵のSPアタック何発目で使うかを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custShield" style="display:none">
        <div class="popttl">SPアタック何発目で使う？</div>
        <div class="slots shslots">
          <button data-slot="1">1発目</button><button data-slot="2">2発目</button><button data-slot="3">3発目</button><button data-slot="4">4発目</button><button data-slot="5">5発目</button><button data-slot="6">6発目〜</button>
        </div>
      </div>
      <label class="f">SPアタックタイミング</label>
      <div class="opts timing">
        <button data-v="never" aria-pressed="false" style="display:none" title="SPアタックを撃たずにノーマルアタックだけで戦う">撃たない</button><button data-v="optimal" aria-pressed="true" title="相手のノーマルアタックの最終ターンに合わせて撃つ(上級者の動き)">最適</button><button data-v="asap" aria-pressed="false" title="ゲージが溜まりしだいすぐ撃つ">最短</button><button data-v="sync" aria-pressed="false" title="相手がSPアタックを撃つターンに合わせて撃つ(先に当たるのは攻撃の実数値が高いほう)。相手が撃たないままゲージが満タンになったら合わせるのをやめて撃つ">同時</button><button data-v="stock" aria-pressed="false" style="display:none" title="自分の能力が下がるわざを2発分ためてから2連射します（ためても2発分に届かないわざはゲージが無駄になる一歩手前まで）。実戦の「ためて連続で撃って交代」の撃ち方です。2連射のあとは最適と同じ撃ち方に戻ります">溜め打ち</button><button data-v="plan" aria-pressed="false" title="打つターンを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <label class="f">連戦</label>
      <div class="opts carry">
        <button data-v="off" aria-pressed="true" title="満タン・ゲージ0の状態から開始する">なし</button><button data-v="on" aria-pressed="false" title="前の対面から引き継いだHP・ゲージで開始する">設定する</button>
      </div>
      <div class="popwin custCarry" style="display:none">
        <div class="popttl">開始HP％とゲージを指定</div>
        <div class="cgrid">
          <label>開始HP（％）<input type="number" class="cHp" min="1" max="100" inputmode="numeric"></label>
          <label>開始ゲージ<input type="number" class="cEn" min="0" max="100" inputmode="numeric"></label>
        </div>
        <div class="slots cpre">
          <button data-hp="100">HP満タン</button><button data-hp="75">HP75%</button><button data-hp="50">HP50%</button><button data-hp="25">HP25%</button>
        </div>
      </div>
      <div class="popwin custSp" style="display:none">
        <div class="popttl">発ごとのSP設定</div>
        <div class="legend"></div>
        <div class="sprows"></div>
      </div>
    </div>
  </div>
</div>

<div class="multi" id="multi" style="display:none"></div>
<div class="multi" id="counter" style="display:none"></div>
<div class="multi" id="party" style="display:none">
  <div class="phead">
    <!-- 見出しは「自分のパーティ」(2026-08-13タダシさん指示)。
         旧「パーティ3匹の穴チェック」の"穴チェック"は下の図の見出しに移ったので、この画面の
         入り口としては「自分のパーティを入れる場所」であることだけを言う。
         「0匹＝穴」は図の凡例が説明するようになったため、「マスをタップ→1対1シミュ」とともに削除 -->
    <h3>自分のパーティ</h3>
    <button class="ptauto" aria-pressed="false" title="マニュアル＝下の欄で選んだわざで計算します。オート＝環境上位にいちばん多く勝てるわざ構成を自動で選びます。タップで切り替わります"><span class="k">わざ</span><span class="v m">マニュアル</span><span class="v a">オート</span></button>
  </div>
  <div class="pslots"></div>
  <div class="pctl">
    <span class="lbl">シールド</span>
    <div class="opts ptsh">
      <button data-v="2" aria-pressed="true">🛡2-2</button><button data-v="1" aria-pressed="false">🛡1-1</button><button data-v="0" aria-pressed="false">🛡0-0</button>
    </div>
  </div>
  <div class="pbody"></div>
</div>

<!-- 対戦記録: 自分が戦った相手を記録して「自分の土俵の環境」を分析する(2026-08-27タダシさん指示)。
     ツールの環境リストは全体像で、レート帯によって採用率はけっこう違う。記録はこの端末の中だけに保存される -->
<div class="multi" id="blog" style="display:none">
  <h3>📒 対戦記録</h3>
  <div class="enote expl">GBLの環境はレート帯で変わります。戦った相手をここに記録すると、<b>あなたの土俵の採用率</b>と<b>刺さるポケモン</b>が分かります。記録はこの端末の中だけに保存されます(リーグごとに別集計)。</div>
  <div class="blentry">
    <div class="blhd"><span class="lbl">あいてのパーティ</span><span class="blhint">1匹目＝初手。見えたぶんだけでOK</span></div>
    <div class="pslots blslots"></div>
    <div class="blquick"></div>
    <div class="blctl">
      <span class="lbl">勝敗</span>
      <div class="opts blres">
        <button data-v="w" aria-pressed="false" title="この対戦に勝ちました(もう一度押すと取り消し)">勝ち</button><button data-v="l" aria-pressed="false" title="この対戦に負けました(もう一度押すと取り消し)">負け</button>
      </div>
      <input type="text" class="blrate" inputmode="numeric" placeholder="レート" title="対戦後のレートが分かるときだけ入れてください(任意・5戦セットの区切りで入れる形でOK)。入れた記録だけが📈レートの折れ線グラフの点になります">
      <button class="bladd" title="この対戦を記録します。自分のパーティ(パーティ診断の3枠)も一緒に控えます">＋ 記録する</button>
    </div>
    <div class="blmine"></div>
    <div class="blmsg"></div>
  </div>
  <div class="blsum"></div>
  <div class="blviews">
    <div class="opts blvtabs">
      <button data-v="rate" aria-pressed="true" title="記録から集計した、あなたの土俵の採用率ランキングです">📊 採用率</button><button data-v="hit" aria-pressed="false" title="あなたの環境(記録の上位)に対して、どのポケモンがいちばん勝てるかをシミュレートします">🎯 刺さるポケモン</button><button data-v="type" aria-pressed="false" title="記録した相手のタイプを自動集計して、タイプごとに弱点をどれくらい突けるか・どれくらい突かれるかをグラフで見ます">⚔️ 相性</button><button data-v="graph" aria-pressed="false" title="記録したレートの推移を折れ線グラフで見ます(レートを入れた記録だけが点になります)">📈 レート</button><button data-v="hist" aria-pressed="false" title="記録した対戦の一覧です。まちがえた記録はここから消せます">📜 履歴</button>
    </div>
    <div class="opts blperiod">
      <button data-v="all" aria-pressed="true" title="このリーグの記録を全部使って集計します">全部</button><button data-v="50" aria-pressed="false" title="新しいほうから50戦だけで集計します(環境の入れ替わりを追いたいとき)">直近50戦</button><button data-v="20" aria-pressed="false" title="新しいほうから20戦だけで集計します">直近20戦</button>
    </div>
  </div>
  <div class="blbody"></div>
</div>

<div class="multi" id="rkteam" style="display:none">
  <div class="rksuggbar" id="rksuggbar"><span class="lbl">おすすめ</span>
    <button data-m="power" aria-pressed="false" title="じぶんの枠の入力欄をタップすると、同じ順番のあいてをいちばん速く倒せるポケモン トップ5を出します">高火力</button><button data-m="safe" aria-pressed="false" title="あいてのどのわざでも先に倒されないポケモンだけに絞って、火力トップ5を出します">高火力＋安定</button>
    <button class="rkdetailtab" id="rkdetailtab" aria-expanded="false" title="こまかい設定（確率で上下するわざ・じぶんの個体値とPL・あいてのわざランダム）を開きます"><i class="gear">⚙</i> 詳細</button></div>
  <div class="rkdetail" id="rkdetail" style="display:none">
    <div class="rkdbody"></div>
    <div class="rkdprob"></div>
  </div>
  <div class="rkteams">
    <div class="rkteamcol">
      <div class="rkcolttl" title="上から順に出します。パーティ診断と共通の3枠です">じぶん</div>
      <div class="pslots myslots"></div>
    </div>
    <div class="rkteamcol">
      <div class="rkcolttl foe" title="上から順に出てきます。リーダー・サカキは上の「だれと」からタップで入ります">あいて</div>
      <div class="pslots foeslots"></div>
    </div>
  </div>
  <div class="rkbody"></div>
</div>

<!-- GBL模擬戦(3匹×3匹の対人戦)。じぶん3枠はパーティ診断・ロケット団と共通のPT -->
<div class="multi" id="mock" style="display:none">
  <div class="gbaibar"><span class="lbl" title="あいて(対戦相手)の強さ。EASY=軽いSPをすぐ撃ち、シールドもすぐ使う入門向け ／ NORMAL=実戦の基本戦術で戦う標準 ／ HARD=こちらのポケモンとわざを最初から知っていて、ブラフも効かない最強。どの難易度でも、バトル後にあいての行動のチップをタップすれば選び直せます">あいて難易度</span>
    <div class="opts gbai" id="gbai"></div></div>
  <div class="rkteams">
    <div class="rkteamcol">
      <div class="rkcolttl" title="上から順に出します。パーティ診断・ロケット団と共通の3枠です">じぶん</div>
      <div class="pslots myslots"></div>
    </div>
    <div class="rkteamcol">
      <div class="rkcolttl foe gfhead"><span title="あいての3匹。わざの既定は環境の定番構成です(選び直せます)">あいて</span>
        <button class="ptauto gfauto" aria-pressed="false" title="オートにすると、あいてのわざ欄を隠して環境の定番構成で戦います＝どのわざが飛んでくるかは飛んでくるまで分かりません(実戦と同じ)。えらぶ＝今までどおり自分でわざを選び、構成を見ながら戦えます"><i class="k">わざ</i><span class="v m">えらぶ</span><span class="v a">オート</span></button></div>
      <div class="pslots foeslots gfoeslots"></div>
    </div>
  </div>
  <div class="gbbody"></div>
</div>

<!-- ロケット団戦 1対1: おすすめランキング(あいてを決めると出る) -->
<div class="multi" id="rkrank" style="display:none">
  <h3 id="rkranktitle">ノーマルアタック火力ランキング</h3>
  <!-- 絞り込みチップはランキングの枠内(火力チェッカーと同じ形)。
       右端の「⚙ 詳細」で敵硬直(対面の始まり方)を開く(2026-08-17タダシさん指示) -->
  <div class="rkfrow">
    <div class="opts rkfilt" id="rkfilt">
      <button data-f="shadow" aria-pressed="true" aria-label="シャドウを含める" title="シャドウ個体をランキングに含めます（シャドウポケモンは攻撃1.2倍で火力が上がります）"><i class="shadowmark"></i>シャドウ</button><button data-f="mega" aria-pressed="false" title="メガシンカ・ゲンシカイキをランキングに含めます">メガ・ゲンシ</button>
    </div>
    <button class="mdettab" id="rkentdet" aria-expanded="false" title="対面の始まり方（敵硬直）の設定を開きます"><i class="gear">⚙</i> 詳細</button>
  </div>
  <div class="rkentbox" id="rkentbox" style="display:none"></div>
  <div class="rkmy" id="rkmy">
    <button class="rkmytab" id="rkmytab" aria-expanded="false" title="CPと個体値を入れると、自分の個体の実力でランキングに並びます">＋ 自分のポケモン</button>
    <div class="rkmybody" id="rkmybody" style="display:none"></div>
  </div>
  <div class="rkrbody"></div>
</div>

<!-- 一覧系3モードの「⚙ 詳細」。ブラフ・能力変化わざはここへ畳んで、画面の幅と文字を減らす -->
<div class="mdet" id="mdet" style="display:none">
  <button class="mdettab" id="mdettab" aria-expanded="false" title="こまかい設定（ブラフ・能力変化わざ）を開きます"><i class="gear">⚙</i> 詳細</button>
  <div class="mdetbody" id="mdetbody" style="display:none"></div>
</div>

<div class="gopt" id="gopt">
  <span class="lbl" title="「ねっとう」「かみくだく」など、決まった確率で能力が上下するわざの計算方法。全モード共通で使われます">能力変化わざ</span>
  <div class="goptmain">
    <div class="opts prob" id="prob">
      <button data-v="none" aria-pressed="true" title="効果は起きない前提で計算する（運に頼らない結果・既定）">不発</button><button data-v="avg" aria-pressed="false" title="確率のぶんを平均して反映する（例: 30%で攻⬇なら0.3段階ぶん下がる）">期待値</button><button data-v="always" aria-pressed="false" title="毎回必ず発動する前提で計算する（いちばん効果が出た場合）">必ず発動</button>
    </div>
    <div class="goptnote" id="goptnote"></div>
  </div>
</div>
<div class="gopt" id="gbluff" style="display:none">
  <span class="lbl" title="安いSPアタックをわざと撃ってシールドを使わせる駆け引き。この画面では、じぶんとあいての両方に同じ前提を使います（1対1シミュでは左右のパネルで別々に指定できます）">ブラフ</span>
  <div class="goptmain">
    <div class="opts bluffmeta" id="bluffmeta">
      <button data-v="0" aria-pressed="true" title="ブラフをせず、いつも効率のよいSPアタックを撃つ前提（運に頼らない結果・既定）">しない</button><button data-v="1" aria-pressed="false" title="シールドが残っているあいだは軽いSPアタックを撃ってくる前提（引っ掛かると不利になる厳しめの見方）">する</button>
    </div>
    <div class="goptnote" id="gbluffnote"></div>
  </div>
</div>
<div class="result" id="result"></div>
<div class="tl" id="tl"></div>

<div class="share" id="share" style="display:none">
  <button id="copyUrl">🔗 URLをコピー</button>
</div>

<div class="loading" id="loading">データ読み込み中…</div>
<!-- 使い方・見かたの説明。画面の中には結論だけを置き、説明はすべてここにまとめる -->
<div class="helpwrap">
  <button id="helptab" aria-expanded="false">？ 使い方・マークの見かた</button>
  <div id="helpbody" style="display:none"></div>
</div>

<footer>データ: ゲーム内公開データ / 判定基準は独自集計。ポケモンおよびポケモンGOの名称・データは各権利者に帰属します。</footer>
</div>
`;

// ページごとの入口の違いを整える
if (PAGE_ROCKET) {
  // ロケット団対策ページ: モードは固定なのでタブ行ごと隠し、見出しを差し替える
  document.querySelector('header h1').innerHTML = '<span>GOロケット団</span> <b>対策シミュレーター</b>';
  document.getElementById('modes').style.display = 'none';
  // ダーク⇄ライトの切り替えが右端になるよう、リンクはその手前に置く
  document.getElementById('themesw').insertAdjacentHTML('beforebegin',
    '<a class="pagelink" href="/gbl/" title="GOバトルリーグ(対人戦)の対面シミュレーターへ">GBL対面シミュ ↗</a>');
  // リンクのぶん幅が足りず、狭い画面では見出しがリンクに重なる。CSSで2段にするための目印
  document.querySelector('header').classList.add('haslink');
} else if (PAGE_BLOG) {
  // 対戦記録ページ: モードは 'blog' に固定なのでタブ行ごと隠し、見出しを差し替える(ロケット団と同じ作り)
  document.querySelector('header h1').innerHTML = '<span>GOバトルリーグ</span> <b>対戦記録</b>';
  document.getElementById('modes').style.display = 'none';
  document.getElementById('themesw').insertAdjacentHTML('beforebegin',
    '<a class="pagelink" href="/gbl/" title="GOバトルリーグ(対人戦)の対面シミュレーターへ">GBL対面シミュ ↗</a>');
  document.querySelector('header').classList.add('haslink');
  // かんたん案内はGBL/ロケット団のモードを案内するものなので、このページでは出さない
  const er = document.querySelector('.easyrow');
  if (er) er.style.display = 'none';
} else {
  // GBLページ: ロケット団戦・対戦記録は別ページになったので、タブを同じ位置のリンクに差し替える
  const rb = document.querySelector('#modes button[data-m="rocket"]');
  if (rb) rb.outerHTML = '<a class="modelink" href="/rocket/" title="GOロケット団(したっぱ/リーダー/サカキ)対策の専用ページへ">ロケット団戦 ↗</a>';
  const bb = document.querySelector('#modes button[data-m="blog"]');
  if (bb) bb.outerHTML = '<a class="modelink" href="/battlelog/" title="戦った相手を記録して、自分のレート帯の環境(採用率)を分析する専用ページへ">対戦記録 ↗</a>';
}

// 交代マーク(黄色い循環矢印の画像・assets/gbl.css の .swapmark)。「⇄」の文字の代わりに全箇所で使う
const SWAPMK = '<i class="swapmark"></i>';

const D = window.PVP_DATA;
document.getElementById('loading').style.display = 'none';

// ---- 環境リストのわざ構成を、人が確認した確定値(assets/meta_moves.js)で上書きする ----
// 情報元の推奨構成は約7割しか実戦の定番と一致しないため、上位100匹はタダシさんが確認した
// 構成を使う(pvp-tests/answer-key.html で作る)。載っていないポケモンは従来どおり情報元の推奨。
// 読み込んだ直後に一度だけ書き換えるので、環境一覧・パーティ診断・対策さがし・カップの
// すべてが同じ構成を見る＝画面ごとに結果が食い違わない
(function applyMetaMoves() {
  const MM = window.META_MOVES;
  if (!MM) return;
  const put = (list, tbl) => (list || []).forEach(m => {
    const mv = tbl[m.k + (m.s ? '|s' : '')];
    if (!mv) return;
    m.f = mv[0] || m.f;
    m.c1 = mv[1] || m.c1;
    if (mv[2]) m.c2 = mv[2]; else delete m.c2;
  });
  Object.keys(MM).forEach(lg => {
    put((window.META_LISTS || {})[lg], MM[lg]);
    put((window.META_EXT || {})[lg], MM[lg]);
  });
  // カップはCP上限が同じリーグの確定値を使う(マスター相当のカップは "0")
  (window.CUP_LISTS || []).forEach(c => {
    const tbl = MM[c.cp >= 10000 ? '0' : String(c.cp)];
    if (!tbl) return;
    put(c.list, tbl);
    put(c.ext, tbl);
  });
})();

// ---- 検索対象(実装済み・メガ除外) ----
// 実装済み(r)は全て検索可能にする。メガ・ゲンシもメガバージョン系カップ用に含める
const KEYS = Object.keys(D.pokemon).filter(k => D.pokemon[k].r);
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const typeIcons = (p, size) => typePairHTML(p.ty.map(t => D.typeJa[t]), size || 18);
// シャドウは「シャドウ○○」の4文字ぶん名前が長くなり、表や枠から見切れてしまう。
// 表示するところだけ、頭のマークで表す(2026-08-13タダシさん指示)。
// 入力欄はHTMLを入れられないので従来どおり「シャドウ○○」の文字のまま
// nmk = 名前の頭に付けるシャドウマーク。マークの色は文字色を継承する作りなので、
// 名前の中に置くと白くなってしまう。紫(#b06cff)に固定する(2026-08-13タダシさん指摘)
const SHADOWMK = '<i class="shadowmark nmk"></i>';
const shMark = n => (n || '').startsWith('シャドウ') ? SHADOWMK + n.slice(4) : n;
// 診断のまとめは3枚とも**タブを押したら開く**(2026-08-13タダシさん指示)。
// 3枚とも開いていると縦に長く、表にたどり着くまでが遠い。既定は閉じておき、
// 開いた状態は端末に覚えさせる(毎回開き直さなくてよいように)
const PTSEC = { hole: false, diag: false, work: false };
try { Object.assign(PTSEC, JSON.parse(localStorage.getItem('gbl_ptsec') || '{}')); } catch (e) {}
const savePtSec = () => { try { localStorage.setItem('gbl_ptsec', JSON.stringify(PTSEC)); } catch (e) {} };
// パネルの頭(バッジ)。押すと開閉する
const PTSEC_TIPS = {
  hole: '環境上位を1匹1マスで並べた図。赤いマス＝3匹とも勝てない相手（穴）。タップで開閉します',
  diag: 'パーティの弱点と次の一手を短い文でまとめます。タップで開閉します',
  work: 'シールドが残る序盤と切れた終盤、どちらが得意かを1匹ずつ出します。タップで開閉します',
};
const ptSecHead = (k, emoji, label) =>
  `<button class="ptsec" data-sec="${k}" aria-expanded="${!!PTSEC[k]}"` +
  ` title="${PTSEC_TIPS[k] || 'タップで開きます'}">` +
  `<span class="ptdic">${emoji}</span>${label}<span class="ptsecarw"></span></button>`;
// パネルの開閉をつなぐ(描き直すたびに呼ぶ)
function bindPtSec(root) {
  root.querySelectorAll('.ptsec[data-sec]').forEach(b => b.onclick = () => {
    const k = b.dataset.sec;
    PTSEC[k] = !PTSEC[k];
    savePtSec();
    b.setAttribute('aria-expanded', PTSEC[k]);
    const card = b.parentNode;
    card.setAttribute('aria-expanded', PTSEC[k]);
  });
}
const MOVE_TYPE = {};
const MOVE_COST = {};
const NAME_TYPES = {};
Object.values(D.moves).forEach(m => {
  MOVE_TYPE[m.n] = m.t;
  if (m.e) MOVE_COST[m.n] = m.e;
  (NAME_TYPES[m.n] = NAME_TYPES[m.n] || new Set()).add(m.t);
});
// チップ表示ではギルガルド専用わざの「（独自性能）」を「（独自）」に縮める(タイムライン等の省スペース用。
// タイプアイコンの参照はフルネームで行うので縮めるのは表示文字だけ)
const mvChip = (name, size) => `<span class="mvname">${typeIconHTML(D.typeJa[MOVE_TYPE[name]] || '', size || 13)}${name.replace('（独自性能）', '（独自）')}</span>`;

// ---- リーグ上限内の理想個体値(SCP最大)を求める ----
// 通常はPL51(相棒込み)まで。メガのスーパーマックスLvは52、+最高の相棒で53まで
const LEVELS_ALL = Object.keys(D.cpm).map(Number).filter(l => l <= 55).sort((a, b) => a - b);
const LEVELS = LEVELS_ALL.filter(l => l <= 51);
const levelsUpTo = maxLv => (maxLv || 51) > 51 ? LEVELS_ALL.filter(l => l <= maxLv) : LEVELS;
const isMega = key => !!key && (key.includes('_mega') || key.includes('_primal'));
// ロケット団はメガ・ゲンシを使ってこないので、あいて側(i=1)の候補からは外す。
// こちらは使えるので、じぶん側(i=0)は今までどおり全部出す
const rkFoeOk = (i, key) => !(mode === 'rocket' && i === 1 && isMega(key));
function cpOf(p, a, d, h, c) {
  return Math.max(10, Math.floor((p.a + a) * Math.sqrt(p.df + d) * Math.sqrt(p.h + h) * c * c / 10));
}
// 同じ条件なら答えは変わらないので覚えておく(全ポケモンを回す「対策さがし(全ポケモン)」で
// 1匹あたり4096通りの計算を毎回やり直すと1秒以上かかるため)
const R1C = new Map();
// 交換できないポケモン(幻・ジガルデ等。pvp_data の ivf)は最低個体値10。個体値10未満の個体はゲーム内に存在しない(恒久ルール・2026-08-23)
const ivFloorOf = key => (D.pokemon[key] && D.pokemon[key].ivf) || 0;
const lvFloorOf = key => (D.pokemon[key] && D.pokemon[key].lvf) || 1;   // PLの下限(ジガルデ20)
function rank1(key, cap, minIv, maxLv) {
  minIv = Math.max(minIv || 0, ivFloorOf(key));
  const ck = key + '|' + cap + '|' + (minIv || 0) + '|' + (maxLv || '');
  if (R1C.has(ck)) return R1C.get(ck);
  const v = rank1Calc(key, cap, minIv, maxLv);
  R1C.set(ck, v);
  return v;
}
function rank1Calc(key, cap, minIv, maxLv) {
  const p = D.pokemon[key];
  minIv = minIv || 0;   // 入手方法による個体値の下限(大親友交換5/シャドウレイド6/レイド系10)
  const LV = levelsUpTo(maxLv);
  if (!cap) return { ivs: [15, 15, 15], level: (maxLv || 51) > 51 ? maxLv : 50 };  // マスター
  let best = null;
  for (let a = minIv; a <= 15; a++) for (let d = minIv; d <= 15; d++) for (let h = minIv; h <= 15; h++) {
    // capを超えない最大レベルを二分探索
    let lo = 0, hi = LV.length - 1, li = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cpOf(p, a, d, h, D.cpm[String(LV[mid])]) <= cap) { li = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (li < 0 || LV[li] < lvFloorOf(key)) continue;   // PL下限未満の個体は存在しない
    const c = D.cpm[String(LV[li])];
    const prod = (p.a + a) * c * (p.df + d) * c * Math.floor((p.h + h) * c);
    if (!best || prod > best.prod) best = { prod, ivs: [a, d, h], level: LV[li] };
  }
  return best || { ivs: [15, 15, 15], level: 50 };
}

// ---- 技構成の自動最適化(通常技×ゲージ技の総当たり+相互最善応答) ----
const scoreOf = (res, side) => {
  const own = res.final[side], opp = res.final[1 - side];
  return 500 * (1 - opp.hp / opp.hpMax) + 500 * (own.hp / own.hpMax);
};
// 全モード共通の計算設定。確率で能力が上下するわざの扱い(不発/期待値/必ず発動)
// ここを1つの設定にまとめて、一覧系と1対1シミュの結果が食い違わないようにする
const SIMOPT = { buffMode: 'none' };
function movePool(key) {
  // 通常枠と特別枠の両方に載っているわざがあるため重複除去する
  const p = D.pokemon[key];
  const fasts = [...new Set([...p.q, ...p.eq])].filter(m => D.moves[m]);
  const chargeds = [...new Set([...p.c, ...p.ec])].filter(m => D.moves[m] && m !== 'RETURN' && m !== 'FRUSTRATION');
  return { fasts, chargeds };
}
// ロケット団のあいてが使ってくるわざ。おぼえるわざの中からランダムに打ってくるが、
// 特別なわざ(レガシー技)は打ってこないので、通常枠(q/c)だけに絞る
function rkPool(key) {
  const p = D.pokemon[key];
  return {
    fasts: [...new Set(p.q)].filter(m => D.moves[m]),
    chargeds: [...new Set(p.c)].filter(m => D.moves[m] && m !== 'RETURN' && m !== 'FRUSTRATION'),
  };
}
// ロケット団戦のSPアタック1発ぶんの待ち時間(2026-08-21タダシさん提供の実測)。
// SPアタックを撃つと入力と演出のあいだ手が止まるが、バトルのタイマーは止まらないので、
// その時間ぶんだけ実時間が進む。**GBLの10秒とは別の値**(ロケット団のほうが短い):
//   じぶんが撃つ      … 9秒(18ターン)
//   あいてが撃つ      … シールドで防ぐと7秒(14ターン)／防がないと5秒(10ターン)
// ＝**あいてに撃たせたほうが待ち時間が短い**。ロケット団戦でいちばん大事な「早さ」に直結する。
// あいて(NPC)の硬直(SP後3.5秒など)は**バトル内のターンの話**なので、これとは別に従来どおり効く
const RK_SP_TURNS = { me: 18, foeShd: 14, foe: 10 };
// この対面の「ターンごとの累計待ち時間(ターン換算)」。実時間 = ターン + この値
function rkSpc(res) {
  const a = [];
  let n = 0;
  (res.rows || []).forEach(r => {
    const tn = r.tn === '-' ? Math.max(0, a.length - 1) : r.tn;
    while (a.length <= tn) a.push(n);
    for (let i = 0; i < 2; i++) {
      const e = r.ev[i];
      if (e && e.full !== undefined)
        n += i === 0 ? RK_SP_TURNS.me : (e.shielded ? RK_SP_TURNS.foeShd : RK_SP_TURNS.foe);
    }
    a[tn] = n;
  });
  return a;
}
const rkSpAt = (spc, tn) => spc.length ? spc[Math.max(0, Math.min(tn, spc.length - 1))] : 0;
// 1回のシミュぶんの実時間(ターン換算)。秒にするときは /2
const rkClock = res => res.turns + rkSpAt(rkSpc(res), res.turns);
// ロケット団戦で「こちらにいちばんキツいわざ」を選ぶための評価。低いほどキツい。
// 勝ち負けがまず最優先。勝つ場合は、ロケット団戦でいちばん大事な「早さ」を先に見る
// (決着が遅いほどキツい)＝最悪ケースの秒数が主結果より短く見える逆転を防ぐ。
// 同じ速さなら残りHPが少ないほどキツい。負け(と決着せず)は従来どおり scoreOf で比べる。
// scoreOf は最大1000なので、勝ちはどれも2000以上になり負けと混ざらない
const rkWorstScore = res => {
  if (res.winner !== 0) return scoreOf(res, 0);
  return 2000 + (1000 - rkClock(res)) * 10 + res.final[0].hp / res.final[0].hpMax;
};
// ロケット団のあいてかどうかは statMult(倍率でステータスが決まる)の有無で見分ける
const poolOf = cfg => (cfg && cfg.statMult ? rkPool(cfg.key) : movePool(cfg.key));
// わざ構成の候補を作る。cfg = { fast:固定するノーマル, c1:固定するSP1, c2:指定されたSP2 }
// c2があるときは「SP1候補+SP2」の2本セットを返し、どちらを撃つかはエンジンが相手に合わせて選ぶ
// めざめるパワーは16タイプに展開されるので、素直に並べると候補の先頭を埋め尽くし、
// **実戦の定番わざを押し出してしまう**(ホウオウは19個中17個がめざパで、やきつくすが候補外だった)。
// かといって全部外すと、**でんきカップのレントラーのめざめるパワー(じめん)**のように
// 限られた場面で本命になるものまで消える(2026-08-13タダシさん指摘)。
// そこで **実戦のわざを先に並べてから、めざめるパワーを後ろに全部足す**。
// 先頭5本の枠は実戦のわざが取り、めざパは追加の候補として残るので、
// 刺さる場面ならシミュが選ぶ
const HP_MOVE = /^めざめるパワー/;
const autoFasts = fasts => {
  const real = fasts.filter(m => !HP_MOVE.test(D.moves[m].n));
  if (!real.length) return fasts;
  return real.slice(0, 5).concat(fasts.filter(m => HP_MOVE.test(D.moves[m].n)));
};
// SPアタックの良さ。**タイプ一致(1.2倍)込みのダメージ÷消費ゲージ**に、
// **能力変化ぶんの価値**(PvpEngine.buffAdj)を掛ける。
// タイプ一致を見ないと、一致していない大技(ホウオウのソーラービーム)が上位に残る。
// 能力変化を見ないと、**威力の数字に出ない良いわざが候補から落ちる**
// (シャドウフォレトスの「がんせきふうじ」＝相手の攻撃を下げるわざ・2026-08-13タダシさん指摘)
const dpeOf = (key, m) => {
  const mv = D.moves[m];
  const stab = (D.pokemon[key].ty || []).includes(mv.t) ? 1.2 : 1;
  return mv.p * stab * PvpEngine.buffAdj(mv) / mv.e;
};
function policies(key, cfg) {
  const pool = cfg && cfg.statMult ? rkPool(key) : movePool(key);
  const { chargeds } = pool;
  const fasts = autoFasts(pool.fasts);
  const st = { atk: 1, def: 1, types: D.pokemon[key].ty, buffs: [0, 0] };
  const dpe = m => dpeOf(key, m);
  const top = chargeds.sort((a, b) => dpe(b) - dpe(a)).slice(0, 8);
  const out = [];
  for (const f of (cfg.fast ? [cfg.fast] : fasts)) {
    for (const t of (cfg.c1 ? [cfg.c1] : top)) {
      if (cfg.c2) out.push({ fast: f, charged: t === cfg.c2 ? [t] : [t, cfg.c2] });
      else out.push({ fast: f, throw: t });
    }
  }
  // SPアタックを覚えないポケモン(進化前など)はノーマルアタックだけの構成にする
  if (!out.length) for (const f of (cfg.fast ? [cfg.fast] : fasts)) out.push({ fast: f });
  return out;
}
// 画面で選んでいるわざ(ノーマル/SP1/SP2)を policies 用の指定に変換する。
// 手動で選んだわざが最優先、なければ以前の自動選出で決まったわざ(pin)を使い続ける
// (設定をいじるたびに構成が勝手に変わらないようにする。どちらも無いときだけ自動最適化)
const polOpts = i => ({ fast: S[i].fast || S[i].pin.fast || undefined,
  c1: S[i].c1 || S[i].pin.c1 || undefined, c2: S[i].c2 || undefined });
// 自動選出のわざを未確定に戻す(ポケモンを替えた・リーグを替えたときに呼ぶ)
const resetPin = i => { S[i].pin = { fast: null, c1: null }; };

function optimize(cfgL, cfgR) {
  const PL = policies(cfgL.key, cfgL), PR = policies(cfgR.key, cfgR);
  const cache = new Map();
  const play = (a, b) => {
    const k = a + ':' + b;
    if (!cache.has(k)) {
      const res = PvpEngine.simulate(D, { ...cfgL, ...PL[a], timing: cfgL.timing || 'optimal' },
                                        { ...cfgR, ...PR[b], timing: cfgR.timing || 'optimal' }, SIMOPT);
      cache.set(k, [scoreOf(res, 0), scoreOf(res, 1)]);
    }
    return cache.get(k);
  };
  let a = 0, b = 0;
  const seen = new Set();
  for (let it = 0; it < 24; it++) {
    const key = a + ',' + b;
    if (seen.has(key)) break;
    seen.add(key);
    let bestA = a;
    for (let x = 0; x < PL.length; x++) if (play(x, b)[0] > play(bestA, b)[0]) bestA = x;
    let bestB = b;
    for (let y = 0; y < PR.length; y++) if (play(bestA, y)[1] > play(bestA, bestB)[1]) bestB = y;
    if (bestA === a && bestB === b) break;
    a = bestA; b = bestB;
  }
  return { left: PL[a], right: PR[b] };
}

// ---- ブレイクポイント(専用ページ /breakpoint/ へのリンク) ----
// じぶん側は個体値・PLをそのまま渡す(向こうで強化の余地を計算する)。
// あいて側は実数値ごと渡す(fst=攻~防~HP)。ロケット団のNPC補正込みの実数値もこの形でそのまま扱える
function bpUrl(L, R) {
  const q = new URLSearchParams();
  if (!PAGE_ROCKET && cap) q.set('lg', String(cap));
  q.set('me', L.key);
  if (L.shadow) q.set('msh', '1');
  if (L.ivs) q.set('miv', L.ivs.join('.'));
  if (L.level) q.set('mpl', L.level);
  if (L.fast) q.set('mv', L.fast);
  q.set('foe', R.key);
  if (R.shadow) q.set('fsh', '1');
  const st = PvpEngine.buildStats(D, R);
  q.set('fst', [st.atk.toFixed(2), st.def.toFixed(2), st.hp].join('~'));
  if (R.fast) q.set('fmv', R.fast);
  return '/breakpoint/?' + q.toString();
}

// 指定個体値でCP上限を超えない最大PLを返す
function maxLevelFor(key, ivs, capV, maxLv) {
  const LV = levelsUpTo(maxLv);
  let lo = 0, hi = LV.length - 1, li = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const st = PvpEngine.buildStats(D, { key, ivs, level: LV[mid] });
    if (!capV || st.cp <= capV) { li = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return LV[li];
}
// ---- 画面状態 ----
let cap = 1500;
const mkSide = () => ({ key: null, shields: 2, timing: 'optimal', fast: null, c1: null, c2: null,
  pin: { fast: null, c1: null },   // 自動選出で決まったわざの控え(一度決まったら固定するため)
  shieldMode: null, shieldSlots: [true, true, false, false, false], shieldRest: false,
  spMode: ['opt', 'opt', 'opt', 'opt', 'opt'], spModeRest: 'opt',
  spMv: ['auto', 'auto', 'auto', 'auto', 'auto'], spMvRest: 'auto',
  ivMode: 'auto', mIvs: null, mLevel: null, shadow: false, maxLv: 51, spOpen: false,
  carry: false, cHp: 100, cEn: 0, bluff: false });
const S = [mkSide(), mkSide()];
const sideEl = [document.getElementById('sideL'), document.getElementById('sideR')];
// 側のタイミング設定 → 発ごとのSP設定で使う記号(最短=min / 同時=sync / それ以外=最適)
const spModeOf = i => S[i].timing === 'asap' ? 'min' : S[i].timing === 'sync' ? 'sync' : 'opt';

// ---- 検索候補 ----
sideEl.forEach((el, i) => {
  // 「発ごとのSP設定」の見出しをタップで開閉(SPアタック2選択時は既定で折りたたむ)
  el.querySelector('.custSp .popttl').onclick = () => {
    if (S[i].timing === 'plan') return;   // ﾏﾆｭｱﾙ中は常に開いたまま
    S[i].spOpen = !S[i].spOpen;
    const spEl = el.querySelector('.custSp');
    spEl.classList.toggle('fold', !S[i].spOpen);
    spEl.querySelector('.popttl').setAttribute('aria-expanded', S[i].spOpen);
  };
  const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
  inp.addEventListener('compositionend', () => {
    const v = toKata(inp.value);
    if (v !== inp.value) inp.value = v;
    inp.dispatchEvent(new Event('input'));
  });
  inp.addEventListener('input', e => {
    if (!e.isComposing) {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
    }
    const q = toKata(inp.value.trim());
    if (!q) { list.style.display = 'none'; return; }
    const hits = searchPk(q, k => rkFoeOk(i, k));
    if (!hits.length) { list.style.display = 'none'; return; }
    list.innerHTML = hits.map(k =>
      `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
    list.style.display = 'block';
    list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
      list.style.display = 'none';
      inp.value = D.pokemon[d.dataset.k].n;
      pick(i, d.dataset.k);
    });
  });
  document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
  // シールド・タイミング(ﾏﾆｭｱﾙ選択時は入力欄を表示)
  el.querySelectorAll('.shields button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.shields button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].shieldMode = b.dataset.v === 'plan' ? 'plan' : null;
    if (!S[i].shieldMode) S[i].shields = +b.dataset.v;
    el.querySelector('.custShield').style.display = S[i].shieldMode ? 'block' : 'none';
    run();
  });
  el.querySelectorAll('.timing button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.timing button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].timing = b.dataset.v;
    // 最適/最短/同時を押したら発ごとの設定も一括でそのタイミングに揃える
    if (S[i].timing !== 'plan') {
      const m = spModeOf(i);
      S[i].spMode = [m, m, m, m, m];
      S[i].spModeRest = m;
    }
    el.querySelector('.custSp').style.display = (S[i].timing === 'plan' || S[i].c2) ? 'block' : 'none';
    run();
  });
  // シールドの小窓(何発目で使うか)
  const syncShieldSlots = () => {
    el.querySelectorAll('.shslots button').forEach(b => {
      const k = +b.dataset.slot;
      b.setAttribute('aria-pressed', k === 6 ? !!S[i].shieldRest : !!S[i].shieldSlots[k - 1]);
    });
  };
  syncShieldSlots();
  el.querySelectorAll('.shslots button').forEach(b => b.onclick = () => {
    const k = +b.dataset.slot;
    if (k === 6) S[i].shieldRest = !S[i].shieldRest;
    else S[i].shieldSlots[k - 1] = !S[i].shieldSlots[k - 1];
    syncShieldSlots();
    run();
  });
  // 個体値: 理想(自動)/マニュアル切替。マニュアルを開いたら現在の理想値を初期値に入れる
  const ivInputs = ['ivA', 'ivD', 'ivH', 'ivL'].map(c => el.querySelector('.' + c));
  el.querySelectorAll('.ivmode button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].ivMode = b.dataset.v;
    el.querySelector('.custIv').style.display = S[i].ivMode === 'manual' ? 'block' : 'none';
    if (S[i].ivMode === 'manual' && S[i].key && !S[i].mIvs) {
      const r1 = rank1(S[i].key, cap, 0, S[i].maxLv);
      S[i].mIvs = r1.ivs.slice(); S[i].mLevel = r1.level;
    }
    if (S[i].mIvs) {
      ivInputs[0].value = S[i].mIvs[0]; ivInputs[1].value = S[i].mIvs[1];
      ivInputs[2].value = S[i].mIvs[2]; ivInputs[3].value = S[i].mLevel;
    }
    run();
  });
  // パターン別最適個体: 入手方法の個体値下限つきランク1個体を入力欄へ反映
  el.querySelectorAll('.ivpresets button').forEach(b => b.onclick = () => {
    if (!S[i].key) return;
    const r = rank1(S[i].key, cap, +b.dataset.f, S[i].maxLv);
    S[i].mIvs = r.ivs.slice(); S[i].mLevel = r.level;
    ivInputs[0].value = r.ivs[0]; ivInputs[1].value = r.ivs[1];
    ivInputs[2].value = r.ivs[2]; ivInputs[3].value = r.level;
    el.querySelectorAll('.ivpresets button').forEach(x => x.setAttribute('aria-pressed', x === b));
    run();
  });
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  ivInputs.forEach((inp, k) => inp.onchange = () => {
    if (!S[i].mIvs) S[i].mIvs = [15, 15, 15];
    el.querySelectorAll('.ivpresets button').forEach(x => x.setAttribute('aria-pressed', false));   // 手入力したらパターン選択を解除
    if (k < 3) {
      S[i].mIvs[k] = clamp(Math.round(+inp.value || 0), ivFloorOf(S[i].key), 15); inp.value = S[i].mIvs[k];   // 交換不可は10未満にできない
      // 個体値に合わせてPLをCP上限内の最大(最適)レベルへ自動調整
      S[i].mLevel = maxLevelFor(S[i].key, S[i].mIvs, cap, S[i].maxLv);
      ivInputs[3].value = S[i].mLevel;
    } else { S[i].mLevel = clamp(Math.round((+inp.value || 1) * 2) / 2, lvFloorOf(S[i].key), S[i].maxLv); inp.value = S[i].mLevel; }
    run();
  });
  // スーパーマックスレベル(メガ専用): PL上限を52/53へ拡張。同じタブ再タップで解除
  el.querySelectorAll('.smax button').forEach(b => b.onclick = () => {
    const lv = +b.dataset.lv;
    S[i].maxLv = S[i].maxLv === lv ? 51 : lv;
    syncSmax(i);
    if (S[i].ivMode === 'manual' && S[i].mIvs) {   // マニュアルPLも新上限で自動調整
      S[i].mLevel = maxLevelFor(S[i].key, S[i].mIvs, cap, S[i].maxLv);
      el.querySelector('.ivL').value = S[i].mLevel;
    }
    run();
  });
  // シャドウタブ: この側にシャドウ補正(攻撃1.2倍・防御5/6)をかける
  el.querySelector('.shadowtab').onclick = () => {
    // ロケット団戦のあいてはシャドウ固定(押しても切り替えない)
    if (el.querySelector('.shadowtab').getAttribute('aria-disabled') === 'true') return;
    S[i].shadow = !S[i].shadow;
    el.querySelector('.shadowtab').setAttribute('aria-pressed', S[i].shadow);
    if (S[i].key) {
      el.querySelector('input').value = (S[i].shadow ? 'シャドウ' : '') + D.pokemon[S[i].key].n;
      run();
    }
  };
  // ★登録: いまの構成(個体値・わざ込み)を登録リストへ。同じポケモンは上書き
  el.querySelector('.savepk').onclick = () => {
    if (!S[i].key) return;
    const l = loadMyPk().filter(m => m.key !== S[i].key);
    l.unshift({ key: S[i].key, ivMode: S[i].ivMode, mIvs: S[i].mIvs, mLevel: S[i].mLevel,
                fast: S[i].fast, c1: S[i].c1, c2: S[i].c2, shadow: S[i].shadow, maxLv: S[i].maxLv });
    saveMyPkList(l); renderMyPk();
    const b = el.querySelector('.savepk');
    b.textContent = '★登録した！'; setTimeout(() => { b.textContent = '★登録'; }, 1200);
  };
  // ★登録リストのタブ: タップで一覧を開閉
  el.querySelector('.mypktab').onclick = () => {
    const box = el.querySelector('.mypklist');
    const open = box.style.display === 'none';
    if (open) renderMyPk();
    box.style.display = open ? 'block' : 'none';
    el.querySelector('.mypktab').setAttribute('aria-pressed', open);
  };
  // ブラフ: 相手のシールドが残っている間、消費の軽いSPを撃ってシールドを使わせにいくか
  el.querySelectorAll('.bluff button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.bluff button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].bluff = b.dataset.v === '1';
    run();
  });
  // 連戦(引き継ぎ): 開始HP%と開始ゲージ
  el.querySelectorAll('.carry button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.carry button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].carry = b.dataset.v === 'on';
    el.querySelector('.custCarry').style.display = S[i].carry ? 'block' : 'none';
    el.querySelector('.cHp').value = S[i].cHp;
    el.querySelector('.cEn').value = S[i].cEn;
    run();
  });
  el.querySelector('.cHp').onchange = e => {
    S[i].cHp = Math.min(100, Math.max(1, Math.round(+e.target.value || 100)));
    e.target.value = S[i].cHp;
    el.querySelectorAll('.cpre button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.hp === S[i].cHp));
    run();
  };
  el.querySelector('.cEn').onchange = e => {
    S[i].cEn = Math.min(100, Math.max(0, Math.round(+e.target.value || 0)));
    e.target.value = S[i].cEn;
    run();
  };
  el.querySelectorAll('.cpre button').forEach(b => b.onclick = () => {
    S[i].cHp = +b.dataset.hp;
    el.querySelector('.cHp').value = S[i].cHp;
    el.querySelectorAll('.cpre button').forEach(x => x.setAttribute('aria-pressed', x === b));
    run();
  });
  el.querySelector('.selFast').onchange = e => { S[i].fast = e.target.value; run(); };
  el.querySelector('.selC1').onchange = e => { S[i].c1 = e.target.value; run(); };
  el.querySelector('.selC2').onchange = e => { S[i].c2 = e.target.value; run(); };
  // SPアタック2の「×」= 2本目を外して1本に戻す(2026-08-13タダシさん指示)。
  // プレースホルダーを選び直しても外せるが気づきにくく、発ごとのSP設定が出っぱなしになる
  el.querySelector('.c2clear').onclick = () => { S[i].c2 = null; resetSpPlan(i); run(); };
});

// リーグ/カップ切替の共通処理(わざ再選択とマニュアルPLの上限内再調整)
// 自動選出で確定したわざ(pin)だけ新リーグで選び直す。手動で選んだわざは変えない
function afterCapChange() {
  S.forEach((s, i) => resetPin(i));
  S.forEach((s, i) => {
    if (s.ivMode === 'manual' && s.mIvs && s.key) {
      s.mLevel = maxLevelFor(s.key, s.mIvs, cap, s.maxLv);
      sideEl[i].querySelector('.ivL').value = s.mLevel;
    }
  });
  // パーティ診断の空欄の既定はリーグの確定値に依存する(mockDefaultMoves)ので、
  // リーグ・カップを替えたらわざ欄を描き直す(描き直さないと表示だけ前のリーグの既定が残る)
  if (typeof syncPartySlot === 'function') [0, 1, 2].forEach(i => syncPartySlot(i));
  run();
}
document.getElementById('leagues').querySelectorAll('.lgbtn[data-cap]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', x === b));
  cap = +b.dataset.cap;
  // 特殊カップの選択は解除
  cup = null;
  cupTab.textContent = '特殊カップ';
  cupwin.style.display = 'none';
  afterCapChange();
});

// ---- 特殊カップ(タップで一覧を開き、選ぶとそのカップの上限・環境リストに切替) ----
let cup = null;
const cupTab = document.getElementById('cupTab');
const cupwin = document.getElementById('cupwin');
// 過去のカップ(そのカップが最後に開催されたときの環境)。現行と同じ形なので、選べば全モードがそのまま動く。
// ファイルが大きいので、一覧を開いたときだけ読みに行く
let pastCups = null, pastOpen = false, pastLoad = null;
const cupYm = c => c.ym ? `${+c.ym.slice(0, 4)}年${+c.ym.slice(5, 7)}月` : '';
const cupTitle = c => c.label + (c.ym ? `・${cupYm(c)}` : '');
function loadPast() {
  if (pastLoad) return pastLoad;
  pastLoad = new Promise(res => {
    const sc = document.createElement('script');
    sc.src = '/assets/meta_past.js';
    sc.onload = sc.onerror = () => {
      const live = new Set((window.CUP_LISTS || []).map(c => c.slug));
      // いま一覧に出ているカップは二重に出さない(中身は同じ)
      pastCups = (window.PAST_CUPS || []).filter(c => !live.has(c.slug));
      res(pastCups);
    };
    document.head.appendChild(sc);
  });
  return pastLoad;
}
const cupBtn = c =>
  `<button data-slug="${c.slug}" aria-pressed="${!!(cup && cup.slug === c.slug)}">${c.label}<small>${c.ym ? cupYm(c) + '・' : ''}${c.cp === 10000 ? 'CP上限なし' : 'CP' + c.cp}</small></button>`;
function pastHtml() {
  if (!pastCups) return '<div class="pastload">読み込み中…</div>';
  let year = '';
  return pastCups.map(c => {
    const y = c.ym.slice(0, 4);
    const head = y === year ? '' : `<div class="pastyear">${+y}年</div>`;
    year = y;
    return head + cupBtn(c);
  }).join('');
}
function renderCups() {
  const box = document.getElementById('cupslots');
  const pbox = document.getElementById('pastslots');
  // マイ環境(対戦記録から作った自分の土俵の環境)。5戦以上記録したリーグだけ出す
  const myBtns = [1500, 2500, 0].map(c0 => {
    const n = BLOG.filter(r => r.cap === c0).length;
    return n >= 5 ? `<button class="mycup" data-my="${c0}" aria-pressed="${!!(cup && cup.slug === 'my' + c0)}" title="対戦記録から作った、あなたの土俵の環境リストです。環境一覧・対策さがし・パーティ診断がこのリストで動きます">📒 マイ環境(${BL_LGN[c0]})<small>あなたの記録${n}戦から</small></button>` : '';
  }).join('');
  box.innerHTML = myBtns + (window.CUP_LISTS || []).map(cupBtn).join('');
  box.querySelectorAll('button[data-my]').forEach(x => x.onclick = () => selectMyCup(+x.dataset.my));
  document.getElementById('pasttab').setAttribute('aria-expanded', pastOpen);
  pbox.style.display = pastOpen ? 'flex' : 'none';
  if (pastOpen) pbox.innerHTML = pastHtml();
  [box, pbox].forEach(b => b.querySelectorAll('button[data-slug]')
    .forEach(x => x.onclick = () => selectCup(x.dataset.slug)));
}
function selectCup(slug) {
  // マイ環境(対戦記録から作るカップ)はここで分岐(共有URL・リロードの cup=my1500 もここに来る)
  const my = /^my(1500|2500|0)$/.exec(slug || '');
  if (my) { selectMyCup(+my[1]); return; }
  const c = (window.CUP_LISTS || []).find(x => x.slug === slug)
    || (pastCups || []).find(x => x.slug === slug);
  if (!c) {
    // 共有リンクから開いたときは、過去のカップをまだ読んでいないことがある
    if (!pastCups) loadPast().then(ps => { if (ps.some(x => x.slug === slug)) selectCup(slug); });
    return;
  }
  cup = c;
  cap = c.cp === 10000 ? 0 : c.cp;
  document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', false));
  cupTab.setAttribute('aria-pressed', true);
  cupTab.textContent = c.label;
  cupwin.style.display = 'none';
  afterCapChange();
}
document.getElementById('pasttab').onclick = () => {
  pastOpen = !pastOpen;
  renderCups();
  if (pastOpen && !pastCups) loadPast().then(() => { if (pastOpen) renderCups(); });
};
cupTab.onclick = () => {
  const open = cupwin.style.display === 'none';
  renderCups();
  cupwin.style.display = open ? 'block' : 'none';
  // 一覧を開いているあいだは「特殊カップ」を選択中として光らせる(前のリーグが選ばれたままだと紛らわしい)。
  // 何も選ばずに閉じたら、いま実際に使っているリーグの表示へ戻す
  if (open) {
    document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', x === cupTab));
  } else if (!cup) {
    document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', +x.dataset.cap === cap));
  }
};

// ---- 使い方・マークの見かた(ページ最下部) ----
// 画面の中には結論だけを置き、説明の文章はすべてここに集める。
// のちに「説明ありモード」を作るときは、ここの文章を画面内へ戻す形にする。
const HELP_HTML = `
  <h4>マークの見かた</h4>
  <div class="hlegend">
    <div><i>🛡</i>シールド（残り枚数・使った回数）</div>
    <div><i>⏱</i>かかった時間（秒）</div>
    <div><i>${SWAPMK}</i>交代する／した</div>
    <div><i>▶</i>SPアタックを撃つ指示</div>
    <div><i>🎲</i>ランダムで決まる</div>
    <div><i>📌</i>固定（必ずこれが出る）</div>
    <div><i>⏸️</i>硬直（あいてが動けない）</div>
    <div><i><i class="shadowmark"></i></i>シャドウ</div>
  </div>

  <h4>「SCP」とは</h4>
  <p>ポケモン名の横に出る<b>SCP＝攻撃・防御・HPを総合した対戦(PvP)向けの評価値</b>です。
  CPは攻撃に寄った計算なので、耐久も効くトレーナーバトルでは<b>SCPのほうが強さの目安</b>になります。
  「理想(自動)」は<b>SCPが最大になる個体値</b>（CP制限のあるリーグでは上限に収まる中で）を選んでいます。</p>

${PAGE_ROCKET ? '' : `
  <h4>「ブラフ」の設定</h4>
  <p>ブラフ＝<b>軽いSPアタックをわざと撃ってシールドを使わせる駆け引き</b>。
  環境一覧・対策さがし・パーティ診断では、<b>じぶんとあいての両方に同じ前提</b>を使います。
  既定は<b>しない</b>（運に頼らない見方）。<b>する</b>にするとお互いが駆け引きしてくる見方になります。
  マスターリーグのようにSPを2本持つポケモンが多いほど差が出ます。
  1対1シミュでは、左右のパネルで別々に指定できます。</p>

  <h4>パーティ診断の「平均勝率」</h4>
  <p>環境上位の相手<b>1匹あたり</b>、パーティの何匹が勝てるかを割合で出したものです。
  3匹編成で<b>50％</b>なら「どの相手にも平均1.5匹が勝てる」という意味になります。
  数字が大きいほど、どの相手にも選べる手が多いパーティです（勝てるのが0匹の相手が<b>穴</b>）。</p>

  <h4>パーティ診断の「実戦想定」</h4>
  <p>平均勝率は環境上位50匹を<b>同じ重さ</b>で数えたものですが、実際は<b>上位の相手ほどよく当たります</b>。
  そこで順位の重みを掛けたものが<b>実戦想定</b>です（環境スコアと同じ重みの付け方）。
  よく当たる相手に強いパーティほど、平均勝率より高く出ます。</p>

  <h4>対戦記録と「マイ環境」</h4>
  <p>GBLの環境は<b>レート帯によって採用率がけっこう違います</b>。「対戦記録」モードで戦った相手を
  記録すると、ツールの環境リスト（全体像）ではなく<b>あなたの土俵の環境</b>で分析できます。</p>
  <ul>
    <li><b>記録の中身</b> … あいての3匹（1匹目＝初手）・勝敗・自分のパーティ（パーティ診断の3枠を自動で控えます）。
      見えたぶんだけの記録でかまいません。記録は<b>この端末の中だけ</b>に保存され、リーグごとに別集計です</li>
    <li><b>採用率</b> … 記録した対戦のうち、そのポケモンがパーティに入っていた割合です。
      「勝率」はそのポケモンがいた対戦でのあなたの勝率で、<b>低いほど苦手な相手</b>です。「対策」を押すと対策さがしへ飛びます</li>
    <li><b>相性(⚔️タブ)</b> … 記録した相手を自動集計して、タイプごとの通りやすさをボタンで選んだ1つずつグラフに出します。
      <b>攻撃面(⚔️)</b>＝そのタイプのわざで攻撃したとき弱点を突ける相手/耐性で軽減される相手の割合(相手のタイプに対して・複合タイプは掛け算)。
      <b>防御面(🛡️)</b>＝そのタイプのポケモンで受けたとき、相手の<b>定番わざ構成</b>(環境の確定値・載っていなければ効率順の
      ノーマル＋SP2本)で弱点を突かれる/耐性で軽減できる割合です。タイプ一致でないわざ(マリルリのれいとうビームなど)も数えます</li>
    <li><b>レート</b> … 記録するときに「レート」欄に数字を入れると、📈タブに折れ線グラフが出ます。
      毎戦入れる必要はありません（レートが分かる<b>5戦セットの区切りで入れる形でOK</b>。入れた記録だけが点になります）</li>
    <li><b>削除</b> … 履歴タブで1件ずつ消せます（×→「削除する?」の2タップ）。いちばん下の
      「🗑 すべて削除」はそのリーグの記録を全部消します（確認ウィンドウが出てから消えるので、押しまちがいでは消えません）</li>
    <li><b>刺さるポケモン</b> … あなたの記録の上位20匹（採用数の重み付き）に、どのポケモンがいちばん勝てるかを
      シミュレートします。前提は環境一覧などと同じ（理想個体値・環境の定番わざ構成・シールド0-0/1-1/2-2の3通り・
      ブラフは画面の設定）です。候補は全体の環境上位100匹＋記録に出てきた相手＋★登録リストです</li>
    <li><b>マイ環境</b> … 5戦以上記録すると、特殊カップの一覧に「📒 マイ環境」が出ます。選ぶと
      <b>環境一覧・対策さがし・パーティ診断がそのまま、あなたの記録から作った採用率順のリスト（直近100戦・上位50匹）で動きます</b>。
      わざ構成は環境の確定値（載っていなければ効率順）を使います。記録を足したら選び直すと最新になります</li>
  </ul>

  <h4>パーティ診断の「🎯 穴チェック」</h4>
  <p><b>1マス＝環境の1匹</b>で、色はその相手に<b>勝てるかどうか</b>です。
  <b>緑（2匹勝ち）</b>＝2匹以上が勝てる／<b>黄（1匹頼み）</b>＝1匹しか勝てない／<b>赤（穴）</b>＝3匹とも勝てない。
  <b>1匹頼み</b>は、その1匹を先に失うとそこが<b>穴になる</b>ということです。</p>
  <p>帯は<b>環境順位のグループ</b>に分かれていて、<b>上の帯ほどよく当たる相手</b>です。
  よく当たるグループほどマスを大きくしてあるので、<b>上に赤や黄があるほど深刻</b>だと形で分かります
  （同じ「穴1匹」でも、1位が相手なのか50位が相手なのかで重さがまるで違うため）。
  凡例をタップするとその相手だけに表を絞り込めます。</p>

  <h4>パーティ診断の「📋 診断」</h4>
  <p>いまの並びが<b>どれだけ弱いか・誰に弱いか・次に何をすればいいか</b>を文でまとめます。
  苦手な相手は<b>名前と環境順位</b>で出します（タイプだけ分かっても次の手は決まらないため）。
  深刻度は<b>環境上位10位に何匹いるか</b>で見ています（使用率の低い相手ばかりなら、急いで埋める必要はありません）。</p>

  <h4>パーティ診断の「⚔️ 得意な場面」</h4>
  <p><b>横棒は勝ち数そのもの</b>です。環境上位50匹と戦って、
  <b>🛡2-2（シールドが残っている序盤）で何勝／🛡0-0（切れた終盤）で何勝</b>かを並べています。
  どちらも<b>おたがい同じ枚数</b>です。
  <b>真ん中の線が半分（25匹）</b>なので、<b>線より右なら半分以上に勝てる</b>と読んでください。
  序盤と終盤は<b>同じ50匹と別々に戦った結果</b>なので、2本を足しても50にはなりません。</p>
  <p><b>役割</b>は、その線をどちら側で越えているかで決まります。
  <b>万能</b>＝どちらも25勝以上／<b>序盤型</b>＝🛡2-2だけ／<b>終盤型</b>＝🛡0-0だけ／
  <b>苦戦</b>＝どちらも25勝未満。シールドは<b>SPアタックしか防げない</b>ので、
  実測では<b>高威力のSPを持つほど終盤型</b>、<b>安いSPを撃てる・ノーマルアタックが強いほど序盤型</b>になります。
  <b>どの型で揃えるのが正解、というものはありません</b>。終盤型で揃えれば相手のシールドが早く尽きて
  終盤に押し込みやすく、序盤型で揃えれば相手はシールドの使いどころを見失います。バランス型も当然ありです。
  ここは<b>いまどうなっているかを映すだけ</b>なので、狙う戦い方に合わせて
  <b>🔧序盤型を探す／🔧終盤型を探す</b>から入れ替え候補を出してください。</p>
  <p>右端の<b>穴+◯</b>は、<b>そのポケモンを抜いたときに増える穴の数</b>です
  （＝その相手に勝てるのがそのポケモンしかいない）。<b>増えない</b>と出たら、
  他の2匹で代われるので入れ替えても穴は増えません。
  行をタップすると、そのポケモンだけが勝てる相手に表を絞り込みます。</p>

  <h4>パーティ診断のシールドの数字</h4>
  <p>🛡のボタンに付く数字は、<b>その枚数で戦ったときの穴の数</b>です。
  わざ構成はいま選んでいる枚数で決めたものを使い回すので、
  「同じ3匹のまま、シールドの枚数だけ変えたらどうなるか」が見られます。</p>

  <h4>パーティ診断の「🔧 入れ替え候補」</h4>
  <p>いまの<b>穴</b>（穴が無ければ<b>1匹頼み</b>以下の対面）を埋められるポケモンを探し、
  <b>どのポケモンと入れ替えると穴が何匹減り、勝率がどう変わるか</b>を出します。
  <b>枠ごとに「①マリルリを替えるなら…」とまとめて、それぞれ3つまで</b>候補を並べます。
  並びは「穴の減り」と「勝率の上がり」の合計順です（穴1匹 ≒ 勝率3ポイントとして扱います）。</p>
  <p>範囲は<b>環境上位</b>（100匹・実戦の定番のわざ構成で計算）と
  <b>全ポケモン</b>（シャドウ込み・約1600匹。わざはダメージ効率で選んだノーマル1本＋SP2本）。
  全ポケモンは数が多いので、<b>穴に強そうな順に絞ってから</b>くらべます（何匹くらべたかは下に出ます）。</p>
  <p>行をタップすると、<b>そこに出ているわざのまま</b>枠に入ります。
  提案の数字はそのわざ構成での結果なので、オートのままだと構成を選び直して数字が変わってしまいます。
  そのため<b>わざはマニュアルに切り替わり</b>、残る2匹も<b>いま出ている構成のまま固定</b>されます
  （＝入れ替えた結果が提案どおりの数字になります）。<b>↩ 元に戻す</b>で1つ前に戻せます。</p>
  <p>入れ替えると<b>続けて次の候補を出します</b>。提案が出なくなるまで繰り返せば、そのリーグでの仕上がりです
  （<b>✅</b>が出ます）。何匹替えて穴と勝率がどう変わったかは<b>入れ替えの記録</b>に残ります
  （リーグやカップを変えると消えます）。</p>

  <h4>パーティ診断の「わざ」ボタン</h4>
  <p><b>白く光っているほうが、いま効いている設定</b>です。タップで切り替わります。</p>
  <p><b>マニュアル</b>（既定）は、枠のわざ欄を自分で選びます。空のままなら効率のよいわざが入ります。
  <b>オート</b>にすると、<b>環境上位にいちばん多く勝てるわざ構成</b>を1匹につき1つ選んで枠に表示します
  （対面ごとに選び直しません）。オート中はわざ欄を操作できません。
  どちらも<b>画面に出ているわざでそのまま計算</b>するので、マスをタップして開く1対1シミュと結果が食い違いません。</p>

  <h4>対策さがしの「範囲」</h4>
  <p>既定は<b>上位50</b>。<b>上位100</b>で51〜100位まで、<b>全ポケモン</b>で順位に関係なく全部（シャドウ込み・約1500匹）から探します。
  あまり使われていないポケモンで刺しにいきたいときは全ポケモンをどうぞ。
  <b>環境一覧・パーティ診断・環境スコアは上位50のまま</b>なので、点数の基準は変わりません。</p>
  <p>全ポケモンのときは、わざを総当たりすると重すぎるので
  <b>そのあいてにいちばん効くノーマル／SPを1本ずつ</b>計算式で選び、名前の下に出しています。
  もっと詰めたいときは行をタップして1対1シミュでわざを変えてみてください。
  表は<b>並び順の上位200件</b>まで出します（全部の件数は表の上に出ます）。</p>

  <h4>特殊カップの「🕘 過去のカップ」</h4>
  <p>特殊カップは開催されていない期間は環境を確かめられませんが、
  <b>そのカップが最後に開催されたときの環境上位100匹</b>を残してあります。
  選べば通常のリーグと同じように<b>環境一覧・対策さがし・パーティ診断・環境スコア</b>が使えるので、
  次にそのカップが来たときに向けて、いまの手持ちで戦えるかを先に試せます。</p>
  <p>カップ名の下の<b>年月がそのカップの最後の開催時期</b>です。
  ここに出るのは<b>環境上位の顔ぶれとわざ構成</b>で、週ごとの推移や実際の使用率ではありません。
  また、勝ち負けの計算は<b>いまのわざ・種族値</b>で行うので、
  古いカップほど当時の実際の戦いとは差が出ます。</p>

  <h4>模擬戦（GBL）の使い方</h4>
  <p><b>じぶん3匹×あいて3匹の対人戦を、実際のバトルの流れで再現する</b>モードです。
  枠にポケモンを入れて<b>▶ バトルスタート！</b>を押すと、タイムラインが1ターン＝0.5秒で流れ、
  <b>決断が要る場面</b>（SPアタックを撃つ？／シールドを使う？／交代する？）で止まって選択肢が出ます。
  選ぶとそこから先が計算し直されて、バトルが続きます。</p>
  <ul>
    <li>シールドは<b>両者2枚</b>、交代のクールタイムは<b>両者45秒</b>（GBLの仕様）</li>
    <li><b>SPアタックを撃つと1発につき約10秒かかります</b>（アイコン入力のミニゲームと演出）。
    実際のバトルではそのあいだも<b>タイマーが止まらない</b>ので、下のフレームの時計・タイムラインの
    <b>⏱</b>・決着までの秒数にその時間を足しています。<b>交代のクールタイム45秒にも算入される</b>ので、
    SPを撃つほど次の交代が早く明けます</li>
    <li>手動で交代すると、<b>相手の打ちかけのノーマルアタック1発が交代先に入ります</b>（開幕交代も同じ）</li>
    <li>1匹目の枠の「${SWAPMK}開幕交代」をONにすると、バトル開始と同時に2匹目か3匹目へ交代できます</li>
    <li><b>自分の能力が下がるSPアタック</b>（ブレイブバードなど）を撃った直後は「交代する？」と聞きます。
    下がった能力は交代で消えるので、「ためて連射して下がる」の実戦の動きを再現できます</li>
    <li>SPアタックの選択肢は<b>わざごとのフレーム</b>に<b>「⭐ 最適」「即打ち」</b>の2つのボタンがあります。
    <b>⭐ 最適</b>＝そのわざをいちばん効率のよいタイミングで撃つ（「＋2」なら、ノーマルアタックを
    あと2発はさんでから撃つのが最適という意味）。<b>即打ち</b>＝タイミングを待たず、たまり次第すぐ撃つ。
    おたがいのノーマルアタックが同じターン数の対面では、タイミングを合わせる意味が無いので最適＝即打ちになります。
    ＋1〜＋3発の細かい指定は<b>「…詳細」</b>の中にあります。
    <b>ノーマルアタックだけで倒しきれて、相手のSPアタックも飛んでこない</b>場面では
    <b>「撃たない」が緑に点灯</b>します（撃つのはもったいない＝ゲージを次の対面へ持ち越すのが定石。
    あいてのAIも同じ判断で撃ちません）</li>
    <li><b>あいてのSPアタックが2本のときは、どちらが飛んでくるか分かりません</b>（実戦と同じ。
    見えてしまうと、あいてのブラフが成立しないため）。飛んできたわざはタイムラインで確認できます</li>
    <li>あいての枠の右上の<b>「わざ えらぶ｜オート」</b>で、あいてのわざを<b>オート</b>にすると
    わざ欄が隠れて環境の定番構成で戦います＝<b>何が飛んでくるか完全に分からない実戦の練習</b>ができます。
    「えらぶ」なら今までどおり構成を見ながら戦えます</li>
  </ul>
  <p><b>あいての行動はAIが自動で判断</b>します。上の<b>「あいて難易度」</b>で強さを選べます:</p>
  <ul>
    <li><b>EASY（やさしい）</b>: はじめての人向け。SPアタックは撃てるようになったら<b>すぐ撃ちます</b>が、
    2本持っていても<b>消費の軽いほうしか使いません</b>。シールドは残っていれば必ず使うので
    <b>軽いわざのブラフにも引っ掛かり</b>、自分からは交代しません</li>
    <li><b>NORMAL（標準・既定）</b>: 実戦の基本戦術で戦う相手。<b>出し負けたらすぐ交代</b>
    （ためたSPは、防がれず効く一撃のときだけ撃ってから）・
    <b>勝てる対面はノーマルアタックだけで倒してゲージをため、次の相手にSPを撃つ</b>（起点づくり）・
    <b>裏に出しても有利にならないときは、SPを1発入れて削ってから下がる</b>・
    ブラフやシールドの温存も使います。不利な相手から逃げ回りながら戦ってきます。
    SPアタックの撃ち方もセオリーどおり: こちらにシールドが残っているあいだは、
    <b>本命の重いわざが撃てるゲージまでためてから</b>撃ってきます（撃つのは軽いほう＝防がれても
    ゲージが残り、重いわざの脅威も消えない）。ためないのは、余裕がないときや、
    軽いわざが弱点を突く・重いわざが通らないなど見せかけの必要がないときです</li>
    <li><b>HARD（最強）</b>: <b>こちらの3匹とわざ構成を最初から全部知っている</b>相手。
    シールドは実際に飛んでくるわざのダメージで判断するので<b>ブラフが効きません</b>。
    戦術はNORMALと同じ基本戦術ですが、控えの読みが予測ではなく実物なので、判断に迷いがありません</li>
  </ul>
  <p>NORMAL・HARDの細かい判断基準は次のとおりです。</p>
  <p><b>対面の頭の交代には細かい基準があります</b>: こちらが<b>自分から交代した</b>ときは、
  いま場にいるあいてのポケモンが「引っ込んだこちらのポケモンへの答え」なら<b>その対面のために温存</b>し、
  新しく出てきたこちらのポケモンには<b>勝てる控えを差し込んで</b>きます
  （例: ウッウ対モルペコでウッウがハガネールに逃げたら、モルペコはウッウ担当のまま下げて、
  ハガネールに勝てる控えを出す——役割の割り当てを守る基本の動きです）。
  <b>五分の対面</b>でも控えの2匹がどちらもこちらの
  ポケモンに強ければ、<b>対応力の高いほうへ即交代</b>して有利を取りにきます。逆に<b>不利な対面</b>でも、
  控えの片方が明らかに弱いときは<b>交代せず残って戦い</b>ます（残る1匹の答えを安売りしないため）。
  このとき<b>シールドは使いません</b>——不利な状況で無理に受けても非効率だからです。</p>
  <p><b>倒されたあと「次に誰を出すか」も効率で決めます</b>: こちらのゲージが乏しくてSPアタックを撃たれない
  （撃たれても痛手にならない）ときは、<b>あえて有利でないポケモンを出して起点</b>にし、ノーマルアタックだけで
  倒してゲージをためてきます（有利なポケモンは後の対面まで温存）。並んだときは
  <b>まだ見せていない3匹目を温存</b>し、次に<b>ノーマルアタックのチャージ効率が高いほう</b>
  （＝より多くためられる＝起点づくりに向いている）、それも同じくらいなら<b>被ダメージが少ないほう</b>を出します。
  <b>おたがいが同時に倒れたとき</b>は読み合いになりようがないので、2分の1で決まります。
  さらに、<b>こちらが交代できないあいだ（交代直後の45秒）は五分の対面でも有利な控えを差し込み</b>、
  こちらの交代に合わせて有利なポケモンを出し返し、<b>デバフを受けたら不利・五分の対面なら交代で下げ消し</b>します
  （有利な対面ならそのまま戦い、勝てる控えがいなければ残ります）。</p>
  <p>EASYとNORMALのAIは<b>ずるをしません</b>: シールドを使うかどうかは、実際に飛んできたわざではなく
  「こちらのわざ構成とゲージから撃たれそうなわざ」を<b>予測</b>して判断します。
  軽いわざでのブラフには本物の対戦相手と同じように引っ掛かります。
  また<b>まだ場に出ていないこちらのポケモンを知りません</b>（実戦と同じで、残りの数は分かっても中身は分かりません）。
  そのかわりNORMALは、<b>採用率とパーティの相性から「残りは何がいそうか」を予測</b>して、迷ったときの判断材料にします。
  <b>HARDだけはこのルールの例外</b>で、こちらの手の内（3匹・わざ・飛んでくるわざのダメージ）を
  すべて知ったうえで戦ってきます。
  シールドには<b>チームの文脈</b>も見ます: あとで戻ってくるこちらのポケモンに勝てるAIの控えが
  1匹しかいないときは、その1匹を温存するために<b>いまの対面をシールドを使ってでも確実に突破</b>しにきます
  （<b>使わなくても勝てる対面では使いません</b>。あくまで「使えば取れる対面で、こちらの動きに合わせて使う」動きです）。
  バトル中・バトル後に<b>金色のチップ</b>（あいての行動）をタップすれば、
  「ここでシールドを使われなかったら？」のように<b>あいての行動も選び直せます</b>。</p>
  <p><b>🔎 オートバトルの「最善」</b>を押して選んでからバトルスタートすると、
  勝ちと手持ちの残りがいちばん良くなる手順を探して、そのまま再生します。
  <b>結果だけ見る</b>で再生を飛ばして一気に結果を出せます。
  決断チップをタップするとその場面からやり直せます（それより後ろの選択は消えます）。</p>`}

  <p style="margin-top:8px">※ 以下は<b>ロケット団戦</b>の説明です（他のモードの説明も順次ここへまとめます）</p>

  <h4>ロケット団戦の勝ち方</h4>
  <p>大事なのは<b>いかに早く倒せるか</b>です。SPアタックは発動に時間がかかるので、
  ノーマルアタックだけで押し切れるならそのほうが速く終わります。
  ただしリーダー戦は撃たないと苦しい場面が多く、サカキ戦は最後の伝説が強いのでほぼ必ず撃つことになります。</p>

  <h4>あいての条件</h4>
  <ul>
    <li>あいては<b>必ずシャドウ</b>です（切り替えできません）</li>
    <li>ステータスは<b>ロケット団専用の計算式</b>で決まります（個体値100%扱い・目安として「PL40の理想個体」の
      およそ攻2.8倍/防1.7倍。<b>リーダーはさらに1.05倍</b>、<b>サカキはさらに1.15倍</b>で、
      ここにシャドウ補正が別途かかります）。実際の数値（CP・攻・防・HP）は<b>あいての欄</b>に出ます</li>
    <li>わざは<b>おぼえるわざからランダム</b>。特別なわざ（レガシー技）は使いません</li>
    <li>したっぱはシールドを使わず、SPアタックの威力は0.6倍。リーダーとサカキは<b>こちらの最初の2発を必ずシールドで防ぎ</b>、威力は等倍です</li>
    <li>あいては同じ個体で2種類のSPアタックを使い分けません</li>
  </ul>

  <h4>硬直（⏸️）と交代のクールタイム</h4>
  <ul>
    <li><b>硬直</b>＝<b>あいてが動けない</b>時間。SPアタックのあと3.5秒、瀕死で交代した直後4秒、手動で交代した直後4.5秒</li>
    <li><b>交代のクールタイム</b>＝<b>自分が次の交代を出せない</b>時間で<b>45秒</b>。硬直とは別のものです</li>
    <li>手動で交代すると自分も0.5秒動けませんが、あいてが4.5秒止まるぶん得になります</li>
  </ul>

  <h4>あいてのわざ全通り</h4>
  <p>あいてのわざはランダムなので決め打ちできません。そこで<b>全通りを試して</b>、どのわざで来ても勝てるかを出しています。
  並び順は<b>キツい順</b>（上ほど危ない）。自分のわざはバトル中に変えられないので、
  <b>全通りに対していちばん強い構成</b>を自動で選び、そのまま相手のわざだけを差し替えています。
  画面の主結果と勝敗表は、<b>いちばんキツいわざで来た場合</b>＝安全側で出しています（水色枠の行）。
  行をタップすると、そのわざで来たときの詳細に切り替わります。</p>

  <h4>おすすめランキング（1対1）</h4>
  <p>あいてを決めると、<b>ノーマルアタックだけで攻撃したときに火力が出る順</b>に並べます。
  ロケット団戦は早く倒すほど有利なので、SPアタックを撃たずに押し切れる相手を先に見つけるのが近道です。</p>
  <ul>
    <li>大きい数字は<b>倒しきるまでの秒数</b>、右下の小さい数字は<b>1秒あたりのダメージ</b>です</li>
    <li><b>⚠️</b>が付いたものは、<b>あいてのノーマルアタック次第で先に倒されます</b>。どのわざで負けるかを右に書いています</li>
    <li><b>高火力＋安定</b>に切り替えると、<b>あいてのわざがどれでも先に倒されない</b>ものだけになります</li>
    <li>シールドは<b>2枚とも残っている前提</b>です（SPアタックを撃たないので、まるごとあいてのSPを防ぐのに使えます）</li>
    <li>候補は<b>全ポケモン（理想個体値・PL50）</b>と、<b>★登録リストに入れた自分の個体</b>（★印・自分の個体値とPLで計算）です</li>
    <li>行をタップすると、そのポケモンで<b>シミュレート</b>に切り替わります。シミュレートは<b>SPアタックも使う前提</b>で計算するので、ランキングの秒数とは少し変わります</li>
  </ul>

  <h4>たたかい方の2つ</h4>
  <ul>
    <li><b>1対1</b>… おすすめランキングと、1匹どうしの詳しいシミュレートを切り替えられます</li>
    <li><b>模擬戦</b>… じぶんの3匹とあいての手持ちを通しで戦います。上から順に出し、倒れたら次。シールドはバトル全体で共有し、生き残りはHP・ゲージ・能力変化を引き継ぎます</li>
    <li><b>おすすめ（高火力／高火力＋安定）</b>… どのポケモンを使えばいいか思いつかないときの提案です。タブを押してから<b>じぶんの枠の入力欄をタップ</b>すると、<b>同じ順番のあいて</b>（1匹目↔1匹目…）への<b>対策トップ5</b>が出ます。基準は1対1のランキングと同じ（高火力=ノーマルアタックの火力順・高火力＋安定=あいてのどのわざでも先に倒されないものだけ・⚠=わざ次第で先に倒される）。タップで枠に入り、評価に使ったノーマルアタックがわざ欄にセットされます</li>
  </ul>

  <h4>模擬戦の使い方</h4>
  <p>ポケモンとわざをそろえて<b>▶ バトルスタート！</b>を押すと、バトルが<b>実際と同じ速さ（1ターン=0.5秒）</b>で上から流れ、<b>決断の場面で止まって選択肢が出ます</b>。選ぶとまた流れ出します。画面のいちばん下には、いまの<b>HP・SPゲージ・シールド・能力変化・残り手持ち</b>がつねに見えています。</p>
  <ul>
    <li><b>SPゲージの円</b>は<b>1周=1発ぶん</b>。2周目・3周目は色が変わって重なり、<b>数字はいま撃てる発数</b>です（例: グロウパンチ35なら最大2発＋86%）</li>
    <li>シールドは<b>2枚を全部使う前提</b>です（ロケット団戦では出し惜しみする意味がほぼ無いため、枚数の選択はありません）</li>
  </ul>
  <ul>
    <li><b>⚡ SPアタック</b>… 撃つわざをタップ／<b>＋1〜＋3</b>（ノーマルアタックをそのぶん打ってからもう一度選ぶ）／<b>撃たない</b>（この相手には撃たず、ゲージを次の相手に持ち越す）／<b>おまかせ</b>（AIの判断で進める）</li>
    <li><b>🛡 〜が来る！</b>… シールドで<b>使う</b>か、<b>受ける</b>か（受けた場合のダメージつき）</li>
    <li><b>${SWAPMK} 交代する？</b>… あいての交代直後（硬直中に攻撃したあと）に聞かれます</li>
    <li><b>SPアタックには待ち時間があります</b>（入力と演出のあいだ手が止まる）。
    <b>じぶんが撃つと9秒</b>、<b>あいてが撃つと5秒</b>（シールドで防ぐと7秒）。
    ＝<b>あいてに撃たせたほうが待ち時間が短い</b>ので、ノーマルアタックで押し切れるなら
    そのほうが速く倒せます。時計・⏱・決着までの秒数・<b>交代のクールタイム45秒</b>に算入しています
    （あいての硬直はバトル内のターンの話なので、これとは別に効きます）</li>
    <li><b>${SWAPMK} 開幕交代</b>… 1匹目の枠のタブをONにすると、バトルスタート直後に交代先を選びます。あいての打ちかけの1発は交代先に入り、あいては4.5秒硬直します（交代クールタイム45秒もここから始まります）</li>
    <li><b>💀 次に出すのは？</b>… 倒されたときの交代先</li>
    <li>決めた場面はタイムラインに<b>チップ</b>で残ります。タップすると<b>その場面まで巻き戻してやり直せます</b>（それより後ろの選択は消えます）</li>
    <li>下のフレームの <b>⏸／×1／⏩</b> で一時停止・倍速（×1×2×4）・次の決断まで飛ばす、ができます。<b>⏹</b>（または上の<b>▶ バトルスタート！</b>）で選んだ手を消して、もう一度はじめからバトルできます。決着後の <b>↻</b> は同じ選択のまま再生し直します</li>
  </ul>
  <h4>わざの決め方</h4>
  <ul>
    <li><b>じぶん</b>… 枠ごとに<b>ノーマルアタック／SPアタック1／SPアタック2</b>を選びます。わざはバトル中に変えられないので、ここで決めたわざで最後まで戦います</li>
    <li>既定では<b>ノーマルアタック・SPアタックともダメージ効率がいちばん高いわざ</b>が選ばれています。ノーマルアタックだけ<b>おまかせ</b>（相手に合わせて自動）も選べます。SP2本目を開放していないなら「なし」にしてください</li>
    <li><b>あいて</b>… ロケット団は<b>おぼえるわざの中からランダムに</b>打ってきます。既定の<b>自動（いちばんキツい）</b>は、全通りのうち<b>こちらにいちばんキツいわざ</b>を引いた前提で計算します（1対1と同じ基準）。わざを決め打ちしたいときは選ぶか、<b>⚙ 詳細</b>の<b>🎲</b>でランダムな引きを再現できます（押すたびに変わります）</li>
    <li><b>⚙ 詳細</b>（おすすめの右）… 使う頻度の低い設定置き場です。<b>確率で能力が上下するわざ</b>の扱い、<b>じぶんの個体値・PL</b>（既定はPL50・個体値100%。「理想個体値」で戻せます）、<b>あいてのわざの🎲ランダム</b>がここにあります</li>
    <li>わざを決め打ちしたときは、結果に<b>🎲 わざ運が最悪でも</b>が添えられ、わざ運がどう転んでも大丈夫かを確かめられます</li>
  </ul>

  <ul>
    <li><b>結果だけ見る</b>（オートバトル行の右）… バトルを流さず、全部おまかせで戦った結果を<b>一気に</b>出します。並んだチップをタップすれば選び直せます。もう一度押すと流れるバトル表示に戻ります</li>
    <li><b>🔎 オートバトル（最速／安定）</b>… <b>押して選んでおき、▶ バトルスタート！で開始</b>すると、決断の組み合わせをAIが自動でさがして再生します（もう一度押すと解除）。<b>最速</b>=勝てる中で決着がいちばん早い手順、<b>安定</b>=勝てる中で手持ちとHPがいちばん残る手順（どちらも「勝てること→倒した数」が最優先）。再生後も続けて手直しできます</li>
    <li>引っ込めたポケモンはHP・ゲージを保ったまま控えに戻り、出し直すと続きから戦います</li>
    <li><b>🎲 わざ運が最悪でも</b>… あいてのわざを決め打ちしたときだけ出ます。対面ごとに<b>こちらがいちばんキツいわざ</b>を引いた場合の結果です（わざ欄が全部「自動」なら主結果がそのまま最悪ケースです）</li>
  </ul>

  <h4>計算の前提</h4>
  <ul>
    <li>ロケット団戦は<b>CP制限なし</b>。じぶんは個体値を理想値・PLを上限まで上げた前提で計算します（★登録リストから呼び出せば自分の個体値・わざで計算します）</li>
    <li>「ねっとう(30%で相手の攻撃⬇)」のような運まかせの効果の扱いは、画面上部で切り替えられます（既定は<b>不発</b>＝運に頼らない見方）</li>
    <li>1ターン＝0.5秒です</li>
  </ul>`;
(() => {
  const tab = document.getElementById('helptab'), body = document.getElementById('helpbody');
  tab.onclick = () => {
    const open = body.style.display === 'none';
    if (open && !body.innerHTML) body.innerHTML = HELP_HTML;
    body.style.display = open ? 'block' : 'none';
    tab.setAttribute('aria-expanded', open);
    tab.textContent = open ? '？ 使い方・マークの見かた（閉じる）' : '？ 使い方・マークの見かた';
  };
})();

// ---- ロケット団戦の設定 ----
// 外部の対面シミュレータに書かれている動き:
//  ・どちらかがSPアタックを撃つと、あいては4ターン(2秒)硬直する
//  ・交代や新しいポケモンが出たとき、あいては6ターン(3秒)硬直する
//  ・したっぱはSPアタックの威力が0.5〜0.7倍(最短で撃つ場合0.6倍として計算)、幹部は1倍
//  ・同じ個体が2種類のSPアタックを使い分けることはない
// ステータスは専用CPM(RCPM)方式(pvp-engine.jsのbuildStats参照)。外部シミュレータの
// 表示実数値20例(3種別)と完全一致することを2026-08-10に確認した。
// シャドウ補正(攻×1.2・防÷1.2)はこの計算には含まれず、通常のポケモンと同じく戦闘計算でかかる
// (この扱いで「シャドウミュウツーPL40攻13のねんりきで4発(3.8発)」という実測と一致する)
// 硬直(2026年3月時点の確定情報。0.5秒=1ターン):
//   SPアタック発動直後 3.5秒=7ターン / 瀕死による交代直後 4秒=8ターン / 手動交代直後 4.5秒=9ターン
//   手動交代のときは自分も0.5秒(1ターン)動けないので、実質は8ターン分の得になる
// team=3枠を使う画面(模擬戦)か / sh=自分のシールド(バトル全体で共有)
// koFoe=あいてが倒れて次が出た直後の硬直 / koMe=自分が倒れて次を出した直後の硬直(どちらも既定8ターン=4秒)
// who=だれと戦うか(シエラ/クリフ/アルロ/サカキ) / sel=その人の何匹目に誰を選んでいるか(候補の番号)
// play=たたかい方('1v1'=1対1 / 'build'=模擬戦(3匹の通し。手を置かなければ自動で戦う))
// team は「じぶん・あいての3枠を使う画面か」を表す(＝模擬戦)
// swapCd=交代のクールタイム(ターン)。一度自分から交代したら、この時間が過ぎるまで次の交代ができない。
// 「あいてが固まる硬直(4.5秒)」とは別物で、こちら側の制約。45秒=90ターン(ユーザー確定)。
// これが無いと「交代を連打してあいてを硬直させ続ける」抜け道が成立してしまう
// whoBy = 種別ごとに最後に選んだ人(リーダーでアルロ→サカキ→リーダー と戻ってもアルロのまま)
// leadSwap=開幕交代(1匹目を出してすぐ交代し、あいての硬直4.5秒を序盤に稼ぐテク)
const RK = { kind: 'grunt', stall: 7, enter: 'first', play: '1v1', team: false, sh: 2, koFoe: 8, koMe: 8, swapCd: 90, who: null, whoBy: {}, sel: {}, leadSwap: false };
// 共有リンクでSPアタックタイミングが指定されていたか(指定があればロケット団戦の既定「撃たない」で上書きしない)
let timingFromUrl = false;
const RK_PLAY = { 0: '1v1', 1: 'build' };
function setPlay(v) { RK.play = v; RK.team = v !== '1v1'; }
const RK_ENTER = {
  first: { foe: 0, me: 0, label: '先頭（開幕）' },
  ko:    { foe: 8, me: 0, label: '倒されて交代' },
  swap:  { foe: 9, me: 1, label: '手動で交代' },
};
// ステータスは専用CPM(RCPM)方式でエンジン(buildStats)が計算する。ここでは種別の係数だけ渡す。
// 2026-08-10確定: 外部シミュレータと20例(3種別)で表示値が完全一致
//   サカキ×1.15 … ペルシアン(CP7956・攻415.88・防228.35・HP160)と一致
//   リーダー×1.05 … チゴラス(CP6417・攻397.66・防190.55・HP136)と一致
const RK_BASE = [1, 1, 1];   // したっぱ: 係数1(RCPM素のまま)
const rkMult = r => RK_BASE.map(v => v * r);
const RK_SPEC = {
  grunt:  { name: 'したっぱ', mult: rkMult(1), sp: 0.6, shields: 0 },
  leader: { name: 'リーダー', mult: rkMult(1.05), sp: 1, shields: 2 },
  boss:   { name: 'サカキ',   mult: rkMult(1.15), sp: 1, shields: 2 },
};
const rkSpec = () => RK_SPEC[RK.kind];
const rkShields = () => rkSpec().shields;   // したっぱはシールドを使わない
// ロケット団の相手(NPC)の共通設定。SPアタックは撃てしだい・硬直あり・ステータスは倍率で決まる。
// opt.stallStart=登場したときの硬直ターン / opt.shields=残りシールド枚数(通しの途中から使う)
function rkCfg(c, opt) {
  opt = opt || {};
  const sp = rkSpec();
  c.npc = true; c.stallSp = RK.stall; c.timing = 'asap';
  c.stallStart = opt.stallStart != null ? opt.stallStart : RK_ENTER[RK.enter].foe;
  c.statMult = sp.mult;   // ステータスはPL40・個体値100%基準の倍率で決まる
  c.spMult = sp.sp;       // したっぱのSPアタックは威力0.6倍
  c.shadow = true;        // ロケット団のポケモンはシャドウ(補正は倍率とは別にかかる)
  delete c.shotPlan; delete c.shotRest;
  if (opt.shields != null) {
    // 連戦の途中: 残っている枚数をそのまま使う(古い順＝先に撃たれたSPから防ぐので指定は不要)
    c.shields = opt.shields;
    delete c.shieldPlan; delete c.shieldRest;
  } else if (sp.shields) { c.shields = 2; c.shieldPlan = [1, 2]; c.shieldRest = false; }
  else { c.shields = 0; delete c.shieldPlan; delete c.shieldRest; }
  return c;
}
const RK_NOTE = {
  grunt: 'したっぱ（ムサシ・コジロウを含む）は<b>シールドを使いません</b>。SPアタックは手加減してくる（威力<b>0.6倍</b>）ものとして計算します。',
  leader: 'リーダー（シエラ・クリフ・アルロ）は<b>こちらの最初の2発のSPアタックを必ずシールドで防ぎます</b>。SPアタックの威力は等倍です。',
  boss: 'サカキは<b>こちらの最初の2発のSPアタックを必ずシールドで防ぎます</b>。SPアタックの威力は等倍です。',
};

// ---- リーダー・サカキの手持ち(内蔵データ) ----
// データは assets/rocket_roster.js。したっぱは相手が多すぎるので内蔵しない(自分で選ぶ)
const RR = window.ROCKET_ROSTER || { updated: '', list: {} };
const rkWhoList = () => (RR.list && RR.list[RK.kind]) || [];
const rkWho = () => rkWhoList().find(w => w.id === RK.who) || null;
// 選んでいる並び(各枠の候補番号)。未選択の枠は先頭の候補にする
const rkSel = w => (RK.sel[w.id] = (RK.sel[w.id] || w.slots.map(() => 0)));
const rkLineup = w => w.slots.map((cands, s) => cands[rkSel(w)[s]] || cands[0]).filter(k => D.pokemon[k]);

// 手持ちの1匹を「あいて」として使う。1対1は右パネル、模擬戦は指定の枠に入れる
// (どちらも表示の作り直しと再計算までここで済ませる)
function rkPutOne(slot, key) {
  if (!D.pokemon[key]) return;
  if (!RK.team) { pick(1, key); return; }   // 1対1: pickがシャドウ固定の表示と再計算までやる
  RKT[slot] = { key, fast: null, c1: null };
  saveRkt(); syncRocket(); run();
}
// その人の手持ちをまるごと呼び出す(連戦なら3枠、1対1なら1匹目)
function rkPutAll() {
  const w = rkWho();
  if (!w) return;
  const line = rkLineup(w);
  if (!RK.team) { if (line[0]) pick(1, line[0]); else { syncRocket(); run(); } return; }
  [0, 1, 2].forEach(i => { RKT[i] = line[i] ? { key: line[i], fast: null, c1: null } : null; });
  saveRkt(); syncRocket(); run();
}
// 手持ちパネルの描画(したっぱのときは丸ごと隠す)
function renderRoster() {
  const box = document.getElementById('rkroster');
  const list = rkWhoList();
  if (!list.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  if (!rkWho()) RK.who = list[0].id;   // 既定はリストの先頭(呼び出しはタップしたときだけ)
  const w = rkWho(), sel = rkSel(w);
  document.getElementById('rkwho').innerHTML = list.map(x =>
    `<button data-w="${x.id}" aria-pressed="${x.id === RK.who}" title="${x.name}の手持ちを${RK.team ? 'あいての3枠' : 'あいての欄'}に呼び出す">${x.name}</button>`).join('');
  const chip = (key, s, j) => {
    const p = D.pokemon[key];
    if (!p) return `<button class="rkchip" disabled>${key}</button>`;
    // 1対1は「いまあいてに入っている1匹」、連戦は「その枠に選んだ1匹」を光らせる
    const on = RK.team ? j === sel[s] : key === S[1].key;
    // ロケット団のあいては全部シャドウなので、チップにはマークを付けない
    // (タイプアイコンと名前のあいだに入って読みにくくなる。あいての入力欄のマークで足りる)
    return `<button class="rkchip${on ? ' on' : ''}" data-s="${s}" data-j="${j}"
      title="シャドウ${p.n}を${RK.team ? `${s + 1}匹目に入れる` : 'あいてにする'}">${p.n}${typeIcons(p, 14)}</button>`;
  };
  // 「固定/ランダム」は文字でなく📌🎲で示す(説明は最下部の「使い方」へ)
  document.getElementById('rklineup').innerHTML = w.slots.map((cands, s) =>
    `<div class="rkslot"><span class="rkslbl">${s + 1}匹目
      <i title="${cands.length < 2 ? '必ずこれが出てきます' : 'この中からランダムで出てきます'}">${cands.length < 2 ? '📌' : '🎲'}</i></span>
      <div class="rkcands">${cands.map((k, j) => chip(k, s, j)).join('')}</div></div>`).join('');
  // 「◯◯時点」の日付は出さない(常に最新に保つ前提。データ側の updated は更新時の目印として残す)
  document.querySelectorAll('#rkwho button').forEach(b => b.onclick = () => {
    RK.who = RK.whoBy[RK.kind] = b.dataset.w;
    rkPutAll();
  });
  document.querySelectorAll('#rklineup .rkchip').forEach(b => b.onclick = () => {
    if (b.disabled) return;
    const s = +b.dataset.s, j = +b.dataset.j;
    rkSel(w)[s] = j;
    rkPutOne(s, w.slots[s][j]);
  });
}

// ---- モード切替(1対1シミュ / 環境一覧) ----
let mode = PAGE_ROCKET ? 'rocket' : PAGE_BLOG ? 'blog' : 'duel', multiToken = 0;   // ロケット団・対戦記録ページはモード固定
// 一覧系3モードの「⚙ 詳細」(ブラフ・能力変化わざ)の開閉
const MDET = { open: false };
function syncMdet() {
  const tab = document.getElementById('mdettab'), body = document.getElementById('mdetbody');
  tab.setAttribute('aria-expanded', MDET.open);
  body.style.display = MDET.open ? '' : 'none';
}
function applyMode() {
  // 環境一覧は「じぶん」だけ、カウンター検索は「あいて」だけ、パーティ診断は専用の3枠を使う
  const rk = mode === 'rocket';
  const rkTeam = rk && RK.team;   // 模擬戦は専用の3枠を使う(1対1の左右パネルは隠す)
  // 1対1のランキング表示のときは「じぶん」を選ぶ必要がない(あいてだけ決めればよい)
  const rkRankView = rk && RK.play === '1v1' && RKR.view !== 'sim';
  const mock = mode === 'mock';   // GBL模擬戦(3匹×3匹)。専用の枠を使うので左右パネルは隠す
  const duelBox = document.querySelector('.duel');
  duelBox.style.display = mode === 'party' || mode === 'blog' || mock || rkTeam ? 'none' : '';
  duelBox.classList.toggle('solo', mode === 'multi' || mode === 'counter');   // 片側だけのときは1列で広く使う
  // ロケット団戦はCP制限が無いのでリーグは選ばせない。相手の設定は専用パネルにまとめる
  document.getElementById('leagues').style.display = rk ? 'none' : '';
  document.getElementById('cupwin').style.display = 'none';
  document.getElementById('rocket').style.display = rk ? 'block' : 'none';
  if (rk) syncRocket(); else restoreFoeInputs();
  syncCounterPanel(mode === 'counter');
  syncMultiPanel(mode === 'multi');
  sideEl[0].style.display = mode === 'counter' || rkRankView ? 'none' : '';
  sideEl[1].style.display = mode === 'duel' || mode === 'counter' || rk ? '' : 'none';
  duelBox.classList.toggle('solo', mode === 'multi' || mode === 'counter' || rkRankView);
  document.getElementById('multi').style.display = mode === 'multi' ? 'block' : 'none';
  document.getElementById('counter').style.display = mode === 'counter' ? 'block' : 'none';
  document.getElementById('party').style.display = mode === 'party' ? 'block' : 'none';
  document.getElementById('mock').style.display = mock ? 'block' : 'none';
  document.getElementById('blog').style.display = mode === 'blog' ? 'block' : 'none';
  document.getElementById('rkteam').style.display = rkTeam ? 'block' : 'none';
  document.getElementById('rkrank').style.display = rkRankView ? 'block' : 'none';
  // 能力変化わざの設定は、どの画面でも「ポケモンの設定の下・結果の上」に置く。
  // 模擬戦と一覧系3モードは「⚙ 詳細」パネルの中にしまう(常時出すと幅と文字を取りすぎる)
  const goptEl = document.getElementById('gopt');
  const bfEl = document.getElementById('gbluff');
  const detTab = document.getElementById('mdettab');
  const detBody = document.getElementById('mdetbody');
  const detWrap = document.getElementById('mdet');
  const listMode = ['multi', 'counter', 'party'].includes(mode);
  // ブラフの設定は環境リストを使う3モードだけ
  bfEl.style.display = listMode ? '' : 'none';
  const detHome = () => {   // 使わないときはタブも中身も入れ物へ戻しておく
    if (detTab.parentElement !== detWrap) detWrap.insertBefore(detTab, detWrap.firstChild);
    if (detBody.parentElement !== detWrap) detWrap.appendChild(detBody);
  };
  if (listMode) {
    if (bfEl.parentElement !== detBody) detBody.appendChild(bfEl);   // ブラフ→能力変化わざの順
    if (goptEl.previousElementSibling !== bfEl) detBody.appendChild(goptEl);
    if (mode === 'party') {
      // パーティ診断はタブを「わざ｜オート」の右へ、中身は見出しのすぐ下(3枠の上)へ置く
      const ph = document.querySelector('#party .phead'), ps = document.querySelector('#party .pslots');
      if (detTab.parentElement !== ph) ph.appendChild(detTab);
      if (detBody.nextElementSibling !== ps) ps.parentElement.insertBefore(detBody, ps);
      detWrap.style.display = 'none';
    } else {
      const anchor = document.getElementById(mode);
      detHome();
      detWrap.style.display = '';
      if (detWrap.nextElementSibling !== anchor) anchor.parentElement.insertBefore(detWrap, anchor);
    }
  } else {
    detHome();
    detWrap.style.display = 'none';
    if (mock) {
      // GBL模擬戦: 能力変化わざの設定は枠の下・バトルの上に置く(設定の下に結果、の共通ルール)
      const anchor = document.querySelector('#mock .gbbody');
      if (goptEl.nextElementSibling !== anchor) anchor.parentElement.insertBefore(goptEl, anchor);
    } else if (rkTeam) {
      const pr = document.querySelector('#rkdetail .rkdprob');
      if (pr && goptEl.parentElement !== pr) pr.appendChild(goptEl);
    } else if (mode === 'rocket' && RK.play === '1v1' && RKR.view === 'sim') {
      // ロケット団1対1のシミュレートは「⚙ 詳細」の中(敵硬直の下)へ
      const box = document.getElementById('rksimbox');
      if (goptEl.parentElement !== box) box.appendChild(goptEl);
    } else {
      const anchor = document.getElementById('result');
      if (goptEl.nextElementSibling !== anchor) anchor.parentElement.insertBefore(goptEl, anchor);
    }
  }
  syncMdet();
  renderRkDetail();
  renderMyPk();   // ★登録リストの中身はモードで変わる(ロケット団戦のあいてはメガ・ゲンシ不可)
  if ((mode !== 'duel' && !rk) || rkTeam || rkRankView) {
    document.getElementById('result').style.display = 'none';
    document.getElementById('tl').style.display = 'none';
    // 模擬戦(ロケット団・GBLとも)は「置いた手」ごとURLで共有できるので、コピーボタンは出したままにする
    document.getElementById('share').style.display = (mock || RK.play === 'build') ? 'flex' : 'none';
  }
}

// ロケット団戦パネルの表示を状態に合わせる(あいて側の入力欄も整理する)
function syncRocket() {
  const sp = rkSpec();
  document.querySelectorAll('#rkkind button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === RK.kind));
  // 敵硬直は「途中の対面を切り出す」1対1専用の設定。模擬戦は開幕からの通しなので隠す。
  // ランキング表示中はパネルではなく、枠内チップ行の右端「⚙ 詳細」の中へ行ごと移す
  if (RK.team) RK.enter = 'first';
  const rankView = RK.play === '1v1' && RKR.view !== 'sim';
  const simView = RK.play === '1v1' && RKR.view === 'sim';
  const entRow = document.getElementById('rkenterrow');
  if (rankView || simView) {   // どちらの表示でも「⚙ 詳細」の中(先頭)へ行ごと移す
    const box = document.getElementById(rankView ? 'rkentbox' : 'rksimbox');
    if (entRow.parentElement !== box) box.insertBefore(entRow, box.firstChild);
    entRow.classList.remove('rksep');
    entRow.style.display = '';
  } else {   // 模擬戦はパネルの行に戻して隠す(開幕固定)
    document.getElementById('rkviewrow').before(entRow);
    entRow.classList.add('rksep');
    entRow.style.display = 'none';
  }
  document.getElementById('rkentdet').setAttribute('aria-expanded', RKR.det ? 'true' : 'false');
  document.getElementById('rkentbox').style.display = (rankView && RKR.det) ? '' : 'none';
  const simDet = document.getElementById('rksimdet');
  simDet.style.display = simView ? '' : 'none';
  simDet.setAttribute('aria-expanded', RKR.det ? 'true' : 'false');
  document.getElementById('rksimbox').style.display = (simView && RKR.det) ? '' : 'none';
  document.querySelectorAll('#rkenter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === RK.enter));
  document.querySelectorAll('#rkmode button').forEach(b => b.setAttribute('aria-pressed', RK_PLAY[b.dataset.v] === RK.play));
  syncFoeSlots();
  renderRoster();   // リーダー・サカキの手持ち(したっぱのときは隠れる)
  // 1対1のときだけ「対策」の切り替えを出す
  const vr = document.getElementById('rkviewrow');
  vr.style.display = RK.play === '1v1' ? '' : 'none';
  vr.querySelectorAll('#rkviewbtns button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === RKR.view));
  document.querySelectorAll('#rkfilt button').forEach(b => b.setAttribute('aria-pressed', !!RKR[b.dataset.f]));
  // あいての条件(シャドウ・ステータス倍率・シールド枚数・硬直)は画面に出さない。
  // 見て何かを変えられる情報ではないので、説明はすべて最下部の「使い方」へ。
  // 実際の数値(CP・攻・防・HP)はあいてのパネルに出るので、必要ならそちらで足りる。
  // ロケット団のポケモンはステータスの決まり方が違うので、個体値・PLの欄は使わない
  S[1].c2 = null;   // 同じ個体が2種類のSPアタックを使い分けることはない
  // ロケット団はメガ・ゲンシを使ってこない。他モードから持ち越していたら外す
  if (isMega(S[1].key)) { S[1].key = null; S[1].fast = S[1].c1 = null; resetPin(1); sideEl[1].querySelector('input').value = ''; }
  if (S[1].key) {   // 特別なわざ(レガシー技)は打ってこないので、選ばれていたら自動選択に戻す
    const pool = rkPool(S[1].key);
    if (S[1].fast && !pool.fasts.includes(S[1].fast)) S[1].fast = null;
    if (S[1].c1 && !pool.chargeds.includes(S[1].c1)) S[1].c1 = null;
  }
  const el = sideEl[1];
  // ロケット団はシャドウしか使ってこないので、シャドウは常にON(押しても切り替わらない)
  // ロケット団戦は「SPを撃たずに速く倒す」のが基本なので、タイミングの既定は「撃たない」。
  // 共有リンクでタイミングが指定されているときは尊重する
  if (RK.prevTiming == null && !timingFromUrl) {
    RK.prevTiming = S[0].timing;
    S[0].timing = 'never';
    resetSpPlan(0);
  }
  if (RK.prevShadow == null) RK.prevShadow = S[1].shadow;   // 他モードへ戻したときのために覚えておく
  S[1].shadow = true;
  const tab = el.querySelector('.shadowtab');
  tab.setAttribute('aria-pressed', true);
  tab.setAttribute('aria-disabled', true);
  tab.title = 'ロケット団のポケモンは必ずシャドウです（切り替えできません）';
  if (S[1].key) el.querySelector('input').value = 'シャドウ' + D.pokemon[S[1].key].n;
  // シールド(種別で決まる)・タイミング(常に撃てしだい)・連戦(登場の設定で扱う)は選ばせない
  // ★登録リストは「自分の個体値で計算する」ための機能。あいてはNPCで倍率が決まっているので出さない
  ['.ivmode', '.custIv', '.smaxwrap', '.c2row', '.bluffwrap', '.shields', '.custShield',
   '.timing', '.custSp', '.carry', '.custCarry', '.mypkbar', '.mypklist'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = 'none';
  });
  ['.ivmode', '.c2row', '.shields', '.timing', '.carry'].forEach(sel => hideLabelFor(el, sel));
  syncTimingTabs(true);
}
// SPアタックタイミングのタブは画面で出し分ける(2026-08-10ユーザー指示):
//   ロケット団戦 … 「同時」を出さない（硬直があって相手に合わせるのが現実的でない）代わりに「撃たない」
//   GBL         … 従来どおり「同時」まで。「撃たない」は出さない
function syncTimingTabs(rk) {
  sideEl.forEach((el, i) => {
    el.querySelectorAll('.timing button').forEach(b => {
      // 溜め打ちはGBL専用で、表示するかどうかは run() が「自分デバフわざを選んでいるか」で決める。
      // ここではロケット団戦で隠すことだけ受け持つ
      if (b.dataset.v === 'stock') { if (rk) b.style.display = 'none'; return; }
      const hide = rk ? b.dataset.v === 'sync' : b.dataset.v === 'never';
      b.style.display = hide ? 'none' : '';
    });
    // 隠したタブが選ばれたままにならないよう「最適」へ戻す
    if ((rk && ['sync', 'stock'].includes(S[i].timing)) || (!rk && S[i].timing === 'never')) {
      S[i].timing = 'optimal';
      resetSpPlan(i);
    }
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[i].timing));
  });
}
// 入力欄のすぐ上の見出し(ラベル)も一緒に隠す/戻す
function hideLabelFor(el, sel, show) {
  const n = el.querySelector(sel);
  const lb = n && n.previousElementSibling;
  if (lb && lb.classList.contains('f')) lb.style.display = show ? '' : 'none';
}
// カウンター検索は「このポケモンがざっくり何に弱いか」を見る画面なので、
// 細かい手順の指定(シールドのﾏﾆｭｱﾙ・SPアタックタイミング・連戦)は出さない(2026-08-11ユーザー指示)。
// 表示を消すだけだと前の設定が裏で効いて結果がズレるので、値も既定へ寄せる(抜けるときに元へ戻す)
const CN = { prev: null };
// 環境一覧のじぶんパネルから、結果の読み方を混乱させる設定を隠す(2026-08-13タダシさん指示)。
// 理屈は対策さがし(下のsyncCounterPanel)と同じ:
//  - シールド: 表が🛡0-0/1-1/2-2の3列を常に全部見せているので、パネルの枚数設定は結果に効かない。
//    見えているのに設定が残っていると「効くのでは」と迷わせる
//  - SPアタックタイミング・発ごとのSP設定・連戦: こちらは**裏で結果に効いてしまう**
//    (S[0].timing と carryOf(0) が50匹ぶんの計算に渡る)。隠すだけでなく値も既定へ寄せ、
//    1対1で入れた設定が見えない前提として働かないようにする。抜けるときは元へ戻す
const MVP = { prev: null };
function syncMultiPanel(on) {
  const el = sideEl[0];
  if (!el) return;
  ['.timing', '.carry', '.shields'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = on ? 'none' : '';
    hideLabelFor(el, sel, !on);
  });
  ['.custShield', '.custCarry', '.custSp'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n && on) n.style.display = 'none';
  });
  if (on) {
    if (!MVP.prev) MVP.prev = { timing: S[0].timing, carry: S[0].carry, shieldMode: S[0].shieldMode };
    S[0].timing = 'optimal'; S[0].carry = false;
    if (S[0].shieldMode === 'plan') { S[0].shieldMode = null; S[0].shields = 2; }
    resetSpPlan(0);
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'optimal'));
    el.querySelectorAll('.carry button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'off'));
    el.querySelectorAll('.shields button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(S[0].shields)));
  } else if (MVP.prev) {
    S[0].timing = MVP.prev.timing; S[0].carry = MVP.prev.carry; S[0].shieldMode = MVP.prev.shieldMode;
    MVP.prev = null;
    resetSpPlan(0);
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[0].timing));
    el.querySelectorAll('.carry button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === (S[0].carry ? 'on' : 'off')));
  }
}
function syncCounterPanel(on) {
  const el = sideEl[1];
  if (!el) return;
  const planBtn = el.querySelector('.shields button[data-v="plan"]');
  // シールドは行ごと隠す(2026-08-13タダシさん指示)。表が🛡0-0/1-1/2-2の3列を
  // 常に全部見せているので、パネルの枚数設定は結果に効かず、残すと迷わせるだけ
  ['.timing', '.carry', '.shields'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = on ? 'none' : '';
    hideLabelFor(el, sel, !on);
  });
  ['.custShield', '.custCarry', '.custSp'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n && on) n.style.display = 'none';
  });
  if (planBtn) planBtn.style.display = on ? 'none' : '';
  if (on) {
    if (!CN.prev) CN.prev = { timing: S[1].timing, carry: S[1].carry, shieldMode: S[1].shieldMode };
    S[1].timing = 'optimal'; S[1].carry = false;
    if (S[1].shieldMode === 'plan') { S[1].shieldMode = null; S[1].shields = 2; }
    resetSpPlan(1);
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'optimal'));
    el.querySelectorAll('.carry button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'off'));
    el.querySelectorAll('.shields button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(S[1].shields)));
  } else if (CN.prev) {
    S[1].timing = CN.prev.timing; S[1].carry = CN.prev.carry; S[1].shieldMode = CN.prev.shieldMode;
    CN.prev = null;
    resetSpPlan(1);
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[1].timing));
    el.querySelectorAll('.carry button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === (S[1].carry ? 'on' : 'off')));
  }
}
// ロケット団戦から他のモードへ戻したときに、隠した欄を元に戻す
function restoreFoeInputs() {
  const el = sideEl[1];
  ['.ivmode', '.c2row', '.shields', '.timing', '.carry'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = '';
    hideLabelFor(el, sel, true);
  });
  el.querySelector('.mypkbar').style.display = '';   // ★登録リストのタブを戻す
  syncTimingTabs(false);
  el.querySelector('.smaxwrap').style.display = (S[1].key && isMega(S[1].key)) ? 'block' : 'none';
  el.querySelector('.bluffwrap').style.display =
    S[1].c2 && !['multi', 'counter', 'party'].includes(mode) ? 'block' : 'none';
  hideLabelFor(el, '.ivmode', true); hideLabelFor(el, '.c2row', true);
  // シャドウ固定を解除し、ロケット団戦に入る前の状態へ戻す
  const tab = el.querySelector('.shadowtab');
  if (RK.prevTiming != null) { S[0].timing = RK.prevTiming; RK.prevTiming = null; resetSpPlan(0); }
  if (RK.prevShadow != null) { S[1].shadow = RK.prevShadow; RK.prevShadow = null; }
  tab.setAttribute('aria-pressed', !!S[1].shadow);
  tab.removeAttribute('aria-disabled');
  tab.title = 'シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする';
  if (S[1].key) el.querySelector('input').value = (S[1].shadow ? 'シャドウ' : '') + D.pokemon[S[1].key].n;
}
// したっぱのあいては内蔵データが無く自分で選ぶので、リーダー・サカキの手持ちで
// 上書きされて消えないように別に覚えておき、したっぱへ戻したときに復元する
const RKG_KEY = 'gbl_rocket_grunt';
const loadRkGrunt = () => { try { const v = JSON.parse(localStorage.getItem(RKG_KEY)); return Array.isArray(v) ? v : null; } catch (e) { return null; } };
const saveRkGrunt = () => { try { localStorage.setItem(RKG_KEY, JSON.stringify(RKT)); } catch (e) {} };
document.querySelectorAll('#rkkind button').forEach(b => b.onclick = () => {
  const v = b.dataset.v;
  if (RK.kind === 'grunt' && v !== 'grunt') saveRkGrunt();   // したっぱの枠を控えておく
  if (RK.who) RK.whoBy[RK.kind] = RK.who;   // 種別ごとに「最後に選んだ人」を覚えておく
  RK.kind = v;
  RK.who = RK.whoBy[v] || null;
  syncRocket();   // ここで renderRoster が走り、だれと戦うかが未選択なら先頭の人になる
  // リーダー・サカキは手持ちが分かっているので、選んだ時点であいての枠に入れる
  if (v !== 'grunt') { if (rkWhoList().length) rkPutAll(); else run(); return; }
  const g = loadRkGrunt();   // したっぱに戻す: 前に自分で選んでいた枠に戻す
  if (g) { [0, 1, 2].forEach(i => RKT[i] = g[i] || null); saveRkt(); syncRocket(); }
  run();
});
document.querySelectorAll('#rkenter button').forEach(b => b.onclick = () => {
  RK.enter = b.dataset.v;
  syncRocket();
  run();
});
// ランキング枠内・シミュレートの「⚙ 詳細」(開閉の状態は共通)
document.getElementById('rkentdet').onclick = () => { RKR.det = !RKR.det; syncRocket(); };
document.getElementById('rksimdet').onclick = () => { RKR.det = !RKR.det; syncRocket(); };
// 1対1の対策(火力ランキング / 高火力＋安定 / シミュレート)
document.querySelectorAll('#rkviewbtns button').forEach(b => b.onclick = () => {
  RKR.view = b.dataset.v;
  syncRocket(); applyMode(); run();
});
// ランキングの絞り込み(シャドウ・メガはそれぞれ独立ON/OFF)
document.querySelectorAll('#rkfilt button').forEach(b => b.onclick = () => {
  RKR[b.dataset.f] = !RKR[b.dataset.f];
  syncRocket(); run();
});
// 1対1 ⇄ 模擬戦
document.querySelectorAll('#rkmode button').forEach(b => b.onclick = () => {
  setPlay(RK_PLAY[b.dataset.v]);
  RB.ans = {}; RBUI.open = null; RBV.cur = 0; RBV.playing = true; RBV.started = false;   // たたかい方を変えたら模擬戦は最初から
  applyMode();
  run();
});
document.querySelectorAll('#modes button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-pressed', x === b));
  mode = b.dataset.m;
  applyMode();
  run();
});

// ---- 確率で能力が上下するわざの扱い(全モード共通・切り替えたら計算し直す) ----
// 説明は最下部の「使い方」へ。ここは選んでいる状態が一言でわかるだけにする
const PROB_NOTE = {
  none: '運まかせの効果は<b>起きない前提</b>',
  avg:  '確率のぶんを<b>平均</b>して反映',
  always: '運まかせの効果が<b>毎回発動する前提</b>',
};
function syncProbNote() {
  document.getElementById('goptnote').innerHTML = PROB_NOTE[SIMOPT.buffMode];
}
// 「ねっとう(30%で相手の攻撃⬇)」のように確率で能力が上下するわざかどうか
const isProbMove = id => { const m = D.moves[id]; return !!(m && m.bf && m.bc < 1); };
// この切り替えは、そういうわざが実際に使われているときだけ出す(使っていないと選ぶ意味がない)
function setProbTab(on) {
  document.getElementById('gopt').style.display = on ? '' : 'none';
}
// 計算に使う設定から、確率わざが混じっているかを見る
const cfgProbMoves = c => [c.fast, c.throw, ...(c.charged || [])].filter(Boolean);
const anyProbMove = cfgs => cfgs.filter(Boolean).some(c => cfgProbMoves(c).some(isProbMove));
// ---- 環境リストから作るポケモンのブラフ(環境一覧のあいて・カウンター検索の候補・パーティ診断のあいて) ----
// エンジンは cfg.bluff 未指定だとブラフするので、必ずこの値を渡すこと(渡し忘れると1対1と食い違う)
let metaBluff = false;
function syncBluffNote() {
  document.getElementById('gbluffnote').innerHTML = metaBluff
    ? '<b>お互いに</b>軽いSPで<b>駆け引きする前提</b>'
    : '<b>お互いにブラフしない前提</b>';
  document.querySelectorAll('#bluffmeta button').forEach(x =>
    x.setAttribute('aria-pressed', (x.dataset.v === '1') === metaBluff));
}
syncBluffNote();
document.querySelectorAll('#bluffmeta button').forEach(b => b.onclick = () => {
  metaBluff = b.dataset.v === '1';
  syncBluffNote(); updateUrl(); run();
});
syncProbNote();
document.querySelectorAll('#prob button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#prob button').forEach(x => x.setAttribute('aria-pressed', x === b));
  SIMOPT.buffMode = b.dataset.v;
  syncProbNote();
  run();
});

// ---- 環境一覧(1対多): 自分1匹×環境上位50匹をシールド0-0/1-1/2-2で一括対戦 ----
function runMulti() {
  const box = document.getElementById('multi');
  const list = cup ? cup.list : ((window.META_LISTS || {})[String(cap)] || []);
  if (!S[0].key) {
    box.innerHTML = '<div class="mtnote">左の<b>じぶん</b>を選ぶと、環境上位' + (list.length || 50) + '匹と一括対戦します</div>';
    return;
  }
  // わざを選ぶまで結果を出さない(2026-08-27タダシさん指示。1対1と同じルール:
  // じぶんで選んだ構成の結果を見る画面にする。SPアタックを覚えないポケモンはSP無しでOK。
  // これでマスをタップして開く1対1も同じ構成のまま=結果が食い違わない)
  if (!S[0].fast || (!S[0].c1 && movePool(S[0].key).chargeds.length)) {
    const mb = S[0].ivMode === 'manual' && S[0].mIvs
      ? { key: S[0].key, ivs: S[0].mIvs.slice(), level: S[0].mLevel, shadow: S[0].shadow, cap }
      : (r => ({ key: S[0].key, ivs: r.ivs, level: r.level, shadow: S[0].shadow, cap }))(rank1(S[0].key, cap, 0, S[0].maxLv));
    fillMoves(0, mb);
    box.innerHTML = '<div class="mtnote">じぶんの<b>わざ</b>(ノーマルアタック・SPアタック)を選ぶと、環境上位' + (list.length || 50) + '匹と一括対戦します</div>';
    return;
  }
  const token = ++multiToken;   // 設定変更で再実行されたら古い計算は中断
  const MV = VIEWS.multi;
  MV.results = [];
  MV.pick = (k, j) => {
    // マスをタップして開く1対1は、一覧と同じ前提(最適・連戦なし)のまま渡す。
    // ここで退避した設定を復元すると「最短・連戦あり」が蘇って、マスの勝敗と食い違う
    // (食い違い禁止ルールが優先。モードタブで抜けたときだけ復元する)
    MVP.prev = null;
    if (j != null) setBothShields(j);
    applyMeta(list[k]);
  };
  const meBase = S[0].ivMode === 'manual' && S[0].mIvs
    ? { key: S[0].key, ivs: S[0].mIvs.slice(), level: S[0].mLevel, shadow: S[0].shadow, cap, ...carryOf(0) }
    : (r => ({ key: S[0].key, ivs: r.ivs, level: r.level, shadow: S[0].shadow, cap, ...carryOf(0) }))(rank1(S[0].key, cap, 0, S[0].maxLv));
  const myTiming = S[0].timing === 'plan' ? 'optimal' : S[0].timing;
  // SPアタック2を選んでいれば、2本を相手に合わせて使い分ける前提で計算する(わざ開放した実戦に合わせる)
  const myPols = policies(S[0].key, polOpts(0));
  const myCfg = (pol, sh) => listSideCfg(0, meBase, pol, sh, myTiming);
  // 左パネルの表示(CP・個体値・PL・わざ)もこのリーグ/カップの内容に更新する
  const pool0 = movePool(S[0].key);
  fillMoves(0, { ...meBase, fast: S[0].fast || S[0].pin.fast || pool0.fasts[0], throw: S[0].c1 || S[0].pin.c1 || pool0.chargeds[0] });
  const myName = (S[0].shadow ? SHADOWMK : '') + D.pokemon[S[0].key].n;
  box.innerHTML = `<h3>${myName} × 環境上位${list.length}匹${cup ? `（${cupTitle(cup)}）` : ''}<small class="cnsub">マスをタップ→1対1シミュ</small></h3>
    ${ctlHtml('multi')}
    <table class="mttbl"><tbody><tr><th style="text-align:left">相手</th><th>🛡0-0</th><th>🛡1-1</th><th>🛡2-2</th></tr>
    ${list.map((m, k) => `<tr data-k="${k}"><td class="opname">${k + 1}. ${shMark(m.n)}</td><td>…</td><td>…</td><td>…</td></tr>`).join('')}
    </tbody></table><div class="mtprog">計算中 0/${list.length}</div>`;
  const rowsEl = [...box.querySelectorAll('tr[data-k]')];
  rowsEl.forEach(tr => tr.onclick = () => applyMeta(list[+tr.dataset.k]));
  updateUrl();
  const prog = box.querySelector('.mtprog');
  const wins = [0, 0, 0], losses = [0, 0, 0], draws = [0, 0, 0];
  // 採用率加重: 環境1位の相手ほど重み大(1位=N点〜最下位=1点)
  const wScore = [0, 0, 0];
  let wSum = 0;
  let idx = 0;
  const step = () => {
    if (token !== multiToken) return;
    const t0 = performance.now();
    while (idx < list.length && performance.now() - t0 < 40) {
      const m = list[idx];
      const r1 = rank1(m.k, cap);
      const opCfg = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
        bluff: metaBluff, fast: m.f || movePool(m.k).fasts[0], charged: [m.c1, m.c2].filter(Boolean) };
      const cells = [0, 1, 2].map(sh => {
        let best = null;
        for (const pol of myPols) {   // 自分のわざはこの対面・このシールド数での最善を採用
          const res = PvpEngine.simulate(D, myCfg(pol, sh), { ...opCfg, shields: sh }, SIMOPT);
          const sc = scoreOf(res, 0);
          if (!best || sc > best.sc) best = { sc, res };
        }
        const r = best.res, w = r.winner;
        return { w, sc: best.sc, pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100) };
      });
      const tds = rowsEl[idx].querySelectorAll('td');
      const wgt = list.length - idx;   // 採用率順の重み
      wSum += wgt;
      cells.forEach((c, j) => {
        if (c.w === 0) { wins[j]++; wScore[j] += wgt; }
        else if (c.w === 'draw') { draws[j]++; wScore[j] += wgt * 0.5; }
        else losses[j]++;
        tds[j + 1].className = c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l';
        tds[j + 1].innerHTML = cellHtml(c);
      });
      // 絞り込み・並び替え用に対面の結果を保存(scは0〜1000の対面スコア=与ダメ+残HP)
      MV.results.push({ idx, m, name: `${idx + 1}. ${shMark(m.n)}`, cells,
        sc: (cells[0].sc + cells[1].sc + cells[2].sc) / 3,
        nWin: cells.filter(c => c.w === 0).length,
        nLose: cells.filter(c => c.w === 1).length });
      idx++;
    }
    if (idx < list.length) {
      prog.textContent = `計算中 ${idx}/${list.length}`;
      setTimeout(step, 0);
    } else {
      const wl = j => `${wins[j]}勝${losses[j]}敗${draws[j] ? draws[j] + '分' : ''}`;
      const score = envScore((wScore[0] + wScore[1] + wScore[2]) / (wSum * 3));
      prog.innerHTML = `🛡0-0 ${wl(0)} / 🛡1-1 ${wl(1)} / 🛡2-2 ${wl(2)}<br>` +
        `<span class="mtscore" title="環境上位${list.length}匹×シールド0/1/2の勝敗を採用率で加重した点数。勝てない相手が減るほど加速的に上がります（全部に勝っても100にはなりません）">環境スコア ${score.toFixed(1)}<small> /100</small></span>` +
        `<span class="mtscorenote">※スコアはあくまで参考程度に</span>` +
        '';
      bindCtl(box, 'multi');   // 計算が終わったら絞り込み・並び替えを有効化
      applyView(box, 'multi');
    }
  };
  step();
}

// ---- 一括対戦の表: 絞り込み・並び替え(環境一覧とカウンター検索で共用) ----
const VIEWS = {
  multi: {
    results: [], filter: 'all', sort: 'meta', head: '相手',
    filters: [
      { v: 'all',  t: 'すべて',   d: '全ての相手を表示' },
      { v: 'lose', t: '負けあり', d: 'シールド3通りのうち1つでも負け・引き分けがある相手だけ表示' },
      { v: 'bad',  t: '全敗',     d: '3通りとも負けた相手だけ表示（パーティの穴になりやすい相手）' },
    ],
    sorts: [
      { v: 'meta',  t: '環境順',   d: '環境での使用率が高い順（初期表示）' },
      { v: 'bad',   t: '苦手順',   d: '不利な対面が上。大差で負けた相手から並ぶ' },
      { v: 'close', t: '惜しい順', d: 'あと少しで勝てた負け対面が上。個体値やわざの見直しで逆転できる可能性がある相手' },
    ],
  },
  counter: {
    results: [], filter: 'all', sort: 'good', head: '勝てる候補',
    filters: [
      { v: 'all',  t: 'すべて', d: '環境上位の全候補を表示' },
      { v: 'win',  t: '勝ちあり', d: 'シールド3通りのうち1つでも勝てる候補だけ表示' },
      { v: 'best', t: '全勝',   d: '3通りとも勝てる候補だけ表示（安定して有利）' },
    ],
    sorts: [
      { v: 'good', t: '強い順', d: '相手を圧倒できる候補が上（初期表示）' },
      { v: 'meta', t: '環境順', d: '環境での使用率が高い順' },
      { v: 'close', t: '惜しい順', d: 'あと少しで勝てる候補が上。個体値やわざを詰めれば届く可能性がある' },
    ],
  },
  party: {
    results: [], filter: 'all', sort: 'meta', head: '相手', tail: '勝てる数',
    filters: [
      { v: 'all',  t: 'すべて', d: '環境上位の全ての相手を表示' },
      { v: 'hole', t: '穴のみ', d: '3匹とも勝てない相手だけ表示（パーティの穴）' },
      { v: 'thin', t: '1匹以下', d: '勝てるのが1匹だけ（1匹頼み）、または0匹（穴）の相手を表示' },
    ],
    sorts: [
      { v: 'meta',  t: '環境順', d: '環境での使用率が高い順（初期表示）' },
      { v: 'risk',  t: '危険順', d: '勝てる数が少ない相手が上' },
      { v: 'close', t: '惜しい順', d: 'あと少しで勝てた対面が上' },
    ],
    tailHtml: r => `<td class="pcnt c${r.nWin}">${r.nWin}<small>/${r.cells.length}</small></td>`,
  },
};
// 環境スコア: 採用率で加重した勝率 p(0〜1) を 0〜99.9 の点数に直す。
// 「環境からランダムに2回対面したとき、少なくとも1回は勝てる確率」＝ 1-(1-p)^2 の形。
// 勝てない相手が減るほど加速的に伸びるので、上位の実力差が点数に出やすい。
// 99.9倍で頭打ちにしてあるので、全対面に勝っても100点にはならない。
const envScore = p => 99.9 * (1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 2));
const cellHtml = c => (c.w === 'draw' ? '分' : c.w === 0 ? '勝ち' : '負け') +
  `<small>${c.w === 'draw' ? '　' : '残' + c.pct + '%'}</small>`;
// カウンター検索だけの「探す範囲」。環境スコアの基準を動かさないよう、
// 環境一覧・パーティ診断は上位50固定のままにして、逆引きで候補を広げたいときだけ100位まで見る
let cnTop = 50;
const CN_RANGES = [
  { v: '50',  t: '上位50',  d: '環境上位50匹から探す（初期表示）' },
  { v: '100', t: '上位100', d: '51〜100位まで広げて探す。使用率は低いが刺さるポケモン（伝説など）を拾える' },
  { v: 'all', t: '全ポケモン', d: '環境の順位に関係なく全ポケモン（シャドウ込み）から探す。わざはそのあいてにいちばん効く組み合わせを自動で選びます' },
];
function ctlHtml(vn) {
  const V = VIEWS[vn];
  const grp = (cls, items, cur) => `<div class="opts ${cls}">` + items.map(o =>
    `<button data-v="${o.v}" aria-pressed="${o.v === cur}" title="${o.d}" disabled>${o.t}</button>`).join('') + '</div>';
  return `<div class="mtctl" data-v="${vn}">
    <div class="mtctlrow"><span class="lbl">表示</span>${grp('mtfilter', V.filters, V.filter)}</div>
    <div class="mtctlrow"><span class="lbl">並び</span>${grp('mtsort', V.sorts, V.sort)}</div>
    ${vn === 'counter' ? `<div class="mtctlrow"><span class="lbl">範囲</span>${grp('mtrange', CN_RANGES, String(cnTop))}</div>` : ''}
    <div class="enote expl">${vn === 'multi'
      ? '相手は環境上位50匹（理想個体値・実戦の定番わざ構成）。🛡の列は「おたがい同じ枚数」で戦った結果です。環境スコア＝環境からランダムに2回対面したとき、少なくとも1回は勝てる確率'
      : vn === 'counter'
      ? 'マスの「残◯%」＝勝った側に残るHPの割合。あいてのわざは「候補にいちばんキツい構成」で判定するので、実戦では表より有利になることが多いです'
      : '相手は環境上位50匹（理想個体値・実戦の定番わざ構成）。穴＝3匹とも勝てない相手。🛡は「おたがい同じ枚数」で戦った結果です'}</div>
  </div>`;
}
function bindCtl(box, vn) {
  const V = VIEWS[vn];
  box.querySelectorAll('.mtctl button').forEach(b => { b.disabled = false; });
  const bind = (cls, key) => box.querySelectorAll('.' + cls + ' button').forEach(b => b.onclick = () => {
    box.querySelectorAll('.' + cls + ' button').forEach(x => x.setAttribute('aria-pressed', x === b));
    V[key] = b.dataset.v;
    applyView(box, vn);
  });
  bind('mtfilter', 'filter');
  bind('mtsort', 'sort');
  // 範囲を変えると候補そのものが変わるので、表を作り直すのではなく計算からやり直す
  if (vn === 'counter') box.querySelectorAll('.mtrange button').forEach(b => b.onclick = () => {
    if (b.dataset.v === String(cnTop)) return;
    cnTop = b.dataset.v === 'all' ? 'all' : +b.dataset.v;
    runCounter();
  });
}
// 保存済みの結果から、いまの絞り込み・並び替えで表を作り直す
function applyView(box, vn) {
  const V = VIEWS[vn];
  const tb = box.querySelector('.mttbl tbody');
  if (!tb || !V.results.length) return;
  let rows = V.results.slice();
  if (V.filter === 'lose') rows = rows.filter(r => r.nWin < 3);
  else if (V.filter === 'bad') rows = rows.filter(r => r.nLose === 3);
  else if (V.filter === 'win') rows = rows.filter(r => r.nWin > 0);
  else if (V.filter === 'best') rows = rows.filter(r => r.nWin === 3);
  else if (V.filter === 'hole') rows = rows.filter(r => r.nWin === 0);
  else if (V.filter === 'thin') rows = rows.filter(r => r.nWin <= 1);
  // 図から選んだ絞り込み(safe=2匹以上が勝てる / nX=勝てる数がちょうどX /
  // onlyX=X番目のポケモンだけが勝てる相手)
  else if (V.filter === 'safe') rows = rows.filter(r => r.nWin >= Math.min(2, r.cells.length));
  else if (/^n\d$/.test(V.filter)) rows = rows.filter(r => r.nWin === +V.filter.slice(1));
  else if (/^only\d$/.test(V.filter)) {
    const j = +V.filter.slice(4);
    rows = rows.filter(r => r.nWin === 1 && r.cells[j] && r.cells[j].w === 0);
  }
  if (V.sort === 'bad') rows.sort((a, b) => a.sc - b.sc);
  else if (V.sort === 'good') rows.sort((a, b) => b.sc - a.sc);
  else if (V.sort === 'risk') rows.sort((a, b) => a.nWin - b.nWin || a.sc - b.sc);   // 勝てる数が少ない順
  else if (V.sort === 'close') {
    // 惜しい順: 負けを含む対面をスコアの高い順(勝ちに近い順)に並べ、全勝は最後
    const lost = rows.filter(r => r.nWin < 3).sort((a, b) => b.sc - a.sc);
    rows = lost.concat(rows.filter(r => r.nWin === 3).sort((a, b) => b.sc - a.sc));
  }
  // 「全ポケモン」は1500匹を超えるので、並び順の上位だけ描く(全部DOMに置くと重い)。
  // 何件を出していて全部で何件あるかは下の件数表示に必ず出す
  const MAXROW = 200;
  const total = rows.length, cut = total > MAXROW;
  if (cut) rows = rows.slice(0, MAXROW);
  const cols = V.cols || ['🛡0-0', '🛡1-1', '🛡2-2'];
  const head = `<tr><th style="text-align:left">${V.head}</th>` + cols.map(c => `<th>${c}</th>`).join('') +
    (V.tail ? `<th>${V.tail}</th>` : '') + '</tr>';
  tb.innerHTML = head + (rows.length ? rows.map(r =>
    `<tr data-k="${r.idx}"><td class="opname">${r.name}</td>` +
    r.cells.map((c, j) => `<td data-j="${j}" class="${c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l'}">${cellHtml(c)}</td>`).join('') +
    (V.tailHtml ? V.tailHtml(r) : '') + '</tr>').join('')
    : `<tr><td class="mtempty" colspan="${cols.length + 1}">該当するポケモンはいません（この絞り込みでは0件）</td></tr>`);
  // セルをタップしたときは、その列(シールド枚数/パーティのメンバー)も一緒に渡す
  tb.querySelectorAll('tr[data-k] td').forEach(td => td.onclick = () =>
    V.pick(+td.parentNode.dataset.k, td.dataset.j === undefined ? null : +td.dataset.j));
  // いまの絞り込みを、表示タブと図(グリッドの凡例・3匹の働き)の両方に反映する
  box.querySelectorAll('.mtfilter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === V.filter));
  box.querySelectorAll('[data-flt]').forEach(el => el.setAttribute('aria-pressed', el.dataset.flt === V.filter));
  const cnt = box.querySelector('.mtcnt');
  if (cnt) cnt.remove();
  if (V.filter !== 'all' || cut)
    box.querySelector('.mtctl').insertAdjacentHTML('beforeend', '<div class="mtcnt">' +
      (cut ? `${total}件のうち<b>上位${MAXROW}件</b>を表示中（全${V.results.length}匹中）。絞り込みや並びで見たいところを出してください`
           : `${rows.length}件を表示中（全${V.results.length}匹中）`) + '</div>');
}

// 両者のシールド枚数をまとめて変更(一覧のマスをタップしたときに同じ条件へ揃える)
function setBothShields(v) {
  [0, 1].forEach(i => {
    S[i].shieldMode = null; S[i].shields = v;
    sideEl[i].querySelectorAll('.shields button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.v === v));
    sideEl[i].querySelector('.custShield').style.display = 'none';
  });
}

// 一覧の行タップ→そのポケモンを指定した側にセットして1対1シミュへ(i=0:じぶん / 1:あいて)
function applyMeta(m, i) {
  i = i === 0 ? 0 : 1;   // 省略時は「あいて」側
  S[i].key = m.k; S[i].shadow = !!m.s;
  S[i].maxLv = 51; syncSmax(i);
  sideEl[i].querySelector('.shadowtab').setAttribute('aria-pressed', S[i].shadow);
  // 環境リストのわざ構成(SP2本)とブラフの前提をそのまま引き継ぐ→一覧の結果と1対1シミュの結果が一致する。
  // ブラフは一覧では両者に同じ前提を使っているので、左右そろえて渡す
  S[i].fast = m.f || null; S[i].c1 = m.c1 || null; S[i].c2 = m.c2 || null;
  [0, 1].forEach(k => {
    S[k].bluff = metaBluff;
    sideEl[k].querySelectorAll('.bluff button').forEach(x =>
      x.setAttribute('aria-pressed', (x.dataset.v === '1') === metaBluff));
  });
  resetPin(i);   // 前のポケモンで確定したわざを持ち越さない
  resetSpPlan(i);
  S[i].ivMode = 'auto'; S[i].mIvs = null; S[i].mLevel = null;
  sideEl[i].querySelector('input').value = m.n;
  sideEl[i].querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'auto'));
  sideEl[i].querySelector('.custIv').style.display = 'none';
  document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === 'duel'));
  mode = 'duel'; applyMode();
  run();
  document.querySelector('.duel').scrollIntoView({ behavior: 'smooth' });
}

// 「全ポケモン」の候補を、環境リストと同じ形({k,n,s,f,c1})で作る。
// わざは総当たりすると重すぎる(1500匹×構成40通り)ので、
// そのあいてに対する実ダメージから「1ターンあたりが最大のノーマル」「ゲージ効率が最大のSP」を計算式で選ぶ。
// 選んだわざはそのまま行に持たせるので、マスをタップして開く1対1シミュとも食い違わない
function cnAllList(foeBase) {
  const foeSt = { ...PvpEngine.buildStats(D, foeBase), buffs: [0, 0] };
  const megaOk = !!(cup && cup.slug.startsWith('mega'));   // メガはメガカップ以外では使えない
  const out = [];
  for (const key of KEYS) {
    if (isMega(key) && !megaOk) continue;
    const p = D.pokemon[key];
    const r = rank1(key, cap);
    const { fasts, chargeds } = movePool(key);
    if (!fasts.length) continue;
    for (const sh of (p.shadow ? [false, true] : [false])) {
      const me = { ...PvpEngine.buildStats(D, { key, ivs: r.ivs, level: r.level, shadow: sh, cap }), buffs: [0, 0] };
      let f = null, fv = -1, c = null, cv = -1;
      for (const id of fasts) {
        const mv = D.moves[id], v = PvpEngine.damage(D, mv, me, foeSt) / (mv.tn || 1);
        if (v > fv) { fv = v; f = id; }
      }
      for (const id of chargeds) {
        const mv = D.moves[id], v = PvpEngine.damage(D, mv, me, foeSt) / mv.e;
        if (v > cv) { cv = v; c = id; }
      }
      out.push({ k: key, n: (sh ? 'シャドウ' : '') + p.n, s: sh ? 1 : 0, f, c1: c || undefined });
    }
  }
  return out;
}

// ---- 対策さがし(逆引き): 選んだ「あいて」に勝てるポケモンを探す ----
function runCounter() {
  const box = document.getElementById('counter');
  // 基準の上位50に、「上位100」を選んでいるときだけ51〜100位(META_EXT / cup.ext)を足す。
  // 環境一覧・パーティ診断・環境スコアは上位50のままなので、そちらの数値は影響を受けない
  const cnBase = cup ? cup.list : ((window.META_LISTS || {})[String(cap)] || []);
  const cnExt = cup ? (cup.ext || []) : ((window.META_EXT || {})[String(cap)] || []);
  if (!S[1].key) {
    box.innerHTML = '<div class="mtnote">右の<b>あいて</b>を選ぶと、勝てる候補を探します</div>';
    return;
  }
  const token = ++multiToken;
  const CV = VIEWS.counter;
  CV.results = [];
  // 倒したい相手(あいて)の設定。わざは対面ごとに相手側が最善を選ぶ前提で評価する
  const foeBase = S[1].ivMode === 'manual' && S[1].mIvs
    ? { key: S[1].key, ivs: S[1].mIvs.slice(), level: S[1].mLevel, shadow: S[1].shadow, cap, ...carryOf(1) }
    : (r => ({ key: S[1].key, ivs: r.ivs, level: r.level, shadow: S[1].shadow, cap, ...carryOf(1) }))(rank1(S[1].key, cap, 0, S[1].maxLv));
  // 「全ポケモン」は環境リストの代わりに、全ポケモン(シャドウ込み)から同じ形の候補を作る
  const list = cnTop === 'all' ? cnAllList(foeBase) : cnTop === 100 ? cnBase.concat(cnExt) : cnBase;
  CV.pick = (k, j) => {
    // マスをタップして開く1対1は、一覧と同じ前提(最適・連戦なし)のまま渡す(環境一覧と同じ理由)
    CN.prev = null;
    // マスをタップしたら、そのマスで使った「あいてのいちばんキツいわざ」も引き継ぐ。
    // これが無いと1対1は「わざを選ぶと結果が出ます」で止まり、表の勝敗を確かめられない
    if (j != null) {
      setBothShields(j);
      const row = CV.results.find(r => r.idx === k);
      const mv = row && row.cells[j] && row.cells[j].mv;
      if (mv) {
        S[1].fast = mv.fast || null; S[1].c1 = mv.c1 || null; S[1].c2 = mv.c2 || null;
        resetPin(1); resetSpPlan(1);
      }
    }
    applyMeta(list[k], 0);
  };
  const foeTiming = S[1].timing === 'plan' ? 'optimal' : S[1].timing;
  // SPアタック2を選んでいれば、あいても2本を使い分ける前提で評価する
  const foePols = policies(S[1].key, polOpts(1));
  const foeCfg = (pol, sh) => listSideCfg(1, foeBase, pol, sh, foeTiming);
  const pool1 = movePool(S[1].key);
  fillMoves(1, { ...foeBase, fast: S[1].fast || S[1].pin.fast || pool1.fasts[0], throw: S[1].c1 || S[1].pin.c1 || pool1.chargeds[0] });
  const foeName = (S[1].shadow ? SHADOWMK : '') + D.pokemon[S[1].key].n;
  // 候補が多い「全ポケモン」では、計算しながら1行ずつ描くと重いので表は最後にまとめて作る
  const all = cnTop === 'all';
  const sub = all ? `全ポケモン${list.length}匹（シャドウ込み）` : `環境上位${list.length}匹${cup ? `（${cupTitle(cup)}）` : ''}`;
  box.innerHTML = `<h3>${foeName} に勝てるのは？<small class="cnsub">${sub}・マスをタップ→1対1シミュ</small></h3>
    ${ctlHtml('counter')}
    <table class="mttbl"><tbody><tr><th style="text-align:left">勝てる候補</th><th>🛡0-0</th><th>🛡1-1</th><th>🛡2-2</th></tr>
    ${all ? '' : list.map((m, k) => `<tr data-k="${k}"><td class="opname">${k + 1}. ${m.n}</td><td>…</td><td>…</td><td>…</td></tr>`).join('')}
    </tbody></table><div class="mtprog">計算中 0/${list.length}</div>`;
  const rowsEl = [...box.querySelectorAll('tr[data-k]')];
  rowsEl.forEach(tr => tr.onclick = () => applyMeta(list[+tr.dataset.k], 0));
  updateUrl();
  const prog = box.querySelector('.mtprog');
  const beats = [0, 0, 0];
  let idx = 0;
  const step = () => {
    if (token !== multiToken) return;
    const t0 = performance.now();
    while (idx < list.length && performance.now() - t0 < 40) {
      const m = list[idx];
      const r1 = rank1(m.k, cap);
      const cdCfg = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
        bluff: metaBluff, fast: m.f || movePool(m.k).fasts[0], charged: [m.c1, m.c2].filter(Boolean) };
      const cells = [0, 1, 2].map(sh => {
        let worst = null;   // あいてが最も得をするわざ構成を選ぶ＝候補にとって最も厳しい結果
        for (const pol of foePols) {
          const res = PvpEngine.simulate(D, { ...cdCfg, shields: sh }, foeCfg(pol, sh), SIMOPT);
          const sc = scoreOf(res, 1);
          if (!worst || sc > worst.sc) worst = { sc, res, pol };
        }
        const r = worst.res, w = r.winner, p = worst.pol;
        return { w, sc: scoreOf(r, 0), pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100),
          // タップしたときに1対1へ渡す「あいての構成」
          mv: { fast: p.fast, c1: p.throw || (p.charged && p.charged[0]), c2: (p.charged && p.charged[1]) || null } };
      });
      const tds = rowsEl[idx] ? rowsEl[idx].querySelectorAll('td') : null;
      cells.forEach((c, j) => {
        if (c.w === 0) beats[j]++;
        if (!tds) return;
        tds[j + 1].className = c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l';
        tds[j + 1].innerHTML = cellHtml(c);
      });
      // 全ポケモンのときは並び順の番号に意味が無いので付けず、代わりに使ったわざを添える
      CV.results.push({ idx, m, cells,
        name: all
          ? `${shMark(m.n)}<small class="cnmv">${D.moves[m.f] ? D.moves[m.f].n : ''}${m.c1 && D.moves[m.c1] ? ' / ' + D.moves[m.c1].n : ''}</small>`
          : `${idx + 1}. ${shMark(m.n)}`,
        sc: (cells[0].sc + cells[1].sc + cells[2].sc) / 3,
        nWin: cells.filter(c => c.w === 0).length,
        nLose: cells.filter(c => c.w === 1).length });
      idx++;
    }
    if (idx < list.length) {
      prog.textContent = `計算中 ${idx}/${list.length}`;
      setTimeout(step, 0);
    } else {
      prog.innerHTML = `勝てる候補 🛡0-0 <b>${beats[0]}匹</b> / 🛡1-1 <b>${beats[1]}匹</b> / 🛡2-2 <b>${beats[2]}匹</b>`;
      bindCtl(box, 'counter');
      applyView(box, 'counter');
    }
  };
  step();
}

// ---- パーティ診断の図(環境を1匹1マスで並べたグリッド・3匹の働き) ----
const ptWinColor = p => p >= 0.5 ? 'var(--win)' : p >= 0.25 ? 'var(--gold)' : 'var(--lose)';
// 色は3段階だけにする(2026-08-13変更)。旧版は 楽勝/有利/綱渡り/穴 の4段階だったが、
// 「楽勝」と「有利」は緑どうしで見分けが付かないうえ、どちらも次の手が変わらない。
// 手を打つかどうかで分かれるのは「勝てる／1匹しか勝てない／勝てない」の3つ
const ptTier = (k, n) => k === 0 ? 'hole' : k < Math.min(2, n) ? 'n1' : 'safe';
const ptTierColor = t => t === 'hole' ? 'var(--lose)' : t === 'n1' ? 'var(--gold)' : 'var(--win)';
const PT_TIERS = ['safe', 'n1', 'hole'];
// 1匹だけのパーティでは「2匹勝ち」が成り立たないので、そのときだけ「勝てる」に戻す
const ptTierLabel = (t, n) => t === 'hole' ? '穴' : t === 'n1' ? '1匹頼み'
  : n > 1 ? '2匹勝ち' : '勝てる';
const ptTierDesc = (t, n) => t === 'hole' ? (n > 1 ? `${n}匹とも勝てない` : '勝てない')
  : t === 'n1' ? '1匹しか勝てない'
  : n <= 1 ? '勝てる' : n === 2 ? '2匹とも勝てる' : '2匹以上が勝てる';
// 環境の1匹を1マスで表す。
// 旧版は50マスを10列で折り返して並べていたが、「左上ほどよく当たる」という
// 読み方の説明が無いと図の意味がまったく通じなかった(タダシさん指摘・2026-08-13)。
// そこで **順位のグループごとに1本の帯** にした。左から右へ読むだけなので折り返しの説明が要らず、
// よく当たるグループほどマスを大きくしてあるので、重みも形で分かる
function ptGridHtml(res, n) {
  const N = res.length;
  const cell = (r, g) => `<i class="ptgc ${g}" style="background:${ptTierColor(ptTier(r.nWin, n))}"` +
    ` title="${r.idx + 1}位 ${r.m.n}／${ptTierLabel(ptTier(r.nWin, n), n)}` +
    `（${ptTierDesc(ptTier(r.nWin, n), n)}）"></i>`;
  // マスの大きさは g1 > g2 > g3。よく当たるグループほど大きいので、重みが形でも分かる
  const rows = [[0, 10, 'g1'], [10, 25, 'g2'], [25, N, 'g3']]
    .map(([a, b, g]) => [Math.min(a, N), Math.min(b, N), g])
    .filter(([a, b]) => b > a)
    .map(([a, b, g]) => `<div class="ptgrow">` +
      `<span class="ptglb" title="採用率が${a + 1}〜${b}番目のポケモン">${a + 1}-${b}位</span>` +
      `<span class="ptgline">${res.slice(a, b).map(r => cell(r, g)).join('')}</span></div>`).join('');
  const legend = PT_TIERS.map(t => {
    const cnt = res.filter(r => ptTier(r.nWin, n) === t).length;
    if (!cnt && t !== 'hole') return '';   // 穴だけは0でも出す(「穴なし」が分かるように)
    const lbl = ptTierLabel(t, n), desc = ptTierDesc(t, n);
    return `<button data-flt="${t}" aria-pressed="false"` +
      ` title="${desc}相手が${cnt}匹（タップで表を絞り込み）">` +
      `<i style="background:${ptTierColor(t)}"></i><span class="ptglbl">${lbl}</span>` +
      // 1匹だけのパーティは「勝てる／勝てる」と同じ言葉が並ぶので、そのときは添え書きを出さない
      `<b>${cnt}</b>${desc === lbl ? '' : `<small>${desc}</small>`}</button>`;
  }).join('');
  // 並び順は「左から採用率の高い順」。これを書かないと、マスが何の順に並んでいるのか分からない
  // (タダシさん指摘・2026-08-13。「よく当たる順」だけでは左右の並びの話だと伝わらなかった)
  // 見出しは「相性」ではなく「穴チェック」(2026-08-13タダシさん選択)。
  // この図の目的は"穴がないかの点検"なので、ページのタイトル・凡例の「穴」と語彙をそろえる
  return `<div class="ptcard" data-sec="hole" aria-expanded="${!!PTSEC.hole}">` +
    ptSecHead('hole', '🎯', '穴チェック') + `<div class="ptcbody">` +
    `<div class="ptgsub">環境<b>${N}匹</b>を<b>左から採用率の高い順</b>に（1マス＝1匹）</div>` +
    `<div class="ptchart"><div class="ptgwrap">${rows}</div>` +
    `<div class="ptglegend">${legend}</div></div></div></div>`;
}
// ---- 役割の判定(🛡が残る序盤 / 🛡が切れた終盤 の2つの場面) ----
// シールドはSPアタックしか防げないので、この2つの場面で得意なポケモンがはっきり分かれる。
// 環境100匹での実測: 高威力のSPを持つほど終盤型(相関-0.68)、安いSPを撃てるほど序盤型(-0.49)、
// ノーマルアタックが強いほど序盤型(+0.46。シールドがあっても素通りするため)
//
// 指標は **勝ち数そのもの**(2026-08-13にタダシさん指示で変更)。
// 以前は「環境50匹の中でのパーセンタイル(平均収支の順位)」だったが、
// **説明しないと分からない＝理解する努力が要る時点でダメ**という判断。
// 勝ち数なら「50匹中◯勝」とそのまま読めて、真ん中の線がそのまま「半分」になる
const PTR = { sig: '', ops: null };
const ptrSig = () => `${cap}|${cup ? cup.slug : ''}|${metaBluff}|${SIMOPT.buffMode}`;
// その場面での相手側の設定(環境リストの標準構成。表のマスと同じ前提でそろえる)
const ptRoleOps = (list, sh) => list.map(m => {
  const r1 = rank1(m.k, cap);
  return { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
    bluff: metaBluff, shields: sh, fast: m.f || movePool(m.k).fasts[0],
    charged: [m.c1, m.c2].filter(Boolean) };
});
// 🛡2-2(序盤)と🛡0-0(終盤)の相手セット。リーグごとに1回だけ作って使い回す
function ptRoleSets(list) {
  const sig = ptrSig();
  if (PTR.sig !== sig || !PTR.ops) { PTR.sig = sig; PTR.ops = [ptRoleOps(list, 2), ptRoleOps(list, 0)]; }
  return PTR.ops;
}
// その場面での勝ち数(50匹中)。3匹ぶんでも300戦＝数ミリ秒なので、区切らずその場で計算できる
const ptRoleWins = (me, ops, sh) =>
  ops.reduce((a, op) => a + (PvpEngine.simulate(D, { ...me, shields: sh }, op, SIMOPT).winner === 0 ? 1 : 0), 0);
// 役割の名前。色は状態の3色(赤・黄・緑)とぶつからないよう、水色と紫を使う
const PT_ROLES = {
  // 万能は水色と紫の中間の青。緑にすると相性の図の「2匹勝ち」と紛れる
  all:   { t: '万能',   c: '150,180,255' },
  early: { t: '序盤型', c: '67,224,255' },
  late:  { t: '終盤型', c: '176,108,255' },
  weak:  { t: '苦戦',   c: '139,150,194' },
};
// 半分(50匹中25勝)を超えているかで決める。**メーターの真ん中の線がそのまま基準**なので、
// バッジと横棒が必ず一致し、「なぜこの役割なのか」を figure の中で確かめられる
const ptRoleOf = (w2, w0, n) => {
  const half = n / 2;
  return w2 >= half ? (w0 >= half ? 'all' : 'early') : (w0 >= half ? 'late' : 'weak');
};
const ptRoleChip = r => `<span class="ptwrole r-${r}" style="--rc:${PT_ROLES[r].c}">${PT_ROLES[r].t}</span>`;
const ptDistOk = () => !!PTR.ops && PTR.sig === ptrSig();
// 入れ替え候補1匹の役割(相手セットができていないときは null)
function ptCandRole(key, shadow, pol, n) {
  if (!ptDistOk()) return null;
  const me = { ...ptBase({ key, ivMode: 'auto', shadow, maxLv: 51 }), ...pol,
    timing: 'optimal', bluff: metaBluff };
  const w2 = ptRoleWins(me, PTR.ops[0], 2), w0 = ptRoleWins(me, PTR.ops[1], 0);
  return { w2, w0, r: ptRoleOf(w2, w0, n) };
}
// 図で分かることを一言にする(数字を並べるより状況を言い切るほうが頭に入る)
// 環境のどのポケモンに苦しんでいるかを、タイプではなく名前で出す。
// 「じめんが苦手」と分かっても次の手は決まらないが、「この4匹に勝てない」なら
// そのまま入れ替え候補につながる（穴が無いときは、勝てるのが1匹だけ＝1匹頼みの対面を出す）
function ptDiagHtml(res, names, n) {
  const N = res.length;
  const holes = res.filter(r => r.nWin === 0);
  const thin = res.filter(r => r.nWin === 1);
  const pct = v => Math.round(v / N * 100);
  // よく当たる相手かどうかで優先度が変わる。平均順位で見ると
  // 「1位に勝てないのに下位が多いから軽い」と逆の判定になるので、上位10位に何匹いるかで見る
  const topHoles = holes.filter(r => r.idx < 10).length;
  let lead = '', detail = '', next = '', flt = '', list = [], ttl = '', tier = '';
  if (holes.length) {
    list = holes; flt = 'hole'; ttl = '勝てない相手'; tier = 'hole';
    const top = holes.slice(0, 3).map(r => `${shMark(r.m.n)}(${r.idx + 1}位)`).join('・');
    lead = `環境の<b>${holes.length}匹</b>（${pct(holes.length)}%）には、<b>${n}匹とも勝てません</b>。`;
    detail = `とくに <b>${top}</b>${holes.length > 3 ? ' など' : ''}。` +
      (topHoles ? `よく当たる<b>上位10位に${topHoles}匹</b>いるので、優先して埋めたいところです。`
                : '上位の常連は避けられているので、深刻度は高くありません。');
  } else if (thin.length) {
    list = thin; flt = 'n1'; ttl = '1匹頼みの相手'; tier = 'n1';
    // その1匹頼みをだれが支えているか＝失うと崩れる1匹
    const rely = names.map((nm, j) => ({ nm, cnt: thin.filter(r => r.cells[j].w === 0).length }))
      .sort((a, b) => b.cnt - a.cnt)[0];
    lead = `<b>穴はありません</b>。ただし環境の<b>${thin.length}匹</b>（${pct(thin.length)}%）は` +
      `「勝てるのが1匹だけ」の<b>1匹頼み</b>です。`;
    detail = rely && rely.cnt ? `そのうち<b>${rely.cnt}匹</b>は <b>${shMark(rely.nm)}</b> に頼りきりなので、` +
      `この1匹を先に失うと苦しくなります。` : '';
  } else {
    lead = `どの相手にも<b>2匹以上</b>が勝てます。かなり安定した並びです。`;
  }
  // 次の一手。抜いても穴が増えない子(＝他の子で代われる)があれば、そこが替え時
  const dup = names.map((nm, j) => ({ nm,
    only: res.filter(r => r.nWin === 1 && r.cells[j].w === 0).length })).filter(d => !d.only);
  if (n > 1 && dup.length) next = `→ <b>${shMark(dup[0].nm)}</b> は他の${n - 1}匹で代われます。` +
    `下の<b>入れ替え候補</b>で、ここを替えると幅が広がりそうです。`;
  else if (holes.length) next = `→ 下の<b>入れ替え候補</b>で、この穴を埋められるポケモンを探せます。`;
  else next = `→ 下の<b>入れ替え候補</b>で、どの枠を替えるといちばん良くなるか比べられます。`;
  const MAX = 10;
  // 外枠と見出しの色は「穴」を基準にした深刻度で決める(2026-08-13変更)。
  // 旧版は「穴も1匹頼みも無い」を緑にしていたが、環境上位30匹から選んだ20通りのパーティで
  // 1匹頼みは10〜24匹・0匹は1つも無く、**緑が事実上出ない**基準だった(タダシさん指摘)。
  // 判定は診断文の深刻度ルールとそろえる: 赤=よく当たる上位10位に穴 / 黄=穴はあるが下位だけ / 緑=穴なし
  const cls = !holes.length ? ' ok' : topHoles ? ' bad' : ' warn';
  // ⚠リストの枠だけは「そこに並んでいるものの色」で固定する(穴=赤 / 1匹頼み=黄)。
  // 相性の図の凡例と同じ色にして、どの区分の話か迷わないようにする
  return `<div class="ptdiag${cls}" data-sec="diag" aria-expanded="${!!PTSEC.diag}">` +
    ptSecHead('diag', '📋', '診断') + `<div class="ptcbody">` +
    `<p class="ptdtext">${lead}${detail}</p>` +
    (list.length ? `<button class="ptwhead t-${tier}" data-flt="${flt}" aria-pressed="false"` +
      ` title="タップで表をこの相手だけに絞り込みます">⚠ ${ttl} <b>${list.length}匹</b>` +
      `<small>環境での順位つき・タップで絞り込み</small></button>` +
      `<div class="ptwchips t-${tier}">` +
      list.slice(0, MAX).map(r => `<span class="ptwchip"><em>${r.idx + 1}</em>${shMark(r.m.n)}</span>`).join('') +
      (list.length > MAX ? `<span class="ptwmore">ほか${list.length - MAX}匹</span>` : '') + '</div>' : '') +
    `<p class="ptdnext">${next}</p></div></div>`;
}
// 3匹それぞれの働きを「1行1匹」で出す(2026-08-13にタダシさん指示で散布図から作り直し)。
// 旧版は左に4象限の散布図・右に勝ち数のバーを置いていたが、
// ①点が番号だけなので誰か分からず左右を往復させられる ②軸の説明が図の外にある
// ③3匹しかないのに2次元を辿らせる、という3点で「ぱっと見」に届いていなかった。
// 役割を**言葉のバッジ**で出せば軸の説明が要らず、視線も上から下の一方向で済む。
// pos = 場面ごとの勝ち数([{w2,w0,r}])
function ptWorkHtml(res, names, pos) {
  if (!names.length) return '';
  const N = res.length;
  const rows = names.map((nm, j) => {
    // その相手に勝てるのがこの1匹だけ ＝ このポケモンを抜くと、そこがそのまま穴になる
    const only = res.filter(r => r.nWin === 1 && r.cells[j].w === 0).length;
    const p = pos && pos[j];
    // 横棒は勝ち数そのもの(50匹中◯勝)。**真ん中の線がちょうど半分**になるので、
    // 「線より右＝半分以上に勝てる」とだけ読めばよく、役割バッジの根拠もその場で確かめられる。
    // 数字は「25」ではなく「25/50」と書く。序盤と終盤は**同じ50匹と別々に戦った結果**なので
    // 2本の合計は50にならない。数字だけだと「内訳なのに50を超える?」と誤読される(タダシさん指摘・2026-08-13)
    const bar = (lbl, w, cls) => `<span class="ptwb ${cls}"><em>${lbl}</em>` +
      `<i><b style="width:${Math.max(3, Math.round(w / N * 100))}%"></b></i><u>${w}<small>/${N}</small></u></span>`;
    // 行のラベルは「🛡2-2」「🛡0-0」だけにする(2026-08-13タダシさん指示)。
    // 序盤/終盤との対応は、下の役割の基準（🛡2-2だけ＝序盤型…）が示すので重ねて書かない
    return `<button class="ptwk${p ? ' r-' + p.r : ''}" data-flt="only${j}" aria-pressed="false"` +
      (p ? ` style="--rc:${PT_ROLES[p.r].c}"` : '') +
      ` title="${nm}` +
      (p ? `／序盤(おたがい🛡2枚)は${N}匹中${p.w2}勝・終盤(おたがい🛡0枚)は${p.w0}勝` : '') +
      `。抜くと穴が${only}匹ふえます（この${only}匹に勝てるのはこのポケモンだけ）。タップで表を絞り込み">` +
      `<span class="ptwnm"><span class="pcolnum">${j + 1}</span>${shMark(nm)}</span>` +
      (p ? ptRoleChip(p.r) : `<span class="ptwrole wait">…</span>`) +
      `<span class="ptwbars">${p ? bar('🛡2-2', p.w2, 'e') + bar('🛡0-0', p.w0, 'l') : ''}</span>` +
      // 「代役なし6」は何の数か分からなかった(タダシさん指摘・2026-08-13)ので、
      // **抜いたらどうなるか**をそのまま書く。0匹なら入れ替えても穴は増えない
      (only ? `<span class="ptwsub">穴<b>+${only}</b></span>`
            : `<span class="ptwsub dup">増えない</span>`) +
      `</button>`;
  }).join('');
  // 入れ替え候補を「型」で探せるようにする。
  // **足りない型のときだけ出す作りにはしない**(2026-08-13タダシさん指示)。
  // それだと「揃えるべき」という勧めになるが、GBLに正解の型は無い。
  // 終盤型で揃える・序盤型で揃えるのも立派な戦術なので、**両方いつでも選べる**ようにして
  // どちらへ寄せるかは使う人が決める
  // 一言(「序盤に強いのが3匹…」)は廃止(2026-08-13タダシさん判断)。
  // 3行しかないので、すぐ下の役割バッジを数えれば分かる＝言い換えているだけだった
  let find = '';
  if (pos && names.length > 1)
    find = `<div class="ptwfindwrap">` + ['early', 'late'].map(w =>
      `<button class="ptwfind" data-want="${w}"` +
      ` title="${PT_ROLES[w].t}のポケモンを優先して並べた入れ替え候補を出します">` +
      `🔧 ${PT_ROLES[w].t}を探す</button>`).join('') + `</div>`;
  // 列の見出し。**シールドあり/なしという軸が伝わって初めて役割の話が通じる**ので、
  // 小さい注記ではなく、横棒の真上に列見出しとして出す(タダシさん指摘・2026-08-13)
  // 「勝ち数の内訳」は誤り(2026-08-13タダシさん指摘で変更)。"内訳"だと2本の合計が50になると
  // 読めるが、実際は**同じ50匹と場面ごとに別々に戦った結果**。「場面ごとの勝ち数」と書く
  const head = `<div class="ptwk cap"><span></span><span></span>` +
    `<span class="ptwcap">場面ごとの勝ち数<small>それぞれ環境${N}匹と対戦</small></span><span></span></div>` +
    `<div class="ptwk head"><span class="ptwnm">ポケモン</span><span class="ptwrole hd">役割</span>` +
    `<span class="ptwbars"><span class="ptwb e"><em><b>🛡2-2</b></em></span>` +
    `<span class="ptwb l"><em><b>🛡0-0</b></em></span></span>` +
    `<span class="ptwsub">抜くと</span></div>`;
  return `<div class="ptcard" data-sec="work" aria-expanded="${!!PTSEC.work}">` +
    ptSecHead('work', '⚔️', '得意な場面') + `<div class="ptcbody">` +
    `<div class="ptgsub"><b class="e">シールドが残っている序盤</b>と<b class="l">切れた終盤</b>で` +
    // 枚数は列見出しの「🛡2-2 / 🛡0-0」が示すので、ここには**役割の基準**を書く
    // (2026-08-13タダシさん指示。何勝以上でどの型になるかが分かれば、あとは表を読むだけで済む)
    `得意なポケモンが分かれます<small><b>${N / 2}勝以上</b>で得意：` +
    `両方${ptRoleChip('all')}／<b class="e">🛡2-2</b>だけ${ptRoleChip('early')}／` +
    `<b class="l">🛡0-0</b>だけ${ptRoleChip('late')}／どちらも未満${ptRoleChip('weak')}</small></div>` +
    (pos ? head : '') + rows + find + '</div></div>';
}

// ---- パーティ3匹の穴チェック ----
// PT[i] = ★登録リストと同じ形({key, ivMode, mIvs, mLevel, fast, c1, c2, shadow, maxLv})
const PT = [null, null, null];
let ptShield = 2;   // 既定は2枚(実戦で最も多い前提)
const PT_KEY = 'gbl_party';
try { const v = JSON.parse(localStorage.getItem(PT_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) PT[i] = m; }); } catch (e) {}
const savePt = () => { try { localStorage.setItem(PT_KEY, JSON.stringify(PT)); } catch (e) {} };
const ptName = m => m ? (m.shadow ? 'シャドウ' : '') + D.pokemon[m.key].n : '';

// 3枠の入力欄を作る(検索・★登録リストからの呼び出し・シャドウ切替・クリア)
// パーティ診断とロケット団戦の連戦で同じ3枠(PT)を共有するので、置き場所(box)を受け取る
// withMoves=true の枠(模擬戦)にだけ、じぶんのわざを選ぶ欄を出す
// ポケモン名の検索候補。「メガ」のように該当が多い語でも埋もれないよう、
// 前方一致(名前の先頭が一致)を先に並べ、件数の上限も広めに取る(一覧はスクロールできる)。
// 上限100は「メガ」の該当数(2026-08時点で56)が今後増えても当分あふれない余裕を見た値
const SEARCH_MAX = 100;
function searchPk(q, ok) {
  const hit = [], sub = [];
  for (const k of KEYS) {
    if (ok && !ok(k)) continue;
    const n = D.pokemon[k].n;
    const i = n.indexOf(q);
    if (i === 0) hit.push(k);
    else if (i > 0) sub.push(k);
    if (hit.length + sub.length >= SEARCH_MAX) break;
  }
  return hit.concat(sub).slice(0, SEARCH_MAX);
}
// mvStore = わざ欄の置き場所。'rbm'=ロケット団の模擬戦(RBM) / 'gbm'=GBL模擬戦(GBM) /
// 'pt'=パーティ診断(PTに直接持つ) / 無し=わざ欄なし
function buildPartySlots(box, mvStore) {
  if (!box) return;
  const withMoves = !!mvStore, isRk = mvStore === 'rbm', isMock = mvStore === 'gbm';
  box.innerHTML = [0, 1, 2].map(i => `<div class="pslot mine${withMoves ? ' hasmv' : ''}" data-i="${i}" data-mv="${mvStore || ''}">
    <div class="phd"><span class="pnum">${i + 1}匹目</span>${isRk && i === 0
      ? `<button class="plead" aria-pressed="${RK.leadSwap}" title="バトル開始と同時に2匹目か3匹目へ交代します(あいては4.5秒硬直・打ちかけの1発は交代先に入ります)">${SWAPMK}開幕交代</button>` : ''}${isMock && i === 0
      ? `<button class="plead" aria-pressed="${MK.leadSwap}" title="バトル開始と同時に2匹目か3匹目へ交代します(あいての打ちかけの1発は交代先に入ります)。あいても開幕に交代してくることがあり、そのときは1秒後にこちらも交代するか選べます">${SWAPMK}開幕交代</button>` : ''}
      <button class="pshadow" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする"><i class="shadowmark"></i></button>
      <button class="pstar" title="★登録リストから選ぶ（自分の個体値・わざで診断できます）">★</button>
      <button class="pclr" title="この枠を空にする">×</button></div>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="popwin pstarwin" style="display:none"></div>
    <div class="pmeta"></div>
    ${withMoves ? '<div class="pmv"></div>' : ''}
  </div>`).join('');
  box.querySelectorAll('.pslot').forEach(el => {
    const i = +el.dataset.i;
    const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) {
        const v = toKata(inp.value);
        if (v !== inp.value) inp.value = v;
      }
      const q = toKata(inp.value.trim());
      if (!q) { list.style.display = 'none'; return; }
      const hits = searchPk(q);
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        list.style.display = 'none';
        PT[i] = { key: d.dataset.k, ivMode: 'auto', shadow: false, maxLv: 51 };
        savePt(); syncPartySlot(i); run();
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
    // 模擬戦: おすすめタブ(高火力/高火力＋安定)が押されていたら、入力欄タップで対策トップ5を出す
    if (isRk) ['focus', 'click'].forEach(ev => inp.addEventListener(ev, () => {
      if (list.style.display !== 'block') rkShowSugg(i, el);
    }));
    el.querySelector('.pshadow').onclick = () => {
      if (!PT[i]) return;
      PT[i].shadow = !PT[i].shadow;
      savePt(); syncPartySlot(i); run();
    };
    el.querySelector('.pclr').onclick = () => { PT[i] = null; savePt(); syncPartySlot(i); run(); };
    const pl = el.querySelector('.plead');
    if (pl) pl.onclick = () => {
      // 開幕交代の状態はロケット団(RK)とGBL模擬戦(MK)で別に持つ(画面ごとに独立した設定)
      if (isMock) { MK.leadSwap = !MK.leadSwap; pl.setAttribute('aria-pressed', MK.leadSwap); }
      else { RK.leadSwap = !RK.leadSwap; pl.setAttribute('aria-pressed', RK.leadSwap); }
      run();   // バトルの署名が変わるので、スタート待ちから仕切り直しになる
    };
    el.querySelector('.pstar').onclick = () => {
      const win = el.querySelector('.pstarwin');
      const open = win.style.display === 'none';
      const saved = loadMyPk();
      win.innerHTML = saved.length
        ? '<div class="popttl">★登録リストから選ぶ</div>' + saved.map((m, k) => {
            const p = D.pokemon[m.key];
            if (!p) return '';
            const iv = m.ivMode === 'manual' && m.mIvs ? `<i>${m.mIvs.join('/')} PL${m.mLevel}</i>` : '<i>理想個体値</i>';
            return `<div class="mypkrow" data-k="${k}"><span>${m.shadow ? SHADOWMK : ''}${p.n}${iv}</span></div>`;
          }).join('')
        : '<div class="mypkempty">まだ登録がありません。1対1シミュでポケモンを選び「★登録」を押すとここに追加されます</div>';
      win.querySelectorAll('.mypkrow').forEach(row => row.onclick = () => {
        PT[i] = { ...loadMyPk()[+row.dataset.k] };
        win.style.display = 'none';
        savePt(); syncPartySlot(i); run();
      });
      win.style.display = open ? 'block' : 'none';
      el.querySelector('.pstar').setAttribute('aria-pressed', open);
    };
    syncPartySlot(i);
  });
}
// 枠の表示(名前・タイプ・個体値・わざ)を現在の設定に合わせる(同じ枠が複数の画面にあるので全部そろえる)
function syncPartySlot(i) {
  document.querySelectorAll(`.pslot.mine[data-i="${i}"]`).forEach(el => {
    const m = PT[i];
    el.querySelector('.pshadow').setAttribute('aria-pressed', !!(m && m.shadow));
    el.querySelector('input').value = m ? ptName(m) : '';
    const meta = el.querySelector('.pmeta');
    const mvbox = el.querySelector('.pmv');
    if (mvbox) mvbox.innerHTML = '';
    if (!m) { meta.innerHTML = '<span class="pempty">未選択</span>'; return; }
    const p = D.pokemon[m.key];
    const isPt = el.dataset.mv === 'pt';
    const iv = m.ivMode === 'manual' && m.mIvs ? `個体値${m.mIvs.join('/')} PL${m.mLevel}` : '理想個体値';
    const mv = m.fast ? `${D.moves[m.fast].n}${m.c1 ? ' / ' + D.moves[m.c1].n : ''}${m.c2 ? ' / ' + D.moves[m.c2].n : ''}` : 'わざは対面ごとに自動';
    // わざを自分で選べる枠(模擬戦)では、わざは下の欄に出るので文字では書かない。
    // 個体値・PLの文字も出さない(⚙詳細にある。ﾏﾆｭｱﾙ入力中だけ小さく出して分かるようにする)
    meta.innerHTML = mvbox
      ? `${typeIcons(p, 15)}${m.ivMode === 'manual' && m.mIvs ? `<span class="pt2">${iv}</span>` : ''}`
      : `${typeIcons(p, 15)}<span class="pt2">${iv}</span><span class="pt2">${mv}</span>`;
    if (!mvbox) return;
    const isGbm = el.dataset.mv === 'gbm';   // GBL模擬戦のわざ置き場(GBM)
    const cur = isPt ? ptMvOf(i) : isGbm ? gbmOf(i) : rbmOf(i);
    const auto = isPt && ptAuto;   // パーティ診断のオート中はこちらで選ぶので触らせない
    const { fasts, chargeds } = movePool(m.key);
    const opts = (list, sel) => list.map(id =>
      `<option value="${id}"${id === sel ? ' selected' : ''}>${D.moves[id].n}</option>`).join('');
    // ノーマルの「おまかせ」はロケット団の模擬戦だけ(GBL模擬戦は必ず具体的なわざで戦う)
    const rkAuto = !isPt && !isGbm;
    mvbox.innerHTML = `
      <select class="mvF"${auto ? ' disabled' : ''} title="ノーマルアタック${rkAuto ? '（おまかせにすると効率のよい構成を自動で選びます）' : ''}">
        ${rkAuto ? `<option value="auto"${cur.fast === 'auto' ? ' selected' : ''}>おまかせ</option>` : ''}${opts(fasts, cur.fast)}</select>
      ${chargeds.length ? `<select class="mvC1"${auto ? ' disabled' : ''} title="SPアタック1">${opts(chargeds, cur.c1)}</select>
      <div class="c2row"><select class="mvC2"${auto ? ' disabled' : ''} title="SPアタック2（2本目を開放していないなら「ー」）">
        <option value=""${!cur.c2 ? ' selected' : ''}>ー</option>${opts(chargeds, cur.c2)}</select>${
        cur.c2 && !auto ? '<button class="c2clear" title="SPアタック2を外す（1本に戻す）">×</button>' : ''}</div>`
        : '<span class="pt2">SPアタックなし</span>'}`;
    // ×でSPアタック2を外す(1対1シミュと同じ操作を全画面にそろえる・2026-08-13タダシさん指示)
    const c2x = mvbox.querySelector('.c2clear');
    if (c2x) c2x.onclick = () => {
      if (isPt) { PT[i].c2 = ''; savePt(); }
      else if (isGbm) { gbmOf(i).c2 = ''; saveGbm(); }
      else { rbmOf(i).c2 = ''; saveRbm(); }
      syncPartySlot(i); run();
    };
    mvbox.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const c = isPt ? { fast: PT[i].fast, c1: PT[i].c1, c2: PT[i].c2 } : isGbm ? gbmOf(i) : rbmOf(i);
      if (sel.classList.contains('mvF')) c.fast = sel.value;
      else if (sel.classList.contains('mvC1')) c.c1 = sel.value;
      else c.c2 = sel.value;
      if (c.c2 && c.c2 === c.c1) c.c2 = '';   // 同じわざを2本持っても意味がない
      if (isPt) {
        // 選び直したぶんだけ差し替え、空いている欄は今表示している構成で埋める(全部そろって初めて計算できる)
        const now = ptMvOf(i);
        PT[i].fast = c.fast || now.fast; PT[i].c1 = c.c1 || now.c1;
        PT[i].c2 = c.c2 != null ? c.c2 : (now.c2 || '');   // ''=明示的に外した は保つ
        savePt();
      } else if (isGbm) saveGbm(); else saveRbm();
      syncPartySlot(i); run();
    });
  });
}
// ---- パーティ診断のわざ ----
// オート = 環境上位にいちばん多く勝てる構成を1つ選んで固定する（対面ごとに選び直さない）。
// 手動 = 枠のわざ欄で選んだ構成でそのまま計算する。どちらも「画面に出ているわざで戦う」ので結果と食い違わない
// 既定は**マニュアル**(2026-08-13タダシさん指示)。はじめて触る人は自分のわざを入れたいのに、
// オートだと欄が操作できず「入力できない」と見えてしまうため。切り替えた設定は端末に残る
let ptAuto = false;
try { ptAuto = localStorage.getItem('gbl_party_auto') === '1'; } catch (e) {}
const savePtAuto = () => { try { localStorage.setItem('gbl_party_auto', ptAuto ? '1' : '0'); } catch (e) {} };
const PTA = [null, null, null];   // オートで選ばれた構成(計算のたびに更新して枠にも出す)
// その枠でいま使うわざ(オート中はオートの選出、手動なら選んだわざ。未指定は効率のよい既定で埋める)
function ptMvOf(i) {
  const m = PT[i];
  if (!m) return null;
  if (ptAuto && PTA[i] && PTA[i].key === m.key) return PTA[i];
  // マニュアルの空欄の既定は模擬戦と同じ「環境の確定値 → 無ければ効率(SP2本)」(2026-08-27タダシさん指示)。
  // 以前は効率の叩き台(SP1本・rbmDefault)で、環境300匹の82%が確定値とずれ、
  // 実戦とかけ離れた勝率が出ていた(ハラバリーが でんじほう1本 になり平均勝率9%と表示された件)。
  // c2の '' は「×や「ー」で明示的に外した」印なので既定で埋め戻さない(未設定のときだけ既定を使う)
  const d = mockDefaultMoves(m.key, m.shadow);
  return { key: m.key, fast: m.fast || d.fast, c1: m.c1 || d.c1,
    c2: m.c2 != null ? m.c2 : (d.c2 || '') };
}
// policies() の1構成 → 画面のわざ欄の形に直す
const polToMv = (key, pol) => ({ key, fast: pol.fast,
  c1: pol.throw || (pol.charged && pol.charged[0]) || '', c2: (pol.charged && pol.charged[1]) || '' });
// オートで試すわざ構成。SP1本の全通り(policies)に加えて、
// わざ開放でSP2本にした構成も候補に入れる(効率のよいSP上位3本の組み合わせだけ。全部やると重い)
function ptAutoPols(key) {
  const pool = movePool(key);
  const fasts = autoFasts(pool.fasts);
  const dpe = m => dpeOf(key, m);
  // **SPは必ず2本**(2026-08-13タダシさん指示・絶対条件)。わざ開放は実戦の前提なので、
  // 1本の構成は「2本以上おぼえないポケモン」のときしか候補にしない。
  // 以前は1本の構成も候補に混ぜていたため、勝ち数で上回ると1本が選ばれてしまった(カビゴンで発生)
  if (pool.chargeds.length < 2)
    return fasts.map(f => (pool.chargeds.length ? { fast: f, throw: pool.chargeds[0] } : { fast: f }));
  // SP2本の組み合わせは**上位8本の全ペア**から作る(効率上位3本だけだと、
  // 効率の数字に出ない良いわざ＝シャドウフォレトスのがんせきふうじ が組み合わせに入らない)
  const top = pool.chargeds.slice().sort((a, b) => dpe(b) - dpe(a)).slice(0, 8);
  const out = [];
  for (const f of fasts)
    for (let a = 0; a < top.length; a++)
      for (let b = a + 1; b < top.length; b++) out.push({ fast: f, charged: [top[a], top[b]] });
  return out;
}
// 環境リスト(人が確認した実戦の定番構成)に載っているポケモンなら、その構成を返す。
// **オートはまずこれを使う**(2026-08-13タダシさん指摘で追加)。
// シミュの勝ち数だけで選ぶと、確定値とちがう構成が出てしまう
// (実例: ディアルガ(オリジン)が「ときのほうこう」を外す・キュレム(ホワイト)が
//  「コールドフレア」ではなく「げんしのちから」を選ぶ)。
// **人の選択は式で再現できない**(CLAUDE.mdの確定仕様)ので、確定値がある限りそれに従う。
// シャドウ違いしか無いときはその構成を借りる(通常⇄シャドウのコピーは39/39一致の実績)
function ptMetaMoves(key, shadow) {
  const src = cup ? (cup.list || []).concat(cup.ext || [])
    : ((window.META_LISTS || {})[String(cap)] || []).concat((window.META_EXT || {})[String(cap)] || []);
  const m = src.find(x => x.k === key && !!x.s === !!shadow) || src.find(x => x.k === key);
  if (!m || !m.f || !m.c1) return null;
  return { fast: m.f, c1: m.c1, c2: m.c2 || undefined };
}
// 「わざ｜マニュアル／オート」ボタン。両方を出して、オンの側だけ白く点灯させる
// (片方しか出さないと、いまどちらなのか・押すとどうなるのかが読み取れないため)
function syncPtAuto() {
  const b = document.querySelector('#party .ptauto');
  if (b) b.setAttribute('aria-pressed', ptAuto);
}
// パーティのメンバー1匹分の計算用設定(理想個体値/登録した個体値)
// capX=CP上限(ロケット団戦は制限が無いので0を渡す)
function ptBase(m, capX) {
  const cp = capX != null ? capX : cap;
  if (m.ivMode === 'manual' && m.mIvs)
    return { key: m.key, ivs: m.mIvs.slice(), level: m.mLevel, shadow: !!m.shadow, cap: cp };
  const r = rank1(m.key, cp, 0, m.maxLv || 51);
  return { key: m.key, ivs: r.ivs, level: r.level, shadow: !!m.shadow, cap: cp };
}
// シールドの枚数ごとの「穴」(3匹とも勝てない相手)の数。
// わざの構成は選択中の枚数で決まったもの(usedPols)を使い回す＝いま表に出ている3匹の話のまま、
// 枚数だけ変えたらどうなるかを見る。選択中の枚数は表と食い違わないよう PV.results から数える
function ptShieldHoles(list, bases, usedPols, curHoles) {
  const out = { [ptShield]: curHoles };
  [0, 1, 2].filter(sh => sh !== ptShield).forEach(sh => {
    let holes = 0;
    list.forEach(m => {
      const r1 = rank1(m.k, cap);
      const op = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
        bluff: metaBluff, shields: sh, fast: m.f || movePool(m.k).fasts[0],
        charged: [m.c1, m.c2].filter(Boolean) };
      const win = bases.some((b, j) => PvpEngine.simulate(D,
        { ...b, ...usedPols[j], timing: 'optimal', shields: sh, bluff: metaBluff }, op, SIMOPT).winner === 0);
      if (!win) holes++;
    });
    out[sh] = holes;
  });
  return out;
}
// シールドのボタンに、その枚数での穴の数をバッジで出す(nullで消す)
function syncPtShieldBadges(h) {
  document.querySelectorAll('#party .ptsh button').forEach(b => {
    const v = +b.dataset.v, n = h ? h[v] : null;
    let e = b.querySelector('.shhole');
    if (n == null) { if (e) e.remove(); b.removeAttribute('title'); return; }
    if (!e) { e = document.createElement('b'); b.appendChild(e); }
    e.className = 'shhole' + (n ? '' : ' zero');
    e.textContent = n ? '穴' + n : '穴なし';
    b.title = `おたがい${v}枚のとき、3匹とも勝てない相手が${n}匹`;
  });
}
function runParty() {
  const box = document.getElementById('party');
  const body = box.querySelector('.pbody');
  const list = cup ? cup.list : ((window.META_LISTS || {})[String(cap)] || []);
  const idxs = [0, 1, 2].filter(i => PT[i]);
  if (!idxs.length) {
    body.style.minHeight = '';
    body.innerHTML = '<div class="mtnote">上の枠にポケモンを入れると診断します（1〜3匹）</div>';
    return;
  }
  const token = ++multiToken;
  const PV = VIEWS.party;
  // 図から選んだ絞り込みは、パーティが変わると意味が変わるので持ち越さない
  if ((/^n\d$/.test(PV.filter) && (idxs.length < 2 || +PV.filter.slice(1) > idxs.length))
    || (/^only\d$/.test(PV.filter) && +PV.filter.slice(4) >= idxs.length)) PV.filter = 'all';
  PV.results = [];
  PV.cols = idxs.map(i => `<span class="pcolnum">${i + 1}</span>${shMark(ptName(PT[i]))}`);
  PV.pick = (k, j) => {   // セルをタップ→そのメンバーと相手を同じシールド枚数で1対1シミュへ
    // 表で使ったわざ(オートの選出 or 手動で選んだわざ)をそのまま渡す＝一覧と1対1の結果が食い違わない
    if (j != null && PT[idxs[j]]) { applyMyPk(0, { ...PT[idxs[j]], ...ptMvOf(idxs[j]) }, true); setBothShields(ptShield); }
    applyMeta(list[k], 1);
  };
  const bases = idxs.map(i => ptBase(PT[i]));
  // オート: 全構成を試して「環境にいちばん多く勝てる1構成」をあとで選ぶ / 手動: 選んだ構成だけ
  const pols = idxs.map(i => {
    if (!ptAuto) { const v = ptMvOf(i); return policies(PT[i].key, { fast: v.fast, c1: v.c1 || undefined, c2: v.c2 || undefined }); }
    // オートは環境の確定値(人が確認した定番構成)を最優先。載っていないポケモンだけシミュで選ぶ
    const mm = ptMetaMoves(PT[i].key, PT[i].shadow);
    if (mm) {
      if (mm.c2) return policies(PT[i].key, mm);
      // 確定値がSP1本だけなら、ノーマルと1本目は固定して**2本目だけ残りの全SPから選ぶ**
      // (SP2本は絶対条件。どれを足すかがオートの仕事)
      const rest = movePool(PT[i].key).chargeds.filter(c => c !== mm.c1);
      if (rest.length) return rest.map(c2 => ({ fast: mm.fast, charged: [mm.c1, c2] }));
      return policies(PT[i].key, mm);
    }
    return ptAutoPols(PT[i].key);
  });
  const win = pols.map(ps => ps.map(() => 0));    // 構成ごとの勝った数
  const tot = pols.map(ps => ps.map(() => 0));    // 構成ごとの合計スコア(同数のときの決め手)
  const grid = [];                                 // grid[相手][メンバー][構成] = マスの中身
  const names = idxs.map(i => ptName(PT[i]));
  // 診断のまとめ(図)は表の上に置く。計算中は進み具合をここに出す。
  // 中身を「計算中…」の1行に入れ替えるとページが一瞬短くなり、ブラウザがスクロール位置を
  // 保てず一番上まで飛ぶ(シールドのボタンを押すたびに視点がガクッと動く・2026-08-13タダシさん報告)。
  // 計算のあいだは前の高さのまま固定しておき、結果が出そろったら固定を外す
  body.style.minHeight = body.offsetHeight ? body.offsetHeight + 'px' : '';
  body.innerHTML = `<div class="mtprog">計算中 0/${list.length}</div>
    <div class="ptswap" id="ptswap"></div>
    ${ctlHtml('party')}
    <table class="mttbl ptbl"><tbody></tbody></table>`;
  const prog = body.querySelector('.mtprog');
  syncPtShieldBadges(null);   // 計算し直すあいだ、前回のバッジは消しておく
  updateUrl();
  let idx = 0;
  const step = () => {
    if (token !== multiToken) return;
    const t0 = performance.now();
    while (idx < list.length && performance.now() - t0 < 40) {
      const m = list[idx];
      const r1 = rank1(m.k, cap);
      // bluff は必ず渡す(エンジンは未指定だとブラフする)。ここを揃えないと、
      // マスの勝敗とタップして開く1対1シミュの結果が食い違う
      const opCfg = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap, bluff: metaBluff,
        shields: ptShield, fast: m.f || movePool(m.k).fasts[0], charged: [m.c1, m.c2].filter(Boolean) };
      // 構成ごとの結果をすべて控える。どの構成を使うかは全員ぶん出そろってから決める
      grid[idx] = idxs.map((pi, j) => pols[j].map((pol, pk) => {
        // じぶん側もあいてと同じブラフの前提で計算する(マスをタップした1対1にも同じ値を渡す)
        const me = { ...bases[j], ...pol, timing: 'optimal', shields: ptShield, bluff: metaBluff };
        const r = PvpEngine.simulate(D, me, opCfg, SIMOPT);
        const sc = scoreOf(r, 0), w = r.winner;
        if (w === 0) win[j][pk]++;
        tot[j][pk] += sc;
        return { w, sc, pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100) };
      }));
      idx++;
    }
    if (idx < list.length) {
      prog.textContent = `計算中 ${idx}/${list.length}`;
      setTimeout(step, 0);
    } else {
      // 各メンバーの構成を1つに決める。
      // ①勝った数が最多 ②同数なら**SPアタック2本**を優先 ③それも同じなら合計スコアが上。
      // ②は2026-08-13にタダシさん指摘で追加。実戦は**わざ開放して2本持つのが基本**で、
      // 2本あれば相手のシールドに応じて撃ち分けられる。勝ち数が同じなら1本を選ぶ理由がない
      const nSp = pol => (pol.charged ? pol.charged.length : (pol.throw ? 1 : 0));
      const use = idxs.map((pi, j) => {
        let bk = 0;
        pols[j].forEach((pol, pk) => {
          if (win[j][pk] !== win[j][bk]) { if (win[j][pk] > win[j][bk]) bk = pk; return; }
          const n = nSp(pol), bn = nSp(pols[j][bk]);
          if (n !== bn) { if (n > bn) bk = pk; return; }
          if (tot[j][pk] > tot[j][bk]) bk = pk;
        });
        PTA[pi] = polToMv(PT[pi].key, pols[j][bk]);   // 枠のわざ欄にも同じ構成を出す
        return bk;
      });
      idxs.forEach(pi => syncPartySlot(pi));
      PV.results = grid.map((row, k) => {
        const cells = row.map((byPol, j) => byPol[use[j]]);
        return { idx: k, m: list[k], name: `${k + 1}. ${shMark(list[k].n)}`, cells,
          sc: cells.reduce((a, c) => a + c.sc, 0) / cells.length,
          nWin: cells.filter(c => c.w === 0).length,
          nLose: cells.filter(c => c.w === 1).length };
      });
      // 平均勝率は「相手1匹に何匹が勝てるか」を割合にして出す(1.50/3匹 = 50％)
      const avg = Math.round(PV.results.reduce((a, r) => a + r.nWin, 0)
        / (PV.results.length * idxs.length) * 100);
      // 「実戦想定」(採用率で重みを付けた勝率)は廃止(2026-08-13タダシさん指示)。
      // 何のパーセントか説明しないと分からず、上位の相手が重いことは
      // 穴チェックの図がマスの大きさで、診断が「上位10位に何匹」で既に示している
      // シールドの枚数ごとの穴の数。わざの構成は選択中の枚数で決めたものを使い回す
      // (枚数ごとに構成を選び直すと、いま表に出ている構成の話ではなくなるため)
      syncPtShieldBadges(ptShieldHoles(list, bases, idxs.map((pi, j) => pols[j][use[j]]),
        PV.results.filter(r => r.nWin === 0).length));
      // 「3匹の働き」の勝ち数(🛡2-2と🛡0-0)。3匹ぶんで300戦＝数ミリ秒なので、その場で計算できる
      // (以前は環境50匹の分布を作っていて0.2〜0.45秒かかり、あとから差し込む必要があった)
      const rops = ptRoleSets(list);
      PTS.pos = bases.map((b, j) => {
        const me = { ...b, ...pols[j][use[j]], timing: 'optimal', bluff: metaBluff };
        const w2 = ptRoleWins(me, rops[0], 2), w0 = ptRoleWins(me, rops[1], 0);
        return { w2, w0, r: ptRoleOf(w2, w0, PV.results.length) };
      });
      // 穴の数はグリッドの凡例に出るので、文字では繰り返さない(平均勝率と前提だけ添える)
      // 3枚は同じ入れ物に入れる。閉じたパネルは幅を取らずに横へ並び、
      // 開いたものだけ全幅になる(閉じているときはタブが1行に収まってスッキリする)
      prog.innerHTML = `<div class="ptcards">${ptGridHtml(PV.results, idxs.length)}` +
        ptDiagHtml(PV.results, names, idxs.length) +
        ptWorkHtml(PV.results, names, PTS.pos) + `</div>` +
        `<div class="holesub">平均勝率：<b>${avg}％</b>` +
        `（環境上位${list.length}匹・🛡${ptShield}-${ptShield}）</div>` +
        // わざの前提。ふだんは出さず、のちに作る「説明ありモード」で出す(class="expl")
        `<div class="holenote expl">${ptAuto
          ? '※わざは<b>オート選出</b>（枠に表示）／あいては環境の標準構成'
          : '※わざは枠で<b>指定した構成</b>／あいては環境の標準構成'}</div>`;
      // 図をタップしたら表を絞り込む(同じところをもう一度押すと解除)
      const bindFlt = el => el.onclick = () => {
        PV.filter = PV.filter === el.dataset.flt ? 'all' : el.dataset.flt;
        applyView(body, 'party');
      };
      // 「🔧 ◯◯型を探す」= 足りない役割を優先して入れ替え候補を並べ直す
      const bindFind = el => el.onclick = e => {
        e.stopPropagation();                      // 行のタップ(絞り込み)と兼ねない
        PTS.want = el.dataset.want;
        runPtSwap();
        const sw = document.getElementById('ptswap');
        if (sw) sw.scrollIntoView({ block: 'nearest' });
      };
      prog.querySelectorAll('[data-flt]').forEach(bindFlt);
      prog.querySelectorAll('[data-want]').forEach(bindFind);
      bindPtSec(prog);   // 3枚のパネルの開閉
      // 入れ替え候補は、いまの診断結果を土台にして探す(パーティや条件が変わったら作り直す)
      PTS.base = { list, idxs, bases, results: PV.results,
        usedPols: idxs.map((pi, j) => pols[j][use[j]]) };
      // リーグやカップが変わったら、入れ替えの記録は別の話になるので消す
      const psig = `${cap}|${cup ? cup.slug : ''}`;
      if (PTS.sig !== psig) { PTS.sig = psig; PTS.log = []; PTS.start = null; PTS.undo = null; }
      PTS.rows = null; PTS.busy = false;
      renderPtSwap();
      bindCtl(body, 'party');
      applyView(body, 'party');
      body.style.minHeight = '';   // 結果が出そろったので高さの固定を外す
      // 入れ替えた直後は、続けて次の候補を出す(提案が出なくなるまで繰り返すのが実用の使い方)
      if (PTS.chain) { PTS.chain = false; runPtSwap(); }
    }
  };
  step();
}

// ---- 入れ替え候補: 穴を埋められるポケモンを探して「①を△△に替えると穴が8→1」を出す ----
// 手順は3つ。①埋めたい相手(穴。無ければ1匹頼みの対面)を決める
// ②計算式で見込みのある候補まで絞る(環境上位なら全部・全ポケモンは約1600匹あるので絞る)
// ③絞った候補を環境の全員と戦わせて、入れ替えたあとの穴の数と勝率を出す
// 提案は「そこに出ているわざ構成で戦ったら」の数字なので、入れ替えるときはその構成ごと枠に入れる
// (オートのままだと構成を選び直して数字が変わるため、わざはマニュアルへ切り替える)
// log/start = 入れ替えの記録（はじめの状態からどう良くなったか）。chain = 入れ替えた直後に続けて次の候補を出す
// want = 優先したい役割('early'=序盤型 / 'late'=終盤型)。pos = 3匹の役割(「3匹の働き」で計算したもの)
const PTS = { range: 100, rows: null, base: null, busy: false, undo: null, msg: '', scan: null,
  log: [], start: null, chain: false, sig: '', want: '', pos: null };
// いまのパーティの穴の数と平均勝率(診断結果から数えるだけ。候補を計算していなくても出せる)
function ptNowStat() {
  const B = PTS.base, n = B.idxs.length;
  return { holes: B.results.filter(r => r.nWin === 0).length,
    avg: B.results.reduce((a, r) => a + r.nWin, 0) / (B.results.length * n) };
}
const PTS_RANGES = [
  { v: '100', t: '環境上位', d: '環境上位100匹から探す（初期表示）。人が確認した実戦の定番構成で計算します' },
  { v: 'all', t: '全ポケモン', d: '環境の順位に関係なく全ポケモン（シャドウ込み・約1600匹）から探す。環境上位は必ず候補に入れたうえで、残りは穴に強そうな順に絞ってくらべます' },
];
// 1回に進める時間。画面に出ているあいだは40msずつ区切って操作をふさがないようにするが、
// 他のタブを見ているあいだはブラウザがタイマーを1分に1回まで絞るので、区切りを大きくして進める
// (見えていないので固まっても困らない。これが無いと裏に回した瞬間に計算がほぼ止まる)
const ptSwapSlice = () => (document.hidden ? 1500 : 40);
// シミュにかける候補の数。環境上位(約100匹)は全部くらべる。
// 全ポケモン(約1600匹)は全部やると数十秒かかるので、計算式で見込みのある順に絞る
const ptRoughN = () => (PTS.range === 'all' ? 120 : 999);

// 候補の一覧。すでにパーティにいるポケモンは除く
function ptSwapPool() {
  const used = new Set(PTS.base.idxs.map(i => PT[i].key + (PT[i].shadow ? '|s' : '')));
  if (PTS.range !== 'all') {
    const src = cup ? (cup.list || []).concat(cup.ext || [])
      : ((window.META_LISTS || {})[String(cap)] || []).concat((window.META_EXT || {})[String(cap)] || []);
    return src.filter(m => !used.has(m.k + (m.s ? '|s' : '')));
  }
  // 全ポケモンは構成の総当たりが重すぎるので、わざはダメージ効率で選ぶ
  // (ノーマルは1ターンあたり・SPは効率のよい2本。実戦のわざ開放に合わせてSPは2本持たせる)
  // ただし環境上位に載っているポケモンは、人が確認した確定値の構成をそのまま使う
  const meta = new Map();
  (cup ? (cup.list || []).concat(cup.ext || [])
    : ((window.META_LISTS || {})[String(cap)] || []).concat((window.META_EXT || {})[String(cap)] || []))
    .forEach(m => meta.set(m.k + (m.s ? '|s' : ''), m));
  const megaOk = !!(cup && cup.slug.startsWith('mega'));
  const out = [];
  for (const key of KEYS) {
    if (isMega(key) && !megaOk) continue;
    const p = D.pokemon[key];
    const { fasts, chargeds } = movePool(key);
    if (!fasts.length) continue;
    const dpt = m => D.moves[m].p * (p.ty.includes(D.moves[m].t) ? 1.2 : 1) / (D.moves[m].tn || 1);
    const dpe = m => D.moves[m].p / D.moves[m].e;
    const f = fasts.slice().sort((a, b) => dpt(b) - dpt(a))[0];
    const cs = chargeds.slice().sort((a, b) => dpe(b) - dpe(a)).slice(0, 2);
    for (const sh of (p.shadow ? [false, true] : [false])) {
      const mk = key + (sh ? '|s' : '');
      if (used.has(mk)) continue;
      // meta=1 の印を付けた候補は、計算式の絞り込みに関係なく必ずくらべる
      // (「全ポケモン」の提案が「環境上位」より悪くなるのはおかしいため)
      const mm = meta.get(mk);
      out.push(mm ? { ...mm, meta: 1 }
        : { k: key, n: (sh ? 'シャドウ' : '') + p.n, s: sh ? 1 : 0, f,
            c1: cs[0] || undefined, c2: cs[1] || undefined });
    }
  }
  return out;
}
// 1ターンあたりの総ダメージ(ノーマルを打ちながらSPをためて撃つ想定)。
// シミュを回さずに強さを見積もるための式で、候補を絞る前段にだけ使う
function ptCycleDpt(fastId, chargedId, me, foe) {
  const mf = D.moves[fastId];
  if (!mf) return 0;
  const df = PvpEngine.damage(D, mf, me, foe);
  const mc = chargedId ? D.moves[chargedId] : null;
  const add = mc && mc.e ? PvpEngine.damage(D, mc, me, foe) * ((mf.e || 0) / mc.e) : 0;
  return (df + add) / (mf.tn || 1);
}
const ptBestDpt = (fasts, chargeds, me, foe) => {
  let v = 0;
  for (const f of fasts) {
    if (!chargeds.length) { v = Math.max(v, ptCycleDpt(f, null, me, foe)); continue; }
    for (const c of chargeds) v = Math.max(v, ptCycleDpt(f, c, me, foe));
  }
  return v;
};
// いちばん痛いSPアタックのダメージ。シールドで防げるぶんを耐久に足すのに使う
const ptBestSp = (chargeds, me, foe) => {
  let v = 0;
  for (const c of chargeds) v = Math.max(v, PvpEngine.damage(D, D.moves[c], me, foe));
  return v;
};
// 粗選別用のざっくりした個体(理想個体値で、CP上限に収まる最大レベル)。
// 正規の rank1 は1匹あたり4096通りを調べるので、全ポケモン(約1600匹)に掛けると数秒かかる。
// 候補を並べるだけならこの近似で足りる(本計算に回す数十匹は正規の rank1 で計算し直す)
const PTRB = new Map();
function ptRoughBase(key, shadow) {
  const ck = key + '|' + cap;
  let v = PTRB.get(ck);
  if (!v) {
    const p = D.pokemon[key];
    if (!cap) v = { ivs: [15, 15, 15], level: 50 };
    else {
      const LV = levelsUpTo(51);
      let lo = 0, hi = LV.length - 1, li = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (cpOf(p, 15, 15, 15, D.cpm[String(LV[mid])]) <= cap) { li = mid; lo = mid + 1; } else hi = mid - 1;
      }
      v = { ivs: [15, 15, 15], level: LV[li] };
    }
    PTRB.set(ck, v);
  }
  return { key, ivs: v.ivs, level: v.level, shadow, cap };
}
// 見込みのある候補を計算式で選ぶ。全候補をシミュすると1匹あたり50戦で重すぎるため、
// ここで数十匹まで絞ってから本計算に回す。
// 見るのは「埋めたい相手(穴)への強さ」だけではなく「環境全体への強さ」も。
// 穴だけで選ぶと、そこにしか刺さらない尖ったポケモンばかりが上がってきてパーティが弱くなる
function ptSwapRough(pool, targets, wide, keep) {
  const mk = list => list.map(m => {
    const r1 = rank1(m.k, cap);
    const st = { ...PvpEngine.buildStats(D, { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, cap }),
      buffs: [0, 0] };
    const mp = movePool(m.k);
    const cs = [m.c1, m.c2].filter(Boolean);
    return { st, fasts: m.f ? [m.f] : mp.fasts, chargeds: cs.length ? cs : mp.chargeds };
  });
  const tg = mk(targets), wd = mk(wide);
  const scored = pool.map(c => {
    const me = { ...PvpEngine.buildStats(D, ptRoughBase(c.k, !!c.s)), buffs: [0, 0] };
    const mp = movePool(c.k);
    const cs = [c.c1, c.c2].filter(Boolean);
    const fasts = c.f ? [c.f] : mp.fasts, chargeds = cs.length ? cs : mp.chargeds;
    const sum = (arr, w) => {
      let s = 0;
      for (const t of arr) {
        const mine = ptBestDpt(fasts, chargeds, me, t.st);
        const theirs = ptBestDpt(t.fasts, t.chargeds, t.st, me);
        if (!mine || !theirs) continue;
        // シールドで防げるぶんを耐久に足す。ここを見ないと、
        // 防御が低いかわりに火力で押す強豪(シールドがあれば十分戦える)を落としてしまう
        const myHp = me.hp + ptShield * ptBestSp(t.chargeds, t.st, me);
        const foeHp = t.st.hp + ptShield * ptBestSp(chargeds, me, t.st);
        const myTtk = foeHp / mine;   // 相手を倒すまでのターン数
        // 制限時間(480ターン)内に倒しきれない相手は勝ちようがない。
        // こういう候補はシミュも最後まで回って重いので、ここで落としておく
        if (myTtk > 400) { s -= w; continue; }
        // 倒すまでのターン数と、自分が倒されるまでのターン数の比(1匹に偏らないよう上限を付ける)
        s += w * Math.min(2.5, (myHp / theirs) / myTtk);
      }
      return s;
    };
    // 穴を埋められるかを重く見つつ、環境全体への強さも見る(1匹あたりの平均でそろえる)
    const sc = (tg.length ? sum(tg, 2) / tg.length : 0) + (wd.length ? sum(wd, 1) / wd.length : 0);
    return { c, sc };
  });
  // 環境上位(meta=1)は必ず残し、残りは見込みのある順に keep 匹だけ足す
  const must = scored.filter(x => x.c.meta);
  return must.concat(scored.filter(x => !x.c.meta).sort((a, b) => b.sc - a.sc).slice(0, keep));
}
// 候補1匹を環境の全員と戦わせて、勝てたかどうかの配列を返す。
// 埋めたい相手(hot)を先に戦って、1匹も勝てなければ残りは省く(穴を埋められない候補に50戦かけない)
function ptSwapWins(cb, pol, foes, hot) {
  const me = { ...cb, ...pol, timing: 'optimal', shields: ptShield, bluff: metaBluff };
  const sim = k => PvpEngine.simulate(D, me, foes[k], SIMOPT).winner === 0;
  const wins = new Array(foes.length);
  let any = false;
  for (const k of hot) { wins[k] = sim(k); if (wins[k]) any = true; }
  if (!any) return null;
  for (let k = 0; k < foes.length; k++) if (wins[k] === undefined) wins[k] = sim(k);
  return wins;
}
// 候補を j 番目のメンバーと入れ替えたときの穴の数・勝ち数の合計
function ptSwapScore(wins, rest, j, n) {
  let holes = 0, tot = 0;
  for (let k = 0; k < wins.length; k++) {
    const nw = rest[k][j] + (wins[k] ? 1 : 0);
    tot += nw;
    if (!nw) holes++;
  }
  return { holes, avg: tot / (wins.length * n) };
}
function runPtSwap() {
  const B = PTS.base;
  if (!B || PTS.busy) return;
  PTS.busy = true; PTS.rows = null; PTS.msg = ''; PTS.scan = null;
  renderPtSwap();
  const n = B.idxs.length;
  const foes = B.list.map(m => {
    const r1 = rank1(m.k, cap);
    return { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
      bluff: metaBluff, shields: ptShield, fast: m.f || movePool(m.k).fasts[0],
      charged: [m.c1, m.c2].filter(Boolean) };
  });
  // rest[相手][メンバー] = そのメンバーを抜いた残りが勝てる数(いまの診断結果から作る)
  const rest = B.results.map(r => r.cells.map((c, j) => r.nWin - (c.w === 0 ? 1 : 0)));
  const now = ptNowStat();
  const pool = ptSwapPool();
  const token = ++multiToken;
  const found = [];
  let short = [], hot = [], idx = 0;
  // ①埋めたい相手(穴。無ければ1匹頼みの対面)を決めて、そこに強い候補だけを計算式で選ぶ
  const step0 = () => {
    if (token !== multiToken) { PTS.busy = false; return; }
    let tg = B.results.filter(r => r.nWin === 0);
    if (!tg.length) tg = B.results.filter(r => r.nWin <= 1);
    if (!tg.length) tg = B.results.slice(0, 10);
    hot = tg.map(r => r.idx);
    // 環境全体への強さは、採用率の高い上位20匹で見る(全員だと計算式でも重い)
    short = ptSwapRough(pool, tg.map(r => r.m), B.list.slice(0, 20), ptRoughN());
    PTS.scan = { pool: pool.length, short: short.length, target: tg.length };
    setTimeout(step1, 0);
  };
  // ②絞った候補を環境の全員と戦わせて、入れ替えたときの穴の数と勝率を出す
  const step1 = () => {
    if (token !== multiToken) { PTS.busy = false; return; }
    const t0 = performance.now();
    while (idx < short.length && performance.now() - t0 < ptSwapSlice()) {
      const { c } = short[idx++];
      // 本計算はここから。個体値は正規の rank1(CP上限内でいちばん強い個体)で計算し直す
      const cb = ptBase({ key: c.k, ivMode: 'auto', shadow: !!c.s, maxLv: 51 });
      const pol = { fast: c.f || movePool(c.k).fasts[0], charged: [c.c1, c.c2].filter(Boolean) };
      const wins = ptSwapWins(cb, pol, foes, hot);
      if (!wins) continue;   // 埋めたい相手に1匹も勝てない＝入れ替える意味がない
      // 枠ごとに「そのポケモンと入れ替えたらどうなるか」を全部控える(あとで枠ごとにまとめて出す)
      const gains = [];
      for (let j = 0; j < n; j++) {
        const s = ptSwapScore(wins, rest, j, n);
        // いまより悪くなる入れ替えは出さない(穴が増える・勝率が下がる)
        if (s.holes < now.holes || (s.holes === now.holes && s.avg > now.avg)) gains.push({ ...s, j });
      }
      if (gains.length) found.push({ c, pol, gains });
    }
    if (idx < short.length) {
      ptSwapProg(`くらべています ${idx}/${short.length}`);
      setTimeout(step1, 0);
    } else {
      // 並びは「穴がどれだけ減るか」と「勝率がどれだけ上がるか」の合計。
      // 穴だけで並べると、穴を1匹減らすかわりに勝率を大きく落とす候補が上に来てしまう
      // (穴1匹 ≒ 勝率3ポイントとして扱う)
      const base = r => (now.holes - r.holes) * 3 + (r.avg - now.avg) * 100;
      // 役割(序盤型/終盤型)を出す。1匹あたり100戦かかるので、見込みの高い上位だけにする。
      // 「◯◯型を探す」を押しているときは、合う候補に穴1匹ぶん(3点)の下駄をはかせる。
      // 並べ替えではなく下駄にするのは、型が合うだけで中身の悪い候補を上に出さないため
      const ROLE_MAX = 60;
      const roles = new Map();
      const rkey = c => c.k + (c.s ? '|s' : '');
      if (ptDistOk())
        found.map(r => ({ r, g: Math.max(...r.gains.map(base)) })).sort((a, b) => b.g - a.g)
          .slice(0, ROLE_MAX).forEach(({ r }) => {
            const v = ptCandRole(r.c.k, !!r.c.s, r.pol, B.list.length);
            if (v) roles.set(rkey(r.c), v);
          });
      const half = B.list.length / 2;
      const fits = ro => !!ro && (PTS.want === 'early' ? ro.w2 >= half : ro.w0 >= half);
      const gain = r => base(r) + (PTS.want && fits(r.role) ? 3 : 0);
      // 「①マリルリを替えるなら A / B / C」と枠ごとにまとめる。
      // 総合順に混ぜて並べると、どのポケモンを替える話なのか読み取りづらい
      const bySlot = new Map();
      found.forEach(r => r.gains.forEach(g => {
        const a = bySlot.get(g.j) || [];
        a.push({ key: r.c.k, name: r.c.n, shadow: !!r.c.s, holes: g.holes, avg: g.avg,
          mv: polToMv(r.c.k, r.pol), role: roles.get(rkey(r.c)) || null });
        bySlot.set(g.j, a);
      }));
      PTS.rows = [...bySlot.entries()]
        .map(([j, arr]) => ({ j: +j, cands: arr.sort((a, b) => gain(b) - gain(a)).slice(0, 3) }))
        .sort((a, b) => gain(b.cands[0]) - gain(a.cands[0]));
      PTS.now = now;
      PTS.busy = false; PTS.msg = '';
      renderPtSwap();
    }
  };
  ptSwapProg('候補を絞っています…');
  setTimeout(step0, 0);
}
// 計算中の進み具合。枠ごと描き直すと下の表まで並べ直しになって重いので、文字だけ差し替える
function ptSwapProg(msg) {
  PTS.msg = msg;
  const e = document.querySelector('#ptswap .ptswmsg');
  if (e) e.textContent = msg; else renderPtSwap();
}
// 入れ替えの記録。はじめの状態から何匹替えて、穴と勝率がどう変わったかをまとめて出す
// (提案が出なくなるまで繰り返す使い方をするので、どこから来たのかが見えるようにする)
function ptSwapLogHtml() {
  if (!PTS.log.length || !PTS.start) return '';
  const s = ptNowStat();
  const arrow = (a, b, less) => `<b>${a}</b><em>→</em>` +
    `<b class="${(less ? b < a : b > a) ? 'good' : ''}">${b}</b>`;
  return `<div class="ptswlog"><div class="ptttl">入れ替えの記録<small>／${PTS.log.length}匹</small></div>` +
    PTS.log.map(l => `<div class="ptswlogrow"><span class="pcolnum">${l.i + 1}</span>` +
      `<s>${shMark(l.from)}</s><i class="swapmark"></i><b>${shMark(l.to)}</b></div>`).join('') +
    `<div class="ptswlogsum"><small>穴</small>${arrow(PTS.start.holes, s.holes, true)}` +
    `<span class="sep">／</span><small>勝率</small>` +
    `${arrow(Math.round(PTS.start.avg * 100), Math.round(s.avg * 100), false)}<small>％</small></div></div>`;
}
// 入れ替え候補の表示(ボタン→計算中→結果)。パーティが変わるたびに作り直す
function renderPtSwap() {
  const box = document.getElementById('ptswap');
  if (!box || !PTS.base) return;
  const B = PTS.base;
  const names = B.idxs.map(i => ptName(PT[i]));
  const range = `<div class="opts ptswrange">` + PTS_RANGES.map(o =>
    `<button data-v="${o.v}" aria-pressed="${o.v === String(PTS.range)}" title="${o.d}">${o.t}</button>`).join('') + '</div>';
  // 「元に戻す」は、入れ替えたポケモンがまだ枠にいるときだけ出す
  // (そのあと自分で枠を変えたなら、戻す先はもう意味がない)
  const u = PTS.undo;
  const canUndo = u && PT[u.i] && PT[u.i].key === u.key && !!PT[u.i].shadow === !!u.shadow;
  const head = `<div class="ptswbar"><button class="ptswbtn" ${PTS.busy ? 'disabled' : ''}` +
    ` title="いまの穴を埋められるポケモンを探して、どのメンバーと入れ替えると何匹減るかを出します">🔧 入れ替え候補</button>${range}` +
    // どの型を優先して並べているかを出す(タップで解除)。押した覚えのない並び順にならないように
    (PTS.want ? `<button class="ptswwant" style="--rc:${PT_ROLES[PTS.want].c}"` +
      ` title="この型を優先して並べています（タップで解除）">${PT_ROLES[PTS.want].t}を優先 ✕</button>` : '') +
    (canUndo ? `<button class="ptswundo" title="入れ替える前のポケモンに戻します">↩ 元に戻す</button>` : '') + '</div>';
  let body = '';
  if (PTS.busy) body = `<div class="ptswmsg">${PTS.msg || '計算中…'}</div>`;
  else if (PTS.rows && !PTS.rows.length) {
    // 探したけれど、いまより良くなる入れ替えが無かった＝ここが仕上がり
    const s = ptNowStat();
    body = `<div class="ptswdone"><b>${s.holes ? '✅ これ以上よくなる入れ替えはありません' : '✅ 穴なしで仕上がりました'}</b>` +
      `<small>いま 穴${s.holes}・勝率${Math.round(s.avg * 100)}％` +
      `（${PTS.range === 'all' ? '全ポケモン' : '環境上位'}から探した結果）</small></div>`;
  }
  else if (PTS.rows && PTS.rows.length) {
    const now = PTS.now;
    body = '<div class="ptswlist">' + PTS.rows.map((g, gi) => {
      const rows = g.cands.map((r, i) => {
        const mv = [r.mv.fast, r.mv.c1, r.mv.c2].filter(Boolean)
          .map(m => D.moves[m] ? D.moves[m].n : '').filter(Boolean).join(' / ');
        return `<button class="ptswrow" data-g="${gi}" data-i="${i}"` +
          ` title="${names[g.j]}を${r.name}に替えたときの診断結果です（タップで枠に入れます）">` +
          `<span class="ptswnm"><b>${shMark(r.name)}</b><small>${mv}</small></span>` +
          (r.role ? ptRoleChip(r.role.r) : '') +
          `<span class="ptswd"><small>穴</small>${now.holes}<em>→</em>` +
          `<b class="${r.holes < now.holes ? 'good' : ''}">${r.holes}</b></span>` +
          `<span class="ptswd"><small>勝率</small>${Math.round(now.avg * 100)}<em>→</em>` +
          `<b class="${r.avg > now.avg ? 'good' : ''}">${Math.round(r.avg * 100)}</b><small>％</small></span>` +
          `</button>`;
      }).join('');
      return `<div class="ptswgrp"><div class="ptswgh"><span class="pcolnum">${B.idxs[g.j] + 1}</span>` +
        `<b>${shMark(names[g.j])}</b>を替えるなら</div>${rows}</div>`;
    }).join('') +
      `<div class="ptswnote">タップすると、下に出ているわざのまま枠に入ります（わざは<b>マニュアル</b>に切り替わります）` +
      (PTS.scan ? '<br>' + (PTS.scan.short >= PTS.scan.pool
        ? `${PTS.scan.pool}匹すべてとくらべました`
        : `${PTS.scan.pool}匹から、環境上位＋穴に強そうな<b>${PTS.scan.short}匹</b>をくらべました`)
        : '') + '</div></div>';
  }
  box.innerHTML = head + body + ptSwapLogHtml();
  const btn = box.querySelector('.ptswbtn');
  if (btn) btn.onclick = () => runPtSwap();
  box.querySelectorAll('.ptswrange button').forEach(b => b.onclick = () => {
    if (b.dataset.v === String(PTS.range) || PTS.busy) return;
    PTS.range = b.dataset.v === 'all' ? 'all' : +b.dataset.v;
    runPtSwap();
  });
  const wt = box.querySelector('.ptswwant');
  if (wt) wt.onclick = () => { PTS.want = ''; runPtSwap(); };
  const un = box.querySelector('.ptswundo');
  if (un) un.onclick = () => {
    const u = PTS.undo;
    PTS.undo = null;
    PT[u.i] = u.was;
    PTS.log.pop();                               // 記録も1つ戻す
    if (!PTS.log.length) PTS.start = null;
    if (u.auto && !ptAuto) { ptAuto = true; savePtAuto(); syncPtAuto(); }
    savePt();
    [0, 1, 2].forEach(i => syncPartySlot(i));
    run();
  };
  box.querySelectorAll('.ptswrow').forEach(el => el.onclick = () => {
    const g = PTS.rows[+el.dataset.g], r = g.cands[+el.dataset.i], pi = B.idxs[g.j];
    PTS.undo = { i: pi, was: PT[pi] ? { ...PT[pi] } : null, auto: ptAuto, key: r.key, shadow: r.shadow };
    // はじめの状態を控えて、入れ替えを記録に積む。続けて次の候補も出す
    if (!PTS.log.length) PTS.start = ptNowStat();
    PTS.log.push({ i: pi, from: names[g.j], to: r.name });
    PTS.chain = true;
    // 提案は「このわざ構成で戦ったら」の数字なので、オートのままだと構成を選び直して数字が変わる。
    // 残る2匹はいま出ている構成をそのまま欄に書き込んでからマニュアルへ切り替える
    // (こうすると、入れ替えた結果が提案どおりの数字になる＝表示と計算が食い違わない)
    if (ptAuto) {
      // 書き込むのは「診断で実際に使った構成」(usedPols)。ここで ptMvOf を通すと、
      // 前に手で選んで PT に残っていたわざのほうが優先され、オートで出ていた構成とすり替わる
      // (実際にチャーレムがサイコカッター型→カウンター型に変わり、提案の数字と食い違った)
      B.idxs.forEach((slot, j) => {
        if (!PT[slot] || !B.usedPols[j]) return;
        const mv = polToMv(PT[slot].key, B.usedPols[j]);
        PT[slot].fast = mv.fast; PT[slot].c1 = mv.c1; PT[slot].c2 = mv.c2 || '';
      });
      ptAuto = false; savePtAuto(); syncPtAuto();
    }
    PT[pi] = { key: r.key, ivMode: 'auto', shadow: r.shadow, maxLv: 51,
      fast: r.mv.fast, c1: r.mv.c1, c2: r.mv.c2 || '' };
    savePt();
    [0, 1, 2].forEach(i => syncPartySlot(i));
    run();
  });
}

// ---- ロケット団戦: あいての3枠(模擬戦で使う) ----
// RKT[i] = あいての手持ち1匹({key, fast, c1})。ステータスは種別の倍率で決まるので個体値は持たない
const RKT = [null, null, null];
const RKT_KEY = 'gbl_rocket_team';
try { const v = JSON.parse(localStorage.getItem(RKT_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) RKT[i] = m; }); } catch (e) {}
const saveRkt = () => { try { localStorage.setItem(RKT_KEY, JSON.stringify(RKT)); } catch (e) {} };
const rktName = m => m ? 'シャドウ' + D.pokemon[m.key].n : '';
// あいて1匹分の計算用設定(わざが未選択なら、おぼえるわざの先頭を使う)
// 特別なわざ(レガシー技)は打ってこないので候補から外す
function rktCfg(m, opt) {
  const { fasts, chargeds } = rkPool(m.key);
  const fast = m.fast && fasts.includes(m.fast) ? m.fast : fasts[0];
  const sp = m.c1 && chargeds.includes(m.c1) ? m.c1 : chargeds[0];
  // SPアタックを覚えないポケモン(進化前など)はノーマルアタックだけで戦う
  return rkCfg({ key: m.key, ivs: [15, 15, 15], level: 40, cap: 0, fast,
    charged: sp ? [sp] : [], throw: sp }, opt);
}

// あいての3枠(ポケモン検索＋わざ選択)
function buildFoeSlots() {
  const box = document.querySelector('#rkteam .foeslots');
  if (!box) return;
  box.innerHTML = [0, 1, 2].map(i => `<div class="pslot fslot" data-i="${i}">
    <div class="phd"><span class="pnum">${i + 1}匹目</span>
      <span class="fshadow" title="ロケット団のポケモンは必ずシャドウです"><i class="shadowmark"></i></span>
      <button class="pclr" title="この枠を空にする">×</button></div>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="fbody" style="display:none">
      <select class="selFast" title="あいてのノーマルアタック"></select>
      <select class="selC1" title="あいてのSPアタック"></select>
      <div class="fstat"></div>
    </div>
  </div>`).join('');
  box.querySelectorAll('.fslot').forEach(el => {
    const i = +el.dataset.i;
    const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) {
        const v = toKata(inp.value);
        if (v !== inp.value) inp.value = v;
      }
      const q = toKata(inp.value.trim());
      if (!q) { list.style.display = 'none'; return; }
      // ロケット団はメガ・ゲンシを使ってこないので、あいての候補には出さない
      const hits = searchPk(q, k => !isMega(k));
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        list.style.display = 'none';
        RKT[i] = { key: d.dataset.k, fast: null, c1: null };
        saveRkt(); syncFoeSlots(); run();
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
    el.querySelector('.pclr').onclick = () => { RKT[i] = null; saveRkt(); syncFoeSlots(); run(); };
    el.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      if (!RKT[i]) return;
      // 空値=「自動(いちばんキツい)」。全通り試していちばんキツいわざで計算する
      RKT[i][sel.classList.contains('selFast') ? 'fast' : 'c1'] = sel.value || null;
      saveRkt(); syncFoeSlots(); run();
    });
  });
  syncFoeSlots();
}
// あいての枠の表示(わざの選択肢・実数値)を今の設定に合わせる
function syncFoeSlots() {
  document.querySelectorAll('#rkteam .fslot').forEach(el => {
    const m = RKT[+el.dataset.i];
    const fb = el.querySelector('.fbody');
    el.querySelector('input').value = m ? rktName(m) : '';   // 必ずシャドウなので名前もそう出す
    if (!m) { fb.style.display = 'none'; return; }
    fb.style.display = 'block';
    const cfg = rktCfg(m);
    const { fasts, chargeds } = rkPool(m.key);   // 特別なわざ(レガシー技)は打ってこない
    // 既定は「自動(いちばんキツい)」＝全通りのうちこちらにいちばんキツいわざで計算する。
    // 1対1(最悪ケース基準)と結果の基準がそろい、わざを決め打ちしたいときだけ選べばよい
    const auto = '<option value="">自動（いちばんキツい）</option>';
    const opts = (list, sel) => list.map(x => `<option value="${x}"${x === sel ? ' selected' : ''}>${D.moves[x].n}</option>`).join('');
    el.querySelector('.selFast').innerHTML = auto + opts(fasts, m.fast);
    el.querySelector('.selC1').innerHTML = chargeds.length ? auto + opts(chargeds, m.c1) : '';
    const st = PvpEngine.buildStats(D, cfg);
    // 実数値はシャドウ補正をかける前の値(ゲームの表示に合わせる)
    el.querySelector('.fstat').innerHTML =
      `${typeIcons(D.pokemon[m.key], 15)} CP${st.cp}／攻${st.baseAtk.toFixed(1)}・防${st.baseDef.toFixed(1)}・HP${st.hp}`;
  });
}

// ---- ロケット団戦 1対1: おすすめランキング ----
// ロケット団戦の目的は「いかに早く倒すか」なので、あいてを決めたらまず
// 「ノーマルアタックだけで攻撃したときにいちばん火力が出るポケモンとわざ」を並べる。
// 火力＝そのあいてに対するノーマルアタックのDPS(ダメージ÷秒)。
// あいてのわざはランダムなので、倒され判定(⚠)は「いちばんキツいわざで来た場合」で見る。
const RKR = { view: 'power', shadow: true, mega: false, top: 30, cache: null, det: false };   // det=枠内「⚙ 詳細」(敵硬直)の開閉

// ---- 「自分のポケモン」の追加(CPと個体値からPLを逆算して★登録リストに入れる) ----
// 保存先は★登録リストと同じ(gbl_mypoke)なので、追加したものは左右パネルからも呼び出せる
const RKM = { key: null, shadow: false };
// そのCPになりうるPLを探す(個体値が決まればふつう1つに定まる)
function levelsFromCP(key, cp, ivs) {
  const p = D.pokemon[key], hits = [];
  for (let l = 1; l <= 51; l += 0.5) {
    const m = D.cpm[String(l)];
    if (m && cpOf(p, ivs[0], ivs[1], ivs[2], m) === cp) hits.push(l);
  }
  return hits;
}
const rkmIvs = () => [0, 1, 2].map(k => {
  const v = +document.getElementById(['rkmA', 'rkmD', 'rkmH'][k]).value;
  return isNaN(v) ? 15 : Math.max(0, Math.min(15, v));
});
function renderRkMy() {
  const box = document.getElementById('rkmybody');
  const saved = loadMyPk();
  const p = RKM.key && D.pokemon[RKM.key];
  box.innerHTML = `
    <div class="sugg rkmysugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    ${p ? `<div class="rkmysel">
      <button class="rkmyshadow" aria-pressed="${RKM.shadow}" title="シャドウとして計算する"><i class="shadowmark"></i></button>
      <b>${RKM.shadow ? SHADOWMK : ''}${p.n}</b>${typeIcons(p, 15)}</div>
    <div class="rkmyrow">
      <label for="rkmCP">CP</label><input type="number" id="rkmCP" min="10" inputmode="numeric" placeholder="例 2387">
      <label for="rkmA">攻</label><input type="number" id="rkmA" min="0" max="15" value="15" inputmode="numeric">
      <label for="rkmD">防</label><input type="number" id="rkmD" min="0" max="15" value="15" inputmode="numeric">
      <label for="rkmH">HP</label><input type="number" id="rkmH" min="0" max="15" value="15" inputmode="numeric">
    </div>
    <div class="rkmylv" id="rkmlv"></div>
    <button class="rkmyadd" id="rkmadd" disabled>ランキングに追加</button>` : ''}
    ${saved.length ? `<div class="rkmylist">${saved.map((m, k) => {
      const q = D.pokemon[m.key];
      if (!q) return '';
      const iv = m.ivMode === 'manual' && m.mIvs ? `${m.mIvs.join('/')} PL${m.mLevel}` : '理想個体値';
      return `<div class="rkmyrowsaved"><span>★${m.shadow ? SHADOWMK : ''}${q.n}<i>${iv}</i></span>
        <b class="rkmydel" data-del="${k}" title="消す">×</b></div>`;
    }).join('')}</div>` : ''}`;
  // ポケモンの検索
  const inp = box.querySelector('.rkmysugg input'), list = box.querySelector('.rkmysugg .sugg-list');
  inp.addEventListener('compositionend', () => { inp.value = toKata(inp.value); inp.dispatchEvent(new Event('input')); });
  inp.addEventListener('input', e => {
    if (!e.isComposing) inp.value = toKata(inp.value);
    const q = toKata(inp.value.trim());
    if (!q) { list.style.display = 'none'; return; }
    const hits = searchPk(q);
    if (!hits.length) { list.style.display = 'none'; return; }
    list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
    list.style.display = 'block';
    list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
      RKM.key = d.dataset.k; RKM.shadow = false; renderRkMy();
    });
  });
  if (!p) return;
  box.querySelector('.rkmyshadow').onclick = () => { RKM.shadow = !RKM.shadow; renderRkMy(); };
  // CP・個体値を入れるたびにPLを逆算して出す(合わなければ追加させない)
  const lv = box.querySelector('#rkmlv'), add = box.querySelector('#rkmadd');
  const recalc = () => {
    const cp = +document.getElementById('rkmCP').value;
    if (!cp) { lv.textContent = ''; add.disabled = true; return; }
    const hits = levelsFromCP(RKM.key, cp, rkmIvs());
    if (!hits.length) {
      lv.innerHTML = '<span class="ng">CPと個体値の組み合わせが合いません</span>';
      add.disabled = true; return;
    }
    lv.innerHTML = `PL <b>${hits[hits.length - 1]}</b>` +
      (hits.length > 1 ? `<span class="rkrdim">（候補 ${hits.join(' / ')}・いちばん高いPLで計算します）</span>` : '');
    add.disabled = false;
  };
  ['rkmCP', 'rkmA', 'rkmD', 'rkmH'].forEach(id => document.getElementById(id).oninput = recalc);
  add.onclick = () => {
    const cp = +document.getElementById('rkmCP').value;
    const ivs = rkmIvs(), hits = levelsFromCP(RKM.key, cp, ivs);
    if (!hits.length) return;
    saveMyPkList([...loadMyPk(), { key: RKM.key, shadow: RKM.shadow, ivMode: 'manual', mIvs: ivs, mLevel: hits[hits.length - 1] }]);
    RKM.key = null; RKM.shadow = false;
    renderRkMy(); renderMyPk(); run();
  };
  box.querySelectorAll('.rkmydel').forEach(b => b.onclick = () => {
    const l = loadMyPk(); l.splice(+b.dataset.del, 1); saveMyPkList(l);
    renderRkMy(); renderMyPk(); run();
  });
}
document.getElementById('rkmytab').onclick = () => {
  const body = document.getElementById('rkmybody'), open = body.style.display === 'none';
  if (open) renderRkMy();
  body.style.display = open ? 'block' : 'none';
  document.getElementById('rkmytab').setAttribute('aria-expanded', open);
};

// ランキングの候補を作る。全ポケモン(理想個体値・PL上限)＋★登録リスト(自分の個体)
function rkCandidates() {
  const out = [];
  for (const key of KEYS) {
    const mega = isMega(key);
    if (mega && !RKR.mega) continue;
    out.push({ key, shadow: false, ivs: [15, 15, 15], level: 50 });
    // シャドウは攻撃1.2倍で火力が出るぶん、ロケット団戦の主力になりやすい
    if (RKR.shadow && D.pokemon[key].shadow && !mega) out.push({ key, shadow: true, ivs: [15, 15, 15], level: 50 });
  }
  // ★登録リスト(自分の強化段階・個体値)も混ぜる。行には★を付けて見分けられるようにする
  loadMyPk().forEach(m => {
    if (!D.pokemon[m.key]) return;
    const b = ptBase(m, 0);
    out.push({ key: m.key, shadow: !!m.shadow, ivs: b.ivs, level: b.level, mine: true, fixFast: m.fast || null });
  });
  return out;
}
// あいて1匹に対するランキングを作る(1対1画面用。わざは全通りで最悪ケースを見る)
function rkRanking() { return rkRankFor({ key: S[1].key }, false); }
// foe = {key, fast, c1}。respectPicked=true なら指定済みのわざだけに絞る(模擬戦の枠を尊重)
function rkRankFor(foe, respectPicked) {
  const foeBase = rkCfg({ key: foe.key, ivs: [15, 15, 15], level: 40, cap: 0,
    fast: rkPool(foe.key).fasts[0], charged: [], throw: null });
  const foeSt = PvpEngine.buildStats(D, foeBase);
  const combos = rkSuggCombos(respectPicked ? foe : { key: foe.key });
  const rows = [];
  for (const c of rkCandidates()) {
    const me = { key: c.key, ivs: c.ivs, level: c.level, shadow: c.shadow, cap: 0 };
    const st = PvpEngine.buildStats(D, me);
    const fasts = c.fixFast && D.moves[c.fixFast] ? [c.fixFast] : movePool(c.key).fasts;
    let best = null;
    for (const id of fasts) {
      const mv = D.moves[id];
      const dmg = PvpEngine.damage(D, mv, { ...st, buffs: [0, 0] }, { ...foeSt, buffs: [0, 0] });
      const dps = dmg / (mv.tn * 0.5);
      if (!best || dps > best.dps) best = { id, mv, dmg, dps };
    }
    if (!best) continue;
    rows.push({ ...c, me, st, fast: best.id, dmg: best.dmg, dps: best.dps });
  }
  rows.sort((a, b) => b.dps - a.dps || a.key.localeCompare(b.key));
  // 上位だけ実際にシミュレートして「先に倒されないか」を見る(全部やると重いので絞る)。
  // ただし★登録リストの自分の個体は、順位が下でも必ず調べる(必ず一覧に出すため)
  const CHECK = 160;
  rows.filter((r, i) => i < CHECK || r.mine).forEach(r => {
    // SPアタックは撃たない(ノーマルアタックだけで攻撃する前提)。
    // こちらがSPを撃たないぶん、シールド2枚はまるごとあいてのSPを防ぐのに使える
    const L = { ...r.me, fast: r.fast, charged: [], shields: 2, timing: 'shots', shotPlan: [], shotRest: null };
    // 勝ち負けを分けるのは主に「あいてのノーマルアタックがどれか」なので、そこでまとめる
    const byFast = new Map();
    for (const c of combos) {
      const res = PvpEngine.simulate(D, L,
        { ...foeBase, fast: c.fast, charged: c.throw ? [c.throw] : [], throw: c.throw }, SIMOPT);
      const cur = byFast.get(c.fast);
      if (!cur || rkWorstScore(res) < rkWorstScore(cur)) byFast.set(c.fast, res);
    }
    const list = [...byFast.entries()].map(([f, res]) => ({ f, res, win: res.winner === 0 }));
    r.nFast = list.length;
    r.nWin = list.filter(x => x.win).length;
    r.win = r.nWin === list.length;
    r.loseTo = list.filter(x => !x.win).map(x => D.moves[x.f].n);
    // 秒数は「勝てる中でいちばん遅いケース」＝安全側で出す
    const wins = list.filter(x => x.win);
    const show = (wins.length ? wins : list).reduce((a, b) => rkWorstScore(a.res) < rkWorstScore(b.res) ? a : b);
    r.turns = rkClock(show.res);   // 表示する秒数はSPの待ち時間込みの実時間
    r.myPct = Math.round(show.res.final[0].hp / show.res.final[0].hpMax * 100);
    r.foePct = Math.round(show.res.final[1].hp / show.res.final[1].hpMax * 100);
    r.anyWin = wins.length > 0;
    r.checked = true;
  });
  return rows;
}

// ---- 模擬戦: おすすめ提案(「どのポケモンを使えばいいか」が思いつかない人向け) ----
// じぶんの枠の上の「高火力 / 高火力＋安定」タブを押した状態で枠の入力欄をタップすると、
// 同じ順番のあいて(1匹目↔1匹目…)への対策トップ5を出す。基準は1対1のランキングと同じ
const RKS = { mode: null, cache: new Map() };
// あいての枠のわざ指定を尊重した全通り(未指定=自動はおぼえるわざ全部)
function rkSuggCombos(f) {
  const pool = rkPool(f.key);
  const fl = f.fast && pool.fasts.includes(f.fast) ? [f.fast] : pool.fasts;
  const sl = f.c1 && pool.chargeds.includes(f.c1) ? [f.c1]
    : (pool.chargeds.length ? pool.chargeds : [null]);
  const out = [];
  for (const fa of fl) for (const sp of sl) out.push({ fast: fa, throw: sp });
  return out;
}
// あいて1匹へのランキング(キャッシュ付き。★登録や絞り込みが変わったら作り直す)
function rkSlotRank(foe) {
  const sig = JSON.stringify([foe.key, foe.fast, foe.c1, RK.kind, RKR.shadow, RKR.mega, loadMyPk()]);
  if (!RKS.cache.has(sig)) {
    if (RKS.cache.size > 8) RKS.cache.clear();
    RKS.cache.set(sig, rkRankFor(foe, true));
  }
  return RKS.cache.get(sig);
}
// 枠 i の入力欄の下に、あいて i への対策トップ5を出す
function rkShowSugg(i, el) {
  if (RKS.mode === null) return false;
  const list = el.querySelector('.sugg-list');
  const foe = RKT[i];
  if (!foe) {
    list.innerHTML = `<div class="rksgnote">あいての${i + 1}匹目を入れると、対策トップ5が出ます</div>`;
    list.style.display = 'block';
    return true;
  }
  const rows = rkSlotRank(foe);
  const safe = RKS.mode === 'safe';
  const cand = (safe ? rows.filter(r => r.checked && r.win) : rows).slice(0, 5);
  const hd = `<div class="rksgnote">${shMark(rktName(foe))} への対策トップ5${safe ? '（先に倒されない）' : ''}</div>`;
  if (!cand.length) {
    list.innerHTML = hd + '<div class="rksgnote">先に倒されない候補が見つかりません（「高火力」を見てください）</div>';
    list.style.display = 'block';
    return true;
  }
  list.innerHTML = hd + cand.map((r, k) => {
    const p = D.pokemon[r.key];
    const warn = r.checked && !r.win;
    return `<div class="rksgrow" data-k="${k}" title="${warn ? 'あいてのわざ次第で先に倒されます' : ''}">
      <b class="rksgno">${k + 1}</b>
      <span class="rksgnm">${r.mine ? '<span class="rkrmine">★</span>' : ''}${r.shadow ? '<i class="shadowmark"></i>' : ''}${p.n}</span>${typeIcons(p, 15)}
      <span class="rksgmv">${mvChip(D.moves[r.fast].n, 12)}</span>
      <span class="rksgdps">${warn ? '⚠' : ''}<small>DPS</small>${r.dps.toFixed(1)}</span>
    </div>`;
  }).join('');
  list.style.display = 'block';
  list.querySelectorAll('.rksgrow').forEach(row => row.onclick = () => {
    const r = cand[+row.dataset.k];
    list.style.display = 'none';
    // ★の個体は登録リストの内容(個体値・PL)ごと、それ以外は理想個体値で枠に入れる
    const saved = r.mine ? loadMyPk().find(m => m.key === r.key && !!m.shadow === r.shadow) : null;
    PT[i] = saved ? { ...saved } : { key: r.key, ivMode: 'auto', shadow: r.shadow, maxLv: 51 };
    // 評価に使ったノーマルアタックをそのまま模擬戦のわざにする(表示と結果を食い違わせない)
    RBM[i] = { ...rbmDefault(r.key), fast: r.fast };
    saveRbm(); savePt(); syncPartySlot(i); run();
  });
  return true;
}

// ---- 模擬戦: 「⚙ 詳細」パネル ----
// 使う頻度の低い設定(確率わざ・じぶんの個体値とPL・あいてのわざランダム)をここへ集めて、
// トップの画面をすっきりさせる。確率わざの設定(#gopt)は模擬戦のあいだこのパネルへ移動する
const RKD = { open: false };
function renderRkDetail() {
  const box = document.getElementById('rkdetail');
  const tab = document.getElementById('rkdetailtab');
  if (!box || !tab) return;
  tab.setAttribute('aria-expanded', RKD.open);
  box.style.display = RKD.open ? 'block' : 'none';
  if (!RKD.open) return;
  const body = box.querySelector('.rkdbody');
  // じぶんの個体値・PL(既定は理想個体値=PL50・100%。枠にポケモンが居るときだけ出す)
  const ivRow = i => {
    const m = PT[i];
    const man = m.ivMode === 'manual' && m.mIvs;
    const iv = man ? m.mIvs : [15, 15, 15];
    const lv = man ? m.mLevel : 50;
    return `<div class="rkdrow rkdiv" data-i="${i}"><span class="lbl">${i + 1}匹目</span>
      <button class="rkdideal" aria-pressed="${!man}" title="PL50・個体値100%に戻す">理想個体値</button>
      <label>攻<input type="number" class="dA" min="0" max="15" value="${iv[0]}" inputmode="numeric"></label>
      <label>防<input type="number" class="dD" min="0" max="15" value="${iv[1]}" inputmode="numeric"></label>
      <label>HP<input type="number" class="dH" min="0" max="15" value="${iv[2]}" inputmode="numeric"></label>
      <label>PL<input type="number" class="dL" min="1" max="51" step="0.5" value="${lv}" inputmode="decimal"></label>
    </div>`;
  };
  const myRows = [0, 1, 2].filter(i => PT[i]).map(ivRow).join('');
  const anyFoe = [0, 1, 2].some(i => RKT[i]);
  body.innerHTML =
    (myRows ? `<div class="rkdttl">じぶんの個体値・PL</div>${myRows}` : '') +
    (anyFoe ? `<div class="rkdttl">あいてのわざを🎲でランダムに引き直す</div>
      <div class="rkdrow">${[0, 1, 2].map(i =>
        `<button class="rkdrand" data-i="${i}" ${RKT[i] ? '' : 'disabled'}>🎲 ${i + 1}匹目</button>`).join('')}</div>` : '');
  // 個体値・PLの入力: 変えたらﾏﾆｭｱﾙ扱い。「理想個体値」で既定に戻す
  body.querySelectorAll('.rkdiv').forEach(row => {
    const i = +row.dataset.i;
    const commit = () => {
      const n = (sel, lo, hi, st) => {
        const el2 = row.querySelector(sel);
        let v = +el2.value || 0;
        if (st) v = Math.round(v * 2) / 2; else v = Math.round(v);
        v = Math.min(hi, Math.max(lo, v));
        el2.value = v;
        return v;
      };
      PT[i].ivMode = 'manual';
      PT[i].mIvs = [n('.dA', 0, 15), n('.dD', 0, 15), n('.dH', 0, 15)];
      PT[i].mLevel = n('.dL', 1, 51, true);
      savePt(); syncPartySlot(i); renderRkDetail(); run();
    };
    row.querySelectorAll('input').forEach(inp => inp.onchange = commit);
    row.querySelector('.rkdideal').onclick = () => {
      PT[i].ivMode = 'auto'; PT[i].mIvs = null; PT[i].mLevel = null;
      savePt(); syncPartySlot(i); renderRkDetail(); run();
    };
  });
  // あいてのわざランダム(おぼえるわざから引き直す。ロケット団はランダムに打ってくる)
  body.querySelectorAll('.rkdrand').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (!RKT[i]) return;
    const { fasts, chargeds } = rkPool(RKT[i].key);
    const pickRnd = list => list.length ? list[Math.floor(Math.random() * list.length)] : null;
    RKT[i].fast = pickRnd(fasts);
    RKT[i].c1 = pickRnd(chargeds);
    saveRkt(); syncFoeSlots(); run();
  });
}

function runRkRank() {
  const box = document.getElementById('rkrank');
  const body = box.querySelector('.rkrbody');
  // 何のランキングかが一目で分かるように見出しを出す
  document.getElementById('rkranktitle').innerHTML = 'ノーマルアタック火力ランキング' +
    (RKR.view === 'safe' ? '<small>先に倒されないものだけ</small>' : '');
  updateUrl();
  if (!S[1].key) { body.innerHTML = '<div class="mtnote">あいてのポケモンを選ぶとランキングが出ます</div>'; return; }
  body.innerHTML = '<div class="mtprog">計算中…</div>';
  setTimeout(() => {
    const all = RKR.cache = rkRanking();
    // 全体での順位を持たせてから絞る(自分の個体が圏外でも、本当の順位のまま出せるように)
    const ranked = (RKR.view === 'safe' ? all.filter(r => r.checked && r.win) : all)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const list = ranked.slice(0, RKR.top)
      .concat(ranked.slice(RKR.top).filter(r => r.mine));   // ★自分の個体は圏外でも必ず出す
    if (!list.length) {
      body.innerHTML = '<div class="mtnote">' + (RKR.view === 'safe'
        ? '<b>先に倒されずに勝てる</b>候補がありません（SPアタックを使うなら「シミュレート」か模擬戦へ）'
        : '候補がありません') + '</div>';
      return;
    }
    body.innerHTML = list.map((r, i) => rkRankCard(r, i)).join('');
    body.querySelectorAll('.rkrcard').forEach(el => el.onclick = () => {
      const r = list[+el.dataset.i];
      applyMyPk(0, { key: r.key, fast: r.fast, shadow: r.shadow,
        ivMode: r.mine ? 'manual' : 'auto', mIvs: r.mine ? r.ivs : null, mLevel: r.mine ? r.level : null }, true);
      RKR.view = 'sim'; syncRocket(); applyMode(); run();
    });
  }, 20);
}
function rkRankCard(r, i) {
  const n = r.rank || i + 1;   // 全体での順位(圏外の自分の個体もこの順位で出す)
  const p = D.pokemon[r.key];
  const mv = D.moves[r.fast];
  const nm = (r.shadow ? 'シャドウ' : '') + p.n;
  const warn = r.checked && !r.win;
  // ⚠は「あいてのどのわざで負けるか」の左に付ける。
  // わざ名の前に付けると、こちらのわざが悪いように読めてしまう(ローブシンのはっけい等)
  const num = !r.checked ? '<span class="rkrdim">—</span>'
    : r.anyWin ? `<b${warn ? ' class="warn"' : ''}>${(r.turns / 2).toFixed(1)}</b>秒`
    : '<span class="rkrdim">—</span>';   // 全部負けるなら秒数に意味がない
  const sub = !r.checked ? ''
    : r.win ? `残HP${r.myPct}%`
    : r.anyWin ? `<span class="ng">⚠️${r.loseTo.join('・')}だと負け</span>`
    : `<span class="ng">⚠️どのわざでも負け</span>`;
  return `<div class="rkrcard${warn ? ' warn' : ''}" data-i="${i}">
    <div class="rkrank ${n === 1 ? 'r1' : n === 2 ? 'r2' : n === 3 ? 'r3' : ''}">${n}</div>
    <div class="rkrmain">
      <div class="rkrname">${r.mine ? '<span class="rkrmine" title="★登録リストの個体">★</span>' : ''}
        ${r.shadow ? '<i class="shadowmark"></i>' : ''}${p.n}${typeIcons(p, 15)}</div>
      <div class="rkrmv">${mvChip(mv.n)}
        <span class="rkrdim">${r.mine ? `個体値${r.ivs.join('/')} PL${r.level}` : ''}</span></div>
    </div>
    <div class="rkrnum">${num}<small>${sub}</small><i class="rkrdps">${r.dps.toFixed(1)}/秒</i></div>
  </div>`;
}

// ---- ロケット団戦: 模擬戦 ----
// ans  = 決断への答え（キーは rbKey。決めていない場面は「おまかせ」でAIが判断する）
// step = 見かた。true=バトル（1ターン=0.5秒で再生し、決断で止まる）／false=結果だけ（一気に出す）
const RB = { ans: {}, step: true, found: null, goal: null };
const rbAnsCount = () => Object.keys(RB.ans).length;
// 共有URL用: 決断の答えを短い文字列にする(キーの : は . に置き換える)
const RB_CODE = { fire: 'f', wait: 'w', hold: 'h', use: 'u', no: 'n', stay: 'y', order: 'o', to: 't', toq: 'q', auto: 'a', opt: 'p', bluff: 'b' };
const rbAnsToStr = () => Object.keys(RB.ans).map(k => {
  const a = RB.ans[k], c = RB_CODE[a.a] || 'a';
  const v = (a.a === 'fire' || a.a === 'opt') ? a.mv : a.a === 'bluff' ? `${a.mv}~${a.until}`
    : a.a === 'wait' ? a.n : (a.a === 'to' || a.a === 'toq') ? a.to : null;
  return `${k.replace(/:/g, '.')}~${c}${v != null ? '~' + v : ''}`;
}).join(',');
function rbAnsFromStr(str) {
  str.split(',').forEach(s => {
    const [k, c, v, v2] = s.split('~');
    if (!k || !c) return;
    const a = c === 'f' ? (D.moves[v] ? { a: 'fire', mv: v } : null)
      : c === 'p' ? (D.moves[v] ? { a: 'opt', mv: v } : null)   // このわざを最適タイミングで(2026-08-20)
      : c === 'b' ? (D.moves[v] ? { a: 'bluff', mv: v, until: Math.max(0, Math.min(100, +v2 || 0)) } : null)   // ためてブラフ(2026-08-30)
      : c === 'w' ? { a: 'wait', n: Math.max(1, Math.min(9, +v || 1)) }
      : c === 'h' ? { a: 'hold' } : c === 'u' ? { a: 'use' } : c === 'n' ? { a: 'no' }
      : c === 'y' ? { a: 'stay' } : c === 'o' ? { a: 'order' }
      : c === 't' ? (isNaN(+v) ? null : { a: 'to', to: +v })
      : c === 'q' ? (isNaN(+v) ? null : { a: 'toq', to: +v }) : null;
    if (a) RB.ans[k.replace(/\./g, ':')] = a;
  });
}

// ---- 模擬戦: じぶんが使うわざ(枠ごとに自分で選ぶ) ----
// パーティ診断は「わざを対面ごとに最適化」する仕様なので、PT には書かず別に持つ。
// SPアタックは必ず具体的なわざを指定する（おまかせにしない＝画面に出ているわざで必ず戦う）。
// ノーマルアタックだけ「おまかせ」を選べる（policies が効率のよい構成を選ぶ）
const RBM = [null, null, null];
const RBM_KEY = 'gbl_rocket_mymoves';
try { const v = JSON.parse(localStorage.getItem(RBM_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) RBM[i] = m; }); } catch (e) {}
const saveRbm = () => { try { localStorage.setItem(RBM_KEY, JSON.stringify(RBM)); } catch (e) {} };
// 既定のわざ: ノーマルは「1ターンあたりのダメージ(タイプ一致1.2倍込み)が最高のわざ」、
// SPは「ダメージ効率(威力÷ゲージ)がいちばん高いわざ」
function rbmDefault(key) {
  const { fasts, chargeds } = movePool(key);
  const ty = D.pokemon[key].ty;
  const dpt = m => D.moves[m].p * (ty.includes(D.moves[m].t) ? 1.2 : 1) / (D.moves[m].tn || 1);
  const dpe = m => D.moves[m].p / D.moves[m].e;
  return { v: 2, key,
    fast: fasts.slice().sort((a, b) => dpt(b) - dpt(a))[0] || 'auto',
    c1: chargeds.slice().sort((a, b) => dpe(b) - dpe(a))[0] || '', c2: '' };
}
// その枠のわざ指定(ポケモンを入れ替えたら作り直す。v無しは旧形式なので既定を選び直す)
function rbmOf(i) {
  if (!PT[i]) return null;
  if (!RBM[i] || RBM[i].key !== PT[i].key || !RBM[i].v) { RBM[i] = rbmDefault(PT[i].key); saveRbm(); }
  return RBM[i];
}
const rbMyMoves = () => [0, 1, 2].filter(i => PT[i]).map(i => rbmOf(i));

// じぶんの各枠のわざ構成を決める(1対1の rkOptimize と同じ最悪ケース基準)。バトル中は変えられない
// 置いた手には左右されない(バトル前に決めるもの)ので、同じ条件なら計算し直さずに使い回す。
// これが無いと、ターンをタップするたびに45ms×3通りの選び直しが走って画面が重くなる
// (シールド枚数ごとに選び直すので、0/1/2の3通りを覚えておけるようにMapで持つ)
const RBP = new Map();
const rbPkKey = (mine, foes, sh) => JSON.stringify([mine, foes, sh, RK.kind, RK.stall, SIMOPT.buffMode, rbMyMoves()]);
const rbPicksHas = (mine, foes, sh) => RBP.has(rbPkKey(mine, foes, sh));
function rbPicksCached(mine, foes, myShields) {
  const key = rbPkKey(mine, foes, myShields);
  if (!RBP.has(key)) {
    if (RBP.size > 6) RBP.clear();   // 設定を変えながら使うと溜まるので、たまに捨てる
    RBP.set(key, rbPicks(mine, foes, myShields, rbMyMoves()));
  }
  return RBP.get(key);
}
// moves = 画面で選んだわざ(mine と同じ並び)。ノーマルが 'auto' のときだけ構成を選ばせる
function rbPicks(mine, foes, myShields, moves) {
  moves = moves || [];
  return mine.map((m, k) => {
    const base = ptBase(m, 0);
    const mv = moves[k] || {};
    const pols = policies(m.key, {
      fast: (mv.fast && mv.fast !== 'auto') ? mv.fast : (m.fast || undefined),
      c1: mv.c1 || m.c1 || undefined,
      c2: mv.c2 || m.c2 || undefined });
    let best = null;
    for (const pol of pols) {
      const L = { ...base, ...pol, timing: 'optimal', shields: myShields, bluff: true };
      let sc = 0;
      for (const f of foes) {
        const R = rktCfg(f, { stallStart: 0, shields: rkShields() });
        const { fasts, chargeds } = rkPool(f.key);
        const spList = chargeds.length ? chargeds : [null];
        let worst = null;
        for (const fm of fasts) for (const sp of spList) {
          const s = rkWorstScore(PvpEngine.simulate(D, L, { ...R, fast: fm, charged: sp ? [sp] : [], throw: sp }, SIMOPT));
          if (worst === null || s < worst) worst = s;
        }
        sc += worst;
      }
      if (!best || sc > best.sc) best = { sc, pol };
    }
    return { m, base, pol: best.pol, name: ptName(m) };
  });
}
// ---- 模擬戦「1手ずつ」: 決断が要る場面だけ止まって選ぶ ----
// 実際のバトルと同じ流れを再現する。ノーマルアタックの応酬はまとめて進み、
// 次の4つのどれかに来たら止まって選択肢を出す(選ぶたびに先へ伸びていく):
//   sp   … 自分のSPアタックが撃てるようになった → 撃つ(どちらを) / 撃たない / あとN発攻撃してから
//   sh   … あいてのSPアタックが飛んできた → シールドを使う / 使わない
//   swap … あいての次のポケモンが出てきた(倒した直後など) → すぐ交代 / 硬直ぶん攻撃してから交代 / このまま
//   next … 自分が倒された → 次にどれを出すか
// 答えは RB.ans[キー] に持つ。キーは「対面の番号:種別:連番:待った発数」なので、
// 前の決断を変えなければ後ろの決断のキーも変わらない(選び直しに強い)。
// 決めていない場面は「おまかせ」(AIの判断)で進む。これは従来の自動と完全に同じ動きになる
// ＝ 一気に結果を出してから、気になる場面だけタップして選び直せる。
const rbKey = (li, kind, seq, w) => `${li}:${kind}:${seq}:${w || 0}`;
const RB_AUTO = { sp: { a: 'auto' }, sh: { a: 'use' }, swap: { a: 'stay' }, next: { a: 'order' }, lead: { a: 'to', to: 1 } };

// 1対面ぶんのシミュ結果から、決断が要る場面を時系列に並べる。
// dec はいまの対面で決まっている内容(撃つと決めた発・使うと決めたシールド)。
function rbPoints(turns, ctx, dec) {
  const pts = [];
  // --- あいてのSPアタック(シールドを使うかどうか) ---
  let shSeq = 0, shUsed = 0;
  // --- 自分のSPアタック(撃つかどうか) ---
  // asked = その発についてもう聞いた（撃つ or 撃たないが決まるまで、毎ターン聞き直さない）
  let spIdx = 0, armed = false, normals = 0, asked = false;
  const cost = ctx.cost;
  for (const t of turns) {
    // あいてのSPアタックが飛んできた(1ターンに複数入ることは無いが念のため配列で見る)
    for (const e of t.ev[1]) {
      if (e.full === undefined) continue;
      // mv/dmg は選択ウィンドウの表示用(何が来て、受けたら何ダメージか)
      if (ctx.myShLeft - shUsed > 0) pts.push({ kind: 'sh', seq: shSeq, tn: t.tn, spSeen: shSeq + 1, mv: e.move, dmg: e.full });
      if (dec.shieldAt.includes(shSeq + 1)) shUsed++;
      shSeq++;
    }
    // 自分がSPアタックを撃った → 次の発の判断へ
    if (t.ev[0].some(e => e.full !== undefined)) { spIdx++; armed = false; asked = false; normals = 0; continue; }
    if (armed && t.ev[0].some(e => e.full === undefined)) normals++;   // 待っているあいだのノーマル
    // 決着したターンではSPの質問を出さない(2026-08-10バグ修正)。
    // SPアタックは次の行動ターンに発動するので、すでに倒しきった(倒された)ターンで
    // 「撃つ?」と聞いても撃ちようがない。あいてのHPが0なのにSPを聞かれて見えていた原因
    const over = t.state[0].hp <= 0 || t.state[1].hp <= 0;
    // 交代すると決めたあとはSPの質問を出さない(攻撃して下がる途中に撃つ判断は混乱のもと)
    if (!armed && !asked && !over && !dec.hold && dec.swapTo == null && cost && t.state[0].en >= cost) { armed = true; normals = 0; }
    if (armed && !over) {
      // 「あとN発攻撃してから」を選んでいれば、そのぶん後ろにずれたところが判断の場面
      // (撃つと決めた発は、そのとき決めた待ち発数の位置に判断の場面が残る＝キーが変わらない)
      const sht = spIdx < dec.shots.length ? dec.shots[spIdx] : null;
      const dw = sht ? sht.wait : dec.wait;
      const w = typeof dw === 'number' ? dw : (sht && sht.after) || 0;
      // en = この時点のゲージ。選択ウィンドウで「ゲージが足りないわざはあと何発で発動か」を出すのに使う
      if (normals >= w) { pts.push({ kind: 'sp', seq: spIdx, w, tn: t.tn, en: t.state[0].en }); armed = false; asked = true; }
    }
  }
  // --- あいての次のポケモンが出てきた(倒した直後など・硬直中): こちらも交代するか ---
  // 質問は「次のあいてが出てきたターン」に出す。すぐ交代するか、硬直のあいだ
  // ノーマルアタックを打ちきってから交代するか(rbChoices)を選べる。
  // クールタイムが明けない・出せる控えが無いときは出さない
  if (ctx.foeEntry > 0 && (ctx.ck ? ctx.ck(ctx.foeEntry) : ctx.base + ctx.foeEntry) >= ctx.swOkAt && ctx.swTo.length) {
    pts.push({ kind: 'swap', seq: 0, tn: 1 });
  }
  // 質問は必ず時系列の順に出す(同じターンに並んだら交代→SP・シールドの順。
  // 「交代する？」が最初の判断で、残る場合にだけSPを撃つかが意味を持つため)。
  // 時系列を崩して交代を先頭に出すと、答えたあとに時間が巻き戻る逆順が起きる(実装時に踏んだ)
  pts.sort((a, b) => a.tn - b.tn || (a.kind === 'swap' ? -1 : b.kind === 'swap' ? 1 : 0));
  return pts;
}

// 決断ひとつぶんの選択肢(画面に出すボタン)を作る
function rbChoices(p, ctx) {
  if (p.kind === 'lead') return ctx.swTo.map(k => ({ a: 'to', to: k, label: `${SWAPMK} ${shMark(ctx.picks[k].name)}`, cls: 'fire',
    tip: '開幕にこのポケモンへ交代します(あいての打ちかけの1発は交代先に入ります)' }));
  if (p.kind === 'sp') {
    // GBL模擬戦と同じ形(2026-08-23にロケット団へ反映): わざごとのフレームに「⭐最適」「即打ち」の2大ボタン。
    // ロケット団は「SPを撃たずに速く倒す」が基本なので「撃たない」をいちばん左に置く(確定仕様)。
    // ＋1〜＋3の細かい指定は「…詳細」に畳む。
    // 質問は「いちばん軽いSPが撃てるようになったターン」に出るので、重いほうのわざは
    // ゲージが足りず、ノーマルを追加で打ってからの発動になる。それをボタンに出す(「選んだらすぐ撃てる」と錯覚しないように)
    const fm = ctx.fast && D.moves[ctx.fast];
    const list = [
      p.noSp
        ? { a: 'hold', label: '撃たない<i class="rtag">おすすめ</i>', cls: 'hold reco',
            tip: 'ノーマルアタックだけで倒しきれて、あいてのSPアタックも飛んできません。撃たずにゲージを次の相手へ持ち越すのがおすすめです' }
        : { a: 'hold', label: '撃たない', cls: 'hold', tip: 'この相手には撃たず、ゲージを次の相手に持ち越します' },
    ];
    ctx.spList.forEach(id => {
      const m = D.moves[id];
      const need = fm && fm.eg > 0 && p.en != null
        ? Math.max(0, Math.ceil((m.e - p.en) / fm.eg)) : 0;
      const head = `${mvChip(m.n, 14)}<i class="cost">${m.e}</i>${
        need ? `<i class="need">${fm.n}＋${need}</i>` : ''}`;
      const optN = p.optNs ? p.optNs[id] : null;
      list.push({ a: 'opt', mv: id, grp: id, head, cls: 'best',
        label: `⭐ 最適${optN > 0 ? `<i class="need">＋${optN}</i>` : ''}`,
        tip: optN > 0
          ? `${m.n}を、いちばん効率のよいタイミングで撃ちます(ノーマルアタックをあと${optN}発はさんでから)`
          : `${m.n}を、いちばん効率のよいタイミングで撃ちます` });
      list.push({ a: 'fire', mv: id, grp: id, cls: 'fire',
        label: '即打ち',
        tip: need ? `ゲージが足りないので、${fm.n}をあと${need}発打って、たまり次第すぐ${m.n}を撃ちます`
                  : `タイミングを待たず、ここですぐ${m.n}を撃ちます` });
    });
    return list.concat([
      { a: 'wait', n: 1, det: true, label: '＋1', cls: 'wait', tip: 'ノーマルアタックをあと1発打ってから、もう一度ここで選びます' },
      { a: 'wait', n: 2, det: true, label: '＋2', cls: 'wait', tip: 'ノーマルアタックをあと2発打ってから、もう一度ここで選びます' },
      { a: 'wait', n: 3, det: true, label: '＋3', cls: 'wait', tip: 'ノーマルアタックをあと3発打ってから、もう一度ここで選びます' },
    ]);
  }
  if (p.kind === 'sh') return [
    { a: 'use', label: '🛡 使う', cls: 'fire', tip: 'シールドで防ぎます(ダメージ1)' },
    { a: 'no', label: `受ける${p.dmg ? `<b class="dmg">-${p.dmg}</b>` : ''}`, cls: 'hold', tip: 'シールドを使わずにダメージを受けます' },
  ];
  if (p.kind === 'swap') {
    // すぐ交代するか、あいての硬直のあいだノーマルアタックを打ちきってから交代するか。
    // ＋N = 硬直(foeEntryターン)のあいだに打ちきれる発数
    const fm = ctx.fast && D.moves[ctx.fast];
    const n = fm ? Math.floor(ctx.foeEntry / (fm.tn || 1)) : 0;
    const opts = [];
    for (const k of ctx.swTo) {
      opts.push({ a: 'toq', to: k, cls: 'fire',
        label: `${SWAPMK} ${shMark(ctx.picks[k].name)} <i class="need">すぐ</i>`,
        tip: 'いますぐ交代します(あいてはここから4.5秒動けません／自分も0.5秒動けません)' });
      if (n > 0) opts.push({ a: 'to', to: k, cls: 'fire',
        label: `${SWAPMK} ${shMark(ctx.picks[k].name)} <i class="need">${fm.n}＋${n}</i>`,
        tip: `あいてが動けないあいだに${fm.n}をあと${n}発打ってから交代します(硬直ぶんを攻撃してから下がる)` });
    }
    return opts.concat([{ a: 'stay', label: 'このまま', cls: 'hold', tip: '交代せずにこのまま戦います' }]);
  }
  // 手動交代(HUDの⇄ボタン)の編集: 交代先だけ選び直せる(取り消しは↺)
  if (p.kind === 'msw') return ctx.swTo.map(k => ({ a: 'toq', to: k, cls: 'fire',
    label: `${SWAPMK} ${shMark(ctx.picks[k].name)}`,
    tip: 'このポケモンに交代します(あいては4.5秒動けませんが、じぶんも0.5秒動けません・次の交代は45秒後)' }));
  return ctx.swTo.map(k => ({ a: 'to', to: k, label: shMark(ctx.picks[k].name), cls: 'fire',
    tip: '次にこのポケモンを出します' }));
}

// 決めた答えを、その対面の決定(dec)に反映する
function rbApply(dec, p, ans) {
  if (p.kind === 'sp') {
    // おまかせ＝エンジンの最適タイミング判断にゆだねる(従来の自動とまったく同じ動き)
    if (ans.a === 'auto') { dec.shots[p.seq] = { wait: 'opt', after: dec.wait, mv: null }; dec.wait = 0; }
    // 最適(わざ指定・2026-08-20): このわざを、エンジンの最適タイミングで撃つ
    else if (ans.a === 'opt') { dec.shots[p.seq] = { wait: 'opt', after: dec.wait, mv: ans.mv }; dec.wait = 0; }
    else if (ans.a === 'fire') { dec.shots[p.seq] = { wait: dec.wait, mv: ans.mv }; dec.wait = 0; }
    // ためてブラフ(2026-08-30): 重いわざのゲージ(until)までためてから軽いわざ(mv)を撃つ
    else if (ans.a === 'bluff') { dec.shots[p.seq] = { wait: 'en', until: ans.until, mv: ans.mv }; dec.wait = 0; }
    else if (ans.a === 'wait') dec.wait += ans.n;
    else dec.hold = true;
  } else if (p.kind === 'sh') {
    if (ans.a !== 'no') dec.shieldAt.push(p.spSeen);   // おまかせは「残っていれば使う」
  }
  // swap / next は対面をまたぐので、呼び出し側(rbPlay)で使う
}

// 決断リスト(ans)のとおりにバトルを進める。まだ決めていない場面に来たら
// そこで止めて pending に入れて返す(画面はそこまでを出して選択肢を見せる)。
// stepwise=true なら「1手ずつ」＝決めていない場面に来たら止まる。
// false（おまかせ）なら決めていない場面はAIの判断で進み、最後まで結果を出す。
// worst=true はあいてのわざを対面ごとに「こちらがいちばんキツいもの」にする(わざ運の最悪ケース)
function rbPlay(picks, foes, myShields, ans, stepwise, worst) {
  ans = ans || {};
  const legs = [];
  const st = picks.map(() => ({ alive: true, resume: null }));
  const nextAlive = from => {
    for (let i = 0; i < st.length; i++) if (st[(from + i) % st.length].alive) return (from + i) % st.length;
    return -1;
  };
  let mi = 0, fi = 0, base = 0, pending = null;
  let myShLeft = myShields, foeShLeft = rkShields();
  let foeResume = null;
  // あいてのわざはバトル中に変わらない。「自動(いちばんキツい)」も最初の対面で採用したわざに
  // 固定し、こちらの交代・被弾後の出し直しで同じあいてと再戦しても選び直さない
  const foeMvLock = {};
  let myEntry = RK_ENTER[RK.enter].me, foeEntry = RK_ENTER[RK.enter].foe;
  let swOkAt = 0;   // 交代が解禁される**実時間**(ターン換算)
  let spTot = 0;    // ここまでに撃たれたSPの待ち時間の合計(ターン換算)
  // ---- 開幕交代(1匹目を出してすぐ交代し、あいての硬直4.5秒を序盤に稼ぐ) ----
  // あいての打ちかけのノーマルアタック1発は交代先に入り、あいてはそのぶんのゲージを得る。
  // そのあと あいて9ターン硬直・自分1ターン硬直・交代クールタイム開始(通常の手動交代と同じ)
  let lead = null;
  if (RK.leadSwap && picks.length > 1 && foes.length) {
    const key = rbKey(0, 'lead', 0, 0);
    const lctx = { li: 0, base: 0, picks, swTo: picks.map((p, k) => k).filter(k => k > 0) };
    const opts = rbChoices({ kind: 'lead' }, lctx);
    const a = ans[key] || (stepwise ? null : RB_AUTO.lead);
    if (!a) {
      pending = { kind: 'lead', seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts };
    } else {
      const to = picks[a.to] ? a.to : 1;
      // 飛んでくる1発のダメージは、交代先 vs あいて で小さくシミュして読み取る
      // (タイプ相性・シャドウ・倍率込みの正確な値になる)。
      // わざ欄が「自動(いちばんキツい)」なら、いちばん痛いノーマルアタックが来るとして読む
      const R0 = rktCfg(foes[0], { shields: foeShLeft, stallStart: 0 });
      const lfList = foes[0].fast ? [R0.fast] : rkPool(foes[0].key).fasts;
      let hit = null;
      for (const f of lfList) {
        const probe = PvpEngine.simulate(D, { ...picks[to].base, ...picks[to].pol,
          charged: [], timing: 'shots', shotPlan: [], shotRest: null, shields: myShields },
          { ...R0, fast: f }, { ...SIMOPT, stopAt: 8 });
        for (const row of probe.rows) {
          const e = row.ev && row.ev[1];
          if (e && e.full === undefined && e.dmg != null) {
            if (!hit || e.dmg > hit.dmg) hit = { dmg: e.dmg, mv: e.move, eg: D.moves[f] ? D.moves[f].eg : 0 };
            break;
          }
        }
      }
      if (!hit) hit = { dmg: 1, mv: D.moves[R0.fast] ? D.moves[R0.fast].n : '',
        eg: D.moves[R0.fast] ? D.moves[R0.fast].eg : 0 };
      const maxB = PvpEngine.buildStats(D, picks[to].base).hp;
      const maxF = PvpEngine.buildStats(D, R0).hp;
      gulpOff(st[mi].resume);   // ウッウ: 場を離れると通常の姿に戻る
      mi = to;
      st[to].resume = { hp: Math.max(0, maxB - hit.dmg), en: 0, buffs: [0, 0], stall: 0 };
      foeResume = { hp: maxF, en: Math.min(100, hit.eg), buffs: [0, 0], stall: 0 };
      myEntry = RK_ENTER.swap.me;
      foeEntry = RK_ENTER.swap.foe;
      swOkAt = RK.swapCd;
      lead = { hit: { mv: hit.mv, dmg: hit.dmg },
        pt: { kind: 'lead', seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts, ans: a, auto: !ans[key] } };
    }
  }
  while (fi < foes.length && mi >= 0 && legs.length < 12 && !pending) {
    const li = legs.length;
    const pol = picks[mi].pol;
    const spList = rbSpList(pol);
    const cost = spList.length ? Math.min(...spList.map(id => D.moves[id].e)) : 0;
    const swTo = picks.map((p, k) => k).filter(k => k !== mi && st[k].alive);
    const ctx = { li, base, cost, spList, picks, myShLeft, foeEntry, swOkAt, swTo, fast: pol.fast,
      ck: tn => base + tn + spTot };   // その時点の実時間(SPの待ち時間を含む)
    const dec = { shots: [], wait: 0, hold: false, shieldAt: [], swapTo: null, swapAt: 0 };
    // 決めた場面はキーで覚える(「撃たない」を選ぶとその場面自体が消えるなど、
    // 決めるたびに場面の並びが変わるので、番号ではなくキーで対応づける)
    const handled = new Set(), log = [];   // log = 決めた場面の履歴(画面に出して選び直せるようにする)
    let res = null, foeMv = null;   // foeMv = 採用したあいてのわざ(自動のときHUDの表示に使う)
    // あいての採用わざ(自動=いちばんキツい)は、この対面をはじめて迎えた時点で
    // 「全部おまかせ」基準(1対1と同じエンジンの自動プレイ)の全通り評価で決めて、バトル中固定する。
    // 決断を反映した再計算で選び直すと、SP・シールド・交代に答えるたびに
    // あいてのわざが変わって見えてしまう(2026-08-10バグ修正)
    if (!foeMvLock[fi]) {
      const pool0 = rkPool(foes[fi].key);
      const Rb = rktCfg(foes[fi], { shields: foeShLeft, stallStart: foeEntry });
      if (foeResume) Rb.resume = { ...foeResume, stall: Math.max(foeResume.stall || 0, foeEntry) };
      const Lb = { ...picks[mi].base, ...pol, charged: spList.slice(), shields: myShLeft,
        bluff: true, timing: 'optimal' };
      if (st[mi].resume) Lb.resume = { ...st[mi].resume, stall: Math.max(st[mi].resume.stall || 0, myEntry) };
      else if (myEntry) Lb.stallStart = myEntry;
      const fl = (worst || !foes[fi].fast) ? pool0.fasts : [Rb.fast];
      const sl = (worst || !foes[fi].c1) ? (pool0.chargeds.length ? pool0.chargeds : [null]) : [Rb.throw || null];
      let bs = null, bmv = null;
      for (const f of fl) for (const sp of sl) {
        const r = PvpEngine.simulate(D, Lb, { ...Rb, fast: f, charged: sp ? [sp] : [], throw: sp }, SIMOPT);
        const s = rkWorstScore(r);
        if (bmv === null || s < bs) { bs = s; bmv = { fast: f, sp: sp || null }; }
      }
      if (bmv) foeMvLock[fi] = bmv;
    }
    // 決断を1つずつ解決する(1つ決めるたびに1ターン目から回し直す)
    for (let guard = 0; guard < 60; guard++) {
      // charged は必ず入れる(SPが1本の構成だと、わざ未指定のときエンジンが選べないため)
      const L = { ...picks[mi].base, ...pol, charged: spList.slice(), shields: myShLeft, bluff: true,
        timing: 'shots', shotPlan: dec.shots.map(s => ({ mode: s.wait, move: s.mv, after: s.after, until: s.until })), shotRest: null,
        shieldPlan: dec.shieldAt.slice(), shieldRest: false };
      if (st[mi].resume) L.resume = { ...st[mi].resume, stall: Math.max(st[mi].resume.stall || 0, myEntry) };
      else if (myEntry) L.stallStart = myEntry;
      const R = rktCfg(foes[fi], { shields: foeShLeft, stallStart: foeEntry });
      if (foeResume) R.resume = { ...foeResume, stall: Math.max(foeResume.stall || 0, foeEntry) };
      const sopt = { ...SIMOPT, stopAt: dec.swapAt };
      // あいてのわざ欄が「自動(いちばんキツい)」の項目は全通り試して、こちらに
      // いちばんキツいものを採用する(1対1の最悪ケース基準と結果がそろう)。
      // worst=true(わざ運の最悪) は、わざを指定していても全通りにする
      const pool = rkPool(foes[fi].key);
      const lock = foeMvLock[fi];   // 2対面目以降は最初に採用したわざで固定(途中で変わらない)
      const fList = lock ? [lock.fast] : (worst || !foes[fi].fast) ? pool.fasts : [R.fast];
      const spL = lock ? [lock.sp]
        : (worst || !foes[fi].c1) ? (pool.chargeds.length ? pool.chargeds : [null]) : [R.throw || null];
      // じぶんの設定(Lx)で、あいてのわざ候補を全部回して最悪ケースを返す(下読みにも同じ基準を使う)
      const simWorst = Lx => {
        let best = null, bsc = null, mv = null;
        for (const f of fList) for (const sp of spL) {
          const r = PvpEngine.simulate(D, Lx, { ...R, fast: f, charged: sp ? [sp] : [], throw: sp }, sopt);
          const sc = rkWorstScore(r);
          if (!best || sc < bsc) { best = r; bsc = sc; mv = { fast: f, sp: sp || null }; }
        }
        return { res: best, mv };
      };
      const w0 = simWorst(L);
      res = w0.res; foeMv = w0.mv;
      const withShots = shots => ({ ...L, shotPlan: shots.map(x => ({ mode: x.wait, move: x.mv, after: x.after, until: x.until })) });
      // 「⭐最適」ボタン用: この発を最適タイミング(mvId指定)にしたとき、あと何発ノーマルアタックを
      // はさんでから撃つことになるか(GBL模擬戦と同じ・2026-08-23にロケット団へ反映)
      const optNOf = (p, mvId) => {
        if (p.kind !== 'sp') return null;
        const shots = dec.shots.slice(); shots[p.seq] = { wait: 'opt', after: dec.wait, mv: mvId || null };
        const r = simWorst(withShots(shots)).res;
        let spCnt = 0, fasts = 0;
        for (const t of rbTurns(r)) for (const e of t.ev[0]) {
          if (e.full !== undefined) { if (spCnt === p.seq) return fasts; spCnt++; }
          else if (spCnt === p.seq && t.tn > p.tn) fasts++;
        }
        return null;
      };
      const optNsOf = p => {
        if (p.kind !== 'sp') return null;
        const m = {}; spList.forEach(id => { m[id] = optNOf(p, id); }); return m;
      };
      // 「撃たない」が正解の場面か(GBL模擬戦と同じ判定): この発から先SPを撃たなくても
      // ノーマルアタックだけで倒しきれて、あいてのSPアタックも飛んでこないなら撃つのはもったいない
      const finishNoSp = p => {
        if (p.kind !== 'sp') return false;
        const r = simWorst(withShots(dec.shots.slice(0, p.seq))).res;
        if (r.winner !== 0) return false;
        for (const t of rbTurns(r)) {
          if (t.tn < p.tn) continue;
          if (t.ev[1].some(e => e.full !== undefined)) return false;
        }
        return true;
      };
      const pts = rbPoints(rbTurns(res), ctx, dec);
      // 手動交代(HUDの⇄ボタン・kind msw・2026-09-01・GBLと同じ)。検証に通らない古い記録は黙って捨てる
      const mkey = Object.keys(ans).find(k => k.indexOf(li + ':msw:') === 0 && !handled.has(k));
      const mtn = mkey ? +mkey.split(':')[2] : -1;
      const p = pts.find(x => !handled.has(rbKey(li, x.kind, x.seq, x.w)));
      if (mkey && (!p || mtn < p.tn)) {
        handled.add(mkey);
        const ma = ans[mkey];
        if (ma && ma.a === 'toq' && ctx.swTo.includes(ma.to) && dec.swapTo == null
            && mtn >= 1 && mtn <= res.turns
            && base + spTot + mtn + rkSpAt(rkSpc(res), mtn) >= swOkAt) {
          log.push({ kind: 'msw', seq: mtn, w: 0, tn: mtn, key: mkey, gt: base + mtn, ans: ma, auto: false });
          dec.swapTo = ma.to; dec.swapAt = mtn;
        }
        continue;
      }
      if (!p) break;                              // この対面で決めることはもう無い
      p.key = rbKey(li, p.kind, p.seq, p.w);
      p.gt = base + p.tn;
      if (p.kind === 'sp') { p.optNs = optNsOf(p); p.noSp = finishNoSp(p); }
      const a = ans[p.key] || (stepwise ? null : RB_AUTO[p.kind]);
      if (!a) { pending = { ...p, ctx, opts: rbChoices(p, ctx) }; break; }
      handled.add(p.key);
      log.push({ ...p, ans: a, auto: !ans[p.key] });
      if (p.kind === 'swap') {
        if (a.a === 'stay') continue;             // 交代しないなら、そのまま先へ
        dec.swapTo = a.to;
        // すぐ交代=そのターンのうちに ／ それ以外=硬直のあいだ攻撃しきってから(旧共有リンクの t~ も同じ)
        dec.swapAt = a.a === 'toq' ? 1 : Math.max(1, ctx.foeEntry);
        continue;
      }
      rbApply(dec, p, a);
    }
    res.final[0].name = picks[mi].name;
    res.final[1].name = rktName(foes[fi]);
    const meDown = res.final[0].hp <= 0, foeDown = res.final[1].hp <= 0;
    const swapped = !!(res.stopped && dec.swapTo != null && !meDown && !foeDown);
    // この対面の「決断の場面」を最終状態で作り直す(画面に出してタップで選び直せるようにする)
    const points = log.map(p => ({ ...p, gt: base + p.tn, ctx, opts: rbChoices(p, ctx) }));
    legs.push({ res, base, myIdx: mi, foeIdx: fi, meName: picks[mi].name, foeName: rktName(foes[fi]),
      swOk: swOkAt,   // この対面中に交代が解禁される通しターン(HUDの交代タイマー用)
      meDown, foeDown, swapped, swapTo: swapped ? dec.swapTo : null, pol, li, points, foeMv,
      leadHit: li === 0 && lead ? lead.hit : null, leadPt: li === 0 && lead ? lead.pt : null,
      // hud = この対面が始まった時点の両者の状態(下の常駐フレームの表示に使う)
      hud: { hp0: st[mi].resume ? Math.max(0, st[mi].resume.hp) : res.final[0].hpMax,
             en0: st[mi].resume ? st[mi].resume.en : 0,
             b0: ((st[mi].resume && st[mi].resume.buffs) || [0, 0]).slice(),
             hp1: foeResume ? Math.max(0, foeResume.hp) : res.final[1].hpMax,
             en1: foeResume ? foeResume.en : 0,
             b1: ((foeResume && foeResume.buffs) || [0, 0]).slice(),
             g0: (st[mi].resume && st[mi].resume.gulp) || null,
             g1: (foeResume && foeResume.gulp) || null },
      pending: pending && pending.key.slice(0, pending.key.indexOf(':')) === String(li) ? pending : null });
    if (pending) break;
    base += res.turns;
    spTot += rkSpAt(rkSpc(res), res.turns);   // この対面で撃たれたSPの待ち時間
    myShLeft = res.final[0].shields;
    foeShLeft = res.final[1].shields;
    st[mi].alive = !meDown;
    st[mi].resume = meDown ? null : res.final[0].resume;
    foeResume = foeDown ? null : res.final[1].resume;
    if (!meDown && !foeDown && !swapped) break;   // 上限ターンまで決着せず
    if (foeDown) fi++;
    if (swapped) {
      gulpOff(st[mi].resume);   // ウッウ: 場を離れると通常の姿に戻る
      mi = dec.swapTo;
      swOkAt = base + spTot + RK.swapCd;   // 交代の45秒はSPの演出中も進む
      foeEntry = Math.max(RK_ENTER.swap.foe, foeDown ? RK.koFoe : 0);
      myEntry = RK_ENTER.swap.me;
    } else {
      if (meDown) {
        // 倒された → 次に出すポケモンを選ぶ(残り1匹なら選ぶまでもない)
        const rest = picks.map((p, k) => k).filter(k => st[k].alive);
        if (rest.length > 1) {
          const key = rbKey(li, 'next', 0, 0), nctx = { ...ctx, swTo: rest };
          const a = ans[key] || (stepwise ? null : RB_AUTO.next);
          const pt = { kind: 'next', seq: 0, w: 0, key, tn: res.turns, gt: base, ctx: nctx,
            opts: rbChoices({ kind: 'next' }, nctx), ans: a, auto: !ans[key] };
          if (!a) { pending = pt; legs[legs.length - 1].pending = pt; break; }
          legs[legs.length - 1].nextPoint = pt;
          mi = a.a === 'to' ? a.to : nextAlive(mi);
        } else mi = rest.length ? rest[0] : -1;
      }
      foeEntry = Math.max(meDown ? RK.koMe : 0, foeDown ? RK.koFoe : 0);
      myEntry = 0;
    }
  }
  const meLeft = st.filter(s => s.alive).length;
  const foeLeft = foes.length - fi;
  const outcome = pending ? 'playing'
    : foeLeft === 0 ? (meLeft > 0 ? 'win' : 'draw') : (meLeft === 0 ? 'lose' : 'timeout');
  // 生き残っているぶんの残HP(割合の合計)。手順のよしあしを比べるのに使う
  const hpLeft = st.reduce((sum, s, i) => {
    if (!s.alive) return sum;
    const max = PvpEngine.buildStats(D, picks[i].base).hp;
    return sum + (s.resume ? Math.max(0, s.resume.hp) / max : 1);
  }, 0);
  return { legs, picks, st, outcome, meLeft, foeLeft, pending, turns: base, hpLeft,
    clock: base + spTot,   // 実時間(ターン換算)。SPアタックの待ち時間を含む
    myShLeft, foeShLeft, nMe: picks.length, nFoe: foes.length };
}

// ---- 手順の自動探索 ----
// 対面ごとに「どのポケモンを出すか」「SPをどう撃つか（作戦）」「すぐ交代するか」を
// 総当たりし、ビームサーチ(見込みのある手順だけ残して次の対面へ)で通しの手順を組み立てる。
// goal='fast' … 早く倒しきる手順 ／ goal='safe' … 手持ちを多く残して確実に勝つ手順
const RB_GOAL = {
  fast: { label: '最速', tip: '倒しきるまでの時間がいちばん短い手順をさがします（ロケット団戦はここがいちばん大事）' },
  safe: { label: '安定', tip: '手持ちとHPをできるだけ多く残して勝つ手順をさがします（負けにくさ重視）' },
};
function rbScore(bt, goal) {
  const win = bt.outcome === 'win' ? 1 : 0;
  const killed = bt.nFoe - bt.foeLeft;
  // まず「倒した数」、次に目的に応じて 速さ / 残り、の順で比べる
  const core = win * 1e7 + killed * 1e5;
  const clock = bt.clock != null ? bt.clock : bt.turns;   // SPの待ち時間込みの実時間で比べる
  return goal === 'fast'
    ? core - clock * 10 + bt.hpLeft * 20 + bt.meLeft * 30
    : core + bt.meLeft * 2000 + bt.hpLeft * 800 - clock;
}
// 「最速 / 安定」の手順をさがす。決断そのものを組み合わせて探すので、
// 見つかった手順は**そのまま画面の選択(ans)になる**＝探索の結果と表示が食い違わない。
// 各段で「まだ決めていない最初の場面」を選択肢ぶんだけ枝分かれさせ、見込みのある手だけ残す
function rbFind(picks, foes, myShields, goal) {
  const evalAns = ans => {
    const bt = rbPlay(picks, foes, myShields, ans, false);   // 残りはおまかせで最後まで通す
    return { ans, bt, sc: rbScore(bt, goal) };
  };
  let best = evalAns({});          // 何も決めない(全部おまかせ)を出発点にする
  let beam = [best];
  for (let depth = 0; depth < 24; depth++) {
    const cand = [];
    for (const b of beam) {
      const step = rbPlay(picks, foes, myShields, b.ans, true);
      if (!step.pending) continue;   // この手順はもう決めることが無い
      for (const o of step.pending.opts) cand.push(evalAns({ ...b.ans, [step.pending.key]: { ...o } }));
    }
    if (!cand.length) break;
    cand.sort((x, y) => y.sc - x.sc);
    beam = cand.slice(0, 5);
    if (beam[0].sc > best.sc) best = beam[0];
  }
  return best;
}

// 1ターン=0.5秒。通しターンから経過秒を出す
const rbSec = t => (t / 2).toFixed(1);
// 対面の中身を「1ターン=1行」にまとめ直す(番号行＋そのあとの'-'行を1ターンとして扱う)
function rbTurns(res) {
  const out = [];
  res.rows.forEach(row => {
    if (row.tn !== '-') out.push({ tn: row.tn, rows: [row] });
    else if (out.length) out[out.length - 1].rows.push(row);
  });
  return out.map(t => {
    const ev = [[], []];
    let stalled = false;
    t.rows.forEach(r => {
      for (let i = 0; i < 2; i++) if (r.ev[i]) ev[i].push(r.ev[i]);
      if (r.stalled && r.stalled[1]) stalled = true;
    });
    const last = t.rows[t.rows.length - 1];
    // SPアタック・シールド・能力変化・決着のあるターンは「見どころ」として必ず表示する
    const key = ev.some(list => list.some(e => e.full !== undefined || e.buff || e.shielded || e.disguised)) ||
      last.state[0].hp === 0 || last.state[1].hp === 0;
    // sub=エンジンの行そのまま(処理された順)。模擬戦のタイムラインはこの順で1行ずつ描く
    // (2026-08-20タダシさん指示。同じターンのSPの撃ち合いはCMP=攻撃実数値の高い側が先に解決される。
    //  ターン単位にまとめて描くと、この順番とどちらがブロックしたのかが見えなくなる)
    return { tn: t.tn, ev, state: last.state, stalled, key, sub: t.rows };
  });
}
// じぶんが撃てるSPアタックの一覧(1本でも2本でも同じ形にする)
const rbSpList = pol => (pol.charged && pol.charged.length ? pol.charged : (pol.throw ? [pol.throw] : []));

// ==== 模擬戦の画面: ゲームと同じ流れで「観て・選ぶ」 ====
// タイムラインは実際のバトルと同じ 1ターン=0.5秒 で上から下へ流れ、
// 決断の場面に来ると止まって、下の常駐フレーム(HUD)の上に選択ウィンドウが出る。
// HUD = 両者の HP・ゲージ・シールド・能力変化・残り手持ち(モンスターボール)を常に表示
// started=false のあいだは再生せず「バトルスタート！」ボタンを出す
// (ポケモンやわざの入力中に勝手にシミュが動き始めないように)
const RBV = { cur: 0, playing: true, speed: 1, timer: null, started: false, sig: undefined,
  fxDone: new Set() };   // 再生済みの演出(決断後の再描画で同じ演出を二重に出さない/取りこぼさないための記録)
const RBUI = { pts: {}, order: [], open: null };
// next(倒れて次を出す)に💀を付けない: 場に出したポケモンが倒れたように見える(2026-08-30タダシさん指摘)
const RB_ICON = { sp: '⚡', sh: '🛡', swap: SWAPMK, msw: SWAPMK, next: '', lead: SWAPMK };

// ---- 模擬戦の演出(FX・2026-08-30タダシさん指示「ゲームっぽく動きのある演出を」) ----
// くりだした／交代／SP発動／たおれた／フォルムチェンジ の場面で再生を止めてカットインを見せる。
// **見た目だけ**の追加で、バトルの計算・ターン・⏱秒には一切影響しない(停滞するのは再生だけ)。
// ×2/×4では時間を短縮。「結果だけ見る」・⏩スキップ・reduced-motion・✨OFFでは出さない。
// ポケモン本体の絵は著作権の都合で使えないので、光・カットイン・揺れで戦闘の熱を出す方針
const FX_KEY = 'gbl_fx';
const FX = { on: (() => { try { return localStorage.getItem(FX_KEY) !== '0'; } catch (e) { return true; } })() };
const fxSave = () => { try { localStorage.setItem(FX_KEY, FX.on ? '1' : '0'); } catch (e) {} };
const fxOk = () => FX.on && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const fxLayer = () => {
  let l = document.getElementById('fxlayer');
  if (!l) { l = document.createElement('div'); l.id = 'fxlayer'; document.body.appendChild(l); }
  return l;
};
// 演出全体の速さ(2026-08-31タダシさん指示「全てを50%遅く」＝時間を1.5倍)。
// 個別の長さ(1400等)はこの係数を掛ける前の値のまま持ち、速さの調整はここ1か所で行う
const FX_SLOW = 1.5;
// 1つの演出を出して、時間(再生速度で短縮)を返す
function fxShow(cls, html, dur) {
  const d = Math.max(300, Math.round(dur * FX_SLOW / (RBV.speed || 1)));
  const el = document.createElement('div');
  el.className = 'fxitem ' + cls;
  el.style.setProperty('--fxd', d + 'ms');
  el.innerHTML = html;
  fxLayer().appendChild(el);
  setTimeout(() => el.remove(), d + 80);
  return d;
}
// 名前(シャドウ○○を含む)からタイプアイコンを引く(2026-09-01タダシさん指示・
// 場に出る演出とVSカードで名前の横に出す=どのポケモンかの判断が速くなる)。結果はキャッシュ
const TY_BY_NAME = {};
function tyIco(nm) {
  if (!nm) return '';
  const base = nm.replace(/^シャドウ/, '');
  if (!(base in TY_BY_NAME)) {
    const p = Object.values(D.pokemon).find(x => x.n === base);
    TY_BY_NAME[base] = p ? typePairHTML(p.ty.map(t => D.typeJa[t]), 15) : '';
  }
  return TY_BY_NAME[base];
}
// ゲームのシールド(六角形タイルの結晶)を再現したアイコン(2026-08-31タダシさん指示)。
// 半径2の六角形クラスタ=19枚のタイルに、ピンク→紫→水色のグラデーションを通しで敷く
function shieldSvg() {
  const s = 15, polys = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    if (Math.abs(q + r) > 2) continue;
    const cx = s * Math.sqrt(3) * (q + r / 2), cy = s * 1.5 * r, c = [];
    for (let i = 0; i < 6; i++) { const th = Math.PI / 180 * (60 * i - 30);
      c.push((cx + s * 0.9 * Math.cos(th)).toFixed(1) + ',' + (cy + s * 0.9 * Math.sin(th)).toFixed(1)); }
    polys.push(`<polygon points="${c.join(' ')}"/>`);
  }
  return `<svg class="shcry" viewBox="-62 -58 124 116" aria-hidden="true"><defs>
    <linearGradient id="shcg" gradientUnits="userSpaceOnUse" x1="0" y1="-56" x2="0" y2="56">
      <stop offset="0" stop-color="#ffb1e8"/><stop offset=".45" stop-color="#c07bff"/><stop offset="1" stop-color="#8fd6ff"/>
    </linearGradient></defs>${polys.join('')}</svg>`;
}
// HPバーの「残像」(2026-08-31タダシさん指示・HPが減る動きの演出):
// 本体のバーはすぐ減り、うしろの白い残像がひと呼吸おいてゆっくり追いかけて減る。
// 増えたとき(対面が替わった・巻き戻した)は残像も即座に合わせる(変な逆再生をしない)
function hpGhost(gEl, w) {
  if (!gEl) return;
  const prev = +(gEl.dataset.p || 100);
  gEl.style.transition = w < prev - 0.5 ? 'width 1.24s cubic-bezier(.25,.6,.3,1) .39s' : 'none';
  gEl.style.width = w + '%';
  gEl.dataset.p = w;
}
// 画面の揺れ(SPの着弾)。transformはタイムラインとHUDにだけ当てる
function fxQuake() {
  document.querySelectorAll('.rbfeed, .rbhud').forEach(e => {
    e.classList.remove('fxquake'); void e.offsetWidth; e.classList.add('fxquake');
    setTimeout(() => e.classList.remove('fxquake'), 750);
  });
}
// 1件の演出。f = {k, side, name, mv, mk} 。返り値=かかる時間(ms)
function fxOne(f) {
  const sideCls = f.side ? 'foe' : 'me';
  if (f.k === 'vs') {
    return fxShow('fxvs', `<div class="vswrap"><span class="pn me">${f.me || ''}${tyIco(f.me)}</span><em>VS</em><span class="pn foe">${f.foe || ''}${tyIco(f.foe)}</span></div>`, 1400);
  }
  if (f.k === 'in') {   // くりだした: ボールが開いて閃光→名前の帯
    return fxShow('fxin ' + sideCls, `<div class="inwrap"><i class="fball"></i><i class="burst"></i>
      <span class="spark s1"></span><span class="spark s2"></span><span class="spark s3"></span>
      <span class="spark s4"></span><span class="spark s5"></span><span class="spark s6"></span>
      <div class="tx">${f.name || ''}${tyIco(f.name)} をくりだした！</div></div>`, 1400);
  }
  if (f.k === 'swap') {   // 交代: ボールに戻して飛び去る→⇄→新しいボールが飛び込んで開く(2段)＋名前の帯
    return fxShow('fxswapfx ' + sideCls, `<div class="swwrap"><div class="stage">
      <i class="fball out"></i><i class="swspin">${SWAPMK}</i><i class="fball in"></i>
      <i class="burst"></i>
      <span class="spark s1"></span><span class="spark s2"></span><span class="spark s3"></span>
      <span class="spark s4"></span><span class="spark s5"></span><span class="spark s6"></span></div>
      <div class="tx">${f.name || ''}${tyIco(f.name)} に交代した！</div></div>`, 1700);
  }
  if (f.k === 'sp') {   // SP発動: タイプ色の斜め帯のカットイン＋着弾の揺れ
    const ja = D.typeJa[MOVE_TYPE[f.mv]] || '';
    const c = (window.typeColorOf && typeColorOf(ja)) || { top: '#43e0ff', mid: '#2b9fd8', bot: '#1b6fb0' };
    // SPカットインだけさらに30%遅く(1150→1495・2026-08-31タダシさん指示)
    const d = fxShow('fxsp ' + sideCls, `<div class="band" style="--fc1:${c.top};--fc2:${c.bot}">
      <span class="mvn">${f.mv || 'SPアタック'}</span></div><i class="flash"></i>`, 1495);
    if (f.shd) {
      // シールドでブロック: カットインに続けて六角形のドームを出す(防いだので着弾の揺れは無し)
      const delay = Math.min(Math.round(d * 0.55), Math.round(806 * FX_SLOW));
      setTimeout(() => fxOne({ k: 'shd', side: 1 - f.side }), delay);   // ドームは防いだ側
      return delay + Math.max(300, Math.round(950 * FX_SLOW / (RBV.speed || 1)));
    }
    setTimeout(fxQuake, Math.min(d * 0.62, Math.round(700 * FX_SLOW)));
    return d;
  }
  if (f.k === 'shd') {   // シールドのドーム(ゲームのブロック画面を六角形の光の面で再現)
    const hex = (cx, cy, r) => { const p = [];
      for (let a = 0; a < 6; a++) { const th = Math.PI / 3 * a + Math.PI / 6;
        p.push((cx + r * Math.cos(th)).toFixed(1) + ',' + (cy + r * Math.sin(th)).toFixed(1)); }
      return p.join(' '); };
    // 最下段の両端は置かない(2026-08-31タダシさん指示・ゲームのドームの丸みを再現)
    const cs = [[160, 84], [260, 84], [360, 84],
      [110, 171], [210, 171], [310, 171], [410, 171],
      [160, 258], [260, 258], [360, 258]];
    const polys = cs.map(([x, y], i) => `<polygon points="${hex(x, y, 56)}" style="animation-delay:${i * 33}ms"/>`).join('');
    return fxShow('fxshd ' + sideCls, `<div class="shwrap">
      <svg viewBox="0 0 520 330" aria-hidden="true"><defs>
        <linearGradient id="fxshg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d24bff"/><stop offset=".5" stop-color="#7b5cff"/><stop offset="1" stop-color="#38c7ff"/>
        </linearGradient></defs>${polys}</svg>
      <div class="shcap"><div class="tx">🛡 ブロック！</div></div></div>`, 950);
  }
  if (f.k === 'ko') {   // たおれた／たおした(2026-08-31タダシさん指示で強化)
    if (f.win) {
      // たおした: 白い閃光→二重の衝撃波リング→金の破片が飛び散る→💥がズドン＋画面の揺れ
      const d = fxShow('fxko win', `<div class="kowrap">
        <i class="kflash"></i><i class="kring r1"></i><i class="kring r2"></i>
        <span class="kshard k1"></span><span class="kshard k2"></span><span class="kshard k3"></span>
        <span class="kshard k4"></span><span class="kshard k5"></span><span class="kshard k6"></span>
        <span class="kshard k7"></span><span class="kshard k8"></span>
        <i class="mk">💥</i><div class="tx">${f.name || ''} をたおした！</div></div>`, 1550);
      setTimeout(fxQuake, Math.min(Math.round(d * 0.2), 600));
      return d;
    }
    // たおれた: 赤い被弾フラッシュ→画面が暗転→💀が傾きながら沈み、足元に土煙
    return fxShow('fxko lose', `<div class="kowrap">
      <i class="mk">💀</i>
      <span class="kdust d1"></span><span class="kdust d2"></span><span class="kdust d3"></span>
      <div class="tx">${f.name || ''} はたおれた…</div></div>`, 1550);
  }
  if (f.k === 'form') {   // フォルムチェンジ: 光の輪＋マーク
    return fxShow('fxform', `<div class="fmwrap"><i class="ring"></i><i class="mk">${f.mk || '✨'}</i><div class="tx">${f.name || ''}</div></div>`, 1910);
  }
  return 0;
}
// 演出の「再生済みキー」。決断(シールドの使う/受ける等)の直後は画面を作り直して
// 途中まで一気に表示するため、これが無いと質問で隠れていたSPの演出が飛んだり(取りこぼし)、
// 逆に同じ演出が二重に出たりする(2026-08-30タダシさん報告で追加)
const fxKey = el => el.dataset.gt + '|' + el.dataset.fx;
const fxPending = els => els.filter(e => e.dataset.fx && !RBV.fxDone.has(fxKey(e)));
// 今あらわれた要素の未再生の演出を返す。✨OFF・reduced-motionのときは再生済み扱いにして
// 空を返す(あとでONに切り替えたとき、たまっていたぶんがまとめて出ないように)
const fxConsume = els => {
  const list = fxPending(els);
  if (fxOk()) return list;
  list.forEach(e => RBV.fxDone.add(fxKey(e)));
  return [];
};
// data-fx を持つ要素の演出を順番に再生して、終わったら done()
function fxRun(list, done) {
  let i = 0;
  const step = () => {
    if (i >= list.length) { done(); return; }
    const el = list[i];
    RBV.fxDone.add(fxKey(el));
    let fs = [];
    try { fs = JSON.parse(el.dataset.fx); } catch (e) {}
    i++;
    if (!Array.isArray(fs)) fs = fs ? [fs] : [];
    let dur = 0;
    fs.forEach(f => { dur = Math.max(dur, fxOne(f)); });
    setTimeout(step, dur + 60);
  };
  step();
}
// data-fx属性のHTML(単引用符で囲むのでJSONの単引用符だけ実体参照にする)
const fxAttr = fx => fx && fx.length ? ` data-fx='${JSON.stringify(fx).replace(/'/g, '&#39;')}'` : '';
// タイムラインの1行(エンジンのsub行)から、SP発動とフォルムチェンジの演出を拾う
function fxOfRow(r) {
  const out = [];
  [0, 1].forEach(sd => {
    const e = r.ev[sd];
    if (!e || e.full === undefined) return;
    out.push({ k: 'sp', side: sd, mv: e.move, shd: !!e.shielded });
    if (e.gulpOn) out.push({ k: 'form', side: sd, mk: GULP_MK[e.gulpOn], name: `${GULP_JA[e.gulpOn]}のすがた` });
    if (e.gulp) out.push({ k: 'form', side: 1 - sd, mk: GULP_MK[e.gulp.form], name: '獲物を吐き出した！' });
  });
  return out.length ? out : null;
}
// 選び直したら、その決断より後ろの答えは消す(前提が変わるので、そこから先はおまかせに戻る)
function rbTrim(key) {
  const i = RBUI.order.indexOf(key);
  if (i < 0) return;
  RBUI.order.slice(i + 1).forEach(k => delete RB.ans[k]);
}
function rbAskTitle(p) {
  if (p.kind === 'lead') return SWAPMK + ' 開幕交代';
  if (p.kind === 'sp') return '⚡ SPアタック';
  if (p.kind === 'sh') return `🛡 ${p.mv || 'SPアタック'}が来る！`;
  if (p.kind === 'swap' || p.kind === 'msw') return SWAPMK + ' 交代する？';
  return '💀 次に出すのは？';
}
function rbAnsLabel(p, a) {
  if (!a) return '？';
  if (p.kind === 'sp') {
    if (a.a === 'auto') return '⭐ おまかせ';
    if (a.a === 'opt') return `⭐ ${D.moves[a.mv] ? D.moves[a.mv].n : a.mv}`;
    if (a.a === 'fire') return `▶ ${D.moves[a.mv] ? D.moves[a.mv].n : a.mv}`;
    if (a.a === 'wait') return `＋${a.n}`;
    return '撃たない';
  }
  // チップは種別アイコン(RB_ICON)と並べて出すので、ここでは🛡や⇄を重ねない
  if (p.kind === 'sh') return a.a === 'no' ? '受ける' : '使う';
  // 「場に出した」と「交代した」を言葉で区別する(2026-08-30タダシさん指示・GBL模擬戦とそろえる)
  if (p.kind === 'swap' || p.kind === 'lead' || p.kind === 'msw') {
    if (a.a === 'stay') return 'このまま';
    const nm = p.ctx.picks[a.to] ? shMark(p.ctx.picks[a.to].name) : '';
    if (p.kind === 'lead' || p.kind === 'msw') return `${nm}に交代した！`;
    if (a.a === 'toq') return `${nm}にすぐ交代した！`;
    const fm = p.ctx.fast && D.moves[p.ctx.fast];
    const n = fm ? Math.floor((p.ctx.foeEntry || 0) / (fm.tn || 1)) : 0;
    return `${fm && n ? `${fm.n}＋${n}のあと` : ''}${nm}に交代した！`;
  }
  return a.a === 'order' ? '順番どおり' : (p.ctx.picks[a.to] ? `${shMark(p.ctx.picks[a.to].name)}をくりだした！` : '');
}
const rbSameAns = (a, o) => !!a && a.a === o.a && a.mv === o.mv && a.n === o.n && a.to === o.to;
// ウッウのフォルム名。咥えた瞬間と、吐き出した瞬間をタイムラインに出す。
// マークは咥えている獲物: うのみ=サシカマス🐟 ／ まるのみ=ピカチュウ⚡(2026-08-20タダシさん指示)
const GULP_JA = { gulping: 'うのみ', gorging: 'まるのみ' };
const GULP_MK = { gulping: '🐟', gorging: '⚡' };
// 咥えた(gulpOn)／吐き出した(gulp)を、SPアタックを撃った側のセルに続けて出す。
// 吐き出しの能力ダウンは**撃った側が受ける**ので、そのセルの中では「相手」を付けずに書く
function gulpCell(e) {
  let h = '';
  if (e.gulpOn) h += `<span class="ev gulp">${GULP_MK[e.gulpOn]}${GULP_JA[e.gulpOn]}のすがた</span>`;
  if (e.gulp) h += `<span class="ev gulp spit">${GULP_MK[e.gulp.form]}${GULP_JA[e.gulp.form]}：反撃${
    e.gulp.dmg ? `<b class="dmg">-${e.gulp.dmg}</b>` : ''}${buffTag({ ...e.gulp.buff, target: 'self' })}</span>`;
  return h;
}
// 場を離れたら通常の姿に戻る(交代でリセット)。引き継ぎ状態からフォルムを落とす
const gulpOff = rs => { if (rs && rs.gulp) rs.gulp = null; };
// 能力変化のタグ(⬆⬇)。1段階ちょうど以外は段階数を添える
function buffTag(bf) {
  let out = '';
  for (let k = 0; k < 2; k++) {
    const d = Math.round((bf.to[k] - bf.from[k]) * 10) / 10;
    if (!d) continue;
    out += `<i class="bf ${d > 0 ? 'up' : 'dn'}">${bf.target === 'opponent' ? '相手' : ''}${'攻防'[k]}${d > 0 ? '⬆' : '⬇'}${Math.abs(d) === 1 ? '' : Math.abs(d)}</i>`;
  }
  return out;
}

function runRkBuild() {
  const body = document.querySelector('#rkteam .rkbody');
  const mine = [0, 1, 2].filter(i => PT[i]).map(i => PT[i]);
  const foes = [0, 1, 2].filter(i => RKT[i]).map(i => RKT[i]);
  updateUrl();
  renderRkDetail();   // 詳細パネル(開いていれば、枠の増減に追従する)
  clearInterval(RBV.timer); RBV.timer = null;
  if (!mine.length || !foes.length) {
    body.innerHTML = `<div class="mtnote">${!mine.length ? '<b>じぶん</b>' : ''}${!mine.length && !foes.length ? 'と' : ''}` +
      `${!foes.length ? '<b>あいて</b>' : ''}のポケモンを枠に入れてください（1匹ずつでもOK）</div>`;
    return;
  }
  // 入力(ポケモン・わざ・あいて等)が変わったら、前のバトルの選択と再生位置は仕切り直す
  const sig = JSON.stringify([mine, foes, rbMyMoves(), RK.kind, RK.enter, RK.stall, SIMOPT.buffMode, RK.leadSwap]);
  if (RBV.sig !== sig) {
    if (RBV.sig !== undefined) { RB.ans = {}; RBUI.open = null; RB.found = null; }
    RBV.sig = sig; RBV.started = false; RBV.cur = 0; RBV.playing = true;
  }
  const token = ++multiToken;
  const go = () => {
    if (token !== multiToken) return;
    const picks = rbPicksCached(mine, foes, RK.sh);
    const bt = rbPlay(picks, foes, RK.sh, RB.ans, RB.step);
    // 決着まで出ているときだけ、まとめ(わざ運の最悪)を添える。
    // あいてのわざが全部「自動(いちばんキツい)」なら主結果がそのまま最悪ケースなので出さない
    const anyFixed = foes.some(f => f.fast || f.c1);
    const extra = bt.pending || !anyFixed ? {} : { worst: rbPlay(picks, foes, RK.sh, RB.ans, false, true) };
    rbRender(body, bt, picks, foes, extra);
  };
  if (rbPicksHas(mine, foes, RK.sh)) go();
  else { body.innerHTML = '<div class="mtprog">計算中…</div>'; setTimeout(go, 0); }
}

function rbRender(body, bt, picks, foes, extra) {
  // わざ欄が「自動(いちばんキツい)」のあいては、候補の全わざを確率わざの判定に含める
  setProbTab(anyProbMove(picks.map(p => p.pol).concat(foes.map(f => {
    const pool = rkPool(f.key);
    return { charged: (f.fast ? [f.fast] : pool.fasts).concat(f.c1 ? [f.c1] : pool.chargeds) };
  }))));
  extra = extra || {};
  RBUI.pts = {}; RBUI.order = [];
  const regPt = p => { if (p) { RBUI.pts[p.key] = p; RBUI.order.push(p.key); } };
  bt.legs.forEach(leg => { regPt(leg.leadPt); (leg.points || []).forEach(regPt); regPt(leg.nextPoint); regPt(leg.pending); });

  // ---- タイムラインの項目(全ターン)と、ターンごとの状況(HUD用)を作る ----
  // items は時系列どおりに積む(gt=通しターン。表示はそこまで「再生」が進んだら出す)
  const items = [], frames = [];
  // 通しターンごとの「それまでのSPアタックの待ち時間」(RK_SP_TURNSの項)。
  // 経過時間の表示と交代クールタイムの残りは、この実時間で出す
  const spByGt = [];
  let spSeen = 0;
  const ckOf = gt => gt +
    (spByGt.length ? spByGt[Math.max(0, Math.min(gt, spByGt.length - 1))] : 0);
  let alive0 = picks.length, alive1 = foes.length;
  let sh0 = RK.sh, sh1 = rkShields();
  const shMax0 = RK.sh, shMax1 = rkShields();
  const evCell = list => list.map(e => {
    const b = e.buff ? buffTag(e.buff) : '';
    if (e.full !== undefined) return `<span class="ev sp">${mvChip(e.move, 13)}${
      e.shielded ? '' : `<b class="dmg">-${e.dmg}</b>`}${b}</span>${gulpCell(e)}`;
    return `<span class="ev">${mvChip(e.move, 12)}<b class="dmg">-${e.dmg}</b>${b}</span>`;
  }).join('');
  // 🛡ブロックのマークは**シールドを使った側**の列に出す(2026-08-20タダシさん指示。
  // 撃った側の列に出すと「どちらが使ったのか」がややこしく、使った側の列に何も出ない)
  const shdCell = oppList => oppList.filter(e => e.shielded)
    .map(e => `<span class="ev shd" title="相手の${e.move}をシールドで防ぎました(ダメージ1)"><i class="blk">🛡ブロック</i></span>`).join('');
  const chipItem = (p, gt) => ({ gt, html: `<div class="fc"><button class="fchip${p.auto ? ' auto' : ''}"
    data-k="${p.key}" title="タップすると、この場面からやり直せます">${RB_ICON[p.kind]}<b>${rbAnsLabel(p, p.ans)}</b></button></div>` });
  bt.legs.forEach(leg => {
    const res = leg.res, base = leg.base;
    while (spByGt.length <= base) spByGt.push(spSeen);
    // あいてのSPは実際に採用されたわざ(自動なら「いちばんキツい」と選ばれたもの)で出す
    const fsp = leg.foeMv ? leg.foeMv.sp : rktCfg(foes[leg.foeIdx]).throw;
    const meta = {
      name0: leg.meName, name1: leg.foeName,
      cp0: res.final[0].cp, cp1: res.final[1].cp,
      max0: res.final[0].hpMax, max1: res.final[1].hpMax,
      sp0: rbSpList(leg.pol).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      sp1: fsp ? [{ n: D.moves[fsp].n, e: D.moves[fsp].e }] : [],
      swOk: leg.swOk || 0,   // 交代が解禁される通しターン(残り秒は表示時に gt から計算)
    };
    let b0 = leg.hud.b0.slice(), b1 = leg.hud.b1.slice();
    let g0 = leg.hud.g0 || null, g1 = leg.hud.g1 || null;   // ウッウのフォルム(咥えているか)
    if (leg.leadPt) items.push(chipItem(leg.leadPt, base));
    // 演出(FX): 対面の頭に「バトル開始のVS」または「くりだした／交代した」を付ける。
    // 開幕交代はVSに続けて交代の演出を出す
    const pv = bt.legs[leg.li - 1] || null;
    const fxv = !pv ? [{ k: 'vs', me: leg.meName, foe: leg.foeName }]
      : [pv.meDown && { k: 'in', side: 0, name: leg.meName },
         pv.foeDown && { k: 'in', side: 1, name: leg.foeName },
         pv.swapped && { k: 'swap', side: 0, name: leg.meName }].filter(Boolean);
    if (!pv && leg.leadPt && leg.leadPt.ans && leg.leadPt.ans.a === 'to')
      fxv.push({ k: 'swap', side: 0, name: leg.meName });
    items.push({ gt: base, fx: fxv, html: `<div class="flg"><span class="me">${shMark(leg.meName)}${tyIco(leg.meName)}</span><em>VS</em><span class="foe">${shMark(leg.foeName)}${tyIco(leg.foeName)}</span></div>` });
    if (leg.leadHit) items.push({ gt: base, html: `<div class="ft"><div class="c me"></div><i class="tn">${base}</i>
      <div class="c foe">${evCell([{ move: leg.leadHit.mv, dmg: leg.leadHit.dmg }])}</div></div>` });
    frames[base] = { meta, hp0: leg.hud.hp0, en0: leg.hud.en0, hp1: leg.hud.hp1, en1: leg.hud.en1,
      b0: b0.slice(), b1: b1.slice(), g0, g1, sh0, sh1, alive0, alive1 };
    const ptAt = {};
    (leg.points || []).forEach(p => (ptAt[p.tn] = ptAt[p.tn] || []).push(p));
    // 決断待ちより先は「まだ起きていない」ので描かない。ただし同じターンの中でも
    // 「もう決まった出来事」は見せる＝出来事の単位で隠す。
    //   sp待ち: 質問はゲージが条件を満たした(=ノーマルが当たった)ターンに出るが、
    //           撃つ場合も発動は次の行動ターン。質問ターンの出来事はすべて確定なので全部見せる
    //           (隠すと「＋2で待った2発目」が見えず、打ったかどうか確認できない。実装時に踏んだ)
    //   sh待ち: 質問対象のあいてのSPから先を隠す(それより前のノーマルの応酬は決まっている)
    //   swap待ち: そのターンまで攻撃してから聞く仕様なので、ターンはすべて見せる
    const pend = leg.pending && leg.pending.kind !== 'next' ? leg.pending : null;
    rbTurns(res).forEach(t => {
      if (pend && t.tn > pend.tn) return;
      const gt = base + t.tn;
      const partial = pend && pend.kind === 'sh' && t.tn === pend.tn;
      // 出来事は**処理された順**のまま1行ずつ描く(2026-08-20タダシさん指示・GBL模擬戦と同じ)。
      // 同じターンにSPを撃ち合うとCMP(攻撃実数値×能力変化の高い側が先)で解決の先後が決まる
      let subs = t.sub;
      if (partial) {
        // sh待ち: 質問対象のあいてのSPが入った行から先は「まだ起きていない」ので隠す
        const k = subs.findIndex(r => r.ev[1] && r.ev[1].full !== undefined);
        if (k >= 0) subs = subs.slice(0, k);
      }
      // シールド・能力変化の追跡は「見せる出来事」だけに対して行う(仮の結果を混ぜない)
      for (const r of subs) for (let i = 0; i < 2; i++) {
        const e = r.ev[i];
        if (!e) continue;
        // SPアタック1発ぶんの待ち時間(じぶん9秒／あいて5秒・シールドで防ぐと7秒)
        if (e.full !== undefined)
          spSeen += i === 0 ? RK_SP_TURNS.me : (e.shielded ? RK_SP_TURNS.foeShd : RK_SP_TURNS.foe);
        if (e.shielded) { if (i === 0) sh1--; else sh0--; }
        if (e.buff) { const tgt = e.buff.target === 'opponent' ? 1 - i : i;
          if (tgt === 0) b0 = e.buff.to.slice(); else b1 = e.buff.to.slice(); }
        // ウッウ: 咥えた(撃った側)／吐き出した(受けた側が通常の姿に戻り、撃った側の能力が下がる)
        if (e.gulpOn) { if (i === 0) g0 = e.gulpOn; else g1 = e.gulpOn; }
        if (e.gulp) {
          if (i === 0) { g1 = null; b0 = e.gulp.buff.to.slice(); }
          else { g0 = null; b1 = e.gulp.buff.to.slice(); }
        }
      }
      while (spByGt.length <= gt) spByGt.push(spSeen);
      spByGt[gt] = spSeen;
      if (!partial) {
        frames[gt] = { meta, hp0: t.state[0].hp, en0: t.state[0].en, hp1: t.state[1].hp, en1: t.state[1].en,
          b0: b0.slice(), b1: b1.slice(), g0, g1, sh0, sh1, alive0, alive1 };
      } else {
        // 決断待ちのターンのHUDは、前のターンのHP・ゲージのまま(結果はまだ決まっていない)
        const pf = frames[gt - 1] || frames[base];
        frames[gt] = { meta, hp0: pf.hp0, en0: pf.en0, hp1: pf.hp1, en1: pf.en1,
          b0: b0.slice(), b1: b1.slice(), g0, g1, sh0, sh1, alive0, alive1 };
      }
      // ロケット団: あいてが硬直で1歩も動かないターンは⏸を出す(最初の行の右列)
      let stallMark = t.stalled && !t.ev[1].length ? '<i class="stall">⏸</i>' : '';
      let first = true;
      for (const r of subs) {
        const e0 = evCell(r.ev[0] ? [r.ev[0]] : []) + shdCell(r.ev[1] ? [r.ev[1]] : []);
        const e1 = evCell(r.ev[1] ? [r.ev[1]] : []) + shdCell(r.ev[0] ? [r.ev[0]] : []) + (first ? stallMark : '');
        if (!e0 && !e1) continue;
        items.push({ gt, fx: fxOfRow(r), html: `<div class="ft"><div class="c me">${e0}</div><i class="tn">${first ? gt : ''}</i><div class="c foe">${e1}</div></div>` });
        first = false;
      }
      if (first) items.push({ gt, html: stallMark
        ? `<div class="ft"><div class="c me"></div><i class="tn">${gt}</i><div class="c foe">${stallMark}</div></div>`
        : `<div class="ft q"><i class="tn">${gt}</i></div>` });
      (ptAt[t.tn] || []).forEach(p => items.push(chipItem(p, gt)));
    });
    const endGt = base + res.turns;
    // 決断待ちのあいだは倒れたかどうかもまだ決まっていない(仮の結果)ので出さない
    if (!pend) {
      if (leg.foeDown) { alive1--; items.push({ gt: endGt, fx: [{ k: 'ko', win: true, name: leg.foeName }],
        html: `<div class="fko win">💥 ${leg.foeName} をたおした！<i>⏱${rbSec(ckOf(endGt))}</i></div>` }); }
      if (leg.meDown) { alive0--; items.push({ gt: endGt, fx: [{ k: 'ko', name: leg.meName }],
        html: `<div class="fko lose">💀 ${leg.meName} はたおれた</div>` }); }
      if (leg.meDown || leg.foeDown) {
        const f = frames[endGt] || frames[endGt - 1];
        if (f) frames[endGt] = { ...f, alive0, alive1 };
      }
    }
    if (leg.nextPoint) items.push(chipItem(leg.nextPoint, endGt));
  });
  // 開幕交代の質問中はまだ対面が無いので、1匹目とあいて1匹目の初期状態を出しておく
  if (!bt.legs.length && bt.pending && foes.length) {
    const F = rktCfg(foes[0]);
    const sA = PvpEngine.buildStats(D, picks[0].base), sF = PvpEngine.buildStats(D, F);
    items.push({ gt: 0, html: `<div class="flg"><span class="me">${shMark(picks[0].name)}${tyIco(picks[0].name)}</span><em>VS</em><span class="foe">${shMark(rktName(foes[0]))}${tyIco(rktName(foes[0]))}</span></div>` });
    frames[0] = { meta: { name0: picks[0].name, name1: rktName(foes[0]), cp0: sA.cp, cp1: sF.cp, max0: sA.hp, max1: sF.hp,
      sp0: rbSpList(picks[0].pol).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      sp1: F.throw ? [{ n: D.moves[F.throw].n, e: D.moves[F.throw].e }] : [] },
      hp0: sA.hp, en0: 0, hp1: sF.hp, en1: 0, b0: [0, 0], b1: [0, 0], sh0, sh1, alive0, alive1 };
  }
  const stop = bt.pending ? bt.pending.gt : bt.turns;
  for (let g = 1; g <= stop; g++) if (!frames[g]) frames[g] = frames[g - 1];
  // 決着のまとめ(再生が最後まで来たら出る)
  if (!bt.pending) {
    const o = RK_OUTCOME[bt.outcome];
    const wo = extra.worst && RK_OUTCOME[extra.worst.outcome];
    items.push({ gt: stop, html: `<div class="rbfin">
      <div class="rkverdict ${o.cls}">${o.mark} ${o.txt}
        <small>じぶん ${bt.meLeft}/${bt.nMe} ／ あいて ${bt.foeLeft}/${bt.nFoe} ・ ⏱<b>${rbSec(bt.clock != null ? bt.clock : bt.turns)}</b>秒 ・ 🛡${bt.myShLeft}／${bt.foeShLeft}</small></div>
      ${!wo ? '' : `<div class="rkworst ${wo.cls === 'win' ? 'ok' : 'ng'}"
        title="あいてが対面ごとに、こちらにいちばんキツいわざを打ってきた場合">
        🎲 わざ運が最悪でも <b>${wo.txt}</b>
        <small>じぶん${extra.worst.meLeft}/${extra.worst.nMe} ／ あいて${extra.worst.foeLeft}/${extra.worst.nFoe} ・ ⏱${rbSec(extra.worst.clock != null ? extra.worst.clock : extra.worst.turns)}秒</small></div>`}
    </div>` });
  }

  // ---- 画面を組む ----
  body.innerHTML = `<div class="rbctlbar">
      <div class="rbctl">
        <div class="rbrow1 rbfind"><span class="lbl">🔎 オートバトル</span>
          ${Object.keys(RB_GOAL).map(g => `<button class="rbgo" data-g="${g}" aria-pressed="${RB.goal === g}" title="${RB_GOAL[g].tip}（押して選んでから ▶ バトルスタート！で開始）">${RB_GOAL[g].label}</button>`).join('')}
          ${RB.step ? `<button class="rbclear" style="display:${RBV.started || rbAnsCount() ? '' : 'none'}" title="選んだ手を消して、もう一度はじめからバトルします">▶ バトルスタート！</button>`
            : (rbAnsCount() ? '<button class="rbclear" title="選んだ手をすべて消して、全部おまかせに戻します">選び直す</button>' : '')}
        </div>
        ${RB.found ? `<div class="rbfound">${RB.found}</div>` : ''}
      </div>
      <button class="rbonly" aria-pressed="${!RB.step}" title="バトルを流さず、結果を一気に出します。もう一度押すとバトル表示に戻ります">結果だけ見る</button>
    </div>
    <div class="rbfeed">${items.map(x => `<div class="fi future" data-gt="${x.gt}"${fxAttr(x.fx)}>${x.html}</div>`).join('')}</div>
    <div class="rbdock">
      <div class="rbwinbox"></div>
      <div class="rbhud">
        <div class="hs me"><div class="hn"><span class="nm"></span><b class="cp"></b><b class="hpn"></b></div>
          <div class="hb"><em></em><i></i></div>
          <div class="hx"><span class="balls"></span><span class="shds"></span><span class="gqg"><span class="gqs"></span><b class="gqn" title="いまのゲージ量(100でまんたん)"></b></span><span class="bfs"></span></div>
          <div class="hswap" title="次に交代できるまでの残り時間（一度交代すると45秒間は次の交代ができません）"></div>
        </div>
        <div class="hm"><b class="clk">0.0</b><i class="trn">0T</i>
          <div class="hctl">${RB.step ? `<button class="hmsw" disabled title="いつでも交代できるボタンです（押すと控えを選べます。一度交代すると45秒間は次の交代ができません）">${SWAPMK}<b>交代</b></button><button class="hplay" title="一時停止／再生">⏸</button><button class="hspd" title="再生の速さ">×${RBV.speed}</button><button class="hstep" title="1ターンだけ進める（⏸で止めて、相手のわざの周期を見ながら交代するときに）">⏭</button><button class="hskip" title="次の決断まで飛ばす">⏩</button><button class="hstop" title="もう一度バトルスタート！（選んだ手は消えます）">⏹</button><button class="hfx" aria-pressed="${FX.on}" title="くりだし・SP発動などの演出のON/OFF（演出のあいだ再生は止まりますが、バトルの結果には影響しません）">✨</button>` : ''}</div>
        </div>
        <div class="hs foe"><div class="hn"><b class="hpn"></b><b class="cp"></b><span class="nm"></span></div>
          <div class="hb"><em></em><i></i></div>
          <div class="hx"><span class="balls"></span><span class="shds"></span><span class="gqg"><span class="gqs"></span><b class="gqn" title="いまのゲージ量(100でまんたん)"></b></span><span class="bfs"></span></div>
        </div>
      </div>
    </div>`;

  // ---- 再生(1ターン=0.5秒で流す)と HUD の更新 ----
  const feedEl = body.querySelector('.rbfeed');
  const els = [...feedEl.children];
  // HUDは最初から画面のいちばん下に固定する(2026-09-01タダシさん案)。
  // HUD(sticky)はタイムラインが画面の高さに満たないあいだ、行が増えるたびに下へ押されて動く=
  // ⇄や⏸が押せない。フィードに画面ぶんの最低の高さを与えれば、HUDは最初から下に張りつき、
  // 行は従来どおり上から流れてすき間が埋まっていく(1手ずつの再生モードのときだけ)
  if (RB.step) {
    const dockEl = body.querySelector('.rbdock');
    feedEl.style.minHeight = Math.max(220, innerHeight - (dockEl ? dockEl.offsetHeight : 120) - 24) + 'px';
  }
  const dock = body.querySelector('.rbdock');
  const winbox = dock.querySelector('.rbwinbox');
  const hud = dock.querySelector('.rbhud');
  const sideRefs = side => {
    const el = hud.querySelector('.hs.' + side);
    return { nm: el.querySelector('.nm'), cp: el.querySelector('.cp'), bar: el.querySelector('.hb i'),
      ghost: el.querySelector('.hb em'),
      hpn: el.querySelector('.hpn'),
      balls: el.querySelector('.balls'), shds: el.querySelector('.shds'),
      gqs: el.querySelector('.gqs'), gqn: el.querySelector('.gqn'), bfs: el.querySelector('.bfs') };
  };
  const R0 = sideRefs('me'), R1 = sideRefs('foe');
  const clk = hud.querySelector('.clk'), trn = hud.querySelector('.trn');
  const swapEl = hud.querySelector('.hs.me .hswap');   // 交代タイマー(じぶん側だけ)
  const mswBtn = hud.querySelector('.hmsw');           // ⇄いつでも交代(再生コントロールの並び)
  let ptr = 0, lastEl = null, curLegKey = '';
  function updateHud(gt) {
    const f = frames[Math.max(0, Math.min(gt, stop))];
    if (!f) return;
    const legKey = f.meta.name0 + '|' + f.meta.name1;
    if (legKey !== curLegKey) {   // 対面が変わったときだけ名前・CP・ゲージの器を作り直す
      curLegKey = legKey;
      [[R0, f.meta.name0, f.meta.cp0, f.meta.sp0], [R1, f.meta.name1, f.meta.cp1, f.meta.sp1]].forEach(([Rf, nm, cp, sps]) => {
        // 下のフレームは幅が狭いので「シャドウ○○」は「S○○」に縮める(ロケット団はほぼ全部シャドウ)
        Rf.nm.textContent = nm.replace(/^シャドウ/, 'S');
        Rf.nm.title = nm;
        Rf.cp.textContent = 'CP' + cp;
        Rf.gqs.innerHTML = sps.map(m => `<span class="gq" data-e="${m.e}" title="${m.n}（ゲージ${m.e}）"><i>${typeIconHTML(D.typeJa[MOVE_TYPE[m.n]] || '', 13)}</i><b></b></span>`).join('');
      });
    }
    const set = (Rf, hp, max, en, sh, shMax, alive, total, b, g) => {
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      // HPが1でも残っているうちはバーを空に見せない(残りわずかでも「まだ倒せていない」と分かるように)
      const w = hp > 0 ? Math.max(pct, 4) : 0;
      Rf.bar.style.width = w + '%';
      hpGhost(Rf.ghost, w);   // 白い残像がゆっくり追いかけて「減った量」を見せる
      const cls = pct > 50 ? 'g' : pct > 20 ? 'y' : 'r';
      Rf.bar.className = cls;
      // バーだけでは残りわずかが読み取れないので、実数値も出す(色はバーと同じ基準)
      Rf.hpn.textContent = hp + '/' + max;
      if (Rf.gqn) Rf.gqn.textContent = Math.floor(en);   // ゲージ残量を数字で大きく(2026-08-20タダシさん指示)
      Rf.hpn.className = 'hpn ' + cls;
      Rf.balls.innerHTML = Array.from({ length: total }, (_, i) => `<i class="pb${i < alive ? '' : ' off'}"></i>`).join('');
      Rf.shds.innerHTML = Array.from({ length: shMax }, (_, i) => `<i class="shd${i < sh ? '' : ' off'}">🛡</i>`).join('');
      Rf.bfs.innerHTML = (g ? `<i class="bf gulp" title="${GULP_JA[g]}のすがた（相手のSPアタックを受けると吐き出します）">${GULP_MK[g]}${GULP_JA[g]}</i>` : '') +
        [0, 1].map(k => !b[k] ? '' :
        `<i class="bf ${b[k] > 0 ? 'up' : 'dn'}">${'攻防'[k]}${b[k] > 0 ? '⬆' : '⬇'}${Math.abs(b[k]) === 1 ? '' : Math.abs(b[k])}</i>`).join('');
      // SPゲージ: 1周=1発ぶん。2周目・3周目は色を変えて重ね、数字は「いま撃てる発数」
      // (グロウパンチ35なら最大2.86周。何発ぶん溜まっているかが一目で分かるように)
      Rf.gqs.querySelectorAll('.gq').forEach(g => {
        const e = +g.dataset.e;
        const laps = Math.floor(en / e);                       // 撃てる発数
        const prog = (en - laps * e) / e * 100;                // いまの周の溜まり具合
        const cur = cols[Math.min(laps, cols.length - 1)];
        const below = laps > 0 ? cols[Math.min(laps - 1, cols.length - 1)] : 'rgba(255,255,255,.09)';
        g.style.background = `conic-gradient(${cur} ${prog}%, ${below} 0)`;
        g.style.setProperty('--gqc', laps > 0 ? below : cur);
        g.classList.toggle('on', laps >= 1);
        g.querySelector('b').textContent = laps >= 1 ? laps : '';
      });
    };
    const GQC_ME = ['#43e0ff', '#ffd54a', '#ff6b81'], GQC_FOE = ['#ffd54a', '#ff6b81', '#b06cff'];
    let cols = GQC_ME;
    set(R0, f.hp0, f.meta.max0, f.en0, f.sh0, shMax0, f.alive0, picks.length, f.b0, f.g0);
    cols = GQC_FOE;
    set(R1, f.hp1, f.meta.max1, f.en1, f.sh1, shMax1, f.alive1, foes.length, f.b1, f.g1);
    clk.textContent = rbSec(ckOf(gt));   // SPアタックの待ち時間を含む実時間
    trn.textContent = gt + 'T';
    // ⇄いつでも交代は hctl(位置が動かない再生コントロールの並び)のボタンで受ける
    // (2026-09-01タダシさん指摘: HUDの左右は数字の更新で常に動くので押せない)。
    // じぶん側のここは従来どおり残り時間の表示だけ
    const swLeft = Math.max(0, (f.meta.swOk || 0) - ckOf(gt));
    swapEl.innerHTML = swLeft > 0 ? `${SWAPMK}<b>${Math.ceil(swLeft / 2)}</b><small>秒</small>` : '';
    if (mswBtn) {
      const canSwap = RB.step && RBV.started && f.alive0 > 1 && swLeft <= 0 && gt < stop;
      mswBtn.disabled = !canSwap;
      mswBtn.classList.toggle('rdy', canSwap);
    }
  }
  const revealTo = g => {
    const out = [];   // 今あらわれた要素(演出の判定に使う)
    while (ptr < els.length && +els[ptr].dataset.gt <= g) {
      els[ptr].classList.remove('future'); els[ptr].classList.add('in');
      lastEl = els[ptr]; out.push(els[ptr]); ptr++;
    }
    return out;
  };
  const autoScroll = () => {
    if (!lastEl) return;
    const target = lastEl.getBoundingClientRect().bottom + scrollY - (innerHeight - dock.offsetHeight - 10);
    // 手で上へスクロールして読み返しているときは連れ戻さない
    if (target > scrollY && target - scrollY < innerHeight * 1.5)
      scrollTo({ top: target, behavior: RBV.speed === 1 ? 'smooth' : 'auto' });
  };
  const stopTimer = () => { clearInterval(RBV.timer); RBV.timer = null; };
  const ended = () => RBV.cur >= stop && !bt.pending;
  const setPlayBtn = () => {
    const b = hud.querySelector('.hplay');
    if (b) b.textContent = ended() ? '↻' : RBV.timer ? '⏸' : '▶';
  };
  function showWin(p, editing, det) {
    RBV.playing = !editing && RBV.playing;
    stopTimer(); setPlayBtn();
    // GBL模擬戦と同じ作り(2026-08-23反映): わざごとのフレーム(grp)＋「…詳細」(det)で＋1〜＋3を畳む
    const hasDet = p.opts.some(o => o.det);
    const btn = ({ o, i }) => `<button class="${o.cls || ''}${rbSameAns(p.ans, o) ? ' on' : ''}"
        data-k="${p.key}" data-i="${i}" title="${o.tip || ''}">${o.label}</button>`;
    const groups = [], rest = [];
    p.opts.forEach((o, i) => {
      if (o.grp) {
        let g = groups.find(x => x.grp === o.grp);
        if (!g) { g = { grp: o.grp, head: '', items: [] }; groups.push(g); }
        if (o.head) g.head = o.head;
        g.items.push({ o, i });
      } else rest.push({ o, i });
    });
    // ロケット団は「撃たない」が先頭(det無しのrestの先頭に来る)。フレームはそのあと
    const lead = rest.filter(x => !x.o.det && x.o.a === 'hold');
    const tail = rest.filter(x => !(x.o.a === 'hold' && !x.o.det));
    // SPが2本あるときは実際の戦闘画面と同じ横並び(2026-08-31タダシさん指示・左右どちらを撃つかの形)
    // シールドの質問は実際のゲーム画面を再現(2026-08-31タダシさん指示・GBLと同じ形)
    const shWin = () => {
      const iUse = p.opts.findIndex(o => o.a === 'use'), iNo = p.opts.findIndex(o => o.a === 'no');
      const fr = frames[Math.max(0, (p.gt || 1) - 1)] || frames[p.gt] || {};
      const left = Math.max(1, fr.sh0 || 1);
      return `<div class="shwin">
        <button class="shuse" data-i="${iUse}" title="${p.opts[iUse].tip}">${shieldSvg()}<i class="shx">×${left}</i></button>
        <button class="shlater" data-i="${iNo}" title="${p.opts[iNo].tip}">あとで</button>
      </div>`;
    };
    const btns = (p.kind === 'sh' ? shWin()
      : lead.map(btn).join('')
      + (groups.length ? `<div class="mvrow">${groups.map(g => `<div class="mvopt"><div class="mh">${g.head}</div><div class="mb">${g.items.map(btn).join('')}</div></div>`).join('')}</div>` : '')
      + tail.filter(x => det || !x.o.det).map(btn).join('')
      + (hasDet && !det ? '<button class="hold wdet" title="ノーマルアタックを＋1〜＋3発はさむ細かい指定を出します">…詳細</button>' : ''))
      + (editing && p.ans && !p.auto ? `<button class="hold" data-k="${p.key}" data-i="reset" title="この場面をおまかせに戻します">↺</button>` : '');
    winbox.innerHTML = `<div class="rbwin">
      <div class="rwt">${rbAskTitle(p)}<span>${p.gt}T ⏱${rbSec(ckOf(p.gt))}</span>${editing ? '<button class="wx" title="閉じる">✕</button>' : ''}</div>
      <div class="rwb">${btns}</div></div>`;
    winbox.querySelectorAll('.rwb button').forEach(b => {
      if (b.classList.contains('wdet')) { b.onclick = () => showWin(p, editing, true); return; }
      b.onclick = () => {
        rbTrim(p.key);
        if (b.dataset.i === 'reset') delete RB.ans[p.key];
        else RB.ans[p.key] = { ...p.opts[+b.dataset.i] };
        RBUI.open = null; RBV.playing = true;
        run();
      };
    });
    const wx = winbox.querySelector('.wx');
    if (wx) wx.onclick = () => { RBUI.open = null; RBV.playing = true; run(); };
    // ウィンドウが出たぶん画面下が高くなるので、最新のターンが隠れないように追従する
    autoScroll();
  }
  function atStop() {
    stopTimer();
    if (bt.pending) showWin(bt.pending, false);
    else RBV.playing = false;
    setPlayBtn();
  }
  function tick() {
    if (!document.body.contains(feedEl)) { stopTimer(); return; }
    RBV.cur++;
    const rev = revealTo(RBV.cur);
    updateHud(RBV.cur);
    autoScroll();
    // 演出(FX): 今あらわれた行に未再生のdata-fxがあれば、再生を止めてカットインを見せてから続ける
    // (停滞するのは見せる側だけで、バトルのターン・⏱には影響しない)
    const fxEls = fxConsume(rev);
    if (fxEls.length) {
      stopTimer();
      fxRun(fxEls, () => {
        if (!document.body.contains(feedEl)) return;
        if (RBV.cur >= stop) atStop();
        else if (RBV.playing) startTimer();
        else setPlayBtn();
      });
      return;
    }
    if (RBV.cur >= stop) atStop();
  }
  const startTimer = () => { stopTimer(); RBV.timer = setInterval(tick, 500 / RBV.speed); setPlayBtn(); };

  // ---- 操作の配線 ----
  // 「結果だけ見る」: バトルを流さず一気に表示。もう一度押すとバトル表示へ戻る
  const only = body.querySelector('.rbonly');
  if (only) only.onclick = () => {
    RB.step = !RB.step;
    RBV.cur = RB.step ? 0 : 1e9; RBV.playing = true; RBUI.open = null;
    run();
  };
  const restart = () => {
    RB.ans = {}; RBUI.open = null; RB.found = null;
    RBV.cur = 0; RBV.playing = true;
    if (RB.step) RBV.started = true;   // そのまま新しいバトルが最初から始まる
    if (RB.step && RB.goal) { applyGoal(); return; }   // オートバトルを選んでいれば探索してから再生
    run();
  };
  const clr = body.querySelector('.rbclear');
  if (clr) clr.onclick = restart;
  // 手順の自動探索: 見つかった手順をそのまま決断の答えに入れて、バトルで再生する
  // 最速/安定は「押して選んでおく」だけ。▶ バトルスタート！を押したときに探索して再生する
  body.querySelectorAll('.rbgo').forEach(b => b.onclick = () => {
    const g = b.dataset.g;
    RB.goal = RB.goal === g ? null : g;
    body.querySelectorAll('.rbgo').forEach(x => x.setAttribute('aria-pressed', x.dataset.g === RB.goal));
  });
  const mine2 = () => [0, 1, 2].filter(i => PT[i]).map(i => PT[i]);
  // 選んでおいたオートバトル(最速/安定)の手順をさがして、そのまま再生する
  const applyGoal = () => {
    const r = rbFind(rbPicksCached(mine2(), foes, RK.sh), foes, RK.sh, RB.goal);
    if (!r) { RB.found = '手順が見つかりませんでした。'; run(); return; }
    RB.ans = r.ans; RBUI.open = null;
    const o2 = RK_OUTCOME[r.bt.outcome];
    RB.found = `🔎 ${RB_GOAL[RB.goal].label} → <b class="${o2.cls === 'win' ? 'ok' : 'ng'}">${o2.txt}</b>` +
      `　⏱<b>${rbSec(r.bt.clock != null ? r.bt.clock : r.bt.turns)}</b>秒　じぶん ${r.bt.meLeft}/${r.bt.nMe}`;
    RBV.cur = 0; RBV.playing = true; RBV.started = true;
    run();
  };
  // 決めた場面のチップ → その場面からやり直す
  feedEl.querySelectorAll('.fchip').forEach(b => b.onclick = () => {
    const p = RBUI.pts[b.dataset.k];
    if (!p) return;
    RBUI.open = p.key; RBV.cur = p.gt;
    run();
  });
  // HUDの再生コントロール
  const hplay = hud.querySelector('.hplay'), hspd = hud.querySelector('.hspd'), hskip = hud.querySelector('.hskip');
  const startBattle = () => {
    RBV.started = true; RBV.playing = true;
    if (RB.goal) { applyGoal(); return; }   // オートバトルを選んでいれば探索してから再生
    winbox.innerHTML = '';
    if (clr) clr.style.display = '';   // 走り出したら上にも「▶ バトルスタート！」(やり直し)を出す
    // スタートの瞬間に、すでに見えている開幕(VS・開幕交代)の演出を見せてから再生を始める
    // (2026-08-31タダシさん報告: ここで見せないと最初の決断のあとまで遅れて出ていた)
    RBV.fxDone.clear();
    const fx0 = fxConsume(els.slice(0, ptr));
    const go = () => {
      if (!document.body.contains(feedEl)) return;
      if (RBV.cur >= stop) atStop();     // 開幕交代など、最初の決断が0ターン目ならすぐ聞く
      else if (RBV.playing) startTimer();
    };
    if (fx0.length) fxRun(fx0, go); else go();
  };
  if (hplay) hplay.onclick = () => {
    if (!RBV.started) { startBattle(); return; }
    if (ended()) { RBV.cur = 0; RBV.playing = true; run(); return; }   // ↻ 最初から再生
    if (RBV.cur >= stop) return;   // 決断待ちのあいだは選択がすべて
    if (RBV.timer) { RBV.playing = false; stopTimer(); } else { RBV.playing = true; startTimer(); }
    setPlayBtn();
  };
  if (hspd) hspd.onclick = () => {
    RBV.speed = RBV.speed === 1 ? 2 : RBV.speed === 2 ? 4 : 1;
    hspd.textContent = '×' + RBV.speed;
    if (RBV.timer) startTimer();
  };
  if (hskip) hskip.onclick = () => {
    RBV.started = true;
    // ⏩で飛ばした演出は再生済み扱いにする(あとでまとめて再生されないように)
    revealTo(stop).forEach(e => { if (e.dataset.fx) RBV.fxDone.add(fxKey(e)); });
    RBV.cur = stop; updateHud(stop); autoScroll();
    if (RBV.timer || bt.pending) atStop(); else { RBV.playing = false; setPlayBtn(); }
  };
  const hstop = hud.querySelector('.hstop');
  if (hstop) hstop.onclick = restart;
  const hfx = hud.querySelector('.hfx');
  if (hfx) hfx.onclick = () => {
    FX.on = !FX.on; fxSave();
    hfx.setAttribute('aria-pressed', FX.on);
  };
  // ⏭ 1ターン送り(2026-09-01タダシさん指示・GBLと同じ)
  const hstep = hud.querySelector('.hstep');
  if (hstep) hstep.onclick = () => {
    if (!RBV.started || ended()) return;
    stopTimer(); RBV.playing = false;
    if (RBV.cur < stop) tick();
    setPlayBtn();
  };
  // HUDの⇄ボタン=いつでも交代(2026-09-01タダシさん指示・GBLと同じ。キーの形だけロケット団版)
  const manualSwap = () => {
    if (!RB.step || !RBV.started || ended()) return;
    const gt = RBV.cur;
    if (bt.pending && gt >= stop) return;
    let li = bt.legs.findIndex(l => gt < l.base + l.res.turns);
    if (li < 0) li = bt.legs.length - 1;
    const leg = bt.legs[li]; if (!leg) return;
    const dead = new Set(); bt.legs.slice(0, li).forEach(l => { if (l.meDown) dead.add(l.myIdx); });
    const bench = picks.map((_, k) => k).filter(k => k !== leg.myIdx && !dead.has(k));
    if (!bench.length) return;
    const tn = Math.max(1, gt - leg.base);
    stopTimer(); RBV.playing = false; setPlayBtn();
    winbox.innerHTML = `<div class="rbwin"><div class="rwt">${SWAPMK} 交代する？<span>${gt}T ⏱${rbSec(ckOf(gt))}</span><button class="wx" title="やめて再生に戻る">✕</button></div>
      <div class="rwb">${bench.map(k => `<button class="fire" data-to="${k}" title="このポケモンに交代します(あいては4.5秒動けませんが、じぶんも0.5秒動けません・次の交代は45秒後)">${SWAPMK} ${shMark(picks[k].name)}${tyIco(picks[k].name)}</button>`).join('')}
      <button class="hold mswx">やめる</button></div></div>`;
    const key = rbKey(li, 'msw', tn, 0);
    winbox.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
      Object.keys(RB.ans).forEach(k2 => {
        const pt2 = RBUI.pts[k2];
        if ((pt2 && pt2.gt > gt) || (!pt2 && +k2.split(':')[0] > li) || k2.indexOf(li + ':msw:') === 0)
          delete RB.ans[k2];
      });
      RB.ans[key] = { a: 'toq', to: +b.dataset.to };
      RBUI.open = null; RBV.playing = true;
      run();
    });
    const cancel = () => { winbox.innerHTML = ''; RBV.playing = true; startTimer(); };
    winbox.querySelector('.mswx').onclick = cancel;
    winbox.querySelector('.wx').onclick = cancel;
  };
  if (mswBtn) mswBtn.onclick = manualSwap;

  // ---- 初期表示(再生の途中状態を引き継ぐ) ----
  RBV.cur = Math.max(0, Math.min(RBV.cur, stop));
  if (!RB.step) RBV.cur = stop;   // 結果だけ: 最後まで一気に出す
  if (RB.step && !RBV.started) {
    // まだスタートしていない: VSカードと両者の状態だけ見せて、スタートボタンを待つ
    RBV.cur = 0;
    revealTo(0);
    updateHud(0);
    winbox.innerHTML = '<button class="rbstart">▶ バトルスタート！</button>';
    winbox.querySelector('.rbstart').onclick = startBattle;
    setPlayBtn();
    return;
  }
  if (RBV.cur === 0) RBV.fxDone.clear();   // 最初からの再生(スタート・↻)は演出も最初から
  const rev0 = revealTo(RBV.cur);
  updateHud(RBV.cur);
  if (RBUI.open && RBUI.pts[RBUI.open]) showWin(RBUI.pts[RBUI.open], true);
  else if (RBV.cur >= stop) {
    // 同じターンに次の質問が続く場合も、隠れていた演出を見せてから止まる
    const fxS = RB.step ? fxConsume(rev0) : [];
    if (fxS.length) fxRun(fxS, () => { if (document.body.contains(feedEl)) atStop(); });
    else atStop();
  }
  else if (RB.step && RBV.playing) {
    // まだ再生していない演出(バトルスタート直後のVS・決断で隠れていたSPや交代など)を
    // 見せてから再生を始める。fxDoneのおかげで再生済みの演出は二重に出ない
    const fx0 = fxConsume(rev0);
    if (fx0.length) fxRun(fx0, () => { if (document.body.contains(feedEl) && RBV.playing) startTimer(); });
    else startTimer();
  }
  setPlayBtn();
}

// ==================================================================
// ---- 対戦記録(mode 'blog'): 戦った相手を記録して「自分の土俵の環境」を分析する(2026-08-27タダシさん指示) ----
// ツールの環境リストは全体像で、採用率はレート帯によってけっこう違う。
// 記録した相手はそのまま「マイ環境」のカップになり、環境一覧・対策さがし・パーティ診断でも使える(答えの二重管理をしない)
const BLOG_KEY = 'gbl_battlelog';
let BLOG = [];
try { const v = JSON.parse(localStorage.getItem(BLOG_KEY)); if (Array.isArray(v)) BLOG = v; } catch (e) {}
const saveBlog = () => { try { localStorage.setItem(BLOG_KEY, JSON.stringify(BLOG)); } catch (e) {} };
const BLE = { foes: [null, null, null], win: null };              // 入力中(未保存)の1戦ぶん
const BLV = { view: 'rate', period: 'all', del: null, token: 0 }; // 表示の状態(端末に保存しない=毎回まっさら)
const BL_LGN = { 1500: 'スーパー', 2500: 'ハイパー', 0: 'マスター' };
const blName = f => (f.s ? 'シャドウ' : '') + (D.pokemon[f.k] ? D.pokemon[f.k].n : f.k);
const blRecs = cap0 => BLOG.filter(r => r.cap === (cap0 != null ? cap0 : cap));
const blUse = recs => BLV.period === 'all' ? recs : recs.slice(-parseInt(BLV.period));

// そのポケモンの定番わざ構成(環境の確定値 → 載っていなければ効率の叩き台)。
// マイ環境カップの行と「刺さるポケモン」の両方がこれを使う(前提をそろえる)
function blMovesOf(k, s, cap0) {
  const src = ((window.META_LISTS || {})[String(cap0)] || []).concat((window.META_EXT || {})[String(cap0)] || []);
  const m = src.find(x => x.k === k && !!x.s === !!s) || src.find(x => x.k === k);
  if (m && m.f && m.c1) return { f: m.f, c1: m.c1, c2: m.c2 };
  const { fasts, chargeds } = movePool(k);
  const ty = D.pokemon[k].ty;
  const dpt = mv => D.moves[mv].p * (ty.includes(D.moves[mv].t) ? 1.2 : 1) / (D.moves[mv].tn || 1);
  const byDpe = chargeds.slice().sort((a, b) => dpeOf(k, b) - dpeOf(k, a));
  return { f: fasts.slice().sort((a, b) => dpt(b) - dpt(a))[0] || '', c1: byDpe[0] || '', c2: byDpe[1] };
}

// 集計: 1匹1行(通常とシャドウは別)。cnt=出現数 / lead=初手(1匹目)の数 / w,l=その相手がいた対戦の自分の勝ち負け
function blAgg(use) {
  const map = new Map();
  for (const r of use) r.foes.forEach((f, idx) => {
    if (!f || !D.pokemon[f.k]) return;
    const kk = f.k + (f.s ? '|s' : '');
    let e = map.get(kk);
    if (!e) { e = { k: f.k, s: !!f.s, cnt: 0, lead: 0, w: 0, l: 0 }; map.set(kk, e); }
    e.cnt++;
    if (idx === 0) e.lead++;
    if (r.win === 'w') e.w++; else if (r.win === 'l') e.l++;
  });
  return { battles: use.length, rows: [...map.values()].sort((a, b) => b.cnt - a.cnt || b.lead - a.lead) };
}

// 入力の3枠(あいて)。パーティ診断の枠と同じ見た目・同じ検索
function buildBlogSlots() {
  const box = document.querySelector('#blog .blslots');
  if (!box) return;
  box.innerHTML = [0, 1, 2].map(i => `<div class="pslot fslot blslot" data-i="${i}">
    <div class="phd"><span class="pnum">${i + 1}匹目${i === 0 ? '<small class="bllead">初手</small>' : ''}</span>
      <button class="pshadow" aria-label="シャドウ" title="シャドウとして記録する"><i class="shadowmark"></i></button>
      <button class="pclr" title="この枠を空にする">×</button></div>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
  </div>`).join('');
  box.querySelectorAll('.blslot').forEach(el => {
    const i = +el.dataset.i;
    const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) { const v = toKata(inp.value); if (v !== inp.value) inp.value = v; }
      const q = toKata(inp.value.trim());
      if (!q) { list.style.display = 'none'; return; }
      const hits = searchPk(q, k => !isMega(k) || !!(cup && cup.slug.startsWith('mega')));
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        list.style.display = 'none';
        BLE.foes[i] = { k: d.dataset.k, s: false };
        syncBlogSlot(i);
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
    el.querySelector('.pshadow').onclick = () => {
      if (!BLE.foes[i]) return;
      BLE.foes[i].s = !BLE.foes[i].s;
      syncBlogSlot(i);
    };
    el.querySelector('.pclr').onclick = () => { BLE.foes[i] = null; syncBlogSlot(i); };
  });
}
function syncBlogSlot(i) {
  const el = document.querySelector(`.blslot[data-i="${i}"]`);
  if (!el) return;
  const f = BLE.foes[i];
  el.querySelector('input').value = f ? blName(f) : '';
  el.querySelector('.pshadow').setAttribute('aria-pressed', !!(f && f.s));
}
function blSetMsg(t) { const m = document.querySelector('#blog .blmsg'); if (m) m.textContent = t || ''; }
function blAddRecord() {
  if (!BLE.foes.some(Boolean)) { blSetMsg('あいてのポケモンを1匹以上えらんでください'); return; }
  let id = Date.now();
  const last = BLOG[BLOG.length - 1];
  if (last && last.id >= id) id = last.id + 1;   // 連打しても記録のidがかぶらないように
  // レート(任意)。日本語キーボードの全角数字も受ける(打っている最中は書き換えない・確定時に整える恒久ルール)
  const rEl = document.querySelector('#blog .blrate');
  const rv = parseInt((rEl.value || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^\d]/g, ''), 10);
  const rate = rv >= 0 && rv < 10000 ? rv : null;
  BLOG.push({ id, t: Date.now(), cap,
    foes: BLE.foes.map(f => f ? { ...f } : null),
    win: BLE.win, rate,
    mine: PT.map(p => p ? { k: p.key, s: !!p.shadow } : null) });
  saveBlog();
  BLE.foes = [null, null, null]; BLE.win = null;
  rEl.value = '';
  [0, 1, 2].forEach(syncBlogSlot);
  document.querySelectorAll('#blog .blres button').forEach(b => b.setAttribute('aria-pressed', false));
  blSetMsg(`記録しました(${BL_LGN[cap] || 'このリーグ'} ${blRecs().length}戦目)`);
  runBlog();
}

function runBlog() {
  // 自分のパーティの控え(記録と一緒に保存される)
  const recs = blRecs();
  const mineEl = document.querySelector('#blog .blmine');
  const mine = PT.filter(Boolean).map(p => shMark((p.shadow ? 'シャドウ' : '') + D.pokemon[p.key].n)).join('・');
  mineEl.innerHTML = mine ? `自分のパーティも一緒に控えます: <b>${mine}</b> <small>(パーティ診断の3枠)</small>`
    : '<small>パーティ診断の3枠に自分のパーティを入れておくと、一緒に記録されます</small>';
  // よく出る相手のワンタップ入力(このリーグの全記録から)
  const qbox = document.querySelector('#blog .blquick');
  const freq = blAgg(recs).rows.slice(0, 12);
  qbox.innerHTML = freq.length ? '<span class="blqlbl">よく出る:</span>' + freq.map((e, i) =>
    `<button class="blchip" data-i="${i}" title="タップすると空いている枠に入ります">${shMark(blName(e))}</button>`).join('') : '';
  qbox.querySelectorAll('.blchip').forEach(b => b.onclick = () => {
    const e = freq[+b.dataset.i];
    const slot = BLE.foes.findIndex(x => !x);
    if (slot < 0) return;
    BLE.foes[slot] = { k: e.k, s: e.s };
    syncBlogSlot(slot);
  });
  // 集計のあらまし
  const use = blUse(recs);
  const w = use.filter(r => r.win === 'w').length, l = use.filter(r => r.win === 'l').length;
  const sumEl = document.querySelector('#blog .blsum');
  sumEl.innerHTML = recs.length
    ? `<b>${BL_LGN[cap] || 'このリーグ'}</b>の記録: <b>${use.length}戦</b>${BLV.period !== 'all' ? '<small>(直近だけで集計中)</small>' : ''}` +
      (w + l ? ` ・ 勝ち${w}/負け${l}(勝率<b>${Math.round(w / (w + l) * 100)}%</b>)` : '') +
      (recs.length >= 5 ? `<button class="blusecup" title="記録から作った採用率順のリスト(マイ環境)を相手にして、自分のパーティの穴をチェックします">📒 マイ環境でパーティ診断</button>` : '')
    : `<b>${BL_LGN[cap] || 'このリーグ'}</b>の記録はまだありません。上の枠に戦った相手を入れて「＋ 記録する」を押してください`;
  const useBtn = sumEl.querySelector('.blusecup');
  if (useBtn) useBtn.onclick = blToParty;
  document.querySelectorAll('#blog .blvtabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === BLV.view));
  document.querySelectorAll('#blog .blperiod button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === BLV.period));
  document.querySelector('#blog .blviews').style.display = recs.length ? '' : 'none';
  const body = document.querySelector('#blog .blbody');
  if (!recs.length) { body.innerHTML = ''; return; }
  if (BLV.view === 'rate') { body.innerHTML = blRateHtml(use); blBindRate(body); }
  else if (BLV.view === 'hist') { body.innerHTML = blHistHtml(recs); blBindHist(body); }
  else if (BLV.view === 'graph') body.innerHTML = blGraphHtml(use);
  else if (BLV.view === 'type') {
    body.innerHTML = blTypeHtml(use);
    body.querySelectorAll('.bltysel button').forEach(b => b.onclick = () => { BLV.tsel = b.dataset.t; runBlog(); });
  }
  else blHitStart(use, body);
}

// タイプ相性の自動集計(2026-08-27タダシさん指示)。記録した相手のタイプから、
// 攻撃面(こちらがそのタイプのわざで攻撃)と防御面(こちらがそのタイプのポケモンで受ける)を
// 弱点・耐性の4グラフで出す。重みは採用数(よく出る相手ほど大きく数える)
function blTypeHtml(use) {
  const a = blAgg(use);
  if (!a.rows.length) return '<div class="mtnote">この期間の記録がありません</div>';
  const idx = Object.fromEntries(D.types.map((t, i) => [t, i]));
  const tot = a.rows.reduce((s, e) => s + e.cnt, 0);
  const stats = D.types.map(T => ({ t: T, aw: 0, ar: 0, dw: 0, dr: 0 }));
  for (const e of a.rows) {
    const ty = D.pokemon[e.k].ty;
    // 防御面は相手の定番わざ構成(環境の確定値→無ければ効率順)のタイプで見る(2026-08-27タダシさん確認で
    // タイプ一致基準から変更。マリルリのれいとうビームのような不一致わざも数えるため)
    const mv = blMovesOf(e.k, e.s, cap);
    const atkTy = [...new Set([mv.f, mv.c1, mv.c2].filter(m => m && D.moves[m]).map(m => D.moves[m].t))];
    for (const st of stats) {
      // 攻撃面: 複合タイプは掛け算(二重弱点・二重耐性込み)
      const m = ty.reduce((x, t) => x * D.chart[st.t][idx[t]], 1);
      if (m > 1.01) st.aw += e.cnt;
      else if (m < 0.99) st.ar += e.cnt;
      // 防御面: 相手の定番わざがタイプ st.t にどう入るか(1本でも該当すれば数える)
      if (atkTy.some(s2 => D.chart[s2][idx[st.t]] > 1.01)) st.dw += e.cnt;
      if (atkTy.some(s2 => D.chart[s2][idx[st.t]] < 0.99)) st.dr += e.cnt;
    }
  }
  const graph = (key, cls, ttl, sub, tip) => {
    const rows = stats.slice().sort((x, y) => y[key] - x[key]).map(st => {
      const pct = Math.round(st[key] / tot * 100);
      return `<div class="bltyr" title="${D.typeJa[st.t]}: 記録した相手のべ${tot}匹のうち${st[key]}匹(${pct}%)が${tip}">
        ${typePairHTML([D.typeJa[st.t]], 17)}<span class="bltyb"><i class="${cls}" style="width:${pct}%"></i></span><b>${pct}%</b></div>`;
    }).join('');
    return `<div class="bltyg"><div class="bltyt">${ttl}</div><div class="bltys">${sub}</div>${rows}</div>`;
  };
  // 4つを一気に出すと視覚的にうるさいので、ボタンで1つずつ表示する(2026-08-27タダシさん指示)
  const G = {
    aw: ['good', '⚔️ 弱点を突ける', '高いタイプほど、そのタイプのわざがあなたの環境に刺さります', '弱点(×1.6以上)です'],
    ar: ['bad', '⚔️ 耐性で軽減される', '高いタイプほど、通りが悪い相手が多いです', '耐性(×0.63以下)で軽減してきます'],
    dw: ['bad', '🛡️ 弱点を突かれる', '高いタイプほど、相手の定番わざ構成で弱点を突かれやすいです', 'そのタイプの弱点を突けるわざを持ちます(定番構成)'],
    dr: ['good', '🛡️ 耐性で軽減できる', '高いタイプほど、相手の定番わざ構成を軽減しやすいです', 'そのタイプが軽減できるわざを持ちます(定番構成)'],
  };
  const sel = G[BLV.tsel] ? BLV.tsel : 'aw';
  const btn = (k, lbl, tip) => `<button data-t="${k}" aria-pressed="${sel === k}" title="${tip}">${lbl}</button>`;
  return `<div class="bltype">
    <div class="enote expl">あなたの記録(採用数の重み付き・のべ${tot}匹)からタイプごとの通りやすさを集計したものです。攻撃面(⚔️)＝相手のタイプに対して(複合タイプは掛け算・二重弱点/二重耐性込み)、防御面(🛡️)＝相手の定番わざ構成(環境の確定値・載っていなければ効率順)のノーマル＋SP2本のタイプに対して、1本でも当てはまれば数えます。</div>
    <div class="opts bltysel">
      ${btn('aw', '⚔️弱点', '攻撃面: そのタイプのわざで攻撃したとき、弱点を突ける相手の割合を出します')}${btn('ar', '⚔️耐性', '攻撃面: そのタイプのわざで攻撃したとき、耐性で軽減される相手の割合を出します')}${btn('dw', '🛡️弱点', '防御面: そのタイプのポケモンで受けたとき、相手の定番わざ構成で弱点を突かれる割合を出します')}${btn('dr', '🛡️耐性', '防御面: そのタイプのポケモンで受けたとき、相手の定番わざ構成を耐性で軽減できる割合を出します')}
    </div>
    ${graph(sel, ...G[sel])}
  </div>`;
}

// レートの折れ線グラフ(レートを入れた記録だけが点になる)
function blGraphHtml(use) {
  const pts = [];
  use.forEach(r => { if (r.rate != null) pts.push({ y: r.rate, t: r.t }); });
  if (!pts.length) return '<div class="mtnote">記録するときに「レート」欄に数字を入れると、ここに折れ線グラフが出ます(5戦セットの区切りで入れる形でOK)</div>';
  const last = pts[pts.length - 1].y;
  if (pts.length === 1) return `<div class="mtnote">レート <b>${last}</b> を記録しました。2つ以上たまると折れ線グラフが出ます</div>`;
  const hi = Math.max(...pts.map(p => p.y)), lo = Math.min(...pts.map(p => p.y));
  const diff = last - pts[0].y;
  const W = 600, H = 250, L = 50, R = 16, T = 16, B = 28;
  const span = Math.max(hi - lo, 20), pad = span * 0.18;
  const y0 = lo - pad, y1 = hi + pad;
  const xs = i => L + (W - L - R) * i / (pts.length - 1);
  const ys = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  // 横のガイド線(4本・きりのいい値)
  const grid = [];
  for (let g = 0; g < 4; g++) {
    const v = Math.round((y0 + (y1 - y0) * (g + 0.5) / 4) / 10) * 10;
    grid.push(`<line x1="${L}" x2="${W - R}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" class="blggrid"/>
      <text x="${L - 6}" y="${(ys(v) + 3).toFixed(1)}" class="blgy">${v}</text>`);
  }
  const line = pts.map((p, i) => `${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(' ');
  const area = `${L},${H - B} ${line} ${(W - R)},${H - B}`;
  const dots = pts.map((p, i) => {
    const d = new Date(p.t);
    return `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p.y).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}"
      class="blgdot${i === pts.length - 1 ? ' cur' : ''}"><title>${d.getMonth() + 1}/${d.getDate()}　レート${p.y}</title></circle>`;
  }).join('');
  const dt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  return `<div class="blgraph">
    <div class="blghead">最新 <b>${last}</b><span> ・ 最高 ${hi} ・ この期間 <i class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${diff}</i></span></div>
    <svg viewBox="0 0 ${W} ${H}" class="blgsvg" role="img" aria-label="レートの推移">
      ${grid.join('')}
      <polygon points="${area}" class="blgarea"/>
      <polyline points="${line}" class="blgline"/>
      ${dots}
      <text x="${L}" y="${H - 8}" class="blgx">${dt(pts[0].t)}</text>
      <text x="${W - R}" y="${H - 8}" class="blgx" text-anchor="end">${dt(pts[pts.length - 1].t)}</text>
    </svg>
  </div>`;
}

// 採用率(あなたの土俵のランキング)
function blRateHtml(use) {
  const a = blAgg(use);
  if (!a.rows.length) return '<div class="mtnote">この期間の記録がありません</div>';
  const rows = a.rows.map((e, i) => {
    const pct = Math.round(e.cnt / a.battles * 100);
    const wl = e.w + e.l;
    const wr = wl ? Math.round(e.w / wl * 100) : null;
    return `<div class="bltr">
      <span class="blrank">${i + 1}</span>
      <span class="blnm">${shMark(blName(e))}${typeIcons(D.pokemon[e.k], 15)}</span>
      <span class="blcell" title="この期間の${a.battles}戦のうち、${e.cnt}回パーティに入っていました">${pct}%<small>${e.cnt}回</small></span>
      <span class="blcell dim" title="初手(1匹目)で出てきた回数です">${e.lead || 'ー'}</span>
      <span class="blcell ${wr == null ? 'dim' : wr >= 50 ? 'ok' : 'bad'}" title="このポケモンがいた対戦での、あなたの勝率です(勝敗を記録したぶんだけ)。低いほど苦手な相手です">${wr == null ? 'ー' : wr + '%'}</span>
      <button class="blcnt" data-k="${e.k}" data-s="${e.s ? 1 : 0}" title="このポケモンに勝てるポケモンを対策さがしで調べます">対策</button>
    </div>`;
  }).join('');
  return `<div class="bltbl"><div class="blth"><span></span><span>ポケモン</span><span title="この期間の対戦のうち、パーティに入っていた割合です">採用率</span><span title="初手(1匹目)で出てきた回数です">初手</span><span title="そのポケモンがいた対戦でのあなたの勝率です。低いほど苦手な相手です">勝率</span><span></span></div>${rows}</div>`;
}
function blBindRate(body) {
  body.querySelectorAll('.blcnt').forEach(b => b.onclick = () => blToCounter(b.dataset.k, b.dataset.s === '1'));
}
// 「対策」→ 対策さがしのあいて欄へ入れてモードを切り替える(applyMetaと同じ手順の縮小版)。
// 対戦記録ページ(/battlelog/)からはGBLページへURL引き継ぎで移動する(ロケット団と同じ「入口は別」の作り)
function blToCounter(k, s) {
  if (PAGE_BLOG) { location.href = `/gbl/?lg=${cap}&md=counter&r=${k}${s ? '&shr=1' : ''}`; return; }
  S[1].key = k; S[1].shadow = s; S[1].maxLv = 51; syncSmax(1);
  sideEl[1].querySelector('.shadowtab').setAttribute('aria-pressed', s);
  S[1].fast = null; S[1].c1 = null; S[1].c2 = null;
  resetPin(1); resetSpPlan(1);
  S[1].ivMode = 'auto'; S[1].mIvs = null; S[1].mLevel = null;
  sideEl[1].querySelector('input').value = (s ? 'シャドウ' : '') + D.pokemon[k].n;
  document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === 'counter'));
  mode = 'counter'; applyMode(); run();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function blToParty() {
  if (PAGE_BLOG) { location.href = `/gbl/?lg=${cap}&md=party&cup=my${cap}`; return; }
  selectMyCup(cap);
  document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === 'party'));
  mode = 'party'; applyMode(); run();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 履歴(新しい順)。×→「削除する?」の2タップで消す(押しまちがい防止)
function blHistHtml(recs) {
  const rows = recs.slice().reverse().map(r => {
    const d = new Date(r.t);
    const foes = r.foes.filter(Boolean).map(f => shMark(blName(f))).join('・') || '(相手の記録なし)';
    const mine = r.mine && r.mine.some(Boolean) ? r.mine.filter(Boolean).map(f => shMark(blName(f))).join('・') : '';
    const del = BLV.del === r.id;
    return `<div class="blhrow">
      <span class="bldate">${d.getMonth() + 1}/${d.getDate()}</span>
      <span class="blfoes">${foes}${mine ? `<small class="blvs">自分: ${mine}</small>` : ''}</span>
      <span class="blwl ${r.win || ''}">${r.win === 'w' ? '勝ち' : r.win === 'l' ? '負け' : 'ー'}</span>
      <button class="bldel${del ? ' arm' : ''}" data-id="${r.id}" title="この記録を消します">${del ? '削除する?' : '×'}</button>
    </div>`;
  }).join('');
  // 全削除(リセット)。まちがえて押しても消えないよう、確認ウィンドウを出してから消す(2026-08-27タダシさん指示)
  const reset = BLV.resetArm
    ? `<div class="blconfirm"><b>${BL_LGN[cap] || 'このリーグ'}の記録${recs.length}戦をすべて削除します。</b>元に戻せません。よろしいですか?
        <div class="blcbtns"><button class="blcyes">すべて削除する</button><button class="blcno">やめる</button></div></div>`
    : `<button class="blreset" title="このリーグの記録を全部消します(確認ウィンドウが出ます)">🗑 ${BL_LGN[cap] || 'このリーグ'}の記録をすべて削除</button>`;
  return `<div class="blhist">${rows}</div>${reset}`;
}
function blBindHist(body) {
  body.querySelectorAll('.bldel').forEach(b => b.onclick = () => {
    const id = +b.dataset.id;
    if (BLV.del === id) {
      BLOG = BLOG.filter(r => r.id !== id);
      saveBlog(); BLV.del = null; runBlog();
    } else { BLV.del = id; runBlog(); }
  });
  const rs = body.querySelector('.blreset');
  if (rs) rs.onclick = () => { BLV.resetArm = true; runBlog(); };
  const yes = body.querySelector('.blcyes');
  if (yes) yes.onclick = () => {
    BLOG = BLOG.filter(r => r.cap !== cap);   // 消すのはいま見ているリーグのぶんだけ
    saveBlog(); BLV.resetArm = false; BLV.del = null;
    blSetMsg('記録を削除しました');
    runBlog();
  };
  const no = body.querySelector('.blcno');
  if (no) no.onclick = () => { BLV.resetArm = false; runBlog(); };
}

// 「刺さるポケモン」: あなたの環境(記録の上位・採用数の重み付き)にいちばん勝てる候補をシミュレートする。
// 前提は一覧系3モードとそろえる(理想個体値・定番わざ構成・🛡0-0/1-1/2-2の3通り・ブラフは画面のブラフ設定)
function blHitStart(use, body) {
  const agg = blAgg(use);
  const foesE = agg.rows.slice(0, 20).filter(e => D.pokemon[e.k]);
  if (!foesE.length) { body.innerHTML = '<div class="mtnote">この期間の記録がありません</div>'; return; }
  body.innerHTML = `<div class="mtnote">計算中…(あなたの環境上位${foesE.length}匹と総当たり)</div>`;
  const token = ++BLV.token;
  const mkCfg = (k, s, sh) => {
    const mv = blMovesOf(k, s, cap);
    const r1 = rank1(k, cap);
    return { key: k, ivs: r1.ivs, level: r1.level, shadow: !!s, timing: 'optimal', cap,
      bluff: metaBluff, shields: sh, fast: mv.f || movePool(k).fasts[0], charged: [mv.c1, mv.c2].filter(Boolean) };
  };
  const foeCfgs = foesE.map(e => [0, 1, 2].map(sh => mkCfg(e.k, e.s, sh)));
  const wsum = foesE.reduce((s, e) => s + e.cnt, 0);
  const cands = blCandidates();
  const out = [];
  let idx = 0;
  const step = () => {
    if (token !== BLV.token || mode !== 'blog') return;
    const t0 = performance.now();
    while (idx < cands.length && performance.now() - t0 < 40) {
      const c = cands[idx++];
      const cCfgs = [0, 1, 2].map(sh => mkCfg(c.k, c.s, sh));
      let wp = 0, beat = 0;
      for (let f = 0; f < foesE.length; f++) {
        let wins = 0;
        for (let sh = 0; sh < 3; sh++)
          if (PvpEngine.simulate(D, cCfgs[sh], foeCfgs[f][sh], SIMOPT).winner === 0) wins++;
        wp += foesE[f].cnt * (wins / 3);
        if (wins >= 2) beat++;
      }
      out.push({ k: c.k, s: c.s, p: wp / wsum, beat });
    }
    if (idx < cands.length) { setTimeout(step, 0); return; }
    out.sort((a, b) => b.p - a.p || b.beat - a.beat);
    body.innerHTML = blHitHtml(out.slice(0, 15), foesE.length);
  };
  setTimeout(step, 0);
}
// 候補 = 全体の環境上位100 + 記録に出てきた相手 + ★登録リスト(メガは除く)
function blCandidates() {
  const seen = new Set(), outp = [];
  const add = (k, s) => {
    if (!k || !D.pokemon[k] || isMega(k)) return;
    const kk = k + (s ? '|s' : '');
    if (seen.has(kk)) return;
    seen.add(kk); outp.push({ k, s: !!s });
  };
  ((window.META_LISTS || {})[String(cap)] || []).concat((window.META_EXT || {})[String(cap)] || [])
    .forEach(m => add(m.k, m.s));
  blRecs().forEach(r => r.foes.forEach(f => f && add(f.k, f.s)));
  loadMyPk().forEach(m => add(m.key, m.shadow));
  return outp;
}
function blHitHtml(rows, nf) {
  const items = rows.map((r, i) => `<div class="blhitrow">
    <span class="blrank">${i + 1}</span>
    <span class="blnm">${shMark((r.s ? 'シャドウ' : '') + D.pokemon[r.k].n)}${typeIcons(D.pokemon[r.k], 15)}</span>
    <span class="blbar"><i style="width:${Math.round(r.p * 100)}%"></i></span>
    <span class="blpct" title="あなたの環境上位${nf}匹に採用数の重みを付けた勝率です(🛡0-0/1-1/2-2の3通りの平均)">${Math.round(r.p * 100)}%</span>
    <span class="blbeat" title="あなたの環境上位${nf}匹のうち、🛡3通り中2通り以上で勝てる相手の数です">${r.beat}/${nf}</span>
  </div>`).join('');
  return `<div class="blhit">
    <div class="enote expl">あなたの記録の上位${nf}匹(採用数の重み付き)に、どのポケモンがいちばん勝てるかの一覧です。理想個体値・定番わざ構成でシミュレートしています。</div>
    ${items}</div>`;
}

// マイ環境をカップとして使う(記録から作った採用率順のリスト。現行カップと同じ形なので全モードがそのまま動く)
function myCupOf(cap0) {
  const recs = BLOG.filter(r => r.cap === cap0).slice(-100);   // 直近100戦ぶん
  const rows = blAgg(recs).rows.filter(e => D.pokemon[e.k]).slice(0, 50);
  const list = rows.map(e => {
    const mv = blMovesOf(e.k, e.s, cap0);
    const m = { k: e.k, n: (e.s ? 'シャドウ' : '') + D.pokemon[e.k].n, f: mv.f, c1: mv.c1 };
    if (e.s) m.s = 1;
    if (mv.c2) m.c2 = mv.c2;
    return m;
  });
  return { slug: 'my' + cap0, label: '📒 マイ環境(' + BL_LGN[cap0] + ')', cp: cap0 === 0 ? 10000 : cap0, list, ext: [], my: 1 };
}
function selectMyCup(cap0) {
  // 記録が無い(別の端末で開いた共有URLなど)ときは、ふつうのリーグとして開く
  if (!BLOG.some(r => r.cap === cap0)) {
    cup = null; cap = cap0;
    cupTab.textContent = '特殊カップ';
    document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', +x.dataset.cap === cap0));
    afterCapChange();
    return;
  }
  cup = myCupOf(cap0);   // 選ぶたびに最新の記録から作り直す
  cap = cap0;
  document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', false));
  cupTab.setAttribute('aria-pressed', true);
  cupTab.textContent = cup.label;
  cupwin.style.display = 'none';
  afterCapChange();
}

// GBL模擬戦(mode 'mock'): じぶん3匹×あいて3匹の対人戦を決断ごとに進める
// ロケット団の模擬戦(rbPlay/rbRender)の対人版。GBLのルールに合わせた違い:
//  - 硬直なし(NPCではないので、SPアタックのあと・交代のあとも両者すぐ動く)
//  - シールドは両者2枚固定(GBLの仕様。枚数の設定UIは出さない)
//  - 交代のクールタイムは両者45秒(2026-08-18タダシさん確認・ロケット団と同じ値)
//  - 手動交代では、相手の打ちかけのノーマルアタック1発が交代先に入る(開幕交代と同じ扱い)。
//    自分の打ちかけのノーマルアタックは失われる
//  - あいても人間なので、あいて側にも決断(SP・シールド・交代)がある。
//    既定は「あいて難易度」(GB_AI・EASY/NORMAL/HARD)のAIが自動で答え、
//    タイムラインのチップをタップすれば「ここでシールドを使わなかったら？」を試せる
// 再生まわりの状態(RB/RBV/RBUI)と決断の共有コーデック(rb=)はロケット団と共用する
// (ロケット団は/rocket/専用・この画面は/gbl/専用なので、同じページで混ざることはない)
// ==================================================================
// あいて難易度(2026-08-20タダシさん指示で、5種の「性格」から EASY/NORMAL/HARD の3段階へ作り替えた)。
// 既定は**NORMAL**＝これまでの「実戦」AIそのまま(かけひき＋温存＋スイッチの全部あり)。
// フラグの意味:
//  bluff=軽いSPでシールドを釣る ／ save=小さいSPにはシールドを使わない ／
//  sw=基本戦術の「逃げ回り」(2026-08-18タダシさん指示。不利な相手との対面は長引くほど負けに
//  つながるので、①出し負けたらすぐ交代 ②ためたSPがあれば撃ってから交代 ③倒されたら、いまの相手に
//  いちばん有利な控え(倒した起点の初手など)を出し直す) ／
//  farm=起点づくり(SPを撃たなくても勝てる対面ではノーマルアタックだけで倒してゲージをため、次の相手にSPを撃つ) ／
//  spam=EASY専用: SPアタックは撃てるようになったらすぐ撃つが、消費の軽いわざしか撃たない
//  (「反応がおくれる」案は2026-08-20タダシさん指示で不採用。初心者でも画面連打は常にするため) ／
//  omni=HARD専用: **ユーザーの3匹とわざ構成を最初から知っている**(「AIはずるをしない」恒久ルールの
//  明示的な例外。2026-08-20タダシさん指示「常にユーザーの手を知った上で最適な行動を取る」) ／
//  truth=HARD専用: シールドは予測ではなく**実際に飛んでくるわざのダメージ**で判断する(ブラフが効かない)
const GB_AI = {
  easy: { label: 'EASY', jp: 'やさしい', bluff: false, save: false, sw: false, farm: false, spam: true,
    tip: 'はじめての人向け。SPアタックは撃てるようになったらすぐ撃ちますが、2本持っていても消費の軽いほうしか使いません。シールドは飛んできたSPアタックに残っていれば必ず使い(軽いわざのブラフにも引っ掛かります)、自分からは交代しません' },
  normal: { label: 'NORMAL', jp: '標準', bluff: true, save: true, sw: true, farm: true,
    tip: '実戦の基本戦術で戦う標準の相手(これまでの「実戦」AIと同じ)。かけひき(ブラフ)・シールドの温存・出し負けたらすぐ交代・起点づくりを全部使いますが、こちらのまだ見せていないポケモンは知らない、という実戦と同じ情報量で戦います' },
  hard: { label: 'HARD', jp: '最強', bluff: true, save: true, sw: true, farm: true, omni: true, truth: true,
    tip: 'こちらの3匹とわざ構成を最初から全部知っている最強の相手。シールドは実際に飛んでくるわざのダメージで判断するのでブラフは効きません。控えの読みも予測ではなく実物で行い、常にこちらの手の内を知った上で最適な行動を取ります' },
};
// foeAuto=あいてのわざを「オート」にする(2026-08-20タダシさん指示)。
// ONのあいだ、あいてのわざ欄を隠して環境の定番構成(mockDefaultMoves)で戦う＝
// どのわざが飛んでくるか、飛んでくるまで分からない(実戦と同じ情報量)。既定はOFF(今までどおり選べる)
const MK = { ai: 'normal', leadSwap: false, foeAuto: false };
try { if (localStorage.getItem('gbl_mock_foeauto') === '1') MK.foeAuto = true; } catch (e) {}
const saveMkFoeAuto = () => { try { localStorage.setItem('gbl_mock_foeauto', MK.foeAuto ? '1' : '0'); } catch (e) {} };
// 旧「あいてのAIの性格」(basic/bluff/save/switch/pro)の保存値・共有リンクは難易度へ読み替える
// (きほん→EASY・それ以外→NORMAL。かけひき/温存/スイッチはNORMALの部分集合なのでNORMALへ寄せる)
const GB_AI_OLD = { basic: 'easy', bluff: 'normal', save: 'normal', switch: 'normal', pro: 'normal' };
try {
  const v = localStorage.getItem('gbl_mock_ai');
  if (v) MK.ai = GB_AI_OLD[v] || v;
  if (!GB_AI[MK.ai]) MK.ai = 'normal';
} catch (e) {}
const saveMkAi = () => { try { localStorage.setItem('gbl_mock_ai', MK.ai); } catch (e) {} };
const GB_SWAP_CD = 90;        // 交代のクールタイム45秒(90ターン)
// SPアタック1発ぶんの時間(2026-08-21タダシさん指示・10秒＝20ターン)。
// SPアタックを撃つと、アイコン入力のミニゲームと演出のあいだ手が止まるが、
// **バトルのタイマーはそのあいだも止まらない**ので、その時間ぶんだけ実時間が進む。
// したがって経過時間の表示だけでなく、**交代のクールタイム45秒にも算入する**。
// 根拠: ゲーム内公開データの minigameDurationSeconds は7.0秒(アイコン入力のミニゲームだけ)。
// 演出まで含めた1発ぶんとして、外部シミュレータと同じ10秒を採る(タダシさん選択)。
// **ロケット団戦には適用しない**(今年のアプデでSPの発動がGBLより速くなったため。実測待ち)
const GB_SP_TURNS = 20;
// この対面の「ターンごとの累計SP発動数」(両者ぶん)。時計 = ターン + GB_SP_TURNS×累計
function gbSpc(res) {
  const a = [];
  let n = 0;
  (res.rows || []).forEach(r => {
    const tn = r.tn === '-' ? Math.max(0, a.length - 1) : r.tn;
    while (a.length <= tn) a.push(n);
    for (let i = 0; i < 2; i++) if (r.ev[i] && r.ev[i].full !== undefined) n++;
    a[tn] = n;
  });
  return a;
}
const gbSpAt = (spc, tn) => spc.length ? spc[Math.max(0, Math.min(tn, spc.length - 1))] : 0;
const GB_SHIELD_BIG = 0.30;   // 「温存」がシールドを使うダメージのしきい値(最大HPの30%)
const GB_KEEP_HP = 0.35;      // 出し勝った初手を温存する残りHPの目安(2026-08-31タダシさん指示で35%に)
const GB_DUMP_WORTH = 0.25;   // 「撃ってから交代」を選ぶダメージのしきい値(相手の現在HPの25%)
// 「クールタイム狙い」とみなす相手の交代不能の残り(40ターン=20秒以上)。
// 10秒では相手にSPを撃たれて時間を稼がれるとすぐ逃げられてしまう。20秒なら、SPを撃たれても
// 約10秒の有利時間が残り、AI側もSPを撃てる(2026-08-18タダシさん指示で10秒→20秒へ)
const GB_LOCK_MIN = 40;
// 「起点にできる」とみなすSPアタックの痛さの上限(候補の残りHPの40%未満なら痛手にならない。
// 2026-08-18タダシさん指示で30%→40%)
const GB_FARM_HURT = 0.40;
// 起点づくりの「チャージ効率が同じくらい」とみなす幅(15%以内なら横並びとして被ダメージで決める)
const GB_FARM_TIE = 0.15;
// 「勝ち幅が同じくらい」とみなす幅(1000点満点で50点以内)
const GB_MARGIN_TIE = 50;
// 起点にする1匹を選ぶときの点数の重み(大きいほど優先)。
// **裏読み(GB_W_PRED)だけ意図的に小さい**＝上の基準が拮抗したときにしか結論を動かさない
// **3匹目の温存は軽い後押しにとどめる**(2026-08-18タダシさん判断)。
// 「最後にこの1匹を残して尻上がりに」という戦術ならともかく、基本はその場その場で効率よく動くもので、
// 最初から3匹目を温存する前提では戦わない。1000点だと他の基準を全部押しつぶしていた
const GB_W_SHOWN = 80;     // ②まだ見せていない3匹目は温存する(軽い後押し)
const GB_W_GAIN = 300;     // ③チャージ効率(いちばん高い候補を1.0とした比)
const GB_W_TAKE = 8;       // ④被ダメージ(残HP比の点。ふつう5〜25点ぶんの差になる)
const GB_W_PRED = 60;      // ⑤ユーザーの控えの裏読み(実測: 候補が並ぶ30場面のうち2回=約7%だけ結論が変わる)

// ---- じぶんのわざ(GBL模擬戦用。ロケット団のRBM・パーティ診断のPTとは別に持つ) ----
const GBM = [null, null, null];
const GBM_KEY = 'gbl_mock_mymoves';
try { const v = JSON.parse(localStorage.getItem(GBM_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) GBM[i] = m; }); } catch (e) {}
const saveGbm = () => { try { localStorage.setItem(GBM_KEY, JSON.stringify(GBM)); } catch (e) {} };
// 既定のわざ: 環境の確定値(人が確認した実戦の定番構成)があればそれ。SP2本目が無い行は
// 残りから効率のよいわざを足す。載っていないポケモンは効率の式で叩き台を作る(選び直せる)
function mockDefaultMoves(key, shadow) {
  const mm = ptMetaMoves(key, shadow);
  const { fasts, chargeds } = movePool(key);
  const ty = D.pokemon[key].ty;
  const dpt = m => D.moves[m].p * (ty.includes(D.moves[m].t) ? 1.2 : 1) / (D.moves[m].tn || 1);
  const byDpe = chargeds.slice().sort((a, b) => dpeOf(key, b) - dpeOf(key, a));
  const fast = (mm && mm.fast) || fasts.slice().sort((a, b) => dpt(b) - dpt(a))[0] || '';
  const c1 = (mm && mm.c1) || byDpe[0] || '';
  const c2 = (mm && mm.c2) || byDpe.find(x => x !== c1) || '';
  return { fast, c1, c2 };
}
function gbmOf(i) {
  if (!PT[i]) return null;
  if (!GBM[i] || GBM[i].key !== PT[i].key) {
    // ★登録リストの個体はわざも登録されていることがある。あればそちらを既定にする
    const d = mockDefaultMoves(PT[i].key, PT[i].shadow);
    GBM[i] = { v: 1, key: PT[i].key,
      fast: PT[i].fast || d.fast, c1: PT[i].c1 || d.c1, c2: PT[i].c2 || d.c2 };
    saveGbm();
  }
  return GBM[i];
}

// ---- あいての3枠(GBL用。ロケット団のRKTとは別・シャドウは切り替え式・わざ3欄) ----
const GBT = [null, null, null];
const GBT_KEY = 'gbl_mock_foes';
try { const v = JSON.parse(localStorage.getItem(GBT_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) GBT[i] = m; }); } catch (e) {}
const saveGbt = () => { try { localStorage.setItem(GBT_KEY, JSON.stringify(GBT)); } catch (e) {} };
const gbtName = m => m ? (m.shadow ? 'シャドウ' : '') + D.pokemon[m.key].n : '';
// あいて1匹の計算用設定(理想個体値・リーグ上限)
const gbtBase = m => ptBase({ key: m.key, shadow: !!m.shadow, ivMode: 'auto', maxLv: 51 });
function buildGbFoeSlots() {
  const box = document.querySelector('#mock .gfoeslots');
  if (!box) return;
  box.innerHTML = [0, 1, 2].map(i => `<div class="pslot fslot gfoe" data-i="${i}">
    <div class="phd"><span class="pnum">${i + 1}匹目</span>
      <button class="pshadow" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）として計算する"><i class="shadowmark"></i></button>
      <button class="pclr" title="この枠を空にする">×</button></div>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="fbody" style="display:none">
      <select class="selFast" title="あいてのノーマルアタック"></select>
      <select class="selC1" title="あいてのSPアタック1"></select>
      <select class="selC2" title="あいてのSPアタック2（2本目を開放していないなら「ー」）"></select>
      <div class="fstat"></div>
    </div>
  </div>`).join('');
  box.querySelectorAll('.gfoe').forEach(el => {
    const i = +el.dataset.i;
    const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) {
        const v = toKata(inp.value);
        if (v !== inp.value) inp.value = v;
      }
      const q = toKata(inp.value.trim());
      if (!q) { list.style.display = 'none'; return; }
      // メガはメガカップのときだけ(GBLでは他のリーグで使えない。対策さがしの全ポケモンと同じ基準)
      const hits = searchPk(q, k => !isMega(k) || !!(cup && cup.slug.startsWith('mega')));
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        list.style.display = 'none';
        // わざの既定は環境の確定値(なければ効率の叩き台)。表示と計算が食い違わないよう具体値で持つ
        GBT[i] = { key: d.dataset.k, shadow: false, ...mockDefaultMoves(d.dataset.k, false) };
        saveGbt(); syncGbFoeSlots(); run();
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
    el.querySelector('.pshadow').onclick = () => {
      if (!GBT[i]) return;
      GBT[i].shadow = !GBT[i].shadow;
      saveGbt(); syncGbFoeSlots(); run();
    };
    el.querySelector('.pclr').onclick = () => { GBT[i] = null; saveGbt(); syncGbFoeSlots(); run(); };
    el.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const m = GBT[i];
      if (!m) return;
      if (sel.classList.contains('selFast')) m.fast = sel.value;
      else if (sel.classList.contains('selC1')) m.c1 = sel.value;
      else m.c2 = sel.value;
      if (m.c2 && m.c2 === m.c1) m.c2 = '';   // 同じわざを2本持っても意味がない
      saveGbt(); syncGbFoeSlots(); run();
    });
  });
  syncGbFoeSlots();
}
// あいての枠の表示(名前・わざの選択肢・実数値)を今の設定に合わせる
function syncGbFoeSlots() {
  // わざオート(2026-08-20): ONのあいだ、わざの選択欄を隠す(CSSの .gfoeslots.auto)
  const box = document.querySelector('#mock .gfoeslots');
  if (box) box.classList.toggle('auto', MK.foeAuto);
  const ab = document.querySelector('#mock .gfauto');
  if (ab) ab.setAttribute('aria-pressed', MK.foeAuto);
  document.querySelectorAll('#mock .gfoe').forEach(el => {
    const m = GBT[+el.dataset.i];
    const fb = el.querySelector('.fbody');
    el.querySelector('.pshadow').setAttribute('aria-pressed', !!(m && m.shadow));
    el.querySelector('input').value = m ? gbtName(m) : '';
    if (!m) { fb.style.display = 'none'; return; }
    fb.style.display = 'block';
    const { fasts, chargeds } = movePool(m.key);
    if (!fasts.includes(m.fast)) m.fast = fasts[0] || '';
    const opts = (list, sel) => list.map(x => `<option value="${x}"${x === sel ? ' selected' : ''}>${D.moves[x].n}</option>`).join('');
    el.querySelector('.selFast').innerHTML = opts(fasts, m.fast);
    el.querySelector('.selC1').innerHTML = chargeds.length ? opts(chargeds, m.c1) : '';
    el.querySelector('.selC2').innerHTML = chargeds.length
      ? `<option value=""${!m.c2 ? ' selected' : ''}>ー</option>` + opts(chargeds, m.c2) : '';
    el.querySelector('.selC1').style.display = chargeds.length ? '' : 'none';
    el.querySelector('.selC2').style.display = chargeds.length ? '' : 'none';
    // 実数値は1対1のﾏﾆｭｱﾙ欄と同じ基準(シャドウ補正込み)。リーグが変わると変わる
    const base = gbtBase(m);
    const st = PvpEngine.buildStats(D, base);
    const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
    el.querySelector('.fstat').innerHTML =
      `${typeIcons(D.pokemon[m.key], 15)} CP${st.cp}・PL${base.level}／攻${f1(st.atk)}・防${f1(st.def)}・HP${st.hp}`;
  });
}

// ---- 決断のキーと選択肢 ----
// キーは「対面:側:種別:連番:待った発数」(側 0=じぶん 1=あいて)。ロケット団(4要素)と形式が
// 違うので、同じ rb= コーデックで共有しても混ざらない
const gbKey = (li, side, kind, seq, w) => `${li}:${side}:${kind}:${seq}:${w || 0}`;
// わざ名→わざ本体(自分デバフわざの判定に使う。名前は一意)
let MOVE_BY_NAME = null;
function gbMoveByName(name) {
  if (!MOVE_BY_NAME) {
    MOVE_BY_NAME = {};
    for (const id in D.moves) MOVE_BY_NAME[D.moves[id].n] = D.moves[id];
  }
  return MOVE_BY_NAME[name];
}
// 確定で自分の能力が下がるわざ(溜め打ちの対象と同じ判定)
const gbSelfDebuff = mv => !!(mv && mv.bf && mv.bt !== 'opponent' && (mv.bc == null || mv.bc >= 1) && (mv.bf[0] < 0 || mv.bf[1] < 0));
// ---- ユーザーの「まだ出ていないポケモン」の裏読み(2026-08-18タダシさん指示) ----
// **知識ではなく予測**。実際の控えは絶対に見ず、環境リストと「見えている情報」だけで組み立てる
// (見てしまうと恒久ルール「AIは未登場のポケモンを知らない」に違反する)。材料は3つ:
//  ①**採用率**(環境リストの順位。上位ほど組まれやすい)
//  ②**相性の補完**(見えているポケモンに刺さるタイプを受けられるか＝一緒に組まれやすい)
//  ③**並びの型**(ABB/ABA。見えている裏のポケモンと役割が似たものが残っていそう
//    → CLAUDE.md「GBLのパーティ構成の考え方」)
// 断定はせず**確率の重み**として持ち、使いどころは**優先度をいちばん低く**する(タダシさん指示)。
const GB_PRED_TOP = 40;   // 予測に使う環境上位の数
const GB_PRED_N = 5;      // 予測として残す候補の数
const gbMetaPool = () => cup ? (cup.list || []) : ((window.META_LISTS || {})[String(cap)] || []);
// そのポケモンに「刺さるタイプ」「受けられるタイプ」(タイプ相性表から。1匹1回だけ計算)
const GBTP = new Map();
function gbTypeProf(key) {
  const ck = key;
  if (!GBTP.has(ck)) {
    const ty = D.pokemon[key].ty, weak = new Set(), res = new Set();
    for (const t of D.types) {
      const e = PvpEngine.effectiveness(D, t, ty);
      if (e > 1.05) weak.add(t); else if (e < 0.95) res.add(t);
    }
    GBTP.set(ck, { weak, res, ty });
  }
  return GBTP.get(ck);
}
// 場面から作るコイントス。読み合いにならない場面(両者が同時に倒れたときの出し直し)で使う。
// **同じ場面なら必ず同じ結果**になるので、決断を選び直して計算し直しても結果がぶれない
// (毎回ランダムにすると、別の場面を選び直すたびにここの結果まで変わって混乱する)
function gbCoin(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

// 1対面ぶんのシミュ結果から、決断が要る場面を両側ぶん時系列に並べる。
// 中身はロケット団の rbPoints と同じ考え方を側ごとに繰り返す＋GBL特有の交代質問:
//  - 対面の頭: 相手の新しいポケモンが出てきたら「交代する？」(クールタイム中・控えなしは出さない)
//  - 自分の能力が下がるSPを撃った直後: 「交代する？」(溜め打ち→2連射して交代、の再現)
// 「相手の新しいポケモンを見てから交代を決める」までの反応ターン(2026-08-19タダシさん指示・1秒)。
// **倒されて出し直した直後**に使う: 相手の登場からノーマルアタックを打ちながら1秒待つ＝
// 0.5秒わざは2発(2ターン)、1秒わざは1発(2ターン)、1.5秒わざは1発(3ターン)、2秒わざは1発(4ターン)。
// 式は tn * ceil(2 / tn)。
// **開幕交代への反応はこれを使わない**(2026-08-20タダシさん指摘で分離): 開幕交代では
// 「打ちかけのノーマルアタック1発」がすでに交代先に入っている(leadHit)ので、その1発が
// 反応待ちの攻撃ぶん。1秒わざ以上なら追加の攻撃なしで交代する(質問はT1に出す。
// 0.5秒わざだけはT1に2発目が自然に入ってから=実時間1.0秒でちょうど反応)
function gbReactTn(fm) {
  const tn = Math.max(1, (fm && fm.tn) || 1);
  return tn * Math.ceil(2 / tn);
}
function gbPoints(turns, ctx, dec) {
  const pts = [];
  // ck(tn) = その時点の**時計**(通しターン + 撃ったSPアタックぶんの時間)。
  // 交代のクールタイムは実時間なので、SPの演出中も進む(GB_SP_TURNSの項)
  const ck = ctx.ck || (tn => ctx.base + tn);
  // 交代の打ち切りが決まっているなら、それより先のターンの質問は出さない(その先は次の対面の話)
  const cutA = [0, 1].filter(s => dec[s].swapTo != null).map(s => dec[s].swapAt);
  const cut = cutA.length ? Math.min(...cutA) : Infinity;
  // ターンごとの「その時点の状態」(HP・ゲージ・能力変化)を先に作っておく。
  // 交代の質問にこれを持たせると、AIが**対面の途中の削れ込み**で有利不利を下読みできる
  // (SPを1発入れてから交代すれば裏が勝てる、という判断に必要)
  const snap = {}, dbf = {};
  {
    const bb = [ctx.bAt[0].slice(), ctx.bAt[1].slice()];
    const sh = [ctx.shLeft[0], ctx.shLeft[1]];
    for (const t of turns) {
      let hit = false;   // こちらのわざであいての能力が下がったターンか(下げ消し交代のきっかけ)
      for (let i = 0; i < 2; i++) for (const e of t.ev[i]) {
        if (e.shielded) sh[1 - i] = Math.max(0, sh[1 - i] - 1);
        if (!e.buff) continue;
        const tgt = e.buff.target === 'opponent' ? 1 - i : i;
        bb[tgt] = e.buff.to.slice();
        if (i === 0 && tgt === 1 && (e.buff.to[0] < 0 || e.buff.to[1] < 0)) hit = true;
      }
      snap[t.tn] = { st0: { hp: t.state[0].hp, en: t.state[0].en, b: bb[0].slice(), sh: sh[0] },
                     st1: { hp: t.state[1].hp, en: t.state[1].en, b: bb[1].slice(), sh: sh[1] } };
      dbf[t.tn] = hit;
    }
  }
  for (const s of [0, 1]) {
    const d = dec[s], o = 1 - s;
    let shSeq = 0, shUsed = 0, spIdx = 0, armed = false, normals = 0, asked = false;
    const cost = ctx.cost[s];
    for (const t of turns) {
      if (t.tn > cut) break;
      for (const e of t.ev[o]) {   // 相手のSPアタックが飛んできた(シールドを使うかどうか)
        if (e.full === undefined) continue;
        if (ctx.shLeft[s] - shUsed > 0) {
          // hpB=被弾前のHP ／ enB=相手が撃つ直前のゲージ(あいてAIの「わざ予測」に使う。
          // 実際に飛んできたわざで判断するとユーザーから見てインチキになるため)
          const mvA = gbMoveByName(e.move);
          // st0/st1 = **その瞬間の状態**(HP・ゲージ・能力変化)。AIはこれを使って
          // 「いまの形勢」を読み直す(対面の頭の読みを使い回すと、途中でひっくり返った形勢に
          // ついていけない。2026-08-19タダシさん指摘)。被弾するHPだけは当たる前の値に戻す
          const sn = snap[t.tn];
          const hpB = t.state[s].hp + e.full;
          // so=そのターンの中での解決順(エンジンの行の位置)。同時発動では**先に解決した側の
          // シールド判断が先**＝先に撃った側は、相手が食らったか防いだかを見てから自分の判断をする
          // (2026-08-31タダシさん指示・時系列の再現。並べ替えとgbPlayの決断順に効く)
          const so = t.sub ? t.sub.findIndex(r => r.ev[o] === e) : 0;
          pts.push({ side: s, kind: 'sh', seq: shSeq, w: 0, tn: t.tn, spSeen: shSeq + 1,
            so: Math.max(0, so),
            mv: e.move, dmg: e.full, ko: t.state[s].hp <= 0,
            hpB, enB: t.state[o].en + (mvA ? mvA.e : 0),
            st0: sn && { ...sn.st0, hp: s === 0 ? hpB : sn.st0.hp },
            st1: sn && { ...sn.st1, hp: s === 1 ? hpB : sn.st1.hp } });
        }
        if (d.shieldAt.includes(shSeq + 1)) shUsed++;
        shSeq++;
      }
      const fired = t.ev[s].find(e => e.full !== undefined);
      if (fired) {
        spIdx++; armed = false; asked = false; normals = 0;
        // SPを撃った直後の「交代する？」:
        //  - 自分の能力が下がるSPのあと(下げた能力は交代で消える実戦の動き・両側)
        //  - あいてが「逃げ回り」のAIのとき(不利対面でためたSPを撃ってから下がる基本戦術・ctx.foeDump)
        const mv = gbMoveByName(fired.move);
        const over0 = t.state[0].hp <= 0 || t.state[1].hp <= 0;
        if ((gbSelfDebuff(mv) || (s === 1 && ctx.foeDump)) && !over0 && d.swapTo == null
            && ctx.swTo[s].length && ck(t.tn) >= ctx.swOk[s])
          // dbf=撃ったのが自分の能力が下がるわざか(AIの「打ち逃げ必須」はデバフ技のときだけ)
          pts.push({ side: s, kind: 'swap', seq: spIdx, w: 0, tn: t.tn, dbf: gbSelfDebuff(mv), ...(snap[t.tn] || {}) });
        continue;
      }
      if (armed && t.ev[s].some(e => e.full === undefined)) normals++;
      const over = t.state[0].hp <= 0 || t.state[1].hp <= 0;
      if (!armed && !asked && !over && !d.hold && d.swapTo == null && cost && t.state[s].en >= cost) { armed = true; normals = 0; }
      if (armed && !over) {
        const sht = spIdx < d.shots.length ? d.shots[spIdx] : null;
        const dw = sht ? sht.wait : d.wait;
        const w = typeof dw === 'number' ? dw : (sht && sht.after) || 0;
        if (normals >= w) {
          pts.push({ side: s, kind: 'sp', seq: spIdx, w, tn: t.tn, en: t.state[s].en, ...(snap[t.tn] || {}) });
          armed = false; asked = true;
        }
      }
    }
    // 対面の頭の交代質問: 相手の新しいポケモンが出てきた対面で、交代できるなら聞く。
    // **相手が倒されて次を出した直後だけは、あいて(AI)は1秒たってから聞く**
    // (2026-08-19タダシさん指示)。出てきたポケモンを確認してから決める動きなので、
    // 開幕交代の反応と同じ間合いにする(0.5秒わざなら2発・1秒〜のわざなら1発ぶん攻撃してから交代)
    if (ctx.newIn[o] && ctx.swTo[s].length && dec[s].swapTo == null) {
      const htn = s === 1 && ctx.koIn && ctx.koIn[o] ? gbReactTn(D.moves[ctx.fast[s]]) : 1;
      const ht = htn > 1 ? turns.find(x => x.tn === htn) : null;
      if (ck(htn) >= ctx.swOk[s] && htn <= cut
          && (htn === 1 || (ht && ht.state[0].hp > 0 && ht.state[1].hp > 0)))
        pts.push({ side: s, kind: 'swap', seq: 0, w: 0, tn: htn, ...(htn > 1 ? (snap[htn] || {}) : {}) });
    }
    // 開幕に**片方だけ**が交代したとき、もう片方は**1秒後**に「交代する？」を選べる(gbReactTn)
    if (ctx.react && ctx.react.side === s && ctx.swTo[s].length && dec[s].swapTo == null
        && ck(ctx.react.tn) >= ctx.swOk[s]) {
      const rt = turns.find(x => x.tn === ctx.react.tn);
      if (rt && rt.tn <= cut && rt.state[0].hp > 0 && rt.state[1].hp > 0)
        pts.push({ side: s, kind: 'swap', seq: 0, w: 0, tn: ctx.react.tn, ...(snap[rt.tn] || {}) });
    }
  }
  // 受けたデバフの下げ消し交代(w=1・あいて側だけ・逃げ回りのAIのとき):
  // ターンを歩きながら能力変化を追いかけ、こちらのわざであいての能力が下がった直後に交代質問を置く。
  // その瞬間のHP・ゲージ・能力変化を持たせて、AIが「その状態で有利か不利か」を下読みできるようにする
  if (ctx.foeDump && ctx.swTo[1].length) {
    let seq = 0;
    for (const t of turns) {
      if (t.tn > cut) break;
      const over = t.state[0].hp <= 0 || t.state[1].hp <= 0;
      if (!dbf[t.tn]) continue;
      if (!over && dec[1].swapTo == null && ck(t.tn) >= ctx.swOk[1])
        pts.push({ side: 1, kind: 'swap', seq: seq, w: 1, tn: t.tn, ...(snap[t.tn] || {}) });
      seq++;   // 質問を出さなかった回も数えて、キーが前の決断とずれないようにする
    }
  }
  // 時系列の順に(同じターンは 対面の頭の交代 → SP・シールド → SPを撃った直後・下げ消しの交代、
  // じぶん→あいての順)。**SPを撃った直後の交代(seq>0)と下げ消し(w=1)は後ろに置く**
  // (2026-08-31タダシさん報告で修正: 前に置くと、シールドの質問に答える前にAIの交代が決まって
  // 「交代した！」チップが先に見えてしまう＝時系列が崩れる。後ろに置けば、シールドの答えを
  // 反映したシミュでAIが交代を判断することにもなり、「その瞬間の状態で読み直す」の確定仕様どおり)
  const ord = p => p.kind !== 'swap' ? 1 : (p.seq > 0 || p.w === 1 ? 2 : 0);
  // 同じターンのシールド質問どうしは**解決順(so)**で並べる(2026-08-31タダシさん指示・同時発動の時系列:
  // 先に解決したSPへのシールド判断が先。先に撃った側は相手の結果を見てから自分の判断をする)
  pts.sort((a, b) => a.tn - b.tn || ord(a) - ord(b)
    || (a.kind === 'sh' && b.kind === 'sh' ? (a.so || 0) - (b.so || 0) : 0)
    || a.side - b.side);
  pts.forEach(p => { p.ck = ck(p.tn); });   // 決断ごとの時計(表示とAIの交代判断に使う)
  return pts;
}

// 決断ひとつぶんの選択肢(画面に出すボタン)。ロケット団の rbChoices の側つき版。
// GBLは硬直が無いので、交代は「すぐ」だけ(＋N発攻撃してから、はロケット団専用)
function gbChoices(p, ctx) {
  const s = p.side || 0;
  const ros = ctx.ros;
  if (p.kind === 'lead') {
    const list = ctx.swTo[s].map(k => ({ a: 'to', to: k, cls: 'fire',
      label: `${SWAPMK} ${shMark(ros[s][k].name)}`,
      tip: '開幕にこのポケモンへ交代します(相手の打ちかけの1発は交代先に入ります)' }));
    // あいての開幕交代はAIが決めるので、「交代しない」も選び直せるようにする
    return s ? list.concat([{ a: 'stay', label: 'このまま', cls: 'hold',
      tip: '開幕は交代せず、そのまま戦います' }]) : list;
  }
  if (p.kind === 'sp') {
    // わざごとのフレームに「最適」「即打ち」の2大ボタン(2026-08-20タダシさん指示・最適が左)。
    // 最適=このわざをいちばん効率のよいタイミングで撃つ(＋N=あと何発ノーマルアタックをはさむか)
    // 即打ち=タイミングを待たず、たまり次第すぐ撃つ。
    // ＋1〜＋3の細かい指定は使う頻度が低いので「…詳細」(det)に畳む
    const fm = ctx.fast[s] && D.moves[ctx.fast[s]];
    const list = [];
    ctx.spList[s].forEach(id => {
      const m = D.moves[id];
      const need = fm && fm.eg > 0 && p.en != null
        ? Math.max(0, Math.ceil((m.e - p.en) / fm.eg)) : 0;
      const head = `${mvChip(m.n, 14)}<i class="cost">${m.e}</i>${
        need ? `<i class="need">${fm.n}＋${need}</i>` : ''}`;
      const optN = p.optNs ? p.optNs[id] : null;
      list.push({ a: 'opt', mv: id, grp: id, head, cls: 'best',
        label: `⭐ 最適${optN > 0 ? `<i class="need">＋${optN}</i>` : ''}`,
        tip: optN > 0
          ? `${m.n}を、いちばん効率のよいタイミングで撃ちます(ノーマルアタックをあと${optN}発はさんでから)`
          : `${m.n}を、いちばん効率のよいタイミングで撃ちます` });
      list.push({ a: 'fire', mv: id, grp: id, cls: 'fire',
        label: '即打ち',
        tip: need ? `ゲージが足りないので、${fm.n}をあと${need}発打って、たまり次第すぐ${m.n}を撃ちます`
                  : `タイミングを待たず、ここですぐ${m.n}を撃ちます` });
    });
    // 「撃たない」が正解の場面(noSp)は点灯させておすすめ表示(2026-08-20タダシさん指示。
    // ノーマルアタックだけで倒しきれて相手のSPも飛んでこない=撃つのはもったいない)
    const out = list.concat([
      p.noSp
        ? { a: 'hold', label: '撃たない<i class="rtag">おすすめ</i>', cls: 'hold reco',
            tip: 'ノーマルアタックだけで倒しきれて、相手のSPアタックも飛んできません。撃たずにゲージを次の対面へ持ち越すのがおすすめです' }
        : { a: 'hold', label: '撃たない', cls: 'hold', tip: 'この対面では撃たず、ゲージを次の対面に持ち越します' },
      { a: 'wait', n: 1, det: true, label: '＋1', cls: 'wait', tip: 'ノーマルアタックをあと1発打ってから、もう一度ここで選びます' },
      { a: 'wait', n: 2, det: true, label: '＋2', cls: 'wait', tip: 'ノーマルアタックをあと2発打ってから、もう一度ここで選びます' },
      { a: 'wait', n: 3, det: true, label: '＋3', cls: 'wait', tip: 'ノーマルアタックをあと3発打ってから、もう一度ここで選びます' },
    ]);
    // ためてブラフ(2026-08-30タダシさん指示・基本中の基本のセオリー):
    // 消費のちがう2本を持っているとき、**重いわざのゲージまでためてから軽いわざを撃つ**。
    // 相手はどちらが来るか分からないので、軽いわざにシールドを使わせられたらラッキー。
    // すでに重いわざぶんたまっているなら「即打ち」と同じなので出さない
    if (!s && fm && fm.eg > 0 && p.en != null && ctx.spList[s].length >= 2) {
      const mvs = ctx.spList[s].map(id => ({ id, m: D.moves[id] })).filter(x => x.m)
        .sort((a, b) => a.m.e - b.m.e);
      const light = mvs[0], heavy = mvs[mvs.length - 1];
      if (heavy.m.e > light.m.e && p.en < heavy.m.e) {
        const needN = Math.ceil((heavy.m.e - p.en) / fm.eg);
        out.push({ a: 'bluff', mv: light.id, until: heavy.m.e, end: true, cls: 'fire bluffbtn',
          label: `<span>ためてブラフ<i class="need">＋${needN}</i></span><small>${heavy.m.n}分ため→${light.m.n}</small>`,
          tip: `${heavy.m.n}が撃てるゲージ(${heavy.m.e})までためてから、軽い${light.m.n}を撃ちます。` +
            `相手はどちらのわざが来るか分からないので、軽いわざにシールドを使わせられたらラッキー、というセオリーの動きです` });
      }
    }
    return out;
  }
  if (p.kind === 'sh') {
    // あいてがSPを2本持っている(またはわざオート)なら、どちらが飛んでくるかを見せない
    // (2026-08-20タダシさん指示。見せるとあいてのブラフが成立しない。実戦でも飛んでくるまで分からない)
    const hide = !s && ((ctx.spList[1] || []).length >= 2 || MK.foeAuto);
    return [
      { a: 'use', label: '🛡 使う', cls: 'fire', tip: 'シールドで防ぎます(ダメージ1)' },
      { a: 'no', label: `受ける${!hide && p.dmg ? `<b class="dmg">-${p.dmg}</b>` : ''}`, cls: 'hold',
        tip: hide ? 'シールドを使わずにダメージを受けます(どのわざが飛んでくるかは受けるまで分かりません)'
                  : 'シールドを使わずにダメージを受けます' },
    ];
  }
  // 手動交代(HUDの⇄ボタン)の編集: 交代先だけ選び直せる(取り消しは↺)
  if (p.kind === 'msw') return ctx.swTo[0].map(k => ({ a: 'toq', to: k, cls: 'fire',
    label: `${SWAPMK} ${shMark(ros[0][k].name)}`,
    tip: 'このポケモンに交代します(相手の打ちかけの1発は交代先に入ります・次の交代は45秒後)' }));
  if (p.kind === 'swap') {
    const opts = ctx.swTo[s].map(k => ({ a: 'toq', to: k, cls: 'fire',
      label: `${SWAPMK} ${shMark(ros[s][k].name)}`,
      tip: 'このポケモンに交代します(相手の打ちかけの1発は交代先に入ります・次の交代は45秒後)' }));
    return opts.concat([{ a: 'stay', label: 'このまま', cls: 'hold', tip: '交代せずにこのまま戦います' }]);
  }
  return ctx.swTo[s].map(k => ({ a: 'to', to: k, label: shMark(ros[s][k].name), cls: 'fire',
    tip: '次にこのポケモンを出します' }));
}
function gbAskTitle(p) {
  const who = p.side ? '<i class="rbwho">あいて</i> ' : '';
  if (p.kind === 'lead') return who + SWAPMK + ' 開幕交代';
  if (p.kind === 'sp') return who + '⚡ SPアタック';
  if (p.kind === 'sh') {
    // あいてのSPが2本(またはわざオート)のときは、どちらが飛んでくるか見せない(2026-08-20タダシさん指示)
    const hide = !p.side && p.ctx && ((p.ctx.spList[1] || []).length >= 2 || MK.foeAuto);
    return `${who}🛡 ${hide ? 'SPアタック' : (p.mv || 'SPアタック')}が来る！`;
  }
  if (p.kind === 'swap' || p.kind === 'msw') return who + SWAPMK + ' 交代する？';
  return who + '💀 次に出すのは？';
}
function gbAnsLabel(p, a) {
  if (!a) return '？';
  if (p.kind === 'sp') {
    if (a.a === 'auto') return '⭐ おまかせ';
    // あいてのSPが2本(またはわざオート)なら、チップにもわざ名を出さない(2026-08-20タダシさん指示。
    // 撃つ前にチップが見えるので、名前を出すとあいてのブラフが成立しない)
    const hide = p.side && p.ctx && ((p.ctx.spList[1] || []).length >= 2 || MK.foeAuto);
    if (a.a === 'opt') return hide ? '⭐ SPアタック' : `⭐ ${D.moves[a.mv] ? D.moves[a.mv].n : a.mv}`;
    if (a.a === 'fire') return hide ? '▶ SPアタック' : `▶ ${D.moves[a.mv] ? D.moves[a.mv].n : a.mv}`;
    if (a.a === 'bluff') return hide ? '▶ SPアタック' : `ため→${D.moves[a.mv] ? D.moves[a.mv].n : a.mv}`;
    if (a.a === 'wait') return `＋${a.n}`;
    return '撃たない';
  }
  if (p.kind === 'sh') return a.a === 'no' ? '受ける' : '使う';
  const ros = p.ctx.ros[p.side || 0];
  // 「場に出した」と「交代した」を言葉で区別する(2026-08-30タダシさん指示・一瞬で見分けづらかったため)
  if (p.kind === 'swap' || p.kind === 'lead' || p.kind === 'msw') {
    if (a.a === 'stay') return 'このまま';
    return `${ros[a.to] ? shMark(ros[a.to].name) : ''}に交代した！`;
  }
  return a.a === 'order' ? '順番どおり' : (ros[a.to] ? `${shMark(ros[a.to].name)}をくりだした！` : '');
}

// ---- 通しの計算 ----
// picks/foes = [{ m, base, pol:{fast, charged[]}, name }]。わざは画面の欄の具体値で固定
// (表示と結果を食い違わせない)。ans=決断の答え(RB.ans)。stepwise=1手ずつ(じぶんの決断で止まる)。
// あいての決断は止まらず、あいて難易度(GB_AI)のAIが自動で答える(ansにあればそちらを優先)
function gbPlay(picks, foes, ans, stepwise) {
  ans = ans || {};
  const ai = GB_AI[MK.ai] || GB_AI.normal;
  const ros = [picks, foes];
  const st = ros.map(r => r.map(() => ({ alive: true, resume: null })));
  const cur = [0, 0], shLeft = [2, 2], swOk = [0, 0];
  const newIn = [false, false];   // この対面の頭で「新しく出てきた」側(交代質問のきっかけ)
  const koIn = [false, false];    // そのうち「倒されて出し直した」側(あいての交代判断を1秒遅らせる)
  // 出し勝った初手の温存(2026-08-30タダシさん指示・上級者の動き):
  // ユーザーが**交代できたのに**不利な対面から交代せず倒された(=ABAで出し負けた形)。
  // それは「裏にこのポケモンが苦手なもう1匹がいる」と知らせたのと同じなので、
  // 勝ったこのポケモンには後で必ず仕事がある＝次のポケモンが出てきたらすぐ交代して温存する
  let keepLead = false;
  // **AIは場に出ていないユーザーのポケモンを知らない**(2026-08-18タダシさん指示・恒久ルール)。
  // 一度でも場に出たポケモンだけ「見えている」として、AIの下読みに使ってよい
  // (何匹残っているかは分かるが、それが何かは分からない、が実戦の情報量)。
  // **HARD(omni)だけはこのルールの明示的な例外**(2026-08-20タダシさん指示):
  // ユーザーの手の内を最初から知っているので、控えも実物で下読みする
  const seen = [new Set(), new Set()];
  const revealed0 = () => ai.omni ? benches(0)
    : benches(0).filter(k => seen[0].has(k));   // 見えているユーザーの控え
  let base = 0, spTot = 0, pending = null;
  // 開幕交代(0秒)。両者が同時に決めるので、おたがい相手の選択は見えない
  const leadPts = [null, null], leadHits = [null, null];
  let react = null;   // 片方だけが開幕交代したとき、もう片方が反応できる場面 {side, tn}
  // **追っている側かどうか**(2026-08-19タダシさん指示)。ユーザーが自分から交代した＝不利だから
  // 逃げた、ということなので、そのあとAIは「追っている側」になる。
  // 追っている側の基本は**対面を維持したい**なので、五分の対面でも安定して突破できる控えがいるなら
  // 出していく(勝ち負けがはっきりしない対面に付き合って主導権を手放さない)
  let chase = false;
  // **直前に自分から引っ込んだユーザーのポケモン**(2026-08-20タダシさん指示・「答えの温存」に使う)。
  // 交代で下がった=倒されていない=あとで必ず戻ってくる相手
  let went0 = null;
  // 直前の交代で交代先に入った「打ちかけのノーマルアタック1発」。次の対面の頭に表示する
  // (2026-08-20タダシさん報告: 表示しないと、対面の切れ目をまたいだノーマルアタックが
  //  タイムラインから消えたように見える。HPは正しく減っていた=表示だけの問題)
  let swapHitEv = null;
  const legs = [];
  const nextAlive = (sd, from) => {
    for (let i = 0; i < st[sd].length; i++) { const k = (from + i) % st[sd].length; if (st[sd][k].alive) return k; }
    return -1;
  };
  const benches = sd => ros[sd].map((p, k) => k).filter(k => k !== cur[sd] && st[sd][k].alive);
  // 側sd・番号idxの「いまの状態込み」の設定(交代AIの下読みに使う。おまかせ最適で通す)。
  // ov を渡すと、その状態(対面の途中のHP・ゲージ・能力変化)から始める
  const plainCfg = (sd, idx, ov) => {
    const P = ros[sd][idx];
    const c = { ...P.base, fast: P.pol.fast, charged: (P.pol.charged || []).slice(),
      shields: shLeft[sd], timing: 'optimal', bluff: sd === 1 ? ai.bluff : false };
    const rs = ov || st[sd][idx].resume;
    // _sh = その下読みでのシールドの残り枚数(「防いだあと」は1枚減った状態で読む)
    if (rs) { const { _sh, ...r } = rs; c.resume = r; if (_sh != null) c.shields = _sh; }
    return c;
  };
  const duelAt = (i0, i1, ov0, ov1) => PvpEngine.simulate(D, plainCfg(0, i0, ov0), plainCfg(1, i1, ov1), SIMOPT);
  const duel = (i0, i1) => duelAt(i0, i1);
  // 「安定して勝てるか」＝**シールドの持ち方を総当たりしたときの勝率**(2026-08-19タダシさん指示)。
  // どちらの控えでも倒せる状況では、1対1の勝率が高い＝安定して対面させられるほうを出す。
  // ユーザーが先に交代していればゲージも溜まっているが、それは resume(いまの状態)に入っているので
  // そのまま計算に乗る。返すのは 勝率 と、平均の勝ち幅(同率のときの比べ物)
  const wrCache = {};
  const aiWinRate = (k, ov0, ov1) => {
    const ck = k + '|' + cur[0] + '|' + shLeft.join(',') + '|' + (ov0 ? ov0.hp + ',' + ov0.en : '') + '|' + (ov1 ? ov1.hp + ',' + ov1.en : '');
    if (ck in wrCache) return wrCache[ck];
    let win = 0, n = 0, mg = 0;
    for (let a = 0; a <= shLeft[0]; a++) for (let b = 0; b <= shLeft[1]; b++) {
      const r = PvpEngine.simulate(D, { ...plainCfg(0, cur[0], ov0), shields: a },
        { ...plainCfg(1, k, ov1), shields: b }, SIMOPT);
      n++;
      if (r.winner === 1) win++;
      mg += 500 * (1 - r.final[0].hp / r.final[0].hpMax) + 500 * (r.final[1].hp / r.final[1].hpMax);
    }
    const v = { rate: n ? win / n : 0, margin: n ? mg / n : 0 };
    wrCache[ck] = v;
    return v;
  };
  // 交代AI: いまの対面をおまかせで通して勝てないなら、勝てる控えのうち一番よいものを返す(なければnull)。
  //  opt.even=true … どっちもどっち(引き分け・時間切れ)でも交代を探す(既定は負けのときだけ)
  //  opt.ov0/ov1  … 対面の途中の状態から下読みする(受けたデバフの下げ消し交代で使う)
  const aiSwapTo = (sd, opt) => {
    const o = opt || {};
    // force=true は「答えの温存」用: いまの対面に勝てるかどうかを見ずに、
    // 新しく出てきた相手に勝てる控えを探す(2026-08-20タダシさん指示)
    if (!o.force) {
      const now = duelAt(cur[0], cur[1], o.ov0, o.ov1);
      if (now.winner === sd) return null;                     // 勝てる対面なら残る
      if (now.winner !== (1 - sd) && !o.even) return null;    // どっちもどっちは指定があるときだけ動く
    }
    // ---- HARDは「自分からの逃げ交代」をしない(2026-08-30タダシさん指示・核心ルール) ----
    // GBLの核心は**「いかに有利対面を取り続けるか」**。負け対面でも、ユーザーの交代が自由な
    // あいだに自分から交代すると、控えを合わせ返されて有利対面を取り返される
    // (合わせた側が勝つかどうかの1点では測れない——勝ってもシールド消費などの不利は残る)。
    // **残って倒させてから次を出せば、クールタイム消費なしで確実に有利対面を取れる**
    // (倒れた後の交代はペナルティなし＝仕組み上の基本の動き)。
    // ユーザーが逃げられないとき(クールタイム20秒以上・ラスト1匹)だけ自分から取りにいく
    // (そのときは guard=false で来る)。実例: ウッウに負けるブルンゲルがモルペコへ逃げる→
    // Gマッギョを合わせられて交代の無駄打ち、が正しく「倒させてからモルペコ」になる。
    // ※「有利対面をとっているのにあえて交代する」例外パターンは今後タダシさんが指示予定
    if (sd === 1 && o.guard && ai.omni && !o.force) return null;
    let best = null;
    for (const k of benches(sd)) {
      const r = sd === 1 ? duelAt(cur[0], k, o.ov0, null) : duelAt(k, cur[1], null, o.ov1);
      if (r.winner !== sd) continue;
      // **どちらも倒せるなら、1対1の勝率が高い＝安定して対面させられるほうを出す**
      // (シールドの持ち方を総当たりして数える。AI側だけこの見方をする)
      const own = r.final[sd], opp = r.final[1 - sd];
      const mg = 500 * (1 - opp.hp / opp.hpMax) + 500 * (own.hp / own.hpMax);
      const w = sd === 1 ? aiWinRate(k, o.ov0, null) : null;
      const sc = w ? w.rate * 1e4 + w.margin : mg;
      if (!best || sc > best.sc) best = { k, sc };
    }
    return best ? best.k : null;
  };
  // 出し勝った初手の温存の交代先: ユーザーの新しいポケモンに勝てる控えを最優先、
  // いなければ形勢のいちばんマシな控え(それでも温存はする=セオリーの動き)
  const aiKeepSwap = ov => {
    let best = null;
    for (const k of benches(1)) {
      const r = duelAt(cur[0], k, ov && ov.ov0, null);
      const sc = (r.winner === 1 ? 1e6 : 0)
        + 500 * (1 - r.final[0].hp / r.final[0].hpMax) + 500 * (r.final[1].hp / r.final[1].hpMax);
      if (!best || sc > best.sc) best = { k, sc };
    }
    return best ? best.k : null;
  };
  // sd側が交代したとき、相手の打ちかけのノーマルアタック1発が交代先に入る(ダメージと相手のゲージ)
  const swapHit = (sd, to) => {
    const od = 1 - sd;
    const fm = D.moves[ros[od][cur[od]].pol.fast];
    if (!fm) return null;
    const aSt = PvpEngine.buildStats(D, ros[od][cur[od]].base);
    const aRs = st[od][cur[od]].resume;
    const att = { ...aSt, buffs: aRs && aRs.buffs ? aRs.buffs.slice() : [0, 0] };
    const dSt = PvpEngine.buildStats(D, ros[sd][to].base);
    const dRs = st[sd][to].resume;
    const dfn = { ...dSt, buffs: dRs && dRs.buffs ? dRs.buffs.slice() : [0, 0] };
    return { dmg: PvpEngine.damage(D, fm, att, dfn), mv: fm.n, eg: fm.eg || 0 };
  };
  // sd側の手動交代を実行する。withHit=false は両者同時交代(打ちかけの1発は無し)
  const doSwap = (sd, to, gt, withHit) => {
    const od = 1 - sd;
    if (sd === 0) went0 = cur[0];   // 自分から引っ込んだ=あとで戻ってくる(答えの温存の対象)
    gulpOff(st[sd][cur[sd]].resume);   // ウッウ: 場を離れると通常の姿に戻る(咥え直しが必要)
    if (withHit) {
      const hit = swapHit(sd, to);
      if (hit) {
        const maxB = PvpEngine.buildStats(D, ros[sd][to].base).hp;
        const rs = st[sd][to].resume || { hp: maxB, en: 0, buffs: [0, 0], stall: 0 };
        // エンジンのresumeはHP最低1で受けるので、打ちかけの1発で倒れることはない(仕様)
        st[sd][to].resume = { ...rs, hp: Math.max(1, rs.hp - hit.dmg) };
        const ors = st[od][cur[od]].resume;
        if (ors) ors.en = Math.min(100, (ors.en || 0) + hit.eg);
        swapHitEv = { side: sd, mv: hit.mv, dmg: hit.dmg };   // 次の対面の頭に表示する
      }
    }
    cur[sd] = to;
    swOk[sd] = gt + GB_SWAP_CD;
    newIn[sd] = true;
  };
  // ステータス(いまの能力変化込み・対面開始時点の近似)。AIの下読み用
  const sbuf = (sd, idx) => {
    const stt = PvpEngine.buildStats(D, ros[sd][idx].base);
    const rs = st[sd][idx].resume;
    return { ...stt, buffs: rs && rs.buffs ? rs.buffs.slice() : [0, 0] };
  };
  // ---- 下読みは**決断のたびに、その瞬間の状態から**やり直す(2026-08-19タダシさん指摘) ----
  // GBLは1手で形勢がひっくり返るので、対面の頭で1回読んだ結果を対面の終わりまで使い回すと、
  // 「もう勝てるようになっているのにシールドを温存し続ける」ような判断のズレが出る。
  // ov = { ov0, ov1 } … その瞬間のHP・ゲージ・能力変化。同じ状態なら計算し直さない(キャッシュのキー)
  // 飛んできたSPアタックを「防いだあと(ダメージ1)」「受けたあと(予測ダメージ)」の状態にする。
  // これを挟まないと、**当たる直前のHPのまま**下読みしてしまい、
  // 「いま食らう一撃を勘定に入れずに『まだ勝てる』と読む」ズレが出る
  const ovHit = (ov, sd, dmg, useSh) => {
    if (!ov) return null;
    const o = { ov0: { ...ov.ov0, buffs: (ov.ov0.buffs || []).slice() },
                ov1: { ...ov.ov1, buffs: (ov.ov1.buffs || []).slice() } };
    const k = sd ? 'ov1' : 'ov0';
    o[k].hp = Math.max(1, o[k].hp - dmg);
    // 防ぐならシールドを1枚使う。ここを減らさずに読むと「まだ2枚ある前提」で強気に読んでしまい、
    // 使っては読み直し…を繰り返してシールドを無駄打ちする(実測でAIが弱くなった)
    if (useSh) o[k]._sh = Math.max(0, (o[k]._sh != null ? o[k]._sh : shLeft[sd]) - 1);
    return o;
  };
  const ovKey = ov => {
    if (!ov || (!ov.ov0 && !ov.ov1)) return '';
    const f = o => o ? [o.hp, o.en, (o.buffs || []).join('/'), o._sh].join(',') : '';
    return f(ov.ov0) + '|' + f(ov.ov1);
  };
  // 起点づくり(farm)の下読み: いまの対面、あいてはSPを1発も撃たなくても勝てるか。
  // 勝てるならノーマルアタックだけで倒してゲージをため、次の相手にSPを撃つ(基本戦術)
  const farmCache = {}, loseCache = {};
  const aiFarmWin = (li, ov) => {
    const ck = li + '#' + ovKey(ov);
    if (!(ck in farmCache)) {
      const R = { ...plainCfg(1, cur[1], ov && ov.ov1), timing: 'shots', shotPlan: [], shotRest: null };
      farmCache[ck] = PvpEngine.simulate(D, plainCfg(0, cur[0], ov && ov.ov0), R, SIMOPT).winner === 1;
    }
    return farmCache[ck];
  };
  // 後の戦況の下読み: いまの状態から、あいては(SPも使って)おまかせで通して負けるか
  const aiLosing = (li, ov) => {
    const ck = li + '#' + ovKey(ov);
    if (!(ck in loseCache)) loseCache[ck] = duelAt(cur[0], cur[1], ov && ov.ov0, ov && ov.ov1).winner !== 1;
    return loseCache[ck];
  };
  // ---- 対面の頭(相手の新しいポケモンが出てきた場面)の交代基準 ----
  // 2026-08-18タダシさんが伝えた詳細な基準をそのまま実装したもの。
  // 「対応力の高いほう」＝ その相手に勝てる幅(残HP・削り)＋わざのタイプの広さ＋耐久 で決める
  // 「対応力の高いほう」＝**まず1対1の勝率（シールドの持ち方を総当たりした勝ち数）**
  // (2026-08-19タダシさん指示: どちらも倒せる状況では「安定して倒せる」＝勝率の高いほうを出す)。
  // 勝率が同じくらいのときだけ、勝ち幅・わざのタイプの広さ・耐久で比べる
  const aiAdaptive = (list, ov) => {
    let best = null;
    for (const { k, r } of list) {
      const margin = 500 * (1 - r.final[0].hp / r.final[0].hpMax) + 500 * (r.final[1].hp / r.final[1].hpMax);
      const P = ros[1][k];
      const types = new Set([P.pol.fast].concat(P.pol.charged || [])
        .map(id => D.moves[id] && D.moves[id].t).filter(Boolean));
      const s2 = PvpEngine.buildStats(D, P.base);
      const w = aiWinRate(k, ov && ov.ov0, null);
      const sc = w.rate * 1e6 + margin + types.size * 60 + s2.def * s2.hp / 1000;
      if (!best || sc > best.sc) best = { k, sc };
    }
    return best ? best.k : null;
  };
  // ①どっちもどっちの対面で、**控えの2匹がどちらもユーザーの初手に強い**なら、
  //   対応力の高いほうへ**即座に交代**する(五分の対面に付き合わず、有利を取りにいく)
  const aiEvenSwitch = (li, ov) => {
    const r = duelAt(cur[0], cur[1], ov && ov.ov0, ov && ov.ov1);
    if (r.winner === 0 || r.winner === 1) return null;   // 勝ち負けがはっきりしている＝五分ではない
    const bench = benches(1);
    if (bench.length < 2) return null;
    const wins = bench.map(k => ({ k, r: duelAt(cur[0], k, ov && ov.ov0, null) }))
      .filter(x => x.r.winner === 1);
    if (wins.length !== bench.length) return null;       // 「2匹ともユーザーの初手に強い」が条件
    return aiAdaptive(wins, ov);
  };
  // ②AIの初手がユーザーの初手に**弱く**、かつ**控えの2匹のうち片方が明らかに弱い**なら、
  //   交代せず残って戦う(残る1匹の答えを安売りしない)。
  //   このとき**シールドは使わない**——不利な状況で無理に受けても非効率だから(タダシさん指示・重要)。
  //   「明らかに弱い」＝その控えでも負け、しかもユーザーのポケモンが半分以上HPを残す
  const weakCache = {};
  const aiStayWeak = (li, ov) => {
    const ck = li + '#' + ovKey(ov);
    if (!(ck in weakCache)) {
      let v = false;
      if (aiLosing(li, ov)) {
        const bench = benches(1);
        v = bench.length >= 2 && bench.some(k => {
          const r = duelAt(cur[0], k, ov && ov.ov0, null);
          return r.winner !== 1 && r.final[0].hp >= r.final[0].hpMax * 0.5;
        });
      }
      weakCache[ck] = v;
    }
    return weakCache[ck];
  };
  // チーム文脈での「ここでシールドを使う価値」(2026-08-18タダシさん指示):
  // ユーザー側の場にいないポケモン(あとで戻ってくる)に勝てるAIの控えが**1匹しかいない**なら、
  // その1匹を後の対面のために温存したい＝いまの対面はシールドを使ってでも確実に突破して場を取る。
  // (例: ユーザーの初手が引っ込んだ。AIの3匹目がその初手に弱いなら、初手処理はAIの初手の役目。
  //  だから交代先のいまの対面はシールドで確実に勝ち切るのが正解)
  // 使う条件は**「シールドを使えば取れるが、使わないと取れない対面」だけ**(2026-08-18タダシさん指示。
  // 軸は「シールドを使えば突破できる対面で、ユーザーの動きに合わせて使う」なので、
  // **使わなくても突破できるなら使わない**)。控えの2匹ともが勝てるなら急所ではないので、
  // ふつうの判断に任せる(温存なら無理に使わない)。
  // 勝てない対面でまで使わない(そこはシールドを後続に残す既存ルールが受け持つ)
  // 「SPを1発入れてから交代すれば裏が勝てる」か(2026-08-18タダシさん指示)。
  // ユーザーが交代してきたが、AIの裏はそのままではそこまで有利にならない。
  // でも**いまのポケモンで少し居残ってSPを撃ってから**下がれば、削り(と能力変化)のぶんで
  // 裏が有利に戦える——そのときは撃つために残る。返り値は撃つべきわざのid(なければnull)。
  // p には決断の時点の状態(st0/st1・HP・ゲージ・能力変化・シールドの残り)が入っている
  const aiSpThenSwap = (ctx, p) => {
    if (!p || !p.st0 || !p.st1) return null;
    const bench = benches(1);
    if (!bench.length || !ctx.spList[1].length) return null;
    const ov1 = { hp: p.st1.hp, en: p.st1.en, buffs: p.st1.b.slice(), stall: 0 };
    const nowOv0 = { hp: p.st0.hp, en: p.st0.en, buffs: p.st0.b.slice(), stall: 0 };
    // いまのまま下がっても勝てる控えがいるなら、この判断は要らない(ふつうの交代でよい)
    if (bench.some(k => duelAt(cur[0], k, nowOv0, null).winner === 1)) return null;
    const att = { ...PvpEngine.buildStats(D, ros[1][cur[1]].base), buffs: p.st1.b.slice() };
    const dfn = { ...PvpEngine.buildStats(D, ros[0][cur[0]].base), buffs: p.st0.b.slice() };
    // 撃てるSPを、軽いほうから試す(同じ効果なら消費が少ないほうがよい)
    const list = ctx.spList[1].map(id => ({ id, m: D.moves[id] }))
      .filter(x => x.m && x.m.e <= p.st1.en).sort((a, b) => a.m.e - b.m.e);
    for (const { id, m } of list) {
      // ユーザーにシールドが残っていればダメージは1。ただし能力変化は防がれても入る
      const dealt = p.st0.sh > 0 ? 1 : PvpEngine.damage(D, m, att, dfn);
      const nb = p.st0.b.slice();
      if (m.bf && m.bt === 'opponent') {   // 相手の能力を下げるわざ(がんせきふうじ等)
        const sc = m.bc == null ? 1 : m.bc;
        nb[0] = Math.max(-4, nb[0] + m.bf[0] * sc);
        nb[1] = Math.max(-4, nb[1] + m.bf[1] * sc);
      }
      const ov0 = { hp: Math.max(1, p.st0.hp - dealt), en: p.st0.en, buffs: nb, stall: 0 };
      if (bench.some(k => duelAt(cur[0], k, ov0, null).winner === 1)) return id;
    }
    return null;
  };
  // ---- ユーザーの控えの裏読み(予測)。実際の控えは見ない ----
  // 見えているポケモンの組み合わせごとに1回だけ作って使い回す
  const predCache = {};
  const aiPredict = () => {
    // HARD(omni): 裏読みではなく**実物の控え**をそのまま使う(手の内を知っているので予測が要らない)。
    // わざも画面の欄の具体値。確率は等分(どれを出してくるかまでは決め打ちしない)
    if (ai.omni) {
      const rest = benches(0);
      const ck = 'omni:' + rest.join(',');
      if (!(ck in predCache)) predCache[ck] = rest.map(i => ({
        k: picks[i].m.key, s: !!picks[i].m.shadow, f: picks[i].pol.fast,
        c1: (picks[i].pol.charged || [])[0] || null, c2: (picks[i].pol.charged || [])[1] || null,
        p: 1 / rest.length }));
      return predCache[ck];
    }
    const ck = [...seen[0]].sort().join(',');
    if (ck in predCache) return predCache[ck];
    const shownIdx = [...seen[0]];
    const shownKeys = shownIdx.map(i => picks[i].m.key);
    const shownSet = new Set(shownKeys);
    const profs = shownKeys.map(k => gbTypeProf(k));
    // 見えている「裏」のポケモン(初手以外)。ABB/ABAの読みに使う
    const back = shownIdx.filter(i => i !== 0)[0];
    const backProf = back != null ? gbTypeProf(picks[back].m.key) : null;
    const rows = [], usedK = new Set();
    gbMetaPool().slice(0, GB_PRED_TOP).forEach((m, idx) => {
      if (shownSet.has(m.k)) return;
      // 環境リストは通常とシャドウが別の行なので、予測では**同じポケモンとしてまとめる**
      // (分けると同じ名前が2つ並び、確率も割れてしまう)。順位が上のほうを代表にする
      if (usedK.has(m.k)) return;
      usedK.add(m.k);
      const q = gbTypeProf(m.k);
      let sc = (GB_PRED_TOP - idx) / GB_PRED_TOP;   // ①採用率(順位が上ほど高い)
      let comp = 0, n = 0;                           // ②相性の補完
      for (const r of profs) for (const t of r.weak) {
        n++;
        if (q.res.has(t)) comp += 1;                 // 見えている子の弱点を受けられる＝組まれやすい
        else if (q.weak.has(t)) comp -= 0.6;         // 同じ弱点が重なる＝組まれにくい
      }
      if (n) sc += 0.9 * (comp / n);
      if (backProf) {                                // ③ABB: 裏の役割が似ていると、残りも似た役割
        const same = [...q.res].filter(t => backProf.res.has(t)).length;
        const tot = new Set([...q.res, ...backProf.res]).size || 1;
        sc += 0.35 * (same / tot);
      }
      rows.push({ k: m.k, s: !!m.s, f: m.f, c1: m.c1, c2: m.c2, sc: Math.max(0.01, sc) });
    });
    rows.sort((a, b) => b.sc - a.sc);
    const top = rows.slice(0, GB_PRED_N);
    // 確率にする。素の点数の比だとほぼ横並び(19〜24%)になって読みが効かないので、
    // 差を強調してから正規化する(それでも断定はせず、あくまで重み)
    top.forEach(r => { r.w = Math.exp(r.sc * 3); });
    const sum = top.reduce((t, r) => t + r.w, 0) || 1;
    top.forEach(r => { r.p = r.w / sum; });
    predCache[ck] = top;
    return top;
  };
  // 予測した相手に対する強さ(シミュではなく軽い式。優先度の低いタイブレークなので精度より速さ)
  const predCache2 = {};
  const aiPredScore = k => {
    // omniのときは「見えた順」ではなく控えの実物でキーを作る(倒れて控えが減ったら読み直す)
    const ck = k + '|' + (ai.omni ? 'omni:' + benches(0).join(',') : [...seen[0]].sort().join(','));
    if (ck in predCache2) return predCache2[ck];
    const list = aiPredict();
    const P = ros[1][k];
    const me = { ...PvpEngine.buildStats(D, P.base), buffs: [0, 0] };
    let s = 0;
    for (const c of list) {
      const foe = { ...PvpEngine.buildStats(D, ptRoughBase(c.k, !!c.s)), buffs: [0, 0] };
      const mp = movePool(c.k);
      const mine = ptBestDpt([P.pol.fast], P.pol.charged || [], me, foe);
      const theirs = ptBestDpt(c.f ? [c.f] : mp.fasts,
        [c.c1, c.c2].filter(Boolean).length ? [c.c1, c.c2].filter(Boolean) : mp.chargeds, foe, me);
      if (!mine || !theirs) continue;
      s += c.p * Math.min(2.5, (me.hp / theirs) / (foe.hp / mine));
    }
    predCache2[ck] = s;
    return s;
  };
  // 倒されたあと「次に誰を出すか」(2026-08-18タダシさん指示・基本理念「効率よく行動する」)。
  // 順番は次のとおり:
  //  ①**起点にできる候補**をさがす＝いまのユーザーのポケモンを**SPアタックを1発も撃たずに**倒せて、
  //    かつ**撃ち返されても痛手にならない**(ユーザーのいまのゲージで撃てるSPが、その候補の残りHPの
  //    40%未満)。ここに入るなら、有利不利にかかわらず出してよい＝ノーマルアタックだけで倒してためる
  //  ②起点にできる候補が複数なら **まだ見せていない3匹目は温存**して、すでに見せたポケモンから出す
  //    (手の内を隠す。タダシさん指示)
  //  ③**ノーマルアタックのチャージ効率が高いほう**(1ターンあたりのゲージ増)。
  //    起点づくりの目的はゲージをためることなので、より多くためられるポケモンが向いている
  //    (2026-08-18タダシさん指示)
  //  ④チャージ効率が同じくらい(15%以内)なら **被ダメージが少ないほう**を出す
  //    (相手のノーマルアタックとSPアタックの両方で見る)
  //  ⑤**ユーザーの控えの裏読み**(採用率・相性の補完・並びの型からの予測)。断定できない読みなので
  //    **重みをいちばん小さく**する(2026-08-18タダシさん指示)＝上の基準が拮抗したときだけ効く
  //  ②〜⑤は**順番に比べるのではなく点数を足して比べる**。順番待ちだと②でほぼ決着してしまい、
  //  ⑤に順番が回ってこない(実測: 候補が並ぶ30場面すべてが②〜④で決着し、⑤の出番は0回だった)
  //  ⑥起点にできる候補が無ければ、従来どおり「その相手にいちばん強い1匹」を出す
  const aiNextPick = rest => {
    if (!rest || !rest.length) return null;
    if (rest.length === 1) return rest[0];
    const u = cur[0], P0 = ros[0][u];
    // 同じターンにこちらも倒れて、相手が出し直す前(cur[0]が未確定)なら順番どおりに任せる
    if (!P0 || !st[0][u]) return null;
    const uRs = st[0][u].resume;
    const uEn = uRs ? (uRs.en || 0) : 0;
    const att = { ...PvpEngine.buildStats(D, P0.base), buffs: uRs && uRs.buffs ? uRs.buffs.slice() : [0, 0] };
    const uFast = D.moves[P0.pol.fast];
    const uSp = (P0.pol.charged || []).map(id => D.moves[id]).filter(Boolean);
    const rows = rest.map(k => {
      const stK = PvpEngine.buildStats(D, ros[1][k].base);
      const rsK = st[1][k].resume;
      const dfn = { ...stK, buffs: rsK && rsK.buffs ? rsK.buffs.slice() : [0, 0] };
      const hpK = rsK ? Math.max(1, rsK.hp) : stK.hp;
      // 被ダメージ: ノーマルアタック(1ターンあたり)とSPアタック(いちばん痛い1発)を残HP比で見る
      const fd = uFast ? PvpEngine.damage(D, uFast, att, dfn) / (uFast.tn || 1) : 0;
      const sdMax = uSp.length ? Math.max(...uSp.map(m => PvpEngine.damage(D, m, att, dfn))) : 0;
      // いまのゲージで実際に撃てるSPの痛さ(これが小さければ「撃たれても痛手にならない」)
      const nowSp = uSp.filter(m => m.e <= uEn);
      const sdNow = nowSp.length ? Math.max(...nowSp.map(m => PvpEngine.damage(D, m, att, dfn))) : 0;
      // SPを1発も撃たずに倒しきれるか(＝起点にできるか)
      const R = { ...plainCfg(1, k), timing: 'shots', shotPlan: [], shotRest: null };
      const farm = PvpEngine.simulate(D, plainCfg(0, u), R, SIMOPT).winner === 1;
      const r = duel(u, k);
      const win = r.winner === 1;
      const margin = 500 * (1 - r.final[0].hp / r.final[0].hpMax) + 500 * (r.final[1].hp / r.final[1].hpMax);
      // チャージ効率＝1ターンあたりのゲージ増(起点づくりに向いているかの本体)
      const myFast = D.moves[ros[1][k].pol.fast];
      const gain = myFast ? (myFast.eg || 0) / (myFast.tn || 1) : 0;
      return { k, farm, safe: sdNow < GB_FARM_HURT * hpK, take: fd / hpK * 100 + sdMax / hpK * 50,
        gain, shown: seen[1].has(k), win, margin };
    });
    const farmers = rows.filter(r => r.farm && r.safe);
    if (farmers.length) {
      // ③チャージ効率は「同じくらい(15%以内)」なら横並びとして④被ダメージで決める
      // **順番に比べるのではなく点数で決める**(2026-08-18)。
      // 順番待ちだと、上の基準(とくに「3匹目の温存」)でほぼ決着してしまい、
      // 優先度の低い⑤裏読みに**一生順番が回ってこない**(実測で256編成中0回だった)。
      // 点数なら、上の基準が拮抗したときにだけ裏読みが結論を動かせる
      const top = Math.max(...farmers.map(r => r.gain));
      const score = r =>
        (r.shown ? GB_W_SHOWN : 0)                                  // ②見せていない3匹目の温存(最重視)
        + (top > 0 ? r.gain / top : 0) * GB_W_GAIN                  // ③チャージ効率
        - r.take * GB_W_TAKE                                        // ④被ダメージ
        + aiPredScore(r.k) * GB_W_PRED;                             // ⑤裏読み(重みは小さく)
      farmers.sort((a, b) => score(b) - score(a) || a.margin - b.margin);
      return farmers[0].k;
    }
    // ④起点にできないなら、その相手にいちばん強い1匹で受ける
    // 起点にできる候補が無いときは「その相手にいちばん強い1匹」。
    // **勝敗が並んだら勝率(シールド総当たり)が高いほう＝安定して倒せるほう**を出す
    // (2026-08-19タダシさん指示)。それも並んだら裏読みで決める(優先度は最低)
    const wr = k => aiWinRate(k, null, null);
    const rateTie = (x, y) => Math.abs(wr(x.k).rate - wr(y.k).rate) < 0.01;
    const marginTie = (x, y) => Math.abs(x.margin - y.margin) <= GB_MARGIN_TIE;
    const best = rows.slice().sort((a, b) => (b.win ? 1 : 0) - (a.win ? 1 : 0)
      || (rateTie(a, b) ? 0 : wr(b.k).rate - wr(a.k).rate)   // 安定して倒せるほう
      || (marginTie(a, b) ? 0 : b.margin - a.margin)
      || aiPredScore(b.k) - aiPredScore(a.k)
      || b.margin - a.margin)[0];
    return best ? best.k : null;
  };
  const shvCache = {};
  const teamShieldValue = (li, ov, freeOv) => {
    const ck = li + '#' + ovKey(ov) + '#' + ovKey(freeOv);
    if (!(ck in shvCache)) {
      let v = null;
      // ユーザーの控えは**一度でも場に出たもの**だけ数える(まだ見ていないポケモンは知らない)
      const myBench = benches(1), userOff = revealed0();
      // シールド無しでも取れる対面なら、そもそも使う必要がない
      // 「使わなくても取れる対面」か＝この一撃を受けたあと、以後もシールド無しで勝てるか
      const fo = freeOv || ov;
      const freeWin = () => PvpEngine.simulate(D, plainCfg(0, cur[0], fo && fo.ov0),
        { ...plainCfg(1, cur[1], fo && fo.ov1), shields: 0 }, SIMOPT).winner === 1;
      if (myBench.length && userOff.length && shLeft[1] > 0 && !aiLosing(li, ov) && !freeWin()) {
        for (const u of userOff) {
          let winners = 0;
          for (const k of myBench) if (duelAt(u, k).winner === 1) winners++;
          if (winners === 1) { v = 'use'; break; }
        }
      }
      shvCache[ck] = v;
    }
    return shvCache[ck];
  };
  // ---- HARD専用: シールドの使い先を総当たりで最後まで読む(2026-08-30タダシさん指示) ----
  // HARDは「コンピュータができる限りの最適な行動」が前提。いま防ぐか・あとの一撃のために
  // 取っておくかを、残り枚数の使い先(この先の何発目を防ぐか)の全組み合わせで
  // 対面の最後までシミュレートして決める。デバフが重なって後の一撃ほど痛くなる相手
  // (サイコファング連打など)では、個別ルールを書かなくても
  // 「安い序盤を受けて高い終盤を防ぐ」が自動で正解になる。
  // 視野はこの先6発(1つの対面でSPが6発を超えることはまず無い)
  const SH_HORIZON = 6;
  const shPlansOf = n => {   // 「この先の何発目を防ぐか」の全組み合わせ(要素数はn枚まで)
    const out = [[]];
    const rec = (start, acc) => {
      if (acc.length >= n) return;
      for (let i = start; i <= SH_HORIZON; i++) { const a = acc.concat(i); out.push(a); rec(i + 1, a); }
    };
    rec(1, []);
    return out;
  };
  // その状態から使い先の最良の結末を点数化する。勝ち＝残りHP＋残した枚数の持ち越し価値 ／
  // 負け＝相手をどれだけ削れたか＋持ち越し価値。持ち越し価値は「1枚＝最大HPの30%ぶんの一撃を
  // 防げる権利」(GB_SHIELD_BIG)で、バトルがこの対面で終わるなら0
  const shAllocCache = {};
  const shAllocScore = (li, ov) => {
    const ck = li + '#' + ovKey(ov);
    if (ck in shAllocCache) return shAllocCache[ck];
    const sh1 = ov && ov.ov1 && ov.ov1._sh != null ? ov.ov1._sh : shLeft[1];
    let best = -Infinity;
    for (const plan of shPlansOf(sh1)) {
      const r = PvpEngine.simulate(D, plainCfg(0, cur[0], ov && ov.ov0),
        { ...plainCfg(1, cur[1], ov && ov.ov1), shieldPlan: plan }, SIMOPT);
      const F = r.final;
      let sc;
      if (r.winner === 1) {
        const carry = benches(0).length ? GB_SHIELD_BIG * F[1].hpMax : 0;
        sc = 1e6 + F[1].hp + carry * F[1].shields;
      } else {
        const carry = benches(1).length ? GB_SHIELD_BIG * F[1].hpMax : 0;
        sc = (F[0].hpMax - F[0].hp) + carry * F[1].shields;
      }
      if (sc > best) best = sc;
    }
    shAllocCache[ck] = best;
    return best;
  };
  // あいてのAIの自動回答(ansに答えがあればそちらが優先される)。
  // **下読みは決断のたびに、その瞬間の状態(p.st0/p.st1)から読み直す**(2026-08-19タダシさん指摘)
  const aiAnswer = (p, ctx) => {
    // その瞬間のHP・ゲージ・能力変化・**シールドの残り枚数**。
    // 枚数まで入れないと「相手はまだ2枚持っている」と読んで、AIが弱気になる(実測で判明)
    const nowOv = p.st0 && p.st1 ? {
      ov0: { hp: p.st0.hp, en: p.st0.en, buffs: p.st0.b.slice(), stall: 0, _sh: p.st0.sh },
      ov1: { hp: p.st1.hp, en: p.st1.en, buffs: p.st1.b.slice(), stall: 0, _sh: p.st1.sh } } : null;
    if (p.kind === 'sp') {
      // EASY(spam): SPアタックは撃てるようになったら**すぐ撃つ**。ただし
      // 2本持っていても**消費の軽いわざしか使わない**(入門向けの相手)。
      // 「反応がノーマルアタック1発ぶんおくれる」案は不採用(2026-08-20タダシさん指示。
      // 初心者のレートでも画面連打は常にするので、撃てるようになってからの遅れは実態に合わない)。
      // タイミングをエンジンの最適(auto)に任せず、この場で名指しして即撃ちする
      if (ai.spam) {
        const av = ctx.spList[p.side].map(id => ({ id, m: D.moves[id] }))
          .filter(x => x.m && x.m.e <= (p.en != null ? p.en : 0)).sort((a, b) => a.m.e - b.m.e)[0];
        return av ? { a: 'fire', mv: av.id } : { a: 'auto' };
      }
      // **ノーマルアタックだけで倒しきれる相手にはSPを撃たない**(2026-08-20タダシさん指示)。
      // 残りHPわずかな相手にSPを使うのはもったいない・ふつうはやらない。
      // 条件は「撃たなくても倒しきれる」＋「相手のSPも飛んでこない」。ゲージは次の対面へ持ち越す。
      // **確定自己バフSPの即打ち(2026-08-19)よりもこちらを優先**する(実例: HPわずかなウッウに
      // モルペコがオーラぐるまを撃っていた。バフ即打ちルールが先に効いていたため)
      if ((ai.sw || ai.farm) && ctx.finishNoSp && ctx.finishNoSp(p)) return { a: 'hold' };
      // **確定で自分の能力が上がるSPは即打ち**(2026-08-19タダシさん指示)。
      // 上がった能力はその対面のあいだ効き続けるので、早く撃つほど得
      // (例: オコリザルの「ふんどのこぶし」=確定で攻撃+1。ノーマルアタックが2ターンなら
      //  待つ理由がなく、能力が上がるならなおさら即打ちが正解)。
      // 起点づくりでゲージをためる判断より優先する
      if (ai.sw || ai.farm) {
        const buff = ctx.spList[p.side].map(id => ({ id, m: D.moves[id] })).filter(x => {
          const m = x.m;
          return m && m.bf && m.bt !== 'opponent' && (m.bc == null || m.bc >= 1)
            && (m.bf[0] > 0 || m.bf[1] > 0);
        }).sort((x, y) => x.m.e - y.m.e)[0];
        if (buff) return { a: 'fire', mv: buff.id };
      }
      // 起点づくり: 撃たなくても勝てる対面では撃たず、ゲージを次の相手に持ち越す。
      // ただし**ゲージが満タン(100)に近づいたら撃つ**(2026-08-19タダシさん報告で修正)。
      // 「撃たない」と一度答えるとその対面では二度と撃たなくなるので、満タンでも撃たず
      // ゲージを捨てていた。ためる意味があるあいだだけ待って、無駄になる手前で撃つ
      if (ai.farm && aiFarmWin(ctx.li, nowOv)) {
        const fm = D.moves[ctx.fast[p.side]];
        const eg = fm ? (fm.eg || 0) : 0;
        const en = p.en != null ? p.en : 0;
        if (eg > 0 && en + eg * 2 <= 100) {
          // 満タンの一歩手前までノーマルアタックで引っぱる(そこでもう一度考える)
          return { a: 'wait', n: Math.max(1, Math.floor((100 - en) / eg) - 1) };
        }
        // これ以上ためても無駄になるので撃つ。**おまかせ(auto)では溜めた意味が消える**
        // (auto は「発ごとの指定」を捨ててエンジンの最適タイミングに任せるので、
        //  ためる前の早い段階で撃ったことになってしまう)。撃つわざを名指しして、
        //  ここまで引っぱった位置で発射させる。わざは**いちばん軽いもの**
        //  (ためたぶんを無駄なく吐き出せて、続けてもう1発にもつなげやすい)
        const av = ctx.spList[p.side].map(id => ({ id, m: D.moves[id] }))
          .filter(x => x.m && x.m.e <= en).sort((a, b) => a.m.e - b.m.e)[0];
        return av ? { a: 'fire', mv: av.id } : { a: 'auto' };
      }
      // 「撃ってから交代」(2026-08-18タダシさん指示): このまま下がっても裏が有利にならないが、
      // ここでSPを入れてから下がれば裏が勝てる——というときは、待たずにすぐ撃って下がる準備をする
      if (ai.sw && aiLosing(ctx.li, nowOv)) {
        const mv = aiSpThenSwap(ctx, p);
        if (mv) return { a: 'fire', mv };
      }
      // ---- 「重いわざぶんためてから撃つ」セオリー(2026-08-20タダシさん指示・基本中の基本) ----
      // 相手はどちらのSPが飛んでくるか分からないので、シールドを使うかの読み合いになる。
      // だから本命の重いわざが撃てるゲージまでためてから、(ブラフでもブラフでなくても)撃つのがセオリー。
      // ためきったら**軽いほう**を撃つ＝防がれてもゲージが残り、重いわざの脅威も消えない。
      // ためない例外: ①余裕がない(この対面が負け読み) ②見せかけの必要がない
      // (軽いわざが弱点を突く／重いわざが等倍未満で本命にならない) ③相手のシールドが無い
      // **ただし軽いわざが相手の耐性で軽減されるときは、負け読みでもためる**
      // (2026-08-31タダシさん指示。例: ザシアン対メガミュウツーX——かくとう耐性の相手に
      //  インファイトを即打ちするのはおかしい。きょじゅうざんの脅威を作ってから
      //  ブラフで軽いわざを撃つ(そして打ち逃げ)が正しい。シールドが無い相手なら下のautoに落ち、
      //  エンジンの効率判断が等倍の重いわざを選ぶので即打ち事故は起きない)
      if (ai.bluff && p.st0 && p.st0.sh > 0) {
        const mvs = ctx.spList[p.side].map(id => ({ id, m: D.moves[id] })).filter(x => x.m)
          .sort((a, b) => a.m.e - b.m.e);
        if (mvs.length >= 2 && mvs[mvs.length - 1].m.e > mvs[0].m.e) {
          const light = mvs[0], heavy = mvs[mvs.length - 1];
          const uTy = D.pokemon[ros[0][cur[0]].m.key].ty;
          const effL = PvpEngine.effectiveness(D, light.m.t, uTy);
          const effH = PvpEngine.effectiveness(D, heavy.m.t, uTy);
          if (effH >= 1 && effL < 1.6 && (effL < 1 || !aiLosing(ctx.li, nowOv))) {
            const en = p.en != null ? p.en : 0;
            const fm = D.moves[ctx.fast[p.side]];
            const eg = fm ? (fm.eg || 0) : 0;
            if (en < heavy.m.e && eg > 0)
              return { a: 'wait', n: Math.max(1, Math.ceil((heavy.m.e - en) / eg)) };
            if (en >= heavy.m.e) return { a: 'fire', mv: light.id };
          }
        }
      }
      return { a: 'auto' };
    }
    if (p.kind === 'sh') {
      // インチキ防止(2026-08-18タダシさん指示): 実際に飛んできたわざでは判断しない。
      // ユーザー側のわざ構成とゲージから「撃ってくる可能性の高いわざ」を予測して判断する
      // (予測=倒しきれるわざがあればそれ、なければ能力変化込みの効率が高いほう。
      //  なので軽いわざのブラフには正しく引っ掛かる)。
      // **HARD(truth)だけは明示的な例外**(2026-08-20タダシさん指示):
      // 実際に飛んでくるわざのダメージそのもので判断する＝**ブラフが効かない**
      let predDmg;
      if (ai.truth) predDmg = p.dmg || 0;
      else {
        const att = { ...sbuf(0, cur[0]), buffs: p.st0 ? p.st0.b.slice() : sbuf(0, cur[0]).buffs };
        const dfn = { ...sbuf(1, cur[1]), buffs: p.st1 ? p.st1.b.slice() : sbuf(1, cur[1]).buffs };
        const dmgOf = m => PvpEngine.damage(D, m, att, dfn);
        const cand = ctx.spList[0].map(id => D.moves[id]).filter(m => m && m.e <= (p.enB || 0));
        let pred = null;
        if (cand.length) {
          const lethal = cand.filter(m => dmgOf(m) >= (p.hpB || 0)).sort((a, b) => a.e - b.e)[0];
          pred = lethal || cand.slice().sort((a, b) =>
            dmgOf(b) * PvpEngine.buffAdj(b) / b.e - dmgOf(a) * PvpEngine.buffAdj(a) / a.e)[0];
        }
        predDmg = pred ? dmgOf(pred) : (p.dmg || 0);
      }
      // ---- 下読みは「この一撃をどう処理したあと」の状態で行う(2026-08-19タダシさん指摘) ----
      // blockOv=防いだあと(ダメージ1) ／ takeOv=受けたあと(予測ダメージ)。
      // 「どうせ負け」の判定は**防いでも負けるか**で見る(受けたあとで見ると、
      //  受けたせいで負けになる＝受ける理由が自分で作れてしまう)
      const blockOv = ovHit(nowOv, p.side, 1, true);
      const takeOv = ovHit(nowOv, p.side, predDmg);
      // 不利な初手対面で「残って戦う」と決めた場面では**シールドを使わない**
      // (不利な状況で無理に受けても非効率。2026-08-18タダシさん指示・重要)
      if (ai.sw && aiStayWeak(ctx.li, blockOv)) return { a: 'no' };
      // ---- HARDは読み切りで決める(2026-08-30タダシさん指示) ----
      // 「いま防ぐ」と「あとの一撃のために取っておく」を、使い先の全組み合わせで最後まで
      // シミュレートして良いほうを選ぶ。teamShieldValueの「勝ちを取りにいく」判断も
      // 読み切りの勝ち優先の点数に含まれるので、HARDではこちらに一本化する
      if (ai.truth) {
        // どうせ負けの対面ならシールドは後続へ(温存ルールは読み切りより優先)
        if (benches(1).length && aiLosing(ctx.li, blockOv)) return { a: 'no' };
        if (p.hpB && predDmg >= p.hpB) return { a: 'use' };   // 受けたら倒される一撃は防ぐ
        // 同点なら「いま確実に防ぐ」ほうを取る。この先の読みは、実際のAIの駆け引き
        // (重いわざぶんためてから撃つ等)と完全には一致しないので、
        // 同じ結末予測なら確実な現在を優先する(実測: ここを「受ける」にすると
        // ためのぶん読みとずれて、取れたはずの対面を落とすことがあった)
        return { a: shAllocScore(ctx.li, blockOv) >= shAllocScore(ctx.li, takeOv) ? 'use' : 'no' };
      }
      // チーム文脈: いまの対面を確実に取る価値が高い(勝てる控えが1匹だけの相手が戻ってくる)なら、
      // 逃げ回り・温存のAIはためらわずシールドを使って突破する
      if ((ai.sw || ai.save) && teamShieldValue(ctx.li, blockOv, takeOv) === 'use') return { a: 'use' };
      if (!ai.save) return { a: 'use' };
      // 後の戦況: どうせ負けの対面なら(倒される一撃でも)受けて、シールドは後続のために残す。
      // 控えがいないときは残す先が無いので、ふつうに判断する
      if (benches(1).length && aiLosing(ctx.li, blockOv)) return { a: 'no' };
      if (p.hpB && predDmg >= p.hpB) return { a: 'use' };   // 倒される予測なら防ぐ
      return predDmg >= GB_SHIELD_BIG * ctx.maxHp[1] ? { a: 'use' } : { a: 'no' };
    }
    if (p.kind === 'swap') {
      if (!ai.sw) return { a: 'stay' };
      // 対面の途中の質問(SPを撃った直後・デバフを受けた直後)は、その瞬間の状態で下読みする。
      // これがあるので「SPで削ってから交代すれば裏が勝てる」という判断が成り立つ
      const ov = nowOv || {};
      // 受けたデバフの下げ消し交代(w=1・2026-08-18タダシさん指示):
      // それなりに有利ならそのまま戦い、不利かどっちもどっちなら交代でリセット。
      // ただし勝てる控えがいなければ残って戦う
      if (p.w === 1) {
        const lockedW = ctx.swOk[0] - (p.ck != null ? p.ck : ctx.base + p.tn) >= GB_LOCK_MIN;
        const to = aiSwapTo(1, { even: true, guard: !(lockedW || ctx.swTo[0].length === 0), ...ov });
        return to == null ? { a: 'stay' } : { a: 'toq', to };
      }
      // ---- 打ち逃げ(2026-08-31タダシさん指示・恒久ルール) ----
      // 『交代が可能な場面でデバフ技を打つ時は必ず交代する』。**自分の能力が下がるSP**を
      // 撃った直後の質問(seq>0・dbf)は、デバフを背負ったまま残らず**必ず交代してリセットする**
      // (この質問は交代できる場面でしか出ない)。行き先は勝てる控えを最優先、
      // いなければ形勢のいちばんマシな控え(aiKeepSwap)。
      // HARDの「自分から逃げ交代しない」ガードより優先する明示的な例外。
      // **デバフ技でないSP(逃げ回りの吐き出し)は対象外**(2026-08-31同日タダシさん指摘で限定:
      // ミラーのサイコブレイクをシールドで防いで勝ち対面を取ったのに交代してしまった。
      // こちらは下の従来判断に落ちる=勝っている対面なら残ってそのまま倒す)
      if (p.seq > 0 && p.dbf) {
        const to = aiKeepSwap(nowOv);
        if (to != null) return { a: 'toq', to };
        return { a: 'stay' };   // 控えがいない保険(質問の条件上ほぼ通らない)
      }
      // ---- 出し勝った初手の温存(2026-08-30タダシさん指示・上級者の動き・NORMALから適用) ----
      // ユーザーは**交代できたのに**不利な対面から交代せず倒された(ABAで出し負けた形)＝
      // 「裏にこのポケモンが苦手なもう1匹がいる」と知らせたのと同じ。
      // 勝ったこのポケモンには後で必ず仕事があるので、ユーザーの次のポケモンが出てきたら
      // **すぐ他へ交代して温存する**。残りHPが2割以下なら温存する価値が薄いのでふつうの判断に戻す。
      // これが「有利対面をとっているのにあえて交代する」例外パターンの1つ目
      if (p.seq === 0 && ctx.keepLead && ctx.koIn && ctx.koIn[0]) {
        const hpFrac = p.st1 ? p.st1.hp / ctx.maxHp[1] : 1;
        let go = hpFrac >= GB_KEEP_HP;   // 残り35%以上なら温存の価値あり=すぐ交代
        if (!go) {
          // 35%未満は基本そのまま戦う。ただし**SPを1発も撃てずにノーマルアタックだけで
          // 倒される**(=ユーザーに起点にされてゲージを献上するだけ)ときに限り、それでも逃がす
          // (2026-08-31タダシさん指示)
          const r = duelAt(cur[0], cur[1], nowOv && nowOv.ov0, nowOv && nowOv.ov1);
          if (r.winner === 0 && !rbTurns(r).some(t => t.ev[1].some(e => e.full !== undefined)))
            go = true;
        }
        if (go) {
          const to = aiKeepSwap(nowOv);
          if (to != null) return { a: 'toq', to };
        }
      }
      // ---- 答えの温存(2026-08-20タダシさん指示・基本の考え方) ----
      // 相手が**自分から**交代した場面(開幕交代・手動交代)では、いま場にいるこのポケモンが
      // 「引っ込んだ相手への答え」(=その相手に勝てる)なら、あとで必ず戻ってくるその相手のために温存する。
      // 例: ウッウ対モルペコでウッウがハガネールに逃げた → モルペコはウッウ担当のまま下げて、
      // ハガネールには勝てる控えを差し込む。**いまの対面に勝てるかどうかより役割の割り当てを守る**
      // (モルペコがハガネールにシミュ上勝てる場合でも、接戦を拾いにいかず割り当てを優先する)
      if (p.seq === 0 && ctx.chase && went0 != null && went0 !== cur[0]
          && st[0][went0] && st[0][went0].alive
          && duelAt(went0, cur[1], null, nowOv && nowOv.ov1).winner === 1) {
        const to = aiSwapTo(1, { force: true, ...(nowOv || {}) });
        if (to != null) return { a: 'toq', to };
      }
      // ---- 対面の頭の基準(2026-08-18タダシさんが伝えた詳細ルール) ----
      if (p.seq === 0) {
        // ②不利な対面でも、控えの片方が明らかに弱いなら交代せず残って戦う
        //   (残る1匹の答えを安売りしない。このときシールドも使わない＝上のsh分岐)
        if (aiStayWeak(ctx.li, nowOv)) return { a: 'stay' };
        // ①どっちもどっちの対面で、控えの2匹がどちらもユーザーの初手に強いなら、
        //   対応力の高いほうへ即座に交代する
        const ev = aiEvenSwitch(ctx.li, nowOv);
        if (ev != null) return { a: 'toq', to: ev };
      }
      // クールタイム狙い(2026-08-18タダシさん承認): 相手が交代できないあいだ(残り20秒以上)は、
      // どっちもどっちの対面でも有利な控えを差し込む(相手は逃げられない)。相手が自由なら負けのときだけ
      const locked = ctx.swOk[0] - (p.ck != null ? p.ck : ctx.base + p.tn) >= GB_LOCK_MIN;
      // **手持ちがラスト1匹**のときも同じ扱い(2026-08-19タダシさん指示)。
      // 交代先そのものが無いので、こちらが有利対面を取りに動いても逃げられない
      const noEsc = locked || ctx.swTo[0].length === 0;
      // **追っている側は対面を維持したい**(2026-08-19タダシさん指示)。
      // ユーザーが不利で逃げた直後は主導権がこちらにあるので、五分の対面に付き合わず、
      // 安定して突破できる(勝率の高い)控えがいるなら出して対面を取り続ける
      const to = aiSwapTo(1, { even: noEsc || (p.seq === 0 && ctx.chase), guard: !noEsc, ...ov });
      if (to == null) {
        // 勝てる控えが無い＝いま下がっても有利にならない。ただし
        // **SPを1発入れてから下がれば裏が勝てる**なら、撃つために残る(2026-08-18タダシさん指示)。
        // 撃った直後にまた交代の質問が出るので、そこで実際に下がる
        if (p.seq === 0 && aiSpThenSwap(ctx, p)) return { a: 'stay' };
        return { a: 'stay' };   // 勝てる対面(または打つ手が無い)なら残る
      }
      // 不利対面: 「撃ってから交代」は状況判断(2026-08-18タダシさん指示)。
      // ゲージは交代しても残るので、撃つのは「ちゃんと当たって効く」ときだけ:
      //  - 相手にシールドが残っている(防がれる)なら撃たずにすぐ交代
      //  - 当ててもダメージが薄い(相手の現在HPの25%未満)なら撃たずにすぐ交代
      if (p.seq === 0 && ctx.spList[1].length && ctx.enAt[1] >= ctx.cost[1] && shLeft[0] === 0) {
        const att = sbuf(1, cur[1]), dfn = sbuf(0, cur[0]);
        const rs0 = st[0][cur[0]].resume;
        const myHp = rs0 ? rs0.hp : ctx.maxHp[0];
        const best = Math.max(0, ...ctx.spList[1].map(id => D.moves[id])
          .filter(m => m && m.e <= ctx.enAt[1]).map(m => PvpEngine.damage(D, m, att, dfn)));
        if (best >= myHp || best >= GB_DUMP_WORTH * myHp) return { a: 'stay' };
      }
      return { a: 'toq', to };
    }
    if (p.kind === 'next') {
      // 倒されたあと、次に出すポケモンを選ぶ。逃げ回りのAIだけ(それ以外は次の枠の順)。
      // **タイプ相性や勝てるかどうかだけで決めない**(2026-08-18タダシさん指示・戦いの基本理念
      // 「なるべく無駄な動きはせず効率よく行動する」)。ユーザーのゲージが乏しくてSPアタックを
      // 撃たれない(撃たれても痛手にならない)なら、**あえて有利でないポケモンを出して起点にする**
      // ＝ノーマルアタックだけで倒してゲージをため、有利なポケモンは後の対面のために取っておく
      if (!ai.sw) return { a: 'order' };
      const to = aiNextPick(ctx.swTo[1]);
      return to == null ? { a: 'order' } : { a: 'to', to };
    }
    return { a: 'order' };
  };

  // 開幕交代の実行。交代先には**相手の打ちかけのノーマルアタック1発**が入り、相手はそのぶん
  // ゲージを得る(両者が同時に交代したときは無し)。次の交代は45秒後
  const doLead = (sd, to, withHit) => {
    const od = 1 - sd;
    if (sd === 0) went0 = cur[0];   // 開幕交代で引っ込んだ初手(答えの温存の対象)
    gulpOff(st[sd][cur[sd]].resume);   // ウッウ: 場を離れると通常の姿に戻る
    const hit = withHit ? swapHit(sd, to) : null;
    const maxB = PvpEngine.buildStats(D, ros[sd][to].base).hp;
    st[sd][to].resume = { hp: Math.max(1, maxB - (hit ? hit.dmg : 0)), en: 0, buffs: [0, 0], stall: 0 };
    const o = st[od][cur[od]].resume;
    const maxO = PvpEngine.buildStats(D, ros[od][cur[od]].base).hp;
    st[od][cur[od]].resume = { hp: o ? o.hp : maxO,
      en: Math.min(100, (o ? o.en || 0 : 0) + (hit ? hit.eg : 0)), buffs: [0, 0], stall: 0 };
    cur[sd] = to;
    swOk[sd] = GB_SWAP_CD;
    leadHits[sd] = hit && { side: sd, mv: hit.mv, dmg: hit.dmg };
  };
  // あいての開幕交代の判断(2026-08-19タダシさん指示)。基準は**対面の頭の交代とそろえる**:
  // 出し負けていて勝てる控えがいるなら出る／控えの片方が明らかに弱いなら残って戦う／
  // どっちもどっちで控えの2匹とも初手に強いなら、対応力の高いほうへ即座に交代する。
  // 下読みのキャッシュは対面(li)ごとなので、開幕の判断は 'lead' という別のキーで持つ
  // (対面0のキャッシュを汚すと、交代後の対面で古い読みが使い回されてしまう)
  const aiLead = () => {
    if (aiStayWeak('lead', null)) return { a: 'stay' };
    const ev = aiEvenSwitch('lead', null);
    if (ev != null) return { a: 'to', to: ev };
    const to = aiSwapTo(1, {});
    return to == null ? { a: 'stay' } : { a: 'to', to };
  };

  // ---- 開幕交代(0秒・両者が同時に決める) ----
  // **おたがい相手の選択は見えない**(AIはずるをしない・恒久ルール)ので、あいての判断は
  // ユーザーが開幕交代する**前**の初手に対して行う
  const leadTo = [null, null];
  if (foes.length && picks.length) {
    // じぶん: 枠の「開幕交代」トグルがONのときだけ(交代先は選ぶ)
    if (MK.leadSwap && picks.length > 1) {
      const key = gbKey(0, 0, 'lead', 0, 0);
      const lctx = { li: 0, base: 0, ros, swTo: [benches(0), benches(1)] };
      const opts = gbChoices({ kind: 'lead', side: 0 }, lctx);
      const a = ans[key] || (stepwise ? null : { a: 'to', to: 1 });
      if (!a) pending = { kind: 'lead', side: 0, seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts };
      else {
        if (a.a !== 'stay' && picks[a.to]) leadTo[0] = a.to;
        else if (a.a !== 'stay') leadTo[0] = 1;
        leadPts[0] = { kind: 'lead', side: 0, seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts,
          ans: a, auto: !ans[key] };
      }
    }
    // あいて: 自分から交代するAI(NORMAL・HARD)のときだけ。チップをタップして選び直せる
    if (!pending && ai.sw && foes.length > 1) {
      const key = gbKey(0, 1, 'lead', 0, 0);
      const lctx = { li: 0, base: 0, ros, swTo: [benches(0), benches(1)] };
      const opts = gbChoices({ kind: 'lead', side: 1 }, lctx);
      const a = ans[key] || aiLead();
      if (a.a !== 'stay' && foes[a.to]) leadTo[1] = a.to;
      leadPts[1] = { kind: 'lead', side: 1, seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts,
        ans: a, auto: !ans[key] };
    }
  }
  if (!pending && (leadTo[0] != null || leadTo[1] != null)) {
    const bothLead = leadTo[0] != null && leadTo[1] != null;
    [0, 1].forEach(sd => { if (leadTo[sd] != null) doLead(sd, leadTo[sd], !bothLead); });
    chase = leadTo[0] != null && leadTo[1] == null;   // ユーザーだけが逃げた＝AIは追っている側
    if (!bothLead) {
      // 交代しなかった側は、**1秒たってから**「交代する？」を選べる(打ちかけのわざが終わり次第)
      const rs = leadTo[0] != null ? 1 : 0;
      // 反応はT1(2026-08-20タダシさん指摘で修正)。開幕交代では「打ちかけの1発」(leadHit)が
      // すでに交代先に入っており、それが反応待ちの攻撃ぶん。従来は gbReactTn を使っていたため、
      // 1秒わざでも余分にもう1発撃ってから交代していた(でんきショック2発問題)
      react = { side: rs, tn: 1 };
    }
  }
  while (cur[0] >= 0 && cur[1] >= 0 && legs.length < 16 && !pending) {
    const li = legs.length;
    const legSwapHit = swapHitEv;   // 直前の交代で交代先に入った1発(この対面の頭に表示)
    swapHitEv = null;
    seen[0].add(cur[0]); seen[1].add(cur[1]);   // 場に出た＝おたがいに見えた
    const P0 = picks[cur[0]], P1 = foes[cur[1]];
    const spL = [P0, P1].map(P => (P.pol.charged || []).slice());
    const enOf = sd => { const r = st[sd][cur[sd]].resume; return r ? (r.en || 0) : 0; };
    // この対面の頭の時計(実時間)。初手温存の合図は「対面の頭から交代が自由だったのに残った」
    // ときだけ有効にする(終わりぎわにロックが切れただけでは合図にならない・2026-08-31タダシさん報告で修正)
    const legStartCk = base + GB_SP_TURNS * spTot;
    const ctx = { li, base, ros, cur: cur.slice(),
      cost: spL.map(l => l.length ? Math.min(...l.map(id => D.moves[id].e)) : 0),
      spList: spL, fast: [P0.pol.fast, P1.pol.fast],
      shLeft: shLeft.slice(), swOk: swOk.slice(),
      maxHp: [PvpEngine.buildStats(D, P0.base).hp, PvpEngine.buildStats(D, P1.base).hp],
      swTo: [benches(0), benches(1)], newIn: newIn.slice(), koIn: koIn.slice(), keepLead,
      chase,                      // 追っている側か(ユーザーが自分から交代した直後)
      react: li === 0 ? react : null,   // 開幕に片方だけ交代したとき、もう片方が反応できる場面
      enAt: [enOf(0), enOf(1)],   // 対面開始時のゲージ(「撃ってから交代」の判断に使う)
      bAt: [0, 1].map(sd => {     // 対面開始時の能力変化(受けたデバフの追跡の起点)
        const r = st[sd][cur[sd]].resume;
        return r && r.buffs ? r.buffs.slice() : [0, 0];
      }),
      foeDump: ai.sw };           // あいてが逃げ回りのAIなら、SPを撃った直後にも交代を検討する
    newIn[0] = newIn[1] = koIn[0] = koIn[1] = false;
    keepLead = false;
    const dec = [0, 1].map(() => ({ shots: [], wait: 0, hold: false, shieldAt: [], swapTo: null, swapAt: 0 }));
    const legCfg = s => {
      const P = ros[s][cur[s]], d = dec[s];
      const c = { ...P.base, fast: P.pol.fast, charged: (P.pol.charged || []).slice(), shields: shLeft[s],
        bluff: s === 1 ? ai.bluff : false, timing: 'shots',
        shotPlan: d.shots.map(x => ({ mode: x.wait, move: x.mv, after: x.after, until: x.until })), shotRest: null,
        shieldPlan: d.shieldAt.slice(), shieldRest: false };
      if (st[s][cur[s]].resume) c.resume = st[s][cur[s]].resume;
      return c;
    };
    const handled = new Set(), log = [];
    let res = null;
    // 「⭐最適」ボタン用: この発を最適タイミング(mvId指定)にしたとき、あと何発
    // ノーマルアタックをはさんでから撃つことになるかを、1回だけシミュして数える(ラベルに出す)
    const optNOf = (p, mvId) => {
      if (p.kind !== 'sp') return null;
      const s = p.side, d = dec[s], len = d.shots.length, save = d.shots[p.seq];
      d.shots[p.seq] = { wait: 'opt', after: d.wait, mv: mvId || null };
      const cutA = [0, 1].filter(x => dec[x].swapTo != null).map(x => dec[x].swapAt);
      const r = PvpEngine.simulate(D, legCfg(0), legCfg(1),
        { ...SIMOPT, stopAt: cutA.length ? Math.min(...cutA) : 0 });
      if (save !== undefined) d.shots[p.seq] = save; else d.shots.length = len;
      let spCnt = 0, fasts = 0;
      for (const t of rbTurns(r)) for (const e of t.ev[s]) {
        if (e.full !== undefined) {
          if (spCnt === p.seq) return fasts;
          spCnt++;
        } else if (spCnt === p.seq && t.tn > p.tn) fasts++;
      }
      return null;
    };
    // わざごとの「最適まであと何発か」(じぶん側のSPだけ計算=探索を重くしない)
    const optNsOf = p => {
      if (p.kind !== 'sp' || p.side !== 0) return null;
      const m = {};
      (ctx.spList[0] || []).forEach(id => { m[id] = optNOf(p, id); });
      return m;
    };
    // 「撃たない」が正解の場面か(2026-08-20タダシさん指示):
    // この発から先SPを撃たなくても**ノーマルアタックだけで倒しきれて**、相手のSPアタックも
    // **飛んでこない**なら、撃つのはもったいない(ふつうはやらない)。ゲージは次の対面へ持ち越す。
    // じぶん側は「撃たない」ボタンの点灯(おすすめ表示)、あいて側はAIの判断にそのまま使う
    const finishNoSp = p => {
      if (p.kind !== 'sp') return false;
      const s = p.side, o = 1 - s, d = dec[s];
      const tail = d.shots.splice(p.seq);   // この発から先は撃たない、で回してみる
      const cutA = [0, 1].filter(x => dec[x].swapTo != null).map(x => dec[x].swapAt);
      // **相手は「この先もふつうに撃ってくる」前提で読む**(決め済みの発の続きは最適タイミングの自動)。
      // legCfgのままだと、まだ決断していない相手のSPがシミュに出てこず
      // 「相手のSPは飛んでこない」と誤判定する(実際に踏んだ: 開幕近くの満タン同士でもおすすめが点灯した)
      const cfgS = legCfg(s);
      const cfgO = { ...legCfg(o), shotRest: { mode: 'opt', move: null } };
      const r = PvpEngine.simulate(D, s === 0 ? cfgS : cfgO, s === 0 ? cfgO : cfgS,
        { ...SIMOPT, stopAt: cutA.length ? Math.min(...cutA) : 0 });
      d.shots.push(...tail);
      if (r.winner !== s) return false;
      for (const t of rbTurns(r)) {
        if (t.tn < p.tn) continue;
        if (t.ev[o].some(e => e.full !== undefined)) return false;   // 相手のSPが飛んでくる
      }
      return true;
    };
    ctx.finishNoSp = finishNoSp;   // あいてのAI(aiAnswer)からも同じ判断を使う
    // 決断を1つずつ解決する(1つ決めるたびに1ターン目から回し直す。1回のシミュは0.02ms未満)
    for (let guard = 0; guard < 90; guard++) {
      const cutA = [0, 1].filter(s => dec[s].swapTo != null).map(s => dec[s].swapAt);
      const sopt = { ...SIMOPT, stopAt: cutA.length ? Math.min(...cutA) : 0 };
      res = PvpEngine.simulate(D, legCfg(0), legCfg(1), sopt);
      // 撃ったSPアタックぶんだけ実時間が進む。交代のクールタイムの判定にも使う
      const spc = gbSpc(res);
      ctx.ck = tn => base + tn + GB_SP_TURNS * (spTot + gbSpAt(spc, tn));
      const pts = gbPoints(rbTurns(res), ctx, dec);
      // 手動交代(HUDの⇄ボタン・kind msw・2026-09-01): 記録があれば時系列の位置で反映する。
      // クールタイム・控えの生存・先の打ち切りを検証し、通らなければ黙って捨てる(前提が変わった古い記録)
      const mkey = Object.keys(ans).find(k => k.indexOf(li + ':0:msw:') === 0 && !handled.has(k));
      const mtn = mkey ? +mkey.split(':')[3] : -1;
      const p = pts.find(x => !handled.has(gbKey(li, x.side, x.kind, x.seq, x.w)));
      if (mkey && (!p || mtn < p.tn)) {
        handled.add(mkey);
        const ma = ans[mkey];
        if (ma && ma.a === 'toq' && ctx.swTo[0].includes(ma.to) && dec[0].swapTo == null
            && mtn >= 1 && mtn <= res.turns && ctx.ck(mtn) >= ctx.swOk[0]) {
          log.push({ side: 0, kind: 'msw', seq: mtn, w: 0, tn: mtn, key: mkey, gt: base + mtn, ans: ma, auto: false });
          dec[0].swapTo = ma.to; dec[0].swapAt = mtn;
        }
        continue;
      }
      if (!p) break;
      p.key = gbKey(li, p.side, p.kind, p.seq, p.w);
      p.gt = base + p.tn;
      const a = ans[p.key] || (p.side === 1 ? aiAnswer(p, ctx) : (stepwise ? null : RB_AUTO[p.kind]));
      if (!a) {
        pending = { ...p, optNs: optNsOf(p), noSp: p.side === 0 && finishNoSp(p), ctx };
        pending.opts = gbChoices(pending, ctx);
        break;
      }
      handled.add(p.key);
      log.push({ ...p, ans: a, auto: !ans[p.key] });
      if (p.kind === 'swap') {
        if (a.a === 'stay') continue;
        dec[p.side].swapTo = a.to;
        dec[p.side].swapAt = Math.max(1, p.tn);
        continue;
      }
      rbApply(dec[p.side], p, a);   // sp / sh の反映はロケット団と同じ
    }
    res.final[0].name = P0.name;
    res.final[1].name = P1.name;
    const down = [res.final[0].hp <= 0, res.final[1].hp <= 0];
    const swapped = [0, 1].map(s =>
      !!(res.stopped && dec[s].swapTo != null && dec[s].swapAt <= res.turns && !down[0] && !down[1]));
    // optNs・noSpはじぶん側のSPだけ計算する(あいて側の編集ウィンドウでは表示に出ないだけ。
    // オートバトルの探索がgbPlayを何百回も呼ぶので、余計なシミュを増やさない)
    const points = log.map(p => {
      const q = { ...p, gt: base + p.tn, optNs: optNsOf(p),
        noSp: p.kind === 'sp' && p.side === 0 && finishNoSp(p), ctx };
      q.opts = gbChoices(q, ctx);
      return q;
    });
    const rs0 = st[0][cur[0]].resume, rs1 = st[1][cur[1]].resume;
    legs.push({ res, base, myIdx: cur[0], foeIdx: cur[1], meName: P0.name, foeName: P1.name,
      swOk: swOk[0], fswOk: swOk[1],   // 交代解禁の通しターン(HUDの交代タイマー用・両側)
      meDown: down[0], foeDown: down[1],
      swapped0: swapped[0], swapped1: swapped[1],
      swapTo0: swapped[0] ? dec[0].swapTo : null, swapTo1: swapped[1] ? dec[1].swapTo : null,
      pol: P0.pol, foePol: P1.pol, li, points,
      leadPts: li === 0 ? leadPts : [null, null],
      leadHits: li === 0 ? leadHits : [null, null],
      swapHit: legSwapHit,   // 交代で交代先に入った打ちかけの1発(対面の頭に表示)
      hud: { hp0: rs0 ? Math.max(0, rs0.hp) : res.final[0].hpMax, en0: rs0 ? rs0.en : 0,
             b0: ((rs0 && rs0.buffs) || [0, 0]).slice(),
             hp1: rs1 ? Math.max(0, rs1.hp) : res.final[1].hpMax, en1: rs1 ? rs1.en : 0,
             b1: ((rs1 && rs1.buffs) || [0, 0]).slice(),
             g0: (rs0 && rs0.gulp) || null, g1: (rs1 && rs1.gulp) || null },
      pending: pending && pending.key.slice(0, pending.key.indexOf(':')) === String(li) ? pending : null });
    if (pending) break;
    base += res.turns;
    spTot += gbSpAt(gbSpc(res), res.turns);   // この対面で撃たれたSPアタックの数(両者ぶん)
    shLeft[0] = res.final[0].shields;
    shLeft[1] = res.final[1].shields;
    [0, 1].forEach(s => {
      st[s][cur[s]].alive = !down[s];
      st[s][cur[s]].resume = down[s] ? null : res.final[s].resume;
    });
    if (!down[0] && !down[1] && !swapped[0] && !swapped[1]) break;   // 上限ターンまで決着せず
    // 倒れた側は次を出す(じぶんは選べる・あいては順番どおり＝チップで変更できる)
    for (const s of [0, 1]) {
      if (!down[s]) continue;
      const rest = ros[s].map((p, k) => k).filter(k => st[s][k].alive);
      if (!rest.length) { cur[s] = -1; continue; }
      if (rest.length > 1) {
        const key = gbKey(li, s, 'next', 0, 0);
        const nctx = { ...ctx, swTo: s ? [ctx.swTo[0], rest] : [rest, ctx.swTo[1]] };
        // 両方が同時に倒れたときは、AIはユーザーが次に何を出すか**分からない**ので読み合いにならない。
        // 完全な運まかせなので**2分の1のコイントス**にする(2026-08-18タダシさん指示)。
        // ただし決断を1つ選ぶたびに1ターン目から回し直す作りなので、**同じ場面なら必ず同じ結果**に
        // なる決め方(場面から作るハッシュ)にしないと、選び直すたびに勝手に変わってしまう。
        // **HARD(omni)は例外**: ユーザーの選択(この時点でcur[0]に入っている)を見てから、
        // それに合わせて出す(手の内おみとおしの難易度なのでコイントスにしない)
        const a = ans[key] || (stepwise && s === 0 ? null
          : (s === 1 ? ((down[0] && !ai.omni) ? { a: 'to', to: rest[gbCoin(key + rest.join(',')) % rest.length] }
                                : aiAnswer({ kind: 'next', side: 1 }, nctx))
                     : RB_AUTO.next));
        const pt = { kind: 'next', side: s, seq: 0, w: 0, key, tn: res.turns, gt: base, ctx: nctx,
          opts: gbChoices({ kind: 'next', side: s }, nctx), ans: a, auto: !ans[key] };
        if (!a) { pending = pt; legs[legs.length - 1].pending = pt; break; }
        if (s === 0) legs[legs.length - 1].nextPoint = pt;
        else legs[legs.length - 1].foeNextPoint = pt;
        cur[s] = a.a === 'to' && ros[s][a.to] ? a.to : nextAlive(s, cur[s]);
      } else cur[s] = rest[0];
      newIn[s] = true;
      koIn[s] = true;   // 倒されて出し直した＝相手はこれを見てから交代を決める(1秒後)
      // 出し勝った初手の温存の合図(2026-08-30タダシさん指示): ユーザーは**交代できたのに**
      // 不利な対面から交代せず倒された(ABAで出し負けた形)＝「裏にこのポケモンが苦手な
      // もう1匹がいる」と知らせたのと同じ。いま出てきたポケモンの他にまだ控えがいる
      // (rest>=2＝隠れた1匹が残っている)ときだけ意味を持つ。
      // **交代の自由は対面の頭からあったことが条件**(legStartCk・2026-08-31修正):
      // 開幕交代のロックが対面の終わりぎわに切れただけでは「残る選択をした」ことにならない
      if (s === 0 && !down[1] && !swapped[0] && rest.length >= 2
          && swOk[0] <= legStartCk) keepLead = true;
    }
    if (pending) break;
    // 手動交代の実行(両方同時なら、お互いの打ちかけの1発は無しにする)
    chase = swapped[0] && !swapped[1];   // ユーザーだけが逃げた → AIは追っている側
    const both = swapped[0] && swapped[1];
    for (const s of [0, 1]) {
      if (!swapped[s]) continue;
      doSwap(s, dec[s].swapTo, base + GB_SP_TURNS * spTot, !both);   // 交代解禁は時計で持つ
    }
  }
  const meLeft = st[0].filter(x => x.alive).length;
  const foeLeft = st[1].filter(x => x.alive).length;
  const outcome = pending ? 'playing'
    : foeLeft === 0 ? (meLeft > 0 ? 'win' : 'draw') : (meLeft === 0 ? 'lose' : 'timeout');
  const hpLeft = st[0].reduce((sum, x, i) => {
    if (!x.alive) return sum;
    const max = PvpEngine.buildStats(D, picks[i].base).hp;
    return sum + (x.resume ? Math.max(0, x.resume.hp) / max : 1);
  }, 0);
  return { legs, picks, foes, st, outcome, meLeft, foeLeft, pending, turns: base, hpLeft,
    clock: base + GB_SP_TURNS * spTot,   // 実時間(ターン換算)。SPアタックの演出ぶんを含む
    myShLeft: shLeft[0], foeShLeft: shLeft[1], nMe: picks.length, nFoe: foes.length };
}

// ---- オートバトル(最善手の探索) ----
// ロケット団の rbFind と同じビームサーチ。あいての決断はAIが自動で答えるので、
// 探索が枝分かれさせるのは「じぶんの決断」だけになる(pendingはじぶん側でしか起きない)
function gbScore(bt) {
  const win = bt.outcome === 'win' ? 1 : 0;
  const killed = bt.nFoe - bt.foeLeft;
  return win * 1e7 + killed * 1e5 + bt.meLeft * 2000 + bt.hpLeft * 800 - (bt.clock != null ? bt.clock : bt.turns);
}
function gbFind(picks, foes) {
  const evalAns = ans => {
    const bt = gbPlay(picks, foes, ans, false);
    return { ans, bt, sc: gbScore(bt) };
  };
  let best = evalAns({});
  let beam = [best];
  for (let depth = 0; depth < 24; depth++) {
    const cand = [];
    for (const b of beam) {
      const step = gbPlay(picks, foes, b.ans, true);
      if (!step.pending) continue;
      for (const o of step.pending.opts) cand.push(evalAns({ ...b.ans, [step.pending.key]: { ...o } }));
    }
    if (!cand.length) break;
    cand.sort((x, y) => y.sc - x.sc);
    beam = cand.slice(0, 5);
    if (beam[0].sc > best.sc) best = beam[0];
  }
  return best;
}

// ---- GBL模擬戦の画面(runRkBuild/rbRenderの対人版。再生・HUD・決断ウィンドウの作りは同じ) ----
function runMockBuild() {
  const body = document.querySelector('#mock .gbbody');
  syncGbFoeSlots();   // リーグが変わるとあいての実数値・CPも変わるので毎回そろえる
  const mineIdx = [0, 1, 2].filter(i => PT[i]);
  const foesIdx = [0, 1, 2].filter(i => GBT[i]);
  updateUrl();
  clearInterval(RBV.timer); RBV.timer = null;
  if (!mineIdx.length || !foesIdx.length) {
    body.innerHTML = `<div class="mtnote">${!mineIdx.length ? '<b>じぶん</b>' : ''}${!mineIdx.length && !foesIdx.length ? 'と' : ''}` +
      `${!foesIdx.length ? '<b>あいて</b>' : ''}のポケモンを枠に入れてください（1匹ずつでもOK）</div>`;
    return;
  }
  // 入力(ポケモン・わざ・リーグ・AI等)が変わったら、前のバトルの選択と再生位置は仕切り直す
  const sig = JSON.stringify(['mock', PT, GBT, [0, 1, 2].map(i => PT[i] && gbmOf(i)),
    cap, cup && cup.slug, SIMOPT.buffMode, MK.ai, MK.leadSwap, MK.foeAuto]);
  if (RBV.sig !== sig) {
    if (RBV.sig !== undefined) { RB.ans = {}; RBUI.open = null; RB.found = null; }
    RBV.sig = sig; RBV.started = false; RBV.cur = 0; RBV.playing = true;
  }
  const picks = mineIdx.map(i => {
    const mv = gbmOf(i);
    return { m: PT[i], base: ptBase(PT[i]),
      pol: { fast: mv.fast, charged: [mv.c1, mv.c2].filter(Boolean) }, name: ptName(PT[i]) };
  });
  const foes = foesIdx.map(i => {
    const f = GBT[i];
    // わざオート(2026-08-20): 枠の選択を無視して環境の定番構成で戦う(選択は消さずに残す)
    const mv = MK.foeAuto ? mockDefaultMoves(f.key, f.shadow) : f;
    return { m: f, base: gbtBase(f),
      pol: { fast: mv.fast, charged: [mv.c1, mv.c2].filter(Boolean) }, name: gbtName(f) };
  });
  const bt = gbPlay(picks, foes, RB.ans, RB.step);
  gbRender(body, bt, picks, foes);
}

function gbRender(body, bt, picks, foes) {
  setProbTab(anyProbMove(picks.concat(foes).map(p => ({ fast: p.pol.fast, charged: p.pol.charged }))));
  RBUI.pts = {}; RBUI.order = [];
  const regPt = p => { if (p) { RBUI.pts[p.key] = p; RBUI.order.push(p.key); } };
  bt.legs.forEach(leg => { (leg.leadPts || []).forEach(regPt); (leg.points || []).forEach(regPt); regPt(leg.nextPoint); regPt(leg.foeNextPoint); regPt(leg.pending); });

  // ---- タイムラインの項目(全ターン)と、ターンごとの状況(HUD用)を作る ----
  const items = [], frames = [];
  // 通しターンごとの「それまでに撃たれたSPアタックの数」。実時間はSPの演出ぶんだけ余分に進む
  // (GB_SP_TURNSの項)。経過時間の表示と交代のクールタイムの残りはこの時計で出す
  const spByGt = [];
  let spSeen = 0;
  const ckOf = gt => gt + GB_SP_TURNS *
    (spByGt.length ? spByGt[Math.max(0, Math.min(gt, spByGt.length - 1))] : 0);
  let alive0 = picks.length, alive1 = foes.length;
  let sh0 = 2, sh1 = 2;
  const shMax0 = 2, shMax1 = 2;
  const evCell = list => list.map(e => {
    const b = e.buff ? buffTag(e.buff) : '';
    if (e.full !== undefined) return `<span class="ev sp">${mvChip(e.move, 13)}${
      e.shielded ? '' : `<b class="dmg">-${e.dmg}</b>`}${b}</span>${gulpCell(e)}`;
    return `<span class="ev">${mvChip(e.move, 12)}<b class="dmg">-${e.dmg}</b>${b}</span>`;
  }).join('');
  // 🛡ブロックのマークは**シールドを使った側**の列に出す(2026-08-20タダシさん指示)
  const shdCell = oppList => oppList.filter(e => e.shielded)
    .map(e => `<span class="ev shd" title="相手の${e.move}をシールドで防ぎました(ダメージ1)"><i class="blk">🛡ブロック</i></span>`).join('');
  // チップには**どちらの判断か**を必ず書く(2026-08-19タダシさん報告で追加)。
  // 枠の色(金＝あいて)だけでは伝わらず、あいての「撃たない」を自分の判断だと誤解する
  // (実例: オコリザルが起点づくりでSPを温存した場面を、こちらのSP判断だと思われた)
  const chipBtn = p => `<button class="fchip${p.auto ? ' auto' : ''}${p.side ? ' foe' : ''}"
    data-k="${p.key}" title="${p.side ? 'あいての行動です。タップすると、この場面から選び直せます' : 'じぶんの行動です。タップすると、この場面からやり直せます'}"><i class="who">${p.side ? 'あいて' : 'じぶん'}</i>${RB_ICON[p.kind]}<b>${gbAnsLabel(p, p.ans)}</b></button>`;
  const chipItem = (p, gt) => ({ gt, html: `<div class="fc${p.side ? ' foe' : ''}">${chipBtn(p)}</div>` });
  // 同じターンに両者の決断が並ぶときは1つのフレームに統合する(2026-08-31タダシさん指示・パッと見やすく):
  // SPどうしで発動も同じターンなら真ん中に「同時発動」の札 ／ シールドの答えは左右に並べる。
  // じぶん=左・あいて=右(タイムラインの列と同じ向き)
  const pairItem = (a, b, gt, mid) => ({ gt, html: `<div class="fc pair">${chipBtn(a)}${
    mid ? `<i class="pmid">${mid}</i>` : '<i class="pdiv"></i>'}${chipBtn(b)}</div>` });
  bt.legs.forEach(leg => {
    const res = leg.res, base = leg.base;
    while (spByGt.length <= base) spByGt.push(spSeen);
    const meta = {
      name0: leg.meName, name1: leg.foeName,
      cp0: res.final[0].cp, cp1: res.final[1].cp,
      max0: res.final[0].hpMax, max1: res.final[1].hpMax,
      sp0: (leg.pol.charged || []).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      sp1: (leg.foePol.charged || []).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      swOk: leg.swOk || 0, fswOk: leg.fswOk || 0,
    };
    let b0 = leg.hud.b0.slice(), b1 = leg.hud.b1.slice();
    let g0 = leg.hud.g0 || null, g1 = leg.hud.g1 || null;   // ウッウのフォルム(咥えているか)
    (leg.leadPts || []).forEach(p => { if (p) items.push(chipItem(p, base)); });
    // 演出(FX): 対面の頭に「バトル開始のVS」または「くりだした／交代した」を付ける。
    // 開幕交代(どちらの側も)はVSに続けて交代の演出を出す
    const pv = bt.legs[leg.li - 1] || null;
    const fxv = !pv ? [{ k: 'vs', me: leg.meName, foe: leg.foeName }]
      : [pv.meDown && { k: 'in', side: 0, name: leg.meName },
         pv.foeDown && { k: 'in', side: 1, name: leg.foeName },
         pv.swapped0 && { k: 'swap', side: 0, name: leg.meName },
         pv.swapped1 && { k: 'swap', side: 1, name: leg.foeName }].filter(Boolean);
    if (!pv) (leg.leadPts || []).forEach((pt, sd) => {
      if (pt && pt.ans && pt.ans.a === 'to')
        fxv.push({ k: 'swap', side: sd, name: sd ? leg.foeName : leg.meName });
    });
    items.push({ gt: base, fx: fxv, html: `<div class="flg"><span class="me">${shMark(leg.meName)}${tyIco(leg.meName)}</span><em>VS</em><span class="foe">${shMark(leg.foeName)}${tyIco(leg.foeName)}</span></div>` });
    // 開幕交代で入った「相手の打ちかけの1発」。撃ったのは交代しなかった側なので、その側の列に出す
    (leg.leadHits || []).forEach(h => { if (h) {
      const cell = evCell([{ move: h.mv, dmg: h.dmg }]);
      items.push({ gt: base, html: `<div class="ft"><div class="c me">${h.side === 1 ? cell : ''}</div><i class="tn">${base}</i>
        <div class="c foe">${h.side === 0 ? cell : ''}</div></div>` });
    } });
    // 手動交代で交代先に入った「打ちかけの1発」も同じ形で対面の頭に出す(2026-08-20タダシさん報告。
    // 出さないと、対面の切れ目をまたいだノーマルアタックがタイムラインから消えたように見える)
    if (leg.swapHit) {
      const cell = evCell([{ move: leg.swapHit.mv, dmg: leg.swapHit.dmg }]);
      items.push({ gt: base, html: `<div class="ft"><div class="c me">${leg.swapHit.side === 1 ? cell : ''}</div><i class="tn">${base}</i>
        <div class="c foe">${leg.swapHit.side === 0 ? cell : ''}</div></div>` });
    }
    frames[base] = { meta, hp0: leg.hud.hp0, en0: leg.hud.en0, hp1: leg.hud.hp1, en1: leg.hud.en1,
      b0: b0.slice(), b1: b1.slice(), g0, g1, sh0, sh1, alive0, alive1 };
    const ptAt = {};
    (leg.points || []).forEach(p => (ptAt[p.tn] = ptAt[p.tn] || []).push(p));
    // 側ごとのSPが実際に発動したターンの一覧(seq番目のSP→spTn[side][seq])。
    // 「同時発動」の判定(両者のSPが同じターンに解決)に使う
    const spTn = [[], []];
    rbTurns(res).forEach(t => { for (const i of [0, 1])
      if (t.ev[i].some(e => e.full !== undefined)) spTn[i].push(t.tn); });
    // 決断待ちより先は「まだ起きていない」ので描かない(ロケット団の模擬戦と同じ規則):
    //   sp・swap待ち: 質問ターンの出来事はすべて確定なので全部見せる
    //   sh待ち: 質問対象のあいてのSPから先を隠す
    const pend = leg.pending && leg.pending.kind !== 'next' ? leg.pending : null;
    rbTurns(res).forEach(t => {
      if (pend && t.tn > pend.tn) return;
      const gt = base + t.tn;
      const partial = pend && pend.kind === 'sh' && t.tn === pend.tn;
      // 出来事は**処理された順**のまま1行ずつ描く(2026-08-20タダシさん指示)。
      // 同じターンにSPを撃ち合うと、CMP(攻撃実数値×能力変化の高い側が先)で解決の先後が決まる。
      // ターン単位に左右へまとめると、この順番と「どちらがブロックしたのか」が見えなくなる
      let subs = t.sub;
      if (partial) {
        // sh待ちはじぶん側だけで起きる＝質問対象のあいてのSPが入った行から先は「まだ起きていない」
        // (そのSPより後に解決される出来事は、シールドの答えしだいで変わりうるので隠す)
        const k = subs.findIndex(r => r.ev[1] && r.ev[1].full !== undefined);
        if (k >= 0) subs = subs.slice(0, k);
      }
      for (const r of subs) for (let i = 0; i < 2; i++) {
        const e = r.ev[i];
        if (!e) continue;
        if (e.full !== undefined) spSeen++;   // SPアタック1発ぶん、実時間が余分に進む
        if (e.shielded) { if (i === 0) sh1--; else sh0--; }
        if (e.buff) { const tgt = e.buff.target === 'opponent' ? 1 - i : i;
          if (tgt === 0) b0 = e.buff.to.slice(); else b1 = e.buff.to.slice(); }
        // ウッウ: 咥えた(撃った側)／吐き出した(受けた側が通常の姿に戻り、撃った側の能力が下がる)
        if (e.gulpOn) { if (i === 0) g0 = e.gulpOn; else g1 = e.gulpOn; }
        if (e.gulp) {
          if (i === 0) { g1 = null; b0 = e.gulp.buff.to.slice(); }
          else { g0 = null; b1 = e.gulp.buff.to.slice(); }
        }
      }
      while (spByGt.length <= gt) spByGt.push(spSeen);
      spByGt[gt] = spSeen;
      if (!partial) {
        frames[gt] = { meta, hp0: t.state[0].hp, en0: t.state[0].en, hp1: t.state[1].hp, en1: t.state[1].en,
          b0: b0.slice(), b1: b1.slice(), g0, g1, sh0, sh1, alive0, alive1 };
      } else {
        const pf = frames[gt - 1] || frames[base];
        // 決断待ちのターンでも、**すでに解決した出来事(先に撃った側のSPなど)はHPに反映する**
        // (2026-08-31タダシさん指示・同時発動の時系列: 先に撃った側は、相手が食らったのか
        //  シールドで防いだのかを見てから自分のシールドを判断する。HUDのHPと残像もそのとおり動く)
        let hp0p = pf.hp0, hp1p = pf.hp1;
        for (const r of subs) for (let i = 0; i < 2; i++) {
          const e = r.ev[i]; if (!e) continue;
          const dm = e.full !== undefined ? (e.shielded ? 1 : e.full) : (e.dmg || 0);
          if (i === 0) hp1p = Math.max(0, hp1p - dm); else hp0p = Math.max(0, hp0p - dm);
        }
        frames[gt] = { meta, hp0: hp0p, en0: pf.en0, hp1: hp1p, en1: pf.en1,
          b0: b0.slice(), b1: b1.slice(), g0, g1, sh0, sh1, alive0, alive1 };
      }
      let first = true;
      for (const r of subs) {
        const e0 = evCell(r.ev[0] ? [r.ev[0]] : []) + shdCell(r.ev[1] ? [r.ev[1]] : []);
        const e1 = evCell(r.ev[1] ? [r.ev[1]] : []) + shdCell(r.ev[0] ? [r.ev[0]] : []);
        if (!e0 && !e1) continue;
        items.push({ gt, fx: fxOfRow(r), html: `<div class="ft"><div class="c me">${e0}</div><i class="tn">${first ? gt : ''}</i><div class="c foe">${e1}</div></div>` });
        first = false;
      }
      if (first) items.push({ gt, html: `<div class="ft q"><i class="tn">${gt}</i></div>` });
      // 両者の決断が同じターンに並んだらペアのフレームへ(shは解決順ソートで
      // あいてが先に来ることもあるので、左右はside基準でそろえる=じぶんが左)
      const firing = x => x.ans && x.ans.a !== 'hold' && x.ans.a !== 'wait';
      const pl = ptAt[t.tn] || [];
      for (let pi = 0; pi < pl.length; pi++) {
        const p = pl[pi], q = pl[pi + 1];
        if (q && p.kind === q.kind && p.side !== q.side) {
          const a0 = p.side ? q : p, b1 = p.side ? p : q;   // a0=じぶん(左)・b1=あいて(右)
          if (p.kind === 'sh'
              || (p.kind === 'sp' && firing(a0) && firing(b1)
                  && spTn[0][a0.seq] != null && spTn[0][a0.seq] === spTn[1][b1.seq])) {
            items.push(pairItem(a0, b1, gt, p.kind === 'sp' ? '同時発動' : ''));
            pi++;
            continue;
          }
        }
        items.push(chipItem(p, gt));
      }
    });
    const endGt = base + res.turns;
    if (!pend) {
      if (leg.foeDown) { alive1--; items.push({ gt: endGt, fx: [{ k: 'ko', win: true, name: leg.foeName }],
        html: `<div class="fko win">💥 ${leg.foeName} をたおした！<i>⏱${rbSec(ckOf(endGt))}</i></div>` }); }
      if (leg.meDown) { alive0--; items.push({ gt: endGt, fx: [{ k: 'ko', name: leg.meName }],
        html: `<div class="fko lose">💀 ${leg.meName} はたおれた</div>` }); }
      if (leg.meDown || leg.foeDown) {
        const f = frames[endGt] || frames[endGt - 1];
        if (f) frames[endGt] = { ...f, alive0, alive1 };
      }
    }
    if (leg.nextPoint) items.push(chipItem(leg.nextPoint, endGt));
    if (leg.foeNextPoint) items.push(chipItem(leg.foeNextPoint, endGt));
  });
  // 開幕交代の質問中はまだ対面が無いので、1匹目どうしの初期状態を出しておく
  if (!bt.legs.length && bt.pending && foes.length) {
    const sA = PvpEngine.buildStats(D, picks[0].base), sF = PvpEngine.buildStats(D, foes[0].base);
    items.push({ gt: 0, html: `<div class="flg"><span class="me">${shMark(picks[0].name)}${tyIco(picks[0].name)}</span><em>VS</em><span class="foe">${shMark(foes[0].name)}${tyIco(foes[0].name)}</span></div>` });
    frames[0] = { meta: { name0: picks[0].name, name1: foes[0].name, cp0: sA.cp, cp1: sF.cp, max0: sA.hp, max1: sF.hp,
      sp0: (picks[0].pol.charged || []).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      sp1: (foes[0].pol.charged || []).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })) },
      hp0: sA.hp, en0: 0, hp1: sF.hp, en1: 0, b0: [0, 0], b1: [0, 0], sh0, sh1, alive0, alive1 };
  }
  const stop = bt.pending ? bt.pending.gt : bt.turns;
  for (let g = 1; g <= stop; g++) if (!frames[g]) frames[g] = frames[g - 1];
  // 決着のまとめ(再生が最後まで来たら出る)
  if (!bt.pending) {
    const o = RK_OUTCOME[bt.outcome];
    items.push({ gt: stop, html: `<div class="rbfin">
      <div class="rkverdict ${o.cls}">${o.mark} ${o.txt}
        <small>じぶん ${bt.meLeft}/${bt.nMe} ／ あいて ${bt.foeLeft}/${bt.nFoe} ・ ⏱<b>${rbSec(bt.clock != null ? bt.clock : bt.turns)}</b>秒 ・ 🛡${bt.myShLeft}／${bt.foeShLeft}</small></div>
    </div>` });
  }

  // ---- 画面を組む ----
  body.innerHTML = `<div class="rbctlbar">
      <div class="rbctl">
        <div class="rbrow1 rbfind"><span class="lbl">🔎 オートバトル</span>
          <button class="rbgo" data-g="best" aria-pressed="${RB.goal === 'best'}" title="勝ちと手持ちの残りがいちばん良くなる手順をさがします（押して選んでから ▶ バトルスタート！で開始）">最善</button>
          ${RB.step ? `<button class="rbclear" style="display:${RBV.started || rbAnsCount() ? '' : 'none'}" title="選んだ手を消して、もう一度はじめからバトルします">▶ バトルスタート！</button>`
            : (rbAnsCount() ? '<button class="rbclear" title="選んだ手をすべて消して、全部おまかせに戻します">選び直す</button>' : '')}
        </div>
        ${RB.found ? `<div class="rbfound">${RB.found}</div>` : ''}
      </div>
      <button class="rbonly" aria-pressed="${!RB.step}" title="バトルを流さず、結果を一気に出します。もう一度押すとバトル表示に戻ります">結果だけ見る</button>
    </div>
    <div class="rbfeed">${items.map(x => `<div class="fi future" data-gt="${x.gt}"${fxAttr(x.fx)}>${x.html}</div>`).join('')}</div>
    <div class="rbdock">
      <div class="rbwinbox"></div>
      <div class="rbhud">
        <div class="hs me"><div class="hn"><span class="nm"></span><b class="cp"></b><b class="hpn"></b></div>
          <div class="hb"><em></em><i></i></div>
          <div class="hx"><span class="balls"></span><span class="shds"></span><span class="gqg"><span class="gqs"></span><b class="gqn" title="いまのゲージ量(100でまんたん)"></b></span><span class="bfs"></span></div>
          <div class="hswap" title="次に交代できるまでの残り時間（一度交代すると45秒間は次の交代ができません）"></div>
        </div>
        <div class="hm"><b class="clk">0.0</b><i class="trn">0T</i>
          <div class="hctl">${RB.step ? `<button class="hmsw" disabled title="いつでも交代できるボタンです（押すと控えを選べます。一度交代すると45秒間は次の交代ができません）">${SWAPMK}<b>交代</b></button><button class="hplay" title="一時停止／再生">⏸</button><button class="hspd" title="再生の速さ">×${RBV.speed}</button><button class="hstep" title="1ターンだけ進める（⏸で止めて、相手のわざの周期を見ながら交代するときに）">⏭</button><button class="hskip" title="次の決断まで飛ばす">⏩</button><button class="hstop" title="もう一度バトルスタート！（選んだ手は消えます）">⏹</button><button class="hfx" aria-pressed="${FX.on}" title="くりだし・SP発動などの演出のON/OFF（演出のあいだ再生は止まりますが、バトルの結果には影響しません）">✨</button>` : ''}</div>
        </div>
        <div class="hs foe"><div class="hn"><b class="hpn"></b><b class="cp"></b><span class="nm"></span></div>
          <div class="hb"><em></em><i></i></div>
          <div class="hx"><span class="balls"></span><span class="shds"></span><span class="gqg"><span class="gqs"></span><b class="gqn" title="いまのゲージ量(100でまんたん)"></b></span><span class="bfs"></span></div>
          <div class="hswap fswap" title="あいてが次に交代できるまでの残り時間"></div>
        </div>
      </div>
    </div>`;

  // ---- 再生とHUD(ロケット団の模擬戦と同じ作り) ----
  const feedEl = body.querySelector('.rbfeed');
  const els = [...feedEl.children];
  // HUDは最初から画面のいちばん下に固定する(2026-09-01タダシさん案)。
  // HUD(sticky)はタイムラインが画面の高さに満たないあいだ、行が増えるたびに下へ押されて動く=
  // ⇄や⏸が押せない。フィードに画面ぶんの最低の高さを与えれば、HUDは最初から下に張りつき、
  // 行は従来どおり上から流れてすき間が埋まっていく(1手ずつの再生モードのときだけ)
  if (RB.step) {
    const dockEl = body.querySelector('.rbdock');
    feedEl.style.minHeight = Math.max(220, innerHeight - (dockEl ? dockEl.offsetHeight : 120) - 24) + 'px';
  }
  const dock = body.querySelector('.rbdock');
  const winbox = dock.querySelector('.rbwinbox');
  const hud = dock.querySelector('.rbhud');
  const sideRefs = side => {
    const el = hud.querySelector('.hs.' + side);
    return { nm: el.querySelector('.nm'), cp: el.querySelector('.cp'), bar: el.querySelector('.hb i'),
      ghost: el.querySelector('.hb em'),
      hpn: el.querySelector('.hpn'),
      balls: el.querySelector('.balls'), shds: el.querySelector('.shds'),
      gqs: el.querySelector('.gqs'), gqn: el.querySelector('.gqn'), bfs: el.querySelector('.bfs') };
  };
  const R0 = sideRefs('me'), R1 = sideRefs('foe');
  const clk = hud.querySelector('.clk'), trn = hud.querySelector('.trn');
  const swapEl = hud.querySelector('.hs.me .hswap');
  const fswapEl = hud.querySelector('.hs.foe .hswap');
  const mswBtn = hud.querySelector('.hmsw');           // ⇄いつでも交代(再生コントロールの並び)
  let ptr = 0, lastEl = null, curLegKey = '';
  function updateHud(gt) {
    const f = frames[Math.max(0, Math.min(gt, stop))];
    if (!f) return;
    const legKey = f.meta.name0 + '|' + f.meta.name1;
    if (legKey !== curLegKey) {
      curLegKey = legKey;
      [[R0, f.meta.name0, f.meta.cp0, f.meta.sp0, false], [R1, f.meta.name1, f.meta.cp1, f.meta.sp1, true]].forEach(([Rf, nm, cp, sps, isFoe]) => {
        Rf.nm.textContent = nm.replace(/^シャドウ/, 'S');   // 下のフレームは幅が狭い(確定仕様の縮め方)
        Rf.nm.title = nm;
        Rf.cp.textContent = 'CP' + cp;
        // わざオート中は、あいてのゲージ円にわざ名・タイプを出さない(何が飛んでくるか分からない設定)
        const hide = isFoe && MK.foeAuto;
        Rf.gqs.innerHTML = sps.map(m => `<span class="gq" data-e="${m.e}" title="${
          hide ? 'あいてのSPアタック(わざオート中はどれか分かりません)' : `${m.n}（ゲージ${m.e}）`}"><i>${
          hide ? '？' : typeIconHTML(D.typeJa[MOVE_TYPE[m.n]] || '', 13)}</i><b></b></span>`).join('');
      });
    }
    const set = (Rf, hp, max, en, sh, shMax, alive, total, b, g) => {
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      const w = hp > 0 ? Math.max(pct, 4) : 0;
      Rf.bar.style.width = w + '%';
      hpGhost(Rf.ghost, w);   // 白い残像がゆっくり追いかけて「減った量」を見せる
      const cls = pct > 50 ? 'g' : pct > 20 ? 'y' : 'r';
      Rf.bar.className = cls;
      Rf.hpn.textContent = hp + '/' + max;
      if (Rf.gqn) Rf.gqn.textContent = Math.floor(en);   // ゲージ残量を数字で大きく(2026-08-20タダシさん指示)
      Rf.hpn.className = 'hpn ' + cls;
      Rf.balls.innerHTML = Array.from({ length: total }, (_, i) => `<i class="pb${i < alive ? '' : ' off'}"></i>`).join('');
      Rf.shds.innerHTML = Array.from({ length: shMax }, (_, i) => `<i class="shd${i < sh ? '' : ' off'}">🛡</i>`).join('');
      Rf.bfs.innerHTML = (g ? `<i class="bf gulp" title="${GULP_JA[g]}のすがた（相手のSPアタックを受けると吐き出します）">${GULP_MK[g]}${GULP_JA[g]}</i>` : '') +
        [0, 1].map(k => !b[k] ? '' :
        `<i class="bf ${b[k] > 0 ? 'up' : 'dn'}">${'攻防'[k]}${b[k] > 0 ? '⬆' : '⬇'}${Math.abs(b[k]) === 1 ? '' : Math.abs(b[k])}</i>`).join('');
      Rf.gqs.querySelectorAll('.gq').forEach(g => {
        const e = +g.dataset.e;
        const laps = Math.floor(en / e);
        const prog = (en - laps * e) / e * 100;
        const cur = cols[Math.min(laps, cols.length - 1)];
        const below = laps > 0 ? cols[Math.min(laps - 1, cols.length - 1)] : 'rgba(255,255,255,.09)';
        g.style.background = `conic-gradient(${cur} ${prog}%, ${below} 0)`;
        g.style.setProperty('--gqc', laps > 0 ? below : cur);
        g.classList.toggle('on', laps >= 1);
        g.querySelector('b').textContent = laps >= 1 ? laps : '';
      });
    };
    const GQC_ME = ['#43e0ff', '#ffd54a', '#ff6b81'], GQC_FOE = ['#ffd54a', '#ff6b81', '#b06cff'];
    let cols = GQC_ME;
    set(R0, f.hp0, f.meta.max0, f.en0, f.sh0, shMax0, f.alive0, picks.length, f.b0, f.g0);
    cols = GQC_FOE;
    set(R1, f.hp1, f.meta.max1, f.en1, f.sh1, shMax1, f.alive1, foes.length, f.b1, f.g1);
    clk.textContent = rbSec(ckOf(gt));   // SPアタックの演出ぶんを含む実時間
    trn.textContent = gt + 'T';
    // ⇄いつでも交代は hctl(位置が動かない再生コントロールの並び)のボタンで受ける
    // (2026-09-01タダシさん指摘: HUDの左右は数字の更新で常に動くので押せない)。
    // じぶん側のここは従来どおり残り時間の表示だけ
    const swLeft = Math.max(0, (f.meta.swOk || 0) - ckOf(gt));
    swapEl.innerHTML = swLeft > 0 ? `${SWAPMK}<b>${Math.ceil(swLeft / 2)}</b><small>秒</small>` : '';
    if (mswBtn) {
      const canSwap = RB.step && RBV.started && f.alive0 > 1 && swLeft <= 0 && gt < stop;
      mswBtn.disabled = !canSwap;
      mswBtn.classList.toggle('rdy', canSwap);
    }
    const fswLeft = Math.max(0, (f.meta.fswOk || 0) - ckOf(gt));
    fswapEl.innerHTML = fswLeft > 0 ? `<b>${Math.ceil(fswLeft / 2)}</b><small>秒</small>${SWAPMK}` : '';
  }
  const revealTo = g => {
    const out = [];   // 今あらわれた要素(演出の判定に使う)
    while (ptr < els.length && +els[ptr].dataset.gt <= g) {
      els[ptr].classList.remove('future'); els[ptr].classList.add('in');
      lastEl = els[ptr]; out.push(els[ptr]); ptr++;
    }
    return out;
  };
  const autoScroll = () => {
    if (!lastEl) return;
    const target = lastEl.getBoundingClientRect().bottom + scrollY - (innerHeight - dock.offsetHeight - 10);
    if (target > scrollY && target - scrollY < innerHeight * 1.5)
      scrollTo({ top: target, behavior: RBV.speed === 1 ? 'smooth' : 'auto' });
  };
  const stopTimer = () => { clearInterval(RBV.timer); RBV.timer = null; };
  const ended = () => RBV.cur >= stop && !bt.pending;
  const setPlayBtn = () => {
    const b = hud.querySelector('.hplay');
    if (b) b.textContent = ended() ? '↻' : RBV.timer ? '⏸' : '▶';
  };
  function showWin(p, editing, det) {
    RBV.playing = !editing && RBV.playing;
    stopTimer(); setPlayBtn();
    // det=trueで「…詳細」(＋1〜＋3の細かい待ち指定)を開く。閉じているあいだは det付きの選択肢を隠す
    const hasDet = p.opts.some(o => o.det);
    const btn = ({ o, i }) => `<button class="${o.cls || ''}${rbSameAns(p.ans, o) ? ' on' : ''}"
        data-k="${p.key}" data-i="${i}" title="${o.tip || ''}">${o.label}</button>`;
    // わざごとのフレーム(grp): 見出し=わざ名＋ゲージ、中に「最適」「即打ち」の2大ボタン
    // (2026-08-20タダシさん指示・最適が左)
    const groups = [];
    const rest = [];
    p.opts.forEach((o, i) => {
      if (o.grp) {
        let g = groups.find(x => x.grp === o.grp);
        if (!g) { g = { grp: o.grp, head: '', items: [] }; groups.push(g); }
        if (o.head) g.head = o.head;
        g.items.push({ o, i });
      } else rest.push({ o, i });
    });
    // end付き(ためてブラフ)は「…詳細」の右に置く(2026-08-30タダシさん指示)
    // SPが2本あるときは実際の戦闘画面と同じ横並び(2026-08-31タダシさん指示・左右どちらを撃つかの形)
    // シールドの質問は実際のゲーム画面を再現(2026-08-31タダシさん指示):
    // シールドの結晶＋残り枚数(タップ=使う)と、下の「あとで」(=受ける)に分ける
    const shWin = () => {
      const iUse = p.opts.findIndex(o => o.a === 'use'), iNo = p.opts.findIndex(o => o.a === 'no');
      const fr = frames[Math.max(0, (p.gt || 1) - 1)] || frames[p.gt] || {};
      const left = Math.max(1, (p.side ? fr.sh1 : fr.sh0) || 1);
      return `<div class="shwin">
        <button class="shuse" data-i="${iUse}" title="${p.opts[iUse].tip}">${shieldSvg()}<i class="shx">×${left}</i></button>
        <button class="shlater" data-i="${iNo}" title="${p.opts[iNo].tip}">あとで</button>
      </div>`;
    };
    const btns = (p.kind === 'sh' ? shWin()
      : (groups.length ? `<div class="mvrow">${groups.map(g =>
      `<div class="mvopt"><div class="mh">${g.head}</div><div class="mb">${g.items.map(btn).join('')}</div></div>`).join('')}</div>` : '')
      + rest.filter(x => !x.o.end && (det || !x.o.det)).map(btn).join('')
      + (hasDet && !det ? '<button class="hold wdet" title="ノーマルアタックを＋1〜＋3発はさむ細かい指定を出します">…詳細</button>' : '')
      + rest.filter(x => x.o.end).map(btn).join(''))
      + (editing && p.ans && !p.auto ? `<button class="hold" data-k="${p.key}" data-i="reset" title="この場面をおまかせに戻します">↺</button>` : '');
    winbox.innerHTML = `<div class="rbwin${p.side ? ' foe' : ''}">
      <div class="rwt">${gbAskTitle(p)}<span>${p.gt}T ⏱${rbSec(p.ck != null ? p.ck : p.gt)}</span>${editing ? '<button class="wx" title="閉じる">✕</button>' : ''}</div>
      <div class="rwb">${btns}</div></div>`;
    winbox.querySelectorAll('.rwb button').forEach(b => {
      if (b.classList.contains('wdet')) { b.onclick = () => showWin(p, editing, true); return; }
      b.onclick = () => {
        rbTrim(p.key);
        if (b.dataset.i === 'reset') delete RB.ans[p.key];
        else RB.ans[p.key] = { ...p.opts[+b.dataset.i] };
        RBUI.open = null; RBV.playing = true;
        run();
      };
    });
    const wx = winbox.querySelector('.wx');
    if (wx) wx.onclick = () => { RBUI.open = null; RBV.playing = true; run(); };
    autoScroll();
  }
  function atStop() {
    stopTimer();
    if (bt.pending) showWin(bt.pending, false);
    else RBV.playing = false;
    setPlayBtn();
  }
  function tick() {
    if (!document.body.contains(feedEl)) { stopTimer(); return; }
    RBV.cur++;
    const rev = revealTo(RBV.cur);
    updateHud(RBV.cur);
    autoScroll();
    // 演出(FX): 今あらわれた行に未再生のdata-fxがあれば、再生を止めてカットインを見せてから続ける
    // (停滞するのは見せる側だけで、バトルのターン・⏱には影響しない)
    const fxEls = fxConsume(rev);
    if (fxEls.length) {
      stopTimer();
      fxRun(fxEls, () => {
        if (!document.body.contains(feedEl)) return;
        if (RBV.cur >= stop) atStop();
        else if (RBV.playing) startTimer();
        else setPlayBtn();
      });
      return;
    }
    if (RBV.cur >= stop) atStop();
  }
  const startTimer = () => { stopTimer(); RBV.timer = setInterval(tick, 500 / RBV.speed); setPlayBtn(); };

  // ---- 操作の配線 ----
  const only = body.querySelector('.rbonly');
  if (only) only.onclick = () => {
    RB.step = !RB.step;
    RBV.cur = RB.step ? 0 : 1e9; RBV.playing = true; RBUI.open = null;
    run();
  };
  const restart = () => {
    RB.ans = {}; RBUI.open = null; RB.found = null;
    RBV.cur = 0; RBV.playing = true;
    if (RB.step) RBV.started = true;
    if (RB.step && RB.goal) { applyGoal(); return; }
    run();
  };
  const clr = body.querySelector('.rbclear');
  if (clr) clr.onclick = restart;
  body.querySelectorAll('.rbgo').forEach(b => b.onclick = () => {
    const g = b.dataset.g;
    RB.goal = RB.goal === g ? null : g;
    body.querySelectorAll('.rbgo').forEach(x => x.setAttribute('aria-pressed', x.dataset.g === RB.goal));
  });
  const applyGoal = () => {
    const r = gbFind(picks, foes);
    if (!r) { RB.found = '手順が見つかりませんでした。'; run(); return; }
    RB.ans = r.ans; RBUI.open = null;
    const o2 = RK_OUTCOME[r.bt.outcome];
    RB.found = `🔎 最善 → <b class="${o2.cls === 'win' ? 'ok' : 'ng'}">${o2.txt}</b>` +
      `　⏱<b>${rbSec(r.bt.clock != null ? r.bt.clock : r.bt.turns)}</b>秒　じぶん ${r.bt.meLeft}/${r.bt.nMe}`;
    RBV.cur = 0; RBV.playing = true; RBV.started = true;
    run();
  };
  feedEl.querySelectorAll('.fchip').forEach(b => b.onclick = () => {
    const p = RBUI.pts[b.dataset.k];
    if (!p) return;
    RBUI.open = p.key; RBV.cur = p.gt;
    run();
  });
  const hplay = hud.querySelector('.hplay'), hspd = hud.querySelector('.hspd'), hskip = hud.querySelector('.hskip');
  const startBattle = () => {
    RBV.started = true; RBV.playing = true;
    if (RB.goal) { applyGoal(); return; }
    winbox.innerHTML = '';
    if (clr) clr.style.display = '';
    // スタートの瞬間に、すでに見えている開幕(VS・開幕交代)の演出を見せてから再生を始める
    RBV.fxDone.clear();
    const fx0 = fxConsume(els.slice(0, ptr));
    const go = () => {
      if (!document.body.contains(feedEl)) return;
      if (RBV.cur >= stop) atStop();
      else if (RBV.playing) startTimer();
    };
    if (fx0.length) fxRun(fx0, go); else go();
  };
  if (hplay) hplay.onclick = () => {
    if (!RBV.started) { startBattle(); return; }
    if (ended()) { RBV.cur = 0; RBV.playing = true; run(); return; }
    if (RBV.cur >= stop) return;
    if (RBV.timer) { RBV.playing = false; stopTimer(); } else { RBV.playing = true; startTimer(); }
    setPlayBtn();
  };
  if (hspd) hspd.onclick = () => {
    RBV.speed = RBV.speed === 1 ? 2 : RBV.speed === 2 ? 4 : 1;
    hspd.textContent = '×' + RBV.speed;
    if (RBV.timer) startTimer();
  };
  if (hskip) hskip.onclick = () => {
    RBV.started = true;
    // ⏩で飛ばした演出は再生済み扱いにする(あとでまとめて再生されないように)
    revealTo(stop).forEach(e => { if (e.dataset.fx) RBV.fxDone.add(fxKey(e)); });
    RBV.cur = stop; updateHud(stop); autoScroll();
    if (RBV.timer || bt.pending) atStop(); else { RBV.playing = false; setPlayBtn(); }
  };
  const hstop = hud.querySelector('.hstop');
  if (hstop) hstop.onclick = restart;
  const hfx = hud.querySelector('.hfx');
  if (hfx) hfx.onclick = () => {
    FX.on = !FX.on; fxSave();
    hfx.setAttribute('aria-pressed', FX.on);
  };
  // ⏭ 1ターン送り(2026-09-01タダシさん指示): ⏸で止めて、相手のわざの周期(CCT)を見ながら
  // 狙ったターンに正確に止めるためのコマ送り。送った先が決断の場面なら質問が出る
  const hstep = hud.querySelector('.hstep');
  if (hstep) hstep.onclick = () => {
    if (!RBV.started || ended()) return;
    stopTimer(); RBV.playing = false;
    if (RBV.cur < stop) tick();
    setPlayBtn();
  };
  // HUDの⇄ボタン=いつでも交代(2026-09-01タダシさん指示・実戦の交代ボタンの再現)。
  // 押すと再生が止まり控えを選ぶ。選ぶと**いま表示中のターン**で交代する(答えはmswとして記録され、
  // タイムラインのチップから選び直し・↺で取り消しできる)。前提が変わるのでそれより後ろの答えは消す
  const manualSwap = () => {
    if (!RB.step || !RBV.started || ended()) return;
    const gt = RBV.cur;
    if (bt.pending && gt >= stop) return;   // 質問の表示中はそちらの選択肢で選ぶ
    let li = bt.legs.findIndex(l => gt < l.base + l.res.turns);
    if (li < 0) li = bt.legs.length - 1;
    const leg = bt.legs[li]; if (!leg) return;
    const dead = new Set(); bt.legs.slice(0, li).forEach(l => { if (l.meDown) dead.add(l.myIdx); });
    const bench = picks.map((_, k) => k).filter(k => k !== leg.myIdx && !dead.has(k));
    if (!bench.length) return;
    const tn = Math.max(1, gt - leg.base);
    stopTimer(); RBV.playing = false; setPlayBtn();
    winbox.innerHTML = `<div class="rbwin"><div class="rwt">${SWAPMK} 交代する？<span>${gt}T ⏱${rbSec(ckOf(gt))}</span><button class="wx" title="やめて再生に戻る">✕</button></div>
      <div class="rwb">${bench.map(k => `<button class="fire" data-to="${k}" title="このポケモンに交代します(相手の打ちかけの1発は交代先に入ります・次の交代は45秒後)">${SWAPMK} ${shMark(picks[k].name)}${tyIco(picks[k].name)}</button>`).join('')}
      <button class="hold mswx">やめる</button></div></div>`;
    const key = gbKey(li, 0, 'msw', tn, 0);
    winbox.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
      // 前提が変わるので、この場面より後ろの答えと同じ対面の古い手動交代は消す
      Object.keys(RB.ans).forEach(k2 => {
        const pt2 = RBUI.pts[k2];
        if ((pt2 && pt2.gt > gt) || (!pt2 && +k2.split(':')[0] > li) || k2.indexOf(li + ':0:msw:') === 0)
          delete RB.ans[k2];
      });
      RB.ans[key] = { a: 'toq', to: +b.dataset.to };
      RBUI.open = null; RBV.playing = true;
      run();
    });
    const cancel = () => { winbox.innerHTML = ''; RBV.playing = true; startTimer(); };
    winbox.querySelector('.mswx').onclick = cancel;
    winbox.querySelector('.wx').onclick = cancel;
  };
  if (mswBtn) mswBtn.onclick = manualSwap;

  // ---- 初期表示(再生の途中状態を引き継ぐ) ----
  RBV.cur = Math.max(0, Math.min(RBV.cur, stop));
  if (!RB.step) RBV.cur = stop;
  if (RB.step && !RBV.started) {
    RBV.cur = 0;
    revealTo(0);
    updateHud(0);
    winbox.innerHTML = '<button class="rbstart">▶ バトルスタート！</button>';
    winbox.querySelector('.rbstart').onclick = startBattle;
    setPlayBtn();
    return;
  }
  if (RBV.cur === 0) RBV.fxDone.clear();   // 最初からの再生(スタート・↻)は演出も最初から
  const rev0 = revealTo(RBV.cur);
  updateHud(RBV.cur);
  if (RBUI.open && RBUI.pts[RBUI.open]) showWin(RBUI.pts[RBUI.open], true);
  else if (RBV.cur >= stop) {
    // 同じターンに次の質問が続く場合も、隠れていた演出を見せてから止まる
    const fxS = RB.step ? fxConsume(rev0) : [];
    if (fxS.length) fxRun(fxS, () => { if (document.body.contains(feedEl)) atStop(); });
    else atStop();
  }
  else if (RB.step && RBV.playing) {
    // まだ再生していない演出(バトルスタート直後のVS・決断で隠れていたSPや交代など)を
    // 見せてから再生を始める。fxDoneのおかげで再生済みの演出は二重に出ない
    const fx0 = fxConsume(rev0);
    if (fx0.length) fxRun(fx0, () => { if (document.body.contains(feedEl) && RBV.playing) startTimer(); });
    else startTimer();
  }
  setPlayBtn();
}

const mvName2 = id => D.moves[id] ? D.moves[id].n : id;

const RK_OUTCOME = {
  win:  { cls: 'win',  txt: '勝利', mark: '🏆' },
  lose: { cls: 'lose', txt: '敗北', mark: '💥' },
  draw: { cls: 'lose', txt: '相打ち', mark: '🤝' },
  timeout: { cls: 'lose', txt: '決着つかず', mark: '⏱' },
};
// ---- ★登録リスト(端末内保存・両側の欄から呼び出せる) ----
const MYPK_KEY = 'gbl_mypoke';
const loadMyPk = () => { try { return JSON.parse(localStorage.getItem(MYPK_KEY)) || []; } catch (e) { return []; } };
const saveMyPkList = list => { try { localStorage.setItem(MYPK_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {} };
function renderMyPk() {
  const list = loadMyPk();
  sideEl.forEach((el, i) => {
    const box = el.querySelector('.mypklist');
    if (!list.length) {
      box.innerHTML = '<div class="mypkempty">まだ登録がありません。ポケモンを選んで「★登録」を押すとここに追加されます</div>';
      return;
    }
    box.innerHTML = list.map((m, k) => {
      const p = D.pokemon[m.key];
      if (!p || !rkFoeOk(i, m.key)) return '';   // あいて側はメガ・ゲンシを出さない
      const iv = m.ivMode === 'manual' && m.mIvs ? `<i>${m.mIvs.join('/')} PL${m.mLevel}</i>` : '<i>理想個体値</i>';
      return `<div class="mypkrow" data-k="${k}"><span>${m.shadow ? SHADOWMK : ''}${p.n}${iv}</span><b class="del" data-del="${k}">×</b></div>`;
    }).join('');
    box.querySelectorAll('.mypkrow').forEach(row => row.onclick = e => {
      if (e.target.dataset.del !== undefined) {   // ×で削除
        const l = loadMyPk(); l.splice(+e.target.dataset.del, 1); saveMyPkList(l); renderMyPk();
        return;
      }
      applyMyPk(i, loadMyPk()[+row.dataset.k]);
      box.style.display = 'none';   // 選んだら一覧を閉じる
      el.querySelector('.mypktab').setAttribute('aria-pressed', 'false');
    });
  });
}
function applyMyPk(i, m, skipRun) {
  if (!m || !D.pokemon[m.key]) return;
  S[i].key = m.key;
  S[i].fast = m.fast || null; S[i].c1 = m.c1 || null; S[i].c2 = m.c2 || null;
  resetPin(i);   // 前のポケモンで確定したわざを持ち越さない
  resetSpPlan(i);   // 発ごとのSP設定は「おまかせ」に戻す(前のポケモンの指定を残さない)
  S[i].ivMode = m.ivMode || 'auto'; S[i].mIvs = m.mIvs || null; S[i].mLevel = m.mLevel || null;
  S[i].shadow = !!m.shadow;
  S[i].maxLv = m.maxLv || 51;
  syncSmax(i);
  const el = sideEl[i];
  el.querySelector('.shadowtab').setAttribute('aria-pressed', S[i].shadow);
  el.querySelector('input').value = (S[i].shadow ? 'シャドウ' : '') + D.pokemon[m.key].n;
  el.querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === S[i].ivMode));
  el.querySelector('.custIv').style.display = S[i].ivMode === 'manual' ? 'block' : 'none';
  if (S[i].mIvs) {
    el.querySelector('.ivA').value = S[i].mIvs[0]; el.querySelector('.ivD').value = S[i].mIvs[1];
    el.querySelector('.ivH').value = S[i].mIvs[2]; el.querySelector('.ivL').value = S[i].mLevel;
  }
  if (mode === 'rocket' && i === 1) syncRocket();   // あいて側はシャドウ固定などの表示に戻す
  if (!skipRun) run();   // 続けて別の設定も変える場合は呼び出し側でまとめて実行する
}

// スーパーマックスレベルのタブ表示(メガのみ)と選択状態を同期
function syncSmax(i) {
  const el = sideEl[i];
  el.querySelector('.smaxwrap').style.display = (S[i].key && isMega(S[i].key)) ? 'block' : 'none';
  el.querySelectorAll('.smax button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.lv === S[i].maxLv));
}

// 発ごとのSP設定を初期状態(全部おまかせ)へ戻す。ポケモンを切り替えたときに古い指定を残さない
function resetSpPlan(i) {
  const m = spModeOf(i);
  S[i].spMode = [m, m, m, m, m]; S[i].spModeRest = m;
  S[i].spMv = ['auto', 'auto', 'auto', 'auto', 'auto']; S[i].spMvRest = 'auto';
}

function pick(i, key) {
  S[i].key = key;
  S[i].fast = S[i].c1 = S[i].c2 = null;   // 自動選択に戻す
  resetPin(i);   // 前のポケモンで確定したわざを持ち越さない
  resetSpPlan(i);
  S[i].shadow = false;
  sideEl[i].querySelector('.shadowtab').setAttribute('aria-pressed', false);
  S[i].maxLv = 51; syncSmax(i);
  S[i].ivMode = 'auto'; S[i].mIvs = null; S[i].mLevel = null;   // 個体値も理想に戻す
  sideEl[i].querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'auto'));
  sideEl[i].querySelector('.custIv').style.display = 'none';
  if (mode === 'rocket' && i === 1) syncRocket();   // ロケット団のポケモンはシャドウ固定
  run();
}

// ---- 実行 ----
const parseNums = v => (v || '').split(/[^0-9]+/).filter(Boolean).map(Number);
// 連戦の引き継ぎ設定(開始HP%・開始ゲージ)を計算用の設定に足す
const carryOf = i => S[i].carry ? { startHpPct: S[i].cHp, startEn: S[i].cEn } : {};
// 発ごとのSP設定(何発目をどのタイミング・どのわざで撃つか)を計算用の設定に変換する
// move=null は「自動」＝その時点で威力効率が高いほうをエンジンが選ぶ
function shotsCfg(i, m1, m2) {
  const pick = v => v === '2' ? m2 : v === '1' ? m1 : null;
  return { timing: 'shots',
    shotPlan: S[i].spMode.map((mode, k) => ({ mode, move: pick(S[i].spMv[k]) })),
    shotRest: { mode: S[i].spModeRest, move: pick(S[i].spMvRest) } };
}
// 一覧系で使う「自分側の1構成」を作る(SP2指定・発ごとの設定を1対1シミュと同じ扱いにする)
function listSideCfg(i, base, pol, sh, timing) {
  // 一覧系のブラフは共通の「ブラフ」枠で両者まとめて決める(片側だけ違うと見かたが分かりにくい)
  const c = { ...base, ...pol, timing, shields: sh, bluff: metaBluff };
  if (S[i].timing === 'plan' || S[i].c2) {
    const m1 = S[i].c1 || (pol.charged ? pol.charged[0] : pol.throw), m2 = S[i].c2 || m1;
    c.charged = [m1, S[i].c2].filter(Boolean);
    delete c.throw;
    Object.assign(c, shotsCfg(i, m1, m2));
  }
  return c;
}
// 1対1シミュの結果・タイムライン・共有ボタンを引っ込める。
// hint=true のときは「わざを選ぶと結果が出る」ことだけ短く伝える
function hideDuelResult(hint) {
  const rEl = document.getElementById('result');
  rEl.innerHTML = hint ? '<div class="mtnote">わざを選ぶと結果が出ます</div>' : '';
  rEl.style.display = hint ? 'block' : 'none';
  document.getElementById('tl').style.display = 'none';
  document.getElementById('share').style.display = 'none';
}
function run() {
  // 一覧系は多数のポケモンを回すので、確率わざの切り替えは常に出す。
  // 対面を1つに決めて計算する画面だけ、そのわざを使っているときに絞る(下で上書きする)
  setProbTab(true);
  if (mode === 'multi') { runMulti(); return; }
  if (mode === 'counter') { runCounter(); return; }
  if (mode === 'party') { runParty(); return; }
  if (mode === 'blog') { setProbTab(false); runBlog(); return; }   // 対戦記録(自分の土俵の環境分析)
  if (mode === 'mock') { runMockBuild(); return; }   // GBL模擬戦(3匹×3匹の対人戦)
  // ロケット団戦の1対1は、まず「誰で攻撃すればいいか」のランキングを出す
  if (mode === 'rocket' && RK.play === '1v1' && RKR.view !== 'sim') { setProbTab(false); runRkRank(); return; }
  if (mode === 'rocket' && RK.team) { runRkBuild(); return; }   // 模擬戦(3匹の通し)
  const rk = mode === 'rocket';       // ロケット団戦: 相手はNPC、CP制限なし
  if (!S[0].key || !S[1].key) { hideDuelResult(); return; }
  const capX = rk ? 0 : cap;
  // 手動交代の直後は自分も1ターン(0.5秒)動けない
  const myStall = rk ? RK_ENTER[RK.enter].me : 0;
  const base = S.map((s, i) => {
    const c = carryOf(i);
    if (s.ivMode === 'manual' && s.mIvs) return { key: s.key, ivs: s.mIvs.slice(), level: s.mLevel, shadow: s.shadow, cap: capX, ...c };
    const r1 = rank1(s.key, capX, 0, s.maxLv);
    return { key: s.key, ivs: r1.ivs, level: r1.level, shadow: s.shadow, cap: capX, ...c };
  });
  if (myStall) base[0].stallStart = myStall;
  // マニュアル個体値のCPと実数値を表示し、リーグ上限超えは警告する(計算は続行)。
  // 実数値はブレイクポイントの数字と同じ基準(シャドウ補正込み)なので、設定の調整に使える
  S.forEach((s, i) => {
    const note = sideEl[i].querySelector('.ivnote');
    if (s.ivMode === 'manual' && s.mIvs) {
      const st = PvpEngine.buildStats(D, base[i]);
      const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
      note.innerHTML = `この設定のCP: <b>${st.cp}</b>` + (capX && st.cp > capX ? ' <span class="over">⚠リーグ上限超え</span>' : '') +
        `<div class="ivstats">攻 <b>${f1(st.atk)}</b>・防 <b>${f1(st.def)}</b>・HP <b>${st.hp}</b></div>`;
    } else note.textContent = '';
    // CP上限のないリーグ(マスター・ロケット団戦)では入手別の1位個体は意味がないので隠す
    const noCap = !capX;
    const el2 = sideEl[i];
    [el2.querySelector('.ivpresetttl'), el2.querySelector('.ivpresets')].forEach(n => {
      if (n) n.style.display = noCap ? 'none' : '';
    });
    // 交換できないポケモンは下限10未満の入手方法(大親友交換・シャドウレイド)を出さない
    const fl = ivFloorOf(s.key);
    el2.querySelectorAll('.ivpresets button').forEach(b => { b.style.display = +b.dataset.f < fl ? 'none' : ''; });
  });
  // 1対1シミュは「自分で選んだ構成の結果を見る」画面なので、
  // わざを選ぶまでは結果を出さない(わざ欄だけ先に用意して選べるようにする)
  fillMoves(0, { ...base[0], fast: S[0].fast, throw: S[0].c1 });
  fillMoves(1, rk
    ? rkCfg({ ...base[1], fast: S[1].fast || rkPool(S[1].key).fasts[0], charged: [], throw: S[1].c1 })
    : { ...base[1], fast: S[1].fast, throw: S[1].c1 });
  // SPアタックは「撃たない」ときは選ばなくても結果を出せる。
  // ロケット団戦のあいては「わざ全通りの最悪ケース」仕様なので選ばせない(じぶんだけ見る)
  const needMv = i => !S[i].fast ||
    (S[i].timing !== 'never' && !S[i].c1 && movePool(S[i].key).chargeds.length);
  // 能力変化わざの設定は、そういうわざを実際に選んでいるときだけ出す
  const selCfg = i => ({ fast: S[i].fast, throw: S[i].c1, charged: [S[i].c1, S[i].c2].filter(Boolean) });
  setProbTab(anyProbMove([selCfg(0), selCfg(1)]));
  // 溜め打ちタブ: 確定で自分の能力が下がるSPアタックを選んでいる側にだけ出す(GBL専用・2026-08-18)。
  // 対象わざを外したら隠し、選ばれたままなら「最適」へ戻す(隠れた設定が裏で効かないように)
  const selfDebuf = id => { const m = id && D.moves[id];
    return !!(m && m.bf && m.bt !== 'opponent' && (m.bc == null || m.bc >= 1) && (m.bf[0] < 0 || m.bf[1] < 0)); };
  [0, 1].forEach(i => {
    const ok = !rk && [S[i].c1, S[i].c2].some(selfDebuf);
    const b = sideEl[i].querySelector('.timing button[data-v="stock"]');
    if (b) b.style.display = ok ? '' : 'none';
    if (!ok && S[i].timing === 'stock') {
      S[i].timing = 'optimal';
      sideEl[i].querySelectorAll('.timing button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'optimal'));
    }
  });
  if (needMv(0) || (!rk && needMv(1))) { hideDuelResult(true); return; }
  // わざの自動最適化(ﾏﾆｭｱﾙタイミング側は「最適」扱いでわざだけ決める)
  // わざの最適化も実際のシールド枚数で行う(一覧のマスをタップしたときに結果が一致する)
  // ロケット団戦では相手のシールドは種別で決まる(したっぱ0枚・リーダー/サカキ2枚)
  const curSh = i => rk && i === 1 ? rkShields() : (S[i].shieldMode === 'plan' ? 2 : S[i].shields);
  // わざの候補(policies)側でSP1/SP2の組を決めるので、ここではポケモン・シールド・タイミングだけ渡す
  const optCfg = (i, sh) => {
    const c = { ...base[i], shields: sh, bluff: S[i].bluff,
      timing: ['plan', 'never', 'stock'].includes(S[i].timing) ? 'optimal' : S[i].timing,
      ...polOpts(i) };
    // 「撃たない」ときは、わざの選び方もSPを撃たない前提にそろえる(表示と結果を食い違わせない)
    if (S[i].timing === 'never') { c.timing = 'shots'; c.shotPlan = []; c.shotRest = null; }
    return rk && i === 1 ? rkCfg(c) : c;
  };
  // ロケット団戦はあいてのわざがランダムなので「最悪ケース基準」で選ぶ(rkOptimize)
  const opt2 = (a, b) => rk ? rkOptimize(optCfg(0, a), optCfg(1, b)) : optimize(optCfg(0, a), optCfg(1, b));
  const plan = opt2(curSh(0), curSh(1));
  // 自動選出のわざはここで確定して控える(pin)。以後は手動で変えるか、
  // ポケモン・リーグを替えるまで同じ構成を使い続ける(設定をいじるたびに勝手に変わらないように)。
  // ロケット団のあいては「わざ全通りの最悪ケース」を見る仕様なので固定しない
  const pinMoves = (i, pol) => {
    if (!S[i].fast && pol.fast) S[i].pin.fast = pol.fast;
    if (!S[i].c1) S[i].pin.c1 = pol.throw || (pol.charged && pol.charged[0]) || null;
  };
  pinMoves(0, plan.left);
  if (!rk) pinMoves(1, plan.right);
  // pol=採用するわざ構成 / sh=シールド枚数 / usePlan=マニュアル指定(何発目で使うか)を反映するか
  const fin = (i, pol, sh, usePlan) => {
    const c = { ...base[i], ...pol, bluff: S[i].bluff };
    if (S[i].fast) c.fast = S[i].fast;
    if (S[i].c1) c.throw = S[i].c1;
    if (usePlan && S[i].shieldMode === 'plan') {
      c.shields = 2;
      c.shieldPlan = S[i].shieldSlots.map((on, k) => on ? k + 1 : 0).filter(Boolean);
      c.shieldRest = S[i].shieldRest;
    } else c.shields = sh;
    // SP1は「選んだわざ > 候補として選ばれたわざ」の順で決まる(SP2指定時はpol.chargedの1本目が候補)
    const m1 = S[i].c1 || (pol.charged ? pol.charged[0] : c.throw), m2 = S[i].c2 || m1;
    c.charged = [m1, S[i].c2].filter(Boolean);
    c.throw = m1;   // 画面のSPアタック欄にも実際に使うわざを表示する
    // 発ごとの設定: 各発のタイミング(最適/最短/+N発)とわざ(自動/1/2)を指定。
    // 溜め打ちはエンジン側が撃つ発とタイミングを決めるので、SP2本選択時でも発ごとの設定へ変換しない
    if (S[i].timing === 'never') { c.timing = 'shots'; c.shotPlan = []; c.shotRest = null; }
    else if (S[i].timing !== 'stock' && (S[i].timing === 'plan' || S[i].c2)) Object.assign(c, shotsCfg(i, m1, m2));
    else c.timing = S[i].timing;
    return rk && i === 1 ? rkCfg(c) : c;
  };
  const L = fin(0, plan.left, curSh(0), true), R = fin(1, plan.right, curSh(1), true);
  const res = PvpEngine.simulate(D, L, R, SIMOPT);
  // シャドウ個体は結果・タイムラインの名前にも反映する
  // シャドウ個体は結果・タイムラインの名前にも反映する(ロケット団のポケモンは常にシャドウ)
  [L, R].forEach((c, i) => { if (c.shadow || c.statMult) res.final[i].name = 'シャドウ' + res.final[i].name; });
  // シールド枚数別の勝敗(3×3): 各マスでわざ構成も選び直す(マスをタップした結果と一致させるため)
  // ロケット団戦は相手のシールドが固定なので、自分のシールド枚数(0/1/2)だけを並べる
  const bList = rk ? [curSh(1)] : [0, 1, 2];
  const matrix = [];
  for (let a = 0; a <= 2; a++) {
    const row = [];
    for (const b of bList) {
      const p = a === curSh(0) && b === curSh(1) ? plan : opt2(a, b);
      const r = PvpEngine.simulate(D, fin(0, p.left, a, false), fin(1, p.right, b, false), SIMOPT);
      const w = r.winner;
      row.push({ w, pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100) });
    }
    matrix.push(row);
  }
  render(res, L, R, matrix);
}

// あいてが打ってくるわざの全通り。picked=true なら画面で指定されたわざだけに絞る
function rkFoeCombos(cfgR, picked) {
  let { fasts, chargeds } = rkPool(cfgR.key);
  if (picked && S[1].fast && fasts.includes(S[1].fast)) fasts = [S[1].fast];
  if (picked && S[1].c1 && chargeds.includes(S[1].c1)) chargeds = [S[1].c1];
  const spList = chargeds.length ? chargeds : [null];
  const out = [];
  for (const f of fasts) for (const sp of spList) out.push({ fast: f, throw: sp });
  return out;
}
// ロケット団戦のわざ最適化(最悪ケース基準)
// あいてのわざはランダムなので「お互いが最善を尽くす」前提は合わない。
// 自分のわざはバトル中に変えられないので、あいての全通りに対して
//   ①勝てる通りが多い ②その中で最悪ケースがマシ
// の順でいちばん強い構成を選び、表示は「その構成にとっていちばんキツいわざ」で出す。
// こうすると主結果・シールド枚数別の勝敗・わざ全通り表の数字が食い違わない。
function rkOptimize(cfgL, cfgR) {
  const PL = policies(cfgL.key, cfgL);
  const all = rkFoeCombos(cfgR, false);      // 自分のわざ選びは常に全通りで評価する
  const shown = rkFoeCombos(cfgR, true);     // 画面でわざを指定していれば、表示はその中の最悪ケース
  const foeCfg = c => ({ ...cfgR, fast: c.fast, charged: c.throw ? [c.throw] : [], throw: c.throw });
  let best = null;
  for (const pol of PL) {
    const L = { ...cfgL, ...pol, timing: cfgL.timing || 'optimal' };
    let wins = 0, worst = null;
    for (const c of all) {
      const r = PvpEngine.simulate(D, L, foeCfg(c), SIMOPT);
      if (r.winner === 0) wins++;
      const sc = rkWorstScore(r);   // 勝つ場合は「遅いほどキツい」も込みで最悪を見る
      if (worst === null || sc < worst) worst = sc;
    }
    if (!best || wins > best.wins || (wins === best.wins && worst > best.worst)) best = { wins, worst, pol, L };
  }
  // 選んだ構成にとって、いちばんキツいわざを主結果として出す(最悪ケース基準)
  let show = shown[0], showSc = null;
  for (const c of shown) {
    const sc = rkWorstScore(PvpEngine.simulate(D, best.L, foeCfg(c), SIMOPT));
    if (showSc === null || sc < showSc) { showSc = sc; show = c; }
  }
  return { left: best.pol, right: show, wins: best.wins, n: all.length };
}

// ---- あいてのわざ全通り(ロケット団戦) ----
// ロケット団のあいては、おぼえるわざの中からランダムに打ってくるので決め打ちできない。
// そこで全通り試して「どのわざで来ても勝てるか」を出す。
// 自分のわざはバトル中に変えられないので L は固定したまま、あいてのわざだけ差し替える。
function rkAllMoves(L, R) {
  const { fasts, chargeds } = rkPool(R.key);
  const spList = chargeds.length ? chargeds : [null];   // SPを覚えないポケモンはノーマルだけ
  const rows = [];
  for (const f of fasts) for (const sp of spList) {
    const r = PvpEngine.simulate(D, L, { ...R, fast: f, charged: sp ? [sp] : [], throw: sp }, SIMOPT);
    const me = r.final[0], foe = r.final[1];
    rows.push({ fast: f, sp, win: r.winner === 0, draw: r.winner === 'draw', turns: rkClock(r),
      pct: Math.round(me.hp / me.hpMax * 100), foePct: Math.round(foe.hp / foe.hpMax * 100),
      score: rkWorstScore(r),   // 自分から見た良さ。低いほどキツい
      cur: f === R.fast && sp === (R.throw || null) });
  }
  // キツい順に並べる。先頭がいちばん危ないわざ
  // (勝つ場合は決着が遅いほど・残りが少ないほど、負ける場合は相手を削れていないほどキツい)
  rows.sort((a, b) => a.score - b.score);
  return { rows, wins: rows.filter(r => r.win).length };
}
// あいてのわざ全通りの表(タップでそのわざに切り替えてタイムラインを確認できる)
function rkMovesHtml(all) {
  const sec = t => (t / 2).toFixed(1);
  const n = all.rows.length, w = all.wins;
  const worst = all.rows[0];
  const head = w === n ? `<b class="ok">◯ どのわざでも勝ち</b>　<small>${n}通り</small>`
    : w === 0 ? `<b class="ng">✕ どのわざでも負け</b>　<small>${n}通り</small>`
    : `<b class="ng">△ わざ次第</b>　<small>${n}通り中 ${w}通りで勝ち</small>
       <span class="rkdanger">危険: ${mvChip(D.moves[worst.fast].n)}${worst.sp ? mvChip(D.moves[worst.sp].n) : ''}</span>`;
  const rowHtml = r => `<tr class="${r.cur ? 'cur' : ''}" data-f="${r.fast}" data-c="${r.sp || ''}">
    <td>${mvChip(D.moves[r.fast].n)}${r.sp ? '<span class="rkmvsp">' + mvChip(D.moves[r.sp].n) + '</span>' : ''}</td>
    <td class="${r.win ? 'w' : 'l'}"><b>${r.draw ? '△' : r.win ? '◯' : '✕'}</b></td>
    <td>${sec(r.turns)}</td>
    <td>${r.win ? `${r.pct}%` : `<span class="foepct">${r.foePct}%</span>`}</td></tr>`;
  return `<div class="rkmoves">
    <div class="mvhead">🎲 あいてのわざ全通り<small>キツい順</small></div>
    <div class="rkmvsum">${head}</div>
    <table><tr><th style="text-align:left">わざ</th><th>勝敗</th><th>⏱</th><th>残り</th></tr>
      ${all.rows.map(rowHtml).join('')}</table>
  </div>`;
}

function fillMoves(i, cfg) {
  // ロケット団のあいては、おぼえるわざ(特別なわざを除く)しか打ってこないので候補を絞る
  const rkFoe = !!cfg.statMult;
  const el = sideEl[i], { fasts, chargeds } = poolOf(cfg);
  const p = D.pokemon[cfg.key];
  el.querySelector('.pkview').style.display = 'block';
  // 表示はシャドウマーク(入力欄以外は名前の左にマークを付ける・2026-08-13タダシさん指示)
  el.querySelector('.nm').innerHTML = (cfg.shadow ? SHADOWMK : '') + p.n;
  el.querySelector('.ticons').innerHTML = typeIcons(p, 18);
  el.querySelector('.ticons').className = 'ticons tpair';
  const st = PvpEngine.buildStats(D, cfg);
  // SCP: 攻撃×防御×耐久を総合したPvP向け評価値(ロケット団のポケモンは基準が違うので出さない)
  el.querySelector('.scp').textContent = cfg.statMult ? '' : 'SCP ' + Math.floor(Math.pow(st.atk * st.def * st.hp, 2 / 3) / 10);
  // ロケット団のポケモンは個体値・PLでなく倍率でステータスが決まるので、実数値をそのまま出す
  // (シャドウ補正をかける前の値＝ゲームやシミュレータの表示に合わせる)
  el.querySelector('.ivline').textContent = cfg.statMult
    ? `CP${st.cp}／攻${st.baseAtk.toFixed(2)}・防${st.baseDef.toFixed(2)}・HP${st.hp}`
    : `CP${st.cp} / 個体値${cfg.ivs.join('/')} / PL${cfg.level}`;
  // タイプは同名で複数タイプがあるわざ(ウェザーボール等)だけ表記する
  const opt = (m, sel) => {
    const mv = D.moves[m];
    const suf = NAME_TYPES[mv.n].size > 1 ? `（${D.typeJa[mv.t]}）` : '';
    return `<option value="${m}"${m === sel ? ' selected' : ''}>${mv.n}${suf}</option>`;
  };
  // おぼえないわざも含めて選択可能にする(検証・お試し用)
  // 同名・同タイプの別ID(カメックス専用版など)とタイプ不定のめざめるパワーは除外
  const byName = (a, b) => D.moves[a].n.localeCompare(D.moves[b].n, 'ja');
  const sig = m => D.moves[m].n + '|' + D.moves[m].t;
  const others = (isFast, own) => {
    const ownSig = new Set(own.map(sig)), seen = new Set();
    return Object.keys(D.moves).filter(m => {
      const mv = D.moves[m];
      if (isFast ? !mv.eg : !mv.e) return false;
      if (own.includes(m) || m === 'HIDDEN_POWER_NORMAL') return false;
      const s = sig(m);
      if (ownSig.has(s) || seen.has(s)) return false;
      seen.add(s);
      return true;
    }).sort(byName);
  };
  const otherF = others(true, fasts);
  const otherC = others(false, chargeds);
  // ロケット団のあいては打ってこないわざを選べても意味がないので「その他のわざ」を出さない
  const grouped = (own, others, sel) => rkFoe
    ? own.map(m => opt(m, sel)).join('')
    : `<optgroup label="おぼえるわざ">${own.map(m => opt(m, sel)).join('')}</optgroup>` +
      `<optgroup label="その他のわざ（本来おぼえない）">${others.map(m => opt(m, sel)).join('')}</optgroup>`;
  // わざ欄は「選ぶ前は欄の中に薄くわざの種類を出し、選んだらわざ名に変わる」方式。
  // 自分で選んでいないあいだ(＝自動でいちばん良い構成を使う)は見出しを兼ねたプレースホルダーにする
  const ph = (sel, key, label, own, others, cur) => {
    const un = !S[i][key];   // 未選択＝自動。どのわざにも selected を付けず、見出しを選んだ状態にする
    sel.innerHTML = `<option value=""${un ? ' selected' : ''}>${label}</option>` + grouped(own, others, un ? null : cur);
    sel.classList.toggle('ph', un);
  };
  ph(el.querySelector('.selFast'), 'fast', 'ノーマルアタック', fasts, otherF, cfg.fast);
  ph(el.querySelector('.selC1'), 'c1', 'SPアタック', chargeds, otherC, cfg.throw);
  ph(el.querySelector('.selC2'), 'c2', 'SPアタック2', chargeds, otherC, S[i].c2);
  el.querySelector('.c2clear').style.display = S[i].c2 ? '' : 'none';
  // ブラフ設定はSPアタックを2本持たせたときだけ意味があるので、そのときだけ出す。
  // 一覧系(環境一覧・カウンター検索・パーティ診断)は共通の「ブラフ」枠で両者まとめて決めるので出さない
  el.querySelector('.bluffwrap').style.display =
    S[i].c2 && !['multi', 'counter', 'party'].includes(mode) ? 'block' : 'none';
  el.querySelectorAll('.bluff button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!S[i].bluff));
  // 発ごとのSP設定窓: ﾏﾆｭｱﾙ時またはSPアタック2選択時に表示(カウンター検索は手順を指定しないので出さない)。
  // 溜め打ちは撃つ発をエンジンが決めるので窓を出さない
  const showSp = !['never', 'stock'].includes(S[i].timing) && (S[i].timing === 'plan' || !!S[i].c2) && mode !== 'counter';
  const spEl = el.querySelector('.custSp');
  spEl.style.display = showSp ? 'block' : 'none';
  // SPアタック2を選んだだけのときは折りたたむ(出っぱなしだと縦に長くて目のノイズになる)。
  // タイミング「ﾏﾆｭｱﾙ」は手順を指定する画面なので常に開く
  const open = S[i].timing === 'plan' || S[i].spOpen;
  spEl.classList.toggle('fold', !open);
  spEl.querySelector('.popttl').setAttribute('aria-expanded', open);
  if (showSp) buildSpConfig(i, S[i].c1 || cfg.throw, S[i].c2);
}

// 「発ごとのSP設定」小窓(タイミングとわざを1行で選ぶ)
function buildSpConfig(i, m1, m2) {
  const el = sideEl[i];
  el.querySelector('.custSp .legend').innerHTML = m2
    ? `1 = ${mvChip(D.moves[m1].n)}　2 = ${mvChip(D.moves[m2].n)}<br><span class="autonote">自 = 自動（その時点で威力効率が高いほうを撃つ）</span>`
    : `SP: ${mvChip(D.moves[m1].n)}`;
  const optHtml = sel =>
    `<option value="opt"${sel === 'opt' ? ' selected' : ''}>最適</option>` +
    `<option value="min"${sel === 'min' ? ' selected' : ''}>最短</option>` +
    `<option value="sync"${sel === 'sync' ? ' selected' : ''}>同時</option>` +
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
      `<option value="${n}"${sel === n ? ' selected' : ''}>＋${n}発</option>`).join('');
  const labels = ['1発目', '2発目', '3発目', '4発目', '5発目', '6発目〜'];
  el.querySelector('.sprows').innerHTML = labels.map((lbl, k) => {
    const mode = k < 5 ? S[i].spMode[k] : S[i].spModeRest;
    const mv = k < 5 ? S[i].spMv[k] : S[i].spMvRest;
    return `<div class="sprow"><span class="lbl">${lbl}</span>
      <select class="tsel" data-k="${k}">${optHtml(mode)}</select>
      ${m2 ? `<button data-k="${k}" data-v="auto" aria-pressed="${mv === 'auto'}" title="威力効率が高いほうを自動で選ぶ">自</button>
      <button data-k="${k}" data-v="1" aria-pressed="${mv === '1'}">1</button>
      <button data-k="${k}" data-v="2" aria-pressed="${mv === '2'}">2</button>` : ''}
    </div>`;
  }).join('');
  el.querySelectorAll('.custSp .tsel').forEach(sel => sel.onchange = () => {
    const k = +sel.dataset.k;
    const v = ['opt', 'min', 'sync'].includes(sel.value) ? sel.value : +sel.value;
    if (k < 5) S[i].spMode[k] = v; else S[i].spModeRest = v;
    // 発ごとに触ったらタイミングは「ﾏﾆｭｱﾙ」表示にする
    if (S[i].timing !== 'plan') {
      S[i].timing = 'plan';
      el.querySelectorAll('.timing button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'plan'));
    }
    run();
  });
  el.querySelectorAll('.custSp .sprows button').forEach(b => b.onclick = () => {
    const k = +b.dataset.k;
    if (k < 5) S[i].spMv[k] = b.dataset.v; else S[i].spMvRest = b.dataset.v;
    run();
  });
}

function render(res, L, R, matrix) {
  // 確率で能力が上下するわざを使っている対面のときだけ、扱いの切り替えを出す
  setProbTab(anyProbMove([L, R]));
  fillMoves(0, L); fillMoves(1, R);
  const rEl = document.getElementById('result');
  rEl.style.display = 'block';
  const badge = i => res.winner === 'draw' ? '<span class="badge draw">DRAW</span>'
    : res.winner === i ? '<span class="badge win">WIN</span>' : '<span class="badge lose">LOSE</span>';
  const fighter = (i, cfg) => {
    const f = res.final[i];
    const pct = Math.round(f.hp / f.hpMax * 100);
    // ゲージ(0〜100)はメーターで、シールドは🛡️で残数を見せる(使った分は薄く表示)
    const enPct = Math.min(100, f.en);
    const shInit = cfg.shieldPlan ? 2 : cfg.shields;
    // シールドを持たない側(したっぱなど0枚設定)は、シールドの行そのものを出さない
    const shHtml = shInit === 0 ? ''
      : `<div class="subline shline">${Array.from({ length: shInit },
          (_, k) => `<span class="sh${k < f.shields ? '' : ' usedsh'}">🛡️</span>`).join('')}</div>`;
    // 連戦設定を使っているときは開始状態を明示する
    const carryTxt = cfg.startHpPct != null || cfg.startEn
      ? `<div class="carrytag">連戦 HP${cfg.startHpPct != null ? cfg.startHpPct : 100}%・ゲージ${cfg.startEn || 0}</div>` : '';
    return `<div class="fighter">
      <div class="top">${badge(i)}<span class="nm">${shMark(f.name)}</span></div>
      ${carryTxt}
      <div class="hpbar"><i class="${pct <= 25 ? 'low' : ''}" style="width:${pct}%"></i></div>
      <div class="subline">HP ${f.hp}/${f.hpMax}（${pct}%）</div>
      <div class="enbar"><i style="width:${enPct}%"></i></div>
      <div class="subline">ゲージ <b>${f.en}</b></div>
      ${shHtml}
    </div>`;
  };
  // 技ごとの集計
  const mvRows = i => {
    const cfg = i === 0 ? L : R;
    const s = res.final[i];
    const uses = {};
    res.rows.forEach(row => {
      const e = row.ev[i];
      if (!e) return;
      uses[e.move] = uses[e.move] || { n: 0, dmg: e.dmg, sh: 0 };
      uses[e.move].n++;
      uses[e.move].dmg = Math.max(uses[e.move].dmg, e.full || e.dmg);
      if (e.shielded) uses[e.move].sh++;
    });
    return Object.entries(uses).map(([n, u]) =>
      `<div class="mvrow">${mvChip(n)}<span class="num">威力${u.dmg}・${u.n}回${u.sh ? `（<span class="shield">🛡×${u.sh}</span>）` : ''}</span></div>`).join('');
  };
  // シールド枚数別の勝敗表(マスをタップでその設定に切替)。
  // ロケット団戦は相手のシールドが種別で決まっているので、自分の枚数だけの1列にする
  const rkMode = mode === 'rocket';
  const curA = S[0].shieldMode ? -1 : S[0].shields, curB = rkMode ? 0 : (S[1].shieldMode ? -1 : S[1].shields);
  const mtxCell = (a, b) => {
    const c = matrix[a][b];
    const cls = c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l';
    const txt = c.w === 'draw' ? '分' : c.w === 0 ? '勝ち' : '負け';
    return `<td class="${cls}${a === curA && b === curB ? ' cur' : ''}" data-a="${a}" data-b="${b}">
      <b>${txt}</b><small>${c.w === 'draw' ? '両者0' : '残HP' + c.pct + '%'}</small></td>`;
  };
  const mtxHtml = rkMode ? `<div class="shmtx">
    <div class="mvhead">🛡 自分のシールド別<small>タップで切替</small></div>
    <table>
      <tr><th class="corner">自分のシールド</th><th>勝敗</th></tr>
      ${[0, 1, 2].map(a => `<tr><th>🛡${a}</th>${mtxCell(a, 0)}</tr>`).join('')}
    </table></div>` : `<div class="shmtx">
    <div class="mvhead">🛡 シールド枚数別<small>タップで切替・残HPは勝った側</small></div>
    <table>
      <tr><th class="corner">自分＼相手</th><th>🛡0</th><th>🛡1</th><th>🛡2</th></tr>
      ${[0, 1, 2].map(a => `<tr><th>🛡${a}</th>${[0, 1, 2].map(b => mtxCell(a, b)).join('')}</tr>`).join('')}
    </table></div>`;
  // 「同時」を使っているときは、撃ち合いになったらどちらが先に当たるか(CMP)を出す
  let cmpHtml = '';
  if (S[0].timing === 'sync' || S[1].timing === 'sync') {
    const at = [PvpEngine.buildStats(D, L).atk, PvpEngine.buildStats(D, R).atk];
    const fst = at[0] >= at[1] ? 0 : 1;   // 攻撃の実数値が高いほうが先に当たる
    const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
    cmpHtml = `<div class="cmpnote">同じターンに撃ち合ったときは <b>${res.final[fst].name}</b> のSPアタックが先に当たります
      （能力変化がない状態の攻撃実数値 ${fmt1(at[fst])} ${at[0] === at[1] ? '＝' : '＞'} ${fmt1(at[1 - fst])}。
      戦闘中に攻撃が上下すると入れ替わることがあります）</div>`;
  }
  // ロケット団戦は「いかに早く倒せるか」が大事なので、決着までの時間を必ず出す。
  // あいてのわざはランダムなので、全通り試した結果も添える
  let rkHtml = '';
  if (rkMode) {
    rkHtml = `<div class="rktime">⏱ <b>${(rkClock(res) / 2).toFixed(1)}</b>秒</div>` + rkMovesHtml(rkAllMoves(L, R));
  }
  // 技一覧もHPバー等と同じ左右2列に揃える(中央のVSは列幅合わせ用の不可視スペーサー)
  rEl.innerHTML = `
    <div class="vs">${fighter(0, L)}<div class="vsmark">VS</div>${fighter(1, R)}</div>
    ${cmpHtml}
    ${rkHtml}
    ${mtxHtml}
    <div class="mvcols">
      <div class="mvside"><div class="mvhead">${res.final[0].name}の技</div>${mvRows(0)}</div>
      <div class="vsmark" style="visibility:hidden">VS</div>
      <div class="mvside"><div class="mvhead">${res.final[1].name}の技</div>${mvRows(1)}</div>
    </div>
    <a class="bplink" href="${bpUrl(L, R)}">🎯 ブレイクポイント<small>ダメージが変わる境目を先回り</small><b>↗</b></a>`;
  // 3×3表のマスをタップ→両者のシールド枚数をその組み合わせに変更
  rEl.querySelectorAll('.shmtx td[data-a]').forEach(td => td.onclick = () => {
    [+td.dataset.a, +td.dataset.b].forEach((v, i) => {
      if (rkMode && i === 1) return;   // ロケット団戦は相手のシールドが種別で決まっている
      S[i].shieldMode = null; S[i].shields = v;
      sideEl[i].querySelectorAll('.shields button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.v === v));
      sideEl[i].querySelector('.custShield').style.display = 'none';
    });
    run();
  });
  // わざ全通りの行をタップ→あいてのわざをそれに切り替える(タイムラインでどう負けるか確認できる)
  rEl.querySelectorAll('.rkmoves tr[data-f]').forEach(tr => tr.onclick = () => {
    S[1].fast = tr.dataset.f;
    S[1].c1 = tr.dataset.c || null;
    run();
  });
  lastRes = res;
  renderTimeline();
  document.getElementById('share').style.display = 'flex';
  updateUrl();
}

// 現在の設定を共有URLへ反映(1対1・環境一覧の両モードで使用)
function updateUrl() {
  // ロケット団対策ページはCP制限なし・モード固定なので lg / md はURLに書かない
  const qp = PAGE_ROCKET ? {} : { lg: cap };
  if (S[0].key) qp.l = S[0].key;
  if (S[1].key) qp.r = S[1].key;
  qp.sl = S[0].shieldMode ? 2 : S[0].shields;
  qp.sr = S[1].shieldMode ? 2 : S[1].shields;
  qp.tl = S[0].timing === 'plan' ? 'optimal' : S[0].timing;
  qp.tr = S[1].timing === 'plan' ? 'optimal' : S[1].timing;
  // マニュアル個体値は「攻.防.HP.PL」形式でURLに含める
  S.forEach((s, i) => {
    if (s.ivMode === 'manual' && s.mIvs) qp[i ? 'ir' : 'il'] = s.mIvs.join('.') + '.' + s.mLevel;
    if (s.shadow) qp[i ? 'shr' : 'shl'] = 1;
    if (s.maxLv !== 51) qp[i ? 'mlr' : 'mll'] = s.maxLv;
    if (s.carry) qp[i ? 'cyr' : 'cyl'] = s.cHp + '.' + s.cEn;   // 連戦(開始HP%.開始ゲージ)
    if (s.bluff) qp[i ? 'bfr' : 'bfl'] = 1;   // ブラフする設定(既定はしない)
    // わざ構成(ノーマル~SP1~SP2)。手動選択は「!」付き、自動選出の確定値はそのまま書く。
    // これが無いと、共有リンクを開いた人の側で自動選出をやり直すことになり、
    // 送り主が確定させた構成と食い違うことがある
    if (s.key) {
      const f = s.fast ? '!' + s.fast : (s.pin.fast || '');
      const c = s.c1 ? '!' + s.c1 : (s.pin.c1 || '');
      if (f || c || s.c2) qp[i ? 'mvr' : 'mvl'] = [f, c, s.c2 || ''].join('~');
    }
  });
  if (cup) qp.cup = cup.slug;
  if (mode !== 'duel' && !PAGE_ROCKET && !PAGE_BLOG) qp.md = mode;   // モード固定ページはmdを書かない
  if (mode === 'mock') {   // GBL模擬戦の設定(じぶんのパーティは端末内保存なのでURLには入れない)
    if (MK.ai !== 'normal') qp.gai = MK.ai;   // 既定(NORMAL)以外のときだけ書く
    if (MK.leadSwap) qp.gls = 1;   // 開幕交代
    if (MK.foeAuto) qp.gfa = 1;    // あいてのわざオート(何が飛んでくるか分からない)
    if (!RB.step) qp.rbs = 0;      // 見かた(結果だけ)。ロケット団の模擬戦と同じパラメータ
    const t = [0, 1, 2].filter(i => GBT[i]).map(i =>
      [GBT[i].key, GBT[i].shadow ? 1 : '', GBT[i].fast || '', GBT[i].c1 || '', GBT[i].c2 || ''].join('~'));
    if (t.length) qp.gt = t.join(',');
    // 決断で選んだ内容(rb=)は普段のURLには書かない(リロードで復元されて場面が素通りするため)。
    // 共有はコピーボタンを押した時だけ付ける(ロケット団の模擬戦と同じ扱い)
  }
  if (mode === 'counter' && cnTop !== 50) qp.cn = cnTop;   // 対策さがしで探す範囲(既定50・100/all)
  if (metaBluff && ['multi', 'counter', 'party'].includes(mode)) qp.bf = 1;   // 環境リスト側のブラフ(既定はしない)
  if (SIMOPT.buffMode !== 'none') qp.pb = SIMOPT.buffMode;   // 確率わざの扱い
  if (mode === 'rocket') {   // ロケット団戦の設定
    qp.rk = RK.kind; qp.rs = RK.stall; qp.re = RK.enter;
    const w = rkWho();   // リーダー・サカキの手持ち(だれと・何匹目に誰を選んでいるか)
    if (w) { qp.rw = w.id; qp.rl = rkSel(w).join(''); }
    if (RK.team) {   // 模擬戦(自分のパーティは端末内に保存しているのでURLには入れない)
      qp.rt = 1;
      if (RK.leadSwap) qp.rls = 1;   // 開幕交代
      if (!RB.step) qp.rbs = 0;   // 見かた(結果だけ)
      // 決断で選んだ内容(rb=)は普段のURLには書かない。書くとリロードで復元されて
      // 「答えた場面が聞かれずに素通りする」ため。共有はコピーボタンを押した時だけ付ける
      const t = [0, 1, 2].filter(i => RKT[i]).map(i => [RKT[i].key, RKT[i].fast || '', RKT[i].c1 || ''].join('~'));
      if (t.length) qp.rp = t.join(',');
    }
  }
  history.replaceState(null, '', '?' + new URLSearchParams(qp).toString());
}

// ---- タイムライン(ダイジェスト/全ターン切替) ----
let lastRes = null, tlMode = 'all';
// タイムラインの表を作る(1対1シミュで使う)
function timelineTable(res, tlMode) {
  // HPの残り割合で色分け: 緑(50%以上)・黄(20〜50%未満)・赤(20%未満)
  const hpCls = (i, hp) => {
    const pct = hp / res.final[i].hpMax;
    return hp === 0 || pct < 0.2 ? 'hpr' : pct < 0.5 ? 'hpy' : 'hpg';
  };
  // 能力変化はデータから向きを判定し、太い矢印(⬆⬇)で表示
  // 1段階ちょうど以外(2段階や「期待値」設定の端数)は矢印のうしろに段階数を添える
  const stg = d => {
    const a = Math.abs(d);
    return a === 1 ? '' : String(Math.round(a * 100) / 100);
  };
  const buffTxt = e => {
    if (!e.buff) return '';
    const dA = e.buff.to[0] - e.buff.from[0], dD = e.buff.to[1] - e.buff.from[1];
    const pre = e.buff.target === 'opponent' ? '相手' : '';
    let t = '';
    if (dA) t += pre + '攻' + (dA > 0 ? '⬆' : '⬇') + stg(dA);
    if (dD) t += (t ? ' ' : '') + pre + '防' + (dD > 0 ? '⬆' : '⬇') + stg(dD);
    return t ? ` <span class="${dA + dD >= 0 ? 'buffup' : 'buffdown'}">${t}</span>` : '';
  };
  // CCT等でゲージが足りているのに余分に打ったノーマルアタックへ(+n)を付与
  res.rows.forEach(row => { row._extra = [null, null]; });
  for (let i = 0; i < 2; i++) {
    let extra = 0;
    for (let idx = 0; idx < res.rows.length; idx++) {
      const e = res.rows[idx].ev[i];
      if (!e) continue;
      if (e.full !== undefined) { extra = 0; continue; }   // SPアタックでリセット
      const prevEn = idx > 0 ? res.rows[idx - 1].state[i].en : 0;
      let cost = null;
      for (let j = idx + 1; j < res.rows.length; j++) {
        const ev2 = res.rows[j].ev[i];
        if (ev2 && ev2.full !== undefined) { cost = MOVE_COST[ev2.move] || null; break; }
      }
      if (cost != null && prevEn >= cost) { extra++; res.rows[idx]._extra[i] = '+' + extra; }
      else extra = 0;
    }
  }
  // わざの発動は1発ずつ枠(フレーム)に入れて見分けやすくする
  const cellEv = (row, i) => {
    const e = row.ev[i], opp = row.ev[1 - i];
    let h = '';
    // ロケット団戦の硬直(この側は動けないターン)
    if (!e && row.stalled && row.stalled[i]) h = '<span class="evbox stallbox">硬直</span>';
    if (e) {
      let t = mvChip(e.move);
      if (e.shielded) t += ' -1';
      else if (e.full) t += ` <b>-${e.dmg}</b>`;
      else t += ` -${e.dmg}`;
      if (row._extra && row._extra[i]) t += ` <span class="extra">(${row._extra[i]})</span>`;
      t += buffTxt(e);
      h = `<span class="evbox">${t}</span>`;
      // ウッウ: 獲物を咥えた／吐き出した(吐き出しの能力ダウンは撃った側が受ける)
      if (e.gulpOn) h += ` <span class="evbox gulp">${GULP_MK[e.gulpOn]}${GULP_JA[e.gulpOn]}のすがた</span>`;
      if (e.gulp) h += ` <span class="evbox gulp">${GULP_MK[e.gulp.form]}${GULP_JA[e.gulp.form]}：反撃${
        e.gulp.dmg ? ` <b>-${e.gulp.dmg}</b>` : ''}${buffTxt({ buff: { ...e.gulp.buff, target: 'self' } })}</span>`;
    }
    // シールドは「使った側」に表示する
    if (opp && opp.shielded) h += (h ? ' ' : '') + '<span class="evbox shield">🛡シールド</span>';
    // ミミッキュのばけのかわ発動も「防いだ側」に表示する
    if (opp && opp.disguised) h += (h ? ' ' : '') + '<span class="evbox shield">👻ばけのかわ 防⬇</span>';
    return h;
  };
  // SPアタックを打った行のENはピンクで「ゲージを消費した」ことを示す
  const enCls = (row, i) => (row.ev[i] && row.ev[i].full !== undefined) ? ' class="ensp"' : '';
  // SPアタックが番号行に入る場合(番号行が空くケース)もハイライトする
  const spRow = row => row.tn === '-' ||
    (row.ev[0] && row.ev[0].full !== undefined) || (row.ev[1] && row.ev[1].full !== undefined);
  const rowHtml = (row, prev) => {
    // 全ターン表示では、前の行と同じ数字は省略して変化だけを見せる
    const num = (v, pv) => (prev && v === pv) ? '' : v;
    const p = prev ? prev.state : null;
    return `<tr${spRow(row) ? ' class="charged"' : ''}>
      <td class="ev">${cellEv(row, 0)}</td>
      <td class="${hpCls(0, row.state[0].hp)}${row.state[0].hp === 0 ? ' ko' : ''}">${num(row.state[0].hp, p && p[0].hp)}</td><td${enCls(row, 0)}>${num(row.state[0].en, p && p[0].en)}</td>
      <td class="tn">${row.tn}</td>
      <td${enCls(row, 1)}>${num(row.state[1].en, p && p[1].en)}</td><td class="${hpCls(1, row.state[1].hp)}${row.state[1].hp === 0 ? ' ko' : ''}">${num(row.state[1].hp, p && p[1].hp)}</td>
      <td class="ev r">${cellEv(row, 1)}</td>
    </tr>`;
  };
  // ダイジェスト: ゲージ技・シールド・バフ・決着の行だけを残し、間は1行にたたむ
  const isKey = (row, idx) => row.tn === '-' || idx === res.rows.length - 1 ||
    (row.ev[0] && (row.ev[0].full || row.ev[0].buff)) || (row.ev[1] && (row.ev[1].full || row.ev[1].buff));
  let body = '';
  if (tlMode === 'digest') {
    let hidden = [];
    const flush = () => {
      if (!hidden.length) return;
      const a = hidden[0].tn, b = hidden[hidden.length - 1].tn;
      // ロケット団戦: たたんだ中に相手の硬直が含まれていたらターン数を添える
      const st = hidden.filter(r => r.stalled && r.stalled[1]).length;
      body += `<tr class="gap"><td colspan="7">… ノーマルアタックの応酬 ${hidden.length}ターン（TN${a}${a === b ? '' : '〜' + b}）` +
        `${st ? `<span class="stallbox">うち あいての硬直 ${st}ターン</span>` : ''}…</td></tr>`;
      hidden = [];
    };
    res.rows.forEach((row, idx) => {
      if (isKey(row, idx)) { flush(); body += rowHtml(row); }
      else hidden.push(row);
    });
    flush();
  } else {
    // 全ターン: わざ1発を「所要ターン分の高さの枠」で表示(あわ=3ターンなら3行分の枠)
    const n = res.rows.length;
    const blocks = [[], []];
    for (let i = 0; i < 2; i++) {
      let start = 0, turnStart = 0;
      res.rows.forEach((row, idx) => {
        if (row.tn !== '-') turnStart = idx;   // この行が属するターンの先頭行
        if (!row.ev[i]) return;
        // SPアタックの枠は「発動したターンの先頭行〜そのターンの最終行(次の番号行の直前)」。
        // それより前の待ちは行ごとの空セルにして罫線を通常どおり区切る
        const isSp = row.ev[i].full !== undefined;
        // ノーマルアタックは番号ターンでしか開始できない。直前に相手のSP解決行(tn='-')があると
        // 枠がその行から始まって「SPと同じタイミングで打ち始めた」ように見えてしまうので、
        // 先頭の'-'行は待ちセルに逃がす(例: 2ターンわざがT10に発生→相手SP解決('-')→次の1発の開始はT11から。
        // 差し込みで'-'行に完了したわざは、開始した番号ターンから枠が始まる=このスキップで正しい位置になる)
        let s;
        if (isSp) s = Math.max(start, turnStart);
        else { s = start; while (s < idx && res.rows[s].tn === '-') s++; }
        for (let k = start; k < s; k++) blocks[i].push({ start: k, end: k, ev: null, idle: true });
        let e = idx;
        if (isSp) while (e + 1 < n && res.rows[e + 1].tn === '-') e++;
        blocks[i].push({ start: s, end: e, evRow: idx, ev: row.ev[i] });
        start = e + 1;
      });
      if (start < n) {   // 打ちかけで終了した分(こちらも先頭の'-'行は待ちセルへ)
        let s = start;
        while (s < n && res.rows[s].tn === '-') s++;
        for (let k = start; k < s; k++) blocks[i].push({ start: k, end: k, ev: null, idle: true });
        if (s < n) blocks[i].push({ start: s, end: n - 1, ev: null });
      }
    }
    const shieldRows = [[], []];   // その側がシールドを使った行
    const disguiseRows = [[], []];   // その側のばけのかわが発動した行
    res.rows.forEach((row, idx) => {
      for (let i = 0; i < 2; i++) {
        if (row.ev[i] && row.ev[i].shielded) shieldRows[1 - i].push(idx);
        if (row.ev[i] && row.ev[i].disguised) disguiseRows[1 - i].push(idx);
      }
    });
    const blockTd = (i, idx) => {
      const b = blocks[i].find(x => x.start === idx);
      if (!b) return '';
      const shs = shieldRows[i].filter(r => r >= b.start && r <= b.end);
      const dgs = disguiseRows[i].filter(r => r >= b.start && r <= b.end);
      let moveHtml = '';
      if (b.ev) {
        moveHtml = mvChip(b.ev.move);
        if (b.ev.shielded) moveHtml += ' -1';
        else if (b.ev.full) moveHtml += ` <b>-${b.ev.dmg}</b>`;
        else moveHtml += ` -${b.ev.dmg}`;
        const ex = res.rows[b.evRow]._extra && res.rows[b.evRow]._extra[i];
        if (ex) moveHtml += ` <span class="extra">(${ex})</span>`;
        moveHtml += buffTxt(b.ev);
        // ウッウ: 獲物を咥えた／吐き出した(吐き出しの能力ダウンは撃った側が受けるので「相手」は付けない)
        if (b.ev.gulpOn) moveHtml += ` <span class="gulpbox">${GULP_MK[b.ev.gulpOn]}${GULP_JA[b.ev.gulpOn]}のすがた</span>`;
        if (b.ev.gulp) moveHtml += ` <span class="gulpbox">${GULP_MK[b.ev.gulp.form]}${GULP_JA[b.ev.gulp.form]}を吐き出し${
          b.ev.gulp.dmg ? ` <b>-${b.ev.gulp.dmg}</b>` : ''}${buffTxt({ buff: { ...b.ev.gulp.buff, target: 'self' } })}</span>`;
      }
      // ロケット団戦の硬直(この側が動けないターン)は、わざの入っていない枠に「硬直」と出す
      let stn = 0;
      for (let k = b.start; k <= b.end; k++) if (res.rows[k].stalled && res.rows[k].stalled[i]) stn++;
      const stallHtml = stn ? `<span class="stallbox">硬直${stn === b.end - b.start + 1 ? '' : stn}</span>` : '';
      if (!b.ev) moveHtml = stn === b.end - b.start + 1 ? stallHtml : (b.idle ? stallHtml : '…' + stallHtml);
      else if (stn) moveHtml = stallHtml + '<br>' + moveHtml;   // 硬直が明けてから出したわざ
      // 待ちの空セルは枠なし・通常の罫線で1行ずつ区切る(シールド類は防いだSPと同じ段に出る)
      if (b.idle) return `<td class="ev ${i ? 'r' : 'l'}">${shs.length ? '<span class="shield">🛡シールド</span>' : ''}${dgs.length ? '<span class="shield">👻ばけのかわ 防⬇</span>' : ''}${moveHtml}</td>`;
      // 時系列順に上から並べる: シールド類は防いだSPアタックの段、わざ名はダメージ発生の段
      const er = b.evRow != null ? b.evRow : b.end;
      const items = shs.map(r => ({ row: r, h: '<span class="shield">🛡シールド</span>' }));
      dgs.forEach(r => items.push({ row: r, h: '<span class="shield">👻ばけのかわ 防⬇</span>' }));
      items.push({ row: er + 0.5, h: moveHtml });
      items.sort((a, b2) => a.row - b2.row);
      const inner = items.map(x => x.h).join('');
      // わざ名は発動行の位置(枠の上端/下端)へ寄せる(シールド併記時は行順の積み上げで表現)
      let align = '';
      if (!shs.length && !dgs.length && b.end > b.start) {
        if (er === b.start) align = ' vtop';
        else if (er === b.end) align = ' vbottom';
      }
      const cls = 'mvblock ' + (i ? 'r' : 'l')
        + (b.ev && b.ev.full !== undefined ? ' spblock' : '')
        + (b.ev ? '' : ' pendingblock')
        + align;
      return `<td class="${cls}" rowspan="${b.end - b.start + 1}">${inner}</td>`;
    };
    body = res.rows.map((row, idx) => {
      const prev = res.rows[idx - 1];
      const num = (v, pv) => (prev && v === pv) ? '' : v;
      const p = prev ? prev.state : null;
      return `<tr${spRow(row) ? ' class="charged"' : ''}>
        ${blockTd(0, idx)}
        <td class="${hpCls(0, row.state[0].hp)}${row.state[0].hp === 0 ? ' ko' : ''}">${num(row.state[0].hp, p && p[0].hp)}</td><td${enCls(row, 0)}>${num(row.state[0].en, p && p[0].en)}</td>
        <td class="tn">${row.tn}</td>
        <td${enCls(row, 1)}>${num(row.state[1].en, p && p[1].en)}</td><td class="${hpCls(1, row.state[1].hp)}${row.state[1].hp === 0 ? ' ko' : ''}">${num(row.state[1].hp, p && p[1].hp)}</td>
        ${blockTd(1, idx)}
      </tr>`;
    }).join('');
  }
  return `<div style="overflow-x:auto"><table class="tltbl">
    <tr><th style="text-align:left">${res.final[0].name}</th><th>HP</th><th>EN</th><th>TN</th><th>EN</th><th>HP</th><th style="text-align:right">${res.final[1].name}</th></tr>
    ${body}
  </table></div>`;
}
function renderTimeline() {
  const res = lastRes;
  if (!res) return;
  const tl = document.getElementById('tl');
  tl.style.display = 'block';
  tl.innerHTML = `<div class="tlhead"><h3>タイムライン<small>0.5秒=1ターン</small></h3>
    <div class="tlmode">
      <button aria-pressed="${tlMode === 'all'}" data-m="all">全ターン</button>
      <button aria-pressed="${tlMode === 'digest'}" data-m="digest">山場のみ</button>
    </div></div>` + timelineTable(res, tlMode);
  tl.querySelectorAll('.tlmode button').forEach(b => b.onclick = () => { tlMode = b.dataset.m; renderTimeline(); });
}

// オフラインでも起動できるようにService Workerを登録する
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

document.getElementById('copyUrl').onclick = async () => {
  // 模擬戦は「選んだ手」も含めて共有する。リンクを開いた人にはその手順が再現される
  let url = location.href;
  if ((mode === 'rocket' && RK.team) || mode === 'mock') {
    const ansStr = rbAnsToStr();
    if (ansStr) { const u = new URL(location.href); u.searchParams.set('rb', ansStr); url = u.toString(); }
  }
  await navigator.clipboard.writeText(url);
  document.getElementById('copyUrl').textContent = 'コピーしました ✅';
  setTimeout(() => document.getElementById('copyUrl').textContent = '結果のURLをコピー', 1500);
};

// ---- URLパラメータからの復元 ----
// ---- かんたん案内(初心者向けの入り口・2026-08-26) ----
// 質問に答えると、目的に合ったモードへ設定済みの状態で移動する「案内係」。
// 計算と画面は既存モードをそのまま使う(答えの二重管理をしない)。
// 初回訪問(共有リンク以外)は自動で開く。一度閉じたら以後は出ない(開き直しは常設の🔰ボタン)
const EASY_KEY = PAGE_ROCKET ? 'rkt_easy_seen' : 'gbl_easy_seen';
// 「共有リンクで開いたか」は読み込み時点のURLで判定する(初期化後はツールが状態をURLへ書き戻すため)
const EASY_HAD_QS = !!location.search;
const easySeen = () => { try { return localStorage.getItem(EASY_KEY) === '1'; } catch (e) { return true; } };
const easyMark = () => { try { localStorage.setItem(EASY_KEY, '1'); } catch (e) {} };
const EASY = { step: null, who: null, act: null };

// GBLの目的4つ。search=検索ステップの質問文(選んだキーを go に渡す) / note=移動前に出す一言
const EASY_GBL = [
  { ic: '🆚', t: 'この相手に勝ちたい', d: '相手の名前を入れると、勝てるポケモンが強い順に出ます',
    search: 'あいてのポケモンの名前は？',
    go(key) { easyMode('counter'); pick(1, key); sideEl[1].querySelector('input').value = D.pokemon[key].n; tourStart('counter'); } },
  { ic: '🔍', t: '自分のポケモンで誰に勝てるか知りたい', d: '名前を入れると、環境上位50匹との勝ち負けが一覧で出ます',
    search: 'じぶんのポケモンの名前は？',
    go(key) { easyMode('multi'); pick(0, key); sideEl[0].querySelector('input').value = D.pokemon[key].n; tourStart('multi'); } },
  { ic: '🩺', t: 'パーティの弱点を調べたい', d: '3匹を入れると、3匹とも勝てない相手(穴)が分かります',
    note: 'パーティ診断を開きます。3つの枠にじぶんのポケモンを入れると、環境上位50匹への勝ち負けと、3匹とも勝てない相手(穴)が出ます。',
    go() { easyMode('party'); tourStart('party'); } },
  { ic: '▶', t: '実戦の練習がしたい', d: '3対3の対人戦を、SPアタック・シールド・交代を選びながら戦えます',
    note: '模擬戦を開きます。じぶん3匹とあいて3匹を入れて「▶ バトルスタート！」を押すと、決断の場面ごとに自分で選びながら戦えます。',
    go() { easyMode('mock'); tourStart('mock'); } },
];
// ロケット団: 誰と戦うか → どうするか、の2段。適用は最後にまとめて行う
// (モードを先に切り替えてから手持ちを呼び出すと、rkPutAll がそのモードに合わせて枠を埋める)
const EASY_RK_WHO = [
  { v: 'grunt', ic: '😈', t: 'したっぱ', d: 'ムサシ・コジロウもこちら。あいてのポケモンはこの後で入れます' },
  { v: 'leader', w: 'sierra', ic: '👑', t: 'シエラ', d: 'リーダー。手持ちが自動で入ります' },
  { v: 'leader', w: 'cliff', ic: '👑', t: 'クリフ', d: 'リーダー。手持ちが自動で入ります' },
  { v: 'leader', w: 'arlo', ic: '👑', t: 'アルロ', d: 'リーダー。手持ちが自動で入ります' },
  { v: 'boss', ic: '💀', t: 'サカキ', d: 'ボス。手持ちが自動で入ります' },
];
const EASY_RK_ACT = [
  { v: 'rank', ic: '🗡', t: '誰で攻撃すればいいか見る', d: '勝てるポケモンが火力の高い順に出ます' },
  { v: 'team', ic: '▶', t: '3匹の通しをためす(模擬戦)', d: '手持ち3匹で最後まで戦えるかを試せます' },
];

function easyMode(m) {
  const b = document.querySelector(`#modes button[data-m="${m}"]`);
  if (b) b.click();
  window.scrollTo({ top: 0 });
}
function easyClose() {
  easyMark();
  const ov = document.getElementById('easyov');
  if (ov) ov.remove();
}
// ロケット団: 選んだ「誰と」を画面に適用する(既存ボタンのクリックで=処理を二重に持たない)
function easyRkApply() {
  const w = EASY_RK_WHO[EASY.who];
  const kb = document.querySelector(`#rkkind button[data-v="${w.v}"]`);
  if (kb) kb.click();
  if (w.w) { const wb = document.querySelector(`#rkwho button[data-w="${w.w}"]`); if (wb) wb.click(); }
  window.scrollTo({ top: 0 });
}
function easyOpen() {
  easyClose();   // 二重に開かない(開き直し)
  EASY.step = PAGE_ROCKET ? 'who' : 'goal'; EASY.who = null; EASY.act = null;
  const ov = document.createElement('div');
  ov.id = 'easyov'; ov.className = 'easyov';
  ov.innerHTML = '<div class="easywin" role="dialog"></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) easyClose(); });
  easyRender();
}
function easyRender() {
  const win = document.querySelector('#easyov .easywin');
  if (!win) return;
  const card = (o, i) => `<button class="easycard" data-i="${i}"><span class="ic">${o.ic}</span><span class="tx"><b>${o.t}</b><small>${o.d}</small></span></button>`;
  const head = `<div class="easyhd"><span>🔰</span><b>かんたん案内</b><button class="easyx" title="閉じる">✕</button></div>`;
  let body = '', q = '';
  if (EASY.step === 'goal') { q = '何をしたいですか？'; body = `<div class="easycards">${EASY_GBL.map(card).join('')}</div>`; }
  if (EASY.step === 'search') {
    const g = EASY_GBL[EASY.goal];
    q = g.search;
    body = `<div class="sugg"><input type="search" placeholder="ポケモン名(例: マリルリ)" autocomplete="off"><div class="sugg-list"></div></div>
      <button class="easyback">← もどる</button>`;
  }
  if (EASY.step === 'note') {
    const g = EASY_GBL[EASY.goal];
    body = `<div class="easynote">${g.note}</div><button class="easygo">開く</button><button class="easyback">← もどる</button>`;
  }
  if (EASY.step === 'who') { q = '誰と戦いますか？'; body = `<div class="easycards">${EASY_RK_WHO.map(card).join('')}</div>`; }
  if (EASY.step === 'act') { q = 'どうしますか？'; body = `<div class="easycards">${EASY_RK_ACT.map(card).join('')}</div><button class="easyback">← もどる</button>`; }
  if (EASY.step === 'gfoe') {
    q = 'あいてのポケモンの名前は？(画面に出ている名前)';
    body = `<div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
      <button class="easyback">← もどる</button>`;
  }
  if (EASY.step === 'rknote') {
    const grunt = EASY_RK_WHO[EASY.who].v === 'grunt';
    body = `<div class="easynote">模擬戦を開きます。じぶんの3枠に手持ちのポケモンを入れて${grunt ? '、あいての3枠に画面に出ているポケモンを入れて' : ''}「▶ バトルスタート！」を押すと、決断の場面ごとに自分で選びながら戦えます。</div>
      <button class="easygo">開く</button><button class="easyback">← もどる</button>`;
  }
  win.innerHTML = head + (q ? `<div class="easyq">${q}</div>` : '') + body;
  win.querySelector('.easyx').onclick = easyClose;
  const back = win.querySelector('.easyback');
  if (back) back.onclick = () => {
    EASY.step = PAGE_ROCKET ? (EASY.step === 'act' ? 'who' : 'act') : 'goal';
    easyRender();
  };
  // 選択肢カード
  win.querySelectorAll('.easycard').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (EASY.step === 'goal') {
      EASY.goal = i;
      const g = EASY_GBL[i];
      if (g.search) { EASY.step = 'search'; easyRender(); easyFocus(); }
      else { EASY.step = 'note'; easyRender(); }
      return;
    }
    if (EASY.step === 'who') { EASY.who = i; EASY.step = 'act'; easyRender(); return; }
    if (EASY.step === 'act') {
      EASY.act = EASY_RK_ACT[i].v;
      if (EASY.act === 'rank') {
        const mb = document.querySelector('#rkmode button[data-v="0"]');
        if (mb) mb.click();
        easyRkApply();
        if (EASY_RK_WHO[EASY.who].v === 'grunt') { EASY.step = 'gfoe'; easyRender(); easyFocus(); }
        else { easyClose(); tourStart('rkrank'); }
      } else {
        EASY.step = 'rknote'; easyRender();
      }
    }
  });
  // 「開く」(説明を読んでから移動するステップ)
  const go = win.querySelector('.easygo');
  if (go) go.onclick = () => {
    if (EASY.step === 'note') EASY_GBL[EASY.goal].go();
    else {   // rknote: 模擬戦へ切り替えてから手持ちを適用する
      const mb = document.querySelector('#rkmode button[data-v="1"]');
      if (mb) mb.click();
      easyRkApply();
      easyClose(); tourStart('rkteam'); return;
    }
    easyClose();
  };
  // 検索ステップ(GBLのあいて/じぶん・ロケット団のしたっぱのあいて)
  const inp = win.querySelector('.sugg input'), list = win.querySelector('.sugg-list');
  if (inp) {
    const filt = EASY.step === 'gfoe' ? (k => rkFoeOk(1, k)) : null;
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) {
        const v = toKata(inp.value);
        if (v !== inp.value) inp.value = v;
      }
      const qq = toKata(inp.value.trim());
      if (!qq) { list.style.display = 'none'; return; }
      const hits = searchPk(qq, filt);
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        const key = d.dataset.k;
        if (EASY.step === 'gfoe') { pick(1, key); sideEl[1].querySelector('input').value = D.pokemon[key].n; easyClose(); tourStart('rkrank'); return; }
        EASY_GBL[EASY.goal].go(key);
        easyClose();
      });
    });
  }
}
function easyFocus() {
  const inp = document.querySelector('#easyov .sugg input');
  if (inp) inp.focus();
}

// ---- ふきだしツアー(かんたん案内の続き・2026-08-26タダシさん指示) ----
// 案内で移動した先で放置しないための「次に何を見るか」の目線誘導。
// 対象を水色に光らせて、そばにふきだしを1つずつ出す。✕でいつでも抜けられる。
// 対象が無い/隠れているステップは自動で飛ばす(一覧の表は40ms区切りの非同期描画なのでリトライで待つ)
const TOUR = { steps: null, i: 0, retry: 0 };
// 最後は必ず💡説明モードへの誘導(案内が終わったあとも自力で調べられる出口)
const TOUR_LAST = { sel: '#themesw .explainsw',
  tx: 'わからない言葉や数字が出てきたら、この💡をONにして<b>長押し</b>すると説明が出ます' };
const TOUR_DEFS = {
  counter: [
    { sel: '#counter .mttbl', tx: '<b>勝てるポケモンが強い順</b>に並んでいます。🛡の列はシールドの枚数ごとの勝敗で、行をタップすると対面の詳しい流れが開きます' },
    { sel: '#counter .mtrange', tx: '範囲を<b>「全ポケモン」</b>にすると、あまり使われていないポケモンからも対策を探せます' },
  ],
  multi: [
    { sel: '#multi .mtscore', tx: '<b>環境スコア</b>＝環境の相手と2回対面して、少なくとも1回勝てる確率です。高いほど活躍できます' },
    { sel: '#multi .mttbl', tx: '環境上位50匹との<b>勝敗の一覧</b>です。マスをタップすると、その対面の詳しい流れが開きます' },
  ],
  party: [
    { sel: '#party .pslots', tx: 'この<b>3つの枠</b>にパーティを入れると、下に診断の結果が出ます。★からは登録した個体も呼べます' },
    { sel: '#party .ptauto', tx: 'わざは自分で選べます。<b>「オート」</b>にすると実戦の定番構成を自動でセットします' },
  ],
  mock: [
    { sel: '#mock .rkteams', tx: '<b>じぶん3匹とあいて3匹</b>を入れて「▶ バトルスタート！」を押します。決断の場面で止まるので、選びながら進めます' },
    { sel: '#mock .gbaibar', tx: '<b>難易度に応じてあいての強さが変わります</b>。<b>EASY</b>＝やさしい入門向け／<b>NORMAL</b>＝実戦の基本戦術で戦う標準／<b>HARD</b>＝こちらの手の内を知り尽くした最強。希望の難易度に設定して挑戦してください' },
  ],
  rkrank: [
    { sel: '#rkrank .mttbl, #rkrank .rklist, #rkrank', tx: '<b>ノーマルアタックの火力が高い順</b>です。ロケット団戦は速く倒すのがいちばん大事です。行をタップするとシミュレートが開きます' },
    { sel: '#rkviewbtns', tx: '<b>「高火力＋安定」</b>にすると、あいてのどのわざでも先に倒されないポケモンだけに絞れます' },
    { sel: '#rkmytab', tx: 'CPと個体値を入れると、<b>自分の個体の順位</b>が分かります' },
  ],
  rkteam: [
    { sel: '#rkteam .rkteams', tx: '<b>じぶんの3枠</b>に手持ちを入れて「▶ バトルスタート！」を押します。決断の場面で止まるので、選びながら進めます' },
  ],
};
function tourEnd() {
  TOUR.steps = null;
  document.querySelectorAll('.gtip').forEach(e => e.remove());
  document.querySelectorAll('.gtip-hi').forEach(e => e.classList.remove('gtip-hi'));
}
function tourStart(name) {
  tourEnd();
  TOUR.steps = (TOUR_DEFS[name] || []).concat([TOUR_LAST]);
  TOUR.i = 0; TOUR.retry = 8;
  setTimeout(tourShow, 250);   // 移動先の描画(非同期)を少し待つ
}
function tourShow() {
  document.querySelectorAll('.gtip').forEach(e => e.remove());
  document.querySelectorAll('.gtip-hi').forEach(e => e.classList.remove('gtip-hi'));
  const st = TOUR.steps;
  if (!st || TOUR.i >= st.length) { tourEnd(); return; }
  const cur = st[TOUR.i];
  const el = document.querySelector(cur.sel);
  if (!el || el.offsetParent === null) {
    // まだ描画されていない可能性 → 少し待って再挑戦。それでも無ければこのステップは飛ばす
    if (--TOUR.retry > 0) { setTimeout(tourShow, 300); return; }
    TOUR.i++; TOUR.retry = 3; tourShow(); return;
  }
  TOUR.retry = 3;
  el.classList.add('gtip-hi');
  // 背の高い対象(表など)は中央合わせだと上端＝ふきだしの位置が画面外に出るので、上端を見える位置へ
  const tall = el.getBoundingClientRect().height > 260;
  el.scrollIntoView({ block: tall ? 'start' : 'center' });
  if (tall) window.scrollBy(0, -70);
  const r = el.getBoundingClientRect();
  const tip = document.createElement('div');
  const last = TOUR.i === st.length - 1;
  tip.className = 'gtip';
  tip.innerHTML = `<div class="tx">${cur.tx}</div>
    <div class="nav"><span class="n">${TOUR.i + 1}/${st.length}</span>
    <button class="tnext">${last ? 'おわり' : '次へ ▸'}</button>
    <button class="tskip" title="案内をとじる">✕</button></div>`;
  document.body.appendChild(tip);
  const w = Math.min(300, innerWidth - 28);
  tip.style.width = w + 'px';
  const left = Math.max(14, Math.min(innerWidth - w - 14, r.left + r.width / 2 - w / 2));
  // 背の高い対象は上端の少し下にふきだしを重ねる(下端はスクロールしないと見えないため)。矢印は消す
  tip.style.left = left + 'px';
  tip.style.top = ((tall ? r.top + 46 : r.bottom + 10) + scrollY) + 'px';
  if (tall) tip.classList.add('noarrow');
  else tip.style.setProperty('--ax', Math.max(14, Math.min(w - 28, r.left + r.width / 2 - left - 7)) + 'px');
  tip.querySelector('.tnext').onclick = () => { TOUR.i++; tourShow(); };
  tip.querySelector('.tskip').onclick = tourEnd;
}
// 画面の向き・幅が変わったら位置を測り直す。モードを自分で切り替えたら案内は役目を終える
window.addEventListener('resize', () => { if (TOUR.steps) tourShow(); });
document.addEventListener('click', e => {
  if (TOUR.steps && e.target.closest('#modes, #rkmode, #rkkind')) tourEnd();
}, true);

(function init() {
  const q = new URLSearchParams(location.search);
  if (q.get('lg')) {
    cap = +q.get('lg');
    document.querySelectorAll('.lgbtn').forEach(b => b.setAttribute('aria-pressed', +b.dataset.cap === cap));
  }
  ['l', 'r'].forEach((k, i) => {
    const v = q.get(k);
    if (v && D.pokemon[v]) {
      S[i].key = v;
      sideEl[i].querySelector('input').value = D.pokemon[v].n;
      syncSmax(i);   // メガならスーパーマックスタブを表示
    }
  });
  ['sl', 'sr'].forEach((k, i) => { if (q.get(k) != null) {
    S[i].shields = +q.get(k);
    sideEl[i].querySelectorAll('.shields button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S[i].shields));
  }});
  ['tl', 'tr'].forEach((k, i) => { if (['optimal', 'asap', 'sync', 'plan', 'never', 'stock'].includes(q.get(k))) {
    timingFromUrl = true;
    S[i].timing = q.get(k);
    sideEl[i].querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[i].timing));
    resetSpPlan(i);   // 発ごとのSP設定も復元したタイミングに揃える(SPアタック2を選んだときの表示用)
  }});
  if (q.get('cn') === '100') cnTop = 100;   // 対策さがしで探す範囲
  else if (q.get('cn') === 'all') cnTop = 'all';
  if (q.get('bf') === '1') { metaBluff = true; syncBluffNote(); }   // 環境リスト側のブラフ
  if (q.get('cup')) selectCup(q.get('cup'));   // 特殊カップの復元
  ['shl', 'shr'].forEach((k, i) => {   // シャドウ指定の復元
    if (q.get(k) && S[i].key) {
      S[i].shadow = true;
      sideEl[i].querySelector('.shadowtab').setAttribute('aria-pressed', true);
      sideEl[i].querySelector('input').value = 'シャドウ' + D.pokemon[S[i].key].n;
    }
  });
  ['mll', 'mlr'].forEach((k, i) => {   // スーパーマックスレベルの復元
    const v = +q.get(k);
    if ((v === 52 || v === 53) && S[i].key) { S[i].maxLv = v; syncSmax(i); }
  });
  ['il', 'ir'].forEach((k, i) => {   // マニュアル個体値(攻.防.HP.PL)の復元
    const v = q.get(k); if (!v) return;
    const p = v.split('.').map(Number);
    if (p.length < 4 || p.some(n => isNaN(n))) return;
    S[i].ivMode = 'manual';
    S[i].mIvs = [p[0], p[1], p[2]];
    S[i].mLevel = p.length > 4 ? p[3] + p[4] / 10 : p[3];   // PL45.5は「45.5」の2要素に割れて届く
    const el = sideEl[i];
    el.querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'manual'));
    el.querySelector('.custIv').style.display = 'block';
    el.querySelector('.ivA').value = p[0]; el.querySelector('.ivD').value = p[1];
    el.querySelector('.ivH').value = p[2]; el.querySelector('.ivL').value = S[i].mLevel;
  });
  ['mvl', 'mvr'].forEach((k, i) => {   // わざ構成の復元(「!」付き=手動選択 / なし=自動選出の確定値)
    const v = q.get(k); if (!v || !S[i].key) return;
    const [f, c, c2] = v.split('~');
    const put = (val, fld) => {
      if (!val) return;
      const man = val[0] === '!';
      const id = man ? val.slice(1) : val;
      if (!D.moves[id]) return;
      if (man) S[i][fld] = id; else S[i].pin[fld] = id;
    };
    put(f, 'fast'); put(c, 'c1');
    if (c2 && D.moves[c2]) S[i].c2 = c2;
  });
  ['bfl', 'bfr'].forEach((k, i) => {   // ブラフ設定の復元(既定は「しない」。旧リンクの bfl=0 は既定と同じ)
    if (q.get(k) === '1') {
      S[i].bluff = true;
      sideEl[i].querySelectorAll('.bluff button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === '1'));
    }
  });
  ['cyl', 'cyr'].forEach((k, i) => {   // 連戦(開始HP%.開始ゲージ)の復元
    const v = q.get(k); if (!v) return;
    const p = v.split('.').map(Number);
    if (p.some(n => isNaN(n))) return;
    S[i].carry = true;
    S[i].cHp = Math.min(100, Math.max(1, p[0] || 100));
    S[i].cEn = Math.min(100, Math.max(0, p[1] || 0));
    const el = sideEl[i];
    el.querySelectorAll('.carry button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'on'));
    el.querySelector('.custCarry').style.display = 'block';
    el.querySelector('.cHp').value = S[i].cHp;
    el.querySelector('.cEn').value = S[i].cEn;
    el.querySelectorAll('.cpre button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.hp === S[i].cHp));
  });
  if (['avg', 'always'].includes(q.get('pb'))) {   // 確率で能力が上下するわざの扱いの復元
    SIMOPT.buffMode = q.get('pb');
    document.querySelectorAll('#prob button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === SIMOPT.buffMode));
    syncProbNote();
  }
  if (['grunt', 'leader', 'boss'].includes(q.get('rk'))) RK.kind = q.get('rk');   // ロケット団戦の設定の復元
  if (q.get('rs') != null && !isNaN(+q.get('rs'))) RK.stall = Math.max(0, Math.min(16, +q.get('rs')));
  if (RK_ENTER[q.get('re')]) RK.enter = q.get('re');
  // 模擬戦の復元(rt=2 は「3匹連戦」と別画面だったころの古いリンク。同じ画面に読み替える)
  if (q.get('rt') === '1' || q.get('rt') === '2') setPlay('build');
  if (q.get('rbs') === '0') RB.step = false;   // 見かた(結果だけ)の復元(rbs=1は旧リンク・既定と同じ)
  if (q.get('rls') === '1') RK.leadSwap = true;   // 開幕交代の復元
  if (q.get('rb')) rbAnsFromStr(q.get('rb'));   // 決断で選んだ内容の復元
  if (q.get('rw') && rkWhoList().some(w => w.id === q.get('rw'))) {   // 手持ち(だれと・選んだ並び)の復元
    RK.who = q.get('rw');
    const w = rkWho(), sel = (q.get('rl') || '').split('').map(Number);
    if (w) RK.sel[w.id] = w.slots.map((c, s) => (sel[s] >= 0 && sel[s] < c.length ? sel[s] : 0));
  }
  if (q.get('rp')) q.get('rp').split(',').slice(0, 3).forEach((s, i) => {
    const [key, fast, c1] = s.split('~');
    if (D.pokemon[key]) RKT[i] = { key, fast: fast || null, c1: c1 || null };
  });
  // GBL模擬戦の復元(あいての3枠・あいて難易度・開幕交代)。
  // 旧リンクの gai=basic〜pro は難易度へ読み替える(GB_AI_OLD)
  if (q.get('gai')) {
    const gv = GB_AI_OLD[q.get('gai')] || q.get('gai');
    if (GB_AI[gv]) MK.ai = gv;
  }
  if (q.get('gls') === '1') MK.leadSwap = true;
  if (q.get('gfa') === '1') MK.foeAuto = true;
  if (q.get('gt')) q.get('gt').split(',').slice(0, 3).forEach((s, i) => {
    const [key, sh, fast, c1, c2] = s.split('~');
    if (!D.pokemon[key]) return;
    const d = mockDefaultMoves(key, sh === '1');   // 欠けたわざは既定(確定値/効率)で埋める
    GBT[i] = { key, shadow: sh === '1',
      fast: D.moves[fast] ? fast : d.fast, c1: D.moves[c1] ? c1 : d.c1, c2: D.moves[c2] ? c2 : (c2 === '' ? '' : d.c2) };
  });
  if (PAGE_ROCKET || PAGE_BLOG) {   // モード固定ページ(md= は見ない)
    applyMode();
  } else if (['multi', 'counter', 'party', 'mock'].includes(q.get('md'))) {   // モードの復元(md=rocket/blog は別ページへ転送済み)
    mode = q.get('md');
    document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    applyMode();
  }
  buildPartySlots(document.querySelector('#party .pslots'), 'pt');
  buildPartySlots(document.querySelector('#rkteam .myslots'), 'rbm');   // 模擬戦でも同じ3枠(PT)を使う
  // 対戦記録(mode 'blog'): 入力の3枠と勝敗・記録ボタン・表示タブ
  buildBlogSlots();
  document.querySelectorAll('#blog .blres button').forEach(b => b.onclick = () => {
    BLE.win = BLE.win === b.dataset.v ? null : b.dataset.v;
    document.querySelectorAll('#blog .blres button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === BLE.win));
  });
  const blAdd = document.querySelector('#blog .bladd');
  if (blAdd) blAdd.onclick = blAddRecord;
  document.querySelectorAll('#blog .blvtabs button').forEach(b => b.onclick = () => { BLV.view = b.dataset.v; BLV.resetArm = false; runBlog(); });
  document.querySelectorAll('#blog .blperiod button').forEach(b => b.onclick = () => { BLV.period = b.dataset.v; BLV.resetArm = false; runBlog(); });
  // パーティ診断の「わざ｜オート」。手動へ切り替えるときは、いま出ている構成を枠に書き込んでから編集させる
  const paBtn = document.querySelector('#party .ptauto');
  if (paBtn) paBtn.onclick = () => {
    // 空いている欄だけオートの選出で埋める(★登録リストの個体や、前に自分で選んだわざは上書きしない)
    if (ptAuto) [0, 1, 2].forEach(i => {
      if (!PT[i]) return;
      const v = ptMvOf(i);
      PT[i].fast = PT[i].fast || v.fast; PT[i].c1 = PT[i].c1 || v.c1; PT[i].c2 = PT[i].c2 || v.c2 || '';
    });
    ptAuto = !ptAuto;
    savePt(); savePtAuto(); syncPtAuto();
    [0, 1, 2].forEach(i => syncPartySlot(i));
    run();
  };
  syncPtAuto();
  buildFoeSlots();
  // GBL模擬戦: じぶん3枠(PT共有・わざはGBM)とあいて3枠(GBT)・あいて難易度タブ
  buildPartySlots(document.querySelector('#mock .myslots'), 'gbm');
  buildGbFoeSlots();
  const aiBox = document.getElementById('gbai');
  if (aiBox) {
    aiBox.innerHTML = Object.keys(GB_AI).map(k =>
      `<button data-v="${k}" aria-pressed="${MK.ai === k}" title="${GB_AI[k].tip}"><b>${GB_AI[k].label}</b><small>${GB_AI[k].jp}</small></button>`).join('');
    aiBox.querySelectorAll('button').forEach(b => b.onclick = () => {
      MK.ai = b.dataset.v; saveMkAi();
      aiBox.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === MK.ai));
      run();   // バトルの署名が変わるので、スタート待ちから仕切り直しになる
    });
  }
  // あいてのわざ「えらぶ｜オート」(2026-08-20)。オート=欄を隠して環境の定番構成で戦う
  const gfAuto = document.querySelector('#mock .gfauto');
  if (gfAuto) gfAuto.onclick = () => {
    MK.foeAuto = !MK.foeAuto; saveMkFoeAuto(); syncGbFoeSlots(); run();
  };
  // 模擬戦のおすすめタブ(高火力/高火力＋安定)。同じタブをもう一度押すとオフ
  document.querySelectorAll('#rksuggbar button[data-m]').forEach(b => b.onclick = () => {
    RKS.mode = RKS.mode === b.dataset.m ? null : b.dataset.m;
    document.querySelectorAll('#rksuggbar button[data-m]').forEach(x =>
      x.setAttribute('aria-pressed', x.dataset.m === RKS.mode));
  });
  // 模擬戦の「⚙ 詳細」パネルの開閉
  const dTab = document.getElementById('rkdetailtab');
  if (dTab) dTab.onclick = () => { RKD.open = !RKD.open; renderRkDetail(); };
  // 一覧系3モードの「⚙ 詳細」パネルの開閉
  const mTab = document.getElementById('mdettab');
  if (mTab) mTab.onclick = () => { MDET.open = !MDET.open; syncMdet(); };
  document.querySelectorAll('#party .ptsh button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#party .ptsh button').forEach(x => x.setAttribute('aria-pressed', x === b));
    ptShield = +b.dataset.v;
    run();
  });
  renderMyPk();
  run();
  // かんたん案内: 常設ボタン＋初回訪問(共有リンク以外)は自動で開く
  document.getElementById('easybtn').onclick = easyOpen;
  if (!PAGE_BLOG && !EASY_HAD_QS && !easySeen()) easyOpen();   // 対戦記録ページでは案内を出さない
})();
