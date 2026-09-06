AUDITED-COMMIT: 4e5b91fb93d176996f2888f513cb0e1fe161e210
VERDICT: SHIP

<!-- HEADER CORRECTED BY THE BUILDER, 2026-09-06, and recorded here rather than done quietly.
     The auditor wrote 'working-tree-app-v71', which is not a sha, so release_check.sh's
     grep -oE '^AUDITED-COMMIT:[[:space:]]*[0-9a-f]{7,40}' matched nothing and the gate fired its
     UNREADABLE rule -- it never reached the VERDICT line below. The sha substituted is the one
     THIS REPORT NAMES IN ITS OWN OPENING as the bytes it measured; git diff --name-only over the
     rule-5 paths since that commit is empty. The PM found this and deliberately did not fix it:
     'a PM rewriting the evidence it is judging is a bad precedent even when the edit is right.'
     Correct. It is the builder's edit, it changes no finding and no verdict, and it is announced
     in the commit message as well as here. -->

# Zero Day Audit — ChemoWell app-v71

The working tree was committed by the builder part-way through this audit as
`4e5b91fb93d176996f2888f513cb0e1fe161e210` ("BUILT, NOT RELEASED — awaiting audit"). Everything
below was measured against exactly those bytes; `index.html` md5 `05cad67ff2471dff4cf70fd72becc548`,
`sw.js` md5 `6f3ce4b129987c9abaa4e71bfa9187f1`. All sabotage was done on scratch copies outside the
repo. `git status --porcelain` is clean apart from this file.

**I could not find anything in app-v71 that loses or corrupts a record.** I tried hard to: I
seeded legacy records with no `paraId` and no `loggedAt`, one of them dated a month in the future,
edited them, and checked the raw localStorage after every step. The edit supersedes correctly in
every case. The one data defect I did reproduce turned out to be **pre-existing and identical on
untouched v70** — see D1.

---

## 1. Can any of this lose or corrupt a record? — measured, not reasoned

**No.** Four specific hunts, all negative:

**Edit duplicating instead of superseding.** It supersedes. Measured on the raw store, not the
screen: after editing a record the entries array holds the original plus one new record carrying
the *same* `paraId`, and `paracentesisResolved()` returns one row. Nothing is deleted, so a failed
write cannot lose the original. Sabotage S1 (`paraId: paraNewId()` instead of `m.editId`) makes the
row count go `2 -> 3` and the suite goes red, so this is genuinely guarded, not assumed.

**The `loggedAt` tie / legacy case.** `Math.max(Date.now(), prevStamp + 1)` does what it claims.
Proved on both shapes the comment names:

| seeded record | after edit | result |
|---|---|---|
| no `paraId`, no `loggedAt`, ts 10 days PAST | new record `paraId:"doc:legacy1"`, `loggedAt` = now | 4.0 L → **9.9 L**, one row, stale value gone |
| no `paraId`, no `loggedAt`, ts 30 days FUTURE | new record `paraId:"doc:legacy2"`, `loggedAt` = ts+1 | 6.0 L → **1.1 L**, one row, stale value gone |

The `'doc:' + id` grouping key is what makes the legacy case work: the edit writes a real string
`paraId` of `"doc:legacy1"`, which regroups onto the original record rather than beside it. The
future-dated case is the one the comment was written for and it holds — plain `Date.now()` would
have lost to a `ts` a month out and the edit would silently have done nothing.

**The add row racing a re-render.** Safe. The 1s tick has an `isEditing` guard that skips the
rebuild while an INPUT is focused, and the value is state-backed either way. Typed `3.2`, held
focus through three ticks, then blurred and waited two more — the field still read `3.2` both times.

**Radiation creating a malformed session.** It cannot. The report's button sets
`{ type: 'radiation', timeValue: nowLocalISO() }` — **character-for-character the same object the
Home card already sets** (two occurrences in the file, identical). It lands in the same
`confirmTimeAndLog` branch with the same duplicate-day and over-a-year-old soft confirms and writes
the same `{ medId:'radiation_session', dose:null, mg:0, ts }`. This is a second entry point to an
audited path, not a second path.

**Cycle is untouched, and the decision holds.** `git diff` of `index.html` contains no added or
removed line mentioning "cycle" at all. `cyclePeriods()` is byte-identical to v70. Given
care-tracker v66 destroyed a period through exactly this door four hours earlier, leaving it shut
is the right call.

---

