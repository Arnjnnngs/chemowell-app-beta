# Zero Day Auditor — sync-backend provisioning + private-Blob rewrite

**Scope:** `sync-backend/` at `origin/main` (`16e1480` "private Blob store access + origin-fresh reads",
`f27a0d8` "pin @vercel/blob, add lockfile"), diffed against `ddcd221`.
**Live target:** `https://chemowell-sync.vercel.app` (Vercel project `chemowell-sync`, prod deployment
`dpl_74bmZSRTLEgNjUVnZzT1YUt9gsaF`, Blob store `store_ShEjIKQ4b4ymxc8U`).
**Auditor:** independent pass per `TEAM.md` stage 3 / `APP_CLAUDE.md` rule 5. Nothing was fixed here.
**Method:** line-by-line read of all 9 files under `sync-backend/`, `@vercel/blob@2.7.0` source/type
inspection in a scratch install, and ~1,400 real HTTP requests against the live deployment driven from
Chrome (`fetch()`), including concurrency races, brute-force rate probes, traversal probes, a 1,131-record
scale test, and a real 10-minute clock wait for expiry behaviour.

> **Context that shapes severity:** `index.html:338` still has `const SYNC_API_BASE = '';` — the app is
> **not** wired to this backend yet, and `syncApiReady()` gates every call. So none of the findings below
> are reaching a real patient today. All of them are blocking for the moment `SYNC_API_BASE` is filled in.

---

## Verdict on the five numbered claims

| # | Lead Developer's claim | Auditor verdict |
|---|---|---|
| 1 | "The compare-and-swap is now sound." | **PARTIALLY REFUTED.** Atomicity holds — 0 double-writes in 118 concurrent pushes. But **~30–37% of the losing writers get HTTP 500, not the 409 the design requires**, so the client's conflict path never runs. See F-01. Additionally the CAS's own invariant (`newVersion = baseVersion + 1`) is not enforced at all — the server accepted `newVersion:-99` and `newVersion:1.5`. See F-05. |
| 2 | "The old read path had a latent staleness bug." | **CONCLUSION CONFIRMED, STATED MECHANISM REFUTED.** The old path really was unsound and the rewrite is the right call — but not for the reason written in the code comment. The old etag came from `head()`, which is an origin API call and was *never* stale. The bug was a **fresh etag paired with a stale body**, which is strictly worse than "both stale" (both-stale would have failed safely with a 412). The comment at `blob.js:42-49` will mislead the next reader. See F-09. |
| 3 | "Reads are origin-fresh; a write is immediately visible on the next pull." | **CONFIRMED.** 30/30 consecutive write→read cycles on one stable pathname returned the just-written value and version. 0 stale reads. |
| 4 | "The private store is a real second layer." | **CONFIRMED — now actually proven, not inferred from the dashboard label.** Unauthenticated `GET` of a real private blob URL returns **HTTP 403 Forbidden**. See the T-4x rows for the controls that rule out a false positive. |
| 5 | "No regression in the pairing handshake." | **REFUTED.** The happy path and three negative paths are correct, but expiry is enforced in exactly one place out of three, and `upload-key` is not single-use. See F-03, F-04. |

**Could not test:** nothing material was blocked. Two items are reasoned-only rather than executed and are
labelled as such: the `pair-code` collision path (F-11, cannot force a 1-in-900k collision on demand) and
whether Vercel's log drains record the full query string (the MCP log view shows path only — F-14).

---

## Findings

Severity ladder: **Critical** = breaks the zero-knowledge promise or loses patient data.
**High** = data integrity/availability. **Medium** = wrong behaviour under realistic conditions.
**Low / Informational** = hygiene.

### F-01 — Concurrent pushes return 500 instead of 409, so conflict resolution never runs — **HIGH**

**Location:** `sync-backend/api/profile/push.js:65-72` (and the same shape at `redeem.js:42-45`,
`upload-key.js:31-34`).

The code only translates `BlobPreconditionFailedError` into a 409. Vercel Blob has **two** distinct
conditional-write failures, and only one of them is that class:

- `precondition_failed` → `BlobPreconditionFailedError` → correctly mapped to 409.
- a **second** failure, returned when two conditional writes collide inside the object store, arrives as a
  plain `BlobError` with message `Vercel Blob: The conditional request cannot succeed due to a conflicting
  operation against this resource.` (`@vercel/blob@2.7.0` `getBlobError()`, `dist/chunk-OYCIHDFF.js:642+`
  — this message falls through the `switch` to the `bad_request`/default arm, *not* to
  `precondition_failed`). `push.js:71` rethrows it, the outer `catch` turns it into **500 server_error**.

**Repro (live, reproducible on every run):**
1. `POST /api/profile/push` with `baseVersion:0, newVersion:1` to seed a record.
2. Fire N pushes in parallel, all with `baseVersion:1, newVersion:2`, different `ciphertext`.

| Test | Result |
|---|---|
| 10 rounds × 8 concurrent | 200 = **10**, 409 = **44**, 500 = **26** (37% of losers got 500), two-winners = **0** |
| 20 rounds × 2 concurrent (the real product scenario: patient + one caregiver) | 200 = **20**, 409 = **14**, 500 = **6** (30% of losers got 500), two-winners = **0** |

Example 500 body: `{"error":"server_error","detail":"Vercel Blob: The conditional request cannot succeed
due to a conflicting operation against this resource."}` — note there is **no `current` field**, which is
exactly what `SYNC_DEVELOPER_BRIEF_v2.md` §3 step 3 requires the server to return and what §3 step 4's
decrypt-and-compare needs. The client (`index.html:341-356`) turns this into `Error('server_error')` with
`status 500`, indistinguishable from the backend being down.

**Why it matters:** the losing device's edit is dropped and the app is told "server error," so it will
retry-or-give-up instead of running detect-and-hold. On a medication record that is a silently discarded
dose/schedule edit. This is the "fail closed but silent" class from the app-v47→v50 incident.

**Correct behaviour:** map *any* conditional-write conflict to 409 with `current` populated — i.e. catch
`BlobPreconditionFailedError` **or** an error whose message indicates a conflicting operation, re-read, and
return `{error:'conflict', current}`. Safer still: treat any non-2xx write failure by re-reading and
returning 409 only when the stored version actually moved, and 503 otherwise.

