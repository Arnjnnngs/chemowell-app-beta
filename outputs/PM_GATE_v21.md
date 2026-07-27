# PM Gate — app-v21

**Lane:** Full chain (new feature + stored-entry data-model change + multi-screen: log modal, History label, Weight report), per TEAM.md.

## What was asked

Aaron: add a way to record *why* weight changed on a weight-log entry (e.g. rapid loss from Paracentesis), and a field for how many liters were drained during a Paracentesis procedure, since that's worth documenting. Also asked for clinical research on what else is worth tracking for chemo/radiation patients around this, to report back afterward (see separate research summary delivered in chat — not a code change, no `outputs/` doc for that half of the request).

## What shipped

- Weight-log modal gains an optional **Reason for change** dropdown (8 options incl. Paracentesis, fluid retention, appetite changes, steroid medication, illness, other), a **Liters drained** field that only appears when Paracentesis is selected, and a free-text **Note**.
- Weight report ("All Readings") and the compact History label both surface the reason (+ liters, if Paracentesis) and note under each reading.
- Additive to the existing weight entry shape — `weightReason`/`litersDrained`/`weightNote` are all optional; no migration needed, old entries render unchanged with the new lines simply omitted.

## Stages that ran

1. **Lead Developer** — implemented, self-verified: syntax check clean, Playwright smoke test at 390×844 and 1280×900 covering the full flow (fill weight → open modal → select Paracentesis → Liters field appears → fill liters + note → confirm → localStorage entry has all 3 fields correctly → Weight report displays reason/liters/note), zero console errors both viewports.
2. **Designer** — reviewed real screenshots (`v21-evidence/`) at both viewports plus the source. Found one should-fix (see below), confirmed clean otherwise: spacing/typography/color match the rest of the modal exactly, touch targets ≥52px, report list color hierarchy preserved, empty states (no reason/note) render with no orphaned labels.
3. **Auditor** — full line-by-line audit of the diff and its blast radius (entry label builder, modal render, save/validation logic, report rendering, `addEntryDB`'s no-allowlist pass-through) plus live edge-case testing (reason toggled back and forth, blank liters, out-of-range liters, pre-existing entries with no `weightReason`, reload round-trip). Found two should-fix defects (see below).

No Lead Designer / Lead Auditor pass — both findings were unambiguous (not "not confident about it" cases) and were fixed directly and re-verified, per TEAM.md's discretion clause for full-chain work.

## Findings — all fixed, all re-verified live

1. **(Designer, should-fix)** The "Paracentesis (fluid drained)" option hard-clipped mid-character in the reason `<select>` on both mobile and desktop — once selected, the user couldn't reread their own choice. Fixed with `text-overflow: ellipsis` on the select (index.html:2193). Re-verified via screenshot: renders as "Paracentesis (fluid dr…" — a real ellipsis, not a hard clip.
2. **(Auditor, should-fix)** Liters values outside 0–20 (tested: -5, 25) were silently dropped at save time behind an identical-looking success toast — a caregiver reviewing the trend later would see "Paracentesis" logged with no liters and no indication anything was rejected. Fixed to block the save with `"Enter a valid liters amount (0–20), or leave it blank."`, matching the app's existing validation pattern for weight/temperature/blood-pressure (index.html:1023-1030). Re-verified live: -5 and 25 both now block the save and keep the modal open; the fix doesn't affect the optional case (leaving liters blank still saves fine).
3. **(Auditor, should-fix)** `liters === 0` is a legitimate value (the input's own `min` is 0) but was being rejected by the same `> 0` bug. Fixed alongside #2 (now `>= 0`). Re-verified live: 0 now saves and stores as `litersDrained: 0`.

One Auditor nice-to-have was logged, not fixed (out of scope for this release, doesn't affect data integrity): there's no edit/delete path for weight entries at all (pre-existing, not introduced by this change) — worth a future pass if Aaron wants it, not required here.

## Release mechanics

- `APP_VERSION` bumped `app-v20` → `app-v21` (index.html:3595).
- Service worker cache bumped `chemowell-app-v20` → `chemowell-app-v21` (sw.js:1).
- README.md version history updated.
- Evidence: 10 screenshots in `outputs/v21-evidence/` (modal open, Paracentesis selected + Liters field, filled, Weight report — both viewports), within TEAM.md's ~10-image cap.
- Push to GitHub + live-verify with cache-buster: pending (next step after this gate).

## PM sign-off

Matches what Aaron asked for — both requested fields shipped, working, and documented in the report he'll receive. Every stage that ran produced its artifact (this doc + evidence folder). All findings fixed and the fix itself re-verified, not just claimed. No scope drift. Release mechanics complete except the push, which follows immediately.
