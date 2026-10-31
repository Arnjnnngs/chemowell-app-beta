AUDITED-COMMIT: 68e36af
VERDICT: SHIP

# Project Manager sign-off — ChemoWell app-v89

PM: Project Manager (independent of the builder). Gate required by
`claude/chemowell-app-beta.md` hard rule 5 and `TEAM.md`.

Repo `/home/user/chemowell-app-beta`, branch `claude/caretracker-team-review-i83ik2`,
`HEAD` = `68e36af`. Working tree clean, and verified clean rather than assumed: the working
`index.html` md5 is `a9de408c…`, byte-identical to a `git archive` of `68e36af`.

Measurements were taken against clean `git archive` exports served on their own ports —
`68e36af` on **9711** (md5 `a9de408c…`) and `origin/main` `8a7d696` = **live app-v89's predecessor,
app-v88** on **9712** (md5 `6c24a321…`). Every served file's md5 was compared against its own
directory before any result was believed. No tracked file was modified; no `git add` / `checkout` /
`reset` / `stash`. The one file this stage created is this report. Scratch work is under
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/pm89/`.

---

## HEADLINE

**SHIP.** Every chain stage ran and left an artifact, every blocker raised across five audit passes
is fixed in the tree being shipped, the deliverable is what Aaron asked for on both of his asks, and
the release mechanics are right. I did not take the builder's word for the two things that matter
most — I re-measured the paywall removal and the export fix myself, from a clean checkout, with my
own seed, and both hold.

**The release is worth shipping promptly, because app-v88 is the build doing harm.** I confirmed
against the live file that a clinician's printable report and CSV export are *right now* silently
dropping a radiation session's number, a skin reaction's severity and site, and a weight's stated
reason — and I found the one-line cause with my own eyes, not from the report.

Nothing blocks. Four items are deliberately deferred to v90 and I am satisfied all four are honestly
deferred: none of them makes this build tell a user anything untrue. I add three minor record items
of my own (P1–P3), none blocking.

---

## 1. DID EVERY STAGE RUN, AND WHAT DID EACH PRODUCE?

| Stage | Artifact | Verified |
|---|---|---|
| **Dev brief** | `outputs/DEV-BRIEF-app-v89.md` (118 lines, 7 154 B) | Present. Quotes Aaron's pricing decision verbatim and governing. |
| **Enhancer** | `outputs/ENHANCER-app-v89.md` (27 lines, 2 874 B) | Present, and **ran before the build** per Rule 1.5 — it landed in the build commit `c692f8a`, and its two findings changed the build rather than waiting for Aaron. |
| **Designer** | `outputs/DESIGN-app-v89.md` (65 lines) + `outputs/design-app-v89/` | Present. **Six** screenshots, the plans sheet and the Export section at 320 / 360 / 390. |
| **Zero Day Auditor** | `AUDIT-app-v89.md` (`c692f8a`, DO NOT SHIP), `-delta.md` (`92b95b1`, DNS), `-delta2.md` (`3c25aa9`, DNS), `-delta3.md` (`f6be11f`, DNS), `-delta4.md` (`a18098b`, DNS), `-delta5.md` (`1afe961`, **SHIP**) | All six present. Five refusals, then a clearing pass. |
| **PM** | this file | — |

**Stage order is right, and I checked it against commit order rather than file timestamps** (which
in this sandbox reflect checkout, not authorship). `DEV-BRIEF`, `ENHANCER`, `DESIGN` and all six
screenshots were added in the build commit `c692f8a` (10-26 04:39); the first audit came after, in
`ac2df72` (10-26 05:40). The design-time seats were not run retrospectively.

**No artifact is missing. No stage is a placeholder.** The Enhancer file is the one closest to the
substance floor at 2 874 B; I read it, and it is a real pass with two findings that changed the
build.

### The refusals are properly superseded — checked mechanically, not read

`delta5` states SHIP at `1afe961`, and all five refused commits are ancestors of it:

```
92b95b1 -> ANCESTOR of 1afe961 (will be superseded)
3c25aa9 -> ANCESTOR of 1afe961 (will be superseded)
f6be11f -> ANCESTOR of 1afe961 (will be superseded)
a18098b -> ANCESTOR of 1afe961 (will be superseded)
c692f8a -> ANCESTOR of 1afe961 (will be superseded)
```

`release_check.sh`'s supersession rule (`:680–718`) is same-stage and strictly-later, and `delta5`
satisfies both: it is an `AUDIT*` file, it is over the 2 000-byte / 25-line substance floor, and its
commit is a strict descendant of each refusal. Between `1afe961` and `HEAD` the only changed files
are `README.md` and `outputs/AUDIT-app-v89-delta5.md` — **no rule-5 path moved**, so `delta5` is
still current against the tree being shipped.

---

## 2. THE RAW `./release_check.sh` OUTPUT

### Run 1 — before this sign-off existed (exit 1, for that reason)

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.KTQbZhn08W
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v88 (chemowell-app-v88-1) at 2f486fa
   9 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: the quality chain has not run for app-v89.
   Changed under rule 5: index.html sw.js 
   missing: an outputs/PM*app-v89*.md sign-off
   AND a report on record REFUSES this release: outputs/AUDIT-app-v89-delta.md (examined 92b95b1) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   AND a report on record REFUSES this release: outputs/AUDIT-app-v89-delta2.md (examined 3c25aa9) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   AND a report on record REFUSES this release: outputs/AUDIT-app-v89-delta3.md (examined f6be11f) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   AND a report on record REFUSES this release: outputs/AUDIT-app-v89-delta4.md (examined a18098b) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   AND a report on record REFUSES this release: outputs/AUDIT-app-v89.md (examined c692f8a) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   Every suite passing is SELF-verification. CLAUDE.md rule 5 requires an independent
   Auditor pass and PM sign-off before this ships, with no size exception. Permission to
   push is not that gate.

⛔ STOPPED EARLY -- the checks after this point did NOT run.
   This is not the complete list of what is wrong with the release; it is the first thing
   that made the rest of the gate impossible to evaluate. Fix it and re-run.
EXIT=1
```

