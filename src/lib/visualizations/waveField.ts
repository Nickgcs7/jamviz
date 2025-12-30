import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Wave Field',
  description: 'Audio-reactive terrain waves',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    const gridSize = Math.ceil(Math.sqrt(count))

    for (let i = 0; i < count; i++) {
      const xi = i % gridSize
      const zi = Math.floor(i / gridSize)

      positions[i * 3] = (xi - gridSize / 2) * 0.8
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = (zi - gridSize / 2) * 0.8

      colors[i * 3] = 0.2
      colors[i * 3 + 1] = 0.6
      colors[i * 3 + 2] = 0.9
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
      const oz = originalPositions[i * 3 + 2]

      const waveX = Math.sin(ox * 0.2 + time * 2) * bands.bass * 15
      const waveZ = Math.cos(oz * 0.2 + time * 1.5) * bands.mid * 10

      positions[i * 3] = ox
      positions[i * 3 + 1] = waveX + waveZ
      positions[i * 3 + 2] = oz
      sizes[i] = 2 + bands.overall * 5
    }
  }
}