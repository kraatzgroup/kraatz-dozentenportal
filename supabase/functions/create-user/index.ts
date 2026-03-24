// Edge function for creating new users
console.log('🚀 create-user edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string;
  fullName: string;
  role?: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent' | 'teilnehmer';
  additionalRoles?: string[];
  eliteKleingruppe?: string;
  userId?: string; // Optional: Use existing profile ID instead of creating new one
}

// Generate a secure random password
const generateSecurePassword = (): string => {
  const length = 12;
  // Use only alphanumeric characters to avoid encoding issues
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  
  // Ensure at least one character from each category
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; // uppercase (no I, O)
  password += 'abcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 25)]; // lowercase (no l)
  password += '23456789'[Math.floor(Math.random() * 8)]; // digit (no 0, 1)
  
  // Fill the rest randomly
  for (let i = 3; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 create-user function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`📦 [${requestId}] Importing Supabase client...`);
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    
    console.log(`🔗 [${requestId}] Creating Supabase client...`);
    // Use SERVICE_ROLE_KEY (custom secret) or fall back to SUPABASE_SERVICE_ROLE_KEY (auto-injected)
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`📋 [${requestId}] Parsing request body...`);
    const { email, fullName, role = 'dozent', additionalRoles = [], eliteKleingruppe, userId: requestedUserId } = await req.json() as CreateUserRequest;
    console.log(`📋 [${requestId}] Request data:`, { email, fullName, role, additionalRoles, eliteKleingruppe, requestedUserId });

    // Validate input
    if (!email || !fullName) {
      console.error(`❌ [${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'Email and fullName are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let userId: string;
    let isNewUser = false;
    let shouldSendEmail = false;
    let oldProfileId: string | null = null;
    let oldProfileData: any = null;

    // If userId is provided, we're adding email to an existing profile
    // We need to create a new auth user and migrate the data
    if (requestedUserId) {
      console.log(`🔗 [${requestId}] Adding email to existing profile: ${requestedUserId}`);
      oldProfileId = requestedUserId;
      
      // Fetch the existing profile data to migrate
      const { data: existingProfile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', requestedUserId)
        .single();
      
      if (fetchError || !existingProfile) {
        console.error(`❌ [${requestId}] Could not fetch existing profile:`, fetchError);
        throw new Error('Existing profile not found');
      }
      
      oldProfileData = existingProfile;
      console.log(`📋 [${requestId}] Fetched existing profile data for migration`);
      
      // Create new auth user (will get new UUID)
      console.log(`👤 [${requestId}] Creating new auth user for existing profile...`);
      const tempPassword = generateSecurePassword();
      const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { 
          full_name: fullName,
          role: role
        }
      });

      if (createUserError) {
        console.error(`❌ [${requestId}] Error creating auth user:`, createUserError);
        throw createUserError;
      }
      
      if (!userData?.user) {
        console.error(`❌ [${requestId}] Auth user creation failed - no user returned`);
        throw new Error('Auth user creation failed');
      }
      
      userId = userData.user.id;
      isNewUser = true;
      shouldSendEmail = false; // Don't send email for profile migrations
      console.log(`✅ [${requestId}] New auth user created: ${userId}, will migrate from old profile: ${oldProfileId} (no email will be sent)`);
    } else {
      // Check if user already exists in profiles by email
      console.log(`🔍 [${requestId}] Checking if user already exists...`);
      const { data: existingProfiles, error: existingUserError } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', email);

      if (existingUserError) {
        console.error(`❌ [${requestId}] Error checking existing user:`, existingUserError);
        throw existingUserError;
      }

      if (existingProfiles && existingProfiles.length > 0) {
        // User already exists - just update the profile
        console.log(`ℹ️ [${requestId}] User already exists, updating profile...`);
        userId = existingProfiles[0].id;
        // Send welcome email for existing profile (re-invitation)
        shouldSendEmail = true;
      } else {
        // Create the user without sending default email
        console.log(`👤 [${requestId}] Creating user in Supabase Auth...`);
        const tempPassword = generateSecurePassword();
        const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { 
            full_name: fullName,
            role: role
          }
        });

        if (createUserError) {
          // Check if user exists in auth but not in profiles
          if (createUserError.code === 'email_exists' || createUserError.message?.includes('already registered')) {
            console.log(`ℹ️ [${requestId}] User exists in auth, fetching user...`);
            const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingAuthUser = authUsers?.users?.find((u: any) => u.email === email);
            if (existingAuthUser) {
              userId = existingAuthUser.id;
              isNewUser = true;
              shouldSendEmail = true;
              console.log(`ℹ️ [${requestId}] Found existing auth user, will create profile: ${userId}`);
            } else {
              throw createUserError;
            }
          } else {
            console.error(`❌ [${requestId}] Error creating user:`, createUserError);
            throw createUserError;
          }
        } else if (!userData?.user) {
          console.error(`❌ [${requestId}] User creation failed - no user returned`);
          throw new Error('User creation failed');
        } else {
          userId = userData.user.id;
          isNewUser = true;
          shouldSendEmail = true;
          console.log(`✅ [${requestId}] User created successfully:`, userId);
        }
      }
    }

    // Generate magic link and send email for new users or re-invitations
    if (shouldSendEmail) {
      // Send welcome email (function generates its own magic link internally)
      console.log(`📧 [${requestId}] Calling send-welcome-email for: ${email}`);
      const welcomeEmailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-email`;
      
      try {
        const welcomeEmailResponse = await fetch(welcomeEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`
          },
          body: JSON.stringify({ email, fullName, origin: req.headers.get('origin') || '' })
        });

        console.log(`📧 [${requestId}] Welcome email response status: ${welcomeEmailResponse.status}`);
        
        if (!welcomeEmailResponse.ok) {
          const errorText = await welcomeEmailResponse.text();
          console.error(`❌ [${requestId}] Error sending welcome email (${welcomeEmailResponse.status}):`, errorText);
          console.warn(`⚠️ [${requestId}] User created but welcome email failed to send`);
        } else {
          const emailResult = await welcomeEmailResponse.json();
          console.log(`✅ [${requestId}] Welcome email sent successfully:`, JSON.stringify(emailResult));
        }
      } catch (fetchError) {
        console.error(`❌ [${requestId}] Exception while calling send-welcome-email:`, fetchError);
        console.warn(`⚠️ [${requestId}] User created but email sending threw exception`);
      }
    } else {
      console.log(`ℹ️ [${requestId}] Skipping email send (shouldSendEmail=false)`);
    }

    // Create/update profile for the user
    console.log(`� [${requestId}] Creating/updating profile for user...`);
    
    // If we're migrating from an old profile, use the old profile data
    const profileData = oldProfileData ? {
      id: userId,
      email: email,
      full_name: oldProfileData.full_name || fullName,
      role: oldProfileData.role || role,
      additional_roles: oldProfileData.additional_roles || (additionalRoles.length > 0 ? additionalRoles : null),
      hourly_rate_unterricht: oldProfileData.hourly_rate_unterricht,
      hourly_rate_elite: oldProfileData.hourly_rate_elite,
      hourly_rate_elite_korrektur: oldProfileData.hourly_rate_elite_korrektur,
      hourly_rate_sonstige: oldProfileData.hourly_rate_sonstige,
      profile_picture_url: oldProfileData.profile_picture_url,
      phone: oldProfileData.phone,
      address: oldProfileData.address,
      bank_name: oldProfileData.bank_name,
      iban: oldProfileData.iban,
      tax_id: oldProfileData.tax_id,
      created_at: oldProfileData.created_at,
      migrated_from_profile_id: oldProfileId
    } : {
      id: userId,
      email: email,
      full_name: fullName,
      role: role,
      additional_roles: additionalRoles.length > 0 ? additionalRoles : null
    };
    
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([profileData], {
        onConflict: 'id'
      });

    if (profileError) {
      console.error(`❌ [${requestId}] Error creating profile:`, profileError);
      throw profileError;
    }

    console.log(`✅ [${requestId}] Profile created successfully`);
    
    // If we migrated from an old profile, update all foreign key references
    if (oldProfileId && userId !== oldProfileId) {
      console.log(`🔄 [${requestId}] Migrating data from old profile ${oldProfileId} to new profile ${userId}`);
      
      // Update teilnehmer (profile_id)
      await supabaseAdmin
        .from('teilnehmer')
        .update({ profile_id: userId })
        .eq('profile_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated teilnehmer (profile_id)`);
      
      // Update teilnehmer subject-specific dozent columns
      await supabaseAdmin
        .from('teilnehmer')
        .update({ dozent_zivilrecht_id: userId })
        .eq('dozent_zivilrecht_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated teilnehmer (dozent_zivilrecht_id)`);
      
      await supabaseAdmin
        .from('teilnehmer')
        .update({ dozent_strafrecht_id: userId })
        .eq('dozent_strafrecht_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated teilnehmer (dozent_strafrecht_id)`);
      
      await supabaseAdmin
        .from('teilnehmer')
        .update({ dozent_oeffentliches_recht_id: userId })
        .eq('dozent_oeffentliches_recht_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated teilnehmer (dozent_oeffentliches_recht_id)`);
      
      // Update elite_kleingruppe_dozenten
      await supabaseAdmin
        .from('elite_kleingruppe_dozenten')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated elite_kleingruppe_dozenten`);
      
      // Update elite_kleingruppe_dozent_assignments
      await supabaseAdmin
        .from('elite_kleingruppe_dozent_assignments')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated elite_kleingruppe_dozent_assignments`);
      
      // Update elite_kleingruppe_releases (dozent_id)
      await supabaseAdmin
        .from('elite_kleingruppe_releases')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated elite_kleingruppe_releases (dozent_id)`);
      
      // Update elite_kleingruppe_releases (canceled_by)
      await supabaseAdmin
        .from('elite_kleingruppe_releases')
        .update({ canceled_by: userId })
        .eq('canceled_by', oldProfileId);
      console.log(`✅ [${requestId}] Migrated elite_kleingruppe_releases (canceled_by)`);
      
      // Update elite_kleingruppe_releases (rescheduled_by)
      await supabaseAdmin
        .from('elite_kleingruppe_releases')
        .update({ rescheduled_by: userId })
        .eq('rescheduled_by', oldProfileId);
      console.log(`✅ [${requestId}] Migrated elite_kleingruppe_releases (rescheduled_by)`);
      
      // Update folders
      await supabaseAdmin
        .from('folders')
        .update({ owner_id: userId })
        .eq('owner_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated folders`);
      
      // Update files
      await supabaseAdmin
        .from('files')
        .update({ uploaded_by: userId })
        .eq('uploaded_by', oldProfileId);
      console.log(`✅ [${requestId}] Migrated files`);
      
      // Update messages (sender)
      await supabaseAdmin
        .from('messages')
        .update({ sender_id: userId })
        .eq('sender_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated messages (sender)`);
      
      // Update messages (receiver)
      await supabaseAdmin
        .from('messages')
        .update({ receiver_id: userId })
        .eq('receiver_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated messages (receiver)`);
      
      // Update dozent_hours
      await supabaseAdmin
        .from('dozent_hours')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated dozent_hours`);
      
      // Update participant_hours
      await supabaseAdmin
        .from('participant_hours')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated participant_hours`);
      
      // Update pending_dozent_hours
      await supabaseAdmin
        .from('pending_dozent_hours')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated pending_dozent_hours`);
      
      // Update invoices
      await supabaseAdmin
        .from('invoices')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated invoices`);
      
      // Update trial_lessons (dozent_id)
      await supabaseAdmin
        .from('trial_lessons')
        .update({ dozent_id: userId })
        .eq('dozent_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated trial_lessons (dozent_id)`);
      
      // Update trial_lessons (vertrieb_user_id)
      await supabaseAdmin
        .from('trial_lessons')
        .update({ vertrieb_user_id: userId })
        .eq('vertrieb_user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated trial_lessons (vertrieb_user_id)`);
      
      // Update sales_calls
      await supabaseAdmin
        .from('sales_calls')
        .update({ vertrieb_user_id: userId })
        .eq('vertrieb_user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated sales_calls`);
      
      // Update follow_ups
      await supabaseAdmin
        .from('follow_ups')
        .update({ vertrieb_user_id: userId })
        .eq('vertrieb_user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated follow_ups`);
      
      // Update sales
      await supabaseAdmin
        .from('sales')
        .update({ vertrieb_user_id: userId })
        .eq('vertrieb_user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated sales`);
      
      // Update upsells
      await supabaseAdmin
        .from('upsells')
        .update({ vertrieb_user_id: userId })
        .eq('vertrieb_user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated upsells`);
      
      // Update sales_kpis
      await supabaseAdmin
        .from('sales_kpis')
        .update({ vertrieb_user_id: userId })
        .eq('vertrieb_user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated sales_kpis`);
      
      // Update chat_groups (created_by)
      await supabaseAdmin
        .from('chat_groups')
        .update({ created_by: userId })
        .eq('created_by', oldProfileId);
      console.log(`✅ [${requestId}] Migrated chat_groups`);
      
      // Update chat_group_members (user_id)
      await supabaseAdmin
        .from('chat_group_members')
        .update({ user_id: userId })
        .eq('user_id', oldProfileId);
      console.log(`✅ [${requestId}] Migrated chat_group_members`);
      
      // Archive the old profile instead of deleting it
      const { error: archiveError } = await supabaseAdmin
        .from('profiles')
        .update({ is_archived: true })
        .eq('id', oldProfileId);
      
      if (archiveError) {
        console.error(`⚠️ [${requestId}] Could not archive old profile:`, archiveError);
      } else {
        console.log(`✅ [${requestId}] Archived old profile ${oldProfileId}`);
      }
    }

    // If user is a teilnehmer with an elite_kleingruppe, create entry in teilnehmer table
    if (role === 'teilnehmer' && eliteKleingruppe) {
      console.log(`🎓 [${requestId}] Creating teilnehmer entry for Elite-Kleingruppe: ${eliteKleingruppe}`);
      
      // Find the elite_kleingruppe by name
      const { data: kleingruppe, error: kgError } = await supabaseAdmin
        .from('elite_kleingruppen')
        .select('id')
        .eq('name', eliteKleingruppe)
        .single();

      if (kgError || !kleingruppe) {
        console.error(`❌ [${requestId}] Elite-Kleingruppe not found:`, eliteKleingruppe);
        console.warn(`⚠️ [${requestId}] User created but teilnehmer entry not created`);
      } else {
        // Create teilnehmer entry
        const { error: teilnehmerError } = await supabaseAdmin
          .from('teilnehmer')
          .insert([{
            profile_id: userId,
            name: fullName,
            email: email,
            is_elite_kleingruppe: true,
            elite_kleingruppe_id: kleingruppe.id,
            active_since: new Date().toISOString().split('T')[0],
            study_goal: '1. Staatsexamen Erstversuch'
          }]);

        if (teilnehmerError) {
          console.error(`❌ [${requestId}] Error creating teilnehmer entry:`, teilnehmerError);
          console.warn(`⚠️ [${requestId}] User created but teilnehmer entry failed`);
        } else {
          console.log(`✅ [${requestId}] Teilnehmer entry created successfully`);
        }
      }
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true, 
        message: isNewUser 
          ? `Benutzer wurde erfolgreich erstellt. Eine Einladungs-E-Mail mit Magic Link wurde an ${email} gesendet.`
          : 'Benutzerprofil wurde erfolgreich aktualisiert.',
        userId: userId,
        email: email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in create-user function after ${endTime - startTime}ms:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

console.log('✅ create-user edge function setup complete');