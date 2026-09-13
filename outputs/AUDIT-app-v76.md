# Zero Day Audit — ChemoWell app-v76 (HARDCODED_MEDS_PLAN phase 1)

AUDITED-COMMIT: ad1f94b94e574b40bce814108c5fac2f9e43cbeb
VERDICT: SHIP

The audit returned **BLOCK** with six blockers and three minors. Every one is fixed and re-verified;
this verdict is on the fixes. The release's claim is that phase 1 changes no behaviour, and three of
the six blockers were places where that was false.

## THE HEADLINE

**The normaliser rejected values and never removed them.** `normalizeMedication` spread
`...original` and only then spread the normalised values — and a normaliser that rejects returns
`undefined`, so the spread became `...{}`, nothing was added, and the raw value copied a few lines
earlier stayed. **Every guard written in those five normalisers was bypassed on exactly the inputs
they were written to reject.** An inverted window `{start: 10, end: 5}` reached the resolver. An
interaction with no `body` rendered a warning modal that said nothing — under a comment in the
normaliser reading *"a warning with nothing to say is worse than none"*. The guard was written, then
bypassed by the line above it.

**FIXED** — rejection now `delete`s the key, following the pattern the end of that same function
already uses for `awayPeriods`, `doses` and `windows`. Every normaliser uses `Number.isFinite`
instead of `Number(x) || 0`, which let `Infinity` through.

## The other five blockers

| # | Finding | Fix |
|---|---|---|
| B1 | `medInteractionsFor` did not validate its rules. `interactions: [null]` threw on `rule.minGapH` — and because `afterLog` runs inside a `setTimeout` **the dose still saved**, so the caregiver silently lost the red acetaminophen-ceiling warning on that log and every later one, with nothing on screen. The sibling resolver had this fix; this one did not. | Validates every field, every rule. |
| B3 | `medWindowsFor` can return `[]`, which `med.windows` never could — `normalizeMedication` guarantees a scheduled medication at least one window. `first.start` then threw inside `status()` for a medication with `chemoRelativeWindows` on a device with **no treatment date on record: the default state of every new user and of anyone who used Clear.** Blank Home and blank Meds, and Meds is the only place edit and delete live. | Guard returns `{ locked: true, noWindowToday: true }` — locked-with-no-`availableAt` is an established shape here and every consumer already guards it. |
| B4 | A declared interaction returned early and **pre-empted the ceiling warning**. Reproduced at 6,000 mg against a 3,000 mg limit: the spacing reminder showed and the red ceiling warning never fired. Impossible in app-v75, because the legacy branch only returned for iron/protonix — making the rule generic made it reachable. | No early return; the ceiling warning runs and wins. |
| B5 | `medWindowsFor` applied the Protonix-linked branches. Two of the three call sites it replaced never had them — the missed-dose walk's line was `med.id === 'dexamethasone' ? … : med.windows`, full stop. On a fixture with an evening Protonix dose the night window moved 22:00 → 21:00, **changing which doses count as missed.** A real behaviour change inside a patch whose whole claim is that it changes none. | The branches stay at `status()`'s own call site. The resolver does not apply them, and there is a check pinning that. |
| B6 | Two suite checks could not fail: the no-treatment-date branch (the fixture used a day ten days after treatment, where the offset is 10 and not null) and the sort (the fixture was already sorted). | A separate no-dates world, and an unsorted fixture. Re-mutated. |

## Minors, all addressed

- **B7** — the release's headline evidence was not in the gate. `release_check.sh` now runs both v76 suites.
- **B8** — `medHomeCardKind` was never called: four net-new references to one patient's ids, counted as "migrated" while the branches they mirror were untouched. **Removed.** The property is still normalised, so data written now is ready; the resolver lands in phase 2 with its call sites.
- **B9** — the ratchet's regex only matched `med|entry|m`, so `e.medId === 'tylenol'` was invisible. Widened to any variable, `==`, `.includes()` and `switch`. **Re-measured against app-v75 on the same regex for an honest comparison: 20 → 16 outside, 0 → 5 inside.** The narrow version had reported 17 → 13.

## What the audit could not break

The patch reproduces app-v76 byte-identically from a clean app-v75 base, refuses to double-apply,
validates `sw.js` before writing either file, and every anchor is a full exact string with
`count()==1` asserted. No prototype pollution on any of the five properties. An inverted
`chemoBlock` is harmless — `medChemoBlockingDay` returns null and `status()` falls through to
available, the safe failure. The ratchet's staleness check works in both directions and the
`RESOLVERS` list is hardcoded, so hiding a branch inside a "resolver" requires editing the test,
which is visible in the diff. The session hook cannot wedge a session. The
`APP_CLAUDE.md → CLAUDE.md` rename lost nothing but the old title.

## And two defects in the patch itself, found while building it

1. **It nearly deleted 180 lines of `index.html`.** The anchor for the `status()` window ternary was
   a two-space-indented prefix matched with `str.index` — and the missed-dose walk's four-space line
   *contains* that prefix at offset 2, so it matched line 1773 instead of 1955. Caught only by a
   later count check that happened to be looking at one of the deleted lines.
2. **The new render test passed against its own mutant, twice.** First because it seeded a guessed
   `localStorage` key (the real one is profile-scoped) so nothing loaded and the screen was blank for
   the wrong reason; then because it asserted on the Meds screen, which does not call `status()`.
   It now navigates to Home explicitly, and deleting the B3 guard turns it red with the exact
   `TypeError: Cannot read properties of undefined (reading 'start')`.
