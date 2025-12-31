import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Terrain',
  description: 'Audio-reactive ocean terrain',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    const gridSize = Math.ceil(Math.sqrt(count))
    const spacing = 0.55

    for (let i = 0; i < count; i++) {
      const xi = i % gridSize
      const zi = Math.floor(i / gridSize)

      positions[i * 3] = (xi - gridSize / 2) * spacing
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = (zi - gridSize / 2) * spacing

      // Cool blue/cyan/teal gradient from center
      const dist = Math.sqrt(Math.pow(xi - gridSize/2, 2) + Math.pow(zi - gridSize/2, 2)) / (gridSize/2)
      colors[i * 3] = 0.05 + dist * 0.15
      colors[i * 3 + 1] = 0.4 + dist * 0.4
      colors[i * 3 + 2] = 0.7 + dist * 0.3
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
    const bassHeight = bands.bassSmooth * 18
    const midHeight = bands.midSmooth * 10
    const highRipple = bands.highSmooth * 6
    const beatWave = bands.beatIntensity * 15

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oz = originalPositions[i * 3 + 2]
      
      const distFromCenter = Math.sqrt(ox * ox + oz * oz)

      const wave1 = Math.sin(ox * 0.15 + time * 2.5) * bassHeight
      const wave2 = Math.sin(oz * 0.12 + time * 2.0) * midHeight
      const wave3 = Math.sin((ox + oz) * 0.2 + time * 3.5) * highRipple
      const beatPulse = Math.sin(distFromCenter * 0.15 - time * 4) * beatWave * Math.exp(-distFromCenter * 0.02)

      const totalHeight = wave1 + wave2 + wave3 + beatPulse

      positions[i * 3] = ox
      positions[i * 3 + 1] = totalHeight
      positions[i * 3 + 2] = oz
      
      const normalizedHeight = (totalHeight + 15) / 30
      const heightFactor = Math.max(0, Math.min(1, normalizedHeight))
      
      colors[i * 3] = 0.1 + heightFactor * 0.4 + bands.beatIntensity * 0.3
      colors[i * 3 + 1] = 0.5 + heightFactor * 0.5 + bands.midSmooth * 0.2
      colors[i * 3 + 2] = 0.9 - heightFactor * 0.3
      
      sizes[i] = 1.5 + bands.overallSmooth * 3 + bands.beatIntensity * 4 + heightFactor * 2
    }
  }
}
