import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Check, Save, Trash2, AlertCircle } from 'lucide-react'

interface PureAutoSaveGradeInputProps {
  caseStudyId: string
  initialGrade?: number | null
  initialGradeText?: string
  onSave: (caseStudyId: string, grade: number | null, gradeText?: string) => Promise<boolean>
  disabled?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error' | 'null-saved'

export const PureAutoSaveGradeInput: React.FC<PureAutoSaveGradeInputProps> = ({
  caseStudyId,
  initialGrade,
  initialGradeText,
  onSave,
  disabled = false
}) => {
  const [grade, setGrade] = useState<string>(initialGrade?.toString() || '')
  const [gradeText, setGradeText] = useState(initialGradeText || '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedGrade, setLastSavedGrade] = useState<number | null>(initialGrade ?? null)
  const [lastSavedText, setLastSavedText] = useState(initialGradeText ?? '')
  
  const gradeInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save function
  const debouncedSave = useCallback(async (gradeValue: string, textValue: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      const numericGrade = gradeValue.trim() === '' ? null : parseFloat(gradeValue)
      
      // Don't save if values haven't changed
      if (numericGrade === lastSavedGrade && textValue === lastSavedText) {
        return
      }

      // Validate grade if provided
      if (numericGrade !== null && (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 18)) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 2000)
        return
      }

      setSaveStatus('saving')
      
      try {
        const success = await onSave(caseStudyId, numericGrade, textValue)
        
        if (success) {
          setLastSavedGrade(numericGrade)
          setLastSavedText(textValue)
          setSaveStatus(numericGrade === null ? 'null-saved' : 'success')
          
          // Reset status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        } else {
          setSaveStatus('error')
          setTimeout(() => setSaveStatus('idle'), 2000)
        }
      } catch (error) {
        console.error('Auto-save error:', error)
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 400) // 400ms debounce
  }, [caseStudyId, onSave, lastSavedGrade, lastSavedText])

  // Handle grade input change
  const handleGradeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setGrade(value)
    
    // Auto-populate grade description in text field
    if (value && !isNaN(parseFloat(value))) {
      const description = getGradeDescription(value)
      setGradeText(description)
    } else {
      // Clear grade text if no valid grade
      setGradeText('')
    }
  }

  // Handle grade text change
  const handleGradeTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setGradeText(value)
  }

  // Handle blur events (immediate save)
  const handleBlur = () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debouncedSave(grade, gradeText)
  }

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      handleBlur()
      
      // Move focus to next input or blur current
      if (e.currentTarget === gradeInputRef.current && textInputRef.current) {
        textInputRef.current.focus()
      } else {
        (e.currentTarget as HTMLElement).blur()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      // Clear grade and save as NULL
      setGrade('')
      setGradeText('')
      debouncedSave('', '')
    }
  }

  // Get visual feedback styling
  const getInputStyling = () => {
    const baseClasses = "px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
    
    switch (saveStatus) {
      case 'saving':
        return `${baseClasses} border-blue-300 bg-blue-50 ring-2 ring-blue-200`
      case 'success':
        return `${baseClasses} border-green-300 bg-green-50 ring-2 ring-green-200`
      case 'null-saved':
        return `${baseClasses} border-purple-300 bg-purple-50 ring-2 ring-purple-200`
      case 'error':
        return `${baseClasses} border-red-300 bg-red-50 ring-2 ring-red-200`
      default:
        return `${baseClasses} border-gray-300`
    }
  }

  // Get status icon
  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Save className="w-4 h-4 text-blue-600 animate-pulse" />
      case 'success':
        return <Check className="w-4 h-4 text-green-600" />
      case 'null-saved':
        return <Trash2 className="w-4 h-4 text-purple-600" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  // Get status message
  const getStatusMessage = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Speichere...'
      case 'success':
        return `✓ Note ${grade} gespeichert`
      case 'null-saved':
        return '🗑️ Note entfernt'
      case 'error':
        return '✗ Fehler beim Speichern'
      default:
        return ''
    }
  }

  // Get grade description
  const getGradeDescription = (gradeValue: string) => {
    const numGrade = parseFloat(gradeValue)
    if (isNaN(numGrade)) return ''
    
    if (numGrade >= 16 && numGrade <= 18) return 'sehr gut'
    if (numGrade >= 13 && numGrade <= 15) return 'gut'
    if (numGrade >= 10 && numGrade <= 12) return 'vollbefriedigend'
    if (numGrade >= 7 && numGrade <= 9) return 'befriedigend'
    if (numGrade >= 4 && numGrade <= 6) return 'ausreichend'
    if (numGrade >= 1 && numGrade <= 3) return 'mangelhaft'
    if (numGrade === 0) return 'ungenügend'
    return ''
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      {/* Grade Input */}
      <div className="relative">
        <input
          ref={gradeInputRef}
          type="number"
          min="0"
          max="18"
          step="0.5"
          placeholder="Note (0-18)"
          value={grade}
          onChange={handleGradeChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={getInputStyling()}
          data-autosave-grade={caseStudyId}
        />
        
        {/* Status Icon */}
        {getStatusIcon() && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getStatusIcon()}
          </div>
        )}
        
        {/* Grade Description */}
        {grade && !isNaN(parseFloat(grade)) && (
          <div className="text-xs text-gray-500 mt-1">
            {getGradeDescription(grade)}
          </div>
        )}
      </div>

      {/* Grade Text Input */}
      <div className="relative">
        <textarea
          ref={textInputRef}
          placeholder="Notenbeschreibung (optional)"
          value={gradeText}
          onChange={handleGradeTextChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
          className={`${getInputStyling()} resize-none`}
          data-autosave-text={caseStudyId}
        />
      </div>

      {/* Status Message */}
      {saveStatus !== 'idle' && (
        <div className={`text-xs font-medium transition-opacity duration-200 ${
          saveStatus === 'saving' ? 'text-blue-600' : 
          saveStatus === 'success' ? 'text-green-600' : 
          saveStatus === 'null-saved' ? 'text-purple-600' : 
          'text-red-600'
        }`}>
          {getStatusMessage()}
        </div>
      )}
    </div>
  )
}