-- Update leads status check constraint to include new status values
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (
  status IN (
    'new',
    'offer_sent',
    'post_offer_call',
    'trial_pending',
    'post_trial_call',
    'finalgespraech',
    'vertragsanforderung',
    'vertrag_versendet',
    'downsell',
    'unqualified',
    'contract_closed',
    'closed'
  )
);

-- Add contract_requested_at column if not exists
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contract_requested_at TIMESTAMPTZ;
