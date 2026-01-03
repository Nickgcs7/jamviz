import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// SAURON'S EYE CONFIGURATION
// ============================================================================

const CORE_PARTICLES = 800      // Glowing iris
const PUPIL_PARTICLES = 200     // Dark vertical slit pupil
const BEAM_PARTICLES = 1500     // The searching beam of light
const AMBIENT_PARTICLES = 300   // Floating embers around the eye
const TOTAL_MANAGED = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + AMBIENT_PARTICLES

// Eye geometry
const EYE_IRIS_RADIUS = 12
const PUPIL_WIDTH = 2.5
const PUPIL_HEIGHT = 18

// Beam configuration
const BEAM_LENGTH = 80
const BEAM_WIDTH = 15
const BEAM_SWEEP_RANGE = Math.PI * 0.4  // How far the beam sweeps
const BEAM_SWEEP_SPEED = 0.3

// Ring configuration for iris detail
const MAX_RINGS = 6
const RING_SEGMENTS = 64

// ============================================================================
// STATE
// ============================================================================

interface BeamParticle {
  distance: number
  angle: number
  spreadAngle: number
  age: number
  maxAge: number
  baseIntensity: number
}

const beamParticles: BeamParticle[] = []
let beamAngle = 0
let beamTargetAngle = 0
let lastBeatTime = 0
let eyeIntensity = 1
let pupilDilation = 1

// Scene objects
let ringGeometries: THREE.BufferGeometry[] = []
let ringMaterials: THREE.LineBasicMaterial[] = []
let ringLines: THREE.LineLoop[] = []
let beamCone: THREE.Mesh | null = null
let beamConeMaterial: THREE.MeshBasicMaterial | null = null

let currentGradient = builtInGradients.fire

// ============================================================================
// INITIALIZATION
// ============================================================================

function initBeamParticles() {
  beamParticles.length = 0
  for (let i = 0; i < BEAM_PARTICLES; i++) {
    beamParticles.push({
      distance: Math.random() * BEAM_LENGTH,
      angle: (Math.random() - 0.5) * BEAM_WIDTH * 0.01,
      spreadAngle: (Math.random() - 0.5) * Math.PI * 0.15,
      age: Math.random(),
      maxAge: 0.6 + Math.random() * 0.8,
      baseIntensity: 0.3 + Math.random() * 0.7
    })
  }
}

function getPupilShape(t: number, dilation: number): { x: number; y: number } {
  // Vertical slit pupil shape
  const heightScale = PUPIL_HEIGHT * dilation
  const widthScale = PUPIL_WIDTH * (0.5 + dilation * 0.5)
  
  return {
    x: Math.sin(t * Math.PI * 2) * widthScale,
    y: Math.cos(t * Math.PI * 2) * heightScale * 0.5
  }
}

// ============================================================================
// VISUALIZATION
// ============================================================================

