AUDITED-COMMIT: 400bd373ab603ea42afeaeafd1f64c570fd8a558
VERDICT: SHIP

# Zero Day Auditor — app-v84, pass 9 (delta since 714602b)

Branch `claude/caretracker-team-review-i83ik2`, working tree clean at audit start. Five
commits: `31430fa`, `4b54901`, `44171e5`, `a3e574e`, `400bd37`. `index.html` +9/-1.

## HEADLINE

**All four items from pass 8 are genuinely cleared — I measured each rather than reading
it — and the one-character prefix fix landed exactly as specified, on the side that deletes
nothing. The app code is clean and all twelve suites reproduce independently. SHIP.**

**The new `test/harness-payload-matches-app.mjs` works, and I falsified it: reverting the
prefix in `index.html` turns it RED and names the line. What it still cannot see is
this —**

1. **A payload assigned without the `r` prefix is invisible to it**, and that form is
   already in the file. `BASE_HOOKS = """…"""` (line 439) is written that way. I added a
   fifth payload in the same style carrying stale pre-prefix-fix app text; the check
   reported **`4 checks: 4 passed, 0 failed`, exit 0**. `EXPECTED` cannot catch it, because
   all four named payloads are still present. **This is the same shape as the `= r"""`
   blindness fixed on this checker's first run, one form further out.**
2. **Eight of the twelve `cut()` insertions carry app text the check cannot see at all** —
   inline string literals, not payloads. AST-extracted, not read. All eight currently match
   HEAD exactly once, so there is **no live drift**; but I moved three of them in the app
   and the check stayed at 4/4, exit 0, every time.

Neither is blocking: no fifth payload exists, the four live ones are covered, and there is
no drift today. Both are named with fixes below, and they should land before the script
grows another payload.

## THE FOUR ITEMS — each verified by measurement

### 1. `$STALE` — VERIFIED, and the arithmetic now closes

Rebuilt my tally stub from the new `falsify.sh` (counting logic byte-identical, suite and
`git`/`tar` stubbed) and drove it through all four outcomes:

| driven | summary line | exit |
|---|---|---|
| caught | `1 caught, 0 survived, 0 could not be measured, 0 anchor(s) stale` | 0 |
| survived | `0 caught, 1 survived, 0 could not be measured, 0 stale` | 1 |
| could not measure | `0 caught, 0 survived, 1 could not be measured, 0 stale` | 1 |
| anchor did not apply | `0 caught, 0 survived, 0 could not be measured, 1 anchor(s) stale` | 1 |
| **two mutants: one caught + one stale** | **`1 caught, 0 survived, 0 could not be measured, 1 stale`** | 1 |

`DEAD + SURVIVED + UNMEASURED + STALE` equals the mutants attempted in every case,
including the mixed one. **And I saw it in a real run, not only the stub** — see item 5.

### 2. PM table — VERIFIED

`hooks: all eight` → `all five probed fields`, both rows, with a third dated correction
appended quoting the probe output. One note: the body table was edited in place, where the
first two corrections left the body untouched on the stated principle that a silently
changed signed record is worse than a wrong one. It is not silent — the appendix says
"Corrected above" — so this is consistent enough, but the convention now has an exception
in it.

### 3. The busy-port account — VERIFIED, and the new version is testable and true

The corrected text makes a specific factual claim. I tested it:

| condition | `GET /` | `curl -f` | `curl` (no `-f`) |
|---|---|---|---|
| directory exists, no `index.html` | **200** + listing | exit 0 | exit 0 |
| directory **deleted underneath the server** | **404** | exit 22 | exit 0 |

Exactly as now written, including the part that explains where the original 404s came from
(a deleted cwd) rather than generalising one run into how squatters behave. The guard is
correct either way and the record no longer claims more than it knows.

### 4. `test/rebuild-boots.mjs` — VERIFIED

The last-line claim is gone and replaced with what the hooks actually prove. `app-v84` is
unpinned to `/^app-v\d+$/`, and `older`/`firstEver` — collected and ignored before — are
now asserted.

**One consequence worth writing down, and it is mine to own:** neither form catches
`APP_VERSION` drift, because the probe reads the *rebuilt file's own* value. The patch
script inserts `const APP_VERSION = 'app-v84';` as an inline literal (finding B below), so
at app-v85 the rebuild silently produces v84 and boots. The old pinned form would not have
caught it either — it compared against the same rebuilt file. So unpinning was right and is
neutral here; the gap is real and belongs to finding B.

### 5. THE PREFIX — landed exactly as specified, and re-proved

Snapshot prefix `'chemowell-app'` → `'chemowell-app-'`, snapshot side only. Re-ran my rigs
against the new HEAD, extracting both predicates from the file rather than retyping them:

* **Erase path untouched: `erase-differs=0` over 122 key-set cases.** Non-destructive, as
  required — no extra key is deleted from anybody's phone.
* **Only hyphen-less keys change classification**, and only `true → false`:
  `chemowell-app` and `chemowell-appfoo`. **Zero real app keys changed classification.**
* **Round-trip (storage → factory reset → snapshot): all 22 latent failing cases closed**,
  in all three survivor-list configurations, including a hypothetical non-hyphen survivor.
* Rig falsified: a planted always-true snapshot differs in 29 cases.

The comment explaining it is accurate on every point I could test, including "every storage
key this app writes carries the hyphen", which I had verified exhaustively in pass 8.

## WHAT THE NEW PAYLOAD CHECK CANNOT SEE

### A. A payload written `"""` instead of `r"""` — falsified, and the form is in the file

The regex is `/^([A-Z_]+) = [^\n]*?r"""([\s\S]*?)"""/gm`. It requires the `r`.
`BASE_HOOKS = """if (typeof window !== 'undefined') {` does not have it.

Excluding `BASE_HOOKS` is **correct** — it is anchor text matched against the *base*
commit, not HEAD, so checking it against `index.html` would be wrong. But it is excluded by
accident of spelling rather than by decision, and nothing says so.

Falsified, in a scratch tree:

    EXTRA_PAYLOAD = """      if (!k || k.indexOf('chemowell-app') !== 0) continue;   // STALE
    """
    ->  4 checks: 4 passed, 0 failed        exit 0

A fifth payload carrying the exact text the prefix fix removed, and the board is clean.

**Fix:** widen to `r?"""`, and add a named exclusion list — `BASE_HOOKS`, with the reason
(base-commit text) written next to it. Rule 5.5's own words: *an exemption nobody wrote
down is indistinguishable from an oversight.*

### B. Eight of twelve `cut()` insertions — no live drift, no coverage either

Extracted every `cut()` call with Python's `ast` rather than by eye. Twelve calls; the four
named payloads reach four of them. The other eight carry app text as inline literals:

| line | what it inserts | in HEAD? |
|---|---|---|
| 171 | the erase-path line reading `WIPE_SURVIVORS` | 1x |
| 379 | `const APP_VERSION = 'app-v84';` | 1x |
| 383 | `state.whatsNewOpen` | 1x |
| 387 | the whole `VALID_VIEWS` array | 1x |
| 392 | the router line | 1x |
| 398 | the back-button `whatsNewOpen` layer (3 lines) | 1x |
| 406 | the drawer row | 1x |
| 412 | the modal mount | 1x |

**All eight match HEAD exactly once — there is no drift today.** But the mechanism does not
cover them, and I falsified that three ways: changing the app's drawer helper text, the
modal mount's function name, and the `VALID_VIEWS` array each left the check at
`4 passed, 0 failed`, exit 0.

The *anchors* are self-checking — `cut` dies if one stops matching — so the half that reads
the app is guarded. The half that is *written into* the app is not.

**Fix (cheap):** the wiring is the part most likely to be disturbed by an unrelated
refactor. Either lift these into named payloads, or assert the `new` argument of every
`cut()` call appears in `index.html` — the AST walk that found them is nine lines.

### C. The gate judges HEAD with one half and the working tree with the other

`verify-rebuild.sh` refuses a dirty `$SCRIPT` on the stated principle that *"a result that
describes neither the tree nor the commit is worse than no result"*, and builds the boot
check from `git archive HEAD` + `git show BASE:index.html`. But line 56 runs
`node test/harness-payload-matches-app.mjs` from the repo root, and that file does
`readFileSync('index.html')` and `readFileSync('harness-v84-whatsnew.py')` — **the working
tree**. With a dirty `index.html` the drift half reports on the tree while the boot half
reports on the commit. `falsify.sh` refuses a dirty `index.html`; `verify-rebuild.sh` does
not. Latent — the tree was clean throughout — and the same one-line guard fixes it.

### D. The wrapper claims more than the check delivers

The test's own header is correctly scoped: *"Every `r"""` block the script embeds must
appear in index.html EXACTLY ONCE."* True. But `verify-rebuild.sh` announces
*"checking the patch script's payload still matches the app"* and fails with
*"❌ $SCRIPT no longer copies the app"*, which reads as all of it. It checks four of twelve
insertion sites. One sentence, and it is this release's standing defect in miniature.

### E. "exactly the set a reset can clear" is one word off

The new comment ends: *"The snapshot should ask about exactly the set a reset can clear,
and now does."* Measured:

