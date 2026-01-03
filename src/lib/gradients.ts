/**
 * Global Gradient System
 * Inspired by AudioMotion Analyzer's gradient registration pattern
 * Provides shared color themes across all visualizations
 */

import { hslToRgb, getCyclingHue } from './colorUtils'
import type { AudioBands } from './AudioAnalyzer'

// ============================================================================
// TYPES
// ============================================================================

export interface ColorStop {
  color: string           // CSS color (hex, rgb, hsl)
  pos?: number           // Position 0-1 in gradient (optional)
  level?: number         // Audio level threshold 0-1 (optional)
}

export interface GradientPreset {
  name: string
  bgColor?: string       // Background color (default: '#111')
  colorStops: (string | ColorStop)[]
  dir?: 'v' | 'h'        // Vertical (default) or horizontal
}

export type ColorMode = 'gradient' | 'bar-index' | 'bar-level' | 'frequency'

// Parsed color stop for internal use
interface ParsedColorStop {
  r: number
  g: number
  b: number
  pos: number
  level?: number
}

// ============================================================================
// BUILT-IN GRADIENTS
// ============================================================================

export const builtInGradients: Record<string, GradientPreset> = {
  classic: {
    name: 'Classic',
    bgColor: '#111',
    colorStops: [
      { color: '#ff0000', pos: 0 },    // Red (high energy)
      { color: '#ffff00', pos: 0.3 },  // Yellow
      { color: '#00ff00', pos: 0.6 },  // Green
      { color: '#00ffff', pos: 0.8 },  // Cyan
      { color: '#0000ff', pos: 1 }     // Blue (low energy)
    ]
  },
  
  prism: {
    name: 'Prism',
    bgColor: '#0a0a1a',
    colorStops: [
      { color: '#ff00ff', pos: 0 },    // Magenta
      { color: '#ff0080', pos: 0.17 }, // Pink
      { color: '#ff0000', pos: 0.33 }, // Red
      { color: '#ff8000', pos: 0.5 },  // Orange
      { color: '#ffff00', pos: 0.67 }, // Yellow
      { color: '#00ff00', pos: 0.83 }, // Green
      { color: '#00ffff', pos: 1 }     // Cyan
    ]
  },
  
  rainbow: {
    name: 'Rainbow',
    bgColor: '#111',
    colorStops: [
      { color: 'hsl(0, 100%, 50%)', pos: 0 },
      { color: 'hsl(60, 100%, 50%)', pos: 0.17 },
      { color: 'hsl(120, 100%, 50%)', pos: 0.33 },
      { color: 'hsl(180, 100%, 50%)', pos: 0.5 },
      { color: 'hsl(240, 100%, 50%)', pos: 0.67 },
      { color: 'hsl(300, 100%, 50%)', pos: 0.83 },
      { color: 'hsl(360, 100%, 50%)', pos: 1 }
    ]
  },
  
  synthwave: {
    name: 'Synthwave',
    bgColor: '#0d0221',
    colorStops: [
      { color: '#ff00ff', pos: 0 },    // Hot magenta
      { color: '#ff0080', pos: 0.25 }, // Pink
      { color: '#8000ff', pos: 0.5 },  // Purple
      { color: '#00ffff', pos: 0.75 }, // Cyan
      { color: '#0080ff', pos: 1 }     // Blue
    ]
  },
  
  fire: {
    name: 'Fire',
    bgColor: '#1a0500',
    colorStops: [
      { color: '#ffffff', pos: 0, level: 0.9 },   // White hot
      { color: '#ffffaa', pos: 0.1, level: 0.8 }, // Yellow-white
      { color: '#ffff00', pos: 0.25, level: 0.6 }, // Yellow
      { color: '#ff8800', pos: 0.5, level: 0.4 },  // Orange
      { color: '#ff4400', pos: 0.75, level: 0.2 }, // Red-orange
      { color: '#aa0000', pos: 1, level: 0 }       // Dark red
    ]
  },
  
  ocean: {
    name: 'Ocean',
    bgColor: '#001122',
    colorStops: [
      { color: '#00ffff', pos: 0 },    // Bright cyan
      { color: '#00aaff', pos: 0.25 }, // Light blue
      { color: '#0066ff', pos: 0.5 },  // Blue
      { color: '#0033aa', pos: 0.75 }, // Deep blue
      { color: '#001155', pos: 1 }     // Dark blue
    ]
  },
  
  aurora: {
    name: 'Aurora',
    bgColor: '#0a0a1a',
    colorStops: [
      { color: '#00ff88', pos: 0 },    // Bright green
      { color: '#00ffcc', pos: 0.2 },  // Cyan-green
      { color: '#00ccff', pos: 0.4 },  // Cyan
      { color: '#8866ff', pos: 0.6 },  // Purple
      { color: '#ff66aa', pos: 0.8 },  // Pink
      { color: '#ff4466', pos: 1 }     // Red-pink
    ]
  },
  
  sunset: {
    name: 'Sunset',
    bgColor: '#1a0a0a',
    colorStops: [
      { color: '#ffff00', pos: 0 },    // Yellow
      { color: '#ffaa00', pos: 0.25 }, // Orange
      { color: '#ff4400', pos: 0.5 },  // Red-orange
      { color: '#aa0044', pos: 0.75 }, // Dark red
      { color: '#440066', pos: 1 }     // Purple
    ]
  },
  
  matrix: {
    name: 'Matrix',
    bgColor: '#000a00',
    colorStops: [
      { color: '#ffffff', pos: 0, level: 0.95 },  // White (peaks)
      { color: '#88ff88', pos: 0.2, level: 0.7 }, // Light green
      { color: '#00ff00', pos: 0.4, level: 0.5 }, // Green
      { color: '#00aa00', pos: 0.7, level: 0.2 }, // Dark green
      { color: '#004400', pos: 1, level: 0 }      // Very dark
    ]
  },
  
  neon: {
    name: 'Neon',
    bgColor: '#0a0a12',
    colorStops: [
      { color: '#ff00ff', pos: 0 },    // Magenta
      { color: '#ff0088', pos: 0.2 },  // Pink
      { color: '#8800ff', pos: 0.4 },  // Purple
      { color: '#0088ff', pos: 0.6 },  // Blue
      { color: '#00ffff', pos: 0.8 },  // Cyan
      { color: '#00ff88', pos: 1 }     // Green
    ]
  }
}

