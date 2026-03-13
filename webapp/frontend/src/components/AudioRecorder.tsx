import { useState, useRef, useCallback } from 'react'

interface SessionInfo {
  session_id: string
  duration: number
  sample_rate: number
  name: string
}

interface AudioRecorderProps {
  onAudioLoaded: (info: SessionInfo) => void
}

export function AudioRecorder({ onAudioLoaded }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(
    async (file: File | Blob, filename: string) => {
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file, filename)
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error('Upload failed')
        const info = await res.json()
        onAudioLoaded(info)
      } catch (err) {
        console.error('Upload error:', err)
      } finally {
        setIsUploading(false)
      }
    },
    [onAudioLoaded]
  )

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      })
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await uploadFile(blob, 'recording.webm')
      }

      mediaRecorder.start(100)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (err) {
      console.error('Mic access error:', err)
    }
  }, [uploadFile])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) uploadFile(file, file.name)
    },
    [uploadFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) uploadFile(file, file.name)
    },
    [uploadFile]
  )

  return (
    <div
      className={`glass-card rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-all duration-300 ${
        dragOver
          ? 'border-amber-400/60 glow-amber'
          : 'border-white/[0.06]'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {isUploading ? (
        <div className="flex items-center justify-center gap-3 py-4 animate-fade-in">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <span className="text-zinc-400" style={{ fontFamily: 'var(--font-body)' }}>
            Processing audio...
          </span>
        </div>
      ) : (
        <div className="space-y-5 animate-fade-up">
          {isRecording && (
            <div className="flex items-center justify-center gap-2 mb-2 animate-fade-in">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <span className="text-sm text-red-400" style={{ fontFamily: 'var(--font-display)' }}>
                Recording...
              </span>
            </div>
          )}

          <p className="text-zinc-500 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
            Drag & drop an audio file, or use the controls below
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="glass-card glass-card-hover rounded-xl px-6 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-200"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Choose File
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                  : 'glass-card glass-card-hover text-zinc-300'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {isRecording ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs">&#9632;</span> Stop
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Record
                </span>
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <p className="text-[11px] text-zinc-600" style={{ fontFamily: 'var(--font-body)' }}>
            Supports WAV, MP3, FLAC, OGG, WebM
          </p>
        </div>
      )}
    </div>
  )
}
