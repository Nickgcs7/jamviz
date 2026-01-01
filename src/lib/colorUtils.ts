/**
 * HSL to RGB conversion for dynamic, smooth color transitions
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 1) + 1) % 1 // Normalize to 0-1
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))

  if (s === 0) {
    return [l, l, l]
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return [
    hue2rgb(p, q, h + 1/3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1/3)
  ]
}

/**
 * Color palette definitions with music-reactive properties
 */
export interface ColorPalette {
  name: string
  baseHue: number       // 0-1
  hueRange: number      // How much hue varies
  saturation: number    // Base saturation
  lightness: number     // Base lightness
  bassHueShift: number  // Hue shift on bass
  beatBrightness: number // Brightness boost on beat
}

export const palettes: Record<string, ColorPalette> = {
  ocean: {
    name: 'Ocean',
    baseHue: 0.55,      // Cyan
    hueRange: 0.15,
    saturation: 0.7,
    lightness: 0.55,
    bassHueShift: -0.1,  // Shift to blue
    beatBrightness: 0.2
  },
  sunset: {
    name: 'Sunset',
    baseHue: 0.05,      // Orange-red
    hueRange: 0.12,
    saturation: 0.85,
    lightness: 0.5,
    bassHueShift: 0.08,  // Shift to magenta
    beatBrightness: 0.25
  },
  aurora: {
    name: 'Aurora',
    baseHue: 0.45,      // Teal
    hueRange: 0.25,     // Wide range for rainbow effect
    saturation: 0.75,
    lightness: 0.55,
    bassHueShift: 0.15,
    beatBrightness: 0.2
  },
  neon: {
    name: 'Neon',
    baseHue: 0.85,      // Purple-pink
    hueRange: 0.2,
    saturation: 0.95,
    lightness: 0.6,
    bassHueShift: -0.15,
    beatBrightness: 0.3
  },
  ember: {
    name: 'Ember',
    baseHue: 0.08,      // Orange
    hueRange: 0.08,
    saturation: 0.9,
    lightness: 0.45,
    bassHueShift: -0.05, // Shift to red
    beatBrightness: 0.35
  },
  cosmic: {
    name: 'Cosmic',
    baseHue: 0.75,      // Purple
    hueRange: 0.3,      // Full spectrum shift possible
    saturation: 0.8,
    lightness: 0.5,
    bassHueShift: 0.2,
    beatBrightness: 0.25
  }
}

/**
 * Generate a color based on palette, position, and audio reactivity
 */
export function getReactiveColor(
  palette: ColorPalette,
  position: number,      // 0-1, position in visualization
  bass: number,          // 0-1, bass intensity
  beatIntensity: number, // 0-1
  time: number           // For animation
): [number, number, number] {
  // Animated base hue
  const timeHue = Math.sin(time * 0.3) * 0.05
  
  // Position-based hue variation
  const positionHue = position * palette.hueRange
  
  // Bass-reactive hue shift
  const bassHue = bass * palette.bassHueShift
  
  const hue = palette.baseHue + positionHue + bassHue + timeHue
  
  // Saturation increases slightly with bass
  const saturation = palette.saturation + bass * 0.15
  
  // Lightness boosted by beats
  const lightness = palette.lightness + beatIntensity * palette.beatBrightness
  
  return hslToRgb(hue, saturation, lightness)
}

/**
 * Smooth color interpolation
 */
export function lerpColor(
  current: [number, number, number],
  target: [number, number, number],
  factor: number
): [number, number, number] {
  return [
    current[0] + (target[0] - current[0]) * factor,
    current[1] + (target[1] - current[1]) * factor,
    current[2] + (target[2] - current[2]) * factor
  ]
}

/**
 * Create gradient between two hues
 */
export function gradientColor(
  startHue: number,
  endHue: number,
  t: number,
  saturation: number = 0.8,
  lightness: number = 0.55
): [number, number, number] {
  const hue = startHue + (endHue - startHue) * t
  return hslToRgb(hue, saturation, lightness)
}
