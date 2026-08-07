# BACKLOG.md — chemowell-app-beta

Small, non-blocking things found during work that aren't worth stopping for, but shouldn't get
forgotten either (per Aaron, 2026-08-06: "if there is something that you notice is a problem or
can be an easy fix... make sure that is in the notes"). Read this at the start of any session in
this repo — it's the durable, in-repo version of a running punch list. Pull items into a real task
when you're about to touch the relevant code; delete the line once it's actually fixed and shipped.

- **No year shown on date labels** — `renderNotesView`'s note rows (index.html, "MMM D" date badge)
  and the sibling Calendar/Appointments feature's `calPillLabel` both show only month+day, no year.
  Fine for near-term dates, ambiguous for anything logged more than ~11 months apart (a chemo/rad
  journal entry from 2 years ago and one from last month can render identically). Found during the
  v36 Notes audit (2026-08-06); pre-existing on Calendar, not a new regression. Fix: add the year to
  both when it differs from the current year, or always show it — Designer call on which reads
  cleaner in the existing card width.
- **`saveNote()`'s empty-text-deletes-the-note branch is unreachable** — its only caller
  (`confirmNoteModal`) already blocks empty/whitespace text with a toast before calling it, so that
  code path can never run. Harmless (no user-facing effect), just stale. Found during the v36 Notes
  audit (2026-08-06). Either wire up a real path to it (e.g. let clearing a note's text in the
  editor and saving delete it, instead of blocking the save) or remove the dead branch — Aaron's
  call on which behavior he actually wants.
- **Notes/Appointments "Delete?" confirm state never auto-resets** — tap trash once (shows
  "Delete?"), navigate away without confirming, come back — it's still showing "Delete?". Consistent
  with the existing Appointments behavior (not a v36 regression) but inconsistent with
  `confirmDeleteMed` (resets on nav away) and entries (6s auto-timeout). Found during the v36 Notes
  audit (2026-08-06). Worth picking ONE pattern and applying it everywhere delete-confirm shows up,
  rather than three different behaviors across the app.
- **Onboarding has no "none of these" option for treatment type** — the welcome screen forces a
  choice of Chemo / Radiation / Both before "Get started" unlocks; there's no way to set up a
  profile for someone who isn't a cancer patient at all. Directly relevant to Aaron's broader
  positioning ask (see task "Scope: broaden ChemoWell positioning beyond chemo/radiation") — flagged
  here as the concrete first thing that breaks if that direction moves forward. Found 2026-08-06.
- **CSV export needs a true native path once the app is actually Capacitor-wrapped** — the 2026-08-06
  CSV export fix (downloadEntriesCSV) uses the Web Share API with a blob-download fallback, which
  fully covers today's reality (web/PWA on Aaron's phone — this repo has `capacitor.config.ts` but no
  `android/`/`ios/` project yet, so there is no true native shell to test against). Once `npx cap add
  android`/`ios` actually happens, revisit whether `navigator.share`/`navigator.canShare` are reliably
  available inside the Capacitor WebView (inconsistent across Android WebView versions) — if not,
  switch to `@capacitor/filesystem` + `@capacitor/share` (write the CSV to a real file, then hand off
  to the native share sheet), matching the pattern `@capacitor/local-notifications` already uses in
  this app. Gotcha already discovered so it doesn't need rediscovering: the `@capacitor/filesystem`
  8.x UMD build (`dist/plugin.js`, loaded via a raw `<script src>` CDN tag the same way
  local-notifications is) references a bare `synapse` global in its closing IIFE call
  (`})({}, capacitorExports, synapse)`) that a plain CDN include does NOT provide — it throws
  `ReferenceError: synapse is not defined` and the plugin never registers. `@capacitor/synapse`'s own
  UMD build doesn't even expose that name (it registers as `window.outsystemsSynapse`). The
  fix is a small shim script tag BEFORE the filesystem/share plugin scripts:
  `<script>window.synapse = { exposeSynapse: function(){} };</script>` — a no-op is safe because
  `exposeSynapse()` only wires up a rarely-used synchronous native-bridge proxy that ordinary async
  `Filesystem.writeFile()`/`Share.share()` calls don't depend on. Not implemented now because it's
  unverifiable in this sandbox (no real Android/iOS runtime here) and Aaron's own testing standard
  requires verifying before calling something done — do this alongside the actual native build/test
  cycle, not blind.
- **"Welcome to ChemoWell" setup toast can briefly overlap the tour's "Daily limit" field** — during
  the guided tour's "Fill in the details" step (medication editor), the post-`completeSetup()` toast
  is still visible for its last moment or two and sits over the Daily limit field. Pre-existing
  toast-timing behavior, not caused by the 2026-08-07 tour-banner-positioning fix. Found during that
  fix's Designer review. Likely fix: either shorten the setup toast's life once the tour has started,
  or delay showing it until after the tour's first real step.
