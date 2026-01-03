import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import {
  metaballVertexShader,
  lavaLampFragmentShader,
  createFullscreenQuad,
  getBlobColor,
  type MetaBlob
} from './metaballUtils'

const MIN_BLOBS = 3
const MAX_BLOBS = 8
const BLOB_SPAWN_THRESHOLD = 0.6
const BLOB_DESPAWN_THRESHOLD = 0.15

// More responsive physics
const GRAVITY_BASE = 0.08
const BUOYANCY_FACTOR = 0.5

let blobs: MetaBlob[] = []
let currentBlobCount = 5
let lastSpawnTime = 0
let lastDespawnTime = 0
let gravityDirection = 1

let quadMesh: THREE.Mesh | null = null
let shaderMaterial: THREE.ShaderMaterial | null = null

function handleCollisions(blobList: MetaBlob[]): void {
  for (let i = 0; i < blobList.length; i++) {
    for (let j = i + 1; j < blobList.length; j++) {
      const dx = blobList[j].x - blobList[i].x
      const dy = blobList[j].y - blobList[i].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      const minDist = (blobList[i].baseSize + blobList[j].baseSize) * 0.6
      
      if (dist < minDist && dist > 0.1) {
        const overlap = minDist - dist
        const nx = dx / dist
        const ny = dy / dist
        
        const pushStrength = overlap * 0.15
        blobList[i].x -= nx * pushStrength
        blobList[i].y -= ny * pushStrength
        blobList[j].x += nx * pushStrength
        blobList[j].y += ny * pushStrength
        
        const avgVel = (blobList[i].velocity + blobList[j].velocity) * 0.5
        blobList[i].velocity = blobList[i].velocity * 0.7 + avgVel * 0.3
        blobList[j].velocity = blobList[j].velocity * 0.7 + avgVel * 0.3
      }
    }
  }
}

function applyPhysics(blob: MetaBlob, bands: AudioBands, dt: number): void {
  // More responsive to audio
  const audioForce = (bands.bassSmooth * 0.6 + bands.midSmooth * 0.3 + bands.beatIntensity * 0.8) * gravityDirection
  const buoyancy = BUOYANCY_FACTOR / (blob.baseSize * 0.15)
  const effectiveGravity = gravityDirection * GRAVITY_BASE
  
  // Stronger beat kicks
  const beatKick = bands.beatIntensity * 0.8 * (Math.random() - 0.5)
  
  // Update velocity with audio reactivity
  blob.velocity += (buoyancy - effectiveGravity + audioForce) * dt
  blob.velocity += beatKick
  
  // Audio-reactive horizontal drift
  const horizontalDrift = bands.stereoBalance * 0.4 * dt
  blob.x += horizontalDrift
  
  // Less damping for more lively movement
  blob.velocity *= 0.98
  
  // Apply velocity
  blob.y += blob.velocity * dt * 60
}

function initBlobs(count: number): MetaBlob[] {
  const newBlobs: MetaBlob[] = []
  
  for (let i = 0; i < count; i++) {
    newBlobs.push({
      x: (Math.random() - 0.5) * 25,
      y: (Math.random() - 0.5) * 35,
      velocity: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      baseSize: 5 + Math.random() * 3,
      colorIndex: i % 5,
      colorPhase: i * 0.7
    })
  }
  
  return newBlobs
}

function spawnBlob(): void {
  if (blobs.length >= MAX_BLOBS) return
  
  const spawnY = gravityDirection > 0 ? -28 : 28
  
  blobs.push({
    x: (Math.random() - 0.5) * 20,
    y: spawnY,
    velocity: gravityDirection * 0.6,
    phase: Math.random() * Math.PI * 2,
    baseSize: 4 + Math.random() * 3,
    colorIndex: blobs.length % 5,
    colorPhase: Math.random() * Math.PI * 2
  })
  
  currentBlobCount = blobs.length
}

function despawnBlob(): void {
  if (blobs.length <= MIN_BLOBS) return
  
  let smallestIdx = 0
  let smallestSize = blobs[0].baseSize
  
  for (let i = 1; i < blobs.length; i++) {
    if (blobs[i].baseSize < smallestSize) {
      smallestSize = blobs[i].baseSize
      smallestIdx = i
    }
  }
  
  blobs[smallestIdx].baseSize *= 0.8
  
  if (blobs[smallestIdx].baseSize < 2) {
    blobs.splice(smallestIdx, 1)
    currentBlobCount = blobs.length
  }
}

