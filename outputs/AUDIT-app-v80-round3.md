AUDITED-COMMIT: 25889d19de4a3df04bb9dfc25e9d32cb3f667748
VERDICT: SHIP

# Zero Day Audit — app-v80 round 3, "Up next" on Home

## The headline, in plain words

**The button works now. I could not break it, and I went looking for the fourth door.**

Three rounds blocked this release on the same control. Round 3 fixes it, and the fix is real rather
than moved: with the Quick log section collapsed, tapping the hero opens the section, **the page
actually scrolls** (measured: 828px → 1,068px, the card sitting 389px down a 900px screen), and
exactly one card lights up. I mutated the fix out and the suite went red. I then hunted for another
way the hero can name a medication whose card is not on the screen — a group that is itself
collapsed, a filter, a search box, a card hidden for some other reason — **and there is not one.**
The morning/afternoon/evening group cards are drawn outside the collapsible section, so the chevron
cannot hide them; and every reason Home hides a standalone card is a reason the hero already refuses
to name that medication.

**One thing in this release IS untrue, and it is in the README row Aaron reads.** The row says the
missed-dose banner needed `minWidth: 0` because *"a wrap alone would have changed nothing."* I
measured both halves separately. Take the `minWidth: 0` away and keep the wrap: **the page is
clean, 38/38.** Take the wrap away and keep `minWidth: 0`: **the page goes to 620px on a 320px
phone.** The wrap alone is the entire fix; `minWidth: 0` alone does nothing. The behaviour that
shipped is correct — both are set — but the sentence explaining it is exactly backwards, and this is
the third release running with a claim in the notes that nobody measured. **Correct that one
sentence before the release message goes out.** It is a doc edit, not a code change, which is why
this is a condition rather than a fourth block.

**And 22 is the wrong number for the button.** A real 22-character medication name —
*Mycophenolate Mofetil2* — still runs off the end of the button and gets cut to an ellipsis at
320px **and** at 360px. It is one line high and the card no longer collides with the tab bar, so the
problem round 2 found is genuinely gone; but "Go to Mycophenolate Mo…" is not what the code intends.
Roughly 14 characters is the real limit at 320px. Follow-up, not a block.

---

## What I checked, and how each claim was falsified

Every mutation below was made to `index.html`, run, and reverted from a byte-identical copy.
`md5` proof and `git status` at the bottom.

### 1. The round-2 BLOCK — the collapsed Quick log

| Question the brief asked | Answer, measured |
|---|---|
| Is `setState` really synchronous through to the DOM? | **Yes.** `setState` calls `render()` inline, and `render()` ends with `root.innerHTML = ''; root.appendChild(page)`. The element exists on the next line. |
| Does the fix bite? | **Yes.** Delete the reopen branch → `v80-up-next` **37/38**, "tapping it opens the section and marks the card | null". |
| Does the page actually *move*, or does it only mark a card the caregiver cannot see? | **It moves.** With ten padding medications below it: scrollY 828 → 1,068, page height 1,728 → 3,160, target card top 389px in a 900px viewport. Visible. |
| What if the medication lives in a GROUP and the group is hidden? | **A group can never be hidden.** The three grouped cards are pushed to the page *after* the Quick log `<section>` closes, not inside it — the chevron only ever removes the standalone grid. Verified live: group-only medication + Quick log collapsed → the Evening group is marked, scrollY 399, and the section is correctly *not* reopened because it did not need to be. |
| Any other door — a filter, a search box, a scrolled-away tab? | **None found.** Home's card grid has no filter and no search. The only two ways a standalone card is withheld are `treatmentOnlyBlocks()` and `treatmentOnly && courseComplete` — and `nextDueDose` skips a medication for both of those before it can name it. The hero only renders on Home, so there is no cross-tab case. |
| A medication with its own card *and* a group — which lights? | The standalone card, and only it. The standalone selector is tried first, so the group is never the landing place while its own card is on the page. |

