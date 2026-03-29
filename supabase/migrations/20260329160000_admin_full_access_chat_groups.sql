-- Migration: Give admins full access to chat_groups and chat_group_members
-- Date: 2026-03-29
-- Purpose: Allow admins to view and delete all chat groups

-- Drop existing SELECT policy for chat_groups and replace with one that includes admin
DROP POLICY IF EXISTS "Users can view groups" ON chat_groups;

CREATE POLICY "Users can view groups" ON chat_groups
  FOR SELECT
  USING (
    -- Admin can see all groups
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_group_members 
      WHERE chat_group_members.group_id = chat_groups.id 
      AND chat_group_members.user_id = auth.uid()
    )
  );

-- Drop existing DELETE policy and replace with one that includes admin
DROP POLICY IF EXISTS "Group creators can delete groups" ON chat_groups;

CREATE POLICY "Group creators or admins can delete groups" ON chat_groups
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Also allow admins to delete group members (for cascade cleanup)
DROP POLICY IF EXISTS "Group creators can remove members" ON chat_group_members;

CREATE POLICY "Group creators or admins can remove members" ON chat_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_groups 
      WHERE id = group_id 
      AND created_by = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admins to add members to any group
DROP POLICY IF EXISTS "Group creators can add members" ON chat_group_members;

CREATE POLICY "Group creators or admins can add members" ON chat_group_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_groups 
      WHERE id = group_id 
      AND created_by = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