// ============================================================================
// GRADIENT REGISTRY
// ============================================================================

const customGradients: Record<string, GradientPreset> = {}

/**
 * Register a custom gradient
 * @param name Unique gradient identifier
 * @param options Gradient configuration
 */
export function registerGradient(name: string, options: Omit<GradientPreset, 'name'>): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Gradient name must be a non-empty string')
  }
  
  if (!options.colorStops || options.colorStops.length === 0) {
    throw new Error('Gradient must have at least one color stop')
  }
  
  customGradients[name] = {
    name,
    ...options
  }
}

/**
 * Get a gradient by name (custom or built-in)
 */
export function getGradient(name: string): GradientPreset | undefined {
  return customGradients[name] || builtInGradients[name]
}

/**
 * Get all available gradient names
 */
export function getGradientNames(): string[] {
  return [...Object.keys(builtInGradients), ...Object.keys(customGradients)]
}

// ============================================================================
// COLOR PARSING
// ============================================================================

/**
 * Parse CSS color to RGB values (0-1)
 */
function parseColor(color: string): [number, number, number] {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255
      const g = parseInt(hex[1] + hex[1], 16) / 255
      const b = parseInt(hex[2] + hex[2], 16) / 255
      return [r, g, b]
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      return [r, g, b]
    }
  }
  
  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]) / 255,
      parseInt(rgbMatch[2]) / 255,
      parseInt(rgbMatch[3]) / 255
    ]
  }
  
  // Handle hsl/hsla
  const hslMatch = color.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/)
  if (hslMatch) {
    return hslToRgb(
      parseInt(hslMatch[1]) / 360,
      parseInt(hslMatch[2]) / 100,
      parseInt(hslMatch[3]) / 100
    )
  }
  
  // Fallback to white
  return [1, 1, 1]
}

/**
 * Parse gradient color stops into normalized format
 */
function parseColorStops(stops: (string | ColorStop)[]): ParsedColorStop[] {
  const parsed: ParsedColorStop[] = []
  
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    const isString = typeof stop === 'string'
    const color = isString ? stop : stop.color
    const [r, g, b] = parseColor(color)
    
    // Default position based on index if not specified
    const pos = isString 
      ? i / Math.max(1, stops.length - 1)
      : stop.pos ?? i / Math.max(1, stops.length - 1)
    
    parsed.push({
      r, g, b,
      pos,
      level: isString ? undefined : stop.level
    })
  }
  
  // Sort by position
  parsed.sort((a, b) => a.pos - b.pos)
  
  return parsed
}

// ============================================================================
// COLOR SAMPLING
// ============================================================================

/**
 * Sample a color from a gradient at a given position
 * @param gradient Gradient preset to sample from
 * @param position Position in gradient (0-1)
 * @returns RGB tuple (0-1 range)
 */
export function sampleGradient(
  gradient: GradientPreset,
  position: number
): [number, number, number] {
  const stops = parseColorStops(gradient.colorStops)
  
  if (stops.length === 0) return [1, 1, 1]
  if (stops.length === 1) return [stops[0].r, stops[0].g, stops[0].b]
  
  position = Math.max(0, Math.min(1, position))
  
  // Find surrounding stops
  let lower = stops[0]
  let upper = stops[stops.length - 1]
  
  for (let i = 0; i < stops.length - 1; i++) {
    if (stops[i].pos <= position && stops[i + 1].pos >= position) {
      lower = stops[i]
      upper = stops[i + 1]
      break
    }
  }
  
  // Interpolate between stops
  const range = upper.pos - lower.pos
  const t = range > 0 ? (position - lower.pos) / range : 0
  
  return [
    lower.r + (upper.r - lower.r) * t,
    lower.g + (upper.g - lower.g) * t,
    lower.b + (upper.b - lower.b) * t
  ]
}