### Reading that output honestly — what blocked, and what did NOT

**The ONLY reason run 1 failed is the missing PM sign-off**, which is this file, and which could not
have existed before this stage ran. Two things in that output must not be misread:

1. **The five "a report on record REFUSES this release" lines are NOT five live blockers.** They are
   printed by the *missing-artifact* branch (`release_check.sh:492–499`), which deliberately names
   every standing refusal in the reports that exist and **does not apply the supersession test**.
   The supersession test lives further down (`:680–718`), which run 1 never reached because it
   stopped early. I verified the ancestry by hand (§1 above): all five are superseded by `delta5`.
2. **`⛔ STOPPED EARLY` means the rest of the gate was never evaluated** — so run 1 is not evidence
   that anything else is clean, and I did not treat it as such.

So I established independently whether anything *else* blocks, by running every suite the gate
invokes against the same kind of md5-verified clean export the gate uses:

| Suite the gate runs | `release_check.sh` | My result at `68e36af` |
|---|---|---|
| `test/v76-properties-equivalence.mjs` | `:834` loop | **22/22** |
| `test/v76-empty-window-render.mjs` | `:834` loop | **13/13** |
| `test/v89-everything-free.mjs` | `:834` loop | **74/74**, exit 0 |
| `test/v84-whatsnew.mjs` | `:834` loop | **100/100**, exit 0 |
| `test/v75-no-other-patient.mjs` | `:847–860` | **29/29**, exit 0 |

**Nothing apart from the missing sign-off blocks this release.** Release mechanics, the Rule 0
guard and all four gate suites are green, measured rather than inferred.

### Run 2 — with this sign-off in place

### Run 2 — with this sign-off in place (exit 0)

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.xOkgZkSaaZ
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v88 (chemowell-app-v88-1) at 2f486fa
   9 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v89-delta.md — says DO NOT SHIP
     outputs/AUDIT-app-v89-delta2.md — says DO NOT SHIP
     outputs/AUDIT-app-v89-delta3.md — says DO NOT SHIP
     outputs/AUDIT-app-v89-delta4.md — says DO NOT SHIP
     outputs/AUDIT-app-v89.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v89, and current against the working tree:
     outputs/AUDIT-app-v89-delta5.md
     outputs/PM-app-v89.md
