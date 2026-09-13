AUDITED-COMMIT: f5677f40eedd526d8aaa0720147d123dbf7f9b3a
VERDICT: SHIP

# Zero Day Audit — app-v79, round 5 (delta pass)

Scope: `git show f5677f4` and nothing else. The application behaviour in `6314bd7` was cleared
by `outputs/AUDIT-app-v79-round4.md` and was not re-audited.

## HEADLINE, in plain words

**All six of round 4's findings are genuinely fixed, and I could not break any of the five
repaired checks. Ship it.** The schedule ratchet now goes red on my predecessor's exact
repro, `__proto__` is caught rather than quietly dropped, the placeholder mutation goes red,
the page-error suite now fails on a real plugin error, and `run-all-tests.sh` is no longer
red because of the pixel suite.

**The one thing worth saying loudly is not a blocker: the fix for the unit singulariser
replaced one net regression with another, smaller one, and it is uncovered.** Round 4 removed
`if (hcUnit.length <= 4)` because it rescued `lens` and broke twelve real units. The
replacement — widening the "singular nouns that end in s" rule from `(us|is|as)` to
`(us|is|as|ns)` — rescues `lens` and breaks twelve real units: **applications, injections,
inhalations, infusions, spoons, teaspoons, tablespoons, pens, cans, tins, pins, grains**.
Two of those, **pens** and **cans**, are on the commit message's own list of nine words it
says the reversal puts right, so that sentence is not true. And `applications` is named in
`test/v79-home-cards-render.mjs`'s own forbidden-plural list — I swapped one fixture's unit to
`applications` and the suite went red immediately. It is green today only because no fixture
uses a unit of that shape, while the same commit added a fixture for the other shape.

This is a wording slip on a Home card ("1 applications"), not a harm, not a lost record, and
not a check that cannot fail — the check can fail, it just is not exercised for the new
clause. `main` is serving a Home screen that throws on every render for any migrated device.
Shipping is plainly better than not. **The fix is one word and should ride the next commit.**

---

## Verification of F-R4-1 … F-R4-6

### F-R4-1 — schedule ratchet — **FIXED**

`sched.length <= 9` against a live 9. My predecessor's repro (a twice-daily
`chemoRelativeWindows` under `'tylenol'`):

    FAIL  and the schedule numbers have not multiplied  |  15 of at most 9
    26/27 checks passed

I then tried to get a care plan in without adding a schedule number.

- **A number on an allowed key used for something else** — `'tylenol': { homeCard: …, gapH: 6 }`
  → **red**, `minGapH: 2 | minGapH: 2 | gapH: 6`. The gap ratchet catches it. Good.
- **A rule expressed only in strings and booleans** → **27/27 GREEN.** See F-R5-2 below. Not a
  regression from this commit, and not what round 4 asked for; recorded as a residual.

### F-R4-2 — `__proto__` — **FIXED, and it catches rather than drops**

The table is lifted as written and `Object.getPrototypeOf(TABLE) === Object.prototype` is
asserted. Round 4's warfarin/aspirin repro:

    FAIL  the rule table sets no prototype, so nothing can hide behind one  |  ["warfarin"]

The diagnostic names the hidden key, which is the proof it was caught and not silently
discarded — the failure mode the commit message describes its own first attempt falling into.

Other hiding places tried:

| hiding place | result |
|---|---|
| `get warfarin() { return {…} }` | **red** — `no medication in the rule table that is not a known legacy id  \| warfarin`. `Object.keys` sees an enumerable accessor, and the walk invokes it. |
| `0: { … }` (numeric key) | **red** — `… \| 0` |
| `[Symbol.for('warfarin')]: { … }` | **27/27 GREEN** — hidden. See F-R5-3; inert, and inert by language semantics rather than by luck. |
| `Object.defineProperty` | not expressible inside an object literal, so not reachable by this shape. |

### F-R4-3 — the placeholder — **FIXED and covered; the scoping question is a real gap**

Restoring `.filter(Boolean)` in `sharedTotalLabel`:

    FAIL  an unnamed medication is never joined into a shared-total label
          | … | IBUPROFEN + UNTITLED MEDICATION · TODAY | …
    19/20 checks passed

