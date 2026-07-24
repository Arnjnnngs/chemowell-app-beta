# DEV_BRIEF_v12 — Tour occlusion on med-add, gap-hours prefilled 0, redundancy sweep

Role: Developer (stage 1 of the Quality Chain, TEAM.md). Pre-implementation brief for the Lead Developer.
Investigated on the actual code (`index.html`, 3740 lines, app-v11) AND the running app (headless Chromium, real first-run flow: fresh localStorage → welcome → name → tour → med-add). No code was modified.

Owner's report, translated:
1. During first-run, the tour card ("the Welcome box" — its step-1 title literally starts "Welcome") sits on top of the Add-medication form; you cannot see or reach the fields behind it, and you cannot tap Save. **CONFIRMED — reproduced and measured at every mobile viewport. Playwright's own hit-target check fails on the Save button.**
2. "Minimum gap hours" is pre-filled with a hardcoded `0` you must delete before typing. **CONFIRMED — it is the only input in the entire app with this defect.**
3. Redundancies in med-add and app-wide. **Catalog below.**

Evidence: 37 screenshots at `outputs/dev-v12-*.png`, captured from a scripted run of the REAL first-run flow at 390x844, 360x740, and keyboard-open heights 390x480 and 360x400.

---

## 1. TOUR OCCLUSION

### 1.1 Anatomy of the tour system (line numbers in `index.html`)

| Piece | Lines | Facts |
|---|---|---|
| `TOUR_STEPS` (10 steps) | 1650–1661 | Steps advance either via `next` button or `advanceOn` matching a `tourEvent` |
| `startTour / endTour / setTourStep / advanceTour / backTour` | 1662–1669 | Step index persisted to prefs on every change (survives restart) |
| `tourEvent(name)` | 1670–1674 | Only advances when `step.advanceOn === name` |
| `renderTourLayer()` | 1681–1699 | Layer: `position:fixed; inset:0; z-index:80; pointer-events:none`. Card: `position:fixed`, centered by default, `width:min(88vw,330px)`, `pointer-events:auto` |
| `positionTour()` | 1700–1724 | Runs after EVERY render (called at 1766). Highlights `[data-tour=…]` target, `scrollIntoView` once per new step. Placement rule (1719–1722): above the target if `r.top > cardH+margin+8`, else `top = min(innerHeight - cardH - 8, r.bottom + margin)` — i.e. **clamped to the bottom of the viewport** |
| Tour layer appended in `render()` | 1756–1757 | Rebuilt every render pass |
| First-run entry | 1547 (`completeSetup`), 3716 (restore saved step on boot) | |
| `?` replay button (header) | 1416 | `startTour` |
| Settings replay | 3017–3020 | `navigateTo('home'); startTour()` |
| `tourEvent` emitters | 1327 (`view:*` in `navigateTo`), 2669 (`medEditor:open`), 2733 (`med:saved`) | These are the ONLY three emitters |

z-order inventory: main 1 · header 20 · reports-back pill 34 · bottom nav 35 · toast 50 · time modal 60 · plans sheet 70 · **tour layer 80** · loading overlay 100. The tour card outranks everything interactive, including the bottom nav and modals.

Steps that wait for REAL user interaction while the card is up (`advanceOn`):
- idx 1 "The Meds tab" → `view:meds` (tap nav Meds)
- idx 2 "Add your first medication" → `medEditor:open` (tap Add)
- **idx 3 "Fill in the details" → `med:saved` (fill the whole form + tap "Add medication")** ← the broken one
- idx 4 "Nice work!" → `view:home` (tap nav Home)
Steps idx 0, 5, 6, 7, 8, 9 have their own Next/Finish buttons.

### 1.2 Root cause

