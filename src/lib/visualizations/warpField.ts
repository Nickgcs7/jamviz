import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import {
  metaballVertexShader,
  warpFieldFragmentShader,
  createFullscreenQuad,
  initWarpAttractors,
  getAttractorColor,
  type WarpAttractor
} from './metaballUtils'

// ============================================================================
// ENHANCED WARP FIELD CONFIGURATION
// ============================================================================

const MIN_ATTRACTORS = 3
const MAX_ATTRACTORS = 8
const ATTRACTOR_SPAWN_THRESHOLD = 0.55
const ATTRACTOR_DESPAWN_THRESHOLD = 0.12

// ============================================================================
// STATE
// ============================================================================

let attractors: WarpAttractor[] = []
let currentAttractorCount = 5
let lastSpawnTime = 0
let lastDespawnTime = 0

// Scene object references
let quadMesh: THREE.Mesh | null = null
let shaderMaterial: THREE.ShaderMaterial | null = null

// Beat-triggered effects
let lastBeatPhaseReset = 0
let warpPulseIntensity = 0

// ============================================================================
// PHYSICS AND ANIMATION
// ============================================================================

function applyOrbitalMotion(attractor: WarpAttractor, bands: AudioBands, time: number): void {
  // Orbital motion with audio influence
  const speedMultiplier = 1 + bands.midSmooth * 0.8 + bands.beatIntensity * 0.5
  const radiusMultiplier = 1 + bands.bassSmooth * 0.4
  
  const effectiveRadius = attractor.orbitRadius * radiusMultiplier
  const angle = time * attractor.orbitSpeed * speedMultiplier + attractor.phase
  
  // Figure-8 / lemniscate pattern for more interesting motion
  const lemniscateInfluence = 0.3 + bands.highSmooth * 0.3
  const baseX = Math.sin(angle) * effectiveRadius
  const baseY = Math.sin(angle * 2) * effectiveRadius * 0.5 * lemniscateInfluence + 
                Math.cos(angle) * effectiveRadius * 0.6
  
  // Smooth interpolation to new position
  attractor.x += (baseX - attractor.x) * 0.08
  attractor.y += (baseY - attractor.y) * 0.08
}

function updateAttractorStrength(attractor: WarpAttractor, bands: AudioBands): void {
  // Base strength responds to overall energy
  const baseStrength = 5 + bands.overallSmooth * 10
  
  // Beat pulses add extra strength
  const beatBoost = bands.beatIntensity * 12 + warpPulseIntensity * 8
  
  attractor.targetStrength = baseStrength + beatBoost
  
  // Smooth interpolation
  attractor.strength += (attractor.targetStrength - attractor.strength) * 0.12
}

function spawnAttractor(): void {
  if (attractors.length >= MAX_ATTRACTORS) return
  
  // Spawn at random edge position
  const edge = Math.floor(Math.random() * 4)
  let x = 0, y = 0
  
  switch (edge) {
    case 0: x = -25; y = (Math.random() - 0.5) * 30; break // Left
    case 1: x = 25; y = (Math.random() - 0.5) * 30; break  // Right
    case 2: x = (Math.random() - 0.5) * 50; y = -18; break // Bottom
    case 3: x = (Math.random() - 0.5) * 50; y = 18; break  // Top
  }
  
  attractors.push({
    x,
    y,
    strength: 3,
    targetStrength: 5,
    phase: Math.random() * Math.PI * 2,
    hue: Math.random(),
    orbitRadius: 10 + Math.random() * 12,
    orbitSpeed: 0.15 + Math.random() * 0.25
  })
  
  currentAttractorCount = attractors.length
}

