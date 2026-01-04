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

const DEFAULT_CONFIG: LavaLampConfig = {
  blobCount: 6, minSize: 4, maxSize: 10, mergeThreshold: 2.5,
  riseSpeed: 1.0, sinkSpeed: 0.8, wanderStrength: 1.0, wanderSpeed: 0.5, turbulence: 0.4,
  gravity: 0.15, buoyancy: 0.6, viscosity: 0.96, bounceEdges: true, wrapEdges: false,
  colorMode: 'gradient', gradient: builtInGradients.lavaLamp, glowIntensity: 1.0, transparency: 0.85,
  bassInfluence: 1.0, midInfluence: 0.8, highInfluence: 0.5, beatReactivity: 1.0,
  colorCycleSpeed: 0.15, smoothingFactor: 0.1
}

let config: LavaLampConfig = { ...DEFAULT_CONFIG }
const MIN_BLOBS = 2, MAX_BLOBS = 12

interface EnhancedBlob extends MetaBlob {
  vx: number; vy: number; temperature: number; wanderPhase: number; targetX: number; targetY: number
}

let blobs: EnhancedBlob[] = []
let currentBlobCount = 6, lastSpawnTime = 0, lastDespawnTime = 0, gravityDirection = 1
let quadMesh: THREE.Mesh | null = null, shaderMaterial: THREE.ShaderMaterial | null = null

function getGradient(): GradientPreset {
  return config.gradient && config.gradient.colorStops ? config.gradient : builtInGradients.lavaLamp
}

