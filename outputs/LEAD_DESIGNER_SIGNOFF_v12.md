# LEAD_DESIGNER_SIGNOFF_v12 — check of the Designer's v12 review

Role: Lead Designer (stage 4, TEAM.md). Independently re-ran the REAL first-run flow on the rendered app at localhost:8877 (headless Chromium/Playwright, fresh localStorage → setup "Maya" → Get started → real taps through the whole tour). All numbers are live `getBoundingClientRect`/`getComputedStyle` values. No code was modified. Zero console/page errors in every run (360x740, 740x360, 320x740, 360x400); zero horizontal overflow at every size — corroborates the Designer.

Evidence: `outputs/leadv12-*.png` (15 screenshots). Reviewed against `outputs/DESIGNER_REVIEW_v12.md` (incl. its re-verification pass) and DESIGN_SPEC_B23.

**Verdict on the Designer's review: PASS.** Every re-verified measurement was accurate. Coverage gaps found (replay path, in-app tap targets the tour points at) produced new Minor/Moderate findings — none is a v12 regression, none invalidates the Designer's six verdicts. Findings D1–D5 below go back through stage 1 as new work per the restart rule.

---

## CHECKED — independent re-verification (at 360x740, a width the Designer used less)

### Claim 1: "the banner never overlaps its highlighted target" — VERIFIED at step entry, wording overstated when scrolled

- Measured 0.0 px² banner/target overlap at step entry on every banner step at 360x740: step 1 (nav-meds, banner bottom 71.8 vs target top 678), step 2 (meds-add, target top 267.5), step 3 (med-editor, target top 325.5), step 4 (nav-home, target top 678). Highlight outline (3px) present on every target. Screenshots `leadv12-360x740-step1..4-*.png`.
- **Caveat (accuracy, not a defect):** on step 3 the claim only holds at entry scroll. The med-editor target is 1,382.6 px tall; scrolled to the bottom (where the save button lives) its rect extends under the banner — measured 26,469.6 px² overlap (`leadv12-360x740-step3-scrolledbottom.png`). This is benign: the banner (bottom 88.7) sits entirely within the sticky header's footprint (header bottom 163.4 at this viewport), so the banner only covers content that is already scrolled under header chrome — no interactive element can be trapped beneath it, and the Save row stays reachable. The Designer's blanket "never overlaps" was measured at step entry only; future reviews should state the scroll condition. Design holds.

### Claim 2: 44px button heights — VERIFIED on tour controls; the floor was NOT checked on the in-app targets the tour points at (see D5)

Measured 44.0 px rendered height on every tour control at 360x740, across every step where each appears: banner "More" (44.0) and "Skip" (44.0) on steps 1–4; card "Skip guide" (44.0), "Back" (44.0), "Got it" (44.0), "Next" (44.0), "Show me" (44.0), "Finish" (44.0). Designer's F3/F4 re-verification is accurate.

### Claim 3: med-editor header balance — VERIFIED

Live DOM on step 3 at 360x740: header row has exactly 1 child (`rowChildCount: 1`), title "Add medication" renders 17px / 700 / letter-spacing −0.255px / ink `rgb(42,33,39)` — the exact TYPE.title spread (F5 confirmed applied) — and the gap from header row to the first field is 16.0 px. No orphaned right-side gap; single bottom Discard/Add pair confirmed as the only exits.

## CHECKED — coverage probes (surfaces the Designer did not exercise)

**(a) Replay via the header ? button (tour finished, med present).** Mechanics work: ? restarts at step 0, banner steps render identically, Discard on the editor steps back to the Add step, and the full replay flow advances correctly through save. But three defects — D1, D2, D3 below. Screenshots `leadv12-probe-a-replay-step2*.png`.

**(b) Back INTO banner steps from the step-5 card.** One Back from the step-5 card lands on the step-4 banner ("Medication saved! Now tap Home at the bottom.") while already on Home — coherent, and tapping Home again advances (navigateTo re-fires `view:home`), so it is not a trap. A second Back (via More → Back) reaches the med-editor step with NO editor open: banner instructs "Fill out the form, then tap Add medication at the bottom." with no form on screen and no highlight (target absent) — D4 below. Recoverable in the run: navigating Meds → Add → save advanced the tour to step 4/5 normally; Skip and Back both work throughout. Screenshots `leadv12-probe-b-*.png`.

**(c) Landscape 740x360 (short + wide) — PASS.** Welcome card fits (301.5 tall, bottom 330.8/360). Banners are 60px tall, 0 px² overlap with every target, highlights present. The tallest surface — the step-3 expanded card — is 350.3 px tall at top y=8, bottom 358.3: **1.7 px clearance, unclipped** (`leadv12-land-740x360-step3-expanded.png`). All Next/Back/Got it buttons fully in-viewport on steps 5–8 (card clipping 0.0 px everywhere, card-over-target overlap 0.0). At the limit but sound; any future copy growth on step 3 will clip at this height — noted for the queue.

