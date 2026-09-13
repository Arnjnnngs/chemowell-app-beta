AUDITED-COMMIT: 6314bd756efed28a766c6a0ce37ef30383036dac
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v79, round 4

Scope: `git show 6314bd7` and nothing else. Rounds 1–3 were not re-audited;
`outputs/AUDIT-app-v79-round3.md` passed the release and its six findings are what this
commit claims to fix.

## HEADLINE, in plain words

**The app code in round 4 is sound. The guard it was written to fix is not, and I walked a
stranger's dosing schedule straight past it at 26/26 green — the fourth round running.**

Round 4's whole headline is F-R3-1: the leak guard has been defeated three times, so it was
rewritten to stop matching text and start parsing the real object. That part works. But it
caps the schedule fields at **18** when the file currently holds **9**, so there is exactly
as much room left as is already in use. I added a complete twice-daily acetaminophen regimen
to `LEGACY_MED_RULES` — a stranger's care plan, Rule 0 leak shape 3, live in the app because
the migration applies it — and the suite reported *"9 of at most 18"* becoming *"15 of at
most 18"* and passed everything. The commit message says the schedule fields *"are capped as
well as allowed, because 'allowed and uncapped' is how a complete regimen got in."* The cap
admits a complete regimen.

Alongside that, **two of round 4's own fixes are covered by nothing** — I removed each one
and every suite stayed green. That is the exact sin this release was blocked for in rounds 2
and 3, in the commit whose message says *"an uncovered fix rots"*.

**Nothing here harms a caregiver or loses a record**, and I want to be equally plain about
that. `main` is serving a Home screen that throws on every render for any migrated device,
and round 4 does not make that worse — it makes it better. So this is a narrow block, and
the unblock path is five small edits in test files plus one line in `index.html`. **None of
them requires re-reviewing the application logic I just cleared**; the re-audit is a delta
pass on those edits.

## What I cleared

- The `warnBatch` red guard (suspect 4) is **correct and properly covered**. Reverting it to
  round 2's downgrade-only form goes red (`13/14`); deleting it entirely goes red (`8/14`).
  Amber-then-red still shows the red, because an amber never sets `warnBatch.red`. A single
  log passes no batch, so nothing is suppressed. Section 4 of the suite is honestly built —
  it proves the second medication earns a red of its own in a *fresh* batch rather than
  reading `state.warn` back after the guard returned, which is what makes the assertion able
  to fail.
- `sharedTotalLabel` is safe on every hostile input I tried: `med` null/undefined, an empty
  group, a group of one, and `ceilingGroupMedIds` returning the medication itself. Both
  surfaces now read from it, which was the finding.
- Suites as delivered: **eight of nine pass** (`v75` 26/26, `v76-empty-window` 13/13,
  `v76-properties` 22/22, `v77` 36/36, `v78` 20/20, `v79-home-cards` 18/18,
  `v79-warning-priority` 14/14). The ninth is F-6 below.
- `index.html` is byte-identical to its pre-audit state; `git status --short` is empty.

---

## F-R4-1 — BLOCKING — the leak guard admits a whole new dosing schedule

**Severity: high.** Rule 0 shape 3, in the guard that exists for Rule 0.

**Reproduce.** In `index.html`, change the tylenol line of `LEGACY_MED_RULES` to:

```js
  'tylenol': { homeCard: { kind: 'mg' }, chemoRelativeWindows: [
    { dayOffset: 0, start: 8, end: 10, name: 'Morning' },
    { dayOffset: 0, start: 20, end: 22, name: 'Night' }] },
```

`node test/v75-no-other-patient.mjs` → **exit 0, 26/26 checks passed.**

That is six new numbers describing when a stranger should take acetaminophen, twice a day,
and it is live: `migrateLegacyMedRules` looks the id up with `hasOwnProperty`, finds a value
that is not `true`, and writes the property onto the medication.

**Why it gets through.** `t('and the schedule numbers have not multiplied', sched.length <= 18)`
prints *"9 of at most 18"*. A ratchet set at double the current value is not a ratchet. Every
other pin in this suite is written tight — the thirteen ids are listed by name, the spacing
intervals are capped at 2 against a live value of 2 — and this one alone was given 100%
headroom.

**Fix.** Pin it to the actual count, the way the gaps check already is:
`sched.length <= 9`, with the same "lowering it is how a phase-3 deletion is recorded"
discipline section 4 uses. Nine is what is in the file. Then re-run my repro and watch it go
red.

## F-R4-2 — BLOCKING (cheap) — `__proto__` hides an entire stranger entry from the guard

