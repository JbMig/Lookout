-- save_report : l'Agent 4 peut enregistrer son rapport en plusieurs appels (même share_slug).
-- Chaque appel fusionne ses sections dans data (et config) au lieu de remplacer tout le contenu.
-- Un rapport envoyé en un seul appel donne exactement le même résultat qu'avant.
create or replace function public.save_report(
  p_title text default 'Benchmark Report',
  p_type text default 'dashboard',
  p_status text default 'ready',
  p_config jsonb default '{}'::jsonb,
  p_data jsonb default '{}'::jsonb,
  p_share_slug text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  insert into public.reports (title, type, status, config, data, share_slug)
  values (p_title, p_type, p_status, coalesce(p_config, '{}'::jsonb), coalesce(p_data, '{}'::jsonb), p_share_slug)
  on conflict (share_slug) do update set
    title = excluded.title,
    type = excluded.type,
    status = excluded.status,
    config = coalesce(reports.config, '{}'::jsonb) || excluded.config,
    data = coalesce(reports.data, '{}'::jsonb) || excluded.data,
    updated_at = now()
  returning jsonb_build_object('id', id, 'share_slug', share_slug, 'status', status)
  into v_result;

  return v_result;
end;
$function$;
