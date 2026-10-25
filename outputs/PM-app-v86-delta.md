AUDITED-COMMIT: 86c1acc
VERDICT: SHIP

# PM sign-off, delta pass — ChemoWell app-v86 (`86c1acc`, branch `claude/caretracker-team-review-i83ik2`)

**The one thing I refused this release for is fixed, and it was fixed with a real pass rather than a
formality.** The Enhancer seat ran on five screens, worked five of Rule 2.6's six checklist items,
and produced five sized proposals — three of which I had not found myself. I verified its two
headline claims in the code rather than taking them: the banner really does offer four options
against five labels, and a past row really does carry one control and that control is `Remove`.
Both are true, and the "pre-existing" qualifier on the banner is true at `87d1784` as well.

**No app code moved.** `git diff 3c167cb 86c1acc -- index.html sw.js` is empty and the md5s are
identical at both commits and in the working tree. Nothing was quietly built from the Enhancer's
list — that is not a claim I am accepting, it is arithmetic on a byte comparison.

**The gate is clean.** The Enhancer refusal is gone from `release_check.sh`'s output entirely. The
only refusal remaining is my own previous DO NOT SHIP at `3c167cb`, which this report answers at a
strictly later commit, which is exactly the mechanism the gate requires. I proved that clears it by
running the gate in a throwaway clone with this report's header in place: `✅ Release check passed`,
exit 0.

**Three findings, none blocking, all in records files.** The Enhancer's empty-states paragraph is
factually wrong about which screen element it read; `REQUESTS.md`'s new section is filed under the
heading `## Completed` although eight of its items are open; and E-5 names In-Patient as the sibling
screen that got it right when Symptoms is the better example. Sections 5–7 below. Each costs one
edit and none of them touches the app.

---

## 1. The claim my own remedy rested on: did the shipping artifact move?

    git diff --stat 3c167cb 86c1acc
      README.md                   |   2 +-
      REQUESTS.md                 |  28 +++
      outputs/ENHANCER-app-v86.md |  86 ++++++++
      outputs/PM-app-v86.md       | 470 ++++++++++++++++++++++++++++++++++++++++++++

    git diff 3c167cb 86c1acc -- index.html sw.js      ->  empty

    md5 index.html   3c167cb / 86c1acc / working tree : 1d5f3004caac466e904b65f5d06ae7c7  (all three)
    md5 sw.js        3c167cb / 86c1acc / working tree : 3a60dd3a758f2b3ac8f5090971ee8e3f  (all three)

That value for `index.html` is the same one my previous report recorded at `4d6db99` — the commit
the Zero Day Auditor cleared in `AUDIT-app-v86-delta3.md`. So the chain is unbroken: the bytes that
would ship are the bytes that were audited, two commits ago and still.

No other Rule 5 path moved either. Nothing under `.github/workflows/`, `sync-backend/`,
`package.json`, `package-lock.json` or `capacitor.config.ts` appears in the diff stat at all.

### What carries forward, and what I therefore did not redo

Because `index.html` and `sw.js` are byte-identical, **sections 2 through 8 of `PM-app-v86.md`
stand unchanged and are not re-derived here**:

| Section | What it covered | Status |
|---|---|---|
| 2 | The audit trail reconciles; six of my own mutants, all red | carried forward |
| 3 | The five deliverables are genuinely done; no scope drift; backup gating not implemented | carried forward |
| 4 | Twelve copy strings read as they render; the changelog is true | carried forward |
| 5 | `APP_VERSION` / `sw.js` CACHE move together; no cache reuse; `PUBLISHED.json` consistent | carried forward |
| 6 | Rule 0 on the `index.html` diff | carried forward |
| 8 | The three pre-existing reds, verified on both builds | carried forward |

Section 7 (the gate's raw output) is **superseded** by section 3 below. Section 1 (the missing
Enhancer) is **closed** by section 4.

I did re-run both suites anyway, because a records-only commit claiming to move nothing is exactly
the claim worth checking cheaply.

---

## 2. The two suites, re-run against the real tree

`python3 -m http.server 8899 --directory /home/user/chemowell-app-beta`, then each suite with the
proxy variables unset. Server killed afterwards.

    node test/v86-logging-and-labels.mjs   ->  86 checks: 86 passed, 0 failed
    node test/v75-no-other-patient.mjs     ->  27/27 checks passed

The v86 run's own section 19 is the useful one: *"the README figure for this suite is this suite's
figure | README says 86/86, this run counts 86"* — the suite checks that the number printed in the
record is the number it actually produced, so the figure in the changelog cannot drift away from
reality. The v75 ratchet reports `0/0/0 found, pinned at 0/0/0` on all three counters.

