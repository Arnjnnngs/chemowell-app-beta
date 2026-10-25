AUDITED-COMMIT: 5d54e2e
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v86 (`5d54e2e`, branch `claude/caretracker-team-review-i83ik2`)

**The release gives bowel and appetite a second door and does not teach the first door about it.**
`supersedeStamp()` can now stamp an entry later than `dayStart + 12h`, but the Home Daily check-in
still writes at exactly `dayStart + 12h` — so once the new Reports logger has been used twice on a
day, the caregiver's check-in answer is written, loses the latest-wins comparison, is never shown
anywhere, and the app says **"Check-in saved."** Reproduced end to end through the shipped UI for
both bowel movement and appetite.

Two smaller regressions ride in the same code: a day whose only records are bowel, appetite or a
radiation session now reads **"Nothing logged"** on History while listing those records directly
underneath it; and the superseded original now reaches the doctor-facing CSV and printed report at
the same displayed minute as its replacement, with nothing saying which one is current.

The five changes are otherwise correct and well evidenced. `test/v86-logging-and-labels.mjs` really
is 38/38; the three pre-existing reds really are pre-existing; the Designer's overflow numbers
reproduce. Two of the suite's checks are vacuous in the way the brief predicted — I built the
mutants and they survive at a clean 38/38.

---

## FINDINGS

### F1 — BLOCKER. The Home check-in's answer is silently discarded, with a success toast.

**Severity: HIGH — silent loss of a caregiver's record of the patient's condition. Introduced by this release.**

**Location.** `index.html:3718` `logBowelMovement`, `index.html:3800` `logAppetite`,
`index.html:3623-3624` `confirmCheckinModal`, `index.html:11633` `supersedeStamp`.

`supersedeStamp()` was added as an **optional fourth argument** that only the new logger passes:

```js
async function logBowelMovement(value, dayStartTs, tsOverride) {
  await addEntryDB({ ..., ts: tsOverride || (dayStartTs + 12 * 3600000) });
}
```

`confirmCheckinModal()` calls `logBowelMovement(m.bowel, todayStart)` and
`logAppetite(m.appetite, todayStart, '')` — no override, so always `dayStart + 12h`. Before this
release every writer used that one stamp, ties were broken by array order, and the last write won.
Now the Reports logger can produce `base + 1000`, `base + 2000`… and the check-in can no longer
beat it.

**Reproduction (shipped UI, no test hooks beyond `openReport`).** Fixture: one profile, bowel and
appetite check-ins on, `dailyCheckinTime` 00:00 so the Home card is reachable.

| step | action | entries (`value@ts-base`) | screen |
|---|---|---|---|
| 1 | Reports → Bowel Movement → **Normal** | `normal@0` | currently Normal |
| 2 | same screen → **Loose** (a correction) | `normal@0`, `loose@1000` | currently Loose |
| 3 | Home → Daily check-in → Start → bowel = **Diarrhea** → Save | `normal@0`, **`diarrhea@0`**, `loose@1000` | **currently Loose**, toast *"Check-in saved"* |

The same run with **one** pick at step 1-2 ends correctly ("currently Diarrhea"), which isolates the
cause to the supersede stamp. Appetite behaves identically:

```
two appetite picks:                   ["normal@0","little@1000"]
after check-in answered "No Appetite" ["normal@0","none@0","little@1000"]
appetite screen shows:                Little to none
```

Scripts: `/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/probe3.mjs`
and `/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/probe5.mjs`.

**Why this is not an edge case.** Log at breakfast, correct it at lunch, get asked again at 7pm
because the *other* metric is still unanswered — `checkinDoneForDay()` (`index.html:3579`) only
suppresses the card when **every** opted-in metric has an entry. That is an ordinary day. The
stale value then drives the "Bowel Issue Active" banner (`bowelIssueActive`, `index.html:3721`),
the Reports meta line, the History row and the printed report.

**Every writer that still uses the fixed stamp:**

