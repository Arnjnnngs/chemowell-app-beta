# Zero Day Auditor — app-v52.2 (re-gate)

**Date:** 2026-08-09 · **Commit under test:** `4c1830b` ("app-v52.2: all four Designer must-fixes plus Auditor V52-5") · working tree clean, so the code tested is byte-identical to what would ship.
**Method:** every case below was driven by the Auditor against the running product (Playwright + Chromium over `python3 -m http.server`), on **five wiped installs across all four profile types**, with **every medication created and every dose, temperature and radiation session logged through the real UI**. Primary viewport **390 × 844**, with the whole export/edge pass re-run at **360 × 800**. `TEST_MODE` date override used to walk calendar days. Plus a line-by-line read of `git diff HEAD~2 -- index.html sw.js` and its blast radius.
**Scale:** 95 test cases · 5 profiles (chemo, radiation-only, both, Other, plus a units profile) · 24 medications created by hand · 4 full 10-step guided tours · CSV downloaded and read off disk · printable doctor report opened and read · **zero console errors in every session**.
**Harness:** `test/audit-v52-2-lib.mjs` + `audit-v52-2-{chemo,radiation,other,history,units-edge,tours,extras}.mjs`.

---

## VERDICT

**Is app-v52.2 safe to ship? — YES.** Every one of the five findings that blocked v52 (V52-1 … V52-5) is genuinely fixed, verified live, on the exact repros that produced them. All four Designer must-fixes (D-1 … D-4) render correctly. I could not find a single regression anywhere in the blast radius, no data is at risk, and there were zero console errors across ~50 browser sessions. Shipping this is strictly better than v52 and v51 for every user on every path I could reach.

**Is it complete against what Aaron asked for? — Not quite: one Medium.** Aaron's instruction was *"the whole near treatment and exclude shouldn't be there at all for them."* The mode picker is gone for "Other" profiles, and any saved restriction is correctly inert — but the **"Days before" / "Days after" fields and the "Active window: 2 days before through 1 day after your date." summary still render** in the editor for an Other profile whose medication carries a restriction saved by the previous build (finding **V52.2-1**, `index.html:4922`). The user sees an orphaned pair of controls describing a rule the app is deliberately ignoring, with no picker above them to switch it off. That is the requirement's own words not fully met, and it is exactly the "part of it, not all of it" pattern V52-1 was raised for last round.

**My recommendation to the PM:** this is a one-line gate on an existing block (`isOtherTreatmentType() ? null :`, same guard already used 12 lines above), it changes no data path, and everything else in this release is verified clean. I'd treat it as a targeted fix + spot-check re-verify rather than a full restart — but per TEAM.md that tier call is the PM's, not mine. What it must **not** be is reported to Aaron as "near-treatment and exclude are gone for Other profiles," because for an upgrading Other profile half of it is still on screen.

Three pre-existing LOWs from `AUDIT_v52.md` (V52-8, V52-9, V52-10) are untouched and still open. Three further LOWs are new observations below.

---

## The defect class you asked me to re-check: is there any remaining path that treats "no date" as "outside the window"?

**No. Verified exhaustively, at source and live.** `treatmentActiveOn()` — the function that conflates the two — is now called from exactly **two** places in the whole file: inside `treatmentOnlyBlocks()` (which guards on `hasTreatmentDate()` first) and inside `treatmentExcludedNow()` (where returning "not excluded" with no date is the correct, safe direction). Every gate routes through `treatmentOnlyBlocks()` — **10 call sites**, including the notification-scheduling one that the first sweep missed (`index.html:6911`, reached from `buildReminderPlan` at `:6938`).

