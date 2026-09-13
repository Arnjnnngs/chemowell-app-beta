AUDITED-COMMIT: 5eb5e42393313db5beecdfd9bb78bc9dab2c4262
VERDICT: DO NOT SHIP

# ZERO DAY AUDIT — app-v79 (delta audit of commit 5eb5e42)

**VERDICT: BLOCK**

## Headline

**Fix 4 does not work. The exact defect it was written to fix is still live in app-v79, and I
reproduced it in a real browser.**

The release note says: *"Warnings are collected; red beats amber; an existing red is never
overwritten."* Two of those three claims are false. The collection logic is correct — but a single
line from app-v78 was left standing three lines above it, and that line still writes an amber
spacing reminder straight into `state.warn` before any of the new logic runs:

```js
const declared = medInteractionsFor(entry);
if (declared.length) setState({ warn: declared[0] });   // index.html:2280 — LEFTOVER FROM app-v78
```

So the red "daily limit exceeded" warning is still silently replaced by an amber spacing reminder,
and it still depends on the order of the medication list. Measured, in the app, not in a sandbox:

| "Take all" order | warning the caregiver ends up seeing |
|---|---|
| Tylenol (over the 3,000 mg ceiling), then Iron | **amber** — "Iron + Protonix timing" |
| Iron, then Tylenol (over the 3,000 mg ceiling) | red — "Tylenol daily limit exceeded" |

That is the app-v78 behaviour, unchanged, in the release whose stated purpose is to remove it. The
guard added to prevent it (`if (state.warn && state.warn.tone === 'red' && ...) return;`) reads
`state.warn` *after* the leftover line has already destroyed the red it was meant to protect.

**Not one of the 231 checks across the seven suites touches `afterLog`.** The suite added this
release renders Home and Reports — a real improvement — but the release's other four fixes live in
the logging path and are covered by nothing. This is the same shape as the app-v78 failure it is
apologising for: a claim in a commit message standing in for a check.

---

## Findings

### F1 — BLOCKER. The red ceiling warning is still overwritten by an amber one, and still order-dependent.

**Severity: HIGH.** Acetaminophen overdose is the specific harm the red warning exists to prevent,
and "Take all" is the one-tap control most likely to cross the ceiling.

**Where:** `index.html` lines 2279-2281 (`afterLog`), the two lines beginning `const declared =`.

**Reproduction** (`outputs/probe-v79-afterlog.mjs` is not committed; the steps are exact and take a
minute against a served copy of `index.html` with a debug hook on the module scope):

1. Medications: `tylenol` (ceiling 3,000 mg, `ceilingGroup: 'apap'`), `iron`, `protonix`, all
   quick-log. `iron` and `protonix` carry the migrated 2-hour interaction rule.
2. Today's entries: a Protonix dose 30 minutes ago, and a Tylenol dose of 3,500 mg.
3. `afterLog(tylenolEntry)` → `state.warn` is **red**, "Tylenol daily limit exceeded". Correct.
4. Log Iron now (within 2 h of the Protonix dose) and call `afterLog(ironEntry)`.
5. `state.warn` is now **amber**, "Iron + Protonix timing". The red is gone.

Step 4-5 is precisely what "Take all" does when the evening group contains both.

**Fix:** delete the two leftover lines. `medInteractionsFor(entry)` is already called again further
down and pushed into `warnings`, so nothing is lost. With only those two lines removed, the same
probe goes green in both orders — I verified this against an instrumented copy:

```
tylenolFirst: red / Tylenol daily limit exceeded
ironFirst:    red / Tylenol daily limit exceeded
```

`const twoH = 2 * 3600000;` at the top of `afterLog` is also dead and should go with them.

---

### F2 — HIGH, and it appears the moment F1 is fixed. A stale red silences every later amber for the rest of the session.

`state.warn` is cleared in exactly one place: the caregiver tapping the × on the banner
(`index.html:5183`). Nothing else ever nulls it — not a new day, not a new dose, not a tab change.

So once F1's clobber is removed, `if (state.warn && state.warn.tone === 'red' && worst.tone !== 'red') return;`
means: **an undismissed red from any earlier point in the session suppresses every amber warning
raised afterwards, on any medication.** Verified against the fixed copy — a genuinely new
Iron+Protonix spacing warning never reaches the screen:

```
C. STALE RED: a red raised hours ago, never dismissed, vs a NEW amber on another med
   result: red / Tylenol daily limit exceeded      <-- the new amber is never shown
```

