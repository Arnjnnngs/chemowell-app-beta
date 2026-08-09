// Write authorization for a profile's records.
//
// THE HOLE THIS CLOSES: before this, `profileToken` was the only thing needed to write, and the
// brief treated it as "opaque, not secret -- just the lookup id for push/pull." That framing was
// written about READS, where end-to-end encryption really does make the token harmless: anyone
// holding it gets ciphertext they cannot open, and the zero-knowledge property is untouched. The
// design never considered the write direction. A Zero Day Auditor pass demonstrated the
// consequence: read a record's version via pull, then push over it, and a patient's medication
// record is permanently destroyed by a stranger. Encryption prevents disclosure; it does nothing
// about destruction.
//
// THE DESIGN, and why it does not weaken the zero-knowledge property:
// A `writeToken` is a high-entropy random string minted by this server when a profile is first
// shared. The server stores ONLY its SHA-256 hash, alongside the profile, and hands the token
// itself to exactly the two parties that complete a pairing handshake -- the inviting device (it
// created the pairing) and the joining device (it proved knowledge of the pairing code). Every
// write must present the token; the server hashes what it is given and compares in constant time.
//
// Deliberately NOT derived from the profile's encryption key K. Deriving it from K would be
// elegant, but it would mean the server holds a value with a mathematical relationship to K, and
// the promise in APP_CLAUDE.md rule 1 is that the server never holds anything derivable into
// plaintext. An independent random string has no relationship to K at all: compromising the whole
// blob store yields the hash of a bearer token and nothing else. It also keeps the client side
// trivial -- store a string, send a header -- rather than requiring more crypto in the app before
// the pairing UI can be built.
//
// What this does and does not defend: it stops an unauthenticated stranger from destroying or
// polluting a profile's records. It does not defend against a device that legitimately completed
// pairing and later turns malicious -- that device holds K and can read everything anyway, which
// is inherent to "these caregivers share one profile" and is a revocation feature, not an
// authentication one. Revocation (rotating K + writeToken and re-pairing) is a separate item.
import { getJson, putJson } from './blob.js';
import { newId, sha256, safeEqualHex, isSafeId } from './ids.js';

const authPath = (profileToken) => `profile-auth/${profileToken}.json`;

// Creates the write token for a profile the first time it is shared, or returns null if one
// already exists (the caller is inviting a second device to an already-shared profile, and must
// prove it already holds the token rather than being handed a fresh one).
export async function issueWriteToken(profileToken) {
  const existing = await getJson(authPath(profileToken));
  if (existing) return null;
  const writeToken = newId('wt');
  await putJson(authPath(profileToken), { hash: sha256(writeToken), createdAt: Date.now() });
  return writeToken;
}

// Reads the token a caller presented. Header only -- never a query parameter, which is the part of
// a URL most likely to end up in an access log or a Referer header.
export function presentedWriteToken(req) {
  const v = req.headers['x-cw-write-token'];
  return typeof v === 'string' ? v : null;
}

export function presentedProfileToken(req) {
  const v = req.headers['x-cw-profile-token'];
  return typeof v === 'string' ? v : null;
}

// Returns true when the presented token authorizes writes to this profile. Fails closed on every
// path: unknown profile, missing token, malformed token, and mismatch all return false, and none
// of them reveal which one it was to the caller.
export async function verifyWriteToken(profileToken, presented) {
  if (!isSafeId(profileToken) || typeof presented !== 'string' || !presented) return false;
  const rec = await getJson(authPath(profileToken));
  if (!rec || !rec.data || typeof rec.data.hash !== 'string') return false;
  return safeEqualHex(rec.data.hash, sha256(presented));
}
