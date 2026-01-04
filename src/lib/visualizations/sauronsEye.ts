import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient, type GradientPreset } from '../gradients'

// ============================================================================
// CONFIGURATION - Simplified Sauron's Eye
// ============================================================================

export interface SauronsEyeConfig {
  // Eye geometry
  eyeSize: number
  pupilWidth: number
  pupilHeight: number

  // Beam configuration (particle beam only)
  beamEnabled: boolean
  beamLength: number
  beamWidth: number  // Spread/thickness of particle beam
  beamSweepRange: number
  beamSweepSpeed: number
  beamIntensity: number

  // Wavy arm tentacles
  armsEnabled: boolean
  armCount: number
  armLength: number
  armWaveFrequency: number
  armWaveAmplitude: number
  armSpeed: number

  // Color configuration
  colorMode: 'gradient' | 'pulse' | 'rainbow' | 'fire'
  gradient: GradientPreset
  colorCycleSpeed: number
  glowIntensity: number

  // Audio response
  bassInfluence: number
  midInfluence: number
  highInfluence: number
  beatReactivity: number

  // Animation
  swirlSpeed: number
  pulseSpeed: number
  smoothingFactor: number
}

const DEFAULT_CONFIG: SauronsEyeConfig = {
  eyeSize: 12,
  pupilWidth: 2.5,
  pupilHeight: 18,

  beamEnabled: true,
  beamLength: 50,
  beamWidth: 3,
  beamSweepRange: Math.PI * 0.35,
  beamSweepSpeed: 0.4,
  beamIntensity: 1.2,

  armsEnabled: true,
  armCount: 8,
  armLength: 35,
  armWaveFrequency: 3,
  armWaveAmplitude: 8,
  armSpeed: 1.5,

  colorMode: 'gradient',
  gradient: builtInGradients.fire,
  colorCycleSpeed: 0.15,
  glowIntensity: 1.0,

  bassInfluence: 1.0,
  midInfluence: 1.0,
  highInfluence: 1.0,
  beatReactivity: 1.0,

  swirlSpeed: 0.3,
  pulseSpeed: 2.0,
  smoothingFactor: 0.08
}

let config: SauronsEyeConfig = { ...DEFAULT_CONFIG }

// ============================================================================
// PARTICLE COUNTS
// ============================================================================

const CORE_PARTICLES = 600      // Eye iris/core
const PUPIL_PARTICLES = 150     // Dark pupil slit
const BEAM_PARTICLES = 400      // Particle beam
const ARM_PARTICLES = 2000      // Wavy tentacle arms
const TOTAL_MANAGED = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + ARM_PARTICLES

// ============================================================================
// STATE
// ============================================================================

