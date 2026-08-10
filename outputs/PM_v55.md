# PM_v55.md — Project Manager gate, app-v55 (post-fix build)

## VERDICT: **NO-GO** — one user-visible copy defect, introduced by the V55-1 fix itself, must land before this is pushed. Everything else in the build clears.

**Date:** 2026-08-10 · **PM:** Project Manager (independent gate, TEAM.md stage 6)
**Under test:** working tree == `HEAD` == `f2a4177`, `git status` clean. `APP_VERSION = 'app-v55'`, `sw.js` `CACHE = 'chemowell-app-v55-2'`.
**Also gated:** `0b36e35` (`release_check.sh` + `PUBLISHED.json` + `mark_published.sh`).
**Method:** Playwright 1.56 / Chromium against `http://127.0.0.1:8899`, real UI only. 360px and 390px, full sweeps at both. Release-gate work done on **six scratch clones in `/tmp/pmscratch`** — never in the working repo. Scripts written for this gate: `test/pm-v55.mjs`, `test/pm-v55-routes.mjs`, `test/pm-v55-chips.mjs`, `test/pm-v55-shot.mjs`, `/tmp/pmscratch/cases.sh`.
**Committed nothing.**

---

## The blocker in one paragraph

The V55-1 fix replaced *"tap the name at the top"* with *"tap **Account**"* in seven places. Five of those are `HELP_TOPICS` entries, which render through `helpRich()` and correctly show a bold **Account**. **Two of them are `FAQ_ITEMS` entries, and `FAQ_ITEMS` answers do not go through `helpRich()`** — they are handed to the DOM as a raw string at `index.html:5982`. So the two profile FAQ answers now render the literal characters `**Account**` to the user. This is the same defect class as V55-2 (raw markdown leaking into user-facing copy), in the same release, introduced *by* the fix for a different finding — and it is the "fixed one of N call sites" pattern in a new shape: the markup convention of one data structure was applied to a second structure that has a different renderer. Neither the Lead Developer's own suite nor the Auditor's would catch it: the only markup assertion added (`test/v55-help.mjs`, "every backtick in HELP_TOPICS is balanced") is scoped to the `HELP_TOPICS` block, and nothing asserts anything about `FAQ_ITEMS` markup at all.

Under TEAM.md's restart rule this is the **pure wording/copy tier** — a targeted fix (strip the two `**` pairs, or route `item.a` through `helpRich()`), spot-verified against the running product, logged as an addendum. It does not need a fresh Auditor round. But it must land before the push, because the whole point of app-v55 is telling a stressed caregiver where to tap, and it is currently telling two of them to tap `**Account**`.

---

## Findings, most severe first

### PM-1 — **MEDIUM, BLOCKING** · two FAQ answers render literal `**Account**` to the user

* **Where:** `index.html:2065` (`switch-profile`), `index.html:2066` (`caregiver-multi`). Renderer: `index.html:5982` — `h('div', {…}, item.a)`, a raw string, no `helpRich()`.
* **Introduced by:** commit `f2a4177`, the V55-1 fix. The pre-fix text at these two lines carried no markup.
* **Repro (driven live, 360px and 390px):** Menu → Help → *Common questions* → "How do I switch or add a profile?" → the answer reads *"…open the menu (the three lines, top left) and tap \*\*Account\*\*, or go to Settings — Profiles."* Same on "I'm caring for more than one person — can I track them all?". Evidence: `outputs/pm-v55-01-faq-literal-asterisks-360.png`, and `test/pm-v55.mjs` case P3e, which fails at both widths naming exactly these two rows.
* **Why it matters:** the Auditor rated V55-2 (backticks) as worth holding the release for, on the argument that a non-technical caregiver has no idea what the character means and is most likely to read it as something they must type. `**` is the same argument. It is also in the two entries that answer *"how do I look after more than one person"* — the caregiver-facing ones.
* **Not a false positive from my scan:** I swept the rendered text of all 133 rows at both widths. These two are the only two hits in the entire Help centre, and `grep` over `FAQ_ITEMS` (lines 2061–2095) confirms they are the only two FAQ entries containing `**` at all.
* **Expected:** drop the asterisks (`and tap Account,`) — the smaller, safer change, matching how every other FAQ answer names a screen — or pass `item.a` through `helpRich()`. If the latter, re-check all 15 FAQ answers for stray `*` first.

### PM-2 — **MEDIUM** (release tooling) · `release_check.sh` prints ✅ **with a false success message** when it cannot parse `CACHE` out of the working tree

* **Where:** `release_check.sh:118` (`CACHE_NEW=$(grep -o "CACHE = '[^']*'" sw.js || echo "none")`), consumed at `:119` and `:142`.
* **Observed (scratch clone C11):** `index.html` changed; `sw.js` reformatted to `const CACHE = "chemowell-app-v55-2";` (double quotes — same value, no bump). `CACHE_NEW` becomes the sentinel `none`, which never equals `CACHE_OLD`, so the hard-block at `:119` is skipped; the reuse block at `:142` is explicitly guarded off when `CACHE_NEW = "none"`. Result: **exit 0**, printing *"index.html changed and sw.js's CACHE constant changed with it — installed copies of the app will pick this up automatically on next open."* That statement is false and the build strands every installed copy.
* **Observed (scratch clone C12):** `sw.js` deleted entirely → `grep: sw.js: No such file or directory` on stderr, then **exit 0** with the same false success line.
* **Why it matters:** this is V53-4 re-opened through a different door. V53-4 was *"the script claimed the CACHE constant changed when it hadn't"*; that was fixed for the cosmetic-sw.js-edit case and is still open for the unparseable-sw.js case. A gate that says the reassuring thing when it cannot see is worse than one that says nothing.
* **Expected:** treat `none` as fatal, not as "changed". Two lines: `if [ "$CACHE_NEW" = "none" ]; then echo "❌ cannot read CACHE out of sw.js"; FAIL=1; fi`, and the same for `CACHE_OLD` at the baseline.

