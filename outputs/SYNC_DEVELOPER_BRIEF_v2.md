# DEV BRIEF — Multi-device / multi-caregiver Sync (v2, pre-implementation, zero-knowledge revision)

Stage: **Developer** (investigation only — no code changed). Repo: `chemowell-app-beta` (APP-BETA).
Supersedes `SYNC_DEVELOPER_BRIEF_v1.md` for §2 (backend), §3 (pairing), §4 (conflict resolution),
and §6 (slice 1) — v1's §1 (current-state map), §5 (migration), and §7 (landmines) are reused
below with re-verification, not rewritten from scratch. Re-checked against the current commit
(`a7adb97`), `APP_VERSION = 'app-v48'` (index.html:5180), `sw.js` `CACHE =
'chemowell-app-v48-3'` (sw.js:1) — v1 was written against app-v39/40; **line numbers below are
re-verified at app-v48, not copied forward from v1**, and a few have moved (e.g. the tick loop is
now at index.html:6888, not :6628; `subscribeEntries`/`pendingEntries` are now at :198/:613/:6876,
not :6616-6626). The overall architecture v1 mapped (state/render/tick, storage keys, three
surfaces) is unchanged in shape — only exact line numbers shifted.

**What changed since v1, in one sentence:** Aaron was asked directly whether sync could avoid the
cloud entirely, was told the honest tradeoff (true zero-server peer-to-peer can't reliably hit
"within about a minute" because both phones aren't always online at once, so a brief relay is
needed for timing — but that relay can be built so it never holds anything readable), and chose
**"build it encrypted, get a lawyer before it goes live."** `APP_CLAUDE.md` rule 1 has already been
rewritten to record this (commit `a7adb97`, dated 2026-08-08) — this brief is the technical design
that makes that rule's promise ("the server may never hold, log, or be able to decrypt plaintext
patient data at any point") actually true, not just stated.

---

## 0. What "zero-knowledge" requires, concretely, and why v1's two designs don't satisfy it

v1's backend choice (Cloudflare Workers + D1) is still fine — re-justified in §1 below, not just
carried over. Two things in v1 do NOT satisfy the new requirement and are replaced in this brief:

1. **v1 §3's pairing flow uploaded a plaintext snapshot of the profile as part of `POST
   /pair/create`**, and thereafter pushed/pulled plaintext JSON records. That's "no cloud" in
   letter only if you trust the server operator — it is not zero-knowledge. §2 below replaces this
   with a handshake where the server never receives plaintext content or the encryption key.
2. **v1 §4's conflict design has the server compare `updatedAt` against a watermark to decide
   "only one side changed" vs. "both sides changed."** That comparison requires the server to know
   *which* record versions correspond to *which* content — trivial with plaintext, but the server
   in this brief never reads content at all, so it can't reason about "the same value arrived
   twice" vs. "two different values arrived." §3 below replaces this with a content-blind
   version-conflict mechanism (optimistic concurrency by integer version, not by comparing
   timestamps against a semantic watermark), with the actual "did these differ" judgment moved to
   the device, after local decryption.

---

## 1. Backend hosting — re-justified, not just carried over

**Still Cloudflare Workers + D1.** v1's six reasons (§2.3 of v1: sandbox can't reach any of
Firebase/Supabase/Cloudflare interactively anyway so the managed-console advantage is moot; no
real-time requirement; auditable plain-JS auth beats a rules DSL; cost fits one-time-purchase
pricing; Wrangler-via-GitHub-Actions matches the existing `android-build.yml` pattern; boring
proven tech) all still hold and are not re-litigated here.

**What's different for a zero-knowledge design, and why it's actually easier for D1, not harder:**
D1 is a SQLite-compatible row store — it does not care whether a `TEXT`/`BLOB` column holds
plaintext JSON or base64 ciphertext, so switching to opaque-blob storage is a schema simplification,
not a complication. Concretely, the server-side schema shrinks to something like:

```sql
CREATE TABLE profiles (token TEXT PRIMARY KEY, created_at INTEGER);
CREATE TABLE records (
  profile_token TEXT, record_id TEXT, kind TEXT,        -- 'med' | 'entry'
  version INTEGER, updated_at INTEGER, last_writer_device TEXT,
  ciphertext BLOB, iv BLOB,
  PRIMARY KEY (profile_token, record_id)
);
CREATE TABLE pairing_sessions (
  code TEXT PRIMARY KEY, profile_token TEXT, expires_at INTEGER, redeemed INTEGER,
  inviter_pubkey BLOB, joiner_pubkey BLOB, wrapped_key BLOB, wrap_iv BLOB
);
```

The server-side code has **less** to reason about than v1's design (it never parses medication or
entry content at all — the only fields it ever reads are integers, timestamps, and opaque IDs), so
this revision reduces backend attack surface and auditability burden, it doesn't add to it. No
change to the recommendation.

---

## 2. End-to-end encryption design

### 2.1 Primitive: Web Crypto API only, no external library

Confirmed by inspecting this codebase (`package.json`, full-text search of `index.html`): there is
currently zero crypto dependency of any kind, and none needed. The design below uses exactly three
`crypto.subtle` algorithms, all part of the standard [W3C Web Crypto API](https://www.w3.org/TR/WebCryptoAPI/)
implemented natively in every browser engine this app runs in:

- **ECDH (P-256)** — `crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, ...)` /
  `deriveBits` — for the pairing handshake's key exchange.
- **HKDF** — `crypto.subtle.deriveKey({name:'HKDF', ...}, ...)` — to turn the raw ECDH shared
  secret into a proper AES key.
- **AES-256-GCM** — `crypto.subtle.encrypt`/`decrypt` — for both (a) wrapping the profile's
  durable sync key during pairing and (b) encrypting every medication/entry record before it's
  pushed to the server.

**Verified availability, not just asserted:** `crypto.subtle` requires a "secure context" (HTTPS or
localhost). All three surfaces this app runs in satisfy that: the PWA/browser tab is served over
HTTPS from GitHub Pages; the Capacitor Android shell's `server.url` (`capacitor.config.ts`) points
at that same HTTPS URL with `cleartext: false`, so the native WebView renders it as a secure
context too — same Chromium engine as the browser, same API surface. ECDH/HKDF/AES-GCM are not
new or experimental algorithms (all have been in every major browser and in Android's System
WebView for years). **What this brief could not verify from this sandbox:** an actual live
`crypto.subtle` call inside the *installed native APK's* WebView, for the same reason v1 §2.0
flagged — this sandbox has no outbound reachability to test against a real device or even a real
Cloudflare endpoint. Recommend the Lead Developer's first implementation step (see §5, task 3) be a
tiny standalone HTML page exercising `generateKey`/`deriveBits`/`encrypt`/`decrypt` and load it in
the actual Android build before writing any sync logic against it — cheap, fast, and removes this
as a late-discovered blocker.

### 2.2 The pairing handshake, step by step

**Design goal that shapes this:** the server must end up **storing nothing** that lets it (or
anyone who later obtains the database) reconstruct the profile's encryption key — not the key
itself, not anything key-equivalent, not even in an encrypted-but-server-decryptable form. It also
needs to support **more than two devices** sharing one profile (v1 §6 explicitly kept the pairing
primitive open to that even though slice 1 only tests two) without every pair of devices needing
its own separate key — otherwise device B couldn't read device C's pushes.

That second requirement means the actual per-profile encryption key must be generated **once**,
independent of any specific pairing session, and each new pairing's cryptography is only ever used
to **transport a copy of that one key** to the newly-joining device — not to *be* the key itself.
Concretely:

**Step 0 — first share, happens once per profile:** Aaron taps "Share this profile" on Device A
for a profile that has never been shared before. Device A generates a random AES-256 key locally
(`crypto.subtle.generateKey({name:'AES-GCM', length:256}, extractable:true, ...)`) — call it **K**,
the profile's durable sync key. K never leaves Device A at this point. It's stored in Device A's
local storage (raw-exported base64, alongside the other device-wide keys already in this app —
`PROFILES_KEY`/`LICENSE_KEY` pattern, index.html:135-ish per v1 §3) as this profile's sync key.

**Step 1 — this pairing session's ephemeral exchange, happens for every new device (first and
every subsequent one):**
1. The inviting device (whichever device is already paired and taps "Invite another device" — not
   necessarily always Device A; any paired device can invite once it holds K) generates a **fresh,
   single-use ECDH key pair** for this pairing session only. It calls `POST /pair/create` sending
   only its ECDH **public** key (harmless to expose — that's the entire point of Diffie-Hellman:
   the public key reveals nothing usable without the matching private key). The server creates a
   `pairing_sessions` row, generates a random 6-digit code with a ~10-minute expiry (same UX as
   v1's design — voice/text-relayable), and returns the code.
2. Displayed to Aaron as digits + a QR encoding `chemowell://pair/<code>`, same as v1 §3.
3. On the joining device: "Join a shared profile" → scan or type the code → the joining device
   **also generates its own fresh, single-use ECDH key pair** locally, then calls `POST
   /pair/redeem` with the code and its own public key. Server validates the code (unexpired,
   unused), marks it redeemed, and returns the inviter's public key plus the profile's opaque
   sync-token (the address used for all future push/pull calls — not secret, just a lookup ID).
