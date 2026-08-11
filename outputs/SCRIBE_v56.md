# SCRIBE v56 — documentation verified against the diff

**Stage:** Scribe (Quality Chain stage 7). **Date:** 2026-08-11.
**Verdict: FAIL.** The README app-v56 row, the REQUESTS.md entry and the BACKLOG.md changes were
all written at commit `0543e42` and **were never updated for `a0e1a66`**, the last commit in the
release — which changed `index.html` by 189 lines, rebuilt the clinical guard from scratch, changed
the panel geometry at Aaron's own mid-build instruction, and bumped `sw.js` `CACHE` again. Three of
the row's factual claims are wrong against the shipped code, one describes a fix the Lead Designer
measured and reported as *not done*, and two whole gates (Lead Designer, Lead Auditor) that between
them blocked the release twice appear nowhere in any user-facing document.

**Under test:** `864aeaf` (published `app-v55`) → `HEAD` `a0e1a66`, i.e. `599dc77`, `9dddf15`,
`0543e42`, `a0e1a66`. Baseline per `PUBLISHED.json`.
**Method:** full `git diff 864aeaf HEAD` read hunk by hunk; every counted claim in the README row
recounted from source or re-measured by running the suites; guard behaviour probed directly against
the shipped `index.html` through the same slice-and-eval harness `test/v56-matcher.mjs` uses.

---

## 1. What I ran, and what the numbers actually are

| README claim | measured | verdict |
|---|---|---|
| 139-word stopword list | 139 tokens, 139 unique, no duplicates (`index.html:5832-5840`) | ✅ |
| 19-entry synonym map | 19 keys (`index.html:5856-5864`) | ✅ |
| seven weighted fields | `HELP_FIELDS` has 7 (`index.html:5866`) | ✅ |
| 15 % margin over the runner-up | `HELPBOT_MARGIN = 1.15` (`:5870`) | ✅ |
| 132 documents | `helpIndex().docs.length === 132` (117 topics + 15 FAQ) | ✅ |
| 53/53 rank an acceptable page first, 0 missed | `test/v56-matcher.mjs`: "53 first, 0 in shown set", 0 missed | ✅ |
| ~1.3 ms per query | 1.38 ms/query on this machine | ✅ (rounding) |
| all 117 walkthroughs still found first by their own title | "0 not first" | ✅ |
| 133 UI assertions | `test/v56-helpbot.mjs`: 133 PASS, 0 FAIL | ✅ |
| v55 suite 145 | `test/v55-help.mjs`: 145 PASS, ALL GREEN | ✅ |
| v52 suite 20 | `test/v52-fixes.mjs`: 20 PASS, ALL GREEN | ✅ |
| Auditor 452 cases, verdict NOT READY | `outputs/AUDIT_v56.md:3,10` — both exact | ✅ |
| Designer 74 screenshots, 3 must-fix | report says 74; M1–M3 are the must-fix set | ✅ (62 PNGs committed) |
| "all seven modals" | `helpBotVisible()` (`:6370`) suppresses 7 modals + the med editor | ✅ |
| **`sw.js` CACHE → `chemowell-app-v56-2`** | **actual `chemowell-app-v56-3`** | ❌ |
| **typing "help" returns the greeting** | **returns the no-answer reply** | ❌ |
| **callout "now one shared shell"** | **not shared; two components** | ❌ |
| **coverage floor 0.34 / 0 of 35 / 39 of 50** | **true in code and tests, absent from README** | ❌ omitted |

Not claimed anywhere in the docs, and measured true: `0` of 35 ordinary questions refused, `39` of
50 clinical questions caught by the guard, the other 11 falling through to "I don't have an answer
for that one"; `HELPBOT_LIST_COVERAGE = 0.34`.

---

## 2. Discrepancies, most serious first

### S1 — README states the wrong service-worker cache. `README.md:14`

> "`APP_VERSION` → `app-v56`, `sw.js` CACHE → `chemowell-app-v56-2`."

