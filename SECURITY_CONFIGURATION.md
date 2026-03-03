# Security Configuration Guide

This document outlines the security configurations that need to be applied to the Dozentenportal application.

## Database Security (Completed)

### ✅ Function Search Path Security
All database functions have been updated with:
- `SECURITY DEFINER` - Functions run with the privileges of the function owner
- `SET search_path = public` - Explicit search path to prevent injection attacks

**Migration Applied:** `20260303_fix_security_warnings.sql`

### ✅ Row-Level Security (RLS) Policies
Overly permissive RLS policies have been replaced with role-based and ownership-based checks:

- **calendar_entries**: Restricted to entry creators and admins
- **contract_requests**: Admin and Vertrieb only
- **contract_templates**: Admin only
- **dozent_availability**: Own data or admin/vertrieb
- **elite_kleingruppe_klausuren**: Participants, dozenten, and admins
- **elite_kleingruppe_releases**: Admins and assigned dozenten
- **email_templates**: Admin only
- **lead_notes**: Admin and Vertrieb only
- **leads**: Admin and Vertrieb only
- **sales_todos**: Admin and Vertrieb only
- **stundenzettel**: Own data or admin

**Note:** Some tables intentionally maintain permissive policies for authenticated users:
- `dashboard_sections` - UI configuration
- `material_folders` - File sharing functionality
- `teaching_materials` - Cross-user file access

## Supabase Auth Configuration (Manual Action Required)

### ⚠️ Leaked Password Protection

**Status:** Not Enabled (requires manual configuration)

**Action Required:**
1. Navigate to the Supabase Dashboard: https://supabase.com/dashboard/project/gkkveloqajxghhflkfru
2. Go to **Authentication** → **Policies** → **Password Protection**
3. Enable **"Leaked Password Protection"**

**What it does:**
- Checks user passwords against the HaveIBeenPwned.org database
- Prevents users from using compromised passwords
- Enhances overall account security

**Impact:**
- Users will not be able to set passwords that have been found in data breaches
- Existing users with compromised passwords will be prompted to change them on next login

**Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Security Warnings Summary

### Before Migration
- **32 Function Search Path Warnings** - Functions without explicit search_path
- **27 Overly Permissive RLS Policies** - Policies using `USING (true)` or `WITH CHECK (true)`
- **1 Auth Configuration Warning** - Leaked password protection disabled

### After Migration
- ✅ **0 Function Search Path Warnings** - All functions secured
- ✅ **~10 Overly Permissive RLS Policies** - Intentional for shared resources
- ⚠️ **1 Auth Configuration Warning** - Requires manual dashboard configuration

## Testing Checklist

After applying security changes, verify the following features still work:

### Authentication & Authorization
- [ ] User login/logout
- [ ] Role-based access (admin, dozent, vertrieb, teilnehmer)
- [ ] First-time login flow

### Calendar & Scheduling
- [ ] Create calendar entries
- [ ] Update calendar entries
- [ ] Delete calendar entries
- [ ] View calendar entries

### Document Management
- [ ] Upload files to folders
- [ ] Download files
- [ ] Mark files as downloaded
- [ ] View file lists

### Elite Kleingruppe
- [ ] Create releases
- [ ] Update releases
- [ ] View solutions (after release)
- [ ] Submit klausuren
- [ ] View participant hours

### Invoicing
- [ ] Generate invoices
- [ ] View invoice numbers
- [ ] Create invoice items
- [ ] Monthly hours summary

### Sales & Leads
- [ ] Create leads
- [ ] Update leads
- [ ] Add lead notes
- [ ] Manage sales todos
- [ ] Contract requests

### Monthly Document Check
- [ ] Trigger document check
- [ ] View document status
- [ ] Get deadline information

## Migration History

| Date | Migration File | Description |
|------|---------------|-------------|
| 2026-03-03 | `20260303_fix_security_warnings.sql` | Fixed function search_path warnings and overly permissive RLS policies |

## Contact

For security-related questions or concerns, please contact the development team.
