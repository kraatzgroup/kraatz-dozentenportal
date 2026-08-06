import React, { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { BookOpen, Clock, Download, Edit3, CheckCircle, AlertTriangle, FolderOpen, Upload, X, Search, ChevronDown, ChevronRight, Undo2 } from 'lucide-react'
import { KorrekturModal } from '../shared/korrektur/KorrekturModal'
import { VB_FIELD_CONFIG } from '../shared/korrektur/types'
import type { KorrekturItem, KorrekturSavePayload } from '../shared/korrektur/types'
import { SchwerpunktTagsInput } from './SchwerpunktTagsInput'

// DraggableFolder component from DozentenDashboard - exact copy
function DraggableFolder({ folder, isExpanded, onToggle, materialCount, isSelected, onToggleSelection }: {
  folder: MaterialFolder;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  materialCount: number;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    console.log('🔘 Folder clicked:', folder.name, 'id:', folder.id)
    onToggle(folder.id)
  }
  
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleSelection?.()
  }
  
  return (
    <div
      onClick={handleClick}
      className="group relative bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer touch-manipulation border-gray-100 flex items-center gap-3 px-3 py-5"
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleCheckboxClick}
        className={`w-4 h-4 text-primary rounded transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={handleCheckboxClick}
      />
      <div className="text-2xl flex-shrink-0">📁</div>
      <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-primary truncate">
        {folder.name}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </div>
  );
}

interface MaterialFolder {
  id: string
  name: string
  parent_id: string | null
  position: number
  is_active: boolean
}

interface TeachingMaterial {
  id: string
  title: string
  file_url: string
  file_name: string
  folder_id: string
}

interface VbStudent {
  first_name: string | null
  last_name: string | null
  email: string | null
  additional_roles?: string[] | null
}

interface VbCase {
  id: string
  profile_id: string
  case_study_number: number
  legal_area: string
  sub_area: string
  focus_area: string | null
  admin_focus_tags: string[] | null
  status: string
  submission_url: string | null
  video_correction_url: string | null
  written_correction_url: string | null
  correction_duration_hours: number | null
  solution_pdf_url: string | null
  scoring_sheet_url: string | null
  scoring_schema_url: string | null
  assigned_dozent_id: string | null
  case_study_material_url: string | null
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
  // Try case-studies bucket first
  let marker = `/object/public/case-studies/`
  let idx = url.indexOf(marker)
  if (idx >= 0) return url.slice(idx + marker.length)

  // Try masterclass bucket
  marker = `/object/public/masterclass/`
  idx = url.indexOf(marker)
  if (idx >= 0) return url.slice(idx + marker.length)

  return null
}

export const VbKorrekturDashboard: React.FC = () => {
  const user = useAuthStore(state => state.user)
  const vbLegalAreas = useAuthStore(state => state.vbLegalAreas)
  const isAdmin = useAuthStore(state => state.isAdmin)
  const isMaterial = useAuthStore(state => state.isMaterial)
  const canEditTags = isAdmin || isMaterial
  const [cases, setCases] = useState<VbCase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'requests' | 'materials_sent' | 'submissions' | 'completed'>('requests')
  const [selected, setSelected] = useState<VbCase | null>(null)
  const [selectedCaseForMaterial, setSelectedCaseForMaterial] = useState<VbCase | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isOnVacation, setIsOnVacation] = useState(false)
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('all')
  const [dozentLegalAreas, setDozentLegalAreas] = useState<string[]>([])
  const [materialFolders, setMaterialFolders] = useState<MaterialFolder[]>([])
  const [teachingMaterials, setTeachingMaterials] = useState<TeachingMaterial[]>([])
  const [showMaterialSelector, setShowMaterialSelector] = useState(false)
  const [selectedTeachingMaterial, setSelectedTeachingMaterial] = useState<TeachingMaterial | null>(null)
  const [materialSearchTerm, setMaterialSearchTerm] = useState('')
  const [materialSortBy, setMaterialSortBy] = useState<'title' | 'date'>('title')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [folderStructure, setFolderStructure] = useState<MaterialFolder[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [allCases, setAllCases] = useState<VbCase[]>([])
  const [isAssigningMaterial, setIsAssigningMaterial] = useState(false)
  const [editingCorrectionField, setEditingCorrectionField] = useState<'solution' | 'schema' | null>(null)
  const [selectedCorrectionMaterialUrls, setSelectedCorrectionMaterialUrls] = useState<{ solution?: string; schema?: string }>({})
  const [selectedCorrectionMaterialFileNames, setSelectedCorrectionMaterialFileNames] = useState<{ solution?: string; schema?: string }>({})
  const [modalRefreshKey, setModalRefreshKey] = useState(0)
  const [completedPage, setCompletedPage] = useState(1)
  const [completedTotal, setCompletedTotal] = useState(0)
  const [materialSelectorLegalArea, setMaterialSelectorLegalArea] = useState<string | null>(null)
  const [assignedMaterialUrls, setAssignedMaterialUrls] = useState<Set<string>>(new Set())
  const [isSpringerUser, setIsSpringerUser] = useState(false)
  const initialTabSelected = useRef(false)
  const [returnCase, setReturnCase] = useState<VbCase | null>(null)
  const [returnTarget, setReturnTarget] = useState<{ id: string; name: string; available: boolean } | null>(null)
  const [isReturning, setIsReturning] = useState(false)
  const [punkteschemaCase, setPunkteschemaCase] = useState<VbCase | null>(null)
  const [punkteschemaScrollTarget, setPunkteschemaScrollTarget] = useState<string | null>(null)

  // Open the Punkteschema download modal: expand the folder of the assigned
  // Sachverhalt material (incl. ancestors) plus its "Punkteschema" subfolder.
  const handleOpenPunkteschemaModal = async (c: VbCase) => {
    if (teachingMaterials.length === 0) {
      await fetchTeachingMaterials()
    }
    if (folderStructure.length === 0) {
      await fetchFolderStructure()
    }

    const expandedSet = new Set<string>()
    let scrollTarget: string | null = null
    if (c.case_study_material_url) {
      const currentMaterial = teachingMaterials.find(m => m.file_url === c.case_study_material_url)
      if (currentMaterial?.folder_id) {
        expandedSet.add(currentMaterial.folder_id)

        // Expand all ancestor folders
        let currentFolderId: string | null = currentMaterial.folder_id
        while (currentFolderId) {
          const parentFolder = folderStructure.find(f => f.id === currentFolderId)
          if (parentFolder?.parent_id) {
            expandedSet.add(parentFolder.parent_id)
            currentFolderId = parentFolder.parent_id
          } else {
            break
          }
        }

        // Additionally expand the "Punkteschema" subfolder of the material's folder
        const punkteschemaFolder = folderStructure.find(f =>
          f.parent_id === currentMaterial.folder_id &&
          f.name.toLowerCase().includes('punkteschema')
        )
        if (punkteschemaFolder) {
          expandedSet.add(punkteschemaFolder.id)
        }

        // Scroll target: the Punkteschema folder if found, otherwise the material's folder
        scrollTarget = punkteschemaFolder?.id || currentMaterial.folder_id
      }
    }

    setExpandedFolders(expandedSet)
    setPunkteschemaScrollTarget(scrollTarget)
    setPunkteschemaCase(c)
  }

  // Scroll to the target folder once the Punkteschema modal is rendered
  useEffect(() => {
    if (!punkteschemaCase || !punkteschemaScrollTarget) return
    const timer = setTimeout(() => {
      document
        .getElementById(`download-folder-${punkteschemaScrollTarget}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => clearTimeout(timer)
  }, [punkteschemaCase, punkteschemaScrollTarget])

  const handleOpenReturnModal = async (c: VbCase) => {
    setReturnCase(c)
    setReturnTarget(null)
    try {
      console.log('↩️ VbKorrektur: Loading regular dozenten for legal area:', c.legal_area)
      const { data: regulars } = await supabase
        .from('profiles')
        .select('id, full_name, email, vb_available, vacation_start_date, vacation_end_date')
        .eq('role', 'dozent')
        .or('vb_springer.is.null,vb_springer.eq.false')
        .contains('vb_legal_areas', [c.legal_area])
      const today = new Date()
      const withAvailability = (regulars || []).map(r => {
        const vs = r.vacation_start_date ? new Date(r.vacation_start_date) : null
        const ve = r.vacation_end_date ? new Date(r.vacation_end_date) : null
        const onVacation = !!(vs && ve && today >= vs && today <= ve)
        return { id: r.id, name: r.full_name || r.email, available: r.vb_available !== false && !onVacation }
      })
      console.log('↩️ VbKorrektur: Candidates:', withAvailability)
      const target = withAvailability.find(r => r.available) || withAvailability[0] || null
      setReturnTarget(target)
    } catch (err) {
      console.error('❌ VbKorrektur: Error loading return target:', err)
    }
  }

  const handleReturnCase = async () => {
    if (!returnCase || !returnTarget || isReturning) return
    setIsReturning(true)
    try {
      console.log('↩️ VbKorrektur: Returning case', returnCase.id, 'to dozent', returnTarget.id)
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update({ assigned_dozent_id: returnTarget.id })
        .eq('id', returnCase.id)
      if (error) throw error
      // In-app notification is created server-side by the vb-notify-case-returned
      // edge function (service role), so the bell shows it reliably.
      // Email notification to the receiving dozent
      try {
        console.log('📧 VbKorrektur: Invoking vb-notify-case-returned...')
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('vb-notify-case-returned', {
          body: { caseId: returnCase.id, targetDozentId: returnTarget.id }
        })
        if (emailError) {
          console.error('❌ VbKorrektur: Case-returned email failed:', emailError)
        } else {
          console.log('✅ VbKorrektur: Case-returned email result:', emailResult)
        }
      } catch (e) {
        console.error('❌ VbKorrektur: Case-returned email exception:', e)
      }
      console.log('✅ VbKorrektur: Case returned successfully')
      setReturnCase(null)
      setReturnTarget(null)
      fetchCases()
      fetchAllCasesForTabs()
    } catch (err) {
      console.error('❌ VbKorrektur: Error returning case:', err)
    } finally {
      setIsReturning(false)
    }
  }

  const handleOpenCorrectionMaterialSelector = async (field: 'solution' | 'schema') => {
    setEditingCorrectionField(field)
    setSelectedCaseForMaterial(null) // Not assigning to a case, just selecting materials
    setSelectedMaterials(new Set())
    setMaterialSelectorLegalArea(selected?.legal_area || null)
    
    // Only fetch if materials are not already loaded
    if (teachingMaterials.length === 0) {
      await fetchTeachingMaterials()
    }
    if (folderStructure.length === 0) {
      await fetchFolderStructure()
    }
    
    // Find the current case study's assigned material and expand its parent folder
    const expandedSet = new Set<string>()
    if (selected?.case_study_material_url) {
      const currentMaterial = teachingMaterials.find(m => m.file_url === selected.case_study_material_url)
      if (currentMaterial && currentMaterial.folder_id) {
        expandedSet.add(currentMaterial.folder_id)
        
        // Recursively expand parent folders
        let currentFolderId = currentMaterial.folder_id
        while (currentFolderId) {
          const parentFolder = folderStructure.find(f => f.id === currentFolderId)
          if (parentFolder && parentFolder.parent_id) {
            expandedSet.add(parentFolder.parent_id)
            currentFolderId = parentFolder.parent_id
          } else {
            break
          }
        }
      }
    }
    
    setExpandedFolders(expandedSet)
    setShowMaterialSelector(true)
  }

  const fetchAssignedMaterialsForUser = async (profileId: string) => {
    try {
      const { data } = await supabase
        .from('vb_case_study_requests')
        .select('case_study_material_url')
        .eq('profile_id', profileId)
        .not('case_study_material_url', 'is', null)
      
      const urls = new Set(data?.map(c => c.case_study_material_url).filter(Boolean) || [])
      setAssignedMaterialUrls(urls)
    } catch (err) {
      console.error('Error fetching assigned materials:', err)
    }
  }

  // Reset material selection when opening modal for a new case
  useEffect(() => {
    if (selected) {
      setSelectedCorrectionMaterialUrls({})
      setSelectedCorrectionMaterialFileNames({})
    }
  }, [selected?.id])

  const handleClearFile = async (field: 'pdf' | 'excel' | 'solution' | 'schema') => {
    if (!selected) return

    const updateData: Record<string, null> = {}
    switch (field) {
      case 'pdf':
        updateData.written_correction_url = null
        break
      case 'excel':
        updateData.scoring_sheet_url = null
        break
      case 'solution':
        updateData.solution_pdf_url = null
        setSelectedCorrectionMaterialUrls(prev => ({ ...prev, solution: undefined }))
        setSelectedCorrectionMaterialFileNames(prev => ({ ...prev, solution: undefined }))
        break
      case 'schema':
        updateData.scoring_schema_url = null
        setSelectedCorrectionMaterialUrls(prev => ({ ...prev, schema: undefined }))
        setSelectedCorrectionMaterialFileNames(prev => ({ ...prev, schema: undefined }))
        break
    }

    try {
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update(updateData)
        .eq('id', selected.id)

      if (error) throw error

      // Update the selected state immediately to reflect the change
      setSelected(prev => prev ? { ...prev, ...updateData } : null)
      // Force modal re-render
      setModalRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('Error clearing file:', err)
      alert('Fehler beim Löschen der Datei')
    }
  }

  const handleAssignCorrectionMaterial = () => {
    if (!editingCorrectionField) return

    const materials = Array.from(selectedMaterials).map(id =>
      teachingMaterials.find(m => m.id === id)
    ).filter(Boolean) as TeachingMaterial[]

    if (materials.length > 0) {
      const material = materials[0]
      setSelectedCorrectionMaterialUrls(prev => ({
        ...prev,
        [editingCorrectionField]: material.file_url,
      }))
      setSelectedCorrectionMaterialFileNames(prev => ({
        ...prev,
        [editingCorrectionField]: material.file_name,
      }))
    }

    setShowMaterialSelector(false)
    setEditingCorrectionField(null)
    setSelectedMaterials(new Set())
  }

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      console.log('🔍 VbKorrekturDashboard: Fetching cases for user:', user?.id)
      
      // Fetch dozent's vacation status
      const { data: profile } = await supabase
        .from('profiles')
        .select('vacation_start_date, vacation_end_date, email_notifications_enabled, vb_available, vb_springer')
        .eq('id', user?.id)
        .single();

      console.log('🏖️ VbKorrekturDashboard: Profile data:', profile)
      
      // Use vb_legal_areas from authStore if available, otherwise fall back to legal_areas from profile
      const areas: string[] = (vbLegalAreas && vbLegalAreas.length > 0) 
        ? vbLegalAreas 
        : await (async () => {
            const { data: legalProfile } = await supabase
              .from('profiles')
              .select('legal_areas')
              .eq('id', user?.id)
              .single();
            return legalProfile?.legal_areas || [];
          })();
      
      setDozentLegalAreas(areas)
      console.log('📚 VbKorrekturDashboard: Dozent legal areas:', areas)

      // Check if dozent is on vacation
      const today = new Date()
      const vacationStart = profile?.vacation_start_date ? new Date(profile.vacation_start_date) : null
      const vacationEnd = profile?.vacation_end_date ? new Date(profile.vacation_end_date) : null
      const isCurrentlyOnVacation = vacationStart && vacationEnd && today >= vacationStart && today <= vacationEnd
      setIsOnVacation(isCurrentlyOnVacation || profile?.email_notifications_enabled === false)
      console.log('🏖️ VbKorrekturDashboard: Vacation status:', isCurrentlyOnVacation, 'Email notifications:', profile?.email_notifications_enabled)

      // Springer mode: determine which legal areas open (unclaimed) cases are visible for.
      // null = no restriction (regular available dozent)
      const isVbAvailable = profile?.vb_available !== false
      const isSpringer = profile?.vb_springer === true
      setIsSpringerUser(isSpringer)
      let openCaseAreas: string[] | null = null
      if (!isVbAvailable) {
        // Not available: new/open cases go to the Springer, hide them here
        openCaseAreas = []
      } else if (isSpringer) {
        // Springer only sees open cases for areas where NO regular dozent is available
        const { data: regulars } = await supabase
          .from('profiles')
          .select('vb_legal_areas, vb_available, vacation_start_date, vacation_end_date')
          .eq('role', 'dozent')
          .or('vb_springer.is.null,vb_springer.eq.false')
          .not('vb_legal_areas', 'is', null)

        const covered = new Set<string>()
        for (const r of (regulars || [])) {
          if (r.vb_available === false) continue
          const vs = r.vacation_start_date ? new Date(r.vacation_start_date) : null
          const ve = r.vacation_end_date ? new Date(r.vacation_end_date) : null
          if (vs && ve && today >= vs && today <= ve) continue
          for (const a of (r.vb_legal_areas || [])) covered.add(a)
        }
        openCaseAreas = areas.filter(a => !covered.has(a))
        console.log('🤸 VbKorrekturDashboard: Springer mode, uncovered areas:', openCaseAreas)
      }

      let query = supabase
        .from('vb_case_study_requests')
        .select('*, student:profiles!vb_case_study_requests_profile_id_fkey(first_name,last_name,email,additional_roles)')

      console.log('🔍 VbKorrekturDashboard: Active tab:', activeTab)

      // Filter based on active tab and vacation status
      if (isCurrentlyOnVacation) {
        // On vacation: only show completed cases (no legal area filter for old assignments)
        query = query.in('status', ['corrected', 'completed'])
      } else {
        // Active: filter based on tab
        switch (activeTab) {
          case 'requests':
            // Show only requested cases (not materials_ready)
            // Visible: cases assigned to me (always, e.g. returned by springer)
            // OR unassigned open cases in my allowed areas (openCaseAreas restriction)
            query = query.eq('status', 'requested')
            if (openCaseAreas !== null) {
              const areaList = (openCaseAreas.length > 0 ? openCaseAreas : ['__none__']).map(a => `"${a}"`).join(',')
              query = query.or(`assigned_dozent_id.eq.${user?.id},and(assigned_dozent_id.is.null,legal_area.in.(${areaList}))`)
            } else {
              query = query.or(`assigned_dozent_id.is.null,assigned_dozent_id.eq.${user?.id}`)
            }
            if (areas.length > 0 && legalAreaFilter !== 'all') {
              query = query.eq('legal_area', legalAreaFilter)
            }
            break
          case 'materials_sent':
            // Show materials_ready cases
            // Visible: cases assigned to me (always) OR unassigned ones in my allowed areas
            query = query.eq('status', 'materials_ready')
            if (openCaseAreas !== null) {
              const areaList = (openCaseAreas.length > 0 ? openCaseAreas : ['__none__']).map(a => `"${a}"`).join(',')
              query = query.or(`assigned_dozent_id.eq.${user?.id},and(assigned_dozent_id.is.null,legal_area.in.(${areaList}))`)
            } else {
              query = query.or(`assigned_dozent_id.is.null,assigned_dozent_id.eq.${user?.id}`)
            }
            if (areas.length > 0 && legalAreaFilter !== 'all') {
              query = query.eq('legal_area', legalAreaFilter)
            }
            break
          case 'submissions':
            // Show open correction work: submitted, under_review, corrected WITHOUT video.
            // Corrected cases WITH video belong to the 'Abgeschlossen' tab.
            // Must match the tab badge count exactly (same predicate).
            // Ownership: hide cases owned by another dozent (e.g. returned by springer)
            query = query.or('status.eq.submitted,status.eq.under_review,and(status.eq.corrected,video_correction_url.is.null)')
              .or(`assigned_dozent_id.is.null,assigned_dozent_id.eq.${user?.id}`)
            break
          case 'completed':
            // Show completed cases - NO legal area filter for old assignments
            // First get the total count
            const { count } = await supabase
              .from('vb_case_study_requests')
              .select('*', { count: 'exact', head: true })
              .or('status.eq.completed,and(video_correction_url.not.is.null,status.eq.corrected)')
            setCompletedTotal(count || 0)
            // Then get the paginated data
            query = query.or('status.eq.completed,and(video_correction_url.not.is.null,status.eq.corrected)')
              .range((completedPage - 1) * 5, completedPage * 5 - 1)
            break
        }
      }

      const { data, error } = await query.order('updated_at', { ascending: false })

      console.log('📊 VbKorrekturDashboard: Query result:', { data, error })

      if (error) throw error

      const rows = (data || []) as VbCase[]
      console.log('📋 VbKorrekturDashboard: Cases fetched:', rows.length)

      // Attach grades from vb_submissions
      const ids = rows.map(r => r.id)
      if (ids.length > 0) {
        const { data: subs } = await supabase
          .from('vb_submissions')
          .select('case_study_request_id, grade, grade_text')
          .in('case_study_request_id', ids)
        console.log('💾 Fetched submissions:', subs)
        console.log('💾 Case IDs to match:', ids)
        const gradeMap = new Map<string, { grade: number | null; grade_text: string | null }>()
        subs?.forEach(s => {
          console.log('💾 Mapping submission:', s.case_study_request_id, '->', { grade: s.grade, grade_text: s.grade_text })
          gradeMap.set(s.case_study_request_id, { grade: s.grade, grade_text: s.grade_text })
        })
        rows.forEach(r => {
          const g = gradeMap.get(r.id)
          console.log('💾 Looking up grade for case:', r.id, 'found:', g)
          r.grade = g?.grade ?? null
          r.grade_text = g?.grade_text ?? null
        })
        console.log('💾 Cases with grades:', rows.map(r => ({ id: r.id, grade: r.grade, grade_text: r.grade_text })))
      }

      setCases(rows)
    } catch (err) {
      console.error('Error fetching VB cases for correction:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, user?.id, legalAreaFilter, vbLegalAreas, refreshKey])

  const fetchAllCasesForTabs = useCallback(async () => {
    try {
      // Fetch all cases relevant to this dozent (assigned to me OR unassigned open ones)
      // to calculate tab counts using the same visibility rules as the lists
      const { data: profile } = await supabase
        .from('profiles')
        .select('vb_available, vb_springer')
        .eq('id', user?.id)
        .single()
      const areas: string[] = vbLegalAreas || []
      const isVbAvailable = profile?.vb_available !== false
      const isSpringer = profile?.vb_springer === true
      let openCaseAreas: string[] | null = null
      if (!isVbAvailable) {
        openCaseAreas = []
      } else if (isSpringer) {
        const { data: regulars } = await supabase
          .from('profiles')
          .select('vb_legal_areas, vb_available, vacation_start_date, vacation_end_date')
          .eq('role', 'dozent')
          .or('vb_springer.is.null,vb_springer.eq.false')
          .not('vb_legal_areas', 'is', null)
        const today = new Date()
        const covered = new Set<string>()
        for (const r of (regulars || [])) {
          if (r.vb_available === false) continue
          const vs = r.vacation_start_date ? new Date(r.vacation_start_date) : null
          const ve = r.vacation_end_date ? new Date(r.vacation_end_date) : null
          if (vs && ve && today >= vs && today <= ve) continue
          for (const a of (r.vb_legal_areas || [])) covered.add(a)
        }
        openCaseAreas = areas.filter(a => !covered.has(a))
      }

      const { data } = await supabase
        .from('vb_case_study_requests')
        .select('*, student:profiles!vb_case_study_requests_profile_id_fkey(first_name,last_name,email,additional_roles)')
        .or(`assigned_dozent_id.eq.${user?.id},assigned_dozent_id.is.null`)
        .order('updated_at', { ascending: false })

      const rows = (data || []) as VbCase[]
      const visible = rows.filter(c => {
        if (c.assigned_dozent_id === user?.id) return true
        if (c.assigned_dozent_id) return false
        // Unassigned submission-stage cases are visible to everyone (same rule as the list)
        if (c.status === 'submitted' || c.status === 'under_review' || c.status === 'corrected') return true
        // Unassigned open stages (requested/materials_ready): restricted to allowed areas
        if (c.status !== 'requested' && c.status !== 'materials_ready') return false
        if (openCaseAreas === null) return true
        return openCaseAreas.includes(c.legal_area)
      })
      console.log('📊 VbKorrekturDashboard: Tab counts base (visible cases):', visible.length)
      setAllCases(visible)

      // On initial load: jump to the earliest stage with open items
      if (!initialTabSelected.current) {
        initialTabSelected.current = true
        const openRequests = visible.filter(c => c.status === 'requested').length
        const openMaterials = visible.filter(c => c.status === 'materials_ready').length
        const openSubmissions = visible.filter(c => c.status === 'submitted' || c.status === 'under_review' || (c.status === 'corrected' && !c.video_correction_url)).length
        const firstOpenTab = openRequests > 0 ? 'requests' : openMaterials > 0 ? 'materials_sent' : openSubmissions > 0 ? 'submissions' : 'requests'
        console.log('📌 VbKorrekturDashboard: Auto-selecting tab:', firstOpenTab, { openRequests, openMaterials, openSubmissions })
        if (firstOpenTab !== 'requests') setActiveTab(firstOpenTab as any)
      }
    } catch (err) {
      console.error('Error fetching all cases for tabs:', err)
    }
  }, [user?.id, refreshKey])

  const fetchMaterialFolders = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('material_folders')
        .select('*')
        .eq('is_active', true)
        .order('position')
      
      setMaterialFolders(data || [])
    } catch (err) {
      console.error('Error fetching material folders:', err)
    }
  }, [])

  const fetchTeachingMaterials = useCallback(async () => {
    try {
      console.log('🔍 fetchTeachingMaterials called - loading ALL materials with batching')
      
      // Load all materials using batching to handle large datasets
      const allMaterials: TeachingMaterial[] = []
      const batchSize = 1000
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error } = await supabase
          .from('teaching_materials')
          .select('*')
          .eq('is_active', true)
          .order('position')
          .range(offset, offset + batchSize - 1)

        if (error) {
          console.error('❌ Error fetching materials batch:', error)
          break
        }

        if (data && data.length > 0) {
          allMaterials.push(...data)
          console.log(`📦 Fetched batch ${offset}-${offset + data.length - 1}, total: ${allMaterials.length}`)
          offset += batchSize
          hasMore = data.length === batchSize
        } else {
          hasMore = false
        }
      }

      // Deduplicate materials by ID
      const uniqueMaterials = Array.from(
        new Map(allMaterials.map(m => [m.id, m])).values()
      )
      
      if (uniqueMaterials.length !== allMaterials.length) {
        console.warn(`⚠️ Deduplicated materials: ${allMaterials.length} -> ${uniqueMaterials.length}`)
      }

      console.log('✅ Total materials loaded:', uniqueMaterials.length);
      setTeachingMaterials(uniqueMaterials);
    } catch (err) {
      console.error('❌ Error fetching teaching materials:', err)
    }
  }, [])

  const fetchFolderStructure = useCallback(async () => {
    try {
      // Load all folders using batching to handle large datasets
      const allFolders: MaterialFolder[] = []
      const batchSize = 1000
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error } = await supabase
          .from('material_folders')
          .select('*')
          .eq('is_active', true)
          .order('position')
          .range(offset, offset + batchSize - 1)

        if (error) {
          console.error('❌ Error fetching folders batch:', error)
          break
        }

        if (data && data.length > 0) {
          allFolders.push(...data)
          offset += batchSize
          hasMore = data.length === batchSize
        } else {
          hasMore = false
        }
      }

      // Deduplicate folders by ID
      const uniqueFolders = Array.from(
        new Map(allFolders.map(f => [f.id, f])).values()
      )
      
      if (uniqueFolders.length !== allFolders.length) {
        console.warn(`⚠️ Deduplicated folders: ${allFolders.length} -> ${uniqueFolders.length}`)
      }

      setFolderStructure(uniqueFolders)
    } catch (err) {
      console.error('❌ Error fetching folder structure:', err)
    }
  }, [])

  useEffect(() => {
    fetchCases()
    fetchAllCasesForTabs()
    fetchMaterialFolders()
    fetchTeachingMaterials()
    fetchFolderStructure() // Load all folders on mount
  }, [fetchCases, fetchAllCasesForTabs, fetchMaterialFolders, fetchTeachingMaterials, fetchFolderStructure])

  const studentName = (c: VbCase) => {
    const s = c.student
    if (!s) return 'Unbekannt'
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
    return name || s.email || 'Unbekannt'
  }

  const downloadFile = async (url: string, filename: string) => {
    console.log('📥 downloadFile called:', { url, filename })
    try {
      // Detect bucket from URL
      let bucket = BUCKET
      if (url.includes('/masterclass/')) {
        bucket = 'masterclass'
      }
      console.log('📥 Detected bucket:', bucket)

      const path = storagePathFromUrl(url)
      console.log('📥 Extracted storage path:', path)

      if (!path) {
        console.log('📥 No path found, using fetch as fallback')
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch file')
        const blob = await response.blob()
        triggerDownload(blob, filename)
        return
      }

      console.log('📥 Downloading from Supabase storage bucket:', bucket)
      const { data, error } = await supabase.storage.from(bucket).download(path)
      if (error) {
        console.error('❌ Storage download error:', error)
        throw error
      }
      console.log('✅ Storage download successful, triggering download')
      triggerDownload(data, filename)
    } catch (err) {
      console.error('❌ Error downloading file:', err)
      // Final fallback to opening in new tab
      console.log('📥 Final fallback: opening in new tab')
      window.open(url, '_blank')
    }
  }

  const triggerDownload = (blob: Blob, filename: string) => {
    const objectUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()

    // Keep the object URL alive longer
    setTimeout(() => {
      document.body.removeChild(a)
      window.URL.revokeObjectURL(objectUrl)
      console.log('✅ Download cleanup complete')
    }, 1000)
    console.log('✅ Download triggered')
  }

  const uploadCorrectionFile = async (file: File, caseId: string, kind: string): Promise<string> => {
    console.log('📤 uploadCorrectionFile called:', { fileName: file.name, caseId, kind })
    // Keep original filename exactly as uploaded
    const fileName = file.name
    const filePath = `korrekturen/${caseId}/${fileName}`
    console.log('📤 Uploading to path:', filePath)
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file)
    if (error) {
      console.error('❌ Upload error:', error)
      throw error
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    console.log('✅ Upload successful, URL:', data.publicUrl)
    return data.publicUrl
  }

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterials(prev => {
      const newSet = new Set(prev)
      if (newSet.has(materialId)) {
        newSet.delete(materialId)
      } else {
        newSet.add(materialId)
      }
      return newSet
    })
  }

  const selectAllMaterialsInFolder = (folderId: string) => {
    const folderMaterials = getSelectableFolderMaterials(folderId)
    const folderMaterialIds = folderMaterials.map(m => m.id)
    
    setSelectedMaterials(prev => {
      const newSet = new Set(prev)
      const allSelected = folderMaterialIds.every(id => newSet.has(id))
      
      if (allSelected) {
        // Deselect all
        folderMaterialIds.forEach(id => newSet.delete(id))
      } else {
        // Select all
        folderMaterialIds.forEach(id => newSet.add(id))
      }
      return newSet
    })
  }

  const isFolderSelected = (folderId: string) => {
    const folderMaterials = getSelectableFolderMaterials(folderId)
    if (folderMaterials.length === 0) return false
    return folderMaterials.every(m => selectedMaterials.has(m.id))
  }

  const handleAssignMaterials = async (material?: TeachingMaterial) => {
    if (!selectedCaseForMaterial || !user) return
    
    setIsAssigningMaterial(true)
    
    // If a single material is passed, use it; otherwise use selected materials
    const materialsToAssign = material 
      ? [material] 
      : Array.from(selectedMaterials).map(id => 
          teachingMaterials.find(m => m.id === id)
        ).filter(Boolean) as TeachingMaterial[]
    
    // If no materials selected, revert to requested state without notification
    if (materialsToAssign.length === 0) {
      try {
        const { error } = await supabase
          .from('vb_case_study_requests')
          .update({
            status: 'requested',
            case_study_material_url: null,
            pdf_url: null,
          })
          .eq('id', selectedCaseForMaterial.id)
        
        if (error) throw error
        
        setShowMaterialSelector(false)
        setSelectedCaseForMaterial(null)
        setSelectedTeachingMaterial(null)
        setSelectedMaterials(new Set())
        setRefreshKey(prev => prev + 1)
      } catch (err) {
        console.error('Error reverting material assignment:', err)
        alert('Fehler beim Zurücksetzen der Materialien')
      } finally {
        setIsAssigningMaterial(false)
      }
      return
    }

    try {
      // For now, assign the first material (can be enhanced to handle multiple)
      const firstMaterial = materialsToAssign[0]
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update({
          status: 'materials_ready',
          assigned_dozent_id: user.id,
          case_study_material_url: firstMaterial.file_url,
          pdf_url: firstMaterial.file_url,
          case_study_material_file_name: firstMaterial.file_name,
        })
        .eq('id', selectedCaseForMaterial.id)
      
      if (error) throw error

      // Send email notification to student about available material
      if (selectedCaseForMaterial.profile_id) {
        try {
          const { error: notifyError } = await supabase.functions.invoke('vb-notify-student', {
            body: {
              profile_id: selectedCaseForMaterial.profile_id,
              case_study_id: selectedCaseForMaterial.id,
              case_study_number: selectedCaseForMaterial.case_study_number,
              is_material_change: selectedCaseForMaterial.status === 'materials_ready',
            },
          });
          if (notifyError) {
            console.error('Error notifying student about material:', notifyError);
          } else {
            console.log('Student notified about material assignment');
          }
        } catch (notifyErr) {
          console.error('Failed to notify student:', notifyErr);
        }
      }

      setShowMaterialSelector(false)
      setSelectedCaseForMaterial(null)
      setSelectedTeachingMaterial(null)
      setSelectedMaterials(new Set())
      // Trigger refresh to update UI immediately
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('Error assigning materials:', err)
      alert('Fehler beim Zuweisen der Materialien')
    } finally {
      setIsAssigningMaterial(false)
    }
  }

  // Filter and sort teaching materials
  const filteredAndSortedMaterials = teachingMaterials
    .filter(material => 
      material.title.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
      material.file_name?.toLowerCase().includes(materialSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (materialSortBy === 'title') {
        return a.title.localeCompare(b.title)
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  // Group materials by folder
  const materialsByFolder = teachingMaterials.reduce((acc, material) => {
    const folderId = material.folder_id || 'no-folder'
    if (!acc[folderId]) {
      acc[folderId] = []
    }
    acc[folderId].push(material)
    return acc
  }, {} as Record<string, TeachingMaterial[]>)

  // Crashkurs restriction: when assigning a Sachverhalt to a Crashkurs student,
  // only folders containing "Crashkurs" in their name (and their contents) are selectable.
  const isCrashkursMaterialSelection = !editingCorrectionField &&
    ((selectedCaseForMaterial?.student?.additional_roles || []) as string[]).includes('vb_crashkurs')

  let crashkursMaterialFolderIds: Set<string> | null = null
  let crashkursVisibleFolderIds: Set<string> | null = null
  if (isCrashkursMaterialSelection) {
    // Folders whose name contains "Crashkurs"
    const matchedFolders = folderStructure.filter(f => f.name.toLowerCase().includes('crashkurs'))
    crashkursMaterialFolderIds = new Set(matchedFolders.map(f => f.id))

    // Include all descendants of matched folders (materials selectable there too)
    let changed = true
    while (changed) {
      changed = false
      folderStructure.forEach(f => {
        if (f.parent_id && crashkursMaterialFolderIds!.has(f.parent_id) && !crashkursMaterialFolderIds!.has(f.id)) {
          crashkursMaterialFolderIds!.add(f.id)
          changed = true
        }
      })
    }

    // Visible folders = crashkurs folders + their ancestors (for navigation)
    crashkursVisibleFolderIds = new Set(crashkursMaterialFolderIds)
    const foldersById = new Map(folderStructure.map(f => [f.id, f]))
    matchedFolders.forEach(f => {
      let parentId = f.parent_id
      while (parentId && !crashkursVisibleFolderIds!.has(parentId)) {
        crashkursVisibleFolderIds!.add(parentId)
        parentId = foldersById.get(parentId)?.parent_id ?? null
      }
    })
  }

  // Materials of a folder that are actually selectable in the current selector context
  const getSelectableFolderMaterials = (folderId: string): TeachingMaterial[] =>
    crashkursMaterialFolderIds && !crashkursMaterialFolderIds.has(folderId)
      ? []
      : materialsByFolder[folderId] || []

  // Show only top-level folders (parent_id is null), and filter by legal area if set
  const filteredFolders = folderStructure.filter(f => 
    f.parent_id === null && 
    (!materialSelectorLegalArea || f.name === materialSelectorLegalArea) &&
    (!crashkursVisibleFolderIds || crashkursVisibleFolderIds.has(f.id))
  )

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  // Recursive function to render folder hierarchy - using the exact same component as DozentenDashboard
  const renderFolder = (folder: MaterialFolder, level: number = 0) => {
    const folderMaterials = getSelectableFolderMaterials(folder.id)
    const isExpanded = expandedFolders.has(folder.id)

    // Get subfolders of this folder
    const subFolders = folderStructure.filter(f =>
      f.parent_id === folder.id &&
      (!crashkursVisibleFolderIds || crashkursVisibleFolderIds.has(f.id))
    )

    // Check if all materials in this folder are selected
    const folderSelected = isFolderSelected(folder.id)

    return (
      <React.Fragment key={folder.id}>
        <DraggableFolder
          folder={folder}
          isExpanded={isExpanded}
          onToggle={toggleFolder}
          materialCount={folderMaterials.length}
          isSelected={folderSelected}
          onToggleSelection={() => selectAllMaterialsInFolder(folder.id)}
        />
        
        {isExpanded && (
          <div className="ml-8 mt-2 space-y-2">
            {/* Render subfolders */}
            {subFolders.map(subFolder => renderFolder(subFolder, level + 1))}
            
            {/* Render materials */}
            {folderMaterials.length > 0 && folderMaterials.map(material => {
              const isAssigned = assignedMaterialUrls.has(material.file_url)
              return (
                <button
                  key={material.id}
                  onClick={() => !isAssigned && toggleMaterialSelection(material.id)}
                  disabled={isAssigned}
                  className={`w-full text-left p-3 border rounded-lg transition-colors flex items-center justify-between group ${
                    selectedMaterials.has(material.id) 
                      ? 'border-primary bg-primary/5' 
                      : isAssigned
                      ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedMaterials.has(material.id)}
                      onChange={() => !isAssigned && toggleMaterialSelection(material.id)}
                      disabled={isAssigned}
                      className={`w-4 h-4 text-primary rounded transition-opacity ${
                        selectedMaterials.has(material.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{material.title}</p>
                      <p className="text-xs text-gray-500">{material.file_name}</p>
                      {isAssigned && (
                        <p className="text-xs text-orange-600 font-medium mt-1">Bereits zugewiesen</p>
                      )}
                    </div>
                  </div>
                  {selectedMaterials.has(material.id) && !isAssigned && (
                    <CheckCircle className="w-4 h-4 text-primary" />
                  )}
                  {isAssigned && (
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </React.Fragment>
    )
  }

  // Recursive browse-only folder renderer with per-file download buttons
  const renderDownloadFolder = (folder: MaterialFolder): React.ReactNode => {
    const folderMaterials = materialsByFolder[folder.id] || []
    const isExpanded = expandedFolders.has(folder.id)
    const subFolders = folderStructure.filter(f => f.parent_id === folder.id)

    return (
      <React.Fragment key={folder.id}>
        <div
          id={`download-folder-${folder.id}`}
          onClick={() => toggleFolder(folder.id)}
          className="group relative bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer touch-manipulation border-gray-100 flex items-center gap-3 px-3 py-5"
        >
          <div className="text-2xl flex-shrink-0">📁</div>
          <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-primary truncate">
            {folder.name}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="ml-8 mt-2 space-y-2">
            {subFolders.map(subFolder => renderDownloadFolder(subFolder))}
            {folderMaterials.map(material => (
              <button
                key={material.id}
                onClick={() => downloadFile(material.file_url, material.file_name || material.title)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg transition-colors flex items-center justify-between group hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{material.title}</p>
                  <p className="text-xs text-gray-500">{material.file_name}</p>
                </div>
                <Download className="w-4 h-4 text-primary flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </React.Fragment>
    )
  }

  const handleSave = async (payload: KorrekturSavePayload) => {
    if (!selected || !user) return
    setIsSaving(true)
    try {
      console.log('💾 Saving correction - score:', payload.score, 'feedback:', payload.feedback)
      console.log('📁 File payload:', {
        pdfFile: payload.pdfFile?.name,
        excelFile: payload.excelFile?.name,
        solutionFile: payload.solutionFile?.name,
        schemaFile: payload.schemaFile?.name,
      })
      console.log('📁 Existing URLs:', {
        written_correction_url: selected.written_correction_url,
        scoring_sheet_url: selected.scoring_sheet_url,
        solution_pdf_url: selected.solution_pdf_url,
        scoring_schema_url: selected.scoring_schema_url,
      })

      const writtenUrl = payload.pdfFile
        ? await uploadCorrectionFile(payload.pdfFile, selected.id, 'korrektur')
        : selected.written_correction_url || null
      const scoringSheetUrl = payload.excelFile
        ? await uploadCorrectionFile(payload.excelFile, selected.id, 'bewertung')
        : selected.scoring_sheet_url || null
      const solutionUrl = payload.solutionFile
        ? await uploadCorrectionFile(payload.solutionFile, selected.id, 'loesung')
        : selectedCorrectionMaterialUrls.solution || selected.solution_pdf_url || null
      const schemaUrl = payload.schemaFile
        ? await uploadCorrectionFile(payload.schemaFile, selected.id, 'schema')
        : selectedCorrectionMaterialUrls.schema || selected.scoring_schema_url || null

      const videoUrl = payload.videoUrl?.trim() || selected.video_correction_url || null

      // Check if all required fields are filled (score, PDF, Excel)
      const hasScore = !!payload.score
      const hasPdf = !!writtenUrl
      const hasExcel = !!scoringSheetUrl
      const isComplete = hasScore && hasPdf && hasExcel

      console.log('💾 Completion check:', { hasScore, hasPdf, hasExcel, isComplete })

      // 1) Update the case study request with correction artifacts + status
      const updateData = {
        status: isComplete ? 'completed' : 'corrected',
        assigned_dozent_id: user.id,
        video_correction_url: videoUrl,
        written_correction_url: writtenUrl,
        solution_pdf_url: solutionUrl,
        scoring_sheet_url: scoringSheetUrl,
        scoring_schema_url: schemaUrl,
        correction_duration_hours: payload.durationHours ? parseFloat(payload.durationHours) : null,
      }
      console.log('💾 Updating database with:', updateData)
      const { error: reqError } = await supabase
        .from('vb_case_study_requests')
        .update(updateData)
        .eq('id', selected.id)
      if (reqError) throw reqError
      console.log('✅ Database update successful')

      // 2) Upsert the grade into vb_submissions
      const grade = payload.score ? parseFloat(payload.score) : null
      console.log('💾 Parsed grade:', grade)

      // 3) Notify student if correction is completed (status -> corrected or completed)
      const previousStatus = selected.status
      const newStatus = isComplete ? 'completed' : 'corrected'
      if (previousStatus !== 'corrected' && previousStatus !== 'completed') {
        console.log('📧 Sending correction notification to student')
        const { error: notificationError } = await supabase.functions.invoke('vb-notify-student', {
          body: {
            profile_id: selected.profile_id,
            case_study_id: selected.id,
            case_study_number: selected.case_study_number,
            is_correction_complete: isComplete,
          }
        })

        if (notificationError) {
          console.error('Error creating notification:', notificationError)
        }

        // In-app notification is created automatically by the
        // notify_student_on_correction_complete DB trigger (service definer),
        // so no manual insert is needed here.
      }

      const { data: existing } = await supabase
        .from('vb_submissions')
        .select('id')
        .eq('case_study_request_id', selected.id)
        .maybeSingle()

      console.log('💾 Existing submission:', existing)

      if (existing) {
        const { error: updateError } = await supabase
          .from('vb_submissions')
          .update({
            grade,
            grade_text: payload.feedback || null,
            correction_video_url: videoUrl,
            status: 'corrected',
            corrected_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        if (updateError) {
          console.error('❌ Update error:', updateError)
          throw updateError
        }
        console.log('✅ Updated submission successfully')
      } else {
        const { error: insertError } = await supabase.from('vb_submissions').insert({
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
        if (insertError) {
          console.error('❌ Insert error:', insertError)
          throw insertError
        }
        console.log('✅ Inserted submission successfully')
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
      await fetchCases()
      await fetchAllCasesForTabs()
      
      // Reset material selection state
      setSelectedCorrectionMaterialUrls({})
      setSelectedCorrectionMaterialFileNames({})
      
      // If no video was provided and status is corrected, stay on submissions tab
      if (!videoUrl) {
        setActiveTab('submissions')
      }
    } catch (err) {
      console.error('Error saving VB correction:', err)
      alert('Fehler beim Speichern der Korrektur')
    } finally {
      setIsSaving(false)
    }
  }

  const toItem = (c: VbCase): KorrekturItem => {
    console.log('🔄 toItem called with:', { id: c.id, grade: c.grade, grade_text: c.grade_text, video_correction_url: c.video_correction_url, correction_duration_hours: c.correction_duration_hours })
    return {
      id: c.id,
      title: c.sub_area,
      subtitle: `${studentName(c)} - ${c.legal_area}${c.focus_area ? ` (${c.focus_area})` : ''}`,
      score: c.grade,
      feedback: c.grade_text,
      correctedFileUrl: c.written_correction_url,
      correctedExcelUrl: c.scoring_sheet_url,
      videoCorrectionUrl: c.video_correction_url,
      solutionPdfUrl: c.solution_pdf_url,
      scoringSchemaUrl: c.scoring_schema_url,
      correctionDurationHours: c.correction_duration_hours?.toString() || '',
    }
  }

  const filtered = cases // Tab filtering is now done in fetchCases

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

        {/* Vacation Notification Banner */}
        {isOnVacation && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-orange-900">Urlaubsmodus aktiv</h3>
              <p className="text-sm text-orange-700 mt-1">
                Sie befinden sich im Urlaubsmodus. Es werden nur abgeschlossene Klausuren angezeigt.
                Neue Zuweisungen werden während Ihres Urlaubs pausiert.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-4 overflow-x-auto scrollbar-hide">
              {[
                { id: 'requests', label: 'Neue Anfragen', count: allCases.filter(c => c.status === 'requested').length },
                { id: 'materials_sent', label: 'Materialien versendet', count: allCases.filter(c => c.status === 'materials_ready').length },
                { id: 'submissions', label: 'Eingereichte Arbeiten', count: allCases.filter(c => c.status === 'submitted' || c.status === 'under_review' || (c.status === 'corrected' && !c.video_correction_url)).length },
                { id: 'completed', label: 'Abgeschlossen', count: 0 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Legal Area Filter - only show if dozent has legal areas and not on vacation */}
          {!isOnVacation && dozentLegalAreas.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Rechtsgebiet:</span>
              <select
                value={legalAreaFilter}
                onChange={e => setLegalAreaFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">Alle Rechtsgebiete</option>
                {dozentLegalAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === 'requests' && 'Neue Anfragen'}
              {activeTab === 'materials_sent' && 'Materialien versendet'}
              {activeTab === 'submissions' && 'Eingereichte Arbeiten'}
              {activeTab === 'completed' && 'Abgeschlossene Klausuren'}
              <span className="ml-2 text-gray-400">({filtered.length})</span>
            </h2>
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Keine Klausuren in dieser Ansicht.</p>
          ) : (
            <>
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
                          {c.grade !== null && c.grade !== undefined && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {c.grade} Punkte
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{studentName(c)} · {c.sub_area}</p>
                        {c.focus_area && <p className="text-xs text-gray-500">Schwerpunkt: {c.focus_area}</p>}
                        {c.status === 'materials_ready' && c.case_study_material_url && (
                          <p className="text-xs text-gray-500 mt-1">
                            Material: {c.case_study_material_url.split('/').pop()}
                          </p>
                        )}
                        {canEditTags && (
                          <div className="mt-2">
                            <SchwerpunktTagsInput
                              caseStudyId={c.id}
                              caseStudyNumber={c.case_study_number}
                              tags={c.admin_focus_tags || []}
                              onTagsChanged={(newTags) => {
                                setCases(prev => prev.map(pc => pc.id === c.id ? { ...pc, admin_focus_tags: newTags } : pc))
                              }}
                            />
                          </div>
                        )}
                        {!canEditTags && c.admin_focus_tags && c.admin_focus_tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {c.admin_focus_tags.map(tag => (
                              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.submission_url && (
                          <button
                            onClick={() => downloadFile(c.submission_url!, `Klausur_${c.case_study_number}_Abgabe.pdf`)}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            <Download className="w-4 h-4" />
                            Herunterladen
                          </button>
                        )}
                        {activeTab === 'submissions' && (
                          <button
                            onClick={() => handleOpenPunkteschemaModal(c)}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-green-400 text-green-600 rounded-lg hover:bg-green-50"
                          >
                            <Download className="w-4 h-4" />
                            Punkteschema herunterladen
                          </button>
                        )}
                        {(c.status === 'corrected' && !c.video_correction_url) && (
                          <button
                            onClick={() => setSelected(c)}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50"
                          >
                            <Clock className="w-4 h-4" />
                            Video hinzufügen
                          </button>
                        )}
                        {(c.status === 'materials_ready') && (
                          <button
                            onClick={async () => {
                              setSelectedCaseForMaterial(c)
                              setMaterialSelectorLegalArea(c.legal_area)
                              
                              // Fetch materials already assigned to this user
                              await fetchAssignedMaterialsForUser(c.profile_id)
                              
                              // Only fetch if not already loaded
                              if (teachingMaterials.length === 0) {
                                await fetchTeachingMaterials()
                              }
                              if (folderStructure.length === 0) {
                                await fetchFolderStructure()
                              }
                              
                              // Find and select the current material
                              const currentMaterial = teachingMaterials.find(m => m.file_url === c.case_study_material_url)
                              const selectedSet = new Set<string>()
                              const expandedSet = new Set<string>()
                              
                              if (currentMaterial) {
                                selectedSet.add(currentMaterial.id)
                                
                                // Expand the folder containing the material
                                if (currentMaterial.folder_id) {
                                  expandedSet.add(currentMaterial.folder_id)
                                  
                                  // Recursively expand parent folders
                                  let currentFolderId = currentMaterial.folder_id
                                  while (currentFolderId) {
                                    const parentFolder = folderStructure.find(f => f.id === currentFolderId)
                                    if (parentFolder && parentFolder.parent_id) {
                                      expandedSet.add(parentFolder.parent_id)
                                      currentFolderId = parentFolder.parent_id
                                    } else {
                                      break
                                    }
                                  }
                                }
                              }
                              
                              setSelectedMaterials(selectedSet)
                              setExpandedFolders(expandedSet)
                              setShowMaterialSelector(true)
                            }}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            <Edit3 className="w-4 h-4" />
                            Material ändern
                          </button>
                        )}
                        {c.status !== 'materials_ready' && (
                        <button
                          onClick={async () => {
                            if (c.status === 'requested') {
                              setSelectedCaseForMaterial(c)
                              setMaterialSelectorLegalArea(c.legal_area)
                              setSelectedMaterials(new Set()) // Reset selected materials
                              setExpandedFolders(new Set()) // Reset expanded folders
                              
                              // Fetch materials already assigned to this user
                              await fetchAssignedMaterialsForUser(c.profile_id)
                              
                              // Only fetch if not already loaded
                              if (teachingMaterials.length === 0) {
                                await fetchTeachingMaterials()
                              }
                              if (folderStructure.length === 0) {
                                await fetchFolderStructure()
                              }
                              
                              setShowMaterialSelector(true)
                            } else {
                              setSelected(c)
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                        >
                          {c.status === 'requested' ? (
                            <><Upload className="w-4 h-4" />Sachverhalt zuweisen</>
                          ) : c.status === 'corrected' || c.status === 'completed' ? (
                            <><Edit3 className="w-4 h-4" />Bearbeiten</>
                          ) : (
                            <><CheckCircle className="w-4 h-4" />Korrektur hochladen</>
                          )}
                        </button>
                        )}
                        {isSpringerUser && (
                          <button
                            onClick={() => handleOpenReturnModal(c)}
                            title="Fall an den zuständigen Dozenten zurückgeben"
                            className="ml-auto flex items-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Undo2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Zurückgeben</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {activeTab === 'completed' && completedTotal > 5 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                  disabled={completedPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Zurück
                </button>
                <span className="text-sm text-gray-600">
                  Seite {completedPage} von {Math.ceil(completedTotal / 5)}
                </span>
                <button
                  onClick={() => setCompletedPage(p => Math.min(Math.ceil(completedTotal / 5), p + 1))}
                  disabled={completedPage >= Math.ceil(completedTotal / 5)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Weiter
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Return case to responsible dozent modal */}
      {returnCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isReturning && setReturnCase(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center mb-4">
              <Undo2 className="h-6 w-6 text-primary mr-2 flex-shrink-0" />
              <h3 className="text-lg font-medium text-gray-900">Fall zurückgeben?</h3>
            </div>
            <div className="text-sm text-gray-600 space-y-3 mb-6">
              <p>
                <strong>Klausur #{returnCase.case_study_number}</strong> ({returnCase.legal_area}
                {returnCase.sub_area ? ` / ${returnCase.sub_area}` : ''}) wird an den zuständigen Dozenten
                {returnTarget ? <> <strong>{returnTarget.name}</strong></> : ''} zurückgegeben.
              </p>
              <p>
                Alle Zuständigkeiten für diesen Fall gehen an den Dozenten über – der Fall verschwindet aus Ihrer
                Übersicht und der Dozent erhält eine Benachrichtigung.
              </p>
              {returnTarget && !returnTarget.available && (
                <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800">
                  <p className="font-medium">⚠️ Hinweis</p>
                  <p className="mt-1">
                    Alle normalerweise zuständigen Dozenten für das Rechtsgebiet <strong>{returnCase.legal_area}</strong> sind
                    aktuell <strong>nicht verfügbar</strong>. Der Fall bleibt dem Dozenten zugeordnet, wird aber
                    möglicherweise erst bearbeitet, wenn dieser wieder verfügbar ist.
                  </p>
                </div>
              )}
              {returnTarget === null && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-md text-red-800">
                  <p className="font-medium">❌ Kein zuständiger Dozent gefunden</p>
                  <p className="mt-1">
                    Für das Rechtsgebiet <strong>{returnCase.legal_area}</strong> ist kein regulärer Dozent hinterlegt.
                    Der Fall kann nicht zurückgegeben werden.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReturnCase(null)}
                disabled={isReturning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                onClick={handleReturnCase}
                disabled={isReturning || !returnTarget}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-60"
              >
                {isReturning ? 'Wird zurückgegeben…' : 'Ja, Fall zurückgeben'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <KorrekturModal
          key={modalRefreshKey}
          item={toItem(selected)}
          config={VB_FIELD_CONFIG}
          isSaving={isSaving}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDownloadFile={downloadFile}
          defaultDurationHours="0.5"
          onOpenMaterialSelector={handleOpenCorrectionMaterialSelector}
          selectedMaterialUrls={selectedCorrectionMaterialUrls}
          selectedMaterialFileNames={selectedCorrectionMaterialFileNames}
          onClearFile={handleClearFile}
        />
      )}

      {/* Punkteschema download modal (browse-only, per-file download) */}
      {punkteschemaCase && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPunkteschemaCase(null)
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Punkteschema herunterladen</h3>
                <button
                  onClick={() => setPunkteschemaCase(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 rounded-b-lg">
              <div className="space-y-2">
                {folderStructure
                  .filter(f => f.parent_id === null && (!punkteschemaCase.legal_area || f.name === punkteschemaCase.legal_area))
                  .map(folder => renderDownloadFolder(folder))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMaterialSelector && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log('❌ Closing material selector (background click)')
              setShowMaterialSelector(false)
              setSelectedCaseForMaterial(null)
              setSelectedMaterials(new Set())
              setMaterialSelectorLegalArea(null)
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingCorrectionField ? `${editingCorrectionField === 'solution' ? 'Lösungsskizze' : 'Bewertungsschema'} aus Materialien auswählen` : (selectedCaseForMaterial?.status === 'materials_ready' ? 'Material ändern' : 'Sachverhalt auswählen')}
                </h3>
                <div className="flex items-center gap-2">
                  {editingCorrectionField ? (
                    <button
                      onClick={handleAssignCorrectionMaterial}
                      disabled={selectedMaterials.size === 0}
                      className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Auswählen
                    </button>
                  ) : (
                    (selectedMaterials.size > 0 || selectedCaseForMaterial?.status === 'materials_ready') && (
                      <button
                        onClick={() => handleAssignMaterials()}
                        disabled={isAssigningMaterial}
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAssigningMaterial ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Verarbeite...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            {selectedCaseForMaterial?.status === 'materials_ready'
                              ? (selectedMaterials.size > 0 ? `Speichern (${selectedMaterials.size})` : 'Material entfernen')
                              : `Zuweisen (${selectedMaterials.size})`
                            }
                          </>
                        )}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => {
                      console.log('❌ Closing material selector')
                      setShowMaterialSelector(false)
                      setSelectedCaseForMaterial(null)
                      setSelectedMaterials(new Set())
                      setEditingCorrectionField(null)
                      setMaterialSelectorLegalArea(null)
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 rounded-b-lg">
              <div className="space-y-2">
                {/* Show folder hierarchy - only top-level folders initially */}
                {filteredFolders.map(folder => renderFolder(folder))}
                
                {/* Show materials without folder */}
                {!isCrashkursMaterialSelection && materialsByFolder['no-folder'] && materialsByFolder['no-folder'].length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleFolder('no-folder')}
                      className="group relative bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer touch-manipulation border-gray-100 flex items-center gap-3 px-3 py-5 w-full"
                    >
                      <input
                        type="checkbox"
                        checked={isFolderSelected('no-folder')}
                        onChange={() => selectAllMaterialsInFolder('no-folder')}
                        className={`w-4 h-4 text-primary rounded transition-opacity ${
                          isFolderSelected('no-folder') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="text-2xl flex-shrink-0">📁</div>
                      <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-primary truncate">
                        Ohne Ordner
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {expandedFolders.has('no-folder') ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>
                    
                    {expandedFolders.has('no-folder') && (
                      <div className="ml-8 mt-2 space-y-2">
                        {materialsByFolder['no-folder'].map(material => {
                          const isAssigned = assignedMaterialUrls.has(material.file_url)
                          return (
                            <button
                              key={material.id}
                              onClick={() => !isAssigned && toggleMaterialSelection(material.id)}
                              disabled={isAssigned}
                              className={`w-full text-left p-3 border rounded-lg transition-colors flex items-center justify-between group ${
                                selectedMaterials.has(material.id) 
                                  ? 'border-primary bg-primary/5' 
                                  : isAssigned
                                  ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedMaterials.has(material.id)}
                                  onChange={() => !isAssigned && toggleMaterialSelection(material.id)}
                                  disabled={isAssigned}
                                  className={`w-4 h-4 text-primary rounded transition-opacity ${
                                    selectedMaterials.has(material.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{material.title}</p>
                                  <p className="text-xs text-gray-500">{material.file_name}</p>
                                  {isAssigned && (
                                    <p className="text-xs text-orange-600 font-medium mt-1">Bereits zugewiesen</p>
                                  )}
                                </div>
                              </div>
                              {selectedMaterials.has(material.id) && !isAssigned && (
                                <CheckCircle className="w-4 h-4 text-primary" />
                              )}
                              {isAssigned && (
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {filteredAndSortedMaterials.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    {teachingMaterials.length === 0 
                      ? 'Keine Materialien verfügbar' 
                      : 'Keine passenden Materialien'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
