import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { builtInGradients, sampleGradient, type GradientPreset } from '../gradients'
import * as THREE from 'three'
import { metaballVertexShader, lavaLampFragmentShader, createFullscreenQuad, type MetaBlob } from './metaballUtils'

export interface LavaLampConfig {
  blobCount: number; minSize: number; maxSize: number; mergeThreshold: number
  riseSpeed: number; sinkSpeed: number; wanderStrength: number; wanderSpeed: number; turbulence: number
  gravity: number; buoyancy: number; viscosity: number; bounceEdges: boolean; wrapEdges: boolean
  colorMode: 'gradient' | 'temperature' | 'audio' | 'cycling'
  gradient: GradientPreset; glowIntensity: number; transparency: number
  bassInfluence: number; midInfluence: number; highInfluence: number; beatReactivity: number
  colorCycleSpeed: number; smoothingFactor: number
}

// Fallback gradient in case builtInGradients isn't ready
const FALLBACK_GRADIENT: GradientPreset = {
  name: 'lavaLamp',
  bgColor: '#1a0500',
  colorStops: [
    { color: '#ff3300', pos: 0 },
    { color: '#ff8000', pos: 0.25 },
    { color: '#ffcc33', pos: 0.5 },
    { color: '#ff6600', pos: 0.75 },
    { color: '#cc1933', pos: 1 }
  ]
}

function getDefaultGradient(): GradientPreset {
  if (builtInGradients && builtInGradients.lavaLamp && builtInGradients.lavaLamp.colorStops) {
    return builtInGradients.lavaLamp
  }
  if (builtInGradients && builtInGradients.fire && builtInGradients.fire.colorStops) {
    return builtInGradients.fire
  }
  return FALLBACK_GRADIENT
}

// Calm physics for smooth lava lamp movement - blobs stay more separate
function createDefaultConfig(): LavaLampConfig {
  return {
    blobCount: 6, minSize: 4, maxSize: 8, mergeThreshold: 3.0,  // Smaller blobs, higher merge threshold
    riseSpeed: 0.3, sinkSpeed: 0.2, wanderStrength: 0.2, wanderSpeed: 0.06, turbulence: 0.01,
    gravity: 0.006, buoyancy: 0.010, viscosity: 0.99, bounceEdges: true, wrapEdges: false,
    colorMode: 'gradient', gradient: getDefaultGradient(), glowIntensity: 1.0, transparency: 0.85,
    bassInfluence: 0.15, midInfluence: 0.1, highInfluence: 0.05, beatReactivity: 0.08,  // Much lower audio response
    colorCycleSpeed: 0.03, smoothingFactor: 0.02
  }
}

let config: LavaLampConfig = createDefaultConfig()
const MIN_BLOBS = 2, MAX_BLOBS = 12

interface EnhancedBlob extends MetaBlob {
  vx: number; vy: number; temperature: number; wanderPhase: number; targetX: number; targetY: number
  smoothX: number; smoothY: number; smoothSize: number
}

let blobs: EnhancedBlob[] = []
let currentBlobCount = 6, lastSpawnTime = 0, lastDespawnTime = 0, gravityDirection = 1
let quadMesh: THREE.Mesh | null = null, shaderMaterial: THREE.ShaderMaterial | null = null
let smoothedGravityDirection = 1

function ensureValidGradient(): GradientPreset {
  if (config.gradient && config.gradient.colorStops && Array.isArray(config.gradient.colorStops) && config.gradient.colorStops.length > 0) {
    return config.gradient
  }
  if (builtInGradients && builtInGradients.fire && builtInGradients.fire.colorStops) {
    config.gradient = builtInGradients.fire
    return config.gradient
  }
  config.gradient = FALLBACK_GRADIENT
  return FALLBACK_GRADIENT
}

