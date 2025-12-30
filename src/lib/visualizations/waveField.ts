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

      // Cool blue-cyan gradient
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
    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oz = originalPositions[i * 3 + 2]

      const waveX = Math.sin(ox * 0.15 + time * 1.8) * bands.bass * 12
      const waveZ = Math.cos(oz * 0.15 + time * 1.4) * bands.mid * 8
      const ripple = Math.sin(Math.sqrt(ox*ox + oz*oz) * 0.3 - time * 2) * bands.high * 5

      positions[i * 3] = ox
      positions[i * 3 + 1] = waveX + waveZ + ripple
      positions[i * 3 + 2] = oz
      
      // Color based on height
      const height = (waveX + waveZ + ripple) / 20
      colors[i * 3] = 0.3 + height * 0.4
      colors[i * 3 + 1] = 0.5 + height * 0.2
      colors[i * 3 + 2] = 0.9 - height * 0.2
      
      sizes[i] = 1.5 + bands.overall * 4
    }
  }
}