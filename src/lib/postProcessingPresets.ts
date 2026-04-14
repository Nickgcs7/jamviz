/**
 * Post-Processing Presets System v2
 * 
 * Enhanced audio reactivity using spectralCentroid, energyTrend, and onset detection.
 * - spectralCentroid rotates RGB shift angle (timbre changes shift chromatic aberration)
 * - energyTrend ramps bloom on buildups
 * - isOnset briefly dips afterimage for transient clarity
 */

import type { AudioBands } from './AudioAnalyzer'

export interface PostProcessingSettings {
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  afterimageStrength: number
  rgbShiftAmount: number
  rgbShiftAngle: number
  grainIntensity: number
  grainSpeed: number
  vignetteIntensity: number
  vignetteRadius: number
  scanlineIntensity: number
  scanlineCount: number
  saturation: number
  contrast: number
  brightness: number
  exposure: number
}

export interface PostProcessingPreset {
  id: string
  name: string
  description: string
  settings: PostProcessingSettings
  reactivity: {
    bloomToBass?: number
    bloomToBeat?: number
    bloomToTrend?: number
    afterimageToBass?: number
    afterimageDipOnOnset?: number
    rgbShiftToOverall?: number
    rgbShiftToBeat?: number
    rgbAngleToCentroid?: number
    grainToBeat?: number
    saturationToMid?: number
    contrastToBass?: number
  }
}

const DEFAULT_SETTINGS: PostProcessingSettings = {
  bloomStrength: 0.35, bloomRadius: 0.3, bloomThreshold: 0.6,
  afterimageStrength: 0.6, rgbShiftAmount: 0.0006, rgbShiftAngle: 0,
  grainIntensity: 0, grainSpeed: 0, vignetteIntensity: 0, vignetteRadius: 0.5,
  scanlineIntensity: 0, scanlineCount: 0, saturation: 1, contrast: 1,
  brightness: 1, exposure: 0.8
}

