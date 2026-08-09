// Thin JSON-object wrapper around @vercel/blob, used by every endpoint below. This backend never
// stores anything except: (a) opaque pairing-handshake material (two ECDH public keys and one
// AES-GCM-wrapped copy of the profile's sync key -- SYNC_DEVELOPER_BRIEF_v2.md §2.2) and (b)
// per-record ciphertext + content-blind metadata (§2.3/§3). Every value written here is either
// already unreadable without a key this server never has, or is metadata explicitly scoped in the
// brief as safe to leave as plaintext (opaque ids, integer versions, timestamps).
//
// STORE ACCESS MODE: private (`access: 'private'` on every write, authenticated reads via get()).
// The store backing this API was deliberately created as a PRIVATE Vercel Blob store, not a public
// one. That is a second, independent layer underneath the end-to-end encryption: with a public
// store, every object is readable by anyone who can construct its URL, and because these pathnames
// are deliberately stable and non-random (addRandomSuffix:false, required for the compare-and-swap
// below), the only thing standing between a stranger and the raw stored bytes would be the secrecy
// of the profile token embedded in the pathname. Those bytes are ciphertext, so a public store
// would not by itself be a plaintext breach -- but "the ciphertext is only as private as a URL"
// is a weaker promise than this project made, so reads require the store's own credential too.
// Both layers have to fail before anything is exposed, and neither one alone reveals plaintext.
import { put, get, list, BlobPreconditionFailedError } from '@vercel/blob';

export { BlobPreconditionFailedError };

const ACCESS = 'private';

// Stable pathnames (addRandomSuffix:false) so the same logical object can be looked up and
// overwritten by pathname alone -- this is what makes get()+put({ifMatch}) work as a real,
// atomic compare-and-swap (see getJson below), not just a best-effort race.
export async function putJson(pathname, obj, opts) {
  return put(pathname, JSON.stringify(obj), {
    access: ACCESS,
    addRandomSuffix: false,
    contentType: 'application/json',
    allowOverwrite: true,
    ...(opts || {}),
  });
}

// Returns { data, etag, url } or null if nothing exists at that pathname yet. The etag is what
// callers pass back into putJson's `ifMatch` option to get a genuinely atomic conditional write
// (Vercel Blob's own optimistic-concurrency primitive) -- this is the mechanism
// SYNC_DEVELOPER_BRIEF_v2.md §3 calls for, not an approximation of it.
//
// `useCache: false` is load-bearing, not a nicety. The compare-and-swap is only sound if the etag
// we read is the etag of the CURRENT stored object. A cached read can hand back a stale body AND
// its stale etag, so a caller would merge onto old content and then successfully write it with an
// ifMatch that the store still considers valid -- silently clobbering a concurrent update instead
// of getting the 412 the design depends on. Reading from origin makes the etag we compare against
// the real one. (The previous implementation fetched the blob's CDN URL with fetch's own
// `cache: 'no-store'`, which only bypasses the local HTTP cache in the calling runtime -- it does
// not bypass Vercel's edge cache in front of blob storage, so that read could be stale.)
export async function getJson(pathname) {
  let result;
  try {
    result = await get(pathname, { access: ACCESS, useCache: false });
  } catch (e) {
    // get() resolves null for a missing blob, but a not-found can also surface as a thrown
    // BlobNotFoundError depending on the path taken inside the SDK. Both mean the same thing to
    // every caller here ("nothing stored yet"), so both collapse to null. Anything genuinely
    // unexpected (auth failure, store suspended, network) is rethrown so the endpoint 500s
    // loudly instead of a real outage being misread as an empty store.
    if (e && (e.name === 'BlobNotFoundError' || /not.?found/i.test(String(e.message || '')))) {
      return null;
    }
    throw e;
  }
  if (!result || !result.stream) return null;
  const data = await new Response(result.stream).json();
  return { data, etag: result.blob.etag, url: result.blob.url };
}

// Lists every JSON object under a prefix and fetches its content. Used for profile pull (every
// medication/entry record for a profile token) -- fine at this project's scale (single-digit
// caregivers, realistically dozens to low hundreds of records per profile, polled every ~45s, not
// a high-frequency or high-volume path). Reads go through getJson (authenticated, origin-fresh)
// rather than the listed CDN URLs, because a private store's URLs are not readable unauthenticated.
export async function listJson(prefix) {
  const { blobs } = await list({ prefix });
  const out = [];
  for (const b of blobs) {
    const entry = await getJson(b.pathname);
    // A blob deleted between the list and the read is a normal race, not an error -- skip it
    // rather than failing the whole pull for every other record.
    if (entry) out.push(entry.data);
  }
  return out;
}
