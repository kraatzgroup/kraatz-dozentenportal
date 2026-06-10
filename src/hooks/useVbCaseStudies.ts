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

      // Fetch packages separately
      const { data: packagesData } = await supabase
        .from('vb_packages')
        .select('*');

      // Create a map of packages for quick lookup
      const packagesMap = new Map();
      packagesData?.forEach(pkg => {
        packagesMap.set(pkg.id, pkg);
      });

      // Calculate total purchased credits by joining orders with packages
      const totalPurchasedCredits = ordersData?.reduce((sum, order) => {
        const pkg = packagesMap.get(order.package_id);
        return sum + (pkg?.case_study_count || 0);
      }, 0) || 0;

      // Set available credits to total purchased (showing purchased credits)
      setAccountCredits(totalPurchasedCredits);
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

      const { data, error } = await supabase
        .from('vb_case_study_requests')
        .insert({
          profile_id: user.id,
          study_phase: requestData.study_phase,
          legal_area: requestData.legal_area,
          sub_area: requestData.sub_area,
          focus_area: requestData.focus_area,
          status: 'requested'
        })
        .select()
        .single();

      if (error) throw error;

      // Decrement account credits
      await supabase
        .from('profiles')
        .update({ account_credits: accountCredits - 1 })
        .eq('id', user.id);

      setAccountCredits(prev => prev - 1);
      await fetchCaseStudies();

      return data;
    } catch (err) {
      console.error('Error creating case study request:', err);
      throw err;
    }
  }, [user, accountCredits, fetchCaseStudies]);

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
