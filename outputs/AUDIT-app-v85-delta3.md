AUDITED-COMMIT: f4b8e98
VERDICT: DO NOT SHIP

Zero Day Auditor, app-v85 third delta. Range `git diff cbc0520 f4b8e98`.

**Note on the sha.** The brief named `1fd0d4f`; that commit does not exist in this repo and the
correction arrived mid-pass. Everything below was measured at **f4b8e98**, which is HEAD.

---

# HEADLINE

**Two blockers, and the first one is in the branch that has never been asserted.**

1. **The plural sentence tells a three-profile caregiver to "open that profile" when there are two.**
   Rendered at 2, 3 and 4 profiles. The tail was factored out of the ternary and is singular, so the
   plural branch reads *"The other 2 profiles … keep the reminders **they** already had … while you
   are not in **them** … — open **that** profile to set **its** reminders up again."* This is M5's
   branch. **My last answer — "correct but untested, do not block" — no longer holds: it is not
   correct.** Paid tier only (Plus 3, Pro unlimited), which is the tier this whole release exists to
   protect.
2. **`on-exact` is now covered by nothing, and the README says it is covered behaviourally.**
   Deleting `profileScopeLine()` from the `on-exact` branch alone scores **33/33**. The structural
   stand-in that used to cover it was deleted in the same commit that made `on` behavioural, so that
   state went from *structurally covered* to *not covered at all* — and the row asserts the
   opposite. Third coverage claim in this release that does not hold.

Everything else checks out, including the workflow rider, which is verified green.

---

# E1 — THE PLURAL TAIL. BLOCKER.

Rendered against the shipped file, two / three / four profiles:

```
others=1  This count is for Alex only. The other profile on this phone keeps the reminders it
          already had, but nothing adds to them while you are not in it, and they run out within
          about three days — open that profile to set its reminders up again.

others=2  This count is for Alex only. The other 2 profiles on this phone keep the reminders they
          already had, but nothing adds to those while you are not in them, and they run out within
          about three days — open that profile to set its reminders up again.

others=3  … The other 3 profiles … while you are not in them … — open that profile to set its
          reminders up again.
```

The branch bodies agree in number; **the shared tail does not**, because it sits outside the
ternary:

```js
lead + (others.length === 1 ? '…in it' : '…in them') + ' — open that profile to set its reminders up again.'
```

This is not only a grammar slip. It is **the only instruction in the sentence**, and on a phone with
two other profiles it names one and does not say which. The honest answer is "each of them". Rule
2.7's second question — would a tired non-technical person understand this at 2am — is answered no,
and this is a medication app's guidance about why reminders stopped.