4. **Both devices now independently compute the same shared secret** via
   `crypto.subtle.deriveBits` (ECDH) using their own private key and the other side's public key,
   then run it through HKDF to derive a one-time AES-GCM **transport key**. This transport key was
   never transmitted anywhere in any form — only the two public keys were, and a public key alone
   cannot reconstruct the shared secret without the corresponding private key (this is the entire
   security property Diffie-Hellman provides).
5. The **inviting** device (the one that already holds K) encrypts K with the transport key
   (`crypto.subtle.encrypt`, AES-GCM — this is standard "key wrapping") and uploads the resulting
   ciphertext to the pairing session's record. The **joining** device downloads that ciphertext,
   decrypts it with the same independently-derived transport key, and now also holds K — the
   profile's actual, durable sync key — from this point forward. The transport key itself is
   discarded on both sides once this step completes; it's single-use by design.
6. From here on, **both devices use K directly** to encrypt/decrypt every medication and entry
   record they push/pull — completely decoupled from the pairing exchange, which only ever
   existed to move one copy of K to a new device without the server ever seeing K in any form.

**What the server ends up storing, end to end:** two ephemeral ECDH public keys and one
AES-GCM-wrapped copy of K per pairing session (deletable once redeemed — recommend a TTL cleanup
job), plus, ongoing, opaque per-record ciphertext blobs and the non-content metadata described in
§3. At no point does the server receive K itself, anything from which K can be derived, or
plaintext patient content. This is the same trust model Signal uses for its own key transport
(X3DH is a more elaborate variant of the same ECDH-based "establish a secret without ever
transmitting it" idea) — appropriate to name to Aaron or a future lawyer as a recognizable,
externally-validated pattern, not a bespoke invented scheme.

**Judgment call to flag explicitly:** the 6-digit code's ~10-minute, single-use, rate-limited
window is now protecting against a different threat than v1's design (v1's code effectively *was*
a bearer credential; here it's a narrow window during which an attacker would have to intercept and
redeem before the legitimate device does, with the code alone giving them nothing once the window
or the single-use closes). This is a materially better property than v1's design already had, but
it's still the kind of "how strong does this door need to be" tradeoff worth Aaron or a lawyer
explicitly signing off on rather than assuming.

### 2.3 What actually gets encrypted vs. left as plaintext metadata