Both match my previous pass exactly. The records-only commit moved nothing.

---

## 3. `./release_check.sh` — raw output

Run from `/home/user/chemowell-app-beta` at `86c1acc`, working tree clean. **Exit code 1.**

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.xyBSTGzGZ1
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v85 (chemowell-app-v85-1) at c93a072
   5 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
   These say DO NOT SHIP:
     outputs/PM-app-v86.md — examined 3c167cb
   A refusal is cleared by re-running that stage against a LATER commit and it saying
   SHIP — not by adding another file beside it.
EXIT=1
```

**The Enhancer refusal is gone.** Compare against the same gate at `3c167cb`, which printed two
refusals — `missing: an outputs/ENHANCER*app-v86*.md pass` and then the PM one. Only the PM question
remains, and it is the question this report exists to answer.

### Proving this report clears it, rather than asserting it

The gate stops at the first refusal, so I could not see the rest of its output from inside the repo
under review. I cloned the repo into my session scratchpad at `86c1acc`, put a clearly-labelled
placeholder carrying this report's exact header into **that clone only**, and ran the gate there.
Nothing in the repo under review was touched.

The first probe **failed**, and that is worth recording, because it shows the gate is not simply
counting filenames:

```
❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
   These say DO NOT SHIP:
     outputs/PM-app-v86.md — examined 3c167cb
```

My placeholder was four lines. `release_check.sh` applies a thinness floor to any report offered as
superseding — under 2000 bytes or under 25 lines and it does not count — on the reasoning that *"a
stage that ran leaves more than a header."* A two-line file cannot cancel a refusal. Good.

Re-run with a full-length placeholder (4910 bytes, 45 lines):

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.cfHY4yOym7
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v85 (chemowell-app-v85-1) at c93a072
   5 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v86-delta.md — examined 0f73911; changed since: index.html 
     outputs/AUDIT-app-v86-delta2.md — says DO NOT SHIP
     outputs/AUDIT-app-v86.md — says DO NOT SHIP
     outputs/PM-app-v86.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v86, and current against the working tree:
     outputs/AUDIT-app-v86-delta3.md
     outputs/PM-app-v86-delta.md
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  No-other-patient check: clean.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
EXIT=0
```

### And then confirmed on the real repository

