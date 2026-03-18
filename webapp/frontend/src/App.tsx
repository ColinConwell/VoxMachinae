import { useState, useCallback } from 'react'
import './App.css'
import { AudioRecorder } from './components/AudioRecorder'
import { WaveformView } from './components/WaveformView'
import { AutoTunePanel } from './components/AutoTunePanel'
import { VocoderPanel } from './components/VocoderPanel'
import { StemSeparationPanel } from './components/StemSeparationPanel'
import { ReverbPanel } from './components/ReverbPanel'
import { DelayPanel } from './components/DelayPanel'
import { FormantPanel } from './components/FormantPanel'
import { DenoisePanel } from './components/DenoisePanel'
import { GenerativePanel } from './components/GenerativePanel'
import { AIChatPanel } from './components/AIChatPanel'
import { DebugPanel } from './components/DebugPanel'
import { SampleBrowser } from './components/SampleBrowser'
import { EffectsChainPanel } from './components/EffectsChainPanel'
import { WaveBackground } from './components/WaveBackground'
import { GuidedTour, TourTrigger } from './components/GuidedTour'
import { WorkspaceStatusBar } from './components/WorkspaceStatusBar'
import { apiUrl } from './lib/api'

const DISPLAY_FONT_STYLE = { fontFamily: 'var(--font-display)' } as const
const BODY_FONT_STYLE = { fontFamily: 'var(--font-body)', letterSpacing: '0.2em' } as const

interface SessionInfo {
  session_id: string
  duration: number
  sample_rate: number
  name: string
  channels?: number
}

type ActivePanel = 'autotune' | 'vocoder' | 'stems' | 'reverb' | 'delay' | 'formant' | 'denoise' | 'generate' | 'ai' | null
type AISuggestionEffect = 'autotune' | 'vocoder' | 'reverb' | 'delay' | 'formant' | 'denoise'

interface AISuggestion {
  label: string
  effect: string
  params: Record<string, unknown>
}

