# Project Manager — gate report: sync-backend provisioning + audit-fix round

**Date:** 2026-08-09
**Scope reviewed:** everything on `origin/main` after `ddcd221`, through `b197280`.
**Live target:** `https://chemowell-sync.vercel.app` (project `prj_2XeK4T90Tw4O9h4n6GYPExGI7r5l`,
team `team_HxJUi8elgOiohhocDB9h0YpU`).
**Role:** independent PM gate per `TEAM.md` stage 6 / `APP_CLAUDE.md` rule 5. Not a restatement of
the Lead Developer's account — every claim below was re-derived from the code, the Vercel API, or
live HTTP traffic I generated myself.

> **Two rounds.** Round 1 (§1–§6) refused sign-off over PM-F1. Round 2 (§7) re-verifies the fix and
> carries the **binding verdict**. Round 1 is preserved as the record of what was found and why.

---

# ROUND 1 — 2026-08-09

## 1. Verdict (round 1, superseded by §7)

**❌ NEEDS ANOTHER LOOP — full restart, functional/safety tier**, per `TEAM.md`'s restart rule:

> *"Real functional, data, or safety-relevant miss — anything that behaves wrong... gets a full
> restart... and the fix goes back through both mandatory gates from scratch."*

Requirements issued: **R1** fix PM-F1; **R2** independent Auditor pass over the fix round; **R3**
re-verification must re-run the audit's previously-*passing* tests; **R4** write the
re-verification down in `outputs/` and correct the unsupported "33/33" claim; **R5** address
PM-F2…PM-F5.

## 2. Independent verification (round 1)

### 2.1 Release mechanics — all PASS

| Check | Result |
|---|---|
| `git diff ddcd221..origin/main -- index.html sw.js` | **Empty** — no version bump / APK rebuild needed, as claimed |
| `bash ./release_check.sh` | **exit 0** |
| Local clone vs `origin/main` | Trees byte-identical (`ef1709a3…`); commit *hashes* differ only because pushes go through the GitHub web UI |
| Deployed commit | `dpl_35NoGukeyjDMofwqgo3a6aLyHjbG` = `aba4293` = `origin/main` HEAD, `READY` |
| Deployment protection (Vercel API) | `passwordProtection=false`, `ssoProtection=false`, `trustedIps=false` |
| `node test/ids.test.mjs` | **ALL CHECKS GREEN** |
| App wired? | `index.html:338` → `const SYNC_API_BASE = '';` — nothing reaches users |

### 2.2 The three specific numeric claims

- **"0 500s across 36 concurrent pushes" — TRUE.** Reproduced exactly: `{200:12, 409:24}`, 0
  two-winners, 0 conflicts missing `current`. Pushed further to 8×8 on the same path: `{200:8,
  409:56}`, 0 server errors. F-01 genuinely fixed *on the `ifMatch` path*. The claim is real — it
  just does not cover the other concurrent path (PM-F1).
- **"Unauthenticated blob fetch returns 403" — TRUE, independently reproduced.** Against store
  `store_ShEjIKQ4b4ymxc8U`: `/pair/sessDOESNOTEXIST.json` → **403 Forbidden** on both the
  `.private.` and `.public.` hosts and on lowercase variants; store root → **400 "Invalid path"**.
  The 400 control is what matters: the host resolves, so the 403 is a real authorization decision.
- **"33/33 checks" — UNVERIFIABLE.** No artifact. `grep -rln "33/33"` returns only `README.md` and
  `REQUESTS.md` — the two files asserting it. The 33 checks demonstrably did not cover the path
  that broke.

### 2.3 Critical / High findings, re-tested