function despawnAttractor(): void {
  if (attractors.length <= MIN_ATTRACTORS) return
  
  // Remove the weakest attractor
  let weakestIdx = 0
  let weakestStrength = attractors[0].strength
  
  for (let i = 1; i < attractors.length; i++) {
    if (attractors[i].strength < weakestStrength) {
      weakestStrength = attractors[i].strength
      weakestIdx = i
    }
  }
  
  // Fade out before removing
  attractors[weakestIdx].targetStrength = 0
  
  if (attractors[weakestIdx].strength < 0.5) {
    attractors.splice(weakestIdx, 1)
    currentAttractorCount = attractors.length
  }
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const warpField: VisualizationMode = {
  id: 'warp_field',
  name: 'Warp Field',
  description: 'Gravitational lensing with orbital attractors and dynamic warp intensity',
  
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    attractors = initWarpAttractors(5)
    currentAttractorCount = 5
    lastSpawnTime = 0
    lastDespawnTime = 0
    warpPulseIntensity = 0
    
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
    
    // Initialize uniform arrays for max attractor count
    const attractorPositions = []
    const attractorStrengths = []
    const attractorColors = []
    
    for (let i = 0; i < MAX_ATTRACTORS; i++) {
      attractorPositions.push(new THREE.Vector3(0, 0, 0))
      attractorStrengths.push(5)
      attractorColors.push(new THREE.Vector3(0.5, 0.5, 0.5))
    }
    
    shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: metaballVertexShader,
      fragmentShader: warpFieldFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uAttractorPositions: { value: attractorPositions },
        uAttractorStrengths: { value: attractorStrengths },
        uAttractorColors: { value: attractorColors },
        uAttractorCount: { value: currentAttractorCount },
        uBassSmooth: { value: 0 },
        uBeatIntensity: { value: 0 }
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
        
        // Dynamic attractor count based on sustained energy
        if (bands.overallSmooth > ATTRACTOR_SPAWN_THRESHOLD && time - lastSpawnTime > 2.5) {
          spawnAttractor()
          lastSpawnTime = time
        } else if (bands.overallSmooth < ATTRACTOR_DESPAWN_THRESHOLD && time - lastDespawnTime > 3.5) {
          despawnAttractor()
          lastDespawnTime = time
        }
        
        // Beat triggers phase reset for dramatic effect
        if (bands.isBeat && bands.beatIntensity > 0.6 && time - lastBeatPhaseReset > 1.5) {
          // Randomly reset one attractor's phase for visual variety
          const idx = Math.floor(Math.random() * attractors.length)
          attractors[idx].phase += Math.PI * 0.5
          lastBeatPhaseReset = time
          
          // Trigger warp pulse
          warpPulseIntensity = bands.beatIntensity
        }
        
        // Decay warp pulse
        warpPulseIntensity *= 0.92
        
        // Update each attractor
        for (let i = 0; i < attractors.length; i++) {
          const attractor = attractors[i]
          
          // Apply orbital motion
          applyOrbitalMotion(attractor, bands, time)
          
          // Update strength with audio reactivity
          updateAttractorStrength(attractor, bands)
          
          // Stereo balance affects horizontal position slightly
          attractor.x += bands.stereoBalance * 0.5 * (i % 2 === 0 ? 1 : -1)
          
          // Update uniforms
          shaderMaterial.uniforms.uAttractorPositions.value[i].set(
            attractor.x,
            attractor.y,
            0
          )
          shaderMaterial.uniforms.uAttractorStrengths.value[i] = attractor.strength
          
          // Color with cycling and frequency response
          const baseColor = getAttractorColor(attractor, time)
          
          // Tint based on frequency bands for this attractor
          const bandIndex = i % 5
          let tintAmount = 0
          switch (bandIndex) {
            case 0: tintAmount = bands.bassSmooth; break
            case 1: tintAmount = bands.lowMidSmooth; break
            case 2: tintAmount = bands.midSmooth; break
            case 3: tintAmount = bands.highMidSmooth; break
            case 4: tintAmount = bands.trebleSmooth; break
          }
          
          // Brighten on beat
          const brightness = 1 + bands.beatIntensity * 0.4 + tintAmount * 0.3
          
          shaderMaterial.uniforms.uAttractorColors.value[i].set(
            Math.min(1, baseColor.r * brightness),
            Math.min(1, baseColor.g * brightness),
            Math.min(1, baseColor.b * brightness)
          )
        }
        
        // Update global uniforms
        shaderMaterial.uniforms.uTime.value = time
        shaderMaterial.uniforms.uAttractorCount.value = attractors.length
        shaderMaterial.uniforms.uBassSmooth.value = bands.bassSmooth
        shaderMaterial.uniforms.uBeatIntensity.value = bands.beatIntensity + warpPulseIntensity
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
