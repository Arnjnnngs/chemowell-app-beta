# AUDIT_v12 — Auditor report (Quality Chain stage 6)

Auditor: fresh agent, 2026-07-24. Scope: full uncommitted working tree vs HEAD (`git diff` run directly: README.md, TEAM.md, index.html +150/-45, sw.js cache bump) plus blast radius of the change across the whole 3,812-line app. MOBILE FIRST binding: all user testing ran at 360x740 primary (with prior-stage 360x400 keyboard coverage re-run via the existing suite), against the live served build on :8877 with Chromium.

## Verdict summary

**0 P0 · 0 P1 · 0 P2 · 1 P3 · 4 P4.** Both existing suites re-run clean (units 14/14, first-run 25/25), plus 40 new audit checks across 2 new suites — all pass. Zero console/page errors in every run. **SHIP** (P3-1 is a recoverable guidance gap on an off-path action, queueable; it does not break data, safety math, or the happy path).

---

## Findings

### P3-1 — Tour still strands on step 3 when the editor is closed via bottom-nav (the `backOn` fix only covers the Discard button)

- **Location:** `index.html:1356` (`navigateTo`: `medEditor: view === 'meds' ? state.medEditor : null`) vs `index.html:2923` (Discard is the only place that fires `tourEvent('medEditor:closed')`).
- **Repro:** Fresh install → tour to step 3 (med form open, banner "Fill out the form, then tap Add medication at the bottom") → tap **Home** (or Reports etc.) in the bottom nav. `navigateTo` silently discards the editor without firing `medEditor:closed`, and `view:home` matches neither `advanceOn` (`med:saved`) nor `backOn`. Result: tour stays on step 3, banner still says "Fill out the form…" with no form anywhere; returning to Meds shows no editor and the Add button un-highlighted.
- **Verified live** at 360x740 (`outputs/audit-v12-step3-navaway-stranded.png`): tourStep stays 3, editor gone.
- **Why P3, not P2:** fully recoverable — tapping Add reopens the editor (`openMedicationEditor` runs unconditionally; its `medEditor:open` event is a no-op on step 3), and saving fires `med:saved` which advances normally (verified: window med saved, tour advanced to step 4). No data loss, no dead end, Skip always available. But the instruction/highlight mismatch is exactly the confusion class v12 set out to kill, and the README's "discarding the editor mid-step steps the tour BACK instead of stranding it" is only true for the Discard button, not this second close path.
- **Suggested fix (next chain run):** fire `tourEvent('medEditor:closed')` from `navigateTo` when it nulls a non-null `medEditor`, or match `backOn` on `view:*` while step 3 is active.

### P4-1 — Hand-tampered string temp renders "null°F" on the Home card

- **Location:** `index.html:419-423` (`dispTemp` returns `null` for non-number `temp`), consumed at `index.html:2384` (`dispTemp(lastTemp) + tempSuffix()`); same class: `weightDefault()` (`index.html:834`) would yield placeholder `"null"`.
- **Repro:** seed an entry `{ medId:'temp', temp:'99.1', dose:'99.1 °F' }` directly in localStorage → Home Temperature card shows **null°F** (screenshot `outputs/audit-v12-malformed-string-temp.png`). Journal/history are safe — `entryDoseLabel` type-guards and falls back to the frozen dose string; no NaN anywhere.
- **Why P4:** audited every write path (logTemp/logWeight → parseFloat-validated → `confirmTimeAndLog` stores numbers; true in v1–v11 too) — no real path produces a string. Reachable only by manual storage tampering. Cheap hardening: fall back to `e.dose` when `dispTemp`/`dispWeight` return null.

### P4-2 — "High temp" red styling diverges between display units in the 39.4°C band (documented design consequence, not a defect)

- A stored 39.4°C reading is **red** (high, ≥39.4) in °C mode but displays as **102.9°F = amber** (fever, <103) in °F mode — verified live both ways (`rgb(192,69,59)` vs `rgb(154,100,25)`, screenshot `outputs/audit-v12-after-10-flips-lbsF.png`). Root cause is pre-existing: the two high thresholds (39.4°C / 103°F) are not exact equivalents (39.4°C = 102.92°F), unlike the fever pair (38.0°C ≡ 100.4°F exact, verified identical both modes). v12's compare-the-displayed-value rule guarantees the color never contradicts the number on screen, which is the right invariant; the residual 0.04°C band is inherent to the threshold choice. Optional future alignment: set the °F high threshold to 102.9.

### P4-3 — `tempAsC` is defined but unused (`index.html:431`, single occurrence)

- Intentional per its comment ("canonical accessor for the fever-alert roadmap"). Dead weight until then; noted so the Lead Auditor doesn't flag it as a miss.

### P4-4 — Weight-chart "Change" stat computed from per-entry rounded values

- `index.html:3416` converts each entry with `round1` at ingestion; `change = latest.weight - first.weight` (`:3512`) can differ from the true converted delta by up to ±0.1. Display-only, no comparison/equality logic consumes it. Cosmetic.

---

## Code audit — attacks that failed (verified sound)

