export type { VisualizationMode, SceneObjects } from './types'

import { waveField, setTerrainMode, getTerrainMode, setTerrainGradient } from './waveField'
import { explosion, setSupernovaGradient } from './explosion'
import { laserArray } from './laserArray'
import { lavaLamp } from './lavaLamp'
import { ledMatrix } from './ledMatrix'
import { warpField } from './warpField'
import { yuleLog } from './yuleLog'

export const visualizations = [
  waveField,
  explosion,
  laserArray,
  lavaLamp,
  ledMatrix,
  warpField,
  yuleLog
]

// Re-export visualization control functions
export {
  setTerrainMode,
  getTerrainMode,
  setTerrainGradient,
  setSupernovaGradient
}

// Re-export gradient system from parent
export * from '../gradients'
