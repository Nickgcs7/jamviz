import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Explosion',
  description: 'Bass-driven particle bursts',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = Math.cos(phi)

      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.3 + Math.random() * 0.4
      colors[i * 3 + 2] = 0.1
    }
  },

  animate(
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    _colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const explodeRadius = 5 + bands.bass * 40 + Math.sin(time + i * 0.001) * 5

      positions[i * 3] = ox * explodeRadius
      positions[i * 3 + 1] = oy * explodeRadius
      positions[i * 3 + 2] = oz * explodeRadius
      sizes[i] = 1 + bands.overall * 6
    }
  }
}