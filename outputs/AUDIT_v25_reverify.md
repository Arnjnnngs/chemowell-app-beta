# AUDIT_v25_reverify — Zero Day Auditor RE-VERIFICATION report

Auditor: independent Claude session, re-verification pass per TEAM.md's restart rule. Did not
write the fix under test; treated commit `4a2c8dd` ("v25 audit fix: live daily-limit preview now
refreshes while typing/changing unit, applications-unit wording corrected") as unproven until
independently reproduced on the real product.

**Target:** the real, live deployed site — `https://arnjnnngs.github.io/chemowell-app-beta/` —
driven through a real Chrome browser (the user's own connected browser, via `claude-in-chrome`).
Confirmed at the start of this session that this sandbox's own outbound network is still blocked
from reaching `arnjnnngs.github.io` (`curl` → `CONNECT tunnel failed, response 403`), same as the
prior audit found, so all testing below ran against the actual live site through the user's real
browser, not a local copy.

## Setup

Reused the same live-origin `localStorage` seed the prior Zero Day Auditor pass (AUDIT_v25.md) had
already planted in the connected browser (`chemowell-app-p-p1-prefs-v1` with a completed
patient-name setup, `chemowell-app-p-p1-med-v1` in the correct `{version:1, meds:[...],
archivedMeds:[]}` shape) — verified its contents directly via `localStorage.getItem(...)` before
relying on it, confirming the same 5 medications as before (Oxycodone mg/mg correctly-configured,
Ondansetron mg/mg, Acetaminophen pills, Lidocaine Patch applications-unit mismatch, Lorazepam no
limit). Reloaded the live site on top of this data and confirmed all 5 medications render with zero
console errors before starting interaction testing. No first-run guide overlay appeared (tour was
already marked done in the seeded prefs).

## Source cross-check (before live testing)

Read the actual shipped source at the pinned commit to know precisely what to probe:
- `index.html:3348-3351` — `updateMedicationForm` now accepts a `rerender` third argument and calls
  `setState()` when truthy.
- `index.html:3761-3763` — Dosage options `onInput`, Daily limit `onInput`, and Limit unit
  `onChange` all now pass `true` as that third argument, and all three now carry a stable `id`
  (`med-doses-text`, `med-daily-limit`, `med-daily-limit-unit`).
- `index.html:2312-2336` — new focus/cursor-preservation block in `render()`: before the
  `root.innerHTML = ''` rebuild, records `document.activeElement`'s `id` (only for
  INPUT/SELECT/TEXTAREA) and `selectionStart`/`selectionEnd`; after the rebuild, re-queries by id,
  calls `.focus()`, and tries `setSelectionRange()` inside a `try/catch` that silently swallows any
  exception (comment explicitly names `type="number"` as a case where this throws).
- `index.html:3381` / `index.html:3488` — both wording branches rewritten from a 2-way `unit ===
  'mg'` ternary to a 3-way branch (`mg` / `pills` / else `applications`), matching the pattern the
  success-branch already used.

This matched what the commit message and DEV_BRIEF claimed. The `try/catch` around
`setSelectionRange` was the one piece of the description that looked like it might be papering over
something rather than fully solving it — that's exactly where live testing found a new defect (see
Finding A below).

## Re-verification of Finding 1 (live preview didn't update live) — **PASS for 2 of 3 driver
fields, FAIL for the third (new regression)**

1. Opened Edit on Oxycodone (mg unit, "5 mg, 10 mg", limit 40 — correctly configured). Preview read
   "Blocks logging more once 40 mg is reached today." on load, as expected.
2. Clicked into **Dosage options**, selected all, deleted, then typed `half tablet, one tab`
   character-by-character in one continuous real-keyboard action (not a bulk value-set). Result:
   - The full string `half tablet, one tab` (20 characters) landed in the field, not truncated.
   - `document.activeElement.id` was still `med-doses-text` after typing — **focus was not lost**.
   - `selectionStart`/`selectionEnd` were both `20` (end of string) — **cursor did not jump**.
   - The preview line updated **live, with no other field touched**, to "Dosage options don't
     include an mg amount yet — this limit won't work until they do." **PASS.**