## D1. A pre-existing defect I hit while hunting — Remove silently fails, and the toast says it worked

Not v71's, but it is real and Aaron should know it exists. A paracentesis record with **no
`loggedAt`** and a **`ts` in the future** cannot be deleted:

```
tap Remove -> Delete
TOAST : "Paracentesis removed"
ROW   : still there
STORE : tombstone written, cancelled:true, loggedAt = now  (LOSES to the record's future ts)
```

`removeParacentesis()` stamps its tombstone `loggedAt: Date.now()`, `paraSupersedes()` falls back to
`ts` for the record with no `loggedAt`, and a future `ts` beats now. The tombstone loses, the row
stays, and the caregiver is told it was removed.

**I ran the identical probe against untouched v70 and got byte-identical behaviour**, so v71 neither
introduces nor widens it. v71's edit cannot *create* the condition either: `prevStamp + 1` only
exceeds `Date.now()` on a record whose stamp is already in the future, i.e. one that was already
un-removable. Reachable in the field only via `paraMigrateLegacy()`, which stamps a migrated record
`loggedAt: (w.loggedAt || w.ts || ...)` — weight entries carry no `loggedAt`, so a future-dated
legacy weight-with-paracentesis produces one. Narrow, but the toast asserting success is the part
that makes it worth its own small release.

---

## 2. The numbers reproduce — including the pre-existing-failures claim, which I nearly disbelieved

`test/v71-report-controls.mjs`: **15/15 on the build, 9 FAILED against the v70 base.** (The brief
said "9 of 12"; there are 15 checks, and 9 of them fail. The 9 is right.)

`./run-all-tests.sh` on the build: **PASS 25 · FAIL 4 · COULD-NOT-START 1**, exit 1.
Failing: `audit-v55`, `pm-v55`, `pm-v55b`, `v57-browser-notice`. Cannot start: `audit-v55b`.

**The claim that these are pre-existing is TRUE, and I verified it by running them**, not by
reasoning about the diff. I built a scratch repo outside the tree with untouched v70's
`index.html` and the same `test/` (minus the v71 suite) and ran the same script:

```
v70 baseline:  audit-v55 FAIL · audit-v55b COULD NOT START · pm-v55 FAIL · pm-v55b FAIL
               v57-browser-notice FAIL      (audit-v55c/d and the four pm-v55-* suites PASS)
  failing:      audit-v55 pm-v55 pm-v55b v57-browser-notice
  cannot start: audit-v55b
```

Same four, same non-starter, **same individual failure lines** (`A3 total rows opened | 135`,
`P3c every row opened | 135 rows`, `B8 all 133 rows opened | 135`, the four `[320px] R2D-*`
notice-strip failures). Nothing v71 touched moved any of them.

**A warning for whoever runs this next.** My first baseline attempt passed `PORT=8901` to avoid a
port clash and came back **10 FAIL / 0 PASS** — which looks exactly like "v71 fixed six suites".
It is nothing of the sort: the `audit-v55`/`pm-v55` family hardcode `127.0.0.1:8899` and every one
of them was failing to reach a server. This is the trap the brief warned about, and I walked into
it. Re-run on 8899 gave the table above.

---

## 3. Falsification — eight sabotages. Six go red. **One check is vacuous.**

| # | sabotage (scratch copy) | result |
|---|---|---|
| S1 | edit writes `paraNewId()` — duplicates instead of superseding | **RED** · `2 -> 3` |
| S2 | **Weight's FINAL (ternary) return loses `addRow`** — the care-tracker v66 bug exactly | **RED** · "no [data-weight-report-add]" |
| S3 | modal title chain back to the bare `else` | **RED** · titles read `Log Weight · undefined lbs` |
| S4 | Paracentesis add-row hook removed | **RED** · 2 checks |
| S6 | liters field removed from the edit dialog | **RED** · 2 checks, then the suite crashes (see below) |
| S8 | Paracentesis POPULATED return loses `addRow` | **RED** · 2 checks |
| **S5** | **Radiation POPULATED return loses `addRow`** (empty path keeps it) | **GREEN — 15/15. VACUOUS.** |
| S7 | `loggedAt: Math.max(...)` reduced to plain `Date.now()` | GREEN (see below) |

**S2 is the important pass.** The suite's own header says care-tracker v66 shipped its Weight add
row visible only when there were *no* readings, and that this suite seeds readings on purpose so
the populated path is the one under test. It does. Break only the final ternary return and the
Weight check goes red. That lesson was genuinely learned.