ℹ️  Suite server on 127.0.0.1:8897, serving /tmp/tmp.xOkgZkSaaZ (md5 a9de408c verified).
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  v89-everything-free.mjs: green.
ℹ️  v84-whatsnew.mjs: green.
ℹ️  No-other-patient check: clean.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
EXIT=0
```

**The gate passes.** Note what it did with the five refusals once it could reach the supersession
test: they moved from `❌ RELEASE CHECK FAILED` to an informational
`ℹ️  Other reports present and not clearing this release`, and
`outputs/AUDIT-app-v89-delta5.md` + `outputs/PM-app-v89.md` are named as the current pair. That is
the behaviour I predicted from the ancestry check in §1, now confirmed by running it. The gate also
independently re-ran the four suites against its own md5-verified clean export (`a9de408c`, the same
hash I measured against) and confirmed the `CACHE` constant moved with `index.html`.

---

## 3. THE HEADLINE CLAIM, VERIFIED INDEPENDENTLY

Aaron's decision is that **a single user gets every feature free**. I did not grep for the deleted
line; I established the claim from both directions.

**No feature paywall remains.** `grep -n "upgradeOpen: true"` returns exactly four sites:

```
10390  + Add profile   (gated on profilesState().list.length >= tierLimit(getLicense().tier))
10391  View plans      (unconditional)
11344  View plans      (unconditional)
11377  + Add profile   (gated on ps.list.length >= limit)
```

Two profile-cap gates and two View-plans buttons, and nothing else — exactly as my brief predicted.

**`openPrintReport()` has no tier test.** I read the function (`index.html:10931`): it opens with
`const rows = buildExportRows();` and there is no license check anywhere in it.

**And I checked the other direction too**, because "no paywall" is a claim about absence and absence
is the easy thing to get wrong. Every reader of `getLicense()` in the file is at `:160`, `:161`,
`:634` (the profile cap), `:4772` (drawer badge), `:5133` (the plans sheet itself), `:10342`
(Settings display), `:10390` and `:11321` (Account display). **Not one is a feature gate.**

**The paid ladder survives.** `tierLimit()` (`index.html:172`) is unchanged:
`tier === 'pro' ? Infinity : tier === 'plus' ? 3 : 1` — **1 / 3 / Infinity**. Both Add-profile
buttons still bite.

### Aaron asked for BACKUP specifically, and "it was already free" is exactly where a requirement gets dropped

His words were *"make backup free for all tiers."* The builder's record says backup and restore were
already free. **I verified that rather than accepting it**, by extracting every function in the file
whose name mentions backup or restore and scanning each body for `getLicense` / `tierLimit` /
`.tier` / `upgradeOpen`:

```
free      createProfileForRestore   (line 257)
free      cwBkConfirmRestore        (line 372)
free      cwUndoRestore             (line 567)
free      restoreView               (line 1830)
free      restoreMedicationConfig   (line 8001)
free      downloadBackupFile        (line 10781)
free      renderBackupSection       (line 10994)
free      renderBackupProtect       (line 11029)
free      renderBackupUnlock        (line 11067)
free      renderBackupChoice        (line 11117)
```

**Ten functions, zero tier references.** Backup is free, and was.

**And this is where the release does its real work on Aaron's ask.** On **live app-v88** the Plus
card sold this (`index.html:5193`):

> `'Up to 3 patient profiles', 'Printable doctor’s report (print or save as PDF)', 'Backup & restore — move your data to a new phone'`

So live is **selling a free feature**, and therefore telling free users they lack something they have
always had. That is precisely the thing Aaron was reacting to with *"I might have read that wrong
earlier"*, and it is gone. The Pro card's four bullets — three of them *coming soon* / *in
development* — are gone with it. The two paid cards now carry people-counts plus *"Every feature, for
all three"* / *"for all of them"*, and the sheet's own blurb reads *"Every feature in ChemoWell is
free for one person, and stays free. Paying adds more people to track — once, not monthly."*

**Headline, bullets and price list agree.** No scope drift, and no dropped requirement: Aaron named
backup, and the deliverable both leaves it free in code and stops the price list claiming otherwise.

---

## 4. THE EXPORT FIX, MEASURED MYSELF

This is the most consequential thing in the release, so I re-derived it from scratch rather than
re-reading `delta5`'s table. **My seed is deliberately wider than the suite's seven entries** — 14
rows, adding a second skin reaction with severity but *no* site, a weight with *no* reason, a
paracentesis, an in-patient start, a cycle marker and a real medication dose — so that "exactly
three kinds" is tested against kinds that could have changed and didn't.

Identical seed, both builds, read through `window.__v86Test.exportRows()`:

| # | Type | live app-v88 Detail | `68e36af` Detail | changed |
|---|---|---|---|---|
| 0 | Temperature | `"99.1 °F"` | `"99.1 °F"` | — |
| 1 | Blood Pressure | `"120/80 mmHg"` | `"120/80 mmHg"` | — |
| 2 | **Weight, with a reason** | `"150 lb"` | `"150 lb (Fluid retention / swelling)"` | **CHANGED** |
| 3 | Weight, **no** reason | `"151 lb"` | `"151 lb"` | — |
| 4 | **Radiation Session** | `""` | `"Session 1"` | **CHANGED** |
| 5 | Bowel Movement | `"Normal"` | `"Normal"` | — |
| 6 | Appetite | `"Little to none"` | `"Little to none"` | — |
| 7 | **Skin Reaction/Rash** (mild, left forearm) | `""` | `"mild, site: left forearm"` | **CHANGED** |
| 8 | **Skin Reaction/Rash** (severe, no site) | `""` | `"severe"` | **CHANGED** (same kind) |
| 9 | Nausea (bare symptom) | `""` | `""` | — |
| 10 | paracentesis | `"3.5 L"` | `"3.5 L drained"` | changed — **a word, no value** |
| 11 | In-Patient Start | `""` | `""` | — |
| 12 | Ondansetron (a real dose) | `"8 mg"` | `"8 mg"` | — |
| 13 | Period Start | `""` | `""` | — |

Zero uncaught page errors on either build. **No non-Detail column differs anywhere** (I compared the
date, time, type and note columns too: `NON-DETAIL COLUMN DIFFERENCES: []`).

### The changelog bullet names three kinds. That is exactly right.

> *"Radiation sessions, skin reactions and weights logged with a reason were printing without their
> details. Fixed. If you sent a care team a report or spreadsheet since October 24th showing any of
> those, send a fresh one."*

* **Three kinds lost a value and three are fixed**: Weight (reason), Radiation Session (number),
  Skin Reaction/Rash (severity and site). My row 8 shows the fix holds for a severity-only skin
  reaction too, not just the seeded severity-plus-site shape.
* **The qualifier "logged with a reason" is precisely right** — row 3, a weight with no reason, is
  byte-identical on both builds. Saying "weights" unqualified would have been an over-claim, and the
  wording avoids it.
* **"skin reactions" and not "symptoms" is right** — row 9, a bare Nausea, is empty on *both* builds.
  Telling someone logging nausea to re-send an oncology printout would have been false. The five
  audit refusals on this sentence were earned, and the fifth draft is the true one.
* **Paracentesis is correctly NOT claimed** — it gained the word *"drained"*. A format change, not a
  recovered value, and nothing a clinician needs re-sent.
* **Nothing else is named, and nothing else changed.**

### The cause, found first-hand — and it confirms the severity

I did not take the root cause on trust either. On **live app-v88**, `index.html:10562`:

```js
else if (e.medId === 'cycle_start' || ... ) detail = '';
if (superseded) detail = detail + ' (corrected later — superseded)';   // <-- line 10562
// ...
else {                                                                 // <-- line 10573
  detail = e.dose || '';
```

`if (superseded)` is a **new statement**, so it terminates the `if / else-if` chain above it — which
means the trailing `else { detail = e.dose || ''; }` binds to *it*, not to the chain. Every entry
that was **not** superseded — nearly all of them — fell into that `else` and had its computed detail
**overwritten with `e.dose`**. Temperature, BP, bowel and appetite survived only because their
`e.dose` happens to equal the computed value. Radiation and skin reactions store `dose: null`, so
they were blanked; a weight's appended reason was thrown away.

On `68e36af` the statement has moved **below** the `else` block, with a comment at `:10582` naming
the trap. Chain restored.

**This is a live defect on the one artifact a patient hands to a clinician, and it is silent.** It is
the strongest argument for shipping now rather than holding for instrument work.

---

## 5. RELEASE MECHANICS

| Check | Result |
|---|---|
| `APP_VERSION` | `'app-v89'` — `index.html:9307` |
| `sw.js` CACHE | `'chemowell-app-v89-1'` — `sw.js:1` |
| **Moved together and match each other** | **Yes** — 89 ↔ 89. Live is `app-v88` / `chemowell-app-v88-1`. |
| `PUBLISHED.json` | Still records **`app-v88`** / `chemowell-app-v88-1` at `2f486fa` — **correct**; it is updated by `./mark_published.sh` *after* the push. |
| Baseline trustworthy? | **Verified, not assumed.** `2f486fa`'s `index.html` (`6c24a321…`) and `sw.js` (`ddca18c5…`) are **byte-identical** to `origin/main` `8a7d696`'s. The gate's baseline and my comparison build are the same bytes. |
| Stale version anywhere? | **No.** No version literal in `manifest.webmanifest`, `capacitor.config.ts` or `package.json`. `www/index.html` is the Capacitor splash shim with no version, correctly untouched. The three `app-v88` strings left in `index.html` are a historical comment, the v88 changelog entry, and an audit comment — all correct as history. |
| Working tree | Clean, and md5-confirmed identical to `git archive` of `68e36af`. |

---

## 6. RULE 0.9 — THE RELEASE NOTES

Measured by parsing the `CHANGELOG` array directly, then read rendered at 320 and 390 px.

| v | date | title (words) | bullets | entry words | markdown chars |
|---|---|---|---|---|---|
| app-v89 | Oct 31, 2026 | "Every feature is free now" (5) | 3 | **71** | none |
| app-v88 | Oct 25, 2026 | "Log a day you missed" (5) | 2 | 48 | none |
| app-v87 | Oct 25, 2026 | "Fix a day you logged wrong" (6) | 2 | 49 | none |
| app-v86 | Oct 24, 2026 | "Log bowel and appetite any time" (6) | 3 | 47 | none |
| app-v85 | Sep 17, 2026 | "Reminders stop deleting each other" (5) | 1 | 27 | none |
| app-v84 | Sep 14, 2026 | "The app tells you what changed" (6) | 1 | 20 | none |
| app-v83 | Sep 14, 2026 | "Medication cards show today" (4) | 3 | 43 | none |
| app-v82 | Sep 14, 2026 | "A simpler home screen" (4) | 2 | 41 | none |
| app-v81 | Sep 14, 2026 | "Dose amounts read correctly" (4) | 2 | 43 | none |
| app-v80 | Sep 13, 2026 | "Home says what is due next" (6) | 2 | 35 | none |

**Ten entries. Titles 3–6 words: all pass. 424 bullet words total.** Only app-v89 exceeds the ~70
target, at **71** — it is the documented item-4 exception (it asks the reader to re-send a report)
and is far under the 100-word rewrite line. **Zero markdown characters** in the array, and zero
rendered at either width.

**The shortening is real and large.** Against live app-v88, the nine shared entries went from
**1 224 words to 353** — app-v87 alone from 223 to 49. That is Aaron's *"no one is reading all of
that for every update"* answered properly.

### Is anything the user needed lost? I checked the one case that worried me.

Rule 0.9 says nothing may be deleted without the detail living in the README row. The real risk is
not detail — it is a **dropped action item**, and one entry had one. Live app-v85's third bullet read:

> *"Reminders are still only set up for the person you are in, and another person's run out within
> about three days, so open their profile to set theirs up again."*

That is an instruction, and the shortened entry is one bullet with no instruction in it. The audit
calls this carried-over and "mitigated by permanent Settings copy". **I verified the mitigation
exists**, at `index.html:9615–9616`:

> *"The other profile on this phone keeps the reminders it already had, but nothing adds to them
> while you are not in it, and they run out within about three days — open that profile to set its
> reminders up again."*

It carries a `data-notif-profile-scope` hook, it is rendered in Settings → Notifications, it is
conditional on other profiles existing, and it has a correctly-pluralised branch for more than two.
**That is strictly better than a changelog bullet**, which only a reader of that one release's notes
would ever see. Satisfied: nothing a user needs was lost.

**Are the notes true?** I read all ten rendered. The three app-v89 bullets are each verified above by
my own measurement — bullet 1 against the live paywall at `10892`, bullet 2 against `tierLimit()`,
bullet 3 against my export table. The *"since October 24th"* window is right and errs safely: the
defect entered in **app-v86**, whose README row is dated **Oct 24** (its commit lands Oct 25), so the
stated window is if anything a day wider than the defect, which is the safe direction for an
instruction to re-send a medical document.

### Rule 5.5 — the interaction, not the still frame

The release changes an overlay, so I checked the moving case rather than only the render: with the
notice open, `window.scrollBy(0, 400)` moves the page **0 px** at both 320 and 390 (scroll lock
intact), there is **no horizontal page scroll** at either width, and **no page errors**.

---

## 7. ARE THE FOUR DEFERRALS HONEST?

The test I applied is the one my brief sets: **does any deferral mean this build tells a user
something untrue?** For each, I verified the *claim being guarded* by direct measurement, so the
answer does not depend on the suite.

| Deferred | What is weak | Does it make THIS build untrue? |
|---|---|---|
| **F1** — 9.6 can go vacuous. The title is `innerText.split('\n')[1]`, a positional text selector; emptying the `Updated` badge makes the extracted "title" `"Oct 31, 2026"`, and 9.6a's own precondition passes it. | The *instrument* that guards the title. | **No.** I verified the title directly: `"Every feature is free now"` is true because there is no feature gate anywhere in the file (§3), measured from both directions. A weak check does not make true copy false. |
| **m4** — 9.4's `\|\| /skin reaction/` escape hatch would let *"symptoms including skin reactions"* back in. | The instrument. | **No.** The shipped bullet says *"Radiation sessions, skin reactions and weights logged with a reason"*. I read it rendered at 320 and 390: **no bare "symptoms"**. |
| **m5** — 9.5 polices a fixed four-word list, so a kind that lost nothing could be falsely named. | The instrument. | **No.** My wider seed is the direct test: paracentesis, in-patient, cycle, a real dose, temperature, BP, bowel and appetite all either unchanged or format-only, and **none is named** in the notice. |
| **m9** — the `Detail !== dose` proxy means "formats differently", not "lost a value", so extending the seed with a paracentesis reds 9.3 on an unmodified app. | A false red for a future editor. | **No.** Suite-side only. It never reaches a user, and it fails *loudly* rather than passing vacuously — the safe direction. |

**All four are honest deferrals.** Every one is a weakness in the instrument that would guard a
*future* release, not a defect in what this release says or does. None of them is load-bearing for
any claim in the shipped copy, because I verified each claim by measurement instead.

I agree with the auditor's priority: **F1 first in v90.** It is the only one where a check could
silently become vacuous — the `|| true` shape this repo has shipped before — and it is ~3 lines of
app plus ~2 of suite. The other three fail loudly or are additive risks.

### R1–R3: were the README corrections really made in `68e36af`?

Verified in the diff, all three:

| | Claim | At `68e36af` |
|---|---|---|
| **R1** | suite count was wrong: "71 checks" should be 74 | **Corrected** — the row reads `grew 30 → **74 checks**`. I ran the suite: **74**. |
| **R2** | row claimed `v88 58/58`; that suite is 56/58 on every build | **Corrected** — reads `v88 56/58 — and that is recorded honestly rather than as a pass`, with the month-end calendar reason. |
| **R3** | row dated Oct 26 while the entry it documents is Oct 31 | **Corrected** — row now `Oct 31, 2026`, matching the changelog entry. |

**And I confirmed R2's premise rather than assuming it**, which my brief specifically asked for.
`test/v88-log-a-missed-day.mjs` run against both builds:

```
######## v88 against HEAD (9711)
  FAIL  a day in the future writes nothing  |  0 -> 1 ["normal"]
  FAIL  and it says so rather than failing silently  |  no "has not happened yet" anywhere on screen
######## v88 against LIVE app-v88 (9712)
  FAIL  a day in the future writes nothing  |  0 -> 1 ["normal"]
  FAIL  and it says so rather than failing silently  |  no "has not happened yet" anywhere on screen
58 checks: 56 passed, 2 failed
```

**Identical two failures on live and on HEAD — a false red in the suite, not a regression**, and
`v88-log-a-missed-day.mjs` is **not** in `release_check.sh`'s suite list, so it does not block.
Confirmed, not assumed.

---

## 8. MY OWN FINDINGS — ALL MINOR, NONE BLOCKING

### P1 — MINOR (record) — the README row mis-splits the five `upgradeOpen` call sites
The app-v89 row says *"`grep` for every `upgradeOpen: true` returns five call sites, **four of them
the profile cap**, one the paywall."* On live app-v88 those five are: `10391` Add-profile (capped),
`11339` Add-profile (capped), `10392` **View plans** (unconditional), `11306` **View plans**
(unconditional), `10892` the paywall. So it is **two** cap gates and **two** plain links, not four
cap gates. `delta5` states the accurate breakdown. This is the same class as R1–R3 — a number in the
developer record that does not survive being checked — and it is one clause.

### P2 — MINOR (Enhancer, for v90) — the Free plan card lists no features at all
`planCard('free', 'Free', '$0', null, [], 'free')` (`index.html:5186`) renders an **empty** feature
list. **Pre-existing — live app-v88 has the identical empty array**, so this is not a regression and
not a reason to hold. But it is newly awkward: the release's headline is *"Every feature is free
now"*, and the plans sheet is where a reader goes to confirm that — and the Free card there is
blank, with the one-person rule stated only in the blurb above it. An Enhancer question for v90, not
an audit finding.

### P3 — MINOR (Rule 0.9 shape) — two entries carry one bullet where the rule asks two to four
app-v85 and app-v84 each have a single bullet. Rule 0.9 item 2 asks for *"two to four"*.
Already logged as `delta4`'s M2 and carried over; recorded here so it is not lost. Both entries are
true and complete as they stand — this is shape, not substance.

---

## 9. WHAT I AM REFUSING THIS RELEASE FOR

**Nothing.** No blocker, no condition.

Every blocker raised across the five audit passes is fixed in the tree being shipped and I verified
the two that mattered most myself. The chain is complete, the deferrals are honest, the mechanics
are right, and the copy is true. The remaining items (F1–F4, P1–P3, M-series carry-overs) are all
instrument or record work for v90.

**Post-push, non-negotiable:** run `./mark_published.sh <the commit that was uploaded>` and commit
the result, so `PUBLISHED.json` moves to `app-v89` / `chemowell-app-v89-1`. The gate's baseline is
only trustworthy because this was done correctly last time.

---

## 10. THE COMPLETION SUMMARY AARON WILL RECEIVE

> ### ChemoWell app-v89 — checked and cleared to go live
>
> | # | App | Task | Status |
> |---|---|---|---|
> | 1 | ChemoWell app | Make every feature free for one person (your pricing decision) | DONE — pushed, awaiting your word |
> | 2 | ChemoWell app | Printable report paywall removed; backup confirmed free on every tier | DONE — pushed, awaiting your word |
> | 3 | ChemoWell app | Plans screen stops selling things that were already free | DONE — pushed, awaiting your word |
> | 4 | ChemoWell app | Fix the report/spreadsheet dropping details | DONE — pushed, awaiting your word |
> | 5 | ChemoWell app | Release notes cut from a book to a few lines | DONE — pushed, awaiting your word |
> | 6 | ChemoWell app | Independent audit (five refusals, then cleared) | DONE — pushed, awaiting your word |
> | 7 | ChemoWell app | PM sign-off — this one | DONE — pushed, awaiting your word |
> | 8 | ChemoWell app | Push app-v89 live | BLOCKED — needs you: your go-ahead to push |
> | 9 | ChemoWell app | v90: strengthen the check that guards the update notice | QUEUED |
>
> *(Numbers are this release's chain items; slot them into the running list when you next renumber.)*
>
> **You asked for two things and both are done.**
>
> **One: a single person gets everything, free.** The printable doctor's report was the only thing
> you had to pay for, and it is gone. I checked the whole app myself — there is no other feature
> locked behind payment anywhere. Backup and restore were already free, but the plans screen was
> *advertising them as paid*, which told free users they were missing something they already had.
> That is fixed too. Paying now buys one thing only: more people to track. One person, three people,
> or as many as you need — the price ladder still works.
>
> **Two: the release notes are short.** The last ten updates went from about 1,200 words to 420 —
> app-v87 alone went from 223 words to 49. Nothing a person actually needed to *do* was thrown away;
> I checked the one entry that had an instruction in it, and that instruction is now permanently on
> the Settings screen, where everyone sees it instead of only people who read that week's notes.
>
> **And this release fixes something I think you should know was happening.** The printable report
> and the spreadsheet — the ones a care team reads — have been *silently leaving details out* since
> around October 24th. A radiation session printed with no session number. A skin reaction printed
> with no severity and no location. A weight printed without the reason it was taken. I ran the
> export on the live app and on the new one side by side to be certain, and those three are exactly
> what was broken and exactly what is fixed. The update tells people so, and asks anyone who sent a
> report or spreadsheet in the last week to send a fresh one.
>
> **My verdict: ship it.** Everything the team was supposed to check got checked — the audit refused
> this release five times before clearing it, which is the process working, not a problem. All the
> tests pass. The one thing left to do after it goes live is a small improvement to one of our own
> tests, which I have queued for the next release.
>
> **Your decision: say the word and app-v89 goes live.**

---

*PM stage complete. `AUDITED-COMMIT: 68e36af` · `VERDICT: SHIP`.*
