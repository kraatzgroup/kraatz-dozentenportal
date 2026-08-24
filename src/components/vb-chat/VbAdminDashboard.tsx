import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BookOpen,
  Users,
  GraduationCap,
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import { SchwerpunktTagsInput } from './SchwerpunktTagsInput';

// ---- Types ----

interface VbDozent {
  id: string;
  full_name: string | null;
  email: string | null;
  vb_legal_areas: string[] | null;
  vb_available: boolean | null;
  vb_springer: boolean | null;
  vacation_start_date: string | null;
  vacation_end_date: string | null;
  openCases: number;
}

interface VbTeilnehmer {
  id: string;
  full_name: string | null;
  email: string | null;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  openCases: number;
}

interface AbsenceRequest {
  id: string;
  dozent_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  dozent_name: string;
  dozent_email: string | null;
}

interface VbCaseRow {
  id: string;
  profile_id: string;
  case_study_number: number;
  legal_area: string;
  sub_area: string;
  focus_area: string | null;
  admin_focus_tags: string[] | null;
  status: string;
  assigned_dozent_id: string | null;
  pdf_url: string | null;
  case_study_material_url: string | null;
  additional_materials_url: string | null;
  submission_url: string | null;
  video_correction_url: string | null;
  written_correction_url: string | null;
  solution_pdf_url: string | null;
  scoring_schema_url: string | null;
  created_at: string;
  updated_at: string;
  student?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  dozent?: { full_name: string | null; email: string | null } | null;
  grade?: number | null;
  grade_text?: string | null;
}

// ---- Helpers ----

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Neue Anfragen', cls: 'bg-blue-100 text-blue-800' },
  materials_ready: { label: 'Materialien versendet', cls: 'bg-indigo-100 text-indigo-800' },
  submitted: { label: 'Eingereichte Arbeiten', cls: 'bg-yellow-100 text-yellow-800' },
  under_review: { label: 'In Korrektur', cls: 'bg-amber-100 text-amber-800' },
  corrected: { label: 'Korrigiert', cls: 'bg-green-100 text-green-800' },
  completed: { label: 'Abgeschlossen', cls: 'bg-green-100 text-green-800' },
};

