# Lead Designer Sign-off — ChemoWell v33

Reviewer: Lead Designer (Quality Chain) · Date: 2026-08-02
Method: independent live re-inspection via Playwright (Chromium, 390×844 and 320×568, DOM-measured boxes and computed colors, WCAG ratios computed from blended actuals — no numbers taken on trust from the two Designer reports), plus source inspection of /home/claude/chemowell-app-beta/index.html and review of the 14 evidence screenshots. Six scripted passes; my own screenshots in /tmp/lead-*.png.

**Verdict: SIGN OFF WITH NOTES**

---

## 1. Independent re-inspection of Designer claims (10 sampled, all re-measured myself)

| # | Claim (source) | My measurement | Result |
|---|---|---|---|
| 1 | Remove→confirm flow on radiation report: Delete #C0453B / Keep, Keep preserves row, Delete removes and summary updates (repass Fix 1) | Delete 70×44 rgb(192,69,59), Keep 47×44; Keep left 13 rows intact; Delete dropped a row and count updated; identical on BP report | **Confirmed** |
| 2 | Account "+ Add profile" runs inline, no navigation; created profile opens setup with name prefilled (repass Fix 2) | h1 stayed "Account"; input/Create/Cancel all 44px in place; after Create the app reloaded into the setup screen with "Sam" prefilled; "2 of 3 profiles used" after | **Confirmed** |
| 3 | Planned-total input 64×44 (repass Fix 4) | 64×44 | **Confirmed** |
| 4 | Logged-today pill #0A6B4A on green tint, AA (repass Fix 5, claimed 5.80:1) | rgb(10,107,74) on rgba(15,157,87,.10) → blended #E7F5EE → **5.81:1** | **Confirmed** |
| 5 | Account ACTIVE badge #0A6B4A (repass Fix 5) | rgb(10,107,74) at 10.5px/800 | **Confirmed** |
| 6 | Pluralization: "1 / 30 sessions completed" with a planned total (repass Fix 7) | Seeded exactly 1 session + planned 30 → renders "1 / 30 sessions completed" | **Confirmed** |
| 7 | Drawer de-duplicated: Settings helper "Units, guide & data" (repass Fix 8) | Drawer reads Account "Profiles, plan & export" / Settings "Units, guide & data" | **Confirmed** |
| 8 | Account/Export cards solid white + #EBE3E4 (repass Fix 3) | Verified in source (secStyle reuse, index.html:4853 area) and no translucent card visible live at 320/390 | **Confirmed** |
| 9 | Severity chips 72–75×44, on-pattern (review 1, 7.1) | At 320×568: Mild 72×44, Moderate 75×44, Severe 72×44, none clipped ("Moderate" is snug — nit 7.2 stands, text does not truncate) | **Confirmed** |
| 10 | Migration Save full #A24C71 fill, 44px, guidance toast when incomplete (repass Fix 6) | rgb(162,76,113), 44px, always full-fill; empty-tap toast path verified in source (index.html:2882) | **Confirmed** |

Both Designer reports' numbers reproduce exactly. The repass was honest about partial landings (its N1/N2), which is what I most wanted to verify.

## 2. The final two 44px one-liners (post-repass, not in the evidence screenshots)

- **removeBtn initial "Remove" state**: source line 2847 now has `minHeight: '44px'`; live measured **71×44** on the radiation report rows AND the BP report rows (was 71×39 in the repass). **Landed.**
- **Settings profile-row buttons**: source ~4655–4659 all carry `minHeight: '44px'`; live with a second (inactive) profile: Switch **71×44**, Delete **66×44**, and the "Delete forever?" confirm state Delete **64×44** / Keep **50×44** (was 34px). **Landed.**

Repass Minors N1 and N2 are therefore closed.

## 3. Coverage audit — surfaces the Designers did not (fully) check

