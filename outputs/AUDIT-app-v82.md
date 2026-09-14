AUDITED-COMMIT: d766095
VERDICT: BLOCK

# Zero Day Audit — ChemoWell app-v82 (Home timeline + vitals strip)

Repo `chemowell-app-beta`, branch `claude/caretracker-team-review-i83ik2`.
Originally briefed against `7c53799`; **re-targeted to `d766095`** after the builder identified
that `7c53799` had captured a live falsification mutant (the weight Log button wired to
`onClick: () => {}`). I verified the correction rather than accepting it: `d766095:index.html`
has all three buttons wired — `'temp'` → `logTemp` (5956), `'weight'` → `logWeight` (5960),
`'bp'` → `logBloodPressure` (5966) — and its `index.html` is byte-identical (md5 `7c121936…`) to
the working tree every probe below was run against. `test/v82-vitals-strip.mjs` is **41/41 against
the committed `d766095` tree**, not merely against uncommitted bytes.

Everything below was reproduced in Chromium (Playwright) over a real HTTP server. No finding here
rests on a source grep.

---

## HEADLINE

**A new number on the first screen of a medication app counts missed doses as "logged" — I
reproduced "2 logged" on a Home screen showing one temperature and one MISSED dose — and the
release's new 41-check suite stays fully green with the entire timeline gutted, because nothing in
`test/` looks at the timeline at all.** Two BLOCKs: one false caregiver-facing string, one gate
that cannot fail on half of what shipped. The vitals strip itself is sound; the timeline is the
untested half, and that is exactly where the defect is.

---

## BLOCK 1 — The new timeline counter calls missed doses "logged"

**What is wrong.** `index.html:6395-6396` adds a new caregiver-facing number to the Today header:

    journalGroups.reduce((n, g) => n + g.items.length, 0) + ' logged'

`journalGroups` is built at line 6382 from `[...todayEntries, ...missedTodayForJournal]` — it
**includes missed-dose rows**. A missed dose is by definition one that was *not* logged. The count
is false, and false in the reassuring direction.

**Reproduction (browser, against `d766095`).** Seed one medication with an alerting window that
has closed and no dose against it, plus one temperature reading:

    med:     { version:99, meds:[{ id:'m1', name:'Testmed', type:'win', alerts:true,
               createdAt: todayStart-30d, windows:[{start:1,end:2,name:'Overnight'}],
               doses:[{label:'1 tablet',mg:0}] }], archivedMeds:{} }
    entries: [{ id:'e1', medId:'temp', temp:99.1, ts: todayStart + 13h }]
    prefs:   { patientName:'T', onboarded:true, installedAt: todayStart-60d }

Rendered `[data-home="timeline"]`:

    TODAY
    2 logged
    OVERNIGHT   1:00 AM   Testmed   MISSED   Overnight window closed   Took later Skipped Clear
    AFTERNOON   1:00 PM   Temperature   Remove

**One thing was logged. The screen says 2.** The row directly underneath the number says MISSED.

**The Voice's first question — is it true? — is no.** This is the same class as the v65/v66 copy
failures already written into the process docs: a short, clear, plainly-worded string that the app
itself contradicts two lines lower. At 2am a caregiver scanning Home for reassurance reads a number
saying more was done than was done. It is also a number nobody asked for, added in passing, and
undocumented — the README row for app-v82 describes the timeline at length and never mentions it.

**Fix.** Count only entries: `todayEntries.length + ' logged'` is correct and shorter. If the
missed count is wanted it is a separate, differently-toned figure — never folded into "logged".

---

## BLOCK 2 — The new suite cannot fail on half of what this release shipped

app-v82 shipped **two** changes. `test/v82-vitals-strip.mjs` tests **one**. No file in `test/`
references `data-home="timeline"` (`grep -rl` → none).

**Falsification, run as instructed, against a clean `git archive d766095`.** Two mutants:

1. Deleted the timeline dot entirely — the single visual element the redesign is named for:

       - h('span', { 'aria-hidden': 'true', style: { ... borderRadius: '50%', background: '#E46F3C' ... } }),

