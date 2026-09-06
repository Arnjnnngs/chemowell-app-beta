#!/usr/bin/env python3
"""
enhance-reports-patch.py — app-v71. Report screens that can do the whole job.

Aaron, 2026-09-06: "we probably need to make sure the same applies to chemowell where allowed."

The Enhancer pass (care-tracker `outputs/ENHANCER-PASS-02-chemowell.md`) found ChemoWell has every
one of care-tracker's gaps plus one of its own:

    screen         add   edit   remove
    Paracentesis   NO    NO     yes      <- can destroy a record but not create or correct one
    Weight         NO    NO     no
    Radiation      NO    NO     no       <- no controls at all; ChemoWell-only
    Cycle          yes   NO     no

Three of those screens said so out loud in their own empty states -- "Log the liters drained from
the card on Home", "Log them from the Radiation sessions card on Home", "Log your first weight on
the Today tab". Sentences the app wrote about its own incompleteness.

WHAT THIS PATCH DOES: add rows on Paracentesis, Weight and Radiation, and Edit on paracentesis rows.

WHAT IT DELIBERATELY DOES NOT DO, AND WHY -- THE CYCLE EDIT.
care-tracker shipped one four hours ago (v66) and it destroyed data: removing a period's end
reopened it, the next start merged into the reopened period, and two months of a patient's record
became one with no way back from inside the app. It was withdrawn in v67.

ChemoWell's cycle model is NOT the same and is arguably more fragile. Its "+" writes a MATCHED
Start+End PAIR through a 'period' modal, and its own source comment says why:

    "a lone backdated Start could previously get silently swallowed (overwritten with no visible
     trace) if a later Start already existed with no End between them"

Porting a marker-by-marker move into a model that pairs and warns about lone markers is a different
design, not a port. Given direct evidence from this week of what getting it wrong costs in a
patient's app, it gets its own release and its own audit. Nothing here touches cyclePeriods().

SPELLING: liters, both apps. ChemoWell has ~75 "liter" and exactly one "litres", which is a Help
SEARCH ALIAS so the British spelling still finds the answer. An earlier note claimed the two apps
deliberately differed; that was invented and wrong.
"""
import re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'index.html')
s = open(TARGET, encoding='utf-8').read()
orig_len = len(s)


def sub(old, new, why):
    """Replace exactly once. A missed anchor must fail loudly, not silently no-op."""
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit('ANCHOR %s matched %d times (need exactly 1): %s' % (why, n, old[:90]))
    s = s.replace(old, new)


# ---------------------------------------------------------------- 1. the shared add row
# ONE helper for all three screens, so they cannot drift apart the way they did in the first place.
# It reuses the EXISTING log handlers -- logParacentesis(), logWeight(), and the radiation modal the
# Home card already opens -- so there is one code path per record type, not a second to keep in step.
sub("""async function logParacentesis() {""",
    """function reportAddRow(opts) {
  return h('section', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '16px', padding: '13px 14px' } },
    h('div', { style: { fontSize: '11.5px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#7A6E76', marginBottom: '8px' } }, opts.label),
    opts.button
      ? h('button', { 'data-report-add-btn': 'true', onClick: opts.onLog, style: { width: '100%', minHeight: '44px', borderRadius: '12px', background: '#A83D0F', color: '#fff', fontSize: '14px', fontWeight: '700' } }, opts.button)
      : h('div', { style: { display: 'flex', gap: '8px' } },
          h('input', Object.assign({
            type: 'number', inputMode: 'decimal', step: '0.1', min: '0',
            placeholder: opts.placeholder, value: opts.value, onInput: opts.onInput, className: 'mono',
            // 16px is the iOS floor -- anything smaller makes Safari zoom the page on focus.
            style: { flex: '1', minWidth: '0', minHeight: '44px', border: '1px solid #E9D8D1', borderRadius: '12px', padding: '0 13px', fontSize: '16px', background: '#FFFFFF', color: '#3A2F33' }
          }, opts.max ? { max: String(opts.max) } : {}, opts.hook ? { [opts.hook]: 'true' } : {})),
          h('button', { onClick: opts.onLog, style: { flexShrink: '0', minHeight: '44px', padding: '0 18px', borderRadius: '12px', background: '#A83D0F', color: '#fff', fontSize: '14px', fontWeight: '700' } }, 'Log')
        )
  );
}

// Opens the same time modal the Home card uses, carrying the existing paraId so the write
// SUPERSEDES rather than duplicating. paracentesisResolved() keeps the newest loggedAt per id.
function paraEditOpen(p) {
  setState({ timeModal: { type: 'para', editId: p.paraId, paraValue: p.liters, timeValue: toLocalISO(p.ts) } });
}

async function logParacentesis() {""",
    'add-row-helper')


