import { spherePulse } from './spherePulse'
import { galaxySpiral } from './galaxySpiral'
import { waveField } from './waveField'
import { explosion } from './explosion'
import type { VisualizationMode } from './types'

export const visualizations: VisualizationMode[] = [
  spherePulse,
  galaxySpiral,
  waveField,
  explosion
]

export type { VisualizationMode }
export { spherePulse, galaxySpiral, waveField, explosion }