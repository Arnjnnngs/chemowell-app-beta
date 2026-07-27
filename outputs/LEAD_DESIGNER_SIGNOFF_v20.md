# LEAD_DESIGNER_SIGNOFF_v20 — Review of the Designer's v20 review + the Lead Developer's four fixes

Role: Lead Designer (Quality Chain stage 4) · Date: 2026-07-27 · Build under review: app-v20 (pause a medication, "excluded near treatment day" mode, structured schedule-window time picker)
Reviewed artifacts: `outputs/DESIGNER_REVIEW_v20.md` (6 PASS / 4 FAIL) and the Lead Developer's four direct fixes to Items 2, 5, 6, 8 in `index.html`, against the live app at http://localhost:8910/index.html.
Method: independent re-verification, not a re-read of the Designer's report. Headless Chromium (Playwright, `/opt/pw-browsers/chromium-1194`), viewports 390x844 (primary, DPR2/touch), 360x740 (smallest realistic phone, not previously spot-checked by me), plus a live-DOM simulation technique (temporarily mutating element inline styles in the running page, not the source) to isolate cause-and-effect on one layout question. Fresh onboarding + fresh `localStorage` every run, real clicks. My scripts/screenshots: `/tmp/ld-v20/*.mjs`, `/tmp/ld-v20/screens/*.png`. I also independently re-derived the source-line evidence (did not copy line numbers from the Designer's report without re-reading them myself).

