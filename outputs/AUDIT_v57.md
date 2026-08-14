# AUDIT v57 — Zero Day Auditor

**VERDICT: NOT READY — 1 High, 2 Medium, 3 Low.**

**The High is the question the Lead Developer asked to be attacked, and DEV_v57.md §2.2 is wrong on
its central factual claim.** §2.2 argues that removing the medical guards is safe because "that is
precisely what v55 shipped and what every v55 gate passed." It is not. I ran the same 50 clinical
questions through **v55's actual `helpSearch()`** (sliced out of commit `864aeaf`) and through
v57's: v55 returned **nothing at all for 49 of 50** — the caregiver got the *"Nothing matched that"*
empty state. v57 returns a **ranked list of app-page titles for 45 of 50**, with rank 1 chosen by
lexical accident. *"she collapsed"* is answered with **"All my medications vanished from Home."*
*"she is unresponsive"* with **"I tap something and nothing happens."* *"she is coughing up blood"*
with **"How do I record blood pressure?"** and the line **"66 results"**. That is not the behaviour
v55 shipped; it is behaviour that arrived with the v56 matcher, was never audited on the search-box
path, and v57 removes the only thing that was standing in front of it. **I am overruling the Lead
Developer on this, as invited.**

**Stage:** Zero Day Auditor (TEAM.md stage 3). **Date:** 2026-08-13.
**Under test:** `app-v57`, commit `26da090`, working tree clean, `index.html` md5
`cf6695773aa2cd178cd8d1eefaae784b`, served byte-identical over `http://127.0.0.1:8902` for every
browser case below. `sw.js` CACHE `chemowell-app-v57-1`, `APP_VERSION` `app-v57`,
`./release_check.sh` exits **0**.
**Spec:** `outputs/DEV_v57.md`. **Baselines:** v56 = `origin/main` (`a28aae3`) served on `:8903`;
v55 = `864aeaf` sliced headlessly.
**Evidence:** `outputs/v57-audit/` — 12 curated screenshots, 4 real CSV exports, full logs in
`outputs/v57-audit/logs/`.

**Cases: 586.**
- **225** independent cases driven through the real UI by me (`logs/s1-*`, `s1b-*`, `s1c-*`,
  `s2-*`, `s3-*`, `s4-*`, `s5-*`, `s6-*`).
- **87** headless corpus probes (50 Lead-Auditor clinical questions + 23 of my own + 14 v55-vs-v57
  comparisons).
- **17 mutation cases** applied to `index.html` to prove the new assertions can fail
  (`logs/mutation-results.txt`).
- **238** assertions from re-running the four shipped suites in full.
- **19** source-level / release-mechanics checks.

**4 profiles created from wiped installs** (chemo, radiation, both, Other), **two taken through the
complete guided tour to *Finish*** and two through *Skip guide*, **8 real medications** spanning
every placement, both scheduling modes, all three limit units, real daily limits and notes, a
**3-day simulated logging span** covering dose / temperature / weight / blood pressure / symptom /
note / appointment, each verified on Today, History, Reports (Weight, Blood Pressure), Calendar,
Notes and a **real downloaded CSV**. Zero console errors in every profile. Zero horizontal overflow
at 320 / 360 / 390 px.

---

## 1. Findings, most severe first

### V57-1 — HIGH — The Help centre's search box answers clinical questions with a ranked list of unrelated app pages, and nothing on that screen says it cannot answer them

`index.html:6162` (`helpSearch` — unfiltered and uncapped by design), `index.html:6332–6343` (the
results screen), and the deleted list-path coverage floor that used to sit in `helpBotDecide`.

**What I did.** I typed clinical questions into the real search box on the real Help screen, at
360 px, on a profile with real medications in it, and looked at what is on screen above the fold.
`logs/s2-search-ui.log`, `logs/clinical-50-search.log`, `logs/clinical-mine-search.log`.

| typed into *Search help* | rank 1 the caregiver sees | results | care-team page |
|---|---|---|---|
| `she collapsed` | **All my medications vanished from Home** | 2 | **none anywhere** |
| `she is unresponsive` | **I tap something and nothing happens** | 1 | **none** |
| `he has chest pain` | **Can I record how bad it was, or where on the body?** | 1 | **none** |
| `she has a rash all over` | **How do I erase everything and start over?** | 39 | **none in top 8** |
| `she is coughing up blood` | **How do I record blood pressure?** | 66 | rank 2 |
| `my mom stopped breathing` | **My reminders stopped after I didn't open the app for a while** | 5 | rank 2 |
| `is 2 tablets too many` | **What is 'Hours between doses' / minimum gap?** | 60 | **rank 35** |
| `can i crush the tablet` | **Where do I put instructions like 'take with food'?** | 54 | **rank 24** |
| `can he take paracetamol with the chemo` | **A dose was genuinely missed** | 11 | rank 1, wrong topic |
| `her lips are turning blue` | *Is this a side effect? … hair loss, sickness, tiredness* | 2 | rank 1 |
| `is 101.4 a fever` | *The temperature is high — what should I do?* | 7 | rank 1 ✅ |

**Only four result rows fit above the fold at 360 px** (measured: rows sit at y=376, 457, 538, 618;
the fifth is at 717, below the 710 px content edge). Measured against what is actually on screen,
a care-team page appears for **20 of 50** clinical questions — not 23 (`logs/care-floor-slack.log`).
For **five** of the 50 the box returns nothing at all.

**Why "v55 shipped exactly this" is not true.** v55's `helpSearch` was an AND-over-substrings
filter. Same 50 questions, v55's real function (`logs/v55-vs-v57-search.log`):

