-- CashGlome: every person's data, synced between their devices.
--
-- Shape: one row per thing (entry, goal, memory) plus one profile row per person.
-- The app is local-first: each device keeps a full copy and syncs changes both ways.
--   * updated_ms  — when the person last changed it, in the device's clock (ms). Newest wins.
--   * deleted     — a tombstone, so a delete on one device reaches the others.
--   * synced_at   — set by the server on every write; devices pull "everything after my last synced_at".
-- Row-level security: a signed-in person can only ever see or change their own rows.
-- Never stored here: the Meta Muse API key, Spotify tokens, and photos (those stay on the device).

-- ——— Helpers ———————————————————————————————————————————————

create or replace function public.cg_touch() returns trigger
language plpgsql as $$
begin
  -- An older edit arriving late (from an offline device) never overwrites a newer one.
  if tg_op = 'UPDATE' and new.updated_ms < old.updated_ms then
    return old;
  end if;
  new.synced_at := now();
  return new;
end $$;

-- ——— Profile: name, currency, settings, and small bits of app state ———

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  currency    text not null default 'USD',
  settings    jsonb not null default '{}'::jsonb,   -- theme, sound, reminder, music… (never the AI key)
  extras      jsonb not null default '{}'::jsonb,   -- stickers seen, restoration seen, routine check-ins
  created_at  timestamptz not null default now(),
  updated_ms  bigint not null default 0,
  synced_at   timestamptz not null default now()
);

-- ——— Entries: every line of money, in or out ——————————————————

create table if not exists public.entries (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  date        date,
  amount      numeric(18, 2),
  dir         text check (dir in ('in', 'out')),
  category    text,
  label       text,
  text        text,                 -- what the person wrote, word for word
  feeling     text check (feeling in ('joy', 'meh', 'regret')),
  source      text,                 -- oracle | muse | manual | routine
  confidence  real,
  routine_id  text,                 -- the memory that wrote it, if a routine did
  created_ms  bigint,
  updated_ms  bigint not null,
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists entries_pull on public.entries (user_id, synced_at);
create index if not exists entries_by_date on public.entries (user_id, date) where not deleted;

-- ——— Goals ————————————————————————————————————————————————

create table if not exists public.goals (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  name        text,
  amount      numeric(18, 2),
  emoji       text,
  updated_ms  bigint not null,
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists goals_pull on public.goals (user_id, synced_at);

-- ——— Memories: routines, balances, pay days, notes ———————————————
-- Edit history and "recently forgotten" live inside data, so restore works on every device.

create table if not exists public.memories (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  kind        text not null check (kind in ('routine', 'balance', 'income', 'note')),
  data        jsonb not null,
  updated_ms  bigint not null,
  deleted     boolean not null default false,   -- true once forgotten for good
  synced_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists memories_pull on public.memories (user_id, synced_at);

-- ——— Triggers ———————————————————————————————————————————————

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles for each row execute function public.cg_touch();
drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries for each row execute function public.cg_touch();
drop trigger if exists goals_touch on public.goals;
create trigger goals_touch before insert or update on public.goals for each row execute function public.cg_touch();
drop trigger if exists memories_touch on public.memories;
create trigger memories_touch before insert or update on public.memories for each row execute function public.cg_touch();

-- ——— Row-level security: your rows, only yours ——————————————————

alter table public.profiles enable row level security;
alter table public.entries  enable row level security;
alter table public.goals    enable row level security;
alter table public.memories enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'entries', 'goals', 'memories'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ——— Delete my account ————————————————————————————————————
-- Lets a signed-in person erase their account and, through the foreign keys, every row they own (GDPR art. 17).

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
