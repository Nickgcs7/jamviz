export type { VisualizationMode, SceneObjects } from './types'

import { waveField } from './waveField'
import { explosion } from './explosion'
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
