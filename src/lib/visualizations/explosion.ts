import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// SUPERNOVA CONFIGURATION
// ============================================================================

// Particle distribution
const CORE_PARTICLES = 800      // Dense glowing core
const JET_PARTICLES = 1500      // Particles for burst jets (increased for stereo)
const DEBRIS_PARTICLES = 500    // Ambient debris field
const TOTAL_MANAGED = CORE_PARTICLES + JET_PARTICLES + DEBRIS_PARTICLES

// Shockwave ring configuration
const MAX_SHOCKWAVES = 8        // Increased for BPM sync
const SHOCKWAVE_SEGMENTS = 64
const SHOCKWAVE_LIFETIME = 2.5  // seconds

// Jet burst configuration
const JET_COUNT = 16            // Increased number of radial jets
const PARTICLES_PER_JET = Math.floor(JET_PARTICLES / JET_COUNT)

// Core glow configuration
const CORE_PEAK_HOLD_TIME = 300   // ms to hold peak core glow
const CORE_PEAK_DECAY = 0.95      // decay rate after hold

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface JetParticle {
  jetIndex: number
  baseDirection: THREE.Vector3
  velocity: THREE.Vector3
  age: number
  maxAge: number
  spawnRadius: number
  active: boolean
  stereoSide: 'left' | 'right' | 'center'
}

interface Shockwave {
  radius: number
  maxRadius: number
  age: number
  maxAge: number
  intensity: number
  hue: number
  active: boolean
  bpmTriggered: boolean
}

interface DebrisParticle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  orbitRadius: number
  orbitSpeed: number
  orbitPhase: number
  stereoOffset: number
}

const jetDirections: THREE.Vector3[] = []
const jetParticles: JetParticle[] = []
const shockwaves: Shockwave[] = []
const debrisParticles: DebrisParticle[] = []

let shockwaveGeometries: THREE.BufferGeometry[] = []
let shockwaveMaterials: THREE.LineBasicMaterial[] = []
let shockwaveLines: THREE.LineLoop[] = []
let coreGlowMesh: THREE.Mesh | null = null
let coreGlowMaterial: THREE.MeshBasicMaterial | null = null

let lastBeatTime = 0
let lastBassHitTime = 0
let cumulativeExplosionForce = 0
let corePeakValue = 0
let corePeakHoldTimer = 0
let lastUpdateTime = 0
let lastBPMBeatTime = 0

let currentGradient = builtInGradients.fire

// ============================================================================
// INITIALIZATION
// ============================================================================

function initJetDirections() {
  jetDirections.length = 0
  for (let i = 0; i < JET_COUNT; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / JET_COUNT)
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    jetDirections.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ).normalize())
  }
}

function initJetParticles() {
  jetParticles.length = 0
  for (let i = 0; i < JET_PARTICLES; i++) {
    const jetIndex = Math.floor(i / PARTICLES_PER_JET) % JET_COUNT
    const baseDir = jetDirections[jetIndex] || new THREE.Vector3(0, 1, 0)
    let stereoSide: 'left' | 'right' | 'center' = 'center'
    if (baseDir.x < -0.3) stereoSide = 'left'
    else if (baseDir.x > 0.3) stereoSide = 'right'
    
    jetParticles.push({
      jetIndex, baseDirection: baseDir.clone(), velocity: new THREE.Vector3(),
      age: 999, maxAge: 0.8 + Math.random() * 1.2, spawnRadius: Math.random() * 2,
      active: false, stereoSide
    })
  }
}

function initShockwaves() {
  shockwaves.length = 0
  for (let i = 0; i < MAX_SHOCKWAVES; i++) {
    shockwaves.push({
      radius: 0, maxRadius: 35 + Math.random() * 15, age: 999,
      maxAge: SHOCKWAVE_LIFETIME, intensity: 0, hue: 0, active: false, bpmTriggered: false
    })
  }
}

function initDebrisParticles() {
  debrisParticles.length = 0
  for (let i = 0; i < DEBRIS_PARTICLES; i++) {
    const radius = 15 + Math.random() * 25
    debrisParticles.push({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2
      ),
      velocity: new THREE.Vector3(), orbitRadius: radius,
      orbitSpeed: 0.2 + Math.random() * 0.3, orbitPhase: Math.random() * Math.PI * 2,
      stereoOffset: (Math.random() - 0.5) * 2
    })
  }
}