export const postProcessingPresets: Record<string, PostProcessingPreset> = {
  clean: {
    id: 'clean', name: 'Clean',
    description: 'Minimal effects for crisp, clear visuals',
    settings: {
      bloomStrength: 0.15, bloomRadius: 0.2, bloomThreshold: 0.75,
      afterimageStrength: 0.3, rgbShiftAmount: 0.0002, rgbShiftAngle: 0,
      grainIntensity: 0, grainSpeed: 0, vignetteIntensity: 0.1, vignetteRadius: 0.6,
      scanlineIntensity: 0, scanlineCount: 0, saturation: 1.05, contrast: 1.05,
      brightness: 1, exposure: 0.85
    },
    reactivity: {
      bloomToBass: 0.1, bloomToBeat: 0.15, bloomToTrend: 0.08,
      afterimageToBass: 0.1, afterimageDipOnOnset: 0.06,
      rgbShiftToOverall: 0.1, rgbShiftToBeat: 0.05, rgbAngleToCentroid: 0.3,
    }
  },
  intense: {
    id: 'intense', name: 'Intense',
    description: 'Heavy bloom and trails for dramatic effect',
    settings: {
      bloomStrength: 0.8, bloomRadius: 0.5, bloomThreshold: 0.4,
      afterimageStrength: 0.85, rgbShiftAmount: 0.002, rgbShiftAngle: 0,
      grainIntensity: 0.05, grainSpeed: 2, vignetteIntensity: 0.3, vignetteRadius: 0.4,
      scanlineIntensity: 0, scanlineCount: 0, saturation: 1.2, contrast: 1.15,
      brightness: 1.1, exposure: 0.9
    },
    reactivity: {
      bloomToBass: 0.4, bloomToBeat: 0.5, bloomToTrend: 0.2,
      afterimageToBass: 0.2, afterimageDipOnOnset: 0.12,
      rgbShiftToOverall: 0.3, rgbShiftToBeat: 0.4, rgbAngleToCentroid: 0.5,
      grainToBeat: 0.3, contrastToBass: 0.15
    }
  },
  retro: {
    id: 'retro', name: 'Retro',
    description: 'VHS-style grain, scanlines, and chromatic aberration',
    settings: {
      bloomStrength: 0.25, bloomRadius: 0.35, bloomThreshold: 0.55,
      afterimageStrength: 0.5, rgbShiftAmount: 0.003, rgbShiftAngle: Math.PI / 4,
      grainIntensity: 0.15, grainSpeed: 4, vignetteIntensity: 0.4, vignetteRadius: 0.35,
      scanlineIntensity: 0.12, scanlineCount: 400, saturation: 0.85, contrast: 1.2,
      brightness: 0.95, exposure: 0.75
    },
    reactivity: {
      bloomToBass: 0.15, bloomToBeat: 0.2, bloomToTrend: 0.1,
      afterimageDipOnOnset: 0.08,
      rgbShiftToOverall: 0.4, rgbShiftToBeat: 0.3, rgbAngleToCentroid: 0.8,
      grainToBeat: 0.5, saturationToMid: -0.1
    }
  },
  neon: {
    id: 'neon', name: 'Neon',
    description: 'Vibrant colors with strong glow effects',
    settings: {
      bloomStrength: 1.0, bloomRadius: 0.6, bloomThreshold: 0.3,
      afterimageStrength: 0.7, rgbShiftAmount: 0.001, rgbShiftAngle: 0,
      grainIntensity: 0.02, grainSpeed: 1, vignetteIntensity: 0.25, vignetteRadius: 0.45,
      scanlineIntensity: 0, scanlineCount: 0, saturation: 1.4, contrast: 1.25,
      brightness: 1.05, exposure: 0.95
    },
    reactivity: {
      bloomToBass: 0.5, bloomToBeat: 0.6, bloomToTrend: 0.25,
      afterimageToBass: 0.25, afterimageDipOnOnset: 0.1,
      rgbShiftToOverall: 0.2, rgbShiftToBeat: 0.25, rgbAngleToCentroid: 0.4,
      saturationToMid: 0.2, contrastToBass: 0.1
    }
  },
  dreamy: {
    id: 'dreamy', name: 'Dreamy',
    description: 'Soft, ethereal look with heavy trails',
    settings: {
      bloomStrength: 0.6, bloomRadius: 0.7, bloomThreshold: 0.35,
      afterimageStrength: 0.9, rgbShiftAmount: 0.0008, rgbShiftAngle: Math.PI / 6,
      grainIntensity: 0.03, grainSpeed: 0.5, vignetteIntensity: 0.2, vignetteRadius: 0.5,
      scanlineIntensity: 0, scanlineCount: 0, saturation: 0.9, contrast: 0.85,
      brightness: 1.1, exposure: 1.0
    },
    reactivity: {
      bloomToBass: 0.2, bloomToBeat: 0.3, bloomToTrend: 0.15,
      afterimageToBass: 0.15, afterimageDipOnOnset: 0.04,
      rgbShiftToOverall: 0.15, rgbShiftToBeat: 0.1, rgbAngleToCentroid: 0.6,
    }
  },
  cyberpunk: {
    id: 'cyberpunk', name: 'Cyberpunk',
    description: 'High contrast with glitch-like effects',
    settings: {
      bloomStrength: 0.7, bloomRadius: 0.4, bloomThreshold: 0.45,
      afterimageStrength: 0.65, rgbShiftAmount: 0.004, rgbShiftAngle: 0,
      grainIntensity: 0.08, grainSpeed: 6, vignetteIntensity: 0.35, vignetteRadius: 0.3,
      scanlineIntensity: 0.08, scanlineCount: 300, saturation: 1.3, contrast: 1.4,
      brightness: 0.95, exposure: 0.85
    },
    reactivity: {
      bloomToBass: 0.35, bloomToBeat: 0.45, bloomToTrend: 0.2,
      afterimageDipOnOnset: 0.15,
      rgbShiftToOverall: 0.5, rgbShiftToBeat: 0.6, rgbAngleToCentroid: 1.0,
      grainToBeat: 0.4, contrastToBass: 0.2
    }
  }
}

let currentPreset: PostProcessingPreset = postProcessingPresets.clean
let currentSettings: PostProcessingSettings = { ...currentPreset.settings }

export function getPresetNames(): string[] { return Object.keys(postProcessingPresets) }
export function getCurrentPreset(): PostProcessingPreset { return currentPreset }
export function getCurrentSettings(): PostProcessingSettings { return currentSettings }

export function setPreset(presetId: string): boolean {
  const preset = postProcessingPresets[presetId]
  if (preset) { currentPreset = preset; currentSettings = { ...preset.settings }; return true }
  return false
}

export function getPreset(presetId: string): PostProcessingPreset | undefined {
  return postProcessingPresets[presetId]
}

