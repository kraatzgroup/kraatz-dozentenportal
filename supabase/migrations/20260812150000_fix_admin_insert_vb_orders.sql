-- Migration: Fix admin INSERT policy on vb_orders to also check additional_roles
-- Date: 2026-08-12
-- Purpose: The "Admins can create orders for any profile" policy only checked
--   role = 'admin', but admins can also be admin via additional_roles.
--   This blocked compensating order inserts (e.g. credit non-refund on case delete).

DROP POLICY IF EXISTS "Admins can create orders for any profile" ON public.vb_orders;

CREATE POLICY "Admins can create orders for any profile"
  ON public.vb_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (
          role = 'admin'
          OR additional_roles && ARRAY['admin']::text[]
        )
    )
    OR auth.uid() = profile_id
  );

COMMENT ON POLICY "Admins can create orders for any profile" ON public.vb_orders IS
'Allows admins (via role or additional_roles) to create orders for any profile, and users to create their own orders';
