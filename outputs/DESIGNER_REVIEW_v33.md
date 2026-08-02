# Designer Review — ChemoWell v33

Reviewer: Designer (Quality Chain) · Date: 2026-08-02
Reviewed: 14 evidence screenshots + live build at http://localhost:8913/index.html via Playwright (320×650, 390×844, 390×500, 1280×800; Male/Radiation and Female/Both profiles; DOM-level touch-target and contrast measurement; WCAG ratios computed from actual blended colors).

**Verdict: FAIL** (0 Critical, 2 Major — rule is FAIL at 2+ Major)

The v33 surfaces are close: the visual language (card radii, uppercase labels, chip pattern, rose gradient CTAs) is applied consistently and the conditional Settings gating (cycle hidden for males, chemo-schedule hidden for radiation-only) verified correct in the live build. What fails the premium bar is interaction design on two surfaces — a one-tap permanent delete of medical records, and a primary CTA that dead-ends into another screen — plus a cluster of sub-AA contrast and sub-44px target misses.

---

## 1. Onboarding profile buildup (screens 01, 02, 03, 12; live at 320px & 390×500)

1.1 **Minor — Validation is toast-only.** `completeSetup()` (index.html:2181) shows sequential toasts ("Enter the patient's name…", "Select Male or Female…") with no inline field state. Tapping Get started with an empty form gives one toast per tap, three taps to discover all requirements. Fix: on failed submit, set the offending field's border to `2px solid #C0453B` and add an 11px `#A5443C` helper line under it; keep the toast as reinforcement.

1.2 **Minor — Two different label grays in one system.** Onboarding labels use `#8A6B82` at 12.5px/0.05em (index.html:2199, 2216) while the app shell's TYPE.label surfaces use `#8A6479` at 12px/0.06em (e.g. index.html:3318). Same role, two values. Fix: use `#8A6479`, `fontSize: 12px`, `letterSpacing: 0.06em` in `setupChipRow` and the name label.

