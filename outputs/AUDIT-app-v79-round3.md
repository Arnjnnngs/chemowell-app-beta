# ZERO DAY AUDIT — app-v79 ROUND 3 (delta audit of commit `c2bda8f`)

**VERDICT: PASS — ship it.** Six findings below, none of them a reason to hold this release.

## Headline

**The blocker is genuinely fixed, and I proved it with round 2's own mutant.** I deleted the batch
token from the one production caller — the `ids.forEach` inside "Take all" — and
`test/v79-warning-priority.mjs` went **9/11, RED**, naming the exact defect:

```
3. THE REAL "TAKE ALL" CONTROL, WHICH IS THE ONE THE FIX ACTUALLY LIVES IN
  FAIL  Tylenol first -> the caregiver is left looking at the RED ceiling warning  |  {"tone":"amber","title":"Iron + Protonix timing"}
  FAIL  so the warning no longer depends on the order of the medication list
```

Round 2 blocked because that edit left all nine suites green. It no longer does. The suite now taps
Home → Evening meds → Take all → Confirm in both medication orders, which is the control a caregiver
actually touches.

**What I could not close: the Rule 0 leak guard is narrower than it claims, and I got a whole
stranger's care plan past it twice — 25/25 green.** One of those two is the exact leak round 1 was
blocked for (`ceilingMax` on `tylenol`), restored by adding two quote characters. **That is a guard
weakness, not a leak: I checked the shipped table and it contains only the eight legacy entries, no
ceiling, no stranger, ratchet 0/0/0.** Nothing in this release harms a caregiver or loses a record.

**And `main` is currently serving a Home screen that throws on every render for any migrated
device.** Holding a release that revives it, over a guard against a leak that is not present, would
be the wrong trade. Ship this; the six items below are the next release's list, F-R3-1 first.

---

## Findings, ranked

### F-R3-1 — MEDIUM. R2-2 was narrowed, not fixed. Three bypasses, two of them fully green.

