AUDITED-COMMIT: 92b95b1
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v89, DELTA PASS

Auditor: Zero Day Auditor (independent). Previous pass: `outputs/AUDIT-app-v89.md`, which refused
`c692f8a`. This pass covers `c692f8a..92b95b1` — the five commits of fixes, plus the changelog
bullet committed as `92b95b1` while this audit was running (the builder flagged it mid-run and
asked for it to be in scope; it is).

Baseline: `test/v89-everything-free.mjs` **58/58**, `test/v75-no-other-patient.mjs` **29/29**,
both against the serving file, md5-verified. Working tree is clean and equal to `92b95b1`
(`index.html` md5 `7890d090…`), which is the byte-for-byte content every measurement below used.

---

## HEADLINE

**The changelog bullet added in `92b95b1` is not true, and it asks caregivers to act on it.** It
tells every user that the report and the CSV printed *"WHEN a temperature, blood pressure, weight,
drain or daily answer was recorded — but not the reading itself. The value column came out blank"*,
and that anyone who handed a printout or spreadsheet to a care team in the last few days should
**send a fresh one**.

Measured against a clean `git archive` export of `origin/main` — app-v88, the build actually live —
seeded with entries shaped exactly as the shipped app writes them:

| Entry type | app-v88 (live) Detail | app-v89 Detail | Was it blank? |
|---|---|---|---|
| Temperature | `99.1 °F` | `99.1 °F` | **No — unchanged** |
| Blood Pressure | `120/80 mmHg` | `120/80 mmHg` | **No — unchanged** |
| Bowel Movement | `Normal` | `Normal` | **No — unchanged** |
| Appetite | `good` | `good` | **No — unchanged** |
| Weight | `150 lb` | `150 lb (fluid_retention)` | No — lost only the reason suffix |
| Paracentesis | `3.5 L` | `3.5 L drained` | No — lost only the word "drained" |
| Radiation Session | *(empty)* | `Session 1` | **YES** |
| Symptom (Nausea) | *(empty)* | `Moderate` | **YES** |

**Four of the five categories the bullet names were never blank. The two that genuinely were blank
— radiation sessions and symptom severity — are the two the bullet does not mention.**

The reason is one line of the app's own data model: every one of those types is written *with* a
`dose` string — `index.html:3205` (temp), `:3086` (BP), `:3242`/`:3759` (weight), `:3228`
(paracentesis), `:3845` (bowel), `:3939` (appetite). The broken `else { detail = e.dose || ''; }`
therefore overwrote the chain's value with an **identical** string. Only `radiation_session`
(`:3329`, `:3488`) and `symptom_*` (`:4215`) are written `dose: null`, and only those two lost
their value.

This is a false statement printed to patients that generates real-world work and worry — re-sending
medical paperwork to a care team — on a premise that does not hold, while failing to warn the
people whose rows actually were blank. Rule 2.7, question 1.

The same overstatement is now baked into the permanent record: the 18-line code comment at
`index.html:10587–10604`, the commit message of `45ce084`, and the falsification table in `e0cb33e`
("N1 … 5 red, naming every affected type: Temperature, Blood Pressure, Weight, paracentesis,
Radiation Session, Bowel Movement, Appetite, Nausea").

**The fix itself is correct and worth shipping.** It is the description of it that is wrong.

---

## B1, B2, M1–M5, A9–A12 — item by item

| Item | Verdict |
|---|---|
| **B1** recovery step does not exist | **Resolved in substance.** Read rendered: step 4 now reads *"On a new phone: install ChemoWell and **set it up with any name first**. The welcome screen comes before everything else and there is no menu until it is done."* **Guard is weak — see N5.** |
| **B2** password printed after the share | **Resolved in substance.** Rendered step 1 is the password step; step 3 is the share. **Guard is weak — see N4.** New side-effect — see N8. |
| **M1** changelog promise before condition | **Resolved.** *"If you saved a backup file, your records come back onto a new phone."* |
| **M2** "the only thing you had to pay for" | **Resolved.** Now "the only **feature**". |
| **M3** Help routes via "Export" | **ONLY PARTIALLY RESOLVED.** `exp-printable` and `priv-lost-phone` fixed; **`exp-csv` still says "Find \*\*Export\*\*."** — see N7. |
| **M4** "ring" | **Resolved.** Rendered: *"there is no one to call who can restore it for you."* |
| **M5** suite not in the gate | **Resolved.** `test/v89-everything-free.mjs` is in `release_check.sh`'s suite list. |
| **A9** second Add-profile button | **Closed.** Section 3 walks both `account` and `settings` surfaces, 8 cases. |
| **A10** Plus regains feature bullets | **ONLY PARTIALLY CLOSED.** 5.1b added, and my mutant C walks straight through it — see N6. |
| **A11** report trimmed to last 3 rows | **Closed.** 1.3b/1.3c assert the whole record and all three day headings. |
| **A12** prices swapped | **Closed.** 4.2b binds each price to its own card, smallest-node selection. |

Previous-pass minors: section 2's missing `await c.close()` is **fixed** (8 closes). The "SHEET
captured in section 4" concern is **partially addressed** — 5.0 now also asserts `CARDS.Free/Plus/Pro`.
`exp-printable`'s `"plus"` keyword and `pro-plans` relation are **fixed**. The `profiles` category
blurb and the one-child `inline-flex` button are **still open** (minors below).

---

## NEW FINDINGS

### N1 — BLOCKER — The changelog bullet is false and asks caregivers to act on it
**File/line:** `index.html:9320` (CHANGELOG, app-v89, fifth bullet).
**Reproduce:** set `chemowell-app-seen-version` to `app-v88`, load the app, read the "UPDATED /
Every feature is free" notice. Rendered text captured; no literal `**` or backticks (that class is
not repeated). Then run the comparison in the HEADLINE table — a clean export of `origin/main` on
one port, `92b95b1` on another, seeded with app-shaped entries, reading
`window.__v86Test.exportRows()`.
**Why it matters to a caregiver:** it tells them a temperature, a blood pressure and a daily answer
came out blank when they did not, and on that basis tells them to re-send paperwork to a care team.
It is the one surface that speaks to the patient directly, saying something measurably untrue about
their medical records. And the people who really do have blank rows — radiation sessions and
symptom severities — are not told.
**Fix:** name what was actually affected. Something like: *"Radiation sessions and symptom entries
printed without their detail — the session number and the severity were missing from the report and
the CSV. Weight entries left out the reason, and drains left out the word 'drained'. Fixed. If you
handed over a report that included radiation sessions or symptoms since October 24th, it is worth
sending a fresh one."*

