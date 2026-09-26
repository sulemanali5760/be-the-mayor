# Be the Mayor: master plan

Owned by the director. Every lane reads it before its brief. Grounded in [research/REAL-WORLD.md](research/REAL-WORLD.md) (how life, city problems and elections really work) and [research/GAMES.md](research/GAMES.md) (how 18 comparable games keep people playing). The lessons from our last game are in [LESSONS.md](LESSONS.md), especially D1.

## Vision

**Start as a nobody with a day job and end up president, by getting better yourself and fixing real problems for real (named) people.** Every player runs their own town and can visit everyone else's.

## Mission

Make the climb from labourer to president feel **real** and **never boring**:
- real jobs, pay, problems and elections, from research;
- a choice, a person or a surprise every minute or two.

## Pillars (every feature must serve at least one)

1. **Real life, lightly told.** Jobs, pay steps (+30–60% per qualification), citizen problems (illegal dumping, potholes, street lights, noise, water shortages) and election steps come from real data. It's funny and warm, never a lecture.
2. **Choices over repetition** (LESSONS D1). Every action is a trade-off between money, reputation, skill, time and groups, with its effect shown before you commit. First-person tasks last 20–90 s, with one twist each.
3. **Named people.** Every job, problem and event comes from someone with a name, a face and a line, and they remember what you did.
4. **You can see it.** What you build or fix appears in your town, labelled with who it was for. The town visibly changes from grey and run-down to alive.
5. **Always a next goal.** The career ladder is always on screen, with the next rank's checklist. Money always has somewhere to go.
6. **Other towns are real.** Visiting other players' towns shows where you're heading and lets you help, like and sign. Everything is positive-only.

## The career ladder (from REAL-WORLD §8.1, compressed into play time)

| Rank | Title | New verbs and layers | Real-world anchor | Target play time |
|---|---|---|---|---|
| 0 | **Labourer** | job board (2 named offers), first-person tasks, energy per day | Day labourer, café, delivery | start |
| 1 | **Skilled** | a trade (electrician, mason or plumber), a computer, better jobs, fix problems yourself in first person | Ausbildung or certificate, +30–60% pay | 15 min – 1 h |
| 2 | **Community helper** | the problem board, 4–6 citizen groups with moods, help requests, volunteering | associations, initiatives | day 1–2 |
| 3 | **Councillor** | by-election (signatures, canvassing, a speech), 1 council vote per session, allies and a rival | honorary council | day 3–5 |
| 4 | **Mayor** | town budget (REAL-WORLD §8.3), 4–6 policy levers, rule-of-the-day permit desk, build and upgrade town buildings, re-election | direct election, 5–8 year term | day 7–10 |
| 5 | **Governor / Minister** | several towns; inspecting other players' towns becomes part of the job; regional crises | state office, parliament | day 14–21 |
| 6 | **President** | national crises as card chains, a legacy card, a seasonal title across all towns | Adenauer, Brandt, Scholz, Cleveland, Jokowi all started in a city | day 30–45 |

- Losing an election costs time, not your town, and it makes a funny newspaper story.
- **Old verbs get upgraded, not repeated:**
  - a labourer lays a wall;
  - a skilled worker fixes a street light;
  - a mayor approves the project and cuts the ribbon.

## Core loops (from GAMES §5.2)

- **1 minute:** tap something on the map (a job, a problem or a person) → preview the costs and effects → do it (a 20–90 s first-person task, a 5 s card or a 2 s tap) → the result appears in the town and a named person reacts.
- **10 minutes (one session):**
  1. the newspaper ("while you were away": likes, visits, consequences);
  2. spend today's energy on 3–5 actions;
  3. one surprise event;
  4. put money into a self-upgrade or a town fix;
  5. visit 1–2 towns;
  6. end on a hook (a course finishing, an election countdown, a neighbour's request).
- **Many days:** the career ladder above. Timers are minutes to a few hours, **never days, and never paid skips**.

## Two views, one world

- **Town view:** top-down 3D in the style of Hay Day and Clash of Clans. The hub: tap buildings, people's speech bubbles, the job board and the problem board. Small tactile actions (tap to collect, drag to assign) happen right there.
- **First person:** the close-up tasks, like Brick by Brick. Build a garden wall, fix a street light's wiring, patch a pothole, clear a dumping pile, knock on doors, and later give speeches.
- **Cadence rule:** at most about 1 min of first person per 2–3 min of town or card play.
- **Mastery rule:** after 3 stars on a task, you can **delegate it** for about 70% pay, because your time is worth more higher up the ladder.

## Setting and tone

- A small, fictional, run-down town the player names (suggestion: "Brookfield"). It has a broken bridge, a leaky bus stop and a mayor nobody likes.
- The currency is € with German-anchored numbers (REAL-WORLD). Events borrow problems from Germany, the US and Pakistan/India so they feel universal.
- **Humour and drama in every card**, BitLife-style. Parties and politicians are fictional. Dignity for citizens in need (tone rule carried over from Brick by Brick).

## Multiplayer (async from day one; GAMES §2)

- **Snapshots:** your town uploads a read-only snapshot when a session ends. Visitors never change your town.
- **Interactions are positive-only and preset:** a like, a sign from a fixed phrase list, and a help stamp on one of your posted problems. There's no free text except player and town names, which go through a word filter and have a report button. No DMs.
- **Cheat containment:** single-player progress stays local. Likes, help and visits are counted **on the server** and written by the giver, with daily caps. Snapshots get plausibility checks and rate limits. Leaderboards rank only server-counted things.
- **Stack:** Supabase (free tier): anonymous sign-in, Postgres with row-level security, and RPC functions for likes and help. The owner creates the project and gives us the public URL and anon key. **Service keys never go in the repo or the client.**

## Tech

- **Three.js** for both views; we reuse Brick by Brick's first-person rig, loaders and our own models. The GitHub Pages frontend is plain ES modules; there's no build step.
- **Engine-free rules** in `js/rules/` (pure functions, tested in CI) and content in `data/*.json` (jobs, problems, events, people, ranks). **Content is data**, so writers add jobs and events without touching code.
- **Files are split by lane from day one:** `js/rules/`, `js/world/`, `js/ui/`, `js/net/`, `supabase/`, `data/`, `qa/`. This avoids the Brick by Brick `game.js` hotspot.
- **CI:**
  - `rules`: node tests plus a balance bot per rank;
  - `qa`: Playwright headless, 3 screen sizes;
  - `assets`: the glTF validator;
  - `db`: Supabase local running on the Actions runner, with RLS policy tests.

## Not doing (evidence in GAMES §5.4)

- PvP raids
- paid skips or energy you can buy
- multi-day timers
- free-text chat
- gift spam
- teaching every system up front
- one verb repeated more than once or twice per session

## How we build

- The studio process ([STUDIO.md](STUDIO.md)): director plus at most 3 lanes, contract first, CI as the gate.
- One milestone at a time ([ROADMAP.md](ROADMAP.md)), one build plan per milestone in `docs/builds/`.