`sw.js:1` is `const CACHE = 'chemowell-app-v56-3';`. It went `v56-1` (`9dddf15`) → `v56-2`
(`0543e42`) → `v56-3` (`a0e1a66`); the row records the middle value. This is exactly the app-v55
PM-4 finding repeating — a version-history row wrong about one of the two facts it exists to
record. `release_check.sh` cannot catch it: it never reads README.md.

### S2 — README repeats a fix claim the Lead Designer measured as untrue. `README.md:14`

> "the panel's care-team callout and the walkthrough page's were two components that almost matched
> (**now one shared shell**)"

`outputs/LEAD_DESIGNER_v56.md:128-152` (S2) measured this on the running product: *"They are not.
`helpBotNotice()` is shared within the panel only; `renderHelpView`'s callout (`index.html:6800`) is
still its own inline markup with its own numbers… nobody should later believe there is a single
shell to edit, because there isn't."* Confirmed independently: `helpBotNotice` occurs at
`index.html:6577`, `:6588` (definition) and `:6640` — all three inside the panel. The Lead Designer
explicitly flagged this sentence as an overstatement carried from the commit message; it was then
copied verbatim into the permanent record anyway.

### S3 — README describes behaviour the app does not have. `README.md:14`

> "Typing the single word **"help"** deliberately returns the greeting rather than the
> emergency-symptom page"

Probed against the shipped file: `helpBotGuard('help')` → `null`, `helpBotDecide('help')` → `mode:
'none'`, and `helpBotAsk()` (`index.html:6465-6490`) pushes `kind: 'none'`, which renders **"I don't
have an answer for that one."** (`:6679`). The greeting is the *empty-state* only — `const empty =
helpBotLog.length === 0` at `:6730` — and typing anything ends the empty state permanently. The
suite agrees with me and not with the README: `test/v56-matcher.mjs` asserts *"LA-2 the BOT still
**refuses** a bare 'help'"*. The comment at `index.html:5843` says the same wrong thing, so the
error is inherited, not invented — but the README is the copy Aaron reads.

The half of the claim that matters for safety is true: "help" does not return the
emergency-symptom page.

### S4 — The entire third commit is undocumented. `README.md:14`, `REQUESTS.md:134-150`

`a0e1a66` changed `index.html` by 189 lines. None of it is in any document:

1. **The clinical guard was rebuilt.** `HELP_GUARD_ADVICE` / `HELP_GUARD_JUDGEMENT` were deleted and
   replaced by `HELP_GUARD_HARD` (30 patterns, unconditional), `HELP_GUARD_SOFT` (6, suppressible by
   positive app-object evidence), `HELP_APP_OBJECTS`, and a grammatical `HELP_GUARD_PERSON_STATE`
   detector. The README still describes the *pre-rebuild* guard ("Two pattern guards run before the
   matcher") and the pre-rebuild Auditor fix. The reason for the rebuild — Lead Auditor LA-1, a
   High: the v56 fix refused **24 of 35 ordinary app questions**, 21 newly, including *"is my data
   safe"* — is nowhere.
2. **A fifth gate was added.** `HELPBOT_LIST_COVERAGE = 0.34` on the list path (`index.html:6145`).
   The README still says "**Four gates**".
3. **The Help view's search box no longer shares the bot's stopword list** (`HELP_STOP_SEARCH`,
   `:5848`), the fix for Lead Auditor LA-2 — a v55 regression that both first-line gates missed.
   The README says the matcher is "now shared by the bubble **and** the Help view's search box… a
   139-word stopword list", which is now only half true.
4. **The panel was made smaller, on Aaron's direct instruction** — see S5.
5. **The bubble stopped being white** (Lead Designer LD-1 must-fix: the N1 fix measured **1.00 : 1**
   against the white cards it overlaps on a populated Home screen).
6. **Two more hollow assertions and one wrong-element assertion were fixed** (LA-4, LA-5, proved by
   mutation testing in `outputs/v56-lead-audit/mutation-results.log`). The README mentions only
   *one* hollow assertion and frames it as self-caught.

### S5 — Aaron gave an instruction mid-build and it was never written down. `REQUESTS.md`

From the `a0e1a66` commit message and `index.html:6745`:

> Aaron, mid-build, on the shape he asked for: *"it should not take over the whole screen so they
> can still see the rest of the screen."*

The cap went from `72vh / 560px` to `60vh / 480px` (`HELPBOT_MAX_H = 480`, `index.html:6354`). This
appears **only** in a commit message and a code comment. It is not in `REQUESTS.md`, not in the
README row, not in `BACKLOG.md`. TEAM.md's Scribe section is explicit: *"add any new request Aaron
made this session, **the moment he makes it**, not at the end."* A new-chat session reading this
repo would not know Aaron ever said it.

Consequently the README row also still describes the dead cap twice — "overrode the **560 px** cap"
and "34 px of dead white inside a **560 px** panel" — numbers that no longer exist in the code.

### S6 — `REQUESTS.md:134` is ticked `[x] SHIPPED` for a build that has not shipped

`git status -sb` → `## main...origin/main [ahead 4]`. `PUBLISHED.json` still records `app-v55` /
`chemowell-app-v55-2` at `864aeaf`, dated 2026-08-10. Nothing has been uploaded. TEAM.md's Scribe
rule is *"Check off anything in REQUESTS.md that just shipped **and was verified live**."*

