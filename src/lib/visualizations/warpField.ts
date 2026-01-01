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

// Attractor state
let attractors: WarpAttractor[] = []

// Scene object references
let quadMesh: THREE.Mesh | null = null
let shaderMaterial: THREE.ShaderMaterial | null = null

export const warpField: VisualizationMode = {
  id: 'warp_field',
  name: 'Warp Field',
  description: 'Gravitational lensing effect with visible attractor orbs',
  
  // Hide default particles - we use shader-based rendering
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    // Initialize attractor state
    attractors = initWarpAttractors(5)
    
    // Set particles off-screen (they're hidden but we still need to initialize)
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
    // Create fullscreen quad for warp field rendering
    const geometry = createFullscreenQuad()
    
    // Create shader material
    shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: metaballVertexShader,
      fragmentShader: warpFieldFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uAttractorPositions: { value: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0)
        ]},
        uAttractorStrengths: { value: [5, 5, 5, 5, 5] },
        uAttractorColors: { value: [
          new THREE.Vector3(0.9, 0.3, 0.3),
          new THREE.Vector3(0.3, 0.9, 0.5),
          new THREE.Vector3(0.3, 0.5, 0.9),
          new THREE.Vector3(0.9, 0.7, 0.2),
          new THREE.Vector3(0.8, 0.3, 0.9)
        ]},
        uBassSmooth: { value: 0 },
        uBeatIntensity: { value: 0 }
      },
      depthTest: false,
      depthWrite: false
    })
    
    quadMesh = new THREE.Mesh(geometry, shaderMaterial)
    quadMesh.frustumCulled = false
    quadMesh.renderOrder = -1000 // Render behind everything
    
    scene.add(quadMesh)
    
    // Handle window resize
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
        
        // Animate attractors
        for (let i = 0; i < attractors.length; i++) {
          const attractor = attractors[i]
          
          // Orbital motion with audio influence
          const orbitSpeed = 0.3 + bands.midSmooth * 0.2
          const orbitRadius = 18 + bands.bassSmooth * 8
          
          attractor.x = Math.sin(time * orbitSpeed * (0.7 + i * 0.15) + attractor.phase) * orbitRadius
          attractor.y = Math.cos(time * orbitSpeed * (0.6 + i * 0.12) + attractor.phase * 1.3) * (orbitRadius * 0.7)
          
          // Strength responds to audio
          attractor.targetStrength = 6 + bands.bassSmooth * 12 + bands.beatIntensity * 8
          attractor.strength += (attractor.targetStrength - attractor.strength) * 0.1
          
          // Update uniforms
          shaderMaterial.uniforms.uAttractorPositions.value[i].set(
            attractor.x,
            attractor.y,
            0
          )
          shaderMaterial.uniforms.uAttractorStrengths.value[i] = attractor.strength
          
          // Update color with cycling
          const color = getAttractorColor(attractor, time)
          shaderMaterial.uniforms.uAttractorColors.value[i].set(color.r, color.g, color.b)
        }
        
        // Spawn new attractor position on strong beat
        if (bands.isBeat && bands.beatIntensity > 0.5) {
          const spawnIndex = Math.floor(Math.random() * attractors.length)
          attractors[spawnIndex].phase = Math.random() * Math.PI * 2
        }
        
        // Update other uniforms
        shaderMaterial.uniforms.uTime.value = time
        shaderMaterial.uniforms.uBassSmooth.value = bands.bassSmooth
        shaderMaterial.uniforms.uBeatIntensity.value = bands.beatIntensity
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
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    // Main rendering is done in createSceneObjects.update
    // Keep particles hidden
    for (let i = 0; i < count; i++) {
      sizes[i] = 0
    }
  }
}
