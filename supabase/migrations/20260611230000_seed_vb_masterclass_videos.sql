-- Seed the 11 Klausuren-Masterclass videos into vb_video_lessons
-- Source: original videobesprechung project (klausuren.kraatz-club.de/masterclass)
-- Idempotent: only inserts a video if its youtube_id is not already present.

INSERT INTO public.vb_video_lessons (title, description, video_url, thumbnail_url, duration, category, youtube_id, is_active)
SELECT
  v.title,
  v.description,
  'https://www.youtube.com/embed/' || v.youtube_id_raw,
  'https://img.youtube.com/vi/' || v.youtube_id_raw || '/maxresdefault.jpg',
  0,
  'allgemein',
  v.youtube_id_raw,
  true
FROM (
  VALUES
    ('Video 1: Der Obersatz',
     'Wie bilde ich einen optimalen Obersatz, um meiner Klausur zu mehr Struktur zu verhelfen und den Korrektor von meinem Gutachten zu überzeugen?',
     'ogYOD5-_tG4'),
    ('Video 2: Die Subsumtion',
     'Wie subsumiere ich richtig in meinem Gutachten in der Klausur, um die maximale Anzahl an Punkten zu generieren?',
     'ZZYoSja9vqA'),
    ('Video 3: Darstellung von Meinungsstreiten',
     'Wie stelle ich einen Meinungsstreit in einer Klausur sauber dar und für welche Meinung sollte ich mich klausurtaktisch entscheiden?',
     'S4oCcdB8oJc'),
    ('Video 4: Kurzfassen in der Klausur',
     'Wie zeige ich meinem Korrektor, dass ich die Schwerpunktsetzung beherrsche und Probleme sauber darstelle?',
     'B_ZS62hMlSs'),
    ('Video 5: Die Lösungsskizze erstellen',
     'Wie erstelle ich eigentlich eine Lösungsskizze, um mein Gutachten sinnvoll zu strukturieren, bevor ich mit der Bearbeitung starte?',
     '61vaSnSFPkQ'),
    ('Video 6: Die Zeiteinteilung in der Klausur',
     'Wie teile ich mir meine Zeit richtig ein, um meine Klausur fertigstellen zu können und nicht unter Zeitnot zu leiden?',
     'DtFgJGiQiT4'),
    ('Video 7: Was wollen die Prüfer von Dir sehen?',
     'Wir verraten Dir, was die Prüfer von Dir sehen wollen, um Deinen Traum vom Prädikat zu erreichen!',
     'jW3Bdk5iXoU'),
    ('Video 8: Was die Prüfer NICHT von Dir sehen wollen',
     'Vermeide diese Fehler in Deiner Klausur!',
     'nUbIdOGH_ok'),
    ('Video 9: Überschriften und Gliederung in der Klausur',
     'Sollte ich mit Überschriften bei meiner Klausurerstellung arbeiten?',
     '5_VB2F4CqtU'),
    ('Video 10: Umgang mit den korrigierten Klausuren in der Nacharbeit',
     'Wie arbeite ich meine Klausuren richtig nach und ziehe den maximalen Vorteil aus meiner Videokorrektur?',
     'EuVifisudCc'),
    ('Video 11: Umgang mit dem Feedbackpaper',
     'Wie bearbeite ich das Feedback-Papier und in welchen Zyklen sollte ich die Inhalte der Klausur wiederholen?',
     'SY3CQkeq99A')
) AS v(title, description, youtube_id_raw)
WHERE NOT EXISTS (
  SELECT 1 FROM public.vb_video_lessons existing WHERE existing.youtube_id = v.youtube_id_raw
);
