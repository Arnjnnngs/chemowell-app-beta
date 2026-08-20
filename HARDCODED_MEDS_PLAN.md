# Plan — Remove every hardcoded medication from the logic (care-tracker + ChemoWell)

**Owner's directive, 2026-08-19:** *"nothing should be working off hard coding. we should be able
to use the meds in the list and determine when it should show up and apply. at no point in time
should Brandi's meds ever show in code for chemowell. scrub that entirely. no meds should be
pre saved."*

---

## 0. WHAT WAS ALREADY TRUE — corrections to an earlier, wrong report

I told the owner ChemoWell "ships `DEFAULT_MEDS` containing Brandi's actual medication list."
**That was wrong.** Verified against app-v57:

| Claim | Reality |
|---|---|
| ChemoWell pre-loads her medications | **False.** `const DEFAULT_MEDS = [];` — empty since app-v3. `DEFAULT_QUICK_LOG_IDS`, `DEFAULT_EVENING_IDS`, `DEFAULT_MORNING_IDS` are all `[]` too. Fresh installs start with an empty list. |
| Her name is in the shipped app | **False.** 0 occurrences in `index.html`, `sw.js`, `manifest.webmanifest`, `package.json`. |

Both were fixed in app-v3/app-v7/app-v8 after an earlier audit. The name **was** still present in
repo *documentation* and in an archived copy of care-tracker's source under `outputs/` — that has
now been scrubbed (0 whole-word matches repo-wide).

**The real problem is narrower and more interesting: the medication NAMES are gone from the data,
but they are still baked into the LOGIC.**

---

## 1. THE ACTUAL DEFECT

A previous audit already found this and applied a *band-aid* rather than a fix:

```js
// Legacy ids from the original single-family app still key special-case logic (chemo lockouts,
// linked windows, fixed ceilings). User-created meds must NEVER receive these ids, or a stranger's
// "Zofran" would inherit another patient's regimen rules (audit P0-2).
const RESERVED_LEGACY_MED_IDS = new Set(['dexamethasone','zofran','protonix','tylenol',
  'tylenol-liquid','iron','compazine','buspirone','paroxetine','morphine','senokot','imodium','lidocaine']);
```

Read that plainly: **the app knows its own logic is unsafe for strangers, so it forbids users from
naming medications in a way that would trigger it.** Thirteen real drug names are unusable, and a
user who legitimately takes Zofran gets an id like `zofran-2` with none of the behaviour.

The behaviours themselves are genuinely useful. They are just attached to the wrong thing — a
hardcoded id instead of a property the user can set.

### Inventory — behaviours currently keyed to a hardcoded id

| # | Behaviour | Hardcoded as | Should be |
|---|---|---|---|
| 1 | Windows that shift with the chemo cycle | `med.id === 'dexamethasone'` → `dexWindowsForOffset()` (4 sites) | `chemoRelativeWindows: [{ dayOffset, start, end, name }]` |
| 2 | Blocked for N days around chemo | `zofranBlockedOn()`, `med.id === 'zofran'` | `chemoBlock: { fromDayOffset, toDayOffset }` |
| 3 | Schedule follows another med's actual dose | `morningLinkedToProtonix` / `eveningLinkedToProtonix`, `protonixMorningLogTs()`, `protonixEveningLogTs()` | `linkedTo: { medId, offsetH, fallbackHour }` |
| 4 | Interaction warning between two meds | `if (entry.medId === 'iron' \|\| entry.medId === 'protonix')` + hardcoded copy | `interactions: [{ withMedId, minGapH, message }]` |
| 5 | Home counter card | `usedRecently('tylenol')`, `usedRecently('imodium')`, `dailyPills('imodium')`, `tylenolMg()` | `homeCard: { kind: 'mg' \| 'pills' \| 'ml' }` (care-tracker v43.4 already gates these on `medIsOnActiveList`) |
| 6 | Combined ceiling across forms | `entry.medId === 'tylenol' \|\| 'tylenol-liquid'` | `ceilingGroup` — **already generic**, only the trigger is hardcoded |
| 7 | Report summary lines | `medId === 'tylenol'` mg total, `medId === 'imodium'` pill total | derive from `homeCard.kind` / `ceilingGroup` |
| 8 | Server reminders | `send-reminders.js` — 4 literal if-statements naming 5 meds | read the shared config (care-tracker v46 put it in Firestore, so this is now possible) |

