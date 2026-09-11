-- CDC §19. Existing quantities and snapshots remain unchanged.
begin;
alter table public.activity_nutrition_items add column phase text,
  add column snapshot_origin text not null default 'undocumented',
  add column serving_size_snapshot numeric,
  add column serving_volume_ml_snapshot numeric;
-- Classify historical rows by their existing activity state once, without copying them.
update public.activity_nutrition_items n set phase = case when a.status = 'planned' then 'planned' else 'consumed' end
  from public.activities a where a.id = n.activity_id and n.phase is null;
alter table public.activity_nutrition_items alter column phase set not null, alter column phase set default 'consumed';
alter table public.activity_nutrition_items add constraint nutrition_phase_valid check (phase in ('planned','consumed'));
alter table public.activity_nutrition_items drop constraint activity_nutrition_items_activity_id_product_id_key;
alter table public.activity_nutrition_items add constraint nutrition_activity_phase_product_key unique(activity_id,phase,product_id);
alter table public.nutrition_products alter column carbohydrates_g drop not null, alter column carbohydrates_g drop default;
alter table public.activity_nutrition_items alter column carbohydrates_g_snapshot drop not null, alter column carbohydrates_g_snapshot drop default;
alter table public.nutrition_products alter column sodium_mg drop not null, alter column sodium_mg drop default;
alter table public.activity_nutrition_items alter column sodium_mg_snapshot drop not null, alter column sodium_mg_snapshot drop default;
alter table public.nutrition_products alter column caffeine_mg drop not null, alter column caffeine_mg drop default;
alter table public.activity_nutrition_items alter column caffeine_mg_snapshot drop not null, alter column caffeine_mg_snapshot drop default;
alter table public.nutrition_products alter column potassium_mg drop not null, alter column potassium_mg drop default;
alter table public.activity_nutrition_items alter column potassium_mg_snapshot drop not null, alter column potassium_mg_snapshot drop default;
alter table public.nutrition_products alter column magnesium_mg drop not null, alter column magnesium_mg drop default;
alter table public.activity_nutrition_items alter column magnesium_mg_snapshot drop not null, alter column magnesium_mg_snapshot drop default;
alter table public.nutrition_products alter column calcium_mg drop not null, alter column calcium_mg drop default;
alter table public.activity_nutrition_items alter column calcium_mg_snapshot drop not null, alter column calcium_mg_snapshot drop default;
alter table public.nutrition_products alter column bicarbonate_mg drop not null, alter column bicarbonate_mg drop default;
alter table public.activity_nutrition_items alter column bicarbonate_mg_snapshot drop not null, alter column bicarbonate_mg_snapshot drop default;
alter table public.nutrition_products alter column zinc_mg drop not null, alter column zinc_mg drop default;
alter table public.activity_nutrition_items alter column zinc_mg_snapshot drop not null, alter column zinc_mg_snapshot drop default;

create or replace function public.snapshot_activity_nutrition_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare product public.nutrition_products%rowtype; planned public.activity_nutrition_items%rowtype;
begin
  if tg_op = 'UPDATE' and new.product_id = old.product_id then
    if new.activity_id <> old.activity_id or new.phase <> old.phase then raise exception 'Nutrition identity cannot change' using errcode = '22023'; end if;
    -- A quantity edit cannot rewrite any historical composition, even through a direct API call.
    new.product_name_snapshot := old.product_name_snapshot;
    new.brand_snapshot := old.brand_snapshot;
    new.unit_label_snapshot := old.unit_label_snapshot;
    new.carbohydrates_g_snapshot := old.carbohydrates_g_snapshot;
    new.sodium_mg_snapshot := old.sodium_mg_snapshot;
    new.caffeine_mg_snapshot := old.caffeine_mg_snapshot;
    new.potassium_mg_snapshot := old.potassium_mg_snapshot;
    new.magnesium_mg_snapshot := old.magnesium_mg_snapshot;
    new.calcium_mg_snapshot := old.calcium_mg_snapshot;
    new.bicarbonate_mg_snapshot := old.bicarbonate_mg_snapshot;
    new.zinc_mg_snapshot := old.zinc_mg_snapshot;
    new.extra_nutrients_snapshot := old.extra_nutrients_snapshot;
    new.is_approximate_snapshot := old.is_approximate_snapshot;
    new.serving_size_snapshot := old.serving_size_snapshot;
    new.serving_volume_ml_snapshot := old.serving_volume_ml_snapshot;
    new.snapshot_origin := old.snapshot_origin;
    return new;
  end if;
  if new.snapshot_origin = 'planned-copy' and new.phase = 'consumed' then
    select n.* into planned from public.activity_nutrition_items n join public.activities a on a.id = n.activity_id
      where n.activity_id = new.activity_id and n.product_id = new.product_id and n.phase = 'planned' and a.user_id = auth.uid();
    if not found then raise exception 'Planned nutrition unavailable' using errcode = '42501'; end if;
    new.product_name_snapshot := planned.product_name_snapshot;
    new.brand_snapshot := planned.brand_snapshot;
    new.unit_label_snapshot := planned.unit_label_snapshot;
    new.carbohydrates_g_snapshot := planned.carbohydrates_g_snapshot;
    new.sodium_mg_snapshot := planned.sodium_mg_snapshot;
    new.caffeine_mg_snapshot := planned.caffeine_mg_snapshot;
    new.potassium_mg_snapshot := planned.potassium_mg_snapshot;
    new.magnesium_mg_snapshot := planned.magnesium_mg_snapshot;
    new.calcium_mg_snapshot := planned.calcium_mg_snapshot;
    new.bicarbonate_mg_snapshot := planned.bicarbonate_mg_snapshot;
    new.zinc_mg_snapshot := planned.zinc_mg_snapshot;
    new.extra_nutrients_snapshot := planned.extra_nutrients_snapshot;
    new.is_approximate_snapshot := planned.is_approximate_snapshot;
    new.serving_size_snapshot := planned.serving_size_snapshot;
    new.serving_volume_ml_snapshot := planned.serving_volume_ml_snapshot;
    return new;
  end if;
  select * into product from public.nutrition_products where id = new.product_id
    and ((is_global and is_active) or created_by = auth.uid());
  if not found then raise exception 'Product unavailable' using errcode = '42501'; end if;
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
  new.serving_size_snapshot := product.serving_size;
  new.serving_volume_ml_snapshot := product.serving_volume_ml;
  new.snapshot_origin := 'catalogue-at-save'; return new;
