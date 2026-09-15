#!/usr/bin/env python3
"""THE PATCH SCRIPT'S PAYLOAD MUST STILL BE THE APP'S OWN TEXT.

`harness-v84-whatsnew.py` writes app-v84 by inserting text into app-v83's `index.html`. Every piece
of that text is a second copy of something that lives in the app, and a second copy drifts: the
hand-retyped version drifted FIVE times in one release, and after it was replaced with blocks lifted
verbatim it drifted again TWENTY MINUTES later, when the prefix fix moved one character in the app.

A boot check cannot see that. A stale-but-valid payload boots perfectly well, so `verify-rebuild.sh`
stayed green through it. Only a comparison catches it, and this is the comparison.

WHY THIS IS PYTHON AND NOT THE .mjs IT REPLACES. The first version matched `NAME = r\"\"\"...\"\"\"`
with a regex and checked FOUR payloads. An independent audit found it covered four of TWELVE
insertion sites: eight `cut()` calls carry their replacement text as inline literals, and it moved
three of them in the app while the check stayed green at 4/4. It also found that a payload written
`\"\"\"` instead of `r\"\"\"` was invisible to the regex -- and that form is already in the file. Both
gaps are the same shape: a check that can only see the spelling it was written against. Reading the
script's AST sees every string it actually writes, however it is spelled.

WHAT IT DOES NOT CLAIM. It does NOT require base + patch to equal HEAD. Fourteen commits of audit
fixes have no patch scripts, which README.md records. It requires only that what the script claims
to COPY is still a copy.
"""
import ast, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
app = (ROOT / 'index.html').read_text()
script_path = ROOT / 'harness-v84-whatsnew.py'
tree = ast.parse(script_path.read_text())

# EXCLUDED BY DECISION, NOT BY ACCIDENT OF SPELLING -- which is exactly what the audit caught.
# BASE_HOOKS was invisible to the old regex because it is written `\"\"\"` rather than `r\"\"\"`, and
# excluding it happened to be right for a reason nobody had written down. It is the text as it
# exists in the BASE commit, which the script REMOVES; it is not meant to be in HEAD, and finding it
# there would mean the hook block never moved.
EXCLUDED = {
    'BASE_HOOKS': 'base-commit text that the script DELETES; it must NOT appear in HEAD',
}

def value_of(node, env):
    """Evaluate a string expression made of literals, names we know, and `+`."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name) and node.id in env:
        return env[node.id]
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, right = value_of(node.left, env), value_of(node.right, env)
        if left is None or right is None:
            return None
        return left + right
    return None

env, payloads = {}, []
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        v = value_of(node.value, env)
        if v is not None:
            name = node.targets[0].id
            env[name] = v
            if '\n' in v.strip():                      # a block, not a path or a flag
                payloads.append((name, v))

# Every cut(src, old, new, what) writes `new` INTO the app. That half is not self-checking the way
# the anchor is -- a stale `old` makes cut() die loudly, a stale `new` ships a file the app is not.
inserts = []
for node in ast.walk(tree):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'cut' and len(node.args) >= 3:
        v = value_of(node.args[2], env)
        what = value_of(node.args[3], env) if len(node.args) >= 4 else '?'
        if v is not None and v.strip():
            inserts.append((what or '?', v))

ok = bad = 0
def check(label, text, expect_absent=False, reason=''):
    global ok, bad
    n = app.count(text)
    want = (n == 0) if expect_absent else (n == 1)
    if want:
        ok += 1
        print('  ok    %-58s %s' % (label, ('absent as intended' if expect_absent else '%d line(s), once' % len(text.split('\n')))))
    else:
        bad += 1
        print('  FAIL  %-58s appears %d time(s) in index.html' % (label, n))
        if reason:
            print('        %s' % reason)
        print('        re-extract it from index.html; do not hand-edit it back into agreement.')
        for line in text.split('\n'):
            if line.strip() and line not in app:
                print('        first line not in the app: %s' % line.strip()[:100])
                break

print('payload constants')
for name, text in payloads:
    if name in EXCLUDED:
        check('%s (excluded)' % name, text, expect_absent=True, reason=EXCLUDED[name])
    else:
        check(name, text)

print('\ntext written into the app by cut()')
for what, text in inserts:
    check(what, text)

# A check that finds nothing reports green loudest. Pin what it must have seen.
print('')
if len(payloads) < 4:
    print('  FAIL  only %d payload constant(s) found -- has the script been rewritten?' % len(payloads)); bad += 1
if len(inserts) < 8:
    print('  FAIL  only %d cut() insertion(s) found -- has the script been rewritten?' % len(inserts)); bad += 1
if bad == 0:
    print('  ok    saw %d payload constant(s) and %d cut() insertion(s)' % (len(payloads), len(inserts)))
    ok += 1

print('\n%d checks: %d passed, %d failed' % (ok + bad, ok, bad))
sys.exit(1 if bad else 0)
