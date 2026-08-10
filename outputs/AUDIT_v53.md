# Zero Day Auditor — app-v53

**Build audited:** working tree = `47aeb22` (`APP_VERSION = 'app-v53'`, `sw.js` `CACHE = 'chemowell-app-v53-1'`), byte-identical to what would be pushed.
**Method:** Playwright/Chromium against `python3 -m http.server` serving the real `index.html`; **242 automated assertions across 9 driven scenarios**, 26 profiles created from wiped installs through the real welcome screen, medications added through the real editor, doses/notes/appointments entered through the real UI, simulated dates driven through the real Beta date controls. Plus 12 `release_check.sh` cases on scratch clones (never in the working repo). Mobile 390px primary, 360px checked.
**Date:** 2026-08-10.

---

## VERDICT — **app-v53 is NOT clear to ship as-is. One MEDIUM must be closed first.**

The headline requirement passes completely. **The Other round-trip is fixed and verified at the storage layer, not just visually:** chemo profile → medication set to "Only near treatment day" (−2/+3) → switch to Other → the stored record really becomes `treatmentMode: 'none', treatmentOnly: false` → switch back to Chemo → **the restriction does not come back**. Verified in `localStorage`, in the editor ("◉ Always available" selected), on the Meds list (no chip), on Home, and across a full page reload. **Zero medications, doses, notes, appointments or history entries were lost in any of the 12 transitions.** Zero console errors in every scenario. All five app-v52 fixes still hold exactly.

**What blocks it:** `index.html:3415`, the legacy **"Finish setting up this profile"** card, is the app's *other* `treatmentType` write site, and app-v53 did not touch it. It writes `treatmentType` with no normalisation and no `markNotifDirty()`. Before v53 that was harmless — a profile stranded on Other could never switch back, so the orphaned rule stayed permanently inert. **v53 is what makes that round-trip possible**, so the stranded rule now silently reactivates — the exact failure the release's own code comment says it prevents. Reproduced end-to-end (finding **V53-2**, screenshot 13). The fix is the same one-line normalisation already written 2,200 lines further down the same file.

Everything else is Low: four of them in `release_check.sh` (which does now work — see below), two dead-code items, one copy defect worth fixing while someone is in the file.

`release_check.sh` **is verified to fail when it should and pass when it should.** It hard-fails (exit 1) on the exact committed-index-without-sw-bump state the old version passed green on — I ran both scripts against the same scratch state and confirmed old=0, new=1.

---

## Part 1 — `release_check.sh`

