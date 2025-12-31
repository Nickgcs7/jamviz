import { waveField } from './waveField'
import { explosion } from './explosion'
import { lavaLamp } from './lavaLamp'
import { yuleLog } from './yuleLog'
import { laserArray } from './laserArray'
import { ledMatrix } from './ledMatrix'
import { warpField } from './warpField'
import type { VisualizationMode } from './types'

export const visualizations: VisualizationMode[] = [
  waveField,    // 1 - Terrain
  explosion,    // 2 - Supernova
  lavaLamp,     // 3 - Lava Lamp
  yuleLog,      // 4 - Inferno
  laserArray,   // 5 - Laser Array (NEW)
  ledMatrix,    // 6 - LED Matrix (NEW)
  warpField     // 7 - Warp Field (NEW)
]

export type { VisualizationMode }
export { waveField, explosion, lavaLamp, yuleLog, laserArray, ledMatrix, warpField }
