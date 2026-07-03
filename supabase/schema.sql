-- SURV shared backend schema (Supabase/Postgres).
-- Mirrors src/engine/types.ts. Run in the Supabase SQL editor once, top to bottom.

-- ---------- identity ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null,
  name text not null,
  avatar text not null default '🦉',
  bio text not null default '',
  clout numeric not null default 30 check (clout between 1 and 100),
  connectors text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table category_sage (
  user_id uuid references profiles on delete cascade,
  category text not null,
  sage numeric not null default 30 check (sage between 1 and 100),
  primary key (user_id, category)
);

create table pair_trust (
  asker_id uuid references profiles on delete cascade,
  voter_id uuid references profiles on delete cascade,
  trust numeric not null default 0.5 check (trust between 0 and 1),
  primary key (asker_id, voter_id)
);

-- ---------- nests ----------
create table nests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🪺',
  owner_id uuid not null references profiles,
  created_at timestamptz not null default now()
);

create table nest_members (
  nest_id uuid references nests on delete cascade,
  user_id uuid references profiles on delete cascade,
  tier text not null default 'regular' check (tier in ('inner','regular','outer')),
  primary key (nest_id, user_id)
);

-- ---------- survs ----------
create table survs (
  id uuid primary key default gen_random_uuid(),
  asker_id uuid not null references profiles,
  question text not null check (char_length(question) <= 140),
  category text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'live' check (status in ('live','deciding','acted','graded')),
  acted_option_id uuid,
  outcome text check (outcome in ('good','bad'))
);

create table surv_nests (
  surv_id uuid references survs on delete cascade,
  nest_id uuid references nests on delete cascade,
  primary key (surv_id, nest_id)
);

create table surv_options (
  id uuid primary key default gen_random_uuid(),
  surv_id uuid not null references survs on delete cascade,
  label text not null,
  source text not null default 'user',
  why text
);

create table votes (
  surv_id uuid references survs on delete cascade,
  voter_id uuid references profiles on delete cascade,
  option_id uuid not null references surv_options,
  weight numeric not null,
  voted_at timestamptz not null default now(),
  primary key (surv_id, voter_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  surv_id uuid not null references survs on delete cascade,
  user_id uuid not null references profiles,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- visibility helper ----------
create or replace function can_see_surv(s survs) returns boolean
language sql stable security definer as $$
  select s.is_public
      or s.asker_id = auth.uid()
      or exists (
        select 1 from surv_nests sn
        join nest_members nm on nm.nest_id = sn.nest_id
        where sn.surv_id = s.id and nm.user_id = auth.uid()
      );
$$;

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table category_sage enable row level security;
alter table pair_trust enable row level security;
alter table nests enable row level security;
alter table nest_members enable row level security;
alter table survs enable row level security;
alter table surv_nests enable row level security;
alter table surv_options enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "own profile write" on profiles for update using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());

create policy "sage readable" on category_sage for select using (true);
create policy "trust readable by asker" on pair_trust for select using (asker_id = auth.uid());

create policy "nests readable by members" on nests for select
  using (owner_id = auth.uid() or exists (select 1 from nest_members where nest_id = id and user_id = auth.uid()));
create policy "nests owner insert" on nests for insert with check (owner_id = auth.uid());
create policy "nests owner update" on nests for update using (owner_id = auth.uid());

create policy "members readable" on nest_members for select
  using (exists (select 1 from nest_members me where me.nest_id = nest_id and me.user_id = auth.uid()));
create policy "members managed by owner" on nest_members for all
  using (exists (select 1 from nests n where n.id = nest_id and n.owner_id = auth.uid()));

create policy "survs visible" on survs for select using (can_see_surv(survs));
create policy "survs asker insert" on survs for insert with check (asker_id = auth.uid());
create policy "survs asker update" on survs for update using (asker_id = auth.uid());

create policy "surv_nests visible" on surv_nests for select using (true);
create policy "surv_nests asker" on surv_nests for insert
  with check (exists (select 1 from survs s where s.id = surv_id and s.asker_id = auth.uid()));

create policy "options visible" on surv_options for select
  using (exists (select 1 from survs s where s.id = surv_id and can_see_surv(s)));
create policy "options asker insert" on surv_options for insert
  with check (exists (select 1 from survs s where s.id = surv_id and s.asker_id = auth.uid()));

create policy "votes visible" on votes for select
  using (exists (select 1 from survs s where s.id = surv_id and can_see_surv(s)));
create policy "vote once yourself" on votes for insert
  with check (voter_id = auth.uid()
    and exists (select 1 from survs s where s.id = surv_id and s.status = 'live' and can_see_surv(s)));

create policy "comments visible" on comments for select
  using (exists (select 1 from survs s where s.id = surv_id and can_see_surv(s)));
create policy "comment yourself" on comments for insert with check (user_id = auth.uid());

-- ---------- the SAGE learning step (server-side, mirrors src/engine/sage.ts) ----------
create or replace function grade_surv(p_surv uuid, p_outcome text)
returns void language plpgsql security definer as $$
declare
  s survs%rowtype;
  v record;
  aligned boolean;
  cur numeric;
  sage_delta numeric;
  clout_delta numeric;
  trust_delta numeric;
begin
  select * into s from survs where id = p_surv;
  if s.asker_id <> auth.uid() then raise exception 'only the asker can grade'; end if;
  if s.status <> 'acted' or s.acted_option_id is null then raise exception 'surv not acted'; end if;
  if p_outcome not in ('good','bad') then raise exception 'bad outcome'; end if;

  for v in select * from votes where surv_id = p_surv and voter_id <> s.asker_id loop
    aligned := v.option_id = s.acted_option_id;
    select coalesce((select sage from category_sage where user_id = v.voter_id and category = s.category), 30) into cur;
    if p_outcome = 'good' then
      sage_delta := case when aligned then 4 * (100 - cur) / 70 else -1 end;
      clout_delta := case when aligned then 1 else 0 end;
      trust_delta := case when aligned then 0.08 else -0.04 end;
    else
      sage_delta := case when aligned then -3 else 2 end;
      clout_delta := case when aligned then -1 else 1 end;
      trust_delta := case when aligned then -0.08 else 0.08 end;
    end if;

    insert into category_sage (user_id, category, sage)
      values (v.voter_id, s.category, least(100, greatest(1, cur + sage_delta)))
      on conflict (user_id, category)
      do update set sage = least(100, greatest(1, category_sage.sage + sage_delta));

    update profiles set clout = least(100, greatest(1, clout + clout_delta)) where id = v.voter_id;

    insert into pair_trust (asker_id, voter_id, trust)
      values (s.asker_id, v.voter_id, least(1, greatest(0, 0.5 + trust_delta)))
      on conflict (asker_id, voter_id)
      do update set trust = least(1, greatest(0, pair_trust.trust + trust_delta));
  end loop;

  update profiles set clout = least(100, clout + 1) where id = s.asker_id;
  update survs set status = 'graded', outcome = p_outcome where id = p_surv;
end $$;

-- ---------- realtime ----------
-- Dashboard → Database → Replication: enable realtime on survs, votes, comments.