An earlier round fixed a singular/plural disagreement *inside* the branches (*"they … the one you
are in"*). The tail was never made number-aware, and this commit edited both branch bodies —
inserting the expiry clause — without touching it.

**Fix**: move the tail inside the ternary. *"— open that profile to set its reminders up again."* /
*"— open each profile to set its reminders up again."*

**And it settles M5.** The Designer rendered the plural branch for the first time this round and
this still got through, because the Designer reads layout and the suite reads only the singular
branch. A branch that is rendered but not asserted is a branch nobody checks the words of.

---

# E2 — `on-exact` IS UNCOVERED, AND THE ROW SAYS IT IS COVERED. BLOCKER.

**Measured.** Three mutants against the current suite:

| Mutant | Result |
|---|---|
| **M12** — revert the empty-state `lead` ternary to the constant | **31/33 — caught.** 6b bites. |
| **M13** — "three days" → "thirty days" | **32/33 — caught.** The M11 alternation fix bites. |
| **M16** — delete `profileScopeLine()` from the **`on-exact` branch only** | **33/33 — SURVIVES.** |

M16 confirmed by rendering: under the mutant, both `on-exact` fixtures (with and without a
non-empty plan) show **no scope line at all**, while `on` and `empty` are untouched.

The README row says:

> *"`on` and `on-exact` are covered **behaviourally**, on a rendered card in the state a real phone
> shows."*

Section 6 asserts `cardState === 'on'`. 6b asserts the `empty` state. **Nothing renders `on-exact`.**
Deleting the structural stand-in was right in spirit — I argued for behavioural coverage — but it
was a straight trade, not an addition: `on` gained it and `on-exact` lost what it had.

**This is not a rare state.** `on-exact` is what the card shows whenever exact alarms are not
granted, and the app carries `changeExactNotificationSetting()` plus a full help panel devoted to
getting that permission — which exists because denied is where Android users start.

**Fix**: a fourth page in section 6 with the same `type:'win'` fixture and
`checkExactNotificationSetting: async () => ({ exact_alarm: 'denied' })`, asserting the state is
`on-exact` and the line renders. I drove exactly that against the shipped file: state `on-exact`,
count line present, scope line present. Six lines.

---

# E3 — THE SUITE COUNT IS WRONG FOR THE FIFTH TIME. Must fix with the above.

The row says `test/v85-profile-reminders.mjs` **29/29**. The suite reports **33/33** on my run, and
has 33 `t(` calls. The sequence for this one number is now: 30/30 → PM caught it → corrected to
29/29 → stale in the same commit, because section 6b added four checks alongside the correction.

Not a blocker by itself. But it is the same sentence going wrong five times, which argues the number
should not be typed at all — have the release step read it from the suite's own last line, the way
`verify-rebuild.sh` now prints its target version instead of asserting it.

---

# THE PM'S JUDGEMENT ON THE `lead` TERNARY — verified, and the reason is wrong

The PM judged the unreviewed line correct "because the ternary restates `nativeNotifStatus()`'s own
`empty` test". **The conclusion holds; that reason does not.**

```js
if (notifExactState === 'denied') return 'on-exact';   // returns BEFORE the count is consulted
if (notifScheduledCount === 0)    return 'empty';
```

`on-exact` is reached without ever testing the count, and it renders `countLine()` unconditionally.
So the two can disagree, and they do. Measured, four states:

```
A  exact granted, win-med   -> on        count shown "3"   lead "This count is for Alex only."
B  exact denied,  win-med   -> on-exact  count shown "3"   lead "This count is for Alex only."
C  exact granted, no meds   -> empty     no count line     lead "This is for Alex only."
D  exact denied,  no meds   -> on-exact  count shown "0"   lead "This is for Alex only."   <-- disagree
```

In **D** the card reads *"✓ Notifications are on · **0 reminders scheduled over the next 3 days.** ·
**This is for Alex only.**"* — a count is on screen and the lead uses the no-count wording. The
ternary keys on the count variable; the card's choice of count-line-versus-empty-line keys on the
*status*.

**Not a blocker**: "This is for Alex only" under "0 reminders" is awkward, not false. But the PM's
"correct because it restates the empty test" is not the reason it is safe, and D is a state no check
renders — which is E2 again from the other side. If the ternary is ever meant to track what the card
shows, the condition is `status !== 'empty'`, not `notifScheduledCount > 0`.

*Enhancer note, pre-existing*: a green *"✓ Notifications are on"* directly above *"0 reminders
scheduled over the next 3 days"* is its own small contradiction. Out of scope here.

---

# THE ANDROID WORKFLOW RIDER — READ, AND IT IS SOUND. VERIFIED GREEN.

`.github/workflows/android-build.yml` at `58ec27d` adds twelve lines: `packages: 'platform-tools'`
on `android-actions/setup-android@v3`, plus the comment explaining it.

* **The diagnosis matches the evidence.** With no `packages:` input the action installs its default
  set, which includes the retired `tools` SDK package; `sdkmanager` then exits 1.
* **Confirmed against the run history, not the commit message.** Run **85** (`55e0bd5`, immediately
  before the pin): **failure**, 23:49:21 → 23:49:44 — twenty-three seconds, consistent with dying in
  SDK setup before `npm ci`. Run **86** (`58ec27d`, the pin): **success**, 23:53:27 → 23:58:55 —
  five and a half minutes, i.e. all the way through `npx cap add android`, `cap sync` and
  `./gradlew assembleDebug`. Runs 80–84: success.
* **The risk I went looking for did not materialise.** Pinning to `platform-tools` alone leaves AGP
  to download build-tools and the platform during `assembleDebug`, which needs SDK licences
  accepted; the action accepts licences independently of the `packages` list. Run 86 completing
  proves it empirically rather than by reading.
* **It cannot affect app behaviour.** No path in it touches `index.html` or anything the web build
  serves. The `emulator-smoke` job uses its own SDK provisioning and is unaffected.
* **The commit's own promise was kept.** It said the verification that counts is the job going green
  and that it was being done next. It was, four minutes later.

**Nothing to fix. It should stop being carried as unaudited.** One thing worth a `BACKLOG.md` line,
pre-existing and unrelated: the APK is published to a Release tagged `app-v14-native-test` and named
*"ChemoWell native test build (app-v14)"*. That is the page Aaron downloads from, and it names a
version seventy-one releases stale.

---

# THE REST OF THE README ROW, CLAIM BY CLAIM

**The three I raised are properly corrected.** *"INTRODUCED a worse bug — caught on the branch by
the independent audit, never on a phone (`PUBLISHED.json` has the live build as app-v84)"* is now
true and stronger than the original. The impossibility claim is reversed and the actual cause
(`normalizeMedication` deriving `alerts` from `type === 'win'`) is written down. The stage-2 decision
now cites a record that exists.

**On that record** — `outputs/DEVELOPER-multiprofile-notifications.md`'s new section was written in
the same commit as the row that cites it, and it says so in its own words: *"nothing in the repo
recorded it — the app-v85 README row asserted the decision with no source, and an independent audit
correctly refused to take it."* That is the honest way to back-fill, and I accept it. It rests on
recall rather than a contemporaneous artefact, which is worth knowing but is not a defect.

**Two remaining imprecisions:**

* *"It now says they survive but stop being kept up to date."* Stale — the sentence now says
  *"nothing adds to them … and they run out within about three days."* The row describes the
  previous wording.
* *"Falsified against nine mutants, every one behavioural."* Accurate for the mutants as run, but
  *"the scope line deleted from the two states a phone actually shows"* dies only through its `on`
  half (E2). And the list omits the mutant the PM found scoring a clean 29/29 — reverting the `lead`
  ternary — which belongs in it, because a mutant that survived an earlier version is the most
  informative kind.

---

# WHAT I CHECKED AND FOUND GOOD

* **Section 6 is genuinely behavioural now** and asserts the state it reaches
  (`cardState === 'on'`), rather than landing in `empty` and hoping. The structural stand-in is gone
  rather than kept alongside, which is the right instinct — it just needed a fourth fixture with it.
* **6b renders the `empty` state and reads the sentence off it.** The comment about an explicit empty
  medication list — *"omitting the key is not enough"* — is a real trap recorded properly.
* **M11's fix is right.** `/run out|three days/i` let the number vary; the whole-clause match
  (`/run out within about three days/i`) caught "thirty days" at 32/33 in my run.
* **N1 and N2 are genuinely fixed this time.** The `empty` lead reads *"This is for Alex only."* and
  both branches carry the expiry clause. I re-rendered both rather than reading the diff.
* **The changelog reads true as the Voice.** *"every time you opened the ChemoWell app"* names the
  universal trigger and the app rather than the website; *"another person's run out within about
  three days"* is the missing fact from two passes ago, now stated. Rule 0 clean — no name, no
  gendered pronoun, no dose, ceiling or schedule, no version numbers or file names.
* **Twelve Designer screenshots present** across `on` / `on-exact` / `empty` / three-profile at
  320 / 360 / 390, and `DESIGN-app-v85.md` records that its own measurement script was wrong first
  (a spread overwrote the viewport width) — a correction that belongs in the record and is in it.
* **`ENHANCER-app-v85.md`** is now where the gate's glob can see it.
* **`./release_check.sh` exit 1**, for the right reason: *"a chain report refuses this release, and
  nothing supersedes it."* That is the app-v68 scar working.

---

# M7 — STILL NOT A BLOCKER

`deleteProfile`'s refusal to delete the ACTIVE profile is pre-existing, correct today, and untested.
One line of coverage (`deleteProfile(activeId)`, assert it is still there). Unchanged from my last
answer, and unlike M5 nothing has made it wrong.

---

# TO SHIP

1. Move the tail inside the ternary so the plural branch says *"open each profile"* (E1).
2. Add the `on-exact` fixture to section 6 — six lines, and M16 must then fail (E2).
3. Correct the suite count in the README row, and consider reading it from the suite rather than
   typing it (E3).
4. The two remaining README imprecisions above.
5. PM sign-off.

The re-audit is one render of the plural branch, one mutant run, and a grep.