| ID | Sev | Status | Evidence |
|---|---|---|---|
| F-02 traversal read oracle | Critical | **CLOSED** | 6 probes → all `400` before any storage call |
| F-03 brute-forceable code / no limiter | Critical | **CLOSED** | 10-char Crockford code; limiter engaged at **exactly request 31**, `Retry-After: 58` |
| F-01 500 instead of 409 | High | **PARTLY — REGRESSED** | Fixed on `ifMatch` path; **36/36 losers got 500 on the new-record path** → PM-F1 |
| F-04 expiry / `upload-key` reuse | High | single-use **CLOSED** (`409 key_already_uploaded`, wrapped key intact); expiry **code-verified only** |
| F-05 `newVersion` unvalidated | High | **CLOSED** | 5 probes → `400 invalid_version` / `invalid_version_step` |
| F-07 silent truncation | High | **CLOSED structurally** | cursor paging + `truncated` flag on the wire; untested >1,000 records |
| F-15 unauthenticated destructive write | High | **CLOSED** | 6 probes → `403`; old `?token=` contract dead (`400`) |
| F-16 `Math.random()` | High | **CLOSED** | `node:crypto`, unit tests green |

Medium/Low: F-09, F-10*, F-11, F-12, F-13, F-14, F-17, F-18 all closed and verified. F-06 partly
fixed and **not disclosed** (PM-F2). F-08 deferred and honestly disclosed. *F-10's fix is the cause
of PM-F1.

**Deferral honesty check: nothing Critical or High is hiding in `BACKLOG.md`.** Both sync entries
are genuinely Medium-or-below and the F-08 entry is unusually candid.

## 3. My own findings (round 1)

### PM-F1 — Concurrent creation of a *new* record returns 500 to every losing device — **HIGH** 🔴

`push.js:101`, `if (!isConditionalWriteConflict(e)) throw e;`. Live, 100% reproducible:

| Test | Pushes | Result |
|---|---|---|
| 5 rounds × 6 concurrent, new `recordId` | 30 | `{200:5, 500:25}` |
| 10 rounds × 2 concurrent (patient + one caregiver) | 20 | `{200:10, 500:10}` |
| 1 round × 2 (integrity check) | 2 | `200, 500` |
| **Total** | **52** | **16 winners, 36 losers, 36/36 → HTTP 500** |

Body every time: `{"error":"server_error"}` — no `current`. Contrast, same session: *sequential*
duplicate create → clean `409` **with** `current`; *existing*-record race → `200,409,409`.

**Mechanism, confirmed against the real SDK.** I installed `@vercel/blob@2.7.0` and read
`getBlobError()` in `dist/chunk-OYCIHDFF.js`: **there is no `BlobAlreadyExistsError` class and no
already-exists case in the switch** — an `allowOverwrite:false` collision falls to the
`bad_request` arm (plain `BlobError`) or to `default` → `BlobUnknownError`.
`isConditionalWriteConflict` tests only `/conditional request cannot succeed/i`,
`/conflicting operation/i`, `/precondition/i`. None match → rethrow → 500.

**How it got in:** it is the fix for F-10. The audit had tested this exact case and recorded it
**PASS** (test RB: *"200=1 / 409=7 every single round, with `current` populated"*). A passing test
became a failing one and nobody re-ran it.

**Why it matters:** the new-record race *is* the first-sync-after-pairing path — two devices pair,
both hold local records, every record collides. The second device gets `server_error` on
essentially every record and its conflict path never runs. Data integrity held (winner's value
stands, 0 double-writes in 52 pushes), which is the only reason this is High and not Critical.

### PM-F2 — F-06 deferral incomplete — **LOW (honesty)**
Completed handshakes are never cleaned up; profile record and `profile-auth/` blobs never deleted.
Security impact nil (expiry enforced at read time); storage cost only. Not in `BACKLOG.md`.

### PM-F3 — Fixing F-07 without F-08 turns silent truncation into a hard timeout — **MEDIUM**
`listJson` hardLimit 5,000 × ~37 ms/record ≈ 185 s. No `vercel.json`, no `maxDuration`. Past
roughly 1,600 records `pull` fails outright and the `truncated` flag is unreachable. A strict
improvement (loud beats silent), but `BACKLOG.md` framed F-08 as pure performance.

