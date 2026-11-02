BEGIN;

ALTER TABLE public.tbl_inventory
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE public.ingredient_batches
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric,
  ALTER COLUMN remaining_quantity TYPE numeric USING remaining_quantity::numeric;

DO $$
DECLARE
  table_name text;
  id_sequence text;
  max_id bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['tbl_inventory', 'ingredient_batches']
  LOOP
    id_sequence := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    IF id_sequence IS NOT NULL THEN
      EXECUTE format('SELECT MAX(id)::bigint FROM public.%I', table_name)
        INTO max_id;

      IF max_id IS NULL THEN
        PERFORM setval(id_sequence::regclass, 1, false);
      ELSE
        PERFORM setval(id_sequence::regclass, GREATEST(max_id, 1), max_id >= 1);
      END IF;
    END IF;
  END LOOP;
END
$$;

COMMIT;
