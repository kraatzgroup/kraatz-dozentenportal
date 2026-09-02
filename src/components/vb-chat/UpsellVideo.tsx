import { useState, useRef, useEffect } from 'react'
import { Play, X, Sparkles, ChevronDown, ChevronUp, Calendar } from 'lucide-react'

const UPSELL_VIDEO_URL =
  'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/upsell-klausuren-crashkurs-mario-kraatz.mp4'

const CAL_EMBED_URL = 'https://app.cal.com/embed/embed.js'
const CAL_NAMESPACE = 'beratungsgesprach'

interface UpsellVideoProps {
  /** Optional click handler to stop event propagation in expandable cards */
  onOpen?: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Cal?: any
  }
}

/**
 * Lädt das Cal.com Embed-Script (nur einmal) und initialisiert
 * den Inline-Kalender im übergebenen Container.
 */
function loadCalEmbed(containerSelector: string, namespace: string = CAL_NAMESPACE) {
  const w = window as any

  // Cal-Bootstrap-Funktion (identisch zum offiziellen Snippet)
  if (!w.Cal) {
    ;(function (C: any, A: string, L: string) {
      const p = function (a: any, ar: any) {
        a.q.push(ar)
      }
      const d = C.document
      C.Cal = C.Cal || function () {
        const cal = C.Cal
        const ar = arguments
        if (!cal.loaded) {
          cal.ns = {}
          cal.q = cal.q || []
          d.head.appendChild(d.createElement('script')).src = A
          cal.loaded = true
        }
        if (ar[0] === L) {
          const api: any = function () {
            p(api, arguments)
          }
          const ns = ar[1]
          api.q = api.q || []
          if (typeof ns === 'string') {
            cal.ns[ns] = cal.ns[ns] || api
            p(cal.ns[ns], ar)
            p(cal, ['initNamespace', ns])
          } else {
            p(cal, ar)
          }
          return
        }
        p(cal, ar)
      }
    })(w, CAL_EMBED_URL, 'init')
  }

  w.Cal('init', namespace, { origin: 'https://app.cal.com' })
  w.Cal.config = w.Cal.config || {}
  w.Cal.config.forwardQueryParams = true

  w.Cal.ns[namespace]('inline', {
    elementOrSelector: containerSelector,
    config: { layout: 'month_view', useSlotsViewOnSmallScreen: 'true' },
    calLink: 'kraatz-group/beratungsgesprach',
  })

  w.Cal.ns[namespace]('ui', {
    cssVarsPerTheme: {
      light: { 'cal-brand': '#2D84C1' },
      dark: { 'cal-brand': '#2D84C1' },
    },
    hideEventTypeDetails: false,
    layout: 'month_view',
  })
}

/**
 * Upsell-Video-Thumbnail mit pulsierendem Play-Button.
 * Öffnet das Video in einem Modal-Overlay und startet es immer von vorne.
 * Unter dem Video ist der Cal.com-Kalender zum Buchen eines Beratungsgesprächs eingebettet.
 */