### F-02 — Unauthenticated arbitrary-blob read oracle via path traversal in `token`/`recordId` — **CRITICAL**

**Location:** `sync-backend/api/profile/push.js:27` (`` `profile/${token}/${recordId}.json` ``),
`api/profile/pull.js:17`, `api/pair/status.js:16`. No endpoint validates or normalises the
caller-controlled path segments.

`@vercel/blob`'s `get()` fetches `https://<store>.private.blob.vercel-storage.com/<pathname>` directly, so
the **URL parser normalises `..` segments before the request is sent**. `put()` sends the pathname as an API
parameter and does *not* normalise. Net effect: **reads escape the `profile/` namespace, writes do not.**

**Repro — leaking another user's live pairing session, unauthenticated:**
```
POST /api/profile/push
{"token":"..","recordId":"pair/sessmsl2o0l2xxjfohy3","kind":"med",
 "baseVersion":12345,"newVersion":1,"ciphertext":"c","iv":"i","deviceId":"d"}
```
→ `HTTP 409` with:
```json
{"error":"conflict","current":{"sessionId":"sessmsl2o0l2xxjfohy3","code":"290092",
 "profileToken":"profmsl2o0l2kxriv4cv","inviterPublicKey":"AGING2_INVITER_PUB",
 "joinerPublicKey":"AGING2_JOINER_PUB","wrappedKey":null,
 "createdAt":1786235784950,"expiresAt":1786236384950}}
```
The deliberately-wrong `baseVersion` makes `push.js:52` fail, and `push.js:54` echoes the **entire stored
object** back as `current`. That object is a pairing session the caller never created, and it contains the
**live 6-digit pairing code**.

Also confirmed:
- `recordId:"pair-code/437479"` → `409 current={"sessionId":"sessmsl2o0dcw314jhyh","expiresAt":...}` — maps
  any 6-digit code to its sessionId.
- `GET /api/pair/status?session=../profile/<token>/rec1` → **HTTP 200** `{"expired":false}` — `status.js` is
  an existence oracle for any blob in the store.
- `POST /api/profile/push` with `token:"../pair"` → `200`, but the blob lands at the literal
  un-normalised key `profile/../pair/<id>.json` and is unreadable/undeletable afterwards (verified: reading
  it back through either traversal form returns `current:null`). So this is a storage leak, not a
  cross-namespace overwrite.

**Attack chain (this is why it's Critical, not High):** combined with F-03 (no rate limiting, measured at
**270 req/s**) an attacker can walk `pair-code/000000…999999` through this oracle — the whole space in
~55 minutes single-threaded, and `pair-code` blobs are **never deleted** (F-06), so every session ever
created is discoverable. Each hit yields a sessionId; reading `pair/<sessionId>.json` yields that session's
code, `profileToken`, and (once uploaded) the `wrappedKey`. Redeeming a live code before the real device
makes the attacker the joiner, and the inviting device then wraps **K** to the attacker's ECDH public key
per §2.2 step 5 — full plaintext compromise of the profile. The read oracle is also *silent*: unlike
brute-forcing `redeem`, it does not consume the code, so the legitimate pairing still succeeds and nothing
looks wrong to the user.

**Correct behaviour:** validate `token`, `recordId` and `session` against a strict allowlist
(`/^[A-Za-z0-9_-]{1,64}$/`) and reject anything else with 400 before any storage call. Separately, `current`
should be built from a whitelist of expected fields (`recordId`, `kind`, `version`, `updatedAt`,
`lastWriterDevice`, `ciphertext`, `iv`) rather than echoing the raw stored object.

### F-03 — No rate limiting anywhere; the 6-digit code is brute-forceable inside its own window — **CRITICAL**

**Location:** every handler; nothing implements throttling. `api/pair/create.js:9-13`.

`SYNC_DEVELOPER_BRIEF_v2.md` §2.2 explicitly bases its security argument on "the 6-digit code's ~10-minute,
single-use, **rate-limited** window." The rate-limited part was never built.

**Measured live:** 300 `POST /api/pair/redeem` attempts with random codes completed in **1.1 s** from a
single browser tab = **270.7 req/s**, tally `{"404 code_not_found": 300}`. No 429, no backoff, no lockout,
no per-IP counter. At that rate one client covers ~162,000 codes in the 10-minute window = **18% of the
900,000-code space per session**, and the full space in ~55 minutes. Trivially parallelised.

A successful guess makes the attacker the joiner; the inviting device then wraps K to them. The legitimate
device gets `409 code_already_redeemed`, which is a detection signal but not a prevention.

**Correct behaviour:** per-IP and per-session attempt limiting on `redeem` (e.g. 5 attempts per code,
then burn the session), and a global limiter on `create`/`push`/`pull`. Widening the code (8+ digits or
alphanumeric) helps but does not substitute for the limiter.

### F-04 — Expiry is enforced in one place out of three; `upload-key` is not single-use — **HIGH**

**Location:** `api/pair/upload-key.js` (no `expiresAt` check at all), `api/pair/status.js:26`
(advisory flag only), `api/pair/redeem.js:21` (the only real check, and it reads `expiresAt` from the
`pair-code` blob, never from the session blob).

**Repro (real 10-minute clock wait, session `sessmsl2o0l2xxjfohy3`, `expiresAt=1786236384950`):**

| # | Step | Result |
|---|---|---|
| E1 | `GET /api/pair/status` at `now=1786236423602` (past expiry) | `HTTP 200`, `expired:true`, **still returns** `inviterPublicKey`, `joinerPublicKey` and the full `wrappedKey` |
| E2 | `POST /api/pair/upload-key` on the expired session | **`HTTP 200 {"ok":true}`** — key accepted after expiry |
| E3 | `GET /api/pair/status` again | `wrappedKey:{"ciphertext":"UPLOADED_LONG_AFTER_EXPIRY","iv":"IV2"}` |
| E4 | `POST /api/pair/upload-key` a **second** time on an already-keyed session | `HTTP 200 {"ok":true}`; a follow-up `status` shows `wrappedKey:{"ciphertext":"ATTACKER_OVERWROTE","iv":"ZZZ"}` |
| E5 | `POST /api/pair/redeem` with an **expired, never-redeemed** code (second 10-min wait) | `HTTP 410 code_expired` — the one place expiry *is* enforced, correctly |
| E7 | `POST /api/pair/upload-key` on a second, independent expired session | `HTTP 200 {"ok":true}` — E2 reconfirmed, not a one-off |

