-- Historique des recherches Prisme, affiché dans « Social listening ».
-- Chaque recherche enregistre le dashboard complet (resultat) pour être rouvert à l'identique.
create table if not exists public.prisme_analyses (
  id uuid primary key default gen_random_uuid(),
  sujet text not null,
  question text,
  pays text,
  veille_id text,
  titre text,
  accroche text,
  resultat jsonb not null,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists prisme_analyses_created_at_idx on public.prisme_analyses (created_at desc);
alter table public.prisme_analyses enable row level security;
create policy "authenticated full access" on public.prisme_analyses for all to authenticated using (true) with check (true);