Every medication record and every entry record's **content** (the full JSON body — dose amounts,
schedule windows, symptom notes, whatever's in the record) is AES-GCM-encrypted with K before
upload; a fresh random IV per encryption, stored alongside the ciphertext (IVs are not secret).
Left as **plaintext metadata**, deliberately: `record_id` (opaque, generated the same way other IDs
in this app already are, per v1 §3 — reveals nothing), `kind` ('med' | 'entry' — reveals the record
is a medication vs. an entry, not its content), `version` (integer, needed for §3's conflict
mechanism), `updated_at` (needed for the "last synced" indicator and polling), `last_writer_device`
(the opaque `installId`, not a name — needed for §3's conflict UI to say "changed on another
device").

**This is a judgment call, not a settled fact, and needs Aaron/Lead Developer/eventually-a-lawyer
sign-off, not silent assumption:** even this minimal metadata is *something* about a patient's data
existing and changing over time, and state consumer-health-data laws (the brief's own §4 below, and
`APP_CLAUDE.md` rule 1's existing MHMDA reference) can in principle reach metadata-about-health-data,
not only content. The practical case for leaving it unencrypted is that none of it is content —
`last_writer_device` and timestamps don't reveal a dose, a diagnosis, or a symptom — but this brief
is not the place to make that legal call final.

---

## 3. Conflict detection when the server can never read content

v1's design had the server compare `updatedAt` against a watermark to distinguish "one device
changed it" from "both devices changed it." That's not available here — the server has no way to
know whether two ciphertexts represent the same edit arriving twice or two genuinely different
edits. Replace with **optimistic concurrency control keyed on the plaintext-blind `version`
integer already in §2.3's metadata** — deliberately not a CRDT or vector clock, justified below.

**Mechanism:**
1. Every record a device has ever pulled carries the `version` it was pulled at. When a device
   edits a record locally, it remembers that `baseVersion` (the version it last knew about).
2. On push, the device sends `{record_id, baseVersion, newVersion: baseVersion + 1, ciphertext,
   iv}`. The server does a single compare-and-swap: if the row's current stored `version` still
   equals `baseVersion`, accept the write, store `newVersion`, update `updated_at` and
   `last_writer_device`. This is a single `WHERE version = ?` clause in the D1 UPDATE — no content
   inspection needed at all.
3. If the row's current version has already moved past `baseVersion` (another device pushed first
   since this device last pulled), the server rejects with 409 and returns the current
   ciphertext/version. **The server has now correctly detected "two devices both wrote since the
   last common version" without ever reading what changed** — exactly the property needed.
4. **What happens next happens entirely on-device, after local decryption** (this is the part that
   moves from server to client vs. v1): the rejected device decrypts the server's current value
   and compares it, locally, against its own pending edit.
   - If they're substantively the same (e.g. the device's own earlier push actually succeeded and
     this is a stale retry, or another device made the identical change) → silently adopt, no UI.
   - If the device has no genuinely divergent local edit — it was just behind — silently adopt the
     server's value and it's caught up, no UI, no data lost.
   - If the device's own pending edit is a real, different change from what's now on the server →
     this is a genuine concurrent edit. Same handling as v1 §4's hard case: **do not auto-merge or
     silently overwrite.** Leave the local edit exactly as the user left it, mark the record
     "not synced — changed on two devices," and surface it with the app's existing non-blocking
     toast/warn visual language. Full "keep mine / use theirs" resolution UI stays out of scope for
     slice 1, exactly as v1 already scoped it — slice 1 does the safe thing (detect-and-hold), not
     the complete thing.

**Why a simple integer version, not a vector clock or CRDT:** the spec's own framing is "roughly
within a minute, not instant," polling every ~45s, with a caregiver population realistically in the
single digits per profile — this is not concurrent real-time collaborative editing at scale. A
per-record version counter with device-id-of-last-writer gives the server exactly the one thing it
needs (a cheap, content-blind way to detect "did this move since I last knew about it") without the
implementation and testing cost of a full CRDT or vector-clock merge system, whose main advantage —
automatic, mathematically-justified merging of concurrent edits — is explicitly *not* wanted here
anyway (§4 of v1 already established that auto-merging a dosing-safety field is the wrong behavior;
the goal is detect-and-hold, not automatic reconciliation, which removes the strongest argument for
a heavier mechanism). If a later slice needs finer-grained conflict info (e.g., per-field rather
than per-record), that's an additive change to the same version-integer scheme, not a redesign.

