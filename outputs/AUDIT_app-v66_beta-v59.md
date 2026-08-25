# Zero Day Auditor — app-v66 (`aeec6ec`) and beta-v59 (`501a19b`)

Branch `claude/caretracker-chemowell-updates-k80ydk`. Neither release is on `main`; neither is live.
Audited 2026-08-25. Everything below was run, not reasoned about.

---

## THE HEADLINE

**The new PARA-0 gate can be beaten. I built a version of the app where the "litres" search
shortcut has been deleted AND the British spelling is showing on a Help page — the two exact
things this gate exists to catch — and the gate said 16 out of 16, all green.**

That is a check that passes on a broken build, which this project's own rules call worse than no
check at all.

Second headline, smaller but real: **the release-safety script printed a green tick while telling
you, in the two lines above the tick, that it had lost its reference point and was guessing.** The
guess happened to be right this time. The record it depends on is broken and will still be broken
on the next release.

Neither of these makes the app unsafe for a patient today. Both are gates that have quietly stopped
guarding.

---

## BLOCKER-1 — PARA-0 passes on a build with the defect it was written to catch

**File:** `chemowell-app-beta/test/v59-para.mjs:129-135`

The gate finds keyword lists with the pattern `/keywords:\s*\[[^\]]*\]/g` — "the word `keywords:`,
then an open bracket, then everything up to the first close bracket." Nothing checks that this is
actually a keyword list. Any occurrence of the text `keywords: [` in ordinary Help copy opens a
region the gate then treats as a keyword list, and every word up to the next `]` — visible copy
included — is counted as "hidden in a keyword list, therefore fine."

### Reproduction (verified, real suite, not a simulation)

```bash
cd /home/user/chemowell-app-beta
node -e '
const fs=require("fs"); let m=fs.readFileSync("index.html","utf8");
m = m.replace(`"liters", "litres",`, `"liters",`);                       // delete the search alias
m = m.replace(`a: "It has its own card and its own report, kept separate from weight on purpose."`,
              `a: "Search keywords: [ are matched. Litres drained is shown on the card."`);
fs.writeFileSync("/tmp/defeat.html", m);'
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
  node test/v59-para.mjs --file /tmp/defeat.html
```

Actual output:

```
  PASS  PARA-0 "litre" appears only as a search alias, never in visible copy
        |  1 occurrence(s) of "litre", 1 of them inside keyword arrays
16/16 checks passed
```

The region the gate believed was a keyword list:

```
keywords: [ are matched. Litres drained is shown on the card.", steps: ["Menu → **Settings** → ...
```

The build under test has no `litres` search alias and shows `Litres` to the user. Both directions
the release notes claim are covered, defeated at once.

### Honest assessment of how likely this is

The trigger is the literal text `keywords: [` appearing in Help copy. That is unlikely to happen by
accident. **I am calling it a BLOCKER anyway, not because the trap is likely, but because the gate's
whole justification is that it is falsifiable in both directions, and it is not.** The commit
message and the README row both state as fact that it is. That claim needs to come out or the gate
needs to parse rather than pattern-match. A cheap fix exists (anchor on `, keywords: [` preceded by
a `"` or `'`, or slice the HELP_TOPICS array first and only scan inside it) — but per your
instruction I have not written it.

### The same gate also fails on a legitimate change

`litreTotal === litreInKw && litreInKw === 1` hardcodes the count **1**. Adding the same alias to a
second topic — an entirely reasonable Help improvement — turns the gate red for no defect:

```
M3 (add "litres" to the weight topic's keywords) -> {"pass":false,"total":2,"inKw":2}
```

This is the pinned-literal anti-pattern the release exists to remove, in numeric form. The property
worth asserting is `litreTotal === litreInKw && litreInKw >= 1`.

### What DOES work (falsified, for the record)

| Mutation | Expected | Actual |
|---|---|---|
| M1 `placeholder: 'Liters drained'` → `'Litres drained'` | red | **red** — `2 occurrence(s), 1 inside keyword arrays` |
| M2 delete the `litres` alias | red | **red** — `0 occurrence(s), 0 inside` |
| M3 add the alias to a second topic (legitimate) | green | **red — false alarm** |
| M4 hide visible `Litres` behind a fake `keywords: [` | red | **GREEN — defeated** |

---

## MAJOR-1 — a retracted, false claim is still written into two test files as fact

**Files:** `chemowell-app-beta/test/v59-para.mjs:120-126` and `test/v57-search.mjs:393-397`

