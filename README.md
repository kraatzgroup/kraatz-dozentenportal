# Dozentenportal - E-Mail-Benachrichtigungssystem

## SMTP-Konfiguration mit Ionos

Das System ist konfiguriert, um die gleichen SMTP-Einstellungen zu verwenden, die auch für Supabase Auth E-Mails verwendet werden:

### Ionos SMTP-Einstellungen:
- **Host**: smtp.ionos.de
- **Port**: 465 (SSL)
- **Absender**: tools@kraatz-group.de
- **Absendername**: Dozentenportal | Kraatz Group
- **Mindestintervall**: 1 Sekunde zwischen E-Mails

Diese Einstellungen sind bereits in Supabase konfiguriert und werden automatisch für alle E-Mail-Benachrichtigungen verwendet.

## Übersicht

Das System sendet automatisch E-Mail-Benachrichtigungen in folgenden Fällen:
1. **Dokument-Uploads**: An alle Administratoren, wenn ein neues Dokument hochgeladen wird
2. **Neue Nachrichten**: An den Empfänger, wenn eine neue Nachricht gesendet wird

## Funktionsweise

### 1. Automatische Trigger
- **Datei-Upload**: Beim Upload einer neuen Datei wird automatisch ein Datenbank-Trigger ausgelöst
- **Neue Nachricht**: Beim Senden einer neuen Nachricht wird automatisch ein Datenbank-Trigger ausgelöst
- Die Trigger rufen entsprechende Supabase Edge Functions auf
- Die Edge Functions senden E-Mails an die entsprechenden Empfänger

### 2. E-Mail-Templates

#### Dokument-Upload E-Mail (an Admins):
- **Dozent Name**: Vollständiger Name des Dozenten
- **Dozent E-Mail**: E-Mail-Adresse des Dozenten  
- **Dateiname**: Name der hochgeladenen Datei
- **Dateigröße**: Formatierte Dateigröße (KB, MB, etc.)
- **Upload-Datum**: Datum und Uhrzeit des Uploads
- **Kategorie**: Ordnername (Rechnungen, Tätigkeitsbericht, etc.)
- **Admin-Portal Link**: Direkter Link zum Admin-Bereich

#### Nachrichten E-Mail (an Empfänger):
- **Absender Name**: Vollständiger Name des Absenders
- **Absender E-Mail**: E-Mail-Adresse des Absenders
- **Nachrichteninhalt**: Vorschau der Nachricht (erste 150 Zeichen)
- **Sendedatum**: Datum und Uhrzeit der Nachricht
- **Portal Link**: Direkter Link zum Nachrichten-Bereich

Beide E-Mail-Templates verwenden das professionelle Kraatz Group Design mit responsivem Layout.

### 3. E-Mail-Service Konfiguration

Das System verwendet die gleichen SMTP-Einstellungen wie Supabase Auth (Ionos). Die E-Mails werden automatisch über die konfigurierten SMTP-Einstellungen versendet:

#### Automatische SMTP-Nutzung:
- **Absender**: tools@kraatz-group.de (wie in Supabase konfiguriert)
- **SMTP-Server**: smtp.ionos.de:465 (SSL)
- **Authentifizierung**: Verwendet die gleichen Zugangsdaten wie Auth-E-Mails
- **Rate Limiting**: 1 Sekunde Mindestintervall zwischen E-Mails

#### Umgebungsvariablen in Supabase:
```bash
SITE_URL=http://portal.kraatz-group.de
```
### 4. Alternative E-Mail-Services

Das System kann einfach für andere E-Mail-Services angepasst werden:

#### SendGrid:
```typescript
const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: admin.email }] }],
    from: { email: 'noreply@kraatz-group.de' },
    subject: emailPayload.subject,
    content: [{ type: 'text/html', value: emailPayload.html }]
  }),
})
```

