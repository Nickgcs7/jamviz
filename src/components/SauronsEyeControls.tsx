import { useState, useCallback } from 'react'
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

  const updateConfig = useCallback((updates: Partial<SauronsEyeConfig>) => {
    setSauronsEyeConfig(updates)
    setConfig(getSauronsEyeConfig())
  }, [])

  if (!visible) return null

  const gradientNames = Object.keys(builtInGradients)

  return (
    <div className="absolute top-20 right-4 w-72 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-lg">👁️‍🗨️</span>
          <h3 className="text-white/90 font-medium text-sm">Sauron's Eye Settings</h3>
        </div>
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
        {(['eye', 'beam', 'color', 'effects'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2 text-xs capitalize transition-colors ${
              activeTab === tab
                ? 'text-orange-400 border-b-2 border-orange-400 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {/* Eye Settings */}
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                  className={`px-3 py-1 rounded text-xs transition-colors ${
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
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </>
        )}

        {/* Beam Settings */}
        {activeTab === 'beam' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <label className="text-white/60 text-xs">Enable Beam</label>
              <button
                onClick={() => {
                  setSauronsEyeBeam({ beamEnabled: !config.beamEnabled })
                  setConfig(getSauronsEyeConfig())
                }}
                className={`px-3 py-1 rounded text-xs transition-colors ${
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                value={config.beamSweepRange * 180 / Math.PI}
                onChange={(e) => {
                  setSauronsEyeBeam({ beamSweepRange: parseInt(e.target.value) * Math.PI / 180 })
                  setConfig(getSauronsEyeConfig())
                }}
                className="w-full h-1 bg-white/10 rounde