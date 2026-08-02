# Designer Re-Review — ChemoWell v33 (fix-pass repass)

Reviewer: Designer (Quality Chain, fresh reviewer) · Date: 2026-08-02
Reviewed: live build at http://localhost:8913/index.html via Playwright (390×844, DOM-measured boxes and computed colors; two seeded contexts — Female/Both fresh onboarding + Plus license, and legacy-prefs migration seed), plus the 14 regenerated evidence screenshots in outputs/v33-evidence/.

**Verdict: PASS WITH NITS** (0 Critical, 0 Major, 2 residual Minor, 3 Nit)

Both Majors from DESIGNER_REVIEW_v33.md are genuinely fixed in the rendered product. Six of the eight claimed fixes landed completely; two landed partially (touch-target details below). No new Major or Critical issues were introduced.

---

## Per-fix verification

### Fix 1 — Remove buttons use shared two-tap confirm · **VERIFIED (with residual Minor, see N1)**
Live, radiation report with 2 logged sessions (1 today + 1 backdated via the "+" modal): tapping Remove no longer deletes. It swaps to the shared confirm state — **Delete** (measured 70×44px, `#C0453B` red fill) + **Keep** (47×44px). Keep reverts with the row intact (verified: 2 rows remained); Remove → Delete removed the row and the summary updated 2/30 → 1/30. Same verified on the Blood Pressure report (2 readings logged from Home): Remove → Delete 44px `rgb(192,69,59)` / Keep 44px; Delete removed the row (1 → 0). Both reports call the shared `removeBtn()` (index.html:4928, 4958), and `radiation_session` + `blood_pressure` are in `BYPASS_48H_IDS` (index.html:2835), so backdated entries older than 48h keep their Remove button — correct for these record types. The one-tap-permanent-delete Major is gone.
Residual: the *initial* "Remove" state measures **71×39px** (no minHeight in `removeBtn`, index.html:2847) — under the 44px minimum the original finding asked for. Since a mis-tap now only opens a confirm, this drops from Major to Minor (see N1).

### Fix 2 — Account "+ Add profile" inline flow · **VERIFIED**
With Plus tier seeded: tapping "+ Add profile" on Account renders the name input + Create/Cancel **in place** (h1 stayed "Account", no navigation; input/Create/Cancel all minHeight 44px, index.html:4899–4902). Typing "Sam" → Create creates the profile ("2 of 3 profiles used" confirmed afterwards) and reloads into the new profile's setup screen with the name **prefilled** ("Sam" in the name field) — this is the same documented v33 code path Settings uses (`createProfile`, index.html:137–152), not a dead-end. Screenshot: /tmp/rp-account-addflow.png, /tmp/rp-post-create.png.

### Fix 3 — Account/Export cards solid white + #EBE3E4 · **VERIFIED**
Computed styles on all three Account sections (Current plan, Patient profiles, Export data): `background: rgb(255,255,255)`, `border: 1px rgb(235,227,228)` — exact match to Settings' `secStyle` (index.html:4853). The translucent variant is gone.

### Fix 4 — Planned-total input & Switch 44px · **VERIFIED on the flagged surfaces; Settings equivalents still 34px (N2)**
Planned-total input measured **64×44** (index.html:3330). Account profile-row Switch measured **75×44** (index.html:4892). However, the parenthetical half of original finding 5.6 — Settings' profile-row buttons — did not land: Settings Switch and Delete both measure **34px** (`minHeight: '34px'`, index.html:4655–4659), and the confirm-state Delete/Keep there are 34px too. Residual Minor.

### Fix 5 — #0A6B4A green text (AA) · **VERIFIED**
Logged-today pill text computed `rgb(10,107,74)` = #0A6B4A on `rgba(15,157,87,0.10)` tint → blended bg ≈ #E7F5EE, contrast **5.80:1** at 13.5px/700 — AA pass. ACTIVE badge computed `rgb(10,107,74)` on `rgba(15,157,87,0.12)` → **5.66:1** at 10.5px/800 — AA pass. (Settings' separate "Active" chip uses `#2E7D4F`, a different green — noted in N3.)

