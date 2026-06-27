import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { BookOpen, Clock, Download, Edit3, CheckCircle, AlertTriangle, FolderOpen, Upload, X, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { KorrekturModal } from '../shared/korrektur/KorrekturModal'
import { VB_FIELD_CONFIG } from '../shared/korrektur/types'
import type { KorrekturItem, KorrekturSavePayload } from '../shared/korrektur/types'

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
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : null
}

export const VbKorrekturDashboard: React.FC = () => {
  const user = useAuthStore(state => state.user)
  const vbLegalAreas = useAuthStore(state => state.vbLegalAreas)
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

  const handleOpenCorrectionMaterialSelector = async (field: 'solution' | 'schema') => {
    setEditingCorrectionField(field)
    setSelectedCaseForMaterial(null) // Not assigning to a case, just selecting materials
    setSelectedMaterials(new Set())
    
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
        .select('vacation_start_date, vacation_end_date, email_notifications_enabled')
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

      let query = supabase
        .from('vb_case_study_requests')
        .select('*, student:profiles!vb_case_study_requests_profile_id_fkey(first_name,last_name,email)')

      console.log('🔍 VbKorrekturDashboard: Active tab:', activeTab)

      // Filter based on active tab and vacation status
      if (isCurrentlyOnVacation) {
        // On vacation: only show completed cases
        query = query.in('status', ['corrected', 'completed'])
      } else {
        // Active: filter based on tab
        switch (activeTab) {
          case 'requests':
            // Show only requested cases (not materials_ready)
            query = query.eq('status', 'requested')
            break
          case 'materials_sent':
            query = query.eq('status', 'materials_ready')
            break
          case 'submissions':
            query = query.in('status', ['submitted', 'under_review', 'corrected'])
            break
          case 'completed':
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

        // Apply legal area filter if dozent has legal areas and filter is not 'all'
        if (areas.length > 0 && legalAreaFilter !== 'all') {
          query = query.eq('legal_area', legalAreaFilter)
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
      // Fetch all cases for the dozent (regardless of tab) to calculate tab counts
      const { data } = await supabase
        .from('vb_case_study_requests')
        .select('*, student:profiles!vb_case_study_requests_profile_id_fkey(first_name,last_name,email)')
        .eq('assigned_dozent_id', user?.id)
        .order('updated_at', { ascending: false })
      
      setAllCases((data || []) as VbCase[])
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

      console.log('✅ Total materials loaded:', allMaterials.length);
      setTeachingMaterials(allMaterials);
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

      setFolderStructure(allFolders)
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
    const folderMaterials = materialsByFolder[folderId] || []
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
    const folderMaterials = materialsByFolder[folderId] || []
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
        })
        .eq('id', selectedCaseForMaterial.id)
      
      if (error) throw error
      
      // Note: Database trigger automatically creates notification and sends email
      // when status changes to 'materials_ready'. No manual notification needed.
      
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

  // Show only top-level folders (parent_id is null)
  const filteredFolders = folderStructure.filter(f => f.parent_id === null)

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
    const folderMaterials = materialsByFolder[folder.id] || []
    const isExpanded = expandedFolders.has(folder.id)

    // Get subfolders of this folder
    const subFolders = folderStructure.filter(f => f.parent_id === folder.id)

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
            {folderMaterials.length > 0 && folderMaterials.map(material => (
              <button
                key={material.id}
                onClick={() => toggleMaterialSelection(material.id)}
                className={`w-full text-left p-3 border rounded-lg transition-colors flex items-center justify-between group ${
                  selectedMaterials.has(material.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.has(material.id)}
                    onChange={() => toggleMaterialSelection(material.id)}
                    className={`w-4 h-4 text-primary rounded transition-opacity ${
                      selectedMaterials.has(material.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{material.title}</p>
                    <p className="text-xs text-gray-500">{material.file_name}</p>
                  </div>
                </div>
                {selectedMaterials.has(material.id) && (
                  <CheckCircle className="w-4 h-4 text-primary" />
                )}
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
      const { error: reqError } = await supabase
        .from('vb_case_study_requests')
        .update({
          status: isComplete ? 'completed' : 'corrected',
          assigned_dozent_id: user.id,
          video_correction_url: videoUrl,
          written_correction_url: writtenUrl,
          solution_pdf_url: solutionUrl,
          scoring_sheet_url: scoringSheetUrl,
          scoring_schema_url: schemaUrl,
          correction_duration_hours: payload.durationHours ? parseFloat(payload.durationHours) : null,
        })
        .eq('id', selected.id)
      if (reqError) throw reqError

      // 2) Upsert the grade into vb_submissions
      const grade = payload.score ? parseFloat(payload.score) : null
      console.log('💾 Parsed grade:', grade)

      // 3) Notify student if correction is completed
      if (isComplete && selected.status !== 'completed') {
        console.log('📧 Sending completion notification to student')
        const { error: notificationError } = await supabase.functions.invoke('vb-notify-student', {
          body: {
            profile_id: selected.profile_id,
            case_study_id: selected.id,
            case_study_number: selected.case_study_number,
            is_correction_complete: true,
          }
        })

        if (notificationError) {
          console.error('Error creating notification:', notificationError)
        }

        // Also create notification in database for in-app display
        const { error: dbError } = await supabase
          .from('vb_notifications')
          .insert({
            profile_id: selected.profile_id,
            title: 'Korrektur abgeschlossen',
            message: `Die Korrektur für Klausur #${selected.case_study_number} ist abgeschlossen. Eine neue Video-Klausurenkorrektur ist verfügbar.`,
            type: 'success',
            related_case_study_id: selected.id,
          })

        if (dbError) {
          console.error('Error creating notification in database:', dbError)
        }
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
                { id: 'submissions', label: 'Eingereichte Arbeiten', count: allCases.filter(c => c.status === 'submitted' || c.status === 'under_review' || c.status === 'corrected').length },
                { id: 'completed', label: 'Abgeschlossen', count: allCases.filter(c => c.status === 'completed' || (c.status === 'corrected' && c.video_correction_url)).length },
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
                    <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
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
                        {(c.status === 'submitted') && (
                          <button
                            onClick={() => handleClaim(c)}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50"
                          >
                            <Clock className="w-4 h-4" />
                            Übernehmen
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
                        <button
                          onClick={async () => {
                            if (c.status === 'requested') {
                              setSelectedCaseForMaterial(c)
                              setSelectedMaterials(new Set()) // Reset selected materials
                              setExpandedFolders(new Set()) // Reset expanded folders
                              
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

      {showMaterialSelector && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log('❌ Closing material selector (background click)')
              setShowMaterialSelector(false)
              setSelectedCaseForMaterial(null)
              setSelectedMaterials(new Set())
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
                {materialsByFolder['no-folder'] && materialsByFolder['no-folder'].length > 0 && (
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
                        {materialsByFolder['no-folder'].map(material => (
                          <button
                            key={material.id}
                            onClick={() => toggleMaterialSelection(material.id)}
                            className={`w-full text-left p-3 border rounded-lg transition-colors flex items-center justify-between group ${
                              selectedMaterials.has(material.id) 
                                ? 'border-primary bg-primary/5' 
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedMaterials.has(material.id)}
                                onChange={() => toggleMaterialSelection(material.id)}
                                className={`w-4 h-4 text-primary rounded transition-opacity ${
                                  selectedMaterials.has(material.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{material.title}</p>
                                <p className="text-xs text-gray-500">{material.file_name}</p>
                              </div>
                            </div>
                            {selectedMaterials.has(material.id) && (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        ))}
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
