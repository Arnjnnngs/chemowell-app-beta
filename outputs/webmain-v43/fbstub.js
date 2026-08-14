// Offline Firebase stub for the WEB-MAIN export harness.
// Serves FIXTURE data only. It has no network access and no credentials, so it cannot reach
// Brandi's real Firestore even by accident. Writes are recorded, never performed -- the harness
// asserts that the recording stays empty, which is how the read-only claim is tested rather than
// asserted.
export const __writes = [];
window.__fbWrites = __writes;

const DAY = 86400000;
const base = new Date(); base.setHours(0, 0, 0, 0);
const d = (daysAgo, h, m) => base.getTime() - daysAgo * DAY + h * 3600000 + (m || 0) * 60000;

const FIXTURES = [
  { id: 'f01', medId: 'tylenol',        dose: '500 mg',  mg: 500, ts: d(3, 9, 15), painLevel: 4 },
  { id: 'f02', medId: 'tylenol',        dose: '1000 mg', mg: 1000, ts: d(3, 15, 30), painLevel: 7, override: true },
  { id: 'f03', medId: 'tylenol-liquid', dose: '30 mL (1000 mg)', mg: 1000, volumeMl: 30, ts: d(2, 8, 5) },
  { id: 'f04', medId: 'morphine',       dose: '7.5 mg',  mg: 7.5, ts: d(2, 22, 40), painLevel: 9 },
  { id: 'f05', medId: 'temp',           dose: '100.9°F', temp: 100.9, mg: 0, ts: d(2, 9, 30) },
  { id: 'f06', medId: 'temp',           dose: '98.6°F',  temp: 98.6,  mg: 0, ts: d(1, 9, 0) },
  { id: 'f07', medId: 'weight',         dose: '148.0 lbs', weight: 148.0, mg: 0, ts: d(5, 12, 0) },
  { id: 'f08', medId: 'weight',         dose: '145.5 lbs', weight: 145.5, mg: 0, ts: d(1, 12, 0) },
  { id: 'f09', medId: 'symptom_nausea', symptomType: 'nausea', note: 'after breakfast', mg: 0, ts: d(2, 10, 0) },
  { id: 'f10', medId: 'symptom_other',  symptomType: 'other',  note: 'sharp rib pain', mg: 0, ts: d(1, 14, 20) },
  { id: 'f11', medId: 'appetite',       value: 'little', dose: 'Little to none', mg: 0, ts: d(1, 12, 0) },
  { id: 'f12', medId: 'bowel_movement', value: 'diarrhea', dose: 'Diarrhea', mg: 0, ts: d(1, 12, 0) },
  { id: 'f13', medId: 'cycle_start',    dose: null, mg: 0, ts: d(6, 8, 0) },
  { id: 'f14', medId: 'inpatient_start',dose: null, mg: 0, ts: d(4, 7, 0) },
  { id: 'f15', medId: 'inpatient_end',  dose: null, mg: 0, ts: d(4, 19, 0) },
  // CSV-injection probe: a note that a spreadsheet would otherwise execute as a formula.
  { id: 'f16', medId: 'zofran',         dose: '8 mg', mg: 8, ts: d(1, 7, 45), note: '=cmd|calc' },
  // Quote/comma/newline probe.
  { id: 'f17', medId: 'compazine',      dose: '10 mg', mg: 10, ts: d(1, 20, 0), note: 'she said "worse", then\nbetter' },
  // Chemo dates: one scheduled in the FUTURE, one cleared tombstone with ts:0.
  { id: 'f18', medId: 'chemo_date',     dose: 'Chemo scheduled', mg: 0, ts: base.getTime() + 4 * DAY, loggedAt: d(7, 10, 0) },
  { id: 'f19', medId: 'chemo_date',     dose: 'Chemo date cleared', mg: 0, ts: 0, loggedAt: d(6, 11, 0) },
  // Rescheduled AFTER the clear above, so this is the one nextChemoTs() should surface. Models the
  // real sequence: scheduled, cleared, rescheduled. Without this the tombstone is the latest-logged
  // chemo_date and the app correctly reports no upcoming date -- which is what the first run of
  // this harness caught, and it was the assertion that was wrong, not the app.
  { id: 'f21', medId: 'chemo_date',     dose: 'Chemo scheduled', mg: 0, ts: base.getTime() + 4 * DAY, loggedAt: d(5, 9, 0) },
  // An entry whose medication no longer exists in the device config -- must NOT be dropped.
  { id: 'f20', medId: 'a-deleted-med',  dose: '1 tablet', mg: 0, ts: d(1, 6, 0) }
];

export function initializeApp() { return {}; }
export function getFirestore() { return {}; }
export function collection() { return { __col: true }; }
export function doc() { return { __doc: true }; }
export function query() { return { __q: true }; }
export function orderBy() { return {}; }
export async function getDocs() { return { docs: [] }; }
export function getMessaging() { throw new Error('FCM disabled in harness'); }
export function getToken() { return Promise.resolve(null); }
export function onMessage() {}

export async function addDoc(c, data) { __writes.push({ op: 'addDoc', data }); }
export async function deleteDoc() { __writes.push({ op: 'deleteDoc' }); }
export async function setDoc(ref, data) { __writes.push({ op: 'setDoc', data }); }

export function onSnapshot(ref, cb) {
  if (ref && ref.__doc) { setTimeout(() => cb({ exists: () => false, data: () => ({}) }), 10); return () => {}; }
  setTimeout(() => cb({ docs: FIXTURES.map(f => ({ id: f.id, data: () => f })) }), 10);
  return () => {};
}
