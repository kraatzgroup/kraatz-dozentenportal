import React, { useEffect, useState } from 'react'
import { X, FileText, Upload, Download, Save } from 'lucide-react'
import type { KorrekturFieldConfig, KorrekturItem, KorrekturSavePayload } from './types'

interface FileFieldProps {
  label: string
  file: File | null
  existingUrl?: string | null
  accept: string
  accentColor?: 'primary' | 'green'
  downloadName: string
  onSelect: (file: File | null) => void
  onDownload?: (url: string, filename: string) => void
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
}) => {
  const dashed =
    accentColor === 'green'
      ? 'border-green-300 hover:border-green-500/50 bg-green-50/30'
      : 'border-gray-300 hover:border-primary/50'
  const iconColor = accentColor === 'green' ? 'text-green-500' : 'text-gray-400'

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {file ? (
        <div className="flex items-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
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
      ) : existingUrl ? (
        <div className="space-y-2">
          <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
            <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
            <span className="ml-2 text-sm text-gray-700 flex-1">Bereits hochgeladen</span>
            {onDownload && (
              <button
                onClick={() => onDownload(existingUrl, downloadName)}
                className="ml-2 p-1 text-primary hover:bg-primary/10 rounded flex-shrink-0"
                title="Datei herunterladen"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
          <label className="cursor-pointer block">
            <div className={`flex items-center justify-center px-3 py-2 border-2 border-dashed rounded-lg transition-colors ${dashed}`}>
              <Upload className={`h-4 w-4 mr-2 ${iconColor}`} />
              <span className="text-sm text-gray-500">Neue Datei hochladen</span>
            </div>
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={e => onSelect(e.target.files?.[0] || null)}
            />
          </label>
        </div>
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
            onChange={e => onSelect(e.target.files?.[0] || null)}
          />
        </label>
      )}
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
}

export const KorrekturModal: React.FC<KorrekturModalProps> = ({
  item,
  config,
  isSaving,
  onClose,
  onSave,
  onDownloadFile,
  defaultDurationHours = '',
}) => {
  const [score, setScore] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [feedback, setFeedback] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [solutionFile, setSolutionFile] = useState<File | null>(null)
  const [schemaFile, setSchemaFile] = useState<File | null>(null)

  // Initialise inputs from the item whenever a new item is opened.
  useEffect(() => {
    setScore(item.score !== null && item.score !== undefined ? String(item.score) : '')
    setFeedback(item.feedback || '')
    setVideoUrl(item.videoCorrectionUrl || '')
    setDurationHours(defaultDurationHours)
    setPdfFile(null)
    setExcelFile(null)
    setSolutionFile(null)
    setSchemaFile(null)
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    onSave({
      score,
      durationHours,
      feedback,
      pdfFile,
      excelFile,
      videoUrl,
      solutionFile,
      schemaFile,
    })
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
                  />
                )}
                {config.showExcel && (
                  <FileField
                    label={config.excelLabel || 'Bewertungstabelle (Excel)'}
                    file={excelFile}
                    existingUrl={item.correctedExcelUrl}
                    accept=".xlsx,.xls,.csv"
                    accentColor="green"
                    downloadName={`${item.title}_Bewertung.xlsx`}
                    onSelect={setExcelFile}
                    onDownload={onDownloadFile}
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
                  />
                )}
                {config.showSchema && (
                  <FileField
                    label={config.schemaLabel || 'Bewertungsschema (PDF)'}
                    file={schemaFile}
                    existingUrl={item.scoringSchemaUrl}
                    accept=".pdf"
                    downloadName={`${item.title}_Schema.pdf`}
                    onSelect={setSchemaFile}
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
