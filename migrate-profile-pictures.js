/**
 * Migration script to copy profile pictures from profile-pictures bucket to avatars bucket
 * Run this with: node migrate-profile-pictures.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateProfilePictures() {
  console.log('🚀 Starting profile picture migration...\n');

  try {
    // 1. Get all profiles with profile_picture_url
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, profile_picture_url')
      .not('profile_picture_url', 'is', null)
      .neq('profile_picture_url', '');

    if (profilesError) {
      throw profilesError;
    }

    console.log(`📋 Found ${profiles.length} profiles with profile pictures\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const profile of profiles) {
      const { id, full_name, profile_picture_url } = profile;
      
      console.log(`\n👤 Processing: ${full_name} (${id})`);
      console.log(`   Current URL: ${profile_picture_url}`);

      // Skip if already using avatars bucket
      if (profile_picture_url.includes('/avatars/')) {
        console.log('   ⏭️  Already using avatars bucket, skipping');
        skippedCount++;
        continue;
      }

      // Skip if not using profile-pictures bucket
      if (!profile_picture_url.includes('/profile-pictures/')) {
        console.log('   ⏭️  Not using profile-pictures bucket, skipping');
        skippedCount++;
        continue;
      }

      try {
        // Extract the file path from the URL
        const urlParts = profile_picture_url.split('/profile-pictures/');
        if (urlParts.length < 2) {
          console.log('   ❌ Invalid URL format');
          errorCount++;
          continue;
        }

        const oldFilePath = urlParts[1];
        console.log(`   Old path: ${oldFilePath}`);

        // Download the file from profile-pictures bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('profile-pictures')
          .download(oldFilePath);

        if (downloadError) {
          console.log(`   ❌ Error downloading: ${downloadError.message}`);
          errorCount++;
          continue;
        }

        // Determine new file path (change profile.* to avatar.*)
        const newFilePath = oldFilePath.replace(/\/profile\./, '/avatar.');
        console.log(`   New path: ${newFilePath}`);

        // Convert blob to array buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Upload to avatars bucket
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(newFilePath, uint8Array, {
            contentType: fileData.type,
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.log(`   ❌ Error uploading: ${uploadError.message}`);
          errorCount++;
          continue;
        }

        // Get new public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(newFilePath);

        const newUrl = urlData.publicUrl;
        console.log(`   New URL: ${newUrl}`);

        // Update profile with new URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ profile_picture_url: newUrl })
          .eq('id', id);

        if (updateError) {
          console.log(`   ❌ Error updating profile: ${updateError.message}`);
          errorCount++;
          continue;
        }

        console.log('   ✅ Successfully migrated');
        successCount++;

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📋 Total: ${profiles.length}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with some errors. Please review the log above.');
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateProfilePictures();
