# Lessons log

Every agent reads this before every build. Add an entry whenever something goes wrong: what happened, why, and the rule we follow now.

Entries marked **BbB** were carried over from our first game, *Brick by Brick* (Sep 2026, 0.1 → 0.8, stopped). Its docs are in `../brick-by-brick/docs/`.

## Design (the reason the last game stopped)

| # | What went wrong | Root cause | Rule now |
|---|---|---|---|
| D1 BbB | The owner stopped Brick by Brick: "this game is boring" | One mechanic (tap a brick level) repeated 50–100× per job; slow progress; jobs had no client, place or reason; after job 2 nothing new happened | **Choices over repetition.** Every minute of play offers a decision with a trade-off. A first-person task lasts **≤ 90 s** and is never repeated in the same session without a twist. Something new (a job, an item, a person, a problem) arrives every few minutes. |
| D2 BbB | The bot aced mechanics with 100% Perfect | Mechanics had no cost | Every mechanic gets a **bot balance run in CI**; if the bot aces it, it isn't a skill yet. Every choice needs a cost (time, money, energy, reputation). |
| D3 BbB | Automation (the robot) cut pay, and then the player just watched | Faster wasn't also better; waiting had nothing to do | An upgrade must **change what you do**, not only how fast. Never leave the player waiting with nothing to decide. |
| D4 BbB | Too much effort went into 3D fidelity for one mechanic | Depth before breadth | **Breadth first.** Reuse models and use simple shapes; content (jobs, people, problems) lives in data files. |
| D6 | 0.1 bots found two boredom traps before any human played: first 3 walls and 3 deliveries, then (after quick shifts) 30 tap-jobs | A real-time course timer made jobs the filler | **Days pace everything (3 action slots); no real-time timers.** CI tracks per-verb repeats, jobs before each rank, and action types a day. |
| D5 BbB | Upgrades interacted with job parameters in surprising ways | No overview | Read the balance table every build. |

## Hosting and delivery (BbB)

| # | Rule |
|---|---|
| H1 | Models ship as self-contained `.gltf` (embedded buffers), decoded in-memory, because a strict CSP can block `data:` fetches (BbB L1, L2). |
| H2 | `index.html` is a full document: doctype, `[hidden]{display:none!important}`, `*{box-sizing:border-box}` (BbB L3). |
| H3 | Every asset URL carries `?v=` from one version in `index.html`; bump it on every release, because GitHub Pages caches for 10 min (BbB L4). |
| H4 | Test on GitHub Pages, which is public. Claude can't open private artifacts in its browser (BbB L5). |

## Testing and tooling (BbB)

| # | Rule |
|---|---|
| T1 | **No local code execution on the owner's laptop:** no node, npm, python or servers. Tests run in GitHub Actions only. Blender headless scripts are the one exception (BbB L10). |
| T2 | Test each mechanic with its own deterministic case; random simulations only check invariants (BbB L8). |
| T3 | No inline heredoc edits of JS or Python, not even for one line. Use the edit tools or a patch file (BbB L9, L9b). |
| T4 | Wait for CI with `until …; do sleep 15; done` on a real condition (BbB L11). |
| T5 | Guard every divide by a layout size: a 0-px resize pass gave NaN aspect ratios (BbB L19). |
| T6 | **One game clock** drives everything. QA and tests use the game clock, never `performance.now()` (BbB L24). Time-based checks measure **game time per frame**, not real seconds, because CI's software GL runs about 3 fps (BbB L25). |
| T7 | When a shared concept changes (clock, units, ids, a save schema), grep **every** consumer in the same build, QA and tests included (BbB L24). |
| T8 | Measure player intent in screen space, not on padded hitboxes (BbB L23). |
| T9 | Screenshots in the browser pane: emulate 640×400 at DPR 1.25. A hidden pane pauses `requestAnimationFrame`; for a manual test, override `requestAnimationFrame` with a `setTimeout` and force one frame with a screenshot (BbB L6, L22). |
| T10 | Docs-only pushes skip the slow QA run (`paths-ignore`); a newer push cancels the older run on the same branch; jobs have timeouts. |

## Assets and security (BbB)

| # | Rule |
|---|---|
| A1 | **Never open web-downloaded files on the owner's laptop.** Fetch, convert and validate them in GitHub Actions; view them on Pages. Local Blender builds only our own models with procedural textures (BbB L21). |
| A2 | Check a downloaded asset's thumbnail before using it: names lie, e.g. `trowel_01` was a garden trowel (BbB L16). |
| A3 | Blender: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python …` (BbB L17). Rest lineup items on their lowest point (BbB L15). |
| A4 | Never handle the owner's logins or passwords. Service keys never go in the repo or the client; public keys (e.g. the Supabase anon key) are fine in client code. |

## Process (BbB)

| # | Rule |
|---|---|
| P1 | Every build has a plan in `docs/builds/`. Investigate to the root cause first and bundle fixes; no patch chains (BbB L18). |
| P2 | Studio builds: contract first, file ownership, at most 3 lanes, a two-strike rule. See [STUDIO.md](STUDIO.md). In 0.8 every lane was green on its first push, with no merge conflicts. |
| P3 | The Agent tool's automatic worktree fails on these repos, so the director makes lane worktrees by hand. |
