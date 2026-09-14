#!/usr/bin/env python3
"""app-v85 -- THERE IS NO TEMPERATURE REPORT. There never has been. This builds it.

Task #25 from Aaron's approved redesign asks for a "temp chart with the 100.4 line". Reading the
app to build it turned up something worse than a missing chart: **temperature has no report screen
at all.** `reportTypes` on the Reports menu lists history, weight, paracentesis, blood pressure,
radiation, cycle, bowel movements and appetite. Not temperature.

**Why that is the most serious gap on the Reports screen.** The app already treats temperature as
the one vital with a clinical threshold: Home colours a reading amber at 100.4 F and red at 103 F,
and 100.4 F is the number an oncology line asks for by name, because a fever during chemotherapy
can mean neutropenic sepsis and is an emergency. The app knows that number, prints a reading in red
because of it -- and then offers no way whatsoever to see the readings over time. Somebody on the
phone to a clinic being asked *"how long has the temperature been up, and how high did it get?"*
has to scroll the History list by hand.

WHAT THIS BUILDS

  * A **Temperature** report, in the same place and the same shape as Weight, with the same Weeks /
    Months toggle, the same add row, the same readings list.
  * The chart carries **two threshold lines drawn from the app's own thresholds** -- `tempFever()`
    and `tempHigh()`, the same functions Home colours from, so the line on the chart and the colour
    on Home can never disagree. In Celsius they are 38.0 and 39.4 and the lines move with the unit
    rather than being drawn at a Fahrenheit number and mislabelled.
  * Readings at or above a threshold are drawn in that threshold's colour, so a fever is visible
    without reading the axis.
  * The stat tiles are **Highest, Latest, and Readings at or above the fever line** -- the three a
    clinician asks for.

WHAT IS DELIBERATELY *NOT* THERE, and this is the Voice's third question (Rule 2.7):
**no average temperature.** A mean of body temperatures over a month describes nothing anybody
would act on and invites exactly the wrong reading -- *"averaging 98.9, that's fine"* across a week
containing one 102.3. The peak and the count above the line are what carry the meaning. This is the
same finding that took *"Averaging 5.6 L per procedure"* off the paracentesis screen, applied before
it shipped rather than after.

WRITE MODEL: this release writes no record through any new path. The add row calls `logTemp`,
unchanged, which opens the confirm-the-time sheet exactly as it does on Home. Everything else on
the screen is computed from `state.entries`.

UNIT CONVERSION, ONCE, AT INGESTION. `dispTemp(e)` is applied when the readings are read, so mixed
history -- logged in Celsius, viewed in Fahrenheit -- charts on one axis. This is the pattern
`renderWeightTrend` already uses and the reason its v12b comment exists.
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
if 'renderTemperatureReport' in src:
    die('the temperature report is already in this file')

REPORT = r"""
function renderTemperatureReport(now) {
  // Converted ONCE at ingestion, so a history logged in Celsius and viewed in Fahrenheit charts on
  // one axis -- the same reason renderWeightTrend does it (its v12b note).
  const all = state.entries.filter(e => e.medId === 'temp' && typeof e.temp === 'number')
    .sort((a, b) => a.ts - b.ts)
    .map(e => ({ ts: e.ts, t: dispTemp(e) }))
    .filter(e => typeof e.t === 'number');
  const range = state.weightRange;
  const DAY = 86400000;
  // THE THRESHOLDS COME FROM THE APP, NOT FROM THIS FILE. tempFever() and tempHigh() are what Home
  // colours a reading from, so a line drawn here can never disagree with the colour shown there --
  // and in Celsius they are 38.0 and 39.4, so the lines move with the unit instead of being drawn
  // at a Fahrenheit number under a Celsius axis.
  const fever = tempFever(), high = tempHigh();

  const addRow = reportAddRow({
    label: 'Log a temperature', placeholder: tempDefault(), max: 113, hook: 'data-temp-report-add',
    value: state.tempInput, onInput: (e) => { state.tempInput = e.target.value; }, onLog: logTemp
  });

  const toggle = h('div', { style: { display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.45)', borderRadius: '10px', padding: '3px', border: '1px solid #E9D8D1', alignSelf: 'flex-start' } },
    h('button', { onClick: () => setState({ weightRange: 'weeks' }), 'aria-pressed': String(range === 'weeks'), style: { minHeight: '44px', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: range === 'weeks' ? '#AE5833' : 'transparent', color: range === 'weeks' ? '#fff' : '#7A6E76' } }, 'Weeks'),
    h('button', { onClick: () => setState({ weightRange: 'months' }), 'aria-pressed': String(range === 'months'), style: { minHeight: '44px', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: range === 'months' ? '#AE5833' : 'transparent', color: range === 'months' ? '#fff' : '#7A6E76' } }, 'Months')
  );

  if (!all.length) {
    return [addRow, toggle,
      h('div', { 'data-temp-empty': 'true', style: { background: '#FFFFFF', border: '1px dashed #E9D8D1', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', color: '#7A6E76', fontSize: '14px', lineHeight: '1.5' } },
        'No temperatures logged yet. Log one from the box above, or from the Temp tile on Home.')
    ];
  }

  const spanDays = range === 'weeks' ? 28 : 90;
  const minTs = now - spanDays * DAY;
  const inRange = all.filter(e => e.ts >= minTs);
  const points = inRange.length ? inRange : all.slice(-2);

  const vals = points.map(p => p.t);
  // The axis must always contain the fever line, or a week of normal readings draws a chart with
  // no line on it and the reader has no idea where the threshold sits.
  const lo = Math.min(Math.min.apply(null, vals), fever) - 0.6;
  const hi = Math.max(Math.max.apply(null, vals), fever) + 0.6;
  const vMin = Math.floor(lo * 2) / 2, vMax = Math.ceil(hi * 2) / 2;
  const vRange = (vMax - vMin) || 2;
  const tMin = points[0].ts;
  const tMax = Math.max(points[points.length - 1].ts, tMin + DAY);
  const tRange = (tMax - tMin) || DAY;

  const W = 680, H = 300;
  const pad = { top: 30, right: 20, bottom: 50, left: 58 };
  const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
  const x = (ts) => pad.left + ((ts - tMin) / tRange) * cW;
  const y = (v) => pad.top + cH - ((v - vMin) / vRange) * cH;
  const colourFor = (v) => v >= high ? '#C0453B' : v >= fever ? '#9A6419' : '#AE5833';

  let pathD = '';
  points.forEach((p, i) => { pathD += (i === 0 ? 'M' : 'L') + x(p.ts).toFixed(1) + ',' + y(p.t).toFixed(1); });

  const ySteps = 5, yLabels = [];
  for (let i = 0; i <= ySteps; i++) { const v = vMin + (vRange / ySteps) * i; yLabels.push({ val: Math.round(v * 10) / 10, py: y(v) }); }
  const xLabels = [], labelCount = range === 'weeks' ? 4 : 6;
  for (let i = 0; i <= labelCount; i++) {
    const ts = tMin + (tRange / labelCount) * i, d = new Date(ts);
    xLabels.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), px: x(ts) });
  }

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">';
  yLabels.forEach(yl => {
    svg += '<line x1="' + pad.left + '" y1="' + yl.py.toFixed(1) + '" x2="' + (W - pad.right) + '" y2="' + yl.py.toFixed(1) + '" stroke="rgba(246,108,49,0.10)" stroke-width="1"/>';
    svg += '<text x="' + (pad.left - 10) + '" y="' + (yl.py + 4).toFixed(1) + '" fill="#7A6E76" font-size="12" font-family="ui-monospace,Menlo,monospace" text-anchor="end">' + yl.val + '</text>';
  });
  xLabels.forEach(xl => {
    svg += '<text x="' + xl.px.toFixed(1) + '" y="' + (H - 10) + '" fill="#7A6E76" font-size="12" font-family="ui-monospace,Menlo,monospace" text-anchor="middle">' + xl.label + '</text>';
  });
  // THE THRESHOLD LINES. Drawn before the data so a reading sits on top of them, and each labelled
  // with its own number so nobody has to count gridlines to find out which line is which.
  const rule = (v, colour, label) => {
    if (v < vMin || v > vMax) return '';
    const py = y(v).toFixed(1);
    return '<line x1="' + pad.left + '" y1="' + py + '" x2="' + (W - pad.right) + '" y2="' + py + '" stroke="' + colour + '" stroke-width="1.5" stroke-dasharray="6 5"/>' +
           '<text x="' + (W - pad.right) + '" y="' + (y(v) - 6).toFixed(1) + '" fill="' + colour + '" font-size="12" font-weight="700" font-family="ui-monospace,Menlo,monospace" text-anchor="end">' + label + '</text>';
  };
  svg += rule(fever, '#9A6419', 'Fever ' + fever + tempSuffix());
  svg += rule(high, '#C0453B', 'High ' + high + tempSuffix());
  svg += '<path d="' + pathD + '" fill="none" stroke="#AE5833" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  points.forEach((p, i) => {
    const isLast = i === points.length - 1, c = colourFor(p.t);
    svg += '<circle cx="' + x(p.ts).toFixed(1) + '" cy="' + y(p.t).toFixed(1) + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + c + '" stroke="' + c + '" stroke-width="1.5"/>';
    if (isLast) svg += '<text x="' + x(p.ts).toFixed(1) + '" y="' + (y(p.t) - 12).toFixed(1) + '" fill="' + c + '" font-size="13" font-weight="700" font-family="ui-monospace,Menlo,monospace" text-anchor="middle">' + p.t + '</text>';
  });
  svg += '</svg>';

  const latestPt = points[points.length - 1];
  const peak = points.reduce((a, b) => (b.t > a.t ? b : a));
  const overCount = points.filter(p => p.t >= fever).length;

  const tile = (label, value, colour, hook) => h('div', { [hook]: 'true', style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '14px', padding: '14px', textAlign: 'center', boxShadow: '0 4px 24px rgba(203,122,87,0.10)' } },
    h('div', { style: { ...TYPE.label, color: '#7A6E76', marginBottom: '6px' } }, label),
    h('div', { className: 'mono', style: { fontSize: '18px', fontWeight: '700', color: colour } }, value)
  );

  return [
    addRow,
    toggle,
    h('section', { 'data-temp-chart': 'true', style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '18px', padding: '20px 16px 12px', boxShadow: '0 4px 24px rgba(203,122,87,0.10), 0 1px 2px rgba(203,122,87,0.06)' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } },
        h('div', { style: { minWidth: '0' } },
          h('div', { style: { ...TYPE.label, color: '#915E48' } }, 'Temperature'),
          h('div', { style: { fontSize: '12.5px', color: '#7A6E76', marginTop: '3px' } }, range === 'weeks' ? 'Last 4 weeks' : 'Last 3 months')
        ),
        h('div', { className: 'mono', style: { fontSize: '24px', fontWeight: '700', color: colourFor(latestPt.t), letterSpacing: '-0.02em' } }, latestPt.t + tempSuffix())
      ),
      h('div', { innerHTML: svg })
    ),
    // NO AVERAGE. A mean body temperature over a month describes nothing anybody acts on and
    // invites the wrong reading -- "averaging 98.9, that's fine" across a week holding one 102.3.
    // The peak and the count above the line are what a clinician asks for. Rule 2.7, question 3,
    // applied before this shipped rather than after (the paracentesis average).
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' } },
      tile('Highest', peak.t + '', colourFor(peak.t), 'data-temp-peak'),
      tile('Latest', latestPt.t + '', colourFor(latestPt.t), 'data-temp-latest'),
      tile('At or above ' + fever, String(overCount), overCount ? '#9A6419' : '#2A2127', 'data-temp-overcount')
    ),
    h('section', { 'data-temp-list': 'true', style: { display: 'flex', flexDirection: 'column', gap: '7px' } },
      h('div', { style: { ...TYPE.label, color: '#915E48' } }, 'Readings'),
      ...points.slice().reverse().map(p => h('div', { key: String(p.ts), style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '13px', padding: '11px 13px' } },
        h('div', { style: { ...TYPE.caption, color: '#554A52', minWidth: '0' } },
          new Date(p.ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + fmtTime(p.ts)),
        h('div', { className: 'mono', style: { fontSize: '15px', fontWeight: '700', color: colourFor(p.t), whiteSpace: 'nowrap' } },
          p.t + tempSuffix() + (p.t >= high ? ' · high' : p.t >= fever ? ' · fever' : ''))
      ))
    )
  ];
}
"""

src = cut(src, "function renderBloodPressureReport(now) {", REPORT + "\nfunction renderBloodPressureReport(now) {",
          'the temperature report')

# ---- the menu, the descriptor, the router ------------------------------------------------------
src = cut(src,
  "  const reportTypes = ['history', 'weight', 'paracentesis', 'blood_pressure',",
  "  const reportTypes = ['history', 'weight', 'temp', 'paracentesis', 'blood_pressure',",
  'the report list')

src = cut(src,
  "  if (type === 'history') return { label: 'History', icon: 'history', description: 'Review dose, symptom, and vital logs by day.', meta: state.entries.length + ' recorded ' + (state.entries.length === 1 ? 'entry' : 'entries') };",
  "  if (type === 'history') return { label: 'History', icon: 'history', description: 'Review dose, symptom, and vital logs by day.', meta: state.entries.length + ' recorded ' + (state.entries.length === 1 ? 'entry' : 'entries') };\n"
  "  // The tile's own line says whether the last reading was a fever, because that is the question\n"
  "  // somebody opens this screen to answer -- not how many readings there are.\n"
  "  if (type === 'temp') { const lt = latest('temp'); const d = lt ? dispTemp(lt) : null;\n"
  "    return { label: 'Temperature', icon: 'chart', description: 'See temperatures over time against the fever line.',\n"
  "      meta: d === null ? 'No readings yet' : (d + tempSuffix() + ' latest' + (d >= tempHigh() ? ' \\u00b7 high' : d >= tempFever() ? ' \\u00b7 fever' : '')) }; }",
  'the temperature descriptor')

# The thresholds, exposed so a suite can compare the line DRAWN on the chart against the number
# the app COLOURS from. Without it the only available check is a pattern match on chart text, and
# the first version of exactly that check passed while the label had lost its number.
src = cut(src,
  "  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state) };",
  "  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state) };\n"
  "  window.__tempTest = { fever: tempFever, high: tempHigh, suffix: tempSuffix };",
  'the temperature debug hook')

src = cut(src,
  "  const content = type === 'history' ? renderHistory(now) : type === 'weight' ? renderWeightTrend(now) :",
  "  const content = type === 'history' ? renderHistory(now) : type === 'weight' ? renderWeightTrend(now) : type === 'temp' ? renderTemperatureReport(now) :",
  'the report router')

HTML.write_text(src)
print('OK -- temperature report applied')
