// Be the Mayor: the save object. Pure JS, JSON-serialisable. Contract: docs/builds/01-first-15.md §3.1.
export const SAVE_VERSION = 1;

const clean = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

export function newSave(name, town) {
  return {
    v: SAVE_VERSION,
    name: clean(name, 'You'),
    town: clean(town, 'Brookfield'),
    day: 1,
    money: 0,
    rep: 0,
    energy: 3,
    maxEnergy: 3,
    rank: 0,
    skills: {},        // { wall: stars, delivery: stars, electric: 1, computer: 1, ... }
    jobs: [],          // ids of jobs done, in order
    lastTwist: {},     // { wall: 'rain' } so a verb never repeats with the same twist
    offers: [],        // the job board
    seq: 0,            // offer id counter
    problems: [],      // open problem ids
    seen: [],          // problem and event ids already shown
    event: null,       // pending event id
    nextEventAt: 240,  // play seconds
    nextProblemAt: 0,
    upgrades: {},      // { id: { endsAt, done } }
    later: [],         // delayed consequences: [{ at, who, text, effects, headline }]
    headlines: [],     // for the next newspaper
    buildings: null,   // filled from data/town.json by createLife
  };
}

const kind = v => (Array.isArray(v) ? 'array' : v === null ? 'null'
  : typeof v === 'number' ? (Number.isFinite(v) ? 'number' : 'bad') : typeof v);

// Old, partial or broken saves always load: every field of the wrong type falls back to its default.
export function migrate(save) {
  if (kind(save) !== 'object') return newSave();
  const s = newSave(save.name, save.town);
  for (const [k, def] of Object.entries(s)) {
    if (k === 'name' || k === 'town' || k === 'v') continue;
    const v = save[k];
    const ok = k === 'event' ? typeof v === 'string' || v === null
      : k === 'buildings' ? Array.isArray(v)
      : kind(v) === kind(def);
    if (ok) s[k] = v;
  }
  return s;
}
