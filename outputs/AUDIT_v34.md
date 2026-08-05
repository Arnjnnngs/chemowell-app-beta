# Audit — v34
## Verdict: PASS (no Major/Minor; one informational Nit)

## Code audit
- Diff vs origin/main: exactly 3 files (README +1 row, index.html +8/−2, sw.js 1 line); every hunk in declared scope; nothing else.
- Byte-level: added lines contain only intended non-ASCII — 9× U+2014, 3× U+2019 (no ASCII apostrophes in JS strings; app parses), 1× U+2192 (README only), 1× U+00A0 (Pro bullet, deliberate).
- 15 unique FAQ ids. tierLimit() matches "Free 1 / Plus 3 / Pro unlimited". "nurse" exactly 2× in app code, both in intended-use sentences.
- Versions consistent: app-v34 / chemowell-app-v34; sw.js activate evicts old caches.
- Blast radius: FAQ open state keyed by item.id not index; TOUR_STEPS has no FAQ references; old Pro wording survives only in README history; www/index.html is a placeholder shell, no drift risk.

## User journeys — 20/20 (Playwright on running app, fresh profile)
- J1 FAQ: 15 buttons, correct positions; accordion exactly-one-open; rapid double-tap toggles cleanly; zero non-network console errors.
- J2 About & legal: Intended use above Medical disclaimer; version line app-v34.
- J3 Plans: Pro bullet correct with NBSP intact; "professional and multi-patient" absent from DOM.
- J4 Regression: FAQ section icon renders; Erase-all confirm + Cancel intact; F5 after Settings clean.
- J5 Persistence: reload after opening an item — clean; faqOpenId in-memory only (pre-existing).

## Findings
1. Nit (informational): the U+00A0 breaks plain-text search (`grep 'looking after'` → 0 hits); deliberate per Designer; future DOM-text assertions must use   or normalize.

## Not verified
Real PWA SW upgrade from an installed v33 client (code-inspected only); the two sandbox-blocked CDN scripts; real-device/Capacitor rendering.
