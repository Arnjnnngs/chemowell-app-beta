# DEV BRIEF — Caregiver sharing + profile transfer, device-to-device (v3)

Stage: **Developer** (investigation and design only — no code changed).
Repo: `chemowell-app-beta` (APP-BETA). Verified against `APP_VERSION = 'app-v51'` (index.html:5361),
`sw.js` `CACHE = 'chemowell-app-v51-1'` (sw.js:1), git HEAD `09d34d8`.

**Supersedes `outputs/SYNC_DEVELOPER_BRIEF_v2.md` in full**, and `SYNC_DEVELOPER_BRIEF_v1.md` with it.
Both designs assumed a relay server. Aaron cancelled that architecture on 2026-08-09. There is no
server in this design, at any point, for any purpose.

**The constraint that shapes everything below:** Aaron will never operate a server, and patient data
will never transit infrastructure he controls. `APP_CLAUDE.md` Hard Rule 1's original form is
restored in substance — nothing in this design writes user data off-device except a file the user
personally hands to a person they chose, via their phone's own share sheet, encrypted with a key
that never travels with it.

**Why this is the right call, restated so the next agent doesn't relitigate it:** the app holds
`patientName`, `treatmentType` (index.html:1665), the medication list, logged symptoms,
appointments, notes, `sex` (index.html:1664), and `cycleTracking` menstrual data (index.html:1658,
5524). That combination is a named cancer diagnosis plus reproductive health data. Washington's My
Health My Data Act attaches to *collecting* consumer health data, gives individuals a private right
of action, and applies based on where the user lives. A zero-knowledge relay would still have made
Aaron a collector. Today he collects nothing, and the app's own copy says so in three places
(index.html:1995, 2638, 5585). This design keeps all of that true.

---

## 1. Transport — decision

### Recommendation: **an encrypted file handed to the OS share sheet, with the decryption code delivered out-of-band by the sender.** Nothing else.

This is not a compromise choice. It is the only candidate that works for both co-present and remote
caregivers, needs no new dependency, needs no permission prompt, and is already proven in production
in this exact codebase.

**It already works here, today.** `nativeShareFile()` (index.html:6755-6763) writes a Blob into the
app's cache dir via `@capacitor/filesystem` and hands the resulting URI to Android's real share sheet
via `@capacitor/share`. That path shipped in app-v47, silently regressed via the `synapse` bundle bug,
and was fixed and independently audited in app-v51 (index.html:25-37 documents the shim;
`outputs/AUDIT_v51.md`). Both plugins are pinned in `package.json` (`@capacitor/filesystem` 8.1.2,
`@capacitor/share` 8.0.1). Web/PWA falls through to `navigator.share({files})` and then an
`<a download>` blob (index.html:5669-5694). **Reuse this function verbatim — do not write a second
export path.**

**It covers the co-present case for free.** Android's share sheet includes Nearby Share / Quick Share
in the same list as Gmail and Drive. "Send it to the phone sitting next to me" and "send it to my
sister in another state" are the same three taps. That single fact removes the entire argument for a
separate proximity transport.

**Size check, so this isn't hand-waved:** entries average ~150 bytes of JSON. Six months of chemo at
eight logs/day ≈ 1,450 entries ≈ 220 KB, plus meds/appts/notes. AES-GCM + base64 ≈ 1.35× → ~300 KB.
Trivial for every share target. This number is what kills QR (below).

### What was rejected, and why

| Candidate | Verdict | Reason |
|---|---|---|
| **QR code as the data carrier** | **Reject outright** | QR's absolute ceiling is 2,953 bytes (version 40, EC level L). A real profile is ~300 KB — two orders of magnitude over. Not a tuning problem, a physics problem. |
| **QR code for the *key* only** | **Reject for slice 1** | Technically fine (10 chars fits trivially) but requires a camera scanner. There is no barcode plugin in `package.json`, and `BarcodeDetector` is not dependable in Android's System WebView. That's a new native dependency and a camera permission prompt to save the user reading ten characters aloud. Not worth it. Revisit only if a scanner lands for another reason. |
| **Bluetooth / Web Bluetooth** | **Reject** | Web Bluetooth is not implemented in Android System WebView — it is a Chrome-browser feature, and the Capacitor shell is a WebView. Would require a native plugin, a pairing UX stressed users routinely fail, and both devices physically present, which defeats the remote-caregiver case that is the actual point. |
| **Wi-Fi Direct / local network discovery** | **Reject** | Needs a native plugin (none pinned), plus `NEARBY_WIFI_DEVICES` on Android 13+ or `ACCESS_FINE_LOCATION` below it. A privacy-marketed app asking for location permission to share a file is a self-inflicted wound. Also fails on hospital/guest Wi-Fi, which commonly enables client isolation — exactly where caregivers are. |
| **WebRTC data channel** | **Reject — disqualified by the constraint** | WebRTC requires a signalling server to exchange SDP, and usually TURN. That is a server Aaron controls. Out of scope by definition, not by preference. |
| **Web Share Target (receive a file by tapping it in Gmail)** | **Defer, don't reject** | Genuinely nicer UX. But `share_target` in the manifest only works for an installed PWA; the APK would need an `intent-filter` patched into `AndroidManifest.xml`. The workflow already patches that file (`.github/workflows/android-build.yml:56-58`), so this is buildable later. Not slice 1 — it is an *addition* to the file path, not a replacement, so nothing here forecloses it. |

### The key exchange, worked out concretely

An encrypted file sent over email/SMS/Drive is only safe if the key travels a different channel. Here
is the actual mechanism.