#### Mailgun:
```typescript
const formData = new FormData()
formData.append('from', 'noreply@kraatz-group.de')
formData.append('to', admin.email)
formData.append('subject', emailPayload.subject)
formData.append('html', emailPayload.html)

const emailResponse = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`api:${Deno.env.get('MAILGUN_API_KEY')}`)}`,
  },
  body: formData,
})
```

## Installation und Konfiguration

### 1. Edge Functions deployen
Die Edge Functions werden automatisch mit den Migrationen erstellt:
- `send-upload-notification`: Für Dokument-Upload Benachrichtigungen
- `send-message-notification`: Für Nachrichten-Benachrichtigungen

### 2. Umgebungsvariablen setzen
In der Supabase-Konsole unter "Edge Functions" → "Settings":
```
SITE_URL=https://ihre-domain.com
```

**Hinweis**: Keine zusätzlichen API-Keys erforderlich, da die SMTP-Einstellungen automatisch von Supabase Auth übernommen werden.

### 3. Datenbank-Trigger aktivieren
Die Trigger werden automatisch durch die Migrationen erstellt:
- `trigger_notify_admins_on_upload`: Für Datei-Uploads
- `trigger_notify_message_recipient`: Für neue Nachrichten

### 4. Testen

#### Dokument-Upload Benachrichtigungen:
1. Laden Sie eine Datei als Dozent hoch
2. Überprüfen Sie die `send-upload-notification` Edge Function Logs
3. Überprüfen Sie, ob Admins E-Mails erhalten haben

#### Nachrichten-Benachrichtigungen:
1. Senden Sie eine Nachricht an einen anderen Benutzer
2. Überprüfen Sie die `send-message-notification` Edge Function Logs
3. Überprüfen Sie, ob der Empfänger eine E-Mail erhalten hat

## Troubleshooting

### E-Mails werden nicht gesendet
1. Überprüfen Sie die Edge Function Logs
2. Stellen Sie sicher, dass die SMTP-Einstellungen in Supabase Auth korrekt konfiguriert sind
3. Überprüfen Sie, ob die entsprechenden Benutzer in der Datenbank existieren
4. Stellen Sie sicher, dass die Datenbank-Trigger korrekt funktionieren
5. Überprüfen Sie die Ionos SMTP-Konfiguration in der Supabase-Konsole

### E-Mails landen im Spam
1. Konfigurieren Sie SPF, DKIM und DMARC Records für kraatz-group.de
2. Die Domain ist bereits verifiziert (tools@kraatz-group.de)
3. Testen Sie mit verschiedenen E-Mail-Providern
4. Überprüfen Sie die Ionos E-Mail-Reputation

### Performance-Optimierung
- E-Mails werden asynchron gesendet (blockieren nicht die Hauptfunktionalität)
- Bei Dokument-Uploads werden E-Mails an mehrere Admins parallel versendet
- Fehlerbehandlung für einzelne E-Mail-Fehler (App-Funktionalität bleibt erhalten)
- Nachrichten werden auch bei E-Mail-Fehlern erfolgreich zugestellt

## Anpassungen

### E-Mail-Templates ändern
- **Dokument-Uploads**: Bearbeiten Sie die `getEmailTemplate` Funktion in `send-upload-notification/index.ts`
- **Nachrichten**: Bearbeiten Sie die `getMessageEmailTemplate` Funktion in `send-message-notification/index.ts`

### Zusätzliche Daten hinzufügen
- **Dokument-Uploads**: Erweitern Sie die `EmailData` Interface
- **Nachrichten**: Erweitern Sie die `MessageEmailData` Interface
- Passen Sie die entsprechenden Datenbankabfragen an

### Benachrichtigungsregeln anpassen
- **Dokument-Uploads**: Modifizieren Sie `notify_admins_of_upload()` für spezifische Bedingungen
- **Nachrichten**: Modifizieren Sie `notify_message_recipient()` für spezifische Bedingungen

### Zusätzliche Benachrichtigungstypen
Das System kann einfach erweitert werden für:
- Benutzer-Registrierungen
- Passwort-Resets
- System-Wartungen
- Deadline-Erinnerungen

### SMTP-Einstellungen ändern
Falls Sie andere SMTP-Einstellungen verwenden möchten:
1. Gehen Sie zur Supabase-Konsole → Authentication → Settings → SMTP Settings
2. Aktualisieren Sie die SMTP-Konfiguration
3. Die E-Mail-Benachrichtigungen verwenden automatisch die neuen Einstellungen

### Ionos-spezifische Hinweise
- **Port 465**: SSL-verschlüsselte Verbindung (empfohlen)
- **Rate Limiting**: Ionos erlaubt standardmäßig begrenzte E-Mails pro Stunde
- **Authentifizierung**: Verwendet die gleichen Zugangsdaten wie für Auth-E-Mails
- **Absender-Reputation**: Verwenden Sie tools@kraatz-group.de für beste Zustellbarkeit