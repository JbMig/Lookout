-- Réglages de l'application (configuration des agents, journal des déclenchements).
-- Une ligne par clé : « agent_config » (marque, zone, catégorie, formats, URL de départ),
-- « agent_runs » (derniers déclenchements depuis le site).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
create policy "authenticated full access" on public.app_settings
  for all to authenticated using (true) with check (true);
