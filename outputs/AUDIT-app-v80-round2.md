AUDITED-COMMIT: f42e394236de73e9782d53980444e15a031ac6d4
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v80 round 2, "Up next" on Home

## The headline, in plain words

**The hero's only button still does nothing, and you reach the state that kills it by tapping one
control on the same screen.**

Round 1 blocked this release because the "Go to [medication]" button could be pressed and nothing
would happen. Round 2 fixed that by asking whether the medication is *configured* to have a card on
Home. It never asks whether the card is actually **on the screen**.

Home's "Quick log" section has a collapse chevron. Collapse it — one tap, on Home, no menu, no
settings — and every standalone medication card leaves the page. The hero stays. It still names the
medication, still says **Due now**, still offers **Go to Ondansetron**. Tapping it does nothing at
all: no scroll, no highlight, no message.

Observed, with the Quick log section collapsed and one scheduled medication due:

    cards on the page: 0
    hero: "UP NEXT / TapTarget / 1 tab / Due now · Now / 0/1 DOSES / Go to TapTarget"
    after tapping: elements marked  0

That is the same screen, the same control and the same silence round 1 called *"worse than a dead
control"*, reached through a different door. The collapse is remembered for the rest of the session,
so once a caregiver has tidied Home away, the app's most prominent card has a control that never
works again until they reload.

**The fix is the size of the one already made.** `scrollToMedCard` finds no element and returns. It
should open the section and look again — `setState` re-renders synchronously, so this is one branch:

    if (!el) { if (!state.quickLogOpen === false) {} setState({ quickLogOpen: true }); el = document.querySelector(...); }
    if (!el) return;

and one fixture: collapse Quick log, tap the hero, assert a card is marked.

**Everything round 1 blocked on IS genuinely fixed, and I could not move any of it.** The rest of
this report is that verification, one more coverage gap the brief asked me to hunt for, and four
ranked findings.

---

## Round 1's clearances, re-confirmed rather than re-audited

**The write model still holds.** Every added line of `index.html` in this commit was searched for
`addEntryDB`, `removeEntryDB`, `setPrefsDB`, `localStorage`, `sessionStorage`, `setItem`,
`removeItem`, `fetch`, `XMLHttpRequest`, `logMed`, `confirmTimeAndLog`, assignment to
`state.entries`, and any push onto an entry array. **Zero matches.** The three new functions
(`medHasReachableCard`, `homeShowsDoseCount`, and the group-flash block) are pure reads plus one
`setState`. Nothing in this release can create, change or destroy a record.

**Rule 0 still clean.** One new caregiver-facing string in the whole diff ("Due in under a minute").
No patient name, no gendered pronoun, no care-plan dose, ceiling or schedule, and no new branch
keyed to a medication id. `medHasReachableCard` reads placement flags, not ids.
`v75-no-other-patient` passes 27/27 with the ratchet unmoved.

---

## BLOCK 1 — the collapsed Quick log section (above)

## The three round-1 blocks: each fix is real, and each one now bites

I mutated the fix out and watched the suite go red. `index.html` was restored byte-for-byte after
each one and the tree is clean (bottom of this report).

| Mutation | `test/v80-up-next.mjs` |
|---|---|
| delete `if (!med.alerts) continue;` | **RED** — 21/22, "never named when it is marked as-needed under Days taken" |
| delete `if (!medHasReachableCard(med)) continue;` | **RED** — 21/22, "never named when it has no card anywhere on Home" |
| neuter the group `data-flash` | **RED** — 21/22, "tapping the hero marks the card that holds it" |
| revert `doses.length === 1` to `doses.length` | **RED** — 21/22, prints "500 mg" again |

**Block 1's claim, checked against `normalizeMedication` rather than accepted.** The claim is that
`med.alerts` is exactly *"type is win AND days-taken is not as-needed"*. Line 1300 reads
`alerts: type === 'win' && !(original.scheduleDays && original.scheduleDays.mode === 'asneeded')`,
and it sits **after** `...original` in the same object literal, so it overwrites anything a stored,
imported or restored config carries. I tried both attacks:

- a `type: 'gap'` medication with `alerts: true` and windows forced into the stored config → hero
  absent (normalize deletes the windows and recomputes alerts).
- a `type: 'win'` medication with `alerts: true` **and** `scheduleDays: {mode:'asneeded'}` forced
  into the stored config → hero absent.

