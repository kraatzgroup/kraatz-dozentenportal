-- Nachbuchungen: Erinnerung an Dozenten bei ausstehender Antwort
--
-- Jede Nacht um 06:00 Uhr prüft ein Cron-Job, ob Nachbuchungs-Anfragen seit
-- 72 Stunden ausstehend sind und noch keine Erinnerung verschickt wurde.
-- Die Edge-Function nachbuchung-erinnerung sendet dann eine Erinnerungs-Mail
-- an den Dozenten (mit neuem Link) und setzt reminder_sent_at.

alter table public.nachbuchungen
  add column if not exists reminder_sent_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function trigger_nachbuchung_erinnerung()
returns void
language plpgsql
security definer
as $$
declare
  request_id int;
begin
  select
    net.http_post(
      url := 'https://gkkveloqajxghhflkfru.supabase.co/functions/v1/nachbuchung-erinnerung',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) into request_id;

  raise notice 'Triggered nachbuchung-erinnerung via Edge Function. Request ID: %', request_id;
exception
  when others then
    raise warning 'Error in trigger_nachbuchung_erinnerung: %', sqlerrm;
end;
$$;

select cron.unschedule('nachbuchung-erinnerung-daily')
where exists (
  select 1 from cron.job where jobname = 'nachbuchung-erinnerung-daily'
);

select cron.schedule(
  'nachbuchung-erinnerung-daily',
  '0 6 * * *',
  $$select trigger_nachbuchung_erinnerung();$$
);

comment on function trigger_nachbuchung_erinnerung() is
  'Ruft die Edge Function nachbuchung-erinnerung jede Nacht um 06:00 auf (Europe/Berlin).';