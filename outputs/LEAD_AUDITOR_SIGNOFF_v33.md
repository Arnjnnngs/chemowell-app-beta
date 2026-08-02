# LEAD AUDITOR SIGNOFF — ChemoWell v33 (post-audit-fix pass)

Lead Auditor: Quality Chain (independent re-verification of AUDIT_v33.md). Date: 2026-08-02.
Method: source read of the fixed diff + fresh Playwright runs against the live build at
`http://localhost:8913/index.html` (Chromium `/opt/pw-browsers/chromium`, 390×844).
My script: `/tmp/lead_v33_signoff.mjs` — **47/47 checks passed, 0 failed** across 4 fresh contexts,
zero page errors in all contexts. Raw CSV evidence: `/tmp/lead-export.csv`.

## VERDICT: **SIGN OFF**

---

## 1. Auditor findings reproduced against the fixed build

### M1 — CSV formula injection → **CONFIRMED FIXED**
Reproduced the Auditor's original repro on the fixed code: seeded notes `=2+2`, `@cmd|test`,
`-3 lbs overnight` (plus `+1 episode`), downloaded the CSV from Settings. Raw file bytes
(`cat -A /tmp/lead-export.csv`):

```
2026-07-30,6:49 PM,Nausea,,'=2+2
2026-07-30,7:49 PM,Nausea,,'@cmd|test
2026-07-30,8:49 PM,Nausea,,'-3 lbs overnight
2026-07-31,2:49 AM,Nausea,,'+1 episode
```

All three original payloads (and `+`) now export apostrophe-neutralized; no unquoted cell anywhere
in the file begins with `=`, `@`, or tab. Fix is at `csvField()` index.html:4782-4790, exactly the
one-liner the audit prescribed. Round-trip integrity confirmed:
- `plain note text` exports verbatim, **no** spurious apostrophe;
- `has,comma and "quotes"` exports `"has,comma and ""quotes"""` (quote-wrap + doubling intact);
- **composition** `=a,b` exports `"'=a,b"` — apostrophe applied first, then quote-wrapped, i.e. the
  apostrophe lands INSIDE the quotes where Excel needs it. Correct ordering in code (prefix at 4788
  before the quote test at 4789, which re-tests the mutated value).

### m1/m3 — radiation backdate guards → **CONFIRMED FIXED**
Live at the "+" modal (confirmTimeAndLog radiation branch, index.html:1277-1286; warning UI 2820):
- **Duplicate day** (today already logged): first Confirm shows "A session is already logged for
  that day" and logs nothing; second Confirm proceeds. Verified via localStorage entry counts.
- **>1 year past** (calendar navigated 14 months back): first Confirm shows "That date is over a
  year ago", nothing logged; second Confirm proceeds.
- **Clean past date within a year** (prev month, empty day): logs directly, no warning, modal closes.
- **futureOk still works**: clean future date → "This time is in the future" warn, second Confirm logs.
- **No interference / correct composition**: a date that is BOTH future and duplicate-day arms
  futureOk on Confirm 1, radWarn on Confirm 2, logs on Confirm 3 — the two guards chain, neither
  clobbers the other (shared ts validation runs before the radiation branch).
- Soft-confirm only, never a hard block — matches the brief (twice-daily fractions stay possible).

Info (non-blocking): like the pre-existing `futureOk`, the armed `radOk` flag does not reset if the
user edits the date after being warned — a warned user who then picks a different day gets logged on
the next Confirm without a re-check. This mirrors the established futureOk pattern the brief
explicitly told the dev to copy; consistent, tiny window, not a defect for this pass.

### m2 — planned-total silent rejection → **CONFIRMED FIXED (with one scoping note)**
`999` and `0` each produce the visible toast "Planned total must be a number from 1 to 99"
(input onChange, index.html:3352); valid `30` is accepted with no error toast and the card shows
"of 30". Note on the "abc" case in my tasking: `input[type=number]` sanitizes non-numeric text to
`''` at the DOM level before the handler ever sees it — I verified the DOM value is `''` after
typing "abc", so "abc" is physically unreachable as input; `''` is the deliberate (and correctly
silent) clear-the-field path. Every invalid input a user can actually deliver (numeric
out-of-range) now gets feedback. The Auditor's m2 as reported (`0`, `-5`, `999`) is fixed.

