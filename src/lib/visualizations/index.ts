export type { VisualizationMode, SceneObjects } from './types'

import { waveField, setTerrainMode, getTerrainMode, setTerrainGradient } from './waveField'
import { explosion, setSupernovaGradient } from './explosion'
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
  explosion,
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
  
  // Supernova / Explosion
  setSupernovaGradient,
  
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
