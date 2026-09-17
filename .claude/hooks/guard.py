#!/usr/bin/env python3
"""見張り役（Claude Code のフックから呼ばれる）。

役目:
  1人目  書き換える前: そのツールの決まり(.claude/rules/*.md)がこのチャットで読み込まれていなければ止める
  2人目  書き換えた直後: そのツールの「壊してはいけない決まり」の短い一覧を見せる
  3人目  保存(git commit)の前: 書き換えたツールの決まりがすべて読み込まれているか確かめる
  4人目  保存(git commit)の前: 答え合わせ(.claude/checks/run.py)を流し、失敗なら止める

「読み込まれた」の印は次のどれかで付く:
  - InstructionsLoaded（決まりのファイルが読み込まれたと Claude Code が知らせてきた）
  - Read ツールで、決まりの対象ファイル（paths に当てはまる）か、決まりのファイル自体を開いた
会話が要約(compact)されたら印を消す（要約で決まりが消えるため）。

判断に迷ったら止める側に倒す。ただしこのプログラム自体が壊れたときは、作業を全部止めないよう
Claude に警告を出して通す（警告は必ず表示される）。
"""
import sys, os, json, re, fnmatch, shlex, subprocess, time, pathlib

ROOT = pathlib.Path(os.environ.get('CLAUDE_PROJECT_DIR') or pathlib.Path(__file__).resolve().parents[2])
CONF = ROOT / '.claude/hooks/rulesets.json'
STATE = ROOT / '.claude/state'
LOG = STATE / 'guard.log'
RAW_IN = ''


def log(msg):
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%F %T ') + msg + '\n')
        if LOG.stat().st_size > 400_000:
            LOG.write_text(LOG.read_text(encoding='utf-8')[-200_000:], encoding='utf-8')
    except Exception:
        pass


def load_conf():
    return json.loads(CONF.read_text(encoding='utf-8'))['sets']


def glob_to_re(g):
    out, i = '', 0
    while i < len(g):
        if g.startswith('**/', i):
            out += '(?:.*/)?'; i += 3
        elif g.startswith('**', i):
            out += '.*'; i += 2
        elif g[i] == '*':
            out += '[^/]*'; i += 1
        elif g[i] == '?':
            out += '[^/]'; i += 1
        else:
            out += re.escape(g[i]); i += 1
    return re.compile('^' + out + '$')


def rel(p, cwd=None):
    """プロジェクト内の相対パス（外なら None）。"""
    if not p:
        return None
    try:
        path = pathlib.Path(p)
        if not path.is_absolute():
            path = pathlib.Path(cwd or ROOT) / path
        path = pathlib.Path(os.path.normpath(str(path)))
        r = path.relative_to(ROOT)
        return str(r)
    except Exception:
        return None


def sets_for(relpath, conf):
    if relpath is None:
        return []
    hit = []
    for name, s in conf.items():
        if relpath == s['rules']:
            continue
        if any(glob_to_re(g).match(relpath) for g in s['paths']):
            hit.append(name)
    return hit


def state_file(inp):
    sid = re.sub(r'[^A-Za-z0-9_-]', '', str(inp.get('session_id', 'nosession')))[:80]
    aid = re.sub(r'[^A-Za-z0-9_-]', '', str(inp.get('agent_id', '') or ''))[:80]
    return STATE / f'{sid}{"__" + aid if aid else ""}.json'


def read_state(inp):
    try:
        return json.loads(state_file(inp).read_text(encoding='utf-8'))
    except Exception:
        return {'loaded': {}}


def write_state(inp, st):
    STATE.mkdir(parents=True, exist_ok=True)
    state_file(inp).write_text(json.dumps(st, ensure_ascii=False), encoding='utf-8')


def mark(inp, names, why):
    if not names:
        return
    st = read_state(inp)
    for n in names:
        st['loaded'][n] = {'at': time.strftime('%F %T'), 'why': why}
    write_state(inp, st)
    log(f'mark {names} ({why}) {state_file(inp).name}')


def all_strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from all_strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from all_strings(v)


def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))
    sys.exit(0)


def deny(reason):
    log('DENY ' + reason[:200].replace('\n', ' '))
    out({'hookSpecificOutput': {'hookEventName': 'PreToolUse',
                                'permissionDecision': 'deny',
                                'permissionDecisionReason': reason}})


def need_msg(conf, names, what):
    lines = [f'【見張り役】{what}の前に、次の決まりをこのチャットで読み込む必要があります（まだ読み込まれていません）。']
    for n in names:
        s = conf[n]
        ex = next((g for g in s['paths'] if '*' not in g), s['paths'][0].replace('**', 'index.html'))
        lines.append(f'- {s["label"]}: {s["rules"]}  → Read ツールで `{ex}` など対象のファイルを開くと自動で読み込まれます'
                     f'（先頭の数行でよい）。決まりの中身を確認してから、もう一度実行してください。')
    return '\n'.join(lines)


