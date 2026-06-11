import { useState, useEffect, useCallback } from 'react'
import { Play, BookOpen, CheckCircle, X, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface VideoLesson {
  id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  duration: number
  category: string
  youtube_id: string | null
  is_active: boolean
  created_at: string
}

// Extract leading "Video N" number from a title for chronological ordering
const extractVideoNumber = (title: string): number => {
  const match = title.match(/Video\s+(\d+)/i)
  return match ? parseInt(match[1], 10) : 999
}

// Convert a YouTube / Loom / generic URL into an embeddable URL
const toEmbedUrl = (url: string): string => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  return url
}

const youTubeThumb = (url: string): string | null => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
  return yt ? `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg` : null
}

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

export const VbMasterclassPage = () => {
  const user = useAuthStore(state => state.user)
  const [lessons, setLessons] = useState<VideoLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())
  const [selectedVideo, setSelectedVideo] = useState<VideoLesson | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('vb_video_progress')
      .select('video_lesson_id, watched')
      .eq('profile_id', user.id)
      .eq('watched', true)
    setWatchedIds(new Set((data || []).map(p => p.video_lesson_id)))
  }, [user])

  const fetchLessons = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vb_video_lessons')
        .select('*')
        .eq('is_active', true)
      if (error) throw error
      const sorted = (data || []).sort(
        (a, b) => extractVideoNumber(a.title) - extractVideoNumber(b.title)
      )
      setLessons(sorted as VideoLesson[])
    } catch (error) {
      console.error('Error fetching video lessons:', error)
      setLessons([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLessons()
    fetchProgress()
  }, [fetchLessons, fetchProgress])

  const openVideo = async (lesson: VideoLesson) => {
    setSelectedVideo(lesson)
    if (!user || watchedIds.has(lesson.id)) return
    try {
      await supabase.from('vb_video_progress').upsert(
        {
          profile_id: user.id,
          video_lesson_id: lesson.id,
          watched: true,
          watch_time: 0,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,video_lesson_id' }
      )
      setWatchedIds(prev => new Set(prev).add(lesson.id))
    } catch (error) {
      console.error('Error saving video progress:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Klausuren-Masterclass</h1>
            <p className="text-gray-600">Lerne von Experten mit unseren Video-Lektionen</p>
          </div>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Noch keine Videos verfügbar</h3>
          <p className="text-gray-600">Es wurden noch keine Video-Lektionen hochgeladen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {lessons.map(lesson => {
            const watched = watchedIds.has(lesson.id)
            const thumb = lesson.thumbnail_url || youTubeThumb(lesson.video_url)
            return (
              <div key={lesson.id} className="space-y-2 sm:space-y-3 transition-all duration-200">
                {/* Watch Status Indicator Above Video */}
                <div className="flex items-center gap-2">
                  {watched && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Gesehen
                    </span>
                  )}
                </div>

                {/* Video Card */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                  {/* Thumbnail with Play Button */}
                  <div
                    className="relative aspect-video bg-gray-200 cursor-pointer group"
                    onClick={() => openVideo(lesson)}
                  >
                    {thumb ? (
                      <img src={thumb} alt={lesson.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                      <div
                        className="rounded-full p-4 opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: '#2e83c2' }}
                      >
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    {lesson.duration > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(lesson.duration)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{lesson.title}</h3>
                    {lesson.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                        {lesson.description}
                      </p>
                    )}
                    <div className="flex justify-end mt-auto">
                      <button
                        onClick={() => openVideo(lesson)}
                        className="flex items-center gap-2 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-colors text-sm font-medium"
                        style={{ backgroundColor: '#2e83c2' }}
                      >
                        <Play className="w-4 h-4" />
                        In Vollbild ansehen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Video Lightbox Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-6"
          onClick={() => setSelectedVideo(null)}
        >
          <div className="relative w-full max-w-3xl mx-auto" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedVideo(null)}
              className="text-white hover:text-red-400 transition-colors z-[60] bg-black bg-opacity-70 rounded-full p-3 shadow-lg"
              style={{ position: 'fixed', top: '20px', right: '20px' }}
            >
              <X className="w-8 h-8" />
            </button>

            <div className="text-white text-center mb-6">
              <h2 className="text-xl font-bold">{selectedVideo.title}</h2>
              {selectedVideo.description && (
                <p className="text-gray-300 mt-2 text-sm">{selectedVideo.description}</p>
              )}
            </div>

            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
              <iframe
                src={`${toEmbedUrl(selectedVideo.video_url)}?autoplay=1&rel=0&modestbranding=1`}
                title={selectedVideo.title}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>

            {selectedVideo.duration > 0 && (
              <div className="text-center mt-4 text-gray-300">
                <span className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  Dauer: {formatDuration(selectedVideo.duration)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
