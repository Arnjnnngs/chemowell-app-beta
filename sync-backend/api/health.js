import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  res.status(200).json({ ok: true, service: 'chemowell-sync-backend', time: Date.now() });
}