**A medication the walk treats as scheduled that the hero now skips: yes, and deliberately.** The
missed-dose walk filters on `m.alerts && m.windows`; the hero adds `medHasReachableCard`. So a
"Managed only" medication is still flagged as missed in History and is still counted in the day's
dose denominator, but is never named by the hero. I checked what Home then says: with one logged
card medication and one unlogged managed-only medication, Home shows no hero and the header ring
reads **"1 of 2 scheduled doses logged today"** — correct, and the caregiver is not left with a
control that goes nowhere. That is the right trade, but it is now a *third* population ("named by
the hero") alongside "alerts" and "counted in the ring", and the comment above `nextDueDose` still
says the hero draws the same line as the walk. It does not, in this one respect. Worth one sentence
in the comment.

---

## The third coverage gap the brief asked for — FOUND, and it is this round's own fix

Round 1 found two guarantees with no fixture. Here is a third, and unlike those two it protects a
change **this commit made**:

    revert the header ring to `(state.view === 'home') ? null : doseRing(now)`
    → test/v80-up-next.mjs: 22/22 PASS

That mutant is round 1's finding 4, restored in full: on a day with an unlogged past window, the
hero does not render, the all-done card does not render, the header ring is suppressed, and **the
day's dose figure disappears from the app entirely**. The suite cannot see it, because its only
ring assertion (section 5, "one progress figure, not two") runs against a fixture where the hero is
showing — a state in which the old code and the new code produce the same single ring.

The behaviour is correct as shipped; I verified all three states by hand:

| State | hero | rings on Home |
|---|---|---|
| a medication is due | orange hero | 1 (inside the hero) |
| a past window went unlogged, nothing else due | none | 1 (header ring, "0 of 1") ← the fix |
| everything logged | green "All scheduled doses are in" | 0 |

**Needed before ship:** one fixture with a window that closed earlier today and no log, asserting a
dose figure is present somewhere on Home. Falsify it with the mutation above.

Three smaller fixes in this commit are also invisible to the suite, provable by reading it: nothing
asserts any "Due in…" wording, nothing double-taps the hero, and the flash assertions select
`[data-flash="on"]`, so the `data-flash="null"` trap would return unnoticed. All three fixes work —
I confirmed them in the browser (below) — they are simply unprotected. The clamp and the contrast
change are likewise unchecked. None of these is a block; the header-ring one is called out
separately because the bug it prevents is one this project has already written up once.

**No check in the suite is dead.** I confirmed section 5 can fail (remove the suppression entirely
and two rings render). This is missing coverage, not a check that cannot fail.

---

## The rest of the round-2 fix list, verified in the browser

| Fix | Verified |
|---|---|
| cancelled `medFlashTimer` | tap, wait 1.2 s, tap again, wait 0.7 s → **1** element still marked. Fixed. |
| `h()` null-attribute trap | every `data-flash` attribute on the page is now `"on"`; no `"null"` anywhere. Fixed. |
| "Due in 0 minutes" | 1 s and 29 s before the window → *"Due in under a minute"*; 59 s → *"Due in 1 minute"*. The "0 minutes" string is gone. |
| single-strength dose rule | a two-strength medication now names neither; a one-strength one still shows "1 tab". |
| grouped-card mark | the group `<section>` carries `data-flash="on"` and a ring. Fixed. |

**Id-sanitising on both sides agrees.** `scrollToMedCard`, the standalone `data-med-card` value and
the group `data-med-card-<id>` attribute all use the same `[^A-Za-z0-9_-]` replace, and every id has
already been through `safeMedicationId` (lowercase, `[a-z0-9-]`), so the replace is a no-op in
practice and HTML's case-insensitive attribute names cannot bite. Two medications whose ids collide
after sanitising would both light up — but they would already be sharing entries and history, so
that is a pre-existing duplicate-id problem, not this release's.

**A medication in two groups marks both** (observed: Morning **and** Evening sections both flashed),
and a medication with its own card *and* a group marks both of those too. The scroll goes to the
right place; two cards glowing is confusing rather than wrong. Ranked below.

**`homeShowsDoseCount` is not a recursion or performance problem.** It is called once per header
render and only on Home (`&&` short-circuits everywhere else), and it calls no renderer. Cost: with
40 medications and 3,000 entries the page spent 466 ms of long tasks across 6 s of one-second ticks
(~78 ms per tick) — heavy, but that is the existing render, and the added call is a second pass over
the same two pure functions. The name is slightly wrong in one branch: on a finished day it returns
true while the all-done card shows **no** count. Harmless, because the completed header ring shows a
tick rather than a number, so nothing is actually lost.

---

## Ranked findings

**2. The contrast fix does not reach AA, and the commit says it does.** The commit message states
full white *"clears 4.5:1"*. Measured against the gradient actually behind the label
(`linear-gradient(152deg, #E4693B 0%, #BF4C1A 52%, #8B3C1B 100%)` over a 288×185 card, sampled at
the label's own position): **3.57:1 at the start of the word, 3.82:1 at the end.** `TYPE.label` is
12 px bold, which is small text, so AA wants 4.5:1. It improved from 2.69 to ~3.6 and it still
fails. A darker first stop, a text shadow, or a slightly larger label would close it. The 8 px
"DOSES" caption round 1 flagged is unchanged. Whatever else happens, the release message must not
repeat the 4.5:1 claim.

**3. The clamp truncates the name in the one place the code says never to truncate — and the button
prints it in full anyway.** At 320 with a long pasted name the title now reads
*"Hydroxyproge sterone Caproate…"* while the button underneath spells the whole thing out across
five lines. The button label is `'Go to ' + nx.med.name`, unclamped, so it is now what drives the
card's height: 316 px before, 285 px after, of which 95 px is the button. It clears the fixed tab
bar comfortably in Chromium (button bottom 448 px, tab bar top 711 px at 320×780), so this is not a
block — but the clamp mostly moved the problem rather than solving it, and the card that says a
name must never be trimmed now trims it. Clamping the **button** to one line, or labelling it "Show
me the card" whenever the name is long, takes the card back to ~190 px and keeps the full name on
screen.

**4. Two cards light up for a medication in two groups.** As above. Mark only the section the scroll
actually landed on.

**5. The hero's population is now a third one.** As above — one sentence in the `nextDueDose`
comment, so the next reader does not re-derive it.

---

## VOICE — every string this round changed

| String | True? | Verdict |
|---|---|---|
| "Due in under a minute" | Yes — shown only under 60 s, verified at 1 s and 29 s | OK, and plainer than the arithmetic it replaced |
| "Due in 1 minute" at 59 s | Rounds up; a caregiver reading "1 minute" at 59 s is not misled | OK |
| "Go to [name]" | **Silently does nothing when Quick log is collapsed** | **Block 1** |
| "All scheduled doses are in" | True on every fixture I built | OK |
| the clamped medication name ending in "…" | The card promises the full name and shows a truncated one, with the full one in the button below | Finding 3 |

No new number is printed about a patient by this round. The dose figure is unchanged and still
belongs there for the reason round 1 gave.

## DESIGNER — 320, 360, 390

**This sandbox has Chromium only. An iPhone's rendering, its font metrics and its safe-area insets
cannot be reproduced here — the hero must be opened on the two real phones before anyone calls it
verified.** Screenshots in `outputs/v80-audit-r2-shots/`.

- No horizontal overflow at any of the three widths, with a normal name or a 105-character one.
- Normal name: hero 185 px, button 48 px, at all three widths.
- Long name: hero 285 / 285 / 266 px at 320 / 360 / 390; button 95 / 95 / 76 px; the button's bottom
  edge is 263 px clear of the tab bar at 320. Round 1's overlap is gone.
- The hero still sits below the fold behind the "You're using the web preview" notice in the browser
  build (`hero-390-normal.png`). Dismissible, and absent in the Capacitor wrap — noted, not filed.

## ENHANCER

Nothing to propose. The one structural gap is Block 1 and it is a correctness fix.

---

## What passes

All eleven suites green on the audited commit: v75-med-description-shots, v75-no-other-patient
27/27, v75-table-builder 96/96, v76-empty-window-render 13/13, v76-properties-equivalence 22/22,
v77-legacy-migration-equivalence 36/36, v78-fence-removed 20/20, v79-home-cards-render 20/20,
v79-warning-priority 14/14, v80-pixel-identity, v80-up-next 22/22. No page error in any fixture.

Attacks that failed, so nobody re-runs them: `alerts: true` forced into a stored config on both a
gap medication and an as-needed-days medication; a medication in two groups at once; a medication
with both its own card and a group; double-tapping the hero; the boundary between "under a minute"
and "1 minute"; a 105-character medication name at three widths; 40 medications and 3,000 entries
against the new header call.

## What must happen before this ships

1. Make `scrollToMedCard` open a collapsed Quick log section before giving up, and add a fixture
   that collapses it, taps the hero and asserts a card is marked.
2. Add the header-ring fixture (a past unlogged window, assert a dose figure exists on Home), and
   falsify it with the revert above.
3. Correct the 4.5:1 claim in the commit message and the release message — it measures 3.6:1.

Findings 3–5 are a follow-up release.

---

*Restoration: `index.html` was mutated five times and restored from an in-memory copy after each;
the runner reported an exact md5 match at the end, and `git status --short` shows only the new
untracked screenshot directory. Probe scripts are in `outputs/v80-audit-r2-probes/` (gitignored by
`outputs/**/*.mjs`, so kept locally); screenshots in `outputs/v80-audit-r2-shots/`.*
