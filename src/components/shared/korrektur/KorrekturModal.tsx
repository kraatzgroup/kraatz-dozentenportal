import React, { useEffect, useState } from 'react'
import { X, FileText, Upload, Download, Save, Edit3, Plus } from 'lucide-react'
import type { KorrekturFieldConfig, KorrekturItem, KorrekturSavePayload } from './types'
import { exceedsDocumentUploadLimit, MAX_DOCUMENT_UPLOAD_LABEL } from '../../../lib/uploadLimits'

interface FileFieldProps {
  label: string
  file: File | null
  existingUrl?: string | null
  accept: string
  accentColor?: 'primary' | 'green'
  downloadName: string
  onSelect: (file: File | null) => void
  onDownload?: (url: string, filename: string) => void
  useMaterialSelector?: boolean
  onOpenMaterialSelector?: () => void
  selectedMaterialUrl?: string | null
  selectedMaterialFileName?: string | null
  onDelete?: () => void
}

// Helper to extract filename from URL
const getFileNameFromUrl = (url: string): string => {
  if (!url) return 'Unbekannte Datei'
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    // Decode URL-encoded characters (e.g., %20 -> space)
    return decodeURIComponent(filename || 'Unbekannte Datei')
  } catch {
    const filename = url.split('/').pop() || 'Unbekannte Datei'
    return decodeURIComponent(filename)
  }
}

