# APP-BETA backlog — living queue

Durable home for work Aaron has flagged but explicitly not started yet, so nothing gets lost between
sessions or models. Each item gets its own full chain pass (or lean pass if Aaron authorizes) when
picked up — remove it from here once shipped and it's covered in the README changelog instead.

## Queued

### Tour/welcome banner needs to visually stand out more
Raised 2026-07-24, explicitly tabled in favor of the app-v14 native APK build ("table this for
later. I want APK first").

Aaron's report: the guide (tour) banner — the slim strip pinned at the top of the header (see
app-v12's tour-occlusion fix) — currently blends in too much. Going through the guide, it doesn't
grab attention the way it should.

Ideas from Aaron, roughly in his order of preference:
- A green border around the banner box itself, AND around whatever tab/element it's currently
  directing the user to tap.
- A pulse animation on that border/highlight — Aaron flagged this himself as possibly too big a
  lift; worth a quick feasibility check (CSS keyframe pulse is normally cheap, but needs to respect
  `prefers-reduced-motion`, which the app already has a global guard for).
- Fallback if pulse is too much: a green arrow pointing at the target element instead.

What to keep: Aaron explicitly likes that the banner stays pinned at the top — don't undo that as
part of this fix, just add visual weight so it stands out more against the header.

Scope note for whoever picks this up: this touches `renderTourLayer()` / `positionTour()` /
`TOUR_STEPS` (see index.html) and should go through Designer + Lead Designer review same as any
visual change, plus a QA pass confirming the emphasis doesn't itself cause new occlusion on small
viewports (the exact bug class app-v12 fixed).

## Carried over from prior releases (see README v12/v13 rows and CHEMOWELL_PROJECT_STATE.md for full detail)

1. Tour replay flow (D1-D4 + LA-P4-5).
2. Toast z-index/pointer-events (covers content, swallows taps ~4.5s).
3. Plans sheet keyboard a11y (focus trap, Escape, focus return).
4. QA "confused" items: onboarding missed-dose grace period, stale "Waiting" label after day
   complete, check-in same-day feedback copy.
5. Small/cosmetic: report Back-pill overlap, weight-chart duplicate x-labels, "Home screen order"
   caption missing "Afternoon", picker row-height polish, P4-1 malformed-entry display, 39.4°C/103°F
   approximation (documented, not a bug).

## Roadmap (bigger, not yet scoped)

- Fever-rule alert (100.4°F threshold) + care-team contacts.
- PDF/CSV export + backup/restore (currently advertised in Plans sheet as "coming in beta").
- Full native build-out: SQLite storage migration, real Play/App Store billing (replacing
  TEST_MODE), event-driven re-render (replacing the 1s full-DOM tick loop), bundled/offline mode
  for the native shell, release keystore + store listings.
