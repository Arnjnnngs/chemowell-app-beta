# REQUESTS.md — Aaron's open requests

The running list of everything Aaron has asked for — features, fixes, changes, even things
mentioned in passing — checked off only once it's actually built, tested, and confirmed
live. This exists because chat history alone doesn't reliably survive a context reset or a
new session the way a committed file does; see TEAM.md's opening note.

## How this gets used

- The moment Aaron asks for something, it gets added here as a new unchecked item, with the
  date, before any code gets touched. If it's unclear whether something he said is a real
  request or just a passing comment, treat it as a request and add it — an extra line here
  costs nothing; a forgotten ask costs Aaron having to repeat himself.
- An item only gets checked off after it's built, tested, and — for anything user-facing —
  confirmed live on the actual deployed site (the same one the APK loads), never from a plan
  or from "should work."
- Whenever reporting a completion to Aaron, show him this whole list, not just what changed
  this session. He needs the full picture of what's done and what's still outstanding, not a
  diff he has to reconstruct himself.
- Nothing gets deleted when it's finished — it moves to Completed with a one-line note of
  what shipped and when, so there's a record if a question comes back to it later.

## Next up, in order (read this first — updated 2026-08-08)

For a new chat picking this project up cold: this is the priority order, top to bottom. Full
detail on each is in the Open list below; this is just the ordering so you don't have to
reconstruct it from history.

1. **Nothing to build — waiting on Aaron.** app-v51 needs a fresh APK (GitHub Actions builds
   this automatically off the `main` push) installed on his Galaxy S25 Ultra, then his
   confirmation of: exact-alarm reminders, the new "Allow background activity" battery control,
   and — important, re-broke and re-fixed this session — CSV/PDF export actually reaching the
   native share sheet again. See the Export/printable report item and the Notification item
   below for exact detail.
2. **Multi-device/multi-user sync** — confirmed top build priority, App Store blocker. Blocked
   on Aaron completing 3 one-time Vercel dashboard steps (see the item below for exactly what).
   Once unblocked: build the pairing UI, sync loop, conflict UI, "last synced" indicator, and
   Settings entry point (items 4-8 of `outputs/SYNC_DEVELOPER_BRIEF_v2.md` §7). **Gets the full
   Quality Chain (TEAM.md) when it starts — do not self-verify this one solo, per Aaron's
   explicit 2026-08-08 instruction that this needs multiple eyes given the stakes.**
3. **Per-medication "What is this for?" link (MedlinePlus)** — approved, source confirmed, no
   further sign-off needed. Small and independent of sync — can be picked up any time, including
   before sync if it's a better use of a shorter session.
4. **Proposed, NOT yet approved — needs Aaron's go-ahead before building:** dropping the
   Male/Female question from onboarding entirely and making menstrual-cycle tracking an
   unconditional Settings toggle instead (off by default). Confirmed safe via a full codebase
   audit — the `sex` field has exactly two call sites (`cycleAllowed()` and one line in
   `needsProfileCompletion()`), nothing else touches it. Also proposed alongside it: a closing
   tour step pointing users to Settings to see what else they can turn on. Paywalling Settings
   toggles was raised and explicitly decided against 2026-08-08 (Aaron: "don't change anything")
   — that thread is closed, no action needed, not revisited unless Aaron brings it up again.
5. Everything else below, in the order it already appears in Open — none of it is currently
   blocking or time-sensitive.

## Open

- [ ] **In-app issue/bug logger — testers (including Aaron) can log something that isn't working,
  building a real list to work from** — added 2026-08-08. Aaron: "I want to be able to have a
  logger to the app. like if something isn't working correctly, it can be reported there. not sure
  if you can pick up those logs and see it to fix the issues. that way me or other testers can log
  stuff and then there is a full list we can work from." Real fork to resolve before building: this
  app is 100% on-device local storage today (no backend at all — that's exactly what the Multi-
  device/multi-user sync item below is queued to build). That means a report logged on a tester's
  phone can't reach me automatically the way a normal bug tracker would; there's no server for it to
  land on yet. Recommended near-term approach, buildable right now with no backend: an in-app
  "Report an issue" flow (reachable from Settings/the drawer) where a tester describes what went
  wrong, and the app bundles that description together with useful diagnostic context it already has
  on-device (app version, treatment type, native vs. web, recent console errors if any, maybe a
  screenshot) into one shareable file/text via the same native share sheet the CSV export now uses
  (app-v47) — the tester then sends that to Aaron (email, text, however) the same way they'd send
  a screenshot today, and Aaron forwards/pastes it to me. Once the sync backend exists, this could
  upgrade to actually submitting straight to a place I can read directly, closing the loop for real.
  Awaiting Aaron's go-ahead on the near-term (share-based) version before building — flagging here so
  it isn't lost, not yet started.
