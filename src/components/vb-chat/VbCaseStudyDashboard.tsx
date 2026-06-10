import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { CreditCard, BookOpen, Plus, Download, Upload, FileText, Video, X, Clock, CheckCircle, ChevronDown, ChevronUp, Star, MessageSquare, Table, Edit3, Eye, Trash2 } from 'lucide-react'
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
  case_study_number: number;
  study_phase: string;
  legal_area: string;
  sub_area: string;
  focus_area: string;
  status: 'requested' | 'materials_ready' | 'submitted' | 'under_review' | 'corrected' | 'completed';
  pdf_url?: string;
  case_study_material_url?: string;
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
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null)
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
  const [studentFeedbacks, setStudentFeedbacks] = useState<Map<string, StudentFeedback>>(new Map())
  const [showPDFPreview, setShowPDFPreview] = useState(false)
  const [currentPDFData, setCurrentPDFData] = useState<string>('')
  const [currentPDFFilename, setCurrentPDFFilename] = useState<string>('')
  const [submissions, setSubmissions] = useState<Map<string, {grade: number | null, grade_text: string | null}>>(new Map())
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('all')
  const [availableCredits, setAvailableCredits] = useState<number>(0)

  // Track video view
  const handleVideoView = useCallback(async (caseStudyId: string) => {
    try {
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update({ video_viewed_at: new Date().toISOString() })
        .eq('id', caseStudyId)
      
      if (!error) {
        // Update local state immediately for instant UI feedback
        setCaseStudies(prevCases => 
          prevCases.map(cs => 
            cs.id === caseStudyId 
              ? { ...cs, video_viewed_at: new Date().toISOString() }
              : cs
          )
        )
        // Also refresh from database
        fetchUserData()
      }
    } catch (error) {
      console.error('Error tracking video view:', error)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Mark correction as viewed
  const markCorrectionAsViewed = useCallback(async (caseStudyId: string) => {
    try {
      const { error } = await supabase
        .from('vb_case_study_requests')
        .update({ correction_viewed_at: new Date().toISOString() })
        .eq('id', caseStudyId)

      if (error) {
        console.error('Error marking correction as viewed:', error)
      } else {
        // Refresh case studies to update UI
        fetchUserData()
      }
    } catch (error) {
      console.error('Error marking correction as viewed:', error)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Open video modal
  const openVideoModal = useCallback((videoUrl: string, caseStudyId: string) => {
    // Convert Loom share URL to embed URL
    const embedUrl = videoUrl.replace('https://www.loom.com/share/', 'https://www.loom.com/embed/')
    setCurrentVideoUrl(embedUrl)
    setVideoModalOpen(true)
    
    // Mark video as viewed and correction as viewed
    handleVideoView(caseStudyId)
    markCorrectionAsViewed(caseStudyId)
  }, [handleVideoView, markCorrectionAsViewed])

  // Close video modal
  const closeVideoModal = () => {
    setVideoModalOpen(false)
    setCurrentVideoUrl(null)
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
  // TODO: Implement when vb_student_feedback table is created
  const fetchStudentFeedbacks = async () => {
    try {
      // Table doesn't exist yet, skip for now
      /*
      const { data, error } = await supabase
        .from('vb_student_feedback')
        .select('*')
        .eq('profile_id', user?.id)

      if (error) throw error

      const feedbacksMap = new Map<string, StudentFeedback>()
      data?.forEach((feedback: any) => {
        feedbacksMap.set(feedback.case_study_id, feedback)
      })
      setStudentFeedbacks(feedbacksMap)
      */
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
    setCurrentFeedbackCaseId(caseStudyId)
    setShowFeedbackModal(true)
  }

  // Close feedback modal
  const closeFeedbackModal = () => {
    setShowFeedbackModal(false)
    setCurrentFeedbackCaseId(null)
    // Refresh feedbacks after closing modal
    fetchStudentFeedbacks()
  }

  // Open PDF preview
  const openPDFPreview = () => {
    // TODO: Implement PDF preview functionality
    alert('PDF Preview functionality not yet implemented')
    return
    /*
    const feedback = studentFeedbacks.get(caseStudyId)
    const caseStudy = caseStudies.find(cs => cs.id === caseStudyId)
    
    if (!feedback || !caseStudy || !profile) {
      alert('Feedbackpapier konnte nicht gefunden werden.')
      return
    }

    const caseStudyInfo = {
      legal_area: caseStudy.legal_area,
      sub_area: caseStudy.sub_area,
      focus_area: caseStudy.focus_area,
      case_study_number: caseStudy.case_study_number
    }

    const userInfo = {
      first_name: profile.first_name,
      last_name: profile.last_name
    }

    const pdfDataUri = previewFeedbackPDF(feedback, caseStudyInfo, userInfo)
    const filename = `Feedbackpapier_${caseStudy.legal_area}_${caseStudy.sub_area}_${new Date(feedback.created_at).toLocaleDateString('de-DE').replace(/\./g, '-')}.pdf`
    
    // Set the current case study ID for download
    setCurrentFeedbackCaseId(caseStudyId)
    setCurrentPDFData(pdfDataUri)
    setCurrentPDFFilename(filename)
    setShowPDFPreview(true)
    */
  }

  // Close PDF preview
  const closePDFPreview = () => {
    setShowPDFPreview(false)
    setCurrentPDFData('')
    setCurrentPDFFilename('')
    setCurrentFeedbackCaseId(null)
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
    // TODO: Implement PDF download functionality
    alert('PDF Download functionality not yet implemented')
    return
    /*
    console.log('🔄 handlePDFDownload called with currentFeedbackCaseId:', currentFeedbackCaseId)
    
    const feedback = studentFeedbacks.get(currentFeedbackCaseId || '')
    const caseStudy = caseStudies.find(cs => cs.id === currentFeedbackCaseId)
    
    console.log('📊 Data check:', {
      currentFeedbackCaseId,
      feedback: !!feedback,
      caseStudy: !!caseStudy,
      profile: !!profile,
      studentFeedbacksSize: studentFeedbacks.size,
      caseStudiesLength: caseStudies.length
    })
    
    if (!feedback || !caseStudy || !profile) {
      console.error('❌ Missing data for PDF download:', { 
        feedback: !!feedback, 
        caseStudy: !!caseStudy, 
        profile: !!profile,
        currentFeedbackCaseId 
      })
      alert('Fehler: Nicht alle Daten für den PDF-Download verfügbar.')
      return
    }

    const caseStudyInfo = {
      legal_area: caseStudy.legal_area,
      sub_area: caseStudy.sub_area,
      focus_area: caseStudy.focus_area,
      case_study_number: caseStudy.case_study_number
    }

    const userInfo = {
      first_name: profile.first_name,
      last_name: profile.last_name
    }

    try {
      console.log('🔄 Starting PDF download from Dashboard...', {
        feedback,
        caseStudyInfo,
        userInfo
      })
      downloadFeedbackPDF(feedback, caseStudyInfo, userInfo)
    } catch (error) {
      console.error('❌ Error in handlePDFDownload:', error)
      alert('Fehler beim PDF-Download. Bitte versuchen Sie es erneut.')
    }
    */
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
    
    // Check if it's a new correction (completed recently and not accessed)
    const isNew = !videoViewed && !pdfDownloaded
    
    // Check if fully accessed
    const fullyAccessed = (!hasVideo || videoViewed) && (!hasPdf || pdfDownloaded)
    
    // Check if partially accessed
    const partiallyAccessed = (videoViewed || pdfDownloaded) && !fullyAccessed
    
    if (fullyAccessed) {
      return {
        containerClass: "border border-green-200 rounded-lg p-4 bg-green-50",
        badgeClass: "px-2 py-1 bg-primary text-white text-xs rounded-full font-medium",
        badgeText: "✓ Vollständig angesehen",
        showNewBadge: false
      }
    } else if (partiallyAccessed) {
      return {
        containerClass: "border border-gray-200 rounded-lg p-4 bg-gray-50",
        badgeClass: "px-2 py-1 bg-gray-600 text-white text-xs rounded-full font-medium",
        badgeText: "◐ Teilweise angesehen",
        showNewBadge: false
      }
    } else {
      return {
        containerClass: "border border-blue-200 rounded-lg p-4 bg-blue-50",
        badgeClass: "px-2 py-1 bg-primary text-white text-xs rounded-full font-medium",
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
          
          // Scroll to the case study
          setTimeout(() => {
            const element = document.getElementById(`case-study-${caseStudyId}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 500)
          
          // Open the video modal after a short delay
          setTimeout(() => {
            openVideoModal(caseStudy.video_correction_url!, caseStudyId)
          }, 1000)
          
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
  }, [caseStudies, openVideoModal]) // eslint-disable-line react-hooks/exhaustive-deps

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

      // Fetch orders with packages to calculate available credits
      const { data: ordersData, error: ordersError } = await supabase
        .from('vb_orders')
        .select(`
          *,
          package:package_id (
            case_study_count
          )
        `)
        .eq('profile_id', user?.id)
        .eq('status', 'completed')

      if (ordersError) throw ordersError

      // Calculate total purchased credits from completed orders
      const totalPurchasedCredits = ordersData?.reduce((sum, order) => {
        return sum + (order.package?.case_study_count || 0)
      }, 0) || 0

      // Calculate used credits (case studies that are not requested)
      const usedCredits = caseStudies.filter(cs => 
        cs.status !== 'requested'
      ).length

      // Available credits = purchased - used
      const credits = totalPurchasedCredits - usedCredits
      setAvailableCredits(Math.max(0, credits))

      // Fetch case studies with dozent information
      const { data: caseStudyData, error: caseStudyError } = await supabase
        .from('vb_case_study_requests')
        .select('*')
        .eq('profile_id', user?.id)
        .order('created_at', { ascending: true })

      if (caseStudyError) throw caseStudyError
      setCaseStudies(caseStudyData || [])

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

  const handleFileUpload = async (caseStudyId: string) => {
    const uploadFile = uploadFiles.get(caseStudyId)
    if (!uploadFile) return

    setUploadingCaseId(caseStudyId)
    try {
      console.log('Starting upload for case study:', caseStudyId)
      console.log('File details:', { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type })
      
      const fileExt = uploadFile.name.split('.').pop()
      const fileName = `${caseStudyId}_submission_${Date.now()}.${fileExt}`
      
      console.log('Uploading to storage with filename:', fileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('case-studies')
        .upload(fileName, uploadFile)

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
      if (caseStudy && user && profile) {
        // TODO: Implement notification service
        // await NotificationService.createCaseStudyStatusNotification(
        //   user.id,
        //   'submitted',
        //   caseStudy.legal_area,
        //   caseStudy.sub_area,
        //   caseStudyId
        // )
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

        {/* 1. Verfügbare Klausuren */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Verfügbare Klausuren</h2>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary">{availableSlots}</span>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-gray-600 text-sm sm:text-base">
              Du hast <span className="font-bold">{availableSlots}</span> verfügbare Klausur-Credits.
            </p>
            {availableSlots > 0 && (
              <Link
                to="/vb/case-studies/request"
                className="bg-primary text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
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
                to="/vb/packages"
                className="bg-primary text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>Weitere Klausuren buchen</span>
              </Link>
            </div>
          )}
        </div>

        {/* 2. Sachverhalt angefordert */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sachverhalt angefordert</h2>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="font-bold text-yellow-600">{requestedCases.length}</span>
            </div>
          </div>
          {requestedCases.length > 0 ? (
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
                        <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                          #{index + 1}
                        </span>
                        <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
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
          ) : (
            <p className="text-gray-600 text-center py-4">Keine angeforderten Sachverhalte.</p>
          )}
        </div>

        {/* 3. Sachverhalt verfügbar */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sachverhalt verfügbar</h2>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary">{materialsReadyCases.length}</span>
            </div>
          </div>
          {materialsReadyCases.length > 0 ? (
            <div className="space-y-3">
              {materialsReadyCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-3 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-medium text-gray-900 text-sm sm:text-base break-words">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 break-words">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    {caseStudy.case_study_material_url && (
                      <a
                        href={caseStudy.case_study_material_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                        style={{ backgroundColor: '#2e83c2' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                      >
                        <Download className="w-4 h-4" />
                        <span>Sachverhalt</span>
                      </a>
                    )}
                    {/* Show additional materials - support both old URL format and new array format */}
                    {caseStudy.additional_materials && caseStudy.additional_materials.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {caseStudy.additional_materials.map((material, index) => (
                          <a
                            key={material.id}
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-primary text-white px-3 py-2 rounded-lg text-xs sm:text-sm hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                          >
                            <Download className="w-4 h-4" />
                            <span>{caseStudy.additional_materials.length > 1 ? `Zusatzmaterial ${index + 1}` : 'Zusatzmaterial'}</span>
                          </a>
                        ))}
                      </div>
                    ) : caseStudy.additional_materials_url && (
                      <a
                        href={caseStudy.additional_materials_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-white px-3 py-2 rounded-lg text-xs sm:text-sm hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        <span>Zusatzmaterialien</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">Keine verfügbaren Sachverhalte.</p>
          )}
        </div>

        {/* 4. Upload Bearbeitung */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Upload Bearbeitung</h2>
            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-orange-600" />
              <span className="font-bold text-orange-600">{materialsReadyCases.length + submittedCases.length}</span>
            </div>
          </div>
          {(materialsReadyCases.length > 0 || submittedCases.length > 0) ? (
            <div className="space-y-4">
              {/* Ready for upload cases */}
              {materialsReadyCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-4 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-orange-200 bg-orange-50'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-medium text-gray-900">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="space-y-3">
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
                          ? 'bg-primary hover:bg-primary/90 text-white'
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
                </div>
              ))}
              
              {/* Submitted cases */}
              {submittedCases.map((caseStudy, index) => (
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
                      <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-medium text-gray-900">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
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
                        <p className="text-xs text-gray-600">
                          Eingereicht: {formatDate(caseStudy.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">Keine Klausuren bereit für Upload.</p>
          )}
        </div>

        {/* 5. Video-Klausurenkorrektur verfügbar */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Video-Klausurenkorrektur verfügbar</h2>
              <div className="flex items-center space-x-2 sm:hidden">
                <Video className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-600">{filteredCompletedCases.length}</span>
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
                <Video className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-600">{filteredCompletedCases.length}</span>
              </div>
            </div>
          </div>
          
          {filteredCompletedCases.length > 0 ? (
            <>
              {/* Neue Video-Klausurenkorrekturen */}
              {newCorrections.length > 0 && (
                <div className="mb-6">
                  <div className="mb-4 p-4 bg-green-100 border border-green-300 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <div>
                        <h3 className="text-sm font-semibold text-green-800">🎉 Eine neue Klausur-Korrektur ist ab sofort für Dich verfügbar.</h3>
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Neue Video-Klausurenkorrekturen</h3>
                  <div className="space-y-3">
                    {newCorrections.map((caseStudy, index) => {
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
                                <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                                  #{caseStudy.case_study_number}
                                </span>
                                <h3 className="font-medium text-gray-900 text-sm sm:text-base">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
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
                          
                          {/* Rating Button - Always Visible */}
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            {ratings.has(caseStudy.id) ? (
                              <div className="flex items-center gap-1 px-3 py-2 sm:py-1 bg-gray-100 text-gray-700 text-xs rounded-lg w-full sm:w-auto">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-3 h-3 ${
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
                                className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
                              >
                                <Star className="w-3 h-3" />
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
                                <Trash2 className="w-3 h-3" />
                                Löschen
                              </button>
                            )}
                          </div>
                          
                          {/* Expandable Details Section */}
                          {expandedCases.has(caseStudy.id) && (
                            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-800 font-medium mb-2">📚 Deine Unterlagen:</p>
                                <div className="flex flex-col gap-2 max-w-xs">
                                  {caseStudy.case_study_material_url && (
                                    <a
                                      href={caseStudy.case_study_material_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      onClick={(e) => { e.stopPropagation(); if (!caseStudy.solution_pdf_url) e.preventDefault(); }}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Sachverhalt</span>
                                    </a>
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
                              
                              <div className="bg-white p-3 rounded border border-green-200">
                                <p className="text-sm text-green-800 font-medium mb-2">🎓 Deine Korrekturen:</p>
                                {/* Grade Display for New Corrections */}
                                {submissions.has(caseStudy.id) && submissions.get(caseStudy.id)?.grade !== null && (
                                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-primary">📊 Deine Note:</span>
                                      <div className="text-right">
                                        <span className="text-lg font-bold text-primary">
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
                                <div className="flex flex-col gap-2 max-w-xs">
                                  {caseStudy.video_correction_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openVideoModal(caseStudy.video_correction_url!, caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: caseStudy.video_viewed_at ? '#10b981' : '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = caseStudy.video_viewed_at ? '#059669' : '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = caseStudy.video_viewed_at ? '#10b981' : '#2e83c2'}
                                    >
                                      <Video className="w-4 h-4" />
                                      <span>Video ansehen</span>
                                      {caseStudy.video_viewed_at && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                  { (
                                    <a
                                      href={caseStudy.solution_pdf_url || "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => { e.stopPropagation(); if (!caseStudy.solution_pdf_url) e.preventDefault(); }}
                                      className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${ caseStudy.solution_pdf_url ? "text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed" }`}
                                      style={caseStudy.solution_pdf_url ? { backgroundColor: '#2e83c2' } : {}}
                                      onMouseEnter={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#0a1f44' }}
                                      onMouseLeave={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#2e83c2' }}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Klausur-Lösung</span>
                                    </a>
                                  )}
                                  {caseStudy.scoring_sheet_url && (
                                    <a
                                      href={caseStudy.scoring_sheet_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => { e.stopPropagation(); if (!caseStudy.solution_pdf_url) e.preventDefault(); }}
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <Table className="w-4 h-4" />
                                      <span>Korrekturbogen</span>
                                    </a>
                                  )}
                                  {caseStudy.written_correction_url && (
                                    <a
                                      href={caseStudy.written_correction_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePdfDownload(caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: caseStudy.pdf_downloaded_at ? '#10b981' : '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = caseStudy.pdf_downloaded_at ? '#059669' : '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = caseStudy.pdf_downloaded_at ? '#10b981' : '#2e83c2'}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Schriftliche Korrektur</span>
                                      {caseStudy.pdf_downloaded_at && <span className="text-xs">✓</span>}
                                    </a>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openFeedbackModal(caseStudy.id)
                                    }}
                                    className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                    style={{ backgroundColor: studentFeedbacks.has(caseStudy.id) ? '#10b981' : '#0a1f44' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = studentFeedbacks.has(caseStudy.id) ? '#059669' : '#2e83c2'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = studentFeedbacks.has(caseStudy.id) ? '#10b981' : '#0a1f44'}
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
                                        openPDFPreview()
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <Eye className="w-4 h-4" />
                                      <span>Feedbackpapier anzeigen</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
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
              {viewedCorrections.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Vergangene Video-Klausurenkorrekturen</h3>
                  <div className="space-y-3">
                    {viewedCorrections.map((caseStudy) => {
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
                                <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                                  #{caseStudy.case_study_number}
                                </span>
                                <h3 className="font-medium text-gray-900 text-sm sm:text-base">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
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
                          
                          {/* Rating Button - Always Visible */}
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            {ratings.has(caseStudy.id) ? (
                              <div className="flex items-center gap-1 px-3 py-2 sm:py-1 bg-gray-100 text-gray-700 text-xs rounded-lg w-full sm:w-auto">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-3 h-3 ${
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
                                className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
                              >
                                <Star className="w-3 h-3" />
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
                                <Trash2 className="w-3 h-3" />
                                Löschen
                              </button>
                            )}
                          </div>
                          
                          {/* Expandable Details Section */}
                          {expandedCases.has(caseStudy.id) && (
                            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-800 font-medium mb-2">📚 Deine Unterlagen:</p>
                                <div className="flex flex-col gap-2 max-w-xs">
                                  {caseStudy.case_study_material_url && (
                                    <a
                                      href={caseStudy.case_study_material_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                      onClick={(e) => { e.stopPropagation(); if (!caseStudy.solution_pdf_url) e.preventDefault(); }}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Sachverhalt</span>
                                    </a>
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
                              
                              <div className="bg-white p-3 rounded border border-green-200">
                                <p className="text-sm text-green-800 font-medium mb-2">🎓 Deine Korrekturen:</p>
                                {/* Grade Display for Viewed Corrections */}
                                {submissions.has(caseStudy.id) && submissions.get(caseStudy.id)?.grade !== null && (
                                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-primary">📊 Deine Note:</span>
                                      <div className="text-right">
                                        <span className="text-lg font-bold text-primary">
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
                                <div className="flex flex-col gap-2 max-w-xs">
                                  {caseStudy.video_correction_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openVideoModal(caseStudy.video_correction_url!, caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: caseStudy.video_viewed_at ? '#10b981' : '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = caseStudy.video_viewed_at ? '#059669' : '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = caseStudy.video_viewed_at ? '#10b981' : '#2e83c2'}
                                    >
                                      <Video className="w-4 h-4" />
                                      <span>Video ansehen</span>
                                      {caseStudy.video_viewed_at && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                  { (
                                    <a
                                      href={caseStudy.solution_pdf_url || "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => { e.stopPropagation(); if (!caseStudy.solution_pdf_url) e.preventDefault(); }}
                                      className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${ caseStudy.solution_pdf_url ? "text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed" }`}
                                      style={caseStudy.solution_pdf_url ? { backgroundColor: '#2e83c2' } : {}}
                                      onMouseEnter={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#0a1f44' }}
                                      onMouseLeave={(e) => { if (caseStudy.solution_pdf_url) e.currentTarget.style.backgroundColor = '#2e83c2' }}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Klausur-Lösung</span>
                                    </a>
                                  )}
                                  {caseStudy.scoring_sheet_url && (
                                    <a
                                      href={caseStudy.scoring_sheet_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => { e.stopPropagation(); if (!caseStudy.solution_pdf_url) e.preventDefault(); }}
                                      className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <Table className="w-4 h-4" />
                                      <span>Korrekturbogen</span>
                                    </a>
                                  )}
                                  {caseStudy.written_correction_url && (
                                    <a
                                      href={caseStudy.written_correction_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePdfDownload(caseStudy.id)
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: caseStudy.pdf_downloaded_at ? '#10b981' : '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = caseStudy.pdf_downloaded_at ? '#059669' : '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = caseStudy.pdf_downloaded_at ? '#10b981' : '#2e83c2'}
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Schriftliche Korrektur</span>
                                      {caseStudy.pdf_downloaded_at && <span className="text-xs">✓</span>}
                                    </a>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openFeedbackModal(caseStudy.id)
                                    }}
                                    className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                    style={{ backgroundColor: studentFeedbacks.has(caseStudy.id) ? '#10b981' : '#0a1f44' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = studentFeedbacks.has(caseStudy.id) ? '#059669' : '#2e83c2'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = studentFeedbacks.has(caseStudy.id) ? '#10b981' : '#0a1f44'}
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
                                        openPDFPreview()
                                      }}
                                      className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                                      style={{ backgroundColor: '#2e83c2' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                                    >
                                      <Eye className="w-4 h-4" />
                                      <span>Feedbackpapier anzeigen</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                💡 Schaue Dir sowohl die Video-Korrektur, als auch die schriftliche Bewertung Deines Dozenten an, um einen maximalen Mehrwert in der Nachbereitung zu erhalten!
                              </div>
                              
                              {/* Rating Section */}
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
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
                                  className="w-full bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
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

        {/* Video Modal */}
        {videoModalOpen && currentVideoUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Video-Korrektur</h3>
                <button
                  onClick={closeVideoModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4">
                <div className="aspect-video w-full">
                  <iframe
                    src={currentVideoUrl}
                    className="w-full h-full rounded-lg"
                    frameBorder="0"
                    allowFullScreen
                    title="Loom Video Correction"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && currentRatingCaseId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Klausurenkorrektur bewerten</h3>
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
                        : 'bg-primary text-white hover:bg-primary/90'
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
          // TODO: Implement FeedbackForm component
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <p>Feedback Form functionality not yet implemented</p>
              <button onClick={closeFeedbackModal} className="mt-4 px-4 py-2 bg-gray-200 rounded">Close</button>
            </div>
          </div>
          /*
          <FeedbackForm
            isOpen={showFeedbackModal}
            onClose={closeFeedbackModal}
            caseStudyId={currentFeedbackCaseId}
            caseStudyTitle={(() => {
              const caseStudy = caseStudies.find(cs => cs.id === currentFeedbackCaseId)
              return caseStudy ? `${caseStudy.legal_area} - ${caseStudy.sub_area}` : 'Klausur'
            })()}
            existingFeedback={studentFeedbacks.get(currentFeedbackCaseId) || null}
            caseStudyInfo={(() => {
              const caseStudy = caseStudies.find(cs => cs.id === currentFeedbackCaseId)
              return caseStudy ? {
                legal_area: caseStudy.legal_area,
                sub_area: caseStudy.sub_area,
                focus_area: caseStudy.focus_area,
                case_study_number: caseStudy.case_study_number
              } : undefined
            })()}
            userInfo={profile ? {
              first_name: profile.first_name,
              last_name: profile.last_name
            } : undefined}
          />
          */
        )}

        {/* PDF Preview Modal */}
        {showPDFPreview && (
          // TODO: Implement FeedbackPDFPreview component
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <p>PDF Preview functionality not yet implemented</p>
              <button onClick={closePDFPreview} className="mt-4 px-4 py-2 bg-gray-200 rounded">Close</button>
            </div>
          </div>
          /*
          <FeedbackPDFPreview
            isOpen={showPDFPreview}
            onClose={closePDFPreview}
            pdfDataUri={currentPDFData}
            filename={currentPDFFilename}
            onDownload={handlePDFDownload}
          />
          */
        )}
      </div>
    </div>
  )
}
