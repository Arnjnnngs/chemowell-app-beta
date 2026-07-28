# DEV_BRIEF_v25 — Medication editor Dosage/Schedule screen, 6 Aaron-reported issues

Author: Developer stage (Full Chain, TEAM.md). Investigation + brief only — no code changed.
Scope: `renderMedicationEditor()` (`index.html:3679-3792`) and everything it reads/writes.

All 6 items below were investigated by reading the source directly, and item 2 was additionally
verified empirically with a headless-Chromium render (Playwright) of the actual editor screen at
390px, seeded with a real `type:'win'` medication, to settle a factual question rather than guess.
Screenshot: `/tmp/med_editor.png` (not committed — regenerate via the script noted in item 2 if
needed).

---

## 1. Daily Limit unit ambiguity

**Exact current UI** (`index.html:3700-3701`):

```js
h('label', null, fieldLabel('Daily limit', 'Blocks logging more doses once this many are reached
  for the day. Leave blank for no limit.'),
  formInput({ type: 'number', ..., placeholder: 'No limit', ... })),
h('label', null, fieldLabel('Limit unit'),
  h('select', { value: form.dailyLimitUnit, ... },
    h('option', { value: 'mg' }, 'mg'),
    h('option', { value: 'pills' }, 'pills'),
    h('option', { value: 'applications' }, 'applications')))
```

Two separately-labeled, stacked fields: a bare number input under "Daily limit" and a bare
3-option `<select>` under "Limit unit" with no helper text at all (the only field on this screen
with no second-line explanation — every sibling field has one). Default for a brand-new
medication is `'mg'` (`medicationFormFrom`, `index.html:3304`: `dailyLimitUnit: base.ceilingUnit ||
'mg'`), regardless of how the user is about to fill in Dosage options.

