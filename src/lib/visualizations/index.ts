export type { VisualizationMode, SceneObjects } from './types'

import { waveField, setTerrainMode, getTerrainMode, setTerrainGradient } from './waveField'
import { sauronsEye, setSauronsEyeGradient } from './sauronsEye'
import { laserArray } from './laserArray'
import { lavaLamp } from './lavaLamp'
import { ledMatrix } from './ledMatrix'
import { warpField } from './warpField'
import { yuleLog } from './yuleLog'
import { radialSpectrum, setRadialMode, getRadialMode, setRadialGradient } from './radialSpectrum'
import { spectrumAnalyzer, setSpectrumGradient, setSpectrumSmoothing } from './spectrumAnalyzer'
import { roadway, setRoadwayGradient } from './roadway'

export const visualizations = [
  waveField,
  roadway,
  sauronsEye,
  laserArray,
  lavaLamp,
  ledMatrix,
  warpField,
  yuleLog,
  radialSpectrum,
  spectrumAnalyzer
]

// Re-export visualization control functions
export {
  // Wave Field / Terrain
  setTerrainMode,
  getTerrainMode,
  setTerrainGradient,
  
  // Roadway
  setRoadwayGradient,
  
  // Sauron's Eye
  setSauronsEyeGradient,
  
  // Radial Spectrum
  setRadialMode,
  getRadialMode,
  setRadialGradient,
  
  // Spectrum Analyzer
  setSpectrumGradient,
  setSpectrumSmoothing
}

// Re-export gradient system from parent
export * from '../gradients'
