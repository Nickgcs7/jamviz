import type { VisualizationMode, MouseCoords } from './types'
import type { AudioBands } from '../AudioAnalyzer'

// Particle state for fire simulation
interface ParticleState {
  baseX: number
  baseZ: number
  life: number
  maxLife: number
  velocity: number
  flicker: number
  isSpark: boolean
}

const particleStates: ParticleState[] = []

export const yuleLog: VisualizationMode = {
  id: 'yule_log',
  name: 'Yule Log',
  description: 'Cozy fireplace with rising flames and sparks',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    particleStates.length = 0
    
    // Log shape parameters
    const logWidth = 25
    const logDepth = 8

    for (let i = 0; i < count; i++) {
      // Distribute particles in a log-shaped base
      const baseX = (Math.random() - 0.5) * logWidth
      const baseZ = (Math.random() - 0.5) * logDepth
      const isSpark = Math.random() < 0.08 // 8% are sparks

      positions[i * 3] = baseX
      positions[i * 3 + 1] = Math.random() * 5 // Start near bottom
      positions[i * 3 + 2] = baseZ

      // Initialize particle state
      particleStates.push({
        baseX,
        baseZ,
        life: Math.random(),
        maxLife: 0.8 + Math.random() * 0.4,
        velocity: 0.5 + Math.random() * 0.5,
        flicker: Math.random() * Math.PI * 2,
        isSpark
      })

      // Fire colors: yellow core to orange to red tips
      if (isSpark) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2
        colors[i * 3 + 2] = 0.3 + Math.random() * 0.3
      } else {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.4 + Math.random() * 0.3
        colors[i * 3 + 2] = 0.05 + Math.random() * 0.1
      }
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
    const maxFlameHeight = 22 + bands.bassSmooth * 8
    const flickerIntensity = 1 + bands.midSmooth * 2
    const sparkTrigger = bands.highSmooth > 0.3 || bands.beatIntensity > 0.4

    // Mouse as wind source
    const windX = mouse?.active ? mouse.x * 3 : 0
    const windStrength = mouse?.active ? Math.abs(mouse.x) * 0.5 : 0

    for (let i = 0; i < count; i++) {
      const state = particleStates[i]

      // Advance life
      state.life += 0.016 * state.velocity * (1 + bands.overallSmooth * 0.5)
      
      // Reset when life exceeds max
      if (state.life > state.maxLife) {
        state.life = 0
        state.velocity = 0.5 + Math.random() * 0.5
        state.flicker = Math.random() * Math.PI * 2
        state.isSpark = sparkTrigger && Math.random() < 0.15
      }

      const lifeRatio = state.life / state.maxLife
      
      // Flame shape: narrow at base, wider as it rises, then tapers
      const widthFactor = Math.sin(lifeRatio * Math.PI) * (1 + bands.bassSmooth * 0.3)
      
      // Flickering horizontal movement
      const flickerX = Math.sin(time * 8 + state.flicker + i * 0.01) * widthFactor * flickerIntensity
      const flickerZ = Math.cos(time * 7 + state.flicker * 1.3) * widthFactor * 0.5 * flickerIntensity

      // Height with acceleration curve (faster at top)
      const heightCurve = Math.pow(lifeRatio, 0.7)
      const height = heightCurve * maxFlameHeight

      // Spark behavior: more erratic, faster, drift outward
      let sparkDrift = 0
      let sparkHeight = 0
      if (state.isSpark) {
        sparkDrift = Math.sin(time * 15 + i) * (3 + lifeRatio * 5)
        sparkHeight = lifeRatio * 8 // Extra height for sparks
      }

      // Apply wind from mouse
      const windEffect = windX * lifeRatio * (state.isSpark ? 2 : 1)

      positions[i * 3] = state.baseX + flickerX * 2 + sparkDrift + windEffect
      positions[i * 3 + 1] = height + sparkHeight
      positions[i * 3 + 2] = state.baseZ + flickerZ + windStrength * lifeRatio

      // Size: larger at base, smaller at top, sparks are small and bright
      if (state.isSpark) {
        sizes[i] = 1 + (1 - lifeRatio) * 1.5 + bands.highSmooth * 2
      } else {
        const baseSizeFactor = 1 - lifeRatio * 0.6
        sizes[i] = 2 + baseSizeFactor * 3 + bands.overallSmooth * 1.5 + bands.beatIntensity * 1
      }

      // Color gradient: yellow at base -> orange -> red -> dark at tips
      if (state.isSpark) {
        // Sparks: bright yellow-white
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.7 + (1 - lifeRatio) * 0.3
        colors[i * 3 + 2] = 0.3 + (1 - lifeRatio) * 0.4
      } else {
        // Flames: yellow -> orange -> red
        const heatGradient = 1 - lifeRatio
        colors[i * 3] = 0.9 + heatGradient * 0.1 + bands.beatIntensity * 0.1
        colors[i * 3 + 1] = 0.2 + heatGradient * 0.5 + bands.midSmooth * 0.1
        colors[i * 3 + 2] = 0.02 + heatGradient * 0.08
      }
    }
  }
}