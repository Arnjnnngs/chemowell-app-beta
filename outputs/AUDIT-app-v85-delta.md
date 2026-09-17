AUDITED-COMMIT: f3f1880
VERDICT: DO NOT SHIP

Zero Day Auditor, app-v85 delta pass. Re-audit of the five blockers raised against `21b8123` in
`outputs/AUDIT-app-v85.md`, plus a fresh attack on the fixes themselves.

**All five original blockers are closed, and B1 is closed properly — I drove the real
`eraseAllAppData()` end to end and falsified the probe against both earlier commits.** The verdict
is DO NOT SHIP for two things that are new in this delta, both small: a mechanical gate that fails,
and a paragraph of caregiver-facing copy that is not true.

---

# THE FIVE, RE-CHECKED

## B1 — CLOSED. Verified end to end, not by reading the guard.

My first re-run reported the alarms still surviving. **That was my probe, not the app**:
`page.addInitScript` re-runs on reload, so it re-seeded the deleted profile and I was measuring a
profile that legitimately existed again. Rewritten with a sentinel key that `eraseAllAppData()` does
not wipe, driving the **real** `window.__eraseTest()` and letting it do its own reload:

```
f3f1880   BEFORE ERASE : pending ["9001:p2","9002:p2"]   profiles ["p1","p2"]
          AFTER  ERASE : profiles ["p1"]   pendingStillArmed []        <- swept
21b8123   AFTER  ERASE : profiles ["p1"]   pendingStillArmed ["9001:p2","9002:p2"]  <- the defect
```

The same probe against `21b8123` reproduces the orphan, so the check discriminates. Nothing had to
remember to call anything: the profile left the list, and the next reconcile swept its alarms. That
is the property I asked for and it is the one that holds.

## B2 — CLOSED. Same mechanism, measured separately.

Reproduced exactly what `cwUndoRestore()` does to a restore-created profile — drop it from
`PROFILES_KEY`, delete its storage keys, reload — with alarms armed for it beforehand:

```
BEFORE UNDO : ["7001:pRESTORED","7002:pRESTORED"]
AFTER  UNDO : profiles ["p1"]   stillArmed []
```

Swept, with no call added to that path. This is the argument for the existence key over a third
`cancelRemindersForProfile()` call, and it is now demonstrated rather than asserted.

## B3 — the suite is green; **the row it protects is not true**. See D2.

`test/v84-whatsnew.mjs` **96/96** on my own run. `whatsNewOlderUnseenCount()` no longer invents a
number, and `CHANGELOG[0].v` matches `APP_VERSION`. The gate is closed. The copy is a separate
finding and it is a blocker.

## B4 — the sentence is materially TRUE. Your claim checks out; two things are missing from it.

Rendered at `f3f1880`:

> "This count is for Alex only. The other profile on this phone keeps the reminders it already had,
> but they stop being kept up to date while you are not in it — open that profile to bring its
> reminders in line with what has been logged."

Your claim was that another profile's armed reminders survive but are never refreshed while
inactive. **Correct, and measured**, against what is live today rather than against the previous
draft:

```
app-v84 (b9fa171, LIVE)  armed for the OTHER profile after one boot sync: []
f3f1880                  armed for the OTHER profile after one boot sync: [7001]
```

And by code: `syncNativeReminders` builds the plan from `ACTIVE_PROFILE_ID` alone, now cancels
nothing belonging to another profile and schedules nothing for one; `cancelReminderForEntry` keys on
`notifDoseTag(ACTIVE_PROFILE_ID, …)`. An inactive profile's pending set is frozen — it cannot gain a
reminder and cannot lose one. Both halves of your claim hold.

Two gaps, neither fatal, the first worth fixing with the D2 rewrite (see N1, N2 below): the sentence
opens "This count is for…" in a state where **no count is on screen**, and it does not say that a
frozen set **expires**.

## B5 — the gate is green; the mechanism has moved the blindness. See N5.

