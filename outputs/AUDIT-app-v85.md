AUDITED-COMMIT: 21b8123
VERDICT: DO NOT SHIP

Zero Day Auditor, app-v85 stage 1 (`claude/caretracker-team-review-i83ik2`).
Everything below was measured on this commit. Nothing was taken on the developer's description.
The repo working tree was not modified: all mutants were served from a copy in the scratchpad.

---

# HEADLINE

**The reminder fix itself is correct and I could not break it. Four other things block the
release, and the first two are caused by this commit.**

1. **"Erase all data" no longer erases another profile's armed reminders.** New here. The old bug
   was cleaning them up as a side effect; the fix protects them and nothing replaces the cleanup.
   Measured: after a factory reset and reload, the other profile's alarms are still armed and the
   reconcile loop will never cancel them.
2. **The restore-undo path has the identical hole.** Three code paths remove a profile. One got
   `cancelRemindersForProfile()`.
3. **`test/v84-whatsnew.mjs` is RED at this commit — 91/96.** `APP_VERSION` moved to `app-v85` and
   `CHANGELOG[0]` is still `app-v84`, so every updating phone reopens the What's New modal showing
   the notice it already dismissed, and a phone with no marker is told "4 earlier updates you have
   not seen" — a number the file's own comment forbids inventing.
4. **The new Settings sentence is false, and false in the direction this release created.**
   It says the other profile "has no reminders set". After this change it has exactly that — the
   reminders this release stopped destroying — and they will fire.

Also: `./verify-rebuild.sh` exits 1, and the new suite passes three mutants including one that
deletes a pre-existing safety guard.

---

# BLOCKERS

## B1 — `eraseAllAppData()` leaves another profile's medication alarms armed. INTRODUCED HERE.

`eraseAllAppData()` (index.html:1111) removes every `chemowell-app-*` key and reloads. It has never
touched native alarms. Until this commit that did not matter: the reconcile loop cancelled every
pending notification not in the active profile's plan, so a factory reset swept the device clean on
the next boot. That sweep was the bug. This commit removes it and puts nothing in its place.

After the wipe, `initProfiles()` recreates a single profile with the fixed id `p1`. So:

* alarms tagged `p1` are still cancellable (the id collides with the new default profile), and
* alarms tagged with **any other** profile id are now permanently protected by
  `notifCancelCandidates` — `pid && pid !== ACTIVE_PROFILE_ID` → `return false` — forever.

**Measured**, HEAD, in a stubbed native shell (`window.Capacitor.isNativePlatform → true`, an
in-memory pending store):

```
C. erase wiped {"wiped":3,"profilesKeyGone":true}
D. AFTER FACTORY RESET + reload:
   {"active":"p1","cancelled":[9003],"survivors":[9001,9002]}
```

`9001` and `9002` carry `extra.profileId: 'p2'`. They survive. The device goes on firing a deleted
patient's medication reminders on the lock screen for up to the full 72-hour horizon, with no data
in the app to explain them and no control anywhere that can stop them short of uninstalling.

The app's own final-confirmation modal says, in these words:

> "This will permanently delete everything… Because everything lives only on this device — nothing
> is backed up anywhere else — there is no way to bring it back once it's gone."

On native that is now untrue. And it is precisely the harm the commit's own `deleteProfile` comment
argues must be prevented — "alarms would survive and fire on the lock screen … naming a medication
for somebody the app no longer has and with no screen able to explain or stop them." The reasoning
is right. It was applied to one of the three paths that remove a profile.

## B2 — `cwUndoRestore()` has the same hole. INTRODUCED HERE.

`cwUndoRestore()` (index.html:566-590) removes a restore-created profile from `PROFILES_KEY`,
deletes its storage keys and reloads — with no `cancelRemindersForProfile()`.

This is reachable, not theoretical: `cwBkConfirmRestore()` (line 390) makes the restored profile
**active** and reloads, so a sync arms its reminders from the restored medication list before the
caregiver can press Undo. Undo then orphans them under the same rule as B1.

## B1 + B2 — one fix, and it is the more robust shape

Guard on **"belongs to a profile that still exists"**, not on "is not the active profile":

```js
const known = new Set((profilesState().list || []).map(p => p.id));
…
if (pid && pid !== ACTIVE_PROFILE_ID && known.has(pid)) return false;
```

Three reasons to prefer it over adding a third call to `cancelRemindersForProfile`:

* no deletion path has to remember anything, now or in future;
* `cancelRemindersForProfile` becomes a promptness optimisation instead of the only defence, so
  its swallowed error (see N1) self-heals on the next sync rather than leaking permanently;
* it is the same principle the commit already states for the protection band — ask the device, and
  ask about state that is true now, not about what this process happens to remember.

