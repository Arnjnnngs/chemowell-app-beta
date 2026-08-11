# LEAD AUDITOR v56 — review of the Auditor's report and the Lead Developer's fixes

**VERDICT: NOT READY.** One **High** regression introduced by the fix for V56-1: the ten new guard
patterns now refuse **24 of 35 ordinary app questions** (21 of them newly, five of which had a
correct confident answer before the fix), while catching **one** extra clinical question out of 50
I invented. Plus one **Medium** pre-existing regression in the *Help view's* search box that both
gates missed — typing the word **"help"** on the screen titled *Search help* returns **"Nothing
matched that"**, where v55 returned results. Two of the Lead Developer's own new regression
assertions are **hollow** (proved by mutation testing: delete the code they claim to pin and both
suites still print ALL GREEN), and a third reads the wrong element entirely.

**Stage:** Lead Auditor (Quality Chain stage 6). **Date:** 2026-08-11.
**Under review:** `outputs/AUDIT_v56.md` (Zero Day Auditor, verdict NOT READY, 452 cases) and
commit `0543e42` ("fix every Designer and Auditor finding").
**Builds tested side by side, both served as real bytes over HTTP:**
- pre-fix `9dddf15`, `index.html` md5 `c9400ba3470a8e9b7c710b0eeb6eb3e0` (matches the hash the
  Auditor recorded — they tested the bytes they said they did), scratch worktree on `:8898`
- fixed `0543e42`, md5 `0ab0dc793510950fd7017ff0ba92ce23`, working repo on `:8899`
- v55 baseline `864aeaf` on `:8896` for the "did this change signed-off behaviour" comparison
- a mutation copy on `:8897` for judging the test suites