Two smaller things in the same bullet: **"A bigger one"** has no antecedent — the three bullets
above it are about price, not defects — and **"WHEN"** in capitals is shouting at a patient.
The date *"since October 24th"* **is correct**: app-v86's changelog date is `Oct 24, 2026`
(`index.html:9338`), and `0f73911` is Oct 25 01:20 UTC, i.e. Oct 24 evening in US time.

### N2 — MAJOR — The fix newly prints raw internal ids into the doctor's report
**File/line:** `index.html:10555` (the `weight` branch), reachable because the fix restored the suffix.
**Measured:**

```
app-v88 (live)  Weight | DETAIL="150 lb"                      DETAIL="148 lb"
app-v89 (fixed) Weight | DETAIL="150 lb (fluid_retention)"    DETAIL="148 lb (nausea_vomiting)"
```

The branch does `detail += ' (' + e.weightReason + …)` — the **raw id**, not
`weightReasonLabel(e.weightReason)`, which sits 6,500 lines above at `index.html:4012` and is what
every other surface uses (e.g. `:12579`). In v86–v88 the suffix was suppressed by the defect, so
nobody saw it. **This release is what makes it visible**, in a document handed to a clinician:
`nausea_vomiting` and `fluid_retention` under a weight reading.
**Why it matters:** the Voice's standard is a caregiver-facing string a tired person reads. A
clinician reading `(nausea_vomiting)` is reading a database key. One-word fix:
`weightReasonLabel(e.weightReason)`.
**Not covered by any check** — section 7's weight fixture (`k3`) carries no `weightReason`.

### N3 — MAJOR — Section 7's fixtures do not match any entry the app writes
**File/line:** `test/v89-everything-free.mjs:502–510`.
All nine fixtures omit `dose`. The app always writes it. The section therefore proved the fix
against a shape the app never produces, and the N1 mutant's red ("naming every affected type:
Temperature, Blood Pressure, … Bowel Movement, Appetite") measured the fixtures, not the app. **This
is why the impact was mis-stated, and therefore the root cause of N1.**
**Fix:** add `dose` to each fixture exactly as the write sites produce it, and keep a second,
dose-less set if the stricter shape is also wanted — they test different things and both are worth
having.

### N4 — MAJOR — Mutant D: blocker B2 walks back in, suite green
**Mutant (byte copy, own port 8964, md5-verified against its own tree before use):** make step 1 a
passive mention and move the instruction to the end —

```
1  There is an option called Protect the file with a password on this screen.
   Menu → Settings, scroll to Export data, then Backup & restore.
2  Tap Save backup file …
3  Your phone's share screen opens. Send it to yourself, or put it in Drive or Files …
5  Turn on Protect the file with a password if you are sending it anywhere.
```

