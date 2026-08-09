# Designer review — app-v52

**Stage:** Designer (TEAM.md stage 4) + copy review (rides on this stage).
**Date:** 2026-08-09 · **Reviewer:** Designer agent · **Build tested:** `app-v52` @ `ca587c4`, served from
`python3 -m http.server 8899` over the repo, driven with Playwright/Chromium against the real UI.
**Primary viewport:** 360 px. Also checked 390 px and 1280 px.
**Profiles driven:** radiation-only (5 real medications, 3 of them `Only near treatment day`), plus
`other`, `chemo` and `both` for regression.
**Console:** zero page errors and zero app console errors on every screen below.
**Horizontal overflow:** 0 px on Home, Settings and History at 360 / 390 / 1280 in every profile type.

Screenshots: `outputs/v52-design-screenshots/` (8 images).

---

## Verdict in one line

The three behaviours v52 adds all work and none of them break a layout — but two of them ship a screen
that is *technically correct and communicatively wrong*, and one Settings string is long enough to
visibly deform the toggle grid for **every** profile type, not just radiation. Four must-fixes, all of
them small and all of them copy or ordering rather than structure.

---

## MUST FIX BEFORE SHIP

### D-1 — The new Settings helper is 2.1× the height of every toggle around it (all profiles, 360 px)

**Where:** `index.html:5544`

Measured at 360 px, in the live grid:

| Toggle | Helper lines | Pill height |
|---|---|---|
| Temperature card | 2 | 48 px |
| Weight card | 1 | 44 px |
| Blood pressure card | 2 | 48 px |
| **Treatment schedule card** | **5** | **93 px** |
| Radiation sessions card | 2 | 48 px |
| Menstrual cycle tracking | 2 | 48 px |

At 390 px it is 4 lines / 78 px. At 1280 px the grid is two columns, so the 78 px cell **stretches its
row partner** — "Blood pressure card" is padded out to 78 px with dead space under its text and the
whole row bulges (`H-settings-grid-1280.png`). This is not radiation-only: I reproduced the identical
93 px pill on `chemo`, `both` and `other` profiles, because the toggle is now unconditional. Every
user of the app gets this.

It also reads wrong. It is the only helper in the app that contains two sentences, and the second
sentence is an instruction ("Turn this on if…") inside a control whose whole job is already "turn this
on." And the phrase it uses — *"set to appear only near your treatment day"* — is not what the
medication editor calls that option. The editor's radio is labelled **"Only near treatment day"**
(`index.html:4579`), and for `other` profiles it is **"Only near your date"** (`:4573`). The app varies
that wording by treatment type in eleven other places; this one new string does not, so an `other`
profile is now told about a "treatment day" the rest of its UI never mentions.

**Fix — exact replacement string** (measured live: 3 lines / **63 px**, +15 px over its neighbours
instead of +45 px, and it keeps the dependency information):

```
'Treatment date, countdown, and reminders on Home. Needed by “Only near treatment day” meds.'
```

and, matching the pattern already used at `:4857` / `:4945`, for `other` profiles:

```
'Treatment date, countdown, and reminders on Home. Needed by “Only near your date” meds.'
```

If the PM prefers a helper that matches its neighbours exactly (2 lines / **48 px**, measured), use
`'Treatment date, countdown, and reminders on Home.'` alone — but only if D-2 below ships, because
D-2 is where a user actually meets the dependency.

Evidence: `A-settings-toggle-grid-360.png`, `H-settings-grid-1280.png`.

---

### D-2 — A treatment-day-only medication now appears as plain green "✓ Available" with nothing saying why

**Where:** `index.html:3821` (the new `|| !hasTreatmentDate()` filter) → status pill at `index.html:3963`

This is the visual consequence of the H-2 fix and it is the most important finding in this review.

