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
    // Reduced multipliers for subtler motion
    const bassBoost = 1 + bands.bassSmooth * 0.8
    const midBoost = 1 + bands.midSmooth * 0.5
    const highBoost = 1 + bands.highSmooth * 0.3
    const beatPulse = 1 + bands.beatIntensity * 0.2

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const freqBand = i % 3
      const boost = freqBand === 0 ? bassBoost : freqBand === 1 ? midBoost : highBoost
      
      // Gentle wave motion
      const wave = Math.sin(dist * 0.1 - time * 0.8) * 0.5 + 0.5
      const scale = boost * beatPulse * (0.95 + wave * 0.1)

      positions[i * 3] = ox * scale
      positions[i * 3 + 1] = oy * scale
      positions[i * 3 + 2] = oz * scale
      
      sizes[i] = 1.5 + bands.overallSmooth * 1.5 + wave * 0.5
      
      // Subtle color shift
      const beatColor = bands.beatIntensity * 0.15
      colors[i * 3] = 0.4 + beatColor + wave * 0.2
      colors[i * 3 + 1] = 0.2 + bands.midSmooth * 0.2
      colors[i * 3 + 2] = 0.8 - beatColor * 0.1
    }
  }
}