**Neither app can currently express "this medication's timing depends on chemo" as data.** That is
the whole gap.

---

## 2. THE PLAN

Same shape for both apps. **ChemoWell first** — it is the one going to the App Store, and its
`RESERVED_LEGACY_MED_IDS` list is user-visible harm today.

### Phase 1 — Make the behaviours expressible as data (no behaviour change)
Add the properties in the table above to the medication schema. Implement each code path to read
the property, falling back to the hardcoded branch when the property is absent. **Nothing changes
for anyone yet.** Every existing suite must stay green; that is the proof.

### Phase 2 — Migrate the legacy ids onto properties
For each of the 13 reserved ids, express its behaviour as the new properties, and delete the
hardcoded branch. Prove equivalence the way `reminder-equivalence.mjs` already does on
care-tracker: simulate the old and new paths across a full cycle and require **zero** differences.
This is where `dexWindowsForOffset`, `zofranBlockedOn`, `protonixMorningLogTs`,
`protonixEveningLogTs` and `tylenolMg` are removed.

### Phase 3 — Free the names
Delete `RESERVED_LEGACY_MED_IDS`. A user can call their medication Zofran, get the id `zofran`,
and get **only** the behaviour they configured. Test: create a med named "Zofran" on a fresh
install and assert it has no chemo block, no linked window, no inherited ceiling.

### Phase 4 — Expose it in the editor
The properties are useless if only a developer can set them. The medication editor needs UI for:
blocked-around-chemo, schedule-follows-another-med, and interaction warnings. **Design pass
required** — this is the step most likely to produce a confusing screen, and it is the one that
decides whether a real patient can actually describe their own regimen.

### Phase 5 — Server reminders read the config
Rewrite `send-reminders.js` to read the shared medication config instead of literals. care-tracker
v46 made this possible by moving config into `caretracker_prefs`. **Ship behind the
already-built-and-tested reminder ledger**, and note the standing decision: an extra notification
is safer than a missing one.

---

## 3. RISK — why this is not a refactor to do casually

This is the scheduling engine of a medication app that a cancer patient uses daily. A mistake does
not show up as a crash; it shows up as **a dose that was never prompted for**, or a missed-dose
alert that never fires. That failure is silent, and this project has shipped exactly that class of
bug before (v43.3: correcting a schedule type silently disabled missed-dose alerts).

Therefore, non-negotiable for every phase:
- **Equivalence testing, not spot checks.** Simulate a full chemo cycle, old path vs new, require
  zero differences — the `reminder-equivalence.mjs` pattern (470,880 ticks, 0 violations).
- **Falsify every check.** Break the thing, watch it go red, restore.
- **One phase per release.** Never two of these in the same version.
- **care-tracker is a live patient app.** Phases land in ChemoWell first and only move to
  care-tracker once proven there.

---

## 4. SEQUENCING

| Order | What | Size | Why this order |
|---|---|---|---|
| 1 | ChemoWell Phase 1 | M | Additive, no behaviour change, unblocks everything |
| 2 | ChemoWell Phase 2 | L | The real work; needs equivalence proof |
| 3 | ChemoWell Phase 3 | S | Deleting the reserved list is one line once 2 is done |
| 4 | ChemoWell Phase 4 | M | Design pass; the store build needs it |
| 5 | care-tracker Phases 1–3 | L | Same code, proven design, applied to the live app |
| 6 | Phase 5 (both) | M | Depends on shared config; already unblocked on care-tracker |

**Not started.** This document is the plan the owner asked for, not a change. Nothing in either
app has been modified by it beyond the name scrub described in section 0.
