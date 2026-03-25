# Profilbild-Migration: profile-pictures → avatars

## Übersicht
Dieses Script migriert alle Profilbilder vom alten `profile-pictures` Bucket zum neuen `avatars` Bucket.

## Voraussetzungen
- Node.js installiert
- Zugriff auf Supabase Service Role Key

## Schritt 1: Service Role Key hinzufügen

Fügen Sie den Supabase Service Role Key zu Ihrer `.env` Datei hinzu:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Den Service Role Key finden Sie im Supabase Dashboard unter:
**Settings → API → Service Role Key (secret)**

## Schritt 2: Migration ausführen

```bash
# SQL-Migration ausführen (aktualisiert URLs in der Datenbank)
npm run db:migrate

# Dateien kopieren (kopiert tatsächliche Bilder)
node migrate-profile-pictures.js
```

## Was das Script macht

1. **Findet alle Profile** mit Profilbildern im `profile-pictures` Bucket
2. **Lädt jedes Bild herunter** vom alten Bucket
3. **Lädt es hoch** zum neuen `avatars` Bucket (mit neuem Dateinamen: `avatar.*` statt `profile.*`)
4. **Aktualisiert die Datenbank** mit der neuen URL
5. **Zeigt eine Zusammenfassung** mit Erfolgen, Fehlern und übersprungenen Einträgen

## Ausgabe-Beispiel

```
🚀 Starting profile picture migration...

📋 Found 15 profiles with profile pictures

👤 Processing: Peter Weiß (a9cf6de9-590f-411d-8b29-6acc019765ba)
   Current URL: https://...supabase.co/storage/v1/object/public/profile-pictures/a9cf6de9.../profile.jpg
   Old path: a9cf6de9-590f-411d-8b29-6acc019765ba/profile.jpg
   New path: a9cf6de9-590f-411d-8b29-6acc019765ba/avatar.jpg
   New URL: https://...supabase.co/storage/v1/object/public/avatars/a9cf6de9.../avatar.jpg
   ✅ Successfully migrated

============================================================
📊 Migration Summary:
   ✅ Successful: 15
   ❌ Errors: 0
   ⏭️  Skipped: 0
   📋 Total: 15
============================================================

🎉 Migration completed successfully!
```

## Sicherheit

- Das Script überschreibt keine bestehenden Dateien im `avatars` Bucket (upsert: true)
- Originaldateien im `profile-pictures` Bucket bleiben erhalten
- Bei Fehlern wird die Migration für das betroffene Profil übersprungen

## Nach der Migration

Nach erfolgreicher Migration können Sie optional:
1. Den alten `profile-pictures` Bucket löschen
2. Das Migrations-Script löschen (`migrate-profile-pictures.js`)
3. Den Service Role Key aus der `.env` entfernen (wenn nicht anderweitig benötigt)
