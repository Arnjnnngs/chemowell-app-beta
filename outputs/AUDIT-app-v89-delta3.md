AUDITED-COMMIT: f6be11f
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v89, THIRD DELTA PASS

Auditor: Zero Day Auditor (independent). Follows `outputs/AUDIT-app-v89.md` (refused `c692f8a`),
`outputs/AUDIT-app-v89-delta.md` (refused `92b95b1`) and `outputs/AUDIT-app-v89-delta2.md`
(refused `3c25aa9`). This pass covers `git diff 3c25aa9 f6be11f`.

Working tree clean and equal to `f6be11f` (`index.html` md5 `902aec24…`). Every measurement was
taken against a clean `git archive` export of `f6be11f` on **port 9311** and of `origin/main`
(`8a7d696` = live app-v88, md5 `6c24a321…`) on **port 9312**; six mutants on **9321–9326**. Every
port was confirmed free before binding and every server's served bytes were md5-compared with its
own directory before any result was believed. All eight servers were killed at the end of the pass;
only the pre-existing repo server on 8899, which this pass did not start, is still up.

Baselines against the clean HEAD export: `v89-everything-free` **64/64**, `v84-whatsnew`
**100/100**, `v75-no-other-patient` **29/29**.

---

## HEADLINE

**The sentence is on its fourth draft and it still over-claims — this time about symptoms, and the
app's own Help page says so.** The bullet tells every patient that *"radiation sessions and symptoms
came out of the report and the spreadsheet with an empty details column"* and that it is fixed, and
then tells them *"if you sent a care team a report in the last few days that was meant to show
radiation sessions, symptom details or why a weight was taken, it is worth sending a fresh one."*

Measured, through the real logging UI on both builds:

| Logged through the real UI | app-v88 export Detail | app-v89 export Detail |
|---|---|---|
| Nausea | *(empty)* | *(empty)* |
| Fatigue | *(empty)* | *(empty)* |
| Skin Reaction/Rash, Mild, left forearm | *(empty)* | `mild, site: left forearm` |

Only **Skin Reaction/Rash** can carry a severity or a body site at all. `logSymptom` is called from
exactly one place (`index.html:3309`) and it passes `site` and `severity` **only when
`m.symptomType === 'skin_reaction'`**; for the other ten types in `SYMPTOM_TYPES` it passes `''`,
so nothing is stored and nothing was ever lost. The app's own Help already says this in plain
words — `index.html:4158`: *"Other symptoms do not have those two boxes yet — say how bad it was in
the note."*

So a caregiver who logs nausea, fatigue or vomiting reads that their symptom details were missing
and that it is worth re-sending the printout, re-sends it, and sees the identical blank column. That
is the harm this release's own code comment (`index.html:10612`) names as the reason the first draft
of this sentence was a blocker: *"a changelog entry that asked patients to re-send medical paperwork
they did not need to re-send."* Fourth draft, same shape, narrower blast radius.

**Second**, three of the six repairs are guard repairs, and I wrote mutants against all three.
**Two of them still let a previously-refused defect back in at 64/64**, rendered and read as a user
would read it — including blocker **B2**, the one with real consequences, for the second consecutive
pass.

**What is genuinely fixed and proven:** P1. The asterisks are gone from the rendered notice, the
suite is in the gate, and I falsified the gate line in both directions.

---

## P1–P6, item by item

| Item | Verdict |
|---|---|
| **P1** literal `**`, and the missing gate line | **RESOLVED, and falsified both ways.** |
| **P2** "weights … were never affected" | **RESOLVED** as written. The weights clause is now true and measured. The same sentence acquired a new over-claim about symptoms — logged as N1 below, not as P2. |
| **P3** the comment's second failure direction | **RESOLVED.** Verified from the code and measured. |
| **P4** step-order guard indexed the wrong array | **NOT RESOLVED.** Two mutants restore blocker B2 in full at **64/64**, captured rendered. |
| **P5** paid-bullet opener only | **NOT RESOLVED.** A feature sold on the Plus card scores **64/64**; and an innocent bullet now scores a false red. |
| **P6** symptom site / episode count unguarded | **RESOLVED as a mutation detector** (my m4 reddens 7c.2b). **The fixture is a shape the app cannot write**, three ways, and that is why the live gap above went unseen. |
| P7 (minor) appetite fixture `'good'` | **RESOLVED.** `'little'` / `'Little to none'` is exactly what `logAppetite` writes against `APPETITE_LABELS` (`index.html:3915`). |