end;
$$;
drop trigger snapshot_activity_nutrition_item on public.activity_nutrition_items;
create trigger snapshot_activity_nutrition_item before insert or update on public.activity_nutrition_items
  for each row execute function public.snapshot_activity_nutrition_item();

create or replace function private.save_moment_nutrition(p_activity_id uuid, p_actor uuid, p_phases jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare phase_name text; items jsonb; item jsonb;
begin
  if p_actor is distinct from auth.uid() or p_actor is null or not exists(select from public.activities where id = p_activity_id and user_id = p_actor) then raise exception 'Activity unavailable' using errcode = '42501'; end if;
  if jsonb_typeof(p_phases) <> 'object' or exists(select from jsonb_object_keys(p_phases) k where k not in ('planned','consumed','context')) then raise exception 'Invalid nutrition' using errcode = '22023'; end if;
  foreach phase_name in array array['planned','consumed'] loop
    if not p_phases ? phase_name then continue; end if;
    items := p_phases->phase_name;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 100 then raise exception 'Invalid nutrition list' using errcode = '22023'; end if;
    if (select count(distinct value->>'product_id') from jsonb_array_elements(items)) <> jsonb_array_length(items) then raise exception 'Duplicate or missing product' using errcode = '22023'; end if;
    for item in select value from jsonb_array_elements(items) loop
      if jsonb_typeof(item->'quantity') <> 'number' or (item->>'quantity')::numeric <= 0 or (item->>'quantity')::numeric > 10000 then raise exception 'Invalid nutrition quantity' using errcode = '22023'; end if;
      if not exists(select from public.activity_nutrition_items where activity_id = p_activity_id and phase = phase_name and product_id = (item->>'product_id')::uuid)
        and not exists(select from public.nutrition_products where id = (item->>'product_id')::uuid and (is_global and is_active or created_by = p_actor)) then raise exception 'Product unavailable' using errcode = '42501'; end if;
      if exists(select from public.activity_nutrition_items where activity_id = p_activity_id and phase = phase_name and product_id = (item->>'product_id')::uuid) then
        update public.activity_nutrition_items set quantity = (item->>'quantity')::numeric
          where activity_id = p_activity_id and phase = phase_name and product_id = (item->>'product_id')::uuid;
      else
        insert into public.activity_nutrition_items(activity_id,product_id,quantity,phase,product_name_snapshot,unit_label_snapshot,snapshot_origin)
          values(p_activity_id,(item->>'product_id')::uuid,(item->>'quantity')::numeric,phase_name,'','',
            case when phase_name = 'consumed' and item->>'copy_from_planned' = 'true' then 'planned-copy' else 'catalogue-at-save' end);
      end if;
    end loop;
    delete from public.activity_nutrition_items where activity_id = p_activity_id and phase = phase_name
      and product_id not in (select (value->>'product_id')::uuid from jsonb_array_elements(items));
  end loop;
  if p_phases ? 'context' then
    update public.activities set nutrition_note = p_phases->'context'->>'note',
      nutrition_elapsed_override_seconds = (p_phases->'context'->>'elapsed_override_seconds')::numeric
      where id = p_activity_id and user_id = p_actor;
  end if;
end;
$$;
revoke all on function private.save_moment_nutrition(uuid,uuid,jsonb) from public, anon, authenticated;
-- Old clients receive an actionable error instead of overwriting both phases.
create or replace function public.save_activity_nutrition(p_activity_id uuid,p_items jsonb)
returns setof public.activity_nutrition_items language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Recharge MOMENTUM puis utilise le formulaire du Moment pour enregistrer le ravitaillement.' using errcode = 'P0001';
end;
$$;
revoke all on function public.save_activity_nutrition(uuid,jsonb) from public, anon;
grant execute on function public.save_activity_nutrition(uuid,jsonb) to authenticated;
commit;
