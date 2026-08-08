# HANDOFF.md — start here in a brand-new chat

Written 2026-08-08, current as of app-v51. If you're a fresh Claude session and Aaron just
pointed you at this repo, read this file first — it tells you what order to read everything else
in, what's actually true right now, and what to do next. Nothing here should be taken on faith;
every claim below is backed by a file in this repo, cite it back to Aaron if he asks.

## Read these, in this order, before touching any code

1. **`APP_CLAUDE.md`** — the hard rules (data privacy, repo boundaries, commit/push
   authorization, "find solutions don't surface problems," commit locally often). Non-negotiable
   constraints, not suggestions.
2. **`TEAM.md`** — the actual release process: who does what, when the full Quality Chain is
   required vs. when the Lead Developer can move solo, the restart rule, release mechanics. Read
   the **"Process-gap incident, 2026-08-08"** section near the top especially — it's there because
   this exact mistake (skipping the mandatory Auditor/PM gates) already happened once, was caught
   by Aaron, and got corrected. Don't repeat it.
3. **`REQUESTS.md`** — start with its **"Next up, in order"** section (right after the intro).
   That's the actual priority queue. The rest of the file is the full history of every request
   Aaron's made and its status — searchable, not something to read end to end.
4. **`README.md`**'s version history — the detailed "what shipped and why" for every release,
   newest first. You don't need to read all of it; skim the last 3-4 entries for recent context,
   search it when you need the reasoning behind something specific.
5. **`BACKLOG.md`** — smaller issues logged but not yet promoted to REQUESTS.md. Check it before
   assuming something is undiscovered.

## Who you are, and who else is available

You (this session) are the **Lead Developer** — the sole point of contact with Aaron, who is a
non-technical solo founder and the product owner. He sets direction; you own every technical
decision. Full standing instructions for how he wants you to operate are in your own system
prompt (ownership, zero-error bar, real testing, design quality, communicate-before-coding) —
`TEAM.md` and `APP_CLAUDE.md` are the project-specific rules layered on top of that.

**You are never alone on a code change. This is not a judgment call you get to make.** Aaron said
this explicitly, 2026-08-08, after catching a release that shipped self-verified only: "the whole
point of the team was to catch things you don't see. I'm not sure I like your judgement that you
can handle on your own... this is an important project and things can't be missed bc this is
peoples lives at stake." Use the `Agent` tool to spawn the other roles TEAM.md defines —
Developer, Designer, Zero Day Auditor, Lead Auditor/Lead Designer, Project Manager — as
independent subagents with their own fresh context. **Every single change to `index.html`,
`sw.js`, anything under `.github/workflows/`, `sync-backend/`, or dependency/config files gets an
independent Zero Day Auditor pass and an independent PM sign-off before you report it to Aaron as
done — no exception for how small, obvious, or safe it looks.** Self-verification (your own
syntax checks, Playwright runs, live-site checks) is real and still required, but never report it
to Aaron as if it were the independent gate — it isn't one. A role never reviews its own work; you
(Lead Developer) never self-certify. The `quality-chain` skill (if listed as available to you)
documents this same process in more general terms — TEAM.md is this project's specific,
authoritative version; follow TEAM.md where the two differ, and read its "Process-gap incident,
2026-08-08" section for the full context of why this rule has zero size-based exception now.

## What's actually true right now (verify before trusting, this can go stale)

- Live build: https://arnjnnngs.github.io/chemowell-app-beta/ — currently `app-v51`.
- Native Android debug APK: auto-built by `.github/workflows/android-build.yml` on every push
  that touches native-relevant files; published to the GitHub Release tagged
  `app-v14-native-test` (stable public URL, no login needed) once CI finishes. Check
  https://github.com/Arnjnnngs/chemowell-app-beta/actions for build status before telling Aaron
  something is ready to install.
- **Outstanding, waiting on Aaron, not on you:** he needs to install the current APK and confirm
  three things actually work on his Galaxy S25 Ultra — exact-alarm reminder timing, the new
  "Allow background activity" battery control, and CSV/PDF export reaching the native share sheet
  (this one broke silently once already, see REQUESTS.md's export item and README's app-v51
  entry — don't mark it Completed until he confirms it on the actual app-v51 build).
- **Next build priority: multi-device/multi-user sync.** Confirmed by Aaron as the top priority,
  App Store blocker, and explicitly told to use the full team (not solo) given the stakes. Fully
  scoped in `outputs/SYNC_DEVELOPER_BRIEF_v2.md`; blocked on Aaron completing 3 one-time Vercel
  dashboard steps — check REQUESTS.md's sync item for exactly which three, and ask him directly
  if it's unclear whether he's done them.
- **Approved and ready whenever there's a good slot for it:** the per-medication MedlinePlus
  "what is this for" link — already agreed with Aaron, no further sign-off needed, small and
  independent of sync.
- **Proposed, NOT yet approved:** dropping the Male/Female onboarding question in favor of an
  unconditional Settings toggle for menstrual-cycle tracking. Safe per a full codebase audit
  (documented in REQUESTS.md), but needs Aaron's explicit go-ahead before building.

## Mechanics you need to know before you push anything

- **No git push credentials in this sandbox.** All pushes go through Claude-in-Chrome driving
  the real GitHub web UI. `TEAM.md`'s "Release mechanics checklist" has the details.
- **Run `./release_check.sh` and confirm exit 0 before every push, no exceptions** — it catches
  the single most common mistake in this project's history (shipping `index.html` changes without
  bumping `sw.js`'s cache version, which makes a real fix look like it silently didn't work).
- **A specific, sharp gotcha:** if you ever push a file containing literal `${...}` (bash
  variable syntax, common in `.github/workflows/*.yml`) via `javascript_tool`'s
  `execCommand('insertText', ...)`, and you pass that content as a JS backtick template literal,
  the browser's JS engine will silently evaluate `${...}` as real template interpolation and
  corrupt the file. This already happened once (see the app-v51/README app-v50 process note, and
  `git log` around commit `e41f27b`). Prefer the real byte-transfer `file_upload` tool for any
  file with this pattern, or explicitly escape `${` as `\${` if you must type it.
- **Verify what's actually live with `git show origin/main:<path>`**, not
  `raw.githubusercontent.com` — that CDN has been observed serving stale cached content even with
  a cache-busting query param.