With no treatment date set, Dexamethasone, Magic mouthwash and Zofran ODT — all configured **"Only near
treatment day"** — now render on Home as ordinary available medications: bright green `✓ Available`
chip (`#0C7F57` on `rgba(15,157,87,0.12)`), filled orange dose button, identical in every pixel to a
medication the patient may take any day (`C-home-quicklog-5-meds-360.png`).

The v51 audit's L-2 was "this medication vanishes with no explanation." v52 correctly stopped the
vanishing, but the replacement state says nothing either. At 2 a.m. a caregiver reads *"Dexamethasone
— Steroid — ✓ Available — 4 mg"* and taps it. The oncologist restricted that steroid to treatment day;
the app knows that; the card doesn't say it. Green means "go" in this design system — it is used
nowhere else on Home for "we can't tell."

**Fix — two exact changes on the med card, when `med.treatmentOnly && !hasTreatmentDate()`:**

1. Replace the green pill with the app's existing amber "unknown/waiting" chip. Reuse the *exact*
   token already used for `Waiting` at `index.html:3960` so no new colour enters the system:
   `height: 26px; background: rgba(181,118,30,0.12); color: #8C5900; border-radius: 99px;
   padding: 0 10px; font-size: 12px; font-weight: 700`, content `clockSVG + ' No date set'`.
2. Add one caption line directly under the existing meta row (same slot and style as `med.note` at
   `index.html:3985`, but `color: '#8C5900'`, not italic):

```
'Showing every day until you set a treatment date.'
```

That sentence is the literal truth of what the new filter does, it names the fix, and it is 48
characters — 2 lines at 360 px, so the card grows by ~17 px and nothing reflows.

I am flagging this at must-fix level, not "would improve," because it is a medication-availability
signal on a dosing card, which is the same class of thing TEAM.md's copy rule exists for. It does not
need a clinician — the correct wording here is a statement of app state, not medical advice.

---

### D-3 — On a radiation-only profile the opt-in card is ranked above the profile's signature card

**Where:** `index.html:3733` (Treatment schedule) renders before `index.html:3763` (Radiation sessions)

Measured Home order for a radiation-only profile with the new toggle on, at 360 px and 1280 px:

```
TEMPERATURE → WEIGHT → BLOOD PRESSURE → TREATMENT SCHEDULE → RADIATION SESSIONS → QUICK LOG
```

Radiation sessions is that profile's every-single-day card: a session counter, a progress bar, and a
big filled "Log today's session" button. Treatment schedule is a card they had to go into Settings and
switch on, and in the common case it is empty. Putting the empty opt-in card above the daily-use one
inverts the hierarchy, and the contrast makes it worse — a ghost mono `Pick a date` row sitting
directly above a gradient primary button (`B-home-rad-schedule-plus-sessions-360.png`).

**Fix:** when `isRadiationOnly()`, push the Radiation sessions block before the Treatment schedule
block. Scope it to `isRadiationOnly()` only — on a `both` profile the chemo cycle date legitimately
outranks the session counter, so leave that order alone.

Everything else about the card at that size is correct: 115 px tall, 16 px radius, `#E9D8D1` border,
same 10px/11px padding and same shadow token as its neighbours. It does not look foreign among the
radiation cards. It is just in the wrong slot.

---

### D-4 — History's missed-only day is fine; its summary line is written in field names

**Where:** `index.html:6044`

The screen itself is good news, and I want to say that plainly rather than invent work: a day with a
missed dose and no logged entries renders as a complete, legible day — date header, red `MISSED`
count, MORNING / EVENING group bands, a red-railed row per missed dose with `Took later / Skipped /
Clear`. It does not look broken and it does not look empty (`E-history-days-compare-360.png`). Placed
next to a normal day it is obviously the same component in a different state. Home's banner count and
History's `Missed Doses (n)` total now agree exactly (8 = 8, verified at 360 px and 1280 px), which is
the whole point of the H-1 fix and it reads correctly on screen.

The one thing to change is the summary line. Because `doses` is 0 on these days, it prints:

```
0 doses · 2 MISSED
```

