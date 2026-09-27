# Assets

Lane A owns the art pipeline (build 0.2 §2); the world notes further down are Lane W's.

All models are in metres at real-world scale, self-contained `.gltf` with one embedded buffer (LESSONS H1), origin at the bottom centre, front towards +z. Every push that touches `assets/` or `js/world/` runs the `assets` workflow:
- the Khronos glTF validator on every model;
- one embedded buffer per model;
- the budgets below;
- `js/world/rules.test.mjs`;
- a syntax check of every `js/world/*.js`;
- `tools/smoke_world.mjs`: the real world in headless Chrome. It pans, zooms, pinches, taps and focuses the town, then plays both tasks with pointer input (the closed road, a detour, the wall with rain) and fails on any page error. `smoke-town.png` is kept as a run artifact.

## Sources (CC0 only)

| Kit | Licence | Page | Download (pinned sha256 in `tools/kits/kits.json`) |
|---|---|---|---|
| KayKit City Builder Bits 1.0 (Kay Lousberg) | CC0 1.0 | https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 | the repo archive at commit `6397691` |
| Kenney City Kit (Suburban) 2.0 | CC0 1.0 | https://kenney.nl/assets/city-kit-suburban | `kenney_city-kit-suburban_20.zip` from kenney.nl |
| Kenney Nature Kit 1.0 | CC0 1.0 | https://kenney.nl/assets/nature-kit | `kenney_nature-kit.zip` from kenney.nl |
| Our own models | ours | `blender/make_own.py` | built on the laptop from procedural geometry |

Researched and not used:
- **Kenney Mini Characters** (CC0): one baked texture per character, so no separate shirt or trousers to recolour for outfits, and accessories could not be fitted without opening the files. Our own character does both.
- **Quaternius Universal Base Characters** (CC0): about 13k triangles each (the budget is 5k), and the download is a button on quaternius.com, not a stable URL.
- **Kenney City Kit (Commercial)**: office towers and skyscrapers, not a small town.

## Pipeline

- **Kits** (`.github/workflows/kits.yml`, on a push to `tools/kits/**`, `blender/**` or the palette): fetch each kit, check its sha256, and run `blender/kits.py` in Blender 4.2 on the runner. Each recipe in `kits.json` is turned so that it faces +z, scaled to metres (`fit`, `len`, `h`), recoloured face by face to the nearest palette colour in CIELAB (vertex colours, one `palette` material, one draw call), and exported. `recolor` maps a logged source colour to a palette key. The workflow then writes `assets/manifest.json` and `docs/art/contact-town.png` and `contact-character.png`, runs the validator and commits the results back. Kit files are opened only on the runner (LESSONS A1).
- **Own models** (`blender/make_own.py`, local Blender, LESSONS A3): signature buildings, the other buildings, broken variants and props, the bird, and the character. It writes `assets/models/*.gltf` and `blender/own_meta.json` (kind of each model and the character block of the manifest), and with a folder argument renders the same two sheets there for checking.

## Palette

`assets/palette.json` is the one palette: `grass`, `road`, `path`, `water`, `soil`, `glass`, `gold`, and lists `leaf`, `roof`, `wall`, `wood`, `stone`, `metal`, `accent`. `sky` holds `[zenith, horizon]` for `morning`, `noon`, `evening` and `night`. Models refer to colours as keys like `roof.0`.

## Manifest (`assets/manifest.json`, written by CI)

`models.<id>`: `file`, `source` (`kaykit`, `kenney` or `own`), `license`, `url`, `kind`, `tris`, `size` [x, y, z] and `footprint` [x, z] in metres, `nodes`, `animations`, `draws` (primitives) and `kb`.
- `kind` is `building`, `prop`, `nature`, `vehicle`, `road`, `broken` (props to drop around broken places), `life` (the bird), `character` or `task` (the 0.1 wall models).
- Building ids match `town.json` types: `townhall`, `house` (plus `house_2`, `house_3`), `keller_house`, `cafe`, `shop`, `pharmacy`, `kiosk`, `school`, `busstop`, `streetlight`, `statue`, `garden`, `park`, `playground`, `bridge`, `dump_pile`, `yard`. A `<id>_broken` variant exists for `bridge`, `busstop`, `park`, `playground`, `garden` and `dump_pile`; the others are the ok model, greyed, with `broken_rubble`, `broken_boards`, `broken_cone` and `broken_barrier` around them.
- Extra nodes: `townhall` has `clock_hour` and `clock_minute` (pivot at the clock centre; turn about z, clockwise seen from the front); `streetlight` has `lamp` (make it glow at night).
- `budget`: total MB, the character's triangles, and the 0.1 `town.json` buildings' triangles and draw calls.

## Character (`character` in the manifest)

