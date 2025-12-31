import type { AudioBands } from '../AudioAnalyzer'

export interface MouseCoords {
  x: number  // -1 to 1 (left to right)
  y: number  // -1 to 1 (bottom to top)
  active: boolean  // whether mouse is being tracked
}

export interface VisualizationMode {
  id: string
  name: string
  description: string
  initParticles: (positions: Float32Array, colors: Float32Array, count: number) => void
  animate: (
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number,
    mouse?: MouseCoords
  ) => void
}