**Evidence:** `outputs/v56-lead-audit/` — 10 suites (`a-…` … `j-…`), `mutate.py` +
`mutation-results.log` (mutation testing of the developer's own assertions), pre/post guard logs,
11 screenshots. No `git reset` was used anywhere; the pre-fix build is a `git worktree`. Nothing
committed.

---

## 1. Verdict on each of the Auditor's eleven findings

Every finding was reproduced on `9dddf15` before being re-tested on `0543e42`. **None is a false
positive.** The Auditor's report is accurate, its evidence is real, and its two "this is a spec
weakness as much as an implementation one" judgements (V56-6, V56-8) are fair.

| ID | Auditor's claim | Reproduced on 9dddf15? | Fixed on 0543e42? | My verdict |
|---|---|---|---|---|
| V56-1 | clinical questions get a normal app answer | **Yes** — both named cases, plus 18 more of my own | **Partially, and at a cost** | **Real; fix over-corrects — see LA-1** |
| V56-2 | panel survives nav, blocks Meds *Add* | **Yes** — `elementFromPoint` at the Add button returned a node inside `#helpbot-panel`; resurrection after Help → Home confirmed | **Yes** — panel closes, Add reachable, no resurrection (`h-verify` H1) | real, closed |
| V56-3 | focus drops to `<body>` one tick after Escape | **Yes** — BODY at 1.7s and 4.1s | **Yes** — `helpbot-fab` at 0.1 / 1.7 / 4.1s (`c-focus-blast` C1) | real, closed; **blast radius is small — see §3** |
| V56-4 | transcript scroll lost on re-render | **Yes** | **Yes** — scroll held at 9427 across an unrelated re-render (`e-gaps` E5b) | real, closed (**but its regression test is hollow — LA-4**) |
| V56-5 | `helpBotLog` uncapped | **Yes** — 60 children where the fixed build stops at 40 | **Yes** — capped at 40 (`h-verify` H4) | real, closed (**hollow test — LA-4**) |
| V56-6 | guard routes to a topically wrong care-team page | **Yes** — sugar→**weight** page, rash→**fever** page, cough→**weight** page, antibiotics→**missed-dose** page, all four verbatim | **Yes** — all four now the generic care-team copy; fever/temperature and missed-dose still route correctly | real, closed; **the `dose` pattern is safe — see §4** |
| V56-7 | panel keeps its layout after rotate | **Yes** — 784px wide in landscape | **Yes** — 380px card in landscape, 344px full-bleed back in portrait | real, closed |
| V56-8 | `focusin` auto-scroll not excluded from the panel | Code fact confirmed; as the Auditor said, no observable consequence in Chromium | **Yes** — exclusion added | real (spec item), closed |
| V56-9 | release bookkeeping not done | **Yes** | **Yes** — `BACKLOG.md:42` deleted and replaced with the §4.2 known-gap entry, README row added, `REQUESTS.md` ticked, `release_check.sh` exits 0, `APP_VERSION`/`CACHE` consistent (`app-v56` / `chemowell-app-v56-2`) | real, closed |
| V56-10 | one hollow assertion in `test/v56-matcher.mjs` | **Yes** | **Yes, properly** — mutation-tested: removing the `HELP_POINTERS` fold-in now fails **two** assertions (`missing from vit-units.kw: change, temperature, or, weight`) | real, closed |

The Auditor's severity calls are right. If anything V56-6 was under-rated: telling a caregiver
asking about a **rash** that "a **fever** can be an emergency" is not just a bad match, it is the
app confidently naming the wrong emergency.

---

## 2. LA-1 — HIGH — the V56-1 fix refuses two-thirds of ordinary app questions

`index.html:6152–6161` (the ten new `HELP_GUARD_ADVICE` patterns)

The Auditor's own recommendation said it in advance: *"a guard that starts refusing 'how do I
export a CSV' is its own defect"*, and the commit message claims *"the suite also asserts none of
them fire on the 53 ordinary questions"*. That assertion is live but **cannot fail on the new
patterns**: the 53-row fixture contains not one question with the words *safe, food, child, side
effects, allergy, too many, split, liver* or *how long*. I wrote 35 ordinary app questions that do,
in a caregiver's phrasing, and ran them through the real panel on both builds.

**Measured, both builds, same 35 questions, same profile (`a-guard-PRE.log` / `a-guard-POST.log`):**

| | pre-fix `9dddf15` | fixed `0543e42` |
|---|---|---|
| ordinary app questions refused as clinical | **3 / 35** | **24 / 35** |
| of which lost a *correct confident answer* | — | **5** (ANSWER → refusal) |

**21 questions newly refused.** The five that had a right answer and now do not:

| typed | pre-fix | fixed |
|---|---|---|
| `where do i put take with food` | answers *"Where do I put instructions like 'take with food'?"* — the exact page | **"That's a question for the care team."** |
| `how do i log side effects` | answers the symptom-logging walkthrough | **refused** |
| `is my data safe` | answers *"Is my information stored on a server somewhere?"* | **refused** |
| `i logged too many doses by mistake` | answers *"How do I delete something I logged by mistake?"* | **refused** |
| `how do i split the dose into morning and evening` | answers the scheduling page | **refused** |

Sixteen more went from a useful list to a refusal, including `what does the allergy field do`,
`where do i put allergies`, `can i set up a profile for a child`, `i get too many reminders how do
i turn some off`, `how long does the export take`, `is my backup safe if i change phones`.

**Evidence:** `outputs/v56-lead-audit/LA1-take-with-food-{pre,post}-360.png`,
`LA1-is-my-data-safe-{pre,post}-360.png`, `LA1-log-side-effects-{pre,post}-360.png`,
`a-guard-POST.log`.

**And the clinical side barely moved.** Same run, 50 clinical questions the Auditor never tried:

| | pre-fix | fixed |
|---|---|---|
| routed to the care team (generic or paged) | 9 / 50 | **10 / 50** |
| still get a normal app reply (ANSWER or LIST) | 18 / 50 | **17 / 50** |

Ten new patterns bought **one** extra clinical catch and cost **21** legitimate answers. Questions
still getting a list of app pages include `her lips are turning blue` (→ *Alarms & reminders*),
`she is coughing up blood` (→ *How do I record blood pressure*), `he has a nosebleed that wont
stop` (→ *Alarms & reminders*), `her white count is low what does that mean` (→ *The screen is
blank*), `what cream can i put on the radiation burn` (→ *How do I track radiation sessions*).

**Which patterns are doing the damage** (`a-guard-POST.log`, attribution run in §evidence):

| pattern | ordinary questions it wrongly catches |
|---|---|
| `/\bis\s+.{0,24}\b(safe\|ok\|okay\|dangerous\|harmful\|toxic)\b/` | **7** |
| `/\b(too\s+(many\|much)\|how\s+long\s+(should\|do\|does))\b/` | **6** |
| `/\bsafe\s+(for\|to\|with\|in\|during)\b/` | 4 |
| `/\bwith\s+(food\|milk\|alcohol\|grapefruit\|…)\b/` | 3 |
| `/\b(allerg\|pregnan\|breast\s*feed\|kidney\|liver)\w*\b/` | 3 |
| `/\bfor\s+(a\s+)?(child\|children\|kid\|…)\b/` | 2 |
| `/\bside\s*effects?\b/` | 2 |
| `/\b(crush\|split\|chew\|halve\|dissolve)\s+(the\|a\|…)\b/` | 1 |

`/\b(too\s+(many|much)|how\s+long\s+(should|do|does))\b/` has no clinical content whatsoever — it
fires on *"how long does the export take"*. And `.{0,24}` in the first pattern is a wildcard that
makes *any* sentence containing "is … safe" clinical, which is precisely what a privacy question
looks like in this app.

**Mutation-tested:** deleting `/\bis\s+.{0,24}\b(safe|…)\b/` outright leaves **both** developer
suites printing ALL GREEN (`mutation-results.log`, mutation F). The single most damaging pattern is
pinned by nothing.

**Recommendation.** Narrow, do not widen. `with food`, `too many`, `how long does`, `allerg`,
`liver`, `for a child` and `split the` are app vocabulary before they are clinical vocabulary in a
medication-*logging* app. Require a clinical subject next to the judgement (a drug name, a body
part, a symptom noun) rather than keying on the judgement alone — and extend the fixture with the
35 questions in `a-guard.mjs` so the false-positive assertion can actually fail.

---

## 3. V56-3's blast radius — checked, and it is genuinely small

Adding `BUTTON` to `render()`'s focus-restore list touches every button in the app *that has a
stable `id`*. I enumerated every id'd element at runtime in every state the fix could reach
(`d-idsurvey.mjs`, `c-focus-blast.mjs` C0):

- Home / Meds / Reports / In-Patient / Symptoms: `DIV#root`, `BUTTON#helpbot-fab` — nothing else.
- Guided tour: `#tour-layer`, `#tour-scrim`, `#tour-card` — **no id'd button**.
- Medication editor: `SELECT#med-daily-limit-unit`, `INPUT#med-doses-text`, `INPUT#med-daily-limit`
  — **no id'd button**.
- Drawer: `BUTTON#drawer-close-btn` (only while open).

So the change affects exactly **two** buttons: the help bubble and the drawer close. Both are
`position: fixed`, so the re-`focus()` cannot steal the page scroll — measured: `scrollY` 352 → 352
across two ticks with the bubble focused (C2). The drawer close keeps focus across ticks and, once
the drawer is gone, focus falls to `<body>` without resurrecting a dead node (C3/C3b). Tap-to-arm
delete confirms are unaffected (no id'd control). **No regression found.**

One consequence worth knowing rather than fixing blind (**open, unverifiable here**): the fix works
by destroying and re-focusing a brand-new node every tick, not by preserving one. Measured
**7 `focusin` events on `#helpbot-fab` in 6 idle seconds** (`j-refocus.mjs`). On a desktop browser
that is invisible. With TalkBack or VoiceOver running, a focus event per second on the same control
is the kind of thing that reads as the control being re-announced continuously. It needs one pass
on a real device with a screen reader before this is called closed.

---

## 4. V56-6's `BY_MEASURE` map and the `dose` pattern — safe, in my judgement

The `dose` entry is defensible and is **not** a reintroduction of the guessing. Three things gate
it, all of them patterns:

1. the guard must already have fired (an advice/judgement pattern matched);
2. the query must contain a dose verb (`missed|double|skip|skipped|catch up`) **and** a medication
   noun — both from a fixed list, no scoring;
3. `miss-real-missed` must itself score ≥ `HELPBOT_SHOW` **for that query** — a topic that is not a
   plausible match still falls through to the generic copy.

Probed live (`e-gaps.mjs` E1, 15 questions, both builds): `should i give the missed dose now`,
`should i double up on his tablets` and `should i skip her pill tonight` all reach the missed-dose
page, whose own answer *is* that question. None of the four V56-6 mis-routes comes back. Two
questions became *less* specific than before the fix — `is it ok to give the tablet late` and
`should i skip the dose because of the fever` now get the generic refusal where they used to get
the missed-dose page — because the pattern has no word for *late/early/forgot*, and because `temp`
is tested before `dose`. Both outcomes are safe; this is a helpfulness gap, not a defect, and is
worth a `BACKLOG.md` line rather than a fix now.

One dead branch: the guard can return `measure: 'symptom'`, and `BY_MEASURE` has no `symptom` key,
so `wantId` is `null` and `helpMatch(q)` is computed and then discarded on every symptom-shaped
clinical question. Harmless, but the call can be skipped when `wantId` is null.

---

## 5. What the audit did not cover, spot-checked here

| area | result |
|---|---|
| **Concurrent submits** (second question while the first reply is rendering) | Clean. Two submits in the same frame produce exactly 4 messages, the newest is the second question's answer, zero console errors (`h-verify` H2). |
| **Opening the panel on the 1s tick boundary** | Clean across 6 different tick phases, 0 failures (`e-gaps` E4). |
| **`helpBotLog` cap × scroll restore** | Clean. After 24 questions the log is capped at 40 children and the newest reply is still in view (36px from the bottom), i.e. the restored scrollTop does not strand the user in the middle of a trimmed transcript (`e-gaps` E5). |
| **Transcript scroll across an unrelated re-render** | Held exactly (9427 → 9427) (`e-gaps` E5b). |
| **`helpIndex()` built lazily inside the guard path** | Clean. On a wiped install whose *first ever* query is `is 101 a fever`, the route is correct and the next ordinary question still answers from the cache (`i-profileswitch` I1). |
| **Profile switching with a transcript present** | Not reachable on Free — a second profile is a paid feature and the add lands on the plans sheet. Tested the structural equivalent (`switchProfile()` ends in `location.reload()`): after a reload the panel is gone, the bubble is back, the transcript is empty (4 → 1 messages) (`i-profileswitch` I2). |
| **`helpSearch()`'s rewrite vs v55-signed-off behaviour** | **One real regression — LA-2 below.** |
| **Did any of the eleven fixes break something** | **Yes — LA-1.** Also LA-3 (the announcer). Everything else re-verified clean. |

### LA-2 — MEDIUM — typing "help" into the Help view's search box now returns nothing

`index.html:6206` (`helpSearch`), stopword list

`helpSearch()` was replaced wholesale by the scored matcher (brief §1.14 — intended). I compared
21 queries through the **real Help view search box** on v55 `864aeaf` and on `0543e42`
(`f-helpsearch.mjs`). Most changes are improvements (`change units` and `banana export` now find
things; `zzzz`, `asdfgh`, `password`, `insurance claim form` still correctly show the empty state).
But three queries went the wrong way, and one of them matters:

| query | v55 | v56 |
|---|---|---|
| **`help`** | results | **"Nothing matched that"** |
| `how do i` | results | "Nothing matched that" |
| `the` | results | "Nothing matched that" |

`help` is deliberately stopworded so the *bubble* answers the single word "help" with the greeting
rather than the emergency-symptom page — a good decision, documented in the brief. But the same
function now backs the Help **view**, where the screen is literally titled *"Search help"*, the
field is labelled *SEARCH HELP*, and the placeholder invites a word. Typing the most obvious word
on that screen produces an empty state that reads as "this app has no help".

**Repro:** menu → Help → type `help`. **Evidence:**
`outputs/v56-lead-audit/LA-G2-helpsearch-help-v56-390.png` (and `-v55-` for the before).
**Fix shape:** stopword `help` for the *bot* path only, or fall back to the unstopworded term set
when stopwording empties the query. This is from the feature commit `9dddf15`, not the fix commit —
which means both gates missed it. The Auditor's suite G re-verified "v55 Help centre … search …
'Nothing matched' empty state" but only on queries that behaved.

### LA-3 — LOW/OPEN — the accessibility announcer has the same flaw it was created to fix

`index.html:6700` (`#helpbot-announce`), `:6440` (written in `requestAnimationFrame`)

The Designer's S8 finding was that `role="log" aria-live` on `#helpbot-log` can never announce
because `render()` replaces the live region itself. The fix adds a dedicated `#helpbot-announce`
node and writes to it after the rebuild. But that node is created *inside* `render()` too, so it is
**also destroyed and re-created on every submit** — measured directly: mark the node, ask a
question, the node with the mark is gone and a new one holds the text (`h-verify` H3,
`sameNode: false`). While the panel is open the 1s tick is suppressed, so *every* announcement in
the feature's life happens into a live region that was inserted one frame earlier. Whether a screen
reader announces that is implementation-dependent and is exactly the property the original finding
said could not be relied on. I could not test it — no AT in this sandbox — so this is **open**, not
a finding of failure. Making the announcer a module-scope node appended once outside `render()`
would remove the doubt.

---

## 6. The user testing was real — verified, not accepted

The Auditor claims 4 profiles from wiped installs walked through the complete guided tour with real
medications and real logged doses. **Confirmed three ways:**

1. **The artifacts exist and are consistent.** `outputs/v56-audit/b-profiles-tour.mjs` genuinely
   clears `localStorage`, reloads, fills the welcome form, and walks the tour by *reading what each
   step asks for* — tapping *Show me*, *Meds*, *Add*, filling the medication form, tapping *Home*,
   *Next*, *Finish* — asserting at every step that `#helpbot-fab` is absent from the DOM **and**
   that `elementFromPoint` at the bubble's coordinates hits nothing helpbot-shaped. Its log
   (`logs/b-profiles-tour.log`) records 10 tour steps per profile and 48/48 pass.
2. **I re-ran it myself** against the fixed build: **48/48**
   (`outputs/v56-lead-audit/rerun-b-profiles-tour.log`). Chemo/Capecitabine, Radiation/Ondansetron,
   Both/Dexamethasone, Other/Metformin — each reaching *Finish*, each with its medication visible
   afterwards, each logging a real dose through the time modal.
3. **I ran an independent walkthrough of my own that goes further than theirs** (`g-usertest.mjs`):
   fresh install → Radiation profile → tour walked to *Finish* in 10 steps (not skipped) →
   Ondansetron 8 mg with a 6-hour gap → dose logged through the Confirm modal → **verified the dose
   reaches the Reports surface**, which suite B never checks (it only asserts the med name is on
   Home) → then asked the bubble a real question on that populated profile and got the right page.
   6/7 pass, zero console errors. Screenshots `LA-G1-after-tour-360.png`,
   `LA-G1-history-360.png`, `LA-G1-bubble-on-real-profile-360.png`.

**One honest caveat on depth, not on truthfulness.** TEAM.md's full-sweep standard asks for
medications "covering every placement, category, unit, scheduling mode, daily limit and pause
period" and "a simulated multi-day logging span across every loggable type". Suite B does **one**
as-needed medication and **one** dose per profile, and the code comment claiming it logs "a dose, a
temperature, a weight, a symptom" overstates what it does — only the dose is logged. For a
single-feature release that touches no medication or dose *data*, TEAM.md's scaling rule allows
this, and the Auditor's report describes it accurately ("a real medication entered and a real dose
logged"). It is scoped correctly; the code comment is just wrong.

---

## 7. Judging the test suites — two more hollow assertions, one reading the wrong element

I mutation-tested the developer's own suites: break the exact thing an assertion claims to pin, and
see whether it notices. Full output in `outputs/v56-lead-audit/mutation-results.log`;
harness in `mutate.py`.

| mutation applied to `index.html` | did the suites notice? |
|---|---|
| A — put `setState({})` into the help composer's `onInput` | **caught** (by the two *older* assertions at `:42`/`:44`, not by the new one) |
| B — delete the `#helpbot-log` scroll restore in `render()` | **STILL ALL GREEN** |
| C — delete the `helpBotLog` 40-message cap | **STILL ALL GREEN** |
| D — remove `BUTTON` from `render()`'s focus-restore list | caught (2 assertions) |
| E — remove `helpBotOpen: false` from `navigateTo()` | caught (3 assertions) |
| F — delete the `/\bis\s+.{0,24}\b(safe\|…)\b/` guard pattern | **STILL ALL GREEN** (both suites) |
| G — disable `helpBotSyncViewport`'s width branch | caught (2 assertions) |
| H — make `helpBotSyncViewport` call `setState()` | caught (3 assertions) |
| extra — delete the `HELP_POINTERS` fold-in | caught (2 assertions) — **V56-10's fix is genuine** |

### LA-4 — MEDIUM — two of the eleven new regression assertions cannot fail

**`test/v56-helpbot.mjs:296` — V56-4's assertion.**
```js
await ask(page, 'export to excel');
const before = await page.evaluate(() => { … l.scrollTop = 40; return l.scrollTop; });
await page.waitForTimeout(1600);   // "outlive a re-render"
t(L('V56-4 transcript scroll survives an unrelated re-render'), …);
```
The panel is **open** for the whole 1600 ms, and the 1s tick is explicitly suppressed while the
panel is open (`index.html:8728` — the guard this same suite asserts at line 33). Nothing
re-renders in that window, so the assertion measures a scrollTop that nothing threatened. Mutation
B proves it: delete the scroll-preserve code and the suite is still ALL GREEN. A discriminating
version has to force an unrelated `setState` — tapping **Beta date controls** does it, which is how
I measured it in `e-gaps.mjs` E5b.

**`test/v56-helpbot.mjs:305` — V56-5's assertion.**
```js
t(L('V56-5 the transcript is capped at 40 messages'), … l.children.length <= 41);
```
At that point in the run the suite has asked roughly a dozen questions, so `children.length` is
nowhere near 40 and the assertion passes whether or not a cap exists. Mutation C confirms: cap
removed, ALL GREEN. This is the identical shape to the V56-10 the Auditor already caught — an
assertion whose subject never reaches the boundary it names. It needs a loop that pushes past 40
first (`h-verify.mjs` H4 does, and correctly reports 60 on the pre-fix build).

### LA-5 — MEDIUM — the comment-stripping rewrite's own new assertion reads the wrong handler

`test/v56-helpbot.mjs:68`
```js
t('the composer input handler never calls render() or setState()', (() => {
  const m = codeOnly(html).match(/onInput: \(ev\) => \{[^}]*\}/);
  return !!m && !/render\(|setState\(/.test(m[0]);
})());
```
`String.match` without `/g` returns the **first** occurrence in the file. There are five
`onInput: (ev) => {` handlers in `index.html`; the first is at `:2925` — the **welcome screen's
patient-name field**. Proved by evaluating the expression directly:

```
matched: "onInput: (ev) => { setupNameDraft = ev.target.value; }"
```

So the assertion added in this commit, named after the caret bug that has shipped five times,
inspects a different input on a different screen and cannot fail for anything the help composer
does. (Mutation A was caught only by the two pre-existing assertions at `:42`/`:44` — the second of
which, `!/onInput: \(ev\) => \{[^}]*(render\(\)|setState)/`, is the correct broad form and scans
*all* handlers.) Two further weaknesses in the same line: `[^}]*` stops at the first `}`, so a
handler containing any nested block would be truncated before a later `setState(` was seen. The
`codeOnly()` helper itself is sound for this file, and the V56-10 replacement is a genuine
improvement — this one line is not.

**Not hollow, but weaker than its name:** `V56-2 the destination screen is reachable, not covered`
asserts only `!document.getElementById('helpbot-panel')` — the same thing the line above it already
asserts. The finding was produced by an `elementFromPoint` hit test on the Meds *Add* button; the
regression test should do that (as `h-verify.mjs` H1 does), or it is not pinning "reachable".

**Fixture coverage, restated because it is the root cause of LA-1:** neither suite has any question
containing *safe / food / child / side effects / allergy / too many / split / liver / how long*, so
the "no guard fires on the 53 ordinary questions" assertion cannot see the regression. And the 12
clinical strings added to `v56-matcher.mjs` in this commit are the same strings the ten patterns
were written against — the tests were written to the patterns and the patterns to the tests, which
measures nothing about generalisation. My 50 fresh clinical questions found the guard's true catch
rate to be 10/50.

---

## 8. What I could not verify

- **Screen readers** (LA-3, §3's re-focus-per-tick). No AT in this sandbox; both are code facts
  with an unproven user consequence.
- **Real on-screen keyboard, iOS Safari, native/OS behaviour, the live deployed site.** Same
  limits the Auditor named, and I agree with how they named them.
- **A profile switch with a live transcript** — blocked by the Free-plan paywall, tested via the
  reload path that `switchProfile()` actually uses.

---

## 9. Recommendation

Back to the **Lead Developer**. Not ready for the PM gate.

1. **LA-1 (High)** — retune the guard. Drop or narrow `/\b(too\s+(many|much)|how\s+long\s+…)/` and
   the `.{0,24}` wildcard, require a clinical subject beside the judgement, and add the 35 ordinary
   questions in `a-guard.mjs` plus the 50 clinical ones to the fixture so both directions can fail.
   Target the 17 clinical leaks that are still open, several of which are emergencies.
2. **LA-2 (Medium)** — `help` (and ideally `how do i`) must not empty the Help view's search box.
3. **LA-4 / LA-5 (Medium)** — make the V56-4 and V56-5 assertions capable of failing; point the
   composer-handler assertion at the composer; give the V56-2 "reachable" assertion a hit test.
4. **LA-3 (open)** — move `#helpbot-announce` outside `render()`; log the per-tick re-focus of the
   bubble for a screen-reader pass on a real device.
5. Log in `BACKLOG.md`: the `dose` measure has no word for *late/forgot*; `BY_MEASURE` has no
   `symptom` key so `helpMatch()` is computed and discarded on symptom-shaped questions.

**Non-blocking observation, pre-existing and out of v56's blast radius:** `renderHeader()`
(`index.html:2605`) titles *every* screen `<name>'s Meds`, so the Reports and Help screens are
headed "Rita's Meds". Not introduced here; worth a line in `BACKLOG.md`.

**Nothing was committed by this stage.**

---

### Checked / found / open

**Checked (10 suites, both builds unless noted):** all eleven findings reproduced on `9dddf15` and
re-tested on `0543e42`; 50 new clinical questions × 2 builds; 35 ordinary app questions × 2 builds;
pattern-by-pattern attribution of every false positive; V56-3's blast radius across 5 views, the
tour, the medication editor, the drawer and armed-delete state; V56-6 routing on 15 measure-shaped
questions × 2 builds; concurrent submits; panel open across 6 tick phases; cap × scroll-restore
interaction; cold-start `helpIndex()` inside the guard path; reload/transcript-lifetime; 21
Help-view search queries against the v55 baseline; the Auditor's suite B re-run in full (48/48) and
an independent tour-to-Finish + dose-to-Reports walkthrough of my own; 9 mutations against the
developer's two suites; `release_check.sh`, `APP_VERSION`, `sw.js` `CACHE`, README/REQUESTS/BACKLOG
bookkeeping. Zero console errors in every suite.

**Found:** LA-1 (High, new regression from the V56-1 fix — 24/35 ordinary app questions refused,
21 of them newly, 5 losing a correct answer, for +1 clinical catch in 50); LA-2 (Medium, "help"
returns nothing in the Help view's search box — missed by both gates); LA-4 (Medium, two new
regression assertions pass with the code they pin deleted); LA-5 (Medium, the new composer-handler
assertion inspects the welcome screen's name field).

**Open:** the announcer node is re-created on every reply, so the S8 fix may not announce (needs a
screen reader); the bubble is re-focused ~1×/second while focused, which needs a TalkBack/VoiceOver
pass; 17 of 50 clinical questions still get a normal app reply, including several emergencies —
the Auditor's V56-1 is only partially closed; real keyboard, iOS, native and live-site checks
remain as the Auditor listed them.
