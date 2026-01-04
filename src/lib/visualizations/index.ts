export type { VisualizationMode, SceneObjects } from './types'

// Import enhanced laser array with full config API
import { 
  laserArray,
  setLaserArrayConfig,
  getLaserArrayConfig,
  setLaserArrayGradient,
  setLaserArrayColorMode,
  setLaserArrayLasers,
  setLaserArrayOrigin,
  setLaserArrayAnimation,
  setLaserArrayEffects,
  setLaserArrayAudioResponse,
  resetLaserArrayConfig,
  type LaserArrayConfig
} from './laserArray'

// Import enhanced lava lamp with full config API
import {
  lavaLamp,
  setLavaLampConfig,
  getLavaLampConfig,
  setLavaLampGradient,
  setLavaLampColorMode,
  setLavaLampBlobs,
  setLavaLampMovement,
  setLavaLampPhysics,
  setLavaLampColors,
  setLavaLampAudioResponse,
  resetLavaLampConfig,
  type LavaLampConfig
} from './lavaLamp'

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

// Import enhanced Sauron's Eye with full config API
import {
  sauronsEye,
  setSauronsEyeConfig,
  getSauronsEyeConfig,
  setSauronsEyeGradient,
  setSauronsEyeColorMode,
  setSauronsEyeGeometry,
  setSauronsEyeBeam,
  setSauronsEyeEmbers,
  setSauronsEyeAudioResponse,
  setSauronsEyeAnimation,
  resetSauronsEyeConfig,
  type SauronsEyeConfig
} from './sauronsEye'

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
  // Laser Array (enhanced)
  setLaserArrayConfig,
  getLaserArrayConfig,
  setLaserArrayGradient,
  setLaserArrayColorMode,
  setLaserArrayLasers,
  setLaserArrayOrigin,
  setLaserArrayAnimation,
  setLaserArrayEffects,
  setLaserArrayAudioResponse,
  resetLaserArrayConfig,
  type LaserArrayConfig,
  
  // Lava Lamp (enhanced)
  setLavaLampConfig,
  getLavaLampConfig,
  setLavaLampGradient,
  setLavaLampColorMode,
  setLavaLampBlobs,
  setLavaLampMovement,
  setLavaLampPhysics,
  setLavaLampColors,
  setLavaLampAudioResponse,
  resetLavaLampConfig,
  type LavaLampConfig,
  
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
  
  // Sauron's Eye (enhanced)
  setSauronsEyeConfig,
  getSauronsEyeConfig,
  setSauronsEyeGradient,
  setSauronsEyeColorMode,
  setSauronsEyeGeometry,
  setSauronsEyeBeam,
  setSauronsEyeEmbers,
  setSauronsEyeAudioResponse,
  setSauronsEyeAnimation,
  resetSauronsEyeConfig,
  type SauronsEyeConfig,
  
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