// Initialize blobs with better spread across the screen
function initBlobs(count: number): EnhancedBlob[] {
  const newBlobs: EnhancedBlob[] = []
  
  // Distribute blobs more evenly across vertical space
  for (let i = 0; i < count; i++) {
    // Spread blobs vertically
    const verticalSection = (i / count) * 50 - 25  // -25 to +25
    const x = (Math.random() - 0.5) * 28  // Wider horizontal spread
    const y = verticalSection + (Math.random() - 0.5) * 10  // Some randomness within section
    const size = config.minSize + Math.random() * (config.maxSize - config.minSize)
    
    newBlobs.push({
      x, y,
      vx: 0, vy: (Math.random() - 0.5) * 0.05,  // Small initial velocity
      velocity: 0,
      phase: Math.random() * Math.PI * 2,
      baseSize: size,
      colorIndex: i % 8, 
      colorPhase: i * 0.9 + Math.random() * 0.3,  // Different colors per blob
      temperature: 0.3 + (i / count) * 0.4 + Math.random() * 0.1,  // Temperature varies by position
      wanderPhase: i * 1.2 + Math.random() * Math.PI,  // Offset wander phase
      targetX: (Math.random() - 0.5) * 20, 
      targetY: (Math.random() - 0.5) * 35,
      smoothX: x, smoothY: y, smoothSize: size
    })
  }
  return newBlobs
}

function spawnBlob(): void {
  if (blobs.length >= MAX_BLOBS) return
  const x = (Math.random() - 0.5) * 20
  const y = gravityDirection > 0 ? -28 : 28
  const size = config.minSize + Math.random() * (config.maxSize - config.minSize)
  blobs.push({
    x, y,
    vx: 0, vy: 0, velocity: 0,
    phase: Math.random() * Math.PI * 2, 
    baseSize: size,
    colorIndex: blobs.length % 8, colorPhase: Math.random() * Math.PI * 2,
    temperature: gravityDirection > 0 ? 0.85 : 0.15, 
    wanderPhase: Math.random() * Math.PI * 2,
    targetX: (Math.random() - 0.5) * 20, 
    targetY: (Math.random() - 0.5) * 35,
    smoothX: x, smoothY: y, smoothSize: size
  })
  currentBlobCount = blobs.length
}

function despawnBlob(): void {
  if (blobs.length <= MIN_BLOBS) return
  let idx = 0
  for (let i = 1; i < blobs.length; i++) if (blobs[i].baseSize < blobs[idx].baseSize) idx = i
  blobs[idx].baseSize *= 0.9
  if (blobs[idx].baseSize < config.minSize * 0.5) { blobs.splice(idx, 1); currentBlobCount = blobs.length }
}

function getBlobColor(blob: EnhancedBlob, time: number, bands: AudioBands): THREE.Color {
  const color = new THREE.Color()
  switch (config.colorMode) {
    case 'temperature': 
      color.setHSL(0.7 - blob.temperature * 0.5, 0.8 + blob.temperature * 0.15, 0.4 + blob.temperature * 0.2)
      break
    case 'audio': 
      color.setHSL((bands.bassSmooth * 0.3 + bands.midSmooth * 0.2 + blob.colorPhase * 0.1) % 1, 0.7 + bands.overallSmooth * 0.25, 0.4 + bands.beatIntensity * 0.3)
      break
    case 'cycling': 
      color.setHSL((time * config.colorCycleSpeed + blob.colorPhase) % 1, 0.85, 0.5)
      break
    default: {
      const gradient = ensureValidGradient()
      const t = (blob.smoothY + 30) / 60 + time * config.colorCycleSpeed * 0.1 + blob.colorPhase * 0.15
      const [r, g, b] = sampleGradient(gradient, t)
      color.setRGB(r, g, b)
    }
  }
  return color.multiplyScalar(config.glowIntensity)
}