`./verify-rebuild.sh` → **EXIT 0**, `17 checks: 17 passed`, and the boot half now runs to `BOOTS`.
As an unblocking move it is right: a script that builds app-v84 is historical, not stale, and
holding the release on that was wrong. What it now checks is a different and much weaker question —
detail in N5, including your `rev-list` doubt, which was justified.

---

# NEW BLOCKERS

## D1 — `./release_check.sh` exits 1: README.md has no version-history row for app-v85.

```
❌ RELEASE CHECK FAILED: README.md has no version-history row for app-v85.
   Two releases (app-v54, app-v55) shipped with no row at all before this check existed.
```

Confirmed directly: `grep -c '| app-v85 ' README.md` → **0** (app-v84 → 1). Mechanical, nothing to
do with judgement, and it is the repo's own gate. The run also reports the missing
`outputs/PM*app-v85*.md` and quotes the previous audit's DO NOT SHIP — the first is your desk, the
second is superseded by this file.

## D2 — the changelog row is untrue, and it is the release note for a missed-dose defect.

You asked me to read it as the Voice. One clause is false and two misdirect.

**False.** *"deleting a profile properly switches its reminders off instead of leaving them to go on
ringing."* The "instead of" describes a harm that **never shipped**. On app-v84 — what is live —
the over-broad sweep removed a deleted profile's alarms on the next sync; I measured that same sweep
above (`[]` after one boot sync). Leaving them ringing would have been the behaviour of the *first
draft of this fix*, which is exactly what my B1 caught before it shipped. The row tells caregivers
the product used to do something it never did. Rule 2.7 question 1.

**Misdirecting, twice, about the trigger.** The title says *"when you switch profiles"* and the
first point says *"setting up a reminder for one person could quietly remove the reminders already
set for the other."* Both name real paths and both omit the universal one. Your own comment in
`notifCancelCandidates` says it plainly: *"not only on a profile switch: the boot sync runs with
`force: true`, so every cold start wiped the other profile's alarms."* A caregiver who has two
profiles but never switches and never edits a reminder reads this row and concludes it did not
affect them. It affected them every time they opened the app. For a note about why doses were
missed, that is the one fact that has to be right.

Suggested, keeping your voice:

* Title: **"Reminders no longer disappear when the app is opened under another profile"**
* Point 1: *"If this phone has more than one profile, simply opening the app could quietly remove
  the reminders set for whoever you were not currently in — so a dose could pass with nothing on
  screen and nothing in your hand buzzing."*
* Point 2: *"That is fixed. Each person's reminders now stay put, and a profile you delete has its
  reminders switched off along with it."*

Rule 0 on the row is clean: no name, no gendered pronoun, no dose or schedule, no version numbers or
file names in the prose.

---

# NON-BLOCKING, IN THE ORDER I WOULD FIX THEM

## N1 — "This count is for Alex only" prints where there is no count.

The `empty` state renders, verbatim:

> "No reminders are currently due in the next 3 days. **This count is for Alex only.** The other
> profile on this phone keeps the reminders it already had…"

There is no count on that card. And this is the state section 6 of the suite actually exercises (see
N3/M4) — every word of the sentence was asserted and nobody read the two lines together. "This
count is for" works in `on` and `on-exact`; in `empty` it wants to be "**Reminders here are for
Alex only.**"

## N2 — the sentence does not say the other profile's reminders run out.

`NOTIF_HORIZON_MS` is 72 hours and an inactive profile's pending set can only shrink — nothing
re-arms it. So "keeps the reminders it already had" is true for **at most three days**, after which
that profile has none and nothing says so. A caregiver reading the sentence as written can
reasonably believe Sam stays covered indefinitely while they are in Alex. The failure mode at day
four is "reminders stopped and nothing told me", which is the original complaint. One clause fixes
it: *"…keeps the reminders it already had for up to three days, but they stop being kept up to date
while you are not in it…"*

## N3 — three mutants the 24-check suite still passes.

Falsified against a served copy in the scratchpad; the repo tree was never modified.