**Entries stay the easy case, unchanged in shape from v1:** append-only union-merge by id still
applies — the only wrinkle is that "does the remote have an entry the local device doesn't" is now
answered by pulling and decrypting ciphertexts rather than reading plaintext JSON directly, which
is a mechanical change (decrypt-then-merge instead of merge), not a design change. Tombstones for
deletes (v1's `deletedAt` flag) still apply the same way, just as an encrypted field.

---

## 4. Key loss / recovery — the honest tradeoff

**The scenario:** K (the profile's AES-256 sync key, §2.2) exists only in the local storage of
devices that have been paired. If every paired device is lost, uninstalled, or factory-reset before
a new device is ever paired in, K is gone. Nothing on the server can reconstruct it — that was the
entire design goal (§2.2's step 0 onward: K is never transmitted anywhere in derivable form).

**What that means, stated plainly for Aaron:** the encrypted records sitting in D1 become
permanently unreadable — not "hard to recover," genuinely, mathematically unreadable, forever, by
anyone, including ChemoWell. **This is correct behavior for true zero-knowledge encryption, not a
bug to fix** — any design that *could* recover K without a surviving paired device is a design
where the server (or whoever holds that recovery mechanism) can also read the data, which is
exactly the property Aaron asked this design to not have. There is no "forgot my password, here's a
reset link" possible here, by construction, the same way there isn't one for Signal's message
history on a lost device with no other logged-in device.

**What this does NOT affect — say this explicitly, it's easy to conflate the two:** the profile's
**on-device data is never lost this way.** Local storage (the existing `-entries-v1`, `-med-v1`,
`-appts-v1`, `-notes-v1`, `-prefs-v1` keys per v1 §1.1) is never itself encrypted by this design —
only the payloads pushed to/pulled from the server are. A caregiver's own phone, with its own local
copy, keeps working exactly as it does today regardless of what happens to K or to the server's
copy. What's lost in the "all paired devices gone" scenario is specifically *the ability to sync a
new device into that same encrypted history* — not any data that was, is, or will be visible to the
people who actually had the app installed.

**Natural pairing with the still-unbuilt Plus-tier "backup to new phone" feature** (advertised,
unimplemented, at index.html's Plans sheet per v1 §3 — *"Backup & transfer to a new phone (coming
in beta)"*): if that feature is built as a local, caregiver-controlled encrypted export (e.g. a
password-derived key via `crypto.subtle.deriveKey` with PBKDF2, wrapping the exported data —
another Web-Crypto-native primitive, no new dependency), it can **also wrap a copy of K** in that
same export, if a sync pairing has ever happened for that profile. Restoring from that backup onto
a brand-new phone would then restore both the data *and* sync capability, giving Aaron's users a
real, caregiver-controlled key-recovery path that never touches the server and never gives the
server (or ChemoWell) the recovery capability either. Flagging this as **worth building together,
or at minimum designing so the two features don't conflict** — e.g. don't let the backup export
format get finalized without a field reserved for "wrapped sync key, if any."

---

## 5. What zero-knowledge changes about the legal-exposure story

Restating this for the record, since this brief may be read by Aaron directly or handed to a future
lawyer, and the distinction matters:

- **"Encrypted at rest"** (what most consumer apps, including Firebase/Supabase's defaults, actually
  do) means the operator's own servers hold the decryption key, or can generate/reset it, and can
  therefore read the data whenever they choose to, are legally compelled to, or are compromised in a
  breach that also exposes the key. This is the norm, not a weak choice, but it means the operator's
  legal exposure for a breach or a subpoena is essentially the same as if the data were plaintext —
  encryption at rest protects against a narrow set of failure modes (e.g. a stolen disk) but not
  against the operator itself, compelled or compromised.
- **True zero-knowledge** (this design) means ChemoWell's own server operator **cannot** read the
  data even if compelled by a court order or compromised in a breach — there's no key on the server
  side to compel or steal, by construction. This is a meaningfully different risk posture:
  breach-notification and consumer-health-data-law obligations are generally triggered by exposure
  of data an operator can actually access/use, and a design where the operator provably cannot
  decrypt the exposed bytes is the strongest practical argument available against the most serious
  version of those obligations applying.
- **This brief is not making that legal claim on its own authority — it can't.** Whether zero-
  knowledge encryption actually changes MHMDA (or any other state consumer-health-data law, or App
  Store/Play policy) obligations for ChemoWell specifically is exactly the question Aaron already
  said needs a real lawyer before this goes live to real users (`APP_CLAUDE.md` rule 1, and the
  Formal Privacy Policy item already logged in `REQUESTS.md`). This section exists so that lawyer
  has an accurate technical description to evaluate, not to pre-empt their judgment.

---

## 6. Revised Slice 1 — Definition of Done

Same shipping philosophy as v1 (small, independently-verifiable, matches this team's actual
release cadence) — correctly scoped for the encrypted design instead of v1's plaintext one:

**Must work:**
1. Pro-gated "Share this profile" on a never-before-shared profile generates K locally (§2.2 step
   0), then runs the pairing handshake (§2.2 step 1) to produce a 6-digit code + QR.
2. "Join a shared profile" on device B redeems the code, completes the ECDH exchange, unwraps K,
   and is now holding the same profile sync key as device A — verified by both devices
   successfully decrypting a first exchanged record, not just by the handshake completing (a
   silent key-derivation mismatch that only surfaces later as "sync received garbage" is a real
   risk worth an explicit round-trip test at pairing time).
3. Two-way sync of **medications + entries only** (same scope as v1) — every pushed/pulled record
   is AES-GCM-encrypted client-side per §2.3; server never receives plaintext.
4. Conflict handling per §3: version-based compare-and-swap on push, content-blind on the server,
   decrypt-and-compare on the device, detect-and-hold (not auto-merge, not silent overwrite) shown
   to the user for genuine concurrent edits.
5. Polling every ~45s while foregrounded (`visibilitychange`-triggered poll on resume, plus the
   interval while visible) — identical cadence/approach to v1, unaffected by the encryption layer.
6. A visible "Last synced Xs/Xm ago" indicator plus manual "Sync now" — same as v1.
7. Sync-triggered state updates reuse the existing defer-while-modal-open pattern
   (`pendingEntries`/`subscribeEntries`, now at index.html:198/613/6876) and are added to the
   existing 1s-tick render guard list (now at index.html:6888) from the start — same requirement
   as v1, unaffected by the encryption layer, still worth restating given this exact bug class has
   shipped three separate times in this project's history (v11, v22, v27 per v1 §1.3).
8. A tiny standalone Web Crypto smoke test (§2.1) run against the actual Android WebView build
   before any sync UI is wired up — new in v2, cheap insurance against a late-discovered platform
   gap.

**Must NOT regress:** identical to v1 — a profile that never runs "Share this profile" makes zero
network calls and has zero behavior change.

**Explicitly out of scope for slice 1:** identical list to v1 (appointments/notes/prefs sync, full
conflict-resolution UI beyond detect-and-hold, background/locked-phone sync, >2-device testing
though the primitive shouldn't cap at two, revoke/rotate UI beyond a hard unlink, the Plus-tier
one-shot restore flow) **plus, new in v2:** the PBKDF2-wrapped-K-in-backup-export idea from §4 is a
slice-2-or-later feature, not slice 1 — flagged here only so slice 1's backup-export format (if
touched at all) doesn't foreclose it.

---

## 7. Implementation task breakdown for the Lead Developer

Ordered so each step is independently testable before the next one depends on it:

1. **Device install-id + local key storage helpers.** Reuse the existing ID-generation pattern
   (v1 §3); add a small `getOrCreateInstallId()` and generic `getDeviceKey(profileId)` /
   `setDeviceKey(profileId, keyBytes)` pair over localStorage, parallel to the existing
   `PROFILES_KEY`/`LICENSE_KEY` device-wide-key pattern. Testable standalone — no crypto, no
   network yet.
2. **Web Crypto helpers module: `generateSyncKey()`, `pairingHandshakeInit()` /
   `pairingHandshakeRespond()` (ECDH + HKDF), `encryptRecord(K, obj)` / `decryptRecord(K,
   blob)` (AES-GCM).** Pure functions, testable in isolation with no server and no UI — write a
   quick round-trip test (encrypt then decrypt gets the original object back; two independently
   derived transport keys from a simulated handshake match) before touching anything else. This is
   also where the §2.1 Android-WebView smoke test belongs.
3. **Backend: schema + endpoints** (`POST /pair/create`, `POST /pair/redeem`, `GET
   /pair/status/:session`, `GET /profile/:token/pull`, `POST /profile/:token/push`) on Workers +
   D1, per §1's schema and §3's compare-and-swap logic. Testable via curl/Playwright against a
   deployed dev Worker independent of the app's UI (mirrors how v1 flagged this needs GitHub
   Actions, not interactive sandbox testing).
