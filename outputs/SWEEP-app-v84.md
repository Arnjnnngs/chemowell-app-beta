# Falsification sweep — app-v84, at commit 714602b, 2026-09-15

ONE RUN, ONE COMMIT. This file exists because `README.md` carried the figure
"nineteen mutants swept, nineteen caught, none survived" and no single run had ever
produced it — it was two slices at two different commits, with no output recorded
anywhere in the repo. The Scribe refused the release on exactly that (B2).

Command:  ./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh
Commit:   714602b69619935ed660f97cf2c5e9c0b9562757
Duration: 17:27 to 18:19 UTC, run alone (no browser suite beside it)

WHAT THIS RUN COVERS, AND WHAT MOVED AFTERWARDS. The sweep judged `714602b`. `index.html` has
changed since, so this artifact does not automatically speak for HEAD and should not be read as
though it does:

  * `4b54901` — the one-character snapshot prefix (`'chemowell-app'` → `'chemowell-app-'`), which is
    the only CODE change to `index.html` after this run. The independent audit re-applied all 19
    anchors at that commit (19/19 apply, 0 stale, 0 no-ops) and re-ran the three mutants that touch
    the changed lines — 17, 18 and 19 — getting baseline 96/96 and each mutant 94/96:
    *"3 caught, 0 survived, 0 could not be measured, 0 anchor(s) stale"*. The result survives.
  * Everything after that is comments and records, which no mutant and no check reads.

A sweep artifact that does not say which later commits it covers invites the reader to assume it
covers all of them — the same assumption that produced the figure this file exists to replace.

Mutant 8 is scored CAUGHT-but-ABORTED: two correct reds, then the suite aborted before
printing a summary. That is the outcome the four-way scoring exists for, and it labelled
itself correctly rather than being counted as a clean catch on the strength of nothing.