function App() {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [processedKey, setProcessedKey] = useState(0)
  const [showTour, setShowTour] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleAudioLoaded = useCallback((info: SessionInfo) => {
    setSession(info)
    setActivePanel(null)
    setProcessedKey(0)
  }, [])

  const handleProcessed = useCallback(() => {
    setProcessedKey((k) => k + 1)
  }, [])

  const handleApplySuggestion = useCallback(
    async (suggestion: AISuggestion) => {
      if (!session) {
        throw new Error('Load audio before applying AI suggestions')
      }
      const effect = suggestion.effect as AISuggestionEffect
      const supportedEffects: AISuggestionEffect[] = ['autotune', 'vocoder', 'reverb', 'delay', 'formant', 'denoise']
      if (!supportedEffects.includes(effect)) {
        throw new Error(`Unsupported effect: ${suggestion.effect}`)
      }
      const response = await fetch(apiUrl('/api/chain/add'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          effect_type: effect,
          params: suggestion.params ?? {},
          label: suggestion.label ?? '',
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to add AI suggestion to chain (${response.status})`)
      }
      setActivePanel(null)
    },
    [session],
  )

  const handleReset = useCallback(async () => {
    if (!session || processedKey === 0) {
      return
    }

    setResetting(true)
    try {
      const response = await fetch(apiUrl(`/api/session/${session.session_id}/reset`), {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to reset processed audio')
      }
      setProcessedKey(0)
      setActivePanel(null)
    } catch (error) {
      console.error('Reset failed:', error)
    } finally {
      setResetting(false)
    }
  }, [processedKey, session])

  return (
    <div className="relative min-h-screen text-zinc-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10000 focus:rounded-md focus:bg-zinc-900 focus:px-3 focus:py-2 focus:text-sm focus:text-zinc-100"
        style={BODY_FONT_STYLE}
      >
        Skip to main content
      </a>
      <WaveBackground />

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 pt-8 sm:pt-10 pb-2">
        <div className="mx-auto max-w-5xl animate-fade-up">
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={DISPLAY_FONT_STYLE}
          >
            <span className="text-gradient-amber">Vox</span>{' '}
            <span className="text-white">Machina</span>
          </h1>
          <p className="mt-2 text-sm tracking-widest uppercase text-zinc-500 animate-fade-up delay-1"
             style={BODY_FONT_STYLE}>
            vocal modulation · orchestration · synthesis
          </p>
        </div>
      </header>

      <main id="main-content" className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Audio Input Section */}
        <section className="animate-fade-up delay-2" data-tour="audio-input">
          <AudioRecorder onAudioLoaded={handleAudioLoaded} />
        </section>

        {/* Sample Library */}
        <section className="animate-fade-up delay-3" data-tour="sample-browser">
          <SampleBrowser onSampleLoaded={handleAudioLoaded} />
        </section>

        {/* Workspace */}
        {session && (
          <div className="space-y-6 animate-fade-up">
            <WorkspaceStatusBar
              name={session.name}
              duration={session.duration}
              sampleRate={session.sample_rate}
              channels={session.channels}
              hasProcessedAudio={processedKey > 0}
              onReset={handleReset}
              resetting={resetting}
            />

            {/* Waveforms */}
            <section className="glass-card rounded-2xl p-4 sm:p-6" data-tour="waveform">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500"
                      style={DISPLAY_FONT_STYLE}>
                  Waveform
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Original
                    </span>
                  </div>
                  <WaveformView sessionId={session.session_id} source="original" />
                </div>
                {processedKey > 0 && (
                  <div className="animate-slide-down">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-medium uppercase tracking-wider text-amber-400/70">
                        Processed
                      </span>
                    </div>
                    <WaveformView
                      key={processedKey}
                      sessionId={session.session_id}
                      source="processed"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Effect Selector */}
            <section className="space-y-3" data-tour="effect-selector">
              <p className="text-xs text-zinc-500" style={BODY_FONT_STYLE}>
                Quick edit: open one panel below for focused tweaks. For stacked processing, use the Effects Chain.
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={() => setActivePanel(activePanel === 'autotune' ? null : 'autotune')}
                aria-pressed={activePanel === 'autotune'}
                aria-label="Toggle Auto-Tune panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'autotune'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 glow-amber'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Auto-Tune
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'vocoder' ? null : 'vocoder')}
                aria-pressed={activePanel === 'vocoder'}
                aria-label="Toggle Vocoder panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'vocoder'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 glow-violet'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Vocoder
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'stems' ? null : 'stems')}
                aria-pressed={activePanel === 'stems'}
                aria-label="Toggle Stems panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'stems'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Stems
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'reverb' ? null : 'reverb')}
                aria-pressed={activePanel === 'reverb'}
                aria-label="Toggle Reverb panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'reverb'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 glow-rose'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Reverb
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'delay' ? null : 'delay')}
                aria-pressed={activePanel === 'delay'}
                aria-label="Toggle Delay panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'delay'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 glow-sky'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Delay
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'formant' ? null : 'formant')}
                aria-pressed={activePanel === 'formant'}
                aria-label="Toggle Formant panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'formant'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 glow-teal'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Formant
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'denoise' ? null : 'denoise')}
                aria-pressed={activePanel === 'denoise'}
                aria-label="Toggle Denoise panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'denoise'
                    ? 'bg-lime-500/20 text-lime-300 border border-lime-500/30 glow-lime'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Denoise
              </button>

              {/* Divider */}
              <div className="h-8 w-px bg-zinc-700/50 mx-1" />

              <button
                onClick={() => setActivePanel(activePanel === 'generate' ? null : 'generate')}
                aria-pressed={activePanel === 'generate'}
                aria-label="Toggle Generate panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'generate'
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 glow-fuchsia'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                Generate
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'ai' ? null : 'ai')}
                aria-pressed={activePanel === 'ai'}
                aria-label="Toggle AI panel"
                className={`group relative rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  activePanel === 'ai'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 glow-indigo'
                    : 'glass-card glass-card-hover text-zinc-400 hover:text-zinc-200'
                }`}
                style={DISPLAY_FONT_STYLE}
              >
                AI
              </button>

              {processedKey > 0 && (
                <a
                  href={apiUrl(`/api/session/${session.session_id}/download?source=processed`)}
                  data-tour="export"
                  className="ml-auto rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold text-emerald-300 transition-all hover:bg-emerald-500/30 glow-emerald"
                  style={DISPLAY_FONT_STYLE}
                  download
                >
                  ↓ Export
                </a>
              )}
              </div>
            </section>

            {/* Effect Panels */}
            {activePanel === 'autotune' && (
              <section className="animate-slide-down">
                <AutoTunePanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'vocoder' && (
              <section className="animate-slide-down">
                <VocoderPanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'stems' && (
              <section className="animate-slide-down">
                <StemSeparationPanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'reverb' && (
              <section className="animate-slide-down">
                <ReverbPanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'delay' && (
              <section className="animate-slide-down">
                <DelayPanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'formant' && (
              <section className="animate-slide-down">
                <FormantPanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'denoise' && (
              <section className="animate-slide-down">
                <DenoisePanel sessionId={session.session_id} onProcessed={handleProcessed} />
              </section>
            )}
            {activePanel === 'generate' && (
              <section className="animate-slide-down">
                <GenerativePanel sessionId={session.session_id} onTrackLoaded={handleAudioLoaded} />
              </section>
            )}
            {activePanel === 'ai' && (
              <section className="animate-slide-down">
                <AIChatPanel sessionId={session.session_id} onApplySuggestion={handleApplySuggestion} />
              </section>
            )}

            {/* Effects Chain */}
            <section data-tour="effects-chain" className="space-y-2">
              <p className="text-xs text-zinc-500" style={BODY_FONT_STYLE}>
                Build pipeline: add multiple effects, reorder them, and process in one pass.
              </p>
              <EffectsChainPanel sessionId={session.session_id} onProcessed={handleProcessed} />
            </section>
          </div>
        )}

        {/* Footer spacer */}
        <div className="h-20" />
      </main>

      <DebugPanel />

      {/* Guided Tour */}
      <GuidedTour
        forceShow={showTour}
        onComplete={() => setShowTour(false)}
      />
      <TourTrigger onClick={() => setShowTour(true)} className="bottom-16 right-4" />
    </div>
  )
}

export default App
