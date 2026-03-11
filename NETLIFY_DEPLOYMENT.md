# Netlify Deployment Configuration

## Problem
Die Produktionsseite auf `portal.kraatz-group.de` zeigt den Fehler:
```
Uncaught Error: Missing Supabase configuration. Please check your .env file.
```

## Ursache
Die Umgebungsvariablen für Supabase sind in Netlify nicht konfiguriert. Vite-Anwendungen benötigen Umgebungsvariablen mit dem Präfix `VITE_`, die zur Build-Zeit in den Code eingebettet werden.

## Erforderliche Umgebungsvariablen

Die folgenden Umgebungsvariablen müssen in Netlify konfiguriert werden:

### Pflicht-Variablen (CRITICAL)

1. **VITE_SUPABASE_URL**
   - Wert: `https://gkkveloqajxghhflkfru.supabase.co`
   - Beschreibung: Die URL des Supabase-Projekts

2. **VITE_SUPABASE_ANON_KEY**
   - Wert: Der Supabase Anon/Public Key
   - Beschreibung: Der öffentliche API-Schlüssel für Supabase
   - Zu finden in: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

### Optionale Variablen

3. **VITE_CAL_API_KEY**
   - Beschreibung: Cal.com API Key für Kalender-Integration
   - Nur erforderlich wenn Cal.com Integration genutzt wird

## Konfiguration in Netlify

### Schritt 1: Netlify Dashboard öffnen
1. Gehe zu https://app.netlify.com
2. Wähle die Site `portal.kraatz-group.de` aus

### Schritt 2: Environment Variables konfigurieren
1. Navigiere zu: **Site settings** → **Environment variables**
2. Klicke auf **Add a variable** oder **Add environment variables**

### Schritt 3: Variablen hinzufügen
Füge folgende Variablen hinzu:

```
Key: VITE_SUPABASE_URL
Value: https://gkkveloqajxghhflkfru.supabase.co
Scopes: All scopes (Production, Deploy Previews, Branch deploys)
```

```
Key: VITE_SUPABASE_ANON_KEY
Value: [Supabase Anon Key - siehe Supabase Dashboard]
Scopes: All scopes (Production, Deploy Previews, Branch deploys)
```

### Schritt 4: Supabase Anon Key finden
1. Gehe zu https://supabase.com/dashboard/project/gkkveloqajxghhflkfru
2. Navigiere zu: **Settings** → **API**
3. Kopiere den **anon** **public** Key
4. Füge ihn als Wert für `VITE_SUPABASE_ANON_KEY` ein

### Schritt 5: Rebuild triggern
Nach dem Hinzufügen der Umgebungsvariablen:
1. Gehe zu **Deploys**
2. Klicke auf **Trigger deploy** → **Clear cache and deploy site**
3. Warte bis der Build abgeschlossen ist

## Wichtige Hinweise

### ⚠️ VITE_ Präfix ist erforderlich
- Vite erkennt nur Umgebungsvariablen mit dem Präfix `VITE_`
- Variablen ohne dieses Präfix werden NICHT in den Build eingebettet
- Falsch: `SUPABASE_URL` ❌
- Richtig: `VITE_SUPABASE_URL` ✅

### 🔒 Sicherheit
- Der **Anon Key** ist sicher für öffentliche Verwendung
- Verwende NIEMALS den **Service Role Key** im Frontend
- Service Role Operations sollten über Edge Functions laufen

### 🔄 Build-Zeit vs. Runtime
- Vite-Umgebungsvariablen werden zur **Build-Zeit** eingebettet
- Änderungen an Umgebungsvariablen erfordern einen **Rebuild**
- Die Variablen sind dann im Code als `import.meta.env.VITE_*` verfügbar

## Verifizierung

Nach dem Deployment kannst du die Konfiguration testen:

1. Öffne https://portal.kraatz-group.de
2. Öffne die Browser-Konsole (F12)
3. Du solltest sehen:
   ```
   ✅ Supabase Configuration Validated: { url: "https://...", anonKey: "eyJh..." }
   ✅ Supabase connectivity test successful
   ```

4. Wenn du stattdessen siehst:
   ```
   ❌ Uncaught Error: Missing Supabase configuration
   ```
   Dann wurden die Umgebungsvariablen nicht korrekt gesetzt oder der Build wurde nicht neu ausgeführt.

## Troubleshooting

### Problem: Fehler bleibt nach Konfiguration
**Lösung:** 
- Stelle sicher, dass du einen **neuen Build** getriggert hast
- Lösche den Netlify Cache: **Clear cache and deploy site**
- Warte bis der Build vollständig abgeschlossen ist

### Problem: "Invalid API key" Fehler
**Lösung:**
- Überprüfe, dass du den **anon** Key verwendest, nicht den service_role Key
- Stelle sicher, dass keine Leerzeichen am Anfang/Ende des Keys sind
- Kopiere den Key direkt aus dem Supabase Dashboard

### Problem: Variablen werden nicht erkannt
**Lösung:**
- Überprüfe, dass alle Variablen das `VITE_` Präfix haben
- Stelle sicher, dass die Scopes auf "All scopes" gesetzt sind
- Triggere einen neuen Build nach Änderungen

## Aktueller Status

**Supabase Projekt:** gkkveloqajxghhflkfru (dozentenportal-database)
**Produktions-URL:** https://portal.kraatz-group.de
**Netlify Site:** portal.kraatz-group.de

## Nächste Schritte

1. ✅ Umgebungsvariablen in Netlify konfigurieren
2. ✅ Rebuild triggern
3. ✅ Deployment verifizieren
4. ✅ Funktionalität testen