# ---------------------------------------------------------------- 2. modal: title + liters field
# CHEMOWELL HAS NO PARACENTESIS TITLE AT ALL, AND THE CHAIN ENDS ON A BARE `else` THAT ASSUMES
# WEIGHT. So opening the paracentesis time dialog today is headed "Log Weight · undefined <unit>".
# care-tracker hit this exact bug and its fix carries the note: Aaron reported it as a MISSING DATE
# FIELD, because who would trust that dialog. ChemoWell never got the fix. An unknown type now says
# so instead of borrowing another type's words.
sub("""  } else if (m.type === 'radiation') {
    title = 'Log Past Radiation Session';
  } else {
    title = 'Log Weight · ' + m.weightValue + ' ' + weightSuffix();
  }""",
    """  } else if (m.type === 'radiation') {
    title = 'Log Past Radiation Session';
  } else if (m.type === 'para') {
    // When editing, the liters are editable below, so the heading states the action and the field
    // states the value -- otherwise the heading shows a stale number the moment she types.
    title = m.editId ? 'Edit Paracentesis' : ('Log Paracentesis · ' + paraFmtLiters(m.paraValue) + ' L');
  } else if (m.type === 'weight') {
    title = 'Log Weight · ' + m.weightValue + ' ' + weightSuffix();
  } else {
    console.warn('[timeModal] unknown type:', m.type);
    title = 'Log entry';
  }""",
    'modal-title-para')


# EDITING A PARACENTESIS CHANGES THE VOLUME AS WELL AS THE DATE. A wrong figure (4.5 typed as 45) is
# at least as likely as a wrong day. Inserted right after the title, before the symptom block --
# ChemoWell replaced the native datetime input with a custom month-grid picker in v68, so there is
# no "Date & Time" label to anchor to the way care-tracker has.
sub("""      h('div', { style: { ...TYPE.title, color: '#2A2127', marginBottom: '22px', textAlign: 'center' } }, title),
      m.type === 'symptom' ? h('div', { style: { marginBottom: '16px' } },""",
    """      h('div', { style: { ...TYPE.title, color: '#2A2127', marginBottom: '22px', textAlign: 'center' } }, title),
      (m.type === 'para' && m.editId) ? h('div', { style: { marginBottom: '16px' } },
        h('div', { style: { ...TYPE.label, color: '#915E48', marginBottom: '8px' } }, 'Liters drained'),
        h('input', { 'data-para-edit-liters': 'true', type: 'number', inputMode: 'decimal', step: '0.1', min: '0', max: String(PARA_MAX_LITERS),
          value: String(m.paraValue), onInput: (e) => { const n = parseFloat(e.target.value); state.timeModal.paraValue = isNaN(n) ? null : n; },
          className: 'mono',
          // 16px is the iOS floor -- anything smaller makes Safari zoom the page on focus.
          style: { width: '100%', minHeight: '52px', border: '1px solid #E9D8D1', borderRadius: '13px', padding: '0 14px', fontSize: '16px', background: '#FFFFFF', color: '#3A2F33' } })
      ) : null,
      m.type === 'symptom' ? h('div', { style: { marginBottom: '16px' } },""",
    'modal-liters-field')

