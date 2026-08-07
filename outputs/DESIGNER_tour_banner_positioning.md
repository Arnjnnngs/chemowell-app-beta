# Designer Review: Tour Banner Positioning Fix

**Scope:** `positionTour()` / "v12: slim banner mode" change in `index.html` — banner docks just
above compact, lower-screen targets (bottom-nav tabs) instead of always pinning to the top.

**Method:** Playwright (chromium), live at `http://127.0.0.1:8936/index.html`, walked through real
onboarding (name + Female + Chemo + "Get started") and the actual tour with real target clicks
(`advanceOn` events), at 390x844 and 1280x900. Screenshots in `./tour-banner-screenshots/`.

## Findings

**Step "Tap Meds"** (`step2-tap-meds_*.png`) — Banner now docks directly above the bottom nav,
its bottom edge sitting ~10px above the pulsing green-outlined Meds tab. At both viewports the
banner and the highlighted tab read as one connected unit; nothing overlaps, and the highlight is
fully visible. This is the clearest win from the fix — previously the banner was at the very top,
as far as possible from this target.

**Step "Tap Add"** (`step3-tap-add_*.png`) — Target (`meds-add`) is already near the top of the
Meds view, so the banner correctly stays top-pinned. No overlap with the highlighted Add button at
either viewport; the gap is small but the button is unambiguously visible and tappable.

**Step "Fill in the details"** (`step4-fill-details_*.png`) — Medication editor form is large, so
per the fallback rule the banner stays top-pinned. It sits above the "Meds" section header and the
"Add medication" panel; the "Medication name" field (first thing the user needs) is fully visible
and unobstructed at both viewports.

**Highlight visibility:** the pulsing green outline is clearly visible and never hidden or
clipped by the banner in any of the three steps, at either viewport.

**Incidental, out-of-scope observation:** a leftover "Welcome to ChemoWell" toast (fired by
`completeSetup()`, unrelated to this banner fix) is still on-screen in the step 3/4 screenshots and
partially covers the "Daily limit" field. This is pre-existing toast-timing behavior, not something
introduced by the banner positioning change, and doesn't affect the banner itself.

## Verdict: PASS

The banner now behaves exactly as Aaron asked — it docks close to compact, low-screen targets
(Meds/Home tabs) and falls back to the safe top position when the target is already near the top
or too large to dock above without covering it. No overlap, cramping, or hidden content observed
at either viewport.