**(d) 320px width + long patient name ("Alexandria-Konstantina Papadopoulos") — PASS.** Zero horizontal overflow on setup, steps 1–3, and the expanded card. Banner instruction wraps to 3 lines (col width 152.6), More/Skip remain 44.0 px, banner max height 97.6 px with 0 overlap. Expanded step-3 card bottom 732.3/740 — fits. The long name wraps the header display title to multiple lines rather than truncating, and the banner slices it mid-glyph — same accepted "content under a floating toast" pattern the Designer documented at 390; acceptable. `leadv12-320-step1-banner-longname.png`.

**(e) "Skip guide" from the expanded card mid-form — PASS.** With "Ondansetron" typed into the open editor: More → Skip guide removes the tour completely (no banner, no card, no leftover 3px outline anywhere in the DOM), the editor stays open, and the typed value is preserved. `leadv12-probe-e-*.png`.

## FOUND — new defects (none blocks v12; all route to stage 1 per the restart rule)

- **D1 — Moderate (UX, replay path; pre-dates v12).** Replaying the tour forces the user to create and save ANOTHER real medication to get past steps 2–3: the action steps have no Next, the expanded card offers only Skip guide / Back / Got it, and Discarding the editor steps backward. A user replaying to re-learn Reports or Symptoms must either add a junk med (a real record in a medication tracker) or Skip — which ends the whole tour and never shows steps 5–9. The `advanceOn` structure pre-dates v12, but replay is now a first-class path (step 9 advertises the ? button). Suggested direction for the brief: on action steps, show a "Next" affordance when `tourDone` was previously true, or a per-step skip.
- **D2 — Minor (copy, replay path).** Step 2/3 copy reads "Add your first medication" / "Tap Add to create your first medication." while existing med cards are visible directly under the banner (`leadv12-probe-a-replay-step2.png`). Understandable, but wrong on replay.
- **D3 — Minor (state, replay path).** Reloading mid-replay silently ends the tour: `startTour()` (line 1666) does not clear `tourDone`, and the resume path (line 3751) requires `!tourDone`. First-run progress survives restarts (audit 2.4); replay progress does not. Inconsistent, low impact.
- **D4 — Minor (UX, Back flow).** Backing into the med-editor step with no editor open renders an instruction about a form that is not on screen, with no highlight (target missing). Recoverable (Meds → Add → save advances; Skip/Back work) and only reachable by deliberate double-Back, but it reads as a dead end (`leadv12-probe-b-mededitor-noeditor.png`). Cheapest fix candidate: when the step target is absent, fall back to the previous actionable instruction or auto-step-back.
- **D5 — Minor (design system, pre-existing).** The 44px floor was verified on the tour's own controls but not on the in-app controls the tour instructs the user to tap: the step-2 target "Add" pill is **40.0 px** tall (`minHeight: '40px'`, index.html line 2965) — under the binding floor, and it is the mandatory tap of step 2. Related fragility: the med-editor save button "Add medication" is styled `minHeight: '42px'` (line 2890) and only renders 44.0 because flex-stretch matches it to Discard's 44px — a one-line style change elsewhere would silently drop it to 42.
- **D6 — Accuracy note on the Designer's report (no product change).** The "banner never overlaps its highlighted target" claim is true only at step-entry scroll position (see Claim 1 caveat). Report wording, not a defect.

## Judgment on the Designer's deferred note (toast at keyboard heights) — DEFER CONFIRMED, scope broadened

Correctly deferred: transient (4.5s), z-index 50 below the tour layer (80), pre-existing behavior, no data risk. Two additions for the queue item, from measurement:
1. It is not only a keyboard-height issue. At full 360x740 the post-save toast (bottom anchored `calc(96px + safe-area)`) landed directly over the "Log Zofran-B" quick-log button (`leadv12-probe-b-mededitor-noeditor.png`); at 360x400 the welcome toast sits mid-viewport (y 240.8–304.0) over form content (`leadv12-360x400-welcome-toast.png`).
2. The toast has computed `pointer-events: auto` with no interactive children — it swallows taps in its footprint for the full 4.5s. The queue item should include `pointerEvents: 'none'` on the toast alongside the position rethink; that alone removes the interaction cost at every height.

## STILL OPEN

- D1–D5 above: new work for stage 1 (Developer brief). None is a v12 regression; v12 ships as reviewed.
- Toast queue item (position on short viewports + `pointerEvents: 'none'`), now with measured evidence.
- Watch item: step-3 expanded card has 1.7px clearance at 740x360 — any copy growth on that step clips in landscape.
- Designer's optional F2/F5/F6 already applied and re-verified; nothing else open from their report.

**Sign-off: the Designer's v12 review PASSES.** All re-checked measurements reproduced exactly; verdicts stand. Coverage misses (replay path, in-app target heights, scrolled-state wording) are logged above and routed per the restart rule.
