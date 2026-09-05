-- MOMENTUM — Nutrition pendant une activité V1.
-- Les compositions sont exprimées par unité de référence et copiées dans
-- chaque activité afin de conserver un historique nutritionnel immuable.

create table if not exists public.nutrition_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  brand text check (brand is null or length(trim(brand)) <= 120),
  category text not null check (category in ('drink', 'gel', 'bar', 'puree', 'fruit', 'other')),
  unit_label text not null check (length(trim(unit_label)) between 1 and 80),
  serving_size numeric not null default 1 check (serving_size > 0),
  serving_volume_ml numeric check (serving_volume_ml is null or serving_volume_ml > 0),
  carbohydrates_g numeric not null default 0 check (carbohydrates_g >= 0),
  sodium_mg numeric not null default 0 check (sodium_mg >= 0),
  caffeine_mg numeric not null default 0 check (caffeine_mg >= 0),
  potassium_mg numeric not null default 0 check (potassium_mg >= 0),
  magnesium_mg numeric not null default 0 check (magnesium_mg >= 0),
  calcium_mg numeric not null default 0 check (calcium_mg >= 0),
  bicarbonate_mg numeric not null default 0 check (bicarbonate_mg >= 0),
  zinc_mg numeric not null default 0 check (zinc_mg >= 0),
  extra_nutrients jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extra_nutrients) = 'object'),
  is_approximate boolean not null default false,
  source_url text,
  is_global boolean not null default false,
  created_by uuid references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_global and created_by is null)
    or (not is_global and created_by is not null)
  )
);

create unique index if not exists nutrition_products_global_identity_idx
  on public.nutrition_products (
    lower(coalesce(brand, '')),
    lower(name)
  )
  where is_global;

create index if not exists nutrition_products_owner_active_idx
  on public.nutrition_products(created_by, is_active)
  where not is_global;

create index if not exists nutrition_products_category_active_idx
  on public.nutrition_products(category, name)
  where is_active;

create table if not exists public.activity_nutrition_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  product_id uuid not null references public.nutrition_products(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  product_name_snapshot text not null,
  brand_snapshot text,
  unit_label_snapshot text not null,
  carbohydrates_g_snapshot numeric not null default 0 check (carbohydrates_g_snapshot >= 0),
  sodium_mg_snapshot numeric not null default 0 check (sodium_mg_snapshot >= 0),
  caffeine_mg_snapshot numeric not null default 0 check (caffeine_mg_snapshot >= 0),
  potassium_mg_snapshot numeric not null default 0 check (potassium_mg_snapshot >= 0),
  magnesium_mg_snapshot numeric not null default 0 check (magnesium_mg_snapshot >= 0),
  calcium_mg_snapshot numeric not null default 0 check (calcium_mg_snapshot >= 0),
  bicarbonate_mg_snapshot numeric not null default 0 check (bicarbonate_mg_snapshot >= 0),
  zinc_mg_snapshot numeric not null default 0 check (zinc_mg_snapshot >= 0),
  extra_nutrients_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extra_nutrients_snapshot) = 'object'),
  is_approximate_snapshot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, product_id)
);

create index if not exists activity_nutrition_items_activity_idx
  on public.activity_nutrition_items(activity_id);

create index if not exists activity_nutrition_items_product_idx
  on public.activity_nutrition_items(product_id);

alter table public.nutrition_products enable row level security;
alter table public.activity_nutrition_items enable row level security;

revoke all privileges on table public.nutrition_products
  from anon, authenticated;
revoke all privileges on table public.activity_nutrition_items
  from anon, authenticated;

grant select, insert, update, delete
  on table public.nutrition_products
  to authenticated;
grant select, insert, update, delete
  on table public.activity_nutrition_items
  to authenticated;

create policy "Users read global and own nutrition products"
  on public.nutrition_products for select to authenticated
  using (
    (is_global and is_active)
    or (not is_global and created_by = (select auth.uid()))
  );

create policy "Users create own nutrition products"
  on public.nutrition_products for insert to authenticated
  with check (
    not is_global
    and created_by = (select auth.uid())
  );

create policy "Users update own nutrition products"
  on public.nutrition_products for update to authenticated
  using (
    not is_global
    and created_by = (select auth.uid())
  )
  with check (
    not is_global
    and created_by = (select auth.uid())
  );

