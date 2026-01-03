import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { createDefaultAudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

// ============================================================================
// FLAME CONFIGURATION
// ============================================================================

const EMBER_BED_PARTICLES = 2000
const FLAME_TONGUE_PARTICLES = 6000
const RISING_SPARK_PARTICLES = 2000

// Screen proportions
const FLAME_WIDTH = 50          // Total width of fire
const EMBER_BED_HEIGHT = -18    // Bottom of ember bed
const FLAME_BASE_HEIGHT = -15   // Where flames start
const FLAME_MAX_HEIGHT = 25     // Maximum flame height
const TONGUE_CENTER_ZONE = 0.33 // Middle third for main tongues

// ============================================================================
// TYPES
// ============================================================================

interface EmberParticle {
  x: number
  y: number
  z: number
  baseX: number
  glowPhase: number
  glowSpeed: number
  hue: number
  frequencyResponse: 'subBass' | 'bass' | 'lowMid'  // Which band this ember responds to
}

interface FlameParticle {
  x: number
  y: number
  z: number
  baseX: number
  tongueIndex: number
  heightInTongue: number
  phase: number
  speed: number
  hue: number
}

interface SparkParticle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  hue: number
  frequencyTrigger: 'highMid' | 'treble' | 'brilliance'  // What frequency band triggers this spark
}

// ============================================================================
// STATE
// ============================================================================

const embers: EmberParticle[] = []
const flames: FlameParticle[] = []
const sparks: SparkParticle[] = []

const NUM_TONGUES = 12

interface FlameTongue {
  x: number
  width: number
  height: number
  targetHeight: number
  phase: number
  swayAmount: number
  hue: number
  frequencyBand: number  // 0-6 maps to sub-bass through brilliance
}

const tongues: FlameTongue[] = []

// Peak hold for crackle effects
let lastCrackleTime = 0
let crackleIntensity = 0

// BPM sync for rhythmic flicker
let bpmFlickerPhase = 0

// ============================================================================
// INITIALIZATION
// ============================================================================

function initTongues() {
  tongues.length = 0
  
  for (let t = 0; t < NUM_TONGUES; t++) {
    let x: number
    const normalizedT = t / (NUM_TONGUES - 1)
    
    if (t >= 3 && t <= 8) {
      // Main tongues in center third
      const centerT = (t - 3) / 5
      x = (centerT - 0.5) * FLAME_WIDTH * TONGUE_CENTER_ZONE
    } else {
      // Edge tongues (smaller)
      x = (normalizedT - 0.5) * FLAME_WIDTH * 0.9
    }
    
    const isCenterTongue = t >= 3 && t <= 8
    
    // Assign frequency band to each tongue (lower bands in center, higher on edges)
    let frequencyBand: number
    if (t >= 4 && t <= 7) {
      frequencyBand = 1  // Bass - main flames
    } else if (t >= 2 && t <= 9) {
      frequencyBand = 2  // Low-mid
    } else {
      frequencyBand = 3 + Math.abs(t - 5) % 3  // Mid to high-mid
    }
    
    tongues.push({
      x,
      width: isCenterTongue ? 6 + Math.random() * 4 : 3 + Math.random() * 3,
      height: isCenterTongue ? 25 + Math.random() * 10 : 12 + Math.random() * 8,
      targetHeight: 20,
      phase: Math.random() * Math.PI * 2,
      swayAmount: 0.8 + Math.random() * 0.6,
      hue: 0.04 + Math.random() * 0.06,
      frequencyBand
    })
  }
}

function spawnSpark(bands: AudioBands, sourceX: number, trigger: 'highMid' | 'treble' | 'brilliance' = 'treble'): SparkParticle {
  const intensity = 0.5 + bands.overallSmooth * 0.5 + bands.beatIntensity * 0.5
  
  // Higher frequency triggers create faster, smaller sparks
  let speedMult = 1, sizeMult = 1
  switch (trigger) {
    case 'brilliance':
      speedMult = 1.4
      sizeMult = 0.7
      break
    case 'treble':
      speedMult = 1.2
      sizeMult = 0.9
      break
    case 'highMid':
      speedMult = 1.0
      sizeMult = 1.1
      break
  }
  
  return {
    x: sourceX + (Math.random() - 0.5) * 8,
    y: FLAME_BASE_HEIGHT + Math.random() * 10,
    z: (Math.random() - 0.5) * 6,
    vx: (Math.random() - 0.5) * 1.5 * speedMult,
    vy: (1.5 + Math.random() * 2) * intensity * speedMult,
    vz: (Math.random() - 0.5) * 0.8,
    life: 1.0,
    maxLife: 1.5 + Math.random() * 2,
    size: (1 + Math.random() * 1.5 + bands.beatIntensity * 1.5) * sizeMult,
    hue: 0.05 + Math.random() * 0.07,
    frequencyTrigger: trigger
  }
}