One file, `character.gltf`: a rig (`hips`, `spine`, `head`, `armL/R`, `forearmL/R`, `handL/R`, `legL/R`, `shinL/R`) with clips `idle`, `walk`, `wave` and `cheer`, and every variant as its own skinned mesh. Show `body`, one hair, one face, the rank's accessories and at most one extra per slot; hide the rest.
- Materials `Skin`, `Hair`, `Shirt`, `Pants`, `Shoes` and `Jacket` are recoloured per avatar; accessories and faces use the `palette` vertex colours.
- `outfits[rank]`: `colors` by material name, `sleeve` (for the first-person arms) and `show` (node names). Ranks 0–6: vest and hard hat; tool belt and tester; teal jacket and clipboard; grey blazer; navy suit, tie and chain of office; charcoal suit, tie and briefcase; dark navy suit, tie and flag pin.
- `skins` (6), `hairs` (`short`, `long`, `bun`, `curly`, `none`, each with a default colour), `faces` (`face_smile`, `face_grin`, `face_calm`), `extras` (`cap`, `beanie`, `sunglasses`, `flower`, `scarf`, `bowtie`, each with a `slot`).
- `attach` names the bones for anything else: `head`, `spine`, `handR`.

## Budgets (build 0.2 §3.1)

| What | Budget | Checked by |
|---|---|---|
| One model file (the character included) | ≤ 5,000 triangles | `tools/validate_assets.mjs` |
| All model files | ≤ 8 MB | `tools/validate_assets.mjs` |
| The 0.1 `town.json` buildings | ≤ 60,000 triangles, ≤ 150 draw calls | `validate_assets.mjs --manifest` (kits.yml) |
| A whole town scene with props and life | ≤ 60,000 triangles, ≤ 150 draw calls | QA C3 (Lane G) |
| Delivery overlay (van, stops, barrier, route dots) | ≤ 3,000 triangles | Lane W (about 700 + 6 per queued metre) |
| Wall scene (models, pallet stack, wall, garden) | ≤ 20,000 triangles | Lane W (about 13,000) |

## How the world uses the kit (Lane W)

`js/world/assets.js` fetches `manifest.json` and the models in the browser, decodes each in memory (LESSONS H1) and swaps the `palette` material for the greyable toon one. `createWorld` stays synchronous: the town, its life and the avatar start as code-built stand-ins and switch over once the kit is in (`__btmWorld.loaded`). If the kit fails, the stand-ins stay and a warning is logged.
- **Buildings:** the model with the building's id first (`pharmacy`, `kiosk`, `keller_house`), then its type; houses vary between `house`, `house_2` and `house_3` by id. A broken building shows `<id>_broken`, or the ok model with `broken_rubble`, `broken_cone` and `broken_boards` in front. A bridge always gets the stream it crosses.
- **Town hall clock:** `clock_hour` and `clock_minute` show the time of day, 7:00 in the morning to 23:00 at night, and run on to 7:00 overnight. **Streetlights:** `lamp` glows at evening and night unless the light is broken.
- **Props, trees and cars:** `bench`, `fence`, `streetlight` (lamps), `potted_bush`, a trio of `flower_*` for a flower bed, the five trees in turn, and the three cars; one instanced draw per model part. Litter bins stay code-built.
- **Avatar:** `character.gltf` with its four clips; it shows the body, one hair, one face, the rank's `show` list and the worn extra (a hat-slot extra hides under the hard hat). It recolours `Skin`, `Hair` and the outfit's `colors`, and the first-person sleeves take the outfit's `sleeve`. `setAvatar`'s skin, hair and face indices point into `manifest.character` `skins`, `hairs` and `faces` (the stand-in keeps a copy of them in `js/world/avatar.js`). A new town (the start, a visit) opens centred on the avatar, and `celebrate('promotion')` flies to it.
- Citizens and birds stay code-built and instanced: twelve 4.5k-triangle characters would not fit the budget.

## Models (copied from Brick by Brick, made by its `blender/make_assets.py`)

Used by the first-person wall only.

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

## Town buildings (`js/world/buildings.js`: the kit's models, code-built stand-ins)

Each building is centred on its `x, z`, with its front towards +z; `rot` is in degrees. Broken ones stand in a grey area (look.js greys everything within their footprint plus 3 m, fading back to colour over about 1.5 s once fixed); ok ones are in colour, with their `label`. **Keep footprints apart when laying out a town**: the numbers below are in metres, and walking, the delivery van and the grey areas use them whichever model is shown. Solid buildings block the van (with a 1 m margin) and walkers. The triangle counts are the code-built stand-ins'.

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
| `dump_pile` | 6 × 5 | 2 | no | 204 broken, 96 ok | a messy heap (bags, mattress, tyres, fridge) vs a clean patch with a bench and flowers |
| `yard` | 10 × 8 | 4 | no | 120 | a builder's yard: gravel, shed, pallets, bricks, skip; grey when broken |
| `streetlight` | 0.6 × 0.6 | 4.8 | no | 44 | unlit |
| `tree` | 2 × 2 | 3.8 | no | 40 | |

