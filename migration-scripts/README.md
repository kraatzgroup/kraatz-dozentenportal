# Videobesprechung → Dozentenportal Migration Scripts

## Overview
Fixed, repeatable scripts for migrating users and data from the videobesprechung (kraatz-club) project into the dozentenportal project.

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

## Next phases
- **Phase 1**: `vb_*` tables migration SQL (schema only)
- **Phase 3**: Data copy script with FK rewriting via `vb_id_mapping`
- **Phase 4**: Edge function porting
- **Phase 5**: Frontend component porting
