/**
 * Export users from the videobesprechung (kraatz-club) project
 * 
 * This script fetches all auth users and their corresponding public.users data
 * from the old VB project and saves them to a JSON file for migration.
 * 
 * Usage:
 *   npx tsx export-vb-users.ts
 * 
 * Environment variables (from ~/github/videobesprechung/.env):
 *   REACT_APP_SUPABASE_URL
 *   REACT_APP_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const VB_SUPABASE_URL = process.env.VB_SUPABASE_URL || 'https://rpgbyockvpannrupicno.supabase.co';
const VB_SERVICE_ROLE_KEY = process.env.VB_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZ2J5b2NrdnBhbm5ydXBpY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzUxOSwiZXhwIjoyMDcxOTY5NTE5fQ.7qzGyeOOVwNbmZPxgK4aiQi9mh4gipFWV8kk-LngUbk';

interface VBAuthUser {
  id: string;
  email: string | null;
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

async function exportUsers() {
  console.log('📦 Starting user export from videobesprechung project...');
  
  const supabase = createClient(VB_SUPABASE_URL, VB_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
    },
  });

  const allUsers: ExportedUser[] = [];
  let page = 1;
  let hasMore = true;

  // Fetch all auth users with pagination
  while (hasMore) {
    console.log(`Fetching auth users (page ${page})...`);
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      process.exit(1);
    }

    console.log(`Found ${authUsers.users.length} auth users on page ${page}`);

    for (const authUser of authUsers.users) {
      if (!authUser.email) {
        console.log(`⚠️  Skipping user without email: ${authUser.id}`);
        continue;
      }

      const auth: VBAuthUser = {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at || null,
        last_sign_in_at: authUser.last_sign_in_at || null,
        created_at: authUser.created_at,
        user_metadata: authUser.user_metadata || {},
      };

      // Fetch corresponding public.users row
      const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const exportedUser: ExportedUser = {
        auth,
        public: publicError ? null : publicUser,
      };

      allUsers.push(exportedUser);
    }

    hasMore = authUsers.users.length === 100;
    page++;
  }

  console.log(`✅ Exported ${allUsers.length} users total`);

  // Save to JSON file
  const outputPath = path.join(__dirname, 'vb-users-export.json');
  fs.writeFileSync(outputPath, JSON.stringify(allUsers, null, 2), 'utf-8');
  console.log(`💾 Saved to ${outputPath}`);

  // Print summary
  const summary = {
    total: allUsers.length,
    byRole: allUsers.reduce((acc, u) => {
      const role = u.public?.role || 'unknown';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    withPublicRecord: allUsers.filter(u => u.public !== null).length,
    confirmed: allUsers.filter(u => u.auth.email_confirmed_at !== null).length,
  };

  console.log('\n📊 Summary:', JSON.stringify(summary, null, 2));
}

exportUsers().catch(console.error);
