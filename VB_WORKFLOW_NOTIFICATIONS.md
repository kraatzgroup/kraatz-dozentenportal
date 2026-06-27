# VB Workflow Notification System

## Overview
The VB (Videobesprechung) workflow notification system has been refactored to be bulletproof and consistent across all workflow stages. Notifications are now handled automatically by database triggers, eliminating reliance on manual frontend calls.

## Workflow Stages and Notifications

### 1. **requested → materials_ready** (Dozent assigns materials)
- **Trigger**: `trigger_notify_student_on_material_ready`
- **Action**: Creates notification in `vb_notifications` table
- **Email**: Sent via `vb-notify-student` edge function (triggered by webhook)
- **Recipient**: Student
- **Message**: "Sachverhalt verfügbar" or "Material geändert" (if re-assigning)

### 2. **materials_ready → submitted** (Student submits work)
- **Trigger**: `trigger_notify_dozent_on_submission`
- **Action**: Creates notification in `vb_notifications` table
- **Email**: Sent via `vb-notify-dozent` edge function (delegated from `vb-notify-student`)
- **Recipient**: Dozent
- **Message**: "Neue Bearbeitung eingereicht"

### 3. **submitted → under_review** (Dozent claims)
- **Action**: No notification needed (internal state change)

### 4. **under_review → corrected** (Dozent corrects)
- **Trigger**: `trigger_notify_student_on_correction_complete`
- **Action**: Creates notification in `vb_notifications` table
- **Email**: Sent via `vb-notify-student` edge function (triggered by webhook)
- **Recipient**: Student
- **Message**: "Korrektur verfügbar"

### 5. **corrected → completed** (Dozent adds video)
- **Trigger**: `trigger_notify_student_on_correction_complete`
- **Action**: Creates notification in `vb_notifications` table
- **Email**: Sent via `vb-notify-student` edge function (triggered by webhook)
- **Recipient**: Student
- **Message**: "Korrektur abgeschlossen"

## Architecture

### Database Layer
- **Triggers**: Three PostgreSQL triggers on `vb_case_study_requests` table
  - `notify_dozent_on_submission()`: Fires on status → 'submitted'
  - `notify_student_on_material_ready()`: Fires on status → 'materials_ready'
  - `notify_student_on_correction_complete()`: Fires on status → 'corrected' or 'completed'
- **Notification Table**: `vb_notifications` stores all notification records
- **Realtime**: Enabled on `vb_notifications` for webhook triggers

### Edge Functions
- **vb-notify-student**: Handles both webhook triggers and direct calls
  - Webhook mode: Processes INSERT events on `vb_notifications`
  - Delegates dozent notifications to `vb-notify-dozent`
  - Sends student emails directly
- **vb-notify-dozent**: Sends dozent notification emails with magic links

### Frontend Changes
- **Removed**: Manual edge function calls for notifications
- **Simplified**: Status updates now automatically trigger notifications via database triggers
- **Files Modified**:
  - `src/components/vb-chat/VbKorrekturDashboard.tsx`: Removed manual notification calls
  - `src/components/vb-chat/VbCaseStudyDashboard.tsx`: Removed manual notification calls

## Migration
- **File**: `supabase/migrations/20260627_vb_workflow_notification_triggers.sql`
- **Applied**: Directly via psql (migration history out of sync)
- **Changes**:
  - Created 3 trigger functions
  - Created 3 triggers on `vb_case_study_requests`
  - Enabled realtime on `vb_notifications`
  - Added comments for documentation

## Benefits
1. **Bulletproof**: Notifications guaranteed regardless of frontend implementation
2. **Consistent**: All workflow stages follow the same pattern
3. **Maintainable**: Single source of truth for notification logic
4. **Audit Trail**: All notifications stored in database
5. **Resilient**: Frontend bugs won't prevent notifications

## Testing
To test the workflow:
1. Update a case study status to `materials_ready` → check student notification
2. Update a case study status to `submitted` → check dozent notification
3. Update a case study status to `corrected` → check student notification
4. Update a case study status to `completed` → check student notification

Check logs in Supabase Dashboard for trigger execution logs.