// ============================================================================
// BURST FUNCTIONS
// ============================================================================

function getStereoMatch(side: 'left' | 'right' | 'center', balance: number): number {
  if (side === 'center') return 0.7
  if (side === 'left' && balance < 0) return 1 - balance * -0.5
  if (side === 'right' && balance > 0) return 1 + balance * 0.5
  return 0.4
}

function triggerJetBurst(intensity: number, stereoBalance: number = 0) {
  let particlesActivated = 0
  const particlesToActivate = Math.floor(JET_PARTICLES * 0.35 * intensity)
  
  const sortedIndices = jetParticles
    .map((p, i) => ({ particle: p, index: i }))
    .sort((a, b) => getStereoMatch(b.particle.stereoSide, stereoBalance) - 
                    getStereoMatch(a.particle.stereoSide, stereoBalance))
    .map(item => item.index)
  
  for (const idx of sortedIndices) {
    const particle = jetParticles[idx]
    if (!particle.active && particlesActivated < particlesToActivate) {
      particle.active = true
      particle.age = 0
      particle.maxAge = 0.6 + Math.random() * 1.0 * intensity
      particle.spawnRadius = Math.random() * 3
      
      const stereoInfluence = getStereoMatch(particle.stereoSide, stereoBalance)
      const spread = 0.25 + (1 - stereoInfluence) * 0.15
      const dir = particle.baseDirection.clone()
      dir.x += (Math.random() - 0.5) * spread + stereoBalance * 0.3 * stereoInfluence
      dir.y += (Math.random() - 0.5) * spread
      dir.z += (Math.random() - 0.5) * spread
      dir.normalize()
      
      const speed = (25 + Math.random() * 35 * intensity) * (0.8 + stereoInfluence * 0.4)
      particle.velocity.copy(dir).multiplyScalar(speed)
      particlesActivated++
    }
  }
}

function triggerShockwave(intensity: number, hue: number, bpmSync: boolean = false) {
  for (const shockwave of shockwaves) {
    if (!shockwave.active) {
      shockwave.active = true
      shockwave.radius = 3
      shockwave.maxRadius = bpmSync ? 40 + intensity * 15 : 30 + intensity * 20
      shockwave.age = 0
      shockwave.maxAge = bpmSync ? SHOCKWAVE_LIFETIME * 1.2 : SHOCKWAVE_LIFETIME
      shockwave.intensity = intensity
      shockwave.hue = hue
      shockwave.bpmTriggered = bpmSync
      break
    }
  }
}

function updateCorePeakHold(currentValue: number, deltaTime: number) {
  if (corePeakHoldTimer > 0) corePeakHoldTimer -= deltaTime * 1000
  if (currentValue >= corePeakValue) {
    corePeakValue = currentValue
    corePeakHoldTimer = CORE_PEAK_HOLD_TIME
  } else if (corePeakHoldTimer <= 0) {
    corePeakValue *= CORE_PEAK_DECAY
  }
  return Math.max(corePeakValue, currentValue)
}

function updateBPMSync(bands: AudioBands, time: number): boolean {
  if (bands.estimatedBPM <= 0) return false
  const bps = bands.estimatedBPM / 60
  const beatInterval = 1 / bps
  const timeSinceLastBeat = time - lastBPMBeatTime
  if (timeSinceLastBeat >= beatInterval * 0.95) {
    lastBPMBeatTime = time
    return true
  }
  return false
}

