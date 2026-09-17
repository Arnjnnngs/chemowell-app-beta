AUDITED-COMMIT: 43f1d95
VERDICT: DO NOT SHIP

Zero Day Auditor, app-v85 fourth delta. Range `git diff f4b8e98 43f1d95`.

Prior passes read first: `AUDIT-app-v85.md`, `-delta.md`, `-delta2.md`, `-delta3.md`, and
`PM-app-v85.md`. Nothing settled there is re-litigated below.

---

# HEADLINE

**This commit made TWO code changes. One is properly covered; the other is covered by nothing, and
the release row does not mention it at all.**

Reverting `status !== 'empty'` back to `notifScheduledCount > 0` — the exact line my predecessor's
state-D finding caused to be written — scores a **clean 41/41**. That is delta3's E2 reasoning
("`on-exact` is covered by nothing") applied to the line written in the same commit that fixed E2.

Two smaller findings ride with it: the README claims **"thirteen mutants"** and enumerates
**twelve**, still omitting the mutant for this commit's own headline fix; and the new section 6c can
go green on a README that is wrong (measured — mutant M24 below), because it compares against a
hand-typed `+2` offset, which is the same species of typed constant the check exists to eliminate.

**The three blockers I was sent to verify are genuinely fixed and I proved each one by rendering or
by killing a mutant.** Nothing caregiver-facing is wrong at this commit. The three items above are
minutes of work each; the refusal is because this release's entire history is "reported fixed and
was not", and the shape that produced that history is present again.

---

# ITEM 1 — E1, THE PLURAL TAIL. **FIXED. VERIFIED BY RENDERING.**

I did not read the diff for this. I drove the shipped `index.html` behind a Capacitor stub at one,
two, three, four and five profiles and read the sentence off the rendered card.

```
profiles=1  scope attr: null      SENTENCE: (none)        <- correctly absent

profiles=2  scope attr: 1
  This count is for Alex only. The other profile on this phone keeps the reminders it already
  had, but nothing adds to them while you are not in it, and they run out within about three
  days — open that profile to set its reminders up again.

profiles=3  scope attr: 2
  This count is for Alex only. The other 2 profiles on this phone keep the reminders they already
  had, but nothing adds to those while you are not in them, and they run out within about three
  days — open each of them to set their reminders up again.

profiles=4  scope attr: 3   ... The other 3 profiles ... — open each of them to set their reminders up again.
profiles=5  scope attr: 4   ... The other 4 profiles ... — open each of them to set their reminders up again.
```

The instruction now agrees in number with the count in its own sentence, at every count. Read out
loud, the plural reads naturally and answers the question the singular version dodged: *which
profile.* "Open each of them" is a better answer than delta3's suggested "open each profile",
because "them" is already the subject of the clause before it.

**The four states from delta3, re-rendered at this commit:**

```
A  exact granted, win-med -> on        count "3 reminders scheduled..."   lead "This count is for Alex only."
B  exact denied,  win-med -> on-exact  count "3 reminders scheduled..."   lead "This count is for Alex only."
C  exact granted, no meds -> empty     no count line                      lead "This is for Alex only."
D  exact denied,  no meds -> on-exact  count "0 reminders scheduled..."   lead "This count is for Alex only."
```

**State D now agrees with itself.** A count is on screen and the lead scopes a count. That is the
`status !== 'empty'` change working, and it is correct. See ITEM 5 for why it is still a finding.

`status` is `const status = nativeNotifStatus()` at line 9260, declared before `profileScopeLine` is
defined (9291) and long before it is called (9382 / 9395 / 9398) — no TDZ trap. Zero page errors in
every render above.

**Mutants — both die:**

| Mutant | Result |
|---|---|
| **M17** — revert the tail to singular *outside* the ternary (the exact defect delta3 found) | **39/41 — DIES.** Two failures, both in 6a. |
| **M19** (mine) — keep the tail inside the ternary but make the plural branch say *"open that profile to set its reminders up again"* | **39/41 — DIES.** |

M19 matters because it proves the check bites on the WORDS, not on the refactor. A suite that only
noticed the tail moving would pass a plural branch that had been re-broken in place.

---

# ITEM 2 — E2, `on-exact` COVERAGE. **FIXED. THE MUTANT THAT SURVIVED NOW DIES.**

Section 6a drives a real render with `checkExactNotificationSetting: async () => ({ exact_alarm:
'denied' })` and three profiles, and asserts the state it reached rather than assuming it.

