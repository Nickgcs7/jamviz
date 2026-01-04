import { useState, useCallback } from 'react'
import {
  setRoadwayConfig,
  getRoadwayConfig,
  setRoadwayLaneParams,
  setRoadwayLineParams,
  setRoadwayEffects,
  setRoadwayAudioResponse,
  setRoadwayColorMode,
  setRoadwayGradient,
  resetRoadwayConfig,
  builtInGradients,
  type RoadwayConfig
} from '@/lib/visualizations'

interface RoadwayControlsProps {
  visible: boolean
  onClose: () => void
}

export default function RoadwayControls({ visible, onClose }: RoadwayControlsProps) {
  const [config, setConfig] = useState<RoadwayConfig>(getRoadwayConfig())
  const [activeTab, setActiveTab] = useState<'road' | 'lines' | 'color' | 'effects'>('road')

  const updateConfig = useCallback((updates: Partial<RoadwayConfig>) => {
    setRoadwayConfig(updates)
    setConfig(getRoadwayConfig())
  }, [])

  if (!visible) return null

  const gradientNames = Object.keys(builtInGradients)

  return (
    <div className="absolute top-20 right-4 w-72 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-white/90 font-medium text-sm">Roadway Settings</h3>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['road', 'lines', 'color', 'effects'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2 text-xs capitalize transition-colors ${
              activeTab === tab
                ? 'text-emerald-400 border-b-2 border-emerald-400 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {/* Road Settings */}
        {activeTab === 'road' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Lane Count</label>
                <span className="text-white/80 text-xs">{config.laneCount}</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={config.laneCount}
                onChange={(e) => {
                  setRoadwayLaneParams({ laneCount: parseInt(e.target.value) })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Horizon Distance</label>
                <span className="text-white/80 text-xs">{config.horizonDistance}</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={config.horizonDistance}
                onChange={(e) => {
                  setRoadwayLaneParams({ horizonDistance: parseInt(e.target.value) })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Road Curvature</label>
                <span className="text-white/80 text-xs">{config.roadCurvature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={config.roadCurvature * 100}
                onChange={(e) => {
                  setRoadwayLaneParams({ roadCurvature: parseInt(e.target.value) / 100 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Perspective</label>
                <span className="text-white/80 text-xs">{Math.round(config.perspectiveIntensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                value={config.perspectiveIntensity * 100}
                onChange={(e) => {
                  setRoadwayEffects({ perspectiveIntensity: parseInt(e.target.value) / 100 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Cell Size</label>
                <span className="text-white/80 text-xs">{config.cellSize.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="8"
                max="30"
                value={config.cellSize * 10}
                onChange={(e) => {
                  setRoadwayLaneParams({ cellSize: parseInt(e.target.value) / 10 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </>
        )}

        {/* Lines Settings */}
        {activeTab === 'lines' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Base Speed</label>
                <span className="text-white/80 text-xs">{config.lineSpeed}</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={config.lineSpeed}
                onChange={(e) => {
                  setRoadwayLineParams({ lineSpeed: parseInt(e.target.value) })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Speed Boost (Bass)</label>
                <span className="text-white/80 text-xs">{config.lineSpeedBoost}</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="2"
                value={config.lineSpeedBoost}
                onChange={(e) => {
                  setRoadwayLineParams({ lineSpeedBoost: parseInt(e.target.value) })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Line Glow</label>
                <span className="text-white/80 text-xs">{Math.round(config.lineGlow * 100)}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                value={config.lineGlow * 100}
                onChange={(e) => {
                  setRoadwayLineParams({ lineGlow: parseInt(e.target.value) / 100 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Show Sidelines</label>
              <button
                onClick={() => {
                  setRoadwayLineParams({ showSidelines: !config.showSidelines })
                  setConfig(getRoadwayConfig())
                }}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  config.showSidelines
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.showSidelines ? 'On' : 'Off'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Smoothing</label>
                <span className="text-white/80 text-xs">{config.smoothingFactor.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                value={config.smoothingFactor * 100}
                onChange={(e) => {
                  setRoadwayAudioResponse({ smoothingFactor: parseInt(e.target.value) / 100 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </>
        )}

        {/* Color Settings */}
        {activeTab === 'color' && (
          <>
            <div className="space-y-2">
              <label className="text-white/60 text-xs">Color Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gradient', 'speed-reactive', 'beat-reactive', 'frequency'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setRoadwayColorMode(mode)
                      setConfig(getRoadwayConfig())
                    }}
                    className={`px-2 py-1.5 rounded text-xs capitalize transition-colors ${
                      config.colorMode === mode
                        ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {mode.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-white/60 text-xs">Gradient</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {gradientNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setRoadwayGradient(builtInGradients[name])
                      setConfig(getRoadwayConfig())
                    }}
                    className={`px-2 py-1.5 rounded text-xs capitalize transition-colors ${
                      config.gradient.name === builtInGradients[name].name
                        ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
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
                <span className="text-white/80 text-xs">{config.colorCycleSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={config.colorCycleSpeed * 10}
                onChange={(e) => {
                  updateConfig({ colorCycleSpeed: parseInt(e.target.value) / 10 })
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </>
        )}

        {/* Effects Settings */}
        {activeTab === 'effects' && (
          <>
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
                  setRoadwayEffects({ beatReactivity: parseInt(e.target.value) / 10 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Camera Sway</label>
                <span className="text-white/80 text-xs">{config.cameraSway.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={config.cameraSway * 10}
                onChange={(e) => {
                  setRoadwayEffects({ cameraSway: parseInt(e.target.value) / 10 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Sway Speed</label>
                <span className="text-white/80 text-xs">{config.cameraSwaySpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={config.cameraSwaySpeed * 10}
                onChange={(e) => {
                  setRoadwayEffects({ cameraSwaySpeed: parseInt(e.target.value) / 10 })
                  setConfig(getRoadwayConfig())
                }}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-white/40 text-xs mb-3">Audio Response</p>

              <div className="space-y-2">
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
                    setRoadwayAudioResponse({ bassInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getRoadwayConfig())
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
                    setRoadwayAudioResponse({ midInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getRoadwayConfig())
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
                    setRoadwayAudioResponse({ highInfluence: parseInt(e.target.value) / 10 })
                    setConfig(getRoadwayConfig())
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 text-xs">Stereo Separation</label>
                  <span className="text-white/80 text-xs">{config.stereoSeparation.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.stereoSeparation * 10}
                  onChange={(e) => {
                    setRoadwayAudioResponse({ stereoSeparation: parseInt(e.target.value) / 10 })
                    setConfig(getRoadwayConfig())
                  }}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/5">
        <button
          onClick={() => {
            resetRoadwayConfig()
            setConfig(getRoadwayConfig())
          }}
          className="w-full px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