**Severity: medium.** The guard is defeated; the app happens not to be.

**Reproduce.** Insert as the first line inside `LEGACY_MED_RULES`:

```js
  __proto__: { 'warfarin': { interactions: [{ withMedId: 'aspirin', minGapH: 6,
    title: 'Warfarin + aspirin', body: 'Space these six hours apart per the care plan.' }] } },
```

`node test/v75-no-other-patient.mjs` → **exit 0, 26/26 checks passed.**

This is round 2's leak verbatim — a drug pair nobody asked for, its own interval, its own
caregiver-facing copy. `Object.keys` does not see a prototype, so `entries` is unchanged and
`walk` never reaches it, while `LEGACY_MED_RULES['warfarin']` resolves normally.

It is **not** live today, and only by luck: `migrateLegacyMedRules` uses
`Object.prototype.hasOwnProperty.call(...)`, which is the thing that stops it. The guard's job
is to be what stops it. One line fixes this — lift with
`new Function('return Object.assign({ __proto__: null }, ' + literal + ')')`, or assert
`Object.getPrototypeOf(TABLE) === Object.prototype` and the same for every nested object in
the walk.

## F-R4-3 — BLOCKING (cheap) — the placeholder fix, which is the headline of F-R3-3, is covered by nothing

**Severity: medium.** Fourth consecutive round in which an `afterLog`-path fix shipped where
no check could see it.

**Reproduce.** In `sharedTotalLabel`, replace
`.filter(n => n && n !== UNNAMED_MED)` with `.filter(Boolean)` — i.e. put back the exact
behaviour round 3 blocked, which lets `'Untitled medication'` into a red safety warning.

`node test/v79-home-cards-render.mjs` → **18/18 passed.**
`node test/v79-warning-priority.mjs` → **14/14 passed.**

No fixture in either suite has a medication without a name, so the one thing this fix exists
to prevent is never exercised. **Fix:** add a fourth `ceilingGroup: 'apap'` member with
`name: ''` (so `normalizeMedication` writes the placeholder) and assert that
`Untitled` appears nowhere in the daily-total card or the ceiling banner. Falsify with the
mutation above.

**Residual, not blocking:** when *every* member of a group is unnamed, the helper still
returns `'Untitled medication'`. Round 3 asked me to verify it cannot. It can — but in that
case there is no real name in existence to print, so the behaviour is correct and the
round-3 concern is answered. Worth one sentence in the code comment, which currently reads as
though the placeholder is impossible.

## F-R4-4 — BLOCKING (one line) — the new `length <= 4` rule is both uncovered and a net regression

**Severity: medium.** Cosmetic in effect; a check that cannot fail in principle.

**Uncovered.** Delete `if (hcUnit.length <= 4) return hcUnit;` from `hcUnitFor`:
`node test/v79-home-cards-render.mjs` → **18/18 passed.** No fixture unit is four characters
or shorter, so the rule could be removed tomorrow in silence.

**Net regression.** I ran the old and new rules side by side over real `ceilingUnit` values.
The new rule fixes **one** word the `-us/-is/-as` rule does not already cover — `lens` — and
breaks **twelve**:

| typed | before round 4 | after round 4 |
|---|---|---|
| tabs, caps, pens, pads, cups, cans, bars, bags, rods | `1 tab`, `1 cap`, … | `1 tabs`, `1 caps`, … |
| gotas, pastillas, cápsulas | `1 gota`, `1 pastilla`, `1 cápsula` | unchanged (also caught by the `-as` rule) |

The old code's floor was `length > 2`, which handled all nine of those correctly. Raising it
to 4 to rescue `lens` costs nine common English units and every Spanish `-a` plural. `mg` and
`mL` are safe either way (neither ends in `s`), so nothing load-bearing depends on the new
floor.

**Fix.** Put the floor back at `> 2` and handle `lens` where it belongs — extend the
"singular nouns that happen to end in s" rule to `/(us|is|as|ns)$/i`, or list the word. Then
add a `ceilingUnit: 'caps'` fixture asserting `1 / 1 cap`, so whichever floor stands is
covered.

## F-R4-5 — BLOCKING (cheap) — the page-error filter still swallows the app-v47 defect class

**Severity: medium.** A check weakened against the one failure this repo has already paid
three releases for.

The comment says `/Capacitor/i` *"swallowed the plugin-failure class that cost this repo
app-v47 through app-v49"* and that the new filter fixes it. It does not. Measured directly
with Playwright:

```
throw new Error('Could not load Capacitor plugin Filesystem')
  -> first line: "Error: Could not load Capacitor plugin Filesystem"
  -> matched by !/^Error: Could not load Capacitor/i  ->  SWALLOWED
```

