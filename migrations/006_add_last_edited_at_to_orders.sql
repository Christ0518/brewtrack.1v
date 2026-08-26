alter table public.tbl_orders
add column if not exists last_edited_at timestamptz;