I confirmed the failing input directly: probe `R_pid_deleted_profile`, a pending notification whose
`profileId` names a profile no longer in the list, comes back **not cancellable** at HEAD.

## B3 — `test/v84-whatsnew.mjs` is RED at this commit (91/96)

Root cause, one line: `APP_VERSION = 'app-v85'` (index.html:9052) while `CHANGELOG[0].v` is
`'app-v84'`. No changelog row was added for this release.

```
7. THE NEWEST ENTRY IS ABOUT THE VERSION THAT IS RUNNING
  FAIL  the newest changelog entry names the running version
        {"running":"app-v85","newest":{"v":"app-v84", …}}
7h. …
  FAIL  the count really is zero there -- which is the defect this case exists for  |  4
  FAIL  so it says the true thing instead, and invents no number  |  null
  FAIL  and it does not ALSO print a count  |  true
  FAIL  and it names the control it points at  |  null

96 checks: 91 passed, 5 failed
```

What that is on a real phone:

* `whatsNewShouldShow()` returns `seen !== APP_VERSION`. Every phone that dismissed the v84 notice
  now gets it again — the same card, re-headed as the new thing.
* `whatsNewOlderUnseenCount()` looks `APP_VERSION` up in `CHANGELOG`, does not find it, and falls
  to `idx === -1 → unseen = CHANGELOG.length`. A phone with prior data and no marker is told
  **"4 earlier updates you have not seen"**. The comment directly above that function says, in
  these words, *"Do not 'fix' it by falling back to the length of the changelog."* This commit
  makes that fallback the live path.
* The What's New screen prints "This phone is running app-v85" above a list whose newest entry is
  app-v84.
* And the caregiver is told nothing about the reminder fix — the single change they most need to
  know about, because it is the reason doses were missed.

