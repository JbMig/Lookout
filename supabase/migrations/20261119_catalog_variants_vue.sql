-- Vue en lecture seule pour les agents Holo 3 et 4, qui lisent les teintes du catalogue dans « catalog_variants ».
-- Les teintes sont stockées dans catalog_products.variants (tableau JSON) : la vue les expose ligne par ligne.
-- security_invoker : la vue applique les mêmes règles d'accès (RLS) que catalog_products, sans rien ouvrir de plus.
create or replace view public.catalog_variants
with (security_invoker = true) as
select
  md5(p.id::text || ':' || coalesce(v.elem->>'code', '') || ':' || coalesce(v.elem->>'name', '') || ':' || v.ord::text)::uuid as id,
  p.id as product_id,
  v.elem->>'name' as shade_name,
  v.elem->>'code' as shade_code,
  v.elem->>'hex_code' as hex_code,
  v.elem->>'color_family' as family,
  case lower(coalesce(v.elem->>'available', '')) when 'false' then false else true end as is_active,
  v.ord::int as position
from public.catalog_products p
cross join lateral jsonb_array_elements(case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end) with ordinality as v(elem, ord);

grant select on public.catalog_variants to anon, authenticated, service_role;
