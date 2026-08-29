# Zero Day Audit — app-v67 (chemowell-app-beta) and beta-v60 (chemowell-beta)

**Verdict: FAIL. Do not leave these builds alone.** One defect needs a hotfix now, and the repo's
own test runner reports NOT GREEN on a release announced with six hand-picked green suites.

Audited 2026-08-29 against `chemowell-app-beta@283b016` (app-v67, live on `main`),
`chemowell-beta@548f90b` (beta-v60, live on `main`), and `care-tracker@b8fc3bc` (v60, branch
`claude/caretracker-chemowell-updates-k80ydk`, NOT shipped) as the comparison build.

---

## In plain words, for Aaron

**The "Clear" button on the treatment-date card stopped working, and nobody would be able to tell.**
If you clear the treatment date, the card correctly says "No treatment date set" — but underneath,
the app carries on as if the date is still there. Zofran stays locked, with the date on the button
reading **1 January 1970**. Dexamethasone keeps being expected, and keeps generating missed-dose
alerts, on a schedule you deleted. This is new: it was introduced by the very change that was
supposed to fix the treatment-date maths, and it is in **all three** apps, including the
care-tracker build that has not shipped yet. **This warrants a hotfix now, not next release.**

Second: on the phone app only, the hospital-stay fix was left half-finished. Two lines that used to
say "if she's in hospital, behave differently" were missed. The result is a medication that isn't
scheduled today showing a big orange **Log** button during a stay that does nothing when you tap it,
and the "Take all" button still being hidden for the whole stay — even though the help page you
rewrote now promises "nothing is locked". Both of these were done correctly in the two web apps and
only missed here.

The good news is real and worth saying: the beta really cannot touch the patient's live data (I
proved that by running it, then broke it on purpose and watched the check go red), the beta is
byte-for-byte reproducible from care-tracker v60, and the new in-patient test suite is a genuine
gate — I broke the code two different ways and it failed both times.

---

## BLOCKER-1 — "Clear treatment date" no longer clears the treatment logic

**Present in all three builds: app-v67, beta-v60, and care-tracker v60.** Regression introduced by
fix #3 of this release.

* `chemowell-app-beta/index.html:1455-1477` — `chemoDayList()` / `chemoOffsetFor()`
* `chemowell-beta/index.html:1237-1263`, `care-tracker/index.html:1237-1263` — identical
* Clear-date writer: `chemowell-app-beta/index.html:4688`, `chemowell-beta/index.html:3235`
  — `addEntryDB({ medId: 'chemo_date', ts: 0, loggedAt: Date.now() })`

### Mechanism
Clearing a treatment date is append-only: it writes a `chemo_date` entry with `ts: 0`.
`nextChemoTs()` honours that (`return latest.ts > 0 ? latest.ts : null`). The **new**
`chemoDayList()` does `.filter(e => e && e.ts > 0)` — which throws away the *clear marker* and keeps
the *cleared date*. So `chemoOffsetFor()`, which used to route through `nextChemoTs()` and therefore
honoured a clear, now never does.

The app ends up holding two contradictory beliefs at once: `hasTreatmentDate()` is `false` while
`chemoOffsetFor()` returns a live offset.

### Reproduction (measured, all three files)
Set a treatment date of 24 Aug 2026, then Treatment schedule → **Clear** → **Confirm clear**.
Ask about 25 Aug:

```
nextChemoTs()                    => null
hasTreatmentDate()               => false
chemoOffsetFor(Aug 25)  [null]   => 1        <-- wrong
dexActiveOn(Aug 25)     [false]  => true     <-- wrong
zofranBlockedOn(Aug 25) [false]  => true     <-- wrong
zofran card "Opens" label        => Sun Jan 04 1970 08:00:00
```

The 1970 comes from `status()` computing `dayStart(nextChemoTs()) + 3 days + 8h` with
`nextChemoTs()` null — `chemowell-app-beta/index.html:1734`, `chemowell-beta/index.html:1413`.
The Home chemo-plan banner has the same shape at `chemowell-app-beta/index.html:4389` /
`chemowell-beta/index.html:2904`: its *condition* is the new nearest-date offset, its *printed date*
is `nextChemoTs()`, so on a cleared date it renders a banner captioned 1 January 1970.

### The second half of the same root cause
A cleared date is never removed from `chemoDayList()`, so it keeps distorting "nearest" **forever**,
even after a correct date is entered:

```
chemoDates = [Aug 3 (later CLEARED), Aug 24 (current)]
chemoOffsetFor(Aug 5)   => 2      measured from the date the user deleted
zofranBlockedOn(Aug 5)  => true
```

A treatment date typed in by mistake and immediately cleared permanently re-interprets the history
around it. That is precisely the "silently re-interprets past data" risk flagged in the brief, and
it is real.

