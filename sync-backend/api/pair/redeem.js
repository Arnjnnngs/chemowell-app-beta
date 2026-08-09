// Step 3 of the pairing handshake (SYNC_DEVELOPER_BRIEF_v2.md §2.2 step 1.3). Called by the
// joining device after it scans or types the pairing code. Like create.js, this never receives or
// reveals anything key-equivalent -- just the joining device's own fresh, single-use ECDH public
// key, and in return, the inviter's public key (already-known-safe-to-expose) plus the profile's
// opaque lookup token.
//
// Note what this endpoint does NOT return: the profile's write token. The server keeps only a hash
// of that and physically cannot hand it out. The joining device receives its copy inside the
// encrypted wrapped-key payload the inviter uploads in step 5, so the write token never crosses
// this server in a readable form at any point.
import { getJson, putJson, delQuiet, isConditionalWriteConflict } from '../_lib/blob.js';
import { applyCors, requireMethod, readBody, rateLimit, isOpaqueString } from '../_lib/guard.js';
import { normalizeCode, isSafeId } from '../_lib/ids.js';

const MAX_PUBKEY_CHARS = 2048;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'POST')) return;
  // Tighter than the other buckets: this is the endpoint an attacker would hammer to guess a code.
  // It is NOT what makes guessing infeasible -- the code's ~50 bits of entropy is (see ids.js) --
  // but there is no reason to serve a guessing machine at full speed either.
  if (rateLimit(req, res, { bucket: 'pair-redeem', limit: 30 })) return;
  try {
    const body = readBody(req, res);
    if (!body) return;
    const { code, publicKey } = body;
    const normalized = normalizeCode(code);
    if (!normalized || !isOpaqueString(publicKey, MAX_PUBKEY_CHARS)) {
      res.status(400).json({ error: 'code_and_publicKey_required' });
      return;
    }

    const codeEntry = await getJson(`pair-code/${normalized}.json`);
    if (!codeEntry) { res.status(404).json({ error: 'code_not_found' }); return; }
    if (codeEntry.data.expiresAt < Date.now()) {
      // Expired material is retired the moment anything touches it. The original never deleted
      // anything, so every code and every wrapped key ever created stayed live in the store
      // forever -- which is what let an attacker enumerate historical sessions rather than only
      // the one currently open.
      await delQuiet(`pair-code/${normalized}.json`);
      if (isSafeId(codeEntry.data.sessionId)) await delQuiet(`pair/${codeEntry.data.sessionId}.json`);
      res.status(410).json({ error: 'code_expired' });
      return;
    }
    if (!isSafeId(codeEntry.data.sessionId)) { res.status(404).json({ error: 'session_not_found' }); return; }

    const sessionPath = `pair/${codeEntry.data.sessionId}.json`;
    const sessionEntry = await getJson(sessionPath);
    if (!sessionEntry) { res.status(404).json({ error: 'session_not_found' }); return; }
    // The session carries its own expiry, and it is checked here rather than trusting the copy on
    // the code object. Two records holding the same deadline is two chances for them to disagree.
    if (sessionEntry.data.expiresAt < Date.now()) {
      await delQuiet(`pair-code/${normalized}.json`);
      await delQuiet(sessionPath);
      res.status(410).json({ error: 'code_expired' });
      return;
    }
    if (sessionEntry.data.joinerPublicKey) {
      // Single-use by design (§2.2's "narrow window... single-use" property) -- a second redeem
      // against an already-redeemed code is rejected outright, not silently accepted.
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
    // Two devices racing to redeem the same code: exactly one wins the conditional write, and the
    // loser is told the code is already used rather than being handed a 500 it cannot act on.
    if (isConditionalWriteConflict(e)) {
      res.status(409).json({ error: 'code_already_redeemed' });
      return;
    }
    res.status(500).json({ error: 'server_error' });
  }
}