Worse, the tick was written in `0543e42` — **before** the two Lead gates ran, and both then returned
blocking findings (`LEAD_AUDITOR_v56.md:3` "VERDICT: NOT READY"; `LEAD_DESIGNER_v56.md:22`
"Sign-off: conditional. Do not ship as-is."). The entry also says the Auditor's findings were "all
fixed **before push**" and names only two of the five gates:

> "Gated by `outputs/DESIGN_v56.md` (3 must-fix, 10 more accepted) and `outputs/AUDIT_v56.md`
> (452 cases, 2 High, 4 Medium — all fixed before push)."

The Lead Designer and Lead Auditor gates, which caught a must-fix visual regression and a High
functional regression *introduced by the fixes this sentence is describing*, are omitted.

**What the entry gets right, and it is the thing this release exists for:** it says plainly that
v55 answered the same request in the wrong shape, and refuses to file v56 as an enhancement —
*"the original request said 'chatbot', and it was interpreted as 'a much bigger FAQ' because that
was the buildable-sounding reading. Aaron meant the thing every consumer app has in the bottom
corner, and he was right that it is a different product."* That requirement is met.

**What it does not say:** that 11 of 50 clinical questions are not caught by the guard (they land on
the no-answer copy, which does route to the care team — but the entry claims flatly that "Clinical
questions are refused and routed to the care team by pattern guards", with no residual named).

### S7 — `BACKLOG.md:42-48`: the one new entry is already stale and half-wrong

The entry (added in `0543e42`, never revised after the guard was rebuilt in `a0e1a66`) reads:

> "'will she lose her hair' and 'my husband is very tired all the time' **do not fire it**; the score
> gates catch them (both land on 'I'm not sure — do any of these match?'…)"

Probed against the shipped file:

| query | guard | reply |
|---|---|---|
| `will she lose her hair` | `null` | `list` (top hit `priv-lost-phone`) — entry correct |
| `my husband is very tired all the time` | **`clinical`** | care-team route — **entry wrong** |

`HELP_GUARD_PERSON_STATE` (`index.html:6231`) now catches it. The backlog line names as an open gap
a case that was closed in the same release, and the line is the only record of the residual risk —
so the record understates what is covered and gives no number for what is not (11 of 50).

### S8 — Open items from the Lead gates exist only in reports nobody reads. `BACKLOG.md`

`BACKLOG.md` gained exactly one line this release. Every one of the following was found, written up,
and left out of the durable punch list:

| item | source | in code today? |
|---|---|---|
| The `#helpbot-announce` node is re-created inside `render()` on every submit, so the S8 fix "has the same flaw it was created to fix" | `LEAD_AUDITOR_v56.md:228-243` (LA-3, explicitly **OPEN**) | **still inside `renderHelpBot()`** at `index.html:6785` — not fixed, not logged |
| The bubble is re-focused ~1×/second while focused; needs a TalkBack/VoiceOver pass | `LEAD_AUDITOR_v56.md:419-420` | present; not logged |
| 11 of 50 clinical questions still not caught by the guard | measured, `LEAD_AUDITOR_v56.md:421` | not logged as a number |
| `BY_MEASURE` has no `symptom` key, so `helpMatch()` is computed and discarded; the `dose` measure has no word for late/forgot | `LEAD_AUDITOR_v56.md:390-392` — an explicit *"Log in `BACKLOG.md`"* instruction | not logged |
| `renderHeader()` titles every screen `<name>'s Meds`, so Reports and Help read "Rita's Meds" | `LEAD_AUDITOR_v56.md:394-396` — *"worth a line in `BACKLOG.md`"* | not logged |
| S1: user bubble and CTA fills are 1.28 : 1 apart, so the finding is half-discharged | `LEAD_DESIGNER_v56.md:104-126`, listed under **Backlog** | not logged |
| S5 browse link ordering / 29 px empty hit area; N5 and N6 "believed applied, are not" | `LEAD_DESIGNER_v56.md:516-517` | not logged |
| Declared `min(72vh, 560px)` never applied (now `60vh/480px`) — clamp still may not honour the declaration | `LEAD_DESIGNER_v56.md:520` | not logged |

The `HELP_POINTERS`-not-searchable line **is** correctly gone (`BACKLOG.md` diff, `-39,11 +39,13`),
and the fix is genuinely verified — `test/v56-matcher.mjs` proves `vit-units` is now reachable by
searching the pointer text. The `release_check.sh` exec-bit line was correctly updated from a
prediction to a confirmed-and-recurring standing item. Those two are right.

### S9 — No Project Manager gate report exists for v56

`outputs/` has `PM_GATE_v11…v51`, `PM_v52.md`, `PM_v55.md` — and nothing for v56. TEAM.md:
*"Project Manager — mandatory gate, every release, leads this process… Nothing reaches Aaron without
both having independently signed off."* Both Lead reports end by handing off to it
(`LEAD_AUDITOR_v56.md:378` "Not ready for the PM gate"; `LEAD_DESIGNER_v56.md:523` "With LD-1 fixed,
this feature is ready for the PM gate"). It has not run. Related: **no gate of any kind has
re-verified `a0e1a66`** — the Lead Auditor's own re-run was against `0543e42`. Yet `REQUESTS.md`
already says shipped (S6).

### S10 — Minor

- `README.md:14` says "the same **132** documents"; the app-v55 row directly beneath says "17
  categories → **133** rows". Both are defensible (132 indexed documents; 133 browsable rows,
  including the 1 `HELP_POINTERS` row folded in as an alias) but they read as a contradiction to
  anyone who is not counting.
- `DESIGN_v56.md` states 74 screenshots; 62 PNGs are committed under `outputs/v56-designer/`. The
  README repeats "74 screenshots". Not wrong — the report says *taken*, not *committed* — but the
  evidence trail does not support the number on its own.
- `release_check.sh` reads `sw.js` and `APP_VERSION` and never opens `README.md`, `REQUESTS.md` or
  `BACKLOG.md`. Every failure in this report is invisible to the gate — which is the exact reason
  this stage exists, and worth a `BACKLOG.md` line of its own.

**Version strings, checked everywhere they occur:** `index.html:5704` `APP_VERSION = 'app-v56'` ✅;
`sw.js:1` `chemowell-app-v56-3` (README wrong, see S1); `manifest.webmanifest` carries no version ✅;
`PUBLISHED.json` correctly still records `app-v55` because nothing has been pushed ✅; no stale
`app-v55` / `v55-2` strings anywhere that should have moved — the three `app-v55` mentions in
`index.html` (`:2083`, `:5788`, `:6569`) are historical comments and are correct as they stand.
`git ls-files -s` reads `100755` for both `release_check.sh` and `mark_published.sh` ✅.

---

## 3. Can Aaron read it?

**No.** He is non-technical; the app-v56 README row is **1,224 words in a single table cell** and is
written for a developer.

The opening is genuinely good and does the most important job — it names his own words, and it says
out loud that v55 got the shape wrong:

> "v55 shipped the right **content** in the wrong **shape** — a browse-and-search screen behind a
> menu row. v56 is the shape."

He would follow that. He would also follow "it works in aeroplane mode", "no model, no API key, no
network", and "it never reads the user's data". After that it goes.

Sentences that would lose him, quoted:

> "Replaced by one scored function now shared by the bubble **and** the Help view's search box: a
> 139-word stopword list, a 12-line stemmer applied identically to index and query, a 19-entry
> query-side synonym map (`meds`→`medication`, `notifications`→`reminder`), bounded
> Damerau–Levenshtein typo tolerance, seven weighted fields, IDF, and adjacent-bigram plus
> keyword-phrase bonuses."

Six pieces of jargon in one sentence, none defined, and nothing telling him what it means for a user.

> "the composer had no `onInput` at all (per the brief), so any unrelated `setState` rebuilt the
> tree and reconstructed the input from an empty draft"

> "the viewport sync's `max(240, …)` resolved to 672 px on a tall phone with no keyboard and
> overrode the 560 px cap"

> "the composer added `env(safe-area-inset-bottom)` a second time, costing 34 px of dead white
> inside a 560 px panel on every notched phone"

> "the user's own message bubble was the app's **primary-action** fill and read as a button (now
> `#A83D0F`, contrast 4.92→6.29:1)"

> "the `aria-live` transcript could never announce because `render()` replaces the live region
> itself (now a dedicated persistent announcer)"

> "`navigateTo()` never closed the panel"

> "`helpBotLog` had no cap and reached 260 messages / 181 ms per submit"

Three of those describe defects that were found and fixed *before anything reached him* — they are
engineering history, and they are what makes the row unreadable. The row needs a two-to-three
sentence plain-English lead (what the button is, what happens when you tap it, what it will and
won't answer, and that it never leaves the phone) with the engineering detail below a marker, the
way the entry's own bolded lead sentence already tries to do before the paragraph runs away from it.

---

## 4. Gate reports — do they exist, name their stage, and match what happened next?

| report | stage named | verdict | what happened next | consistent? |
|---|---|---|---|---|
| `outputs/DEV_BRIEF_v56_helpbot.md` | "Developer (Quality Chain stage 1)" | brief, no code | implemented in `9dddf15` | ✅ |
| `outputs/DESIGN_v56.md` | "Designer (Quality Chain stage 3)" | "not yet App-Store-featured quality"; M1–M3 must-fix | fixed in `0543e42` | ✅ |
| `outputs/LEAD_DESIGNER_v56.md` | "Lead Designer (Quality Chain stage 4)" | "Sign-off: conditional. **Do not ship as-is.**" | LD-1/2/3 fixed in `a0e1a66` | ✅ |
| `outputs/AUDIT_v56.md` | "Zero Day Auditor (Quality Chain stage 5)" | "**NOT READY** — 2 High, 4 Medium, 5 Low" | fixed in `0543e42` | ✅ |
| `outputs/LEAD_AUDITOR_v56.md` | "Lead Auditor (Quality Chain stage 6)" | "**NOT READY**… Back to the Lead Developer" | fixed in `a0e1a66` | ✅ |
| Project Manager | — | **missing** | — | ❌ see S9 |

All five that exist name their stage, carry a date, name the commit they tested, and every NOT-READY
verdict is followed by fixes rather than by a push. The Auditor and Lead Auditor both recorded the
`index.html` md5 of the bytes they served, and the hashes agree across the two reports — the
evidence chain for `9dddf15` and `0543e42` is sound. What is missing is any verification at all of
the build that is actually at `HEAD`.

---

## 5. Nothing was changed by this stage

No file was edited and no commit was made. Fixes are the Lead Developer's; re-verification is the
PM's.
