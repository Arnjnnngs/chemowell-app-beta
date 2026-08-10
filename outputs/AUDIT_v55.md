# AUDIT_v55.md — Zero Day Auditor, app-v55 (offline Help centre)

**Date:** 2026-08-10 · **Auditor:** Zero Day Auditor (independent gate, TEAM.md stage 3)
**Under test:** working tree == `HEAD` (`513c00f`), `git status` clean. `APP_VERSION = 'app-v55'` (index.html:5669), `sw.js` `CACHE = 'chemowell-app-v55-1'` (sw.js:1). `./release_check.sh` → **exit 0**.
**Spec:** `outputs/HELPBOT_CONTENT_v1.md` · **Scope:** genuine new user-facing feature.
**Method:** Playwright 1.56 / Chromium against `python3 -m http.server 8899`, real UI only (index.html is one `<script type="module">`; nothing is reachable from `page.evaluate`). Four wiped installs (Chemo / Radiation / Both, plus profile switching to Other), 360px primary + a full 390px pass. Test scripts committed: `test/audit-v55.mjs`, `test/audit-v55b.mjs`, `test/audit-v55c.mjs`, `test/audit-v55d.mjs`.

---

## VERDICT — safe to ship, with 2 copy fixes that should land first

**app-v55 is functionally safe to ship. Zero console errors, zero crashes, zero regressions found, and the search-box bug that shipped four times before (v11/v22/v27/v45) is genuinely fixed — I could not make it drop a character under any timing I tried.** All 117 walkthroughs plus the 15 FAQ entries plus the 1 pointer row — 133 rows — open, every one has real steps, no dangling `related`, no duplicate ids, no broken back-out, no horizontal overflow at 360 or 390px.

**However, two findings are copy defects in a feature whose entire job is telling a stressed caregiver where to tap, and both are the "fixed one call site, missed the others" pattern this build was specifically screened for:**

* **V55-1 (Medium)** — five places in the shipped Help/FAQ content tell the user to *tap the name at the top of the menu* to open Account or switch profile. **app-v54 deliberately made that element non-interactive**, at Aaron's explicit request. The `reset` FAQ entry was corrected to say Account; the two FAQ profile entries and three new Help walkthroughs still describe pre-v54 behaviour. A caregiver following the *erase everything* walkthrough is told to tap something that does nothing.
* **V55-2 (Low–Medium)** — four entries render **raw markdown backticks** to the user (`` `500 mg` ``, `` `2 tabs` ``). `helpRich()` handles `**bold**` and `*italics*` but not the third markup form the spec used. Visible in `outputs/v55-05-medical-calm-med-daily-limit.png`, on one of the nine medical-adjacent pages.

Both are pure wording/rendering misses, so under TEAM.md's restart rule they are the **targeted-fix tier**, not a new round. Neither changes behaviour or data. My recommendation to the PM: fix V55-1 and V55-2, spot-verify those exact strings against the running product, ship. Do not hold the release for anything else in this report.

**On the medical-adjacent copy (item 4 of the brief): nothing in the 14 flagged entries reads as medical advice.** No thresholds, no numbers, no "this is fine / not fine", no dosing suggestion anywhere. The implementer's decision to split urgent/calm was the right *judgement* and an incomplete *execution* — see §4. One clinician read is still worth buying before real users see it, for one specific entry, named in §4.

---

## 1. All 117 entries reachable and complete

Verified independently of the implementer's claim, twice: statically over the extracted `HELP_TOPICS` array, and by driving the UI through every single row.

