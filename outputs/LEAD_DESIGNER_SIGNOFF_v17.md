# LEAD_DESIGNER_SIGNOFF_v17 — Review of the Designer's v17 review

Role: Lead Designer (Quality Chain stage 4) · Date: 2026-07-26 · Build under review: app-v17 (tour banner/target green attention treatment)
Reviewed artifact: `outputs/DESIGNER_REVIEW_v17.md` (original review + RE-VERIFICATION section) against the live app at http://localhost:8917/index.html and the source in `index.html`.
Method: independent re-verification, not a re-read of the Designer's report. Headless Chromium (Playwright, `/opt/pw-browsers/chromium-1194`), viewports 360x740, 390x844 (primary, DPR2/touch), plus keyboard-open 360x400/390x480. Fresh `localStorage`/`sessionStorage` on every run (real first-run walkthrough, real taps, not simulated events). Independent WCAG contrast math in a standalone Node script (not copied from the Designer's numbers). My scripts and screenshots: `/tmp/ld-v17/*.mjs`, `/tmp/ld-v17/*.png`.

---

## 1. The two re-verified fixes — reproduced independently from scratch, no discrepancy

I did not take the Designer's re-verification numbers on faith. I recomputed and re-measured both, using my own method where the instructions asked for independence (different sampling interval/duration than the Designer used).

