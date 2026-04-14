export type { VisualizationMode, SceneObjects, PostProcessingPrefs } from './types'

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
  setRoadwayRoadLines,
  setRoadwayHorizonGlow,
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

// Import visualizations
import { fluidSimulation } from './fluidSimulation'
import { strangeAttractor } from './strangeAttractor'
import { flowFieldPainter } from './flowFieldPainter'
import { crtOscilloscope } from './crtOscilloscope'
import { reactionDiffusion } from './reactionDiffusion'
import { explosion } from './explosion'

export const visualizations = [
  fluidSimulation,
  strangeAttractor,
  flowFieldPainter,
  crtOscilloscope,
  reactionDiffusion,
  roadway,
  sauronsEye,
  laserArray,
  lavaLamp,
]

// Re-export visualization control functions
export {
  // Laser Array
  setLaserArrayConfig, getLaserArrayConfig, setLaserArrayGradient,
  setLaserArrayColorMode, setLaserArrayLasers, setLaserArrayOrigin,
  setLaserArrayAnimation, setLaserArrayEffects, setLaserArrayAudioResponse,
  resetLaserArrayConfig, type LaserArrayConfig,
  
  // Lava Lamp
  setLavaLampConfig, getLavaLampConfig, setLavaLampGradient,
  setLavaLampColorMode, setLavaLampBlobs, setLavaLampMovement,
  setLavaLampPhysics, setLavaLampColors, setLavaLampAudioResponse,
  resetLavaLampConfig, type LavaLampConfig,
  
  // Roadway
  setRoadwayConfig, getRoadwayConfig, setRoadwayGradient,
  setRoadwayColorMode, setRoadwayLaneParams, setRoadwayLineParams,
  setRoadwayEffects, setRoadwayAudioResponse, setRoadwayRoadLines,
  setRoadwayHorizonGlow, resetRoadwayConfig, type RoadwayConfig,
  
  // Sauron's Eye
  setSauronsEyeConfig, getSauronsEyeConfig, setSauronsEyeGradient,
  setSauronsEyeColorMode, setSauronsEyeGeometry, setSauronsEyeBeam,
  setSauronsEyeEmbers, setSauronsEyeAudioResponse, setSauronsEyeAnimation,
  resetSauronsEyeConfig, type SauronsEyeConfig,

  // Explosion
  explosion,
}

// Re-export gradient system from parent
export * from '../gradients'
