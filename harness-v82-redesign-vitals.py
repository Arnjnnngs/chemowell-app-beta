#!/usr/bin/env python3
"""app-v82 -- Home's two typing boxes become a three-tile VITALS STRIP.

WHAT WAS THERE. Temperature and Weight were two large white cards side by side, and Blood Pressure
a third below them. Each carried a label, a sub-label, a big number, a text input and a Log button.
On a 390px phone that is roughly a third of the first screen spent on boxes asking to be typed into
-- above the medications, which are the reason the app exists. app-v80's own release note said so.

WHAT THIS BUILDS. One card holding up to three compact tiles in a row: Temp, Weight, BP. Each tile
shows the latest reading and how long ago it was taken. Tapping a tile opens THE SAME input and THE
SAME Log button, in place, directly beneath the row. Tapping it again closes it.

WRITE MODEL: this patch writes NO record and changes NO logging path. `logTemp`, `logWeight` and
`logBloodPressure` are called exactly as before, from buttons with the same labels, reading the same
`state.tempInput` / `state.weightInput` / `state.bpSysInput` / `state.bpDiaInput`. The only new state
is `state.vitalOpen`, which decides which panel is showing and nothing else.

WHAT IS DELIBERATELY KEPT.
  * The per-vital Settings toggles. `homePref('showTemperature')`, `showWeight`, `showBloodPressure`
    still decide whether a vital appears at all -- a caregiver who turned one off does not get it
    back, and with all three off the strip is not drawn.
  * The fever colour. A temperature at or above the fever threshold still prints in amber and at or
    above the high threshold in red, computed from the DISPLAYED value exactly as before.
  * Every input's 16px floor. The inputs are the same elements with the same font size.

WHAT IS NEW AND DELIBERATE: the "how long ago" line. The cards said "Last reading 7:42 AM", which
does not answer the question a caregiver actually has at 2am -- is this number old? "7:42 AM · 6h
ago" answers it. A reading from a previous day says the day, not an hour count, because "31h ago"
is arithmetic nobody asked for.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('REFUSED: ' + msg); sys.exit(1)

def cut(src, old, new, what):
    if src.count(old) != 1:
        die('%s -- anchor matched %d times, expected exactly 1' % (what, src.count(old)))
    return src.replace(old, new)

src = HTML.read_text()

if "data-home: 'vitals'" in src or "vitalOpen" in src:
    die('the vitals strip is already in this file')

# ---- 1. the one new piece of state ------------------------------------------------------------
src = cut(src,
    "let state = { heroSnoozeUntil: 0,",
    "let state = { heroSnoozeUntil: 0, vitalOpen: null,",
    'state.vitalOpen')

# ---- 2. the strip replaces the two-card grid ---------------------------------------------------
old_start = "  // Temperature + Weight row (each card user-toggleable in Settings)\n"
i = src.index(old_start)
j = src.index("\n  // Chemo schedule card (toggleable)\n", i)
old_block = src[i:j]
if 'logBloodPressure' not in old_block or 'logTemp' not in old_block or 'logWeight' not in old_block:
    die('the block being replaced does not look like the vitals cards')

new_block = """  // THE VITALS STRIP -- three tiles, not three boxes asking to be typed into.
  //
  // Each tile is the latest reading and how long ago it was. Tapping one opens the same input and
  // the same Log button that used to sit permanently on screen. Nothing was removed; it is behind
  // one tap instead of occupying the top of the first screen, so what she opens the app to see is
  // which dose is due.
  (function () {
    const shown = [];
    if (homePref('showTemperature')) shown.push('temp');
    if (homePref('showWeight')) shown.push('weight');
    if (homePref('showBloodPressure')) shown.push('bp');
    if (!shown.length) return;

    const lastBp = state.entries.filter(e => e.medId === 'blood_pressure').sort((a, b) => b.ts - a.ts)[0];

    // How old is this reading? A number with no age on it is the thing a caregiver at 2am cannot
    // read. Hours only while it is still today; after that the day, because "31h ago" is arithmetic
    // nobody asked for.
    function ageOf(ts) {
      if (!ts) return '';
      const today = dayStart(simNow());
      if (ts < today) {
        const days = Math.round((today - dayStart(ts)) / 86400000);
        return days === 1 ? 'yesterday' : (days + 'd ago');
      }
      const mins = Math.max(0, Math.round((simNow() - ts) / 60000));
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      return Math.round(mins / 60) + 'h ago';
    }

    const TILE = {
      temp: {
        label: 'Temp',
        value: lastTemp ? (dispTemp(lastTemp) + tempSuffix()) : null,
        color: tempColor,
        ts: lastTemp ? lastTemp.ts : null
      },
      weight: {
        label: 'Weight',
        value: lastWeight ? (dispWeight(lastWeight) + ' ' + weightSuffix()) : null,
        color: '#2A2127',
        ts: lastWeight ? lastWeight.ts : null
      },
      bp: {
        label: 'BP',
        value: lastBp ? (lastBp.sys + '/' + lastBp.dia) : null,
        color: '#2A2127',
        ts: lastBp ? lastBp.ts : null
      }
    };

    const INPUT = { flex: '1', minWidth: '0', minHeight: '44px', border: '1px solid #E9D8D1', borderRadius: '11px', padding: '0 12px', fontSize: '16px', background: '#FFFFFF', color: '#2A2127' };
    const LOGBTN = { flexShrink: '0', minHeight: '44px', padding: '0 15px', borderRadius: '11px', background: 'linear-gradient(135deg, #E46F3C 0%, #BF4C1A 100%)', color: '#fff', fontSize: '13.5px', fontWeight: '700' };

    function panelFor(key) {
      if (key === 'temp') return h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        h('input', { 'data-vital-input': 'temp', type: 'number', inputMode: 'decimal', step: '0.1', 'aria-label': 'Temperature', placeholder: tempDefault(), value: state.tempInput, onInput: (e) => { state.tempInput = e.target.value; }, className: 'mono', style: INPUT }),
        h('button', { 'data-vital-log': 'temp', onClick: logTemp, style: LOGBTN }, 'Log')
      );
      if (key === 'weight') return h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        h('input', { 'data-vital-input': 'weight', type: 'number', inputMode: 'decimal', step: '0.1', 'aria-label': 'Weight', placeholder: weightDefault() || (CONFIG.weightUnit === 'kg' ? '68.0' : '150.0'), value: state.weightInput, onInput: (e) => { state.weightInput = e.target.value; }, className: 'mono', style: INPUT }),
        h('button', { 'data-vital-log': 'weight', onClick: logWeight, style: LOGBTN }, 'Log')
      );
      return h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        h('input', { 'data-vital-input': 'bp-sys', type: 'number', inputMode: 'numeric', 'aria-label': 'Systolic', placeholder: '120', value: state.bpSysInput, onInput: (e) => { state.bpSysInput = e.target.value; }, className: 'mono', style: INPUT }),
        h('span', { style: { color: '#915E48', fontWeight: '700' } }, '/'),
        h('input', { 'data-vital-input': 'bp-dia', type: 'number', inputMode: 'numeric', 'aria-label': 'Diastolic', placeholder: '80', value: state.bpDiaInput, onInput: (e) => { state.bpDiaInput = e.target.value; }, className: 'mono', style: INPUT }),
        h('button', { 'data-vital-log': 'bp', onClick: logBloodPressure, style: LOGBTN }, 'Log')
      );
    }

    // A tile whose vital was switched off in Settings is not on the strip, so an open panel for it
    // would be a panel with no tile. Fall back to closed rather than drawing an orphan.
    const open = shown.indexOf(state.vitalOpen) >= 0 ? state.vitalOpen : null;

    parts.push(h('section', { 'data-home': 'vitals', style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '16px', padding: '10px 11px', boxShadow: '0 3px 14px rgba(203,122,87,0.10), 0 1px 2px rgba(203,122,87,0.06)', display: 'flex', flexDirection: 'column', gap: '9px' } },
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + shown.length + ',1fr)', gap: '7px' } },
        ...shown.map(key => {
          const t = TILE[key];
          const isOpen = open === key;
          return h('button', {
            key: key,
            'data-vital-tile': key,
            'aria-expanded': isOpen ? 'true' : 'false',
            'aria-label': t.label + ', ' + (t.value ? (t.value + ', ' + ageOf(t.ts)) : 'no readings yet') + '. Tap to log.',
            onClick: () => setState({ vitalOpen: isOpen ? null : key }),
            style: {
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px',
              minWidth: '0', minHeight: '58px', padding: '7px 9px', textAlign: 'left',
              borderRadius: '12px',
              border: isOpen ? '1px solid #E46F3C' : '1px solid #F0E3DD',
              background: isOpen ? 'rgba(246,108,49,0.07)' : '#FFFDFC'
            }
          },
            h('span', { style: { ...TYPE.label, color: '#915E48' } }, t.label),
            h('span', { className: 'mono', style: { fontSize: '17px', fontWeight: '600', letterSpacing: '-0.02em', color: t.value ? t.color : '#A2939B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' } }, t.value || '\\u2014'),
            h('span', { style: { ...TYPE.caption, color: '#7A6E76', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' } }, t.value ? ageOf(t.ts) : 'none yet')
          );
        })
      ),
      open ? h('div', { 'data-vital-panel': open, style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('div', { style: { ...TYPE.caption, color: '#7A6E76' } },
          open === 'temp' ? tempSubLabel : open === 'weight' ? weightSubLabel : (lastBp ? ('Last ' + lastBp.sys + '/' + lastBp.dia + ' \\u00b7 ' + fmtTime(lastBp.ts)) : 'No readings yet')),
        panelFor(open)
      ) : null
    ));
  })();
"""

src = src[:i] + new_block + src[j:]

HTML.write_text(src)
print('OK -- vitals strip applied')
