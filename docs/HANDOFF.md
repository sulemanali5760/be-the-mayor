# Handoff: continuing Be the Mayor on another machine

Written 2026-09-28 by the director session on the owner's Windows laptop. It summarises the whole chat that built this project, so a fresh Claude Code session can pick up without the old transcript.

## 1. Start here (paste this into Claude Code on the new laptop)

> You are the **director** of a small AI game studio building **Be the Mayor**. Read `docs/HANDOFF.md`, then `docs/LESSONS.md`, `docs/STUDIO.md`, `docs/VISION.md` and `docs/ROADMAP.md`, and the latest build plan in `docs/builds/`. Follow the studio process: you plan, write contracts, review and merge; lanes (subagents, at most 3, each in its own git worktree and branch) do the implementation; GitHub CI is the gate. Then tell me the current status and the next step.

**Full history (only when you need detail):** the complete old chat, including every lane's transcript, is in the owner's **private** repo `sulemanali5760/btm-director-archive` as a zip (about 26 MB of JSONL). Clone it with the owner's `gh` login, unzip it, and grep for a topic; don't load it whole. It's an archive, not the current chat: start a new session and continue from this handoff.

## 2. Links

- Repo: https://github.com/sulemanali5760/be-the-mayor (public, branch `main`)
- Live game: https://sulemanali5760.github.io/be-the-mayor/ (GitHub Pages, deploys from `main`)
- Supabase project ref: `espwhkntmxbanzbvnnqg` (URL and public anon key in `js/net/config.js`). The owner owns the account; **never ask for or handle his password, service_role key or logins.**
- Previous game (stopped, lessons carried over): https://github.com/sulemanali5760/brick-by-brick

## 3. Status (2026-09-28)

**Released:**