2. Introduced the h() null-attribute trap on the new timeline section — the exact defect class
   this project has been bitten by, and which the suite has a dedicated check for:

       h('section', { 'data-home': 'timeline', 'data-mutant': journalGroups.length ? null : 'x' },

**Result: `41 checks: 41 passed, 0 failed`.** Both mutants confirmed live in the page:

    timeline section attrs: [ 'data-home="timeline"', 'data-mutant="null"' ]
    dots on the rail: 0

The suite is green on a build with **no dots on the timeline** and **a literal `null` string
attribute on the new section**. Suite §6's null-attribute check is scoped to
`[data-home="vitals"]`, so it is structurally incapable of seeing the other half of the release.
A check that cannot fail is worse than no check — this project shipped a literal `|| true` once.

This is the direct cause of BLOCK 1: nothing looks at the timeline, so a false number on the first
screen passed every gate.

**Fix.** A `test/v82-timeline.mjs` asserting, in a browser: the counter against the number of
non-missed rows; a marker per rendered event *including* missed rows; every Remove control still
present; bucket order; an empty day; and a null-attribute sweep scoped to the whole Home screen
rather than one section. Falsify each.

---

## BLOCK 3 (PROCESS) — A deliberate falsification mutant reached a release commit, and no gate saw it

The builder raised this and it deserves to be a finding in its own right. `7c53799` — a commit
whose own message says the Log-button mutant was created and caught — **captured that mutant in
`index.html`**. The suite catches it instantly (39/41 against `7c53799`), the README row for
app-v82 asserts "41 checks … all four caught", and the release chain still let it through. It was
found by a git hook complaining about uncommitted changes, which is luck, not a gate.

**The root cause is named precisely: every green suite run in this release was run against the
working tree, and the working tree is not what ships.** A mutant is applied to disk, the check goes
red, the mutant is reverted on disk — and if the revert is missed, the *next* green run is green
because the tester reverted it in the file they are serving, not because the artifact is clean.
Nothing in `release_check.sh` compares the served bytes to the committed bytes.

**Fix, and it is mechanical rather than a promise, which is this project's own standard.** Make the
final gate run against `git archive HEAD` extracted to a temporary directory, not against the
working tree, and have `release_check.sh` refuse on a dirty `index.html`. That single change makes
this class of failure impossible instead of unlikely. I ran the suite both ways for this audit;
the two-minute cost is the whole fix.

---

## FINDINGS — real, not blocking on their own

**F1. The README row for app-v82 makes two false claims.**
- *"The rows themselves are byte-for-byte what they were"* — they are not. The time cell was
  wrapped in a new flex container, a dot span was added, and `minWidth` went from `66px` to `58px`
  (`harness-v82-redesign-timeline.py`, anchor `OLD3`). "Byte-for-byte" is the kind of claim that
  stops the next reviewer from looking.
- *"a dot per event"* — missed-dose rows go through `missedRow()`, which was **not** touched, so
  they get **no dot**. Confirmed in the browser: the MISSED row renders with no marker on the rail.
  The rail's visual grammar omits precisely the events that matter most.

**F2. `ageOf` labels a future-stamped reading "just now".** `Math.max(0, ...)` clamps a negative
age to zero, so a temperature stamped five hours ahead renders `TEMP | 101.4°F | just now`. This is
reachable: `confirmTimeAndLog` permits a future timestamp behind one extra confirmation
(`m.futureOk`). `yesterday` and `3d ago` are both correct — only the future side is wrong.

**F3. The vitals panel is not a Back layer.** `BACK_LAYERS` has 23 entries; `vitalOpen` is not one
(`window.__backTest.keys()` → false). With a panel open on Home, `handleBackPress()` returns
`null`, the panel stays open, and the phone's Back leaves the app. The precedent sits in the same
registry: `chemoCalOpen`, an inline expand-in-place on this same Home screen, *is* a layer.
app-v81 built the registry one commit earlier; app-v82 added a 24th expandable thing without
registering it. This is the Rule 5.5 gap — the release was reviewed as a still frame.

**F4. A half-typed vital survives the panel closing, invisibly, still armed.** Open the Temp tile,
type `104.9`, wait through the 1-second tick (value survives — correct), tap the tile to close.
The strip then reads `TEMP | — | none yet` — the screen says nothing is pending. Reopen and
`104.9` is still there, one tap from the confirm sheet with a *now* timestamp. Before app-v82 that
half-typed number was permanently visible on Home; it is now hidden. The confirm sheet still shows
the value before anything is written, which is why this is a finding and not a block — but hiding
pending input is the wrong direction for a number that means "call the care team".

**F5. Gendered pronoun in the shipped file.** `index.html:5902`, in the new vitals-strip comment:
*"so what she opens the app to see is which dose is due."* Also in both v82 harness files. It is a
comment, not a user-facing string, so `test/v75-no-other-patient.mjs` correctly passes 27/27 — but
this is exactly the drift Rule 0 exists to stop, in the product repo, in code written this release.
Use they/them.

---

## WHAT I TRIED TO BREAK AND COULD NOT

All verified against `d766095` (byte-identical to the tree probed):

- **A — no record lost, doubled, or misstamped. The claimed write model holds.**
  `logTemp`/`logWeight`/`logBloodPressure` are called with the same arguments from the same state
  fields; temperature and weight still route through the confirm-the-time sheet; BP still writes
  directly. One tap of Log writes exactly one entry (1 → 2) carrying the number typed.
  `tempInput`/`weightInput` are cleared inside `confirmTimeAndLog`,
  `bpSysInput`/`bpDiaInput` inside `logBloodPressure`. Typed values survive the 1-second tick
  re-render (verified intact after 1.4s), so nothing is held only in the DOM.
- **B — the timeline drops nothing.** Missed-dose rows and their three controls (Took later /
  Skipped / Clear), Remove controls, bucket grouping and bucket order all render. An empty day
  shows the sentence, not an empty rail. (The counter over those rows is BLOCK 1; the rows
  themselves are intact.)
- **C — no stale or cross-profile reading.** Storage is per-profile
  (`chemowell-app-p-<id>-*`); the strip reads `state.entries` for the active profile only.
  Yesterday and multi-day ages are correct. Future-stamped readings: F2.
- **D — every Settings combination is honoured**, including all three off (no strip drawn) and
  **Blood Pressure alone**, which under app-v81 rendered a blank space. That fix is real and I
  confirmed it independently.
- **E — the h() null-attribute trap.** Zero literal `"null"`/`"undefined"` attributes across the
  strip *and* the timeline in the shipped markup. The code is clean; the *check* for it is not
  (BLOCK 2).
- **F — no temporal dead zone.** The strip runs inside `renderToday()`, not at module init;
  `dayStart`/`simNow` are hoisted function declarations; `lastTemp`/`tempColor`/`dispTemp` were
  already in scope at this point before the change. No page errors in any scenario tested.
- **G — layout and finger-moving cases.** No horizontal scroll at 320px or 390px with the timeline
  and a three-tile strip present. Every tile ≥ 44px, every input at the 16px iOS floor. The panel
  is inline rather than an overlay, so there is no scroll-lock obligation — that exemption is
  stated here deliberately rather than skipped silently. The Back case is F3.
- **Product neutrality.** `test/v75-no-other-patient.mjs` 27/27. No patient name, no care-plan
  dose/ceiling/schedule, no new behaviour keyed to a medication id in the diff. Comment pronoun: F5.
- **iPhone rendering is exempt** — this sandbox has Chromium only and cannot reproduce it.

---

## WHAT MUST HAPPEN BEFORE THIS SHIPS

1. Fix the "N logged" counter so it counts what was logged (BLOCK 1).
2. Add timeline coverage and widen the null-attribute sweep past `[data-home="vitals"]`;
   falsify both (BLOCK 2).
3. Run the final gate against `git archive HEAD`, not the working tree, and make
   `release_check.sh` refuse on a dirty `index.html` (BLOCK 3).
4. Correct the README's "byte-for-byte" and "a dot per event" claims, or give missed rows a dot (F1).
5. F2–F5 at the builder's discretion. F3 (Back) is the one I would not defer: the registry it
   belongs in was built one commit ago and completing it later is harder than completing it now.
