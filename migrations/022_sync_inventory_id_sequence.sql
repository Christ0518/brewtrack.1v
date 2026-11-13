BEGIN;

DO $$
DECLARE
  id_sequence text;
  max_id bigint;
BEGIN
  id_sequence := pg_get_serial_sequence('public.tbl_inventory', 'id');

  IF id_sequence IS NULL THEN
    RAISE EXCEPTION 'Could not find an ID sequence for public.tbl_inventory.id';
  END IF;

  SELECT MAX(id)::bigint
  INTO max_id
  FROM public.tbl_inventory;

  IF max_id IS NULL THEN
    PERFORM setval(id_sequence::regclass, 1, false);
  ELSE
    PERFORM setval(id_sequence::regclass, max_id, true);
  END IF;
END
$$;

COMMIT;
