# Carried forward from app-v79 — first items of the next release

Every one of these was found by an audit of app-v79 and ranked as not blocking. They are written
down here so the next release starts with them rather than rediscovering them.

## 1. The unit singulariser is still wrong, and my round-5 commit message says otherwise

**`/(us|is|as|ns)$/i` rescues `lens` and breaks twelve real units:** applications, injections,
inhalations, infusions, spoons, teaspoons, tablespoons, pens, cans, tins, pins, grains.

**`pens` and `cans` are on that commit message's own list of nine words it claims the change puts
right.** That sentence is false. It is the third time in this release that a claim about a fix
outran the fix, and the second time I have written one into a commit message after quoting the rule
against it.

The `ns` clause fixes exactly one word. `lens` is a WORD, not a pattern, and belongs in a short
explicit list beside `bolus` — not in a suffix rule that catches every English noun ending in `-ns`.

**Fix:** drop `ns` from the suffix rule; add an explicit set (`lens`, `series`, `species`, `news`).
Then add a fixture with `ceilingUnit: 'applications'` — that word is already on
`test/v79-home-cards-render.mjs`'s own forbidden-plural list, and swapping one fixture's unit to it
turns the suite red immediately, which is the falsification.

## 2. The placeholder check is scoped to the Home card and not to the warning banner

`sharedTotalLabel` feeds both surfaces, but the assertion matches `· today` lines — which the red
ceiling banner does not carry, and no fixture puts an unnamed medication into a group that reaches
it. The auditor leaked the placeholder into the banner alone and both suites stayed green.

**Fix:** assert on the banner text too, with a fixture whose unnamed member is in the group that
trips the ceiling.

## 3. The rule-table guard walks numbers, so a care plan written as prose walks in

27/27 green with a dosing instruction expressed entirely in strings. `migrateLegacyMedRules` copies
every rule key onto the medication and `purposeOf()` renders `med.purpose`, so a sentence written
there reaches a stranger's screen.

**Fix:** pin the allowed KEY SET, not only the numbers — the same discipline the id list already
uses. This is the fourth shape of this leak and the pattern is consistent: each guard has pinned
what the last leak looked like.

## 4. A `Symbol` key hides an entry from the guard

One line: `Object.getOwnPropertySymbols`. Inert today by language semantics rather than by luck,
which is a better reason than the `__proto__` case had.

## 5. `run-all-tests.sh` is red for two pre-existing reasons

`audit-v55` (three Help-screen assertions) and `audit-v55b` (cannot start — it reads `/tmp/topics.js`,
which no longer exists). Neither gates the release, and both have been red long enough that the
script's own warning has stopped meaning anything. That is the condition its header describes: *"A
gate that cannot start is indistinguishable from one that passes."*
