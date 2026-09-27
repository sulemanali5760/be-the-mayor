# Game design: systems (build 0.1)

Owner: Lane S. The rules live in `js/rules/life.js` (contract: [builds/01-first-15.md](builds/01-first-15.md) §3.1); all content lives in `data/*.json`. Numbers here are checked by the `rules` CI (`js/rules/*.test.mjs`).

## Resources

| Resource | Start | Earned by | Spent on |
|---|---|---|---|
| Money (€) | 0 | jobs, some choices | upgrades, fixes, some choices |
| Reputation | 0 | jobs (3 stars +1), most kind choices | selfish choices, late consequences |
| Slots (`state.slots`) | 3 per day | refilled by sleeping (`endDay`, early sleep allowed) | 1 per job (first person or quick), 1 per evening of study, 1 per Help option or card option with an energy cost |
| Skills | none | stars per verb (`wall`, `delivery`), courses and tools | unlock jobs and choice options (`needs`) |

## Jobs

- The board always holds **2 named offers**. Priority: work a new tool or course just opened → the two story jobs (Frau Keller's wall, Café Lindner's cakes) → a **different verb** from the other offer → anything but the last job.
- Pay by stars: 0★ 50 %, 1★ 75 %, 2★ 90 %, 3★ 100 %. Labourer jobs pay €35–60, Skilled jobs €60–75 (about +45 %, REAL-WORLD §2.2: +30–60 % per qualification).
- Every job has 2+ twists, and the next job of the same verb never repeats the last twist (LESSONS D1).
- **Quick shift** (contract change 2, LESSONS D1): once you have done a kind (wall or delivery) in first person with 2+ stars, later offers of that kind can be done off-screen for 80 % pay, with no stars and no skill progress. A first-person task is a choice, not a chore.
- Some jobs fix a building (`fix`), which turns it from grey to colour with a label, e.g. "Keller's wall – built by you".
- The town (`data/town.json`, 15 buildings) is laid out on the footprints table in ASSETS.md; a rules test keeps every footprint at least 1 m apart. Wall twists are the ones the world plays: `rain`, `cracked`, `hurry` (the wall is always 11 bricks).

## Cards

- **Problems** (REAL-WORLD §8.2: leaking bus stop, dumped sofa, street light, swing, drain, potholes, noise, rats, graffiti, no heating): one every 90 s of play, at most 2 open, each posted at a building. Hands-on options are marked `help`; each shows `energy: -1` (one slot).
- **Events** (GAMES §4.6: about one per 2.5–4.5 min, from 4:00): 15 cards; 6 carry a `later` consequence that returns 2–6 min later and makes the newspaper.
- Every option shows its effects before you choose. Rules checked in CI: no option is best on every effect (money, reputation, energy, skill, fix, counting later effects); every event has a free option; no problem is skill-locked on every option.

## Upgrades (change what you do, LESSONS D3)

| Upgrade | € | Kind | Opens |
|---|---|---|---|
| Rusty cargo bike | 40 | buy | bigger delivery jobs |
| Proper trowel set | 35 | buy | bigger building jobs |
| Second-hand computer | 60 | buy | online courses, online options on cards |
| Night school: electrician | 120 | course, 4 evenings | trade (electric) → Skilled jobs, fix the street light yourself |
| Online course: plumbing | 50 | course, 4 evenings | trade (plumbing) → Skilled jobs, fix drains and heating yourself |
| Driving lessons | 150 | course, 3 evenings | van work |
| Toolkits, suit, Meister prep (Skilled) | 80–250 | buy; Meister prep a 6-evening course | lighting and heating jobs; the by-election; the next ladder step |
| Bridge fund (Jens Voss's tin) | 20 | buy, repeatable | +1 Reputation, **repeatable**: the standing money destination (GAMES §4.12), the seed of the 0.2 campaign fund |

There are no real-time timers (contract change 4). A `buy` is yours at once; a `course` is enrolled, then `study` adds one evening, at most one a day, using a slot. Problems, events and later consequences are still scheduled on the play clock. Without the bridge fund the bot had money with nowhere to go in 124 of 200 runs: any finite shop runs dry once the cheap items are bought.

## Ladder

Labourer → **Skilled** needs a finished trade course, Reputation 15 and 4 jobs. The promotion card is followed by the hook: *Council by-election in 3 days: Reputation 100 and 2 group endorsements.* Ranks 2–6 are listed but locked until 0.2+.

## Balance (balance bot, 200 runs)

The bot plays 20 minutes with random-but-sane choices at a new player's pace (board 20 s, quick shift 20 s, study 15 s, card 15 s, buy 15 s, sleep and newspaper 30 s, plus each first-person task's own seconds). It saves for one trade course (night school, or computer + online plumbing), studies one evening every day it is enrolled, buys other upgrades now and then, takes 60 % of open problems, answers every event, visits one town after 9:00, scores 1–3 stars, and takes the quick shift whenever it is offered. Targets: median Skilled in **12–18 min**; at most 12 jobs before Skilled (median); at least 2 slot action types per day on average; at most 2 first-person tasks per kind before Skilled (in 95 % of runs: two 1-star tries in a row force a third); money always has a destination (an upgrade or paid fix within the two jobs on the board). The latest table is in the `rules` run's step summary.

## Look and feel (build 0.2)

Owner: Lane G. Contract: [builds/02-look-and-feel.md](builds/02-look-and-feel.md) §3.3.

- **The avatar:** `state.avatar = { skin, hair, face, extra, owned }`. Skin, hair and face are indices into `data/wardrobe.json` `looks`, which follow the manifest's character order (6 skins; hairs short, long, bun, curly, none; faces smile, grin, calm). The outfit is never saved: it follows the rank. 0.1 saves get the default look and can change it in the Wardrobe tab ("Change your look"). The snapshot carries `avatar: { skin, hair, face, extra, rank }`, so visitors see you.
- **The character creator** is on the first card: one tap each for skin, hair and face, with defaults set.
- **Wardrobe** (Learn sheet, Wardrobe tab): the character's 6 extras (contract change 1), each from a named person, €15–60 (flower, beanie, cap, scarf, sunglasses, bow tie). Buying one is instant, costs no slot and wears it at once; extras are a money sink with no other effect. The balance bot never buys them, so the 0.1 balance numbers hold.
- **The town layout** (`data/town.json`): `buildings` (unchanged ids; the yard moved 1 m north to clear the road), `roads` (one loop, drawn 5 m wide), `paths` (drawn 2 m wide: a spur to every building's front, the bridge path), `props` (34: trees, benches, lamps, flowers, bins, fences), and `homes` and `work` for 12 named people (`{ personId: buildingId }`; the world sends them home at night). Every junction is a shared vertex. Old saves take the layout's places and keep their own states and labels. The curated towns use the same building ids and places, so every town shares one layout. `rules` checks that roads stay 2.5 m clear of every footprint, paths never cross a solid building, props stand off both, the graph is connected and every building has a node within 6 m.
- **Time of day:** 3/2/1/0 slots left → 0, 0.3, 0.55, 0.75. Sleeping is night (1) until the newspaper is read, then morning (0).
- **The walk:** before a first-person task or a problem card, the avatar walks to its building: at most 3 s of game time, and a tap skips it. Quick shifts and events don't walk.
- **Celebrations:** a fix, a promotion and a like each call `world.celebrate`.
- **Speaker names:** a result's line is shown as written. Lines either name their speaker ("Frau Keller: “…”") or are narration, so the UI no longer adds the name (the 0.1 doubled-name bug).
