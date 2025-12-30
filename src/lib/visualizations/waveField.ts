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
    // Use smoothed values for fluid waves
    const bassHeight = bands.bassSmooth * 10
    const midHeight = bands.midSmooth * 6
    const highRipple = bands.highSmooth * 3
    
    // Beat creates a shockwave
    const beatWave = bands.beatIntensity * 8

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oz = originalPositions[i * 3 + 2]
      
      const distFromCenter = Math.sqrt(ox * ox + oz * oz)

      // Layered waves with smooth motion
      const waveX = Math.sin(ox * 0.12 + time * 1.4) * bassHeight
      const waveZ = Math.cos(oz * 0.12 + time * 1.1) * midHeight
      const ripple = Math.sin(distFromCenter * 0.2 - time * 1.8) * highRipple
      
      // Beat creates expanding ring
      const beatRing = Math.sin(distFromCenter * 0.15 - time * 3) * beatWave

      positions[i * 3] = ox
      positions[i * 3 + 1] = waveX + waveZ + ripple + beatRing
      positions[i * 3 + 2] = oz
      
      // Color based on height with smooth transitions
      const height = positions[i * 3 + 1] / 15
      const beatGlow = bands.beatIntensity * 0.4
      colors[i * 3] = 0.2 + Math.abs(height) * 0.5 + beatGlow
      colors[i * 3 + 1] = 0.5 + height * 0.2
      colors[i * 3 + 2] = 0.9 - Math.abs(height) * 0.3
      
      sizes[i] = 1.5 + bands.overallSmooth * 3 + bands.beatIntensity * 2
    }
  }
}