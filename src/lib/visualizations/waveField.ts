import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Terrain',
  description: 'Audio-reactive ocean terrain with depth',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    const gridSize = Math.ceil(Math.sqrt(count))
    const spacing = 0.55

    for (let i = 0; i < count; i++) {
      const xi = i % gridSize
      const zi = Math.floor(i / gridSize)

      positions[i * 3] = (xi - gridSize / 2) * spacing
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = (zi - gridSize / 2) * spacing

      // Rich ocean gradient
      const dist = Math.sqrt(Math.pow(xi - gridSize/2, 2) + Math.pow(zi - gridSize/2, 2)) / (gridSize/2)
      const [r, g, b] = hslToRgb(0.55 + dist * 0.1, 0.7, 0.5 + dist * 0.15)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  },

  animate(
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    const bassHeight = bands.bassSmooth * 16
    const midHeight = bands.midSmooth * 10
    const highRipple = bands.highSmooth * 5
    const beatWave = bands.beatIntensity * 12

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oz = originalPositions[i * 3 + 2]
      
      const distFromCenter = Math.sqrt(ox * ox + oz * oz)
      const normalizedDist = Math.min(1, distFromCenter / 30)

      // Layered wave motion
      const wave1 = Math.sin(ox * 0.12 + time * 2.0) * bassHeight
      const wave2 = Math.sin(oz * 0.10 + time * 1.6) * midHeight
      const wave3 = Math.sin((ox + oz) * 0.18 + time * 2.8) * highRipple
      const beatPulse = Math.sin(distFromCenter * 0.12 - time * 3) * beatWave * Math.exp(-distFromCenter * 0.015)

      const totalHeight = wave1 + wave2 + wave3 + beatPulse

      positions[i * 3] = ox
      positions[i * 3 + 1] = totalHeight
      // Add Z depth variation
      positions[i * 3 + 2] = oz + Math.sin(time * 0.5 + ox * 0.1) * 2 * bands.midSmooth
      
      // Dynamic HSL-based coloring
      const normalizedHeight = (totalHeight + 20) / 40
      const heightFactor = Math.max(0, Math.min(1, normalizedHeight))
      
      // Hue shifts with frequency: bass = deeper blue, treble = cyan/green
      const hue = 0.52 + heightFactor * 0.12 - bands.bassSmooth * 0.08 + bands.highSmooth * 0.1
      const saturation = 0.65 + bands.overallSmooth * 0.2
      const lightness = 0.45 + heightFactor * 0.25 + bands.beatIntensity * 0.15
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
      
      sizes[i] = 1.2 + bands.overallSmooth * 2.5 + bands.beatIntensity * 3 + heightFactor * 2
    }
  }
}