export const UpsellVideo = ({ onOpen }: UpsellVideoProps) => {
  const [showModal, setShowModal] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const calContainerId = 'my-cal-inline-beratungsgesprach-modal'
  const calNamespace = 'beratungsgesprach-modal'

  const openModal = () => {
    onOpen?.()
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  // Wenn das Modal geöffnet wird: Video von vorne starten + Cal-Kalender laden
  useEffect(() => {
    if (!showModal) return

    // Video von vorne starten
    const v = videoRef.current
    if (v) {
      v.currentTime = 0
      v.play().catch(() => {})
    }

    // Cal-Kalender laden – kurze Verzögerung, damit der Container im DOM ist
    const timer = setTimeout(() => {
      try {
        loadCalEmbed(`#${calContainerId}`, calNamespace)
      } catch (e) {
        console.error('Cal.com embed failed:', e)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [showModal])

  // ESC schließt das Modal
  useEffect(() => {
    if (!showModal) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showModal])

  return (
    <>
      {/* Thumbnail mit pulsierendem Play-Button */}
      <button
        type="button"
        onClick={openModal}
        className="group relative aspect-video w-full max-w-md rounded-lg overflow-hidden border border-white/20 mb-4 bg-black/40 cursor-pointer block"
        aria-label="Videobotschaft von Mario Kraatz abspielen"
      >
        {/* Video-Preview (stumm, nur erstes Frame) */}
        <video
          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
          preload="metadata"
          muted
          playsInline
        >
          <source src={UPSELL_VIDEO_URL} type="video/mp4" />
        </video>

        {/* Dunkles Overlay für besseren Kontrast */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

        {/* Pulsierender Play-Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="relative flex items-center justify-center">
            {/* Puls-Ringe */}
            <span className="absolute inline-flex h-16 w-16 rounded-full bg-white opacity-75 animate-ping" />
            <span className="absolute inline-flex h-16 w-16 rounded-full bg-white opacity-50 animate-pulse" />
            {/* Eigentlicher Button */}
            <span className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-white shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-[#2e83c2] ml-1 fill-[#2e83c2]" />
            </span>
          </span>
        </div>

        {/* Untertitel */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-white text-xs sm:text-sm font-medium">
            ▶ Persönliche Videobotschaft von Mario Kraatz
          </p>
        </div>
      </button>

      {/* Video-Modal mit Kalender */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-start justify-center z-[60] p-4 overflow-y-auto"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-4xl my-8 bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Schließen-Button */}
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-white hover:text-[#2e83c2] transition-colors"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video-Container */}
            <div className="aspect-video w-full bg-black">
              <video
                ref={videoRef}
                controls
                autoPlay
                className="w-full h-full"
                playsInline
              >
                <source src={UPSELL_VIDEO_URL} type="video/mp4" />
              </video>
            </div>

            {/* Cal.com Inline-Kalender – responsive */}
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">
                Kostenloses Beratungsgespräch buchen
              </h3>
              <p className="text-sm text-gray-500 mb-4 text-center">
                Wähle einen passenden Termin direkt im Kalender
              </p>
              <div
                id={calContainerId}
                className="w-full min-h-[500px] sm:min-h-[600px] overflow-y-auto rounded-lg border border-gray-200"
                style={{ width: '100%', height: '100%' }}
              />

              {/* Link zur Landingpage als Alternative */}
              <div className="mt-5 text-center">
                <p className="text-xs text-gray-500 mb-2">
                  Oder buche direkt über unsere Beratungsseite:
                </p>
                <a
                  href="https://beratung.kraatz-group.de/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#2e83c2] text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
                >
                  Kostenlosen Beratungstermin buchen
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Rendert den Cal.com Inline-Kalender in einem Container.
 * Lädt das Embed-Script beim Mounten.
 */
const CalInline = ({ namespace, selector }: { namespace: string; selector: string }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        loadCalEmbed(selector, namespace)
      } catch (e) {
        console.error('Cal.com embed failed:', e)
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [namespace, selector])

  return null
}

/**
 * Upsell-Element für Korrekturen unter 9 Punkten.
 * Überschrift, Text, CTA-Button und Video-Thumbnail sind immer sichtbar.
 * Der Cal.com-Kalender ist ein- und ausklappbar.
 */
export const UpsellBlock = ({ onOpen }: { onOpen?: () => void }) => {
  const [calExpanded, setCalExpanded] = useState(false)

  return (
    <div className="mt-3 bg-[#2e83c2] rounded-lg p-4 sm:p-5 shadow-lg text-white">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-7 h-7 text-white" />
        <h4 className="text-xl sm:text-2xl font-bold">
          Du kannst mehr erreichen – und ich zeige Dir genau, wie!
        </h4>
      </div>
      <p className="text-sm text-white/90 mb-4">
        Lass uns gemeinsam herausfinden, wo bei Dir aktuell noch der Schuh
        drückt und an welchen Stellschrauben wir drehen können. Denn Du musst
        Dich im Examen nicht mit weniger als{' '}
        <strong className="text-white underline">9 Punkten</strong>{' '}
        zufriedengeben.
      </p>

      {/* Video-Thumbnail – immer sichtbar */}
      <div className="mb-4">
        <UpsellVideo onOpen={onOpen} />
      </div>

      {/* CTA-Button – immer sichtbar */}
      <a
        href="https://beratung.kraatz-group.de/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-[#2e83c2] text-base font-bold rounded-xl hover:bg-gray-100 transition-all mb-4 shadow-xl ring-2 ring-white/50 hover:scale-105"
      >
        <Calendar className="w-5 h-5" />
        Kostenlosen Beratungstermin buchen
      </a>

      {/* Kalender-Ausklapp-Toggle */}
      <button
        type="button"
        onClick={() => setCalExpanded(!calExpanded)}
        className="flex items-center gap-2 w-full px-4 py-3 bg-white/15 hover:bg-white/25 text-white text-base font-semibold rounded-lg transition-all border border-white/30"
      >
        {calExpanded ? (
          <>
            <ChevronUp className="w-5 h-5" />
            Kalender ausblenden
          </>
        ) : (
          <>
            <ChevronDown className="w-5 h-5" />
            Termin direkt im Kalender buchen
          </>
        )}
      </button>

      {/* Cal.com Inline-Kalender – nur ausgeklappt */}
      {calExpanded && (
        <div
          id="upsell-cal-inline"
          className="mt-4 w-full min-h-[500px] sm:min-h-[600px] overflow-y-auto rounded-lg border border-white/30 bg-white animate-in slide-in-from-top-2 duration-300"
        >
          <CalInline namespace="beratungsgesprach" selector="#upsell-cal-inline" />
        </div>
      )}
    </div>
  )
}
