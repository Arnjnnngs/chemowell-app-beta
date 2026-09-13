# ZERO DAY AUDIT — app-v79 ROUND 2 (delta audit of commit f2307fd, tree at dfadfca)

**VERDICT: BLOCK**

## Headline

**All nine findings are genuinely fixed in the code. The new suite written to protect the most
important one cannot see the line that actually does the protecting.**

I deleted the batch token from the one and only production caller — the `ids.forEach(...)` inside
"Take all" — and **`test/v79-warning-priority.mjs` stayed 6/6, and every one of the nine suites
stayed green, 243 checks.** Then I drove the real control in a browser against that same mutant:

```
Home -> Evening meds -> Take all (Tylenol over the 3,000 mg group ceiling, Iron within 2 h of Protonix)
  shipped code : {"tone":"red",  "title":"Tylenol + Tylenol Liquid daily limit exceeded"}   <- correct
  token removed: {"tone":"amber","title":"Iron + Protonix timing"}                          <- app-v78 again
```

That is the exact defect round 1 was blocked for, reachable by a one-token edit that no gate in this
repo can see. The suite builds its own `batch = {}` inside `page.evaluate` and calls
`window.__warnTest.afterLog(entry, batch)` directly, so it tests `afterLog`'s **contract** and never
the **caller that has to honour it**.

This is the same shape as the thing it is fixing, one level up. Round 1's collection logic was
correct and the calling context was wrong; round 2's `afterLog` is correct and the calling context
is untested. The release note says the new suite is "falsified three ways" — it is, and all three
mutants are inside `afterLog`. The line the release actually turns on was never falsified.

**The shipped code is right.** I verified the real "Take all" path end to end, in both list orders,
through the real UI: red in both. This blocks on the check, not the behaviour — which in this repo,
one release after "a commit message was doing a check's job", is the whole point.

---

## Findings

### R2-1 — BLOCKER (HIGH). The first suite ever written for the warning path does not touch the caller the fix lives in.

**Severity: HIGH.** The protected warning is the acetaminophen ceiling, and "Take all" is the
control most likely to cross it. The regression is invisible to every gate.

**Where:** `index.html:2616` (`confirmTimeAndLog`, the `m.type === 'multi'` branch) and
`test/v79-warning-priority.mjs`, the `warnFor()` helper.

**Reproduction, exact:**

1. In `index.html:2616` replace
   `setTimeout(() => { const warnBatch = {}; ids.forEach(mid => afterLog({ medId: mid, ts, id: 'pending' }, warnBatch)); }, 500);`
   with
   `setTimeout(() => { ids.forEach(mid => afterLog({ medId: mid, ts, id: 'pending' })); }, 500);`
2. `node test/v79-warning-priority.mjs` → **6/6 checks passed.** `node test/v79-home-cards-render.mjs`
   → 14/14. All nine suites green.
3. Now drive the app: seed `tylenol` (`ceiling: true`, `ceilingMax: 3000`, `ceilingGroup: 'apap'`,
   `groupedEvening: true`, 2,600 mg already logged today) and `iron`
   (`interactions: [{ withMedId: 'protonix', minGapH: 2, ... }]`, `groupedEvening: true`) with a
   Protonix dose 30 minutes ago. Home → **Evening meds → Take all (2) → Confirm**, wait past the
   500 ms timer, read `window.__warnTest.getWarn()`.
   * shipped: `red / "Tylenol + Tylenol Liquid daily limit exceeded"` in both med orders.
   * mutant: `amber / "Iron + Protonix timing"`.

**Fix:** the suite already does full UI setup — it navigates to Meds and creates a medication
through the real editor. Add one section that finishes the journey: two `groupedEvening` medications,
tap `Take all`, click `Confirm` inside the `[role=dialog]`, `waitForTimeout(1600)`, assert the banner
is red; repeat with the medication array in the opposite order. Falsify it by removing the token at
2616 and watching it go red. (Playwright note: the confirm button is inside the dialog and the page
behind intercepts pointer events — scope the locator to `[role=dialog]` and click the last match.)

---

### R2-2 — MEDIUM (Rule 0, leak shape 3). The new "shaped around the PLACE" guard implements half of its own diagnosis.

The round-2 commit message is right about why the old guard failed: *"a guard shaped around a single
past instance catches that instance and nothing else… The new one is shaped around the PLACE: no
daily maximum of any unit may appear inside LEGACY_MED_RULES at all, because that is where a
stranger's regimen would have to be written to have any effect."*

