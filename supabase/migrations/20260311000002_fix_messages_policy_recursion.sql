-- Drop all existing message policies that might cause recursion
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send their messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;

-- Create new non-recursive policies for messages

-- Policy 1: View direct messages (sender or receiver)
CREATE POLICY "View direct messages" ON messages
  FOR SELECT
  USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND group_id IS NULL
  );

-- Policy 2: View group messages (member of the group)
CREATE POLICY "View group messages" ON messages
  FOR SELECT
  USING (
    group_id IS NOT NULL
    AND auth.uid() = ANY(
      SELECT user_id 
      FROM chat_group_members 
      WHERE group_id = messages.group_id
    )
  );

-- Policy 3: Send direct messages
CREATE POLICY "Send direct messages" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND receiver_id IS NOT NULL
    AND group_id IS NULL
  );

-- Policy 4: Send group messages (must be member)
CREATE POLICY "Send group messages" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND group_id IS NOT NULL
    AND receiver_id IS NULL
    AND auth.uid() = ANY(
      SELECT user_id 
      FROM chat_group_members 
      WHERE group_id = messages.group_id
    )
  );

-- Policy 5: Update own messages (mark as read)
CREATE POLICY "Update own messages" ON messages
  FOR UPDATE
  USING (receiver_id = auth.uid() OR sender_id = auth.uid());
