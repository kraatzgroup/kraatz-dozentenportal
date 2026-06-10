/**
 * Phase 3: Copy data from VB project to portal vb_* tables with FK rewriting
 * 
 * This script:
 * 1. Connects to both VB and portal databases
 * 2. Copies data from VB tables to vb_* tables in portal
 * 3. Rewrites user_id FKs to profile_id using vb_id_mapping
 * 4. Handles foreign key dependencies in correct order
 * 
 * Usage:
 *   npx tsx phase3-copy-data.ts
 * 
 * Environment variables:
 *   VB_SUPABASE_URL, VB_SERVICE_ROLE_KEY (from videobesprechung .env)
 *   VITE_SUPABASE_URL (portal URL)
 *   Service role key fetched via Supabase CLI
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const VB_SUPABASE_URL = process.env.VB_SUPABASE_URL || 'https://rpgbyockvpannrupicno.supabase.co';
const VB_SERVICE_ROLE_KEY = process.env.VB_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZ2J5b2NrdnBhbm5ydXBpY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzUxOSwiZXhwIjoyMDcxOTY5NTE5fQ.7qzGyeOOVwNbmZPxgK4aiQi9mh4gipFWV8kk-LngUbk';
const PORTAL_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gkkveloqajxghhflkfru.supabase.co';

// Get service role key via Supabase CLI
function getPortalServiceRoleKey(): string {
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

// Load ID mapping from vb_id_mapping
async function loadIdMapping(portal: SupabaseClient): Promise<Map<string, string>> {
  console.log('📋 Loading vb_id_mapping...');
  const { data, error } = await portal
    .from('vb_id_mapping')
    .select('old_auth_id, new_id');

  if (error) {
    console.error('❌ Error loading vb_id_mapping:', error);
    throw error;
  }

  const mapping = new Map<string, string>();
  for (const row of data || []) {
    mapping.set(row.old_auth_id, row.new_id);
  }

  console.log(`✅ Loaded ${mapping.size} ID mappings`);
  return mapping;
}

// Rewrite user_id to profile_id using mapping
function rewriteUserId(id: string | null, mapping: Map<string, string>): string | null {
  if (!id) return null;
  const newId = mapping.get(id);
  if (!newId) {
    console.warn(`⚠️  No mapping found for user_id: ${id}`);
    return null;
  }
  return newId;
}

// Generic copy function
async function copyTable<T extends Record<string, any>>(
  vbClient: SupabaseClient,
  portalClient: SupabaseClient,
  vbTable: string,
  portalTable: string,
  idMapping: Map<string, string>,
  userColumns: string[] = [],
  idColumn: string = 'id'
): Promise<number> {
  console.log(`📦 Copying ${vbTable} -> ${portalTable}...`);

  // Fetch all data from VB
  const { data: vbData, error: fetchError } = await vbClient
    .from(vbTable)
    .select('*');

  if (fetchError) {
    console.error(`❌ Error fetching from ${vbTable}:`, fetchError);
    return 0;
  }

  if (!vbData || vbData.length === 0) {
    console.log(`ℹ️  No data in ${vbTable}`);
    return 0;
  }

  console.log(`   Found ${vbData.length} rows`);

  // Rewrite user_id columns
  const portalData = vbData.map(row => {
    const newRow: Record<string, any> = { ...row };
    for (const col of userColumns) {
      newRow[col] = rewriteUserId(row[col], idMapping);
    }
    return newRow;
  });

  // Insert into portal (skip rows with null user_id if required)
  const validRows = portalData.filter(row => {
    for (const col of userColumns) {
      if (row[col] === null && row[col] !== undefined) {
        console.warn(`⚠️  Skipping row with null ${col}: ${row[idColumn]}`);
        return false;
      }
    }
    return true;
  });

  if (validRows.length === 0) {
    console.log(`ℹ️  No valid rows to insert after ID rewriting`);
    return 0;
  }

  // Insert in batches of 100
  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    const { error: insertError } = await portalClient
      .from(portalTable)
      .insert(batch);

    if (insertError) {
      console.error(`❌ Error inserting batch ${i / batchSize}:`, insertError);
      // Try inserting one by one to identify problematic rows
      for (const row of batch) {
        const { error: singleError } = await portalClient
          .from(portalTable)
          .insert(row);
        if (singleError) {
          console.error(`❌ Failed to insert row ${row[idColumn]}:`, singleError);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  console.log(`✅ Inserted ${inserted}/${validRows.length} rows`);
  return inserted;
}

async function main() {
  console.log('🚀 Starting Phase 3: Data copy with FK rewriting...');

  const portalServiceKey = getPortalServiceRoleKey();

  const vbClient = createClient(VB_SUPABASE_URL, VB_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false },
  });

  const portalClient = createClient(PORTAL_SUPABASE_URL, portalServiceKey, {
    auth: { autoRefreshToken: false },
  });

  // Load ID mapping
  const idMapping = await loadIdMapping(portalClient);

  const stats: Record<string, number> = {};

  // Copy in dependency order (no FKs first, then dependent tables)
  
  // 1. vb_packages (no user FKs)
  stats.packages = await copyTable(
    vbClient, portalClient,
    'packages', 'vb_packages',
    idMapping, [], 'id'
  );

  // 2. vb_orders (user_id -> profile_id, package_id FK)
  stats.orders = await copyTable(
    vbClient, portalClient,
    'orders', 'vb_orders',
    idMapping, ['user_id'], 'id'
  );

  // 3. vb_case_study_requests (user_id -> profile_id)
  stats.case_study_requests = await copyTable(
    vbClient, portalClient,
    'case_study_requests', 'vb_case_study_requests',
    idMapping, ['user_id'], 'id'
  );

  // 4. vb_submissions (case_study_request_id FK, no user FK)
  stats.submissions = await copyTable(
    vbClient, portalClient,
    'submissions', 'vb_submissions',
    idMapping, [], 'id'
  );

  // 5. vb_notifications (user_id -> profile_id, related_case_study_id FK)
  stats.notifications = await copyTable(
    vbClient, portalClient,
    'notifications', 'vb_notifications',
    idMapping, ['user_id'], 'id'
  );

  // 6. vb_video_lessons (created_by -> profile_id)
  stats.video_lessons = await copyTable(
    vbClient, portalClient,
    'video_lessons', 'vb_video_lessons',
    idMapping, ['created_by'], 'id'
  );

  // 7. vb_video_progress (user_id -> profile_id, video_lesson_id FK)
  stats.video_progress = await copyTable(
    vbClient, portalClient,
    'video_progress', 'vb_video_progress',
    idMapping, ['user_id'], 'id'
  );

  // 8. vb_case_study_ratings (user_id -> profile_id, case_study_id FK)
  stats.case_study_ratings = await copyTable(
    vbClient, portalClient,
    'case_study_ratings', 'vb_case_study_ratings',
    idMapping, ['user_id'], 'id'
  );

  // 9. vb_conversations (created_by -> profile_id)
  stats.conversations = await copyTable(
    vbClient, portalClient,
    'conversations', 'vb_conversations',
    idMapping, ['created_by'], 'id'
  );

  // 10. vb_conversation_participants (user_id -> profile_id, conversation_id FK)
  stats.conversation_participants = await copyTable(
    vbClient, portalClient,
    'conversation_participants', 'vb_conversation_participants',
    idMapping, ['user_id'], 'id'
  );

  // 11. vb_chat_messages (sender_id -> profile_id, conversation_id FK)
  stats.chat_messages = await copyTable(
    vbClient, portalClient,
    'messages', 'vb_chat_messages',
    idMapping, ['sender_id'], 'id'
  );

  console.log('\n📊 Copy complete:');
  console.log(JSON.stringify(stats, null, 2));

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`\n✅ Total rows copied: ${total}`);
}

main().catch(console.error);
