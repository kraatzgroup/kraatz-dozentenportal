// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessagePayload {
  type: string
  record: {
    id: string
    conversation_id: string
    sender_id: string
    content: string
    created_at: string
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: ChatMessagePayload = await req.json()
    console.log('VB Chat message notification payload:', payload)

    if (payload.type !== 'INSERT') {
      return new Response('Not an insert operation', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    const { record } = payload

    // Get conversation participants (excluding sender) - using separate queries to avoid foreign key issues
    const { data: participantIds, error: participantsError } = await supabaseClient
      .from('vb_conversation_participants')
      .select('profile_id')
      .eq('conversation_id', record.conversation_id)
      .neq('profile_id', record.sender_id)

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      return new Response('Error fetching participants', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    if (!participantIds || participantIds.length === 0) {
      console.log('No other participants found')
      return new Response('No participants to notify', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Get user details for participants from profiles
    const { data: participants, error: usersError } = await supabaseClient
      .from('profiles')
      .select('id, email, first_name, last_name, role, additional_roles')
      .in('id', participantIds.map(p => p.profile_id))

    if (usersError) {
      console.error('Error fetching user details:', usersError)
      return new Response('Error fetching user details', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    // Get sender info from profiles
    const { data: sender, error: senderError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, role')
      .eq('id', record.sender_id)
      .single()

    if (senderError) {
      console.error('Error fetching sender:', senderError)
      return new Response('Error fetching sender', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    // Notify all other participants, regardless of role
    // (teilnehmer, dozent, admin, verwaltung)
    const notifiableParticipants = (participants || []).filter(p => !!p.email)

    console.log(`Found ${notifiableParticipants.length} participants to notify`)

    if (notifiableParticipants.length === 0) {
      return new Response('No participants to notify', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Get Mailgun configuration
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
    const mailgunDomain = 'kraatz-group.de'
    
    if (!mailgunApiKey) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    // Send email notifications to each participant using Mailgun
    const emailPromises = notifiableParticipants.map(async (participant) => {
      const user = participant
      if (!user) return null

      const emailSubject = `Neue Chat-Nachricht von ${sender.first_name} ${sender.last_name}`
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
            <img src="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/images/logos/9674199.png" 
                 alt="Kraatz-Club Logo" 
                 style="height: 60px; margin: 0 auto; display: block;">
          </div>
          
          <!-- Main Content -->
          <div style="padding: 30px 20px; background-color: white;">
            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Neue Chat-Nachricht (Videoklausurenkorrektur)</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Liebe/r ${user.first_name} ${user.last_name},
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Sie haben eine neue Chat-Nachricht von <strong>${sender.first_name} ${sender.last_name}</strong> erhalten.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
              <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Details:</h4>
              <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Von:</strong> ${sender.first_name} ${sender.last_name}</p>
              <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Gesendet am:</strong> ${new Date(record.created_at).toLocaleString('de-DE')}</p>
              <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Nachricht:</strong> "${record.content.length > 300 ? record.content.substring(0, 300) + '…' : record.content}"</p>
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Bitte loggen Sie sich in das Dozentenportal ein, um zu antworten und die Unterhaltung fortzusetzen.
            </p>
            
            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/klausurenbesprechung/chat" 
                 style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Zum Chat
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Dozentenportal System gesendet.</p>
          </div>
        </div>
      `

      // Prepare form data for Mailgun
      const formData = new FormData()
      formData.append('from', 'Dozentenportal <postmaster@kraatz-group.de>')
      formData.append('to', user.email)
      formData.append('subject', `[Dozentenportal] ${emailSubject}`)
      formData.append('html', emailContent)
      formData.append('charset', 'utf-8')

      // Send email via Mailgun
      const mailgunResponse = await fetch(
        `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`
          },
          body: formData
        }
      )

      if (!mailgunResponse.ok) {
        const errorText = await mailgunResponse.text()
        console.error(`Mailgun error for ${user.email}:`, errorText)
        throw new Error(`Mailgun API error: ${mailgunResponse.status}`)
      }

      const result = await mailgunResponse.json()
      console.log(`✅ Chat notification email sent to ${user.email}:`, result)
      return result
    })

    // Wait for all emails to be sent
    const emailResults = await Promise.all(emailPromises.filter(p => p !== null))

    return new Response(JSON.stringify({
      success: true, 
      message: `Chat notification emails sent to ${notifiableParticipants.length} recipients`,
      recipients: notifiableParticipants.map(p => ({ 
        email: p.email, 
        name: `${p.first_name} ${p.last_name}` 
      })),
      mailgunIds: emailResults.map(r => r.id)
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in vb-notify-chat-message function:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})
