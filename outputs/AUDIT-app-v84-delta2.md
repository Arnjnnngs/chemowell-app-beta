AUDITED-COMMIT: 3c8365f
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v84, SECOND DELTA PASS on `c70e06d` → `3c8365f`

**HEADLINE: a NINTH mutant survives, and it deletes the half of the release's headline fix that is
the only half a phone can produce.** Remove `'touchmove'` from the gesture listener at
`index.html:4262` and `test/v84-whatsnew.mjs` scores **65/65**. It is not a no-op mutant: driven
with a real touch swipe over CDP, the shipping build holds at `scrollY 535 → 535` and the mutant
goes `396 → 1` — the yank, back in full. The suite swipes with `page.mouse.wheel`, and a
Capacitor-wrapped iOS/Android build has no wheel.

**Everything the code does, I measured as correct.** All nine suites match their claimed figures,
the falsification sweep is a genuine 8/8, the rebuild path boots, the Designer's numbers hold at all
three widths, Rule 0 is clean and the ratchet has not moved. The defects in this pass are in the
INSTRUMENTS and in the RECORD: a check that cannot see the platform it protects, a rebuild script
that reproduces a defect four rounds removed, a class check that does not do what it says in either
direction, a README that describes a guard the build does not contain, and a gating suite whose
figure depends on what hour it is run.

---

## THE FIVE ITEMS I WAS ASKED TO VERIFY

### 1. The `v28 is not deleted` check — FIXED, and I killed mutant 3 myself

`test/v84-whatsnew.mjs:517-526`. The precondition is split into its own check; the assertion now
focuses in-page with `el.focus({ preventScroll: true })` (`:521`) and requires `window.scrollY` to
have moved by more than 100px as well as the field landing inside the fold.

I ran `FALSIFY_PORT=8124 ./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh` end to
end. **8 caught, 0 survived**, exit 0. Mutant 3 dies on exactly the check that was vacuous:

    FAIL  and focusing it WITHOUT a swipe brings it into view -- v28 is not deleted by the guard
          |  scrollY 0 -> 0, field top 870 -> 870 in 844px

against `scrollY 0 -> 470, field top 870 -> 400` on the shipping build. The two builds are now
distinguishable, which they were not at `c70e06d` or `be83637`.

**The sweep itself is real this time, and that is worth saying separately.** The eight mutants
produced eight DIFFERENT failure signatures (1/2/4 → 2 failures, 3 → 1, 5 → 7, 6 → 14, 7 → 1,
8 → 1) on a green baseline. That is direct evidence that `find "$WORK" -mindepth 1 -delete` really
does rebuild the clone under the running server — the defect that made every previous sweep
meaningless is genuinely gone. I did not take this on reading, as the last pass had to.

### 2. The cause-based scroll guard — SOUND IN CHROMIUM, with one hole (see BLOCK 1)

`index.html:4261-4264` and `:4275`.

**`page.mouse.wheel` is a real wheel event, not a CDP shortcut.** Measured directly: a capture
listener on `document` sees `{"t":"wheel","trusted":true,"target":"DIV"}`, and the same probe
after `window.scrollTo(0, 800)` sees **nothing at all**. So the check is exercising the path the
app listens on, and the old `window.scrollTo` line would indeed have passed on a build with the
guard removed. That part of the rewrite is correct and load-bearing — mutant 2 (the guard deleted)
dies with 2 failures.

**`capture: true, passive: true` cannot be blocked or swallowed.** `passive` makes
`preventDefault()` a no-op, so it cannot stop scrolling. For the capture claim I checked the whole
file rather than reasoning about it: `window.addEventListener` appears five times (`error`,
`unhandledrejection`, `storage`, `popstate` — none of them wheel or touchmove), and
`stopPropagation` appears exactly twice (`:4455`, `:5711`), both on `onClick` handlers. There is no
listener anywhere that can run before a capture listener on `document` for these two events. The
comment at `:4256-4260` is accurate.

