# Build 0.1: "First 15 minutes"

Status: in progress (studio build) · base: master plan only · roadmap row 0.1

## 1. Goal

A new player plays the first 15 minutes from [GAMES §5.1](../research/GAMES.md) and ends at rank **Skilled**, having seen:
- 2 job types (a first-person garden wall, a delivery route drawn on the map);
- 3 or more choices with trade-offs, 1 event with a delayed consequence;
- night school, the career ladder, the newspaper;
- 1 visit to another town (like, sign, help);
- a promotion card, and the **council by-election hook**.

Rule D1 (LESSONS): no verb repeats more than twice in these 15 minutes, and no first-person task runs over 90 s.

Out of scope: citizen groups, council, the mayor layer (0.2+), wall-clock timers, captcha (backlog, before 1.0).

## 2. Files and owners (split by lane from day one)

| Path | Owner |
|---|---|
| `js/rules/` (`life.js`, `save.js`, tests `*.test.mjs`), `data/*.json` (except `seed-towns.json`), `.github/workflows/rules.yml`, `docs/GDD.md` | **Lane S** (systems and content) |
| `js/world/` (town view, first-person tasks, loaders), `assets/`, `blender/`, `tools/validate_assets.mjs`, `.github/workflows/assets.yml`, `docs/ASSETS.md` | **Lane W** (the 3D world) |
| `index.html`, `css/`, `js/main.js`, `js/ui/`, `js/net/`, `data/seed-towns.json`, `supabase/`, `qa/`, `.github/workflows/qa.yml` and `db.yml` | **Lane U** (game shell, UI, online) |

The director owns `docs/` except `GDD.md` and `ASSETS.md`, bumps the version, and releases.

## 3. Data contract (all lanes code against this; only the director changes it)

**One clock** (LESSONS T6): `now` = seconds of play from `js/main.js`'s game clock. It only advances while playing. Rules never read real time.

### 3.1 `js/rules/life.js` (Lane S), pure JS with no DOM and no Three.js

```js
createLife(content, save, rand = Math.random) → life
life.state                    // the save object (serialisable), mutated in place
life.offers()                 // 2 job offers: [{ id, job, who, title, pay, energy, task: 'wall'|'delivery', twist, params }]
life.problems()               // open problems: [{ id, who, title, at /* building id */, options: [{ id, label, effects, needs? }] }]
life.pendingEvent()           // event card or null: { id, who, text, options: [{ id, label, effects, later? }] }
life.upgrades()               // [{ id, title, cost, seconds, needs, status: 'locked'|'available'|'running'|'done', endsAt }]
life.ladder()                 // { rank, title, next: { rank, title, checklist: [{ label, done }] } }
life.doJob(offerId, result, now)      // result = { stars: 0-3, seconds } → { ok, msg?, effects, news: [] }
life.choose(cardId, optionId, now)    // problem or event → { ok, msg?, effects, news: [] }
life.startUpgrade(id, now)            // → { ok, msg? }
life.tick(now)                        // → events: [{ type: 'upgradeDone'|'promotion'|'consequence'|'newOffers'|'hook', ... }]
life.endDay(now)                      // sleep: energy refills, day++ → { news: [...] } for the newspaper
life.snapshot()                       // public town snapshot, see 3.4
```

- `effects` = `{ money?, rep?, energy?, skill?: { id: n }, fix?: buildingId, label?: string }`, always shown **before** you choose (pillar 2).
- **Contract change 1 (director, from Lane S):**
  - `upgrades()` items carry `repeat: true|false`. A repeatable upgrade (e.g. `bridge_fund`, €20 → +1 Reputation) is always buyable, never `done`, applies its effect at once, and emits no `upgradeDone`.
  - Any `{ ok: true }` result may carry `msg`, a person's line that the UI shows as a toast.
- **Contract change 3 (director, from Lane W):**
  - Lane W also owns `tools/smoke_world.mjs`, and `wall.js` lives in `js/world/`, not `js/world/fp/`.
  - The QA hooks are `__btmWorld.tap(id)`, `finish(stars)`, `task()` and `screen(x, z)`.
  - The wall is always 11 bricks (`params.bricks` is ignored).
  - `town.json` follows the footprints table in ASSETS.md.
  - `anchors()` covers buildings only; people get positions in 0.2.
- **Contract change 2 (director, rule D1):** QA showed 3 walls and 3 deliveries on the way to Skilled.
  - A **quick shift** fixes it: once you have finished a task kind with **≥ 2 stars**, later offers of that kind carry `quick: true`.
  - `life.doJob(offerId, { quick: true }, now)` pays **80%**, takes no first-person time, and gives no stars or skill-star progress.
  - The UI offers both buttons: "Do it (first person)" and "Quick shift · 80%".
  - The QA bot and the balance bot take the quick shift whenever it's offered. **Target: at most 2 first-person tasks per kind** on the way to Skilled, with Skilled still in 12–18 min.
- `save.js`: `newSave(name, town)`, `migrate(save)`. Old or partial saves always load.

### 3.2 Content (`data/`, Lane S)

- `jobs.json`, `people.json` (named citizens with a one-line personality), `problems.json`, `events.json` (about 15, with humour; at least 2 with `later` consequences), `upgrades.json` (night school → electrician, a second-hand computer, …), `ranks.json` (Labourer → Skilled; later ranks listed but locked).
- `signs.json`: the preset sign phrases, about 20.
- `town.json`: building list `[{ id, type, x, z, rot, state: 'broken'|'ok', label? }]` on a 1 m grid, about 12 buildings: bus stop, café, Frau Keller's house and garden, the bridge, the town hall with the unpopular mayor, a school, a park, …
- Every real-world number comes from `research/REAL-WORLD.md` (pay steps, problem types).

