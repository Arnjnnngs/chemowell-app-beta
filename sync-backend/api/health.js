import { applyCors, requireMethod } from './_lib/guard.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (requireMethod(req, res, 'GET')) return;
  res.status(200).json({ ok: true, service: 'chemowell-sync-backend', time: Date.now() });
}
