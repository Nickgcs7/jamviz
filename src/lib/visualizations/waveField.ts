import type { VisualizationMode, MouseCoords } from './types'
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
      colors[i * 3] = 0.05 + dist * 0.15     // R: very low
      colors[i * 3 + 1] = 0.4 + dist * 0.4   // G: teal
      colors[i * 3 + 2] = 0.7 + dist * 0.3   // B: strong blue
    }
  },

  animate(
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number,
    mouse?: MouseCoords
  ) {
    // MUCH stronger audio reactivity
    const bassHeight = bands.bassSmooth * 18        // Was 5
    const midHeight = bands.midSmooth * 10          // Was 3
    const highRipple = bands.highSmooth * 6         // Was 1.5
    const beatWave = bands.beatIntensity * 15       // Was 4

    // Mouse creates a big crater/wave
    const mouseX = mouse?.active ? mouse.x * 35 : 0
    const mouseZ = mouse?.active ? -mouse.y * 35 : 0
    const mouseRadius = 20
    const mouseStrength = mouse?.active ? 18 : 0

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oz = originalPositions[i * 3 + 2]
      
      const distFromCenter = Math.sqrt(ox * ox + oz * oz)

      // Multiple wave layers at different speeds/scales
      const wave1 = Math.sin(ox * 0.15 + time * 2.5) * bassHeight
      const wave2 = Math.sin(oz * 0.12 + time * 2.0) * midHeight
      const wave3 = Math.sin((ox + oz) * 0.2 + time * 3.5) * highRipple
      
      // Radial beat pulse from center
      const beatPulse = Math.sin(distFromCenter * 0.15 - time * 4) * beatWave * Math.exp(-distFromCenter * 0.02)

      // Mouse wave effect
      let mouseWave = 0
      if (mouse?.active) {
        const distToMouse = Math.sqrt(Math.pow(ox - mouseX, 2) + Math.pow(oz - mouseZ, 2))
        if (distToMouse < mouseRadius) {
          const influence = Math.pow(1 - distToMouse / mouseRadius, 2)
          mouseWave = Math.sin(distToMouse * 0.4 - time * 5) * mouseStrength * influence
        }
      }

      const totalHeight = wave1 + wave2 + wave3 + beatPulse + mouseWave

      positions[i * 3] = ox
      positions[i * 3 + 1] = totalHeight
      positions[i * 3 + 2] = oz
      
      // Color based on height - deeper blue in troughs, bright cyan at peaks
      const normalizedHeight = (totalHeight + 15) / 30 // Normalize roughly to 0-1
      const heightFactor = Math.max(0, Math.min(1, normalizedHeight))
      
      colors[i * 3] = 0.1 + heightFactor * 0.4 + bands.beatIntensity * 0.3      // R peaks with height
      colors[i * 3 + 1] = 0.5 + heightFactor * 0.5 + bands.midSmooth * 0.2      // G: teal to cyan
      colors[i * 3 + 2] = 0.9 - heightFactor * 0.3                               // B: always strong
      
      // Size pulses with beat
      sizes[i] = 1.5 + bands.overallSmooth * 3 + bands.beatIntensity * 4 + heightFactor * 2
    }
  }
}
