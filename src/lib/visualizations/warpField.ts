import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'

interface Attractor {
  x: number
  y: number
  z: number
  strength: number
  targetStrength: number
  phase: number
  hueOffset: number
}

const attractors: Attractor[] = []
const NUM_ATTRACTORS = 4
const ROWS = 80
const COLS = 125

export const warpField: VisualizationMode = {
  id: 'warp_field',
  name: 'Warp Field',
  description: 'Parallel lines warped by audio-reactive attractors with depth',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    attractors.length = 0
    
    for (let a = 0; a < NUM_ATTRACTORS; a++) {
      attractors.push({
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 30,
        z: (Math.random() - 0.5) * 20,
        strength: 5,
        targetStrength: 5,
        phase: Math.random() * Math.PI * 2,
        hueOffset: a * 0.08
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

      // Purple to pink gradient based on row
      const rowFactor = row / ROWS
      const [r, g, b] = hslToRgb(0.78 + rowFactor * 0.1, 0.7, 0.45 + rowFactor * 0.1)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
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
    // Get cycling hue offset
    const cycleHue = getCyclingHue(time)
    
    // Animate attractors with 3D movement
    for (let a = 0; a < NUM_ATTRACTORS; a++) {
      const attractor = attractors[a]
      
      attractor.x = Math.sin(time * 0.4 + attractor.phase) * 18 * (1 + bands.midSmooth * 0.8)
      attractor.y = Math.cos(time * 0.35 + attractor.phase * 1.3) * 14 * (1 + bands.highSmooth * 0.8)
      attractor.z = Math.sin(time * 0.5 + attractor.phase * 0.7) * 12 * bands.bassSmooth
      
      attractor.targetStrength = 7 + bands.bassSmooth * 16 + bands.beatIntensity * 12
      attractor.strength += (attractor.targetStrength - attractor.strength) * 0.15
    }

    // Spawn new attractor position on strong beat
    if (bands.isBeat && bands.beatIntensity > 0.6) {
      const spawnIndex = Math.floor(time * 10) % NUM_ATTRACTORS
      attractors[spawnIndex].x = (Math.random() - 0.5) * 45
      attractors[spawnIndex].y = (Math.random() - 0.5) * 32
      attractors[spawnIndex].z = (Math.random() - 0.5) * 18
    }

    const baseWave = bands.highSmooth * 1.5

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const row = i % ROWS
      
      let displaceY = 0
      let displaceZ = 0
      let totalInfluence = 0
      let hueInfluence = 0
      
      for (const attractor of attractors) {
        const dx = ox - attractor.x
        const dy = oy - attractor.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist < 22) {
          const influence = Math.pow(1 - dist / 22, 2)
          displaceY += influence * attractor.strength * Math.sign(dy)
          displaceZ += influence * attractor.z * 0.5
          totalInfluence += influence
          hueInfluence += attractor.hueOffset * influence
        }
      }

      const lineWave = Math.sin(ox * 0.08 + time * 1.8 + row * 0.04) * baseWave
      const depthWave = Math.sin(time * 0.6 + ox * 0.05) * bands.midSmooth * 4
      
      positions[i * 3] = ox
      positions[i * 3 + 1] = oy + displaceY + lineWave
      positions[i * 3 + 2] = displaceZ + depthWave + totalInfluence * 4

      sizes[i] = 1.0 + totalInfluence * 3.5 + bands.beatIntensity * 1.8

      // Color with cycling and warp influence
      const warpHeat = Math.min(1, totalInfluence * 1.8)
      const normalizedHue = totalInfluence > 0 ? hueInfluence / totalInfluence : 0
      const rowFactor = row / ROWS
      
      const hue = cycleHue + rowFactor * 0.1 + normalizedHue + warpHeat * 0.1 - bands.bassSmooth * 0.06
      const saturation = 0.65 + warpHeat * 0.25 + bands.beatIntensity * 0.1
      const lightness = 0.4 + warpHeat * 0.25 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  }
}