E4 is the non-expiry half: anyone who knows a `sessionId` can overwrite the wrapped key at will. They
cannot *forge* a valid wrap (they have neither ECDH private key), so this is denial-of-pairing rather than
key compromise — the joining device unwraps garbage and the handshake fails with no useful error. Combined
with F-02's ability to read arbitrary `pair/<sessionId>.json`, sessionIds are not secret.

Because blobs are never deleted (F-06), an expired-but-redeemed session stays fully live forever: the
`wrappedKey` remains retrievable by anyone with the sessionId, indefinitely. The code comment at
`create.js:11` ("~10-minute single-use window limits how much a guess-the-code attack can accomplish") is
not true of the two endpoints that actually carry the wrapped key.

**Correct behaviour:** check `expiresAt` in `upload-key` (410 when past) and in `status` (stop returning
key material once expired, not just flag it); reject a second `upload-key` when `wrappedKey` is already
set (409); and delete the session + code blobs once the handshake completes.

### F-05 — `newVersion` is unvalidated, so one bad client can permanently wedge a record — **HIGH**

**Location:** `api/profile/push.js:17-21` — the only check is `typeof newVersion === 'number'`.
`SYNC_DEVELOPER_BRIEF_v2.md` §3 step 2 specifies `newVersion: baseVersion + 1`; nothing enforces it.

**Repro:**

| Test | Sent | Result |
|---|---|---|
| C8 | `baseVersion:2, newVersion:-99` | `HTTP 200`, stored `version:-99` |
| C9 | `baseVersion:-99, newVersion:1.5` | `HTTP 200`, stored `version:1.5` |

Once a record's version is `1.5` or `-99` (or `Number.MAX_SAFE_INTEGER`), every well-behaved device that
knows the record at version `n` sends `baseVersion:n` and gets a permanent 409 — the record can never be
updated again from a legitimate device, and (per F-01/F-02) that 409's `current` is the only escape hatch.
`NaN`/`Infinity` pass `typeof === 'number'` too.

**Correct behaviour:** require `Number.isInteger(baseVersion) && Number.isInteger(newVersion) &&
newVersion === baseVersion + 1 && baseVersion >= 0`, 400 otherwise.

### F-06 — Nothing is ever deleted; storage and the code space grow without bound — **MEDIUM**

**Location:** whole backend. `grep -rn "del(" sync-backend/api/` returns only a code comment. No TTL job,
no cleanup endpoint, no `del()` import.

Every `pair/<sessionId>.json` and `pair-code/<code>.json` ever created persists forever, as does every
record blob for every `profileToken` ever used — including tokens from abandoned pairings. The brief itself
called for this ("deletable once redeemed — recommend a TTL cleanup job", §2.2) and it wasn't built.

Consequences: (a) the 900,000-code namespace fills monotonically, so a brute-forcer's hit rate against
`pair-code/` rises over time and old sessions' `wrappedKey`s stay readable forever (F-04); (b) unbounded
Vercel Blob storage cost with no ceiling; (c) F-02's traversal writes deposit permanently unreachable
orphan blobs.

### F-07 — `pull` silently truncates at 1,000 records and returns HTTP 200 — **HIGH**

**Location:** `sync-backend/api/_lib/blob.js:76` — `const { blobs } = await list({ prefix });`.
`@vercel/blob@2.7.0`'s `list()` defaults to `limit: 1000` and returns `hasMore` + `cursor`
(`dist/index.d.ts:261-309`). `listJson` destructures neither and never pages.

**Repro (live):** pushed 1,131 records under one profile token, then `GET /api/profile/pull?token=…`:

```
HTTP 200 — records returned: 1000 — elapsed 36,645 ms — 131 stored records missing
missing ids (sample): r9, r89, r90, r91, r92 … r995, r996, r997, r998, r999
```

No error, no `hasMore` flag, no truncation marker. The caregiver's device would render a profile that is
silently missing 131 medication/entry records and would have no way to know. For a medication tracker this
is the worst shape a bug can take — it looks like success.

A patient logging doses and symptoms a few times a day reaches 1,000 records in roughly a year, so this is
a "when," not an "if."

**Correct behaviour:** loop on `cursor` while `hasMore`, or (better) return a paged/delta response and have
the client page it. Whatever the shape, an incomplete result must never be a bare 200.

### F-08 — `pull` is O(n) sequential origin reads; 36 s at 1,131 records on a ~45 s poll loop — **MEDIUM**

**Location:** `blob.js:75-84` — a `for` loop with `await getJson(...)` per blob, each an authenticated
origin round-trip with `cache=0`.

**Measured live:**

| records | pull latency |
|---|---|
| 10 | 516 ms |
| 25 | 918 ms |
| 50 | 1,818 ms |
| 100 | 4,755 ms |
| 150 | 7,069 ms |
| 200 | 7,169 ms |
| 250 | 9,351 ms |
| 300 | 11,163 ms |
| ~1,131 (capped at 1,000) | **36,645 ms** |

~37 ms/record, linear. The brief's design polls every ~45 s; at 1,000 records a single poll occupies 36 s
of function time, per device. That is a cost problem, a battery problem, and a hard wall the moment
`maxDuration` is anything under ~40 s. The comment at `blob.js:70-74` ("dozens to low hundreds of records")
understates the real trajectory of a daily-logging app.

**Correct behaviour:** bounded-concurrency fan-out (e.g. 10 at a time) at minimum; a delta-since-version
endpoint properly.

### F-09 — `getJson`'s not-found branch is dead code, and its regex is a live fail-silent hazard — **MEDIUM**

**Location:** `sync-backend/api/_lib/blob.js:54-64`.

```js
if (e && (e.name === 'BlobNotFoundError' || /not.?found/i.test(String(e.message || '')))) {
  return null;
}
```

Verified against the real `@vercel/blob@2.7.0` in a scratch install:

```
BlobNotFoundError      | e.name = "Error" | msg = "Vercel Blob: The requested blob does not exist"
BlobStoreNotFoundError | e.name = "Error" | msg = "Vercel Blob: This store does not exist."
BlobAccessError        | e.name = "Error" | msg = "Vercel Blob: Access denied, please provide a valid token…"
/not.?found/i on each  | false | false | false
```

The SDK's error classes never set `.name` (they extend `BlobError` and inherit `"Error"`), and the
not-found message says "does not exist", not "not found". **Both halves of the condition are unreachable
for every error this SDK actually throws.** The block does no harm today only because `get()` returns
`null` (not a throw) for a 404 (`dist/index.js:175-177`), which the `!result` check at `blob.js:65`
already handles. But the safety property the comment asserts — "a not-found can also surface as a thrown
`BlobNotFoundError`… both collapse to null" — is simply false, and the next person to touch this will
believe it.

On the "is the regex too broad?" question you asked: it is too broad **and** too narrow at the same time.
Too narrow, as above. Too broad because `/not.?found/i` matches `ENOTFOUND` — so if a DNS/socket error ever
surfaces with its underlying message rather than undici's `"fetch failed"` wrapper (a Node-version- and
proxy-dependent detail), a real outage would be read as "empty store." I could not make that fire on the
live deployment (undici masks it as `fetch failed`, which correctly rethrows → 500), so I am recording it
as an unproven-but-real latent hazard, not a confirmed defect.

Worth noting what a "empty store" misread would cost if it ever did fire: `pull` returns `{"records":[]}`
with HTTP 200 — the caregiver's device sees an empty profile and cannot tell that from a real empty
profile.

**Correct behaviour:** drop the regex; test `e instanceof BlobNotFoundError` (the class is exported) or
just delete the branch, since `get()` already returns `null`.

### F-10 — The first-push catch swallows *every* error and reports it as a conflict — **MEDIUM**

**Location:** `sync-backend/api/profile/push.js:43-47`.

```js
} catch (e) {
  const raced = await getJson(pathname);
  res.status(409).json({ error: 'conflict', current: raced ? raced.data : null });
  return;
}
```

Any failure of the `allowOverwrite:false` put — store suspended, rate limited, auth failure, network — is
reported to the app as `409 conflict, current:null`. That is the mirror image of F-01: F-01 reports a real
conflict as an outage, F-10 reports a real outage as a conflict. The client will run its conflict logic
against `current:null` and conclude the record is brand new.

The new-record race path itself is correct — 8 rounds × 8 concurrent creates gave 200=1 / 409=7 every
single round, with `current` populated, 0 double-creates. The defect is purely the blanket catch.

**Correct behaviour:** only convert a genuine already-exists/precondition failure into 409; rethrow
everything else so it surfaces as 5xx.

### F-11 — `pair-code` blobs are written with `allowOverwrite:true`, so a code collision hijacks the older session — **LOW**

**Location:** `api/pair/create.js:46` + `blob.js:32` (`allowOverwrite: true` is the `putJson` default and
`create.js` passes no opts).

If `randomCode()` returns a code already mapped to a live session, the newer `create` silently overwrites
`pair-code/<code>.json`. The older inviter's device polls `status` forever, and anyone typing the older
code joins the **newer** session and is handed the wrong `profileToken`. With 900k codes and 10-minute
windows this is rare at Aaron's scale, but F-06 means the blob is never cleaned up, and F-03's brute-force
exposure is what makes the small namespace matter.

*Reasoned from code, not executed* — a collision cannot be forced on demand.

### F-12 — `putJson`'s option spread can override `access` and `addRandomSuffix` — **LOW (latent)**

**Location:** `sync-backend/api/_lib/blob.js:27-35` — `...(opts || {})` is spread **after** `access`,
`addRandomSuffix`, `contentType` and `allowOverwrite`, so a caller's `opts` wins.

No current caller passes `access` or `addRandomSuffix` (callers pass only `{ifMatch}` or
`{allowOverwrite:false}`), so this is not exploitable today. It is a real footgun though: an `opts.access:
'public'` would silently undo the privacy layer this whole commit exists to add, and an
`opts.addRandomSuffix: true` would silently break the CAS by writing to a different pathname than the one
`getJson` reads.

Related and worth flagging in the same breath: `@vercel/blob`'s `get()` only honours `useCache:false` when
`access === 'private'` (`dist/index.js:148-152` — `if (options.useCache === false && access === "private")`).
If `ACCESS` at `blob.js:22` were ever flipped back to `'public'`, the origin-freshness guarantee behind
claim 3 would silently vanish with no error and no code change at the call site.

**Correct behaviour:** spread `opts` first and pin `access`/`addRandomSuffix` after it, or allowlist the
options a caller may pass (`ifMatch`, `allowOverwrite`).

### F-13 — Unbounded, unauthenticated writes: 4 MB per record, unlimited records, unlimited tokens — **MEDIUM**

**Location:** `api/profile/push.js:17-25` — no size, count, or shape validation.

**Repro:**

| ciphertext size | result |
|---|---|
| 100 KB | `200` accepted + stored |
| 1 MB | `200` accepted + stored |
| 4 MB | `200` accepted + stored |
| 6 MB | `413 FUNCTION_PAYLOAD_TOO_LARGE` (Vercel platform, not the app) |

Also: `ciphertext`, `iv` and `deviceId` are not type-checked — `{"ciphertext":{"a":1},"iv":["x"],
"deviceId":{"b":2}}` was accepted and stored verbatim (`200`). A 600-character `recordId` and a
`token` of `токен☠️/../x` were both accepted (`200`).

Combined with no rate limiting (F-03) and no cleanup (F-06), anyone can write unbounded data into Aaron's
Blob store for free, and any of it can be an arbitrary JSON structure rather than a ciphertext string.

**Correct behaviour:** cap `ciphertext` length (e.g. 256 KB), require `typeof ciphertext === 'string'` and
`typeof iv === 'string'`, cap `recordId`/`deviceId` length, and enforce the F-02 charset allowlist.

### F-14 — `profileToken` travels in the query string, and `pull` responses are `Cache-Control: public` — **LOW**

