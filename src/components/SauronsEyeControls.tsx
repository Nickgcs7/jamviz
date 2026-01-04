import { useState, useCallback, useEffect } from 'react'
import {
  setSauronsEyeConfig,
  getSauronsEyeConfig,
  setSauronsEyeGeometry,
  setSauronsEyeBeam,
  setSauronsEyeEmbers,
  setSauronsEyeAudioResponse,
  setSauronsEyeAnimation,
  setSauronsEyeColorMode,
  setSauronsEyeGradient,
  resetSauronsEyeConfig,
  builtInGradients,
  type SauronsEyeConfig
} from '@/lib/visualizations'

interface SauronsEyeControlsProps {
  visible: boolean
  onClose: () => void
}

export default function SauronsEyeControls({ visible, onClose }: SauronsEyeControlsProps) {
  const [config, setConfig] = useState<SauronsEyeConfig>(getSauronsEyeConfig())
  const [activeTab, setActiveTab] = useState<'eye' | 'beam' | 'color' | 'effects'>('eye')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const updateConfig = useCallback((updates: Partial<SauronsEyeConfig>) => {
    setSauronsEyeConfig(updates)
    setConfig(getSauronsEyeConfig())
  }, [])

  if (!visible) return null

  const gradientNames = Object.keys(builtInGradients)

  // Mobile: full screen overlay, Desktop: side panel
  const panelClasses = isMobile 
    ? "fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col"
    : "absolute top-20 right-4 w-72 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden z-50"

  return (
    <div className={panelClasses}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-lg">🔥</span>
          <h3 className="text-white/90 font-medium text-sm">Sauron&apos;s Eye Settings</h3>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-2 -mr-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex border-b border-white/10 shrink-0">
        {(['eye', 'beam', 'color', 'effects'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2.5 sm:py-2 text-xs capitalize transition-colors ${
              activeTab === tab
                ? 'text-orange-400 border-b-2 border-orange-400 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={`p-4 space-y-4 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-80'}`}>
        {activeTab === 'eye' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Eye Size</label>
                <span className="text-white/80 text-xs">{config.eyeSize}</span>
              </div>
              <input
                type="range"
                min="6"
                max="20"
                step="1"
                value={config.eyeSize}
                onChange={(e) => {
                  setSauronsEyeGeometry({ eyeSize: parseInt(e.target.value) })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Iris Rings</label>
                <span className="text-white/80 text-xs">{config.irisRings}</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={config.irisRings}
                onChange={(e) => {
                  setSauronsEyeGeometry({ irisRings: parseInt(e.target.value) })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Pupil Width</label>
                <span className="text-white/80 text-xs">{config.pupilWidth.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                value={config.pupilWidth * 10}
                onChange={(e) => {
                  setSauronsEyeGeometry({ pupilWidth: parseInt(e.target.value) / 10 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Pupil Height</label>
                <span className="text-white/80 text-xs">{config.pupilHeight}</span>
              </div>
              <input
                type="range"
                min="8"
                max="30"
                step="1"
                value={config.pupilHeight}
                onChange={(e) => {
                  setSauronsEyeGeometry({ pupilHeight: parseInt(e.target.value) })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-white/40 text-xs mb-3">Embers</p>
              
              <div className="flex items-center justify-between mb-3">
                <label className="text-white/60 text-xs">Show Embers</label>
                <button
                  onClick={() => {
                    setSauronsEyeEmbers({ embersEnabled: !config.embersEnabled })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                    config.embersEnabled
                      ? 'bg-orange-500/30 text-orange-400 border border-orange-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {config.embersEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Ember Count</label>
                  <span className="text-white/80 text-xs">{config.emberCount}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="400"
                  step="25"
                  value={config.emberCount}
                  onChange={(e) => {
                    setSauronsEyeEmbers({ emberCount: parseInt(e.target.value) })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Orbit Speed</label>
                  <span className="text-white/80 text-xs">{config.emberOrbitSpeed.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={config.emberOrbitSpeed * 100}
                  onChange={(e) => {
                    setSauronsEyeEmbers({ emberOrbitSpeed: parseInt(e.target.value) / 100 })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'beam' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <label className="text-white/60 text-xs">Enable Beam</label>
              <button
                onClick={() => {
                  setSauronsEyeBeam({ beamEnabled: !config.beamEnabled })
                  setConfig(getSauronsEyeConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.beamEnabled
                    ? 'bg-orange-500/30 text-orange-400 border border-orange-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.beamEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Beam Length</label>
                <span className="text-white/80 text-xs">{config.beamLength}</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="5"
                value={config.beamLength}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamLength: parseInt(e.target.value) })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Beam Width</label>
                <span className="text-white/80 text-xs">{config.beamWidth}</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="2"
                value={config.beamWidth}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamWidth: parseInt(e.target.value) })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Sweep Range</label>
                <span className="text-white/80 text-xs">{Math.round(config.beamSweepRange * 180 / Math.PI)}°</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={Math.round(config.beamSweepRange * 180 / Math.PI)}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamSweepRange: parseInt(e.target.value) * Math.PI / 180 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Sweep Speed</label>
                <span className="text-white/80 text-xs">{config.beamSweepSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={config.beamSweepSpeed * 100}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamSweepSpeed: parseInt(e.target.value) / 100 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Beam Intensity</label>
                <span className="text-white/80 text-xs">{Math.round(config.beamIntensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                value={config.beamIntensity * 100}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamIntensity: parseInt(e.target.value) / 100 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Beam Particles</label>
                <span className="text-white/80 text-xs">{config.beamParticleCount}</span>
              </div>
              <input
                type="range"
                min="200"
                max="1500"
                step="100"
                value={config.beamParticleCount}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamParticleCount: parseInt(e.target.value) })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </>
        )}

        {activeTab === 'color' && (
          <>
            <div className="space-y-2">
              <label className="text-white/60 text-xs">Color Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gradient', 'pulse', 'rainbow', 'fire'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSauronsEyeColorMode(mode)
                      setConfig(getSauronsEyeConfig())
                    }}
                    className={`px-2 py-2 sm:py-1.5 rounded text-xs capitalize transition-colors ${
                      config.colorMode === mode
                        ? 'bg-orange-500/30 text-orange-400 border border-orange-500/30'
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
              <div className="grid grid-cols-2 gap-2 max-h-40 sm:max-h-32 overflow-y-auto">
                {gradientNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setSauronsEyeGradient(builtInGradients[name])
                      setConfig(getSauronsEyeConfig())
                    }}
                    className={`px-2 py-2 sm:py-1.5 rounded text-xs capitalize transition-colors ${
                      config.gradient.name === builtInGradients[name].name
                        ? 'bg-orange-500/30 text-orange-400 border border-orange-500/30'
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
                <label className="text-white/60 text-xs">Color Cycle Speed</label>
                <span className="text-white/80 text-xs">{config.colorCycleSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={config.colorCycleSpeed * 100}
                onChange={(e) => {
                  updateConfig({ colorCycleSpeed: parseInt(e.target.value) / 100 })
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
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
                  setSauronsEyeAnimation({ glowIntensity: parseInt(e.target.value) / 100 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </>
        )}

        {activeTab === 'effects' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Swirl Speed</label>
                <span className="text-white/80 text-xs">{config.swirlSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={config.swirlSpeed * 100}
                onChange={(e) => {
                  setSauronsEyeAnimation({ swirlSpeed: parseInt(e.target.value) / 100 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Pulse Speed</label>
                <span className="text-white/80 text-xs">{config.pulseSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={config.pulseSpeed * 10}
                onChange={(e) => {
                  setSauronsEyeAnimation({ pulseSpeed: parseInt(e.target.value) / 10 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="pt-2 border-t border-white/5">
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
                    setSauronsEyeAudioResponse({ beatReactivity: parseInt(e.target.value) / 10 })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                    setSauronsEyeAudioResponse({ bassInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Mid Influence</label>
                  <span className="text-white/80 text-xs">{config.midInfluence.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.midInfluence * 10}
                  onChange={(e) => {
                    setSauronsEyeAudioResponse({ midInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">High Influence</label>
                  <span className="text-white/80 text-xs">{config.highInfluence.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.highInfluence * 10}
                  onChange={(e) => {
                    setSauronsEyeAudioResponse({ highInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Smoothing</label>
                  <span className="text-white/80 text-xs">{config.smoothingFactor.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  value={config.smoothingFactor * 100}
                  onChange={(e) => {
                    setSauronsEyeAudioResponse({ smoothingFactor: parseInt(e.target.value) / 100 })
                    setConfig(getSauronsEyeConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/10 bg-white/5 shrink-0">
        <button
          onClick={() => {
            resetSauronsEyeConfig()
            setConfig(getSauronsEyeConfig())
          }}
          className="w-full px-3 py-2 sm:py-1.5 rounded bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
