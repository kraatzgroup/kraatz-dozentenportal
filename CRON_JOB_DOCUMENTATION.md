# Automatischer Cron-Job für Elite-Kleingruppe Tätigkeitsberichte

## Übersicht

Ein automatischer Cron-Job prüft **stündlich** (eine Minute nach voller Stunde), ob Elite-Kleingruppe-Einheiten zeitlich abgeschlossen sind und erstellt automatisch ausstehende Bestätigungen im Tätigkeitsbericht des zugewiesenen Dozenten.

## Zeitplan

- **Ausführung**: Jede Stunde um **XX:01 Uhr** (z.B. 08:01, 09:01, 10:01, etc.)
- **Zeitzone**: Europe/Berlin (MEZ/MESZ - deutsche Zeitzone)
- **Cron-Ausdruck**: `1 * * * *`

## Was wird geprüft?

Der Cron-Job erfasst **alle** Elite-Kleingruppe-Einheiten, die:

### Einheitstypen
- ✅ **Unterrichtseinheiten** (alle Rechtsgebiete):
  - `unterricht_zivilrecht`
  - `unterricht_strafrecht`
  - `unterricht_oeffentliches_recht`

- ✅ **Wiederholungseinheiten** (alle Rechtsgebiete):
  - `wiederholung_zivilrecht`
  - `wiederholung_strafrecht`
  - `wiederholung_oeffentliches_recht`

### Bedingungen
Eine Einheit wird erfasst, wenn:
1. ✅ `event_type = 'einheit'` (keine Ferien/Verhinderungen)
2. ✅ Ein Dozent zugewiesen ist (`dozent_id IS NOT NULL`)
3. ✅ Endzeit definiert ist (`end_time IS NOT NULL`)
4. ✅ Die Einheit zeitlich vorbei ist: `(release_date + end_time) < JETZT (MEZ)`
5. ✅ Noch kein pending entry existiert
6. ✅ Noch kein bestätigter Eintrag in `dozent_hours` existiert

## Beispiel: Charlene Nowak (Zivilrecht)

Wenn Charlene Nowak als Dozentin dem Zivilrecht zugewiesen ist:

### Erfasste Einheiten
- Alle **Unterrichtseinheiten Zivilrecht**, die ihr zugewiesen sind
- Alle **Wiederholungseinheiten Zivilrecht**, die ihr zugewiesen sind

### Workflow
1. **08:01 Uhr**: Cron-Job läuft
2. **Prüfung**: Einheit "ZR05 - Vertragsrecht" endete gestern um 16:30 Uhr
3. **Aktion**: Pending entry wird erstellt
4. **Charlene sieht**: Im Tätigkeitsbericht erscheint die Einheit zur Bestätigung
5. **Charlene bestätigt**: Einheit wird zu ihren Stunden hinzugefügt
6. **Alternative**: Charlene lehnt ab (z.B. Einheit fiel aus)

## Technische Details

### Cron-Job Information
```sql
Job Name: generate-pending-hours-hourly
Schedule: 1 * * * * (jede Stunde, Minute 1)
Status: Aktiv
Command: SELECT trigger_pending_hours_generation();
```

### Ausgeführte Funktion
```sql
trigger_pending_hours_generation()
```

Diese Funktion:
1. Ruft `generate_pending_hours_from_elite_units()` auf
2. Findet alle abgeschlossenen Einheiten
3. Erstellt pending entries in `pending_dozent_hours`
4. Loggt alle Aktionen

### Datenbank-Tabellen

**Geprüfte Tabelle**: `elite_kleingruppe_releases`
- Enthält alle geplanten Einheiten (Unterricht + Wiederholung)
- Felder: `release_date`, `start_time`, `end_time`, `dozent_id`, `unit_type`, `event_type`

**Ziel-Tabelle**: `pending_dozent_hours`
- Enthält ausstehende Bestätigungen
- Status: `pending` → `confirmed` (bestätigt) oder `rejected` (abgelehnt)

## Verwaltung des Cron-Jobs

### Status prüfen
```sql
SELECT jobid, jobname, schedule, active, command
FROM cron.job 
WHERE jobname = 'generate-pending-hours-hourly';
```

### Manuell ausführen (für Tests)
```sql
SELECT trigger_pending_hours_generation();
```

### Cron-Job deaktivieren
```sql
UPDATE cron.job 
SET active = false 
WHERE jobname = 'generate-pending-hours-hourly';
```

### Cron-Job aktivieren
```sql
UPDATE cron.job 
SET active = true 
WHERE jobname = 'generate-pending-hours-hourly';
```

