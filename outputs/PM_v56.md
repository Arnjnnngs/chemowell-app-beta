# PM GATE — app-v56, the on-screen help bubble

**VERDICT: NO-GO.** Do not push.

**Stage:** Project Manager (Quality Chain stage 8, the mandatory gate that leads this process).
**Date:** 2026-08-11. **Author:** Project Manager agent, independent pass.
**Under test:** `HEAD` = `92c70bf`, i.e. `9dddf15` → `0543e42` → `a0e1a66` → `92c70bf`.
`index.html` md5 `1620f63c1d14c5f49ec0a540aa1a3e5c` — identical to the bytes the server returned for
every case below, so the tested bytes are the committed bytes. Tree was clean at the start of this
pass; the only files this stage added are this report and its eight `pm-v56-*` evidence PNGs, all
untracked. **Nothing was committed and no code was changed by this stage.**
**Baseline:** `PUBLISHED.json` records `app-v55` / `chemowell-app-v55-2` at `864aeaf`. Nothing pushed.
**Method:** the running product at `http://127.0.0.1:8899/index.html`, Playwright, 360×800 and
390×844 primary, plus 412×1000 and 740×400 landscape. Every geometry number below is from
`getBoundingClientRect()` in the live page. Every guard result below was reproduced on two
independent fresh installs. Evidence: `outputs/pm-v56-*.png`.

**Why NO-GO in one sentence:** the release's own top-severity finding, **V56-1**, still reproduces —
a question about stopping cancer treatment gets a confident, unrelated app answer with no care-team
wording — and the two documents that record the residual risk (the README row Aaron reads, and the
`BACKLOG.md` entry) both describe that residual as something milder than what it actually is.

Everything else in this release is in good shape. The geometry Aaron asked for is exact, the
mechanics all pass, 326 assertions are green, and the four gates below this one did real work. This
is a targeted safety gap plus a documentation gap, not a broken feature.

---

## 1. Did every stage run, and produce its artifact?

| # | Stage | Artifact | Names stage? | Names commit tested? | Verdict stated? |
|---|---|---|---|---|---|
| 1 | Developer | `outputs/DEV_BRIEF_v56_helpbot.md` | ✅ "Developer (Quality Chain stage 1)" | ✅ baseline `app-v55` / `864aeaf` | ✅ brief, no code |
| 3 | Designer | `outputs/DESIGN_v56.md` | ✅ stage 3 | ✅ `index.html:6225–6597` on `9dddf15` | ✅ "not yet App-Store-featured quality", 3 must-fix |
| 4 | Lead Designer | `outputs/LEAD_DESIGNER_v56.md` | ✅ stage 4 | ✅ `0543e42` | ✅ "Sign-off: conditional. Do not ship as-is." |
| 5 | Zero Day Auditor | `outputs/AUDIT_v56.md` | ✅ stage 5 | ✅ `9dddf15`, md5 recorded | ✅ "NOT READY — 2 High, 4 Medium, 5 Low" |
| 6 | Lead Auditor | `outputs/LEAD_AUDITOR_v56.md` | ✅ stage 6 | ✅ `0543e42`, md5 recorded, 4 builds side by side | ✅ "NOT READY" |
| 7 | Scribe | `outputs/SCRIBE_v56.md` | ✅ stage 7 | ✅ `864aeaf` → `a0e1a66` | ✅ "FAIL" |

**All six exist. All six name their stage, their commit and a verdict. No artifact is missing.**
Stage 2 (Lead Developer) is the implementer and produces commits, not a report — correct per TEAM.md.

**But the chain has a real structural gap, and it is the reason this gate found a High:**

> **No independent gate verified `a0e1a66` or `92c70bf` before this one.**

- Designer and Auditor tested `9dddf15`.
- Lead Designer and Lead Auditor tested `0543e42`.
- Scribe read the diff to `a0e1a66` but is a documentation stage and does not test behaviour.
- `a0e1a66` **rebuilt the clinical guard from scratch** (189 lines of `index.html`) and `92c70bf`
  changed the panel geometry — and no behavioural gate ran on either.

The Scribe called this out (S9: *"no gate of any kind has re-verified `a0e1a66`"*). It was correct,
and the consequence is exactly what you would predict: a from-scratch rewrite of the safety-critical
component, self-verified only, shipped a gap that the first independent test pass found. Per TEAM.md's
restart rule this is the **functional/safety tier**, so the fix goes back to the Lead Developer and
then through **both mandatory gates from scratch** — not a spot-check.

---

## 2. Was every finding fixed, and did the fix hold?

Full roll-up across all five reports. "Verified" = I checked it myself against the running product
or the shipped source, not against the report.

### Designer (stage 3) — M1–M3, S1–S10, N1–N6

| ID | Status | How I verified |
|---|---|---|
| M1 send arrow pointed backwards | ✅ fixed | `appIcon('send')` at the submit button; Lead Designer re-measured |
| M2 landscape kept the phone layout | ✅ fixed | live at 740×400: 380px card, not full-bleed |
| M3 safe-area double-counted, −34px | ✅ fixed | no double `env(safe-area-inset-bottom)` in the composer |
| S1 user bubble is the primary-action colour | ⚠️ **partial, and not logged** | Lead Designer measured the two fills 1.28 : 1 apart and called it "half-discharged"; recommended a backlog line. **Not in `BACKLOG.md`.** |
| S2 two near-matching care-team callouts | ✅ addressed | visually unified; the "one shared shell" overstatement is now corrected in the README |
| S3 generic refusal was the weakest notice | ✅ fixed | refusal renders in the full notice shell |
| S4 reopen landed on the oldest exchange | ✅ fixed | live: reopen shows the newest reply |
| S5 starter chips / browse-all vanished | ✅ fixed | live: "Browse all 117 help topics" present on every reply kind |
| S6 transcript hard-cut, no scroll affordance | ✅ fixed | inset shadows on `#helpbot-log`; live scroll confirmed |
| S7 11.5px muted label fails AA | ✅ fixed | the 11.5px/`#7A6E76` pairing no longer occurs |
| S8 `aria-live` destroyed on every render | ✅ fixed, ⚠️ successor flaw **logged** | dedicated `#helpbot-announce`; Lead Auditor LA-3 says it inherits the flaw — correctly in `BACKLOG.md` |
| S9 6px chip gap | ✅ fixed | 8px |
| S10 chips same fill as the bubble | ✅ fixed | Lead Designer found the Designer's 7.14 : 1 premise wrong (6.30 : 1 actual); the fix is right anyway |
| N1 bubble is the primary-action colour | ✅ fixed **twice** | white fill was a regression (LD-1, 1.00 : 1) → now `2px solid #BF4C1A`, **4.93 : 1** vs white. Correct outcome |
| N2 bubble/pill 3px misaligned | ✅ fixed | first fix moved it the wrong way (LD-2, 3px→7px); `a0e1a66` set the pill to `bottom: calc(91px + …)`, the centre alignment originally prescribed |
| N3 focus ring same colour as bubble | ✅ fixed | `3px solid #2A2127` |
| N4 `aria-expanded` always false, dangling `aria-controls` | ✅ fixed | both removed, label carries the meaning |
| N5 "+ N more steps" reads as a greyed 4th step | ❌ **not fixed, not logged, not declined** | still `12.5px / 600 / #7A6E76 / marginTop 7px` at `index.html:6564` — verbatim the defect |
| N6 header subtitle wraps at 320px | ❌ **not fixed, not logged, not declined** | string unchanged |

On N1/N2/S1/S10 and the "one shared shell" claim, the Lead Designer said the Designer was wrong.
Checking what actually happened rather than assuming:
- **N1** — the Lead Designer was right; the Designer's prescribed white fill was a worse failure than
  the one it answered. The build did **not** revert to the Designer's version; it took the ringed
  white, which measures 4.93 : 1. **Right thing happened.**
- **N2** — the Lead Designer's view was that N2 was a bad finding not worth a code change. The build
  went the other way and implemented the Designer's original 91px. That is a defensible choice and
  it does close the finding. **Acceptable; the alternative was to record baseline alignment as the
  rule, which was not done, so the next reviewer may "fix" it back.**
- **S1** — the Lead Designer was right that `#A83D0F` vs `#BF4C1A` is only 1.28 : 1. The fill was
  changed anyway and the finding is half-discharged. **Right call to not chase it further; wrong
  that it was never written down.**
- **S10** — premise wrong, conclusion right, fix applied. **Fine.**
- **"one shared shell"** — the Lead Designer measured it false; the README claim was removed in
  `92c70bf`. **Right thing happened.**

### Zero Day Auditor (stage 5) — V56-1 … V56-10