```
6a. on-exact — THE STATE ANDROID USERS START IN
  PASS  the card is in the on-exact state  |  onExact=true
  PASS  the scope line renders in on-exact too  |  This count is for Alex only. The other 2 profiles...
  PASS  it counts two other profiles  |  data-notif-profile-scope=2
  PASS  the plural branch agrees in number
  PASS  the instruction is plural too — not "open that profile"
  PASS  it tells them to open each of them
```

| Mutant | Before (delta3) | Now |
|---|---|---|
| **M16** — delete `profileScopeLine()` from the **`on-exact` branch only** | **33/33 — SURVIVED** | **35/37 — DIES.** |

M16's two failures:

```
FAIL  the scope line renders in on-exact too  |  ABSENT — on-exact has lost its coverage
FAIL  the README figure matches what this suite actually runs  |  README says 41/41, suite runs 37
```

I also checked the neighbouring branch is still covered, because 6a's fixture could in principle
have been made to cover on-exact by breaking `empty`:

| Mutant | Result |
|---|---|
| **M21** (mine) — delete `profileScopeLine()` from the **`empty` branch only** | **37/39 — DIES.** |
| **M23** (mine) — revert the `empty` lead to the unconditional *"This count is for"* constant | **39/41 — DIES.** |

All three states a phone actually shows are now behaviourally covered, and each one dies on its own.

---

# ITEM 3 — E3, THE README FIGURE. **FIXED FOR TODAY. THE GUARD HAS A HOLE — MEASURED.**

Today's figure is right, and the check that enforces it is falsifiable:

```
6c. THE README'S FIGURE FOR THIS SUITE MUST BE THIS SUITE'S FIGURE
  PASS  README names a figure for this suite at all  |  {"claimed":41,"of":41}
  PASS  the README figure matches what this suite actually runs  |  README says 41/41, suite runs 41

41 checks: 41 passed, 0 failed     (exit 0)
```

**Adversarial questions the brief asked, answered by measurement rather than by reading:**

| Question | Answer |
|---|---|
| Does it fail if the figure drifts? | **Yes.** **M18** — README `41/41` → `42/42`: **40/41, DIES.** |
| Does it **silently skip** when the pattern does not match? | **No, it fails.** **M22** (mine) — replace `**41/41**` with `**all checks green**`: **39/40, DIES** on *"README names a figure for this suite at all \| no figure found"*. |
| Can it match the wrong figure? | **No today.** `v85-profile-reminders` occurs exactly once in README.md. It would be first-match-wins if a second mention were ever added. |
| Could a stale service-worker cache feed it an old README? | **No.** `SHELL` in `sw.js` is `['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png']`; the catch-all handler is `caches.match(req).then(r => r \|\| fetch(req))`, so README.md is never cached and always goes to network. |
| **Can it pass on a README that is wrong?** | **YES. See below.** |

### NEW FINDING (MEDIUM) — 6c goes green on a wrong README if a check *after* it is deleted

`const actual = pass + fail + 2;   // +2: this check and the one below are counted after this runs`

The `+2` is a hand-typed constant asserting how many checks exist below line ~430. Measured:

**M24 (mine)** — delete section 7's single check (`t('no page error at any point above', ...)`):

```
=== M24 ===
exit 0
40 checks: 40 passed, 0 failed
```

The suite prints **40** and the README says **41/41** and **6c is green**. A check built because one
number had been wrong five times can now certify a sixth wrong value.

**Which directions are safe:** adding a check *before* 6c — the historical failure mode, and what
actually happened when 6b landed — is caught (`actual` rises, README goes stale, red). Adding one
*after* is caught noisily (`actual` is 2 low, red, with a confusing message). Only **deletion after
6c** gives a false green.

**Repro:** delete the `t(...)` line under `console.log('\n7. NOTHING THREW')`, run the suite, observe
`40 checks: 40 passed, 0 failed` alongside a README reading `41/41`.

**Fix (four lines):** move the README comparison to the very end of the file, after section 7, and
compare against the real `pass + fail` instead of an offset. The number then cannot be typed at all,
which is the stated goal of the check.

---

# ITEM 4 — THE TWO README IMPRECISIONS. **ONE FIXED. ONE HALF-FIXED, AND THE HALF THAT IS LEFT IS COUNTABLY FALSE.**

**(a) FIXED.** The stale description is gone. Old: *"It now says they survive but stop being kept up
to date."* New: *"It now says nothing adds to them and they run out within about three days — the
expiry is what makes it a limitation rather than a trap."* Checked against the shipped string, which
reads *"...but nothing adds to them while you are not in it, and they run out within about three
days"*. **True.**

**(b) NOT FIXED — and it got a new defect.** The row now reads:

