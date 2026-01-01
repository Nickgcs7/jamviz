import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

// Flame configuration
const EMBER_BED_PARTICLES = 2000
const FLAME_TONGUE_PARTICLES = 6000
const RISING_SPARK_PARTICLES = 2000

// Screen proportions
const FLAME_WIDTH = 50          // Total width of fire
const EMBER_BED_HEIGHT = -18    // Bottom of ember bed
const FLAME_BASE_HEIGHT = -15   // Where flames start
const FLAME_MAX_HEIGHT = 25     // Maximum flame height
const TONGUE_CENTER_ZONE = 0.33 // Middle third for main tongues

interface EmberParticle {
  x: number
  y: number
  z: number
  baseX: number
  glowPhase: number
  glowSpeed: number
  hue: number
}

interface FlameParticle {
  x: number
  y: number
  z: number
  baseX: number
  tongueIndex: number
  heightInTongue: number  // 0-1, position within the tongue
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
}

const embers: EmberParticle[] = []
const flames: FlameParticle[] = []
const sparks: SparkParticle[] = []

// Number of distinct flame tongues
const NUM_TONGUES = 12

interface FlameTongue {
  x: number
  width: number
  height: number
  targetHeight: number
  phase: number
  swayAmount: number
  hue: number
}

const tongues: FlameTongue[] = []

function initTongues() {
  tongues.length = 0
  
  for (let t = 0; t < NUM_TONGUES; t++) {
    // Distribute tongues across the middle third primarily, with some on edges
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
    
    tongues.push({
      x,
      width: isCenterTongue ? 6 + Math.random() * 4 : 3 + Math.random() * 3,
      height: isCenterTongue ? 25 + Math.random() * 10 : 12 + Math.random() * 8,
      targetHeight: 20,
      phase: Math.random() * Math.PI * 2,
      swayAmount: 0.8 + Math.random() * 0.6,
      hue: 0.04 + Math.random() * 0.06 // Orange-red range
    })
  }
}

function spawnSpark(bands: AudioBands, sourceX: number): SparkParticle {
  const intensity = 0.5 + bands.overallSmooth * 0.5 + bands.beatIntensity * 0.5
  
  return {
    x: sourceX + (Math.random() - 0.5) * 8,
    y: FLAME_BASE_HEIGHT + Math.random() * 10,
    z: (Math.random() - 0.5) * 6,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (1.5 + Math.random() * 2) * intensity,
    vz: (Math.random() - 0.5) * 0.8,
    life: 1.0,
    maxLife: 1.5 + Math.random() * 2,
    size: 1 + Math.random() * 1.5 + bands.beatIntensity * 1.5,
    hue: 0.05 + Math.random() * 0.07
  }
}

// Warm color cycling for fire (limited to reds, oranges, yellows)
function getWarmCyclingHue(time: number): number {
  // Cycle slowly between red (0.0), orange (0.08), and yellow (0.12)
  const cycle = Math.sin(time * 0.15) * 0.5 + 0.5 // 0-1
  return 0.0 + cycle * 0.12 // Ranges from red to yellow
}

