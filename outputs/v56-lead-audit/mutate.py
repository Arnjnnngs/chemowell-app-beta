#!/usr/bin/env python3
"""Mutation-test the Lead Developer's v56 suites: break the thing an assertion claims to pin,
and see whether the assertion notices. An assertion that survives its own mutation is hollow."""
import subprocess, sys, shutil, os

SRC = '/home/claude/chemowell-app-beta/index.html'
MUT = '/tmp/mut/index.html'
ORIG = open(SRC).read()

MUTATIONS = {
 'A-composer-onInput-setState': (
   "onInput: (ev) => { helpBotDraft = ev.target.value; },",
   "onInput: (ev) => { helpBotDraft = ev.target.value; setState({}); },"),
 'B-drop-log-scroll-restore': (
   "if (logScroll > 0) { const freshLog = document.getElementById('helpbot-log'); if (freshLog) freshLog.scrollTop = logScroll; }",
   "/* mutated: scroll restore removed */"),
 'C-drop-transcript-cap': (
   "if (helpBotLog.length > HELPBOT_LOG_MAX) helpBotLog = helpBotLog.slice(-HELPBOT_LOG_MAX);",
   "/* mutated: cap removed */"),
 'D-drop-BUTTON-focus-restore': (
   "prevActive.tagName === 'TEXTAREA' || prevActive.tagName === 'BUTTON')",
   "prevActive.tagName === 'TEXTAREA')"),
 'E-drop-navigateTo-close': (
   "confirmDeleteMed: null, helpBotOpen: false };",
   "confirmDeleteMed: null };"),
 'F-drop-new-guard-patterns': (
   "/\\bis\\s+.{0,24}\\b(safe|ok|okay|dangerous|harmful|toxic)\\b/,",
   "/\\bZZZNEVERMATCHZZZ\\b/,"),
 'G-drop-syncviewport-width-branch': (
   "if (window.innerWidth >= HELPBOT_WIDE_MIN) {",
   "if (false) {"),
 'H-helpbotsyncviewport-calls-setState': (
   "  const vv = window.visualViewport;",
   "  setState({});\n  const vv = window.visualViewport;"),
}

def run(suite):
    r = subprocess.run(['env','-u','HTTPS_PROXY','-u','https_proxy','-u','HTTP_PROXY','-u','http_proxy',
                        'node', 'test/' + suite], cwd='/tmp/mut', capture_output=True, text=True,
                        env={**os.environ, 'PLAYWRIGHT_BROWSERS_PATH':'/opt/pw-browsers'})
    fails = [l for l in r.stdout.splitlines() if l.startswith('FAIL')]
    return fails

SUITES = {'A':['v56-helpbot.mjs'],'B':['v56-helpbot.mjs'],'C':['v56-helpbot.mjs'],
          'D':['v56-helpbot.mjs'],'E':['v56-helpbot.mjs'],
          'F':['v56-matcher.mjs','v56-helpbot.mjs'],'G':['v56-helpbot.mjs'],'H':['v56-helpbot.mjs']}
which = sys.argv[1] if len(sys.argv) > 1 else None
for name, (old, new) in MUTATIONS.items():
    if which and which not in name: continue
    assert ORIG.count(old) >= 1, 'anchor not found: ' + name
    open(MUT, 'w').write(ORIG.replace(old, new, 1))
    print('\n=== MUTATION ' + name + '  (' + str(ORIG.count(old)) + ' anchor sites) ===', flush=True)
    for suite in SUITES[name[0]]:
        fails = run(suite)
        print('  ' + suite + ': ' + (str(len(fails)) + ' FAIL' if fails else 'STILL ALL GREEN  <-- assertion did not notice'))
        for f in fails[:8]:
            print('     ' + f[:150])
open(MUT, 'w').write(ORIG)
print('\nrestored', flush=True)
