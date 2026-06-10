import { createClient } from '@supabase/supabase-js';

// Old database (videobesprechung)
const oldUrl = 'https://rpgbyockvpannrupicno.supabase.co';
const oldKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZ2J5b2NrdnBhbm5ydXBpY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzUxOSwiZXhwIjoyMDcxOTY5NTE5fQ.7qzGyeOOVwNbmZPxgK4aiQi9mh4gipFWV8kk-LngUbk';

// New database (dozentenportal)
const newUrl = 'https://gkkveloqajxghhflkfru.supabase.co';
const newKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdra3ZlbG9xYWp4Z2hoZmxrZnJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcxODkyOCwiZXhwIjoyMDgzMjk0OTI4fQ.weCT-TdwNtyGt5uQ1GuGiB1h3emNZL_UuYknRzhR6PQ';

const oldSupabase = createClient(oldUrl, oldKey);
const newSupabase = createClient(newUrl, newKey);

async function migrateData() {
  console.log('Starting migration...');

  // First, check which users own case studies in old database
  const { data: caseStudies, error: caseStudyError } = await oldSupabase
    .from('case_study_requests')
    .select('user_id, id');

  if (caseStudyError) {
    console.error('Error fetching case studies:', caseStudyError);
    return;
  }

  console.log(`Found ${caseStudies.length} case study requests in old database`);

  // Get unique user IDs
  const uniqueUserIds = [...new Set(caseStudies.map(cs => cs.user_id))];
  console.log(`Case studies belong to ${uniqueUserIds.length} unique users:`, uniqueUserIds);

  // Get user ID mapping
  const { data: idMappings, error: mappingError } = await newSupabase
    .from('vb_id_mapping')
    .select('*');

  if (mappingError) {
    console.error('Error fetching ID mappings:', mappingError);
    return;
  }

  console.log(`Found ${idMappings.length} user ID mappings`);

  // Create a map for quick lookup
  const userIdMap = new Map();
  idMappings.forEach(mapping => {
    userIdMap.set(mapping.old_auth_id, mapping.new_id);
  });

  console.log('Mapped user IDs:', Array.from(userIdMap.keys()));

  // Check which users are not mapped
  const unmappedUsers = uniqueUserIds.filter(userId => !userIdMap.has(userId));
  console.log('Unmapped users:', unmappedUsers);

  if (unmappedUsers.length > 0) {
    console.log('WARNING: Some users are not mapped. Their data will be skipped.');
    console.log('Fetching user emails from old database for unmapped users...');
    
    // Fetch user details from old database
    const { data: oldUsers, error: oldUsersError } = await oldSupabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', unmappedUsers);
    
    if (oldUsersError) {
      console.error('Error fetching old users:', oldUsersError);
    } else {
      console.log('Unmapped users from old database:');
      oldUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.first_name} ${user.last_name}) - ID: ${user.id}`);
      });
    }
  }

  // Create user ID mappings for all users in old database
  console.log('Creating user ID mappings for all users...');
  const { data: allOldUsers, error: allOldUsersError } = await oldSupabase
    .from('users')
    .select('id, email');

  if (allOldUsersError) {
    console.error('Error fetching all old users:', allOldUsersError);
  } else {
    console.log(`Found ${allOldUsers.length} users in old database`);
    
    let newMappingsCreated = 0;
    for (const oldUser of allOldUsers) {
      // Check if mapping already exists
      if (userIdMap.has(oldUser.id)) {
        continue;
      }

      // Find corresponding user in new database by email
      const { data: newProfiles, error: newProfilesError } = await newSupabase
        .from('profiles')
        .select('id')
        .eq('email', oldUser.email)
        .single();

      if (newProfilesError || !newProfiles) {
        console.log(`No matching profile found for email: ${oldUser.email}`);
        continue;
      }

      // Create mapping
      const { error: insertError } = await newSupabase
        .from('vb_id_mapping')
        .insert({
          old_id: oldUser.id,
          old_auth_id: oldUser.id,
          new_id: newProfiles.id,
          email: oldUser.email,
          migrated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`Error creating mapping for ${oldUser.email}:`, insertError);
      } else {
        userIdMap.set(oldUser.id, newProfiles.id);
        newMappingsCreated++;
        console.log(`Created mapping: ${oldUser.email} -> ${newProfiles.id}`);
      }
    }
    
    console.log(`Created ${newMappingsCreated} new user ID mappings`);
  }

  // Migrate case studies
  let migratedCount = 0;
  let skippedCount = 0;

  for (const caseStudy of caseStudies) {
    const newUserId = userIdMap.get(caseStudy.user_id);
    
    if (!newUserId) {
      console.log(`Skipping case study ${caseStudy.id} - user ID not mapped`);
      skippedCount++;
      continue;
    }

    // Insert into new database with schema mapping
    const { error: insertError } = await newSupabase
      .from('vb_case_study_requests')
      .insert({
        id: caseStudy.id,
        profile_id: newUserId,  // Map user_id to profile_id
        case_study_number: caseStudy.case_study_number,
        study_phase: caseStudy.study_phase || 'klausur',  // Default to 'klausur' if null
        legal_area: caseStudy.legal_area || 'Allgemein',  // Default if null
        sub_area: caseStudy.sub_area || 'Allgemein',  // Default if null
        focus_area: caseStudy.focus_area || 'Allgemein',  // Default if null
        status: caseStudy.status,
        pdf_url: caseStudy.pdf_url,
        case_study_material_url: caseStudy.case_study_material_url,
        additional_materials_url: caseStudy.additional_materials_url,
        submission_url: caseStudy.submission_url,
        submission_downloaded_at: caseStudy.submission_downloaded_at,
        video_correction_url: caseStudy.video_correction_url,
        written_correction_url: caseStudy.written_correction_url,
        video_viewed_at: caseStudy.video_viewed_at,
        pdf_downloaded_at: caseStudy.pdf_downloaded_at,
        created_at: caseStudy.created_at,
        updated_at: caseStudy.updated_at
        // Note: assigned_dozent_id is not in the new schema
      });

    if (insertError) {
      console.error(`Error inserting case study ${caseStudy.id}:`, insertError);
    } else {
      migratedCount++;
      console.log(`Migrated case study ${caseStudy.id}`);
    }
  }

  console.log(`Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);

  // Migrate submissions
  const { data: submissions, error: submissionsError } = await oldSupabase
    .from('submissions')
    .select('*');

  if (submissionsError) {
    console.error('Error fetching submissions:', submissionsError);
  } else {
    console.log(`Found ${submissions.length} submissions in old database`);
    
    let migratedSubmissions = 0;
    for (const submission of submissions) {
      const newUserId = userIdMap.get(submission.user_id);
      
      if (!newUserId) {
        console.log(`Skipping submission ${submission.id} - user ID not mapped`);
        continue;
      }

      const { error: insertError } = await newSupabase
        .from('vb_submissions')
        .insert({
          id: submission.id,
          case_study_request_id: submission.case_study_request_id,
          file_url: submission.file_url,
          file_type: submission.file_type,
          status: submission.status,
          correction_video_url: submission.correction_video_url,
          landing_page_url: submission.landing_page_url,
          grade: submission.grade,
          grade_text: submission.grade_text,
          submitted_at: submission.submitted_at,
          corrected_at: submission.corrected_at
          // Note: user_id is not in the new schema (it's derived from case_study_request_id)
        });

      if (insertError) {
        console.error(`Error inserting submission ${submission.id}:`, insertError);
      } else {
        migratedSubmissions++;
        console.log(`Migrated submission ${submission.id}`);
      }
    }
    
    console.log(`Migrated ${migratedSubmissions} submissions`);
  }

  // Migrate ratings
  const { data: ratings, error: ratingsError } = await oldSupabase
    .from('case_study_ratings')
    .select('*');

  if (ratingsError) {
    console.error('Error fetching ratings:', ratingsError);
  } else {
    console.log(`Found ${ratings.length} ratings in old database`);
    
    let migratedRatings = 0;
    for (const rating of ratings) {
      const newUserId = userIdMap.get(rating.user_id);
      
      if (!newUserId) {
        console.log(`Skipping rating ${rating.id} - user ID not mapped`);
        continue;
      }

      const { error: insertError } = await newSupabase
        .from('vb_case_study_ratings')
        .insert({
          id: rating.id,
          case_study_id: rating.case_study_id,
          profile_id: newUserId,  // Map user_id to profile_id
          rating: rating.rating,
          feedback: rating.feedback,
          created_at: rating.created_at,
          updated_at: rating.updated_at
        });

      if (insertError) {
        console.error(`Error inserting rating ${rating.id}:`, insertError);
      } else {
        migratedRatings++;
        console.log(`Migrated rating ${rating.id}`);
      }
    }
    
    console.log(`Migrated ${migratedRatings} ratings`);
  }

  // Migrate packages
  console.log('Migrating packages...');
  const { data: oldPackages, error: oldPackagesError } = await oldSupabase
    .from('packages')
    .select('*');

  if (oldPackagesError) {
    console.error('Error fetching old packages:', oldPackagesError);
  } else {
    console.log(`Found ${oldPackages.length} packages in old database`);
    
    let migratedPackages = 0;
    for (const oldPackage of oldPackages) {
      const { error: insertError } = await newSupabase
        .from('vb_packages')
        .insert({
          id: oldPackage.id,
          name: oldPackage.name,
          description: oldPackage.description,
          case_study_count: oldPackage.case_study_count,
          price_cents: oldPackage.price_cents,
          stripe_price_id: oldPackage.stripe_price_id,
          active: oldPackage.active,
          created_at: oldPackage.created_at
        });

      if (insertError) {
        console.error(`Error inserting package ${oldPackage.id}:`, insertError);
      } else {
        migratedPackages++;
        console.log(`Migrated package ${oldPackage.id}: ${oldPackage.name}`);
      }
    }
    
    console.log(`Migrated ${migratedPackages} packages`);
  }

  // Migrate orders
  console.log('Migrating orders...');
  const { data: oldOrders, error: oldOrdersError } = await oldSupabase
    .from('orders')
    .select('*');

  if (oldOrdersError) {
    console.error('Error fetching old orders:', oldOrdersError);
  } else {
    console.log(`Found ${oldOrders.length} orders in old database`);
    
    let migratedOrders = 0;
    for (const oldOrder of oldOrders) {
      const newUserId = userIdMap.get(oldOrder.user_id);
      
      if (!newUserId) {
        console.log(`Skipping order ${oldOrder.id} - user ID not mapped`);
        continue;
      }

      const { error: insertError } = await newSupabase
        .from('vb_orders')
        .insert({
          id: oldOrder.id,
          profile_id: newUserId,
          package_id: oldOrder.package_id,
          stripe_payment_intent_id: oldOrder.stripe_payment_intent_id,
          status: oldOrder.status,
          total_cents: oldOrder.total_cents,
          created_at: oldOrder.created_at
        });

      if (insertError) {
        console.error(`Error inserting order ${oldOrder.id}:`, insertError);
      } else {
        migratedOrders++;
        console.log(`Migrated order ${oldOrder.id} for user ${newUserId}`);
      }
    }
    
    console.log(`Migrated ${migratedOrders} orders`);
  }

  console.log('Migration complete!');
}

migrateData().catch(console.error);