Scratch bare origin + clone at `/tmp/rcT`. The working repo was never used as a test subject.

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| R1 | Clean tree, nothing vs `origin/main` | **PASS** | `✅ Release check passed.` / `No index.html changes vs origin/main.` exit 0 |
| R2 | **Committed** index.html change, **no** sw.js bump | **PASS (correctly blocks)** | `❌ RELEASE CHECK FAILED: index.html differs from origin/main, but sw.js's CACHE constant was not bumped.` **exit 1** |
| R3 | Same, with sw.js CACHE bumped | **PASS** | `index.html changed and sw.js's CACHE constant changed with it` exit 0 |
| R4 | **Old (HEAD-based) script on the identical R2 state** | **PASS (proves the fix matters)** | old: `✅ Release check passed.` / `No index.html changes pending.` **exit 0** — new: **exit 1** |
| R5 | Fallback: `BASE_REF=does-not-exist` | **PASS** | `⚠️ WARNING: base ref 'does-not-exist' not found (no network, or a fresh clone?).` … falls back, exit 0 |
| R5b | Fallback + uncommitted index change, no sw bump | **PASS** | still blocks: `index.html differs from HEAD` exit 1 |
| R6 | `BASE_REF=HEAD~1` (valid ref, sw differs) | **PASS** | `No index.html changes vs HEAD~1.` exit 0 |
| R6b | `BASE_REF=HEAD~2` (index + sw both differ) | **PASS** | `index.html changed and sw.js's CACHE constant changed with it` exit 0 |
| R7 | index + sw changed, `APP_VERSION` **not** bumped | **PASS (warns, doesn't block)** | `⚠️ WARNING: index.html changed but APP_VERSION (APP_VERSION = 'app-v1') wasn't bumped.` exit 0 |
| R8 | Uncommitted-only index change, no sw bump | **PASS (stricter than documented)** | blocks with exit 1 — see **V53-6** |
| R9 | sw.js touched but `CACHE` constant unchanged | **FAIL (LOW)** | `✅ Release check passed.` / `sw.js's CACHE constant changed with it` — **it did not** → **V53-4** |
| R10 | `BASE_REF` resolves but has no index.html | **PASS (noisy)** | raw `fatal: path 'index.html' exists on disk, but not in 'noindex-tag'` printed before the green pass → **V53-9** |
| R11 | Run from a different cwd | **PASS** | `cd "$(dirname "$0")"` holds; exit 0 |
| R12 | Repo with no `origin` at all | **PASS** | warns, falls back to HEAD, exit 0 |
| R13 | Real repo, current candidate | **PASS** | `bash release_check.sh` → `index.html changed and sw.js's CACHE constant changed with it` exit 0 |
| R14 | `./release_check.sh` as documented in TEAM.md | **FAIL (LOW)** | `/bin/bash: line 1: ./release_check.sh: Permission denied` **exit 126** — mode `100644` → **V53-5** (pre-existing) |

---

## Part 2 — the switch matrix (12 transitions, real data in place)

Each profile built from a wiped install through the welcome screen: 3 medications (`Zofran` "Only near treatment day" −2/+3, `Dexamethasone` "Excluded near treatment day" −1/+1, `Tylenol` unrestricted), a treatment date, and logged doses. Counts read from `localStorage` before and after each switch.

| Transition | Type persists | Meds kept | History kept | Restrictions | `aria-pressed` | Toast observed |
|---|---|---|---|---|---|---|
| chemo→radiation | **PASS** `radiation` | **PASS** 3→3 | **PASS** 3→3 | **PASS** preserved `zofran:only/T/2-3 \| dexamethasone:excluded/F/1-1 \| tylenol:none` | **PASS** only `Radiation=true` | `Treatment updated to Radiation` |
| chemo→both | **PASS** `both` | **PASS** 3→3 | **PASS** 3→3 | **PASS** preserved | **PASS** | `Treatment updated to Chemo + Radiation` |
| chemo→other | **PASS** `other` | **PASS** 3→3 | **PASS** 3→3 | **PASS** normalised `zofran:none/F \| dexamethasone:none/F \| tylenol:none/F` | **PASS** | `2 medications are no longer limited to treatment days` → **V53-1** |
| radiation→chemo | **PASS** `chemo` | **PASS** 3→3 | **PASS** 2→2 | **PASS** preserved | **PASS** | `Treatment updated to Chemo` |
| radiation→both | **PASS** `both` | **PASS** 3→3 | **PASS** 2→2 | **PASS** preserved | **PASS** | `Treatment updated to Chemo + Radiation` |
| radiation→other | **PASS** `other` | **PASS** 3→3 | **PASS** 2→2 | **PASS** normalised | **PASS** | `2 medications are no longer limited to treatment days` |
| both→chemo | **PASS** `chemo` | **PASS** 3→3 | **PASS** 3→3 | **PASS** preserved | **PASS** | `Treatment updated to Chemo` |
| both→radiation | **PASS** `radiation` | **PASS** 3→3 | **PASS** 3→3 | **PASS** preserved | **PASS** | `Treatment updated to Radiation` |
| both→other | **PASS** `other` | **PASS** 3→3 | **PASS** 3→3 | **PASS** normalised | **PASS** | `2 medications are no longer limited to treatment days` |
| other→chemo | **PASS** `chemo` | **PASS** 2→2 | **PASS** 1→1 | **PASS** none invented `metformin=none, tylenol=none` | **PASS** | `Treatment updated to Chemo` |
| other→radiation | **PASS** `radiation` | **PASS** 2→2 | **PASS** 1→1 | **PASS** none invented | **PASS** | `Treatment updated to Radiation` |
| other→both | **PASS** `both` | **PASS** 2→2 | **PASS** 1→1 | **PASS** none invented | **PASS** | `Treatment updated to Chemo + Radiation` |

Home after every switch: renders, no medication card duplicated, no card lost. Zero console errors in all 12.

### Home cards, before → after

| Transition | Treatment schedule card | Radiation sessions card | Correct? |
|---|---|---|---|
| chemo→radiation | shown → **hidden** | hidden → shown | Matches the radiation-only default — but see **V53-3** |
| chemo→both | shown → shown | hidden → shown | **PASS** |
| chemo→other | shown → shown | hidden → hidden | **PASS** |
| radiation→chemo | hidden → shown | shown → **hidden** | **PASS** (`Radiation Session` still listed in Today's Journal, correctly) |
| radiation→both | hidden → shown | shown → shown | **PASS** |
| radiation→other | hidden → shown | shown → **hidden** | **PASS** |
| both→chemo | shown → shown | shown → **hidden** | **PASS** |
| both→radiation | shown → **hidden** | shown → shown | **PASS** (D-3 default) |
| both→other | shown → shown | shown → **hidden** | **PASS** |

---

## Part 3 — the Other round-trip, in depth (the headline requirement)

Profile `RoundTrip Rita`, chemo, 3 medications, treatment date 8/12, 3 logged entries.

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| B1-1 | Baseline stored state | **PASS** | `["zofran-2=only","dexamethasone-2=excluded","tylenol-2=none"]` |
| B1-2 | Editor offers the modes on chemo | **PASS** | `TREATMENT-DAY AVAILABILITY` present, `◉ Always available ○ Only near treatment day ○ Excluded near treatment day` |
| B1-3 | Switch to Other | **PASS** | toast `2 medications are no longer limited to treatment days` |
| B1-4 | **Stored value really normalised** | **PASS** | `["zofran-2=none/false","dexamethasone-2=none/false","tylenol-2=none/false"]` |
| B1-5 | Meds + entries intact | **PASS** | meds 3→3, entries 3→3 |
| B1-6 | Editor hides the control on Other | **PASS** | `TREATMENT-DAY AVAILABILITY` absent |
| B1-7 | No orphaned "Active window:" text on Other (v52.2-1 regression) | **PASS** | none |
| B1-8 | Meds list shows no treatment-day chip on Other | **PASS** | none |
| B1-9 | **⭐ Switch BACK to Chemo — restriction does NOT reactivate** | **PASS** | `["zofran-2=none/false","dexamethasone-2=none/false","tylenol-2=none/false"]` |
| B1-10 | Editor back on chemo shows the normalised state | **PASS** | `◉ Always available ○ Only near treatment day ○ Excluded near treatment day` |
| B1-11 | Meds list has no reinstated chip | **PASS** | none |
| B1-12 | Zofran visible on Home after the round-trip | **PASS** | `Zofran / Waiting / Last taken - Monday 8/10 · 4 mg / Next dose at 12:16 AM` |
| B1-13 | History survived the full round-trip | **PASS** | entries 3→3 |
| B2-1 | Normalisation survives a full page reload | **PASS** | `["zofran-2=none/false"]` after `reload()` |
| B2-2 | `treatmentType` survives reload | **PASS** | `stored=other` |
| G4-1..4 | Same round-trip on a **grouped-placement** med (`Filgrastim`, Morning group) | **PASS** | renders before and after, `["filgrastim=none"]`, exactly 1 occurrence on Home |

---

## Part 4 — edge cases

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| D3-1 | Tour runs from a wiped install | **PASS** | `GUIDE · STEP 1 OF 10` |
| D3-2 | **Mid-tour switch** | **PASS — not reachable by design** | tapping the hamburger mid-tour does not open the drawer (`#app-drawer` count = 0); `openDrawer()` returns early while `state.tourStep != null` (`index.html:2264`). Re-checked at a later tour step: still blocked |
| D3-3 | Switch immediately after the tour ends | **PASS** | `Treatment updated to Radiation` |
| D4-1 | Simulated date applied | **PASS** | `Thursday, Aug 20` |
| D4-2 | Restricted med hidden outside its window under sim date | **PASS** | `Zofran on Home=false` |
| D4-3 | Switch to Other under a simulated date | **PASS** | `1 medication is no longer limited to treatment days` |
| D4-4 | Normalisation applied under sim date | **PASS** | `["zofran-2=none"]` |
| D4-5 | Med reappears on Home immediately | **PASS** | `visible=true` |
| D4-6 | Simulated date preserved across the switch | **PASS** | `Thursday, Aug 20` |
| D5-1 | **Double-tap two types fast** (Other + Radiation dispatched together) | **PASS** | `stored=radiation`, `restrictions=zofran-2=none` |
| D5-2 | Exactly one `aria-pressed=true` afterwards | **PASS** | `Chemo=false , Radiation=true , Both=false , Other=false` |
| D5-3 | Stored state self-consistent after the race | **PASS** | no orphaned rule, no contradictory pair |
| D6-1 | Baseline: no toast on screen | **PASS** | `baseline toast=""` |
| D6-2 | **Tapping the already-selected type is a true no-op** | **PASS** | no toast at all (`if (on) return;`) |
| D6-3 | …and changes no stored data | **PASS** | med config byte-identical |
| D7-1 | Switch with **zero medications** | **PASS** | `Treatment updated to Other`, med store untouched (`{}` — never written) |
| D7-2 | Zero-med Other→Radiation | **PASS** | `Treatment updated to Radiation` |
| D7-3 | Home renders with zero meds after switching | **PASS** | `No medications yet` |
| G1-1 | Delete a restricted med (archive it) | **PASS** | `meds=0 archived={"zofran-2":{"name":"Zofran","sub":"","pausePeriods":[]}}` |
| G1-2 | **Archive schema carries no restriction fields** | **PASS** | `treatmentOnly`/`treatmentMode` absent by construction — nothing can be stranded there |
| G1-3 | **Archived-only profile** switches to Other | **PASS** | `Treatment updated to Other`, archive record byte-identical |
| G1-4 | History entries survive | **PASS** | entries 2→2 |
| G1-5 | Deleted med still named in History after the switch | **PASS** | `TODAY - MONDAY 8/10 / 1 dose / EVENING / 6:31 PM / Zofran / 4 mg` |
| G1-6 | Round-trip to Chemo resurrects nothing on the archive record | **PASS** | `{"zofran-2":{"name":"Zofran","sub":"","pausePeriods":[]}}` |
| I1-1..6 | **Notes + appointments + history + meds through a full 4-switch cycle** (→Radiation→Both→Other→Chemo) | **PASS** | every step `meds=2/2 entries=3/3 notes=1/1 appts=1/1`; note text `Felt queasy after the second dose.` and appointment `Oncology follow-up` both still readable at the end |
| F4-1 | 360px: no horizontal overflow on Settings | **PASS** | `overflow=0px` |
| F4-2 | 360px: Treatment section fits | **PASS** | `x=16 w=328 right=344` (viewport 360) |
| F4-3 | 360px: touch targets | **PASS** | `Chemo:145x44 , Radiation:145x44 , Both:145x44 , Other:145x44` |

---

## Part 5 — reminders re-arming

`markNotifDirty()` returns immediately when `isNativeApp()` is false, so the native alarm bridge itself is not reachable in a browser (named explicitly under "Not verifiable" below). What **is** testable is the plan those reminders are derived from: `medRemindersEnabledOn()` and the missed-dose engine read the *same* `treatmentOnlyBlocks()` gate as the native reminder builder, so a change in what they produce is direct evidence the plan re-derived.

| # | Case | Result | Observed |
|---|---|---|---|
| I2-1 | Chemo, scheduled 8 AM med restricted to a 1-day window, 6 days elapsed | **PASS** | Home banner `1 missed` — restricted to the window, as intended |
| I2-2 | **After →Other, the same med is scheduled every day again** | **PASS** | banner `1 → 8 missed`; toast `1 medication is no longer limited to treatment days` |
| I2-3 | History agrees with the re-derived plan | **PASS** | `banner=8 history=8` |
| I2-4 | `markNotifDirty()` reached on both branches (code) | **PASS** | called before `setState` on the Other branch and on the plain branch (`index.html:5635`, `5639`) |

---

## Part 6 — copy across every screen

Ten screens read as rendered text after switching a real chemo profile (with a treatment date and a logged dose) to **Radiation**, and again to **Other**. Scanned for any `chemo*` word that is not the product name.

| Screen | Radiation profile | Other profile |
|---|---|---|
| Home | **PASS** clean | **PASS** clean |
| Meds | **PASS** clean | **PASS** clean |
| Reports | **PASS** clean | **PASS** clean |
| Symptoms | **PASS** clean | **PASS** clean |
| In-Patient | **PASS** clean | **PASS** clean |
| Account | **PASS** clean | **PASS** clean |
| Calendar | **PASS** clean | **PASS** clean |
| Notes | **PASS** clean | **PASS** clean |
| FAQ | **PASS** clean | **PASS** clean |
| Medication editor | **PASS** clean | **PASS** clean — and no `treatment day` wording either; uses "your date" |
| Guided tour (all 10 steps, replayed) | **PASS** clean | **PASS** clean |
| Settings | **only "chemo" left in the app** | same | `Change this if your treatment plan changes — moving from chemo to radiation, for example.` plus the `Chemo` button label. Both are the new section's own copy and are correct in context (the button *must* be labelled `Chemo`; the helper's example is generic). **Informational, not a defect.** |

Other treatment-type-derived copy verified after switching:

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| G2-1 | Account profile row shows the type | **PASS** | `Chemo · 1 entry` |
| G2-2 | …and updates after the switch | **PASS** | `Chemo + Radiation · 3 entries`, `Other · 1 entry` |
| G2-3 | Printable doctor report header | **PASS** | `Generated August 10, 2026 · ChemoWell app-v53 · Chemo + Radiation` |
| E2 | Radiation-only Home never shows the chemo plan banner | **PASS** | banner absent (`isRadiationOnly()` gate) |

---

## Part 7 — the FAQ fix, verified by navigating there

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| E1-1 | FAQ `reset` answer | **PASS** | `Yes — open Account (in the menu), and scroll to Start over at the bottom. It erases the patient name, medication list, and all logged history from this device. This can't be undone, so use it only if you really mean to wipe the slate clean.` |
| E1-2 | Old wrong text gone | **PASS** | `Settings, all the way at the bottom` — 0 occurrences |
| E1-3 | **Account really contains it** | **PASS** | `START OVER` / `Erase everything stored on this device…` / `Erase all data…` |
| E1-4 | …**at the bottom**, as the answer says | **PASS** | `START OVER` at char 517 of 834 — last section before the nav bar |
| E1-5 | **Settings does not contain it** (the answer would be wrong if it did) | **PASS** | 0 occurrences in Settings |
| E1-6 | It is in the **menu**, as the answer says | **PASS** | drawer item `Account — Profiles, plan & export` |

---

## Part 8 — app-v52 regression sweep

### H-2 — window walk, day by day, exact boundaries
Chemo profile, treatment date **8/20**, `Zofran` only-mode **−2/+3**, `Dexa` excluded-mode **−1/+1**. Simulated date stepped 8/16 → 8/26 through the real Beta date controls.

| Date | Zofran (expect shown 8/18–8/23) | Dexa excluded (expect 8/19–8/21) |
|---|---|---|
| 8/16 | hidden ✓ | open ✓ |
| 8/17 | hidden ✓ | open ✓ |
| **8/18** | **shown ✓** (first day) | open ✓ |
| 8/19 | shown ✓ | **excluded ✓** (first day) |
| 8/20 | shown ✓ | excluded ✓ |
| 8/21 | shown ✓ | **excluded ✓** (last day) |
| 8/22 | shown ✓ | open ✓ |
| **8/23** | **shown ✓** (last day) | open ✓ |
| 8/24 | hidden ✓ | open ✓ |
| 8/25 | hidden ✓ | open ✓ |
| 8/26 | hidden ✓ | open ✓ |

**PASS — no off-by-one at either edge of either mode.** Re-walked after a `chemo→both` switch: **byte-identical**.

### The rest

| # | Case | Result | Observed verbatim |
|---|---|---|---|
| F3-1 | **H-1** Home banner reports a count | **PASS** | `6 missed doses from previous days` |
| F3-2 | **H-1** History equals the banner | **PASS** | `banner=6 history=6` |
| I2-3 | H-1 at a different scale, after a switch | **PASS** | `banner=8 history=8` |
| E3-1 | **H-3** CSV exports after a treatment switch | **PASS** | 4 lines written |
| E3-2 | **H-3** no invented "pill" unit | **PASS** | 0 occurrences |
| E3-3 | **H-3** units verbatim | **PASS** | `Ondansetron,8 mg` · `Senna,2 tabs` · `Aquaphor,2 applications` |
| G2-4 | **H-3** printable report, no "pill" | **PASS** | 0 occurrences; `6:28 PM  Ondansetron  8 mg` |
| F2-1 | **D-2** amber "No date set" chip + caption | **PASS** | `Zofran / No date set / No doses logged / Showing every day until you set a treatment date.` |
| F2-2 | **D-2** still correct after chemo→radiation | **PASS** | identical |
| F2-3 | **D-2** absent on Other (rule is gone entirely) | **PASS** | `Zofran / ✓Available / No doses logged` |
| D2-5 | **D-3** radiation ordering after a switch | **PASS** | `RADIATION SESSIONS` at char 169, `TREATMENT SCHEDULE` at char 247 — sessions first |
| D2-6 | **D-3** splice duplicates nothing | **PASS** | `TREATMENT SCHEDULE` count = 1 |
| F3-3 | **D-4** misses-only day summaries | **PASS** | `Nothing logged · 1 MISSED` ×3 |
| F3-4 | **D-4** no bare "Nothing logged" filler rows | **PASS** | 0 |
| — | **Zero console errors** | **PASS** | 0 app errors across all 26 profiles / 242 assertions (CDN `ERR_CERT_AUTHORITY_INVALID` for the Capacitor `<script>` tags is a sandbox artifact and is filtered, not ignored) |

---

# FINDINGS

## V53-2 — **MEDIUM (functional; blocks ship)**: the legacy "Finish setting up" card is the other `treatmentType` write site, and v53 turned its stranded rule into a live one

* **Where:** `index.html:3415` — `onClick: () => { … setPrefsDB({ sex: curSex, treatmentType: curTreat }); … setToast('Profile updated'); }`
* **What's wrong:** this is the second place in the app that writes `treatmentType`. It has neither the Other-normalisation nor the `markNotifDirty()` that `index.html:5626-5641` just gained. Before app-v53 that was inert: a profile that landed on Other this way had no way back, so the orphaned `treatmentOnly` rule could never be applied again. **v53's new Settings control is exactly the way back**, so the orphaned rule now reactivates — silently, on a medication the user was never shown a control for.
* **Repro (verified end to end, screenshot 13):**
  1. Legacy-shaped profile (pre-app-v33: `patientName` set, `sex` missing, `treatmentType: 'chemo'`) with `Zofran` at `treatmentMode: 'only'`, −2/+3. Home shows **`Finish setting up this profile`**.
  2. Pick **Male** + **Other** → **Save**. Toast: `Profile updated`.
  3. Stored: **`["zofran-legacy=only/true"]`** — unchanged. The editor on Other has no `TREATMENT-DAY AVAILABILITY` section, so there is no way to see or undo it.
  4. Settings → Treatment → **Chemo**. Toast: `Treatment updated to Chemo`.
  5. Stored: **`["zofran-legacy=only/true"]`**. Meds list: **`Treatment day −2/+3`**. The medication is window-gated again and will disappear from Home outside 8/18–8/23 — with the user never having been shown the rule, let alone asked.
* **Expected:** the same normalisation + `markNotifDirty()` the Settings control performs. Either factor `applyTreatmentType(key)` out of `renderSettings` and call it from both sites, or repeat the four lines.
* **Scope:** profiles created before app-v33 that never completed the card. **Newly-added profiles are not affected** — I verified that "Add profile" routes to the full welcome screen (which requires both answers), not to this card, so `needsProfileCompletion()` is genuinely legacy-only. Narrow, but it is a real medication-availability rule changing behind the user's back, and the release's own comment claims it cannot happen.
* **Why it blocks:** TEAM.md's restart rule puts "behaves wrong / touches scheduling logic" in the functional tier, and says to default there when in doubt. This is the same one-line change in the same file the release already edits.

---

## V53-1 — **MEDIUM (copy, safety-adjacent)**: the Other-switch toast describes the wrong rule, and never says the treatment type changed

* **Where:** `index.html:5636` — `setToast(affected.length + ' medication' + (affected.length === 1 ? ' is' : 's are') + ' no longer limited to treatment days')`
* **What's wrong (two things in one line):**
  1. `affected` is `treatmentOnly || treatmentMode !== 'none'`, so it counts **`excluded`**-mode medications too — and then tells the caregiver they are **"no longer limited to treatment days."** That is the *opposite* rule. An `excluded` medication was *blocked near* treatment days; what actually changed is that it is now **available** on days it used to be withheld. Verified: a profile with one `only` med and one `excluded` med produced **`2 medications are no longer limited to treatment days`**.
  2. On this branch the toast **never confirms the treatment type changed at all**. The user taps "Other" and is told something about medications; the only confirmation the switch landed is the button's border. Every other branch says `Treatment updated to …`.
* **Repro:** chemo profile, `Zofran` = Only near treatment day, `Dexamethasone` = Excluded near treatment day → Settings → Treatment → **Other** → toast reads `2 medications are no longer limited to treatment days`. (Screenshot 02.)
* **Expected:** confirm the switch *and* describe the change accurately, e.g. `Treatment updated to Other — 2 medications no longer follow treatment-day rules`. TEAM.md flags copy a caregiver reads while making a medication decision as worth getting exactly right; "limited to treatment days" vs "withheld near treatment days" is that kind of line.

---

## V53-3 — **LOW/MEDIUM (usability)**: chemo→radiation silently takes the treatment date off Home, while medications keyed to it keep depending on it

* **Where:** `index.html:1719` (`if (key === 'showChemoSchedule' && isRadiationOnly()) return false;`) interacting with the new switch at `index.html:5614`.
* **What happens:** a chemo user who has set a treatment date and has `Only near treatment day` medications switches to Radiation. The **Treatment schedule card vanishes from Home** — the radiation-only default — so the date is no longer visible or editable from Home. Verified: `card present=false; date still stored=true`; `Zofran` still renders and is still gated by that now-invisible date.
* **Not data loss, and recoverable:** the date is preserved (`Wednesday, 8/12 · in 2 days` reappears the moment Settings → Home screen → *Treatment schedule card* is switched on), and the v52 D-3 ordering is correct when it is (`RADIATION SESSIONS` before `TREATMENT SCHEDULE`, no duplicates). The section's own promise — *"Your medications, doses and history are all kept"* — holds literally.
* **Expected:** the switch should say so, or carry the date forward. Cheapest fix is one clause in the existing toast when `key === 'radiation'` and a treatment date exists, e.g. `Treatment updated to Radiation — your treatment date is kept; turn its Home card back on in Settings`.

## V53-4 — **LOW**: `release_check.sh` passes green when `sw.js` changed but `CACHE` did not, and then asserts the opposite

* **Where:** `release_check.sh:52` (`[ -z "$SW_DIFF" ]`) and `:80`.
* **Repro:** commit an index.html change plus an sw.js change that leaves `CACHE` identical (a comment). Observed: `✅ Release check passed.` / **`index.html changed and sw.js's CACHE constant changed with it`** — it did not. Every already-installed copy would still be stranded on the old shell, which is the entire failure mode this script exists to prevent.
* **Expected:** compare the extracted `CACHE = '…'` value, the way the `APP_VERSION` check just below already does, rather than testing whether the file is non-empty in the diff. Pre-existing, but the v53 rewrite is the natural place to close it and the success message currently states something untrue.

## V53-5 — **LOW (pre-existing)**: `release_check.sh` is not executable, so TEAM.md's own invocation fails

* Mode `100644` in `HEAD~1`, `origin/main` and the candidate. `./release_check.sh` → `Permission denied`, **exit 126**. TEAM.md's release checklist says *"Run `./release_check.sh` and confirm it exits 0"*. `bash release_check.sh` works. Fix: `git update-index --chmod=+x release_check.sh`.

## V53-6 — **LOW (dead code)**: the new "uncommitted work" warning branch is unreachable

* `release_check.sh:44-49` fires only when `UNCOMMITTED_INDEX` is non-empty **and** `INDEX_CHANGED` is empty. `git diff <commit> -- index.html` compares the **working tree** to that commit, so any uncommitted index change is already in `INDEX_CHANGED`; the only way to satisfy both is an edit that reverts index.html to exactly what `origin/main` has. Observed in R8: an uncommitted index change with no sw bump **hard-fails** instead of warning, contradicting the comment's *"Not blocking (nothing is being published from the working tree)"*. The behaviour is the safe direction; the branch and its comment are just misleading.

## V53-7 — **LOW (dead code)**: no-op ternary in the toast

* `index.html:5641` — `setToast('Treatment updated to ' + treatmentLabel(key, true) + (prev ? '' : ''))`. Both arms are `''`, and `prev` (`index.html:5621`) has no other use. Either drop both, or use `prev` for the better copy V53-1 needs.

## V53-8 — **LOW**: a stale local `origin/main` can mask an unbumped `APP_VERSION`

* `release_check.sh:67` reads the old version from `git show "$BASE":index.html`. This sandbox has no network, so `origin/main` cannot be refreshed after a GitHub web upload. On the next release `$BASE` is two versions behind: the comparison `v52 ≠ v54-with-v53's-label` succeeds and the warning stays silent even if the label was never bumped. The `CACHE` hard-block is unaffected (it fails safe — more likely to demand a bump than to miss one). Worth one line in the fallback warning: *"a stale `origin/main` also weakens the APP_VERSION check."*

## V53-9 — **LOW (cosmetic)**: raw git error leaks before a green pass

* If `$BASE` resolves but has no `index.html`, `git show` prints `fatal: path 'index.html' exists on disk, but not in 'noindex-tag'` to stderr; `|| echo "none"` then swallows the failure and the script exits 0 green. Add `2>/dev/null`.

---

## Screenshots — `outputs/v53-audit-screenshots/`

| File | Shows |
|---|---|
| `02-settings-treatment-switched-to-other.png` | The new Treatment section, Other selected, and **V53-1**'s toast |
| `03-meds-list-after-other-roundtrip.png` | Meds list after Other→Chemo — no chip, restriction genuinely gone (the headline fix) |
| `04-chemo-to-radiation-home-no-treatment-card.png` | **V53-3** — Treatment schedule card gone from Home after chemo→radiation |
| `05-radiation-d3-ordering-after-switch.png` | v52 D-3 ordering intact after a switch: sessions above schedule, date preserved |
| `07-faq-start-over-answer.png` | The corrected FAQ answer |
| `08-account-start-over-at-bottom.png` | Account, `START OVER` at the bottom — the FAQ answer verified by navigation |
| `10-window-walk-boundary.png` | H-2 window walk at a boundary day |
| `11-h1-banner-vs-history.png` | H-1 — banner count and History count agreeing after a switch |
| `12-settings-treatment-360px.png` | The Treatment section at 360px — no overflow, 44px targets |
| `13-legacy-finish-setup-roundtrip.png` | **V53-2** — `Treatment day −2/+3` back on the Meds list after the legacy round-trip |
| `16-reminder-plan-rederived-after-switch.png` | The reminder/missed-dose plan re-derived after →Other |

---

## Not verifiable in this environment (named, with the reason, and with whatever half was testable)

* **Real Android OS notification delivery.** `markNotifDirty()` returns immediately when `isNativeApp()` is false, so the Capacitor LocalNotifications bridge is unreachable in a browser. **What was verified:** that both switch branches call it (`index.html:5635`, `5639`) before the state update it depends on, and that the *plan* those reminders are built from re-derives correctly after a switch — the missed-dose engine reads the same `treatmentOnlyBlocks()` / `medRemindersEnabledOn()` gates and went from 1 to 8 flagged doses after →Other, matched exactly by History (Part 5).
* **The native share sheet** for CSV/report export. The web path was driven end to end: the file was downloaded to disk and read back (Part 8, H-3), and the printable report was opened and its text read out of the popup window.
* **The hardware Back button.**

Everything else in this report was determined by driving the running app. No case was closed by asking anyone to confirm anything on a device.
