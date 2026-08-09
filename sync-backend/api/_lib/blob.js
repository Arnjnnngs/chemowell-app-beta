// Thin JSON-object wrapper around @vercel/blob, used by every endpoint here. This backend never
// stores anything except: (a) opaque pairing-handshake material (two ECDH public keys and one
// AES-GCM-wrapped copy of the profile's sync key -- SYNC_DEVELOPER_BRIEF_v2.md §2.2) and (b)
// per-record ciphertext + content-blind metadata (§2.3/§3). Every value written here is either
// already unreadable without a key this server never has, or is metadata explicitly scoped in the
// brief as safe to leave as plaintext (opaque ids, integer versions, timestamps).
//
// STORE ACCESS MODE: private (`access: 'private'` on every write, authenticated reads via get()).
// The store backing this API was deliberately created as a PRIVATE Vercel Blob store. That is a
// second, independent layer underneath the end-to-end encryption: pathnames here are stable and
// non-random (addRandomSuffix:false, required for the compare-and-swap below), so on a public
// store the only thing between a stranger and the stored bytes would be the secrecy of a URL.
// Those bytes are ciphertext, so a public store would not by itself be a plaintext breach -- but
// "the ciphertext is only as private as a URL" is a weaker promise than this project made.
// Verified, not assumed: an unauthenticated GET of a real blob URL in this store returns HTTP 403
// (Zero Day Auditor, outputs/AUDIT_sync_backend_provisioning.md, tests T40-T46).
import { put, get, list, del, BlobPreconditionFailedError, BlobError } from '@vercel/blob';

export { BlobPreconditionFailedError };

const ACCESS = 'private';

// Stable pathnames (addRandomSuffix:false) so the same logical object can be looked up and
// overwritten by pathname alone -- this is what makes get()+put({ifMatch}) work as a real, atomic
// compare-and-swap (see getJson below), not just a best-effort race.
//
// NOTE THE SPREAD ORDER: caller options are applied FIRST, then access/addRandomSuffix/contentType
// overwrite them. The reverse order (caller last) let a caller silently pass `access:'public'` and
// undo the privacy layer, or `addRandomSuffix:true` and break every compare-and-swap in the
// backend, with no error either time. No caller does that today; this makes it impossible rather
// than merely absent. `ifMatch` and `allowOverwrite` are the two options callers legitimately set
// and neither collides with the fixed set below.
export async function putJson(pathname, obj, opts) {
  return put(pathname, JSON.stringify(obj), {
    ...(opts || {}),
    access: ACCESS,
    addRandomSuffix: false,
    contentType: 'application/json',
    allowOverwrite: (opts && opts.allowOverwrite === false) ? false : true,
  });
}

// Returns { data, etag, url } or null if nothing exists at that pathname yet. The etag is what
// callers pass back into putJson's `ifMatch` option to get a genuinely atomic conditional write
// (Vercel Blob's own optimistic-concurrency primitive) -- the mechanism
// SYNC_DEVELOPER_BRIEF_v2.md §3 calls for, not an approximation of it.
//
// `useCache: false` is load-bearing, not a nicety, and it is worth being precise about WHY,
// because the previous version of this comment described the wrong failure and a future reader
// acting on it would draw the wrong conclusion.
//
// The old read path was head() + fetch(blobUrl, { cache: 'no-store' }). head() calls the Blob
// control-plane API, so the ETag it returned was always CURRENT. The body, fetched from the blob's
// CDN URL, could be STALE -- `cache: 'no-store'` only controls the calling runtime's own HTTP
// cache (and in the Node/undici runtime a Vercel function actually runs in, there is no such cache
// at all, so it was closer to a no-op), never Vercel's edge cache in front of blob storage.
//
// Fresh etag + stale body is the dangerous combination, and strictly worse than both being stale:
// if the etag were also stale the conditional write would simply fail and produce a safe 409. What
// actually happened instead was that push.js compared the caller's baseVersion against a STALE
// `data.version`, a genuinely-behind device could match it, and its ifMatch then passed against
// the real current etag -- so the write succeeded and silently clobbered the newer value, which is
// exactly the conflict the design exists to catch. Reading from origin makes body and etag come
// from the same point in time, which is the property the compare-and-swap actually depends on.
export async function getJson(pathname) {
  let result;
  try {
    result = await get(pathname, { access: ACCESS, useCache: false });
  } catch (e) {
    if (isNotFound(e)) return null;
    // Anything genuinely unexpected (auth failure, store suspended, network) is rethrown so the
    // endpoint 500s loudly. A real outage must never be misreported to the app as "nothing stored
    // yet" -- that reads to a caregiver as an empty medication list rather than as an error, which
    // is the fail-closed-but-silent shape that hid a live defect in this project from app-v47
    // through app-v50.
    throw e;
  }
  if (!result || !result.stream) return null;
  const data = await new Response(result.stream).json();
  return { data, etag: result.blob.etag, url: result.blob.url };
}