> *"Falsified against **thirteen** mutants, every one behavioural: guard dropped, guard inverted,
> guard reverted to active-only, guard made to fail open, mid-fire band deleted, `deleteProfile`'s
> call removed, the scope line deleted from `on` and from `on-exact` **separately** (...), the scope
> sentence inverted to claim full coverage, the expiry clause dropped, the expiry changed to thirty
> days, and the empty-state lead reverted."*

Count them: guard dropped (1), guard inverted (2), guard reverted to active-only (3), guard made to
fail open (4), mid-fire band deleted (5), `deleteProfile`'s call removed (6), scope line from `on`
(7), scope line from `on-exact` (8), scope sentence inverted (9), expiry clause dropped (10), expiry
to thirty days (11), empty-state lead reverted (12).

**Twelve named. The sentence says thirteen.** The word-diff shows the edit went `nine` → `thirteen`
while adding exactly three items to a list of nine (split the `on`/`on-exact` item into two, add
"thirty days", add "empty-state lead"), i.e. 9 + 3 = 12.

**And the mutant the list should most obviously contain is still missing: the plural tail.** This
commit's headline fix. Delta3's own words — *"a mutant that survived an earlier version is the most
informative kind"* — and M17 is precisely that: the defect delta3 found by rendering, now killed
39/41. The row narrates the defect at length in prose and leaves it out of the falsification list.
`lead`-ternary got added; the tail did not.

**This is the sixth wrong number in this one row**, one commit after a machine check was built on the
stated principle that *"a number that has been wrong five times should not be typed a sixth — it
should be checked."* A reader can count this one on their fingers.

**Fix:** `thirteen` → `thirteen` with the tail mutant named (*"the plural instruction reverted to
the singular \"open that profile\""*), or `thirteen` → `twelve`. The first is better: it records the
mutant for the fix this commit exists to make.

---

# ITEM 5 — **NEW BLOCKER.** THE SECOND CODE CHANGE IN THIS COMMIT IS COVERED BY NOTHING

The diff changed two lines of behaviour, not one:

```js
- const lead = notifScheduledCount > 0 ? 'This count is for ' ... : 'This is for ' ...
+ const lead = status !== 'empty'      ? 'This count is for ' ... : 'This is for ' ...
```

**Measured:**

| Mutant | Result |
|---|---|
| **M20** (mine) — revert `status !== 'empty'` to `notifScheduledCount > 0` | **41/41 — SURVIVES CLEAN.** |

```
=== M20 ===
exit 0
41 checks: 41 passed, 0 failed
```

**Why nothing catches it.** 6b renders `empty`, where the two conditions agree (`status === 'empty'`
implies `notifScheduledCount === 0`). 6a and 6 render `on-exact` and `on` with a `type:'win'`
medication, so the count is 3 and the two conditions agree again. **The only state where they
disagree is state D — exact alarms denied AND no medications — and no fixture builds it.** It is one
`localStorage` line away from 6a's fixture: the same page with `meds: []`.

**This is delta3's E2, one commit later, in the line that E2's sibling finding produced.** The
pattern this release keeps reproducing is not "a bug slipped through" — it is "the fix for the last
audit shipped without the check that would catch its removal." That is now the fourth occurrence in
app-v85 (the `on` scope line, the `empty` lead, `on-exact`, and this).

**Severity.** The code is CORRECT — I rendered state D and it reads coherently, and delta3 itself
ranked D as *"awkward, not false."* The exposure is regression, not a live defect: the next person
tidying this function reverts one condition to the other and no gate objects. On the standard delta3
set for E2, an uncovered branch of caregiver-facing copy is a block, and I am applying that standard
to the line written in answer to it.

**And the row does not mention the change.** The app-v85 README row narrates the plural-tail fix in
detail and says nothing about the lead condition moving from the count to the status. A behaviour
change to caregiver-facing copy logic, shipped undocumented, in a release whose defining failure is
the record disagreeing with the file.

**Fix (six lines):** a fourth fixture — exact denied, `meds: []` — asserting the card is `on-exact`,
that a count line reading `0 reminders` is on screen, and that the lead is *"This count is for"*.
M20 must then fail.

---

# WHAT ELSE I CHECKED, AND FOUND GOOD

**Nothing in `index.html` moved beyond the sentence.** The delta `f4b8e98..43f1d95` touches
`index.html` in **exactly one hunk**, `@@ -9314,12 +9314,23 @@`, inside `profileScopeLine`. Across
the whole range from the last accepted behavioural commit, `cbc0520..43f1d95`, `index.html` has two
hunks — that one and the CHANGELOG copy at 9059 which delta3 audited and cleared. `git diff cbc0520
43f1d95 -- index.html | grep -c notifCancelCandidates` → **0**, same for
`cancelRemindersForProfile`. **The behavioural core, the mid-fire band and the fail-closed guard on
a corrupt profile list are byte-identical to the commit at which they were accepted.**

