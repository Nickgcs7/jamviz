import type { AudioBands } from '../AudioAnalyzer'

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
    time: number
  ) => void
}
