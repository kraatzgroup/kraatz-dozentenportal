import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { useVbCaseStudies } from '../../hooks/useVbCaseStudies'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const LEGAL_AREAS = [
  { name: 'Zivilrecht', color: '#3B82F6' },
  { name: 'Strafrecht', color: '#EF4444' },
  { name: 'Öffentliches Recht', color: '#22C55E' },
] as const

const formatGrade = (grade: number) => grade.toFixed(2).replace('.', ',')

const formatDate = (dateString?: string) =>
  dateString
    ? new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

const getGradeColor = (grade: number) => {
  if (grade >= 9) return 'text-green-600'
  if (grade >= 7) return 'text-yellow-600'
  if (grade >= 4) return 'text-orange-600'
  return 'text-red-600'
}

const getGradeBadgeColor = (grade: number) => {
  if (grade >= 9) return 'bg-green-100 text-green-800'
  if (grade >= 7) return 'bg-yellow-100 text-yellow-800'
  if (grade >= 4) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

interface ChartPoint {
  id: string
  grade: number
  label: string
  date: string
}

const CHART_COLOR = '#2e83c2'

const LineChart = ({ points, onPointClick }: { points: ChartPoint[]; onPointClick: (id: string) => void }) => {
  const W = 320
  const H = 150
  const pad = { top: 18, right: 16, bottom: 26, left: 26 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const yFor = (g: number) => pad.top + innerH * (1 - Math.min(Math.max(g, 0), 18) / 18)
  const xFor = (i: number) =>
    points.length === 1 ? pad.left + innerW / 2 : pad.left + (i / (points.length - 1)) * innerW
  const coords = points.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.grade) }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const showEveryLabel = coords.length <= 5
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
      {[0, 4, 9, 18].map(t => (
        <g key={t}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke={t === 4 ? '#9CA3AF' : '#E5E7EB'}
            strokeWidth="1"
            strokeDasharray={t === 4 ? '3 3' : undefined}
          />
          <text x={pad.left - 6} y={yFor(t) + 3.5} fontSize="10" fill="#9CA3AF" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {coords.length > 1 && <path d={line} fill="none" stroke={CHART_COLOR} strokeWidth="2" strokeLinejoin="round" />}
      {coords.map((c, i) => (
        <g key={c.id} onClick={() => onPointClick(c.id)} style={{ cursor: 'pointer' }}>
          <circle cx={c.x} cy={c.y} r="4" fill={CHART_COLOR} />
          <text x={c.x} y={c.y - 9} fontSize="10.5" fill="#374151" textAnchor="middle">
            {formatGrade(c.grade).replace(',00', '')}
          </text>
          {(showEveryLabel || i === 0 || i === coords.length - 1) && (
            <text x={c.x} y={H - 8} fontSize="9.5" fill="#6B7280" textAnchor="middle">
              {c.date}
            </text>
          )}
          <title>
            {c.label}: {formatGrade(c.grade)} Punkte
          </title>
        </g>
      ))}
    </svg>
  )
}

export const VbResultsPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const { caseStudies, loading } = useVbCaseStudies()
  const [grades, setGrades] = useState<Map<string, { grade: number | null; grade_text: string | null }>>(
    new Map()
  )
  const [gradesLoading, setGradesLoading] = useState(true)

  // Grades live in vb_submissions (not on the case study request itself)
  useEffect(() => {
    if (!user || caseStudies.length === 0) {
      setGradesLoading(false)
      return
    }
    const ids = caseStudies.map(cs => cs.id)
    supabase
      .from('vb_submissions')
      .select('case_study_request_id, grade, grade_text')
      .in('case_study_request_id', ids)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching submissions:', error)
        } else {
          const map = new Map<string, { grade: number | null; grade_text: string | null }>()
          data?.forEach(s => map.set(s.case_study_request_id, { grade: s.grade, grade_text: s.grade_text }))
          setGrades(map)
        }
        setGradesLoading(false)
      })
  }, [user, caseStudies])

  // All corrected/completed klausuren (with or without a numeric grade)
  const results = useMemo(
    () =>
      caseStudies
        .filter(cs => cs.status === 'corrected' || cs.status === 'completed')
        .map(cs => {
          const submission = grades.get(cs.id)
          return {
            ...cs,
            grade: submission?.grade ?? cs.grade ?? null,
            grade_text: submission?.grade_text ?? cs.grade_text ?? null,
          }
        })
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [caseStudies, grades]
  )

  // Only graded klausuren drive averages and the progress chart
  const gradedResults = useMemo(
    () => results.filter(r => r.grade !== null && r.grade !== undefined),
    [results]
  )

  const navigateToVideo = (caseStudyId: string) => {
    navigate(`/klausurenbesprechung/dashboard#case-study-${caseStudyId}`)
  }

  if (loading || gradesLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Noch keine Ergebnisse</h1>
          <p className="text-gray-600">
            Sobald Du Deine ersten Klausuren korrigiert bekommst, siehst Du hier Deine Ergebnisse und
            Statistiken.
          </p>
        </div>
      </div>
    )
  }

  const overallAvg =
    gradedResults.length > 0 ? gradedResults.reduce((sum, r) => sum + (r.grade || 0), 0) / gradedResults.length : null
  const latestGraded = gradedResults[0]

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Meine Klausurergebnisse</h1>
        <p className="text-gray-600 text-sm sm:text-base mt-1">Deine Noten und dein Verlauf nach Rechtsgebieten.</p>
      </div>

      {/* Überblick */}
      <dl className="grid grid-cols-3 bg-white rounded-lg border border-gray-200 divide-x divide-gray-200">
        <div className="p-3 sm:p-5">
          <dt className="text-xs sm:text-sm text-gray-500">Korrigiert</dt>
          <dd className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900">{results.length}</dd>
        </div>
        <div className="p-3 sm:p-5">
          <dt className="text-xs sm:text-sm text-gray-500">Ø Punkte</dt>
          <dd className={`mt-1 text-xl sm:text-2xl font-semibold ${overallAvg !== null ? getGradeColor(overallAvg) : 'text-gray-400'}`}>
            {overallAvg !== null ? formatGrade(overallAvg) : '–'}
          </dd>
        </div>
        <div className="p-3 sm:p-5">
          <dt className="text-xs sm:text-sm text-gray-500">Letzte Note</dt>
          <dd className={`mt-1 text-xl sm:text-2xl font-semibold ${latestGraded ? getGradeColor(latestGraded.grade as number) : 'text-gray-400'}`}>
            {latestGraded ? formatGrade(latestGraded.grade as number) : '–'}
          </dd>
        </div>
      </dl>

      {/* Verlauf */}
      {gradedResults.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Verlauf</h2>
          <div className="bg-white rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            {LEGAL_AREAS.map(({ name }) => {
              const areaResults = [...gradedResults]
                .filter(r => r.legal_area === name)
                .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
              const avg =
                areaResults.length > 0
                  ? areaResults.reduce((sum, r) => sum + (r.grade || 0), 0) / areaResults.length
                  : null
              return (
                <div key={name} className="p-4 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-900">{name}</h3>
                    {avg !== null && <span className="text-xs text-gray-500">Ø {formatGrade(avg)}</span>}
                  </div>
                  {areaResults.length === 0 ? (
                    <p className="text-sm text-gray-400 py-10 text-center">Noch keine Note</p>
                  ) : (
                    <LineChart
                      onPointClick={navigateToVideo}
                      points={areaResults.map(r => ({
                        id: r.id,
                        grade: r.grade || 0,
                        label: r.sub_area,
                        date: formatDate(r.updated_at).slice(0, 5),
                      }))}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Gestrichelte Linie: Bestehensgrenze (4 Punkte). Klick auf einen Punkt öffnet die Korrektur.</p>
        </section>
      )}

      {/* Klausuren */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Klausuren</h2>
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {results.map(result => {
            const graded = result.grade !== null && result.grade !== undefined
            return (
              <li key={result.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-14 flex-shrink-0 text-right">
                    {graded ? (
                      <>
                        <div className={`text-xl font-semibold leading-tight ${getGradeColor(result.grade as number)}`}>
                          {formatGrade(result.grade as number)}
                        </div>
                        <div className="text-[11px] text-gray-500">Punkte</div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500 pt-1">korrigiert</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      Klausur #{result.case_study_number} · {result.sub_area}
                    </p>
                    <p className="text-sm text-gray-600 break-words">
                      {result.legal_area}
                      {result.focus_area ? ` · ${result.focus_area}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(result.updated_at)}</p>
                  </div>
                </div>
                {result.video_correction_url && (
                  <button
                    onClick={() => navigateToVideo(result.id)}
                    className="sm:flex-shrink-0 w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Zur Korrektur
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
