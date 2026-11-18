-- Table des sites surveillés par Lookout.
-- Les sites de départ sont insérés ici ; ceux rencontrés pendant une analyse sont ajoutés
-- automatiquement par l'application (source = 'discovered').

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  name text not null,
  zone text not null check (zone in ('US', 'EU')),
  country text,
  type text not null default 'revendeur' check (type in ('revendeur', 'marque', 'marketplace')),
  categories text[] not null default '{}',
  method text not null default 'untested'
    check (method in ('untested', 'scraping', 'linkup', 'computer_use', 'blocked')),
  cu_instructions text,
  source text not null default 'catalog' check (source in ('catalog', 'discovered')),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sites_updated_at before update on public.sites
  for each row execute function public.set_updated_at();

alter table public.sites enable row level security;
create policy "authenticated full access" on public.sites
  for all to authenticated using (true) with check (true);

insert into public.sites (domain, name, zone, country, type, categories) values
  ('sephora.com', 'Sephora US', 'US', 'États-Unis', 'revendeur', '{maquillage,soin,parfum}'),
  ('ulta.com', 'Ulta Beauty', 'US', 'États-Unis', 'revendeur', '{maquillage,soin}'),
  ('nordstrom.com', 'Nordstrom', 'US', 'États-Unis', 'revendeur', '{maquillage,soin,parfum}'),
  ('sephora.fr', 'Sephora France', 'EU', 'France', 'revendeur', '{maquillage,soin,parfum}'),
  ('douglas.de', 'Douglas', 'EU', 'Allemagne', 'revendeur', '{maquillage,soin,parfum}'),
  ('notino.fr', 'Notino', 'EU', 'France', 'revendeur', '{maquillage,soin,parfum}'),
  ('lookfantastic.fr', 'Lookfantastic', 'EU', 'France', 'revendeur', '{maquillage,soin}'),
  ('boots.com', 'Boots', 'EU', 'Royaume-Uni', 'revendeur', '{maquillage,soin}')
on conflict (domain) do nothing;