```
=== BASELINE (no mutant) -- every check must be green before any of them mean anything
96 checks: 96 passed, 0 failed

=== MUTANT 1: render()'s focus restore is no longer marked -- the renderer re-schedules the v28 nudge
  FAIL  and it STAYS there -- nothing drags the page back to the field  |  scrollY 1543 -> 1
  FAIL  so the save button is still on screen where the swipe left it  |  top=2197 of 844px viewport
96 checks: 94 passed, 2 failed

=== MUTANT 2: the v28 nudge no longer checks whether the person scrolled since focus landed
  FAIL  and it STAYS there -- nothing drags the page back to the field  |  scrollY 1412 -> 1
  FAIL  so the save button is still on screen where the swipe left it  |  top=2197 of 844px viewport
  FAIL  and it STAYS where the finger left it -- the touchmove half of the guard is doing the work  |  scrollY 1279 -> 502
96 checks: 93 passed, 3 failed

=== MUTANT 3: the v28 nudge is deleted outright -- the feature the guard is supposed to preserve
  FAIL  and focusing it WITHOUT a swipe brings it into view -- v28 is not deleted by the guard  |  scrollY 0 -> 0, field top 870 -> 870 in 844px
96 checks: 95 passed, 1 failed

=== MUTANT 4: preventScroll is dropped from render()'s focus restore
  FAIL  the swipe moved the page away from the field  |  1px
  FAIL  so the save button is still on screen where the swipe left it  |  top=2197 of 844px viewport
96 checks: 94 passed, 2 failed

=== MUTANT 5: anyOverlayOpen() stops ignoring pointer-transparent layers -- the first-run guide freezes the page
  FAIL  and the page is NOT frozen by it  |  fixed
  FAIL  and the page still scrolls while the guide is up  |  0px
  FAIL  and the page is not frozen with the editor open under the guide  |  fixed
  FAIL  and it scrolls, which is what a thousand-pixel-tall form needs  |  0px
  FAIL  the button the guide names comes ON SCREEN when the page is scrolled as a finger would  |  top=2198 of 844px viewport
  FAIL  and it can actually be TAPPED  |  CLICK TIMED OUT: a new user cannot add their first medication
  FAIL  and the guide advances once the medication is saved  |  GUIDE · 4 OF 10 | Fill out the form, then tap Add medication at the bottom. | Skip this st
96 checks: 89 passed, 7 failed

=== MUTANT 6: the scroll lock is never released -- the page stays frozen after the notice closes
  FAIL  and the page is released once the notice closes  |  fixed
  FAIL  and the page is NOT locked around it  |  fixed
  FAIL  and it still scrolls  |  0px
  FAIL  and the page is NOT frozen by it  |  fixed
  FAIL  and the page still scrolls while the guide is up  |  0px
  FAIL  and the page is not frozen with the editor open under the guide  |  fixed
  FAIL  and it scrolls, which is what a thousand-pixel-tall form needs  |  0px
  FAIL  the button the guide names comes ON SCREEN when the page is scrolled as a finger would  |  top=2198 of 844px viewport
  FAIL  and it can actually be TAPPED  |  CLICK TIMED OUT: a new user cannot add their first medication
  FAIL  and the guide advances once the medication is saved  |  GUIDE · 4 OF 10 | Fill out the form, then tap Add medication at the bottom. | Skip this st
  FAIL  the form is taller than the screen, so scrolling away is possible at all  |  844px of page in a 844px viewport
  FAIL  the swipe moved the page away from the field  |  0px
  FAIL  so the save button is still on screen where the swipe left it  |  top=2198 of 844px viewport
  FAIL  and focusing it WITHOUT a swipe brings it into view -- v28 is not deleted by the guard  |  scrollY 0 -> 0, field top 870 -> 870 in 844px
  FAIL  the form is taller than the screen, so a swipe has somewhere to go  |  844px in a 844px viewport
  FAIL  the finger moved the page away from the field  |  0px
96 checks: 80 passed, 16 failed

=== MUTANT 7: the scroll lock never engages -- the page scrolls behind the update notice
  FAIL  the page does not scroll behind the notice  |  600px
96 checks: 95 passed, 1 failed

=== MUTANT 8: 'Got it' does not stamp the version -- the update notice comes back every open
  FAIL  nothing pops up on a first-ever run  |  1
  FAIL  and the version is recorded silently, so it is asked once not forever  |  null
  ℹ️  CAUGHT, but the suite ABORTED after its first red -- the counts above are partial.

=== MUTANT 9: the gesture guard stops listening for touchmove -- the yank returns on every phone
  FAIL  and it STAYS where the finger left it -- the touchmove half of the guard is doing the work  |  scrollY 1317 -> 507
96 checks: 95 passed, 1 failed

=== MUTANT 10: the button goes back to 'See all updates' -- the claim four review rounds removed
  FAIL  and the notice claims nothing about being complete  |  See all updates
96 checks: 95 passed, 1 failed

=== MUTANT 11: a completeness claim planted in an aria-label -- nothing visible changes
  FAIL  and the notice claims nothing about being complete  |  Every update ChemoWell has ever
96 checks: 95 passed, 1 failed

=== MUTANT 12: the notice stops saying how many earlier updates this phone never saw
  FAIL  and the number is the count it has NOT been shown -- computed here, not read off the hook  |  null expected 2
  FAIL  and the SENTENCE carries that same number -- the attribute is not what anybody reads  |  null
  FAIL  and it is plural, and names the control it points at  |  null
  FAIL  a phone with exactly one unseen earlier update says so  |  null expected 1
  FAIL  and says it in the singular -- "One earlier update ... is"  |  null
  FAIL  a marker the changelog does not carry counts every entry but the one on screen  |  null of 5 entries
96 checks: 90 passed, 6 failed

=== MUTANT 13: the sentence prints one more than the count -- the data attribute stays right
  FAIL  and the SENTENCE carries that same number -- the attribute is not what anybody reads  |  "3 earlier updates you have not seen are under “See recent updates”."
96 checks: 95 passed, 1 failed

=== MUTANT 14: a marker the changelog does not carry counts nothing instead of everything
  FAIL  a marker the changelog does not carry counts every entry but the one on screen  |  null of 5 entries
96 checks: 95 passed, 1 failed

=== MUTANT 15: the singular branch never fires -- '1 earlier updates ... are'
  FAIL  and says it in the singular -- "One earlier update ... is"  |  "1 earlier updates you have not seen are under “See recent updates”."
96 checks: 95 passed, 1 failed

=== MUTANT 16: the first-ever line is gone -- every phone in this rollout is told nothing again
  FAIL  so it says the true thing instead, and invents no number  |  null
  FAIL  and it names the control it points at  |  null
96 checks: 94 passed, 2 failed

=== MUTANT 17: the app is its own prior data again -- a brand-new phone is greeted with 'here is what changed'
  FAIL  a phone that started over is NOT greeted with "here is what changed"  |  1
  FAIL  and is not told ChemoWell has never shown them one of these before -- it just did  |  1
96 checks: 94 passed, 2 failed

=== MUTANT 18: the snapshot counts the licence key, so a device that bought Plus looks like an upgrade forever
  FAIL  a phone that started over is NOT greeted with "here is what changed"  |  1
  FAIL  and is not told ChemoWell has never shown them one of these before -- it just did  |  1
96 checks: 94 passed, 2 failed

=== MUTANT 19: a key is added to what survives a factory reset, and the snapshot no longer agrees
  FAIL  a phone that started over is NOT greeted with "here is what changed"  |  1
  FAIL  and is not told ChemoWell has never shown them one of these before -- it just did  |  1
96 checks: 94 passed, 2 failed

=== 19 mutant(s) caught, 0 survived, 0 could not be measured
```