| Mutant | Result |
|---|---|
| **M4** — delete `profileScopeLine()` from the `on` and `on-exact` states, keep it only in `empty` | **24/24 PASS** |
| **M5** — make the PLURAL branch say *"have no reminders set and are fully covered"* | **24/24 PASS** |
| **M7** — remove `deleteProfile`'s refusal to delete the ACTIVE profile | **24/24 PASS** |

**M4 is the one to fix.** Section 6's fixture gives the profile no medications and
`getPending: []`, so `notifScheduledCount` is 0 and `nativeNotifStatus()` returns `empty`. Measured
— the card it reads is *"No reminders are currently due in the next 3 days."* So the suite verifies
the disambiguating sentence **only in the state where there is no count to disambiguate**, and the
two states a phone with real reminders shows are untested. Give the fixture one alerting medication,
or a non-empty `getPending`, and assert the line in `on` as well.

**M5**: the suite's fixtures are one profile and two. The plural branch needs 2+ others — a Plus or
Pro configuration, so a paid, reachable one — and it can carry both of the lies the singular branch
has explicit checks against. Add a three-profile case.

**M7**: `deleteProfile` is now exported on `window.__notifScopeTest` and driven, which is the right
call and fixed the mutant I found last round. Its one safety guard is still unchecked. One line:
call `deleteProfile(activeId)` and assert the profile is still there.

## N4 — the consequence of reading `profilesState()` in there. You asked; here it is.

Moving it out of the per-notification filter is right and the cost is one JSON parse per sync, which
is nothing. **The consequence you have not seen is the failure direction.** `profilesState()` goes
through `loadJSON`, which returns its fallback — `{ list: [{ id: 'p1' }], activeId: 'p1' }` — on a
throw *or* a parse error. So an unreadable list is indistinguishable from a list containing only
`p1`, and every other profile's alarms become cancellable. Measured, with the app healthy and
`ACTIVE_PROFILE_ID` already bound, asking about a profile that genuinely exists:

```
FAIL-OPEN : {"before":0,"duringThrow":1,"duringCorrupt":1}     0 = protected, 1 = would be destroyed
```

That is the app-v85 defect resurrected, silently, and permanent for that profile — nothing re-arms
an inactive one. The old `pid !== ACTIVE_PROFILE_ID` guard could not do this; the existence key is
strictly weaker and it fails **open**.

**Why it is not a blocker:** relative to app-v84, which is what is live, this case is no worse —
today that sweep happens unconditionally, every cold start, with no storage fault required. So the
release is an improvement in every state including this one.

**Why I would still fix it now**, three lines, while the file is open — distinguish "the list says
it is gone" from "I could not read the list":

```js
let knownProfileIds = null;
try {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (raw) knownProfileIds = new Set((JSON.parse(raw).list || []).map(x => x.id));
} catch (e) { /* leave null -- an unreadable list is not an empty one */ }
…
if (pid && pid !== ACTIVE_PROFILE_ID && (knownProfileIds === null || knownProfileIds.has(pid))) return false;
```

Wrong in that direction costs one orphan alarm surviving until the list is readable, then swept.
Wrong in the current direction costs another patient's reminders. The asymmetry decides it.

## N5 — B5: the right question, asked in a way that can no longer fail. And yes, pin it.

**Your doubt about `git rev-list -1 --grep='^app-v84' HEAD` was justified on three counts.**

1. **Today it resolves correctly** — `d38e36a`, *"app-v84 is live: record the baseline"*, whose
   `index.html` really is `app-v84`. So the gate's current green is honest.
2. **It selects on the commit message, not on what the file contains.** Fifteen commits match that
   grep, and one of them — `262d56ff`, *"app-v84 (not yet applied): the Meds card stops being a dead
   end"* — carries `APP_VERSION = 'app-v82'`. Had that been the most recent match, the check would
   have compared an app-v84 payload against an app-v82 file and said nothing. The selector can, by
   construction, pick a commit that is not the release. It is right today by ordering luck.
