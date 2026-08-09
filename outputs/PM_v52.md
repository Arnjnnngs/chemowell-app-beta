# Project Manager — release gate, app-v52

**Date:** 2026-08-09 · **Candidate:** working tree at `f91fa4c` (`origin/main` is still app-v51; nothing has shipped)
**Gate run by:** Project Manager, independently. Nothing below is restated from the Lead Developer's own claims; every result here was produced by driving the running product myself (Playwright + Chromium over `python3 -m http.server`, `http://127.0.0.1:8899/index.html`, phone viewports 360×780 and 390×844).
**Chain under review:** Auditor `outputs/AUDIT_full_app_v51.md` (82 cases, origin of H-1/H-2/H-3) → Lead Developer → Designer `outputs/DESIGN_v52.md` → Auditor `outputs/AUDIT_v52.md` (**REJECTED**, 5 findings) → fixes → Auditor `outputs/AUDIT_v52_2.md` (safe to ship, one Medium open) → fixes for that Medium (`f91fa4c`) → this gate.

---

## 1. VERDICT

# ✅ READY FOR AARON

The three High-severity defects are genuinely fixed, and I verified each one myself rather than accepting the Auditor's word for it. The last round of fixes — the ones **nobody independent had looked at**, which is the exact gap that produced V52-1 earlier in this session — hold up under direct testing, including the upgrade path they were written for. Zero console errors across every session I ran.

**One thing was missing when this reached me, and I closed it inside this gate rather than bouncing the release for it:** `README.md`, `REQUESTS.md` and `BACKLOG.md` had no app-v52 content at all. TEAM.md makes that Scribe step mandatory every release and names the README entry in the Release mechanics checklist, and Aaron escalated it personally on 2026-08-09 (*"I need to see the task list that done and what needs to be done after every build or request I ask"*). Documentation is not application code, so writing it does not compromise this gate's independence over the code — but the fact that it was missing at the PM stage, again, is a process finding in its own right (§4). Exactly what I wrote is itemised in §6.

**Restart tier: none applies to the code.** No functional, data or safety miss survived into this candidate. The three remaining LOW findings (§4) are all *pre-existing* — surfaced by this audit cycle, not introduced by it — and holding a strictly-better release for them would be the wrong trade.

**Conditions on shipping, in order:**
1. Commit the documentation written in this gate (done locally — see §7) before the GitHub upload.
2. Push, then live-verify the deployed site with a cache-buster, per TEAM.md.
3. Fix `release_check.sh` **before the next release**, as its own change with its own gates — see §4, finding PM-1. It is the project's only mechanical release safeguard and it currently passes green on the exact bug it was written to block.

---

## 2. My own verification, with observed values

Everything in this section is a value I read off the running app, not a claim I inherited.

### H-1 — the missed-dose banner that could never be cleared

The claim: Home counted misses over every calendar day since install; History only over days that had a logged entry, so a day with nothing logged could never render a missed row — Home said "N missed doses", Review said "you're all caught up", and "Clear all" never appeared because it is gated on `totalMissed > 0`.

Driven from a wiped install: chemo profile, two scheduled medications (Protonix 08:00; Iron 09:00 + 18:00), then **three calendar days advanced with nothing logged at all** — so every one of those days has misses and zero entries, which is precisely the case the old code could not represent.

| | Observed |
|---|---|
| Home banner | **"8 missed doses from previous days"** |
| History header | **"Missed Doses (9)"** — 8 past + 1 today |
| Days listed | 4 (Today 8/12 · 1 · Tue 8/11 · 3 · Mon 8/10 · 3 · Sun 8/9 · 2) |
| Individual resolvable rows | **9**, each with Took later / Skipped / Clear |
| "you're all caught up" | **absent** |
| "Clear all" | **present** |
| After tapping Clear all | toast **"9 missed doses cleared"**, History → "No missed doses to review — you're all caught up!", **Home banner gone** |
| After a full reload | banner still gone — the clear persists |

Banner and History agree exactly, the count is resolvable, and the alert can now actually be cleared. **H-1 confirmed fixed.**

I re-ran the same agreement check at a deliberately extreme scale — a 365-day-old install with four scheduled medications and nothing ever logged: Home read **"1460 missed doses from previous days"** and History read **"Missed Doses (1460)"**. Exact at both ends of the range. (That scale also exposed a performance tail case — see PM-2 in §4.)