### 2. One card lights up, not two

`state.medFlash` is `{ id, group }` and there are exactly three readers. All three agree on the
shape — I grepped for a surviving `state.medFlash === ` and there is none.

- Revert the group test to id-only → **37/38**, "and exactly one of them is marked | 2 marked".
- **Group keys cannot collide.** `renderGroupedMedsCard` is called from exactly three places with
  three hardcoded titles — *Morning meds*, *Afternoon meds*, *Evening meds* → `morning-meds`,
  `afternoon-meds`, `evening-meds`. The title is never user-supplied, so a mid-flash title change
  cannot happen; and if it somehow did, the mark simply would not draw — the 1.8s timer keys on
  `.id` alone and still clears it. **No permanent mark is possible.**
- The timer still clears: tap, tap again at 300ms, 1 card marked; 1.8s later, **0**.

**One new guard has no fixture and I could not make it matter.** Reverting the standalone card's
`&& !state.medFlash.group` leaves the suite **38/38**. It is unreachable-equivalent rather than
untested behaviour: the standalone selector always wins over the group selector, so a landing on a
group can never coexist with that medication's own card being on the page. Defensive code, fairly
placed — just say so rather than counting it as protected.

### 3. Contrast — the check is real, and here is where it is thin

It measures. Two falsifications, both bite:

- Old first gradient stop back (`#E4693B`) → **5/10**, five strings at 3.29:1.
- One string back to `rgba(255,255,255,0.88)` → **9/10**, that string at 4.01:1.

**I recomputed the headline number by hand rather than trusting the suite.** Pure white on
`#C44E1C` = **4.715:1**; the suite reports 4.72. The arithmetic is right, and the large-text
threshold is right (24px, or 18.66px with weight ≥ 700 — the WCAG definition). **So "clears AA" is
true this time.** The margin is thin: 4.72 against 4.50.

Two honest limits, neither a block:

- **It only understands a background on the text element itself.** The ground is the lightest
  gradient stop unless the element carrying the text has its own `backgroundColor`. Put a lighter
  background on an element *between* the text and the hero, or use a background *image* on a child,
  and the suite measures against the hero gradient and flatters a real failure. Today's card is
  flat, so this is a future hole, not a present one.
- **It can only ever see the orange hero.** Its fixture forces one medication due now. The green
  *"All scheduled doses are in"* card shares the same `data-home="up-next"` hook but paints a flat
  colour, so pointed at a finished day the suite's first check ("at least two gradient stops")
  would fail rather than measure. A contrast regression in the all-done card is invisible to it.

The ring's ground choice is **conservative, not flattering**: the "0/1" and "DOSES" strings actually
sit on a `rgba(155,60,25,0.92)` disc, which measures 5.8–6.7:1 in reality against the 4.72 the suite
credits them with.

### 4. The hero button — where 22 breaks

Measured with a real name, not a synthetic one. Button height is **48px in every case**, at every
width, so the five-line paragraph round 2 found is gone and the card is 185 / 211 / 238px for a
normal / 22-char / 99-char name — well clear of the tab bar.

| Name | 320px | 360px | 390px |
|---|---|---|---|
| `Ondansetron` (11) | fits | fits | fits |
| `Mycophenolate Mofetil2` (22) | **cut to "…"** | **cut to "…"** | fits |
| 99-character pasted name | *Show me the card* | *Show me the card* | *Show me the card* |

The button has 252px of room at 320px and "Go to " eats ~48px of it, so the honest threshold is
around 14 characters, not 22. **The destination is correct in every case** — standalone, collapsed,
grouped, and long-name — so this is cosmetic.

### 5. The missed-dose banner wrap

**Nothing else on the app overflows.** With the 62-character unbroken name, at 320 / 360 / 390, on
**Home, Meds, History and Reports**: page width equals viewport width and the bottom nav equals
viewport width on all twelve combinations. No sideways scroll anywhere.

