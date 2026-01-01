import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'

export interface SceneObjects {
  objects: THREE.Object3D[]
  update: (bands: AudioBands, time: number) => void
  dispose: () => void
}

export interface VisualizationMode {
  id: string
  name: string
  description: string
  
  // Standard particle-based rendering
  initParticles(positions: Float32Array, colors: Float32Array, count: number): void
  animate(
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ): void
  
  // Optional: Custom scene objects (lines, meshes, etc.)
  createSceneObjects?: (scene: THREE.Scene) => SceneObjects
  
  // Optional: Whether to hide default particles (useful for line-only visualizations)
  hideParticles?: boolean
}
