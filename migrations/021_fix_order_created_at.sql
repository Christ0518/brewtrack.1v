BEGIN;

UPDATE public.tbl_orders
SET created_at = NOW()
WHERE created_at IS NULL;

ALTER TABLE public.tbl_orders
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

COMMIT;
