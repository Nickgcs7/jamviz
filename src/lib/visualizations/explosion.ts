import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Supernova',
  description: 'Bass-driven energy burst',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      // Normalized direction
      positions[i * 3] = Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = Math.cos(phi)

      // Hot gradient: yellow core to red outer
      const r = Math.random()
      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.3 + r * 0.5
      colors[i * 3 + 2] = 0.1 + r * 0.2
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
    const baseRadius = 8
    const bassExpand = bands.bass * 35
    const pulse = Math.sin(time * 3) * 3

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const individualOffset = Math.sin(time * 2 + i * 0.002) * 2
      const radius = baseRadius + bassExpand + pulse + individualOffset

      positions[i * 3] = ox * radius
      positions[i * 3 + 1] = oy * radius
      positions[i * 3 + 2] = oz * radius
      
      // Intensify color with bass
      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.3 + bands.bass * 0.4
      colors[i * 3 + 2] = 0.1 + bands.high * 0.3
      
      sizes[i] = 1.2 + bands.overall * 5
    }
  }
}