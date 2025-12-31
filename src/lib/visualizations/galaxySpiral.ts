// DEPRECATED: This visualization has been replaced by yuleLog.ts
// This file is kept as a stub to prevent import errors in case of external references

import type { VisualizationMode, MouseCoords } from './types'
import type { AudioBands } from '../AudioAnalyzer'

// Stub export - not used in the application
export const galaxySpiral: VisualizationMode = {
  id: 'galaxy_spiral_deprecated',
  name: 'Deprecated',
  description: 'Deprecated visualization',
  initParticles(_positions: Float32Array, _colors: Float32Array, _count: number) {},
  animate(
    _positions: Float32Array,
    _originalPositions: Float32Array,
    _sizes: Float32Array,
    _colors: Float32Array,
    _count: number,
    _bands: AudioBands,
    _time: number,
    _mouse?: MouseCoords
  ) {}
}