let beamAngle = 0
let beamTargetAngle = 0
let lastBeatTime = 0
let eyeIntensity = 1
let pupilDilation = 1

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPupilShape(t: number, dilation: number): { x: number; y: number } {
  const heightScale = config.pupilHeight * dilation
  const widthScale = config.pupilWidth * (0.4 + dilation * 0.6)
  
  return {
    x: Math.sin(t * Math.PI * 2) * widthScale,
    y: Math.cos(t * Math.PI * 2) * heightScale * 0.5
  }
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const sauronsEye: VisualizationMode = {
  id: 'saurons_eye',
  name: "Sauron's Eye",
  description: 'The all-seeing eye with searching beam and wavy tentacle arms',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    beamAngle = 0
    beamTargetAngle = 0
    lastBeatTime = 0
    eyeIntensity = 1
    pupilDilation = 1

    // Initialize iris particles (fiery ring around pupil)
    for (let i = 0; i < CORE_PARTICLES; i++) {
      const angle = (i / CORE_PARTICLES) * Math.PI * 2
      const radiusFactor = 0.3 + Math.pow(Math.random(), 0.5) * 0.7
      const radius = config.eyeSize * radiusFactor
      
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2
      
      const temp = 1 - radiusFactor
      const [r, g, b] = sampleGradient(config.gradient, temp)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    // Initialize pupil particles (dark vertical slit)
    for (let i = 0; i < PUPIL_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      const t = i / PUPIL_PARTICLES
      const pupilShape = getPupilShape(t, 1)
      
      positions[particleIndex * 3] = pupilShape.x
      positions[particleIndex * 3 + 1] = pupilShape.y
      positions[particleIndex * 3 + 2] = 0.5
      
      colors[particleIndex * 3] = 0.05
      colors[particleIndex * 3 + 1] = 0.0
      colors[particleIndex * 3 + 2] = 0.0
    }

    // Initialize beam particles
    for (let i = 0; i < BEAM_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
      positions[particleIndex * 3] = 0
      positions[particleIndex * 3 + 1] = -200
      positions[particleIndex * 3 + 2] = 0
      colors[particleIndex * 3] = 1.0
      colors[particleIndex * 3 + 1] = 0.6
      colors[particleIndex * 3 + 2] = 0.2
    }

    // Initialize arm particles (wavy tentacles)
    for (let i = 0; i < ARM_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + i
      const armIndex = Math.floor(i / (ARM_PARTICLES / config.armCount))
      const armAngle = (armIndex / config.armCount) * Math.PI * 2
      const progress = (i % (ARM_PARTICLES / config.armCount)) / (ARM_PARTICLES / config.armCount)
      const radius = config.eyeSize + progress * config.armLength
      
      positions[particleIndex * 3] = Math.cos(armAngle) * radius
      positions[particleIndex * 3 + 1] = Math.sin(armAngle) * radius
      positions[particleIndex * 3 + 2] = 0
      
      const [r, g, b] = sampleGradient(config.gradient, 0.3 + progress * 0.5)
      colors[particleIndex * 3] = r
      colors[particleIndex * 3 + 1] = g
      colors[particleIndex * 3 + 2] = b
    }

    // Hide unused particles
    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -200
      positions[i * 3 + 2] = 0
    }
  },

  createSceneObjects(): SceneObjects {
    // No scene objects needed - everything is particles now
    return {
      objects: [],
      update: (bands: AudioBands, time: number) => {
        // Bass makes the eye more intense
        const targetIntensity = 0.7 + 
          bands.bassSmooth * 0.4 * config.bassInfluence + 
          bands.beatIntensity * 0.3 * config.beatReactivity
        eyeIntensity += (targetIntensity - eyeIntensity) * config.smoothingFactor
        
        // Pupil dilates with high frequencies
        const targetDilation = 0.5 + 
          bands.highSmooth * 0.5 * config.highInfluence + 
          bands.brillianceSmooth * 0.3 * config.highInfluence
        pupilDilation += (targetDilation - pupilDilation) * config.smoothingFactor
        
        // Beat causes eye to flare
        if (bands.isBeat && time - lastBeatTime > 0.2) {
          lastBeatTime = time
          eyeIntensity = Math.min(1.5, eyeIntensity + bands.beatIntensity * 0.5 * config.beatReactivity)
        }
        
        // Beam sweeps back and forth
        const sweepSpeed = config.beamSweepSpeed * (1 + bands.midSmooth * 0.8 * config.midInfluence)
        beamTargetAngle = Math.sin(time * sweepSpeed) * config.beamSweepRange * 
          (0.6 + bands.overallSmooth * 0.5)
        
        // Beats cause beam to snap to new angles
        if (bands.beatIntensity > 0.5) {
          beamTargetAngle += (Math.random() - 0.5) * config.beamSweepRange * 0.4 * config.beatReactivity
        }
        
        beamAngle += (beamTargetAngle - beamAngle) * 0.06
      },
      dispose: () => {
        // Nothing to dispose
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
    const cycleHue = getCyclingHue(time)

    // Animate iris particles (fiery core)
    for (let i = 0; i < Math.min(count, CORE_PARTICLES); i++) {
      const angle = (i / CORE_PARTICLES) * Math.PI * 2
      const radiusFactor = 0.3 + Math.pow((i % 100) / 100, 0.5) * 0.7
      
      // Pulsing radius
      const basePulse = Math.sin(time * config.pulseSpeed + radiusFactor * 3) * 0.15
      const beatPulse = bands.beatIntensity * 0.3 * config.beatReactivity
      const bassExpand = bands.bassSmooth * 0.4 * config.bassInfluence
      const radius = config.eyeSize * radiusFactor * (1 + basePulse + beatPulse + bassExpand)
      
      // Swirling motion
      const swirl = time * config.swirlSpeed + radiusFactor * 2
      const finalAngle = angle + swirl
      
      positions[i * 3] = Math.cos(finalAngle) * radius
      positions[i * 3 + 1] = Math.sin(finalAngle) * radius
      positions[i * 3 + 2] = Math.sin(time * 2 + i * 0.1) * 1.5 * bands.midSmooth * config.midInfluence
      
      // Color based on distance from center
      const temp = (1 - radiusFactor) * 0.6 + cycleHue * config.colorCycleSpeed
      const [r, g, b] = sampleGradient(config.gradient, temp)
      const brightness = eyeIntensity * (0.7 + radiusFactor * 0.3) * config.glowIntensity
      colors[i * 3] = r * brightness
      colors[i * 3 + 1] = g * brightness
      colors[i * 3 + 2] = b * brightness
      
      sizes[i] = (2 + radiusFactor * 3 + bands.beatIntensity * 2 * config.beatReactivity) * eyeIntensity
    }

    // Animate pupil (vertical slit)
    for (let i = 0; i < PUPIL_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      if (particleIndex >= count) break
      
      const t = i / PUPIL_PARTICLES
      const pupilShape = getPupilShape(t, pupilDilation)
      
      positions[particleIndex * 3] = pupilShape.x
      positions[particleIndex * 3 + 1] = pupilShape.y
      positions[particleIndex * 3 + 2] = 0.5 + Math.sin(time * 4 + i) * 0.2
      
      // Dark pupil with slight red glow on edges
      const edgeFactor = Math.abs(t - 0.5) * 2
      colors[particleIndex * 3] = 0.05 + edgeFactor * 0.15 * eyeIntensity
      colors[particleIndex * 3 + 1] = 0.0
      colors[particleIndex * 3 + 2] = 0.0
      
      sizes[particleIndex] = 3 + edgeFactor * 2
    }

    // Animate beam particles (particle-only beam)
    if (config.beamEnabled) {
      for (let i = 0; i < BEAM_PARTICLES; i++) {
        const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
        if (particleIndex >= count) break
        
        // Distribute along beam length with some spread
        const progress = (i / BEAM_PARTICLES)
        const distance = progress * config.beamLength
        
        // Spread increases with distance (cone effect)
        const spreadRadius = config.beamWidth * progress * 0.8
        const spreadAngle = (i * 2.399) // Golden angle for even distribution
        const spreadX = Math.cos(spreadAngle) * spreadRadius * (0.5 + Math.random() * 0.5)
        const spreadY = Math.sin(spreadAngle) * spreadRadius * (0.5 + Math.random() * 0.5)
        
        // Rotate by beam angle
        const cosA = Math.cos(beamAngle)
        const sinA = Math.sin(beamAngle)
        
        const localZ = -distance
        const rotatedX = spreadX * cosA - localZ * sinA
        const rotatedZ = spreadX * sinA + localZ * cosA
        
        positions[particleIndex * 3] = rotatedX
        positions[particleIndex * 3 + 1] = spreadY
        positions[particleIndex * 3 + 2] = rotatedZ
        
        // Color fades along beam
        const fade = 1 - progress * 0.5
        const flicker = 0.8 + Math.sin(time * 10 + i * 0.5) * 0.2
        const temp = 0.1 + progress * 0.4
        const [r, g, b] = sampleGradient(config.gradient, temp)
        const brightness = fade * flicker * eyeIntensity * config.glowIntensity * config.beamIntensity
        
        colors[particleIndex * 3] = r * brightness
        colors[particleIndex * 3 + 1] = g * brightness
        colors[particleIndex * 3 + 2] = b * brightness
        
        // Larger particles for thicker beam
        sizes[particleIndex] = (2 + bands.bassSmooth * 3) * fade * config.beamIntensity
      }
    } else {
      // Hide beam particles
      for (let i = 0; i < BEAM_PARTICLES; i++) {
        const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
        if (particleIndex >= count) break
        positions[particleIndex * 3 + 1] = -200
        sizes[particleIndex] = 0
      }
    }

    // Animate wavy arm tentacles
    if (config.armsEnabled) {
      const particlesPerArm = Math.floor(ARM_PARTICLES / config.armCount)
      
      for (let armIdx = 0; armIdx < config.armCount; armIdx++) {
        const baseAngle = (armIdx / config.armCount) * Math.PI * 2
        // Arms slowly rotate
        const armRotation = time * 0.1 + armIdx * 0.2
        const currentAngle = baseAngle + armRotation
        
        for (let j = 0; j < particlesPerArm; j++) {
          const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + armIdx * particlesPerArm + j
          if (particleIndex >= count) break
          
          const progress = j / particlesPerArm
          const distance = config.eyeSize + progress * config.armLength
          
          // Wavy motion - sine wave that travels outward
          const wavePhase = progress * config.armWaveFrequency * Math.PI * 2 - time * config.armSpeed
          const waveOffset = Math.sin(wavePhase) * config.armWaveAmplitude * progress
          
          // Audio reactivity on waves
          const audioWave = bands.midSmooth * 3 * Math.sin(wavePhase * 2) * progress * config.midInfluence
          const beatWave = bands.beatIntensity * 5 * Math.sin(wavePhase * 0.5) * config.beatReactivity
          
          // Calculate perpendicular offset for wave
          const perpAngle = currentAngle + Math.PI / 2
          const totalWave = waveOffset + audioWave + beatWave
          
          const x = Math.cos(currentAngle) * distance + Math.cos(perpAngle) * totalWave
          const y = Math.sin(currentAngle) * distance + Math.sin(perpAngle) * totalWave
          const z = Math.sin(wavePhase * 0.5) * 3 * progress // Slight Z wave
          
          positions[particleIndex * 3] = x
          positions[particleIndex * 3 + 1] = y
          positions[particleIndex * 3 + 2] = z
          
          // Color gradient along arm
          const temp = 0.3 + progress * 0.5 + Math.sin(wavePhase) * 0.1
          const [r, g, b] = sampleGradient(config.gradient, temp)
          const fade = 1 - progress * 0.6
          const brightness = fade * eyeIntensity * config.glowIntensity
          
          colors[particleIndex * 3] = r * brightness
          colors[particleIndex * 3 + 1] = g * brightness
          colors[particleIndex * 3 + 2] = b * brightness
          
          // Size tapers toward end
          sizes[particleIndex] = (1.5 + bands.bassSmooth * 2 * config.bassInfluence) * (1 - progress * 0.7)
        }
      }
    } else {
      // Hide arm particles
      for (let i = 0; i < ARM_PARTICLES; i++) {
        const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + i
        if (particleIndex >= count) break
        positions[particleIndex * 3 + 1] = -200
        sizes[particleIndex] = 0
      }
    }

    // Hide unused particles
    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function setSauronsEyeConfig(newConfig: Partial<SauronsEyeConfig>): void {
  config = { ...config, ...newConfig }
}

export function getSauronsEyeConfig(): SauronsEyeConfig {
  return { ...config }
}

export function setSauronsEyeGradient(gradient: GradientPreset): void {
  config.gradient = gradient
}

export function setSauronsEyeColorMode(mode: SauronsEyeConfig['colorMode']): void {
  config.colorMode = mode
}

export function setSauronsEyeGeometry(params: {
  eyeSize?: number
  pupilWidth?: number
  pupilHeight?: number
}): void {
  if (params.eyeSize !== undefined) config.eyeSize = params.eyeSize
  if (params.pupilWidth !== undefined) config.pupilWidth = params.pupilWidth
  if (params.pupilHeight !== undefined) config.pupilHeight = params.pupilHeight
}

export function setSauronsEyeBeam(params: {
  beamEnabled?: boolean
  beamLength?: number
  beamWidth?: number
  beamSweepRange?: number
  beamSweepSpeed?: number
  beamIntensity?: number
}): void {
  if (params.beamEnabled !== undefined) config.beamEnabled = params.beamEnabled
  if (params.beamLength !== undefined) config.beamLength = params.beamLength
  if (params.beamWidth !== undefined) config.beamWidth = params.beamWidth
  if (params.beamSweepRange !== undefined) config.beamSweepRange = params.beamSweepRange
  if (params.beamSweepSpeed !== undefined) config.beamSweepSpeed = params.beamSweepSpeed
  if (params.beamIntensity !== undefined) config.beamIntensity = params.beamIntensity
}

export function setSauronsEyeEmbers(params: {
  embersEnabled?: boolean
  emberCount?: number
  emberOrbitSpeed?: number
  emberSpread?: number
}): void {
  // Arms replaced embers - map to arm params for backwards compatibility
  if (params.embersEnabled !== undefined) config.armsEnabled = params.embersEnabled
}

export function setSauronsEyeAudioResponse(params: {
  bassInfluence?: number
  midInfluence?: number
  highInfluence?: number
  beatReactivity?: number
  smoothingFactor?: number
}): void {
  if (params.bassInfluence !== undefined) config.bassInfluence = params.bassInfluence
  if (params.midInfluence !== undefined) config.midInfluence = params.midInfluence
  if (params.highInfluence !== undefined) config.highInfluence = params.highInfluence
  if (params.beatReactivity !== undefined) config.beatReactivity = params.beatReactivity
  if (params.smoothingFactor !== undefined) config.smoothingFactor = params.smoothingFactor
}

export function setSauronsEyeAnimation(params: {
  swirlSpeed?: number
  pulseSpeed?: number
  colorCycleSpeed?: number
  glowIntensity?: number
}): void {
  if (params.swirlSpeed !== undefined) config.swirlSpeed = params.swirlSpeed
  if (params.pulseSpeed !== undefined) config.pulseSpeed = params.pulseSpeed
  if (params.colorCycleSpeed !== undefined) config.colorCycleSpeed = params.colorCycleSpeed
  if (params.glowIntensity !== undefined) config.glowIntensity = params.glowIntensity
}

export function resetSauronsEyeConfig(): void {
  config = { ...DEFAULT_CONFIG }
}