After writing this file, I ran the gate once more in `/home/user/chemowell-app-beta` itself, with
this report present and uncommitted. **Exit code 0.** Raw output:

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.BokxdephF5
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v85 (chemowell-app-v85-1) at c93a072
   5 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v86-delta.md — examined 0f73911; changed since: index.html 
     outputs/AUDIT-app-v86-delta2.md — says DO NOT SHIP
     outputs/AUDIT-app-v86.md — says DO NOT SHIP
     outputs/PM-app-v86.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v86, and current against the working tree:
     outputs/AUDIT-app-v86-delta3.md
     outputs/PM-app-v86-delta.md
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  No-other-patient check: clean.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
EXIT=0
```

This is the gate's verdict on the actual tree, not on a clone. **One caveat to state plainly: this
report is not yet committed.** The gate reads `outputs/` from disk, so it passes now; the commit
that carries this file must be made before the push, or the pushed tree will not contain the sign-off
that cleared it.

Every refusal is accounted for and named as superseded. `AUDIT-app-v86-delta3.md` is the current
clearing audit. The stale note on `AUDIT-app-v86-delta.md` is correct and expected — it examined
`0f73911` and `index.html` moved after it.

**No refusal other than my own previous one appeared at any point.** That was the condition set for
this pass and it is met.

---

## 4. The Enhancer pass, read adversarially

The question is whether this is a seat that ran or a file written to clear a gate. **It ran.**

### It works the checklist, and it reaches past what I had already found

| Checklist item (Rule 2.6) | Worked? | Where |
|---|---|---|
| 1. Add / edit / remove symmetry | yes | E-1, E-5 |
| 2. Read the empty states out loud | attempted, and got it wrong — section 5 | "Empty states" |
| 3. Correctable, or only delete-and-redo? | yes, quoted and applied | E-1 |
| 4. Dead ends — information with no action | **not addressed** | — |
| 5. Where a sibling screen got it right | yes, though it names the weaker sibling — section 7 | E-5 |
| 6. Is what is already there worth being there? | yes, including the Rule 2.7 averages trap | "What is already there" |

Five of six, with the sixth — item 6 — handled properly rather than skipped: it names the state line
and the caption, says why each earns its place, and explicitly checks that no figure on these screens
is an average of events that accumulate over time. That is the trap that cost this project a release,
and the pass goes looking for it on a screen where it does not exist and says so. A formality does
not do that.

**Three of its five proposals are new to the record.** My previous report produced E-1 and E-2.
E-3, E-4 and E-5 are the Enhancer's own. It is not a restatement of my findings with a header on it.

It is also honest in the one place a formality would not be: it opens by saying it ran late, that
the defect Aaron reported is its own flagship checklist item, and that the seat most likely to have
predicted his bug is the one that was skipped. Rule 2.6 permits an explicit *"nothing this time"*;
this pass could have taken that exit and did not.

### E-2 verified in the code, not read off the page

    index.html:3489   BOWEL_MOVEMENT_LABELS =
      { normal:'Normal', very_little:'Very little', none:'None', loose:'Loose', diarrhea:'Diarrhea' }
                                                                 ^^^^^ five values

    index.html:6006-6010   the bowel-issue banner's select
      ''            'Update status if back to normal...'   <- placeholder, writes nothing
      'normal'      'Normal'
      'very_little' 'Very little'
      'none'        'None'
      'diarrhea'    'Diarrhea'
                                                                 four real options, no `loose`

**Five labels, four options. The claim is exactly right.** And the escape route the pass describes
is real: `renderDailyValueLogger` (index.html:11721) renders `Object.keys(opts.labels)`, so the
Reports screen offers all five including Loose. A caregiver whose answer is Loose must leave the
banner and go to Reports, and nothing on the banner says so.

**The "pre-existing" qualifier is true.** At `87d1784` (app-v85) the labels constant is identical
and the banner's select carries the same four options at lines 5920-5924. This release did not cause
it.

### E-1 verified in the code

Both report screens build their history rows the same way, and the row's control list is one item
long:

    index.html:11789-11795  (bowel)    ...date + label..., removeBtn(e)
    renderAppetite, same shape         ...date + label..., removeBtn(e)

`removeBtn(e)` and nothing else. There is no edit, no re-pick, no correction affordance on any row
that is not today's. The logger above handles today; every earlier day is delete-or-nothing. **E-1
is correct**, and it is checklist item 3 happening on the screens this release rebuilt.

### Nothing was built from the list

Confirmed by byte comparison rather than by reading the diff: `index.html` and `sw.js` are identical
at `3c167cb` and `86c1acc`. No proposal could have been implemented. The pass's claim that it is a
list for Aaron and not a widening of the release is mechanically true.

---

## 5. FINDING 1 — the Enhancer's empty-states paragraph is wrong about what it read

The pass says:

> Both report screens' empty states now describe something reachable from the screen the reader is
> on. That was the self-reported bug in the old copy — *"logged from Home"* on a screen with no way
> to get there — and it is gone.

**Two things in that are not true.**

1. **The empty states did not change in this release.** They read
   `'No bowel movement entries logged yet.'` and `'No appetite entries logged yet.'` — and they read
   exactly that at `87d1784` too (lines 11548 and 11568 there, 11770 and 11797 now). Byte-identical.
   Nothing about them is "now" anything.
2. **"logged from Home" was never in an empty state.** It was in `reportDescriptor`, the description
   on the Reports menu card: `'Review bowel movement history logged from Home.'` at `87d1784:11313`,
   now `'Log today's bowel movement, and review the history.'`. That string *is* the self-reported
   bug and this release *did* fix it — on a different surface from the one the pass credits.

The conclusion the paragraph reaches — nothing to propose about the empty states — is still the
right one. An empty state reading *"No bowel movement entries logged yet."* directly beneath a
logger card is fine: the screen as a whole is complete, which is the question the seat is asking.
**But a pass whose job is to read the strings on a screen has misattributed which element carried
which string**, and that is worth correcting rather than waving through, because the next reader
will take it as a record of what was read.

**Remedy: rewrite those four lines to say what is actually true** — the empty states are unchanged
and need nothing, and the false pointer that was fixed lived in the Reports card description.
One edit, no code, and it does not hold the release.

---

## 6. FINDING 2 — `REQUESTS.md` is repaired in substance and misfiled in structure

### The substance is right. All twelve are there, each with a true status.

The new section logs thirteen bullets: Aaron's twelve plus one explicitly marked
*"(found alongside)"* — the `APAP` suffix, which the team found and he did not report. Checked
against the README row's own record:

