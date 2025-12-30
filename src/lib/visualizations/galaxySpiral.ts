import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const galaxySpiral: VisualizationMode = {
  id: 'galaxy_spiral',
  name: 'Vortex',
  description: 'Spiraling energy vortex',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const arm = i % 4
      const t = (i / count) * 12
      const armOffset = (arm * Math.PI * 2) / 4
      const spread = Math.random() * 2.5

      positions[i * 3] = (t + spread) * Math.cos(t * 0.8 + armOffset)
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3
      positions[i * 3 + 2] = (t + spread) * Math.sin(t * 0.8 + armOffset)

      // Warm gradient: orange to pink
      const gradient = t / 12
      colors[i * 3] = 0.9 + gradient * 0.1
      colors[i * 3 + 1] = 0.3 + gradient * 0.3
      colors[i * 3 + 2] = 0.3 + gradient * 0.5
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

      const angle = time * 0.6 + (i / count) * 0.3
      const spiralBoost = 1 + bands.bass * 0.4
      const lift = Math.sin(time * 2 + i * 0.008) * bands.mid * 4

      positions[i * 3] = (ox * Math.cos(angle * 0.1) - oz * Math.sin(angle * 0.1)) * spiralBoost
      positions[i * 3 + 1] = oy + lift
      positions[i * 3 + 2] = (ox * Math.sin(angle * 0.1) + oz * Math.cos(angle * 0.1)) * spiralBoost
      sizes[i] = 1.2 + bands.high * 2.5
    }
  }
}