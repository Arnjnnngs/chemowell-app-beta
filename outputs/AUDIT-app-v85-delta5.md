AUDITED-COMMIT: f9bb182
VERDICT: SHIP

Zero Day Auditor, app-v85 fifth delta. Range `git diff 43f1d95 f9bb182`.

---

# HEADLINE

**All four of delta4's items are genuinely fixed, and I proved each one by killing the mutant that
proved it broken: M20 (the uncovered lead condition) and M24 (the check that could go green on a
wrong README) both scored clean passes at `43f1d95` and both now DIE.** The suite runs **43/43,
exit 0**, the README says 43/43 and the check that says so now computes the figure from its own run
with an offset of one — itself. Nothing in this delta can reach a user: `index.html` is byte-identical
to the commit delta4 cleared behaviourally, verified below. Two residual holes are recorded as
follow-ups and I am explicitly NOT blocking on either: a check appended *after* the last check would
still let the README figure drift (M25 — but the version it replaced had that hole **and** the one it
fixed, measured as M29), and `pageerror` is wired to the first of six pages so "no page error at any
point above" cannot see an error on five of them (M31 — pre-existing, one line, and no claim in the
record depends on it).

---

# THE PRECONDITION, VERIFIED FIRST

```
$ git diff 43f1d95 f9bb182 -- index.html
                                  <- empty
$ git diff --name-status 43f1d95 f9bb182
M  README.md
A  outputs/AUDIT-app-v85-delta4.md
M  test/v85-profile-reminders.mjs
```

**The application's behavioural surface is untouched.** Three files in the delta and no others; one
of the three is delta4's own report. Nothing below re-litigates behaviour that delta4 cleared,
except where a new check makes a claim ABOUT that behaviour, which is fair game and is where 6d is
attacked.

**The suite at HEAD:**

```
6d. THE ONE STATE WHERE THE TWO CONDITIONS DISAGREE
  PASS  exact denied with no medications still lands in on-exact, not empty  |  onExact=true
  PASS  and a count line really is on screen saying zero  |  zeroCount=true
  PASS  so the sentence scopes the count that is showing  |  This count is for Alex only. The other profile on this phone keeps the

7. NOTHING THREW
  PASS  no page error at any point above  |  none

8. THE README'S FIGURE FOR THIS SUITE MUST BE THIS SUITE'S FIGURE
  PASS  the README figure for this suite is this suite's figure  |  README says 43/43, this run counts 43

43 checks: 43 passed, 0 failed        (exit 0)
```

---

# ITEM 1 — THE LEAD CONDITION (delta4's BLOCKER). **FIXED. THE SURVIVOR DIES.**

| Mutant | At `43f1d95` | At `f9bb182` |
|---|---|---|
| **M20** — revert `status !== 'empty'` to `notifScheduledCount > 0` at `index.html:9322` | **41/41 — SURVIVED CLEAN** | **43 checks: 42 passed, 1 failed, exit 1 — DIES** |

```
=== M20 ===
exit 1
  FAIL  so the sentence scopes the count that is showing  |  This is for Alex only. The other profile on this phone keeps the remin
43 checks: 42 passed, 1 failed
```

**And 6d is asserting the state it claims, not passing for some other reason.** I attacked it three
ways rather than reading it:

| Mutant | What it does | Score | Verdict |
|---|---|---|---|
| **M26** (mine) | delete `countLine()` from the **`on-exact` branch only** — the card then shows no count while the lead still scopes one | 43: 42 pass, **1 fail** | **DIES** on *"and a count line really is on screen saying zero \| zeroCount=false"* |
| **M28** (mine) | swap the precedence in `nativeNotifStatus()` so `notifScheduledCount === 0 → 'empty'` is tested **before** `notifExactState === 'denied' → 'on-exact'` | 43: 40 pass, **3 fail** | **DIES** on all three of 6d |
| **M16** | delete `profileScopeLine()` from `on-exact` only | 39: 36 pass, **3 fail** | **DIES** (delta3: 33/33 SURVIVED) |

