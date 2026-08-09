-- Make package_id nullable on vb_orders to allow manual credit additions
ALTER TABLE public.vb_orders ALTER COLUMN package_id DROP NOT NULL;
