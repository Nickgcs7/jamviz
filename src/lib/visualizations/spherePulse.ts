import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const spherePulse: VisualizationMode = {
  id: 'sphere_pulse',
  name: 'Nebula',
  description: 'Breathing particle nebula',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 15 + Math.random() * 12

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Purple to pink gradient
      const t = Math.random()
      colors[i * 3] = 0.4 + t * 0.5
      colors[i * 3 + 1] = 0.2 + t * 0.2
      colors[i * 3 + 2] = 0.8 + t * 0.2
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
    // Use smoothed values for fluid motion
    const bassBoost = 1 + bands.bassSmooth * 1.8
    const midBoost = 1 + bands.midSmooth * 1.2
    const highBoost = 1 + bands.highSmooth * 0.8
    
    // Beat creates a pulse effect
    const beatPulse = 1 + bands.beatIntensity * 0.4

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const freqBand = i % 3
      const boost = freqBand === 0 ? bassBoost : freqBand === 1 ? midBoost : highBoost
      
      // Smoother wave motion
      const wave = Math.sin(dist * 0.15 - time * 1.2) * 0.5 + 0.5
      const scale = boost * beatPulse * (0.9 + wave * 0.2)

      positions[i * 3] = ox * scale
      positions[i * 3 + 1] = oy * scale
      positions[i * 3 + 2] = oz * scale
      
      // Size reacts to overall energy smoothly
      sizes[i] = (1.2 + bands.overallSmooth * 2.5) * (1 + wave * 0.3)
      
      // Subtle color shift on beats
      const beatColor = bands.beatIntensity * 0.3
      colors[i * 3] = 0.4 + beatColor + wave * 0.3
      colors[i * 3 + 1] = 0.2 + bands.midSmooth * 0.3
      colors[i * 3 + 2] = 0.8 - beatColor * 0.2
    }
  }
}