-- Be the Mayor: initial schema (0.1). Towns are public read-only snapshots; each player writes only their own.
-- Likes, signs and help go only through the interact() function: daily cap, no self-likes, once per town per day.
-- Anonymous players use the `authenticated` role, so nothing below trusts that role beyond "this is auth.uid()".

create table public.towns (
  id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  town        text not null check (char_length(town) between 2 and 24 and town ~ '^[[:alnum:] .''-]+$'),
  mayor       text not null check (char_length(mayor) between 2 and 24 and mayor ~ '^[[:alnum:] .''-]+$'),
  rank        smallint not null default 0 check (rank between 0 and 1), -- 0.1 has Labourer and Skilled; raise per release
  title       text not null default 'Labourer' check (char_length(title) <= 32),
  snapshot    jsonb not null check (octet_length(snapshot::text) < 20000 and jsonb_typeof(snapshot) = 'object'),
  likes       integer not null default 0,
  reports     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- tiny word filter for the only free text (names); the client filters too
create function public.clean_name(t text) returns boolean language sql immutable as $$
  select not (lower(t) ~ '(nazi|hitler|fuck|shit|cunt|nigg|faggot|rape)')
$$;
alter table public.towns add constraint towns_clean_names check (public.clean_name(town) and public.clean_name(mayor));

-- rate limit and plausibility: a new snapshot at most once a minute, at most 60 buildings
create function public.towns_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.snapshot is distinct from old.snapshot then
    if old.updated_at > now() - interval '60 seconds' then
      raise exception 'Saving too often, try again in a minute';
    end if;
    new.updated_at := now();
  end if;
  if jsonb_array_length(coalesce(new.snapshot -> 'buildings', '[]'::jsonb)) > 60 then
    raise exception 'Implausible town snapshot';
  end if;
  return new;
end $$;
create trigger towns_guard before insert or update on public.towns for each row execute function public.towns_guard();

alter table public.towns enable row level security;
create policy towns_read   on public.towns for select using (true);
create policy towns_insert on public.towns for insert to authenticated with check (id = auth.uid());
create policy towns_update on public.towns for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy towns_delete on public.towns for delete to authenticated using (id = auth.uid());

-- players may only write their own names and snapshot, never likes or reports
revoke insert, update on public.towns from anon, authenticated;
grant insert (town, mayor, rank, title, snapshot), update (town, mayor, rank, title, snapshot) on public.towns to authenticated;

create table public.interactions (
  id          bigint generated always as identity primary key,
  giver       uuid not null references auth.users (id) on delete cascade,
  town        uuid not null references public.towns (id) on delete cascade,
  kind        text not null check (kind in ('like', 'sign', 'help')),
  phrase      smallint check (phrase between 0 and 99),   -- index into data/signs.json
  problem     text check (char_length(problem) <= 40),     -- a posted problem id
  day         date not null default (now() at time zone 'utc')::date,
  created_at  timestamptz not null default now()
);
create unique index interactions_once_per_day on public.interactions (giver, town, kind, day);
create index interactions_town on public.interactions (town, created_at desc);

alter table public.interactions enable row level security;
create policy interactions_read on public.interactions for select using (true); -- preset phrases only, nothing private
revoke insert, update, delete on public.interactions from anon, authenticated;

create function public.interact(p_town uuid, p_kind text, p_phrase smallint default null, p_problem text default null)
returns json language plpgsql security definer set search_path = public as $$
declare given int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_town = auth.uid() then raise exception 'That is your own town'; end if;
  if p_kind = 'sign' and p_phrase is null then raise exception 'Pick a sign'; end if;
  if p_kind = 'help' and p_problem is null then raise exception 'Pick a problem to help with'; end if;
  select count(*) into given from interactions where giver = auth.uid() and day = (now() at time zone 'utc')::date;
  if given >= 20 then raise exception 'That is enough helping for today, come back tomorrow'; end if;
  insert into interactions (giver, town, kind, phrase, problem)
    values (auth.uid(), p_town, p_kind, case when p_kind = 'sign' then p_phrase end, case when p_kind = 'help' then p_problem end);
  if p_kind = 'like' then update towns set likes = likes + 1 where id = p_town; end if;
  return json_build_object('ok', true);
exception when unique_violation then
  raise exception 'Already done for this town today';
end $$;
revoke all on function public.interact(uuid, text, smallint, text) from public, anon;
grant execute on function public.interact(uuid, text, smallint, text) to authenticated;