The two-member `ceilingGroup: 'ibu'` pair is the right choice — at three members the cap
summarises the placeholder away, which is the trap the commit message says it fell into first.
`test/v79-warning-priority.mjs` stays 14/14 on the same mutation, as expected: it has no
unnamed fixture.

**The scoping does NOT cover the red ceiling banner.** The assertion matches lines containing
`· today`; the banner reads *"Ibuprofen + Untitled medication daily limit exceeded"* and
*"Today's Ibuprofen + Untitled medication total is …"*, neither of which contains that marker.
I proved it: I left `sharedTotalLabel` correct and leaked the placeholder into the banner only,
by rewriting the `limitLabel` line at the `afterLog` call site to join names with
`.filter(Boolean)`.

    v79-home-cards-render      20/20 checks passed
    v79-warning-priority       14/14 checks passed

So the second of the two surfaces this fix exists to protect — the red safety warning, the more
dangerous one — has no placeholder coverage of its own. Today both surfaces route through the
one helper, so the delivered fix holds; nothing pins that they keep doing so.

### F-R4-4 — the singulariser — **floor FIXED and covered; the replacement clause is a new regression and is uncovered**

Floor back at `> 2`, covered by the new `ceilingUnit: 'caps'` fixture:

    (floor put back to <= 4)  FAIL  a four-letter unit is still singularised  |  … | 1 / 1 caps
    (whole us|is|as|ns rule deleted)  FAIL  a unit that only looks plural …  |  … | 1 / 1 bolu

Both go red. That part is right.

**But removing just `ns` from the rule leaves every suite GREEN (20/20).** The new clause is
covered by nothing, which is the shape round 4 blocked for twice.

**And it is a net regression.** Old rule (`(us|is|as)`, floor `> 2`) against the delivered rule,
over real `ceilingUnit` values:

| typed | before this commit | after |
|---|---|---|
| applications, injections, inhalations, infusions | `1 application`, `1 injection`, … | `1 applications`, `1 injections`, … |
| spoons, teaspoons, tablespoons | `1 spoon`, `1 teaspoon`, `1 tablespoon` | `1 spoons`, `1 teaspoons`, `1 tablespoons` |
| pens, cans, tins, pins, grains | `1 pen`, `1 can`, … | `1 pens`, `1 cans`, … |
| lens | `1 len` | `1 lens` ✔ (the one it rescues) |

Twelve for one, the same trade round 4 was blocked for. `-tion`/`-sion` plurals are the common
case — and `applications` is the unit from round 1's own documented leak
(`ceilingMax: 4, ceilingUnit: 'applications'`).

**The suite already says this is a defect.** Line 189 of `test/v79-home-cards-render.mjs`:

    const plurals = (txt.match(/\b1 (?:doses|tablets|lozenges|pills|applications)\b/g) || []);

I changed the `capsule` fixture's unit from `caps` to `applications`:

    FAIL  no count of 1 is printed with a plural unit  |  1 applications
    18/20 checks passed

**Non-English.** Spanish `-as` plurals — `gotas`, `pastillas`, `cápsulas` — are still left plural
(`1 gotas`). That is the pre-existing `-as` clause, not this commit, and round 4's table saying
they read `1 gota` before round 4 was wrong about that. French `comprimés`, Italian `compresse`
and `bustine` all singularise correctly.

**Fix (one word, no risk):** drop `ns` from the alternation and match `lens` by name —
`if (/(us|is|as)$/i.test(hcUnit) || /^lens$/i.test(hcUnit)) return hcUnit;` — and add a
`ceilingUnit: 'pens'` fixture asserting `1 pen`, so the clause is covered whichever way it is
written. Correct the commit-message and code-comment sentence that says the reversal fixes
`pens` and `cans`; under the delivered rule it does not.

### F-R4-5 — page-error exemptions — **FIXED, and it can fail**

`const real = errors.slice();` — both exemptions gone. Suite passes as delivered (14/14). I
injected a throw inside a `setTimeout` in app code and watched it:

    'Could not load Capacitor plugin Filesystem'  ->  FAIL  no page error during any of the above   13/14
    'boom in afterLog'                            ->  FAIL  no page error during any of the above   13/14

The app-v47 class is no longer swallowed. The README correction is accurate and matches what I
measured.

### F-R4-6 — `run-all-tests.sh` — **FIXED**

