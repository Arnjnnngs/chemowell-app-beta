# DEV BRIEF — Promote WEB-BETA v68/v69/v70 into WEB-MAIN as `caretracker-v43`

**Stage:** 1 (Developer / investigation). **No code was written or changed.** Read-only throughout.

**Target:** WEB-MAIN, repo `care-tracker` @ `9a7adb3` (v42) — Brandi's live app, real patient data.
**Source:** WEB-BETA, repo `chemowell-beta` @ `e9e4646`, promoting `d6f95af` (v68), `0a1e88a` (v69),
`5cba2da` (v70).
**Out of scope:** `4dd08e1` (v71) / `5253805` (v71.1) — rebrand only.

---

## 0. PROVENANCE — read this before trusting any number in this document

This brief is a **reconstruction**. The original was lost to a sandbox filesystem rollback (the
third in this session) before it was ever pushed. The two repositories were lost with it.

For this rewrite I **re-cloned both repos read-only from origin** (`github.com/Arnjnnngs/care-tracker`
and `.../chemowell-beta`) into `/tmp` and confirmed both are at the same HEADs I originally analysed
(`9a7adb3` and `e9e4646`). Every line reference, code excerpt, regex, string literal and file-level
fact below has been **re-verified against those fresh clones** and is current.

The following findings were **measured in the original session and have NOT been re-run** — the
tooling (an offline Playwright harness) was destroyed by the rollback and rebuilding it was judged a
poor use of effort versus stating provenance honestly. They are reported as previously measured:

| Finding | Status |
|---|---|
| B1 reproduced end-to-end in Chromium (Iron editor → Save → rejection toast) | **previously measured**, not re-run. The *static* proof (§4.1) has been re-verified and is independently sufficient. |
| R1/R2 numbers (162 / 12 / 161) | **previously measured** in the harness, not re-run |
| R3 differential coverage table | **previously measured**, not re-run |
| R5 performance table (2.1 → 153 ms) | **previously measured**, not re-run |

One correction against my original: the v42↔v67 baseline diff is **14 hunks**, not 15. Re-counted
just now. 184 diff lines is correct.

---

## 1. Executive summary

1. **The promotion is more tractable than it looks.** `webmain/index.html` (v42) and
   `webbeta/index.html` at v67 (`73938aa`) differ by **14 hunks / 184 lines, every one of which is
   beta scaffolding or comment drift.** There is *zero* functional divergence between prod v42 and
   beta v67 — re-verified. This is what makes the beta-only revert list finite and auditable, and it
   drives the recommendation in §3.

2. **Three blockers must be resolved before this ships (§4).** B1 makes three of Brandi's five
   alert-tracked medications uneditable. B2 means two of the new features have never successfully
   executed anywhere. B3 is an unguarded write of a brand-new field into a rules-protected
   collection, with silent failure.

3. **A landmine not on the original list (§5):** `MED_CONFIG_STORAGE_KEY`. Same family as the
   collection names, but it is the *only* one where the lost data has no cloud copy.

4. **`firebaseConfig` is byte-identical everywhere (§6).** It is not a risk. Isolation between
   Brandi's data and test data is **entirely** by collection name.

---

## 2. Verified inventory of scope

### 2.1 The baseline fact

```
$ git -C webbeta show 73938aa:index.html > /tmp/beta_v67.html
$ diff -u webmain/index.html /tmp/beta_v67.html | wc -l
184
$ ... | grep -c '^@@'
14
```

All 14 hunks are scaffolding/comments (enumerated in §7). **Prod v42 ≡ beta v67 functionally.**
Therefore `git -C webbeta diff 73938aa 5cba2da -- index.html` *is* the exact v68+v69+v70 feature
delta, with no unrelated drift mixed in.

### 2.2 Files other than `index.html`

| File | Required action | Verified fact |
|---|---|---|
| `sw.js` | `const CACHE = 'caretracker-v42'` → `'caretracker-v43'` | The cache constant is the **only** difference between the two repos' `sw.js`. |
| `manifest.webmanifest` | **no change** | beta differs only by branding + `theme_color` `#0F9D6B`→`#C77800` |
| `firebase-messaging-sw.js` | **no change** | only difference is fallback title `'CareTracker'`→`'ChemoWell'` (v71). Its `firebaseConfig` is byte-identical to main's. |
| `reset.html` | **no change** | branding only |
| `icon-192.png` / `icon-512.png` | **no change** | identical md5 in both repos |
| `send-reminders.js`, `.github/workflows/reminders.yml` | **no change** | beta has neither; see §8.5 |
| `README.md`, `CARETRACKER_HANDOFF.md`, `CLAUDE.md` | **must be updated in the same commit** | required by main's own checklist, `CLAUDE.md` |

---

## 3. Recommended approach

### Recommendation: **port v68/v69/v70 onto WEB-MAIN's existing file**, hunk by hunk — *not* copy-beta-and-revert.

**Reasoning, given a real patient is downstream:**

- **The failure modes are asymmetric.** Copy-and-revert makes "beta's version" the default state of
  every line; correctness then depends on remembering to revert 19 separate scaffolding items (§7).
  Missing the `COL_NAME`, `PREFS_COL_NAME` or `MED_CONFIG_STORAGE_KEY` revert is **catastrophic and
  completely silent** — the app looks perfectly normal, it just shows an empty history and writes
  new doses into the wrong collection. Porting makes "main's version" the default; the failure mode
  of forgetting something is a *missing feature* — visible, benign, fixable in a follow-up.
- **Silent-vs-loud is the entire argument.** With Brandi's medication history downstream I will
  always take "a feature is missing" over "the data pointer is wrong".
- **Porting is more auditable.** Each promoted item is independently reviewable against a known-good
  base. Copy-and-revert asks a reviewer to check a 226 KB file against a mental checklist.