**There is no way around a pre-shared secret.** ECDH would let two devices agree on a key over an
untrusted channel, but only with an authenticated channel to compare public keys over — otherwise it
is trivially man-in-the-middled. With no server there is no second channel except the human one. So
the human channel carries a code, and the code is the secret. This is why §2 concludes the v49 ECDH
code is dead.

**Concretely:**

1. Sender taps "Share with a caregiver". The app **generates** a code — the user never chooses one
   (user-chosen passphrases are the failure mode this design cannot afford).
2. **Code format: 10 Crockford base32 characters, displayed `XXXXX-XXXXX`.** Reuse the exact format
   and the input-repair rules already specified and audited for the cancelled relay
   (`REQUESTS.md:253-255`): accept it back lowercase, spaced, undashed, and repair `O→0`, `I/L→1`.
   That decision was already made and reviewed; carry it forward rather than reopening it.
   50 bits of entropy.
3. **Key derivation: PBKDF2-SHA-256 → AES-256-GCM.** `crypto.subtle.deriveKey({name:'PBKDF2',
   hash:'SHA-256', salt, iterations}, ...)` — native Web Crypto, no new dependency, same
   secure-context basis as everything else (the Capacitor shell loads
   `https://arnjnnngs.github.io/chemowell-app-beta/` with `cleartext: false`, per
   `capacitor.config.ts`). Salt: 16 random bytes, fresh per file, stored in the file's plaintext
   header (salts are not secret).
   **Iterations: start at 600,000; measure on the CI emulator; drop to 310,000 only if the derivation
   exceeds ~3s on the emulator.** At 600k, 50 bits of entropy puts offline brute force far beyond
   feasible even for a well-resourced attacker who obtains the file.
4. The sender is told, in the UI, in plain words: **"Read this code to them, or text it separately —
   don't send it with the file."** Then the share sheet opens.
5. The receiver picks the file, types the code, and the app decrypts. **A wrong code fails closed and
   loudly** — AES-GCM's authentication tag makes a wrong key a decryption *failure*, not garbage. The
   existing `syncAesDecryptObject` (index.html:265-268) already gets this for free.

**Threat model, stated honestly for Aaron:** an attacker who intercepts *only* the file gets nothing.
An attacker who intercepts *only* the code gets nothing. An attacker who gets both — e.g. the sender
texts both to the same thread — gets the data. The UI's job is to make that mistake hard, and it
should say so in one short sentence rather than assume.

### The one thing that must be verified before anything else is built

**Importing requires a file picker, and that is the single unverified assumption in this design.**
`@capacitor/filesystem` can read a path but cannot browse to a user-chosen file. The standard answer
is `<input type="file">`, which Capacitor's Android bridge is expected to service via
`onShowFileChooser`. This sandbox cannot confirm that on a real WebView.

Two concrete rules for the Lead Developer:
- **Make this task 1**, verified on the CI emulator (`.github/scripts/android_smoke_test.sh`), before
  a single line of merge logic is written. This is the same "cheap insurance against a
  late-discovered platform gap" position v2 §2.1 took about `crypto.subtle`, and that instinct was
  right.
- **Do not set an `accept` attribute on the input.** Android's picker filters by MIME type, and an
  unfamiliar extension maps to `application/octet-stream` inconsistently across OEM file pickers —
  an `accept` filter is a very common way to make the user's own file invisible to them. Show
  everything and validate the header after reading.

---

## 2. Crypto — exactly what survives from app-v49

The v49 module (index.html:194-362, commit `2d93d06`) was built for a relay. Roughly half of it is
directly reusable; the ECDH half is dead. Function-by-function:

### Keep and reuse as-is

