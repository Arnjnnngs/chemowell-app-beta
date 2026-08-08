# DEV BRIEF — Multi-device / multi-caregiver Sync (v1, pre-implementation)

Stage: **Developer** (investigation only — no code changed). Repo: `chemowell-app-beta` (APP-BETA).
File: `index.html` (6,692 lines, single file, no build step), verified against `APP_VERSION =
'app-v39'` (index.html:5007) / `sw.js` `CACHE = 'chemowell-app-v39-1'` (sw.js:1); most recent commit
on `main` is `app-v40` per `git log`. All line numbers below are as of this commit
(`ce491d7`). This brief is the required Stage-1 output before a Lead Developer starts building —
per Aaron's own framing, this is the cheapest point to catch a wrong architectural call.

**Top-line recommendation** (justification for each in the numbered sections below):
- **Backend:** a small custom REST backend on **Cloudflare Workers + D1**, polled (not real-time),
  administered/deployed via a new GitHub Actions workflow — not Firebase, not Supabase.
- **Pairing:** a short-lived numeric **pairing code + QR**, generated on the device that already
  has the profile, redeemed on the joining device — no accounts, no passwords.
- **Conflict handling:** append-only union-merge for entries (near-zero conflict risk by
  construction); last-write-wins **with a concurrent-edit detector** for mutable medication
  config, which defers to an explicit human choice instead of silently discarding a caregiver's
  edit to a dosing-safety field.
- **Slice 1:** pair two devices → two-way sync of **medications + entries only** → poll every ~45s
  while foregrounded → visible "last synced" indicator → conflict on medication config is
  *detected and held back*, not silently resolved. Everything else (notes, appointments, prefs,
  background sync, resolution UI) is explicitly slice 2+.

---

## 0. The load-bearing contradiction this task creates — read this first

