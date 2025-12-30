import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const spherePulse: VisualizationMode = {
  id: 'sphere_pulse',
  name: 'Sphere Pulse',
  description: 'Particles in a breathing sphere formation',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 15 + Math.random() * 10

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      colors[i * 3] = 0.5 + Math.random() * 0.5
      colors[i * 3 + 1] = 0.2 + Math.random() * 0.3
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2
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
    const bassBoost = 1 + bands.bass * 3
    const midBoost = 1 + bands.mid * 2
    const highBoost = 1 + bands.high * 1.5

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const freqBand = i % 3
      const boost = freqBand === 0 ? bassBoost : freqBand === 1 ? midBoost : highBoost
      const wave = Math.sin(dist * 0.3 - time * 2) * 0.5 + 0.5
      const scale = boost * (0.8 + wave * 0.4)

      positions[i * 3] = ox * scale
      positions[i * 3 + 1] = oy * scale
      positions[i * 3 + 2] = oz * scale
      sizes[i] = (1 + bands.overall * 4) * (1 + wave * 0.5)
    }
  }
}