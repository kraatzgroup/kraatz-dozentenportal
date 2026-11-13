/*
  # Nachbuchungen – Anfragen der Verwaltung an Dozenten

  Verwaltung/Admin/Vertrieb legen eine Nachbuchungs-Anfrage an (Teilnehmer,
  Rechtsgebiet, Dozent). Eine Edge-Function erzeugt einen einmaligen, gehashten
  Token, verschickt per E-Mail einen Link an den Dozenten und speichert hier nur
  den SHA-256-Hash. Der Dozent öffnet das Formular über den Link (ohne Portal-
  Login) und antwortet. Status wird hier im Dashboard als Ampel angezeigt:
    - ausstehend (gelb)
    - ausstehend & älter als 3 Tage (rot, Handlungsbedarf)
    - beantwortet (grün)
*/

create table if not exists public.nachbuchungen (
  id                uuid primary key default gen_random_uuid(),
  teilnehmer_id     uuid references public.teilnehmer(id) on delete set null,
  dozent_id         uuid references public.profiles(id) on delete set null,
  rechtsgebiet      text not null,
  status            text not null default 'ausstehend' check (status in ('ausstehend', 'beantwortet')),
  token_hash        text not null unique,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz not null default now(),
  expires_at        timestamptz not null,
  responded_at      timestamptz,
  antwort_bedarf    boolean,
  antwort_stunden   integer,
  antwort_erreichbar text,
  antwort_notiz     text
);

create index if not exists nachbuchungen_status_idx     on public.nachbuchungen (status);
create index if not exists nachbuchungen_dozent_idx     on public.nachbuchungen (dozent_id);
create index if not exists nachbuchungen_teilnehmer_idx on public.nachbuchungen (teilnehmer_id);
create index if not exists nachbuchungen_expires_idx    on public.nachbuchungen (expires_at);

alter table public.nachbuchungen enable row level security;

-- Helper: berechtigte Mitarbeiter (Verwaltung, Admin, Vertrieb)
create or replace function public.is_nachbuchung_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'verwaltung', 'vertrieb')
        or p.additional_roles && array['admin', 'verwaltung', 'vertrieb']::text[]
      )
  );
$$;

-- Nur berechtigte Mitarbeiter dürfen die Anfragen im Dashboard lesen.
-- Schreiben (anlegen/antworten) läuft ausschließlich über Edge Functions
-- (Service Role), damit der Dozenten-Link ohne Portal-Login funktioniert und
-- der anon-Rolle keinerlei Zugriff auf Teilnehmerdaten gewährt wird.
create policy "nachbuchungen_staff_select"
  on public.nachbuchungen
  for select
  using (public.is_nachbuchung_staff());