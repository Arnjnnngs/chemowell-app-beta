// Identifier generation, validation, and constant-time comparison for the sync relay.
//
// WHY THIS FILE EXISTS: every id in this backend is load-bearing for security, not just for
// lookup. A pairing code is the only thing standing between a stranger and a profile's encryption
// key during the pairing window; a session id addresses that pairing state; a profile token
// addresses a patient's whole record set. The first version of this backend generated all three
// with `Math.random()` and interpolated them straight into blob pathnames. A Zero Day Auditor pass
// (outputs/AUDIT_sync_backend_provisioning.md) turned both of those into working attacks, so id
// generation and id validation now live in one place that every endpoint is required to go
// through, rather than being open-coded per endpoint where one omission is invisible.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

// Crockford base32: no I, L, O or U. Removes the read-aloud ambiguities (1/I/l, 0/O) that matter
// when one caregiver is reading a code to another over the phone, and drops U so the alphabet
// can't produce accidental profanity in a code a patient has to read out.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// Rejection sampling, not `% 32`. randomBytes gives 0-255; 256 is a multiple of 32, so modulo is
// actually unbiased here -- but that is a property of this specific alphabet length, and it would
// silently become a bias the day someone edits ALPHABET. Rejecting out-of-range bytes stays
// correct for any alphabet, so the safety doesn't depend on remembering why.
function randomChars(n) {
  const max = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < n) {
    const buf = randomBytes(n * 2);
    for (let i = 0; i < buf.length && out.length < n; i++) {
      if (buf[i] < max) out += ALPHABET[buf[i] % ALPHABET.length];
    }
  }
  return out;
}

// PAIRING CODE -- 10 characters of Crockford base32 = 32^10 ~= 1.13e15 (~50 bits).
//
// This replaced a 6-digit numeric code (900,000 possibilities). The audit measured 270.7
// req/s against this API with no limiter, which is ~162,000 guesses inside the code's own
// 10-minute window -- about an 18% chance of hitting a live 6-digit code per session, trivially
// parallelised. The original design justified 6 digits by assuming a rate limiter that was never
// built, and a serverless backend with no shared state has no honest way to enforce one across
// instances. So the strength lives in the secret itself rather than in a limiter that can't be
// guaranteed: at the same measured 270 req/s, exhausting even 1% of this space takes ~1,300 years.
// The in-memory limiter in ratelimit.js is defense in depth on top of this, not the thing being
// relied on.
//
// UX cost is small and this is the part a human actually handles: it's displayed grouped as
// XXXXX-XXXXX, it's normally transferred by QR rather than typed, and normalizeCode() below
// accepts it back in any case, with or without the dash, and repairs the classic
// O->0 / I->1 / L->1 transcription slips.
export function newPairingCode() {
  return randomChars(10);
}

export function formatCode(code) {
  return code.slice(0, 5) + '-' + code.slice(5);
}

// Accepts what a human or a scanner actually produces -- lowercase, spaces, dashes, and the
// substitutions people make when reading letters aloud -- and returns the canonical form, or null
// if it isn't a plausible code at all. Doing this here means no endpoint has to guess.
export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (cleaned.length !== 10) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

// Opaque ids (session ids, profile tokens, write tokens). 26 chars ~= 130 bits, all of it from a
// CSPRNG. The previous implementation was `prefix + Date.now().toString(36) +
// Math.random().toString(36).slice(2,10)`: the timestamp half is fully predictable, and V8's
// Math.random is xorshift128+, whose internal state is recoverable from a handful of consecutive
// outputs -- which this backend handed out for free, since one /pair/create call returned three
// consecutive draws in a fixed order. Anything derived from that was predictable, not random.
export function newId(prefix) {
  return prefix + randomChars(26);
}

// Every id that reaches a blob pathname must match this. The audit's Critical finding was a path
// traversal: `recordId: "pair/sessXXXX"` in a push body escaped the profile/ namespace, and a
// deliberately-wrong baseVersion made the conflict response echo the whole stored object back --
// turning push into an unauthenticated read oracle for any blob in the store, including other
// users' live pairing codes. Rejecting anything outside [A-Za-z0-9_-] at the edge closes the
// entire class rather than that one instance of it: no '/', no '.', no encoded separator survives.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isSafeId(v) {
  return typeof v === 'string' && SAFE_ID.test(v);
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// Compares two hex digests without leaking, through timing, how many leading characters matched.
// Lengths are normalized first because timingSafeEqual throws on a length mismatch, and a throw
// is itself an observable early exit.
export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
