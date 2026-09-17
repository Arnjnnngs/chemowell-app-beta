AUDITED-COMMIT: cbc0520
VERDICT: SHIP

Zero Day Auditor, app-v85 second delta. Re-audit of `outputs/AUDIT-app-v85-delta.md` (f3f1880) and
`outputs/AUDIT-app-v85.md` (21b8123). Everything below was measured at `cbc0520`.

---

# HEADLINE

**Both blockers are closed, the fail-open guard is genuinely closed in every direction I could
reach, and the code is shippable.** Three things to carry out of this pass, none of which is a
defect a user can hit:

1. **The README row makes three claims that are not true**, and one of them is *"this sandbox cannot
   complete a native sync"* — **I drove the card to `on` and to `on-exact` in this sandbox and I
   have the recipe.** The missing ingredient is one field: `type: 'win'` on the stored medication.
   `alerts` is *derived*, not read, so setting it does nothing.
2. **The changelog and the Settings sentence still do not say that an inactive profile's reminders
   run out after three days.** N2 from the last pass was reported as closed; the Settings sentence
   is byte-for-byte unchanged, and the new changelog line repeats the same omission.
3. **M5 and M7 should not block** — asked and answered below.

---

# THE TWO BLOCKERS

## D1 — CLOSED.

`grep -c '^| app-v85 ' README.md` → **1**. `./release_check.sh` no longer names it; the only
remaining item is the quality chain (missing `outputs/PM*app-v85*.md`, plus the two prior audits
refusing, which this file supersedes). Exit 1 for the right reason now.

## D2 — CLOSED, and correctly. The false clause is gone.

> **"Reminders for one person no longer wipe out another's"**
> *"If this phone has more than one person set up, every time the app was opened it quietly removed
> the reminders belonging to whoever you were not currently in. A dose could pass with nothing on
> screen and nothing in your hand buzzing."*
> *"That is fixed — each person's reminders now stay put. Reminders are still only kept up to date
> for the person you are in, so open their profile to bring theirs in line with what has been
> logged."*
> *"Settings now tells you which person the reminder count is about…"*

As the Voice: the deleted-profiles-"ringing" clause is gone, the trigger is now the universal one,
and point 2's new second sentence states the real limitation rather than implying coverage. Rule 0
clean — no name, no gendered pronoun, no dose or schedule, no version numbers or file names. This
row is honest.

Two residual notes, neither a block:

* **It still does not say the reminders expire.** "Each person's reminders now stay put" has no time
  bound. `NOTIF_HORIZON_MS` is 72 hours and nothing re-arms an inactive profile, so what that
  profile keeps is gone within three days. A caregiver reads "stay put" as "keep working". This is
  N2, and it is now in the changelog as well as on the card — see the section below.
* **"every time the app was opened" is true of the phone app only.** `syncNativeReminders` returns
  at `if (!isNativeApp()) return;`, and the same `index.html` serves the PWA install and the
  Capacitor wrapper (`capacitor.config.ts` → `server.url`). A PWA-only reader is being told about a
  defect they never had. One qualifier fixes it.

---

# THE FAIL-OPEN GUARD — closed, and I could not get round it

You asked me to confirm the direction and to check whether reading the key directly has introduced
something else. Thirteen shapes, driven through the shipped predicate, asking about a profile that
**genuinely exists** — `1` means its reminder would be destroyed:

```
protect  healthy_list_other_profile_present -> 0      protect  no_list_key            -> 0
protect  corrupt_json                       -> 0      protect  json_array_not_object  -> 0
protect  key_missing                        -> 0      protect  getItem_throws         -> 0
protect  empty_string                       -> 0      DESTROY  empty_list_array       -> 1
protect  literal_null                       -> 0      DESTROY  list_of_nulls          -> 1
protect  list_not_an_array                  -> 0      DESTROY  list_entry_without_id  -> 1
DESTROY  deleted_profile_healthy_list       -> 1   <- correct: this is B1/B2 still working
```

`corrupt_json` and `getItem_throws` both read `1` at `f3f1880` and read `0` here. **The direction is
reversed and the B1/B2 sweep still works.**

**The three that still fail open are all "the list parsed but has no usable ids", and I checked
whether any of them can reach the guard at all:**

```
empty_list_array      booted=false  rootHTML=0     TypeError: Cannot read properties of undefined (reading 'id')
list_of_nulls         booted=false  rootHTML=0     TypeError: Cannot read properties of null (reading 'id')
list_entry_without_id booted=true   rootHTML=4205  ACTIVE_PROFILE_ID=undefined
```

Two of the three kill the app at module evaluation — `ACTIVE_PROFILE_ID`'s
`ps.list.some(...) ? ps.activeId : ps.list[0].id` throws — so the guard never runs. Only
`list_entry_without_id` boots, and it boots with `ACTIVE_PROFILE_ID === undefined`, which means
every profile-scoped storage key is already `chemowell-app-p-undefined-*` and the caregiver is
looking at an empty app. **So the reachable residue is one shape, in a state where the app is
already broken in a more visible way.** Not a blocker. One line closes it if you want it closed —
an id-less list is not a list of profiles:

```js
if (parsed && Array.isArray(parsed.list)) {
  const ids = parsed.list.map(x => x && x.id).filter(Boolean);
  if (ids.length) knownProfileIds = new Set(ids);
}
```

**On the divergence itself — reading the key directly rather than through `loadJSON`.** It is not
merely acceptable, it is **required**, and that is worth stating plainly so nobody "tidies" it back:
`loadJSON`'s fallback is *real-looking data*, so going through it makes failure and a one-profile
phone the same value. Using `loadJSON` here would be the bug. The one consequence of diverging is
that `ACTIVE_PROFILE_ID` (still derived via `profilesState()`, still taking the fallback) and
`knownProfileIds` can now disagree on a corrupt list — `ACTIVE_PROFILE_ID` becomes `'p1'` while
`knownProfileIds` is `null`. I traced it: the result is that everything tagged is protected and only
untagged and `p1`-tagged ids are cancellable. **Conservative, and in the safe direction.** No harm
found. The loud comment plus checks 3d are the right guard against a future tidy-up; 3d covers
corrupt, missing and healthy, and does not cover the `getItem` throw — I did, and it protects.

---

# M4 — IT IS DRIVABLE. HERE IS HOW.

Your handling of this was right: you labelled the source check as structural, printed the state
actually reached, and refused to call it behavioural. The suite prints
`note the rendered card is in the "empty" state` — exactly the honesty the "native smoke test"
exemption lacked. **But the stated reason is wrong, and the README repeats it as fact.**

**`alerts` is derived, not stored.** `normalizeMedication` (line 1513):

```js
alerts: type === 'win' && !(original.scheduleDays && original.scheduleDays.mode === 'asneeded')
```

and one line matters more than that one:

```js
const type = original.type === 'win' ? 'win' : 'gap';      // line 1485
```

A stored `alerts: true` is discarded, and a medication with windows but no `type` normalises to
`gap` → `alerts: false` → excluded from `buildReminderPlan` → empty plan → `notifScheduledCount 0`
→ status `empty`. That is the whole trap. I hit it too, in my first round, and read it as "the plan
is empty" rather than "the med was never eligible".

**The fixture that reaches `on`:**

```js
localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 1, meds: [
  { id: 'alpha', name: 'Alpha', type: 'win', windows: [{ start: 9, end: 12, name: 'Morning' }] }
]}));
// stub: createChannel, checkPermissions -> granted, checkExactNotificationSetting -> granted,
//       getPending -> [], schedule/cancel -> ok
```

Measured, shipped file:

```
{ "scopeRendered": true, "state": "on",
  "cardText": "✓ Notifications are on 3 reminders scheduled over the next 3 days, next at Thu 8:56 AM.
               This count is for Alex only. The other profile on this phone keeps the reminders…" }
```

`exact_alarm: 'denied'` on the same fixture gives **`on-exact`**, also with the scope line rendered.

**And it discriminates.** The same fixture against the M4 mutant (scope line deleted from `on` and
`on-exact`) returns `scopeRendered: false`. So M4 dies behaviourally, not structurally.

One detail that matters for this repo's history of suites failing on the clock: a single window is
enough at **any** hour, because `buildReminderPlan` walks forward through days and tomorrow's
occurrence is always inside the 72-hour horizon. No time-of-day fixture needed.

---

# M5 AND M7 — NEITHER SHOULD BLOCK. You asked directly.

Both branches are **correct in the shipped file today**; what is missing is coverage, so the risk is
a future edit, not this release.

* **M5 (plural branch, 3+ profiles).** I rendered it in an earlier round and it reads correctly:
  *"The other 2 profiles on this phone keep the reminders they already had, but those stop being
  kept up to date while they are not in them…"* It is reachable by any Plus (3) or Pro (unlimited)
  licence — `tierLimit` confirmed: `pro ? Infinity : plus ? 3 : 1`. A six-line third fixture closes
  it, and it is the branch carrying both of the lies the singular branch has explicit checks
  against. **Recommend, do not block.**
