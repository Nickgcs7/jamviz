import { useState, useCallback } from 'react'
import {
  setLavaLampConfig,
  getLavaLampConfig,
  setLavaLampBlobs,
  setLavaLampMovement,
  setLavaLampPhysics,
  setLavaLampColors,
  setLavaLampAudioResponse,
  setLavaLampColorMode,
  setLavaLampGradient,
  resetLavaLampConfig,
  builtInGradients,
  type LavaLampConfig
} from '@/lib/visualizations'

interface LavaLampControlsProps {
  visible: boolean
  onClose: () => void
}

export default function LavaLampControls({ visible, onClose }: LavaLampControlsProps) {
  const [config, setConfig] = useState<LavaLampConfig>(getLavaLampConfig())
  const [activeTab, setActiveTab] = useState<'blobs' | 'movement' | 'physics' | 'color'>('blobs')

  const updateConfig = useCallback((updates: Partial<LavaLampConfig>) => {
    setLavaLampConfig(updates)
    setConfig(getLavaLampConfig())
  }, [])

  if (!visible) return null

  const gradientNames = Object.keys(builtInGradients)

  return (
    <div className="absolute top-20 right-4 w-72 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-lg">🫧</span>
          <h3 className="text-white/90 font-medium text-sm">Lava Lamp Settings</h3>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex border-b border-white/10">
        {(['blobs', 'movement', 'physics', 'color'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2 text-xs capitalize transition-colors ${
              activeTab === tab
                ? 'text-purple-400 border-b-2 border-purple-400 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {activeTab === 'blobs' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Blob Count</label>
                <span className="text-white/80 text-xs">{config.blobCount}</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={config.blobCount}
                onChange={(e) => {
                  setLavaLampBlobs({ blobCount: parseInt(e.target.value) })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Min Size</label>
                <span className="text-white/80 text-xs">{config.minSize}</span>
              </div>
              <input
                type="range"
                min="2"
                max="8"
                step="1"
                value={config.minSize}
                onChange={(e) => {
                  setLavaLampBlobs({ minSize: parseInt(e.target.value) })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Max Size</label>
                <span className="text-white/80 text-xs">{config.maxSize}</span>
              </div>
              <input
                type="range"
                min="6"
                max="20"
                step="1"
                value={config.maxSize}
                onChange={(e) => {
                  setLavaLampBlobs({ maxSize: parseInt(e.target.value) })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Merge Threshold</label>
                <span className="text-white/80 text-xs">{config.mergeThreshold.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={config.mergeThreshold * 10}
                onChange={(e) => {
                  setLavaLampBlobs({ mergeThreshold: parseInt(e.target.value) / 10 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </>
        )}

        {activeTab === 'movement' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Rise Speed</label>
                <span className="text-white/80 text-xs">{config.riseSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={config.riseSpeed * 10}
                onChange={(e) => {
                  setLavaLampMovement({ riseSpeed: parseInt(e.target.value) / 10 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Sink Speed</label>
                <span className="text-white/80 text-xs">{config.sinkSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={config.sinkSpeed * 10}
                onChange={(e) => {
                  setLavaLampMovement({ sinkSpeed: parseInt(e.target.value) / 10 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Wander Strength</label>
                <span className="text-white/80 text-xs">{config.wanderStrength.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={config.wanderStrength * 10}
                onChange={(e) => {
                  setLavaLampMovement({ wanderStrength: parseInt(e.target.value) / 10 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Wander Speed</label>
                <span className="text-white/80 text-xs">{config.wanderSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={config.wanderSpeed * 100}
                onChange={(e) => {
                  setLavaLampMovement({ wanderSpeed: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Turbulence</label>
                <span className="text-white/80 text-xs">{config.turbulence.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.turbulence * 100}
                onChange={(e) => {
                  setLavaLampMovement({ turbulence: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </>
        )}

        {activeTab === 'physics' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Gravity</label>
                <span className="text-white/80 text-xs">{config.gravity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={config.gravity * 100}
                onChange={(e) => {
                  setLavaLampPhysics({ gravity: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Buoyancy</label>
                <span className="text-white/80 text-xs">{config.buoyancy.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                value={config.buoyancy * 100}
                onChange={(e) => {
                  setLavaLampPhysics({ buoyancy: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Viscosity</label>
                <span className="text-white/80 text-xs">{config.viscosity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="80"
                max="100"
                value={config.viscosity * 100}
                onChange={(e) => {
                  setLavaLampPhysics({ viscosity: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="pt-3 border-t border-white/5">
              <p className="text-white/40 text-xs mb-3">Edge Behavior</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setLavaLampPhysics({ bounceEdges: true, wrapEdges: false })
                    setConfig(getLavaLampConfig())
                  }}
                  className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
                    config.bounceEdges
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  Bounce
                </button>
                <button
                  onClick={() => {
                    setLavaLampPhysics({ bounceEdges: false, wrapEdges: true })
                    setConfig(getLavaLampConfig())
                  }}
                  className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
                    config.wrapEdges
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  Wrap
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <p className="text-white/40 text-xs mb-3">Audio Response</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Beat Reactivity</label>
                  <span className="text-white/80 text-xs">{config.beatReactivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.beatReactivity * 10}
                  onChange={(e) => {
                    setLavaLampAudioResponse({ beatReactivity: parseInt(e.target.value) / 10 })
                    setConfig(getLavaLampConfig())
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Bass Influence</label>
                  <span className="text-white/80 text-xs">{config.bassInfluence.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.bassInfluence * 10}
                  onChange={(e) => {
                    setLavaLampAudioResponse({ bassInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getLavaLampConfig())
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'color' && (
          <>
            <div className="space-y-2">
              <label className="text-white/60 text-xs">Color Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gradient', 'temperature', 'audio', 'cycling'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setLavaLampColorMode(mode)
                      setConfig(getLavaLampConfig())
                    }}
                    className={`px-2 py-1.5 rounded text-xs capitalize transition-colors ${
                      config.colorMode === mode
                        ? 'bg-purple-500/30 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-white/60 text-xs">Gradient</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {gradientNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setLavaLampGradient(builtInGradients[name])
                      setConfig(getLavaLampConfig())
                    }}
                    className={`px-2 py-1.5 rounded text-xs capitalize transition-colors ${
                      config.gradient.name === builtInGradients[name].name
                        ? 'bg-purple-500/30 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Glow Intensity</label>
                <span className="text-white/80 text-xs">{Math.round(config.glowIntensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                value={config.glowIntensity * 100}
                onChange={(e) => {
                  setLavaLampColors({ glowIntensity: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Color Cycle Speed</label>
                <span className="text-white/80 text-xs">{config.colorCycleSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={config.colorCycleSpeed * 100}
                onChange={(e) => {
                  setLavaLampColors({ colorCycleSpeed: parseInt(e.target.value) / 100 })
                  setConfig(getLavaLampConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/10 bg-white/5">
        <button
          onClick={() => {
            resetLavaLampConfig()
            setConfig(getLavaLampConfig())
          }}
          className="w-full px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