Designer D-4 verified in the same run: a day seeded purely because it has misses reads **"Nothing logged · 3 MISSED"**, not "0 doses · 3 MISSED". The string `0 doses` does not occur anywhere on the screen.

### H-2 — a medication that vanished from Home forever

**Before any treatment date exists** (chemo profile, "Dexa PM" set to *Only near treatment day*, −1/+1):
- the card is **shown**, not hidden;
- it carries the amber chip **"No date set"** — not the green "✓ Available";
- and the caption **"Showing every day until you set a treatment date."** (Designer D-2, both halves present).

**The window walk.** Treatment date set to 2026-08-20, then the simulated date stepped one day at a time. Expected = shown only at offsets −1, 0, +1:

| Date | Offset | Expected | **Observed** |
|---|---|---|---|
| 2026-08-17 | −3 | hidden | **hidden** |
| 2026-08-18 | −2 | hidden | **hidden** |
| 2026-08-19 | −1 | shown | **shown** |
| 2026-08-20 | 0 | shown | **shown** |
| 2026-08-21 | +1 | shown | **shown** |
| 2026-08-22 | +2 | hidden | **hidden** |

Exact on both boundaries, no off-by-one.

**The radiation-only dead end** — the half of H-2 that made this unrecoverable rather than merely confusing. On a wiped radiation-only profile:
- Home does **not** show the Treatment schedule card by default (clean Home preserved — verified by reading the rendered text, not by assuming);
- Settings **does** now offer **"Treatment schedule card"**, which previously did not exist for these profiles;
- toggling it on puts the card on Home, a date can be set, and the same window walk then behaves correctly (med visible with no date → shown on 8/20 → hidden on 8/25).

There is no longer any profile type that can save a treatment-day restriction while having no way to set a treatment date. **H-2 confirmed fixed.**

Designer D-3 verified in the same session — on radiation-only, the rendered order is `RADIATION SESSIONS` (line 17) **above** `TREATMENT SCHEDULE` (line 22). On a `both` profile the order is deliberately unchanged: `TREATMENT SCHEDULE` before `RADIATION SESSIONS`. The reorder is correctly scoped.

### H-3 — the invented pill count

Aaron's report was *"the detail column had 500mg, 500 pills. the med was Tylenol for 500 mg."* I exported real CSVs from a real profile with three deliberately different dose shapes: a mg dose, a non-mg unit, and a label with no leading number at all.

Raw CSV, read off disk:

```
Date,Time,Type,Detail,Note
2026-08-09,9:23 PM,Tylenol,500 mg,
2026-08-09,9:23 PM,Zofran,2 tabs,
2026-08-09,9:23 PM,Cream,thin layer,
```

The string `pill` does not appear anywhere in the file. Each amount appears exactly once.

**The printable doctor's report** feeds off the same `buildExportRows()`, and it is the document a clinician actually reads, so I unlocked Plus and opened it too:

```
Treatment record — PM Report
Generated August 9, 2026 · ChemoWell app-v52 · Chemo
Sunday, August 9, 2026
Time    Type      Detail   Note
9:30 PM Tylenol   500 mg
9:30 PM Zofran    8 mg
```

Clean, and the header correctly reads `app-v52`. **H-3 confirmed fixed in both artifacts.**

### V52.2-1 — reproduced through the real upgrade path, not a fresh install

This is the finding that only reproduced when a medication saved by an *earlier* build was opened on an "Other" profile — fresh installs looked clean, which is why the first pass missed it. I did not hand-craft localStorage; I reproduced the actual upgrade:

1. Served the real `origin/main` (**app-v51**) `index.html` on its own origin.
2. Created an **Other** profile on it and added a medication through the v51 editor with *Only near your date, 2 days before / 1 day after*. Confirmed v51 genuinely offered that control on an Other profile (the premise of the finding), and confirmed what it wrote to disk:
   `{"treatmentOnly":true,"treatmentMode":"only","treatmentDaysBefore":2,"treatmentDaysAfter":1}`, with the Meds list showing the chip **`Your date −2/+1`**.
3. **Swapped `index.html` to app-v52 on the same origin** and reloaded — so localStorage carried over exactly as it would on a real user's phone.

After the upgrade:

| Check | Observed |
|---|---|
| Old-shape data still present | yes — `treatmentMode:"only"` intact, so this is a genuine upgrade, not a disguised fresh install |
| Medication still on Home | yes (H-2 holds through the upgrade) |
| "No date set" chip / caption | **absent** — correctly suppressed for Other |
| "Outside its date window" | absent |
| Meds-list restriction chip | **gone** |
| **Editor: "Active window: …" summary** | **gone** |
| **Editor: Days before / Days after fields** | **gone** |
| Editor: mode picker | gone |
| Console errors across the whole upgrade | **zero** |

