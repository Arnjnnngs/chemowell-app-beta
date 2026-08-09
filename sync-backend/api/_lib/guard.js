// Request-level guards shared by every endpoint: CORS, method checks, body size/shape limits, and
// a best-effort rate limiter.
//
// Honest framing on the rate limiter, because overstating it is how the original design went
// wrong: this is per-instance, in-memory, and a serverless platform will happily run many
// instances at once, so a determined attacker with a spread of connections can get more than the
// stated rate. It is defense in depth and nothing more. The actual protection against guessing a
// pairing code lives in the code's own entropy (see ids.js newPairingCode -- ~50 bits, up from the
// original 6 digits), specifically so that security does NOT depend on a limiter this environment
// cannot honestly guarantee. That inversion is the point: the earlier design justified a weak
// secret by assuming a strong limiter that was never built.

const BUCKETS = new Map();
const WINDOW_MS = 60 * 1000;
const SWEEP_AT = 5000; // entries, before a housekeeping pass -- bounds memory on a warm instance

// Vercel sets x-forwarded-for; the leftmost entry is the client as seen by the edge. A spoofed
// header only lets an attacker rate-limit themselves less, which is already the assumption above,
// so this doesn't need to be tamper-proof to be worth having.
function clientKey(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

export function rateLimit(req, res, { limit, bucket }) {
  const now = Date.now();
  if (BUCKETS.size > SWEEP_AT) {
    for (const [k, v] of BUCKETS) if (now - v.start > WINDOW_MS) BUCKETS.delete(k);
  }
  const key = bucket + '|' + clientKey(req);
  let entry = BUCKETS.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    BUCKETS.set(key, entry);
  }
  entry.count++;
  if (entry.count > limit) {
    const retry = Math.max(1, Math.ceil((entry.start + WINDOW_MS - now) / 1000));
    res.setHeader('Retry-After', String(retry));
    res.status(429).json({ error: 'rate_limited', retryAfterSeconds: retry });
    return true;
  }
  return false;
}

// Shared across every endpoint: this backend is called cross-origin from the app's GitHub Pages
// origin (and, in the Capacitor build, from the WebView's own origin), so every response needs
// CORS headers and every OPTIONS preflight needs a clean 204.
//
// `x-cw-write-token` and `x-cw-profile-token` are listed because the profile token and the write
// token moved OUT of the query string and into headers: a query string is the part of a URL most
// likely to be written to an access log, a proxy record, or a Referer header, and both of those
// values gate access to a patient's records.
export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cw-write-token, x-cw-profile-token');
  res.setHeader('Access-Control-Max-Age', '86400');
  // Nothing this API returns should ever be cached by anything in between.
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Every handler declares the one method it accepts. The original health endpoint accepted any
// verb; harmless there, but "every endpoint states its method" is the kind of rule that only works
// if it has no exceptions.
export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method + ', OPTIONS');
    res.status(405).json({ error: 'method_not_allowed' });
    return true;
  }
  return false;
}

// Vercel parses a JSON body for us, but parses it permissively -- a malformed body surfaced as a
// thrown error inside the handler and came back as a 500 with the raw SDK text echoed to the
// caller. A client sending bad JSON is a client error, and the app should be able to tell that
// apart from "the backend is down."
export function readBody(req, res) {
  const b = req.body;
  if (b === undefined || b === null || typeof b !== 'object' || Array.isArray(b)) {
    res.status(400).json({ error: 'invalid_json_body' });
    return null;
  }
  return b;
}

// Ciphertext/iv arrive as opaque base64-ish strings and are never parsed, so the only things worth
// checking are that they ARE strings and that they are not absurd. Without this, the API accepted
// a 4 MB single record, an object where a string belonged, and unlimited records per token, from
// an unauthenticated caller.
export const MAX_CIPHERTEXT_CHARS = 256 * 1024; // ~192 KB of payload; a medication/entry record is orders of magnitude smaller
export const MAX_IV_CHARS = 256;

export function isOpaqueString(v, max) {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}