**UPDATE 2026-07-27, same day, re-verification pass:** the Lead Developer addressed both blocking items from the original sign-off below. I re-ran live verification against the same server (http://localhost:8910/index.html, code changed) rather than trusting the fix descriptions. **Both are now confirmed clean — see §6. Cleared to proceed to the next stage.** The original findings (§1–§5) are left intact below as the record of what was found; §6 is the re-verification addendum.

**Original headline (superseded by §6): three of the four fixes were clean. The fourth (Item 2) was only half-fixed — the touch target was correct but the fix introduced a new, unclaimed layout regression. There was also a version-discipline gap.**

---

## 1. The four fixes — reproduced independently

**Item 2 — trash button touch target: SIZE FIXED, but the fix has a side effect the Designer's own fix note explicitly (and incorrectly) ruled out.**
- Live `getBoundingClientRect()` on the rendered button, both rows, both viewports: **`{width: 44, height: 44}`** everywhere I measured (390px and 360px). Size fix confirmed landed at `index.html:3313`.
- **New finding, not in the Designer's report:** the Designer's fix note claimed *"No layout consequence... 4px of added button size will not force wrapping on a 390px-wide row (verified: the row's three controls... currently render on one line at 390px with room to spare)."* This is false for the shipped build. I measured the actual flex row precisely: available row width is **300px**; the two `flex:1, minWidth:110px` selects plus the "to" span alone already consume **300.06px** (134.72 + 8 + 14.58 + 8 + 134.72), leaving **zero** room for the button on that line — it wraps to an entirely new line below the selects (button `top: 315.67` vs. selects' `top: 264.67`, a 51px jump, confirmed at both 390×844 and 360×740, screenshot `wrap-check-detail.png`).
- I isolated whether this is caused by the 44px fix itself (not pre-existing) by live-mutating the same DOM node's `width`/`height` back to `40px` in the running page and re-measuring: at 40px the button's top is `266.17` — a 1.5px offset from the selects' `264.67`, fully explained by `alignItems:'center'` centering a 40px-tall button against 43px-tall selects on the **same** line. At the shipped 44px, the offset jumps to 51px — a genuinely different line. **This confirms the Item 2 fix itself (not a pre-existing condition) pushed the row over its available width and now wraps the delete icon onto its own line beneath the time pickers, on every schedule-window row with 2+ windows, at every phone width tested.** It's not a broken touch target (still tappable, still 44×44) and it's not a horizontal-overflow bug (item 10's overflow claim still holds — `scrollWidth === clientWidth` at 360/390px), but it is a real, reproducible visual regression this exact fix introduced, and the Designer's fix note's specific reasoning for why it was safe is factually wrong.

**Item 6 — Pause/Resume header button height: CONFIRMED, no discrepancy.**
- Live rects: Pause `{width: 73.77, height: 44}`, Resume `{width: 88.19, height: 44}` — matches the Designer's pre-fix 40px-tall numbers exactly in width, now 44 in height. Confirmed at both 390px and 360px. No layout consequence — the header row has room; screenshots show no wrap.

**Item 5 — Excluded-badge color: CONFIRMED distinct and AA-clean, with one small documentation-accuracy note.**
- Live `getComputedStyle()`: "Treatment day" (Only) badge unchanged at `rgba(192,69,59,0.1)` / `rgb(161,91,86)`; "Excluded near treatment" badge now `rgba(181,118,30,0.14)` / `rgb(140,89,0)` (`#8C5900`) — genuinely distinct hues, confirmed visually distinguishable at a glance in `item5-badges-clean.png` and at 360px in `360px-meds-list.png`, and correctly reuses the real `NOTICE_TONES.attention` token, not a hand-picked color.
- Independent contrast recomputation (my own flatten/relative-luminance implementation, not the Designer's numbers): **5.06:1** against the badge's own color flattened over white — comfortably clears AA (4.5:1), though this differs from the Designer's cited **5.7:1**. Root cause: the Designer's fix note computed contrast against `rgba(181,118,30,0.12)` (their suggested value), but the actual `NOTICE_TONES.attention.chipBg` constant already in the codebase (`index.html:1162`) is `rgba(181,118,30,0.14)` — a higher alpha than what the Designer's contrast math assumed. The Lead Developer correctly used the real existing token rather than hand-copying the Designer's approximate suggested rgba, which is the right call, but it means the Designer's own contrast citation in the fix note is for a slightly different color than what shipped. Not a defect — the real number (5.06:1) still clears AA with real margin — but worth recording since TEAM.md holds this stage to an accuracy standard.

**Item 8 — Grouped-card paused row opacity + copy: CONFIRMED, functionally verified end-to-end.**
- Live: row `opacity: '0.65'` present (`item8_grouped_row_check.rowOpacity === "0.65"`), caption text reads exactly `"Not tracked while paused. Resume anytime."` (now matching the standalone card).
- Went further than a style check: clicked the Resume button inside the muted (0.65-opacity) row and confirmed it is still fully functional — `{width: 92.19, height: 44}` (clears 44px), and clicking it actually un-pauses the medication (re-queried DOM afterward, confirmed the "— Paused" row is gone). The opacity fix did not degrade interactivity.

---

## 2. Spot-check of the Designer's PASS items (4 of 6 independently re-run, not just re-read)

**Item 1 — schedule-window row lifecycle:** re-ran the full sequence myself on a fresh medication: delete-button count `0 → 2 → 3 → 2 → 0` across add/add/delete/delete — matches the Designer's claimed lifecycle exactly, confirmed live via `button[aria-label="Remove this time window"]` count, not screenshots alone.

**Item 3 — 3-way treatment-mode radiogroup:** exercised it live for two different medications (Only mode with before=2/after=1, Excluded mode with before=1/after=2), scoped to `[role="radiogroup"][aria-label="Treatment-day availability"]` as instructed (confirmed this selector is unambiguous — did not collide with the "Home screen placement" radiogroup). Both saved correctly and rendered the correct badge/summary text downstream (see Item 5 above) — consistent with the Designer's claim.

**Item 9 — daily "Still pausing?" banner, cross-day lifecycle:** this is the release's most safety-relevant claim (Owner's explicit requirement: resuming must not flood the user with missed-dose history), so I re-ran it independently end-to-end rather than trusting the Designer's screenshots:
1. Paused Metformin Test → `+1 Day` → banner appeared with exact copy `"Still pausing Metformin Test?"` (screenshot `item9-day1-banner.png`). Confirmed live via `document.body.innerText`, not visual inspection alone.
2. "Continue pausing" → banner gone (confirmed).
3. `+1 Day` again → banner reappeared (confirmed) — real cross-day recurrence, not a one-shot.
4. "Resume" from the banner → medication un-paused (Paused badge gone from Meds list, confirmed via DOM query, not just visually).
5. **Critical check:** on the Home screen after resuming, across the two simulated days it was paused, I searched for any "N missed dose(s)" text — found **none** (`item9_missed_dose_banner_after_resume: null`, screenshot `item9-after-resume-home.png` shows a clean Quick Log card, no missed-dose banner). This independently confirms the Owner's explicit requirement holds on the actual running build, not just in the Designer's prose.

**Item 2/6/5/8 touch-targets and colors** — covered in §1 above with my own measurements, not copied from the Designer's report.

I did not re-run Item 4 (days-before/after live summary) or Item 7 (standalone paused card) independently beyond what Item 5/8's flows already exercised in passing; both read as low-risk, well-isolated text/style claims and the Designer's evidence for them (exact strings, computed styles) was internally consistent with everything else I did verify.

---

## 3. Coverage the Designer's review didn't reach — probed per TEAM.md's "modals, toasts, disabled states, smallest viewport" mandate

**Smallest viewport (360px), not in the Designer's tested set (they used 390/1280 + a 390x480 keyboard spot-check, never 360):**
- Re-ran the schedule-window editor at 360×740: trash buttons still `44×44` on both rows, Pause button still `73.77×44`, zero horizontal overflow (`scrollWidth === clientWidth === 360`). Same wrap behavior as 390px (see Item 2 finding above — the regression is not viewport-specific, it reproduces at the narrower width too).
- Meds-list badges at 360px remain legible and appropriately sized (`360px-meds-list.png`).

**Validation-error state — not tested by the Designer at all:** tried to save a medication with a blank name. Result: clean toast **"Enter a medication name before saving."**, the editor stays open (no data loss, no crash), confirmed via screenshot `validation-blank-name.png`. This is a real, well-designed error state — good, but it's new coverage this stage added, not a re-confirmation of anything the Designer checked.

**Internal consistency of the "44px everywhere" convention — the specific mandate to check the Designer's suggestions for consistency with the design system, not just correctness in isolation:**
- The Designer justified the Item 2/6 fixes by appeal to a supposedly universal convention: *"the app already establishes and uses correctly elsewhere in this exact same editor screen."* I checked whether that's actually true of the whole Meds tab, not just the two spots that got fixed. Finding: the "Home screen order" reorder arrows (▲/▼, `index.html:3387`, `width: '40px', height: '40px'`) sit directly above, on the same screen, the same list's Edit/Delete icon buttons (`index.html:3406-3407`, confirmed `44×44`). Live measurement: `{reorderUp: 40×40, reorderDown: 40×40, editIcon: 44×44, deleteIcon: 44×44}`, all captured in one DOM snapshot, visible together in `mixed-landscape-reorder-vs-icons.png` and also visible in the corner of `item5-badges-clean.png`. **This is pre-existing (untouched by v20, not one of the three new features) and out of this ticket's scope to fix here** — same category as the Designer's own "pre-existing, out of scope" call on the red "Treatment day" badge in Item 5 — but it means the "44px is already the established convention on this screen" claim used to justify Items 2 and 6 is not quite accurate: the screen the fixes shipped to still has a genuine 40px outlier sitting a few rows away. Worth a queued follow-up, not a blocker for this release.
- I deliberately did **not** flag the "BETA date controls" panel's 40px buttons (`index.html:1516-1518`) — those are gated behind `TEST_MODE` (`renderTestingControls()`), a dev-only testing scaffold never seen by a real user, and out of scope for a design-system consistency check.

**Toasts/modals:** exercised the "medication added" toast, the pause-banner "card," and the blank-name validation toast — all auto-dismiss correctly, none blocked subsequent clicks once cleared (I explicitly waited out the 4.5s auto-dismiss before each subsequent interaction, per the setup notes, and hit no intercepted-click failures once I did).

---

## 4. What remains open — blocking

1. **Item 2's fix has an unclaimed layout regression (new finding, §1 above) — blocking.** The 44px trash button now wraps to its own line below the two time-window selects on every 2+-row schedule window, at both 390px and 360px. This needs a real layout fix, not just re-confirming the button is 44×44 — e.g. give the row a touch more horizontal breathing room (trim the selects' `minWidth` slightly, tighten the gap, or let the button share a line with just the "to" span by restructuring which elements can shrink), or make the two-line layout an intentional, cleaner design instead of an accidental wrap with dead space to the right of the second select. This is still a small, well-isolated, exact-value-class fix per the Owner's minor-fix amendment — it does not need a full chain restart — but it must go back to the Lead Developer and then be re-verified live (not just visually eyeballed) before this proceeds.
2. **Version-discipline gap — blocking, same class of miss as the v17 precedent.** `index.html:3451` (`APP_VERSION = 'app-v20'`) and `sw.js:1` (`CACHE = 'chemowell-app-v20'`) are both correctly bumped, but **README.md's Version History table has no `app-v20` row** — the top row is still `app-v19` (2026-07-26). TEAM.md states a missing README row is "an automatic PM-gate fail." This is exactly the class of gap this stage exists to catch (the Designer reviewed rendered behavior and had no reason to check release bookkeeping). Small mechanical fix — add the README row — no design re-review needed, but it must not ride forward silently.
3. **Reorder-arrow 40px outlier (§3) — non-blocking, queued.** Pre-existing, out of this ticket's scope, but flagged so it doesn't get silently treated as "the convention is already 44px everywhere on this screen" in a future brief.
4. **Item 5's fix-note contrast citation (5.7:1) doesn't match the actual shipped token's contrast (5.06:1, independently computed) — non-blocking, documentation-accuracy note only.** The real number still clears AA comfortably; only the Designer's justification math was off by using an approximate rgba instead of the real `NOTICE_TONES.attention.chipBg` alpha.
5. Everything else — Items 1, 3, 5 (color/functional correctness), 6, 8, 9 (full cross-day lifecycle including the no-missed-dose-flood requirement), 10 (overflow) — independently re-confirmed with fresh evidence in §1–§2, nothing further open.