M26 is the one that matters. 6d's middle assertion is not decoration: remove the count line and the
fixture no longer certifies the state, and it says so. M28 proves 6d pins the *reason* the state
exists — the comment's claim that `nativeNotifStatus()` returns `on-exact` before it ever consults
the count is now an assertion, not a sentence.

**I could not write a non-equivalent mutant of the lead condition that 6d misses.** The only
survivors I found are semantically equivalent over the three states that render the line: the scope
sentence is rendered in `on`, `on-exact` and `empty` **only** (`index.html:9381`, `9396`, `9398` —
`checking`, `paused_sim`, `blocked`, `not_asked` and `failed` return before it), and
`nativeNotifStatus()` guarantees `'on' → count > 0` and `'empty' → count === 0`, so
`status !== 'empty'`, `count > 0 || status === 'on-exact'` and `status === 'on' || status === 'on-exact'`
are the same predicate there. **`status !== 'empty'` is the correct and narrowest condition**, and it
does not over-claim in any other state because no other state prints the sentence at all.

**The README records the change** (delta4's TO SHIP item 2), in the row's own words: *"The same round
changed which test decides how that sentence opens, from 'are any reminders scheduled' to 'is the
card in its empty state' … Nothing rendered that state, and reverting the new condition scored a
clean pass; it has its own fixture now."* True, and it names the survivor rather than burying it.

---

# ITEM 2 — THE README CHECK'S TYPED OFFSET. **THE OLD HOLE IS CLOSED. A NARROWER ONE REMAINS (NOT BLOCKING).**

| Mutant | At `43f1d95` | At `f9bb182` |
|---|---|---|
| **M24** — delete a check that is **not** the last (section 7's `no page error`) | **40/40 — SURVIVED**, README reading 41/41 | **42: 41 pass, 1 fail — DIES** |

```
=== M24 ===
exit 1
  FAIL  the README figure for this suite is this suite's figure  |  README says 43/43, this run counts 42
42 checks: 41 passed, 1 failed
```

Two more, both green-to-red, so the check is falsifiable in both the directions it is meant to cover:

| Mutant | Score | Verdict |
|---|---|---|
| **M18** — drift the README figure to `44/44` | 43: 42 pass, 1 fail | **DIES** |
| **M22** — replace the figure with `**all checks green**` so the regex matches nothing | 43: 42 pass, 1 fail | **DIES** — *"README names no figure for test/v85-profile-reminders.mjs at all"*. It **fails; it does not silently skip.** The `if (readmeClaim)` guard that made a skip possible is gone: the null case is now inside the single assertion. |

M16 above is a bonus property worth naming: when an earlier failure causes sub-checks to be *skipped*
(39 ran instead of 43), section 8 catches the shortfall too. A suite that quietly stops running
checks is now a red suite.

### F1 (MEDIUM, NOT BLOCKING) — a check appended *after* section 8 still goes green on a wrong README

**Measured. M25 (mine):** append one trailing check after section 8, leave the README at 43/43.

```
=== M25 ===
exit 0
  PASS  the README figure for this suite is this suite's figure  |  README says 43/43, this run counts 43
44 checks: 44 passed, 0 failed
```

The suite prints **44**, the README says **43**, and the check is green. `const total = pass + fail + 1`
is still a typed constant; what makes it correct is that section 8 is last, and **nothing enforces
"last" except a comment.**

**Why this is a follow-up and not a sixth refusal.** I measured the version it replaced, on the same
mutant. **M29 (mine):** the `43f1d95` test file and README restored in place, one check appended
after the old section 6c:

```
=== M29 ===  (the OLD +2 version)
exit 0
  PASS  the README figure matches what this suite actually runs  |  README says 41/41, suite runs 41
42 checks: 42 passed, 0 failed
```

**The old version had this same hole, plus the deletion hole that delta4 blocked on.** The fix is a
strict reduction: deletion anywhere is now caught, insertion anywhere *above* section 8 is caught,
and the only remaining false green needs someone to append a check below the one check whose comment
says in capitals that it is deliberately last. Today's record is correct and measured. Blocking a
fifth time on a strictly smaller residue of the thing being fixed is the cost this release cannot
keep paying.

**The fix when someone is next in the file (recommended, small):** stop making the README comparison
a counted check. Compute `const total = pass + fail` after every check has run, compare, and on
mismatch print a FAIL line and `process.exitCode = 1` without incrementing the tally. The offset then
does not exist and cannot be wrong in either direction.

---

# ITEM 3 — "THIRTEEN MUTANTS", TWELVE NAMED. **FIXED. I COUNTED THEM.**

The row now reads *"Falsified against **fourteen** mutants"*. Counting the list as a reader would:

1 guard dropped · 2 guard inverted · 3 guard reverted to active-only · 4 guard made to fail open ·
5 mid-fire band deleted · 6 `deleteProfile`'s call removed · 7 scope line deleted from `on` ·
8 scope line deleted from `on-exact` · 9 scope sentence inverted to claim full coverage ·
10 expiry clause dropped · 11 expiry changed to thirty days · **12 the plural instruction moved back
outside the ternary** · 13 empty-state lead reverted · **14 the lead condition reverted to the dose
count**.

**Fourteen named, fourteen claimed.** Both mutants delta4 said were missing are present. The row also
records the defect rather than hiding it: *"The list is counted rather than asserted — it said
thirteen while naming twelve."*

The two mutants that are in the list because they were this delta's subject both die:

| Mutant | Score | Verdict |
|---|---|---|
| **M17** — the plural tail reverted to singular outside the ternary | 43: 41 pass, **2 fail** | **DIES** — *"the instruction is plural too — not 'open that profile'"* and *"it tells them to open each of them"* |
| **M20** | see ITEM 1 | **DIES** |

---

# ITEM 4 — THE TWO SENTENCES WITH DIFFERENT NUMBERS. **COLLAPSED INTO ONE, AND THE ONE IS TRUE.**

`grep -c "Two of those survived" README.md` → **0**. One survivor sentence remains:

> *"**Four of them scored a clean pass against a version of this suite that had already been called
> done**… `deleteProfile`'s call removed…; the scope line deleted from `on-exact` alone; the
> empty-state lead reverted; and the lead condition reverted."*

**Four named, and each one really did survive a suite that had been called done.** I checked all four
against the record and the history rather than taking the sentence's word:

| Survivor | Evidence |
|---|---|
| `deleteProfile`'s call removed | `AUDIT-app-v85.md` M2 — **10/10 PASS** |
| scope line deleted from `on-exact` alone | `AUDIT-app-v85-delta3.md` M16 — **33/33 SURVIVES** |
| empty-state lead reverted | the ternary landed at **f962e01**; the check that covers it (6b) landed one commit later at **f4b8e98** (`git log -S`), so at f962e01 — a commit reported done — a revert was invisible |
| lead condition reverted | `AUDIT-app-v85-delta4.md` M20 — **41/41 SURVIVES** |

Nothing else in the row went stale in this edit: the only `v85-profile-reminders` figure in README.md
is line 14's `**43/43**` (so section 8's regex cannot match a different suite's number), the row's
remaining `thirteen` is the deliberate self-record quoted above, and the `41/41` elsewhere in the file
is the app-v84 row, a different suite.

---

# NEW FINDING F2 (MEDIUM, NOT BLOCKING) — "no page error at any point above" watches ONE page in six

`test/v85-profile-reminders.mjs:40` attaches the listener to the first page only:

```js
const page = await ctx.newPage();
page.on('pageerror', (e) => thrown.push(String(e)));
```

Five later pages — `nativePage` (205), `solo` (301), `exactPage` (330), `emptyPage` (380) and
**`leadPage` (427, new in this delta)** — have no listener, so section 7's check cannot see an error
raised on any of them.

**Measured, not asserted. M31 (mine):** raise a genuine uncaught error that fires only on 6d's page
(`if (status !== 'empty' && notifScheduledCount === 0) setTimeout(() => { throw new Error(...) }, 0)`):

```
=== M31 ===
exit 0
  PASS  no page error at any point above  |  none
43 checks: 43 passed, 0 failed
```

**The check reports "none" while the page it was added for is throwing.** Severity is held at MEDIUM
and not a block because: it is **pre-existing** (five of the six pages were already unwatched at
`43f1d95`, which was audited in full), a fatal error would fail the card assertions anyway so the
exposure is silent non-fatal errors, **no claim in the README row depends on it** (the row makes no
page-error or console-error claim — checked), and the fix is one line for whoever is next in the file:

```js
ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));
```

The check's *label* is what is wrong — "at any point above" is a promise about six pages backed by
one. Rename it or wire the context; either is minutes.

---

# RULE 0

`node test/v75-no-other-patient.mjs` → **27/27 checks passed**, ratchet at **0/0/0** (and the fence
is gone, per its own output). Read directly against the delta as well:
`git diff 43f1d95 f9bb182 -- README.md test/v85-profile-reminders.mjs | grep '^+' | grep -i '\bshe\b|\bher\b|\bhis\b|\bhim\b|brandi'` → **no matches**. No patient name, no gendered pronoun in the new
code comments or the new README prose, no dose, ceiling or schedule from a care plan, no branch on a
medication id. The 6d fixture's `sex: 'female'` is a preference the app itself collects, set in a
test fixture exactly as 6a already does — not app copy, not a leak.

---

# THE FULL MUTANT BOARD AT `f9bb182`

| Mutant | What it does | Score | Verdict |
|---|---|---|---|
| **M16** | delete `profileScopeLine()` from the `on-exact` branch only | 39 · 36 pass / 3 fail | **DIES** |
| **M17** | revert the plural tail to singular, outside the ternary | 43 · 41 / 2 | **DIES** |
| **M18** | drift the README figure to `44/44` | 43 · 42 / 1 | **DIES** |
| **M20** | revert the lead to `notifScheduledCount > 0` | 43 · 42 / 1 | **DIES** (was 41/41 SURVIVED) |
| **M22** | remove the figure from the README entirely | 43 · 42 / 1 | **DIES** — fails, does not skip |
| **M24** | delete a check that is not the last (section 7) | 42 · 41 / 1 | **DIES** (was 40/40 SURVIVED) |
| **M25** | append a check AFTER section 8, README untouched | **44 · 44 / 0** | **SURVIVES — F1** |
| **M26** | delete `countLine()` from the `on-exact` branch | 43 · 42 / 1 | **DIES** |
| **M28** | test `empty` before `on-exact` in `nativeNotifStatus()` | 43 · 40 / 3 | **DIES** |
| **M29** | M25 applied to the OLD `+2` version at `43f1d95` | **42 · 42 / 0** | **SURVIVES — the hole is older and was larger** |
| **M31** | uncaught page error raised only on 6d's page | **43 · 43 / 0** | **SURVIVES — F2** |

Every mutant was applied in place, restored from a byte copy immediately after the run, and
`md5sum -c` confirmed `index.html`, `README.md` and `test/v85-profile-reminders.mjs` identical to
their pre-mutant bytes after **every** run (11 for 11). `git status --porcelain` is empty apart from
this report. The local server on 8899 was killed (`pgrep` clean, `curl` → connection refused).

---

# NOT BLOCKING — FOLLOW-UPS, IN THE ORDER I WOULD DO THEM

1. **F2 — wire `pageerror` to the context, not the first page** (one line, `test/v85-profile-reminders.mjs:40`).
   Until then the check's name overstates it by five pages. Evidence: M31.
2. **F1 — make the README figure comparison uncounted** so the `+1` disappears (four lines, section 8).
   Evidence: M25; and M29 shows the predecessor's version was worse, not better.
3. **M7 — `deleteProfile`'s refusal to delete the ACTIVE profile** is still pre-existing, correct and
   untested. Unchanged and still recommended since delta2. One line of coverage.

None of the three can reach a phone, change a record, or make anything the release says untrue.

---

# TO SHIP

1. **PM sign-off at `f9bb182`.** `./release_check.sh` currently exits with
   *"a chain report refuses this release"* naming `AUDIT-app-v85-delta3.md` (f4b8e98),
   `AUDIT-app-v85-delta4.md` (43f1d95) and `PM-app-v85.md` (f962e01). This report clears the two
   audit refusals by being a later commit saying SHIP; **`PM-app-v85.md` still refuses at f962e01 and
   only a PM re-run against `f9bb182` clears it.**
2. Nothing else. The audit chain is clear.
