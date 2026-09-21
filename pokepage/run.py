#!/usr/bin/env python3
"""1ポケモン1ページを最初から最後まで作り直す（毎朝の自動更新もこれを呼ぶ）。
使い方: python3 pokepage/run.py            … 確認用（pokepage/out/・全部 noindex）
        python3 pokepage/run.py --publish  … 本番の置き場所（/pokedex/<キー>/・sitemap-pokemon.xml・assets/pokepage.css）
前提: godata.json・pvp_data.json などの各ツールのデータと max-battle/latest.json（build_max.py が取ってくる）が新しいこと。
どこかで失敗したらそこで止まり、終了コード1（点検で問題が見つかったときも同じ）。
順番: 各ツールの出口から数字を集める → ゲームデータの育成情報 → コスチューム → ページの一覧 → 段階 → ページを組む → 点検
"""
import os, sys, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
pub = ['--publish'] if '--publish' in sys.argv else []
STEPS = [
    ('各ツールの出口から数字を集める', ['collect/collect.py']),
    ('ゲームデータの育成情報を抜き出す', ['gm_all.py']),
    ('コスチュームを抜き出す', ['costumes.py']),
    ('ページの一覧を作る', ['roster.py']),
    ('段階（サイトマップに載せる順）を決める', ['tiers.py']),
    ('ページを組む', ['build.py'] + pub),
    ('点検（リンク切れ・表記・数字の突き合わせ）', ['check.py'] + pub),
]
for label, args in STEPS:
    t0 = time.time()
    print('▶ ' + label, flush=True)
    r = subprocess.run([sys.executable] + args, cwd=HERE, capture_output=True, text=True)
    tail = '\n'.join((r.stdout.strip().splitlines() or [''])[-6:])
    print('  ' + tail.replace('\n', '\n  ') + '\n  （%.1f秒）' % (time.time() - t0), flush=True)
    if r.returncode:
        print(r.stderr[-3000:], file=sys.stderr)
        sys.exit('✕ 「' + label + '」で止まりました')
print('✅ すべて終わりました')