- **The usual objection to porting does not apply here.** Because v42 ≡ v67 (§2.1), the three
  commits apply almost cleanly, and *the only places they conflict against main are precisely the
  scaffolding lines that must not be promoted anyway.* The tool surfaces the landmines instead of
  hiding them.

**Mechanic:**

1. `git -C webbeta diff 73938aa 5cba2da -- index.html > /tmp/v68_v70.patch`
   *(diff against `5cba2da` (v70), **not** `HEAD` — otherwise v71's rebrand hunks appear, including
   one inside `renderTestingControls`, a block that must be deleted entirely.)*
2. `git apply --3way --reject` onto a working copy of `webmain/index.html`.
3. Resolve every `.rej` manually. **Every rejected hunk should map to a row in §7.** If one does
   not, stop — the files have diverged in a way this brief did not predict, and that needs
   re-investigation before proceeding.
4. Run the §9.1 mechanical gates.

### Alternative A — copy beta's `index.html`, revert the beta-only parts

Faster; guarantees nothing is left behind. But default-unsafe, and the three highest-consequence
reverts are one-liners buried in a 226 KB file that produce **no visible symptom** when missed. If
chosen for speed, it is survivable **only** with the §9.1 gates run as a hard pre-deploy block.

### Alternative B — promote v68 only, defer v69/v70

Genuinely defensible and worth naming. v68 carries the real bug fix and the features Aaron asked
for. v69 is a UX rearrangement that introduces a reachability regression (R1). v70 carries **B1**
and the bulk-destructive half of **B2** (R2). Shipping v68 now and v69/v70 once the Firebase rules
question is settled is the lowest-risk path to value. Not the default only because Aaron asked for
all three.

---

## 4. THE THREE BLOCKERS

### 4.1 B1 — the medication editor cannot save Buspirone, Paroxetine or Iron

**Severity: blocking. New regression introduced by v70 (not present in v42).**

Three functions interact, all in `webbeta/index.html`:

`formatHour` — **line 2146**:
```js
function formatHour(hour) {
  const h = Math.max(0, Math.min(24, Number(hour) || 0));
  if (h === 0 || h === 24) return h === 24 ? 'Midnight' : '12 AM';
  return (h > 12 ? h - 12 : h) + (h >= 12 ? ' PM' : ' AM');
}
```

`medicationFormFrom` — **line 2166** (v70 changed this line to use `formatHour`):
```js
windowsText: base.windows && base.windows.length
  ? base.windows.map(window => formatHour(window.start) + '-' + formatHour(window.end) + ' ' + (window.name || '')).join(', ')
  : '8 AM-8 PM Daily',
```

`parseScheduleWindows` — **line 2202**, with `scheduleHourTo24` at **line 2195**:
```js
const match = segment.match(/^(\d{1,2})(?::\d{2})?\s*([AaPp][Mm])?\s*[-–]\s*(\d{1,2})(?::\d{2})?\s*([AaPp][Mm])?\s*(.*)$/);
if (!match) return;
```

**The defect:** `formatHour(24)` returns the literal string `'Midnight'`. The parser requires
`\d{1,2}` on both sides of the dash. `'Midnight'` cannot match. The segment is dropped, `windows`
comes back empty, and the save is rejected at **line 2238**:

> `setToast('Add at least one schedule window, for example 8 AM-12 PM Morning.'); return;`

**Which medications are affected.** Any med whose window ends at hour 24. From `DEFAULT_MEDS`
(identical in both repos — verified):

| med | windows | v70 field text | parses to |
|---|---|---|---|
| dexamethasone | 8–12, 14–18 | `"8 AM-12 PM Morning, 2 PM-6 PM Afternoon"` | OK |
| protonix | 8–12, 20–22 | `"8 AM-12 PM Morning, 8 PM-10 PM Evening"` | OK |
| **buspirone** | 10–24 | `"10 AM-Midnight Morning"` | **`[]` — BROKEN** |
| **paroxetine** | 10–24 | `"10 AM-Midnight Morning"` | **`[]` — BROKEN** |
| **iron** | 22–24 | `"10 PM-Midnight Night"` | **`[]` — BROKEN** |

v42's format (`"10:00-24:00 Morning"`, produced by `String(window.start)+':00-'+String(window.end)+':00 '`)
round-trips correctly through v42's simpler regex. **This is strictly a v70 regression.**

**Reproduction (static, re-verified now):** extract `formatHour`, `scheduleHourTo24` and
`parseScheduleWindows` verbatim from `webbeta/index.html`, feed each med's `windows` array through
`windowsText` → `parseScheduleWindows`, and compare to the input. Three of five fail.

**Reproduction (UI, previously measured — not re-run):** Meds tab → edit Iron → the "Schedule
windows" field literally reads `10 PM-Midnight Night` → tap **Save** → toast
`"Add at least one schedule window, for example 8 AM-12 PM Morning."`, editor stays open, nothing
saves. The med cannot be edited **at all** — not its name, generic name, doses, note or quick-log
flag — without the user manually retyping the window.

**Three of the five alert-tracked medications are affected.** Note also the *silent* variant: if a
med has two windows and only one ends at midnight, the unparseable segment is **dropped without any
warning** and the med saves with fewer windows — silently changing missed-dose alerting for that
med.

