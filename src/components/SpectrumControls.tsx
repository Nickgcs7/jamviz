import { useState, useCallback, useEffect } from 'react'
import {
  setSpectrumConfig,
  getSpectrumConfig,
  setSpectrumSpin,
  setLedParams,
  setReflexParams,
  setPeakParams,
  setOverlayParams,
  setSpectrumColorMode,
  setSpectrumGradient,
  builtInGradients,
  type SpectrumConfig
} from '@/lib/visualizations'

interface SpectrumControlsProps {
  visible: boolean
  onClose: () => void
}

export default function SpectrumControls({ visible, onClose }: SpectrumControlsProps) {
  const [config, setConfig] = useState<SpectrumConfig>(getSpectrumConfig())
  const [activeTab, setActiveTab] = useState<'leds' | 'peaks' | 'reflex' | 'color' | 'overlay'>('leds')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const updateConfig = useCallback((updates: Partial<SpectrumConfig>) => {
    setSpectrumConfig(updates)
    setConfig(getSpectrumConfig())
  }, [])

  if (!visible) return null

  const gradientNames = Object.keys(builtInGradients)

  // Mobile: full screen overlay, Desktop: side panel
  const panelClasses = isMobile 
    ? "fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col"
    : "absolute top-20 right-4 w-72 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden z-50"

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <h3 className="text-white/90 font-medium text-sm">Spectrum Settings</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-2 -mr-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {(['leds', 'peaks', 'reflex', 'color', 'overlay'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-2.5 sm:py-2 text-xs capitalize transition-colors ${
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
      <div className={`p-4 space-y-4 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-80'}`}>
        {/* LED Settings */}
        {activeTab === 'leds' && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">LED Mode</label>
              <button
                onClick={() => {
                  setLedParams({ enabled: !config.ledBars })
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.ledBars
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.ledBars ? 'On' : 'Off'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">LED Count</label>
                <span className="text-white/80 text-xs">{config.maxLeds}</span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                step="4"
                value={config.maxLeds}
                onChange={(e) => {
                  setLedParams({ maxLeds: parseInt(e.target.value) })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Vertical Gap</label>
                <span className="text-white/80 text-xs">{Math.round(config.ledSpaceV * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={config.ledSpaceV * 100}
                onChange={(e) => {
                  setLedParams({ spaceV: parseInt(e.target.value) / 100 })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Horizontal Gap</label>
                <span className="text-white/80 text-xs">{Math.round(config.ledSpaceH * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={config.ledSpaceH * 100}
                onChange={(e) => {
                  setLedParams({ spaceH: parseInt(e.target.value) / 100 })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Rounded Tops</label>
              <button
                onClick={() => updateConfig({ roundedTops: !config.roundedTops })}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.roundedTops
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.roundedTops ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Spin</label>
              <button
                onClick={() => {
                  setSpectrumSpin(!config.spinEnabled)
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.spinEnabled
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.spinEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </>
        )}

        {/* Peak Settings */}
        {activeTab === 'peaks' && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Show Peaks</label>
              <button
                onClick={() => {
                  setPeakParams({ enabled: !config.showPeaks })
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.showPeaks
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.showPeaks ? 'On' : 'Off'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Hold Time</label>
                <span className="text-white/80 text-xs">{config.peakHoldTime}ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={config.peakHoldTime}
                onChange={(e) => {
                  setPeakParams({ holdTime: parseInt(e.target.value) })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Decay Rate</label>
                <span className="text-white/80 text-xs">{config.peakDecayRate.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={config.peakDecayRate * 1000}
                onChange={(e) => {
                  setPeakParams({ decayRate: parseInt(e.target.value) / 1000 })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Peak Glow</label>
              <button
                onClick={() => {
                  setPeakParams({ glow: !config.peakGlow })
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.peakGlow
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.peakGlow ? 'On' : 'Off'}
              </button>
            </div>
          </>
        )}

        {/* Reflex Settings */}
        {activeTab === 'reflex' && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Show Reflection</label>
              <button
                onClick={() => {
                  setReflexParams({ enabled: !config.showReflex })
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.showReflex
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.showReflex ? 'On' : 'Off'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Reflection Size</label>
                <span className="text-white/80 text-xs">{Math.round(config.reflexRatio * 100)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={config.reflexRatio * 100}
                onChange={(e) => {
                  setReflexParams({ ratio: parseInt(e.target.value) / 100 })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Opacity</label>
                <span className="text-white/80 text-xs">{Math.round(config.reflexAlpha * 100)}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={config.reflexAlpha * 100}
                onChange={(e) => {
                  setReflexParams({ alpha: parseInt(e.target.value) / 100 })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-xs">Brightness</label>
                <span className="text-white/80 text-xs">{Math.round(config.reflexBright * 100)}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={config.reflexBright * 100}
                onChange={(e) => {
                  setReflexParams({ brightness: parseInt(e.target.value) / 100 })
                  setConfig(getSpectrumConfig())
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
                {(['gradient', 'bar-index', 'bar-level', 'frequency'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSpectrumColorMode(mode)
                      setConfig(getSpectrumConfig())
                    }}
                    className={`px-2 py-2 sm:py-1.5 rounded text-xs capitalize transition-colors ${
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
              <div className="grid grid-cols-2 gap-2 max-h-40 sm:max-h-32 overflow-y-auto">
                {gradientNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setSpectrumGradient(builtInGradients[name])
                      setConfig(getSpectrumConfig())
                    }}
                    className={`px-2 py-2 sm:py-1.5 rounded text-xs capitalize transition-colors ${
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
                <label className="text-white/60 text-xs">Smoothing</label>
                <span className="text-white/80 text-xs">{config.smoothingFactor.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={config.smoothingFactor * 100}
                onChange={(e) => {
                  updateConfig({ smoothingFactor: parseInt(e.target.value) / 100 })
                }}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </>
        )}

        {/* Overlay Settings */}
        {activeTab === 'overlay' && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Show Scale</label>
              <button
                onClick={() => {
                  setOverlayParams({ showScale: !config.showScale })
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.showScale
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.showScale ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Frequency Labels</label>
              <button
                onClick={() => {
                  setOverlayParams({ showFreqLabels: !config.showFreqLabels })
                  setConfig(getSpectrumConfig())
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs transition-colors ${
                  config.showFreqLabels
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
              >
                {config.showFreqLabels ? 'On' : 'Off'}
              </button>
            </div>

            <p className="text-white/30 text-xs mt-2">
              The 2D overlay shows dB scale, frequency labels, and BPM detection on a crisp canvas layer.
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/5 shrink-0">
        <button
          onClick={() => {
            setSpectrumConfig({
              ...getSpectrumConfig(),
              numBars: 64,
              maxLeds: 24,
              ledSpaceV: 0.12,
              ledSpaceH: 0.08,
              showPeaks: true,
              peakHoldTime: 800,
              peakDecayRate: 0.012,
              showReflex: true,
              reflexRatio: 0.35,
              reflexAlpha: 0.25,
              colorMode: 'gradient',
              smoothingFactor: 0.25,
              spinEnabled: false
            })
            setConfig(getSpectrumConfig())
          }}
          className="w-full px-3 py-2 sm:py-1.5 rounded bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
