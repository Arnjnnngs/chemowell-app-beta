# LEAD_DESIGNER_SIGNOFF_v20_restart — checking DESIGNER_REVIEW_v20_restart.md

Role: Lead Designer (Quality Chain stage 4) · Date: 2026-07-27 · Build: app-v20 restart (`const APP_VERSION = 'app-v20'`, `index.html:3531`) · Method: independent re-inspection of the RENDERED product at `http://localhost:8910/index.html`, driven via Playwright (Chromium, `executablePath` pointed at the sandboxed browser build since the default install path was missing — same rendering engine, not a stand-in). Fresh onboarding, wiped storage. Viewports actually used: **390×844** (parity with Designer) and **360×740** (smallest supported width, per TEAM.md's explicit "smallest viewport" callout — the Designer's report only covered 390/1280). Live DOM state, `getComputedStyle()`, and `getBoundingClientRect()` were read directly, not screenshotted-and-eyeballed. This is a narrow re-check of a narrow fix pass, not a full re-review — I sampled the Designer's four PASS claims and one thing their pass structurally couldn't have caught.

Setup performed independently (not reused from Designer's session): wiped `localStorage`, completed onboarding (name "Arjun" → Get Started → Skip guide → waited 4.7s for toast), set the treatment date to today (Jul 27) via the Home date picker, then built the two combination states myself through the real UI — Meds → Add → Scheduled → Treatment-day availability → Excluded — rather than trusting the Designer's screenshots.

---

## Checked

1. **New standalone "Excluded near treatment day" inert card — style match, independently re-pulled.**
   Built "Excluded Only Test" (`treatmentMode:'excluded'`, never paused, treatment date = today so the −1/+1 window is active) and read its live computed style directly from the DOM:
   - `background-color: rgba(125, 105, 116, 0.06)`
   - `border: 1px dashed rgba(125, 105, 116, 0.3)` (the `1.5px` source value sub-pixel-rounds to `1px` under `getComputedStyle`, as the Designer noted — confirmed this is a `getComputedStyle` display artifact, not a rendering defect, by reading the source style attribute directly: `border: 1.5px dashed rgba(125, 105, 116, 0.3)`)
   - `border-radius: 16px`, `padding: 10px 12px`
   - `cursor: auto`, no `<button>` descendant — non-interactive, as claimed.

   I then independently grepped `index.html` (not the Designer's citations) for the same recipe and found it used verbatim in four places: the Paused card (`index.html:2710`), this new Excluded card (`index.html:2723`), the In-Patient-Restricted card (`index.html:2730`), and the Not-scheduled-today card (`index.html:2735`) — identical `background`/`border`/`border-radius`/`padding` on all four. The Designer's citation is accurate; this is a genuine, byte-identical reuse of the existing inert-card family, not a new pattern.

2. **Paused + Excluded combination — rebuilt myself, Resume clicked for real.**
   Built "Excluded Paused Test" (`treatmentMode:'excluded'`, active window), then paused it via the Meds-tab editor's "Pause" toggle (confirmed via `localStorage` before/after: `paused:true`, `pausePeriods:[{start:..., end:null}]`). On Home, the standalone card rendered "Excluded Paused Test — Paused" / "Not tracked while paused. Resume anytime." with a live-measured Resume button at **92.2 × 44px** — meets the 44px minimum, matching the Designer's figure exactly.
   Clicked Resume for real (not simulated). Confirmed via `localStorage` that the pause period closed (`end` set to the click timestamp, `paused:false`) and the card correctly fell through to the "Excluded near treatment day" inert card — not vanished, not stuck on "Paused." This is the exact P1-2 combination state the audit caught; it resolves correctly end-to-end on the live build.

3. **Smallest realistic viewport (360×740) with a long medication name — not tested by the Designer, tested here.**
   The Designer's report covers only 390×844 and 1280×900. TEAM.md assigns this stage specifically the job of probing the smallest viewport the Designer's pass didn't reach. Added "Extended-Release Metoprolol Succinate" as a third excluded medication and loaded Home at 360×740:
   - `document.documentElement.scrollWidth` (360) equals `window.innerWidth` (360) — **no horizontal overflow** anywhere on the page.
   - The new inert card's right edge sits at 344px, 16px inside the 360px viewport edge — no clipping.
   - The title wraps cleanly to two lines inside the card (title `getBoundingClientRect()` right edge stays inside the card's right edge); the card grows from 61px tall (single-line name) to 82.5px tall to accommodate, which is correct flex/wrap behavior, not a bug.
   - Screenshot confirms clean wrapping with no clipped text or layout break. **No defect found** — the underlying implementation handles this correctly even though the Designer's pass never exercised it.

4. **Quick Log collapsed count vs. the new inert card — sanity-checked, found a legitimate (non-blocking) concern.**
   With two medications on Home, both ending in the `treatmentMode:'excluded'` + unpaused state (zero actionable Quick Log cards — both fully inert), the collapsed Quick Log header reads **"Quick Log (2)"**. This is *functionally correct* and matches the Developer brief's explicitly-documented, accepted behavior change (the count was already inclusive of `paused` medications before this fix; being inclusive of excluded-and-unpaused ones now is consistent, not a new class of thing). It does not overflow or clip at 360/390px.
   However: a caregiver glancing at a collapsed "Quick Log (2)" badge reasonably reads that as "2 things to log," and in this state there are zero loggable cards behind it — both are inert. This is a real legibility gap worth flagging to Aaron, even though it is not a bug relative to the dev brief's stated scope (the dev brief explicitly named this an accepted side effect, not something this pass was asked to solve). Separately: **the Designer's report never actually tested or screenshotted the collapsed-count state** — DEV_BRIEF's own P1-2 test scenario #7 asks explicitly for this check ("Quick Log collapsed count — confirm it now includes excluded-and-unpaused medications... verify it's not confusingly larger than the number of actionable cards without also causing visual/layout issues"), and none of the Designer's 10 screenshot filenames correspond to a collapsed-count state. This is a coverage gap in the Designer's pass, distinct from the underlying implementation (which is fine).

## Found

- No code defects. The two P1-2 combination states (excluded-not-paused, excluded-and-paused-with-Resume) both render and behave correctly on the live build, independently reproduced end-to-end, not just re-read from the Designer's screenshots.
- **Non-blocking, for-the-record note #1:** Quick Log's collapsed "(N)" count can now read as "N things to do" while including medications that are fully inert (excluded-and-unpaused). This is intentional per the dev brief and not something this restart was scoped to fix — flagging for Aaron's awareness as a possible future copy/UX tweak (e.g., a distinct empty-state treatment when the collapsed count is entirely inert cards), not a blocker.
- **Non-blocking, for-the-record note #2:** the Designer's review tested only 390×844/1280×900 and never captured the collapsed Quick Log count state, despite both being explicitly called out — 360px by TEAM.md's standing rule for this stage, the collapsed-count check by the dev brief's own P1-2 test scenario #7. I closed both gaps myself this pass and found no defect in either, so this is a process note about the Designer's coverage, not a defect that needs to go back to the Lead Developer.

## Still open

- Nothing code-side. The two notes above are documentation/process observations, not defects — no action needed before QA Tester.

## Verdict

**Cleared to proceed to QA Tester (stage 5).** The Designer's PASS verdict holds up under independent re-verification: the new inert card is a genuine, pixel-exact reuse of the existing family (confirmed against source, not just citation), and the paused+excluded combination — the actual P1-2 bug — resolves correctly on the live build, including a real (not simulated) Resume click. The one gap in the Designer's own coverage (smallest viewport, collapsed count) has been closed here and produced no new findings. The two UX notes above are worth relaying to Aaron but do not block this restart from moving forward.