### PM-F4 — Same unhandled 500 shape on `pair-code` collision — **LOW**
`create.js:67` `allowOverwrite:false`; a collision throws the same unclassifiable error → 500, and
orphans the `pair/<sessionId>.json` written at line 62. Probability negligible; identical class.

### PM-F5 — `ids.js:43` cites `ratelimit.js`, which does not exist — **LOW**
The limiter is in `guard.js`. `_lib/` contains only `auth.js`, `blob.js`, `guard.js`, `ids.js`.

### PM-P1 — The fix round never went through an independent gate — **PROCESS (root cause)**
The Auditor audited the backend at `16e1480`/`f27a0d8`. The response was 1,918 insertions, three
new `_lib` modules, a new write-authentication model, all seven endpoints rewritten — **more new
code than was originally audited, reviewed by nobody but its author.** The Auditor's own report
closed with *"the fixes go back through both mandatory gates from scratch — not a spot-check."*
That did not happen. Self-verification reported 33 green; an independent pass found a High
regression within the hour.

### On scope: right call, not scope creep
The audit was **mandatory**, not initiative — `APP_CLAUDE.md` rule 5 names `sync-backend/`
explicitly, and clearing the blocker required a real code change. Fixing 2 Critical + 6 High before
building the pairing UI is correct sequencing: two findings changed the *client contract*.
Stopping to ask Aaron would have violated rule 7, and *"should I fix an unauthenticated read oracle
that leaks live pairing codes?"* is not a product decision. **The one real process gap is stage
selection:** `auth.js` introduces a new security primitive with a client-side contract — under
`TEAM.md` stage 1 that warranted a Developer brief with a considered alternative, not a fix commit.
The design looks sound to me and its header comment is genuinely good (notably the decision *not*
to derive the token from K, which protects rule 1) — but "the PM read it and it looked sound" is
not the review that decision deserved.

## 4. Documentation review (round 1) — PASS, with one correction

Read cold. `HANDOFF.md`, `REQUESTS.md`, `BACKLOG.md` and the `README.md` entry are honest about
what is unverified and never imply sync works.

**Both contract changes are findable and clear.** Three converging entry points: `HANDOFF.md:79-82`
→ `REQUESTS.md` "Next up" item 2 → the `REQUESTS.md` sync item detail, which specifies the 10-char
Crockford code (`XXXXX-XXXXX`, accepted back lowercase/spaced/undashed with O/I/L repair) and,
explicitly, *"`upload-key`'s ciphertext should wrap `{ k, writeToken }`, not just K"* plus the
header requirement. I verified every documented behaviour against the live API; all accurate.

**Correction needed:** `README.md` and `REQUESTS.md` assert *"re-verified live (33/33 checks)"* —
no artifact behind it, and per PM-F1 not true. Minor: `HANDOFF.md:3` still says "current as of
app-v51" while describing 2026-08-09 work.

## 5. Round-1 sign-off

Not signed off. Returned to the Lead Developer for R1–R5.

---

# ROUND 2 — re-verification of the PM-F1 fix

## 7. Round 2

### 7.1 What changed, and whether the approach is right

One commit, `f8d1a25` "sync-backend: fix 500 on new-record race" — **29 insertions, 13 deletions,
`sync-backend/api/profile/push.js` only.** I diffed it myself; the scope claim is accurate. Plus
`b197280`, `BACKLOG.md` only.

Both catch branches now decide from **storage state** rather than error text:

- **New-record branch:** `const raced = await getJson(pathname); if (!raced) throw e;` → exists
  now = somebody else created it = `409` with `current`; still absent = the write really failed =
  rethrow. `isConditionalWriteConflict` is dropped entirely here.
