# Designer Review — v38 Add/Edit Medication Form (commit 6cc643e)

**Verdict: PASS**

Reviewed rendered output at mobile (390x844) and desktop (1280x900) via Playwright against `http://127.0.0.1:8936/index.html`. Screenshots in `outputs/v38-meds-form-screenshots/`.

## 1. Locked Daily limit visual treatment
`med-daily-limit` renders with `opacity:0.55`, `cursor:not-allowed`, `disabled=true`, placeholder "Locked", on the same rgba(255,255,255,0.72) card background as other inputs — reads clearly as "disabled," not broken, at both viewports (`mobile-02-locked-scrolled.png`, `desktop-02-locked-scrolled.png`). The amber warning card above it (border `#C77800`, fill `#FBEBD2`, text `#8C5900`, "!" badge) is fully legible, full-width, not clipped or overlapping neighboring fields at either viewport.

## 2. Unlock transition after typing "500 mg, 1000 mg"
After the 700ms debounce, warning disappears entirely and `med-daily-limit` cleanly returns to normal white-background, black-cursor, enabled state with placeholder "No limit" (`mobile-03-unlocked-after-doses.png`, `desktop-03…`). No layout jump or leftover styling artifacts.

## 3. Re-lock after typing 3000 then switching unit to "applications"
Field re-disables, keeps `value="3000"` visible at 0.55 opacity (not blanked or replaced by the "Locked" placeholder, since placeholder never shows when a value is present) — reads as intentional graying-out of a stale value, not a glitch (`desktop-05-relocked.png`, `mobile-05-relocked.png`). Warning correctly branches to the "typed a limit" wording: "Dosage options don't include an application count yet — this limit won't work until they do." — appropriate given a value is still sitting in the field.

## 4. New field order / grouping
Confirmed order at both viewports: Medication name, Generic name, Schedule type, Limit unit, Dosage options, [warning when applicable], Daily limit, Days taken, Hours between doses, Notes. Grouping reads logically — unit-then-amount-then-limit tells a coherent story, and the desktop 3-column grid places Schedule type/Limit unit/Daily limit as a natural row above/below Dosage options without orphaned single-column fields. No awkward gaps.

## 5. "For example, 4 hours" on number-type Hours-between-doses input
Renders fully on one line at both viewports, left-aligned, not cut off. On mobile the native number-spinner arrows sit clear of the text with no overlap (`mobile-08-hours-placeholder.png`, `desktop-08-hours-placeholder.png`).

No fixes required.