// Fixed display order for legal areas. Unknown areas appear after, sorted alphabetically.
const LEGAL_AREA_ORDER = ['Strafrecht', 'Zivilrecht', 'Öffentliches Recht'];
const sortLegalAreas = (areas: string[]): string[] => {
  const orderIndex = (a: string) => {
    const idx = LEGAL_AREA_ORDER.indexOf(a);
    return idx === -1 ? LEGAL_AREA_ORDER.length : idx;
  };
  return [...areas].sort((a, b) => {
    const ai = orderIndex(a);
    const bi = orderIndex(b);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
};

const COLUMN_DEFS: { id: 'requests' | 'materials_sent' | 'submissions' | 'completed'; label: string; accent: string }[] = [
  { id: 'requests', label: 'Neue Anfragen', accent: 'border-t-blue-400' },
  { id: 'materials_sent', label: 'Materialien versendet', accent: 'border-t-indigo-400' },
  { id: 'submissions', label: 'Eingereichte Arbeiten', accent: 'border-t-yellow-400' },
  { id: 'completed', label: 'Abgeschlossen', accent: 'border-t-green-400' },
];

const caseColumn = (c: VbCaseRow): 'requests' | 'materials_sent' | 'submissions' | 'completed' => {
  if (c.status === 'requested') return 'requests';
  if (c.status === 'materials_ready') return 'materials_sent';
  if (c.status === 'completed' || (c.status === 'corrected' && c.video_correction_url)) return 'completed';
  // submitted, under_review, corrected (without video)
  return 'submissions';
};

// Statuses that count as "used" credits (must match the fetchAll credit calculation).
const USED_STATUSES = ['submitted', 'under_review', 'in_review', 'completed', 'graded', 'corrected', 'materials_ready'];
const isCaseCreditUsed = (c: VbCaseRow): boolean => USED_STATUSES.includes(c.status);

const displayStudentName = (c: VbCaseRow): string => {
  const s = c.student;
  if (!s) return 'Unbekannt';
  const name = [s.first_name, s.last_name].filter(Boolean).join(' ').trim();
  return name || s.email || 'Unbekannt';
};

const isCurrentlyOnVacation = (start: string | null, end: string | null): boolean => {
  if (!start || !end) return false;
  const today = new Date();
  return today >= new Date(start) && today <= new Date(end);
};

// ---- Component ----

export const VbAdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dozenten, setDozenten] = useState<VbDozent[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<VbTeilnehmer[]>([]);
  const [cases, setCases] = useState<VbCaseRow[]>([]);
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('all');
  const [availableLegalAreas, setAvailableLegalAreas] = useState<string[]>([]);
  const [addCreditsFor, setAddCreditsFor] = useState<VbTeilnehmer | null>(null);
  const [creditsAmount, setCreditsAmount] = useState('');
  const [addingCredits, setAddingCredits] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<VbCaseRow | null>(null);
  const [deletingCase, setDeletingCase] = useState(false);
  const [refundCredit, setRefundCredit] = useState(true);
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Dozenten: role = 'dozent' with the videobesprechung_dozent additional role
      const { data: dozentenData } = await supabase
        .from('profiles')
        .select('id, full_name, email, vb_legal_areas, vb_available, vb_springer, vacation_start_date, vacation_end_date')
        .eq('role', 'dozent')
        .contains('additional_roles', ['videobesprechung_dozent']);

      // 2) Teilnehmer: additional_roles contains 'videobesprechung'
      const { data: teilnehmerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, additional_roles')
        .eq('role', 'teilnehmer')
        .contains('additional_roles', ['videobesprechung']);

      const teilnehmerIds = (teilnehmerProfiles || []).map(t => t.id);

      // 3) All cases with student profile (dozent fetched separately to avoid FK name issues)
      const { data: casesData, error: casesError } = await supabase
        .from('vb_case_study_requests')
        .select('*, student:profiles!vb_case_study_requests_profile_id_fkey(first_name,last_name,email)')
        .order('updated_at', { ascending: false });

      if (casesError) {
        console.error('❌ VbAdminDashboard: Error fetching cases:', casesError);
      }

      // 3b) Fetch dozent profiles for assigned cases
      const assignedDozentIds = Array.from(new Set(
        (casesData || []).map((c: any) => c.assigned_dozent_id).filter(Boolean)
      ));
      let dozentMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (assignedDozentIds.length > 0) {
        const { data: dozentProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', assignedDozentIds);
        (dozentProfiles || []).forEach(p => {
          dozentMap.set(p.id, { full_name: p.full_name, email: p.email });
        });
      }

      // 4) Grades from vb_submissions
      const caseIds = (casesData || []).map((c: any) => c.id);
      let gradeMap = new Map<string, { grade: number | null; grade_text: string | null }>();
      if (caseIds.length > 0) {
        const { data: subs } = await supabase
          .from('vb_submissions')
          .select('case_study_request_id, grade, grade_text')
          .in('case_study_request_id', caseIds);
        (subs || []).forEach(s => {
          gradeMap.set(s.case_study_request_id, { grade: s.grade, grade_text: s.grade_text });
        });
      }

      const rows: VbCaseRow[] = (casesData || []).map((c: any) => ({
        ...c,
        dozent: c.assigned_dozent_id ? dozentMap.get(c.assigned_dozent_id) || null : null,
        grade: gradeMap.get(c.id)?.grade ?? null,
        grade_text: gradeMap.get(c.id)?.grade_text ?? null,
      }));
      console.log('📊 VbAdminDashboard: fetchAll fetched cases:', {
        count: rows.length,
        cases: rows.map(r => ({ id: r.id, number: r.case_study_number, status: r.status, legal_area: r.legal_area })),
        openCount: rows.filter(r => r.status !== 'completed').length,
      });
      setCases(rows);

      // 5) Orders for teilnehmer credits (only non-expired)
      let vbCreditsByProfile: Record<string, { total: number; used: number; remaining: number }> = {};
      if (teilnehmerIds.length > 0) {
        const nowIso = new Date().toISOString();
        const { data: ordersData } = await supabase
          .from('vb_orders')
          .select('id, profile_id, status, case_study_count, expires_at')
          .in('profile_id', teilnehmerIds);
        (ordersData || []).forEach(order => {
          if (!vbCreditsByProfile[order.profile_id]) {
            vbCreditsByProfile[order.profile_id] = { total: 0, used: 0, remaining: 0 };
          }
          if (order.status === 'completed' || order.status === 'paid') {
            // Skip expired orders (expires_at in the past)
            if (order.expires_at && new Date(order.expires_at) < new Date(nowIso)) return;
            vbCreditsByProfile[order.profile_id].total += order.case_study_count || 0;
          }
        });

        // Used credits: count cases that have been submitted/in_review/completed/graded
        const { data: usedRequests } = await supabase
          .from('vb_case_study_requests')
          .select('profile_id, status')
          .in('profile_id', teilnehmerIds)
          .in('status', ['submitted', 'under_review', 'in_review', 'completed', 'graded', 'corrected', 'materials_ready']);
        (usedRequests || []).forEach(r => {
          if (vbCreditsByProfile[r.profile_id]) {
            vbCreditsByProfile[r.profile_id].used += 1;
          }
        });

        Object.keys(vbCreditsByProfile).forEach(pid => {
          vbCreditsByProfile[pid].remaining =
            vbCreditsByProfile[pid].total - vbCreditsByProfile[pid].used;
        });
      }

      // Build open case counts per profile.
      // A case is "done" when completed OR corrected with a video correction URL
      // (mirrors caseColumn() / isCaseDone() logic used for the stat cards).
      const openCasesByStudent = new Map<string, number>();
      const openCasesByDozent = new Map<string, number>();
      rows.forEach(c => {
        const done = c.status === 'completed' || (c.status === 'corrected' && !!c.video_correction_url);
        if (done) return;
        if (c.profile_id) openCasesByStudent.set(c.profile_id, (openCasesByStudent.get(c.profile_id) || 0) + 1);
        if (c.assigned_dozent_id) openCasesByDozent.set(c.assigned_dozent_id, (openCasesByDozent.get(c.assigned_dozent_id) || 0) + 1);
      });

      // Map dozenten
      const dozentenList: VbDozent[] = (dozentenData || []).map(d => ({
        id: d.id,
        full_name: d.full_name,
        email: d.email,
        vb_legal_areas: d.vb_legal_areas || [],
        vb_available: d.vb_available,
        vb_springer: d.vb_springer,
        vacation_start_date: d.vacation_start_date,
        vacation_end_date: d.vacation_end_date,
        openCases: openCasesByDozent.get(d.id) || 0,
      }));
      setDozenten(dozentenList);

      // Map teilnehmer
      const teilnehmerList: VbTeilnehmer[] = (teilnehmerProfiles || []).map(t => {
        const credits = vbCreditsByProfile[t.id] || { total: 0, used: 0, remaining: 0 };
        return {
          id: t.id,
          full_name: t.full_name,
          email: t.email,
          totalCredits: credits.total,
          usedCredits: credits.used,
          remainingCredits: credits.remaining,
          openCases: openCasesByStudent.get(t.id) || 0,
        };
      });
      setTeilnehmer(teilnehmerList);

      // Legal areas for filter
      const areas = new Set<string>();
      rows.forEach(c => areas.add(c.legal_area));
      dozentenList.forEach(d => (d.vb_legal_areas || []).forEach(a => areas.add(a)));
      setAvailableLegalAreas(sortLegalAreas(Array.from(areas)));

      // 6) Pending absence requests (short-notice, within 14-day buffer)
      const { data: absReqData } = await supabase
        .from('dozent_absence_requests')
        .select('id, dozent_id, start_date, end_date, reason, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const absReqDozentIds = Array.from(new Set((absReqData || []).map((r: any) => r.dozent_id)));
      let absReqDozentMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (absReqDozentIds.length > 0) {
        const { data: absReqDozenten } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', absReqDozentIds);
        (absReqDozenten || []).forEach(p => {
          absReqDozentMap.set(p.id, { full_name: p.full_name, email: p.email });
        });
      }

      const absRequests: AbsenceRequest[] = (absReqData || []).map((r: any) => {
        const d = absReqDozentMap.get(r.dozent_id);
        return {
          id: r.id,
          dozent_id: r.dozent_id,
          start_date: r.start_date,
          end_date: r.end_date,
          reason: r.reason,
          status: r.status,
          created_at: r.created_at,
          dozent_name: d?.full_name || d?.email || 'Unbekannt',
          dozent_email: d?.email || null,
        };
      });
      setAbsenceRequests(absRequests);
    } catch (err) {
      console.error('❌ VbAdminDashboard: Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddCredits = async () => {
    if (!addCreditsFor || !creditsAmount) return;
    const newValue = parseInt(creditsAmount, 10);
    if (isNaN(newValue) || newValue < 0) return;
    const delta = newValue - addCreditsFor.remainingCredits;
    if (delta === 0) {
      setAddCreditsFor(null);
      return;
    }
    setAddingCredits(true);
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 18);
      const { error } = await supabase
        .from('vb_orders')
        .insert({
          profile_id: addCreditsFor.id,
          status: 'completed',
          case_study_count: delta,
          total_cents: 0,
          expires_at: expiresAt.toISOString(),
        });
      if (error) throw error;
      setCreditsAmount('');
      setAddCreditsFor(null);
      await fetchAll();
    } catch (err) {
      console.error('Error adding credits:', err);
      alert('Fehler beim Aktualisieren der Credits: ' + (err instanceof Error ? err.message : 'Unbekannt'));
    } finally {
      setAddingCredits(false);
    }
  };

  const handleAbsenceRequest = async (req: AbsenceRequest, action: 'approved' | 'rejected') => {
    setProcessingRequestId(req.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('dozent_absence_requests')
        .update({
          status: action,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id);
      if (error) throw error;

      // If approved, create the actual absence record
      if (action === 'approved') {
        const { error: absError } = await supabase
          .from('dozent_absences')
          .insert({
            dozent_id: req.dozent_id,
            start_date: req.start_date,
            end_date: req.end_date,
            reason: req.reason || 'Kurzfristige Abwesenheit (genehmigt)',
          });
        if (absError) {
          console.error('Error creating absence record:', absError);
        }
      }

      // Remove from list
      setAbsenceRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err) {
      console.error('Error processing absence request:', err);
      alert('Fehler beim Bearbeiten der Anfrage');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDeleteCase = async (caseRow: VbCaseRow) => {
    console.log('🗑️ VbAdminDashboard: handleDeleteCase START', {
      id: caseRow.id,
      case_study_number: caseRow.case_study_number,
      status: caseRow.status,
      legal_area: caseRow.legal_area,
      profile_id: caseRow.profile_id,
      assigned_dozent_id: caseRow.assigned_dozent_id,
    });
    setDeletingCase(true);
    try {
      // Collect storage file paths to delete from the case-studies bucket.
      // URLs look like: https://<project>.supabase.co/storage/v1/object/public/case-studies/<path>
      const urlFields = [
        caseRow.pdf_url,
        caseRow.case_study_material_url,
        caseRow.additional_materials_url,
        caseRow.submission_url,
        caseRow.video_correction_url,
        caseRow.written_correction_url,
        caseRow.solution_pdf_url,
        caseRow.scoring_schema_url,
      ].filter((u): u is string => !!u);

      console.log('🗑️ VbAdminDashboard: URL fields collected for cleanup:', urlFields);

      const pathsToDelete: string[] = [];
      for (const url of urlFields) {
        // case-studies bucket
        let marker = `/object/public/case-studies/`;
        let idx = url.indexOf(marker);
        if (idx >= 0) {
          pathsToDelete.push(url.slice(idx + marker.length));
          continue;
        }
        // masterclass bucket (some materials may live there)
        marker = `/object/public/masterclass/`;
        idx = url.indexOf(marker);
        if (idx >= 0) {
          // masterclass files are shared teaching materials – do NOT delete them.
          continue;
        }
      }

      console.log('🗑️ VbAdminDashboard: Storage paths to delete from case-studies bucket:', pathsToDelete);

      // Delete storage files (best-effort, don't block on errors)
      const caseStudiesPaths = pathsToDelete;
      if (caseStudiesPaths.length > 0) {
        console.log('🗑️ VbAdminDashboard: Removing storage files from case-studies bucket...');
        const { data: storageData, error: storageError } = await supabase.storage
          .from('case-studies')
          .remove(caseStudiesPaths);
        console.log('🗑️ VbAdminDashboard: Storage remove result:', { storageData, storageError });
        if (storageError) {
          console.warn('⚠️ VbAdminDashboard: Could not delete all storage files:', storageError);
        }
      } else {
        console.log('🗑️ VbAdminDashboard: No storage files to delete (skipping storage cleanup).');
      }

      // Delete the database record.
      // Cascading deletes will automatically remove related:
      //   - vb_submissions, vb_notifications, vb_case_study_ratings
      console.log('🗑️ VbAdminDashboard: Deleting DB record vb_case_study_requests id =', caseRow.id);

      // Diagnostic: fetch the current user's profile to verify what RLS sees
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user?.id) {
        const { data: myProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, role, additional_roles')
          .eq('id', authUser.user.id)
          .single();
        console.log('🔍 VbAdminDashboard: Current user profile (as seen by DB):', { myProfile, profileErr, authUid: authUser.user.id });
      }

      const { data: deleteData, error: deleteError, count: deleteCount } = await supabase
        .from('vb_case_study_requests')
        .delete({ count: 'exact' })
        .eq('id', caseRow.id);

      console.log('🗑️ VbAdminDashboard: Delete result:', { deleteData, deleteError, deleteCount });

      if (deleteError) {
        console.error('❌ VbAdminDashboard: Delete returned an error:', deleteError);
        throw deleteError;
      }

      if (deleteCount === 0) {
        console.warn('⚠️ VbAdminDashboard: Delete affected 0 rows! The record may not exist or RLS blocked the delete. id =', caseRow.id);
      } else {
        console.log('✅ VbAdminDashboard: Delete affected', deleteCount, 'row(s).');
      }

      // Verify the record is actually gone (read-back check)
      const { data: verifyData, error: verifyError } = await supabase
        .from('vb_case_study_requests')
        .select('id, status, case_study_number')
        .eq('id', caseRow.id);
      console.log('🔍 VbAdminDashboard: Read-back verification after delete:', { verifyData, verifyError });
      if (verifyData && verifyData.length > 0) {
        console.error('❌ VbAdminDashboard: Record STILL EXISTS after delete! RLS may be blocking the DELETE.', verifyData);
      } else {
        console.log('✅ VbAdminDashboard: Record confirmed gone from DB.');
      }

      // Credit refund handling.
      // Deleting a "used" case automatically reduces the used-credit count,
      // which increases the participant's remaining credits by 1 (auto-refund).
      // If the admin chose NOT to refund, insert a compensating vb_order with
      // case_study_count = -1 so the total drops by 1 as well, keeping
      // remaining = total - used unchanged.
      const wasCreditUsed = isCaseCreditUsed(caseRow);
      console.log('💰 VbAdminDashboard: Credit refund check:', { wasCreditUsed, refundCredit, status: caseRow.status });

      if (wasCreditUsed && !refundCredit) {
        console.log('💰 VbAdminDashboard: Inserting compensating debit order (case_study_count = -1) for profile', caseRow.profile_id);
        const { error: debitError } = await supabase
          .from('vb_orders')
          .insert({
            profile_id: caseRow.profile_id,
            status: 'completed',
            case_study_count: -1,
            total_cents: 0,
          });
        if (debitError) {
          console.error('❌ VbAdminDashboard: Could not insert compensating debit order:', debitError);
          // Don't throw — the case is already deleted. Warn the admin instead.
          alert('Die Anfrage wurde gelöscht, aber der Credit konnte nicht abgezogen werden (Datenbankfehler). Bitte Credits manuell anpassen.\n\nFehler: ' + debitError.message);
        } else {
          console.log('✅ VbAdminDashboard: Compensating debit order inserted — credit NOT refunded.');
        }
      } else if (wasCreditUsed && refundCredit) {
        console.log('✅ VbAdminDashboard: Credit will be auto-refunded (used count drops naturally).');
      } else {
        console.log('ℹ️ VbAdminDashboard: Case was not credit-used (status =', caseRow.status, ') — no refund needed.');
      }

      setCaseToDelete(null);
      setRefundCredit(true);
      console.log('🔄 VbAdminDashboard: Triggering fetchAll() to refresh dashboard...');
      await fetchAll();
      console.log('✅ VbAdminDashboard: handleDeleteCase DONE');
    } catch (err) {
      console.error('❌ VbAdminDashboard: Error deleting case study request:', err);
      alert('Fehler beim Löschen der Anfrage: ' + (err instanceof Error ? err.message : 'Unbekannt'));
    } finally {
      setDeletingCase(false);
    }
  };

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('vb_admin_dashboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vb_case_study_requests' },
        () => setRefreshKey(k => k + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vb_orders' },
        () => setRefreshKey(k => k + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCases = cases.filter(c => legalAreaFilter === 'all' || c.legal_area === legalAreaFilter);

  const columnCases = (colId: string): VbCaseRow[] => {
    if (colId === 'completed') {
      return filteredCases.filter(c => c.status === 'completed' || (c.status === 'corrected' && c.video_correction_url));
    }
    return filteredCases.filter(c => caseColumn(c) === colId);
  };

  // A case is considered "done" when it is completed OR corrected with a video
  // correction URL — this mirrors the caseColumn() logic so the stat cards stay
  // consistent with what is shown in the "Abgeschlossen" board column.
  const isCaseDone = (c: VbCaseRow): boolean =>
    c.status === 'completed' || (c.status === 'corrected' && !!c.video_correction_url);

  // Summary stats
  const totalOpen = filteredCases.filter(c => !isCaseDone(c)).length;
  const totalCompleted = filteredCases.filter(c => isCaseDone(c)).length;
  const unassignedOpen = filteredCases.filter(c => !c.assigned_dozent_id && !isCaseDone(c)).length;
  const totalRemainingCredits = teilnehmer.reduce((sum, t) => sum + t.remainingCredits, 0);
  console.log('📊 VbAdminDashboard: Stats computed:', { totalOpen, totalCompleted, unassignedOpen, casesCount: cases.length, filteredCount: filteredCases.length, legalAreaFilter });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Klausurenbesprechung – Admin-Übersicht</h1>
            <p className="text-sm text-gray-500">Dozenten, Teilnehmer und alle aktuellen Fälle mit Zuständigkeiten und Credits</p>
          </div>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Aktualisieren
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Offene Fälle" value={totalOpen} icon={<ClipboardList className="w-5 h-5" />} accent="text-blue-600 bg-blue-50" />
        <StatCard label="Ohne Zuständigkeit" value={unassignedOpen} icon={<AlertTriangle className="w-5 h-5" />} accent="text-orange-600 bg-orange-50" />
        <StatCard label="Abgeschlossen" value={totalCompleted} icon={<CheckCircle2 className="w-5 h-5" />} accent="text-green-600 bg-green-50" />
        <StatCard label="Verfügbare Credits (gesamt)" value={totalRemainingCredits} icon={<Package className="w-5 h-5" />} accent="text-primary bg-primary/10" />
      </div>

      {/* Pending absence requests (short-notice) */}
      {absenceRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 border-l-4 border-orange-400">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">Offene Abwesenheitsanfragen</h2>
            <span className="ml-1 text-gray-400 text-sm">({absenceRequests.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Dozent</th>
                  <th className="py-2 pr-3 font-medium">Zeitraum</th>
                  <th className="py-2 pr-3 font-medium">Grund</th>
                  <th className="py-2 pr-3 font-medium text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {absenceRequests.map(r => {
                  const dateRange = r.start_date === r.end_date
                    ? r.start_date
                    : `${r.start_date} – ${r.end_date}`;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">{r.dozent_name}</div>
                        {r.dozent_email && <div className="text-xs text-gray-500">{r.dozent_email}</div>}
                      </td>
                      <td className="py-2 pr-3 text-gray-700">{dateRange}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.reason || <span className="text-gray-400">–</span>}</td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleAbsenceRequest(r, 'approved')}
                            disabled={processingRequestId === r.id}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-60"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Genehmigen
                          </button>
                          <button
                            onClick={() => handleAbsenceRequest(r, 'rejected')}
                            disabled={processingRequestId === r.id}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-60"
                          >
                            <X className="w-3 h-3" /> Ablehnen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dozenten & Teilnehmer side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Dozenten */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Dozenten</h2>
            <span className="ml-1 text-gray-400 text-sm">({dozenten.length})</span>
          </div>
          {dozenten.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Keine Klausurenbesprechung-Dozenten gefunden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">Dozent</th>
                    <th className="py-2 pr-3 font-medium">Rechtsgebiete</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium text-right">Offene Fälle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dozenten.map(d => {
                    const onVacation = isCurrentlyOnVacation(d.vacation_start_date, d.vacation_end_date);
                    const unavailable = d.vb_available === false;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-900">{d.full_name || d.email || 'Unbekannt'}</div>
                          {d.full_name && d.email && <div className="text-xs text-gray-500">{d.email}</div>}
                          {d.vb_springer && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Springer</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(d.vb_legal_areas || []).length === 0 ? (
                              <span className="text-xs text-gray-400">–</span>
                            ) : (
                              sortLegalAreas(d.vb_legal_areas || []).map(a => (
                                <span key={a} className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{a}</span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {onVacation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <Clock className="w-3 h-3" /> Urlaub
                            </span>
                          ) : unavailable ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3" /> Nicht verfügbar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3" /> Verfügbar
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium text-gray-900">{d.openCases}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Teilnehmer */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Teilnehmer</h2>
            <span className="ml-1 text-gray-400 text-sm">({teilnehmer.length})</span>
          </div>
          {teilnehmer.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Keine Klausurenbesprechung-Teilnehmer gefunden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">Teilnehmer</th>
                    <th className="py-2 pr-1 font-medium text-center w-8"></th>
                    <th className="py-2 pr-3 font-medium text-right bg-blue-50">Verbleibend</th>
                    <th className="py-2 pr-3 font-medium text-right">Credits gesamt</th>
                    <th className="py-2 pr-3 font-medium text-right">Benutzt</th>
                    <th className="py-2 pr-3 font-medium text-right">Offene Fälle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teilnehmer.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">{t.full_name || t.email || 'Unbekannt'}</div>
                        {t.full_name && t.email && <div className="text-xs text-gray-500">{t.email}</div>}
                      </td>
                      <td className="py-2 pr-1 text-center">
                        <button
                          onClick={() => { setAddCreditsFor(t); setCreditsAmount(String(t.remainingCredits)); }}
                          className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors mx-auto"
                          title="Credits hinzufügen"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-right bg-blue-50">
                        <span className={`font-medium ${t.remainingCredits < 0 ? 'text-red-600' : t.remainingCredits === 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {t.remainingCredits}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700">{t.totalCredits}</td>
                      <td className="py-2 pr-3 text-right text-gray-700">{t.usedCredits}</td>
                      <td className="py-2 pr-3 text-right font-medium text-gray-900">{t.openCases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cases board */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Fälle-Board</h2>
            <span className="ml-1 text-gray-400 text-sm">({filteredCases.length})</span>
          </div>
          {availableLegalAreas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rechtsgebiet:</span>
              <select
                value={legalAreaFilter}
                onChange={e => setLegalAreaFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">Alle Rechtsgebiete</option>
                {availableLegalAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMN_DEFS.map(col => {
            const items = columnCases(col.id);
            return (
              <div key={col.id} className={`rounded-lg border border-gray-200 border-t-4 ${col.accent} bg-gray-50/50 flex flex-col`}>
                <div className="px-3 py-2 border-b border-gray-200 bg-white rounded-t-md">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{col.label}</h3>
                    <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                </div>
                <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-gray-400 text-xs py-4 text-center">Keine Fälle</p>
                  ) : (
                    items.map(c => {
                      const st = STATUS_LABELS[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' };
                      return (
                        <div key={c.id} className="bg-white rounded-md border border-gray-200 p-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 text-sm">Klausur #{c.case_study_number}</h4>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                              <button
                                type="button"
                                onClick={() => setCaseToDelete(c)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-0.5"
                                title="Anfrage löschen"
                                aria-label="Anfrage löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mb-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{c.legal_area}</span>
                            {c.grade !== null && c.grade !== undefined && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{c.grade} Punkte</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 truncate">TN: {displayStudentName(c)}</p>
                          <p className="text-xs text-gray-500 truncate">Schwerpunkt: {c.sub_area}{c.focus_area ? ` · ${c.focus_area}` : ''}</p>
                          {c.admin_focus_tags && c.admin_focus_tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {c.admin_focus_tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-500">Zuständig:</span>
                              <span className={`text-xs font-medium truncate ${c.assigned_dozent_id ? 'text-gray-900' : 'text-orange-600'}`}>
                                {c.dozent?.full_name || c.dozent?.email || 'Niemand'}
                              </span>
                            </div>
                            <div className="mt-2">
                              <SchwerpunktTagsInput
                                caseStudyId={c.id}
                                caseStudyNumber={c.case_study_number}
                                tags={c.admin_focus_tags || []}
                                compact={false}
                                onTagsChanged={(newTags) => {
                                  setCases(prev => prev.map(pc => pc.id === c.id ? { ...pc, admin_focus_tags: newTags } : pc))
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Credits Modal */}
      {addCreditsFor && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setAddCreditsFor(null)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Credits hinzufügen</h3>
                  <button onClick={() => setAddCreditsFor(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teilnehmer</label>
                    <div className="text-sm text-gray-900 font-medium">{addCreditsFor.full_name || addCreditsFor.email}</div>
                    {addCreditsFor.full_name && addCreditsFor.email && (
                      <div className="text-xs text-gray-500">{addCreditsFor.email}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verbleibende Credits</label>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCreditsAmount(String(Math.max(0, (parseInt(creditsAmount || '0', 10) || 0) - 1)))}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0 text-xl font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={creditsAmount}
                        onChange={(e) => setCreditsAmount(e.target.value)}
                        className="w-20 text-center px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-semibold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setCreditsAmount(String((parseInt(creditsAmount || '0', 10) || 0) + 1))}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors flex-shrink-0 text-xl font-bold"
                      >
                        +
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {(() => {
                        const delta = (parseInt(creditsAmount || '0', 10) || 0) - addCreditsFor.remainingCredits;
                        if (delta === 0) return 'Keine Änderung';
                        if (delta > 0) return `+${delta} Credits werden hinzugefügt`;
                        return `${delta} Credits werden abgezogen`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleAddCredits}
                  disabled={!creditsAmount || addingCredits}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {addingCredits ? 'Wird gespeichert...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddCreditsFor(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Case Confirmation Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => { if (!deletingCase) { setCaseToDelete(null); setRefundCredit(true); } }}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Anfrage löschen</h3>
                  </div>
                  <button onClick={() => { if (!deletingCase) { setCaseToDelete(null); setRefundCredit(true); } }} className="text-gray-400 hover:text-gray-600" disabled={deletingCase}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Sind Sie sicher, dass Sie diese Anfrage unwiderruflich löschen möchten?
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <div className="font-medium text-gray-900">Klausur #{caseToDelete.case_study_number}</div>
                    <div className="text-gray-600">Rechtsgebiet: {caseToDelete.legal_area}</div>
                    <div className="text-gray-600">Teilnehmer: {displayStudentName(caseToDelete)}</div>
                    <div className="text-gray-600">Status: {(STATUS_LABELS[caseToDelete.status]?.label) || caseToDelete.status}</div>
                    {caseToDelete.assigned_dozent_id && (
                      <div className="text-gray-600">Zuständig: {caseToDelete.dozent?.full_name || caseToDelete.dozent?.email || 'Unbekannt'}</div>
                    )}
                  </div>
                  <p className="text-xs text-red-600">
                    Alle zugehörigen Daten (Einreichungen, Benachrichtigungen, Bewertungen und hochgeladene Dateien) werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                  {isCaseCreditUsed(caseToDelete) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refundCredit}
                          onChange={(e) => setRefundCredit(e.target.checked)}
                          disabled={deletingCase}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">Credit an Teilnehmer zurückerstatten</span>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {refundCredit
                              ? 'Der für diese Anfrage verbrauchte Credit wird dem Teilnehmerkonto wieder gutgeschrieben.'
                              : 'Der Credit wird NICHT zurückerstattet. Der Teilnehmer verliert den Credit unwiderruflich.'}
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => handleDeleteCase(caseToDelete)}
                  disabled={deletingCase}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {deletingCase ? 'Wird gelöscht...' : 'Endgültig löschen'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCaseToDelete(null); setRefundCredit(true); }}
                  disabled={deletingCase}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- StatCard ----

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; accent: string }> = ({ label, value, icon, accent }) => (
  <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
      <div className="text-xs text-gray-500 truncate">{label}</div>
    </div>
  </div>
);
