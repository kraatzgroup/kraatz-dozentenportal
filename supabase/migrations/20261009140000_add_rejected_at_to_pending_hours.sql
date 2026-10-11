-- Migration: rejected_at Zeitstempel für abgelehnte Elite-Kleingruppen-Einheiten
-- Datum: 2026-10-09
-- Der Zeitpunkt der Ablehnung soll getrennt vom automatisch gepflegten
-- updated_at gespeichert werden, damit er nicht durch spätere
-- Beschreibungs-Updates überschrieben wird.

ALTER TABLE public.pending_dozent_hours
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.reject_pending_hours(pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update status to rejected and remember when it happened
  UPDATE public.pending_dozent_hours
  SET status = 'rejected',
      rejected_at = NOW(),
      updated_at = NOW()
  WHERE id = pending_id
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending hour entry not found or already processed';
  END IF;

  RAISE NOTICE 'Rejected pending hours: %', pending_id;
END;
$$;