// Warm color cycling for fire (limited to reds, oranges, yellows)
function getWarmCyclingHue(time: number): number {
  const cycle = Math.sin(time * 0.15) * 0.5 + 0.5
  return 0.0 + cycle * 0.12
}

// Get the audio value for a specific frequency band
function getFrequencyValue(bands: AudioBands, bandIndex: number): number {
  switch (bandIndex) {
    case 0: return bands.subBassSmooth
    case 1: return bands.bassSmooth
    case 2: return bands.lowMidSmooth
    case 3: return bands.midSmooth
    case 4: return bands.highMidSmooth
    case 5: return bands.trebleSmooth
    case 6: return bands.brillianceSmooth
    default: return bands.overallSmooth
  }
}

// ============================================================================
// VISUALIZATION
// ============================================================================

export const yuleLog: VisualizationMode = {
  id: 'yule_log',
  name: 'Yule Log',
  description: 'Warm flickering fireplace with frequency-mapped flame tongues and rhythmic crackle',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    embers.length = 0
    flames.length = 0
    sparks.length = 0
    lastCrackleTime = 0
    crackleIntensity = 0
    bpmFlickerPhase = 0
    
    initTongues()
    
    // Initialize ember bed particles with frequency response assignment
    for (let i = 0; i < EMBER_BED_PARTICLES; i++) {
      const x = (Math.random() - 0.5) * FLAME_WIDTH
      
      // Assign frequency response based on position
      let frequencyResponse: 'subBass' | 'bass' | 'lowMid'
      const normalizedX = (x / FLAME_WIDTH) + 0.5  // 0-1
      if (normalizedX < 0.3 || normalizedX > 0.7) {
        frequencyResponse = 'lowMid'  // Outer embers respond to low-mid
      } else if (normalizedX < 0.4 || normalizedX > 0.6) {
        frequencyResponse = 'bass'    // Middle ring responds to bass
      } else {
        frequencyResponse = 'subBass' // Center embers respond to sub-bass
      }
      
      embers.push({
        x,
        y: EMBER_BED_HEIGHT + Math.random() * 4,
        z: (Math.random() - 0.5) * 8,
        baseX: x,
        glowPhase: Math.random() * Math.PI * 2,
        glowSpeed: 0.5 + Math.random() * 1.5,
        hue: 0.02 + Math.random() * 0.06,
        frequencyResponse
      })
    }
    
    // Initialize flame particles assigned to tongues
    for (let i = 0; i < FLAME_TONGUE_PARTICLES; i++) {
      const tongueIndex = Math.floor(Math.random() * NUM_TONGUES)
      const tongue = tongues[tongueIndex]
      
      flames.push({
        x: tongue.x + (Math.random() - 0.5) * tongue.width,
        y: FLAME_BASE_HEIGHT + Math.random() * tongue.height,
        z: (Math.random() - 0.5) * 4,
        baseX: tongue.x,
        tongueIndex,
        heightInTongue: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.8,
        hue: tongue.hue + (Math.random() - 0.5) * 0.03
      })
    }
    
    // Initialize spark particles with different frequency triggers
    const defaultBands = createDefaultAudioBands()
    defaultBands.overallSmooth = 0.3
    
    for (let i = 0; i < RISING_SPARK_PARTICLES; i++) {
      // Distribute spark triggers across high frequencies
      const triggers: ('highMid' | 'treble' | 'brilliance')[] = ['highMid', 'treble', 'brilliance']
      const trigger = triggers[i % 3]
      
      const spark = spawnSpark(defaultBands, (Math.random() - 0.5) * FLAME_WIDTH * 0.5, trigger)
      spark.life = Math.random()
      spark.y = FLAME_BASE_HEIGHT + Math.random() * 40
      sparks.push(spark)
    }
    
    // Set initial positions
    for (let i = 0; i < count; i++) {
      if (i < EMBER_BED_PARTICLES) {
        const ember = embers[i]
        positions[i * 3] = ember.x
        positions[i * 3 + 1] = ember.y
        positions[i * 3 + 2] = ember.z
      } else if (i < EMBER_BED_PARTICLES + FLAME_TONGUE_PARTICLES) {
        const flame = flames[i - EMBER_BED_PARTICLES]
        positions[i * 3] = flame.x
        positions[i * 3 + 1] = flame.y
        positions[i * 3 + 2] = flame.z
      } else if (i < EMBER_BED_PARTICLES + FLAME_TONGUE_PARTICLES + RISING_SPARK_PARTICLES) {
        const spark = sparks[i - EMBER_BED_PARTICLES - FLAME_TONGUE_PARTICLES]
        positions[i * 3] = spark.x
        positions[i * 3 + 1] = spark.y
        positions[i * 3 + 2] = spark.z
      } else {
        positions[i * 3] = 0
        positions[i * 3 + 1] = -100
        positions[i * 3 + 2] = 0
      }

      const t = Math.random()
      const [r, g, b] = hslToRgb(0.06 - t * 0.04, 0.95, 0.5 + t * 0.2)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  },

  animate(
    positions: Float32Array,
    _originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    const dt = 0.016
    const warmHue = getWarmCyclingHue(time)
    const intensity = 0.8 + bands.overallSmooth * 0.4 + bands.beatIntensity * 0.3
    
    // Wind affected by high-mid frequencies
    const windBase = Math.sin(time * 0.7) * 0.4
    const windHighMid = bands.highMidSmooth * 0.6
    const windX = windBase * (1 + windHighMid + bands.midSmooth)
    
    // ================================================================
    // BPM-SYNCED FLICKER
    // ================================================================
    
    let bpmFlicker = 0
    if (bands.estimatedBPM > 0) {
      const bps = bands.estimatedBPM / 60
      bpmFlickerPhase = (time * bps) % 1
      // Quick flicker on the beat
      bpmFlicker = Math.pow(Math.max(0, 1 - bpmFlickerPhase * 4), 2) * 0.3
    }
    
    // ================================================================
    // CRACKLE EFFECT (triggered by high frequency peaks)
    // ================================================================
    
    const crackleThreshold = 0.4
    const canCrackle = time - lastCrackleTime > 0.3
    
    if (canCrackle && (bands.treble > crackleThreshold || bands.brilliance > crackleThreshold * 0.8)) {
      lastCrackleTime = time
      crackleIntensity = Math.max(bands.treble, bands.brilliance) * 1.5
    }
    
    // Decay crackle
    crackleIntensity *= 0.92
    
    // ================================================================
    // UPDATE TONGUES BASED ON FREQUENCY BANDS
    // ================================================================
    
    for (let t = 0; t < tongues.length; t++) {
      const tongue = tongues[t]
      const isCenterTongue = t >= 3 && t <= 8
      
      // Get frequency value for this tongue's assigned band
      const freqValue = getFrequencyValue(bands, tongue.frequencyBand)
      
      // Use sub-bass for deep rumble, bass for main pulse
      const subBassRumble = bands.subBassSmooth * 8
      const bassBoost = bands.bassSmooth * 12
      const freqBoost = freqValue * 10
      
      const baseHeight = isCenterTongue ? 25 : 12
      const pulseHeight = Math.sin(time * 1.5 + tongue.phase) * 5
      const beatPulse = bands.beatIntensity * 8
      
      // BPM flicker affects all tongues
      const flickerBoost = bpmFlicker * 10
      
      tongue.targetHeight = baseHeight + subBassRumble + bassBoost + freqBoost + pulseHeight + beatPulse + flickerBoost
      tongue.height += (tongue.targetHeight - tongue.height) * 0.12
      
      // Hue shifts based on frequency - hotter (more yellow) for higher frequencies
      const freqHueShift = tongue.frequencyBand * 0.015
      tongue.hue = warmHue + (t / tongues.length) * 0.04 + freqHueShift + bands.bassSmooth * 0.02
    }
    
    // ================================================================
    // EMBER BED - Responds to sub-bass and bass
    // ================================================================
    
    for (let i = 0; i < EMBER_BED_PARTICLES; i++) {
      const ember = embers[i]
      
      // Get the frequency value this ember responds to
      let freqGlow = 0
      switch (ember.frequencyResponse) {
        case 'subBass':
          freqGlow = bands.subBassSmooth * 0.8
          break
        case 'bass':
          freqGlow = bands.bassSmooth * 0.6
          break
        case 'lowMid':
          freqGlow = bands.lowMidSmooth * 0.5
          break
      }
      
      // Gentle glow pulsing with frequency response
      const glowPulse = Math.sin(time * ember.glowSpeed + ember.glowPhase) * 0.3 + 0.7
      const audioGlow = 1 + freqGlow + bands.beatIntensity * 0.3 + bpmFlicker * 0.4
      
      // Crackle creates quick bright flashes in embers
      const crackleGlow = crackleIntensity * (Math.random() < 0.1 ? 1 : 0) * 2
      
      // Slight position wobble
      const wobbleX = Math.sin(time * 0.8 + ember.glowPhase) * 0.3
      const wobbleY = Math.sin(time * 1.2 + ember.glowPhase * 1.3) * 0.2 + freqGlow * 0.5
      
      positions[i * 3] = ember.baseX + wobbleX + windX * 0.2
      positions[i * 3 + 1] = ember.y + wobbleY
      positions[i * 3 + 2] = ember.z
      
      // Size pulses with glow
      sizes[i] = (2.5 + bands.subBassSmooth * 3 + bands.bassSmooth * 2) * glowPulse * audioGlow
      
      // Colors - sub-bass embers are deeper red, bass embers more orange
      let emberHue = warmHue * 0.5 + ember.hue * 0.5
      switch (ember.frequencyResponse) {
        case 'subBass':
          emberHue -= 0.02  // Deeper red
          break
        case 'lowMid':
          emberHue += 0.02  // More orange
          break
      }
      
      const emberLight = 0.3 + glowPulse * 0.25 + freqGlow * 0.2 + crackleGlow * 0.3 + bands.beatIntensity * 0.1
      const [r, g, b] = hslToRgb(emberHue, 0.95, emberLight)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    
    // ================================================================
    // FLAME TONGUES - Each responds to its assigned frequency band
    // ================================================================
    
    for (let i = 0; i < FLAME_TONGUE_PARTICLES; i++) {
      const idx = EMBER_BED_PARTICLES + i
      const flame = flames[i]
      const tongue = tongues[flame.tongueIndex]
      
      // Get frequency value for this tongue
      const freqValue = getFrequencyValue(bands, tongue.frequencyBand)
      
      // Speed influenced by assigned frequency band
      const freqSpeed = 1 + freqValue * 0.4
      
      // Animate height within tongue
      flame.heightInTongue += dt * flame.speed * intensity * freqSpeed
      if (flame.heightInTongue > 1) {
        flame.heightInTongue = 0
        flame.x = tongue.x + (Math.random() - 0.5) * tongue.width
        flame.baseX = tongue.x
      }
      
      // Flame shape: wider at base, narrower at top
      const taperFactor = 1 - flame.heightInTongue * 0.7
      
      // Wavy motion - high frequencies create more turbulence
      const turbulence = bands.highMidSmooth * 0.5 + bands.trebleSmooth * 0.3
      const waveAmount = flame.heightInTongue * tongue.swayAmount * (1 + turbulence)
      const wave = Math.sin(time * 3 + flame.phase + flame.heightInTongue * 4) * waveAmount
      const secondaryWave = Math.sin(time * 5 + flame.phase * 2) * waveAmount * 0.3
      
      // Tongue curl at top - enhanced by mid frequencies
      const curlIntensity = 1 + bands.midSmooth * 0.5
      const curlX = flame.heightInTongue > 0.7 
        ? Math.sin(time * 4 + flame.phase) * (flame.heightInTongue - 0.7) * 8 * curlIntensity
        : 0
      
      // Stereo balance affects flame direction at top
      const stereoSway = flame.heightInTongue * bands.stereoBalance * 3
      
      const x = tongue.x + (flame.x - flame.baseX) * taperFactor + wave + secondaryWave + curlX + windX + stereoSway
      const y = FLAME_BASE_HEIGHT + flame.heightInTongue * tongue.height
      const z = flame.z + Math.sin(time * 2 + flame.phase) * (bands.midSmooth + bands.lowMidSmooth) * 2
      
      positions[idx * 3] = x
      positions[idx * 3 + 1] = y
      positions[idx * 3 + 2] = z
      
      // Size: larger at base, smaller at tip, pulse with frequency
      const heightFade = 1 - flame.heightInTongue * 0.6
      const freqSize = freqValue * 2
      sizes[idx] = (3 + bands.bassSmooth * 3 + freqSize + bands.beatIntensity * 2) * heightFade
      
      // Color: hotter (yellow/white) at base, cooler (red/orange) at top
      // Higher frequency tongues are slightly more yellow
      const temperatureShift = flame.heightInTongue * 0.08
      const freqTempBoost = tongue.frequencyBand * 0.01
      const flameHue = tongue.hue - temperatureShift + warmHue * 0.3 + freqTempBoost
      const flameSat = 0.9 - flame.heightInTongue * 0.1
      const flameLight = 0.55 - flame.heightInTongue * 0.15 + freqValue * 0.08 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(Math.max(0, flameHue), flameSat, flameLight)
      colors[idx * 3] = r * heightFade + (1 - heightFade) * 0.2
      colors[idx * 3 + 1] = g * heightFade
      colors[idx * 3 + 2] = b * heightFade * 0.5
    }
    
    // ================================================================
    // RISING SPARKS - Triggered by high frequencies
    // ================================================================
    
    for (let i = 0; i < RISING_SPARK_PARTICLES; i++) {
      const idx = EMBER_BED_PARTICLES + FLAME_TONGUE_PARTICLES + i
      const spark = sparks[i]
      
      // Get frequency value for this spark's trigger
      let triggerValue = 0
      switch (spark.frequencyTrigger) {
        case 'highMid':
          triggerValue = bands.highMidSmooth
          break
        case 'treble':
          triggerValue = bands.trebleSmooth
          break
        case 'brilliance':
          triggerValue = bands.brillianceSmooth
          break
      }
      
      // Physics - higher frequencies create more erratic movement
      const erraticness = triggerValue * 0.5
      spark.vy += 0.015 * intensity * (1 + triggerValue * 0.5)
      spark.vx += windX * 0.008 + (Math.random() - 0.5) * 0.05 * (1 + erraticness)
      spark.vz += (Math.random() - 0.5) * 0.03 * (1 + erraticness)
      
      spark.x += spark.vx * dt * 60
      spark.y += spark.vy * dt * 60
      spark.z += spark.vz * dt * 60
      
      spark.vx *= 0.99
      spark.vz *= 0.98
      
      spark.life -= dt / spark.maxLife
      
      // Respawn dead sparks - more spawns when high frequencies are active
      const spawnChance = 0.3 + triggerValue * 0.7
      if ((spark.life <= 0 || spark.y > FLAME_MAX_HEIGHT + 15) && Math.random() < spawnChance) {
        const sourceTongue = tongues[Math.floor(Math.random() * NUM_TONGUES)]
        const newSpark = spawnSpark(bands, sourceTongue.x, spark.frequencyTrigger)
        Object.assign(spark, newSpark)
      }
      
      positions[idx * 3] = spark.x
      positions[idx * 3 + 1] = spark.y
      positions[idx * 3 + 2] = spark.z
      
      // Size fades with life, boosted by trigger frequency
      const lifeFactor = spark.life * spark.life
      sizes[idx] = spark.size * lifeFactor * intensity * (1 + triggerValue * 0.5)
      
      // Spark colors: bright yellow-orange fading to red
      // Brilliance sparks are more white, treble are yellow, highMid are orange
      let sparkHueOffset = 0
      switch (spark.frequencyTrigger) {
        case 'brilliance':
          sparkHueOffset = 0.04  // More yellow/white
          break
        case 'treble':
          sparkHueOffset = 0.02
          break
        case 'highMid':
          sparkHueOffset = 0
          break
      }
      
      const sparkHue = warmHue + spark.hue + sparkHueOffset - (1 - spark.life) * 0.03
      const sparkLight = 0.5 + spark.life * 0.3 + triggerValue * 0.1
      
      const [r, g, b] = hslToRgb(sparkHue, 0.9, sparkLight)
      colors[idx * 3] = r * lifeFactor + (1 - lifeFactor) * 0.15
      colors[idx * 3 + 1] = g * lifeFactor * 0.8
      colors[idx * 3 + 2] = b * lifeFactor * 0.3
    }
    
    // Hide unused particles
    const usedParticles = EMBER_BED_PARTICLES + FLAME_TONGUE_PARTICLES + RISING_SPARK_PARTICLES
    for (let i = usedParticles; i < count; i++) {
      positions[i * 3 + 1] = -100
      sizes[i] = 0
    }
  }
}
