# AUDIT v56 — Zero Day Auditor

**VERDICT: NOT READY — 2 High, 4 Medium, 5 Low. Two clinical questions get a normal app answer instead of the care-team route (V56-1), and four of the brief's own integration points were specified and never wired (V56-2 … V56-5), all of which are the Lead Developer's documented "fixed one of N call sites" failure mode.**

**Stage:** Zero Day Auditor (Quality Chain stage 5). **Date:** 2026-08-11.
**Under test:** `app-v56`, commit `9dddf15`, `index.html` md5 `c9400ba3470a8e9b7c710b0eeb6eb3e0`, byte-identical to what `http://127.0.0.1:8899/index.html` served for every case below (verified: working tree clean, served bytes hashed).
**Spec:** `outputs/DEV_BRIEF_v56_helpbot.md` (§4 medical safety, §9 definition of done, §11 acceptance criteria).
**Evidence:** `outputs/v56-audit/` — 10 test suites (`a-…` … `j-…`), full run logs in `outputs/v56-audit/logs/`, curated screenshots.

**Cases:** 452 independent audit cases across 10 suites (437 pass / 15 fail), plus the four pre-existing suites re-run in full (`v56-matcher` 22, `v56-helpbot` 99, `v55-help` 145, `v52-fixes` 21 — all green), plus 45 headless clinical probes and an index/perf inspection. 4 profiles created from wiped installs (chemo, radiation, both, Other), each taken through the complete guided tour with a real medication entered and a real dose logged. Zero console errors in every suite. Zero horizontal overflow at 320 / 360 / 390 / 900px.

---

## 1. Findings, most severe first

### V56-1 — HIGH — A clinical question gets a confident app answer instead of the care-team route

`index.html:6106` (`HELP_GUARD_ADVICE`), `index.html:6136` (`helpBotGuard`)

The §4.2 guard is frame-based. Two shapes of clinical question slip past every pattern and land on `mode: 'answer'` — a confident, single-topic reply with a **"Open the full walkthrough"** button and **no medical callout at all** (neither target topic carries `medical: true`):

| typed into the bubble | what the app answers with |
|---|---|
| `is this medicine safe for children` | **"Is my information stored on a server somewhere?"** — the privacy page (`priv-server`) |
| `what are the side effects of cisplatin` | **"How do I record a symptom?"** — the symptom-logging walkthrough (`sym-log`), with its 3 numbered steps |

Why they escape: `/\bis\s+(it|that|this|he|she|they)\s+(safe|…)\b/` requires the pronoun to sit immediately before `safe`, so *"is this **medicine** safe"* does not match; and nothing in (A), (B) or (C) covers a bare drug-information question. §4 says the reply must "never show a normal app answer instead of the care-team route" — both do.

**Repro (either one):** wiped install → complete setup → skip the tour → tap the bubble → type the question → Enter.
**Evidence:** `outputs/v56-audit/shot-04-FINDING-cisplatin-answered-360.png`, `shot-05-FINDING-paediatric-answered-360.png`; `logs/d-medical.log` (D4 rows).

Related, same guard, lower severity but the same root cause — these produce a *list* of app pages rather than the care-team route, for questions that are plainly clinical:

| typed | result |
|---|---|
| `is 2 tablets too many` | list: *"What's 'Hours between doses' / minimum gap?"* etc. |
| `can i crush the tablet` | list: *"Where do I put instructions like 'take with food'?"* |
| `does this interact with grapefruit` | list: *"Does it work without internet?"* |
| `can a child take this` | list: *"What does 'Take all' do…"* |
| `what temperature is a fever` | list (top row is `vit-temp-high`, which is at least the right page) |
| `my mom doubled up on her tablets what now` | answers `miss-real-missed` — safe outcome (careLead callout) but the guard's `/\bdouble\s+up\b/` misses the inflected `doubled up` |

No reply anywhere in the sweep emitted a number, a threshold, a range, or the words "fine"/"normal"/"safe" as guidance — that half of the contract holds (144 assertions in suite D, and the corpus constants are byte-identical to v55: `HELP_TOPICS`, `FAQ_ITEMS`, `HELP_CATEGORIES`, `HELP_POINTERS`, `HELP_CARE_TEAM_LINE` all verified unchanged against `864aeaf`).

