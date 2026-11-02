alter table public.tbl_orders_details
  add column if not exists add_ons jsonb not null default '[]'::jsonb;
