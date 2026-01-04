import { useState, useEffect } from 'react'
import {
  getLaserArrayConfig,
  setLaserArrayLasers,
  setLaserArrayOrigin,
  setLaserArrayAnimation,
  setLaserArrayEffects,
  setLaserArrayAudioResponse,
  setLaserArrayColorMode,
  setLaserArrayGradient,
  resetLaserArrayConfig,
  builtInGradients,
  type LaserArrayConfig
} from '@/lib/visualizations'

interface LaserArrayControlsProps {
  visible: boolean
  onClose: () => void
}

export default function LaserArrayControls({ visible, onClose }: LaserArrayControlsProps) {
  const [config, setConfig] = useState<LaserArrayConfig>(getLaserArrayConfig())
  const [activeTab, setActiveTab] = useState<'lasers' | 'animation' | 'color' | 'effects'>('lasers')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
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
          <span className="text-cyan-400 text-lg">⚡</span>
          <h3 className="text-white/90 font-medium text-sm">Laser Array Settings</h3>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-2 -mr-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex border-b border-white/10 shrink-0">
        {(['lasers', 'animation', 'color', 'effects'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2.5 sm:py-2 text-xs capitalize transition-colors ${
              activeTab === tab
                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={`p-4 space-y-4 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-80'}`}>
        {activeTab === 'lasers' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Laser Count</label>
                <span className="text-white/80 text-xs">{config.laserCount}</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={config.laserCount}
                onChange={(e) => {
                  setLaserArrayLasers({ laserCount: parseInt(e.target.value) })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Beams Per Laser</label>
                <span className="text-white/80 text-xs">{config.beamsPerLaser}</span>
              </div>
              <input
                type="range"
                min="3"
                max="12"
                step="1"
                value={config.beamsPerLaser}
                onChange={(e) => {
                  setLaserArrayLasers({ beamsPerLaser: parseInt(e.target.value) })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Beam Length</label>
                <span className="text-white/80 text-xs">{config.laserLength}</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="5"
                value={config.laserLength}
                onChange={(e) => {
                  setLaserArrayLasers({ laserLength: parseInt(e.target.value) })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Origin Spread</label>
                <span className="text-white/80 text-xs">{config.originSpread}</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={config.originSpread}
                onChange={(e) => {
                  setLaserArrayOrigin({ originSpread: parseInt(e.target.value) })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </>
        )}

        {activeTab === 'animation' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Sweep Speed</label>
                <span className="text-white/80 text-xs">{config.sweepSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={config.sweepSpeed * 10}
                onChange={(e) => {
                  setLaserArrayAnimation({ sweepSpeed: parseInt(e.target.value) / 10 })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Sweep Range</label>
                <span className="text-white/80 text-xs">{config.sweepRange}°</span>
              </div>
              <input
                type="range"
                min="15"
                max="90"
                step="5"
                value={config.sweepRange}
                onChange={(e) => {
                  setLaserArrayAnimation({ sweepRange: parseInt(e.target.value) })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="pt-2 border-t border-white/5">
              <button
                onClick={() => {
                  setLaserArrayAnimation({ syncToBeats: !config.syncToBeats })
                  setConfig(getLaserArrayConfig())
                }}
                className={`w-full px-3 py-2.5 sm:py-2 rounded text-xs transition-colors ${
                  config.syncToBeats
                    ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                Sync to Beats: {config.syncToBeats ? 'ON' : 'OFF'}
              </button>
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
                    setLaserArrayAudioResponse({ beatReactivity: parseInt(e.target.value) / 10 })
                    setConfig(getLaserArrayConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
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
                    setLaserArrayAudioResponse({ bassInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getLaserArrayConfig())
                  }}
                  className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
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
                {(['gradient', 'bar-level', 'stereo', 'rainbow'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setLaserArrayColorMode(mode)
                      setConfig(getLaserArrayConfig())
                    }}
                    className={`px-2 py-2 sm:py-1.5 rounded text-xs capitalize transition-colors ${
                      config.colorMode === mode
                        ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
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
                      setLaserArrayGradient(builtInGradients[name])
                      setConfig(getLaserArrayConfig())
                    }}
                    className={`px-2 py-2 sm:py-1.5 rounded text-xs capitalize transition-colors ${
                      config.gradient.name === builtInGradients[name].name
                        ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
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
                  setLaserArrayEffects({ glowIntensity: parseInt(e.target.value) / 100 })
                  setConfig(getLaserArrayConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </>
        )}

        {activeTab === 'effects' && (
          <>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setLaserArrayEffects({ fogEnabled: !config.fogEnabled })
                  setConfig(getLaserArrayConfig())
                }}
                className={`w-full px-3 py-2.5 sm:py-2 rounded text-xs transition-colors ${
                  config.fogEnabled
                    ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                Fog/Haze: {config.fogEnabled ? 'ON' : 'OFF'}
              </button>

              {config.fogEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-white/60 text-xs">Fog Density</label>
                    <span className="text-white/80 text-xs">{Math.round(config.fogDensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={config.fogDensity * 100}
                    onChange={(e) => {
                      setLaserArrayEffects({ fogDensity: parseInt(e.target.value) / 100 })
                      setConfig(getLaserArrayConfig())
                    }}
                    className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/5">
              <button
                onClick={() => {
                  setLaserArrayEffects({ mirrorMode: !config.mirrorMode })
                  setConfig(getLaserArrayConfig())
                }}
                className={`w-full px-3 py-2.5 sm:py-2 rounded text-xs transition-colors ${
                  config.mirrorMode
                    ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                Mirror Mode: {config.mirrorMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="pt-3 border-t border-white/5">
              <button
                onClick={() => {
                  setLaserArrayEffects({ trailParticles: !config.trailParticles })
                  setConfig(getLaserArrayConfig())
                }}
                className={`w-full px-3 py-2.5 sm:py-2 rounded text-xs transition-colors ${
                  config.trailParticles
                    ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                Trail Particles: {config.trailParticles ? 'ON' : 'OFF'}
              </button>

              {config.trailParticles && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white/60 text-xs">Trail Density</label>
                    <span className="text-white/80 text-xs">{Math.round(config.trailDensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={config.trailDensity * 100}
                    onChange={(e) => {
                      setLaserArrayEffects({ trailDensity: parseInt(e.target.value) / 100 })
                      setConfig(getLaserArrayConfig())
                    }}
                    className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/10 bg-white/5 shrink-0">
        <button
          onClick={() => {
            resetLaserArrayConfig()
            setConfig(getLaserArrayConfig())
          }}
          className="w-full px-3 py-2 sm:py-1.5 rounded bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