1.3 **Nit — Emoji heart logo.** The ❤️ glyph (index.html:2212) renders platform-dependent (red Apple emoji clashes with the #A24C71 palette on the same card). Fix: inline SVG heart, 40×40, `fill: #A24C71`.

1.4 Keyboard-height (390×500) verified: page scrolls, Get started reachable. Pass. 320px chip row ("Chemo/Radiation/Both") fits without truncation. Pass.

## 2. Radiation sessions card on Home (screen 04; live 320px, 12-of-33 seeded)

2.1 **Minor — Planned-total input is 40px tall.** Measured 64×40 (`minHeight: '40px'`, index.html:3323) — under the app's own 44px minimum. Fix: `minHeight: '44px'`.

2.2 **Minor — Logged-state green fails AA by a hair.** `#0C7F57` text on `rgba(15,157,87,0.10)` over white blends to #E7F5EE → **4.46:1** at 13.5px/700 (needs 4.5:1). Fix: darken text to `#0A6B4A` (≈5.5:1) in the logged pill (index.html:3331); apply the same to every `#0C7F57`-on-green-tint instance (see 5.2).

2.3 **Nit — Logged pill wraps awkwardly at 320px.** "✓ Today's session logged (4:01 PM)" breaks mid-parenthesis onto line 2. Fix: shorten copy to `✓ Logged today · 4:01 PM` (fits one line at 320px) or add `whiteSpace: nowrap` with `fontSize: 12.5px` under 360px.

2.4 Card padding (10px 11px), 16px radius, label color, "+" backdate button (measured 44×44 with aria-label) all match the system. Progress bar (8px, 99px radius, rose gradient) is clean. Pass otherwise.

## 3. Backdate modal "Log Past Radiation Session" (screen 05)

3.1 Matches the shared time-modal pattern exactly (DATE/TIME labels, mono inputs, "Defaults to now" helper `#7A6E76` 4.86:1, 44px Cancel/Confirm). **No findings.**

## 4. Radiation report (screen 07; live with 12 sessions and empty state)

4.1 **MAJOR — One-tap permanent delete with a 34px target and no confirm/undo.** Each session row's Remove button (index.html:4942) measured **76×34px** and calls `removeEntryDB()` directly — verified live: one tap, count 3→2, no confirmation, no undo, no toast. The app already has a two-tap confirm pattern for exactly this action on Home ("Remove" → 6-second confirm state, index.html:2845). A stray tap in a scrollable list permanently deletes a patient's treatment record and silently renumbers every later session. Fix: reuse the Home pattern — first tap swaps label to "Tap to confirm" with `background: #C0453B, color: #FFF`, auto-revert after 6s; raise the button to `minHeight: 44px` (keep visual 34px pill inside a padded 44px hit area if the row density matters). Note: renderBloodPressureReport (index.html:4912) has the identical pre-existing flaw — fix both while in there.

4.2 **Minor — Pluralization reads wrong with a planned total.** Summary renders "1 / 30 session completed" (singular keyed to `sessions.length`, index.html:4928). "1 / 30 sessions completed" is correct. Fix: `(planned ? 'sessions' : 'session' + (sessions.length === 1 ? '' : 's')) + ' completed'`.

4.3 **Nit — Off-palette plum.** Big count and row titles use `#7B3F6B` (index.html:4927, 4939) — neither `#A24C71` nor `#8E3D61`. Contrast is fine (7.59:1); it's a palette-drift issue copied from the BP report. Fix: `#8E3D61`.

4.4 Empty state exists and is on-pattern ("No radiation sessions logged yet. Log them from the Radiation sessions card on Home.", index.html:4922). Pass.

## 5. Reports menu (screen 06) & Account view (screens 08, 09, 13; live)

5.1 **Minor — "1 recorded entries".** History meta hardcodes the plural (index.html:4950), visible in screenshot 06. Fix: `state.entries.length + ' recorded ' + (state.entries.length === 1 ? 'entry' : 'entries')`.

5.2 **Minor — ACTIVE badge fails AA.** `#0C7F57` at 10.5px/800 on `rgba(15,157,87,0.12)` tint → **4.36:1** (index.html:4879). Fix: text `#0A6B4A` (≥5.3:1); same fix as 2.2.

5.3 **MAJOR — "+ Add profile" doesn't add a profile.** Below the tier limit, the Account view's primary rose CTA (index.html:4888) navigates to Settings and shows a toast "Add the new profile here in Settings" — the user must scroll to the Profiles section and tap a second, identical "+ Add profile" button. Settings' own button opens the add flow directly (`setState({ addingProfile: true })`, index.html:4659). A primary button whose entire result is "go tap this button somewhere else" is a dead end. Fix: hoist the add-profile name input/flow so Account can invoke it in place (`setState({ addingProfile: true })` rendered within Account), or at minimum auto-open the add input focused on arrival in Settings. (At-limit behavior verified correct: opens the Plans sheet.)

5.4 **Minor — Account cards deviate from the card system.** Account/Export sections use `background: rgba(255,255,255,0.6)` + `1px solid rgba(212,104,138,0.12)` (index.html:4830, 4844) while every sibling view (Settings, index.html:4622) uses the system `#FFFFFF` + `1px solid #EBE3E4`. Because `renderExportSection()` is shared, Settings itself now mixes solid-white sections with one translucent one. Fix: `background: '#FFFFFF', border: '1px solid #EBE3E4'` in both places.

5.5 **Minor — "Rename or delete profiles in Settings." is inert text.** (index.html:4889.) In the view that owns profiles, management is elsewhere and the pointer isn't tappable. Fix: render "Settings" as a link-style button (`color: #8E3D61`, underline) calling `navigateTo('settings')`.

5.6 **Minor — Switch button is 40px.** `minHeight: '40px'` (index.html:4883) on the profile-row Switch action. Fix: 44px. (Settings' equivalent at index.html:4650 is 34px — same fix.)

## 6. Migration card "Finish setting up this profile" (screen 11)

6.1 **Minor — Chip rows have no labels.** Onboarding pairs the same chips with "PATIENT IS" / "TREATMENT TYPE" labels; here the two rows sit bare (index.html:2866–2874), so the Chemo/Radiation/Both row has no stated question. Fix: add the same 12px/700/uppercase/0.06em labels in `#8A6479` above each row.

6.2 **Minor — Save is a live control at 1.68:1.** Unfilled state renders white text on `rgba(162,76,113,0.35)` (index.html:2875) — looks disabled but is tappable (shows a toast). Disabled-looking-but-active fails both affordance and AA (active controls aren't exempt). Fix: keep it tappable for the explanatory toast but render text at full `#FFFFFF` on `#C89AAE` minimum (3:1 for the large-ish 13.5px/700 is still short — better: `background: #FFFFFF`, `border: 1.5px solid rgba(162,76,113,0.4)`, `color: #A24C71` for the incomplete state, switching to the solid rose fill when both answers are picked).

## 7. Skin-reaction modal (screen 10; live at 320px)

7.1 Severity chips measured 72–75×44px, selected state matches the system chip treatment, "WHERE ON THE BODY? (OPTIONAL)" label and `e.g. chest, left side of neck` placeholder (#7A6E76, 4.86:1) are on-pattern. **Pass.**

7.2 **Nit — "Moderate" chip is cramped at 320px.** Label nearly touches both borders (75px chip). Fix: chip `fontSize: 15px` under 360px viewports, or `padding: 0 2px` with `flex: 1 1 0`.

## 8. Drawer (screen 08)

8.1 **Minor — Account and Settings both claim "Profiles".** Helpers read "Profiles, plan & export" and "Profiles, units, data" — two adjacent menu items promising the same thing, and Settings' own header caption also still opens with "Profiles, plans…" (index.html:4630) even though the plan/profile overview moved to Account. Fix: Settings helper → "Home screen, units & app data"; Settings header caption → "Home screen, units, notifications, and app data — all stored on this device."

## 9. Settings (screens 14, b01; live for Male/Radiation and Female/Both)

9.1 Conditional gating verified in the live DOM: Male+Radiation-only shows no Menstrual-cycle and no Treatment-schedule toggle but does show the Radiation-sessions toggle; Female+Both shows all three. **Pass.**

9.2 Export section content matches Account's (shared component) — consistent, but inherits finding 5.4's off-system card style.

## 10. General / cross-cutting

10.1 **Nit — Toast can cover the primary action.** In screenshot 07 the "Session 1 of 30 logged" toast sits directly on the report's "← Back" button for its full duration. Fix: pin toasts to `bottom: calc(nav height + 12px)` consistently.

10.2 **Nit — No hover states on desktop.** Only `button:active{transform:translateY(1px)}` exists (index.html:25). Fix: `@media (hover:hover){ button:hover{ filter: brightness(0.97); } }` or per-variant hover tokens.

---

## Tally

| Severity | Count | Items |
|---|---|---|
| Critical | 0 | — |
| Major | 2 | 4.1 (one-tap delete, 34px, no confirm/undo), 5.3 (Add profile dead-end) |
| Minor | 12 | 1.1, 1.2, 2.1, 2.2, 4.2, 5.1, 5.2, 5.4, 5.5, 5.6, 6.1, 6.2, 8.1 → (13 listed; 8.1 counted here) |
| Nit | 6 | 1.3, 2.3, 4.3, 7.2, 10.1, 10.2 |

(Minor count is 13.)

## Verdict

**FAIL** — two Major findings. Both are contained, low-risk fixes: 4.1 reuses an existing in-app confirm pattern, 5.3 reuses the existing `addingProfile` flow. With those two plus the contrast/target Minors (2.1, 2.2, 5.2, 5.6, 6.2) resolved, this re-reviews as PASS WITH NITS — the rest of v33 genuinely feels native to the design system.