| # | Gate | Where | Result | Observed |
|---|---|---|---|---|
| XT-7 | Source sweep for surviving raw gates | `index.html:1016, 1040, 1046` | **PASS** | `treatmentActiveOn(` appears 3× total: its own definition + `treatmentOnlyBlocks` + `treatmentExcludedNow`. `treatmentOnlyBlocks(` = **10 call sites** |
| CH-2 | Standalone Quick-log card, no date | `:3854` | **PASS** | `Dexamethasone 4 · Decadron · No date set · No doses logged · Showing every day until you set a treatment date. · 4 mg` |
| CH-7 | **Grouped** card, no date (the V52-1 repro) | `:2519, 2540` | **PASS** | `MORNING MEDS · Take all (2) · Magic Mouthwash · Log · Filgrastim · Neupogen · Log` — no "Outside its treatment-day window" anywhere on the screen |
| CH-9 | Dose ring denominator (V52-2) | `:1159` | **PASS** | ring `aria-label` = **"0 of 5 scheduled doses logged today"** — all 5 windows Home is showing are counted |
| CH-16 | Ring numerator moves when logged | `:1159` | **PASS** | after one dose: **"1 of 4 scheduled doses logged today"** |
| CH-8 | "Course complete" with no date (V52-4) | `:1307` | **PASS** | phrase absent from Home entirely |
| HI-6 | Missed-dose tracking (V52-3) | `:1111` | **PASS** | `Prochlorperazine` (only-mode, no date) is listed as MISSED in History — v52 showed the card but never tracked it |
| — | Reminders / notification plan | `:6670`, `:6911` | **PASS (code)** | both now route through `treatmentOnlyBlocks`. Real OS delivery is not browser-reachable (named under "Not verifiable" below); the live-reproduced `missedDosesFor` sibling is the behavioural proof the predicate is right |

---

## Aaron's standing brief — real medications per illness, real logged doses, windows walked day by day

### Chemo profile (`Nora`) — 5 chemo-adjacent medications, entered by hand

`Ondansetron 8 mg` (as-needed, 8 h gap, 24 mg/day limit) · `Magic Mouthwash 1 application` (scheduled 08:00 + 20:00, **Morning group**) · `Dexamethasone 4 mg` (scheduled 09:00, **Only near treatment day −1/+2**) · `Filgrastim 300 mcg` (scheduled 10:00, **Only near treatment day 0/+3, Morning group**) · `Multivitamin 1 tab` (scheduled 12:00, **Excluded near treatment day −1/+1**).

| # | Case | Result | Observed on screen |
|---|---|---|---|
| CH-1 | All five save with correct chips | **PASS** | Meds list chips: `Treatment day −1/+2` · `Treatment day −0/+3` · `Excluded near treatment −1/+1` |
| CH-3 | D-2 amber chip replaces green Available | **PASS** | `Dexamethasone 4 · Decadron · **No date set** · No doses logged` |
| CH-4 | D-2 caption present, once | **PASS** | `Showing every day until you set a treatment date.` — 1 occurrence |
| CH-5 | Chip NOT on an unrestricted med | **PASS** | `Ondansetron · Zofran · ✓Available · No doses logged` |
| CH-6 | Chip NOT on an excluded-mode med | **PASS** | `Multivitamin · with iron · ✓Available · No doses logged · 1 tab` |
| CH-10 | Treatment date accepted | **PASS** | `TREATMENT SCHEDULE · Thursday, 8/20 · in 11 days · Clear` |
| CH-11 | Chip + caption vanish once a date exists | **PASS** | both gone |
| **CH-12** | **Only-mode −1/+2 walked across the full window** | **PASS — exact, no off-by-one** | 8/17 hidden · 8/18 hidden · **8/19 shown** · 8/20 shown · 8/21 shown · **8/22 shown** · 8/23 hidden · 8/24 hidden |
| **CH-13** | **Grouped only-mode 0/+3 walked** | **PASS — exact** | 8/17–8/19 inert row · **8/20 loggable** · 8/21 · 8/22 · **8/23 loggable** · 8/24 back to inert |
| **CH-14** | **Excluded −1/+1 walked** | **PASS — exact** | normal 8/17, 8/18 · **inert 8/19, 8/20, 8/21** · normal 8/22, 8/23, 8/24 |
| CH-15 | Real doses log on treatment day | **PASS** | Journal: `EVENING · 8:31 PM · Dexamethasone 4 · 4 mg · Remove` / `8:31 PM · Ondansetron · 8 mg` |
| CH-17 | Console errors | **PASS — zero** | none |

### Radiation-only profile (`Ray`) — radiation-appropriate medications

