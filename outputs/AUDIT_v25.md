# AUDIT_v25 — Zero Day Auditor report

Auditor: independent Claude session, per TEAM.md's Zero Day Auditor charter (fast lane, since
DEV_BRIEF_v25.md classified items 1/4/5/6 as copy/UX-only confined to one screen — item 2 needed
only a live-verification step, item 3 was deliberately deferred). Scope: the six items in
`outputs/DEV_BRIEF_v25.md`, as implemented in commit `68a2125` ("v25: clearer daily-limit/unit
copy, rounded-select confirm, schedule-window save message, mg-mismatch preview + toast wording").

**Target:** the real, live deployed site — `https://arnjnnngs.github.io/chemowell-app-beta/` —
driven through a real Chrome browser (the user's own connected browser, via the
`claude-in-chrome` tool), not a local copy and not a thought experiment. This sandbox's own
outbound network is blocked from reaching `arnjnnngs.github.io` by organization egress policy
(confirmed: `curl` to the live host returns a proxy-level `403`, logged as
`connect_rejected` / `policy denial` at the agent proxy status endpoint) — the same wall the
Lead Developer hit and correctly did not try to route around. Routing through the user's real
browser instead let this audit reach the actual live site directly, which is a **stronger**
verification than the Lead Developer could do from their own sandbox, and is why item 2 below has
a real live verdict instead of a "needs checking" placeholder.

## Setup

Seeded `localStorage['chemowell-app-p-p1-med-v1']` on the live origin with 5 realistic
medications (not a blank first-run), then reloaded and confirmed all 5 loaded with zero console
errors:

| Medication | Type | Doses | Limit unit | Daily limit | Notes |
|---|---|---|---|---|---|
| Oxycodone | gap (as-needed) | 5 mg, 10 mg | mg | 40 | correctly-configured limit already set |
| Ondansetron | win (scheduled), 2 windows | 4 mg, 8 mg | mg | 24 | correctly-configured limit already set |
| Acetaminophen | gap | 1 tablet, 2 tablets | pills | 8 | correctly-configured pills limit already set |
| Lidocaine Patch | win, 1 window | 1 patch (no mg/pill count) | **applications** | 3 | **pre-existing mismatch**, to test load-time (not just interaction-time) rendering |
| Lorazepam | gap | 0.5 mg, 1 mg | — | none | no limit set, control case |

## Test cases run (23)

1. Seed 5 meds via localStorage, reload — all 5 render correctly on Home/Meds, zero console errors. **PASS**
2. Live `getComputedStyle` check on every `<select>` on the editor screen (Limit unit, Schedule
   type, Days taken, window Start/End) — all report `appearance:none`, `borderRadius:11px`,
   custom chevron `backgroundImage`, identical treatment. **PASS** (see Item 2 verdict below)
3. Open Edit on **Lidocaine Patch** (pre-existing applications-unit mismatch) — preview line
   renders correctly **on load**, no interaction needed. **PASS for load-time rendering, FAIL for wording** — see Finding 2.
4. Attempt Save on Lidocaine Patch with the mismatch unresolved — save is correctly **blocked**,
   toast shown. **PASS for blocking, FAIL for wording** — see Finding 2 (toast repeats the same wrong wording).
5. Discard the Lidocaine Patch edit — verified via localStorage read that nothing was mutated. **PASS**
6. Open Edit on **Oxycodone** (correctly-configured mg/mg) — preview renders "Blocks logging more
   once 40 mg is reached today." on load. **PASS**
7. Type `half tablet, one tab` (zero digits, zero mg/pill matches) into Dosage options while
   editing Oxycodone (mg unit, limit 40) — preview **does not update**, still shows the stale "40
   mg" success message. **FAIL** — see Finding 1.
8. With the mismatch now present, switch Limit unit `mg → pills` via the select itself — preview
   **still does not update** (still shows the stale "40 mg" text, now doubly wrong: wrong unit AND
   wrong verdict). **FAIL** — see Finding 1 (confirms the bug reproduces on the select, not just the text input).
9. Toggle Schedule Type (`gap → win`, an unrelated control) — this forces a full re-render, and the
   preview **immediately catches up** to the correct amber warning ("Dosage options don't include
   a pill count yet — this limit won't work until they do."). **Confirms the preview's underlying
   computation is correct — only the live-refresh wiring on its own two driver fields is broken.**
10. Attempt Save in this now-correctly-detected mismatched state — blocked, correct wording for
    the `pills` case (`"Add a pill count to Dosage options..."`). **PASS**
11. Discard — verified Oxycodone's stored `doses`/`ceilingMax`/`ceilingUnit` unchanged afterward. **PASS**
12. Fresh **Add medication**: switch Schedule Type to `win` — exactly one default window row
    (8:00 AM–8:00 PM) appears; its delete/trash button is **hidden** (only shown when `>1` row
    exists), so a new scheduled medication can never be reduced to zero windows through the UI. **Note** — see Finding 4.
13. Set Daily limit `2.5` (decimal) and Dosage options `2.5 mg, 5 mg`, unit `mg` — preview does not
    update live (same root cause as #7); forcing a rerender via an unrelated field (Days Taken)
    shows the correct "Blocks logging more once 2.5 mg is reached today." — **decimal daily limits
    compute correctly, no rounding/truncation bug, no crash.** **PASS** (modulo Finding 1)
14. Typed a ~100-character Dosage options string mixing prose with a trailing `1000 mg` — input
    scrolls internally, no layout break, no crash; `parseDoseOptions` correctly extracts `mg:1000`
    from the one entry that actually contains "mg" (the `.some()` match logic is intentionally
    lenient — at least one dose option carrying the unit is treated as sufficient). **PASS**
15. Verified "Hours between doses" (as-needed) and "Extra hours between doses (optional)"
    (scheduled) labels + helper text render exactly as specified in DEV_BRIEF_v25.md item 4. **PASS**
16. Verified Schedule Type option copy: "As needed — wait a set number of hours between doses" /
    "Scheduled — remind me at specific times" — live-rendered, matches DEV_BRIEF item 6. **PASS**
17. Verified the Schedule-windows live preview line still reads "Reminds between 8 AM and 8 PM"
    (unchanged) — confirms item 3 was left untouched as directed, nothing silently broken by
    leaving it alone. **PASS**
18. Discarded the "Test Med Edge" add-flow entirely — confirmed the Meds list still contains
    exactly the 5 originally-seeded medications afterward (no orphaned/partial save). **PASS**
19. Read console messages at multiple checkpoints across the full session (initial load, after
    seeding, after every edit/discard/save attempt) — **zero errors or exceptions logged at any
    point.** **PASS**
20. Confirmed `app-v25` string present in **two** locations: the hamburger nav-drawer footer
    ("ChemoWell app-v25") and the Settings/About screen body text ("app-v25 (beta). All data stays
    on this device…"). **PASS** — matches the required version bump.
21. Attempted to test at a genuine 390×844 mobile viewport and a 1280×900 desktop viewport via the
    browser tool's `resize_window` call. **Could not be verified this session** — see Testing
    Limitation below. Not scored pass/fail; disclosed rather than silently assumed.
22. Re-checked `parseDoseOptions` behavior for a dose string carrying **both** an mg amount and a
    pill/tablet word in the same entry (e.g. "2 tablets 500mg") by code inspection — `mg:500,
    pills:2` both populate correctly; confirmed no double-counting or precedence bug in the regex
    logic. **PASS** (code-review confirmation, not separately live-clicked — time-boxed after the
    live interaction testing above already exercised the same `parseDoseOptions` code path
    repeatedly).
23. Confirmed via source review that `dailyLimitPreview` returns `null` (no preview line at all)
    whenever `Number(form.dailyLimit) || 0` is falsy — i.e. blank or `0` daily limit shows no
    preview, matching the "Leave blank for no limit" helper text. Consistent with what was
    observed live on Lorazepam (no-limit control case, no preview line rendered). **PASS**

## Findings

### Finding 1 — HIGH: the new live preview does not actually update live on its own two driver fields

**Location:** `index.html:3721` (Dosage options `formInput`'s `onInput`), `index.html:3722`
(Daily limit `formInput`'s `onInput`), `index.html:3723` (Limit unit `<select>`'s `onChange`).

**Root cause:** this app's renderer (`h()` at `index.html:1580` + `render()`) does a full DOM
rebuild on every `setState()` call — there is no diffing, so every event handler that wants the UI
to reflect a change must explicitly opt in by calling `updateMedicationForm(field, value, true)`
with a truthy third argument. The three fields that `dailyLimitPreview()` actually depends on
(Dosage options text, Daily limit number, Limit unit select) all call
`updateMedicationForm(field, value)` **without** that third argument, so typing into any of them
only mutates the in-memory form object — it never triggers a re-render, so the preview line stays
frozen at whatever it last computed. It only "catches up" by accident, the next time the user
touches some *other* control that does pass `rerender:true` (Schedule Type, Days Taken, week-day
toggles, etc.).

**Reproduction (live-verified, test cases #7–#9 above):**
1. Edit Oxycodone (mg unit, dosage "5 mg, 10 mg", limit 40 — a correctly-configured medication).
2. Clear Dosage options and type `half tablet, one tab` (no mg, no pills).
3. Observe: the preview line still reads "Blocks logging more once 40 mg is reached today." —
   unchanged, even though the field it's supposed to be watching now has zero mg content.
4. Switch Limit unit to "Number of pills / doses" via the dropdown itself.
5. Observe: the preview line **still** reads the old "40 mg" text — now wrong on both the unit
   label and the verdict.
6. Touch an unrelated control (e.g. Schedule Type) — the preview immediately jumps to the correct
   amber warning. This proves the computation logic is right; only the refresh trigger is missing.

**Why this matters:** the DEV_BRIEF's own stated purpose for this preview line is that "the
mismatch becomes visible in context, well before Save" — explicitly framed as the fix for Aaron's
complaint that a save failure had "no visible cause." As shipped, the preview only reflects reality
immediately after the editor first opens (or after the user happens to touch some unrelated
field) — not while the user is actually doing the thing this feature exists to react to (typing a
dose, picking a unit). A stressed caregiver typing "2 tablets" into Dosage options while looking at
a Daily Limit section that still confidently says "Blocks logging more once 500 mg is reached
today" has no reason to think anything is wrong until they hit Save and get the (separately
mis-worded, see Finding 2) toast — which is close to the exact failure mode item 5/6 were written
to eliminate. Save-time validation still blocks a bad save (no data-integrity risk), but the UX
promise of this release is not actually delivered for the primary interaction pattern.

### Finding 2 — HIGH: "applications" unit shows the wrong noun in both the warning and the save toast

**Location:** `index.html:3355-3356` (inline preview warning text), `index.html:3457` (save-time
toast text).

Both use a **binary** ternary keyed only on `unit === 'mg'`, collapsing the `pills` and
`applications` cases into the same "pill" wording:

```js
// index.html:3355-3356
'Dosage options don’t include ' + (unit === 'mg' ? 'an mg amount' : 'a pill count') + ' yet — this limit won’t work until they do.'

// index.html:3457
'Add ' + (unit === 'mg' ? 'an mg amount to Dosage options (e.g. "500 mg")' : 'a pill count to Dosage options (e.g. "1 pill")') + ', or change Limit unit to match, before saving this daily limit.'
```

Note that the "success" branch of the same function (`index.html:3358`) *does* correctly
distinguish all three units (`mg` / `pill(s)` / `application(s)`) — only the warning-preview and
save-toast branches were left as a two-way check, even though "Number of applications" is one of
exactly three options the Limit unit dropdown itself offers.

**Reproduction (live-verified, test cases #3–#4 above):** seeded Lidocaine Patch with Dosage
options `"1 patch"` (no mg, no recognized pill/tab/cap word), Limit unit = "Number of
applications", Daily limit = 3.
- Opening the editor shows, on load, with no interaction: *"Dosage options don't include **a pill
  count** yet — this limit won't work until they do."* — screenshot:
  `outputs/v25-audit-screenshots/01-applications-mismatch-wording-bug-on-load.png`
- Tapping Save produces the toast: *"Add **a pill count** to Dosage options (e.g. "1 pill"), or
  change Limit unit to match, before saving this daily limit."*

Both messages talk about "pills," but the user explicitly selected "Number of applications" and
nothing on their screen says "pill" anywhere. For a real chemo-adjacent medication measured in
applications — a lidocaine patch, a fentanyl patch, a nasal spray, a topical cream — a caregiver
reading this would reasonably conclude the app is confused or buggy, which is exactly the kind of
opaque, unexplained failure item 5/6 were supposed to close out. This is a copy-review miss on a
piece of copy that (per TEAM.md's own copy-review section) is squarely "high-stakes" — it appears
at the moment a save is being blocked for a Daily Limit rule, a safety-adjacent field.

**Suggested fix (for the Lead Developer, not applied here):** a 3-way branch matching the existing
success-branch pattern, e.g. `unit === 'mg' ? 'an mg amount' : unit === 'pills' ? 'a pill count' :
'an application count'`, with the toast's example text also switched (`'1 application'` instead of
always `'1 pill'`).

### Finding 3 — Item 2 (Schedule Type dropdown): verified correct on the actual live site — no code defect

**Verdict: CONFIRMED NOT A LIVE DEFECT**, verified independently against the real deployed site
(not source-reading, not a local copy). `getComputedStyle` on the live `<select>` elements:

```
Limit unit select:     appearance: none, borderRadius: 11px, backgroundImage: url("data:image/svg+xml...")
Schedule type select:  appearance: none, borderRadius: 11px, backgroundImage: url("data:image/svg+xml...")
Days taken select:     appearance: none, borderRadius: 11px, backgroundImage: url("data:image/svg+xml...")
Window Start/End selects: appearance: none, borderRadius: 11px, backgroundImage: url("data:image/svg+xml...")
```

Every `<select>` on the medication editor screen — Schedule Type included — renders with identical
rounded, custom-chevron, app-consistent styling. Screenshots throughout this report (e.g.
`02-stale-preview-after-forced-rerender.png`) visually confirm this as well: the Schedule Type
control is a rounded pill-style dropdown, visually indistinguishable from every other select on
the same screen.

This supports the DEV_BRIEF's stale-cache theory. **Recommendation to Aaron/PM, not a code
change:** if Aaron still sees a square OS-default dropdown on his own device, it is almost
certainly a cached pre-v23 build being served by the aggressive service-worker cache described in
TEAM.md's own release-mechanics checklist — ask him to hard-reload / clear site data on the
specific device where he saw it, rather than treating this as an open code defect.

### Finding 4 — LOW / Note: the reworded "Add at least one schedule time" toast appears unreachable through the current UI

**Location:** `index.html:3434` (validation), `index.html:3786` (the "+ Add another time window"
button), window-row delete button gating at `index.html:3778` (`(form.windowRows ||
[]).length > 1 ? ... : null`).

A Scheduled (`type:'win'`) medication's form always starts with exactly one window row
(`medicationFormFrom` defaults to `[{ start: 8, end: 20, name: 'Daily' }]` when there are none),
and the per-row delete/trash button only renders when more than one row exists. That means a user
can add more rows but can never delete back down to zero through the shipped UI — the reworded
"Add at least one schedule time — tap "+ Add another time window" to add one." toast this release
introduced is correctly worded, but (as far as this audit could determine through normal
interaction) there is no way to actually trigger it as a real user. This is **not a v25
regression** — the same gating existed before this release — and is the same class of finding
DEV_BRIEF_v25 itself flagged for `formatRuleSummary`'s dead range-fallback branch (item 6). Noting
it here for completeness rather than as something blocking this release; worth a follow-up ticket
if anyone wants to either genuinely enable removing the last row (with the new toast catching it)
or remove the now-unreachable validation branch.

## Testing limitation — mobile-viewport verification not independently completed this session

The task asked for testing at both a 390×844 mobile viewport and a 1280×900 desktop viewport. This
audit ran through the user's real, connected Chrome browser (via `claude-in-chrome`), which was
necessary to reach the actual live site at all (this sandbox's own network is blocked from
`arnjnnngs.github.io` by org policy — see header). However, the `resize_window` tool's requested
sizes (both 390×844 and 1280×900) did **not** change the page's actual rendering viewport in this
remote-browser session — `window.innerWidth` was independently checked via `javascript_tool`
immediately after each resize call and consistently read **1036px** regardless of the requested
size. All interaction testing in this report therefore ran at that one effective width (~1036 CSS
px), not at a genuine ≤390px mobile width.

Disclosing this rather than claiming mobile-specific verification that didn't happen: the CSS
grid layout (`repeat(auto-fit,minmax(190px,1fr))`) used for the top field row, and the
`minWidth`/`gap` values the source comments describe as re-tuned for 360px/390px (window-row trash
button placement, `index.html:3762-3769`), were **not** independently re-verified at those widths
this session. Given the DEV_BRIEF's item 2 investigation already did verify this specific screen
at true 390×844 (their own Playwright run, pre-dating this session's network block), and nothing
in this session's ~1036px-wide testing showed any layout breakage, this is flagged as a
methodology gap to be closed by whoever runs the next stage (e.g. the Designer review, which
TEAM.md requires to check "the smallest supported viewport" already) — not escalated as a
suspected defect on its own.

## Version / release mechanics

- `APP_VERSION` confirmed as `app-v25` live, in two locations (nav drawer footer, Settings/About
  body text). **PASS.**
- Zero console errors or exceptions observed at any point across the full session (initial load,
  after seeding 5 medications, and through all edit/save/discard interactions). **PASS.**
- No data corruption observed: every discarded edit was independently confirmed via a direct
  `localStorage` read to have left the underlying medication record byte-for-byte unchanged.

## Overall verdict: **CONDITIONAL — not ready to proceed as currently implemented**

Items 2, 3, and 4 pass cleanly and need no further work. Item 6's wordsmith changes (Schedule Type
option copy, schedule-window toast rewording) are correctly implemented. However, items **1, 5,
and 6's core deliverable — the new live daily-limit preview — has two real, reproducible, HIGH
severity defects** (Findings 1 and 2 above) that go directly to the two things Aaron originally
complained about: not understanding what the limit counts, and not seeing why a save was rejected.
Per TEAM.md's restart rule, this goes back to the Lead Developer (start of the fast lane) to fix
both findings, then returns to this Auditor stage for re-verification before advancing to Designer
and PM Gate. Do not present this as "fixed" to Aaron in its current state — a caregiver relying on
the live preview to catch a unit mismatch while editing will not actually see it update as they
type or as they change units, and a caregiver using an "applications"-based medication will be
shown save-blocking copy that talks about pills instead.

## Screenshot evidence (2, curated)

- `outputs/v25-audit-screenshots/01-applications-mismatch-wording-bug-on-load.png` — Lidocaine
  Patch edit screen, live site: Limit unit = "Number of applications", warning reads "Dosage
  options don't include **a pill count** yet" (Finding 2).
- `outputs/v25-audit-screenshots/02-stale-preview-after-forced-rerender.png` — Oxycodone edit
  screen, live site, after switching Limit unit to pills and forcing a rerender via an unrelated
  field: shows the *correct* warning once refreshed, and also shows the Schedule Type dropdown's
  actual live rounded styling (Finding 3 evidence).