- **Update branch:** `const somebodyElseWon = raced && raced.data.version !== baseVersion;` then
  `if (!somebodyElseWon && !isConditionalWriteConflict(e)) throw e;` — state check authoritative,
  error-shape check retained only as a fast path.

**This is the right fix, and it is better than what I asked for.** I only required that the
already-exists shape be recognised; the Lead Developer instead removed the dependency on SDK error
text on the path where that text is unclassifiable. Since I established that `@vercel/blob` has no
already-exists error case at all, any message-matching fix would have been guessing at a string
Vercel is free to change. This one cannot break that way. The inline comments correctly record both
failure modes and why neither may mask the other.

### 7.2 PM-F1 reproduction — CLOSED

Fresh profile and credentials, same concurrency levels that broke it in round 1:

| Test | Round 1 | **Round 2** |
|---|---|---|
| 5 rounds × 6 concurrent, new record (30 pushes) | `{200:5, **500:25**}` | **`{200:5, 409:25}`** |
| 10 rounds × 2 concurrent — patient + one caregiver (20 pushes) | `{200:10, **500:10**}` | **`{200:10, 409:10}`** |
| 8 rounds × 8 concurrent, new record (64 pushes) | not run in R1 | **`{200:8, 409:56}`** |
| 6 rounds × 6 concurrent, update/`ifMatch` race (36 pushes) | — | **`{200:6, 409:30}`**, final version 7 |

**Totals across 150 concurrent pushes: 0 × 5xx, 0 two-winners, 0 conflicts missing `current`, 0
phantom conflicts.** Every single 409 carried a populated `current`. The Lead Developer's own
numbers reproduce.

### 7.3 Did the fix trade one defect for another? — the thing I was asked to break

This was the right thing to worry about, because the inverse defect (F-10: a real failure reported
as a phantom conflict) is what the original tightening was *for*.

**(a) Can a non-conflict be reported as a conflict?** I probed every failure I can induce from
outside. All rejected before any write is attempted — none produced a phantom 409:

| Probe | Result |
|---|---|
| `newVersion` skips a step | `400 invalid_version_step` |
| negative `newVersion` | `400 invalid_version` |
| 300 KB ciphertext | `400 invalid_payload` |
| `kind:"evil"` | `400 invalid_kind` |
| traversal `recordId` | `400 missing_fields` |
| no write credential | `403 not_authorized` |
| unknown profile | `403 not_authorized` |

**(b) Is `current` truthful when a conflict *is* reported?** Yes — not fabricated. Sequential
duplicate create returned `409` with `current.ciphertext === "FIRST"`, i.e. the actual winner's
stored value, at `version: 1`. Stale-base push against an existing record returned `409` with the
real current version.

**(c) Instrumented specifically for the phantom shape.** In the update race I counted every 409
whose `current.version` still equalled the caller's own `baseVersion` — the signature of "conflict
reported but nothing actually moved." **0 out of 30 conflicts.**

**(d) What if the re-read itself fails?** Reasoned from code, not executed — I cannot induce a
storage outage against the live deployment, and I am labelling it as such rather than asserting it.
`getJson` (`_lib/blob.js:65-81`) returns `null` only for a genuine Blob-layer not-found and
**rethrows everything else**. That throw escapes the inner catch, hits the handler's outer catch at
`push.js:136`, and becomes `500 server_error`. So a failed re-read fails loud, and cannot be
mistaken for "no record exists." Correct behaviour, and the F-10 property is preserved.

**(e) The one residual timing window, and why it is benign.** In the update branch, if a losing
writer's re-read were to land *before* the winner's write became visible, `somebodyElseWon` would
be false and the outcome would fall back to `isConditionalWriteConflict(e)` — either a `409` whose
`current` equals the caller's own base (harmless: the client's decrypt-and-compare finds nothing to
reconcile and retries) or a `500` (the old defect). In practice the window is closed by causality:
an `ifMatch` rejection means the winner's write has already committed at the storage layer, and
reads are origin-fresh (`useCache:false`), so the re-read must observe it. 0 occurrences in 30
conflicts. Recording it as a theoretical residual, not a defect.

