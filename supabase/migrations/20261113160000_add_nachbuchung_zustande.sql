-- Nachbuchungen: Verwaltung kann festhalten, ob eine Nachbuchung zustande
-- gekommen ist (true) oder nicht (false). NULL = noch offen.

alter table public.nachbuchungen
  add column if not exists nachbuchung_zustande boolean;