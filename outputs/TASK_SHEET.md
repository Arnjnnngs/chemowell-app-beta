# ChemoWell — Task Sheet
**As of 2026-08-11 · live build: app-v56 · https://arnjnnngs.github.io/chemowell-app-beta/**

Standing rule (TEAM.md): this sheet goes to Aaron after **every** build and **every** request — not
just completions. If a session ends without it having been shown once, the Scribe step didn't happen.

---

## ⏳ ON AARON (nothing is blocked waiting on these)

| # | What | Why it needs you |
|---|---|---|
| 1 | **Close ChemoWell fully and reopen it** | Picks up app-v56. No new APK needed |
| 2 | **Tap the new button in the bottom-right corner** and ask it something in your own words | This is the thing you asked for. Try a real question and a deliberately awkward one |
| 3 | **CSV / PDF export → share sheet** | You confirmed this on v51. Still owed a re-check — that column has been rewritten since |
| 4 | **Exact-alarm reminders + background activity** | Confirmed working on v51; just confirming nothing since disturbed it |

Everything else below is mine.

---

## ✅ DONE — live in app-v56

**The help bubble, in the shape you described**
- Button in the **bottom-right of every screen** — hidden during setup, the guided tour, the menu,
  any pop-up, and on the Help screen itself
- Tap it, type a question in plain words, get the matching help page back: the answer, the first
  three steps, and a button through to the full walkthrough
- **Capped at half the screen height**, so the app stays visible behind it. Long answers scroll
  inside the panel
- **One X**, which collapses it back to the bubble with your conversation intact. No minimise button
- If the question is ambiguous it offers up to four pages to pick from. If it doesn't know, it says
  so and offers the full list — it never guesses
- Works with **no signal at all**. There's no model, no account, no server. What you type is never
  saved anywhere and is gone when the app closes
- **It will not answer a medical question** — doses, whether something is safe, side effects,
  interactions, or how someone's feeling all go to the care team instead

**Earlier this session**
- app-v55's help centre fixes, the release-safety script, and the documentation gaps

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
| 8 | **Drawer keyboard focus** | Broken since app-v22, keyboard users only. Its own small release |

---

## ❓ WAITING ON YOUR DECISION

- **Drop the Male/Female onboarding question?** — audited as safe; needs your go-ahead
- **Redeem codes** — you said "maybe for later"

---

## 📋 BEFORE APP STORE

- **Privacy Policy URL** — Apple and Google both require one; doesn't exist yet
- **One oncology-nurse read** of the single help page that lists signs meaning "call emergency
  services now". It's the only clinical judgement anywhere in the app and I won't guess at it.
  Not a beta blocker; a before-real-users one
- Lawyer review of the disclaimer + policy (no longer blocking, since we hold no data)
- `manifest.webmanifest` / `package.json` still say "for chemo patients" — inaccurate since
  Other/radiation onboarding

---

## 🐛 KNOWN, LOGGED, NOT URGENT

In `BACKLOG.md` — none of these affect a real user today:
- The help bot still shows a list of app pages for about 1 medical question in 10 rather than
  routing it to the care team. It never *answers* one — that part is measured against 86 questions
  it was never tuned on
- History gets slow past ~1,400 missed doses
- The "Pick a date" row still says that after a date is set
- The profile-switching help page doesn't mention Free is capped at 1 profile
- Doctor's report prints raw `override: early+overLimit` instead of "Early · Over limit"
- No year on Notes/Calendar dates