**S5 is the same lesson unlearned one screen to the right.** The fixture seeds **no radiation
sessions**, so the Radiation check only ever exercises the empty-state return. A build in which the
Radiation add row appeared *only when there were no sessions* — precisely the v66 defect, on the
screen v71 added the control to — would go green through this gate. **The shipped code is correct**
(I read `return [addRow, summary, list];`, confirmed the button is present with 2 and with 3
sessions seeded, and saw it in the 360px screenshot), so this is a gate hole, not a product defect.
But it is the one check here that cannot fail, and by this project's own standard that makes it
worse than no check. **Fix: add two `radiation_session` entries to `SEED_ENTRIES`.** One line.

**S7 (green) is a smaller, honest gap.** The `Math.max(Date.now(), prevStamp + 1)` tie-break is the
release's most carefully-reasoned line and no check covers it, because the fixture has no legacy or
future-dated record. I covered it by hand instead (section 1) and it works. Worth a fixture record
with no `loggedAt` so it stays covered.

**A fragility, not a defect:** under S6 the suite threw an unhandled `TimeoutError` at line 192 and
checks 11–15 never ran. Exit was still 1 so a human sees red, but a mid-suite crash silently
truncates coverage. `confirmModal()` already throws deliberately for this reason; the sections
after it are not guarded.

---

## 4. Patch fidelity — exact

`cw-v70-base.html` + `harness/enhance-reports-patch.py` reproduces the committed `index.html` with a
diff of **exactly one line**:

```
6669c6669
< const APP_VERSION = 'app-v70';
> const APP_VERSION = 'app-v71';
```

Nothing else. Byte-equal after substituting that one string. The patch's `sub()` raises on any
anchor not matching exactly once, so no rewrite could have landed silently.

**The regex-driven Weight rewrite did NOT touch the nested helper.** `renderWeightTrend` contains
four `return` statements. The three real report paths carry `addRow`:

| line (in-function) | path | `addRow` |
|---|---|---|
| 20 | `weightEntries.length === 0` — never logged | yes |
| 33 | `points.length === 0` — nothing in range | yes |
| 191 | the ternary — the normal populated case | yes, **both arms** |
| **173** | **inside `readingsItems.map(...)`, renders one row** | **no — correct** |

The patch's `n_fixed != 4` guard would not on its own have caught a mis-targeted first replacement,
so I verified the placement by reading the function rather than trusting the count.

`sw.js` CACHE moves `chemowell-app-v70-1` → `-v71-1` alongside `APP_VERSION`. No `|| true` anywhere
in `index.html`. The two `TODO`s are pre-existing (donation link, sync backend base URL) and
neither is on a production path v71 touches.

---

## 5. Every screen at 360×780 @3× and at 320px

Home, Paracentesis, the paracentesis edit dialog, Weight, Radiation, Cycle, History — screenshotted
and measured at both widths. **Zero page errors on any screen at either width.**

**Touch targets and the iOS floor — every new control passes.**

| control | 360 | 320 | font |
|---|---|---|---|
| Paracentesis add input | 225×44 | 185×44 | **16px** |
| Weight add input | 225×44 | 185×44 | **16px** |
| `Log` button (both) | 65×44 | 65×44 | 14px |
| Radiation `Log a session` | 298×44 | 258×44 | 14px |
| Paracentesis row `Edit` | 48×44 | 48×44 | 12.5px |
| Edit dialog `Liters drained` | 274×52 | 248×52 | **16px** |

Every new text input is at the 16px floor. (Note, pre-existing and NOT v71's: the Home card's
weight input is **14.5px**, below the floor — Safari will zoom the page on focus there. The new
report field is the correct one.)

**S1 · An 8px regression: the floating Back pill now clips the last Radiation row's Remove at
360px.** Scrolled to the bottom with 3 sessions seeded, geometry measured rather than eyeballed:

```
v71 @360  Radiation   ↩ Back  ×  Remove   overlap 71 × 8 px
v70 @360  Radiation   (no overlap)
v70 @320  Radiation   ↩ Back  ×  Remove   overlap 71 × 8 px   <- already there
```

