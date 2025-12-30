import type { VisualizationMode } from '@/lib/visualizations'

interface ControlsProps {
  isListening: boolean
  currentMode: VisualizationMode
  modes: VisualizationMode[]
  error: string | null
  onToggleListening: () => void
  onModeChange: (mode: VisualizationMode) => void
}

export default function Controls({
  isListening,
  currentMode,
  modes,
  error,
  onToggleListening,
  onModeChange
}: ControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
      <button
        onClick={onToggleListening}
        className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
          isListening
            ? 'bg-red-500/80 hover:bg-red-500 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
        }`}
      >
        {isListening ? '⏹ Stop' : '🎤 Start Mic'}
      </button>

      <div className="flex flex-col gap-1">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode)}
            className={`px-4 py-2 rounded text-sm text-left transition-all ${
              currentMode.id === mode.id
                ? 'bg-purple-500/80 text-white'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
            title={mode.description}
          >
            {mode.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded max-w-xs">
          {error}
        </div>
      )}
    </div>
  )
}