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
- [ ] **Export/printable report native fix — code shipped (app-v47), waiting on a fresh APK
  install + Aaron's real-device confirmation before this can move to Completed.** Root cause
  confirmed: both CSV export and the printable report were built as browser-only tricks (a blob
  `<a download>` click; `window.open()` + `.print()`) that never had a bridge to Android's real
  file system from inside the Capacitor native WebView — the same gap on both, not two separate
  bugs. Fixed by adding `@capacitor/filesystem` + `@capacitor/share` and routing both features
  through Android's real native share sheet on the native build (falls straight through to the
  exact same unchanged behavior on the web/PWA build). This is a NATIVE change, unlike the pure
  content fixes above — it needs a new APK built and reinstalled, not just the app reopened; the
  push to main should trigger that build automatically the same way past native changes did.
  Per this file's own rule, this can't be marked Completed from a plan or "should work" — needs
  confirmation from Aaron on the actual device once the new APK is installed.
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
- [ ] **"Other" treatment-type medication editor wording still confusing — re-reported 2026-08-08
  during the tour ("still showing the open near treatment and exclude near treatment when
  chemo/radiation isn't selected").** Investigated fresh this session: the actual current code
  (`isOtherTreatmentType()` / `treatmentModeOptions()`, and every call site — the radiogroup, its
  field label, the days-before/after labels, the med-card badges, the Home card caption) IS already
  fully adaptive for an "Other" profile and says "your date," not "treatment" — confirmed by reading
  the real committed source, not a plan. Aaron seeing the literal old "near treatment" wording most
  likely means his installed app is running a cached build from before app-v42 shipped this — this
  app has hit exactly this class of bug before (see the Completed service-worker cache-versioning
  fix). Asked Aaron to fully close (not just background) and reopen the app, or reinstall if that
  doesn't clear it, and to check the version number shown at the bottom of Settings against the
  current app-v47 — not yet confirmed by Aaron. Leaving this open until he confirms either the
  wording is now correct after a real reload, or that it's still wrong even on a confirmed-current
  version (which would mean a real remaining bug, not a cache issue).
- [ ] **Onboarding tour should auto-navigate to the tab it's highlighting, and drop "click this
  tab" instructional language — root cause found, fix built this session, not yet shipped/verified
  live.** Original ask 2026-08-08: "it should highlight the tab it's referring...but it should
  AUTOMATICALLy take you to that page so they don't have to click on that tab." Follow-up
  2026-08-08 (same day, more severe): "I can't even click on anything during tour after adding med
  and going back home. after that, can't click on reports, inpatient or symptoms. this is why it
  just needs to take you there automatically...the user can go back to those tabs on their own
  time." Root cause: the tour's four trailing informational steps (Logging doses/quick-log,
  Reports, In-Patient, Symptoms) never actually navigated anywhere — they left the user on Home
  with only the relevant bottom-nav icon glowing — AND rendered a full-screen invisible overlay
  that silently blocked every tap and scroll on the page underneath (a deliberate v28 anti-
  sidetracking measure that became the wrong tradeoff once Aaron wanted real auto-navigation
  instead). Fix: these four steps now call the app's real navigation the instant they become
  current (both stepping forward and stepping back), so the user actually sees the real Reports/
  In-Patient/Symptoms page; the blocking overlay is removed (kept as a purely visual dim, no longer
  intercepts taps) so the page underneath is fully usable while the guide card is up, matching
  Aaron's "go back to those tabs on their own time." Built, not yet pushed/live-verified as of this
  entry.
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
- [ ] **Per-medication "What is this for?" link** — added 2026-08-08. Aaron wants medication
  info available without ChemoWell itself authoring or asserting any medical claims (explicit
  liability concern — no interaction checking, no dosing advice, "that's a medical advisor
  that I can't provide"). Plan: a link on each medication that opens that medication's page on
  an established external source (MedlinePlus/NIH first choice — free, government-run, built
  for exactly this; WebMD/Drugs.com as fallback) in the phone's own browser, outside the app.
  ChemoWell hands off, never displays/hosts the content itself. Small, independent of sync —
  candidate for right after sync kicks off.
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