| # | Case | Result | Observed |
|---|---|---|---|
| A0 | 17 category tiles on the landing screen | PASS | 17 |
| A1 | Common questions holds 15 accordion rows | PASS | 15 |
| A2 | Every FAQ answer expands in place, one at a time | PASS | 15/15, `aria-expanded="true"` count never exceeded 1 |
| A3 | Total rows opened by clicking through every category | PASS | **133** = 117 topics + 15 FAQ + 1 pointer (implementer's "118 rows" = 117 + pointer, confirmed) |
| A4 | Every walkthrough renders a real "Step by step" `<ol>` | PASS | 0 with missing or empty steps |
| A5 | Headings, back-outs and chip targets on every row | PASS | 0 defects |
| A7 | Horizontal overflow anywhere in Help @360px | PASS | max overflow **0px** across all 133 rows |
| F1 | Every topic reachable by searching its own question text | PASS | 117/117 |
| F2 | Rendered Related chips == the `related` array, per topic | PASS | 117/117 exact |
| F4 | Horizontal overflow @390px across every walkthrough | PASS | max **0px** |
| F5 | A Related chip opens exactly that topic | PASS | "Which Limit unit should I pick?" → same `<h1>` |
| S1 | Duplicate topic ids (static) | PASS | 0 |
| S2 | Dangling `related` ids (static) | PASS | 0 of 251 references |
| S3 | Topics with a `cat` not in `HELP_CATEGORIES` | PASS | 0 |
| S4 | Branches missing `when` or `steps` | PASS | 0 |
| S5 | Spec ids vs implemented ids | PASS | 118 spec headings; 117 implemented + `set-units-quick` as the pointer row. **Nothing dropped, nothing invented.** |
| S6 | Category counts | PASS | reminders 14, meds 18, logging 8, missed 6, treatment 5, vitals 11, symptoms 5, inpatient 5, reports 6, notes 7, export 6, profiles 7, settings 5, tour 3, privacy 4, app 7, common 15 |
| S7 | Landing caption counts are computed, not hard-coded | PASS | `HELP_TOPICS.length` / `FAQ_ITEMS.length` — cannot go stale |
| S8 | Category tile counts sum to the real total | PASS | 133 |

## 2. The search input does not drop characters

This is the failure this project has shipped four times. I attacked it with dwell times deliberately longer than the 1-second tick, at three speeds, plus caret and selection cases.

| # | Case | Result | Observed |
|---|---|---|---|
| B1 | 43-char multi-word query, 150ms/char, **1.2s dwell every 5 chars** (≥8 ticks fire mid-typing) | PASS | `"reminder never arrives on my phone at night"` — 43/43 chars |
| B2 | Fast typing, 25ms/char | PASS | `"greyed out daily limit"` intact |
| B3 | 120ms/char with a **2s dwell every 3 chars** | PASS | `"export csv"` intact |
| B4 | Insert a character mid-string (caret moved to index 6) | PASS | `"exportcsv"` → `"export csv"` |
| B5 | Caret position after the inserted character | PASS | `selectionStart = 7` (correct) |
| B6 | Selection (0–6) + focus survive a full 1s tick | PASS | `[0, 6, true]` after 1.6s |
| B7 | Typing over a live selection replaces it | PASS | `"X csv"` |
| B8 | The spec's own example query | PASS | "not getting reminders" → 1 result (the multi-term match fix works) |
| B9 | No-match empty state | PASS | "Nothing matched that" + the plain-word suggestion |
| R1 | Race: start typing **0ms / 300ms / 800ms** after landing on Help | PASS | full string survives at all three; `document.activeElement` still `#help-search` |
| H9 | 1s tick leaves a settled Help view alone | PASS | DOM marker survived 4s |
| H10 | 1s tick still rebuilds Home (guard didn't over-reach) | PASS | marker gone within 2.5s |

**Note on the guard, for the record:** one single re-render does fire ~1.5s after navigating to Help (drawer-close/toast settle, not the tick — it does not repeat). I specifically tested typing through that window (R1) and it does **not** eat a keystroke, because `helpSetQuery()` re-focuses and restores the caret on every input event. The tick guard itself is correct and belt-and-braces (view exclusion *plus* the pre-existing `isEditing` check).

## 3. The old FAQ still works

| # | Case | Result | Observed |
|---|---|---|---|
| C1 | Drawer row is **Help**, no FAQ row remains | PASS | `["Account…","Calendar…","Notes…","Help\nFind and fix a problem","Settings…"]` |
| A1/A2 | All 15 questions present, accordion expands in place | PASS | 15/15, list stays on screen (no navigation) |
| C2 | `reset` answer names **Account**, not Settings | PASS | "open Account (in the menu), and scroll to Start over at the bottom" |
| C3 | Account really contains "Start over" — navigated and confirmed | PASS | present |
| C4 | FAQ hit from search opens the accordion, not an empty walkthrough | PASS | lands on Common questions, answer expanded, query cleared |
| **C5** | **Every FAQ answer that references another screen points at the right one** | **FAIL** | **`switch-profile` (index.html:2065) and `caregiver-multi` (2066) both still say "tap your name at the top" — non-interactive since v54. See V55-1.** |

## 4. Medical-adjacent copy — read as a stressed non-technical caregiver

All 14 flagged entries read in full (9 `medical`, 5 `safety`), against the spec's per-entry "what it must never do" table.

**Flag parity with the spec: exact.** `medical: true` on the same 9 (`rem-none`, `med-add-first`, `med-daily-limit-locked`, `log-anyway-override`, `miss-real-missed`, `vit-temp-high`, `vit-weight-change`, `sym-severe`, `ip-meds-restricted`); `safety: true` on the same 5. Nothing was quietly downgraded.

**Nothing reads as medical advice.** Automated and manual checks both clean: no temperature threshold anywhere (no `100.4`, no `38°`, no `37.5`), no "call if it's above X", no take/skip/double-up guidance, no severity ranking, no interpretation of a weight change. Every one of the four call-now entries states the instruction *first*, in bold, before a word about the app, and each closes with an explicit "this app does not judge / does not interpret / is not medical advice" line. `miss-real-missed` — the highest-risk one — says outright: *"Whether to take a missed dose late, skip it, or double up is a medical decision… ChemoWell cannot answer that, and it will never suggest an answer."* That is the right sentence.

### Judging the deviation (4 urgent / 5 calm)

**The reasoning is right; the execution is half-done, and the half that's missing is the half that matters.**

The implementer's argument — a red banner on "The Daily limit box is greyed out" spends red where it isn't needed — is correct, and I'd defend it. But what they changed was the **accent colour** (`NOTICE_TONES.urgent` `#C0453B` → `attention` `#B5761E`), which on screen is a 4px left border and a faint chip tint. Rendered side by side at 360px (`v55-04` vs `v55-05`), the two treatments are **nearly indistinguishable** — so the deviation does not actually protect red's weight much.

Meanwhile both variants keep the **identical heading: "Contact your care team."** So the calm five open with a literal instruction to phone the hospital, sitting above a legal disclaimer, on pages about a greyed-out text box (`med-daily-limit-locked`), how to add a medication (`med-add-first`), and why logging is paused during a hospital stay (`ip-meds-restricted`). A frightened caregiver reading "Contact your care team" at the top of *"How do I add a medication?"* is being told, in the app's most authoritative voice, that a data-entry question is a clinical one. That is a small but real cry-wolf cost — the exact cost the deviation was meant to avoid.

**Recommended fix (V55-3, Low):** keep the two tones; change the heading on non-`careLead` topics to something non-instructional — *"Not medical advice"* — over the same unchanged disclaimer body. One line, at index.html:5889. This makes the deviation do what it set out to do.

Secondary, cosmetic: on `vit-temp-high` the heading "Contact your care team" is immediately followed by the body "**Contact the care team now.**" — the instruction is stated twice in two lines. The fix above removes the duplication on the calm five and would leave this one; consider dropping the heading entirely for `careLead` topics and letting the body lead.

### Does this need a real copywriter or clinician before shipping?

**Copywriter: no.** The prose is already better than most of this app's existing copy — short sentences, second person, no jargon, and it consistently refuses to give advice. The two copy defects below are transcription/rendering misses, not writing quality.

**Clinician: one entry, yes — `sym-severe` (index.html:2198).** It is the only place in the app that enumerates clinical signs — *"struggling to breathe, confused, or you're frightened"* — as the trigger for calling emergency services. That is a triage list, however lightly worded, and it is the one line where being slightly wrong has a real consequence in both directions (calling too late, or teaching someone that anything not on the list can wait). Everything else in the set is safely non-clinical. Per TEAM.md's copy-review rule I am flagging it explicitly rather than guessing: **get one oncology-nurse-level read of `sym-severe` before this reaches real users.** It does not need to block a beta push to Aaron.

## 5. Regression sweep — real data entered through the UI

Four wiped installs. Profiles: Chemo (`Aud Patient`), Radiation (`Aud B`), Both (`Miss Test`), plus Chemo→Radiation→Other→Chemo switching on a live profile.

| # | Case | Result | Observed |
|---|---|---|---|
| E1–E10 | Home, Meds, Reports, In-Patient, Symptoms, Account, Calendar, Notes, Settings, Help all render | PASS | all render; overflow 0px on every bottom-nav screen |
| E11 | Drawer opens/closes; Escape dismisses | PASS | — |
| E12 | **v54: drawer name is display-only** | PASS | drawer button list contains no `Aud Patient` entry |
| G1 | Add as-needed med, mg dosage options, 4h gap | PASS | Ondansetron |
| G2 | Add treatment-only med in the **Morning group** | PASS | Rad Cream |
| G3 | **v52 H-2 / V52-1: grouped treatment-only med with no treatment date** | PASS | reads "No date set — showing every day until you set a treatment date", **not** "Outside its treatment-day window" — the regression that failed the first v52 build does not reproduce |
| G4 | Log a dose from Home (dose chip → Confirm) | PASS | "Ondansetron logged · 8 mg at 10:08 PM"; Today's journal updated |
| G5 | Dose reaches History | PASS | present |
| G7 | CSV export downloads | PASS | header `Date,Time,Type,Detail,Note` |
| G8 | **v52 H-3: CSV carries the real unit, no invented "pills"** | PASS | `2026-08-10,10:08 PM,Ondansetron,8 mg,` — no fabricated pill count |
| H1 | Scheduled med with the default 8 AM window | PASS | Capecitabine |
| H2 | Beta date controls advance the simulated day | PASS | Mon Aug 10 → Tue Aug 11 |
| H3 | **v52 H-1: header banner reports past missed doses** | PASS | "1 missed dose from previous days" |
| H4 | **v52 H-1: banner == History, and the miss is resolvable there** | PASS | banner 1 == 1 resolvable row (Took later / Skipped) |
| H5–H8 | **v53: treatment type editable in Settings**, Chemo→Radiation→Other→Chemo | PASS | Home renders cleanly at every step, no `undefined`/`NaN` |
| H0 | "Both" treatment profile completes first-run | PASS | — |
| D1 | Reload while three levels deep in Help | PASS | no crash |
| D2 | Reload returns to the Help **top level** | PASS | drill-down state is deliberately not persisted (`state.help` is not in `sessionStorage`) — correct, matches the v55 "Help always opens at the top" commit |
| D3 | Reload with an active search | PASS | no crash, lands on the Help landing |
| D4 | Legacy `sessionStorage` view value `'faq'` | PASS (see V55-4) | lands on **Home**, not Help — safe, but not what the code comment claims |
| **Z** | **Console errors across every run** | **PASS — 0** | CDN `ERR_CERT_AUTHORITY_INVALID` filtered as the documented sandbox artifact |
| — | `./release_check.sh` | PASS | exit 0, "index.html changed and sw.js's CACHE constant changed with it" |
| — | Version coherence | PASS | `APP_VERSION = 'app-v55'`, `CACHE = 'chemowell-app-v55-1'`, About card reads "ChemoWell app-v55 (beta)" |

**Code-level blast-radius review.** The diff touches exactly seven places outside the new Help code: `VALID_VIEWS` (+`'help'`), the `state` literal (+`help: {cat,topic}`), `navigateTo()` (reset-on-entry), the drawer item, the `renderContent` route, `APP_VERSION`, and the tick guard. I checked every other place that could have needed a matching edit: drawer active-highlight (`state.view === item.key` — generic, works), all 17 category icons exist in `svgIcon`'s map (no silent blank), `h()` passes `for` through `setAttribute` so the `<label for="help-search">` is real, and no `switch`/whitelist elsewhere enumerates views. Nothing else needed changing. `renderFaqView` is fully removed, not left as dead duplicate content.

---

## Findings

### V55-1 — **MEDIUM** (copy/correctness): five walkthroughs tell the user to tap the drawer name, which app-v54 deliberately made non-interactive

* **Where:** `index.html:2065` (FAQ `switch-profile`), `2066` (FAQ `caregiver-multi`), `2225` (`pro-switch`), `2234` (`set-erase-all`), `2242` (`priv-delete`).
* **Repro:** Help → Profiles & plans → "How do I switch between people?" → step 2 reads *"Tap the name at the top to open **Account**"*. Open the menu and tap the name: nothing happens. Same dead end via Settings & the Home screen → "How do I erase everything and start over?" step 1, and Your data & privacy → "How do I make sure my data is really gone?" step 2.
* **Why it matters:** app-v54 shipped one release ago on Aaron's explicit instruction — *"this shouldn't take you to any page as this should be visible only… there is a settings tab right underneath"*. The new Help centre re-documents the behaviour he had removed. The user is not stranded (the drawer's **Account** row is directly beneath), but the instruction names a control that does nothing, in the *erase everything* and *switch person* walkthroughs.
* **This is the pattern.** The spec called out one stale cross-reference to fix (`reset` → Account) and that one was fixed correctly. The two FAQ entries and three new Help entries describing the same retired interaction were not. Fixing one call site and missing the others.
* **Expected:** every one of the five should route via the drawer's **Account** row (e.g. *"Tap the three lines in the top left, then tap **Account**"*). The read-only mentions — `med-not-on-home`, `rep-entry-missing`, `exp-nothing`, and `pro-switch`'s "the name at the top always tells you who you're looking at" — are correct as written and must be left alone.

### V55-2 — **LOW–MEDIUM** (copy/rendering): raw markdown backticks are shown to users

* **Where:** `index.html:2149` (`med-dose-options`, 3 strings), `2150` (`med-daily-limit-locked`, 2 strings), `2152` (`med-gap-hours`), `2164` (`med-many-strengths`). Renderer: `helpRich()` at `index.html:5792`.
* **Repro:** Help → search "daily limit greyed" → open "The Daily limit box is greyed out and says 'Locked'". Step 2 renders literally: *"a number followed by the letters \`mg\` — for example \`500 mg\`. A bare \`500\` will not unlock it."* Screenshot: `outputs/v55-05-medical-calm-med-daily-limit.png`.
* **Why it matters:** it's on one of the nine medical-adjacent pages and on the entry the spec calls *"the single most-reported sticking point in this screen"* — the page a confused user is most likely to reach. A non-technical caregiver has no idea what a backtick means; the most likely reading is that the character is part of what they're supposed to type.
* **Same pattern again:** the spec authored copy in three markup forms — `**bold**`, `*italics*`, `` `code` ``. `helpRich()` implements the first two. The third was transcribed verbatim and never rendered.
* **Expected:** either add a backtick branch to `helpRich()` (a `<code>`-style span, matching the app's existing `mono` class) or strip the backticks from those 7 strings. Stripping is the smaller, safer change — `for example 500 mg` reads fine without them.

### V55-3 — **LOW** (copy): the calm care-team callout still carries the instruction "Contact your care team"

* **Where:** `index.html:5889` (heading is unconditional for `medical: true`); affects `rem-none`, `med-add-first`, `med-daily-limit-locked`, `log-anyway-override`, `ip-meds-restricted`.
* **Repro:** open "How do I add a medication?" — the page opens with a callout headed **Contact your care team** whose body is the app's legal disclaimer.
* **Expected:** `topic.careLead ? 'Contact your care team' : 'Not medical advice'`. Full reasoning in §4; this is what makes the implementer's own deviation actually work.

### V55-4 — **LOW** (code hygiene, no user impact): the `'faq'` fallback comment is wrong and both `'faq'` branches are dead

* **Where:** `index.html:2846–2847` and `index.html:7808`.
* **Observed:** the comment says *"'faq' still routes here so an old persisted view value can never land on a blank screen"* — but `restoreView()` filters through `VALID_VIEWS` (`index.html:784`), which no longer contains `'faq'`, so a legacy value becomes `'home'` before `renderContent` is ever consulted. Verified live: setting `sessionStorage['chemowell-app-ui-view'] = 'faq'` and reloading lands on **Home**.
* **Why it matters:** the behaviour is safe. The comment isn't, and it's the kind of comment a future release trusts instead of re-checking. Either add `'faq'` to `VALID_VIEWS` so the fallback genuinely works as described, or delete both branches and the comment.

### V55-5 — **LOW** (release mechanics, not code): README version history and REQUESTS.md are not updated

* **Observed:** `README.md`'s version-history table jumps from app-v53 to nothing — **no app-v54 and no app-v55 entry**. `REQUESTS.md:134` still has the troubleshooting-chatbot item unchecked, the release that implements it notwithstanding.
* **Why it matters:** TEAM.md's release-mechanics checklist requires a README entry before push, and the Scribe step requires REQUESTS.md to be ticked the moment something ships verified. Two releases now missing. Flagging rather than fixing (not my stage, and not code).

### Observations, not findings

* Typing the **first character** of any query shows "Nothing matched that" for one keystroke, because `helpSearch()` drops terms of length ≤ 1. It self-corrects on the second character. Deliberate-looking and low-cost; noted so nobody re-discovers it as a bug.
* The `HELP_POINTERS` row ("Change temperature or weight units") is reachable by browsing Settings & the Home screen, but not by **search** — pointers aren't in `helpAllTopics()`. Its target `vit-units` is searchable, so nothing is unreachable.
* `treat-set-date`'s note documents a real, still-present app quirk (after setting a treatment date the collapsed row still reads "Pick a date" while the card above shows "Tuesday, 8/25 · in 15 days"). **I verified the quirk is real, so the copy is honest** — but the underlying UI wart is worth a `BACKLOG.md` line; help text apologising for a bug is a stopgap, not a fix.
* Touch targets throughout Help are 44–76px; category tiles 76px. Nothing under the 44px floor.

---

## What I could not verify (browser boundary, per TEAM.md)

Nothing in this release touches native surfaces. For completeness: real Android notification delivery, the native share sheet, and the hardware Back button remain browser-unreachable. The Help content *describes* all three (`rem-none`, `exp-where-file`, `rem-tap-notification`) and carries the spec's NEEDS-VERIFICATION items NV-1 through NV-8 unchanged — those are Aaron-device confirmations the spec already flagged, not new gaps this release introduced.

## Screenshots (6, curated)

| File | Shows |
|---|---|
| `outputs/v55-01-help-landing.png` | Level 1 — 17 categories, live counts, search box |
| `outputs/v55-02-search-results.png` | Search results with per-result category labels |
| `outputs/v55-03-common-questions-accordion.png` | The original FAQ, expanding in place inside Help |
| `outputs/v55-04-medical-urgent-vit-temp-high.png` | `careLead` urgent tone — reads correctly |
| `outputs/v55-05-medical-calm-med-daily-limit.png` | The calm tone — **and V55-2's raw backticks** |
| `outputs/v55-06-category-logging.png` | Level 2 — a category's problem list |
