/*
  # Schritt 3 Fix: Korrigiere die fehlgeschlagene Migration
  
  Problem: INSERT mit ON CONFLICT hat nicht funktioniert, weil kein UNIQUE Constraint auf name
  Lösung: Daten manuell einfügen mit eindeutigen Namen
*/

-- ============================================
-- Step 1: Insert pakete data into packages with unique names
-- ============================================
INSERT INTO packages (name, description, hours, price, is_active)
VALUES 
  ('Starter Paket (Legacy)', 'Einstiegspaket für neue Teilnehmer', 10, 990.00, true),
  ('Standard Paket (Legacy)', 'Unser beliebtestes Paket', 20, 1790.00, true),
  ('Premium Paket (Legacy)', 'Intensivpaket mit mehr Stunden', 40, 3290.00, true),
  ('VIP Paket', 'All-inclusive Paket mit persönlicher Betreuung', 60, 4790.00, true),
  ('Auffrischung', 'Zusätzliche Stunden für bestehende Teilnehmer', 5, 490.00, true);

-- ============================================
-- Step 2: Check if we need to restore upsells references
-- ============================================
-- Since pakete was deleted and upsells references are now NULL, we need to inform the user
-- that upsells data may need manual review

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 3 Fix abgeschlossen';
  RAISE NOTICE '- Pakete-Daten manuell in packages eingefügt';
  RAISE NOTICE '- WARNUNG: upsells Referenzen sind NULL (14 Einträge betroffen)';
  RAISE NOTICE '- Bitte upsells Daten manuell überprüfen';
END $$;
