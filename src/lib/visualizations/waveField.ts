import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Terrain',
  description: 'Audio-reactive terrain',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    const gridSize = Math.ceil(Math.sqrt(count))

    for (let i = 0; i < count; i++) {
      const xi = i % gridSize
      const zi = Math.floor(i / gridSize)

      positions[i * 3] = (xi - gridSize / 2) * 0.7
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = (zi - gridSize / 2) * 0.7

      const dist = Math.sqrt(Math.pow(xi - gridSize/2, 2) + Math.pow(zi - gridSize/2, 2)) / (gridSize/2)
      colors[i * 3] = 0.2 + dist * 0.3
      colors[i * 3 + 1] = 0.5 + dist * 0.3
      colors[i * 3 + 2] = 0.9
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
    // Reduced multipliers for gentler waves
    const bassHeight = bands.bassSmooth * 5
    const midHeight = bands.midSmooth * 3
    const highRipple = bands.highSmooth * 1.5
    const beatWave = bands.beatIntensity * 4

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oz = originalPositions[i * 3 + 2]
      
      const distFromCenter = Math.sqrt(ox * ox + oz * oz)

      // Gentler layered waves
      const waveX = Math.sin(ox * 0.08 + time * 1.0) * bassHeight
      const waveZ = Math.cos(oz * 0.08 + time * 0.8) * midHeight
      const ripple = Math.sin(distFromCenter * 0.12 - time * 1.2) * highRipple
      const beatRing = Math.sin(distFromCenter * 0.1 - time * 2) * beatWave

      positions[i * 3] = ox
      positions[i * 3 + 1] = waveX + waveZ + ripple + beatRing
      positions[i * 3 + 2] = oz
      
      // Smooth color transitions
      const height = positions[i * 3 + 1] / 10
      const beatGlow = bands.beatIntensity * 0.25
      colors[i * 3] = 0.2 + Math.abs(height) * 0.35 + beatGlow
      colors[i * 3 + 1] = 0.5 + height * 0.15
      colors[i * 3 + 2] = 0.9 - Math.abs(height) * 0.2
      
      sizes[i] = 1.8 + bands.overallSmooth * 2 + bands.beatIntensity * 1.2
    }
  }
}