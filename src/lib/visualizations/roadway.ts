import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// ROADWAY CONFIGURATION - Driving down a road perspective
// ============================================================================

// Grid spans the full viewport height, road flows from top to bottom
const GRID_WIDTH = 50       // Road width (X axis)
const GRID_DEPTH = 60       // Road length (Z axis) - extends from top to bottom
const CELL_SIZE = 2.5       // Size of each cell
const ROAD_HEIGHT_BASE = 0  // Base elevation

// View zones - middle third is where the action happens
const VIEW_ZONE_NEAR = 0.33   // Near edge of view zone (top third)
const VIEW_ZONE_FAR = 0.67    // Far edge of view zone (bottom third)

// Motion parameters
const BASE_SPEED = 8          // Base forward movement speed
const MAX_SPEED_BOOST = 12    // Additional speed from bass

// Visual intensity zones
const INTENSITY_NEAR = 0.3    // Visual intensity in near zone (faded)
const INTENSITY_VIEW = 1.0    // Visual intensity in view zone (full)
const INTENSITY_FAR = 0.2     // Visual intensity in far zone (faded)

// ============================================================================
// STATE
// ============================================================================

const terrainHeights: number[][] = []
const targetHeights: number[][] = []
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null
let currentGradient = builtInGradients.synthwave

// Smooth camera motion
let currentCameraY = 0
let currentSpeed = BASE_SPEED

// ============================================================================
// FREQUENCY MAPPING FOR ROAD LANES
// ============================================================================

/**
 * Maps road position (left to right) to frequency bands
 * Creates a stereo-like effect where different frequencies appear in different lanes
 */
function getFrequencyForLane(x: number, bands: AudioBands): number {
  const normalizedX = x / (GRID_WIDTH - 1)  // 0 (left) to 1 (right)
  
  // Center lane gets bass, outer lanes get higher frequencies
  const distFromCenter = Math.abs(normalizedX - 0.5) * 2  // 0 (center) to 1 (edge)
  
  if (distFromCenter < 0.2) {
    // Center lanes: bass and sub-bass
    return (bands.bassSmooth + bands.subBassSmooth) * 0.5
  } else if (distFromCenter < 0.4) {
    // Inner lanes: low-mid
    const t = (distFromCenter - 0.2) / 0.2
    return bands.bassSmooth * (1 - t) + bands.lowMidSmooth * t
  } else if (distFromCenter < 0.6) {
    // Mid lanes: mid frequencies
    const t = (distFromCenter - 0.4) / 0.2
    return bands.lowMidSmooth * (1 - t) + bands.midSmooth * t
  } else if (distFromCenter < 0.8) {
    // Outer lanes: high-mid
    const t = (distFromCenter - 0.6) / 0.2
    return bands.midSmooth * (1 - t) + bands.highMidSmooth * t
  } else {
    // Edge lanes: treble and brilliance
    const t = (distFromCenter - 0.8) / 0.2
    return bands.highMidSmooth * (1 - t) + bands.trebleSmooth * t
  }
}

/**
 * Calculate visual intensity based on depth zone
 * Middle third is brightest (the "view" zone)
 */
function getZoneIntensity(z: number): number {
  const normalizedZ = z / GRID_DEPTH
  
  if (normalizedZ < VIEW_ZONE_NEAR) {
    // Near zone (top third) - fade in
    return INTENSITY_NEAR + (INTENSITY_VIEW - INTENSITY_NEAR) * (normalizedZ / VIEW_ZONE_NEAR)
  } else if (normalizedZ < VIEW_ZONE_FAR) {
    // View zone (middle third) - full intensity
    return INTENSITY_VIEW
  } else {
    // Far zone (bottom third) - fade out toward horizon
    const farProgress = (normalizedZ - VIEW_ZONE_FAR) / (1 - VIEW_ZONE_FAR)
    return INTENSITY_VIEW - (INTENSITY_VIEW - INTENSITY_FAR) * farProgress
  }
}

/**
 * Get perspective scale - road narrows toward horizon
 */
function getPerspectiveScale(z: number): number {
  const normalizedZ = z / GRID_DEPTH
  return 1 - normalizedZ * 0.7  // Road narrows to 30% width at horizon
}

/**
 * Get perspective Y - road rises toward horizon
 */
function getPerspectiveY(baseY: number, z: number): number {
  const normalizedZ = z / GRID_DEPTH
  const horizonLift = Math.pow(normalizedZ, 1.8) * 25  // Gentle curve upward
  return baseY + horizonLift + currentCameraY
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initRoadway() {
  terrainHeights.length = 0
  targetHeights.length = 0
  
  for (let z = 0; z < GRID_DEPTH; z++) {
    terrainHeights[z] = []
    targetHeights[z] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      terrainHeights[z][x] = 0
      targetHeights[z][x] = 0
    }
  }
}