**Location:** `api/profile/pull.js:15` (`req.query.token`), `api/pair/status.js:14`, and the client at
`index.html:361`. Observed `pull` response header: `cache-control: public, max-age=0, must-revalidate`
(Vercel's default; no handler sets one).

The brief (§2.2 step 3) deliberately calls the token "not secret, just a lookup ID", so this is not a
violation of the design — but the design and the implementation disagree in one direction that matters:
the token is the **sole gate on writes** (see F-15), which makes it a credential in practice regardless of
what the brief calls it. Credentials in URLs land in access logs, proxy logs and browser history.
Separately, `public` on a response body containing a whole profile's ciphertext permits shared caches to
store it; `must-revalidate, max-age=0` means it will always revalidate, so this is posture rather than a
correctness bug.

*Partly untested:* Vercel's runtime-log view via MCP shows path only (`GET /api/profile/pull 200`), so I
could not confirm whether a log drain would capture the query string. Flagging rather than asserting.

**Correct behaviour:** move the token to an `Authorization` header (or POST body) and set
`Cache-Control: no-store` on `pull` and `status`.

### F-15 — Anyone holding a `profileToken` can destructively overwrite any record — **HIGH**

**Location:** `api/profile/push.js` — there is no authentication of any kind; the token is the only thing
identifying the caller.

**Repro:** `GET /api/profile/pull?token=<tok>` to read the current `version` of a record, then
`POST /api/profile/push` with that `baseVersion` and arbitrary `ciphertext`:

```
before: rec1 = "CT_FLOAT" @ v1.5
POST push {token, recordId:"rec1", baseVersion:1.5, newVersion:2.5, ciphertext:"DESTROYED_BY_THIRD_PARTY"}
→ 200, stored ciphertext = "DESTROYED_BY_THIRD_PARTY"
```

Because the value is E2E-encrypted, a third party cannot *read* patient data this way — the zero-knowledge
property holds. But they can permanently destroy it: the ciphertext becomes undecryptable garbage, and the
app's own decrypt-fails-closed behaviour means the medication record simply stops rendering. Any device that
has already discarded its local copy has lost it.

This is a genuine hole rather than an accepted design tradeoff: the brief's "not secret" framing was written
about the token's role as a **lookup id for reads**, and §2.2's threat discussion never considers an
unauthenticated write path. Relatedly, `POST /api/pair/create` accepts an arbitrary caller-supplied
`profileToken` and issues a pairing session bound to it (verified: `200`, `profileToken` echoed back
unchanged) — harmless on its own, since the attacker still cannot produce a valid wrap of K, but it means
tokens are freely assertable.

**Correct behaviour:** derive a write credential from the pairing handshake (e.g. an HMAC over the record
using K, or a per-profile write secret established at pair time) so that possession of the lookup token
alone does not authorise writes. At minimum this needs an explicit decision recorded, not silence.

### F-16 — Security-relevant randomness comes from `Math.random()` — **HIGH**

**Location:** `sync-backend/api/_lib/cors.js:20` (`randomId` → `sessionId`, `profileToken`) and
`api/pair/create.js:12` (`randomCode` → the 6-digit pairing code).

`Math.random()` is not a CSPRNG. V8 implements it as xorshift128+, whose internal state can be recovered
from a small number of consecutive outputs, after which all past and future outputs from that isolate are
predictable.

This backend hands an attacker exactly that oracle: a single `POST /api/pair/create` returns **three
consecutive draws** from the same stream, in a fixed order — `randomId('sess')`, then `randomCode()`, then
(when no `profileToken` is supplied) `randomId('prof')`. An attacker can call `create` repeatedly to
harvest the stream, and any victim `create` that lands on the same warm serverless instance produces a code
the attacker can predict outright rather than brute-force.

Separately, the identifiers are weaker than they look even against blind guessing:
`randomId` = `prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,10)`. The timestamp
half is fully predictable, leaving ~41 bits nominal — e.g. observed `profmsl2o0dc40vzbga6`, where
`msl2o0dc` is just the creation time.

**Correct behaviour:** `crypto.randomInt(100000, 1000000)` for the code and
`crypto.randomBytes(16).toString('base64url')` for ids, from `node:crypto`.

### F-17 — Malformed JSON returns 500, and `detail` echoes raw SDK error text — **LOW**

**Location:** every handler's catch, e.g. `api/pair/create.js:50`.

- `POST /api/pair/create` with body `{not json` → `500 {"error":"server_error","detail":"Invalid JSON"}`.
  A client mistake should be a 400.
- The `detail` field passes raw `@vercel/blob` messages to the caller (e.g. *"Vercel Blob: The conditional
  request cannot succeed…"*). No secret leaked in anything I could produce, but it advertises the storage
  backend and its failure modes to an unauthenticated caller.

### F-18 — `api/health.js` has no method guard — **INFORMATIONAL**

`POST /api/health` returns `200 {"ok":true,…}`. Every other endpoint 405s on the wrong method. Harmless,
but inconsistent.

---

## Areas checked where I found nothing wrong

Stating these plainly rather than padding:

- **`APP_CLAUDE.md` Hard Rule 1 — plaintext patient data or the key.** Clean. `grep -rn "console\.|process\.env|log("`
  over `sync-backend/api/` returns **zero** matches — there is no logging of any kind, so nothing can be
  logged. Every field the server touches is `ciphertext`, `iv`, an opaque id, an integer or a timestamp; no
  handler parses, inspects or branches on record content. The pairing endpoints handle only ECDH **public**
  keys and an AES-GCM-wrapped K the server cannot unwrap. Vercel runtime logs for the audit window contain
  only request lines (`POST /api/pair/redeem 404`), no application output. The zero-knowledge property is
  intact as built.
- **Compare-and-swap atomicity.** 118 concurrent pushes across 38 rounds; **never** two winners, and the
  stored value always matched the single 200 response's ciphertext and version. The `ifMatch` and
  `allowOverwrite:false` primitives do what the design says. (The *error reporting* around them is F-01.)
- **New-record race path.** 8 rounds × 8 concurrent creates: 200=1 / 409=7 every round, `current` populated,
  no duplicates.
- **Read-after-write freshness.** 30/30 cycles correct; the `useCache:false` change works as claimed.
- **Pairing happy path and the three negative paths you named.** `upload-key` before a joiner exists →
  `400 no_joiner_yet`. Replayed redeem → `409 code_already_redeemed`. Missing/short bodies → `400` with a
  specific error key on every endpoint (`publicKey_required`, `code_and_publicKey_required`,
  `sessionId_and_wrappedKey_required`, `missing_fields`, `token_required`, `session_required`). Wrong
  method → `405 method_not_allowed`. `kind` outside `med|entry` → `400 invalid_kind`. Duplicate `?token=`
  params → `400 token_required` (the `typeof === 'string'` check catches the array). All correct.
- **CORS.** `OPTIONS` → `204`, `Access-Control-Allow-Origin: *`, `Methods: GET,POST,OPTIONS`,
  `Headers: Content-Type` on every endpoint including error responses. Correct for a token-in-URL API with
  no cookies.
- **Deployment protection.** Confirmed via the Vercel API: `passwordProtection.enabled=false`,
  `ssoProtection.enabled=false`, `trustedIps.enabled=false` on `prj_2XeK4T90Tw4O9h4n6GYPExGI7r5l`. The
  login wall really is off, as claimed.
- **Dependency pin (`f27a0d8`).** `package.json` `"^2.7.0"`, `package-lock.json` resolves
  `@vercel/blob@2.7.0`, lockfile committed. Moving off `"latest"` is correct and the lockfile matches.
- **Traversal *writes*.** Cannot escape the `profile/` namespace — `put()` stores the literal
  un-normalised pathname (verified both directions). Only reads escape (F-02).
- **`list()` prefix normalisation.** `?token=..` / `?token=../` return `200` with `records: []`; `list()`
  does not normalise dot segments, so `pull` cannot be used to enumerate other namespaces.

---

## Test-case log — one line per case

Format: `ID | case | observed | PASS/FAIL`. "FAIL" = the backend did the wrong thing, not that the test errored.

### Smoke / method / malformed input
| ID | Case | Observed | Verdict |
|---|---|---|---|
| A1 | `GET /api/health` | `200 {"ok":true,"service":"chemowell-sync-backend","time":1786235752570}` | PASS |
| A2 | `POST /api/health` | `200` (no method guard) | FAIL — F-18 |
| A3 | `GET /api/pair/create` | `405 method_not_allowed` | PASS |
| A4 | `POST /api/pair/create` `{}` | `400 publicKey_required` | PASS |
| A5 | `POST /api/pair/create` `{publicKey:12345}` | `400 publicKey_required` | PASS |
| A6 | `POST /api/pair/create` body `{not json` | `500 server_error detail="Invalid JSON"` | FAIL — F-17 |
| A7 | `POST /api/pair/create` no body | `400 publicKey_required` | PASS |
| A8 | `GET /api/pair/status` no param | `400 session_required` | PASS |
| A9 | `GET /api/pair/status?session=sessDOESNOTEXIST` | `404 session_not_found` | PASS |
| A10 | `GET /api/profile/pull` no token | `400 token_required` | PASS |
| A11 | `POST /api/profile/push` `{}` | `400 missing_fields` | PASS |
| A12 | `POST /api/pair/redeem` `{}` | `400 code_and_publicKey_required` | PASS |
| A13 | `POST /api/pair/upload-key` `{}` | `400 sessionId_and_wrappedKey_required` | PASS |
| A14 | `POST /api/pair/upload-key` unknown session | `404 session_not_found` | PASS |
| A15 | `OPTIONS /api/profile/push` | `204`, ACAO `*`, methods `GET,POST,OPTIONS` | PASS |

### Pairing handshake
| ID | Case | Observed | Verdict |
|---|---|---|---|
| P1 | `pair/create` happy path | `200 {sessionId:"sessmsl2nm79ygp8ewpa", code:"157508", expiresAt:1786236366309, profileToken:"profmsl2nm79asme6xar"}` | PASS |
| P2 | `upload-key` **before** a joiner exists | `400 no_joiner_yet` | PASS |
| P3 | `status` pre-redeem | `200 joiner=null wrapped=null expired=false` | PASS |
| P4 | `redeem` with valid code | `200`, returns sessionId + profileToken + inviterPublicKey | PASS |
| P5 | `redeem` replay (same code, 2nd joiner) | `409 code_already_redeemed` | PASS |
| P6 | `upload-key` after joiner exists | `200 {"ok":true}` | PASS |
| P7 | `status` post-upload | `200` with both public keys + wrappedKey | PASS |
| P8 | `upload-key` a **second** time | `200 {"ok":true}` — overwrite allowed | FAIL — F-04 |
| P9 | `status` after 2nd upload | `wrappedKey={"ciphertext":"ATTACKER_OVERWROTE","iv":"ZZZ"}` | FAIL — F-04 |
| E1 | `status` on a session past `expiresAt` (real 10-min wait) | `200 expired=true` but still returns inviterPublicKey, joinerPublicKey, wrappedKey | FAIL — F-04 |
| E2 | `upload-key` on a session past `expiresAt` | `200 {"ok":true}` | FAIL — F-04 |
| E3 | `status` after post-expiry upload | `wrappedKey={"ciphertext":"UPLOADED_LONG_AFTER_EXPIRY","iv":"IV2"}` | FAIL — F-04 |
| E5 | `redeem` an **expired, unredeemed** code (real 10-min wait, `sessmsl30r0r4n04xm7l`) | `410 code_expired` | PASS |
| E6 | `status` on that expired, never-redeemed session | `200 expired=true joinerPublicKey=null` | PASS (advisory only) |
| E7 | `upload-key` on a **second, independent** expired session (`sessmsl30r89ym2im8bk`) | `200 {"ok":true}` — reconfirms F-04 on a fresh session | FAIL — F-04 |
| E8 | `status` on that session afterwards | `expired=true`, `wrappedKey={"ciphertext":"KEY_AFTER_WINDOW_CLOSED","iv":"IV9"}` | FAIL — F-04 |
| T6 | `pair/create` with a caller-supplied existing `profileToken` | `200`, token echoed back unchanged, code issued | FAIL — F-15 |

### Compare-and-swap / conflict
| ID | Case | Observed | Verdict |
|---|---|---|---|
| C1 | New record pushed with `baseVersion:3` | `409 conflict current:null` | PASS |
| C2 | New record `baseVersion:0 → newVersion:1` | `200 version=1` | PASS |
| C3 | Immediate pull after C2 | `200 n=1 ciphertext=["CT_v1"]` | PASS |
| C4 | Stale push `baseVersion:0` when current is 1 | `409 conflict current.version=1` | PASS |
| C5 | Correct push `baseVersion:1 → 2` | `200 version=2` | PASS |
| C6 | Pull after C5 | `["CT_v2@2"]` | PASS |
| C7 | Replay `baseVersion:1` after it moved | `409 conflict` | PASS |
| C8 | `baseVersion:2 → newVersion:-99` | `200`, stored `version:-99` | FAIL — F-05 |
| C9 | `baseVersion:-99 → newVersion:1.5` | `200`, stored `version:1.5` | FAIL — F-05 |
| RA | 10 rounds × 8 concurrent, same baseVersion | 200=10, 409=44, **500=26**, two-winners=0 | FAIL — F-01 (atomicity PASS) |
| RB | 8 rounds × 8 concurrent brand-new-record creates | 200=1 / 409=7 every round, `current` populated, 0 duplicates | PASS |
| R2 | 20 rounds × **2** concurrent (real product scenario) | 200=20, 409=14, **500=6**, two-winners=0 | FAIL — F-01 |
| FR | 30 back-to-back write→read cycles, one stable pathname | 30/30 correct value + version, 0 stale | PASS (claim 3) |

### Scale / DoS / cost
| ID | Case | Observed | Verdict |
|---|---|---|---|
| S1 | Pull latency at 10/25/50/100/150 records | 516 / 918 / 1,818 / 4,755 / 7,069 ms | FAIL — F-08 |
| S2 | Pull latency at 200/250/300 records | 7,169 / 9,351 / 11,163 ms | FAIL — F-08 |
| S3 | Pull with **1,131** records stored | `200`, **1,000 returned, 131 silently missing**, 36,645 ms | FAIL — F-07 |
| S4 | `redeem` brute-force rate, single tab | 300 attempts / 1.1 s = **270.7 req/s**, all `404 code_not_found`, no 429 | FAIL — F-03 |
| S5 | Concurrent push load (25 / 40 / 50 parallel) | 200 = 25 / 40 / 50, no throttling | FAIL — F-03 |
| S6 | Body size 100 KB / 1 MB / 4 MB | all `200` accepted + stored | FAIL — F-13 |
| S7 | Body size 6 MB | `413 FUNCTION_PAYLOAD_TOO_LARGE` (platform, HTML body not JSON) | PASS (platform), F-13 stands |

### Injection / authorization / privacy
| ID | Case | Observed | Verdict |
|---|---|---|---|
| T1 | push `recordId:"../../pair/<sessionId>"` | `409` with `current` = another user's **full pairing session** | FAIL — F-02 |
| T1b | Target session intact afterwards | `200`, `inviterPublicKey:"AGING_INVITER_PUB"` unchanged | PASS (read-only) |
| T2 | push `token:"../pair"` | `200`; blob lands at literal un-normalised key, unreadable afterwards | FAIL — F-02 |
| T3 | pull `token:"../"` / `token:".."` | `200 records:[]` — `list()` does not normalise | PASS |
| T4 | pull with a token **prefix** only | `200 records:[]` — no prefix enumeration | PASS |
| T5 | pull with duplicate `?token=` params | `400 token_required` | PASS |
| T7 | push `kind:"evil"` | `400 invalid_kind` | PASS |
| W3 | push read-oracle on `pair-code/<code>.json` | `409 current={"sessionId":"sessmsl2o0dcw314jhyh","expiresAt":1786236384672}` | FAIL — F-02 |
| W4 | push read-oracle on another user's `pair/<sessionId>.json` | `409 current=` full session incl. **live code `"290092"`**, profileToken, both public keys | FAIL — F-02 |
| D1 | Third-party overwrite of a record using only the token | `200`, stored ciphertext = `"DESTROYED_BY_THIRD_PARTY"` | FAIL — F-15 |
| D2 | `ciphertext:{a:1}`, `iv:["x"]`, `deviceId:{b:2}` | `200`, stored verbatim | FAIL — F-13 |
| D3a | 600-character `recordId` | `200` accepted | FAIL — F-13 |
| D3b | Unicode `token:"токен☠️/../x"`, `recordId:"ünïcødé"` | `200` accepted | FAIL — F-13 |
| D4 | `status?session=../profile/<token>/rec1` | **`200 {"expired":false}`** — existence oracle for any blob | FAIL — F-02 |
| T40 | Unauthenticated GET of an **existing** private blob URL | **`403 Forbidden`** | PASS — proves claim 4 |
| T41 | Same, with `?cache=0` | `403 Forbidden` | PASS |
| T42 | Unauthenticated GET on the `.public.` host for the same store | `403 Forbidden` | PASS |
| T43 | Unauthenticated GET of a **nonexistent** private path | `403 Forbidden` — no existence leak | PASS |
| T44 | Unauthenticated GET of a `pair/<sessionId>.json` blob URL | `403 Forbidden` | PASS |
| T45 | Control: store host root | `400 "Invalid path"` — host resolves, so 403 is a real authz decision, not a dead hostname | PASS |
| T46 | Control: wrong store id in host | `400 "Store ID not found"` — distinguishable from 403 | PASS |
| L1 | Vercel runtime logs, 40-minute window | Request lines only; zero application output; no ciphertext, tokens or codes | PASS |
| L2 | `pull` response cache headers | `cache-control: public, max-age=0, must-revalidate`, ETag present | FAIL — F-14 |
| L3 | Deployment protection settings via Vercel API | password=false, SSO=false, trustedIps=false | PASS |

### Static / SDK verification (scratch install of `@vercel/blob@2.7.0`)
| ID | Case | Observed | Verdict |
|---|---|---|---|
| V1 | `e.name` on every SDK error class | `"Error"` for all — `e.name === 'BlobNotFoundError'` is unreachable | FAIL — F-09 |
| V2 | `/not.?found/i` vs the SDK's actual messages | `false` for BlobNotFound / BlobStoreNotFound / BlobAccess | FAIL — F-09 |
| V3 | `get()` behaviour on 404 | `dist/index.js:175-177` → `return null`, does not throw | PASS |
| V4 | `list()` defaults | `limit: 1000`, returns `hasMore` + `cursor`; `listJson` reads neither | FAIL — F-07 |
| V5 | `head()` transport in the *old* code path | `requestApi()` → control-plane API, i.e. origin-fresh metadata, never CDN | Refutes claim 2's mechanism — F-09/claim 2 |
| V6 | `useCache:false` implementation | `dist/index.js:148-152`, appends `?cache=0` **only when `access==='private'`** | PASS, with F-12 caveat |
| V7 | Conflicting-conditional-write error class | Plain `BlobError`, **not** `BlobPreconditionFailedError` | FAIL — F-01 |
| V8 | Lockfile vs manifest | `package.json ^2.7.0` ↔ lock resolves `2.7.0` | PASS |
| V9 | `grep` for logging in `sync-backend/api/` | zero `console.*`, zero `process.env`, zero `log(` | PASS |
| V10 | `grep` for deletion / TTL | no `del()` import, no cleanup anywhere | FAIL — F-06 |

---

## On claim 2 specifically — where the Lead Developer overstated it

You asked me to say plainly whether the reasoning is right. It is **half right, and the wrong half is the
part written into the source comment**, so it should be corrected rather than left as documentation.

What is right:
- `fetch(url, {cache:'no-store'})` genuinely does not control a CDN. `cache` is a Fetch-API directive about
  the *caller's own* HTTP cache. In the Node/undici runtime a Vercel function actually runs in, there is no
  HTTP cache at all, so the option is closer to a **complete no-op** than to "bypasses the local cache" —
  if anything the Lead Developer was generous to it.
- Vercel Blob's CDN really can serve a stale body for a recently-overwritten pathname, and this backend is
  the textbook case for it: `addRandomSuffix:false` + `allowOverwrite:true` means the *same* URL's content
  changes repeatedly. Moving to `get({useCache:false})` is the correct fix and it demonstrably works (30/30
  in FR).

What is wrong:
- The comment says a cached read "can hand back a stale body **AND its stale etag**… so a caller would…
  write it with an ifMatch that the store still considers valid." Those two halves contradict each other.
  A genuinely stale etag would **fail** the conditional write and produce a safe 412 → 409. Both-stale is
  the harmless case.
- More importantly it is not what the old code did. The old `getJson` took its etag from `head()`, and
  `head()` goes through `requestApi()` to the Blob control-plane API (`@vercel/blob@2.7.0`
  `dist/index.js:62-85`) — **origin metadata, never the CDN**. The etag was always fresh.

So the real old bug was: **fresh etag + stale body**. `getJson` returned `{data: <old version>, etag: <current>}`.
`push.js:52` then compared `baseVersion` against a stale `data.version`, and a device that was genuinely
behind could match it and write successfully with a currently-valid `ifMatch` — clobbering the newer value.
Same conclusion the Lead Developer reached, opposite mechanism, and the mechanism is what a future reader
will act on. `blob.js:42-49` should be rewritten.

---

## Does this read clearly to a non-technical reader?

The question for a backend is: will Aaron (or a patient) ever be shown a confident-looking screen that is
quietly wrong? Three answers, and two of them are no.

**Error codes the app will surface — mostly good, two that lie.** The error keys are genuinely readable and
map cleanly to plain-English copy: `publicKey_required`, `code_not_found`, `code_expired`,
`code_already_redeemed`, `no_joiner_yet`, `session_not_found`, `invalid_kind`, `missing_fields`,
`token_required`. A developer writing user copy has everything needed ("That code has already been used on
another device", "That code has expired — ask for a new one"). Two exceptions:

- **F-01**: a genuine sync conflict is reported as `server_error` / HTTP 500 about 30% of the time. The app
  cannot distinguish that from "the backend is down", so the honest copy it would show is *"Couldn't sync —
  try again"* when the truth is *"this was changed on another device."* Worse, the losing edit is dropped
  with no conflict marker. That is the wrong story told to a caregiver about a medication change.
- **F-10**: the reverse — a real outage on a first push is reported as `conflict`, so the app would show a
  conflict warning for a record nobody else touched.

**A failure that is invisible rather than visible — yes, one, and it is the serious one.** **F-07**: past
1,000 records, `pull` returns HTTP 200 with a *quietly incomplete* list. There is no error, no flag, no
count mismatch the client could check. A caregiver's phone would show a medication list missing entries,
looking exactly like a correct, fully-synced list. This is precisely the failure shape that hid the
app-v47→v50 export regression, and on a medication list the consequence is worse than a broken button.
**F-09**'s latent "empty store" misread has the same shape (`{"records":[]}`, HTTP 200) if it ever fires.

**One piece of internal wording that will mislead the next developer, not the user.** The comment block at
`blob.js:42-49` describes a bug mechanism that is the opposite of the real one (see the claim-2 section),
and `create.js:11` asserts a "~10-minute single-use window" that F-04 shows is not enforced on the two
endpoints that carry the wrapped key. Both read as settled fact. In a repo whose whole process exists
because a wrong assumption went unchallenged, confidently wrong comments are worth fixing at the same time
as the code.

---

## Recommended fix order for the Lead Developer

1. **F-02** (traversal read oracle) and **F-03** (no rate limiting) — together these are a working path to
   the profile key. Nothing else matters until both are closed.
2. **F-07** (silent 1,000-record truncation) — silent data loss on a medication list.
3. **F-01** (500-instead-of-409), **F-15** (unauthenticated destructive writes), **F-16** (`Math.random`),
   **F-04** (expiry / single-use), **F-05** (`newVersion` validation).
4. **F-06**, **F-08**, **F-10**, **F-13**.
5. **F-09**, **F-11**, **F-12**, **F-14**, **F-17**, **F-18**, and the two misleading comments.

Per `TEAM.md`'s restart rule this is a functional/safety-tier miss, so the fixes go back through both
mandatory gates from scratch — not a spot-check.

**Test data left behind:** this audit created roughly 1,500 blobs under `profAUDIT*`, `profSCALE*`,
`pair/sess*` and `pair-code/*` in `chemowell-sync-blob`. Because nothing in this backend can delete
(F-06), they will persist until removed by hand from the Vercel dashboard.
