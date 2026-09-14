#!/usr/bin/env python3
"""app-v86 -- the Symptoms screen gets the summary Aaron's mockup asked for, and it needed one.

WHAT WAS THERE. A heading, a + button, and a reverse-chronological list of every symptom ever
logged. Nothing else. To answer *"how often has the nausea been happening?"* -- which is the
question an oncologist asks and the reason somebody logs symptoms at all -- a caregiver had to
count rows by hand, and the list has no date grouping to count them in.

WHAT THIS BUILDS: a bar per symptom over a chosen window, longest bar first, with the count and
when it was last noted. Tapping a bar filters the list below to that symptom; tapping it again
clears the filter. A Weeks / Months toggle, matching the other reports.

WHY A COUNT IS AN HONEST NUMBER HERE, and this is not a given on this project. Rule 2.7's third
question -- *does this number belong on the screen at all?* -- took *"Averaging 5.6 L per
procedure"* off the paracentesis report, because a volume that accumulates over time has a mean
that describes nothing. **A count of discrete events is the opposite case.** "Nausea 9 times in
the last 4 weeks, last noted Tuesday" is the sentence somebody says on the phone to a clinic, and
it is what a dose change gets judged against. So the bars are COUNTS and there is no average
severity anywhere on the screen: severity is recorded for skin reactions only, on a three-point
word scale, and a mean of three words across a handful of entries would be exactly the kind of
arithmetically-fine, clinically-meaningless figure this project has already been burned by once.

WRITE MODEL: this release writes NO record and changes NO logging path. Every figure is counted
from `symptomEntries()`, which this screen already called. The + button, the rows and their edit
and remove controls are untouched. The one new piece of state is which symptom the list is
filtered to.

WHAT IS DELIBERATELY EXEMPT: a window with nothing in it draws no bars and says so in a sentence,
rather than drawing an empty chart. An empty chart reads as a broken chart.
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
if 'data-symptom-bar' in src:
    die('the symptom bars are already in this file')

# ---- the one new piece of state ----------------------------------------------------------------
src = cut(src, "let state = { heroSnoozeUntil: 0, vitalOpen: null,",
          "let state = { heroSnoozeUntil: 0, vitalOpen: null, symptomFilter: null, symptomRange: 'weeks',",
          'state.symptomFilter')

# ---- the screen ---------------------------------------------------------------------------------
OLD = """  const list = entries.length ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    ...entries.map(e => symptomRow(e))
  ) : h('div', { style: { background: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(246,108,49,0.2)', borderRadius: '16px', padding: '30px', textAlign: 'center', color: '#7A6E76', fontSize: '14px', lineHeight: '1.5' } }, 'No symptoms or reactions logged yet.\\nTap + to add one.');
  return [header, list];
}"""

NEW = """  // HOW OFTEN, NOT JUST WHAT. The list answered "what was logged" and nothing answered "how often",
  // which is the question an oncologist asks and the reason somebody logs symptoms at all.
  const DAY = 86400000;
  const spanDays = state.symptomRange === 'months' ? 90 : 28;
  const from = now - spanDays * DAY;
  const windowed = entries.filter(e => e.ts >= from);

  const counts = {};
  windowed.forEach(e => {
    const key = e.symptomType || (e.medId || '').slice(8);
    if (!key) return;
    if (!counts[key]) counts[key] = { key, n: 0, last: 0 };
    counts[key].n += 1;
    if (e.ts > counts[key].last) counts[key].last = e.ts;
  });
  const bars = Object.keys(counts).map(k => counts[k]).sort((a, b) => b.n - a.n || b.last - a.last);
  const worst = bars.length ? bars[0].n : 0;

  const rangeToggle = h('div', { style: { display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.45)', borderRadius: '10px', padding: '3px', border: '1px solid #E9D8D1', alignSelf: 'flex-start' } },
    ...[['weeks', 'Weeks'], ['months', 'Months']].map(([v, label]) => h('button', {
      key: v, 'data-symptom-range': v,
      onClick: () => setState({ symptomRange: v }),
      'aria-pressed': String(state.symptomRange === v),
      style: { minHeight: '44px', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: state.symptomRange === v ? '#AE5833' : 'transparent', color: state.symptomRange === v ? '#fff' : '#7A6E76' }
    }, label))
  );

  const daysAgo = (ts) => {
    const d = Math.round((dayStart(now) - dayStart(ts)) / DAY);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : (d + ' days ago');
  };

  // COUNTS, AND NO AVERAGE SEVERITY. A count of discrete events is the honest number here -- it is
  // the sentence somebody says on the phone to a clinic. A mean of a three-word severity scale
  // recorded for one symptom type would be the paracentesis average again (Rule 2.7, question 3).
  const summary = h('section', { 'data-symptom-summary': 'true', style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' } },
      h('div', { style: { ...TYPE.label, color: '#915E48' } }, 'How often'),
      rangeToggle
    ),
    !bars.length
      ? h('div', { 'data-symptom-bars-empty': 'true', style: { background: '#FFFFFF', border: '1px dashed #E9D8D1', borderRadius: '14px', padding: '20px', textAlign: 'center', color: '#7A6E76', fontSize: '13.5px', lineHeight: '1.5' } },
          'Nothing logged in the last ' + (state.symptomRange === 'months' ? '3 months' : '4 weeks') + '.')
      : h('div', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '16px', padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 3px 14px rgba(203,122,87,0.10)' } },
          ...bars.map(b => {
            const on = state.symptomFilter === b.key;
            const pct = worst ? Math.max(6, Math.round((b.n / worst) * 100)) : 0;
            const name = SYMPTOM_TYPES[b.key] || b.key;
            return h('button', {
              key: b.key,
              'data-symptom-bar': b.key,
              'aria-pressed': on ? 'true' : 'false',
              'aria-label': name + ', ' + b.n + (b.n === 1 ? ' time' : ' times') + ', last ' + daysAgo(b.last) + (on ? '. Showing only these.' : '. Tap to show only these.'),
              onClick: () => setState({ symptomFilter: on ? null : b.key }),
              style: { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minHeight: '44px', padding: '6px 7px', textAlign: 'left', borderRadius: '11px', background: on ? 'rgba(246,108,49,0.08)' : 'transparent', border: on ? '1px solid rgba(228,111,60,0.34)' : '1px solid transparent' }
            },
              h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '9px', minWidth: '0' } },
                h('span', { style: { ...TYPE.caption, fontSize: '13px', fontWeight: '700', color: '#2A2127', minWidth: '0', overflowWrap: 'anywhere' } }, name),
                h('span', { className: 'mono', style: { fontSize: '12.5px', fontWeight: '700', color: '#A83D0F', flexShrink: '0', whiteSpace: 'nowrap' } },
                  b.n + ' \\u00b7 ' + daysAgo(b.last))
              ),
              h('div', { 'aria-hidden': 'true', style: { height: '7px', borderRadius: '99px', background: 'rgba(246,108,49,0.10)', overflow: 'hidden' } },
                h('div', { style: { height: '100%', width: pct + '%', borderRadius: '99px', background: 'linear-gradient(90deg, #E46F3C 0%, #BF4C1A 100%)', transition: 'width .4s ease' } })
              )
            );
          })
        )
  );

  // The filter applies to the LIST ONLY, never to the bars -- a chart that re-draws itself around
  // the selection stops being something you can compare against, and the selected bar would then
  // always be the longest one on screen.
  const shown = state.symptomFilter
    ? entries.filter(e => (e.symptomType || (e.medId || '').slice(8)) === state.symptomFilter)
    : entries;
  const filterNote = state.symptomFilter ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
    h('span', { style: { ...TYPE.caption, color: '#7A6E76' } },
      'Showing ' + (SYMPTOM_TYPES[state.symptomFilter] || state.symptomFilter) + ' only'),
    h('button', { 'data-symptom-clear': 'true', onClick: () => setState({ symptomFilter: null }),
      style: { minHeight: '44px', padding: '0 12px', borderRadius: '11px', fontSize: '12.5px', fontWeight: '700', color: '#A83D0F', background: 'rgba(200,83,32,0.10)' } }, 'Show all')
  ) : null;

  const list = shown.length ? h('div', { 'data-symptom-list': 'true', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    ...shown.map(e => symptomRow(e))
  ) : h('div', { 'data-symptom-list': 'true', style: { background: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(246,108,49,0.2)', borderRadius: '16px', padding: '30px', textAlign: 'center', color: '#7A6E76', fontSize: '14px', lineHeight: '1.5' } },
    entries.length ? 'None of these logged yet.' : 'No symptoms or reactions logged yet.\\nTap + to add one.');
  return [header, entries.length ? summary : null, filterNote, list];
}"""

src = cut(src, OLD, NEW, 'the symptoms screen')

# ---- Back dismisses the filter before it leaves the screen ---------------------------------------
# A filter is a thing the user turned on; Back should turn it off before it leaves the tab, or the
# app-v82 back-button work has a hole in it the moment this ships.
src = cut(src,
  "  { key: 'help', label: 'an open help topic',",
  "  { key: 'symptomFilter', label: 'the symptom filter', open: () => state.symptomFilter != null, close: () => setState({ symptomFilter: null }) },\n"
  "  { key: 'help', label: 'an open help topic',",
  'the back-button layer')

HTML.write_text(src)
print('OK -- symptom bars applied')
