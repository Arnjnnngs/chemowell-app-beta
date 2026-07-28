# AUDIT_v25_reverify2 — Zero Day Auditor THIRD-PASS re-verification report

Auditor: independent Claude session, third independent pass per TEAM.md's restart rule. Did not
write the fix under test (commit `6e9f45e`, "v25 re-verify fix: Daily limit + treatment-day fields
no longer scramble digits while typing"); treated it as unproven until independently reproduced on
the real product. Read `outputs/AUDIT_v25.md` and `outputs/AUDIT_v25_reverify.md` in full before
testing, per this stage's brief — this report re-tests exactly what those two flagged, plus does
its own broader pass per the Zero Day Auditor charter.

**Target:** the real, live deployed site — `https://arnjnnngs.github.io/chemowell-app-beta/` —
driven through a real Chrome browser (the user's own connected browser, via `claude-in-chrome`).
Confirmed at the start of this session that this sandbox's own outbound network is still blocked
from reaching `arnjnnngs.github.io` (`curl` → `CONNECT tunnel failed, response 403`, same
`connect_rejected` / policy-denial pattern both prior audits hit), so all testing below ran
against the actual live site through the user's real browser, not a local copy.

## Setup

The connected browser already held the live-origin `localStorage` seed from the two prior audit
passes. Verified its contents directly via `localStorage.getItem(...)` rather than trusting it —
confirmed the correct real schema (`{version:1, meds:[...], archivedMeds:[]}`, each medication
using `doses:[{label,mg,pills}]` and `ceiling:true, ceilingMax:<number>,
ceilingUnit:'mg'|'pills'|'applications'`, never flat `dosesText`/`dailyLimit`/`dailyLimitUnit`
fields) and the same 5 medications as both prior reports:

| Medication | Type | Doses | Limit unit | Daily limit | Notes |
|---|---|---|---|---|---|
| Oxycodone | gap (as-needed) | 5 mg, 10 mg | mg | 40 | correctly-configured limit; primary Finding A test subject |
| Ondansetron | win (scheduled), 2 windows | 4 mg, 8 mg | mg | 24 | correctly-configured limit |
| Acetaminophen | gap | 1 tablet, 2 tablets | pills | 8 | correctly-configured pills limit |
| Lidocaine Patch | win, 1 window | 1 patch (no mg/pill count) | applications | 3 | pre-existing mismatch, Finding 2 test subject |
| Lorazepam | gap | 0.5 mg, 1 mg | — | none | no limit set, control case |

Reloaded the live site (`?v=reverify2b` cache-buster) on top of this data and confirmed all 5
medications render with **zero console errors or console messages of any kind** before starting
interaction testing. Patient-name setup ("Day One Test") was already complete from the prior
sessions' seeding; no first-run overlay appeared.

## Source cross-check (before live testing)

Confirmed live, via `javascript_tool`, that the shipped fix matches the commit message's claim:
- `#med-daily-limit`: `type="text"`, `inputMode="decimal"` (was `type="number"` at the time of
  Finding A).
- `#med-treatment-days-before` and `#med-treatment-days-after` (the two fields the Lead Developer
  proactively fixed even though neither prior audit tested them): `type="text"`,
  `inputMode="numeric"`.

All three are genuinely text inputs now, so `setSelectionRange()` — the call that threw on
`type="number"` and was silently swallowed by the round-2 fix's cursor-preservation `try/catch`,
producing Finding A — is fully supported and should no longer throw.

## Re-verification of Finding A (Daily limit digit-scrambling regression) — **PASS, fully resolved**

All typing below was done as **real, separate keystroke actions** (not bulk value-sets), matching
the exact reproduction pattern from `AUDIT_v25_reverify.md`.

1. Opened Edit on Oxycodone (mg unit, limit 40). Selected the field, deleted it, typed `4` then `0`
   as two separate keystrokes. Result: field read **`40`**, not `04`. `selectionStart` was `2`
   (end of string) after each keystroke — cursor never reset to 0. `document.activeElement.id`
   stayed `med-daily-limit` throughout — focus never dropped. Live preview correctly updated to
   "Blocks logging more once 40 mg is reached today." after each keystroke. **PASS** (this is the
   exact repro that produced `04` in the round-2 audit; it no longer reproduces).
2. Cleared and typed `1`, `2`, `5` as three separate keystrokes → field read **`125`** in order,
   preview read "...125 mg...". **PASS.**
3. Cleared and typed `2`, `.`, `5` as three separate keystrokes (decimal case, the specific one
   round-2 found reversed to `5.2`) → field read **`2.5`** in order, preview read "...2.5 mg...".
   **PASS.**
4. Cleared and typed `0`, `.`, `5` → field read **`0.5`** in order, preview correct. **PASS.**
5. Cursor-position correctness beyond append-only typing: with the field at `0.5` and cursor at
   the end, pressed `Home` (cursor → position 0) and typed `1` → field became **`10.5`**, cursor
   at position 1 (i.e., inserted *before* the existing text, not appended or scrambled). **PASS**
   — confirms the fix isn't just "always append," it genuinely preserves arbitrary cursor
   position across the rerender.
6. Mid-string edit test: typed `1`,`2`,`5` → `125`; pressed `Left` once (cursor → position 2);
   pressed `Backspace` → field became **`15`**, cursor at position 1 (correctly removed the `2` in
   the middle, not the last character). Then typed `9` at that same position → field became
   **`195`**, cursor at position 2 (correctly inserted between `1` and `5`). **PASS** — real
   mid-string backspace-then-insert works with correct text-input semantics.
7. Paste-style bulk insertion test (via `document.execCommand('insertText', ...)`, which fires the
   same `input` event a real paste does, as opposed to setting `.value` directly which would
   bypass the app's `onInput` handler entirely): selected the field, inserted `999` in one bulk
   operation → field read **`999`** correctly, preview updated to "...999 mg...". **PASS** — the
   fix isn't fragile to non-keystroke input paths either.
8. Cross-field rerender interaction: with Daily limit mid-edit at `16` (typed via two separate
   keystrokes), switched **Schedule Type** from "As needed" to "Scheduled" via the select (a
   different field entirely, forcing a full-form rerender that also reveals/hides other fields
   like Schedule Windows). After the rerender: Daily limit still read **`16`**, preview correctly
   read "Blocks logging more once 16 pills are reached today.", zero console errors, and the newly
   revealed Schedule Windows section rendered correctly. **PASS** — cross-field forced rerenders no
   longer clobber the Daily limit field's value.
9. Full save-cycle integrity check (not just DOM display): on Oxycodone, typed `4`,`5` (two
   keystrokes) into a cleared Daily limit field → field showed `45` → clicked **Save changes** →
   read `chemowell-app-p-p1-med-v1` directly from `localStorage`: `ceilingMax: 45`. **Confirmed the
   correct typed number actually persists**, not just displays correctly in the DOM. Then repeated
   the process to restore the original `40` and re-confirmed via `localStorage` that it saved back
   correctly as `40` (not `04`). **PASS.**

**Verdict: Finding A is fully resolved.** No scrambling, no cursor reset, no focus loss, across
plain integers, decimals, prepend-at-start, mid-string backspace/insert, paste-style bulk input,
cross-field forced rerenders, and a real end-to-end save-and-verify-in-localStorage cycle.

## Re-verification of the two proactively-fixed fields (Days before/after treatment) — **PASS**

Neither prior audit tested these; the Lead Developer fixed them proactively as sharing the same
latent bug pattern (`rerender:true` + what was `type="number"`). Tested them directly:

1. On Oxycodone, selected "Only near treatment day" under Treatment-Day Availability, which reveals
   **Days before treatment** and **Days after treatment**, both defaulting to `1`. Confirmed via
   JS both are `type="text"`, `inputMode="numeric"`.
2. Cleared **Days before treatment**, typed `1`, `2` as separate keystrokes → field read **`12`**
   correctly, focus retained. **PASS.**
3. Cleared **Days after treatment**, typed `3`, `0` as separate keystrokes → field read **`30`**
   correctly. Re-checked **Days before treatment** at the same time — still correctly held `12`,
   confirming the two fields' independent rerenders don't cross-contaminate each other. **PASS.**
4. The live preview line for this section ("Active window: 12 days before through 30 days after
   treatment day.") updated correctly and immediately, live, with no other field touched — this
   section has its own live-preview wiring that also works correctly. **PASS**, bonus confirmation
   beyond what was strictly asked.
5. Discarded this edit; verified via direct `localStorage` read that Oxycodone's stored record
   (`ceilingMax`, `doses`, and no orphaned treatment-day fields) was unchanged. **PASS.**

## Re-verification of Finding 1's original scope (Dosage options text + Limit unit select) — **PASS, no regression**

1. On Lidocaine Patch (pre-existing applications mismatch), cleared Dosage options and typed
   `1 application` as a real keystroke sequence — the live preview updated, with zero other field
   touched, from the mismatch warning to "Blocks logging more once 3 applications are reached
   today." **PASS.**
2. Confirmed (via the cross-field rerender test in Finding A item 8 above) that the Limit unit
   select's live-update behavior is undisturbed by this fix — switching Schedule Type still
   triggers a correct, live-consistent rerender across all fields.

Both driver fields round-2 already confirmed working (Dosage options, Limit unit) remain working;
this pass found no regression introduced by the Finding-A fix.

## Re-verification of Finding 2 (applications-unit wording) — **PASS, no regression**

1. Opened Edit on Lidocaine Patch (dosage "1 patch", no recognized application count, Limit unit =
   "Number of applications", limit 3). On load, with zero interaction, the inline warning correctly
   read: *"Dosage options don't include **an application count** yet — this limit won't work until
   they do."* No "pill" wording. **PASS.**
2. Tapped **Save changes** with the mismatch unresolved. Save was correctly blocked; the toast
   read: *"Add **an application count** to Dosage options (e.g. "1 application"), or change Limit
   unit to match, before saving this daily limit."* **PASS.**
3. Discarded; verified via direct `localStorage` read that Lidocaine Patch's stored record
   (`doses`, `ceilingMax`, `ceilingUnit`, `windows`) was byte-for-byte unchanged. **PASS.**
4. Spot-checked the mg case (Oxycodone: "Blocks logging more once 40 mg is reached today.") and the
   pills case (Acetaminophen: "Blocks logging more once 8 pills are reached today." on load, "...16
   pills..." live after editing) — both correct, no cross-contamination between the three wording
   branches. **PASS.**

## Additional regression / edge-case testing (broader pass, per Zero Day Auditor charter)

- **Console errors:** checked via `read_console_messages` with an unrestricted pattern at multiple
  checkpoints across the entire session (initial load, after every edit/save/discard/paste/rapid-
  switch interaction) — **zero errors, warnings, or any console messages of any kind logged at any
  point in this entire session.**
- **Data-integrity across every discard:** every single edit-then-discard cycle in this session
  (Oxycodone ×4 separate sessions, Ondansetron, Acetaminophen, Lidocaine Patch ×2) was followed by
  a direct `localStorage` read confirming the affected record's `doses`/`ceilingMax`/
  `ceilingUnit`/`windows` were unchanged from before the edit. No corruption anywhere, including
  from fields that briefly held garbage test values (`195`, `999`, `10.5`) mid-session — nothing
  was ever saved while a field held a throwaway test value.
- **Real save-and-restore round trip:** Oxycodone's Daily limit was actually saved as `45`
  (verified in `localStorage`, verified the Meds-list card re-rendered "Daily limit 45 mg"), then
  restored to `40` via the same real-typing-then-save flow (verified in `localStorage` again). This
  is a stronger check than DOM-only verification — it confirms the fixed field's value round-trips
  correctly through the actual persistence layer, not just the on-screen display.
- **Cross-field forced rerender under active edit:** switching Schedule Type (As needed ↔
  Scheduled) while Daily limit held a freshly-typed, not-yet-saved value did not lose or corrupt
  that value, and did not crash or error despite the rerender also mounting/unmounting the Schedule
  Windows section entirely.
- **Version / release mechanics:** confirmed "ChemoWell app-v25" still present in the nav-drawer
  footer on the live site — no separate version bump for this fix, consistent with round-2's own
  precedent (an audit-fix loop within the same `app-v25` release, not a new user-facing release).

## Overall verdict: **PASS — ready to advance to Designer / PM sign-off per TEAM.md's fast-lane chain**

| Item | Verdict |
|---|---|
| **Finding A** (Daily limit digit-scrambling regression) | **CONFIRMED FULLY RESOLVED.** Real character-by-character typing of integers, decimals, prepend-at-start, mid-string backspace/insert, and paste-style bulk input all land correctly, in order, with cursor and focus preserved across every rerender. A real save-then-localStorage-verify round trip confirms the correct number persists (typed `45`, saved `45`; typed `40`, saved `40` — never scrambled). |
| **Days before/after treatment** (proactively fixed, never tested by either prior audit) | **CONFIRMED WORKING**, same fix pattern, same rigor of testing, no cross-contamination between the two fields, live preview line for this section also correct. |
| **Finding 1** (Dosage options / Limit unit live update, original scope) | **CONFIRMED STILL RESOLVED**, no regression from this fix. |
| **Finding 2** (applications-unit wording) | **CONFIRMED STILL RESOLVED**, no regression from this fix, both the inline warning and save-blocking toast correct for all three units (mg/pills/applications). |
| **Console errors** | Zero, at any point across the full session. |
| **Data integrity** | No corruption in any discard or save cycle tested. |

This is a genuinely clean re-verification — no new findings, nothing manufactured to appear
thorough. Commit `6e9f45e`'s fix (switching the three affected fields from `type="number"` to
`type="text"` with the appropriate `inputMode`) directly addresses Finding A's root cause
(`setSelectionRange()` throwing on `type="number"` in Chrome) rather than papering over it, and
this session's testing — including cases the prior two audits didn't try (mid-string
backspace/insert, prepend-at-cursor-position-0, paste-style bulk insertion, cross-field forced
rerender mid-edit, and full save/localStorage round-trip verification) — found nothing wrong with
it. Per TEAM.md's fast-lane chain, this should now proceed to the Designer stage (quick visual
pass, since the UI did change — three fields' underlying input type) and then to PM sign-off as an
independent pass, not to another Auditor loop.
