AUDITED-COMMIT: c9c4388
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v84, FOURTH DELTA PASS on `6339aee` → `c9c4388`

**HEADLINE: the one behaviour this delta adds cannot happen on this release — I measured it — and
three of the four records written about it say it will.** `whatsNewOlderUnseenCount()` returns **0
for every phone that receives app-v84**, because `whatsNewShouldShow()` stamps the marker before the
modal renders and no installed phone has a marker to begin with. The `index.html` comment says so,
honestly and precisely. The README row, the Designer addendum and the Enhancer addendum — all three
written BEFORE that discovery and none updated after it — describe the line as the fix for the
app-v80 rollout, and one of them states a rendered value outright: *"On a real phone sitting on
app-v80 it will read `3`."* It will read nothing.

**The shipping code is sound and I would ship it today.** All nine suites match their claimed
figures, BLOCK A is genuinely closed, the arithmetic is right in every direction I could bend it,
Rule 0 is clean, and the delta cannot regress anything because on every phone in this rollout it is
a no-op. **What I am refusing is the record**, which is the same class this release's own README
calls its worst finding — *"a comment asserting a guarantee the code did not have"* — recurring for
the third time, in the delta written to answer it. **Nothing I found can harm a caregiver.** The
remediation is three sentences in three files plus, recommended, two assertions and three mutants;
it touches no shipped code, so no suite, version, cache key or screenshot has to move.

---

## THE BLOCK

### BLOCK A2 — the delta's only behaviour change cannot fire on this release, and three records say it will

