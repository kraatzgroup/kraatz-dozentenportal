# Videobesprechung → Dozentenportal Migration Scripts

## Overview
Fixed, repeatable scripts for migrating users and data from the videobesprechung (kraatz-club) project into the dozentenportal project.

## Migration Order
1. **Phase 2**: User migration (export from VB, import to portal with no-email safeguards)
2. **Phase 1**: Create vb_* tables schema in portal DB
3. **Phase 3**: Copy data with FK rewriting (user_id → profile_id via vb_id_mapping)
4. **Phase 4**: Port edge functions from VB to portal
5. **Phase 5**: Port VB frontend components to portal

## Phase 2: User Migration

### Step 1: Export users from VB project
```bash
npm run migration:export-vb-users
```
This fetches all auth users and their `public.users` data from the old VB project and saves to `vb-users-export.json`.

### Step 2: Import users into portal
```bash
npm run migration:import-vb-users
```
This:
- Reads `vb-users-export.json`
- Dedupes emails against existing portal profiles
- **For existing emails**: ONLY adds `'videobesprechung'` to `additional_roles` — NEVER overwrites any existing profile data (role, full_name, etc.)
- For new emails: creates auth users via Admin API with `email_confirm: true` (**NO EMAIL SENT**)
- Inserts profiles with role mapping and `last_login` from VB
- Records ID mappings in `vb_id_mapping` table (including for deduped users)

### Role mapping
- VB `student` → portal `teilnehmer` + `additional_roles: ['videobesprechung']`
- VB `instructor` → portal `dozent`
- VB `admin` → portal `admin`

### No-email guarantee
The import script **never sends emails**:
- Uses `auth.admin.createUser()` with `email_confirm: true` (confirmed immediately, no confirmation email)
- Never calls `inviteUserByEmail()` or `generateLink()`
- No edge function calls that send mail
- `last_login` is set from VB's `last_sign_in_at` or migration time (no "Ausstehend" badge)

### Verification
After import, verify zero emails were sent:
```sql
SELECT email, confirmation_sent_at, recovery_sent_at, invited_at 
FROM auth.users 
WHERE email LIKE '%@%';
```
All email columns should be empty for migrated users.

### Rollback
To undo a test import:
```sql
DELETE FROM vb_id_mapping WHERE email = 'charlene@swipeup-marketing.com';
DELETE FROM profiles WHERE id = '4eea19a0-f891-47ae-aef0-3d1c5e48d8f5';
-- Auth user deletion requires service role + Admin API
```

## Phase 1: Create vb_* Tables Schema

### Run schema migration
```bash
npm run migration:phase1-schema
```
This creates all `vb_*` prefixed tables in the portal DB with:
- `vb_packages`, `vb_orders`, `vb_case_study_requests`, `vb_submissions`, `vb_notifications`
- `vb_video_lessons`, `vb_video_progress`, `vb_case_study_ratings`
- `vb_conversations`, `vb_conversation_participants`, `vb_chat_messages`
- All indexes, triggers, RLS policies, and helper functions
- `user_id` FKs replaced with `profile_id` (points to portal profiles)

### Tables with name collisions
- `packages` → `vb_packages` (portal has packages table)
- `messages` → `vb_chat_messages` (portal has messages table)

## Phase 3: Copy Data with FK Rewriting

### Run data copy
```bash
npm run migration:phase3-copy-data
```
This:
- Connects to both VB and portal databases
- Copies data from VB tables to vb_* tables in portal
- Rewrites `user_id` → `profile_id` using `vb_id_mapping` from Phase 2
- Handles FK dependencies in correct order
- Inserts in batches of 100 with error handling

### FK rewriting
All `user_id` columns are rewritten to `profile_id` using the mapping table:
- `orders.user_id` → `vb_orders.profile_id`
- `case_study_requests.user_id` → `vb_case_study_requests.profile_id`
- `notifications.user_id` → `vb_notifications.profile_id`
- `video_lessons.created_by` → `vb_video_lessons.created_by`
- `video_progress.user_id` → `vb_video_progress.profile_id`
- `case_study_ratings.user_id` → `vb_case_study_ratings.profile_id`
- `conversations.created_by` → `vb_conversations.created_by`
- `conversation_participants.user_id` → `vb_conversation_participants.profile_id`
- `messages.sender_id` → `vb_chat_messages.sender_id`

### Data copied
- ~460 users (via Phase 2)
- ~20 case study requests
- ~19 submissions
- ~11 video lessons
- ~6 packages
- ~11 conversations
- All related data (notifications, progress, ratings, messages)

## Next phases
- **Phase 1**: `vb_*` tables migration SQL (schema only)
- **Phase 3**: Data copy script with FK rewriting via `vb_id_mapping`
- **Phase 4**: Edge function porting
- **Phase 5**: Frontend component porting