create policy "Users delete own nutrition products"
  on public.nutrition_products for delete to authenticated
  using (
    not is_global
    and created_by = (select auth.uid())
  );

create policy "Users read nutrition from own activities"
  on public.activity_nutrition_items for select to authenticated
  using (
    exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users add nutrition to own activities"
  on public.activity_nutrition_items for insert to authenticated
  with check (
    exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.nutrition_products
      where nutrition_products.id = product_id
        and (
          (nutrition_products.is_global and nutrition_products.is_active)
          or (
            not nutrition_products.is_global
            and nutrition_products.created_by = (select auth.uid())
          )
        )
    )
  );

create policy "Users update nutrition from own activities"
  on public.activity_nutrition_items for update to authenticated
  using (
    exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users delete nutrition from own activities"
  on public.activity_nutrition_items for delete to authenticated
  using (
    exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

drop trigger if exists set_nutrition_products_updated_at
  on public.nutrition_products;
create trigger set_nutrition_products_updated_at
  before update on public.nutrition_products
  for each row execute function public.set_updated_at();

drop trigger if exists set_activity_nutrition_items_updated_at
  on public.activity_nutrition_items;
create trigger set_activity_nutrition_items_updated_at
  before update on public.activity_nutrition_items
  for each row execute function public.set_updated_at();

create or replace function public.snapshot_activity_nutrition_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product public.nutrition_products%rowtype;
begin
  select * into product
  from public.nutrition_products
  where id = new.product_id;

  if not found then
    raise exception 'Nutrition product is unavailable'
      using errcode = '42501';
  end if;

  new.product_name_snapshot := product.name;
  new.brand_snapshot := product.brand;
  new.unit_label_snapshot := product.unit_label;
  new.carbohydrates_g_snapshot := product.carbohydrates_g;
  new.sodium_mg_snapshot := product.sodium_mg;
  new.caffeine_mg_snapshot := product.caffeine_mg;
  new.potassium_mg_snapshot := product.potassium_mg;
  new.magnesium_mg_snapshot := product.magnesium_mg;
  new.calcium_mg_snapshot := product.calcium_mg;
  new.bicarbonate_mg_snapshot := product.bicarbonate_mg;
  new.zinc_mg_snapshot := product.zinc_mg;
  new.extra_nutrients_snapshot := product.extra_nutrients;
  new.is_approximate_snapshot := product.is_approximate;
  return new;
end;
$$;

revoke all on function public.snapshot_activity_nutrition_item() from public;

drop trigger if exists snapshot_activity_nutrition_item
  on public.activity_nutrition_items;
create trigger snapshot_activity_nutrition_item
  before insert or update of product_id on public.activity_nutrition_items
  for each row execute function public.snapshot_activity_nutrition_item();

-- Un seul appel navigateur, une seule transaction. Les snapshots existants
-- restent inchangés quand seule la quantité est modifiée.
create or replace function public.save_activity_nutrition(
  p_activity_id uuid,
  p_items jsonb
)
returns setof public.activity_nutrition_items
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Nutrition items must be a JSON array'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.activities
    where activities.id = p_activity_id
      and activities.user_id = (select auth.uid())
  ) then
    raise exception 'Activity is unavailable'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where not (item.value ? 'product_id')
      or not (item.value ? 'quantity')
      or (item.value ->> 'quantity')::numeric <= 0
  ) then
    raise exception 'Every nutrition item needs a product and positive quantity'
      using errcode = '22023';
  end if;

  if (
    select count(distinct (item.value ->> 'product_id')::uuid)
    from jsonb_array_elements(p_items) as item(value)
  ) <> jsonb_array_length(p_items) then
    raise exception 'Duplicate nutrition product'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.nutrition_products
    where id in (
      select (item.value ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as item(value)
    )
  ) <> jsonb_array_length(p_items) then
    raise exception 'Nutrition product is unavailable'
      using errcode = '42501';
  end if;

  delete from public.activity_nutrition_items
  where activity_id = p_activity_id
    and product_id not in (
      select (item.value ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as item(value)
    );

  insert into public.activity_nutrition_items (
    activity_id,
    product_id,
    quantity,
    product_name_snapshot,
    unit_label_snapshot
  )
  select
    p_activity_id,
    (item.value ->> 'product_id')::uuid,
    (item.value ->> 'quantity')::numeric,
    '',
    ''
  from jsonb_array_elements(p_items) as item(value)
  on conflict (activity_id, product_id) do update
    set quantity = excluded.quantity;

  return query
  select *
  from public.activity_nutrition_items
  where activity_id = p_activity_id
  order by created_at, id;
end;
$$;

revoke all on function public.save_activity_nutrition(uuid, jsonb)
  from public, anon;
grant execute on function public.save_activity_nutrition(uuid, jsonb)
  to authenticated;

-- Sources fabricants consultées le 5 septembre 2026. Les aliments naturels
-- sont volontairement marqués comme approximatifs.
insert into public.nutrition_products (
  id, name, brand, category, unit_label, serving_size, serving_volume_ml,
  carbohydrates_g, sodium_mg, caffeine_mg, potassium_mg, magnesium_mg,
  calcium_mg, bicarbonate_mg, zinc_mg, is_approximate, source_url,
  is_global, created_by
)
values
  ('7e100000-0000-4000-8000-000000000001', 'Gel 100', 'Maurten', 'gel', 'gel', 1, null, 25, 20, 0, 0, 0, 0, 0, 0, false, 'https://www.maurten.com.au/products/gel-100', true, null),
  ('7e100000-0000-4000-8000-000000000002', 'Gel 100 CAF 100', 'Maurten', 'gel', 'gel', 1, null, 25, 22, 100, 0, 0, 0, 0, 0, false, 'https://www.maurten.com.au/products/gel-100-caf-100', true, null),
  ('7e100000-0000-4000-8000-000000000003', 'Gel 160', 'Maurten', 'gel', 'gel', 1, null, 40, 30, 0, 0, 0, 0, 0, 0, false, 'https://www.maurten.com.au/products/gel-160-box-of-12', true, null),
  ('7e100000-0000-4000-8000-000000000004', 'Drink Mix 160', 'Maurten', 'drink', 'bidon 500 ml', 1, 500, 40, 210, 0, 0, 0, 0, 0, 0, false, 'https://www.maurten.com.au/products/drink-mix-160', true, null),
  ('7e100000-0000-4000-8000-000000000005', 'Drink Mix 320', 'Maurten', 'drink', 'bidon 500 ml', 1, 500, 80, 245, 0, 0, 0, 0, 0, 0, false, 'https://www.maurten.com.au/products/drink-mix-320', true, null),
  ('7e100000-0000-4000-8000-000000000006', 'Drink Mix 320 CAF 100', 'Maurten', 'drink', 'bidon 500 ml', 1, 500, 80, 245, 100, 0, 0, 0, 0, 0, false, 'https://www.maurten.com.au/products/drink-mix-320-caf-100', true, null),
  ('7e100000-0000-4000-8000-000000000007', 'Solid 225', 'Maurten', 'bar', 'barre', 1, null, 44, 260, 0, 0, 0, 0, 0, 0, false, 'https://www.maurten.com/fr/fuelguide', true, null),
  ('7e100000-0000-4000-8000-000000000008', 'Solid 225 C', 'Maurten', 'bar', 'barre', 1, null, 44, 260, 0, 0, 0, 0, 0, 0, false, 'https://www.maurten.com/fr/fuelguide', true, null),
  ('7e100000-0000-4000-8000-000000000009', 'ULTRA Drink Mix 250 · Lime', 'Näak', 'drink', 'bidon 500 ml', 1, 500, 50, 400, 0, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/collections/all', true, null),
  ('7e100000-0000-4000-8000-000000000010', 'ULTRA Drink Mix 250 · Watermelon', 'Näak', 'drink', 'bidon 500 ml', 1, 500, 50, 400, 0, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/collections/all', true, null),
  ('7e100000-0000-4000-8000-000000000011', 'ULTRA Drink Mix 250 · Pineapple Ginseng', 'Näak', 'drink', 'bidon 500 ml', 1, 500, 50, 400, 0, 0, 0, 0, 0, 0, false, 'https://www.naak.com/collections/all', true, null),
  ('7e100000-0000-4000-8000-000000000012', 'ULTRA Gel 200 · Salted Maple', 'Näak', 'gel', 'gel', 1, null, 23, 190, 0, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/collections/all', true, null),
  ('7e100000-0000-4000-8000-000000000013', 'ULTRA Gel 200 · Chocolate', 'Näak', 'gel', 'gel', 1, null, 23, 190, 35, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/collections/all', true, null),
  ('7e100000-0000-4000-8000-000000000014', 'ULTRA Bar 200 · Peanut Butter & Chocolate', 'Näak', 'bar', 'barre', 1, null, 27, 180, 0, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/products/ultra-bar-200-peanut-chocolate', true, null),
  ('7e100000-0000-4000-8000-000000000015', 'ULTRA Bar 200 · Berries & Nuts', 'Näak', 'bar', 'barre', 1, null, 27, 190, 0, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/products/ultra-bar-200-berries-nuts', true, null),
  ('7e100000-0000-4000-8000-000000000016', 'ULTRA Waffle 140 · Maple Syrup', 'Näak', 'bar', 'gaufre', 1, null, 21, 160, 0, 0, 0, 0, 0, 0, false, 'https://www.naak.com/products/ultra-waffle-140-maple-syrup', true, null),
  ('7e100000-0000-4000-8000-000000000017', 'ULTRA Waffle 140 · Berries', 'Näak', 'bar', 'gaufre', 1, null, 21, 140, 0, 0, 0, 0, 0, 0, false, 'https://www.naak.com/products/ultra-waffle-140-berries', true, null),
  ('7e100000-0000-4000-8000-000000000018', 'ULTRA Purée 200 · Apple & Maple Syrup', 'Näak', 'puree', 'purée', 1, null, 25, 160, 0, 0, 0, 0, 0, 0, false, 'https://www.naak.com/products/ultra-puree-200-apple-maple-syrup', true, null),
  ('7e100000-0000-4000-8000-000000000019', 'ULTRA Purée 200 · Apple Strawberry', 'Näak', 'puree', 'purée', 1, null, 25, 180, 0, 0, 0, 0, 0, 0, false, 'https://eu.naak.com/collections/all', true, null),
  ('7e100000-0000-4000-8000-000000000020', 'Boisson électrolytes zéro calorie · Citron / Citron vert', 'OVERSTIM.s', 'drink', 'bidon 500 ml', 8, 500, 0, 313, 0, 761, 151, 307, 1500, 3.9, false, 'https://www.overstims.com/', true, null),
  ('7e100000-0000-4000-8000-000000000021', 'Banane', null, 'fruit', 'fruit', 1, null, 25, 1, 0, 422, 32, 6, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000022', 'Pomme', null, 'fruit', 'fruit', 1, null, 25, 2, 0, 195, 9, 11, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000023', 'Orange', null, 'fruit', 'fruit', 1, null, 15, 0, 0, 237, 15, 60, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000024', 'Clémentine', null, 'fruit', 'fruit', 1, null, 9, 1, 0, 131, 7, 22, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000025', 'Datte Medjool', null, 'fruit', 'datte', 1, null, 18, 0, 0, 167, 13, 15, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000026', 'Raisins secs', null, 'fruit', 'portion 40 g', 1, null, 32, 4, 0, 300, 13, 20, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000027', 'Biberli', 'Leisi', 'other', 'pièce', 1, null, 36, 80, 0, 0, 0, 0, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000028', 'Appenzeller Bärli-Biber', 'Bischofberger', 'other', 'pièce', 1, null, 40, 85, 0, 0, 0, 0, 0, 0, true, null, true, null),
  ('7e100000-0000-4000-8000-000000000029', 'Mars', 'Mars', 'other', 'barre 51 g', 1, null, 35.3, 42, 0, 0, 0, 0, 0, 0, false, null, true, null),
  ('7e100000-0000-4000-8000-000000000030', 'Snickers', 'Mars', 'other', 'barre 50 g', 1, null, 30.3, 125, 0, 0, 0, 0, 0, 0, false, null, true, null)
on conflict (id) do update set
  name = excluded.name,
  brand = excluded.brand,
  category = excluded.category,
  unit_label = excluded.unit_label,
  serving_size = excluded.serving_size,
  serving_volume_ml = excluded.serving_volume_ml,
  carbohydrates_g = excluded.carbohydrates_g,
  sodium_mg = excluded.sodium_mg,
  caffeine_mg = excluded.caffeine_mg,
  potassium_mg = excluded.potassium_mg,
  magnesium_mg = excluded.magnesium_mg,
  calcium_mg = excluded.calcium_mg,
  bicarbonate_mg = excluded.bicarbonate_mg,
  zinc_mg = excluded.zinc_mg,
  is_approximate = excluded.is_approximate,
  source_url = excluded.source_url,
  is_active = true,
  updated_at = now();