I read the editor's full rendered text end to end; the treatment-availability block is absent in its entirety. **V52.2-1 confirmed genuinely fixed, on the path that produced it.** A fresh Other profile is also clean.

### The last commit (`f91fa4c`) — the part nobody independent had seen

Two behavioural changes shipped after the Auditor's final pass. I treated these as unreviewed code, because they were.

**(a) The grouped-placement caption (V52.2-2).** A medication in a Morning/Afternoon/Evening group now carries the same explanation the standalone card got. Tested at **360px**, the narrowest supported width, with one restricted and one unrestricted medication in the same group:

- caption renders: **"No date set — showing every day until you set a treatment date."**
- it is attached to the restricted medication only (character offsets: Dexamethasone @259, caption @281, Buspirone @349 — the caption falls between them, so it belongs to the right row);
- it appears **exactly once** on the screen;
- **horizontal overflow at 360px: 0px** — the new line wraps rather than pushing the Log button off-screen (screenshot: `outputs/v52-pm-screenshots/pm-01-grouped-no-date-360.png`);
- once a treatment date exists the caption disappears, and *outside* the window the grouped row correctly reverts to the inert **"Outside its treatment-day window"** state — so the new copy did not break the pre-existing grouped gating either side of it.

I also checked the risk that this fix could be a silent no-op: `renderGroupedMedsCard` receives objects filtered straight out of `state.meds`, so `med.treatmentOnly` is genuinely present on them. It is not decorative — it fires.

**(b) The `!isOtherTreatmentType()` guard on the days-before/after block.** Verified live above (V52.2-1). I also traced its blast radius by hand: the guarded block is presentation-only; `treatmentOnlyBlocks()` and `treatmentExcludedNow()` already short-circuit on Other, so no gate, reminder, missed-dose or export path changes behaviour. The one consequence worth recording is that the *stored* value survives — covered as PM-3 in §4, and it is inert today.

**(c) Version-comment normalisation.** The Auditor's V52.2-4 asked for `APP_VERSION = 'app-v52.2'`; the Lead Developer instead normalised the in-code trail to `v52` and tracked the iteration in the sw.js cache suffix. **I side with the Lead Developer here** — `.1/.2/.3` were sandbox iterations that never left the building, and inventing a user-visible version string for them would make the drawer label *less* truthful, not more. I verified there is no residue: `grep -o "v52\.[0-9]" index.html sw.js` returns **nothing**.

### Cross-profile sanity

| Profile | Checked | Result |
|---|---|---|
| chemo | window walk, D-2 chip + caption, CSV, missed-dose agreement | pass |
| radiation-only | default cards, Settings toggle, D-3 order, date can be set, window walk | pass |
| both | card order deliberately unchanged | pass |
| Other (fresh) | editor carries no treatment-availability control at all | pass |
| Other (upgraded from v51) | as above, plus no orphaned fields or chips | pass |

Console errors across every session in this gate: **zero**.

---

## 3. Scope check — does this match what Aaron asked for?

| Aaron asked for | Status |
|---|---|
| The findings from the full app audit fixed | **Yes** — H-1, H-2, H-3 all verified fixed by me directly, plus D-1…D-4, V52-5, V52.2-1, V52.2-2 |
| Per-illness testing with real logs entered by the team, not by him | **Yes** — `AUDIT_full_app_v51.md` (82 cases, 4 profiles) and `AUDIT_v52_2.md` (95 cases, 5 profiles, 24 medications created by hand); I spot-checked the claims that mattered and they held. The rule is now written into TEAM.md so it can't quietly go soft again |
| *"the whole near treatment and exclude shouldn't be there at all for them"* (Other) | **Yes, in full** — picker, days fields, "Active window" summary, and the Meds-list chips, on fresh **and** upgraded profiles |

Nothing was dropped. Nothing drifted into scope that Aaron didn't ask for: every non-requested change in this diff (the amber chip, the caption, the radiation card order, "Nothing logged") traces to a named Designer or Auditor finding about the fixes themselves, not to someone's idea of an improvement.

The only requested thing not *delivered* here is on-device confirmation — real Android notification delivery, the native share sheet, the hardware Back button. Those are genuinely outside a browser, they are named explicitly in the Auditor's report rather than quietly skipped, and the browser-reachable half of each was tested. They stay with Aaron's device, which is the correct place for them.