/**
 * Sample gradient color based on audio level (uses level thresholds if defined)
 * @param gradient Gradient preset
 * @param level Audio level (0-1)
 */
export function sampleGradientByLevel(
  gradient: GradientPreset,
  level: number
): [number, number, number] {
  const stops = parseColorStops(gradient.colorStops)
  const hasLevels = stops.some(s => s.level !== undefined)
  
  if (!hasLevels) {
    // Fall back to position-based sampling if no levels defined
    return sampleGradient(gradient, level)
  }
  
  // Find stops by level threshold
  const stopsWithLevel = stops.filter(s => s.level !== undefined)
    .sort((a, b) => (b.level || 0) - (a.level || 0)) // High to low
  
  for (const stop of stopsWithLevel) {
    if (level >= (stop.level || 0)) {
      return [stop.r, stop.g, stop.b]
    }
  }
  
  // Return last (lowest level) color
  const last = stopsWithLevel[stopsWithLevel.length - 1]
  return [last.r, last.g, last.b]
}

/**
 * Get color for a specific bar index (cycling through color stops)
 */
export function getColorByIndex(
  gradient: GradientPreset,
  index: number,
  _totalBars: number
): [number, number, number] {
  const stops = parseColorStops(gradient.colorStops)
  if (stops.length === 0) return [1, 1, 1]
  
  const stopIndex = index % stops.length
  return [stops[stopIndex].r, stops[stopIndex].g, stops[stopIndex].b]
}

// ============================================================================
// AUDIO-REACTIVE COLOR GENERATION
// ============================================================================

export interface ReactiveColorOptions {
  gradient: GradientPreset
  colorMode: ColorMode
  position?: number        // For 'gradient' mode: position in visualization
  level?: number          // For 'bar-level' mode: audio amplitude
  index?: number          // For 'bar-index' mode: bar index
  totalBars?: number      // For 'bar-index' mode
  frequencyBand?: number  // For 'frequency' mode: which band (0-6)
  bands?: AudioBands      // Audio data for dynamic effects
  time?: number           // Time for cycling effects
}

/**
 * Generate audio-reactive color based on mode and parameters
 */
export function getReactiveGradientColor(options: ReactiveColorOptions): [number, number, number] {
  const {
    gradient,
    colorMode,
    position = 0,
    level = 0,
    index = 0,
    totalBars = 1,
    frequencyBand = 0,
    bands,
    time = 0
  } = options
  
  let baseColor: [number, number, number]
  
  switch (colorMode) {
    case 'bar-level':
      baseColor = sampleGradientByLevel(gradient, level)
      break
    
    case 'bar-index':
      baseColor = getColorByIndex(gradient, index, totalBars)
      break
    
    case 'frequency': {
      // Map frequency band to gradient position
      // subBass=0, bass=1, lowMid=2, mid=3, highMid=4, treble=5, brilliance=6
      const freqPosition = frequencyBand / 6
      baseColor = sampleGradient(gradient, freqPosition)
      break
    }
    
    case 'gradient':
    default:
      baseColor = sampleGradient(gradient, position)
  }
  
  // Apply audio reactivity if bands provided
  if (bands) {
    const _cycleHue = getCyclingHue(time)
    const beatBoost = bands.beatIntensity * 0.2
    const overallBoost = bands.overallSmooth * 0.1
    
    // Brighten on beats
    const brightnessFactor = 1 + beatBoost + overallBoost
    
    return [
      Math.min(1, baseColor[0] * brightnessFactor),
      Math.min(1, baseColor[1] * brightnessFactor),
      Math.min(1, baseColor[2] * brightnessFactor)
    ]
  }
  
  return baseColor
}

/**
 * Map a frequency band to a gradient position
 * Uses logarithmic mapping to better represent human hearing
 */
export function frequencyToGradientPosition(frequency: number, minFreq = 20, maxFreq = 20000): number {
  // Logarithmic mapping
  const logMin = Math.log10(minFreq)
  const logMax = Math.log10(maxFreq)
  const logFreq = Math.log10(Math.max(minFreq, Math.min(maxFreq, frequency)))
  
  return (logFreq - logMin) / (logMax - logMin)
}

/**
 * Get gradient color for a specific frequency
 */
export function getColorForFrequency(
  gradient: GradientPreset,
  frequency: number,
  amplitude: number = 1,
  _time: number = 0
): [number, number, number] {
  const position = frequencyToGradientPosition(frequency)
  const [r, g, b] = sampleGradient(gradient, position)
  
  // Apply amplitude as brightness
  return [
    Math.min(1, r * (0.3 + amplitude * 0.7)),
    Math.min(1, g * (0.3 + amplitude * 0.7)),
    Math.min(1, b * (0.3 + amplitude * 0.7))
  ]
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/** Quick access to default gradient */
export const defaultGradient = builtInGradients.synthwave

/** Get gradient background color */
export function getGradientBackground(gradient: GradientPreset): [number, number, number] {
  return parseColor(gradient.bgColor || '#111')
}