The diagnosis names the place; the implementation still names five keys
(`ceilingMax|ceilingMg|volumeCeilingMl|rollingCeilingH|gapH`). **Rule 0 shape 3 is "a dose, ceiling
or schedule from one care plan"** — and a schedule walks straight in.

**Reproduction:** add one line to `LEGACY_MED_RULES`:

```js
'warfarin': { interactions: [{ withMedId: 'aspirin', minGapH: 6, title: 'Warfarin + aspirin',
  body: 'Space these six hours apart per the care plan.' }] },
```

`v75-no-other-patient` 22/22, `v77-legacy-migration-equivalence` 36/36, `v78-fence-removed` 20/20.
A whole new care plan, with its own interval and its own caregiver-facing copy, for a drug pair
nobody asked for — every gate green.

Note also that `minGapH: 2` (iron/protonix) and `gapH: 2` at `index.html:1231` are already exactly
this shape; they are accounted-for phase-2/3 debt, and I am not asking for them to move. What I am
asking is that the table stop being open.

**Fix:** pin the table's key set, not its key names. Assert `Object.keys(LEGACY_MED_RULES)` is
exactly the thirteen legacy ids plus `__flags__`, and that no entry carries a numeric literal outside
the set already inventoried. Falsify by adding a fourteenth key. Lower the pinned list when phase 3
deletes entries, the same ratchet discipline section 4 already uses.

---

### R2-3 — MEDIUM. F9's fix is covered by nothing, in the release that was blocked for exactly that.

**Reproduction:** replace both `hcUnitFor(hcMax)` call sites (`index.html:5279` display, `index.html:5282`
`aria-label`) with `hcUnit` — i.e. revert F9 completely and leave F5's two sites alone.
`node test/v79-home-cards-render.mjs` → **14/14 checks passed.**

The fixture's only ceiling is `lozenge`'s `ceilingMax: 2`, so `hcMax` is never 1 and
`' / 1 pills'` is never rendered. The added `antacid` and `lozenge` medications fixed F5's two
branches (I falsified those: reverting all four sites gives `1 doses | 1 doses | 1 lozenges` and two
red checks) and left F9's two branches exactly as unreachable as the string round 1 blocked on. The
test comment says *"Falsified by reverting hcUnitFor at both call sites"* — there are four now, and
the two this release added are the uncovered ones.

**And no suite asserts an `aria-label` anywhere in this file** — `grep -c aria test/v79-home-cards-render.mjs`
is 0 — so the screen-reader half of the fix has never been read by a check.

I confirmed the fix does work at runtime (a medication with `ceilingMax: 1` and one dose logged
renders `1 / 1 pill` and `aria-label="1 of 1 pill used today"`). It is the check that is absent.

**Fix:** add a third fixture medication with `ceiling: true, ceilingMax: 1`, and assert both the
visible `1 / 1 pill` and the `aria-label` string. Falsify by reverting the two `hcUnitFor(hcMax)`
sites.

---

### R2-4 — MEDIUM (VOICE). The grouped label is unbounded, and it prints a placeholder name into a safety warning.

Measured in a browser against a six-member `ceilingGroup`, one member with no `name`:

> **Alpha + Bravo + Charlie Extra Strength Oral Suspension + Delta + Untitled medication + Foxtrot daily limit exceeded**
> Today's Alpha + Bravo + Charlie Extra Strength Oral Suspension + Delta + Untitled medication + Foxtrot total is 3,500 mg, above the 3,000 mg daily limit set for it. Check with the care team before logging more.

A 114-character title, repeated verbatim in the body. **Would a tired non-technical person understand
it at 2am?** No — the number and the instruction are buried behind a list, and the one word that will
catch the eye is "Untitled".

`.filter(Boolean)` cannot help: `normalizeMedication` (`index.html:1295`) writes
`'Untitled medication'` for a missing name, so no member is ever falsy and the placeholder reaches
the banner. The same is true of the Home card label round 1 shipped.

Reachability is limited today — `ceilingGroup` is not settable from the medication editor, so groups
arrive only from a restored or imported legacy config, where two members is the realistic case and
the two-name label is a clear improvement. It is still a warning surface with no upper bound on it.

