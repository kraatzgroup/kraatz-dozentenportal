// Shared, normalized model for Klausurkorrektur used by both
// Elite-Kleingruppe and VB (Klausurenbesprechung).
//
// The UI component (KorrekturModal) is decoupled from the data layer:
// each source (elite | vb) maps its rows into a `KorrekturItem`, configures
// which fields are shown via `KorrekturFieldConfig`, and handles persistence
// in its own `onSave` adapter using `KorrekturSavePayload`.

export type KorrekturSource = 'elite' | 'vb'

// Normalized representation of a single correctable Klausur, regardless of source.
export interface KorrekturItem {
  id: string
  /** Main heading, e.g. the Klausur title. */
  title: string
  /** Secondary line, e.g. "Teilnehmer - Rechtsgebiet". */
  subtitle?: string
  /** Points (Elite: 0-18 int; VB: numeric grade). */
  score?: number | null
  feedback?: string | null
  /** Corrected klausur PDF (Elite) / written correction (VB). */
  correctedFileUrl?: string | null
  /** Scoring table Excel (Elite) / scoring sheet (VB). */
  correctedExcelUrl?: string | null
  /** VB only: video correction (e.g. Loom) URL. */
  videoCorrectionUrl?: string | null
  /** VB only: solution sketch PDF. */
  solutionPdfUrl?: string | null
  /** VB only: scoring schema file (legacy single-file, still used by Elite). */
  scoringSchemaUrl?: string | null
  /** VB only: multiple Zusatzmaterial URLs (new multi-file support). */
  scoringSchemaUrls?: string[]
  /** VB only: solution sketch file name (for display). */
  solutionFileName?: string | null
  /** VB only: scoring schema file name (for display). */
  schemaFileName?: string | null
  /** VB only: correction duration in hours. */
  correctionDurationHours?: string | null
}

// Controls which fields the modal renders for a given source.
export interface KorrekturFieldConfig {
  showScore?: boolean
  scoreLabel?: string
  scoreMax?: number
  scorePlaceholder?: string
  /** Correction time logged to dozent_hours (Elite). */
  showDuration?: boolean
  /** Corrected klausur PDF upload. */
  showPdf?: boolean
  pdfLabel?: string
  /** Scoring table Excel upload. */
  showExcel?: boolean
  excelLabel?: string
  /** VB: video correction URL input. */
  showVideo?: boolean
  videoLabel?: string
  /** VB: solution sketch PDF upload. */
  showSolution?: boolean
  solutionLabel?: string
  /** VB: scoring schema upload. */
  showSchema?: boolean
  schemaLabel?: string
}

// Payload handed to the source-specific onSave handler.
export interface KorrekturSavePayload {
  score: string
  durationHours: string
  feedback: string
  pdfFile: File | null
  excelFile: File | null
  videoUrl: string
  solutionFile: File | null
  schemaFile: File | null
  /** VB only: additional Zusatzmaterial files (multi-upload). */
  schemaFiles: File[]
  /** VB only: URLs of existing Zusatzmaterial files to delete. */
  deletedSchemaUrls?: string[]
}

export const ELITE_FIELD_CONFIG: KorrekturFieldConfig = {
  showScore: true,
  scoreLabel: 'Punktzahl',
  scoreMax: 18,
  scorePlaceholder: 'z.B. 12',
  showDuration: true,
  showPdf: true,
  pdfLabel: 'Korrigierte Klausur (PDF)',
  showExcel: true,
  excelLabel: 'Bewertungstabelle (Excel)',
  showVideo: false,
  showSolution: false,
  showSchema: false,
}

export const VB_FIELD_CONFIG: KorrekturFieldConfig = {
  showScore: true,
  scoreLabel: 'Punktzahl',
  scoreMax: 18,
  scorePlaceholder: 'z.B. 12',
  showDuration: true,
  showPdf: true,
  pdfLabel: 'Schriftliche Korrektur (PDF)',
  showExcel: true,
  excelLabel: 'Bewertungsbogen (Excel)',
  showVideo: true,
  videoLabel: 'Video-Korrektur (Loom-Link)',
  showSolution: true,
  solutionLabel: 'Lösungsskizze (PDF)',
  showSchema: true,
  schemaLabel: 'Zusatzmaterial',
}
