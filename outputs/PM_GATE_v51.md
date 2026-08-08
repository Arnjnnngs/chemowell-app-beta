# Project Manager Gate — v51 (Fix silent native-export regression: `synapse` shim)

**For: Aaron. Written in plain language — the technical detail is in the reports linked below if you ever want it.**

## Verdict: **GO — ready to consider this release closed**, pending your own on-device confirmation
that CSV/PDF export actually reaches the native share sheet once the new APK is installed. That one
item is correctly left open in REQUESTS.md, not something this gate is glossing over — see below.

---

## Did this actually fix what it claims to fix?

Yes. The Auditor's report (`outputs/AUDIT_v51.md`) is not just asserted — I independently re-verified
its two most load-bearing claims myself, directly against the repo, rather than taking the write-up on
trust:

- **Script order.** Re-ran `grep -n "^<script" index.html` myself:
  ```
  17: @capacitor/core@8.4.2
  18: @capacitor/local-notifications@8.2.1
  35: <script>window.synapse = { exposeSynapse: function(){} };</script>
  36: @capacitor/filesystem@8.1.2
  37: @capacitor/share@8.0.1
  ```
  Exact match to the Auditor's report. The shim is a plain synchronous inline `<script>` (no `async`/
  `defer`) sitting immediately before the filesystem CDN tag, so it is guaranteed to execute first —
  document-order execution isn't in question here, this isn't a race.

- **No namespace collision.** Re-ran `grep -n "synapse" index.html` myself: exactly two hits — the
  explanatory comment (lines 27–28) and the shim's own definition (line 35). Nothing else in the file
  reads, writes, or expects `window.synapse` to mean anything else. Matches the Auditor's claim that
  `synapse` isn't used anywhere else on the page or in the other three CDN bundles.

I did not independently re-fetch the live `filesystem@8.1.2` CDN bundle myself (the Auditor's method —
reading it through the user's connected browser since this sandbox's own egress to `cdn.jsdelivr.net`
is policy-blocked — is the only way to see it, and re-doing that exact same fetch a second time
wouldn't add independent signal). What I can confirm directly: the shim's shape
(`{ exposeSynapse: function(){} }`) is a plausible, minimal fix for a `ReferenceError: synapse is not
defined` at the specific throw site the Auditor quoted (`})({}, capacitorExports, synapse)`), and the
BACKLOG.md entry that pre-documented this exact fix before app-v47 shipped (visible in `git show
5738991`'s diff) independently corroborates that this shim was researched in advance, not invented
after the fact to make an error message go away.

## Is the unverified scope honestly bounded, or is something being glossed over?

Agreed, honestly scoped. The Auditor is explicit that:
- Zero console errors were confirmed in local browser testing (the exact defect class — an uncaught
  `ReferenceError` at parse time — provably does not occur post-fix).
- Whether `Filesystem` actually lands in `window.Capacitor.Plugins` inside a real native WebView is
  listed under "Not verified," not claimed. That is the correct line to draw: a plain browser (with or
  without the CDN scripts loading) can never exercise `window.Capacitor` at all, since that object only
  exists inside an actual Capacitor native shell. There is no sandbox-side test that could close this
  gap further than static/local verification already has — it genuinely requires either a live-site
  spot-check or a real device/emulator, both called out as the honest next steps rather than skipped.
- REQUESTS.md's export item (line 88) is still correctly `- [ ]`, with an accurate update describing
  exactly what shipped and what's still needed to close it. Nothing overstates this as done.

This matches this project's established, Aaron-approved pattern for native-only behavior (see TEAM.md's
"On-device / real-platform verification" section) — code-level fix + static verification now, real
device confirmation before the feature itself is marked Completed. Not a new or looser bar for this
release.

## Release mechanics — independently checked, not re-read from the reports

- `APP_VERSION = 'app-v51'` at `index.html:5361` (re-grepped myself). `sw.js`'s `CACHE =
  'chemowell-app-v51-1'` (re-checked myself). Both match, and the version pair is internally
  consistent — `v51` in both places, no stale reference to `v50`.
- `./release_check.sh` (re-ran myself with its executable bit, which is now `-rwxr-xr-x` — confirmed
  the F1 fix from the Auditor's pass actually landed): exits 0, "No index.html changes pending" —
  expected since the working tree matches what's already committed.
- **Pushed to origin/main, confirmed via `git fetch origin main` + `git log origin/main --oneline`
  myself**, not assumed from the task brief:
  ```
  9f05c9e Add retroactive Zero Day Auditor + PM gate reports for app-v50
  5738991 app-v51: fix silent native-export regression (synapse shim); process-gap correction + HANDOFF.md
  4e0564e Fix: correct shell ${d} template-loop escaping in workflow YAML
  ```
  `5738991` (the commit under review) is present on `origin/main`, and local `HEAD` matches
  `origin/main` exactly — genuinely pushed, not just committed locally.
- README.md's `app-v51` version-history entry (visible in the commit diff) accurately describes the
  root cause, the fix, what was verified, and what wasn't — no overstatement found.
- REQUESTS.md's export item, checked directly (see above): still open, accurately updated, not
  prematurely closed.

## Go/No-Go

**GO.** The fix is correctly placed, correctly shaped for the specific bundle it targets, introduces no
namespace collision, and is corroborated by a pre-existing BACKLOG.md entry that predicted this exact
failure mode before it happened. Version bump and service-worker cache are consistent, `release_check.sh`
now runs and passes via its documented invocation, and the commit is genuinely on `origin/main` — verified
directly via `git fetch`, not taken on faith. The one thing left open (real on-device confirmation that
`Filesystem` registers and the CSV/PDF share-sheet actually works again) is a correctly-scoped, honestly-
documented limitation, not a gap being glossed over — it's already tracked in REQUESTS.md exactly where it
needs to be, and this release doesn't need to wait on it to be considered closed from the code side.

**Recommended next step, not blocking:** once the CI-built APK for this push is available, get it onto
Aaron's device and confirm CSV/PDF export reaches the real native share sheet, then check off the
REQUESTS.md item. No further code work needed before that happens.
