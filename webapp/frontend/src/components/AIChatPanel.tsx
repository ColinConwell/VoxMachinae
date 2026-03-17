import { useState, useCallback, useRef, useEffect } from 'react'
import { apiUrl } from '../lib/api'

interface AIChatProps {
  sessionId: string
  onApplyParams?: (params: Record<string, unknown>) => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  suggestions?: SuggestionAction[]
}

interface SuggestionAction {
  label: string
  effect: string
  params: Record<string, unknown>
}

type AgentMode = 'coach' | 'producer' | 'mixer'

const AGENT_MODES: Record<AgentMode, { label: string; desc: string; systemHint: string; icon: string }> = {
  coach: {
    label: 'Coach',
    desc: 'Learn about effects, DSP concepts, and vocal processing',
    systemHint: 'You are a friendly audio production coach. Explain DSP concepts clearly.',
    icon: '🎓',
  },
  producer: {
    label: 'Producer',
    desc: 'Get creative suggestions for vocal effects and sound design',
    systemHint: 'You are a music producer. Suggest creative vocal processing chains.',
    icon: '🎛',
  },
  mixer: {
    label: 'Mixer',
    desc: 'Auto-optimize parameters based on your audio',
    systemHint: 'You are a mixing engineer. Analyze audio and recommend parameter settings.',
    icon: '🎚',
  },
}

const QUICK_PROMPTS: Record<AgentMode, string[]> = {
  coach: [
    'What is auto-tune and how does it work?',
    'Explain the difference between a vocoder and auto-tune',
    'What does formant shifting do to a voice?',
    'How can I get the T-Pain vocal effect?',
  ],
  producer: [
    'Suggest a vocal chain for a dreamy R&B track',
    'How do I get a Daft Punk robot voice?',
    'Create a lo-fi vocal texture',
    'Make my vocals sound like a radio broadcast',
  ],
  mixer: [
    'Analyze my audio and suggest effects',
    'What auto-tune settings would sound natural?',
    'Optimize my reverb parameters',
    'Find the best vocoder settings for this audio',
  ],
}

const BOUNCE_DELAY_0 = { animationDelay: '0ms' } as const
const BOUNCE_DELAY_1 = { animationDelay: '150ms' } as const
const BOUNCE_DELAY_2 = { animationDelay: '300ms' } as const

function StreamingDots() {
  return (
    <div className="flex gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={BOUNCE_DELAY_0} />
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={BOUNCE_DELAY_1} />
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={BOUNCE_DELAY_2} />
    </div>
  )
}

export function AIChatPanel({ sessionId, onApplyParams }: AIChatProps) {
  const [agentMode, setAgentMode] = useState<AgentMode>('coach')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsStreaming(true)

      // Create placeholder for assistant response
      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        },
      ])

      try {
        const resp = await fetch(apiUrl('/api/ai/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            agent_mode: agentMode,
            message: text.trim(),
            history: messages.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        })

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          throw new Error(errData.detail || `Chat request failed (${resp.status})`)
        }

        const data = await resp.json()

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: data.response,
                  suggestions: data.suggestions || [],
                }
              : m
          )
        )
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `⚠ ${e instanceof Error ? e.message : 'Failed to get response'}`,
                  role: 'system' as const,
                }
              : m
          )
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [sessionId, agentMode, messages, isStreaming]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleApplySuggestion = (suggestion: SuggestionAction) => {
    onApplyParams?.(suggestion.params)
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Applied "${suggestion.label}" → ${suggestion.effect}`,
        timestamp: Date.now(),
      },
    ])
  }

  const modeInfo = AGENT_MODES[agentMode]
  const quickPrompts = QUICK_PROMPTS[agentMode]

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-indigo-500/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3
              className="text-lg font-bold text-indigo-300"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              AI Assistant
            </h3>
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-indigo-400">
              {modeInfo.icon} {modeInfo.label}
            </span>
          </div>
          {/* Mode selector */}
          <div className="flex gap-1">
            {(Object.keys(AGENT_MODES) as AgentMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setAgentMode(mode)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  agentMode === mode
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                {AGENT_MODES[mode].icon} {AGENT_MODES[mode].label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{modeInfo.desc}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="space-y-4 py-4">
            <p className="text-center text-xs text-zinc-600">
              Ask me anything about vocal effects and audio processing
            </p>
            <div className="grid grid-cols-1 gap-2">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left rounded-xl bg-indigo-500/5 border border-indigo-500/10 px-4 py-2.5 text-xs text-indigo-300/70 hover:bg-indigo-500/10 hover:text-indigo-200 hover:border-indigo-500/20 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-indigo-500/15 border border-indigo-500/20 text-indigo-100'
                  : msg.role === 'system'
                    ? 'bg-zinc-500/10 border border-zinc-500/10 text-zinc-400 italic'
                    : 'bg-white/3 border border-white/5 text-zinc-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* Suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-indigo-500/10 space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-400/50">
                    Suggested Actions
                  </p>
                  {msg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleApplySuggestion(s)}
                      className="w-full text-left rounded-lg bg-indigo-500/10 border border-indigo-500/15 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-all"
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="text-indigo-400/50 ml-1.5">→ {s.effect}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-white/3 border border-white/5 rounded-2xl px-4 py-3">
              <StreamingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-indigo-500/10 shrink-0">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask the ${modeInfo.label.toLowerCase()} anything…`}
            rows={1}
            className="flex-1 rounded-xl bg-black/30 border border-white/5 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-colors resize-none"
            style={{ fontFamily: 'var(--font-body)' }}
            disabled={isStreaming}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
              !input.trim() || isStreaming
                ? 'bg-white/3 text-zinc-600 border border-white/5 cursor-not-allowed'
                : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/30'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
