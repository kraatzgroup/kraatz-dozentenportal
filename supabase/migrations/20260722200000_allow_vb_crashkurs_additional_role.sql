-- Allow 'vb_crashkurs' as an additional role on profiles.
-- Crashkurs perk for Videoklausurenkorrektur (VB) Teilnehmer:
-- they only pick the legal area when requesting a Sachverhalt, and dozenten
-- may only assign materials from folders with "Crashkurs" in their name.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_additional_roles_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_additional_roles_check
  CHECK (additional_roles <@ ARRAY[
    'admin'::text,
    'buchhaltung'::text,
    'verwaltung'::text,
    'vertrieb'::text,
    'dozent'::text,
    'teilnehmer'::text,
    'videobesprechung'::text,
    'videobesprechung_dozent'::text,
    'vb_crashkurs'::text
  ]);
