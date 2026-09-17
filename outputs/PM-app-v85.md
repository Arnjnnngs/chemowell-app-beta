AUDITED-COMMIT: f962e0198ca918b87d73a5d414fd63cd6995ed16
VERDICT: DO NOT SHIP

Project Manager sign-off desk, ChemoWell **app-v85 stage 1**, branch
`claude/caretracker-team-review-i83ik2`, HEAD `f962e01`.

I did not build this. Everything below was measured at `f962e01` by running it. Where I took a
claim from a chain report rather than re-measuring it, I say so in that line. The repo working tree
was not modified: both mutants were served from a copy under the session scratchpad, and
`git status` is clean.

---

# HEADLINE

**The fix itself is right, and I could not find anything a caregiver can hit. I am still refusing,
for three reasons, and the first is not a formality.**

1. **The release gate `./release_check.sh` exits 1.** Raw output below. It names the missing
   design-time seats, and — separately, measured by hand because the gate exits before it prints it
   — there is **no CURRENT audit**: `index.html` moved after the only SHIP verdict.
2. **No auditor has seen the tree being shipped.** The only SHIP verdict on record examined
   `cbc0520`. `f962e01` changed `index.html` after it, and the change is **not text-only** — it adds
   a new conditional reading a variable that function never touched before. The second delta
   licensed *"text … need no re-verification"*; this exceeds that licence, and the one code line in
   it is the one line the suite does not cover (M10 below).
3. **The Designer seat never ran for this release**, and the release lengthens a sentence inside a
   card on the smallest screen the app supports. `outputs/DESIGN*app-v85*` does not exist. The
   Enhancer pass DID run and is substantive — but it is filed as
   `ENHANCER-multiprofile-notifications.md`, which the gate's own glob cannot see, so from the
   gate's side the seat looks skipped too.

**None of this says the code is wrong.** Everything the three audits raised is genuinely closed
against the file, I re-drove the suite and it is honest, and Rule 0 is clean. What is missing is
that somebody independent looks at `f962e01` and that the screen gets measured. Both are cheap.

---

# 1. `./release_check.sh` — RAW OUTPUT, run by me at `f962e01`

Pasted exactly as it printed, not summarised. Run after this report was written, so the gate is
seeing my own refusal:

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.EYu5PIVazd
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v84 (chemowell-app-v84-14) at 55e0bd5
   4 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: the design-time seats have not run for app-v85.
   missing: an outputs/ENHANCER*app-v85*.md pass
   missing: an outputs/DESIGN*app-v85*.md pass
   These run BEFORE the build, on the screens about to change (TEAM-ORDER.md).
   An Enhancer pass that found nothing is written down as 'nothing this time' and still
   counts. Silence does not -- that is the failure this gate exists for.
❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
   These say DO NOT SHIP:
     outputs/PM-app-v85.md — examined f962e01
   A refusal is cleared by re-running that stage against a LATER commit and it saying
   SHIP — not by adding another file beside it.
EXIT=1
```

**Reading it, line by line.**

* **The design-time seats.** `ENHANCER*app-v85*` and `DESIGN*app-v85*` are both absent. The Enhancer
  pass exists under a name the glob cannot match; the Designer pass does not exist at all. Section 4.
* **`outputs/PM-app-v85.md` — examined `f962e01` — says DO NOT SHIP.** That is this file. The gate is
  quoting my verdict back, which is correct behaviour and not a separate finding.

**What the gate does NOT get to print, and I measured myself.** The refusal loop exits before the
currency check, so run the numbers by hand:

```
$ git diff --name-only cbc0520 -- index.html sw.js .github/workflows sync-backend \
      package.json package-lock.json capacitor.config.ts