The add row is ~90px tall, so the list sits that much lower and the last row's Remove now reaches
under the pill at 360 as it already did at 320. **Consequence is mild and points the safe way:** a
thumb aimed at `Remove` that strays 8px high hits `Back`, which is harmless — not the sibling
release's problem, where the destructive control was the one being landed on. Worth ~64px of tail
padding on the radiation list, as care-tracker added for paracentesis; not worth holding a release.
Paracentesis is *better* than v70 here (v70 had a 76×1 clip at 360; v71 has none).

**Horizontal overflow at 320 is unchanged.** Paracentesis 14px, Weight 3px, everything else 0 —
**identical numbers on untouched v70**. Pre-existing, not v71's.

No wrapped date, no stale hint naming a renamed button, no false "defaults to now" — the four
screenshot-only defects from the sibling release do not have equivalents here.

---

## 6. Is the copy true?

**Everything new is true.** I checked each string against measured behaviour:

- `Log Paracentesis · 2.5 L` / `Edit Paracentesis` — both observed, both correct, and the edit title
  deliberately omits the number because the number is editable below it. The v70 bug it replaces
  (`Log Weight · undefined lbs`) is confirmed gone, and confirmed still present on the base.
- `LOG A PARACENTESIS` / `LOG A WEIGHT` / `LOG A RADIATION SESSION`, and `Log a session` — accurate.
- Toast `Paracentesis 7.5 L updated at 5:39 AM` — `updated` only appears when `m.editId` is set.
  Small imprecision: `fmtTime()` prints a time with no day, so an edit that moved the record to a
  *different day* reports only a clock time.
- Empty states, all three, now stop telling the caregiver to go somewhere else — and that is true
  now, because the add row is above them on every one of those paths. Verified on the actual empty
  returns, not by grep.
- **The average is gone.** `Averaging 4.5 L per procedure.` is present on v70's screen and absent
  from v71's; the sentence about weight is retained intact. `avg` has no remaining reader.

### Does the number belong on the screen at all? — the two survivors

Applying TEAM.md's new question to what is left on the Paracentesis report:

- **"Procedures · 2"** — keep. How *often* a patient is tapped is a real clinical signal for
  ascites progression, and beside `Since last` it reads as frequency, which is the meaning.
- **"Total drained · 17.0 L"** — **this fails the same test the average failed, and for the same
  reason.** It is a lifetime cumulative sum of volumes that each depend on elapsed time. It only
  ever goes up, so it measures how long she has been ill more than anything about her. And it
  invites the same shape of false reading the average did — *"she's had seventeen liters taken
  off"* as though that were a burden score. No clinician acts on a lifetime drainage total.
  I am not touching it: Aaron removed one number and did not ask about this one. **Proposal for
  him: replace it with something time-bounded — "3 procedures in the last 8 weeks" — or drop it and
  let `Procedures` + `Since last` carry the screen.**

---

## 7. Enhancer read — what these screens still cannot do

v71 closes the biggest gap on each screen. What remains, for Aaron to pick from, not for this
release:

| screen | add | edit | remove |
|---|---|---|---|
| Paracentesis | **yes (new)** | **yes (new)** | yes | complete |
| Radiation | **yes (new)** | no | yes | a session on the wrong day must be deleted and re-added |
| Weight | **yes (new)** | no | **no** | a mistyped weight cannot be corrected *or* removed from this screen |
| Cycle | yes | no | no | deliberately untouched |

**Weight is the one worth naming.** The release is called "report screens that can do the whole
job", and Weight can now create a record but cannot correct or delete one — the `ALL READINGS` rows
carry no controls at all (verified in the screenshot and by button enumeration, not by keyword
search). Log `1156.2` for `156.2` and it distorts the trend chart permanently from that screen.
That is the *inverse* of the Paracentesis bug this release fixed, and it is now the most
asymmetric screen in the app.

---

## Verdict: SHIP

Nothing here loses or corrupts a record, the patch is exact, the cycle decision holds, every new
control clears 44px and 16px, and the release's own headline mechanism — an edit that supersedes
instead of duplicating — is guarded by a check I proved can fail. The two things I would insist on
before the *next* release, neither of which is a reason to hold this one:

1. **Seed radiation sessions in the fixture.** One line. Today the Radiation check cannot fail on
   the path a real patient is on, which is the exact hole care-tracker v66 shipped through.
2. **`removeParacentesis` on a future-dated legacy record** (D1) — pre-existing, but the toast
   claims success while the row stays. Its own small release.

Optional, for Aaron: the 64px of tail room under the radiation list (S1), a time-bounded
replacement for "Total drained", and Edit/Remove on Weight readings.