**Fix:** cap at two names plus `' and ' + (n - 2) + ' more'`, and fall back to `ceilingOwner.name`
if any member's name is the `'Untitled medication'` placeholder. One line each, both surfaces.

---

### R2-5 — LOW/MEDIUM. Two reds in one batch: the second silently replaces the first, three lines under a comment saying it cannot.

Measured, one batch token, `[a1 (group ceiling exceeded), liq (volume cap exceeded)]`:

```
first  -> "Alpha + … daily limit exceeded"
second -> "Liquid volume limit exceeded"      <- the acetaminophen warning is gone
```

`if (warnBatch && warnBatch.red && worst.tone !== 'red') return;` only suppresses a **downgrade**;
a second red falls through to `setState` and overwrites. **This is not a regression** — round 1's
`state.warn` version behaved identically, and there is only one banner slot — but three lines above
it the code still says **"RED BEATS AMBER, AND AN EXISTING RED IS NEVER OVERWRITTEN"**, and the
shipped README row still says *"an existing red is never downgraded"*. Both are false in the one case
that matters most: two reds at once, one of them acetaminophen.

**Fix:** pick one and make it true. Either keep the first red of a batch (`if (warnBatch && warnBatch.red) return;`,
which matches what the comment claims), or leave the behaviour and correct the comment and the
version-history row to say "the last red in a batch wins; a red is never replaced by an amber."

---

### R2-6 — LOW. The claim this release exists to disown is still in the file, and still in the shipped version history.

`index.html:1190`, unchanged by round 2, sitting above the **tylenol-liquid** entry:

```js
  // Was `const imoMax = 4` inline; see the imodium entry for why it is here.
  'tylenol-liquid': { homeCard: { kind: 'ml' } },
```

`const imoMax = 4` does not exist in the parent commit — the round-2 commit proves it at length —
and "the imodium entry" now carries no explanation at all (the explanation moved down to
`lidocaine`). So the file still asserts the false premise, and its cross-reference points at nothing.

`README.md`, the app-v79 row, still reads: *"**Lidocaine's daily card vanished and Imodium's limit
came from `const imoMax = 4` written inline** — one care plan's numbers, now that medication's own
configured ceiling."* Four sentences later the same row explains that this was a Rule 0 violation and
was removed. A reader of the version history is told both.

**Fix:** delete the comment at 1190; correct the README sentence to say the card was restored and the
ceilings deliberately were not.

---

### R2-7 — LOW (VOICE). "set for it", after a compound subject.

> Today's **Tylenol + Tylenol Liquid** total is 3,020 mg, above the 3,000 mg daily limit set for **it**.

True, and it reads as a slip. "set for them", or better "…above the 3,000 mg limit these share."
The rest of the string is good: the number belongs on the screen (a combined acetaminophen total is
precisely what a clinician acts on), the instruction is plain, and it is a large improvement on
round 1.

---

### R2-8 — LOW. `test/v79-warning-priority.mjs` collects page errors and never asserts on them.

`const errors = []; page.on('pageerror', …)` — and nothing reads `errors`. Every other browser suite
here asserts on it. `afterLog` runs inside a `setTimeout`, so a throw there is silent and the dose
still saves; that is the exact hazard `medInteractionsFor`'s comment at 2253 documents. One line.

---

## What I checked and found genuinely fixed

* **F1 — the leftover clobber is gone, and nothing else read it.** `grep -n 'twoH\|declared'` finds
  only prose in the replacement comment. Falsified: reinstating the two lines above
  `const configuredMedication` reproduces the round-1 table exactly —
  `tylenol,iron` → amber, `iron,tylenol` → red — and the suite goes 3/6.
* **F2 — the batch token.** Answering the brief's four questions, all measured:
  * *Is the guard absent for a single log, and is that right?* Yes and yes. A single call has nothing
    to suppress; `worst` already picks red over amber within one entry. The real single-log caller
    (`index.html:2545`) passes no token.
  * *Can a token leak across runs?* No. `const warnBatch = {}` is created inside the per-run
    `setTimeout` closure; there is no module-level token, and `afterLog` is never used as a bare
    `forEach` callback (which would have fed it the index as a second argument).
  * *A batch of one?* `warnBatch.red` starts false, so nothing is suppressed.
  * *If `afterLog` throws mid-batch?* The `forEach` is unguarded and the rest of the batch is lost —
    but that shape predates this release and round 2 adds no new throw: every new expression
    (`ceilingOwner ? … : []`, `state.meds.find(...) || {}`, `(ceilingOwner || {}).name`) is guarded,
    and `if (!warnings.length) return;` keeps `worst` from ever being undefined at `worst.tone`.
  * Falsified: reverting the guard to `state.warn` makes section 2 go red (`after: "red"` — the new
    amber never reaches the screen), reproducing the round-1 finding precisely.