**Conclusion: no defect was traded.** Both directions hold — real conflicts become 409-with-current,
real failures become 5xx.

### 7.4 Nothing else regressed

| Area | Result |
|---|---|
| **F-02** traversal (Critical) | 6 probes → `400 missing_fields` ×4, `400 session_required` ×2 |
| **F-03** limiter (Critical) | 40 sequential redeems → `{404:30, 429:10}`, **first 429 at request 31**, `Retry-After: 58` |
| **F-03** code entropy | `DG6SE-CFNNM` — 10 chars stripped, Crockford charset, no I/L/O/U |
| **Write auth** | `pull` no credential → `403`; old `?token=` query → `400 token_required` |
| **Version-step invariant** | `400 invalid_version` / `invalid_version_step` |
| **Pull paging** | `{records, truncated}`, `truncated:false`, 25 records, fields whitelisted to exactly `recordId,kind,version,updatedAt,lastWriterDevice,ciphertext,iv`, `Cache-Control: no-store` |
| **Malformed JSON** | `400 invalid_json_body` |
| **Method guards** | `405,405,405,405` |
| **Full pairing handshake** | `upload-key` before joiner → `400 no_joiner_yet`; redeem with messy input (`"dg6se cfnnm"` style, lowercased, dash→space) → `200`; replay → `409 code_already_redeemed`; `upload-key` → `200`; second `upload-key` → `409 key_already_uploaded`; wrapped key intact `{"ciphertext":"WK_GOOD","iv":"IV1"}`; unknown code → `404` |
| **Multi-caregiver invite** | without credential → `403 not_authorized_for_profile`; with → `200`, same profile, no re-mint |

One note on method: a mid-run handshake test returned `429 rate_limited` because I had just fired
40 redeem attempts myself. That is my test artifact and the limiter behaving correctly — I waited
out the window and re-ran clean. Flagging it so the number is not misread as a defect.

### 7.5 Release mechanics — all PASS

| Check | Result |
|---|---|
| `git diff ddcd221..origin/main -- index.html sw.js` | **Empty** — still untouched |
| `bash ./release_check.sh` | **exit 0** |
| Local clone vs `origin/main` | tree `53173192d6ac7bc7ab39784646c38a16c4139bb3` — **identical** |
| Deployed commit | `dpl_AcAMAKDqDxcca44PKMXsXSuBUXhr` = **`b197280`** = `origin/main` HEAD, `READY` |
| `node test/ids.test.mjs` | ALL CHECKS GREEN |
| `SYNC_API_BASE` | still `''` — nothing reaches users |

### 7.6 R1–R5 status

| | Requirement | Status |
|---|---|---|
| **R1** | Fix PM-F1 | ✅ **Done and verified** (§7.2, §7.3) |
| **R2** | Independent Zero Day Auditor pass over the fix round | ❌ **Not done** — acknowledged, not concealed |
| **R3** | Re-run the audit's previously-*passing* tests | ✅ Done — the new-record race (audit test RB) was re-run, which is exactly the test whose regression I caught |
| **R4** | Write the re-verification down; correct "33/33" | ⚠️ **Partial** — this report is now the artifact, but `README.md` and `REQUESTS.md` still assert the unsupported "33/33 checks" line |
| **R5** | PM-F2…PM-F5 | ⚠️ **Partial** — PM-F2 and PM-F3 logged in `BACKLOG.md` (I read `b197280`; both entries are accurate and appropriately scoped, and the PM-F3 entry correctly re-frames the latency item as *what stops a hard failure at scale* rather than a nicety). PM-F4 and PM-F5 not addressed and not logged |

**On deliberately keeping PM-F2/PM-F3 out of the fix commit: that was the right call, and I want it
on record as right.** A High-severity fix that can be re-verified in isolation is worth far more
than a tidy branch. It is also what let me diff 29 lines instead of several hundred and be
confident about what I was signing. Do this again.

