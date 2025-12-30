import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const galaxySpiral: VisualizationMode = {
  id: 'galaxy_spiral',
  name: 'Galaxy Spiral',
  description: 'Three-arm spiral galaxy formation',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const arm = i % 3
      const t = (i / count) * 10
      const armOffset = (arm * Math.PI * 2) / 3
      const spread = Math.random() * 3

      positions[i * 3] = (t + spread) * Math.cos(t + armOffset)
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4
      positions[i * 3 + 2] = (t + spread) * Math.sin(t + armOffset)

      colors[i * 3] = 0.9
      colors[i * 3 + 1] = 0.4 + t / 30
      colors[i * 3 + 2] = 0.3
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

      const angle = time * 0.5 + (i / count) * 0.5
      const spiralBoost = 1 + bands.bass * 0.5

      positions[i * 3] = ox * Math.cos(angle * 0.1) * spiralBoost - oz * Math.sin(angle * 0.1)
      positions[i * 3 + 1] = oy + Math.sin(time * 2 + i * 0.01) * bands.mid * 5
      positions[i * 3 + 2] = ox * Math.sin(angle * 0.1) + oz * Math.cos(angle * 0.1) * spiralBoost
      sizes[i] = 1.5 + bands.high * 3
    }
  }
}