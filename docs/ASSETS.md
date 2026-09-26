# Assets (Lane W)

All models are ours, in metres at real-world scale, self-contained `.gltf` with one embedded buffer (LESSONS H1). `wall.js` turns each into a GLB in memory, because a strict CSP can refuse `data:` fetches. Every push that touches `assets/` or `js/world/` runs the `assets` workflow:
- the Khronos glTF validator on every model;
- one embedded buffer per model;
- the triangle budget below;
- `js/world/rules.test.mjs`;
- a syntax check of every `js/world/*.js`;
- `tools/smoke_world.mjs`: the real world in headless Chrome. It pans, zooms, pinches, taps and focuses the town, then plays both tasks with pointer input (the closed road, a detour, the wall with rain) and fails on any page error. `smoke-town.png` is kept as a run artifact.

## Triangle budget (the CI enforces the model rows)

| What | Budget | Now |
|---|---|---|
| One model file | ≤ 5,000 | 4,264 max (`fp_arms`) |
| All model files | ≤ 15,000 | 9,952 |
| Town view, about 12 buildings | ≤ 5,000 | about 2,000 |
| Delivery overlay (van, stops, barrier, route dots) | ≤ 3,000 | about 700 + 6 per queued metre (400 m max) |
| Wall scene (models, pallet stack, wall, garden) | ≤ 20,000 | about 13,000 |

## Models (copied from Brick by Brick, made by its `blender/make_assets.py`)

Used by the first-person wall only. The town is built in code (see below), so `createWorld` loads nothing.

| File | What | Tris | Notes |
|---|---|---|---|
| `brick_nf.gltf` | NF brick 240 × 115 × 71 mm | 108 | procedural clay texture |
| `brick_half.gltf` | half brick 115 × 115 × 71 mm | 108 | closes the second course (stretcher bond) |
| `trowel.gltf` | brick trowel | 156 | origin = handle grip |
| `fp_arms.gltf` | first-person forearms, `ArmL` and `ArmR` | 4,264 | origin = elbow, hand points +Y |
| `mortar_tub.gltf` | mortar tub, half full | 2,732 | |
| `pallet_euro.gltf` | EPAL pallet 1200 × 800 × 144 mm | 2,160 | |
| `line_pin.gltf` | steel line pin | 76 | origin = tip; the string is drawn in code |
| `spirit_level.gltf` | 600 mm spirit level | 348 | |

If a model fails to load, the wall uses a coloured box instead and logs a warning, so the task still runs.

## Town buildings (code-built in `js/world/buildings.js`)

Each building is centred on its `x, z`, with its front towards +z; `rot` is in degrees. Broken ones are grey, with rubble; ok ones are in colour, with their `label`. **Keep footprints apart when laying out a town**: the numbers below are in metres. Solid buildings block the delivery van, with a 1 m margin.

| `type` | Footprint w × d | Height | Solid | Tris | Broken vs ok |
|---|---|---|---|---|---|
| `house` | 6 × 5 | 5.2 | yes | 68 | grey |
| `garden` | 7 × 5 | 1.2 | no | 120 | loose bricks vs the finished wall |
| `cafe`, `shop` | 7 × 5 | 4.2 | yes | 164 | grey |
| `busstop` | 3.6 × 1.6 | 2.8 | yes | 104 | the roof hangs askew |
| `bridge` | 4 × 12 (stream 36 wide) | 1.6 | no | 72 | a gap in the deck |
| `townhall` | 12 × 8 | 11 | yes | 324 | grey |
| `school` | 12 × 6 | 8 | yes | 152 | grey |
| `park` | 12 × 10 | 3.5 | no | 288 | the fountain is dry |
| `playground` | 8 × 8 | 3 | no | 136 | the swings are gone |
| `statue` | 2 × 2 | 4.2 | yes | 44 | grey |
| `streetlight` | 0.6 × 0.6 | 4.8 | no | 44 | unlit |
| `tree` | 2 × 2 | 3.8 | no | 40 | |

Type names are forgiving: `bus_stop`, `Bus-Stop` and `stop` all mean `busstop`, and `hall` means `townhall`. An unknown type draws a house.

## Task parameters and twists

`world.playTask(kind, params)`: main.js passes `{ ...offer.params, twist: offer.twist }`. The twist may be a string or `{ id, label }`; it's matched case-insensitively, ignoring spaces and punctuation.

| Task | Params | Twists |
|---|---|---|
| `wall` | `title?` | `rain` (the mortar goes off in 12 s instead of 30), `cracked` (one brick is cracked: swap it or cap at 2 stars), `hurry` (3 stars need 35 s instead of 45) |
| `delivery` | `stops?` (a count of 3–4, or a list of building ids), `from?` (the start building, default the café), `title?` | `closed road` (a barrier across the longest leg) |

- **Wall:** 11 bricks in 2 courses. Tap to lay a brick, then tap the high end or hold to knock until it's level.
  - The mortar sets a proud brick for you, and a brick knocked too low is re-bedded.
  - At 90 s the foreman lays the rest, so every wall finishes with at least 1 star.
- **Delivery:** drag from the van to draw its route. The van follows it at 14 m/s and stops at walls and the barrier.
  - A stop counts within 2.5 m of the building.
  - Stars: all stops, a route within 1.4 × the shortest tour, and done in 27 s or less gives 3 stars.
  - It ends when every stop is done or at 45 s.

## QA hooks: `window.__btmWorld`

| Hook | Does |
|---|---|
| `tap(id)` | fires `onPick({ id })` as if the building were tapped; returns false for an unknown id |
| `finish(stars)` | ends the running task at once with 0–3 stars; `seconds` is the game time so far (≤ 90) |
| `task()` | the running task's state or null. The wall gives `{ kind, twist, t, next, aim, laid, total, hand, setting }`, where `aim` is the current brick in canvas px (tap there); the delivery gives `{ kind, twist, t, van, queued, pathLen, best, delivered, total, stops, barrier }` |
| `screen(x, z)` | a ground point in canvas px under the town camera; draw a delivery route through the stops' `x, z` with it |
| `view` | the town camera: `{ x, z, d }` |
| `stats()` | draw calls, triangles, the building count and the world's game time |
| `world` | the world object itself |

Add `?q=low` to the page URL for the software-GL runner: no antialiasing, no shadows, pixel ratio 1.