## 5. Verdict (original pass)

**NOT YET CLEARED to proceed to QA Tester (stage 5).** Three of the Designer's four required fixes (Items 5, 6, 8) are clean, confirmed independently with live measurements and functional clicks, not just visual inspection. The fourth (Item 2) fixed the touch-target size correctly but the Designer's own "no layout consequence" reasoning for that fix does not hold on the actual running build — the button now wraps to a new line, a regression this stage caught by testing the specific claim rather than accepting it. Combined with the missing README version-history row (a mechanical but binding gap per TEAM.md), this release has two blocking items to clear before it can move forward:

1. Lead Developer fixes the Item 2 row-wrap regression (real layout fix, not just re-shrinking the button) and re-verifies live at 360px and 390px with 2+ schedule windows.
2. Lead Developer adds the `app-v20` README version-history row.

Both are small, exact-scope fixes consistent with the Owner's fail-fast/minor-item amendment — no full chain restart required — but this stage does not sign off until they're done and I (or a fresh pass at this stage) can confirm both live.

---

## 6. Re-verification addendum — 2026-07-27, same day

The Lead Developer applied two follow-up fixes and asked for live re-verification against the same running server (code changed, http://localhost:8910/index.html unchanged URL). I re-measured both from scratch rather than trusting the fix description.

### 6a. Item 2 row-wrap regression — RE-VERIFIED FIXED

Source change (`index.html:3313-3318`): the row's `gap` went from `8px` → `5px`, and each `<select>`'s `minWidth` from `110px` → `95px`. The inline code comment at `index.html:3305-3312` explicitly documents that the first attempt only accounted for the 390px case and was re-checked against the true worst case (360px) before shipping — a good sign the Lead Developer tested the claim rather than repeating the original mistake.

I re-ran my own live-DOM measurement script (not the Designer's or Developer's numbers) at both viewports, forcing a 2-row schedule (so the delete button is present) exactly as before:

| Viewport | Row available width | Select width (each) | Button `top` | Selects' `top` | Same line? |
|---|---|---|---|---|---|
| 390×844 | 300px | 113.2px | 265 | 265 | **Yes — exact match** |
| 360×740 | 270px | 98.2px | 199 | 199 | **Yes — exact match** |

At both widths the start-select, "to" span, end-select, and trash button now render as one line — the button's `top` is byte-identical to the selects' `top` (not just close), confirming it sits inline to the right of the second select rather than wrapping. (The "to" span's `top` differs by 14px at both widths — that's the same `alignItems:'center'` vertical-centering artifact I identified in the original pass, i.e. a short text node centered against 43-44px-tall controls on the *same* line, not a second line — I already isolated and ruled this out as a wrap indicator in §1.) Button position confirms it too: at 390px the button's `left` (301.0) equals the second select's `left` (182.8) + its `width` (113.2) + the new `5px` gap (182.8+113.2+5=301.0), i.e. genuinely laid out immediately after the second select, not pushed to a new row.

Screenshots `reverify-390px-scrolled.png` and `reverify-360px-scrolled.png` confirm this visually: both schedule-window rows ("8:00 AM to 8:00 PM 🗑" and "8:00 AM to 8:30 AM 🗑") render fully on one line at both widths, with no dead space or orphaned icon below.

**No new issue introduced**, checked explicitly:
- Horizontal overflow: `document.documentElement.scrollWidth === document.documentElement.clientWidth` at both 390px (`390===390`) and 360px (`360===360`) — clean at both.
- Select legibility: font-size unchanged at `13px`; a representative option ("9:15 AM") renders in full, un-clipped, in both the 113px-wide (390px viewport) and 98px-wide (360px viewport) selects — narrower than before (was ~134.7px/110.7px) but still comfortably wider than the longest time-option string needs, confirmed by reading the rendered option text itself, not just the box width.
- Touch target: the button itself is still `44×44` (only the row's internal spacing changed, not the button's own size).

This closes the regression I found in the original pass. The Lead Developer's fix was to the actual root cause (the row's total content width vs. available width), not a cosmetic patch, and it was verified against the correct worst-case viewport (360px) before I even asked for it.