// Reusable upload/preview block: shows selected file, or an existing uploaded
// file with download + replace, or an empty picker.
const FileField: React.FC<FileFieldProps> = ({
  label,
  file,
  existingUrl,
  accept,
  accentColor = 'primary',
  downloadName,
  onSelect,
  onDownload,
  useMaterialSelector = false,
  onOpenMaterialSelector,
  selectedMaterialUrl,
  selectedMaterialFileName,
  onDelete,
}) => {
  const dashed =
    accentColor === 'green'
      ? 'border-green-300 hover:border-green-500/50 bg-green-50/30'
      : 'border-gray-300 hover:border-primary/50'
  const iconColor = accentColor === 'green' ? 'text-green-500' : 'text-gray-400'

  const displayName = selectedMaterialFileName || (selectedMaterialUrl ? getFileNameFromUrl(selectedMaterialUrl) : null)

  const fileBgColor = accentColor === 'green' ? 'bg-green-50' : 'bg-primary/5'
  const fileBorderColor = accentColor === 'green' ? 'border-green-200' : 'border-primary/20'
  const fileIconColor = accentColor === 'green' ? 'text-green-600' : 'text-primary'

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {file ? (
        <div className={`flex items-center p-3 ${fileBgColor} border ${fileBorderColor} rounded-lg`}>
          <FileText className={`h-5 w-5 ${fileIconColor} flex-shrink-0`} />
          <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={file.name}>
            {file.name}
          </span>
          <button
            onClick={() => onSelect(null)}
            className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : selectedMaterialUrl ? (
        <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={displayName || 'Aus Materialien ausgewählt'}>
            {displayName || 'Aus Materialien ausgewählt'}
          </span>
          {onDownload && (
            <button
              onClick={() => onDownload(selectedMaterialUrl, downloadName)}
              className="ml-2 p-1 text-primary hover:bg-primary/10 rounded flex-shrink-0"
              title="Datei herunterladen"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onOpenMaterialSelector}
            className="ml-2 p-1 text-gray-500 hover:bg-gray-100 rounded flex-shrink-0"
            title="Andere Datei auswählen"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
            title="Datei entfernen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : existingUrl ? (
        <div className="space-y-2">
          <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
            <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
            <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={getFileNameFromUrl(existingUrl)}>
              {getFileNameFromUrl(existingUrl)}
            </span>
            {onDownload && (
              <button
                onClick={() => {
                  console.log('📥 Download button clicked:', { existingUrl, downloadName })
                  onDownload(existingUrl, downloadName)
                }}
                className="ml-2 p-1 text-primary hover:bg-primary/10 rounded flex-shrink-0"
                title="Datei herunterladen"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onDelete}
              className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
              title="Datei entfernen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {useMaterialSelector ? (
            <button
              onClick={onOpenMaterialSelector}
              className={`flex items-center justify-center px-3 py-2 border-2 border-dashed rounded-lg transition-colors ${dashed}`}
            >
              <Upload className={`h-4 w-4 mr-2 ${iconColor}`} />
              <span className="text-sm text-gray-500">Aus Materialien auswählen</span>
            </button>
          ) : (
            <label className="cursor-pointer block">
              <div className={`flex items-center justify-center px-3 py-2 border-2 border-dashed rounded-lg transition-colors ${dashed}`}>
                <Upload className={`h-4 w-4 mr-2 ${iconColor}`} />
                <span className="text-sm text-gray-500">Neue Datei hochladen</span>
              </div>
              <input
                type="file"
                accept={accept}
                className="hidden"
                onChange={e => {
                  const selectedFile = e.target.files?.[0] || null
                  console.log('📁 FileField - File selected:', selectedFile?.name, 'for label:', label)
                  if (selectedFile && exceedsDocumentUploadLimit(selectedFile)) {
                    alert(`Die Datei "${selectedFile.name}" ist zu groß. Maximal ${MAX_DOCUMENT_UPLOAD_LABEL} erlaubt.`)
                    e.target.value = ''
                    return
                  }
                  onSelect(selectedFile)
                }}
              />
            </label>
          )}
        </div>
      ) : (
        useMaterialSelector ? (
          <button
            onClick={onOpenMaterialSelector}
            className={`flex items-center justify-center px-3 py-3 border-2 border-dashed rounded-lg transition-colors ${dashed}`}
          >
            <Upload className={`h-4 w-4 mr-2 ${iconColor}`} />
            <span className="text-sm text-gray-500">Aus Materialien auswählen</span>
          </button>
        ) : (
          <label className="cursor-pointer block">
            <div className={`flex items-center justify-center px-3 py-3 border-2 border-dashed rounded-lg transition-colors ${dashed}`}>
              <Upload className={`h-4 w-4 mr-2 ${iconColor}`} />
              <span className="text-sm text-gray-500">Datei auswählen</span>
            </div>
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={e => {
                const selectedFile = e.target.files?.[0] || null
                console.log('📁 FileField - File selected (no existing):', selectedFile?.name, 'for label:', label)
                if (selectedFile && exceedsDocumentUploadLimit(selectedFile)) {
                  alert(`Die Datei "${selectedFile.name}" ist zu groß. Maximal ${MAX_DOCUMENT_UPLOAD_LABEL} erlaubt.`)
                  e.target.value = ''
                  return
                }
                onSelect(selectedFile)
              }}
            />
          </label>
        )
      )}
    </div>
  )
}

// Multi-file upload field for Zusatzmaterial (multiple files).
// Shows existing uploaded files (with download/delete) + new files to upload.
interface MultiFileFieldProps {
  label: string
  files: File[]
  existingUrls: string[]
  accept: string
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onRemoveExisting: (url: string) => void
  onDownload?: (url: string, filename: string) => void
}

