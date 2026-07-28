# PM Gate — app-v25 (medication editor, 6 Aaron-reported items)

**Lane:** Full-chain kickoff (Developer investigation covered an architecture question — item 3 —
that needed real thought), then items 1/4/5/6 were classified and executed as **fast lane** (copy/UX
only, one screen, no data-model change) with two Zero-Day-Auditor restart loops before reaching this
gate. Item 2 required no code change, only a live-deploy check. Item 3 was deliberately deferred
pending Aaron's decision.

**Who ran this pass:** Project Manager, independent session, per TEAM.md's rewritten chain of
command (app-v25). I did not implement anything in this release and did not write any of the three
audit reports. This document is my own independent verification, not a restatement of what the Lead
Developer or Auditor already claimed.

## What was asked

Aaron reported 6 issues on the medication Add/Edit screen (full detail in
`outputs/DEV_BRIEF_v25.md`, Developer stage): (1) the Daily Limit/Limit-unit pair reads as two
unrelated questions with no indication of what the resulting rule actually blocks; (2) the Schedule
Type dropdown looked like an old square OS-default control instead of the app's normal rounded
style; (3) Schedule windows use a Start/End time pair when Aaron wants a single alert time; (4)
"Minimum gap hours" is unclear jargon; (5) the mg-mismatch save-validation error doesn't explain
itself well; (6) general wordsmith cleanup elsewhere on the same screen. In the same message Aaron
made the process itself PM-led going forward, which is why this pass exists as a separate session.

## What I verified, and how

**1. Artifact existence and independence.** Confirmed all four required documents exist with
substantial, non-placeholder content: `DEV_BRIEF_v25.md` (421 lines), `AUDIT_v25.md` (line 1–282),
`AUDIT_v25_reverify.md`, `AUDIT_v25_reverify2.md` — read every one in full, not summarized. Each
reads as genuinely independent: different setup data, different specific reproduction techniques
(the reverify passes specifically probed cursor position, focus, and `localStorage` byte-for-byte
integrity that the first audit didn't test as deeply), different voice, and each explicitly
cross-checked the shipped source before testing rather than trusting the commit message. No
copy-paste structure between them. This is a real independent chain, not three passes of the same
review re-labeled.

**2. Git/commit cross-check.** Verified via `git log` that all three cited commits exist in the
actual history with the described diffs: `68a2125` (initial 4-item fix, 37 lines in `index.html` + 2
in `sw.js`), `4a2c8dd` (Finding 1/2 fix, 50 lines), `6e9f45e` (Finding A fix, 19 lines). Commit
contents match what each report claims was changed.

**3. Source-level spot-checks against the currently live-in-repo `index.html`** (not just trusting
the reports' narration):
- `dailyLimitPreview()` (`index.html:3370-3389`) — confirmed the 3-way `mg`/`pills`/`applications`
  branch exists in both the warning text (`3381`) and the toast (`3488`), matching Finding 2's fix.
- `index.html:3761-3772` — confirmed `Daily limit` is `type:'text'`/`inputMode:'decimal'` (not
  `type:'number'`) and `Dosage options`/`Daily limit`/`Limit unit` all pass `rerender:true` on their
  input handlers — matches the Finding 1 + Finding A fix chain exactly as described.
- `index.html:3877-3878` — confirmed the two proactively-fixed "Days before/after treatment" fields
  are also `type:'text'`/`inputMode:'numeric'`, matching the reverify2 report.
- `index.html:3843-3844` — confirmed the item-4 relabel ("Hours between doses" /
  "Extra hours between doses (optional)") is present with the exact wording specified.
- `index.html:3773` and `3461` — confirmed the item-6 Schedule Type option copy and the
  schedule-window save-toast copy were both actually rewritten as claimed.
- `APP_VERSION` (`index.html:4171`) = `'app-v25'`; `sw.js` `CACHE` = `'chemowell-app-v25'`. Version
  bump is real and consistent between the two files that need to agree.

**4. Live product.** A browser is connected to this session via `claude-in-chrome`, but the tool's
own operating instructions require asking the user which connected browser to use before taking any
action in it, and I have no way to ask that question from this independent verification pass. I did
not use it, rather than guess. This is a real limitation of this pass — I relied on the Auditor
chain's own live-browser evidence (all three audit reports did test against the actual deployed site
through the user's browser, with `getComputedStyle`, `localStorage` reads, and real keystroke
sequences, not just source reading) plus my own direct source inspection above, which is why I'm
comfortable with the parts of the chain I'm confirming — but I want this gap stated plainly rather
than implied away.

## What I found

Two of the three problems the DEV_BRIEF anticipated (a stale unit picker, a wrong save error) were
genuinely fixed and the fixes hold up under my own source check. But going back to the actual brief
line by line surfaced one real defect none of the three audits caught, plus two release-mechanics
gaps:

### Finding PM-1 (new, MEDIUM): the "Reminds between X and Y" copy fix from item 6 was never shipped

`DEV_BRIEF_v25.md` section 3d/6 explicitly documents that the schedule-window preview line
("Reminds between 8:00 AM and 8:30 AM," `index.html:3832`) is factually wrong today — the actual
reminder code (`dueRemindersAt()`) only ever fires once, at the start time, not repeatedly through a
range — and explicitly instructs: *"the minimal version of this fix (change to 'Reminds at X')
should ship even if the fuller item 3 redesign is deferred."* The brief's own summary table lists
`index.html:3760` (now `3832`) under item 6, the same fast-lane batch as items 1/4/5, alongside the
Schedule Type option copy and the save-toast copy — both of which *were* fixed.

I checked the live source directly: the line still reads `'Reminds between ' + formatQuarterHour
(row.start) + ' and ' + formatQuarterHour(row.end)` — unchanged since before this release.

All three audit passes tested this line and treated it as correctly untouched. `AUDIT_v25.md` test
case 17 states: *"Verified the Schedule-windows live preview line still reads 'Reminds between 8 AM
and 8 PM' (unchanged) — confirms item 3 was left untouched as directed, nothing silently broken by
leaving it alone. PASS."* That conflates two different things: item 3 (the Start/End redesign,
correctly deferred) and item 6's standalone copy correction (not part of the deferral, explicitly
called out as something that should ship on its own). Because the audit framed leaving this line
alone as the *correct* outcome, none of the three independent passes flagged it as a gap.