export const lavaLamp: VisualizationMode = {
  id: 'lava_lamp', name: 'Lava Lamp', description: 'Audio-reactive lava lamp with physics-based blob movement',
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    ensureValidGradient()
    blobs = initBlobs(config.blobCount)
    currentBlobCount = config.blobCount
    gravityDirection = 1
    smoothedGravityDirection = 1
    lastSpawnTime = lastDespawnTime = 0
    for (let i = 0; i < count; i++) { 
      positions[i * 3] = 0; positions[i * 3 + 1] = -1000; positions[i * 3 + 2] = 0
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0 
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    ensureValidGradient()
    
    const geometry = createFullscreenQuad()
    const blobPositions = [], blobSizes = [], blobColors = []
    for (let i = 0; i < MAX_BLOBS; i++) { 
      blobPositions.push(new THREE.Vector3())
      blobSizes.push(6)
      blobColors.push(new THREE.Vector3(0.5, 0.5, 0.5)) 
    }
    
    shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: metaballVertexShader, 
      fragmentShader: lavaLampFragmentShader,
      uniforms: {
        uTime: { value: 0 }, 
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uBlobPositions: { value: blobPositions }, 
        uBlobSizes: { value: blobSizes }, 
        uBlobColors: { value: blobColors },
        uBlobCount: { value: currentBlobCount }, 
        uBassSmooth: { value: 0 }, 
        uBeatIntensity: { value: 0 }, 
        uGravityDirection: { value: gravityDirection }
      },
      depthTest: false, depthWrite: false
    })
    quadMesh = new THREE.Mesh(geometry, shaderMaterial)
    quadMesh.frustumCulled = false
    quadMesh.renderOrder = -1000
    scene.add(quadMesh)
    
    const handleResize = () => { 
      if (shaderMaterial) shaderMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight) 
    }
    window.addEventListener('resize', handleResize)

    return {
      objects: [quadMesh],
      update: (bands: AudioBands, time: number) => {
        if (!shaderMaterial) return
        
        ensureValidGradient()

        // Spawn/despawn with longer cooldowns - mostly static count
        if (bands.overallSmooth > 0.8 && time - lastSpawnTime > 6) { 
          spawnBlob()
          lastSpawnTime = time 
        } else if (bands.overallSmooth < 0.08 && time - lastDespawnTime > 8) { 
          despawnBlob()
          lastDespawnTime = time 
        }

        // Very gentle gravity - almost constant
        const bassLevel = bands.bassSmooth * 0.5
        const targetGravity = 1.0 + (bassLevel - 0.25) * 0.2  // Only ±10% variation
        smoothedGravityDirection += (targetGravity - smoothedGravityDirection) * 0.002

        for (let i = 0; i < blobs.length; i++) {
          const blob = blobs[i]
          
          // Temperature affects buoyancy - hot blobs rise, cold sink
          const heatBuoyancy = (blob.temperature - 0.5) * config.buoyancy * 1.5
          
          // Gentle forces - mostly buoyancy driven
          const gravityForce = config.gravity * smoothedGravityDirection
          const buoyancyForce = heatBuoyancy + config.buoyancy * 0.4
          
          // Very subtle audio influence
          const audioLift = bands.bassSmooth * config.bassInfluence * 0.008
          
          // Apply vertical forces - small increments
          blob.vy += (buoyancyForce - gravityForce + audioLift) * 0.05
          
          // Slow wandering motion - each blob has different phase
          const wanderX = Math.sin(time * config.wanderSpeed + blob.wanderPhase) * config.wanderStrength
          const wanderY = Math.cos(time * config.wanderSpeed * 0.5 + blob.wanderPhase * 1.4) * config.wanderStrength * 0.2
          
          // Drift toward target area
          const toTargetX = (blob.targetX - blob.x) * 0.0008
          const toTargetY = (blob.targetY - blob.y) * 0.0003
          
          blob.vx += (wanderX * 0.008 + toTargetX)
          blob.vy += (wanderY * 0.003 + toTargetY)
          
          // Very subtle beat reaction
          if (bands.isBeat && bands.beatIntensity > 0.7) {
            blob.vx += (Math.random() - 0.5) * config.beatReactivity * 0.04
            blob.vy += (Math.random() - 0.5) * config.beatReactivity * 0.02
            // Rarely pick new target
            if (Math.random() < 0.05) { 
              blob.targetX = (Math.random() - 0.5) * 20
              blob.targetY = (Math.random() - 0.5) * 35 
            }
          }
          
          // Minimal turbulence
          if (config.turbulence > 0) {
            blob.vx += (Math.random() - 0.5) * config.turbulence * 0.03
            blob.vy += (Math.random() - 0.5) * config.turbulence * 0.015
          }
          
          // Very high viscosity for smooth motion
          blob.vx *= config.viscosity
          blob.vy *= config.viscosity
          
          // Clamp velocity
          const maxSpeed = 0.2
          blob.vx = Math.max(-maxSpeed, Math.min(maxSpeed, blob.vx))
          blob.vy = Math.max(-maxSpeed, Math.min(maxSpeed, blob.vy))
          
          // Update position
          blob.x += blob.vx
          blob.y += blob.vy
          blob.velocity = blob.vy
          
          // Temperature adjusts based on position
          const targetTemp = 1 - (blob.y + 30) / 60
          blob.temperature += (targetTemp - blob.temperature) * 0.003
          
          // Soft boundary bounces
          if (config.bounceEdges) {
            if (blob.y > 26) { blob.y = 26; blob.vy *= -0.2; blob.temperature *= 0.85 }
            if (blob.y < -26) { blob.y = -26; blob.vy *= -0.2; blob.temperature = Math.min(1, blob.temperature + 0.08) }
            if (blob.x > 16) { blob.x = 16; blob.vx *= -0.2 }
            if (blob.x < -16) { blob.x = -16; blob.vx *= -0.2 }
          } else if (config.wrapEdges) {
            if (blob.y > 30) blob.y = -30
            if (blob.y < -30) blob.y = 30
            if (blob.x > 18) blob.x = -18
            if (blob.x < -18) blob.x = 18
          }

          // Stronger blob-blob repulsion to keep them separate
          for (let j = i + 1; j < blobs.length; j++) {
            const dx = blobs[j].x - blob.x
            const dy = blobs[j].y - blob.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = (blob.baseSize + blobs[j].baseSize) * config.mergeThreshold * 0.4
            if (dist < minDist && dist > 0.1) {
              const push = (minDist - dist) * 0.04  // Stronger push
              const nx = dx / dist, ny = dy / dist
              blob.x -= nx * push
              blob.y -= ny * push
              blobs[j].x += nx * push
              blobs[j].y += ny * push
            }
          }
          
          // Smooth position interpolation
          blob.smoothX += (blob.x - blob.smoothX) * 0.06
          blob.smoothY += (blob.y - blob.smoothY) * 0.06
          
          // Gentle size variation - mostly stable
          const targetSize = blob.baseSize + 
            bands.bassSmooth * config.bassInfluence * 1.0 + 
            bands.midSmooth * config.midInfluence * 0.5 + 
            bands.beatIntensity * config.beatReactivity * 0.8
          blob.smoothSize += (targetSize - blob.smoothSize) * config.smoothingFactor
          
          // Update shader
          shaderMaterial.uniforms.uBlobSizes.value[i] = blob.smoothSize
          shaderMaterial.uniforms.uBlobPositions.value[i].set(blob.smoothX, blob.smoothY, blob.velocity)
          
          const color = getBlobColor(blob, time, bands)
          shaderMaterial.uniforms.uBlobColors.value[i].set(color.r, color.g, color.b)
        }
        
        shaderMaterial.uniforms.uTime.value = time
        shaderMaterial.uniforms.uBlobCount.value = blobs.length
        shaderMaterial.uniforms.uBassSmooth.value = bands.bassSmooth
        shaderMaterial.uniforms.uBeatIntensity.value = bands.beatIntensity * 0.5  // Reduce beat intensity passed to shader
        shaderMaterial.uniforms.uGravityDirection.value = smoothedGravityDirection
      },
      dispose: () => {
        window.removeEventListener('resize', handleResize)
        geometry?.dispose()
        shaderMaterial?.dispose()
        if (quadMesh) scene.remove(quadMesh)
        quadMesh = shaderMaterial = null
      }
    }
  },

  animate(_p: Float32Array, _o: Float32Array, sizes: Float32Array, _c: Float32Array, count: number) {
    for (let i = 0; i < count; i++) sizes[i] = 0
  }
}

