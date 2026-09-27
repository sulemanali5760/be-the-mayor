# Build 0.2.2: "Cloud save"

Status: closed · 0.2.2 released · base: 0.2.1 · one lane (G) · owner request 2026-09-28

## 1. Goal

Progress survives everything a real game's does: a refresh (already works), **updates** (proven by CI), **a cleared browser, incognito, a new phone** (cloud save plus an email account).

The owner's current local progress must carry into his account without loss.

Out of scope:
- admin role (later, with moderation tools);
- Google login;
- custom SMTP (before 1.0: Supabase's built-in email is rate-limited, fine for testing).

## 2. Contract

### 2.1 Database: a **new** migration `supabase/migrations/20260928000000_saves.sql`

The owner runs it in the SQL Editor; never edit the applied init migration.
- **`public.saves`:**

  | Column | Type |
  |---|---|
  | `id` | `uuid pk default auth.uid() references auth.users on delete cascade` |
  | `save` | `jsonb not null`, `octet_length < 200000`, an object |
  | `version` | `text not null` (the game version that wrote it) |
  | `play_t` | `numeric` (the game clock, for "which is newer") |
  | `updated_at` | `timestamptz` |
  | `prev1`, `prev2` | `jsonb`: the last two backups, rotated by a trigger on update |

- **RLS, owner only:** select, insert, update and delete where `id = auth.uid()`. **Nobody else can read a save**, not even anon.
- Column grants: the client writes `save`, `version` and `play_t` only.
- The trigger rate-limits writes to ≥ 20 s apart and rotates the backups.
- **db tests** (local Supabase on the runner):
  - another user can't read or write my save;
  - anon can't read;
  - the rate limit holds;
  - backups rotate;
  - an anonymous user who links an email keeps the same `id`, so the save stays theirs.

### 2.2 `js/net/net.js` additions

```js
net.account()               // { signedIn, anonymous, email|null }
net.cloudLoad()             // { save, version, play_t, updated_at } | null
net.cloudSave(save, meta)   // debounced by the caller; friendly errors
net.linkEmail(email)        // anonymous → permanent: supabase.auth.updateUser({ email }), same user id, so the progress stays
net.signInEmail(email)      // magic link for another device: signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
net.signOut()
```

### 2.3 Game flow (`main.js`, `js/ui/`)

- **Cloud sync:** after actions, every 60 s of play and on hide or pagehide, but never more often than the 20 s server limit. Offline, keep playing and retry later.
- **On start:**
  - read the local save and the cloud save; pick the newer by `play_t`;
  - if **both** have real progress and they differ, show a choice card, e.g. "This device: Day 2 · Labourer · €40" against "Cloud: Day 7 · Skilled · €310";
  - never silently throw away a save with more progress.
- **⚙ Settings** (a small gear in the HUD):
  - "Save my progress" (email) → "Check your inbox";
  - the status line: "Saved to cloud · 12 s ago" or "Only on this device";
  - "Log in on this device";
  - "Log out";
  - "Export save code" / "Import save code" (base64 JSON, and every import goes through `migrate`).
- **The magic-link return:** the page reloads with a session. After signing in on a new device, load the cloud save; the choice card applies.

### 2.4 Update-safe saves (the rule from now on)

- `data/../qa/fixtures/saves/` (or `js/rules/fixtures/`) holds **real saves from 0.1.0 and 0.2.x** (shapes as those versions wrote them, including the `{ v, t, meta, save }` wrapper).
- A rules test loads each one through `migrate` and asserts that the name, town, money, reputation, rank, day, buildings and avatar are kept, and that new fields get their defaults.
- **Every future release adds a fixture.**
- LESSONS gets rule **S1**: never delete or rename a saved field without a migration step; new currencies default to 0; save fixtures must pass.

## 3. Acceptance

| # | Check |
|---|---|
| E1 | db tests green (privacy, rate limit, backups, id kept on linking) |
| E2 | Rules: every save fixture loads with its progress intact |
| E3 | QA: play → reload → same day, money and rank; export then import round-trips; choice card logic with a stubbed cloud |
| E4 | Director: after the owner runs the migration and sets the redirect URL, a live anonymous save → cloud row exists (checked with the owner's session only, in his browser) |

## 4. Owner steps (after the lane is green)

1. Run the new migration in the SQL Editor.
2. Authentication → URL Configuration: **Site URL** = `https://sulemanali5760.github.io/be-the-mayor/`, and the same under Redirect URLs.
3. In the game: ⚙ → Save my progress → your email → click the link.

## 5. Minutes (2026-09-28)

- Lane G: every check green on the **first push**.
  - rules 46/46: save fixtures 0.1.0, 0.2.1 and 0.2.2, export/import, `pickSave` conflicts;
  - db 15/15: privacy, rate limit, backups, same id after email linking and magic-link login;
  - qa: the reload, export/import and choice-card checks, with Supabase stubbed so nothing reached the live project.
  - About 284k tokens.
- Also fixed: "Start a new life" did nothing, because the `pagehide` save rewrote the old life.
- Director reviewed the migration SQL before handing it to the owner: owner-only RLS, anon revoked, server-owned id, timestamps and backups, 20 s limit, safe to re-run.
