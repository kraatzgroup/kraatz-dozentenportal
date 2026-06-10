/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { caseStudyId, grade, gradeText } = await req.json()

    console.log('🐘 VB Save Grade Edge Function:', { caseStudyId, grade, gradeText })

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if a submission already exists for this case study
    const { data: existingSubmission, error: fetchError } = await supabaseAdmin
      .from('vb_submissions')
      .select('id')
      .eq('case_study_request_id', caseStudyId)
      .single()

    let result
    let operation = 'unknown'

    if (existingSubmission && grade !== null) {
      // Update existing submission with new grade
      operation = 'update'
      console.log('📝 Updating existing VB submission for case study:', caseStudyId)
      
      const { data, error } = await supabaseAdmin
        .from('vb_submissions')
        .update({ 
          grade: grade,
          grade_text: gradeText || null
        })
        .eq('case_study_request_id', caseStudyId)
        .select()

      if (error) throw error
      result = data
    } else if (existingSubmission && grade === null) {
      // Clear grade for existing submission
      operation = 'clear_grade'
      console.log('🗑️ Clearing grade for existing VB submission:', caseStudyId)
      
      const { data, error } = await supabaseAdmin
        .from('vb_submissions')
        .update({ 
          grade: null,
          grade_text: null
        })
        .eq('case_study_request_id', caseStudyId)
        .select()

      if (error) throw error
      result = data
    } else if (grade !== null) {
      // Create new submission entry only if grade is not null
      operation = 'insert'
      console.log('➕ Creating new VB submission for case study:', caseStudyId)
      
      const { data, error } = await supabaseAdmin
        .from('vb_submissions')
        .insert({
          case_study_request_id: caseStudyId,
          file_url: 'placeholder-url',
          file_type: 'pdf',
          status: 'corrected',
          grade: grade,
          grade_text: gradeText || null,
          corrected_at: new Date().toISOString()
        })
        .select()

      if (error) throw error
      result = data
    } else {
      // Grade is null and no existing submission - nothing to do
      operation = 'skip'
      console.log('⏭️ Skipping - grade is null and no existing submission')
      result = { message: 'No action needed - grade is null and no existing submission' }
    }

    console.log(`✅ VB Grade save ${operation} successful:`, result)

    return new Response(
      JSON.stringify({ 
        success: true, 
        operation,
        data: result,
        caseStudyId,
        grade,
        gradeText
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ Error in vb-save-grade function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