---

### V56-2 — HIGH — `navigateTo()` never closes the panel; it then covers and blocks the screen the user navigated to

`index.html:2450` (`navigateTo`'s `next` object)

Brief §5.6, last bullet: *"`navigateTo()` (`:2448`) must set `helpBotOpen: false` in its `next` object, so tapping a bottom-nav tab closes the panel in the same render."* DoD §9.1 #12: *"Tapping a bottom-nav tab closes the panel."* Neither was implemented — `navigateTo` is untouched by this commit.

Consequences, all reproduced:

1. **The panel stays open on top of the new screen.** Tap the bubble on Home, tap **Reports** → the Reports view renders behind a still-open chat panel showing the previous conversation. (`shot-06-FINDING-panel-stays-open-on-nav-360.png`)
2. **It physically blocks controls.** Same on **Meds**: `document.elementFromPoint()` at the centre of the **Add** button returns a node inside `#helpbot-panel` — the Add button cannot be tapped at all until the user finds the small × in the panel header. Playwright's click retried for 30s and never got through. (`shot-panel-blocks-meds.png`; `logs/i-edge.log`, I1b)
3. **The panel resurrects itself.** Because `state.helpBotOpen` stays `true` while `helpBotVisible()` merely *suppresses* rendering, opening the panel → drawer → **Help** (panel correctly hidden) → **Home** brings the panel back, still open, with the old transcript, without the user re-opening anything. (`logs/i-edge.log`, I1)

**Repro:** open the bubble on Home → tap **Meds** in the bottom nav → try to tap **Add**.

---

### V56-3 — MEDIUM — Focus return to the bubble survives less than one second, then lands on `<body>`

`index.html:6263` (`closeHelpBot`), `index.html:3335` (`root.innerHTML = ''`), `index.html:8588` (the 1s tick)

`closeHelpBot()` does the right thing — `requestAnimationFrame` → re-query `#helpbot-fab` by id → `.focus()`. Measured immediately after Escape: `document.activeElement.id === 'helpbot-fab'`. ✅

But the moment the panel closes, `state.helpBotOpen` is false again, so the 1-second tick resumes, `render()` runs `root.innerHTML = ''`, and the focused **button** is destroyed. `render()`'s focus restore (`:3338`) only handles `INPUT` / `SELECT` / `TEXTAREA` with a stable id, so a button is not restored. Measured 1.6s and 3.8s after Escape: `document.activeElement` is **`BODY`**.

This is the same observable end state as the pre-existing drawer defect the brief cites (`BACKLOG.md:9–21`, *"observed activeElement = BODY"*) — the panel's structural fix is real but is undone by the tick a moment later, so a keyboard/switch-control user still ends up stranded on `<body>`.

**Repro:** open the panel, press Escape, wait two seconds, check `document.activeElement`. (`logs/f-repro.log`, F2)

---

### V56-4 — MEDIUM — The transcript loses its scroll position on any re-render, so the answer the user just got scrolls off screen

`index.html:3320` (the `#plans-sheet` scroll-preservation the brief said to copy), `index.html:6354` (the reply scroll)

Brief §5.3: *"Scroll position is lost. Only `#plans-sheet` is preserved today (`:3319–3320`, `:3336`). **The transcript needs the same treatment**: capture `document.getElementById('helpbot-log').scrollTop` before the wipe, restore after."* Not implemented — `render()` preserves only the plans sheet.

The 1s tick is correctly suppressed while the panel is open, but *any* other `setState` still rebuilds the tree: the toast auto-dismiss 4.5s after any logged dose, the Beta date controls, a reminder check. When it fires, `#helpbot-log` is recreated at `scrollTop = 0`.

Measured: after four questions, `scrollTop` 1998 → **0**; the newest reply's top is then at y=2305 while the log viewport is y=268–694 — 1,600px below the fold. The user is looking at the greeting again and has to scroll to find the answer.

This is also what makes §4.1's *"the callout is never scrolled-past-by-default"* intermittently untrue: the same reset moved a `careLead` reply's **Contact your care team** callout off screen in an earlier run (`shot-scroll-miss.png`).

**Repro:** open the panel, ask four questions, tap **Beta date controls** at the top of the screen (any re-render will do), look at the panel. (`logs/g-regress.log`, G1)

---

### V56-5 — MEDIUM — `helpBotLog` has no cap; the transcript grows without bound

`index.html:6228` (`let helpBotLog = []`), `index.html:6327` / `:6336` / `:6339–6341` (five unguarded `.push()` calls)

Brief §5.6: *"**Cap `helpBotLog` at 40 messages**, dropping from the front. Every message is re-rendered on every re-render; an unbounded transcript feeds directly into the `BACKLOG.md:65` render-cost problem."* There is no cap anywhere in the file.

Measured growth on this sandbox (desktop CPU; a phone will be several times worse):

| questions asked | messages | DOM nodes in `#helpbot-log` | one submit |
|---|---|---|---|
| 25 | 50 | 960 | 27 ms |
| 46 | 92 | 1,823 | 48 ms |
| 88 | 176 | 3,549 | 78 ms |
| 130 | 260 | 5,275 | **181 ms** |

So "what happens after 200 questions" is: ~400 messages, ~8,000 extra DOM nodes rebuilt on every single `setState`, and roughly a quarter-second of jank per question. It is bounded only by the fact that the transcript dies on reload. Not a crash, but it is exactly the cost profile `BACKLOG.md:65` already flags, and the brief pre-empted it.

**Repro:** open the panel, ask the same question 130 times. (`logs/i-edge.log`, I3)

---

### V56-6 — MEDIUM — The clinical guard routes to a topically wrong care-team page

`index.html:6335` — `helpMatch(q).filter(x => x.score >= HELPBOT_SHOW && x.topic.careLead)[0]`

When the guard fires, the first `careLead` topic scoring ≥ 0.40 wins, with no requirement that it be *about* what was asked. Observed live:

| typed | the app's answer |
|---|---|
| `his sugar is 250 should i worry` | *"**Tell the care team.** A fast **weight change** during treatment is something they want to know about…"* |
| `she has a rash is that an emergency` | *"**Contact the care team now.** For someone on chemotherapy, a **fever** can be an emergency…"* |
| `should i be worried about his cough` | the **weight-change** page again |
| `can she take her chemo with antibiotics` | the **missed-dose** page |

The destination is always safe (contact the care team) and the copy is verbatim v55, so this is not a safety failure — but a frightened caregiver asking about a rash being told about fever, or about a cough being told about weight, reads as the app having misunderstood, which undermines the one message that must land. The generic §4.2 refusal copy would be strictly better here than a mismatched page. `HELPBOT_SHOW = 0.40` is far too low a bar for "plausible match"; the brief's own wording invites this, so it is a spec weakness as much as an implementation one.

---

### V56-7 — LOW — The panel keeps its old layout after a rotate or resize

`index.html:6520` — `const wide = window.innerWidth >= 520;`

`wide` is read at render time and nothing re-renders on `resize` (`helpBotSyncViewport` only touches `bottom` and `maxHeight`). So:

- opened in portrait at 390px, rotated to landscape 800×360 → the panel stays `left:8 / right:8` and becomes **784px wide** — a full-width bar, not the specified 380px right-anchored panel;
- opened at 900px, resized to 390px → the panel stays 380px wide anchored `right:14`, i.e. its left edge sits at **x = −4**, 4px off the left of the screen.

Opened *at* ≥520px it is correctly 380px / `right:14` (verified). No horizontal document overflow results in either direction. (`logs/f-repro.log` F6, `logs/e-interaction.log` E3.5)

---

### V56-8 — LOW — The v28 `focusin` auto-scroll is not excluded from the panel (brief §5.4)

`index.html:2510–2514`

Brief §5.4 requires `if (el.closest && el.closest('#helpbot-panel')) return;` at the top of the handler. It is absent, and the handler demonstrably fires for `#helpbot-input` (verified by attaching a capture listener), so `el.scrollIntoView({ block: 'center', behavior: 'smooth' })` runs on the chat input 320ms after every tap into it.

**I could not demonstrate a user-visible consequence in Chromium**: with the panel `position: fixed` and `overflow: hidden`, and `#helpbot-log` a sibling of the input rather than an ancestor, the call had no measurable effect on either `#helpbot-log.scrollTop` or `window.scrollY`, on a short page or a long scrolled one. I am reporting it as an unimplemented spec item with no observed impact rather than as a live bug — but see §3, this is one of the cases a real device with the keyboard up could behave differently on.

---

### V56-9 — LOW — Release bookkeeping the brief listed under §8/§11.H is not done

- **`BACKLOG.md:42` was not deleted.** The `HELP_POINTERS` entry ("*browsable but not searchable … Worth folding pointers into the search index next time that file is open*") is still there, even though the gap is genuinely fixed and verified (searching *"change units"* now finds `vit-units`). Brief §8: *"deleting the now-fixed `BACKLOG.md:42` line"* is in scope.
- **The §4.2 known-gap entry was not added** (*"the guard is pattern-based, so 'will she lose her hair' … Add a `BACKLOG.md` entry saying so"*). This release adds two more gaps worth logging with it (V56-1).
- **No `README.md` version-history entry for app-v56**, and **`REQUESTS.md` is not ticked**.

The commit message says the Scribe stage has not run yet, so this is flagged as outstanding rather than as a defect — but TEAM.md's release-mechanics section is explicit that both happen *before* the push, and the app-v55 Auditor already raised the same thing as V55-5 for two consecutive releases.

`./release_check.sh` exits **0**; `sw.js` `CACHE` is `chemowell-app-v56-1` and appears exactly once outside comments; `APP_VERSION` is `app-v56`. ✅

---

### V56-10 — LOW — One assertion in `test/v56-matcher.mjs` does not pin what it claims to pin

`test/v56-matcher.mjs:108–110`

```js
t('HELP_POINTERS folded in as an alias on their target (BACKLOG gap closed)',
  ix.docs.some(d => d.t.id === 'vit-units' && d.tok.kw.has('celsius') === false ? false
                  : d.t.id === 'vit-units' && d.tok.kw.has('unit')), …);
```

It ultimately asserts that `vit-units`'s `kw` field contains the token `unit`. But `vit-units`'s own keywords are `["units","kg","lbs","celsius","fahrenheit","metric"]` — `units` → stem `unit` is in `kw` **whether or not the pointer fold-in exists**. Delete the `HELP_POINTERS` code entirely and this assertion still passes. A discriminating token would be one that only the pointer text supplies, e.g. `kw.has('chang')` or `kw.has('temperature')` (both present in the shipped index, both absent without the fold-in). Verified by rebuilding the field both ways.

Two smaller notes on the same suite:
- The fixture's `decision` column (ANSWER/LIST/NONE) is compared but only `warn++`-ed and printed as a `note:` line — a build that drifted from every decision the brief specifies would still print `ALL GREEN`. (It currently drifts on zero of 53, so nothing is hidden today.)
- The v55 assertions rewritten in this commit (`test/v55-help.mjs:49–70`) are a genuine improvement — version-invariant rather than literal-pinned, and the tick guard is now asserted by content rather than punctuation. The commit message describes them as having been "passing regardless of behaviour"; they were in fact *failing* on a correct build. The new form is right either way.
- Neither `v56-helpbot.mjs` nor `v56-matcher.mjs` asserts any of V56-2, V56-4, V56-5 or V56-8 — the four brief requirements that were never implemented. That is the gap that let all four ship.

---

## 2. Case table

Full pass/fail lines with details: `outputs/v56-audit/logs/*.log`.

| Suite | What it covers | Result |
|---|---|---|
| **A** `a-hide-layout.mjs` | Welcome, tour, 5 views × 2 widths, bubble geometry (56×56, right 14, bottom 84, z37, ≥15px nav clearance), 5 real nav taps each width, Symptoms-tab hit test, drawer, Help view, report detail + Back pill, med editor, overflow | **64 / 64** |
| **B** `b-profiles-tour.mjs` | 4 profiles from wiped installs (chemo/radiation/both/Other), complete guided tour walked to **Finish** with a real medication entered per profile, bubble absence checked at **every** step by DOM presence *and* `elementFromPoint` at the bubble's coordinates (tour layer is `pointer-events:none`), real dose logged, toast/bubble geometry | **48 / 48** |
| **C** `c-modals.mjs` | All seven modals (timeModal, upgradeOpen/plans sheet, apptModal, noteModal, checkinModal, infoModal, eraseAllModalOpen), plus must-NOT-hide: armed `confirmDelete`, TEST_MODE date controls, simulated date shift | **12 / 12** |
| **D** `d-medical.mjs` | All 9 `medical:true` topics + all 4 `careLead` reached through the bubble: right topic, right heading, wrong heading absent, `careLead` shows its own `a` verbatim **once**, non-`careLead` shows `HELP_CARE_TEAM_LINE` verbatim, tone accent colour (`#C0453B` / `#B5761E`), callout above steps and button, callout on screen. Then 38 invented clinical questions × 2 assertions | **142 / 144** (V56-1) |
| **E** `e-interaction.mjs` | Caret suite (15-word sentence at ~1 word/s across ~10 ticks; toast firing mid-type; after a drawer cycle; no panel rebuild across 4s of ticks), transcript scroll, nav-tab close, double-tap bubble, triple-submit, Escape ×2, focus return, rotate, Tab walk, a11y attributes, 12 adversarial inputs, log growth, storage snapshot, reload | **39 / 43** (V56-2, V56-3, V56-5, V56-7) |
| **F** `f-repro.mjs` | Deterministic repros: panel node identity across the tick, focus at 0.1s / 1.6s / 3.8s after Escape, `focusin` scroll on short and long pages, triple-submit delta, Tab out of a fresh panel, panel width at 900px vs after resize, zero off-origin requests | **11 / 14** (V56-3, V56-7) |
| **G** `g-regress.mjs` | Transcript scroll across a re-render, second profile created + **profile switch clears the transcript**, v55 Help centre (117 topics / 15 common questions / search / `HELP_POINTERS` fix / "Nothing matched" empty state / FAQ accordion), one-transition walkthrough + Back label, v53 treatment-type switching ×4 | **21 / 23** (V56-4) |
| **H** `h-fixture.mjs` | The brief's **60-question fixture** + **16 out-of-scope probes**, every one typed into the real panel; plus the FAQ-hit → Common-questions-accordion route | **78 / 78** |
| **I** `i-edge.mjs` | Panel resurrection after a Help visit, panel blocking the Meds Add button, "+N more steps" pluralisation (3 / 4 / many steps), transcript growth to 260 messages, `max-height` clamp ≤ 560px, 320px stretch width | **12 / 16** (V56-2, V56-5) |
| **J** `j-evidence.mjs` | Toast raised while the bubble is on screen (bottom `150px`, no overlap, taps pass through, still wraps, above the nav), **offline** (`setOffline(true)`) answer + guard, evidence screenshots | **10 / 10** |
| — | Pre-existing suites re-run: `v56-matcher` (22), `v56-helpbot` (99), `v55-help` (145), `v52-fixes` (21) | **287 / 287** |

### Selected results worth reading rather than skimming

**Matcher (suite H, all through the real panel).** 60/60 fixture rows produced an acceptable decision; the only deviation from the brief's decision column is #46 *"wat version am i on"*, which ANSWERs `app-version` where §10 said LIST — a better outcome, not a worse one. The six documented NEARs all behave as the brief predicted, including #29 *"the temprature wont save"* answering `med-save-blocked` with `vit-temp-rejected` present as a **"Not what you meant?"** chip (verified rendered). All 16 probes behave: greetings and noise → "I don't have an answer", *"will she lose her hair"* → list (never the lost-phone page), all three person-guard phrasings → the honest refusal.

**Adversarial input (suite E5).** 300 characters, emoji-only, RTL Arabic, `'; DROP TABLE meds; --`, `<img src=x onerror=…>`, `<script>…</script>`, 60 words, repeated whitespace, a single character, a single digit, punctuation-only, embedded newlines — every one produced a normal reply, zero console errors, zero horizontal overflow. **Nothing typed is ever interpreted:** `window.__pwned` / `__pwned2` never set, zero `<img>` or `<script>` nodes inside `#helpbot-log`. The `h()`-only, no-`innerHTML` claim for this content is confirmed — the only `innerHTML` in the render path is `root.innerHTML = ''` at `:3335`, and user text reaches the DOM as a plain string child of `helpBotBubbleBox`.
Two quirks worth knowing, neither a defect: a **single digit** (`4`) fires the temperature care-team route (single digits survive tokenisation by design, §1.3), and `maxlength="200"` is enforced for typing but bypassed by programmatic `value` assignment (paste is capped, autofill would not be).

**The caret bug (suite E1).** Not reproduced. A 74-character sentence typed at 130ms/char (≈10s, ≈10 tick boundaries) arrived complete with the caret at the end; a toast auto-dismissing mid-type did not eat the draft; typing after a drawer open/close cycle was clean. The panel node itself survives 4+ seconds of ticks unmodified (`MutationObserver` on `#root` counted **0** rebuilds while the panel is open), so the entry animation cannot replay. All four defences in §5.1 are present and working. The three defects the Lead Developer's commit message describes finding by self-verification (missing `onInput`, the `max(240,…)` height, scroll-to-top-of-reply) are all genuinely fixed.

**Privacy (suite E7/F8/J2).** `localStorage` and `sessionStorage` key sets are unchanged by a 30-message panel session; no key matching `/helpbot/i`; no transcript text (including `DROP TABLE` and `daily limit locked 29`) anywhere in either store. Reload wipes the transcript. Profile switch wipes it (via `location.reload()` in `switchProfile()`, `:186` — the brief asked for an explicit clear; the reload achieves the same thing structurally). Zero off-origin network requests while the panel is used, and the panel answers identically with the browser context set offline.

**Index and matcher cost (headless, `probe.mjs`).** `helpIndex()` is built once and cached; the object identity is stable across 200 queries and `N` / `df` / `vocab` are unchanged after them — nothing mutates the cache, and nothing can force a rebuild. 132 docs, 1,804 `df` keys, 1,585-token fuzzy vocabulary. `helpFuzzy` cannot loop (bounded `for` over `vocab`, budget ≤ 2) and **cannot return a token missing from `df`** — the final `return f && ix.df[f] ? … : { key: w, quality: 0 }` closes that; verified over 77 resolved terms from deliberately hostile inputs, 0 escapes. Cost: 1.5 ms for a typical query, 0.84 ms for six gibberish tokens (fuzzy fully engaged), **15 ms for a 200-character all-unknown query** and 24 ms for a 60-word one — the worst case is above one frame on this desktop, so it will be noticeably slower on a phone, but it is capped by `maxlength="200"` and only reachable with input that resolves nothing.

**Off-by-one / empty-array edges.** `helpScore`'s bigram loop (`i + 1 < keys.length`) and phrase loop are safe at 0 and 1 terms; `helpMatch` returns `[]` before `helpScore` can divide by an empty denominator; `helpSearch` guards an empty query separately. `helpBotSteps` is only reached behind `t.steps && t.steps.length`, so `undefined` never arrives; **exactly 3 steps renders 3 steps and no "+ N more"**, 4 steps renders **"+ 1 more step"** (singular), 6 renders **"+ 3 more steps"** — all verified live. An FAQ topic in `answer` mode (no `steps`, `cat: 'common'`) renders correctly and its button opens the Common-questions accordion with that row expanded; `'common'` is a real `HELP_CATEGORIES` id (`:2101`) so the disambiguation rows' category label is never blank.

**Listeners.** The `keydown` (Escape) handler and both `visualViewport` listeners are registered once at module scope, outside any render path — confirmed by source position and by the panel surviving repeated open/close cycles with no duplicated behaviour. Escape pressed twice is a clean no-op the second time. Tab from a fresh panel walks Close → chips → input → Send → **out** to the bottom nav and the header; focus never lands on `<body>` during the walk. The non-modal, no-trap decision is honestly implemented rather than a cop-out: there is no `aria-modal`, no scrim, no half-trap, and Tab genuinely leaves — the pre-existing drawer trap is untouched and still behaves exactly as v55 did.

**Copy and visual language (TEAM.md's copy-clarity duty, Designer stage not run).** The greeting, the refusal, the "I'm not certain which one you mean" line and the person-guard reply all read plainly and in the app's voice; none of the forbidden hedges ("I think", "it sounds like", "I'd recommend", "you should") appears in any bot-authored string, and nothing claims to have read the user's data. The bubble, panel, chips and numbered steps match the app's existing palette and the walkthrough page's step treatment. One small note for the Designer: at 360px the greeting's fifth chip (**"Browse all 117 help topics"**) sits just below the fold and needs a scroll to reach — reachable, but the one control that gets a lost user to the full index is the one they cannot see.

---

## 3. What I could NOT verify from this environment

- **Real on-screen-keyboard behaviour.** Acceptance §11.F.1 (composer stays above the keyboard, transcript still scrollable) and the whole of §3.3 depend on Android Chrome's `visualViewport` shrinking while the layout viewport does not. Headless Chromium has no software keyboard, so `helpBotSyncViewport()`'s `kb` term is always 0 here. What I *did* verify: the function is registered once at module scope, never calls `render()`, is called at the end of `render()`, is null-guarded on both `#helpbot-panel` and `window.visualViewport`, and its `Math.min(560, Math.max(240, …))` clamp holds — the panel's computed `max-height` never exceeded 560px at any viewport I tested. The keyboard-open half of §11.B.3 (callout above the fold with the keyboard up) is unverified for the same reason.
- **V56-8's real-device impact.** As above — the missing `focusin` exclusion is a certain code fact but I could not produce the page-lurch it is meant to prevent, and the keyboard-open case is exactly where it would show.
- **Native / OS-level behaviour**: real Android notification delivery, the hardware Back button, the native share sheet, and the installed APK loading `chemowell-app-v56-1` from the service worker. Only reachable via the `emulator-smoke` CI job or a real device.
- **The live deployed site.** This sandbox has no outbound access to it; everything above is against the local server serving the exact committed bytes. The post-push live smoke test with a cache-buster (TEAM.md release mechanics) still has to happen after the upload.
- **Screen-reader announcement** of the `role="log"` region (§11.F.6). I verified the attributes are correct and present (`role="log"`, `aria-live="polite"`, `aria-relevant="additions"`) but no AT is available here to confirm what is actually spoken.
- **iOS Safari** specifically — no WebKit build in this sandbox; the 16px input font size (the iOS zoom guard) is verified by computed style only.

---

## 4. Recommendation

Back to the Lead Developer under the **full-restart** tier of TEAM.md's restart rule: V56-1 is safety-relevant and V56-2 is a real functional defect that blocks a primary control.

Suggested order:
1. **V56-1** — extend `HELP_GUARD_ADVICE` so a noun can sit between the pronoun and the judgement (`is this medicine safe`), and add a drug-information frame (`side effects of …`, `what is <drug> for`, `interact with`), plus the inflected `doubled up`. Any change here needs its own fixture rows *and* a re-run of the 53-question false-positive check — a guard that starts refusing "how do I export a CSV" is its own defect.
2. **V56-2** — one line in `navigateTo`'s `next`. Then re-test the resurrection path (Help → Home) as well as the nav tap.
3. **V56-4** and **V56-5** — both are the brief's §5.3/§5.6 text, unimplemented; both are small.
4. **V56-3** — either restore focus to a button by id in `render()` alongside the existing input restore, or accept it and log it with the drawer's twin defect in `BACKLOG.md` rather than leaving the panel claiming a fix it loses after 1s.
5. **V56-6** — require the matched `careLead` topic to share the guard's `measure` before showing it, and fall back to the generic §4.2 copy otherwise.
6. **V56-9 / V56-10** — Scribe bookkeeping, and one honest assertion in `test/v56-matcher.mjs`.

The matcher itself is in good shape and should not be re-tuned to fix any of the above: 60/60 fixture rows and 16/16 probes behave through the real UI, all 117 topics are still found first by their own title, the Help view's search box genuinely shares the function, and the `HELP_POINTERS` gap is genuinely closed. The two guards run before the matcher, which is the ordering that matters — V56-1 is a hole in the *patterns*, not in the architecture.

**Nothing was committed by this stage.**
