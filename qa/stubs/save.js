// CI-only stand-in for Lane S's js/rules/save.js, copied in by qa.yml only while the real file is missing.
export const newSave = (name, townName) => ({ v: 1, name, townName, money: 0, rep: 0, energy: 3, maxEnergy: 3, day: 1, jobs: 0, rank: 0 });
export const migrate = s => ({ ...newSave(s.name, s.townName), ...s });