| Aaron's item | In `REQUESTS.md` | Status claimed | True? |
|---|---|---|---|
| Daily check-in card never appears for bowel/appetite | yes | `[x]` app-v86 | yes |
| History summary calls everything a dose | yes | `[x]` app-v86 | yes |
| Account promises rename/delete that do not exist | yes | `[x]` app-v86 | yes |
| Snooze gives no indication when it returns | yes | `[x]` app-v86 | yes |
| Backup works on Free although Plus advertises it | yes | `[ ]` decided, queued | yes — not implemented |
| Chart x-axes repeat dates and run into the future | yes | `[ ]` | yes |
| Treatment date does not reach the Calendar | yes | `[ ]` needs a decision | yes |
| In-Patient "Still ongoing" checkbox | yes | `[ ]` | yes |
| Early-dose warning is soft, not a hard block | yes | `[ ]` needs his decision | yes |
| Fever temperature gives no warning at log time | yes | `[ ]` needs his decision | yes |
| Symptoms log has no severity scale | yes | `[ ]` | yes |
| Polish, four items | yes | `[ ]`, all four named | yes |

Twelve for twelve. Four closed, eight open — which is the eight the README now names.

**The backup decision is stated as he made it**, twice and consistently: *"saving stays free,
restore goes to Plus"* in the section header and *"saving free, restore Plus"* on the item. The
README cell says the same and adds his reason — *"so nobody loses data for not paying."* It is
recorded as a decision and marked queued, and section 3 of my previous report confirmed by reading
all four `getLicense().tier` call sites that it is **not** implemented. Correct on every count.

It also carries the caveat that matters: *"Everything Aaron tested was in the web preview, so
phone-only behaviour on all of it is still unconfirmed on a real device."*

### The structure is wrong, and it is this project's own recurring failure one level down

The section was inserted at line 969 — **inside `## Completed`**, which begins at line 600. So eight
open items now live under a heading that says Completed, while `## Open` at line 187 does not mention
any of them. A future session reading `## Open` to find out what is outstanding will find none of
Aaron's eight.

It also splits a dated group: a `- [x] **This file** ... Added 2026-08-07` entry now dangles below
the October section, reading as though it belongs to it.

This is the "filed where the reader does not look" problem that Rule 0.8 and Rule 2.6 both exist
for, arriving in the file whose entire job is to prevent it. **Not blocking** — the items exist, are
findable by search, and the gate does not read this file — but it should be fixed before it is
relied on.

**Remedy: move the eight open items into `## Open`, leave the four closed ones in `## Completed`,
and put the dated narrative header above whichever list it introduces.** Restore the 2026-08-07
entry to its own group.

---

## 7. FINDING 3 — E-5 names the weaker sibling

E-5 argues from checklist item 5 — *where a sibling screen already got it right, why didn't this
one?* — and names **In-Patient** as having "log-now, log-for-another-day and edit."