| | v55 (`864aeaf`) | v57 |
|---|---|---|
| clinical questions returning **nothing** (honest empty state) | **49 / 50** | 5 / 50 |
| clinical questions returning a ranked list of app pages | 1 / 50 | **45 / 50** |
| care-team page in top 8 | 0 / 50 | 23 / 50 |

So the v55 gates never saw this behaviour. They passed a search box that stayed silent. The one that
ships in v57 speaks, confidently, on every one of these, and it was the bubble's guards — not the
search box — that the v56 gates spent 452 + 400 cases on.

**Why I judge this unacceptable rather than merely imperfect.** A ranked list is not prose, and I
accept that no dosing advice is emitted anywhere — I checked, and the corpus is unchanged apart from
the one new page. The harm is different and real:

1. **It consumes the one resource the caregiver does not have.** At 2am, "she collapsed" produces a
   clean, confident, app-styled card. The person reads it, taps it, lands on *"All my medications
   vanished from Home"*, comes back, tries again. That is seconds to a minute of a person who should
   be dialling.
2. **The screen makes no claim about its own scope.** The heading is *Search help*; the empty state
   says *"Try a single plain word"*. There is no sentence anywhere on the results screen saying
   this app holds no medical information — even though the app has that exact sentence
   (`HELP_CARE_TEAM_LINE`) and it is already rendered on nine other pages.
3. **For the genuinely emergent phrasings the app is at its worst.** Chest pain, unresponsive,
   collapsed, rash — the four where the care-team route is entirely absent — are the four where the
   list is shortest and therefore *most* confident-looking.
4. **It is a regression against the honest behaviour.** v55's empty state ("Nothing matched that")
   is a better answer to "she is unresponsive" than "I tap something and nothing happens" is.

**Repro (any row above):** wiped install → complete setup → *Skip guide* → *Got it* → menu →
**Help & FAQ** → type the question. **Evidence:**
`outputs/v57-audit/FINDING-search-collapsed-360.png`, `FINDING-search-unresponsive-360.png`,
`FINDING-search-coughing-blood-360.png` / `-390.png`, `FINDING-search-two-tablets-360.png`.

**This is not a request to restore the guards.** The guards were a chat-box mechanism and Aaron was
right to be rid of them. The fix `BACKLOG.md:42` already names is the right one and was written
before this release: *"the best remaining lever … is the LIST reply … adding `HELP_CARE_TEAM_LINE`
to a list whose query nearly matched."* Concretely, three small things, in this order:

1. **Put the care-team line on the search-results screen** whenever the query resolves poorly —
   above the list, as a single sentence with a tap-through to `sym-severe`. `helpScore` already
   returns `cov` and `nterms`; the deleted `helpBotDecide` used `cov < 0.34` for exactly this
   judgement and that constant was measured, not guessed. It costs nothing when the query is
   ordinary ("export csv" resolves fully) and it is the only thing on this screen that would have
   helped any of the six rows above.
2. **Give the results list the same coverage floor.** A query where most content words are unknown
   to a 118-page corpus about a *logging app* should show the empty state, not rank 1 of 66.
3. **Cap the list.** 66 rows × 52 px is 3,400 px of app-page titles.

Any of these makes the honest answer visible; (1) alone would close the finding.

---

### V57-2 — MEDIUM — The care-team coverage floor measures a slice the user cannot see, and has slack exactly where it matters

`test/v57-search.mjs:285` (`.slice(0, 8)`), `:289–290` (`careSurfaced >= 20`)

The assertion is named *"a 'contact your care team' page is in the **visible results**"*. It reads
the **top 8**. At 360 px **four** rows are visible. Coverage by depth, measured
(`logs/care-floor-slack.log`): top 3 → 17/50, **top 4 → 20/50**, top 5 → 20/50, top 8 → 23/50. So
what a caregiver can see is exactly the floor, with zero margin, and the number quoted in
DEV_v57.md §2.3 (23) describes a list nobody scrolls.

The Lead Developer flagged (§5.5) that choosing 20 after measuring 23 is the v56 mistake shape. It
is worse than they suspected — I measured what the floor can actually catch by dropping each
`careLead` flag in turn:

| mutation | coverage | suite |
|---|---|---|
| drop `careLead` from `miss-real-missed` | 18/50 | **fails** ✅ |
| delete the new `sym-medical-question` page | 19/50 | **fails** ✅ |
| drop `careLead` from **`sym-severe`** — *"the symptom is severe, or something new and frightening"* | 22/50 | **ALL GREEN** |
| drop `careLead` from `vit-temp-high` | 20/50 | **ALL GREEN** |
| drop `careLead` from `vit-weight-change` **and** `sym-severe` together | 21/50 | **ALL GREEN** |

The one page in the corpus whose whole job is to route an emergency can lose its route and the suite
prints ALL GREEN. Fix: measure the top **4**, set the floor at what that actually is today, and add a
separate per-page assertion that each `careLead` id is reachable at rank ≤ 3 for at least one query
it exists to answer.

---

### V57-3 — MEDIUM — Deleting a whole help topic is now invisible to `test/v55-help.mjs`

`test/v55-help.mjs:47–48` (`const EXPECTED_TOPICS = idMatches.length` / floor `>= 117`), `:218`

Replacing the pinned `117` with a derived count is the right instinct and the Lead Developer's own
claim about it is **true** — I mutation-tested it: hardcoding the landing copy back to *"117
step-by-step walkthroughs"* fails two assertions at both widths (`logs/mut-H2.log`). But the floor
was left at the **v55 baseline of 117 while 118 shipped**, so it now has one topic of slack:

