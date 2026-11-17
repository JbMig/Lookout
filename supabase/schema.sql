-- =====================================================================
-- Lookout : schéma Supabase complet
-- À exécuter une fois dans Supabase > SQL Editor (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Comptes et organisations ----------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'trial' check (plan in ('trial','pro','enterprise')),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'analyst' check (role in ('owner','admin','analyst','viewer')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null,
  role        text not null default 'analyst' check (role in ('owner','admin','analyst','viewer')),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- Catalogue de sites (partagé entre tous les clients) ----------

create table if not exists public.sites (
  id               uuid primary key default gen_random_uuid(),
  domain           text not null unique,
  name             text not null,
  zone             text not null check (zone in ('US','EU')),
  country          text not null default '',
  type             text not null default 'revendeur' check (type in ('revendeur','marque','marketplace')),
  categories       jsonb not null default '[]',
  status           text not null default 'untested'
                   check (status in ('untested','scraping','linkup','computer_use','needs_review','blocked','requested')),
  cu_instructions  text,           -- parcours de computer use enregistré par l'équipe
  notes            text,
  requested_by_org uuid references public.organizations(id) on delete set null,
  last_success_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------- Analyses ----------

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  created_by   uuid references public.profiles(id) on delete set null,
  name         text not null,
  category     text not null default '',
  params       jsonb not null default '{}',
  status       text not null default 'collecting' check (status in ('collecting','analyzing','done','failed')),
  stats        jsonb,
  analysis     text,
  trends       jsonb,
  catalog      jsonb,
  share_token  text unique,
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists reports_org_idx on public.reports(org_id, created_at desc);

create table if not exists public.report_items (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  position    int  not null,
  circana     jsonb not null,
  status      text not null default 'pending'
              check (status in ('pending','collecting','navigating','awaiting_team','done','partial','failed')),
  method      text,
  site_domain text,
  session_id  text,
  product     jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists report_items_report_idx on public.report_items(report_id, position);
create index if not exists report_items_status_idx on public.report_items(status);

create table if not exists public.client_products (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.reports(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  data          jsonb not null,
  match_item_id uuid references public.report_items(id) on delete set null,
  match_score   real,
  created_at    timestamptz not null default now()
);
create index if not exists client_products_report_idx on public.client_products(report_id);

-- ---------- Suivi des appels aux services (coûts) ----------

create table if not exists public.agent_runs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete set null,
  report_id   uuid references public.reports(id) on delete set null,
  service     text not null check (service in ('linkup','hcompany','huggingface','scraping')),
  action      text not null,
  ok          boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists agent_runs_created_idx on public.agent_runs(created_at desc);

-- =====================================================================
-- Sécurité (RLS)
-- Le serveur Next.js utilise la clé service_role, qui contourne la RLS,
-- et filtre lui-même par organisation. Les politiques ci-dessous protègent
-- les données si un client accède un jour directement à Supabase.
-- =====================================================================

create or replace function public.is_member(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = target and m.user_id = auth.uid());
$$;

alter table public.organizations   enable row level security;
alter table public.profiles        enable row level security;
alter table public.memberships     enable row level security;
alter table public.invitations     enable row level security;
alter table public.sites           enable row level security;
alter table public.reports         enable row level security;
alter table public.report_items    enable row level security;
alter table public.client_products enable row level security;
alter table public.agent_runs      enable row level security;

drop policy if exists "org members read org" on public.organizations;
create policy "org members read org" on public.organizations for select using (public.is_member(id));

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid());

drop policy if exists "members read memberships" on public.memberships;
create policy "members read memberships" on public.memberships for select using (public.is_member(org_id));

drop policy if exists "members read invitations" on public.invitations;
create policy "members read invitations" on public.invitations for select using (public.is_member(org_id));

drop policy if exists "authenticated read sites" on public.sites;
create policy "authenticated read sites" on public.sites for select to authenticated using (status <> 'requested');

drop policy if exists "members read reports" on public.reports;
create policy "members read reports" on public.reports for select using (public.is_member(org_id));

drop policy if exists "members read items" on public.report_items;
create policy "members read items" on public.report_items for select using (public.is_member(org_id));

drop policy if exists "members read client products" on public.client_products;
create policy "members read client products" on public.client_products for select using (public.is_member(org_id));
-- agent_runs : aucun accès direct (réservé au serveur).

-- =====================================================================
-- Catalogue de départ (à compléter depuis l'administration)
-- =====================================================================

insert into public.sites (domain, name, zone, country, type, categories, status) values
  ('sephora.com',       'Sephora US',        'US', 'États-Unis',  'revendeur', '["maquillage","soin","parfum"]', 'untested'),
  ('ulta.com',          'Ulta Beauty',       'US', 'États-Unis',  'revendeur', '["maquillage","soin"]',          'untested'),
  ('nordstrom.com',     'Nordstrom',         'US', 'États-Unis',  'revendeur', '["maquillage","soin","parfum"]', 'untested'),
  ('sephora.fr',        'Sephora France',    'EU', 'France',      'revendeur', '["maquillage","soin","parfum"]', 'untested'),
  ('douglas.de',        'Douglas',           'EU', 'Allemagne',   'revendeur', '["maquillage","soin","parfum"]', 'untested'),
  ('notino.fr',         'Notino',            'EU', 'France',      'revendeur', '["maquillage","soin","parfum"]', 'untested'),
  ('lookfantastic.fr',  'Lookfantastic',     'EU', 'France',      'revendeur', '["maquillage","soin"]',          'untested'),
  ('boots.com',         'Boots',             'EU', 'Royaume-Uni', 'revendeur', '["maquillage","soin"]',          'untested')
on conflict (domain) do nothing;
