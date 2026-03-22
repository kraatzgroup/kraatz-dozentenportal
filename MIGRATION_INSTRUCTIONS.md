# Migration Instructions: Cancel & Reschedule Functionality

## Übersicht
Diese Anleitung beschreibt, wie die neue Cancel- und Reschedule-Funktionalität für Elite-Kleingruppe Termine angewendet wird.

## Datenbank-Migration anwenden

Die Migration-Datei wurde erstellt unter:
`/Users/charlenenowak/github/dozentenportal/supabase/migrations/20260322000000_add_cancel_reschedule_to_releases.sql`

### Schritte zur Anwendung:

1. **Docker Desktop starten** (falls noch nicht gestartet)

2. **Supabase lokal starten:**
   ```bash
   cd /Users/charlenenowak/github/dozentenportal
   supabase start
   ```

3. **Migration anwenden:**
   ```bash
   supabase db reset
   ```
   
   Oder nur die neue Migration:
   ```bash
   supabase migration up
   ```

4. **Migration auf Production anwenden:**
   ```bash
   supabase db push
   ```

## Neue Funktionen

### Für Dozenten und Admins:

1. **Termin absagen:**
   - Öffnen Sie einen Termin im Kalender
   - Klicken Sie auf "Absagen"
   - Geben Sie optional einen Grund ein
   - Der Termin wird als abgesagt markiert (❌)

2. **Termin verschieben:**
   - Öffnen Sie einen Termin im Kalender
   - Klicken Sie auf "Verschieben"
   - Wählen Sie das neue Datum und die neue Uhrzeit
   - Geben Sie optional einen Grund ein
   - Der Termin wird verschoben und als verschoben markiert (📅)

### Visuelle Indikatoren:

- **Abgesagte Termine:** Rot durchgestrichen mit ❌ Symbol
- **Verschobene Termine:** Lila Hintergrund mit 📅 Symbol
- Details werden beim Hover und in der erweiterten Ansicht angezeigt

## Neue Datenbank-Spalten

Die folgenden Spalten wurden zur `elite_kleingruppe_releases` Tabelle hinzugefügt:

### Absage-Spalten:
- `is_canceled` (BOOLEAN) - Gibt an, ob der Termin abgesagt wurde
- `canceled_at` (TIMESTAMPTZ) - Zeitstempel der Absage
- `canceled_reason` (TEXT) - Grund für die Absage
- `canceled_by` (UUID) - Benutzer-ID, der den Termin abgesagt hat

### Verschiebungs-Spalten:
- `is_rescheduled` (BOOLEAN) - Gibt an, ob der Termin verschoben wurde
- `rescheduled_at` (TIMESTAMPTZ) - Zeitstempel der Verschiebung
- `rescheduled_to_date` (DATE) - Neues Datum
- `rescheduled_to_start_time` (TIME) - Neue Startzeit
- `rescheduled_to_end_time` (TIME) - Neue Endzeit
- `rescheduled_reason` (TEXT) - Grund für die Verschiebung
- `rescheduled_by` (UUID) - Benutzer-ID, der den Termin verschoben hat

## Testen

Nach der Migration können Sie die Funktionalität testen:

1. Navigieren Sie zu: `http://localhost:3000/dashboard/elite-kleingruppe/einheiten-materialfreigabe`
2. Öffnen Sie einen geplanten Termin
3. Testen Sie die "Absagen" und "Verschieben" Buttons
4. Überprüfen Sie die visuelle Darstellung im Kalender

## Hinweise

- Abgesagte Termine können nicht mehr verschoben werden
- Verschobene Termine aktualisieren automatisch das `release_date`, `start_time` und `end_time`
- Alle Änderungen werden mit Zeitstempel und Benutzer-ID protokolliert
- Teilnehmer sehen die Absage/Verschiebung im Kalender
