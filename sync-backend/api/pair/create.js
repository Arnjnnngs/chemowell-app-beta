// Step 1 of the pairing handshake (SYNC_DEVELOPER_BRIEF_v2.md §2.2 step 1). Called by whichever
// device already holds the profile's sync key K and is inviting a new device. This endpoint never
// receives K itself -- only a fresh, single-use ECDH *public* key, which is harmless to expose by
// the nature of Diffie-Hellman (it reveals nothing usable without the matching private key, which
// never leaves the inviting device).
import { putJson } from '../_lib/blob.js';
import { applyCors, randomId } from '../_lib/cors.js';

function randomCode() {
  // 6-digit numeric code, same UX as the brief's design -- easy to read aloud or type, short
  // ~10-minute single-use window limits how much a guess-the-code attack can accomplish.
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const { publicKey, profileToken } = req.body || {};
    if (!publicKey || typeof publicKey !== 'string') {
      res.status(400).json({ error: 'publicKey_required' });
      return;
    }

    const sessionId = randomId('sess');
    const code = randomCode();
    // profileToken is passed in when a profile that's already shared invites another device (the
    // token already exists); omitted for a first-ever share, in which case this is the token's
    // birth -- opaque, not secret, just the lookup id for push/pull (§2.3).
    const token = (profileToken && typeof profileToken === 'string') ? profileToken : randomId('prof');
    const now = Date.now();
    const session = {
      sessionId,
      code,
      profileToken: token,
      inviterPublicKey: publicKey,
      joinerPublicKey: null,
      wrappedKey: null,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
    };

    await putJson(`pair/${sessionId}.json`, session);
    // Separate lookup-by-code object so redeem() doesn't need to scan every session -- the code is
    // the thing Aaron actually types/scans, the sessionId is this backend's own internal handle.
    await putJson(`pair-code/${code}.json`, { sessionId, expiresAt: session.expiresAt });

    res.status(200).json({ sessionId, code, expiresAt: session.expiresAt, profileToken: token });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String((e && e.message) || e) });
  }
}
