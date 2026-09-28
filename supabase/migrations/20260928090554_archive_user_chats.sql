CREATE TABLE public.user_chat_archives (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_id),
  CONSTRAINT user_chat_archives_distinct_users CHECK (user_id <> contact_id)
);

ALTER TABLE public.user_chat_archives ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.user_chat_archives TO authenticated;

CREATE POLICY "Users can view their own chat archives"
  ON public.user_chat_archives FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can archive their own chats"
  ON public.user_chat_archives FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can unarchive their own chats"
  ON public.user_chat_archives FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
