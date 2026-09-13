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

## 4b. `v74-shipped-audit-probe` is genuinely red, and the placeholder reaches a THIRD surface

Pre-existing — identical on the parent commit, so not app-v79 — and verified directly rather than
taken from the report. Three failures, 19/22:

1. **An empty medication name produces a MedlinePlus search for a drug that does not exist:**
   `medlineplus.gov/search/?query=Untitled%20medication`. That is the same `'Untitled medication'`
   placeholder as item 2 above, on a **third** surface nobody had looked at — and this one sends a
   caregiver to a federal drug-lookup site to read about nothing. The suite's own name for what it
   wants is right: *an empty name renders NO link.*

2. **An unencoded apostrophe survives into the href:**
   `query=Zo'fran'%20onclick%3D'alert(1)`. `encodeURIComponent` does not encode `'`. Nothing
   executes today — the "no markup injected" and "no javascript: URL" checks both pass — but a raw
   quote character inside an attribute is one templating change away from mattering, and it is on
   the one surface in this app that builds a URL out of text a user typed.

3. **A mutant the suite itself reports as toothless:** *"MUTANT: and at least one name escapes
   medlineplus.gov entirely | (none -- check is weaker than claimed)."* A check that says so about
   itself is the clearest possible instance of the thing this release was blocked for twice.

**The pattern across items 2, 4b and the app-v79 findings is one thing, not three:** a single
placeholder string, written by `normalizeMedication` for a missing name, leaks into every surface
that composes a label out of medication names — the Home card, the red ceiling banner, and now an
outbound URL. The fix is not three patches. It is one decision about what an unnamed medication
renders as, applied everywhere a name is *composed* rather than *displayed*.

## 5. THE CI GATE ON `main` HAS BEEN RED SINCE BEFORE THIS RELEASE, AND IT IS THE IMPORTANT ONE

`.github/workflows/verify-live.yml` runs `release_check.sh` against whatever is on `main`, from a
machine that can actually reach the live site. It exists because this sandbox has no outbound
network, so "verified live" was otherwise resting on Aaron opening the app on his phone. **It has
failed on every recent push, including the one before this release**, so nobody could tell my
release's result from the standing red.

Two causes, both mechanical, neither anything to do with app-v79:

1. **No browser on the runner.** `release_check.sh` runs `test/v76-empty-window-render.mjs`, which
   is a Playwright suite. The workflow installs Node and nothing else, so the suite fails at import
   and the gate refuses the commit. It passes locally because this sandbox has Chromium
   pre-installed. **Fix:** add a chromium install step to the workflow.
2. **`actions/checkout@v4` is shallow**, so `PUBLISHED.json`'s recorded SHA does not exist in the
   runner's clone and the gate falls back to `origin/main` with a warning. **Fix:** `fetch-depth: 0`.

**This is exactly the condition item 6 below describes, on the gate that matters most**: a check
that has been red long enough that its redness carries no information. The app-v40 failure it was
built to catch — a release pushed with `index.html` changed and the service-worker cache not — would
be invisible today.

**It is its own release, not a hotfix.** `.github/workflows/` is a Rule 5 path, so it gets the
Auditor and PM like any other code change. Doing it that way is the point: the gate that enforces
the chain should not itself be changed outside the chain.

## 6. `run-all-tests.sh` is red for two pre-existing reasons

`audit-v55` (three Help-screen assertions) and `audit-v55b` (cannot start — it reads `/tmp/topics.js`,
which no longer exists). Neither gates the release, and both have been red long enough that the
script's own warning has stopped meaning anything. That is the condition its header describes: *"A
gate that cannot start is indistinguishable from one that passes."*
