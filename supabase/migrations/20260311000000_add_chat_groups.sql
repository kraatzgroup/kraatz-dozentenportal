-- Create chat_groups table
CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_group_members table
CREATE TABLE IF NOT EXISTS chat_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Add group_id to messages table to support group messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE;

-- Add constraint: message must have either receiver_id OR group_id, but not both
ALTER TABLE messages ADD CONSTRAINT messages_receiver_or_group_check 
  CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR 
    (receiver_id IS NULL AND group_id IS NOT NULL)
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON chat_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id ON chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);

-- Enable RLS on chat_groups
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_group_members
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_groups
-- Users can view groups they are members of
CREATE POLICY "Users can view their groups" ON chat_groups
  FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM chat_group_members WHERE user_id = auth.uid()
    )
  );

-- Admin and Dozent can create groups
CREATE POLICY "Admin and Dozent can create groups" ON chat_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'dozent')
    )
  );

-- Group creators can update their groups
CREATE POLICY "Group creators can update groups" ON chat_groups
  FOR UPDATE
  USING (created_by = auth.uid());

-- Group creators can delete their groups
CREATE POLICY "Group creators can delete groups" ON chat_groups
  FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for chat_group_members
-- Users can view members of groups they belong to
CREATE POLICY "Users can view group members" ON chat_group_members
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM chat_group_members WHERE user_id = auth.uid()
    )
  );

-- Group creators can add members
CREATE POLICY "Group creators can add members" ON chat_group_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_groups 
      WHERE id = group_id 
      AND created_by = auth.uid()
    )
  );

-- Group creators can remove members
CREATE POLICY "Group creators can remove members" ON chat_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_groups 
      WHERE id = group_id 
      AND created_by = auth.uid()
    )
  );

-- Update messages RLS policy to include group messages
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid() 
    OR receiver_id = auth.uid()
    OR (
      group_id IS NOT NULL 
      AND group_id IN (
        SELECT group_id FROM chat_group_members WHERE user_id = auth.uid()
      )
    )
  );

-- Update messages insert policy to include group messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      receiver_id IS NOT NULL 
      OR (
        group_id IS NOT NULL 
        AND group_id IN (
          SELECT group_id FROM chat_group_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_group_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on chat_groups
CREATE TRIGGER update_chat_groups_updated_at
  BEFORE UPDATE ON chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_group_updated_at();
