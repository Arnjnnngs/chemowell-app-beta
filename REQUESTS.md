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

- [ ] **Multi-device / multi-user sync** — added 2026-08-07. Profiles need to auto-refresh
  (not instant/live, but roughly within a minute) so multiple caregivers viewing the same
  patient profile see each other's updates, without screen flicker or kicking someone out
  mid-edit. Aaron confirmed 2026-08-07 this is required before App Store submission ("that
  is the main feature of this app... it DOES need to be done before app store for testing
  purposes"). Real architecture work — this app is currently 100% on-device local storage,
  so this needs an actual backend/sync layer. Gets the full Quality Chain when started, not
  solo Lead Developer work, given the stakes (real data, real risk of conflicts/loss).
- [ ] **Redeem-code section under Account** — added 2026-08-07. A field where Aaron can hand
  someone (a caregiver, a tester) a code that unlocks a specific plan tier. Aaron explicitly
  said this "may be for later" — kept open and not scheduled; revisit when he says go.

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
