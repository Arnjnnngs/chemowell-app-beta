// Step 5 of the pairing handshake (SYNC_DEVELOPER_BRIEF_v2.md §2.2 step 1.5). Called by the
// *inviting* device once its status poll shows a joinerPublicKey has appeared. The inviter
// independently derives the one-time transport key (ECDH + HKDF, entirely client-side -- this
// server is never involved in that derivation) and uploads the profile's secrets wrapped with it.
// This server only ever sees the wrapped ciphertext: it cannot unwrap it, because it never has
// either device's private key or the transport key derived from them.
//
// The wrapped payload carries BOTH the sync key K and the profile's write token. That is why
// redeem.js can hand the joining device a profile token but no write authority -- the write token
// reaches the joiner only inside this ciphertext, so it never crosses this server readably.
import { getJson, putJson, delQuiet, isConditionalWriteConflict } from '../_lib/blob.js';
import { applyCors, requireMethod, readBody, rateLimit, isOpaqueString, MAX_CIPHERTEXT_CHARS, MAX_IV_CHARS } from '../_lib/guard.js';
import { isSafeId } from '../_lib/ids.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'POST')) return;
  if (rateLimit(req, res, { bucket: 'pair-upload-key', limit: 30 })) return;
  try {
    const body = readBody(req, res);
    if (!body) return;
    const { sessionId, wrappedKey } = body;
    if (!isSafeId(sessionId) || !wrappedKey || typeof wrappedKey !== 'object'
      || !isOpaqueString(wrappedKey.ciphertext, MAX_CIPHERTEXT_CHARS)
      || !isOpaqueString(wrappedKey.iv, MAX_IV_CHARS)) {
      res.status(400).json({ error: 'sessionId_and_wrappedKey_required' });
      return;
    }

    const sessionPath = `pair/${sessionId}.json`;
    const sessionEntry = await getJson(sessionPath);
    if (!sessionEntry) { res.status(404).json({ error: 'session_not_found' }); return; }

    // This endpoint had NO expiry check at all. A wrapped key could be accepted long after the
    // pairing window closed, on a session that nothing ever deleted -- so create.js's "~10-minute
    // single-use window" comment was untrue of the two endpoints that actually carry the key.
    if (sessionEntry.data.expiresAt < Date.now()) {
      await delQuiet(sessionPath);
      if (typeof sessionEntry.data.code === 'string' && isSafeId(sessionEntry.data.code)) {
        await delQuiet(`pair-code/${sessionEntry.data.code}.json`);
      }
      res.status(410).json({ error: 'session_expired' });
      return;
    }
    if (!sessionEntry.data.joinerPublicKey) {
      res.status(400).json({ error: 'no_joiner_yet' });
      return;
    }
    // Single-use, which it previously was not: anyone who knew a sessionId could overwrite the
    // wrapped key repeatedly. They could not forge a valid wrap (they lack the transport key), but
    // they could replace a good one with garbage and break the pairing at will -- and a caregiver
    // hitting that would see pairing fail for no discoverable reason.
    if (sessionEntry.data.wrappedKey) {
      res.status(409).json({ error: 'key_already_uploaded' });
      return;
    }

    const updated = { ...sessionEntry.data, wrappedKey };
    await putJson(sessionPath, updated, { ifMatch: sessionEntry.etag });
    res.status(200).json({ ok: true });
  } catch (e) {
    if (isConditionalWriteConflict(e)) {
      res.status(409).json({ error: 'key_already_uploaded' });
      return;
    }
    res.status(500).json({ error: 'server_error' });
  }
}
