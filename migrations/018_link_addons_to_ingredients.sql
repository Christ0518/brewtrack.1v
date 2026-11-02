alter table public.tbl_toppings
  add column if not exists ingredient_id bigint references public.tbl_ingredients(id);
