import { useState } from 'react'

type AudioSource = 'mic' | 'file'

interface LandingPageProps {
  onStart: (source: AudioSource, file?: File) => void
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const [source, setSource] = useState<AudioSource>('mic')
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('audio/')) {
      onStart('file', file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  return (
    <div
      className="relative w-full h-screen bg-[#050508] flex flex-col items-center justify-center overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Vertical line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.03]" />
        {/* Horizontal line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.03]" />
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}
        />
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-purple-500/10 border-2 border-dashed border-purple-500/50 z-50 flex items-center justify-center">
          <p className="text-white/60 text-lg tracking-widest">DROP AUDIO FILE</p>
        </div>
      )}

      {/* Version label */}
      <p className="absolute top-8 text-white/30 text-xs tracking-[0.3em] font-light">
        VERSION 0.1.0
      </p>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo */}
        <h1 className="text-white text-6xl md:text-8xl tracking-tight font-light select-none">
          <span className="font-extralight">JAM</span>
          <span className="font-medium">VIZ</span>
        </h1>

        {/* Tagline */}
        <p className="text-white/50 text-lg md:text-xl italic font-light tracking-wide">
          See what you hear
        </p>

        {/* CTA Button */}
        <button
          onClick={() => source === 'mic' ? onStart('mic') : document.getElementById('file-input')?.click()}
          className="mt-8 px-12 py-4 border border-white/20 text-white/70 text-sm tracking-[0.25em] 
                     hover:bg-white/5 hover:border-white/40 hover:text-white
                     transition-all duration-300 ease-out"
        >
          VISUALIZE
        </button>

        <input
          id="file-input"
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-8 flex flex-col items-center gap-4">
        <p className="text-white/20 text-xs tracking-[0.3em]">
          VISUAL SYNTHESIZER
        </p>

        {/* Source toggle */}
        <div className="flex items-center gap-1 bg-white/5 rounded p-1">
          <button
            onClick={() => setSource('mic')}
            className={`px-4 py-2 text-xs tracking-widest transition-all duration-200 rounded ${
              source === 'mic'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <MicIcon />
              MIC
            </span>
          </button>
          <button
            onClick={() => setSource('file')}
            className={`px-4 py-2 text-xs tracking-widest transition-all duration-200 rounded ${
              source === 'file'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <MusicIcon />
              MUSIC
            </span>
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-emerald-500/80 text-xs tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
          READY
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-white/10" />
      <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-white/10" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-white/10" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-white/10" />
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}