**Gestures that do not scroll the page.** The three in-app scroll containers that also hold form
fields are the daily check-in dialog (`:3537`), the appointment dialog (`:8668`) and the note dialog
(`:8880`). Scrolling inside one of those sets `lastUserScrollAt` and suppresses the nudge. That is
**better** than the 8px version, not worse: while a dialog is open the body is `position: fixed`, so
`window.scrollY` never changed and the effect-based guard would have nudged on every keystroke while
the reader was deliberately scrolling. There is no horizontal scroller in the file (`overflowX:
'auto'` matches nothing), so the horizontal-swipe case you asked about does not arise today.

**Tap jitter does not suppress the nudge, and the ordering is why.** Focus lands on `touchend`, so a
tap's own touchmove is always *before* `focusedAt` and `lastUserScrollAt > focusedAt` is false.
`>` rather than `>=` is therefore the correct comparison, not an accident: `>=` would let a tap's
jitter switch v28 off. The same-millisecond tie falls through to the nudge, and I could not
construct a reachable case — a deliberate swipe emits touchmoves across tens of milliseconds, so at
least one of them lands in a later millisecond than focus. Not a hazard.

**What this sandbox cannot answer, stated plainly.** Chromium, no on-screen keyboard, no iOS. I
cannot test whether iOS fires `touchmove` during momentum after the finger lifts (it does not, on
every account I have, but I did not measure it), nor what iOS does to the layout viewport when the
keyboard opens. The reachable momentum case requires a *tap* during a fling, and a tap cancels the
fling, so I judge it not a practical risk — but that is judgement, not measurement. BACKLOG.md's
new entry names this correctly and puts it on the phone checklist.

### 3. `harness-v84-whatsnew.py` — IT BOOTS NOW, but it rebuilds a corrected defect

Rebuilt from `adfc99c^` into a scratch directory, served it, and LOADED it:

| | |
|---|---|
| `#root` children | 1 element, **21 descendants**, real content (`"Welcome to ChemoWell…"`) |
| `window.__whatsNewTest` | present, keys `latest, all, shouldShow, key` |
| `window.__backTest.version` | **`app-v84`** |
| page errors | **none** |
| the notice itself | renders, with its one entry |

The "blank app" BLOCK from the last pass is genuinely closed, and the fix is the right one: the
block is lifted and re-attached before `</script>` (`cut` anchored on `</script>\n</body>\n</html>`,
which is unique, rather than on `</script>` in a file with six script tags).

**Fidelity against `adfc99c:index.html` — five hunks, and I am counting them honestly.** Three are
the post-audit copy corrections (the script now emits the newer, TRUE text in all three places, so
the rebuild is *ahead* of `adfc99c` rather than behind it); one is a comment. The fifth is a real
omission: **`window.__tempTest` is absent from the rebuild.** That is not this script's doing —
`__tempTest` is written by `harness-v85-temperature-report.py:224`, and `adfc99c` bundled that patch
alongside this one. Worth knowing for anyone rebuilding: those two scripts are order-dependent, and
`harness-v85` must run FIRST, because its anchor is the pre-What's-New `__backTest` line. It refuses
rather than corrupting if run the other way round, which is the right failure.

Against the SHIPPING build the rebuild is 354 lines short across 21 hunks — the fourteen commits of
audit fixes since `adfc99c` have no patch scripts. That is the pre-existing shape of reproducibility
in this repo, not a delta regression, and I am not raising it as a finding.