* **F3/F4 — the ceilings are gone, not moved.** `imodium` and `lidocaine` carry `homeCard` only.
  File-wide hunt for the shape (`ceilingMax|ceilingMg|volumeCeilingMl|rollingCeilingH|maxPerDay|dailyMax|minGapH|gapH`
  followed by a number) returns nothing new; `DEFAULT_MEDS` is `[]`; `CONFIG` carries no ceiling.
  The new section-3 check has teeth — putting `ceiling: true, ceilingMax: 4, ceilingUnit: 'pills'`
  back on `imodium` fails it with `ceilingMax: 4`. Its companion "the rule table was actually found
  and scanned" correctly stops it passing against an empty string. See R2-2 for what it still misses.
* **F5 — the "1 doses" check can now fail.** Reverting all four `hcUnitFor` sites gives
  `1 doses | 1 doses | 1 lozenges` and two red checks. The two added reachability checks
  (`No daily limit set`, `1 lozenge left`) confirm the fixture reaches both branches, which is the
  thing round 1's version could not do. (Minor design note: the second reachability check is the same
  assertion as the correctness check, so it cannot distinguish "unreachable" from "broken".)
* **F6 — the grouped label.** Falsified: `limitLabel = (ceilingOwner || {}).name` makes the title
  check go red with `Tylenol daily limit exceeded`. Checked with a one-member group (falls back to the
  owner's name, correct), with a member missing `name` (see R2-4), and against archived members —
  `ceilingGroupMedIds` reads `state.meds`, which excludes archived medications, and `dailyGroupMg`
  reads the same list, so the label and the number agree. Paused members are in both, which is also
  consistent.
* **F7 — `replaceWindows`.** Falsified: removing `if (key === 'replaceWindows') continue;` makes the
  new v77 assertion fail with `["id","type","schemaV","replaceWindows","windows",…]`. The companion
  check that the directive still replaces the stored windows means the assertion cannot pass on a
  migration that simply stopped working.
* **F8 — the `schemaV` stamp.** Falsified: moving it back below `if (!rules) return next;` fails
  `a medication with no legacy rule is stamped too`. `if (next)` is load-bearing, not padding —
  `next` is `med ? {...med} : med`, and the v76 hostile-value section passes `null`/`undefined`
  (22/22 green with the guard, and the guard is what keeps it so). The one-shot property holds across
  a restore: `cwBkApplyTo` writes `version: 1`, the migration re-runs, and each medication's own
  `schemaV >= 2` returns it untouched at the top of `migrateLegacyMedRules` — the v79 suite's
  "an edited value survives a version-1 downgrade" proves it end to end.
* **F9 — the fix itself is correct at runtime.** `ceilingMax: 1` with one dose renders `1 / 1 pill`
  and `aria-label="1 of 1 pill used today"`. Only the check is missing (R2-3).
* **`window.__warnTest` — no new exposure, and correctly ungated.** `__syncTest` (line 733) and
  `__notifTest` (line 10466) are both bare `if (typeof window !== 'undefined')`, so the precedent is
  followed exactly. It exposes strictly less than either: no crypto, no key material, no install id.
  `afterLog` recomputes its warning from `state` and cannot be made to display arbitrary text;
  `clearWarn` can dismiss a banner, which a page script in a single-origin, no-third-party-script
  Capacitor app is not a meaningful threat for. No action recommended.
* **Rule 0 shapes 1, 2 and 4.** Name, pronouns and the 0/0/0 ratchet all clean and not stale.
* **All nine suites green as delivered:** 22 / 96 / 22 / 13 / 36 / 20 / 14 / 6, plus the screenshot
  pass. 243 checks (up from 231).

## Working tree

`index.html` is byte-identical to the pre-audit copy taken before the first mutant
(`diff -q` clean, md5 `7b87716d745fa6de5e98c86b476ea8c6`), `git diff HEAD -- index.html` is empty,
and `git status --short` prints nothing. Every mutant above was applied and reverted individually.