`APP_CLAUDE.md` (this repo's own standing instructions, read by every AI session that works here)
currently states, as **Hard rule #1**:

> "**No cloud storage. Ever.** The entire product promise is that user data never leaves the
> device. Do not add Firebase, analytics, remote logging, or any network write of user data."

and Hard rule #2 forbids ever touching the sibling web app's Firestore collections. `README.md`
line 3 and `index.html` line 52-53 both repeat "no cloud, no accounts, no tracking" as the
product's privacy pitch, and this app's *entire origin story* (README.md line 5, `APP_CLAUDE.md`
line 6, and app-v1's changelog entry) is that it was seeded from the web app specifically by
**removing** Firebase/Firestore/FCM. This is not incidental — it's the reason this codebase exists
as a separate target from `chemowell-beta` at all.

Aaron's new instruction (sync is the #1 priority, required before App Store submission) directly
overrides that hard rule. That's a legitimate call for him to make, but it needs to be made
**explicitly and in writing**, not just implicitly overridden by a future PR:
1. `APP_CLAUDE.md` rule 1 needs to be rewritten (e.g. "no cloud storage unless a caregiver
   explicitly turns on Pro's shared-profile sync for that specific profile") as part of the first
   implementation PR, or a future Claude session will read the old rule as still-absolute and
   either refuse the work or silently revert it.
2. The in-app copy that makes this promise to *users* (`index.html:2272`, `:5212`, `:5333`;
   `README.md:3`; the welcome/About & Legal screens) needs a one-line, Aaron-approved correction —
   something like *"Your data stays on your device — unless you turn on Pro's shared caregiver
   access for a specific profile."* This is a legal/trust-sensitive sentence for a health app;
   flagging it explicitly rather than quietly editing it.

Everything below assumes Aaron accepts this tradeoff (which the task framing implies he already
has, by naming sync the top priority) — but the Lead Developer should get an explicit "yes, update
those two files" from Aaron before shipping, not infer it.

---

## 1. Current-state map

### 1.1 Every localStorage key that would need to sync

All keys are **profile-scoped** (prefixed `chemowell-app-p-<profileId>-`) except two device-wide
keys. `ACTIVE_PROFILE_ID` is resolved once at load (index.html:135) and baked into constant key
names for the rest of the session (:175-176, :232, :281, :411) — there is no live re-keying without
a full `location.reload()`.

| Key | Line(s) | Shape | Mutation pattern | Sync class |
|---|---|---|---|---|
| `chemowell-app-p-<id>-entries-v1` | 175, 181, 196-214 | array of `{id, medId, ts, ...}` | **append + soft states only** — `addEntryDB` pushes, `removeEntryDB` filters by id. No "edit an existing entry" function exists anywhere in the file. | Append-only (low risk) |
| `chemowell-app-p-<id>-prefs-v1` | 176, 216-226 | flat object: `patientName`, `sex`, `treatmentType`, units, `installedAt`, `missedClearedAt`, `dismissedMisses[]`, `tourDone`, `supportOptOut`, etc. | `setPrefsDB` = shallow-merge patch | Mutable, low-stakes |
| `chemowell-app-p-<id>-med-v1` | 411, 555, 577 | `{version, meds[], archivedMeds[]}` — each med has `windows[]`, `doses[]`, daily-limit/gap-hour safety fields | Whole-object overwrite on every editor save (`saveMedicationEditor`) | **Mutable, safety-critical** |
| `chemowell-app-p-<id>-appts-v1` | 232, 248-267 | array of appointment objects, each with `reminded` flag | add/update/remove by id | Mutable, medium-stakes |
| `chemowell-app-p-<id>-notes-v1` | 281-283 | array, **one note per calendar day**, keyed by date string, not id | `saveNote` edits-in-place by date if one already exists for that day | Mutable (keyed, not append-only) |
| `chemowell-app-profiles-v1` | 116-133 | `{list:[{id,name,createdAt}], activeId}` | full read-modify-write | Device-local identity, see §3 |
| `chemowell-app-license-v1` | 109-113 | `{tier: 'free'|'plus'|'pro'}` | **device-wide**, not per-profile | See §7 risk on server-side gating |

Deleting a profile (`deleteProfile`, :153-166) removes 5 suffixed keys per profile
(`-entries-v1`, `-prefs-v1`, `-med-v1`, `-appts-v1`, `-notes-v1`) — this list has already been
patched twice in this project's history (v22's `-appts-v1` and v36's `-notes-v1` were each added
after being found missing) which is itself a signal: any new sync-related per-profile key **must**
be added to this same cleanup list, or a deleted profile leaves an orphaned sync-state key behind
forever.

### 1.2 Profile switching

`switchProfile()` (:167-173) and `createProfile()` (:137-152) both end in `location.reload()` — a
full page reload, not a soft state transition. Whatever sync-state bookkeeping exists (poll
timers, "last synced" watermark, in-flight requests) must be safe to blow away on reload and
resume purely from what's persisted in localStorage; there is no in-memory sync state that
survives a profile switch today, and there's no reason to add any.

### 1.3 Render loop — the thing most likely to fight a naive sync implementation

- `state` is one big object (:601); `setState(patch)` (:607-615) does `Object.assign` then calls
  `render()` unconditionally.
- `render()` (:2768) does a **full teardown and rebuild** of the DOM: `root.replaceChildren(page)`
  (:2468, setup screen) or `root.innerHTML = ''; root.appendChild(page)` (:2837-2838, main app) —
  confirmed via the `h()` hyperscript renderer (:1928). There is no virtual-DOM diffing.
- A `setInterval(..., 1000)` tick (:6628-6657) calls `render()` every second — **guarded** by a
  growing list of "don't rebuild while this is open" flags: `state.timeModal`, `upgradeOpen`,
  `drawerOpen`, `apptModal`, `noteModal`, `checkinModal`, `medEditor`, `infoModal`, plus a live
  `document.activeElement` check for any focused `INPUT`/`SELECT`/`TEXTAREA`.
- **This guard list exists because this exact class of bug has already shipped and been fixed
  three separate times**, per the code comments and README version history: v11 (Plans sheet
  replaying its entry animation every tick — "the flickering, adjusting popup"), v22 (drawer/
  appointment-form focus silently dropped every second), v27 (medication editor's help-icon
  "flashing" because it was left out of the guard list by oversight). A sync-triggered
  `setState()` that isn't added to this exact guard list from day one **will** reproduce this bug
  class — this is precisely the "no screen flicker, no kicking someone out mid-edit" failure mode
  Aaron named, and the codebase already has three prior, well-documented instances of it.
- **Existing precedent worth reusing, not reinventing:** `subscribeEntries`'s consumer already
  defers incoming updates while a modal is open — `unsub = subscribeEntries((entries) => { if
  (state.timeModal) { pendingEntries = entries; return; } ... })` (:6616-6626), flushed once the
  modal closes (`setState`, :610-612). A sync layer's "apply remote changes" step should hook into
  this exact same defer-and-flush pattern, not invent a parallel one.
- There is also an existing **same-device, cross-tab** sync mechanism already in the file: a
  `window.addEventListener('storage', ...)` handler (:314-320) that calls `notifyEntries()` /
  `prefsListener()` when another tab on the *same device* changes a key — explicitly *not* a
  destructive reload for entries/prefs (it only reloads on a profile-switch key change). This is
  the closest existing analog to what a cross-device sync merge needs to do: push new data into
  the existing listener/state machinery, not force a page reload.

### 1.4 Service worker caching (stale-cache history)

`sw.js` is cache-first for the app shell (`CACHE = 'chemowell-app-v39-1'`, cache-first fetch
handler at sw.js:14-16). README's app-v35 entry documents this explicitly: *"sw.js's cache version
bumped to match [the JS change]... browsers with the prior version cached will pick up this
update."* **Any PR that adds sync code to `index.html` must bump the `CACHE` constant in `sw.js`
in the same commit**, or existing installed users — including the very caregivers this feature
targets — can keep running old, non-syncing JS indefinitely with no visible error.

### 1.5 The three surfaces

`capacitor.config.ts` confirms the native Android shell has `server.url` pointing at the **live**
GitHub Pages URL (`https://arnjnnngs.github.io/chemowell-app-beta/`), not a bundled local copy —
its own top comment states this deliberately keeps "our normal push-via-Chrome workflow" updating
web, PWA, and native simultaneously with no rebuild. **Practical consequence for this feature:**
because all logic lives in the one live-served `index.html`, a sync layer that talks to a backend
via plain `fetch()` needs **zero native plugin work and zero `capacitor.config.ts`/CI changes** —
it behaves identically in a browser tab and inside the Capacitor WebView, the same way every other
recent feature (Notes, Calendar, the medication editor) already does. This is a meaningfully
smaller lift than it would be if any native SDK or background-fetch plugin were required.

---

## 2. Backend/sync approach — options and recommendation

### 2.0 A verified environment constraint that changes the calculus for *all three* options

I tested outbound HTTPS reachability from this development sandbox directly (the same class of
sandbox the Android CI comment already flags as unable to reach Google's Maven/Gradle Plugin
Portal):

```
firestore.googleapis.com        → CONNECT tunnel failed, 403
identitytoolkit.googleapis.com  → CONNECT tunnel failed, 403
api.cloudflare.com              → CONNECT tunnel failed, 403
supabase.com                    → CONNECT tunnel failed, 403
dl.google.com / maven.google.com→ CONNECT tunnel failed, 403
```
against a working baseline (`api.github.com` → 200, `registry.npmjs.org` → 200, `pypi.org` → 200).

**None of Firebase, Supabase, or Cloudflare's admin/data APIs are reachable directly from this
sandbox — this is not a Firebase-specific problem, it applies equally to all three candidates.**
This means, regardless of which backend is chosen, provisioning it (creating the project/database,
writing security rules or schema, running migrations) and any live integration test against a
*real* backend cannot happen interactively in this sandbox the way `index.html` changes are
verified today (edit → curl/Playwright against the live GitHub Pages URL in the same session).
It has to go through **GitHub Actions** (a new workflow, mirroring `.github/workflows/
android-build.yml`'s already-proven pattern of doing the network-restricted work on GitHub's
runners) or be done by Aaron directly. This is a real, ongoing workflow change for this team, not
a one-time setup cost — flag it as such rather than a footnote.

### 2.1 Option A — Firebase / Firestore
**Setup complexity:** low-to-medium (console click-through + Firestore JS SDK via CDN, no build
step needed, consistent with this app's zero-build philosophy). **Real-time listeners:** yes, but
this feature's spec ("roughly within a minute, not instant") doesn't need them — paying for
real-time infrastructure we then don't rely on is a cost with no matching benefit here.
**Free tier:** generous at this app's likely scale. **Risk:** Firestore's security-rules DSL is a
second language to get right, and its most common real-world failure mode is exactly the one that
matters most here — a project accidentally left in "test mode" (world-readable/writable) is a
frequent, well-documented mistake, and this app has **no account system** to fall back on as a
second line of defense if a rule is wrong. For real patient/caregiver health data, that's a
correctness-by-configuration risk I'd rather not accept for a solo non-technical owner with no
backend engineer to review rules changes. Also: real vendor lock-in to Google's ecosystem, which
sits awkwardly next to this app's own "no Google/no cloud" origin story.

### 2.2 Option B — Supabase
Same shape of tradeoff as Firebase: Postgres + Row-Level-Security policies instead of Firestore
rules, real-time subscriptions available but unneeded, decent free tier, open-source (less
lock-in than Firebase). RLS is arguably even easier to misconfigure than Firestore rules for
someone who doesn't write SQL day-to-day (policies are conditional SQL expressions evaluated per
row). Same "no account system as a backstop" risk as Firebase. Slightly better fit if Aaron ever
wants to poke around a real Postgres console himself, which he currently has no comparable
capability for elsewhere in this project.

### 2.3 Option C — Custom lightweight backend (recommended: Cloudflare Workers + D1)
A handful of REST endpoints (`POST /pair/create`, `POST /pair/redeem`, `GET /profile/:token/pull`,
`POST /profile/:token/push`) backed by D1 (Cloudflare's SQLite-based managed database). No
security-rules DSL at all — authorization is one explicit line of JS per endpoint ("does this
request's token match a row in the profiles table"), reviewable the same way the rest of this
app's code is reviewed today. Polling fits this exactly — a plain `fetch()` GET every ~45s, no SDK
weight, no listener lifecycle to manage across the tick-render guard described in §1.3.

**Why this over A/B, concretely, for this specific project:**
1. §2.0 means all three require the same GitHub-Actions-based provisioning workflow — that
   advantage of a managed BaaS (click-console-instead-of-write-code) is largely unavailable here
   anyway, since the console itself isn't reachable from where this team does its interactive
   iteration.
2. The "roughly a minute, not instant" requirement removes the one thing Firebase/Supabase are
   genuinely best at (real-time listeners) from the decision — without it, they're mostly
   contributing SDK size, a rules DSL, and lock-in in exchange for a managed-console convenience
   this sandbox can't exercise directly anyway.
3. A custom Worker keeps 100% of the authorization logic as plain, auditable JS instead of a
   separate rules language — directly reduces the single scariest failure mode (accidentally
   world-readable health data) for a project with no dedicated backend engineer to review rules
   changes and no account system as a second line of defense.
4. **Cost fits the actual monetization model.** Both Plus ($4.99) and Pro ($14.99) are **one-time
   purchases**, not subscriptions (`index.html:2561-2562`) — there is no recurring revenue funding
   recurring backend cost. Workers' free tier (100k requests/day) and D1's free tier comfortably
   cover a beta-scale user base even at moderate polling rates (a single paired device polling
   every 45s is ~1,900 requests/day; dozens of paired profiles stay well inside the free tier).
   This matters more here than it would for a subscription business.
5. Wrangler (Cloudflare's CLI) is a plain npm package, deployable from GitHub Actions with an API
   token secret — the exact same shape of "move the network-restricted work to CI" pattern
   `android-build.yml` already established for the Gradle/Maven problem. No new category of
   process for this team to learn, just the same one applied a second time.
6. Proven, boring technology (Workers has been GA for years; D1 is Cloudflare's standard SQLite
   offering) — satisfies "avoid experimental/poorly-documented dependencies."

**Honest tradeoff to name for Aaron:** this means writing and owning actual backend code (schema +
a handful of endpoints) instead of mostly-configuring a BaaS console. That's more surface area for
a solo AI-driven team to maintain — but it's a small, simple surface area, testable the same
incremental way this team already tests `index.html` changes, and it avoids the rules-DSL
misconfiguration risk that matters more given real patient data and no accounts. If Aaron
specifically wants a managed console he can look at himself without going through Claude, that's a
legitimate reason to override this recommendation toward Supabase (better non-technical console
experience than raw D1) — flagging that as the one case where I'd revisit this call.

---

## 3. No-login pairing mechanism

**Identity primitive:** since there's no login, "this device" is identified by a generated
`installId` — reuse the exact id-generation pattern already used for entries/appointments/notes
(`Date.now().toString(36) + Math.random().toString(36).slice(2,8)`, see :198, :210, :250). Store it
in a new **device-wide** key (parallel to `PROFILES_KEY`/`LICENSE_KEY`, not profile-scoped —
survives profile switches, matches the fact that a physical device pairs into a shared profile
regardless of which local profile is currently active).

**Flow:**
1. On the device that already owns the profile: a Pro-gated "Share this profile" action calls
   `POST /pair/create`, uploading a one-time snapshot of that profile's current
   entries/meds/appts/notes/prefs to seed a new server-side profile record, and receives back (a)
   a short numeric pairing code (6 digits — relayable by voice/text, matches the mental model of
   an Apple/Google/Trello-style share code) with a short expiry (~10 minutes, single-use) and (b) a
   durable, opaque profile-sync-token this device stores locally as its own credential going
   forward. Shown as both the digits and a QR code (`chemowell://pair/<code>` or equivalent) for
   the second device to scan.
2. On the joining device: "Join a shared profile" → scan or type the code → `POST /pair/redeem` →
   server validates the code (unexpired, unused), returns the same durable profile-sync-token,
   invalidates the code. The joining device now polls/pushes using that token.
3. The token — not a username/password — **is** the authorization credential, deliberately weaker
   than a real account system, matching a Trello board-link / Google Home invite-link trust model.
   That tradeoff needs to be said out loud to Aaron, not just implied: a code intercepted during
   its ~10-minute window, or a lost/stolen phone that still has the token stored, both grant
   access to that profile's data. Mitigations that are cheap to build: short code expiry + single
   use (already above), and a "Revoke shared access" action on the owning device that invalidates
   the server-side token and forces every other paired device to re-pair.

**Reinstall/uninstall:** the token lives in localStorage like everything else in this app — an
uninstall wipes it exactly the same way it wipes all other local data today (no change in
that specific behavior). Reinstalling requires generating a **new** pairing code from an
already-paired device and redeeming it again. This is spec-acceptable (the task explicitly allows
"do they need to re-pair" as an open, answerable question) — the answer is yes.

**Overlap with the existing "Backup & transfer to a new phone" Plus-tier promise:** the Plans
sheet already advertises this, unimplemented, as a Plus feature (`index.html:2561`: *"Backup &
transfer to a new phone (coming in beta)"*), separate from Pro's *"Real-time shared access for
caregivers... (coming soon)"* (`:2562`, note the copy already says "Real-time" — see §7 risk on
correcting that word once sync actually ships as ~45s-polling, not real-time). **These two roadmap
items are the same underlying primitive.** A one-shot "redeem a pairing code, pull the full
profile down once, don't keep polling" is exactly a restore-to-new-phone flow. Recommend Aaron
adopt this as the actual product boundary: **Plus gets one-shot pairing (restore/transfer only, no
ongoing sync loop) using the same `/pair/create` + `/pair/redeem` + one pull; Pro adds the ongoing
poll-and-push loop that keeps two live devices in sync.** This avoids building two separate
mechanisms for what is functionally one primitive used two different ways, and gives Plus
purchasers something real for their existing "coming in beta" promise essentially for free once
Pro sync ships.

---

## 4. Conflict resolution

Split by data class (per §1.1):

**Append-only (entries — doses, vitals, symptoms, weight, BP, temp, chemo-date logs):** there is
no "edit an entry" code path anywhere in this file today — only `addEntryDB` (push) and
`removeEntryDB` (filter-out by id). This means sync can be a straightforward **union merge by id**:
pull remote entries the local device doesn't have, push local entries the remote doesn't have.
The one thing that needs adding is a **tombstone** for deletes (a `deletedAt` flag rather than a
hard local removal, at least for the synced portion of the record) — otherwise a device that
hasn't yet pulled a deletion could re-push the same id and resurrect an entry the other caregiver
deliberately removed. This sidesteps nearly all real conflict handling for the highest-volume data
in the app, by construction of how the app already stores it — a genuinely good fit.

**Mutable, safety-critical (medication config — `chemowell-app-p-<id>-med-v1`):** this is the case
the task explicitly says not to hand-wave — **two caregivers editing the same medication's
schedule within the same ~45s poll window.** Concrete answer:
- Add an `updatedAt` timestamp to medication records (additive; missing on old records = treat as
  epoch 0, i.e. always "older" than any synced value, so old local-only records never wrongly win).
- On every sync cycle, compare the local record's `updatedAt` against the last-successfully-synced
  watermark for that record, *and* the remote's `updatedAt` against the same watermark.
  - If only one side changed since the watermark → plain last-write-wins is safe (there's no
    genuine concurrent edit, just a normal "the other device's earlier change hasn't reached me
    yet") — apply silently, no UI needed.
  - If **both** sides changed since the watermark → this is a real concurrent edit. **Do not
    auto-apply either side.** Mark that one record as "not synced — edited on two devices," leave
    both local values exactly as they are (nothing is overwritten, nothing is lost), and surface a
    small non-blocking indicator using the app's existing toast/warn visual language rather than a
    blocking modal (respects "no kicking someone out mid-edit" — a caregiver mid-edit on device B
    keeps their own in-progress typing regardless of what device A just did).
  - Full resolution UI ("Keep mine / Use theirs / Review both") is explicitly **slice 2+** (see
    §6) — slice 1 only needs to do the *safe* thing (detect-and-hold), not the *complete* thing.
- This directly answers the daily-limit/dosing-safety scenario: a bare last-write-wins **could**
  silently discard a caregiver's careful edit to a safety ceiling if the other caregiver's edit
  happened to sync a few seconds later — that's unacceptable for this kind of data, so the
  concurrent-edit case is the one place this design deliberately refuses to auto-merge.

**Mutable, lower-stakes (appointments, notes, prefs):** plain last-write-wins per record (or
per-field for prefs, since it's already a shallow-merge patch object at `setPrefsDB`, :222-226) is
an acceptable simplification — no patient-safety stakes if a duplicate calendar reminder or a
slightly stale unit preference briefly loses to a concurrent edit. Not in scope for slice 1 either
way (see §6).

---

## 5. Migration / backward compatibility

- Sync must be **strictly additive and opt-in**: a profile that never runs "Share this profile"
  makes zero network calls and has zero behavior change — this is both the resolution to the §0
  contradiction (the old "no cloud, ever" promise becomes "no cloud unless you opt in per
  profile") and the concrete regression bar for QA (re-run the existing regression suites already
  in this repo — `verify_v39_regression_smoke.mjs`, `verify_v40_erase_relocated.mjs`, etc. —
  unmodified, against a never-paired profile, as part of Definition of Done for slice 1, to catch
  any accidental always-on network call).
- Existing local data becomes sync-enabled **through the pairing action itself** — generating the
  first pairing code performs the one-time initial upload described in §3. No separate migration
  step, no data transformation needed beyond adding the `updatedAt` field described in §4 (which
  can default in at pairing time for medication records that don't have one yet).
- A profile that's never been paired stays 100% local-only forever, exactly as it behaves today —
  this needs to remain true even after Aaron eventually revokes/rotates a pairing (see §3) —
  revoking access should not force previously-unpaired profiles into any new code path either.

---

## 6. First shippable slice — Definition of Done

This team's actual pace (per `git log` and the README version table — roughly a dated, narrowly-
scoped release every 1-3 days, each independently chain-verified) argues strongly against a
big-bang rewrite. Slice 1:

**Must work:**
1. Pro-gated "Share this profile" generates a pairing code + QR on device A.
2. "Join a shared profile" on device B redeems the code and links to the same server-side profile.
3. Two-way sync of **medications + entries only** (append-only entries per §4's easy case, plus
   the concurrent-edit-detection-and-hold behavior for medication records per §4's hard case) —
   appointments, notes, and prefs are explicitly out of slice 1.
4. Polling every ~45s while the app is foregrounded/visible (a `visibilitychange`-triggered poll
   on resume, plus the interval while visible, is sufficient for "roughly within a minute" — no
   native background-fetch plugin needed for slice 1, which keeps this entirely in the shared
   `index.html`/web layer per §1.5).
5. A visible "Last synced Xs/Xm ago" indicator plus a manual "Sync now" action — gives the
   caregiver an honest, legible signal instead of invisible magic, which is itself part of
   satisfying "no screen flicker" (a user who can see *why* something just updated is not
   surprised by it).
6. Sync-triggered state updates reuse the existing defer-while-modal-open pattern (§1.3,
   `pendingEntries` / the `subscribeEntries` consumer at :6616-6626) and are added to the existing
   1s-tick render guard list (:6643) from the start — not bolted on after a flicker bug is
   reported, given this exact bug class has already shipped three times in this project's history.
7. Uninstall/reinstall requires re-pairing — explicitly acceptable, and worth telling Aaron
   directly ties into the existing "Backup & transfer to a new phone" Plus-tier promise (§3).

**Must NOT regress:** a profile that never pairs shows zero behavior change and zero new network
traffic (§5) — this is the single most important regression bar, since most of this app's existing
user base will never opt in.

**Explicitly out of scope for slice 1** (deferred to later slices): appointments/notes/prefs sync,
full conflict-resolution UI (only detect-and-hold in slice 1, per §4), background/locked-phone
sync, more than two simultaneous devices exercised in testing (though the pairing primitive itself
should not artificially cap at two), revoke/rotate-pairing UI (a simple hard "unlink" is enough for
slice 1), and the Plus-tier one-shot restore flow described in §3 (a natural slice 2, since it
reuses the same primitives once they exist).

---

## 7. Risks / landmines for the Lead Developer

1. **`APP_CLAUDE.md` rule 1/2 directly contradicts this task** (§0) — must be explicitly rewritten
   as part of this work, with Aaron's sign-off, not silently overridden.
2. **This sandbox cannot reach Firebase, Supabase, or Cloudflare's APIs at all** (§2.0, verified
   live: 403s on `firestore.googleapis.com`, `identitytoolkit.googleapis.com`,
   `api.cloudflare.com`, `supabase.com`) — backend provisioning and any live integration test
   against a real backend needs a new GitHub Actions workflow (mirroring
   `.github/workflows/android-build.yml`'s existing pattern), not the usual interactive-in-session
   workflow this repo's other features are built with.
3. **The render loop will reproduce its own flicker-bug history if sync isn't added to the
   existing tick-guard list from day one** (§1.3) — this exact class of bug (full-DOM-rebuild
   destroying an open modal/losing focus) has already shipped and been fixed three times (v11
   Plans sheet, v22 drawer/appointment form, v27 medication editor) each as a distinct incident.
4. **`sw.js`'s cache-first shell caching means the `CACHE` constant must be bumped in the same
   commit that ships sync code**, or already-installed users (including the caregivers this
   feature targets) can keep running old non-syncing JS with no visible error — this is a
   documented, recurring class of bug for this project (see app-v35's README entry).
5. **Monetization/cost mismatch:** both Plus and Pro are one-time purchases (`:2561-2562`), but a
   sync backend has recurring hosting cost — flagged explicitly in §2.3; free tiers likely cover
   beta-scale usage for a long time, but this is not free forever and the current pricing model
   doesn't fund it the way a subscription would. Worth Aaron knowing now.
6. **`deleteProfile()` (:153-166) has no server awareness today** — once sync exists, deleting a
   profile locally needs to either unlink+notify the backend or explicitly decide it's a
   local-only action that leaves the server copy (and the other paired device) untouched; as
   written today it would either orphan server data or risk a synced-back resurrection of a
   profile a caregiver deliberately removed. Needs an explicit decision, not an accidental default.
7. **Synced-in medication changes must trigger the same notification-resync hooks a local edit
   already does.** README's app-v35 entry documents that delete/pause/edit of a medication must
   call `markNotifDirty()`/`syncNativeReminders()` or stale native alarms stay armed — a
   caregiver-initiated change arriving via sync needs to hit the exact same hooks, or the
   receiving device's reminders silently drift from what's actually being synced.
8. **License/tier gating is currently 100% client-side and device-wide** (`LICENSE_KEY`, :109-113)
   — pairing/sync is inherently per-profile and cross-device, so decide explicitly whether both
   sides of a pairing need their own Pro license or only the profile's "owner" device, and enforce
   whichever answer server-side (the pairing endpoints are, notably, the first place this app
   would ever check anything against a server at all — today's tier gating has always been
   client-trust-only).
9. **Existing Plans-sheet copy already says "Real-time shared access"** (`index.html:2562`) — once
   the actual implementation is ~45s polling, this word should be corrected (e.g. to
   "automatically" or "within about a minute") so the shipped feature doesn't visibly under-deliver
   against its own marketing copy.

---

## Sources read for this brief
`index.html` (full structural pass + targeted reads: storage layer :50-320, profiles :115-173,
medication config :396-580, state/render/tick :601-615, :2768-2870, :6600-6690), `sw.js`,
`capacitor.config.ts`, `package.json`, `.github/workflows/android-build.yml`, `APP_CLAUDE.md`,
`README.md` (full version-history table), `BACKLOG.md`, `git log` (last 30 commits), and live
network reachability tests run from this sandbox against Firebase/Supabase/Cloudflare/Google-Maven
endpoints.
