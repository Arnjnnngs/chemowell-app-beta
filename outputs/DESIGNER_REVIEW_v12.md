# DESIGNER_REVIEW_v12 — Tour banner, med-editor cuts, Meds breadcrumb

Role: Designer (stage 3, TEAM.md). Reviewed the RENDERED app served at localhost:8877, headless Chromium (Playwright), running the REAL first-run flow: fresh localStorage → welcome/setup → name ("Maya") → Get started → full tour via real taps (nav Meds → Add → form fill → save → nav Home → Next×4 → Finish). No code was modified.

Viewports, mobile first: **390x844** (full flow), **360x400** (keyboard height, banner steps 1–4 + expanded card), **360x740** (all card steps), **1280x900** (desktop sanity, last). Zero console/page errors in every run. No horizontal overflow at any viewport (scrollWidth == innerWidth everywhere, measured).

Screenshots: `outputs/design-v12-*.png` (26 files). Measurements quoted below are live `getBoundingClientRect`/`getComputedStyle` values from the runs.

---

## Verdicts at a glance

| # | Item | Verdict |
|---|---|---|
| 1 | Banner visual quality | **PASS** — with 1 spec violation to fix (11px label) + polish |
| 2 | Banner-step clarity + target outline | **PASS** |
| 3 | Expanded card ("More") button row / 360px overflow | **PASS** — with 2 touch-target fixes (pre-existing pattern, now binding) |
| 4 | Med editor header + gap-hours placeholder | **PASS** |
| 5 | Meds page without breadcrumb | **PASS** |
| 6 | Remaining card steps occlusion at 360x740 | **PASS** |

The v12 concept is right: the slim banner reads as a premium coach-mark, the form is fully usable beneath it, and a real Playwright click on "Add medication" now succeeds mid-tour at every size including 360x400 (the v11 blocker). Findings below are polish, not structure.

---

## 1. Banner visual quality — PASS (one spec violation)

Evidence: `design-v12-390x844-step1-banner-meds.png`, `-step2-banner-add.png`, `-step3-banner-editor-top.png`, `-step4-banner-home.png`, `design-v12-360x400-step1/2/3/4-*.png`, `design-v12-1280x900-step1-banner.png`.

Measured geometry (390x844): banner 366.6×62.8 at y=8 (79.7 tall on step 3 where the instruction wraps to 3 lines); white `#FFFFFF`, `2px solid rgba(170,83,117,0.4)` border, `radius 14px`, shadow `0 8px 24px rgba(80,30,55,0.22)`, padding `6px 6px 6px 12px`.

What's good:
- The 2px rose border + 14px radius match the full tour card exactly — the banner reads as the same component, collapsed. Coherent.
- Shadow is strong enough to lift the banner off the pink header band without a colored glow. Premium, calm.
- Vertical rhythm is clean: text column top at y=16 == border(2)+padding(6)+top(8); More/Skip are perfectly vertically centered (9.4px above and below at every step, including the taller 3-line step-3 banner).
- Hierarchy of the right side is correct: "More" tinted pill (`rgba(162,76,113,0.10)` / `#8E3D61`) vs "Skip" plain text `#6E5A64` (5.6:1 AA on white). Both are true 44px-tall targets (measured 44.0).
- Header clash: the banner deliberately overlaps the brand row (heart/wordmark/?/gear), which is genuinely not needed mid-step. The banner's bottom edge does slice the display title ("Maya's Meds") mid-glyph at 390px — it reads as content scrolled under a floating toast, which is an established pattern; with the strong shadow it does not read as broken. Acceptable as shipped.
- Desktop 1280x900: banner caps at 720px (app column width), centered — sane.