`Aquaphor 1 application` (as-needed barrier cream, 4 h gap) · `Salt & Soda Rinse` (scheduled 08:00/13:00/19:00, Evening group) · `Ondansetron 8 mg` (scheduled 07:30, **Only near treatment day −1/+1**) · `Silver Sulfadiazine 1 application` (scheduled 21:00, **Excluded near treatment day 0/0**).

| # | Case | Result | Observed |
|---|---|---|---|
| RA-1 | Default cards | **PASS** | `TEMPERATURE, WEIGHT, BLOOD PRESSURE, RADIATION SESSIONS` — no chemo countdown |
| RA-2 | **D-1** shortened Settings helper | **PASS** | `Treatment schedule card — Treatment date, countdown, and reminders on Home.` (the old "Turn this on if any medication…" sentence is gone) |
| RA-3 | Toggle exists, defaults OFF | **PASS** | `aria-pressed=false` |
| RA-4 | Only-mode med visible with no date | **PASS** | `Ondansetron · Zofran · No date set · No doses logged · Showing every day until you set a treatment date. · 8 mg` |
| RA-11 | A date really can be set from radiation-only | **PASS** | `TREATMENT SCHEDULE · Friday, 8/14 · in 5 days · Clear` |
| **RA-12** | Only-mode −1/+1 walked | **PASS — exact** | 8/12 hidden · **8/13, 8/14, 8/15 shown** · 8/16 hidden |
| **RA-13** | Excluded 0/0 walked | **PASS — exact** | inert **only** on 8/14; normal 8/12, 8/13, 8/15, 8/16 |
| RA-14 | Session + dose both log | **PASS** | `RADIATION SESSIONS · Session 1 · ✓ Today's session logged (8:37 PM)` + `Ondansetron 8 mg` in the journal |
| RA-15 | Console errors | **PASS — zero** | none |

### Both profile (`Bea`)

| # | Case | Result | Observed |
|---|---|---|---|
| BO-1 | Both cards present by default | **PASS** | `TREATMENT SCHEDULE → RADIATION SESSIONS` |
| **BO-2** | **D-3 did NOT change "both"** | **PASS** | DOM order `Treatment schedule → Radiation sessions` — chemo scheduling still outranks sessions |
| BO-3 | No card duplicated or lost | **PASS** | exactly 2 cards |
| BO-4 | Only-mode −1/+1 walked on `both` | **PASS — exact** | 8/10 hidden · **8/11, 8/12, 8/13 shown** · 8/14 hidden |
| BO-5 | Order unchanged after a date is set | **PASS** | `Treatment schedule → Radiation sessions` |
| BO-6 | Console errors | **PASS — zero** | none |

### Other profile (`Ollie`) — plausible non-oncology medications

`Metformin 500 mg / 1000 mg` (scheduled BID, 2000 mg limit) · `Lisinopril 10 mg` (scheduled 09:00, Morning group) · `Ibuprofen 200/400 mg` (as-needed, 6 h gap, 1200 mg limit) · `Vitamin D3 1 tab` (scheduled 08:30).

| # | Case | Result | Observed |
|---|---|---|---|
| **OT-1** | **Add-medication editor: near-treatment/exclude entirely absent** | **PASS** | none of 11 banned strings present — no `Treatment-day availability`, `Availability near your date`, `Only near…`, `Excluded near…`, `Always available`, `Days before/After`, `Active window` |
| OT-2 | No such radiogroup in the DOM | **PASS** | radiogroups present = `Home screen placement` only |
| OT-3 | Meds list carries no treatment chips | **PASS** | `Metformin … Ibuprofen · Advil · Doses: 200 mg · 400 mg · Rules: Min 6-hour gap · Daily limit 1200 mg · Own Home card` |
| OT-4 | Home: no amber chip, no D-2 caption | **PASS** | absent; Quick log = `Metformin ✓Available … Ibuprofen ✓Available … Vitamin D3` |
| OT-5 | Treatment schedule card default unchanged | **PASS** | `TEMPERATURE, WEIGHT, BLOOD PRESSURE, TREATMENT SCHEDULE` |
| OT-6 | Doses log normally | **PASS** | `EVENING · 8:43 PM · Metformin · 500 mg · Remove` / `8:43 PM · Ibuprofen · 400 mg` |
| OT-7 | Precondition: the previous build really did allow this | **PASS** | app-v52.1 served alongside on the same origin; saved `Legacy Restricted` with chip `Your date −2/+1` |
| OT-8 | **Restriction saved before the change is inert, not stranding** | **PASS** | back on v52.2: `Legacy Restricted · saved on app-v52.1 · ✓Available · No doses logged · 5 mg` — shown and loggable |
| OT-9 | Legacy chip hidden in the Meds list | **PASS** | no `Your date −2/+1` / `Treatment day −2/+1` anywhere |
| **OT-10** | **Editing that med shows no near-treatment control** | **FAIL** | → **V52.2-1**. Editor shows `DAYS BEFORE … DAYS AFTER … Active window: 2 days before through 1 day after your date.` |
| OT-11 | Console errors | **PASS — zero** | none |

