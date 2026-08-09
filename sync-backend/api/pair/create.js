// Step 1 of the pairing handshake (SYNC_DEVELOPER_BRIEF_v2.md §2.2 step 1). Called by whichever
// device already holds the profile's sync key K and is inviting a new device. This endpoint never
// receives K itself -- only a fresh, single-use ECDH *public* key, which is harmless to expose by
// the nature of Diffie-Hellman (it reveals nothing usable without the matching private key, which
// never leaves the inviting device).
import { putJson } from '../_lib/blob.js';
import { applyCors, requireMethod, readBody, rateLimit, isOpaqueString } from '../_lib/guard.js';
import { newId, newPairingCode, formatCode, isSafeId } from '../_lib/ids.js';
import { issueWriteToken, presentedWriteToken, verifyWriteToken } from '../_lib/auth.js';

const MAX_PUBKEY_CHARS = 2048;
const WINDOW_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'POST')) return;
  if (rateLimit(req, res, { bucket: 'pair-create', limit: 20 })) return;
  try {
    const body = readBody(req, res);
    if (!body) return;
    const { publicKey, profileToken } = body;
    if (!isOpaqueString(publicKey, MAX_PUBKEY_CHARS)) {
      res.status(400).json({ error: 'publicKey_required' });
      return;
    }

    // Two distinct cases, and conflating them was a real hole: a FIRST-EVER share (this call
    // mints the profile token) versus inviting an additional device to an ALREADY-SHARED profile.
    // The original accepted any caller-supplied profileToken and issued a pairing session bound to
    // it -- so a stranger could open a pairing session against someone else's profile. Reusing an
    // existing token now requires proving you already hold that profile's write token, which only
    // an already-paired device has.
    let token;
    let writeToken = null;
    if (profileToken !== undefined && profileToken !== null) {
      if (!isSafeId(profileToken)) { res.status(400).json({ error: 'invalid_profileToken' }); return; }
      const ok = await verifyWriteToken(profileToken, presentedWriteToken(req));
      if (!ok) { res.status(403).json({ error: 'not_authorized_for_profile' }); return; }
      token = profileToken;
    } else {
      token = newId('prof');
      // Returned exactly once, to the device that created the profile. The server keeps only a
      // SHA-256 hash of it (see _lib/auth.js) and can never hand it out again -- the joining
      // device receives its copy inside the encrypted wrapped-key payload, not from this server.
      writeToken = await issueWriteToken(token);
    }

    const sessionId = newId('sess');
    const code = newPairingCode();
    const now = Date.now();
    const session = {
      sessionId,
      code,
      profileToken: token,
      inviterPublicKey: publicKey,
      joinerPublicKey: null,
      wrappedKey: null,
      createdAt: now,
      expiresAt: now + WINDOW_MS,
    };

    await putJson(`pair/${sessionId}.json`, session);
    // Separate lookup-by-code object so redeem() doesn't need to scan every session -- the code is
    // the thing a caregiver actually reads aloud or scans, the sessionId is this backend's own
    // internal handle. allowOverwrite:false so a code collision fails loudly instead of silently
    // hijacking the older session (a 1-in-1e15 event now, but a silent wrong answer either way).
    await putJson(`pair-code/${code}.json`, { sessionId, expiresAt: session.expiresAt }, { allowOverwrite: false });

    res.status(200).json({
      sessionId,
      code: formatCode(code),
      expiresAt: session.expiresAt,
      profileToken: token,
      ...(writeToken ? { writeToken } : {}),
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
}
