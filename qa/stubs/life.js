// CI-only stand-in for Lane S's js/rules/life.js (contract §3.1), copied in by qa.yml only while the real
// file is missing. Just enough rules to walk the shell from Labourer to Skilled.
export function createLife(content, save) {
  const s = save;
  const checklist = () => [
    { label: 'Do 2 jobs', done: s.jobs >= 2 },
    { label: 'Finish night school', done: !!s.upDone },
    { label: 'Reach 5 reputation', done: s.rep >= 5 },
  ];
  const life = {
    state: s,
    offers: () => [
      { id: 'o' + s.jobs + 'a', job: 'wall', who: 'keller', title: 'Frau Keller needs a garden wall', pay: 40, energy: 1, task: 'wall', twist: 'rain', params: { bricks: 10 } },
      { id: 'o' + s.jobs + 'b', job: 'delivery', who: 'lindner', title: 'Café Lindner needs deliveries', pay: 30, energy: 1, task: 'delivery', twist: 'closed road', params: { stops: 3 } },
    ],
    problems: () => (s.fixed ? [] : [{ id: 'busstop', who: 'mehmet', title: 'Roof leaks, again.', at: 'busstop', options: [
      { id: 'fix', label: 'Fix it (€20)', effects: { money: -20, rep: 5, fix: 'busstop', label: 'Bus stop roof' } },
      { id: 'save', label: 'Save for rent', effects: { money: 0, rep: -1 } }] }]),
    pendingEvent: () => (s.jobs >= 2 && !s.event ? { id: 'boss', who: 'boss', text: 'Your boss asks you to cut corners.', options: [
      { id: 'yes', label: 'Sure, boss', effects: { money: 20 }, later: true }, { id: 'no', label: 'No way', effects: { rep: 2, money: -5 } }] } : null),
    upgrades: () => [{ id: 'night', title: 'Night school: electrician', cost: 30, seconds: 180, needs: [], status: s.upDone ? 'done' : s.upEnds ? 'running' : 'available', endsAt: s.upEnds || 0 }],
    ladder: () => ({ rank: s.rank, title: s.rank ? 'Skilled' : 'Labourer', next: s.rank ? null : { rank: 1, title: 'Skilled', checklist: checklist() } }),
    doJob(id, result) {
      const o = life.offers().find(x => x.id === id);
      if (!o || s.energy < o.energy) return { ok: false, msg: 'Too tired' };
      s.money += o.pay; s.energy -= o.energy; s.jobs++;
      return { ok: true, effects: { money: o.pay, energy: -o.energy }, news: [`${o.title}: done with ${result.stars} stars`] };
    },
    choose(cardId, optionId) {
      if (cardId === 'boss') { s.event = optionId; const e = optionId === 'yes' ? { money: 20 } : { rep: 2, money: -5 }; s.money += e.money || 0; s.rep += e.rep || 0; return { ok: true, effects: e, news: ['The boss nods.'] }; }
      const o = life.problems()[0]?.options.find(x => x.id === optionId);
      if (!o) return { ok: false, msg: 'Gone' };
      if (s.money + (o.effects.money || 0) < 0) return { ok: false, msg: 'Not enough money' };
      s.money += o.effects.money || 0; s.rep += o.effects.rep || 0; s.fixed = true;
      return { ok: true, effects: o.effects, news: ['Mehmet: "Dry at last!"'] };
    },
    startUpgrade(id, now) {
      if (s.upEnds || s.money < 30) return { ok: false, msg: 'Not enough money' };
      s.money -= 30; s.upEnds = now + 180; return { ok: true };
    },
    tick(now) {
      const ev = [];
      if (s.upEnds && !s.upDone && now >= s.upEnds) { s.upDone = true; ev.push({ type: 'upgradeDone', title: 'Night school' }); }
      if (!s.rank && checklist().every(c => c.done)) { s.rank = 1; ev.push({ type: 'promotion', rank: 1, title: 'Skilled' }, { type: 'hook', text: 'Council by-election in 3 days. You need Rep 100 and 2 group endorsements.' }); }
      return ev;
    },
    endDay() { s.day++; s.energy = s.maxEnergy; return { news: [`Day ${s.day} dawns over ${s.townName}`] }; },
    snapshot: () => ({ v: 1, town: s.townName, mayor: s.name, rank: s.rank, title: s.rank ? 'Skilled' : 'Labourer', day: s.day, buildings: [], posted: [] }),
  };
  return life;
}
