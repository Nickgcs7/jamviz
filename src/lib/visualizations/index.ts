export { waveField } from './waveField'
export { explosion } from './explosion'
export { warpField } from './warpField'
export { yuleLog } from './yuleLog'
export { lavaLamp } from './lavaLamp'
export { ledMatrix } from './ledMatrix'
export { laserArray } from './laserArray'

export type { VisualizationMode } from './types'

import { waveField } from './waveField'
import { explosion } from './explosion'
import { warpField } from './warpField'
import { yuleLog } from './yuleLog'
import { lavaLamp } from './lavaLamp'
import { ledMatrix } from './ledMatrix'
import { laserArray } from './laserArray'
import type { VisualizationMode } from './types'

export const visualizations: VisualizationMode[] = [
  waveField,
  explosion,
  warpField,
  yuleLog,
  lavaLamp,
  ledMatrix,
  laserArray
]