**Minimal fixes** (Implementer's call; first is smallest):
- In `medicationFormFrom` only, emit `'12 AM'` instead of `'Midnight'` for `end === 24`. This
  round-trips correctly (`scheduleHourTo24('12','am',isEnd=true)` → 24) and leaves the display-only
  `formatHour` call elsewhere untouched.
- Or teach `parseScheduleWindows` to accept the words `Midnight` (→24 as end, 0 as start) and `Noon`
  (→12).

---

### 4.2 B2 — `dismissedMisses` writes are rejected by Firestore Security Rules

**Severity: blocking. Documented as unresolved by beta itself. Cannot be fixed in code.**

`webbeta/BETA_HANDOFF.md` **line 584**, Known Issue #10, verbatim:

> **KNOWN BUG, unresolved as of v70 — the `dismissedMisses` field write is rejected by Firestore
> Security Rules.** Both the per-row "Clear" button […] and the new "Clear all" button […] write to
> `caretracker_test_prefs/settings.dismissedMisses` via `setDoc(..., {merge:true})`, and both fail
> with a "Could not save — check connection and try again" toast. Confirmed live (not a guess) by
> calling the Firestore SDK directly from the deployed page: writing `{missedClearedAt: ...}` to
> that same document succeeds, but writing `{dismissedMisses: [...]}` — or literally any other field
> name — returns `permission-denied`. […] **This cannot be fixed from the codebase** — modifying
> Firestore Security Rules requires access to the Firebase console for project `fuelforge-7c132`.

The two affected functions, `webbeta/index.html`:

- `dismissMissedDose(e)` — **line 110** (per-row "Clear"):
  `await setDoc(PREFS_DOC, { dismissedMisses: next }, { merge: true });`
- `clearAllMissedInHistory(now)` — **line 1196** ("Clear all"):
  same field, same doc, bulk payload.

Read-back is at **line 3077**: `setState({ ..., dismissedMisses: prefs.dismissedMisses || [] })`,
and the filter is inside `missedDosesFor`.

**Consequences for this promotion:**

1. WEB-MAIN's own documentation says production rules are *stricter*, not looser —
   `webmain/CLAUDE.md` **lines 63–67**: "Append-only: no edits to existing entries", "Junk/malformed
   writes rejected". If `caretracker_prefs` carries the analogous field allowlist (very likely — it
   predates the test collection and `missedClearedAt` was long its only field), then **per-row Clear
   (v68) and Clear all (v70) are dead on arrival in Brandi's app**, showing "Could not save — check
   connection and try again" every time.
2. **More importantly: this code path has never successfully executed anywhere.** Because the write
   always failed in beta, `state.dismissedMisses` was never populated from Firestore, so the entire
   read-back-and-filter chain is **untested against real Firestore**. It works in an offline harness;
   that is not the same claim.

**Required before deploy:** somebody with Firebase console access to `fuelforge-7c132` must open
Firestore → Rules and report the actual rule governing `caretracker_prefs/{document}`. This is an
account/security change and needs Aaron — it is not something to alter unilaterally.

---

### 4.3 B3 — `skipMissedDose` writes a new field into a rules-protected collection, unguarded

**Severity: blocking.**

`webbeta/index.html` **line 125**, verbatim:
```js
async function skipMissedDose(e) {
  await addEntryDB({ medId: e.medId, dose: null, mg: 0, ts: e.ts, skipped: true });
  setToast(nameOf(e.medId) + ' marked as skipped for ' + e.windowName + ' window');
}
```

Write payload (captured from the offline harness — *previously measured*):
`{op:'add', col:'caretracker_entries', data:{medId:'buspirone', dose:null, mg:0, ts:<window start ms>, skipped:true}}`

Two problems:

1. **`skipped` is a brand-new field name** entering a collection whose published rules explicitly
   "reject junk/malformed writes" (`webmain/CLAUDE.md:67`). If those rules validate document shape
   or allowlist fields, this write is rejected.
2. **There is no error handling.** Its sibling `dismissMissedDose` (line 110) *is* wrapped in
   try/catch with a "Could not save" toast. `skipMissedDose` has none. A rejected write becomes an
   unhandled promise rejection inside an onClick handler: no toast, no error surfaced, the row
   simply doesn't change. **Silent failure** — the caregiver believes a window was resolved when
   nothing was recorded.

This is the exact bug class this project already fixed once, in `47e3685`:
*"v51: fix silent failure on Bowel Movement Update (add error handling)"*.

**Required:** wrap in try/catch with the same failure toast as `dismissMissedDose`, **and** confirm
the `caretracker_entries` rules accept a document carrying `skipped` before deploy.

---

## 5. THE `MED_CONFIG_STORAGE_KEY` LANDMINE

**This was not on the original landmine list and should have been.** It is the same class of bug as
the collection names, and it is the **only one where the lost data has no cloud copy and no
recovery path.**

| | value |
|---|---|
| `webmain/index.html` **line 146** | `const MED_CONFIG_STORAGE_KEY = 'caretracker-medication-config-v1';` |
| `webbeta/index.html` **line 173** | `const MED_CONFIG_STORAGE_KEY = 'caretracker-testing-medication-config-v1';` |

The accompanying comment also drifted — main lines 144–145 read "intentionally browser-local
(per-device), not synced via Firestore"; beta's reads "intentionally browser-local for the testing
app."

**What this key holds.** `persistMedicationConfig` writes
`{version: 1, meds, archivedMeds}` to `localStorage`. `loadMedicationConfig` reads it back, and on a
miss silently returns `defaultMedicationConfig()`. **It is the only `localStorage` key the app uses**
— verified by grep, there are exactly two call sites, both on this constant.

**Failure mode if beta's key reaches production.** Brandi's device looks up
`caretracker-testing-medication-config-v1`, finds nothing, and falls back to `DEFAULT_MEDS`:

- any medication Aaron added via the editor **disappears**
- any medication he archived/deleted **reappears** (`archivedMeds` is in the same lost blob)
- quick-log ordering and per-med customisations reset
- the app then re-persists under the *wrong* key, so the original blob is orphaned but not deleted

**There is no Firestore copy of any of this.** Dose history is in Firestore; *configuration* is not.
The old blob technically survives in localStorage under the old key, so a knowledgeable person could
recover it via devtools — but nothing in the app will ever read it again, and a browser-data clear
destroys it permanently. Treat it as unrecoverable.

**Required value in v43:** `'caretracker-medication-config-v1'`, exactly once (gate G12, §9.1).

---

## 6. FIRESTORE COLLECTION-NAME ISOLATION

### 6.1 `firebaseConfig` is byte-identical — it is not a risk