This is not dangerous — it doesn't affect what actually gets saved or what the notification code
does — but it is a real, verifiable miss against the deliverable's own brief on exactly the kind of
copy-accuracy question TEAM.md's copy-review section exists for, on a screen where "the wording
doesn't match what the app actually does" was Aaron's original complaint category. A caregiver
reading "Reminds between 8:00 and 8:30" would reasonably expect a reminder any time in that range,
when the app only ever reminds once, at 8:00.

### Finding PM-2 (LOW, release mechanics): README.md has no app-v25 entry

TEAM.md's release-mechanics checklist requires a "README.md version history entry" for every ship.
Checked `README.md`'s Version History table directly — the most recent row is still `app-v24`. No
`app-v25` row exists anywhere in the file.

### Finding PM-3 (LOW, release mechanics): `outputs/DEV_BRIEF_v25.md` was never committed to git

`git status` shows `outputs/DEV_BRIEF_v25.md` as untracked. The three audit reports
(`AUDIT_v25.md`, `AUDIT_v25_reverify.md`, `AUDIT_v25_reverify2.md`) were each committed in their own
commit (`cd89fb0`, `e151820`, `b1035a4`); the very first artifact in the chain was not. As it stands,
the foundational brief this entire release was built from exists only in this sandbox's working
directory, not in the pushed repository history.

## Honest checklist against Aaron's 6 original items