| Version | Contents |
|---|---|
| 0.1.0 "First 15 minutes" | Labourer → Skilled career; job board with first-person garden wall and drawn delivery route; problems, events, night school; newspaper; visits (likes, signs, help); promotion card |
| 0.2.1 "Look & feel" | Cozy toon town (Hay Day look) from CC0 kits plus our own Blender models; time of day follows your 3 action slots; grey broken areas that regain colour; citizens, cars, birds; your avatar with rank outfits (hard hat → mayor's chain of office → president); character creator and wardrobe |
| 0.2.2 "Cloud save" | Private `saves` table; passwordless email account ("Save my progress"); choice card when device and cloud differ; export/import save code; save fixtures from every release tested in CI (LESSONS S1) |

**Open steps for the owner** (0.2.2 needs them to go live):
1. Run `supabase/migrations/20260928000000_saves.sql` in Supabase → SQL Editor. The director reviewed it: owner-only RLS, safe to re-run.
2. Supabase → Authentication → URL Configuration: set **Site URL** and add a **Redirect URL**, both `https://sulemanali5760.github.io/be-the-mayor/`. Leave anonymous sign-ins and "Confirm email" on.
3. In the game (in the browser where his progress is): ⚙ → **Save my progress** → his email → click the link. After that, "Log in on this device" works anywhere.
4. The director should then verify that the table exists, **without reading anyone's save**.

**Next milestone:** **0.3 "Community and council"** (see ROADMAP): 4–6 citizen groups with moods; skilled first-person fixes (street-light wiring, pothole); the by-election (signatures, door-knocking first-person task, a speech of promises); council votes, allies and a named rival; delegating mastered tasks. **Phone budget warning:** the town is at 57k of 60k triangles, so new props need instancing or LODs.

**Pending owner answer:** whether to adopt 3 ideas from the *Claude Code Game Studios* template. The director recommended **not installing** it (third-party hooks, and its own data shows heavy process makes worse games), but copying these:
1. **"A visual change isn't done until the running game has been looked at"**: a screenshot is kept as evidence. This would have caught the 0.2 hard-hat bug.
2. **An art bible** (`docs/ART.md`): palette, proportions, outlines, what "cozy" means.
3. **A cost-and-waste line** in every build's minutes (a short retrospective).

## 4. The owner's decisions and preferences

- **Studio workflow for every project:** a master plan (vision, mission, pillars), then features split into lanes by **file ownership**, a contract first, file-based "meetings" (each lane's final report: done / changed / needs / cost), the director decides contract changes, and CI plus the director's play test is the final gate. **At most 3 lanes.**
- **Every lane runs on Opus** (owner's decision; smaller contexts are what save tokens). Effort "high" is fine; use max only for hard design or debugging, and `/code-review ultra` (the owner starts it) once before a public launch.
- **Security rules (strict on the Windows laptop):**
  - No local code execution there (no node, npm, python or servers). Blender headless for our own scripts was the only exception.
  - **Never open web-downloaded files locally:** kits are fetched, converted and validated only in GitHub Actions (`kits.yml`, which runs only on `feat/*-art`) and viewed on GitHub or Pages.
  - Never handle his logins; never put a service key in the repo.
  - **For the Linux laptop the owner hasn't decided yet** whether local test runs are allowed there. Ask him first. If yes, local tests (node, Playwright, a local Supabase in Docker) would cut the ~40 min CI waits to seconds, and CI stays the final gate.
- **Design direction (from the owner):**
  - Start as an ordinary labourer, upgrade yourself as in real life (skills, a degree, a computer), help people and solve problems, rise to mayor, with **president** as the top level.
  - Every player has their own town and can visit others' towns (async, from day one).
  - First-person for many actions plus a Clash of Clans / Hay Day top view.
  - Grounded in **real-world research** and data from other games.
  - Cozy toon style, CC0 kits plus our own Blender models.
  - **Progress must survive updates like a real game** (0.2.2).
- **Why the previous game (Brick by Brick) was stopped:** "boring": one mechanic repeated 50–100 times, slow progress, no reason to care. Rule D1 in LESSONS: choices over repetition, first-person tasks ≤ 90 s with a twist, something new every few minutes.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, authored as the repo-local git user.
- He sometimes stops mid-build ("stop, I need to work on another project"). When he does, stop all lanes, commit their work locally as WIP (don't push), and note the resume point.

## 5. How the studio runs (practical)

- **Worktrees are made by hand** (the Agent tool's automatic worktree failed on this repo):
  ```
  git worktree add ../btm-lanes/<lane> -b feat/<version>-<lane>
  ```
  Remove them after the merge.
- **Lane prompt skeleton:**
  - role and worktree path;
  - "read LESSONS, STUDIO, VISION, then the build plan (files you own, contract, your brief)";
  - hard rules (local-execution policy, the downloads rule, push early if others merge you, the contract is law, the two-strike rule, no inline heredoc edits of JS, one-line table cells, the commit trailer);
  - a meeting-note format under 25 lines.
- **Lanes are background subagents.** Continue a lane with SendMessage to its id: it keeps its context. When API usage limits kill a lane, resume it the same way; its work stays on disk.
- **CI:**
  - `rules`: node tests plus the balance bot;
  - `db`: a local Supabase on the runner with RLS tests; never touches the live project;
  - `qa`: Playwright at 3 screen sizes, `?q=low`, about 40 min;
  - `assets`: the glTF validator plus the world smoke test;
  - `kits`: CC0 kit pipeline, art branches only.

  Docs-only pushes skip QA.
- **Schema changes** go in a **new** migration file (never edit an applied one). The director reviews it, and the owner runs it in the SQL Editor.
- **Balance targets** (keep them in CI): Skilled median 12–18 min (it's 13.1); ≤ 12 jobs before Skilled (median 8); ≥ 2 action types a day; ≤ 2 first-person tasks per kind in ≥ 95% of runs; no dominant options; money always has somewhere to go.
- **Release checklist:**
  1. Merge the lanes in contract order.
  2. Bump `?v=` in `index.html`.
  3. Write the minutes into the build plan.
  4. Push.
  5. Wait for Pages.
  6. **Play it on Pages yourself.** The browser pane pauses `requestAnimationFrame` when hidden; for testing, override it with `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`.
  7. Fix what you see.
  8. Update the memory and handoff notes.

## 6. Key numbers and history (for context)

- **0.1:** the bots found two boredom traps before any human played:
  - 3 walls and 3 deliveries in a row, fixed with the **quick shift** (80% pay after 2+ stars);
  - then 30 tap-jobs filling a real-time course timer, fixed with **3 action slots a day and courses by evenings**, with no real-time timers.
- **0.2:** 71 models, 4.2 MB; phone at 107 draw calls, 57k triangles, 3.6 ms JS. The director's play test found curly hair hiding the hard hat, which state-based QA can't see, and fixed it in 0.2.1.
- **0.2.2:** rules 46/46, db 15/15, QA green on the first push; it also fixed "Start a new life" doing nothing.
- **Research:** `docs/research/REAL-WORLD.md` (jobs, pay, citizen complaint data, how mayors get elected: DE/US/PK) and `docs/research/GAMES.md` (18 games, first-15-minutes design, anti-boredom rules, async multiplayer and anti-cheat).

## 7. Setting up the Linux laptop (checklist)

1. Install git, Node 18 or newer, and the GitHub CLI; optionally Docker (local Supabase) and Blender (our own models).
2. `npm install -g @anthropic-ai/claude-code`, run `claude`, and log in with the **same Claude account** (the owner does this himself). The usage quota is shared across machines.
3. `gh auth login` (owner does it himself), then `git clone https://github.com/sulemanali5760/be-the-mayor && cd be-the-mayor`.
4. Set the repo-local git user to the same name and email as on Windows (`git config user.name` / `user.email`).
5. Start `claude` in the repo and paste the prompt from §1.
6. Tell the new session whether local test runs are allowed on this machine.