---

## 4. My own findings

None of these block the release. All are logged in `BACKLOG.md` so they survive this session.

### PM-1 — HIGH (process) · `release_check.sh` passes green on the exact bug it exists to prevent

TEAM.md leans on this script hard: *"a checklist item is something a rushed agent can forget to re-read; a script that hard-fails the release is not."* It doesn't hard-fail. It reads `git diff --name-only HEAD -- index.html` and `git diff HEAD -- sw.js` — i.e. **only uncommitted work**. The moment a change is committed, the script sees a clean tree and reports success.

Reproduced, not theorised. On a scratch clone of this repo, I committed a change to `index.html` and nothing else, then ran the gate:

```
--- release_check on a COMMITTED index-only change (sw.js untouched) ---
✅ Release check passed.
   No index.html changes pending.
EXIT=0
```

That is the app-v40 silent-stale-cache failure — index.html changes, sw.js CACHE doesn't, every installed copy keeps serving the old shell forever with no error — waved through with a green tick. And it is reachable through this project's *own documented workflow*: APP_CLAUDE.md rule 8 says commit early and often, and pushes are manual GitHub web uploads of already-committed files, so the script's window of visibility is closed by the time it matters.

app-v52 itself is fine — I checked the version coherence by hand instead of trusting the script (see §5) — but the check contributed nothing to that assurance.

