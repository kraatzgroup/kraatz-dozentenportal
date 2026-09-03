/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received dozent notification payload for submission:', body)

    const { dozentEmail, dozentName, studentName, legalArea, subArea, caseStudyId } = body

    if (!dozentEmail || !studentName || !legalArea || !subArea || !caseStudyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const requestId = Math.random().toString(36).substring(7)
    console.log(`📧 [${requestId}] Sending submission notification to dozent: ${dozentEmail}`)

    // Generate magic link for direct login
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: dozentEmail,
      options: {
        redirectTo: 'https://portal.kraatz-group.de/klausurenbesprechung/korrektur'
      }
    })

    if (linkError) {
      console.error('Error generating magic link:', linkError)
      throw linkError
    }

    const magicLink = linkData?.properties?.action_link
    if (!magicLink) {
      console.error('No magic link returned')
      throw new Error('Failed to generate magic link')
    }

    console.log('Magic link generated successfully for:', dozentEmail)

    // Prepare email content for submitted work
    const emailSubject = 'Neue Bearbeitung eingereicht'
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">${emailSubject}</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${dozentName},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Ein Teilnehmer hat eine Bearbeitung für die Klausur eingereicht und steht zur Korrektur bereit.
          </p>

          <!-- Case Study Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Klausur-Details:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Teilnehmer:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Rechtsgebiet:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${legalArea}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Teilbereich:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${subArea}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Klicken Sie auf den Button unten, um sich direkt anzumelden und die Bearbeitung zu korrigieren:</strong>
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zur Korrektur
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
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Bei Fragen wenden Sie sich bitte an <a href="mailto:charlenenowak@kraatz-group.de" style="color: #2e83c2; text-decoration: none;">charlenenowak@kraatz-group.de</a></p>
        </div>
      </div>`;

    // Send email via Mailgun
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
    const mailgunDomain = 'kraatz-group.de'

    if (!mailgunApiKey) {
      console.error('MAILGUN_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'E-Mail-Konfiguration fehlt' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const mailgunUrl = `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`;
    const emailSender = 'Kraatz Group - Klausurenbesprechung <postmaster@kraatz-group.de>';
    const formData = new FormData();
    formData.append('from', emailSender);
    formData.append('to', dozentEmail);
    formData.append('subject', `[Klausurenbesprechung] ${emailSubject}`);
    formData.append('html', emailHtml);
    formData.append('charset', 'utf-8');

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
      },
      body: formData,
    });

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text();
      console.error(`❌ [${requestId}] Mailgun error:`, errorText);
      await logNotification({
        edgeFunction: 'vb-notify-dozent-submission',
        supabaseAdmin: supabaseClient,
        recipientEmail: dozentEmail,
        recipientName: dozentName,
        subject: `[Klausurenbesprechung] ${emailSubject}`,
        sender: emailSender,
        status: 'failed',
        errorMessage: `Mailgun API error: ${mailgunResponse.status} - ${errorText}`,
        context: { caseStudyId, legalArea, subArea, studentName },
        payload: { dozentEmail, dozentName, studentName, legalArea, subArea, caseStudyId },
      });
      return new Response(
        JSON.stringify({ error: 'Fehler beim E-Mail-Versand', details: errorText }),
        { status: 500, headers: corsHeaders }
      );
    }

    const mailgunResult = await mailgunResponse.json();
    console.log(`✅ [${requestId}] Notification email sent successfully via Mailgun: ${mailgunResult.id}`);

    await logNotification({
      edgeFunction: 'vb-notify-dozent-submission',
      supabaseAdmin: supabaseClient,
      recipientEmail: dozentEmail,
      recipientName: dozentName,
      subject: `[Klausurenbesprechung] ${emailSubject}`,
      sender: emailSender,
      status: 'sent',
      providerMessageId: mailgunResult?.id,
      context: { caseStudyId, legalArea, subArea, studentName },
      payload: { dozentEmail, dozentName, studentName, legalArea, subArea, caseStudyId },
    });

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - Date.now()}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification email sent successfully',
        emailId: mailgunResult.id
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in vb-notify-dozent-submission:', error);
    return new Response(
      JSON.stringify({
        error: 'Fehler beim Versenden der Benachrichtigung',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