- **Guided tour vs new onboarding**: walked the entire 10-step tour live immediately after the new setup flow. Every step's target resolves (`nav-meds` → `meds-add` → `med-editor` → `nav-home` → `quick-log` → `nav-reports` → `nav-inpatient` → `nav-symptoms`); form steps collapse to the slim banner; Finish lands on Home; drawer is correctly blocked mid-tour. Profiles created via `createProfile` set `tourDone: true` so caregivers aren't re-toured. **No stale targets.**
- **Toasts over the new views**: toast is fixed at `bottom: 96px`, `pointer-events: none`, z50. On report views it fully covers the floating "↩ Back" pill (bottom 88px) for its 4.5s life — visually confirmed at 320 (screenshot /tmp/lead-toast-back-320.png). Decisive test: a **real mouse click at the covered pill's center navigated back** — the overlap is visual-only, never blocking. Repass N5's Nit grading is correct.
- **Plans bottom sheet**: opens from Account and Settings, z70, internal scroll region, 44px close button visible and content card fits at 320×568. On-system (white card, 99px pills, rose accents). Pass.
- **Time-modal at 320×568 with skin-reaction fields**: Confirm starts below the fold (top 687 > 568) but the dialog has `maxHeight: 100%` + `overflowY: auto` — scrolled to Confirm (50px tall, fully visible) and completed a Moderate + "left side of neck" log successfully. Pass.
- **Radiation card with a 3-digit planned total**: cannot occur. The input clamps on write (`onChange` rejects >99, index.html:3330) AND `radiationPlannedTotal()` clamps on read (`v <= 99`, index.html:1322) — an injected 120 is treated as null everywhere (card drops the "of N", input empties, no layout break). Defensively handled; note the injected value is silently discarded, which is acceptable.
- **Very long patient names**: a 52-character hyphenated name wraps cleanly in Account rows at 390 and 320 (`minWidth: 0` + flex wrap; no horizontal overflow, scrollWidth = viewport). The Home header wraps to four lines at 320 — tall but not broken. Pass.
- **Migration card + support banner stacking**: the support banner **cannot currently render** — `SUPPORT_LINK` still contains `REPLACE` so `SUPPORT_LINK_READY` is false (index.html:70–71); the stack is unreachable in this build. I verified the future state anyway by serving the page with a live link patched in: both render on Home without collision — migration card pinned at top of Today, banner at the bottom of the section, normal card gap (screenshots /tmp/lead-stack-top-final.png, /tmp/lead-stack2-*.png). No latent issue.

## 4. Design-system consistency of the new additions

- **Label drift (repass N3) — should be unified, not accepted.** Measured three variants of the same uppercase-label role live: migration card **11px/0.05em/#8A6B82**, onboarding **12.5px/0.05em/#8A6B82**, app-shell TYPE.label **12px/0.06em/#8A6479**. Two of the three are v33 surfaces; recommend collapsing both to TYPE.label (12px/0.06em/#8A6479) when finding 1.2 is picked up. Minor polish, not blocking.
- **`addingProfile` state leak (repass N4)**: reproduced — open the add input on Account, navigate to Settings, the input is open there too (one global flag, both surfaces render it). It does not matter much in practice: both spots show the same draft with a Cancel, and creation is one shared code path, so the worst case is mild surprise, never data loss. Agree with Nit; a one-line reset in `navigateTo` would tidy it.
- **New finding (Minor) — Settings "Active" chip fails AA by a hair.** `#2E7D4F` at 12px/700 on `rgba(46,125,79,0.10)` over white blends to **4.43:1** (needs 4.5). The repass spotted this chip only as green *drift* and did not measure it; it is the same sub-AA-by-a-hair family as the fixed 2.2/5.2. One line — switching it to the now-standard `#0A6B4A` (index.html:~4650) fixes the drift and the ratio together.
- Residual `#0C7F57` uses (report big-count "done" state, index.html:4941) are 26px/800 large text at 5.01:1 on white — passes; no action needed.
- Off-palette plum `#7B3F6B` on report counts/titles re-measured at 7.59:1 — contrast fine; palette nit 4.3 remains open as documented.

## 5. Small-viewport pass (320×568)

- **Onboarding**: no horizontal overflow; Chemo/Radiation/Both chips 68/90/51×48, none clipped; Get started sits below the fold but the page scrolls to it. Pass.
- **Home with radiation card**: "Session 12 of 33", planned input 64×44, progress bar, Log button + 44×44 backdate "+" all fit with no overflow (/tmp/lead-radcard-320-final.png). Pass.
- **Account**: no overflow with Plus tier, long name, plan card and profile rows intact (/tmp/lead-account-320.png). Pass.
- **Skin-reaction modal**: covered above — scrolls, completes. Pass (/tmp/lead-skinmodal-320.png).

## What remains open (none blocking)

1. **Minor — Settings "Active" chip 4.43:1** (`#2E7D4F` → `#0A6B4A`, one line) — the one miss I found that the Designers under-graded.
2. Nit — label-style unification (migration 11px + onboarding 12.5px → TYPE.label 12px/#8A6479; review-1 finding 1.2 + repass N3).
3. Nit — toast visually covers the report "↩ Back" pill for 4.5s (tap-through works; consider a higher toast offset on report detail views).
4. Nit — `addingProfile` reset in `navigateTo`.
5. Pre-existing out-of-scope nits from review 1 stand as documented (1.1 inline validation, 1.3 emoji logo, 2.3 pill wrap copy, 4.3 `#7B3F6B` plum, 7.2 Moderate chip padding, 10.2 hover states).
6. Observation, out of v33 scope: a malformed weight entry (missing `weight` field) renders "null lbs" on the Home weight card — only reachable via corrupt/injected data; worth a guard someday.

## Verdict

**SIGN OFF WITH NOTES.** Both post-repass 44px fixes are live in the rendered product; every sampled Designer claim reproduced under independent measurement; the tour, toasts, plans sheet, small-viewport, long-name, 3-digit-total, and banner-stacking surfaces all hold up. The only Designer miss found is a one-line sub-AA chip (Minor) that folds into the already-planned green/label harmonization. Nothing rises to Major or Critical, and no claimed fix failed to land. Ship v33; fold items 1–4 above into the next routine pass.
