// Be the Mayor: the rules of a life. Pure JS: no DOM, no Three.js. Contract: docs/builds/01-first-15.md §3.1.
// Time is always `now` = seconds of play from main.js's game clock (LESSONS T6). Nothing here reads real time.
import { migrate, cleanAvatar } from './save.js';

// `content` = { [name]: parsed data/<name>.json } for each of these
export const CONTENT = ['jobs', 'people', 'problems', 'events', 'upgrades', 'ranks', 'signs', 'town', 'wardrobe'];

const STAR_PAY = [0.5, 0.75, 0.9, 1]; // share of the offered pay, by stars
const QUICK_PAY = 0.8;                // quick shift: no first-person task, no stars
const SLOTS = 3;                      // action slots per day (contract change 4)
const NO_SLOTS = 'No time left today. Sleep first.';
const MAX_PROBLEMS = 2;               // open problem cards at once
const PROBLEM_GAP = 90;               // play seconds between new problems
const EVENT_GAP = [150, 270];         // play seconds between surprise events (min, max)

export function createLife(content, save, rand = Math.random) {
  const s = migrate(save);
  const find = (list, id) => list.find(x => x.id === id);

  // content changes between versions must never break an old save
  s.buildings ??= [];
  for (const b of content.town.buildings) { // places follow the layout (roads fit them); state and label are the player's
    const have = find(s.buildings, b.id);
    if (have) Object.assign(have, { type: b.type, x: b.x, z: b.z, rot: b.rot });
    else s.buildings.push({ ...b });
  }
  const extras = content.wardrobe.extras;
  s.avatar.owned = s.avatar.owned.filter(id => find(extras, id));
  if (!s.avatar.owned.includes(s.avatar.extra)) s.avatar.extra = null;
  s.offers = s.offers.filter(o => find(content.jobs, o.job));
  s.problems = s.problems.filter(id => find(content.problems, id));
  if (s.event && !find(content.events, s.event)) s.event = null;
  if (!content.ranks.some(r => r.rank === s.rank)) s.rank = 0;
  for (const [id, run] of Object.entries(s.upgrades)) { // timer-era saves: a running course restarts at evening 0
    if (!run || typeof run !== 'object') { delete s.upgrades[id]; continue; }
    run.studied ??= 0;
    run.told ??= !!run.done;
    delete run.endsAt;
    const u = find(content.upgrades, id);
    if (u && !run.done && u.kind !== 'course') finish(id); // a bought thing that was "on its way"
  }

  const fmt = t => t && t.replaceAll('{town}', s.town).replaceAll('{name}', s.name);
  const has = skill => !skill || (s.skills[skill] ?? 0) > 0;
  const pick = list => list[Math.floor(rand() * list.length)];
  const rankOf = n => content.ranks.find(r => r.rank === n);
  const needName = skill => content.upgrades.find(u => u.gives === skill)?.title ?? skill;
  const fail = msg => ({ ok: false, msg, effects: {}, news: [] });

  function apply(e) {
    s.money = Math.max(0, s.money + (e.money ?? 0));
    s.rep = Math.max(0, s.rep + (e.rep ?? 0));
    s.slots = Math.max(0, s.slots + (e.energy ?? 0)); // effects.energy = action slots used
    for (const [k, n] of Object.entries(e.skill ?? {})) s.skills[k] = (s.skills[k] ?? 0) + n;
    const b = e.fix && find(s.buildings, e.fix);
    if (b) {
      b.state = 'ok';
      if (e.label) b.label = e.label;
    }
  }

  // ---- job board ----
  const eligible = j => (j.rank ?? 0) <= s.rank && s.rank <= (j.maxRank ?? Infinity)
    && has(j.needs) && !(j.once && s.jobs.includes(j.id));

  function makeOffer(j) {
    const fresh = j.twists.filter(t => t.id !== s.lastTwist[j.task]);
    const t = pick(fresh.length ? fresh : j.twists);
    s.seq += 1;
    return {
      id: `${j.id}-${s.seq}`, job: j.id, who: j.who, title: fmt(j.title), pay: j.pay,
      energy: j.energy ?? 1, task: j.task, twist: t.text, params: { ...j.params, twist: t.id },
    };
  }

  function fillBoard() {
    const last = s.jobs.at(-1);
    while (s.offers.length < 2) {
      const pool = content.jobs.filter(j => eligible(j) && !s.offers.some(o => o.job === j.id));
      const kinds = s.offers.map(o => o.task);
      const unlocked = pool.filter(j => j.needs && !s.jobs.includes(j.id));
      const tiers = [
        unlocked.filter(j => !kinds.includes(j.task)),       // new work an upgrade just opened
        unlocked,
        pool.filter(j => j.start && !s.jobs.includes(j.id)), // the story's first jobs
        pool.filter(j => !kinds.includes(j.task) && j.id !== last), // otherwise a different verb
        pool.filter(j => j.id !== last),
        pool,
      ];
      const j = pick(tiers.find(t => t.length) ?? []);
      if (!j) break;
      s.offers.push(makeOffer(j));
    }
    // quick shift (contract change 2): a kind you've done with 2+ stars can be done off-screen for 80 %
    for (const o of s.offers) o.quick = (s.best[o.task] ?? 0) >= 2;
  }
  fillBoard();

  // ---- cards ----
  const card = c => ({
    id: c.id, who: c.who, title: fmt(c.title), text: fmt(c.text), at: c.at ?? null,
    options: c.options.map(o => ({ id: o.id, label: fmt(o.label), effects: o.effects, needs: o.needs ?? null,
      later: !!o.later, help: !!o.help })),
  });

  function finish(id) { // an upgrade is yours: its skill now, its toast and new work on the next tick
    const u = find(content.upgrades, id);
    s.upgrades[id] = { studied: u.evenings ?? 0, done: true, told: false };
    if (u.gives) apply({ skill: { [u.gives]: 1 } });
  }

  function checklist(r) {
    return (r.checklist ?? []).map(c => ({
      label: fmt(c.label),
      done: c.type === 'rep' ? s.rep >= c.n
        : c.type === 'jobs' ? s.jobs.length >= c.n
        : c.type === 'upgrade' ? c.ids.some(id => s.upgrades[id]?.done)
        : false, // 'locked': arrives in a later build
    }));
  }

  function upgrades() {
    return content.upgrades.map(u => {
      const run = s.upgrades[u.id];
      const status = run ? (run.done ? 'done' : 'running')
        : s.rank >= (u.rank ?? 0) && has(u.needs) ? 'available' : 'locked';
      return {
        id: u.id, who: u.who, title: u.title, text: fmt(u.text), cost: u.cost, kind: u.kind,
        evenings: u.evenings ?? null, studied: run?.studied ?? 0,
        needs: u.needs ?? null, rank: u.rank ?? 0, status, repeat: !!u.repeat,
      };
    });
  }

  return {
    state: s,

    offers: () => s.offers,
    problems: () => s.problems.map(id => card(find(content.problems, id))),
    pendingEvent: () => (s.event ? card(find(content.events, s.event)) : null),
    upgrades,

    ladder() {
      const next = rankOf(s.rank + 1);
      return {
        rank: s.rank,
        title: rankOf(s.rank).title,
        all: content.ranks.map(r => ({ rank: r.rank, title: r.title })),
        next: next ? { rank: next.rank, title: next.title, locked: !!next.locked, checklist: checklist(next) } : null,
      };
    },

    doJob(offerId, result, now) {
      const o = find(s.offers, offerId);
      if (!o) return fail('That job is gone.');
      if (s.slots < o.energy) return fail(NO_SLOTS);
      const j = find(content.jobs, o.job);
      const quick = !!result?.quick;
      if (quick && !o.quick) return fail('Do this kind of job in person first.');
      const stars = Math.max(0, Math.min(3, Math.round(result?.stars ?? 0)));
      const effects = quick
        ? { money: Math.round(o.pay * QUICK_PAY), rep: j.rep ?? 0, energy: -o.energy }
        : {
          money: Math.round(o.pay * STAR_PAY[stars]),
          rep: (j.rep ?? 0) + (stars === 3 ? 1 : 0),
          energy: -o.energy,
          skill: { [o.task]: stars },
        };
      if (j.fix) Object.assign(effects, { fix: j.fix, label: j.label });
      apply(effects);
      s.jobs.push(j.id);
      if (!quick) {
        s.lastTwist[o.task] = o.params.twist;
        s.best[o.task] = Math.max(s.best[o.task] ?? 0, stars);
      }
      s.offers = s.offers.filter(x => x !== o);
      fillBoard();
      if (j.headline) s.headlines.push(fmt(j.headline));
      return { ok: true, effects, news: j.says ? [fmt(j.says)] : [] };
    },

    choose(cardId, optionId, now) {
      const isEvent = s.event === cardId;
      const c = isEvent ? find(content.events, cardId)
        : s.problems.includes(cardId) ? find(content.problems, cardId) : null;
      if (!c) return fail('That card is gone.');
      const o = find(c.options, optionId);
      if (!o) return fail('No such choice.');
      if (!has(o.needs)) return fail(`Needs ${needName(o.needs)} first.`);
      if (s.money + (o.effects.money ?? 0) < 0) return fail('Not enough money.');
      if (s.slots + (o.effects.energy ?? 0) < 0) return fail(NO_SLOTS);
      apply(o.effects);
      if (o.later) {
        s.later.push({ at: now + o.later.after, who: o.later.who ?? c.who, text: o.later.text,
          effects: o.later.effects ?? {}, headline: o.later.headline ?? null });
      }
      if (isEvent) {
        s.event = null;
        s.nextEventAt = Math.round(now + EVENT_GAP[0] + rand() * (EVENT_GAP[1] - EVENT_GAP[0]));
      } else {
        s.problems = s.problems.filter(id => id !== cardId);
      }
      if (o.headline) s.headlines.push(fmt(o.headline));
      return { ok: true, effects: o.effects, news: o.says ? [fmt(o.says)] : [] };
    },

    startUpgrade(id, now) {
      const u = upgrades().find(x => x.id === id);
      if (!u) return { ok: false, msg: 'No such upgrade.' };
      if (u.status === 'locked') {
        return { ok: false, msg: has(u.needs) ? `Unlocks at ${rankOf(u.rank).title}.` : `Needs ${needName(u.needs)} first.` };
      }
      if (u.status !== 'available') return { ok: false, msg: 'Already yours.' };
      if (s.money < u.cost) return { ok: false, msg: 'Not enough money.' };
      s.money -= u.cost;
      const c = find(content.upgrades, id);
      if (c.repeat) { // a standing money destination (GAMES §4.12): pays out at once and stays available
        apply(c.effects ?? {});
        return { ok: true, msg: fmt(c.says) };
      }
      if (c.kind === 'course') s.upgrades[id] = { studied: 0, done: false, told: false };
      else finish(id);
      return { ok: true };
    },

    // one evening of a course: uses a slot, at most one evening a day
    study(id, now) {
      const u = find(content.upgrades, id);
      const run = s.upgrades[id];
      if (!u || u.kind !== 'course' || !run) return { ok: false, msg: 'Enrol first.' };
      if (run.done) return { ok: false, msg: 'Already yours.' };
      if (s.studiedDay === s.day) return { ok: false, msg: "You've studied tonight already. Sleep first." };
      if (s.slots < 1) return { ok: false, msg: NO_SLOTS };
      s.slots -= 1;
      s.studiedDay = s.day;
      run.studied += 1;
      if (run.studied >= u.evenings) {
        finish(id);
        return { ok: true, done: true };
      }
      return { ok: true, done: false, msg: `Evening ${run.studied} of ${u.evenings} done.` };
    },

    tick(now) {
      const out = [];
      let board = false;

      for (const [id, run] of Object.entries(s.upgrades)) {
        if (!run.done || run.told) continue;
        run.told = true;
        const u = find(content.upgrades, id);
        out.push({ type: 'upgradeDone', id, title: u?.title ?? id, text: fmt(u?.says) ?? null });
        if (u?.gives && content.jobs.some(j => j.needs === u.gives && eligible(j))) {
          s.offers.pop(); // make room for the work this upgrade opens
          board = true;
        }
      }

      s.later = s.later.filter(c => {
        if (c.at > now) return true;
        apply(c.effects);
        if (c.headline) s.headlines.push(fmt(c.headline));
        out.push({ type: 'consequence', who: c.who, text: fmt(c.text), effects: c.effects });
        return false;
      });

      const next = rankOf(s.rank + 1);
      if (next && !next.locked && checklist(next).every(c => c.done)) {
        s.rank = next.rank;
        out.push({ type: 'promotion', rank: next.rank, title: next.title, text: fmt(next.card) });
        if (next.hook) out.push({ type: 'hook', text: fmt(next.hook) });
        if (next.headline) s.headlines.push(fmt(next.headline));
        s.offers = [];
        board = true;
      }

      if (board) {
        fillBoard();
        out.push({ type: 'newOffers', offers: s.offers });
      }

      if (s.problems.length < MAX_PROBLEMS && now >= s.nextProblemAt) {
        const p = content.problems.find(p => !s.seen.includes(p.id) && (p.after ?? 0) <= now && (p.rank ?? 0) <= s.rank);
        if (p) {
          s.problems.push(p.id);
          s.seen.push(p.id);
          s.nextProblemAt = now + PROBLEM_GAP;
        }
      }

      if (!s.event && now >= s.nextEventAt) {
        const ok = content.events.filter(e => !s.seen.includes(e.id) && (e.after ?? 0) <= now
          && (e.rank ?? 0) <= s.rank && has(e.needs)
          && (!e.requires || find(s.buildings, e.requires)?.state === 'ok'));
        if (ok.length) {
          s.event = pick(ok).id;
          s.seen.push(s.event);
        }
      }
      return out;
    },

    // ---- the wardrobe (build 0.2): extras are a money sink; buying one costs no slot and wears it at once ----
    wardrobe: () => extras.map(x => ({ id: x.id, who: x.who, title: x.title, cost: x.cost,
      owned: s.avatar.owned.includes(x.id), worn: s.avatar.extra === x.id })),

    buyExtra(id) {
      const x = find(extras, id);
      if (!x) return fail('No such thing.');
      if (s.avatar.owned.includes(id)) return fail('Already yours.');
      if (s.money < x.cost) return fail('Not enough money.');
      s.money -= x.cost;
      s.avatar.owned.push(id);
      s.avatar.extra = id;
      return { ok: true, msg: fmt(x.says), effects: { money: -x.cost }, news: [] };
    },

    wear(id) { // null takes the extra off
      if (id !== null && !s.avatar.owned.includes(id)) return fail('Buy it first.');
      s.avatar.extra = id;
      return { ok: true };
    },

    setLook(look) { // the character creator: skin, hair and face; extras stay
      s.avatar = { ...cleanAvatar({ ...s.avatar, ...look }), extra: s.avatar.extra, owned: s.avatar.owned };
      return { ok: true };
    },

    endDay(now) {
      s.day += 1;
      s.slots = SLOTS;
      s.offers = [];
      fillBoard();
      const news = s.headlines.length ? s.headlines : [`A quiet day in ${s.town}. Dieter Mahlke complained anyway.`];
      s.headlines = [];
      return { day: s.day, news };
    },

    snapshot: () => ({
      v: 1, town: s.town, mayor: s.name, rank: s.rank, title: rankOf(s.rank).title, day: s.day,
      buildings: s.buildings.map(({ id, type, x, z, rot, state, label }) => ({ id, type, x, z, rot, state, label: label ?? null })),
      posted: s.problems.map(id => ({ id, title: fmt(find(content.problems, id).title) })),
      avatar: { skin: s.avatar.skin, hair: s.avatar.hair, face: s.avatar.face, extra: s.avatar.extra, rank: s.rank }, // what world.setAvatar takes
    }),
  };
}
