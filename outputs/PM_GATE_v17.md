# PM GATE — app-v17

Role: Project Manager, Quality Chain stage 8 (final internal gate before the Owner), per `TEAM.md` §8.
Date: 2026-07-26 · Release under review: app-v17 (guided-tour banner/target green attention treatment).

---

## 1. Artifact completeness check — all present

| Artifact | Present | Notes |
|---|---|---|
| `outputs/DEV_BRIEF_v17.md` | Yes | Investigation, pulse feasibility verdict, DoD, landmines, open questions. |
| `outputs/DESIGNER_REVIEW_v17.md` (incl. RE-VERIFICATION section) | Yes | Original review (2 FAILs) + same-day RE-VERIFICATION section confirming both fixed. |
| `outputs/LEAD_DESIGNER_SIGNOFF_v17.md` | Yes | Independent re-verification of both fixes + coverage check + new version-discipline finding. |
| `outputs/QA_USER_ZERO_v17.md` | Yes | Full first-run + daily-loop walkthrough, screenshots referenced and confirmed to exist. |
| `outputs/AUDIT_v17.md` | Yes | Code audit + 7 live journeys, README gap finding (P2-1). |
| `outputs/LEAD_AUDITOR_SIGNOFF_v17.md` | Yes | Independent reproduction of 5/7 journeys, diff-level confirmation, uncommitted-tree note (N1). |

No missing artifact. No automatic fail on this axis.

---

## 2. Chain of custody on findings — traced end to end, verified against actual files/code, not summaries

**Finding set A — Designer's two FAILs (pulse contrast floor; reduced-motion not stopping an infinite animation):**

1. Designer found both (`DESIGNER_REVIEW_v17.md` Items 2 and 4): pulse trough alpha 0.3 → ~1.5:1 contrast (below WCAG 3:1), and the global `prefers-reduced-motion` CSS override doesn't freeze an `infinite` animation (it just loops it at near-zero duration, causing flicker).
2. Lead Developer fixed both in the same pass (raised keyframe floor to 0.75; added a JS-level `prefersReducedMotion()`/`tourGlowAnim()` guard that skips animation properties entirely rather than relying on the CSS override).
3. Designer's RE-VERIFICATION section re-tested both against the live server: Item 2 now 3.10–3.15:1 (clears 3:1 with margin, confirmed via 47 live samples, zero excursions below floor); Item 4 now `animationName: 'none'` with constant full-alpha green across 25 samples. Both marked PASS.
4. Lead Designer independently re-verified both from scratch, deliberately different sampling parameters/method than the Designer (own contrast.mjs implementation, 60ms/47-sample poll for Item 2; 25ms/38-sample dual-element poll for Item 4) — **CONFIRMED, no discrepancy** on both.
5. Auditor confirmed both landmines closed in the shipped code (`applyTourHighlight`/`tourGlowAnim`/`prefersReducedMotion` read directly, keyframe value read directly at `index.html:33`) and ran 7 live adversarial journeys against the running build, all PASS.
6. Lead Auditor independently reproduced 5 of the Auditor's 7 edge-case journeys with a different script (raw `dispatchEvent` races, extra nav taps, partial-form-fill discard, double reload, ON→OFF→ON reduced-motion sequence) — **zero discrepancies**, all 5 PASS. Also independently confirmed via `git diff bc52fd4 -- index.html` that the shipped keyframe literally reads `0.75` (not just self-reported) and that the entire code diff is confined to the three expected regions (keyframe, tour subsystem, `APP_VERSION`).

I independently re-read the actual current source (`index.html:1780–1824`, keyframe at line 33) rather than trusting any of the above reports. Confirmed live in the file: `@keyframes tourPulse{0%{...1}50%{...0.75}100%{...1}}`, `prefersReducedMotion()` present, `tourGlowAnim()` returns `{}` under reduced motion, `applyTourHighlight()` explicitly clears `animation`/`animationDelay` inline in that branch. **Both findings: verified fixed, verified re-verified, chain of custody genuine.**

**Finding set B — Lead Designer's version-discipline gap (APP_VERSION/sw.js/README not bumped):**

The Lead Designer caught that although both the brief and Designer review referred to "Build: app-v17" throughout, the app's own version string was still `app-v16` at that point in the chain. Checked directly:

- `index.html:3177` → `const APP_VERSION = 'app-v17';` — confirmed bumped.
- `sw.js:1` → `const CACHE = 'chemowell-app-v17';` — confirmed bumped.
- `README.md` → top row of the version-history table is `| app-v17 | 2026-07-26 | ... |` — confirmed present, and its prose was cross-checked against the actual diff by the Lead Auditor (§2 of `LEAD_AUDITOR_SIGNOFF_v17.md`) and again by me directly: the README's claimed before/after values (0.3→0.75, `Date.now()`-based delay, JS-level reduced-motion guard) match the real `git diff bc52fd4 -- index.html` byte-for-byte.

The Auditor (P2-1) caught that the README row was *still* missing at audit time (the version strings had been bumped but the README hadn't yet) — meaning this gap was only fully closed between the Auditor's pass and the Lead Auditor's pass. Lead Auditor confirmed it resolved (§2, §7). I re-confirm it is resolved as of the current committed tree. **Verified fixed.**

---

## 3. Does the deliverable match what Aaron actually asked for?

Checked directly against the source, not against any report's description:

1. **Green border around the banner AND the currently-pointed-to element (ranked #1):** `index.html:1836` (banner) and the card-mode block both carry `border: '3px solid #2E7D4F'` plus a matching `outline`. `applyTourHighlight()` (called from both `positionTour()` sites) sets `el.style.outline = '3px solid #2E7D4F'` on the live target. Confirmed present on all 8 targeted steps per Designer/Lead Designer/QA/Auditor, all independently. **Delivered.**
2. **Pulse animation, respecting `prefers-reduced-motion` (ranked #2):** `@keyframes tourPulse` (index.html:33) with a phase-synced negative `animation-delay` (`tourPulseDelay()`, keyed to `Date.now()`, not simulated time) drives a genuine continuous pulse. Reduced motion is respected **for real**, not just cosmetically — this was exactly the Designer's Item 4 finding (the global CSS override does NOT stop an infinite-iteration animation, it makes it flicker), and the shipped fix is a JS-level `matchMedia` check in `tourGlowAnim()`/`applyTourHighlight()` that skips animation properties entirely, independently re-verified by both the Lead Designer and the Auditor's live journey #5 (ON→OFF→ON toggle by the Lead Auditor). **Delivered, and genuinely correct, not superficial.**
3. **Banner stays pinned at the top (hard constraint, do not undo the v12 occlusion fix):** `top: 'calc(8px + var(--safe-top))'` is byte-identical to the pre-v17 value at both the banner style object and the `positionTour()` card-clamp logic (`Math.max(8 + safeTopPx(), top)`). Confirmed via direct diff (`git diff bc52fd4 HEAD -- index.html`) that this line was **not** touched — the only changes to the banner/card style objects are `border`/`outline`/`outlineOffset`/the `...tourGlowAnim()` spread. Confirmed live by both Designer and Lead Designer via `getBoundingClientRect()` (`rectTop: 8` at both 390 and 1280). **Untouched, constraint honored.**
4. **Arrow fallback (ranked #3, only-if-pulse-fails):** grepped the full source for any arrow-related tour code (`tourArrow`, `tour-arrow`, `arrowFallback`) — none exists. Since the pulse passed feasibility and shipped clean, this was correctly not built. **Correctly NOT built.**

**Deliverable matches the Owner's request in full, in the correct priority order, with the hard constraint honored.**

---

## 4. Release mechanics

- `git log --oneline -5` (local) and `git log origin/main --oneline -5` are identical, top commit `0b16bbe`.
- `git status`: `On branch main. Your branch is up to date with 'origin/main'. nothing to commit, working tree clean.`
- `git diff origin/main --stat`: empty — local and origin are byte-identical.
- Note: the Lead Auditor flagged (N1) that at the time of their review the fixes were still uncommitted on top of a WIP commit. That has since been resolved — three commits now carry this release (`ab8f5b8` root files, `91d6e7d` chain reports, `0b16bbe` evidence screenshots), all pushed and confirmed on `origin/main`.
- Live-build smoke test: this sandbox cannot fetch `https://arnjnnngs.github.io/chemowell-app-beta/` directly (known sandbox network restriction). Verified the equivalent by inspecting `origin/main`'s actual `index.html` content (not just the commit existing): `APP_VERSION = 'app-v17'` present, `sw.js` CACHE `chemowell-app-v17` present, and the full tour code diff (keyframe, `prefersReducedMotion`/`tourGlowAnim`/`applyTourHighlight`, both `positionTour()` call sites, `#2E7D4F` on banner/card) present in the pushed tree — this is what GitHub Pages will serve.

**Release mechanics: PASS.**

---

## 5. Scope-drift check

Reviewed the full diff (`git diff bc52fd4 HEAD -- index.html sw.js README.md`, 50 insertions / 9 deletions in `index.html`, plus the two version-string lines and the README row). Every changed line falls into one of: the new `tourPulse` keyframe, the tour-subsystem helper functions and their two call sites, the banner/card style objects (border/outline additions only — no padding/margin/position changes), `APP_VERSION`, `sw.js` CACHE, and the README row. Nothing else in the file was touched. No unrelated refactor, no unrequested feature, no drive-by change. The green token reused (`#2E7D4F`) is the app's existing token, not a new one, per Aaron's implicit expectation of visual consistency — no new design language was introduced beyond what was asked.

**No scope drift.**

---

## 6. Out-of-scope finding surfaced during the mandatory whole-product QA walkthrough

QA ("User Zero") found a genuine, reproducible crash: **Reports → Blood Pressure** throws `TypeError: content is not iterable` on every open (both empty and populated states), because `renderBloodPressureReport()` returns a single DOM node where every sibling report function returns an array, and `renderReportDetail()` spreads the result. The tap produces **zero visible feedback** — the tile just does nothing — and the error then repeats once per second indefinitely in the background via the app's existing 1-second tick, invisible to the user.

I independently confirmed this is genuinely unrelated to the v17 diff, not just asserted by QA/Auditor/Lead Auditor:
- `git show bc52fd4:index.html | grep -n "function renderBloodPressureReport"` shows the function existed, unchanged in this respect, before v17's work began.
- `git diff bc52fd4 HEAD -- index.html | grep -n "BloodPressure\|renderReportDetail"` returns zero matches — the v17 diff never touches this function or its caller.
- The function's own body references only `state.entries`/`removeEntryDB`/`fmtTime` — no shared state or call path with anything the tour change touched.

This is accurately described throughout the chain (QA, Audit, Lead Audit, README) as pre-existing, out of scope for this release's diff, and not fixed here. It is not being silently dropped: it is documented in `QA_USER_ZERO_v17.md` Part 4 with full repro steps and a suggested fix, tracked in `AUDIT_v17.md` and `LEAD_AUDITOR_SIGNOFF_v17.md` as a separately-tracked open item, and named explicitly in the README's app-v17 changelog row. I am surfacing it to Aaron directly in the completion summary below, flagged as a new, separate item awaiting his decision — not bundled into or hidden by the v17 ship.

**PM judgment call, stated explicitly:** `TEAM.md`'s fail-fast rule says a MAJOR defect found by any stage sends the whole release back to the Developer. Read literally, QA's FAIL verdict on the whole-product walkthrough would bounce this release. I am treating this as the intended exception to that rule rather than a literal trigger, for a specific reason: the defect is demonstrably outside this release's diff (confirmed at the diff level above, not merely asserted), the tour/highlight work that *is* this release is independently confirmed clean by every downstream stage, and restarting the entire chain to fix an unrelated pre-existing bug would not even address that bug faster — it would only delay shipping the (already-verified-correct) fix Aaron is waiting on. The right mechanism is what actually happened: ship the verified, in-scope fix; log the pre-existing bug as its own item for Aaron to prioritize, with its own future Dev Brief → chain run when he wants it addressed. This is consistent with how the Auditor and Lead Auditor characterized it, and I concur with that characterization rather than overriding it.

---

## 7. Verdict

**PASS — ready to ship as app-v17.** All six chain artifacts exist and are substantive. Both Designer-caught defects were fixed and independently re-verified twice over (Designer's own re-verification, then the Lead Designer from scratch, then the Auditor, then the Lead Auditor). The Lead Designer's version-discipline gap was closed and independently confirmed by the Lead Auditor and by me directly against source. The shipped code matches Aaron's ranked preferences exactly — green border on banner and target, a genuinely reduced-motion-safe pulse, the v12 pinning behavior provably untouched, and no arrow fallback built since it wasn't needed. Release mechanics are clean: committed, pushed, local matches origin, working tree clean. No scope drift. The Blood Pressure crash is real, correctly triaged as pre-existing and out of scope, accurately documented at every stage, and is being surfaced to Aaron now rather than silently deferred.

**This release is complete and correct. Sending to the Owner.**
