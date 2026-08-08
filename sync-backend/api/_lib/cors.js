// Shared across every endpoint in this API: this backend is called cross-origin from the app's
// GitHub Pages origin (and, in the Capacitor build, from the WebView's own origin), so every
// response needs CORS headers, and every OPTIONS preflight needs a clean 204.
export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // caller should return immediately
  }
  return false;
}

// Same id-generation shape already used throughout index.html (prefix + timestamp-base36 +
// random-base36) -- kept consistent so these ids are recognizable as belonging to the same app,
// and because it's a good-enough source of uniqueness for this backend's own opaque ids
// (pairing session ids, profile tokens) without pulling in a UUID dependency.
export function randomId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