**The false changelog line is gone** (`harness-v84-whatsnew.py:72` now writes *"Updates from here
on are listed…"*). See FINDING 2 for the one it still writes.

### 4. README, `'See recent updates'`, `helpSetQuery` — DONE, with one false sentence left

- **Cache key.** README `chemowell-app-v84-9` = `sw.js:1` `chemowell-app-v84-9`. Match.
- **Every suite figure.** I ran all nine against a clean `git archive HEAD` export on its own port.
  All nine match what the row claims: v84-whatsnew **65/65**, v83-meds-and-reports **80/80**,
  v80-up-next **48/48**, v75-no-other-patient **27/27**, v82-vitals-strip **41/41**, v82-timeline
  **24/24**, v82-back-button **15/15**, v76-properties-equivalence **22/22**,
  v76-empty-window-render **13/13**.
- **Truncation / backticks.** The row terminates properly with ` |`. 116 backticks and 124 `**`
  markers — both even, nothing unterminated.
- **`'See recent updates'`.** Shipped at `index.html:9088` and rendered; I read it off the live DOM.
- **`helpSetQuery` got BOTH halves** — `index.html:9604-9608`: `restoringFocus = true`, then
  `focus({ preventScroll: true })`, cleared in a `finally`.
- **No fifth surface in the app.** I grepped every quoted string in `index.html` for
  every/all/complete/full/entire/whole near update/release/version/changelog/history. The only hits
  are about logged history, and they are true.

### 5. The new class check (section 7f) — IT CATCHES THE FOUR, IT DOES NOT CATCH THE CLASS

It is not decoration: I watched it go red on its own, unprompted. Early in this pass I mistakenly
judged an older build (see the note at the end) and section 7f reported

    FAIL  and the notice claims nothing about being complete  |  all updates

which is the defect, found by the check, on a build that had it. That is the strongest evidence a
check can give and it was accidental. But see FINDING 3 — the claim made for it is bigger than
what it does.

---

## THE BLOCK

### BLOCK 1 — `index.html:4262`. The `touchmove` half of the guard is protected by nothing, and removing it brings the yank back on a phone

Mutant 9, built by hand on a private clone of HEAD:

    ['wheel', 'touchmove'].forEach(...)   ->   ['wheel'].forEach(...)

`test/v84-whatsnew.mjs` scores **65 checks, 65 passed, 0 failed.**

It is not a no-op. Driven with real touch input — `Input.dispatchTouchEvent` over CDP on a
`hasTouch` context, trusted `touchmove` events confirmed reaching the document, with a brief hold
before `touchEnd` so Chromium's fling does not swamp the measurement:

| build | after the swipe | 1.8s later | |
|---|---|---|---|
| `3c8365f` | scrollY 535 | **535** | stays where the thumb left it |
| mutant 9 (`touchmove` removed) | scrollY 396 | **1** | **yanked back to the field** |

**Why this matters more than an ordinary coverage gap.** `wheel` does not exist on a phone. This
repo's whole purpose is the Capacitor wrap for iOS and Android (`CLAUDE.md`, "What this repo is"),
and `touchmove` is the only event a finger produces. So the suite verifies the guard on the one
input device the product will never ship with, and scores green on a build where every real user
gets the bug back. The sweep's "8 caught, 0 survived" is true and invites exactly the wrong
conclusion.

**It is writable here.** I did it in this sandbox with `context.newCDPSession(page)` and
`Input.dispatchTouchEvent`; Playwright's own `touchscreen` API has only `tap()`, which is why CDP is
needed. Two notes for whoever writes it: Chromium's touch fling continues past `touchEnd` and will
carry the page to max scroll if you do not hold the finger still for ~60ms first, and the whole
gesture must complete inside the 320ms window or the nudge fires mid-swipe and is overridden.

---

## FINDINGS

### FINDING 2 — `harness-v84-whatsnew.py:171` still writes `'See all updates'`

The previous pass's item 2 said "update the changelog text it writes". The CHANGELOG bullet was
updated; the button label was not. So the documented way to rebuild this release produces an app
carrying the completeness claim that took four review rounds to remove. **Verified by loading the
rebuild, not by reading the script** — its notice renders:

    ...newest first, if you want to look back at one.
    See all updates
    Got it

Run `test/v84-whatsnew.mjs` section 7f against that rebuild and it goes red, which is 7f doing its
job on the artifact its own release chain produces. The docstring at line 22 says the same thing.
Two words.

### FINDING 3 — section 7f does not do what its comment and the README say it does

The comment (`test/v84-whatsnew.mjs:531-540`) and the README both say it "refuses any claim of
completeness, however it is worded". It does not, in either direction, and I measured both.

**Under-broad — a fifth surface making the claim passes 65/65.** I replaced the changelog screen's
heading — one of the three scopes 7f reads — with

    'The complete changelog for ChemoWell, newest first. Nothing is left out. This phone is running ' + APP_VERSION + '.'

**65 checks, 65 passed, 0 failed.** The regex has `complete (list|history)` but not "complete
changelog", and nothing at all for "nothing is left out", "the whole history", "everything that
changed".

**Over-broad — innocent, true copy turns it red.** The same heading with

    'Recent updates to ChemoWell, newest first. We check every release on both phone sizes. ...'

fails: `and the screen -- heading included -- claims nothing about being complete | every release`.
A future changelog entry containing "every release", "all versions" or similar will block a
legitimate release with a message that does not describe what is wrong.

**And the self-assertion cannot see either.** `CLAIM.test(...)` over four strings the author already
had in hand, plus one known-good string, proves the regex has no typo. It proves nothing about the
class, which is what the check is named after. That is a weaker guarantee than the surrounding
prose claims, and on this release the gap between "what the check does" and "what is said about it"
is the thing that keeps costing rounds.

**It should also read more than three scopes** — a claim in an `aria-label` is read aloud to a
screen-reader user and `innerText` never sees it.

### FINDING 4 — the README's app-v84 row describes a guard the shipping build does not have

The row states the fix is *"an **8px scroll guard** in the listener so a person who taps a field and
swipes away inside 320ms keeps their swipe. 8px rather than 0 because the on-screen keyboard moves
scrollY by a pixel or two on its own"*. That guard was deleted in `5328ea4` and replaced by the
wheel/touchmove listener. `grep -n "yAtFocus\|Math.abs(yNow" index.html` returns nothing.

This is the same defect this delta just fixed in `index.html:12677-12682` — a comment that became
false when the code moved — left standing one file over, in the document that IS the release record.
The row also reads *"Eight mutants swept, seven caught, and the one that survived is fixed above"*,
which describes the previous sweep; the current one is 8/8.

Everything else in the row I checked figure by figure is accurate.

### FINDING 5 — `test/v82-timeline.mjs` has the unfrozen-clock hazard that was just fixed one file over, and its comment says it does not

`test/v82-timeline.mjs:40-42` reads *"Fixtures are built around a FROZEN hour rather than the wall
clock. A suite whose windows move with the time of day stops testing anything at 11pm and nobody
notices."* `AT(h, m)` (`:42`) freezes the fixture HOURS but there is no `addInitScript` Date shim, so
the page's clock is live — which is precisely the half-fix the builder just corrected in
`test/v82-vitals-strip.mjs`.

Measured: fixtures untouched, page clock shimmed to a different hour.

| page clock | result |
|---|---|
| 23:50 | 24/24 |
| 01:50 | **20/24** — *"no MISSED row was produced - fixture no longer exercises this"* ×4 |

So `24/24` is a statement about what hour it happened to be, and between roughly midnight and the
fixture's window this suite reports a defect that does not exist — the same wasted trail the vitals
suite laid. Eight lines, copied from the file next to it.

The other seven gating suites are clean: `v83-meds-and-reports`, `v80-up-next` and
`v82-vitals-strip` all shim the page `Date`; `v84-whatsnew`, `v82-back-button`,
`v75-no-other-patient`, `v76-properties-equivalence` and `v76-empty-window-render` have no
time-dependent fixtures at all.

### FINDING 6 (minor, and it closes rather than opens) — `helpSetQuery`'s guard is unprotected AND unobservable

Reverting `index.html:9604-9608` to the bare `next.focus()` it had before this delta leaves the
suite at 65/65, so the fix landed with no check. I then tried to build the check and could not:
**with a query active the help screen is exactly one viewport tall (844px) and does not scroll**, so
there is no "back up" to be dragged to. Typing collapses the page from 2646px to 844px and the
browser clamps `scrollY` to 0 on both builds identically. The change is correct by symmetry and
harmless; there is nothing to assert today. Recorded so the next pass does not spend a round on it.

### FINDING 7 (one word) — the re-entrancy comment is right in substance, loose in wording

`index.html:5254-5258` says *"nothing in this file listens for 'focus'"*. True for `'focus'` —
`grep` finds no `addEventListener('focus'`, no `onFocus`, no `onfocus`, no `focusout`. There IS a
`focusin` listener at `:4266`, which is a focus-family handler and IS dispatched synchronously by
the guarded `focus()` call. It returns on its first line under `restoringFocus` and calls neither
`setState()` nor `render()`, so the non-re-entrancy claim holds exactly as stated. "listens for
`focus` or `focusin`" would be precise.

---

## VERIFIED CLEAN

**All nine suites**, run by me against a clean `git archive HEAD` export on its own port (8123), not
the working tree: 65/65 · 80/80 · 48/48 · 27/27 · 41/41 · 24/24 · 15/15 · 22/22 · 13/13.

**Temporal dead zone.** `let restoringFocus` at `:4245`, `let lastUserScrollAt` at `:4261`. Grep for
both returns no reference above its declaration; the only module-init statement between them is the
`forEach` at `:4262`, which is after. The `focus()` and `setSelectionRange()` calls in both restore
sites are individually wrapped and the flag is cleared in a `finally`. The app boots with zero page
errors in every run in this pass, including the rebuild.

**Designer addendum, spot-checked independently** — I re-measured rather than reading the PNGs, and
then looked at one. At 320, 360 and 390, on both `[data-whatsnew-modal]` and
`[data-whatsnew-screen]`: `document.scrollWidth` equals the viewport exactly, **0** elements past
the right edge, **0** text controls under 16px, **0** buttons under 44×44, **0** attributes with the
literal value `"null"`, **0** page errors. `whatsnew-modal-320.png` confirms the wrapping claim:
*"See recent updates"* wraps to two lines inside its pill, the row keeps its height and *"Got it"*
is fully on screen. The six PNGs are at the widths claimed.

**BACKLOG.md — both deferrals are honest.** `volumeCeilingMl` is READ at `:2071`, `:2072`, `:2575`
and `:6042` and **assigned nowhere in `index.html`**; the only assignments in the repo are in two
test fixtures (`test/v79-home-cards-render.mjs:74`, `test/v79-warning-priority.mjs:91`). So the
override prompt's second opinion is genuinely unreachable, and the entry names the right trigger for
when it stops being. The iOS entry states the limit correctly.

**The other four bare `focus()` calls are harmless and I checked the one that looked risky.**
`:4183`, `:4187`, `:4206`, `:4207` all target buttons, which the v28 listener ignores
(`el.matches('input, select, textarea')`). The drawer-trigger restore at `:4187` could in principle
have yanked the page; measured on a 2322px screen, scroll position across open → close is
**1200 → 1200**, preserved.

**Rule 0 — clean across the whole delta.** No patient name, no gendered pronoun on any added line in
`index.html`, `sw.js`, `test/`, the harness script, `README.md`, `BACKLOG.md` or `outputs/` —
including in comments. No care-plan dose, ceiling or schedule. No new behaviour keyed to a
medication id. `test/v75-no-other-patient.mjs` is 27/27 with the ratchet reading **0/0/0 pinned at
0/0/0**, unmoved.

**No `h()` null-attribute pattern, no version literal pinned in any new check, no assertion on
`document.body.textContent`, no declaration moved above its readers anywhere in the delta.**

**`./release_check.sh` refuses**, correctly: `outputs/AUDIT-app-v84-delta.md` (examined `c70e06d`)
and `outputs/PM-app-v84.md` (examined `3ec6b4c`) both say DO NOT SHIP. This report is a third
refusal, at a later commit. **The PM gate still has to re-run against `3c8365f` or later
regardless** — clearing the audit half does not clear it.

---

## WHAT I RELIED ON RATHER THAN RE-DERIVING

- `outputs/AUDIT-app-v84.md` for everything up to `5600b92`, and `outputs/AUDIT-app-v84-delta.md`
  for everything up to `c70e06d`, as instructed.
- That pass's enumeration of the ceiling override prompt's reachable cases (`ceilingUnit`,
  `ceilingGroup`, rolling, null). I re-checked only the residual it names — the volume path — and
  confirmed the unreachability claim.
- Its enumeration of column-0 statements above `:4245` for the TDZ argument. I re-checked the
  cheaper version (grep for references above each declaration) and it agrees.
- The app-v81/82/83 behaviour that the nine suites assert. I ran the suites; I did not independently
  re-derive what they assert.

## WHAT I DID NOT CHECK

- **Anything iOS.** No on-screen keyboard, no Safari, no real momentum/fling after `touchEnd`, no
  visual-viewport behaviour. Chromium only, and that exemption is sharper than usual this release
  because the fix at its centre is a touch-gesture guard.
- The ~40 suites in `test/` outside the nine named, except for a grep for the clock hazard.
- `sync-backend/`, `.github/workflows/`, `capacitor.config.ts`, `package.json` — untouched by this
  delta.
- The fifteen app-v83 Designer screenshots; only the six new ones, and only the measurements above.
- `PUBLISHED.json`'s baseline. `release_check.sh` warns that 28 commits have changed `index.html`
  since the app-v80 record and assumes none are live. I did not verify that assumption.
- Whether any of v81–v84 has been seen on a device. It has not, and that is the standing risk in
  shipping four versions to every installed phone at once.

## A CAUTION FOR THE NEXT PASS, FROM MY OWN MISTAKE

I spent two full suite runs judging the wrong build. Port 8971 was already held by a `python3 -m
http.server` from an earlier session serving an older tree, my own server silently failed to bind,
and the suite reported three failures about code that had been fixed. I caught it by md5-ing what
the port actually served against `git archive HEAD`. `falsify.sh` already refuses a busy port; a
plain `node test/…` run does not. **md5 the served file before believing a red.** (It did have one
happy consequence — it is where I watched section 7f catch the real defect on a build that had it.)

---

Measured in Chromium against a clean export of `3c8365f` on port 8123, a rebuild of `adfc99c^` on
8125, four private mutant clones on 8126–8129, and `falsify.sh`'s own clones on 8124. No file in the
repository was modified by this pass except this report.

## WHAT THE BUILDER SHOULD DO

1. **Cover the `touchmove` half** (BLOCK 1). A CDP `Input.dispatchTouchEvent` swipe in section 7e,
   and mutant 9 in `falsify/mutants-v84-whatsnew.sh`. Watch it die.
2. **`harness-v84-whatsnew.py:171`** — `'See recent updates'`, and line 22 of the docstring.
3. **Section 7f**: widen the pattern to the class it is named for (or say honestly in the comment
   that it catches the four shipped wordings and near variants), narrow it so "every release" in
   ordinary prose does not fail it, and read `aria-label` as well as `innerText`.
4. **README's app-v84 row**: the 8px guard no longer exists — replace those two sentences with what
   shipped, and correct "seven caught" to 8/8.
5. **`test/v82-timeline.mjs`**: the same eight-line `addInitScript` Date shim as
   `test/v82-vitals-strip.mjs:85-90`, and fix the comment at `:40` that claims it is already there.
6. Then the PM re-runs. Its refusal at `3ec6b4c` is still standing on its own.