- **Round-trip precision:** stored values are never rewritten — 10 full unit-flip cycles left the entries JSON **byte-identical** (string compare), Home then showed the original 147 lbs / weight placeholder 147 exactly. 148 lbs → 67.1 kg displayed → flip back → 148 exactly (existing suite). 100.4°F ↔ 38.0°C exact both ways.
- **No equality comparisons on converted values anywhere:** `dispTemp`/`dispWeight` feed display and `>=` threshold styling only.
- **Weight chart copies:** `.map(e => ({...e, weight: dispWeight(e)}))` output is consumed read-only (bounds, path, dots, stats, readings list — `index.html:3416-3593`); nothing mutates or persists the copies; no `addEntryDB`/`saveJSON` downstream.
- **entryDoseLabel guards:** temp/weight rows type-check before converting and fall back to `e.dose`; journal render additionally gates on `e.dose` truthiness, so a dose-less temp entry renders the name row without a broken sublabel.
- **Legacy unit inference:** `°C`-suffix / `/kg\s*$/` checks match every historical write format (all writes since v1 stamp the suffix); no-dose fallback defaults are safe.
- **backOn cannot double-fire or misfire:** `tourEvent` only consults the *current* step; step 3 is the only step with `backOn`; Discard on any other step (incl. post-tour, tourStep null) is a no-op. Save fires only `med:saved` (not `medEditor:closed`), so there is no back-then-advance race on the save path (`index.html:2744-2803`).
- **tourExpanded module flag:** reset in `startTour`/`endTour`/`setTourStep` (every step change), and `location.reload()` on profile switch / erase-all resets the module — verified live: expanded card survives 3s of ticks on the same step, collapses on Back/step change, and a profile round-trip resumes p1 at step 4 with the collapsed banner default.
- **1s tick vs banner:** tick skips render while an input/select/textarea is focused (`index.html:3778-3787`), so typing is never interrupted; when ticks do render, banner rect was pixel-identical and scrollY unchanged across 5.5s on steps 1 and 3, with the target outline reapplied every pass (banner branch of `positionTour` re-outlines, never scrolls — `index.html:1760-1770`).
- **Expanded card on wait-only steps 1/2/4:** button row is exactly Skip guide / Back / Got it (no phantom Next — those steps have no `next`), wait-hint text present. Correct rows verified at all three steps.
- **Gap-hours:** `''` form default renders grey placeholder 0; `Number('') || 0` → saves 0 = As-needed; typed 6 saves as number 6 (existing suite).
- **Unit-aware temp bounds:** °F mode typing 37 → "Enter a valid temperature in °F (86–113)"; °C mode typing 98.5 → "…in °C (30–45)". Both unit-explicit with ranges — clear. Screenshots captured.
- **Hard rules:** no network calls added anywhere in the app (`fetch`/XHR/sendBeacon/WebSocket grep: only sw.js's standard cache-fallback `fetch(e.request)`); zero `caretracker_`/firebase references; `TEST_MODE = true` intact (`index.html:36`); the `unit` field is purely additive — a v11 reader ignores it and behaves exactly as before (no schema break either direction; legacy-entry reads tested); `sw.js` cache `chemowell-app-v12` + `APP_VERSION 'app-v12'` + README `app-v12` row all consistent. `node --check` on the extracted 276KB script: clean.
- **README accuracy:** all claims verified except the "no longer stranding" phrasing scoped by P3-1 above.

## User testing — journeys run (all at 360x740 unless noted, evidence in outputs/)

| Journey | Result | Evidence |
|---|---|---|
| Existing units suite (390x844, incl. legacy no-unit entries, fever boundary, log-in-°C, flip-back) | 14/14 PASS, 0 errors | suite output |
| Existing first-run suite (390x844 + 360x400 keyboard height + Discard-steps-back) | 25/25 PASS, 0 errors | suite output |
| Fresh first-run through full tour with a **WINDOW** med (type win, `8 AM-8 PM Daily` parsed to `{start:8,end:20}`), tour → Finish, tourDone persisted | PASS | audit-v12-step1-banner-t0/t5s, step3-banner-editor-t5s, tour-complete-home.png |
| Banner stability ≥5.5s under the 1s tick, steps 1 & 3 (rect, scroll, outline) | PASS — pixel-identical | step1-banner-t0 vs t5s.png |
| Expanded card on steps 1/2/4 (+ persistence across ticks, Back-resets-collapsed) | PASS | step1/step2/step4-expanded.png |
| Mixed-unit weight history (150/149 lbs + 67.5/67.1 kg + 147 lbs interleaved), chart in lbs AND kg modes | PASS — single sane axis each mode (145–152 lbs / 64–70 kg), every point converted | mixed-chart-lbs.png, mixed-chart-kg.png |
| Rapid unit flipping, 10 full cycles | PASS — storage byte-identical, values exact, 0 errors | after-10-flips-lbsF.png |
| Unit-aware temp-bound rejection messages, both modes | PASS | temp-bounds-f-toast.png, temp-bounds-c-toast.png |
| Malformed-entry probe (string temp) | FINDING P4-1 | malformed-string-temp.png |
| Nav-away mid step 3 probe | FINDING P3-1 (recoverable) | step3-navaway-stranded.png |
| Profile switch mid-tour (p1 step 4 → p2 tourDone → back to p1) | PASS — no tour bleed, no data bleed, resumes step 4 collapsed | profile-switch-p2.png, profile-switchback-p1-step4.png |
| Erase all data → confirm → welcome screen | PASS | erase-to-welcome.png |

Pre-existing queued items reconfirmed unrelated to this diff (e.g. report Back-pill overlapping the stats row, visible in mixed-chart-kg.png — already in the README queue).

## Verdict

**SHIP.** No P0–P2. P3-1 (nav-away tour stranding — the residual sibling of the exact bug v12 fixed) and P4-1 (null°F on tampered storage) should be queued for the next chain run; per the restart rule that decision belongs to the Lead Auditor/PM, but neither breaks data integrity, medication-safety math, or the first-run happy path, and both are recoverable in-app.
