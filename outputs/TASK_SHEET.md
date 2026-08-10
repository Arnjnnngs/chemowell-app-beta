# ChemoWell — Task Sheet
**As of 2026-08-10 · live build: app-v52 · https://arnjnnngs.github.io/chemowell-app-beta/**

Standing rule (TEAM.md): this sheet goes to Aaron after **every** build and **every** request — not
just completions. If a session ends without it having been shown once, the Scribe step didn't happen.

---

## ⏳ ON AARON (nothing is blocked waiting on these)

| # | What | Why it needs you |
|---|---|---|
| 1 | **Reopen ChemoWell** to pick up app-v52 | No new APK needed — v52 only changed files the installed app loads from the web |
| 2 | **CSV / PDF export → share sheet** on the app-v52 build | You confirmed this on v51. Worth one re-check since v52 rewrote that column |
| 3 | **Exact-alarm reminders + background activity** still behaving | Confirmed working on v51; just don't want v52 to have disturbed it |

Everything else below is mine.

---

## ✅ DONE (this session)

**Shipped in app-v52 — live, gated, verified on the deployed site**
- Missed-dose alarm that could never be dismissed — Home and History now agree exactly (verified at 9 misses and at 1,460)
- Medications no longer vanish from Home — one shared check across all 10 code paths; window walk exact, no off-by-one
- "500 mg, 500 pills" — CSV *and* the printable doctor's report; affected every unit, not just Tylenol
- **Near-treatment / exclude removed entirely for "Other" profiles** (your request), including on profiles upgraded from older builds
- 4 Designer fixes: amber "No date set" state, Settings copy, radiation card order, "Nothing logged" instead of "0 doses"

**Confirmed working on your phone**
- Exact-alarm reminders + "Allow background activity" — battery optimisation was the unblocker
- CSV export reaching the native share sheet — closed a defect that shipped broken twice

**Decided and recorded (so nobody re-litigates it)**
- Server sync **cancelled**; Vercel project deleted, blob store emptied
- Device-to-device encrypted-file sharing chosen over Drive sync
- QR scratched · Pro-tier queue approved · Limit Units approved
- Bug logger and help-bot both confirmed buildable with no server

**Process**
- Auditor now owns all test legwork — profiles, meds, logs, tours. Written into TEAM.md so it can't drift
- This task sheet is now mandatory after every build/request

---

## 🔨 NEXT UP (my queue, in order)

| # | Task | Notes |
|---|------|-------|
| 1 | **Fix `release_check.sh`** | Found by the PM gate: it only checks *uncommitted* work, so it passes green on the exact stale-cache bug it exists to block. Gets its own gates. **Before anything else ships.** |
| 2 | **Limit Units + CSV unit bug** | mcg, mL, patches, puffs, drops, sprays, IU, injections, suppositories. Medication-safety logic → full 20-case sweep |
| 3 | **Device-to-device sharing** | Design done (`SHARING_DEVELOPER_BRIEF_v3.md`). Also closes "move to a new phone" |
| 4 | **MedlinePlus "What is this for?" link** | Approved, small, independent |
| 5 | **"Save to this phone" on export** | You found this — no local-save target in the share sheet |
| 6 | **Fix Pro copy promising "real-time shared access automatically"** | We no longer deliver that. Must change before Pro is sold |
| 7 | **Pro tier:** calendar integration → full backup/export → chemo trend insights → care-team tasks → escalating reminders | Last two are reduced in scope without live sync |
| 8 | **In-app bug logger** | Say go and I build it |

---

## ❓ WAITING ON YOUR DECISION

- **Help-bot content session** — the build is easy; the catalogue of real problems needs an hour with you
- **Drop the Male/Female onboarding question?** — audited as safe; needs your go-ahead
- **Redeem codes** — you said "maybe for later"

---

## 📋 BEFORE APP STORE

- **Privacy Policy URL** — Apple and Google both require one; doesn't exist yet
- Lawyer review of the disclaimer + policy (no longer blocking, since we hold no data)
- `manifest.webmanifest` / `package.json` still say "for chemo patients" — inaccurate since Other/radiation onboarding

---

## 🐛 KNOWN, LOGGED, NOT URGENT

In `BACKLOG.md` — none of these affect a real user today:
- History gets slow past ~1,400 missed doses (tail case from the v52 fix)
- No way to change treatment type after setup — real gap if someone picks wrong or moves chemo → radiation
- Doctor's report prints raw `override: early+overLimit` instead of "Early · Over limit"
- No year on Notes/Calendar dates
- Dead "Other"-only copy left behind by v52