### PM-3 — **MEDIUM** (residual, process-mitigated) · a **stale** `PUBLISHED.json` is trusted silently, and reproduces the exact failure the file was introduced to close

* **Where:** `release_check.sh:60–81`. The integrity check verifies the record is *self-consistent* (recorded cache == that commit's own `sw.js`) but never that it is *current*.
* **Observed (scratch clone C6):** record points at the previous release (`18c6504`, `app-v54`, `chemowell-app-v54-2`) while `app-v55`/`chemowell-app-v55-2` is what is live — i.e. **somebody pushed and forgot to run `./mark_published.sh`**, which is a documented-but-human step. A following build then changes `index.html` and leaves `CACHE` at `chemowell-app-v55-2`. Baseline is v54-2, so the first block sees "changed"; the reuse block scans only history reachable from the v54 commit, where `v55-2` does not appear, so it sees "never used". **Exit 0, green tick, zero warnings printed** — the app-v40 stranding failure again, now behind a self-consistent record rather than behind `origin/main`.
* **Also observed (C7 missing file, C8 malformed JSON, C9 record naming an unresolvable commit):** all three fall back to `origin/main` and **exit 0** on the same stranding build. These at least print a loud, accurate warning first, which C6 does not.
* **Judgement:** this is **not** a regression and **not** a blocker for app-v55. The named failure in `BACKLOG.md` — stale `origin/main`, `index.html` changed, `CACHE` left at the live value — **is genuinely blocked now** (case C1 below, blocked twice over with correct messages). `PUBLISHED.json` is currently accurate (`18c6504` / `app-v54` / `chemowell-app-v54-2`, which is what `origin/main` points at and what is live). What has changed is that the residual risk moved from "a remote ref this sandbox cannot refresh" to "a file someone has to remember to update" — a strictly better place for it, but not zero, and it deserves to be visible rather than silent.
* **Expected (cheap, non-blocking):** warn hard whenever `PUB_COMMIT != HEAD` and any commit in `PUB_COMMIT..HEAD` changed the `CACHE` constant more than once — that pattern means at least one release was published without the record being updated. `git rev-list "$PUB_COMMIT..HEAD" -- sw.js | wc -l` is enough signal to print the warning.

### PM-4 — **LOW** (accuracy of the version history V55-5 was raised to fix) · the new app-v54 README row states the wrong cache key

* **Where:** `README.md:15` — *"`APP_VERSION` → `app-v54`, `sw.js` CACHE → `chemowell-app-v54-1`."*
* **Observed:** app-v54 is commit `18c6504`, whose `sw.js` reads `const CACHE = 'chemowell-app-v54-2';`. `chemowell-app-v54-1` **does not exist anywhere in this repository's history** (walked every `sw.js` commit: v55-2, v55-1, v54-2, v53-2, v52-4, v51-1, v50-1, v49-1). `PUBLISHED.json` independently records `chemowell-app-v54-2`.
* **Why it matters:** V55-5 exists because the version history is how anyone reconstructs what is live. A retroactively-written row that names a cache key that was never shipped is the specific failure mode the brief flagged — a version-history entry that overstates or misstates what shipped. Everything else I spot-checked in both new rows is accurate (see the cross-check table).
* **Expected:** `chemowell-app-v54-1` → `chemowell-app-v54-2`.

### PM-5 — **LOW** (test depth, no user impact) · the V55-3 regression assertions cover 3 of the 9 topics they are written about

* **Where:** `test/v55-help.mjs` — the calm heading is asserted on `rem-none` and `med-daily-limit-locked`; the urgent heading on `vit-temp-high` only.
* **Why it matters only mildly:** the *behaviour* is correct — I drove all nine live at both widths and the split is exactly 5 calm / 4 urgent (see P3i–P3k). But the commit message for a release whose stated theme is *"this is the 'fixed one of N call sites' failure for the fifth time"* asserts the fix on 1 of the 4 urgent topics. The source-level assertion (`careHeading` is derived from `topic.careLead`, and no hardcoded `'Contact your care team'` string survives) is the one actually carrying the weight, and it is a good assertion.
* **Related, and the direct cause of PM-1:** the only markup assertion added is scoped to the `HELP_TOPICS` block. Adding `!/\*\*/.test(faqBlock)` would have caught PM-1 for free.

---

## Case table

### 1. V55-1 — the retired drawer-name interaction (`test/pm-v55.mjs`, `test/pm-v55-routes.mjs`)

| # | Case | Result | Observed |
|---|---|---|---|
| S-1 | `tap the name at the top` / `tap your name at the top` anywhere in `index.html` | PASS | 0 occurrences; the only surviving match for "name at the top" is the v54 code comment at `index.html:2692` |
| S-2 | The 5 flagged entries rewritten (`2065`, `2066`, `2225`, `2234`, `2242`) | PASS | all five now route via **Account** |
| S-3 | The 4 read-only mentions left alone (`med-not-on-home` 2160, `rep-entry-missing` 2207, `exp-nothing` 2221, `pro-switch`'s closing line 2225) | PASS | reworded to "the name is shown at the top of the menu" — still accurate against v54, still non-instructional |
| P1a | Drawer really has an **Account** row | PASS | `["Account/Profiles, plan & export","Calendar…","Notes…","Help…","Settings…"]` |
| P1b | Drawer name is not in the button list (v54 holds) | PASS | no `PM Patient` button |
| P1c | Drawer name node has no interactive ancestor inside `#app-drawer` | PASS | `inert` |
| R1 | Menu → Account reaches Account | PASS | — |
| R2 | Account contains **Start over**, as `set-erase-all` step 2 says | PASS | renders as `START OVER` (`TYPE.label` uppercases it) |
| R3 | The erase button `set-erase-all` step 3 names exists | PASS | "Erase all data…" |
| R4 | Account contains **Download CSV**, as the "export first" step says | PASS | — |
| R5 | Account lists both profiles | PASS | Route One + Route Two |
| R6 | Account offers **Switch**, as `pro-switch` step 3 says | PASS | 1 Switch button (`index.html:6417`) |
| R7 | After Switch, the drawer name changes — as `pro-switch`'s closing line claims | PASS | drawer header follows the active profile |
| R8 | Settings has a **Profiles** section, as `switch-profile` says | PASS | `index.html:6042` |
| R9 | Settings → Profiles offers **Switch** and **Delete**, as `priv-delete` step 5 says | PASS | `index.html:6057`, `6058` |
| **P3e** | **No literal markdown asterisks in any rendered Help/FAQ text** | **FAIL @360 and @390** | **`**Account**` on FAQ `switch-profile` and `caregiver-multi` — see PM-1** |

### 2. V55-2 — backticks and the `nowrap` chip (`test/pm-v55.mjs`, `test/pm-v55-chips.mjs`)

| # | Case | Result | Observed |
|---|---|---|---|
| P3d | No literal backtick survives into rendered text, **all 133 rows**, @360 | PASS | 0 |
| P3d′ | Same, @390 | PASS | 0 |
| P3f | `<code>` chips render on the 4 named topics | PASS | `med-dose-options` 5, `med-daily-limit-locked` 6, `med-gap-hours` 1, `med-many-strengths` 1 = 13 chips |
| P3g | No chip's right edge exceeds its column or the viewport, @360 | PASS | 0 violations |
| P3g′ | Same, @390 | PASS | 0 violations |
| C-1 | Chip headroom @360 — widest chip vs column | PASS | widest 149px (`2 sprays` line) in a 298px column; **min headroom 30px**; doc overflow 0px |
| C-2 | Chip headroom @390 | PASS | widest 149px in a 328px column; min headroom 60px; doc overflow 0px |
| C-3 | Longest literal in the content (`500 mg, 1000 mg`, 15 chars → 141px) | PASS | 61px headroom @360 |
| C-4 | Every backtick in the file is balanced (an odd one renders literally) | PASS | even count in the `HELP_TOPICS` block |
| P3h | Horizontal overflow anywhere in Help @360 / @390 | PASS | max 0px both |

`whiteSpace: 'nowrap'` cannot overflow with the shipped content: the widest chip uses half its column at the narrower of the two target widths. It is a real (if distant) constraint on future content — a literal longer than ~30 characters would push past — but nothing in the file is close.

### 3. V55-3 — the medical callout heading, all nine topics driven live

| Topic | `careLead` | Heading observed @360 | Heading observed @390 | Result |
|---|---|---|---|---|
| `rem-none` — "I'm not getting any reminders at all" | no | Not medical advice | Not medical advice | PASS |
| `med-add-first` — "How do I add a medication?" | no | Not medical advice | Not medical advice | PASS |
| `med-daily-limit-locked` — "The Daily limit box is greyed out…" | no | Not medical advice | Not medical advice | PASS |
| `log-anyway-override` — "How do I log something the app is blocking?" | no | Not medical advice | Not medical advice | PASS |
| `ip-meds-restricted` — "My medications say 'Restricted'…" | no | Not medical advice | Not medical advice | PASS |
| `miss-real-missed` — "A dose was genuinely missed…" | yes | Contact your care team | Contact your care team | PASS |
| `vit-temp-high` — "The temperature is high…" | yes | Contact your care team | Contact your care team | PASS |
| `vit-weight-change` — "The weight has changed a lot…" | yes | Contact your care team | Contact your care team | PASS |
| `sym-severe` — "The symptom is severe…" | yes | Contact your care team | Contact your care team | PASS |
| P3i | Exactly 9 callouts across all 133 rows — none added, none lost | PASS | 9 |

Icon also follows the tone (`heart` for `careLead`, `bulb` otherwise, `index.html:5907`), which the Auditor did not ask for and which does more for the urgent/calm separation than the 4px border colour it complained about.

### 4. V55-4 — the dead `'faq'` router arm

| # | Case | Result | Observed |
|---|---|---|---|
| S-4 | `state.view === 'faq'` anywhere | PASS | 0 |
| S-5 | `state.view !== 'faq'` in the 1s tick guard | PASS | 0; guard is now `state.view !== 'help' && !state.timeModal …` (`index.html:7825`) |
| S-6 | `VALID_VIEWS` still excludes `'faq'` (the reason the arm was dead) | PASS | `index.html:784` |
| S-7 | `faqOpenId` untouched — that is the live accordion state, not the dead view | PASS | still set/read; the Common-questions accordion works (all 15 expand, one at a time) |
| P4a | Legacy `sessionStorage['chemowell-app-ui-view'] = 'faq'` + reload → not a blank screen | PASS | full Home render |
| P4b | …lands on **Home** specifically | PASS | Home, not Help |
| P4c | The stale value is left in `sessionStorage` rather than rewritten | PASS (noted) | still reads `faq` after reload; harmless, since `restoreView()` filters on every read — worth knowing it is not self-healing |

### 5. V55-5 — README and REQUESTS, cross-checked against the diff

| # | Claim in the new README rows | Result | Observed |
|---|---|---|---|
| D-1 | app-v55 row exists | PASS | `README.md:14` |
| D-2 | app-v54 row exists | PASS | `README.md:15` |
| D-3 | v55: "17 categories → 133 rows" | PASS | 17 tiles, 133 rows opened |
| D-4 | v55: "117 walkthroughs + the 15 FAQ kept as Common questions" | PASS | 118 walkthrough rows (117 + pointer) + 15 FAQ |
| D-5 | v55: "`Not medical advice` for the five mechanics pages, `Contact your care team` kept for the four" | PASS | exact, all 9 driven |
| D-6 | v55: "the test asserts no backtick survives into rendered text and that no chip can exceed its column" | PASS | both assertions present in `test/v55-help.mjs` |
| D-7 | v55: "the regression test now asserts the absence of the phrasing anywhere in the file" | PASS | present, and it does what it says |
| D-8 | v55: `APP_VERSION` → `app-v55`, CACHE → `chemowell-app-v55-2` | PASS | matches `index.html` and `sw.js` |
| D-9 | v54: identity header "is now a plain `<div>`: not focusable, no pointer affordance, no navigation" | PASS | confirmed live (P1b/P1c) and in source `index.html:2699` |
| D-10 | v54: "avatar initial is `aria-hidden`", "plan pill gained an explicit label" | PASS | both present in source |
| **D-11** | **v54: "`sw.js` CACHE → `chemowell-app-v54-1`"** | **FAIL** | **`18c6504:sw.js` is `chemowell-app-v54-2`; `v54-1` exists nowhere in history — see PM-4** |
| D-12 | `REQUESTS.md` chatbot item ticked | PASS | `- [x] **SHIPPED IN app-v55 (2026-08-10) …**`, with the `sym-severe` clinician read explicitly *not* claimed |
| D-13 | `BACKLOG.md`: the two `release_check.sh` items closed, three new items logged | PASS | the 🔴 blocker and the dead-warning-branch item are removed and both are genuinely fixed; `sym-severe`, the stale "Pick a date" row, and `HELP_POINTERS` not being searchable are logged |

### 6. `release_check.sh` / `PUBLISHED.json` — six scratch clones in `/tmp/pmscratch`, never the working repo

Baseline for every case: `PUBLISHED.json` recording the live build, `origin/main` forced one release behind via `git update-ref`.

| # | Case | Expected | Got | Result |
|---|---|---|---|---|
| **C1** | **The named failure.** `origin/main` stale one release behind, record = live `app-v55`/`v55-2`, `index.html` changed, CACHE left at `v55-2` | 1 | **1** | **PASS** — blocked twice over: the CACHE-not-bumped block *and* the already-served block, plus the explicit line *"origin/main is 6 commit(s) behind the published build … Ignoring origin/main."* |
| C2 | The correct case: same, but CACHE bumped to `v56-1` | 0 | 0 | PASS — green, with the staleness note still printed |
| C3 | Same failure, **uncommitted** working tree (the old bypass) | 1 | 1 | PASS — and the uncommitted-work notice now fires and is accurate (the V53-6 dead branch is genuinely fixed) |
| C4 | Correct release, both `index.html` and CACHE **uncommitted** | 0 | 0 | PASS |
| C5 | Hand-edited `PUBLISHED.json`, `cache` field set to a value that commit never had | 1 | 1 | PASS — refused outright with a self-consistency error, before any other check |
| **C6** | **Hand-edited-consistent / stale record**: record rolled back to `app-v54` while `v55-2` is live; new build changes `index.html` and keeps CACHE at `v55-2` | 1 | **0** | **FAIL — green tick, no warning at all. See PM-3.** Identical to simply forgetting `./mark_published.sh` after a push |
| C7 | `PUBLISHED.json` deleted; `origin/main` one behind; CACHE = the live value | 1 | 0 | FAIL (warned loudly first) — documented fallback behaviour, but it is the stranding build passing |
| C8 | `PUBLISHED.json` is malformed JSON | 1 | 0 | FAIL (warned loudly first) — falls back to `origin/main`; no error surfaced about the file being unreadable |
| C9 | `PUBLISHED.json` names a commit that does not resolve | 1 | 0 | FAIL (warned loudly first) — same fallback |
| C10 | `BASE_REF` override, `index.html` changed, CACHE untouched | 1 | 1 | PASS — both blocks fire; the "shipped before" message correctly uses the non-`PUBLISHED.json` wording |
| C10b | `BASE_REF` set to a ref that does not resolve | 1 | 1 | PASS — refuses rather than silently falling back |
| **C11** | **`sw.js` reformatted to double quotes** (`const CACHE = "chemowell-app-v55-2";`), `index.html` changed | 1 | **0** | **FAIL — green tick with the false message "sw.js's CACHE constant changed with it". See PM-2** |
| **C12** | **`sw.js` deleted**, `index.html` changed | 1 | **0** | **FAIL — `grep: sw.js: No such file or directory`, then exit 0 with the same false message. See PM-2** |
| C13 | The real working repo, as it stands | 0 | 0 | PASS — baseline `PUBLISHED.json → app-v54 (chemowell-app-v54-2) at 18c6504`, which I verified against `18c6504:sw.js` by hand |
| C14 | `mark_published.sh` reads from the commit, not the working tree | PASS | confirmed by reading (`git show "$SHA":…`) and by C1/C2, where it recorded `f2a4177`/`app-v55`/`chemowell-app-v55-2` correctly with a dirty tree present |

**Net:** the failure the `BACKLOG` called blocking is closed, and closed properly — the record beats the stale ref, the integrity check defeats the obvious hand-edit, and there is a second independent block on already-served cache values. Two ways to defeat it survive: an unparseable/missing `sw.js` (PM-2, a real one-line bug) and a record nobody updated (PM-3, the residual the design consciously trades for).

### 7. Regressions

| # | Case | Result | Observed |
|---|---|---|---|
| G1 | v52: as-needed med with mg dose options added through the real editor | PASS | Ondansetron 8 mg / 16 mg, 4h gap |
| G2 | v52: treatment-only med placed in the Morning group | PASS | Rad Cream |
| G3 | **v52 H-2 / V52-1**: grouped treatment-only med, no treatment date | PASS | *"No date set — showing every day until you set a treatment date."* — **not** "Outside its treatment-day window" |
| G4 | Dose logs from Home and reaches Today's journal | PASS | "Ondansetron logged · 8 mg at 10:41 PM" |
| G5 | The dose reaches History | PASS | present |
| G7 | CSV export downloads | PASS | header `Date,Time,Type,Detail,Note` |
| G8 | **v52 H-3**: CSV carries the real unit, no invented "pills" | PASS | `2026-08-10,10:41 PM,Ondansetron,8 mg,` |
| H1 | Scheduled med with the default 8 AM window | PASS | — |
| H2 | Beta date controls advance the simulated day | PASS | Mon Aug 10 → Tue Aug 11 |
| H3 | **v52 H-1**: header banner reports past missed doses | PASS | "1 missed dose from previous days" |
| H4 | **v52 H-1**: banner count == resolvable History rows | PASS | banner 1 == 1 resolvable row |
| H5–H8 | **v53**: treatment type editable in Settings, Chemo→Radiation→Other→Chemo | PASS | Home renders cleanly at every step |
| H9 | 1s tick leaves a settled Help view alone | PASS | — |
| H10 | 1s tick still rebuilds Home (guard did not over-reach) | PASS | — |
| S-8 | v52 source invariants (10 `treatmentOnlyBlocks()` call sites, no raw gate survives, no hardcoded pill count) | PASS | `test/v52-fixes.mjs` ALL GREEN, incl. the two assertions this release repaired |
| Z-1 | Console errors, PM sweep @360 (133 rows + drawer + Account + reload) | PASS | **0** |
| Z-2 | Console errors, PM sweep @390 | PASS | **0** |
| Z-3 | Console errors, route walk + regression runs | PASS | **0** |
| Z-4 | Horizontal overflow @360 across Help and every screen touched | PASS | max **0px** |
| Z-5 | Horizontal overflow @390 | PASS | max **0px** |
| Z-6 | Developer's own suites re-run on the fixed build | PASS | `test/v55-help.mjs` ALL GREEN (both widths), `test/v52-fixes.mjs` ALL GREEN, `test/audit-v55c.mjs` 9/9, `test/audit-v55d.mjs` 12/12 |

CDN `ERR_CERT_AUTHORITY_INVALID` filtered explicitly as the documented sandbox artifact; no other console output was suppressed.

---

## Things the Auditor missed

1. **The FAQ answers are rendered by a different code path from the Help walkthroughs** (`index.html:5982`, raw string, versus `helpRich()` for topics). The Auditor's V55-1 write-up correctly identified `2065`/`2066` as needing the same fix as the three `HELP_TOPICS` entries — but the two structures are not interchangeable, and prescribing the same fix for both without naming that difference is what let PM-1 through. The Auditor's own §3 tested FAQ *answers point at the right screen*; it did not test *what the answer renders as*.
2. **`chemowell-app-v54-1` was never a real cache key.** The Auditor raised V55-5 as "the README rows are missing" and explicitly declined to check content ("flagging rather than fixing — not my stage"). Fair, but the rows were then written retroactively from memory and one of them is wrong about the thing the row exists to record.
3. **`release_check.sh` treats an unparseable `sw.js` as a successful bump** (PM-2). Neither the app-v53 Auditor (which found V53-4, the adjacent bug) nor the app-v55 Auditor (which recorded only "`./release_check.sh` → exit 0") probed the parser. Exit 0 was accepted as evidence the gate works, which is the same reasoning error the gate itself exists to prevent.
4. **`sessionStorage`'s stale `'faq'` value is never rewritten** (P4c). `restoreView()` filters it on every read, so behaviour is correct forever — but the value persists in a user's session storage indefinitely. Harmless; worth knowing before someone assumes the migration is self-healing.
5. **Free tier caps profiles at 1**, so `pro-switch`'s step 3 ("Tap **Switch** next to the person you want") and `switch-profile`'s "add a profile" are unreachable on a Free install — tapping **+ Add profile** opens the upgrade sheet. The copy is not wrong (both entries are explicitly about multi-profile use, and `caregiver-multi` states the tier limits), but no Help entry says *"you'll be asked to upgrade first"*, which is what a Free-tier caregiver following `pro-switch` will actually hit. Not a defect; a `BACKLOG.md` line.

## What must happen before push

1. **Fix PM-1** — strip the two `**` pairs at `index.html:2065` and `2066` (or route `item.a` through `helpRich()` and re-check all 15 answers). Targeted-fix tier: no new Auditor round, but I re-verify those two rendered strings against the running product and log it as an addendum here.
2. **Fix PM-4** — `README.md:15`, `chemowell-app-v54-1` → `chemowell-app-v54-2`.
3. **Fix PM-2** — two lines in `release_check.sh` so an unreadable `CACHE` is fatal instead of green. Cheap, and it is the gate that guards every future push.
4. **Log PM-3 and observation 5 in `BACKLOG.md`.** PM-3 is not a blocker; it must not silently become the next `origin/main`.
5. `sw.js` CACHE is already `chemowell-app-v55-2` and unpublished, so items 1–3 ride on it — **no further bump is needed** as long as nothing is pushed between now and then. Re-run `./release_check.sh` after the edits regardless.
6. **After the push, run `./mark_published.sh` and commit `PUBLISHED.json` in the same breath.** PM-3 is precisely what happens if that step slips.

Once 1–4 are in and I have spot-verified the two FAQ strings live, this is a **GO**. Nothing else in app-v55 needs another round: the Help centre itself is in good shape, all 133 rows are clean at both widths, the medical callout split is exactly right on all nine topics, no backtick survives anywhere, the v52/v53 fixes all hold, and there are zero console errors.

---

# ADDENDUM — re-verification of commit `64998ad`

## VERDICT: **GO**, conditional on two documentation items and one one-line script fix, none of which touch shipped behaviour.

All five PM findings are genuinely fixed. Re-verification turned up **one new defect in `release_check.sh` (PM-6)** that fails a *correct* release rather than passing a bad one, plus **two documentation gaps (PM-7, PM-8)**. Nothing in the app's shipped behaviour is wrong. My position: fix PM-6, PM-7 and PM-8 and push — they do not warrant another PM round, and I will not hold the Help centre for them.

**Under test:** `HEAD` == `64998ad`, `git status` clean at the time of testing. `APP_VERSION = 'app-v55'`, `CACHE = 'chemowell-app-v55-2'` (unchanged from the previous commit, which is correct — nothing has been published in between).
**Scratch work:** a **new** tree, `/tmp/pmscratch2`, built from scratch. `/tmp/pmscratch` from the first round was not reused. Every clone runs a `cmp` of its `release_check.sh` against `git show HEAD:release_check.sh` and **aborts** if they differ, so the harness cannot silently test a stale script — the failure mode you flagged. `sha256(HEAD:release_check.sh) = e13748c3a2d1c6c6859865a2fdba1439e07171c90791aea5f76272a3f0b8e0e7`, printed at the top of every run. Nothing was run in the working repo except the two read-only cases marked as such.
**New scripts:** `test/pm-v55b.mjs` (FAQ/helpRich, both widths), `test/pm-v55-focus.mjs`, `/tmp/pmscratch2/cases2.sh`. **Committed nothing.**

---

## PM-1 — FIXED, and fixed the right way

Routing `item.a` through `helpRich()` is the better of the two options I offered and I want that on the record: stripping the asterisks would have removed two instances and left the trap — the next person to edit an FAQ string using the convention the file next door uses would have re-created it. Sharing the renderer removes the class. `index.html:5988`.

I verified it four ways rather than by looking at the two entries.

| # | Case | @360 | @390 | Observed |
|---|---|---|---|---|
| B0 | 15 FAQ entries parsed out of `index.html` source | PASS | PASS | 15 |
| B1 | 15 FAQ rows render | PASS | PASS | 15 |
| B2 | **No FAQ answer renders a literal `*` or backtick** (any `*`, not just `**`) | PASS | PASS | 0 |
| **B3** | **Every FAQ answer's rendered text == its source string with markup consumed** — a byte-level round-trip of all 15, not a spot-check. This is the assertion that proves `helpRich()` neither dropped, duplicated nor re-interpreted anything in the other 13 | **PASS** | **PASS** | 15/15 exact |
| B4 | Exactly 2 answers produce markup nodes — the other 13 render as pure text | PASS | PASS | only `switch-profile`, `caregiver-multi` |
| B5 | Those 2 produce `strong=1, em=0, code=0` — bold, and nothing accidentally italicised | PASS | PASS | — |
| B6 | The bold node's text is exactly `Account` | PASS | PASS | `["Account"]` |
| B7a | FAQ still found by its own question text | PASS | PASS | — |
| **B7b** | **Found by a word that now sits INSIDE the `**` markup** (`account separate`) | PASS | PASS | both FAQ rows returned, labelled *Common questions* — the search index reads the raw string, so markup does not hide a word |
| B7c | The second rewritten FAQ is findable | PASS | PASS | — |
| B7d | A FAQ search hit still opens the accordion expanded, clean | PASS | PASS | lands on *Common questions*, answer expanded, query cleared |
| B8 | All 133 rows opened again | PASS | PASS | 133 |
| B9 | **No `*` or backtick anywhere in the entire Help centre** | PASS | PASS | 0 |
| B10 | Horizontal overflow | PASS | PASS | 0px both |
| B11 | Medical callout split unchanged by the renderer change | PASS | PASS | 4 urgent / 5 calm |
| BZ | Console errors | PASS | PASS | 0 |

**On your point (c) — "check me".** You are right, and I checked it two ways rather than taking it. Statically: parsing the `FAQ_ITEMS` block (`index.html:2061–2077`) character by character, **only lines 2065 and 2066 contain `*` at all** (4 each = two balanced `**` pairs); there are **zero backticks** in the block; the only `_` in the range is the identifier `FAQ_ITEMS` itself, and `helpRich()` does not interpret `_` anyway, so it was never a risk. Empirically: B3 above proves it for all 15 at once, which is stronger than character-hunting because it would also catch a form of markup I had not thought to look for. Screenshot: `outputs/pm-v55-02-faq-bold-account-360.png`.

**One residual, observation only.** `a` is now rich in both structures; `q` is still rendered raw in both (`topicRow`, the accordion button label, the topic `<h1>`). That asymmetry is now *consistent across the two structures*, which is the part that mattered, and no `q` field in either `FAQ_ITEMS` or `HELP_TOPICS` currently contains `*` or a backtick (checked). But the trap has moved one field over rather than disappeared entirely. Not worth code now; worth a sentence in the comment at `index.html:5982` if that block is ever touched again.

## PM-2 — FIXED, and it survives four variants you did not name

Unparseable is now fatal (`release_check.sh:143–153`), and the dead `[ "$CACHE_NEW" != "none" ]` guard is gone from the reuse block (`:171`). I re-ran my C11/C12 and then went looking for a fifth door.

| # | Variant | Expected | Got | Result |
|---|---|---|---|---|
| R3 | Double-quoted `CACHE` (my original C11) | 1 | 1 | PASS — fails with the new, accurate message |
| R4 | `sw.js` deleted (my original C12) | 1 | 1 | PASS |
| **R5** | **Template literal:** `` const CACHE = `chemowell-app-v56-1`; `` | 1 | 1 | PASS |
| **R6** | **No spaces:** `const CACHE='chemowell-app-v56-1';` | 1 | 1 | PASS |
| **R7** | **CRLF line endings**, CACHE value *not* bumped | 1 | 1 | PASS — CRLF turns out to be a non-issue for the pattern (the `\r` sits after the closing quote), and the run correctly falls through to the real "CACHE was not bumped" block rather than to the parser check. Right answer for the right reason |
| R13 | The real working repo (read-only) | 0 | 0 | PASS |

The failure message is also correct now: it names the exact expected format and says explicitly that the gate will not guess. `CACHE_OLD = "none"` warns rather than fails, which I agree with — the baseline is a historical commit, every one of which parses, and a hard fail there would block on something the person running it cannot fix.

## PM-6 — **NEW, LOW–MEDIUM** · a second `CACHE = '…'` match anywhere in `sw.js` hard-fails a *correct* release, with a mangled message

This is the fifth door, and it is open in the safe direction.

* **Where:** `release_check.sh:129–130` — both `CACHE_OLD` and `CACHE_NEW` use `grep -o` with **no `head -1`**, so both can hold multiple newline-separated matches. (The per-commit loop inside the reuse block *does* have `head -1`; the two top-level extractions do not.)
* **Observed (R9):** `sw.js` with a commented-out previous value above a genuinely bumped current one —
  ```
  // previous: const CACHE = 'chemowell-app-v55-2';
  const CACHE = 'chemowell-app-v56-1';
  ```
  `CACHE_BARE` becomes a two-line string; `grep -Fx "$CACHE_BARE"` treats each line as a separate fixed pattern, the retired `v55-2` matches published history, and the gate **exits 1 on a correct release**, printing:
  ```
  ❌ RELEASE CHECK FAILED: CACHE 'chemowell-app-v54-2
  chemowell-app-v55-2' has been shipped before …
  ```
* **Observed (R8):** the same shape with both values equal (nothing really bumped) is still blocked — correct outcome — but by the *wrong block* and with the same mangled two-line value in the message, so the diagnosis handed to whoever has to fix it is wrong.
* **Severity:** it fails safe, so nothing can be stranded by it. It is not a blocker. But TEAM.md says *"If the script fails, fix what it says before doing anything else — do not work around it or push anyway."* A gate that hard-fails a legitimate build with a message containing an embedded newline and a value that was never in the file is exactly what teaches someone to work around it, and this gate's whole authority rests on nobody ever doing that.
* **Fix:** add `| head -1` to both extractions at `:129` and `:130`. One word each.

## PM-3 — honest mitigation, but lower-powered than the wording suggests; my judgement is *accept and log*, which is what happened

You asked me to judge whether this is an honest mitigation or dressing up a hole. It is honest, and I would not call it dressing up — but I want to be precise about what it does and does not buy, because the commit message oversells it slightly.

**What is genuinely right about it:** the limitation is stated in the code where the limitation lives (`release_check.sh:82–94`), the `BACKLOG.md` entry describes the real fix rather than declaring victory, and that real fix is the correct one — reading `sw.js` from the deployed URL during the post-push live-verify that already happens is the only thing in this project that can actually observe reality. Naming an assumption out loud is strictly better than the silence I found in C6.

**What it does not buy, and should not be described as buying:** it is not a detector. The notice fires whenever the record is behind `HEAD`, which is *every normal release* — case R13, the real working repo mid-release, prints it (`4 commit(s) have changed index.html since that record`), and so does case R10, the dangerous stale-record case (`5 commit(s)`). The two outputs are textually identical apart from an integer. A warning with a 100% false-positive rate on correct runs carries no signal at the moment it matters; it is a standing disclaimer, not an alarm. R10 still exits 0 on a build that would strand installed apps.

| # | Case | Expected | Got | Result |
|---|---|---|---|---|
| R10 | Record left at `app-v54` while `v55` is live (i.e. pushed and forgot `mark_published.sh`); new build changes `index.html`, keeps CACHE at the live `v55-2` | 1 | 0 | Unchanged from C6 — green, **now with the new notice printed**, which is the improvement |
| R13 | The real working repo mid-release, everything correct | 0 | 0 | Prints the same notice — which is why the notice cannot discriminate |
| R1 | The original blocker (stale `origin/main`, live CACHE reused) | 1 | 1 | Still blocked, twice over |
| R11 | Hand-edited, self-inconsistent record | 1 | 1 | Still refused |
| R12 | `BASE_REF` unresolvable | 1 | 1 | Still refused |
| R2 | Correct release | 0 | 0 | Still passes |

I looked for a cheap in-sandbox discriminator and could not find an honest one: counting distinct CACHE values between the record and `HEAD` sounds promising, but app-v55 itself legitimately has two (`v55-1` then `v55-2` after the Auditor round), so it would fire on the current, correct repo. **This genuinely cannot be closed from in here.** Accepting it as a logged residual with the real fix written down is the right call, and `BACKLOG.md` and `TEAM.md:245` both carry it. I would only ask that the commit message's phrasing not harden into a belief that the gate would now catch it — it would not; the human step is still the control.

## PM-4 — FIXED, and I re-checked the rest of both rows

`README.md:15` now reads `chemowell-app-v54-2`, matching `18c6504:sw.js` and `PUBLISHED.json`. I then re-verified every other checkable factual claim in both rows against the artefacts rather than the prose.

| # | Claim | Result | Evidence |
|---|---|---|---|
| E-1 | v54 CACHE `chemowell-app-v54-2` | PASS | `18c6504:sw.js`, `PUBLISHED.json` |
| E-2 | v54: "focus is never returned to the hamburger on close" | PASS | driven live: `activeElement` is `BODY` after Escape, after the X, and after a scrim tap. `test/pm-v55-focus.mjs` |
| E-3 | v54: logged in `BACKLOG.md` as pre-existing since app-v22 | PASS | `BACKLOG.md:9–16`, with line refs |
| E-4 | v54: "unnoticed for 32 releases" | PASS | v22 → v54 |
| E-5 | v54: identity header is a plain `<div>`, avatar `aria-hidden`, plan pill labelled | PASS | source + live (`P1b`, `P1c`) |
| E-6 | v55: content authored as `outputs/HELPBOT_CONTENT_v1.md` (**1,966 lines**) | PASS | `wc -l` = 1966 exactly |
| E-7 | v55: 17 categories → 133 rows, 117 walkthroughs + 15 FAQ + 1 pointer | PASS | driven, 133 |
| E-8 | v55: nine medical-adjacent topics, callout wording from the app's existing disclaimer | PASS | 9, verified individually |
| E-9 | v55: `Not medical advice` × 5 / `Contact your care team` × 4 | PASS | all nine driven at both widths |
| E-10 | v55: the Help view is excluded from the 1s tick and the field restores its own caret | PASS | source `index.html:7825`; behaviour re-confirmed by `audit-v55d` H9/H10 |
| E-11 | v55: `APP_VERSION` → `app-v55`, CACHE → `chemowell-app-v55-2` | PASS | — |
| E-12 | v55: "0px horizontal overflow at 360px and 390px" | PASS | 0px, every sweep |
| **E-13** | **v55: "the 15 FAQ entries survive untouched"** | **NIT** | Structurally true (same accordion, same `faqOpenId`, same 15 ids) but **two of the 15 answers were rewritten in this very release** and all 15 now go through a different renderer. "Untouched" is the one word in the row that a future reader could be misled by. Suggest "survive intact" / "survive as-is apart from two corrected cross-references". Not worth a round on its own — fold it into PM-7 |

## PM-7 — **NEW, LOW** · the README row documents the Auditor round and not the PM round

The app-v55 row (`README.md:14`) still ends at V55-1…V55-5 and asserts *"Five findings, **all five fixed in this release**"*. There is no mention anywhere in the version history that a PM gate ran, returned NO-GO, or that a sixth round of fixes shipped inside app-v55 — including the one that matters most to a future reader of this file: **two FAQ answers were rendering literal `**Account**` to users, and the fix was to share `helpRich()` across both content structures.** The `release_check.sh` hardening (PM-2) is also unrecorded there.

This is the same failure V55-5 was raised to fix, one level up: the version history is how anyone reconstructs what is live, and right now it would tell them app-v55 is the commit `f2a4177` build. Two or three sentences appended to the existing row closes it. `outputs/PM_v55.md` exists and is committed, but the README is the index into it.

## PM-8 — **NEW, LOW** · one item from my first report was not logged

I asked for two things in `BACKLOG.md`. PM-3 was logged, thoroughly and honestly. **Observation 5 was not:** on the Free tier the profile cap is 1, so `pro-switch` step 3 ("Tap **Switch** next to the person you want") and `switch-profile`'s "add a profile" are unreachable — tapping **+ Add profile** opens the upgrade sheet instead. I re-confirmed this live this round: the route walk only completes after setting `tier: 'pro'`, and a newly created profile then lands on the welcome screen for its own first-run, which no Help entry mentions either. The copy is not wrong and `caregiver-multi` does state the tier limits, but a Free-tier caregiver following `pro-switch` hits a paywall the walkthrough does not warn them about. One `BACKLOG.md` line.

## PM-5 — FIXED; the new assertions do pin what they claim, with one gap worth naming

I read them rather than trusting the count, then ran the suite: **144 assertions, 144 PASS, 0 FAIL**, at 360px and 390px.

**What is genuinely good:** the nine-topic loop asserts in **both directions** — a calm topic must show `Not medical advice` *and must not* show `Contact your care team`, and vice versa. A one-directional assertion would have stayed green if the ternary were replaced with a constant; this one would not. It reaches each topic by search and emits an explicit **FAIL** if the row cannot be found, rather than skipping silently — which is the right way to write a loop that can lose its target. All 15 FAQ rows are expanded and read. The static `faqBlock` parity check now covers `*` and backticks in `FAQ_ITEMS`, closing the scope gap that let PM-1 through, and the renderer itself is pinned (`...helpRich(item.a)`).

**The gap:** the live FAQ assertion tests `txt.includes('**')`. A **single** `*` would not trip it — so a stray `*Settings*` in an FAQ answer would silently render as italics with no test objecting. The static parity check catches an *odd* number of asterisks, so the realistic typo is covered from the other side; what falls through is a *balanced* pair of single asterisks, which renders as unintended italics rather than as visible garbage. Low consequence. My `test/pm-v55b.mjs` B2/B9 test for any `*` or backtick and are green, so nothing is currently wrong; if you want the guard rather than the observation, change `includes('**')` to `/\*|`/` in that one assertion. Symmetrically, `HELP_TOPICS` has a backtick-parity assertion but no asterisk-parity one.

## Regressions — full battery re-run on `64998ad`

| Suite | Result |
|---|---|
| `test/pm-v55.mjs` @360 / @390 (drawer, Account, 133 rows, chips, 9 callouts, legacy `faq`) | **21/21 · 21/21** |
| `test/pm-v55b.mjs` @360 / @390 (FAQ + helpRich round-trip) | **16/16 · 16/16** |
| `test/pm-v55-routes.mjs` (every route the corrected V55-1 copy names, end to end) | **10/10** |
| `test/pm-v55-chips.mjs` (chip headroom) | widest chip 149px in a 298px column @360 (min headroom 30px), 0px doc overflow — unchanged |
| `test/v55-help.mjs` (Lead Developer's suite) @360 / @390 | **144 PASS, 0 FAIL** |
| `test/v52-fixes.mjs` (v52 H-1/H-2/H-3 source invariants, 10 `treatmentOnlyBlocks()` call sites) | **ALL GREEN** |
| `test/audit-v55c.mjs` (v52 H-2/H-3 live: no-date treatment med, dose→journal→History, CSV `8 mg`) | **9/9** |
| `test/audit-v55d.mjs` (v52 H-1 live banner==History, v53 Chemo→Radiation→Other→Chemo, tick guard) | **12/12** |
| Console errors across every run | **0** (CDN `ERR_CERT_AUTHORITY_INVALID` filtered explicitly; nothing else suppressed) |
| Horizontal overflow, 360px and 390px | **0px** |

## Verdict and what happens next

**GO.** The shipped app is correct. Before the upload:

1. **PM-6** — `| head -1` on `release_check.sh:129` and `:130`. One-line script fix, no app code, and it stops the gate hard-failing a legitimate release with a mangled message.
2. **PM-7** — append two or three sentences to the app-v55 README row covering the PM round: the FAQ literal-`**` defect and the shared-renderer fix, the `release_check.sh` hardening, and a pointer to `outputs/PM_v55.md`. Fix the "untouched" wording (E-13) in the same edit.
3. **PM-8** — one `BACKLOG.md` line for the Free-tier profile cap versus `pro-switch`'s wording.
4. Re-run `./release_check.sh`, confirm exit 0. `CACHE` is already `chemowell-app-v55-2` and nothing has been published since, so **no further bump is needed** — items 1–3 ride on it.
5. **Immediately after the push, `./mark_published.sh` and commit `PUBLISHED.json` in the same breath.** PM-3 is exactly what happens if that slips, and the gate will not tell you.

None of 1–3 touches `index.html` or `sw.js`, so none of them needs another Auditor or PM round; TEAM.md's documentation carve-out covers 2 and 3, and 1 is a one-word change to a script that I have just re-proved across 13 cases and can re-check in a single run. **`sym-severe` still wants one oncology-nurse read before real users** — correctly logged in `BACKLOG.md`, correctly not claimed in `REQUESTS.md`, and correctly not a beta blocker.