"0 doses" is the data field talking. Nobody says "I had zero doses yesterday"; they say nothing was
logged. It also puts a zero as the first thing the eye lands on next to a red count, which reads for a
half-second like "0 missed."

**Fix — exact:** when `doses === 0` and there are no temps/weights/APAP/Imodium parts, start the
summary with `'Nothing logged'` instead of `doses + ' dose' + …`, giving:

```
Nothing logged · 2 MISSED
```

Leave every other combination exactly as-is (`2 doses · 1 temp`, `1 dose · 1 temp · 1 MISSED` are all
correct and read naturally today).

---

## WOULD IMPROVE

### D-5 — "Pick a date" is the weakest primary action on Home

The Treatment schedule card's only action is a full-width bordered row containing the word `Pick a
date` in the mono face, in `#2A2127` at 14 px, with a `▼` in `#915E48`. It has no fill, no accent, and
monospace type in this app means *data* everywhere else (times, doses, readings). Against
`Log today's session` (gradient `#E46F3C → #BF4C1A`, white 13.5 px bold) sitting 18 px below it, the
card looks disabled. At 1280 px it is a 673 px-wide empty grey bar (`G-home-rad-1280.png`).

This is pre-existing — chemo profiles have had this card since long before v52 — so it is not a
regression and not a ship blocker. But v52 exposes it to a whole new profile type, and the empty state
is the *only* state a radiation-only user will see until they act. Suggested: when `chemoTs === null`,
render that control as a filled primary button instead — `min-height: 44px; border-radius: 11px;
background: linear-gradient(135deg,#E46F3C 0%,#BF4C1A 100%); color:#fff; font-size:13.5px;
font-weight:700`, label `'Set treatment date'`, dropping the mono class and the `▼`. Once a date
exists, keep today's quiet bordered row — at that point it is a value display, and mono is right.

### D-6 — Touch targets

Everything a user taps on the three changed screens is ≥ 44 px. The only sub-44 px interactive
elements found anywhere in the sweep are:

* `↩ Back` on History — 42 × 88 px (2 px under; pre-existing, low risk since it is a floating pill with
  clear margin around it). Bump `min-height` to `44px` when convenient.
* The `BETA DATE CONTROLS` disclosure row — 42 px. `TEST_MODE` only, never ships to a user. Ignore.
* The two unit `<select>`s in Settings — 43 px. Pre-existing, 1 px. Ignore or round `minHeight` to
  `44px` at `index.html:5497`.

Nothing v52 added is under 44 px.

### D-7 — Settings has *not* inherited the medication editor's 360 px overflow

The brief asked me to check whether Settings has the same class of problem as v51's M-5 (19 px
horizontal overflow at 360 px, caused by the **Days taken** `<select>`). It does not.
`scrollWidth − clientWidth = 0` on Settings at 360 px on all four profile types. The toggle grid is
`repeat(auto-fit, minmax(220px,1fr))`, which correctly collapses to a single 298 px column at 360 px;
the only wide children in that section are the two `<select>`s, and both are constrained. Settings is
clean. (M-5 itself is unfixed and still lives in the medication editor — out of scope for v52, but it
should not be assumed fixed just because this report says Settings is fine.)

### D-8 — Minor pre-existing copy nits noticed while in the grid

* `Bowel movement in daily check-in` wraps mid-hyphenate at 360 px ("check-" / "in"), producing a 78 px
  pill. `'Bowel movements in check-in'` would fit on one line. Not introduced by v52.
* Three adjacent helpers all begin "Include a … question in the daily check-in below," under a heading
  that already says DAILY CHECK-IN. Trimming to `'Adds a weight question.'` / `'Adds a bowel movement
  question.'` / `'Adds an appetite question.'` would remove ~40 % of the words in that block. Not
  introduced by v52.

---

## The 101.4 °F fever question (v51 audit M-6 / referenced as M-8 in the brief)

**Reproduced, unchanged in v52.** With a 101.4 °F reading logged, the Home card reads, in full:

```
TEMPERATURE
Last reading 10:00 AM          101.4°F
[ 98.5 ]  [ Log ]
```

The number is `#9A6419` amber. Nothing else on the card, in Today's Journal, or in History says
anything (`F-fever-1014-no-words-360.png`).

**My design opinion, since one was asked for:**

The colour choice itself is defensible — `#9A6419` on white measures **4.99:1**, so it passes WCAG AA
for body text. The failure is not contrast, it is that **colour is carrying 100 % of the meaning**.
That is a straight WCAG 1.4.1 "use of colour" failure, and it fails for a red-green colour-blind user,
a user at low screen brightness at 2 a.m., a user who has never seen the card in its normal state and
so has no baseline to compare the amber against, and a user reading a printed report. The app already
computed the threshold crossing — it just declines to say it.

Structurally, this is exactly the kind of thing a design system should solve with a *notice band*, not
a colour swap: a full-width strip inside the card, amber-tinted, with an icon and a sentence, using
the `NOTICE_TONES.attention` tokens the app already has.

**On the wording, I will name the boundary rather than guess, per TEAM.md's copy rule.** I am
comfortable specifying anything that is a neutral statement of what the app measured:

```
100.4 °F or higher — over the fever threshold.
```

That is factual, adds zero interpretation, and is a strict improvement on silence. It could ship
today.

**I am not comfortable specifying, and I do not think this chain should specify, the action line.**
100.4 °F is the neutropenic-fever threshold; for a chemo patient it is a "call the on-call oncologist
now" number and for many radiation patients it is not. The difference between *"Call your care team"*,
*"Call your care team now"*, and *"Follow your care team's fever instructions"* is the difference
between a reminder, an instruction, and a liability — and which one is right depends on the patient's
counts, their treatment, and what their team actually told them, none of which this app knows. Getting
that sentence wrong in either direction causes real harm: too soft and someone waits out a
neutropenic fever; too hard and a radiation patient with a cold phones an oncologist at 3 a.m. and
learns to distrust the app's alerts.

**Recommendation: this needs a real clinician sign-off on the action line, and a copywriter on the
tone, before it ships. It should not be resolved in-chain.** Concretely, my recommendation to Aaron is
to ship the neutral threshold sentence above now (it is unambiguously better than colour alone and
carries no clinical claim), and to take the action line — plus whether the app should surface the
user's own care-team instructions here, which is the genuinely correct product answer — to a clinician
as its own piece of work.

---

## Screenshot index

| File | Shows |
|---|---|
| `A-settings-toggle-grid-360.png` | D-1 — the 93 px Treatment schedule pill among 44–48 px neighbours |
| `H-settings-grid-1280.png` | D-1 — the tall cell stretching its row partner on desktop |
| `C-home-quicklog-5-meds-360.png` | D-2 — three "Only near treatment day" meds shown as plain green ✓ Available |
| `B-home-rad-schedule-plus-sessions-360.png` | D-3 — opt-in card ranked above Radiation sessions |
| `I-home-rad-full-360.png` | D-3 / D-2 — full radiation-only Home, schedule card on, no date set |
| `G-home-rad-1280.png` | D-3 / D-5 — same at desktop; the empty 673 px "Pick a date" bar |
| `E-history-days-compare-360.png` | D-4 — missed-only day beside a normal day; "0 doses · 2 MISSED" |
| `F-fever-1014-no-words-360.png` | Fever — 101.4 °F signalled by colour alone |

## Harness

`test/v52-design.mjs`, `test/v52-design2.mjs`, `test/v52-design3.mjs`, `test/v52-design4.mjs` — seed a
profile through `localStorage` in an init script, then drive the rendered UI (nothing in `index.html`
is reachable from `page.evaluate()`; it is a single ES module). Candidate copy strings were measured
by swapping `textContent` on the live helper node and reading back the wrapped height, which is where
every line-count and pill-height number in this report comes from.