A caregiver who leaves the red banner up — which is the reasonable thing to do with a warning that
says *"Check with the care team before logging more"* — stops receiving interaction warnings
entirely, with nothing on screen to say so.

**Fix:** the "don't downgrade a red" rule is about one logging action, not about the session. Scope
it to the batch: set a flag at the start of a "Take all" run (or pass a token into `afterLog`) and
only suppress a downgrade within that run. Anything that persists on screen across minutes is not a
safe thing to gate new warnings on.

---

### F3 — HIGH (Rule 0, leak shape 3). Fix 7 puts one care plan's dose ceilings back into the product file, and the guard that exists to catch that cannot see them.

```js
'imodium':   { homeCard: { kind: 'pills' }, ceiling: true, ceilingMax: 4, ceilingUnit: 'pills' },
'lidocaine': { homeCard: { kind: 'pills' }, ceiling: true, ceilingMax: 4, ceilingUnit: 'applications' },
```

The commit message justifies these as replacing `const imoMax = 4` and `const lidoMax = 4` "inline".
**Neither string exists in the parent commit.** `git show 5eb5e42^:index.html | grep -n 'imoMax\|lidoMax'`
returns nothing; phase 2/3 had already removed them. This release is not moving a number, it is
**re-introducing** one — into the file whose `CLAUDE.md` Rule 0 shape 3 names exactly this
("a dose, ceiling or schedule from one care plan"), and which already carries the `ceilingMg: 2500`
tombstone as the precedent.

Worse, it is applied as a *default over an absence*. `migrateLegacyMedRules` writes a key when
`next[key] === undefined`, and `ceiling` being absent on a medication does not mean "never heard of
it" — it means the user configured this medication and deliberately set no daily limit. That is a
real choice and it is silently overwritten with somebody else's number. `backfillDefaultMedFlags`
carries a whole comment about this exact absent-vs-false distinction, fifty lines away.

**And section 3 of `test/v75-no-other-patient.mjs` — the guard for this shape — passed.** It only
matches `ceilingMg:\s*\d` and a 3-to-5-digit number next to a drug name followed by mg/ml. A
one-digit ceiling in `applications` is invisible to it. The guard is not falsifiable against the
thing this release added.

**Fix:** drop `ceiling`, `ceilingMax` and `ceilingUnit` from both entries. `homeCard` is a display
property and belongs; a daily maximum is a prescription and does not. Then widen the section-3
matcher to flag any `ceilingMax:` literal inside `LEGACY_MED_RULES`, and falsify it by putting one
back.

---

### F4 — MEDIUM. The 4-application limit the release invents for Lidocaine can never fire, and its Home card lies about it.

`dailyCeiling()` routes any medication with a `ceilingUnit` through `dailyPills(med.id)`, which sums
`entry.pills`. `parseDoseOptions` has only written `pills` for a non-mg dose since app-v45; a
lidocaine saved by an older build has doses with no `pills` field at all.

Measured, six patches logged today against the new 4-application ceiling:

```
dailyCeiling: { used: 0, max: 4, unit: 'applications', label: '4 applications' }
dailyPills:   0
```

The ceiling warning never fires, and the Home card this release restores for Lidocaine reads
**"0 / 4 applications"** and **"4 applications left before the daily limit"** — permanently,
however many patches are logged. A limit that reads as satisfied is worse than no limit shown.

This disappears if F3 is fixed. If the ceilings are kept for some reason, `dailyCeiling` needs to
fall back to counting entries when no dose carries `pills`.

---

### F5 — MEDIUM. `no "1 doses"` is a check that cannot fail.

I deleted the entire `hcUnitFor` helper's effect — reverted both call sites in the Home card back to
plural `hcUnit`, i.e. undid fix 8's singular-unit half completely — and
**`test/v79-home-cards-render.mjs` stayed at 12/12.**

The fixture seeds Imodium with 1 pill logged against a limit of 4, so `hcLeft` is 3 and `hcUsed` is
1 — and the `1 doses` string can only be produced by `hcUsed === 1` in the *no-limit* branch, which
that fixture never reaches. The check asserts the absence of a string its own data cannot generate.
That is the same defect as item 6 of the previous audit.