A broken plugin bundle is precisely an error that begins *"Could not load Capacitor …"*. The
excuse was narrowed in shape and not in effect.

**And its stated premise is false.** `String(e)` on a Playwright `pageerror` is **one line** —
`Error.prototype.toString()` returns `name: message` and does not include the stack. I
verified this. So `/cdn/i` never matched "the stack of every error raised anywhere in app
code"; it only ever matched errors whose *message* contained `cdn`, and `.split('\n')[0]` is a
no-op. The commit message and README repeat this reasoning as fact. This project hired the
Voice because four consecutive releases described a fix untruthfully; the same standard should
apply to a comment explaining a gate.

**Fix.** Delete both exemptions. I ran the app in this sandbox with a `pageerror` listener and
**no page error fires at all** — the two "exact sandbox conditions" do not occur here, so the
filter buys nothing and costs the one class that matters. If an exemption is genuinely needed
later, match the full message, not a prefix.

## F-R4-6 — NOT BLOCKING — `run-all-tests.sh` is now permanently red

**Severity: low, but it rots fast.** `test/v80-pixel-identity.mjs` requires
`--save <dir>` or `--check <dir>`; run with no arguments it prints `FAIL no directory given`
and exits 1. `run-all-tests.sh` only passes `--file` to suites that mention it, so it invokes
this one bare:

```
node test/v80-pixel-identity.mjs   ->  exit 1
./run-all-tests.sh                 ->  "NOT GREEN — do not report this work as done."
```

The script's own header explains why this matters better than I can: *"A gate nobody runs is
not a gate. A gate that cannot start is indistinguishable from one that passes."* A repo-wide
runner that is red for a reason everyone learns to explain away is how the next real red gets
ignored. This does not gate the release — `release_check.sh` does not call it — so it is
ranked below the five above.

**Fix (one line, either end):** have the suite skip cleanly with exit 0 and a "baseline mode
only, run with --check" line when given no directory, or teach `run-all-tests.sh` to pass
`--check outputs/pixel-baseline` the way it already special-cases `--file`. The tool itself is
well built and the reasoning behind it is right; it is simply not an app-v79 gate.

## F-R4-7 — NOT BLOCKING — the relaxed assertion held up

The pre-existing check was widened from
`/tylenol \+ tylenol liquid · today…/` to `/tylenol \+ tylenol liquid[^\n]* · today…/` to make
room for the third group member. That is a genuine weakening of a positive assertion — it now
accepts any text between the two names and `· today`. But the new
*"a group of three is summarised, not spelled out"* check pins what goes in that gap, and it
falsifies correctly (removing the cap goes red, `17/18`). The negative mL assertion was widened
in the same edit, which makes it **stricter**, not weaker. No action.

---

## Falsification log

Every check round 4 added or changed was broken and watched.

| mutation | expected | observed |
|---|---|---|
| remove `-us/-is/-as` rule | red | **red** — 17/18, `1 / 1 bolu` |
| remove `length <= 4` rule | red | **GREEN 18/18** → F-R4-4 |
| remove the two-name cap | red | **red** — 17/18, `TYLENOL + TYLENOL LIQUID + CHEWABLE` |
| restore `.filter(Boolean)` (placeholder) | red | **GREEN 18/18 and 14/14** → F-R4-3 |
| revert to round 2's downgrade-only guard | red | **red** — 13/14, second red overwrote the first |
| delete the batch guard entirely | red | **red** — 8/14 |
| add a twice-daily schedule to the rule table | red | **GREEN 26/26** → F-R4-1 |
| add a `__proto__` stranger entry | red | **GREEN 26/26** → F-R4-2 |

`index.html` restored byte-for-byte (`b4e5db415185c56a1a331eae62bd6cd1`), working tree clean.

## What unblocks this

Five edits, four of them in test files:

1. `test/v75-no-other-patient.mjs` — schedule cap `18` → `9`.
2. `test/v75-no-other-patient.mjs` — null the prototype on the lift, or assert it.
3. `test/v79-home-cards-render.mjs` — an unnamed group member, and an assertion that
   `Untitled` never reaches a card or a banner.
4. `index.html` — singulariser floor back to `> 2`, `lens` handled by name; plus a `caps`
   fixture to cover it.
5. `test/v79-warning-priority.mjs` — delete both page-error exemptions.

F-R4-6 can ride along or follow. Re-audit is a delta pass on these five; the application
behaviour in `6314bd7` is cleared and does not need looking at again.