**Findings:**
- **F1 (fix — spec violation).** GUIDE step label is `fontSize: 11px` (line 1701). DESIGN_SPEC_B23 item 16 sets a hard 12px floor with bottom-nav labels as the *sole* 11px exception, and explicitly listed the tour step label as an offender to raise. The expanded card's own GUIDE label is already 12px (line 1711) — the two labels for the same component should match anyway. **Exact fix: line 1701 `fontSize: '11px'` → `'12px'`** (keep 700/`#8E3D61`/0.06em; `#8E3D61` is 6.6:1, AA at any size).
- **F2 (polish, optional).** Gap between "More" and "Skip" is 5.9px while both are pill-shaped hit areas; the container `gap: 6px` also separates text from "More". Fine at 390/360, but a hair tight between two adjacent 44px targets. Suggestion: `gap: '8px'` on the banner container (line 1699) — costs 4px of text width, no wrap change at 360 (instruction column would go 194.2→190.2px, same line count, verified against the longest short-copy string).

## 2. Banner steps: instruction clarity + highlighted-element outline — PASS

- The `short` copy is a single imperative sentence naming the exact control and its location ("Tap Meds at the bottom of the screen." / "Tap Add to create your first medication." / "Fill out the form, then tap Add medication at the bottom." / "Medication saved! Now tap Home at the bottom."). Combined with the highlight outline, each step is unambiguous without the big card; "More" is there for the teaching text (as-needed vs scheduled) and works.
- Outline: `3px solid #E0679A`, offset 3px — clearly visible on every target in the screenshots: Meds tab and Home tab (bottom nav), the Add pill, and the whole med-editor section (reads as a rose ring around the form card). Against the ivory/pink canvas the saturated `#E0679A` pops without being alarming.
- **Measured: the banner never overlaps its highlighted target** — `bannerOverlapsTarget: false` on every banner step at 390x844, 360x400, 360x740, and 1280x900.
- Keyboard-height check (360x400, `design-v12-360x400-step3-namefocus.png`): with the name field focused, banner (top, 79.7px) + sticky header still leave the focused field fully visible with its focus ring, and Save is reachable by scroll — this exact scenario was 100%-occluded in v11. The v12 fix holds at the worst size.

## 3. Expanded card ("More" → "Got it" / "Back" / "Skip guide") — PASS (two touch-target fixes)

Evidence: `design-v12-390x844-step1-expanded.png`, `-step3-expanded.png`, `design-v12-360x400-step3-expanded.png`.

- Button row reads correctly: "Skip guide" plain text far left, "Back" ghost + "Got it" solid rose right — the same layout as Next-steps, so "Got it" sits exactly where "Next" sits. Good muscle memory.
- **No overflow at 360px:** card is 316.8px wide (`min(88vw, 330px)`); at 360x400 the card is 368.8px tall at y=23 → bottom 391.8 with 8.2px clearance inside a 400px viewport. Nothing clips; all three buttons fully inside (rightmost "Got it" ends x=318.4 vs card edge 338.4).
- "Got it" collapses back to the banner correctly (verified by interaction in the run), and `tourExpanded` resets on step change as documented.

**Findings:**
- **F3 (fix).** "Skip guide" on the card measures **31px tall** (line 1716, `padding: 8px 8px 8px 0`) — under the binding 44px floor, and it is the escape hatch we most want a tired user to be able to hit. **Exact fix: line 1716 add `minHeight: '44px'`** (keep the left-flush `padding: '8px 8px 8px 0'`; flex alignment keeps the row height unchanged since Back/Got it govern the row).
- **F4 (fix).** "Back", "Got it", "Next" are `minHeight: '40px'` (lines 1718–1720) — 4px under the floor. **Exact fix: `minHeight: '40px'` → `'44px'`** on all three. At 360x400 this grows the card to ~373px → bottom ~395.8, still inside the viewport (verified against the measured 8.2px slack).
- Note (accepted, not a defect): on the form step the expanded card necessarily overlaps ~20–25% of the 1,300px-tall highlighted form (measured 24.5% at 390, 20.5% at 360x400). That is the user's explicit, reversible choice ("More" → "Got it"), the form stays scrollable behind it, and the banner state never overlaps. This is the designed tradeoff and it is fine.

## 4. Med editor after the cuts — PASS

Evidence: `design-v12-390x844-step3-banner-editor-top.png`, `design-v12-390x844-gap-empty.png`, `-gap-filled8.png`, `-editor-bottom.png`.

