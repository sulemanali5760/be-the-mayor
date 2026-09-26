# How the studio works

Since 0.8 every build runs as a small studio: a **director** session plus up to three **lanes**. Each lane is an agent in its own git worktree and branch.

Vision and pillars live in [VISION.md](VISION.md), milestones in [ROADMAP.md](ROADMAP.md) and are not repeated here.

## Roles

| Who | Does | Doesn't |
|---|---|---|
| **Director** (lead session) | Writes the build plan, the lane briefs and the **data contract**. Runs the meetings, reviews diffs, merges, bumps the version and releases. | Implement features. |
| **Lane agent** (one per lane) | Implements its brief, **only in the files it owns**, pushes its branch and reads its CI results. | Edit files owned by another lane, change the contract on its own, merge to `main`. |
| **CI** (`rules`, `assets`, `qa`) | Checks that the build is valid and runs, on every push to any branch. | Judge whether it's fun or true. That's the director's review. |

## Rules for every lane

1. **Read first:** [LESSONS.md](LESSONS.md), this file, then your lane's brief in the build plan.
2. **Branch:** `feat/<version>-<lane>`, for example `feat/0.1-systems`. Push early; CI runs on every push.
3. **No local test runs** on this laptop: no node, no servers. Test through CI with `gh run list --branch <b>` and `gh run view <id> --log`. Blender scripts are the one exception and may run locally.
4. **Web downloads** are never opened locally; they're fetched and converted in GitHub Actions ([ASSETS.md](ASSETS.md)).
5. **The contract is law.** If you need a change, stop and report it; the director decides at the meeting. Don't work around it.
6. **Two strikes:** if the same CI check fails twice after your fixes, stop and report the log lines instead of trying a third time.
7. **No inline heredoc edits of JS** (L9b). Use the edit tools or a patch file.
8. **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
9. **Your final report is the meeting note.** Give it in this shape:
   - **done:** what works, with the CI run link
   - **changed:** anything the other lanes must know
   - **needs:** requests to other lanes or the contract
   - **cost:** rough effort, and anything that wasted a cycle

## Build rhythm

1. **Kickoff:** the director writes `docs/builds/NN-*.md` with the goal, contract, lanes and acceptance checks, then starts the lanes.
2. **Lanes work in parallel** against the contract. A lane that depends on another codes against the contract and merges that lane's branch once it's pushed.
3. **Meeting:** when every lane has reported, the director writes the minutes into the build plan (decisions and change requests) and sends each lane its requests.
4. **Integration:** the director merges the lanes into `main` in contract order. `main` must be green on `rules`, `assets` and `qa` before release. The director then plays the build on Pages and checks it against the pillars.
5. **Close:** the QA table goes into the build plan, lessons into LESSONS.md, and CHANGELOG and ROADMAP are updated.

## Setting up lanes (director)

The Agent tool's automatic worktree option fails on this repo, so make the worktrees by hand, one per lane:

```bash
git worktree add ../btm-lanes/<lane> -b feat/<version>-<lane>
```

Start each lane agent with its worktree path, and clean up after the merge with `git worktree remove ../btm-lanes/<lane>`.

## Limits

- **At most three lanes per build.** More lanes cost more in coordination than they save.
- **Split lanes by file ownership.** If two lanes need the same file, either give it to one lane and have the others request changes, or split the file first. `js/game.js` gets split into modules the first time two lanes need it.
- **Every lane runs on Opus.** That's the owner's decision (2026-09-24); lane costs are logged per build to check it.
