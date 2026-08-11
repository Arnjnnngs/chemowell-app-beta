# LEAD DESIGN REVIEW — app-v56, the on-screen help bubble

**Stage:** Lead Designer (Quality Chain stage 4). **Author:** Lead Designer agent, 2026-08-11.
**Reviewing:** `outputs/DESIGN_v56.md` (Designer, stage 3) and commit `0543e42`, which the Lead
Developer states applied *all* of that report's findings.
**Method:** re-measured against the running product at `http://127.0.0.1:8899/index.html`, not
against the report and not against the diff. Every number below comes from
`getBoundingClientRect()` / `getComputedStyle()` / a WCAG-2.1 relative-luminance function injected
into the live page, or from sampling the rendered pixels. Harness and evidence in
`outputs/v56-lead-designer/` (`lib.mjs`, `lib2.mjs`, `v1`–`v9`, 18 curated PNGs at
`deviceScaleFactor: 2`).

**I did not re-do the Designer's review.** I re-checked the eight findings Aaron named, audited the
fixes for design-system consistency and new defects, and then covered the ground the Designer did
not: a populated app, reduced motion, forced colours, dark, 200 % zoom, a larger root font, a live
toast, the first screen after the tour, unbroken long input, and RTL.

---

## VERDICT

**Sign-off: conditional. Do not ship as-is.**

Twelve of the thirteen fixes I re-measured are real, correctly implemented, and consistent with the
file's own vocabulary. The feature is materially better than the build the Designer reviewed.

But **one fix is a net regression that is worse than the finding it answered** (N1, the bubble's
white fill), **one fix was applied in the opposite direction to the finding** (N2, the pill
alignment), and **two of the six nice-to-haves are not in the build at all** (N5, N6) — which
matters because Aaron's brief says all of them were applied, so his mental model of what shipped is
wrong in two places.

