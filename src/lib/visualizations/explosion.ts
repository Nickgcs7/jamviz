import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import * as THREE from 'three'

// ============================================================================
// SUPERNOVA CONFIGURATION
// ============================================================================

// Particle distribution
const CORE_PARTICLES = 800      // Dense glowing core
const JET_PARTICLES = 1200      // Particles for burst jets
const DEBRIS_PARTICLES = 500    // Ambient debris field
const TOTAL_MANAGED = CORE_PARTICLES + JET_PARTICLES + DEBRIS_PARTICLES

// Shockwave ring configuration
const MAX_SHOCKWAVES = 6
const SHOCKWAVE_SEGMENTS = 64
const SHOCKWAVE_LIFETIME = 2.5  // seconds

// Jet burst configuration
const JET_COUNT = 12            // Number of radial jets
const PARTICLES_PER_JET = Math.floor(JET_PARTICLES / JET_COUNT)

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface JetParticle {
  jetIndex: number          // Which jet this belongs to
  baseDirection: THREE.Vector3
  velocity: THREE.Vector3
  age: number
  maxAge: number
  spawnRadius: number
  active: boolean
}

interface Shockwave {
  radius: number
  maxRadius: number
  age: number
  maxAge: number
  intensity: number
  hue: number
  active: boolean
}

interface DebrisParticle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  orbitRadius: number
  orbitSpeed: number
  orbitPhase: number
}

// Jet directions (evenly distributed radially)
const jetDirections: THREE.Vector3[] = []
const jetParticles: JetParticle[] = []
const shockwaves: Shockwave[] = []
const debrisParticles: DebrisParticle[] = []

// Scene object references
let shockwaveGeometries: THREE.BufferGeometry[] = []
let shockwaveMaterials: THREE.LineBasicMaterial[] = []
let shockwaveLines: THREE.LineLoop[] = []
let coreGlowMesh: THREE.Mesh | null = null
let coreGlowMaterial: THREE.MeshBasicMaterial | null = null

// State tracking
let lastBeatTime = 0
let lastBassHitTime = 0
let cumulativeExplosionForce = 0
let currentCoreHue = 0

// ============================================================================
// INITIALIZATION
// ============================================================================

function initJetDirections() {
  jetDirections.length = 0
  
  // Create evenly distributed jet directions using golden angle spiral
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
    
    jetParticles.push({
      jetIndex,
      baseDirection: baseDir.clone(),
      velocity: new THREE.Vector3(),
      age: 999,  // Start expired
      maxAge: 0.8 + Math.random() * 1.2,
      spawnRadius: Math.random() * 2,
      active: false
    })
  }
}

function initShockwaves() {
  shockwaves.length = 0
  
  for (let i = 0; i < MAX_SHOCKWAVES; i++) {
    shockwaves.push({
      radius: 0,
      maxRadius: 35 + Math.random() * 15,
      age: 999,
      maxAge: SHOCKWAVE_LIFETIME,
      intensity: 0,
      hue: 0,
      active: false
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
      velocity: new THREE.Vector3(),
      orbitRadius: radius,
      orbitSpeed: 0.2 + Math.random() * 0.3,
      orbitPhase: Math.random() * Math.PI * 2
    })
  }
}

// ============================================================================
// BURST TRIGGER FUNCTIONS
// ============================================================================

function triggerJetBurst(time: number, intensity: number) {
  let particlesActivated = 0
  const particlesToActivate = Math.floor(JET_PARTICLES * 0.3 * intensity)
  
  for (const particle of jetParticles) {
    if (!particle.active && particlesActivated < particlesToActivate) {
      particle.active = true
      particle.age = 0
      particle.maxAge = 0.6 + Math.random() * 1.0 * intensity
      particle.spawnRadius = Math.random() * 3
      
      // Add spread to the jet direction
      const spread = 0.3
      const dir = particle.baseDirection.clone()
      dir.x += (Math.random() - 0.5) * spread
      dir.y += (Math.random() - 0.5) * spread
      dir.z += (Math.random() - 0.5) * spread
      dir.normalize()
      
      // Initial velocity burst
      const speed = 25 + Math.random() * 35 * intensity
      particle.velocity.copy(dir).multiplyScalar(speed)
      
      particlesActivated++
    }
  }
}

function triggerShockwave(intensity: number, hue: number) {
  for (const shockwave of shockwaves) {
    if (!shockwave.active) {
      shockwave.active = true
      shockwave.radius = 3
      shockwave.maxRadius = 30 + intensity * 20
      shockwave.age = 0
      shockwave.maxAge = SHOCKWAVE_LIFETIME
      shockwave.intensity = intensity
      shockwave.hue = hue
      break
    }
  }
}

