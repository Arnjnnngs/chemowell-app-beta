// Polled by both sides of a pairing session (no realtime channel here -- plain HTTP polling, same
// posture as the ~45s sync loop). The inviting device polls this waiting for joinerPublicKey to
// appear so it knows when to run upload-key; the joining device polls it waiting for wrappedKey to
// appear so it can unwrap K locally. Every field returned here is either an ephemeral single-use
// public key or an AES-GCM-wrapped ciphertext -- never K itself, never anything derivable into K
// without a private key this server has never seen.
import { getJson, delQuiet } from '../_lib/blob.js';
import { applyCors, requireMethod, rateLimit } from '../_lib/guard.js';
import { isSafeId } from '../_lib/ids.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'GET')) return;
  if (rateLimit(req, res, { bucket: 'pair-status', limit: 120 })) return;
  try {
    const sessionId = req.query.session;
    // Validated, not just checked for presence. Unvalidated ids here were half of a path-traversal
    // read oracle: `?session=../profile/<token>/rec1` resolved to a real blob outside the pairing
    // namespace and answered whether it existed. Restricting to [A-Za-z0-9_-] removes the entire
    // class rather than that one instance.
    if (!isSafeId(sessionId)) { res.status(400).json({ error: 'session_required' }); return; }

    const sessionEntry = await getJson(`pair/${sessionId}.json`);
    if (!sessionEntry) { res.status(404).json({ error: 'session_not_found' }); return; }
    const s = sessionEntry.data;

    if (s.expiresAt < Date.now()) {
      // Expiry is now enforced, not merely reported. The original returned `expired: true`
      // alongside both public keys AND the full wrapped key, indefinitely, for any session that
      // had ever existed -- an advisory flag next to the very material the window was supposed to
      // close off. Retiring it on touch also bounds storage growth, which nothing previously did.
      await delQuiet(`pair/${sessionId}.json`);
      if (typeof s.code === 'string' && isSafeId(s.code)) await delQuiet(`pair-code/${s.code}.json`);
      res.status(410).json({ error: 'session_expired', expired: true });
      return;
    }

    res.status(200).json({
      sessionId: s.sessionId,
      profileToken: s.profileToken,
      inviterPublicKey: s.inviterPublicKey,
      joinerPublicKey: s.joinerPublicKey,
      wrappedKey: s.wrappedKey,
      expiresAt: s.expiresAt,
      expired: false,
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
}