- **Header row:** single left-aligned "Add medication" title (18px/800), one child in the row (measured `rowChildCount: 1`), 16px below to the first field. With the duplicate Cancel and the sub-copy gone the header is quiet and balanced — no orphaned right-side gap (justify-between with one child collapses cleanly). The single bottom action pair (Discard ghost + Add medication solid) is now the only exit, matching the tour copy "at the bottom".
- **Gap-hours placeholder:** empty field shows grey `0` — measured placeholder color `rgb(122,110,118)` = `#7A6E76` (4.9:1, AA) vs filled text `rgb(42,33,39)` = `#2A2127` ink. The two states are unmistakable side by side (`gap-empty` vs `gap-filled8` screenshots), and it now matches the Daily-limit field's pattern exactly. The v11 delete-the-0 defect is gone.

**Findings (polish, optional):**
- **F5.** Editor title is `18px/800` — off the TYPE scale (weight 800 is reserved for display/CTA per the spec's hard rule). **Exact fix: line 2846 → `...TYPE.title` (17px/700/−0.015em), keep `color: '#2A2127'`.** One-line change, brings the last ad-hoc heading in this surface onto the system.
- **F6.** Gap-hours has no helper line while its sibling Daily limit has "Leave blank for none." — mirroring it would make the empty state self-explaining: **`fieldLabel('Minimum gap hours', 'Leave blank for no minimum gap.')`** (line 2876). Copy-only; empty already saves as as-needed (verified in the run — saved med renders "Rules: Min 8-hour gap" when filled, "As needed" when blank per the Dev brief).

## 5. Meds page without the breadcrumb — PASS

Evidence: `design-v12-390x844-medspage-posttour.png`, `-medspage-bottom.png`, live DOM check.

- The last element in `<main>` is now the medication card itself (measured `lastChildText` = the Ondansetron card, bottom y=474.9, body scrollHeight = viewport height). No dangling text, no orphaned margin/divider where the Settings breadcrumb used to render — the page simply ends. The page caption ("Configuration is stored on this device…") remains as the single reassurance line, per the R3/R8 cuts. Clean.

## 6. Remaining card steps at 360x740 — PASS

Evidence: `design-v12-360x740-step0-welcome.png`, `-step5-quicklog.png`, `-step6-reports.png`, `-step7-inpatient.png`, `-step8-symptoms.png`, `-step9-finish.png` + measured overlap.

- **Measured 0% card-over-target overlap on every card step** at 360x740 (and 390x844): step 5 card sits above the highlighted QUICK LOG label; steps 6–8 cards sit 14–15px clear above the highlighted nav tab; steps 0/9 are centered with no target. The v11 sloppy cases (card covering a "Log" button on 6–8 at 360px) no longer block anything the step needs, and the elements the centered cards do cover (BP inputs, Pick-a-date) are not part of any step's task.
- The step-5→9 cards inherit findings F3/F4 (31px "Skip guide", 40px Back/Next) — same one-line fixes.

## Cross-cutting notes (for Lead Designer / next brief, not v12 blockers)

- The post-setup / post-save **toasts** ("Welcome to ChemoWell", "Ondansetron added…") float over mid-screen content for a few seconds and at 360x400 can momentarily sit over a form field (`design-v12-360x400-step3-namefocus.png`). Transient, z-index 50 (below tour), pre-existing behavior — worth considering a move to the top-of-content position on keyboard-height viewports in a future pass.
- BETA DATE CONTROLS strip in the sticky header is TEST_MODE-only and was ignored for layout judgment.

## Suggested exact changes (summary)

| # | Where (index.html) | Change |
|---|---|---|
| F1 | 1701 | banner GUIDE label `fontSize: '11px'` → `'12px'` (12px floor; matches card label) |
| F3 | 1716 | card "Skip guide" add `minHeight: '44px'` |
| F4 | 1718–1720 | "Back" / "Got it" / "Next" `minHeight: '40px'` → `'44px'` |
| F2 | 1699 | (optional) banner container `gap: '6px'` → `'8px'` |
| F5 | 2846 | (optional) editor title `fontSize:'18px', fontWeight:'800'` → `...TYPE.title` |
| F6 | 2876 | (optional) `fieldLabel('Minimum gap hours', 'Leave blank for no minimum gap.')` |

F1/F3/F4 are the ones I'd ask the chain to take (F1 is a written-spec violation; F3/F4 are the binding 44px rule on the tour's own controls). Per the restart rule they go back through stage 1 as new work; none of them blocks the v12 verdicts above.

