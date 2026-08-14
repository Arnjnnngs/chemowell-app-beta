# PM GATE — app-v57

**VERDICT: GO**, conditional on four bookkeeping items below (C1–C4). None of them touches
`index.html`, `sw.js`, or any shipped app code, so none re-opens the gates.

**Stage:** Project Manager (TEAM.md stage 6 — mandatory independent gate; the PM leads this
process, the Lead Developer does not). **Date:** 2026-08-14.
**Under test:** `app-v57`, commit `265aabe`, working tree clean, `index.html` md5
`baf8d4ad8633e81f593ec4a26b26a7b9`. `sw.js` CACHE `chemowell-app-v57-1`, `APP_VERSION` `app-v57`.
**Server discipline:** everything below was measured against `http://127.0.0.1:8903`, started by me
from this repo, with `curl -s .../index.html | md5sum` verified equal to `md5sum index.html` before
the first measurement and again after the last. The four shipped suites hardcode `:8899`, which is
the Lead Developer's port; rather than repoint or share it I ran byte-identical copies out of
`/tmp/pmtest` with the URL rewritten to my own port. Mutation runs were served from `/tmp/pmmut` on
a private port `8904`. All servers I started are killed.

**Nothing has been pushed.** `git push` is blocked in this sandbox (403 through the proxy); pushes
are manual GitHub web uploads done by the Lead Developer. **So there is no live smoke test in this
report, and I am not treating localhost as a substitute for one.** §8 lists exactly what must be
verified on the deployed site and on real devices after the push, and who cannot sign this release
off until that happens.

---

## 0. Summary of my own work

| | |
|---|---|
| Independent browser cases driven by me | 42 (14 untuned queries × 2 widths, plus first-run, routing, deep-link, back-row and toast-lifecycle runs) |
| Independent headless probes | **2,312** exhaustive floor/cap reachability probes + 20 untuned clinical queries + 7 coverage-depth measurements |
| Suites re-run by me on my own verified server | 4 of 4, **all green** (v57-search, v57-browser-notice, v55-help, v52-fixes) |
| Mutations I applied to prove a suite can fail | 10 (9 simulated + 1 full-suite run) |
| Findings | **5 Low, 1 nit, 1 backlog observation. Zero High, zero Medium.** |
| Console errors observed anywhere in my runs | **0** |

---

## 1. Does this release match what Aaron actually asked for?

Aaron, 2026-08-13, verbatim:

> "what's next and what's left on my tasks. I don't really care for the 'bot'. it's not doing what I
> want. but I do think all of those things can be in a FAQ under the 3 hamburger menu. can this be
> shared via HTML so others can see it even though its not on the stores yet? I know that
> notification won't work. tell me else won't work for them?"

Then, explicitly: **remove the bubble entirely**, **rename the menu row to "Help & FAQ"**, **add an
in-app first-run notice** for browser testers.

| What he asked for | Verdict | How I checked it |
|---|---|---|
| Remove the bubble entirely | **PASS** | Driven live at 360 and 320 from a wiped install: `document.getElementById('helpbot-fab')` is null on Home and on Help; no help-bubble symbol survives in shipped code (suite assertion, re-run by me); zero orphan CSS or listeners per the Auditor's 15-case sweep |
| Menu row reads "Help & FAQ" | **PASS** | Opened the real hamburger at both widths, read the drawer, tapped the row, landed on the Help centre |
| In-app first-run notice for browser testers | **PASS** | Appeared on Home on a wiped install at 360 and 320 after *Skip guide*; I read every word of the rendered card (§6) |
| Manifest wording (pre-store blocker, already on the task sheet) | **PASS** | `manifest.webmanifest` and `package.json` now read *"Track medications, doses and symptoms through cancer treatment — all data stays on your device"*. The old *"for chemo patients"* is gone from both and from README's opening line |
| *"can this be shared via HTML …?"* | **PASS — answered, nothing to build** | It already is a plain HTTPS URL. No code was written for this and none was needed |
| *"tell me else won't work for them?"* | **PASS** | Answered in-app by the notice's three points and, in full, by the `rem-web-vs-app` walkthrough the card deep-links to. Also tracked as an open line in `REQUESTS.md` |
| *"what's next and what's left on my tasks"* | **THIS IS MINE, and it is in §9** | TEAM.md's Scribe rule (restated 2026-08-09) makes the done/outstanding list part of every reply. It is not in DEV_v57.md. I have written it |

**Is anything missing?** No.

**Did anything get built that he did not ask for?** Yes, and it is worth naming honestly, because it
is more than half the diff:

- the unconditional care-team strip on the search-results screen;
- a **relevance floor** (0.22) and a **cap of 12** on every Help search;
- a new help page, `sym-medical-question`;
- a `careTone` flag;
- `navigateTo()` clearing in-flight toasts;
- the "Search help" H1 removed from the results screen;
- the notice card rebuilt, the toast lifted to 150px on Reports detail, and eight Designer fixes.

Every one of these is traceable to a written gate finding except two, which are the Lead Developer's
own judgement and are dealt with in §2. **The scope growth is the gates working, not drift** — the
High (V57-1) was safety-relevant and was found *because* this release touched the search path. I am
satisfied the release is still recognisably Aaron's three choices.

**One user-visible consequence Aaron did not ask for and will notice:** Help search now shows at
most 12 rows and says *"The closest 12 of 19 matches"* where it used to list everything. That is in
his summary (§9) in plain words, because he should not discover it himself.

---

## 2. The Lead Developer's three flagged judgement calls

### (a) Removing the "Search help" H1 from the search-results screen — **HE IS RIGHT. Keep it.**

The argument is *"it duplicated the field label below it."* I checked whether that is real or a
rationalisation for a change made under pressure to hit a 45px number, because the change was
requested by nobody and reviewed by no Designer.

**It is real.** `index.html:6348` — the search card's own `<label for="help-search">` reads the
string **`Search help`**. The deleted `pageHead('Help & FAQ', 'Search help', null)` rendered the
identical string as a 28px H1 **immediately above it**, with only the eyebrow between them. That is
verbatim duplication of the same two words in the same 100px of screen, on the one screen where the
person has already typed and is waiting for rows. It is the same defect the Designer had just
flagged *inside* the strip (R2D-1: the heading restated the body's first clause verbatim), so this
is the Lead Developer applying the reviewer's own finding one element over — not inventing a reason.

I looked at the rendered result rather than reasoning about it. Screenshots at 320 and 360 (`/tmp`
captures reproduced from a wiped install): the screen reads **HELP & FAQ** (eyebrow) → the person's
own words in the box → the strip → the rows. Orientation is intact; nothing else on the screen
refers to the removed word; the Help landing keeps its heading, so the page a person browsing
reaches is unchanged.

It is also the *smallest* of the three fixes that bought R2D-1's clearance (45px of ~84px+), so it
is not the load-bearing one, which weakens the "made to hit a number" reading further.

**One genuine cost nobody reviewed, and I am recording it as a finding (PM-4):** `pageHead()` is the
only `<h1>` emitter in the Help view, so the results screen now has **no heading element at all**.
A screen-reader user navigating by heading finds nothing there. The visual call is right; the fix is
to keep the removal and promote the eyebrow (or the strip's heading) to a real heading element with
no visual change — one line, next release.

### (b) `navigateTo()` clears any in-flight toast — **HE IS RIGHT, and it belonged in this release.**

This is the widest-blast-radius change here, so I did not accept the Auditor's clean regression
sweep as sufficient. What I verified myself:

1. **Call-site census.** There are exactly **12** `navigateTo(` call sites in `index.html`. I listed
   every one: the bottom nav, `drawerGo()`, two tour-step transitions, the notice's read-more, "add
   your first medication", "replay the walkthrough", and the internal one at `:2540`. Every one is a
   deliberate whole-screen change by the user.
2. **No call site pairs a toast with a navigation.** I ran a proximity scan over the whole file for
   `setToast` within ±6 lines of `navigateTo(` — **zero hits**. There is no flow whose only
   confirmation is a toast raised at the same moment as a programmatic navigation.
3. **The stale timer is harmless, which is the non-obvious part.** `navigateTo` nulls `state.toast`
   but does *not* clear `toastTimer`. I checked whether that orphan timer could later cut a *new*
   toast short: it cannot, because `setToast()` calls `clearTimeout(toastTimer)` before arming its
   own. The worst case is one no-op re-render.
4. **Live, on my own server, with the correct selector (`[role="status"]`):** a toast raised on Home
   is **gone after a real bottom-nav tap** to Meds; a toast left alone is **still up at t+2.4s and
   gone by t+5.0s**, i.e. the ordinary ~4.5s life is intact. Toasts are not broken generally.
5. **The rejected local fix really is wrong.** The care-team button sits in normal page flow, so
   adding the search screen to `toastNeedsLift()` would clear it only at the scroll position it was
   measured at. `toastNeedsLift()` is now fixed-position furniture only and says so in the code.

**Should it have been its own release?** No, and I think the opposite framing is the dangerous one:
holding it would have shipped R2-E's 320px collision — a toast covering the care-team safety button
for its full 4.5s — to real testers in the meantime. The change is *subtractive*; the class of thing
it removes (a message about screen A painted over screen B) has no legitimate instance anywhere in
this codebase, and I checked rather than assumed.

### (c) R2D-7 and R2D-8 deferred — **FAIR on the merits, CONVENIENT on the bookkeeping.**

**R2D-7 (the deep-linked page's back row) is real and I reproduced it.** From a wiped install I
tapped "More about the web version" on the notice and landed on `rem-web-vs-app` with a back row
reading **"Reminders & notifications"** — a category the tester has never visited. Tapping it drops
them into that category list, not back to Home. That is genuinely disorienting for the exact
audience the notice exists for. **But the deferral is right:** the fix means adding entry-point
state to a component that has none, which is an architecture change inside a fix pass; the bottom
nav is always present so nobody is stranded; and I confirmed the notice is **still on Home**
afterwards, so nothing is lost. Backlog, not blocker.

**R2D-8 (the strip's button label wraps to two lines)** — I looked at it at 320 and 360. It reads
fine as two lines in a filled button, and the wording is the Auditor's R2-G fix that both reviewers
approved. Churning approved high-stakes copy to save a line-wrap is the wrong trade. Deferral right.

**The convenient part:** both deferrals exist *only* inside the three gate reports. `BACKLOG.md` has
no entry for either, and TEAM.md's Scribe section is explicit that this is what BACKLOG is for
("log anything genuinely new found"). The Auditor also wrote that his Lows "belong in the next
release's first commit, or in `BACKLOG.md` with the reason" — neither happened. That is **C1** below
and it is a condition of my GO, because this project's own history is that undocumented deferrals
are the ones that are still open six releases later.

---

## 3. Is the Auditor's evidence real, and the right depth?

**Real. And on the one claim that carries the most weight, I re-derived it independently and got a
stronger result than he reported.**

### 3.1 The load-bearing claim: 1,164 exhaustive probes prove the relevance floor makes zero pages unreachable

I did not take this on trust and I did not simply read his log. I built **my own harness**
(`/tmp/pmtest/pm-floor.mjs`) that slices the shipped `HELP_TOPICS`, `FAQ_ITEMS` and the whole matcher
straight out of `index.html` and instantiates it **twice**: once with the shipped constants
(`HELP_SEARCH_FLOOR = 0.22`, `HELP_SEARCH_MAX = 12`) and once with `FLOOR = 0`, `MAX = 9999`. Then,
for every topic keyword and every title bigram *and* trigram, it asks: was this page in the top 12
before, and is it gone now?

```
shipped constants: const HELP_SEARCH_FLOOR = 0.22;  const HELP_SEARCH_MAX = 12;
probes built: 2312
probes where the wanted page WAS in the top 12 before: 2022
LOST TO FLOOR: 0
LOST TO CAP:   0
```

**2,312 probes — twice his 1,164 — and the answer is the same: nothing became unreachable.**
His `logs/r2-floor-vs-cap.log` states exactly this, and his 56 hand-written natural queries are in
`logs/r2-floor-probe.log` with per-query results I read line by line; the two "changed" queries are
`pro-add` at rank **29 of 57** and `app-old-version` at rank **21 of 69** before the change, i.e.
pages no human being was ever going to scroll to. **The claim is confirmed. It is the strongest
piece of evidence in this release.**

### 3.2 Everything else I spot-checked

| Claim | Verdict |
|---|---|
| `outputs/v57-audit/` exists with 12 curated screenshots + 4 real CSV exports + 88 log files | **exists** |
| Round 1 = 586 cases, round 2 = 1,684 | **consistent** with the log inventory; I did not recount every line, but every category he names has a file behind it with content matching the description |
| 4 real CSV exports across 4 profiles | **real** — `export-Chemo.csv` carries Med/Temperature/Weight/Blood Pressure rows across **three distinct dates** (2026-08-11/12/13), not a header stub |
| 17 round-1 + 28 round-2 mutation cases | **real** — 40 `mut-*.log` / `r2mut-*.log` files, each a full suite run |
| The R2-E fix is proved live, not at source | **real and honest** — `test/v57-browser-notice.mjs:440–484` drives the exact repro at 320px and **asserts the precondition** (`toast present=true`) before checking it is gone, so it cannot silently become a no-op. This is the shape v56 got wrong |
| Depth appropriate for what shipped? | **Yes.** This changed how Help search ranks and caps results for every user and touched a safety-relevant screen, so it correctly got the full sweep — 4 profiles from wiped installs, all four treatment types, tours both completed and skipped, 8 medications, 3-day logging spans, real CSVs |

### 3.3 Did the suites earn their green? I broke things and checked.

I did not accept "ALL GREEN". I ran **10 mutations** of my own. Nine were simulated against the exact
assertion logic; one was a **full 5-minute suite run against a mutated `index.html` served from
`/tmp/pmmut`**. The result is finding **PM-1** in §4 — one assertion that still cannot fail. The
other nine mutations were caught.

---

## 4. The v56 lesson, applied to v57

The v56 PM returned NO-GO because a green suite was measuring the fit of the patterns it had been
tuned on, not the property. I asked the same question here, and the honest answer is that **v57
passes the test v56 failed — because the safety property stopped being a classifier and became a
structural guarantee.** But I found five things.

### 4.1 What a frightened caregiver at 2am actually sees — tested with questions nobody tuned on

I chose 14 queries and confirmed by grep, before running them, that **none appears** in the
53-question fixture, the 50-question CLINICAL list, or the Auditor's 56 natural queries. I typed
them into the real running app at **360px and 320px**, from a wiped install, routed the way Aaron
described it (hamburger → Help & FAQ).

**The safety property held on 14 of 14, at both widths, including the zero-result case:**

| | 360px | 320px |
|---|---|---|
| strip heading top / bottom | y=341 / 377 | y=341 / 377 |
| "When to call the care team straight away" button | y=448–492 | y=467–511 |
| bottom-nav top (the real usable edge) | 731 | 731 |
| first result row top | 562 | 582 |
| **strip visible without scrolling** | **14/14** | **14/14** |
| **button entirely above the nav** | **14/14** | **14/14** |
| console errors | 0 | 0 |

The screen a person typing *"my mum is dying"* gets at 320px is: their own words → **"ChemoWell
can't tell you if something is serious"** → *"It holds no medical information. For anything about
symptoms, doses, or how someone is feeling, contact the care team."* → a large filled dark button
→ and only then the one (irrelevant) result. **That is the right screen.** I looked at it as a
picture, not as a measurement, and I would be content with a frightened person seeing it.

`"seizure"` and `"overdose"` return **nothing at all** — and the strip still renders above the empty
state, which is the whole argument for making it unconditional rather than conditional on a score.
That design decision is vindicated by inputs it was never tuned on. **This is the difference from
v56 and it is why my answer differs from my predecessor's:** v56's safety rested on a classifier
that could be beaten by held-out data; v57's rests on a render path that always runs.

**What I would not call good, and am recording as PM-7 (observation, next release, not a blocker):**
the words a frightened person is most likely to type are exactly the corpus's weakest.
`"seizure"` → 0 results. `"overdose"` → 0 results. `"i am scared"` → 3 pages about privacy, check-in
times and card placement. `"my mum is dying"` → 1 page about reminder timing. `"he is bleeding a
lot"` → 1 page about weight change. And the two most operationally dangerous ones —
`"i gave him two by mistake"` and `"i think i gave the wrong pill"` — both rank the **logging**-mistake
pages first ("I logged something by mistake", "I think I logged the same dose twice"), so a real
double-dose is answered with how to delete a log entry. In every case the strip is above the list and
does its job, which is why none of this blocks. The cheap fix is the one this team already used for
hair loss — **content, not tuning**: keywords on `sym-severe` for *seizure, overdose, unconscious,
choking, scared, 999, 911, emergency number, gave two doses, double dose, wrong medicine*.

### 4.2 Does the 20/50 care-team floor mean anything, given the threshold was chosen after measuring?

**Partly — and less than it did two hours before it shipped. This is finding PM-2.**

The threshold itself (floor 18, measured 20) is post-hoc, and the Lead Developer flagged that
himself. On its own that is weak. It is redeemed by two things he added afterwards: `sym-severe` is
pinned by id in `test/v57-search.mjs`, and **all five** care-team pages are pinned by id in
`test/v55-help.mjs:83–85` (I verified the code, and the Auditor mutation-proved both directions).
So the metric is no longer the only thing standing between a dropped `careLead` flag and a green
suite. That is a real structural improvement.

**But the metric now measures a depth the user cannot see — which is V57-2 verbatim, reintroduced by
the V57-1 fix.** `VISIBLE_ROWS = 4`, and the comment above it says *"the 4 rows a phone actually
shows"*. With the strip in place, my own geometry (above) gives **2 full rows at 360px and 1 at
320px**. Measured coverage by depth on the same 50 questions:

```
care-team page within top  1:  8/50
care-team page within top  2: 15/50      <- what a 360px phone now shows
care-team page within top  3: 17/50
care-team page within top  4: 20/50      <- what the suite floors
care-team page within top  8: 23/50
care-team page within top 12: 26/50
```

The Auditor *noticed* the layout change (R2.1: "the strip pushes the visible result count at 360px
from 4 rows to 2") but concluded the floor is "conservative in the safe direction". **It is the
opposite:** measuring deeper than the user can see *overstates* coverage, by 5 points. He was right
that it does not matter much — the strip, not the metric, is now the safety property — but the
comment in the test file is now false, and a false comment in a guard is how this project's last
three "assertions that stopped guarding" started. Next release: move `VISIBLE_ROWS` to 2 and
re-floor at 13, or say plainly in the comment that this is a corpus-quality measure and not an
on-screen one.

---

## 5. Findings

None is High or Medium. None changes what the app does for a user today. I am listing them with the
consequence spelled out so none of them gets read as tidiness.

### PM-1 — LOW — `test/v55-help.mjs:99` "every careLead topic is also flagged medical" cannot fail. Proven by a full-suite mutation run.

```js
const careLeadNotMedical = (topicsBlock.match(/\{ id: "[^"]+",[\s\S]*?careLead: true \}/g) || [])
  .filter(chunk => chunk.indexOf('medical: true') < 0)
```

This is the **identical lazy-multiline-regex class as R2-C**, sitting three lines below the
per-line fix the Auditor asked for. `[\s\S]*?` expands lazily from the *first* topic in the block, so
each captured chunk spans many intervening topics and borrows somebody else's `medical: true`.

**Proof, not inference.** I wrote a mutated `index.html` giving `log-double-tap` (which has no
`medical: true`) a `careLead: true` flag, served it on a private port, and ran the whole suite:

```
PASS  every careLead topic is also flagged medical
...
ALL GREEN
```

I found 6 of 9 candidate positions where the mutation goes undetected. Separately, **this release's
own new careLead page, `sym-medical-question`, is not matched by the regex at all**, because its
object ends `careTone: "calm" }` rather than `careLead: true }` — so the newest and most
safety-adjacent page in the corpus is entirely exempt from the check.

**Why this is worth writing down rather than filing quietly:** if the invariant ever *is* violated,
the failure is not cosmetic. `careCallout` renders on `topic.medical`, and the answer body renders on
`(!topic.careLead && topic.a)` — so a `careLead` page without `medical` renders **neither**, and the
page ships with its entire answer text missing. The code is correct today (all five carry both);
only the guard is hollow. **Fix:** match per line, exactly as the `careTone` check two lines above
now does.

### PM-2 — LOW — The care-team coverage floor measures 4 rows while the phone shows 2, and its comment asserts otherwise. See §4.2.

### PM-3 — LOW — A claim this release proved false is still shipping as the rationale in a test file.

`test/v57-search.mjs:19`:

> "The search box does not answer. It ranks a fixed list of help-page titles and the person taps
> one. **That is exactly what v55 shipped and what every v55 gate passed.**"

That last sentence is the exact claim the Auditor disproved by slicing v55's real `helpSearch()` out
of `864aeaf` — v55 returned **nothing for 49 of 50** clinical questions; the shipped matcher returns
a ranked list for **45 of 50**. `DEV_v57.md` §2.2 corrects it and deliberately leaves the correction
visible; the commit message and the README both carry it. **The test file a future developer opens
first does not.** It is the header comment, presented as the file's reason for existing. Fix: one
comment. (**C3**, below — I want this done before the push, because it is the sentence that
justifies not having a guard.)

### PM-4 — LOW — The search-results screen now has no heading element at all. See §2(a).

### PM-5 — LOW — Scribe: the release's deferred items are recorded nowhere durable, and two `REQUESTS.md` lines are stale.

`BACKLOG.md` has **no entry** for R2D-7, R2D-8, the Auditor's "there is no *show more*, so a page
ranked 13+ is now unreachable through search" observation, or the coverage-comment item — despite
both gate reports explicitly saying that is where they belong. Separately, `REQUESTS.md:32` and
`:144` still describe v57 as *"built and through one full gate round"* which *"re-enters the gates
from scratch"*; both gates have now run twice and the PM gate has signed off. (**C1**, **C2**.)

Credit where due: the rest of the Scribe work **is** done and was done well — `REQUESTS.md` has a
real v57 entry quoting Aaron verbatim, `BACKLOG.md` has 9 entries annotated **CLOSED app-v57** with
reasons rather than deletions, the README v57 row is present and accurate, and all three `.sh` files
are back to `100755`. This is the first release in three where V55-5/V56-9 did not recur.

### PM-6 — NIT — "the eyebrow on all four Help screens now reads HELP & FAQ" (DEV §2.4, README) is loose.

There are four render sites, but one of them is a not-found fallback, and the **topic-detail screen's
eyebrow is the topic's category**, not "Help & FAQ" — deliberately, per the v55 breadcrumb design.
Wording in a report, not behaviour in the app.

### PM-7 — OBSERVATION — corpus gaps on the highest-urgency single words. See §4.1. Next release, as content.

---

## 6. The new user-facing copy, read as Aaron would read it

I read all three pieces rendered in the running app, not in source.

**The browser notice card.** Reads as a person talking. *"You're using the web preview / Everything
works. Three things are different in a browser:"* then three headed points, then *"Everything you log
stays on this device."* No jargon survives — "service worker", "PWA", "standalone", "IndexedDB" appear
nowhere. The Android branch renders correctly here (Chromium on Linux reports a desktop UA) and reads
*"Open your browser menu, then Add to Home screen. It keeps your log one tap away and out of reach of
anything that clears browser data."* — accurate without being frightening. The iOS branch names
Safari's 7-day deletion explicitly, which is right: that is the one that can cost a tester
everything. **No medical claim anywhere. Verdict: helpful.**

**The care-team strip on the search screen.** *"ChemoWell can't tell you if something is serious"* /
*"It holds no medical information. For anything about symptoms, doses, or how someone is feeling,
contact the care team."* / **"When to call the care team straight away"**. Two short sentences, no
hedging, no "please consult a healthcare professional" boilerplate, and the button names an action
rather than a topic. The Auditor's R2-F/R2-G rewrites both improved it — "them" genuinely had no
antecedent when the button was read alone. **No medical claim. It reads as an honest limit, not as a
brush-off, because it is immediately followed by a route to a person.**

**`sym-medical-question`.** *"**This is a question for the care team, and ChemoWell will not try to
answer it.** The app keeps a record of what happened and when. It holds no information about any
drug, has no idea what is normal for this person's treatment, and would be guessing if it said
otherwise."* Then four steps that each give the caregiver something to **do** — write it down, ask
the care team or the dispensing pharmacist, *"anything sudden, severe, or frightening is a phone call
now, not a question for later"*, log the symptom with a note. I scanned it for numbers, thresholds,
units, "safe", "normal" used as a judgement, "you should", "wait N hours": **none present.** It
closes with *"ChemoWell is a record-keeping tool, not a source of medical information. Never delay
care because of anything shown in this app."*

**A refusal is only not a brush-off if it hands you the next step, and this one does.** I agree with
the Auditor's assessment that it is the best thing in the release. I also agree with the standing
`REQUESTS.md` item that `sym-severe` and `sym-medical-question` want **one oncology-nurse read**
before the App Store — that is a TEAM.md copy-review escalation, not something to resolve in-chain,
and it is correctly already on the list.

---

## 7. Release mechanics

| Check | Result |
|---|---|
| `APP_VERSION` | `app-v57` ✅ |
| `sw.js` CACHE | `chemowell-app-v57-1` — in step ✅ |
| `./release_check.sh` | **exit 0**, run by me ✅ |
| `PUBLISHED.json` | sane — baseline `app-v56` / `chemowell-app-v56-6` at `ca64c92`, and the gate correctly warns that 4 commits have changed `index.html` since ✅ |
| README version-history row for `app-v57` | present, names the shipping cache key, and **the substance is true** — I verified the manifest wording, the deleted v56 test files, the 66→19 floor effect, the cap of 12, the "closest 12 of N" line, the eyebrow colour `#7A2E08`, and the 548px card. One loose phrase (PM-6) ✅ |
| `git ls-files -s` on the three `.sh` files | all `100755` ✅ |
| Working tree | clean; 4 commits ahead of `origin/main`, nothing pushed ✅ |
| `REQUESTS.md` / `BACKLOG.md` per the Scribe section | substantially done; two gaps → **C1**, **C2** |
| Suites, re-run by me on my own md5-verified server | v57-search **ALL GREEN**, v57-browser-notice **ALL GREEN**, v55-help **ALL GREEN**, v52-fixes **ALL GREEN** ✅ |
| **Live smoke test on the deployed site** | **NOT DONE AND NOT POSSIBLE FROM HERE** — see §8 |

---

## 8. What must be verified live after the push — stated explicitly, not skipped

`git push` returns 403 through this sandbox's proxy; pushes are manual GitHub web uploads. I could
not test the deployed site, and localhost is not a substitute. **This release is not finished when
it is uploaded.** The following must be done by whoever pushes, before Aaron is told it is live:

1. **Cache-busted load of the deployed URL** (`?v=57`). Confirm the app reports `app-v57`, and that
   Cache Storage holds `chemowell-app-v57-1` and no older key. This is the app-v40 failure mode and
   it is why the gate exists.
2. **The iOS branch of the notice, on a real iPhone in Safari.** Chromium-on-Linux reports a desktop
   UA, so **only the Android branch has ever rendered in any test in this release.** The iOS wording
   ("Tap Share, then Add to Home Screen", the 7-day Safari sentence) is verified by mutation that the
   branch is *wired*, not by anyone seeing it.
3. **The installed-PWA branch.** `display-mode: standalone` is not settable in this Playwright build;
   the Auditor forced the flag on a scratch copy to read the copy. Add to Home Screen on iOS, reopen
   from the icon, confirm the card reads *"A couple of things about the browser version"* / *"Two
   things still behave differently here"* and not the web-preview title.
4. **The Home Screen label and the new manifest description** under the installed icon — this is the
   text the manifest fix exists for.
5. **The native Android build must NOT show the notice.** `isNativeApp()` is always false in this
   sandbox; the gate is verified at source and by mutation only, never observed.
6. **On a real phone: menu → Help & FAQ → type "she collapsed".** Confirm the strip and its button
   are on screen without scrolling and one tap reaches the emergency page. Everything in §4.1 was
   measured in a desktop browser at phone viewport sizes, which is not the same as a phone.
7. **Still outstanding from earlier releases and unchanged by this one:** real OS notification
   delivery, the native share sheet, and the hardware Back button.
8. **Immediately after a successful upload:** `./mark_published.sh`, commit `PUBLISHED.json`, then
   `git fetch origin && git status -sb` and `git diff origin/main --stat` (must be empty). Per
   TEAM.md this is part of the push, not a follow-up — skipping it disarms the gate one release later.

---

## 9. Conditions of this GO

All four are documentation or comment changes. None touches `index.html`, `sw.js`, `.github/`,
`sync-backend/` or any config file, so per TEAM.md none of them re-triggers the gates.

- **C1** — `BACKLOG.md` entries, with reasons, for: **R2D-7** (back-row entry-point state), **R2D-8**
  (button wrap, recorded as a known state), **PM-1**, **PM-2**, **PM-4**, **PM-7**, and the Auditor's
  "no *show more*, so a page ranked 13+ is unreachable through search" observation.
- **C2** — `REQUESTS.md:32` and `:144` corrected: both gates have run **twice**, and the PM gate has
  signed off. The v57 line is ticked only after the live check, which the entry already says.
- **C3** — `test/v57-search.mjs:19`: delete or correct the sentence *"That is exactly what v55
  shipped and what every v55 gate passed."* It is proven false and it is presented as the reason the
  file does not guard something.
- **C4** — after the push: `./mark_published.sh`, commit `PUBLISHED.json`, `git fetch origin`,
  confirm, then run the §8 live checks.

**PM-1, PM-2 and PM-4 go in the next release's first commit** — deliberately not now, so that
nothing about the shipping build changes after this sign-off.

---

## 10. Verdict

**GO.**

I did not reach this by agreeing with the other two gates. I reached it by re-deriving the one piece
of evidence everything else rests on and getting a stronger result (2,312 probes, zero pages lost),
by typing fourteen questions nobody had tuned on into the running app at two widths and looking at
what came back, and by breaking the code to see whether the suites noticed — which turned up one
assertion that still cannot fail.

The reason my answer differs from my predecessor's two NO-GOs on v56 is specific, and I want it on
the record so this is not read as a softer gate: **v56's safety rested on a classifier, which can
always be beaten by an input nobody thought of, and was. v57's rests on a render path that always
runs.** I proved it with inputs chosen to beat it, including two — *"seizure"* and *"overdose"* —
that return no results at all, where the honest sentence and the route to a person are still the
first things on the screen. That is a property, not a fit.

Everything Aaron asked for is here and works. The copy is good and makes no medical claim. The
mechanics pass. My five Lows are one hollow assertion, one stale metric comment, one false comment,
one missing heading element and some bookkeeping — collectively worth one commit, not a round.

**This release is ready for Aaron, subject to C1–C4 and to the live verification in §8 actually
being done. It is not "done" until §8 is done.**

---

## 11. Plain-language summary for Aaron

**Short version: the bot is gone, the FAQ now lives where you asked for it, and the app now tells
your testers what a web browser can't do. It's ready to upload. Nothing has been uploaded yet.**

**What changed**

- **The chat bubble is completely gone.** Not hidden — deleted. About 46,000 characters of it. There's
  a test that will fail if anyone ever sneaks a piece of it back in.
- **The menu row is now "Help & FAQ"**, so people looking for the FAQ can find it. Nothing was lost
  when the bubble went: the search box on the Help screen still searches all 118 walkthroughs and 15
  common questions.
- **New card for browser testers.** The first time someone opens your link on their phone, a card on
  the home screen tells them three things, in the order of what it costs them if they don't read it:
  add it to their Home Screen, reminders only arrive while the page is open, and exports save to
  Downloads instead of opening the share menu. It knows whether they're on an iPhone or Android and
  says the right thing for each. It never appears in the real installed app. They can dismiss it and
  it stays dismissed.
- **The name under your app icon was wrong and is fixed.** It said "for chemo patients", which stopped
  being true when you added radiation and the other treatment types. It now says "Track medications,
  doses and symptoms through cancer treatment — all data stays on your device."

**One thing the team found that you didn't ask about, and I think you should know about**

When someone types a frightening question into the Help search box — something like "she collapsed" —
the app used to hand back a list of unrelated help pages, with nothing on the screen saying the app
knows nothing about medicine. That was quietly introduced two versions ago and nobody had looked at
it. It's fixed: **every** Help search now shows one honest sentence above the results — *"ChemoWell
can't tell you if something is serious. It holds no medical information..."* — and a button that goes
straight to the "when to call the care team" page. It's there every time, not only when the app
thinks the question sounds worrying, because guessing which questions are the worrying ones is
exactly what went wrong with the bot.

I tested this myself with fourteen frightening questions nobody on the team had used, on two phone
sizes, including "seizure" and "overdose" — which the app has no pages for at all. In every single
case the honest sentence and the button were on screen without scrolling.

**Two small things you'll notice**

- Help searches now show at most 12 results and say something like *"The closest 12 of 19 matches"*
  instead of listing everything. That's deliberate — 66 results on a phone is 3,000 pixels of
  scrolling.
- There's one new help page, about side effects, that says plainly the app can't tell you what's
  normal and that this is a question for the care team or the pharmacist. It makes no medical claim
  of any kind.

**What I found that still needs doing** — all small, none of it stops this going out. Four are notes
in a test file and a couple of lines of housekeeping. One is worth mentioning: the words a
frightened person is most likely to type — "seizure", "overdose", "I'm scared" — currently find
nothing useful in the help pages. The safety message still appears above them, so nobody is left
without a route, but I've asked for those words to be added to the emergency page in the next
release.

**What you still need to do**

1. **Nothing has been uploaded yet.** The upload is a manual step and it hasn't happened.
2. **After it's uploaded**, someone needs to open the live link on a real iPhone and a real Android
   and check the new card looks right on each. This sandbox can only pretend to be Android, so the
   iPhone wording has genuinely never been seen by anyone.
3. **Add the app to your own Home Screen from Safari** and check the name under the icon reads
   correctly.
4. **Three things from earlier versions are still waiting on your phone**, and have been since v50:
   whether reminders actually arrive, whether the CSV/PDF export opens the share sheet, and the
   back button. Those can only be checked on a real phone.
5. **Before the App Store:** one oncology nurse should read the two help pages that route someone to
   their care team. That's not something the team should sign off on its own.

**Your task list**

*Done and ready to upload (app-v57):* bubble removed · menu row renamed to Help & FAQ · browser
first-run notice for testers · manifest/store wording fixed · the search-box safety fix above.

*Still outstanding, in the order I'd do them:*

1. Limit Units + the CSV unit bug — the oldest open functional defect left.
2. Device-to-device encrypted file sharing (this replaced the cancelled sync work).
3. Fix the Pro copy that promises "real-time shared access automatically" — it was written when sync
   was still the plan, and it's a promise the product won't keep. Do this **before** Pro is sold.
4. "Save to this phone" on export.
5. The MedlinePlus per-medication "what is this for?" link.
6. The in-app bug logger for testers.
7. Drawer keyboard focus (broken since v22; only affects keyboard users).
8. Before the App Store: a privacy-policy URL, and the oncology-nurse read above.

*Waiting on you, not blocking anything:* the three on-device checks in point 4, plus two open
decisions — whether to drop the Male/Female question from onboarding, and the redeem-code section
under Account.