The commit message and README row correct an earlier mistake honestly: searching `litres` on
app-v65 **was never broken**. But the comment blocks left inside the two test files still assert the
retracted version:

`v59-para.mjs:122-124`
> "a search for "litres" then matched nothing at all: helpStem() turns it into "litr", the index only
> holds "liter", and helpFuzzy()'s 1-edit budget for a 6-letter word cannot bridge the 2-edit gap.
> The term scored 0 AND counted against the denominator, so it actively pushed the topic down."

`v57-search.mjs` is worse — it contradicts **itself** eight lines apart. Lines 393-397 say the topic
"scored ZERO"; lines 401-403 say "app-v65 was never broken … The topic was found either way."

**I settled which is true by running it**, against a copy of the current build with the alias removed:

```
FAIL  app-v66 "litres" is an EXACT keyword hit  |  [{"key":"liters","quality":0.65}]
FAIL  ...resolves to the paracentesis topic, alone  |  litres -> proc-para, faq:weight-reason
```

`proc-para` is still returned, and still **first**. The commit message is right; the surviving
comments are wrong. Nobody reads a commit message from eight releases ago — they read the file. This
is the same failure mode as the stale V57-1 gate this release was written to fix: a wrong thing left
in place where the next person will believe it.

---

## MAJOR-2 — `release_check.sh` printed ✅ from a broken baseline, and this was reported as "exit 0"

**Files:** `chemowell-app-beta/PUBLISHED.json`, `release_check.sh`

Run on the release commit:

```
⚠️  WARNING: PUBLISHED.json names commit 2b40965, which does not exist in this repository
⚠️  WARNING: no usable PUBLISHED.json record, falling back to origin/main.
✅ Release check passed.
EXIT=0
```

`PUBLISHED.json` records commit `2b40965d6b4d…`, which is not in this repository. The guard therefore
fell back to `origin/main` — **the exact fallback `TEAM.md` and `PUBLISHED.json`'s own comment block
describe as the app-v40 stranding failure printing a checkmark.**

I checked whether the fallback happened to be right: `origin/main` is at `chemowell-app-v65-1` /
`app-v65`, matching what `PUBLISHED.json` claims. So **this release's verdict is correct by luck.**
The mechanism is not. Until `mark_published.sh` is re-run, every future release gets a green tick
from a baseline the script itself says it cannot trust.

The commit message reports "`release_check` exit 0" with no mention of the two warnings. On this
project a warning is something to disclose, not something an exit code absolves.

---

## MAJOR-3 — a literal `|| true` in a file this release touched

**File:** `chemowell-app-beta/outputs/webmain-v43/run.mjs:119`

```js
t('derived missed doses are labelled derived, never logged',
  data.filter(r => col(r, 'Source') === 'derived').every(r => /not logged/.test(col(r, 'Detail')) || true));
```

`|| true` makes the predicate constant. The assertion cannot fail under any input.

`run.mjs` **is one of the files this commit modified** (playwright-path fix, 14 insertions). The file
was opened, edited and committed with a `|| true` in it — the single anti-pattern this project has
shipped before and now greps for. Mitigating: this is an archived report harness under `outputs/`
for care-tracker v43, not a live gate for this repo, and `chemowell-app-beta` has no `pm.py` to
catch it (that lives in `care-tracker`). It is still a check that cannot fail, sitting in the repo.

The three `|| true` in `release_check.sh:46,48,243` are the legitimate shell idiom for "grep found
nothing" inside command substitutions and are **not** findings.

---

## MAJOR-4 — the beta and production share one origin, and each wipes the other's offline cache

**Files:** `chemowell-beta/sw.js:10-12` and `care-tracker/sw.js` (identical)

You asked whether swapping the cache-first worker for the network-first one breaks the beta's
isolation. The worker itself is clean — I verified the parity claim byte-for-byte:

```
diff <(sed 's/^const CACHE = .*/X/' care-tracker/sw.js) <(sed 's/^const CACHE = .*/X/' chemowell-beta/sw.js)
→ IDENTICAL apart from the CACHE line
```

