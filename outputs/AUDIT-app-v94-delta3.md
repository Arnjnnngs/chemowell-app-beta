AUDITED-COMMIT: abbb4b906f83166aa5c9f19fa60e68fe0d65ca38
VERDICT: SHIP

# Zero Day Auditor — ChemoWell app-v94, DELTA 3

**SHIP.** The one production-code change in the diff since the delta-2 SHIP is a fail-safe in a
branch I measured to be unreachable, it fails in the only safe direction for a reminder, and no
downstream surface degrades if it ever becomes reachable. The corpus repair is real: mutant 8
applies again and kills six checks, and mutant 14's hole declaration is honest rather than
convenient — I proved the branch dead by instrumentation, not by reading the claim. The two new
badge checks are load-bearing and cannot be satisfied by accident.

**Two non-blocking findings, both the same class this release has already produced three of: a
number in a comment that nobody read.** One of them is in the production comment this very diff
added, and the other is in the comment F5 was raised to correct. Neither changes behaviour, so
neither blocks — but they should go in with the next touch, and they are below with exact lines.

**This is a narrow pass.** Everything `AUDIT-app-v94.md` and `AUDIT-app-v94-delta2.md` verified
stays verified and I did not re-measure it. `PM-app-v94.md`'s refusal is mechanical and its remedy
is exactly this pass; this report names `abbb4b9`, which is strictly after `0c74ea3`, so the
supersession rule is satisfied.

## The tree as I measured it

| | measured | expected | |
|---|---|---|---|
| `git rev-parse HEAD` | `abbb4b906f83166aa5c9f19fa60e68fe0d65ca38` | `abbb4b90…` | matches |
| branch | `claude/caretracker-team-review-i83ik2` | same | matches |
| `index.html` md5 | `9dbb11ebb200ee5a7181942847feb25e` | same | matches |
| `sw.js` md5 | `8efcc1e7e7c55a22902057b722b5a58b` | same | matches |
| `git status --porcelain` | empty before and after every run | clean | clean |
| `index.html` after the sweep (`md5sum -c`) | `index.html: OK` | restored | byte-identical |

