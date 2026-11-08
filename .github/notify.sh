#!/bin/sh
# お知らせを1通だけ送る（2026-11-08タダシさん指示）。3つの自動処理（データ・環境リスト・ロケット団）が共通で使う
#   使い方: sh .github/notify.sh <種類> <元のmd> [<元のmd> ...]   （GH_TOKEN と OWNER が要る）
# しくみ: 要約（.github/notify.py）を、開いたままの1つのお知らせ「📢 GOナビのお知らせ」にコメントとして足す。
#   旧方式は「新しいお知らせを立てる＋前のお知らせに『閉じます』とコメント」で、1回の更新でメールが2通届いていた。
#   コメント1つ＝メール1通。お知らせは閉じない（閉じる操作も通知になるため）
set -e
TITLE="📢 GOナビのお知らせ"
python3 .github/notify.py "$@"
if [ -f notify_body.md ]; then
  printf '\n@%s\n' "$OWNER" >> notify_body.md
  N=$(gh issue list --state open --limit 100 --json number,title \
        | jq -r --arg t "$TITLE" '[.[] | select(.title == $t)] | sort_by(.number) | .[0].number // empty')
  if [ -n "$N" ]; then
    gh issue comment "$N" --body-file notify_body.md
  else
    gh issue create --title "$TITLE" --body-file notify_body.md
  fi
  rm -f notify_body.md
fi
# 「前回の中身」の控えを保存する（毎回同じ節を送らないため）
git add .github/notify_state.json
if ! git diff --cached --quiet; then
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git commit -m "chore: お知らせの控えを更新"
  git pull --rebase
  git push
fi
