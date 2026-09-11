#!/usr/bin/env python3
"""Falsify every check app-v73 adds, across both ChemoWell suites.

A -- the archived-medications suite: reminders off, the archive keeping the whole medication and
still having it after a reload, pause periods coming back, the id tie-break, the exemption.
B and C -- the purpose suite: the entries the table was missing, and combination products answering
for themselves rather than through the generic fallback.
"""
import os, re, subprocess, sys

SP = '/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/mutants-appv73'
os.makedirs(SP, exist_ok=True)
ENV = {k: v for k, v in os.environ.items()
       if k not in ('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy')}
APP = '/home/user/chemowell-app-beta/index.html'
ARCH = '/home/user/chemowell-app-beta/test/v73-archived-meds.mjs'
PURP = '/home/user/chemowell-app-beta/test/v72-med-purpose.mjs'


def run(suite, app_file):
    out = subprocess.run(['node', suite, '--file', app_file], env=ENV,
                         capture_output=True, text=True, timeout=900).stdout
    m = re.search(r'(\d+)/(\d+) checks passed', out)
    reds = [l.strip()[6:].split('  |')[0].strip() for l in out.split('\n') if l.strip().startswith('FAIL')]
    return (m.group(0) if m else 'NO SCORE'), reds


CASES = [
    # A -- the archived-medications suite. These are written against the BOTH-ENDED design: the
    # archive records the day the medication left, restore builds a {start, end} span from it, and
    # the missed-dose walk skips only days INSIDE that span. The first two mutants are the audit's
    # two refusals put back, one on each side of the gap.
    (ARCH, 'THE SAFETY ONE: the away-span guard removed from the missed-dose walk',
     lambda h: h.replace("    if ((med.awayPeriods || []).some(p => p && d0 >= dayStart(p.start) && d0 <= dayStart(p.end))) return;\n", ""),
     'SUPPRESSION HAPPENS: the days it was off the list are not counted as missed'),

    (ARCH, 'THE SECOND REFUSAL, PUT BACK: suppress EVERYTHING before the restore, not just the gap',
     lambda h: h.replace("if ((med.awayPeriods || []).some(p => p && d0 >= dayStart(p.start) && d0 <= dayStart(p.end))) return;",
                         "if ((med.awayPeriods || []).some(p => p && d0 <= dayStart(p.end))) return;"),
     'THE SAFETY CHECK: bringing it back suppresses ONLY the days it was away, and it was away for none'),

    (ARCH, 'THE VALIDATOR REMOVED: a wide span from another device swallows the record',
     lambda h: h.replace("      && span.end <= Date.now());", "      );"),
     'THE RECORD SURVIVES IT: the span is dropped on load, so nothing is suppressed'),

    (ARCH, "THE AUDIT'S SECOND BLOCKER: a normaliser strips awayPeriods on load, so the feature dies at the first reload",
     lambda h: h.replace("function normalizeMedication(raw, index) {\n  const original = raw || {};",
                         "function normalizeMedication(raw, index) {\n  const original = raw || {};\n  delete original.awayPeriods;"),
     'and the span survives closing and reopening the app, which storage cannot prove'),

    (ARCH, 'the restore stops recording the span it was away',
     lambda h: h.replace("  med.awayPeriods = (Array.isArray(med.awayPeriods) ? med.awayPeriods : [])", "  med.awayPeriods = ([])"
                         ).replace("    .filter(p => p && Number(p.start) && Number(p.end))\n    .concat([{ start: awayFrom, end: awayTo }]);", "    .slice();"),
     'the span it was away is recorded with BOTH ends'),

    (ARCH, 'the archive stops recording the day the medication left the list',
     lambda h: h.replace(", removedAt: dayStart(state.now || Date.now()) } };", " } };"),
     'the archive wrote down the day it left, which nothing can recover later'),

    (ARCH, 'the day it left is stripped on every load -- the app-v20 trap, on the new field',
     lambda h: h.replace("    if (Number(value.removedAt)) entry.removedAt = Number(value.removedAt);\n", ""),
     'the span starts on the day it actually left, not on the day it came back'),

    (ARCH, 'restore switches reminders off again, the design the audit refused',
     lambda h: h.replace("  med.id = id;\n", "  med.id = id;\n  med.alerts = false;\n", 1),
     'its reminders came back exactly as they were, rather than being switched off'),

    (ARCH, 'the archive goes back to keeping only the name and pause record',
     lambda h: h.replace("config: JSON.parse(JSON.stringify(med)), removedAt:", "removedAt:"),
     "the caregiver's own version came back"),

    (ARCH, 'the archive is stripped again on every load (the app-v20 trap)',
     lambda h: h.replace("    if (value.config && typeof value.config === 'object') {",
                         "    if (false && value.config && typeof value.config === 'object') {"),
     'after closing and reopening the app, it still knows the settings were kept'),

    (ARCH, 'pause periods are dropped on the way back in, undoing app-v20 from the other end',
     lambda h: h.replace("  med.pausePeriods = normalizePausePeriods(entry.pausePeriods);\n",
                         "  med.pausePeriods = undefined;\n"),
     'the pause record came back as a list rather than being dropped'),

    (ARCH, 'the id-clash guard removed, so restore can duplicate a medication',
     lambda h: h.replace("  if (state.meds.some(item => item.id === id)) {", "  if (false) {"),
     'restore is refused rather than creating a duplicate'),

    (ARCH, 'the Removed-medications section renders even when nothing is removed',
     lambda h: h.replace("    archivedList.length ? h('div', { 'data-archived-meds': 'true'",
                         "    true ? h('div', { 'data-archived-meds': 'true'"),
     'THE EXEMPTION: no "Removed medications" section when nothing is removed'),

    (ARCH, 'restore gives the medication a NEW id, orphaning its dose history',
     lambda h: h.replace("  med.id = id;\n", "  med.id = id + '-2';\n", 1),
     'it is on the active list again'),

    # ---- B ------------------------------------------------------------------------------------
    (PURP, 'B: the three medications the table was missing are removed again',
     lambda h: h.replace("  'metoclopramide': 'Settles nausea and helps the stomach empty.',\n", ""),
     'the table now knows metoclopramide'),

    (PURP, 'B: a brand name is given wording that drifts from its generic',
     lambda h: h.replace("  'zoloft': 'Treats depression, and is also used for anxiety.',",
                         "  'zoloft': 'Treats low mood.',"),
     'every brand name added says exactly what its generic says'),

    # ---- C ------------------------------------------------------------------------------------
    (PURP, 'C: the combination product falls back to its generic ingredient again',
     lambda h: h.replace("  'tylenol pm': 'Eases pain, and also contains an antihistamine that helps with sleep.',\n", ""),
     'and it is NOT the line its generic ingredient alone would give'),
]

src = open(APP, encoding='utf-8').read()
bad = 0
for suite in (ARCH, PURP):
    score, reds = run(suite, APP)
    print('  baseline %-20s %-22s %s' % (os.path.basename(suite), score, reds or ''))
    if reds:
        bad += 1

for suite, name, mutate, expect in CASES:
    h = mutate(src)
    if h == src:
        print('  %-64s SKIPPED (pattern absent)' % name); bad += 1; continue
    p = os.path.join(SP, re.sub(r'\W+', '-', name)[:50] + '.html')
    open(p, 'w', encoding='utf-8').write(h)
    score, reds = run(suite, p)
    ok = expect in reds
    print('  %-64s %-22s %s' % (name, score, 'RED as intended' if ok else 'STILL GREEN <-- ' + str(reds)[:150]))
    if not ok:
        bad += 1

print('\n%s' % ('ALL MUTANTS BEHAVED' if bad == 0 else '%d PROBLEM(S)' % bad))
sys.exit(1 if bad else 0)