index.html
```

`check_report_current()` would therefore report `outputs/AUDIT-app-v85-delta2.md — examined cbc0520;
changed since: index.html`, leaving **no CURRENT audit** and failing the gate a third time. So if my
verdict were SHIP this release would still not pass: the gate would name the stale audit instead.
That is the app-v68 scar — a release gated by an audit of a commit the head had moved past — and it
is the right rule to apply here. Section 2.

**One thing the gate gets right that is worth saying out loud:** the `BLOCKING` loop is silent about
`AUDIT-app-v85.md` (`21b8123`) and `AUDIT-app-v85-delta.md` (`f3f1880`). Both say DO NOT SHIP and
both are correctly treated as superseded, because `AUDIT-app-v85-delta2.md` says SHIP at `cbc0520`,
which is a descendant of both. The chain history you gave me checks out mechanically as well as on
a read.

---

# 2. THE POST-AUDIT COMMIT — the thing I was asked to judge, and my answer is that it matters

`f962e01` lands after the SHIP verdict at `cbc0520`. It touches `README.md`, `index.html`,
`outputs/DEVELOPER-multiprofile-notifications.md` and `test/v85-profile-reminders.mjs`.

The second delta's instruction was explicit: *"Before the push, in the same commit — because they
are text and need no re-verification: the three README sentences above, and N1/N2's clause."*

**Two of the three are text and I have no objection to them.** The README sentences are prose; the
N2 expiry clause is a string. But the N1 fix is not a string edit:

```js
const lead = notifScheduledCount > 0 ? 'This count is for ' + myName + ' only. '
                                     : 'This is for '       + myName + ' only. ';