3. **The `|| echo HEAD` fallback is dead code, and it hides a wrong yardstick.** `git rev-list -1`
   exits **0** with empty output when nothing matches, so `||` never fires. Measured:

   ```
   $ git rev-list -1 --grep='^app-vZZZ' HEAD ;  echo exit=$?
   exit=0   output=[]
   $ git show ":index.html" | grep APP_VERSION      ->  app-v85
   ```

   With an empty substitution the command becomes `git show ":index.html"`, which git accepts as
   *index.html from the staging area*. The second `|| git show HEAD:index.html` never fires either,
   for the same reason. So a no-match silently compares against staged content.

   **Pin it explicitly** — `REBUILD_TARGET=d38e36a` with a comment naming why — or derive it from
   the `APP_VERSION` literal the script actually writes. A grep over commit subjects is not a way to
   identify a build.

**And the larger point.** The old check asked *"does this script still copy the app as it is now?"*
— a question about a moving file, which is why it could catch something. The new one asks *"does
this script still copy `d38e36a`?"* Both sides are immutable commits. **It will read 17/17 for ever
and can only fail if somebody edits `harness-v84-whatsnew.py`, which nobody will, because it is
historical.** That is the blindness moving, not going away.

What is actually missing is a `harness-v85-*.py`. There is none, so nothing verifies that *this*
release is reproducible from base + patch — while `verify-rebuild.sh` exits 0, which reads like it
does. I am not blocking on it: the previous audit blocked on this gate being red, and it is fair to
unblock it the way you did. But the release-process rule is reproducibility of the release being
shipped, and right now `REBUILD_SCRIPT`/`REBUILD_TARGET` have to advance with each release or this
gate is decorative.

## N6 — `window.__notifScopeTest.deleteProfile = deleteProfile`.

Exporting the wiring was the correct answer to my M2 and it killed that mutant. It also puts a
destructive function on `window` in the shipped build. Consistent with `window.__eraseTest`, which
has been there for releases and carries its own justification, so this is a note, not an objection —
worth one sentence in HANDOFF.md so the pattern is deliberate rather than accumulating.

---

# THINGS I CHECKED AND FOUND NOTHING WRONG WITH

* The guard reads `if (pid && pid !== ACTIVE_PROFILE_ID && knownProfileIds.has(pid)) return false;`
  — untagged notifications stay cancellable (still correct: no arm path in 173 commits omits
  `profileId`, and `sendNotif()`'s untagged native schedule fires at `now + 300ms`), the plan still
  wins, and the mid-fire band still runs for the active profile.
* `test/v75-no-other-patient.mjs` **27/27** on my own run — the Rule 0 ratchet is intact. No name,
  no gendered pronoun, no dose, ceiling or schedule, and no new medication-id branch in the diff.
* `test/v85-profile-reminders.mjs` **24/24**, and my three earlier mutants are all dead: band
  deleted, sentence inverted, guard reverted to active-only. Section 6 now really does open the
  drawer, tap Settings and read the rendered sentence — the honest version of the exemption I
  objected to, and the `tourDone` detail you hit is a real trap worth the comment you gave it.
* `test/v84-whatsnew.mjs` **96/96** on my own run.
* `./verify-rebuild.sh` **exit 0**, boot half reaches `BOOTS`, `hooks.version` reads `app-v84` as it
  should for that rebuild.

---

# WHAT WOULD MAKE THIS SHIP

1. Add the `app-v85` row to README.md's version history — `./release_check.sh` names it.
2. Fix the changelog row: drop the false "instead of leaving them to go on ringing", and name the
   real trigger (opening the app, not switching profiles).
3. PM sign-off (`outputs/PM*app-v85*.md`) — your desk, not mine.

N1 and N2 are two clauses in the same sentence and I would take them in the same pass. N3's M4 is
the mutant I would not leave: it means the line's coverage is in the one state where the line has
nothing to disambiguate.

The re-audit on this is a read plus two exit codes.