**Item 2 — pulse contrast floor.**
- Independent WCAG relative-luminance/contrast implementation (`/tmp/ld-v17/contrast.mjs`), computing the outline color at each alpha step against (a) white and (b) the med-editor card's effective background. I derived the card's effective color myself from its actual CSS (`rgba(255,252,253,0.78)` at index.html:3028) composited over the page's own background at that scroll position (`#FAF7F6`/`#FBF0F2` per the header gradient, index.html:1907) — I did not reuse the Designer's `~#FEFBFB` number, I recomputed it (`254,251,251` over ivory, `254,249,251` over the pink top band — both round to the Designer's figure).
- My results at alpha 1.0: **5.05:1 vs white, 4.90:1 vs card** — exact match to the Designer's pre-fix table.
- My results at the shipped alpha 0.75: **3.15:1 vs white, 3.10:1 vs card** — exact match to the Designer's re-verification table.
- I additionally solved for the minimum alpha that clears 3:1: **0.7227 (white), 0.7322 (card)** — the shipped floor of 0.75 sits ~0.02–0.03 above both, which is the ~0.10–0.15 contrast margin the Designer described. Confirms the fix isn't a hairline pass.
- Live re-measurement on the running server, independent sampling parameters (60ms interval — Designer used 40ms/60ms in different checks — over a 3.4s window, one nav-meds target, `/tmp/ld-v17/pulse_check.mjs`): 47 samples, **min alpha 0.750, max alpha 1.000, zero samples below the floor**. Also confirmed the nav bar's actual computed background is `rgb(255,253,254)` — i.e. genuinely white, not a Designer approximation.
- **Verdict: CONFIRMED, no discrepancy.**

**Item 4 — `prefers-reduced-motion` actually stops the loop.**
- Live poll with parameters deliberately different from the Designer's (25ms interval — not 40ms — over 1.1s, on **both** the target element and `#tour-banner` simultaneously, not just the target alone; `/tmp/ld-v17/reduced_motion_check.mjs`). 38 samples per element.
- Result: `animationName` was `'none'` on **every single sample, both elements**; `outlineColor` was constant `rgb(46, 125, 79)` (full alpha) across all 38 samples with zero variation; inline `el.style.animation` was the empty string throughout — confirming the JS-level skip in `tourGlowAnim()`/`applyTourHighlight()` (index.html:1805–1824), not a CSS-cascade coincidence.
- **Verdict: CONFIRMED, no discrepancy.** The photosensitivity risk the Designer found pre-fix is genuinely closed.

---

## 2. Coverage check — every surface the Designer's table claims, independently exercised

I did not read the Designer's table and assume it happened. I ran a genuine first-run tour end-to-end myself (real taps, real med save) at **both required viewports** and read `getComputedStyle().outline` on every element in play:

| Surface | 360x740 | 390x844 |
|---|---|---|
| `#tour-banner` (steps 1–4) | present, green border+outline, `tourGlowAnim` active | same |
| `#tour-card` (steps 0, 5–9) | present, green border+outline | same |
| `nav-meds` | outline present (sampled alpha 0.98/0.91/0.88 across runs — always in-cycle, never below floor) | present |
| `meds-add` | present | present |
| `med-editor` | present (verified in banner mode, screenshot `390x844-step3-mededitor.png`) | present |
| `nav-home` | present | present |
| `quick-log` | present (centered-card step) | present |
| `nav-reports` | present | present |
| `nav-inpatient` | present | present |
| `nav-symptoms` | present | present |

All 8 `data-tour` targets plus the banner and card confirmed at both mandated widths — this matches the Designer's Item 1 table claim exactly; I found no target the Designer's table omitted and no target that fails to highlight.

**Keyboard-open heights (360x400, 390x480), med-editor step:** re-ran independently (`/tmp/ld-v17/final_checks.mjs`). `document.documentElement.scrollWidth === clientWidth` at both — **zero horizontal overflow**, matching the Designer's Item 5 claim.

**Banner clearance/pinning:** independently re-measured `getBoundingClientRect()` — `top: 8` at both 360 and 390 (`/tmp/ld-v17/overflow_and_clearance.mjs`), matching the Designer's number exactly. `top: calc(8px + var(--safe-top))` unchanged, v12 fix intact.

**`tourClearHighlight()` cleanup on Skip — re-checked at a different point in the flow than the Designer used** (Designer's report doesn't specify exactly which Skip they tested; I explicitly tested Skip from the **banner-mode "Skip" button at step 3, med-editor target**, a different step/mode than a generic mid-tour check): before Skip, `outline: rgba(46,125,79,0.843) solid 3px`, `animationName: 'tourPulse'`; after Skip, `outline: none 0px`, `animationName: 'none'`, both inline `style.outline`/`style.animation` empty. **No stray pulsing element left behind — confirmed independently, different entry point than the original review, same clean result.**

**Touch targets on the banner (More/Skip):** independently measured — both exactly `height: 44` (`/tmp/ld-v17/touch_target_check.mjs`), matching the DEV_BRIEF's 44px requirement.

**Green token consistency (this review's specific mandate — don't take the Developer's word for it):** I pulled `getComputedStyle()` on the actual rendered elements, not source greps:
- Tour highlight peak: `rgb(46, 125, 79)`.
- Settings → Profiles "Active" badge (index.html:3202): `rgb(46, 125, 79)` text, `rgba(46, 125, 79, 0.1)` background.
- Plans sheet "✓ Current plan" card border (index.html:1688, opened live via Settings → View plans): `rgb(46, 125, 79) 2px solid`.

All three are byte-identical to `#2E7D4F`. **Confirmed independently — no drift.**

One accuracy note, not a defect: both `DEV_BRIEF_v17.md` and `DESIGNER_REVIEW_v17.md` describe this badge as the **"med-manager 'Active' badge."** I traced index.html:3202 to its enclosing function and it is actually inside `renderSettings()`, in the **Settings → Profiles** section (the active-profile indicator), not a medications-list/med-manager surface. I grepped the whole file for every `'Active'` string (three total: this one, the Menstrual Cycle status pill at line 3452 which is **rose** `#A24C71` not green, and the In-Patient status pill at line 3531 which is **amber** `#9A6419` not green) — there is no medication-list "Active" badge anywhere in the codebase for this description to actually refer to. The color-consistency claim itself is correct (verified above); only its location label is wrong in both upstream documents. Cosmetic, but worth recording per TEAM.md's accuracy mandate.

---

## 3. Spot-check beyond the Designer's report

**(a) First/last tour step (target null, centered-card-only) — genuinely never explicitly judged by the Designer beyond listing it in the step table.** I checked whether a card-only treatment with zero outline anywhere on screen reads as intentional or incomplete. Verdict: **intentional and complete.** I queried every `[data-tour]` element's outline state at step 0 and step 9 — all six report `outline: 'none'`, confirming there is no leftover highlight, no orphaned outline, and no visual gap where a highlight was "supposed to" appear but didn't render. Visually (`/tmp/ld-v17/390x844-step0.png`, `390x844-step9-final.png`) the centered card alone, with its own green border/pulse, reads as a complete, deliberate "intro/outro" moment — it doesn't look like a missing target highlight, it looks like there's nothing to point at because there genuinely is nothing to point at. No defect.

**(b) The double-ring aesthetic (Designer's Item 3, "non-blocking suggestion") — I looked at it myself and made an independent call, not a rubber stamp.** Screenshot evidence: `/tmp/ld-v17/390x844-step0.png` and `390x844-step3-mededitor.png` (banner/card) versus `/tmp/ld-v17/step1-navmeds-full.png` (a single target outline, for comparison). My own read: the two concentric rings on the banner/card are more visually assertive than the Designer's writeup fully conveys — on the welcome card especially, it reads as a bold "sticker" outline with a visible ivory gap between the rings, a genuinely different visual language than the rest of the app's hairline-border system (`DESIGN_SPEC_B23.md`: "solid white cards with hairline borders... no glassmorphism"). I considered whether this crosses from "aesthetic nitpick" to "premium-bar FAIL" per TEAM.md's Designer mandate ("functional but ugly is a FAIL"). **My judgment: still non-blocking, not a FAIL.** Reasoning: (1) it never impairs legibility, touch targets, or function — confirmed above; (2) it's confined to the banner/card frame, not the target highlights, which stay clean single rings (see `step1-navmeds-full.png`); (3) making the tour visually loud was literally the point of this ticket (Aaron: "doesn't grab attention"), so a bolder-than-house-style frame on the tour specifically is arguably on-brief rather than off-system; (4) the Designer already attached two concrete, correctly-scoped exact-value fixes (`outlineOffset: '0px'` or a box-shadow swap) rather than leaving it as a vibe. I'd escalate this from "someday" to "do it in the very next pass touching this file" given how visually loud it is in practice, but I concur it should not block this ticket.

**(c) Version discipline — not covered by the Designer's review at all, and it should have been caught before this stage. This is the one real miss I'm flagging.**
`DEV_BRIEF_v17.md` §7 landmine 8 explicitly requires, as a non-optional Lead Developer step: bump `APP_VERSION`, bump `sw.js` CACHE, add a README version-history row — and TEAM.md states a missing README row is "an automatic PM-gate fail." I checked the actual source, not the Designer's or Developer's self-report:
```
index.html:3177   const APP_VERSION = 'app-v16';
sw.js:1            const CACHE = 'chemowell-app-v16';
README.md          no app-v17 row exists in the version-history table (top row is still app-v16, 2026-07-25)
```
Both `DEV_BRIEF_v17.md` and `DESIGNER_REVIEW_v17.md` refer to this as "Build: app-v17" throughout, but the app never actually became v17 in its own version string, the service-worker cache name, or the README. This is exactly the class of gap this stage exists to catch (the Designer reviewed the rendered behavior and never had a reason to check version bookkeeping) and exactly the class of gap the PM gate would bounce automatically. It is a small, mechanical, exact-value fix — not a design defect and not grounds for a full chain restart under the Owner's minor-fix amendment — but it must not ride forward silently.

---

## 4. What remains open

1. **Version discipline gap (new finding, §3c above) — blocking, must be fixed before this proceeds further down the chain.** Bump `APP_VERSION` to `'app-v17'` (index.html:3177), bump `sw.js` CACHE to `'chemowell-app-v17'`, and add the README version-history row, then re-confirm the version string live (same ritual as every prior release). Small fix, no re-review of design substance needed — a Lead Developer fix + a quick live confirmation is sufficient, per the Owner's minor-item amendment.
2. **Double-ring banner/card aesthetic (Designer's Item 3)** — confirmed non-blocking by independent judgment (§2b), still open as a queued polish item. Recommend prioritizing it in the next pass that touches `renderTourLayer()`, given how visually loud it actually is in the rendered product versus how it reads in prose.
3. **"med-manager 'Active' badge" mislabel** in `DEV_BRIEF_v17.md` and `DESIGNER_REVIEW_v17.md` — the badge in question is Settings → Profiles, not a medications surface. No code or color defect; a documentation-accuracy note for whoever writes the next brief that cites this element.
4. Everything else the Designer flagged as PASS (Item 1 target/banner coverage, Item 5 occlusion/layout/touch-targets) — independently re-confirmed with fresh evidence in §1–§2 above, nothing further open.

## 5. Verdict on the Designer's review

**PASS on the Designer's review itself** — every claim I re-tested (the two re-verified fixes, the 8-target + banner/card coverage, the clearance/overflow numbers, the cleanup-on-Skip behavior, the green-token consistency, the touch-target sizes) held up under independent measurement with my own tooling and my own sampling parameters, not a copy of theirs. I found no exaggerated or inaccurate claim anywhere in `DESIGNER_REVIEW_v17.md`, including the RE-VERIFICATION section. Coverage was genuinely complete for the ticket's actual scope (banner, card, all 8 targets, both mandated viewports, keyboard-open heights, reduced-motion, cleanup-on-end) — the two gaps I found were both **outside** what the Designer's role covers (release-version bookkeeping) or were explicit, reasoned, non-blocking judgment calls that I independently re-confirmed as reasonable (the double-ring note).

**Blocking condition before this proceeds to QA Tester (stage 5):** the version-discipline gap in §3c/§4.1 must be fixed. This is not a design defect and does not require restarting the chain — it's a mechanical fix the Lead Developer should apply and then this stage (or a quick self-check) should confirm the live version string reads `app-v17` before handoff continues.
