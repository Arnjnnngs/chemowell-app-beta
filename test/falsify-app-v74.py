#!/usr/bin/env python3
"""Falsify every check app-v74 adds. Rule 5: break the thing, watch the check go RED, restore it.

The ones that matter most are the ones about HONESTY, because they are the only thing standing
between a caregiver and a false citation: a link that says "where this came from" over a sentence
that did not come from there, or a fetched line that reached the screen without passing the guards.
"""
import os, re, subprocess, sys

SP = '/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/mutants-appv74'
os.makedirs(SP, exist_ok=True)
ENV = {k: v for k, v in os.environ.items()
       if k not in ('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy')}
APP = '/home/user/chemowell-app-beta/index.html'
SUITE = '/home/user/chemowell-app-beta/test/v74-med-source.mjs'


def run(app_file):
    out = subprocess.run(['node', SUITE, '--file', app_file], env=ENV,
                         capture_output=True, text=True, timeout=900).stdout
    m = re.search(r'(\d+)/(\d+) checks passed', out)
    reds = [l.strip()[6:].split('  |')[0].strip() for l in out.split('\n') if l.strip().startswith('FAIL')]
    return (m.group(0) if m else 'NO SCORE'), reds


CASES = [
    ('THE HONESTY ONE: the citation is printed over any wording, sourced or not',
     lambda h: h.replace("  const usingSourceText = !!sourced && shown === sourced;",
                         "  const usingSourceText = true;"),
     'THE CITATION STANDS DOWN: this sentence is hers, so the link no longer claims to be its source'),

    ('THE OTHER HONESTY ONE: the citation never appears, even over text that did come from the page',
     lambda h: h.replace("  const usingSourceText = !!sourced && shown === sourced;",
                         "  const usingSourceText = false;"),
     'THE CITATION IS EARNED: the link now says where this came from'),

    ('THE GUARD REMOVED: fetched text reaches the screen unchecked',
     lambda h: h.replace("    const text = purposeTextIsSafe(found.text) ? String(found.text).trim() : '';",
                         "    const text = String(found.text || '').trim();"),
     'text carrying a dose, a schedule, a route AND a fever claim is discarded'),

    ('the guard stops running on the way OUT, so a record from another phone is trusted',
     lambda h: h.replace("  return purposeTextIsSafe(text) ? text : '';",
                         "  return text;"),
     'THE OUT-GUARD HOLDS: the unsafe sentence does not reach the screen'),

    ('the fetched text is no longer cached, so it dies at the first reload',
     lambda h: h.replace("  const meds = state.meds.map(item => item.id === id ? { ...item, purposeSource: found } : item);",
                         "  const meds = state.meds.slice();"),
     'the official text is stored on the medication'),

    ('the cached source is stripped on every load -- the app-v20 trap, on the new field',
     lambda h: h.replace("      medication.purposeSource = {", "      medication.purposeSource = false && {"),
     'the cached description is still there after closing and reopening'),

    ('a non-https URL is trusted again',
     lambda h: h.replace("    const httpOnly = /^https:\\/\\//i.test(srcUrl);", "    const httpOnly = !!srcUrl;"),
     'THE RECORD SURVIVES IT: no javascript: link reaches the screen'),

    ('what she typed stops winning',
     lambda h: h.replace("""  const typed = String(med.purpose || '').trim();
  if (typed) return typed;
  // app-v74: the cached official line sits BETWEEN what she typed and what we wrote. It never
  // overrides her -- that rung was already the top one and stays there.
  const sourced = sourcedPurposeText(med);""",
                         """  const typed = String(med.purpose || '').trim();
  const sourced = sourcedPurposeText(med);"""),
     'her wording is what shows'),

    # The first version of this mutant awaited the lookup where it already sits -- AFTER the persist
    # and the setState -- so it delayed nothing and the check stayed green on a build that was not
    # actually broken. Moving the lookup IN FRONT of the save is the shape that really freezes the
    # editor on a dead network, which is what the check exists to catch.
    ('the save waits on the lookup, so a dead network freezes the editor',
     lambda h: h.replace("""  const meds = editor.sourceId ? state.meds.map(med => med.id === editor.sourceId ? saved : med) : [...state.meds, saved];
  persistMedicationConfig(meds, state.archivedMeds);
  setState({ meds, medEditor: null, confirmDeleteMed: null });""",
                         """  await fetchPurposeSource(saved.name);
  const meds = editor.sourceId ? state.meds.map(med => med.id === editor.sourceId ? saved : med) : [...state.meds, saved];
  persistMedicationConfig(meds, state.archivedMeds);
  setState({ meds, medEditor: null, confirmDeleteMed: null });""").replace(
                         "function saveMedicationEditor() {", "async function saveMedicationEditor() {", 1),
     'the editor closed without waiting on the lookup'),

    ('the lookup runs at RENDER time instead of on save',
     lambda h: h.replace("  refreshPurposeSource(saved.id, saved.name);", ""),
     'the official text is stored on the medication'),

    ('a medication nothing knows about gets an empty description instead of none',
     lambda h: h.replace("          purposeOf(med) ? h('div', { 'data-med-purpose': med.id",
                         "          true ? h('div', { 'data-med-purpose': med.id"),
     'a medication nothing knows about shows no description at all, not an empty one'),

    ('the stale-result guard removed, so a rename is overwritten by an in-flight answer',
     lambda h: h.replace("  if (!current || String(current.name || '').trim() !== String(name || '').trim()) return;",
                         "  if (!current) return;"),
     'the rename survived -- the late answer did not write the old record back'),
]

src = open(APP, encoding='utf-8').read()
base, reds = run(APP)
print('  baseline%s%-22s %s' % (' ' * 58, base, reds or ''))
bad = 1 if reds else 0

for name, mutate, expect in CASES:
    h = mutate(src)
    if h == src:
        print('  %-64s SKIPPED (pattern absent)' % name); bad += 1; continue
    p = os.path.join(SP, re.sub(r'\W+', '-', name)[:50] + '.html')
    open(p, 'w', encoding='utf-8').write(h)
    score, reds = run(p)
    if expect is None:
        # No check covers this one yet; the run is here to prove it is not silently catastrophic.
        print('  %-64s %-22s %s' % (name, score, 'NOT COVERED -- ' + (str(reds)[:90] if reds else 'no check went red')))
        continue
    ok = expect in reds
    print('  %-64s %-22s %s' % (name, score, 'RED as intended' if ok else 'STILL GREEN <-- ' + str(reds)[:120]))
    if not ok:
        bad += 1

print('\n%s' % ('ALL MUTANTS BEHAVED' if bad == 0 else '%d PROBLEM(S)' % bad))
sys.exit(1 if bad else 0)