3. With that mismatch still present, switched **Limit unit** `mg → pills` via the select itself
   (`form_input` on the live `<select>`). Preview updated **immediately** to "...a pill count..."
   with zero extra interaction. **PASS** — confirms the select's own `onChange` now also
   rerenders live.
4. Cleared Dosage options again and typed `5 mg, 10 mg` back in, live, with no other field touched:
   preview flipped back to "Blocks logging more once 40 mg is reached today." in the same
   continuous session. **PASS** — live update works in both directions, not just one.
5. Repeated the same live-typing test on the **Limit unit** select via genuine keyboard
   interaction (native `<select>` focused, arrow keys, `Return`/`Escape`) rather than
   `form_input`, cycling `applications → mg → pills → applications → pills` — preview updated
   correctly and instantly after every change, ending on the correct "8 pills" wording for
   Acetaminophen with no visual break. **PASS.**
6. **Daily limit** (the third driver field) — **FAIL, new regression, not present before this
   fix.** See Finding A.

### Finding A — HIGH (new regression introduced by this fix): typing into "Daily limit" scrambles
digit order because the shipped cursor-preservation logic silently fails on `type="number"` inputs

**Location:** `index.html:2321-2336` (the new focus/cursor-preservation block in `render()`),
interacting with `index.html:3762` (`formInput({ id: 'med-daily-limit', type: 'number', ... })`).