| # | Item | Status |
|---|---|---|
| 1 | Daily Limit unit ambiguity | **Fixed and verified.** Relabeled options, added helper text, added a live preview that (after two audit-fix loops) genuinely updates in real time on all three driver fields, confirmed via real-keystroke testing and a save/`localStorage` round trip. |
| 2 | Schedule Type dropdown looks old/square | **No code defect found — correctly diagnosed as a stale-cache issue, not unilaterally "fixed."** The DEV_BRIEF's stale-cache theory is well-supported: source confirms this select goes through the identical `selectFix()` treatment as all 12 other selects, and `AUDIT_v25.md` independently confirmed via `getComputedStyle` on the actual live site that it renders correctly, rounded, with the custom chevron. This is a sound conclusion, not the chain being generous to itself — it's backed by a real live check, not just a source read. |
| 3 | Schedule windows: range vs. single alert time | **Correctly deferred, not dodged.** DEV_BRIEF section 3a traces every functional dependency on the window's `end` value (missed-dose deadline, one-tap-logging gate) and shows this is a genuine architecture tradeoff, not a trivial UI change — removing `end` without a replacement concept would either break the open/closed gate or delay "missed" flags by up to a full day, a real safety-relevant regression for a medication-adherence app. Proposing a hidden auto-computed grace period with explicit open questions for Aaron (is 2 hours right, should it be exposed, should it be visible in the summary) is the right call, not corner-cutting. **However**, see Finding PM-1: the standalone copy correction this item's own writeup called for shipping independently was not actually shipped. |
| 4 | "Minimum gap hours" confusing wording | **Fixed and verified.** Relabeled to "Hours between doses" / "Extra hours between doses (optional)" with clearer helper text, confirmed present in source and live-tested by the Auditor. |
| 5 | Unhelpful mg validation error | **Fixed and verified.** Toast reworded, plus a new inline live-updating warning (same fix chain as item 1) so the mismatch is visible before Save, not just after. Confirmed via source and the reverify2 audit's full save/localStorage round trip. |
| 6 | General wordsmith pass | **Mostly fixed, one piece missing.** Schedule Type option copy and the schedule-window save-toast copy were both correctly rewritten. The "Reminds between X and Y" → "Reminds at X" correction, explicitly listed in this same item, was not shipped — see Finding PM-1. |

## Decision: **LOOP BACK — not yet ready for Aaron**

Per TEAM.md's restart rule ("if anything is wrong — found at any stage, by anyone — the work goes
back to the start of whichever lane it's in, not back one step"), Finding PM-1 sends this back to
the **Lead Developer, start of the fast lane** (not a one-line drive-by fix at this stage) — the
Lead Developer implements the "Reminds between X and Y" → "Reminds at X" copy correction that item
6 already specified, self-verifies, and the Auditor gets one more quick pass focused on this single
line plus a general regression check before this comes back to PM. Findings PM-2 and PM-3 (README
entry, committing the DEV_BRIEF) should be closed in the same pass since they're pure documentation
housekeeping, not new work.

**Why this matters enough to loop back, in plain terms:** five of the six things Aaron asked for are
genuinely done and I could verify each one myself against the actual code, not just the reports'
word for it. The sixth item's fix was 90% complete — but the one piece that was skipped is a
sentence that currently tells a caregiver a chemo medication will remind them "between" two times
when it actually only reminds once, at the first one. The team's own investigation (DEV_BRIEF item
3d) found this and explicitly said to fix it regardless of the bigger schedule-window question,
and it just didn't make it into the code — and all three independent audits, reading the same
line, waved it through as intentional. That's exactly the kind of thing this PM stage exists to
catch: not a paperwork gap, a real one-line miss on a wording accuracy problem that's in the same
category as Aaron's original complaint. It's a small fix, not a big setback, but it should go
through the loop properly rather than be patched in without going back through the process.

Once that loop closes (expect this to be fast — it's a one-line, isolated copy change with no logic
implications), this release should be ready to present to Aaron.

## Loop closure (follow-up pass)

**Who ran this pass:** Project Manager, a different independent session from the one that wrote
everything above. Per TEAM.md, I did not take the "it's fixed" claims at face value — this section
documents my own independent re-verification, run with the same rigor as the original gate pass,
not a rubber stamp of the intervening work.

**What happened since the original gate (for context, all independently confirmed below, not just
restated):** commit `bfad974` fixed the Finding PM-1 copy line and added the README app-v25 entry;
commit `3b270f9` committed the three previously-uncommitted documents (`DEV_BRIEF_v25.md`, this
file, `AARON_UPDATE_v25.md`); a focused Zero Day Auditor re-verify pass
(`outputs/AUDIT_v25_pmgate_reverify.md`) then independently tested the fix and reported PASS.

### 1. Read the re-verify audit in full, checked it actually re-tested what was asked

`AUDIT_v25_pmgate_reverify.md` covers, with real evidence rather than restatement:
- **The copy line itself**, checked two ways: a raw-GitHub source fetch (confirms the old `'Reminds
  between ' + ... + ' and ' + ...` string is gone, only the new `'Reminds at ' + formatQuarterHour
  (row.start)` string remains, cross-checked with `grep -n "Reminds"` across the whole file to rule
  out a second stale copy elsewhere) and a live-browser test via `claude-in-chrome` against the
  user's actual connected browser (not a thought experiment).
