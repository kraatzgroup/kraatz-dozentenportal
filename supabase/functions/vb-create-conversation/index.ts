import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '')
    
    // Decode JWT to get user ID (simple base64 decode of payload)
    let userId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      const payload = JSON.parse(atob(parts[1]))
      userId = payload.sub
      if (!userId) {
        throw new Error('No user ID in JWT')
      }
      console.log('User ID from JWT:', userId)
    } catch (jwtError) {
      console.error('JWT decode error:', jwtError)
      throw new Error('Invalid authentication token')
    }

    // Parse request body
    const { title, type, participantIds } = await req.json()

    console.log('Creating VB conversation:', { title, type, participantIds, userId })

    // Create admin client for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create conversation using service role (bypasses RLS)
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('vb_conversations')
      .insert({
        title,
        type: type || 'group',
        created_by: userId,
      })
      .select()
      .single()

    if (convError) {
      console.error('Error creating conversation:', convError)
      throw convError
    }

    console.log('VB Conversation created:', conversation.id)

    // Add participants (including creator)
    const allParticipantIds = [userId, ...participantIds.filter((id: string) => id !== userId)]
    const participants = allParticipantIds.map((profileId: string) => ({
      conversation_id: conversation.id,
      profile_id: profileId,
    }))

    const { error: participantsError } = await supabaseAdmin
      .from('vb_conversation_participants')
      .insert(participants)

    if (participantsError) {
      console.error('Error adding participants:', participantsError)
      // Rollback: delete the conversation
      await supabaseAdmin.from('vb_conversations').delete().eq('id', conversation.id)
      throw participantsError
    }

    console.log('Participants added successfully')

    // If this is a support conversation (student -> admin), send email notification to admin
    console.log('🔔 Checking if email notification should be sent. Type:', type)
    if (type === 'support') {
      console.log('✅ This is a support conversation - attempting to send email notification')
      try {
        // Get creator (student) info from profiles
        console.log('📧 Fetching creator info for userId:', userId)
        const { data: creator, error: creatorError } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, email, role, additional_roles')
          .eq('id', userId)
          .single()

        if (creatorError) {
          console.error('❌ Error fetching creator info:', creatorError)
        } else {
          console.log('✅ Creator info fetched:', { name: `${creator.first_name} ${creator.last_name}`, email: creator.email, role: creator.role })
          
          // Get ALL admin users (not just conversation participants) to send notifications
          console.log('📧 Fetching all admin users to send notifications')
          const { data: adminUsers, error: adminError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name')
            .eq('role', 'admin')

          if (adminError) {
            console.error('❌ Error fetching admin info:', adminError)
          } else {
            console.log('✅ Admin users fetched:', adminUsers?.map(a => ({ email: a.email })))
            
            // Send email to admins
            const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
            const mailgunDomain = 'kraatz-group.de'
            
            console.log('🔑 Mailgun API Key exists:', !!mailgunApiKey)
            console.log('👥 Admin users count:', adminUsers?.length || 0)
            
            if (mailgunApiKey && adminUsers) {
              console.log('📧 Starting admin email loop for', adminUsers.length, 'admin(s)')
              for (const admin of adminUsers) {
                console.log('📧 Preparing to send email to admin:', admin.email)
                const emailSubject = `Neue Support-Anfrage von ${creator.first_name} ${creator.last_name}`
                const emailContent = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                    <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
                      <img src="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/images/logos/9674199.png" 
                           alt="Kraatz-Club Logo" 
                           style="height: 60px; margin: 0 auto; display: block;">
                    </div>
                    
                    <div style="padding: 30px 20px; background-color: white;">
                      <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Neue Support-Anfrage (Videoklausurenkorrektur)</h2>
                      
                      <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Hallo ${admin.first_name} ${admin.last_name},
                      </p>
                      
                      <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        Ein Student hat eine neue Support-Anfrage erstellt.
                      </p>
                      
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
                        <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Details:</h4>
                        <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Von:</strong> ${creator.first_name} ${creator.last_name}</p>
                        <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>E-Mail:</strong> ${creator.email}</p>
                        <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Erstellt am:</strong> ${new Date().toLocaleString('de-DE')}</p>
                      </div>
                      
                      <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        Bitte loggen Sie sich in das Dozentenportal ein, um die Anfrage zu bearbeiten.
                      </p>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
                           style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                          Zum Dashboard
                        </a>
                      </div>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Dozentenportal System gesendet.</p>
                    </div>
                  </div>
                `

                const formData = new FormData()
                formData.append('from', 'Dozentenportal <postmaster@kraatz-group.de>')
                formData.append('to', admin.email)
                formData.append('subject', `[Dozentenportal] ${emailSubject}`)
                formData.append('html', emailContent)
                formData.append('charset', 'utf-8')

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

                if (mailgunResponse.ok) {
                  const mailgunResult = await mailgunResponse.json()
                  console.log(`✅ Support notification email sent to ${admin.email}. Mailgun ID:`, mailgunResult.id)
                } else {
                  const errorText = await mailgunResponse.text()
                  console.error(`❌ Failed to send email to ${admin.email}:`, errorText)
                }
              }
              
              // Also send confirmation email to student
              console.log('📧 Sending confirmation email to student:', creator.email)
              const studentEmailSubject = 'Ihre Support-Anfrage wurde erhalten'
              const studentEmailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                  <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
                    <img src="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/images/logos/9674199.png" 
                         alt="Kraatz-Club Logo" 
                         style="height: 60px; margin: 0 auto; display: block;">
                  </div>
                  
                  <div style="padding: 30px 20px; background-color: white;">
                    <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Support-Anfrage erhalten</h2>
                    
                    <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      Hallo ${creator.first_name} ${creator.last_name},
                    </p>
                    
                    <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                      Vielen Dank für Ihre Support-Anfrage. Wir haben Ihre Nachricht erhalten und werden uns schnellstmöglich bei Ihnen melden.
                    </p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
                      <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Details Ihrer Anfrage:</h4>
                      <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Erstellt am:</strong> ${new Date().toLocaleString('de-DE')}</p>
                      <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Status:</strong> In Bearbeitung</p>
                    </div>
                    
                    <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                      Sie können jederzeit im Chat weitere Nachrichten hinzufügen oder auf unsere Antwort warten.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
                         style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                        Zum Dashboard
                      </a>
                    </div>
                  </div>
                  
                  <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Dozentenportal System gesendet.</p>
                  </div>
                </div>
              `

              const studentFormData = new FormData()
              studentFormData.append('from', 'Dozentenportal <postmaster@kraatz-group.de>')
              studentFormData.append('to', creator.email)
              studentFormData.append('subject', `[Dozentenportal] ${studentEmailSubject}`)
              studentFormData.append('html', studentEmailContent)
              studentFormData.append('charset', 'utf-8')

              const studentMailgunResponse = await fetch(
                `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`
                  },
                  body: studentFormData
                }
              )

              if (studentMailgunResponse.ok) {
                const studentMailgunResult = await studentMailgunResponse.json()
                console.log(`✅ Confirmation email sent to student ${creator.email}. Mailgun ID:`, studentMailgunResult.id)
              } else {
                const studentErrorText = await studentMailgunResponse.text()
                console.error(`❌ Failed to send confirmation email to student ${creator.email}:`, studentErrorText)
              }
            } else {
              console.error('❌ Cannot send emails - Mailgun API key missing or no admin users found')
            }
          }
        }
      } catch (emailError) {
        console.error('❌ Error sending support notification email:', emailError)
        console.error('❌ Email error stack:', emailError instanceof Error ? emailError.stack : 'No stack trace')
        // Don't fail the conversation creation if email fails
      }

      // Mark conversation as unread for admin by setting their last_read_at to a very old date
      try {
        await supabaseAdmin
          .from('vb_conversation_participants')
          .update({ last_read_at: new Date('2000-01-01').toISOString() })
          .eq('conversation_id', conversation.id)
          .in('profile_id', participantIds)
        
        console.log('Conversation marked as unread for admin')
      } catch (unreadError) {
        console.error('Error marking conversation as unread:', unreadError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: conversation.id,
        conversation,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in vb-create-conversation function:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    })
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred',
        code: error.code,
        details: error.details
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