The med-editor step's target is `[data-tour="med-editor"]` — the ENTIRE form section (line 2805), ~1,400–1,600px tall. Its bounding rect always spans past the bottom of a phone viewport, so the placement rule at 1720–1721 can never place the card "above the target," and the `min(innerHeight - cardH - 8, …)` clamp pins the card to the bottom of the screen for the whole step. The card is 346px tall at 390px width (369px at 360px). It permanently covers:
- the bottom ~41% of a 844px viewport, ~50% of 740px, **72% of 480px and 92% of a 400px (keyboard-open) viewport**;
- the form's action row (Discard + "Add medication"/Save) — which can never scroll below it, because only ~350px of page content exists under the action row;
- the entire bottom nav (all 5 tabs' centers are hit-blocked at every size).

The page behind IS scrollable (layer is `pointer-events:none`), so fields can be dragged into the top half one by one — but the user cannot know that, cannot see the field the tour told them to fill while the keyboard is open, and can never reach Save. The only working escapes are "Skip guide" and "Back". This is exactly the Owner's report.

### 1.3 Live repro measurements (from the scripted real first-run)

At the med-editor step, with the form scrolled fully to the bottom:

| Viewport | Card rect (top→bottom / vh) | "Add medication" center hit test | Playwright real click on Save |
|---|---|---|---|
| 390x844 | 490→836 / 844 | blocked — hit lands on tour card | **TIMEOUT (blocked)** |
| 360x740 | 363→732 / 740 | blocked | **TIMEOUT (blocked)** |
| 390x480 (kbd) | 126→472 / 480 | blocked | n/a |
| 360x400 (kbd) | 23→392 / 400 | blocked | n/a |

At 360x400 with the name field focused (`dev-v12-360x400kb-step3-namefocus.png`) the card covers the name/generic/dosage inputs at 100% — the user literally types into a field they cannot see.

### 1.4 Occlusion catalog — every step, both mobile sizes

"BLOCKED" = element's center hit-tests to the tour card (untappable). Beta date controls are TEST_MODE-only and won't ship — listed for completeness.

| Step (idx) | Target | 390x844 occludes | 360x740 occludes | Required action reachable? |
|---|---|---|---|---|
| 0 Welcome | none (centered) | Temp/Weight Log inputs+buttons, BP inputs partially (BLOCKED) | same, 100% BLOCKED | Yes — own "Show me" button |
| 1 Meds tab | nav-meds | chemo "Pick a date" (BLOCKED) | BP inputs, Log, Pick a date (BLOCKED) | **Yes** — nav row fully clear (placement puts card above nav) |
| 2 Add button | meds-add | header ?/gear partly; Beta date controls | same | **Yes** — Add button clear |
| **3 Fill details** | med-editor (whole form) | form top: Generic/Dosage/both selects BLOCKED; form bottom: **Chemo-day toggle, Discard, Add medication 100% BLOCKED**; all 5 nav tabs BLOCKED | same + Cancel and Medication name BLOCKED | **NO — Save unreachable at every size; broken step** |
| 4 Nice work | nav-home | NONE | NONE | Yes |
| 5 Quick log | quick-log label | BP inputs + Log, Pick a date (BLOCKED) | Beta controls, BP, Log, Pick a date (BLOCKED) | Yes — own Next |
| 6 Reports | nav-reports | NONE | med quick-log "Log" button (95% BLOCKED) | Yes |
| 7 In-Patient | nav-inpatient | "Log <med>" partial | "Log <med>" 100% BLOCKED | Yes |
| 8 Symptoms | nav-symptoms | NONE | "Log <med>" 95% BLOCKED | Yes |
| 9 Finish | none (centered) | Pick a date, QUICK LOG header (BLOCKED) | same | Yes — Finish button |

Conclusion: steps 0–2 and 4–9 occlude things the user doesn't need at that moment (acceptable for coach marks, worth noting for the Designer). **Step idx 3 is the only functionally broken step — and it is the single most important step of first-run.**

### 1.5 Additional confirmed defects/edge cases around the same step

- **Cancel-while-on-step-4 stuck state** (verified live, `dev-v12-390x844-step3-cancelled-stuck.png`): tap the editor's Cancel while the tour is on "Fill in the details" → editor closes, `[data-tour=med-editor]` disappears, card stays up saying "👆 Save the medication to continue" with nothing to save. Recovery only via Back or Skip. A reload mid-step-4 lands in the same state (tour restores step 4, editor state is not persisted).
- **Step-0 desync path**: on Home behind the welcome card, the empty-state "+ Add your first medication" (line 2391) is partially reachable; tapping it opens the editor while the tour still shows step 1 of 10. (Recoverable: its handler calls `navigateTo('meds')` then `openMedicationEditor(null)`, so from step idx 1 onward the same button advances the tour correctly — only step idx 0 desyncs.)
- **Setup screen at 360x400 (keyboard open)**: "Get started" bottom edge is at y=462 of a 400px viewport — reachable only by scrolling (page does scroll). Not a blocker; note for Designer.
- The 1s tick loop (3706–3715) skips `render()` while an input/select/textarea is focused, so the card doesn't fight typing; but every non-editing second it re-renders and `positionTour()` re-clamps the card — a dragged/moved card would be reset every second (matters for approach (c) below).

### 1.6 Approaches

**(a) RECOMMENDED — auto-minimize to a slim banner on form-interaction steps.**
For the med-editor step (and generically: any step whose `advanceOn` requires interacting with content the card might cover), render the card in a "minimized" mode: a one-line fixed banner, docked directly UNDER the sticky header (top edge, not bottom — the bottom is where Save and the keyboard live), height ≤ 64px, showing `Step 4 of 10 · Fill in the form, then tap "Add medication"` + a chevron to expand + Skip. Tapping the chevron expands to today's full card; any tap/focus inside the form (or a Got-it button) re-minimizes. Implementation notes:
- Keep one boolean (`state.tourMin` or a module-level var + `setState({})` on toggle — same pattern as `setupNameDraft`) — do NOT cache the card node (stale-ref landmine; the node is rebuilt every render).
- `positionTour()` skips repositioning when minimized (banner is CSS-fixed top). Highlight outline on the target still applies.
- Show the FULL card once on step entry (it must still teach: it explains as-needed vs scheduled), auto-minimize on first `focusin` inside `[data-tour=med-editor]` or on the Got-it tap.
- Works at every height incl. 360x400: a 56–64px banner leaves the whole form and Save visible/tappable.
- Tradeoff: slightly more state; teaching text hidden while minimized (mitigated by expand chevron + wait-hint in the banner).

**(b) Alternative — placement logic that guarantees no overlap with target/actions.** Compute the target rect ∩ viewport and place the card in the largest free band, and treat the editor's action row as a keep-out zone. **Fails the constraint at keyboard heights:** the card is 346–369px tall; at 400–480px viewports there is no free band. Would require also shrinking the card (scrollable card body), at which point it converges on (a) with more geometry code. Viable as a secondary polish for steps 5–8 on 360px (they currently cover Log buttons), but not sufficient alone.

**(c) Dismissible/draggable card.** Drag fights the 1s re-render (card node and inline position rebuilt every render — position would need persisting and re-applying in `positionTour()`), small drag targets are hostile to sick/exhausted users, and "dismissible" without a re-summon affordance strands the tour. A ✕-to-minimize is just (a) with worse discoverability. Not recommended as primary.

**(d) Hide the card entirely during form-fill, reappear on `med:saved`.** Simplest, but the user loses the step instructions and the wait-hint mid-step ("what was I supposed to do?"), and there is no visible tour presence to Skip from. Acceptable fallback only if combined with a minimal indicator — which is (a) again.

**Recommended package for the Lead Developer:**
1. Approach (a) for step idx 3 (flag the step, e.g. `minimizeOnInteract: true` in `TOUR_STEPS`).
2. Fix the Cancel stuck state: emit `tourEvent('medEditor:closed')` from the two editor-close paths (2811, 2854) and, when on the med-editor step, step back to idx 2 ("Tap Add") so the wait-hint is truthful again.
3. Optional polish (Designer's call): on `advanceOn` steps 1/4, nothing needed (verified clear); consider the same banner treatment at 360px for steps 6–8 where the card covers a Log button (harmless but sloppy-looking).

## 2. GAP-HOURS FIELD (and app-wide numeric-input sweep)

### 2.1 The defect

- `medicationFormFrom()` line 2597: `gapH: base.gapH || 0` → new-med draft starts at numeric `0`.
- Render line 2841: `formInput({ type:'number', min:'0', step:'0.5', value: String(form.gapH), … })` — **no `placeholder`**, so the field shows a real, black, must-delete-first `0`. Verified live: `value:"0", placeholder:""`.
- Drafts are held in `state.medEditor.form` mutated by `updateMedicationForm` (2614–2618) WITHOUT re-render for text fields — so the fix is purely about the initial draft value + placeholder; no renderer changes needed.

### 2.2 Saving with an empty field is already safe (verified live)

`saveMedicationEditor()` line 2680: `gapH = Math.max(0, Number(form.gapH) || 0)` → `''` → `0`. `normalizeMedication()` line 256 does the same on load. Live test: cleared the field, saved → stored `"gapH":0`, med behaves as plain as-needed, rule summary renders "As needed" (`formatRuleSummary` 2568). **So the fix is: draft `gapH: (med && med.gapH) ? med.gapH : ''`, add `placeholder: '0'` (grey via the existing `::placeholder` rule, line 22), and optionally a helper like the Daily-limit field's ("Leave blank for no minimum gap."). Editing an existing med with gapH > 0 must still show the real value.** Note `0` and `''` are semantically identical end-to-end — zero risk to gap enforcement.

### 2.3 Sweep of every text/numeric input app-wide

| Input | Line | Pattern | Verdict |
|---|---|---|---|
| **Minimum gap hours** | 2841 | hardcoded value `0`, no placeholder | **FIX (the only offender)** |
| Daily limit | 2842 | `''` + placeholder "No limit" | OK — this is the model to copy |
| Interval "every N days" | 2829 | prefilled `2` | OK to keep — 2 is the enforced minimum and a meaningful default, not a dummy; optional polish only |
| Schedule windows text | 2841/2599 | prefilled `'8 AM-8 PM Daily'` for new scheduled meds | OK — meaningful, saveable default |
| Medication/Generic/Dosage text | 2814–2816 | `''` + placeholders | OK |
| Temperature | 2316 | `''` + placeholder `tempDefault()` | OK |
| Weight | 2330 | `''` + placeholder | OK |
| BP systolic/diastolic | 2343/2345 | `''` + placeholders 120/80 | OK |
| Setup patient name | 1558 | placeholder | OK |
| New profile name | 2977 | placeholder | OK |
| Note/textarea fields | 1869, 2192, 2844 | placeholders | OK |

## 3. REDUNDANCY CATALOG

Med editor first, then app-wide. Nothing below removes a safety behavior; where a control touches safety logic it is marked.

| # | What | Where | Recommendation |
|---|---|---|---|
| R1 | Two different "as needed" concepts in one form: Schedule type "As needed / gap-based" vs Days taken "As needed (no set days)". For a gap-type med, "Every day" and "As needed (no set days)" behave near-identically; the option really exists to turn missed-dose tracking off for win-type meds (`normalizeMedication` 257: `alerts = type==='win' && !asneeded` — SAFETY-ADJACENT) | 2817 vs 2821–2825 | **MERGE at the UI level**: when Schedule type = gap, hide or relabel the "As needed (no set days)" option (e.g. "No set days"); when type = win, keep it and say what it does ("no missed-dose tracking"). Do NOT touch the `alerts` derivation |
| R2 | Duplicate close controls: header "Cancel" and footer "Discard" run the identical handler `setState({ medEditor: null })` | 2811, 2854 | **DELETE one** — keep header Cancel, drop footer Discard so the bottom row is a single unambiguous Save (also shrinks the region the tour banner must keep clear). Tour copy at 1654 says "Tap Add medication at the bottom" — stays true |
| R3 | Same reassurance copy 3x on one screen: "Changes are stored on this device; dose history remains unchanged." (editor header) vs "Configuration is stored on this device; dose history stays intact." (page caption) vs "Existing dose history will remain visible." (delete confirm) | 2809, 2928, 2918 | **DELETE the editor-header sentence (2809)**; keep the page caption and the delete-flow reassurance (that one is doing real work at a scary moment) |
| R4 | Daily limit helper "Leave blank for none." + placeholder "No limit" say the same thing | 2842 | KEEP — harmless reinforcement; not worth churn |
| R5 | Four overlapping Home-placement toggles: "Show as its own Home card" + Group morning/afternoon/evening. Conflicting combos possible (all three groups at once; quickLog is ignored once grouped) | 2847–2851 | **MERGE into one single-choice control** ("Appears on Home as: Own card / Morning group / Afternoon group / Evening group / Managed only"). Keep the stored booleans (schema untouched, legacy meds unaffected); constrain only the UI. Biggest single tightening win in the editor |
| R6 | "Frequency / rule note" placeholder literally suggests duplicating structured rules ("Min 4-hour gap") that the gap field already enforces; `formatRuleSummary` (2561–2577) already renders those rules | 2844 | KEEP the field (it's the fallback rule text and a genuine free-note), **change placeholder/helper** to steer away from duplication, e.g. "Anything else — take with food, from Dr. Kim…" |
| R7 | Tour replay in two places: header `?` + Settings "Replay the walkthrough"; final tour step advertises the `?` | 1416, 3017–3020, 1660 | KEEP BOTH — different discovery paths, negligible cost. Flagged for the Owner's decision |
| R8 | Stale migration breadcrumb at bottom of Meds tab: "Profiles, plans, and app data controls now live in Settings (⚙ top of screen)." | 2935 | **DELETE** — one release of breadcrumbing is enough; it renders under the med list forever |
| R9 | Dead UI: two spans on every Home quick-log card rendered with `display:'none'` (`subStatus`, `med.note`) — computed each render, never visible | 2492–2493 | **DELETE** (pure dead code) |
| R10 | Settings "Notifications" section has no controls, only a promise ("preferences will live here") | 3012–3015 | KEEP for now (sets expectations pre-Capacitor); revisit at store-submission prep |
| R11 | Home empty-state "+ Add your first medication" duplicates Meds-tab Add | 2391, 2930 | KEEP — good UX; verified it even advances the tour correctly from step idx 1+ (fires `view:meds` then `medEditor:open`) |
| R12 | `renderGroupedMedsCard` duplicates much of the quick-log card logging logic in code | 1474–1526 vs 2394–2498 | KEEP (code-level, user-invisible; refactor is out of scope for this item) |

## 4. CONSTRAINTS & LANDMINES for the implementation

- 1-second full-DOM re-render (3706–3715): never cache the tour card/banner node; minimized-state must live in `state`/module var and be re-applied every render. The `isEditing` guard means position does NOT update while typing — the banner (CSS-pinned) is immune, another point for approach (a).
- `positionTour()` runs after every render (1766) and must keep clearing/re-applying the target outline (`tourClearHighlight` 1675) — don't break outline cleanup when adding the minimized path.
- Tour step persistence: `setTourStep` writes prefs (1664); boot restore at 3716 validates range. The minimized flag should NOT persist (fresh render of a restored step should show the full card once).
- Plans-sheet scroll/animation preservation lives in the `render()` tail (1758–1765) — don't reorder `positionTour()` relative to it carelessly.
- `updateMedicationForm` deliberately skips re-render for text fields (2614–2618) — keeps focus/keyboard alive. The gapH fix must not add a re-render.
- Reserved legacy med IDs (2655) and `normalizeMedication` invariants (dose ceilings, `alerts` derivation 257) must be untouched by R1/R5 UI merges.
- The tour layer must stay `pointer-events:none` with only the card/banner interactive — page scrollability behind the card is what lets today's users survive at all.
- TEST_MODE stays true; no cloud; version bump ritual (APP_VERSION 2940, sw.js CACHE, README row) on push.

## 5. DONE CRITERIA + regression list

Done when (all verified on the running app, mobile viewports):
1. At 390x844, 360x740, 390x480, 360x400: on the "Fill in the details" step, every editor field, the Save button, and the highlighted element are simultaneously reachable — a REAL Playwright `click('button:has-text("Add medication")')` succeeds with the tour active (today it times out).
2. The step still teaches: full card shown on step entry; instructions re-openable while minimized; wait-hint visible in banner form.
3. Gap hours renders empty with a grey `0` placeholder on add; typing requires no deleting; empty save → `gapH:0`, rules render "As needed"; editing a med with `gapH>0` shows the stored value.
4. Cancel during the med-editor step no longer strands the tour on "Save the medication to continue".
5. Whatever redundancy deletions are approved (R2, R3, R8, R9 at minimum) leave zero dangling handlers/refs.

Must-not-regress:
- Tour completes end-to-end via REAL actions at 390x844 and 360x740 (script pattern in `/tmp/tour_v12.mjs`): welcome → name → Show me → nav Meds (`view:meds`) → Add (`medEditor:open`) → save (`med:saved`) → nav Home (`view:home`) → Next×4 → Finish; `tourDone:true` persisted; card gone after reload.
- "Skip guide" works at every step; sets `tourDone`, clears `tourStep`.
- `?` header replay and Settings "Replay the walkthrough" restart at step 1.
- Mid-tour reload restores the saved step (verified today: reload at step 4 re-shows step 4).
- `tourEvent` advancement contract unchanged (`view:*` 1327, `medEditor:open` 2669, `med:saved` 2733).
- Med save validation intact: name required, window parse, weekly-days required, interval ≥2, daily-limit unit-carrier check (2678–2701).
- No console/page errors, no horizontal overflow at 360/390 (today's runs: zero errors).
- v11 fixes intact: plans-sheet no-flicker/scroll-preserve, tab persistence, tick guard while editing.

## 6. Screenshot index (`outputs/`)

- Full flow 390x844: `dev-v12-390x844-{setup,step0-welcome,step1-navmeds,step2-addbtn,step3-mededitor-top,step3-mededitor-scrolledbottom,step3-mededitor-namefield,step3-saveblocked,step4-navhome,step5-quicklog,step6-reports,step7-inpatient,step8-symptoms,step9-finish}.png`
- Full flow 360x740: same set, `dev-v12-360x740-*.png`
- Keyboard-open med-add: `dev-v12-390x480kb-*` and `dev-v12-360x400kb-*` (`step3-mededitor`, `step3-namefocus`, `step3-bottom`, `setup`)
- Stuck state after Cancel: `dev-v12-390x844-step3-cancelled-stuck.png`

Key exhibits: `dev-v12-390x844-step3-mededitor-scrolledbottom.png` (Save fully buried at the biggest phone size) and `dev-v12-360x400kb-step3-namefocus.png` (card covers 92% of a keyboard-open viewport including the focused field).