**Root cause:** Chrome (and per the code's own comment, some other browsers) throws when
`setSelectionRange()` is called on an `<input type="number">`:
```
Failed to execute 'setSelectionRange' on 'HTMLInputElement': The input element's type ('number')
does not support selection.
```
Confirmed directly via `el.setSelectionRange(1,1)` on the live `#med-daily-limit` element — this
error is thrown every single time. The new focus-preservation code catches this exception (comment
at `index.html:3333` acknowledges the case) and does nothing further — it does **not** fall back to
any other cursor-restoration strategy. Because Daily limit's `onInput` now passes `rerender:true`
(the whole point of this fix), **every keystroke triggers a full DOM rebuild**, and after each
rebuild the number input's cursor silently resets to whatever position Chrome defaults a freshly
re-focused `type="number"` input to — observed to consistently be position 0 (start of string), not
the position the user was actually typing at. The result: every keystroke after the first inserts
at the **start** of the existing value instead of continuing from where the user left off.

**Reproduction (live-verified, real keyboard input):**
1. Edit Oxycodone, click Daily limit, select-all, Delete (field now empty, "No limit" placeholder).
2. Type `2` → field shows `2` (cursor after it, as expected for the first keystroke into an empty
   field).
3. Type `5` next (as a completely separate keystroke, verified via a screenshot taken between the
   two) → field now shows **`52`**, not `25`. The `5` was inserted before the `2`, not after it.
4. Type `7` next → field now shows **`752`** — fully reversed insertion order, one full digit
   scrambled per keystroke.
5. Repeated from a clean field with the single most realistic real-world value a caregiver would
   type — `40` (matches this exact medication's actual pre-existing limit) — result: field shows
   **`04`**. `Number('04')` is `4`, not `40` — **an order-of-magnitude-wrong daily limit**, and the
   live preview (this whole feature's purpose) confidently confirms it: *"Blocks logging more once
   4 mg is reached today."* — no error, no warning, nothing to indicate anything went wrong.
6. Also reproduced with a decimal entry (`2.5` → typed field ends up `5.2`) and confirmed pressing
   `End` before the second keystroke does **not** help — the cursor is forced back to position 0 by
   the *next* rerender regardless of where the user just placed it.
7. Confirmed this is specific to the Daily limit field (`type="number"`) — the Dosage options field
   (`type="text"`, step 2 above) and the Limit unit `<select>` (step 3/5 above) do **not** exhibit
   this problem; typing into them in real time works correctly and in order. `setSelectionRange`
   is fully supported on both of those element types in Chrome, so the new cursor-restore code
   actually succeeds for them.

**Why this is severity HIGH, not a minor annoyance:** Daily limit is exactly the safety-relevant
number this whole release exists to make trustworthy — TEAM.md itself names "Daily Limit rule" as
safety-adjacent. A caregiver typing `40` (or any 2+ digit / decimal value) into this field now gets
a **silently wrong number saved**, with the live preview — the very feature built to increase
trust — actively confirming the wrong number back to them in plain language. This is strictly worse
than the pre-fix behavior (where the preview was merely stale, not actively lying about a
successfully-typed value), and it is a **direct consequence of this fix**, not a pre-existing issue
— Daily limit did not rerender-on-keystroke before commit `4a2c8dd`, so this exact interaction
pattern did not exist prior to this change. On-screen (screenshot-verified), the number is visibly
scrambled while typing, so an attentive user has a chance to notice and correct it before Save —
but the design intent of a live-typing experience is specifically to *not* require the user to
carefully re-read a field after every keystroke.

**Not applicable to Findings 1/2's original scope**, but disqualifies calling item 5/6's live
preview feature reliable across all three of its driver fields as shipped. Two of the three
(Dosage options, Limit unit) are genuinely fixed; the third (Daily limit) has a new, live,
reproducible defect that did not exist before this fix and blocks calling Finding 1 fully resolved.

## Re-verification of Finding 2 (applications-unit wording) — **PASS, no regression found**

1. Opened Edit on **Lidocaine Patch** (pre-existing applications-unit mismatch: dosage "1 patch",
   no recognized application/pill count, Limit unit = "Number of applications", limit 3). On load,
   with zero interaction, the inline warning correctly read: *"Dosage options don't include **an
   application count** yet — this limit won't work until they do."* No "pill" wording anywhere.
   **PASS.**
2. Tapped **Save changes** with the mismatch unresolved. Save was correctly blocked, and the toast
   read: *"Add **an application count** to Dosage options (e.g. "1 application"), or change Limit
   unit to match, before saving this daily limit."* Also correctly uses "application," not "pill,"
   and the parenthetical example was updated too (`"1 application"`, not the old `"1 pill"`).
   **PASS.**
3. Discarded the edit; verified via direct `localStorage` read that Lidocaine Patch's stored
   record (`windows`, `doses`, `ceilingMax`, `ceilingUnit`) was byte-for-byte unchanged afterward —
   no data corruption from the blocked-save attempt. **PASS.**
4. Spot-checked the **mg** case (Oxycodone, correctly configured): success message reads "Blocks
   logging more once 40 mg is reached today." — correct, no regression.
5. Spot-checked the **pills** case (Acetaminophen, correctly configured): success message reads
   "Blocks logging more once 8 pills are reached today." — correct plural/verb agreement, no
   regression. Also re-triggered the pills-mismatch warning live (by switching Limit unit away and
   back) and confirmed it still reads "...a pill count..." correctly, distinct from the
   applications wording. No cross-contamination between the three branches.

**Finding 2 is genuinely, fully resolved.** Both the inline warning and the save-blocking toast use
correct three-way wording for mg / pills / applications, verified live for all three units, with no
regressions in the two units that were already correct before this fix.

## Additional regression / edge-case testing (broader pass, per Zero Day Auditor charter)

- **Blank Daily limit:** cleared the field entirely — no preview line rendered (matches "Leave
  blank for no limit" helper text and the documented `Number(form.dailyLimit) || 0` falsy check).
  **PASS**, no regression.
- **`0` Daily limit:** typed `0` into a cleared field — no preview line rendered, consistent with
  blank. **PASS.**
- **Decimal Daily limit:** see Finding A — the *typing* is broken (`2.5` → `5.2`), but this is the
  same digit-order bug, not a separate decimal-specific defect; the underlying `dailyLimitPreview`
  computation itself handles decimals correctly (the corrupted `5.2` value produced a coherent,
  correctly-formatted preview sentence, just for the wrong number).
- **Rapid unit-switching:** cycled Limit unit through `applications → mg → pills → applications →
  pills → mg` in quick succession via both `form_input` and genuine keyboard arrow-key interaction
  on the native `<select>` — preview updated correctly after every single change, no stale state,
  no visual glitch, no console error at any point.
- **Discard mid-typing (data-integrity check):** after every single interaction test above that
  modified a field (Oxycodone x3 separate edit sessions, Acetaminophen, Lidocaine Patch), clicked
  **Discard** and independently re-read the affected medication's record directly from
  `localStorage` — in every case the stored `doses`/`ceilingMax`/`ceilingUnit`/`windows` were
  unchanged from before the edit. No data corruption anywhere in this session, including from the
  Finding A digit-scrambling bug (nothing was ever saved while the field held a scrambled value).
- **Console errors:** checked at multiple points (fresh load, after each edit/save-attempt/discard
  cycle, after rapid unit-switching) via `read_console_messages` with no filter — **zero errors or
  exceptions logged at any point in this entire session.**
- **Version / release mechanics:** confirmed "ChemoWell app-v25" still present in the nav-drawer
  footer on the live site. No separate version bump for this fix commit, which is consistent with
  it being a same-release audit-fix loop (the prior AUDIT_v25.md pass under the same `app-v25`
  label is what sent this back for rework), not a new user-facing release.
- **Visual/copy sanity:** the "Daily limit" / "Limit unit" preview line and the Dosage options /
  Daily limit / Limit unit fields all render with the same rounded-input, app-consistent visual
  treatment observed in the prior audit; no stray browser-default styling introduced by this fix.
  Copy in both the inline warning and the toast reads clearly and in plain language appropriate for
  a non-technical caregiver — no jargon, no run-ons.

## Overall verdict: **CONDITIONAL — Finding 2 is resolved; Finding 1 is only partially resolved**

| Finding | Verdict |
|---|---|
| **Finding 1** (live preview doesn't refresh while typing/changing unit) | **PARTIAL / CONDITIONAL.** Genuinely fixed for **Dosage options** (text input) and **Limit unit** (select) — both now update the preview live, with focus and cursor position correctly preserved, verified via real continuous keyboard typing. **Not fixed** for **Daily limit** — the same fix introduces a **new** HIGH-severity regression there: typing multi-character or decimal values into this `type="number"` field scrambles digit order (e.g. typing `40` saves as `04`) because the new cursor-preservation logic silently fails (catches and ignores a `setSelectionRange` exception Chrome throws for number inputs) and does not fall back to any alternative restoration strategy. This is worse than the original bug for this specific field, because the live preview now actively confirms a corrupted number back to the user instead of merely staying stale. |
| **Finding 2** (applications-unit wording) | **CONFIRMED RESOLVED.** Both the inline warning and the save-blocking toast correctly say "an application count" / "1 application" when Limit unit is "Number of applications," verified live on load and at save-time. mg and pills cases spot-checked with no regression. |

Per TEAM.md's restart rule, this goes back to the Lead Developer to fix Finding A (the Daily limit
cursor-preservation gap) before this can be presented as done — likely fix direction: either (a)
change the Daily limit input's `type` to `text` with `inputmode="decimal"` and numeric validation
(text inputs support `setSelectionRange` reliably), or (b) special-case the cursor-restore logic for
`type="number"` inputs to compute and reapply an equivalent numeric-string cursor offset instead of
relying on `setSelectionRange`. Do not present Finding 1 as fully closed to Aaron in its current
state — the two originally-reported driver fields for the preview (Dosage options, Limit unit) now
work correctly, but the third (Daily limit) has a new, real, reproducible defect that can cause a
caregiver to silently save a wrong daily medication limit.

## Screenshot evidence (curated)

Screenshots were captured throughout this session via the browser tool but not saved to disk in
this sandbox (network-isolated from the live site; testing ran entirely through the user's
connected browser). Key observations were instead confirmed via direct `localStorage` reads and
`document.activeElement`/`selectionStart` JS checks quoted verbatim above, which are reproducible
by any future session using the same live-origin seeded data.
