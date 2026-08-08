// Full-pull of every medication/entry record for a profile (SYNC_DEVELOPER_BRIEF_v2.md §6, slice 1
// scope). Every record returned here has a `ciphertext`/`iv` pair this server cannot decrypt --
// only `recordId`, `kind`, `version`, `updatedAt`, `lastWriterDevice` are readable server-side, and
// none of those are patient content (§2.3). Simple full-list rather than delta-since-timestamp:
// appropriate at this project's realistic scale (single-digit caregivers, dozens-to-low-hundreds of
// records, polled every ~45s) -- a delta endpoint is a straightforward additive change later if a
// profile's record count ever makes full-pull expensive, not a redesign.
import { listJson } from '../_lib/blob.js';
import { applyCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') { res.status(400).json({ error: 'token_required' }); return; }
    const records = await listJson(`profile/${token}/`);
    res.status(200).json({ records });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String((e && e.message) || e) });
  }
}
