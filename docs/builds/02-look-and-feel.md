# Build 0.2: "Look & feel"

Status: closed · 0.2.0 released (studio build) · base: 0.1.0 · roadmap row 0.2

## 1. Goal

Brookfield becomes a **cozy toon town you'd screenshot** (Hay Day look), and **you are in it**: an avatar that walks where you tap, and whose outfit changes with your rank.

Pillars:
- **4, "You can see it":** the town visibly regains colour and life as you fix it.
- **5, "Always a next goal":** your clothes show your rank.

No new game mechanics except the wardrobe (a money sink).

Owner's choices (2026-09-27): cozy toon style; **CC0 kits** (KayKit, Kenney, Quaternius) plus our own Blender models for signature buildings. The downloads rule (LESSONS A1) applies:
- kit files are fetched, converted and validated **only in GitHub Actions**, and are never opened on the owner's laptop;
- lanes work from the **CI-generated manifest and contact sheet** (our own output), viewed on Pages or read as JSON.

## 2. Files and owners

| Path | Owner |
|---|---|
| `assets/` (models, `manifest.json`, `palette.json`), `blender/`, `tools/` (kit fetch, convert, validate, contact sheet), `.github/workflows/assets.yml` and `kits.yml`, `docs/ASSETS.md`, `docs/art/` (contact sheets) | **Lane A** (art pipeline) |
| `js/world/` (rendering, toon look, lighting, life, avatar, first-person arms) | **Lane W** (world) |
| `js/rules/`, `data/`, `js/main.js`, `js/ui/`, `css/`, `index.html`, `js/net/`, `qa/`, `.github/workflows/rules.yml`, `qa.yml`, `db.yml`, `docs/GDD.md` | **Lane G** (game: data, UI, QA) |

## 3. Data contract

### 3.1 Assets (Lane A → Lane W)

- **`assets/manifest.json`**, written by CI:
  ```
  { models: { <id>: { file, source: 'kaykit'|'kenney'|'quaternius'|'own', license, url, tris, size: [x, y, z], footprint: [w, d], nodes: [...], animations: [...] } },
    character: { base: <id>, animations: { idle, walk, wave, cheer }, attach: { head, spine, handR } /* bone names */,
                 skins: [hex...], hairs: [{ id, model?|color }], faces: [...] } }
  ```
- **`assets/palette.json`**: the one shared palette, e.g. `{ grass, road, path, water, roof: [...], wall: [...], accent: [...], sky: { morning, noon, evening, night } }`. All kit materials are recoloured to it in CI (conversion step), so the kits look like one game.
- **Town set:**
  - one model per building **type** used in `data/town.json` and the seed towns (townhall, house, cafe, pharmacy, kiosk, school, busstop, streetlight, garden, park, bridge, dump_pile, yard, shop, statue), each in a `broken` and an `ok` variant, or an `ok` model plus a broken prop set;
  - road and path pieces, trees, props (benches, lamps, fences, flowers, bins), 2–3 cars, a bird.
- **Signature buildings**, our own Blender models in the palette: **town hall** (with the clock), **the bridge**, **Frau Keller's house**.
- **Character:** one rigged base with idle, walk, wave and cheer animations, plus the **rank outfits**:

  | Rank | Outfit |
  |---|---|
  | 0 Labourer | hi-vis vest, hard hat, work boots |
  | 1 Skilled | work trousers, tool belt, tester in hand |
  | 2 Community helper | casual jacket, clipboard |
  | 3 Councillor | shirt and blazer |
  | 4 Mayor | suit plus **chain of office** |
  | 5 Governor | dark suit, briefcase |
  | 6 President | tailored suit, flag pin |

  Outfits can be material swaps plus attachable accessories (our own Blender models are fine for the hard hat, vest, chain, clipboard and briefcase). There are also skin tones, hair styles and faces, plus **4–6 wardrobe extras** (cap, scarf, sunglasses, flowers, …).
- **Budgets for phones:**
  - a whole town scene ≤ **60k triangles** and ≤ **150 draw calls** (instance repeated props);
  - the character ≤ **5k triangles**;
  - total assets ≤ **8 MB**.

**Contract change 1 (director, from Lane A):** the manifest fields `kind`, `draws`, `kb` and `budget`, and in `character`: `body`, `materials`, `outfits` (colours per material, `sleeve`, `show`) and `extras` (with `slot`), are part of the contract, as documented in ASSETS.md.
- Model ids equal the building types; `<id>_broken` exists for bridge, busstop, park, playground, garden and dump_pile.
- `character.gltf` holds every variant as its own skinned mesh: show only the body, one hair, one face, the rank's `show` list and one extra.
- The wardrobe extras are `cap`, `beanie`, `sunglasses`, `flower`, `scarf` and `bowtie`.

### 3.2 World API additions (Lane W → Lane G)

```js
world.setTimeOfDay(t)              // 0 = morning … 1 = night; eases over ~1.5 s
world.setAvatar({ skin, hair, face, rank, extra })   // swaps the outfit live; used in town, in visits, and for the first-person sleeves
world.walkTo(id) → Promise         // the avatar walks along roads and paths to a building (or bubble) id, then resolves
world.celebrate(kind)              // 'fixed' | 'promotion' | 'like': bounce, confetti, the avatar cheers
world.showTown(state)              // as in 0.1, plus: broken areas desaturated or grey, fixed areas full colour, with people and props appearing
```

- `playTask(kind, params)` reads `params.avatar` so the first-person arms wear the rank's sleeves.
- **Life:** named citizens from `people.json` walk simple routines on the path graph; cars loop on roads; trees sway; birds. All of it is cheap and instanced.
- **Look:**
  - toon shading (a gradient ramp) plus soft outlines;
  - warm key light with soft shadows (one shadow map, sized for phones), a hemisphere fill, a sky gradient by time of day;
  - ACES tone mapping;
  - `?q=low` switches off outlines and shadows for CI.