// ============================================================================
// VISUALIZATION
// ============================================================================

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Supernova',
  description: 'Explosive stellar death with stereo-responsive jets, peak-hold core, and BPM-synced shockwaves',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initJetDirections()
    initJetParticles()
    initShockwaves()
    initDebrisParticles()
    lastBeatTime = lastBassHitTime = lastBPMBeatTime = 0
    cumulativeExplosionForce = corePeakValue = corePeakHoldTimer = lastUpdateTime = 0

    for (let i = 0; i < count; i++) {
      if (i < CORE_PARTICLES) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = Math.pow(Math.random(), 0.5) * 5
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi)
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 0.8
      } else if (i < CORE_PARTICLES + JET_PARTICLES) {
        positions[i * 3] = 0; positions[i * 3 + 1] = -200; positions[i * 3 + 2] = 0
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.2
      } else if (i < TOTAL_MANAGED) {
        const debrisIdx = i - CORE_PARTICLES - JET_PARTICLES
        if (debrisIdx < debrisParticles.length) {
          const debris = debrisParticles[debrisIdx]
          positions[i * 3] = debris.position.x
          positions[i * 3 + 1] = debris.position.y
          positions[i * 3 + 2] = debris.position.z
        }
        const [r, g, b] = hslToRgb(0.05 + Math.random() * 0.1, 0.6, 0.4)
        colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b
      } else {
        positions[i * 3] = 0; positions[i * 3 + 1] = -200; positions[i * 3 + 2] = 0
      }
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    shockwaveGeometries.forEach(g => g.dispose())
    shockwaveMaterials.forEach(m => m.dispose())
    shockwaveLines.forEach(l => scene.remove(l))
    shockwaveGeometries = []; shockwaveMaterials = []; shockwaveLines = []
    
    if (coreGlowMesh) { scene.remove(coreGlowMesh); coreGlowMesh.geometry.dispose() }
    if (coreGlowMaterial) coreGlowMaterial.dispose()

    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array((SHOCKWAVE_SEGMENTS + 1) * 3)
      for (let j = 0; j <= SHOCKWAVE_SEGMENTS; j++) {
        const angle = (j / SHOCKWAVE_SEGMENTS) * Math.PI * 2
        positions[j * 3] = Math.cos(angle)
        positions[j * 3 + 1] = Math.sin(angle)
        positions[j * 3 + 2] = 0
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, linewidth: 2
      })
      const line = new THREE.LineLoop(geometry, material)
      line.rotation.x = Math.PI / 2
      scene.add(line)
      shockwaveGeometries.push(geometry)
      shockwaveMaterials.push(material)
      shockwaveLines.push(line)
    }

    const coreGeometry = new THREE.SphereGeometry(4, 32, 32)
    coreGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffee, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending
    })
    coreGlowMesh = new THREE.Mesh(coreGeometry, coreGlowMaterial)
    scene.add(coreGlowMesh)

    return {
      objects: [...shockwaveLines, coreGlowMesh],
      update: (bands: AudioBands, time: number) => {
        const dt = time - lastUpdateTime
        lastUpdateTime = time
        const cycleHue = getCyclingHue(time)

        if (coreGlowMesh && coreGlowMaterial) {
          const currentCoreEnergy = bands.bassSmooth * 0.6 + bands.subBassSmooth * 0.3 + bands.beatIntensity * 0.4
          const peakEnergy = updateCorePeakHold(currentCoreEnergy, dt)
          const coreScale = 3 + peakEnergy * 6 + bands.bassPeak * 2
          coreGlowMesh.scale.setScalar(coreScale)
          const coreTemp = 0.5 + peakEnergy * 0.5
          const [cr, cg, cb] = sampleGradient(currentGradient, 1 - coreTemp)
          const whiteMix = peakEnergy * 0.5
          coreGlowMaterial.color.setRGB(cr * (1-whiteMix) + whiteMix, cg * (1-whiteMix) + whiteMix * 0.95, cb * (1-whiteMix) + whiteMix * 0.8)
          coreGlowMaterial.opacity = 0.4 + peakEnergy * 0.4 + bands.bassPeak * 0.2
        }

        const bpmBeatOccurred = updateBPMSync(bands, time)
        if (bpmBeatOccurred && bands.bassSmooth > 0.3) {
          triggerShockwave(0.6 + bands.bassSmooth * 0.4, cycleHue + 0.1, true)
        }
        if (bands.bass > 0.55 && time - lastBassHitTime > 0.35) {
          lastBassHitTime = time
          triggerShockwave(bands.bass, cycleHue, false)
        }

        for (let i = 0; i < MAX_SHOCKWAVES; i++) {
          const sw = shockwaves[i]
          const material = shockwaveMaterials[i]
          const line = shockwaveLines[i]
          if (sw.active) {
            sw.age += dt
            if (sw.age >= sw.maxAge) { sw.active = false; material.opacity = 0; continue }
            const progress = sw.age / sw.maxAge
            sw.radius = 3 + (sw.maxRadius - 3) * (1 - Math.pow(1 - progress, 3))
            line.scale.setScalar(sw.radius)
            const fadeStart = sw.bpmTriggered ? 0.4 : 0.3
            material.opacity = Math.max(0, progress < fadeStart ? sw.intensity * 0.9 : sw.intensity * 0.9 * (1 - (progress - fadeStart) / (1 - fadeStart)))
            if (sw.bpmTriggered) {
              const [r, g, b] = sampleGradient(currentGradient, progress * 0.7)
              material.color.setRGB(r, g, b)
            } else {
              const [r, g, b] = hslToRgb(sw.hue + progress * 0.15, 0.8 - progress * 0.3, 0.6)
              material.color.setRGB(r, g, b)
            }
            const posAttr = shockwaveGeometries[i].getAttribute('position') as THREE.BufferAttribute
            const positions = posAttr.array as Float32Array
            const waveFreq = sw.bpmTriggered ? 6 : 8
            for (let j = 0; j <= SHOCKWAVE_SEGMENTS; j++) {
              const angle = (j / SHOCKWAVE_SEGMENTS) * Math.PI * 2
              const waveAmt = 0.12 * sw.intensity * (1 - progress)
              const wave = 1 + Math.sin(angle * waveFreq + time * 5) * waveAmt
              positions[j * 3] = Math.cos(angle) * wave
              positions[j * 3 + 1] = Math.sin(angle) * wave
              positions[j * 3 + 2] = Math.sin(angle * 4 + time * 3) * waveAmt * 0.5
            }
            posAttr.needsUpdate = true
          }
        }
      },
      dispose: () => {
        shockwaveGeometries.forEach(g => g.dispose())
        shockwaveMaterials.forEach(m => m.dispose())
        shockwaveLines.forEach(l => scene.remove(l))
        shockwaveGeometries = []; shockwaveMaterials = []; shockwaveLines = []
        if (coreGlowMesh) { scene.remove(coreGlowMesh); coreGlowMesh.geometry.dispose(); coreGlowMesh = null }
        if (coreGlowMaterial) { coreGlowMaterial.dispose(); coreGlowMaterial = null }
      }
    }
  },

  animate(positions: Float32Array, originalPositions: Float32Array, sizes: Float32Array, colors: Float32Array, count: number, bands: AudioBands, time: number) {
    const dt = 0.016
    const cycleHue = getCyclingHue(time)
    cumulativeExplosionForce = cumulativeExplosionForce * 0.95 + bands.beatIntensity * 0.5

    if (bands.isBeat && time - lastBeatTime > 0.15) {
      lastBeatTime = time
      triggerJetBurst(0.5 + bands.beatIntensity, bands.stereoBalance)
    }

    // Core particles
    for (let i = 0; i < Math.min(count, CORE_PARTICLES); i++) {
      const ox = originalPositions[i * 3], oy = originalPositions[i * 3 + 1], oz = originalPositions[i * 3 + 2]
      const baseRadius = 5 + bands.subBassSmooth * 4 + bands.bassSmooth * 6 + bands.beatIntensity * 5
      const breathe = Math.sin(time * 2 + i * 0.01) * 1.5
      const turbulence = Math.sin(time * 4 + i * 0.1) * bands.highSmooth * 2
      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const normalizedDist = dist / 5
      const pulseRadius = (baseRadius + breathe + turbulence) * normalizedDist
      const swirlSpeed = 0.5 + bands.lowMidSmooth * 1.5 + bands.midSmooth
      const swirlAngle = time * swirlSpeed + normalizedDist * 2
      const cosSwirl = Math.cos(swirlAngle * 0.3), sinSwirl = Math.sin(swirlAngle * 0.3)
      const nx = ox / (dist || 1), ny = oy / (dist || 1), nz = oz / (dist || 1)
      positions[i * 3] = (nx * cosSwirl - nz * sinSwirl) * pulseRadius
      positions[i * 3 + 1] = ny * pulseRadius
      positions[i * 3 + 2] = (nx * sinSwirl + nz * cosSwirl) * pulseRadius
      const coreIntensity = Math.max(0, 1 - normalizedDist * 0.8)
      const [r, g, b] = sampleGradient(currentGradient, (1 - coreIntensity) * 0.5 + cycleHue * 0.2)
      const whiteMix = coreIntensity * 0.6 + bands.beatIntensity * 0.2
      colors[i * 3] = r * (1-whiteMix) + whiteMix
      colors[i * 3 + 1] = g * (1-whiteMix) + whiteMix * 0.95
      colors[i * 3 + 2] = b * (1-whiteMix) + whiteMix * 0.7
      sizes[i] = (2 + coreIntensity * 3 + bands.beatIntensity * 4 + bands.bassPeak * 2) * (1 + bands.subBassSmooth * 0.5)
    }

    // Jet particles
    for (let i = 0; i < JET_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      if (particleIndex >= count) break
      const particle = jetParticles[i]
      if (particle.active) {
        particle.age += dt
        if (particle.age >= particle.maxAge) { particle.active = false; positions[particleIndex * 3 + 1] = -200; sizes[particleIndex] = 0; continue }
        particle.velocity.multiplyScalar(0.98)
        particle.velocity.y -= 2 * dt
        const stereoForce = bands.stereoBalance * 0.5
        if (particle.stereoSide === 'left') particle.velocity.x -= stereoForce * dt * 30
        else if (particle.stereoSide === 'right') particle.velocity.x += stereoForce * dt * 30
        const px = positions[particleIndex * 3] + particle.velocity.x * dt
        const py = positions[particleIndex * 3 + 1] + particle.velocity.y * dt
        const pz = positions[particleIndex * 3 + 2] + particle.velocity.z * dt
        positions[particleIndex * 3] = px; positions[particleIndex * 3 + 1] = py; positions[particleIndex * 3 + 2] = pz
        const life = 1 - particle.age / particle.maxAge
        const lifeFade = Math.pow(life, 0.5)
        const distFromCenter = Math.sqrt(px * px + py * py + pz * pz)
        const gradientOffset = particle.stereoSide === 'left' ? -0.1 : particle.stereoSide === 'right' ? 0.1 : 0
        const [r, g, b] = sampleGradient(currentGradient, Math.min(1, distFromCenter / 30) * 0.6 + cycleHue * 0.2 + gradientOffset)
        colors[particleIndex * 3] = r * lifeFade; colors[particleIndex * 3 + 1] = g * lifeFade; colors[particleIndex * 3 + 2] = b * lifeFade
        sizes[particleIndex] = (1.5 + bands.beatIntensity * 3) * lifeFade
      } else {
        const angle = (i / JET_PARTICLES) * Math.PI * 2
        positions[particleIndex * 3] = Math.cos(angle) * particle.spawnRadius
        positions[particleIndex * 3 + 1] = Math.sin(angle) * particle.spawnRadius
        positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * particle.spawnRadius
        sizes[particleIndex] = 0.5
      }
    }

    // Debris particles
    for (let i = 0; i < DEBRIS_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + JET_PARTICLES + i
      if (particleIndex >= count) break
      const debris = debrisParticles[i]
      debris.orbitPhase += debris.orbitSpeed * dt * (1 + bands.midSmooth * 0.5)
      const explosionPush = cumulativeExplosionForce * 0.5
      const targetRadius = debris.orbitRadius + explosionPush * 10
      const stereoInfluence = debris.stereoOffset * bands.stereoBalance * 8
      const angle = debris.orbitPhase
      const verticalWobble = Math.sin(time * 0.8 + i * 0.5) * 5
      const x = Math.cos(angle) * targetRadius + Math.sin(time + i) * 3 + stereoInfluence
      const y = verticalWobble + Math.sin(angle * 2) * (targetRadius * 0.3)
      const z = Math.sin(angle) * targetRadius + Math.cos(time * 0.7 + i) * 3
      positions[particleIndex * 3] = x; positions[particleIndex * 3 + 1] = y; positions[particleIndex * 3 + 2] = z
      const [r, g, b] = sampleGradient(currentGradient, 0.7 + Math.min(1, Math.sqrt(x*x+y*y+z*z) / 40) * 0.3)
      const brightness = 0.5 + bands.overallSmooth * 0.3
      colors[particleIndex * 3] = r * brightness; colors[particleIndex * 3 + 1] = g * brightness; colors[particleIndex * 3 + 2] = b * brightness
      const twinkle = 0.5 + Math.sin(time * 3 + i * 2) * 0.3
      sizes[particleIndex] = (0.8 + bands.highSmooth * 1.5 + bands.brillianceSmooth) * twinkle
    }

    for (let i = TOTAL_MANAGED; i < count; i++) { positions[i * 3 + 1] = -200; sizes[i] = 0 }
  }
}

/** Set gradient for supernova coloring */
export function setSupernovaGradient(gradient: typeof currentGradient) {
  currentGradient = gradient
}
