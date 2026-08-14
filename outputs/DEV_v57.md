# app-v57 — Lead Developer implementation record

**Date:** 2026-08-13
**Version:** `app-v57` · `sw.js` CACHE `chemowell-app-v57-1`
**Status:** the gates have run twice. Round 1: BOTH NOT READY (1 High, 2 Medium, 3 Low from the Auditor; 3 Must-fix, 8 Should-fix from the Designer). Round 2: Auditor **READY** (with 7 further Lows, all fixed), Designer **NOT READY** (1 Must-fix, 3 Should-fix, 5 Nice-to-have, all fixed). Every finding from both rounds is fixed and this document is updated to match. Awaiting the Project Manager gate. Nothing pushed.

---

## 1. What Aaron asked for

Verbatim, this session:

> "what's next and what's left on my tasks. I don't really care for the 'bot'. it's not doing what I want. but I do think all of those things can be in a FAQ under the 3 hamburger menu. can this be shared via HTML so others can see it even though its not on the stores yet? I know that notification won't work. tell me else won't work for them?"

Followed by three explicit choices made through the question tool:

1. **Remove the bubble entirely.**
2. **Rename the menu row to "Help & FAQ".**
3. **Add an in-app first-run notice** so browser testers are told what the web build cannot do.

Everything below is scoped to those three plus the manifest wording, which was already on the task sheet as a pre-store blocker and is the text a tester sees under the icon the moment they follow instruction 3.

---

## 2. What changed

### 2.1 The help bubble is gone

Removed, in full: the floating action button, the panel, the transcript, the composer and its `onInput`, the answer/list/none decision function `helpBotDecide`, all six `HELPBOT_*` threshold constants, the clinical guard (`HELP_GUARD_HARD`, `HELP_GUARD_SOFT`, `HELP_GUARD_PERSON`, `HELP_APP_OBJECTS`, `HELP_APP_OBJECTS_DUAL`, `HELP_APP_TASK`, `HELP_CLINICAL_MEASURES`, `HELP_THIRD_PERSON`, `helpBotGuard`), `state.helpBotOpen`, the `navigateTo` reset, the `renderHelpBot()` mount, `helpBotSyncViewport()`, the `helpbot-log` scroll preservation in `render()`, the `#helpbot-fab:focus-visible` CSS rule, the `focusin` exclusion, and the now-unused `send` icon. Approximately 46,000 characters.

Bubble-only geometry reverted to its pre-v56 values: the toast bottom offset `150px` → `96px`, the Back-to-reports pill `91px` → `88px`.

**Kept deliberately, with the reason recorded at the code:**

- **The scored matcher** (`helpNorm`, `helpStem`, `helpIndex`, `helpFuzzy`, `helpTerms`, `helpScore`, `helpMatch`, `helpSearch`, `HELP_STOP`, `HELP_STOP_SEARCH`, `HELP_SYNONYMS`, `HELP_FIELDS`). It is what the Help centre's search box runs on. Reverting to v55's all-words-must-appear substring filter is a straight downgrade — under that filter *"why cant i type in the daily limit box"* returns nothing at all.
- **`BUTTON` in `render()`'s focus-restore list** (Auditor finding V56-3). Added for the bubble, but `drawer-close-btn` has the identical defect and is the reason the rule was written as "any focused element with a stable id" rather than special-cased to one button. Removing it would be an accessibility regression unrelated to this release.

### 2.2 Removing the medical guards — my first argument for this was wrong, and the Auditor proved it

**This section originally argued that removing the guards was safe because "the search box only ranks a list of page titles, which is exactly what v55 shipped and what every v55 gate passed." That claim was false. It is left here, corrected rather than quietly rewritten, because the reasoning error is more useful to the next person than a clean-looking page.**

The Zero Day Auditor did not take the claim on trust. He sliced v55's *actual* `helpSearch()` out of commit `864aeaf` and ran the same 50 clinical questions through both versions:

| | v55 (substring AND-filter) | v56/v57 (scored matcher) |
|---|---|---|
| clinical questions returning a result | **1 of 50** | **45 of 50** |

So v55 answered a typed emergency with an honest empty state, and the behaviour I was defending arrived with the v56 matcher — on a path nobody audited, because v56's whole review was aimed at the bubble. "It passed before" was not evidence of anything; the thing I was pointing at had never been looked at.

What the Auditor saw in the running app at 360px, which is the part that actually matters:

- *"she collapsed"* → **"All my medications vanished from Home"**
- *"she is unresponsive"* → **"I tap something and nothing happens"**
- *"he has chest pain"* → **"Can I record how bad it was?"**
- *"she is coughing up blood"* → **"How do I record blood pressure?"**, 66 results

Nothing on that screen said the app holds no medical information.

**What is true, and what the fix rests on:** the guards cannot come back — Aaron cut the bubble precisely because a thing that answers questions was not what he wanted, and the guard was a classifier that got two Highs and two PM NO-GOs trying to decide which questions were the frightening ones. So the fix does not try to detect anything.

1. **The care-team sentence and a one-tap route to `sym-severe` are now on the results screen unconditionally.** The Auditor recommended showing it "when the query resolves poorly." I went further and made it unconditional, because "poorly" is the same classifier that failed twice — and one calm sentence above a list of app pages costs a person searching *"export csv"* nothing. `"she collapsed"` still ranks that keyword hit, deliberately; what changed is that the true sentence is above it every time.
2. **A relevance floor** (22% of the leader's score) cuts the long tail carried by one weak term. *"she is coughing up blood"*: 66 rows → 19.
3. **A cap of 12 rows**, with the true total still reported — *"The closest 12 of 19 matches"* — because a person who reads "12 results" and a person who reads the truth make different decisions about whether to search again.

The measured floor in `test/v57-search.mjs` also moved: it read the top 8 while the Auditor measured that only **4 rows fit above the fold**, so it was scoring a slice the user cannot see. It now reads 4, and `sym-severe` is pinned by id — the previous set-based check would have printed ALL GREEN with `careLead` dropped from the emergency page itself.

### 2.3 Two real defects my own new suite found, and the fix

`test/v57-search.mjs` failed twice on its first run. Both were genuine:

1. Typing **"will she lose her hair"** ranked **"What happens if I lose my phone?"** first, on the strength of the word *lose* — `hair` matched no document, so a single weak term carried the whole result.
2. Only **19 of 50** of the Lead Auditor's clinical questions surfaced a care-team page anywhere in the visible results.

Both are a **corpus gap, not a scoring bug**, and were fixed with content rather than a tuning hack. New help page `sym-medical-question` — *"Side effects — hair loss, sickness, tiredness: is this normal?"* — flagged `medical: true, careLead: true, careTone: "calm"`. (The title started as an 85-character two-question sentence; the Designer and Auditor both flagged it, and it was shortened without losing the words the matcher needs in the title field.) Its answer says plainly that ChemoWell holds no information about any drug, has no idea what is normal for this person's treatment, would be guessing if it said otherwise, and that this is a question for the care team or the dispensing pharmacist. **No new medical claim is made anywhere in it.**

Result: hair-loss now lands on the correct page; the 53-question fixture is unchanged at **53/53 ranking an acceptable page first**; all 133 help documents are still found first by their own question text. Care-team coverage was reported as 19 → 23 of 50 here; the Auditor showed that number was read from the top 8 while only 4 rows fit above the fold. Measured honestly at 4 rows it is **20 of 50**, and that is what the test now floors.

### 2.4 "Help & FAQ"

Drawer row `label: 'Help'` → `'Help & FAQ'`. The FAQ was folded into this centre in v55 and the row still said only "Help", so nobody looking for the FAQ knew where it had gone. The section eyebrow on all four Help screens now reads **HELP & FAQ** to match the row that got you there.

### 2.5 The browser first-run notice

One dismissible card, first item on Home. Gated on `state.prefsLoaded && !isNativeApp() && !state.browserNoticeSeen && state.tourStep == null` — so it never appears in the native build, never flashes before prefs are known, and never competes with the first-run guide.

It says three things, in the order of how much they cost a tester if unread:

1. **Add this to your Home Screen.** iOS Safari erases a site's saved data after seven days without a visit; a Home Screen install is the documented exemption; nothing logged here is stored anywhere else. This one can cost a tester everything they entered. Instructions branch on `isIOSDevice()` — which checks `maxTouchPoints` as well as the UA string, because iPadOS 13+ reports a desktop Macintosh UA and would otherwise be handed the Android wording.
2. **Reminders only arrive while this page is open.** A browser cannot wake a locked phone.
3. **Exports download instead of opening the share sheet.**

Plus a restatement of the on-device promise. If the app is already running as an installed Home Screen app (`isInstalledPWA()`, checking both `display-mode: standalone` and iOS's `navigator.standalone`), point 1 is replaced with confirmation rather than repeating an instruction the person has already followed.

Three controls: **Got it**, **Open Help & FAQ** (dismisses and navigates), and the **✕**. All three write `browserNoticeSeen` through `setPrefsDB`, so dismissal survives a reload.

**Profile-scoped, not device-wide** — deliberate, and it looks wrong at first glance since this is a property of the browser rather than of the patient. The reason: "Start over" wipes profile prefs and its own copy promises the result is *"exactly like a brand-new install"*. A device-wide flag would survive that and silently withhold the Home Screen warning from the one person who most needs it. The cost is that a caregiver adding a second profile sees it once more.

### 2.6 Manifest and package wording

`manifest.webmanifest` and `package.json` said *"Private chemo medication & symptom tracker … for chemo patients"*. That is the text a tester reads under the icon when they follow the Home Screen instruction above, and it has been wrong since v33, when the app gained radiation, both, and other treatment types. Both now read *"Track medications, doses and symptoms through cancer treatment — all data stays on your device."* README's opening line matched the old wording and was corrected with them.

---

## 3. Tests

| File | What it covers | Result |
|---|---|---|
| `test/v57-search.mjs` | The surviving matcher: stemmer, normalisation, index integrity, pointer fold-in, 53-question fixture, noise, the hair-loss regression, the care-team coverage floor, per-query latency, every topic findable by its own title. Also asserts **by absence** that no help-bubble symbol survives in shipped code. | ALL GREEN — 53/53 exact, 23/50 care-team coverage, 1.5 ms/query |
| `test/v57-browser-notice.mjs` | The new notice at 360 px and 390 px: all four gates at source level, both dismissal paths plus the navigate-and-dismiss path, each re-checked after a full reload, 44 px touch targets, no horizontal overflow, no console errors, manifest wording. | ALL GREEN |
| `test/v55-help.mjs` | The Help centre, 145 assertions. | ALL GREEN |
| `test/v52-fixes.mjs` | Standing regression suite. | ALL GREEN |

### 3.1 A guard that had stopped guarding

Adding one help page broke **six** assertions in `test/v55-help.mjs`, none of which was checking anything that had gone wrong — `EXPECTED_TOPICS` was pinned at 117. That file had already recorded this exact failure mode twice, in its own tick-guard and cache-key comments. The count is now **read from the source**, and what is asserted is the invariant: the number the landing copy shows the user, and the numbers on the category tiles, must agree with how many topics actually exist. Copy claiming 117 walkthroughs when 118 shipped still fails. Adding a topic no longer does.

Two other assertions in that file were tightened rather than re-pinned: `medical: true` count `=== 9` became a floor (`>= 9`, rises but never falls — an equality check there only ever fired in the safe direction), joined by a real invariant that **every `careLead` topic is also flagged `medical`**, so a page routing someone to their care team cannot escape medical-copy review.

### 3.2 One assertion in the new suite could not fail, and was rewritten

The first version of "the notice does not come back after a reload" ran on the Help screen, because the app persists the last view and the preceding step had navigated there — and the notice never renders on Help. It would have passed with the flag never written. It now navigates to Home first and asserts the journal section is present in the same check.

### 3.3 Deleted with the code they tested

`test/v56-matcher.mjs`, `test/v56-helpbot.mjs`, `test/v56-guard-heldout.mjs`, `test/v56-shots.mjs`. All four asserted against functions that no longer exist. The README's v56 row is left as written — it is the record of what v56 shipped, and those files existed then; the v57 row records their removal.

---

## 4. Not done in this release, and why

- **Nothing was changed in `care-tracker` (WEB-MAIN).** Out of scope and requires Aaron's explicit in-the-moment go-ahead regardless.
- **No push.** Awaiting the Designer, Zero Day Auditor and Project Manager gates.
- The rest of the task-sheet queue (Limit Units + CSV unit bug, device-to-device sharing, the Pro copy promising real-time shared access, "Save to this phone" on export, MedlinePlus link, in-app bug logger, drawer keyboard focus) is untouched — this release is scoped to Aaron's three choices plus the manifest blocker.

---

## 5. What the gates should attack hardest

Written as a list of where I think this is most likely to be wrong, not as a summary of what I believe works.

1. **The claim in §2.2.** If the search box surfacing a list of page titles for *"is 101.4 a fever"* is not acceptable, then removing the guards is wrong and this release should not ship as built. v55 shipped exactly that behaviour and passed, but v55 was audited before anyone had thought hard about clinical queries, so "it passed before" is weak evidence and should be treated as such.
2. **The new help page's copy.** It is medical-adjacent by definition. It should be read for whether it makes any claim at all, and for whether a frightened caregiver reads it as helpful or as a brush-off.
3. **Whether the notice actually fires for a real first-time tester** — not in a scripted first-run, but after a wiped install on each of the four treatment types, and in the case where the guide is completed rather than skipped.
4. **Whether anything the bubble touched is now broken by its absence** — toast position, the Back-to-reports pill, focus handling, the 1s tick guard, and the Help view's own scroll behaviour.
5. **The 23/50 care-team floor.** It is measured, not aspirational, and I chose the threshold after seeing the number. That is exactly the shape of the mistake the PM caught on v56.


---

## 6. Gate round 1 — both gates failed it, and what changed

`outputs/DESIGN_v57.md` (3 Must-fix, 8 Should-fix, 6 Nice-to-have, NOT READY) and `outputs/AUDIT_v57.md` (586 cases, 1 High, 2 Medium, 3 Low, NOT READY). Every finding below is fixed in the code this document now describes. The two reports are left exactly as written.

### The High

**V57-1 — the search box answered clinical questions with unrelated app pages.** Covered in §2.2 above, including the fact that my defence of it was wrong and how the Auditor disproved it. Fixed with an unconditional care-team strip, a relevance floor and a cap.

### The Mediums

**V57-2 — the coverage floor measured a slice the user cannot see.** It read the top 8; only 4 rows fit above the fold at 360px. Measured across depths: top 3 → 17/50, top 4 → **20/50**, top 5 → 20/50, top 8 → 23/50. It now reads 4 and floors at 18. Separately, the check was set-based, so dropping `careLead` from **`sym-severe`** — the emergency page the whole metric exists for — still printed ALL GREEN. That page is now pinned by id.

**V57-3 — deriving the topic count made DELETION invisible.** Fixing the hand-edit treadmill opened a hole: every downstream assertion re-derived from the smaller number and agreed with itself. The floor is ratcheted to what shipped (118), and a new check catches the deletion regardless of the count — no topic's `related` list may point at an id that does not exist. That is a real defect on its own; a Related chip that resolves to nothing renders as a dead end.

### The Lows

**V57-4** — the new page's 85-character two-question title ranked first for *"her lips are turning blue"*. Shortened. **V57-5** — the installed-PWA branch said *"Three things need the phone app"* and then listed two, under the heading *"You're using the web preview"*; title and intro now branch with the content (Designer S5). **V57-6** — `REQUESTS.md` had gone three releases without an update and its "Next up" list still routed a fresh session at the cancelled sync work; 10 `BACKLOG.md` entries described code this release deleted; all three `.sh` files were committed `100644`. All fixed — the backlog entries are annotated **CLOSED app-v57** with the reason rather than deleted, and the superseded ordering in `REQUESTS.md` is left in place under a box that says so.

### The Designer's Must-fixes

**M1 — the notice was a wall of text at every phone width.** 919px tall at 360, 1,121px at 320, with body copy running in a 207px column inside a 328px card — 24 characters per line against a comfortable floor of 45. Two compounding causes, both fixed: the icon and the ✕ were flex siblings of the entire body, and there were ~200 words in it. Now a header row plus an absolutely-positioned ✕, and roughly half the copy; the detail that came out moved into `rem-web-vs-app`, which the card now deep-links. **Measured after: 548px at 360 with a 291px column, 528px at 390.**

**M2 — the ✕ was 28×28px**, 40% under the project's floor, its glyph at 4.25:1, and — because of M1 — the only control on screen when the card first painted. Now 44×44 at 5.50:1.

**M3 — the reverted toast offset collided with the "Back to reports" pill**: 34px of vertical overlap in the same dark fill, for the toast's full ~4.5s life. The pill's top edge is 130px up and the toast's bottom edge was at 96px, so overlap was guaranteed for any toast at all. v56 masked it by raising the toast to 150px for the bubble. The toast now lifts to 142px on that one screen and nowhere else; the pill is untouched, because toast height varies with message length and only moving the toast is deterministic.

### The Designer's Should-fixes

All eight taken. S1 type hierarchy 15/14/13 instead of 14/13/13, body dropped to weight 500. S2 `dismissBrowserNotice()` now calls `scrollToTop()` — dismissing used to remove 919px from above the viewport and strand the person mid-page. S3 the read-more control deep-links to `rem-web-vs-app` and **no longer dismisses** — the person who tapped it because they wanted to read more was previously the only person who could never get the card back. S4 the whole body branches on iOS/Android, not just the first sentence; an Android tester was being shown a paragraph about Safari as the sole reason to act. S5 as above. S6 the primary button takes its fill from its own card's tone (`attention.chipFg`, white on it 5.93:1) instead of wearing the info gradient. S7 the `HELP & FAQ` eyebrow this release rewrote on four screens measured **2.79:1** on the page gradient — now `#7A2E08` at 5.36:1. S8 `careTone` splits the care-team ROUTE from the red call-now WEIGHT, so *"is this a side effect"* stops wearing the same treatment as *"something new and frightening is happening"* — which is the exact inversion the V55-3 comment above that line was written to remove.

Nice-to-haves N1 (button padding) and N3 (the card gets its own `#FFFBF5` surface) are also in. N2 is not — the ✕ stays, now that it is 44px and the card is half its former height.

### One environment fact that nearly cost a false green

Mid-round, `test/v55-help.mjs` reported the Help landing claiming **117** walkthroughs while the source held **118**. The cause was not the app: a `python3 -m http.server` left running on port 8899 by the Auditor's mutation-testing harness was serving `/tmp/mut`, not this repo, so every browser-driven test in that window was measuring a different file. Caught by comparing `curl | md5sum` against `md5sum index.html`. **Every browser suite was re-run against the verified-correct server afterwards.** Worth recording: two agents sharing a sandbox will collide on a well-known port, and a test that silently passes against the wrong bytes is worse than one that fails.

### Test results after the round-1 fixes

| File | Result |
|---|---|
| `test/v57-search.mjs` | ALL GREEN — 53/53 exact, 20/50 care-team coverage in the top 4, floor cuts 66 → 19, 1.5 ms/query |
| `test/v57-browser-notice.mjs` | ALL GREEN — including the rendered V57-1 strip across four query types, the 548px card, the 44px ✕, and the S8 callout tone read off the live element |
| `test/v55-help.mjs` | ALL GREEN — 146 assertions, plus the new dangling-`related` and `careTone` invariants |
| `test/v52-fixes.mjs` | ALL GREEN |
| `./release_check.sh` | passed |

### What round 2 should attack hardest

1. **Whether the unconditional strip is actually enough**, in the running app, at 360px, for the six queries the Auditor named. It is above the results and one tap from `sym-severe`, but "is it visible where a frightened person looks" is a judgement I cannot make about my own fix.
2. **Whether the relevance floor at 0.22 quietly broke an ordinary search.** The 53-question fixture and every-topic-by-its-own-title both pass, but those are the sets it was measured against.
3. **The shortened notice copy.** It lost about half its words. Is anything a tester needs now missing, and does `rem-web-vs-app` really carry what came out?
4. **`careTone`.** A new flag with one consumer is a flag that will be set wrongly by the next person. The invariant is tested; the concept may still be wrong.


---

## 7. Gate round 2

### Zero Day Auditor — READY, then 7 more Lows

`outputs/AUDIT_v57.md` §R2. **1,684 cases.** He closed V57-1, V57-2 and V57-3 by re-running his own round-1 mutations, and said of the safety fix: *"going unconditional rather than classifying was right; I was wrong to suggest a coverage gate."* Measured at 360px, the wrong answer is now the fourth thing on screen rather than the first.

The result that mattered most is the one I could not have produced about my own work: **1,164 exhaustive relevance probes** — every topic keyword, every title bigram and trigram — proving the 0.22 floor makes **zero pages unreachable that were reachable before**, plus 56 hand-written natural queries deliberately avoiding all three sets I had measured against. Two changed, both pages that had been at rank 21 and 29 of 57–69, i.e. never findable anyway.

**Four of the seven new Lows were my own tests lying, and he proved each by mutation:**

- **R2-A** — the "unconditional" source check could not see a gate. He wrapped the strip in a ternary; still green. He rewrote the gate with `&&`; still green. A regex cannot see control flow. **Deleted rather than patched** — the property is proved by the browser suite typing four queries into the real UI, including the high-coverage one any gate would suppress.
- **R2-B** — the scroll-restore check tapped from a page that had never been scrolled, so `scrollY` was already 0 and it passed with `scrollToTop()` deleted. It now scrolls to 400 first **and asserts that precondition**, so it cannot become a no-op again.
- **R2-C** — "careTone only on careLead" matched lazily from the first topic in the block, so every chunk spanned other topics and borrowed their flag. He proved it by flagging `sym-log`. Per-line now.
- **R2-D** — dropping `careLead` from any single page still passed. All five are pinned by id.

**R2-E was a real 320px defect, and the fix is upstream rather than local.** A toast raised on Home was still on screen after navigating to Help, covering the care-team button entirely for 4.5s. He proposed adding the search screen to `toastNeedsLift()`. I did not: that button sits in **normal page flow**, so a constant lift clears it only at the scroll position it was measured at. The real defect was that a toast describing an action on one screen survived the navigation away from it. `navigateTo()` now clears it, which closes the repro at the root and fixes the class everywhere. `toastNeedsLift()` is back to fixed-positioned furniture only, and the comment says why.

**R2-F / R2-G** — high-stakes copy, both taken: the heading became *"ChemoWell can't tell you if something is serious"*, and the button *"When to call the care team straight away"* (**"them"** had no antecedent if the button was read alone).

### Designer — NOT READY, 1 Must-fix + 3 Should-fix + 5 Nice-to-have

`outputs/DESIGN_v57.md` §Round 2. He re-measured all 11 round-1 M/S findings and confirmed every one genuinely fixed, including the 320px width nobody had measured (card **1,121.7 → 586.1px**). He also proved M3 on the real Reports detail by exposing `setToast` in a private measurement copy, rather than accepting the source-level check.

**R2D-1 (Must-fix) — the finding I would not have found.** His clearance figures subtracted the **69px fixed bottom nav**; both the Auditor's and mine had treated the fold as the viewport edge. Against the real usable height the strip put **0 of 12 result rows, and the empty state's advice line, under the nav** at 320 and 360. And the height was self-inflicted: the strip's heading restated the body's first clause verbatim — a copy defect on its own merits, costing three lines.

Fixed in three steps, each measured rather than estimated:

1. **The duplicated clause is gone** from the body (173 → 118 characters). −39px at both widths.
2. **The count line moved inside the results card** as a caption on the rows it describes, instead of becoming its own section — which would have cost two 18px flex gaps plus its height and eaten most of step 1.
3. **The "Search help" display heading is gone from the results screen.** It sat directly above a card whose own field label reads *Search help*, on the one screen where the person has already typed and is waiting for rows — the same duplication he had just flagged inside the strip. The eyebrow stays; the H1 goes. −45px at every width. The Help landing keeps its heading.

**Measured outcome, first result row against the nav at nav-top 651:** 320px **582 (69px of an 80px row visible)**, 360px **562 (89px — the whole first row and part of the second)**. His stated bar for 320 was 62.2px of a 79.6px row.

**R2D-2** — on a real first run the *"Welcome to ChemoWell"* toast painted across the notice card's privacy line and the top of its primary button. The card **is** the greeting on that run; the toast is now suppressed for it and unchanged for native builds and every later profile. **R2D-3** — the count line also failed AA on the page gradient (`#7A6E76` at 3.23–3.68:1); it is `#5E4337` and now inside a card. **R2D-4** — the strip was the same `#FFFFFF` as both the search card above it and the results card below (1.00:1); it has the notice card's `#FFFBF5` surface. **R2D-5** — at 320 "Got it" landed 3px under the nav on first paint; he asked explicitly for no further copy cut, so 9px came out of the card's vertical rhythm instead and it now clears at **645 against 651**. **R2D-6** — 142 → 150px, so the lifted toast and the pill read as two objects rather than one. **R2D-9** — the notice and the strip are capped at 560px, so the 768px line length stays under WCAG 1.4.8.

**Not taken, with reasons.** **R2D-7** (the deep-linked page's back row says "← Reminders & notifications" when the reader came from Home) is real, but making the back row depend on where `state.help` was set from adds entry-point state to a component that currently has none — it belongs in the backlog as a design question, not in a fix pass. **R2D-8** (the strip's button label wraps to two lines) he recorded as a known state rather than a request; the wording is the Auditor's R2-G fix and both reviewers have now approved it, so churning it again is not worth the risk on this particular sentence. **N2** (drop the ✕) stays declined and he agreed.

### Every round-2 fix is pinned by a test

`test/v57-browser-notice.mjs` gained a block that measures **against the real usable height**, subtracting the fixed nav — because treating the fold as the viewport edge is exactly what let R2D-1 through two prior reviews. It asserts strip height, the strip's own surface colour, that a result row stays legible above the nav at 320 and 360, that the count line is above the rows and no longer the failing colour, that no welcome toast competes with the notice, and that the notice's primary action clears the nav on first paint.

### Test results

| File | Result |
|---|---|
| `test/v57-search.mjs` | ALL GREEN |
| `test/v57-browser-notice.mjs` | ALL GREEN |
| `test/v55-help.mjs` | ALL GREEN |
| `test/v52-fixes.mjs` | ALL GREEN |
| `./release_check.sh` | passed |

### For the Project Manager

Three judgement calls are mine and should be checked rather than accepted:

1. **Removing the "Search help" H1 from the results screen** was not requested by either gate. I introduced it to buy the 45px that R2D-1 needed at 320, on the argument that it duplicated the field label directly below it. It is a visual change no Designer has reviewed.
2. **R2D-7 and R2D-8 deferred**, reasons above.
3. **`navigateTo()` now clears any in-flight toast.** That is a behaviour change affecting every screen in the app, made to fix a 320px defect on one. No call site pairs `setToast` with `navigateTo`, and the Auditor's regression sweep was clean — but it is the widest-blast-radius change in this release and it is not what either gate asked for.