But, as above: `overflowWrap: 'anywhere'` is the whole fix and `minWidth: 0` is inert.

| Mutation | Result |
|---|---|
| remove `minWidth: '0'`, keep the wrap | **38/38 — no overflow** |
| remove `overflowWrap`, keep `minWidth` | **37/38 — page 620px at 320px** |

(That 620px figure independently confirms the README's own measurement of the broken state.)

### 6. `.github/workflows/verify-live.yml` — a Rule 5 path, and it is sound

- **`--no-save` does not dirty anything.** I ran the exact command against a copy of this repo's
  `package.json` and `package-lock.json`: both files came back **byte-identical by md5** after
  `npm install --no-save --no-audit --no-fund playwright@1.56.1`, and `node_modules/playwright`
  reports **1.56.1**. Nothing for a later step or the Android build to notice.
- **The suites will resolve it.** `test/*.mjs` uses `createRequire(import.meta.url)` and tries bare
  `'playwright'` first, which walks up from `test/` to the repo-root `node_modules`. That is exactly
  where this step installs it.
- **`/opt/pw-browsers/chromium` never reaches the runner.** Two files hardcode that path —
  `test/overflow-scan.mjs` and `test/audit-delta6-restore-day-probe.mjs` — and `release_check.sh`
  runs neither. The gate runs `v76-properties-equivalence`, `v76-empty-window-render` and
  `v75-no-other-patient`, and starts its own `python3 -m http.server 8899` first, so no server step
  is missing from the workflow either.
- **Can this make the gate GREEN when it should be red?** I could not find a way. The install step
  is `set -euo pipefail`, so a failed install fails the job rather than falling through to a pass;
  the chain step still `exit 1`s on a refusal; and `fetch-depth: 0` only makes the `PUBLISHED.json`
  baseline resolve, which makes the cache comparison *stricter*, not looser.
- **Stated plainly: I cannot run a GitHub runner from here.** The YAML is reviewed and the npm
  behaviour is measured locally. Whether `npx playwright install --with-deps chromium` succeeds on
  `ubuntu-latest` is the one thing that must be confirmed by watching the first run go green.

### 7. The two suite repairs

- **`v79-warning-priority`, clock frozen at 10:00 — it did NOT go vacuous.** Break the batch rule
  (`if (warnBatch && warnBatch.red) return;`) and the suite drops to **8/14**, naming the real
  defect: *"Tylenol first, then Iron → the caregiver sees the RED ceiling warning | amber"*. Six
  checks discriminate.
  One mutant survives: `warnings.find(w => w.tone === 'red') || warnings[0]` → `warnings[0]` stays
  14/14. That is unreachable rather than untested — the red ceiling and volume warnings are pushed
  into `warnings` before any amber one, so within a single `afterLog` call the first entry is
  already the red. The order-dependence that actually hurt a caregiver lives across the batch, and
  that is the half with six checks on it.
- **`v72-med-purpose`, re-anchored to `renderGroupedMedsCard`.** Delete the wrapping rule from that
  section and it goes **63/64**. The `{0,4000}` bound does not let it wander: with the rule gone
  there is no other `return h('section', { … overflowWrap: 'anywhere'` inside the window, which is
  precisely why the mutant goes red instead of matching something else.

---

## Round 2's clearances, re-confirmed on this commit

- **Write model unchanged.** Every added line of `index.html` in this commit searched for
  `addEntryDB`, `removeEntryDB`, `setPrefsDB`, `localStorage`, `sessionStorage`, `setItem`,
  `removeItem`, `fetch(`, `XMLHttpRequest`, `logMed`, `confirmTimeAndLog` and assignment to
  `state.entries`: **zero matches.** Nothing here creates, changes or destroys a record.
- **Rule 0 still clean.** No patient name, no gendered pronoun, no care-plan dose/ceiling/schedule,
  and no new branch keyed to a medication id anywhere in the diff — including the README row.
  `v75-no-other-patient` **27/27**, ratchet unmoved.
- **The h() null-attribute trap has not returned.** `data-flash` is written only inside an `if`, and
  the suite asserts that no element carries the literal string `"null"`.

## Everything green on the audited commit

`v80-up-next` 38/38 · `v80-contrast` 10/10 · `v79-warning-priority` 14/14 · `v72-med-purpose` 64/64 ·
`v75-no-other-patient` 27/27 · `v75-table-builder` 96/96 · `v76-properties-equivalence` 22/22 ·
`v76-empty-window-render` 13/13 · `v77-legacy-migration-equivalence` 36/36 · `v78-fence-removed`
20/20 · `v79-home-cards-render` 20/20 · `v80-pixel-identity` clean. No page error in any fixture.

Known-red and **not made worse** by this commit — unchanged from the app-v79 file: `audit-v55` (3),
`pm-v55` (1 @360), `pm-v55b` (2 @360), `v57-browser-notice` (17), `v74-shipped-audit-probe` (3),
`audit-v55b` cannot start.

---

## VOICE

| String | True? | Verdict |
|---|---|---|
| `Go to [name]` | Yes — reaches the card in all four states I tested | OK |
| `Show me the card` (name > 22) | Yes, and plain enough at 2am | OK |
| `Go to Mycophenolate Mo…` at 320/360 | Not untrue, just cut off | Finding 2 |
| README: *"Home measured 620px"* | **Confirmed** — my own mutant measured 620px | OK |
| README: *"the label clears AA"* | **Confirmed** — 4.715:1 recomputed by hand vs 4.5 needed | OK, and a welcome change from round 2 |
| README: *"38 checks", "10 checks"* | **Confirmed** — 38/38 and 10/10 | OK |
| README: *"a wrap alone would have changed nothing"* | **FALSE, measured both ways** | **Must be corrected** |
| README: *"655px in the sibling app"* | Cannot be checked from this repo | State it as reported, not as measured here |

No new number about a patient is printed by this round.

## DESIGNER — 320, 360, 390

**This sandbox has Chromium only. An iPhone's font metrics, its rendering and its safe-area insets
cannot be reproduced here — the hero must be opened on the two real phones before anyone calls it
verified.** Screenshots in `outputs/v80-audit-r3-shots/`.

- No horizontal overflow on Home, Meds, History or Reports at any of the three widths, with a
  62-character unbroken medication name on the screen.
- Hero height 185 / 211 / 238px for a normal / 22-character / 99-character name; the button is 48px
  at every width and every length.
- The hero still sits below the fold behind the "You're using the web preview" notice in the browser
  build. Dismissible, absent in the Capacitor wrap — noted, not filed.

## ENHANCER

Nothing to propose. This round is three corrections and two repairs; widening it would be wrong.

---

## What should happen with this release

1. **Ship it**, and
2. **fix the one false sentence in the README row first** — `minWidth: 0` is not what fixes the
   banner, the wrap is. One sentence.
3. Follow-up release: lower the button's name threshold from 22 to about 14, or measure the text
   instead of counting characters.
4. Follow-up: the contrast suite cannot see the all-done card and cannot see a background on an
   ancestor. Worth a line in its own header so the next reader does not over-trust it.

---

*Restoration: `index.html` was mutated nine times and restored from an untouched copy after each
one. Original md5 `09f24f9ffc7e706cb2870bc711b481a1`; final md5 of `index.html`
**`09f24f9ffc7e706cb2870bc711b481a1`** — byte-identical. `git status --short` shows twelve
previously-modified PNGs under `outputs/` that pre-date this audit and were not touched by it, plus
the new untracked `outputs/v80-audit-r3-shots/`. No mutation was committed. Probe scripts were kept
outside the repo.*
