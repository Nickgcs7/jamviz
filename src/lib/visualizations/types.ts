import type { AudioBands } from '../AudioAnalyzer'

export interface VisualizationMode {
  id: string
  name: string
  description: string
  
  initParticles(
    positions: Float32Array,
    colors: Float32Array,
    count: number
  ): void
  
  animate(
    targetPositions: Float32Array,
    originalPositions: Float32Array,
    targetSizes: Float32Array,
    targetColors: Float32Array,  // Now targeting colors for smooth interpolation
    count: number,
    bands: AudioBands,
    time: number
  ): void
}