app-v84 shipped the "tell people what changed" feature. app-v85 is the first release after it and
breaks it. Add the `app-v85` `CHANGELOG` entry (no version numbers in the prose, they/them, per the
block's own header) and this goes green.

## B4 — the Settings sentence is not true. Rule 2.7, question 1.

Rendered verbatim at HEAD (stubbed native shell, two profiles, p1 active and named Alex):

> **For Alex only. The other profile on this phone has no reminders set while it is not the one you
> are in. Switch profile to arm theirs.**

Before this commit that was true, because the reconcile loop destroyed them on every cold start.
**The entire point of this commit is that it no longer does.** Measured, same build:

```
21b8123  AFTER BOOT SYNC (force:true): {"ids":[9001,9002],"owners":["p2","p2"]}   p2 survived: true
b9fa171  AFTER BOOT SYNC (force:true): {"ids":[],"owners":[]}                     p2 survived: false
```

So the screen tells the caregiver the other profile has no reminders at the exact moment that
profile's reminder can fire on the lock screen. It describes the behaviour this release removed.

This is the hard shape the Voice exists for — every word is plain, short, readable at 2am, and the
sentence is false. It also understates rather than overstates coverage, which is the safer
direction, so it is not dangerous; it is simply not true, and Rule 2.7 says not roughly right.

A sentence that matches the code:

> "Only this profile's reminders are being kept up to date. Another profile keeps whatever was set
> the last time you were in it, for up to 3 days. Switch to it to bring its reminders up to date."

Two smaller copy notes: the plural branch reads *"the other 2 profiles … while **they** are not
**the one** you are in"* (rendered and confirmed) — plural subject, singular predicate. And the
line takes the name from `profilesState().list`, while the rest of the app reads
`CONFIG.patientName`; they are kept in sync at setup and rename, and `|| 'this profile'` is the
only thing standing if they ever drift.

## B5 — `./verify-rebuild.sh` exits 1 at this commit

```
17 checks: 14 passed, 3 failed
❌ harness-v84-whatsnew.py no longer copies the app. Re-extract what it names; do not hand-edit.
EXIT=1
```

Failing: `MOVED_HOOKS`; "the changelog block" (*first line not in the app:
`const APP_VERSION = 'app-v84';`*); "the hook block, re-attached at the end of the module".

Two of the three are pure version drift and were expected the moment `APP_VERSION` moved. **The
third is real**: appending the `window.__notifScopeTest` block changed the end of the module, so
the documented rebuild path no longer reproduces the app. The drift check runs first, so the boot
half never executes and `verify-rebuild.sh` says nothing about whether the rebuilt file loads.

Expected is not green. Either re-extract the payload in `harness-v84-whatsnew.py`, or point
`REBUILD_SCRIPT`/`REBUILD_BASE` at an `harness-v85-*.py` that does not exist yet. Do not ship with
this red and no replacement — that is the rot `verify-rebuild.sh`'s own header was written about.

---

# THE SUITE — three mutants it does not catch

Falsified by serving a mutated **copy** on a second port. `index.html` in the repo was never
touched; `git status` is clean apart from this report.

| Mutant | Result |
|---|---|
| **M1** — delete the mid-fire protection band: `return true` in place of `return !hit \|\| hit.at > guardEnd` | **10/10 PASS** |
| **M2** — delete `cancelRemindersForProfile(id)` from `deleteProfile()` | **10/10 PASS** |
| **M3** — replace the scope sentence with *"is fully covered and will get every reminder on time"* | **10/10 PASS** |

**M1 is the one that matters.** Check 3 is billed as *"the reload case, which is the one that
bit"*, but it drives an id belonging to **another** profile — already returned `false` one line
earlier by the new filter — so it never reaches the band's arithmetic. There is no check anywhere
that an **own-profile** id inside the band survives, or that one outside it is cancelled. The suite
now certifies a version of `notifCancelCandidates` with the pre-existing safety guard removed.

Two checks that would close it (I ran both by hand against the shipped hook; both discriminate):

```js
// own id, due inside the band, applied knows about it  -> must NOT be cancelled
cancelCandidates([{id:13, extra:{profileId:'p1'}}], new Set(), [{id:13, at: now+lead-1}], now)  // []
// own id, due outside the band                          -> MUST be cancelled
cancelCandidates([{id:14, extra:{profileId:'p1'}}], new Set(), [{id:14, at: now+lead+1000}], now) // [14]
```

**M2** confirms the developer's own suspicion: `deleteProfile` has no check at all.
`cancelForProfile` is exported on the hook and the suite never calls it. It does work — I drove it
directly and it cancelled exactly the target profile's ids and nothing else.

## The Settings exemption is not honest

`test/v85-profile-reminders.mjs:119`:

> `EXEMPT  the Settings notification card renders only on a native build; this sandbox is web.`
> `        Its copy is covered by the native smoke test, not here. Stated rather than skipped.`

Both halves are wrong.

* **There is no native smoke test.** `grep -rn "native smoke"` over the whole repo returns exactly
  one hit: that line. Nothing else in `test/`, `harness/`, `falsify/`, `release_check.sh`, CI or the
  docs matches. The exemption points at a gate that does not exist.
* **The premise is false.** The card renders fine in this sandbox with a ten-line
  `window.Capacitor` stub. I rendered it and read the sentence back for one, two and three
  profiles, plus the one-profile case where `profileScopeLine()` returns `null`:

```
ONE PROFILE   : {"found":false,"cardPresent":true}
TWO PROFILES  : {"found":true,"attr":"1","text":"For Alex only. The other profile on this phone has no
                 reminders set while it is not the one you are in. Switch profile to arm theirs."}
THREE PROFILES: {"found":true,"attr":"2","text":"For Alex only. The other 2 profiles on this phone
                 have no reminders set while they are not the one you are in. …"}
```

So the half of this release that is not a bug fix — the half Rule 2.7 says can block a release on
its own — ships with zero automated coverage, behind a stated reason that is not true. An
exemption naming a gate that does not exist is worse than a bare skip, because the next reader
stops looking. Rule 5.5: say what is exempt **and why**, truthfully.

---

# WHERE THE FIX DOES HOLD — checked, not assumed

I could not break `notifCancelCandidates`. This section is what I tried.

**End to end, through the real reconcile loop.** Not the extracted predicate — the whole of
`syncNativeReminders`, in a stubbed native shell with an in-memory pending store, two profiles, p1
active, p2's alarms armed by a notional earlier run:

```
21b8123 : AFTER BOOT SYNC (force:true) {"ids":[9001,9002],"owners":["p2","p2"]}  survived: true
b9fa171 : AFTER BOOT SYNC (force:true) {"ids":[],"owners":[]}                    survived: false
```

The defect is real, reproduced, and this commit closes it. The suite never does this — it drives
the predicate with synthetic arrays only, which is why M1 slips through.

**The load-bearing assumption is TRUE on the pinned plugin.** The whole fix depends on
`getPending()` returning `extra` as an object. If it ever came back as a JSON *string*, `p.extra &&
p.extra.profileId` is `undefined`, every pending looks untagged, and the fix is a silent no-op —
I confirmed that shape is cancelled (`I_extra_json_string` → cancelled). So I fetched
`@capacitor/local-notifications@8.2.1` and read it:

* Android — `LocalNotification.buildLocalNotificationPendingList()` line 325:
  `jsNotification.put("extra", notification.getExtra())`, a `JSObject`. It round-trips through
  SharedPreferences: stored as `request.getSource()` (the full JSON) and rebuilt by
  `buildNotificationFromJSObject()` line 270, `setExtra(jsonObject.getJSObject("extra"))`.
* iOS — `makePendingNotificationRequestJSObject()` returns `userInfo["cap_extra"] as? JSObject`.

Both return a real object. The app only builds Android (`@capacitor/android`,
`.github/workflows/android-build.yml`), so iOS is not in play, but it would hold there too.

**Every arm path in history carries `profileId`, so the untagged-legacy decision is correct.** I
checked all 173 commits that touch `index.html`: there is no commit with `await ln.schedule` and
without `profileId: n.extra.profileId`. `notifDoseTag` has taken a `profileId` since app-v35
(`329d85b`), the appt tag with it, and the check-in tag since `89078ca`. The only native schedule
that carries no `extra` is `sendNotif()` (line 12065), and it fires at `Date.now() + 300` — it is
not a durable pending alarm. Nothing that could belong to another profile is untagged.

**Input-shape probes against the shipped predicate** (all run through
`window.__notifScopeTest.cancelCandidates`, active = `p1`):

| input | cancelled | verdict |
|---|---|---|
| `extra` missing / `extra: null` | yes | correct — untagged |
| `profileId` `null` / `undefined` / `''` / `0` / `false` | yes | correct, and unreachable: ids are always `'p' + …` strings |
| `profileId: 'p2'` | no | correct |
| `extra` as a JSON **string** | yes | would defeat the fix — does not occur on this plugin, see above |
| `profileId: 1` (number) while active is `'p1'` | no | over-protective, harmless |
| id present in `planIds` | no | correct |
| `pending` `null` | — | no throw |
| own id inside / outside the protection band | no / yes | band works |

**Id collisions.** 156 realistic p1 tags against 156 p2 tags → **0 collisions**. Two tags differing
only in the profile segment cannot collide as int32 (the multiplier 31 is invertible mod 2^32); the
residual risk is `Math.abs` folding `h` and `−h`, which is negligible. **Non-blocking note:** if one
did occur, the colliding id would be in `planIds`, so it would survive `toCancel` and then be
**overwritten** by `toSchedule` — the other profile's alarm destroyed silently. Pre-existing and
unchanged by this commit; worth a line in `BACKLOG.md`, not a block.

**Mechanics.** `index.html` parses — the `<script type="module">` block (1,056,962 bytes, the
largest of ten) compiles clean under `vm.SourceTextModule`. `APP_VERSION = 'app-v85'` and
`sw.js` `CACHE = 'chemowell-app-v85-1'` moved together.

**Rule 0.** Clean. No patient name and no gendered pronoun on any added line (checked against the
diff, not the file). *"Switch profile to arm theirs"* is correctly they/them. No dose, ceiling or
schedule was added. No new behaviour keyed to a medication id — `notifCancelCandidates` branches on
`extra.profileId` only. `h()` skips `null` children (line 4160), so `profileScopeLine()` returning
`null` on a one-profile phone is safe; verified by rendering it rather than by reading it.

---

# NON-BLOCKING

* **N1 — the swallowed error in `cancelRemindersForProfile` is defensible, its consequence is
  not.** Measured: with `ln.cancel` throwing, the call resolves without throwing and the alarm
  stays armed. Deletion must not fail on a bridge error — agreed. But because the reconcile loop
  now protects that alarm forever, one transient failure orphans it permanently. With the
  "profile still exists" guard from B1/B2 the same failure self-heals on the next sync, which is
  the real argument for that shape.
* **N2 — dead variable.** `syncNativeReminders` still computes `const guardEnd = nowTs +
  NOTIF_MIN_LEAD_MS;` (line 12623); `notifCancelCandidates` computes its own and nothing else in
  the function reads it. Harmless, but it is the kind of leftover that says the extraction was not
  swept.
* **N3 — pre-existing.** `deleteProfile`'s storage-cleanup list (`['-entries-v1', '-prefs-v1',
  '-med-v1', '-appts-v1', '-notes-v1']`) omits `-synckey-v1` and has drifted from
  `CW_PROFILE_SUFFIXES`, which the undo path uses. Two lists, one job. Not this release's doing.

---

# WHAT WOULD MAKE THIS SHIP

1. Close B1 and B2 — preferably with the "profile still exists" guard, which closes both at once.
2. Add the `app-v85` `CHANGELOG` entry; re-run `test/v84-whatsnew.mjs` to 96/96.
3. Rewrite the Settings sentence so it is true after this change, and fix the plural agreement.
4. Re-extract the `harness-v84-whatsnew.py` payload (or point `verify-rebuild.sh` at a v85 script)
   until it exits 0.
5. Add the two protection-band checks and at least one `deleteProfile` check driving
   `cancelForProfile`; replace the Settings exemption with the stubbed-native render — it works,
   I ran it — or, if it is genuinely to stay exempt, say so without naming a test that does not
   exist.

The re-audit is a delta pass: B1/B2 need the erase-and-reload probe re-run, B3/B5 are suite exit
codes, B4 is a read.