- [ ] **In-app troubleshooting "chatbot" — an extensive, walk-through-the-problem list, far beyond
  today's FAQ** — added 2026-08-08. Aaron: "want to add a chatbot. maybe it can't be something that
  you can respond to real time, but if not, it should have a very extensive list of problems it can
  walk a user through. much like the FAQ. but way more details to choose from. needs to be a full
  list of issues to help with. end to end app coverage." Aaron's own framing already answers the
  real-time-AI question: not a live model in the app (that would need a paid API connection and a
  backend this app doesn't have), but a much bigger, more structured version of the FAQ system
  already built — pick your symptom/problem from a list, get a specific walkthrough, not just one
  short Q&A entry. This is a large content-authoring effort (needs an actual comprehensive catalog of
  real problems across every screen, not just a few code changes) more than a hard technical build —
  the existing FAQ array is the right foundation to extend. Not yet started or scoped in detail;
  flagging here so it isn't lost. Will need a working session with Aaron on what "full list of
  issues" should actually cover before writing the content.
- [ ] **Export/printable report native fix — code shipped (app-v47), then found SILENTLY
  BROKEN again (app-v50 retroactive audit), re-fixed (app-v51), still waiting on a fresh APK
  install + Aaron's real-device confirmation before this can move to Completed.** Root cause
  confirmed: both CSV export and the printable report were built as browser-only tricks (a blob
  `<a download>` click; `window.open()` + `.print()`) that never had a bridge to Android's real
  file system from inside the Capacitor native WebView — the same gap on both, not two separate
  bugs. Fixed by adding `@capacitor/filesystem` + `@capacitor/share` and routing both features
  through Android's real native share sheet on the native build (falls straight through to the
  exact same unchanged behavior on the web/PWA build). This is a NATIVE change, unlike the pure
  content fixes above — it needs a new APK built and reinstalled, not just the app reopened; the
  push to main should trigger that build automatically the same way past native changes did.
  **Update 2026-08-08:** a retroactive Zero Day Auditor pass (run on app-v50, see that entry in
  README.md and `outputs/AUDIT_v50.md`) found the `@capacitor/filesystem@8.1.2` CDN bundle throws
  `ReferenceError: synapse is not defined` on every page load, silently keeping `Filesystem` out
  of `window.Capacitor.Plugins` and very plausibly regressing this exact feature back to going
  nowhere, invisibly (fails closed, no crash, no visible error). Fixed in app-v51 with a one-line
  shim script (details in that README entry). Per this file's own rule, this still can't be
  marked Completed from a plan or "should work" — needs confirmation from Aaron on the actual
  device, on the app-v51 APK once it's built, that CSV/PDF export actually hands off to the
  native share sheet.
