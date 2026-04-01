import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'

export interface PostProcessingPrefs {
  bloomStrength?: number
  bloomRadius?: number
  afterimage?: number
  rgbShift?: number
}

export interface SceneObjects {
  objects: THREE.Object3D[]
  update: (bands: AudioBands, time: number, renderer?: THREE.WebGLRenderer) => void
  dispose: () => void
}

export interface VisualizationMode {
  id: string
  name: string
  description: string
  
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
  
  createSceneObjects?: (scene: THREE.Scene) => SceneObjects
  hideParticles?: boolean
  
  textConfig?: {
    enabled: boolean
    placeholder: string
    defaultText: string
  }
  setText?: (text: string) => void
  
  // Per-visualization post-processing preferences
  postProcessing?: PostProcessingPrefs
}
