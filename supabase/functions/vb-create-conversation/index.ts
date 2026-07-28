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

    // ---- Permission rules ----
    // Teilnehmer (students) may only start support conversations with
    // admin/verwaltung. Chats with a teilnehmer may only be initiated by
    // staff (dozent/admin/verwaltung).
    const { data: creatorProfile, error: creatorProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, additional_roles')
      .eq('id', userId)
      .single()

    if (creatorProfileError || !creatorProfile) {
      console.error('Error fetching creator profile:', creatorProfileError)
      throw new Error('Creator profile not found')
    }

    const { data: targetProfiles, error: targetProfilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, additional_roles')
      .in('id', participantIds)

    if (targetProfilesError) {
      console.error('Error fetching target profiles:', targetProfilesError)
      throw new Error('Could not validate participants')
    }

    const forbidden = (message: string) =>
      new Response(
        JSON.stringify({ success: false, error: message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )

    if (creatorProfile.role === 'teilnehmer') {
      const targetsValid =
        (targetProfiles || []).length > 0 &&
        (targetProfiles || []).every((t) => t.role === 'admin' || t.role === 'verwaltung')
      if (type !== 'support' || !targetsValid) {
        console.warn('Teilnehmer tried to start a non-support conversation', { type, participantIds })
        return forbidden('Teilnehmer können nur Support-Unterhaltungen mit Admin oder Verwaltung starten.')
      }
    } else if (!['dozent', 'admin', 'verwaltung'].includes(creatorProfile.role)) {
      console.warn('Unauthorized role tried to start a conversation', { role: creatorProfile.role })
      return forbidden('Keine Berechtigung zum Starten einer Unterhaltung.')
    }

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

    // Conversation creation itself sends no emails. Notifications about
    // actual messages are handled by vb-notify-chat-message. Only mark
    // support conversations as unread for the recipients here.
    if (type === 'support') {
      try {
        await supabaseAdmin
          .from('vb_conversation_participants')
          .update({ last_read_at: new Date('2000-01-01').toISOString() })
          .eq('conversation_id', conversation.id)
          .in('profile_id', participantIds)

        console.log('Conversation marked as unread for recipients')
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
