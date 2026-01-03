import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// CONFIGURATION
// ============================================================================

// Grid configuration
const GRID_WIDTH = 40      // Columns (X axis) - increased for frequency mapping
const GRID_DEPTH = 48      // Rows (Z axis) - more depth for perspective
const CELL_SIZE = 2.2      // Size of each grid cell
const HORIZON_Y = 15       // Vanishing point height

// Audio-reactive perspective
const BASE_FOV_FACTOR = 1.0
const MAX_FOV_INCREASE = 0.4  // How much FOV increases with bass

// Visualization modes
type TerrainMode = 'linear' | 'radial'

// ============================================================================
// STATE
// ============================================================================

// Store terrain heights for smooth animation
const terrainHeights: number[][] = []
const targetHeights: number[][] = []

// Line geometry references
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null

// Configuration state
let currentMode: TerrainMode = 'linear'
let currentGradient = builtInGradients.synthwave

// Perspective state (smoothed)
let currentPerspectiveFactor = BASE_FOV_FACTOR
let currentHorizonOffset = 0

// ============================================================================
// FREQUENCY BAND MAPPING
// ============================================================================

/**
 * Maps grid columns to frequency bands
 * Creates a more musical visualization where left = low freq, right = high freq
 */
function getFrequencyForColumn(col: number, bands: AudioBands): number {
  const normalizedCol = col / (GRID_WIDTH - 1)  // 0-1
  
  // Map columns to 7 frequency bands with smooth interpolation
  // Left side: sub-bass/bass, Center: mids, Right side: highs
  
  if (normalizedCol < 0.1) {
    // Sub-bass (leftmost 10%)
    return bands.subBassSmooth * 1.3
  } else if (normalizedCol < 0.25) {
    // Bass (10-25%)
    const t = (normalizedCol - 0.1) / 0.15
    return bands.subBassSmooth * (1 - t) + bands.bassSmooth * t
  } else if (normalizedCol < 0.4) {
    // Low-mid (25-40%)
    const t = (normalizedCol - 0.25) / 0.15
    return bands.bassSmooth * (1 - t) + bands.lowMidSmooth * t
  } else if (normalizedCol < 0.55) {
    // Mid (40-55%)
    const t = (normalizedCol - 0.4) / 0.15
    return bands.lowMidSmooth * (1 - t) + bands.midSmooth * t
  } else if (normalizedCol < 0.7) {
    // High-mid (55-70%)
    const t = (normalizedCol - 0.55) / 0.15
    return bands.midSmooth * (1 - t) + bands.highMidSmooth * t
  } else if (normalizedCol < 0.85) {
    // Treble (70-85%)
    const t = (normalizedCol - 0.7) / 0.15
    return bands.highMidSmooth * (1 - t) + bands.trebleSmooth * t
  } else {
    // Brilliance (rightmost 15%)
    const t = (normalizedCol - 0.85) / 0.15
    return bands.trebleSmooth * (1 - t) + bands.brillianceSmooth * t
  }
}

/**
 * Get frequency band index for a column (for gradient coloring)
 */
