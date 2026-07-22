import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Award, CheckCircle, Play, TrendingUp, TrendingDown, X } from 'lucide-react'
import { useVbCaseStudies } from '../../hooks/useVbCaseStudies'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface LegalAreaStats {
  area: string
  average_grade: number
  total_submissions: number
  trend: 'up' | 'down' | 'stable'
  latest_grade: number
}

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

  const legalAreaStats = useMemo<LegalAreaStats[]>(() => {
    const groups = gradedResults.reduce((acc, r) => {
      ;(acc[r.legal_area] ||= []).push(r)
      return acc
    }, {} as Record<string, typeof gradedResults>)

    return Object.entries(groups as Record<string, typeof gradedResults>)
      .map(([area, areaResults]) => {
        const sorted = [...areaResults].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        const total = areaResults.reduce((sum, r) => sum + (r.grade || 0), 0)
        const latest = sorted[0]?.grade || 0
        const previous = sorted[1]?.grade ?? latest
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (sorted.length > 1) {
          if (latest > previous) trend = 'up'
          else if (latest < previous) trend = 'down'
        }
        return {
          area,
          average_grade: total / areaResults.length,
          total_submissions: areaResults.length,
          trend,
          latest_grade: latest,
        }
      })
      .sort((a, b) => b.total_submissions - a.total_submissions)
  }, [gradedResults])

  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const openVideo = (correctionUrl?: string | null, caseStudyId?: string) => {
    if (!correctionUrl) return
    // Convert Loom share URL to embed URL
    const embed = correctionUrl
      .replace('https://www.loom.com/share/', 'https://www.loom.com/embed/')
    setVideoUrl(embed)
    // Mark the video as viewed (best-effort, non-blocking)
    if (caseStudyId) {
      supabase
        .from('vb_case_study_requests')
        .update({ video_viewed_at: new Date().toISOString() })
        .eq('id', caseStudyId)
        .then(undefined, err => console.error('Error marking video viewed:', err))
    }
  }

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

  // Inline-SVG chart geometry (mirrors the Elite-Kleingruppe mechanic)
  const chartHeight = 50
  const chartWidth = 100
  const padding = { top: 5, right: 5, bottom: 5, left: 15 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Meine Klausurergebnisse</h1>
        <p className="text-gray-600">
          Verfolge Deinen Fortschritt und analysiere Deine Leistung nach Rechtsgebieten
        </p>
      </div>

      {/* Overview */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Deine Ergebnisse</h2>
        <div
          className={`grid gap-4 sm:gap-6 grid-cols-1 ${
            legalAreaStats.length <= 1
              ? 'sm:grid-cols-2'
              : legalAreaStats.length === 2
              ? 'sm:grid-cols-2 md:grid-cols-3'
              : 'sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          <div className="text-center p-3 sm:p-0">
            <div className="flex items-center justify-center mb-2">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
              <span className="text-xs sm:text-sm text-gray-600">Korrigierte Klausuren</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{results.length}</p>
          </div>

          {LEGAL_AREAS.map(({ name, color }) => {
            const stat = legalAreaStats.find(s => s.area === name)
            if (!stat) return null
            return (
              <div key={name} className="text-center p-3 sm:p-0">
                <div className="flex items-center justify-center mb-2">
                  <Award className="w-5 h-5 sm:w-6 sm:h-6 mr-2" style={{ color }} />
                  <span className="text-xs sm:text-sm text-gray-600 break-words">
                    Durchschnitt {name}
                  </span>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${getGradeColor(stat.average_grade)}`}>
                  {formatGrade(stat.average_grade)} Punkte
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Punkteverlauf nach Rechtsgebieten (Inline-SVG) - nur wenn Noten vorhanden */}
      {gradedResults.length > 0 && (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
          Punkteverlauf nach Rechtsgebieten
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LEGAL_AREAS.map(({ name, color }) => {
            const areaResults = [...gradedResults]
              .filter(r => r.legal_area === name)
              .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
            const avg =
              areaResults.length > 0
                ? Math.round(areaResults.reduce((sum, r) => sum + (r.grade || 0), 0) / areaResults.length)
                : 0
            const trend =
              areaResults.length < 2
                ? 'neutral'
                : (areaResults[areaResults.length - 1].grade || 0) >
                  (areaResults[areaResults.length - 2].grade || 0)
                ? 'improved'
                : (areaResults[areaResults.length - 1].grade || 0) <
                  (areaResults[areaResults.length - 2].grade || 0)
                ? 'declined'
                : 'stable'

            return (
              <div key={name} className="bg-blue-50 rounded-lg p-2 relative">
                {trend === 'improved' && (
                  <div className="absolute -top-1 -right-1 animate-bounce">
                    <span className="text-sm">🎉</span>
                  </div>
                )}
                <div className="text-center mb-1">
                  <div className="text-xs font-semibold" style={{ color }}>
                    {name}
                  </div>
                  {areaResults.length > 0 && (
                    <div className="text-xs text-gray-600">Ø {avg} Pkt.</div>
                  )}
                  {areaResults.length >= 2 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-block mt-1 ${
                        trend === 'improved'
                          ? 'bg-green-100 text-green-700'
                          : trend === 'declined'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {trend === 'improved' ? '↑' : trend === 'declined' ? '↓' : '→'}
                    </span>
                  )}
                </div>

                {areaResults.length === 0 ? (
                  <div className="h-8 flex items-center justify-center">
                    <span className="text-xs text-gray-400">-</span>
                  </div>
                ) : (
                  <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
                    <text x={padding.left - 2} y={padding.top + 3} fontSize="6" fill="#9CA3AF" textAnchor="end">
                      18
                    </text>
                    <text
                      x={padding.left - 2}
                      y={padding.top + innerHeight}
                      fontSize="6"
                      fill="#9CA3AF"
                      textAnchor="end"
                    >
                      0
                    </text>
                    <line
                      x1={padding.left}
                      y1={padding.top}
                      x2={padding.left + innerWidth}
                      y2={padding.top}
                      stroke="#E5E7EB"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                    />
                    <line
                      x1={padding.left}
                      y1={padding.top + innerHeight}
                      x2={padding.left + innerWidth}
                      y2={padding.top + innerHeight}
                      stroke="#E5E7EB"
                      strokeWidth="0.5"
                    />
                    {/* Bestehensgrenze (4 Punkte) */}
                    <line
                      x1={padding.left}
                      y1={padding.top + innerHeight * (1 - 4 / 18)}
                      x2={padding.left + innerWidth}
                      y2={padding.top + innerHeight * (1 - 4 / 18)}
                      stroke="#FCD34D"
                      strokeWidth="0.5"
                      strokeDasharray="2,1"
                    />
                    {(() => {
                      const points = areaResults.map((r, i) => ({
                        x: padding.left + (i / Math.max(areaResults.length - 1, 1)) * innerWidth,
                        y: padding.top + innerHeight * (1 - (r.grade || 0) / 18),
                        grade: r.grade,
                        id: r.id,
                        label: `${r.sub_area}`,
                      }))
                      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                      return (
                        <g>
                          {points.length > 1 && (
                            <path
                              d={linePath}
                              fill="none"
                              stroke={color}
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          {points.map((p, i) => (
                            <g key={i} onClick={() => navigateToVideo(p.id)} style={{ cursor: 'pointer' }}>
                              <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="white" strokeWidth="1.5" />
                              <title>
                                {p.label}: {p.grade} Punkte – Klicken für Video
                              </title>
                            </g>
                          ))}
                        </g>
                      )
                    })()}
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* Deine Klausuren */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Deine Klausuren</h2>
          <span className="text-xs sm:text-sm text-gray-600">
            {results.length} {results.length === 1 ? 'Klausur' : 'Klausuren'}
          </span>
        </div>
        <div className="space-y-3 sm:space-y-4">
          {results.map((result, index) => (
            <div
              key={result.id}
              className={`bg-white rounded-lg p-3 sm:p-4 border-l-4 shadow-sm border-t border-r border-b border-gray-200 ${
                result.legal_area === 'Zivilrecht'
                  ? 'border-l-blue-600'
                  : result.legal_area === 'Strafrecht'
                  ? 'border-l-red-600'
                  : 'border-l-green-600'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1">
                  {result.grade !== null && result.grade !== undefined ? (
                    <div
                      className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full font-bold flex-shrink-0 leading-none ${getGradeBadgeColor(
                        result.grade
                      )}`}
                    >
                      <span className="text-base sm:text-lg">{formatGrade(result.grade)}</span>
                      <span className="text-[9px] font-medium opacity-80">Pkt</span>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-semibold text-sm sm:text-base flex-shrink-0 ${
                        result.legal_area === 'Zivilrecht'
                          ? 'bg-blue-100 text-blue-600'
                          : result.legal_area === 'Strafrecht'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {results.length - index}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 text-sm sm:text-lg">
                        Klausur #{result.case_study_number}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          result.legal_area === 'Zivilrecht'
                            ? 'bg-blue-100 text-blue-800'
                            : result.legal_area === 'Strafrecht'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {result.legal_area}
                      </span>
                      {result.grade !== null && result.grade !== undefined ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getGradeBadgeColor(
                            result.grade
                          )}`}
                        >
                          {formatGrade(result.grade)} Punkte
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-blue-100 text-primary">
                          Korrigiert
                        </span>
                      )}
                    </div>
                    <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{result.sub_area}</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      Schwerpunkt: {result.focus_area}
                    </p>
                    <p className="text-xs text-gray-500">Korrigiert: {formatDate(result.updated_at)}</p>
                  </div>
                </div>
                {result.video_correction_url && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-blue-100 text-primary rounded-full text-xs sm:text-sm whitespace-nowrap">
                      <CheckCircle className="w-4 h-4" />
                      <span>Videoklausurenkorrektur verfügbar</span>
                    </div>
                    <button
                      onClick={() => openVideo(result.video_correction_url, result.id)}
                      className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      <span>Video ansehen</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detaillierte Statistik */}
      {legalAreaStats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
            Detaillierte Statistik nach Rechtsgebieten
          </h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {legalAreaStats.map(stat => (
              <div
                key={stat.area}
                className={`border-l-4 rounded-lg p-5 shadow-sm bg-white ${
                  stat.area === 'Zivilrecht'
                    ? 'border-l-blue-600'
                    : stat.area === 'Strafrecht'
                    ? 'border-l-red-600'
                    : 'border-l-green-600'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3
                    className={`font-bold text-lg ${
                      stat.area === 'Zivilrecht'
                        ? 'text-blue-700'
                        : stat.area === 'Strafrecht'
                        ? 'text-red-700'
                        : 'text-green-700'
                    }`}
                  >
                    {stat.area}
                  </h3>
                  {stat.trend === 'up' && <TrendingUp className="w-6 h-6 text-green-500" />}
                  {stat.trend === 'down' && <TrendingDown className="w-6 h-6 text-red-500" />}
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Durchschnitt</p>
                    <p className={`text-2xl font-bold ${getGradeColor(stat.average_grade)}`}>
                      {formatGrade(stat.average_grade)} Punkte
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Klausuren</p>
                      <p className="text-lg font-bold text-gray-900">{stat.total_submissions}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Letzte Note</p>
                      <p className={`text-lg font-bold ${getGradeColor(stat.latest_grade)}`}>
                        {formatGrade(stat.latest_grade)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Modal */}
      {videoUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4 sm:p-6"
          onClick={() => setVideoUrl(null)}
        >
          <div className="relative w-full max-w-4xl mx-auto" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setVideoUrl(null)}
              className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-black bg-opacity-70 rounded-full p-2"
            >
              <X className="w-7 h-7" />
            </button>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
              <iframe
                src={videoUrl}
                title="Video-Korrektur"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