### 3.3 Game data and UI (Lane G)

- **Save:**
  - `state.avatar = { skin, hair, face, extra: null, owned: [] }`; `migrate()` gives old saves a default;
  - the outfit is derived from `state.rank`;
  - **`snapshot.avatar`** is included, so visitors see you. No DB migration: it lives inside the snapshot's jsonb.
- **`data/wardrobe.json`:** the extras with prices. Buying one is an upgrade of kind `buy` in the Learn panel's new "Wardrobe" tab, or its own panel.
- **`data/town.json`:** adds `roads: [[x, z] polylines]`, `paths: [...]`, `props: [{ type, x, z, rot }]`, `homes`/`work` for named people, and time-of-day hooks. Buildings are unchanged by id.
- **Time of day:** slots 3/2/1/0 → `setTimeOfDay(0, 0.3, 0.55, 0.75)`; sleeping → 1 (night), then the newspaper, then morning.
- **The avatar walks** to the job or problem building before a task or card opens (skippable with a tap; ≤ 3 s).
- **Character creator** on the first screen: skin, hair, face (3 taps, sensible defaults).
- **QA additions:**
  - **C1:** the avatar is visible in the town and its outfit changes at the Skilled promotion;
  - **C2:** the time of day changes with the slots;
  - **C3:** phone perf, where the median frame's JS stays ≤ 8 ms and the draw calls and triangles stay within budget;
  - **C4:** a visit shows the other town's avatar;
  - B1–B4 stay green.

## 4. Lanes

### Lane A: art pipeline, branch `feat/0.2-art`
1. Research the exact **CC0** sources: the KayKit City Builder Bits / character packs, Kenney City Kit and Mini Characters, Quaternius base characters. Record the URL and licence of each in ASSETS.md; **only CC0**.
2. Write `kits.yml` (`workflow_dispatch` and push to `tools/kits/**`). It must:
   - download the chosen kits;
   - convert them with **Blender in CI** (trim to what we use, recolour to the palette, embed as self-contained glTF, LESSONS H1);
   - validate them (the Khronos validator);
   - write `assets/manifest.json`;
   - render a **contact sheet PNG** into `docs/art/`;
   - commit the results back to the branch.
3. Build our own Blender models locally (allowed): the signature buildings and the outfit accessories.

Never open downloaded files locally. To inspect results, read `manifest.json` and view the contact sheet at `https://sulemanali5760.github.io/be-the-mayor/docs/art/…` after a merge, or in the Actions artifact **viewed on GitHub**.

### Lane W: world, branch `feat/0.2-world`
- The look, lighting and time of day; desaturated or grey broken areas; life; juice; the avatar with outfits, `walkTo` and animations; the first-person sleeves.
- Use placeholder capsules or boxes until Lane A's manifest lands, then `git merge origin/feat/0.2-art`.
- Keep the smoke test green and extend it: time of day, avatar walk, outfit swap, and perf numbers per quality level.

### Lane G: game data, UI and QA, branch `feat/0.2-game`
- Contract §3.3: save, wardrobe, town.json roads, paths, props and routines, the time-of-day wiring, the walk-before-action flow, the character creator, the snapshot avatar, and QA C1–C4.
- Fix the 0.1 known bug: the doubled speaker name.
- Merge `origin/feat/0.2-world` (and through it the art) when they're pushed.

## 5. Acceptance

| # | Check |
|---|---|
| C1–C4, B1–B4 | QA green |
| Art | `kits.yml` and `assets` green; every file CC0 with its source in the manifest; budgets hold |
| Look | The director views the contact sheet and plays on Pages: one consistent cozy style; the town visibly greys and recolours; the avatar reads at phone size and each outfit is distinct |
| Security | No kit file opened locally (each lane's note confirms it) |

## 6. Meeting minutes

**Meeting (2026-09-27/28).** The lanes were stopped twice by API usage limits and resumed with their context intact; no work was lost.

| Lane | Result | Cost (tokens, approx.) |
|---|---|---|
| A art | 71 models, 0 validator errors. CC0: KayKit City Builder Bits, Kenney Suburban and Nature, with pinned sha256. Our own Blender models: 17 buildings plus broken variants, and a rigged character with 7 rank outfits, 5 hairs, 3 faces and 6 extras. Assets total 4.2 MB. | ~430k |
| W world | Toon ramp, outlines, a 1024 shadow map, ACES, time of day, grey broken areas, 12 citizens, cars, birds, `celebrate`, avatar with `walkTo`. Full quality: 98 draw calls, 56k triangles, 1.4 ms JS. Smoke 24/24. | ~640k |
| G game | Creator, wardrobe, town layout with roads, paths and homes, time of day wired, walk-before-action, avatar in snapshots and visits, doubled-name fix. QA 40/40 rows at 3 sizes; phone 3.6 ms JS, 107 draw calls, 57k triangles. | ~410k |

**Decisions:**
- Contract change 1 (the manifest fields).
- `kits.yml` now runs only on `feat/*-art` branches, because it fired on other lanes' branches after they merged the art.
- Citizens stay code-built for the triangle budget.

**Rule slips (self-reported):** Lane A ran one trivial local `python3 -c print` and made one heredoc edit, then redid it (T3). No downloaded kit file was opened locally, according to all three lanes.

**Carry to 0.3:**
- The phone is at 57k of 60k triangles, so new props need instancing or LODs.
- The old desktop QA click can flake on software GL.
- Kit citizens only if there's budget to spare.