- **Both existing and brand-new medications** — seeded a test medication into `localStorage`
  alongside the 5 real ones and also created one fresh via the "Add" flow, checked the preview line
  on both, then cleaned up the seeded data and confirmed the app returned to its original state
  afterward.
- **The End-time picker still works** — explicitly changed the End-time select via a real `change`
  event and confirmed (a) the preview line is unaffected by End, driven only by Start, matching the
  brief's intent, and (b) the `<select>` itself is still rendered, still populated, still
  interactive — not silently removed as a shortcut.
- **README entry and DEV_BRIEF commit** — confirmed the README app-v25 row exists at the top of the
  version-history table, and separately confirmed via `git log` that commit `3b270f9` added the
  previously-missing `DEV_BRIEF_v25.md`.
- **A general regression check**, not just the one line: re-tested the daily-limit live preview and
  the "Extra hours between doses" label (both from earlier rounds of this same release) and found
  zero console errors across the full session.

This is real re-verification — a source diff plus a live browser session against the user's actual
device, exactly the kind of evidence the restart rule expects, not a paraphrase of the commit
message.

### 2. My own independent spot-check (not trusting the audit's word either)

Ran these myself, separately from reading the audit report:

- Fetched `https://raw.githubusercontent.com/Arnjnnngs/chemowell-app-beta/main/index.html` directly
  and `grep -n "Reminds"` across it. Only four matches total: the schedule-window preview line
  (now `'Reminds at ' + formatQuarterHour(row.start)`, line 3840), the pre-existing reminder-lead-time
  caption on the Calendar screen, the daily-weight-check-in toggle description, and an explanatory
  code comment directly above the fixed line that documents *why* the old wording was wrong. **No
  "Reminds between...and..." string remains anywhere in the file.**
- Diffed the raw-GitHub copy of `index.html` against the working directory's copy — byte-for-byte
  identical, confirming this sandbox isn't looking at a stale or diverged local state.
- Fetched `https://raw.githubusercontent.com/Arnjnnngs/chemowell-app-beta/main/README.md` directly
  and confirmed the `app-v25` row exists at the top of the Version History table, dated 2026-07-28,
  and its own text explicitly documents the "Reminds at X" correction and the PM loop-back that
  produced it.
- Confirmed `outputs/DEV_BRIEF_v25.md` is genuinely in the repository, three independent ways: `git
  ls-files outputs/DEV_BRIEF_v25.md` shows it tracked, `git log --oneline -- outputs/DEV_BRIEF_v25.md`
  shows exactly one commit (`3b270f9`) adding it, and a direct raw-GitHub fetch of the file returns
  200 with the full 420-line document — not a 404, not a stub.
- Also independently confirmed the End-time picker's underlying code (`endOptions = END_TIME_OPTIONS
  .filter(opt => opt.value > row.start)`, `index.html:3809`) is present and untouched by this fix —
  matches what the re-verify audit described.
- `git status` in this working copy is clean and `HEAD` (`59b04bc`) matches the remote's `main`
  branch tip exactly — nothing local, uncommitted, or unpushed is being relied on for this
  sign-off.

Every claim in the re-verify audit and in the prior PM pass's restart instructions checks out
against source I pulled myself, independently of anyone's narration.

### 3. Decision

**The loop is genuinely closed.** I looked specifically for anything new the intervening passes
might have missed — not just confirming the one line — and found nothing: the End-time picker is
unaffected and still functional, no other "Reminds between" strings survived anywhere in the file,
the fix is driven purely by Start as intended, both new and pre-existing medications behave
identically, and there's no console-error regression from this same-file edit. The two
release-mechanics gaps (README entry, uncommitted brief) are both closed and independently
verifiable in the pushed repository, not just claimed.

This release has now genuinely been through the full chain: **Developer → Lead Developer → Zero
Day Auditor → Lead Developer → Auditor re-verify → Lead Developer → Auditor re-verify → PM (this
gate, first pass) → Lead Developer (Finding PM-1 + PM-2 + PM-3 fixes) → focused Zero Day Auditor
re-verify → PM (this follow-up pass)**. That is the chain closing correctly, including its
restart-rule loop working exactly as TEAM.md designs it to: a real gap was caught, sent back to the
correct stage, fixed, independently re-tested, and independently re-confirmed here — not
rubber-stamped at any point along the way.

**Verdict: READY FOR AARON.** No further loop-back needed. `outputs/AARON_UPDATE_v25.md` has been
updated to reflect that the previously-open item is now closed.