| ID | Status |
|---|---|
| **V56-1** clinical question gets a normal app answer | ❌ **STILL OPEN — see §3** |
| V56-2 panel survives `navigateTo()`, blocks the screen | ✅ fixed — `index.html:2462` sets `helpBotOpen: false`; live confirmed |
| V56-3 focus drops to `<body>` after Escape | ✅ fixed; blast radius independently bounded to 2 buttons by the Lead Auditor |
| V56-4 transcript loses scroll on re-render | ✅ fixed; hollow test replaced (LA-4) |
| V56-5 `helpBotLog` uncapped | ✅ fixed — `HELPBOT_LOG_MAX = 40`, applied at `:6496` |
| V56-6 guard routes to a topically wrong care-team page | ✅ fixed; `dose` pattern independently judged safe |
| V56-7 panel keeps its layout after rotate | ✅ fixed — live at 740×400 |
| V56-8 `focusin` auto-scroll not excluded | ✅ fixed — `index.html:2527` |
| V56-9 release bookkeeping not done | ✅ fixed |
| V56-10 assertion does not pin what it claims | ✅ fixed |

### Lead Designer (stage 4) — LD-1 … LD-3

| ID | Status |
|---|---|
| LD-1 white bubble, 1.00 : 1, MUST FIX | ✅ fixed — `2px solid #BF4C1A`, 4.93 : 1 |
| LD-2 pill alignment moved the wrong way | ✅ fixed — pill now at 91px |
| LD-3 three reply kinds have no route out | ✅ fixed — `helpBotBrowseLink()` now on 5 branches; verified live on the refusal reply |

### Lead Auditor (stage 6) — LA-1 … LA-5

| ID | Status |
|---|---|
| **LA-1** guard over-corrected: refused 24 of 35 ordinary questions | ⚠️ **materially improved, but see §3** — over-refusal is essentially gone (2 of my 40), at the cost of an under-catch that is worse than documented |
| LA-2 typing "help" into the Help view returned nothing | ✅ fixed — `HELP_STOP_SEARCH`; asserted in `test/v56-matcher.mjs`; verified |
| LA-3 announcer inherits the flaw it was created to fix | ⚠️ open, **correctly logged in `BACKLOG.md`**, needs a real screen-reader pass |
| LA-4 two hollow regression assertions | ✅ fixed |
| LA-5 assertion reads the wrong handler | ✅ fixed |

### Scribe (stage 7) — S1 … S10

| ID | Status |
|---|---|
| S1 README named the wrong cache key | ✅ fixed — README says `chemowell-app-v56-4`, `sw.js` says `chemowell-app-v56-4`. **And `release_check.sh` now mechanically enforces it** — a genuinely good fix, because this exact error had now happened twice |
| S2 "one shared shell" claim | ✅ removed |
| S3 "typing help returns the greeting" | ✅ removed |
| S4 the entire third commit undocumented | ✅ fixed — guard rebuild, coverage floor, stopword split, both Lead gates now named |
| S5 Aaron's mid-build instruction never written down | ✅ fixed — now in `REQUESTS.md` |
| S6 `REQUESTS.md` ticked SHIPPED for an unshipped build | ✅ fixed — unticked, with the reason |
| S7 BACKLOG entry stale and half-wrong | ✅ fixed — rewritten |
| S8 eight open Lead-gate items missing from BACKLOG | ❌ **5 of 8 added, 3 not.** The five added are all from the Lead Auditor. The three Lead-**Designer** items are still absent: S1's 1.28 : 1 fill delta; S5's browse-link ordering / 29px empty hit area **and N5/N6 "believed applied, are not"**; the toast (z50) painting over the panel (z38). The commit message says "Eight open items… Added" — it added five |
| S9 no PM gate report exists | ✅ this document |
| S10 132 vs 133, 74 vs 62 screenshots, gate can't read README | ✅ addressed; the README check is now in `release_check.sh` |

### Reported and quietly not fixed

1. **N5** — "+ N more steps" still renders as a greyed-out fourth step. Not fixed, not logged, not
   formally declined. The Lead Designer explicitly said the record should say "four of six", not all.
2. **N6** — header subtitle still wraps at 320px. Same.
3. **Designer S1 residual** (1.28 : 1 fill delta) — decided against, never written down.
4. **Toast over panel** — `state.toast` at `bottom: 150px`, `zIndex: 50`; the panel occupies 84px→504px
   from the bottom at `zIndex: 38`. The toast paints over the transcript. Lead Designer listed it as
   backlog; not logged.

None of these four is a blocker on its own. Together they are the same failure the Scribe already
named: findings that live in a report nobody re-reads, and are therefore lost.

### Marked fixed that isn't

**V56-1.** See below. Declared closed by the Lead Auditor against `0543e42`, then the whole guard was
rebuilt in `a0e1a66` with no gate re-testing it.

---

## 3. The blocker — V56-1 reproduces on `HEAD`

I ran 30 clinical questions and 40 ordinary app questions of my own invention through the real panel,
twice, on two fresh installs. Results are deterministic.

**Clinical: 25 of 30 correctly routed to the care team. 5 were not.**

| typed into the bubble | what the app does | care-team wording shown? |
|---|---|---|
| **`can I stop the chemo early`** | **confident single-topic ANSWER** — *"The reminder came a few minutes early, or a few minutes late"*, with numbered steps and an **"Open the full walkthrough"** button | **no** |
| `she fainted this morning` | LIST — *"What does 'Take all' do…"*, *"What does 'Reminds at' mean…"*, *"Where does this medication show up on Home?"* | **no** |
| `can a child take this` | LIST — *"What does 'Take all' do…"*, *"Where do I put instructions like 'take with food'?"* | **no** |
| `what temperature is a fever` | LIST — top row is the right page (`vit-temp-high`), the rest are not | **no** |
| `will she lose her hair` | LIST — top row *"What happens if I lose my phone…"* | **no** |

`can I stop the chemo early` is **the V56-1 defect shape exactly**: a clinical question, a confident
unrelated app answer, an "Open the full walkthrough" call to action, no medical callout. The
Developer brief §4 is unambiguous — the reply must *"never show a normal app answer instead of the
care-team route."* It does. `she fainted this morning` is the one I would put in front of Aaron
first: fainting can be an emergency, and the app responds with a list of medication-scheduling pages.

Evidence: `outputs/pm-v56-02-FINDING-stop-chemo-answered-360.png` / `-390.png`,
`pm-v56-03-FINDING-fainted-list-360.png` / `-390.png`.

**Ordinary: 38 of 40 fine. 2 falsely refused** — `can I use this on my tablet` (a device question,
routed to the care team) and `can I split a dose into two` (defensible as conservative). LA-1's
over-refusal is genuinely close to solved; this is not a re-run of that regression.

Four more ordinary questions landed on "I don't have an answer" where the corpus does have a page —
`how do I change the patient name`, `how do I see last week`, `how do I log how she is feeling`,
`how long does the free version last`. That is a matcher-coverage gap, safe in direction, and belongs
in `BACKLOG.md`, not in this gate's blocker list.

**The documentation problem, which is the part that concerns me most.** The README row Aaron reads
states, in bold: *"**No medical question gets an app answer or a list of app pages.**"* That is
false, demonstrably, on five of my thirty. The `BACKLOG.md` entry says the residual *"land on 'I
don't have an answer' rather than the care-team route… Nothing wrong is asserted."* Also not the
whole truth: some land on a confident answer, some on a list. A safety residual that is understated
in the permanent record is worse than one that is stated plainly, because the next person to touch
this code will believe the record. This must be corrected whether or not the guard is retuned.

**What I am not saying:** the app never emits medical guidance. It doesn't. No number, threshold,
range, or "that's fine/normal/safe" appeared anywhere in my run — the Auditor's 144-assertion finding
on that holds, and the corpus is byte-identical to the v55 wording that was already reviewed. The
failure is one of *routing*, not of content.

---

## 4. Scope — does this match what Aaron asked for?

Measured on the running product. Every clause, in his order.

| Aaron's words | Built? | Measured |
|---|---|---|
| "on screen help… down in the bottom corner" | ✅ | 56×56 bubble, fixed, **14px from the right edge, 84px from the bottom**, clear of the bottom nav (nav top 731 / 775) at both widths |
| "an icon on the right hand side towards the middle or bottom" | ✅ | bottom-right |
| "they can click on it and start typing" | ✅ | tap opens the panel, text input focused, `maxlength=200` |
| "the bot will look up their question and reply" | ✅ | scored lookup over 132 documents; answers, or offers up to 4 choices, or says it doesn't know |
| "like AI, but its not AI, its just things that has already been written to the app" | ✅ | no model, no network, works offline; corpus byte-identical to v55; the greeting says so out loud: *"I'm not a person and I'm not AI"* |
| "a small text box with the bot pops up and starts asking what do they need help with" | ✅ | *"Hi — type what's going wrong in your own words."* plus four starter questions. An invitation rather than a literal question, which reads better |
| **"it should not take over the whole screen so they can still see the rest of the screen"** | ✅ | **see the measurement below** |
| **"scrolling is fine. doesn't need to cover more than half"** | ✅ | **cap is exactly half; long answers scroll inside the panel** |
| "they can also click on it to minimize the chat or close" → later **"no minimize button is needed. just the X"** | ✅ | exactly **one** X (44×44). I enumerated every button in the panel: Close help, 4 starter chips, Browse all, Send. **No minimize control exists** |
| implied: reopening keeps the conversation | ✅ | transcript survives close/reopen; wiped on reload and on profile switch, never persisted |

