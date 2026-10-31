AUDITED-COMMIT: a18098b
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v89, FOURTH DELTA PASS (the intended clearing pass)

Auditor: Zero Day Auditor (independent). Follows `outputs/AUDIT-app-v89.md` (refused `c692f8a`),
`-delta.md` (refused `92b95b1`), `-delta2.md` (refused `3c25aa9`) and `-delta3.md` (refused
`f6be11f`). This pass covers `git diff f6be11f a18098b`.

Working tree clean, `HEAD` = `a18098b`, `index.html` md5 `822117ed…`. Measurements were taken
against clean `git archive` exports: `a18098b` on **9411**, `origin/main` (`8a7d696` = live app-v88,
md5 `6c24a321…`) on **9412**, `f6be11f` (md5 `902aec24…`) on **9413**, five mutants on
**9421–9425**. Every port was confirmed free before binding, and every server's served bytes were
md5-compared with its own directory before any result was believed. All eight were killed at the end
of the pass. No tracked file was modified except this report.

---

## HEADLINE

**The ten rewritten release notes are, with one exception, TRUE — and the exception is the
four-word title.** `Everything is free now` is false: Plus ($4.99) and Pro ($14.99) are still on the
plans sheet two taps away (`index.html:5194–5195`), and the app still blocks a second profile behind
them. The previous title, `Every feature is free`, was exactly true — features are free, the number
of people is not — and the shortening turned a precise claim into an over-general one. The bullet
directly beneath it says *"Paying adds one thing: more people to track"*, so the notice contradicts
its own headline in the next line. This is the v65 shape (*"The frosted glass is gone"*) in a
four-word title: the one surface in this product that speaks to the patient, claiming something the
release did not do. **One word fixes it.**

**And the release gate is red.** `test/v75-no-other-patient.mjs` **FAILS at `a18098b`** — 28/29,
exit 1 — on **one new gendered pronoun**: `index.html:9319`, *"**He** is right and the numbers were
indefensible"*, in the new CHANGELOG header comment. Count 32 → 33, ratchet allows 32.
`release_check.sh:847–860` runs that suite and fails the release on it, so **this build cannot pass
its own gate.** `a18098b`'s commit message reports `v84-whatsnew 100/100` and `v89 65/65`; v75 was
not run. The README row for app-v89 records this same ratchet firing on this same release
(36 → 32) — it fired again, in the same direction, and nobody looked.

**What this release got right, measured:** the export fix is real and the bullet describing it is now
accurate to the row. Exporting both builds with app-shaped entries, **exactly three** types lost a
visible value on live app-v88 and are fixed here — and nothing else changed:

| Entry, written as the app writes it | app-v88 Detail | `a18098b` Detail |
|---|---|---|
| Radiation session | *(empty)* | `Session 1` |
| Skin Reaction/Rash, mild, left forearm | *(empty)* | `mild, site: left forearm` |
| Weight 150 lb with a reason | `150 lb` | `150 lb (Fluid retention / swelling)` |
| Paracentesis 3.5 L | `3.5 L` | `3.5 L drained` *(a word, no value — correctly NOT claimed)* |
| Nausea, Temperature, BP, bowel, appetite, doses, cycle/in-patient | identical | identical |

So *"Radiation sessions, skin reactions and weights logged with a reason were printing without their
details… send a fresh one"* names exactly the three that lost something and nothing it did not.
**Fifth draft, and the first one that is true.** Delta3's blocker N1 is resolved.

**N2 and N3 — the two guards that let refused defects back in — are resolved and falsified.** I
re-wrote delta3's three surviving mutants and all three now redden.

---

## EVERY EARLIER FINDING, ITEM BY ITEM