const MultiFileField: React.FC<MultiFileFieldProps> = ({
  label,
  files,
  existingUrls,
  accept,
  onAddFiles,
  onRemoveFile,
  onRemoveExisting,
  onDownload,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="space-y-2">
        {/* Existing uploaded files */}
        {existingUrls.map((url) => {
          const fileName = getFileNameFromUrl(url)
          return (
            <div key={url} className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
              <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={fileName}>{fileName}</span>
              {onDownload && (
                <button
                  onClick={() => onDownload(url, fileName)}
                  className="ml-2 p-1 text-primary hover:bg-primary/10 rounded flex-shrink-0"
                  title="Datei herunterladen"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => onRemoveExisting(url)}
                className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                title="Datei entfernen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
        {/* New files selected for upload */}
        {files.map((file, index) => (
          <div key={index} className="flex items-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={file.name}>{file.name}</span>
            <button
              onClick={() => onRemoveFile(index)}
              className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
              title="Datei entfernen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {/* Upload button */}
        <label className="cursor-pointer block">
          <div className="flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 hover:border-primary/50 rounded-lg transition-colors">
            <Plus className="h-4 w-4 mr-2 text-gray-400" />
            <span className="text-sm text-gray-500">Zusatzmaterial hinzufügen</span>
          </div>
          <input
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={e => {
              const selectedFiles = Array.from(e.target.files || [])
              const validFiles = selectedFiles.filter(f => {
                if (exceedsDocumentUploadLimit(f)) {
                  alert(`Die Datei "${f.name}" ist zu groß. Maximal ${MAX_DOCUMENT_UPLOAD_LABEL} erlaubt.`)
                  return false
                }
                return true
              })
              if (validFiles.length > 0) onAddFiles(validFiles)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}

interface KorrekturModalProps {
  item: KorrekturItem
  config: KorrekturFieldConfig
  isSaving: boolean
  onClose: () => void
  onSave: (payload: KorrekturSavePayload) => void | Promise<void>
  onDownloadFile?: (url: string, filename: string) => void
  /** Prefilled correction time (e.g. Elite defaults to '0.5'). */
  defaultDurationHours?: string
  /** Material selector props for folder/file selection */
  onOpenMaterialSelector?: (field: 'solution' | 'schema') => void
  selectedMaterialUrls?: { solution?: string; schema?: string }
  selectedMaterialFileNames?: { solution?: string; schema?: string }
  /** Callback to clear a file URL immediately (for delete functionality) */
  onClearFile?: (field: 'pdf' | 'excel' | 'solution' | 'schema') => void
}

export const KorrekturModal: React.FC<KorrekturModalProps> = ({
  item,
  config,
  isSaving,
  onClose,
  onSave,
  onDownloadFile,
  defaultDurationHours = '',
  onOpenMaterialSelector,
  selectedMaterialUrls,
  selectedMaterialFileNames,
  onClearFile,
}) => {
  const [score, setScore] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [feedback, setFeedback] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [solutionFile, setSolutionFile] = useState<File | null>(null)
  const [schemaFile, setSchemaFile] = useState<File | null>(null)
  // Multi-file Zusatzmaterial (VB only)
  const [schemaFiles, setSchemaFiles] = useState<File[]>([])
  const [deletedSchemaUrls, setDeletedSchemaUrls] = useState<string[]>([])

  // Initialise inputs from the item whenever a NEW item is opened (different id).
  // We intentionally only depend on item.id (and defaultDurationHours) so that
  // in-place updates to the item (e.g. clearing a file URL from the DB while the
  // modal is open) do NOT wipe the user's in-progress inputs such as the Loom
  // video link, score, feedback or newly selected files. File URL changes are
  // reflected via the existingUrl props of FileField/MultiFileField directly.
  useEffect(() => {
    setScore(item.score !== null && item.score !== undefined ? String(item.score) : '')
    setFeedback(item.feedback || '')
    setVideoUrl(item.videoCorrectionUrl || '')
    setDurationHours(item.correctionDurationHours || defaultDurationHours)
    // Reset file states
    setPdfFile(null)
    setExcelFile(null)
    setSolutionFile(null)
    setSchemaFile(null)
    setSchemaFiles([])
    setDeletedSchemaUrls([])
  }, [item.id, defaultDurationHours]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    console.log('💾 KorrekturModal handleSave - File states:', {
      pdfFile: pdfFile?.name,
      excelFile: excelFile?.name,
      solutionFile: solutionFile?.name,
      schemaFile: schemaFile?.name,
      schemaFiles: schemaFiles.map(f => f.name),
      deletedSchemaUrls,
    })
    onSave({
      score,
      durationHours,
      feedback,
      pdfFile,
      excelFile,
      videoUrl,
      solutionFile,
      schemaFile,
      schemaFiles,
      deletedSchemaUrls,
    } as KorrekturSavePayload)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 my-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Klausur korrigieren</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{item.title}</p>
            {item.subtitle && <p className="text-xs text-gray-500">{item.subtitle}</p>}
          </div>

          <div className="space-y-4">
            {(config.showScore || config.showDuration) && (
              <div className="grid grid-cols-2 gap-4">
                {config.showScore && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {config.scoreLabel || 'Punktzahl'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={config.scoreMax ?? 18}
                      value={score}
                      onChange={e => setScore(e.target.value)}
                      placeholder={config.scorePlaceholder || 'z.B. 12'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                )}
                {config.showDuration && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Korrekturzeit (Stunden)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={durationHours}
                      onChange={e => setDurationHours(e.target.value)}
                      placeholder="z.B. 1.5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <p className="text-xs text-gray-400 mt-1">Wird im Tätigkeitsbericht erfasst</p>
                  </div>
                )}
              </div>
            )}

            {config.showVideo && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {config.videoLabel || 'Video-Korrektur (Link)'}
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://www.loom.com/share/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            )}

            {(config.showPdf || config.showExcel) && (
              <div className="grid grid-cols-2 gap-4">
                {config.showPdf && (
                  <FileField
                    label={config.pdfLabel || 'Korrigierte Klausur (PDF)'}
                    file={pdfFile}
                    existingUrl={item.correctedFileUrl}
                    accept=".pdf"
                    downloadName={`${item.title}_Korrektur.pdf`}
                    onSelect={setPdfFile}
                    onDownload={onDownloadFile}
                    onDelete={() => onClearFile?.('pdf')}
                  />
                )}
                {config.showExcel && (
                  <FileField
                    label={config.excelLabel || 'Bewertungstabelle (Excel)'}
                    file={excelFile}
                    existingUrl={item.correctedExcelUrl}
                    accept=".xlsx,.xls,.csv"
                    downloadName={`${item.title}_Bewertung.xlsx`}
                    onSelect={setExcelFile}
                    onDownload={onDownloadFile}
                    onDelete={() => onClearFile?.('excel')}
                    accentColor="green"
                  />
                )}
              </div>
            )}

            {(config.showSolution || config.showSchema) && (
              <div className="grid grid-cols-2 gap-4">
                {config.showSolution && (
                  <FileField
                    label={config.solutionLabel || 'Lösungsskizze (PDF)'}
                    file={solutionFile}
                    existingUrl={item.solutionPdfUrl}
                    accept=".pdf"
                    downloadName={`${item.title}_Loesungsskizze.pdf`}
                    onSelect={setSolutionFile}
                    onDownload={onDownloadFile}
                    useMaterialSelector={true}
                    onOpenMaterialSelector={() => onOpenMaterialSelector?.('solution')}
                    selectedMaterialUrl={selectedMaterialUrls?.solution}
                    selectedMaterialFileName={selectedMaterialFileNames?.solution}
                    onDelete={() => onClearFile?.('solution')}
                  />
                )}
                {config.showSchema && (
                  <MultiFileField
                    label={config.schemaLabel || 'Zusatzmaterial'}
                    files={schemaFiles}
                    existingUrls={(item.scoringSchemaUrls && item.scoringSchemaUrls.length > 0
                      ? item.scoringSchemaUrls
                      : item.scoringSchemaUrl ? [item.scoringSchemaUrl] : []
                    ).filter(u => !deletedSchemaUrls.includes(u))}
                    accept=".pdf"
                    onAddFiles={(newFiles) => setSchemaFiles(prev => [...prev, ...newFiles])}
                    onRemoveFile={(index) => setSchemaFiles(prev => prev.filter((_, i) => i !== index))}
                    onRemoveExisting={(url) => setDeletedSchemaUrls(prev => [...prev, url])}
                    onDownload={onDownloadFile}
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feedback / Anmerkungen
              </label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Feedback zur Klausur..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 inline mr-1" />
                  Korrektur speichern
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