Re-verified across all four locations: `webmain/index.html`, `webbeta/index.html`,
`webmain/firebase-messaging-sw.js`, `webbeta/firebase-messaging-sw.js`. Same project
`fuelforge-7c132`, same `apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId`,
`measurementId`, and the same VAPID key in `subscribePush`.

**Consequence: prod and test data live in the same Firebase project, separated *only* by collection
name.** There is no project-level, no auth-level, and no rules-level boundary protecting Brandi's
data from a mis-set constant. Beta's own handoff says the same thing (Known Issue #4: "isolated from
prod only by collection name, not by a separate project"). Effort belongs on §6.2, not here.

### 6.2 Exactly what must be preserved

| | WEB-MAIN (required) | WEB-BETA (must not reach prod) |
|---|---|---|
| entries | `webmain:48` `const COL_NAME = "caretracker_entries";` | `webbeta:48-49` `const TEST_MODE = true;` / `const COL_NAME = TEST_MODE ? "caretracker_test_entries" : "caretracker_entries";` |
| prefs | `webmain:98` `const PREFS_COL_NAME = 'caretracker_prefs';` | `webbeta:100` `const PREFS_COL_NAME = TEST_MODE ? 'caretracker_test_prefs' : 'caretracker_prefs';` |

**Why one line each is sufficient and necessary.** `COL_NAME` is the single source for all three
operations:
- `webmain:49` — `const col = collection(db, COL_NAME);` → drives `subscribeEntries` (read) and
  `addEntryDB` (write)
- `webmain:93` — `async function removeEntryDB(id) { await deleteDoc(doc(db, COL_NAME, id)); }` (delete)

`PREFS_COL_NAME` likewise feeds `PREFS_DOC` at `webmain:99`, which is the only prefs handle.

**Failure mode if the ternary survives with `TEST_MODE = true`:** Brandi opens her app and sees an
empty history — every dose, symptom, vital and cycle marker vanishes from her screen. Nothing is
deleted; the data sits untouched in `caretracker_entries` while the app reads and writes
`caretracker_test_entries`. Every new dose she logs is stranded in the wrong collection, mixed in
with practice data. **This is the single worst outcome available in this promotion, and it produces
no error, no warning and no console message.**

**Failure mode if `TEST_MODE = false` is left in place instead of deleting the constant:** the
collection names resolve correctly, but `subscribePush` (`webbeta:59`) and `checkNotifications`
(`webbeta:2946`) carry `TEST_MODE` guards. They would be inert with `TEST_MODE = false`, so this is
survivable — but **deleting the constant outright is strictly safer**, because it makes every
scaffolding site a hard `ReferenceError` at load rather than a silent behaviour switch. Gate G5
(`grep TEST_MODE` → 0) enforces this.

---

## 7. Beta-only scaffolding — the complete revert list

Derived from the 14-hunk v42↔v67 baseline. Line numbers are `webbeta/index.html`. Every item must
end at **WEB-MAIN's** value.

| # | Item | beta line(s) | required value in v43 |
|---|---|---|---|
| S1 | `<title>` | 11 | `Brandi's Meds / Vitals Historical` (`webmain:11`) |
| S2 | `const TEST_MODE = true;` | 48 | **delete the constant entirely** |
| S3 | `COL_NAME` ternary | 49 | `const COL_NAME = "caretracker_entries";` |
| S4 | `subscribePush()` guard | 59 | `if (!messaging) return;` (`webmain:58`) |
| S5 | `PREFS_COL_NAME` ternary + its "TEST_MODE-scoped" comment | 99–100 | `const PREFS_COL_NAME = 'caretracker_prefs';`, comment as `webmain:96-97` |
| S6 | `MED_CONFIG_STORAGE_KEY` + comment | 172–173 | `'caretracker-medication-config-v1'`, comment as `webmain:144-145` |
| S7 | `state.dateOffsetDays`, `state.testDateControlsOpen` | 288 | **remove both keys** (keep the v68–v70 additions — see §8.1) |
| S8 | `simNow()` TEST_MODE branch + "TESTING-ONLY date override" comment block | 307–316 | `function simNow() { return Date.now(); }` (`webmain:280`) |
| S9 | `setSimDate()` | 317–324 | **delete** |
| S10 | `shiftSimDate()` | 325–329 | **delete** |
| S11 | `resetSimDate()` | 330–334 | **delete** |
| S12 | Zofran comment citing `BETA_README.md` / "this repo" | 428–429 | restore `webmain:374-375` wording (cites `README.md`) |
| S13 | `renderTestingControls()` — entire function | 1211–1228 | **delete** |
| S14 | `⚠ BETA` pill in header | 1241 | `null` (as `webmain:1090`) |
| S15 | `⚠ BETA — practice data only, not real records` banner | 1254 | `null` (as `webmain:1103`) |
| S16 | `renderTestingControls()` call site | 1255 | `null` (as `webmain:1104`) |
| S17 | banner comment naming `caretracker_test_prefs` | 1622 | `caretracker_prefs` |
| S18 | `checkNotifications()` — `if (TEST_MODE) return;` | 2946 | **delete the line.** `webmain:2613` must keep local reminders live. |
| S19 | SW-update comment rewritten for the testing app | 3107–3109 | restore `webmain:2774-2776` wording |

**Plus v71 rebrand strings** (`ChemoWell`, `BETA`, `Beta date controls`) — none of which should reach
main. I found **no compelling reason to rename Brandi's app**: it would change the PWA name on her
home screen and the push-notification title mid-treatment for zero functional benefit.

---

## 8. What v68–v70 changes about Firestore data

### 8.1 New state keys (in-memory)

Promote from `webbeta:288`: `dismissedMisses: []`, `chemoCalOpen: false`, `chemoCalCursor: null`,
`historyMissedOnly: false`. **Do not promote** `dateOffsetDays` or `testDateControlsOpen` (S7).

### 8.2 New field on entries: `skipped: true`

