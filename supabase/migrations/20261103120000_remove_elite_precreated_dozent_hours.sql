-- Migration: Bereinigt fälschlich vorab angelegte dozent_hours für Elite-Kleingruppe-Einheiten
-- Created: 2026-11-03
-- Description: Entfernt die Zeilen, die beim Planen einer Elite-Kleingruppen-Einheit
--   direkt (und für zukünftige Termine) in dozent_hours geschrieben wurden.
--   Diese Zeilen stammen ausschließlich aus dem alten direkten Insert in
--   EliteKleingruppe.tsx (Kategorie 'Unterrichtseinheit'/'Wiederholungseinheit').
--   Sie werden anschließend durch den regulären pending-Workflow
--   (generate_pending_hours_from_elite_units) erneut erzeugt, sobald die
--   Einheit tatsächlich stattgefunden hat und der Dozent sie bestätigt.

-- WICHTIG: Destruktive Operation. Vor Ausführung bitte prüfen, ob bereits
-- Rechnungen auf Basis dieser Zeilen erstellt wurden. Bereits versendete
-- Rechnungs-PDFs bleiben unverändert, aber künftige Vorschauen/Rechnungen
-- berechnen sich aus den korrigierten Daten.

DELETE FROM public.dozent_hours
WHERE category IN ('Unterrichtseinheit', 'Wiederholungseinheit')
  AND elite_kleingruppe_id IS NOT NULL;

-- Optional: Sofort die abgeschlossenen Elite-Einheiten als ausstehende
-- Bestätigung (pending_dozent_hours) nachgenerieren. Der stündliche Cron-Job
-- macht dies ohnehin automatisch, daher hier nur als optionaler Schritt.
-- SELECT generate_pending_hours_from_elite_units();