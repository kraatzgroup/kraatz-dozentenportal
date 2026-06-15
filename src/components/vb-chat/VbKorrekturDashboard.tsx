import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { BookOpen, Clock, Download, Edit3, CheckCircle, Filter } from 'lucide-react'
import { KorrekturModal } from '../shared/korrektur/KorrekturModal'
import { VB_FIELD_CONFIG } from '../shared/korrektur/types'
import type { KorrekturItem, KorrekturSavePayload } from '../shared/korrektur/types'

interface VbStudent {
  first_name: string | null
  last_name: string | null
  email: string | null
}

interface VbCase {
  id: string
  profile_id: string
  case_study_number: number
  legal_area: string
  sub_area: string
  focus_area: string | null
  status: string
  submission_url: string | null
  video_correction_url: string | null
  written_correction_url: string | null
  solution_pdf_url: string | null
  scoring_sheet_url: string | null
  scoring_schema_url: string | null
  assigned_dozent_id: string | null
  created_at: string
  updated_at: string
  student?: VbStudent | null
  grade?: number | null
  grade_text?: string | null
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Abgegeben', cls: 'bg-yellow-100 text-yellow-800' },
  under_review: { label: 'In Korrektur', cls: 'bg-blue-100 text-blue-800' },
  corrected: { label: 'Korrigiert', cls: 'bg-green-100 text-green-800' },
  completed: { label: 'Abgeschlossen', cls: 'bg-green-100 text-green-800' },
}

const BUCKET = 'case-studies'

// Convert a public storage URL back into the object path for download.
const storagePathFromUrl = (url: string): string | null => {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : null
}

