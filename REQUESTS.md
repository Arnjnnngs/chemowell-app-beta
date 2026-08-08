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

## Completed

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