| invocation | exit | first line |
|---|---|---|
| (none) | **0** | `SKIP  this suite is a before/after comparison and takes a directory.` |
| `--check` | 1 | `FAIL  --check given with no directory` |
| `--save` | 1 | `FAIL  --save given with no directory` |
| `--check /tmp/nope-baseline` | 1 | `FAIL  no baseline at … -- run --save on the PREVIOUS build first` |

The skip is scoped to "no mode flag at all", so a mode flag with a missing argument still fails,
and a missing baseline still fails rather than being regenerated. `run-all-tests.sh` invokes this
suite bare, so **it is no longer red because of this suite.**

**It is still red, and by a wide margin.** The full run completed after my first pass at this
section: **PASS 32 · FAIL 13 · COULD-NOT-START 1**, exit 1. None of it is caused by `f5677f4`,
and the detail matters because two of the thirteen are this release's own gates:

    failing:      audit-v55 pm-v55 pm-v55b v52-fixes v55-fixes-shots v55-help
                  v57-browser-notice v74-shipped-audit-probe v75-med-description-shots
                  v76-empty-window-render v78-fence-removed v79-home-cards-render
                  v79-warning-priority
    cannot start: audit-v55b

- **`v76-empty-window-render`, `v78-fence-removed`, `v79-home-cards-render` and
  `v79-warning-priority` are NOT really red.** Re-run through the same script as a subset
  (`./run-all-tests.sh v79 v78 v76`) they are **ALL GREEN — 13/13, 22/22, 20/20, 20/20, 14/14**,
  and they are green run directly too. In the 48-suite run they exit non-zero without printing a
  single `FAIL` line, which is a crash or a timeout, not an assertion — the signature of forty-odd
  Chromium suites contending back to back in one sandbox. **Worth fixing in the runner**, because a
  gate that is red for a reason everyone learns to explain away is the exact hazard that script's
  own header is about; but it is not a property of this commit.
- **`audit-v55b` cannot start** — it reads `/tmp/topics.js`, a path from a sandbox that no longer
  exists. Named in the runner's own header. Pre-existing.
- **`v74-shipped-audit-probe` is genuinely red, and pre-existing.** It fails identically on the
  parent commit `6314bd7` (19/22 both times), so it is not this release. It is worth someone's
  attention on its own: *"an empty name renders NO link"* is failing with
  `https://medlineplus.gov/search/?query=Untitled%20medication` — the same `UNNAMED_MED`
  placeholder as F-R4-3, reaching a third surface nobody has looked at — alongside an unencoded
  `'` surviving into an href and a mutant the suite admits is *"weaker than claimed"*. Outside my
  delta scope; flagged, not audited.
- The rest (`audit-v55`, `pm-v55`, `pm-v55b`, `v52-fixes`, `v55-*`, `v57-browser-notice`,
  `v75-med-description-shots`) are the long-standing Help-screen reds the runner's header already
  documents.

So F-R4-6's fix is correct and does what it claims — the pixel suite no longer contributes a red —
but **it does not make `run-all-tests.sh` green**, and nothing in this release claimed it would.
`release_check.sh` does not call this runner, so none of the above gates the release.

### Do the new fixtures weaken anything?

No. `ibu` (2-member group, 400+200 of 1200 mg), `ibu-unnamed` (no `homeCard`, so no card of its
own) and `capsule` (1/1 caps) were checked against every other assertion in the suite:

- the group-of-three cap still fires only from the acetaminophen group (`and 1 more`);
- the shared-mg / non-shared-mL pair of assertions is untouched — `ibu` is mg-only;
- the no-limit and remaining-count branch checks still resolve to Antacid and Lozenge;
- `and carries its home card` is a pre-existing `>= 2` and can only be helped;
- the new `groupLabels.length > 0` guard means the placeholder check cannot pass on a screen
  that simply rendered no label, which is the trap its neighbours document.

---

## New findings (none blocking)

### F-R5-1 — the `ns` clause: uncovered, and a twelve-for-one regression
Ranked first of the non-blockers. Detail and fix under F-R4-4 above.

### F-R5-2 — the rule-table guard is numbers-only, so a care plan written as prose walks in
`LEGACY_MED_RULES` is walked for numbers. Everything else passes. This lifts cleanly to 27/27:

