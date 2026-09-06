#!/usr/bin/env bash
# Stop gate. An agent may not end its turn while its item's acceptance
# criteria fail. Replaces asking "is it done?" and "did you test it?".
#
# No active item -> allow the stop. Interactive sessions are untouched.
# Blocks the same prompt 3 times -> mark the item blocked and let it go, so a
# bad criterion cannot trap an agent forever. There is no built-in loop guard.
set -u
CWD="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$CWD" || exit 0
mkdir -p tmp

# GNU `timeout` is not on macOS. Resolve one, else emulate with a perl alarm so
# a hung check still cannot wedge the gate.
if command -v timeout >/dev/null 2>&1; then
  run_timeout() { timeout "$@"; }
elif command -v gtimeout >/dev/null 2>&1; then
  run_timeout() { gtimeout "$@"; }
else
  run_timeout() {
    secs="$1"; shift
    perl -e '''my $s = shift;
      my $pid = fork();
      die "fork: $!" unless defined $pid;
      if ($pid == 0) { setpgrp(0, 0); exec @ARGV; exit 127; }
      $SIG{ALRM} = sub { kill("TERM", -$pid); sleep 1; kill("KILL", -$pid); exit 124; };
      alarm $s;
      waitpid($pid, 0);
      my $st = $?;
      alarm 0;
      exit($st & 127 ? 128 + ($st & 127) : $st >> 8);''' "$secs" "$@"
  }
fi

INPUT=$(cat)
PROMPT_ID=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try: print(json.load(sys.stdin).get('prompt_id') or 'none')
except Exception: print('none')")

ITEM_ID=$(cat tmp/active-item 2>/dev/null | tr -d '[:space:]')
[ -n "$ITEM_ID" ] || exit 0
ITEM=$(ls .xswarm/backlog/${ITEM_ID}-*.md 2>/dev/null | head -1)
[ -n "$ITEM" ] && [ -f "$ITEM" ] || exit 0

STATE=$(python3 - "$ITEM" <<'PY'
import re,sys
t=open(sys.argv[1]).read()
m=re.search(r"^state:\s*(\S+)",t,re.M)
print(m.group(1) if m else "unknown")
PY
)
[ "$STATE" = "active" ] || exit 0

COUNT_FILE="tmp/stop-blocks-${PROMPT_ID}"
COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)

# --- deterministic criteria -------------------------------------------------
FAILED=""
while IFS=$'\t' read -r text check; do
  [ -n "$check" ] || continue
  if ! run_timeout 900 bash -c "$check" >"tmp/gate-out.$$" 2>&1; then
    FAILED="$text"
    OUT=$(tail -20 "tmp/gate-out.$$")
    rm -f "tmp/gate-out.$$"
    break
  fi
  rm -f "tmp/gate-out.$$"
done < <(python3 - "$ITEM" <<'PY'
import re,sys
t=open(sys.argv[1]).read()
fm=t.split('---')[1] if t.startswith('---') else ''
block=re.search(r"^acceptance:\s*$(.*?)(?=^\S|\Z)",fm,re.M|re.S)
if block:
    def unquote(s):
        s = s.strip()
        # YAML quoting is not stripped by this regex parser; bash would treat
        # a fully quoted check as one command name and report "command not found".
        if len(s) > 1 and s[0] == s[-1] and s[0] in "\"'":
            s = s[1:-1]
        return s
    for m in re.finditer(r"-\s+text:\s*(.+?)\s*$(?:\s*^\s+check:\s*(.+?)\s*$)?",
                         block.group(1), re.M):
        print("%s\t%s" % (m.group(1).strip(), unquote(m.group(2) or "")))
PY
)

if [ -n "$FAILED" ]; then
  COUNT=$((COUNT+1)); echo "$COUNT" > "$COUNT_FILE"
  if [ "$COUNT" -ge 3 ]; then
    python3 - "$ITEM" "$FAILED" <<'PY'
import re,sys
p,why=sys.argv[1],sys.argv[2]
t=open(p).read()
t=re.sub(r"^state:.*$","state: blocked",t,count=1,flags=re.M)
if "blocked_on:" not in t:
    t=re.sub(r"^state: blocked$","state: blocked\nblocked_on: gate failed 3x: "+why,
             t,count=1,flags=re.M)
open(p,"w").write(t)
PY
    rm -f tmp/active-item
    echo "Gate failed 3 times on: $FAILED — item marked blocked for Chad. Stop allowed." >&2
    exit 0
  fi
  cat >&2 <<MSG
Not done. Acceptance criterion still failing:

  $FAILED

Last output:
$OUT

Fix that specifically, then finish. Do not ask for confirmation and do not
stop again until it passes. (block $COUNT of 3)
MSG
  exit 2
fi

# The prose review calls a frontier model and routinely takes 2-3 minutes.
# The hook's own timeout in settings.json MUST exceed this, or Claude Code
# kills the gate mid-review: the item is never closed, no block is recorded,
# and it looks exactly like the gate never ran. That failure is silent.
# --- prose criteria: independent review of the diff -------------------------
PROSE=$(python3 - "$ITEM" <<'PY'
import re,sys
t=open(sys.argv[1]).read()
fm=t.split('---')[1] if t.startswith('---') else ''
block=re.search(r"^acceptance:\s*$(.*?)(?=^\S|\Z)",fm,re.M|re.S)
out=[]
if block:
    for m in re.finditer(r"-\s+text:\s*(.+?)\s*$(?:\s*^\s+check:\s*(.+?)\s*$)?",
                         block.group(1), re.M):
        if not (m.group(2) or "").strip():
            out.append("- "+m.group(1).strip())
print("\n".join(out))
PY
)
if [ -n "$PROSE" ]; then
  DIFF=$(git diff HEAD 2>/dev/null | head -400)
  [ -n "$DIFF" ] || DIFF=$(git show HEAD 2>/dev/null | head -400)
  VERDICT=$(run_timeout 420 claude -p --permission-mode auto "Judge only from the diff. Criteria that must ALL hold:

$PROSE

DIFF:
$DIFF

Reply exactly:
VERDICT: pass | fail
UNMET: <the single criterion that does not hold, or empty>" 2>&1 | tail -6)
  if echo "$VERDICT" | grep -qiE "^VERDICT: *fail"; then
    COUNT=$((COUNT+1)); echo "$COUNT" > "$COUNT_FILE"
    UNMET=$(echo "$VERDICT" | sed -n 's/^UNMET: *//p' | head -1)
    if [ "$COUNT" -ge 3 ]; then
      rm -f tmp/active-item
      echo "Review failed 3 times. Item left for Chad. Stop allowed." >&2
      exit 0
    fi
    echo "Not done. Review says this criterion does not hold: ${UNMET:-see criteria}. Fix it, then finish. (block $COUNT of 3)" >&2
    exit 2
  fi
fi

python3 - "$ITEM" <<'PY'
import re,sys
p=sys.argv[1]; t=open(p).read()
open(p,"w").write(re.sub(r"^state:.*$","state: done",t,count=1,flags=re.M))
PY
rm -f tmp/active-item "$COUNT_FILE"
echo "All acceptance criteria pass. Item marked done." >&2
exit 0