**Fix:** add a fixture medication with `homeCard` and **no** ceiling and exactly one dose logged
(which produces the bare `hcUsed + ' ' + unit` form), and one with a ceiling of 2 and one dose
logged (`hcLeft === 1`). Then falsify by reverting `hcUnitFor` and watching it go red.

The grouped-label check does have teeth — I reverted the label to `hcMed.name` and it failed
correctly. That one is sound.

---

### F6 — MEDIUM (VOICE). The red banner names a medication the caregiver did not tap, and the screen never explains why.

After logging **Tylenol Liquid**, the banner reads:

> **Tylenol daily limit exceeded**
> Today's Tylenol total is 3,500 mg, above the 3,000 mg daily limit set for it. Check with the care
> team before logging more.

Question (a), is it true: in the group sense, yes. Question (b), would a tired person understand it
at 2am: **no.** They tapped one thing and were told about another, with a number bigger than
anything they logged under that name. The reasonable readings are "I mis-tapped" or "the pills are
over but the liquid is fine" — and the second one gets them to give more liquid.

The same release fixed this exact false impression on the Home card, deliberately, by labelling the
shared total **"TYLENOL + TYLENOL LIQUID · TODAY"**. The warning was left naming one member. Two
surfaces describing the same number, one release, opposite conclusions.

**Fix:** use the same grouped label in the warning title and body when
`ceilingGroupMedIds(ceilingOwner).length > 1`.

---

### F7 — LOW. `replaceWindows` can be written onto a stored medication, unguarded.

`if (key === 'replaceWindows') continue;` is correct and does its job. But I removed that line and
ran v75, v77, v78 and v79 — **all four stayed green** while `replaceWindows: true` was persisted
onto every legacy dexamethasone as a stored medication field. The field is inert today, so this is
low severity, but the directive/field separation is unchecked.

**Fix:** one assertion in the v77 suite that a migrated dexamethasone carries no `replaceWindows`
key.

---

### F8 — LOW. The `schemaV` stamp is only applied to medications that match a legacy rule.

`migrateLegacyMedRules` returns at `if (!rules) return next;` before `next.schemaV = MED_CONFIG_VERSION`.
A medication that predates the properties and has no legacy rule is never stamped, so it is
re-walked by the migration on every version-1 restore forever. Harmless today — the walk does
nothing to it. It stops being harmless the first time an id is *added* to `LEGACY_MED_RULES`, which
would then apply retroactively to a customer's medication of that name on an old device.

**Fix:** move `next.schemaV = MED_CONFIG_VERSION;` above the `if (!rules) return next;` line.

---

### F9 — LOW. `hcMax` of 1 still renders a plural unit.

`' / ' + hcMax.toLocaleString() + ' ' + hcUnit` and the bar's `aria-label` both use the plural form
unconditionally, so a medication limited to one pill a day reads "0 / 1 pills". The brief notes one
`hcUnit` site is deliberate; this is the one, and it is deliberate for the wrong reason — the max is
a count like any other.

---

## What I checked and found sound

- **Fix 1, `medHomeCardKind`.** Reads `homeCard.kind`, whitelists `mg|pills|ml`, returns null
  otherwise; no legacy id fallback. Correct, and the new suite genuinely covers it.
- **Fix 5, the deferred persist.** Only one caller of `loadMedicationConfig()` exists (line 1501,
  module init), and `state.meds` / `state.archivedMeds` are assigned the very same array references
  ten lines later, so the timeout writes exactly the migrated list. The v79 suite proves it end to
  end: the stored config comes back stamped `schemaV: 2` with `homeCard` present, which can only
  happen if the deferred write ran with the migrated data.
- **Fix 6, the one-shot migration.** `delete next.windows` → stamp → absent-only loop is the right
  order; the stamp survives `normalizeMedication` (carried explicitly at line 1281, not by spread);
  and the version-1 downgrade test in both v78 and v79 confirms an edited value survives a restore.
- **Fix 8's grouped label** — correct, correctly scoped to `kind === 'mg'`, and falsifiable.
- **`hcMax` NaN handling** — `Number(undefined) || 0` and a negative `volumeCeilingMl` both fall to
  the honest "No daily limit set" branch.
- **Rule 0 shapes 1, 2 and 4** — name, pronouns and the 0/0/0 ratchet all clean.
- All seven suites run green as delivered: **231/231**.

## Working tree

`git status --short` is empty and `index.html` is byte-identical to `HEAD` — every mutant above was
applied and reverted, verified with `diff -q` against a pristine copy taken before the first one.