### P1 — resolved, and this is the part of the release worth keeping

* **Rendered, not grepped.** `chemowell-app-seen-version` set to `app-v88`, notice opened at 320,
  360 and 390px: **zero `*` and zero backticks** in the rendered app-v89 entry at every width, and
  `scrollWidth === clientWidth` at every width (no horizontal overflow). The full rendered text is
  in the appendix below.
* **The suite is in the gate and the gate reaches it.** `release_check.sh:831` now runs
  `test/v84-whatsnew.mjs`. I proved it executes rather than assuming it: in a throwaway copy of the
  repo (`…/scratchpad/audit89d/gate`, its own `.git`, this repo untouched) I added simulated
  `AUDIT-app-v89-*`/`PM-app-v89-*` artifacts naming `f6be11f` and ran the gate. It passed the chain
  gate and printed `v76-properties-equivalence: green`, `v76-empty-window-render: green`,
  `v89-everything-free: green`, **`v84-whatsnew.mjs: green`**, `No-other-patient check: clean`,
  `✅ Release check passed.`
* **Falsified.** In that same copy I restored the two `**` pairs, committed, re-issued the simulated
  artifacts for the new head, and re-ran. The gate served md5 `a807f562` (verified), reached the
  suite loop and **failed**: `❌ RELEASE CHECK FAILED: test/v84-whatsnew.mjs … 100 checks, 98 passed,
  2 failed`. Independently, the suite alone against mutant **m5** (port 9325, md5 `a807f562…`
  verified served) reports **98/100**, both failures naming the string.