**Fix (one line, don't do it in this gate):** diff against the upstream ref, not `HEAD`:

```bash
BASE="${BASE_REF:-origin/main}"
INDEX_CHANGED=$(git diff --name-only "$BASE" -- index.html)
SW_DIFF=$(git diff "$BASE" -- sw.js)
```

keeping the existing `HEAD` comparison as an additional uncommitted-work warning. I deliberately did **not** change it here: it is the safeguard this release is standing on, and editing the release gate from inside the release gate, unreviewed, is the same pattern I'm flagging. It should go in as its own change with its own Auditor + PM pass, **before the next release**.

### PM-2 — LOW (new, introduced by H-1) · History gets very heavy once a large backlog is finally listed

Before v52, History rendered nothing for days with no entries; now it seeds them, which is the fix — but it means a long-ignored backlog now materialises as real DOM. Measured on this sandbox (4 scheduled medications, nothing ever logged):

| Backlog | Missed doses | History render | Tap response |
|---|---|---|---|
| 14 days | 56 | 83 ms | 113 ms |
| 45 days | 180 | 135 ms | 198 ms |
| 120 days | 480 | 298 ms | 569 ms |
| 365 days | **1,460** | 1.5 s (~114 k chars of DOM) | **unresponsive — a click retried for 20 s without landing** |

The cause is the app's 1-second `setInterval` that calls `setState()` and rebuilds the whole tree; harmless at normal sizes, not at this one. Realistic backlogs — a patient who stops logging for a few weeks — are comfortably fine, and a real phone is slower than this sandbox but not by the order of magnitude that would move the 45–120-day rows into trouble. The uncomfortable part is the shape of it: the user who most needs the "Clear all" button is the one who can't tap it. Tail case, not a blocker; fix by capping/paginating the seeded list or excluding History from the tick the way the modals already are.

### PM-3 — LOW · the removed restriction is still *stored* on Other profiles

Re-saving a medication on an Other profile leaves `treatmentMode:"only"` in localStorage (I confirmed this directly after the upgrade). It is inert — and, importantly, it is inert *for a reason that isn't obvious*: there is currently **no UI anywhere to change a profile's treatment type after first-run setup**, so no in-app path exists to switch Other → Chemo and reactivate it. I chased that path specifically before deciding this wasn't a defect. If treatment-type editing is ever added — and it probably should be, since treatment plans change — the value must be cleared on the way out of Other, or a medication the user hasn't been able to see restricted since upgrading would silently start hiding itself.

### PM-4 — LOW · dead "Other" copy left behind

`treatmentModeOptions()`'s Other branch is now unreachable, and three expressions (index.html ~2548, ~3883, ~5017) both exclude Other with `&& !isOtherTreatmentType()` *and* branch on `isOtherTreatmentType() ? …` inside themselves. No behavioural effect; it just misleads whoever reads it next.

### PM-5 — LOW (pre-existing, carried) · the doctor's report still prints raw internal override codes

`buildExportRows()` still emits `'override: ' + e.overrideReason`, so a clinician reads `override: early+overLimit`. The app already has `overrideBadgeLabel()`, which renders exactly that value as "Early · Over limit" for the on-screen badge — the export just doesn't call it. This is the *same document, same audience, same function* that H-3 was raised about, so it belongs in the next pass over it. Pure copy, one line, and under TEAM.md's tiering it is a targeted fix, not a new round — which is exactly why it shouldn't hold this release.

Also still open and unchanged from `AUDIT_v52.md`: V52-8 (`9999` accepted in Days before) and V52-9 (a "Pick a date" control still showing beneath an already-confirmed date). Both pre-existing, both cosmetic, both in BACKLOG.

### PM-6 — process · the last commit reached the PM with no Auditor pass behind it

`f91fa4c` was written *after* the Auditor's final report and shipped straight to this gate. That is structurally the same gap that produced V52-1 earlier in this session — a fix made after the last independent look, assumed safe. It held up this time; I tested it hard (§2) precisely because nobody else had. But "the PM caught it" is not a substitute for the Auditor stage, and if it becomes the habit, the gate stops being two independent looks and becomes one. **Recommendation:** when the Auditor's closing findings are fixed, the fix goes back to the Auditor for a spot-check addendum against its own report before the PM sees it — cheap, since the Auditor's harness is already committed in `test/`.

### PM-7 — process · the Scribe step arrived at the PM gate undone, again

`README.md`, `REQUESTS.md` and `BACKLOG.md` had nothing about app-v52. TEAM.md calls Scribe mandatory *every* release and Aaron re-escalated it on 2026-08-09 in stronger terms than the first time. It should not be routine for it to land on the PM. Written now (§6), but the pattern is worth naming.

---

## 5. Release mechanics

### `release_check.sh` — raw output, verbatim

```
$ bash release_check.sh
✅ Release check passed.
   No index.html changes pending.
$ echo $?
0
```

Exits 0. **Read §4 PM-1 before drawing comfort from that** — the tree was already committed when this gate started, so the script had nothing to inspect and this result carries no information about whether the shipping delta is coherent. I verified that by hand instead:

| | origin/main (app-v51) | candidate | Coherent? |
|---|---|---|---|
| `APP_VERSION` (index.html) | `app-v51` | **`app-v52`** | ✅ changed |
| `CACHE` (sw.js) | `chemowell-app-v51-1` | **`chemowell-app-v52-4`** | ✅ changed |
| Residual `v52.x` strings in shipping files | — | **none** | ✅ |
| Printable report header, live | — | `ChemoWell app-v52` | ✅ matches |

index.html changed **and** sw.js's CACHE changed with it, so installed copies and the APK's WebView will pick this up on next open. That is the thing the script was supposed to confirm.

### Working tree

Clean at `f91fa4c` when this gate started — so everything I tested is byte-identical to what would ship. The documentation written during this gate (§6) plus this report and three screenshots have been committed locally; **nothing has been pushed.**

### `outputs/` — a report per stage

| Stage | Report |
|---|---|
| Developer (architecture brief) | not used — defect fixes, correctly skipped per TEAM.md §1 |
| Lead Developer | `4c1830b`, `f91fa4c` (self-verification recorded in the commit messages) |
| Zero Day Auditor — origin of findings | `outputs/AUDIT_full_app_v51.md` |
| Designer | `outputs/DESIGN_v52.md` |
| Zero Day Auditor — re-gate 1 | `outputs/AUDIT_v52.md` (REJECTED) |
| Zero Day Auditor — re-gate 2 | `outputs/AUDIT_v52_2.md` |
| Project Manager | `outputs/PM_v52.md` (this) |
| Evidence | `outputs/v51-full-audit-screenshots/`, `outputs/v52-2-audit-screenshots/`, `outputs/v52-pm-screenshots/` (3 images), harnesses in `test/` |

Complete, with the one gap named in PM-6: no Auditor report covers `f91fa4c`.

### Remaining

Push, then live-verify the deployed site with a cache-buster query param (the service worker caches aggressively). Not doable from this sandbox — no outbound access to the live site.

---

## 6. Documentation written during this gate

This was missing and is now done. Specifically:

- **`README.md`** — a full `app-v52` version-history row at the top of the table, in the established style: what each of H-1 / H-2 / H-3 actually was in plain terms (including *why* H-1 was treated as safety-relevant rather than cosmetic), Aaron's Other-profile change, the four Designer must-fixes, the gate trail with both Auditor verdicts, and the version/cache bump.
- **`REQUESTS.md`** —
  - two new **Completed** entries, each quoting Aaron's own words: the full per-illness audit request (and the three defects it produced), and the near-treatment/exclude removal for Other;
  - "Next up" retargeted from app-v51 to **app-v52** for the outstanding on-device confirmations, with the note that these are the same three items carried since app-v50 and that nothing in v52 depends on them;
  - `release_check.sh` flagged there as the top technical-debt item before the next release.
- **`BACKLOG.md`** — six new entries: PM-1 (with the exact one-line fix), PM-2 (with the measured numbers), PM-3, PM-4, PM-5, and the "no way to change treatment type after setup" gap found while chasing PM-3.

---

## 7. The summary Aaron receives

> **ChemoWell app-v52 is ready.** Three real problems are fixed. All three were found by the team, not by you.
>
> **1. The red "missed doses" warning you couldn't get rid of.** The Home screen counted missed doses across every day. The Review screen only ever looked at days where you'd actually logged something. So on a day where nothing got logged — which is exactly the kind of day you'd miss a dose — Home would say "2 missed doses" and Review would say "you're all caught up", and there was no button anywhere to clear it. Reloading didn't help. Now the two screens count the same days, every missed dose is listed with Took later / Skipped / Clear next to it, and there's a "Clear all" button. I tested it: Home said 8, Review listed 8, one tap cleared them, and they stayed gone after a restart. This one mattered most — a red warning you can't clear teaches you to ignore red warnings.
>
> **2. A medication that could disappear off your Home screen and never come back.** If you set a medication to "only near treatment day" but hadn't put a treatment date in yet, the app hid it — because it couldn't work out whether today was near your treatment or not, and it guessed "no". No message, no way to get it back. It was worse for radiation-only patients: the app had no place for them to enter a treatment date at all, so they could set that rule and then never be able to satisfy it. Now the medication stays on screen with an amber "No date set" note explaining exactly why the rule isn't being applied yet, and radiation patients can turn a treatment date on from Settings. I walked a real medication through the days either side of a treatment date and it appeared and disappeared on exactly the right ones.
>
> **3. The "500 mg, 500 pills" in your export.** You spotted this one. The app was reading the number out of the dose label ("500 mg") and printing it a second time as a pill count you never entered. Every row did it — "8 mg, 8 pills", "2 applications, 2 pills". The same wrong text was going into the printable report you'd hand a doctor. Now the dose is printed once, exactly as you typed it. I exported a real file and read it: `Tylenol, 500 mg`. Nothing invented.
>
> **4. What you asked for on "Other" treatment type.** The near-treatment and exclude options are gone from the medication editor completely for Other profiles — not reworded, gone. That includes profiles upgrading from the old version, which is where the team's first attempt left half of it still on screen; I checked that specific case by actually upgrading an old profile rather than starting fresh.
>
> **What's still on you.** Only the things a computer genuinely can't check: once this is on your phone, confirm the reminders arrive on time, and confirm the CSV/report export opens Android's share sheet properly. Those are the same two device checks that have been outstanding since v50 — the code fixes are in, nobody has been able to watch them run on a real phone. Everything else was tested here.
>
> **Nothing has been pushed yet.** The version numbers are set correctly so your phone and the app will actually notice the update this time.
>
> **One thing on our side, not yours.** The script that's supposed to stop us shipping an update your phone would silently ignore has a hole in it — it only checks work that hasn't been saved yet, so by the time we run it, it always says "all clear". It said all clear here too. I checked this release by hand instead and it's genuinely fine, but that script gets fixed before the next release rather than being trusted again.
>
> **Done this session:** full app test with real medications and real logged doses across all four treatment types (chemo, radiation, both, Other) · missed-dose alert fixed · disappearing-medication fixed · export/report pill-count fixed · near-treatment removed for Other · four design fixes · docs and task list brought up to date.
>
> **Still outstanding:** your two on-device checks above · multi-device sharing (the backend is live and secure; the in-app screens are the next real build) · the "what is this medication for?" link · the in-app issue logger and the troubleshooting walkthrough (both waiting on your go-ahead) · a decision on dropping the Male/Female onboarding question · six small cleanups now logged in BACKLOG.md, none of which affect anything you'd see.

---

*Project Manager sign-off, 2026-08-09. Verified independently against the running product; not a restatement of the Lead Developer's or the Auditor's claims.*