// ============================================================================
// VISUALIZATION MODE EXPORT
// ============================================================================

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Supernova',
  description: 'Explosive stellar death with particle jets, shockwave rings, and color-cycling core',

  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initJetDirections()
    initJetParticles()
    initShockwaves()
    initDebrisParticles()
    lastBeatTime = 0
    lastBassHitTime = 0
    cumulativeExplosionForce = 0

    for (let i = 0; i < count; i++) {
      if (i < CORE_PARTICLES) {
        // Core particles - dense sphere
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = Math.pow(Math.random(), 0.5) * 5  // Concentrated at center
        
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi)
        
        // Hot white/yellow core color
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.95
        colors[i * 3 + 2] = 0.8
        
      } else if (i < CORE_PARTICLES + JET_PARTICLES) {
        // Jet particles - start hidden
        positions[i * 3] = 0
        positions[i * 3 + 1] = -200
        positions[i * 3 + 2] = 0
        
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.6
        colors[i * 3 + 2] = 0.2
        
      } else if (i < TOTAL_MANAGED) {
        // Debris particles
        const debrisIdx = i - CORE_PARTICLES - JET_PARTICLES
        if (debrisIdx < debrisParticles.length) {
          const debris = debrisParticles[debrisIdx]
          positions[i * 3] = debris.position.x
          positions[i * 3 + 1] = debris.position.y
          positions[i * 3 + 2] = debris.position.z
        }
        
        // Cooler debris colors
        const [r, g, b] = hslToRgb(0.05 + Math.random() * 0.1, 0.6, 0.4)
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
        
      } else {
        // Extra particles - hide
        positions[i * 3] = 0
        positions[i * 3 + 1] = -200
        positions[i * 3 + 2] = 0
      }
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    // Clean up any existing objects
    shockwaveGeometries.forEach(g => g.dispose())
    shockwaveMaterials.forEach(m => m.dispose())
    shockwaveLines.forEach(l => scene.remove(l))
    shockwaveGeometries = []
    shockwaveMaterials = []
    shockwaveLines = []
    
    if (coreGlowMesh) {
      scene.remove(coreGlowMesh)
      coreGlowMesh.geometry.dispose()
    }
    if (coreGlowMaterial) {
      coreGlowMaterial.dispose()
    }

    // Create shockwave ring geometries
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array((SHOCKWAVE_SEGMENTS + 1) * 3)
      
      // Initialize as circle
      for (let j = 0; j <= SHOCKWAVE_SEGMENTS; j++) {
        const angle = (j / SHOCKWAVE_SEGMENTS) * Math.PI * 2
        positions[j * 3] = Math.cos(angle)
        positions[j * 3 + 1] = Math.sin(angle)
        positions[j * 3 + 2] = 0
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        linewidth: 2
      })
      
      const line = new THREE.LineLoop(geometry, material)
      line.rotation.x = Math.PI / 2  // Lay flat horizontally
      scene.add(line)
      
      shockwaveGeometries.push(geometry)
      shockwaveMaterials.push(material)
      shockwaveLines.push(line)
    }

    // Create central core glow mesh
    const coreGeometry = new THREE.SphereGeometry(4, 32, 32)
    coreGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    })
    coreGlowMesh = new THREE.Mesh(coreGeometry, coreGlowMaterial)
    scene.add(coreGlowMesh)

    return {
      objects: [...shockwaveLines, coreGlowMesh],
      
      update: (bands: AudioBands, time: number) => {
        const dt = 0.016
        const cycleHue = getCyclingHue(time)
        currentCoreHue = cycleHue

        // Update core glow
        if (coreGlowMesh && coreGlowMaterial) {
          const coreScale = 3 + bands.bassSmooth * 4 + bands.beatIntensity * 3
          coreGlowMesh.scale.setScalar(coreScale)
          
          // Core color: white/yellow shifting through spectrum
          const coreHue = cycleHue
          const coreSat = 0.3 + bands.beatIntensity * 0.4  // More saturated on beats
          const coreLight = 0.7 + bands.beatIntensity * 0.25
          const [cr, cg, cb] = hslToRgb(coreHue, coreSat, coreLight)
          coreGlowMaterial.color.setRGB(cr, cg, cb)
          coreGlowMaterial.opacity = 0.5 + bands.bassSmooth * 0.3 + bands.beatIntensity * 0.2
        }

        // Trigger new shockwave on strong bass
        if (bands.bass > 0.5 && time - lastBassHitTime > 0.3) {
          lastBassHitTime = time
          triggerShockwave(bands.bass, cycleHue)
        }

        // Update shockwaves
        for (let i = 0; i < MAX_SHOCKWAVES; i++) {
          const sw = shockwaves[i]
          const material = shockwaveMaterials[i]
          const line = shockwaveLines[i]
          
          if (sw.active) {
            sw.age += dt
            
            if (sw.age >= sw.maxAge) {
              sw.active = false
              material.opacity = 0
              continue
            }
            
            // Expand radius with easing
            const progress = sw.age / sw.maxAge
            const easeOut = 1 - Math.pow(1 - progress, 3)
            sw.radius = 3 + (sw.maxRadius - 3) * easeOut
            
            // Update scale
            line.scale.setScalar(sw.radius)
            
            // Fade out opacity
            const fadeStart = 0.3
            const opacity = progress < fadeStart 
              ? sw.intensity * 0.9 
              : sw.intensity * 0.9 * (1 - (progress - fadeStart) / (1 - fadeStart))
            material.opacity = Math.max(0, opacity)
            
            // Color shifts outward from hot to cool
            const ringHue = sw.hue + progress * 0.15
            const [r, g, b] = hslToRgb(ringHue, 0.8 - progress * 0.3, 0.6)
            material.color.setRGB(r, g, b)
            
            // Add wave distortion to the ring
            const posAttr = shockwaveGeometries[i].getAttribute('position') as THREE.BufferAttribute
            const positions = posAttr.array as Float32Array
            
            for (let j = 0; j <= SHOCKWAVE_SEGMENTS; j++) {
              const angle = (j / SHOCKWAVE_SEGMENTS) * Math.PI * 2
              const waveAmt = 0.1 * sw.intensity * (1 - progress)
              const wave = 1 + Math.sin(angle * 8 + time * 5) * waveAmt
              
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
        shockwaveGeometries = []
        shockwaveMaterials = []
        shockwaveLines = []
        
        if (coreGlowMesh) {
          scene.remove(coreGlowMesh)
          coreGlowMesh.geometry.dispose()
          coreGlowMesh = null
        }
        if (coreGlowMaterial) {
          coreGlowMaterial.dispose()
          coreGlowMaterial = null
        }
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
    time: number
  ) {
    const dt = 0.016
    const cycleHue = getCyclingHue(time)
    
    // Update cumulative explosion force
    cumulativeExplosionForce = cumulativeExplosionForce * 0.95 + bands.beatIntensity * 0.5
    
    // Trigger jet burst on beat
    if (bands.isBeat && time - lastBeatTime > 0.15) {
      lastBeatTime = time
      triggerJetBurst(time, 0.5 + bands.beatIntensity)
    }

    // ========================================================================
    // CORE PARTICLES
    // ========================================================================
    for (let i = 0; i < Math.min(count, CORE_PARTICLES); i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]
      
      // Pulsing core with breathing
      const baseRadius = 5 + bands.bassSmooth * 8 + bands.beatIntensity * 6
      const breathe = Math.sin(time * 2 + i * 0.01) * 1.5
      const turbulence = Math.sin(time * 4 + i * 0.1) * bands.highSmooth * 2
      
      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const normalizedDist = dist / 5  // Original max radius
      const pulseRadius = (baseRadius + breathe + turbulence) * normalizedDist
      
      // Swirl effect
      const swirlSpeed = 0.5 + bands.midSmooth * 1.5
      const swirlAngle = time * swirlSpeed + normalizedDist * 2
      const cosSwirl = Math.cos(swirlAngle * 0.3)
      const sinSwirl = Math.sin(swirlAngle * 0.3)
      
      const nx = ox / (dist || 1)
      const ny = oy / (dist || 1)
      const nz = oz / (dist || 1)
      
      // Apply swirl rotation around Y axis
      const swirlX = nx * cosSwirl - nz * sinSwirl
      const swirlZ = nx * sinSwirl + nz * cosSwirl
      
      positions[i * 3] = swirlX * pulseRadius
      positions[i * 3 + 1] = ny * pulseRadius
      positions[i * 3 + 2] = swirlZ * pulseRadius
      
      // Core colors: hot white/yellow center, shifting to spectrum at edges
      const coreIntensity = Math.max(0, 1 - normalizedDist * 0.8)
      const hue = cycleHue + normalizedDist * 0.2
      const saturation = 0.2 + (1 - coreIntensity) * 0.6 + bands.beatIntensity * 0.2
      const lightness = 0.6 + coreIntensity * 0.35 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
      
      // Size: larger in center, pulse with beat
      sizes[i] = (2 + coreIntensity * 3 + bands.beatIntensity * 4) * (1 + bands.bassSmooth * 0.5)
    }

    // ========================================================================
    // JET PARTICLES
    // ========================================================================
    for (let i = 0; i < JET_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      if (particleIndex >= count) break
      
      const particle = jetParticles[i]
      
      if (particle.active) {
        particle.age += dt
        
        if (particle.age >= particle.maxAge) {
          particle.active = false
          positions[particleIndex * 3 + 1] = -200  // Hide
          sizes[particleIndex] = 0
          continue
        }
        
        // Apply drag and gravity-like pull back to center
        particle.velocity.multiplyScalar(0.98)
        particle.velocity.y -= 2 * dt  // Slight downward pull
        
        // Update position
        const px = positions[particleIndex * 3] + particle.velocity.x * dt
        const py = positions[particleIndex * 3 + 1] + particle.velocity.y * dt
        const pz = positions[particleIndex * 3 + 2] + particle.velocity.z * dt
        
        positions[particleIndex * 3] = px
        positions[particleIndex * 3 + 1] = py
        positions[particleIndex * 3 + 2] = pz
        
        // Life progress
        const life = 1 - particle.age / particle.maxAge
        const lifeFade = Math.pow(life, 0.5)
        
        // Color: starts hot, cools as it travels
        const distFromCenter = Math.sqrt(px * px + py * py + pz * pz)
        const tempProgress = Math.min(1, distFromCenter / 30)
        const jetHue = cycleHue + tempProgress * 0.15
        const jetSat = 0.7 + life * 0.25
        const jetLight = 0.4 + life * 0.35
        
        const [r, g, b] = hslToRgb(jetHue, jetSat, jetLight)
        colors[particleIndex * 3] = r * lifeFade
        colors[particleIndex * 3 + 1] = g * lifeFade
        colors[particleIndex * 3 + 2] = b * lifeFade
        
        // Size fades with life
        sizes[particleIndex] = (1.5 + bands.beatIntensity * 3) * lifeFade
        
      } else {
        // Inactive - position at core ready to burst
        const angle = (i / JET_PARTICLES) * Math.PI * 2
        positions[particleIndex * 3] = Math.cos(angle) * particle.spawnRadius
        positions[particleIndex * 3 + 1] = Math.sin(angle) * particle.spawnRadius
        positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * particle.spawnRadius
        sizes[particleIndex] = 0.5
      }
    }

    // ========================================================================
    // DEBRIS PARTICLES
    // ========================================================================
    for (let i = 0; i < DEBRIS_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + JET_PARTICLES + i
      if (particleIndex >= count) break
      
      const debris = debrisParticles[i]
      
      // Orbital motion with explosion influence
      debris.orbitPhase += debris.orbitSpeed * dt * (1 + bands.midSmooth * 0.5)
      
      // Add explosion force pushing outward
      const explosionPush = cumulativeExplosionForce * 0.5
      const targetRadius = debris.orbitRadius + explosionPush * 10
      
      const angle = debris.orbitPhase
      const verticalWobble = Math.sin(time * 0.8 + i * 0.5) * 5
      
      const x = Math.cos(angle) * targetRadius + Math.sin(time + i) * 3
      const y = verticalWobble + Math.sin(angle * 2) * (targetRadius * 0.3)
      const z = Math.sin(angle) * targetRadius + Math.cos(time * 0.7 + i) * 3
      
      positions[particleIndex * 3] = x
      positions[particleIndex * 3 + 1] = y
      positions[particleIndex * 3 + 2] = z
      
      // Debris colors: cooler, ember-like
      const distFromCenter = Math.sqrt(x * x + y * y + z * z)
      const coolness = Math.min(1, distFromCenter / 40)
      const debrisHue = cycleHue + 0.05 + coolness * 0.1
      const debrisSat = 0.6 - coolness * 0.2
      const debrisLight = 0.35 + bands.overallSmooth * 0.15
      
      const [r, g, b] = hslToRgb(debrisHue, debrisSat, debrisLight)
      colors[particleIndex * 3] = r
      colors[particleIndex * 3 + 1] = g
      colors[particleIndex * 3 + 2] = b
      
      // Small, twinkling sizes
      const twinkle = 0.5 + Math.sin(time * 3 + i * 2) * 0.3
      sizes[particleIndex] = (0.8 + bands.highSmooth * 1.5) * twinkle
    }

    // Hide any extra particles
    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}
