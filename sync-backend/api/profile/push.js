// Push one record. This is the entire conflict-detection mechanism from
// SYNC_DEVELOPER_BRIEF_v2.md §3: optimistic concurrency on a plain integer `version`, using Vercel
// Blob's real ETag-based conditional write (`ifMatch`) as the atomic compare-and-swap primitive --
// not an approximation of one. The server never inspects `ciphertext` at all; every decision here
// is made from version numbers and opaque ids alone, exactly the "content-blind" property §3 calls
// for. What happens on a 409 (decrypt-and-compare, silently adopt vs. genuinely-conflicting) is
// entirely a client-side decision made after local decryption -- this endpoint's only job is to
// correctly detect "did this move since the caller last knew about it," nothing more.
import { getJson, putJson, isConditionalWriteConflict } from '../_lib/blob.js';
import { applyCors, requireMethod, readBody, rateLimit, isOpaqueString, MAX_CIPHERTEXT_CHARS, MAX_IV_CHARS } from '../_lib/guard.js';
import { isSafeId } from '../_lib/ids.js';
import { presentedProfileToken, presentedWriteToken, verifyWriteToken } from '../_lib/auth.js';

// Only the fields this server is allowed to know about are ever echoed back on a conflict. The
// original returned the raw stored object, which -- combined with an unvalidated recordId that
// could point anywhere in the store -- turned this endpoint into an unauthenticated read oracle
// for other users' pairing sessions, live pairing codes included. Even with traversal closed, a
// whitelist means a future field added to the stored record cannot leak by default.
function publicRecord(r) {
  if (!r) return null;
  return {
    recordId: r.recordId,
    kind: r.kind,
    version: r.version,
    updatedAt: r.updatedAt,
    lastWriterDevice: r.lastWriterDevice,
    ciphertext: r.ciphertext,
    iv: r.iv,
  };
}

const isVersion = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'POST')) return;
  if (rateLimit(req, res, { bucket: 'push', limit: 300 })) return;
  try {
    const body = readBody(req, res);
    if (!body) return;
    const { recordId, kind, baseVersion, newVersion, ciphertext, iv, deviceId } = body;
    // The profile token moved from the request body/query into a header, alongside the write
    // token, so neither ends up in an access log or a Referer.
    const token = presentedProfileToken(req);

    if (!isSafeId(token) || !isSafeId(recordId) || !isSafeId(deviceId)) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    if (kind !== 'med' && kind !== 'entry') {
      res.status(400).json({ error: 'invalid_kind' });
      return;
    }
    if (!isVersion(baseVersion) || !isVersion(newVersion)) {
      res.status(400).json({ error: 'invalid_version' });
      return;
    }
    // The compare-and-swap's own invariant, which was never enforced: one push advances a record
    // by exactly one version. Without this the server accepted newVersion:-99 and newVersion:1.5,
    // and a single buggy client could wedge a record into a state where every well-behaved device
    // got a permanent 409 it could never resolve.
    if (newVersion !== baseVersion + 1) {
      res.status(400).json({ error: 'invalid_version_step' });
      return;
    }
    if (!isOpaqueString(ciphertext, MAX_CIPHERTEXT_CHARS) || !isOpaqueString(iv, MAX_IV_CHARS)) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }

    // Writes require proof of pairing. Encryption alone made an unauthenticated write path look
    // harmless -- a stranger holding a profile token cannot READ anything, since it is all
    // ciphertext -- but it never stopped them DESTROYING a patient's medication record by pushing
    // over it. Confidentiality and integrity are separate properties; this is the integrity half.
    if (!(await verifyWriteToken(token, presentedWriteToken(req)))) {
      res.status(403).json({ error: 'not_authorized' });
      return;
    }

    const pathname = `profile/${token}/${recordId}.json`;
    const existing = await getJson(pathname);
    const record = { recordId, kind, version: newVersion, updatedAt: Date.now(), lastWriterDevice: deviceId, ciphertext, iv };

    if (!existing) {
      // First time this record has ever been pushed. baseVersion must be 0 -- the caller's own
      // signal that it believes this is a brand-new record, not an edit of a known one.
      if (baseVersion !== 0) {
        res.status(409).json({ error: 'conflict', current: null });
        return;
      }
      try {
        // allowOverwrite:false is itself a compare-and-swap here: if another device's push for the
        // same brand-new record lands between the read above and this write, the blob store
        // rejects the second writer instead of letting them stomp each other.
        await putJson(pathname, record, { allowOverwrite: false });
      } catch (e) {
        // DECIDE FROM STORAGE STATE, NOT FROM THE ERROR TEXT.
        //
        // An allowOverwrite:false collision does NOT surface as BlobPreconditionFailedError, and
        // it is not reliably identifiable from the message either: @vercel/blob's getBlobError()
        // has no already-exists case at all, so it falls through to the generic `bad_request` arm.
        // An earlier version of this handler classified by error shape and got it exactly
        // backwards -- every losing writer in a new-record race received HTTP 500 instead of a
        // 409. That is the first-sync-after-pairing path, where every record collides by
        // definition, so it would have hit real caregivers on their very first sync.
        //
        // Re-reading is authoritative and immune to SDK error-shape churn: if the record exists
        // now, somebody else created it and this is a genuine conflict the client can reconcile.
        // If it still does not exist, the write really did fail and must surface as an error
        // rather than as a phantom conflict against a record nobody ever wrote -- which is the
        // separate defect (F-10) this branch was tightened to fix in the first place. Both
        // failure modes are handled without either one masking the other.
        const raced = await getJson(pathname);
        if (!raced) throw e;
        res.status(409).json({ error: 'conflict', current: publicRecord(raced.data) });
        return;
      }
      res.status(200).json({ ok: true, record: publicRecord(record) });
      return;
    }

    if (existing.data.version !== baseVersion) {
      // Cheap check before even attempting the write: this device is already known to be behind.
      res.status(409).json({ error: 'conflict', current: publicRecord(existing.data) });
      return;
    }

    try {
      // The real atomicity guarantee: even if another device's push raced past the version check
      // above (same baseVersion, both in flight at once), only one ifMatch can win against the
      // blob's actual current ETag -- the loser gets a conflict, not a silent overwrite. This is
      // the one place true concurrent-write safety actually lives.
      await putJson(pathname, record, { ifMatch: existing.etag });
    } catch (e) {
      // Same storage-state test as the new-record branch above, and for the same reason. Vercel
      // Blob reports a lost conditional write in at least two different shapes -- only one of
      // which is BlobPreconditionFailedError; the other is a generic BlobError about a
      // "conflicting operation" -- and classifying by error shape is what produced 500s where the
      // client needed a 409. isConditionalWriteConflict (see _lib/blob.js) is kept as a fast path
      // for the shapes we know, but the authoritative answer is the record itself: if the stored
      // version has moved off the baseVersion this caller wrote against, somebody else won, full
      // stop. If it has NOT moved, the write genuinely failed and must surface as an error rather
      // than as a phantom conflict the client would try to reconcile against unchanged data.
      const raced = await getJson(pathname);
      const somebodyElseWon = raced && raced.data.version !== baseVersion;
      if (!somebodyElseWon && !isConditionalWriteConflict(e)) throw e;
      res.status(409).json({ error: 'conflict', current: publicRecord(raced && raced.data) });
      return;
    }
    res.status(200).json({ ok: true, record: publicRecord(record) });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
}