The new guard pins the table's *allowed* shape: a key matcher `/^\s{2}'([^']+)'\s*:/gm`, a
thirteen-id allow-list, and an inventory of permitted numeric keys. All three are string-shaped, and
each can be stepped around without changing what the code does.

**Bypass A — drop the quotes.** The key matcher requires a quoted key at exactly two spaces of
indentation. An unquoted key is identical JavaScript and invisible to it. Round 2's own exploit,
with the quotes removed:

```js
  warfarin: { interactions: [{ withMedId: 'aspirin', minGapH: 6, title: 'Warfarin + aspirin',
    body: 'Space these six hours apart per the care plan.' }] },
```

`node test/v75-no-other-patient.mjs` reports **`9 entries`** — it never saw `warfarin` — and "not
growing" passes at `9 of at most 14`. It failed only on the *unrelated* gap counter
(`minGapH: 2 | minGapH: 2 | minGapH: 6`), which is luck, not coverage.

**Bypass B — the same unquoted key, carrying a schedule instead of an interval. 25/25 GREEN.**

```js
  warfarin: {
    replaceWindows: true,
    windows: [{ start: 7, end: 9, name: 'Morning' }, { start: 19, end: 21, name: 'Evening' }],
    chemoRelativeWindows: [{ dayOffset: 3, start: 7, end: 9, name: 'Morning' }]
  },
```

A complete dosing schedule for a drug nobody asked for — twice daily, plus a treatment-relative
window — inside `LEGACY_MED_RULES`, every gate green. `dayOffset`, `start` and `end` are on
`ALLOWED_NUMS` and have no count ceiling, so schedules are unlimited by construction.

**Bypass C — write the number as a string. 25/25 GREEN, and it works at runtime.** No unquoted key
needed; this one uses a quoted, allow-listed id:

```js
  'tylenol': { homeCard: { kind: 'mg' }, ceiling: true, ceilingMax: '3000', ceilingUnit: 'mg' },
```

The inventory matcher is `/\b(ident)\s*:\s*(-?[\d.]+)/` — a quote after the colon and the number is
gone. And it is not inert: `index.html:1721` reads `const configured = Number(med.ceilingMax)`, so
`'3000'` is a live ceiling. **This is round 1's F3/F4 leak, re-enterable with two characters, past
the guard written twice to stop it.**

**Fix (next release, not this one):** parse the table instead of matching it. `LEGACY_MED_RULES` is
a plain object literal — evaluate it in a sandbox (the v76/v77 suites already lift code into Node
this way) and walk the real object: `Object.keys()` against the allow-list catches A, and a
recursive walk asserting every leaf is `string | boolean | number-in-inventory` catches B and C.
A regex over source text will keep losing this race; three rewrites in three rounds is the evidence.

---

### F-R3-2 — MEDIUM/LOW. R2-5's fix is correct and covered by nothing.

The behaviour shipped is right: `index.html:2373` is now `if (warnBatch && warnBatch.red) return;`,
the comment above it is true, and I confirmed an **amber-then-red** batch still shows the red (the
flag is only set after a red passes the guard, so an earlier amber cannot suppress it).

But I put round 2's version back —

```js
  if (warnBatch && warnBatch.red && worst.tone !== 'red') return;
```

— and got **`v79-warning-priority` 11/11** and **`v79-home-cards-render` 16/16**. Every suite green,
the fix silently undone.

This is the third consecutive round in which a fix in `afterLog` ships with no check that can see it.
Stakes are much lower here than R2-1 — both candidates are red, both say "check with the care team",
so a caregiver is warned either way — which is why it is not a blocker. But it will rot.

**Fix:** one section in `v79-warning-priority.mjs`: a batch raising a group-ceiling red and a volume
red, asserting the FIRST title survives. Falsify with the line above.

---

### F-R3-3 — LOW/MEDIUM (VOICE). R2-4 was fixed on one of the two surfaces round 2 named, and the fallback can still print the placeholder.

**The warning banner is fixed** (`index.html:2341-2345`): capped at two names plus `and N more`.

**The Home card is not.** `index.html:5288`, unchanged by this commit:

```js
? ceilingGroupMedIds(hcMed).map(gid => (state.meds.find(m => m.id === gid) || {}).name).filter(Boolean).join(' + ')
```

Same unbounded join, same `.filter(Boolean)` that round 3's own comment explains can never fire —
`normalizeMedication` (`index.html:1294`) writes `'Untitled medication'`, so no member is falsy.
Round 2 asked for both surfaces ("One line each, both surfaces"); one landed.

**And the banner's fallback is not placeholder-proof.** When any member is unnamed the label falls
back to `(ceilingOwner || {}).name` — which is `'Untitled medication'` when the owner is the unnamed
one. The word still reaches a safety warning, just by a longer route.

**Fix:** port the capped/placeholder-safe label into a small helper and call it from both sites;
in the fallback, use the first member whose name is not the placeholder before falling back to the
owner's.

---

### F-R3-4 — LOW (VOICE). The singulariser is better and still wrong for a class it claims to leave alone.

`hcUnitFor` now handles `-es` correctly and refuses double-`s`. Measured across 42 units:

| typed | printed at 1 | |
|---|---|---|
| `patches` `boxes` `glasses` `washes` | `patch` `box` `glass` `wash` | correct, the R2-3 fix |
| `mg` `mL` `IU` `mcg` `tsp` `floss` `ss` | unchanged | correct, and `mg`/`mL` are never touched |
| `gotas` `comprimidos` `gouttes` | `gota` `comprimido` `goutte` | correct in Spanish and French |
| **`bolus`** | **`bolu`** | a real unit word, not a plural |
| **`suppositories`** | **`suppositorie`** | `-ies` is the other common English plural |
| **`gas`** **`lens`** **`dosis`** | **`ga`** **`len`** **`dosi`** | singular nouns ending in `s` |

The commit's own rule — *"where the rule is not safe the unit is left exactly as typed… '1 fee' is a
different word"* — is exactly right, and `-ies` and `-us`/`-is` are two more places it is not safe.
Cosmetic only; nobody is harmed by "1 bolu".

**Fix:** add `/ies$/ → 'y'`, and leave `-us` / `-is` / `-as` endings alone.

---

### F-R3-5 — LOW (VOICE). The new version-history row asserts something about the guard that is not true.

The shipped README row says the rewritten guard *"catches an addition, a ceiling and a swap that
keeps the count the same."* F-R3-1 bypasses A and C are an addition and a ceiling, both green.

This is the same category as R2-6, which this round fixed: a release note asserting a property the
code does not have. R2-6 itself **is** properly fixed — the false `imoMax` comment is gone, the
README no longer contradicts itself four sentences later, and the only surviving `imoMax` strings
are the ones explaining it never existed (`index.html:1193`, the README row) plus
`test/fixtures/app-v76-base.html`, which is the genuine historical file and must keep it. R2-7's
*"these share"* shipped and reads well.

**Fix:** soften the sentence to what the guard does (pins the quoted ids and bare numeric literals),
or do F-R3-1 and make the sentence true.

---

### F-R3-6 — LOW. The page-error filter matches against a full stack, and swallows the one class this repo has already shipped a defect in.

```js
const real = errors.filter(e => !/Capacitor|cdn|Failed to fetch dynamically/i.test(e));
```

`errors` is built from `page.on('pageerror', e => errors.push(String(e)))`, and `String(e)` on a
thrown `Error` includes **the stack**. `index.html` loads from `cdn.jsdelivr.net`, so a genuine
`TypeError` whose stack passes through that file is filtered out by `/cdn/i`. And `/Capacitor/i`
removes any error naming a Capacitor plugin — the same shape as the broken plugin bundle that
silently killed native export from app-v47 to app-v49.

The assertion itself works: with a `null.x` injected at the top of `afterLog` the suite fails loudly.
This is about the filter's width, not its existence.

**Fix:** anchor the filter to the message (`String(e).split('\n')[0]`) and match on the specific
known-noise strings rather than the bare token `cdn`.

---

## What I verified as genuinely fixed

* **R2-1 — FIXED, and the check now bites.** Round 2's mutant → 9/11 RED, both order checks failing
  with `{"tone":"amber","title":"Iron + Protonix timing"}`. I also looked for another single-token
  edit the suite still cannot see in the warning path: deleting either
  `if (warnBatch && warnBatch.red) return;` or `warnBatch.red = true` removes all suppression and
  section 3 fails on the Tylenol-first order. `const worst = warnings.find(red) || warnings[0]`
  reduced to `warnings[0]` is invisible — but it is also behaviour-neutral, because reds are pushed
  into `warnings` before ambers in every path. The one real hole is F-R3-2.
* **R2-3 — FIXED, both halves.** Reverting the two `hcUnitFor(hcMax)` sites → **14/16**, failing
  `a limit of one is printed singular too` and `and so does the bar's screen-reader label`. The
  `ceilingMax: 1` fixture reaches the branch, and this is the first `aria-label` assertion in the
  repo. The suite reads `document.querySelector('main').innerText`, not `document.body.textContent`.
* **R2-5 — behaviour fixed** (see F-R3-2 for the missing check). Amber-then-red still shows the red.
* **R2-6 / R2-7 — FIXED.** See F-R3-5.
* **R2-8 — FIXED**, with the width caveat in F-R3-6.
* **Rule 0, all four shapes, on the shipped tree.** `LEGACY_MED_RULES` holds eight legacy entries
  plus `__flags__`; no ceiling, no dose, no stranger id, no new interval. The 0/0/0 ratchet is
  accurate and not stale. No name, no gendered pronoun.
* **All nine suites green as delivered:** v75-no-other-patient 25/25 · v75-table-builder 96/96 ·
  v75-med-description-shots all · v76-properties-equivalence 22/22 · v76-empty-window-render 13/13 ·
  v77-legacy-migration-equivalence 36/36 · v78-fence-removed 20/20 · v79-home-cards-render 16/16 ·
  v79-warning-priority 11/11.

## Working tree

`index.html` restored byte-exact — md5 `2b0d7276174ef24c7fc4a86e6b177f79`, matching the pre-audit
copy. Every mutant above was applied and reverted individually. `git status --short` shows only
`?? test/v80-pixel-identity.mjs`, which is not mine — it is in-flight app-v80 work, dated 20:23,
five minutes after `c2bda8f`, and it was untracked before this audit began.
