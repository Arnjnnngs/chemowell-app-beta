# ChemoWell — Task Sheet
**As of 2026-08-10 · live build: app-v55 · https://arnjnnngs.github.io/chemowell-app-beta/**

Standing rule (TEAM.md): this sheet goes to Aaron after **every** build and **every** request — not
just completions. If a session ends without it having been shown once, the Scribe step didn't happen.

---

## ⏳ ON AARON (nothing is blocked waiting on these)

| # | What | Why it needs you |
|---|---|---|
| 1 | **Reopen ChemoWell** to pick up app-v55 | No new APK needed. Close it fully and reopen — the cache key changed, so it will update itself |
| 2 | **Open the menu → Help** | This is the "bot" you asked where to find. 117 walkthroughs, works with no signal |
| 3 | **CSV / PDF export → share sheet** | You confirmed this on v51. Still owed a re-check on v53/54/55 since that column was rewritten |
| 4 | **Exact-alarm reminders + background activity** | Confirmed working on v51; just confirming nothing since disturbed it |

Everything else below is mine.

---

## ✅ DONE — shipped and live in app-v55

**The "bot" you asked for**
- **117 step-by-step walkthroughs across 17 categories**, plus a search box over the whole set —
  reachable from the hamburger menu → **Help**
- Works **completely offline**. No model, no API, no server. Nothing anyone types into it leaves
  the phone — which is the same reason we cancelled server sync
- Your original 15 FAQ answers are still there, unchanged, as the **Common questions** category
- The nine medication/symptom pages open with a care-team line first, in the app's own existing
  disclaimer wording — no thresholds, no numbers, no dosing advice anywhere

**Your other requests, closed**
- **Treatment type is editable in Settings** (chemo → radiation → both → other), history kept
- **Tapping the name at the top of the menu no longer navigates** — display-only, as you asked
- **Near-treatment / exclude removed entirely for "Other" profiles**
- The "500 mg, 500 pills" bug in CSV *and* the printable doctor's report
- The missed-dose alarm that could never be dismissed
- Medications that could vanish from Home permanently

**Quality gates on this release**
- Zero Day Auditor: 5 findings — **all 5 fixed before push**
- Project Manager: returned **NO-GO** on my first fix pass with 5 more findings, then 3 more on
  re-check — **all 8 fixed**, verdict converted to GO
- 164 automated assertions across two suites, at phone widths 360px and 390px. Zero console
  errors, zero layout overflow, all 133 help rows opened and checked
- Verified on the real deployed site in your browser, not just locally

**The release safety script, properly fixed this time**
- It could be fooled into printing a green tick on a build that would silently strand everyone
  who already has the app installed — the exact app-v40 failure that cost you a whole day
- Root cause: it compared against GitHub, which this sandbox can never refresh after a push, so
  it was checking against a build one release out of date
- Now compares against a committed record of what is actually live. Proved on throwaway copies
  across 10 cases that it blocks the bad ones and passes the good ones

---

## 🔨 NEXT UP (my queue, in order)

| # | Task | Notes |
|---|------|-------|
| 1 | **Limit Units + the CSV unit bug** | mcg, mL, patches, puffs, drops, sprays, IU, injections, suppositories. Medication-safety logic → full 20-case sweep |
| 2 | **Device-to-device sharing** | Design done (`SHARING_DEVELOPER_BRIEF_v3.md`). Also solves "I got a new phone" |
| 3 | **Fix the Pro copy promising "real-time shared access automatically"** | We no longer deliver that. Must change before Pro is sold |
| 4 | **"Save to this phone" on export** | You found this — no local-save target in the share sheet |
| 5 | **MedlinePlus "What is this for?" link** | Approved, small, independent |
| 6 | **Pro tier:** calendar integration → full backup/export → chemo trend insights → care-team tasks → escalating reminders | Last two are reduced in scope without live sync |
| 7 | **In-app bug logger** | Say go and I build it |
| 8 | **Drawer keyboard focus** | Broken since app-v22, affects keyboard/switch-access users only. Its own small release |

---

## ❓ WAITING ON YOUR DECISION

- **Drop the Male/Female onboarding question?** — audited as safe; needs your go-ahead
- **Redeem codes** — you said "maybe for later"

---

## 📋 BEFORE APP STORE

- **Privacy Policy URL** — Apple and Google both require one; doesn't exist yet
- **One oncology-nurse read of a single help page** — the one that lists signs meaning "call
  emergency services now". It's the only clinical judgement anywhere in the app and I won't
  guess at it. Not a beta blocker; a before-real-users one
- Lawyer review of the disclaimer + policy (no longer blocking, since we hold no data)
- `manifest.webmanifest` / `package.json` still say "for chemo patients" — inaccurate since
  Other/radiation onboarding

---

## 🐛 KNOWN, LOGGED, NOT URGENT

In `BACKLOG.md` — none of these affect a real user today:
- History gets slow past ~1,400 missed doses (tail case from the v52 fix)
- The "Pick a date" row still says that after a date is set
- The profile-switching help page doesn't mention Free is capped at 1 profile
- Doctor's report prints raw `override: early+overLimit` instead of "Early · Over limit"
- No year on Notes/Calendar dates
- Dead "Other"-only copy left behind by v52