* **One caveat, stated rather than scored.** The suite loop sits at line 831, **after** the chain
  gate at 418–755. On the real repo today the gate still exits 1 at that chain gate ("the quality
  chain has not run for app-v89"), so the new line has never executed here. Structurally, the
  markdown guard runs only once an AUDIT **and** a PM report both say SHIP and are current — it
  protects the **push**, not the **audit**, and the defect it was added for was introduced during
  the build. That is M25's ordering, already in `BACKLOG.md`; the line is still the right line.
  **Everything after the chain gate is now measured rather than unknown**: with artifacts present
  the whole gate ran clean, which closes delta2's "not evaluated" note on the post-chain checks.
  (Delta2 listed a "delete ratchet" and a "16px floor" among them; neither string exists in this
  repo's `release_check.sh` — those are care-tracker's `pm.py`. The README version-history check
  does live here, at line 385, **before** the chain gate, and it passes silently on this build.)

### P2 — resolved as written

Measured, clean v88 export against clean HEAD export, entries in exactly the shape the writer at
`index.html:3242` produces:

```
app-v88   Weight | "154 lb"
app-v89   Weight | "154 lb (Steroid medication)"
```

The clause is now true, the reason is a readable label rather than a stored id, and the advice names
the case. Paracentesis is **correctly omitted**: `3.5 L` became `3.5 L drained` and
`Paracentesis removed` became `Removed` under a Type column that already says what the row is — a
word of prose, not a value. I would not add a clause for it.

### P3 — resolved

`SUPERSEDABLE_MED_IDS = new Set(['bowel_movement','appetite'])` and `isSupersededEntry` returns
`false` for everything else (`index.html:11920–11926`), so no dose can ever be superseded; both
superseded types write a `dose` (`3845`, `3939`). Measured on both builds in the same 17-row export:
`"Normal (corrected later — superseded)"` on each. The comment strikes the claim instead of
rewording it, which is the right disposal.

---

## BLOCKER

### N1 — BLOCKER — The What's New notice over-claims the symptom fix, and sends caregivers to re-send printouts that have not changed
**File/line:** `index.html:9320` (CHANGELOG, app-v89, fourth bullet). Contradicted by the app's own
Help at `index.html:4158`. Cause at `index.html:3309` and `index.html:4214–4223`.

**Reproduce (real UI, no fixtures).** Clean export of `f6be11f` on 9311 and of `origin/main` on
9312, both md5-verified. On each: fresh profile, Symptoms tab → **+** → pick the symptom → Confirm,
then `window.__v86Test.exportRows()`.

```
app-v89   Nausea              | ""                              <- unchanged from app-v88
app-v89   Fatigue             | ""                              <- unchanged from app-v88
app-v89   Skin Reaction/Rash  | "mild, site: left forearm"      <- app-v88 printed ""
```

Stored entry for a real nausea log, verbatim from `localStorage`:
`{"medId":"symptom_nausea","symptomType":"nausea","ts":…,"note":"","dose":null,"mg":0}` — no
`severity`, no `site`, no `freq`, because `logSymptom` is only ever passed those for
`skin_reaction`. Ten of the eleven `SYMPTOM_TYPES` cannot carry a detail at all.

**Why it matters to a caregiver.** The notice is the only surface in this product that speaks to the
patient directly, and it is being shown because the last three drafts of this bullet were wrong. A
caregiver logging nausea through chemo reads "symptoms came out with an empty details column", reads
that it is fixed, re-sends a report to an oncology team on the strength of it, and gets back a
column that is still empty. They cannot distinguish "nothing was ever there to lose" from "the app
is still broken", or from "my logs are gone". It is the same cost the code comment at
`index.html:10612` records for the first draft — paperwork re-sent that did not need re-sending —
with a smaller denominator.

**Fix (two clauses, no code).** Name the one symptom that was affected, and say the rest were not:
> *"…radiation sessions came out of the report and the spreadsheet with an empty details column —
> the session number missing — and so did the severity and body site on a **skin reaction**. Other
> symptoms only ever carried the note you typed, and that was never affected. A weight logged with
> a reason kept the weight but lost the reason. …If you sent a care team a report in the last few
> days that was meant to show radiation sessions, **skin-reaction details** or why a weight was
> taken, it is worth sending a fresh one."*

---

## MAJOR

### N2 — MAJOR — P4 is not resolved: blocker B2 walks back in twice more, suite 64/64 both times, rendered
**File/line:** `test/v89-everything-free.mjs:500–520`; topic at `index.html:4204`.

Reading `tp.steps` instead of `[q, a, …steps]` is the right move and it kills delta2's m2/m4. What it
does not fix is that 6b.4/6b.5 pin the position of **three specific literals** —
`turn on **Protect the file with a password**`, `**Save backup file**`, `share screen opens` — so
anything that tells the reader to act in *other* words sorts before them unchecked, and the
imperative regex matches inside a negation.

**Mutant m1** (port 9321, md5 `6bae94e8…`, verified served). One new first step, in the kind of
words a copy edit actually produces. Rendered through the real Help search, the numbered list the
reader obeys now reads:

```
1  Menu → Settings, scroll to Export data, then Backup & restore, and tap the button that saves
   the file. Email it to yourself straight away so it is off this phone.
2  Do this first if the file is going anywhere but this phone … turn on Protect the file with a
   password …
3  … tap Save backup file …
4  Your phone's share screen opens …
```

**64 checks: 64 passed, 0 failed.** `pPassword 1 < pSave 2 < pShare 3`, all green, while step 1 has
already emailed a complete unencrypted medical record. That is blocker B2 in full.

**Mutant m2** (port 9322, md5 `490f78dc…`, verified served). The literal survives inside a negation —
step 1 becomes *"…and **you do not need to** turn on **Protect the file with a password** for a quick
copy."* **64/64**, and Help now actively advises against encrypting a file it says in the next breath
"anyone who opens can read every entry, note and medication in it."

**Why it matters to a caregiver.** B2 is the finding on this release with a real-world consequence:
a complete medical record leaving the phone in plaintext because the numbered list said to send it
before it said to lock it. The guard exists for that one scenario and does not hold it shut.

**Fix.** Stop indexing phrasings and assert the property. Require that **step 1** — `parts[0]`, not
"an index lower than some other index" — contains the encrypt instruction, and that no step before
it matches a send/save predicate (`/\b(save|send|email|share|upload|attach)\b/i`). Then assert the
step containing the imperative does **not** also match `/\b(do not|don't|no need|not necessary|
only if|unless)\b/` within the clause. Both are one line each, and both would redden m1 and m2.

### N3 — MAJOR — P5 is not resolved: a feature is still sellable on a paid card, and innocent copy now reds
**File/line:** `test/v89-everything-free.mjs:365–371`.

**Mutant m3** (port 9323, md5 `32d2393c…`, verified served). One bullet added to the Plus card:
**"Up to 3 people, each with a printable summary for every appointment."** Captured from the real
rendered sheet through Account → View plans, by the suite's own capture code:

```
Plus: ["Up to 3 people",
       "Up to 3 people, each with a printable summary for every appointment",
       "Each person kept completely separate — …",
       "Every feature, for all three"]
```

**64 checks: 64 passed, 0 failed.** The opener matches `up to \d+ people\b`; "printable", "summary"
and "appointment" are in neither `SMUGGLED` nor 5.1's `FEATURE_WORDS`; there is no future tense for
5.3. A feature is being sold on a paid card, which is the one thing Aaron's instruction forbids, and
the suite written for that instruction says nothing.

**And it now produces false reds.** **Mutant m6** (port 9326, md5 `be57e70a…`, verified served)
appends six innocent words to the existing separation bullet — *"…their own reminders, **and no
extra screens to unlock**"*, a sentence whose whole content is that nothing is withheld. **63/64,
5.1b red.** On the question the brief asks directly: *"their own **reports**"* would also red, but
through 5.1's pre-existing `FEATURE_WORDS`, not through this change; the new words that can red
innocent copy are `access`, `screens?`, `email`, `support` and `priority`. Half of `SMUGGLED`
(`reports?`, `backup`, `restore`, `csv`, `export`, `insights?`, `encrypted`) simply duplicates 5.1
over a narrower scope, so the added cost is concentrated exactly in the words that are **not**
features.

**Fix.** Keep the opener, drop the enumerated deny-list, and assert the predicate instead: **every
paid bullet must be about a count of people, or say the features are all included, and must contain
no clause introduced by `and|plus|also|with` that names anything other than people.** Concretely:
require each bullet to match the opener **and** fail if, after the opener, it contains a noun phrase
not drawn from a small people-vocabulary (`person|people|profile|family|relative|patient|caregiver|
feature|separate|medication|history|reminder`). That reds m3 ("summary", "appointment") and passes
m6.

### N4 — MAJOR (instrument) — P6's new fixture is a shape the app cannot write, three ways, and that is why N1 was missed
**File/line:** `test/v89-everything-free.mjs:565`, `test/v89-everything-free.mjs:605–607`.

```js
{ id: 'k10', medId: 'symptom_skin_reaction', severity: 'Mild', site: 'left forearm', freq: 3, … }
t('7c.2b …', /Mild/.test(skin) && /left forearm/.test(skin) && /3 episodes/.test(skin))
```

Measured against the real writer:

1. **The severity casing is wrong.** The chips at `index.html:5721–5723` store `'mild'`, `'moderate'`,
   `'severe'` — lowercase. A real log exports `"mild, site: left forearm"`. The screen capitalises it
   with CSS (`textTransform: 'capitalize'`, `index.html:12253`); the export does not.
2. **`freq` has never been written by this app, in any version.** `git log -S` across the whole
   history finds no writer; the only reads are `index.html:10566` and `index.html:12251`, both
   inherited from the app-v1 seed. The `3 episodes` clause of 7c.2b guards a branch that cannot fire.
   (It also reads `"1 episodes"` if a restored web-app backup ever supplies `freq: 1`, where the
   Symptoms screen says `1 episode` — `index.html:12251` handles the singular, `10566` does not.)
3. **`symptom_nausea` with a `severity`** (fixture `k8`, assertion 7c.2) is a combination the app
   refuses to produce at all, which is the whole of N1.

The guard does bite — **mutant m4** (port 9324, md5 `30dc106c…`, verified served) drops `site` and
`freq` from the branch and 7c.2b goes red, `63/64` — so this is not a check that cannot fail. It is
a check that cannot fail **about a program this is not**. Delta2's P7 said in as many words that
"adding a field the app writes does not make a fixture app-shaped if the value is one the app cannot
produce"; the commit applied that to the appetite fixture and then wrote three new violations of it
into the fixture created to answer P6.

**Fix.** Seed `severity: 'mild'`, drop `freq` entirely, assert the exact string
`'mild, site: left forearm'`, and add one fixture the suite does not have: a **nausea** entry written
the way `logSymptom` writes one, asserted to export an **empty** Detail — so the suite states out
loud what the changelog has to say.

---

## MINOR

* **`nameOf()` has no case for `paracentesis`, so the clinician's report prints the raw id.**
  `index.html:2642` handles twelve ids and not this one, so every drain's Type column reads
  lowercase `paracentesis` while the rest of the app says "Paracentesis". Measured identical on v88
  and HEAD, so it is **not a regression** — but it is the same defect class as 7c.3, which this
  release fixed one column to the right, in the same row, in the same function's output.
* **Nothing in the repo ties the changelog's claims to `buildExportRows()`'s measured behaviour.**
  Four drafts of one sentence, three refusals, and the only instrument that has ever caught it is an
  auditor exporting both builds by hand. A ten-line section — seed one entry of every kind, export
  on this build, and require the bullet's "never affected" list to name exactly the types whose
  Detail is byte-identical to the previous release's — is the check this release is missing.
* **The `helpSteps` hook is inert**, confirmed: it is a property of the already-shipped
  `window.__v86Test`, guarded by `typeof window !== 'undefined'`, and
  `helpAllTopics()` is `HELP_TOPICS.concat(helpFaqTopics())` with `.map(String)` over a copy. It
  reads, returns, and touches no state. A topic with no `steps` yields `[]`, which 6b.3b catches
  (`parts.length >= 4`); an imperative appearing twice takes the earlier index, which is the reader's
  experience and is correct.
* Carried over unchanged from delta2: `weightReasonLabel()` returns the raw id for an unknown reason
  (`index.html:4012`, latent — no writer produces one); `exp-printable`'s answer line still says
  *"the Export section"* where the heading is **Export data** (`index.html:4183`); `priv-lost-phone`
  step 2 prints the full route a second time; the `note`'s em-dash weld; the `profiles` category
  blurb; the one-child `inline-flex` on the Printable report button.

---

## CHECKED AND CLEAN

* **`buildExportRows()` has no regression.** Seventeen rows, one of every shape the chain has an arm
  for — temp, BP, weight plain / with a reason / with an unknown reason, paracentesis, cancelled
  paracentesis, radiation, bowel, appetite, nausea, skin reaction, `cycle_start`, `inpatient_start`,
  a plain dose, a dose with a pain level, and a superseded bowel pair — driven on both builds
  through `window.__v86Test.exportRows()`. **No row is worse under this build than under app-v88**,
  and four are better. `cycle_start`/`cycle_end`/`inpatient_*` all write `dose: null`
  (`index.html:3491–3492`, `4295`, `4300`), so the branch that sets `detail = ''` loses nothing the
  v88 `else` would have printed — checked, because that is the one direction in which moving the
  `if (superseded)` could have *taken* something away.
* **Help has no regression.** `priv-lost-phone` opened through the real Help search on a cold
  first-run profile: five numbered steps, encrypt first, no literal markdown, no overflow at 390px.
  The only change to Help in this delta is the read-only hook.
* **Rule 0.** `test/v75-no-other-patient.mjs` **29/29** against the clean HEAD export. No patient
  name; pronoun ratchet 32 found / 32 allowed, so the new comments and the new hook add none; no
  care-plan dose, ceiling or schedule; nothing in the diff keyed to a medication id.
* **Release mechanics.** `APP_VERSION = 'app-v89'` (`index.html:9307`) and
  `CACHE = 'chemowell-app-v89-1'` (`sw.js:1`) moved together. The README version-history check
  (`release_check.sh:385`) passes. No uncaught page errors in any run, on any of the eight trees
  served.
* **The notice fits.** 320, 360 and 390px: `scrollWidth === clientWidth` on both the page and the
  modal, zero asterisks, zero backticks.
* **Instrument hygiene.** Eight servers, all on 9311–9326, all confirmed free before binding, all
  md5-verified against their own directory before any result was believed, all killed at the end of
  the pass (`ps` shows only the pre-existing 8899 this pass did not start). No tracked file in this
  repo was modified other than this report: `git status --porcelain` is empty and `HEAD` is still
  `f6be11f`. The gate simulation ran in a throwaway `cp -a` copy with its own `.git`; no `git add`,
  `checkout`, `reset` or `stash` was run in this repo.

---

## NOT CHECKED — stated so nobody assumes otherwise

* **iOS / Safari rendering.** Chromium only in this sandbox. Standing exemption.
* **The native Capacitor share path**, and real purchases (`TEST_MODE` simulated).
* **`sync-backend/`, `capacitor.config.ts`, `package.json`, `.github/workflows/`**, and `sw.js`
  beyond the `CACHE` constant.
* **The builder's own four mutants in `f6be11f`** — not re-run. I wrote six of my own (m1–m6);
  **three survived** (m1, m2, m3), two reddened as they should (m4, m5), one proved a false red (m6).
* Suites not run, for time: `v55-help`, `v57-search`, `v61-backup`, `v63-encrypted-backup`,
  `overflow-scan`, `v79`–`v88` other than `v84-whatsnew`. `v76-*` ran inside the gate simulation.
* The three pre-existing 320px Home overflows.
* Whether a real person completes the recovery journey, and how long it takes them.
* Whether any live user's stored data contains a `freq` field from a restored web-app backup.

---

## IF ONLY ONE THING IS FIXED

**N1 — the two clauses in the changelog bullet.** It is the fourth draft of one sentence, it is the
only thing in this release a patient reads, and it is the only finding here that reaches a caregiver
rather than a future maintainer. Name the skin reaction, say the other symptoms were never affected,
and narrow the re-send advice to match. It is thirty words and no code.

**Then N2.** The shipped Help is correct today; the guard that is supposed to keep it correct is not.
B2 is the finding on this release with a real consequence, and it has now walked back in under a
green board in two consecutive passes.

---

## APPENDIX — the app-v89 entry, read rendered at 390px

> **Every feature is free** · Oct 26, 2026
>
> The printable doctor's report used to cost $4.99. It does not any more. It was the only feature in
> ChemoWell you had to pay for, and charging for a tidy printout of your own records — the one you
> take to an appointment — was the wrong call.
>
> Backup and restore is free too, and always was. The plans screen said otherwise, which was simply
> wrong, and it has been corrected.
>
> Paying now adds one thing only: more people to look after. One person is free forever, with
> nothing held back and nothing that expires. Plus covers three, Pro as many as you need.
>
> Also fixed, found while making the report free: radiation sessions and symptoms came out of the
> report and the spreadsheet with an empty details column — the session number missing, and the
> severity or body site missing from a symptom. A weight logged with a reason kept the weight but
> lost the reason. Doses, temperatures, blood pressures and the daily bowel and appetite answers
> were never affected. It had been wrong since October 24th. If you sent a care team a report in the
> last few days that was meant to show radiation sessions, symptom details or why a weight was
> taken, it is worth sending a fresh one.
>
> If you saved a backup file, your records come back onto a new phone. The help page said that
> feature had not been built yet. It had. That page now tells you how to save one, how to put a
> password on it, and how to get everything onto a new phone.