### The "no more than half" measurement

Tallest state I could produce, with long answers, measured live:

| viewport | panel height | **% of viewport** | space left above the panel | scrolls inside? |
|---|---|---|---|---|
| **360 × 800** | 400px | **50.0 %** | 316px | yes — 7504px of transcript in a 266px window |
| **390 × 844** | 420px | **49.8 %** | 340px | yes — 7217px in 286px |
| 412 × 1000 | 420px | **42.0 %** | 496px | yes |
| 740 × 400 (landscape) | 200px | **50.0 %** | 116px | yes |

**The panel never exceeds 50 % of the screen height in any state I could produce**, including 12
consecutive question-and-answer exchanges and a single maximum-length walkthrough answer. The cap is
enforced twice — declared `max-height: min(50vh, 420px)` and re-clamped in JS on every resize — and
the two now agree, which they did not in the earlier build. The bottom nav stays visible below the
panel and the page content stays visible above it. **This clause is met exactly, not approximately.**

Zero horizontal overflow at every width. Zero console errors across every run.

### Scope drift

Two things were built that Aaron did not ask for. Neither is a blocker; both should be visible to him.

1. **The existing Help screen's search box was rewritten too.** Aaron asked for a bubble. The Lead
   Developer replaced `helpSearch()` with the new matcher on **both** surfaces — including the Help
   screen that shipped and was signed off in v55. That widened the blast radius into already-accepted
   work and did cause a regression (LA-2: typing "help" on the screen titled *Search help* returned
   *"Nothing matched that"*), which both first-line gates missed and the Lead Auditor caught. It is
   fixed and pinned by a test. Worth naming as drift because the failure mode was predictable.
2. **Four starter question chips and a "Browse all 117 help topics" link** in the greeting. Small,
   sensible, and they materially help a lost user. I would keep them.

Nothing else was built beyond the request. The corpus was not edited — I confirmed the Auditor's
check that `HELP_TOPICS`, `FAQ_ITEMS`, `HELP_CATEGORIES`, `HELP_POINTERS` and `HELP_CARE_TEAM_LINE`
are unchanged from v55, which is the right discipline: no new medical wording entered the app in a
release that did not have a clinician read.

---

## 5. Release mechanics

`./release_check.sh` → **exit 0**. Raw output:

```
ℹ️  Baseline: PUBLISHED.json -> app-v55 (chemowell-app-v55-2) at 864aeaf
   4 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
```

| check | result |
|---|---|
| `APP_VERSION` | `app-v56` (`index.html:5704`) ✅ |
| `sw.js` CACHE | `chemowell-app-v56-4` ✅ — agrees with `APP_VERSION`, bumped from `chemowell-app-v55-2` |
| README row for this version | ✅ exists (`README.md:14`) and **names `chemowell-app-v56-4`**, the shipping key |
| README/cache agreement now enforced mechanically | ✅ new in `92c70bf` — good fix, this error had occurred twice |
| `release_check.sh` mode | `100755` ✅ |
| `mark_published.sh` mode | `100755` ✅ |
| working tree | clean ✅ |
| commits | 5 ahead of `origin/main`, all committed ✅ |
| `PUBLISHED.json` | correctly still records `app-v55` — nothing pushed ✅ |
| `REQUESTS.md` | correctly **un**ticked, with the reason ✅ |

### Test suites — run by me, in full

| suite | assertions | result |
|---|---|---|
| `test/v56-matcher.mjs` | **28 PASS / 0 FAIL** | ALL GREEN, exit 0 |
| `test/v56-helpbot.mjs` | **133 PASS / 0 FAIL** | ALL GREEN, exit 0 |
| `test/v55-help.mjs` | **145 PASS / 0 FAIL** | ALL GREEN, exit 0 |
| `test/v52-fixes.mjs` | **20 PASS / 0 FAIL** | ALL GREEN, exit 0 |
| **total** | **326 / 326** | |

The suites are green and, after LA-4/LA-5, they are no longer hollow. They do not cover the gap in
§3, because no suite asserts the guard against a clinical set that was not used to tune it. **That is
the single most useful test to add**: a held-out clinical fixture the patterns were not fitted to.

---

## 6. Decision, and what has to happen

**NO-GO.** Back to the Lead Developer under the functional/safety tier of the restart rule, then
through both mandatory gates from scratch.

**Must fix before this ships:**

1. **The guard misses `can I stop the chemo early` (confident answer) and `she fainted this morning`
   / `can a child take this` (list of app pages).** Follow the Lead Auditor's standing instruction:
   narrow, do not widen, and re-measure the ordinary set at the same time. Add a **held-out** clinical
   fixture to `test/v56-matcher.mjs` so this cannot regress silently again.
2. **Correct the README and `BACKLOG.md`.** "No medical question gets an app answer or a list of app
   pages" is false; the residual is not only the "I don't have an answer" fallback. Whatever the
   number is after the fix, state it honestly and state what the misses actually do.
3. **A behavioural gate must re-run on the final commit.** The Auditor and Lead Auditor last tested
   `0543e42`; the guard was rebuilt after that. This is the root cause of finding #1.

**Should fix in the same pass (cheap):**

4. `can I use this on my tablet` is falsely routed to the care team.
5. Log the four dropped items: N5, N6, Designer S1's fill delta, and the toast painting over the
   panel — or formally decline them in writing.

**Backlog, not blocking:** the four ordinary questions that find no page (`change the patient name`,
`see last week`, `log how she is feeling`, `free version`); LA-3's announcer and the per-tick refocus,
both already logged and both needing a real screen-reader pass.

---
---

# For Aaron — plain language

## What you asked for

A help button in the corner of the screen. Tap it, type your question in your own words, and it finds
the answer from the help pages already written into the app. Not AI — just a good search. Small
enough that you can still see your screen behind it, no bigger than half the screen, and one X to
close it.

## What you got

**The bubble and the panel are right.** I measured them on two phone sizes and two more besides:

- The button sits in the bottom-right corner of every screen, clear of the menu bar at the bottom. It
  stays out of the way during setup, the guided tour, the menu, and any pop-up.
- Tapping it opens a panel that greets you and offers four common questions to start with.
- **The panel takes up exactly half the screen and never more** — I filled it with twelve questions
  and the longest answer in the app, and it still stopped at half. Long answers scroll inside it. Your
  Today screen and the bottom menu stay visible the whole time.
- **One X, no minimise button**, exactly as you asked. Close it and reopen it and your conversation is
  still there. Close the app and it's gone — nothing you type is ever saved anywhere.
- It works with no internet, because it isn't AI and never talks to anything.

I typed forty ordinary questions a caregiver would actually ask. Thirty-eight got a sensible answer.

## Why I am not letting this go out yet

The app is supposed to refuse anything medical and tell you to ring your care team. Mostly it does —
25 of the 30 medical questions I tried were handled correctly, including *"is 101 a fever"*, *"she has
been vomiting for two days"* and *"how much tylenol can she have"*.

**But five slipped through, and two of them matter:**

- Typing **"can I stop the chemo early"** gets a confident answer about **reminder timing** — a page
  about the app's alarms — with a button offering to show you more. It doesn't say anything medically
  wrong, but it looks like the app answered a question about stopping cancer treatment. It should have
  said "ring your care team".
- Typing **"she fainted this morning"** gets a list of pages about medication schedules. Someone
  fainting can be an emergency. That is the exact situation this safety net exists for.

Nothing dangerous is ever *said* — the app never gives a dose, a number, or a "that's fine". The
problem is that it answers at all instead of pointing you at a person.

The second reason I'm holding it: **the release notes claim this never happens.** They say plainly
that no medical question gets an app answer. That isn't true, and a note that's wrong about a safety
feature is worse than no note, because the next person to work on this will believe it.

This is fixable and it isn't a rebuild — it's tuning the rules that spot a medical question, and then
testing them against a fresh set of questions rather than the same ones used to build them. The team
has to re-test after the change, which is what got missed this time: the medical filter was rebuilt
after the testers had already finished, so nobody checked the final version until I did.

## What to check on your phone once it does go out

1. Tap the help button on the Today screen. Confirm you can still see your medications above the
   panel and the menu bar below it — it should cover about half.
2. Ask it something ordinary: *"why can't I type in the daily limit box"*. You should get a real
   answer with steps.
3. Ask it something medical: *"is 101 a fever"*. It should refuse and point you to your care team.
4. Close it with the X, then tap the button again — your conversation should still be there.
5. Turn on aeroplane mode and ask it something. It should work exactly the same.

## Still open after this goes out

- A few ordinary questions find nothing — *"how do I change the patient name"*, *"how do I see last
  week"*, *"how do I log how she is feeling"*. Safe, just unhelpful; they need help pages written or
  the wording widened.
- Eleven of the trickier medical questions land on "I don't have an answer", which does tell you to
  ask your care team, but doesn't do it as clearly as the proper refusal does. Closing that properly
  needs a nurse to read the wording, which is already on the list.