### 3.3 `js/world/` (Lane W)

```js
createWorld(canvas, content) → world
world.showTown(state)          // draw the town from state.town (grey when broken, colour when ok; labels on fixed things)
world.anchors()                // [{ id, x, y, visible }] screen positions of buildings and people, for Lane U's bubbles
world.onPick(fn)               // fn({ id }) when a building or person is tapped
world.focus(id)                // camera flies to it
world.playTask(kind, params)   // → Promise<{ stars, seconds }>; takes over the canvas; kinds: 'wall', 'delivery'
world.frame(dt)                // called by main.js each frame
```

- **Town view:** a top-down 3D camera (Hay Day / Clash of Clans), tap and drag to pan, pinch or wheel to zoom.
- **`wall`:** first person, reusing Brick by Brick's rig, models and bricklaying code (copy what's needed into `js/world/fp/`). **8–12 bricks, ≤ 90 s, nearly impossible to fail the first time**, with one twist from `params.twist` (e.g. rain: mortar sets faster).
- **`delivery`:** in the town view, draw a route through 3–4 stops before the timer runs out (45 s); twist: a closed road.

### 3.4 `js/net/net.js` (Lane U) and the snapshot

```js
snapshot = { v: 1, town, mayor /* player name */, rank, title, day, buildings: [{ id, type, x, z, rot, state, label }], posted: [{ id, title }] }
net.init(config)                  // config null → offline mode, using data/seed-towns.json
net.saveTown(snapshot)            // upsert own row (rate-limited on the server)
net.listTowns({ limit })          // [{ id, town, mayor, title, rank, likes, updatedAt }]
net.getTown(id)                   // { snapshot, likes, signs: [{ phrase }], helps }
net.like(id) / net.sign(id, phraseId) / net.help(id, problemId)
net.inbox(since)                  // { likes, signs, helps } for the newspaper
```

**Supabase rules** (VISION, GAMES §2.3):
- anonymous sign-in;
- `towns` is readable by all; each user writes only their own row;
- likes, signs and helps go only through `security definer` RPCs with a **daily cap of 20 per giver**, no self-likes, and one per town per day;
- a snapshot plausibility check: building count and rank must be possible for the account's age;
- the name word filter; service keys never.

### 3.5 Backend already live (director, 2026-09-26)

- `supabase/migrations/20260926000000_init.sql` has been **applied to the live project** by the owner.
- `js/net/config.js` holds the URL and the public anon key.
- The director ran 16 live security checks, and all behaved as intended:
  - RLS blocks cross-town edits; you can't set your own likes; no self-likes;
  - the once-per-day and 20-per-day caps hold; direct writes to interactions are blocked;
  - the 60 s save limit, the name filter and the rank cap work; signed-out users can't interact.
- **Schema changes = a new migration file** (never edit an applied one). The director hands it to the owner to run in the SQL Editor.

## 4. Lanes

### Lane S: systems and content, branch `feat/0.1-systems`
- Build `life.js`, `save.js` and all content, to the contract.
- Tests: deterministic cases per mechanic, plus a **balance bot** that plays the first 15 minutes with random-but-sane choices.
- Targets:
  - Skilled is reached in **12–18 min** of play time (median of 200 runs);
  - **no problem or event option is best on every effect** (a dominance check);
  - money always has somewhere to go: there's always an affordable upgrade or fix within 2 jobs.
- Writing: warm, funny, BitLife-style; named people; dignity for people in need.

### Lane W: the 3D world, branch `feat/0.1-world`
- Build the town view and both tasks, to the contract.
- Building models: simple, readable low-poly shapes, either our own Blender script or code-built. Reuse Brick by Brick's models from `../brick-by-brick/assets/models/` (our own; copy them).
- Provide `window.__btmWorld` hooks for QA: tap a building, finish a task with a given number of stars.
- The `assets` CI validates the glTFs.

### Lane U: game shell, UI and online, branch `feat/0.1-shell`
- `main.js`: the game clock, save and load (localStorage), the main loop, and the flow of the first 15 minutes.
- UI:
  - job board, problem cards, event cards (effects as icons before choosing);
  - the ladder with its checklist, the newspaper, the upgrade panel;
  - visits (list, read-only town view via `world.showTown(snapshot)`, like, sign, help);
  - a **shareable promotion card** (canvas → PNG download).
- Phone-first layout.
- Online: the Supabase schema and RLS in `supabase/migrations/`; `db.yml` runs a **local Supabase on the Actions runner** with policy tests (a visitor can't write another's town; the cap and self-like rule hold). `js/net/config.js` reads the URL and anon key (null until the owner sends them, which means offline mode).
- QA (`qa/acceptance.mjs`, Playwright, 3 sizes):
  - **B1:** a bot plays from the start to Skilled with no page errors;
  - **B2:** each first-person task ends in ≤ 90 s of game time;
  - **B3:** an offline visit, a like and a sign work;
  - **B4:** the phone layout has no overlaps.

## 5. Acceptance (the director checks these on `main`)

| # | Check |
|---|---|
| B1–B4 | QA green |
| S-balance | Skilled in 12–18 min; the dominance check and money-destination check pass |
| DB | Policy tests green on the runner |
| D1 | The director plays the first 15 minutes on Pages and counts the verbs, choices and new things per minute against GAMES §5.1 |

## 6. Meeting minutes

_(director fills this in when all lanes have reported)_