export const yuleLog: VisualizationMode = {
  id: 'yule_log',
  name: 'Yule Log',
  description: 'Warm flickering fireplace with flame tongues',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    embers.length = 0
    flames.length = 0
    sparks.length = 0
    
    initTongues()
    
    // Initialize ember bed particles
    for (let i = 0; i < EMBER_BED_PARTICLES; i++) {
      const x = (Math.random() - 0.5) * FLAME_WIDTH
      embers.push({
        x,
        y: EMBER_BED_HEIGHT + Math.random() * 4,
        z: (Math.random() - 0.5) * 8,
        baseX: x,
        glowPhase: Math.random() * Math.PI * 2,
        glowSpeed: 0.5 + Math.random() * 1.5,
        hue: 0.02 + Math.random() * 0.06 // Deep red to orange
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
    
    // Initialize spark particles
    const defaultBands: AudioBands = {
      bass: 0, mid: 0, high: 0, overall: 0,
      bassSmooth: 0, midSmooth: 0, highSmooth: 0, overallSmooth: 0.3,
      isBeat: false, beatIntensity: 0
    }
    
    for (let i = 0; i < RISING_SPARK_PARTICLES; i++) {
      const spark = spawnSpark(defaultBands, (Math.random() - 0.5) * FLAME_WIDTH * 0.5)
      spark.life = Math.random() // Spread initial lifetimes
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

      // Warm fire colors
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
    const windX = Math.sin(time * 0.7) * 0.4 * (1 + bands.midSmooth)
    
    // Update tongue targets based on audio
    for (let t = 0; t < tongues.length; t++) {
      const tongue = tongues[t]
      const isCenterTongue = t >= 3 && t <= 8
      
      const baseHeight = isCenterTongue ? 25 : 12
      const audioBoost = bands.bassSmooth * 15 + bands.beatIntensity * 10
      const pulseHeight = Math.sin(time * 1.5 + tongue.phase) * 5
      
      tongue.targetHeight = baseHeight + audioBoost + pulseHeight
      tongue.height += (tongue.targetHeight - tongue.height) * 0.1
      
      // Hue shifts with warm cycling
      tongue.hue = warmHue + (t / tongues.length) * 0.04 + bands.bassSmooth * 0.02
    }
    
    // === EMBER BED ===
    for (let i = 0; i < EMBER_BED_PARTICLES; i++) {
      const ember = embers[i]
      
      // Gentle glow pulsing
      const glowPulse = Math.sin(time * ember.glowSpeed + ember.glowPhase) * 0.3 + 0.7
      const audioGlow = 1 + bands.bassSmooth * 0.5 + bands.beatIntensity * 0.3
      
      // Slight position wobble
      const wobbleX = Math.sin(time * 0.8 + ember.glowPhase) * 0.3
      const wobbleY = Math.sin(time * 1.2 + ember.glowPhase * 1.3) * 0.2
      
      positions[i * 3] = ember.baseX + wobbleX + windX * 0.2
      positions[i * 3 + 1] = ember.y + wobbleY
      positions[i * 3 + 2] = ember.z
      
      // Size pulses with glow
      sizes[i] = (2.5 + bands.bassSmooth * 2) * glowPulse * audioGlow
      
      // Deep red/orange colors for embers
      const emberHue = warmHue * 0.5 + ember.hue * 0.5 // More red than flames
      const emberLight = 0.3 + glowPulse * 0.25 + bands.beatIntensity * 0.1
      const [r, g, b] = hslToRgb(emberHue, 0.95, emberLight)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    
    // === FLAME TONGUES ===
    for (let i = 0; i < FLAME_TONGUE_PARTICLES; i++) {
      const idx = EMBER_BED_PARTICLES + i
      const flame = flames[i]
      const tongue = tongues[flame.tongueIndex]
      
      // Animate height within tongue
      flame.heightInTongue += dt * flame.speed * intensity
      if (flame.heightInTongue > 1) {
        flame.heightInTongue = 0
        // Reset horizontal position
        flame.x = tongue.x + (Math.random() - 0.5) * tongue.width
        flame.baseX = tongue.x
      }
      
      // Flame shape: wider at base, narrower at top
      const taperFactor = 1 - flame.heightInTongue * 0.7
      
      // Wavy motion (more at top)
      const waveAmount = flame.heightInTongue * tongue.swayAmount * (1 + bands.highSmooth)
      const wave = Math.sin(time * 3 + flame.phase + flame.heightInTongue * 4) * waveAmount
      const secondaryWave = Math.sin(time * 5 + flame.phase * 2) * waveAmount * 0.3
      
      // Tongue curl at top
      const curlX = flame.heightInTongue > 0.7 
        ? Math.sin(time * 4 + flame.phase) * (flame.heightInTongue - 0.7) * 8
        : 0
      
      const x = tongue.x + (flame.x - flame.baseX) * taperFactor + wave + secondaryWave + curlX + windX
      const y = FLAME_BASE_HEIGHT + flame.heightInTongue * tongue.height
      const z = flame.z + Math.sin(time * 2 + flame.phase) * bands.midSmooth * 2
      
      positions[idx * 3] = x
      positions[idx * 3 + 1] = y
      positions[idx * 3 + 2] = z
      
      // Size: larger at base, smaller at tip
      const heightFade = 1 - flame.heightInTongue * 0.6
      sizes[idx] = (3 + bands.bassSmooth * 3 + bands.beatIntensity * 2) * heightFade
      
      // Color: hotter (yellow/white) at base, cooler (red/orange) at top
      const temperatureShift = flame.heightInTongue * 0.08 // Shift toward red as it rises
      const flameHue = tongue.hue - temperatureShift + warmHue * 0.3
      const flameSat = 0.9 - flame.heightInTongue * 0.1
      const flameLight = 0.55 - flame.heightInTongue * 0.15 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(Math.max(0, flameHue), flameSat, flameLight)
      colors[idx * 3] = r * heightFade + (1 - heightFade) * 0.2
      colors[idx * 3 + 1] = g * heightFade
      colors[idx * 3 + 2] = b * heightFade * 0.5
    }
    
    // === RISING SPARKS ===
    for (let i = 0; i < RISING_SPARK_PARTICLES; i++) {
      const idx = EMBER_BED_PARTICLES + FLAME_TONGUE_PARTICLES + i
      const spark = sparks[i]
      
      // Physics
      spark.vy += 0.015 * intensity
      spark.vx += windX * 0.008 + (Math.random() - 0.5) * 0.05 * bands.highSmooth
      spark.vz += (Math.random() - 0.5) * 0.03
      
      spark.x += spark.vx * dt * 60
      spark.y += spark.vy * dt * 60
      spark.z += spark.vz * dt * 60
      
      spark.vx *= 0.99
      spark.vz *= 0.98
      
      spark.life -= dt / spark.maxLife
      
      // Respawn dead sparks
      if (spark.life <= 0 || spark.y > FLAME_MAX_HEIGHT + 15) {
        // Spawn from a random tongue
        const sourceTongue = tongues[Math.floor(Math.random() * NUM_TONGUES)]
        const newSpark = spawnSpark(bands, sourceTongue.x)
        Object.assign(spark, newSpark)
      }
      
      positions[idx * 3] = spark.x
      positions[idx * 3 + 1] = spark.y
      positions[idx * 3 + 2] = spark.z
      
      // Size fades with life
      const lifeFactor = spark.life * spark.life
      sizes[idx] = spark.size * lifeFactor * intensity
      
      // Spark colors: bright yellow-orange fading to red
      const sparkHue = warmHue + spark.hue - (1 - spark.life) * 0.03
      const sparkLight = 0.5 + spark.life * 0.3
      
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