**Result: 58/58, 0 failed.** Rendered and confirmed to reach the browser (step list captured above).
6b.4 and 6b.5 compare `txt.search(/Protect the file with a password/)` against the save and share
positions — the **first occurrence**, which is now the passive mention. The reader is still told to
email an unencrypted medical record and only afterwards to encrypt it. **The guard written for the
blocker does not hold the blocker shut.**
**Fix:** assert on the step the instruction is *in* — e.g. require that `steps[0]` contains both
"Protect the file with a password" and an imperative ("turn on"), rather than comparing indices in
a JSON serialisation of the whole topic.

### N5 — MAJOR — Mutant B: B1's guard is satisfied by a word, not an instruction
**Mutant (port 8962, md5-verified):** step 4 becomes *"On a new phone: install ChemoWell. The
welcome screen comes before everything else. Then menu → Settings → Export data → Restore from a
backup, and pick your file."* — the actionable clause "set it up with any name first" deleted.
**Result: 58/58, 0 failed.** 6b.2 searches `/set it up|set up with any name|welcome screen/i`, and
"welcome screen" still matches. The panicking reader is told the obstacle exists and not what to do
about it — which is most of B1 back again.

### N6 — MAJOR — Mutant C: A10 is still open, now through 5.1b
**Mutant (port 8963, md5-verified):** add the bullet **"Priority help by email for all 3 people"**
to the Plus card.
**Result: 58/58, 0 failed.** Rendered plans sheet confirms the bullet is on the card. 5.1's
deny-list has no matching word; 5.1b's `ABOUT_PEOPLE = /\b(people|person|profiles?|patients?|
relatives)\b|every feature/i` matches on "people". **5.1b passes any bullet that merely *mentions*
people, which is not the same as a bullet that is *about how many*.** The release's own commit
message calls 5.1b "the claim that actually holds"; it does not.
**Fix:** an allow-list of whole bullet shapes, or require the bullet to contain a count
(`/\b(up to \d+|as many|\d+) (people|person)/i`) or the literal "Every feature, for".

### N7 — MAJOR — M3 fixed in two places of three
**File/line:** `index.html:4181`, `exp-csv` step 2: **"Find \*\*Export\*\*."** The section heading
is `EXPORT DATA`. This is the identical defect M3 named, in the single most-used export topic
("How do I get everything out of the app?"). Check 6.6 only requires the heading to *exist*; it
never requires Help to name it correctly, so nothing sees this.
**Fix:** the one-word edit, and widen 6.6 to assert that no Help step routes via a bare "Export".

### N8 — MAJOR — The only navigation in `priv-lost-phone` sits inside a conditional step
**Rendered step 1:** *"**Do this first if the file is going anywhere but this phone** — email,
Drive, a shared folder. Menu → **Settings**, scroll to **Export data**, then **Backup & restore**,
and turn on **Protect the file with a password**…"*
**Step 2:** *"**In that same place**, tap **Save backup file**…"*

A reader who decides the condition does not apply to them skips step 1 — and step 2's "in that same
place" then has no antecedent, because the route to the screen exists **only** inside the step they
skipped. B2's fix created this by folding the navigation into the password step. (The condition is
in practice always true for this topic — a backup that never leaves the phone is useless when the
phone is lost — which makes the "if" misleading as well as structurally wrong.)
**Fix:** step 1 = unconditional navigation; step 2 = the password, with its "if you are sending it
anywhere" framing; step 3 = save.

---

## MINOR (still open)

* **The `note` welds two unrelated paragraphs with an em dash.** Rendered under "WORTH KNOWING":
  *"…keeps the name you typed a minute ago. **—** **Download CSV** is a different thing…"*. Two
  topics, one run-on block, in the box a panicking reader is most likely to skim.
* **`priv-lost-phone` gives two different routes to one screen.** Step 1: Settings → Export data →
  Backup & restore. Step 4: Settings → Export data → Restore from a backup, with the
  "Backup & restore" level dropped.
* **The "surprise" the note warns about is one the app already avoids.** Measured: with a backup
  whose name differs from the current profile, `cwBkAcceptParsed()` (`index.html:344`) preselects
  **"Put it in a new profile"**. The note is accurate, but it asks the reader to make a choice that
  has already been made correctly for them — cognitive load on the panic path.
* `HELP_CATEGORIES` `profiles` blurb still *"More than one person, and what Plus and Pro add"*
  (`index.html:4074`). Carried over from the previous pass.
* `renderExportSection()`'s Printable report button keeps `display:'inline-flex'` and `gap:'7px'`
  with one child (`index.html:10974`). Carried over.
* `release_check.sh` **stops early** on the quality chain, so every check after it — the delete
  ratchet, the 16px floor, the README row check — did not run and is unevaluated. This is already
  logged as M25; it is live on this release and worth saying out loud rather than assuming the rest
  of the gate is green.

---

## CHECKED AND CLEAN

**The `buildExportRows()` fix is correct for every branch.** Read line by line and driven with one
entry of every shape the chain has an arm for, plus `cycle_start` and `inpatient_start`. The
suffix now decorates a detail that has already been decided, so it runs after every branch:
temp, blood_pressure, weight (incl. `weightNote` → the Note column, which the defect never touched),
paracentesis (incl. the `cancelled` tombstone → "Removed"), radiation_session, bowel_movement,
appetite, `symptom_*`, the cycle/inpatient `''` arm, and the trailing `else` with its `e.pills`
fallback, `painLevel` and `overrideReason`. **No entry shape is worse under the new ordering than
the old**; the only new visible string is N2's raw reason id. Both consumers exercised — the CSV
path and `openPrintReport()` share this one function.

**The claim that it was live in app-v88 is TRUE.** `git show origin/main:index.html` line 10562 has
`if (superseded) detail = …` sitting above the `else`, with `APP_VERSION = 'app-v88'` at line 9310.
Introduced by `0f73911` (`git log -S` confirms a single commit).

**Help's name-precedence claim is TRUE, verified by a real restore** through the real file picker
(`setInputFiles` on the app's own hidden input, then the real **Restore** button), not by reading
`cwBkApplyTo()`:

```
restore "Add it to Bob"          -> profiles ["Bob"],         name stays Bob
restore "Put it in a new profile"-> profiles ["Bob","Alex"],  opens Alex, name restored
```

`cwBkApplyTo()` merges prefs as `Object.assign({}, bundle.prefs, cur)` (`index.html:626`), so the
local value wins. **"Put it in a new profile"** is the exact rendered label (`index.html:11127`).

**Every control name Help prints exists, in both toggle states.** Read rendered, not from source:
EXPORT DATA / Download CSV / Printable report / BACKUP & RESTORE / **Save backup file** (password
off) / **Save protected backup** (password on) / Restore from a backup / Protect the file with a
password. All four rewritten topics opened in a browser: **zero literal `**` or backticks**.

**Rule 0.** `test/v75-no-other-patient.mjs` 29/29. No patient name; pronoun ratchet 32 found / 32
allowed (the new bullet adds none); no care-plan dose, ceiling or schedule; the diff adds no
behaviour keyed to a medication id.

**Release mechanics.** `APP_VERSION = 'app-v89'` (`:9307`) and `CACHE = 'chemowell-app-v89-1'`
(`sw.js:1`) moved together. No `h()` null-attribute trap introduced. No uncaught page errors in any
run (check 8.1, plus a `pageerror` listener on every context I opened).

**An instrument failure of my own, caught by the md5 rule.** My first four mutant servers reported
md5s that did not match their own files. Cause: **38 `http.server` processes from the builder's
earlier falsification rounds were still listening on 8891–8928**, so my servers never bound and
every request was answered by someone else's tree. Had I trusted the first run I would have recorded
four more escapes that were not mine to claim. Ports 8961–8965 were verified free, then
byte-verified, before any mutant result below was believed. **This is the fourth instrument failure
of this release.** Worth a line in `TEAM.md`: the habit should be *bind to a port nothing else is
on and prove it with `/proc/<pid>/cwd`*, not only *compare md5 afterwards* — the md5 check tells you
something is wrong, the cwd check tells you what.

---

## NOT CHECKED — stated so nobody assumes otherwise

* **iOS / Safari rendering.** Chromium only in this sandbox. Standing exemption on every release.
* **The native Capacitor share path.** Browser fallback only.
* **Real purchases.** `TEST_MODE` simulated; no Play Billing or App Store path exists yet.
* **`sync-backend/`, `capacitor.config.ts`, `package.json`, `.github/workflows/`.**
* **`sw.js` beyond the `CACHE` constant.**
* **Everything in `release_check.sh` after its early stop** — the delete ratchet, the 16px floor,
  the README-row check and the rest did not run.
* **The builder's own eight mutants in `e0cb33e`** — not re-run. I wrote four of my own instead,
  which is the cross-check Rule 2 asks for; four survived.
* **The Designer's 320 / 360 / 390 re-measure in `2eca332`** — not independently re-measured. The
  copy added since (N1's bullet) lengthens the What's New notice and was not measured at 320px.
* Suites not run, for time: `v76-*`, `v55-help`, `v57-search`, `v61-backup`, `v63-encrypted-backup`,
  `v84-whatsnew`, `overflow-scan`, `v79`–`v88`.
* **Whether a real person completes the recovery journey**, and how long it takes them.
* The three pre-existing 320px Home overflows.

No tracked file was modified by this audit other than this report.

---

## IF ONLY ONE THING IS FIXED

**N1.** Everything else on this page costs a reader seconds, or costs a future session a wrong
belief. N1 is the app telling a patient, in the only voice it has, that their medical records came
out blank when they did not — and asking them to go and re-send paperwork to a care team because of
it. It is a one-sentence fix, and the sentence that replaces it should name radiation sessions and
symptoms, which is who it actually happened to.