| Pass | Item | Verdict at `a18098b` |
|---|---|---|
| delta3 | **N1** changelog over-claims the symptom fix | **RESOLVED.** Measured on both builds; see the table above. The bullet names skin reactions only, and a bare symptom's Detail is empty on both builds (my own export, and suite 7.1b). |
| delta3 | **N2** step-order guard indexed phrasings; B2 walked back in twice | **RESOLVED AND FALSIFIED.** `6b.4` now pins `pPassword === 0` absolutely, `6b.5` rejects any earlier step that moves the file, `6b.6` rejects a negation. My **m3** (a new first step, *"…tap the button that saves the file. Email it to yourself straight away…"*) reds 6b.4 **and** 6b.5 → 63/65. My **m4** (*"you do not need to turn on **Protect the file with a password** for a quick copy"*) reds 6b.6 → 64/65. Both were green at 64/64 last pass. |
| delta3 | **N3** paid-bullet guard bypassable and too strict at once | **RESOLVED AND FALSIFIED.** `5.1b` now pins all six paid bullets as exact strings. My **m5** (delta3's exact bypass, *"Up to 3 people, each with a printable summary for every appointment"*) reds it → 64/65. The brittleness is deliberate and documented in the file; I agree with the trade — the paid claim changes about once a year and changing it should require editing that list on purpose. |
| delta3 | **N4** symptom fixture a shape the app cannot write (three ways) | **RESOLVED.** `k10` is `severity: 'mild'` lowercase, `freq` is gone, 7c.2/7c.2b assert the exact string the writer produces, and a new **7.1b** asserts a bare nausea log exports an **empty** Detail on both builds — the suite now states out loud what the changelog says. |
| delta3 | **P1** literal `**` in the notice; the markdown suite missing from the gate | **STILL RESOLVED, and the guard covers titles too.** Rendered at 320/360/390: zero `*`, zero backticks, in the notice **and** in all ten entries of the "see all" list. My **m2** put `**Everything**` in a changelog **title** — `v84-whatsnew` reds twice, 98/100. |
| delta3 | **P2** the weight clause | **STILL RESOLVED**, re-measured. |
| delta3 | **P3** the comment's second failure direction | **STILL RESOLVED.** |
| delta3 | P7 appetite fixture | **STILL RESOLVED.** |
| brief | the paywall removal | **RESOLVED.** `v89` section 1 clicks the report button as a free user and requires a real report document back. 65/65. |
| brief | the profile cap at 1 / 3 / ∞ | **RESOLVED.** `v89` section 3 drives all three tiers through the real Add-profile button. 65/65. |
| brief | `buildExportRows()` across every branch and both consumers | **RESOLVED.** 14 rows, one of every shape, on both builds (table above). Both consumers go through the one function — `index.html:10876` (CSV) and `10932` (printable report) — plus the test hook at `13586`. No row is worse under this build than under app-v88; four are better. |
| brief | the Help recovery procedure — order, control names, cold-start caveat | **RESOLVED**, read rendered from the array the screen renders. Step 1 is the encrypt instruction; step 2 names **Save backup file** / **Save protected backup**; step 3 the share screen; step 4 the cold-start caveat (*"set it up with any name first… there is no menu until it is done"*) **before** **Restore from a backup**; step 5 "do it before erasing anything". Control names match the app's own buttons. |
| brief | no literal markdown anywhere rendered | **RESOLVED** (above). |
| brief | Rule 0 — no patient name, no gendered pronoun incl. comments, no care-plan dose, no new medication-id behaviour | **NOT RESOLVED — REGRESSED.** Name: clean. Dose/ceiling/schedule: clean. Medication-id ratchets: 0/0/0, all clean. **Pronoun: 33 found, 32 allowed — FAIL.** See B1. |

---

## BLOCKERS

### B1 — BLOCKER — The release gate refuses this build: one new gendered pronoun in the new comment
**File/line:** `index.html:9319`. **Gate:** `release_check.sh:847–860`.

```
// He is right and the numbers were indefensible: app-v89 ran to 304 words and app-v80 to 956. A
```

**Reproduce.** `FALSIFY_BASE=http://127.0.0.1:9411/index.html node test/v75-no-other-patient.mjs`
→ `FAIL  no NEW gendered pronoun has been added to the file (Rule 0 shape 2) | 33 found, ratchet
allows 32`; **28/29, exit 1**. Counted directly on both trees with the suite's own regex:
`f6be11f` 32, `a18098b` 33; a line-by-line diff names exactly one new line, the one above.
`release_check.sh` runs this suite and prints
`❌ RELEASE CHECK FAILED` on a non-zero exit, so the release cannot be pushed as it stands.

**Why it matters.** Not to a caregiver — it is a comment. It matters because it is the mechanical
gate, and because this is the **third consecutive release** in which new prose written by the
builder added a pronoun the ratchet had to catch (app-v88's audit caught two; app-v89's README
records 36 → 32). The ratchet's own comment lists "Aaron by name in the same sentence" as a
legitimate hit; this line is a bare "He" in a sentence that does not name him, so it counts. The
prose was lifted from the commit message, where it is fine, into the file, where it is counted.

**Fix.** `He is right` → `Aaron is right` (one word; also satisfies the ratchet's documented
legitimate category), or drop the clause. Then re-run `test/v75-no-other-patient.mjs` and expect
**29/29**. Do **not** raise `PRONOUNS_ALLOWED` — the ratchet is two-sided on purpose.

### B2 — BLOCKER (copy) — The app-v89 title says everything is free. Two taps away, two plans cost money.
**File/line:** `index.html:9315` (`title: 'Everything is free now'`). Contradicted by
`index.html:5194–5195` (Plus $4.99, Pro $14.99) and by its own next bullet.

**Reproduce.** Seen-version `app-v88`, notice opened at 390px. Rendered, verbatim:

> **Everything is free now** · Oct 26, 2026
> • The printable doctor's report no longer costs anything. It was the only feature you had to pay for.
> • **Paying adds one thing: more people to track.** One person gets every feature, free, for good.
> • Radiation sessions, skin reactions and weights logged with a reason were printing without their details. Fixed. If you sent a care team a report in the last few days showing any of those, send a fresh one.

Then Account → **View plans**: `Plus $4.99 · Up to 3 people` and `Pro $14.99 · As many people as
you need`. Adding a second profile on Free opens that sheet (`index.html:10390`, `11377`).

**Why it matters to a caregiver.** The Voice's first question is *is it true — not roughly right,
true*. A caregiver looking after two relatives reads a headline saying everything is free, tries to
add the second person, and is asked for $4.99. The previous title said `Every feature is free`,
which is the exact, true claim and the same length. The shortening is right; this particular word
is not. It is also the third release in a row where the headline over-claimed what shipped (v64,
v65), which is the reason the Voice seat exists.

**Fix.** `Everything is free now` → **`Every feature is free now`** (4 → 5 words, still inside Rule
0.9). Nothing else in the entry changes.

---

## PER-ENTRY VERDICT — ALL TEN REWRITTEN RELEASE NOTES

Read **rendered**, from the "see all" screen as well as the notice, at 320/360/390. Each was checked
against its `README.md` version-history row and against the code or the release's own suite (all of
which I re-ran at `a18098b`: v80 49/49, v81 227/227, v82-timeline 24/24, v83 80/80, v85 43/43,
v86 87/87, v87 64/64, v88 56/58 — see N3 for those two).

