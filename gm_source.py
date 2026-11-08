# -*- coding: utf-8 -*-
"""
ゲーム内データ（Game Master）の取り寄せ先を選ぶ（2026-11-08タダシさん指示・取り寄せ先の改善）

同じゲーム内データを公開している置き場を2つ持ち、更新日時が新しいほうを使う。
片方が止まっても、もう片方で続く（2026-08-29〜11-08、いまの置き場が止まっていて新しいポケモンが入らなかったため）。
  使う側: build_data.py の SRC['gm']・max-battle/build_max.py の GM_URL（どちらも pick_url() を呼ぶ）

どちらの日付も「置き場が最後にゲーム内データを取り込んだ時刻」（ミリ秒）。
選んだ置き場と日付は .github/gm_source.json に控え、毎朝のお知らせ用の一文を notes() で返す。
"""
import datetime, json, os, re, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
RECORD = os.path.join(ROOT, '.github', 'gm_source.json')
STALE_DAYS = 10     # これより古ければ「止まっているかもしれない」と知らせる

SOURCES = [
    {   # ゲーム内データが変わった日に更新される（2026-09〜11は2〜5日おき・日本時間の深夜）
        'id': 'daily',
        'label': '置き場A',
        'url': 'https://raw.githubusercontent.com/alexelgt/game_masters/master/GAME_MASTER.json',
        'ts': 'https://raw.githubusercontent.com/alexelgt/game_masters/master/timestamp.json',
    },
    {   # これまでの取り寄せ先（2026-08-29で更新が止まっている）
        'id': 'pokeminers',
        'label': '置き場B',
        'url': 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json',
        'ts': 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/timestamp.txt',
    },
]

_picked = None
# ゲーム内データの元わざの名前と、ツールの＋わざの名前の書き方が違うもの（ツールは FUTURE_SIGHT_PLUS）
BASE_ALIAS = {'FUTURESIGHT': 'FUTURE_SIGHT'}


def _get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8')


def _stamp(src):
    """置き場の更新時刻（ミリ秒）。読めなければ None"""
    try:
        t = _get(src['ts']).strip()
        if t.startswith('{'):
            t = str(json.loads(t).get('uploadTime', ''))
        m = re.search(r'\d{12,}', t)
        return int(m.group()) if m else None
    except Exception as e:
        print('ゲーム内データの日付が読めない →', src['label'], e)
        return None