WRITE_RE = re.compile(
    r'(\bsed\s+(-[A-Za-z]*i|--in-place)|\bperl\s+-[A-Za-z]*i|\btee\b|\bmv\s|\bcp\s|\brm\s|\bpatch\b|\bdd\b|'
    r'\bgit\s+(checkout|restore|apply|mv|rm|stash\s+pop|reset)\b|write_text|write_bytes|open\([^)]*[\'"][wax]|'
    r'(^|[^0-9&>])>>?\s*[^\s&>])')


def bash_paths(cmd, cwd, conf):
    """コマンドの中に出てくる、決まりの対象ファイルのセット名。"""
    names = set()
    toks = []
    try:
        toks = shlex.split(cmd)
    except Exception:
        toks = cmd.split()
    for t in toks:
        for piece in re.split(r'[\s;|&<>()=,\'"]+', t):
            if '/' in piece or '.' in piece:
                for n in sets_for(rel(piece, cwd), conf):
                    names.add(n)
    # 文字列の中に埋め込まれたパスも拾う（python -c など）
    for name, s in conf.items():
        for g in s['paths']:
            lit = g.split('*')[0]
            if len(lit) >= 4 and lit in cmd:
                names.add(name)
    return names


def staged_sets(cmd, conf):
    files = []
    try:
        files += subprocess.run(['git', 'diff', '--cached', '--name-only'], cwd=ROOT,
                                capture_output=True, text=True, timeout=30).stdout.split()
        if re.search(r'\bcommit\b[^|;&]*\s(-[A-Za-z]*a|--all)\b', cmd):
            files += subprocess.run(['git', 'diff', '--name-only'], cwd=ROOT,
                                    capture_output=True, text=True, timeout=30).stdout.split()
        # "git add X && git commit" の形: この時点ではまだ追加されていないので、変更中のファイルも見る
        if re.search(r'\bgit\s+add\b', cmd):
            files += subprocess.run(['git', 'diff', '--name-only'], cwd=ROOT,
                                    capture_output=True, text=True, timeout=30).stdout.split()
            files += subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], cwd=ROOT,
                                    capture_output=True, text=True, timeout=30).stdout.split()
    except Exception as e:
        log(f'git error {e}')
    names = set()
    for f in files:
        names.update(sets_for(f, conf))
    return names, files


def run_checks(names, conf):
    checks = []
    for n in sorted(names):
        for c in conf[n].get('checks', []):
            if c not in checks:
                checks.append(c)
    if not checks:
        return True, ''
    r = subprocess.run([sys.executable, str(ROOT / '.claude/checks/run.py')] + checks,
                       cwd=ROOT, capture_output=True, text=True, timeout=300)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def checklist_for(names, conf):
    parts = []
    for n in sorted(names):
        p = ROOT / conf[n].get('checklist', '')
        if p.is_file():
            parts.append(p.read_text(encoding='utf-8').strip())
    return '\n\n'.join(parts)