In this app In-Patient has `Log In-Patient Start` / `Log In-Patient End` and a `+` for a past stay
(the help text: *"Use the '+' button to log a past stay you forgot to record at the time — both a
start and an end date"*). So log-now and log-for-another-day hold. **I could not find an edit
control on a past stay.**

**Symptoms is the example the argument wants** and it is on the same Reports screen: each row carries
an `Edit` button opening `openSymptomModal(e)` **and** `removeBtn(e)`, with a `+` to add. Add, edit
and remove, all three, on one screen — the exact symmetry E-1 and E-5 are asking for, already built,
a few hundred lines away in the same file.

The proposal is right and better supported than it argues. **Remedy: cite Symptoms.** One line.

---

## 8. Rule 0 on the delta

The delta touches no application code, so the four leak shapes can only appear in prose. I scanned
all 115 added lines across `README.md`, `REQUESTS.md` and `outputs/ENHANCER-app-v86.md`.

- **A patient's name.** Zero hits for `brandi`, any case.
- **Gendered pronouns.** Four hits, every one referring to **Aaron, the owner**: *"His diagnosis was
  right"* (README, introducing his own bug report), *"He also decided"* (REQUESTS, the backup call),
  *"the one seat most likely to have predicted his bug"* and *"if he wants them"* (Enhancer). Rule 0
  leak shape 2 is about the app assuming a **patient's** gender; none of these do, and none of them
  is in a file the app serves. The Enhancer uses **they/them** for the caregiver throughout —
  *"They must leave the banner and use the Reports screen"* — which is the required form.
- **A dose, ceiling or schedule from one care plan.** No `mg` figure, no `ceiling`, no interval.
- **Behaviour keyed to a medication id.** No occurrence of any of the thirteen legacy ids in the
  added lines. And `test/v75-no-other-patient.mjs` is 27/27 with all three ratchet counters at
  `0/0/0` against ceilings of `0/0/0`.

One spelling note, for the record and not as a finding: the Enhancer writes *"diarrhoea"* in its
prose while the app ships *"Diarrhea"*. British spelling in a doc, not in a string the app renders.
Worth a glance only because CLAUDE.md names that exact drift as a context mistake this project has
paid for.

**Rule 0: clean.**

---

## 9. What I did not do

- **I did not re-derive sections 2–8 of `PM-app-v86.md`.** The precondition they were made
  conditional on — `index.html` and `sw.js` unmoved — is satisfied by md5, so re-running six mutants
  against a byte-identical file would have proved only that md5 works.
- **I did not re-run the Designer's eighteen renders.** No screen changed.
- **I did not test on a real device.** There is none here.
- **I did not apply any of the three remedies above.** I share this working tree and must hand it
  back carrying only this file. All three are edits to records, none to the app.
- **I changed nothing in the repository except adding this file.** I mutated no source file in this
  pass, so there was nothing to restore. The gate probe ran in a throwaway clone in my session
  scratchpad. The local server I started for the suites is killed. `git status --porcelain` showed
  clean before this file was written.

---

## 10. The summary Aaron receives

> **ChemoWell app-v86 is finished, checked and signed off. It is ready to push.**
>
> **What is in it.** Four things from your own testing pass, plus one we found beside them.
> Bowel movement and appetite can now be logged from their own Reports screens at any hour — before,
> the only way in was the evening check-in card, so there was genuinely no door before 7pm. Picking a
> different answer replaces today's and keeps the old one in your records; the exported file and the
> printed report mark the replaced one as corrected, so a nurse reading two answers for one day can
> tell which stands. History no longer calls blood-pressure readings, symptoms and paracentesis
> "doses" — each is named for what it is. The daily milligram total no longer carries one
> painkiller's abbreviation over a different drug. You can rename the profile you are in, from
> Settings, which the Account screen had been promising since before the control existed — and a
> one-profile phone now shows a control at all. Snooze says it is fifteen minutes, on the button and
> again when you tap it.
>
> **What held it up, and what fixed it.** Last time I would not sign this off, for one reason: our
> own "does this screen actually make sense" review had never been run on the screens this release
> changed, and our release gate refuses a push without it. That review has now been done properly —
> it read five screens and came back with five suggestions, listed below. Nothing was built from it.
> It is a list for you to pick from. No app code has changed since I last checked it; I confirmed
> that by comparing the files byte for byte, not by reading a summary.
>
> **What is deliberately exempt.** Everything was checked in a desktop browser on a simulated phone
> screen. There is no iPhone here, so Safari rendering is untested, and nothing in this release has
> been on a real phone. That is a gap we cannot close from this side and I would rather name it than
> let it pass as checked.
>
> **What needs your phone.** Once it is live: log a bowel movement from the Reports screen in the
> morning, pick a different answer, and check the screen shows the new one. Open Settings and rename
> yourself. Tap Snooze on the Up Next card and read what it says.
>
> **The five suggestions, with sizes, for you to pick from.**
>
> | Suggestion | Size | My recommendation |
> |---|---|---|
> | Correct a past day instead of having to delete it and start over | small | do it |
> | The bowel-issue alert on Home cannot record "Loose" at all — it offers four of the five answers | small | do it |
> | On History, a corrected day shows two identical-looking rows under a count of one | small | cheap, worth it |
> | Rename only works on the profile you are in | medium | only if you want it |
> | Log bowel or appetite for a day that is not today | medium | only if you want it |
>
> The first two are the ones I would take, together, as one small release. The "Loose" one is a
> missing answer in a medical record, on the alert the app puts in front of you hardest — and it has
> been missing for a long time, not because of this release. Neither is dangerous. Both are your
> call.
>
> **What is still outstanding.** Your eight queued items, including your Monday decision that backup
> saving stays free and restore goes to Plus. I read the whole change to confirm none of them leaked
> in early. None did. All twelve items from Thursday are now written down in the request list with
> what happened to each, instead of only inside a changelog entry — that was the "filed where you do
> not read it" problem again and it is closed.
>
> **How much to trust this one, honestly.** Four rounds of independent review happened, and every
> single round found at least one check that *could not fail* — a test that would have gone on
> passing no matter how badly the thing it named was broken. That is unflattering about our tests and
> genuinely reassuring about this release: each round was aimed at the last round's blind spot and
> kept finding one. I broke six things in the code myself and watched the tests catch all six.
> **What it should make you cautious about is the number.** "86 checks passed" sounds like coverage
> and is not — five of those checks were, at one point, checks that could not have gone red. What
> makes this release trustworthy is not that 86 passed; it is that people kept trying to make them
> fail and the last round had to work hard to find anything.
