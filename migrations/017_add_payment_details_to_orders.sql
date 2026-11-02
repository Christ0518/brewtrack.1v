alter table public.tbl_orders
  add column if not exists payment_method text not null default 'cash',
  add column if not exists payment_reference text;