# ---------------------------------------------------------------- 3. para branch handles an edit
sub("""  } else if (m.type === 'para') {
    const v = m.paraValue;
    setState({ paraInput: '', timeModal: null });
    await addEntryDB({ medId: PARA_MED_ID, paraId: paraNewId(), liters: v, dose: paraFmtLiters(v) + ' L',
                       mg: 0, ts, loggedAt: Date.now() });
    setToast('Paracentesis ' + paraFmtLiters(v) + ' L logged at ' + fmtTime(ts));""",
    """  } else if (m.type === 'para') {
    const v = m.paraValue;
    // Re-validated HERE because when editing the value is typed into the modal. logParacentesis()
    // validates its own input on the way in; that check cannot cover a value changed afterwards.
    if (!(typeof v === 'number' && isFinite(v) && v > 0 && v <= PARA_MAX_LITERS)) {
      setToast('Enter the liters drained (up to ' + PARA_MAX_LITERS + ')');
      return;
    }
    // AN EDIT IS A NEW RECORD CARRYING THE SAME paraId, NOT A DELETE AND RE-ADD. Nothing is
    // removed, so nothing can be lost if the write fails.
    //
    // loggedAt MUST BEAT THE RECORD IT REPLACES, not merely be "now": paraSupersedes() falls back
    // to `ts` when loggedAt is absent, so a legacy or future-dated record would keep winning and
    // the edit would silently do nothing while the toast said "updated". Found by the care-tracker
    // v66 audit, fixed there in v67, and carried here rather than re-learned.
    const editing = !!m.editId;
    const prevRec = editing ? paracentesisResolved().find(x => x.paraId === m.editId) : null;
    const prevStamp = prevRec ? (prevRec.loggedAt || prevRec.ts || 0) : 0;
    setState({ paraInput: '', timeModal: null });
    await addEntryDB({ medId: PARA_MED_ID, paraId: editing ? m.editId : paraNewId(), liters: v, dose: paraFmtLiters(v) + ' L',
                       mg: 0, ts, loggedAt: Math.max(Date.now(), prevStamp + 1) });
    setToast('Paracentesis ' + paraFmtLiters(v) + ' L ' + (editing ? 'updated' : 'logged') + ' at ' + fmtTime(ts));""",
    'confirm-para-edit')


# ---------------------------------------------------------------- 4. Paracentesis report
sub("""'No paracentesis procedures logged yet.\\nLog the liters drained from the card on Home.')];""",
    """'No paracentesis procedures logged yet.')];""",
    'para-empty-text')

sub("""function renderParacentesis(now) {""",
    """function renderParacentesis(now) {
  // THE ADD ROW IS PRESENT WHETHER OR NOT ANYTHING IS LOGGED. The empty state used to read "Log the
  // liters drained from the card on Home" -- the app telling the caregiver this screen could not do
  // its own job.
  const addRow = reportAddRow({
    label: 'Log a paracentesis', placeholder: 'Liters', max: PARA_MAX_LITERS, hook: 'data-para-report-add',
    value: state.paraInput, onInput: (e) => { state.paraInput = e.target.value; }, onLog: logParacentesis
  });""",
    'para-add-row-decl')

sub("""    return [h('div', { style: { background: '#FFFFFF', border: '1px dashed #E9D8D1', borderRadius: '14px', padding: '30px', textAlign: 'center', col""",
    """    return [addRow, h('div', { style: { background: '#FFFFFF', border: '1px dashed #E9D8D1', borderRadius: '14px', padding: '30px', textAlign: 'center', col""",
    'para-empty-return')

sub("""        : h('button', { onClick: () => setState({ confirmRemovePara: p.paraId }), style: { flexShrink: '0', color: '#A83D0F', fontSize: '12.5px', fontWeight: '700', padding: '9px 10px', borderRadius: '10px', background: 'rgba(200,83,32,0.10)' } }, 'Remove')""",
    """        // REPLACE THE WHOLE EXPRESSION, not just its opening. Splicing a prefix onto an expression
        // whose tail is not also rewritten wraps the button in a container nothing closes -- that
        // exact mistake stopped care-tracker's index.html parsing during v66.
        : h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center', flexShrink: '0' } },
            h('button', { 'data-para-edit': 'true', onClick: () => paraEditOpen(p), style: { color: '#A83D0F', fontSize: '12.5px', fontWeight: '700', padding: '9px 10px', borderRadius: '10px', minHeight: '44px', background: 'rgba(200,83,32,0.10)' } }, 'Edit'),
            h('button', { onClick: () => setState({ confirmRemovePara: p.paraId }), style: { flexShrink: '0', color: '#A83D0F', fontSize: '12.5px', fontWeight: '700', padding: '9px 10px', borderRadius: '10px', minHeight: '44px', background: 'rgba(200,83,32,0.10)' } }, 'Remove')
          )""",
    'para-edit-button')

sub("""  return [stats, note, rows];""",
    """  return [addRow, stats, note, rows];""",
    'para-return')


# ---------------------------------------------------------------- 5. Radiation report
sub("""'No radiation sessions logged yet. Log them from the Radiation sessions card on Home.')];""",
    """'No radiation sessions logged yet.')];""",
    'rad-empty-text')

