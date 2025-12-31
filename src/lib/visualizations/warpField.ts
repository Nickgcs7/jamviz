import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

interface Attractor {
  x: number
  y: number
  strength: number
  targetStrength: number
  phase: number
}

const attractors: Attractor[] = []
const NUM_ATTRACTORS = 3
const ROWS = 80
const COLS = 125

export const warpField: VisualizationMode = {
  id: 'warp_field',
  name: 'Warp Field',
  description: 'Parallel lines warped by audio-reactive attractors',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    attractors.length = 0
    
    for (let a = 0; a < NUM_ATTRACTORS; a++) {
      attractors.push({
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 30,
        strength: 5,
        targetStrength: 5,
        phase: Math.random() * Math.PI * 2
      })
    }

    const rowSpacing = 0.6
    const colSpacing = 0.5
    
    for (let i = 0; i < count; i++) {
      const row = i % ROWS
      const col = Math.floor(i / ROWS)
      
      positions[i * 3] = (col - COLS / 2) * colSpacing
      positions[i * 3 + 1] = (row - ROWS / 2) * rowSpacing
      positions[i * 3 + 2] = 0

      const rowFactor = row / ROWS
      colors[i * 3] = 0.4 + rowFactor * 0.3
      colors[i * 3 + 1] = 0.1 + rowFactor * 0.1
      colors[i * 3 + 2] = 0.5 + rowFactor * 0.3
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
    for (let a = 0; a < NUM_ATTRACTORS; a++) {
      const attractor = attractors[a]
      
      attractor.x = Math.sin(time * 0.5 + attractor.phase) * 20 * (1 + bands.midSmooth)
      attractor.y = Math.cos(time * 0.4 + attractor.phase * 1.3) * 15 * (1 + bands.highSmooth)
      
      attractor.targetStrength = 8 + bands.bassSmooth * 20 + bands.beatIntensity * 15
      attractor.strength += (attractor.targetStrength - attractor.strength) * 0.3
    }

    if (bands.isBeat && bands.beatIntensity > 0.5) {
      const spawnIndex = Math.floor(time * 10) % NUM_ATTRACTORS
      attractors[spawnIndex].x = (Math.random() - 0.5) * 50
      attractors[spawnIndex].y = (Math.random() - 0.5) * 35
    }

    const baseWave = bands.highSmooth * 2

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const row = i % ROWS
      
      let displaceY = 0
      let totalInfluence = 0
      
      for (const attractor of attractors) {
        const dx = ox - attractor.x
        const dy = oy - attractor.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist < 25) {
          const influence = Math.pow(1 - dist / 25, 2)
          displaceY += influence * attractor.strength * Math.sign(dy)
          totalInfluence += influence
        }
      }

      const lineWave = Math.sin(ox * 0.1 + time * 2 + row * 0.05) * baseWave
      
      positions[i * 3] = ox
      positions[i * 3 + 1] = oy + displaceY + lineWave
      positions[i * 3 + 2] = totalInfluence * 5

      sizes[i] = 1.2 + totalInfluence * 4 + bands.beatIntensity * 2

      const warpHeat = Math.min(1, totalInfluence * 2)
      const rowFactor = row / ROWS
      
      colors[i * 3] = 0.4 + warpHeat * 0.6 + bands.beatIntensity * 0.2
      colors[i * 3 + 1] = 0.1 + warpHeat * 0.2
      colors[i * 3 + 2] = 0.5 + rowFactor * 0.3 - warpHeat * 0.3
    }
  }
}
