import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

// Laser beam state
interface LaserBeam {
  angle: number
  length: number
  targetLength: number
  opacity: number
  rotationOffset: number
}

const beams: LaserBeam[] = []
const NUM_BEAMS = 48
const BEAM_PARTICLES = 80

export const laserArray: VisualizationMode = {
  id: 'laser_array',
  name: 'Laser Array',
  description: 'Concert laser beams radiating from center',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    beams.length = 0
    
    for (let b = 0; b < NUM_BEAMS; b++) {
      const angle = (b / NUM_BEAMS) * Math.PI * 2
      beams.push({
        angle,
        length: 5,
        targetLength: 5,
        opacity: 0.8,
        rotationOffset: Math.random() * Math.PI * 2
      })
    }

    for (let i = 0; i < count; i++) {
      const beamIndex = i % NUM_BEAMS
      const beam = beams[beamIndex]
      const particlePos = (Math.floor(i / NUM_BEAMS) / BEAM_PARTICLES)
      
      const dist = particlePos * 30
      positions[i * 3] = Math.cos(beam.angle) * dist
      positions[i * 3 + 1] = Math.sin(beam.angle) * dist * 0.6
      positions[i * 3 + 2] = Math.sin(beam.angle * 0.5) * dist * 0.3

      const coreFactor = 1 - particlePos
      colors[i * 3] = 0.2 + coreFactor * 0.3
      colors[i * 3 + 1] = 0.6 + coreFactor * 0.4
      colors[i * 3 + 2] = 1.0
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
    const globalRotation = time * 0.3 * (1 + bands.midSmooth * 2)
    const baseLength = 15 + bands.bassSmooth * 35
    const beatExtend = bands.beatIntensity * 20
    
    for (let b = 0; b < NUM_BEAMS; b++) {
      const beam = beams[b]
      const isOddBeam = b % 2 === 1
      const lengthMod = isOddBeam ? bands.highSmooth * 15 : bands.midSmooth * 10
      
      beam.targetLength = baseLength + lengthMod + beatExtend + Math.sin(time * 2 + b * 0.3) * 5
      beam.length += (beam.targetLength - beam.length) * 0.3
      beam.opacity = bands.isBeat ? 1.0 : (0.6 + bands.overallSmooth * 0.3)
    }

    for (let i = 0; i < count; i++) {
      const beamIndex = i % NUM_BEAMS
      const beam = beams[beamIndex]
      const particlePos = Math.floor(i / NUM_BEAMS) / BEAM_PARTICLES
      
      const rotatedAngle = beam.angle + globalRotation + beam.rotationOffset * bands.highSmooth * 0.5
      const dist = particlePos * beam.length
      const spreadFactor = particlePos * 0.3
      const verticalSpread = Math.sin(rotatedAngle * 2 + time) * spreadFactor * 8
      
      positions[i * 3] = Math.cos(rotatedAngle) * dist
      positions[i * 3 + 1] = Math.sin(rotatedAngle) * dist * 0.5 + verticalSpread
      positions[i * 3 + 2] = Math.sin(rotatedAngle * 0.7) * dist * 0.4

      const coreFactor = 1 - particlePos
      const baseSz = 1 + coreFactor * 3
      sizes[i] = baseSz + bands.beatIntensity * 3 + bands.bassSmooth * 2

      const beatFlash = bands.isBeat ? 0.4 : 0
      colors[i * 3] = 0.3 + coreFactor * 0.5 + beatFlash
      colors[i * 3 + 1] = 0.7 + coreFactor * 0.3 + beatFlash
      colors[i * 3 + 2] = 1.0
    }
  }
}
