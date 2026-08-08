// Push one record. This is the entire conflict-detection mechanism from
// SYNC_DEVELOPER_BRIEF_v2.md §3: optimistic concurrency on a plain integer `version`, using Vercel
// Blob's real ETag-based conditional write (`ifMatch`) as the atomic compare-and-swap primitive --
// not an approximation of one. The server never inspects `ciphertext` at all; every decision here
// is made from version numbers and opaque ids alone, exactly the "content-blind" property §3 calls
// for. What happens on a 409 (decrypt-and-compare, silently adopt vs. genuinely-conflicting) is
// entirely a client-side decision made after local decryption -- this endpoint's only job is to
// correctly detect "did this move since the caller last knew about it," nothing more.
import { getJson, putJson, BlobPreconditionFailedError } from '../_lib/blob.js';
import { applyCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const { token, recordId, kind, baseVersion, newVersion, ciphertext, iv, deviceId } = req.body || {};
    if (!token || !recordId || !kind || typeof baseVersion !== 'number' || typeof newVersion !== 'number'
      || !ciphertext || !iv || !deviceId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    if (kind !== 'med' && kind !== 'entry') {
      res.status(400).json({ error: 'invalid_kind' });
      return;
    }

    const pathname = `profile/${token}/${recordId}.json`;
    const existing = await getJson(pathname);

    if (!existing) {
      // First time this record has ever been pushed. baseVersion must be 0 (the caller's own
      // signal that it believes this is a brand-new record, not an edit of a known one).
      if (baseVersion !== 0) {
        res.status(409).json({ error: 'conflict', current: null });
        return;
      }
      const record = { recordId, kind, version: newVersion, updatedAt: Date.now(), lastWriterDevice: deviceId, ciphertext, iv };
      try {
        // allowOverwrite:false is itself a compare-and-swap here: if another device's push for the
        // same brand-new record lands between our getJson() above and this put(), the blob store
        // rejects the second writer instead of silently letting them stomp each other.
        await putJson(pathname, record, { allowOverwrite: false });
      } catch (e) {
        const raced = await getJson(pathname);
        res.status(409).json({ error: 'conflict', current: raced ? raced.data : null });
        return;
      }
      res.status(200).json({ ok: true, record });
      return;
    }

    if (existing.data.version !== baseVersion) {
      // Cheap check before even attempting the write: this device is already known to be behind.
      res.status(409).json({ error: 'conflict', current: existing.data });
      return;
    }

    const record = { recordId, kind, version: newVersion, updatedAt: Date.now(), lastWriterDevice: deviceId, ciphertext, iv };
    try {
      // The real atomicity guarantee: even if another device's push raced past the version check
      // above (same baseVersion, both in flight at once), only one ifMatch can win against the
      // blob's actual current ETag -- the loser gets BlobPreconditionFailedError, not a silent
      // overwrite. This is the one place true concurrent-write safety actually lives.
      await putJson(pathname, record, { ifMatch: existing.etag });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) {
        const raced = await getJson(pathname);
        res.status(409).json({ error: 'conflict', current: raced ? raced.data : null });
        return;
      }
      throw e;
    }
    res.status(200).json({ ok: true, record });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String((e && e.message) || e) });
  }
}