- [ ] **Notification "Allow exact reminders" button opens phone Settings but there's no toggle to
  turn it on** — added 2026-08-08. Aaron: "notifications still doesn't work. notification in
  settings says it's on but under it, it says exact timing. when i click it, it takes me to
  settings, but i can't toggle to turn on." This is Android's separate "schedule exact alarms"
  permission (a security/battery feature added in Android 12) — without it, reminders still fire,
  just not necessarily at the exact minute (the OS may batch/delay them). The app can request the
  OS open the right settings screen but can't force the toggle itself — that's deliberately
  user-controlled by Android, same for every app that needs it. Needs Aaron's phone
  manufacturer + Android version to give accurate steps, since this settings screen's layout
  varies by OEM (Samsung/Xiaomi/Pixel/etc. all lay this out differently) and some older Android
  versions don't have this permission concept at all. Also flagged to Aaron: OEM battery/
  auto-start restrictions (common on Samsung/Xiaomi/Huawei) are a separate, common cause of
  missed background alarms that this permission alone doesn't cover, and there's no cross-OEM API
  to detect or request that one — worth checking directly on his phone.
  Update 2026-08-08: Aaron sent a screenshot of the actual "Alarms & reminders" settings screen
  the app opens — confirms the app IS correctly reaching Android's real permission screen (not a
  broken deep link), toggle currently OFF, and the screenshot shows what looks like a completely
  standard, normally-functional Android switch (styling suggests a Samsung One UI device). Aaron
  reports being unable to toggle it on but hasn't said what happens when he taps it (nothing
  visible? toggle bounces back off? phone shows its own error?) or given his phone model/Android
  version, both asked for and still needed to diagnose further — this is Android's own OS switch,
  outside the app's control once its settings screen opens, so the app can't be the direct cause of
  a switch not registering a tap.
  Update 2026-08-08 (phone confirmed: Samsung Galaxy S25 Ultra, One UI 8.5, Android 16): researched
  whether to remove this control entirely (Aaron's ask: "see if anyone uses that exact firing
  system thats not a clock/alarm. if not, remove it"). Finding — keep it, it's real: the permission
  ChemoWell requests (`SCHEDULE_EXACT_ALARM`, user-grantable via this exact settings screen) is NOT
  restricted to calendar/alarm-clock apps; that restriction only applies to a different, separate,
  install-time-auto-granted permission (`USE_EXACT_ALARM`) this app doesn't use and couldn't
  legitimately declare. What Aaron hit instead matches a documented, Samsung-specific One UI quirk
  (confirmed independently on a Samsung community thread re: Galaxy S24/One UI 6.1, same family of
  device/OS as Aaron's S25 Ultra/One UI 8.5): the "Alarms & reminders" toggle can behave
  inconsistently or the whole section can vanish from Settings after being denied once, which reads
  exactly like "it won't turn on" from the user's side even though the permission itself works
  normally on most other Android phones.
  Shipped in app-v50 (code-side improvements only — this needs a fresh APK install + Aaron's
  on-device confirmation before it can move to Completed, same as the export/printable-report entry
  above): (1) added a "?" explainer on the exact-timing card covering the above, plus the standard
  Android fix for the vanished-toggle case (Settings → Apps → ChemoWell → force-stop and reopen, or
  Settings → Apps → ⋮ → Reset app preferences) — not personally verified against Aaron's exact
  device state, flagged to him as the thing to check; (2) ChemoWell now automatically arms
  reminders a few minutes (4 min) ahead of their real time whenever exact alarms aren't confirmed
  granted, so ordinary Android scheduling slop lands early rather than late — no user action needed,
  and every displayed time/notification body still shows the real, un-padded time; reverts to
  exact-as-configured automatically the moment exact alarms are confirmed granted; (3) added a
  second, independent "Allow background activity" control (new `@capawesome-team/capacitor-
  android-battery-optimization` plugin) — battery optimization is a separate OS restriction from
  exact-alarm permission and can delay delivery even when exact timing is granted; the app now
  detects when it's still restricted and offers a one-tap fix, gated to only appear when there's an
  actual action to take. Verified in this sandbox: web build zero regressions (Playwright, 0 console
  errors), new scheduling-buffer logic unit-verified for all three exact-alarm states (denied/
  unknown/granted) including the floor-clamp guard (never pads a reminder into the past). The native
  half (manifest permission injection, real plugin behavior, real OS dialogs) can only be verified
  by this project's GitHub Actions build+emulator-smoke pipeline and, beyond that smoke test, by
  Aaron's own device — flagging both explicitly rather than claiming untested native behavior works.
- [ ] **"Other" treatment-type medication editor wording — real root cause found and fixed, but it
  wasn't a wording bug.** Re-reported 2026-08-08 during the tour ("still showing the open near
  treatment and exclude near treatment when chemo/radiation isn't selected"). Investigated fresh:
  the actual code (`isOtherTreatmentType()` / `treatmentModeOptions()`, and every call site) was
  already fully adaptive — confirmed by reading the real source AND by testing a real "Other"
  profile directly against the live deployed site, which correctly showed "Availability near your
  date" / "Only near your date" / "Excluded near your date" everywhere, zero old wording found. So
  why would Aaron see the old copy on a real device? Chasing that down found a genuine, previously-
  unknown bug in `sw.js` (see the Completed entry below) — fixed and verified live. Leaving this
  open (not re-closing it as a duplicate of something already-completed) only because Aaron hasn't
  yet confirmed on his own device that the wording now reads correctly — everything on the code and
  live-site side is confirmed correct as of app-v48.
- [ ] **Multi-device / multi-user sync — NEXT UP, confirmed priority 2026-08-08.** Profiles
  need to auto-refresh (not instant/live, but roughly within a minute) so multiple caregivers
  viewing the same patient profile see each other's updates, without screen flicker or
  kicking someone out mid-edit. Aaron confirmed 2026-08-07 this is required before App Store
  submission ("that is the main feature of this app... it DOES need to be done before app
  store for testing purposes"), and confirmed again 2026-08-08 that it should be built before
  the other Pro-tier feature ideas below, since it's an App Store blocker, it's the anchor of
  the strongest Pro pitch (shared caregiver access), and it's the biggest architectural risk
  in the project. Real architecture work — this app is currently 100% on-device local
  storage, so this needs an actual backend/sync layer. Gets the full Quality Chain when
  started, not solo Lead Developer work, given the stakes (real data, real risk of
  conflicts/loss).
  **Architecture decision reached, 2026-08-08:** building any sync backend directly conflicted
  with `APP_CLAUDE.md`'s original Hard Rule 1 ("no cloud storage, ever — user data never
  leaves the device") and the app's own "no cloud, no accounts, no tracking" copy shown to
  users. Raised to Aaron explicitly before writing any code. Aaron's question back: "can
  something still live on their device but they just share stuff with people? will this
  change the whole Hippa thing and flag the app for something more serious. I don't want
  anything with privacy breach." Researched and explained: pure on-device peer-to-peer can't
  reliably hit "within a minute," so a brief relay is needed; HIPAA itself almost certainly
  doesn't apply (ChemoWell is consumer-direct, not used by providers) but state
  consumer-health-data laws — e.g. Washington's My Health My Data Act — can apply regardless
  of encryption, based on where the user is, not where the company is. Aaron's decision:
  **"Build it encrypted, get a lawyer before it goes live."** Confirmed direction — end-to-end
  zero-knowledge encryption (server only ever stores ciphertext + opaque metadata, never a
  readable copy), and a real privacy-lawyer review is required before the feature is offered
  to real (non-testing) users, separate from and not blocking the build itself.
  `APP_CLAUDE.md` Hard Rule 1 has been rewritten to record this scoped exception (backend
  authorized ONLY for sync, ONLY as a zero-knowledge relay — not a general cloud-services
  permission). Two Developer-stage architecture briefs are written and committed to
  `outputs/`: `SYNC_DEVELOPER_BRIEF_v1.md` (initial plain-sync design, Cloudflare
  Workers + D1, pairing without accounts) and `SYNC_DEVELOPER_BRIEF_v2.md` (revised for
  E2E encryption — AES-256-GCM data encryption, ECDH+HKDF one-time device pairing, all via
  the native Web Crypto API, no external libraries). Implementation (Lead Developer stage)
  has not started yet.
  **Lead Developer stage, in progress as of app-v49:** hosting pivoted from the brief's
  Cloudflare recommendation to Vercel — this environment has zero deploy access to Cloudflare,
  but does have live Vercel deploy access under Aaron's own account, which is strictly better
  (build+deploy+test happens in this session instead of handing Aaron code to deploy himself).
  Built and verified: the on-device crypto module (key generation, record encrypt/decrypt,
  the full ECDH+HKDF pairing handshake) — 9/9 checks passing in Node, re-confirmed 4/4 in a
  real browser via Playwright, plus a full setup-flow regression with zero console errors
  (confirms this is a true no-op on the shipped app so far). Built and deployed: the backend
  itself (`sync-backend/` in this repo) — pairing + encrypted push/pull endpoints on Vercel,
  using Vercel Blob's real ETag-based conditional write for the version-conflict compare-and-
  swap the design calls for. **Blocked on Aaron for 3 one-time Vercel dashboard steps**
  (create a project named `chemowell-sync`, disable deployment-protection's login wall so the
  API is actually publicly reachable by the app, connect Blob storage) — this session's
  Vercel access can deploy code but can't create projects or change project settings.
  Still to build once unblocked: the pairing UI (Share this profile / Join a shared profile),
  the sync loop itself, the conflict-detected UI, the "last synced" indicator, and the
  Settings entry point — items 4-8 of `SYNC_DEVELOPER_BRIEF_v2.md` §7's task breakdown.
- [ ] **How does a Plus/Pro caregiver actually back up and move to a new phone?** — added
  2026-08-08. Aaron: "if they have the higher tier plans, we need to figure out how would they
  backup to move to another phone if it's all on one device and they aren't logging in." Real
  open question: the app has no accounts/login (on-device only), and Plus's advertised "backup &
  transfer to a new phone" benefit is currently marked "(coming in beta)" with no mechanism built
  yet. Needs a concrete, no-login design (most likely a manual export/import file the caregiver
  saves and restores from, distinct from Pro's live multi-device sync work above) before Plus's
  pricing-card promise is accurate.
- [ ] **Redeem-code section under Account** — added 2026-08-07. A field where Aaron can hand
  someone (a caregiver, a tester) a code that unlocks a specific plan tier. Aaron explicitly
  said this "may be for later" — kept open and not scheduled; revisit when he says go.
- [ ] **Per-medication "What is this for?" link — APPROVED, MedlinePlus confirmed, not yet
  built.** Added 2026-08-08, source confirmed 2026-08-08. Aaron wants medication info available
  without ChemoWell itself authoring or asserting any medical claims (explicit liability
  concern — no interaction checking, no dosing advice, "that's a medical advisor that I can't
  provide"). Plan: a link on each medication that opens that medication's page on MedlinePlus
  (NIH/National Library of Medicine — free, government-run, no API key, built for exactly this)
  in the phone's own browser, outside the app. ChemoWell hands off, never displays/hosts the
  content itself — most likely a generated MedlinePlus search URL built from the medication
  name (exact match isn't guaranteed since medication names vary/misspell, so this needs a
  sensible fallback for "no exact drug page found," to be worked out at build time). Small,
  independent of sync — candidate for right after sync kicks off, or sooner if Aaron wants it
  bumped up. No further confirmation needed — this is a go, just needs to be scheduled and
  built.
- [ ] **Formal Privacy Policy** — added 2026-08-08, surfaced while discussing the liability
  question above. The app already has an in-app medical disclaimer (Settings — confirmed
  present), but the App Store and Google Play both separately require a Privacy Policy URL
  before they'll list the app at all — that doesn't exist yet. Not urgent tonight, but needed
  before submission. Recommended Aaron have an actual lawyer review both the disclaimer and
  the privacy policy before launch, given real patient data is involved — not something to
  ship on a Lead Developer draft alone.
- [ ] **Pro-tier feature ideas (beyond the med-info link above)** — added 2026-08-08, workshopped
  against real competitor research (Medisafe, MyTherapy, Caring Village, Cozi, CareZone).
  Ranked by Aaron's priority — build after sync, except the med-info link above which doesn't
  need to wait:
  1. Calendar app integration — export appointments into the phone's real Google/Apple
     Calendar. Buildable now, doesn't need sync.
  2. Full data backup/export — bundle Appointments and Notes together with the existing
     health-entries CSV (today's free export covers entries only, not appointments/notes) into
     one real backup file, exportable to the caregiver's own cloud storage. Buildable now.
  3. Chemo-specific trend insights — correlate logged side effects against treatment cycle
     timing (e.g. "fatigue peaks 2-3 days after infusion"). Unique to ChemoWell's niche, not
     offered by generic trackers. Buildable now, real design/testing lift.
  4. Care-team task assignment with view/edit permission levels — hold until sync ships, since
     it depends on multiple people actually being connected to one profile.
  5. Escalating/backup reminders (notify a second caregiver if the first doesn't respond) —
     partial version (repeat alert on one device) buildable now; full version needs sync.
  Explicitly NOT pursuing: drug interaction checking — Medisafe's strongest paid feature, but
  flagged as a real liability/scope question (needs a vetted medical data source, gives
  safety-relevant advice to cancer patients on complex regimens) rather than something to
  quietly add to a feature list. Revisit only if Aaron decides he wants that exposure and
  commits to sourcing it properly.
- [ ] **Expand Limit Unit list to be universal** — added 2026-08-08. Aaron: "this should be
  catered to all medications so it's universal," not just mg/pills/applications. Needs mcg, mL,
  patches, puffs, drops, sprays, IU/units, injections, suppositories added to the medication
  editor's Limit Unit dropdown. Touches medication daily-limit-enforcement logic at 6+ call sites
  (`parseDoseOptions`, `dosageOptionsCarryLimitUnit`, `dailyLimitPreview`, plus every place that
  reads `med.ceilingUnit`) — medication-safety logic, not a cosmetic dropdown change, so this gets
  its own careful, fully-tested pass rather than being bundled into a simultaneous multi-item
  edit. A likely pre-existing CSV export bug was found while investigating this (redundant/wrong
  "N pill(s)" text appended in `buildExportRows()` regardless of actual unit) — will fix as part
  of the same pass since expanding units makes it more visibly wrong. Note: a related but distinct
  bug in the same area (Dosage options permanently locking Daily limit for the units that already
  exist today) was found and fixed separately — see Completed below, app-v46 — this item is still
  about adding the additional unit choices themselves.
- [ ] **Build the 3 workshopped Pro-tier features (confirmed "build it" 2026-08-08)** — the
  comprehensive export (bundling Appointments + Notes with the existing entries CSV), chemo/
  treatment trend insights, and the MedlinePlus-sourced med-info lookup link (see the item above)
  — queued behind the sync architecture item above, per Aaron's own priority order.

## Completed

- [x] **Retroactive Zero Day Auditor + PM gate run on app-v50, after Aaron flagged the team
  process wasn't being used** — added and closed 2026-08-08. Aaron: "I've noticed again that you
  haven't been using the team to check to make sure things are verified correctly... what you're
  doing is a big change and needs multiple eyes." Correct: app-v50 had shipped self-verified only,
  skipping TEAM.md's two mandatory every-release gates. Ran both retroactively (`outputs/
  AUDIT_v50.md`, `outputs/PM_GATE_v50.md`) — clean PASS/GO on app-v50's own diff, but the
  Auditor's live-testing pass (required by the gate, not something a self-check would have done)
  surfaced a real, currently-live defect unrelated to app-v50 itself: see the `synapse`/Filesystem
  finding, fixed same-day as app-v51 (README.md entry, REQUESTS.md export item). TEAM.md updated
  with a short incident note so a future session doesn't repeat the same self-verification-only
  shortcut. See TEAM.md's "Process-gap incident, 2026-08-08" section for the full writeup.
- [x] **Found and fixed a real bug in `sw.js` itself that could make ANY future push look like it
  didn't work, discovered while chasing Aaron's "still showing old wording" report.** Not something
  Aaron directly asked for — surfaced investigating his tour-wording report, and important enough
  to fix immediately rather than log-and-defer. While confirming the "Other" wording was already
  correct in the committed source, testing directly against the real deployed site turned up two
  stacked problems in `sw.js`'s caching, neither of which is what the pre-existing `release_check.sh`
  guards against (that only catches forgetting to bump the CACHE version at all): (1) GitHub Pages'
  CDN can briefly serve an inconsistent snapshot across files right after a push — sw.js updated at
  one edge node, index.html not yet updated at another — and the service worker's install step was
  cache-first, so if its one-time fetch landed in that window, it permanently baked the STALE
  index.html into an otherwise correctly-versioned new cache, serving it to everyone until the next
  deploy. (2) Worse and more persistent: even minutes later, with the CDN fully settled and serving
  the new file (confirmed with a direct no-cache fetch), the service worker's `cache.addAll()` kept
  fetching the OLD version anyway — traced to the browser's own ordinary HTTP cache (a separate,
  earlier layer than the Cache Storage API this file otherwise manages) silently handing back a
  disk-cached response instead of a real network request. Both are very plausibly the real
  explanation behind more than one "why hasn't my fix reached the device" report across this
  project's history, not just plain stale-service-worker-registration as first assumed. Fixed in
  two parts: the app's own HTML document now fetches network-first (always tries the real network,
  falls back to cache only if genuinely offline) instead of cache-first, so a stale bake-in can't
  become the thing every user gets served; and every shell fetch (both at install time and at
  runtime) now explicitly forces `{cache:'reload'}`, bypassing the browser's HTTP cache so it can't
  silently substitute an old disk-cached response for a real network fetch. Verified live, directly
  against the real deployed site: confirmed the exact failure by inspecting the live Cache Storage
  contents (caught the stale bake-in happening in real time, twice), then confirmed after the fix
  that a fresh navigation gets fully current content and the cache itself holds current content too.
  Shipped as two follow-up commits alongside app-v48.
- [x] **Onboarding tour now auto-navigates to the tab it's highlighting instead of leaving the user
  on Home with just a glowing icon, and no longer blocks taps on the real page underneath.**
  Original ask 2026-08-08: "it should highlight the tab it's referring...but it should
  AUTOMATICALLy take you to that page so they don't have to click on that tab." Follow-up the same
  day, more severe: "I can't even click on anything during tour after adding med and going back
  home. after that, can't click on reports, inpatient or symptoms. this is why it just needs to
  take you there automatically...the user can go back to those tabs on their own time." Root cause:
  the tour's four trailing informational steps (Logging doses/quick-log, Reports, In-Patient,
  Symptoms) never actually navigated anywhere, and rendered a full-screen invisible overlay that
  silently blocked every tap and scroll on the page underneath — a deliberate v28 anti-sidetracking
  measure that became the wrong tradeoff once Aaron wanted real auto-navigation instead. Fixed: these
  four steps now trigger the app's real navigation the instant they become current, both stepping
  forward and backward, so the tour shows the actual Reports/In-Patient/Symptoms page; the overlay no
  longer intercepts input, so the real page underneath is fully usable while the guide card is up.
  Verified live end-to-end directly against the deployed site: fresh "Other" profile through the real
  setup flow, real Meds→Add→Save, real nav taps, Back/Next in both directions, a background nav tap
  during a tour step actually navigating — zero console errors throughout. Also directly confirmed
  live (same session) that the medication editor's "Other"-profile wording (previously flagged as
  possibly still wrong) is fully correct on the real deployed site — see the sw.js entry above for
  why it may not have looked that way on Aaron's device. Shipped app-v48.
- [x] **Fixed the Dosage options field permanently locking Daily limit for non-mg medications.**
  Aaron: "Dosage option still waits for 'mg' if Limit Unit is set for Number of applications.
  should it still wait for 'mg'? the dosage option banner pops up and can't be bypassed." Root
  cause: the field required one of a specific whitelist of words (pill/tab/tablet/cap/capsule/
  application) to appear directly after the number in a Dosage options entry before it "counted"
  toward a non-mg Limit unit — but the field's own on-screen example (in its "?" helpIcon) is "1
  patch, 2 patches," which doesn't contain any of those words. So typing exactly what the app
  itself suggested could permanently fail the check, lock the Daily limit field, and leave the
  warning banner showing with genuinely no way to dismiss it — not a false alarm, a real dead
  end. Fixed by counting any leading number in a Dosage options entry as that entry's amount,
  regardless of what word (if any) follows — matches how a person actually reads "1 patch" or "2
  sprays." This doesn't change what units are offered in the Limit unit dropdown itself (still
  mg / pills / applications) — that's the separate, larger "make Limit Unit universal" item below
  — it fixes the parsing bug that was trapping people using the units that already exist.
  Verified live: "1 patch, 2 patches" with Limit unit "Number of applications" now unlocks Daily
  limit immediately, saves cleanly with no blocking toast, and the existing mg-unit path ("500
  mg, 1000 mg") still works exactly as before. Shipped app-v46.
- [x] **Fixed the permanent-delete screen flicker, and confirmed/strengthened the "can't be
  undone" language on every delete flow.** Aaron: "when trying to permanently delete things,
  the screen keeps refreshing constantly. when I do click erase, I mentioned before there
  should be another pop up to say that this is permanent and can't be undone." Root cause of
  the flicker: the app's 1-second render tick-loop has a guard list of "don't rebuild the whole
  screen while one of these is open" states, and it was missing the Erase-all modal plus every
  tap-to-arm delete-confirm state (medication, appointment, note, profile) — so the entire
  screen was torn down and rebuilt every single second while any delete confirmation was open,
  which is what read as constant refreshing/flickering (same root-cause pattern as three past
  bugs in this exact file — v11, v22, v27 — each time a new modal state was added and not added
  to this same guard list). Fixed by adding all of them to the guard. Separately, confirmed the
  "Erase all data" flow already has real "this will permanently delete everything... there is
  no way to bring it back" language (shipped app-v40) — if Aaron still isn't seeing it, his APK
  build is likely running an older cached version and needs to be refreshed/reinstalled from
  the current build. As a belt-and-suspenders improvement, also added explicit "This can't be
  undone" text to the three lighter delete-confirm flows that didn't have it before (medication,
  appointment, note — profile's "Delete forever?" was strengthened too). Verified live: each
  confirm dialog's on-screen DOM element now stays stable across multiple 1-second ticks instead
  of being rebuilt, and the new wording is present in every flow. Shipped app-v45.
- [x] **Restructured Pro tier bullets, real gap from Plus, dropped "priority access to new
  features."** Aaron: "there still needs to be a real gap between plus and pro. i'm still not
  seeing it. still need to remove priority access to new features unless you tell me what you
  envision with that." Dropped that bullet outright — no concrete deliverable existed to back it.
  Plus's backup bullet reworded to be explicitly single-device continuity ("Backup & restore —
  move your data to a new phone"); Pro's export bullet reworded to be explicitly a different
  thing — a shareable file for someone else (a doctor, another caregiver), not just a personal
  restore path. On bullet order: Aaron asked whether exports/backup should lead with unlimited
  profiles last — recommended (and built) leading with real-time shared caregiver access instead,
  since Aaron himself named that as the one thing that would actually sell him ("I wouldn't be
  sold on that besides the shared access"), with the export and trend-insights bullets right
  behind it, unlimited profiles last as he asked. Verified live. Shipped app-v44.
- [x] **Added an on-screen explainer to the In-Patient tab** — this screen had zero on-screen
  explanation before (only a separate FAQ entry described it); added a "?" helpIcon next to
  "In-Patient Status," same pattern as the medication editor. Verified live. Shipped app-v43.
- [x] **Lightened the Sunset Glass color palette** — Aaron reported the background gradient
  (onboarding + the main app page, behind every card) was too dark/hard to read. Lightened all
  three gradient stops in HSL space (same hue, +14% lightness): `#FF5F6D → #FFA6AE`,
  `#FF9A44 → #FFC18B`, `#FFC371 → #FFE1B8`. Verified live on mobile and desktop widths. Header
  and bottom nav were already on their own separate light background and untouched. Shipped
  app-v43.
- [x] **Reworded "Treatment day" section to be adaptive for "Other" treatment type** — Aaron:
  "treatment day can be reworded bc if someone chooses other and they don't have a major
  illness, treatment day might be confusing... I don't have treatment days aside dr visits."
  Every user-facing "treatment day" string (medication editor's availability section, Home
  card captions, the treatment-plan banner, the FAQ) now reads as "your date" for an "Other"
  profile; chemo and radiation profiles keep the exact original wording, byte-for-byte —
  verified both variants live with a real profile of each type, plus confirmed no regression
  in the unchanged chemo/radiation copy. Shipped app-v42, verified live.
- [x] **Moved "Minimum gap between doses" field, added "(hours)" to its label** — was near the
  end of the medication editor, after Schedule windows; now sits right after Dosage options
  with the other dosing questions, and the scheduled-medication variant's label now reads
  "Minimum gap between doses (hours, optional)." Verified live for both as-needed and scheduled
  medication types. Shipped app-v42, verified live.
- [x] **Medication dose reminders silently blocked 10 PM–8 AM ("quiet hours")** — found live
  2026-08-08 via Aaron's real APK test (10:30 PM med, app closed, no notification). Root cause:
  a "quiet hours" rule silently dropped any dose reminder in that window on both the in-app and
  closed-app/native paths, with no on-screen warning. Per Aaron's decision, quiet hours removed
  for dose reminders entirely (now fire any hour, matching how appointment reminders already
  behave); the daily check-in's own separate 8 AM–10 PM window is untouched. Verified live: a
  10:31 PM and a 3:01 AM dose window both correctly fire a reminder through the real notification
  pipeline. Shipped app-v41, verified live.
- [x] **Dosage options comma explainer** — added a "?" explaining that the comma between multiple
  strengths (e.g. "500 mg, 1000 mg") lists different strengths of the same medication, each its
  own tap-to-log button sharing one schedule and one daily limit. Aaron confirmed multiple
  strengths is intentional ("it was always my intent to have different strengths") — only the
  wording needed fixing. Shipped app-v41, verified live.
- [x] **Sunset Glass color palette** across the app, replacing the prior brand colors — added
  and shipped 2026-08-07 (app-v40), verified live.
- [x] **Active tab highlight (Home/Meds/etc.) in light green** — added and shipped 2026-08-07
  (app-v40), verified live.
- [x] **Onboarding tour's pulsing glow** — Aaron reported not seeing it; verified the real
  border-pulse animation genuinely exists and works (correctly disabled under Reduce Motion,
  which is likely what he was hitting, or he was viewing the intro card which by design has
  no target to highlight). No code defect found.
- [x] **"Reset everything" moved to the Account tab**, with a two-step warning (dismissible
  first confirm, then a larger final modal) and honest "there is no way to bring it back"
  copy — no false promise of a restore path. Shipped 2026-08-07 (app-v40).
- [x] **Hamburger drawer: removed the redundant "View profile & plan" link**, replaced with a
  plan-tier pill (Free/Plus/Pro) next to the profile name. Shipped 2026-08-07 (app-v40).
- [x] **FAQ moved to its own hamburger drawer item**, out from under Account/Settings.
  Shipped 2026-08-07 (app-v40).
- [x] **Pro plan given real differentiating benefits** beyond "unlimited profiles": added
  real-time shared caregiver access (coming soon, ties into the sync item above) and priority
  access to new features. Shipped 2026-08-07 (app-v40).
- [x] **"Add appointment" did nothing when tapped** — root cause was a stale cached build on
  Aaron's device, not a code defect (confirmed once the underlying service-worker caching bug
  below was found and fixed). Folded into the Calendar rebuild below.
- [x] **Calendar rebuilt as a real Month View** with a color picker per appointment and
  matching colored bars shown on that appointment's day. Independently audited by a separate
  agent hunting for edge cases before shipping; the one real bug it found (a very long,
  unbroken title could overflow its card) was fixed and re-verified. Shipped 2026-08-07
  (app-v40), live-verified.
- [x] **Found and fixed the actual reason none of today's changes were reaching Aaron's
  installed app**: the service worker's cache version wasn't being bumped alongside content
  changes, so the app kept serving an old cached copy indefinitely regardless of relaunching.
  Added `release_check.sh`, which now hard-blocks any future push where that's forgotten,
  wired into `TEAM.md` as a mandatory step — tested against the exact failure that shipped
  today to confirm it actually catches it.
- [x] **This file** — a durable, cross-session request tracker, read at the start of every
  session and shown to Aaron (as a checklist, in chat) at the end of every completed one, so
  nothing gets lost to a context reset or an easily-forgotten ask. Added 2026-08-07 per
  Aaron: "I can't remember all the things I've mentioned and still needs to be completed."
