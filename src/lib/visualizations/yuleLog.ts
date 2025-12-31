import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

interface Ember {
  baseX: number
  baseZ: number
  life: number
  maxLife: number
  speed: number
  drift: number
  isSpark: boolean
}

const embers: Ember[] = []

export const yuleLog: VisualizationMode = {
  id: 'yule_log',
  name: 'Inferno',
  description: 'Roaring flames that dance with the beat',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    embers.length = 0
    
    const baseWidth = 30
    const baseDepth = 10

    for (let i = 0; i < count; i++) {
      const baseX = (Math.random() - 0.5) * baseWidth
      const baseZ = (Math.random() - 0.5) * baseDepth
      const isSpark = Math.random() < 0.12

      positions[i * 3] = baseX
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = baseZ

      embers.push({
        baseX,
        baseZ,
        life: Math.random(),
        maxLife: 0.6 + Math.random() * 0.5,
        speed: 0.8 + Math.random() * 0.8,
        drift: (Math.random() - 0.5) * 2,
        isSpark
      })

      if (isSpark) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.9
        colors[i * 3 + 2] = 0.6
      } else {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.3
        colors[i * 3 + 2] = 0.05
      }
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
    const maxHeight = 25 + bands.bassSmooth * 25 + bands.beatIntensity * 15
    const intensity = 1.5 + bands.midSmooth * 4 + bands.beatIntensity * 3
    const turbulence = 1 + bands.highSmooth * 5
    const sparkChance = 0.1 + bands.beatIntensity * 0.3

    for (let i = 0; i < count; i++) {
      const ember = embers[i]

      const lifeSpeed = ember.speed * (1 + bands.overallSmooth * 1.5 + bands.beatIntensity * 0.8)
      ember.life += 0.02 * lifeSpeed
      
      if (ember.life > ember.maxLife) {
        ember.life = 0
        ember.speed = 0.8 + Math.random() * 0.8
        ember.drift = (Math.random() - 0.5) * 2
        ember.isSpark = Math.random() < sparkChance
        ember.baseX = (Math.random() - 0.5) * 30
        ember.baseZ = (Math.random() - 0.5) * 10
      }

      const lifeRatio = ember.life / ember.maxLife
      const widthCurve = Math.sin(lifeRatio * Math.PI)
      
      const flickerX = Math.sin(time * 12 + ember.drift * 10 + i * 0.02) * widthCurve * turbulence
      const flickerZ = Math.cos(time * 10 + ember.drift * 8) * widthCurve * turbulence * 0.4

      const heightCurve = Math.pow(lifeRatio, 0.5)
      let height = heightCurve * maxHeight

      let sparkOffset = 0
      if (ember.isSpark) {
        sparkOffset = Math.sin(time * 20 + i) * (5 + lifeRatio * 10)
        height += lifeRatio * 15
      }

      positions[i * 3] = ember.baseX + flickerX * 4 + ember.drift * lifeRatio * 8 + sparkOffset
      positions[i * 3 + 1] = height - 15
      positions[i * 3 + 2] = ember.baseZ + flickerZ * 2

      const baseSizeFactor = Math.pow(1 - lifeRatio, 0.7)
      if (ember.isSpark) {
        sizes[i] = 1.5 + (1 - lifeRatio) * 2 + bands.highSmooth * 3 + bands.beatIntensity * 2
      } else {
        sizes[i] = 2.5 + baseSizeFactor * 5 + bands.bassSmooth * 4 + bands.beatIntensity * 3
      }

      const heatGradient = 1 - lifeRatio
      if (ember.isSpark) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.7 + heatGradient * 0.3 + bands.beatIntensity * 0.2
        colors[i * 3 + 2] = 0.3 + heatGradient * 0.5
      } else {
        colors[i * 3] = 0.95 + bands.beatIntensity * 0.05
        colors[i * 3 + 1] = 0.15 + heatGradient * 0.65 + bands.bassSmooth * 0.15
        colors[i * 3 + 2] = heatGradient * 0.1
      }
    }
  }
}