## 2. Gap probes (surfaces the audit did NOT cover) — 6 probed, all clean

- **(a) Print-report title-context escape**: patient name AND a note set to
  `</title><script>alert(1)</script>`, Plus license, opened Printable report. No dialog fired, zero
  `<script>` elements in the popup, payload rendered as inert text; popup title is the literal
  string `ChemoWell Report — </title><script>alert(1)</script>` (escaped before interpolation, so
  the `</title>` cannot break out). PASS.
- **(b) CSV degenerate payloads**: note exactly `=` exports as `'=`; tab-prefixed note exports as
  `'<TAB>TabStart` (apostrophe applied, regex `/^[=+\-@\t\r]/` covers tab/CR). PASS.
- **(c) Impossible state — migration card + orphan `radiationPlannedTotal`**: profile with
  patientName, no sex/treatmentType, but `radiationPlannedTotal: 20` pre-set. Migration card (not
  full setup) renders, no crash; completing it as Female+Radiation preserves the planned total
  (input shows 20). The merge-write (`setPrefsDB({sex,treatmentType})`) never touches the orphan
  key. PASS.
- **(d) Corrupt profiles list — id with NO prefs key**: hand-added `{id:'ghost999',name:'Ghost'}`
  to `chemowell-app-profiles-v1`. Account view renders the ghost row as "Not set · 0 entries",
  zero page errors (`profilePrefsFor`/`profileEntryCountFor` default-object fallbacks hold, 4778-79).
  PASS.
- **(e) Service-worker cache bust**: fetched `http://localhost:8913/sw.js` — `CACHE =
  'chemowell-app-v33'`, matching `APP_VERSION='app-v33'`. PASS.
- **(f) Support banner still gated off**: `SUPPORT_LINK` still contains `REPLACE` (line 70) so
  `SUPPORT_LINK_READY` is false; with 25+ entries seeded and reloaded, no "Leave a tip" / "Maybe
  later" / ko-fi markup in `#root`. (Checked against `#root`, not `body.textContent`, which
  false-positives off the inline script source — same trap the Auditor documented.) PASS.

Gap (g) (rapid profile switch mid-download) not probed — every switch path does a full
`location.reload()` and the CSV is a synchronous in-memory blob, so the race window is nil; deemed
lowest-value of the offered set.

## 3. Evidence confirmation

- All scripts the audit cites exist in `/tmp` with contents matching the report's claims:
  `audit_v33_a.mjs` (radiation seeding/backdating exactly as described), `audit_v33_b.mjs` (CSV
  download capture + the two pre-fix FORMULA INJECTION checks + print-XSS popup assertions),
  `_b2.mjs`, `_c.mjs`, `_d.mjs`, `dbg_dtap.mjs`, `dbg_switch.mjs`. The audit's pre-fix repro (raw
  `,=2+2` in the export) is consistent with the pre-fix `csvField` and no longer reproduces — as it
  should not.
- Line-number citations in the audit match the source (small post-fix drift only, e.g. csvField
  4768→4782 after the inserted fix comment).
- **Suites re-run by me**: `/tmp/verify_v33.mjs` → **58 checks, 0 failed** (audit ran it pre-fix at
  56/56; the fix pass added 2 checks per the dev brief — consistent), console errors: none.
  `/tmp/verify_v33_support.mjs` → **21 checks, 0 failed**.
- User testing ran on the running product: QA_USER_ZERO_v33.md is a live Playwright walkthrough
  (screenshots present in `outputs/v33-qa-screenshots/`, and its 1.3 first-run toast blocker is
  code-cited and was fixed — the fixed suite's onboarding-toast checks now pass);
  DESIGNER_REVIEW_v33_repass.md contains DOM-measured px/color values against the live build with
  regenerated evidence in `outputs/v33-evidence/` (14 screenshots on disk). Evidence is real.

## 4. Verdict

All four audit findings are genuinely fixed in the running product and none of the fixes regressed
adjacent behavior (benign CSV round-trip, futureOk guard, valid planned totals, migration merge).
Six independent gap probes found no new defects. Suites green (58+21+47 checks, 0 failures, zero
console/page errors).

**SIGN OFF** — v33 may proceed to the next stage of the chain.
