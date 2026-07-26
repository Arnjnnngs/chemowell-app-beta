# Developer Brief — "Pause a medication" + "Excluded near treatment day" window

Stage: Developer (investigation only — no code changed). Repo: `chemowell-app-beta` (APP-BETA), file: `index.html` (3,933 lines, single file, no build step). Verified against `app-v18` (`const APP_VERSION = 'app-v18'`, line 3177), commit `bfe73b4` ("app-v18: evidence screenshots"), the current HEAD at investigation time — `git log --oneline -3` and the version grep were re-run and confirmed before any code was read, per this task's explicit instruction.

## Lead Developer correction (post-brief, before build) — pause data model revised

Aaron flagged a real gap after reviewing Open Question 4: the design below gates `missedDosesFor` on the medication's **live** `paused` boolean, checked fresh every time regardless of which historical day is being evaluated. Traced directly against the current code (`missedDosesFor`, line 625; `pastMissedCount`, line 682, which loops every day from `MISSED_TRACK_SINCE` to today calling `missedDosesFor` per day; `renderHistory`, line 3366, same pattern) — this confirms Aaron's instinct: the moment a medication is **resumed** (`paused` flips back to `false`), every subsequent call to `missedDosesFor` for the days that fell *during* the pause would find no logged doses (nothing was logged — dose buttons were off) and no per-day record that those specific days were paused, and would compute them as newly missed. Resuming a medication paused for two weeks would flood the user with two weeks of "missed dose" flags across History, the header's past-missed-doses count, and Today's Journal — the opposite of the intended behavior, and exactly what Aaron asked to guard against.

**Fix — track pause periods, not just current state.** Replace the single `pausedAt`-less boolean model below with:
```js
paused: false,          // boolean — current live state, used for the Home card/reminders/dose-buttons gate
pausedCheckinDate: null,
pausePeriods: []        // [{ start: <dayStart ts>, end: <dayStart ts> | null }] — end:null means still ongoing
```
Pausing pushes a new `{ start: dayStart(now), end: null }` onto `pausePeriods` and sets `paused: true`. Resuming closes the open period (`end: dayStart(now)`) and sets `paused: false`. A new helper, `isPausedOn(med, dayTs)`, checks whether a given calendar day falls inside *any* recorded period (open or closed) — `missedDosesFor`'s guard becomes `if (isPausedOn(med, d0)) return;` instead of `if (med.paused) return;`. Because each period keeps a permanent start/end once closed, the days that were actually paused stay excluded from missed-dose computation forever, whether the medication is currently paused or has since resumed — no flood on resume, and no change to the "currently paused" gating used everywhere else (Home card, reminders, dose-completion ring), which correctly keeps reading the live `paused` boolean, not the periods array. `pausePeriods` defaults to `[]` for every existing medication — zero behavior change for anything that's never used the feature. This supersedes the simpler model in Feature 1 below (data model, `missedDosesFor` guard, and the affected Definition-of-Done items); the rest of Feature 1's design (card layout, banner, reminders gate, dose-button gate) is unaffected and still keyed off the live `paused` boolean as originally designed.

---

## Correction to a prior, stale-checkout pass

A previous Developer pass on this same request ran against an 8-versions-old checkout (commit `4e05654`, "v10"-era) and produced a brief now known to be wrong: it claimed `treatmentOnly`/`treatmentDaysBefore`/`treatmentDaysAfter`/`dueRemindersAt()` don't exist. **They do exist**, shipped in app-v16 (README.md's app-v16 row) and unchanged in structure through v18. This brief re-verifies every claim directly against the current file — every line number below was read fresh, not carried over from the old brief or from memory. Where the old brief's structural approach (current-state findings → data model with alternatives → blast-radius table → open questions → DoD) was sound, it's kept; every specific technical claim is new.

---

## Current-state findings

### Status label vocabulary + card layouts (Feature 1 target)

