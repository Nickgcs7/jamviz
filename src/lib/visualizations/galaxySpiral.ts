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
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    // Reduced multipliers
    const rotationSpeed = 0.2 + bands.overallSmooth * 0.2
    const spiralBoost = 1 + bands.bassSmooth * 0.15
    const verticalWave = bands.midSmooth * 1.5
    const beatExpand = 1 + bands.beatIntensity * 0.12

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const particlePhase = (i / count) * 0.2
      const angle = time * rotationSpeed + particlePhase
      
      const cos = Math.cos(angle * 0.05)
      const sin = Math.sin(angle * 0.05)
      const lift = Math.sin(time * 1.2 + i * 0.003) * verticalWave

      positions[i * 3] = (ox * cos - oz * sin) * spiralBoost * beatExpand
      positions[i * 3 + 1] = oy + lift
      positions[i * 3 + 2] = (ox * sin + oz * cos) * spiralBoost * beatExpand
      
      sizes[i] = 1.5 + bands.highSmooth * 1.2 + bands.beatIntensity * 0.8
      
      const intensity = 0.85 + bands.beatIntensity * 0.15
      colors[i * 3] = 0.9 * intensity
      colors[i * 3 + 1] = (0.3 + bands.midSmooth * 0.3) * intensity
      colors[i * 3 + 2] = (0.3 + bands.highSmooth * 0.4) * intensity
    }
  }
}