# Profilbild-Migration Anleitung

## Schnelle Lösung (Empfohlen)

Da nur wenige Dozenten betroffen sind, ist es am einfachsten, die Profilbilder manuell neu hochzuladen:

1. Öffnen Sie das Dozenten-Profil
2. Klicken Sie auf "Bild hochladen"
3. Wählen Sie das Profilbild erneut aus
4. Speichern Sie

Das neue Bild wird automatisch im `avatars` Bucket gespeichert.

---

## Automatische Migration (für viele Dozenten)

Falls Sie viele Dozenten mit Profilbildern haben:

### Schritt 1: Service Role Key holen

1. Gehen Sie zum Supabase Dashboard: https://supabase.com/dashboard/project/gkkveloqajxghhflkfru
2. Navigieren Sie zu **Settings → API**
3. Kopieren Sie den **Service Role Key** (secret)

### Schritt 2: .env Datei aktualisieren

Fügen Sie den Key zur `.env` Datei hinzu:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Schritt 3: Migration ausführen

```bash
node migrate-profile-pictures.js
```

Das Script wird:
- Alle Profilbilder vom `profile-pictures` zum `avatars` Bucket kopieren
- Die Dateinamen von `profile.*` zu `avatar.*` ändern
- Die Datenbank-URLs aktualisieren
- Eine Zusammenfassung anzeigen

### Schritt 4: Aufräumen (optional)

Nach erfolgreicher Migration:
```bash
# Migrations-Script löschen
rm migrate-profile-pictures.js

# Service Role Key aus .env entfernen (wenn nicht anderweitig benötigt)
```

---

## Betroffene Dozenten prüfen

Um zu sehen, welche Dozenten betroffen sind, können Sie diese SQL-Abfrage im Supabase Dashboard ausführen:

```sql
SELECT full_name, profile_picture_url 
FROM profiles 
WHERE profile_picture_url LIKE '%/profile-pictures/%'
ORDER BY full_name;
```
