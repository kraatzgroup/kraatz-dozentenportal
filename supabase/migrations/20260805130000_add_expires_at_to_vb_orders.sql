-- Add expires_at column to vb_orders for credit expiration (18 months)
ALTER TABLE public.vb_orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing completed/paid orders with 18-month expiration from created_at
UPDATE public.vb_orders
SET expires_at = created_at + INTERVAL '18 months'
WHERE expires_at IS NULL
  AND status IN ('completed', 'paid');
