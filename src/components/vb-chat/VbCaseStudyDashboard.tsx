import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { CreditCard, BookOpen, Plus, Download, Upload, FileText, Video, X, Clock, CheckCircle, ChevronDown, ChevronUp, Star, MessageSquare, Table, Edit3, Eye, Trash2, Lightbulb, HelpCircle, Calendar, Mail } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { Link, useSearchParams } from 'react-router-dom'

interface UserProfile {
  account_credits?: number
  first_name?: string
  last_name?: string
  role?: string
}

interface AdditionalMaterial {
  id: string;
  filename: string;
  url: string;
  uploaded_at: string;
  size: number | null;
}

interface CaseStudyRequest {
  id: string;
  profile_id: string;
  case_study_number: number | null;
  study_phase: string;
  legal_area: string;
  sub_area: string;
  focus_area: string;
  status: 'requested' | 'materials_ready' | 'submitted' | 'under_review' | 'corrected' | 'completed';
  pdf_url?: string;
  case_study_material_url?: string;
  case_study_material_file_name?: string;
  additional_materials_url?: string;
  additional_materials?: AdditionalMaterial[];
  submission_url?: string;
  submission_downloaded_at?: string;
  video_correction_url?: string;
  written_correction_url?: string;
  solution_pdf_url?: string;
  scoring_sheet_url?: string;
  scoring_schema_url?: string;
  video_viewed_at?: string;
  pdf_downloaded_at?: string;
  case_study_downloaded_at?: string;
  correction_viewed_at?: string;
  created_at: string;
  updated_at: string;
  assigned_dozent_id?: string;
  user?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  assigned_dozent?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image_url?: string;
  } | null;
  // Grade information from submissions table
  grade?: number | null;
  grade_text?: string | null;
}

interface CaseStudyRating {
  id: string;
  case_study_id: string;
  profile_id: string;
  rating: number;
  feedback?: string;
  created_at: string;
  updated_at: string;
}

interface StudentFeedback {
  id: string;
  case_study_id: string;
  profile_id: string;
  mistakes_learned: string;
  improvements_planned: string;
  review_date: string;
  email_reminder: boolean;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export const VbCaseStudyDashboard: React.FC = () => {
  const user = useAuthStore(state => state.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [caseStudies, setCaseStudies] = useState<CaseStudyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadFiles, setUploadFiles] = useState<Map<string, File>>(new Map())
  const [uploadingCaseId, setUploadingCaseId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [highlightedCaseId, setHighlightedCaseId] = useState<string | null>(null)
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set())
  const [ratings, setRatings] = useState<Map<string, CaseStudyRating>>(new Map())
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [currentRatingCaseId, setCurrentRatingCaseId] = useState<string | null>(null)
  const [tempRating, setTempRating] = useState(0)
  const [tempFeedback, setTempFeedback] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [currentFeedbackCaseId, setCurrentFeedbackCaseId] = useState<string | null>(null)
  const [feedbackForm, setFeedbackForm] = useState({ mistakes: '', improvements: '', reviewDate: '', emailReminder: false })
  const [logoBase64, setLogoBase64] = useState<string>('')
  const [logoSize, setLogoSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/KraatzGroup_Logo_web.png')
        const blob = await response.blob()
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          setLogoBase64(base64)
          const img = new Image()
          img.onload = () => setLogoSize({ width: img.width, height: img.height })
          img.src = base64
        }
        reader.readAsDataURL(blob)
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }
    loadLogo()
  }, [])
  const [studentFeedbacks, setStudentFeedbacks] = useState<Map<string, StudentFeedback>>(new Map())
  const [showPDFPreview, setShowPDFPreview] = useState(false)
  const [currentPDFData, setCurrentPDFData] = useState<string>('')
  const [currentPDFFilename, setCurrentPDFFilename] = useState<string>('')
  const [submissions, setSubmissions] = useState<Map<string, {grade: number | null, grade_text: string | null}>>(new Map())
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('all')
  const [availableCredits, setAvailableCredits] = useState<number>(0)
  const [nextExpiry, setNextExpiry] = useState<{ date: string; credits: number } | null>(null)
  const [allExpiries, setAllExpiries] = useState<{ date: string; credits: number; createdAt: string }[]>([])
  const [showExpiryModal, setShowExpiryModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null)


  // Track Sachverhalt download (persisted; unlocks the upload section)
  const handleCaseStudyDownload = async (caseStudyId: string) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update({ case_study_downloaded_at: now })
        .eq('id', caseStudyId)

      if (!error) {
        setCaseStudies(prevCases =>
          prevCases.map(cs =>
            cs.id === caseStudyId
              ? { ...cs, case_study_downloaded_at: now }
              : cs
          )
        )
      } else {
        console.error('Error tracking case study download:', error)
      }
    } catch (error) {
      console.error('Error tracking case study download:', error)
    }
  }

  // Track PDF download
  const handlePdfDownload = async (caseStudyId: string) => {
    try {
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update({ pdf_downloaded_at: new Date().toISOString() })
        .eq('id', caseStudyId)
      
      if (!error) {
        // Update local state immediately for instant UI feedback
        setCaseStudies(prevCases => 
          prevCases.map(cs => 
            cs.id === caseStudyId 
              ? { ...cs, pdf_downloaded_at: new Date().toISOString() }
              : cs
          )
        )
        // Also refresh from database
        fetchUserData()
      }
    } catch (error) {
      console.error('Error tracking PDF download:', error)
    }
  }

  // Helper to extract actual filename from URL
const getFileNameFromUrl = (url: string): string => {
  if (!url) return 'download'
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    return decodeURIComponent(filename || 'download')
  } catch {
    const filename = url.split('/').pop() || 'download'
    return decodeURIComponent(filename)
  }
}