**On carrying PM-P1 to Aaron rather than quietly closing it: also right.** `TEAM.md` is Aaron's
document; only Aaron can waive one of his own gates. Raising it is the correct move and the
opposite of what happened on 2026-08-08.

## 8. FINAL VERDICT

# ❌ NEEDS ANOTHER LOOP — one requirement only

**PM-F1 is fully closed. This is not a re-litigation of the code.** The fix is correct, it is
better than what I asked for, and I verified it at every concurrency level that broke it plus the
inverse-defect probes I was asked to construct. If PM-F1 were the only open item I would sign off
without hesitation.

**The single blocker is R2: the mandatory Zero Day Auditor gate has still never run on this code.**

**Tier: this is no longer the functional-tier restart.** Nothing is broken. This is the completion
of a gate that was skipped — the Auditor half of the loop `TEAM.md`'s restart rule required, and
which my round-1 report demanded as R2.

Why I am not waiving it, given how good this round was:

1. **`TEAM.md` does not let me.** The Auditor and the PM are *two* independent gates, and the
   chain-of-command section exists specifically to stop one pass being re-labelled as another:
   *"PM sign-off is a real independent check, not the Lead Developer re-labeling its own pass."* My
   testing is PM-shaped — does it match the ask, is the evidence real, do the mechanics hold. It is
   **not** a line-by-line audit of the blast radius, and I should not be counted as one.
2. **The empirical case is not theoretical.** ~1,918 lines of security-critical code have never had
   an independent review. The one time anyone independent looked — me, doing spot-checks — a
   High-severity regression fell out inside an hour. That is evidence about what a *deeper* pass
   would find, not reassurance.
3. **Waiting costs nothing.** `SYNC_API_BASE` is `''`; no user is exposed; Aaron's only open item
   (installing the APK) is unrelated and unblocked. There is no deadline pressure to trade against.
4. **This is a medication tracker for cancer patients.** Aaron's own words are the standard:
   *"things can't be missed bc this is peoples lives at stake."*

**To clear this gate:**

- **R2 (blocking).** Spawn an independent Zero Day Auditor over the *cumulative* current state of
  `sync-backend/` — not just `f8d1a25`. The never-audited surface is `_lib/ids.js`, `_lib/guard.js`,
  `_lib/auth.js`, the rewritten `_lib/blob.js`, and all seven rewritten endpoints. Priority order:
  the `auth.js` write-token model (new security primitive, no Developer brief), then `guard.js`'s
  limiter and body handling, then the pairing endpoints' expiry/delete paths — including the timed
  E1–E8 expiry cases, which remain code-verified only and which nobody has re-run live.
- **R4 (blocking, trivial).** Delete or correct the "33/33 checks" sentence in `README.md` and
  `REQUESTS.md`. It is unsupported and, as written during round 1, was untrue. Cite this report
  instead. Also fix `HANDOFF.md:3` ("current as of app-v51").
- **R5 (non-blocking).** Log PM-F4 and PM-F5 in `BACKLOG.md`.

If the Auditor pass comes back clean, this is ready for Aaron and I do not need to see it a third
time for the code — a one-line addendum here is enough.

**One more, and it is not the Lead Developer's fault.** Between round 1 and round 2 my round-1
report — an untracked file in `outputs/` — was **destroyed by a working-tree reset** when the local
clone was brought up to `origin/main`. I had to reconstruct it from scratch. That is a live
recurrence of the exact 2026-08-06 incident `APP_CLAUDE.md` rule 8 was written for
(*"a local working-tree revert... wiped an in-progress feature build before it was committed"*).
I have now committed this report locally. **Suggested rule-8 amendment: role reports written to
`outputs/` get committed locally the moment they are written, before any further git operation** —
right now the rule is worded around in-progress *code*, and a gate report is exactly as
losable and takes as long to rebuild.

