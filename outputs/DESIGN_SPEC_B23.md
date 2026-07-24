# ChemoWell — Design Spec, Batches 2 & 3

Builds on Batch 1 (already applied): ivory canvas `#FAF7F6` with pink band at top, solid white cards with hairline `#EBE3E4` borders, AA rose accents `#A24C71` / `#8E3D61`, ink `#2A2127`, soft drop shadows, no glassmorphism.

All work is in `/home/claude/chemowell-app-beta/index.html`. No libraries, no network, no build step, no logic/storage changes. Line numbers refer to the current file.

Priority order = item order. Items 1–10 are Batch 2, 11–13 Batch 3 features, 14–24 the accessibility sweep (fold into the same session; most are one-line edits).

---

## BATCH 2

### 1. Type scale — the `TYPE` constant (foundation for everything below)

Today the file uses ~20 ad-hoc sizes (10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 19, 20, 22, 24, 26px) and weights 400/600/700/800 almost at random. Collapse to 7 steps. Define once near `h()` (~line 1212) as spread-able style objects:

```js
const TYPE = {
  display:  { fontSize: '24px',   fontWeight: '800', lineHeight: '1.1',  letterSpacing: '-0.03em'  }, // page titles
  title:    { fontSize: '17px',   fontWeight: '700', lineHeight: '1.25', letterSpacing: '-0.015em' }, // card/med/modal titles
  label:    { fontSize: '12px',   fontWeight: '700', lineHeight: '1.3',  letterSpacing: '0.06em', textTransform: 'uppercase' }, // section labels
  body:     { fontSize: '15px',   fontWeight: '500', lineHeight: '1.5',  letterSpacing: '0'        }, // paragraphs, banner bodies
  bodyBold: { fontSize: '15px',   fontWeight: '700', lineHeight: '1.5',  letterSpacing: '0'        },
  caption:  { fontSize: '13px',   fontWeight: '600', lineHeight: '1.4',  letterSpacing: '0'        }, // meta, helpers, sub-lines
  mono:     { fontSize: '14px',   fontWeight: '600', lineHeight: '1.3',  letterSpacing: '-0.01em'  }  // pair with className:'mono'
};
```