No production paths, no absolute URLs, all shell references relative to the worker's own scope, and
all four `SHELL` files (`index.html`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`) exist
in this repo — so `addAll()` will not reject and strand the install. The claim holds exactly as
written.

**The problem is what happens next to it.** Both apps are served from `arnjnnngs.github.io`.
Cache Storage is scoped to the **origin**, not the path. The activate handler in both workers is:

```js
caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
```

Every cache on the origin that is not this worker's own is deleted. So `chemowell-beta` activating
deletes `caretracker-v59`, and `care-tracker` activating deletes `chemowell-beta-v59` — on any
browser that has opened both.

**This is pre-existing, not introduced here** (the activate block is unchanged context in the diff),
which is why it is MAJOR and not a BLOCKER. But it interacts directly with the change you flagged:
network-first makes offline behaviour depend entirely on that cache being present, and the cache is
exactly what a sibling app on the same origin deletes. Failure path: tester caches the beta → opens
care-tracker → goes offline → opens the beta → `fetch` fails → all three fallbacks
(`caches.match(request)`, `'index.html'`, `'./'`) miss → hard failure, not a stale build.

Filter by `k.startsWith('chemowell-beta-')` and the interaction disappears.

---

## MINOR-1 — the V57-1 unpinning is looser than needed, but not dangerously loose

**File:** `chemowell-app-beta/test/v57-search.mjs:345-347`

You asked whether `/holds no medical information/ && /contact the care team/` would pass on a build
where the safety strip is genuinely broken. Measured rather than guessed:

- The `searchScreen` slice is **3,273 characters, lines 6962-7000** — 39 lines, genuinely the search
  results renderer, not a slice so wide the check is meaningless. Moving the strip out of that
  function turns the check red.
- Both phrases occur exactly **once** in the whole file, in the same string (line 6984), so today
  they cannot be satisfied by two unrelated fragments.
- Deleting either half turns it red. I confirmed the eight-release-red claim is true: the old
  verbatim regex does not match line 6984, which reads `…and can’t tell you whether something is
  serious.` with a curly apostrophe.

**What it genuinely cannot catch, and could not before either:** this is a source-text check, not a
render check. A strip wrapped in `if (false)`, or given `display:none`, keeps both phrases and stays
green. The unpinning did not create that hole — the verbatim version had it too — but the release
notes describe V57-1 as now asserting "the screen disclaims medical authority", and it does not
assert anything about the screen. It asserts about the source. `v57-browser-notice.mjs` is the suite
that could assert it for real, and it is currently 17-red.

## MINOR-2 — your characterisation of the 17 browser-notice failures is slightly off

I ran it (with `python3 -m http.server 8899` started first, as instructed). **17 failures confirmed,
exactly as logged** — you did not undercount, and the suite is genuinely red rather than broken.

But "all layout on the Help search results screen" is not quite right. Of the 17: **14** are the Help
search results strip and rows (`R2D-1`, `R2D-3`, `R2D-4`, `R2D-5`, `R2D-9`); **2** are `R2D-2`, about
a welcome toast on the first browser run on Home; **1** is `M3`, a toast-offset check at 150px vs
96px. Three of the seventeen are toast behaviour, not Help-screen layout. Small, but you asked me to
check whether you had characterised it honestly, and this is the delta.

## MINOR-3 — `beta-isolation-test.mjs` still pins one absolute path

**File:** `chemowell-beta/harness/beta-isolation-test.mjs:105`

The playwright *module* path was fixed to a candidate list. The **browser executable** was not:
`chromium.launch({executablePath:'/opt/pw-browsers/chromium', …})`. That path exists here so the
suite runs, but it is the same class of hardcoding the release was written to remove, in the same
file, three lines of code apart. `test/v59-para.mjs` and `test/v57-search.mjs` do not pin it. One
environment change and the isolation gate — the single most safety-critical suite in the beta — stops
starting, and a gate that cannot start is indistinguishable from a gate that passes.

---

## What I verified as GOOD (falsified where a falsification was possible)

**The beta cannot reach the patient's live data. This is the check that matters most and it is solid.**

- Runtime, not source: `beta-isolation-test.mjs` **9/9 PASS**. The stub records every collection and
  document path the running app actually touches.
- **Falsified.** Flipping `TEST_MODE` to `false` at runtime:
  ```
  node harness/beta-isolation-test.mjs --mutate 'const TEST_MODE = true;=>const TEST_MODE = false;'
  → FAIL ISO-1  LIVE PATHS TOUCHED: ["caretracker_entries","caretracker_prefs","WRITE:caretracker_prefs"]
  → FAIL ISO-4  the beta asked for 1 FCM token(s)
  → 3/9
  ```
  The gate goes red for the right reason on the right mutation.
- Source cross-check: every `caretracker_entries` / `caretracker_prefs` occurrence outside the two
  `TEST_MODE ?` ternaries (`index.html:58`, `:144`) is inside a comment. Lines 328, 332, 2380, 2800,
  4117, 4724, 5361 — I read all seven; all prose. The commit's "no unguarded live-collection
  reference survives" is true.

**The `h()` falsy-attribute trap is not present in either release.** Every conditional `disabled`
uses conditional spread — `...(isDisabled ? { disabled: true } : {})` — which omits the key entirely
rather than passing a falsy value into `h()`'s bare `setAttribute`. Checked all sites in
`chemowell-app-beta` (5704, 5863, 6352), `chemowell-beta` (3583), and `care-tracker` (3512). The
remaining hits are documentation of the trap, not instances of it.

**The composed 1s tick guard is intact in both.** `chemowell-beta/index.html:7042-7087` is
byte-identical to `care-tracker/index.html:6965-7010`. All terms present: `timeModal`, `apptSheet`,
`drawerOpen`, `missReasonSheet` (via `isEditing`), `!state.tour`.

**`sw.js` parity claim verified byte-for-byte** — see MAJOR-4.

**`test/v57-search.mjs` — ALL GREEN, and the three new checks are genuinely falsifiable.** Against a
copy with the alias removed, two of the three go red with real detail
(`[{"key":"liters","quality":0.65}]`). Your rewrite of the worthless first draft worked.

**File modes:** `git ls-files -s` reads `100755` for both `release_check.sh` and
`mark_published.sh`. Correct.

**No `document.body.textContent` assertion in either release's suites.** `ISO-6` uses
`document.body.innerText` for a before/after comparison — `innerText` excludes the inline `<script>`,
so the trap does not apply. (For the record: `care-tracker/harness/deactivate-test.mjs:682` does read
`document.body.textContent`, in a file that documents the trap at line 405. Out of scope for these
two releases; logging it because you asked for everything found.)

**No pinned version literals in the code paths of either release.** The `'app-v66'` strings in
`v57-search.mjs:412,415,418` are **test names**, not assertions — they print, they do not compare.
`v64-logger.mjs:39` documents that its old literal was removed. The `'v43.3'` / `'v43.4'` literals
throughout `care-tracker/harness/` are in a frozen v43 patch set, already documented as known in
`EXPORT-REPORT.md` and `TOUR-REPORT.md`; not touched by either release.

**Docs are accurate and unusually honest** — both the stale `BETA_STATUS.md` "Current" line and the
stale `BETA_HANDOFF.md` header are corrected *in place with the reason attached* rather than quietly
overwritten, and the sw.js step beyond the recipe is written into the recipe. No complaints.

---

## Scope I did not reach

Capped at ~30 minutes as briefed. Not covered:

- The full four-profile sweep (chemo / radiation / both / Other) with per-treatment medications and a
  multi-day logging span. That is `TEAM.md` stage 3's full-sweep depth. **Neither release changes
  dose, schedule, or storage logic** — app-v66 changes one keyword string and test scaffolding;
  beta-v59 is a regeneration of already-audited production code — so the scaled-down depth is the
  right call under `TEAM.md`, but it is a judgement I am naming rather than hiding.
- `chemowell-beta/harness/eod-test.mjs` (11/11 claimed) — not run.
- The other 17 browser suites in `chemowell-app-beta/test/` — not run. The playwright-path fix is
  identical in all 20 and three of them ran clean, so the resolver works; whether any of the other 17
  is red for its own reasons is unknown, and given V57-1 sat red for eight releases, **somebody should
  run all twenty before this reaches main.**
- Whether `betaify-patch.py` reproduces `index.html` md5 `a42c2f53…` from care-tracker v59. I checked
  the *output* against every safety post-condition instead of re-running the generator.

---

## Verdict

**Do not report either release as clean.** Nothing here endangers a patient and nothing needs to be
rolled back — the beta's containment is real and proven at runtime, and the app itself is sound. But
this release's entire stated purpose was fixing gates that had stopped guarding, and it ships:

- a new gate that passes on the defect it was written to catch (BLOCKER-1),
- a retracted false claim left standing in two test files (MAJOR-1),
- a release-safety script running on a baseline it says it cannot trust (MAJOR-2),
- a `|| true` in a file this commit edited (MAJOR-3).

BLOCKER-1 and MAJOR-2 should be fixed before this goes to `main`. MAJOR-1 is a two-comment edit and
should ride along. MAJOR-4 is pre-existing and belongs in `BACKLOG.md` with an owner, not in this
release.

Per the restart rule, BLOCKER-1 is a real functional miss in a safety gate, so it goes back to the
Lead Developer and through both mandatory gates again from scratch — not a targeted spot-fix.
