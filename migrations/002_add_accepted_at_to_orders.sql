alter table public.tbl_orders
add column if not exists accepted_at timestamptz;

do $$
begin
	if not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'public'
			and tablename = 'tbl_orders'
	) then
		alter publication supabase_realtime add table public.tbl_orders;
	end if;
end
$$;