### Cron-Job löschen
```sql
SELECT cron.unschedule('generate-pending-hours-hourly');
```

### Zeitplan ändern
```sql
-- Beispiel: Alle 30 Minuten statt stündlich
SELECT cron.schedule(
  'generate-pending-hours-hourly',
  '*/30 * * * *',  -- Alle 30 Minuten
  $$SELECT trigger_pending_hours_generation();$$
);
```

## Logs und Monitoring

### Erfolgreiche Ausführungen prüfen
```sql
-- Zeigt die letzten erstellten pending entries
SELECT 
  pdh.created_at,
  p.full_name as dozent_name,
  pdh.date as einheit_datum,
  pdh.hours,
  pdh.description,
  pdh.status
FROM pending_dozent_hours pdh
JOIN profiles p ON pdh.dozent_id = p.id
ORDER BY pdh.created_at DESC
LIMIT 10;
```

### Cron-Job Ausführungshistorie
```sql
-- Supabase speichert Cron-Job Logs
-- Diese können im Supabase Dashboard unter "Database" → "Cron Jobs" eingesehen werden
```

## Häufige Szenarien

### Szenario 1: Reguläre Unterrichtseinheit
- **Einheit**: ZR12 - Sachenrecht (Zivilrecht)
- **Dozent**: Charlene Nowak
- **Zeit**: Mittwoch, 14:00-16:30 Uhr
- **Ablauf**:
  - 16:30 Uhr: Einheit endet
  - 17:01 Uhr: Cron-Job läuft, erstellt pending entry
  - Charlene sieht die Einheit im Tätigkeitsbericht
  - Charlene bestätigt → 2,5 Stunden werden erfasst

### Szenario 2: Wiederholungseinheit
- **Einheit**: Wiederholung ZR - Klausurfall 3
- **Dozent**: Charlene Nowak
- **Zeit**: Samstag, 10:00-12:30 Uhr
- **Ablauf**: Identisch wie Szenario 1

### Szenario 3: Einheit fällt aus
- **Einheit**: ZR15 - Deliktsrecht
- **Problem**: Dozent krank, Einheit fällt aus
- **Ablauf**:
  - 17:01 Uhr: Cron-Job erstellt pending entry (weiß nicht, dass sie ausfiel)
  - Charlene sieht die Einheit im Tätigkeitsbericht
  - Charlene lehnt ab → Keine Stunden werden erfasst

### Szenario 4: Mehrere Dozenten, verschiedene Rechtsgebiete
- **Einheiten am selben Tag**:
  - 09:00-11:00: Strafrecht (Dozent A)
  - 11:30-14:00: Zivilrecht (Charlene Nowak)
  - 14:30-16:30: Öffentliches Recht (Dozent B)
- **Ablauf**:
  - 17:01 Uhr: Cron-Job läuft einmal
  - Erstellt 3 separate pending entries für die 3 Dozenten
  - Jeder Dozent sieht nur seine eigenen Einheiten

## Vorteile

✅ **Automatisch**: Keine manuelle Erfassung nötig
✅ **Vollständig**: Erfasst alle Einheitstypen (Unterricht + Wiederholung)
✅ **Rechtsgebietsübergreifend**: Funktioniert für Zivilrecht, Strafrecht, Öffentliches Recht
✅ **Kontrollmechanismus**: Dozenten können falsche Einträge ablehnen
✅ **Zeitgenau**: Arbeitet mit deutscher Zeitzone (MEZ/MESZ)
✅ **Zuverlässig**: Läuft stündlich, keine vergessenen Einheiten

## Migration

Die Migration wurde ausgeführt:
- **Datei**: `supabase/migrations/20260316_add_hourly_cron_job.sql`
- **Cron-Job**: Erstellt und aktiv
- **Funktion**: `trigger_pending_hours_generation()` erstellt
- **Status**: ✅ Produktiv

## Support

Bei Problemen:
1. Prüfen Sie den Cron-Job Status (siehe "Verwaltung")
2. Führen Sie die Funktion manuell aus zum Testen
3. Prüfen Sie die Logs in der Datenbank
4. Kontaktieren Sie den Administrator

## Nächste Schritte (Optional)

Mögliche Erweiterungen:
- Email-Benachrichtigung an Dozenten bei neuen pending entries
- Dashboard-Widget für Admins mit Cron-Job Status
- Automatische Bestätigung nach X Tagen ohne Aktion
- Detaillierte Statistiken über erfasste Einheiten