### Fix 6 — Migration card labels + full-fill Save · **VERIFIED**
Legacy-seed context (`chemowell-app-p-p1-prefs-v1` = Legacy): card renders uppercase "PATIENT IS" and "TREATMENT TYPE" labels above the chip rows, and Save is full `rgb(162,76,113)` = #A24C71, white text, 44px tall, at all times. Tapping Save with nothing selected shows the "Pick both answers to save" guidance toast — tappable and no longer disguised as disabled. Screenshot: /tmp/rp-migration.png. (Label spec drift noted in N3.)

### Fix 7 — Pluralization · **VERIFIED**
Radiation summary with planned=30 and 1 session renders "**1 / 30 sessions completed**" (also visible in evidence 07-radiation-report.png); code correctly keeps the singular only for the unplanned single-session case (index.html:4944). History descriptor with exactly 1 entry renders "**1 recorded entry**" (index.html:4966).

### Fix 8 — Drawer Settings helper · **VERIFIED**
Drawer live: Account = "Profiles, plan & export", Settings = "**Units, guide & data**" (index.html:2010) — the duplicate "Profiles" claim is gone. Settings' header caption still opens "Profiles, plans, home screen, units…", but profile rename/delete and View plans genuinely still live in Settings, so the caption is accurate; acceptable as-is.

---

## Findings (residual + new)

**N1 · Minor · touch-target (residual of 4.1's size clause).** The shared `removeBtn` initial state has no minHeight — measured 71×39px on both the radiation and BP reports (and everywhere else the shared pattern renders, e.g. Home history rows). The confirm-state buttons are 44px; the entry button should be too. Fix: add `minHeight: '44px'` at index.html:2847 (visual pill can stay compact inside the padded hit area). Not a Major anymore because a stray tap now only opens the confirm.

**N2 · Minor · touch-target (unlanded half of 5.6).** Settings profile rows: Switch, Delete, and the confirm-state Delete/Keep are all still `minHeight: '34px'` (index.html:4655–4659). The Account equivalents were correctly raised to 44px, which makes the 34px Settings set an inconsistency as well as a target miss.

**N3 · Nit · label/green drift on the migration card.** Its section labels are 11px/0.05em/`#8A6B82` versus the system TYPE.label 12px/0.06em/`#8A6479` (same drift family as unfixed finding 1.2, which was outside this fix pass's scope), and Settings' "Active" chip green (`#2E7D4F`) differs from the now-standard `#0A6B4A`. Harmonize when 1.2 is picked up.

**N4 · Nit · shared `addingProfile` state leaks across surfaces.** Opening the add-profile input on Account and then navigating to Settings shows the input already open there (one global flag renders in both places, index.html:4661/4899). Harmless — Cancel exists on both — but worth a reset in `navigateTo`.

**N5 · Nit · toast still overlaps "← Back"** on report views (pre-existing nit 10.1, out of fix scope; observed again live and in evidence 07).

Pre-existing nits from the first review not in the fix scope (1.1–1.3, 2.3, 4.3, 7.2, 10.2) remain as previously documented.

---

## Tally & verdict

| Severity | Count | Items |
|---|---|---|
| Critical | 0 | — |
| Major | 0 | — |
| Minor | 2 | N1 (removeBtn initial state 39px), N2 (Settings profile buttons 34px) |
| Nit | 3 new | N3, N4, N5 (+ prior out-of-scope nits) |

**PASS WITH NITS.** Both Majors are fixed correctly in the rendered product using the app's own shared patterns, all contrast fixes measure AA, and no regressions were introduced. The two residual Minors are one-line minHeight changes (index.html:2847 and 4655–4659) — fold them into the next routine pass; they do not block release.