| key | a reset clears it | the snapshot counts it |
|---|---|---|
| `chemowell-app-seen-version` | **true** | **false** |
| `chemowell-app-license-v1` | false | false |
| `chemowell-app-profiles-v1` | true | true |
| `chemowell-app-log-v1` | true | true |

The two sets differ by the marker, which a reset does clear and the snapshot deliberately
ignores — correctly, and the bullet directly above says why. The word is "exactly".
Suggested: *"exactly the set a reset can clear, less the marker itself."*

## THE SWEEP ARTIFACT — one commit stale, and I closed that by measuring

`outputs/SWEEP-app-v84.md` is honest about its subject: the title and a `Commit:` field
both say `714602b`, and it carries the full log I watched produced. Baseline
`96 checks: 96 passed`, `19 mutant(s) caught, 0 survived, 0 could not be measured`,
17:27–18:19, alone on the box. Mutant 8 is labelled CAUGHT-but-ABORTED, which matches what
I saw.

**But `index.html` moved after it** (`4b54901`, the prefix fix), so the recorded sweep is
not against the shipping file. Rather than argue the change is harmless, I re-ran the three
mutants that touch the altered code, at HEAD:

    === BASELINE  96 checks: 96 passed, 0 failed
    === MUTANT 17 / 18 / 19   each 96 checks: 94 passed, 2 failed
    === 3 mutant(s) caught, 0 survived, 0 could not be measured, 0 anchor(s) stale

All three still caught. I also re-applied **all 19 anchors** to HEAD's `index.html` in a
scratch tree: 19 defined, 19 applied, 0 stale, 0 no-ops. **The sweep result survives the
prefix fix.** Worth one line in the artifact saying which later commits it does and does
not cover.

## THE TWELVE SUITES — reproduced independently

Run by me, sequentially, nothing else on the box, against the server on 8899 whose
`index.html` I md5-matched to `git show HEAD:index.html` first.

| suite | result |
|---|---|
| v84-whatsnew | 96/96 |
| v83-meds-and-reports | 80/80 |
| v81-dose-parser | 227/227 |
| v72-med-purpose | 65/65 |
| v80-up-next | 48/48 |
| v82-vitals-strip | 41/41 |
| v81-purpose-hint | 32/32 |
| v75-no-other-patient | 27/27 |
| v82-timeline | 24/24 |
| v76-properties-equivalence | 22/22 |
| v82-back-button | 15/15 |
| v76-empty-window-render | 13/13 |

**590 checks, 0 failed, matching the figures claimed.** Two of the twelve
(`v81-dose-parser`, `v82-back-button`) print `N/N passing` rather than a `checks:` line and
so produced no summary under my first filter — no red and no summary is the outcome
`falsify.sh` scores as *not a pass*, so I re-ran both and read their real tails rather than
trusting exit 0.

`./verify-rebuild.sh` end to end: payload check 4/4, rebuild `OK`, `#root` 4205, `BOOTS`,
exit 0.

## RULE 0

No patient name, gendered pronoun, care-plan dose/ceiling/schedule or medication-id branch
in any line this delta added to `index.html`. `test/v75-no-other-patient.mjs` **27/27**.

## WHY THIS IS SHIP AND PASS 8 WAS NOT

Pass 8's two blocking items were **false statements of fact**: a figure in a signed
sign-off's evidence column that nothing in the repo produced, and a counter that silently
dropped one of the four outcomes it scored. Both are now fixed and I re-measured both.

What is left is **latent coverage gaps in a new mechanism that works**, plus two wording
corrections. Nothing here is false about the code as it stands, nothing is reachable by a
user, and no payload or insertion is actually drifted today. Items A, B and C should land
before `harness-v84-whatsnew.py` grows another payload — after that they stop being latent.
D and E are one sentence each.

## WHERE THE GATE STANDS AFTER THIS REPORT — measured, not assumed

`./release_check.sh` with this report committed:

>     ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
>        These say DO NOT SHIP:
>          outputs/PM-app-v84.md — examined 3ec6b4c

**The audit stage clears.** This SHIP at `400bd37` supersedes all five earlier Auditor
refusals and pass 8's — none of them is named above any more. **The PM stage does not.**
The only sign-off on record refuses, at a commit twenty-one commits back, and a refusal is
cleared only by re-running that stage against a later commit. That is the single thing
standing between this release and the gate going green, and it is not a finding against the
code — I raised it in pass 8 as well.

Also printed, and worth an eye rather than an action: `PUBLISHED.json` still records
`app-v80` at `048c1ff`, so the gate notes 36 index.html commits since the last published
baseline and assumes none are live. If any of them already went out, `./mark_published.sh`
needs running first or the comparison is against the wrong build.
