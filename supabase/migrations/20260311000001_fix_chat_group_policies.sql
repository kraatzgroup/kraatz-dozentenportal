-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their groups" ON chat_groups;
DROP POLICY IF EXISTS "Users can view group members" ON chat_group_members;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Simpler RLS policies without recursion

-- chat_groups: Users can view groups they created or are members of
CREATE POLICY "Users can view groups" ON chat_groups
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_group_members 
      WHERE chat_group_members.group_id = chat_groups.id 
      AND chat_group_members.user_id = auth.uid()
    )
  );

-- chat_group_members: Allow all authenticated users to view members
-- (we'll control access through chat_groups policy)
CREATE POLICY "Authenticated users can view group members" ON chat_group_members
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- messages: Users can view their direct messages and group messages
CREATE POLICY "Users can view messages" ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid() 
    OR receiver_id = auth.uid()
    OR (
      group_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM chat_group_members 
        WHERE chat_group_members.group_id = messages.group_id 
        AND chat_group_members.user_id = auth.uid()
      )
    )
  );

-- messages: Users can send messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      receiver_id IS NOT NULL 
      OR (
        group_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM chat_group_members 
          WHERE chat_group_members.group_id = messages.group_id 
          AND chat_group_members.user_id = auth.uid()
        )
      )
    )
  );