---

## 9. Plain-language summary for Aaron

> **Short version: the problem I found is properly fixed. One process step is still outstanding, and
> I'd like your call on it.**
>
> **Nothing on your phone changed.** The app itself wasn't touched — not one line, across any of
> this. No new version, no reinstall. The APK you haven't installed yet is still the right one, and
> that's still the only thing waiting on you. It's unrelated to everything below.
>
> **The thing that was stuck is unstuck.** Those three setup steps in Vercel that had been sitting
> on your plate are done — done in your browser rather than handed back to you. The service that
> will power "share with a caregiver" is live and running. That was the job you asked for, and it's
> finished.
>
> **We checked it properly, and that was worth doing.** Before building the sharing screens on top,
> the service went through the independent security review your process requires. It found **eight
> serious problems**, two severe. The worst: a stranger could have tricked the service into reading
> out other people's sharing codes — the codes two phones use to connect. With a code, they could
> have joined someone's account. **Nobody could have been affected** — this service isn't connected
> to the app yet and has never held anyone's real information. Problems found before anything is
> plugged in are the cheap kind.
>
> **Those eight were fixed. I checked them myself rather than taking anyone's word, and then I found
> a ninth.** When two phones sent the same thing at the same moment — for the *first* time — the
> second phone was told *"the server broke"* instead of *"someone else just changed this."* That
> sounds like wording. It isn't: the second phone throws the change away instead of sorting it out.
> And the moment it would happen most is the very first time two people connect their phones —
> exactly when you'd want it to go smoothly.
>
> **That's now fixed, and I hammered it.** I re-ran the exact tests that broke it, then harder ones
> — 150 simultaneous sends. Previously 36 out of 36 failed. Now: zero failures, and every single one
> correctly says "someone else changed this" with the details needed to sort it out. I also
> deliberately tried to break it the *other* way — tricking it into crying "conflict" when something
> had genuinely gone wrong — and couldn't. The fix is a good one; it's built so it can't break again
> the same way.
>
> **What I'm still holding, and why I want your input.** Your process says every code change gets
> two independent checks: a security review, and me. The security review looked at the *original*
> version. The repairs afterwards were big — close to a rebuild — and **only I have looked at them.**
> I'm a different kind of check: I test whether claims hold up, not line-by-line security. And the
> one time someone independent did look, a real bug fell out within the hour. That's the argument
> for running the security review once more, not against it.
>
> **So: I'm asking for one more security review before this is called done.** It costs nothing to
> wait — nothing is switched on, nobody's data is involved, and you aren't blocked. If you'd rather
> accept it as-is, that's genuinely your call to make and I'll note your decision. But I'm not
> comfortable waving it through on my own, because that's exactly the shortcut you told us to stop
> taking on the 8th.
>
> **Credit where it's due:** the developer fixed my finding fast, kept the fix small enough for me
> to verify cleanly, wrote the leftovers into the notes honestly, and chose to raise this process
> question with you rather than quietly close it. That's the process working the way you asked.
>
> **What's on you:** nothing new — just the APK when you get a chance, plus a yes/no on the extra
> review above.
>
> **What's next:** that review, then the actual "Share this profile" / "Join a shared profile"
> screens. Two small details changed that those screens need building around; both are written down
> properly for whoever picks it up.

---

## 10. Sign-off

**NOT SIGNED OFF — blocked on R2 only** (independent Zero Day Auditor pass over the current
`sync-backend/`), plus the trivial R4 doc correction. PM-F1 is closed; PM-F2/PM-F3 are logged and
accurate; PM-F4/PM-F5 remain open and non-blocking.

The code in this round is good work: the fix is more robust than the one I specified, the commit
was scoped so it could be verified cleanly, and the reasoning is written down where the next reader
will find it. My refusal is about a gate that has not run, not about the work in front of me.

— Project Manager, 2026-08-09