Written **only** by `skipMissedDose` (`webbeta:125`). **No new `medId` values are introduced** —
`skipMissedDose` reuses the med's own id, and `logPeriodForDay` reuses `cycle_start`, `cycle_end`,
`inpatient_start`, `inpatient_end`, all of which already exist in v42.

### 8.3 New field on the prefs doc: `dismissedMisses`

Array of `"medId|ts"` strings (`missKey`, `webbeta:105`), merged into the existing
`caretracker_prefs/settings` alongside `missedClearedAt`. ~20 bytes/key; no realistic path to the
1 MB document limit. `setDoc(..., {merge:true})` is atomic, so a rejected `dismissedMisses` write
cannot corrupt `missedClearedAt`. **See B2.**

### 8.4 Backward/forward compatibility

**Existing entries remain readable, unconditionally.** All new fields are optional and every read is
defensive (`e.mg || 0`, `e.pills || 0`, `e.dose ? … : …`, `prefs.dismissedMisses || []`). **No
migration runs on load** — I verified there is no code path in either file that rewrites, backfills
or reshapes an existing document. Beta's handoff reaches the same conclusion (Known Issue #9,
`BETA_HANDOFF.md:577`): "a doc without these fields just behaves as empty/default… no separate
migration step needed".

**If Brandi opens a cached OLD (v42) copy afterwards — it still works.** Three cosmetic
degradations, no crash, no data loss:

- a `skipped` entry renders as a normal dose row with no dose text (v42 has no `e.skipped` branch)
- it counts toward the History day's "N doses" total (v42 lacks the `!e.skipped` filter)
- per-row/bulk-dismissed misses reappear (v42 doesn't read `dismissedMisses`)

It degrades **safely** in the direction that matters: `mg: 0` and no `pills` key means a skipped
entry contributes **zero** to every ceiling (`dailyDoseMg`, `dailyPills`, `dailyGroupMg`,
`rollingDoseMg`), so it can never cause an under-count that lets a real overdose through. And
`status()` (`webmain:481`) treats a window as satisfied by `es.some(e => e.ts >= ws && e.ts < we)`;
a skipped entry sits exactly at `ws`, so v42 shows the window as handled — same as v43. This matters
because stale service-worker caching is a documented recurring failure mode in this project.

### 8.5 Server-side: `send-reminders.js`

The GitHub Actions cron queries `caretracker_entries` for `medId == 'protonix'` and treats **any**
matching entry in a time range as "Protonix was logged" (`protonixMorningLogTs` /
`protonixEveningLogTs`). It has no notion of `skipped`, so marking a Protonix window Skipped writes
a phantom "dose" the cron reads as real.

In practice the impact is small **only because** the skipped entry's `ts` equals the window start,
which coincides with the cron's static fallback anchor (8 AM → 10 AM target; 8 PM → 10 PM target),
so the derived reminder time matches the static fallback and still fires. **But that holds only while
Protonix keeps its default hours.** If Aaron edits Protonix's schedule, skipped-entry timestamps move
and the dynamic target diverges from the static fallback — reminders can be missed. Worth a follow-up
comment or a `skipped` filter in `send-reminders.js`. **Not a v43 blocker**, but the Auditor should
confirm reminders still fire after a Skipped action.

---

## 9. Other confirmed findings (Auditor must test)

### R1 — v69 makes most past missed doses unreachable *(previously measured)*

`renderHistory` builds its day list from `dmap`, which only contains days with **at least one
entry**. Days where nothing was logged produce **no History row at all**, so their missed doses
cannot be seen or resolved there. Meanwhile `pastMissedCount` (`webbeta:474`) walks **every calendar
day** since `MISSED_TRACK_SINCE` (Jul 12 2026, `webmain:380`).

Measured in the harness with 3 days of seeded entries:
- pinned header card: **"162 missed doses from previous days"** → "Update missed doses"
- tap it → History toggle reads **"Missed Doses (12)"**

Same data, two numbers 13× apart, one click apart. In v42 all of those misses were at least *listed*
in the Home banner text (`webmain:1325-1341`); v69 replaces that with a count-only card linking to a
view that cannot show them. **Information visible in v42 becomes unreachable in v69.**

### R2 — "Clear all" dismisses far more than it displays *(previously measured)*

`clearAllMissedInHistory(now)` (`webbeta:1196`) walks **every calendar day**, not the filtered
`historyDays`. Same harness run: the view showed **12**; tapping **Clear all** wrote **161** keys and
toasted **"161 missed doses cleared"**.

A one-tap, cross-device, persistent dismissal of an entire backlog the caregiver was never shown —
including genuinely missed doses — with no undo in the UI. **I consider this the most user-hostile
behaviour in the promotion set.** Either scope it to the rendered rows, or add a confirm step showing
the true count. (Note: while B2 is unresolved, this button fails anyway — which is currently the only
thing preventing it from firing.)

### R3 — v68's coverage change is a real fix *and* a real regression *(previously measured)*

`missedDosesFor` was rewritten from a two-pass to a single ordered pass (`webbeta:446-457`, replacing
`webmain:395-407`). Differential test, running the function extracted verbatim from **both** files on
identical inputs:

```
DIFFER | protonix single dose 19:00, now 21:00   v42=[protonix:Morning]  v68+=[]
DIFFER | protonix single dose 19:00, now 23:00   v42=[protonix:Morning]  v68+=[protonix:Evening]
DIFFER | dex-like doses 13:00+15:00, now 19:00   v42=[dex:Morning]       v68+=[]          <-- intended fix
DIFFER | dex-like single dose 13:00, now 19:00   v42=[dex:Morning]       v68+=[dex:Afternoon]
  same | protonix nothing,          now 23:00    both=[protonix:Morning, protonix:Evening]
  same | protonix 8:05 + 20:10,     now 23:00    both=[]
```

Row 3 confirms the intended fix works. **Row 1 is a genuine regression:** logging an early-evening
Protonix at 7 PM makes a genuinely missed 8 AM Protonix **stop being flagged**, until 10 PM when it
reappears under the wrong window name. Root cause: a window's late-catch-up range now extends all the
way to the next window's opening — 8 hours for Protonix (12:00 → 20:00).

Not a blocker (the per-day *count* of missed windows was unchanged in every case found; only
attribution and flag timing shift), but the Auditor must test it. A cap such as
`min(nextStart, we + 4h)` is worth considering as a follow-up.

### R4 — In-Patient "+" can silently swallow the currently-active stay

v68 changed the In-Patient "+" to always open the Start+End period form, including while a stay is
**Active**. `inpatientPeriods()` (`webmain:952`) overwrites an open period's `start` when a second
`inpatient_start` arrives before any `inpatient_end`. The beta code explicitly guards the "still
ongoing" path against this but **not** the Start+End path.

Failure case: a stay is Active (started Monday); use "+" to record a past stay ending *after* Monday.
Sorted by `ts` the events become `[retroStart, activeStart, retroEnd]` → `activeStart` overwrites
`retroStart`, then `retroEnd` closes it. The retroactive start becomes invisible in the UI and the
Active stay is silently closed in the past.

Also a capability loss: v42's "+" while Active logged a backdated `inpatient_end`. v68 removes that,
so **there is no longer any way to backdate the End of the current stay** — the main button logs at
`now` only.

### R5 — `pastMissedCount()` runs every second, cost grows quadratically *(previously measured)*

`setInterval(..., 1000)` calls `render()` every second (`webmain:2761`). v69 places
`pastMissedCount(now)` inside `renderHeader`, so it runs on **every tab**, every second. It walks
every calendar day since Jul 12 2026; each day calls `missedDosesFor`, which calls `isInpatientDay`
(a full `state.entries` scan **plus** a filter+sort of all entries, `webmain:979`/`952`) and
`entriesFor()` once per alerting med.

Measured (Node, desktop — a phone is materially slower):

| elapsed | entries | ms per call, once per second |
|---|---|---|
| 33 d | 396 | 2.1 |
| 90 d | 1,080 | 11.4 |
| 180 d | 2,160 | 39.5 |
| 365 d | 4,380 | **153.0** |

**Fair framing: v42 already pays this cost** — the same walk lives in `renderToday`
(`webmain:1325-1332`). v69 does not create the problem; it **moves it from the Home tab to every
tab**. Not a v43 blocker, but a real and growing battery/jank cost on Brandi's phone. Memoise per
`(entries.length, dayStart(now))` before it becomes one.

### R6 — `state.historyMissedOnly` is sticky

Once `goToHistoryTop()` (`webbeta:1186`) sets it, History stays filtered until the user taps "Show
all". Opening Reports → History normally afterwards shows a filtered view with no explanation.
In-memory only, so a reload clears it. Cosmetic; worth a release note.

---

## 10. THE EVIDENCE GAP

Beta's changelog credits substantial regression coverage for exactly the versions being promoted
(`BETA_README.md` version-history rows for v68/v69/v70):

- v68 — "All 12 existing regression suites re-run clean … plus a new 12-check suite
  (`test_v68_batch.js`)"
- v69 — "New regression suite (`test_v69_missed_scope.js`, 9 checks) plus all 14 prior suites re-run
  clean"
- v70 — "New regression suite (`test_v70_batch.js`, 28 checks: parser round-trip including the 12 AM
  start-vs-end midnight edge case …) plus all 14 prior suites re-run clean"

