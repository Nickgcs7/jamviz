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
    // Use smoothed bass for the main expansion
    const baseRadius = 10
    const bassExpand = bands.bassSmooth * 25
    const breathe = Math.sin(time * 2) * 2
    
    // Beat creates explosive burst
    const beatBurst = bands.beatIntensity * 15

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      // Individual particle variation (smoother)
      const individualPhase = Math.sin(time * 1.5 + i * 0.001) * 1.5
      const radius = baseRadius + bassExpand + breathe + individualPhase + beatBurst

      positions[i * 3] = ox * radius
      positions[i * 3 + 1] = oy * radius
      positions[i * 3 + 2] = oz * radius
      
      // Size pulses with beat
      sizes[i] = 1.2 + bands.overallSmooth * 4 + bands.beatIntensity * 3
      
      // Color intensifies with energy
      const energyBoost = bands.bassSmooth + bands.beatIntensity
      colors[i * 3] = Math.min(1, 0.9 + energyBoost * 0.1)
      colors[i * 3 + 1] = 0.3 + bands.midSmooth * 0.4 + bands.beatIntensity * 0.3
      colors[i * 3 + 2] = 0.1 + bands.highSmooth * 0.4
    }
  }
}