### What a fix has to do
`chemoDayList()` must respect clear markers — a `ts: 0` record has to *retire* every date entered
before it, not just be skipped. And every `dayStart(nextChemoTs())` display site needs a null guard.
**Do not fix this by reverting `chemoOffsetFor()`** — the nearest-date change is correct and fixes a
real reported defect; the clear semantics are what was never carried across.

---

## MAJOR-2 — Zofran's chemo-day block silently disappears when two treatment dates are 3 days apart

**All three builds.** `zofranBlockedOn()` blocks offsets 0..+2 ("chemo day plus the 2 days after",
per Aaron's confirmed spec). With "nearest date in either direction", a nearer *later* treatment
pulls a day's offset negative and unblocks it. Measured, treatments 24 Aug and 27 Aug:

```
Aug 24  offset= 0  blocked=true
Aug 25  offset= 1  blocked=true
Aug 26  offset=-1  blocked=FALSE   <-- 2 days after the Aug 24 treatment; spec says blocked
Aug 27  offset= 0  blocked=true
```

`chemowell-app-beta/index.html:1538`, `chemowell-beta/index.html:1265`. The same shape applies to
`dexActiveOn()` and `dexWindowsForOffset()`.

Direction of harm: the app **stops showing a care-team instruction** ("Care team said no Zofran on
chemo days"). It is an overridable soft block, not a hard safety interlock, and it needs two
treatment dates within 3 days of each other — but that is a normal thing to have on record (a
rescheduled date entered alongside the original, or a split regimen). Nothing in any suite pins it.

A single "nearest date" is the wrong model here: offsets measured *forward* from the previous
treatment and *backward* from the next one are different questions and should be asked separately.

---

## MAJOR-3 — app-v67 only: the grouped meds card still special-cases in-patient in two places

The `In-Patient (Restricted)` tile was deleted, but two `inpatientNow` conditions around it were
left behind. **Both were removed correctly in the two web builds** — this is a divergence, not a
shared design decision.

### 3a. `chemowell-app-beta/index.html:3388`
```js
const offDay = !inpatientNow && !medScheduledOn(med, now);
```
The `!inpatientNow &&` is stale. During a stay `offDay` is forced `false`, so `locked` at line 3390
is false, and a medication **not scheduled today** renders the full orange **Log** button as if it
were due. Tapping it does nothing visible: `logMed()` re-derives `offDay` correctly at
`index.html:1845` and diverts to the override row. The override prompt then names the **wrong
reason** — `overrideExplain` (line 3405-3412) falls through to *"Closed — opens later. Log it early
anyway?"* with a *"Log early"* button, instead of *"Not scheduled today (…). Log it anyway?"* /
*"Log anyway"*. The logged entry itself is still tagged `offDay` correctly, so no data is corrupted;
what is wrong is a dead-looking tap and a prompt that lies about why.

Compare `chemowell-beta/index.html:2246` and `care-tracker/index.html:2249`: no such residue.

### 3b. `chemowell-app-beta/index.html:3349`
```js
(dueMeds.length >= 2 && !inpatientNow) ? h('button', ... 'Take all (' + dueMeds.length + ')') : null
```
"Take all" is still hidden for the entire stay. Both web builds explicitly restored it, with a
comment saying why: *"'Take all' was hidden during a stay for the same reason the cards were
replaced, and it is restored for the same reason they were: a caregiver home for the evening on a
half-day stay needs it most, not least"* (`chemowell-beta/index.html:2233`,
`care-tracker/index.html:2175`).

The rewritten Help topic `ip-meds-restricted` now tells the user *"Log doses exactly as you normally
would — nothing is locked."* On this build that is not true.

### Falsification
Applying the fix to either line and re-running all three v67 suites leaves them **green**
(10/10, 9/9, 4/4). Nothing in the release tests the render path at all — every gate here is a pure
data-layer gate. That is the coverage gap that let both lines through.

---

## MAJOR-4 — a stay left open suppresses every missed-dose alert forever, and v67 removed the thing that made an open stay impossible to ignore

`inpatientCoversMoment()` returns true for any moment after `start` when `p.end === null`. Measured:
an open stay started 20 Aug **2026** suppresses every dose window on 24 Aug **2027** — zero misses
reported, indefinitely.

That behaviour predates v67 (`isInpatientDay()` did the same). What changed is the **forcing
function**: until v67, an unended stay turned every medication card into a loud, unmissable
"In-Patient (Restricted)" tile. Now the only signal is a single banner on Home, and everything else
behaves normally — so an unended stay is far easier to leave running, and while it runs the app is
silently not tracking adherence at all. The app's own Help has a topic for exactly this ("I forgot
to end a hospital stay and it still says Active").

Recommendation: cap suppression from an open-ended stay at the current day, or surface a warning
once a stay passes some length. This is the "suppressed miss" direction the brief called dangerous,
and it is now easier to enter and harder to notice.

`chemowell-app-beta/index.html:2912`, `chemowell-beta/index.html:1938`.

---

## MINOR-5 — a stay entirely inside a dose window does not suppress that window

Admitted 09:00, discharged 10:00, window 08:00–12:00 → Morning is still flagged missed. Consistent
with the stated rule (the window belongs to the hospital only if she was admitted when it *opened*),
cry-wolf direction so not dangerous, but undocumented and untested. Worth one line in the Help topic.

## MINOR-6 — a second Start while one is open silently discards the earlier admission, and v67 made that visible as false misses

`inpatientPeriods()` (`chemowell-app-beta/index.html:2870-2885`) folds a second `inpatient_start`
into the open period by moving its `start` forward. Measured: starts 08:00 + 15:00 with end 16:00
collapse to `[15:00, 16:00]`, and all three windows are now flagged missed. Pre-v67 the whole day
was suppressed by `isInpatientDay()` (`p.start < d1`), so this cost nothing. `inpatientPeriods()` is
unchanged by this release; its **consequence** changed.

## MINOR-7 — an End timestamped before its Start becomes a permanent open-ended stay

Sorted chronologically the End arrives with no open period and is silently dropped; the Start then
opens a never-ending stay, suppressing everything from that moment on. Not reachable through the UI
— `chemowell-app-beta/index.html:2032` validates `End must be after Start`, and the "still ongoing"
path is guarded at 2019-2023. Noted as defence-in-depth for any path that writes entries directly.

## MINOR-8 — the nearest-date tie-break is unspecified and untested

Strict `<` keeps the **earlier** date on an exact tie (Aug 15 between Aug 10 and Aug 20 → offset
`+5`). Mutating `<` to `<=` leaves all three v67 suites green. Deterministic and defensible, but
pick it deliberately and pin it.

## MINOR-9 — `nextChemoTs()` and `chemoOffsetFor()` now disagree at two display sites

`chemowell-app-beta/index.html:1734` (Zofran `availableAt`) and `:4389` (chemo plan banner label)
still use "most recently entered" while the condition around them uses "nearest". Before this
release they agreed by construction. The banner can therefore appear because of one treatment date
and print a different one. Same lines in `chemowell-beta` at `:1413` and `:2904`.

---

## MAJOR-10 — the repo's own runner says NOT GREEN, and the release reported six hand-picked suites instead

`./run-all-tests.sh` in `chemowell-app-beta` ends:

```
PASS 15   FAIL 7   COULD-NOT-START 1
  failing:      audit-v55 pm-v55 pm-v55b v52-fixes v55-fixes-shots v55-help v57-browser-notice
  cannot start: audit-v55b
NOT GREEN - do not report this work as done.
```

The app-v67 commit message lists six suites, all green, and the brief handed to me disclosed **two**
of these eight (`v57-browser-notice`, `audit-v55b`). A reader of either would conclude the build was
green. It is not, on the repo's own runner, added one commit earlier (`8ebbcd0`) precisely so that
"a gate nobody runs" could not happen again.

**None of it is caused by app-v67.** `HELP_TOPICS` holds 119 entries before and after the release,
and four of the reds are already logged: `BACKLOG.md:46` records `audit-v55`, `pm-v55` and `pm-v55b`
pinning a stale topic count (133 vs an actual 135), and `BACKLOG.md:119` records `v55-help`'s
unfalsifiable `careLead`/`medical` check. `BACKLOG.md:48` explicitly leaves open that `audit-v55`'s
`A6` ("0 chips followed") and `B8` are *not* count pins and one of them may be a real regression —
still unresolved.

`v52-fixes` and `v55-fixes-shots` are logged nowhere, and both **passed** when I re-ran them alone
against the same `index.html` on a clean server. Their reds under the runner are therefore
environment-dependent, and I could not get one uncontaminated full pass inside my time cap (my own
browser work shared port 8899 with the runner's server for part of the first pass). **One clean
`./run-all-tests.sh` on an idle machine is needed before anyone trusts these numbers in either
direction.**

### MINOR-11 — the runner's COULD-NOT-START classifier only catches missing modules

`run-all-tests.sh:74` decides "could not start" by grepping for
`MODULE_NOT_FOUND|Cannot find module|ENOENT: no such file|ERR_MODULE_NOT_FOUND`. Any other crash
before the first assertion is counted as an ordinary FAIL. Demonstrated: invoking `test/pm-v55b.mjs`
with an argument shape it does not accept makes it die at line 41 with
`browser.newContext: viewport.width: expected integer, got float NaN` — zero assertions run, and the
runner would file that under `failing:`, not `cannot start:`. Separating those two classes is the
stated reason this script exists; the separation currently only works for one crash cause.


---

## What I verified and found sound

* **`backfillDefaultMedFlags()` is genuinely inert here** — `DEFAULT_MEDS = [];` confirmed at source
  in `chemowell-app-beta/index.html`, not taken on trust. `test/v67-medflag-backfill.mjs` pins it and
  goes red the day a default is added, as claimed.
* **Firestore isolation, verified at RUNTIME.** `harness/beta-isolation-test.mjs` 9/9 — it stubs the
  Firebase SDK and records actual collection paths, not source strings. Falsified: flipping
  `TEST_MODE` to `false` gives 3/9 with *"A WRITE REACHED LIVE DATA: [WRITE:caretracker_prefs]"*. The
  only live-collection strings in `chemowell-beta/index.html` are the two `TEST_MODE ? … : …`
  ternaries at lines 58 and 144; every other occurrence is a comment.
* **beta-v60 is exactly the mechanical derivation it claims to be.** Running
  `harness/betaify-patch.py --file` on care-tracker v60's `index.html` produces md5
  `4fe5a3d2665a5d3441d953eb76727f86` — byte-identical to the shipped `chemowell-beta/index.html`.
  Nine anchors matched once each, all safety post-conditions passed.
* **`test/v67-inpatient-window.mjs` is a real gate.** Falsified twice: flipping the admission
  boundary `p.start <= ts` → `<` gives 6/10; deleting the suppression call entirely gives 4/10.
* **No `h()` null-attribute regressions in this release.** The trap is live — `h()` ends in a bare
  `el.setAttribute(k, v)` (`chemowell-app-beta/index.html:~1050`), so `disabled: false` would still
  render `disabled="false"` — but the v67 diff introduces no boolean-attribute props at all.
* **No pinned version literals** in any `test/*.mjs`.
* **Version pairing correct.** `APP_VERSION = 'app-v67'` ↔ `sw.js CACHE = 'chemowell-app-v67-1'`;
  `beta-v60` ↔ `chemowell-beta-v60`.
* **Composed 1s tick guard intact in both files** — `chemowell-app-beta/index.html:9549` (14 terms
  plus `isEditing` plus the `view !== 'help'` term), `chemowell-beta/index.html:7124`.
* **Performance of the new per-window check is fine.** The old whole-day early return meant one
  `inpatientPeriods()` call per day; it is now one per dose window, and each call re-filters and
  re-sorts every entry. Measured worst case — 90 days x 6 alerting meds x 3 windows over 4,000
  entries — **141 ms**. Not a problem at realistic sizes.
* **Both known issues are characterised honestly.** `test/audit-v55b.mjs` dies with
  `Cannot find module '/tmp/topics.js'`; `test/v57-browser-notice.mjs` reports exactly
  `17 FAILURES`.

---

## Scope: what I did NOT reach

* **One clean, uncontaminated `./run-all-tests.sh` pass in `chemowell-app-beta`** — see MAJOR-10.
  I got a full pass, but my own browser work shared its server port for part of it, so two of the
  seven reds are unattributed. All five `chemowell-beta` harness suites ran clean and isolated
  (9/9, 9/9, 11/11, 10/10, 9/9).
* Journal, History, CSV/PDF export and the dose-progress ring were reviewed by reading only, not
  exercised in a browser. `doseProgressToday()` (`chemowell-app-beta/index.html:~1635`) never
  consulted in-patient state before or after this release, so it is unaffected — but I did not
  render it.
* care-tracker v60's render layer beyond the two lines compared against app-v67.
* No live-device or live-site check of either deployed build.

## Recommended order

1. **Hotfix BLOCKER-1 in all three repos** — including the unshipped care-tracker branch, before it
   ships. Add a suite case with a `ts: 0` clear marker; the current `v67-chemo-offset.mjs` fixture
   has none.
2. **Fix MAJOR-3a and 3b in `chemowell-app-beta`** — two one-line deletions bringing it back in line
   with its twins. Add at least one render-level gate; every existing v67 gate is data-layer only.
3. **Decide MAJOR-2 deliberately** — separate "days since the last treatment" from "days until the
   next" rather than collapsing both into one nearest-date distance.
4. **MAJOR-4** — bound suppression from an open-ended stay, or warn on a long-running one.
5. **Get one clean `./run-all-tests.sh` pass** (MAJOR-10) and widen the COULD-NOT-START classifier
   (MINOR-11). Until then nobody knows whether `audit-v55`'s `A6`/`B8` are stale pins or a real
   Help-centre regression, which `BACKLOG.md:48` has left open since app-v66.
6. MINOR-5 through MINOR-9 to `BACKLOG.md`.

*Auditor pass, 2026-08-29. Findings above are reproduced from measured runs, not from reading alone;
the probe scripts are throwaway and are not committed.*
