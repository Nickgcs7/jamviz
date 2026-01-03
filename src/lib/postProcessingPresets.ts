/**
 * Post-Processing Presets System
 * Provides pre-configured visual "moods" with dynamic audio reactivity
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
    afterimageToBass?: number
    rgbShiftToOverall?: number
    rgbShiftToBeat?: number
    grainToBeat?: number
    saturationToMid?: number
    contrastToBass?: number
  }
}

const DEFAULT_SETTINGS: PostProcessingSettings = {
  bloomStrength: 0.35,
  bloomRadius: 0.3,
  bloomThreshold: 0.6,
  afterimageStrength: 0.6,
  rgbShiftAmount: 0.0006,
  rgbShiftAngle: 0,
  grainIntensity: 0,
  grainSpeed: 0,
  vignetteIntensity: 0,
  vignetteRadius: 0.5,
  scanlineIntensity: 0,
  scanlineCount: 0,
  saturation: 1,
  contrast: 1,
  brightness: 1,
  exposure: 0.8
}

export const postProcessingPresets: Record<string, PostProcessingPreset> = {
  clean: {
    id: 'clean',
    name: 'Clean',
    description: 'Minimal effects for crisp, clear visuals',
    settings: {
      bloomStrength: 0.15,
      bloomRadius: 0.2,
      bloomThreshold: 0.75,
      afterimageStrength: 0.3,
      rgbShiftAmount: 0.0002,
      rgbShiftAngle: 0,
      grainIntensity: 0,
      grainSpeed: 0,
      vignetteIntensity: 0.1,
      vignetteRadius: 0.6,
      scanlineIntensity: 0,
      scanlineCount: 0,
      saturation: 1.05,
      contrast: 1.05,
      brightness: 1,
      exposure: 0.85
    },
    reactivity: {
      bloomToBass: 0.1,
      bloomToBeat: 0.15,
      afterimageToBass: 0.1,
      rgbShiftToOverall: 0.1,
      rgbShiftToBeat: 0.05
    }
  },

  intense: {
    id: 'intense',
    name: 'Intense',
    description: 'Heavy bloom and trails for dramatic effect',
    settings: {
      bloomStrength: 0.8,
      bloomRadius: 0.5,
      bloomThreshold: 0.4,
      afterimageStrength: 0.85,
      rgbShiftAmount: 0.002,
      rgbShiftAngle: 0,
      grainIntensity: 0.05,
      grainSpeed: 2,
      vignetteIntensity: 0.3,
      vignetteRadius: 0.4,
      scanlineIntensity: 0,
      scanlineCount: 0,
      saturation: 1.2,
      contrast: 1.15,
      brightness: 1.1,
      exposure: 0.9
    },
    reactivity: {
      bloomToBass: 0.4,
      bloomToBeat: 0.5,
      afterimageToBass: 0.2,
      rgbShiftToOverall: 0.3,
      rgbShiftToBeat: 0.4,
      grainToBeat: 0.3,
      contrastToBass: 0.15
    }
  },

  retro: {
    id: 'retro',
    name: 'Retro',
    description: 'VHS-style grain, scanlines, and chromatic aberration',
    settings: {
      bloomStrength: 0.25,
      bloomRadius: 0.35,
      bloomThreshold: 0.55,
      afterimageStrength: 0.5,
      rgbShiftAmount: 0.003,
      rgbShiftAngle: Math.PI / 4,
      grainIntensity: 0.15,
      grainSpeed: 4,
      vignetteIntensity: 0.4,
      vignetteRadius: 0.35,
      scanlineIntensity: 0.12,
      scanlineCount: 400,
      saturation: 0.85,
      contrast: 1.2,
      brightness: 0.95,
      exposure: 0.75
    },
    reactivity: {
      bloomToBass: 0.15,
      bloomToBeat: 0.2,
      rgbShiftToOverall: 0.4,
      rgbShiftToBeat: 0.3,
      grainToBeat: 0.5,
      saturationToMid: -0.1
    }
  },

  neon: {
    id: 'neon',
    name: 'Neon',
    description: 'Vibrant colors with strong glow effects',
    settings: {
      bloomStrength: 1.0,
      bloomRadius: 0.6,
      bloomThreshold: 0.3,
      afterimageStrength: 0.7,
      rgbShiftAmount: 0.001,
      rgbShiftAngle: 0,
      grainIntensity: 0.02,
      grainSpeed: 1,
      vignetteIntensity: 0.25,
      vignetteRadius: 0.45,
      scanlineIntensity: 0,
      scanlineCount: 0,
      saturation: 1.4,
      contrast: 1.25,
      brightness: 1.05,
      exposure: 0.95
    },
    reactivity: {
      bloomToBass: 0.5,
      bloomToBeat: 0.6,
      afterimageToBass: 0.25,
      rgbShiftToOverall: 0.2,
      rgbShiftToBeat: 0.25,
      saturationToMid: 0.2,
      contrastToBass: 0.1
    }
  },

  dreamy: {
    id: 'dreamy',
    name: 'Dreamy',
    description: 'Soft, ethereal look with heavy trails',
    settings: {
      bloomStrength: 0.6,
      bloomRadius: 0.7,
      bloomThreshold: 0.35,
      afterimageStrength: 0.9,
      rgbShiftAmount: 0.0008,
      rgbShiftAngle: Math.PI / 6,
      grainIntensity: 0.03,
      grainSpeed: 0.5,
      vignetteIntensity: 0.2,
      vignetteRadius: 0.5,
      scanlineIntensity: 0,
      scanlineCount: 0,
      saturation: 0.9,
      contrast: 0.85,
      brightness: 1.1,
      exposure: 1.0
    },
    reactivity: {
      bloomToBass: 0.2,
      bloomToBeat: 0.3,
      afterimageToBass: 0.15,