export const lavaLamp: VisualizationMode = {
  id: 'lava_lamp',
  name: 'Lava Lamp',
  description: 'Audio-reactive lava lamp with physics-based blob movement',
  
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    blobs = initBlobs(5)
    currentBlobCount = 5
    gravityDirection = 1
    lastSpawnTime = 0
    lastDespawnTime = 0
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -1000
      positions[i * 3 + 2] = 0
      colors[i * 3] = 0
      colors[i * 3 + 1] = 0
      colors[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    const geometry = createFullscreenQuad()
    
    const blobPositions = []
    const blobSizes = []
    const blobColors = []
    
    for (let i = 0; i < MAX_BLOBS; i++) {
      blobPositions.push(new THREE.Vector3(0, 0, 0))
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
      depthTest: false,
      depthWrite: false
    })
    
    quadMesh = new THREE.Mesh(geometry, shaderMaterial)
    quadMesh.frustumCulled = false
    quadMesh.renderOrder = -1000
    
    scene.add(quadMesh)
    
    const handleResize = () => {
      if (shaderMaterial) {
        shaderMaterial.uniforms.uResolution.value.set(
          window.innerWidth,
          window.innerHeight
        )
      }
    }
    window.addEventListener('resize', handleResize)
    
    return {
      objects: [quadMesh],
      update: (bands: AudioBands, time: number) => {
        if (!shaderMaterial) return
        
        const dt = 0.016
        
        // Dynamic blob spawning based on overall energy
        if (bands.overallSmooth > BLOB_SPAWN_THRESHOLD && time - lastSpawnTime > 2) {
          spawnBlob()
          lastSpawnTime = time
        } else if (bands.overallSmooth < BLOB_DESPAWN_THRESHOLD && time - lastDespawnTime > 3) {
          despawnBlob()
          lastDespawnTime = time
        }
        
        // Audio-reactive gravity direction
        // Strong bass makes things heavier, absence makes them lighter
        const bassInfluence = bands.bassSmooth + bands.subBassSmooth * 0.5
        if (bassInfluence > 0.7) {
          gravityDirection = -0.3  // Heavy bass pulls down
        } else if (bassInfluence < 0.2) {
          gravityDirection = 1.2  // Light floats up faster
        } else {
          gravityDirection = 1 - bassInfluence * 0.8
        }
        
        // Animate each blob
        for (let i = 0; i < blobs.length; i++) {
          const blob = blobs[i]
          
          // Apply physics with audio reactivity
          applyPhysics(blob, bands, dt)
          
          // Audio-reactive horizontal movement
          const driftSpeed = (0.02 + bands.midSmooth * 0.04 + bands.highSmooth * 0.03) * 60 * dt
          blob.x += Math.sin(time * 0.3 + blob.phase * 1.5) * driftSpeed
          
          // Beat creates horizontal nudges
          if (bands.isBeat) {
            blob.x += (Math.random() - 0.5) * bands.beatIntensity * 3
          }
          
          // Boundary handling with bounce
          if (blob.y > 30) {
            blob.y = 30
            blob.velocity *= -0.4
          }
          if (blob.y < -30) {
            blob.y = -30
            blob.velocity *= -0.4
          }
          if (blob.x > 18) blob.x = -18
          if (blob.x < -18) blob.x = 18
          
          // Audio-reactive size pulsing
          const sizeBoost = bands.bassSmooth * 3 + bands.midSmooth * 1.5 + bands.beatIntensity * 4
          const targetSize = blob.baseSize + sizeBoost
          const currentSize = shaderMaterial.uniforms.uBlobSizes.value[i]
          shaderMaterial.uniforms.uBlobSizes.value[i] = currentSize + (targetSize - currentSize) * 0.15
          
          // Update position uniforms
          shaderMaterial.uniforms.uBlobPositions.value[i].set(
            blob.x,
            blob.y,
            blob.velocity
          )
          
          // Update color
          const color = getBlobColor(blob, time)
          shaderMaterial.uniforms.uBlobColors.value[i].set(color.r, color.g, color.b)
        }
        
        handleCollisions(blobs)
        
        // Update global uniforms
        shaderMaterial.uniforms.uTime.value = time
        shaderMaterial.uniforms.uBlobCount.value = blobs.length
        shaderMaterial.uniforms.uBassSmooth.value = bands.bassSmooth
        shaderMaterial.uniforms.uBeatIntensity.value = bands.beatIntensity
        shaderMaterial.uniforms.uGravityDirection.value = gravityDirection
      },
      dispose: () => {
        window.removeEventListener('resize', handleResize)
        if (geometry) geometry.dispose()
        if (shaderMaterial) shaderMaterial.dispose()
        if (quadMesh) {
          scene.remove(quadMesh)
        }
        quadMesh = null
        shaderMaterial = null
      }
    }
  },

  animate(
    _positions: Float32Array,
    _originalPositions: Float32Array,
    sizes: Float32Array,
    _colors: Float32Array,
    count: number,
    _bands: AudioBands,
    _time: number
  ) {
    for (let i = 0; i < count; i++) {
      sizes[i] = 0
    }
  }
}