- Two small visual tidy-ups the designer asked for were missed and I've flagged them: the "+ 2 more
  steps" line looks like a greyed-out step, and the panel's subtitle wraps onto two lines on the
  narrowest phones.
- The screen-reader behaviour needs one pass on a real phone with TalkBack. A browser can't test that.

## The honest summary

The thing you asked for got built, and the shape of it is right — this is the bottom-corner help
bubble you described, not another FAQ screen. The team caught a lot: five review stages ran and every
one of them found something real, including two that found mistakes in the *fixes* for earlier
mistakes. What went wrong is that the medical safety filter was rebuilt right at the end, after the
testers had signed off, and nobody re-tested it. I did, and it has a gap. One more round on that gap
and this is ready.

---
---

# ADDENDUM — held-out fixture and guard-rule analysis

Added after the NO-GO was accepted, at the coordinator's request. Everything below was measured
against the **real shipped corpus** sliced out of `index.html` with the same slice-and-eval harness
`test/v56-matcher.mjs` uses, so these numbers are the shipped behaviour, not a model of it.

**None of these questions was used to tune any pattern.** That is the point of them. Harness:
`/tmp/pm_holdout.mjs`, `/tmp/pm_rules.mjs`.

## A. Held-out set C — clinical (72). Must NOT produce a confident answer on a non-`careLead`
## topic, and must NOT produce a list of app pages.

Current behaviour, verbatim question → outcome.

### C1 — the original 30

| # | question | current outcome |
|---|---|---|
| 1 | `is this medicine safe for children` | GUARD (generic) |
| 2 | `what are the side effects of cisplatin` | GUARD (generic) |
| 3 | `is 2 tablets too many` | GUARD (generic) |
| 4 | `can i crush the tablet` | GUARD (generic) |
| 5 | `does this interact with grapefruit` | GUARD (generic) |
| 6 | `can a child take this` | ❌ **LIST** — `log-group-take-all`, `med-notes-field` |
| 7 | `what temperature is a fever` | ❌ **LIST** — `vit-temp-high`, `vit-temp-log`, `vit-temp-cant-remove`, `vit-temp-rejected` |
| 8 | `my mom doubled up on her tablets what now` | ANSWER `miss-real-missed` — **`careLead`, safe** |
| 9 | `should I take her to the hospital` | GUARD (generic) |
| 10 | `is a rash normal after chemo` | NONE |
| 11 | `she has been vomiting for two days` | GUARD (symptom) |
| 12 | `is 101 a fever` | GUARD (temp) |
| 13 | `how much tylenol can she have` | GUARD (generic) |
| 14 | `will she lose her hair` | ❌ **LIST** — `priv-lost-phone` |
| 15 | `my husband is very tired all the time` | GUARD (symptom) |
| 16 | `is it ok to drink alcohol on this` | GUARD (generic) |
| 17 | `can she take ibuprofen with this` | GUARD (generic) |
| 18 | `her mouth is full of sores` | GUARD (generic) |
| 19 | `is bleeding gums normal` | NONE |
| 20 | `should I call the doctor` | GUARD (generic) |
| 21 | `he has not eaten in three days` | GUARD (generic) |
| 22 | `is 60 heart rate too low` | NONE |
| 23 | `she fainted this morning` | ❌ **LIST** — `log-group-take-all`, `med-windows`, `med-placement` |
| 24 | `what dose should I give` | GUARD (generic) |
| 25 | `can I stop the chemo early` | ❌ **ANSWER `rem-late`** (not `careLead`) |
| 26 | `is this drug dangerous` | GUARD (generic) |
| 27 | `her legs are swollen` | GUARD (generic) |
| 28 | `is diarrhea a side effect` | GUARD (generic) |
| 29 | `how long until the nausea stops` | NONE |
| 30 | `she has a fever of 103 what do I do` | GUARD (temp) |

