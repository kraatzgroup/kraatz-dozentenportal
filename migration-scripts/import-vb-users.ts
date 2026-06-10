/**
 * Import users from videobesprechung export into the dozentenportal project
 * 
 * This script:
 * 1. Reads the exported users JSON
 * 2. Dedupes emails against existing portal profiles
 * 3. Creates auth users via Admin API with email_confirm: true (NO EMAIL SENT)
 * 4. Inserts profiles with role mapping and last_login from VB
 * 5. Records ID mappings in vb_id_mapping table
 * 
 * CRITICAL: This script NEVER sends emails. It uses:
 * - Admin API with email_confirm: true (confirmed immediately, no confirmation email)
 * - No inviteUserByEmail or generateLink calls
 * - No edge function calls that send mail
 * 
 * Usage:
 *   npx tsx import-vb-users.ts
 * 
 * Environment variables (from dozentenportal .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   (Service role key fetched via Supabase CLI)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PORTAL_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gkkveloqajxghhflkfru.supabase.co';
const PORTAL_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

interface VBAuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  user_metadata: Record<string, any>;
}

interface VBPublicUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  account_credits: number;
  role: 'student' | 'instructor' | 'admin';
  email_notifications_enabled: boolean;
  legal_areas: string[] | null;
  profile_image_url: string | null;
  stripe_customer_id: string | null;
  vacation_start_date: string | null;
  vacation_end_date: string | null;
  vacation_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ExportedUser {
  auth: VBAuthUser;
  public: VBPublicUser | null;
}

interface PortalProfile {
  id: string;
  email: string;
  role: string;
  additional_roles: string[];
}

// Get service role key via Supabase CLI
function getServiceRoleKey(): string {
  try {
    const output = execSync('supabase projects api-keys --project-ref gkkveloqajxghhflkfru -o json', {
      encoding: 'utf-8',
      cwd: '/Users/charlenenowak/github/dozentenportal',
    });
    const keys = JSON.parse(output);
    const serviceKey = keys.find((k: any) => k.name === 'service_role');
    if (!serviceKey) {
      throw new Error('Service role key not found');
    }
    return serviceKey.api_key;
  } catch (error) {
    console.error('❌ Error fetching service role key:', error);
    throw error;
  }
}

// Map VB role to portal role
function mapRole(vbRole: string): string {
  switch (vbRole) {
    case 'student':
      return 'teilnehmer';
    case 'instructor':
      return 'dozent';
    case 'admin':
      return 'admin';
    default:
      return 'teilnehmer';
  }
}

async function importUsers() {
  console.log('🚀 Starting user import into dozentenportal...');
  console.log('⚠️  NO EMAILS WILL BE SENT (email_confirm: true, no invite functions)');

  const serviceRoleKey = getServiceRoleKey();
  const supabase = createClient(PORTAL_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
    },
  });

  // Load exported users
  const exportPath = path.join(__dirname, 'vb-users-export.json');
  if (!fs.existsSync(exportPath)) {
    console.error('❌ Export file not found. Run export-vb-users.ts first.');
    process.exit(1);
  }

  const exportedUsers: ExportedUser[] = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  console.log(`📦 Loaded ${exportedUsers.length} users from export`);

  // Fetch existing portal profiles for deduping
  console.log('🔍 Fetching existing portal profiles for deduping...');
  const { data: existingProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, role, additional_roles');

  if (profilesError) {
    console.error('❌ Error fetching existing profiles:', profilesError);
    process.exit(1);
  }

  const emailToProfile = new Map<string, PortalProfile>();
  for (const p of existingProfiles || []) {
    emailToProfile.set(p.email, p);
  }
  console.log(`Found ${emailToProfile.size} existing profiles`);

  // Ensure vb_id_mapping table exists
  console.log('🔧 Ensuring vb_id_mapping table exists...');
  try {
    execSync(
      `PGPASSWORD="F3FDla45LW4FrJAvpR8N9qZPXLP5Q5Ah2LMvLZB34D1lhIvXsw" psql "postgresql://postgres.gkkveloqajxghhflkfru@aws-1-eu-west-1.pooler.supabase.com:6543/postgres" -c "CREATE TABLE IF NOT EXISTS public.vb_id_mapping (old_id uuid PRIMARY KEY, old_auth_id uuid, new_id uuid NOT NULL REFERENCES public.profiles(id), email text, migrated_at timestamptz DEFAULT now());"`,
      { cwd: '/Users/charlenenowak/github/dozentenportal' }
    );
    console.log('✅ vb_id_mapping table ready');
  } catch (e: any) {
    // Table may already exist, log and continue
    console.log('ℹ️  Table may already exist, continuing...');
  }

  const stats = {
    total: exportedUsers.length,
    created: 0,
    deduped: 0,
    errors: 0,
  };

  const migrationTime = new Date().toISOString();

  for (const exportedUser of exportedUsers) {
    const { auth, public: vbPublic } = exportedUser;
    const vbRole = vbPublic?.role || 'student';
    const portalRole = mapRole(vbRole);
    const additionalRoles = ['videobesprechung'];

    // Dedupe check - CRITICAL: NEVER overwrite existing portal user data
    const existingProfile = emailToProfile.get(auth.email);
    if (existingProfile) {
      console.log(`⚠️  Email already exists: ${auth.email} → enriching with videobesprechung tag ONLY`);
      
      // SAFETY: Only add 'videobesprechung' to additional_roles if not already present
      // NEVER touch any other field (role, full_name, etc.) - preserve all existing portal data
      const currentAdditional = existingProfile.additional_roles || [];
      if (!currentAdditional.includes('videobesprechung')) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ additional_roles: [...currentAdditional, 'videobesprechung'] })
          .eq('id', existingProfile.id);
        
        if (updateError) {
          console.error(`❌ Error adding videobesprechung role to ${auth.email}:`, updateError);
          stats.errors++;
          continue;
        }
        console.log(`✅ Added videobesprechung tag to existing profile: ${auth.email}`);
      } else {
        console.log(`ℹ️  Profile already has videobesprechung tag: ${auth.email}`);
      }

      // Record mapping for audit trail
      await supabase.from('vb_id_mapping').insert({
        old_id: vbPublic?.id || auth.id,
        old_auth_id: auth.id,
        new_id: existingProfile.id,
        email: auth.email,
        migrated_at: migrationTime,
      });

      stats.deduped++;
      continue;
    }

    // Create new auth user (NO EMAIL - email_confirm: true)
    console.log(`➕ Creating auth user: ${auth.email}`);
    
    try {
      const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
        email: auth.email,
        email_confirm: true, // CRITICAL: confirmed immediately, no email sent
        user_metadata: {
          first_name: vbPublic?.first_name || auth.user_metadata.first_name,
          last_name: vbPublic?.last_name || auth.user_metadata.last_name,
          migrated_from: 'videobesprechung',
        },
      });

      if (createError) {
        console.error(`❌ Error creating auth user for ${auth.email}:`, createError);
        stats.errors++;
        continue;
      }

      const newId = newAuthUser.user.id;
      console.log(`✅ Auth user created: ${newId}`);

      // Insert profile
      const fullName = `${vbPublic?.first_name || ''} ${vbPublic?.last_name || ''}`.trim() || auth.email;
      const firstName = vbPublic?.first_name || auth.user_metadata.first_name || '';
      const lastName = vbPublic?.last_name || auth.user_metadata.last_name || '';
      
      // Use last_sign_in_at from VB, or migration time as fallback
      const lastLogin = auth.last_sign_in_at || migrationTime;

      await supabase.from('profiles').insert({
        id: newId,
        email: auth.email,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        role: portalRole,
        additional_roles: additionalRoles,
        last_login: lastLogin,
      });

      console.log(`✅ Profile created: ${auth.email} as ${portalRole}`);

      // Record mapping
      await supabase.from('vb_id_mapping').insert({
        old_id: vbPublic?.id || auth.id,
        old_auth_id: auth.id,
        new_id: newId,
        email: auth.email,
        migrated_at: migrationTime,
      });

      stats.created++;
    } catch (error: any) {
      console.error(`❌ Error processing ${auth.email}:`, error);
      stats.errors++;
    }
  }

  console.log('\n📊 Import complete:');
  console.log(JSON.stringify(stats, null, 2));
  console.log('✅ NO EMAILS WERE SENT');
}

importUsers().catch(console.error);