| Lines | Symbol | Why |
|---|---|---|
| 204-213 | `INSTALL_ID_KEY`, `getOrCreateInstallId()` | Genuinely needed. Merge provenance depends on knowing which device a record came from (§3's per-peer watermark, and the "possible double entry" check). Keep the storage key name — an installed tester already has one. |
| 235-246 | `syncB64FromBytes()`, `syncBytesFromB64()` | Correct, tested, needed for every base64 field in the file format. Rename to `b64FromBytes`/`bytesFromB64` if you like, but that is cosmetic. |
| 256-268 | `syncAesEncryptObject()`, `syncAesDecryptObject()` | Exactly the primitive this design needs, unchanged. Fresh 12-byte IV per call, IV returned alongside ciphertext. Take a `CryptoKey` and an object — which is precisely the shape the file format wants. |

### Delete — dead code with no caller

| Lines | Symbol | Why it's dead |
|---|---|---|
| 214-218 | `syncKeyStorageKey`, `getDeviceKeyRaw`, `setDeviceKeyRaw`, `clearDeviceKeyRaw`, `isProfileShared` | These persist a durable per-profile key **K**. There is no durable K in this design — the key is derived per-file from the code, used once, and discarded. Nothing to store. |
| 219-225 | `syncMetaStorageKey`, `getSyncMeta`, `setSyncMeta`, `clearSyncMeta` | Holds `{token, lastSyncedAt, versions, devices}` — all relay concepts. §3 introduces a differently-shaped `-sharemeta-v1` key; write it fresh rather than bending this one. |
| 247-255 | `generateSyncKey()`, `importSyncKey()` | Generate/import a random 256-bit K. This design derives its key from the code instead. |
| 269-277 | `encryptRecord()`, `decryptRecord()` | Per-*record* encryption existed because the relay stored one encrypted row per record. A file is encrypted **once, as a whole bundle** — one salt, one IV, one ciphertext. Simpler and strictly better: per-record blobs would leak the exact record count in the plaintext structure. |
| 278-316 | `generateEcdhKeyPair`, `exportEcdhPublicKey`, `importEcdhPublicKey`, `deriveTransportKey`, `wrapSyncKeyForTransport`, `unwrapSyncKeyFromTransport` | The entire ECDH+HKDF handshake. **Dead, and this is the load-bearing judgment in this section:** ECDH's value is agreeing a secret over a channel an attacker can *read*. It provides nothing against a channel an attacker can *modify*, which is what an unauthenticated email/SMS channel is. Without a server to relay public keys, and without a QR scanner to exchange them authenticated-by-physical-presence, there is no channel for it to operate over. What would resurrect it: a QR scanner landing in the app. Then a co-present "beam to the phone in front of me" flow could use ECDH over two scanned public keys and drop the typed code. That is a real future option, not a reason to keep unreachable code now. |
| 323-328 | `window.__syncTest` | Replace with an equivalent hook exposing the new surface (`deriveFileKey`, `buildShareBundle`, `mergeBundle`) so the Auditor can drive merge cases from Playwright without clicking through two devices. Same reasoning as the existing comment at index.html:317-322 — keep the hook, change its contents. |
| 330-362 | `SYNC_API_BASE`, `syncApiReady`, `syncApiCall`, `pairCreate`, `pairRedeem`, `pairUploadKey`, `pairStatus`, `profilePull`, `profilePush` | The entire relay API layer. `SYNC_API_BASE` is `''` (index.html:338), so none of it has ever executed. Delete outright. |

### Add — one new primitive, Web Crypto only

```js
// Derives the file key from the sender's generated code. PBKDF2 is native Web Crypto;
// no library, no new dependency, same secure-context basis as the AES helpers above.
async function deriveFileKey(code, saltBytes, iterations) { /* PBKDF2-SHA-256 -> AES-GCM 256 */ }
```

**Verified before asserting:** I grepped every one of the ~35 v49 symbols across `index.html` and
`sw.js`. The only occurrence outside the 194-362 block is a comment at index.html:6909 referencing
`window.__syncTest` as a naming precedent for another debug hook. Removal is therefore mechanical,
with that one comment to reword. Nothing else in the app depends on any of it.

### File format

```jsonc
{
  "format": "chemowell-share", "v": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<b64>" },
  "iv": "<b64>",
  "ciphertext": "<b64>"        // AES-256-GCM over the whole bundle
}
```

**The plaintext header must contain nothing identifying.** No patient name, no treatment type, no
record counts, no app version. It is four fields and they are all cryptographic parameters.

**The filename must also contain nothing identifying — this is a real leak in today's code.**
`downloadEntriesCSV()` builds `chemowell-<patientName>-<date>.csv` (index.html:5651) and
`openPrintReport()` does the same (index.html:5734). For a CSV the user is deliberately sending to
their own doctor, that is defensible. For a share file, that filename becomes a Gmail attachment
name, a Drive listing entry, and a notification preview — the patient's name and "chemowell" side by
side, outside the encryption. **Use a neutral name: `chemowell-share-2026-08-09.cwshare`.** MIME
`application/json`. (Leaving the CSV/report filenames alone is fine; they are a different feature
with a different intent. Worth logging in `BACKLOG.md` as a question, not changing here.)

---

## 3. Merge semantics

This is the hard part and it is treated as such. "Last file wins" would silently destroy a
caregiver's logged doses. For a medication tracker that is a safety failure, not an inconvenience.

### 3.0 The data model, read from the code, not guessed

Five profile-scoped localStorage keys, all suffixed onto `chemowell-app-p-<profileId>-`
(index.html:364, 421, 470, 600, and the cleanup list at index.html:182):

| Store | Key | Mutability | Id scheme | Timestamps |
|---|---|---|---|---|
| Entries | `-entries-v1` | **Immutable + hard delete** | `'e' + Date.now().toString(36) + 6 random base36` (index.html:387) | `ts` = *event* time (minute-precision for doses); no `updatedAt`; `loggedAt` only on `chemo_date` |
| Medications | `-med-v1` → `{version, meds[], archivedMeds{}}` | **Mutable** | **Name-derived slug** (`safeMedicationId`, index.html:613-616; `nextMedicationId`, 4276-4285) | `createdAt` on new meds only (index.html:4415); **no `updatedAt`** |
| Appointments | `-appts-v1` | **Mutable** | `'a' + …` random (index.html:440) | none |
| Notes | `-notes-v1` | **Mutable**, one per `date` | `'n' + …` random, but `date` is the real key (index.html:476-495) | **has `createdAt` + `updatedAt`** (488, 490) |
| Prefs | `-prefs-v1` | Mutable object | n/a | none |

**Four findings from reading this that change the design:**

1. **Entries are genuinely immutable.** `ENTRIES_KEY` is written in exactly two places: `addEntryDB`
   pushes (index.html:389) and `removeEntryDB` filters (index.html:401). There is no edit path. That
   makes union-by-id *correct* for entries, not merely convenient — the only lossy operation is
   deletion.
2. **Medication ids are name-derived, not random.** Two caregivers who both add "Zofran" produce the
   same id `zofran` on both phones. This is a feature for merging (they converge instead of
   duplicating) and it makes `medId` references from the other device resolve correctly. Design with
   it, not around it.
3. **`archivedMeds` is already a deletion tombstone** — `deleteMedicationConfig` writes
   `archivedMeds[id] = {name, sub, pausePeriods}` (index.html:4494). It just has no timestamp.
4. **⚠️ `normalizeArchivedMeds` rebuilds each archive entry as exactly `{name, sub, pausePeriods}`
   and runs on every single load** (index.html:702-714). **Any field added to an archive entry
   without also being added there is silently stripped on the next page load.** This is precisely the
   bug class the v20-restart audit already fixed once in this same function (see its own comment at
   707-711). The `deletedAt` field §3.2 needs *must* be added to that rebuild or the whole
   delete-merge story fails intermittently and undebuggably.

### 3.1 Additive schema changes required

All additive, all survive existing round-trips — `normalizeMedication` spreads `...original`
(index.html:649) and `allEntriesRaw()` does no normalization at all.

| Change | Where | Note |
|---|---|---|
| `origin: installId` on every new entry | `addEntryDB` (index.html:385-398) | Merge provenance. Pre-existing entries have none; treat as unknown. |
| `updatedAt: Date.now()` on every medication write | `saveMedicationEditor` (4423), `setMedicationPaused` (4455), `moveReorderableMed` (4475) | Default to `createdAt \|\| 0` in `normalizeMedication`. |
| `updatedAt` on every appointment write | `addAppointment` (439-447), `updateAppointment` (448-453) | |
| `deletedAt` on archive entries | `deleteMedicationConfig` (4494) **and `normalizeArchivedMeds` (711)** | See finding 4 above. Both, or neither works. |
| New tombstone store `-tombstones-v1`: `{ entries: {id: deletedAtMs}, appts: {…}, notes: {…} }` | `removeEntryDB` (400-403), `removeAppointment` (454-460), `removeNote` (496-501) | **Deliberately a separate key, not rows inside the entries array** — a tombstone stored in `-entries-v1` would flow straight through `notifyEntries()` (372-377) into History, reports and CSV export. Separate key = zero blast radius on existing read paths. |
| New meta store `-sharemeta-v1`: `{ peers: { <installId>: { lastMergedAt } } }` | new | The per-peer watermark §3.2 needs. |

### 3.2 The merge algorithm

**Governing principle, and every rule below is derived from it:** *never silently discard a record a
human created, and never silently remove a medication from the active list.* Where those two conflict
with tidiness, tidiness loses. Where a genuine conflict exists, ask — with the no-data-loss option
already pre-selected, so a user who just taps "Done" cannot lose anything.

The incoming bundle's encrypted body carries `{ origin: installId, createdAt, entries[], meds,
archivedMeds, appts[], notes[], prefsSubset, tombstones }`.

`W` = `sharemeta.peers[incoming.origin].lastMergedAt || 0`.

**Rule 0 — content equality beats timestamps, always.** Before any conflict is raised, deep-compare
the two versions with volatile fields (`updatedAt`, `origin`, `reminded`) excluded. Identical content
is never a conflict, regardless of what the timestamps say. This one rule removes almost all false
conflicts, especially on the very first exchange with a peer where `W = 0`.

**Entries — union by id.**
- Present on one side only, id not in either tombstone map → add.
- Present on both → identical by construction (immutable). No-op.
- Id present in either side's tombstone map → drop it, and union the tombstone maps so the deletion
  propagates on the next exchange in either direction.
- *Known limitation, state it plainly:* entries deleted **before** this feature ships have no
  tombstone and can be resurrected by a merge with a device that still holds them. Bounded, one-time,
  and preferable to any heuristic that guesses at deletions.
- **Possible double entry.** Two caregivers logging the same real dose produce two ids. Dose `ts` is
  minute-precision (`nowLocalISO()`, index.html:1162-1167 → `new Date(m.timeValue).getTime()`,
  index.html:1400), so same-minute logs collide exactly, but 8:03 and 8:05 do not. After the union,
  flag pairs with the **same `medId`, same `dose` label and `mg`, `ts` within ±5 minutes, and
  different `origin`** as *possible* duplicates.
  **Do not auto-delete either one.** A patient can legitimately take two as-needed doses close
  together; silently deleting one is the exact failure mode this whole section exists to prevent.
  Surface them in the review sheet with **"Keep both" pre-selected**.

**Medications — union by id, with a real conflict path.**
- Id on one side only, not archived on the other → add.
- Id on both, content-equal (rule 0) → no-op.
- Id on both, content differs, **only one side's `updatedAt > W`** → that side changed it since the
  last exchange and the other did not. Take the newer one silently. This is the common case and it
  must not nag.
- Id on both, content differs, **both sides' `updatedAt > W`** → **genuine conflict.** Do not pick.
  Show it in the review sheet naming the medication and the fields that differ ("Zofran — schedule
  times and daily limit differ"), with *Keep this phone's version* / *Use their version*.
- **Delete vs. edit.** Archived on one side with `deletedAt`, edited on the other with `updatedAt`:
  **resolve in favour of keeping the medication**, and list it in the review sheet. This asymmetry is
  deliberate and should be stated in the code comment. A medication silently vanishing takes its
  reminders and its missed-dose tracking with it — a caregiver would have no signal at all that
  something disappeared. A medication that spuriously reappears is visible on the Meds screen and
  one tap to remove. Bias toward the visible, recoverable error.
- Archived on both, or archived on one and untouched on the other → stays archived. Union
  `archivedMeds`, keeping the **later** `deletedAt` and preserving `pausePeriods` (they are
  load-bearing for missed-dose suppression, per the comment at index.html:4484-4491).

**Appointments — union by id, LWW on the new `updatedAt`, one field never merged.**
- `reminded` (index.html:441, 5036, 6660) means *"this device has already fired this reminder."* It is
  device-local state, not shared truth. **Never import it.** An arriving appointment gets
  `reminded: false` on this device; an existing one keeps whatever this device already had. Importing
  `reminded: true` from a phone that already alerted would silently suppress the alert on a phone that
  had not — a reminder that never fires, with no error.
- Both sides changed since `W` and content differs → review-sheet conflict, same treatment as meds.

**Notes — keyed by `date`, and they already have `updatedAt`.**
- Same `date` on both, text differs, only one changed since `W` → take the newer.
- Both changed since `W` → conflict, with **"Keep both" as the pre-selected default**, implemented as
  the two texts concatenated under a `— from the other phone` separator. `saveNote` enforces
  one-note-per-day by `date` (index.html:476-495), so two notes cannot coexist; concatenation is the
  only lossless option and it is the right default for free text.

**Prefs — an explicit allowlist, never a blanket object merge.**
- **Merged (shared truth):** `patientName`, `sex`, `treatmentType`, the `HOME_PREF_DEFAULTS` toggles
  (index.html:1658, incl. `cycleTracking`), `tempUnit`, `weightUnit`, `ceilingMg`. Prefer a non-empty
  value over an empty one; if both are set and differ, it is a review-sheet conflict (a patient name
  spelled two ways is worth one tap to settle).
- **Never merged (device-local):** `tourDone`, `tourStep`, `pendingName`, `installedAt`,
  `supportPromptAt`, `supportOptOut`.
- **`dismissedMisses`: union the array.** Each element is an explicit per-item `medId|ts` dismissal
  (index.html:517-529). Union is monotonic and only ever hides something a human deliberately
  dismissed.
- **`missedClearedAt`: do NOT merge.** It is a *bulk* clear timestamp. Taking the max would let one
  caregiver's bulk "Clear" wipe every missed-dose warning off the other's phone, including ones
  nobody handled. The line to hold: per-item dismissals travel, bulk clears don't.
- **Also update `PROFILES_KEY`'s `list[i].name`** when `patientName` changes — the Account screen
  reads the profile-list name first and only falls back to prefs (index.html:5796). Updating one and
  not the other leaves two names on screen.

**Idempotence.** Re-importing the same file, or an older one, is harmless: union-by-id plus rule 0
makes every operation a no-op the second time. Worth an explicit Auditor test case.

**After a merge is applied, `markNotifDirty()` must fire** (index.html:7042) — an imported or changed
medication reshapes the reminder plan exactly as a local edit does. Every local mutation path already
calls it (4427, 4457, 4498, 446, 452, 459); the merge must not be the one exception.

### 3.3 What the user actually sees

The receiver's flow, which is the one that has to work first try for a stressed non-technical user:

1. **"Receive shared data"** → file picker → type the code (big field, forgiving input per §1).
2. **Review screen — nothing has been written yet.** Plain-language summary first:
   *"From Sarah's phone · 14 new doses logged · 1 new medication · 2 things need your decision."*
3. Conflicts listed one per card, each phrased as a question a person can answer without knowing
   what a record is: *"Zofran was changed on both phones"* with the differing fields shown side by
   side and two buttons. Possible-duplicate doses: *"Two Zofran doses were logged around 8:00 AM. Was
   that one dose or two?"* — **Keep both** pre-selected.
4. **"Apply"** writes everything at once. Nothing partial, nothing before this tap.
5. **Undo.** Before writing, snapshot all five profile keys into `-mergebackup-v1` and offer **"Undo
   this import"** for 24 hours. This is cheap, it is the single best mitigation for a merge that goes
   wrong on a real phone, and it is what makes the whole feature safe to hand to a stressed user.
   Strongly recommended, not optional.
6. Zero conflicts (the normal case) → skip step 3 entirely, show the summary and one **Apply**.

**Do not skip the review screen even when there are zero conflicts.** "It just happened" is the wrong
feeling for an operation that changes a medication list.

**Wrong code** → *"That code doesn't match this file. Check the code with whoever sent it — codes are
10 letters and numbers."* Never *"decryption failed."*

**The review sheet and any conflict modal must be added to the 1s-tick render guard at
index.html:7189.** This exact bug class — a new modal not added to that list, so the tick rebuilds
the DOM under it every second — has shipped four separate times in this project (v11, v22, v27, v45;
see the comment at index.html:7182-7188). Add it when the modal is written, not after someone reports
flickering.

---

## 4. What this also closes in `REQUESTS.md`

Three open items were checked against the real code. **Two are genuinely closed by this one
mechanism. The third is half-covered, and calling it fully covered would be wishful thinking.**

**✅ "How does a Plus/Pro caregiver actually back up and move to a new phone?" (`REQUESTS.md:261-268`)
— genuinely closed, same file, different landing.** The item asks for "a concrete, no-login design
(most likely a manual export/import file the caregiver saves and restores from)". That is exactly this
file. The only difference is the import mode: **Restore** creates a new profile (or fills the current
empty one) instead of merging into an existing one, via the existing `createProfile` path
(index.html:156-171). Same format, same crypto, same picker, one extra branch. This also makes the
Plus pricing bullet *"Backup & restore — move your data to a new phone (coming in beta)"*
(index.html:2768) true for the first time.

**⚠️ "Full data backup/export" (`REQUESTS.md:298-300`) — half covered, and the item is two features
wearing one coat.** It reads: *"bundle Appointments and Notes together with the existing health-entries
CSV into one real backup file, exportable to the caregiver's own cloud storage."*
- The *backup* half — one file containing entries, appointments and notes, saveable to the user's own
  Drive — is **exactly** the `.cwshare` file. Closed.
- The *"shareable file for your care team"* half (index.html:2769's Pro bullet) is **not** closed and
  cannot be. A doctor cannot open an AES-GCM blob. That half needs the *readable* export extended:
  `buildExportRows()` (index.html:5610-5635) walks entries only, so today's CSV and printable report
  both omit appointments and notes entirely — confirmed, and it is the actual gap the item describes.
  That is a small, independent task (two more row types), not part of this design.
- **Verdict: one feature covers the backup half. The care-team half is a separate ~half-day task.**
  Say this to Aaron rather than letting him think one build closes the whole bullet.

**✅ Caregiver sharing itself (`REQUESTS.md:182-260`) — the mechanism exists, the promise does not
survive intact.** See §5. The item's own wording — *"auto-refresh (not instant/live, but roughly
within a minute)"* (REQUESTS.md:183) — is not deliverable without a server and must be rewritten by
Scribe, not quietly reinterpreted.

---

## 5. What is honestly lost, in plain language for Aaron

This is written to be read by Aaron directly.

**Yes, it's manual instead of automatic — and that's the biggest part, but it isn't the whole list.**

1. **Nothing updates by itself.** Someone has to decide to share, and someone has to decide to import.
   The old design was "set it up once, then it just happens." This one isn't that. The earlier note
   that this is "manual rather than silent-background" is accurate, and it is the headline.
2. **Both people have to do something, every time.** The sender creates and sends the file *and*
   passes the code. The receiver opens it, types the code, and taps Apply. The cancelled design asked
   both people to do something exactly once, ever.
3. **"Roughly within a minute" is gone.** It's now "whenever someone sends an update" — realistically
   once a day, or when something changes. `REQUESTS.md:183` promises the old timing; that sentence
   needs rewriting.
4. **Two Pro pricing bullets are now wrong and must change before Pro is sold.** index.html:2769 says
   *"Real-time shared access for caregivers, so updates show up on their phone automatically (coming
   soon)"*. That will not be true. It should become something like *"Share everything with a
   caregiver — send an encrypted copy they can open on their own phone, with no account and no
   cloud."* index.html:2769's *"Complete data export"* bullet is fine once §4's readable export
   lands.
5. **A caregiver's reminders are only as current as their last import.** If one person adds a
   medication and doesn't share, the other's phone won't remind for it. Under auto-sync it would
   have. This is the one genuinely safety-adjacent loss, and the app should say so in one sentence
   where sharing is set up.
6. **Conflicts get more likely, not less.** Longer gaps between exchanges mean more independent
   changes to reconcile. That's why §3 spends most of its length on the review screen rather than the
   crypto.
7. **You can't un-share.** A file that's been sent can't be recalled. The old design had "unlink this
   device." This one doesn't, and can't.

**What is gained, so the trade is visible:**

- **No server. Ever.** Nothing to run, nothing to pay for, nothing to keep up, nothing to be breached,
  nothing to be subpoenaed, nothing to notify anyone about.
- **The app's own copy stays true** (index.html:1995, 2638, 5585) — that is a marketing asset and a
  legal position at the same time.
- **No lawyer is on the critical path to shipping this.** Under the relay design, Aaron's own rule
  required a privacy-lawyer review before real users touched sync. That dependency is gone (see §8 for
  the precise scope of that claim).
- **Works with no internet at all** on the receiving side — Nearby Share, a cable, a saved file.
- **No account, no login, no identifiers, nothing new to remember** beyond a code used once.

---

## 6. Decommissioning — precise, mechanical

### Delete outright

- **`sync-backend/` — the entire directory.** 15 tracked files (`api/_lib/{auth,blob,guard,ids}.js`,
  `api/health.js`, `api/pair/{create,redeem,status,upload-key}.js`, `api/profile/{pull,push}.js`,
  `index.html`, `package.json`, `package-lock.json`, `test/ids.test.mjs`), plus ~12 MB of untracked
  `node_modules/`. **Verified before asserting:** grepped `.github/` — no workflow references it
  (`android-build.yml`'s only "sync" hits are `npx cap sync android`). `index.html`'s `SYNC_API_BASE`
  is `''`, so the app has never called it. Nothing depends on it.
- **index.html lines 214-225, 247-255, 269-277, 278-316, 323-328, 330-362** — the exact ranges in §2's
  delete table. Reword the comment at index.html:6909 that references `window.__syncTest` as a
  precedent.

### Do NOT delete — something else depends on these

- **index.html:35** — the `window.synapse = { exposeSynapse: function(){} }` shim. It looks like sync
  scaffolding. It is not. It is the app-v51 fix for `@capacitor/filesystem@8.1.2`'s UMD bundle
  throwing `ReferenceError: synapse is not defined` on every page load (index.html:25-34). Removing it
  breaks CSV export, the printable report, **and** this entire feature's transport.
- **index.html:36-37** and the matching `@capacitor/filesystem` / `@capacitor/share` entries in
  `package.json` — `nativeShareFile()` (index.html:6755) is the transport.
- **index.html:204-213, 235-246, 256-268** — reused per §2.
- **`capacitor.config.ts`** — unrelated to sync.

### Not code, but must happen — Aaron action items

- **Delete the Vercel project `chemowell-sync` and its Blob store.** Deleting `sync-backend/` from git
  does not delete either. The deployment at `chemowell-sync.vercel.app` stays live, still holding
  whatever pairing state and blobs the audit's ~1,400 test requests created. Leaving a live health-data
  endpoint running under his account after deciding never to hold health data is the exact outcome this
  whole change exists to avoid. **Verify with a 404 afterwards, don't assume.**
- **Rewrite `APP_CLAUDE.md` Hard Rule 1** back to its original absolute form, with a dated note
  recording that the 2026-08-08 relay exception was granted and then withdrawn on 2026-08-09, and why.
  Do not just revert — the history is the point.
- **Scribe: rewrite `REQUESTS.md:182-260`** (the sync entry) to describe this design, and mark
  `REQUESTS.md:261-268` (backup/new phone) as closed by it.
- **README.md** version-history entry.

---

## 7. Definition of done, and the task breakdown

### Must work

1. A code is generated (10 Crockford base32, `XXXXX-XXXXX`), shown large, with copy telling the
   sender to deliver it separately from the file.
2. "Share with a caregiver" produces an encrypted `.cwshare` file and opens the real OS share sheet
   on the installed APK, via `nativeShareFile()`. Web/PWA falls through to the existing paths.
3. "Receive shared data" picks a file, accepts the code typed loosely (lowercase, spaced, undashed,
   O/I/L slips repaired), and decrypts. A wrong code produces a plain-English message, never a stack
   trace or a silent no-op.
4. The **review screen** shows a plain-language summary and every conflict before anything is
   written; **Apply** is the only thing that writes; **Undo** restores the pre-merge snapshot for 24h.
5. Merge behaves per §3.2 across every store, verified against the specific cases in the task list
   below — including the two that matter most: **two caregivers logging different doses both keep
   both**, and **a medication changed on both phones is never silently overwritten.**
6. Restore-to-a-new-phone: the same file imported on a device with no profile produces a working
   profile with entries, meds, appointments and notes intact.
7. `markNotifDirty()` fires after a merge that touched medications; native reminders re-plan.
8. The review sheet and every new modal are in the index.html:7189 tick-guard list.
9. **Must NOT regress:** a user who never touches sharing sees zero behavioral change, zero new
   network calls (there are none to make), and no new permission prompts.

### Explicitly out of scope

Web Share Target / Android intent-filter receiving; QR of any kind; any co-present transport beyond
what the share sheet already offers; per-field conflict resolution (per-record is enough); merging
more than two devices in one file (the format allows it, only two-way is tested); the readable
care-team export from §4 (separate task).

### Ordered task breakdown — each independently testable

1. **File-picker platform check.** A throwaway page with `<input type="file">` (no `accept`), run on
   the CI emulator via `.github/scripts/android_smoke_test.sh`, confirming a user-picked file's bytes
   reach JS inside the real Android WebView. **Nothing else starts until this passes.** If it fails,
   stop and re-plan the import side before writing merge logic — this is the one assumption that
   could invalidate the transport.
2. **Crypto trim + `deriveFileKey`.** Delete §2's dead ranges, add PBKDF2 derivation, measure
   iteration cost on the emulator and pin the number. Round-trip test: derive → encrypt bundle →
   derive again from the typed code → decrypt → deep-equal. Wrong code fails closed. Pure functions,
   no UI, no storage.
3. **Schema additions + tombstones.** §3.1's table: `origin` on entries, `updatedAt` on meds and
   appts, `deletedAt` on archive entries **including in `normalizeArchivedMeds`**, the `-tombstones-v1`
   and `-sharemeta-v1` stores. Testable alone: make every kind of edit and deletion, reload, confirm
   the fields survive the normalizers. **The `normalizeArchivedMeds` case needs its own explicit test
   — it is the one that fails silently.**
4. **`buildShareBundle(profileId)` + `parseShareBundle(json, code)`.** Serialize and encrypt; parse
   and decrypt. No merge, no UI. Testable by round-tripping a seeded profile in one tab.
5. **`planMerge(local, incoming, watermark)` — pure function, returns `{additions, updates,
   conflicts[], tombstonesApplied}` and writes nothing.** This is where §3.2 lives and where the real
   test suite goes: union of disjoint entries; identical bundles are a no-op (rule 0); re-import is
   idempotent; a deleted entry stays deleted; a med edited on one side only takes the newer; a med
   edited on both raises a conflict; delete-vs-edit keeps the medication and reports it; `reminded` is
   never imported; `missedClearedAt` is never merged; `dismissedMisses` unions; near-duplicate doses
   are flagged, not deleted. Driven headlessly through the `window.__syncTest` hook.
6. **`applyMerge(plan, resolutions)` + the pre-merge snapshot and Undo.** Writes all five stores in
   one pass, fires `markNotifDirty()`. Testable by asserting localStorage before and after, and that
   Undo restores byte-identical state.
7. **Share UI:** the code screen and the share-sheet handoff. Demoable on its own — a real encrypted
   file lands in Drive.
8. **Receive UI:** picker, code entry, review screen, conflict cards, Apply, Undo. Add every new
   modal to index.html:7189. This is the stage that needs the Designer, and it is where a stressed
   user succeeds or fails.
9. **Restore-to-new-phone branch:** the same import landing in `createProfile` instead of a merge.
   Small, because everything it needs already exists by this point.
10. **Settings/Account entry point.** Sits alongside `renderExportSection()` (index.html:5750, used at
    5581 and 5823). Last, because it depends on all of the above working.

---

## 8. Flags for Aaron — privacy copy and the lawyer question

**Does the privacy copy change? Mostly no — and that is the point of this design. But three specific
strings need review, and one is currently a claim the app cannot keep.**

- **index.html:5585** — *"All data stays on this device — no cloud, no accounts, no tracking, and the
  app never sends your information anywhere."* The first three clauses stay true. The last one —
  *"never sends your information anywhere"* — becomes literally inaccurate the moment a user
  deliberately shares a file, even though the spirit is intact. **Recommend a small amendment**, e.g.
  *"…no cloud, no accounts, no tracking. Nothing leaves this device unless you choose to share it —
  and when you do, it goes straight to the person you picked, encrypted, never through us."* That
  sentence is arguably *stronger* marketing than what's there now.
- **index.html:1995** (FAQ "Is my data private?") — same amendment, same reason.
- **index.html:2638** (About) — *"Everything you log stays on this device — nothing is sent to the
  cloud."* Still accurate. No change needed.
- **index.html:2769** (Pro pricing) — *"Real-time shared access … automatically"*. **Not a copy
  preference; a claim the product will not deliver.** Must change before Pro is sold. See §5.4.

**Does the Formal Privacy Policy item (`REQUESTS.md:285-291`) still need a lawyer? Flagging the
question accurately, not answering it — this is not legal advice and I am not qualified to give it.**

Two things genuinely changed, and one did not:

- **What changed:** under the relay design, Aaron would have been *collecting* consumer health data —
  the thing MHMDA regulates — and his own rule (old `APP_CLAUDE.md` Hard Rule 1) required a lawyer
  before real users touched it. That specific trigger is gone. Under this design, no data reaches
  infrastructure he controls, so the "am I a collector" question that made the lawyer review blocking
  is, on its face, not raised at all.
- **What did not change:** the App Store and Google Play both require a Privacy Policy URL before
  they will list the app *regardless* of what the app collects (`REQUESTS.md:287-288`). That
  requirement is unaffected. It is also its own kind of legal document — a policy that describes the
  app inaccurately is its own exposure, and a "we collect nothing" policy still has to be *correct*
  about a sharing feature that moves a cancer diagnosis and menstrual data between phones.
- **The honest framing for Aaron:** this design very likely moves the lawyer from *blocking* to
  *advisable* — which is a real and valuable change — but it does not remove the Privacy Policy
  requirement, and whether "advisable" is good enough is a call for Aaron and an actual lawyer, not
  for this brief. **Recommend the item stays open and unmodified in `REQUESTS.md`, with a note that
  the blocking dependency was removed by the architecture change.**

---

## 9. Where I am genuinely uncertain, and what would resolve it

1. **`<input type="file">` inside the Capacitor Android WebView.** Expected to work via Capacitor's
   `onShowFileChooser`, but unverified from this sandbox and the whole import side depends on it.
   **Resolved by:** task 1 on the CI emulator. Do it before anything else.
2. **PBKDF2 at 600,000 iterations on a low-end Android device.** Could be 400ms, could be 4 seconds.
   **Resolved by:** measuring in task 2 and pinning the number, with 310,000 as the documented
   fallback.
3. **The ±5-minute near-duplicate window.** Chosen from how dose logging actually behaves (minute
   precision, `nowLocalISO()`), not from data. Too wide and it nags about legitimate close-together
   as-needed doses; too narrow and it misses real double-logs. **Resolved by:** the Auditor's 7-day
   simulated-logging sweep — the full-sweep tier applies here, since this changes how medication data
   is stored and read (`TEAM.md`, Zero Day Auditor test-depth rules).
4. **Whether users will actually deliver the code out-of-band.** The design's security rests on a
   human habit. **Resolved by:** Aaron testing the real flow with a real second person before this
   reaches testers, and reporting what he actually did with the code. If the honest answer is "I
   pasted both into the same text," the copy in step 1 of the share flow needs another pass — that
   is a copy problem with a real consequence, and per `TEAM.md`'s copy-review rules it is exactly the
   kind of high-stakes wording worth flagging rather than resolving in-chain.

---

## Sources read for this brief

`TEAM.md` (full), `APP_CLAUDE.md` (full, incl. Hard Rule 1 and the architecture notes),
`outputs/SYNC_DEVELOPER_BRIEF_v2.md` (full), `REQUESTS.md` (sync entry 182-260, backup/new-phone
261-268, Privacy Policy 285-291, Pro-tier ideas 292-312), `package.json`, `capacitor.config.ts`,
`release_check.sh`, `.gitignore`, `.github/workflows/android-build.yml`, `.github/scripts/`,
`sync-backend/` file listing + `git ls-files`, and `index.html` — specifically the storage/profile
layer (121-192), the full v49 sync block (194-362) with a symbol-by-symbol reachability grep across
`index.html` and `sw.js`, the entries/prefs data layer (364-415), appointments (417-460), notes
(462-501), the storage-event handler (503-509), `eraseAllAppData` (576-590), the medication config
layer (596-771) incl. `normalizeMedication` (626-700) and `normalizeArchivedMeds` (702-714),
`nameOf` (1161), `nowLocalISO`/`toLocalISO` (1162-1167), `logMed` and the time-modal confirm path
(1328-1500), prefs accessors (1658-1679), the plans sheet (2755-2775), the medication editor save /
pause / reorder / delete paths (4276-4499), the appointment save path (5000-5045), Settings
(5470-5590), `buildExportRows` / `downloadEntriesCSV` / `openPrintReport` / `renderExportSection`
(5610-5760), Account (5762-5834), the Capacitor plugin accessors and `nativeShareFile`
(6673-6763), `syncNativeReminders`/`markNotifDirty` (6963, 7042), and the 1s-tick render guard
(7175-7203).