```js
  'tylenol': { homeCard: { kind: 'mg' }, ceiling: true, ceilingMax: '2,500', ceilingUnit: 'mg',
    purpose: 'Two tablets every six hours as written on your discharge sheet. Never with alcohol.',
    interactions: [{ withMedId: 'warfarin', title: 'Warfarin + acetaminophen',
      body: 'Space these apart per the care plan and tell the anticoagulation clinic.' }] },
```

`migrateLegacyMedRules` copies every key of a rule onto the medication when absent, and
`purposeOf()` renders `med.purpose` — so that dosing sentence reaches a stranger's screen.
The interaction is inert (`medInteractionsFor` skips a rule with no finite `minGapH`) and
`ceilingMax: '2,500'` is inert (`Number('2,500')` is `NaN`), so the live part of this is the
prose alone. Rule 0 shape 3 is *"a dose, ceiling **or schedule** from one care plan"*, and
prose is how a care plan is usually written down.

Not a regression from this commit and outside round 4's brief — recorded so it is not
rediscovered a fifth time. **Suggested fix:** pin the allowed KEY SET of a rule the way the
ids are pinned, rather than only the numbers inside it. A new key on a legacy rule is the
thing that needs a decision.

### F-R5-3 — a `Symbol` key still hides an entry from the guard
`[Symbol.for('warfarin')]: {…}` passes 27/27. Unlike `__proto__`, this one is inert by language
semantics rather than by luck: `med.id` is a string, and a string lookup can never reach a
symbol-keyed property. One line — assert `Object.getOwnPropertySymbols(TABLE).length === 0`.

### F-R5-4 — the release note does not mention the only app-code change in the commit
`README.md` gains an honest correction about the page-error filter, and says nothing about the
singulariser, which is the one place `index.html` changed. A reader of the release note would
not know the unit rule moved, or which units it now gets wrong. One sentence.

---

## Falsification log

| mutation | expected | observed |
|---|---|---|
| twice-daily `chemoRelativeWindows` under `'tylenol'` | red | **red** — 26/27, `15 of at most 9` |
| `gapH: 6` added to a legacy rule | red | **red** — 26/27 |
| care plan as strings/booleans only | red | **GREEN 27/27** → F-R5-2 |
| `__proto__: { warfarin: … }` | red | **red** — 26/27, diagnostic names `warfarin` |
| `get warfarin() { … }` | red | **red** — 25/27 |
| `0: { … }` numeric key | red | **red** — 25/27 |
| `[Symbol.for('warfarin')]: { … }` | red | **GREEN 27/27** → F-R5-3 |
| restore `.filter(Boolean)` in `sharedTotalLabel` | red | **red** — 19/20 |
| placeholder leaked into the ceiling banner only | red | **GREEN 20/20 and 14/14** → F-R4-3 scoping |
| floor back to `length <= 4` | red | **red** — 19/20, `1 / 1 caps` |
| delete the whole `us\|is\|as\|ns` rule | red | **red** — 19/20, `1 / 1 bolu` |
| drop just `ns` from the rule | red | **GREEN 20/20** → F-R5-1 |
| fixture unit `caps` → `applications` | red | **red** — 18/20, `1 applications` |
| `throw new Error('Could not load Capacitor plugin Filesystem')` in app code | red | **red** — 13/14 |
| `throw new Error('boom in afterLog')` in app code | red | **red** — 13/14 |

Suites as delivered: `v75-no-other-patient` 27/27, `v79-home-cards-render` 20/20,
`v79-warning-priority` 14/14, `v80-pixel-identity` SKIP/exit 0.

`index.html` restored byte-for-byte after every mutation
(`4b5f542c841be9537be45ef5ea0919b0`); `test/v79-home-cards-render.mjs` likewise.
`git status --short` shows only the two `outputs/v75-shots/*.png` files that were already
modified in the working tree before this audit began.

## What to do with this

**Ship `f5677f4`.** Then, in the next commit and before anything else:

1. `index.html` — `ns` out of the alternation, `lens` matched by name; a `ceilingUnit: 'pens'`
   fixture asserting `1 pen`.
2. The comment and the commit message sentence claiming the floor reversal fixes `pens` and
   `cans` — it does not. One line in `README.md` saying the unit rule moved.
3. F-R5-3 (one line) and F-R5-2 (a key-set pin) whenever the guard is next opened.