`HEAD` is one commit later than the commit the PM examined (`0c74ea3` → `abbb4b9`, *"The PM's two
cosmetic leftovers"*), and that commit touches `release_check.sh` and `outputs/DESIGN-app-v94.md`
only — `index.html` is byte-identical to the file the PM measured, which is why the md5s match.
I ran no `git checkout`, edited no application file, suite or corpus, and every mutation of my own
went to a copy under my scratchpad on its own port. The only file I wrote in the repository is this
report.

**`care-tracker` was not touched.** I did not modify a file in it, run anything against it, open
its live site, touch Firestore, or port anything to or from it. I read only the notice that loads
automatically into every session, which is what that notice permits. The directory's own mtime is
still 3 November.

---

## Item 1 — `if (wi < 0) return true;` — **CLEARED**, and this is where I spent the pass

`index.html:13661`. The diff is 14 lines, one of them code.

### Is `wi < 0` genuinely unreachable? Yes, and I grepped rather than counted.

`grep -n "medWindowDueAt(" index.html` returns the definition plus **four** call sites. Not five.
I read all four:

| line | caller | how it reaches the window | identity |
|---|---|---|---|
| 1064 | `profileDueCount` — app-icon badge, drawer dot | `med.windows.forEach(w => …)` | same array |
| 13404 | `dueRemindersAt` — reactive web notification | `med.windows.forEach(w => …)` | same array |
| 13694 | `buildReminderPlan` — OS alarm | `(med.windows \|\| []).forEach(w => …)` | same array |
| 14338 | `__v86Test.medWindowDue` | `((med.windows) \|\| [])[wi]` | same array |

Every one reads `med.windows` off the same `med` object it then passes, in the same synchronous
expression, so the second read inside `medWindowDueAt` returns the identical array reference and
`indexOf` resolves. `cancelReminderForEntry` (14073) is **not** a call site — it goes to
`windowClaims` directly — which is where the "five" in the comment came from.

**I did not stop at reading it.** I instrumented a byte copy outside the repo to **throw** on that
branch and ran the suite against it: **35/35 green, 0 failed**, including the suite's own
"no console errors or warnings" check, which a thrown error would have taken down.

**And I falsified the probe**, because a probe that cannot fire proves nothing. A second copy with
the condition inverted (`if (wi >= 0) throw`) crashes the suite immediately with
`PROBE_WI_NEG`/`PROBE_CONTROL_REACHED` propagating out of `notif()` at line 266. So the
instrumentation point executes on every fixture, and the green run is evidence, not silence.

### Is `true` the right direction? Yes — and I verified the reasoning rather than taking it.

I read `windowClaims` (2585-2619) instead of trusting delta-2's argument. For a **single**-window
list, `bounds[0].hi` falls through to `nextDay(d0)`, so pass 2 claims any dose from
`start − 2h` to midnight. The deleted fallback asked exactly that question, so it was *more*
permissive than the indexed path, where `hi` is the next window's start. The deleted fallback could
therefore mark an unknown window **covered** by a dose ten hours later and hide a dose still owed.
`return true` cannot. On a medication tracker that is the whole difference: nagging is annoying,
hiding is the bug that was reported.

It also makes the most likely future mistake safe. A sixth call site written against
`medWindowsFor(med, d0)` — which returns freshly built objects when `chemoRelativeWindows` is set —
would miss `indexOf` and, under the old fallback, silently suppress a dose. Under this one it nags.

### Does `true` ever mean "suppress"? No. I checked the polarity at every site.

This is the question that would turn the fail-safe into a hazard, and it holds: 1064 `if (!due)
return;` then `count++` → true = show a number; 13404 `if (due) due.push(...)` → true = notify;
13694 `if (!due) return;` then `out.push(...)` → true = arm the alarm. Three shipping sites, and in
all three `true` = ask. There is no path where `true` hides something.

### Does anything break if a window reads due forever? No, and it is bounded at each surface.

* **Badge** (1064): guarded by `if (nowTs < ws || nowTs >= we) return;`, so only windows open *right
  now* count. The number is bounded by the window count and clears when the window closes. No
  badge that never clears, no render loop — `profileDueCount` is a pure read called from render.
* **Reactive notification** (13404): guarded by `notifSentToday[key]`, set *before* the predicate is
  asked, so it fires once per window per day. It cannot re-arm on every sync.
* **OS alarm** (13694): one entry per window per day, inside `[earliest, horizonEnd]`. `out` is
  **sorted by `at` before** `out.length = NOTIF_MAX_PENDING` (13747-13748), so truncation keeps the
  earliest. The worst case is the plan a day with nothing logged already produces, so `NOTIF_MAX_PENDING`
  starvation of appointment alarms is not newly reachable.

### Could `true` be returned for a window that IS in the list?

Only if `indexOf` failed on an array member. It cannot across a synchronous same-object read, and
nothing here freezes, proxies or defines `windows` as a getter (`grep` for `get windows`,
`defineProperty`, `Object.freeze`, `structuredClone` returns nothing relevant). The two places that
clone windows — `deepCopyMeds` (1457) and `normalizeMedication` (1810) — build a **new `med`** as
well, so a cloned window is never paired with an original `med`. A malformed non-array `windows`
throws at the call sites' own `.forEach` before reaching this function; pre-existing, unchanged.

**One honest limit:** no real device, no APK. Every notification measurement here goes through the
shipped functions with a stubbed Capacitor bridge.

## Item 2 — the corpus repair — **CLEARED**

`FALSIFY_PORT=9733 ./falsify.sh test/v94-window-coverage.mjs falsify/mutants-v94-coverage.sh`,
7m30s, 14 mutants + baseline. **Baseline 35/35.** Final line, verbatim:

```
=== 11 mutant(s) caught, 0 survived unexpectedly, 0 could not be measured, 0 anchor(s) stale
=== 1 over-block control(s) correctly stayed green, 0 over-block(s) fired, 2 known open hole(s)
known open holes still open: mutant(s) 12 14
```

Exactly the expected result. **Mutant 8 applies and kills six checks** — including
*"so the armed plan is not identical to a day with nothing logged"*, the discriminator the first
pass blocked on. Its anchor is now `if (wi < 0) return true;`, which is current. The mutant for the
defect this release exists to fix runs again.

**Mutant 14's hole is honest.** Its declaration rests on `wi < 0` being unreachable, which is the
claim I measured independently above with a throwing probe and a falsified control. Reversing a
branch nothing reaches cannot make a check go red, so `MUTANT_EXPECT_14="hole"` is the correct
label and not a convenient one. Keeping it is right for the reason its comment gives: the day it
starts dying is the day the branch became reachable.

## Item 3 — the two new badge checks — **CLEARED, and they cannot pass by accident**

`test/v94-window-coverage.mjs:339-347`, read at the 17:03 clock, fixture `win(EVENING)` =
one 17:00–21:00 window (line 76), dose at `H(16,45)`.

* Nothing logged → `totalDueCount() === 1`.
* Dose at 16:45 → `totalDueCount() === 0`.

**The dose is logged OUTSIDE its window**, which is precisely where the naive predicate and the
correct walk diverge — unlike the profile suite's fixture, which logs inside the window and is why
delta-2 found it green with the old bug planted. A naive copy answers `1` here and the check fails.

Measured, not argued: **mutant 13** (the fourth naive copy planted in `profileDueCount`) kills
**exactly one** check, *"a dose logged 15 minutes early takes it off the app icon"*. Mutants 4 and 8
kill it too. The 17:03 clock is load-bearing: at 16:50 the window is not open, the count is zero
either way, and a planted copy would pass unnoticed — the suite's own comment says so.

## Item 4 — documentation — **CLEARED except two numbers**

Verified true of the shipping file:

| Claim | Where | Measured |
|---|---|---|
| suite is 35 checks | README row, `REQUESTS.md`, `release_check.sh:941` (33 → 35) | **35/35**, 28s |
| corpus is 14 mutants | README row, `REQUESTS.md` ("7 to 14") | 14 `mutant_N` functions |
| 11 caught · 0 unexpected survivors · 0 stale anchors · 1 control green · 2 holes (12, 14) | README row | printed line for line |
| six coverage definitions, every site named | `index.html:2534-2560` | six named |
| changelog: 3 bullets, ~60 words, title 5 words | `index.html:9865` | 3 bullets, 60 words — inside Rule 0.9 |
| changelog bullet 3 true on both halves | reminder + app-icon | reactive, plan and badge all measured off; falsifiable under mutants 4, 8, 9, 13 |
| `DESIGN-app-v94.md` quote matches the shipped bullet | `outputs/DESIGN-app-v94.md:26` | character-for-character match with the shipped string |
| M45/M46 extended, M47/M48/M49 logged | `BACKLOG.md:1309-1400` | all five present and substantive; M46 names both D2 sites with lines; `index.html:1062` confirmed |
| pronoun ratchet untouched | `test/v75-no-other-patient.mjs` | **29/29**, 32 found / 32 allowed, debt ceilings 0/0/0 |

### NEW FINDING N1 — "all **five** call sites" is four, in three places (cosmetic, non-blocking)

* `index.html:13648` — *"All five call sites iterate `med.windows`…"*, **added by this diff**
* `falsify/mutants-v94-coverage.sh:196` — mutant 14's hole declaration, same sentence
* `README.md:14` — *"`wi < 0` is unreachable at all five call sites"*

`medWindowDueAt` has **four** callers; so does `coveredWindowFlags`. Nothing is five. The count came
from delta-2's table, which listed `cancelReminderForEntry` as a fifth row — it iterates
`med.windows` but calls `windowClaims`, never `medWindowDueAt`. **The conclusion is unaffected and I
verified it independently**: all four do pass a member of the live array, so the branch is dead and
mutant 14's declaration stands. Only the number is wrong.

### NEW FINDING N2 — "There were SIX, and **three** of them were wrong" — five were (cosmetic, non-blocking)

`index.html:2534`. Of the six definitions the comment then names, one (`missedDosesFor`) was
correct and **five** were wrong: `status()`, `doseProgressToday`, `medWindowDueAt`, `dueRemindersAt`
and `cancelReminderForEntry`. The first-build framing was "three answers, two wrong"; F5 corrected
`THREE` → `SIX` in the count of definitions and left "three of them were wrong" behind, so the
sentence now matches neither framing. **This is the comment F5 exists to have corrected**, and its
own next paragraph argues that a comment asserting the job is finished is how the rest got missed.

### The fix, measured

Two words, in comments, no assertion depends on either. Applied to a byte copy outside the repo:

```
index.html:2534   - // There were SIX, and three of them were wrong.
                  + // There were SIX, and five of them were wrong.
index.html:13648  - // All five call sites iterate `med.windows` and pass the object they got from that array, so the
                  + // All four call sites iterate `med.windows` and pass the object they got from that array, so the
```

Suite against the corrected copy: **35 checks, 35 passed, 0 failed.** The same two corrections
belong in `falsify/mutants-v94-coverage.sh:196` and the `README.md` app-v94 row. **I did not edit
`index.html`**; these are for the next touch, and they do not justify another gate cycle on their
own.

### Not a finding, but worth reading: M48 is a real limit on what this corpus proves

I walked the contiguous geometry M48 describes, because it bears on whether the owner's bug is
fixed on realistic data. Windows 08–17 and 17–24, dose at 16:50: pass 1 gives it to window 0
(`lo` 06:00, `we` 17:00) and window 1 stays due. That is a defensible answer — one dose given, one
of two still owed — not a wrong one, and the reported fixture is a **single** window, where
`lo` = 15:00 and the 16:45 dose is claimed correctly. So the fix does reach the reported case. M48's
point is about test coverage, it is logged honestly, and I agree with its size.

## What I re-ran, with timings

| What | Result | Time |
|---|---|---|
| Tree verification — sha, two md5s, clean tree | all match | — |
| `test/v94-window-coverage.mjs` on an **instrumented** copy that throws on `wi < 0` | **35/35** — branch never reached | 28s |
| The same probe inverted (`wi >= 0` throws) — the falsification | crashes immediately, as it must | ~30s |
| Full sweep, 14 mutants + baseline | **11 caught, 0 unexpected survivors, 0 could not be measured, 0 stale anchors, 1 control green, 2 holes (12, 14)** | 7m30s |
| `test/v75-no-other-patient.mjs` | **29/29**, ratchet 32/32 | 0.15s |
| `test/v94-window-coverage.mjs` on the corrected-comment copy | **35/35** | ~30s |
| Call-site audit — grep plus a read of all four, plus polarity at each | `wi < 0` unreachable, `true` never means suppress | — |
| `md5sum -c` on `index.html` after the sweep | `OK` | — |

**Taken on trust, as the brief directs**, all reported green by the builder on this `index.html`,
which the diff since their run did not touch: `overflow-scan` 171, `contrast-scan` 327,
`v84-whatsnew` 100, `v90-chart-axes` 162, `v89-everything-free` 75, `v92-pill-clearance`,
`v92-text-collisions`, both `v76-*`, `v85-profile-reminders` 43, `v93-profile-notifications` 27.
I attempted `v93-profile-notifications` with `--file` against both an instrumented and a clean copy
and both timed out on a click under concurrent load, identically — an artefact of my own setup, not
a signal about the file, and it is on the trust list anyway. I did not re-run `release_check.sh`;
that is the PM's stage.

## Verdict

**SHIP at `abbb4b906f83166aa5c9f19fa60e68fe0d65ca38`.** The fail-safe is inert today, measured
inert rather than read inert, safe in the one direction that matters if it ever stops being inert,
and harmless at every surface downstream. The corpus repair restored the mutant that guards this
release's own defect. The badge claim finally has a check that can fail. N1 and N2 are two words in
two comments and do not gate a medication-tracking fix the owner has been waiting on since
6 November.
