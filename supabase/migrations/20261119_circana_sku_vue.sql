-- Vue de lecture pour les agents Holo (analyse et dashboard) : les ventes Circana au niveau SKU du DERNIER import,
-- sans les lignes d'anciens imports du même fichier (sinon les montants sont comptés deux fois).
-- format = sous-segment (liquide, compact, creme, stick) ; country = US ou FR ; revenue en unité monétaire réelle.
create or replace view public.circana_sku
with (security_invoker = true) as
with dernier as (
  -- dernier import contenant des lignes SKU (lu dans circana_sales, que les agents peuvent lire avec la clé publique)
  select s.import_id as id from public.circana_sales s
  where s.raw->>'niveau' = 'sku'
  order by s.created_at desc limit 1
)
select
  s.id, s.import_id, s.period, extract(year from s.period)::int as annee,
  s.country, s.brand, s.product_name, s.segment as categorie, s.subsegment as format,
  s.raw->>'teinte' as teinte, (s.raw->>'rang')::int as rang,
  coalesce((s.raw->>'est_nouveaute')::boolean, false) as est_nouveaute,
  s.revenue, s.currency, s.product_key
from public.circana_sales s
join dernier d on d.id = s.import_id
where s.raw->>'niveau' = 'sku';

grant select on public.circana_sku to anon, authenticated, service_role;