### 6b. README version-history gap — RE-VERIFIED FIXED

Read `README.md` directly (not re-trusting the Lead Developer's description). The `app-v20` row is now present as the top row of the Version History table, dated 2026-07-27, above the `app-v19` row. It is a genuine, specific changelog entry, not a placeholder: it describes all three shipped features (pause a medication incl. the `pausePeriods` mechanism that prevents the missed-dose flood, the excluded-near-treatment-day radiogroup, and the decimal-hour schedule-window picker with the three landmines it fixed along the way — `hourTs()`, `dueRemindersAt()`, and `normalizeMedication()`'s clamp), and it explicitly documents this stage's own finding (the Item 2 regression) and its fix in the same entry. `APP_VERSION = 'app-v20'` (`index.html:3451`) and `CACHE = 'chemowell-app-v20'` (`sw.js:1`) remain correctly bumped, as originally confirmed. No further action needed here.

### 6c. Stage-name correction

The instruction accompanying this re-verification request stated that TEAM.md's stage 5 is "Auditor." I re-read `TEAM.md` directly to confirm before writing the verdict below: **stage 5 is "QA Tester ('User Zero')"; "Auditor" is stage 6.** My original §5 verdict used the correct name. The updated verdict below uses "QA Tester" for the same reason — this sign-off should route to the stage TEAM.md actually specifies next, not a relabeled one.

## 7. Updated verdict

**CLEARED to proceed to QA Tester (stage 5, per TEAM.md — "the fresh phone user, every release").** Both items blocking the original sign-off are now independently re-verified live, not just re-described:

1. The Item 2 row-wrap regression is fixed at its root cause (row gap + select minWidth), confirmed with fresh `getBoundingClientRect()` measurements at both 360px and 390px showing the button now shares a line with the two time selects, with no horizontal overflow and no loss of select legibility.
2. The README `app-v20` version-history row is present, dated, and substantive.

All four of the Designer's original fixes (Items 2, 5, 6, 8) are now confirmed correct with no open regressions. The two non-blocking items from the original pass remain queued, not gating: the pre-existing 40px "Home screen order" reorder-arrow inconsistency (§3, out of this ticket's scope) and the Item 5 fix-note's contrast-citation imprecision (§1, cosmetic documentation note only, the real shipped contrast of 5.06:1 already clears AA). Nothing else is open.
