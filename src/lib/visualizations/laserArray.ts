import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

interface LaserBeam {
  angle: number
  targetAngle: number
  length: number
  hue: number
  intensity: number
  z: number
}

const beams: LaserBeam[] = []
const NUM_BEAMS = 16
const PARTICLES_PER_BEAM = 600

export const laserArray: VisualizationMode = {
  id: 'laser_array',
  name: 'Laser Array',
  description: 'Sweeping concert laser beams with depth planes',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    beams.length = 0
    
    for (let b = 0; b < NUM_BEAMS; b++) {
      beams.push({
        angle: (b / NUM_BEAMS) * Math.PI * 2,
        targetAngle: (b / NUM_BEAMS) * Math.PI * 2,
        length: 35,
        hue: 0.35 + (b / NUM_BEAMS) * 0.3, // Green to cyan range
        intensity: 0.7,
        z: (b % 3 - 1) * 8 // Depth layers
      })
    }

    for (let i = 0; i < count; i++) {
      const beamIndex = Math.floor(i / PARTICLES_PER_BEAM) % NUM_BEAMS
      const beam = beams[beamIndex]
      const t = (i % PARTICLES_PER_BEAM) / PARTICLES_PER_BEAM
      
      const r = t * beam.length
      positions[i * 3] = Math.cos(beam.angle) * r
      positions[i * 3 + 1] = Math.sin(beam.angle) * r
      positions[i * 3 + 2] = beam.z

      const [cr, cg, cb] = hslToRgb(beam.hue, 0.9, 0.5 + t * 0.2)
      colors[i * 3] = cr
      colors[i * 3 + 1] = cg
      colors[i * 3 + 2] = cb
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
    // Animate laser beams
    for (let b = 0; b < NUM_BEAMS; b++) {
      const beam = beams[b]
      const baseAngle = (b / NUM_BEAMS) * Math.PI * 2
      
      // Sweeping motion reacting to music
      const sweep = Math.sin(time * 1.2 + b * 0.5) * 0.4
      const bassSweep = bands.bassSmooth * Math.sin(time * 2 + b) * 0.3
      const beatJolt = bands.beatIntensity * Math.sin(b * 2.5) * 0.2
      
      beam.targetAngle = baseAngle + sweep + bassSweep + beatJolt
      beam.angle += (beam.targetAngle - beam.angle) * 0.08
      
      // Dynamic length
      beam.length = 30 + bands.overallSmooth * 15 + bands.beatIntensity * 10
      beam.intensity = 0.6 + bands.overallSmooth * 0.3 + bands.beatIntensity * 0.2
      
      // Depth pulsing
      beam.z = (b % 3 - 1) * 8 + Math.sin(time * 0.8 + b) * bands.midSmooth * 5
      
      // Hue shift with music
      beam.hue = 0.35 + (b / NUM_BEAMS) * 0.25 - bands.bassSmooth * 0.1 + bands.highSmooth * 0.1
    }

    for (let i = 0; i < count; i++) {
      const beamIndex = Math.floor(i / PARTICLES_PER_BEAM) % NUM_BEAMS
      const beam = beams[beamIndex]
      const t = (i % PARTICLES_PER_BEAM) / PARTICLES_PER_BEAM
      
      // Beam extends with bass
      const r = t * beam.length
      
      // Slight wave along beam
      const waveOffset = Math.sin(t * Math.PI * 4 + time * 3) * bands.highSmooth * 0.8
      
      positions[i * 3] = Math.cos(beam.angle + waveOffset * 0.05) * r
      positions[i * 3 + 1] = Math.sin(beam.angle + waveOffset * 0.05) * r
      positions[i * 3 + 2] = beam.z + waveOffset
      
      // Size: core is bigger, fades to tip
      const coreFactor = 1 - t * 0.6
      sizes[i] = (1.5 + bands.overallSmooth * 2 + bands.beatIntensity * 2.5) * coreFactor
      
      // Color gradient along beam
      const hue = beam.hue + t * 0.08
      const saturation = 0.85 + beam.intensity * 0.1
      const lightness = 0.4 + beam.intensity * 0.3 + (1 - t) * 0.15
      
      const [cr, cg, cb] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = cr * beam.intensity
      colors[i * 3 + 1] = cg * beam.intensity
      colors[i * 3 + 2] = cb * beam.intensity
    }
  }
}