def main():
    global RAW_IN
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    raw = RAW_IN = sys.stdin.read()
    inp = json.loads(raw or '{}')
    conf = load_conf()
    ev = inp.get('hook_event_name', mode)
    tool = inp.get('tool_name', '')
    ti = inp.get('tool_input') or {}
    cwd = inp.get('cwd') or str(ROOT)

    if mode == 'instructions':
        log('InstructionsLoaded ' + json.dumps({k: v for k, v in inp.items()
                                                if k not in ('transcript_path',)}, ensure_ascii=False)[:600])
        hit = []
        for sname, s in conf.items():
            if any(x.endswith(s['rules']) for x in all_strings(inp)):
                hit.append(sname)
        mark(inp, hit, 'instructions:' + str(inp.get('load_reason', '')))
        sys.exit(0)

    if mode == 'reset':
        try:
            state_file(inp).unlink()
        except FileNotFoundError:
            pass
        # 同じチャットの子エージェントの印も消す
        base = state_file({'session_id': inp.get('session_id')}).stem
        for p in STATE.glob(base + '__*.json'):
            p.unlink()
        log(f'reset ({ev} {inp.get("source", inp.get("trigger", ""))}) {base}')
        sys.exit(0)

    if mode == 'post-read':
        fp = rel(ti.get('file_path'), cwd)
        names = sets_for(fp, conf)
        for n, s in conf.items():
            if fp == s['rules']:
                names.append(n)
        mark(inp, names, 'read:' + str(fp))
        sys.exit(0)

    if mode == 'pre':
        st = read_state(inp)['loaded']
        if tool in ('Edit', 'Write', 'MultiEdit', 'NotebookEdit'):
            fp = rel(ti.get('file_path') or ti.get('notebook_path'), cwd)
            names = [n for n in sets_for(fp, conf) if n not in st]
            if names:
                deny(need_msg(conf, names, f'`{fp}` の書き換え'))
            sys.exit(0)
        if tool == 'Bash':
            cmd = ti.get('command', '')
            if re.search(r'\bgit\s+(-C\s+\S+\s+)?commit\b', cmd):
                names, files = staged_sets(cmd, conf)
                miss = sorted(n for n in names if n not in st)
                if miss:
                    deny(need_msg(conf, miss, '保存（コミット）'))
                ok, report = run_checks(names, conf)
                log(f'checks {sorted(names)} ok={ok}')
                if not ok:
                    deny('【見張り役4・答え合わせ】結果が変わっています。保存を止めました。\n' + report[-3000:]
                         + '\n\nわざと仕様を変えた場合は、答えを書き換える前に必ずタダシさんに確認すること。')
                if names:
                    out({'hookSpecificOutput': {'hookEventName': 'PreToolUse',
                                                'additionalContext': '【見張り役3・4】決まりの読み込みと答え合わせを確認しました。\n' + report[-1500:]}})
                sys.exit(0)
            if WRITE_RE.search(cmd):
                names = sorted(n for n in bash_paths(cmd, cwd, conf) if n not in st)
                if names:
                    deny(need_msg(conf, names, 'このコマンド（ファイルを書き換える可能性があります）'))
            sys.exit(0)
        sys.exit(0)

    if mode == 'post-edit':
        names = set()
        if tool in ('Edit', 'Write', 'MultiEdit', 'NotebookEdit'):
            names.update(sets_for(rel(ti.get('file_path') or ti.get('notebook_path'), cwd), conf))
        elif tool == 'Bash':
            cmd = ti.get('command', '')
            if WRITE_RE.search(cmd) and not re.search(r'\bgit\s+commit\b', cmd):
                names.update(bash_paths(cmd, cwd, conf))
        text = checklist_for(names, conf)
        if text:
            out({'hookSpecificOutput': {'hookEventName': 'PostToolUse',
                                        'additionalContext': '【見張り役2】いまの変更で次を壊していないか確かめてください。\n' + text}})
        sys.exit(0)

    if mode == 'selfcheck':
        # 決まりのファイルの paths と対応表の paths が一致しているか
        problems = []
        for n, s in conf.items():
            p = ROOT / s['rules']
            if not p.is_file():
                problems.append(f'{s["rules"]} がありません'); continue
            m = re.match(r'---\n(.*?)\n---\n', p.read_text(encoding='utf-8'), re.S)
            fm = re.findall(r'^\s*-\s*"([^"]+)"', m.group(1), re.M) if m else []
            if sorted(fm) != sorted(s['paths']):
                problems.append(f'{s["rules"]} の paths が rulesets.json と一致しません')
            c = ROOT / s.get('checklist', '')
            if not c.is_file():
                problems.append(f'{s.get("checklist")} がありません')
        if problems:
            out({'hookSpecificOutput': {'hookEventName': 'SessionStart',
                                        'additionalContext': '【見張り役の自己点検で問題】\n' + '\n'.join(problems)}})
        sys.exit(0)

    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        log(f'CRASH {type(e).__name__}: {e}')
        # 書き換えの前に壊れたら止める（見張り役自身を直すための書き換えだけは通す）
        if len(sys.argv) > 1 and sys.argv[1] == 'pre' and '.claude/hooks' not in RAW_IN:
            print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse',
                                                     'permissionDecision': 'deny',
                                                     'permissionDecisionReason': f'【見張り役】プログラムがエラーで判定できないため止めました（{e}）。.claude/hooks/guard.py を直すか、タダシさんに報告してください。'}},
                             ensure_ascii=False))
            sys.exit(0)
        print(json.dumps({'systemMessage': f'見張り役(guard.py)でエラー: {e}',
                          'hookSpecificOutput': {'hookEventName': 'PreToolUse' if len(sys.argv) > 1 and sys.argv[1] == 'pre' else 'PostToolUse',
                                                 'additionalContext': f'【注意】見張り役のプログラムがエラーで動いていません（{e}）。決まりの読み込みを自分で確認し、タダシさんに報告すること。'}},
                         ensure_ascii=False))
        sys.exit(0)