// ============================================================================
// VISUALIZATION MODE EXPORT
// ============================================================================

export const roadway: VisualizationMode = {
  id: 'roadway',
  name: 'Roadway',
  description: 'Drive down an endless audio-reactive highway with frequency-mapped lanes',
  
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initRoadway()
    currentCameraY = 0
    currentSpeed = BASE_SPEED
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -100
      positions[i * 3 + 2] = 0
      colors[i * 3] = 0
      colors[i * 3 + 1] = 0
      colors[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    initRoadway()
    
    const horizontalSegments = (GRID_WIDTH - 1) * GRID_DEPTH
    const verticalSegments = (GRID_DEPTH - 1) * GRID_WIDTH
    const totalSegments = horizontalSegments + verticalSegments
    const vertexCount = totalSegments * 2
    
    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 3)
    
    lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    })
    
    lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)
    
    return {
      objects: [lineSegments],
      update: (bands: AudioBands, time: number) => {
        if (!lineGeometry) return
        
        const cycleHue = getCyclingHue(time)
        const posAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
        const colAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array
        const col = colAttr.array as Float32Array
        
        const halfWidth = (GRID_WIDTH - 1) * CELL_SIZE / 2
        
        // ================================================================
        // AUDIO-REACTIVE CAMERA & SPEED
        // ================================================================
        
        // Bass controls speed - more bass = faster movement
        const targetSpeed = BASE_SPEED + bands.bassSmooth * MAX_SPEED_BOOST + bands.beatIntensity * 6
        currentSpeed += (targetSpeed - currentSpeed) * 0.1
        
        // Overall energy creates camera shake/bounce
        const targetCameraY = Math.sin(time * 3) * bands.midSmooth * 2 + bands.beatIntensity * 3
        currentCameraY += (targetCameraY - currentCameraY) * 0.08
        
        // Forward motion offset (road scrolling)
        const scrollOffset = (time * currentSpeed) % CELL_SIZE
        
        // ================================================================
        // UPDATE TERRAIN HEIGHTS
        // ================================================================
        
        for (let z = 0; z < GRID_DEPTH; z++) {
          const zoneIntensity = getZoneIntensity(z)
          const normalizedZ = z / GRID_DEPTH
          
          for (let x = 0; x < GRID_WIDTH; x++) {
            // Get frequency for this lane
            const freqValue = getFrequencyForLane(x, bands)
            
            // Base height from frequency
            let height = freqValue * 12 * zoneIntensity
            
            // Traveling waves down the road
            const travelWave = Math.sin(z * 0.2 - time * 4) * bands.midSmooth * 5 * zoneIntensity
            height += travelWave
            
            // Beat pulse creates expanding rings from center
            const distFromCenter = Math.abs(x - GRID_WIDTH / 2)
            const beatRing = Math.sin((distFromCenter * 0.3 + z * 0.15) - time * 8) * bands.beatIntensity * 8 * zoneIntensity
            height += beatRing
            
            // Lane markers (brighter spots along certain columns)
            if (x % 8 === 0 || x % 8 === 7) {
              height += bands.highSmooth * 3 * zoneIntensity
            }
            
            // Center line emphasis
            if (Math.abs(x - GRID_WIDTH / 2) < 2) {
              height += bands.bassSmooth * 4 * zoneIntensity
            }
            
            // Stereo balance creates asymmetry
            const stereoEffect = bands.stereoBalance * (x - GRID_WIDTH / 2) / GRID_WIDTH * 8
            height += stereoEffect * zoneIntensity
            
            // High frequency sparkles in the view zone
            if (normalizedZ > VIEW_ZONE_NEAR && normalizedZ < VIEW_ZONE_FAR) {
              if (Math.random() < 0.005 && bands.brillianceSmooth > 0.4) {
                height += bands.brillianceSmooth * 12
              }
            }
            
            // Quantize for angular retro look
            height = Math.round(height * 2) / 2
            
            // Smooth interpolation
            targetHeights[z][x] = height
            terrainHeights[z][x] += (targetHeights[z][x] - terrainHeights[z][x]) * 0.15
          }
        }
        
        // ================================================================
        // RENDER GRID
        // ================================================================
        
        let vertexIndex = 0
        
        // Horizontal lines (across the road)
        for (let z = 0; z < GRID_DEPTH; z++) {
          const zPos = z * CELL_SIZE - scrollOffset
          const perspScale = getPerspectiveScale(z)
          const zoneIntensity = getZoneIntensity(z)
          
          for (let x = 0; x < GRID_WIDTH - 1; x++) {
            const x1World = (x * CELL_SIZE - halfWidth) * perspScale
            const x2World = ((x + 1) * CELL_SIZE - halfWidth) * perspScale
            
            const height1 = terrainHeights[z][x]
            const height2 = terrainHeights[z][x + 1]
            
            const y1 = getPerspectiveY(ROAD_HEIGHT_BASE + height1, z)
            const y2 = getPerspectiveY(ROAD_HEIGHT_BASE + height2, z)
            
            pos[vertexIndex * 3] = x1World
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -zPos
            
            pos[(vertexIndex + 1) * 3] = x2World
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -zPos
            
            // Color based on lane position and zone
            const lanePosition = x / (GRID_WIDTH - 1)
            const gradientPos = lanePosition + cycleHue * 0.3
            const [r, g, b] = sampleGradient(currentGradient, gradientPos)
            
            const avgHeight = (height1 + height2) / 2
            const heightIntensity = Math.min(1, Math.abs(avgHeight) / 15)
            const brightness = (0.3 + heightIntensity * 0.5 + bands.beatIntensity * 0.2) * zoneIntensity
            
            col[vertexIndex * 3] = r * brightness
            col[vertexIndex * 3 + 1] = g * brightness
            col[vertexIndex * 3 + 2] = b * brightness
            col[(vertexIndex + 1) * 3] = r * brightness
            col[(vertexIndex + 1) * 3 + 1] = g * brightness
            col[(vertexIndex + 1) * 3 + 2] = b * brightness
            
            vertexIndex += 2
          }
        }
        
        // Vertical lines (down the road)
        for (let x = 0; x < GRID_WIDTH; x++) {
          const lanePosition = x / (GRID_WIDTH - 1)
          
          for (let z = 0; z < GRID_DEPTH - 1; z++) {
            const z1Pos = z * CELL_SIZE - scrollOffset
            const z2Pos = (z + 1) * CELL_SIZE - scrollOffset
            
            const perspScale1 = getPerspectiveScale(z)
            const perspScale2 = getPerspectiveScale(z + 1)
            
            const xWorld1 = (x * CELL_SIZE - halfWidth) * perspScale1
            const xWorld2 = (x * CELL_SIZE - halfWidth) * perspScale2
            
            const height1 = terrainHeights[z][x]
            const height2 = terrainHeights[z + 1][x]
            
            const y1 = getPerspectiveY(ROAD_HEIGHT_BASE + height1, z)
            const y2 = getPerspectiveY(ROAD_HEIGHT_BASE + height2, z + 1)
            
            pos[vertexIndex * 3] = xWorld1
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -z1Pos
            
            pos[(vertexIndex + 1) * 3] = xWorld2
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -z2Pos
            
            const zoneIntensity = (getZoneIntensity(z) + getZoneIntensity(z + 1)) / 2
            const gradientPos = lanePosition + cycleHue * 0.3 + 0.15
            const [r, g, b] = sampleGradient(currentGradient, gradientPos)
            
            const avgHeight = (height1 + height2) / 2
            const heightIntensity = Math.min(1, Math.abs(avgHeight) / 15)
            const brightness = (0.25 + heightIntensity * 0.4 + bands.beatIntensity * 0.15) * zoneIntensity
            
            col[vertexIndex * 3] = r * brightness
            col[vertexIndex * 3 + 1] = g * brightness
            col[vertexIndex * 3 + 2] = b * brightness
            col[(vertexIndex + 1) * 3] = r * brightness
            col[(vertexIndex + 1) * 3 + 1] = g * brightness
            col[(vertexIndex + 1) * 3 + 2] = b * brightness
            
            vertexIndex += 2
          }
        }
        
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      },
      dispose: () => {
        if (lineGeometry) lineGeometry.dispose()
        if (lineMaterial) lineMaterial.dispose()
        if (lineSegments) scene.remove(lineSegments)
        lineGeometry = null
        lineMaterial = null
        lineSegments = null
      }
    }
  },

  animate(
    positions: Float32Array,
    _originalPositions: Float32Array,
    sizes: Float32Array,
    _colors: Float32Array,
    count: number,
    _bands: AudioBands,
    _time: number
  ) {
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] = -100
      sizes[i] = 0
    }
  }
}

/** Set gradient for roadway */
export function setRoadwayGradient(gradient: typeof currentGradient) {
  currentGradient = gradient
}