**Mutation H1 — delete the entire `sym-severity` help topic (118 → 117). All 146 assertions still
print ALL GREEN** (`logs/mut-H1.log`). Under the old pinned constant that same deletion would have
failed. And `sym-severity` is referenced in another topic's `related` array, so the mutated build
also ships a **dangling `related` id** — the suite's only related-chip assertion (`:218`) checks
that a heading called *Related* renders, nothing more. The v55 Auditor checked dangling ids by hand;
nothing in the suite does.

Fix: floor at the count that shipped (118), and add the dangling-id check. I ran it against the real
build and the shipped corpus is clean: 118 topics, 15 FAQ, 17 categories, 0 duplicate ids, 0 dangling
`related`, 0 unknown categories, 0 `careLead` without `medical` (`logs/corpus-integrity.log`).

---

### V57-4 — LOW — The new help page's title trivialises the queries that most often land on it

`index.html:2240` (`sym-medical-question`)

The page body is good and I want that on the record: I read every word rendered in the app
(`outputs/v57-audit/04-new-help-page-360.png`). It **makes no medical claim** — scanned for numbers,
thresholds, units, "is fine/safe/normal" as a judgement, "you should", "wait N": none present. It
opens with the urgent **Contact your care team** callout, its four steps give the caregiver
something to do rather than a refusal ("write it down", "ask the care team or the dispensing
pharmacist", "anything sudden, severe or frightening is a phone call now", "log the symptom with a
note"), and it closes with *"ChemoWell is a record-keeping tool, not a source of medical
information. Never delay care because of anything shown in this app."* It reads as help, not a
brush-off. It is the single best thing in this release.

The **title** is the problem. It is now rank 1 for *"her lips are turning blue"*, *"is this medicine
safe for children"*, *"does this interact with grapefruit"* and *"what are the side effects of
cisplatin"* — and it reads **"Is this a side effect? Will there be hair loss, sickness, tiredness —
is this normal?"** A caregiver looking at blue lips is offered a row about hair loss and tiredness,
which reads as the app having misunderstood — the same failure V56-6 was raised for. Suggested
replacement, leading with the refusal so the row itself carries the message:
**"Is this a side effect? Is this normal? — ChemoWell can't tell you, and here's who can."**

---

### V57-5 — LOW — The installed-Home-Screen wording says "three things" and then lists two

`index.html:3675–3678`

I rendered the `isInstalledPWA()` branch by forcing the flag on a scratch copy, since Playwright
cannot set `display-mode` here (`outputs/v57-audit/02-notice-installed-pwa-ios-360.png`). The
lead-in sentence is not branched, so an installed user reads:

> **You're using the web preview**
> Everything here works. **Three things need the phone app**, so you know before you hit them:
> **Your data is safe on this device** — You've already added ChemoWell to your Home Screen…

Two problems in three lines: only two of the three items are then things that need the phone app,
and the card is headed *"You're using the web preview"* immediately above a sentence congratulating
the reader on having installed it. Fix is one conditional string: *"Two things still need the phone
app"* plus a headline like *"Running from your Home Screen"* on that branch. The iPad detection
underneath it is correct and I verified the branch is really wired (mutation N6, below).

---

### V57-6 — LOW — Scribe bookkeeping is not done, and `BACKLOG.md` now describes code that no longer exists

- **`REQUESTS.md` has no entry for this session's request at all** — not the bubble removal, not
  "Help & FAQ", not the browser notice, not *"can this be shared via HTML"* — and no `app-v57` tick.
  TEAM.md's Scribe rule is "the moment he makes it, not at the end". This is the **third consecutive
  release** with the same miss (V55-5, V56-9).
- **`README.md` v57 version-history row is present and accurate.** ✅
- **10 `BACKLOG.md` entries now describe deleted code** (`logs/backlog-stale.txt` — the medical
  guard's tier lists, the held-out fixture's 7/72 numbers, `BY_MEASURE`'s missing `symptom` key,
  `helpbot-announce`, the panel's toast overlap, the panel-vs-page callout duplication, the bubble's
  once-per-second refocus). BACKLOG's own header says "delete the line once it's actually fixed and
  shipped". One of them (`:42`, the LIST-reply lever) should be **kept and promoted**, because it is
  the fix for V57-1.
- **`release_check.sh` and `mark_published.sh` are still committed `100644`.** The script warns about
  it and still exits 0, but TEAM.md's release-mechanics section requires `100755` and this is the
  documented way the gate dies with exit 126 after a web upload.

---

## 2. What passed — the sweep, case by case

Full pass/fail lines in `outputs/v57-audit/logs/*.log`.

### 2.1 The browser first-run notice — 87 cases, all pass

| case | result |
|---|---|
| Does **not** render during the guided tour — chemo / radiation / both / Other, wiped installs | 4/4 pass (`s1`) |
| Appears on Home after **Skip guide** — all four treatment types | 4/4 pass |
| Appears on Home after **completing the guide to Finish** — all four types, tour driven step-by-step through the real actions (Show me → Meds → Add → fill and save a medication → Home → Next ×4 → Finish) | 4/4 pass (`s1b`) |
| Is the **first** card on Home (above the vitals cards) | 4/4 pass |
| Never renders on Meds / Reports / In-Patient / Symptoms / Help | 20/20 pass |
| Survives a nav round trip while undismissed | 4/4 pass |
| **Got it** dismisses; **✕** dismisses; **Open Help & FAQ** navigates *and* dismisses | 3/3 pass (`s1c`) |
| Each control writes `"browserNoticeSeen":true` into profile prefs (read out of `localStorage`) | 3/3 pass |
| Each control still dismissed after a **full reload**, checked back on Home | 3/3 pass |
| Home renders normally after dismissal (journal section intact) | 3/3 pass |
| Triple-tapping **Got it** in one frame is harmless | pass |
| No horizontal overflow at 320 / 360 / 390 px with the notice up | 3/3 pass |
| Zero console errors in every notice flow | 11/11 pass |
| The native gate — **source level only, stated explicitly** | see §3 |

The earlier "notice missing after a completed tour" line in `logs/s1-notice.log` was **my harness's
fault**, not the app's: my first tour walker broke out of its loop at step 2 and never reached
*Finish*. The dedicated walker in `logs/s1b-tour.log` completes all ten steps for all four treatment
types and the notice appears every time. Recorded here rather than quietly deleted.

Screenshots: `01-notice-home-320/360/390.png`, `02-notice-installed-pwa-ios-360.png`.

### 2.2 Is anything broken by the bubble's absence? — 15 cases, all pass

| case | measured |
|---|---|
| Toast bottom offset reverted `150px` → `96px` | `bottomGap: 96`, `pointerEvents: none`, `zIndex: 50`, clears the nav |
| Back-to-reports pill reverted `91px` → `88px` | `bottomGap: 88`, 26 px clearance above the nav, returns to the Reports index |
| `render()`'s focus restore still works for a focused id'd button | `drawer-close-btn` still focused 2.6 s (3 ticks) later |
| 1 s tick still excludes the Help view | `#help-search` node identity survives 2.6 s, marked attribute intact |
| Help search eats no keystrokes | 37 characters typed at 90 ms (3+ tick boundaries) arrive complete, caret at the end, correct page ranked first |
| Help view keeps its scroll across ticks | scrollY 400 → 400 |
| No `helpbot` CSS rule survives in the stylesheet | none |
| No help-bubble symbol survives in shipped code | 0 of 12 checked names; `send` icon gone; `focusin` handler back to its pre-v56 form; no orphan `visualViewport` listener |
| z-index census on Home | one element ≥ 30 (the nav at 35) — no orphan layer where the bubble's z37 was |
| Offline reload renders the app and the Help search still works | pass |

### 2.3 Full-app sweep — 4 profiles, 87 cases

Chemo/Rita (tour completed), Radiation/Sam (tour completed), Both/Ada (tour skipped), Other/Ken
(tour skipped). **8 medications** covering: as-needed with gap timer, scheduled, all three limit
units (mg / pills / applications), real daily limits, notes, and every Home-screen placement (own
card, morning group, afternoon group, evening group, no card). **3 simulated days** each, via the
beta date controls.

Every one of these passed for every profile: all medications listed on Meds with their rules echoed;
a dose logged on each of 3 days; temperature, weight and blood pressure cards showing the latest
reading; Today's journal populated; a symptom logged and listed; History spanning all three dates
(via *Show all* — it correctly defaults to today); Weight report trend and Blood Pressure report
both showing the real readings; a **real CSV download** containing the medication doses, Temperature,
Weight, Blood Pressure and Nausea rows across **three distinct dates**; zero console errors.
(`logs/s4-sweep2.log`, `logs/csv-*.txt`, `export-*.csv`,
`05-home-populated-chemo-360.png`, `06-history-3days-chemo-360.png`, `08-history-show-all-360.png`.)

Notes and Calendar were verified separately once the correct save controls were identified
(`logs/s5-edge.log`, `logs/s6-edge2.log`, `09-appointment-saved-360.png`): a note saved and listed
under its date; an appointment saved via the day-section **Add** and shown on the day. The
top-of-page **Add** on Calendar correctly refuses without a date. The 15 red lines in
`logs/s4-sweep2.log` are all my harness clicking the wrong button or missing a confirm step — each
was re-driven correctly afterwards and passed. Nothing in that file is an app defect.

### 2.4 Edge cases — 12 cases, all pass

Daily limit is stored and displayed (*Rules: Min 4-hour gap · Daily limit 4000 mg*) and stops
further logging; double- and triple-tapping a dose button produces no error and no silent double
log; temperature `999` is rejected with *"Enter a valid temperature in °F (86–113)"*; blood pressure
`9999/9999` with *"Enter a valid reading, e.g. 120 over 80."*; crossing a simulated day boundary
empties Today's journal; empty states render on untouched reports; the Help search empty state
renders for gibberish; the bottom nav is **not** tappable through an open modal (`elementFromPoint`
at the centre of *Reports* returns the dialog, not the nav — the V56-2 shape does not exist here);
offline reload works.

### 2.5 The four shipped suites, re-run in full

| suite | result |
|---|---|
| `test/v57-search.mjs` | 22/22 — ALL GREEN. 53/53 exact, 23/50 care coverage, 1.72 ms/query |
| `test/v57-browser-notice.mjs` | 50/50 — ALL GREEN |
| `test/v55-help.mjs` | 146/146 — ALL GREEN |
| `test/v52-fixes.mjs` | 20/20 — ALL GREEN |

---

## 3. Judging the new suites by breaking the code (the v56 lesson)

17 mutations applied to `index.html`, each run against the suite that claims to pin it.
`logs/mutation-results.txt`, individual outputs in `logs/mut-*.log`.

**`test/v57-browser-notice.mjs` is honest. Every mutation was caught** — including the ones I most
doubted:

| mutation | caught? |
|---|---|
| N4 the **✕** no longer dismisses | ✅ `[X path] the X dismisses the notice` |
| N10 **Got it** no longer dismisses | ✅ both the dismiss and the reload assertion |
| N5 **Open Help & FAQ** navigates but does not dismiss | ✅ the reload assertion at both widths — this is the assertion §3.2 says was rewritten, and the rewrite worked |
| N7 the notice **never renders at all** | ✅ 8 assertions |
| N6 iOS wording always used | ✅ the branch assertion, both widths |
| N9 the 7-days data-loss sentence deleted | ✅ |
| N11 controls shrink to 20 px | ✅ the 44 px floor |
| N1/N2/N8 each gate deleted from `browserNoticeDue()` | ✅ (source level) |
| N3 dismissal writes `setState` only | ✅ (source level) |

One environment note for whoever runs it next: the file hardcodes `http://127.0.0.1:8899`, so if the
server is pointed at a different tree the UI half silently tests the wrong bytes while the source
half tests the right ones. I hit this myself on the first mutation pass and re-ran everything with
the mutated tree actually served.

**`test/v57-search.mjs` — 6 of 6 applied mutations caught**, including deleting the new help page
(19/50, fails), removing its `careLead` flag, restoring a `HELPBOT_*` symbol, un-sorting
`helpSearch`, deleting the `HELP_POINTERS` fold-in, and pointing the search box back at the bot's
stopword list (the LA-2 regression). Its weakness is not a hollow assertion — it is the threshold,
which is V57-2.

**`test/v55-help.mjs` — one mutation missed**, which is V57-3.

---

## 4. What I could NOT verify from this environment

Each named with the reason, plus whatever half of it *was* testable.

- **The native (Capacitor) path.** Capacitor's CDN bridge cannot load in this sandbox
  (`ERR_CERT_AUTHORITY_INVALID`), so `isNativeApp()` is always `false` here and the native build
  cannot be exercised. **Verified instead, and stated as source-level:** `browserNoticeDue()`
  (`index.html:605–607`) is `state.prefsLoaded && !isNativeApp() && !state.browserNoticeSeen &&
  state.tourStep == null`; `isNativeApp()` (`:116–119`) is the same try/caught `Capacitor.
  isNativePlatform()` check every other native-only path in the app uses; and mutation N1 proves the
  gate is genuinely asserted rather than merely present. I am satisfied the notice cannot render in
  the native shell, but I have not seen it not render.
- **iOS Safari's 7-day data eviction** — the fact the notice's most important sentence rests on. No
  WebKit build here. The claim is accurate as far as I know it, but it is a platform behaviour, not
  something this repo can test.
- **The installed-PWA branch as a real install.** `display-mode: standalone` is not settable from
  this Playwright build; I forced `isInstalledPWA()` on a scratch copy to read the copy (V57-5).
- **Real OS notification delivery, the native share sheet, the hardware Back button.** Browser-only
  sandbox; unchanged by this release either way.
- **Screen readers.** No AT available. The notice's ✕ carries `aria-label="Dismiss"` and the two
  text buttons are real buttons; nothing more can be said.
- **The live deployed site.** No outbound access. The post-push cache-buster smoke test still has to
  happen.

---

## 5. Recommendation

Back to the **Lead Developer** under the **full-restart** tier: V57-1 is safety-relevant.

1. **V57-1 (High).** Put the care-team route on the search-results screen and give the results list
   a coverage floor. Do not restore the guards. `BACKLOG.md:42` already specifies the shape and
   `helpScore` already returns the numbers needed; the deleted `0.34` list-path floor was measured
   against both of the Lead Auditor's v56 sets and should be reused rather than re-guessed. Re-run
   the 53-question fixture afterwards — a floor that starts emptying "export to excel" is its own
   defect.
2. **V57-2 (Medium).** Measure the top 4, not the top 8; floor it at what that is; add a per-page
   reachability assertion so `sym-severe` cannot silently lose its route.
3. **V57-3 (Medium).** Floor `EXPECTED_TOPICS` at 118, and assert no `related` id dangles.
4. **V57-4 / V57-5 (Low).** Two copy lines. Both are pure wording and qualify for TEAM.md's targeted
   fix tier — but V57-4 is copy a frightened caregiver reads while deciding whether to call, so per
   TEAM.md's copy-review section I am flagging it explicitly as worth a real copywriter's or
   clinician's eye rather than resolving it in-chain.
5. **V57-6 (Low).** Scribe: `REQUESTS.md` entry + tick, delete the 10 dead `BACKLOG.md` items
   (keeping and promoting `:42`), `git update-index --chmod=+x` both scripts.

**What is genuinely good here and should not be re-opened:** the bubble removal is complete and
clean — no orphan symbol, no orphan CSS, no orphan listener, both reverted offsets exact, the tick
guard and focus restore both correct, and 46,000 characters gone with zero console errors anywhere
in 225 driven cases. The browser notice is well-built, correctly gated, correctly persisted, and its
test suite is the most honest one this project has shipped. The new help page's copy is right. The
release mechanics pass.

**Nothing was committed by this stage.**

---
---

# ROUND 2 — re-verification of the round-1 fixes

**VERDICT: READY.**

**The High (V57-1) is closed. The two Mediums are closed and I proved both by mutation. Three new
Low findings, none of them a behaviour defect — two hollow assertions, one 320px-only visual
collision. Nothing here blocks the release.**

**Date:** 2026-08-13. **Under test:** commit `e83aed7`, working tree clean, `index.html` md5
`907a70f5fe48e90678dd1ba23037684d`.
**Server discipline, after round 1's incident (which I caused):** every browser measurement in this
round ran against `http://127.0.0.1:8902`, served from the repo and md5-verified against
`md5sum index.html` before use and again afterwards. The four shipped suites hardcode `:8899`; I
verified that port's md5 immediately before and after each run (`907a70f5…` both times). Mutation
runs served `/tmp/mut2` on a **private port 8905** with the suites' URL rewritten in the copy, so
`:8899` was never repointed. All servers I started are killed.

**Round-2 cases: 1,684.**
- **142** driven through the real UI (`logs/r2-strip.log`, `r2-regress.log`, `r2-sweep.log`,
  `r2-spot.log`, `r2-toast-strip.log`).
- **1,234** headless relevance probes attacking the new floor and cap (`logs/r2-floor-probe.log`,
  `r2-floor-vs-cap.log`).
- **28** mutation cases against the new assertions (`logs/r2-mutation-search.txt`,
  `r2-mutation-ui.txt`, `r2mut-*.log`).
- **280** assertions from the four shipped suites, all re-run green.

---

## R2.1 — V57-1 (High): CLOSED. The unconditional strip is enough, and here is why I think so

**Measured, in the running app, at 360 px, on every query type I could think of** (`logs/r2-strip.log`):

| | |
|---|---|
| strip renders above the first result row | **11 / 11 queries**, including the zero-result empty state |
| whole strip **and its 44 px button** above the fold with no scrolling | **11 / 11** — strip occupies y=360–576, fold at 710; first result row at y=610 |
| 390 px | strip 360→526, fold 754 ✅ |
| 320 px (tightest) | strip 360→583, fold 630 ✅ |
| routes to `sym-severe` in one tap, scrolled to top | ✅ |
| Back returns to the search results **with the query intact** | ✅ (`she collapsed` still in the box, strip still there) |
| renders offline | ✅ |

**The judgement you asked for.** Yes, this is enough, and it is a better fix than the one I
recommended. Reading order at 360 px is now: the person's own words in the box at y≈306 → *"ChemoWell
holds no medical information and can't tell you whether something is serious. For anything about
symptoms, doses, or how someone is feeling, contact the care team."* at y≈415 → a dark filled 44 px
button at y≈519 → and only then, at y=610, *"All my medications vanished from Home"*. The wrong
answer is no longer the first thing on the screen; it is the fourth. The filled button is the single
strongest visual element on the page — it does not read as boilerplate, because there is no other
boilerplate near it and nothing else on the screen is filled. And the page it lands on does the job:
sym-severe opens *"Contact the care team, or emergency services if it's urgent. Do that first.
Logging it in the app can wait — this app has no way to judge how serious something is, and it will
never try to."* That is the sentence a frightened caregiver needs, and it is two taps from typing
their own words. Evidence: `R2-01-strip-she-collapsed-360.png`, `R2-02-sym-severe-from-strip-360.png`,
`R2-03-strip-unresponsive-360.png`, `R2-03-strip-empty-360.png`, `R2-04-strip-320.png`.

**On leaving "she collapsed" ranking the medication page: I accept it.** Going unconditional rather
than classifying is the right call and I was wrong to recommend the conditional form — a classifier
is the thing that failed twice, and an unconditional strip is a property that can be *proved* rather
than tuned. A wrong-but-inert list title *below* a correct instruction is a nuisance; it was a hazard
only while it was the first and only thing on the screen. It no longer is.

**Two Low copy points, below (R2.5). Neither blocks.**

**One cost, recorded rather than raised as a defect:** the strip pushes the visible result count at
360 px from 4 rows to **2**. That is the right trade, but it means the coverage floor's stated
rationale ("the 4 rows a phone actually shows") now describes the pre-strip layout. The floor is
conservative in the safe direction and the strip makes the metric secondary, so this is a comment
fix, not a code one.

## R2.2 — The relevance floor: I attacked it and could not break an ordinary search

**1,164 exhaustive probes** — every one of the 118 topics' own keywords, plus every title bigram and
trigram — asking one question: *was this page reachable in the top 12 before the floor, and is it
gone now?*

> **cut by the FLOOR: 0. hidden by the CAP: 0.** (`logs/r2-floor-vs-cap.log`)

Plus **56 hand-written natural queries** deliberately avoiding the 53-question fixture, topic titles
and keywords ("pin the app to my home screen", "count in pills not mg", "reminders stopped working
after a few days", "who can see my data"). Two came back changed, and both are false alarms: `pro-add`
for *"add a second patient"* was at **rank 29 of 57** before, and `app-old-version` for *"app is out
of date"* at **rank 21 of 69** — neither was reachable by a human being scrolling. Every other query
kept its right answer.

Mutation-tested in both directions (`logs/r2-mutation-search.txt`): raising the floor to 0.90 fails
the suite, lowering it to 0.001 fails it, removing the cap fails it, and hiding the true total behind
a plain "N results" fails it. The constants are genuinely pinned.

**One observation, no instance found:** there is no "show more", so a page ranked 13+ is now
unreachable *through search* where before it was merely deeply buried. 0 of 1,164 probes and 0 of 56
queries showed that costing anything, and category browse is unaffected.

## R2.3 — V57-2 and V57-3: closed, and proved by re-running my own mutations

| mutation | round 1 | round 2 |
|---|---|---|
| drop `careLead` from **`sym-severe`** | ALL GREEN | **CAUGHT** — `sym-severe is still flagged careLead` fails |
| drop `careLead` from `vit-temp-high` | ALL GREEN | **CAUGHT** — coverage 14/50 against the floor of 18 |
| delete one help topic (118→117), leaving a dangling `related` | ALL GREEN | **CAUGHT twice** — the ratcheted floor *and* `sym-log -> sym-severity` |
| delete a topic nothing links to (`rep-history-slow`) | — | **CAUGHT twice** — floor, and `miss-clear-all -> rep-history-slow` |
| drop `careLead` from `vit-weight-change` | ALL GREEN | still ALL GREEN — **one page of residual slack, see R2.4** |

## R2.4 — NEW: three hollow assertions among the round-2 additions (all Low)

You were right that there were more. In each case **the code is correct — I verified the behaviour
myself — and only the test is hollow.**

**R2-A — LOW — `test/v57-search.mjs`: "the results screen carries the care-team sentence
unconditionally (no `?` gate on it)" cannot detect a gate.**
The check is `!/\?[\s\S]{0,120}ChemoWell holds no medical information/`. I wrapped the strip in a
ternary (`searchRes.cov < 0.5 ? h('section', … ) : null`) — the `?` then sits ~200 characters before
the sentence, past the style object, so the window never sees it. **STILL ALL GREEN.** I then wrote
the same gate with `&&`, which the regex does not look for at all. **STILL ALL GREEN.**
*Mitigation, and why this is Low not Medium:* the same two mutations are **CAUGHT by
`test/v57-browser-notice.mjs`**, which types four queries into the real UI and asserts the sentence
and the route are on screen for each — including `export to excel`, the high-coverage query a
`cov`-based gate would suppress. The safety property is genuinely pinned; it is this one source-level
line that is decorative. Fix: assert on the rendered DOM, or delete the line and let the browser
suite own it.

**R2-B — LOW — `test/v57-browser-notice.mjs:` "S2 dismissing returns the viewport to the top of Home"
passes with `scrollToTop()` deleted.**
Deleting the `scrollToTop()` call from `dismissBrowserNotice()` leaves the suite **ALL GREEN**,
because at the point it taps "Got it" the page has never been scrolled, so `scrollY` was already 0.
This is the identical shape to the v56 defect that "measured scroll while the panel was suppressed".
The behaviour itself is correct — I scrolled to y=400 first and dismissal returned to 0
(`logs/r2-regress.log`). Fix: `window.scrollTo(0, 400)` before the tap.

**R2-C — LOW — `test/v55-help.mjs:` "careTone is only ever set on a topic that is also careLead"
cannot fail.**
I added `careTone: "calm"` to `sym-log`, which is not `careLead`. **STILL ALL GREEN.** The regex
`/\{ id: "[^"]+",[\s\S]*?careTone: "[^"]+"[^}]*\}/g` is lazy from the *first* topic in the block, so
every captured chunk spans intervening topics and picks up somebody else's `careLead: true` before
the `.filter()` runs. Fix: match per line (`topicsBlock.split('\n')`), which is how the file's other
per-topic checks work.

**R2-D — LOW/observation — one page of residual slack in the coverage floor.** Dropping `careLead`
from `vit-weight-change` alone still prints ALL GREEN. It is the least clinically loaded of the five
and `sym-severe` is now pinned by id, so I am not asking for another round over it — but pinning all
five by id costs one line and removes the class.

**What the round-2 additions DO catch** (all mutation-verified, `logs/r2-mutation-ui.txt`): the strip
deleted; the strip routed to the wrong page; the strip made conditional (both forms, via the browser
suite); the cap removed; the true total hidden; the floor moved either way; the ✕ shrunk to 28 px;
read-more dismissing again; read-more landing on the Help landing; the Safari sentence shown to
Android; the card grown back over 620 px; the calm page wearing red again; the calm heading reverted;
the calm callout not rendering at all. **14 of 17** applied mutations caught. Your own S8 fix is real
— all three S8 mutations go red.

## R2.5 — NEW: two copy points and one 320px collision (all Low)

**R2-E — LOW — at 320 px a live toast completely covers the strip's safety button.**
`index.html:3329` (the toast's `bottom` is lifted only for `state.view === 'reports' && state.reportsView`).
Measured at 320×720: toast occupies y=522–624, the button y=539–583 — **44 px of vertical overlap,
160 px horizontal: the button's entire height, hidden for the toast's ~4.5 s life.** It stays tappable
(`pointerEvents: none`, hit-tested and confirmed), and 360/390 px are clear (−58 px and −140 px).
**Repro:** log a dose on Home → menu → **Help & FAQ** → type a query within 4.5 s, at 320 px.
Evidence: `R2-FINDING-toast-over-strip-320.png`. This is the same collision class Designer M3 was
raised for; the M3 fix considered only the Reports pill. **Fix:** add the search-results screen to the
lift condition — `(state.view === 'reports' && state.reportsView) || (state.view === 'help' && helpQuery.trim())`.

**R2-F — LOW (copy) — the strip's heading is the weakest sentence in it.**
*"This searches the app's own help pages"* is a statement about the search box. At a glance — which is
all a frightened person gives it — the bold heading is what is read, and it is the one line that does
not carry the message. Suggested: **"ChemoWell can't tell you if something is serious"**, with the
existing sentence unchanged beneath it.

**R2-G — LOW (copy) — the button's "them" has no antecedent if read alone.**
*"When to contact them straight away"* depends on the sentence above it. Suggested: **"When to call
the care team straight away"**.

Per TEAM.md's copy-review section I am flagging R2-F and R2-G explicitly as high-stakes copy — this is
text someone reads while deciding whether to phone — and both qualify for the targeted-fix tier
rather than another full round.

## R2.6 — Regression sweep

Scoped to the round-2 diff (notice card restructure, toast offset, help search/results, sym-medical-question,
rem-web-vs-app, `pageHead` colour, `scrollToTop`), plus two full profiles end-to-end. **142 cases, 3 red,
all three explained below.**

**The notice card, four treatment types from wiped installs, two via *Skip guide* and two via the
complete guided tour to *Finish*:** hidden during the guide 4/4; appears on Home 4/4; **card height
548 px** (was 919), **body column 291 px** (was 207), **✕ 44×44**, zero horizontal overflow — identical
on all four. The Safari sentence is correctly absent on this non-iOS UA. (`R2-05-notice-card-360.png`.)

**Read-more:** deep-links straight to `rem-web-vs-app`, never the Help landing; that page carries
everything taken out of the card — the 7-day Safari detail, the reminders point, the exports point,
**both** platform instructions, and the on-device promise; it has a working Back row; and it **does
not dismiss** the notice. Opening Help from the menu afterwards correctly lands on the landing page,
so the `navigateTo` → `setState` ordering leaves no stale deep link. Double-tapping read-more is
harmless. (`R2-06-rem-web-vs-app-360.png`.) **My answer to your question 3: nothing a tester needs was
lost — the card kept all three headlines and the detail is one tap away.**

**Toast (M3):** 96 px on a normal screen, **142 px on the Reports detail**, and the pill collision is
gone — toast bottom 658 vs pill top 670, **12 px clear**. (`R2-07-toast-over-pill-360.png`.)

**`careTone` (your question 4):** the concept holds up in the rendered app. `sym-medical-question` now
shows **"Ask your care team"** on the amber attention border (`rgb(181,118,30)`), while `sym-severe`
keeps **"Contact your care team"** on the urgent red (`rgb(192,69,59)`). The shortened title renders
correctly. The flag's risk is that it has one consumer — which is exactly what R2-C fails to guard, so
fixing R2-C is what makes the concept safe rather than the concept being wrong.
(`R2-09-caretone-calm-360.png`.)

**Bubble-absence regressions still hold:** `HELP & FAQ` eyebrow measured `rgb(122,46,8)`; 37 characters
typed at 90 ms into the Help search arrive complete with the right page first; Help view keeps its
scroll across ticks; no `helpbot` CSS.

**Two profiles end-to-end** (Chemo, Both), each: medications with every placement/unit/mode, **a daily
limit stored and echoed** (`Rules: Min 4-hour gap · Daily limit 4000 mg` — the round-1 red on this was
my harness filling the field before it unlocked), a dose logged on each of 3 simulated days,
temperature/weight/BP on each day, a symptom, a note, an appointment, History spanning 3 dates,
Weight and Blood Pressure reports, and a **real CSV carrying every type across 3 dates**. Absurd
temperature and blood pressure still rejected with the right message. App renders offline after a
reload and **the care-team strip renders offline too**. Zero console errors in every run.

**The 3 red lines in the round-2 logs:** two are the same daily-limit harness artifact (disproved
above), one is R2-E.

## R2.7 — Release mechanics and bookkeeping (V57-4/5/6 re-verified)

`./release_check.sh` exits **0**. All three `.sh` files are committed **100755**
(`release_check.sh`, `mark_published.sh`, `.github/scripts/android_smoke_test.sh`). `REQUESTS.md` has
a v57 entry and an updated "Next up". `BACKLOG.md` has 8 entries annotated **CLOSED app-v57**. One
stale entry remains — the *"7 of 72 medical questions"* item, which names `test/v56-guard-heldout.mjs`
and the deleted guard; its underlying observation now belongs to the search box, so it wants
re-pointing rather than deleting. One line, not a blocker.

## R2.8 — Still not verifiable here

Unchanged from round 1 and re-stated rather than assumed: the native Capacitor path (gate verified at
source and by mutation, never observed); iOS Safari's 7-day eviction; a real installed PWA
(`display-mode` forced on a scratch copy to read the branch); real OS notifications, the share sheet,
the hardware Back button; screen readers; the live deployed site.

---

## Round 2 recommendation

**READY.** The High is closed by a fix that is better than the one I proposed, and it is closed
structurally — the property is guaranteed by the render path, not by a threshold, and it is pinned by
a test that goes red when I break it. Both Mediums are closed and I proved it by re-running the exact
mutations that beat them in round 1.

The seven Low items (R2-A … R2-G) are three hollow assertions, one page of metric slack, one 320 px
toast overlap and two copy lines. **None of them changes what the app does for a user**, and I would
not hold a release for any of them. They belong in the next release's first commit, or in
`BACKLOG.md` with the reason. If one is picked up now, make it **R2-E** — it is the only one a user
can see — and it is a single boolean in the toast's `bottom`.

**Nothing was committed by this stage.**

**Server state, left clean on purpose:** every `python3 -m http.server` in this sandbox is now
killed — **8899, 8902 and 8905 are all free**, and `/tmp/mut`, `/tmp/mut2` and `/tmp/pwawt` are
deleted. Port 8899 included: round 1's incident happened because a server of unclear provenance was
left on a well-known port, so leaving one behind — even a correct one — is the thing to avoid. Before
the next browser-suite run, start 8899 against this repo and check
`curl -s http://127.0.0.1:8899/index.html | md5sum` equals `md5sum index.html`
(`907a70f5fe48e90678dd1ba23037684d` at `e83aed7`).
