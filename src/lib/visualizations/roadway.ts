import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// ROADWAY CONFIGURATION - Full-screen driving perspective
// ============================================================================

// Extends from very top to very bottom of screen
const GRID_WIDTH = 50       // Road width (X axis)
const GRID_DEPTH = 100      // Road length (Z axis) - extended to fill entire screen
const CELL_SIZE = 1.6       // Smaller cells for smoother coverage
const ROAD_HEIGHT_BASE = -25 // Much lower to start from bottom of view

// View zones - entire screen is active
const VIEW_ZONE_NEAR = 0.15   // Very top
const VIEW_ZONE_FAR = 0.85    // Very bottom

// Motion parameters
const BASE_SPEED = 8
const MAX_SPEED_BOOST = 12

// Visual intensity - more even across entire screen
const INTENSITY_NEAR = 0.7
const INTENSITY_VIEW = 1.0
const INTENSITY_FAR = 0.5

// ============================================================================
// STATE
// ============================================================================

const terrainHeights: number[][] = []
const targetHeights: number[][] = []
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null
let currentGradient = builtInGradients.synthwave

let currentCameraY = 0
let currentSpeed = BASE_SPEED

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFrequencyForLane(x: number, bands: AudioBands): number {
  const normalizedX = x / (GRID_WIDTH - 1)
  const distFromCenter = Math.abs(normalizedX - 0.5) * 2
  
  if (distFromCenter < 0.2) return (bands.bassSmooth + bands.subBassSmooth) * 0.5
  else if (distFromCenter < 0.4) {
    const t = (distFromCenter - 0.2) / 0.2
    return bands.bassSmooth * (1 - t) + bands.lowMidSmooth * t
  } else if (distFromCenter < 0.6) {
    const t = (distFromCenter - 0.4) / 0.2
    return bands.lowMidSmooth * (1 - t) + bands.midSmooth * t
  } else if (distFromCenter < 0.8) {
    const t = (distFromCenter - 0.6) / 0.2
    return bands.midSmooth * (1 - t) + bands.highMidSmooth * t
  } else {
    const t = (distFromCenter - 0.8) / 0.2
    return bands.highMidSmooth * (1 - t) + bands.trebleSmooth * t
  }
}

function getZoneIntensity(z: number): number {
  const normalizedZ = z / GRID_DEPTH
  
  if (normalizedZ < VIEW_ZONE_NEAR) {
    return INTENSITY_NEAR + (INTENSITY_VIEW - INTENSITY_NEAR) * (normalizedZ / VIEW_ZONE_NEAR)
  } else if (normalizedZ < VIEW_ZONE_FAR) {
    return INTENSITY_VIEW
  } else {
    const farProgress = (normalizedZ - VIEW_ZONE_FAR) / (1 - VIEW_ZONE_FAR)
    return INTENSITY_VIEW - (INTENSITY_VIEW - INTENSITY_FAR) * farProgress
  }
}

function getPerspectiveScale(z: number): number {
  const normalizedZ = z / GRID_DEPTH
  return 1 - normalizedZ * 0.3  // Very gentle narrowing
}

function getPerspectiveY(baseY: number, z: number): number {
  const normalizedZ = z / GRID_DEPTH
  // Extended vertical range to fill screen top to bottom
  const horizonLift = Math.pow(normalizedZ, 2.8) * 55
  return baseY + horizonLift + currentCameraY
}

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
// VISUALIZATION EXPORT
// ============================================================================

export const roadway: VisualizationMode = {
  id: 'roadway',
  name: 'Roadway',
  description: 'Drive down an endless audio-reactive highway filling the entire screen',
  
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
        
        const targetSpeed = BASE_SPEED + bands.bassSmooth * MAX_SPEED_BOOST + bands.beatIntensity * 6
        currentSpeed += (targetSpeed - currentSpeed) * 0.1
        
        const targetCameraY = Math.sin(time * 3) * bands.midSmooth * 2 + bands.beatIntensity * 3
        currentCameraY += (targetCameraY - currentCameraY) * 0.08
        
        const scrollOffset = (time * currentSpeed) % CELL_SIZE
        
        for (let z = 0; z < GRID_DEPTH; z++) {
          const zoneIntensity = getZoneIntensity(z)
          const normalizedZ = z / GRID_DEPTH
          
          for (let x = 0; x < GRID_WIDTH; x++) {
            const freqValue = getFrequencyForLane(x, bands)
            let height = freqValue * 12 * zoneIntensity
            
            const travelWave = Math.sin(z * 0.2 - time * 4) * bands.midSmooth * 5 * zoneIntensity
            height += travelWave
            
            const distFromCenter = Math.abs(x - GRID_WIDTH / 2)
            const beatRing = Math.sin((distFromCenter * 0.3 + z * 0.15) - time * 8) * bands.beatIntensity * 8 * zoneIntensity
            height += beatRing
            
            if (x % 8 === 0 || x % 8 === 7) height += bands.highSmooth * 3 * zoneIntensity
            if (Math.abs(x - GRID_WIDTH / 2) < 2) height += bands.bassSmooth * 4 * zoneIntensity
            
            const stereoEffect = bands.stereoBalance * (x - GRID_WIDTH / 2) / GRID_WIDTH * 8
            height += stereoEffect * zoneIntensity
            
            if (normalizedZ > VIEW_ZONE_NEAR && normalizedZ < VIEW_ZONE_FAR) {
              if (Math.random() < 0.005 && bands.brillianceSmooth > 0.4) {
                height += bands.brillianceSmooth * 12
              }
            }
            
            height = Math.round(height * 2) / 2
            targetHeights[z][x] = height
            terrainHeights[z][x] += (targetHeights[z][x] - terrainHeights[z][x]) * 0.15
          }
        }
        
        let vertexIndex = 0
        
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

export function setRoadwayGradient(gradient: typeof currentGradient) {
  currentGradient = gradient
}