### Guided tours — all four profiles, from wiped installs

| # | Case | Result | Observed |
|---|---|---|---|
| TR-chemo / radiation / both / other | Full 10-step tour walked for real (tap Meds → tap Add → fill and save a medication → tap Home → Next ×5 → Finish) | **PASS ×4** | steps reached `1,2,3,4,5,6,7,8,9,10` on each; tour closed cleanly at the end on each |
| TR-copy-rad | Radiation-only copy | **PASS** | no non-brand occurrence of "chemo" on Home; cards read `TEMPERATURE, WEIGHT, BLOOD PRESSURE, RADIATION SESSIONS, QUICK LOG` |
| TR-copy-other | "Other" copy | **PASS** | only treatment wording on Home is the neutral `No treatment date set` |
| TR-err-* | Console errors, each tour | **PASS ×4 — zero** | none |

---

## The four Designer must-fixes

### D-1 — Settings helper

| # | Case | Result | Observed |
|---|---|---|---|
| RA-2 | Helper shortened and in proportion | **PASS** | `Treatment schedule card — Treatment date, countdown, and reminders on Home.` — also resolves v52's **V52-7** (it no longer says "treatment day" to an Other profile) |

### D-2 — amber `No date set` chip + caption

| # | Case | Result | Observed |
|---|---|---|---|
| CH-3 / RA-4 | On the right cards | **PASS** | chip renders in place of `✓ Available`, caption directly under the meta line |
| CH-5 / CH-6 | Not on unrestricted or excluded-mode meds | **PASS** | both keep `✓Available` |
| OT-4 | **Not** on Other profiles | **PASS** | absent |
| CH-11 | Not on meds with a date set | **PASS** | chip and caption both disappear |
| ED-1 | 360px: no reflow | **PASS** | `scrollWidth − clientWidth = 0px` |
| ED-2 | Card grows, chip keeps its token | **PASS** | chip height **26px** (identical to the existing "Waiting" pill), caption block 36px (2 lines), card **328 × 182px** inside a 360px viewport |
| XT-4 | Same signal on a **grouped** med | **FAIL (LOW)** | → **V52.2-2**. Grouped row reads only `Filgrastim · Neupogen · Log` — no chip, no caption |
| XT-2 | Caption when the schedule card is toggled off | **FAIL (LOW)** | → **V52.2-3** |

### D-3 — card order on radiation-only

| # | Case | Result | Observed (DOM order) |
|---|---|---|---|
| RA-5 | Radiation sessions above Treatment schedule | **PASS** | `Radiation sessions → Treatment schedule` |
| RA-6 | Splice duplicates/loses nothing | **PASS** | each card exactly once |
| RA-7 | Sessions OFF + schedule ON | **PASS** | `Treatment schedule` (once) |
| RA-8 | Both OFF | **PASS** | neither card renders |
| RA-9 | Sessions ON + schedule OFF | **PASS** | `Radiation sessions` (once) |
| RA-10 | Back to both ON | **PASS** | `Radiation sessions → Treatment schedule`, no duplicates |
| BO-2 / BO-5 | `both` profile untouched | **PASS** | `Treatment schedule → Radiation sessions`, before and after setting a date |
| CH-* | chemo profile untouched | **PASS** | single `Treatment schedule` card, normal position |

