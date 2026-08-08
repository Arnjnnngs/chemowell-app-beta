// Step 3 of the pairing handshake (SYNC_DEVELOPER_BRIEF_v2.md §2.2 step 1.3). Called by the
// joining device after it scans/types the 6-digit code. Like create.js, this never receives or
// reveals anything key-equivalent -- just the joining device's own fresh, single-use ECDH public
// key, and in return, the inviter's public key (already-known-safe-to-expose) plus the profile's
// opaque lookup token.
import { getJson, putJson, BlobPreconditionFailedError } from '../_lib/blob.js';
import { applyCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const { code, publicKey } = req.body || {};
    if (!code || !publicKey) {
      res.status(400).json({ error: 'code_and_publicKey_required' });
      return;
    }

    const codeEntry = await getJson(`pair-code/${code}.json`);
    if (!codeEntry) { res.status(404).json({ error: 'code_not_found' }); return; }
    if (codeEntry.data.expiresAt < Date.now()) { res.status(410).json({ error: 'code_expired' }); return; }

    const sessionPath = `pair/${codeEntry.data.sessionId}.json`;
    const sessionEntry = await getJson(sessionPath);
    if (!sessionEntry) { res.status(404).json({ error: 'session_not_found' }); return; }
    if (sessionEntry.data.joinerPublicKey) {
      // Single-use by design (§2.2's "narrow window... single-use" property) -- a second redeem
      // attempt against an already-redeemed code is rejected outright, not silently accepted.
      res.status(409).json({ error: 'code_already_redeemed' });
      return;
    }

    const updated = { ...sessionEntry.data, joinerPublicKey: publicKey };
    await putJson(sessionPath, updated, { ifMatch: sessionEntry.etag });

    res.status(200).json({
      sessionId: updated.sessionId,
      profileToken: updated.profileToken,
      inviterPublicKey: updated.inviterPublicKey,
    });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) {
      res.status(409).json({ error: 'race_try_again' });
      return;
    }
    res.status(500).json({ error: 'server_error', detail: String((e && e.message) || e) });
  }
}
