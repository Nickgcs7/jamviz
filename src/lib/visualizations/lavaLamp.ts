import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import {
  metaballVertexShader,
  lavaLampFragmentShader,
  createFullscreenQuad,
  initLavaLampBlobs,
  getBlobColor,
  type MetaBlob
} from './metaballUtils'

// Blob state
let blobs: MetaBlob[] = []

// Scene object references
let quadMesh: THREE.Mesh | null = null
let shaderMaterial: THREE.ShaderMaterial | null = null

export const lavaLamp: VisualizationMode = {
  id: 'lava_lamp',
  name: 'Lava Lamp',
  description: 'Classic lava lamp with metaball rendering',
  
  // Hide default particles - we use shader-based rendering
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    // Initialize blob state
    blobs = initLavaLampBlobs(5)
    
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
    // Create fullscreen quad for metaball rendering
    const geometry = createFullscreenQuad()
    
    // Create shader material
    shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: metaballVertexShader,
      fragmentShader: lavaLampFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uBlobPositions: { value: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0)
        ]},
        uBlobSizes: { value: [6, 6, 6, 6, 6] },
        uBlobColors: { value: [
          new THREE.Vector3(0.2, 0.9, 0.3),
          new THREE.Vector3(0.95, 0.3, 0.5),
          new THREE.Vector3(0.95, 0.5, 0.1),
          new THREE.Vector3(0.2, 0.8, 0.9),
          new THREE.Vector3(0.7, 0.3, 0.9)
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
    
    // Add to scene at camera position
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
        
        // Animate blobs with lava lamp physics
        for (let i = 0; i < blobs.length; i++) {
          const blob = blobs[i]
          
          // Vertical oscillation with audio influence
          const verticalRange = 22 + bands.bassSmooth * 8
          const targetY = Math.sin(time * 0.4 * (0.8 + i * 0.1) + blob.phase) * verticalRange
          
          // Calculate velocity for stretching effect
          const prevY = blob.y
          blob.y += (targetY - blob.y) * 0.03
          blob.velocity = (blob.y - prevY) * 2
          
          // Horizontal drift
          const driftSpeed = 0.02 + bands.midSmooth * 0.03
          blob.x += Math.sin(time * 0.3 + blob.phase * 1.5) * driftSpeed
          
          // Keep blobs in bounds with soft wrapping
          if (blob.x > 20) blob.x -= 40
          if (blob.x < -20) blob.x += 40
          
          // Size varies with audio
          const size = blob.baseSize + bands.bassSmooth * 3 + bands.beatIntensity * 2
          
          // Update uniforms
          shaderMaterial.uniforms.uBlobPositions.value[i].set(
            blob.x,
            blob.y,
            blob.velocity
          )
          shaderMaterial.uniforms.uBlobSizes.value[i] = size
          
          // Update color with cycling
          const color = getBlobColor(blob, time)
          shaderMaterial.uniforms.uBlobColors.value[i].set(color.r, color.g, color.b)
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
