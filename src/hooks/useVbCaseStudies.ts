import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface VbCaseStudyRequest {
  id: string;
  profile_id: string;
  case_study_number: number;
  study_phase: string;
  legal_area: string;
  sub_area: string;
  focus_area: string;
  status: 'requested' | 'materials_ready' | 'submitted' | 'under_review' | 'corrected' | 'completed';
  pdf_url?: string;
  case_study_material_url?: string;
  additional_materials_url?: string;
  submission_url?: string;
  submission_downloaded_at?: string;
  video_correction_url?: string;
  written_correction_url?: string;
  solution_pdf_url?: string;
  scoring_sheet_url?: string;
  scoring_schema_url?: string;
  video_viewed_at?: string;
  pdf_downloaded_at?: string;
  correction_viewed_at?: string;
  created_at: string;
  updated_at: string;
  assigned_dozent_id?: string;
  grade?: number | null;
  grade_text?: string | null;
}

export const useVbCaseStudies = () => {
  const user = useAuthStore(state => state.user);
  const fullName = useAuthStore(state => state.fullName);
  const [caseStudies, setCaseStudies] = useState<VbCaseStudyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountCredits, setAccountCredits] = useState(0);

  const fetchCaseStudies = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('vb_case_study_requests')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCaseStudies(data || []);

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('vb_orders')
        .select('*')
        .eq('profile_id', user.id)
        .eq('status', 'completed');

      // Calculate total purchased credits directly from orders
      const totalPurchasedCredits = ordersData?.reduce((sum, order) => {
        return sum + (order.case_study_count || 0);
      }, 0) || 0;

      // Set available credits to total purchased (showing purchased credits)
      setAccountCredits(totalPurchasedCredits);

      // Sync account_credits in database if needed
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_credits')
        .eq('id', user.id)
        .single();
      
      if (profile && profile.account_credits !== totalPurchasedCredits) {
        await supabase
          .from('profiles')
          .update({ account_credits: totalPurchasedCredits })
          .eq('id', user.id);
      }
    } catch (err) {
      console.error('Error fetching VB case studies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load case studies');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createCaseStudyRequest = useCallback(async (requestData: {
    study_phase: string;
    legal_area: string;
    sub_area: string;
    focus_area: string;
  }) => {
    if (!user) return null;

    try {
      if (accountCredits < 1) {
        throw new Error('Nicht genügend Credits verfügbar');
      }

      // Generate next case_study_number
      const { data: maxNumber } = await supabase
        .from('vb_case_study_requests')
        .select('case_study_number')
        .order('case_study_number', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();
      const nextNumber = (maxNumber?.case_study_number || 0) + 1;

      const { data, error } = await supabase
        .from('vb_case_study_requests')
        .insert({
          profile_id: user.id,
          case_study_number: nextNumber,
          study_phase: requestData.study_phase,
          legal_area: requestData.legal_area,
          sub_area: requestData.sub_area,
          focus_area: requestData.focus_area,
          status: 'requested'
        })
        .select()
        .single();

      if (error) throw error;

      // Credits are calculated from vb_orders in the frontend, not decremented here
      // The credit is automatically "used" when the case study status changes to submitted/completed
      await fetchCaseStudies();

      // Notify designated VB dozenten for this legal area via email.
      // In-app notifications (vb_notifications) are created server-side by the
      // trigger_notify_dozenten_on_new_vb_request trigger; here we send the emails.
      try {
        // Find designated VB dozenten whose vb_legal_areas cover this legal area
        const { data: dozenten } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, email_notifications_enabled, vacation_start_date, vacation_end_date')
          .eq('role', 'dozent')
          .contains('vb_legal_areas', [requestData.legal_area]);

        const today = new Date();
        const studentName = fullName || user.email || 'Teilnehmer';

        const recipients = (dozenten || []).filter(d => {
          // skip dozenten who disabled email notifications
          if (d.email_notifications_enabled === false) return false;
          // skip dozenten currently on vacation
          if (d.vacation_start_date && d.vacation_end_date) {
            const start = new Date(d.vacation_start_date);
            const end = new Date(d.vacation_end_date);
            if (today >= start && today <= end) return false;
          }
          return !!d.email;
        });

        console.log(`📧 Sending new-Sachverhalt email to ${recipients.length} VB dozent(en)`);

        await Promise.all(recipients.map(async (dozent) => {
          const dozentName = [dozent.first_name, dozent.last_name].filter(Boolean).join(' ') || dozent.email;
          try {
            const { error: notifyError } = await supabase.functions.invoke('vb-notify-dozent-request', {
              body: {
                dozentEmail: dozent.email,
                dozentName,
                studentName,
                legalArea: requestData.legal_area,
                subArea: requestData.sub_area,
                caseStudyId: data.id,
              },
            });
            if (notifyError) {
              console.error(`❌ Error emailing dozent ${dozent.email}:`, notifyError);
            } else {
              console.log(`✅ Email sent to dozent ${dozent.email}`);
            }
          } catch (e) {
            console.error(`❌ Failed to invoke vb-notify-dozent-request for ${dozent.email}:`, e);
          }
        }));
      } catch (notifyError) {
        console.error('Error notifying VB dozenten:', notifyError);
        // Don't throw error, continue with case study creation
      }

      return data;
    } catch (err) {
      console.error('Error creating case study request:', err);
      throw err;
    }
  }, [user, fullName, accountCredits, fetchCaseStudies]);

  useEffect(() => {
    fetchCaseStudies();
  }, [fetchCaseStudies]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`vb_case_studies_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vb_case_study_requests',
          filter: `profile_id=eq.${user.id}`
        },
        () => fetchCaseStudies()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchCaseStudies]);

  return {
    caseStudies,
    loading,
    error,
    accountCredits,
    createCaseStudyRequest,
    refetch: fetchCaseStudies
  };
};