---

## Re-verification (Designer re-pass, 2026-07-24)

Method: same as the original review — REAL first-run flow on the RENDERED app at localhost:8877 (headless Chromium/Playwright): fresh localStorage → setup name "Maya" → Get started → Show me → real taps (nav Meds → Add → form fill "Ondansetron" → save → nav Home). All numbers below are live `getComputedStyle` / `getBoundingClientRect` values, not code reads. Viewports: **390x844** (full flow) and **360x400** (keyboard height, banner + expanded card). Zero console/page errors in every run; no horizontal overflow (scrollWidth == innerWidth at both sizes). Evidence: `outputs/reverify-390-step3-banner-editor.png`, `reverify-390-step3-expanded.png`, `reverify-390-step5-next44.png`, `reverify-360x400-step3-expanded.png`.

| # | Item | Measured (live) | Verdict |
|---|---|---|---|
| F1 | Banner GUIDE label 12px | `fontSize: 12px`, weight 700, `#8E3D61` (rgb(142,61,97)), letter-spacing 0.72px — on steps 1 and 3, at both 390x844 and 360x400 | **VERIFIED** |
| F2 | Banner gap 8px | container computed `gap: 8px`; visual More→Skip edge gap **8.0px** (was 5.9) — steps 1 and 3, both viewports; More/Skip still 44.0px tall; banner 63.8px (step 1) / 80.7px (step 3, 3-line) — no wrap regression | **VERIFIED** |
| F3 | Card "Skip guide" minHeight 44px | computed `min-height: 44px`, box height **44.0px** (was 31) — step-1 card, step-3 card (390 and 360x400), and step-5 card | **VERIFIED** |
| F4 | Back / Got it / Next 44px | all computed `min-height: 44px`, box heights **44.0px** each: Back + Got it (step-1 and step-3 cards, both viewports), Next + Back (step-5 card via real flow through save), and the welcome card's "Show me" (same `step.next` button) | **VERIFIED** |
| F5 | Editor title TYPE.title | rendered "Add medication" title: `17px / 700 / letter-spacing -0.255px (= -0.015em) / line-height 21.25px (1.25)`, color `#2A2127` — exact TYPE.title spread | **VERIFIED** |
| F6 | Gap-hours helper | helper "Leave blank for no minimum gap." renders under the Minimum gap hours label (12px, present in live DOM on the as-needed editor) | **VERIFIED** |

**360x400 expanded-card re-measure (the tight one):** step-3 card with the taller 44px buttons is now **372.75px tall** (was 368.8 at 40px buttons), top y=19.0, bottom y=391.75 → **8.25px bottom clearance** inside the 400px viewport. Prediction in F4 (~373px, still inside) holds; the extra 4px of button height was absorbed by the card's internal flex rhythm rather than eating the clearance (the card repositions with 19px top / 8.25px bottom). All three buttons fully inside the card and viewport (button row bottom y=371.8; rightmost "Got it" right edge x=318.4 vs card right ~338.4). No clipping, no overflow (scrollWidth 360 == innerWidth). Screenshot `reverify-360x400-step3-expanded.png` confirms visually.

Interaction sanity re-checked in the same runs: "More" → card → "Got it" collapses back to the banner correctly at 360x400 (banner present, card gone), and the full flow through save → step 5 works with real taps.

**Overall: PASS.** All six items are correctly applied on the rendered app; no regressions introduced. v12 stands as approved with the fixes in.
