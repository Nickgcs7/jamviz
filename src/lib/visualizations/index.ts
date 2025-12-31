import { lavaLamp } from './lavaLamp'
import { yuleLog } from './yuleLog'
import { waveField } from './waveField'
import { explosion } from './explosion'
import type { VisualizationMode, MouseCoords } from './types'

export const visualizations: VisualizationMode[] = [
  waveField,    // Terrain - kept
  explosion,    // Supernova - kept  
  lavaLamp,     // New: Lava Lamp (replaced Nebula)
  yuleLog       // New: Yule Log (replaced Vortex)
]

export type { VisualizationMode, MouseCoords }
export { waveField, explosion, lavaLamp, yuleLog }