| Entry | Title | Words | Verdict |
|---|---|---|---|
| **app-v89** | Everything is free now | 71 | **FALSE TITLE (B2).** The three bullets are **TRUE and measured** — the export clause names exactly the three types that lost a value and no more. Minors: the entry says "report" where v88's said "the report **and the spreadsheet**" (M4), and "in the last few days" where the defect has been live since Oct 24, seven days (M5). |
| **app-v88** | Log a day you missed | 48 | **TRUE.** `Log another day` is the real control on both screens (`data-log-another-day`, suite section 1). The appetite note box exists and was previously shown and exported with nowhere to write one. Dropped without loss: *"a day in the future is refused"* (the guard is real but unreachable except via the calendar's Next-month button — see N3), and *"one answer per day… replaces it and keeps the earlier answer"* (the export labels it itself, M3). |
| **app-v87** | Fix a day you logged wrong | 49 | **TRUE.** `Correct` is on every day in both lists; `Loose` is in `BOWEL_MOVEMENT_LABELS` and the banner box is built from that same map (`index.html:3555`, suite 64/64); a loose day renders amber. |
| **app-v86** | Log bowel and appetite any time | 47 | **TRUE.** Both Reports screens log directly at any hour; History names BP/symptoms/procedures instead of "doses"; rename exists in Settings (`renameActiveProfile`). "the person you are tracking" for "the profile you're in" is a fair translation. |
| **app-v85** | Reminders stop deleting each other | 27 | **TRUE but INCOMPLETE — the only entry that lost an instruction (M1).** What it says is true. What it dropped — *"another person's run out within about three days, so open their profile to set theirs up again"* — is the one action item in the whole rewrite, and the consequence of not doing it is a missed dose. **Mitigated, and I measured the mitigation:** that sentence is on Settings → Notifications permanently, with correct singular/plural, for any multi-profile phone (`index.html:9615–9616`; `v85-profile-reminders` 43/43 asserts the whole clause and the instruction). Permanent placement beats a one-time note, so this is a minor, not a blocker. |
| **app-v84** | The app tells you what changed | 20 | **TRUE.** One bullet where Rule 0.9 asks for two to four (M2). Dropped "listed under What's new in the menu" — self-evident to anyone reading the list. |
| **app-v83** | Medication cards show today | 43 | **TRUE.** Omitting "or at its daily limit" from bullet 1 is covered by bullet 2's limit bar. Temperature report and fever line confirmed (suite 80/80). |
| **app-v82** | A simpler home screen | 41 | **TRUE.** Tiles, the same Log button underneath, one timeline instead of four time-of-day cards (suite 24/24). |
| **app-v81** | Dose amounts read correctly | 43 | **TRUE, muddled (M6).** Both claims are individually true (`v81-dose-parser` 227/227), but the bug named (".5 mg counted as 5 mg") and the fix named ("half-tablets are read properly") are *different cases*, so a reader cannot tell the `.5 mg` case was fixed. Also dropped: that a combination med's daily limit is **not applied** and the app says so on the dose screen — that is user-relevant, and it survives only because the app says it in place. |
| **app-v80** | Home says what is due next | 35 | **TRUE** (suite 49/49). |

**Rule 0.9 mechanics:** titles 4–6 words throughout; 424 words of bullets across ten entries;
longest entry 71 words (app-v89, the documented single action-bullet exception, one word over the
~70 target); zero markdown characters in the array; no mechanism, version numbers, function names or
team seats in any entry. **This is a large, genuine improvement and Aaron's instruction was carried
out.** Two entries have a single bullet where the rule asks for two to four (M2).

---

## NEW FINDINGS

### N1 — MAJOR (instrument) — Nothing in this repo ties a changelog claim to the app's behaviour, and the four-times-refused over-claim re-enters at a fully green board
**Mutant m1** (port 9421, md5 `f60dcc99…`, verified served). One word: `skin reactions` →
`symptoms`, restoring the exact sentence that caused three of the four refusals on this release —
*"Radiation sessions, **symptoms** and weights logged with a reason were printing without their
details… send a fresh one"*, which sends a caregiver logging nausea to re-send an oncology printout
that comes back identical.

```
v89-everything-free : 65 checks, 65 passed, 0 failed
v84-whatsnew        : 100 checks, 100 passed, 0 failed
```

**Every gate green.** `v84-whatsnew` has sixteen sections and not one of them asks whether an entry
is *true*; section 7 only checks the newest entry names the running version, and 7f/7z check
completeness claims and markdown. The only instrument that has ever caught this sentence is an
auditor exporting both builds by hand — four times now. Delta3 logged this as a minor; it is a major
after a rewrite of all ten entries, because the next person to shorten a bullet has nothing standing
behind them.

**Fix (≈15 lines, and it is the check this release is missing).** Seed one entry of every kind,
export on this build and on the previous release, and require the app-v89 bullet's named list to
equal exactly the set of types whose Detail changed. Section 7 already has the fixtures and 7.1b
already has the "bare symptom is blank on both builds" half; the missing half is asserting the
*sentence* against that set.

### N2 — MAJOR — `test/v88-log-a-missed-day.mjs` is a FALSE RED today, on every build, and its future-day section has never reached the guard
**File/line:** `test/v88-log-a-missed-day.mjs:131–139` and `:242–268`.

```
FAIL  a day in the future writes nothing            | 0 -> 1 ["normal"]
FAIL  and it says so rather than failing silently   | no "has not happened yet" anywhere on screen
```

**Identical on `a18098b`, on `f6be11f`, and on `origin/main` (live app-v88) — so it is NOT a
regression from this release**, and it is not in `release_check.sh`'s suite list, so it does not
block.

**Root cause, measured.** The suite wants tomorrow, computes the date-*number* (`String(getDate())`)
and clicks the last cell with that label. `renderCalendar()` (`index.html:5572`) draws **only the
cursor month**. Today is **Oct 31**, so tomorrow's number is `1` and the only cell labelled `1` is
**Oct 1** — a past day. Driven by hand on live app-v88: pill reads `Thu, Oct 1`, and a
`bowel_movement` entry is written at `2026-10-01`. The precondition that exists to stop exactly this
(*"tomorrow was offered and clicked, so the app guard is what is under test"*) reports
`dayClicked=true` and passes.

**The app is fine, and I proved it.** Clicking **Next month** first and picking Nov 1 on `a18098b`:
pill reads `Sun, Nov 1`, toast *"That day has not happened yet."*, **nothing written**. The guard at
`index.html:3126` works; section 4 has simply never exercised it, and on the last day of any month
it reports a healthy app as broken.

**Why it matters.** A false red on a month-end is how a real red gets waved through. It also means
the deleted app-v88 bullet *"A day in the future is refused rather than saved"* was never under test
by that suite — dropping that bullet costs nothing, but nobody knew that.

**Fix.** Navigate the calendar with `button[aria-label="Next month"]` until the target month is
shown, and assert the picked pill actually reads the target date before confirming.

### N3 — MINOR — The README row for app-v89 was never updated, so the detail cut from the entries is not where Rule 0.9 says it is
`README.md:14` is still the row written at `c692f8a`; `git log -- README.md` shows nothing since.
It does not mention the export detail fix, the Help recovery rewrite, the markdown guard, or the
suite growing 30 → 65 (the row still says *"30/30, falsified with eight mutants"*). Rule 0.9's own
instruction is *"check the detail is in the README row first, and move it there if it is not"*, and
`a18098b`'s commit message claims *"Checked each shortened entry against its README row before
cutting it."* For nine entries that holds — I spot-checked app-v85's three-day expiry and found it
in its row. For **app-v89**, the entry whose detail was cut, the detail is not in the README at all;
it lives only in `outputs/` and commit messages. Nothing patient-facing is lost (that bullet stayed),
but the record is incomplete in the one place the rule nominates. **Fix:** bring the app-v89 README
row up to date before the push — which `release_check.sh:385` will want anyway.

### Minors
* **M1** — app-v85's entry is the only one that lost an instruction to act (above). Mitigated by
  permanent Settings copy; consider adding six words back: *"…left alone now, but open a profile
  every few days to keep its reminders going."*
* **M2** — app-v84 and app-v85 carry **one** bullet where Rule 0.9 asks for two to four.
* **M3** — No entry now says a corrected daily answer is **kept** and marked for the clinician.
  Self-documenting in the export (`(corrected later — superseded)`), so informational only.
* **M4** — app-v89 says "report" where app-v88's entry said "the report **and the spreadsheet**".
  Someone who emailed the CSV may not realise it applies to them. Two words.
* **M5** — "in the last few days" replaced "It had been wrong since October 24th". That is seven
  days as of today, and the entry is dated **Oct 26** while the build is still unshipped on Oct 31.
  Date the entry its real ship date and say "since October 24th".
* **M6** — app-v81's bullet names one bug and a different fix (above).
* **M7** — carried over, confirmed identical on both builds, **not a regression**: `nameOf()`
  (`index.html:2642`) has no case for `paracentesis`, so the clinician's Type column reads lowercase
  `paracentesis` while the rest of the app says "Paracentesis".
* **M8** — carried over from delta2/delta3, unchanged: `weightReasonLabel()` returns the raw id for
  an unknown reason (latent, no writer produces one — my first fixture reproduced it with a bad id);
  `exp-printable` says *"the Export section"* where the heading is **Export data**;
  `priv-lost-phone` step 2 prints the full route a second time; the `note` em-dash weld; the
  `profiles` category blurb; the one-child `inline-flex` on the Printable report button.

---

## CHECKED AND CLEAN

* **Suites at `a18098b`, against the md5-verified clean export:** `v89-everything-free` **65/65**,
  `v84-whatsnew` **100/100**, `v87-correct-a-past-day` **64/64**, `v86-logging-and-labels`
  **87/87**, `v85-profile-reminders` **43/43**, `v83-meds-and-reports` **80/80**,
  `v82-timeline` **24/24**, `v81-dose-parser` **227/227**, `v80-up-next` **49/49**,
  `v55-help` **ALL GREEN (120 walkthroughs)**, `v57-search` **53/53 exact, ALL GREEN**,
  `v61-backup` **22/22**, `v63-encrypted-backup` **22/22**. `v75-no-other-patient` **28/29 — FAIL**
  (B1). `v88-log-a-missed-day` **56/58 — false red** (N2).
* **The export, both builds, by hand**, 14 app-shaped rows: the three-type table at the top. Field
  shapes taken from the real writers (`temp`, `radiation_session`, `e.value` for bowel/appetite,
  `weightReason` through `weightReasonLabel`) after a first run with guessed field names produced a
  misleading result — the N4 lesson, which I ran into myself and corrected rather than reported.
* **Rendered, 320 / 360 / 390px**, notice and full list: `scrollWidth === clientWidth` on the page,
  the modal and all ten entry cards; zero `*`, zero backticks, zero stray underscores; ten entries
  reachable from "See recent updates"; no uncaught page errors on any of the eight trees served.
* **Release mechanics:** `APP_VERSION = 'app-v89'` (`index.html:9307`) and
  `CACHE = 'chemowell-app-v89-1'` (`sw.js:1`) move together.
* **Rule 0, other three shapes:** no patient name; no care-plan dose, ceiling or schedule; medication-id
  ratchets 0 outside the resolvers / 0 fallbacks / 0 helpers, all pinned at 0; the fence is gone and
  the legacy migration is gated on a per-medication stamp. Only the pronoun count regressed.
* **Mutants:** five, each a byte copy served on its own port (9421–9425), each md5-verified against
  its own directory before any result was believed. **m2, m3, m4, m5 all reddened as they should;
  m1 survived a fully green board** (N1).
* **Instrument hygiene:** no `git add`/`checkout`/`reset`/`stash` in this repo;
  `git status --porcelain` empty, `HEAD` still `a18098b`; all eight servers killed at the end of the
  pass; only the pre-existing repo server on 8899, which this pass did not start, is left running.

---

## NOT CHECKED — stated so nobody assumes otherwise

* **iOS / Safari rendering.** Chromium only in this sandbox. Standing exemption.
* **The native Capacitor share path**, and real purchases (`TEST_MODE` simulated).
* **`sync-backend/`, `capacitor.config.ts`, `package.json`, `.github/workflows/`**, and `sw.js`
  beyond the `CACHE` constant.
* **`release_check.sh` end to end.** It exits 1 at the chain gate on the real repo (no current
  app-v89 AUDIT/PM pair), and I did not re-run delta3's throwaway-clone simulation; I verified the
  v75 line by reading `release_check.sh:847–860` and running the suite it invokes, which exits 1.
* **Suites not run, for time:** `overflow-scan`, `v58`, `v59`, `v64`, `v67`–`v79`, `v76-*`.
  The builder's own mutants in `1db99ea` were not re-run; I wrote five of my own.
* **The three pre-existing 320px Home overflows.**
* **Whether a real person completes the recovery journey, and how long it takes them.**
* **Whether a reader of the shortened app-v85 entry actually goes to Settings** — I measured that
  the instruction is on that screen, not that anyone finds it.

---

## IF ONLY ONE THING IS FIXED

**B2 — the title.** `Everything is free now` → `Every feature is free now`. It is the only finding in
this pass that a caregiver reads, it is one word, and an app that tells a patient everything is free
and then asks $4.99 for their second relative is the v65 failure with a shorter sentence.

**Then B1**, because the gate will not pass without it: `He is right` → `Aaron is right` at
`index.html:9319`, then `v75-no-other-patient` back to 29/29.

**Then N1**, because it is the reason this sentence took five drafts: fifteen lines in section 7
tying the bullet's named list to the measured export diff. Without it, the next person who shortens
that bullet has nothing standing behind them, and I have now proved a one-word regression of the
original blocker scores 65/65 and 100/100.

**The substance of this release is right and it is materially better than what is live.** app-v88 is
serving a printable report and a CSV that silently drop a radiation session's number, a skin
reaction's severity and site, and a weight's reason, to clinicians. That is fixed, measured, and the
notice describing it is finally accurate. Two words stand between this build and a SHIP, and I would
re-audit them as a delta on those two lines alone.
