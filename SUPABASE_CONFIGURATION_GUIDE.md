# Supabase URL-Konfiguration für Netlify

## Problem
Password-Reset-Links führen immer noch zu `localhost:3000` statt zur Netlify-App.

## Lösung
Die Supabase-Projekteinstellungen müssen in der Supabase-Konsole aktualisiert werden:

### 1. Supabase Dashboard öffnen
- Gehen Sie zu: https://supabase.com/dashboard
- Wählen Sie Ihr Projekt aus

### 2. Authentication Settings
- Navigieren Sie zu: **Authentication** → **Settings** → **URL Configuration**

### 3. Site URL aktualisieren
Ändern Sie die **Site URL** von:
```
http://localhost:3000
```
zu:
```
http://portal.kraatz-group.de
```

### 4. Redirect URLs hinzufügen
Fügen Sie unter **Redirect URLs** beide URLs hinzu:
```
http://localhost:3000/**
http://portal.kraatz-group.de/**
```

### 5. Speichern
Klicken Sie auf **Save** um die Änderungen zu übernehmen.

## Warum ist das notwendig?
- Die **Site URL** ist die Standard-URL für E-Mail-Links (Password Reset, Einladungen)
- **Redirect URLs** definieren, welche URLs nach der Authentifizierung erlaubt sind
- Ohne diese Konfiguration verwendet Supabase immer die ursprünglich eingestellte localhost-URL

## Nach der Änderung
- Neue Password-Reset-Links führen zur Netlify-App
- Einladungs-E-Mails führen zur Netlify-App
- Lokale Entwicklung funktioniert weiterhin (durch Redirect URLs)

## Testen
1. Senden Sie einen neuen Password-Reset-Link
2. Überprüfen Sie die E-Mail - der Link sollte jetzt zur Netlify-URL führen