export function getAudioReactiveSettings(bands: AudioBands): PostProcessingSettings {
  const base = currentPreset.settings
  const react = currentPreset.reactivity
  const settings: PostProcessingSettings = { ...base }
  
  // Bloom: bass + beat + energy trend (buildups get progressively more bloom)
  if (react.bloomToBass) settings.bloomStrength = base.bloomStrength + bands.bassSmooth * react.bloomToBass
  if (react.bloomToBeat) settings.bloomStrength += bands.beatIntensity * react.bloomToBeat
  if (react.bloomToTrend) {
    const trendBoost = Math.max(0, bands.energyTrend) * react.bloomToTrend
    settings.bloomStrength += trendBoost
  }
  
  // Afterimage: bass persistence + onset clarity dip
  if (react.afterimageToBass) settings.afterimageStrength = Math.min(0.98, base.afterimageStrength + bands.bassSmooth * react.afterimageToBass)
  if (react.afterimageDipOnOnset && bands.isOnset) {
    settings.afterimageStrength = Math.max(0.1, settings.afterimageStrength - bands.onsetIntensity * react.afterimageDipOnOnset)
  }
  
  // RGB shift: overall energy + beat spikes + centroid-driven angle
  if (react.rgbShiftToOverall) settings.rgbShiftAmount = base.rgbShiftAmount + bands.overallSmooth * react.rgbShiftToOverall * 0.003
  if (react.rgbShiftToBeat) settings.rgbShiftAmount += bands.beatIntensity * react.rgbShiftToBeat * 0.003
  if (react.rgbAngleToCentroid) {
    settings.rgbShiftAngle = base.rgbShiftAngle + (bands.spectralCentroid - 0.5) * Math.PI * react.rgbAngleToCentroid
  }
  
  if (react.grainToBeat) settings.grainIntensity = base.grainIntensity + bands.beatIntensity * react.grainToBeat * 0.2
  if (react.saturationToMid) settings.saturation = base.saturation + bands.midSmooth * react.saturationToMid
  if (react.contrastToBass) settings.contrast = base.contrast + bands.bassSmooth * react.contrastToBass
  
  currentSettings = settings
  return settings
}

export function interpolateSettings(from: PostProcessingSettings, to: PostProcessingSettings, t: number): PostProcessingSettings {
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    bloomStrength: lerp(from.bloomStrength, to.bloomStrength),
    bloomRadius: lerp(from.bloomRadius, to.bloomRadius),
    bloomThreshold: lerp(from.bloomThreshold, to.bloomThreshold),
    afterimageStrength: lerp(from.afterimageStrength, to.afterimageStrength),
    rgbShiftAmount: lerp(from.rgbShiftAmount, to.rgbShiftAmount),
    rgbShiftAngle: lerp(from.rgbShiftAngle, to.rgbShiftAngle),
    grainIntensity: lerp(from.grainIntensity, to.grainIntensity),
    grainSpeed: lerp(from.grainSpeed, to.grainSpeed),
    vignetteIntensity: lerp(from.vignetteIntensity, to.vignetteIntensity),
    vignetteRadius: lerp(from.vignetteRadius, to.vignetteRadius),
    scanlineIntensity: lerp(from.scanlineIntensity, to.scanlineIntensity),
    scanlineCount: Math.round(lerp(from.scanlineCount, to.scanlineCount)),
    saturation: lerp(from.saturation, to.saturation),
    contrast: lerp(from.contrast, to.contrast),
    brightness: lerp(from.brightness, to.brightness),
    exposure: lerp(from.exposure, to.exposure)
  }
}

export function registerPreset(preset: PostProcessingPreset): void { postProcessingPresets[preset.id] = preset }
export function getDefaultSettings(): PostProcessingSettings { return { ...DEFAULT_SETTINGS } }

export const grainShaderCode = `
float grain(vec2 uv, float intensity, float speed, float time) {
  float noise = fract(sin(dot(uv, vec2(12.9898, 78.233) + time * speed)) * 43758.5453);
  return mix(1.0, noise, intensity);
}
`

export const vignetteShaderCode = `
float vignette(vec2 uv, float intensity, float radius) {
  vec2 center = uv - 0.5;
  float dist = length(center);
  float vig = smoothstep(radius, radius - 0.2, dist);
  return mix(1.0, vig, intensity);
}
`

export const scanlinesShaderCode = `
float scanlines(vec2 uv, float intensity, float count, vec2 resolution) {
  float scanline = sin(uv.y * count * 3.14159) * 0.5 + 0.5;
  return mix(1.0, scanline, intensity);
}
`
