# Dozentenportal

Ein Portal für Dozenten der Kraatz Group zur Verwaltung von Dokumenten, Teilnehmern und Kommunikation.

## Funktionen

- **Dokumentenverwaltung**: Upload und Verwaltung von Rechnungen, Tätigkeitsberichten und Teilnehmerlisten
- **Teilnehmerverwaltung**: Verwaltung von Kursteilnehmern
- **Nachrichtensystem**: Interne Kommunikation zwischen Dozenten und Administratoren
- **Admin-Dashboard**: Übersicht und Verwaltung aller Dozenten und Dokumente

## Technologie-Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Hosting**: Netlify

## Umgebungsvariablen

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev

# Build erstellen
npm run build
```

## Deployment

Das Projekt wird automatisch über Netlify deployed. Die Live-Version ist unter https://portal.kraatz-group.de erreichbar.