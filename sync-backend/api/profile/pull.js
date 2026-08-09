// Full-pull of every medication/entry record for a profile (SYNC_DEVELOPER_BRIEF_v2.md §6, slice 1
// scope). Every record returned here has a `ciphertext`/`iv` pair this server cannot decrypt --
// only `recordId`, `kind`, `version`, `updatedAt`, `lastWriterDevice` are readable server-side, and
// none of those are patient content (§2.3). Simple full-list rather than delta-since-timestamp:
// appropriate at this project's realistic scale (single-digit caregivers, dozens-to-low-hundreds of
// records, polled every ~45s) -- a delta endpoint is a straightforward additive change later if a
// profile's record count ever makes full-pull expensive, not a redesign.
import { listJson } from '../_lib/blob.js';
import { applyCors, requireMethod, rateLimit } from '../_lib/guard.js';
import { isSafeId } from '../_lib/ids.js';
import { presentedProfileToken, presentedWriteToken, verifyWriteToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'GET')) return;
  if (rateLimit(req, res, { bucket: 'pull', limit: 120 })) return;
  try {
    // Header, not a query parameter. A profile token in a query string is the single field most
    // likely to be captured by an access log, a proxy, or a Referer header, and it is one of the
    // two things gating a patient's whole record set.
    const token = presentedProfileToken(req);
    if (!isSafeId(token)) { res.status(400).json({ error: 'token_required' }); return; }

    // Reading only ever yields ciphertext, so this is not what protects confidentiality -- the
    // encryption is. Requiring the same proof-of-pairing as push is here so that an unauthenticated
    // caller cannot use this endpoint as a free, unbounded scan of the store, and so that a leaked
    // profile token alone grants nothing at all.
    if (!(await verifyWriteToken(token, presentedWriteToken(req)))) {
      res.status(403).json({ error: 'not_authorized' });
      return;
    }

    const { records, truncated } = await listJson(`profile/${token}/`);

    // `truncated` is reported rather than hidden. The original never paged past Vercel Blob's
    // default 1,000-record page and returned HTTP 200 with a silently short list -- so a caregiver
    // past that threshold would see a medication list quietly missing entries and looking entirely
    // normal. Paging now covers realistic volumes outright, and if the hard ceiling is ever hit the
    // app is told so it can say something rather than show a plausible lie.
    res.status(200).json({ records, truncated });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
}