Usage: `style: { ...TYPE.title, color: '#2A2127' }`. Color stays separate. Standard text colors (reuse, don't invent): ink `#2A2127`, secondary `#554A52`, tertiary `#7A6E76`, rose label `#8E3D61`.

Mapping of current usages (representative, apply pattern everywhere while touching each area):

| Step | Current usages to convert |
|---|---|
| display | `h1` 24px at 2793, 2817, 2945, 2972; header title 22px at 1343; setup title 26px at 1473 |
| title | med names 15.5px/800 at 2341, 1436; card titles 16px at 2504, 2762; modal title 16px at 1728; Symptoms 19px at 3214; plans title 19px at 1516; tour title 17px at 1572 |
| label | every 11–13px uppercase label: 1398, 2116, 2137, 2158, 2177, 2191, 2205, 2229, 2369, 2398, 2404, 2733, 2811 (`secLabel`), 2659 (`fieldLabel` — bump 11px→12px), 3076, 3092, 3111, 3132, 3155, 3175, 3381, 1730/1745/1749/1769/1783/1797/1802 (modal field labels 11.5px→12px) |
| body | banner bodies 14px at 1869, 1897, 1920, 1943, 1973, 2078; setup intro 14px at 1474; tour text 13.5px at 1573; journal/history entry names 15px at 2409, 3053 |
| caption | all 11–13px meta: 1344, 1407, 1437, 2108-line subs, 2178, 2192, 2342, 2355 (11px→13px, the floor), 2763, 2794, 2818, 2955, 3374 |
| mono | clock 20px at 1347 (keep 20px — allowed display-mono exception, weight 600); times 13px at 1824, 2407, 3051 → 14px; meters 20px at 2119, 2140, 2161 (keep) |

Hard rule after this pass: **no text below 12px anywhere** (see item 22 for the specific offenders) and **weight 800 is reserved for `display` and primary CTA labels**; everything else maxes at 700. The current all-800 texture is a big part of the "developer demo" feel.

### 2. Header redesign — `renderHeader()` (lines 1328–1366)

Current: a cramped brand row (heart 18px + "ChemoWell" 14px + BETA pill + 26px `?` + 26px gear), then a 22px title, date line, and a clock on the right; plus two more orange TEST_MODE strips. Redesign to a clean two-row app bar:

- Container (line 1333): keep sticky, change `background` to solid `#FDF1F4` (kill the translucent `rgba(255,240,243,0.88)` — no backdrop blur exists, so translucency just lets content smear under it), `borderBottom: '1px solid #EBE3E4'`, `boxShadow: '0 2px 12px rgba(180,130,150,0.08)'`, `padding: '10px 16px 12px'`.
- **Row 1 (brand/utility row, height 44px):** left — heart icon 20px + wordmark "ChemoWell" `{...TYPE.caption, fontWeight: '800', color: '#A24C71', letterSpacing: '0'}` + BETA badge (item 3). Right — the `?` and gear buttons, moved out of the title flow (currently inline at 1340–1341, which makes them collide with the wrapping badge row): **44×44px** hit area (`width/height: '44px'`), `borderRadius: '50%'`, icon area visually 26px via centered content, `background: 'rgba(162,76,113,0.10)'`, `color: '#8E3D61'`, `border: 'none'` (drop the 1.5px rings), gap `8px` between them. Gear keeps `⚙` at `fontSize: '18px'`; `?` at `fontSize: '16px', fontWeight: '800'`. Keep existing `aria-label`s.
- **Row 2 (context row):** left — title (patient name, line 1343) `{...TYPE.display, fontSize: '22px'}` with date below in `{...TYPE.caption, color: '#7A6E76', fontWeight: '600'}`. Right — clock block (line 1346–1349): clock mono 20px/600 ink, and directly beneath it the **dose-progress ring** (item 11) replacing the `null` at line 1348.
- Delete the redundant second orange strip at line 1351 ("APP BETA — all data stays on this device") entirely — the badge in row 1 (item 3) carries this. Keep `renderTestingControls()` (1352) but restyle per item 3.

### 3. Beta/testing chrome — calm the orange (lines 1339, 1309–1326)

The `#C77800` badge with white 11.5px text fails contrast (≈2.9:1) and three stacked orange elements dominate the header.

- BETA badge (1339): `background: '#FFF3E2'`, `color: '#8C5900'` (6.0:1), `border: '1px solid #E8C9A0'`, `borderRadius: '99px'`, `padding: '3px 9px'`, `fontSize: '11px'` → keep as the one exception ≥11px because it's a decorative badge — better: `fontSize: '12px', fontWeight: '700', letterSpacing: '0.05em'`, text "BETA".
- Beta date controls (1314–1324): same recolor — container `background: '#FFF8EE'`, `border: '1px dashed #E8C9A0'`, header text `color: '#8C5900'`, keep collapsed by default. Buttons inside: `minHeight: '36px'` → `'40px'`, `fontSize: '13px'`.

### 4. Pinned past-missed header card (lines 1358–1364) — noticeable, not shouting

Currently `rgba(192,69,59,0.14)` bg + 1.5px `#C0453B` border + solid red `!` disc + red text. Restyle to the shared notice pattern (item 6), urgent tone:

- Container: `background: '#FFFFFF'`, `border: '1px solid #EBE3E4'`, `borderLeft: '4px solid #C0453B'`, `borderRadius: '14px'`, `padding: '12px 14px'`, `boxShadow: '0 2px 10px rgba(180,130,150,0.10)'`.
- Icon disc → tinted chip: 28×28px, `borderRadius: '9px'`, `background: 'rgba(192,69,59,0.12)'`, `color: '#A5443C'`, glyph `!` 15px/800 (no more solid red circle).
- Text: `{...TYPE.caption, fontWeight: '700', color: '#2A2127'}` — message in ink, not red: "3 missed doses from previous days".
- Button "Update missed doses" → "Review" : `minHeight: '44px'`, `padding: '0 16px'`, `borderRadius: '12px'`, `background: '#C0453B'`, `color: '#fff'`, `fontSize: '13px'`, `fontWeight: '700'`. (Also fixes the 32px touch target.)
- Add `role: 'button'`, `tabindex: '0'` + Enter/Space `onKeydown` to the clickable container (see item 17).

### 5. Bottom nav — `renderBottomNav()` (lines 1368–1387), native-app quality

- Container (1376): solid `#FFFDFE` (drop translucency, same reason as header), `borderTop: '1px solid #EBE3E4'`, `boxShadow: '0 -4px 20px rgba(121,72,96,0.08)'`, `padding: '6px 8px calc(6px + env(safe-area-inset-bottom))'`.
- Items (1380): `minHeight: '56px'` (up from 54), `gap: '2px'`, `borderRadius: '14px'`. Icon size stays 21. Label: `fontSize: '11px'` (up from 10.5), weight `700` both states (weight-flicker between states shifts layout).
- Active state: `color: '#8E3D61'`, `background: 'rgba(162,76,113,0.12)'`, **plus a 4px active indicator dot**: an absolutely-positioned or flow `h('span')` under the label, `width: '4px', height: '4px', borderRadius: '50%', background: '#A24C71'` (inactive: same span with `background: 'transparent'` so height never changes). Inactive text `#6E5A64` (5.6:1 on `#FFFDFE`).
- Icon stroke weight: bump `stroke-width` in `svgIcon()` (line 1245) from 1.9 to 2 for the active item only — pass a bold flag or simpler: leave stroke alone and rely on dot + tint (preferred, zero logic).
- `aria-current` (line 1380): currently emits `'false'` for inactive tabs — omit the attribute entirely when inactive (spread pattern like line 2745): `...(active ? { 'aria-current': 'page' } : {})`.
- Rename the "In-Patient" label to "Hospital" only if product agrees; otherwise keep — at 11px it fits.

### 6. Unified notice/banner system — calm, coherent, three tones

Today every banner (lines 1865, 1890, 1915, 1939, 1968, 2007, 2043, 2074, 2094) is a saturated tinted panel with a **2px solid colored border**, a **solid-color circle icon**, an **UPPERCASE colored title**, and **colored body text** — nine slightly different alarm boxes. For anxious users, redesign all of them to one recipe with tone as an accent, not a flood. Add a helper next to `dailyAlertStyle()` (~line 989):

```js
const NOTICE_TONES = {
  info:      { accent: '#A24C71', chipBg: 'rgba(162,76,113,0.12)',  chipFg: '#8E3D61' },
  attention: { accent: '#B5761E', chipBg: 'rgba(181,118,30,0.14)',  chipFg: '#8C5900' },
  urgent:    { accent: '#C0453B', chipBg: 'rgba(192,69,59,0.12)',   chipFg: '#A5443C' }
};
```

Shared geometry for every banner:
- Container: `background: '#FFFFFF'`, `border: '1px solid #EBE3E4'`, `borderLeft: '4px solid ' + tone.accent`, `borderRadius: '14px'`, `padding: '14px 16px'`, `boxShadow: '0 2px 10px rgba(180,130,150,0.10)'`. **No colored outer shadows** (delete the `rgba(192,69,59,0.25)` glows).
- Icon chip: 32×32px, `borderRadius: '10px'`, `background: tone.chipBg`, `color: tone.chipFg`, glyph 15px/800. Never solid-filled.
- Title: `{...TYPE.bodyBold, fontSize: '14px', color: '#2A2127'}` — **sentence case, ink**. Kill `textTransform: 'uppercase'` on all banner titles (1868, 1894, 1919, 1942, 1972, 2011, 2047, 2077).
- Body: `{...TYPE.caption, color: '#554A52'}` — never tone-colored body text.
- Inline action buttons keep their tone accent as solid bg (`tone.accent`, white text, `minHeight: '44px'`, `borderRadius: '12px'`, 13px/700).

Tone assignment: In-Patient (1865) → attention. Missed dose today (1890) → urgent. Chemo plan (1915) → item 7. Period (1939) → info. Bowel issue (1968) → attention. Check-ins (2007, 2043, 2074) → map `dailyAlertLevel` 0→info, 1→attention, 2→urgent by rewriting `dailyAlertStyle()` (983–989) to return `NOTICE_TONES[...]` fields. Warn banner (2094) → tone by `w.tone`. Demo (2085) → info, no icon.

### 7. Chemo/treatment banner (lines 1903–1934) — supportive, not red-alert

A countdown to treatment is not an emergency; red everywhere reads as "something is wrong."

- Days −2 and −1: **info tone** (rose). Day 0 ("Chemo TODAY" → retitle "Treatment day"): **attention tone**. Day +1 ("Day after chemo" → "Recovery day"): info tone.
- Icon chip glyph: keep `Rx` but 13px/800 in `tone.chipFg`.
- Titles sentence case: "Treatment on Friday 3/6", "Treatment tomorrow", "Treatment day", "Recovery day".
- The Dexamethasone/Zofran chips (1924–1931): keep green/red semantics but restyle to match: `background: 'rgba(15,157,87,0.10)'` / `'rgba(192,69,59,0.10)'`, `border: '1px solid'` matching 25% alpha, text 13px/700 in `#0C7F57` / `#A5443C`, tick/cross glyphs inside 18px tinted (not solid) discs.

### 8. Today's missed-dose banner + `missedRow()` (lines 1890–1900, 1821–1839)

- Banner: urgent tone per item 6. Body line (1897–1898) currently concatenates every miss into one red run-on sentence — render one line per miss instead (`h('div')` per item, `{...TYPE.caption, color: '#554A52'}`), med name in `fontWeight: '700', color: '#2A2127'`. "Clear" pill: `minHeight: '44px'` (currently 30px), `padding: '0 14px'`, ghost style `background: 'transparent'`, `border: '1px solid #E5C9D6'`, `color: '#8E3D61'`, 13px/700 — Clear is the secondary action; the primary is tapping through to History.
- `missedRow()`: container `background: 'rgba(192,69,59,0.06)'` (down from 0.10), `borderLeft: '3px solid #C0453B'`. Med name (1826–1828) in ink `#2A2127`, "Missed" badge → `background: 'rgba(192,69,59,0.12)', color: '#A5443C', fontWeight: '700'` (not white-on-red). Sub-line (1830) `color: '#7A6E76'`. The three action buttons (1834–1836): `minHeight: '44px'` (currently 32px), `fontSize: '13px'`, `borderRadius: '11px'`; "Took later" solid `#C0453B`/white, "Skipped" and "Clear" ghost `background: '#FFFFFF'`, `border: '1px solid #E3C2BE'`, `color: '#A5443C'`.

### 9. Quick Log med-card dose buttons (lines 2312–2335) — primary action = thumb-sized

The single most-used control in the app is 32px tall. Change all dose buttons in the Quick Log cards:
- Unlocked dose buttons (2318): `minHeight: '44px'`, `padding: '0 18px'`, `fontSize: '14px'`, `fontWeight: '700'`, keep `borderRadius: '999px'`, `background: '#A24C71'`, shadow `'0 2px 8px rgba(142,61,97,0.22)'`.
- Locked ghost buttons (2322): `minHeight: '44px'`, `background: '#FFFFFF'`, `border: '1px solid #E5C9D6'`, `color: '#6E5A64'`.
- `blockedBtn` (2312): `minHeight: '44px'`, `fontSize: '13px'`.
- Override panel buttons (2331–2332): `minHeight: '44px'`.
- Grouped card "Opens ..." pill (1432): `minHeight: '44px'`.
- Card container (2337): replace translucent `rgba(255,255,255,0.55)` with solid `#FFFFFF` and hairline `#EBE3E4` (chemoBlock variant: `borderLeft: '4px solid #C0453B'` instead of full tinted bg) — brings these cards in line with Batch 1's solid-card language; also remove the `inset 0 1px 0` highlight (batch 1 removed gel shadows; several cards still carry `inset 0 1px 0 rgba(255,255,255,0.7)` — sweep it out of 2337, 2113, 2134, 2155, 2174, 2188, 2202, 2226, 1401, 2405, 3040 etc. while editing).

### 10. Status pills on med cards (lines 2344–2352) — one consistent chip

Keep the three states but normalize: all chips `height: '26px'`, `padding: '0 10px'`, `borderRadius: '99px'`, `fontSize: '12px'`, `fontWeight: '700'`, no border. Available: `background: 'rgba(15,157,87,0.12)', color: '#0C7F57'` (drop the inner solid green dot-circle at 2350 — use a plain ✓ glyph). Waiting: `background: 'rgba(181,118,30,0.12)', color: '#8C5900'`. Limit/Restricted: `background: 'rgba(192,69,59,0.10)', color: '#A5443C'`.

---

## BATCH 3

### 11. Dose-progress ring — daily completion at a glance

**Where:** header right column, directly under the clock (`renderHeader`, replace the `null` at line 1348). It is visible on every tab, costs no vertical space on Today, and pairs naturally with the date/clock context block. Hidden when nothing is scheduled today (`scheduled === 0`).

**Computation** (new pure helper `doseProgressToday(now)` placed near `missedDosesFor`, ~line 549; read-only over existing state, no storage changes):

```js
function doseProgressToday(now) {
  const d0 = dayStart(now);
  let scheduled = 0, taken = 0;
  state.meds.filter(m => m.windows && m.windows.length && medScheduledOn(m, now))
    .forEach(med => {
      if (med.chemoOnly && !dexActiveOn(now)) return;
      const windows = med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0)) : med.windows;
      scheduled += windows.length;
      const logs = entriesFor(med.id).filter(e => e.ts >= d0 && e.ts < nextDay(d0)).length; // skipped entries count as handled
      taken += Math.min(windows.length, logs);
    });
  return { scheduled, taken };
}
```

(Same population `missedDosesFor` iterates minus the `alerts` filter; window-scheduled meds only — gap/as-needed meds have no "scheduled today" denominator.)

**Geometry (SVG, no libraries):** 44×44px total, `viewBox="0 0 44 44"`, circle `cx=22 cy=22 r=18`, `stroke-width="4"`, `fill="none"`, rotated −90° via `transform="rotate(-90 22 22)"` on the progress circle.
- Track circle: `stroke="#F0E4E9"`.
- Progress circle: `stroke="#A24C71"`, `stroke-linecap="round"`, `stroke-dasharray="113.1"` (2π·18), `stroke-dashoffset = 113.1 * (1 - taken/scheduled)`, inline `style="transition: stroke-dashoffset .5s ease"`.
- Complete state (`taken >= scheduled && scheduled > 0`): progress stroke `#0F9D6B`, center shows a ✓ (`#0C7F57`, 16px/800) instead of the count.
- Center label (normal state): `<text x="22" y="26" text-anchor="middle">` `taken + '/' + scheduled`, `font-size="12"`, `font-weight="700"`, `fill="#2A2127"`, mono stack `font-family="ui-monospace,Menlo,monospace"`.
- Build as an HTML string into `h('div', { innerHTML: ..., 'role': 'img', 'aria-label': taken + ' of ' + scheduled + ' scheduled doses logged today' })`, matching the existing `lockSVG`/weight-chart string pattern (lines 891, 3312).
- Caption under the ring: `h('div', { style: {...TYPE.caption, fontSize: '11px'→'12px', color: '#7A6E76', textAlign: 'right', marginTop: '2px' } }, 'today')` — optional; omit if the header feels tight.

### 12. Bottom-sheet paywall — convert `renderUpgradeModal()` (lines 1497–1529)

Replace the centered dialog with a mobile bottom sheet. Keep all handlers (`setLicense` simulate-purchase at 1510, reset-to-free at 1525, close at 1517) byte-for-byte.

- **Scrim** (outer div, line 1513): keep `position: 'fixed', inset: '0', zIndex: '70'`, `background: 'rgba(50,25,40,0.45)'`, but change to `display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0'`; add `onClick` close-on-scrim (same guard pattern as line 1726: `if (e.target === e.currentTarget) setState({ upgradeOpen: false })`).
- **Sheet** (inner div, line 1514): `width: '100%'`, `maxWidth: '720px'` (align with app column), `maxHeight: '88vh'`, `overflowY: 'auto'`, `background: '#FFFFFF'` (drop the pink `#FFF7FA`), `borderRadius: '22px 22px 0 0'`, `padding: '8px 20px calc(20px + env(safe-area-inset-bottom))'`, `boxShadow: '0 -12px 48px rgba(60,25,45,0.30)'`, `animation: 'sheetUp .32s cubic-bezier(0.32,0.72,0,1)'`. Add `role: 'dialog'`, `'aria-modal': 'true'`, `'aria-label': 'ChemoWell plans'`.
- **Keyframes:** add to the `<style>` block (line 12–23): `@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}` and `@media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms !important;transition-duration:0.01ms !important}}`.
- **Drag handle:** first child of the sheet — `h('div', { 'aria-hidden': 'true', style: { width: '36px', height: '4px', borderRadius: '99px', background: '#DCCFD4', margin: '4px auto 14px' } })`. Decorative only (no drag logic — tap scrim or ✕ to dismiss).
- **Header row** (1515–1518): title `{...TYPE.title, fontSize: '19px', color: '#2A2127'}` "Plans"; subtitle (1519) `{...TYPE.caption, color: '#554A52'}` keeps "One-time purchases — no subscriptions..." copy. Close ✕: **44×44px** (currently 32), `borderRadius: '50%'`, `background: 'rgba(125,105,116,0.10)'`, keep `aria-label: 'Close plans'`.
- **Tier cards** (`planCard`, 1500–1512), stacked `gap: '10px'`:
  - **Plus — featured, first among paid**: order Free (compact), **Plus**, Pro. Plus card: `border: '2px solid #A24C71'`, `borderRadius: '16px'`, `padding: '16px'`, `background: '#FFF9FB'`, plus a floating badge row: `h('span', ..., 'Most popular')` — `background: '#A24C71'`, `color: '#fff'`, `fontSize: '12px'`, `fontWeight: '700'`, `borderRadius: '99px'`, `padding: '3px 10px'`, `alignSelf: 'flex-start'`, `marginBottom: '6px'`.
  - Pro card: `border: '1px solid #EBE3E4'`, `padding: '14px 16px'`.
  - Free card: collapse to a single row — title "Free" + "$0" + one line "The complete tracker — 1 profile. Always free." `border: '1px solid #EBE3E4'`, `padding: '12px 16px'`. Current-plan state (any tier): `border: '2px solid #2E7D4F'` + "✓ Current plan" line, unchanged logic (1508–1509).
  - Price typography: value `{...TYPE.title, fontSize: '20px', color: '#2A2127'}` with `"one-time"` suffix in `{...TYPE.caption, color: '#7A6E76'}` — split the current single 14px string ("$4.99 one-time") into `$4.99` + caption.
  - Feature list (1507): keep `ul`, `{...TYPE.caption, color: '#554A52', lineHeight: '1.6'}`.
- **CTA hierarchy:** Plus CTA — full-width, `minHeight: '50px'`, `borderRadius: '13px'`, `background: 'linear-gradient(135deg, #A24C71 0%, #8E3D61 100%)'`, white, `fontSize: '15px'`, `fontWeight: '700'`, shadow `'0 6px 18px rgba(142,61,97,0.30)'`. Pro CTA — full-width, `minHeight: '46px'`, `background: '#FFFFFF'`, `border: '1.5px solid #A24C71'`, `color: '#8E3D61'`, 14px/700. **TEST_MODE:** button labels stay `'Simulate purchase (beta)'` vs `'Buy'` exactly as line 1510 computes them; handlers untouched.
- Footer: "Reset to Free (beta testing)" (1525) — `minHeight: '44px'`, centered, `color: '#6E5A64'` (fix #96808D contrast), 13px/600. Beta note (1526) — 12px, `color: '#7A6E76'` (fix #B295AA).

### 13. Time-modal cosmetic alignment (lines 1726–1814) — small, do while in there

Not a full redesign, but the shared log modal is the paywall's sibling surface and has two dark-theme leftovers: the Cancel button (1810) uses `border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)'` — invisible on the light card. Change to `background: '#FFFFFF'`, `border: '1px solid #E3D5DA'`, `color: '#5F4A56'`. Modal card bg (1727): `rgba(255,245,248,0.96)` → solid `#FFFFFF`; drop the `inset` shadow term. Add `role: 'dialog', 'aria-modal': 'true'` to the card and `aria-label` from the computed `title`.

---

## ACCESSIBILITY SWEEP (all references verified in current code)

### 14. Touch targets under 44px — enlarge (no layout logic changes)
- Header `?` and gear buttons: **26×26px** — lines 1340, 1341 → 44×44 (item 2).
- Quick Log dose buttons `minHeight: '32px'` — lines 2312, 2318, 2322 → 44 (item 9); override buttons 34px — 2331, 2332 → 44.
- `missedRow` action buttons 32px — lines 1834–1836 → 44 (item 8); banner "Clear" 30px — line 1895 → 44; header missed CTA 32px — line 1363 → 44 (item 4).
- Calendar month arrows **30×30px** — lines 1679, 1681 → `minWidth/minHeight: '44px'`; day cells 32px — line 1692 → `minHeight: '40px'` (grid constraint; 40px + 2px gap is the acceptable floor, document as known deviation).
- Reorder arrows 32×32 — line 2747 → 40×40 (row height limit) with `margin: '-4px 0'` to preserve row rhythm, or row padding bump.
- Edit/trash icon buttons 34×34 — lines 2766, 2767 → 44×44. Symptom edit button `padding: '7px'` — line 3203 → 44×44.
- History toggle + "Clear all" 34px — lines 3020, 3021, 3023 → 44. Weight range toggle — lines 3232, 3233 → `minHeight: '44px'`.
- `removeBtn` "Remove" `padding: '6px'` — line 1855 → `padding: '12px 10px'` (≥44px tall). "Keep"/confirm buttons 8px padding — lines 1851–1852 → `minHeight: '44px'`.
- Warn-banner ✕ `padding: '0 2px'` — line 2100 → 44×44 centered.
- BP/temp/weight "Log" buttons and inputs 38px — lines 2183, 2184, 2197, 2198, 2210–2213, 2238, 2247 → `minHeight: '44px'`.

### 15. Contrast failures on ivory/white (measured against `#FFFFFF`/`#FAF7F6`)
- `#B295AA` (2.6:1) — lines 1487, 1526, 1571 (tour "GUIDE · STEP n") → use `#7A6E76` (4.9:1) or `#8E3D61`.
- `#96808D` (3.9:1, small text) — lines 1525, 1576 ("Skip guide"), 2875 → `#6E5A64` (5.6:1).
- `#C9648E` on white (3.3:1) — line 1574 (tour "wait" instruction) → `#8E3D61` (6.6:1).
- `#D09590` warn-banner body (2.4:1) — line 2098 → `#A5443C` on the new white notice card (5.4:1).
- White on `#C77800` (2.9:1) — APP BETA badge line 1339, strip 1351, date-controls Reset 1323 → item 3 recolor; Reset button → `#8C5900` bg (4.6:1 w/ white) or tinted style.
- `#8A7580` (4.3:1 — passes only ≥18px; used at 11–12px) — lines 1407, 2271, 2801 → `#7A6E76`.
- `#765B69` on translucent white over ivory (borderline) — `blockedBtn` line 2312 → `#5F4A56`.
- Verify-not-change (documented AA passes): `#7A6E76` 4.9:1, `#554A52` 7.5:1, `#8E3D61` 6.6:1, `#8A6479` 4.6:1 (label-size ok), `#0C7F57` 4.8:1, `#A5443C` 5.4:1, `#8C5900` 5.3:1.

### 16. Text under 12px — raise to 12px minimum
- 10px: calendar weekday headers (1684), badge chips in Meds manager (2776–2781), calendar/pill chevrons `fontSize: '10px'` (1317, 1370-area chevrons at 1755, 1772, 1789, 2240, 2370).
- 10.5px: bottom-nav labels (1380 → 11px minimum, item 5 sets 11px — nav labels are the sole allowed 11px exception; everything else 12px+), tour step label (1571), "Early"/"Skipped"/"Missed" badges (1828, 2411, 2412, 3055, 3056), report meta line (2956), pill-toggle helper (2650), fieldLabel helper (2659).
- 11px: meta lines 1344→13px via TYPE.caption, 2178, 2192, 2206, 2355→12px, chart axis labels (3316, 3320) → 12.
- 11.5px: everything currently 11.5 → 12 (banner labels, sub-lines: 1339, 1361, 1407, 1437, 2116, 2137, 2158, 2177, 2205, 2229, 2265, 2342, 2346–2349, 2404, 2675, 2734).

### 17. Clickable non-button elements — keyboard access
- Header past-missed card `h('div', { onClick: goToHistoryTop ... })` — line 1358: add `role: 'button'`, `tabindex: '0'`, `onKeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); goToHistoryTop(); } }`, and an `aria-label` ("Review N missed doses from previous days").
- Today missed banner div — line 1890: same treatment.
- Quick log collapse header div — line 2368: same (`aria-expanded: String(quickLogOpen)`).
- Beta date-controls toggle div — line 1315: same.

### 18. Icon-only buttons missing accessible names
- Symptoms "+" button — line 3217: add `'aria-label': 'Log a symptom'`.
- Cycle "+" (3086) and In-Patient "+" (3165, 3169): `title` only — add `'aria-label': 'Log a past period'` / `'Log a past hospital stay'` (title is not reliably announced).
- Symptom row edit button — line 3203: add `'aria-label': 'Edit ' + (SYMPTOM_TYPES[e.symptomType] || 'symptom')`.
- Warn banner ✕ — line 2100: add `'aria-label': 'Dismiss warning'`.
- Calendar month arrows — lines 1679, 1681: add `'aria-label': 'Previous month'` / `'Next month'`.
- BP report / history "Remove" buttons have text — OK. Header buttons already labeled (1340, 1341) — keep.

### 19. Dialog semantics
- Time modal card (1727), upgrade sheet (1514), tour card (1570): add `role: 'dialog'`, `'aria-modal': 'true'`, and `aria-label` (modal title string / "ChemoWell plans" / step.title). No focus-trap JS required this pass (renderer rebuilds DOM); document as known limitation.

### 20. Toast announcements — line 1627
Add `role: 'status'`, `'aria-live': 'polite'` to the toast div so dose confirmations ("Logged", "Dismissed") are announced to screen readers.

### 21. Keyboard focus visibility — `<style>` block, line 16
`button` resets background/border but the file never styles button focus. Add to the style block: `button:focus-visible, [role="button"]:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid #A24C71; outline-offset: 2px; }` (matches the existing input rule at line 19).

### 22. Disabled reorder arrows — line 2747
Disabled state color `#C4B4BE` on `rgba(125,105,116,0.06)` is ~2.1:1. Disabled controls are AA-exempt, but pair with `'aria-disabled'` semantics: the `disabled` attribute is already correctly conditional (2745) — no change needed beyond bumping the non-disabled color if item 14's resize touches it. Mark as verified-OK.

### 23. `aria-pressed` toggles — verified present
`renderPillToggle` (2647) and weekday chips (2703) already expose `aria-pressed` — keep during restyle; History/weight-range segmented toggles (3020–3021, 3232–3233) do not — add `'aria-pressed': String(isActive)` to each.

### 24. Meters need text alternatives
Acetaminophen/Imodium/Lidocaine progress bars (2124–2126, 2145–2147, 2166–2168) are purely visual divs; the numbers are adjacent text so information is not lost, but add `role: 'img'` + `'aria-label'` (e.g. `'1,500 of 3,000 mg used today'`) to the track div, and `'aria-hidden': 'true'` is unnecessary elsewhere. Same pattern as the dose ring (item 11).

---

### Out of scope (explicitly)
No storage/logic changes; no focus-trap framework; no swipe-to-dismiss on the sheet; no external fonts/libraries; TEST_MODE flows (simulated purchase, reset, date controls) keep identical handlers and labels.
