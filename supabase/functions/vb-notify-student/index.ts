/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: string
  record: {
    id: string
    profile_id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    related_case_study_id?: string
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

    const body = await req.json()
    console.log('Received VB notification payload:', body)

    // Determine redirect URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || ''
    const baseUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de'
    const redirectUrl = `${baseUrl}/klausurenbesprechung`
    console.log('Origin:', origin, 'Redirect URL:', redirectUrl)

    // Check if this is a direct call (not a webhook trigger)
    if (body.profile_id && body.case_study_id) {
      // Direct call from frontend
      const { data: student, error: studentError } = await supabaseClient
        .from('profiles')
        .select('email, first_name, last_name, role, additional_roles')
        .eq('id', body.profile_id)
        .single()

      if (studentError || !student) {
        console.log('User not found:', studentError)
        return new Response('User not found', { 
          status: 404, 
          headers: corsHeaders 
        })
      }

      // Check if user has videobesprechung role
      if (!student.additional_roles?.includes('videobesprechung')) {
        console.log('User does not have videobesprechung role')
        return new Response('User not a videobesprechung user', { 
          status: 200, 
          headers: corsHeaders 
        })
      }

      // Generate magic link for direct login
      const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
        type: 'magiclink',
        email: student.email,
        options: {
          redirectTo: redirectUrl
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

      console.log('Magic link generated successfully for:', student.email)

      // Get case study details
      const { data: caseStudy } = await supabaseClient
        .from('vb_case_study_requests')
        .select('legal_area, sub_area, status')
        .eq('id', body.case_study_id)
        .single()

      const isMaterialChange = body.is_material_change
      const caseStudyNumber = body.case_study_number || 'deinem Sachverhalt'
      const notification = {
        title: isMaterialChange ? 'Material geändert' : 'Sachverhalt verfügbar',
        message: isMaterialChange 
          ? `Das Ihnen für ${caseStudyNumber} zugewiesene Material hat sich geändert.`
          : `Dein Sachverhalt ist jetzt verfügbar. Du kannst mit der Bearbeitung beginnen.`,
        related_case_study_id: body.case_study_id,
      }

      // Prepare email content
      let emailSubject = notification.title
      let actionButton = ''

      if (notification.message.includes('geändert')) {
        actionButton = `
          <a href="${magicLink}" 
             style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Neues Material ansehen
          </a>
        `
      } else {
        actionButton = `
          <a href="${magicLink}" 
             style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Sachverhalt ansehen
          </a>
        `
      }

      let emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
            <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 30px 20px; background-color: white;">
            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">${emailSubject}</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hallo ${student.first_name},
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              ${notification.message}
            </p>
            
            ${caseStudy ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
                <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Klausur-Details:</h4>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Rechtsgebiet:</strong></td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">${caseStudy.legal_area}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Teilbereich:</strong></td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">${caseStudy.sub_area}</td>
                  </tr>
                </table>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              ${actionButton}
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
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Bei Fragen wende dich bitte an <a href="mailto:charlenenowak@kraatz-group.de" style="color: #2e83c2; text-decoration: none;">charlenenowak@kraatz-group.de</a></p>
          </div>
        </div>
      `

      // Send email via Mailgun (non-blocking)
      const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
      const mailgunDomain = 'kraatz-group.de'
      
      if (mailgunApiKey) {
        try {
          const formData = new FormData()
          formData.append('from', 'Kraatz Group - Klausurenbesprechung <postmaster@kraatz-group.de>')
          formData.append('to', student.email)
          formData.append('subject', `[Klausurenbesprechung] ${emailSubject}`)
          formData.append('html', emailContent)

          console.log('Attempting to send email to:', student.email)
          const response = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
            },
            body: formData,
          })

          console.log('Mailgun response status:', response.status)
          if (response.ok) {
            console.log('Email sent successfully to:', student.email)
          } else {
            const errorText = await response.text()
            console.error('Mailgun error - Status:', response.status, 'Body:', errorText)
          }
        } catch (mailgunError) {
          console.error('Failed to send email (exception):', mailgunError)
        }
      } else {
        console.log('MAILGUN_API_KEY not configured, skipping email')
      }

      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Original webhook logic
    const payload: NotificationPayload = body
    console.log('Received VB notification payload:', payload)

    // Only process INSERT events (new notifications)
    if (payload.type !== 'INSERT') {
      return new Response('OK - Not an INSERT event', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    const notification = payload.record

    // Get profile information to determine if it's a dozent or student
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, first_name, last_name, role, additional_roles')
      .eq('id', notification.profile_id)
      .single()

    if (profileError || !profile) {
      console.log('User not found:', profileError)
      return new Response('OK - User not found', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Check if user has videobesprechung role
    if (!profile.additional_roles?.includes('videobesprechung')) {
      console.log('User does not have videobesprechung role')
      return new Response('OK - User not a videobesprechung user', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Determine if this is a dozent notification (based on role or message content)
    const isDozentNotification = profile.role === 'dozent' || 
                                  notification.title.includes('eingereicht') ||
                                  notification.message.includes('eingereicht')

    // If this is a dozent notification, delegate to vb-notify-dozent
    if (isDozentNotification) {
      console.log('Delegating to vb-notify-dozent for dozent notification')
      
      // Get case study details
      const { data: caseStudy } = await supabaseClient
        .from('vb_case_study_requests')
        .select('legal_area, sub_area, case_study_number, profile_id')
        .eq('id', notification.related_case_study_id)
        .single()

      if (!caseStudy) {
        console.log('Case study not found, skipping dozent notification')
        return new Response('OK - Case study not found', { 
          status: 200, 
          headers: corsHeaders 
        })
      }

      // Get student name
      const { data: student } = await supabaseClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', caseStudy.profile_id)
        .single()

      const studentName = student ? `${student.first_name} ${student.last_name}` : 'Unbekannt'

      // Call vb-notify-dozent edge function
      const { error: notifyError } = await supabaseClient.functions.invoke('vb-notify-dozent', {
        body: {
          dozentEmail: profile.email,
          dozentName: `${profile.first_name} ${profile.last_name}`,
          studentName: studentName,
          legalArea: caseStudy.legal_area,
          subArea: caseStudy.sub_area,
          caseStudyId: caseStudy.id
        }
      })

      if (notifyError) {
        console.error('Error calling vb-notify-dozent:', notifyError)
      } else {
        console.log('Dozent notification sent successfully')
      }

      return new Response('OK - Dozent notification delegated', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Check if this is a student notification by checking the message content
    const isStudentNotification = 
      notification.message.includes('verfügbar') || 
      notification.message.includes('Korrektur') ||
      notification.message.includes('abgeschlossen') ||
      notification.message.includes('geändert') ||
      notification.title.includes('Sachverhalt verfügbar') ||
      notification.title.includes('Material geändert') ||
      notification.title.includes('Korrektur verfügbar') ||
      notification.title.includes('Klausur abgeschlossen') ||
      notification.title.includes('Bearbeitung eingereicht') ||
      notification.title.includes('Korrektur in Bearbeitung')

    if (!isStudentNotification) {
      return new Response('OK - Not a student notification', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Get student details from profiles
    const { data: student, error: studentError } = await supabaseClient
      .from('profiles')
      .select('email, first_name, last_name, role, additional_roles')
      .eq('id', notification.profile_id)
      .single()

    if (studentError || !student) {
      console.log('User not found:', studentError)
      return new Response('OK - User not found', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Check if user has videobesprechung role
    if (!student.additional_roles?.includes('videobesprechung')) {
      console.log('User does not have videobesprechung role')
      return new Response('OK - User not a videobesprechung user', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Get case study details if available
    let caseStudyDetails: any = null
    let dozentName = ''
    if (notification.related_case_study_id) {
      const { data: caseStudy } = await supabaseClient
        .from('vb_case_study_requests')
        .select(`
          legal_area,
          sub_area,
          status
        `)
        .eq('id', notification.related_case_study_id)
        .single()

      caseStudyDetails = caseStudy
      dozentName = 'Dein Dozent'
    }

    // Prepare email content based on notification type
    let emailSubject = notification.title.replace(/📝|📄|🎓|✅|👨‍🏫|🎉|📚/g, '').trim()
    let actionButton = ''

    // Determine the appropriate action based on the notification
    if (notification.message.includes('geändert')) {
      actionButton = `
        <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
           style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: 500;">
          Neues Material ansehen
        </a>
      `
    } else if (notification.message.includes('verfügbar') && !notification.message.includes('Korrektur')) {
      actionButton = `
        <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
           style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: 500;">
          Sachverhalt ansehen
        </a>
      `
    } else if (notification.message.includes('Korrektur') && notification.message.includes('verfügbar')) {
      actionButton = `
        <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
           style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">
          Korrektur ansehen
        </a>
      `
    } else if (notification.message.includes('eingereicht')) {
      actionButton = `
        <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
           style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">
          Zum Dashboard
        </a>
      `
    } else {
      actionButton = `
        <a href="${Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de'}/dashboard" 
           style="display: inline-block; background-color: #2e83c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">
          Zum Dashboard
        </a>
      `
    }

    let emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">${emailSubject}</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${student.first_name},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${notification.message}
          </p>
          
          ${caseStudyDetails ? `
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
              <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Klausur-Details:</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Rechtsgebiet:</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${caseStudyDetails.legal_area}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Teilbereich:</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${caseStudyDetails.sub_area}</td>
                </tr>
              </table>
            </div>
          ` : ''}
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            ${actionButton}
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
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Bei Fragen wende dich bitte an <a href="mailto:charlenenowak@kraatz-group.de" style="color: #2e83c2; text-decoration: none;">charlenenowak@kraatz-group.de</a></p>
        </div>
      </div>
    `

    // Send email via Mailgun (non-blocking)
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
    const mailgunDomain = 'kraatz-group.de'
    
    if (mailgunApiKey) {
      try {
        const formData = new FormData()
        formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>')
        formData.append('to', student.email)
        formData.append('subject', `[Dozentenportal] ${emailSubject}`)
        formData.append('html', emailContent)

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
          console.log('Email sent successfully:', mailgunResult)
        } else {
          const errorText = await mailgunResponse.text()
          console.error('Mailgun error:', errorText)
        }
      } catch (mailgunError) {
        console.error('Failed to send email:', mailgunError)
      }
    } else {
      console.log('MAILGUN_API_KEY not configured, skipping email')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email notification sent to student'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in vb-notify-student function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
