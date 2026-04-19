/*
  # Schritt 5: teilnehmer Stunden-Felder in package_legal_areas migrieren
  
  Analyse:
  - 66 Teilnehmer haben Stunden-Felder (hours_zivilrecht, hours_strafrecht, hours_oeffentliches_recht)
  - Alle haben package_id = NULL (kein Paket zugewiesen)
  - Stunden sind Teilnehmer-spezifisch, nicht Paket-spezifisch
  
  Problem:
  - package_legal_areas ist pro Paket, nicht pro Teilnehmer
  - Ohne package_id kann nicht direkt migriert werden
  
  Lösung:
  - Legacy-Felder in teilnehmer bleiben erhalten
  - Später manuelle Migration, wenn Verträge erstellt werden
  - Dokumentation für zukünftige Migration
*/

-- ============================================
-- Add comment to teilnehmer table about legacy fields
-- ============================================
COMMENT ON COLUMN teilnehmer.hours_zivilrecht IS 'Legacy field - hours for civil law. To be migrated to package_legal_areas when contracts are created.';
COMMENT ON COLUMN teilnehmer.hours_strafrecht IS 'Legacy field - hours for criminal law. To be migrated to package_legal_areas when contracts are created.';
COMMENT ON COLUMN teilnehmer.hours_oeffentliches_recht IS 'Legacy field - hours for public law. To be migrated to package_legal_areas when contracts are created.';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 5 übersprungen: teilnehmer Stunden-Felder bleiben als Legacy';
  RAISE NOTICE '- 66 Teilnehmer haben Stunden-Felder (hours_zivilrecht, hours_strafrecht, hours_oeffentliches_recht)';
  RAISE NOTICE '- Alle haben package_id = NULL, daher keine direkte Migration möglich';
  RAISE NOTICE '- Legacy-Felder bleiben erhalten';
  RAISE NOTICE '- Später manuelle Migration, wenn Verträge erstellt werden';
END $$;