| line | function | behaviour after a supersede |
|---|---|---|
| 3623 | `confirmCheckinModal` (appetite) | appends at `base`, **never wins** |
| 3624 | `confirmCheckinModal` (bowel) | appends at `base`, **never wins** |
| 3757 | `submitBowelMovement` | deletes the latest, writes at `base` — wins, but **destroys a record** the new model promises to keep (dead code today; see F10) |
| 3775 | `submitBowelBannerUpdate` | same, and it is **live** (the banner's Update button, `index.html:5968`) |
| 3812 | `submitAppetite` | same (dead code today) |

**To fix.** Make the supersede the rule, not an opt-in: compute it inside `logBowelMovement` /
`logAppetite` from `bowelMovementFor(dayStartTs)` / `appetiteFor(dayStartTs)` when no explicit
stamp is given, and drop the remove-then-write in the three `submit*` paths. One change, all five
call sites, and the comment that says *"latest-wins is not left to array order"* becomes true of the
whole app rather than of one screen.

**And a check that would have caught it.** The v86 suite drives the Reports logger and never opens
the check-in modal. A case that logs twice from Reports, saves the check-in with a different answer
and asserts the screen shows the check-in's answer goes red today.

---

### F2 — BLOCKER (same fix window). "Nothing logged" on a day that has records.

**Severity: MEDIUM-HIGH — a false statement on screen, caused by this release, on the feature this release adds.**

**Location.** `index.html:11489` (`nothingElseLogged`) and the counters above it.

`doses` moved from "everything except temp/weight/cycle markers" to `isDoseEntry()`, which excludes
thirteen ids. Three of those — `bowel_movement`, `appetite`, `radiation_session` — were given **no
replacement counter** and are **not in `nothingElseLogged`**. A day holding only those now reads
"Nothing logged" while the expanded day lists them.

```
PROBE A  summary for a bowel+appetite+radiation-only day:  "Nothing logged"
PROBE A  does the day list the entries underneath? true / true / true
```

(`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/probe1.mjs`,
fixture = one bowel + one appetite + one radiation entry, nothing else.)

Under app-v85 that day read "3 doses" — wrong label, but present. "Nothing logged" is worse than a
wrong label: it is the screen asserting an absence that is not true, and it is reachable the first
time somebody uses the new logger on a day with no medication due. The changelog's *"Each is now
counted and named for what it actually is"* is true of BP, symptoms and paracentesis and untrue of
these three.

**To fix.** Either count and name them (`1 bowel`, `1 appetite`, `1 radiation`) or at minimum add
them to `nothingElseLogged` so the sentence is not printed. Counting them is the consistent answer:
every other non-dose type in that list already has a named segment.

---

### F3 — The superseded original reaches the doctor at the same minute as its replacement.

**Severity: MEDIUM — doctor-facing artifact, introduced by this release.**

**Location.** `buildExportRows()` `index.html:10313` (reads `allEntriesRaw()`), consumed by
`downloadEntriesCSV()` `index.html:10603` and the printable report `index.html:10665-10682`.
`fmtTime()` `index.html:2594` renders hour + minute only.

A supersede is 1000 ms, so both rows print the identical `Date, Time, Type` and contradict each
other in `Detail`, with no marker of which is current:

```
History rows after one correction + one check-in:
  "12:00 PM Bowel Movement Normal  Remove"
  "12:00 PM Bowel Movement Diarrhea Remove"
  "12:00 PM Bowel Movement Loose   Remove"
```

Pre-v86 a correction deleted the original, so exactly one row existed per day. The in-app caption
("*The earlier one stays in the record*") tells the caregiver; nothing tells the clinician, and the
report is explicitly for them ("Treatment record — …", "verify against clinical records").

**To fix,** cheapest first: stamp the supersede with a visible gap (e.g. minutes, or the real
`simNow()` clamped into the day) so the rows order visibly; or mark the superseded row in `detail`
(`"Normal (corrected)"`); or filter `bowel_movement`/`appetite` in `buildExportRows` to the day's
winner, the way the Reports screens already do. Any of the three; silence is the one option that
should not ship.

---

### F4 — Re-picking the value already shown appends a duplicate record. Ten taps, ten records.

**Severity: MEDIUM.** `index.html:11645-11660` (`renderDailyValueLogger`'s `onClick`).

`dailyLogBusy` correctly collapses a burst inside one tick, but there is no no-op guard for picking
the value that is already current — and the button renders `aria-pressed="true"`, so tapping it
again is a no-op in the caregiver's mind.

```
A  burst-of-5-in-one-tick -> ["normal@0"]                         <- guard works, one write
B  ten-taps-60ms          -> ["normal@0","diarrhea@1000", ... ,"diarrhea@10000"]   <- ten records
B  duplicate stamps?       false
```

(`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/probe4.mjs`.) Combined
with F3, one impatient day puts ten identical "12:00 PM Bowel Movement Diarrhea" rows in the
clinician's export. `renameActiveProfile` has exactly this guard (`if (me.name === name)`); the
logger needs the same one line.

**On `dailyLogBusy` itself: no defect found.** It is set synchronously before the first `await`,
`addEntryDB` → `notifyEntries` → `render()` runs inside that await so the handler's closure is
replaced before the guard clears, and two loggers cannot be on screen at once (one per report
screen). No dropped write and no double-write in the burst test.

---

### F5 — GATE. The suite cannot tell "the active profile" from "the first profile". Mutant survives 38/38.

**Severity: MEDIUM (the shipped code is correct; the check that protects it is vacuous).**

The whole safety argument for `renameActiveProfile` is *"Active profile only … cross-profile writes
are exactly what broke reminders in app-v85."* The fixture carries **one** profile, so the two are
indistinguishable:

```
M-A  const me = (ps.list || []).find(x => x.id === ACTIVE_PROFILE_ID);
  -> const me = (ps.list || [])[0];
     38 checks: 38 passed, 0 failed      SURVIVES
```

This is the same shape as the APAP mutant the builder already found: an assertion whose subject
cannot vary in the fixture. Had that line been wrong, a two-profile phone would rename the *other*
person in `profiles.list` while writing `patientName` into the active profile's prefs — the exact
split the function's own comment exists to prevent.

**To fix:** two profiles in the fixture, `p2` active, assert `p1.name` is untouched and
`p-p2-prefs.patientName` moved.

---

### F6 — GATE. Nothing checks that Snooze actually lasts fifteen minutes. Mutant survives 38/38.

**Severity: MEDIUM.** Item #8 exists because the control did not say when the card returns. Three
strings now say "15". No check anywhere asserts the behaviour:

```
M-B  setState({ heroSnoozeUntil: Date.now() + HERO_SNOOZE_MIN * 60 * 1000 })
  -> setState({ heroSnoozeUntil: Date.now() + 90 * 60 * 1000 })
     (button and toast still say 15; the card stays away 90 minutes)
     38 checks: 38 passed, 0 failed      SURVIVES
```

`test/v80-up-next.mjs` is blind too — it asserts the hero disappears and never that it comes back.
The release note claims *"One constant feeds the handler, the toast and the label, so the three
cannot disagree"*; that is true of the source today and is guaranteed by nobody. This is Rule 2.7's
"never promise a fix that has not been confirmed" aimed at a duration instead of a fix.

**To fix:** read `state.heroSnoozeUntil` after the tap and assert it is within a minute of
`Date.now() + 15*60*1000`, or set it to the past and assert the card returns.

---

### F7 — `renameActiveProfile` can leave the two stores disagreeing, with no handler.

**Severity: LOW-MEDIUM.** `index.html:684-697`.

```js
me.name = name;
saveJSON(PROFILES_KEY, ps);        // (1)
setPrefsDB({ patientName: name }); // (2)
```

`saveJSON` is `localStorage.setItem` with no guard (`index.html:1718`). If (1) succeeds and (2)
throws on quota, Settings shows the new name and the CSV filename, the printed report title and the
greeting keep the old one — permanently, with no toast and an uncaught exception out of the click
handler. That is precisely the state the function's comment says must never exist. This app already
treats localStorage pressure as real (`cwSaveUndoPoint` has a dedicated out-of-space message).

**To fix:** write prefs first, or wrap both and roll the list name back on failure, and toast.

---

### F8 — Settings can show two "Patient name" fields at once.

**Severity: LOW.** `index.html:10152` and `index.html:10159`. `renamingProfile` and `addingProfile`
are independent and both panels render. Opening Rename and then "+ Add profile" stacks two inputs
with the same placeholder, one ending in **Save name**, the other in **Create**. On Free the Add
panel is behind the tier gate, so this needs Plus/Pro. Clearing the other flag in each opener is a
two-token fix.

---

### F9 — `NON_DOSE_MED_IDS` is complete today, but nothing reserves those ids any more.

**No gap found in the list.** I enumerated every `medId:` literal that reaches `addEntryDB`
(`index.html` lines 3020/3028/3048 `chemo_date`, 3059 `blood_pressure`, 3132 `temp`,
3155/3370/3397 `PARA_MED_ID`, 3169/3632 `weight`, 3218/3226/3227 `inpatient_start|end` and
`cycle_start|end` via `logPeriodForDay` (`index.html:11591`, `11758`, `11762`), 3256/3415
`radiation_session`, 3719 `bowel_movement`, 3801 `appetite`, 4053 `symptom_*`, plus the legacy bare
`inpatient` marker read at 4116/4128) against the set at `index.html:2610`. All covered.
`chemo_date` never reaches `state.entries` (filtered at `index.html:896`) so its presence is
harmless. Missed-dose pseudo-entries are excluded by `!e.missed`.

**The collision the brief asked about is now possible.** `nextMedicationId` (`index.html:7540`)
refuses only a clash with an existing medication — the legacy fence came down in app-v78 and its
comment says so. `safeMedicationId` maps non-alphanumerics to `-`, so every underscored record id
is unreachable, but a medication named **Weight, Temp, Appetite, Inpatient or Paracentesis** takes
that exact id, and from then on `isDoseEntry()` stops counting its doses and `nameOf()` mislabels
them. Pre-existing hazard; this release is the first thing to make `NON_DOSE_MED_IDS` load-bearing,
so it belongs on the backlog with the fence work rather than in this diff.

---

### F10 — Two LOW notes on the logger's data model.

- **Appetite notes are dropped on supersede.** The logger calls `logAppetite(v, d0, '', ts)`, so
  correcting a day whose entry carried a `note` replaces it with one that has none; the note
  survives in storage but disappears from every view. Only reachable with restored or synced legacy
  data today, because the one writer of appetite notes — `submitAppetite` — is **dead code**.
- **`submitBowelMovement` (`index.html:3751`) and `submitAppetite` (`index.html:3806`) have no call
  sites.** This confirms the changelog's *"before then there was no way in at all"*, and it means
  two delete-then-rewrite paths sit in the file ready to be wired to a button by someone who does
  not know about F1. Delete them or convert them with the F1 fix.

---

### F11 — Record keeping, for the PM rather than the build.

- The README row records **two** pre-existing reds; the brief claims **three**. `v57-search` is red
  on both builds and is not named in the row. Add it or drop the claim.
- `REQUESTS.md` and `BACKLOG.md` carry nothing dated later than 2026-09-15. The eight queued items
  from Aaron's 2026-10-23 pass exist only inside the 5,000-character README cell on line 14. app-v85
  logged its leftovers in `BACKLOG.md` at PM sign-off (`c93a072`), so this is the PM's step — but
  "filed where the owner does not read it" is the failure Rule 2.6 and Rule 0.8 are both about, and
  a changelog cell is not a list.

---

## MUTANT BOARD

Each mutant applied in place with Python, suite run, file restored from a byte copy, `md5sum -c`
after every one. `index.html: OK` after all four.

| # | Mutation | Target | Suite | Verdict |
|---|---|---|---|---|
| M-A | `find(x => x.id === ACTIVE_PROFILE_ID)` → `[0]` | "renames the ACTIVE profile only" | **38/38 pass** | **SURVIVES — F5** |
| M-B | snooze handler `HERO_SNOOZE_MIN` → literal `90` (label/toast untouched) | "the three cannot disagree" | **38/38 pass** | **SURVIVES — F6** |
| M-C | `supersedeStamp` → `return base` | the supersede itself | 37/38, FAIL *"stamped strictly newer … delta 0ms"* | killed |
| — | (F2) day with only bowel/appetite/radiation | "Nothing logged" | not exercised by any fixture | **uncovered** |
| — | (F1) check-in after a supersede | cross-path latest-wins | not exercised by any fixture | **uncovered** |

The builder's thirteen mutants are not re-run here; M-C reproduces one of them as a control that the
harness and the restore procedure are sound.

---

## WHAT I CHECKED AND FOUND GOOD

**The suite is real.** `test/v86-logging-and-labels.mjs` → **38 checks: 38 passed, 0 failed** against
`5d54e2e`. The hook exports the shipped functions rather than copies; section 8's precondition does
now fail loudly without an mg row (verified by reading the fixture's `homeCard: { kind: 'mg' }` and
the anchored summary-span regex, which reports `summary="1 dose · 600 mg Ibuprofen"`); the
`pageerror` listener is on the context.

**`test/v80-up-next.mjs` was tightened, not relaxed.** The replaced check was
`labels.indexOf('Snooze') >= 0`; it is now `/^Snooze\b/` **plus a new check** that the label states a
duration. The Playwright selector moved from `name:'Snooze', exact:true` to `name:/^Snooze\b/`, still
anchored. **49/49.** No check was weakened and no check was changed to match a bug. (Its blindness to
the actual duration is F6 and predates this edit.)

**The three claimed pre-existing reds are honest.** Each run against `87d1784` (port 8898) and
`5d54e2e` (port 8899):

| suite | app-v85 `87d1784` | app-v86 `5d54e2e` | same failure? |
|---|---|---|---|
| `v84-whatsnew` | 95/96 — FAIL *"precondition: the field is below the fold … top=836 in a 844px viewport"* | 95/96 — **identical message** | yes |
| `v71-report-controls` | aborts: `Error: modal did not close after Confirm at: para-add` | **identical abort, same line** | yes |
| `v57-search` | 1 FAIL *"every 'litre' … 3 in the file, 1 in parsed keyword arrays"* | **identical** | yes |

None is caused by this release and none is fixed by it. The record is not a lie.

**Other suites, all green against `5d54e2e`:** `v75-no-other-patient` **27/27** (Rule 0 ratchet,
0/0/0 against a pinned 0/0/0), `v58-eod-checkin` **10/10**, `v64-logger` **23/23**,
`v83-meds-and-reports` **80/80**.

**Rule 0.** Clean. No patient name. No gendered pronoun in any user-facing string the diff adds
(`v75` green). The two `He/His` in the diff are in prose about **Aaron** — one README cell, one code
comment — matching ten pre-existing instances in the same file; `v75`'s pronoun check strips `//`
comments by design, and the patient is never gendered. No dose, ceiling or schedule added. No new
behaviour keyed to a medication id — `NON_DOSE_MED_IDS` keys on *record types*, not medications, and
`isDoseEntry` is the complement, so a stranger's medication of any name is still counted as a dose
(the suite asserts `isDoseEntry({medId:'zofran'}) === true`).

**The Voice, on every string the diff adds or changes.** True and plain:
*"Log today's bowel movement, and review the history."* · *"Log today's appetite, and review the
history."* · *"Picking again replaces today's answer. The earlier one stays in the record."* ·
*"Snoozed · back in 15 minutes. Nothing about the dose has changed."* · *"In Settings you can rename
the profile you're in, and delete any other."* (accurate: Delete renders only on non-active rows) ·
*"Enter a name"* · *"Could not save that — nothing was changed."* (true: `saveJSON` throws before it
persists). Changelog bullets 1, 2, 5, 6 and 7 verified true. **Bullet 3 overstates** — see F2. One
copy nit, not blocking: *"You can rename the person you are currently in"* is harder at 2am than the
Account screen's own wording; reuse *"the profile you're in."*

**The Designer pass reproduces.** My own measurement at 320px: bowel report `scrollWidth 320 /
clientWidth 320`, appetite report the same — no horizontal overflow. Logger buttons are 46px tall
with 14px labels (consistent with the app; the 16px floor applies to text inputs, and the rename
input is explicitly `fontSize: '16px'`). The report's self-reported note about the rename field
rendering below the list rather than in the row is accurate, and its "20751 missed doses" finding is
correctly attributed to the fixture's `installedAt: 1` rather than to the app.

**Release mechanics.** `sw.js` CACHE `chemowell-app-v85-1` → `chemowell-app-v86-1`, moving with
`APP_VERSION` → `app-v86`. `release_check.sh` behaves as designed: it refuses with *"the quality
chain has not run for app-v86 … missing: an outputs/AUDIT\*app-v86\*.md report"* — this file answers
the first half.

**The eight queued items are genuinely not in this release.** I read the whole 364-line `index.html`
diff. It touches only: `renameActiveProfile`, `state.renamingProfile`, `NON_DOSE_MED_IDS` /
`isDoseEntry` / `isSymptomEntry`, the `tsOverride` parameter on the two log functions,
`HERO_SNOOZE_MIN`, `APP_VERSION`, the changelog entry, the Settings profile row, the Account caption,
two `reportDescriptor` descriptions, the History day summary, `supersedeStamp` /
`renderDailyValueLogger` / the two report screens, and the `window.__v86Test` export. Nothing touches
backup gating, the chart axis, the Calendar, the In-Patient checkbox, dose prompts, fever warnings or
symptom severity.

**No new reminder risk.** `renameActiveProfile` does not need `markNotifDirty()` — no notification
title or body carries `patientName`, and reminder identity is keyed on `profileId` since app-v85.
`ACTIVE_PROFILE_ID` is bound at module load and a profile switch reloads the page, so the rename
cannot be pointed at a stale profile at runtime. `profilesState()` re-reads from storage each call,
so the in-memory `me.name = name` is discarded if the save throws.

---

## TO SHIP

1. **F1.** Make the supersede the default inside `logBowelMovement` / `logAppetite` so the Home
   check-in and the banner Update obey it, and drop the remove-then-rewrite in the three `submit*`
   paths. Add the cross-path case to the suite: two Reports picks, then a check-in with a different
   answer, assert the check-in's answer is what the screen shows.
2. **F2.** Give `bowel_movement`, `appetite` and `radiation_session` their own named segments in the
   day summary and include them in `nothingElseLogged`. Add a fixture whose only entries are those,
   and assert the summary is not "Nothing logged".
3. **F3.** Decide what the clinician sees for a corrected day and make it unambiguous — a visible
   time gap, a marker on the superseded row, or the day's winner only in `buildExportRows`. Say which
   in the release message.
4. **F4.** One-line no-op guard in the logger's `onClick` when the picked value is already current.
5. **F5.** Two profiles in the rename fixture, the second one active; assert the first is untouched.
   Re-run mutant M-A and show it red.
6. **F6.** Assert the snooze duration, not three strings about it. Re-run mutant M-B and show it red.
7. **F7.** Wrap `renameActiveProfile`'s two writes, or order them prefs-first, and toast on failure.

**Recommended before the re-audit, not blocking:** F8 (clear the sibling panel flag), F10 (delete or
convert the two dead `submit*` paths), F11 (name `v57-search` in the README row; the PM moves the
eight queued items into `REQUESTS.md`).

**Deliberately exempt, stated rather than skipped.** Everything here was measured in Chromium at 320
and 390 on loopback. There is no iPhone and no Safari in this sandbox, nothing has been on a real
phone, and no Firebase or network path was touched. The three pre-existing reds are recorded, not
fixed. `v71-report-controls` aborts at `para-add` on both builds, so every check after that point in
that file is unexercised on this release as it was on the last one.

---

## HOUSEKEEPING

Working tree left exactly as found: `git status --porcelain` shows only this file;
`md5sum -c` after the last mutant returns `index.html: OK`, `sw.js: OK`,
`test/v80-up-next.mjs: OK`, `test/v86-logging-and-labels.mjs: OK`. No `git add`, `checkout`, `reset`
or `stash`. No commit, no push. The server I started on 8899 is stopped; the app-v85 baseline on
8898 was already running when I arrived and is untouched. Probe scripts live in the scratchpad at
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/` (`probe1.mjs`,
`probe2.mjs`, `probe3.mjs`, `probe4.mjs`, `probe5.mjs`) and are not in the repo.
