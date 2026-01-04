export type { VisualizationMode, SceneObjects } from './types'

import { sauronsEye, setSauronsEyeGradient } from './sauronsEye'
import { laserArray } from './laserArray'
import { lavaLamp } from './lavaLamp'
import { ledMatrix } from './ledMatrix'
import { warpField } from './warpField'
import { yuleLog } from './yuleLog'
import { radialSpectrum, setRadialMode, getRadialMode, setRadialGradient } from './radialSpectrum'

// Import roadway with full config API
import { 
  roadway,
  setRoadwayConfig,
  getRoadwayConfig,
  setRoadwayGradient,
  setRoadwayColorMode,
  setRoadwayLaneParams,
  setRoadwayLineParams,
  setRoadwayEffects,
  setRoadwayAudioResponse,
  resetRoadwayConfig,
  type RoadwayConfig
} from './roadway'

// Import enhanced spectrum analyzer with full config API
import { 
  spectrumAnalyzer,
  setSpectrumConfig,
  getSpectrumConfig,
  setSpectrumGradient, 
  setSpectrumSmoothing,
  setSpectrumColorMode,
  setSpectrumSpin,
  setLedParams,
  setReflexParams,
  setPeakParams,
  setOverlayParams,
  type SpectrumConfig
} from './spectrumAnalyzer'

export const visualizations = [
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
  // Roadway (enhanced)
  setRoadwayConfig,
  getRoadwayConfig,
  setRoadwayGradient,
  setRoadwayColorMode,
  setRoadwayLaneParams,
  setRoadwayLineParams,
  setRoadwayEffects,
  setRoadwayAudioResponse,
  resetRoadwayConfig,
  type RoadwayConfig,
  
  // Sauron's Eye
  setSauronsEyeGradient,
  
  // Radial Spectrum
  setRadialMode,
  getRadialMode,
  setRadialGradient,
  
  // Spectrum Analyzer (enhanced)
  setSpectrumConfig,
  getSpectrumConfig,
  setSpectrumGradient,
  setSpectrumSmoothing,
  setSpectrumColorMode,
  setSpectrumSpin,
  setLedParams,
  setReflexParams,
  setPeakParams,
  setOverlayParams,
  type SpectrumConfig
}

// Re-export gradient system from parent
export * from '../gradients'