```

That is a new branch, on `notifScheduledCount` — a module-level `let` at line 12536 that
`profileScopeLine()` did not previously read at all. **I checked it and it is correct**:
`nativeNotifStatus()` returns `'empty'` exactly when `notifScheduledCount === 0` (line 12788), and
`profileScopeLine()` is only called from three states — `on-exact` (9371), `empty` (9384) and `on`
(9387) — so the ternary is an exact restatement of the card's own state. No temporal-dead-zone risk:
it is read at render, not at module evaluation.

**So it is right. It is also unreviewed and untested, and I proved the second half.** See M10.

That is why I will not wave the drift through. "Text-only" was the auditor's basis for saying no
re-verification was needed; the commit exceeded it. A delta pass over `f962e01` is a read of one
diff plus two exit codes.

---

# 3. THE THREE AUDIT PASSES, CHECKED AGAINST THE FILE

Every artifact you named exists and says what you said it says. I opened all five.

| Artifact | Header | Holds up |
|---|---|---|
| `outputs/DEVELOPER-multiprofile-notifications.md` | brief, 575 lines | yes — and the appended **"AARON'S DECISIONS, 2026-09-17"** section is really there, with the two items still open listed beside it |
| `outputs/ENHANCER-multiprofile-notifications.md` | Enhancer + Voice, 44 lines, 6 findings | yes — substantive, and E2/E5/E6 are the three the release actually answers |
| `outputs/AUDIT-app-v85.md` | `21b8123` / DO NOT SHIP, five blockers | yes |
| `outputs/AUDIT-app-v85-delta.md` | `f3f1880` / DO NOT SHIP, two new blockers | yes |
| `outputs/AUDIT-app-v85-delta2.md` | `cbc0520` / SHIP, text corrections required | yes |

## Every finding, closed against the file at `f962e01`

**Pass 1 (`21b8123`), five blockers:**

* **B1/B2 — erase and undo orphaning another profile's alarms.** CLOSED. The shipped guard at
  index.html:12628 is the existence key, not the active-id key:
  `if (pid && pid !== ACTIVE_PROFILE_ID && (knownProfileIds === null || knownProfileIds.has(pid))) return false;`
  The suite drives it: *"an alarm for a profile no longer in the list can be swept"* → `1 cancellable`.
  I did **not** re-run the audit's own erase-and-reload browser probe — the delta pass did, against
  both earlier commits, and that code is byte-identical at HEAD (`git diff f3f1880 HEAD` does not
  touch `notifCancelCandidates`). Taken from that pass, and said so.
* **B3 — changelog row missing.** CLOSED. `CHANGELOG[0].v === 'app-v85'` at line 9060.
  `test/v84-whatsnew.mjs` **96/96**, my own run at HEAD.
* **B4 — the false Settings sentence.** CLOSED; see section 5.
* **B5 — `verify-rebuild.sh` red.** CLOSED. **exit 0, 17/17**, my own run. See section 6.

**Pass 2 (`f3f1880`), two blockers:**

* **D1 — no README version-history row.** CLOSED. `grep -c '^| app-v85 ' README.md` → 1.
* **D2 — the changelog row said something untrue.** CLOSED. The *"instead of leaving them to go on
  ringing"* clause is gone, and the trigger now reads *"every time you opened the ChemoWell app"* —
  the universal one, correctly qualified to the phone app (`syncNativeReminders` returns at
  `if (!isNativeApp()) return;`, and the same `index.html` serves the PWA).
* **N4's fail-open hole.** CLOSED and it is the right direction: the list is read straight from
  `localStorage` rather than through `loadJSON`, whose fallback is a plausible one-profile list. A
  corrupt or unreadable list yields `null`, and `null` protects. The suite's section 3d covers
  corrupt, missing and healthy.

**Pass 3 (`cbc0520`), three text corrections + one behavioural:**

* **README "SHIPPED" → "INTRODUCED".** DONE, and **accurate** — I checked it rather than took it.
  `PUBLISHED.json` records the live build as `app-v84` / `chemowell-app-v84-14` at `55e0bd5`, and
  the first draft of the fix existed only at `21b8123` on this branch. The row now reads *"INTRODUCED
  A WORSE BUG — caught on the branch by the independent audit, never on a phone"*, and cites
  `PUBLISHED.json` in the same breath. True.
* **"eight mutants / three clean" → "nine / four".** DONE.
* **"Aaron's decision, already made" now sourced.** DONE — the decisions are written into the
  Developer brief where the questions were asked, and the README points at it.
* **Section 6 made behavioural.** DONE, and it really is: the fixture carries `type: 'win'`, the
  suite asserts `state=on` before reading the sentence, and the structural stand-in is deleted
  rather than kept beside it.

## One correction that did NOT land — and it is the fourth overstatement in this row

**The README app-v85 row claims `test/v85-profile-reminders.mjs` **30/30**. The suite at HEAD
reports `29 checks: 29 passed, 0 failed`.**

`f962e01` rewrote section 6 (deleting the structural stand-in), which took the count from 30 to 29.
Its own commit message says *"29/29"*. The README was edited in that same commit for three other
overstatements and this number was not carried with them.

Nobody can be hurt by it. I am naming it because of what it is: this row has now been corrected for
overstatement three times, and the commit that made the third correction introduced a fourth in the
same edit. A permanent record that is wrong about its own evidence is Rule 7's failure mode, which
the row itself cites two sentences later.

---

# 4. THE DESIGN-TIME SEATS

* **Enhancer — RAN, and well.** `outputs/ENHANCER-multiprofile-notifications.md` is dated before the
  build and its E2 (*"every word is accurate and the screen as a whole is false"*) is the finding
  this whole release turns on. **But the filename carries the feature, not the version**, so
  `release_check.sh`'s `outputs/ENHANCER*app-v85*` glob does not see it. A copy or rename to
  `ENHANCER-app-v85.md` costs nothing and makes the seat visible to the gate that exists to prove it
  was not skipped.
* **Designer — DID NOT RUN.** No `outputs/DESIGN*app-v85*`, and nothing in the three audits is a
  layout pass. This is not only paperwork: the shipped sentence grew by roughly a quarter —

  > "The other profile on this phone keeps the reminders it already had, but nothing adds to them
  > while you are not in it, and they run out within about three days — open that profile to set its
  > reminders up again."

  — inside an amber block below a status card, and `outputs/` already holds `designer_v35_*_320_*`
  screenshots because this exact card has been walked at 320px before. The gate's own comment names
  *"52 of 68 descriptions cut off at 320px"* as what happens when this seat is skipped. **The suite
  runs at 390 only.** Nobody has looked at this sentence at 320.

  This is cheap to close: render the card at 320 / 360 / 390 in the `on`, `on-exact` and `empty`
  states — the suite's own Capacitor stub already reaches all three — and write the file.

---

# 5. THE VOICE — is each caregiver-facing string TRUE?

## The Settings scope sentence

> "This count is for Alex only. The other profile on this phone keeps the reminders it already had,
> but nothing adds to them while you are not in it, and they run out within about three days —
> open that profile to set its reminders up again."

**Checked clause by clause against the file, not against the changelog.**

* *"nothing adds to them while you are not in it"* — **TRUE.** There are exactly two
  `.schedule(` call sites in `index.html`: line 12095 (`sendNotif`, fires at `now + 300ms`, not a
  durable alarm) and line 12698, inside `syncNativeReminders`, whose plan is built from
  `ACTIVE_PROFILE_ID` alone (line 12667). Nothing anywhere re-arms an inactive profile.
* *"they run out within about three days"* — **TRUE, and it is the right shape.** `NOTIF_HORIZON_MS`
  is `72 * 3600 * 1000` (line 12365). An inactive profile's pending set was armed at its last sync,
  while it was active, and reaches at most 72 hours past that. **"Within" is an upper bound**, so the
  sentence cannot overstate coverage in any case, which is the safe direction for this one.
* *"This count is for…"* vs *"This is for…"* — the N1 fix works. The ternary matches the card's own
  state exactly, so the word "count" only appears where a count is on screen.

**One Voice note, not a blocker.** The in-app changelog says the other person's reminders *"run out
**after** about three days"* while the card says *"**within** about three days"*. "Within" is the
true one; "after" reads as a guarantee of three days' cover, and the real figure is *at most* three
and can be less if the profile was last synced earlier in the day. Same word in both places would
cost one character.

## The in-app CHANGELOG app-v85 entry

> **"Reminders for one person no longer wipe out another's"**
> *"If this phone has more than one person set up, every time you opened the ChemoWell app it quietly
> removed the reminders belonging to whoever you were not currently in. A dose could pass with
> nothing on screen and nothing in your hand buzzing."*
> *"That is fixed — each person's reminders are now left alone. Reminders are still only set up for
> the person you are in, and another person's run out after about three days, so open their profile
> to set theirs up again."*
> *"Settings now tells you which person the reminder count is about, so a tick on that screen no
> longer looks like it covers everyone on the phone."*

**True.** The trigger is the universal one and correctly scoped to the phone app. It promises
nothing it has not done. It does not name a version, a file or a function. No number is asserted
about the patient. Nothing in it describes a harm that never shipped — the clause the second pass
refused is gone. `test/v84-whatsnew.mjs` 96/96 at HEAD.

---

# 6. THE SUITE — re-run, and two mutants it misses

`node test/v85-profile-reminders.mjs` at `f962e01`, my own run:

```
29 checks: 29 passed, 0 failed
```

Your claim of 29/29 is exact. Section 6 is genuinely behavioural — it asserts `state=on` before it
reads a word, and the card text it prints back proves the fixture reached the state a real phone
shows. The `type: 'win'` comment is the most useful thing in the file.

**I found two mutants it does not catch.** Both were run against a mutated copy served from the
scratchpad on a separate port with `FALSIFY_BASE`; `index.html` in the repo was never touched.

| Mutant | Result |
|---|---|
| **M10 — revert the N1 fix**: `const lead = 'This count is for ' + myName + ' only. ';` (unconditional) | **29/29 PASS** |
| **M11 — wrong expiry figure**: "run out within about **thirty** days", both branches | **29/29 PASS** |

**M10 is the one that matters, and it is specific to this release.** Section 6 now asserts
`state === 'on'`, so the `empty` branch of the ternary is never rendered by any check. The N1 fix —
**the only code change in the post-audit commit** — has zero coverage. Deleting it scores a clean
pass. One extra fixture (drop the medication, or return `getPending: []`) reaches `empty` and closes
it; the suite used to land there by accident before it was fixed to land in `on`, so the machinery
already exists.

**M11 is a smaller shape but the same class the Voice exists for.** The check reads
`/run out|three days/i` — an alternation, so *"run out"* alone satisfies it and the number is free.
"Thirty days" is a false coverage promise to a caregiver about a medication reminder; a check named
*"it says the other profile's reminders run out"* passes on it. `/run out within about three days/i`
bites.

## M5 and M7 — should either have blocked? **No, and I agree with the second delta.**

* **M5 (the plural branch, 3+ profiles).** Correct in the shipped file — the second delta rendered
  it. Reachable on a paid tier (`tierLimit`, line 172: `pro ? Infinity : plus ? 3 : 1`), so it is
  not a dead branch, and it carries both of the claims the singular branch has explicit checks
  against. **Recommend before stage 2**, because stage 2 edits this exact sentence and will be doing
  so with the plural half unguarded. Not a block on stage 1: the branch is right today.
* **M7 (`deleteProfile` refusing to delete the ACTIVE profile).** Pre-existing code, unchanged by
  this release, correct today. One line to check. **Recommend, do not block** — blocking a release
  on coverage for code it did not touch is how a gate becomes something people route around.

The deferral of both is stated out loud in the audit record, which is what Rule 5.5 asks for. I am
satisfied it is an exemption and not an oversight.

---

# 7. RULE 0 — clean, checked on the DIFF

`git diff b9fa171 HEAD -- index.html sw.js`, added lines only (179 of them):

* **No patient name.** Zero hits for the name.
* **No gendered pronoun**, including in comments. Zero hits for `she|her|hers|he|him|his` as words.
  *"open that profile to set its reminders up again"* and *"whoever you were not currently in"* are
  correctly neutral.
* **No dose, ceiling or schedule** from any care plan. Zero `NNmg` / `ceilingMg`.
* **No new behaviour keyed to a medication id.** Zero hits for any of the thirteen legacy ids.
  `notifCancelCandidates` branches on `extra.profileId` and nothing else.
* `test/v75-no-other-patient.mjs` — **27/27**, my own run. The three ratchet numbers read 0/0/0
  against ceilings pinned at 0/0/0.

The suite fixture uses `sex: 'female'` in `prefs`, which is a pre-existing app field written by the
setup screen, not a hardcoded care plan, and it is in a test file rather than the app. Not a finding.

---

# 8. RELEASE MECHANICS

| Check | Result |
|---|---|
| `APP_VERSION` | `app-v85` (index.html:9052) |
| `sw.js` CACHE | `chemowell-app-v85-1` (sw.js:1) — moved with it |
| in-app changelog | `CHANGELOG[0].v === 'app-v85'`, dated Sep 17, 2026 |
| README version-history row | present, one row |
| `PUBLISHED.json` | `app-v84` / `chemowell-app-v84-14` at `55e0bd5` — so this is genuinely unshipped |
| working tree | **clean** |
| pushed | **yes** — `origin/claude/caretracker-team-review-i83ik2` is at `f962e01`, zero ahead/behind |
| `test/v85-profile-reminders.mjs` | 29/29 |
| `test/v84-whatsnew.mjs` | 96/96 |
| `test/v75-no-other-patient.mjs` | 27/27 |
| `./verify-rebuild.sh` | exit 0, 17/17, boot half reaches `BOOTS` |
| `./release_check.sh` | **exit 1** |

---

# 9. `./verify-rebuild.sh` — green, and green about the wrong release. It should NOT block.

Its own output says so plainly: `→ patch script targets: const APP_VERSION = 'app-v84' (commit
d38e36a)`. There is no `harness-v85-*.py` for this release — `harness-v85-temperature-report.py` is
named for a different, unrelated feature. **So nothing verifies that app-v85 is reproducible from a
base plus a patch, while a gate exits 0 beside it.**

**My judgement: it does not block, for a reason I want on the record so it is not re-litigated.**
The *"every release reproducible from base + patches in `harness/`"* rule is **care-tracker's Rule 0**,
not this repo's. `chemowell-app-beta/CLAUDE.md` carries nine hard rules and reproducibility is not
among them; `release_check.sh`, which is this repo's own mechanical conscience, does not ask for a
per-release harness either. Holding a patient-facing reminder fix on a rule imported from the
sibling repo would be inventing a gate at the last desk before the owner.

**What I will not do is let it read as green.** `verify-rebuild.sh` now pins both sides to immutable
commits, so it will print 17/17 for ever and can only fail if somebody edits a historical script.
The second delta said the same thing. This release's own reproducibility is **UNVERIFIED**, and that
sentence belongs in the release message to Aaron rather than in a backlog file nobody reads.

---

# 10. SCOPE — does this match what Aaron asked for?

**Yes, and stage 2 is excluded cleanly rather than half-built.** I checked for leftovers rather than
taking the claim.

What he reported on 2026-09-17: no reminder for his own medicine under a second profile, and Home
showing *"3 missed doses from previous days"*. What this release does: stops the destruction, disarms
a deleted profile's reminders, and makes Settings stop implying coverage it does not have. That is
the three-part answer to the three-part complaint.

**Stage 2 is genuinely absent.** There is no per-profile notification label anywhere in the app, no
`visibility` channel setting, and no scheduling path for a non-active profile — the two
`.schedule(` sites are the immediate one and the active-profile plan. Nothing is stubbed, dark or
half-wired. His decisions on stage 2 are now recorded in the Developer brief, with the two items
that are still genuinely open (the wrong-patient notification tap; whether iOS lands first) listed
beside them rather than quietly resolved.

**One scope item nobody audited.** `release_check.sh` lists `.github/workflows/android-build.yml`
among the rule-5 changes riding in this release. It came from `58ec27d` (*"pin the SDK packages"*),
which sits after the app-v84 baseline and before the v85 work started. **No app-v85 audit examined
it** — the one mention in `AUDIT-app-v85.md` cites the file only as evidence that the app builds
Android. It cannot affect a phone that already has the app, and I am not blocking on it, but it is
unshipped CI work being carried by this release's sign-off and nobody has read it.

---

# WHAT I DID NOT CHECK — said plainly

* **Anything on a real device.** No Android build, no APK, no phone. Every "native" result here and
  in all three audits is a Capacitor stub in headless Chromium.
* **iOS at all.** Not built, and the 64-pending-request cap versus `NOTIF_MAX_PENDING = 128` is a
  live stage-2 question that nobody has answered.
* **The erase-and-reload and undo-restore browser probes (B1/B2).** I read the guard, confirmed the
  code is byte-identical to the commit the delta pass drove those probes against, and took the
  measurement from that pass. I did not re-run them.
* **The full `./run-all-tests.sh` board.** I ran three suites plus the two gates. The last full board
  on record is the delta pass's `PASS 46 / FAIL 10 / COULD-NOT-START 1`, with all ten measured as
  pre-existing at the base commit. I did not re-measure that and I am not asserting it.
* **The plural (3-profile) rendering.** Read in source, not rendered by me.
* **Screenshots at any width.** That is the Designer seat, and it is exactly what is missing —
  I flagged it rather than doing it, because this desk does not fix what it finds.
* **`sync-backend/`, `package.json`, `capacitor.config.ts`** — untouched by this release; not read.
* **The android-build.yml change** — named above, not read.

---

# WHAT WOULD MAKE THIS SHIP

In the order I would do it. None of it is a code fix to the reminder logic — that part is done.

1. **A delta audit pass over `f962e01`.** It is one diff and two exit codes. The N1 ternary is the
   only code in it.
2. **Fix the README `30/30` → `29/29`.**
3. **Run the Designer seat** — the card at 320 / 360 / 390 in `on`, `on-exact` and `empty` — and
   write `outputs/DESIGN-app-v85.md`.
4. **Make the Enhancer pass visible to the gate**: `outputs/ENHANCER-app-v85.md`.
5. **Close M10** with an `empty`-state fixture, and tighten M11's regex to the whole clause.
   (I would take these in the same pass as 1, because M10 is the coverage hole the delta audit
   will otherwise be asked to stand in for.)
6. **One word**: make the changelog say *"within"* about three days, matching the card.
7. Re-run `./release_check.sh` to exit 0, then a fresh PM sign-off against that commit.

Items 1–4 are the gate. Items 5–6 are mine as a recommendation and I would not hold the release for
6 alone.

**And for the release message to Aaron, whichever way this goes:** the phone side of this is
verified in a stub, not on a phone. He is the only device tester this project has, and the one thing
worth asking him to do is open the app under one profile and confirm the other profile's reminders
are still there the next morning.
