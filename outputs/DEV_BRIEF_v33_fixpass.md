# DEV BRIEF — v33 fix pass (chain restart after Designer FAIL)

## Why the previous attempt failed
The v33 implementation built the radiation report's Remove control and the Account view from
scratch instead of reusing the app's existing shared patterns. That is the root cause of both
Major findings: (1) a hand-rolled Remove button skipped the established two-tap confirm pattern
(`removeBtn(e)`, which also guarantees 44px hit areas), and (2) the Account "+ Add profile" CTA
navigated to Settings instead of reusing the existing `state.addingProfile` inline flow, because
the implementer didn't check whether that flow could render outside Settings (it can — it's just
state + a draft var). Same story on styling: Account invented a translucent card style instead of
copying Settings' `#FFFFFF`/`#EBE3E4` `secStyle`. Lesson encoded for future passes: **before
building any new control, grep for an existing pattern that does the same job.**

## Fix list (from DESIGNER_REVIEW_v33.md)
- **Major 4.1**: radiation report rows use shared `removeBtn(e)` (two-tap confirm, 44px). Also
  applied to the BP report rows, which had the identical pre-existing flaw.
- **Major 5.3**: Account "+ Add profile" renders the same inline name-input flow Settings uses
  (`state.addingProfile` + `newProfileNameDraft` + `createProfile`), in place.
- Minors: planned-total input and Switch button 40→44px; `#0C7F57` → `#0A6B4A` on the
  logged-today text and ACTIVE badge (AA contrast); migration Save keeps full `#A24C71` fill
  (no 35%-alpha "disabled look" on a tappable control) and gains the onboarding's section
  labels above its chip rows; radiation summary pluralization ("1 / 30 sessions completed");
  History descriptor "1 recorded entry"; Account cards adopt Settings' exact `secStyle`;
  drawer Settings helper de-duplicated to "Units, guide & data".

## Definition of done
All 111 existing checks still pass; new checks cover the confirm-to-delete flow and the Account
inline add flow; fresh Designer re-review reaches PASS or PASS WITH NITS.