**Root cause:** the two fields read as two independent questions ("how many?" / "pick a unit,
whatever that means here") instead of one sentence. "Limit unit" as a label doesn't say *what*
it's a limit ON — Aaron's exact point that pills can themselves be dosed in mg means a bare "mg
vs. pills" choice doesn't disambiguate "milligrams total" from "number of mg-labeled tablets."
Nothing on screen previews what the resulting rule will actually block, unlike Schedule windows
right below it, which has a live "Reminds between X and Y" preview line for exactly this reason.

**Downstream consequence confirmed:** if the unit picked here doesn't match what `parseDoseOptions`
can find in the Dosage options text (no dose contains "mg" but the limit is left on the default
`'mg'`), `saveMedicationEditor` rejects the save at `index.html:3430-3436` — this is the direct
mechanism behind item 5 below. Fixing the ambiguity here reduces how often item 5's error fires at
all, not just how well it's worded.

**Recommended fix:**
1. Rewrite "Limit unit" as a self-explanatory picker whose options state what's being counted, not
   just a bare unit abbreviation:
   - `'mg'` → **"Total milligrams (mg)"**
   - `'pills'` → **"Number of pills / doses"**
   - `'applications'` → **"Number of applications"**
2. Add a helper line under "Limit unit" (currently has none): **"What the number above counts."**
3. Add a live one-line preview under the pair, the same pattern already established for Schedule
   windows (`index.html:3758-3760`) and the treatment-window summary — computed from
   `form.dailyLimit` + `form.dailyLimitUnit`, e.g. **"Blocks logging more once 500 mg is reached
   today"** or **"Blocks logging more once 4 pills are logged today."** This single line does more
   to resolve the ambiguity than any label rewrite alone, since it states the actual resulting rule
   in plain language, matching TEAM.md's copy-review bar ("reads the way a person would actually
   say it").
4. Optional, lower priority: default `dailyLimitUnit` smarter than a hardcoded `'mg'` — e.g., once
   the user has typed Dosage options, default to whichever unit the parsed doses actually carry
   (mg if any dose has `mg > 0`, else pills). Not required if the preview (item 3) ships, since the
   preview makes a wrong default immediately visible and correctable before save; flagging as a
   nice-to-have, not blocking.

**Locations to touch:** `index.html:3700-3701` (labels/options/helper), new preview line adjacent
(model on `index.html:3758-3760`), `index.html:3304` (default, only if doing #4).

---

## 2. Schedule Type dropdown — investigated, code is NOT missing the v23 treatment

**Finding: this is not a code defect in the current source.** I read the exact call site and then
independently confirmed it by rendering the real editor screen in a headless browser.

`index.html:3702`:
```js
h('label', null, fieldLabel('Schedule type'),
  h('select', { value: form.type, onChange: ..., style: selectFix({ ...,
    textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }) },
    h('option', { value: 'gap' }, 'As needed — gap timer between doses'),
    h('option', { value: 'win' }, 'Scheduled — set time windows')))
```

This select is wrapped in `selectFix()` (`index.html:3675-3677`) exactly like the "Limit unit"
select directly above it and all 12 other select call sites app-wide (verified by grep: every
`h('select', ...)` in the file passes `style: selectFix(...)` or the shared `selStyle` variable
which itself calls `selectFix()` once — 13 call sites total, matching the app-v23 changelog's "all
13 native dropdown call sites" claim exactly). It also already carries the app-v23 Designer-found
fix for clipped text (`textOverflow/overflow/whiteSpace`, per the app-v23 README entry: "clipped
Schedule-type select text").

I additionally rendered the live editor via Playwright (Chromium, 390×844) with a seeded
`type:'win'` medication and read the actual computed styles of every `<select>` on the page:

```
select[value="mg"]  (Limit unit):    appearance:none, borderRadius:11px, backgroundImage:<chevron>
select[value="win"] (Schedule type): appearance:none, borderRadius:11px, backgroundImage:<chevron>
```

Identical treatment, confirmed both in source and in an actual rendered DOM — rounded corners,
custom chevron, app font, no OS-default square styling. Screenshot taken at the same time shows a
normal rounded pill-style dropdown, visually indistinguishable from "Limit unit" beside it.

**So why did Aaron see the old styling live?** The most likely explanation, given the code is
already correct: **a stale cached build**, not an incomplete migration. This app is a PWA on
GitHub Pages with an aggressive service worker cache — TEAM.md's own release-mechanics checklist
already flags this exact risk ("Push to GitHub, then live-verify the actual deployed site... with
a cache-buster query param, since the service worker caches aggressively"). If Aaron tested the
deployed site (`https://arnjnnngs.github.io/chemowell-app-beta/`) without a hard-reload/cache-bust
after the v23/v24 deploy, or before the service-worker cache name was bumped for the release that
shipped this fix, he could still have been served pre-v23 HTML with the un-styled select, even
though the current source file has been correct since v23.

I could not verify the live deployed site directly from this sandbox (outbound HTTPS to
`arnjnnngs.github.io` failed at the network layer here — `curl: (56) CONNECT tunnel failed,
response 403` — a sandbox networking limitation, not a finding about the app). **This needs a
live check, not a code fix**, as the next step.

**Recommendation:**
- **Do not "fix" this select** — there is nothing wrong with it in source; changing it risks
  introducing a real regression to chase a non-existent one.
- Lead Developer/Auditor: live-verify the actual deployed `index.html` with a cache-buster
  (`?v=<timestamp>`) and confirm the select renders correctly there. If it's still wrong live but
  correct in source, the fix is a service-worker cache-name bump + redeploy (standard release
  mechanics, already in the checklist), not a code change to this select.
- If, after a confirmed hard-reload, the live site genuinely still shows square-cornered styling
  and source doesn't reproduce it, that would mean something browser/device-specific (worth asking
  Aaron exactly which browser/device he tested on) — but nothing in the current source explains a
  device-specific difference for this one select versus the other 12, so I'd treat that as unlikely
  until disproven by a real cache-busted live check.

**Reproduction script used:** `/tmp/inspect_select.mjs` (Playwright, not committed — recreate from
this brief if the Auditor wants to re-run it; seeds `chemowell-app-p-p1-med-v1` with a `type:'win'`
medication, opens the editor via the "Edit" pencil button, and reads `getComputedStyle` on every
`<select>` found).

---

## 3. Schedule windows: range vs. single alert time — architecture question

**This needs Aaron's input on a real design tradeoff before implementation — flagging explicitly,
per TEAM.md's instruction not to just say "remove the end time."**

### 3a. What currently depends on the window having both a start AND an end

I traced every place `window.start`/`window.end` (or the runtime `ws`/`we` derived from them) are
read:

| Function | Location | What it actually does with start/end |
|---|---|---|
| `dueRemindersAt()` | `index.html:4815-4847` | Fires the "Due" push notification **once**, only in the first 5 minutes after `w.start` (`h !== startH \|\| m < startM \|\| m >= startM + 5` → skip), de-duped via `notifSentToday`. **`end` is only used for one thing here**: at that single firing moment, checking whether a dose was already logged in `[ws, we)` so the "Due" notification doesn't fire if the dose was already taken early. `end` does **not** make the notification re-fire or keep firing through the range — the notification is already, functionally, a single-alert-time mechanism today. The "Reminds between X and Y" copy overstates what this function actually does (see 3d). |
| `status(med)` | `index.html:896-963` | **This is the one place `end` does real, load-bearing work.** For a `type:'win'` medication, a window is "open" (`locked:false`, green "Available" badge, normal one-tap logging) exactly while `now` is in `[ws, we)` (`index.html:951-954`). Once `now >= we` with nothing logged, the loop falls through to the *next* window or tomorrow, and the card shows locked/"Waiting" with a countdown, requiring the "Log early" override tap-through to log anyway. **This is the actual gate between one-tap logging and needing to explicitly override** — removing `end` removes the only thing currently deciding when that gate closes. |
| `missedDosesFor()` | `index.html:753-797` | Two separate uses of the window's times, and they are *not* the same boundary: (1) the "covered" check (`index.html:778-781`) claims any unused same-day dose entry with `ts < win.nextStart` — `nextStart` is the **next window's start** (or midnight for the last window), **not this window's own `end`** — so a late dose logged after this window's `end` but before the next window opens still correctly counts as covering *this* window, not the next one. (2) The actual "declare this missed" trigger (`index.html:782-783`, `if (win.covered \|\| now < win.we) return;`) fires only once **`now >= win.we`** — so `end` is functioning as a **grace-period deadline before flagging missed**, decoupled from what counts as "on time." |
| `hourTs()` | `index.html:750` | Pure time-math helper (`hour` decimal → today's timestamp), used for both `start` and `end` identically. No special dependency beyond needing *a* decimal hour to convert — doesn't care whether that hour represents a start or end conceptually. |
| `normalizeMedication()` | `index.html:333-337` | Clamps `start` to `[0, 23.75]` and `end` to `[1, 24]`, **drops the window entirely if `end <= start`** (`filter(window => window.end > window.start)`), sorts by `start`. This invariant (`end > start`) is enforced in three places total: here, the editor's End-option filtering (`index.html:3737`, `endOptions = END_TIME_OPTIONS.filter(opt => opt.value > row.start)`), and save-time filtering (`index.html:3408-3409`). |
| `isEarlyAt()` | `index.html:582-608` | For `type:'win'` meds, only checks against `med.windows[0].start` (`index.html:607`) — whether a dose logged before the very first window of the day counts as "early." **Never reads `end` at all.** |
| Editor UI copy | `index.html:3760` | `'Reminds between ' + formatQuarterHour(row.start) + ' and ' + formatQuarterHour(row.end)` — the live preview line under each window row. This is the one Aaron is reacting to directly. |
| `formatRuleSummary()` | `index.html:3232-3252` | Falls back to `formatQuarterHour(start) + '–' + formatQuarterHour(end)` only if a window has no `name` (`index.html:3242`) — in practice unreachable today, since `saveMedicationEditor` always assigns a name (`'Window ' + (index+1)` if left blank, `index.html:3410`), so every saved window has a name and this range-format fallback never actually renders. Not user-visible in practice, but the code path exists. |
| `dexWindowsForOffset()` / `eveningWindowsFor()` / `morningWindowsFor()` | `index.html:713, 866-893` | Hardcoded legacy per-medication windows (Dexamethasone, Iron, Buspirone, Paroxetine — all in `RESERVED_LEGACY_MED_IDS`, never assignable to a user-created medication) with deliberately **large, varying** end gaps: Dexamethasone uses explicit 4-hour windows (`8-12`, `14-18`); Iron/Buspirone/Paroxetine use `end: 24` — "stays open the rest of the day." **This is direct evidence that the grace period between "due" and "missed" is not a fixed universal constant in this app's design** — it already varies by medication (30 min for a simple user-added window vs. 4 hours vs. "all day") and that variability is intentional, not incidental. |

### 3b. Confirmed: gap-timer medications (`type: 'gap'`) are entirely unaffected

`status()` branches on `med.type === 'gap'` (`index.html:907-935`) with completely separate logic
(last-dose-timestamp + `gapH` lockout, no `windows` involved at all).
`missedDosesFor()`/`dueRemindersAt()` both filter to `m.windows && m.windows.length` before doing
anything, and `normalizeMedication()` deletes `medication.windows` entirely for `type !== 'win'`
(`index.html:393`). `isEarlyAt()` also branches explicitly on `med.type === 'gap'` first
(`index.html:583-593`) before ever touching `windows`. **Confirmed: nothing in this brief's scope
touches gap-timer (as-needed) medications** — they have no `start`/`end` concept today and none is
proposed.

### 3c. Any copy elsewhere assuming a range

Only one instance found: the Schedule-windows live preview itself (`index.html:3760`, quoted
above). The save-time validation toast (`index.html:3412`, `'Add at least one schedule window, for
example 8:00 AM–12:00 PM Morning.'`) also uses range-style example text, but it's describing the
*old* free-text format from before the v20 picker existed — a stale example, not a functional
range dependency; worth updating regardless of what item 3 decides (see item 6). Calendar
appointment reminders (`APPT_REMINDER_OPTIONS`, `index.html:3894` region) are confirmed unrelated —
single lead-time-before-event options only, no range concept, not in scope per the task.

### 3d. A real, separate finding worth flagging on its own: the copy already overstates what happens

Independent of whether Aaron's redesign ships: **"Reminds between 8:00 AM and 8:30 AM" is already
inaccurate today.** `dueRemindersAt()` only ever fires the notification once, in the first 5
minutes after `start` (`index.html:4832-4833`). It does not "remind between" two times — it reminds
*at* the start time, once. If item 3's redesign is deferred or rejected, this copy line should
still be corrected on its own merits (see item 6) since it currently promises repeated/ongoing
reminding through a window that the notification code doesn't actually do.

### 3e. What "single alert time" would require, and the real tradeoff

The reminder mechanism (`dueRemindersAt`) is **already** effectively single-alert-time in
behavior — no change needed there beyond the copy fix in 3d. The actual redesign work is entirely
in **what defines "closed for one-tap logging" and "missed"**, both of which currently come from
the same user-set `end` value doing two different jobs (open/closed gate in `status()`, and
missed-deadline in `missedDosesFor()`).

**Recommended approach — keep an internal deadline, stop exposing it as a second user-picked time:**

1. **Editor UI**: replace the paired Start/End dropdowns (`index.html:3748-3754`) with a single
   "Alert time" dropdown per row (reuse `TIME_STEP_OPTIONS`, drop `END_TIME_OPTIONS` from this
   picker). This is the actual UI change Aaron is asking for — one time per row, not two.
2. **Data model**: keep storing an internal deadline per window (do not delete the concept from the
   schema), but compute it automatically instead of asking the user to pick it:
   - **Migration for existing medications** (the concrete question the task asked to work through):
     on the next `normalizeMedication()` pass, for every existing window, compute and persist
     `graceHours = (end - start)` **once**, then treat `start` as the sole user-facing field going
     forward. This is a value-preserving migration — every existing medication's actual
     open/closed and missed-dose behavior is byte-identical the moment this ships (a 30-minute
     window stays a 30-minute grace; Dexamethasone's 4-hour windows stay 4-hour; Iron's "rest of
     day" stays "rest of day") — **zero behavior change on release day**, only the editor UI
     changes for anyone who opens an existing medication to edit it afterward.
   - **New rows going forward**: default `graceHours` to something reasonable (recommend **2
     hours** — long enough that a caregiver who's mid-chemo-appointment or asleep doesn't get an
     unfair "missed" flag for a 45-minute delay, short enough to still mean something) and don't
     expose it in the primary UI at all. Add it as a genuinely optional "Advanced" control (e.g., a
     collapsed "Missed after ___ hours" field per row, collapsed by default) **only if Aaron wants
     per-medication control preserved** — see the open question below. If Aaron doesn't want that
     complexity, drop it to a single global constant and accept that Dexamethasone-style
     medication-specific tuning becomes a hardcoded special case only (as it already effectively is
     today for the 4 reserved legacy IDs) rather than something a caregiver could tune for their
     own added medications.
3. **`status()`** (`index.html:947-954`): unchanged mechanically — still computes `we = ws +
   graceHours*3600000` (renaming, not removing, the concept) and gates open/closed exactly as
   today. No behavior change beyond the source of `we`.
4. **`missedDosesFor()`** (`index.html:753-797`): unchanged mechanically for the same reason — the
   "covered" check already keys off the *next window's start*, not this window's `end`, so that
   logic doesn't move at all; only the `now >= win.we` missed-deadline check's source value
   changes from user-typed `end` to computed `start + graceHours`.
5. **Copy**: "Reminds at 8:00 AM" replaces "Reminds between 8:00 AM and 8:30 AM"
   (`index.html:3760`) — accurate to what `dueRemindersAt` actually does (see 3d). Do **not**
   surface the grace period/deadline concept in this preview line unless Aaron opts into exposing
   the advanced control from step 2 — if it stays hidden, the user-facing story is genuinely just
   "reminds at this time," which is exactly what Aaron asked for.

**What breaks if this is done carelessly** (the "don't just say remove the end time" concern the
task raised):
- Silently dropping `end` with no replacement concept at all would mean **either** (a) a window
  never "closes" for one-tap logging purposes (every dose logged any time after the alert counts as
  on-time, forever, until the next window's start) — functionally fine for *covered*-checking (that
  part doesn't use `end` today anyway, per 3a) but breaks the "Available" vs. "Waiting"/needs-override
  badge and the whole Log-early-override UX, since `status()` would have nothing to gate on; **or**
  (b) "missed" never fires until the next window opens or midnight, which for a single-window-a-day
  medication means a caregiver gets no "you missed this" signal until nearly a full day has passed —
  a real safety-relevant regression for a medication-adherence app, not a cosmetic one. Both are
  concrete, specific failure modes, not hand-waving — this is exactly why TEAM.md flags this as
  needing full-chain treatment rather than a copy fix.
- Migrating without preserving each existing medication's actual `(end - start)` gap as its initial
  `graceHours` would silently change every current user's already-configured behavior on upgrade —
  Dexamethasone's real 4-hour clinical window would collapse to whatever the new global default is,
  which is both a functional regression and, for a chemo anti-nausea medication, a real clinical
  significance to get wrong.

**Open questions for Aaron/PM (flagging per TEAM.md, not deciding unilaterally):**
1. Is a hidden, auto-computed 2-hour default grace period acceptable for new medications, or does
   Aaron want *some* user-facing control over how long "not yet missed" lasts, even if it's no
   longer a second required time picker? (E.g., an optional "Remind again if not logged within
   ___ hours" field, collapsed/advanced, defaulting to 2h.)
2. Should the grace period be visible anywhere in the read-only summary (Meds list "Rules:" line,
   `formatRuleSummary`) even if it's not part of the primary add/edit flow — e.g. so Aaron himself
   can later confirm/audit why a dose got flagged "missed" without having to know the internal
   default?
3. Confirm 2 hours is the right default grace — I'm recommending it as a reasonable clinical
   default (matches roughly the shortest existing real-medication window pattern in the codebase,
   Dexamethasone's `end-start` of 4h being the upper end and a simple pill's typical prior 30-min
   window being the lower end), not something Aaron has stated a preference on.

---

## 4. "Minimum gap hours" confusing wording

**Exact current UI**, two variants depending on `form.type` (`index.html:3766-3772`):

- Scheduled (`type:'win'`, optional gap on top of windows):
  `fieldLabel('Minimum gap hours (optional)', 'Also require this much time since the last dose,
  even during an open schedule window.')`
- As-needed (`type:'gap'`, the medication's only rule):
  `fieldLabel('Minimum gap hours', 'Required — how long before this can be logged again.')`

**Root cause:** "gap hours" is a noun-pileup ("gap" + "hours" stacked with no preposition) that
doesn't read the way a person would say it. The as-needed variant's helper is already fairly close
("how long before this can be logged again") but the *label itself*, which is what's visible before
a user reads the smaller helper text, doesn't say "between doses" or "since the last dose" at all —
"Minimum gap hours" alone could plausibly be misread as "how many hours this medication is
scheduled for" or similar, especially by a non-technical caregiver skimming the screen.

**Recommended fix** — relabel both variants to read as a sentence fragment naming what's being
measured, matching the voice already used elsewhere on this screen (e.g. "Blocks logging more
doses once this many are reached for the day"):

- As-needed: label **"Hours between doses"**, helper **"How long to wait after the last dose
  before this can be logged again. Required for an as-needed medication."**
- Scheduled, optional: label **"Extra hours between doses (optional)"**, helper **"Also block
  logging again this soon after the last dose, even if a schedule window is currently open."**

This keeps the existing helper's good parts (the scheduled variant's "even during an open schedule
window" clause is genuinely useful and should be kept nearly verbatim) while fixing the label
itself to name "between doses" up front, so the core meaning doesn't depend on the user reading the
smaller helper text at all.

**Locations to touch:** `index.html:3771` (scheduled variant), `index.html:3772` (as-needed
variant).

---

## 5. Unhelpful "mg" save-validation error

**Exact current logic and message** (`index.html:3430-3436`):

```js
const dailyLimit = Number(form.dailyLimit) || 0;
if (dailyLimit > 0) {
  const testDoses = parseDoseOptions(form.dosesText);
  const unit = form.dailyLimitUnit;
  const carries = unit === 'mg' ? testDoses.some(d => d.mg > 0) : testDoses.some(d => d.pills > 0);
  if (!carries) {
    setToast('The daily limit is in ' + unit + ' but no dose option includes a ' +
      (unit === 'mg' ? 'mg amount (e.g. "500 mg")' : 'count (e.g. "1 pill")') +
      ' — the limit could never be enforced. Fix the dose options or clear the limit.');
    return;
  }
}
```

**What the user currently sees**, verbatim, when this fires (e.g. Daily limit = 500, Limit unit =
mg, but Dosage options has no "mg" in any entry): a toast reading *"The daily limit is in mg but no
dose option includes a mg amount (e.g. "500 mg") — the limit could never be enforced. Fix the dose
options or clear the limit."*

**Correction to the task's framing, confirmed by reading the code:** this message is not actually
generic — it does name the real problem (a unit mismatch between the Daily limit and the Dosage
options text) and gives a concrete example format. It is **not** the unlabeled "wasn't saved" dead
end the report describes. That said, three real, verifiable usability problems remain even with
this specific a message, which is likely what Aaron experienced as "no idea why":

1. **It's purely reactive** — nothing on screen warns about the mismatch until the user has already
   filled everything in and tapped Save, at which point a toast (auto-dismisses after 4.5s,
   `setToast`/`index.html:965-969`) is the only place the explanation lives. On a small phone
   screen, mid-multi-field-edit, that's easy to miss or dismiss without fully reading — especially
   since nothing about the Daily limit/Limit unit fields themselves change appearance to show
   what's wrong.
2. **It's downstream of item 1** — this validation only exists *because* "Limit unit" is an
   ambiguous, easy-to-leave-on-the-wrong-default picker (item 1's finding). Fixing item 1's live
   preview means a user sees "Blocks logging more once 500 mg is reached" *before* saving, while
   their Dosage options field (visible right above, `index.html:3699`) still says "1 tablet" with
   no "mg" in it — the mismatch becomes visible in context, well before Save, instead of being
   caught only at save time.
3. **The wording is more technical than the rest of this screen's voice** — "the limit could never
   be enforced" is precise but slightly clinical/defensive-sounding for a caregiver-facing toast;
   the rest of the screen's copy (per TEAM.md's copy-review guidance) reads more like plain
   instruction.

**Recommended fix (both, not either/or):**
- **Inline hint (primary fix, prevents the rejection from happening at all)**: as part of item 1's
  live preview line, if `dailyLimit > 0` and the preview detects the same mismatch this validation
  checks for, show the preview line in a warning tone (e.g. amber/red text, matching the app's
  existing warning-tone pattern used elsewhere on this screen for ceiling/override states) reading
  something like **"Dosage options don't include an mg amount yet — this limit won't work until
  they do."** — visible while editing, not just at save.
- **Tighten the save-time toast wording** to match the screen's plainer voice and lead with the
  actionable instruction, e.g.: **"Add an mg amount to Dosage options (e.g. "500 mg"), or change
  Limit unit to match, before saving this daily limit."** — states the fix first, keeps the concrete
  example, drops "could never be enforced."

**Locations to touch:** `index.html:3435` (toast copy), plus the same preview-line component
proposed in item 1 (new code, not existing).

---

## 6. General wordsmith pass — other copy on this screen worth cleaning up

Additional items surfaced while investigating 1–5, in the same voice/brevity spirit TEAM.md's
copy-review guidance calls for:

- **`index.html:3702`**, Schedule Type options: *"As needed — gap timer between doses"* / *"Scheduled
  — set time windows"*. "Gap timer" is internal jargon (matches the code's own `gapH`/`type:'gap'`
  naming) leaking into user-facing copy. Recommend: **"As needed — wait a set number of hours
  between doses"** / **"Scheduled — remind me at specific times"** (the latter should be updated
  together with item 3's rename if that ships, e.g. "...at a specific time each day").
- **`index.html:3412`**, save-validation toast: *"Add at least one schedule window, for example 8:00
  AM–12:00 PM Morning."* — the example format (a free-text range with a label) describes the *old*
  pre-v20 text-entry format, not the current dropdown-row picker. Update the example to match what
  the picker actually produces, e.g. *"Add at least one schedule time — tap "+ Add another time
  window" to add one."*
- **`index.html:3701`**, "Limit unit" label has no helper text at all — the only field on this
  screen without one (already covered in item 1's fix, noting it here so it isn't missed as a
  standalone gap).
- **`index.html:3760`**, "Reminds between X and Y" — already flagged in depth in item 3d as
  independently inaccurate regardless of the architecture decision; the minimal version of this fix
  (change to "Reminds at X") should ship even if the fuller item 3 redesign is deferred.
- Minor consistency note, not a defect: `formatRuleSummary()` (`index.html:3242`) still contains a
  `formatQuarterHour(start) + '–' + formatQuarterHour(end)` fallback for an unnamed window, but
  every window saved through the current editor always gets an auto-name (`'Window ' + N` at
  minimum, `index.html:3410`), so this fallback is effectively dead code today — not
  user-facing-broken, just worth knowing it'll need updating in lockstep with item 3's copy if a
  future change ever makes it reachable again (e.g. an import feature).

---

## Summary of files/functions touched by this brief (for the Lead Developer)

| Item | Primary locations |
|---|---|
| 1. Daily Limit unit | `index.html:3700-3701` (labels/options), `3304` (default, optional), new preview line |
| 2. Schedule Type select | No code change recommended — live cache-bust verification only |
| 3. Schedule windows | `index.html:333-337, 582-608, 753-797, 896-963, 3737-3760, 4815-4847` — needs Aaron/PM decision first (see open questions), then full-chain implementation |
| 4. Minimum gap hours | `index.html:3771-3772` |
| 5. mg validation error | `index.html:3435` (copy), new inline preview shared with item 1 |
| 6. Wordsmith pass | `index.html:3702, 3412, 3701, 3760, 3242` |

Items 1, 4, 5, 6 are copy/UX-only changes confined to the medication editor screen with no change
to how data is stored or calculated — **fast lane** per TEAM.md's lane definitions. Item 2 needs no
code change, only a live-deploy verification step. **Item 3 changes how missed-dose data is
calculated and stored and is safety-relevant (dosing/reminders) — full chain required**, and per
TEAM.md should not proceed to implementation until the open questions above get an answer from
Aaron/PM on the grace-period design.
