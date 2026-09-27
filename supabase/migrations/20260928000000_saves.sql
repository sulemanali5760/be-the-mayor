-- Be the Mayor 0.2.2: cloud saves (docs/builds/02b-cloud-save.md §2.1). One private row per player.
-- Safe to run more than once in the SQL Editor: every statement is idempotent (if not exists / or replace / drop if exists).
-- Anonymous players use the `authenticated` role; linking an email keeps the same auth.users id, so the row stays theirs.

create table if not exists public.saves (
  id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  save        jsonb not null check (octet_length(save::text) < 200000 and jsonb_typeof(save) = 'object'), -- the local save wrapper { v, t, meta, save }
  version     text not null check (char_length(version) between 1 and 32),                                  -- the game version that wrote it
  play_t      numeric not null default 0 check (play_t >= 0),                                                -- the game clock: which save is newer
  updated_at  timestamptz not null default now(),
  prev1       jsonb, -- the last two saves, rotated by saves_guard: { save, version, play_t, at }
  prev2       jsonb
);

-- one write per 20 s per player; every update pushes the old save into the backups
create or replace function public.saves_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if old.updated_at > now() - interval '20 seconds' then
      raise exception 'Saving too often, try again in a moment';
    end if;
    new.prev2 := old.prev1;
    new.prev1 := jsonb_build_object('save', old.save, 'version', old.version, 'play_t', old.play_t, 'at', old.updated_at);
  else
    new.prev1 := null;
    new.prev2 := null;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves for each row execute function public.saves_guard();

-- owner only: nobody else can read a save, not even anon
alter table public.saves enable row level security;
drop policy if exists saves_select on public.saves;
drop policy if exists saves_insert on public.saves;
drop policy if exists saves_update on public.saves;
drop policy if exists saves_delete on public.saves;
create policy saves_select on public.saves for select to authenticated using (id = auth.uid());
create policy saves_insert on public.saves for insert to authenticated with check (id = auth.uid());
create policy saves_update on public.saves for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy saves_delete on public.saves for delete to authenticated using (id = auth.uid());

-- the client writes save, version and play_t only; id, updated_at and the backups belong to the server
revoke all on public.saves from anon, authenticated;
grant select, delete on public.saves to authenticated;
grant insert (save, version, play_t), update (save, version, play_t) on public.saves to authenticated;