function getFrequencyBandIndex(col: number): number {
  const normalizedCol = col / (GRID_WIDTH - 1)
  
  if (normalizedCol < 0.15) return 0       // Sub-bass
  if (normalizedCol < 0.3) return 1        // Bass
  if (normalizedCol < 0.45) return 2       // Low-mid
  if (normalizedCol < 0.55) return 3       // Mid
  if (normalizedCol < 0.7) return 4        // High-mid
  if (normalizedCol < 0.85) return 5       // Treble
  return 6                                  // Brilliance
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initTerrain() {
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
// PERSPECTIVE CALCULATIONS
// ============================================================================

/**
 * Calculate perspective Y position (creates vanishing point effect)
 * Now audio-reactive based on overall energy
 */
function getPerspectiveY(baseY: number, z: number, depth: number, perspectiveFactor: number): number {
  const perspectiveProgress = z / depth
  const perspective = Math.pow(perspectiveProgress, 1.5)
  const dynamicHorizon = HORIZON_Y + currentHorizonOffset
  return baseY + (dynamicHorizon - baseY) * perspective * perspectiveFactor
}

/**
 * Calculate perspective X scale (narrower towards horizon)
 */
function getPerspectiveScale(z: number, depth: number, perspectiveFactor: number): number {
  const perspectiveProgress = z / depth
  return 1 - perspectiveProgress * (0.65 + (perspectiveFactor - 1) * 0.2)
}

// ============================================================================
// VISUALIZATION MODE EXPORT
// ============================================================================

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Terrain',
  description: 'Synthwave wireframe landscape with frequency-mapped columns and audio-reactive perspective',
  
  // Hide particles - we use lines only
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initTerrain()
    currentPerspectiveFactor = BASE_FOV_FACTOR
    currentHorizonOffset = 0
    
    // Hide all particles below view
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
    initTerrain()
    
    // Calculate number of line segments
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
      opacity: 0.95,
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
        
        // Grid dimensions
        const halfWidth = (GRID_WIDTH - 1) * CELL_SIZE / 2
        const baseY = -20 // Ground level
        
        // ================================================================
        // AUDIO-REACTIVE PERSPECTIVE
        // ================================================================
        
        // Bass increases FOV (perspective exaggeration)
        const targetPerspective = BASE_FOV_FACTOR + bands.bassSmooth * MAX_FOV_INCREASE + bands.beatIntensity * 0.15
        currentPerspectiveFactor += (targetPerspective - currentPerspectiveFactor) * 0.08
        
        // Overall energy affects horizon line
        const targetHorizon = bands.overallSmooth * 8 + bands.beatIntensity * 4
        currentHorizonOffset += (targetHorizon - currentHorizonOffset) * 0.05
        
        // ================================================================
        // UPDATE TERRAIN HEIGHTS
        // ================================================================
        
        const scrollSpeed = 6 + bands.overallSmooth * 8
        const scrollOffset = (time * scrollSpeed) % CELL_SIZE
        
        for (let z = 0; z < GRID_DEPTH; z++) {
          // Depth factor for wave propagation
          const depthFactor = z / GRID_DEPTH
          
          for (let x = 0; x < GRID_WIDTH; x++) {
            // Get frequency-mapped audio value for this column
            const freqValue = getFrequencyForColumn(x, bands)
            
            // Distance from center for edge effects
            const centerX = Math.abs(x - GRID_WIDTH / 2) / (GRID_WIDTH / 2)
            
            // Main frequency-driven height
            const freqHeight = freqValue * 15 * (1 - depthFactor * 0.5)
            
            // Traveling wave effect
            const travelWave = Math.sin(z * 0.15 - time * 2 + x * 0.1) * bands.midSmooth * 4
            
            // Beat pulse creates expanding rings
            const distFromCenter = Math.sqrt(Math.pow(x - GRID_WIDTH/2, 2) + Math.pow(z - GRID_DEPTH/2, 2))
            const beatRing = Math.sin(distFromCenter * 0.2 - time * 6) * bands.beatIntensity * 8
            
            // BPM-synced pulse (if BPM detected)
            let bpmPulse = 0
            if (bands.estimatedBPM > 0) {
              const bps = bands.estimatedBPM / 60
              const beatPhase = (time * bps) % 1
              bpmPulse = Math.sin(beatPhase * Math.PI * 2) * 0.5 + 0.5
              bpmPulse *= bands.bassSmooth * 3
            }
            
            // Stereo balance affects left/right asymmetry
            const stereoOffset = bands.stereoBalance * (x - GRID_WIDTH/2) / GRID_WIDTH * 5
            
            // High frequency sparkle (random spikes)
            const sparkle = (Math.random() < 0.01 && bands.brillianceSmooth > 0.3) 
              ? bands.brillianceSmooth * 10 : 0
            
            // Combine heights
            let totalHeight = freqHeight + travelWave + beatRing + bpmPulse + stereoOffset
            
            // Quantize for retro angular feel
            totalHeight = Math.round(totalHeight * 3) / 3
            
            // Add sparkle
            if (sparkle > 0) {
              targetHeights[z][x] = Math.max(targetHeights[z][x], sparkle)
            }
            
            // Smooth interpolation with decay
            targetHeights[z][x] = Math.max(totalHeight, targetHeights[z][x] * 0.92)
            terrainHeights[z][x] += (targetHeights[z][x] - terrainHeights[z][x]) * 0.18
            
            // Edge fade for canyon effect
            const edgeFade = 1 - Math.pow(centerX, 2) * 0.7
            terrainHeights[z][x] *= edgeFade
          }
        }
        
        // ================================================================
        // RADIAL MODE TRANSFORMATION (if enabled)
        // ================================================================
        
        let vertexIndex = 0
        
        if (currentMode === 'radial') {
          // Draw circular rings
          for (let z = 0; z < GRID_DEPTH; z++) {
            const ringRadius = z * CELL_SIZE * 0.3 + 5
            const perspScale = getPerspectiveScale(z, GRID_DEPTH, currentPerspectiveFactor)
            
            for (let x = 0; x < GRID_WIDTH - 1; x++) {
              const angle1 = (x / GRID_WIDTH) * Math.PI * 2
              const angle2 = ((x + 1) / GRID_WIDTH) * Math.PI * 2
              
              const height1 = terrainHeights[z][x]
              const height2 = terrainHeights[z][x + 1]
              
              const r1 = ringRadius + height1 * 0.5
              const r2 = ringRadius + height2 * 0.5
              
              pos[vertexIndex * 3] = Math.cos(angle1) * r1 * perspScale
              pos[vertexIndex * 3 + 1] = baseY + height1 + Math.sin(angle1 * 2) * bands.midSmooth * 3
              pos[vertexIndex * 3 + 2] = Math.sin(angle1) * r1 * perspScale - z * 0.5
              
              pos[(vertexIndex + 1) * 3] = Math.cos(angle2) * r2 * perspScale
              pos[(vertexIndex + 1) * 3 + 1] = baseY + height2 + Math.sin(angle2 * 2) * bands.midSmooth * 3
              pos[(vertexIndex + 1) * 3 + 2] = Math.sin(angle2) * r2 * perspScale - z * 0.5
              
              // Gradient-based coloring using frequency band
              const freqBand = getFrequencyBandIndex(x) / 6
              const [r, g, b] = sampleGradient(currentGradient, freqBand + cycleHue * 0.3)
              const alpha = 1 - (z / GRID_DEPTH) * 0.5
              
              col[vertexIndex * 3] = r * alpha
              col[vertexIndex * 3 + 1] = g * alpha
              col[vertexIndex * 3 + 2] = b * alpha
              col[(vertexIndex + 1) * 3] = r * alpha
              col[(vertexIndex + 1) * 3 + 1] = g * alpha
              col[(vertexIndex + 1) * 3 + 2] = b * alpha
              
              vertexIndex += 2
            }
          }
          
          // Radial spokes
          for (let x = 0; x < GRID_WIDTH; x++) {
            const angle = (x / GRID_WIDTH) * Math.PI * 2
            
            for (let z = 0; z < GRID_DEPTH - 1; z++) {
              const r1 = z * CELL_SIZE * 0.3 + 5 + terrainHeights[z][x] * 0.5
              const r2 = (z + 1) * CELL_SIZE * 0.3 + 5 + terrainHeights[z + 1][x] * 0.5
              const perspScale1 = getPerspectiveScale(z, GRID_DEPTH, currentPerspectiveFactor)
              const perspScale2 = getPerspectiveScale(z + 1, GRID_DEPTH, currentPerspectiveFactor)
              
              pos[vertexIndex * 3] = Math.cos(angle) * r1 * perspScale1
              pos[vertexIndex * 3 + 1] = baseY + terrainHeights[z][x]
              pos[vertexIndex * 3 + 2] = Math.sin(angle) * r1 * perspScale1 - z * 0.5
              
              pos[(vertexIndex + 1) * 3] = Math.cos(angle) * r2 * perspScale2
              pos[(vertexIndex + 1) * 3 + 1] = baseY + terrainHeights[z + 1][x]
              pos[(vertexIndex + 1) * 3 + 2] = Math.sin(angle) * r2 * perspScale2 - (z + 1) * 0.5
              
              const freqBand = getFrequencyBandIndex(x) / 6
              const [r, g, b] = sampleGradient(currentGradient, freqBand + cycleHue * 0.3)
              const alpha = 1 - ((z + 0.5) / GRID_DEPTH) * 0.6
              
              col[vertexIndex * 3] = r * alpha
              col[vertexIndex * 3 + 1] = g * alpha
              col[vertexIndex * 3 + 2] = b * alpha
              col[(vertexIndex + 1) * 3] = r * alpha
              col[(vertexIndex + 1) * 3 + 1] = g * alpha
              col[(vertexIndex + 1) * 3 + 2] = b * alpha
              
              vertexIndex += 2
            }
          }
        } else {
          // ================================================================
          // LINEAR MODE (default synthwave terrain)
          // ================================================================
          
          // Draw horizontal lines (along X axis)
          for (let z = 0; z < GRID_DEPTH; z++) {
            const zPos = z * CELL_SIZE - scrollOffset
            const perspectiveScale = getPerspectiveScale(z, GRID_DEPTH, currentPerspectiveFactor)
            const depthFactor = z / GRID_DEPTH
            
            for (let x = 0; x < GRID_WIDTH - 1; x++) {
              const x1World = (x * CELL_SIZE - halfWidth) * perspectiveScale
              const x2World = ((x + 1) * CELL_SIZE - halfWidth) * perspectiveScale
              
              const height1 = terrainHeights[z][x]
              const height2 = terrainHeights[z][x + 1]
              
              const y1 = getPerspectiveY(baseY + height1, z, GRID_DEPTH, currentPerspectiveFactor)
              const y2 = getPerspectiveY(baseY + height2, z, GRID_DEPTH, currentPerspectiveFactor)
              
              // First vertex
              pos[vertexIndex * 3] = x1World
              pos[vertexIndex * 3 + 1] = y1
              pos[vertexIndex * 3 + 2] = -zPos
              
              // Second vertex
              pos[(vertexIndex + 1) * 3] = x2World
              pos[(vertexIndex + 1) * 3 + 1] = y2
              pos[(vertexIndex + 1) * 3 + 2] = -zPos
              
              // Color based on frequency band mapping
              const avgHeight = (height1 + height2) / 2
              const heightIntensity = Math.min(1, Math.abs(avgHeight) / 12)
              const freqBand = getFrequencyBandIndex(x)
              
              // Sample from gradient based on frequency position
              const gradientPos = (freqBand / 6) + cycleHue * 0.2
              const [r, g, b] = sampleGradient(currentGradient, gradientPos)
              
              // Brightness based on height and beats
              const brightness = 0.4 + heightIntensity * 0.4 + bands.beatIntensity * 0.2
              
              // Fade alpha towards horizon
              const alpha = (1 - depthFactor * 0.6) * brightness
              
              col[vertexIndex * 3] = r * alpha
              col[vertexIndex * 3 + 1] = g * alpha
              col[vertexIndex * 3 + 2] = b * alpha
              col[(vertexIndex + 1) * 3] = r * alpha
              col[(vertexIndex + 1) * 3 + 1] = g * alpha
              col[(vertexIndex + 1) * 3 + 2] = b * alpha
              
              vertexIndex += 2
            }
          }
          
          // Draw vertical lines (along Z axis)
          for (let x = 0; x < GRID_WIDTH; x++) {
            for (let z = 0; z < GRID_DEPTH - 1; z++) {
              const z1Pos = z * CELL_SIZE - scrollOffset
              const z2Pos = (z + 1) * CELL_SIZE - scrollOffset
              
              const perspectiveScale1 = getPerspectiveScale(z, GRID_DEPTH, currentPerspectiveFactor)
              const perspectiveScale2 = getPerspectiveScale(z + 1, GRID_DEPTH, currentPerspectiveFactor)
              
              const xWorld1 = (x * CELL_SIZE - halfWidth) * perspectiveScale1
              const xWorld2 = (x * CELL_SIZE - halfWidth) * perspectiveScale2
              
              const height1 = terrainHeights[z][x]
              const height2 = terrainHeights[z + 1][x]
              
              const y1 = getPerspectiveY(baseY + height1, z, GRID_DEPTH, currentPerspectiveFactor)
              const y2 = getPerspectiveY(baseY + height2, z + 1, GRID_DEPTH, currentPerspectiveFactor)
              
              // First vertex
              pos[vertexIndex * 3] = xWorld1
              pos[vertexIndex * 3 + 1] = y1
              pos[vertexIndex * 3 + 2] = -z1Pos
              
              // Second vertex
              pos[(vertexIndex + 1) * 3] = xWorld2
              pos[(vertexIndex + 1) * 3 + 1] = y2
              pos[(vertexIndex + 1) * 3 + 2] = -z2Pos
              
              const vertDepthFactor = (z + 0.5) / GRID_DEPTH
              const avgHeight = (height1 + height2) / 2
              const heightIntensity = Math.min(1, Math.abs(avgHeight) / 12)
              const freqBand = getFrequencyBandIndex(x)
              
              // Slightly shifted gradient for vertical lines
              const gradientPos = (freqBand / 6) + cycleHue * 0.2 + 0.1
              const [r, g, b] = sampleGradient(currentGradient, gradientPos)
              
              const brightness = 0.35 + heightIntensity * 0.4 + bands.beatIntensity * 0.15
              const alpha = (1 - vertDepthFactor * 0.7) * brightness
              
              col[vertexIndex * 3] = r * alpha
              col[vertexIndex * 3 + 1] = g * alpha
              col[vertexIndex * 3 + 2] = b * alpha
              col[(vertexIndex + 1) * 3] = r * alpha
              col[(vertexIndex + 1) * 3 + 1] = g * alpha
              col[(vertexIndex + 1) * 3 + 2] = b * alpha
              
              vertexIndex += 2
            }
          }
        }
        
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      },
      dispose: () => {
        if (lineGeometry) lineGeometry.dispose()
        if (lineMaterial) lineMaterial.dispose()
        if (lineSegments) {
          scene.remove(lineSegments)
        }
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
    // All rendering handled by createSceneObjects
    // Hide any particles
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] = -100
      sizes[i] = 0
    }
  }
}

// ============================================================================
// PUBLIC API FOR MODE SWITCHING
// ============================================================================

/** Switch between linear and radial terrain modes */
export function setTerrainMode(mode: TerrainMode) {
  currentMode = mode
}

/** Get current terrain mode */
export function getTerrainMode(): TerrainMode {
  return currentMode
}

/** Set gradient preset for terrain */
export function setTerrainGradient(gradient: typeof currentGradient) {
  currentGradient = gradient
}
