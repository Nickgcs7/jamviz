import type { VisualizationMode } from '@/lib/visualizations'

interface ControlsProps {
  isListening: boolean
  isPlaying: boolean
  audioSource: 'mic' | 'file'
  fileName: string | null
  currentMode: VisualizationMode
  modes: VisualizationMode[]
  error: string | null
  onTogglePlayback: () => void
  onModeChange: (mode: VisualizationMode) => void
  onBack: () => void
}

export default function Controls({
  isListening,
  isPlaying,
  audioSource,
  fileName,
  currentMode,
  modes,
  error,
  onTogglePlayback,
  onModeChange,
  onBack
}: ControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
      {/* Back button */}
      <button
        onClick={onBack}
        className="w-fit px-4 py-2 text-white/50 text-xs tracking-widest 
                   hover:text-white transition-colors flex items-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        BACK
      </button>

      {/* Audio source indicator */}
      {audioSource === 'file' && fileName && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded text-white/60 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span className="truncate max-w-[150px]">{fileName}</span>
        </div>
      )}

      {/* Play/Pause for file mode */}
      {audioSource === 'file' && (
        <button
          onClick={onTogglePlayback}
          className={`px-5 py-2.5 rounded text-sm tracking-widest transition-all border ${
            isPlaying
              ? 'border-white/20 text-white/70 hover:bg-white/5'
              : 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10'
          }`}
        >
          {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
      )}

      {/* Mic indicator */}
      {audioSource === 'mic' && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded text-xs tracking-widest ${
          isListening ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
          {isListening ? 'RECORDING' : 'MIC OFF'}
        </div>
      )}

      {/* Mode selector */}
      <div className="flex flex-col gap-1 mt-2">
        <p className="text-white/30 text-xs tracking-widest px-1 mb-1">SCENES</p>
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode)}
            className={`px-4 py-2 rounded text-xs tracking-wider text-left transition-all ${
              currentMode.id === mode.id
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title={mode.description}
          >
            {mode.name.toUpperCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded max-w-xs tracking-wide">
          {error}
        </div>
      )}
    </div>
  )
}