* **M7 (`deleteProfile`'s refusal to delete the ACTIVE profile).** Pre-existing code, correct today.
  It is one line to check (`deleteProfile(activeId)` then assert the profile is still there) and it
  is slightly more exposed now that `deleteProfile` is on `window.__notifScopeTest`. **Recommend, do
  not block.**

Padding the suite ahead of my read was the right call. Neither is worth holding the release.

---

# THE README ROW — three claims that overstate. You asked me to read it as a record.

Most of it I verified and it is accurate: the trigger, the `force: true` boot sync, the protection
band's reload reasoning, `tierLimit` free 1 / plus 3 / pro unlimited, "nothing has ever disarmed a
non-active profile's alarms", the 72h horizon, the fail-closed rationale, the false first
replacement sentence, `APP_VERSION` → `app-v85` and CACHE → `chemowell-app-v85-1`, and
`v85-profile-reminders` **30/30** (my own run). Three claims do not hold.

**1. "AND THE FIRST VERSION OF THE FIX SHIPPED A WORSE BUG."** It did not ship. It existed on a
branch at `21b8123` and was caught before release — by the audit the same sentence credits, which
is the internal contradiction. `PUBLISHED.json` records the live build as **app-v84**
(`chemowell-app-v84-14`), and `release_check.sh` says so on every run. A future reader of this row
will believe a build that orphaned a deleted patient's alarms reached real phones. **"INTRODUCED a
worse bug"** or **"would have shipped a worse bug"** is the true sentence, and it loses none of the
force.

**2. "`on` and `on-exact` are covered structurally … because this sandbox cannot complete a native
sync to reach them."** Disproved above. The sandbox can reach both. This is the same shape as the
exemption I objected to two passes ago — far more honest, because it is labelled and the reached
state is printed, but the *reason* is still an impossibility claim that is not true, and it is now
written into the permanent record where the next person will believe it and not try.

**3. "Stage 2 … is Aaron's decision, already made: a per-profile label, blank by default."**
Unsourced, and **contradicted by the only record in the repo**:
`outputs/DEVELOPER-multiprofile-notifications.md` has task 4 (notification text options / privacy)
as *"DONE — **needs Aaron's decision**"* and task 8 as *"BLOCKED — **needs Aaron on task 4** and on
size (M)"*. The phrase "blank by default" appears nowhere but in README.md itself. If he said it,
cite where; if not, mark it pending as the developer brief does. **This is Rule 7's failure mode
exactly** — a confident claim in a permanent doc that nobody re-checks, which later sends work in a
direction nobody approved. Two of Rule 7's three entries were wrong the first time anybody looked.

**One precision point, not a falsehood.** *"Falsified against eight mutants"* reads as eight
behavioural falsifications; one of the eight — the scope line deleted from `on`/`on-exact` — dies on
a **source** check, which the row says further down but not in the list. And *"Three of those scored
a clean pass against earlier versions of this suite"* undercounts: of the eight listed, **four** did
— band deleted (10/10), `deleteProfile`'s call removed (10/10, and again 24/24 against your first
fix), scope sentence inverted (10/10), and scope line deleted from the two states (24/24). Four is
the better number and it is the more useful one.

---

# N1 AND N2 WERE REPORTED CLOSED AND ARE NOT

`profileScopeLine()` is byte-for-byte unchanged between `f3f1880` and `cbc0520` — the index.html
diff does not touch it. Both findings stand exactly as written last pass:

* **N1** — the `empty` state renders *"No reminders are currently due in the next 3 days. **This
  count is for Alex only.**"* There is no count on that card. Measured again at `cbc0520`. "This
  count is for" works in `on` and `on-exact`; in `empty` it wants **"Reminders here are for Alex
  only."**
* **N2** — the sentence, and now the changelog too, says the other profile "keeps the reminders it
  already had" with no time bound. It keeps them for **at most three days**.

Neither blocks. I flag the mismatch between "closed" and the file because you asked me not to treat
anything as settled, and a status that is ahead of the code is the one thing this project keeps
paying for.

---

# GATES, RUN BY ME

* `./verify-rebuild.sh` — **exit 0**. `→ patch script targets: const APP_VERSION = 'app-v84'
  (commit d38e36a)`, `17 checks: 17 passed`, boot half reaches `BOOTS`. The pin, the loud refusal
  and the printed target are all as described, all three faults I found are quoted in the comment,
  and the limitation — immutable on both sides, no `harness-v85-*.py`, so this release's own
  reproducibility is unverified — is written down rather than implied. That is the right outcome.
* `./release_check.sh` — **exit 1**, and now only for the quality chain: the missing
  `outputs/PM*app-v85*.md`, and the two earlier audits that refuse. This file supersedes those; the
  PM sign-off is your desk.
* `test/v85-profile-reminders.mjs` — **30/30**, section 6 printing
  `note the rendered card is in the "empty" state`.
* Three mutants from last pass re-confirmed dead, and I re-applied M4 myself to check the source
  check really bites: **25/30**.

---

# WHY SHIP

Every blocker is closed and I verified each by driving the shipped code, not by reading it. The
fail-open reversal holds in eleven of thirteen probe shapes and the two it does not hold for cannot
boot the app. B1 and B2 remain closed. The changelog no longer says anything false. The rebuild gate
is pinned, honest about its own limits, and green.

What is left is a record to correct, one clause of copy, and two branches that are right but
untested. None of it is something a caregiver can hit.

**Before the push, in the same commit** — because they are text and need no re-verification:
the three README sentences above, and N1/N2's clause. **Then** the PM sign-off.

**Worth doing next, not now:** make M4 behavioural with the `type: 'win'` fixture; add the
three-profile fixture (M5) and the one-line `deleteProfile` guard check (M7); the id-less-list
hardening. And two things for `BACKLOG.md`: a profiles blob of `{"list":[]}` or `{"list":[null]}`
kills the app at module evaluation with a blank screen and `initProfiles()` declines to repair it
because the blob is truthy — pre-existing, not this release's, and worth a line before somebody
meets it on a real phone.