export const VbKorrekturDashboard: React.FC = () => {
  const user = useAuthStore(state => state.user)
  const [cases, setCases] = useState<VbCase[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [selected, setSelected] = useState<VbCase | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vb_case_study_requests')
        .select('*, student:profiles!vb_case_study_requests_profile_id_fkey(first_name,last_name,email)')
        .in('status', ['submitted', 'under_review', 'corrected', 'completed'])
        .order('updated_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as VbCase[]

      // Attach grades from vb_submissions
      const ids = rows.map(r => r.id)
      if (ids.length > 0) {
        const { data: subs } = await supabase
          .from('vb_submissions')
          .select('case_study_request_id, grade, grade_text')
          .in('case_study_request_id', ids)
        const gradeMap = new Map<string, { grade: number | null; grade_text: string | null }>()
        subs?.forEach(s => gradeMap.set(s.case_study_request_id, { grade: s.grade, grade_text: s.grade_text }))
        rows.forEach(r => {
          const g = gradeMap.get(r.id)
          r.grade = g?.grade ?? null
          r.grade_text = g?.grade_text ?? null
        })
      }

      setCases(rows)
    } catch (err) {
      console.error('Error fetching VB cases for correction:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const studentName = (c: VbCase) => {
    const s = c.student
    if (!s) return 'Unbekannt'
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
    return name || s.email || 'Unbekannt'
  }

  const handleClaim = async (c: VbCase) => {
    if (!user) return
    try {
      await supabase
        .from('vb_case_study_requests')
        .update({ status: 'under_review', assigned_dozent_id: user.id })
        .eq('id', c.id)
      fetchCases()
    } catch (err) {
      console.error('Error claiming VB case:', err)
    }
  }

  const downloadFile = async (url: string, filename: string) => {
    try {
      const path = storagePathFromUrl(url)
      if (!path) {
        window.open(url, '_blank')
        return
      }
      const { data, error } = await supabase.storage.from(BUCKET).download(path)
      if (error) throw error
      const objectUrl = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(objectUrl)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading file:', err)
      alert('Fehler beim Herunterladen der Datei')
    }
  }

  const uploadCorrectionFile = async (file: File, caseId: string, kind: string): Promise<string> => {
    const ext = file.name.split('.').pop()
    const fileName = `${caseId}_${kind}_${Date.now()}.${ext}`
    const filePath = `korrekturen/${caseId}/${fileName}`
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file)
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleSave = async (payload: KorrekturSavePayload) => {
    if (!selected || !user) return
    setIsSaving(true)
    try {
      const writtenUrl = payload.pdfFile
        ? await uploadCorrectionFile(payload.pdfFile, selected.id, 'korrektur')
        : selected.written_correction_url || null
      const scoringSheetUrl = payload.excelFile
        ? await uploadCorrectionFile(payload.excelFile, selected.id, 'bewertung')
        : selected.scoring_sheet_url || null
      const solutionUrl = payload.solutionFile
        ? await uploadCorrectionFile(payload.solutionFile, selected.id, 'loesung')
        : selected.solution_pdf_url || null
      const schemaUrl = payload.schemaFile
        ? await uploadCorrectionFile(payload.schemaFile, selected.id, 'schema')
        : selected.scoring_schema_url || null

      const videoUrl = payload.videoUrl?.trim() || selected.video_correction_url || null

      // 1) Update the case study request with correction artifacts + status
      const { error: reqError } = await supabase
        .from('vb_case_study_requests')
        .update({
          status: 'corrected',
          assigned_dozent_id: user.id,
          video_correction_url: videoUrl,
          written_correction_url: writtenUrl,
          solution_pdf_url: solutionUrl,
          scoring_sheet_url: scoringSheetUrl,
          scoring_schema_url: schemaUrl,
        })
        .eq('id', selected.id)
      if (reqError) throw reqError

      // 2) Upsert the grade into vb_submissions
      const grade = payload.score ? parseFloat(payload.score) : null
      const { data: existing } = await supabase
        .from('vb_submissions')
        .select('id')
        .eq('case_study_request_id', selected.id)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('vb_submissions')
          .update({
            grade,
            grade_text: payload.feedback || null,
            correction_video_url: videoUrl,
            status: 'corrected',
            corrected_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('vb_submissions').insert({
          case_study_request_id: selected.id,
          file_url: selected.submission_url || 'https://placeholder.invalid/submission.pdf',
          file_type: selected.submission_url?.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
          status: 'corrected',
          grade,
          grade_text: payload.feedback || null,
          correction_video_url: videoUrl,
          submitted_at: selected.updated_at,
          corrected_at: new Date().toISOString(),
        })
      }

      // 3) Log correction time to the Tätigkeitsbericht (dozent_hours)
      const duration = payload.durationHours ? parseFloat(payload.durationHours) : 0
      if (duration > 0) {
        const description = `Klausurenbesprechung Korrektur: Klausur #${selected.case_study_number} (${studentName(selected)}) - ${selected.legal_area} - ${payload.score ? payload.score + ' Punkte' : 'ohne Bewertung'}`
        const { data: existingHours } = await supabase
          .from('dozent_hours')
          .select('id')
          .eq('dozent_id', user.id)
          .ilike('description', `Klausurenbesprechung Korrektur: Klausur #${selected.case_study_number} (${studentName(selected)})%`)
          .maybeSingle()
        if (existingHours) {
          await supabase
            .from('dozent_hours')
            .update({ hours: duration, description, category: 'Klausurenbesprechung Korrektur', status: 'pending' })
            .eq('id', existingHours.id)
        } else {
          await supabase.from('dozent_hours').insert({
            dozent_id: user.id,
            date: new Date().toISOString().split('T')[0],
            hours: duration,
            description,
            category: 'Klausurenbesprechung Korrektur',
            status: 'pending',
          })
        }
      }

      setSelected(null)
      fetchCases()
    } catch (err) {
      console.error('Error saving VB correction:', err)
      alert('Fehler beim Speichern der Korrektur')
    } finally {
      setIsSaving(false)
    }
  }

  const toItem = (c: VbCase): KorrekturItem => ({
    id: c.id,
    title: `Klausur #${c.case_study_number} - ${c.legal_area}`,
    subtitle: `${studentName(c)} - ${c.sub_area}${c.focus_area ? ` (${c.focus_area})` : ''}`,
    score: c.grade,
    feedback: c.grade_text,
    correctedFileUrl: c.written_correction_url,
    correctedExcelUrl: c.scoring_sheet_url,
    videoCorrectionUrl: c.video_correction_url,
    solutionPdfUrl: c.solution_pdf_url,
    scoringSchemaUrl: c.scoring_schema_url,
  })

  const filtered = cases.filter(c => {
    if (statusFilter === 'open') return c.status === 'submitted' || c.status === 'under_review'
    if (statusFilter === 'done') return c.status === 'corrected' || c.status === 'completed'
    return true
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Klausuren-Korrektur</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Klausuren ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="open">Offen</option>
                <option value="done">Korrigiert</option>
                <option value="all">Alle</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Keine Klausuren in dieser Ansicht.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => {
                const st = STATUS_LABELS[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' }
                return (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 text-sm sm:text-base">
                            Klausur #{c.case_study_number}
                          </h3>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {c.legal_area}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                          {c.grade !== null && c.grade !== undefined && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {c.grade} Punkte
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{studentName(c)} · {c.sub_area}</p>
                        {c.focus_area && <p className="text-xs text-gray-500">Schwerpunkt: {c.focus_area}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.submission_url && (
                          <button
                            onClick={() => downloadFile(c.submission_url!, `Klausur_${c.case_study_number}_Abgabe.pdf`)}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            <Download className="w-4 h-4" />
                            Abgabe
                          </button>
                        )}
                        {(c.status === 'submitted') && (
                          <button
                            onClick={() => handleClaim(c)}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50"
                          >
                            <Clock className="w-4 h-4" />
                            Übernehmen
                          </button>
                        )}
                        <button
                          onClick={() => setSelected(c)}
                          className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                        >
                          {c.status === 'corrected' || c.status === 'completed' ? (
                            <><Edit3 className="w-4 h-4" />Bearbeiten</>
                          ) : (
                            <><CheckCircle className="w-4 h-4" />Korrigieren</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <KorrekturModal
          item={toItem(selected)}
          config={VB_FIELD_CONFIG}
          isSaving={isSaving}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDownloadFile={downloadFile}
          defaultDurationHours="0.5"
        />
      )}
    </div>
  )
}
