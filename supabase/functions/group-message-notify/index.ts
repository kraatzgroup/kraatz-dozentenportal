console.log('🚀 group-message-notify edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface GroupMessageNotifyRequest {
  groupId: string;
  groupName: string;
  senderName: string;
  senderId: string;
  messageContent: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 group-message-notify function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);
  console.log('🌐 Request URL:', req.url);

  // Log all headers for debugging
  console.log('📋 Request headers:');
  req.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if this is a POST request
  if (req.method !== 'POST') {
    console.error(`❌ [${requestId}] Invalid method: ${req.method}, expected POST`);
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    console.log(`📋 [${requestId}] Parsing request body...`);
    const { groupId, groupName, senderName, senderId, messageContent } = await req.json() as GroupMessageNotifyRequest;
    console.log(`📋 [${requestId}] Request data:`, { groupId, groupName, senderName, senderId });

    // Determine redirect URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const redirectUrl = origin.includes('localhost') ? `${origin}/messages` : 'https://portal.kraatz-group.de/messages';
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    // Validate input
    if (!groupId || !groupName || !senderName || !messageContent || !senderId) {
      console.error(`❌ [${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`👥 [${requestId}] Fetching group members for group: ${groupId}`);
    
    // Get all group members except the sender
    const { data: members, error: membersError } = await supabaseAdmin
      .from('chat_group_members')
      .select('user_id, profiles:user_id(email, full_name)')
      .eq('group_id', groupId)
      .neq('user_id', senderId);

    if (membersError) {
      console.error(`❌ [${requestId}] Error fetching group members:`, membersError);
      throw membersError;
    }

    if (!members || members.length === 0) {
      console.log(`ℹ️ [${requestId}] No other members in group to notify`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No members to notify',
          notifiedCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`👥 [${requestId}] Found ${members.length} members to notify`);

    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!mailgunApiKey) {
      console.error(`❌ [${requestId}] MAILGUN_API_KEY not configured`);
      throw new Error('Mailgun API key not configured');
    }

    // Truncate message content if too long
    const maxLength = 200;
    const truncatedMessage = messageContent.length > maxLength 
      ? messageContent.substring(0, maxLength) + '...' 
      : messageContent;

    const emailResults = [];
    let successCount = 0;
    let failCount = 0;

    // Send email to each member
    for (const member of members) {
      const recipientEmail = member.profiles?.email;
      const recipientName = member.profiles?.full_name;

      if (!recipientEmail || !recipientName) {
        console.warn(`⚠️ [${requestId}] Skipping member ${member.user_id} - missing email or name`);
        failCount++;
        continue;
      }

      try {
        console.log(`🔗 [${requestId}] Generating magic link for: ${recipientEmail}`);
        
        // Generate magic link for direct login
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: recipientEmail,
          options: {
            redirectTo: redirectUrl
          }
        });

        if (linkError) {
          console.error(`❌ [${requestId}] Error generating magic link for ${recipientEmail}:`, linkError);
          failCount++;
          continue;
        }

        const magicLink = linkData?.properties?.action_link;
        if (!magicLink) {
          console.error(`❌ [${requestId}] No magic link returned for ${recipientEmail}`);
          failCount++;
          continue;
        }

        console.log(`✅ [${requestId}] Magic link generated for ${recipientEmail}`);

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
              <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 30px 20px; background-color: white;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Neue Gruppennachricht</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hallo ${recipientName},
              </p>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                <strong>${senderName}</strong> hat eine neue Nachricht in der Gruppe <strong>${groupName}</strong> gesendet.
              </p>

              <!-- Message Content -->
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
                <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Nachricht:</h4>
                <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${truncatedMessage}</p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                <strong>Klicken Sie auf den Button unten, um sich direkt anzumelden und zu antworten:</strong>
              </p>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${magicLink}" 
                   style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                  Zur Gruppe
                </a>
              </div>
              
              <!-- Alternative Link -->
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6c757d;">
                <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">
                  <strong>Alternative:</strong> Falls der Button nicht funktioniert, können Sie diesen Link kopieren:
                </p>
                <div style="background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #ced4da; word-break: break-all; font-family: monospace; font-size: 12px; color: #495057;">
                  ${magicLink}
                </div>
              </div>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>Hinweis:</strong><br>
                  Dieser Link ist nur für Sie bestimmt und läuft nach <strong>1 Stunde</strong> ab. 
                  Sie werden automatisch zum Chat weitergeleitet.
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
                Mit freundlichen Grüßen<br>
                <strong>Ihr Kraatz Group Team</strong>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">Bei Fragen wenden Sie sich bitte an <a href="mailto:info@kraatz-group.de" style="color: #2e83c2; text-decoration: none;">info@kraatz-group.de</a></p>
            </div>
          </div>`;

        const mailgunUrl = `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`;
        const formData = new FormData();
        formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
        formData.append('to', recipientEmail);
        formData.append('subject', `Neue Nachricht in ${groupName} - Kraatz Group Portal`);
        formData.append('html', emailHtml);

        const mailgunResponse = await fetch(mailgunUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          },
          body: formData,
        });

        if (!mailgunResponse.ok) {
          const errorText = await mailgunResponse.text();
          console.error(`❌ [${requestId}] Mailgun error for ${recipientEmail}:`, errorText);
          failCount++;
          continue;
        }

        const emailResult = await mailgunResponse.json();
        console.log(`✅ [${requestId}] Email sent to ${recipientEmail}:`, emailResult);
        emailResults.push({ email: recipientEmail, result: emailResult });
        successCount++;

      } catch (memberError) {
        console.error(`❌ [${requestId}] Error sending email to ${recipientEmail}:`, memberError);
        failCount++;
      }
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);
    console.log(`📊 [${requestId}] Results: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification emails sent to ${successCount} group members`,
        notifiedCount: successCount,
        failedCount: failCount,
        totalMembers: members.length,
        emailResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in group-message-notify function after ${endTime - startTime}ms:`, error);

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

console.log('✅ group-message-notify edge function setup complete');
