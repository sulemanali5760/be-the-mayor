# Game design: systems (build 0.1)

Owner: Lane S. The rules live in `js/rules/life.js` (contract: [builds/01-first-15.md](builds/01-first-15.md) §3.1); all content lives in `data/*.json`. Numbers here are checked by the `rules` CI (`js/rules/*.test.mjs`).

## Resources

| Resource | Start | Earned by | Spent on |
|---|---|---|---|
| Money (€) | 0 | jobs, some choices | upgrades, fixes, some choices |
| Reputation | 0 | jobs (3 stars +1), most kind choices | selfish choices, late consequences |
| Energy | 3 per day | refilled by sleeping (`endDay`) | 1 per job, 1 per hands-on choice |
| Skills | none | stars per verb (`wall`, `delivery`), courses and tools | unlock jobs and choice options (`needs`) |

## Jobs

- The board always holds **2 named offers**. Priority: work a new tool or course just opened → the two story jobs (Frau Keller's wall, Café Lindner's cakes) → a **different verb** from the other offer → anything but the last job.
- Pay by stars: 0★ 50 %, 1★ 75 %, 2★ 90 %, 3★ 100 %. Labourer jobs pay €35–60, Skilled jobs €60–75 (about +45 %, REAL-WORLD §2.2: +30–60 % per qualification).
- Every job has 2+ twists, and the next job of the same verb never repeats the last twist (LESSONS D1).
- **Quick shift** (contract change 2, LESSONS D1): once you have done a kind (wall or delivery) in first person with 2+ stars, later offers of that kind can be done off-screen for 80 % pay, with no stars and no skill progress. A first-person task is a choice, not a chore.
- Some jobs fix a building (`fix`), which turns it from grey to colour with a label, e.g. "Keller's wall – built by you".

## Cards

- **Problems** (REAL-WORLD §8.2: leaking bus stop, dumped sofa, street light, swing, drain, potholes, noise, rats, graffiti, no heating): one every 90 s of play, at most 2 open, each posted at a building.
- **Events** (GAMES §4.6: about one per 2.5–4.5 min, from 4:00): 15 cards; 6 carry a `later` consequence that returns 2–6 min later and makes the newspaper.
- Every option shows its effects before you choose. Rules checked in CI: no option is best on every effect (money, reputation, energy, skill, fix, counting later effects); every event has a free option; no problem is skill-locked on every option.

## Upgrades (change what you do, LESSONS D3)

| Upgrade | € | Time | Opens |
|---|---|---|---|
| Rusty cargo bike | 40 | 15 s | bigger delivery jobs |
| Proper trowel set | 35 | 15 s | bigger building jobs |
| Second-hand computer | 60 | 30 s | online courses, online options on cards |
| Night school: electrician | 120 | 10 min | trade (electric) → Skilled jobs, fix the street light yourself |
| Online course: plumbing | 50 | 10 min | trade (plumbing) → Skilled jobs, fix drains and heating yourself |
| Driving lessons | 150 | 5 min | van work |
| Toolkits, suit, Meister prep (Skilled) | 80–250 | 20 s–10 min | lighting and heating jobs; the by-election; the next ladder step |
| Bridge fund (Jens Voss's tin) | 20 | at once | +1 Reputation, **repeatable**: the standing money destination (GAMES §4.12), the seed of the 0.2 campaign fund |

Course timers run on the game clock, only while playing, never paid skips. Without the bridge fund the bot had money with nowhere to go in 124 of 200 runs: any finite shop runs dry once the cheap items are bought.

## Ladder

Labourer → **Skilled** needs a finished trade course, Reputation 15 and 4 jobs. The promotion card is followed by the hook: *Council by-election in 3 days: Reputation 100 and 2 group endorsements.* Ranks 2–6 are listed but locked until 0.2+.

## Balance (balance bot, 200 runs)

The bot plays 20 minutes with random-but-sane choices: it saves for one trade course (night school, or computer + online plumbing), buys other upgrades now and then, takes 60 % of open problems, answers every event, visits one town after 9:00, scores 1–3 stars, and takes the quick shift whenever it is offered. Targets: median Skilled in **12–18 min**; at most 2 first-person tasks per kind before Skilled (in 95 % of runs: two 1-star tries in a row force a third); money always has a destination (an upgrade or paid fix within the two jobs on the board). The latest table is in the `rules` run's step summary.
