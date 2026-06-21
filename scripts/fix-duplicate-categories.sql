-- =====================================================================
-- One-time cleanup: merge duplicate categories that differ only by case
-- or surrounding whitespace (e.g. "Environment" vs "ENVIRONMENT",
-- "Politics" vs "POLITICS\n").
--
-- Run this once in the Supabase Dashboard -> SQL Editor (runs as an
-- admin role there, so it bypasses RLS). Safe to re-run: if there are
-- no duplicates left, it's a no-op.
-- =====================================================================

begin;

-- 1. For each group of categories whose trimmed, lowercased name matches,
--    pick one "keeper" row (prefer a non-ALL-CAPS name, then the oldest).
create temporary table category_merge_map as
with ranked as (
  select
    id,
    name,
    lower(trim(name)) as norm_name,
    row_number() over (
      partition by lower(trim(name))
      order by (name = upper(name))::int asc, created_at asc
    ) as rn
  from categories
  where deleted_at is null
),
keepers as (
  select norm_name, id as keep_id from ranked where rn = 1
)
select r.id as dupe_id, k.keep_id
from ranked r
join keepers k using (norm_name)
where r.rn > 1;

-- 2. Repoint any claims that reference a duplicate category onto the keeper.
update claims c
set category_id = m.keep_id
from category_merge_map m
where c.category_id = m.dupe_id;

-- 3. Delete the now-unreferenced duplicate rows.
delete from categories
where id in (select dupe_id from category_merge_map);

-- 4. Tidy up any stray surrounding whitespace on the rows that remain.
update categories set name = trim(name) where name <> trim(name);

-- 5. Prevent this from happening again: block future case/whitespace
--    variants of the same name (only among non-deleted rows).
drop index if exists categories_name_norm_idx;
create unique index categories_name_norm_idx
  on categories (lower(trim(name)))
  where deleted_at is null;

drop table category_merge_map;

commit;