// PUBLIC API
export function setLavaLampConfig(c: Partial<LavaLampConfig>) { 
  config = { ...config, ...c }
  ensureValidGradient()
  if (c.blobCount !== undefined) { blobs = initBlobs(config.blobCount); currentBlobCount = config.blobCount } 
}
export function getLavaLampConfig(): LavaLampConfig { return { ...config } }
export function setLavaLampGradient(g: GradientPreset) { 
  if (g && g.colorStops && Array.isArray(g.colorStops) && g.colorStops.length > 0) {
    config.gradient = g 
  }
}
export function setLavaLampColorMode(m: LavaLampConfig['colorMode']) { config.colorMode = m }
export function setLavaLampBlobs(p: { blobCount?: number; minSize?: number; maxSize?: number; mergeThreshold?: number }) {
  if (p.blobCount !== undefined) { 
    config.blobCount = p.blobCount
    while (blobs.length < config.blobCount && blobs.length < MAX_BLOBS) spawnBlob()
    while (blobs.length > config.blobCount && blobs.length > MIN_BLOBS) { blobs.pop(); currentBlobCount = blobs.length } 
  }
  if (p.minSize !== undefined) config.minSize = p.minSize
  if (p.maxSize !== undefined) config.maxSize = p.maxSize
  if (p.mergeThreshold !== undefined) config.mergeThreshold = p.mergeThreshold
}
export function setLavaLampMovement(p: { riseSpeed?: number; sinkSpeed?: number; wanderStrength?: number; wanderSpeed?: number; turbulence?: number }) {
  if (p.riseSpeed !== undefined) config.riseSpeed = p.riseSpeed
  if (p.sinkSpeed !== undefined) config.sinkSpeed = p.sinkSpeed
  if (p.wanderStrength !== undefined) config.wanderStrength = p.wanderStrength
  if (p.wanderSpeed !== undefined) config.wanderSpeed = p.wanderSpeed
  if (p.turbulence !== undefined) config.turbulence = p.turbulence
}
export function setLavaLampPhysics(p: { gravity?: number; buoyancy?: number; viscosity?: number; bounceEdges?: boolean; wrapEdges?: boolean }) {
  if (p.gravity !== undefined) config.gravity = p.gravity
  if (p.buoyancy !== undefined) config.buoyancy = p.buoyancy
  if (p.viscosity !== undefined) config.viscosity = p.viscosity
  if (p.bounceEdges !== undefined) { config.bounceEdges = p.bounceEdges; if (p.bounceEdges) config.wrapEdges = false }
  if (p.wrapEdges !== undefined) { config.wrapEdges = p.wrapEdges; if (p.wrapEdges) config.bounceEdges = false }
}
export function setLavaLampColors(p: { colorMode?: LavaLampConfig['colorMode']; glowIntensity?: number; transparency?: number; colorCycleSpeed?: number }) {
  if (p.colorMode !== undefined) config.colorMode = p.colorMode
  if (p.glowIntensity !== undefined) config.glowIntensity = p.glowIntensity
  if (p.transparency !== undefined) config.transparency = p.transparency
  if (p.colorCycleSpeed !== undefined) config.colorCycleSpeed = p.colorCycleSpeed
}
export function setLavaLampAudioResponse(p: { bassInfluence?: number; midInfluence?: number; highInfluence?: number; beatReactivity?: number; smoothingFactor?: number }) {
  if (p.bassInfluence !== undefined) config.bassInfluence = p.bassInfluence
  if (p.midInfluence !== undefined) config.midInfluence = p.midInfluence
  if (p.highInfluence !== undefined) config.highInfluence = p.highInfluence
  if (p.beatReactivity !== undefined) config.beatReactivity = p.beatReactivity
  if (p.smoothingFactor !== undefined) config.smoothingFactor = p.smoothingFactor
}
export function resetLavaLampConfig() { 
  config = createDefaultConfig()
  blobs = initBlobs(config.blobCount)
  currentBlobCount = config.blobCount 
}