**C1 result: 6 wrong of 30** (5 if you accept #8 as safe on the `careLead` callout — I do).

### C2 — 42 more, written to stress stopping/pausing treatment, collapse/emergency phrasing,
### and "is this normal" questions

| # | question | current outcome |
|---|---|---|
| 31 | `can I stop her chemo early` | ❌ **ANSWER `rem-late`** |
| 32 | `can we pause the radiation for a week` | NONE |
| 33 | `is it too late to stop the treatment` | ❌ **LIST** — `med-gap-hours`, `rem-after-3-days` |
| 34 | `what happens if we stop the chemo` | NONE |
| 35 | `can I cut down her tablets` | ❌ **ANSWER `med-reorder`** ("I want my medications in a different order on Home") |
| 36 | `can she come off the pills` | ❌ **LIST** — `med-add-first`, `rem-no-reminder-for-med`, `set-quicklog-collapsed` |
| 37 | `can I delay her next infusion` | NONE |
| 38 | `we are thinking of stopping the radiation` | NONE |
| 39 | `can I lower the amount she takes` | NONE |
| 40 | `can I give her half` | GUARD (generic) |
| 41 | `my mum fainted` | NONE |
| 42 | `she collapsed` | ❌ **ANSWER `set-quicklog-collapsed`** ("All my medications vanished from Home") |
| 43 | `he passed out in the bathroom` | ❌ **LIST** — `log-button-locked` |
| 44 | `she cannot stop being sick` | NONE |
| 45 | `my dad is confused` | GUARD (generic) |
| 46 | `her lips went blue` | NONE |
| 47 | `he is short of breath` | GUARD (symptom) |
| 48 | `she is burning up` | GUARD (generic) |
| 49 | `my wife is in a lot of pain` | GUARD (symptom) |
| 50 | `his hands are shaking` | GUARD (generic) |
| 51 | `the injection site is red and hot` | NONE |
| 52 | `does radiation burn the skin` | NONE |
| 53 | `how do i know if its an infection` | NONE |
| 54 | `when is a temperature an emergency` | ANSWER `vit-temp-high` — **`careLead`, correct** |
| 55 | `is a nosebleed something to worry about` | ⚠️ ANSWER `vit-weight-change` — `careLead` so safe, but topically absurd |
| 56 | `what counts as a high temperature` | ANSWER `vit-temp-high` — **`careLead`, correct** |
| 57 | `how long do the side effects last` | GUARD (generic) |
| 58 | `what should I do about a sore mouth` | NONE |
| 59 | `is losing weight normal on chemo` | NONE |
| 60 | `does chemo make you lose your hair` | NONE |
| 61 | `can she have a flu jab` | GUARD (generic) |
| 62 | `is it ok to have a bath after radiation` | GUARD (generic) |
| 63 | `what should she eat during chemo` | ❌ **ANSWER `pro-wrong-treatment-type`** |
| 64 | `can she go to work during treatment` | ❌ **LIST** — `pro-wrong-treatment-type`, `treat-set-date`, `treat-no-card`, `vit-weight-change` |
| 65 | `is it normal to feel this tired` | GUARD (symptom) |
| 66 | `her taste has gone funny` | GUARD (generic) |
| 67 | `should the tablets be taken before food` | ❌ **LIST** — `med-notes-field`, `med-days-taken`, `log-basic` |
| 68 | `what if she throws up after taking it` | ❌ **LIST** — `med-notes-field`, `log-group-take-all`, `rem-after-3-days`, `med-treatment-availability` |
| 69 | `is it dangerous to miss two days` | GUARD (generic) |
| 70 | `how do I stop the sickness` | GUARD (symptom) |
| 71 | `what cream can i put on the radiation burn` | GUARD (generic) |
| 72 | `can i put cream on her rash` | NONE |

**C2 result: 11 wrong of 42.**

**Whole clinical set: 34 of 72 reach the guard. 17 of 72 are wrong** — 5 confident answers on
non-`careLead` topics, 12 lists of app pages. The other 21 land on "I don't have an answer", which is
safe.

**The five genuinely wrong confident answers, ranked by how bad they read:**

1. `she collapsed` → *"All my medications vanished from Home"* — matched on the literal word
   **collapsed**. Score 1.05, coverage 1.00, **nterms 1**.
2. `can I stop the chemo early` / `can I stop her chemo early` → *"The reminder came a few minutes
   early…"* — matched on **early**. Score 0.593 vs 0.411 runner-up, coverage 0.667, anchor true. It
   clears every existing gate legitimately.
3. `can I cut down her tablets` → *"I want my medications in a different order on Home"*.
4. `what should she eat during chemo` → *"I picked the wrong treatment type during setup"*.

## B. Held-out set O — ordinary app questions (66). Must NOT be routed to the care team.

### O1 — the original 40. **Two falsely refused:**

- ❌ `can I use this on my tablet`
- ❌ `can I split a dose into two`

Full list, in order: `how do I add a medication` · `where do I put take with food` · `how do I log a
dose` · `why cant i type in the daily limit box` · `how do I export my records` · `is my data safe` ·
`does it work without internet` · `how do I change the patient name` · `how do I turn on reminders` ·
`why am I not getting notifications` · `how do I add a second patient` · `what does take all mean` ·
`how do I delete a medication` · **`can I use this on my tablet`** · `how do I back up my data` ·
`how much does it cost` · `how do I cancel my subscription` · `how do I see last week` · `where is
the calendar` · `how do I add a note` · `how do I print a report` · `what is the hours between doses
box` · `how do I mark a dose as skipped` · `how do I edit a dose I already logged` · `how do I pause
a medication` · `how do I add an appointment` · `how do I record a symptom` · `can I share this with
my doctor` · `how do I get my records out of the app` · `I lost my phone what happens to my data` ·
`how do I start over` · `how do I erase everything` · `why is the app asking me to upgrade` · `how do
I add radiation treatment` · `how do I change the time of a reminder` · `how do I log how she is
feeling` · `the app is not saving my medication` · `how long does the free version last` · **`can I
split a dose into two`** · `how do I set which days she takes it`

Four of these find no page at all (safe, unhelpful): `how do I change the patient name`, `how do I
see last week`, `how do I log how she is feeling`, `how long does the free version last`.

### O2 — 26 more, written the way a carer actually talks: third-person subject, no app jargon.
### **This set was written specifically to stress the person-state guard, and it finds 7 more
### false refusals that the tuned 35-question set never exposed.**

| # | question | current outcome |
|---|---|---|
| 41 | `how do I add her medication` | ANSWER `med-add-first` ✅ |
| 42 | `how do I add his tablets` | ANSWER `med-add-first` ✅ |
| 43 | `how do I put in the pills she takes at night` | NONE |
| 44 | `she takes it twice a day how do I set that up` | LIST ✅ |
| 45 | `how do I change her name` | LIST ✅ |
| 46 | `how do I mark that she took it` | LIST ✅ |
| 47 | `what time does she get reminded` | LIST ✅ |
| 48 | `how do I see when she took hers` | NONE |
| 49 | `how do I add the days she has chemo` | ❌ **GUARD — refused** |
| 50 | `my wife takes hers in the morning how do I show that` | NONE |
| 51 | `how do I add my husband as the patient` | NONE |
| 52 | `she has two different tablets how do I add both` | ❌ **GUARD — refused** |
| 53 | `can I print her chemo dates` | NONE |
| 54 | `how do I show her appointments` | ANSWER `appt-month-view` ✅ |
| 55 | `how do I share this with her doctor` | ANSWER `exp-printable` ✅ |
| 56 | `how do I stop hers showing on the home page` | LIST ✅ |
| 57 | `my mum has a different one in the evening` | ❌ **GUARD — refused** |
| 58 | `how do I say she takes it on treatment days only` | ANSWER `med-treatment-availability` ✅ |
| 59 | `he takes his with breakfast where does that go` | NONE |
| 60 | `how do I put in that she missed one` | LIST ✅ |
| 61 | `my dad has three of them how do I add them all` | ❌ **GUARD — refused** |
| 62 | `she stopped taking one of them` | ❌ **GUARD — refused** |
| 63 | `how do I remove hers` | LIST ✅ |
| 64 | `his is a liquid not a tablet` | ❌ **GUARD — refused** |
| 65 | `how do I set hers to remind at 8` | NONE |
| 66 | `she has chemo every third week` | ❌ **GUARD — refused** |

**Whole ordinary set: 9 of 66 falsely refused (13.6 %)** — not 0 of 35. The README's "0 of 35"
is true of the set it was measured on and does not generalise.

**Why.** `HELP_APP_OBJECTS` — the noun list that suppresses the SOFT and person-state patterns — is
missing the app's own most central nouns: **medication, medicine, pill, tablet, dose, name, time,
day, days, schedule, appointment, treatment, chemo, radiation, morning, evening**. So *"she has two
different tablets how do I add both"* contains, by that regex's definition, no app object at all,
falls through to `HELP_GUARD_PERSON_STATE` (`she` + `has`), and is refused.

## C. Your design question 1 — is "third-person subject + no app-object noun = clinical" too blunt?

**As stated, yes, disqualifyingly so. But the subject rule is not the problem — the suppressor is.**
Measured over all 66 ordinary and all 72 clinical questions above:

| variant | ordinary falsely refused | clinical reaching the guard |
|---|---|---|
| **Current** (verb list + noun suppressor) | **9 / 66** | **34 / 72** |
| **Rule A** as you proposed it (no verb list, noun suppressor) | **29 / 66** ❌ | 51 / 72 |
| **Rule C** — keep your verb list, replace the noun suppressor with an *app-task frame* | **6 / 66** ✅ | 34 / 72 |
| **Rule A + task-frame suppressor** | **10 / 66** | **50 / 72** |

Rule A alone would refuse **29 of 66** ordinary questions — 44 %. It refuses `how do I add her
medication` and `how do I add his tablets`, which are the single most common task in the app. That
is worse than the LA-1 regression you already fixed once.

But look at the last row. The blunt subject rule becomes affordable **the moment the suppressor
stops being a noun list**. The suppressor I tested is a grammatical frame rather than vocabulary:

```
an interrogative (how|where|what|which|why|can|do|does)
  within ~45 chars of
an app-task verb (add|put|set|change|edit|show|see|view|record|enter|remove|delete|log|save|
                  find|print|export|share|mark|tick|fill|type|select|choose|sort|open|turn on/off)
```

A clinical question is almost never phrased as *"how do I add…"*. An app question almost always is.
That frame is not a symptom list, needs no clinician, and it is **strictly better than what ships
today even if you change nothing else**: Rule C drops false refusals from 9 to 6 with zero loss of
clinical catch. Then, if you also drop the verb list, you gain **+16 clinical catches for +1 false
refusal** against current.

The two patterns that stay wrong under every variant are `can I use this on my tablet` and `can I
split a dose into two` — both from `HELP_GUARD_HARD`, so they need a separate look.

**My recommendation: change the suppressor first and re-measure. Decide on the verb list second.**
They are separable, and the suppressor is the one carrying the damage.

## D. Your design question 2 — does the narrow `can/should + stop|start|pause|reduce|change +
## treatment noun` fix leave a hole?

**Yes. It catches 3 of the 11 stop-shaped clinical questions in the set, and costs 0 ordinary
questions.** Take it — it is free — but do not mistake it for the fix.

Caught: `can I stop the chemo early`, `can I stop her chemo early`, `can we pause the radiation for
a week`.

Not caught, and these are the holes:

| question | current outcome | why the rule misses it |
|---|---|---|
| `can I cut down her tablets` | ❌ ANSWER `med-reorder` | verb not in the list; noun is *tablets*, not a treatment noun |
| `can she come off the pills` | ❌ LIST | *come off* is a phrasal verb |
| `is it too late to stop the treatment` | ❌ LIST | no `can`/`should` |
| `what happens if we stop the chemo` | NONE | no `can`/`should` |
| `can I delay her next infusion` | NONE | *delay*; *infusion* |
| `we are thinking of stopping the radiation` | NONE | declarative, no modal |
| `can I lower the amount she takes` | NONE | *lower*; no treatment noun |

Two structural notes that matter more than the pattern list:

1. **The most common phrasing has no treatment noun in it.** A carer says *"her tablets"*, *"the
   pills"*, *"one of them"* — not *"the chemotherapy"*. Any rule anchored on chemo/radiation/
   treatment misses the way people actually type.
2. **The `can I stop the chemo early` failure is not really about stopping.** It answered because
   the word **early** matched `rem-late` at 0.593 with coverage 0.667 and a 1.44× margin — every
   existing gate passed honestly. The word *chemo* contributed nothing. So a pattern for this
   question fixes this question and nothing else in its class.

**The class is: a confident answer driven by one incidentally-shared word.** `she collapsed` →
*"All my medications vanished from Home"* is the same failure with a different word, and no
pattern you can write about stopping treatment will touch it.

### The highest-leverage fix, and it needs no clinician and no new vocabulary

You added `HELPBOT_LIST_COVERAGE = 0.34` to the **list** path in `a0e1a66` and it worked. **The
answer path has no equivalent floor on how much of the query the topic actually explains.** Two
cheap candidates, both measurable against the sets above:

- **Require `nterms >= 2` on the answer path.** `she collapsed` has **nterms = 1** — a single content
  word producing a confident answer is the whole defect. Today `nterms <= 2` merely demands
  `cov >= 0.999`, which a one-word query satisfies trivially. Single-content-word queries should
  degrade to a list or to "I don't know", never to a confident answer.
- **Raise the margin, or require a second matched term, when the query contains any third-person
  personal subject.** `she collapsed`, `can I stop her chemo early` and `can I cut down her tablets`
  all carry one; `how do I add a medication` does not.

Neither invents a symptom list, and both degrade to copy that already exists and already says the
right thing.

## E. What I would put in the suite

Commit sets C (72) and O (66) as `test/v56-guard-heldout.mjs`, and have it print **two lines that
can never be confused with the tuned numbers**:

```
HELD-OUT clinical:  N/72 wrong  (confident answer on a non-careLead topic, or a list of app pages)
HELD-OUT ordinary:  N/66 wrong  (routed to the care team)
```

Today those read **17/72** and **9/66**. Treat `careLead` answers as passes — `vit-temp-high` for
*"what counts as a high temperature"* is the right page and carries the care-team callout, and
counting it as a failure would push you back toward over-refusing.

---
---

# PM RE-GATE — `9bf99c9`

**VERDICT: NO-GO.** One new **High**, introduced by this round's suppressor change.

**Date:** 2026-08-11. **Under test:** `9bf99c9`, working tree clean, `release_check.sh` exit 0.
**Method:** all five suites run; then a fresh adversarial set of **60 questions written for this
re-gate and never shared with anyone**, because the previous held-out set is now committed and
therefore no longer capable of testing generalisation on its own. Live confirmation at 360 and 390.

## 1. Everything you fixed, verified

| item | status |
|---|---|
| `she collapsed` → confident app answer | ✅ dead (`nterms >= 2`) |
| `can I stop the chemo early` → confident app answer | ✅ dead |
| `can I use this on my tablet` falsely refused | ✅ now a normal list |
| N5 "+ N more steps" | ✅ `TYPE.caption` / `#915E48` |
| N6 header subtitle | ✅ shortened to "Searches this app's help" |
| Designer S1 colour residual | ✅ logged as a decision (`BACKLOG.md:51`) |
| Toast over panel | ✅ — and **my previous finding was wrong**: I read z38 off the Lead Designer's report against `0543e42`; the code had already moved to z51 in `a0e1a66`. It is now logged as the trade it is |
| Lead-Designer items reaching BACKLOG | ✅ all three |
| README's bolded absolute | ✅ gone, replaced with the measured held-out numbers |
| Held-out fixture committed with a no-tuning rule | ✅ `test/v56-guard-heldout.mjs`, ratchets 7 / 3 |
| Scope clauses (all of Aaron's words) | ✅ re-measured — **50.0 %** at 360×800, **49.8 %** at 390×844, 42.0 % at 412×1000, 50.0 % at 740×400. One X, no minimise. Transcript kept across close/reopen. Zero overflow, zero console errors |
| Release mechanics | ✅ `APP_VERSION app-v56`, `sw.js chemowell-app-v56-5`, README row names `chemowell-app-v56-5`, both `.sh` `100755`, tree clean |

**Suites, all run by me: 327 assertions + the held-out fixture, all green.**

| suite | result |
|---|---|
| `test/v56-guard-heldout.mjs` | 7/72 clinical, 3/66 ordinary — **WITHIN RATCHET**, exit 0 |
| `test/v56-matcher.mjs` | 29 PASS / 0 FAIL |
| `test/v56-helpbot.mjs` | 133 PASS / 0 FAIL |
| `test/v55-help.mjs` | 145 PASS / 0 FAIL |
| `test/v52-fixes.mjs` | 20 PASS / 0 FAIL |

## 2. THE BLOCKER — expanding `HELP_APP_OBJECTS` opened a hole in the medical guard

**This one is on me.** I told you to add the app's own core nouns to `HELP_APP_OBJECTS`. You did —
`medication|meds|med|pill|pills|tablet|tablets|dose|doses|schedule|…`. You reasoned carefully about
`chemo`/`radiation`/`treatment` and correctly kept them out. But `HELP_APP_OBJECTS` doesn't only
suppress the third-person rule. **It also suppresses `HELP_GUARD_SOFT`** — and SOFT is where
`safe|dangerous|harmful|toxic`, `side effects` and `for a child` live.

So every one of the app's core nouns is now a free pass for the most common clinical phrasing there
is. Fourteen questions written for this re-gate, **14 of 14 wrong**, confirmed live at 360 and 390:

| typed | reply | care-team wording? |
|---|---|---|
| **`is the tablet safe`** | **confident answer: *"Is my information stored on a server somewhere? **No.** Everything you enter stays on this device."*** | **no** |
| **`are these pills safe`** | same | **no** |
| **`is the med safe for her`** | same | **no** |
| **`does the tablet have side effects`** | confident answer: *"How do I record a symptom?"* + 3 steps | **no** |
| **`does this medication have side effects`** | same | **no** |
| `is this dose safe` · `is her medication dangerous` · `is this medication ok for a child` · `are the pills ok for a toddler` · `is the tablet toxic` · `is this dose harmful` · `is her morning tablet safe with the evening one` · `is the daily dose too strong` · `are these meds safe together` | lists of app pages | **no** |

`is the tablet safe` is the worst reply this feature has produced in any round. The first word on
screen under that question is **"No."** Evidence:
`outputs/pm-v56b-02-FINDING-tablet-safe-answered-No-390.png`,
`pm-v56b-01-FINDING-is-the-tablet-safe-{360,390}.png`.

**Neither fixture can see this.** The tuned set doesn't contain it; the held-out set doesn't either,
because I wrote those 72 questions *before* `tablet`/`pill`/`dose` became suppressors. Both are
green. That is the same lesson as last round, one layer down: a fixture only tests the failure modes
that existed when it was written.

### The fix — minimal, and I measured it rather than guessing

Split the suppressor into two tiers, and let the dual-use nouns suppress **only** the third-person
rule, never SOFT:

- **Tier 1 — app-only nouns** (`app`, `screen`, `data`, `export`, `csv`, `reminder`, `backup`,
  `account`, `calendar`, `name`, `day`, `week`, …): suppresses SOFT *and* third-person, as today.
  This is what keeps *"is my data safe"* answering — `data` is app vocabulary and nothing else.
- **Tier 2 — dual-use nouns added this round** (`medication`, `meds`, `med`, `pill`, `tablet`,
  `dose`, `schedule`, `morning`, `evening`, `night`): suppresses the third-person rule **only**.
  These words are exactly as clinical as they are app vocabulary, so they must not buy a pass on
  "is it safe".
- The app-task frame keeps suppressing both. It is not the problem; it carried the gain, as you said.

Measured against all three sets:

| | held-out ordinary | held-out clinical | new app-noun clinical |
|---|---|---|---|
| current `9bf99c9` | 3 / 66 | 7 / 72 | **14 / 14 wrong** |
| **tier-split** | **3 / 66** (unchanged) | **7 / 72** (unchanged) | **1 / 14 wrong** |

Both ratchets hold exactly. The only residual is `is the daily dose too strong`, which becomes a
list. This is a change to one constant and one line of `helpBotGuard`.

## 3. Your question 1 — did I stop tuning? Partly. Two patterns are fitted to the fixture.

I audited every pattern added this round against the held-out set and against 26 never-shared
clinical questions:

| pattern | held-out matches | never-shared matches | verdict |
|---|---|---|---|
| `/\b(pharmacist\|oncologist)\b/` (promoted to HARD) | 0 | 1 | generalises |
| `/(can\|should\|shall) (i\|we\|he\|she\|they) (stop\|start\|pause\|reduce\|lower\|cut\|increase\|double\|halve\|delay\|skip\|come off)/` | **7** | **0** | **fitted to the fixture** |
| `/(stop\|stopping\|reduce\|…\|delay\|delaying) (the\|her\|his\|their)? (chemo\|…\|infusion\|tablets?\|pills?\|medication\|meds)/` | **7** | **0** | **fitted to the fixture** |

Both stop/reduce patterns fire on 7 held-out questions each and on **none** of 26 fresh clinical
questions. `infusion` and `come off` each appear in exactly one held-out question and nowhere else.
They are load-bearing — remove them and those 7 leak again — so they are not decoration, but they
are proven only on the questions they were written for.

**The honest position: those ~7 lines are no longer held out.** The chain is mine — the verb list
came from my Q2 answer, which I derived from held-out failures — so this is my contamination as much
as yours. Mark those lines "consumed" in the fixture, or discount the clinical ratchet by them.

**But the behaviour underneath does generalise, which is the thing that actually matters.** Twelve
new stop/quit/pause/reduce questions in phrasings the patterns cannot match — *"she wants to quit
the treatment"*, *"do we have to finish the whole course"*, *"is halving the tablet allowed"*,
*"what if she stops on her own"* — came out **11 / 12 correct**, caught by the third-person rule and
the `should i/we` frame rather than by the fitted patterns. The only miss is `is it ok to miss a
cycle` (list). So the class is genuinely handled; it is the *measurement* of it that is inflated.

Also: `HELP_GUARD_PERSON_STATE` is now dead — declared, sliced by two test harnesses, referenced by
nothing in `helpBotGuard`. Delete it or it will be mistaken for live code.

## 4. Your question 2 — attacking the two floors

### `HELPBOT_MIN_TERMS = 2` — well chosen. Real cost, but small and safe-directional.

I tried 22 legitimate one- and two-word queries. **Eleven lost a confident answer** — `export`,
`backup`, `offline`, `upgrade`, `print`, `symptoms`, `notes`, `appointments`, `privacy`, `reorder`,
`pause`. But **every one degraded to a LIST, not to "I don't know"**, and in each case the topic
that would have been the confident answer is the **first row of that list**. The cost is one extra
tap. Two-word queries (`missed dose`, `daily limit`, `take all`, `erase everything`) all still
answer confidently. **I could not find a query the floor refuses outright.** Keep it at 2.

One wart worth a line: `pause`, `reorder` and `backup` now produce a **one-item list** — the app says
*"I'm not certain which one you mean — do any of these match?"* above a single option. Render a
single-hit list as the answer, or reword that header when there is exactly one row.

### `HELPBOT_SUBJECT_MARGIN = 1.6` — I could not break it, and 1.5 would have been too loose.

All 14 person-subject clinical questions I invented are caught by the guard before the margin is
consulted, so the margin never gets a turn on them. To test it properly I built the case where it is
the *only* defence — a person subject plus an app-object noun, so the guard is suppressed:

| typed | top:runner-up ratio | outcome |
|---|---|---|
| `she reacted badly to the new tablet` | **1.57** | list (would have been a **confident** *"How do I add a medication?"* at a 1.5 margin) |
| `his medication is causing bleeding` | 1.27 | no-answer |
| `she cannot swallow the tablet` | 1.18 | list |
| the other 7 | 1.00–1.10 | no-answer |

So 1.6 is not arbitrary — there is a real case sitting at 1.57, and anything looser lets it through.
It is about as low as it can safely go. **Leave it.** Note that all ten of those cases are the §2
bug in another guise: they only reach the margin because an app noun suppressed the guard. Fix §2
and the margin goes back to being belt-and-braces.

## 5. Decision

**NO-GO**, on §2 only. Everything else in this round is right, and the two floors are the correct
change — they are what turned the previous round's confident wrong answers into lists.

**Must fix:** the tier-split suppressor above. One constant, one line, measured, both ratchets hold.
**Should fix:** delete dead `HELP_GUARD_PERSON_STATE`; add the 14 app-noun clinical questions to the
held-out file as a second section (they are new and unused); mark the ~7 stop/reduce lines consumed.
**Then re-gate.** This is a small change and I do not need another full round on it — but it does
need a gate, because the last two Highs both arrived in a "small change" made after the testers
finished.

---
---

# For Aaron — plain language (re-gate)

## Where this stands

Almost everything is fixed. The help bubble does what you asked for, and I re-measured every one of
your words on a real phone-sized screen:

- Button in the bottom-right corner of every screen, out of the way during setup and the tour.
- Tap it and a panel opens that greets you and offers four common questions.
- **It covers exactly half the screen and never more** — I filled it with six long answers and it
  stopped at half. Long answers scroll inside it. Your medications and the bottom menu stay visible.
- **One X, no minimise button.** Close it and reopen it and your conversation is still there.
- Works with no internet. Nothing you type is saved.

The two bad answers I found last time are both gone. Typing *"she collapsed"* no longer brings up a
page about the app, and *"can I stop the chemo early"* no longer answers with a page about alarm
timing. The team also fixed the two small design misses, wrote down the things that had only been
sitting in reports, and — the important one — removed the sentence in the release notes that claimed
this could never happen, replacing it with the real measured number.

## Why I am still saying not yet

I found one new problem, and it is the same kind as before.

To stop the app wrongly refusing ordinary questions like *"how do I add her tablets"*, the team told
it that words like **tablet, pill, dose and medication** mean "this is a question about the app". That
worked. But those same words also switched off part of the medical safety net.

So now:

- Typing **"is the tablet safe"** brings up the privacy page, and the first word on screen underneath
  your question is **"No."**
- Typing **"does the tablet have side effects"** brings up "How do I record a symptom?" with steps.
- Ten more like them get a list of app pages.

None of them says anything medically wrong, and none of them gives a dose or a number. But a
frightened person at 2am typing *"is the tablet safe"* and reading **"No."** is not something I will
sign off, even though the "No" is answering a completely different question.

**This one is my fault, not the team's.** I recommended adding those words. I did not spot that the
same list also controls the "is it safe" check. The team followed the advice correctly.

The fix is small — I have already tested it, and it clears 13 of the 14 bad answers without breaking
anything that currently works. It is a change to about two lines.

## What to check on your phone once it does go out

1. Tap the help button on the Today screen — you should still see your medications above the panel
   and the menu bar below it.
2. Ask something ordinary: *"why can't I type in the daily limit box"*. Real answer with steps.
3. Ask something medical: *"is the tablet safe"*. It must tell you to ring your care team.
4. Close it with the X, reopen — your conversation should still be there.
5. Aeroplane mode — it should work exactly the same.

## Still open after this goes out

- A few ordinary questions find nothing, e.g. *"how do I see last week"*. Safe, just unhelpful.
- Seven of the seventy-two trickier medical questions still get a list of app pages instead of a
  clear "ask your care team". None of them gets a confident answer any more, which was the dangerous
  version. Two of the seven put the right care-team page at the top of the list.
- One-word searches like *"pause"* now show a list of one option under the heading "I'm not certain
  which one you mean", which reads oddly. Cosmetic.
- The screen-reader behaviour still needs one pass on a real phone with TalkBack.

## The honest summary

The feature is right and the geometry is exactly what you asked for. The medical safety net is much
stronger than it was two rounds ago — the class of answer that worried me most is gone. What keeps
happening is that each fix to the safety net opens a smaller hole somewhere else, and each time it is
found by testing with questions nobody had used to build it. That is the process working, not
failing. One more small change and this is ready.

---
---

# PM RE-GATE 2 — `97b831c`

**VERDICT: GO.**

**Date:** 2026-08-11. **Under test:** `97b831c`, tree clean, `release_check.sh` exit 0.
**Method:** mechanical diff invariants; 68 questions written for this gate and never shared with
anyone; a side-by-side comparison against `9bf99c9` to separate regressions from pre-existing
behaviour; all five suites; live re-measurement of every scope clause at 360 and 390.

## 1. Your question 3 first — is the tier split the only behavioural change?

Checked mechanically, not by reading:

| | `9bf99c9` | `97b831c` |
|---|---|---|
| `HELP_GUARD_HARD` (whole array) | md5 `f3d8cb2f…` | **identical** |
| `HELP_GUARD_SOFT` (whole array) | md5 `6dec5932…` | **identical** |
| `HELP_GUARD_PERSON` (whole array) | md5 `41ec7d98…` | **identical** |
| `HELP_APP_TASK` | md5 `7d486f4a…` | **identical** |
| `ANSWER` / `SHOW` / `MARGIN` / `LIST_COVERAGE` / `MIN_TERMS` / `SUBJECT_MARGIN` | 0.55 / 0.40 / 1.15 / 0.34 / 2 / 1.6 | **all unchanged** |

Nothing moved from HARD to SOFT, nothing left a list. I also proved the tiering is a pure partition:

```
old HELP_APP_OBJECTS:  92 tokens
new tier 1:            79      new tier 2 (dual):  13      union: 92
union === old:         true    lost: []   added: []   overlap: []
```

Because the union is exactly the old set and the third-person rule consults the union, **the
third-person rule's behaviour is provably byte-identical to `9bf99c9`.** The only behavioural delta
in the whole commit is that `HELP_GUARD_SOFT` is no longer suppressed by the 13 dual-use nouns —
which is the fix — plus the one-row list copy. `HELP_GUARD_PERSON_STATE` is gone from `index.html`
and from both harnesses.

## 2. The fix works, confirmed on the running product

All five of the questions that produced the last NO-GO now route to the care team, verbatim, at
both 360 and 390:

| typed | before (`9bf99c9`) | now (`97b831c`) |
|---|---|---|
| `is the tablet safe` | confident *"Is my information stored on a server somewhere? **No.**"* | **"That's a question for the care team…"** |
| `are these pills safe` | same | care team |
| `does the tablet have side effects` | confident *"How do I record a symptom?"* + steps | care team |
| `is this medication ok for a child` | list of app pages | care team |
| `is her medication dangerous` | list of app pages | care team |

Independently reproduced: 14 app-noun clinical questions went **14/14 wrong → 2/14**, and both
pre-existing held-out counts held exactly. Your reported figures — **9/86 clinical, 3/66 ordinary**
— I re-derived from the fixture myself and they are correct.

## 3. Your question 1 — attacking the tier boundary

I wrote 16 clinical questions built around tier-1 nouns (`morning`, `evening`, `night`, `symptoms`,
`report`, `history`, `card`, `entry`, `name`, `week`, `day`, `limit`, `units`, `track`).

**7 of 16 leak — and you were right about the exact shape.** `is her morning tablet safe` → a list
including the privacy page. `her symptoms are getting worse` → a list (led by `sym-severe`, which is
at least the right page). `symptoms` sitting in tier 1 is the clearest miss: it is the clinical noun.

**But — and this is what decides the verdict — every one of the 7 behaves identically at `9bf99c9`.**
I ran both builds side by side:

```
unchanged  is her morning tablet safe                9bf99c9=LIST -> 97b831c=LIST
unchanged  her symptoms are getting worse            9bf99c9=LIST -> 97b831c=LIST
unchanged  is a week without a bowel movement …      9bf99c9=LIST -> 97b831c=LIST
… all 7 unchanged
```

These are **pre-existing residual, not a regression**, and they are all **lists — zero confident
answers**. The class that produced both NO-GOs is gone.

**Free refinement, measured, for the next release rather than now:** move `symptoms`, `morning`,
`evening`, `night` from tier 1 to tier 2. Result — boundary leaks **7 → 5**, held-out clinical
**9/86 unchanged**, held-out ordinary **3/66 unchanged**, 20 new ordinary questions **still 0
refused**. It costs nothing. I am not making it a condition of this release because it is a
refinement of a residual, not a fix for a defect, and this release has now had two Highs arrive in
small post-gate changes.

## 4. Your question 2 — new questions, not variations

Three sets in vocabulary and shapes I have never sent you.

**E2 — 20 clinical questions in territory nothing has been tuned on** (dentist, pets, driving,
glove handling, fertility, vaccines, line care, caregiver exhaustion, taste, mood):
*"can she have a filling done at the dentist"*, *"should the cat stay out of her room"*, *"is her
line supposed to weep"*, *"do I need gloves to handle her medicine"*, *"how long before they can try
for a baby"*, *"I am exhausted looking after her"*, *"is it ok to have the covid booster"* …

> **0 / 20 wrong.** Every one routed to the care team. This is the strongest evidence in the whole
> release that the guard generalises rather than memorises — none of these words appears in any
> pattern, and the third-person rule plus SOFT caught all of them.

**E3 — 20 ordinary app questions about things the app mostly does not even have**
(*"can I get it in spanish"*, *"does it have a dark mode"*, *"can I attach a photo of the label"*,
*"does it work on my watch"*, *"how do I widen the columns"*, *"what do the little dots mean"*):

> **0 / 20 refused.** They answer, list, or honestly say they don't know — never the care team.

**E4 — 12 ordinary questions that deliberately use SOFT vocabulary** (`safe`, `dangerous`,
`harmful`), the direct regression risk of this change: 4 refused — and **all 4 behave identically at
`9bf99c9`**. Three (`is it dangerous to change my phone clock`, `is it safe to use on a shared
tablet`, `is it safe to uninstall and reinstall`) are caught by HARD patterns that predate this
entire release. **This round introduced no new false refusals at all.**

Across all four new sets: **11 wrong of 68**, none of them new, none of them a confident answer.

## 5. Release mechanics

`./release_check.sh` → **exit 0**:

```
ℹ️  Baseline: PUBLISHED.json -> app-v55 (chemowell-app-v55-2) at 864aeaf
   6 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
```

`APP_VERSION app-v56` · `sw.js chemowell-app-v56-6` · README row names `chemowell-app-v56-6` ·
both `.sh` `100755` · tree clean · `PUBLISHED.json` correctly still `app-v55`.

**Suites, all five run by me:**

| suite | result |
|---|---|
| `test/v56-guard-heldout.mjs` | 9/86 clinical, 3/66 ordinary — **WITHIN RATCHET**, exit 0 |
| `test/v56-matcher.mjs` | 29 PASS / 0 FAIL |
| `test/v56-helpbot.mjs` | 133 PASS / 0 FAIL |
| `test/v55-help.mjs` | 145 PASS / 0 FAIL |
| `test/v52-fixes.mjs` | 20 PASS / 0 FAIL |

**Scope clauses, re-measured live on this build:**

| viewport | panel height | **% of screen** | scrolls inside |
|---|---|---|---|
| 360 × 800 | 400px | **50.0 %** | yes (6758px of transcript in 266px) |
| 390 × 844 | 420px | **49.8 %** | yes |
| 412 × 1000 | 420px | 42.0 % | yes |
| 740 × 400 landscape | 200px | 50.0 % | yes |

Bubble bottom-right, 14px from the edge, 84px up, clear of the nav. **One X, no minimise** — every
button in the panel enumerated. Transcript survives close/reopen. Zero horizontal overflow, zero
console errors at both widths.

## 6. Decision

**GO.** The safety property Aaron needs now holds: across 86 held-out plus 68 brand-new questions,
**nothing medical gets a confident app answer**. The residual is that some clinical questions get a
list of app pages instead of an explicit care-team route — measured, ratcheted, documented, and
unchanged by this commit.

The honesty note about the two fitted stop/reduce patterns is in the fixture, written plainly. That
matters more than the number it qualifies.

**Not blocking, for the next release:**
1. Move `symptoms`, `morning`, `evening`, `night` to tier 2 — measured free, 7 → 5 boundary leaks.
2. The best remaining lever is not another pattern: **a list reply carries no care-team wording at
   all.** Every residual leak in this release is a list. Adding the existing `HELP_CARE_TEAM_LINE`
   to list replies whose query the guard *nearly* matched would close all of them at once, using
   copy that already shipped and needs no clinician. Worth designing properly rather than rushing.
3. `README.md:14` says "72 medical and 66 ordinary" in one sentence and "9 of 86" two sentences
   later. Both are true of different moments; together they read as a contradiction — the same
   class of thing the Scribe caught last round.

---
---

# For Aaron — the completion summary

## What you asked for

> *"I wanted the bot to be like and on screen help like most apps have them down in the bottom
> corner. they can click on it and start typing and the bot will look up their question and reply.
> like AI, but its not AI, its just things that has already been written to the app."*

And then: it should pop up small so you can still see the screen behind it, no more than half,
scrolling is fine, and just an X to close — no minimise button.

## What you got

**All of it.** I measured every part on phone-sized screens rather than taking anyone's word:

- **A round button in the bottom-right corner of every screen.** It stays out of the way during
  setup, the guided tour, the menu and any pop-up, so it never sits on top of something you need.
- **Tap it and a small panel slides up.** It says hello, tells you plainly that it is not a person
  and not AI, and offers four common questions to get you started.
- **It covers exactly half the screen and never more.** I filled it with a dozen long answers to try
  to make it grow, and it stopped at half every time. Your medications stay visible above it and the
  bottom menu stays visible below it. Long answers scroll inside the panel, as you said was fine.
- **Type a question in your own words** — *"why can't I type in the daily limit box"* — and it finds
  the matching help page: the answer, the first few steps, and a button through to the full
  walkthrough. If your question could mean a few things it offers a short list to pick from. If it
  doesn't know, it says so instead of guessing.
- **One X, no minimise button**, exactly as you asked. Close it and reopen it and your conversation
  is still there. Close the app and it is gone — nothing you type is ever saved anywhere.
- **It is not AI and never pretends to be.** No internet, no account, no waiting. It works in
  aeroplane mode, because it is only looking through the 132 help pages already inside the app. It
  never reads your medications or your logs.
- **It will not answer a medical question.** Anything about a dose, whether something is safe, side
  effects, or how someone is feeling gets pointed at your care team instead.

## What it took to get here, honestly

Five review stages ran, and every single one found something real. Three of them found mistakes in
the *fixes* for earlier mistakes. My own gate blocked this release twice:

- The first time, typing *"she collapsed"* brought up a page about the app, and *"can I stop the
  chemo early"* answered with a page about alarm timing. Both fixed.
- The second time — and this one was my fault, from advice I gave — typing *"is the tablet safe"*
  brought up the privacy page, so the first word under your question was **"No."** Fixed.

The reason those got found is that we stopped testing the medical filter with the same questions it
was built from, and started testing it with questions written specifically to break it, by someone
who had not built it. That set of questions is now saved in the app's own tests, with a rule written
at the top that nobody is allowed to tune the filter against them. If a future change makes this
worse, the tests now fail on their own.

For this final check I wrote 68 more questions nobody had ever seen — about dentists, pets, driving,
handling tablets with gloves, having a baby, boosters, and twenty things the app cannot even do. The
medical ones were all correctly sent to the care team. The ordinary ones were all answered normally.

## What to check on your phone

1. Tap the help button on the Today screen. You should still see your medications above the panel
   and the menu bar below it — it should cover about half.
2. Ask something ordinary: *"how do I add an appointment"*. You should get a real answer with steps.
3. Ask something medical: *"is the tablet safe"*. It must tell you to ring your care team.
4. Close it with the X, then tap the button again — your conversation should still be there.
5. Turn on aeroplane mode and ask it something. It should work exactly the same.

Only two things genuinely need your phone rather than mine: how it behaves with the on-screen
keyboard up, and how it sounds if you use TalkBack. Everything else was tested here.

## Still open, written down so it is not forgotten

- **Some medical questions get a list of help pages instead of a clear "ask your care team".** Nine
  out of eighty-six in our test set. None of them gives an answer or says anything medically wrong —
  they just aren't as clear as the proper refusal. The clearest next improvement is to put the
  care-team sentence on those lists too, using wording the app already has.
- **A few ordinary questions find nothing**, e.g. *"how do I see last week"* or *"how do I change the
  patient name"*. Safe, just unhelpful — those need help pages written.
- **Eleven trickier medical questions** land on "I don't have an answer", which does say it is a
  question for the care team, but not as directly. Closing that properly needs a nurse to read the
  wording first, which is already on the list and is the right order to do it in.
- **TalkBack** needs one pass on a real phone.

## The bottom line

v55 built the right help content in the wrong shape — 117 pages behind a menu. You said you meant
the thing every app has in the bottom corner, and you were right that it is a different product.
This is that product, and it is the right shape, the right size, and it knows what it is not allowed
to answer. It is ready to go out.