4. **Pairing UI: "Share this profile" / "Join a shared profile" screens**, wired to steps 2+3 —
   code/QR display on the inviting side, scan/type + redeem on the joining side. Testable
   end-to-end between two browser tabs/devices before any ongoing sync logic exists — a successful
   pairing that produces matching K on both sides (verified via the round-trip check in item 2) is
   a complete, demoable milestone on its own.
5. **Sync loop:** poll timer + `visibilitychange` hook, encrypt-on-push/decrypt-on-pull using step
   2's helpers, hooked into the existing render/state cycle via the `pendingEntries`-style
   defer-and-flush pattern and added to the 1s-tick guard list (v1 §1.3, now index.html:6888) from
   the start — not bolted on after a flicker bug is reported.
6. **Conflict-detected UI:** the non-blocking toast/warn treatment for a record marked "not synced
   — changed on two devices," per §3 step 4's device-side branch. Testable by forcing a version
   mismatch manually (two tabs editing the same seeded record) without needing real concurrent
   users.
7. **"Last synced" status indicator + manual "Sync now."** Small, additive, testable last since it
   only displays state the prior steps already produce.
8. **Settings entry point:** the Pro-gated opt-in that surfaces "Share this profile" / "Join a
   shared profile" in the actual Settings screen, plus the `deleteProfile()` server-awareness
   decision v1 §7 already flagged (local delete vs. unlink-and-notify-server) and the
   notification-resync hooks v1 §7 already flagged (`markNotifDirty()`/`syncNativeReminders()`
   must fire on sync-received medication changes exactly as they do on local edits). Last, because
   it's the integration point that depends on everything above already working.

---

## Sources read for this v2 brief
`SYNC_DEVELOPER_BRIEF_v1.md` (full), `APP_CLAUDE.md` (current rule 1, already rewritten by Aaron's
sign-off, commit `a7adb97`), `REQUESTS.md` (Formal Privacy Policy item), `package.json` (confirmed
no existing crypto dependency), `capacitor.config.ts` (confirmed HTTPS `server.url`, secure-context
basis for `crypto.subtle` claim), `index.html` full-text search for any existing crypto/`subtle`
usage (none found — confirmed this is new surface, not modifying existing crypto code), targeted
re-reads of the tick loop and `subscribeEntries`/`pendingEntries` pattern at their current app-v48
line numbers, and `git log` (confirms `APP_CLAUDE.md` rule 1's rewrite already landed before this
brief).