**Four files changed in the delta, and no others:** `README.md`, `index.html`,
`test/v85-profile-reminders.mjs`, `outputs/AUDIT-app-v85-delta3.md`.

**The behavioural suite is green end to end**, 41/41, exit 0, including every check that predates
this commit — nothing was broken making these fixes:

```
3d. AN UNREADABLE PROFILE LIST MUST FAIL CLOSED
  PASS  a corrupt profile list protects the other profile rather than sweeping it  |  cancelled=0
  PASS  a missing profile list protects it too  |  cancelled=0
  PASS  and a healthy list still protects it  |  cancelled=0
...
7. NOTHING THREW
  PASS  no page error at any point above  |  none
```

**Rule 0 is clean.** `test/v75-no-other-patient.mjs` → **27/27**, including the ratchet at 0/0/0.
Read directly against the new text: the new plural string uses **they / them / their** throughout,
names no patient, carries no dose, ceiling or schedule, and branches on no medication id. The new
code comments carry no gendered pronoun. The 6a fixture's `sex: 'female'` is a pref the app itself
asks for, in a test fixture, not app copy — not a leak.

**The Voice, on the rest of the row.** Every other claim I spot-checked is true at this commit:
*"`on` and `on-exact` are covered behaviourally, on a rendered card in the state a real phone
shows"* — now true, 6a proves it. *"The suite now asserts the plural branch at three profiles, in
the `on-exact` state"* — true. *"`test/v85-profile-reminders.mjs` 41/41"* — true, and now
self-checking. The paragraph on the plural-tail defect is accurate and does not minimise it
(*"Found by an audit rendering the plural branch; the Designer had rendered it the round before and
read it for layout, which is not the same as asserting it"*).

**The in-app What's New copy is unchanged in this delta** and still reads true: *"another person's
run out within about three days, so open their profile to set theirs up again"* — generic singular
"their", correct at any profile count.

**`./release_check.sh` exit 1** is expected until this report lands and is not a finding.

**M7 — still not a blocker.** `deleteProfile`'s refusal to delete the ACTIVE profile remains
pre-existing, correct, and untested. Unchanged from delta2 and delta3. One line of coverage when
someone is next in the file.

---

# THE FULL MUTANT BOARD I RAN AT `43f1d95`

| Mutant | What it does | Score | Verdict |
|---|---|---|---|
| **M16** | delete `profileScopeLine()` from the `on-exact` branch only | 35/37 | **DIES** (was 33/33 SURVIVED) |
| **M17** | revert the tail to singular, outside the ternary | 39/41 | **DIES** |
| **M18** | drift the README figure to `42/42` | 40/41 | **DIES** |
| **M19** | plural branch says *"open that profile"* (tail stays inside ternary) | 39/41 | **DIES** |
| **M20** | revert the lead to `notifScheduledCount > 0` | **41/41** | **SURVIVES — ITEM 5** |
| **M21** | delete `profileScopeLine()` from the `empty` branch only | 37/39 | **DIES** |
| **M22** | remove the figure from README entirely | 39/40 | **DIES** (fails, does not skip) |
| **M23** | revert the `empty` lead to an unconditional constant | 39/41 | **DIES** |
| **M24** | delete one check *after* 6c | **40/40** | **SURVIVES — ITEM 3** |

Every mutant was applied in place, the file restored from a byte copy immediately afterwards, and
`md5sum -c` confirmed all three files identical to their pre-mutant state after every run.
`git status --porcelain` is empty.

---

# TO SHIP

1. **Cover the lead condition (ITEM 5).** A fourth fixture — exact denied, `meds: []` — asserting
   `on-exact`, a `0 reminders` count line, and a lead of *"This count is for"*. **M20 must then
   fail.** Six lines.
2. **Say in the README row that the lead condition changed**, and why — one clause. A code change to
   caregiver-facing copy logic that the release record does not mention is the failure this release
   is named for.
3. **Fix the mutant count (ITEM 4b).** Name the plural-tail mutant in the list so the number is
   thirteen and true, or change the number to twelve. Do not leave a list a reader can count.
4. **Close 6c's hole (ITEM 3).** Move the README comparison after section 7 and compare against the
   real final `pass + fail`. Delete the `+2`. **M24 must then fail.**
5. PM sign-off.

The re-audit is one mutant run (M20 and M24 must both go red), one `grep` of the README sentence,
and a count.
