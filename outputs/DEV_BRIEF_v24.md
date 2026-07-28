# DEV_BRIEF_v24 — Notification pipeline dead-on-arrival + two new Calendar reminder options

Author: Developer stage (Full Chain, TEAM.md). Investigation + brief only — no code changed.

## Investigation Findings

### 1. Root cause confirmed — with one important correction/addition to the Lead Developer's note

I independently read every line cited and confirm the core finding is right:

- `index.html:54` — `const TEST_MODE = true;` unconditionally, on the exact build Aaron tests
  (`https://arnjnnngs.github.io/chemowell-app-beta/`).
- `index.html:4744-4756` (`checkNotifications`, med dose reminders) and `index.html:4778-4791`
  (`checkAppointmentReminders`, calendar reminders) both open with
  `if (TEST_MODE && !isNativeApp()) return;`. Since `isNativeApp()` (`index.html:80-83`) is only
  ever true inside the Capacitor-wrapped APK and `TEST_MODE` is hardcoded `true`, **both gates
  always return true on the web build, unconditionally, every tick** — not just while Aaron has
  the date simulated. This exactly matches Aaron's repro (10 AM appointment, "1 hour before"
  reminder, nothing fired at 9 AM) and matches his broader complaint ("no notifications working
  to my knowledge") — it's not an intermittent bug, it's total and permanent on web.
- Confirmed via `README.md`'s app-v14 entry: this gate was written intentionally at the time
  native local notifications were added, specifically so the *native test APK* could fire real
  notifications under `TEST_MODE` while the web build stayed silent. It was reasonable in that
  narrow context (v14, no Calendar feature yet) but was never revisited when Calendar reminders
  shipped in app-v22 expecting to work — and app-v22's own FAQ copy (`index.html:1469`) tells
  Aaron "You'll need to allow notifications when asked for the reminder to actually fire," which
  is actively misleading given the gate makes that moot on web regardless of permission state.
  Settings' own Notifications section (`index.html:4100-4104`) reinforces the confusion further —
  on non-native it currently reads *"Dose reminders and missed-dose alerts arrive with the
  phone-app version (in progress)"*, i.e. the app itself tells Aaron notifications aren't a web
  feature yet, even though Calendar reminders (app-v22) were explicitly built to use this same
  path on web. That line needs to change as part of this fix (see Done Criteria).
- `index.html:3935` — same-shaped bug in the one-time permission-request call inside
  `confirmApptModal()`: `if (m.reminder && ... && !isNativeApp() && !TEST_MODE) requestNotifPermission();`
  never fires on web today. Confirmed a *separate*, unconditional call already exists —
  `subscribePush()` (`index.html:234`) → `requestNotifPermission()` — invoked once at page load
  (`index.html:4793`), with no `TEST_MODE`/`isNativeApp` gating at all. So permission *has* been
  requested from every web session Aaron has ever loaded the beta in; whatever he answered (or
  didn't) at that one browser prompt is the actual current `Notification.permission` state and it
  persists per-origin regardless of code changes here. This means: after the gate fix ships,
  reminders may still not fire immediately if that permission is `denied` or was dismissed as
  `default` — see recommendation 4 below on how to make this visible/actionable to Aaron.
- `index.html:4816-4829` — confirmed: `setInterval(..., 1000)` is the only thing driving
  `checkNotifications()`/`checkAppointmentReminders()`. There is no service-worker push
  subscription, no background sync, nothing native-push-like. `subscribePush()`
  (`index.html:234`) really is just `requestNotifPermission()` — it does not register a push
  subscription of any kind. **Confirmed: reminders on the web/PWA build only fire while the tab
  is open, unlocked, and in the foreground.** This is architectural, not a bug the gate fix
  touches.
- `index.html:4670-4698` (`sendNotif`) — confirmed web path is `new Notification(...)` with a
  service-worker `showNotification` fallback, both gated on `Notification.permission === 'granted'`;
  native path uses `Capacitor.Plugins.LocalNotifications.schedule`. No issue found here.
- `index.html:3894-3899` (`APPT_REMINDER_OPTIONS`) and `index.html:4763-4777`
  (`reminderTriggerTs`) — confirmed math is correct for the existing three options (1h/morning/1day),
  including the app-v22 audit fix that falls the "morning of 9 AM" option back to 1-hour-before
  when the appointment itself is earlier than 9 AM. No new bug found in the existing math.

### 2. Additional finding not in the original note — the simulated-date correctness hazard is real, not just a UX nicety

I verified whether `checkNotifications`/`checkAppointmentReminders`/`reminderTriggerTs` actually
*depend* on `simNow()`/`state.dateOffsetDays`, or only on real `Date.now()`/`new Date()`:

- `checkNotifications()` calls `dueRemindersAt(new Date())` — real wall-clock time.
- `checkAppointmentReminders()` uses `Date.now()` directly (`index.html:4781`) and
  `reminderTriggerTs(appt)` operates only on `appt.ts`, a real epoch timestamp. Neither touches
  `simNow()`.

So the trigger-time *computation* is already 100% real-wall-clock-safe and does not itself go
wrong when the date is simulated. However, I traced where **dose entry timestamps** come from and
found the actual hazard: dose logging (`confirmTimeAndLog()`, `index.html:1063-1104`) stamps
`ts = new Date(m.timeValue).getTime()`, and `m.timeValue` defaults to `nowLocalISO()` →
`toLocalISO(simNow())` (`index.html:839`, `1060`). **So a dose logged while Aaron has the date
simulated is stamped with a simulated (offset) timestamp, not a real one.**

`dueRemindersAt()` (`index.html:4710-4742`) determines whether a dose window is "taken" by
checking `entriesFor(med.id).some(e => e.ts >= ws && e.ts < we)`, where `ws`/`we` are today's
window bounds computed from **real** `Date.now()` (via the real `new Date()` passed into it).
Concretely: if Aaron jumps `state.dateOffsetDays` forward to test a future day, logs a dose there
(timestamp lands on that simulated future day), and then a real-time tick evaluates
`dueRemindersAt(new Date())` for the *real* current day/window — that dose won't be found within
the real day's window bounds, so the medication would look "not taken" for real-today and could
fire a **spurious, factually wrong "dose due" notification** even though Aaron logged it (just on
a simulated day). This is a genuine correctness bug waiting to happen, not merely a
confusing-notification UX concern — it directly justifies gating notifications off while the date
is simulated, on top of the UX argument that a real notification arriving while Home is
deliberately showing a fake "today" would look broken to Aaron mid-test.

The same reasoning extends to Calendar: `openApptModal(null)` defaults a new appointment's date
picker/cursor off `simNow()` (`index.html:3909-3910`), so an appointment Aaron adds while
time-traveling could carry a `ts` he *intends* as "relative to the simulated today" even though
it's stored as a real epoch value — the trigger math will still evaluate it against real time
correctly, but Aaron's mental model while testing (what "today"/"this appointment" means) and the
real notification clock diverge, which is confusing during a test session even without a hard bug.

**Conclusion: gate both `checkNotifications()` and `checkAppointmentReminders()` identically**,
on real simulated-date state, not on `TEST_MODE` alone. See Recommended Approach.

### 3. No other bugs found in scope

- `notifSentToday`/`resetNotifTracking()` (`index.html:4647-4654`) key off real `Date.now()`, not
  `simNow()` — no dedup bug.
- `checkNotifications()`'s extra guard `if (!state.loaded || state.entries.length === 0 &&
  !state.demo) return;` (`index.html:4750`) means dose reminders never fire until at least one
  entry exists anywhere in the profile. This is pre-existing (not part of Aaron's repro, which was
  a Calendar reminder) and not obviously wrong, but flag it as a corner case worth Aaron knowing:
  a brand-new profile with a scheduled medication but zero logged doses of *anything* yet will not
  get a dose reminder until the first entry of any kind exists. Not proposing a change — just
  documenting it since it's adjacent to "why didn't I get a reminder."
- `checkAppointmentReminders()` has no quiet-hours guard (dose reminders do, `index.html:4715`:
  no notifications 10 PM–8 AM). This looks intentional (an early-morning appointment reminder
  legitimately needs to fire before 8 AM), but flagging as an open question since it wasn't
  explicitly decided anywhere in the code comments.
- `reminderTriggerTs`/`checkAppointmentReminders`' staleness guard
  (`nowTs > appt.ts + 86400000` → skip, `index.html:4787`) is unaffected by anything in this brief
  and works correctly today; no changes needed to it beyond making it aware of the two new
  reminder types (see Data Shape section).

## Recommended Approach

### Gate fix

Replace, in both `checkNotifications()` (`index.html:4748`) and `checkAppointmentReminders()`
(`index.html:4779`):

```js
if (TEST_MODE && !isNativeApp()) return;
```

with:

```js
if (TEST_MODE && !isNativeApp() && !!state.dateOffsetDays) return;
```

i.e. the Lead Developer's proposed condition, confirmed correct and now with a concrete
correctness justification (section 2 above), not just a UX one. Apply it **identically to both
functions** — there's no reason for dose reminders and calendar reminders to diverge here, and
`state.dateOffsetDays` resets to `0` on every reload anyway (`index.html:477` — deliberately not
persisted to sessionStorage), so a typical Aaron session that never touches Beta Date Controls
starts, and stays, at `dateOffsetDays === 0` and gets real reminders throughout.

Also fix the permission-request gate at `index.html:3935` the same way:

```js
if (m.reminder && m.reminder !== 'none' && !isNativeApp() && !TEST_MODE) requestNotifPermission();
```
→
```js
if (m.reminder && m.reminder !== 'none' && !isNativeApp() && !(TEST_MODE && !!state.dateOffsetDays)) requestNotifPermission();
```

This one is lower-stakes than the two check functions (it's a no-op once permission is already
granted/denied, per the comment at `index.html:230-232`), but should still be consistent with the
same rule for the same reason, and there's no cost to fixing it.

### Alternative considered and rejected

**Option B: drop the `TEST_MODE` check entirely and gate solely on `isNativeApp() ||
!state.dateOffsetDays`** (i.e. treat `TEST_MODE` as irrelevant to notifications going forward).
Functionally identical to the recommended fix *today*, since `TEST_MODE` is currently always
`true` on this build — but rejected because it silently changes behavior the day someone flips
`TEST_MODE` to `false` in prep for a real production/store build (per `APP_CLAUDE.md` rule 4:
"Keep `TEST_MODE = true` ... until store submission prep"). Keeping the `TEST_MODE &&` prefix
means the whole gate correctly evaporates to "notifications always allowed" once `TEST_MODE`
finally does go false for a real release, with zero further code change needed at that point —
that's the entire reason `TEST_MODE` exists as a flag rather than being deleted outright. Losing
that free forward-compatibility for no behavioral gain now isn't worth it.

**Option C considered and rejected: gate on `isNativeApp() || dateOffsetDays === 0` without the
`TEST_MODE &&` guard at all (same as B), but scoped only to `checkAppointmentReminders`, leaving
`checkNotifications` untouched.** Rejected per Aaron's explicit ask ("not just the one repro, the
whole notification pipeline... since they may share machinery") — both functions have the
identical bug for the identical reason, and section 2 shows dose reminders have the *stronger*
correctness argument for the `dateOffsetDays` check (the spurious-notification risk from
simulated-timestamp dose entries applies to dose reminders specifically, not appointments). Fixing
only one would leave dose reminders permanently dead, contradicting the explicit ask.

## Foreground-only limitation — must be surfaced to Aaron

Confirmed architectural (section 1, `index.html:4816-4829`, `234`): the web/PWA build cannot
deliver a reminder while the tab isn't open and in the foreground — locked phone, backgrounded
tab, fully closed browser, all silently produce no notification, gate fix notwithstanding. This is
not something the gate fix resolves and should not be implied to Aaron as "fixed" in the release
notes without this caveat, or he will reasonably expect background delivery like the native APK
promises (real `LocalNotifications.schedule`, which the OS delivers even backgrounded) and will
file this as a new bug the next time he locks his phone before 9 AM.

**Recommendation:** surface this in two places, not one:
1. **README.md version-history entry for this release** — state plainly that the fix makes
   reminders work while the web app is open in a foreground tab, and that background/locked-phone
   delivery requires the native APK, not the web beta.
2. **In-app copy**, since Aaron is non-technical and won't necessarily read README: update the
   Settings → Notifications section (`index.html:4100-4104`) — see Done Criteria below for the
   replacement copy. This is the natural home since it's already the section that talks about
   notification behavior differences between native and web.

## Notification-permission status/action in Settings — recommended, with exact placement/copy

Recommend **yes**, add this, for two concrete reasons surfaced by the investigation: (1) the one
prompt Aaron ever saw was silent/automatic at page load with no in-app record of what he answered,
and (2) if he denied it (or dismissed it) there is currently zero way to retry — browsers refuse
to re-prompt once a user has explicitly denied `Notification` permission; only the browser's own
site-settings UI can undo that, which Aaron won't know to find.

**Where:** Settings → Notifications section, `index.html:4100-4104`, right below the existing
descriptive line, non-native branch only (native/Capacitor permission flow already has its own
OS-level prompt/settings surface and doesn't need this — `isNativeApp()` branch stays as-is except
for the copy caveat above).

**What it should show/do**, three states read from `Notification.permission` (`'default' |
'granted' | 'denied'`), re-evaluated on every Settings render (cheap synchronous read, no need to
cache):

- `'granted'` — a calm, existing-recipe status line, e.g. green/success-tone chip: "Notifications
  are on. Reminders will fire while this app is open in your browser." No action needed, no button.
- `'default'` (never answered, or the browser hasn't asked yet) — status line "Notifications
  haven't been turned on yet" + a button "Turn on notifications" that calls
  `requestNotifPermission()` directly (already exists, already safe to call repeatedly per its own
  comment at `index.html:230-232`) and re-renders after the browser's async prompt resolves so the
  status line updates immediately without a manual refresh.
- `'denied'` — status line "Notifications are blocked in your browser for this app" + short
  instruction copy, since JS cannot reopen the prompt once denied: "To turn them back on, use your
  browser's site settings for this page and allow notifications, then reload." (Exact browser path
  varies by browser/OS, so keep this generic rather than naming a specific menu that will be wrong
  on some device — a caregiver-facing app shouldn't give confidently wrong instructions.)

This satisfies Aaron's stated problem directly: right now there is no way for him to tell if
permission is granted, and no way to re-trigger it — this closes both gaps with the smallest
surface area (one section, no new screen, reuses existing `requestNotifPermission()`).

## Design the two new reminder options

### Option A: "At the scheduled time"

- Add to `APPT_REMINDER_OPTIONS` (`index.html:3894-3899`): `{ id: 'attime', label: 'At the
  scheduled time' }`.
- `reminderTriggerTs()` (`index.html:4763-4777`): add `if (appt.reminder === 'attime') return
  appt.ts;` — fires the same instant as the appointment itself. No new data fields needed for this
  option; it's a pure addition to the existing id-based branch structure.
- No edge cases beyond what the other fixed options already handle (staleness guard at
  `index.html:4787` still applies unchanged — `nowTs > appt.ts + 86400000` still correctly retires
  it a day late if the app wasn't open at the moment).

### Option B: Custom lead time

**UI** (in `renderApptModal()`, `index.html:3959-3962`, the "Remind me" `<select>`): add a
`{ id: 'custom', label: 'Custom...' }` option to `APPT_REMINDER_OPTIONS`. When `m.reminder ===
'custom'`, render two additional inline controls directly below the select (same visual language
as the existing Liters-drained conditional field from app-v21, i.e. reuse that
show-a-field-when-a-related-choice-is-selected pattern already established in this file):
- A `number` input, `min="0"`, `step="1"`, bound to `state.apptModal.customValue`, label "Remind
  me before" (placeholder e.g. `30`).
- A `<select>` for the unit, bound to `state.apptModal.customUnit`, options `minutes` / `hours` /
  `days` (default `minutes`), styled with the existing `selectFix`/custom-chevron treatment
  app-wide selects already get (per app-v23's global select restyling — don't ship a new
  unstyled dropdown).
- A live plain-language preview line under the two controls, e.g. "Reminds 45 minutes before" —
  matches the pattern already used for schedule-window time pickers (app-v20's "Reminds between
  8:00 AM and 8:30 AM" preview) so this feels consistent with an existing, already-shipped UI
  convention rather than novel.

**Data shape stored on the appointment object** (alongside existing `title`/`note`/`reminder`/`ts`
in `addAppointment`/`updateAppointment`, `index.html:202-214`):
- `reminderCustomValue: number` (the entered lead-time amount, always non-negative integer)
- `reminderCustomUnit: 'minutes' | 'hours' | 'days'`

Only meaningful/present when `reminder === 'custom'`; leave them on the object (don't delete) if
Aaron switches away and back to `custom` during the same edit session, so the form remembers the
last value he typed rather than resetting to blank — matches how the modal already preserves other
draft fields across in-modal changes.

**`reminderTriggerTs()` change:**
```js
if (appt.reminder === 'custom') {
  const n = Number(appt.reminderCustomValue);
  if (!Number.isFinite(n) || n < 0) return null; // malformed/negative — no reminder rather than a wrong one
  const unitMs = appt.reminderCustomUnit === 'days' ? 86400000
    : appt.reminderCustomUnit === 'hours' ? 3600000
    : 60000; // minutes, also the default for unrecognized/missing unit
  return appt.ts - n * unitMs;
}
```
Falling back to `null` (no reminder fires) for malformed data is consistent with the function's
existing contract — `null` already means "no reminder" for `'none'`/unset (`index.html:4776`), and
`checkAppointmentReminders()` already treats `triggerTs == null` as skip (`index.html:4787`).

**`apptReminderLabel()` must take the full appointment, not just the id** — confirmed only one
call site today (`index.html:3989`, `apptReminderLabel(appt.reminder)`), so this is a safe
signature change with a single caller to update:
```js
function apptReminderLabel(appt) {
  if (appt.reminder === 'custom') {
    const n = appt.reminderCustomValue, unit = appt.reminderCustomUnit || 'minutes';
    if (!Number.isFinite(n) || n < 0) return 'Custom reminder'; // malformed — degrade gracefully, don't crash the list row
    if (n === 0) return 'At the scheduled time'; // 0 lead time is functionally identical to Option A — say so, don't say "0 minutes before"
    const unitLabel = unit === 'days' ? (n === 1 ? 'day' : 'days') : unit === 'hours' ? (n === 1 ? 'hour' : 'hours') : (n === 1 ? 'minute' : 'minutes');
    return n + ' ' + unitLabel + ' before';
  }
  const r = APPT_REMINDER_OPTIONS.find(x => x.id === appt.reminder);
  return r ? r.label : 'No reminder';
}
```
Update the sole call site to `apptReminderLabel(appt)`.

### Edge cases (explicitly worked through per the brief's ask)

- **0 custom value**: valid, not an error — means "remind me right when it happens," functionally
  identical to Option A. Don't block it at save time; the label function above already renders it
  sensibly ("At the scheduled time") rather than the deadpan-wrong "0 minutes before."
- **Negative custom value**: block at save time in `confirmApptModal()`
  (`index.html:3914-3939`), same validation pattern already used for the Liters-drained field
  (`index.html:1119-1122`, "Enter a valid liters amount (0–20), or leave it blank."): if
  `m.reminder === 'custom'` and `(isNaN(Number(m.customValue)) || Number(m.customValue) < 0)`,
  `setToast('Enter a reminder time of 0 or more.'); return;` before building `payload`. Don't rely
  on `reminderTriggerTs`'s `null`-fallback alone for this — that would let a malformed appointment
  save silently with a reminder that simply never fires, which is worse than blocking the save
  with a clear message, and is inconsistent with how every other validated field in this modal
  already behaves (title/date checks at `index.html:3917-3918` block-and-toast, they don't
  silently save something broken).
- **Editing an appointment that already has a custom reminder**: `openApptModal(editId)`
  (`index.html:3902-3907`) needs to seed `state.apptModal.customValue`/`customUnit` from
  `appt.reminderCustomValue`/`appt.reminderCustomUnit` when populating the edit draft, the same
  way it already seeds `reminder: appt.reminder || 'none'` — currently it does not, since those
  fields don't exist yet. Add them to the `setState({ apptModal: { ... } })` call.
- **`reminded`/re-arming logic when only the custom value changes** — this is a real gap in the
  existing comparison, confirmed by reading `index.html:3924-3933` closely. The current
  `reminderRelevantChange` check is:
  ```js
  const reminderRelevantChange = !prev || Math.floor(prev.ts / 60000) !== Math.floor(ts / 60000) || (prev.reminder || 'none') !== (m.reminder || 'none');
  ```
  If Aaron edits an already-`reminded: true` appointment and changes *only* the custom lead time
  (e.g. from "30 minutes before" to "2 hours before") without touching date/time or the `reminder`
  id itself (which stays `'custom'` in both), this comparison sees no change (`prev.reminder ===
  m.reminder === 'custom'`) and `reminded` stays `true` — so the reminder silently never re-arms
  even though the actual trigger timestamp changed and may now be in the future when it wasn't
  before. **This must be fixed as part of adding the custom option**, not left as a new latent bug:
  extend the comparison to also check the custom fields when the reminder type is `'custom'`:
  ```js
  const reminderRelevantChange = !prev
    || Math.floor(prev.ts / 60000) !== Math.floor(ts / 60000)
    || (prev.reminder || 'none') !== (m.reminder || 'none')
    || (m.reminder === 'custom' && (
         Number(prev.reminderCustomValue) !== Number(m.customValue)
         || (prev.reminderCustomUnit || 'minutes') !== (m.customUnit || 'minutes')
       ));
  ```
  Verify this doesn't over-fire for the *other* three options: none of 1h/morning/1day/attime carry
  any per-instance stored value, so this added clause is a no-op for them (the `m.reminder ===
  'custom'` guard means it only ever evaluates for custom-type reminders) — confirms no regression
  to the app-v22 audit fix this logic was originally built to protect.

## Data Shape / API Changes

| Item | Before | After |
|---|---|---|
| `APPT_REMINDER_OPTIONS` (`index.html:3894-3899`) | 4 entries: none/1h/morning/1day | +2: `attime` ("At the scheduled time"), `custom` ("Custom...") |
| Appointment object (`addAppointment`/`updateAppointment`) | `{id, title, note, reminder, ts, reminded}` | + optional `reminderCustomValue: number`, `reminderCustomUnit: 'minutes'\|'hours'\|'days'` — present only meaningfully when `reminder === 'custom'`, no migration needed for existing appointments (additive, `undefined` on old records is handled by the `Number.isFinite` guard) |
| `reminderTriggerTs(appt)` (`index.html:4763-4777`) | handles `'1h'`/`'1day'`/`'morning'` | + `'attime'` (returns `appt.ts`), + `'custom'` (returns `appt.ts - n*unitMs`, or `null` if malformed) |
| `apptReminderLabel(id)` → `apptReminderLabel(appt)` (`index.html:3900`) | takes reminder id string | takes full appointment object (needed to read `reminderCustomValue`/`reminderCustomUnit` for the custom label); **one call site to update** (`index.html:3989`) |
| `state.apptModal` draft shape (`openApptModal`, `index.html:3902-3911`) | `{editId, title, note, reminder, dateStr, time, calOpen, calCursor}` | + `customValue`, `customUnit`, seeded from the appointment on edit, defaulted (e.g. `customValue: 30, customUnit: 'minutes'`) on add |
| `checkNotifications()` gate (`index.html:4748`) | `if (TEST_MODE && !isNativeApp()) return;` | `if (TEST_MODE && !isNativeApp() && !!state.dateOffsetDays) return;` |
| `checkAppointmentReminders()` gate (`index.html:4779`) | same as above | same fix |
| Permission-request gate in `confirmApptModal()` (`index.html:3935`) | `!isNativeApp() && !TEST_MODE` | `!isNativeApp() && !(TEST_MODE && !!state.dateOffsetDays)` |
| Settings Notifications section (`index.html:4100-4104`) | native/non-native two-branch copy, non-native branch says feature is "in progress" | non-native branch rewritten to explain foreground-only web behavior + new permission-status block (see recommendation 4) |
| FAQ `calendar` item (`index.html:1469`) | lists 1h/morning/1day only | list all 5 options (add "at the scheduled time" and "a custom time you set") |

## Done Criteria

Must work:
1. On the web build, with `state.dateOffsetDays === 0` (i.e. Aaron hasn't touched Beta Date
   Controls, or has reset them) and `Notification.permission === 'granted'`, a calendar
   appointment's reminder fires a real browser notification at the correct real wall-clock trigger
   time, while the tab is open — reproducing and closing Aaron's original repro.
2. Same real-time firing confirmed for medication dose-window reminders (`checkNotifications`) —
   not just Calendar — per Aaron's explicit ask to check the whole pipeline.
3. With `state.dateOffsetDays !== 0` (Aaron has jumped the date), both reminder checks stay fully
   suppressed, exactly as before this fix — verify by jumping the date forward via Beta Date
   Controls with a due reminder pending and confirming nothing fires, then `resetSimDate()` and
   confirming it resumes working.
4. The 4 pre-existing reminder options (none/1h/morning/1day) save, edit, and fire identically to
   their current behavior — no regression to `reminderTriggerTs`'s existing branches or the
   app-v22 audit-fixed 9 AM-fallback behavior.
5. "At the scheduled time" and the custom option both save correctly, both re-open in the editor
   with their prior value/unit populated correctly, both display a correct human-readable label in
   the Calendar list row, and both actually fire a notification at their computed trigger time.
6. Custom option rejects negative input with a clear toast at save time (not a silent no-op
   reminder); accepts 0 and treats it as immediate/at-time.
7. Editing only the custom lead time on an already-fired (`reminded: true`) appointment correctly
   re-arms it (`reminded` resets to `false`); editing an unrelated field (note, title) on an
   already-fired custom-reminder appointment does **not** re-arm it — matches the existing
   behavior for the other 4 options exactly.
8. FAQ copy (`index.html:1469`) and Settings Notifications copy (`index.html:4100-4104`) both
   updated to reflect: all 5 reminder options exist, and web reminders require the tab open in
   the foreground (no background/locked-phone delivery without the native app).
9. Settings gains a visible, working "Turn on notifications" control for the `default`/`denied`
   permission states, and a "notifications are on" confirmation for `granted` — verify all three
   states render correctly (can be forced via the browser's own site-settings UI for testing).

Must NOT regress:
- The 3 pre-existing reminder options' exact current trigger math (1h/morning/1day), including
  the 9 AM-before-appointment fallback.
- The existing "editing an appointment shouldn't re-arm an already-fired reminder unless something
  reminder-relevant changed" behavior for the 4 pre-existing options — verify a note-only edit on
  an already-`reminded` 1h/morning/1day/attime appointment still leaves `reminded: true` untouched.
- `TEST_MODE`'s other beta-only features — Beta Date Controls UI (`index.html:1793`, guarded by
  `TEST_MODE` alone, unrelated to this fix and must stay visible/working regardless of
  `dateOffsetDays`), simulated purchases (`index.html:2043-2104`) — none of these are touched by
  this change; confirm by smoke-testing the Plans sheet's "Simulate purchase (beta)" and "Reset to
  Free" controls and the date-jump buttons still work exactly as before.
- Zero console errors across at least 3+ tick cycles (the existing bar every release in this repo
  uses) with the new gate condition and both new reminder options exercised.
- Mobile-first verification at 360–390px per TEAM.md's binding rule, not just desktop.

## Regressions To Avoid

(Superset already folded into Done Criteria above, called out separately per the brief template.)
- Do not let the new `apptReminderLabel(appt)` signature change silently break if any other call
  site is added later without checking this brief first — grep confirms exactly one call site
  today (`index.html:3989`), but the Lead Developer should re-grep after implementing to make sure
  no second call site was introduced elsewhere as part of this same release (e.g. if the Designer
  pass or a later fix adds a summary/preview somewhere else in the Calendar UI).
- Do not let the custom option's number input allow non-integer minute values that produce
  sub-minute trigger offsets — `dueRemindersAt`/`checkAppointmentReminders` both operate on
  whole-second ticks; fractional minutes aren't wrong exactly, just pointless precision that could
  confuse the live preview copy. Recommend `step="1"` on the number input (already specified
  above) rather than adding numeric rounding logic to `reminderTriggerTs`.
- Do not change `checkNotifications()`'s or `checkAppointmentReminders()`'s permission guard
  (`!isNativeApp() && (!('Notification' in window) || Notification.permission !== 'granted')`,
  `index.html:4749`/`4780`) — that's a separate, already-correct guard and isn't part of this fix;
  don't fold it into the `TEST_MODE` gate line by mistake when editing nearby.

## Open Questions For The Lead Developer

1. Should `checkAppointmentReminders()` gain the same quiet-hours suppression (10 PM–8 AM) that
   `dueRemindersAt()` already has for dose reminders (`index.html:4715`)? Not part of Aaron's
   reported bug and not clearly a defect (an early-morning lab-draw reminder legitimately needs to
   fire before 8 AM), so I'm not recommending a change — flagging only so it's a deliberate
   decision, not an oversight, in case Aaron gets an actual middle-of-the-night appointment
   reminder and reports it as a new bug later.
2. `checkNotifications()`'s existing "no entries at all yet" suppression (`index.html:4750`) will
   now start actually mattering for the first time on web (it was previously moot behind the
   `TEST_MODE` gate). Worth a quick regression check post-fix: a brand-new profile with a
   scheduled medication with `alerts` on, zero entries logged for *anything*, should confirm
   whether Aaron would expect a reminder there or not — I'd guess he would, since "no doses logged
   yet" is exactly when a reminder is most useful, but this predates this release and wasn't part
   of my brief's scope to redesign. Recommend leaving as-is unless the Auditor stage finds it
   surprising in practice.
3. Exact wording for the three permission-status copy variants (recommendation 4) is drafted above
   as a starting point, not final — TEAM.md's copy-review process routes final wording through the
   Designer stage anyway, so treat my copy as implementation-ready but not sign-off-final.