- 1 must-fix before release: **LD-1** (help bubble contrast).
- 2 should-fix: **LD-2** (pill alignment moved the wrong way), **LD-3** (the "are you a real
  person" reply is a dead end with no controls at all).
- 6 backlog items, listed at the end.

---

# 1. Re-verification: were the findings real, and did the fixes land?

| # | Finding real? | Fix in the running product? | My verdict |
|---|---|---|---|
| M1 send glyph | **Yes** | **Yes** | Correct and better than asked |
| M2 resize / 448 | **Yes** | **Yes** | 448 is the right number |
| M3 composer padding | **Yes** | **Yes** | Clean |
| S1 user-bubble colour | **Yes** | **Yes**, but under-delivers | Colour is still confusable |
| S2 callout parity | **Partly** | **As prescribed**, not as the commit describes | Acceptable, claim overstated |
| S3 generic refusal | **Yes** | **Yes** | The best fix in the release |
| S7 two contrast fixes | **Yes**, both stated ratios accurate | **Yes** | Clean |
| N1 bubble fill | Yes | **Yes — and it introduced LD-1** | Regression |
| N2 pill alignment | Marginal | **Applied in the opposite direction** | Regression |
| N5, N6 | Yes | **Not applied** | Aaron's count is wrong |

## M1 — the send glyph. Real, fixed, and fixed better than specified.

The finding was correct: `arrow` (`index.html:2410`) is `M10 7 5 12l5 5` + `M5 12h14` — a
left-opening chevron, the same glyph `backRow()` puts beside the word "Back".

Live now (`v1-fixes.mjs`): the submit button renders
`M4.5 11.9 20 4.5l-7.4 15.5-2.1-6.4-6-1.7Z` + `m10.5 13.6 9.5-9.1`, `viewBox="0 0 24 24"`,
`stroke-width="1.9"`, `fill="none"` — the icon set's own conventions, kept. No back-chevron path
remains anywhere in the panel. 44×44, `aria-label="Send question"` intact.
Evidence: `M1-send-crop.png`.

One thing the Designer did not anticipate and the Dev got right by following the set's convention:
because the plane is **stroked, not filled**, it survives forced-colours mode as a visible outline
(`G3-forced-panel-390.png`). A filled paper plane would have gone black-on-black there.

## M2 — resize staleness and the 448 breakpoint. Real, fixed, and 448 is the right call.

Measured with the panel open and only the viewport changing (`v2-resize.mjs`, no re-render):

| viewport | panel | anchoring |
|---|---|---|
| 320 / 360 / 390 / 430 / 440 / **447** | 304 / 344 / 374 / 414 / 424 / **431** px | full-bleed, `left:8 right:8` |
| **448** / 460 / 500 / 519 / 520 / 640 / 768 / 1024 | **380 px** every time | `right:14`, `left:auto` |

The switch fires at exactly 448. The rotation case the Designer reported is gone and is
**bidirectional**: 360×800 → 740×400 gives `width 380, right 14` immediately (not after the 1 s
tick), and 740 → 360 returns to full-bleed. A forced re-render at 740 agrees with the mutated
style, so the JS branch and the render branch cannot disagree.
Evidence: `M2-landscape-740x400.png` (panel 380×292, log 158px, top 24).

**On 448 itself, which Aaron asked me to judge: it is right, with one thin margin worth knowing.**
The widest phone in portrait today is 440 CSS px (iPhone 16/17 Pro Max); 430 is the 14/15 Pro Max;
414 the Plus; 390–393 the mainstream. 448 clears the widest by 8 px, so no phone changes behaviour,
which is exactly the property you want from this breakpoint. Above it, every width lands on the
same 380 px card, so there is no intermediate "near-full-width slab" band left. The 8 px headroom
is thin — 460 or 480 would have been safer against a future 445-ish device — but there is no such
device now and the cost of being wrong is cosmetic, not functional. Keep 448.

The one visible artefact is a 51 px discontinuity at the boundary (431 → 380). That is only
observable by dragging a desktop window across 448; on a phone it is unreachable.

## M3 — composer safe-area double-count. Real, fixed.

`getComputedStyle(form).padding` is now `10px` flat. The panel's own `bottom` still carries the
inset (`calc(84px + env(safe-area-inset-bottom))`), and `helpBotSyncViewport` re-writes it with the
inset preserved, so the clearance the inset exists for is untouched. Measured at 360×800: composer
65 px, log 426 px, panel 560 px, panel bottom edge 84 px above the viewport bottom. The 34 px is
back in the transcript.

## S1 — the user bubble. Finding real; fix landed; **the fix does not achieve what the finding asked for.**

The finding was airtight: the user's bubble and the "Open the full walkthrough" CTA were the same
`#BF4C1A`, same white text, same radius family, in the same panel.

The fix landed: bubble is now `rgb(168,61,15)` = `#A83D0F`, white text, **6.29 : 1** measured —
exactly the number the Designer stated, and up from the 4.92 : 1 I measured on the CTA, which still
uses `#BF4C1A`.

But the stated goal was a fill "visibly distinct from the primary-action fill at a glance."
**Measured, the two fills differ by 1.28 : 1.** Anything under 3 : 1 is not a boundary a person
reads as "different kind of thing." Put `S1-user-bubble-vs-cta-360.png` in front of someone: the
message bubble at the top right and the CTA at the bottom are two shades of the same orange-brown.
What actually separates them in that screenshot is the asymmetric radius, the right alignment and
the narrow width — the shape signals the Designer correctly told us to keep — not the colour.

The Designer's own **alternative** (`rgba(200,83,32,0.12)` fill, `#8A3D14` text, `.22` border)
would have achieved the stated goal, and would additionally have matched the chip vocabulary S10
introduced two findings later. The panel now carries three closely related oranges: `#A83D0F`
(user bubble), `#BF4C1A` (CTA + send button), `rgba(200,83,32,0.10)` over `#FFF6F1` (chips).

Not a defect — nothing is broken and contrast improved — but the finding is only half-discharged.
**Backlog, not a blocker.**

## S2 — callout parity. Finding half-real; fix as prescribed; **the commit message's claim is not true.**

Measured on both surfaces (`v1-fixes.mjs`):

| | walkthrough page | panel (now) | ratio |
|---|---|---|---|
| border-radius | 17 px | 15 px | 0.88 |
| padding | 14 px | 12/13 px | 0.89 |
| gap | 11 px | 10 px | 0.91 |
| icon chip | 36 px / r12 / glyph 19 | 32 px / r11 / glyph 17 | 0.89 |
| heading | 15 px / **700** | 14 px / **700** | 0.93 |
| body | 14 px / 1.55 | 13.5 px / 1.55 | 0.96 |
| tone accent | `rgb(192,69,59)` | `rgb(192,69,59)` | identical |

**The real defect the Designer found was the weight inversion** — the panel's heading was 800 at
13.5 px against its sibling's 700 at 15 px, heavier at a smaller size, and 800 is reserved by
`TYPE`'s own header comment for `display` and primary CTA labels. That is fixed: both are 700 now.

**The rest of the finding was overstated, and the commit message repeats the overstatement.** The
commit says the two callouts are "now one shared shell." They are not. `helpBotNotice()` is shared
*within the panel* only; `renderHelpView`'s callout (`index.html:6800`) is still its own inline
markup with its own numbers. What the two now are is **one component at two sizes** — a consistent
~0.89 geometric scale with type scaling more gently, which is the correct relationship and is what
the Designer's own prescribed values produce. So: they read as one component. But nobody should
later believe there is a single shell to edit, because there isn't.

## S3 — the generic clinical refusal. Real, and the best fix in the release.

Measured live on "how many mg of tylenol is safe" (`S3-refusal-tylenol-360.png`): the refusal now
renders through `helpBotNotice` — white card, `border-radius: 15px`, `padding: 12px 13px`, 4 px
`rgb(192,69,59)` urgent rule, 32 px heart chip on `rgba(192,69,59,0.12)`, heading
**14 px / 700 at 15.61 : 1**, body 13.5 px at 8.44 : 1. `font-style` on every child of the notice
is `normal` — the seven italic lines are gone. `HELP_CARE_TEAM_LINE` is now 12.5 px `#7A6E76` at
**4.86 : 1**, reading as the standing disclaimer it is.

The safety hierarchy now matches the visual hierarchy: the generic refusal and the specific fever
answer are the same component with the same urgent tone. This one was worth the whole review.

## S7 — the two contrast fixes. **Measured, both numbers the Designer stated are correct.**

- Disambiguation category label: now `13px / 600 / rgb(145,94,72)` on white = **5.39 : 1**
  (claimed 5.39). Identical to the Help view's `topicRow` sub-label, as intended.
- Header subtitle: now `12px / 600 / rgb(122,110,118)` on white = **4.86 : 1** (claimed 4.86).

I also swept every text node in the panel across the greeting, answer, list, clinical, refusal and
no-answer states. **No text in the panel fails AA, and nothing renders below 12 px.**

## Also verified, briefly (all real findings, all correctly applied)

- **S4** reopen scroll — after 4 exchanges, reopening lands at `scrollTop 1796` of 2384, i.e. at the
  *top of the newest reply* (162 px above the true bottom), matching `helpBotAsk`'s own rule. Right.
- **S5** browse-all persistence — present on `answer` and `list`. See **LD-3** for what it misses.
- **S6** scroll affordance — `inset 0 10px 8px -8px rgba(60,21,4,0.1)` top and bottom, present and
  visible under the header rule in every panel screenshot.
- **S8** announcer — `#helpbot-announce` exists, `role="status" aria-live="polite"`, 1 px clipped,
  and carries the right one-line text after each submit ("Found: How do I clear a missed dose?",
  "That's a question for the care team. This app can't answer it."). The log is now explicitly
  `aria-live="off"`. Correct.
- **S9** gaps — every stacked chip column measures `gap: 10px`.
- **S10** chip fill — see the honesty note below.
- **N3** focus ring — 16 tabs from load reaches `#helpbot-fab`; ring is `rgb(42,33,39) solid 3px`,
  offset 3 px, **14.64 : 1** against the page background. Real fix. `N3-fab-focus-ring.png`.
- **N4** — `aria-expanded` / `aria-controls` removed; `aria-label="Ask for help"` kept.

**On S10, honestly:** the chip fill is now `rgba(200,83,32,0.10)`, which composites to `#FAE6DC`
over the `#FFF6F1` bubble. Text on it measures **6.30 : 1** — *not* the 7.14 : 1 the Designer
stated; they appear to have computed over white rather than over the bubble. It still clears AA
comfortably, so the conclusion is unaffected. But the finding's premise deserves a correction:
**the chip fill is 1.13 : 1 against the bubble and the chip border is 1.25 : 1** — nowhere near the
3 : 1 that would make a control boundary perceivable, and the `list` kind's white rows the Designer
praised as "noticeably better" measure **1.07 : 1**, i.e. *lower*. What actually changed is the
value *direction* and the vocabulary alignment with Related chips, both of which are legitimate
consistency wins and do look better in `G8-panel-with-toast-390.png`. Just don't record this as a
contrast fix; it isn't one.

---

# 2. NEW PROBLEMS THE FIXES INTRODUCED

## LD-1 — MUST FIX. The white help bubble has no perceivable boundary on any screen.

`index.html:6641` (N1, option B as the Designer preferred it):
`background: '#FFFFFF'`, `border: '1px solid #E9D8D1'`, `boxShadow: '0 8px 22px rgba(136,57,24,0.22)'`.

I sampled what is actually behind the disc on all five tabs, with the FAB temporarily hidden
(`v7-extra.mjs`):

| tab | behind the bubble | white disc vs behind | 1 px `#E9D8D1` border vs behind |
|---|---|---|---|
| Home | `#FFFFFF` (a card) and `#FAF7F6` | **1.00 : 1** / 1.07 : 1 | 1.38 / 1.30 : 1 |
| Meds | `#FFFFFF` and `#FAF7F6` | **1.00 : 1** / 1.07 : 1 | 1.38 / 1.30 : 1 |
| Reports | `#FFFFFF` | **1.00 : 1** | 1.38 : 1 |
| In-Patient | `#FAF7F6` | 1.07 : 1 | 1.30 : 1 |
| Symptoms | `#FAF7F6` | 1.07 : 1 | 1.30 : 1 |

WCAG 2.2 §1.4.11 asks 3 : 1 for the visual boundary of a user-interface component. **The bubble is
between 1.00 : 1 and 1.38 : 1 on every screen in the app.** The previous `#BF4C1A` disc was
4.92 : 1 against white and 4.79 : 1 against the page background.

Two things make it worse than the numbers alone:

1. **The shadow was weakened in the same edit** — `rgba(136,57,24,0.34)` → `0.22` — at the exact
   moment the fill stopped carrying the shape. And the shadow is offset **downward** (`0 8px`), so
   the *top* half of the disc has no shadow at all. On a white card the top of the circle simply
   ends. `G1-fab-over-white-card-crop.png` is a 2× crop of this on a populated Home; the disc's
   upper-left arc is invisible against the card.
2. **This is only reachable on a populated app**, which is why the Designer's screenshots don't
   show it. On an empty Home the FAB sits over the peach gradient. Add two medications and it lands
   on the Temperature / Weight cards (`G1-home-populated-fab-390.png`).

There is a defensible reading in which the `?` glyph — 4.92 : 1 on white — is the "graphical object
required to understand the content" and passes on its own. I do not accept it here: the disc is the
56 px touch target, and a caregiver at 2 a.m. is looking for a *button*, not for an icon.

It is also worth noting the internal inconsistency: the Designer raised N3 precisely because a
2.4 : 1 non-text indicator is under the 3 : 1 floor, then recommended a fill that puts the control
itself at 1.0–1.4 : 1. And the stated rationale — "the same treatment the panel's own header icon
chip uses" — isn't accurate: that chip is `rgba(191,76,26,0.12)` **tinted**, not white.

**Recommended fix, smallest change that keeps the win:** keep white, and make the border carry the
boundary — `border: '2px solid #BF4C1A'` (4.92 : 1 on white, 4.79 : 1 on `#FAF7F6`). The bubble
stays visibly *not* a solid create button, gains a rose ring that ties it to the panel's header
chip, and clears 1.4.11 everywhere. Restoring the shadow to `0.30` is a reasonable second step but
does not fix it on its own — shadows are not a boundary.

Secondary, worth a decision rather than a fix: on the Reports detail screen the two floating
controls are now maximally opposed — a dark `rgba(59,25,10,0.88)` Back pill and a white disc
(`N2-reports-detail-360.png`). Option A would have unified them. Option B is fine once LD-1 is
fixed, but it is a choice, not an accident, and should be recorded as one.

## LD-2 — SHOULD FIX. The N2 alignment fix moved the pill the wrong way and doubled the offset.

The Designer measured the Back pill's centre 3 px below the bubble's and prescribed
`bottom: calc(91px + env(...))`. The build changed it to **84 px** (`index.html:3318`).

Measured live on Reports → History at 360×800:

| | top | bottom | centre | distance from viewport bottom |
|---|---|---|---|---|
| Back pill (h 42) | 674 | 716 | **695** | 84 |
| Help bubble (h 56) | 660 | 716 | **688** | 84 |

**Centre delta is now −7 px. Before the fix it was −3 px.** Horizontal clearance is unchanged and
still ample (65.8 px at 360, 45.8 px at 320), so nothing collides.

What the Dev actually implemented is **bottom-edge alignment** — both controls now sit 84 px above
the viewport bottom. That is a coherent rule, and for two floating objects of different heights it
is arguably a better one than optical centring. But it is *not* the finding, the commit does not say
it changed the rule, and the number the finding existed to reduce got larger.

Two acceptable outcomes; pick one and write it down:
- **Centre alignment** (what was asked): pill `bottom: calc(91px + env(...))`.
- **Baseline alignment** (what shipped): leave 84 px, and correct the record so the next reviewer
  doesn't "fix" it back.

My own view: N2 was a 3 px finding that should not have earned a code change at all. Acting on it
produced a 7 px offset. That is the clearest example in this release of a marginal finding costing
more than it returned.

## LD-3 — SHOULD FIX. Three of the five reply kinds have no route out; "are you a real person" has no controls at all.

S5's fix was applied exactly as the Designer specified — to the `answer` and `list` branches only.
Measured across every reply kind (`v8-final.mjs`), listing the buttons in the newest reply:

| reply kind | buttons | route to the 117 topics? |
|---|---|---|
| `person` | **none** | **no** |
| `clinical` with a topic | "Open the full walkthrough" | **no** |
| `clinical` generic refusal | "How do I record this in the app?" | **no** |
| `answer` | walkthrough + browse-all + alternates | yes |
| `list` | 2 topics + browse-all | yes |
| `none` | browse-all + try different words | yes |

The `person` reply is a **complete dead end**: two paragraphs and nothing to tap. Someone who opens
the panel and types "are you a real person" — a very likely first question for this audience — is
left with only the composer. That state existed before v56 too, but S5's stated rationale ("someone
whose question was not understood had no route to the full list except closing the panel") applies
to it more strongly than to the `answer` branch it was applied to.

**Fix:** call `helpBotBrowseLink()` at the end of `helpBotReply`'s `person` branch and both
`clinical` branches, rather than only in `answer` and `list`.

Two smaller problems in the same fix, both prescribed by the Designer:

- **Placement inverts the hierarchy.** Measured order in the `answer` branch: primary CTA →
  *Browse all 117 help topics* → "NOT WHAT YOU MEANT?" → alternates. The generic escape hatch
  outranks the specific alternatives. It belongs after the alternates.
  (`S5-browse-link-360.png`.)
- **The 44 px hit area is mostly air.** The link measures 185.5 × 44 with `padding: 0` and a 15 px
  text line — 29 px of invisible target, 10 px above and 12 px below, so it reads as a floating
  fragment rather than a row. `padding: '4px 0'` plus a smaller `minHeight`, or a real row with a
  chevron, would sit better in the file's rhythm.

---

# 3. What the Designer did not cover — and what I found there

Their sweep was 320/360/390/430/519/520/521/768 plus one landscape and two keyboard heights, all on
an **empty** profile. Here is everything Aaron listed plus what I added.

### 3.1 The panel over a populated app — **this is where LD-1 lives**
Built a real profile through the UI: two windowed medications (Ondansetron 08:00/14:00,
Dexamethasone 09:00), then advanced the simulated date by a day so the missed-dose state is genuine,
not mocked. Result: `0/3` dose ring, the red **"2 missed doses from previous days"** banner, a
per-window "Missed dose" card, a populated Quick Log and Today's Journal.

- Panel over populated Home, Meds, In-Patient, Symptoms and the Reports → History detail: no
  horizontal overflow anywhere (`documentElement.scrollWidth - innerWidth === 0`), panel geometry
  unchanged, transcript readable over dense content. `G1-home-panel-answer-390.png`.
- The help answer for "why does it say I missed a dose" is the right topic and reads correctly over
  the red banner it explains.
- **The FAB regression only becomes visible here** (LD-1). On an empty Home the bubble sits over the
  gradient; with medications present it sits on white cards.

### 3.2 `prefers-reduced-motion` — **covered; the global rule does reach `sheetUp`**
Under `reducedMotion: 'reduce'`, the panel's computed `animation-name` is `sheetUp`,
`animation-duration` **1e-05s**, `animation-iteration-count` **1**, `transition-duration` 1e-05s,
`transform: none`. The `*{animation-duration:0.01ms !important}` rule at `index.html:67` beats the
inline shorthand, and because `sheetUp` is one-shot it snaps to its end state — the exact case the
file's own comment at `index.html:3136` says the global rule handles. I also swept every element on
screen for a looping animation while the panel is open: **none**. No `tourPulse`-style defect here.

### 3.3 Forced colours (Windows HCM / Android high-contrast) — **holds up**
`G3-forced-panel-390.png`. The panel, header, close button, urgent rule, callout, steps and
composer all survive and stay readable. The new send glyph reads as an outline. The user's own
message loses its bubble and becomes right-aligned plain text — expected forced-colours behaviour,
still distinguishable by alignment. Nothing unreadable, nothing invisible.

### 3.4 Dark OS setting — **the app has no dark support at all; the panel does not make it worse**
Under `colorScheme: 'dark'` the panel stays white on a light app. There is no `color-scheme` meta
and no dark tokens anywhere in `index.html`. Pre-existing and app-wide; nothing v56 introduced.
Worth a backlog line, not a v56 finding.

### 3.5 Text scaled up
- **Browser zoom 200 %** (layout viewport halved): no overflow, panel 280 × 532.6 with 24 px of
  clearance above, input and 44 px send button intact. Two observations
  (`G4-zoom200-195x422.png`): the header subtitle wraps to two lines — the N6 case, which is
  **reachable on a normal phone at 200 % zoom**, not just at 320 px as the Designer scoped it; and
  the panel occupies 83 % of the viewport height, see 3.10.
- **Root font 24 px:** the panel's type does not change at all. Every size in the panel — and in
  `TYPE` — is an absolute px value, so an OS/browser text-size preference has no effect. App-wide
  and pre-existing, but the panel is now the home of the app's smallest text (12 px, 12.5 px), so it
  is the surface where this bites first. Backlog.

### 3.6 The panel while a toast is showing — **new, uncovered, cosmetic**
`G8-panel-with-toast-390.png`. The toast is `z-index: 50`; the panel is `38`. A toast raised while
the panel is open paints **over the transcript** and, at 390 px, covers the last two starter chips
("Get my records out of the app", "Browse all 117 help topics").

Mitigations that make this cosmetic rather than a defect: the toast is `pointer-events: none`, so a
tap on a covered chip still reaches the chip (verified by `elementFromPoint`), and it auto-dismisses.
But it does land squarely in the reading area rather than below it. Backlog: raise the toast's
`bottom` while `state.helpBotOpen`, or drop it under the panel.

### 3.7 The very first screen after the tour — **fine**
`G8-first-screen-after-tour-390.png`. The bubble is present the instant "Skip guide" is tapped, and
the "Welcome to ChemoWell" toast sits at 630–694 against the bubble's top edge at 704 — **10 px of
clearance**, so §2.2's toast-clearance analysis holds at 390 as well as 360. Opening the panel from
that first screen works normally (subject to 3.6).

### 3.8 Long single-word input with no spaces — **clean**
A 69-character unbroken word: bubble 259.1 × 80.8 at `left 78.9 / right 338`, `word-break:
break-word`, `log.scrollWidth === log.clientWidth === 342`, document overflow 0. A 200-character run
of `a` (the input's `maxlength`) behaves identically. `G6-longword-360.png`.

### 3.9 RTL — **layout mirrors; three physical properties don't**
With `dir="rtl"` the panel mirrors correctly: composer reverses (send at `left 19`, input at 71),
close button moves left, text right-aligns, no overflow. `G7-rtl-panel-360.png`. Three things stay
physical:
- the send glyph does not flip (a directional icon in a mirrored layout),
- `helpBotNotice`'s `borderLeft` accent rule stays on the left, i.e. on the *trailing* edge,
- the bubble and the wide panel are anchored `right: 14px`.

The app ships English only, so this is theoretical. Recording it because `helpBotNotice` is **new
code in v56** and hardcodes `borderLeft`; if RTL ever lands, the shared component is where to start.

### 3.10 Added by me: the declared 72 vh height cap never applies
`renderHelpBot` declares `maxHeight: 'min(72vh, 560px)'`, but `helpBotSyncViewport` immediately
overwrites it with `Math.min(560, Math.max(240, vv.height - 108)) + 'px'`. Measured inline
`max-height` at 360×800 is a bare `560px` — the `72vh` limb is gone. For any viewport height between
**386 and 668 px** the JS value is larger than 72 vh, so the panel exceeds its own stated cap:
292 px vs 288 at a 400 px landscape, and 533 px vs 461 at the 641 px height produced by 200 % zoom
(83 % of the screen). Not a defect on a real phone in portrait, where both resolve to 560. But the
Designer listed height clamping under "already right, do not change", and the declared rule is dead
code. Backlog.

### 3.11 Added by me: outside v56's surface, but measured while sweeping
The **active** bottom-navigation label is `11px / 700 / rgb(10,107,74)` on the active pill
`rgb(228,209,191)` = **4.40 : 1** — under AA, and below the file's own "no text below 12 px" rule.
Pre-existing, app-wide, nothing to do with v56. `BACKLOG.md` item, flagged so it isn't lost.

### 3.12 Environmental note
Four `cdn.jsdelivr.net` Capacitor scripts fail to load in this sandbox (proxy TLS). That is the
harness, not the app. No page errors and no application console errors in any run.

---

# 4. Design-system consistency of the fixes

**`helpBotNotice()` — used everywhere it should be, within its scope.** Both panel notices go
through it: `helpBotCallout` (medical topics, urgent/attention tone) and the generic clinical
refusal. The `person` and `none` replies correctly do *not* use it — they are not notices. Nothing
in the panel still hand-rolls a notice.

**What still differs from `renderHelpView`'s callout:** everything geometric, at a consistent ~0.89
scale (table in §S2). Weight, tone accent, chip colours, icon choice and copy are now identical.
They read as one component at two sizes. The commit's "one shared shell" wording is wrong; the
result is right.

**One new type step outside `TYPE`.** `helpBotNotice`'s heading is a raw `14px / 700`, which is not
a `TYPE` token — it sits between `caption` (13/600) and `bodyBold` (15/700). The whole panel uses
raw px, so this is consistent with its neighbours rather than with the file's token discipline. If a
compact scale is going to persist, it should be named. Minor.

**Chip fill across every place chips render.** Every chip in the panel — greeting starters,
browse-all, "How do I record this in the app?", the `answer` alternates, "Try different words" —
computes to `rgba(200,83,32,0.1)` over `#FFF6F1` = `#FAE6DC`, border `rgba(246,108,49,0.22)`, text
`#8A3D14` at **6.30 : 1**, `min-height: 44px`. Uniform, no exceptions.

**Specifically on Aaron's question — chips inside the urgent callout:** they never render there.
Verified by containment test on the tylenol refusal: the "How do I record this in the app?" chip is
a **sibling** of the notice, not a child, so it sits on the bot bubble's `#FFF6F1` like every other
chip, not on the notice's white. No context in the feature puts a chip on a white background, so the
new fill has exactly one composite to worry about and it is the one measured above.

**The bubble against every background it can appear over** — measured in §LD-1. That is the
inconsistency.

---

# 5. What the Designer got wrong

Stated plainly, because Aaron acted on all of it.

1. **N2 was a bad finding.** A 3 px centre offset between two floating controls 66 px apart is
   below the threshold at which a code change pays for itself. It was acted on, in the opposite
   direction, and the offset is now 7 px (LD-2).
2. **N1's preferred option created a worse accessibility failure than the one the same report
   raised in N3.** The report flagged a 2.4 : 1 focus ring as under the 3 : 1 non-text floor, then
   recommended a bubble fill that puts the control's own boundary at 1.00–1.38 : 1 (LD-1). The
   stated justification — "the same treatment the panel's own header icon chip uses" — is not
   accurate; that chip is tinted, not white.
3. **S1's prescribed colour does not do what the finding says it will.** `#A83D0F` vs `#BF4C1A` is
   1.28 : 1. The report's own alternative would have worked.
4. **S10's stated 7.14 : 1 is wrong** — 6.30 : 1 measured in situ. And the finding's framing implies
   a separation fix; the measured chip-vs-bubble separation is 1.13 : 1, and the pattern the report
   praises as better measures 1.07 : 1. Conclusion unaffected, premise not supportable.
5. **S5's prescribed placement inverts the reply's hierarchy** and its prescribed scope leaves three
   of five reply kinds without a route out, including a total dead end (LD-3).
6. **"Height clamping … behaves correctly, never a takeover" is not supportable as written** — the
   declared `min(72vh, 560px)` is overwritten by JS and never applies (§3.10).
7. **N6's `~79 characters per line at 519`** is high. Measured at the equivalent full-bleed width the
   body copy runs closer to 55–60. The breakpoint conclusion is unaffected and still correct.

And one that is Aaron's brief rather than the Designer's report: **the brief says "all 4 nice-to-have
findings" were applied. The report has six (N1–N6), and two of them are not in the build.**
- **N5** — `+ N more steps` is still `12.5px / 600 / #7A6E76 / marginTop 7px` at `index.html:6493`,
  exactly as the finding describes the defect. Visible in `S5-browse-link-360.png` reading as a
  greyed-out fourth step directly above the CTA.
- **N6** — the header subtitle string is unchanged, and §3.5 shows it wrapping at 200 % zoom on a
  390 px phone, not just at 320 px.

Neither is a blocker. But the record should say four of six, not all of them.

---

# 6. Sign-off

**Checked, on the running product, re-measured from scratch:** M1, M2 (incl. a 14-width sweep, both
rotation directions and a forced re-render), M3, S1–S10, N1–N4; `helpBotNotice`'s usage and its
remaining deltas from `renderHelpView`; the chip fill in every context it renders; the bubble
against every background on all five tabs; a populated profile with real medications and a real
missed-dose banner; reduced motion; forced colours; dark; 200 % zoom; a 24 px root font; a live
toast over the panel; the first screen after the tour; unbroken 69- and 200-character input; RTL;
the declared vs applied height cap; and a full contrast sweep of every text node in the panel.

**Found:** twelve of thirteen re-checked fixes real and correctly applied; one must-fix regression
(LD-1), two should-fix items (LD-2, LD-3); two nice-to-haves believed applied that are not (N5, N6);
seven places where the Designer's report is wrong or overstated (§5); and one uncovered interaction
(toast over panel) plus five backlog items.

**Open, and my recommendation:**

| | item | action |
|---|---|---|
| **Must fix before release** | LD-1 — bubble boundary 1.00–1.38 : 1 on every screen | `border: '2px solid #BF4C1A'` on `#helpbot-fab` |
| **Should fix** | LD-2 — pill/bubble offset 3 px → 7 px | Pick centre (91 px) or baseline (84 px) and record the rule |
| **Should fix** | LD-3 — `person` reply is a dead end; no browse route on either `clinical` branch | `helpBotBrowseLink()` in those three branches |
| Backlog | S5 browse link sits above the alternates; 29 px of empty hit area | reorder + tighten |
| Backlog | N5 and N6 not applied | apply or formally decline |
| Backlog | S1 — the two fills are 1.28 : 1 apart | consider the report's own quiet-tint alternative |
| Backlog | Toast (z 50) paints over the panel (z 38) | lift the toast while the panel is open |
| Backlog | Declared `min(72vh, 560px)` never applies | make the JS clamp honour it, or delete the declaration |
| Backlog | Panel type is absolute px; no dark tokens; active nav label 4.40 : 1 at 11 px | app-wide, outside v56 |

With LD-1 fixed, this feature is ready for the PM gate. LD-2 and LD-3 are cheap enough that I would
take them in the same pass rather than carry them.

---

## Evidence index — `outputs/v56-lead-designer/`

| file | shows |
|---|---|
| `M1-send-crop.png` | M1 — the new send glyph, 2× |
| `M2-landscape-740x400.png` | M2 — 380 px card after rotation, panel 380×292 |
| `S1-user-bubble-vs-cta-360.png` | S1 — user bubble `#A83D0F` and CTA `#BF4C1A` in one frame, 1.28 : 1 apart |
| `S2-walkthrough-callout-360.png` | S2 — the walkthrough callout, for the ~0.89 scale comparison |
| `S3-refusal-tylenol-360.png` | S3 — the generic refusal in the full notice shell |
| `S5-browse-link-360.png` | S5 (and N5 unapplied) — browse link above "Not what you meant?" |
| `N2-reports-detail-360.png` | LD-2 — pill and bubble, bottoms aligned, centres 7 px apart |
| `N3-fab-focus-ring.png` | N3 — the 3 px `#2A2127` ring, 14.64 : 1 |
| `G1-home-populated-fab-390.png` | populated Home: missed-dose banner, real meds, the bubble |
| `G1-fab-over-white-card-crop.png` | **LD-1** — the white disc's boundary disappearing on a white card |
| `G1-home-panel-answer-390.png` | the panel answering over a populated Home |
| `G1-inpatient-fab-390.png` | the bubble on In-Patient |
| `G3-forced-panel-390.png` | forced-colours mode |
| `G4-zoom200-195x422.png` | 200 % zoom — subtitle wraps, panel at 83 % height |
| `G6-longword-360.png` | 69-character unbroken word |
| `G7-rtl-panel-360.png` | RTL |
| `G8-first-screen-after-tour-390.png` | first screen after the tour, toast 10 px clear of the bubble |
| `G8-panel-with-toast-390.png` | toast painting over the transcript |

Harness: `lib.mjs` (boot, contrast helpers), `lib2.mjs` (profile seeding), `v1-fixes.mjs`,
`v2-resize.mjs`, `v3b.mjs`, `v4-populated.mjs`, `v5-gaps.mjs`, `v6-consistency.mjs`,
`v7-extra.mjs`, `v8-final.mjs`, `v9-s7.mjs`.
Run: `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node vN.mjs`.
