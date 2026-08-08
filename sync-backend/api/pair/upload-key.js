// Step 5 of the pairing handshake (SYNC_DEVELOPER_BRIEF_v2.md §2.2 step 1.5). Called by the
// *inviting* device once its status poll (status.js) shows a joinerPublicKey has appeared. The
// inviter independently derives the one-time transport key (ECDH + HKDF, entirely client-side,
// this server is never involved in that derivation) and uploads K wrapped with it. This server
// only ever sees the wrapped ciphertext -- it cannot unwrap it, because it never has either
// device's private key or the transport key derived from them.
import { getJson, putJson, BlobPreconditionFailedError } from '../_lib/blob.js';
import { applyCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const { sessionId, wrappedKey } = req.body || {};
    if (!sessionId || !wrappedKey || !wrappedKey.ciphertext || !wrappedKey.iv) {
      res.status(400).json({ error: 'sessionId_and_wrappedKey_required' });
      return;
    }
    const sessionPath = `pair/${sessionId}.json`;
    const sessionEntry = await getJson(sessionPath);
    if (!sessionEntry) { res.status(404).json({ error: 'session_not_found' }); return; }
    if (!sessionEntry.data.joinerPublicKey) {
      res.status(400).json({ error: 'no_joiner_yet' });
      return;
    }

    const updated = { ...sessionEntry.data, wrappedKey };
    await putJson(sessionPath, updated, { ifMatch: sessionEntry.etag });
    res.status(200).json({ ok: true });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) {
      res.status(409).json({ error: 'race_try_again' });
      return;
    }
    res.status(500).json({ error: 'server_error', detail: String((e && e.message) || e) });
  }
}