Type names are forgiving: `bus_stop`, `Bus-Stop` and `stop` all mean `busstop`, and `hall` means `townhall`. An unknown type draws a house.

## Task parameters and twists

`world.playTask(kind, params)`: main.js passes `offer.params` unchanged; the twist id is `params.twist` (its text is `offer.twist`, shown by the UI). The id is matched case-insensitively, ignoring spaces and punctuation, so `closed_road` and `closed road` are the same.

| Task | Params | Twists |
|---|---|---|
| `wall` | `title?`; `at` is ignored, and the wall is always 11 bricks | `rain` (the mortar goes off in 12 s instead of 30), `cracked` (one brick is cracked: swap it or cap at 2 stars), `hurry` (3 stars need 35 s instead of 45) |
| `delivery` | `stops?` (a list of building ids whose **first is the pickup** where the van starts, or a count), `from?` (names the pickup instead; default the café), `seconds?` (the clock, at most 45), `title?` | `closed_road` (a barrier across the longest leg), `rush` (10 s less on the clock). `rain` and `dog` are **flavour only in 0.1**: their line shows on the HUD, and play is unchanged. |

The delivery always has 3–4 stops. If the list names fewer, it's topped up with other buildings.

- **Wall:** 11 bricks in 2 courses. Tap to lay a brick, then tap the high end or hold to knock until it's level.
  - The mortar sets a proud brick for you, and a brick knocked too low is re-bedded.
  - At 90 s the foreman lays the rest, so every wall finishes with at least 1 star.
- **Delivery:** drag from the van to draw its route. The van follows it at 14 m/s and stops at walls and the barrier.
  - A stop counts within 2.5 m of the building.
  - Stars: all stops, a route within 1.4 × the shortest tour, and done within 60% of the clock (27 s of 45) gives 3 stars.
  - It ends when every stop is done or when the clock runs out (45 s, or 35 s with `rush`).

## QA hooks: `window.__btmWorld`

| Hook | Does |
|---|---|
| `tap(id)` | fires `onPick({ id })` as if the building were tapped; returns false for an unknown id |
| `finish(stars)` | ends the running task at once with 0–3 stars; `seconds` is the game time so far (≤ 90) |
| `task()` | the running task's state or null. The wall gives `{ kind, twist, t, sleeve, cuffs, next, aim, laid, total, hand, setting }` (`sleeve`: the colour your rank's sleeves wear), where `aim` is the current brick in canvas px (tap there); the delivery gives `{ kind, twist, closed, limit, t, van, queued, pathLen, best, delivered, total, stops, barrier }` |
| `screen(x, z)` | a ground point in canvas px under the town camera; draw a delivery route through the stops' `x, z` with it |
| `view` | the town camera: `{ x, z, d }` |
| `stats()` | draw calls and triangles of the last whole frame (every pass: shadows, scene, outlines), the building count, the world's game time and `quality` (`low` or `high`) |
| `world` | the world object itself |
| `loaded` | a promise: true once the kit is on show, false if it failed |
| `kit()` | `{ ready, models, character, hours, buildings: { id: model }, hands, lamps, lampGlow }` |
| `avatar()` | `{ skin, hair, face, rank, extra, x, z, walking, skips, clip, kit, title, parts, top, outfit, screen, visible }`; `visible` means on screen |
| `skipWalk()` | ends a walk at once, as a tap on the town does; true if one was running |
| `tod()` | `{ target, t, sun, night, hours, outlines, shadows }`; `t` is 1 once the 1.5 s ease is done |
| `grey()` | the grey areas: `[{ id, a, to }]`, `a` from 1 (grey) to 0 |
| `life()` | `{ citizens, walking, people, cars, birds, trees, props: { total, shown }, roads, paths, ring, confetti }` |
| `lastFixed()` | the building fixed last (what `celebrate('fixed')` bounces) |
| `sample(x, z)` | renders and reads back the `[r, g, b]` on screen at a ground point |

`anchors()` gives buildings (`kind: 'building'`) and the citizens walking about (`kind: 'person'`, their people.json id). A tap on the town during a walk only skips the walk.

Add `?q=low` to the page URL for the software-GL runner: no antialiasing, no outlines, no shadows, pixel ratio 1.

Perf, as `tools/smoke_world.mjs` reports it: Brookfield with the kit and 12 citizens at full quality is about 107 draw calls and 57k triangles a frame (budget 150 and 60k); the smoke town at `q=low` is about 43 draw calls and 25k triangles.
