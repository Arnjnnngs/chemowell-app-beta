# ChemoWell — Task Sheet
**As of 2026-08-19 · live build: app-v57 (published 2026-08-13) · https://arnjnnngs.github.io/chemowell-app-beta/**

Standing rule (TEAM.md): this sheet goes to Aaron after **every** build and **every** request — not
just completions. If a session ends without it having been shown once, the Scribe step didn't happen.

> **This sheet was stale for six days.** It sat at "app-v56 / as of 08-11" while app-v57 shipped and
> was live-verified on 08-13. Worse than out of date: it was still asking Aaron to test **the help
> bubble**, which v57 deleted. Brought current 08-19 after Aaron asked whether the board was being
> updated. It was not. `BACKLOG.md` and `REQUESTS.md` *were* updated for v57 — only this sheet was skipped.

---

## ⏳ ON AARON (nothing is blocked waiting on these)

| # | What | Why it needs you |
|---|---|---|
| 1 | **Close ChemoWell fully and reopen it** | Picks up app-v57. No new APK needed |
| 2 | **Open the ☰ menu → Help & FAQ** | This is what you asked for after v56 — *"I don't really care for the 'bot' … but I do think all of those things can be in a FAQ under the 3 hamburger menu."* The bubble is gone; this is what replaced it. Try the search box with a real question |
| 3 | **Open the beta as a plain URL in a browser tab** (not the installed app) | New in v57: a one-time card explains what a browser build can't do. It's the first thing a tester you share the link with will see. It differs on iOS vs Android — worth seeing the one your testers will get |
| 4 | **CSV / PDF export → share sheet** | You confirmed this on v51. Still owed a re-check — that column has been rewritten since |
| 5 | **Exact-alarm reminders + background activity** | Confirmed working on v51; just confirming nothing since disturbed it |

Everything else below is mine.

---

## ✅ DONE — live in app-v57

**The help bubble is gone, and Help & FAQ took its place**
- The floating button, panel, transcript, composer and the medical/person guards are all removed —
  **~46,000 characters deleted**. `test/v57-search.mjs` asserts *by absence* that no bubble symbol
  survives anywhere in shipped code, so it cannot creep back one helper at a time.
- The menu row and the eyebrow on all four Help screens now read **Help & FAQ**.

**The search box stopped answering emergencies with app pages** — the serious find of this release
- The Zero Day Auditor did not take the release notes on trust. He sliced v55's actual search out of
  its commit and ran the same 50 clinical questions through both builds. **v55 returned nothing for
  49 of 50** — the honest empty state. **v56/v57 returned a ranked list for 45 of 50.**
- Real examples at phone size: *"she collapsed"* ranked **"All my medications vanished from Home"**;
  *"she is unresponsive"* ranked **"I tap something and nothing happens"**; *"she is coughing up
  blood"* returned **66 rows** headed by "How do I record blood pressure?" Nothing on that screen
  said the app holds no medical information.
- **The fix does not restore the guards.** The care-team sentence and a one-tap route to the
  emergency page now sit above **every** search-results screen, unconditionally — no classifier
  deciding which questions are frightening. A relevance floor cut the 66-row tail to 19, and a cap
  of 12 holds the list to a phone while still reporting *"The closest 12 of 19 matches."*
- New help page — **"Side effects — hair loss, sickness, tiredness: is this normal?"** — says plainly
  that ChemoWell holds no information about any drug and would be guessing if it said otherwise.

**The browser build now introduces itself** — because you're sharing the beta as a URL
- One-time card on Home, browser only, never in the native build. Three things: **add this to your
  Home Screen** (iOS Safari erases a site's saved data after 7 days without a visit, and nothing
  logged here is stored anywhere else); **reminders only arrive while the page is open**; and
  **exports download instead of opening the share sheet**. The whole body branches on iOS vs
  Android and on already-installed — not just the first sentence.

**Designer failed it on three Must-fixes, all real, all fixed**
- The card was **919px tall at 360px** (1,121px at 320px) — taller than the phone — with body copy
  in a **207px column**: 24 characters per line against a floor of 45. Now **548px with a 291px column**.
- The **✕ was 28×28px**, 40% under this project's floor, and was the only control on screen when the
  card first painted.
- The toast sat **34px into the "Back to reports" pill**, same dark fill, for its full 4.5s life.

**Two tests had stopped guarding, in opposite directions**
- `EXPECTED_TOPICS` was pinned at 117, so adding one help page broke six assertions that were
  checking nothing wrong. Now derived from source — with a ratcheted floor of 118, because deriving
  it made *deletion* invisible.
- The care-team coverage floor read the top 8 while only 4 rows fit above the fold, and was
  set-based — so dropping `careLead` from **`sym-severe`**, the emergency page the metric exists
  for, still printed ALL GREEN.

**Manifest wording fixed** — `manifest.webmanifest` and `package.json` said *"for chemo patients"*,
which is what a tester reads under the icon on Add to Home Screen. Wrong since app-v33.

---

## 📌 KNOWN, RECORDED, NOT YET FIXED

- **`git push` is blocked in the Claude sandbox** (403 through the proxy). Every deploy is a manual
  browser upload. Already in `BACKLOG.md` as *"the real reason git push is blocked here, and it is
  fixable in settings."* **This is the highest-value fix available on this project** — the friction
  is what causes work to sit unpushed. It cannot be changed inside a running session; it is set when
  a task is started.
- **The sandbox rolls back without warning** — recorded in `BACKLOG.md` with detection steps.
  Anything not pushed can vanish.
- **`.sh` exec bit does not survive a web upload** — recorded in `BACKLOG.md`.
- **PM-7** — observation logged during the v57 gate, next release, not a blocker.

---

## 🧭 NOTE FOR THE NEXT SESSION

A sandbox copy of this repo was found on 08-19 sitting **27 commits behind** the remote, on a
diverged branch. It was mistaken for unpushed work and nearly acted on. **Always check the direction
of divergence** (`git merge-base --is-ancestor origin/main HEAD`) before concluding anything is
missing — and prefer a fresh clone over any long-lived sandbox copy.