Home's Quick Log cards are built by the `medCards` filter/map at **line 2566**:
```js
const medCards = state.meds.filter(m => m.quickLog && (!m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete))).map(med => { ... });
```
Inside the `.map()`, each medication hits one of **three mutually exclusive card layouts**, checked in this order:
1. **In-Patient** (lines 2567–2571) — if `inpatientActiveNow`, renders `"{name} - In-Patient (Restricted)"` + `"Given by hospital staff — not logged in this app"`, no dose buttons. Dashed amber border, muted card, no pill at all (this replaces the whole card body, so there's no pill/status slot here).
2. **Not scheduled today** (lines 2573–2578) — if `!medScheduledOn(med, now)`, renders `"{name} — Not scheduled today"` + `"Taken: {scheduleDaysLabel(med)}"`. Same inert-card shape, dashed muted-gray border, no dose buttons.
3. **Normal card** (lines 2579–2669) — full card with a status pill in the header row (lines 2650–2658):
   - **Locked + ceiling/chemoBlock** → `"Limit"` or `"Restricted"` pill, red (`rgba(192,69,59,0.10)` / `#A5443C`).
   - **Locked, neither** → `"Waiting"` pill, amber (`rgba(181,118,30,0.12)` / `#8C5900`).
   - **Not locked** → `"Available"` pill, green (`rgba(15,157,87,0.12)` / `#0C7F57`).

This is the exact slot a fifth "Paused" pill state would plug into, but per Aaron's own spec ("no dose buttons" is implied by "pause" — see below) a pure pill change is insufficient; this needs the inert-card treatment, not just a pill swap. See Feature 1 recommendation.

There is a **fourth "unavailable" pattern**, `treatmentOnly` outside its window: the medication doesn't get a card layout at all — it's excluded upstream by the `medCards` filter itself (line 2566: `!m.treatmentOnly || (treatmentActiveOn(m, now) && ...)`). So the codebase already has two disagreeing answers to "how do we show a medication that isn't currently applicable": **full removal** (`treatmentOnly` outside window) vs. **visible inert card** (in-patient, not-scheduled-today). This is the crux of Open Question 1.

`status(med)` itself (function starts **line 759**, ends **812**) returns `{ locked, availableAt, windowName, ceilingHit, chemoBlock, courseComplete }` (never a `paused` key today) and is the single choke point every consumer of "is this medication actionable" reads through, aside from the two upstream card-layout branches above which bypass it entirely.

The identical three-tier pattern (inert-row vs. active-row; `treatmentOnly` is NOT separately filtered here) also exists in `renderGroupedMedsCard` (**line 1569**, used for the Morning/Afternoon/Evening grouped cards):
- `dueMeds` computation (line 1571): `meds.filter(m => { if (!medScheduledOn(m, now)) return false; const s = status(m); return !s.locked; })` — feeds the "Take all (N)" button.
- Per-row not-scheduled inert row: lines 1579–1585.
- Per-row in-patient inert row: lines 1587–1593.
- Normal interactive row (Log / Opens {time} button): lines 1595–1618ish.

Note `renderGroupedMedsCard` has **no `treatmentOnly` gating today** — a grouped-placement medication with `treatmentOnly: true` would still render in its group outside the treatment window (unlike `medCards`, which filters it out entirely). This is a **pre-existing gap**, not something this feature introduces, but worth noting since a `paused`/`excluded` guard should be added to both call sites consistently, closing (or at least not widening) that gap.

### Existing "day window around treatment" logic — generalized, configurable, already shipped in v16

- `nextChemoTs()` (**line 562**) — most recent `chemo_date` entry's timestamp, or `null`.
- `chemoOffsetFor(dayTs)` (**line 567**) — signed integer day offset from that date, or `null` if unset.
- `dexActiveOn(dayTs)` (**line 572**) — `offset >= -1 && offset <= 1`, hardcoded, used ONLY for the legacy `dexamethasone` id's own dose-window computation (id-gated, not reachable by user-created meds).
- `treatmentActiveOn(med, dayTs)` (**lines 578–584**) — the real, generalized, per-medication mechanism:
  ```js
  function treatmentActiveOn(med, dayTs) {
    const o = chemoOffsetFor(dayTs);
    if (o === null) return false;
    const before = Number.isFinite(med.treatmentDaysBefore) ? med.treatmentDaysBefore : 1;
    const after = Number.isFinite(med.treatmentDaysAfter) ? med.treatmentDaysAfter : 1;
    return o >= -before && o <= after;
  }
  ```
  This is the exact shared day-window helper the task brief asked me to look for. It already takes `med` and reads per-medication `treatmentDaysBefore`/`treatmentDaysAfter`, defaulting to 1/1 (today's old fixed `dexActiveOn` window) when unset. **This is directly reusable for Feature 2** — see below.
- `zofranBlockedOn(dayTs)` (**line 589**) — hardcoded `offset >= 0 && offset <= 2`, id-gated to `med.id === 'zofran'` in `status()` (line 761).
- `dexWindowsForOffset(offset)` (**line 590**) — Dexamethasone-specific dose-window shape per offset, id-gated to `med.id === 'dexamethasone'` in three places: `missedDosesFor` (line 633), `doseProgressToday` (line 671), `status` (lines 797, 809).
- `treatmentOnly` boolean — normalized in `normalizeMedication` (**lines 302–309**):
  ```js
  // v16 migration: chemoOnly (fixed +-1 day window, "Chemo-day only") -> treatmentOnly with a
  // per-medication configurable day range. A device with an existing chemoOnly:true medication and
  // no explicit day fields keeps behaving identically (+-1) until the user edits it.
  treatmentOnly: typeof original.treatmentOnly === 'boolean' ? original.treatmentOnly : !!original.chemoOnly,
  treatmentDaysBefore: Number.isFinite(original.treatmentDaysBefore) ? Math.max(0, Math.round(original.treatmentDaysBefore)) : 1,
  treatmentDaysAfter: Number.isFinite(original.treatmentDaysAfter) ? Math.max(0, Math.round(original.treatmentDaysAfter)) : 1
  ...
  delete medication.chemoOnly;  // line 309 — old key is dropped, not just ignored
  ```
  The `chemoOnly → treatmentOnly` migration has **already happened and shipped**; there is no leftover `chemoOnly` key anywhere in the current codebase (confirmed by full-file grep — zero remaining references outside this comment and the migration line itself). This means Feature 2 does **not** need to invent a migration; it only needs to add new, independent fields alongside `treatmentOnly` (see Data Model below) — much less migration risk than the stale brief assumed.
  - Editor UI: `renderPillToggle('Treatment-day medication', ...)` (**line 3081**), helper text *"Only appears on Home for a window of days around your treatment date — hidden the rest of the time. Set your own range below (every regimen is different)."*
  - Conditional days-before/after number inputs (**lines 3083–3089**), only rendered when `form.treatmentOnly` is true, with a live-computed summary line ("Active window: N days before through M days after treatment day.").
  - `clampTreatmentDays(value)` (**lines 2856–2860**) — the save-time normalizer for the day-count inputs; falls back to `1` for blank/invalid input (an audit-v16-caught fix, documented in its own comment), never silently collapses to `0`.
  - Save path: `saveMedicationEditor()` (**lines 2861–2924**) writes `treatmentOnly`/`treatmentDaysBefore`/`treatmentDaysAfter` at **lines 2907–2909**, using `clampTreatmentDays` for both day fields.
  - Manager badge: `renderMedicationManager` shows a `"Treatment day −N/+M"` badge (**line 3152**) when `med.treatmentOnly` is true.

### Reminder engine — generic, already shipped in v16, NOT hardcoded ids

`dueRemindersAt(nowDate)` (**lines 3836–3860**) is the real, current, med-agnostic reminder function (there is no separate hardcoded-id engine anymore — that was replaced in v16, see README's app-v16 row). It:
- Skips quiet hours (10 PM–8 AM), line 3841.
- Iterates `state.meds.filter(med => med.alerts && med.windows && med.windows.length)` (line 3842) — generic, not id-keyed.
- Skips off-schedule days via `medScheduledOn(med, nowTs)` (line 3843).
- **Already skips `treatmentOnly` meds outside their window** (line 3844): `if (med.treatmentOnly && !treatmentActiveOn(med, nowTs)) return;` — this is the exact pattern a `paused`/excluded-window check needs to mirror.
- De-dupes per medication+window+day via `notifSentToday` (in-memory, see below) and fires `due.push({ med, window })` for anything not yet logged in its window.

`checkNotifications()` (**lines 3862–3874**) calls `dueRemindersAt(new Date())` and sends one OS notification per due item via `sendNotif()`. It's gated off in web/PWA under `TEST_MODE` (line 3866: `if (TEST_MODE && !isNativeApp()) return;`) — per `APP_CLAUDE.md` rule 4, `TEST_MODE` must stay `true` until store submission, so this engine is dormant in the current beta build but **does run for real in the native APK test build** (v14's `isNativeApp()` carve-out), so it is not dead code to treat casually.

Because `dueRemindersAt` already loops generically over `state.meds` and already has a `treatmentOnly` gate as a working example, adding a `paused`/`excluded`-window gate here is a **one-line addition inside the existing `forEach`**, not a multi-block hunt through hardcoded id lists (that hardcoded-id problem was real in the version the stale brief described, but it was fixed in v16 and no longer exists in v18).

### Day-boundary / once-per-day patterns (for the recurring banner)

Two different existing mechanisms — pick correctly per use case:

1. **`notifSentToday` / `resetNotifTracking()`** (**lines 3773–3780**) — `let notifSentToday = {}`, in-memory only, never persisted. `resetNotifTracking()` compares `notifSentToday._day` against `dayStart(Date.now())` and clears the object on day rollover. Used exclusively to de-dupe **OS notification sends** within a session. **Lost on every reload.** Wrong pattern for "has the user already answered today's pause check-in," since that must survive the user closing and reopening the app.

2. **Persisted "answered today," derived from data** — the pattern the three existing recurring daily check-in banners actually use (Bowel Movement, Appetite, Daily Weight), all built inside the Home `parts` array (`const parts = []`, **line 2154**, populated through ~line 2477):
   - **Bowel Movement check-in** (**lines 2296–2331**): checks `bowelMovementFor(yesterdayStart(now))` (`bowelMovementFor` at **line 1133**, backed by a `Map` derived from `state.entries` — i.e., an actual logged `bowel_movement` entry for that day, not a boolean flag). If no entry exists for yesterday, the banner renders; `submitBowelMovement(dayStartTs)` (**line 1174**) logs the entry, which makes `bowelMovementFor` return non-null next render, which makes the banner disappear. **The "answered" state is the entry's mere existence — there is no separate "dismissed" flag to manage or get out of sync.**
   - **Appetite check-in** (**lines 2333–2360ish**): identical shape, backed by `appetiteFor()`.
   - **Daily Weight check-in** (~**line 2371+**): identical shape, backed by whether a weight entry exists for today.
   - All three share escalating tone via `dailyAlertLevel(now)` (**line 1107**) → `dailyAlertStyle(level)` (**line 1121**) → `NOTICE_TONES` (**line 1116**: `info`/`attention`/`urgent`), gating on `homePref('bowelCheckin')` etc. (**`HOME_PREF_DEFAULTS`, line 1093**; `homePref()`, line 1094) — these are user-togglable in Settings (toggle wiring at **line 3231–3233**).

   **This entry-backed pattern doesn't map cleanly onto Feature 1**, because a pause check-in isn't "did the user log a data point" — it's "does a config flag still apply." There is no natural "entry" to check for existence. The correct adaptation is a **persisted field on the medication object itself** (not an entry), written through the same `persistMedicationConfig(meds, archivedMeds)` (**lines 375–383**) path every other medication-config change already uses — e.g. `moveReorderableMed` (**lines 2938–2952**) is the closest precedent for "mutate one field on one medication in `state.meds` and persist immediately, without opening the full editor."

The **"pinned banner"** language has two real, non-interchangeable precedents:
- **Sticky-header pinned card** — `renderHeader()`'s past-missed-doses card (**lines 1526–1537**, inside the `position: 'sticky'` `<header>`, **line 1502**). Visible on every tab, never scrolls away. Reserved today for exactly one thing: the safety-urgent "N missed doses from previous days" count (`pastMissedCount`, line 682).
- **Home-body persistent banner** — everything else: In-Patient (2158–2166ish), Missed dose today (2175–2196ish), Treatment/chemo day (2205–2236), Period active (2239–2249ish), Bowel Movement/Appetite/Weight check-ins (2296–2399ish). All live in the `parts` array, rendered on the **Home tab body only**, above Quick Log — they scroll away like normal content but always render first, every day, until resolved/answered.

**Recommendation: model the Pause check-in on the Home-body persistent banner pattern** (Bowel Movement check-in is the closest analog in cadence and tone — daily, two clear actions, non-urgent). The sticky header is reserved for the one safety-urgent, cross-tab case it already owns; a "still want this paused?" check-in is closer in severity to Bowel/Weight/Appetite. Flagging as Open Question 3 since Aaron's literal word was "pinned," which is technically true of both patterns.

### `normalizeMedication` — the safe-default/migration pattern to follow

`normalizeMedication(raw, index)` (**starts line 276**) is the single point every saved medication passes through on load (`loadMedicationConfig`) and on save (`saveMedicationEditor`, line 2918: `normalizeMedication(candidate, state.meds.length)`). It spreads `...original` first (line 291) so unknown/legacy fields pass through untouched, then explicitly overwrites the fields it owns. The `treatmentOnly`/`treatmentDaysBefore`/`treatmentDaysAfter` block (lines 302–307) is the exact template to copy for new fields — boolean fields use `typeof x === 'boolean' ? x : default`, numeric fields use `Number.isFinite(x) ? clamp(x) : default`. New fields for both features below should be added here, following this same shape.

### Reserved legacy ids — confirmed untouched through v16–v18

`RESERVED_LEGACY_MED_IDS` (**line 2833**): `dexamethasone, zofran, protonix, tylenol, tylenol-liquid, iron, compazine, buspirone, paroxetine, morphine, senokot, imodium, lidocaine`. `nextMedicationId()` (line 2834–2843) guarantees no user-created medication can ever take one of these ids. `dexActiveOn`, `dexWindowsForOffset`, `zofranBlockedOn` are all still id-gated to `dexamethasone`/`zofran` specifically (lines 572, 590, 761/589) and were **not** touched by the v16 `treatmentOnly` generalization or anything since — confirmed by grep across the full current file. These represent Aaron's own family's real regimen and should be left alone by this feature, exactly as the task brief anticipated.

---

## Feature 1: Pause a medication

### Recommended data model

Add to the medication object, normalized in `normalizeMedication` (insert alongside the `treatmentOnly` block, lines 302–307):

```js
paused: typeof original.paused === 'boolean' ? original.paused : false,
pausedCheckinDate: Number.isFinite(original.pausedCheckinDate) ? original.pausedCheckinDate : null,
```

- `paused` (boolean, default `false`) — every existing saved medication has no `paused` key, so `typeof original.paused === 'boolean'` is `false` and it normalizes to `false` — zero behavior change for any medication that's never touched the new UI. Mirrors the `treatmentOnly` guard exactly.
- `pausedCheckinDate` (number `dayStart` timestamp, or `null`) — the calendar day the user last confirmed "still needs to be paused." Persisted via the existing `persistMedicationConfig` (line 375), same storage key (`chemowell-app-p-{profile}-med-v1`, **line 258**) every other medication field already uses.

I'm deliberately dropping the old brief's third field (`pausedAt`, "when most recently paused") — nothing in Aaron's spec or the current codebase needs a pause timestamp, and `normalizeMedication` should own only fields that gate real behavior (matching the file's existing discipline: `treatmentOnly` doesn't track "when toggled on" either). Add it later only if a future Reports view needs it.

### Banner: "Still need to pause {med}?"

New block in the Home `parts` array (line 2154 onward), positioned after the Treatment/chemo banner (lines 2205–2236) and before the Period/Bowel/Appetite/Weight check-ins — Treatment is date-driven and highest-signal; Pause is user-controlled and roughly equal severity to the other check-ins, so grouping it with them is reasonable, exact order is a minor call.

```js
state.meds.filter(m => m.paused && m.pausedCheckinDate !== dayStart(now)).forEach(med => {
  // one banner per paused-and-unconfirmed medication (matches the one-row-per-miss precedent
  // in the missed-dose banner, not batching distinct medications behind one button pair)
  parts.push(h('div', { /* NOTICE_TONES.info-styled banner, same shape as bowel/weight/appetite */ },
    /* "Still pausing {med.name}?" */
    /* "Continue pausing" -> pauseMedication(med.id, true)  */
    /* "Resume"            -> pauseMedication(med.id, false) */
  ));
});
```

New helper (parallel to `moveReorderableMed`, lines 2938–2952 — mutate one field on one medication in `state.meds`, persist, `setState`):

```js
function setMedicationPaused(id, paused) {
  const meds = state.meds.map(m => m.id === id ? { ...m, paused, pausedCheckinDate: paused ? dayStart(state.now) : null } : m);
  persistMedicationConfig(meds, state.archivedMeds);
  setState({ meds });
}
```
- "Continue pausing" → `setMedicationPaused(med.id, true)` (re-stamps `pausedCheckinDate` to today, dismissing the banner for the rest of the day).
- "Resume" → `setMedicationPaused(med.id, false)` (clears `paused`; `pausedCheckinDate` reset to `null`).
- Initial pause action (from the med editor or the Home card's inline Resume-adjacent Pause control) also calls `setMedicationPaused(id, true)`, which stamps today's date immediately — so pausing a medication does NOT trigger the "still need to pause?" banner again on the same day it was paused (it already got its "confirmation" implicitly by the act of pausing).

Tone: `NOTICE_TONES.info` — this is a routine check-in, not degrading in urgency through the day the way Bowel/Weight/Appetite do (those escalate because a *missing* health data point is itself a mild risk signal; a *deliberately* paused medication isn't). Do not wire into `dailyAlertLevel`'s escalation.

### Home card while paused

**Recommendation: keep the card, switch to the inert-card layout already used for "Not scheduled today"/"In-Patient"** (same visual family as lines 2573–2578), with "Paused" as the headline status and an inline "Resume" button (in addition to the daily banner, so the user isn't forced to wait for the banner or open the med editor to undo a pause).

Concretely: insert a `paused` check into `medCards.map()` (line 2566 onward) as the **first** branch, before the in-patient (2567) and not-scheduled (2573) checks — pause should win over every other card state, since "the user explicitly said stop" outranks "hospital gave it" or "not scheduled today" as the thing to communicate. Suggested color: reuse the neutral-gray family already used for "Not scheduled today" (`rgba(125,105,116,0.06)` background / `#554A52` text) rather than inventing a new tint — "Paused" is a similarly neutral, non-alarming state, distinct from the red (Limit/Restricted) and amber (Waiting) tones already in use, so it should not borrow either of those.

Also add the identical `paused` check to `renderGroupedMedsCard`'s per-row rendering (before the not-scheduled check at line 1579) for meds placed in a grouped card, and exclude paused meds from the `dueMeds` filter (line 1571) that powers "Take all (N)."

**Alternative considered and rejected: hide the card entirely while paused** (mirroring how `treatmentOnly` meds vanish outside their window today, line 2566). Rejected because Aaron was explicit the status label should still show — a vanished card has nowhere to show one — and because for this app's specific audience (anxious chemo caregivers/patients), a medication silently disappearing reads as data loss or a bug, not as "handled." The in-patient/not-scheduled precedent of a visible-but-inert card is the more consistent, and safer, choice.

### Interaction with `status()`, reminders, missed-dose/dose-progress tracking, and history

- **`status(med)`** (line 759): a paused medication's card bypasses `status()` entirely under the recommendation above (like in-patient/not-scheduled do today), so `status()` itself doesn't strictly need a `paused` branch for the card to render correctly. However, **`logMed()`** (which calls `status(med)` to check `st.locked` before allowing a dose to be logged) is reachable independent of the card UI — nothing currently stops a direct call to `logMed('some-paused-id', ...)`. Recommend adding an explicit `if (med.paused) return { locked: true, paused: true };` as the very first line of `status()` (before the `zofran` check) as defense-in-depth, even though the primary UI gate is the card-layout bypass. Cheap, and closes a real gap (e.g. a stale card reference from a race between renders).
- **`missedDosesFor(dayTs, now)`** (line 625, guard at line 631): add `if (med.paused) return;` alongside `if (med.treatmentOnly && !treatmentActiveOn(med, d0)) return;` (line 631) — otherwise a paused medication starts accumulating "missed dose" flags starting the next scheduled window.
  - **Important nuance the old brief also flagged, confirmed still true**: this check uses the medication's *current* `paused` flag regardless of `dayTs` argument, since there's no historical "was this medication paused on day X" log — a medication paused today and resumed next week will not retroactively flag any of the paused days as missed once resumed, and (more subtly) **any currently-paused medication's missed-dose rows also vanish retroactively from `renderHistory`** (line 3366: `missedDosesFor(k, now)` is called once per historical day when building the History list) and from `clearAllMissedInHistory` (line 1448) — **not just from Home's banner**. This is a wider blast radius than "just Home" and needs explicit sign-off: pausing a medication today will make its past missed-dose flags (if any are still unresolved/undismissed) disappear from History too, for as long as it stays paused. This is very likely desired (consistent with "don't nag me about this"), but it's a real, cross-surface side effect, not confined to Home, and should be called out to Aaron and QA explicitly — see Open Question 4.
- **`doseProgressToday(now)`** (line 665, guard at line 670): add `if (med.paused) return;` alongside the `treatmentOnly` guard so a paused medication doesn't count as an incomplete dose against the header's dose-completion ring.
- **`dueRemindersAt(nowDate)`** (line 3836, guard at line 3844): add `if (med.paused) return;` in the same `forEach` (line 3842) that already has `if (med.treatmentOnly && !treatmentActiveOn(med, nowTs)) return;` (line 3844) — a one-line addition next to existing, working prior art. This is the entire reminder-gating change needed; there is no separate hardcoded-id engine to patch (that was the stale brief's error).
- **History/Reports — do NOT touch `state.entries`, `entriesFor`, or `nameOf`.** `entriesFor(id)` (line 449) and Reports' `renderHistory`/other report renderers key off `state.entries` directly; nothing there needs a `paused` filter, and none should be added — a medication's actual logged dose history must stay fully visible regardless of current pause state. The one legitimate, and unavoidable, "History changes" side effect is the **synthetic missed-dose rows** described above (a `missedDosesFor` side effect, not a `state.entries` change) — flag this distinction explicitly during implementation review so nobody conflates "don't touch Reports" with "don't touch anything `missedDosesFor` feeds," which include History.

### Alternative approach considered: single `status` enum instead of a `paused` boolean

E.g. `availability: 'active' | 'paused' | 'excluded-window'`. A single enum forecloses ever combining "paused" with "excluded window" and is arguably cleaner in `status()`. But it's a bigger migration (nothing to migrate away from today, since neither field exists yet, but it does foreclose a legitimate combination: a medication can reasonably be both individually paused right now AND configured to auto-exclude near every future treatment day — different questions, both true at once). Recommend two independent fields (`paused` boolean + Feature 2's `treatmentWindowMode`), with `paused` simply taking precedence wherever both are checked — no enum needed.

---

## Feature 2: Configurable "excluded during treatment window"

### Recommended data model

`treatmentActiveOn(med, dayTs)` (lines 578–584) is already the exact shared day-window helper needed — it takes `med`, reads `med.treatmentDaysBefore`/`treatmentDaysAfter`, and returns whether "now" falls inside the configured window. **It does not need to be duplicated or rewritten** — the only new concept is *which direction* "active" means "available."

Add one new field to `normalizeMedication` (alongside `treatmentOnly`, lines 302–307) rather than inventing a second boolean pair sharing the same day-count fields:

```js
treatmentMode: ['only', 'excluded'].includes(original.treatmentMode) ? original.treatmentMode
  : (typeof original.treatmentOnly === 'boolean' ? (original.treatmentOnly ? 'only' : 'none') : 'none'),
```

- `treatmentMode`: `'none' | 'only' | 'excluded'`. Defaults to `'none'` for any medication with neither `treatmentMode` nor `treatmentOnly` set (i.e. every existing medication today) — zero behavior change.
- For a medication that already has `treatmentOnly: true` (a real, currently-shipped state — any medication using today's "Treatment-day medication" toggle), the fallback derives `treatmentMode: 'only'` automatically on load, so its existing `treatmentDaysBefore`/`treatmentDaysAfter` values keep meaning exactly what they mean today. **Recommend keeping `treatmentOnly` itself in the schema, written in lockstep with `treatmentMode` (`treatmentOnly = (treatmentMode === 'only')`)** rather than deleting it — this avoids a breaking read/write change to every existing call site that currently reads `med.treatmentOnly` directly (`medCards` line 2566, `missedDosesFor` line 631, `doseProgressToday` line 670, `dueRemindersAt` line 3844, `status` line 805, the manager badge line 3152) in this same pass. Those call sites can be migrated to read `treatmentMode` in a later, purely-mechanical cleanup if desired; for this feature, treat `treatmentOnly` as a derived/mirrored boolean the new picker keeps in sync, exactly the way `quickLog`/`groupedMorning`/etc. are kept in sync today by `saveMedicationEditor`.
- `treatmentDaysBefore`/`treatmentDaysAfter` are **reused as-is** — no new day-count fields. This directly answers the investigation question "can `treatmentActiveOn` be shared" — **yes**, unchanged; only the caller's interpretation of its return value flips for `'excluded'` mode.

New one-line helper (not new math, just an inversion at the call site — could equally be inlined, but a named helper documents intent):
```js
// Whether `med` is currently BLOCKED by its own configured treatment window (excluded mode only).
// 'only' mode's "outside window -> hidden" logic is unchanged, still read as !treatmentActiveOn(med, ...).
function treatmentExcludedNow(med, dayTs) {
  return med.treatmentMode === 'excluded' && treatmentActiveOn(med, dayTs);
}
```

### UI: single three-way choice vs. two independent toggles

**Recommendation: single three-way picker, not two toggles or a boolean-pair.** This codebase already has a proven, Aaron-approved precedent for exactly this shape: `placementOf`/`setPlacement`/`PLACEMENT_OPTIONS` (**lines 2973–3002**), the v13 "Home screen placement" `radiogroup` (rendered **lines 3069–3078**) that replaced four independent placement booleans with one mutually-exclusive picker — Aaron approved this exact pattern (README's app-v13 row: "the four additive Home-placement toggles are now ONE single-choice... picker"). Reuse the same visual/interaction language: a `role="radiogroup"` of pill-buttons (`'◉ '`/`'○ '` filled/empty circle prefix, same active/inactive styling as lines 3073–3076), not the `renderPillToggle` boolean-switch look (which is for independent on/off settings, and is already used correctly elsewhere in the same screen for genuinely independent toggles).

Three options: **Always available** / **Only near treatment day** (today's `treatmentOnly`, renamed to fit the group) / **Excluded near treatment day** (new). Selecting either of the latter two reveals the existing days-before/after number inputs (same fields, same `clampTreatmentDays`-backed save logic, currently at lines 3083–3089) — no new input fields, just a shared conditional block gated on `form.treatmentMode !== 'none'` instead of `form.treatmentOnly`.

Why not two independent toggles or a boolean pair (`treatmentOnly`/`treatmentExcluded`): both would let the same shared `treatmentDaysBefore`/`treatmentDaysAfter` pair mean two contradictory things if both were somehow true at once ("only available in this window" and "unavailable in this window" for the identical window), which the code would then have to arbitrarily tie-break. A three-way picker makes that state unrepresentable by construction — no validation code needed, no error message needed. This also directly avoids repeating the mistake Aaron already flagged once (the free-text "Schedule windows" field, still at line 3063 today, mixing multiple concerns in one input) by not asking the user to reconcile two separate controls that secretly share state.

### Med editor placement

Replace the single `renderPillToggle('Treatment-day medication', ...)` call (line 3081) with the three-way radiogroup, in its own full-width block (`gridColumn: '1 / -1'`, matching how "Days taken" already spans full width at line 3039) — not squeezed into the existing 220px-tile toggle grid at line 3080, since it now needs room for three options plus the conditional day-count fields. Keep the existing conditional days-before/after block (lines 3083–3089) exactly as styled today, just re-gated on the new field. Do not place this anywhere near the "Schedule windows" free-text field (line 3063) — keep it visually grouped with "Home screen placement" (line 3069) instead, since both are now "how/when this medication is reachable" concepts using the same picker idiom.

---

## Full blast-radius list

| Location | Line(s) | What it does today | Change needed |
|---|---|---|---|
| `status(med)` | 759–812 | Computes locked/available/ceiling/chemo-block state | Add `paused` early-return (defense-in-depth; primary gate is the card-layout bypass) |
| `medCards` filter/map | 2566–2670 | Home Quick Log card population | Add `paused` inert-card branch, checked FIRST (before in-patient/not-scheduled); extend the `treatmentOnly` filter clause (line 2566) to also exclude when `treatmentExcludedNow(med, now)` is true |
| `renderGroupedMedsCard` | 1569–~1620 (esp. `dueMeds` at 1571, rows 1579–1618) | Morning/Afternoon/Evening grouped cards | Add `paused` to `dueMeds` filter and a per-row inert branch (mirrors 1579–1585); add `treatmentExcludedNow` exclusion here too — this function currently has NO `treatmentOnly` gating at all, a pre-existing gap worth closing in the same pass |
| `missedDosesFor` | 625–660, guard at 631 | Missed-dose detection feeding Home banner, header pinned card, Today's Journal, AND `renderHistory` | Add `paused` and `treatmentExcludedNow` guards next to the existing `treatmentOnly` guard (line 631). **Flag: this retroactively hides missed-dose rows for currently-paused meds in History too (line 3366), not just Home — confirm this is desired (Open Question 4)** |
| `doseProgressToday` | 665–677, guard at 670 | Header dose-completion ring | Same guard addition |
| `dueRemindersAt` | 3836–3860, guard at 3844 | Generic per-medication reminder engine | Add `if (med.paused) return;` / `treatmentExcludedNow` check in the same `forEach` (line 3842), next to the existing `treatmentOnly` line (3844) |
| `renderMedicationManager` cards | 3097–~3175 (badge row ~3146–3153) | Meds tab list | Add a "Paused" badge and an "Excluded near treatment −N/+M" badge alongside the existing `treatmentOnly` badge (line 3152) — informational only, this list must not hide anything |
| `formatRuleSummary` | 2733–2749 | One-line rule summary in the Meds tab list | Optionally prepend "Paused" so the list is scannable without opening the editor |
| `medicationFormFrom` / `saveMedicationEditor` | 2761–2790 / 2861–2924 | Editor form ↔ saved medication mapping | Add `paused` (read-only display + a Pause/Resume action, not a form field the Save button controls — see Open Question 2) and `treatmentMode` on both sides; keep `treatmentOnly` mirrored in `saveMedicationEditor`'s candidate object (~line 2907) so existing readers keep working unmodified |
| `normalizeMedication` | 276–~320 | Load/save-time field normalization | Add `paused`, `pausedCheckinDate`, `treatmentMode` (deriving from legacy `treatmentOnly` when unset), keep `treatmentOnly` mirrored |
| Home `parts` array | 2154 onward | Every Home persistent banner | Add the new daily Pause check-in banner (after the Treatment banner, ~line 2236) |
| `renderHistory` / `clearAllMissedInHistory` / Today's Journal | 3366 / 1448 / 2698 | All three call `missedDosesFor` directly | **No direct edit needed** — they inherit the `paused` guard automatically once it's added inside `missedDosesFor` itself. Still must be explicitly verified during QA since the effect is indirect (see flag above) |
| `entriesFor` / `nameOf` / Reports rendering in general | 449, 699, rest of Reports | Past logged entries | **Do NOT add any `paused`/`treatmentMode` filter here.** Verify during review that no edit touched `state.entries` reads |
| `RESERVED_LEGACY_MED_IDS` / `dexActiveOn` / `zofranBlockedOn` / `dexWindowsForOffset` | 2833, 572, 589, 590 | Dexamethasone/Zofran's own id-gated legacy behavior | **Leave untouched.** Confirmed not touched by v16–v18 to date; this feature must not route them through the new generalized fields |

---

## Open questions for Aaron (via Lead Developer)

1. **Does a paused medication's Home card stay visible showing "Paused," or disappear entirely?** Aaron's spec text implies visible-with-label (a status label needs somewhere to render). The codebase has precedent for both (`treatmentOnly` hides the card entirely outside its window today; in-patient/not-scheduled keep an inert card). **Recommendation: keep the card, inert layout, "Paused" label, inline Resume** — see Feature 1 reasoning above. This is a UX call, not purely technical, and needs Aaron's confirmation.
2. **Should a paused medication's dose-log buttons be fully disabled, or tappable with an override** (like the existing ceiling/chemo-block override flow at lines 2625–2639)? Recommendation: fully disabled, no override — resuming first is one tap away via the card's inline Resume button. Flag if Aaron wants an emergency "log one dose without fully resuming" path.
3. **"Pinned banner at the top of the app"** — sticky header (every tab, reserved today for the safety-urgent past-missed-doses count) or Home-body persistent banner (Home tab only, but always renders first, used for every other daily check-in)? Recommendation: Home-body, matching Bowel/Weight/Appetite in cadence and severity. Confirm this reading of "pinned," since the sticky header is technically also pinned and more visible.
4. **Retroactive missed-dose disappearance is not scoped to Home.** Because `missedDosesFor` is shared by Home's banner, the header's pinned past-missed count, Today's Journal, `clearAllMissedInHistory`, AND `renderHistory` itself, gating it on the medication's *current* `paused` flag means a currently-paused medication's unresolved missed-dose rows vanish from **History**, not just Home, for as long as it's paused (they are not deleted — `state.entries`/`dismissedMisses` are untouched — they simply stop being computed while `paused` is true). Confirm this cross-surface effect is intended (almost certainly yes, but it's broader than "just Home," so worth an explicit yes).
5. **Can a medication be both paused and configured with `treatmentMode: 'excluded'`/`'only'` at the same time?** Design allows it (independent fields), with `paused` taking precedence everywhere. Confirm acceptable, or whether the editor should discourage/block configuring a treatment window on a currently-paused medication (recommendation: allow it, no blocking needed — "pause this right now for any reason" and "always skip it near treatment day" are different, coexisting questions).
6. **Copy/naming**: keep "Treatment-day medication" → rename to "Only near treatment day" to fit the new three-way picker's parallel construction with "Excluded near treatment day" and "Always available"? Flag as a copy decision, not a blocker — the app already migrated "Chemo" → "Treatment" wording in v16 for consistency with radiation patients.

---

## Definition of done

**Feature 1 — Pause:**
- [ ] `paused` (boolean, default `false`) and `pausedCheckinDate` (number or `null`) added to `normalizeMedication`; existing saved configs load with zero visible change.
- [ ] `status()` returns a paused-aware shape as defense-in-depth; primary gating is the card-layout bypass.
- [ ] Home Quick Log card shows the inert "Paused" layout (no dose buttons, inline Resume) for both standalone (`medCards`) and grouped (`renderGroupedMedsCard`) placements, checked before in-patient/not-scheduled.
- [ ] `missedDosesFor` and `doseProgressToday` both skip paused medications; `dueRemindersAt` skips them too (verified with `TEST_MODE` temporarily off in a local-only test, never committed as off).
- [ ] Daily "Still need to pause {med}?" banner appears on Home once per calendar day per paused-and-unconfirmed medication; "Continue pausing" re-stamps `pausedCheckinDate` and dismisses for the day; "Resume" clears `paused`/`pausedCheckinDate` and the medication returns to normal immediately.
- [ ] Confirmed: no `state.entries`/Reports-rendering code path was touched; a paused medication's past logged doses remain fully visible in History.
- [ ] Confirmed and documented (per Open Question 4): a paused medication's *unresolved missed-dose flags* (synthetic, from `missedDosesFor`) disappear from History while paused — verified as intended behavior, not an accidental regression.
- [ ] Meds tab shows a "Paused" badge; editor exposes a Pause/Resume action (not routed through the Save-changes flow the way form fields are, since pause/resume should take effect immediately, matching `moveReorderableMed`'s immediate-persist pattern).
- [ ] Manual test: pause a medication, use `shiftSimDate` (line 439, `TEST_MODE`-only) to cross a midnight boundary, confirm the banner reappears and "answered today" holds across a simulated reload (re-render from scratch, not just re-render-in-place).

**Feature 2 — Excluded near treatment day:**
- [ ] `treatmentMode` (`'none' | 'only' | 'excluded'`) added to `normalizeMedication`, deriving `'only'` from any existing `treatmentOnly: true` medication with no explicit `treatmentMode` set; `treatmentOnly` kept mirrored in lockstep so existing readers (medCards line 2566, missedDosesFor line 631, doseProgressToday line 670, dueRemindersAt line 3844, status line 805, manager badge line 3152) need no changes in this pass.
- [ ] `treatmentActiveOn(med, dayTs)` (unchanged) reused for both `'only'` and `'excluded'` interpretation; new `treatmentExcludedNow(med, dayTs)` helper added for the inverted read.
- [ ] Med editor's "Treatment-day medication" toggle replaced by a three-way radiogroup (Always available / Only near treatment day / Excluded near treatment day), styled like the existing "Home screen placement" picker (lines 2973–3002, 3069–3078), with the existing days-before/after fields shown for either non-"none" mode.
- [ ] `medCards`, `renderGroupedMedsCard`, `missedDosesFor`, `doseProgressToday`, `dueRemindersAt` all updated to treat `'excluded'` mode as unavailable during its window, alongside the unchanged `'only'`/`treatmentOnly` behavior.
- [ ] `renderGroupedMedsCard`'s pre-existing gap (no `treatmentOnly` gating at all today) closed for both `'only'` and `'excluded'` modes in the same pass.
- [ ] Dexamethasone/Zofran's own id-gated legacy logic (`dexActiveOn`, `zofranBlockedOn`, `dexWindowsForOffset`) confirmed untouched and behaving identically for those two reserved ids.
- [ ] Manual test: create a new medication, set "Excluded near treatment day" with a 2-day-before/1-day-after window, set a treatment date, confirm the card disappears from Home exactly during that window and reappears outside it, with no change to any other medication.
- [ ] Manual test: confirm a medication already using `treatmentOnly: true` before this change behaves identically after migration (same window, same "only" semantics, `treatmentMode` correctly derived to `'only'`).

**Both features:**
- [ ] `node --check index.html` clean.
- [ ] `TEST_MODE` remains `true` in the committed file (per `APP_CLAUDE.md` rule 4) — reminder-engine testing done via temporary local override only, never committed.
- [ ] No changes to `state.entries`, `entriesFor`, or any Reports/History function beyond the documented, expected `missedDosesFor`-driven side effect (Open Question 4).
- [ ] No changes to `RESERVED_LEGACY_MED_IDS` or the Dexamethasone/Zofran-specific functions.
- [ ] `localStorage` schema change is additive only — an existing saved medication config, loaded with the new code, produces medications functionally identical to before (verify by diffing `normalizeMedication`'s output on a representative pre-existing saved config, before vs. after).
