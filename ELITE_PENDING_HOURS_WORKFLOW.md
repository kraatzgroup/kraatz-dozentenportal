# Elite-Kleingruppe: Automatische Tätigkeitsberichte

## Übersicht

Wenn ein Dozent einer Elite-Kleingruppe zugewiesen ist und eine geplante Einheit zeitlich vorbei ist, erscheint diese automatisch als "ausstehende Bestätigung" in seinem Tätigkeitsbericht. Der Dozent muss die Einheit dann bestätigen oder ablehnen.

## Workflow

### 1. Automatische Generierung

Sobald eine Elite-Kleingruppe-Einheit zeitlich vorbei ist (Datum + Endzeit sind in der Vergangenheit), wird automatisch ein Eintrag in der `pending_dozent_hours` Tabelle erstellt mit:

- **Dozent**: Der zugewiesene Dozent der Einheit (`dozent_id` aus `elite_kleingruppe_releases`)
- **Stunden**: Berechnet aus `duration_minutes` oder der Differenz zwischen `start_time` und `end_time`
- **Datum**: Das Datum der Einheit (`release_date`)
- **Beschreibung**: Titel der Einheit + Rechtsgebiet + Gruppenname
- **Kategorie**: "Elite-Kleingruppe Unterricht"

### 2. Anzeige im Tätigkeitsbericht

Im Tätigkeitsbericht des Dozenten erscheint ein gelber Hinweisbereich mit allen ausstehenden Bestätigungen:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️  Ausstehende Bestätigungen                       │
│                                                      │
│ Diese Einheiten sind zeitlich vorbei und warten     │
│ auf Ihre Bestätigung                                │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 📅 08.04.2026                                │    │
│ │ 🏷️ Elite-Kleingruppe Unterricht              │    │
│ │ ⏱️ 2.5 Stunden                                │    │
│ │ 📖 ZR01 / Klausur 1 (Zivilrecht) - Gruppe A  │    │
│ │                                               │    │
│ │ [✓ Bestätigen]  [✗ Ablehnen]                 │    │
│ └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 3. Dozent-Aktionen

#### Bestätigen (✓)
- Die Einheit wird in die regulären `dozent_hours` übernommen
- Der Eintrag verschwindet aus den ausstehenden Bestätigungen
- Die Stunden werden im Tätigkeitsbericht und in zukünftigen Rechnungen berücksichtigt

#### Ablehnen (✗)
- Der Eintrag wird als "rejected" markiert
- Die Einheit verschwindet aus den ausstehenden Bestätigungen
- Keine Stunden werden erfasst (z.B. wenn die Einheit ausgefallen ist)

## Technische Details

### Datenbank-Tabellen

**`pending_dozent_hours`**
```sql
- id: UUID (Primary Key)
- dozent_id: UUID (Foreign Key zu profiles)
- elite_release_id: UUID (Foreign Key zu elite_kleingruppe_releases)
- hours: DECIMAL(5,2)
- date: DATE
- description: TEXT
- category: TEXT
- status: TEXT ('pending', 'confirmed', 'rejected')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Datenbank-Funktionen

**`generate_pending_hours_from_elite_units()`**
- Findet alle abgeschlossenen Einheiten ohne pending entry
- Erstellt automatisch pending entries für diese Einheiten
- Wird aufgerufen durch die Edge Function

**`confirm_pending_hours(pending_id UUID)`**
- Bestätigt einen pending entry
- Erstellt einen Eintrag in `dozent_hours`
- Markiert den pending entry als 'confirmed'

**`reject_pending_hours(pending_id UUID)`**
- Lehnt einen pending entry ab
- Markiert den pending entry als 'rejected'

### Edge Function

**URL**: `https://gkkveloqajxghhflkfru.supabase.co/functions/v1/generate-pending-hours`

**Aufruf**:
```bash
curl -X POST https://gkkveloqajxghhflkfru.supabase.co/functions/v1/generate-pending-hours
```

**Verwendung**:
- Kann manuell aufgerufen werden
- Kann als Cron-Job eingerichtet werden (z.B. täglich um 00:00 Uhr)
- Kann bei Bedarf vom Admin-Dashboard aus getriggert werden

### Realtime-Updates

Die UI aktualisiert sich automatisch, wenn:
- Neue pending entries erstellt werden
- Ein Dozent einen Entry bestätigt/ablehnt
- Verwendet Supabase Realtime Subscriptions auf `pending_dozent_hours`

## Bedingungen für automatische Generierung

Ein pending entry wird NUR erstellt, wenn:

1. ✅ `event_type = 'einheit'` (keine Ferien, keine Verhinderungen)
2. ✅ `dozent_id IS NOT NULL` (Dozent ist zugewiesen)
3. ✅ `end_time IS NOT NULL` (Endzeit ist definiert)
4. ✅ Einheit ist zeitlich vorbei (Datum + Endzeit < jetzt)
5. ✅ Noch kein pending entry existiert für diese Kombination (dozent_id + elite_release_id)
6. ✅ Noch kein bestätigter Eintrag in `dozent_hours` existiert

## Vorteile

- ✅ **Automatisch**: Dozenten müssen nicht manuell Einheiten nachtragen
- ✅ **Kontrolle**: Dozenten können falsche Einträge ablehnen (z.B. wenn Einheit ausgefallen ist)
- ✅ **Vollständigkeit**: Keine vergessenen Einheiten mehr
- ✅ **Transparenz**: Klare Übersicht über ausstehende Bestätigungen
- ✅ **Echtzeit**: Sofortige Updates durch Realtime-Subscriptions

## Migration

Die Migration wurde bereits ausgeführt:
- Datei: `supabase/migrations/20260312_add_pending_elite_hours.sql`
- Tabelle `pending_dozent_hours` erstellt
- Funktionen `generate_pending_hours_from_elite_units()`, `confirm_pending_hours()`, `reject_pending_hours()` erstellt
- RLS Policies konfiguriert
- Initiale Generierung für bestehende Einheiten durchgeführt

## Zukünftige Erweiterungen

Mögliche Verbesserungen:
- Automatischer Cron-Job (täglich um Mitternacht)
- Email-Benachrichtigung an Dozenten bei neuen pending entries
- Bulk-Bestätigung mehrerer Einträge auf einmal
- Automatische Bestätigung nach X Tagen ohne Aktion
