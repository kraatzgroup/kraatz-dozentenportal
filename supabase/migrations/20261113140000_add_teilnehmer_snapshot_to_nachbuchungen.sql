/*
  # Nachbuchungen: Teilnehmer als Snapshot speichern

  Die Verwaltung kann einen Teilnehmer auswählen ODER (wenn nicht gefunden)
  einen Teilnehmer lokal anlegen, ohne einen `teilnehmer`-Datensatz zu erzeugen.
  Damit die Anfrage dennoch Name/TN-Nummer kennt, speichern wir diese Werte
  als Snapshot direkt auf der Anfrage.
*/

alter table public.nachbuchungen
  add column if not exists teilnehmer_name text,
  add column if not exists teilnehmer_tn_nummer text;

-- Bestehende Anfragen (falls vorhanden) nachziehen
update public.nachbuchungen n
set
  teilnehmer_name = t.name,
  teilnehmer_tn_nummer = t.tn_nummer
from public.teilnehmer t
where n.teilnehmer_id = t.id
  and n.teilnehmer_name is null;