// Not-found detection, centralized because getting it wrong is silent in both directions.
//
// The previous implementation tested `e.name === 'BlobNotFoundError' || /not.?found/i.test(msg)`.
// Both halves were dead: every @vercel/blob error class reports `e.name === 'Error'`, and the real
// message is "does not exist", which /not.?found/i does not match. It was also too broad in the
// other direction -- /not.?found/i matches Node's ENOTFOUND (a DNS failure, i.e. a real outage).
// This version matches the SDK's actual not-found shape and nothing else.
function isNotFound(e) {
  if (!e) return false;
  // Only a genuine Blob-layer error can mean "nothing stored there". A transport/DNS failure is
  // not a Blob error and must never be collapsed into an empty result.
  if (!(e instanceof BlobError)) return false;
  const msg = String(e.message || '');
  return /does not exist/i.test(msg) || /blob not found/i.test(msg);
}

// Vercel Blob signals a failed conditional write two different ways, and only one of them is
// BlobPreconditionFailedError. The other arrives as a generic BlobError carrying "The conditional
// request cannot succeed due to a conflicting operation against this resource." The audit measured
// the second shape on 30-37% of losing writers in real concurrent pushes; because only the first
// was being caught, those callers received HTTP 500 instead of the 409-with-current-record the
// design requires -- so the app's conflict-resolution path never ran and the losing device's edit
// was dropped while the user was told "server error." Both shapes mean the same thing to every
// caller here: somebody else got there first.
export function isConditionalWriteConflict(e) {
  if (e instanceof BlobPreconditionFailedError) return true;
  const msg = String((e && e.message) || '');
  return /conditional request cannot succeed/i.test(msg)
    || /conflicting operation/i.test(msg)
    || /precondition/i.test(msg);
}

// Lists every JSON object under a prefix and returns their parsed contents.
//
// PAGES PROPERLY, and that is not a detail: list() defaults to limit:1000 and reports `hasMore` +
// `cursor`. The previous implementation destructured neither, so a profile with more than 1,000
// records returned exactly 1,000 of them with HTTP 200 and no flag of any kind -- the audit
// reproduced this with 1,131 records and watched 131 vanish silently. On a medication list that is
// worse than an error: a caregiver sees a plausible-looking list with entries missing and nothing
// anywhere says so. A patient logging a few times a day reaches 1,000 records in about a year, so
// this was a "when," not an "if."
//
// `hardLimit` is a real ceiling rather than a silent truncation: callers are told (via the
// returned `truncated` flag) when it was hit, so the API can say so instead of pretending.
export async function listJson(prefix, hardLimit = 5000) {
  const out = [];
  let cursor;
  let truncated = false;
  for (;;) {
    const page = await list({ prefix, limit: 1000, cursor });
    for (const b of page.blobs) {
      if (out.length >= hardLimit) { truncated = true; break; }
      const entry = await getJson(b.pathname);
      // A blob deleted between the list and the read is a normal race, not an error -- skip it
      // rather than failing the whole pull for every other record.
      if (entry) out.push(entry.data);
    }
    if (truncated || !page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
  return { records: out, truncated };
}

// Best-effort delete. Used to retire pairing material the moment it stops being needed (see
// SYNC_DEVELOPER_BRIEF_v2.md's cleanup requirement, which the first implementation never built --
// every pairing code and wrapped key ever created stayed readable forever, and storage grew
// without bound). Failure to delete is never allowed to fail the caller's actual operation: the
// worst case is that a already-neutralized object lingers, which is the state we were already in.
export async function delQuiet(pathname) {
  try {
    await del(pathname);
    return true;
  } catch (e) {
    return false;
  }
}
