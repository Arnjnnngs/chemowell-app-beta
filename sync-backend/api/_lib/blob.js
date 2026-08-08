// Thin JSON-object wrapper around @vercel/blob, used by every endpoint below. This backend never
// stores anything except: (a) opaque pairing-handshake material (two ECDH public keys and one
// AES-GCM-wrapped copy of the profile's sync key -- SYNC_DEVELOPER_BRIEF_v2.md §2.2) and (b)
// per-record ciphertext + content-blind metadata (§2.3/§3). Every value written here is either
// already unreadable without a key this server never has, or is metadata explicitly scoped in the
// brief as safe to leave as plaintext (opaque ids, integer versions, timestamps).
import { put, head, list, BlobPreconditionFailedError } from '@vercel/blob';

export { BlobPreconditionFailedError };

// Stable pathnames (addRandomSuffix:false) so the same logical object can be looked up and
// overwritten by pathname alone -- this is what makes head()+put({ifMatch}) work as a real,
// atomic compare-and-swap (see putJson below), not just a best-effort race.
export async function putJson(pathname, obj, opts) {
  return put(pathname, JSON.stringify(obj), {
    access: 'public',
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
export async function getJson(pathname) {
  let meta;
  try {
    meta = await head(pathname);
  } catch (e) {
    return null; // no blob at this pathname yet
  }
  const res = await fetch(meta.url, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return { data, etag: meta.etag, url: meta.url };
}

// Lists every JSON object under a prefix and fetches its content. Used for profile pull (every
// medication/entry record for a profile token) -- fine at this project's scale (single-digit
// caregivers, realistically dozens to low hundreds of records per profile, polled every ~45s, not
// a high-frequency or high-volume path).
export async function listJson(prefix) {
  const { blobs } = await list({ prefix });
  const out = [];
  for (const b of blobs) {
    const res = await fetch(b.url, { cache: 'no-store' });
    if (res.ok) out.push(await res.json());
  }
  return out;
}