### D-4 — day summaries

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| HI-2 | Misses-only day | **PASS** | `TUESDAY, 8/11 — **Nothing logged · 3 MISSED**` |
| HI-3 | Ordinary day | **PASS** | `MONDAY, 8/10 — 3 doses · 1 temp` |
| HI-4 | Mixed day | **PASS** | `WEDNESDAY, 8/12 — 2 doses · 1 temp · 1 MISSED` |
| HI-5 | Singular form | **PASS** | `TODAY - THURSDAY 8/13 — 1 dose · 1 MISSED` |
| HI-7 | No bare "Nothing logged" filler rows | **PASS** | 0 sections |

---

## V52-5 and the H-1 regression

Chemo profile, `Pantoprazole` with two windows (08:00 + 12:00 — the only shape that can produce a *today* miss, since a day's last window never closes before midnight), `Prochlorperazine` only-mode with no date, `Ondansetron` as-needed.

| # | Case | Result | Observed |
|---|---|---|---|
| HI-1 | Banner == History for past days | **PASS** | banner `6 missed doses from previous days`; History's per-day MISSED rows sum to **6** |
| **HI-8** | **V52-5: today's misses reach History** | **PASS** | Home `Review 6 missed doses from previous days` + today's own row `TODAY - THURSDAY 8/13 — 1 dose · 1 MISSED`; missed-only view lists today; **no "all caught up"** |
| HI-9 | Today's miss is resolvable | **PASS** | `TODAY - THURSDAY 8/13 · 1 dose · 1 MISSED · MORNING · 8:00 AM · Pantoprazole · MISSED · Before breakfast window closed · Took later · Skipped · Clear` |
| HI-10 | Arithmetic holds | **PASS** | History total **7** = past 6 + today 1 |
| HI-11 | Resolving decrements | **PASS** | `Missed Doses (7)` → `(6)` after **Took later** |
| HI-12 | `Clear all` works | **PASS** | `No missed doses to review — you're all caught up!` |
| HI-13 | Survives a full reload | **PASS** | no missed-dose text on Home after `reload()` |
| **HI-14** | **H-1 at scale (38 unlogged days)** | **PASS** | banner **113** vs History past-day rows summing to **113**, across 41 day sections |
| HI-15 | At scale: no filler days | **PASS** | 0 sections |
| HI-16 | Console errors | **PASS — zero** | none |

---

## H-3 regression — export units (CSV + the doctor-facing report)

Seven medications covering **mg, mcg, tabs, applications, patch, sprays**, plus one with no dosage options at all. CSV downloaded from the running app and read off disk; printable report unlocked via the beta simulated purchase and read out of the opened window.

| # | Case | Result | Observed — verbatim from the downloaded file |
|---|---|---|---|
| EX-1 | CSV downloads | **PASS** | 7 medication rows written |
| EX-2 | No invented "pill(s)" | **PASS** | `Ondansetron → 8 mg` · `Levothyroxine → 75 mcg` · `Senna → 2 tabs` · `Aquaphor → 2 applications` · `Fentanyl Patch → 1 patch` · `Saline Spray → 2 sprays` — zero occurrences of "pill" |
| EX-3 | No doubled amount | **PASS** | every Detail cell carries the amount exactly once (v51 wrote `8 mg, 8 pills` / `2 tabs, 2 pills`) |
| EX-4 | Medication with no dose label | **PASS** | `2026-08-09,9:04 PM,Plain Med,,` — empty Detail, nothing invented |
| EX-5 | Printable doctor report | **PASS** | `8 mg · 75 mcg · 2 tabs · 2 applications · 1 patch · 2 sprays`, no "pill" anywhere |

---

## Edge cases and blast radius

| # | Case | Result | Observed |
|---|---|---|---|
| ED-3 | Double-tap a dose button, then double-tap Confirm | **PASS** | exactly **1** journal row: `9:04 PM · Dexamethasone 4 · 4 mg` |
| ED-4 | Reload with the log modal open | **PASS** | clean Home, no orphaned modal |
| ED-5 | Offline reload | **PASS** | renders from the service-worker cache (463 chars of real UI) |
| ED-6 | Absurd treatment-window inputs | **PASS (no crash)** | `-5 → 1 day` · `abc → 1 day` · `2.7 → 3 days` · empty `→ 1 day` · `0 → 0 days` · **`9999 → 9999 days`** (V52-8 still open) |
| ED-7 / XT-8 | Console errors | **PASS — zero** | none |
| XT-3 | Clearing the date **while inside** the window | **PASS** | med stays visible: `Dexamethasone 4 · No date set · Showing every day until you set a treatment date.`; header returns to `No treatment date set` |
| RA-7…RA-10 | Every Home-card toggle combination | **PASS** | no card duplicated or lost in any combination |
| — | Empty states | **PASS** | `No medications yet`, `No treatment date set`, `No sessions logged yet`, `No missed doses to review — you're all caught up!` all render correctly |
| — | Midnight/day boundaries | **PASS** | covered by CH-12/13/14, RA-12/13, BO-4 — every window edge crossed in both directions |

---

# FINDINGS

## V52.2-1 — **MEDIUM**: "Other" profiles still see half the near-treatment control

* **Where:** `index.html:4922–4936` — the `Days before` / `Days after` block and its `Active window: …` summary. Compare `index.html:4910`, where the mode picker directly above it *is* gated with `isOtherTreatmentType() ? null :`; this block is gated only on `(form.treatmentMode || 'none') !== 'none'`.
* **Repro (exactly what I did):** created an **Other** profile on app-v52.1 (served byte-identical from `HEAD~1` at the same origin, i.e. the real upgrade path), added `Legacy Restricted`, mode **"Only near your date" −2/+1**, saved. Reloaded app-v52.2. Meds → tap Edit on that medication.
* **Observed on screen:** the editor renders `DAYS BEFORE — Becomes active this many days before your date (0 = starts on your date itself). [2]`, `DAYS AFTER — Stays active through this many days after your date (0 = your date only). [1]`, and **`Active window: 2 days before through 1 day after your date.`** No "Treatment-day availability" picker appears above them.
* **Expected:** nothing about near-treatment or exclude, per Aaron's *"the whole near treatment and exclude shouldn't be there at all for them."* The same one-line guard already applied 12 lines above.
* **Why it matters:** three separate problems in one control. (1) It states a restriction the app deliberately ignores — an "Active window" that is not active. (2) It is orphaned: with the picker gone there is no way to set the mode back to "Always available", so the user cannot clear the rule from within the editor at all (only by deleting and re-adding the medication). (3) The release's own code comment at `:4903–4909` claims "nothing is stranded in a state its editor can no longer display or undo" — half of it is still displayed, and it genuinely cannot be undone.
* **Reachability:** upgrade path only — a fresh Other install on v52.2 cannot create the state (verified: OT-1/OT-2 show the picker is entirely gone), and per-profile storage (`chemowell-app-p-<id>-med-v1`) means no chemo profile's medications can leak into an Other profile. So it hits Other-profile users upgrading from v39–v52.1, not new installs.
* **Evidence:** `08-other-legacy-med-editor.png`

## V52.2-2 — **LOW**: D-2's "no date" signal never reaches grouped medications

* **Where:** `index.html:4002` (chip) and `:4027` (caption) — both live only in the standalone `medCards` branch. `renderGroupedMedsCard()` (`:2516–2556`) has no equivalent.
* **Repro:** chemo profile, no treatment date. Add a medication with **Only near treatment day** and Home placement **Morning meds group**.
* **Observed:** the Morning group row reads `Filgrastim · Neupogen · Log` — nothing else. On the same screen, an identically-configured standalone medication reads `No date set` + `Showing every day until you set a treatment date.`
* **Expected:** the same signal, in whatever form fits the denser grouped row. D-2 exists because "an unexplained *shown* medication is a quieter failure of the same kind as an unexplained *hidden* one" — that reasoning does not stop at the placement boundary, and grouped placement is where V52-1's dead end lived last round.
* **Not a blocker:** the medication is visible and loggable, which is the safe direction. This is the explanation being missing, not the medication.

## V52.2-3 — **LOW**: the D-2 caption can point at a card the user has switched off

* **Where:** `index.html:4027` (caption) and `:5598` (the Settings toggle, now available to every profile).
* **Repro:** chemo profile → Settings → turn **Treatment schedule card** off → add a medication with "Only near treatment day".
* **Observed:** Home cards read `TEMPERATURE, WEIGHT, BLOOD PRESSURE, QUICK LOG` — no Treatment schedule card — while the medication card says **"Showing every day until you set a treatment date."** There is nowhere on Home to set one.
* **Expected:** either the caption acknowledges the card is off (e.g. *"Turn on the Treatment schedule card in Settings to set one"*) or setting a date is reachable from the caption itself.
* **Milder than the v51 dead end it descends from:** the user opted out themselves and can re-enable it in Settings, and the medication stays visible and loggable throughout. Evidence: `13-chemo-card-off-caption.png`.

## V52.2-4 — **LOW**: the build carries three different version labels

* **Where:** `index.html:5437` (`APP_VERSION = 'app-v52'`), `sw.js:1` (`CACHE = 'chemowell-app-v52-3'`), and this release being called **app-v52.2** everywhere else.
* **Observed:** the drawer footer reads **"ChemoWell app-v52"**, and the printable doctor report header prints **"ChemoWell app-v52"** too (`index.html:5817`) — on a build that is two fix rounds past v52.
* **Expected:** `APP_VERSION = 'app-v52.2'`. `release_check.sh` only warns on this (correctly — a stale label strands nobody the way a stale cache does), and it did not warn here because the working tree is already committed. But the script's own rationale is that "a screenshot of the drawer is a reliable way to confirm which build someone is on," and right now it isn't: three v52-family builds all report `app-v52`.

## Still open from `AUDIT_v52.md` — re-checked, unchanged, not regressions

| ID | Severity | Status | Observed now |
|---|---|---|---|
| V52-8 | LOW | **still open** | `9999` accepted in Days before → `Active window: 9999 days before through 1 day after treatment day.` `-5`, `abc`, empty all correctly fall back to 1; `2.7` rounds to 3; `0` accepted. No crash. |
| V52-9 | LOW | **still open** | After setting 8/20: `TREATMENT SCHEDULE · Thursday, 8/20 · in 11 days · Clear · **Pick a date**` — the picker beneath the confirmed date still says "Pick a date" |
| V52-10 | LOW | **still open** | `index.html:5722` still concatenates `'override: ' + e.overrideReason` — the doctor-facing report prints the raw internal code (`early+overLimit`) |

---

## Screenshots — `outputs/v52-2-audit-screenshots/`

| File | Shows |
|---|---|
| `01-chemo-no-date-amber-chip.png` | D-2 — amber `No date set` chip + caption on a chemo profile with no treatment date |
| `02-chemo-treatment-day.png` | CH-12/13/14 — treatment day itself: only-mode meds shown, excluded med inert |
| `04-radiation-d3-order.png` | **D-3** — Radiation sessions above Treatment schedule, plus D-2 on `Ondansetron` |
| `06-both-order-unchanged.png` | BO-2 — `both` profile ordering deliberately unchanged |
| `07-other-editor-no-treatment-control.png` | **OT-1** — the Add-medication editor on "Other": the whole control is gone |
| `08-other-legacy-med-editor.png` | **V52.2-1** — the same profile editing a legacy-restricted med: Days before/after + "Active window" still there |
| `09-history-d4-summaries.png` | **D-4** — `Nothing logged · 3 MISSED`, `3 doses · 1 temp`, `2 doses · 1 temp · 1 MISSED` |
| `10-history-today-miss.png` | **V52-5** — today's miss listed and resolvable in History |
| `11-360px-d2-card.png` | ED-1/ED-2 — the D-2 card at 360px, no reflow, 26px chip |
| `13-chemo-card-off-caption.png` | **V52.2-3** — caption asking for a date with the schedule card switched off |

---

## Not verifiable in this environment

Named explicitly per TEAM.md rather than quietly skipped. Nothing else in this report was closed with "confirm on your device".

* **Real Android OS notification delivery.** The scheduling predicate (`medRemindersEnabledOn` → `treatmentOnlyBlocks`, `index.html:6911`, consumed by `buildReminderPlan` at `:6938`) is code-identical to the live-reproduced `missedDosesFor` case, which I did drive and verify (HI-6); only the OS handing the notification to the user is out of reach.
* **The native share sheet** for CSV export. The web download path was driven end to end and the file read off disk, so `buildExportRows()` — the thing H-3 changed — is fully verified.
* **The hardware Back button.**