sub("""function renderRadiationReport(now) {""",
    """function renderRadiationReport(now) {
  // A session has no amount to type, so this is a button rather than a field. It opens the SAME
  // modal the Home card's "log a past session" control already opens -- an audited path, not a new
  // one. This screen previously had no controls at all.
  const addRow = reportAddRow({
    label: 'Log a radiation session', button: 'Log a session',
    onLog: () => setState({ timeModal: { type: 'radiation', timeValue: nowLocalISO() } })
  });""",
    'rad-add-row-decl')

sub("""  if (!sessions.length) return [h('div', { style: { background: '#FFFFFF', border: '1px solid """,
    """  if (!sessions.length) return [addRow, h('div', { style: { background: '#FFFFFF', border: '1px solid """,
    'rad-empty-return')

sub("""  return [summary, list];""",
    """  return [addRow, summary, list];""",
    'rad-return')


# ---------------------------------------------------------------- 6. Weight report
sub("""'No weight readings logged yet.\\nLog your first weight on the Today tab.')""",
    """'No weight readings logged yet.')""",
    'weight-empty-text')

sub("""  // Range toggle""",
    """  const addRow = reportAddRow({
    label: 'Log a weight', placeholder: weightDefault() || '156.0', max: 999, hook: 'data-weight-report-add',
    value: state.weightInput, onInput: (e) => { state.weightInput = e.target.value; }, onLog: logWeight
  });

  // Range toggle""",
    'weight-add-row-decl')

# EVERY REPORT RETURN PATH MUST LEAD WITH THE ADD ROW -- and renderWeightTrend has FOUR `return`
# statements, one of which belongs to a NESTED HELPER that renders a single row and must NOT get it.
# care-tracker v66 shipped this same control appearing only when there were no readings, because a
# ternary return went unnoticed AND the count check counted the wrong universe. Here each of the
# three real paths is rewritten by name and then counted.
start = s.index('function renderWeightTrend(now) {')
end = s.index('\nfunction ', start + 10)
body = s[start:end]
before = body
body = body.replace("return [\n", "return [addRow,\n", 1)                                   # empty state
body = body.replace("return [toggle, h('div',", "return [addRow, toggle, h('div',", 1)      # too few readings
body = body.replace("return paraLine ? [toggle, chart, stats, paraLine, readings] : [toggle, chart, stats, readings];",
                    "return paraLine ? [addRow, toggle, chart, stats, paraLine, readings] : [addRow, toggle, chart, stats, readings];", 1)
n_fixed = body.count('[addRow,')
if n_fixed != 4:      # three return statements, the ternary contributing two arms
    raise SystemExit('ANCHOR weight-returns: %d addRow insertions, expected 4 (empty, few, ternary x2)' % n_fixed)
if body == before:
    raise SystemExit('ANCHOR weight-returns: nothing rewritten')
s = s[:start] + body + s[end:]

# "AVERAGING x L PER PROCEDURE" IS NOT A THING, AND IT IS REMOVED.
# Aaron, 2026-09-06: "we need to remove average of 5.6 L per procedure for para. this isn't an avg
# thing."
#
# A paracentesis drains what has accumulated, so the volume depends on how long it has been and how
# fast fluid is reaccumulating. The mean of those volumes describes nothing a clinician would use
# and invites the wrong reading -- "she's averaging 5.6, this one was 3, she's improving" -- when
# the INTERVAL carries the meaning, and that is already on screen as "Since last".
# Arithmetically correct and clinically meaningless is still a false impression.
#
# Fixed in care-tracker v68 the same hour. The sentence about weight is kept.
sub("""    'Averaging ' + paraFmtLiters(avg) + ' L per procedure. These are recorded separately from weight — the Weight report still shows what the scale actually said, with a marker on each drain date.');""",
    """    'These are recorded separately from weight — the Weight report still shows what the scale actually said, with a marker on each drain date.');""",
    'no-average-per-procedure')

# `avg` now has no reader.
sub("""  const avg = total / list.length;
""", "", 'drop-unused-avg')

open(TARGET, 'w', encoding='utf-8').write(s)
print('chemowell enhance-reports-patch applied: %d -> %d bytes' % (orig_len, len(s)))
print('weight addRow insertions: %d' % n_fixed)