// Generic download function that handles all file types and buckets
const downloadFile = async (url: string, filename: string, caseStudyId?: string) => {
  console.log('🔄 downloadFile called:', { url, filename, caseStudyId })
  try {
    // Track the download if caseStudyId is provided
    if (caseStudyId) {
      await handlePdfDownload(caseStudyId)
    }

    // Use the provided filename (prioritize it over URL extraction)
    const actualFilename = filename || getFileNameFromUrl(url)
    console.log('📥 Using filename:', actualFilename, '(provided:', !!filename, ')')

    // Detect bucket from URL
    let bucket = 'case-studies'
    if (url.includes('/masterclass/')) {
      bucket = 'masterclass'
    }
    console.log('📥 Detected bucket:', bucket)

    // Extract storage path from URL
    const marker = `/object/public/${bucket}/`
    const idx = url.indexOf(marker)
    const path = idx >= 0 ? url.slice(idx + marker.length) : null

    if (path) {
      console.log('📥 Downloading from Supabase storage:', bucket, path)
      const { data, error } = await supabase.storage.from(bucket).download(path)
      if (error) throw error
      console.log('✅ Storage download successful')
      triggerDownload(data, actualFilename)
    } else {
      console.log('📥 No storage path found, using fetch fallback')
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const blob = await response.blob()
      triggerDownload(blob, actualFilename)
    }
  } catch (error) {
    console.error('❌ Error downloading file:', error)
    // Fallback to direct link if download fails
    console.log('🔄 Fallback: opening in new tab')
    window.open(url, '_blank')
  }
}

  // Download file as PDF (legacy function for backward compatibility)
  const downloadFileAsPDF = async (url: string, filename: string, caseStudyId: string) => {
    return downloadFile(url, filename, caseStudyId)
  }

  const triggerDownload = (blob: Blob, filename: string) => {
    const objectUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      window.URL.revokeObjectURL(objectUrl)
    }, 1000)
    console.log('✅ Download triggered')
  }

  // Toggle case study expansion
  const toggleCaseExpansion = (caseId: string) => {
    setExpandedCases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(caseId)) {
        newSet.delete(caseId)
      } else {
        newSet.add(caseId)
      }
      return newSet
    })
  }

  // Expand case study and scroll to its correction section
  const expandAndScrollToCorrection = useCallback((caseId: string) => {
    setExpandedCases(prev => {
      const next = new Set(prev)
      next.add(caseId)
      return next
    })
    setTimeout(() => {
      const element = document.getElementById(`correction-section-${caseId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }, [])

  // Fetch ratings for completed case studies
  const fetchRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('vb_case_study_ratings')
        .select('*')
        .eq('profile_id', user?.id)

      if (error) throw error

      const ratingsMap = new Map<string, CaseStudyRating>()
      data?.forEach((rating: any) => {
        ratingsMap.set(rating.case_study_id, rating)
      })
      setRatings(ratingsMap)
    } catch (error) {
      console.error('Error fetching ratings:', error)
    }
  }

  // Fetch student feedbacks for completed case studies
  const fetchStudentFeedbacks = async () => {
    try {
      const stored = localStorage.getItem('vb_student_feedbacks')
      if (stored) {
        const parsed = JSON.parse(stored)
        const feedbacksMap = new Map<string, StudentFeedback>()
        Object.entries(parsed).forEach(([key, value]) => {
          const { pdfDataUri, filename, ...rest } = value as any
          feedbacksMap.set(key, rest as StudentFeedback)
        })
        setStudentFeedbacks(feedbacksMap)
        // Rewrite cleaned storage to drop old base64 PDF data and free quota
        const cleaned: Record<string, StudentFeedback> = {}
        feedbacksMap.forEach((value, key) => { cleaned[key] = value })
        try {
          localStorage.setItem('vb_student_feedbacks', JSON.stringify(cleaned))
        } catch (e) {
          console.warn('Could not rewrite cleaned feedbacks to localStorage:', e)
        }
      }
    } catch (error) {
      console.error('Error fetching student feedbacks:', error)
    }
  }

  // Open rating modal
  const openRatingModal = (caseStudyId: string) => {
    const existingRating = ratings.get(caseStudyId)
    setCurrentRatingCaseId(caseStudyId)
    setTempRating(existingRating?.rating || 0)
    setTempFeedback(existingRating?.feedback || '')
    setShowRatingModal(true)
  }

  // Open feedback modal
  const openFeedbackModal = (caseStudyId: string) => {
    const existing = studentFeedbacks.get(caseStudyId)
    setCurrentFeedbackCaseId(caseStudyId)
    setFeedbackForm(
      existing
        ? {
            mistakes: existing.mistakes_learned,
            improvements: existing.improvements_planned,
            reviewDate: existing.review_date,
            emailReminder: existing.email_reminder
          }
        : { mistakes: '', improvements: '', reviewDate: '', emailReminder: false }
    )
    setShowFeedbackModal(true)
  }

  // Close feedback modal
  const closeFeedbackModal = () => {
    setShowFeedbackModal(false)
    setCurrentFeedbackCaseId(null)
    setFeedbackForm({ mistakes: '', improvements: '', reviewDate: '', emailReminder: false })
    // Refresh feedbacks after closing modal
    fetchStudentFeedbacks()
  }

  // Generate PDF from feedback data
  const generateFeedbackPDF = (feedback: StudentFeedback) => {
    const caseStudy = caseStudies.find(cs => cs.id === feedback.case_study_id)
    const doc = new jsPDF('p', 'mm', 'a4')
    const margin = 20
    const pageWidth = 210
    const [r, g, b] = [46, 131, 194]

    // Brand header (light blue so the dark logo is readable)
    doc.setFillColor(215, 229, 243)
    doc.rect(0, 0, pageWidth, 35, 'F')

    // Logo
    if (logoBase64 && logoSize) {
      const logoWidth = 45
      const logoHeight = logoWidth * (logoSize.height / logoSize.width)
      doc.addImage(logoBase64, 'PNG', margin, 6, logoWidth, logoHeight)
    }

    // Title on header
    doc.setTextColor(10, 31, 68)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Feedbackpapier', pageWidth - margin, 20, { align: 'right' })

    // Subtitle / case info
    let y = 48
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    if (caseStudy) {
      doc.text(`${caseStudy.legal_area} - ${caseStudy.sub_area}`, margin, y)
      y += 6
      doc.text(`Schwerpunkt: ${caseStudy.focus_area}`, margin, y)
      y += 6
      doc.text(`Klausur #${caseStudy.case_study_number}`, margin, y)
      y += 6
    }
    if (profile) {
      doc.text(`Student: ${profile.first_name || ''} ${profile.last_name || ''}`, margin, y)
      y += 6
    }

    // Divider
    y += 6
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // Section 1
    doc.setTextColor(r, g, b)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Was habe ich falsch gemacht?', margin, y)
    y += 8
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const mistakes = doc.splitTextToSize(feedback.mistakes_learned.trim(), 170)
    doc.text(mistakes, margin, y)
    y += mistakes.length * 5.5 + 10

    // Section 2
    doc.setTextColor(r, g, b)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Was möchte ich künftig besser machen?', margin, y)
    y += 8
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const improvements = doc.splitTextToSize(feedback.improvements_planned.trim(), 170)
    doc.text(improvements, margin, y)
    y += improvements.length * 5.5 + 10

    // Review date
    if (feedback.review_date) {
      doc.setTextColor(r, g, b)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Wiederholungstermin:', margin, y)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date(feedback.review_date).toLocaleDateString('de-DE'), margin + 50, y)
    }

    // Footer
    doc.setFontSize(9)
    doc.setTextColor(128, 128, 128)
    doc.text(`Feedbackpapier - Kraatz Group · Erstellt am ${new Date().toLocaleDateString('de-DE')}`, margin, 287)

    const filename = `Feedbackpapier_${caseStudy?.legal_area || 'Klausur'}_${caseStudy?.sub_area || ''}.pdf`
    const blob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(blob)
    return { pdfUrl, filename }
  }

  // Save feedback and generate PDF download
  const submitFeedback = () => {
    if (!currentFeedbackCaseId) return
    if (!feedbackForm.mistakes.trim() || !feedbackForm.improvements.trim()) {
      alert('Bitte fülle beide Selbsterkenntnis-Felder aus.')
      return
    }
    const existing = studentFeedbacks.get(currentFeedbackCaseId)
    const newFeedback: StudentFeedback = {
      id: existing?.id || Date.now().toString(),
      case_study_id: currentFeedbackCaseId,
      profile_id: user?.id || '',
      mistakes_learned: feedbackForm.mistakes.trim(),
      improvements_planned: feedbackForm.improvements.trim(),
      review_date: feedbackForm.reviewDate,
      email_reminder: feedbackForm.emailReminder,
      reminder_sent: existing?.reminder_sent || false,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const next = new Map(studentFeedbacks)
    next.set(currentFeedbackCaseId, newFeedback)
    setStudentFeedbacks(next)
    try {
      const storedObj: Record<string, StudentFeedback> = {}
      next.forEach((value, key) => {
        const { pdfDataUri, filename, ...rest } = value as any
        storedObj[key] = rest as StudentFeedback
      })
      localStorage.setItem('vb_student_feedbacks', JSON.stringify(storedObj))
    } catch (err) {
      console.warn('Could not persist feedbacks to localStorage:', err)
    }
    const { pdfUrl, filename } = generateFeedbackPDF(newFeedback)
    if (currentPDFData.startsWith('blob:')) URL.revokeObjectURL(currentPDFData)
    setCurrentPDFData(pdfUrl)
    setCurrentPDFFilename(filename)
    closeFeedbackModal()
    setShowPDFPreview(true)
  }

  // Close PDF preview
  const closePDFPreview = () => {
    if (currentPDFData.startsWith('blob:')) URL.revokeObjectURL(currentPDFData)
    setShowPDFPreview(false)
    setCurrentPDFData('')
    setCurrentPDFFilename('')
    setCurrentFeedbackCaseId(null)
  }

  // Direct download of an existing feedback PDF
  const downloadFeedbackPDF = (caseStudyId: string) => {
    const feedback = studentFeedbacks.get(caseStudyId)
    if (!feedback) {
      alert('Kein Feedbackpapier vorhanden.')
      return
    }
    const { pdfUrl, filename } = generateFeedbackPDF(feedback)
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000)
  }

  // Delete case study (admin only)
  const handleDeleteCaseStudy = async (caseStudyId: string) => {
    if (!window.confirm('Möchtest du diese Klausur wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('vb_case_study_requests')
        .delete()
        .eq('id', caseStudyId)

      if (error) throw error

      // Remove from local state
      setCaseStudies(prev => prev.filter(cs => cs.id !== caseStudyId))
      alert('Klausur erfolgreich gelöscht.')
    } catch (error: any) {
      console.error('Error deleting case study:', error)
      alert('Fehler beim Löschen: ' + (error.message || 'Unbekannter Fehler'))
    }
  }

  // Download PDF from preview
  const handlePDFDownload = () => {
    if (!currentPDFData) {
      alert('Kein PDF zum Herunterladen vorhanden.')
      return
    }
    const link = document.createElement('a')
    link.href = currentPDFData
    link.download = currentPDFFilename || 'Feedbackpapier.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Close rating modal
  const closeRatingModal = () => {
    setShowRatingModal(false)
    setCurrentRatingCaseId(null)
    setTempRating(0)
    setTempFeedback('')
  }

  // Submit rating
  const submitRating = async () => {
    if (!currentRatingCaseId || tempRating === 0) return

    setSubmittingRating(true)
    try {
      const existingRating = ratings.get(currentRatingCaseId)
      
      if (existingRating) {
        // Update existing rating
        const { error } = await supabase
          .from('vb_case_study_ratings')
          .update({
            rating: tempRating,
            feedback: tempFeedback || null
          })
          .eq('id', existingRating.id)

        if (error) throw error
      } else {
        // Create new rating
        const { error } = await supabase
          .from('vb_case_study_ratings')
          .insert({
            case_study_id: currentRatingCaseId,
            profile_id: user?.id,
            rating: tempRating,
            feedback: tempFeedback || null
          })

        if (error) throw error
      }

      // Refresh ratings
      await fetchRatings()
      closeRatingModal()
      
      alert('Bewertung erfolgreich gespeichert!')
    } catch (error) {
      console.error('Error submitting rating:', error)
      alert('Fehler beim Speichern der Bewertung: ' + (error as Error).message)
    } finally {
      setSubmittingRating(false)
    }
  }

  // Determine styling based on access status
  const getCompletedCaseStyle = (caseStudy: CaseStudyRequest) => {
    const hasVideo = !!caseStudy.video_correction_url
    const hasPdf = !!caseStudy.written_correction_url
    const videoViewed = !!caseStudy.video_viewed_at
    const pdfDownloaded = !!caseStudy.pdf_downloaded_at
    const isRated = ratings.has(caseStudy.id)
    
    // Check if it's a new correction (completed recently and not accessed)
    const isNew = !videoViewed && !pdfDownloaded
    
    // Check if fully accessed
    const fullyAccessed = (!hasVideo || videoViewed) && (!hasPdf || pdfDownloaded)
    
    // Check if partially accessed
    const partiallyAccessed = (videoViewed || pdfDownloaded) && !fullyAccessed
    
    // Don't use green highlighting if rated
    if (fullyAccessed && !isRated) {
      return {
        containerClass: "border-[3px] border-[#2e83c2]/40 shadow-sm rounded-lg p-4 bg-gray-50/80 backdrop-blur-sm",
        badgeClass: "px-3 py-1.5 bg-[#2e83c2] text-white text-sm rounded-full font-medium",
        badgeText: "✓ Abgeschlossen",
        showNewBadge: false
      }
    } else if (partiallyAccessed || (fullyAccessed && isRated)) {
      return {
        containerClass: "border-[3px] border-[#2e83c2]/40 shadow-sm rounded-lg p-4 bg-gray-50/80 backdrop-blur-sm",
        badgeClass: "px-3 py-1.5 bg-[#2e83c2] text-white text-sm rounded-full font-medium",
        badgeText: "✓ Abgeschlossen",
        showNewBadge: false
      }
    } else {
      return {
        containerClass: "border-[3px] border-[#2e83c2]/40 shadow-sm rounded-lg p-4 bg-gray-50/80 backdrop-blur-sm",
        badgeClass: "px-3 py-1.5 bg-[#2e83c2] text-white text-sm rounded-full font-medium",
        badgeText: "✓ Abgeschlossen",
        showNewBadge: isNew
      }
    }
  }

  useEffect(() => {
    if (user) {
      fetchUserData()
      fetchRatings()
      fetchStudentFeedbacks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Handle highlight parameter from notifications
  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (highlightId) {
      setHighlightedCaseId(highlightId)
      // Clear the parameter after a delay
      setTimeout(() => {
        setHighlightedCaseId(null)
        setSearchParams({})
      }, 5000)
      
      // Scroll to the highlighted case study
      setTimeout(() => {
        const element = document.getElementById(`case-study-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
    }
  }, [searchParams, setSearchParams])

  // Handle hash parameter for direct video opening from results page
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#case-study-')) {
        const caseStudyId = hash.replace('#case-study-', '')
        const caseStudy = caseStudies.find(cs => cs.id === caseStudyId)
        
        if (caseStudy && caseStudy.video_correction_url) {
          // Highlight the case study
          setHighlightedCaseId(caseStudyId)
          
          // Expand and scroll to the correction section
          expandAndScrollToCorrection(caseStudyId)
          
          // Clear the hash and highlight after opening
          setTimeout(() => {
            window.location.hash = ''
            setHighlightedCaseId(null)
          }, 2000)
        }
      }
    }

    // Check hash on mount and when caseStudies are loaded
    if (caseStudies.length > 0) {
      handleHashChange()
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [caseStudies, expandAndScrollToCorrection]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUserData = async () => {
    try {
      // Fetch user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, role')
        .eq('id', user?.id)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('vb_orders')
        .select('*')
        .eq('profile_id', user?.id)
        .eq('status', 'completed')

      if (ordersError) throw ordersError

      // Filter out expired orders and collect expiration info
      const now = new Date();
      const validOrders = (ordersData || []).filter(order => {
        if (!order.expires_at) return true; // no expiration = valid
        return new Date(order.expires_at) > now;
      });

      // Calculate total purchased credits from non-expired orders only
      const totalPurchasedCredits = validOrders.reduce((sum, order) => {
        return sum + (order.case_study_count || 0)
      }, 0) || 0

      // Find expiring valid orders with credits (sorted by expiry date)
      const sortedByExpiry = validOrders
        .filter(o => o.expires_at && (o.case_study_count || 0) > 0)
        .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());

      // Fetch case studies with dozent information
      const { data: caseStudyData, error: caseStudyError } = await supabase
        .from('vb_case_study_requests')
        .select('*')
        .eq('profile_id', user?.id)
        .order('updated_at', { ascending: false })

      if (caseStudyError) throw caseStudyError
      setCaseStudies(
        (caseStudyData || []).map((cs, idx) => ({
          ...cs,
          case_study_number: cs.case_study_number ?? idx + 1
        }))
      )

      // Every requested Sachverhalt consumes 1 credit immediately (any status)
      const usedCredits = caseStudyData?.length || 0

      // Set available credits to remaining (total - used)
      setAvailableCredits(totalPurchasedCredits - usedCredits)

      // Allocate used credits FIFO (oldest expiry first) to find remaining per order
      let remainingToDeduct = usedCredits;
      const ordersWithRemaining: { date: string; credits: number; createdAt: string }[] = [];
      for (const o of sortedByExpiry) {
        const orderCredits = o.case_study_count || 0;
        const remaining = Math.max(0, orderCredits - remainingToDeduct);
        remainingToDeduct = Math.max(0, remainingToDeduct - orderCredits);
        if (remaining > 0) {
          ordersWithRemaining.push({
            date: o.expires_at,
            credits: remaining,
            createdAt: o.created_at,
          });
        }
      }
      // Merge orders with the same expiry date
      const merged: { date: string; credits: number; createdAt: string }[] = [];
      for (const item of ordersWithRemaining) {
        const existing = merged.find(m => new Date(m.date).toDateString() === new Date(item.date).toDateString());
        if (existing) {
          existing.credits += item.credits;
        } else {
          merged.push({ ...item });
        }
      }
      const nextExpiry = merged.length > 0
        ? { date: merged[0].date, credits: merged[0].credits }
        : null;
      setNextExpiry(nextExpiry)
      setAllExpiries(merged)

      // Fetch submissions with grades
      if (caseStudyData && caseStudyData.length > 0) {
        const caseStudyIds = caseStudyData.map(cs => cs.id)
        const { data: submissionData, error: submissionError } = await supabase
          .from('vb_submissions')
          .select('case_study_request_id, grade, grade_text')
          .in('case_study_request_id', caseStudyIds)

        if (submissionError) {
          console.error('Error fetching submissions:', submissionError)
        } else {
          const submissionsMap = new Map()
          submissionData?.forEach(submission => {
            submissionsMap.set(submission.case_study_request_id, {
              grade: submission.grade,
              grade_text: submission.grade_text
            })
          })
          setSubmissions(submissionsMap)
        }
      }

    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE')
  }

  const handleDragOver = (e: React.DragEvent, caseStudyId: string) => {
    e.preventDefault()
    setDragOver(caseStudyId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(null)
  }

  const handleDrop = (e: React.DragEvent, caseStudyId: string) => {
    e.preventDefault()
    setDragOver(null)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type === 'application/pdf' || 
          file.type === 'application/msword' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setUploadFiles(prev => new Map(prev).set(caseStudyId, file))
      }
    }
  }

  const handleFileUpload = async (caseStudyId: string, file?: File) => {
    const uploadFile = file || uploadFiles.get(caseStudyId)
    if (!uploadFile) return

    setUploadingCaseId(caseStudyId)
    try {
      console.log('Starting upload for case study:', caseStudyId)
      console.log('File details:', { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type })
      
      const fileName = uploadFile.name
      
      console.log('Uploading to storage with filename:', fileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('case-studies')
        .upload(fileName, uploadFile, { upsert: true })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      console.log('Upload successful:', uploadData)

      const { data: urlData } = supabase.storage
        .from('case-studies')
        .getPublicUrl(fileName)

      console.log('Public URL generated:', urlData.publicUrl)

      const { error: updateError } = await supabase
        .from('vb_case_study_requests')
        .update({ 
          submission_url: urlData.publicUrl,
          status: 'submitted'
        })
        .eq('id', caseStudyId)

      if (updateError) {
        console.error('Database update error:', updateError)
        throw updateError
      }

      console.log('Case study status updated successfully')

      // Find the case study to get details for notifications
      const caseStudy = caseStudies.find(cs => cs.id === caseStudyId)
      console.log('Case study for notification:', caseStudy)
      console.log('Assigned dozent ID:', caseStudy?.assigned_dozent_id)

      // Send email notification to dozent about new submission
      if (caseStudy?.assigned_dozent_id) {
        try {
          const { data: dozent } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', caseStudy.assigned_dozent_id)
            .single();

          if (dozent) {
            const dozentName = [dozent.first_name, dozent.last_name].filter(Boolean).join(' ') || dozent.email;
            const { error: notifyError } = await supabase.functions.invoke('vb-notify-dozent-submission', {
              body: {
                dozentEmail: dozent.email,
                dozentName,
                studentName: profile?.first_name || 'Teilnehmer',
                legalArea: caseStudy.legal_area,
                subArea: caseStudy.sub_area,
                caseStudyId: caseStudy.id,
              },
            });
            if (notifyError) {
              console.error('Error notifying dozent about submission:', notifyError);
            } else {
              console.log('Dozent notified about new submission');
            }
          }
        } catch (notifyErr) {
          console.error('Failed to notify dozent:', notifyErr);
        }
      }
      
      setUploadFiles(prev => { const next = new Map(prev); next.delete(caseStudyId); return next })
      fetchUserData()
    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert(`Upload failed: ${error.message || 'Unknown error occurred'}`)
    } finally {
      setUploadingCaseId(null)
    }
  }

  const availableSlots = availableCredits
  const requestedCases = caseStudies.filter(cs => cs.status === 'requested')
  const materialsReadyCases = caseStudies.filter(cs => cs.status === 'materials_ready')
  const submittedCases = caseStudies.filter(cs => cs.status === 'submitted')
  const completedCases = caseStudies.filter(cs => cs.status === 'corrected' || cs.status === 'completed')
  
  // Apply legal area filter to completed cases
  const filteredCompletedCases = completedCases.filter(cs => 
    legalAreaFilter === 'all' || cs.legal_area === legalAreaFilter
  )
  
  // Separate new and viewed corrections (with filter applied)
  const newCorrections = filteredCompletedCases.filter(cs => !cs.correction_viewed_at)
  const viewedCorrections = filteredCompletedCases.filter(cs => cs.correction_viewed_at)

  // Calculate pagination
  const totalPages = Math.ceil(filteredCompletedCases.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCompletedCases = filteredCompletedCases.slice(startIndex, endIndex)
  
  // Calculate new corrections and viewed corrections based on pagination
  const paginatedNewCorrections = paginatedCompletedCases.filter(cs => 
    !cs.video_viewed_at && !cs.correction_viewed_at
  )
  const paginatedViewedCorrections = paginatedCompletedCases.filter(cs => 
    cs.video_viewed_at || cs.correction_viewed_at
  )
  
  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [legalAreaFilter])

  // Add debug logging to see what data we have
  useEffect(() => {
    console.log('All case studies:', caseStudies)
    console.log('Completed cases:', completedCases)
    console.log('New corrections:', newCorrections)
    console.log('Viewed corrections:', viewedCorrections)
    console.log('Case studies with video_correction_url:', caseStudies.filter(cs => cs.video_correction_url))
    console.log('Case studies with corrected status:', caseStudies.filter(cs => cs.status === 'corrected'))
  }, [caseStudies, completedCases, newCorrections, viewedCorrections])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Willkommen, {profile?.first_name || user?.user_metadata?.first_name || 'Benutzer'}!
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">Hier ist dein persönliches Dashboard für Klausurbearbeitungen.</p>
        </div>

        {/* 0. Neueste verfügbare Korrektur */}
        {newCorrections.length > 0 && (
          <div className="bg-green-50/80 backdrop-blur-sm border-2 border-green-200 rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-green-900">🎉 Neue Korrektur verfügbar!</h2>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-600">{newCorrections.length}</span>
              </div>
            </div>
            {newCorrections.slice(0, 1).map(caseStudy => {
              const style = getCompletedCaseStyle(caseStudy)
              return (
                <div key={caseStudy.id} className={style.containerClass}>
                  <div className="cursor-pointer">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-green-100 text-green-600 text-xs font-semibold px-2 py-1 rounded">#{caseStudy.case_study_number}</span>
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={style.badgeClass}>{style.badgeText}</span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(caseStudy.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-xs sm:text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                    </div>
                  </div>
                  {caseStudy.video_correction_url && (
                    <div className="mt-3">
                      <button
                        onClick={() => expandAndScrollToCorrection(caseStudy.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2e83c2] text-white text-sm rounded-lg hover:bg-[#0a1f44] transition-colors w-full sm:w-auto"
                      >
                        <Video className="w-4 h-4" />
                        Video ansehen
                      </button>
                    </div>
                  )}
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <button
                      onClick={() => openRatingModal(caseStudy.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2e83c2] text-white text-sm rounded-lg hover:bg-[#0a1f44] transition-colors w-full sm:w-auto"
                    >
                      <Star className="w-4 h-4" />
                      Jetzt bewerten
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-800 font-bold mb-2">📚 Deine Unterlagen:</p>
                      <div className="flex flex-col gap-2 max-w-xs md:row-start-3 md:col-start-1">
                        {caseStudy.pdf_url && (
                          <button onClick={() => downloadFileAsPDF(caseStudy.pdf_url!, `Sachverhalt_${caseStudy.case_study_number}.pdf`, caseStudy.id)} className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2 bg-[#2e83c2] hover:bg-[#0a1f44]">
                            <FileText className="w-4 h-4" />
                            <span>Sachverhalt</span>
                          </button>
                        )}
                        {caseStudy.case_study_material_url && (
                          <button onClick={() => downloadFileAsPDF(caseStudy.case_study_material_url!, `Zusatzmaterial_${caseStudy.case_study_number}.pdf`, caseStudy.id)} className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2 bg-[#2e83c2] hover:bg-[#0a1f44]">
                            <FileText className="w-4 h-4" />
                            <span>Zusatzmaterial</span>
                          </button>
                        )}
                        {caseStudy.submission_url && (
                          <a href={caseStudy.submission_url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2 bg-[#2e83c2] hover:bg-[#0a1f44]">
                            <Upload className="w-4 h-4" />
                            <span>Meine Bearbeitung</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div id={`correction-section-${caseStudy.id}`} className="bg-white/80 backdrop-blur-sm p-3 rounded border border-green-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 items-start">
                      <p className="md:col-span-2 text-sm text-green-800 font-bold mb-2">🎓 Deine Korrekturen:</p>
                      {submissions.has(caseStudy.id) && submissions.get(caseStudy.id)?.grade !== null && (
                        <div className="mb-3 p-2 bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded shadow-sm max-w-sm md:row-start-2 md:col-start-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-primary">📊 Deine Note:</span>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-primary">{submissions.get(caseStudy.id)?.grade} Punkte</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {caseStudy.video_correction_url && (
                        <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200 md:col-start-2 md:row-start-2 md:row-span-2">
                          <iframe
                            src={caseStudy.video_correction_url.replace('https://www.loom.com/share/', 'https://www.loom.com/embed/')}
                            className="w-full h-full"
                            allowFullScreen
                            title="Video-Korrektur"
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-2 max-w-xs md:row-start-3 md:col-start-1">
                        {caseStudy.solution_pdf_url && (
                          <button onClick={() => downloadFileAsPDF(caseStudy.solution_pdf_url!, `Loesung_${caseStudy.case_study_number}.pdf`, caseStudy.id)} className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white bg-[#2e83c2] hover:bg-[#0a1f44]">
                            <FileText className="w-4 h-4" />
                            <span>Klausur-Lösung</span>
                          </button>
                        )}
                        {caseStudy.written_correction_url && (
                          <button onClick={() => downloadFileAsPDF(caseStudy.written_correction_url!, `Korrektur_${caseStudy.case_study_number}.pdf`, caseStudy.id)} className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white bg-[#2e83c2] hover:bg-[#0a1f44]">
                            <FileText className="w-4 h-4" />
                            <span>Schriftliche Korrektur</span>
                          </button>
                        )}
                        <button
                          onClick={() => openFeedbackModal(caseStudy.id)}
                          className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white bg-[#2e83c2] hover:bg-[#0a1f44]"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Feedbackpapier erstellen</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50/80 backdrop-blur-sm p-2 rounded shadow-sm">💡 Schaue Dir sowohl die Video-Korrektur, als auch die schriftliche Bewertung Deines Dozenten an, um einen maximalen Mehrwert in der Nachbereitung zu erhalten!</div>
                    <div className="bg-yellow-50/80 backdrop-blur-sm border border-yellow-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          Bewerte Deine Klausurenkorrektur
                        </h4>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">Wie bewertest Du Deine Klausurenkorrektur? Gibt es Kritik/Verbesserungswünsche?</p>
                      <button
                        onClick={() => openRatingModal(caseStudy.id)}
                        className="w-full bg-[#2e83c2] text-white px-3 py-2 rounded-lg text-sm hover:bg-[#0a1f44] transition-colors flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Jetzt bewerten
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 1. Verfügbare Klausuren */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Verfügbare Klausuren</h2>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary">{availableSlots}</span>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-gray-600 text-sm sm:text-base">
              Du hast <span className="font-bold">{availableSlots}</span> verfügbare Klausur-Credits.
            </p>
            {nextExpiry && availableSlots > 0 && (
              <div className="flex items-start gap-2">
                <HelpCircle
                  className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5 cursor-pointer hover:text-orange-700"
                  onClick={() => setShowExpiryModal(true)}
                />
                <p className="text-orange-600 text-xs sm:text-sm">
                  <span className="font-medium">Achtung:</span> {nextExpiry.credits} Credits verfallen am {new Date(nextExpiry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
                </p>
              </div>
            )}
            {availableSlots > 0 && (
              <Link
                to="/klausurenbesprechung/sachverhalt-anfordern"
                className="bg-[#2e83c2] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-[#0a1f44] transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Sachverhalt anfordern</span>
              </Link>
            )}
          </div>
          {availableSlots === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">Keine verfügbaren Credits.</p>
              <Link
                to="/klausurenbesprechung/pakete"
                className="bg-[#2e83c2] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-[#0a1f44] transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>Weitere Klausuren buchen</span>
              </Link>
            </div>
          )}
        </div>

        {/* 2. Sachverhalt angefordert */}
        {requestedCases.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Sachverhalt angefordert</h2>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary">{requestedCases.length}</span>
            </div>
          </div>
          <div className="space-y-3">
              {requestedCases.map((caseStudy, index) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-3 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap">
                          #{index + 1}
                        </span>
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">Schwerpunkt: {caseStudy.focus_area}</p>
                      <p className="text-xs text-gray-500">Angefordert: {formatDate(caseStudy.created_at)}</p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium whitespace-nowrap self-start sm:self-center">
                      Warten auf Dozent
                    </span>
                  </div>
                </div>
              ))}
            </div>
        </div>
        )}

        {/* 3. Sachverhalt verfügbar */}
        {materialsReadyCases.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Sachverhalt verfügbar</h2>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary">{materialsReadyCases.length}</span>
            </div>
          </div>
          <div className="space-y-3">
              {materialsReadyCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border-[3px] border-[#2e83c2]/40 shadow-sm rounded-lg p-3 transition-all duration-1000 backdrop-blur-sm ${
                    highlightedCaseId === caseStudy.id 
                      ? 'bg-blue-100/80 ring-2 ring-blue-300' 
                      : 'bg-blue-50/80'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base break-words">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 break-words">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    {caseStudy.case_study_material_url && (
                      <button
                        onClick={async () => {
                          await handleCaseStudyDownload(caseStudy.id)
                          await downloadFileAsPDF(caseStudy.case_study_material_url!, `Sachverhalt_${caseStudy.case_study_number}.pdf`, caseStudy.id)
                        }}
                        className="text-white px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                        style={{ backgroundColor: '#2e83c2' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                      >
                        <Download className="w-4 h-4" />
                        <span>Sachverhalt</span>
                      </button>
                    )}
                    {/* Show additional materials - support both old URL format and new array format */}
                    {caseStudy.additional_materials && caseStudy.additional_materials.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {caseStudy.additional_materials.map((material, index, materials) => (
                          <a
                            key={material.id}
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#2e83c2] text-white px-3 py-2 rounded-lg text-xs sm:text-sm hover:bg-[#0a1f44] transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                          >
                            <Download className="w-4 h-4" />
                            <span>{materials.length > 1 ? `Zusatzmaterial ${index + 1}` : 'Zusatzmaterial'}</span>
                          </a>
                        ))}
                      </div>
                    ) : caseStudy.additional_materials_url && (
                      <a
                        href={caseStudy.additional_materials_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#2e83c2] text-white px-3 py-2 rounded-lg text-xs sm:text-sm hover:bg-[#0a1f44] transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        <span>Zusatzmaterialien</span>
                      </a>
                    )}
                  </div>
                  {/* Upload Bearbeitung - only visible after the Sachverhalt was downloaded */}
                  {caseStudy.case_study_downloaded_at ? (
                  <div className="space-y-3 mt-4 pt-4 border-t border-blue-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bearbeitung hochladen (PDF oder Word)
                      </label>
                      <div
                        onDragOver={(e) => handleDragOver(e, caseStudy.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, caseStudy.id)}
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          dragOver === caseStudy.id
                            ? 'border-primary bg-blue-50'
                            : uploadFiles.get(caseStudy.id)
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        {uploadFiles.get(caseStudy.id) ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center space-x-2">
                              <FileText className="w-8 h-8 text-green-600" />
                              <div>
                                <p className="text-sm font-medium text-green-800">{uploadFiles.get(caseStudy.id)!.name}</p>
                                <p className="text-xs text-green-600">
                                  {(uploadFiles.get(caseStudy.id)!.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                onClick={() => setUploadFiles(prev => { const next = new Map(prev); next.delete(caseStudy.id); return next })}
                                className="p-1 hover:bg-green-200 rounded-full"
                              >
                                <X className="w-4 h-4 text-green-600" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-12 h-12 text-primary mx-auto" />
                            <div>
                              <p className="text-sm text-gray-600">
                                Datei hier ablegen oder{' '}
                                <label className="text-primary hover:text-primary/80 cursor-pointer font-medium">
                                  durchsuchen
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFiles(prev => new Map(prev).set(caseStudy.id, f)) }}
                                    className="hidden"
                                  />
                                </label>
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                PDF, DOC oder DOCX (max. 50MB)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileUpload(caseStudy.id)}
                      disabled={!uploadFiles.get(caseStudy.id) || uploadingCaseId === caseStudy.id}
                      className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                        uploadFiles.get(caseStudy.id) && uploadingCaseId !== caseStudy.id
                          ? 'bg-[#2e83c2] hover:bg-[#0a1f44] text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        {uploadingCaseId === caseStudy.id 
                          ? 'Wird hochgeladen...' 
                          : 'Bearbeitung einreichen'
                        }
                      </span>
                    </button>
                  </div>
                  ) : (
                  <p className="mt-3 text-xs text-gray-500">
                    💡 Lade zuerst den Sachverhalt herunter – danach kannst Du hier Deine Bearbeitung hochladen.
                  </p>
                  )}
                </div>
              ))}
            </div>
        </div>
        )}

        {/* 4. Eingereichte Bearbeitungen */}
        {submittedCases.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Upload Bearbeitung</h2>
            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary">{submittedCases.length}</span>
            </div>
          </div>
          <div className="space-y-4">
              {/* Submitted cases */}
              {submittedCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-4 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-gray-300 bg-gray-100'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-bold text-gray-900">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          Klausurbearbeitung erfolgreich hochgeladen
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Die Video-Klausurkorrektur steht in 48 Stunden zur Verfügung.
                        </p>
                      </div>
                    </div>
                    {caseStudy.submission_url && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-gray-600 mb-2">
                          Eingereicht: {formatDate(caseStudy.created_at)}
                        </p>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={caseStudy.submission_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <Download className="w-4 h-4" />
                              Datei herunterladen
                            </a>
                            {!caseStudy.submission_downloaded_at && (
                              <>
                                {uploadingCaseId === caseStudy.id ? (
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500" />
                                    Verarbeite...
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingCaseId(caseStudy.id)
                                      editFileInputRef.current?.click()
                                    }}
                                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    Bearbeitung ändern
                                  </button>
                                )}
                                <input
                                  ref={editFileInputRef}
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file && editingCaseId) {
                                      handleFileUpload(editingCaseId, file)
                                      setEditingCaseId(null)
                                    }
                                  }}
                                />
                              </>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 break-all">
                            {caseStudy.submission_url?.split('/').pop()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
        </div>
        )}

        {/* 5. Video-Klausurenkorrektur verfügbar */}
        {completedCases.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Video-Klausurenkorrektur verfügbar</h2>
              <div className="flex items-center space-x-2 sm:hidden">
                <Video className="w-5 h-5 text-primary" />
                <span className="font-bold text-primary">{filteredCompletedCases.length}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Filter:</span>
                <select
                  value={legalAreaFilter}
                  onChange={(e) => setLegalAreaFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Alle Rechtsgebiete</option>
                  <option value="Zivilrecht">Zivilrecht</option>
                  <option value="Strafrecht">Strafrecht</option>
                  <option value="Öffentliches Recht">Öffentliches Recht</option>
                </select>
              </div>
              <div className="hidden sm:flex items-center space-x-2">
                <Video className="w-5 h-5 text-primary" />
                <span className="font-bold text-primary">{filteredCompletedCases.length}</span>
              </div>
            </div>
          </div>
          
          {paginatedCompletedCases.length > 0 ? (
            <>
              {/* Neue Video-Klausurenkorrekturen */}
              {paginatedNewCorrections.length > 0 && (
                <div className="mb-6">
                  <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-primary mr-2" />
                      <div>
                        <h3 className="text-sm font-bold text-blue-800">🎉 Eine neue Klausur-Korrektur ist ab sofort für Dich verfügbar.</h3>
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-md font-bold text-gray-900 mb-3">Neue Video-Klausurenkorrekturen</h3>
                  <div className="space-y-3">
                    {paginatedNewCorrections.map((caseStudy) => {
                      const style = getCompletedCaseStyle(caseStudy)
                      return (
                        <div 
                          key={caseStudy.id} 
                          id={`case-study-${caseStudy.id}`}
                          className={`${style.containerClass} transition-all duration-1000 relative ${
                            highlightedCaseId === caseStudy.id 
                              ? 'ring-4 ring-blue-300 shadow-xl' 
                              : ''
                          }`}
                        >
                          {/* Red notification badge for new corrections */}
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
                            1
                          </div>
                          {/* Case Study Header - Always Visible */}
                          <div 
                            className="cursor-pointer"
                            onClick={() => toggleCaseExpansion(caseStudy.id)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded">
                                  #{caseStudy.case_study_number}
                                </span>
                                <h3 className="font-bold text-gray-900 text-sm sm:text-base">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                                {expandedCases.has(caseStudy.id) ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={style.badgeClass}>
                                  {style.badgeText}
                                </span>
                                {caseStudy.updated_at && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {new Date(caseStudy.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <p className="text-xs sm:text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                              {caseStudy.assigned_dozent && (caseStudy.status === 'corrected' || caseStudy.status === 'completed') && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {caseStudy.assigned_dozent.profile_image_url ? (
                                    <img
                                      src={caseStudy.assigned_dozent.profile_image_url}
                                      alt={`${caseStudy.assigned_dozent.first_name} ${caseStudy.assigned_dozent.last_name}`}
                                      className="w-6 h-6 rounded-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        if (target.nextElementSibling) {
                                          (target.nextElementSibling as HTMLElement).style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div 
                                    className={`w-6 h-6 rounded-full flex items-center justify-center bg-green-100 text-green-600 text-xs font-medium ${
                                      caseStudy.assigned_dozent.profile_image_url ? 'hidden' : ''
                                    }`}
                                    style={{ display: caseStudy.assigned_dozent.profile_image_url ? 'none' : 'flex' }}
                                  >
                                    {caseStudy.assigned_dozent.first_name[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-xs text-gray-600 whitespace-nowrap">
                                    Korrigiert von: {caseStudy.assigned_dozent.first_name} {caseStudy.assigned_dozent.last_name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Video ansehen - Always Visible */}
                          {caseStudy.video_correction_url && (
                            <div className="mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  expandAndScrollToCorrection(caseStudy.id)
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2e83c2] text-white text-sm rounded-lg hover:bg-[#0a1f44] transition-colors w-full sm:w-auto"
                              >
                                <Video className="w-4 h-4" />
                                Video ansehen
                              </button>
                            </div>
                          )}

                          {/* Rating Button - Always Visible */}
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            {ratings.has(caseStudy.id) ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg w-full sm:w-auto">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-4 h-4 ${
                                        star <= (ratings.get(caseStudy.id)?.rating || 0)
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="ml-1">({ratings.get(caseStudy.id)?.rating}/5)</span>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openRatingModal(caseStudy.id)
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2e83c2] text-white text-sm rounded-lg hover:bg-[#0a1f44] transition-colors w-full sm:w-auto"
                              >
                                <Star className="w-4 h-4" />
                                Jetzt bewerten
                              </button>
                            )}
                            {profile?.role === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCaseStudy(caseStudy.id)
                                }}
                                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                                title="Klausur löschen (Admin)"
                              >
                                <Trash2 className="w-4 h-4" />
                                Löschen
                              </button>
                            )}
                          </div>
                          
                          {/* Expandable Details Section */}
                          {expandedCases.has(caseStudy.id) && (
                            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded border border-gray-200 shadow-sm">
                                <p className="text-sm text-gray-800 font-bold mb-2">📚 Deine Unterlagen:</p>
                                <div className="flex flex-col gap-2 max-w-xs md:row-start-3 md:col-start-1">
                                  {caseStudy.case_study_material_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (caseStudy.case_study_material_url) {
                                          handlePdfDownload(caseStudy.id)
                                          downloadFile(caseStudy.case_study_material_url, caseStudy.case_study_material_file_name || '', caseStudy.id)
                                        }
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Sachverhalt</span>
                                      {caseStudy.pdf_downloaded_at && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                  {/* Show additional materials - support both old URL format and new array format */}
                                  {caseStudy.additional_materials && caseStudy.additional_materials.length > 0 ? (
                                    caseStudy.additional_materials.map((material, index) => (
                                      <a
                                        key={material.id}
                                        href={material.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                        style={{ backgroundColor: '#2e83c2' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <FileText className="w-4 h-4" />
                                        <span>{caseStudy.additional_materials && caseStudy.additional_materials.length > 1 ? `Zusatzmaterial ${index + 1}` : 'Zusatzmaterial'}</span>
                                      </a>
                                    ))
                                  ) : caseStudy.additional_materials_url && (
                                    <a
                                      href={caseStudy.additional_materials_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Zusatzmaterial</span>
                                    </a>
                                  )}
                                  {caseStudy.submission_url && (
                                    <a
                                      href={caseStudy.submission_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Upload className="w-4 h-4" />
                                      <span>Meine Bearbeitung</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                              
                              <div id={`correction-section-${caseStudy.id}`} className="bg-white/80 backdrop-blur-sm p-3 rounded border border-green-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 items-start">
                                <p className="md:col-span-2 text-sm text-green-800 font-bold mb-2">🎓 Deine Korrekturen:</p>
                                {/* Grade Display for New Corrections */}
                                {submissions.has(caseStudy.id) && submissions.get(caseStudy.id)?.grade !== null && (
                                  <div className="mb-3 p-2 bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded shadow-sm max-w-sm md:row-start-2 md:col-start-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-primary">📊 Deine Note:</span>
                                      <div className="text-right">
                                        <span className="text-2xl font-bold text-primary">
                                          {submissions.get(caseStudy.id)?.grade} Punkte
                                        </span>
                                        {submissions.get(caseStudy.id)?.grade && (
                                          <div className="text-xs text-primary">
                                            {/* ({getGradeDescription(submissions.get(caseStudy.id)?.grade)}) */}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {submissions.get(caseStudy.id)?.grade_text && (
                                      <div className="mt-2 text-sm text-primary">
                                        <strong>Bewertung:</strong> {submissions.get(caseStudy.id)?.grade_text}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {caseStudy.video_correction_url && (
                                  <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200 md:col-start-2 md:row-start-2 md:row-span-2">
                                    <iframe
                                      src={caseStudy.video_correction_url.replace('https://www.loom.com/share/', 'https://www.loom.com/embed/')}
                                      className="w-full h-full"
                                      allowFullScreen
                                      title="Video-Korrektur"
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col gap-2 max-w-xs md:row-start-3 md:col-start-1">
                                  { (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (caseStudy.solution_pdf_url) {
                                          downloadFileAsPDF(caseStudy.solution_pdf_url, `Loesung_${caseStudy.case_study_number}.pdf`, caseStudy.id)
                                        }
                                      }}
                                      className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${ caseStudy.solution_pdf_url ? "text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed" }`}
                                      style={caseStudy.solution_pdf_url ? { backgroundColor: '#2e83c2' } : {}}
                                      onMouseEnter={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#0a1f44' }}
                                      onMouseLeave={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#2e83c2' }}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Klausur-Lösung</span>
                                    </button>
                                  )}
                                  {caseStudy.scoring_sheet_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (caseStudy.scoring_sheet_url) {
                                          downloadFileAsPDF(caseStudy.scoring_sheet_url, `Korrekturbogen_${caseStudy.case_study_number}.xlsx`, caseStudy.id)
                                        }
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <Table className="w-4 h-4" />
                                      <span>Korrekturbogen</span>
                                    </button>
                                  )}
                                  {caseStudy.written_correction_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePdfDownload(caseStudy.id)
                                        downloadFileAsPDF(caseStudy.written_correction_url!, `Korrektur_${caseStudy.case_study_number}.pdf`, caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Schriftliche Korrektur</span>
                                      {caseStudy.pdf_downloaded_at && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openFeedbackModal(caseStudy.id)
                                    }}
                                    className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                    style={{ backgroundColor: '#2e83c2' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    <span>
                                      {studentFeedbacks.has(caseStudy.id) ? 'Feedbackpapier bearbeiten' : 'Feedbackpapier erstellen'}
                                    </span>
                                    {studentFeedbacks.has(caseStudy.id) && <span className="text-xs">✓</span>}
                                  </button>
                                  {studentFeedbacks.has(caseStudy.id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        downloadFeedbackPDF(caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      title="Feedbackpapier herunterladen"
                                    >
                                      <Download className="w-4 h-4" />
                                      <span>Feedbackpapier herunterladen</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-xs text-gray-500 bg-gray-50/80 backdrop-blur-sm p-2 rounded shadow-sm">
                                💡 Schaue Dir sowohl die Video-Korrektur, als auch die schriftliche Bewertung Deines Dozenten an, um einen maximalen Mehrwert in der Nachbereitung zu erhalten!
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Vergangene Video-Klausurenkorrekturen */}
              {paginatedViewedCorrections.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-md font-bold text-gray-900 mb-3">Vergangene Video-Klausurenkorrekturen</h3>
                  <div className="space-y-3">
                    {paginatedViewedCorrections.map((caseStudy) => {
                      const style = getCompletedCaseStyle(caseStudy)
                      return (
                        <div 
                          key={caseStudy.id} 
                          id={`case-study-${caseStudy.id}`}
                          className={`${style.containerClass} transition-all duration-1000 ${
                            highlightedCaseId === caseStudy.id 
                              ? 'ring-4 ring-blue-300 shadow-xl' 
                              : ''
                          }`}
                        >
                          {/* Case Study Header - Always Visible */}
                          <div 
                            className="cursor-pointer"
                            onClick={() => toggleCaseExpansion(caseStudy.id)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded">
                                  #{caseStudy.case_study_number}
                                </span>
                                <h3 className="font-bold text-gray-900 text-sm sm:text-base">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                                {expandedCases.has(caseStudy.id) ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={style.badgeClass}>
                                  {style.badgeText}
                                </span>
                                {caseStudy.updated_at && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {new Date(caseStudy.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <p className="text-xs sm:text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                              {caseStudy.assigned_dozent && (caseStudy.status === 'corrected' || caseStudy.status === 'completed') && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {caseStudy.assigned_dozent.profile_image_url ? (
                                    <img
                                      src={caseStudy.assigned_dozent.profile_image_url}
                                      alt={`${caseStudy.assigned_dozent.first_name} ${caseStudy.assigned_dozent.last_name}`}
                                      className="w-6 h-6 rounded-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        if (target.nextElementSibling) {
                                          (target.nextElementSibling as HTMLElement).style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div 
                                    className={`w-6 h-6 rounded-full flex items-center justify-center bg-green-100 text-green-600 text-xs font-medium ${
                                      caseStudy.assigned_dozent.profile_image_url ? 'hidden' : ''
                                    }`}
                                    style={{ display: caseStudy.assigned_dozent.profile_image_url ? 'none' : 'flex' }}
                                  >
                                    {caseStudy.assigned_dozent.first_name[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-xs text-gray-600 whitespace-nowrap">
                                    Korrigiert von: {caseStudy.assigned_dozent.first_name} {caseStudy.assigned_dozent.last_name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Video ansehen - Always Visible */}
                          {caseStudy.video_correction_url && (
                            <div className="mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  expandAndScrollToCorrection(caseStudy.id)
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2e83c2] text-white text-sm rounded-lg hover:bg-[#0a1f44] transition-colors w-full sm:w-auto"
                              >
                                <Video className="w-4 h-4" />
                                Video ansehen
                              </button>
                            </div>
                          )}

                          {/* Rating Button - Always Visible */}
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            {ratings.has(caseStudy.id) ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg w-full sm:w-auto">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-4 h-4 ${
                                        star <= (ratings.get(caseStudy.id)?.rating || 0)
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="ml-1">({ratings.get(caseStudy.id)?.rating}/5)</span>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openRatingModal(caseStudy.id)
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2e83c2] text-white text-sm rounded-lg hover:bg-[#0a1f44] transition-colors w-full sm:w-auto"
                              >
                                <Star className="w-4 h-4" />
                                Jetzt bewerten
                              </button>
                            )}
                            {profile?.role === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCaseStudy(caseStudy.id)
                                }}
                                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                                title="Klausur löschen (Admin)"
                              >
                                <Trash2 className="w-4 h-4" />
                                Löschen
                              </button>
                            )}
                          </div>
                          
                          {/* Expandable Details Section */}
                          {expandedCases.has(caseStudy.id) && (
                            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded border border-gray-200 shadow-sm">
                                <p className="text-sm text-gray-800 font-bold mb-2">📚 Deine Unterlagen:</p>
                                <div className="flex flex-col gap-2 max-w-xs md:row-start-3 md:col-start-1">
                                  {caseStudy.case_study_material_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (caseStudy.case_study_material_url) {
                                          handlePdfDownload(caseStudy.id)
                                          downloadFile(caseStudy.case_study_material_url, caseStudy.case_study_material_file_name || '', caseStudy.id)
                                        }
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Sachverhalt</span>
                                      {caseStudy.pdf_downloaded_at && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                  {/* Show additional materials - support both old URL format and new array format */}
                                  {caseStudy.additional_materials && caseStudy.additional_materials.length > 0 ? (
                                    caseStudy.additional_materials.map((material, index) => (
                                      <a
                                        key={material.id}
                                        href={material.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                        style={{ backgroundColor: '#2e83c2' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <FileText className="w-4 h-4" />
                                        <span>{caseStudy.additional_materials && caseStudy.additional_materials.length > 1 ? `Zusatzmaterial ${index + 1}` : 'Zusatzmaterial'}</span>
                                      </a>
                                    ))
                                  ) : caseStudy.additional_materials_url && (
                                    <a
                                      href={caseStudy.additional_materials_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Zusatzmaterial</span>
                                    </a>
                                  )}
                                  {caseStudy.submission_url && (
                                    <a
                                      href={caseStudy.submission_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Upload className="w-4 h-4" />
                                      <span>Meine Bearbeitung</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                              
                              <div id={`correction-section-${caseStudy.id}`} className="bg-white/80 backdrop-blur-sm p-3 rounded border border-green-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 items-start">
                                <p className="md:col-span-2 text-sm text-green-800 font-bold mb-2">🎓 Deine Korrekturen:</p>
                                {/* Grade Display for Viewed Corrections */}
                                {submissions.has(caseStudy.id) && submissions.get(caseStudy.id)?.grade !== null && (
                                  <div className="mb-3 p-2 bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded shadow-sm max-w-sm md:row-start-2 md:col-start-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-primary">📊 Deine Note:</span>
                                      <div className="text-right">
                                        <span className="text-2xl font-bold text-primary">
                                          {submissions.get(caseStudy.id)?.grade} Punkte
                                        </span>
                                        {submissions.get(caseStudy.id)?.grade && (
                                          <div className="text-xs text-primary">
                                            {/* ({getGradeDescription(submissions.get(caseStudy.id)?.grade)}) */}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {submissions.get(caseStudy.id)?.grade_text && (
                                      <div className="mt-2 text-sm text-primary">
                                        <strong>Bewertung:</strong> {submissions.get(caseStudy.id)?.grade_text}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {caseStudy.video_correction_url && (
                                  <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200 md:col-start-2 md:row-start-2 md:row-span-2">
                                    <iframe
                                      src={caseStudy.video_correction_url.replace('https://www.loom.com/share/', 'https://www.loom.com/embed/')}
                                      className="w-full h-full"
                                      allowFullScreen
                                      title="Video-Korrektur"
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col gap-2 max-w-xs md:row-start-3 md:col-start-1">
                                  { (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (caseStudy.solution_pdf_url) {
                                          downloadFileAsPDF(caseStudy.solution_pdf_url, `Loesung_${caseStudy.case_study_number}.pdf`, caseStudy.id)
                                        }
                                      }}
                                      className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${ caseStudy.solution_pdf_url ? "text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed" }`}
                                      style={caseStudy.solution_pdf_url ? { backgroundColor: '#2e83c2' } : {}}
                                      onMouseEnter={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#0a1f44' }}
                                      onMouseLeave={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#2e83c2' }}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Klausur-Lösung</span>
                                    </button>
                                  )}
                                  {caseStudy.scoring_sheet_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (caseStudy.scoring_sheet_url) {
                                          downloadFileAsPDF(caseStudy.scoring_sheet_url, `Korrekturbogen_${caseStudy.case_study_number}.xlsx`, caseStudy.id)
                                        }
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <Table className="w-4 h-4" />
                                      <span>Korrekturbogen</span>
                                    </button>
                                  )}
                                  {caseStudy.written_correction_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePdfDownload(caseStudy.id)
                                        downloadFileAsPDF(caseStudy.written_correction_url!, `Korrektur_${caseStudy.case_study_number}.pdf`, caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Schriftliche Korrektur</span>
                                      {caseStudy.pdf_downloaded_at && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openFeedbackModal(caseStudy.id)
                                    }}
                                    className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                    style={{ backgroundColor: '#2e83c2' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    <span>
                                      {studentFeedbacks.has(caseStudy.id) ? 'Feedbackpapier bearbeiten' : 'Feedbackpapier erstellen'}
                                    </span>
                                    {studentFeedbacks.has(caseStudy.id) && <span className="text-xs">✓</span>}
                                  </button>
                                  {studentFeedbacks.has(caseStudy.id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        downloadFeedbackPDF(caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      title="Feedbackpapier herunterladen"
                                    >
                                      <Download className="w-4 h-4" />
                                      <span>Feedbackpapier herunterladen</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-xs text-gray-500 bg-gray-50/80 backdrop-blur-sm p-2 rounded shadow-sm">
                                💡 Schaue Dir sowohl die Video-Korrektur, als auch die schriftliche Bewertung Deines Dozenten an, um einen maximalen Mehrwert in der Nachbereitung zu erhalten!
                              </div>
                              
                              {/* Rating Section */}
                              <div className="bg-yellow-50/80 backdrop-blur-sm border border-yellow-200 rounded-lg p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-yellow-500" />
                                    Bewerte Deine Klausurenkorrektur
                                  </h4>
                                  {ratings.has(caseStudy.id) && (
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`w-4 h-4 ${
                                            star <= (ratings.get(caseStudy.id)?.rating || 0)
                                              ? 'text-yellow-500 fill-current'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                  Wie bewertest Du Deine Klausurenkorrektur? Gibt es Kritik/Verbesserungswünsche?
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openRatingModal(caseStudy.id)
                                  }}
                                  className="w-full bg-[#2e83c2] text-white px-3 py-2 rounded-lg text-sm hover:bg-[#0a1f44] transition-colors flex items-center justify-center gap-2"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  {ratings.has(caseStudy.id) ? 'Bewertung bearbeiten' : 'Jetzt bewerten'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    ← Zurück
                  </button>
                  <span className="text-sm text-gray-600">
                    Seite {currentPage} von {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Weiter →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Video className="w-12 h-12 text-primary mx-auto mb-3" />
              {legalAreaFilter !== 'all' && completedCases.length > 0 ? (
                <>
                  <p className="text-gray-600 mb-2">Keine Korrekturen für "{legalAreaFilter}" gefunden.</p>
                  <button
                    onClick={() => setLegalAreaFilter('all')}
                    className="text-sm text-blue-600 hover:text-primary underline"
                  >
                    Alle Rechtsgebiete anzeigen
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-2">Noch keine Korrekturen verfügbar.</p>
                  <p className="text-sm text-gray-500">Deine Korrekturen erscheinen hier, sobald sie von einem Dozenten hochgeladen wurden.</p>
                </>
              )}
            </div>
          )}
        </div>
        )}


        {/* Rating Modal */}
        {showRatingModal && currentRatingCaseId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-bold text-gray-900">Klausurenkorrektur bewerten</h3>
                <button
                  onClick={closeRatingModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Wie bewertest Du Deine Klausurenkorrektur?
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setTempRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= tempRating
                              ? 'text-yellow-500 fill-current'
                              : 'text-gray-300 hover:text-yellow-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-sm text-gray-600">
                      {tempRating === 0 && 'Bitte wähle eine Bewertung'}
                      {tempRating === 1 && 'Sehr schlecht'}
                      {tempRating === 2 && 'Schlecht'}
                      {tempRating === 3 && 'Okay'}
                      {tempRating === 4 && 'Gut'}
                      {tempRating === 5 && 'Sehr gut'}
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gibt es Kritik/Verbesserungswünsche? (Optional)
                  </label>
                  <textarea
                    value={tempFeedback}
                    onChange={(e) => setTempFeedback(e.target.value)}
                    placeholder="Dein Feedback zur Klausurenkorrektur..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeRatingModal}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={submitRating}
                    disabled={tempRating === 0 || submittingRating}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      tempRating === 0 || submittingRating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#2e83c2] text-white hover:bg-[#0a1f44]'
                    }`}
                  >
                    {submittingRating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Speichern...
                      </>
                    ) : (
                      'Bewertung speichern'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Modal */}
        {showFeedbackModal && currentFeedbackCaseId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="bg-[#2e83c2] text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {studentFeedbacks.has(currentFeedbackCaseId) ? 'Feedbackpapier bearbeiten' : 'Feedbackpapier erstellen'}
                  </h3>
                  {(() => {
                    const caseStudy = caseStudies.find(cs => cs.id === currentFeedbackCaseId)
                    return caseStudy ? <p className="text-sm opacity-90">{caseStudy.legal_area} - {caseStudy.sub_area}</p> : null
                  })()}
                </div>
                <button onClick={closeFeedbackModal} className="text-white hover:text-gray-200">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Nutze dieses Feedbackpapier</strong> zur Reflexion deiner Klausurkorrektur. Es hilft dir dabei, aus Fehlern zu lernen und deine Leistung kontinuierlich zu verbessern.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                    <HelpCircle className="w-4 h-4 text-yellow-500" />
                    Selbsterkenntnis: Was habe ich falsch gemacht?
                  </label>
                  <textarea
                    value={feedbackForm.mistakes}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, mistakes: e.target.value })}
                    placeholder="Beschreibe hier, welche Fehler du gemacht hast und was du aus der Korrektur gelernt hast..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#2e83c2] focus:border-transparent resize-none"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 italic mt-2">Beispiel: „Ich habe die Anspruchsgrundlage nicht vollständig geprüft..."</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                    <HelpCircle className="w-4 h-4 text-green-500" />
                    Selbsterkenntnis: Was möchte ich künftig besser machen?
                  </label>
                  <textarea
                    value={feedbackForm.improvements}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, improvements: e.target.value })}
                    placeholder="Beschreibe hier konkrete Verbesserungsmaßnahmen für zukünftige Klausuren..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#2e83c2] focus:border-transparent resize-none"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 italic mt-2">Beispiel: „Ich werde systematischer vorgehen und eine Checkliste verwenden..."</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    Wann möchte ich die Inhalte wiederholen? <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={feedbackForm.reviewDate}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, reviewDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#2e83c2] focus:border-transparent"
                  />
                </div>

                <label className="flex items-start gap-3 bg-gray-50/80 backdrop-blur-sm rounded-lg p-3 border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feedbackForm.emailReminder}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, emailReminder: e.target.checked })}
                    className="mt-1 w-4 h-4 text-[#2e83c2] rounded focus:ring-[#2e83c2]"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                      <Mail className="w-4 h-4 text-[#2e83c2]" />
                      E-Mail-Erinnerung senden
                    </div>
                    <p className="text-xs text-gray-500">Du erhältst eine Benachrichtigung am Wiederholungstermin.</p>
                  </div>
                </label>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={closeFeedbackModal}
                    className="flex-1 px-4 py-3 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors font-medium"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={submitFeedback}
                    className="flex-1 px-4 py-3 rounded-lg text-white bg-[#2e83c2] hover:bg-[#0a1f44] transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Preview Modal */}
        {showPDFPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
              <div className="bg-[#2e83c2] text-white px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Feedbackpapier Vorschau
                </h3>
                <button onClick={closePDFPreview} className="text-white hover:text-gray-200">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                {currentPDFData ? (
                  <object data={currentPDFData} type="application/pdf" width="100%" height="500px" className="rounded border w-full">
                    <p className="text-gray-600">PDF kann nicht angezeigt werden.</p>
                  </object>
                ) : (
                  <p className="text-gray-600">Kein PDF verfügbar.</p>
                )}
              </div>
              <div className="p-4 border-t flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={closePDFPreview}
                  className="px-4 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors font-medium"
                >
                  Schließen
                </button>
                <button
                  onClick={handlePDFDownload}
                  className="px-4 py-2 rounded-lg text-white bg-[#2e83c2] hover:bg-[#0a1f44] transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  PDF herunterladen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Credit Expiry Info Modal */}
      {showExpiryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowExpiryModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-medium text-gray-900">Credit-Ablauf</h3>
                  </div>
                  <button onClick={() => setShowExpiryModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Deine Credits sind jeweils 18 Monate ab Kauf gültig. Hier siehst du, wann welche Credits verfallen:
                </p>
                <div className="space-y-2">
                  {allExpiries.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Credits mit Ablaufdatum vorhanden.</p>
                  ) : (
                    allExpiries.map((exp, idx) => {
                      const expired = new Date(exp.date) < new Date();
                      return (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${expired ? 'bg-gray-100' : 'bg-orange-50'}`}>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{exp.credits} Credits</div>
                            <div className="text-xs text-gray-500">
                              Gekauft am {new Date(exp.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${expired ? 'text-gray-400 line-through' : 'text-orange-600'}`}>
                              {new Date(exp.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {expired ? 'Abgelaufen' : 'Verfällt am'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowExpiryModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:text-sm"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
