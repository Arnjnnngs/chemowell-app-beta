// Polled by both sides of a pairing session (no realtime channel here -- plain HTTP polling, same
// posture as the ~45s sync loop). The inviting device polls this waiting for joinerPublicKey to
// appear so it knows when to run upload-key.js; the joining device polls it waiting for
// wrappedKey to appear so it can unwrap K locally. Every field returned here is either an ephemeral
// single-use public key or an AES-GCM-wrapped ciphertext of K -- never K itself, never anything
// derivable into K without a private key this server has never seen.
import { getJson } from '../_lib/blob.js';
import { applyCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const sessionId = req.query.session;
    if (!sessionId) { res.status(400).json({ error: 'session_required' }); return; }
    const sessionEntry = await getJson(`pair/${sessionId}.json`);
    if (!sessionEntry) { res.status(404).json({ error: 'session_not_found' }); return; }
    const s = sessionEntry.data;
    res.status(200).json({
      sessionId: s.sessionId,
      profileToken: s.profileToken,
      inviterPublicKey: s.inviterPublicKey,
      joinerPublicKey: s.joinerPublicKey,
      wrappedKey: s.wrappedKey,
      expiresAt: s.expiresAt,
      expired: s.expiresAt < Date.now(),
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String((e && e.message) || e) });
  }
}
