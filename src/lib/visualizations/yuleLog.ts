import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

interface Ember {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  hue: number
}

const embers: Ember[] = []
const MAX_EMBERS = 10000

function spawnEmber(bands: AudioBands): Ember {
  const spread = 12 + bands.bassSmooth * 8
  const intensity = 0.5 + bands.overallSmooth * 0.8 + bands.beatIntensity * 0.5
  
  return {
    x: (Math.random() - 0.5) * spread,
    y: -20 + Math.random() * 5,
    z: (Math.random() - 0.5) * 10, // Depth variation
    vx: (Math.random() - 0.5) * 0.8,
    vy: (0.8 + Math.random() * 1.2) * intensity,
    vz: (Math.random() - 0.5) * 0.4,
    life: 1.0,
    maxLife: 2 + Math.random() * 2,
    size: 1 + Math.random() * 2 + bands.beatIntensity * 2,
    hue: 0.05 + Math.random() * 0.08 // Orange-red range
  }
}

export const yuleLog: VisualizationMode = {
  id: 'yule_log',
  name: 'Yule Log',
  description: 'Warm flickering fire with depth embers',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    embers.length = 0
    
    const defaultBands: AudioBands = {
      bass: 0, mid: 0, high: 0, overall: 0,
      bassSmooth: 0, midSmooth: 0, highSmooth: 0, overallSmooth: 0.3,
      isBeat: false, beatIntensity: 0
    }
    
    for (let i = 0; i < MAX_EMBERS; i++) {
      embers.push(spawnEmber(defaultBands))
      embers[i].life = Math.random() // Spread initial lifetimes
      embers[i].y = -20 + Math.random() * 45 // Spread initial heights
    }

    for (let i = 0; i < count; i++) {
      if (i < MAX_EMBERS) {
        const ember = embers[i]
        positions[i * 3] = ember.x
        positions[i * 3 + 1] = ember.y
        positions[i * 3 + 2] = ember.z
      }

      // Warm fire colors
      const t = Math.random()
      const [r, g, b] = hslToRgb(0.06 - t * 0.04, 0.95, 0.5 + t * 0.2)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  },

  animate(
    positions: Float32Array,
    _originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    const dt = 0.016
    const windX = Math.sin(time * 0.5) * 0.3 * (1 + bands.midSmooth)
    const turbulence = bands.highSmooth * 0.4
    const intensity = 0.8 + bands.overallSmooth * 0.6 + bands.beatIntensity * 0.4

    for (let i = 0; i < MAX_EMBERS && i < count; i++) {
      const ember = embers[i]
      
      // Physics update
      ember.vy += 0.02 * intensity
      ember.vx += windX * 0.01 + (Math.random() - 0.5) * turbulence * 0.1
      ember.vz += (Math.random() - 0.5) * turbulence * 0.08 // Z turbulence
      
      ember.x += ember.vx * dt * 60
      ember.y += ember.vy * dt * 60
      ember.z += ember.vz * dt * 60
      
      // Damping
      ember.vx *= 0.98
      ember.vz *= 0.97
      
      ember.life -= dt / ember.maxLife
      
      // Respawn dead embers
      if (ember.life <= 0 || ember.y > 28) {
        const newEmber = spawnEmber(bands)
        ember.x = newEmber.x
        ember.y = newEmber.y
        ember.z = newEmber.z
        ember.vx = newEmber.vx
        ember.vy = newEmber.vy
        ember.vz = newEmber.vz
        ember.life = 1.0
        ember.maxLife = newEmber.maxLife
        ember.size = newEmber.size
        ember.hue = newEmber.hue
      }
      
      positions[i * 3] = ember.x
      positions[i * 3 + 1] = ember.y
      positions[i * 3 + 2] = ember.z
      
      // Size fades with life, pulses with beat
      const lifeFactor = ember.life * ember.life
      sizes[i] = ember.size * lifeFactor * intensity + bands.beatIntensity * 1.5 * lifeFactor
      
      // Color: hot core (yellow-white) to cooler edges (red-orange)
      // Life determines temperature: young = hot, old = cool
      const temperature = ember.life
      const hue = ember.hue + (1 - temperature) * 0.02 // Shift to red as it cools
      const saturation = 0.85 - temperature * 0.15 // Core is less saturated (whiter)
      const lightness = 0.35 + temperature * 0.35 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r * lifeFactor + (1 - lifeFactor) * 0.1
      colors[i * 3 + 1] = g * lifeFactor
      colors[i * 3 + 2] = b * lifeFactor * 0.5
    }
  }
}