**None of these files exist.** Verified against the fresh clone:

```
$ ls webbeta | grep -i test_v
(nothing)
$ git -C webbeta log --all --pretty=format: --name-only | grep -ci "test_v"
0
```

Zero — not in the working tree, and **never committed to the repository at any point in its
history**. Nothing can be re-run, re-read, or extended.

**This matters most for B1.** v70's changelog specifically claims a "parser round-trip including the
12 AM start-vs-end midnight edge case". That claim is consistent with having tested
`parseScheduleWindows("… 12 AM …")` *in isolation* — which does parse correctly — and never having
round-tripped through `medicationFormFrom` → `formatHour`, which is where `'Midnight'` is produced.
The one test that was claimed to cover this exact edge is the test that would have caught the bug,
and it does not exist.

**Consequence for stage 2/3:** treat v68–v70 as **unverified work**, not as QA'd work awaiting
promotion. There is no inherited test coverage to lean on. Everything in §11 must be executed fresh.

---

## 11. DEFINITION OF DONE

Runnable without asking me anything. **Use an offline harness** — do not point a browser at
production Firestore to test. (Method: copy `index.html`, rewrite the three
`gstatic.com/firebasejs/10.12.0/*` imports to a local ES-module stub implementing
`initializeApp/getFirestore/collection/doc/query/orderBy/onSnapshot/addDoc/deleteDoc/setDoc/getDocs`
plus `getMessaging/getToken/onMessage` over an in-memory store; serve on 127.0.0.1:8911; verify the
served md5 matches the file on disk before trusting anything; drive with Playwright using
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy` and `127.0.0.1`, never `localhost`.
This worked in the original session and the app renders fully interactive offline.)

### 11.1 Mechanical gates — 19, all must pass before any behavioural testing

```
G1  webmain/sw.js contains exactly:  const CACHE = 'caretracker-v43';
G2  diff of webmain/sw.js against v42 shows ONLY that one line changed
G3  manifest.webmanifest, reset.html, firebase-messaging-sw.js, icon-192.png, icon-512.png
    are byte-identical to their v42 versions (md5)
G4  grep 'caretracker_test'                          index.html  -> 0 matches
G5  grep 'TEST_MODE'                                 index.html  -> 0 matches
G6  grep 'caretracker-testing-medication-config-v1'  index.html  -> 0 matches
G7  grep -i 'chemowell'                              index.html  -> 0 matches
G8  grep 'BETA'                                      index.html  -> 0 matches
G9  grep 'setSimDate\|shiftSimDate\|resetSimDate\|renderTestingControls\|dateOffsetDays\|testDateControlsOpen'
                                                     index.html  -> 0 matches
G10 grep -c '"caretracker_entries"'                  index.html  -> exactly 1
G11 grep -c "'caretracker_prefs'"                    index.html  -> exactly 1
G12 grep -c "'caretracker-medication-config-v1'"     index.html  -> exactly 1
G13 <title> is exactly:  Brandi's Meds / Vitals Historical
G14 simNow() is exactly: function simNow() { return Date.now(); }
G15 checkNotifications() does NOT begin with an early return
G16 subscribePush() begins:  if (!messaging) return;
G17 the <script type="module"> body passes `node --check` as ESM; zero console errors on load
G18 firebaseConfig in index.html is byte-identical to the one in firebase-messaging-sw.js
    and to v42's
G19 README.md + CARETRACKER_HANDOFF.md + CLAUDE.md updated in the same commit, including a
    v43 row and documentation of the `skipped` and `dismissedMisses` fields
```

### 11.2 Behaviours that must work — 19

```
D1   Home renders; existing entries appear in Today's Journal and History.
D2   Every date choice uses the in-app month-grid calendar, not a native date/datetime-local
     wheel: med log, temp, weight, symptom, Cycle "+", In-Patient "+", Chemo Schedule.
     Month < > navigation works; today is outlined; selected day is filled.
D3   Cycle "+" opens a Start + End form. Submitting writes exactly TWO entries (cycle_start at
     the chosen start, cycle_end at the chosen end). Cycle History shows one complete period.
D4   Cycle/In-Patient "+" with "Still ongoing" ticked writes ONE start entry, and is REJECTED
     with a clear message if the chosen start precedes an existing entry of the same pair.
D5   "End must be after Start" is enforced. A future start or end triggers the double-confirm.
D6   Every missed-dose row (banner, History, Today's Journal) shows three buttons:
     Took later / Skipped / Clear.
D7   "Took later" opens the log modal pre-filled to the missed window's time, bypassing the
     lock (unchanged from v42's logMissedDose).
D8   "Skipped" writes one entry {medId, dose:null, mg:0, ts:<window start>, skipped:true}; the
     row disappears from banner/History/Journal; Journal and History render a muted "Skipped"
     badge with "Marked as not given"; it is EXCLUDED from the History day "N doses" count.
     **On write failure it must show an error toast** (B3).
D9   Per-row "Clear" writes dismissedMisses to <prefs>/settings and the row disappears
     everywhere. On failure: "Could not save - check connection and try again".
D10  Today's missed banner lists TODAY'S misses only - never a previous day.
D11  With unresolved misses on previous days, the sticky header shows "N missed dose(s) from
     previous days" + "Update missed doses", on EVERY tab, staying visible while scrolling.
D12  Tapping the pinned card, or the Today banner body, opens History scrolled to top with the
     "Missed Doses (N)" filter active. "Show all" returns to the full list.
D13  Tapping the Today banner's "Clear" dismisses today's banner WITHOUT navigating.
D14  History day headers show an "In-Patient" badge on days inside a logged stay.
D15  The time modal fits a 390x844 viewport: date pickers collapsed behind a "Mon, Jul 20"-style
     pill by default; opening Start collapses End and vice versa; Cancel and Confirm reachable
     without the page scrolling away.
D16  A long toast ("Dexamethasone marked as skipped for Afternoon window") wraps inside the
     pill; no text escapes the rounded rectangle.
D17  Medication editor shows and accepts 12-hour windows ("8 AM-12 PM Morning") AND still
     accepts plain 24-hour digits ("8-12 Morning").
D18  **B1 GATE:** open the editor for Buspirone, Paroxetine and Iron in turn, change nothing,
     tap Save. All three MUST save successfully. Re-open each and confirm the window is
     unchanged (10:00-24:00 / 22:00-24:00 internally).
D19  Symptoms dropdown offers Nausea, Vomiting, Fatigue, Mouth Sores, Neuropathy, Headache,
     Dizziness, Skin Reaction/Rash, Other. Pre-existing diarrhea/constipation symptom entries
     still render correctly in history.
```

### 11.3 Regressions that must NOT happen — 15

```
N1   No "TESTING"/"BETA" badge, banner or date-control strip anywhere in the UI.
N2   No date-override controls; the displayed date always tracks the real system date.
N3   Existing entries still appear. Entry count after deploy >= entry count before.
     Cross-check against the nightly backup CSV (CLAUDE.md:83-86).
N4   New logs land in caretracker_entries. Prefs land in caretracker_prefs.
N5   Brandi's device-local medication config survives: custom meds present, archived meds still
     archived, quick-log order unchanged. Verify in a browser profile that already has
     caretracker-medication-config-v1 populated.
N6   Push and local notifications still fire (checkNotifications NOT short-circuited;
     subscribePush still registers an FCM token).
N7   Zofran remains blocked 3 days (chemo day + 2). No promoted comment or code may reintroduce
     the v61/v62 2-day error.
N8   48-hour Remove lock unchanged; BYPASS_48H_IDS unchanged.
N9   Tylenol 2500 mg shared ceiling, Tylenol Liquid 90 mL/24h, Morphine rolling 15 mg/4h,
     Lidocaine 4 applications/day, Imodium 4 pills/day all behave as in v42.
N10  Protonix-linked dynamic windows unchanged: Iron opens 2h after the logged evening Protonix
     (default 10 PM); Buspirone/Paroxetine 2h after the logged morning Protonix (default 10 AM).
N11  In-Patient days still suppress missed-dose flags entirely.
N12  MISSED_TRACK_SINCE stays Jul 12 2026 - no retroactive flags before it.
N13  R3 check: with only one Protonix dose logged at 7 PM and the 8 AM window empty, the app
     must still surface a missed dose for that day (it may be labelled Evening). It must not
     show "no missed doses".
N14  R4 check: with an In-Patient stay Active, use "+" to log a past stay whose End is after the
     active Start. The Active stay must not silently disappear or close itself.
N15  No console errors on load or during any of D1-D19.
```

---

## 12. Data safety

### 12.1 What could destroy or orphan Brandi's data

| # | mechanism | severity | prevented by |
|---|---|---|---|
| DS1 | `COL_NAME` left as the ternary → app reads/writes `caretracker_test_entries`. Entire history vanishes from her screen; new doses stranded in the wrong collection. Nothing deleted, but the app is effectively dead. **Silent.** | **Catastrophic** | G4, G5, G10, D1, N3, N4 |
| DS2 | `PREFS_COL_NAME` left as the ternary → `missedClearedAt` resets, acknowledged misses resurface. | Moderate | G4, G11, N4 |
| DS3 | `MED_CONFIG_STORAGE_KEY` left as the testing key → localStorage med config orphaned; custom meds vanish, **archived meds reappear**. **No cloud copy.** | **High** | G6, G12, N5 |
| DS4 | `skipped` rejected by entries rules → silent no-op (B3). Caregiver believes a window is resolved when nothing was recorded. | High | B3 fix, D8 |
| DS5 | `dismissedMisses` rejected by prefs rules (B2) → two permanently failing buttons. | Moderate | B2 resolution, D9 |
| DS6 | "Clear all" dismisses 161 while displaying 12 (R2). Persistent, cross-device, no undo. | High | R2 fix / confirm step |
| DS7 | R4 — retroactive In-Patient period swallows an active stay. Entry survives in Firestore; UI stops showing it. | Moderate | N14 |
| DS8 | SW cache not bumped → devices keep serving v42 from cache (documented failure mode). | Moderate | G1 |

### 12.2 What must be true for data loss to be impossible

- **Collection names.** Exactly one unconditional `"caretracker_entries"` and one
  `'caretracker_prefs'`, with no `TEST_MODE` identifier anywhere in the file. One constant governs
  read, write and delete (§6.2), so getting those two lines right is necessary *and* sufficient.
- **Document shapes.** One new optional field (`skipped`). No existing document is ever modified or
  rewritten. Every consumer reads defensively.
- **No migration on load** — verified.
- **ID handling.** IDs are Firestore auto-IDs from `addDoc`; the client never sets one.
  `subscribeEntries` maps `{id: d.id, ...d.data()}`. Deletion is
  `deleteDoc(doc(db, COL_NAME, id))`, reachable only from `removeBtn`, hidden past 48 h and
  additionally blocked by rules. `clearAllDB` was removed in v19 and remains absent from beta —
  **there is no bulk-delete path in either file** (verified by grep: the only `deleteDoc` call sites
  are `removeEntryDB` and the FCM-token cleanup in `send-reminders.js`).
- **Prefs writes** are `merge: true`, never overwrite; a rejected write is atomic.
- **Backup.** `webmain/CLAUDE.md:83-86` describes a nightly CSV snapshot that flags any drop in entry
  count. **Take a manual snapshot immediately before deploy and diff the count immediately after.**
  Highest-value safety net available, and it costs nothing.
- **Rollback.** Deploy is GitHub Pages from the repo. Rollback = revert the commit **and bump the
  cache again** (`caretracker-v44`) — reverting to `caretracker-v42` will not invalidate the `v43`
  cache on devices that already fetched it. Send anyone stuck to `reset.html`.

---

## 13. Where I think the framing of this task was wrong

1. **"Copy beta's file and revert the beta-only parts" was presented as the obvious default.** Given
   v42 ≡ v67, it is the *less* safe option, not merely the more convenient one (§3).
2. **The brief treated v68–v70 as finished, QA'd work.** It is not: v70 shipped a regression blocking
   editing of three of five alert-tracked meds (B1); v70's own changelog documents an unresolved
   Firestore-rules failure affecting two of its features (B2); and every regression suite the
   changelog credits **does not exist and never did** (§10).
3. **`firebaseConfig` was listed as a landmine; it is not one.** Byte-identical everywhere. Isolation
   is 100% by collection name — effort belongs on S3/S5/S6, not on config comparison.
4. **`MED_CONFIG_STORAGE_KEY` was not on the landmine list and should have been.** Same class as the
   collection names, and the only one whose data has no cloud copy (§5).
5. **"v71 is rebrand only" is accurate, and I found no reason to promote it.** But note v71 also
   edited a label *inside* `renderTestingControls` — a block that must be deleted entirely. Diff
   against `5cba2da`, not `HEAD`, or that appears as a spurious hunk.
6. **This promotion is bigger than "behaviour and fixes."** v69 restructures where missed-dose
   information lives, making some of it unreachable (R1), and v70 adds a one-tap bulk dismissal
   acting on 13× more data than it displays (R2). That is a product decision about how a cancer
   patient's missed medications reach her caregiver. It should not ship on the strength of "it landed
   in beta" — it needs an explicit yes from Aaron.

---

## 14. Suggested sequencing for the Implementer

1. Get Aaron's answer on the Firestore rules for `caretracker_prefs` **and** `caretracker_entries`
   (B2, B3). This gates whether three of the new buttons work at all.
2. Fix B1 (`medicationFormFrom` midnight round-trip) — smallest possible change.
3. Add try/catch to `skipMissedDose` (B3).
4. Decide on R2 (scope "Clear all" to displayed rows, or add a confirm showing the true count).
5. Port per §3, resolving each `.rej` against the §7 table.
6. Bump `sw.js` to `caretracker-v43`; update the three docs.
7. Take a manual Firestore CSV snapshot.
8. Run the §11.1 gates, then hand to the Auditor for §11.2 / §11.3 on the offline harness.
9. Deploy; re-count entries against the snapshot; verify on the live site with zero console errors.

*R1, R4, R5, R6 and the `send-reminders.js` note (§8.5) are recorded as follow-ups, not v43
blockers.*
