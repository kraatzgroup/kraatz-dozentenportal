-- Nachbuchungen: bei zustande gekommener Nachbuchung Stunden und erlaubte
-- Dozenten-Provision (EUR) festhalten.

alter table public.nachbuchungen
  add column if not exists nachbuchung_stunden integer,
  add column if not exists nachbuchung_provision numeric;