function initBlobs(count: number): EnhancedBlob[] {
  const newBlobs: EnhancedBlob[] = []
  for (let i = 0; i < count; i++) {
    newBlobs.push({
      x: (Math.random() - 0.5) * 25, y: (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, velocity: 0,
      phase: Math.random() * Math.PI * 2,
      baseSize: config.minSize + Math.random() * (config.maxSize - config.minSize),
      colorIndex: i % 8, colorPhase: i * 0.7, temperature: 0.5 + (Math.random() - 0.5) * 0.3,
      wanderPhase: Math.random() * Math.PI * 2,
      targetX: (Math.random() - 0.5) * 30, targetY: (Math.random() - 0.5) * 40
    })
  }
  return newBlobs
}

function spawnBlob(): void {
  if (blobs.length >= MAX_BLOBS) return
  blobs.push({
    x: (Math.random() - 0.5) * 20, y: gravityDirection > 0 ? -32 : 32,
    vx: (Math.random() - 0.5) * 0.3, vy: gravityDirection * 0.5, velocity: gravityDirection * 0.5,
    phase: Math.random() * Math.PI * 2, baseSize: config.minSize + Math.random() * (config.maxSize - config.minSize),
    colorIndex: blobs.length % 8, colorPhase: Math.random() * Math.PI * 2,
    temperature: gravityDirection > 0 ? 0.9 : 0.1, wanderPhase: Math.random() * Math.PI * 2,
    targetX: (Math.random() - 0.5) * 30, targetY: (Math.random() - 0.5) * 40
  })
  currentBlobCount = blobs.length
}

function despawnBlob(): void {
  if (blobs.length <= MIN_BLOBS) return
  let idx = 0
  for (let i = 1; i < blobs.length; i++) if (blobs[i].baseSize < blobs[idx].baseSize) idx = i
  blobs[idx].baseSize *= 0.85
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
      const gradient = getGradient()
      const t = (blob.y + 30) / 60 + time * config.colorCycleSpeed * 0.2 + blob.colorPhase * 0.1
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
    if (!config.gradient || !config.gradient.colorStops) {
      config.gradient = builtInGradients.lavaLamp
    }
    blobs = initBlobs(config.blobCount); currentBlobCount = config.blobCount; gravityDirection = 1; lastSpawnTime = lastDespawnTime = 0
    for (let i = 0; i < count; i++) { positions[i * 3] = 0; positions[i * 3 + 1] = -1000; positions[i * 3 + 2] = 0; colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0 }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    if (!config.gradient || !config.gradient.colorStops) {
      config.gradient = builtInGradients.lavaLamp
    }
    
    const geometry = createFullscreenQuad()
    const blobPositions = [], blobSizes = [], blobColors = []
    for (let i = 0; i < MAX_BLOBS; i++) { blobPositions.push(new THREE.Vector3()); blobSizes.push(6); blobColors.push(new THREE.Vector3(0.5, 0.5, 0.5)) }
    
    shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: metaballVertexShader, fragmentShader: lavaLampFragmentShader,
      uniforms: {
        uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uBlobPositions: { value: blobPositions }, uBlobSizes: { value: blobSizes }, uBlobColors: { value: blobColors },
        uBlobCount: { value: currentBlobCount }, uBassSmooth: { value: 0 }, uBeatIntensity: { value: 0 }, uGravityDirection: { value: gravityDirection }
      },
      depthTest: false, depthWrite: false
    })
    quadMesh = new THREE.Mesh(geometry, shaderMaterial); quadMesh.frustumCulled = false; quadMesh.renderOrder = -1000
    scene.add(quadMesh)
    const handleResize = () => { if (shaderMaterial) shaderMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight) }
    window.addEventListener('resize', handleResize)

    return {
      objects: [quadMesh],
      update: (bands: AudioBands, time: number) => {
        if (!shaderMaterial) return
        const dt = 0.016

        if (bands.overallSmooth > 0.65 && time - lastSpawnTime > 2) { spawnBlob(); lastSpawnTime = time }
        else if (bands.overallSmooth < 0.12 && time - lastDespawnTime > 3) { despawnBlob(); lastDespawnTime = time }

        const bassInfluence = bands.bassSmooth + (bands.subBassSmooth || 0) * 0.5
        gravityDirection = bassInfluence > 0.7 ? -0.4 : bassInfluence < 0.2 ? 1.3 : 1 - bassInfluence * 0.9

        for (let i = 0; i < blobs.length; i++) {
          const blob = blobs[i]
          
          const tempFactor = blob.temperature - 0.5
          const buoyancy = config.buoyancy * (1 + tempFactor * 2) / (blob.baseSize * 0.1)
          const effectiveGravity = config.gravity * gravityDirection
          
          const bassForce = bands.bassSmooth * 0.5 * config.bassInfluence
          const midForce = bands.midSmooth * 0.3 * config.midInfluence
          
          blob.vy += (buoyancy - effectiveGravity + bassForce * gravityDirection) * dt * 60
          
          const wanderX = Math.sin(time * config.wanderSpeed + blob.wanderPhase) * config.wanderStrength
          const wanderY = Math.cos(time * config.wanderSpeed * 0.7 + blob.wanderPhase * 1.3) * config.wanderStrength * 0.5
          const toTargetX = (blob.targetX - blob.x) * 0.01
          const toTargetY = (blob.targetY - blob.y) * 0.01
          
          blob.vx += (wanderX * 0.1 + toTargetX + midForce * bands.stereoBalance) * dt * 60
          blob.vy += (wanderY * 0.05 + toTargetY) * dt * 60
          
          if (bands.isBeat && bands.beatIntensity > 0.5) {
            blob.vx += (Math.random() - 0.5) * bands.beatIntensity * config.beatReactivity * 3
            blob.vy += (Math.random() - 0.5) * bands.beatIntensity * config.beatReactivity
            if (Math.random() < 0.3) { blob.targetX = (Math.random() - 0.5) * 30; blob.targetY = (Math.random() - 0.5) * 40 }
          }
          
          if (config.turbulence > 0) {
            blob.vx += (Math.random() - 0.5) * config.turbulence * 0.5 * dt * 60
            blob.vy += (Math.random() - 0.5) * config.turbulence * 0.3 * dt * 60
          }
          
          blob.vx *= config.viscosity; blob.vy *= config.viscosity
          blob.vx = Math.max(-2, Math.min(2, blob.vx)); blob.vy = Math.max(-2, Math.min(2, blob.vy))
          
          blob.x += blob.vx * dt * 60; blob.y += blob.vy * dt * 60
          blob.velocity = blob.vy
          
          blob.temperature += ((1 - (blob.y + 30) / 60 + bands.bassSmooth * 0.3) - blob.temperature) * 0.02
          
          if (config.bounceEdges) {
            if (blob.y > 32) { blob.y = 32; blob.vy *= -0.5; blob.temperature *= 0.8 }
            if (blob.y < -32) { blob.y = -32; blob.vy *= -0.5; blob.temperature = Math.min(1, blob.temperature + 0.2) }
            if (blob.x > 20) { blob.x = 20; blob.vx *= -0.6 }
            if (blob.x < -20) { blob.x = -20; blob.vx *= -0.6 }
          } else if (config.wrapEdges) {
            if (blob.y > 35) blob.y = -35; if (blob.y < -35) blob.y = 35
            if (blob.x > 22) blob.x = -22; if (blob.x < -22) blob.x = 22
          }

          for (let j = i + 1; j < blobs.length; j++) {
            const dx = blobs[j].x - blob.x, dy = blobs[j].y - blob.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = (blob.baseSize + blobs[j].baseSize) * config.mergeThreshold * 0.3
            if (dist < minDist && dist > 0.1) {
              const push = (minDist - dist) * 0.12, nx = dx / dist, ny = dy / dist
              blob.x -= nx * push; blob.y -= ny * push; blobs[j].x += nx * push; blobs[j].y += ny * push
            }
          }
          
          const sizeBoost = bands.bassSmooth * 3 * config.bassInfluence + bands.midSmooth * 1.5 * config.midInfluence + bands.beatIntensity * 4 * config.beatReactivity
          shaderMaterial.uniforms.uBlobSizes.value[i] += ((blob.baseSize + sizeBoost) - shaderMaterial.uniforms.uBlobSizes.value[i]) * config.smoothingFactor
          shaderMaterial.uniforms.uBlobPositions.value[i].set(blob.x, blob.y, blob.velocity)
          const color = getBlobColor(blob, time, bands)
          shaderMaterial.uniforms.uBlobColors.value[i].set(color.r, color.g, color.b)
        }
        
        shaderMaterial.uniforms.uTime.value = time
        shaderMaterial.uniforms.uBlobCount.value = blobs.length
        shaderMaterial.uniforms.uBassSmooth.value = bands.bassSmooth
        shaderMaterial.uniforms.uBeatIntensity.value = bands.beatIntensity
        shaderMaterial.uniforms.uGravityDirection.value = gravityDirection
      },
      dispose: () => {
        window.removeEventListener('resize', handleResize)
        geometry?.dispose(); shaderMaterial?.dispose()
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
  if (!config.gradient || !config.gradient.colorStops) {
    config.gradient = builtInGradients.lavaLamp
  }
  if (c.blobCount !== undefined) { blobs = initBlobs(config.blobCount); currentBlobCount = config.blobCount } 
}
export function getLavaLampConfig(): LavaLampConfig { return { ...config } }
export function setLavaLampGradient(g: GradientPreset) { 
  if (g && g.colorStops) {
    config.gradient = g 
  }
}
export function setLavaLampColorMode(m: LavaLampConfig['colorMode']) { config.colorMode = m }
export function setLavaLampBlobs(p: { blobCount?: number; minSize?: number; maxSize?: number; mergeThreshold?: number }) {
  if (p.blobCount !== undefined) { config.blobCount = p.blobCount; while (blobs.length < config.blobCount && blobs.length < MAX_BLOBS) spawnBlob(); while (blobs.length > config.blobCount && blobs.length > MIN_BLOBS) { blobs.pop(); currentBlobCount = blobs.length } }
  if (p.minSize !== undefined) config.minSize = p.minSize; if (p.maxSize !== undefined) config.maxSize = p.maxSize; if (p.mergeThreshold !== undefined) config.mergeThreshold = p.mergeThreshold
}
export function setLavaLampMovement(p: { riseSpeed?: number; sinkSpeed?: number; wanderStrength?: number; wanderSpeed?: number; turbulence?: number }) {
  if (p.riseSpeed !== undefined) config.riseSpeed = p.riseSpeed; if (p.sinkSpeed !== undefined) config.sinkSpeed = p.sinkSpeed
  if (p.wanderStrength !== undefined) config.wanderStrength = p.wanderStrength; if (p.wanderSpeed !== undefined) config.wanderSpeed = p.wanderSpeed
  if (p.turbulence !== undefined) config.turbulence = p.turbulence
}
export function setLavaLampPhysics(p: { gravity?: number; buoyancy?: number; viscosity?: number; bounceEdges?: boolean; wrapEdges?: boolean }) {
  if (p.gravity !== undefined) config.gravity = p.gravity; if (p.buoyancy !== undefined) config.buoyancy = p.buoyancy; if (p.viscosity !== undefined) config.viscosity = p.viscosity
  if (p.bounceEdges !== undefined) { config.bounceEdges = p.bounceEdges; if (p.bounceEdges) config.wrapEdges = false }
  if (p.wrapEdges !== undefined) { config.wrapEdges = p.wrapEdges; if (p.wrapEdges) config.bounceEdges = false }
}
export function setLavaLampColors(p: { colorMode?: LavaLampConfig['colorMode']; glowIntensity?: number; transparency?: number; colorCycleSpeed?: number }) {
  if (p.colorMode !== undefined) config.colorMode = p.colorMode; if (p.glowIntensity !== undefined) config.glowIntensity = p.glowIntensity
  if (p.transparency !== undefined) config.transparency = p.transparency; if (p.colorCycleSpeed !== undefined) config.colorCycleSpeed = p.colorCycleSpeed
}
export function setLavaLampAudioResponse(p: { bassInfluence?: number; midInfluence?: number; highInfluence?: number; beatReactivity?: number; smoothingFactor?: number }) {
  if (p.bassInfluence !== undefined) config.bassInfluence = p.bassInfluence; if (p.midInfluence !== undefined) config.midInfluence = p.midInfluence
  if (p.highInfluence !== undefined) config.highInfluence = p.highInfluence; if (p.beatReactivity !== undefined) config.beatReactivity = p.beatReactivity
  if (p.smoothingFactor !== undefined) config.smoothingFactor = p.smoothingFactor
}
export function resetLavaLampConfig() { 
  config = { ...DEFAULT_CONFIG }
  config.gradient = builtInGradients.lavaLamp
  blobs = initBlobs(config.blobCount); currentBlobCount = config.blobCount 
}