def _day(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d')


def pick():
    """新しいほうの置き場を返す（同じ回の中では何度呼んでも同じ答え）"""
    global _picked
    if _picked: return _picked
    stamps = [(s, _stamp(s)) for s in SOURCES]
    ok = [(s, t) for s, t in stamps if t]
    if ok:
        src, ts = max(ok, key=lambda x: x[1])
    else:   # どちらの日付も読めないときは、先頭の置き場をそのまま使う
        src, ts = SOURCES[0], None
    _picked = {'src': src, 'ts': ts, 'all': {s['id']: t for s, t in stamps}}
    print(f"ゲーム内データ: {src['label']}（{_day(ts) if ts else '日付不明'}）を使う")
    return _picked


def pick_url():
    return pick()['src']['url']


def notes():
    """毎朝のお知らせに載せる一文（変化・心配があるときだけ）。控えも書き直す"""
    p = pick()
    out = []
    try: old = json.load(open(RECORD, encoding='utf-8'))
    except Exception: old = {}
    now = datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000
    if p['ts'] is None:
        out.append('ゲーム内データの置き場の日付が2つとも読めませんでした（置き場の作りが変わったかもしれません）')
    else:
        if old.get('id') and old.get('id') != p['src']['id']:
            out.append(f"ゲーム内データの取り寄せ先を{p['src']['label']}に切り替えました（{_day(p['ts'])}の版）")
        if old.get('ts') and p['ts'] > old['ts']:
            out.append(f"ゲーム内データが新しくなりました（{_day(p['ts'])}の版）")
        days = (now - p['ts']) / 86400000
        if days > STALE_DAYS and (not old.get('stale_warned') or old.get('ts') != p['ts']):
            out.append(f"ゲーム内データが{int(days)}日更新されていません（{_day(p['ts'])}の版のまま）")
            old['stale_warned'] = True
        elif days <= STALE_DAYS:
            old['stale_warned'] = False
    for s in SOURCES:
        if p['all'].get(s['id']) is None:
            out.append(f"{s['label']}の日付が読めませんでした")
    rec = {'id': p['src']['id'], 'label': p['src']['label'], 'ts': p['ts'],
           'day': _day(p['ts']) if p['ts'] else None, 'stale_warned': old.get('stale_warned', False),
           'all': {k: (_day(v) if v else None) for k, v in p['all'].items()}}
    json.dump(rec, open(RECORD, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return out


def normalize(gm):
    """取り寄せたゲーム内データを、これまでの作りで読める形にそろえる（2026-11-08・置き場Aの11/3版で見つかった2つ）
      ① まだ名前の無いすがた（コスチューム）は form が数字 → テンプレート名から名前を作る
      ② メガの＋わざは TEMP_EVOLUTION_MEGA_…_POKEMON_… という名前 → 同じ演出（vfxName）を使う元わざの名前＋_PLUS に読み替える
         （例: 演出 fell_stinger → FELL_STINGER_PLUS。これまで手で補ってきた＋わざと同じ名前になり、本物の値が優先される）
    """
    vfx = {}
    for e in gm:
        d = e.get('data') or {}
        for k, idk in (('moveSettings', 'movementId'), ('combatMove', 'uniqueId')):
            m = d.get(k)
            if m and isinstance(m.get(idk), str) and 'TEMP_EVOLUTION' not in m[idk] and m.get('vfxName'):
                vfx.setdefault((k, m['vfxName']), m[idk].replace('_FAST', ''))
    renamed = {}
    for e in gm:
        tid = e.get('templateId', '')
        d = e.get('data') or {}
        ps = d.get('pokemonSettings')
        if ps and ps.get('form') is not None and not isinstance(ps.get('form'), str):
            i = tid.find('_POKEMON_')
            ps['form'] = tid[i + 9:] if i >= 0 else str(ps['form'])
        for k, idk in (('moveSettings', 'movementId'), ('combatMove', 'uniqueId')):
            m = d.get(k)
            if m and isinstance(m.get(idk), str) and m[idk].startswith('TEMP_EVOLUTION_MEGA'):
                base = vfx.get((k, m.get('vfxName')))
                base = BASE_ALIAS.get(base, base)
                if base:
                    renamed[m[idk]] = base + '_PLUS'
                    m[idk] = base + '_PLUS'
                    m['_megaPlus'] = True      # メガの＋わざの印（読み替えたものだけ。build_pvp_data.py が見る）
                else:
                    print('警告: メガの＋わざの元わざが分かりません →', m[idk], m.get('vfxName'))
    if renamed:
        print(f'メガの＋わざ {len(renamed)}本を「元わざ_PLUS」の名前に読み替え')
    return gm


def load():
    """新しいほうの置き場から取り寄せ、normalize した形で返す"""
    return normalize(json.loads(_get(pick_url())))


def load_file(path):
    """取り寄せ済みのファイル（マックスバトルのキャッシュ）を読んで normalize する"""
    return normalize(json.load(open(path, encoding='utf-8')))


def newer():
    """前回作り直したときより新しいゲーム内データが、どちらかの置き場に出ているか（見張り役 watch-gm.yml が使う）"""
    try: old = json.load(open(RECORD, encoding='utf-8')).get('ts') or 0
    except Exception: old = 0
    p = pick()
    return bool(p['ts'] and p['ts'] > old)


if __name__ == '__main__':
    import sys
    if '--newer' in sys.argv:
        print('yes' if newer() else 'no')
    else:
        print(pick_url())
        print(notes())
