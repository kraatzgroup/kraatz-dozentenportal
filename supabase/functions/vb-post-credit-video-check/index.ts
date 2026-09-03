/// <reference path="../deno.d.ts" />
// Edge function: vb-post-credit-video-check
//
// Runs hourly via pg_cron. Checks all VB teilnehmer for the following
// conditions:
//   1. Has a test credit (vb_order with total_cents = 0, status = completed)
//   2. Has at least one case study with status 'corrected' or 'completed'
//      AND correction_viewed_at IS NOT NULL (user opened the correction)
//   3. No paid credits (total_cents > 0) purchased within 24 hours after
//      the test credit was granted
//   4. No row in vb_post_credit_video_views with shown_at IS NOT NULL
//      (video not yet shown) AND no row with email_sent_at IS NOT NULL
//      (email not already sent)
//
// Deduplication: the vb_post_credit_video_views table with email_sent_at
// ensures each user gets the email at most once. All sends are logged to
// notification_logs for the admin email dashboard.
//
// For each eligible user:
//   - Generates a Supabase magic link (logs in + redirects to dashboard)
//   - Sends a personalized email from "Mario Kraatz" <postmaster@kraatz-group.de>
//   - Inserts a row in vb_post_credit_video_views with email_sent_at = NOW()
//   - Logs the send to notification_logs
console.log('🚀 vb-post-credit-video-check edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';
//   4. No row in vb_post_credit_video_views with shown_at IS NOT NULL
//      (video not yet shown) AND no row with email_sent_at IS NOT NULL
//      (email not already sent)
//
// For each eligible user:
//   - Generates a Supabase magic link (logs in + redirects to dashboard)
//   - Sends a personalized email from "Mario Kraatz" <postmaster@kraatz-group.de>
//   - Inserts a row in vb_post_credit_video_views with email_sent_at = NOW()
console.log('🚀 vb-post-credit-video-check edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://portal.kraatz-group.de';
const VIDEO_URL = 'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/nach%20dem%20ersten%20Creditmp4.mp4';
const THUMBNAIL_URL = 'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/post_credit_thumbnail.jpg';
const HEADER_LOGO_URL = 'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/vXY0jbZ4i0KI.png';
const FOOTER_LOGO_URL = 'https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc';

// TEST MODE: Only send to these email addresses. Empty array = send to all eligible users.
const TEST_EMAIL_WHITELIST: string[] = [];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface EligibleUser {
  profile_id: string;
  email: string;
  first_name: string | null;
  full_name: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`🆔 [${requestId}] vb-post-credit-video-check started`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }
    if (!mailgunApiKey) {
      throw new Error('MAILGUN_API_KEY not configured');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── 1. Find all eligible users ───────────────────────────────────
    // Step 1: Get all VB users with test credits
    const testCreditsResponse = await fetch(
      `${supabaseUrl}/rest/v1/vb_orders?status=eq.completed&total_cents=eq.0&select=profile_id,created_at`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    );
    const testCredits = await testCreditsResponse.json();

    if (!Array.isArray(testCredits) || testCredits.length === 0) {
      console.log(`ℹ️ [${requestId}] No users with test credits found`);
      return new Response(
        JSON.stringify({ success: true, message: 'No eligible users', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group test credits by profile_id (earliest created_at)
    const testCreditMap = new Map<string, string>();
    for (const tc of testCredits) {
      const existing = testCreditMap.get(tc.profile_id);
      if (!existing || new Date(tc.created_at) < new Date(existing)) {
        testCreditMap.set(tc.profile_id, tc.created_at);
      }
    }

    const eligibleUsers: EligibleUser[] = [];

    for (const [profileId, testCreditCreatedAt] of testCreditMap) {
      // Check if already emailed or shown
      const viewResponse = await fetch(
        `${supabaseUrl}/rest/v1/vb_post_credit_video_views?profile_id=eq.${profileId}&select=profile_id,email_sent_at,shown_at`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const viewData = await viewResponse.json();
      if (Array.isArray(viewData) && viewData.length > 0) {
        if (viewData[0].email_sent_at || viewData[0].shown_at) {
          continue; // Already emailed or shown
        }
      }

      // Check for paid credits within 24h after test credit
      const twentyFourHoursLater = new Date(testCreditCreatedAt);
      twentyFourHoursLater.setHours(twentyFourHoursLater.getHours() + 24);

      const paidOrdersResponse = await fetch(
        `${supabaseUrl}/rest/v1/vb_orders?profile_id=eq.${profileId}&status=eq.completed&total_cents=gt.0&created_at=gte.${testCreditCreatedAt}&created_at=lte.${twentyFourHoursLater.toISOString()}&select=id`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const paidOrders = await paidOrdersResponse.json();
      if (Array.isArray(paidOrders) && paidOrders.length > 0) {
        continue; // User bought credits within 24h
      }

      // Check for opened correction
      const correctionResponse = await fetch(
        `${supabaseUrl}/rest/v1/vb_case_study_requests?profile_id=eq.${profileId}&status=in.(corrected,completed)&correction_viewed_at=not.is.null&select=id&limit=1`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const corrections = await correctionResponse.json();
      if (!Array.isArray(corrections) || corrections.length === 0) {
        continue; // No opened correction
      }

      // Get profile data
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${profileId}&select=id,email,first_name,full_name,additional_roles`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const profiles = await profileResponse.json();
      if (!Array.isArray(profiles) || profiles.length === 0) {
        continue;
      }
      const profile = profiles[0];

      // Check videobesprechung role
      const additionalRoles = profile.additional_roles || [];
      if (!additionalRoles.includes('videobesprechung')) {
        continue;
      }

      eligibleUsers.push({
        profile_id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        full_name: profile.full_name,
      });
    }

    // TEST MODE: Filter to whitelist only (empty array = send to all)
    const filteredUsers = TEST_EMAIL_WHITELIST.length > 0
      ? eligibleUsers.filter(u => TEST_EMAIL_WHITELIST.includes(u.email.toLowerCase()))
      : eligibleUsers;

    console.log(`📋 [${requestId}] Found ${eligibleUsers.length} eligible user(s), ${filteredUsers.length} after test whitelist filter`);

    if (filteredUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No eligible users after whitelist', sent: 0, eligible: eligibleUsers.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;

    for (const user of filteredUsers) {
      try {
        // ─── Dedup: skip if already logged as sent in notification_logs ──
        const { data: existingLog } = await supabaseAdmin
          .from('notification_logs')
          .select('id')
          .eq('edge_function', 'vb-post-credit-video-check')
          .eq('recipient_email', user.email)
          .eq('status', 'sent')
          .limit(1);

        if (existingLog && existingLog.length > 0) {
          console.log(`ℹ️ [${requestId}] ${user.email} already sent (notification_logs) — skipping`);
          continue;
        }

        // ─── Generate magic link ──────────────────────────────────────
        const magicLinkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: 'magiclink',
            email: user.email,
            redirect_to: `${BASE_URL}/klausurenbesprechung/dashboard`,
          }),
        });

        if (!magicLinkResponse.ok) {
          const errText = await magicLinkResponse.text();
          console.error(`❌ [${requestId}] Magic link failed for ${user.email}:`, errText);
          continue;
        }

        const linkData = await magicLinkResponse.json();
        const magicLink = linkData?.properties?.action_link || linkData?.action_link;
        if (!magicLink) {
          console.error(`❌ [${requestId}] No magic link returned for ${user.email}`);
          continue;
        }

        // ─── Build & send email ──────────────────────────────────────
        const firstName = user.first_name || user.full_name?.split(' ')[0] || 'Teilnehmer';
        const emailHtml = buildEmailHtml(firstName, magicLink);

        const formData = new FormData();
        formData.append('from', 'Mario Kraatz <postmaster@kraatz-group.de>');
        formData.append('to', user.email);
        formData.append('subject', 'Eine persönliche Nachricht von Mario Kraatz für dich');
        formData.append('h:Reply-To', 'postmaster@kraatz-group.de');
        formData.append('o:tracking', 'false');
        formData.append('html', emailHtml);

        const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          },
          body: formData,
        });

        if (!mailgunResponse.ok) {
          const errorText = await mailgunResponse.text();
          console.error(`❌ [${requestId}] Mailgun error for ${user.email}:`, errorText);
          await logNotification({
            edgeFunction: 'vb-post-credit-video-check',
            supabaseAdmin,
            recipientEmail: user.email,
            recipientName: user.first_name || user.full_name || undefined,
            subject: 'Eine persönliche Nachricht von Mario Kraatz für dich',
            sender: 'Mario Kraatz <postmaster@kraatz-group.de>',
            status: 'failed',
            errorMessage: errorText,
            context: { profileId: user.profile_id, type: 'post-credit-upsell' },
            payload: { email: user.email },
          });
          continue;
        }

        const emailResult = await mailgunResponse.json();

        // ─── Log to notification_logs ────────────────────────────────
        await logNotification({
          edgeFunction: 'vb-post-credit-video-check',
          supabaseAdmin,
          recipientEmail: user.email,
          recipientName: user.first_name || user.full_name || undefined,
          subject: 'Eine persönliche Nachricht von Mario Kraatz für dich',
          sender: 'Mario Kraatz <postmaster@kraatz-group.de>',
          status: 'sent',
          providerMessageId: emailResult?.id,
          context: { profileId: user.profile_id, type: 'post-credit-upsell' },
          payload: { email: user.email },
        });

        // ─── Record email_sent_at in tracking table ──────────────────
        await fetch(`${supabaseUrl}/rest/v1/vb_post_credit_video_views`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'upsert=on-conflict,resolution=merge-duplicates',
          },
          body: JSON.stringify({
            profile_id: user.profile_id,
            email_sent_at: new Date().toISOString(),
            shown_at: null,
            watch_duration_seconds: 0,
          }),
        });

        sentCount++;
        console.log(`✅ [${requestId}] Email sent to ${user.email}`);
      } catch (userErr) {
        console.error(`❌ [${requestId}] Error processing user ${user.email}:`, userErr);
      }
    }

    console.log(`✅ [${requestId}] Done. ${sentCount}/${filteredUsers.length} emails sent`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, eligible: eligibleUsers.length, filtered: filteredUsers.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error(`❌ [${requestId}] Fehler:`, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildEmailHtml(firstName: string, magicLink: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eine persönliche Nachricht von Mario Kraatz für dich</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0d223f; }
    .preview { display: none; max-height: 0; overflow: hidden; opacity: 0; }
    img { max-width: 100%; height: auto; }
    @media (max-width: 600px) {
      .container { width: 100% !important; }
    }
  </style>
</head>
<body bgcolor="#0d223f" text="#363636" link="#2d84c1" style="background-color: #0d223f;">

  <!-- Preview text (hidden, visible in inbox preview) -->
  <div class="preview" style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(firstName)}, Du hast unser Willkommens-Angebot bereits genutzt &amp; deine erste Korrektur erhalten.
  </div>

  <table cellpadding="0" border="0" cellspacing="0" width="100%" style="background-color: #0d223f;">
   <tbody>
    <tr>
     <td>
      <table cellspacing="0" cellpadding="0" border="0" width="560" align="center" style="table-layout: fixed; width: 560px;">
       <tbody>
        <tr>
         <td style="padding-left: 20px; padding-right: 20px; padding-top: 29px;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0">
           <tbody>
            <tr>
             <th width="100%" valign="top" style="font-weight: normal;">
              <!-- Header: only the logo image, no text -->
              <table cellspacing="0" cellpadding="0" border="0" width="301" align="center" style="table-layout: fixed; width: 301px;">
               <tbody>
                <tr>
                 <td style="font-size: 0; line-height: 0; padding-bottom: 15px; padding-top: 15px;">
                  <img src="${HEADER_LOGO_URL}" width="301" border="0" style="display: block; width: 100%;">
                 </td>
                </tr>
               </tbody>
              </table>
              <!-- White separator line -->
              <table cellspacing="0" cellpadding="0" border="0" width="520" align="center" style="table-layout: fixed; width: 520px;">
               <tbody>
                <tr>
                 <td style="padding-bottom: 10px; padding-top: 10px; height: 2px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0">
                   <tbody>
                    <tr>
                     <td>
                      <table width="100%" cellspacing="0" cellpadding="0" border="0" height="2" style="border-top-style: solid; border-top-color: #fffefe; border-top-width: 2px; font-size: 2px; line-height: 2px;">
                       <tbody><tr><td height="0" style="font-size: 0; line-height: 0;">&nbsp;</td></tr></tbody>
                      </table>
                     </td>
                    </tr>
                   </tbody>
                  </table>
                 </td>
                </tr>
               </tbody>
              </table>
             </th>
            </tr>
           </tbody>
          </table>
         </td>
        </tr>
       </tbody>
      </table>
     </td>
    </tr>
   </tbody>
  </table>

  <!-- Main Content -->
  <table cellpadding="0" border="0" cellspacing="0" width="100%" style="background-color: #0d223f;">
   <tbody>
    <tr>
     <td valign="top" style="background-color: #0d223f;">
      <table cellspacing="0" cellpadding="0" border="0" width="560" align="center" style="table-layout: fixed; width: 560px;">
       <tbody>
        <tr>
         <td style="padding-bottom: 50px; padding-left: 20px; padding-right: 20px; padding-top: 40px;">

          <!-- Headline -->
          <h2 style="color: #ffffff; margin: 0 0 12px 0; font-size: 32px; line-height: 1.3; font-weight: 700; text-align: center; font-family: Verdana, Geneva, sans-serif;">
            Du hast den ersten Schritt gemacht – jetzt geht's richtig los.
          </h2>

          <!-- Subheadline -->
          <p style="color: #ffffff; font-size: 20px; line-height: 1.5; margin: 0 0 25px 0; font-weight: 400; text-align: center; font-family: Verdana, Geneva, sans-serif;">
            Übung macht den Meister. Und genau dafür bist Du hier.
          </p>

          <!-- Short text -->
          <p style="color: #ffffff; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0; font-family: Verdana, Geneva, sans-serif;">
            Hallo ${escapeHtml(firstName)},<br><br>
            Du hast unser Willkommens-Angebot genutzt, Deine erste Korrektur erhalten und hoffentlich
            schon angeschaut. Das ist genau der richtige Start. Aber der Weg zur Bestnote führt nicht
            über den Fahrstuhl – er führt über die Treppe. Eine Klausur nach der anderen.
          </p>

          <!-- Video Thumbnail with Play Button (magic link) -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="display: inline-block; position: relative; text-decoration: none; max-width: 100%;">
              <div style="position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                <img src="${THUMBNAIL_URL}"
                     alt="Video von Mario Kraatz"
                     style="display: block; width: 100%; height: auto; border-radius: 12px;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 72px; height: 72px; background: rgba(45,132,193,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                  <div style="width: 0; height: 0; border-style: solid; border-width: 14px 0 14px 24px; border-color: transparent transparent transparent #ffffff; margin-left: 6px;"></div>
                </div>
              </div>
              <p style="color: #ffffff; font-size: 13px; margin: 10px 0 0 0; font-family: Verdana, Geneva, sans-serif;">
                Klicke auf das Bild, um das Video im Portal zu sehen
              </p>
            </a>
          </div>

          <!-- Button "Zum Video" -->
          <div style="text-align: center; margin: 25px 0 35px 0;">
            <a href="${magicLink}"
               style="display: inline-block; background-color: #2d84c1; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; font-family: 'Arial Black', Gadget, sans-serif; box-shadow: 0 2px 8px rgba(45,132,193,0.3);">
              ZUM VIDEO
            </a>
          </div>

          <!-- White separator -->
          <div style="text-align: center; margin: 20px 0;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" height="2" style="border-top-style: solid; border-top-color: #fffefe; border-top-width: 2px; font-size: 2px; line-height: 2px;">
             <tbody><tr><td height="0" style="font-size: 0; line-height: 0;">&nbsp;</td></tr></tbody>
            </table>
          </div>

          <!-- Long text -->
          <div style="padding-top: 20px;">
            <p style="color: #ffffff; font-size: 16px; line-height: 1.8; margin: 0 0 18px 0; font-family: Verdana, Geneva, sans-serif;">
              Hallo ${escapeHtml(firstName)}, mal ehrlich: Klausuren korrigieren lassen ist das absolute
              A und O im Jurastudium. Schreiben, korrigieren lassen, direktes Feedback einarbeiten –
              genau dieser Kreislauf bringt Dich ans Ziel. Und genau das machen wir hier. Wir machen das,
              was die Uni nie geschafft hat und vermutlich nie machen wird.
            </p>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.8; margin: 0 0 18px 0; font-family: Verdana, Geneva, sans-serif;">
              Der Weg zum Erfolg führt immer über die Treppe, niemals über den Fahrstuhl. Deshalb hol Dir
              jetzt Deine weiteren Klausuren. Lerne effektiv, bekomme schnelles Feedback mit unseren
              Korrekturbögen innerhalb von 48 Stunden – korrigiert durch unsere Prädikatsjuristen.
            </p>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.8; margin: 0 0 18px 0; font-family: Verdana, Geneva, sans-serif;">
              Schließe Dich über 500 pro Jahr vorbereiteten Kandidaten an, die es erfolgreich gemacht
              haben. Profitiere von über 22 Jahren Erfahrung. Wir freuen uns auf Dich.
            </p>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.8; margin: 0 0 18px 0; font-family: Verdana, Geneva, sans-serif;">
              Sei erfolgreich. Hol Dir jetzt Deine weiteren Klausuren mit Videokorrektur.
            </p>
          </div>

          <!-- Signature -->
          <div style="margin-top: 30px; padding-top: 20px;">
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0; font-family: Verdana, Geneva, sans-serif;">
              Dein Mario
            </p>
            <p style="color: #ffffff; font-size: 14px; line-height: 1.5; margin: 5px 0 0 0; font-family: Verdana, Geneva, sans-serif;">
              <strong>Mario Kraatz</strong><br>
              Akademie Kraatz GmbH
            </p>
          </div>
         </td>
        </tr>
       </tbody>
      </table>
     </td>
    </tr>
   </tbody>
  </table>

  <!-- Footer (from Kraatz Group template, without Newsletter abbestellen) -->
  <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fffefe;">
   <tbody>
    <tr>
     <td valign="top" style="background-color: #fffefe;">
      <table cellspacing="0" cellpadding="0" border="0" width="560" align="center" style="table-layout: fixed; width: 560px;">
       <tbody>
        <tr>
         <td style="color: #3b3f44; font-family: Arial, Helvetica, sans-serif; font-size: 16px; padding-bottom: 15px;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0">
           <tbody>
            <tr>
             <th width="50%" valign="top" style="font-weight: normal;">
              <table cellspacing="0" cellpadding="0" border="0" width="100%" style="table-layout: fixed; width: 100%;">
               <tbody>
                <tr>
                 <td valign="top" style="color: #3b3f44; font-family: Arial, Helvetica, sans-serif; font-size: 16px; padding-left: 15px; padding-right: 15px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0">
                   <tbody>
                    <tr>
                     <td align="left">
                      <table cellspacing="0" cellpadding="0" border="0" width="82" style="table-layout: fixed; width: 82px;">
                       <tbody>
                        <tr>
                         <td style="color: #3b3f44; font-family: Arial, Helvetica, sans-serif; font-size: 0; line-height: 0; padding-bottom: 15px; padding-top: 15px;">
                          <img src="${FOOTER_LOGO_URL}" width="82" border="0" style="display: block; width: 100%;">
                         </td>
                        </tr>
                       </tbody>
                      </table>
                     </td>
                    </tr>
                    <tr>
                     <td align="left" style="line-height: 1.3; color: #3b3f44; font-family: Arial, Helvetica, sans-serif; font-size: 16px; text-align: left;">
                      <div>
                       <h4 style="margin: 0; color: #1f2d3d; font-size: 18px; font-family: Arial, Helvetica, sans-serif;">
                         <span style="color: #2d84c1; font-size: 18px;">Kraatz</span><span style="color: #212121; font-size: 18px;"> Group</span>
                       </h4>
                       <p style="margin: 0; color: #1f2d3d; font-size: 18px;">
                         <span style="font-family: Arial; font-size: 16px;">Akademie Kraatz GmbH</span>
                       </p>
                       <p style="margin: 0;">Wilmersdorfer Stra&szlig;e 145/146,</p>
                       <p style="margin: 0;">10585, Berlin</p>
                      </div>
                     </td>
                    </tr>
                   </tbody>
                  </table>
                 </td>
                </tr>
               </tbody>
              </table>
             </th>
             <th width="50%" valign="top" style="font-weight: normal;">
              <table cellspacing="0" cellpadding="0" border="0" width="100%" style="table-layout: fixed; width: 100%;">
               <tbody>
                <tr>
                 <td valign="top" style="color: #3b3f44; font-family: Arial, Helvetica, sans-serif; font-size: 16px; padding-left: 15px; padding-right: 15px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0">
                   <tbody>
                    <tr>
                     <td height="40" align="center" style="font-size: 40px; line-height: 40px; background-color: transparent;">&nbsp;</td>
                    </tr>
                    <tr>
                     <td align="left">
                      <table cellspacing="0" cellpadding="0" border="0" width="100%" style="table-layout: fixed; width: 100%;">
                       <tbody>
                        <tr>
                         <td align="right" valign="top" style="line-height: 1.3; color: #3b3f44; font-family: Arial, Helvetica, sans-serif; font-size: 16px; padding-bottom: 15px; padding-top: 15px; text-align: right;">
                          <div>
                           <p style="margin: 0;">&nbsp;</p>
                           <p style="margin: 0;"><a href="mailto:postmaster@kraatz-group.de" style="color: #2d84c1; text-decoration: none;"><span style="color: #2d84c1;"><em>Kontaktiere uns</em></span></a></p>
                           <p style="margin: 0;"><a href="${BASE_URL}/klausurenbesprechung/pakete" style="color: #2d84c1; text-decoration: none;"><span style="color: #2d84c1;"><em>Zu unseren Kursangeboten</em></span></a></p>
                           <p style="margin: 0;">&nbsp;</p>
                          </div>
                         </td>
                        </tr>
                       </tbody>
                      </table>
                     </td>
                    </tr>
                   </tbody>
                  </table>
                 </td>
                </tr>
               </tbody>
              </table>
             </th>
            </tr>
           </tbody>
          </table>
         </td>
        </tr>
       </tbody>
      </table>
     </td>
    </tr>
   </tbody>
  </table>

</body>
</html>`;
}

// Modul-Marker
export {};