**What I measured.** `PUBLISHED.json` records live as **app-v80**, and `git show 048c1ff:index.html`
contains **no** `chemowell-app-seen-version`, no `CHANGELOG` and no `whatsNew*` function at all — the
marker does not exist in the shipping build. So every phone receiving app-v84 arrives with **no
marker and prior ChemoWell data**, which is the branch at `index.html:9107`:

    function whatsNewShouldShow() {
      const seen = whatsNewSeenVersion();
      if (!seen) { const prior = deviceHasPriorChemoWellData(); whatsNewMarkSeen(); return prior; }

`whatsNewMarkSeen()` writes `APP_VERSION` **before** the modal is ever rendered. By the time
`renderWhatsNewModal()` calls `whatsNewOlderUnseenCount()` (`index.html:9119`), `seen` is
`'app-v84'`, `idx` is `0`, `unseen - 1` is `-1`, and `Math.max(0, -1)` is **0**. The line renders
`null` and nothing is drawn.

Driven in Chromium against a clean `git archive HEAD` export on port 8951, md5 of the served file
checked against the working tree first — I set the app up with real data, removed **only** the
seen-version key (exactly what the upgrade looks like), reloaded, and read the live DOM:

| | |
|---|---|
| `localStorage` marker after load | `app-v84` (stamped by `whatsNewShouldShow`) |
| `[data-whatsnew-modal]` | **1** — the notice opens, correctly |
| `[data-whatsnew-older]` | **0** — the new line is not on the screen |
| `window.__whatsNewTest.olderUnseen()` | **0** |
| page errors | none |

The modal's `innerText` came back **byte-identical to the block quote in `AUDIT-app-v84-delta3.md`
FINDING E** — the screen that pass called out is the screen that ships, unchanged.

**The arithmetic itself is right, and I bent it in every direction.** Same fixture, marker varied:

| marker written | `[data-whatsnew-older]` | rendered sentence |
|---|---|---|
| `app-v83` (one behind) | absent | — (correct: nothing to say) |
| `app-v82` | `1` | *One earlier update you have not seen is under “See recent updates”.* |
| `app-v81` | `2` | *2 earlier updates …* (7h's case) |
| `app-v80` | `3` | *3 earlier updates …* |
| `app-v79` / `not-a-version` | `4` | *4 earlier updates …* (`idx === -1` → counts all five, minus the one on screen) |
| `app-v84` (newest) | no modal at all | — |
| `''` / removed | absent | — (the release case above) |

No off-by-one in either direction, the singular branch is grammatical, the sentence quotes the
button **character for character** (`See recent updates`), and the count is version-agnostic — add an
entry at the top of `CHANGELOG` and 7h's expected `2` stays `2`, so no version literal is pinned.
**The code is good. It is simply unreachable this cycle.**

**Where the record says otherwise.** The discovery is documented at `index.html:9036-9044` and in
commit `2c06828`'s message — *"that phone gets the notice and no 'earlier updates' line"*. That
commit lands **after** all three records, and none was revisited:

| file:line | what it says | true on this release? |
|---|---|---|
| `outputs/DESIGN-app-v84.md:133-134` | *"On a real phone sitting on app-v80 it will read `3`."* | **No.** It renders nothing. |
| `README.md:14` | *"…every installed phone opens to one card headed **UPDATED** … told nothing about the other three … **The notice now carries one line** — *'2 earlier updates you have not seen…'*"* | **No.** Not on any phone in this rollout. |
| `outputs/ENHANCER-app-v84.md:112` | *"This release ships four versions to a phone sitting on app-v80, and **without this line** the screen tells a caregiver about one of them and closes."* | Reads as fixed; it is not. |

`git log 6339aee..c9c4388 -- README.md` → one commit, `7187a9c`, three commits before the discovery.
The Designer addendum is `876dd52` and the Enhancer addendum `1010348`, both earlier still.

**Why this is a block and not a note.** Delta 3 blocked this release on a sentence that claimed a
guarantee the code did not have, and was right to. This is the same sentence one level out: a
Designer report stating a specific rendered value for a case that cannot occur, and a README telling
the owner his phone will show a line it will not show. He will open the app after this ships, see
the single **UPDATED** card that delta 3 objected to, and the record will have told him it was
fixed. That is round six, bought for the price of not editing three paragraphs.

**Two ways to clear it, and the second is Aaron's, not mine.**

1. **Correct the three records** — say the line is future-facing: it fires for a phone that has a
   marker and is two or more releases behind, which begins with the release AFTER this one, and on
   this rollout every phone is silently stamped and shown the newest card alone. Three sentences,
   no code, nothing to re-run. **This is what the block requires.**
2. **Optionally, and only if Aaron wants it:** the app does know this is an upgrade —
   `deviceHasPriorChemoWellData()` is exactly that fact — so a phone with prior data and no marker
   could be told something true without inventing a number: *"Earlier updates are under 'See recent
   updates'."* The code comment's argument (*"a number invented for it would be the same class of
   defect"*) is honest **about the number** and then quietly answers a narrower question than
   FINDING E asked: it rules out a count, not a sentence. That is the rationalisation, and it is a
   small one. It is a product change, it needs its own check and a Designer look, and delta 3 already
   put FINDING E in Aaron's hands. **My recommendation is 1 now and 2 as his call.**

---

## FINDINGS

### FINDING H — **7h passes on a build that prints the wrong number to the caregiver.** This is the thirteenth mutant.

The brief asked whether 7h can be made to pass on a build where the line is wrong. **Yes.** 7h reads
the count off `data-whatsnew-older` (`test/v84-whatsnew.mjs:661-662`) and checks the rendered
sentence only against `/See recent updates/i` (`:668`). The attribute and the sentence are written
from the same `n` in the shipping build, but nothing requires them to agree.

Mutant, on a private clone of HEAD, one character group changed at `index.html:9124`:

    (n + ' earlier updates you have not seen are under …')
    →  ((n + 1) + ' earlier updates you have not seen are under …')

**`node test/v84-whatsnew.mjs` → 80 checks, 80 passed, 0 failed**, while the live DOM reads:

| marker | attribute | what the caregiver reads |
|---|---|---|
| `app-v81` | `2` | **"3 earlier updates you have not seen are under “See recent updates”."** |
| `app-v80` | `3` | **"4 earlier updates …"** |

This release exists because a screen was true sentence by sentence and false as a whole, and its
newest check validates a hook nobody can see while the sentence a person actually reads goes
unread. One assertion closes it — require the visible text to contain the expected count, e.g.
`new RegExp('\\b' + 2 + '\\b').test(shown.text)` alongside the attribute check — and the mutant
above belongs in `falsify/mutants-v84-whatsnew.sh` as **mutant 13**.

*(7h is not circular, which the brief asked me to confirm. The expected value is the literal `2`,
reasoned from "4th-newest marker ⇒ three newer ⇒ minus the one on screen", not read off
`window.__whatsNewTest.olderUnseen`. That hook is exposed at `index.html:12727` and **no check uses
it at all**. The comment at `:639-641` says the count is "computed here from the app's own
CHANGELOG"; it is a hand-reasoned literal, which is stronger, not weaker — the comment is imprecise
and the check is sound.)*

### FINDING I — two more surviving mutants on the same line: the singular branch and the not-in-list branch

Both built on private clones of HEAD, both **80/80**:

| mutant | edit | what ships undetected |
|---|---|---|
| **14** | `index.html:9050` `idx === -1 ? CHANGELOG.length : idx` → `? 0 :` | The branch the comment at `:9038-9040` documents — an old phone, or a changelog that has been trimmed — silently says nothing instead of counting every entry. This branch becomes live the first time `CHANGELOG` is trimmed, which it must be: it holds five entries for an eighty-four-release app. |
| **15** | `index.html:9123` `n === 1` → `n === 0` | The singular branch is never reachable, so a phone one-and-a-bit behind reads **"1 earlier updates you have not seen are under …"**. The singular sentence is not rendered by any check in the suite. |

7h exercises exactly two values of `n` — 2 and 0. Three of the function's four behaviours (singular,
not-in-list, and the release's own no-marker case) have no check at all.

### FINDING J — `falsify.sh`'s new "did it actually run" guard is applied to every mutant and not to the baseline

The three-way scoring is right and I verified the logic reads correctly under `set -euo pipefail`
(`_ran=0; echo "$OUT" | grep -q "checks:" && _ran=1` does not trip `-e` when the grep misses —
tested). COULD NOT MEASURE increments `ALIVE`, so it fails the sweep, which is what the brief asked
me to confirm.

But `falsify.sh:65-71`:

    BASE=$(run_suite)
    echo "$BASE"
    if echo "$BASE" | grep -q "^  FAIL"; then … exit 1; fi

**The baseline is tested for a red and not for a summary.** The commit's own argument is that *"a
summary line is what says the suite RAN"* — and the one run every other verdict is calibrated
against is exempt from it. A baseline that dies before printing anything (a page that never loads,
`freshPage`'s `no prefs key to set up against` throw) produces no `FAIL` and no `checks:`, passes the
gate, and the sweep proceeds against a build it never measured. It then fails loudly downstream — all
twelve mutants would score COULD NOT MEASURE — so this is a clarity defect rather than a false green.
One line: require `checks:` in `$BASE` too.

---

## WHAT I WAS SENT TO RE-CHECK, ITEM BY ITEM

### BLOCK A (7f overstated itself) — **CLOSED, and I attacked it in both directions**

The sentence delta 3 refused on is gone. `test/v84-whatsnew.mjs:697-712` now says the opposite in as
many words: *"It is a corpus, not a proof about English. A phrasing outside it can still get through,
and the answer when one is found is to add it here — not to widen the sentence describing what this
does."* The README carries the same correction.

I re-ran the attack offline against the eight-alternative pattern with **30 completeness claims and
21 innocent sentences** of my own writing:

- The exact surface delta 3 demonstrated — *"Every update ChemoWell has ever shipped. Nothing has
  been left out."* — is now **caught**.
- **27 of my 30 phrasings are still missed** (*"The whole history."*, *"Every single update."*,
  *"Nothing has been skipped."*, *"A comprehensive list of updates."*, *"Exhaustive list of
  changes."*, *"The complete update history."* …).
- **5 of my 21 innocent sentences false-red**: *"View all updates to your medication list on the
  Meds screen."*, *"Nothing is missing from your medication list."*, *"Every version of this
  medication is listed on the Meds screen."*, *"Nothing was left out of your export."*,
  *"Everything that changed on this screen is saved."*

**None of that contradicts anything the file now says, so it is not a block.** It is the documented
shape of a corpus check. One thing is worth writing into the record though, because it is not
obvious: the CHANGELOG entries themselves render **inside** two of the three scopes 7f reads, so a
future release note describing an unrelated feature in any of those five innocent wordings will turn
7f red for no defect. A false red is loud and cheap to fix, but the next person should know it is
the changelog prose — not just the headings — that the pattern is policing.

**The `aria-label` reading works on all three scopes.** `readScope` (`:751-758`) covers the modal and
the screen; the drawer row at `:774-782` now does the same thing inline because it is located by
text rather than by selector. Verified behaviourally rather than by reading: the sweep's **mutant
11** plants a claim in `renderWhatsNewModal`'s own `aria-label` with nothing visible changed, and it
dies (below).

### FINDING D (the sweep's gap) — **CLOSED.** Twelve mutants, and I ran the sweep myself, alone

I ran `FALSIFY_PORT=8971 ./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh` **alone**
— nothing else was listening on any port, load average 0.22 on 4 cores when it started, no browser
work beside it — start to finish, 19 minutes:

    === 12 mutant(s) caught, 0 survived     (exit 0)

Baseline green (the script exits 1 on a red baseline and did not). Twelve distinct failure
signatures — 3, 1, 2, 7, 16, 1, 1+abort, 1, 1, 1, 3 reds across mutants 2–12 — which is independent
evidence that `find "$WORK" -mindepth 1 -delete` really does rebuild the clone under the running
server rather than every mutant dying for want of a page.

**The three new mutants all die on the right check**, and they close delta 3's FINDING D exactly:

| mutant | the red it produces |
|---|---|
| 10 — button reverted to `'See all updates'` | `FAIL and the notice claims nothing about being complete \| See all updates` |
| 11 — a claim in the modal's `aria-label`, nothing visible changed | `FAIL and the notice claims nothing about being complete \| Every update ChemoWell has ever` |
| 12 — the count forced to zero | three reds in 7h, including `and the number is the count … \| no line` |

Mutant 11 is the one that matters most as evidence: it proves `readScope`'s `aria-label` reading is
a real widening and not a silent no-op.

**And the new three-way scoring is exercised in practice, not just in theory.** Mutant 8 printed its
one correct red, aborted before any summary, and the sweep labelled it:

    ℹ️  CAUGHT, but the suite ABORTED after its first red -- the counts above are partial.

That is delta 3's FINDING F closed, visibly. See FINDING J for the one place the new guard is not
applied.

### FINDING C (the fling comment) — **the claim is true, and I found where it stops being true**

Measured myself, sampling `scrollY` from `touchEnd` on both builds, md5 of each served file checked
against disk first:

| ms after `touchEnd` | 0 | 50 | 100 | **150** | 250 | 400 | 600 | 900 | 1400 | **1950** |
|---|---|---|---|---|---|---|---|---|---|---|
| **shipping build** | 653 | 890 | 1105 | **1298** | 1543 | 1543 | 1543 | 1543 | 1543 | **1543** |
| **mutant 9** (touchmove deleted) | 668 | 945 | 1192 | **1408** | 1321 | 912 | 216 | 133 | 333 | **363** |

**The corrected comment is right on both counts.** The 60ms hold does not cancel the fling — the page
travels **+890px** after the finger lifts on the shipping build, larger than the 227–362px delta 3
measured because I sample from `touchEnd` rather than later. And momentum is strictly one-directional:
it only ever raises `scrollY`, while the defect drags it down 1408 → 133. `after >= before - 40`
cannot be satisfied by momentum. With `before` sampled where the suite samples it (+150ms), mutant 9
gives `363 >= 1368` → **FAIL**, a ~1,000px margin against a 40px tolerance.

**What the comment does not say, and the next person should know.** The check's soundness rests on
the *ordering* of the `before` sample against the nudge's animation, not on momentum alone. The
defect is fully expressed by +600ms; the sample is taken at +150ms; that is ~450ms of headroom. Push
the sample far enough late and the assertion flips: at **+1400ms** on mutant 9, `before` = 333 (which
also clears the `before > 300` precondition) and `after` = 363, so `363 >= 293` → **PASS on the
defective build, with every precondition green.** That needs a ~10x slip on a 150ms wait, and at
+600/+900ms the `before > 300` precondition goes red first and loudly — so this is a narrow residual,
already mitigated by the "RUN THIS ALONE" warning `falsify.sh` gained in this same delta. It is not a
block. It is the reason that warning has to stay.

### FINDING B (the README's figures) — **every figure in the app-v84 row checked one at a time**

| claim in the row | measured by me |
|---|---|
| `test/v84-whatsnew.mjs` **80/80** | 80 checks, 80 passed |
| `test/v83-meds-and-reports.mjs` **80/80** | 80/80 |
| `test/v80-up-next.mjs` **48/48** | 48/48 |
| `test/v75-no-other-patient.mjs` **27/27** | 27/27 |
| `test/v82-vitals-strip.mjs` **41/41** | 41/41 |
| `test/v82-timeline.mjs` **24/24** | 24/24 |
| `test/v82-back-button.mjs` **15/15** | 15/15 |
| `test/v76-properties-equivalence.mjs` **22/22** | 22/22 |
| `test/v76-empty-window-render.mjs` **13/13** | 13/13 |
| `sw.js` CACHE → `chemowell-app-v84-11` | `sw.js:1` — match |
| `APP_VERSION` → `app-v84` | `index.html:8978` — match |
| "eighteen wordings that must be caught, twelve innocent ones that must not" | suite prints `18/18` and `12/12` |
| "Twelve mutants swept, twelve caught, none survived" | my sweep: 12 caught, 0 survived |
| "It reads `aria-label`s as well as visible text" | true on all three scopes now |
| "the changelog holds five entries for an eighty-four-release app" | `CHANGELOG.length === 5` |

**The figures are right this time.** The one claim in the row that is not is the *behavioural* one
about the new line — BLOCK A2 — and the stale `50/50` noted in housekeeping below.

### The Designer addendum 2 and the Enhancer addendum — **real work, and I re-measured it**

I did not take the addendum's numbers on trust. Driven myself at all three widths against the clean
export, with the marker set so the line renders:

| | 320 | 360 | 390 |
|---|---|---|---|
| `document.scrollWidth` vs viewport | 320 = 320 | 360 = 360 | 390 = 390 |
| elements past the right edge | 0 | 0 | 0 |
| text controls under 16px · buttons under 44px | 0 · 0 | 0 · 0 | 0 · 0 |
| attributes carrying the literal `"null"` | 0 | 0 | 0 |
| page errors | 0 | 0 | 0 |
| the line fully inside the viewport | yes | yes | yes |
| the notice scrollable? (`max-height` = 675px) | **no** — card 569px | no — 549px | no — 488px |

Every one matches. I also opened `whatsnew-older-320.png` and `whatsnew-older-390.png` and they show
what the addendum describes: the line between the entry card and the two buttons, in quiet grey,
wrapping to two lines at 320, reading as a footnote rather than a second headline, and quoting
*"See recent updates"* character for character against the button below it.

**The Enhancer addendum is a real pass and reaches the right conclusion about the number.** Question 3
— *does this figure belong on the screen at all* — is the one this project deleted *"Averaging 5.6 L
per procedure"* over, and this count survives it for the reason the addendum gives: it is a count of
discrete things a person can go and read, not an average of events that accumulate, and it changes
whether they tap *"Got it"* or *"See recent updates"*. I agree; it is not decoration.

**Both addenda carry the same false sentence about the app-v80 rollout** (BLOCK A2). That is the only
thing wrong with either.

---

## VERIFIED CLEAN

**All nine gating suites, run by me one at a time against a clean `git archive HEAD` export on port
8951**, md5 of the served file checked against disk before believing anything, nothing else listening
when I started: **80/80 · 80/80 · 48/48 · 27/27 · 41/41 · 24/24 · 15/15 · 22/22 · 13/13.** No reds
anywhere, no page errors in any run.

**Rule 0 — clean across the whole delta.** No patient name anywhere (`grep -i brandi` over the full
diff → nothing). No gendered pronoun on any added line including code comments — the single
`grep -inE '\b(she|her|...)\b'` hit is delta 3's report quoting its own grep pattern. No care-plan
dose, ceiling or schedule added; the *".5 mg counted as 5 mg"* text is the already-shipped changelog
entry, a generic parsing example, not anybody's prescription. No new behaviour keyed to a medication
id — the delta's `index.html` change contains no medication name at all.
**`test/v75-no-other-patient.mjs` is untouched by the delta** (`git diff --stat` confirms) and runs
**27/27** with `found 0/0/0, pinned at 0/0/0`. The ratchets did not move.

**Temporal dead zone — safe, and I checked the specific hazard the brief names.**
`whatsNewOlderUnseenCount` (`:9047`) is a **function declaration**, so it is hoisted; it reads
`CHANGELOG` (`const`, `:8984`) and calls `whatsNewSeenVersion` (`:9053`), also a function
declaration, never a `const` arrow. Its only call sites are `renderWhatsNewModal` (`:9119`), which
runs inside `render()`, and the debug hook at `:12727`, which is a reference and not a call and which
sits last in the module. The only module-evaluation-time call in this region is
`state.whatsNewOpen = whatsNewShouldShow()`, and that is **below** both `const APP_VERSION` (`:8978`)
and `CHANGELOG`. Zero page errors across roughly twenty browser runs in this pass, including five
private clones.

**The `h()` null trap is handled the way the rest of the file handles it.** `h()` at `:4064` skips
children on `child == null || child === false` (`:4085`), so the IIFE returning `null` when the count
is zero appends nothing — confirmed on a live page: `[data-whatsnew-older]` count **0**, no stray
node, no error. The attribute is `String(n)` and `n` is `>= 1` whenever the element is built, so it
can never carry the literal `"null"`; `test/v83-meds-and-reports.mjs`'s three "literal null" checks
are 0-found and my own sweep over the modal found 0 at all three widths.

**No version literal pinned in any new check.** 7h derives its marker from `CHANGELOG[3]` at runtime,
so adding an entry at the top leaves its expected `2` correct. **No assertion on
`document.body.textContent`** anywhere in the suite; the only occurrences are comments saying why not.
No `|| true` added to a check path, no TODO/FIXME.

**`./release_check.sh` refuses, correctly**, on four standing chain refusals — `AUDIT-app-v84-delta.md`
(`c70e06d`), `-delta2.md` (`3c8365f`), `-delta3.md` (`6339aee`) and `PM-app-v84.md` (`3ec6b4c`). This
report is a fifth. **The PM gate has still examined nothing later than `3ec6b4c`, which is sixteen
commits back**, and clearing the audit half does not clear it. The gate also warns that 31 commits
have changed `index.html` since the `app-v80` baseline and assumes none are live; I verified the
half that mattered to me — `git show 048c1ff:index.html` has no `whatsNew*` anything — but not the
general assumption.

---

## HOUSEKEEPING — none of this is in the verdict

1. `README.md:14` still carries `test/v84-whatsnew.mjs` **50/50** mid-row, from an earlier point in
   the narrative, three sentences above the final block that correctly says **80/80**. The row is
   written as an accreting story so it is not strictly false, but it is the first figure a scanning
   reader hits, and this row has now been wrong about its own headline number twice.
2. The README row does not mention `falsify.sh`'s new three-way scoring at all, though it describes
   the two earlier `falsify.sh` fixes. The most recent change to the instrument is the one missing.
3. `test/v84-whatsnew.mjs:639-641` says the expected count is *"computed here from the app's own
   CHANGELOG"*. It is a hand-reasoned literal `2`. That is stronger than computing it — but the
   comment describes something the code does not do, which is the exact habit this release is trying
   to break.
4. `window.__whatsNewTest.olderUnseen` (`index.html:12727`) is exposed and **used by nothing**. 7h
   reads the DOM instead. Harmless; either use it as a cross-check against the rendered text (which
   would also close FINDING H) or drop it.
5. 7f's five new false-red wordings matter more than they look: CHANGELOG entry text renders *inside*
   two of 7f's three scopes, so a future release note saying *"View all updates to your medication
   list on the Meds screen"* will turn 7f red for no defect. Loud and cheap, but worth knowing.
6. `harness-v84-whatsnew.py` does not build `whatsNewOlderUnseenCount`, so this line is not
   reproducible from base + patch. Delta 3 documented this as the pre-existing shape of
   reproducibility in this repo; I am recording it, not re-raising it.

---

## WHAT I RELIED ON RATHER THAN RE-DERIVING

- `outputs/AUDIT-app-v84.md`, `-delta.md`, `-delta2.md` and `-delta3.md` for everything up to
  `6339aee`, as instructed. In particular I did not re-derive the cause-based scroll guard's
  analysis, the `restoringFocus` re-entrancy argument, or delta 3's four-local-hours run of
  `test/v82-timeline.mjs` — I ran that suite once, green, and took the clock analysis as given.
- What the nine suites assert about app-v81/82/83 behaviour. I ran them; I did not re-derive them.
- Delta 3's FINDING 2 (the rebuild script) and FINDING 5 (the ten non-gating suites with unfrozen
  clocks). Not re-checked.

## WHAT I DID NOT CHECK

- **Anything iOS.** Chromium only: no on-screen keyboard, no Safari, no real momentum on a phone, no
  visual-viewport behaviour. Sharper than usual here because the release's centrepiece is a touch
  gesture guard. **Nobody has seen v81, v82, v83 or v84 on a device.**
- Whether any of the 31 commits since the `app-v80` baseline are already live, beyond confirming that
  the recorded baseline build contains no what's-new code.
- `sync-backend/`, `.github/workflows/`, `capacitor.config.ts`, `package.json` — untouched by this
  delta.
- The ten non-gating suites, and the other ~45 files in `test/`.
- `harness-v85-temperature-report.py` / `harness-v86-symptom-bars.py` and their order-dependence.
- The Designer PNGs from app-v83 and earlier, and the six app-v84 PNGs other than the two I opened.
- Whether the *product* decision in BLOCK A2's option 2 is the right one. That is Aaron's.

---

## WHAT THE BUILDER SHOULD DO

1. **BLOCK A2** — `outputs/DESIGN-app-v84.md:133-134`, `README.md:14`, `outputs/ENHANCER-app-v84.md:112`:
   say that the line is future-facing and that on this rollout every phone is stamped silently and
   shown the newest card alone. **Three sentences. No code, no version, no cache key, no suite.**
   Then hand Aaron option 2 as his call.
2. **FINDING H** — one assertion in 7h: the *visible sentence* must contain the expected count, not
   just the data attribute. Add the mutant (`n` → `n + 1` in the text only) as mutant 13 and watch it
   die.
3. **FINDING I** — mutants 14 and 15 (`idx === -1` → `0`; `n === 1` → `n === 0`), and a 7h case for
   each: a marker that is not in `CHANGELOG`, and a marker two releases back so the singular sentence
   is rendered at least once.
4. **FINDING J** — `falsify.sh`: require `checks:` in `$BASE` as well, so the baseline is held to the
   standard the same commit imposes on every mutant.
5. **FINDING C** — optional, one sentence in 7g: the check also depends on `before` being sampled
   while the fling is still running, which is why the sweep must run alone.
6. Then **the PM re-runs.** Its refusal at `3ec6b4c` is sixteen commits stale and stands on its own.

---

## WHAT WOULD ACTUALLY HARM A CAREGIVER

**Nothing I found.** The shipped behaviour of this delta is a no-op on every phone that will receive
app-v84, the nine suites are green, Rule 0 is clean, and the arithmetic behind the new line is
correct in every direction I bent it. If the question were "is the app safe to ship", the answer is
yes and I would say so without hesitation.

What I am refusing is the **record**: a Designer report that states a rendered value for a case that
cannot occur, a README that tells the owner his phone will show a line it will not show, and a new
check that goes green while the sentence a person reads carries the wrong number. This release has
been blocked four times, three of them for exactly this — an instrument or a comment claiming more
than the code does — and it is cheaper to spend ten minutes on three paragraphs than to ship a record
that guarantees a sixth round the first time Aaron opens the app.

---

Measured in Chromium against a clean `git archive HEAD` export of `c9c4388` on port 8951, five
private mutant clones on 8961/8962/8963/8981 and `falsify.sh`'s own clones on 8971. The md5 of the
file each port served was compared against the file on disk before any result was believed. The
sweep was run alone, with nothing else listening and load average 0.22 on 4 cores.
**No file in the repository was modified by this pass except this report.**