export const sauronsEye: VisualizationMode = {
  id: 'saurons_eye',
  name: "Sauron's Eye",
  description: 'The all-seeing eye with a searching beam that pulses to the music',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initBeamParticles()
    beamAngle = 0
    beamTargetAngle = 0
    lastBeatTime = 0
    eyeIntensity = 1
    pupilDilation = 1

    // Initialize iris particles (fiery ring)
    for (let i = 0; i < CORE_PARTICLES; i++) {
      const angle = (i / CORE_PARTICLES) * Math.PI * 2
      const radiusFactor = 0.3 + Math.pow(Math.random(), 0.5) * 0.7
      const radius = EYE_IRIS_RADIUS * radiusFactor
      
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2
      
      const temp = 1 - radiusFactor
      const [r, g, b] = sampleGradient(currentGradient, temp)
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
      colors[particleIndex * 3 + 1] = 0.8
      colors[particleIndex * 3 + 2] = 0.3
    }

    // Initialize ambient embers
    for (let i = 0; i < AMBIENT_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + i
      const radius = EYE_IRIS_RADIUS + 5 + Math.random() * 20
      const angle = Math.random() * Math.PI * 2
      positions[particleIndex * 3] = Math.cos(angle) * radius
      positions[particleIndex * 3 + 1] = Math.sin(angle) * radius
      positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * 10
      
      const [r, g, b] = sampleGradient(currentGradient, 0.7 + Math.random() * 0.3)
      colors[particleIndex * 3] = r
      colors[particleIndex * 3 + 1] = g
      colors[particleIndex * 3 + 2] = b
    }

    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -200
      positions[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    ringGeometries.forEach(g => g.dispose())
    ringMaterials.forEach(m => m.dispose())
    ringLines.forEach(l => scene.remove(l))
    ringGeometries = []
    ringMaterials = []
    ringLines = []

    // Create iris rings for detail
    for (let r = 0; r < MAX_RINGS; r++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array((RING_SEGMENTS + 1) * 3)
      const radiusFactor = 0.4 + (r / MAX_RINGS) * 0.6
      const radius = EYE_IRIS_RADIUS * radiusFactor
      
      for (let j = 0; j <= RING_SEGMENTS; j++) {
        const angle = (j / RING_SEGMENTS) * Math.PI * 2
        positions[j * 3] = Math.cos(angle) * radius
        positions[j * 3 + 1] = Math.sin(angle) * radius
        positions[j * 3 + 2] = 0
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      const material = new THREE.LineBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        linewidth: 2
      })
      
      const line = new THREE.LineLoop(geometry, material)
      scene.add(line)
      
      ringGeometries.push(geometry)
      ringMaterials.push(material)
      ringLines.push(line)
    }

    // Create beam cone mesh for volumetric effect
    const coneGeometry = new THREE.ConeGeometry(BEAM_WIDTH, BEAM_LENGTH, 16, 1, true)
    beamConeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
    beamCone = new THREE.Mesh(coneGeometry, beamConeMaterial)
    beamCone.rotation.x = Math.PI / 2
    beamCone.position.z = -BEAM_LENGTH / 2
    scene.add(beamCone)

    return {
      objects: [...ringLines, beamCone],
      update: (bands: AudioBands, time: number) => {
        const cycleHue = getCyclingHue(time)
        
        // Bass makes the eye more intense
        eyeIntensity = 0.7 + bands.bassSmooth * 0.4 + bands.beatIntensity * 0.3
        
        // Pupil dilates with high frequencies (fear/excitement)
        pupilDilation = 0.6 + bands.highSmooth * 0.4 + bands.brillianceSmooth * 0.3
        
        // Beat causes eye to flare
        if (bands.isBeat && time - lastBeatTime > 0.2) {
          lastBeatTime = time
          eyeIntensity = Math.min(1.5, eyeIntensity + bands.beatIntensity * 0.5)
        }
        
        // Beam searches - sweeps back and forth
        // Audio influences sweep speed and range
        const sweepSpeed = BEAM_SWEEP_SPEED * (1 + bands.midSmooth * 0.8)
        beamTargetAngle = Math.sin(time * sweepSpeed) * BEAM_SWEEP_RANGE * (0.7 + bands.overallSmooth * 0.6)
        
        // Beats cause the beam to snap to new angles
        if (bands.beatIntensity > 0.6) {
          beamTargetAngle += (Math.random() - 0.5) * BEAM_SWEEP_RANGE * 0.5
        }
        
        beamAngle += (beamTargetAngle - beamAngle) * 0.08
        
        // Update beam cone
        if (beamCone && beamConeMaterial) {
          beamCone.rotation.z = beamAngle
          const beamIntensity = 0.6 + bands.bassSmooth * 0.3 + bands.beatIntensity * 0.4
          beamConeMaterial.opacity = 0.15 * beamIntensity
          
          const temp = 0.3 + bands.bassSmooth * 0.3
          const [r, g, b] = sampleGradient(currentGradient, temp)
          beamConeMaterial.color.setRGB(r * 1.5, g * 1.3, b * 0.8)
        }
        
        // Update iris rings
        for (let r = 0; r < MAX_RINGS; r++) {
          const material = ringMaterials[r]
          const line = ringLines[r]
          const geometry = ringGeometries[r]
          
          // Pulsing scale based on audio
          const pulse = 1 + Math.sin(time * 3 + r * 0.5) * 0.05 * bands.midSmooth
          const beatPulse = bands.beatIntensity * 0.15
          line.scale.setScalar(pulse + beatPulse)
          
          // Color shifts with audio
          const temp = (r / MAX_RINGS) * 0.5 + cycleHue * 0.2 + bands.bassSmooth * 0.2
          const [r2, g2, b2] = sampleGradient(currentGradient, temp)
          material.color.setRGB(r2, g2, b2)
          
          // Opacity pulses
          const ringIntensity = eyeIntensity * (0.3 + (1 - r / MAX_RINGS) * 0.4)
          material.opacity = ringIntensity * (0.4 + bands.bassSmooth * 0.3)
          
          // Add waviness to rings
          const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
          const positions = posAttr.array as Float32Array
          const radiusFactor = 0.4 + (r / MAX_RINGS) * 0.6
          const baseRadius = EYE_IRIS_RADIUS * radiusFactor
          
          for (let j = 0; j <= RING_SEGMENTS; j++) {
            const angle = (j / RING_SEGMENTS) * Math.PI * 2
            const wave = Math.sin(angle * 4 + time * 2) * 0.3 * bands.highSmooth
            const radius = baseRadius + wave
            positions[j * 3] = Math.cos(angle) * radius
            positions[j * 3 + 1] = Math.sin(angle) * radius
          }
          posAttr.needsUpdate = true
        }
      },
      dispose: () => {
        ringGeometries.forEach(g => g.dispose())
        ringMaterials.forEach(m => m.dispose())
        ringLines.forEach(l => scene.remove(l))
        if (beamCone) {
          beamCone.geometry.dispose()
          scene.remove(beamCone)
        }
        if (beamConeMaterial) beamConeMaterial.dispose()
        ringGeometries = []
        ringMaterials = []
        ringLines = []
        beamCone = null
        beamConeMaterial = null
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
    const dt = 0.016
    const cycleHue = getCyclingHue(time)

    // Animate iris particles
    for (let i = 0; i < Math.min(count, CORE_PARTICLES); i++) {
      const angle = (i / CORE_PARTICLES) * Math.PI * 2
      const radiusFactor = 0.3 + Math.pow((i % 100) / 100, 0.5) * 0.7
      
      // Pulsing radius
      const basePulse = Math.sin(time * 2 + radiusFactor * 3) * 0.15
      const beatPulse = bands.beatIntensity * 0.3
      const bassExpand = bands.bassSmooth * 0.4
      const radius = EYE_IRIS_RADIUS * radiusFactor * (1 + basePulse + beatPulse + bassExpand)
      
      // Swirling motion
      const swirl = time * 0.3 + radiusFactor * 2
      const finalAngle = angle + swirl
      
      positions[i * 3] = Math.cos(finalAngle) * radius
      positions[i * 3 + 1] = Math.sin(finalAngle) * radius
      positions[i * 3 + 2] = Math.sin(time * 2 + i * 0.1) * 1.5 * bands.midSmooth
      
      // Color based on distance from center (hotter at edges)
      const temp = (1 - radiusFactor) * 0.6 + cycleHue * 0.2
      const [r, g, b] = sampleGradient(currentGradient, temp)
      const brightness = eyeIntensity * (0.7 + radiusFactor * 0.3)
      colors[i * 3] = r * brightness
      colors[i * 3 + 1] = g * brightness
      colors[i * 3 + 2] = b * brightness
      
      sizes[i] = (2 + radiusFactor * 3 + bands.beatIntensity * 2) * eyeIntensity
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

    // Animate beam particles
    for (let i = 0; i < BEAM_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
      if (particleIndex >= count) break
      
      const bp = beamParticles[i]
      
      // Age particles
      bp.age += dt / bp.maxAge
      if (bp.age > 1) {
        bp.age = 0
        bp.distance = 0
        bp.maxAge = 0.6 + Math.random() * 0.8
        bp.baseIntensity = 0.3 + Math.random() * 0.7
      }
      
      // Move along beam
      const speed = 40 + bands.bassSmooth * 30 + bands.beatIntensity * 20
      bp.distance += dt * speed
      
      if (bp.distance > BEAM_LENGTH) {
        bp.age = 1 // Reset
        continue
      }
      
      // Position along beam with spread
      const beamProgress = bp.distance / BEAM_LENGTH
      const spreadWidth = BEAM_WIDTH * beamProgress
      const lateralOffset = Math.sin(bp.spreadAngle) * spreadWidth
      const verticalOffset = Math.cos(bp.spreadAngle) * spreadWidth
      
      // Rotate by beam angle
      const rotatedX = lateralOffset * Math.cos(beamAngle) - bp.distance * Math.sin(beamAngle)
      const rotatedZ = -(lateralOffset * Math.sin(beamAngle) + bp.distance * Math.cos(beamAngle))
      
      positions[particleIndex * 3] = rotatedX
      positions[particleIndex * 3 + 1] = verticalOffset
      positions[particleIndex * 3 + 2] = rotatedZ
      
      // Color fades along beam
      const life = 1 - bp.age
      const distanceFade = 1 - beamProgress * 0.6
      const temp = 0.2 + beamProgress * 0.3
      const [r, g, b] = sampleGradient(currentGradient, temp)
      const brightness = bp.baseIntensity * life * distanceFade * eyeIntensity
      
      colors[particleIndex * 3] = r * brightness
      colors[particleIndex * 3 + 1] = g * brightness
      colors[particleIndex * 3 + 2] = b * brightness
      
      sizes[particleIndex] = (2 + bands.beatIntensity * 3) * life * distanceFade
    }

    // Animate ambient embers
    for (let i = 0; i < AMBIENT_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + BEAM_PARTICLES + i
      if (particleIndex >= count) break
      
      const orbitSpeed = 0.1 + (i % 10) * 0.02
      const orbitPhase = time * orbitSpeed + i * 0.5
      const radius = EYE_IRIS_RADIUS + 5 + (i % 20)
      
      positions[particleIndex * 3] = Math.cos(orbitPhase) * radius
      positions[particleIndex * 3 + 1] = Math.sin(orbitPhase) * radius
      positions[particleIndex * 3 + 2] = Math.sin(time + i * 0.3) * 5
      
      const [r, g, b] = sampleGradient(currentGradient, 0.7 + Math.random() * 0.3)
      const flicker = 0.5 + Math.sin(time * 3 + i) * 0.3 + Math.random() * 0.2
      colors[particleIndex * 3] = r * flicker
      colors[particleIndex * 3 + 1] = g * flicker
      colors[particleIndex * 3 + 2] = b * flicker
      
      sizes[particleIndex] = (0.8 + Math.sin(time * 2 + i) * 0.4) * (1 + bands.highSmooth)
    }

    // Hide unused particles
    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}

export function setSauronsEyeGradient(gradient: typeof currentGradient) {
  currentGradient = gradient
}
