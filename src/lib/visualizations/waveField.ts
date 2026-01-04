import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'

// ============================================================================
// DESIGN PHILOSOPHY
// ============================================================================
// This redesign focuses on:
// 1. RESTRAINED COLORS - Lock to palette, stop rainbow chaos
// 2. WEIGHTED MOTION - Physics-based movement with inertia
// 3. CLEAN COMPOSITION - Simple wireframe on black (like WMP)
// 4. NEGATIVE SPACE - Let the visualization breathe
// ============================================================================

// ============================================================================
// LOCKED COLOR PALETTE SYSTEM
// ============================================================================

interface ColorScheme {
  name: string
  gridPrimary: THREE.Color  // Main grid lines
  gridAccent: THREE.Color   // Peak/highlight color
  ambient: number           // Ambient brightness 0-1
}

const COLOR_SCHEMES: ColorScheme[] = [
  {
    name: 'Classic Synthwave',
    gridPrimary: new THREE.Color(0xff006e), // Pink
    gridAccent: new THREE.Color(0x00f5ff),  // Cyan
    ambient: 0.15
  },
  {
    name: 'Sunset Drive',
    gridPrimary: new THREE.Color(0xf77f00), // Amber
    gridAccent: new THREE.Color(0xffba08),  // Gold
    ambient: 0.2
  },
  {
    name: 'Arctic Night',
    gridPrimary: new THREE.Color(0x4cc9f0), // Sky blue
    gridAccent: new THREE.Color(0xf72585),  // Magenta accent
    ambient: 0.12
  },
  {
    name: 'Amber Glow',
    gridPrimary: new THREE.Color(0xff6d00), // Orange
    gridAccent: new THREE.Color(0xffea00),  // Bright yellow
    ambient: 0.18
  }
]

let currentScheme = COLOR_SCHEMES[0]

// ============================================================================
// GRID CONFIGURATION
// ============================================================================

const GRID_WIDTH = 40
const GRID_DEPTH = 40
const CELL_SIZE = 2.5
const HORIZON_Y = 18
const MAX_HEIGHT = 12

// Visualization modes (kept for compatibility)
type TerrainMode = 'linear' | 'radial'
let currentMode: TerrainMode = 'linear'

// ============================================================================
// MOTION DESIGN SYSTEM
// ============================================================================

interface MotionState {
  position: number
  velocity: number
  acceleration: number
  mass: number
}

function createMotionState(mass: number = 1): MotionState {
  return { position: 0, velocity: 0, acceleration: 0, mass }
}

function updateSpring(
  state: MotionState,
  target: number,
  springStrength: number = 0.05,
  damping: number = 0.85,
  _dt: number = 0.016
): number {
  const force = (target - state.position) * springStrength
  state.acceleration = force / state.mass
  state.velocity = (state.velocity + state.acceleration) * damping
  state.position += state.velocity
  return state.position
}

// ============================================================================
// STATE
// ============================================================================

const terrainHeights: number[][] = []
const heightMotion: MotionState[][] = []

let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null

let lastBeatTime = 0
let energyHistory: number[] = new Array(60).fill(0)
let avgEnergy = 0

// ============================================================================
// INITIALIZATION
// ============================================================================

function initTerrain() {
  terrainHeights.length = 0
  heightMotion.length = 0
  
  for (let z = 0; z < GRID_DEPTH; z++) {
    terrainHeights[z] = []
    heightMotion[z] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      terrainHeights[z][x] = 0
      heightMotion[z][x] = createMotionState(0.8 + Math.random() * 0.4)
    }
  }
  
  energyHistory.fill(0)
  avgEnergy = 0
  lastBeatTime = 0
}

// ============================================================================
// MUSICAL ANALYSIS
// ============================================================================

function analyzeMusic(bands: AudioBands, time: number, _dt: number) {
  energyHistory.push(bands.overallSmooth)
  if (energyHistory.length > 60) energyHistory.shift()
  avgEnergy = energyHistory.reduce((a, b) => a + b) / energyHistory.length
  
  const isBeat = bands.isBeat && (time - lastBeatTime) > 0.3
  if (isBeat) lastBeatTime = time
  
  return {
    isBeat,
    energyDelta: bands.overallSmooth - avgEnergy,
    bassWeight: bands.bassSmooth * 0.6 + bands.subBassSmooth * 0.4,
    melodyWeight: bands.midSmooth * 0.5 + bands.trebleSmooth * 0.5
  }
}

// ============================================================================
// PERSPECTIVE CALCULATIONS
// ============================================================================

function getPerspectiveY(baseY: number, z: number): number {
  const progress = z / GRID_DEPTH
  const curve = Math.pow(progress, 1.8)
  return baseY + (HORIZON_Y - baseY) * curve
}

function getPerspectiveScale(z: number): number {
  const progress = z / GRID_DEPTH
  return 1 - progress * 0.75
}

// ============================================================================
// VISUALIZATION MODE
// ============================================================================

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Terrain',
  description: 'Synthwave landscape with locked color palettes and physics-based motion',
  
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initTerrain()
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -200
      positions[i * 3 + 2] = 0
      colors[i * 3] = 0
      colors[i * 3 + 1] = 0
      colors[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    initTerrain()
    
    const horizontalSegments = (GRID_WIDTH - 1) * GRID_DEPTH
    const verticalSegments = Math.floor((GRID_DEPTH - 1) * GRID_WIDTH / 2)
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
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      linewidth: 1
    })
    
    lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)
    
    return {
      objects: [lineSegments],
      update: (bands: AudioBands, time: number) => {
        if (!lineGeometry) return
        
        const dt = 0.016
        const music = analyzeMusic(bands, time, dt)
        
        // Subtle color shift based on average energy
        const schemeIndex = Math.floor(avgEnergy * COLOR_SCHEMES.length) % COLOR_SCHEMES.length
        if (COLOR_SCHEMES[schemeIndex] !== currentScheme) {
          currentScheme = COLOR_SCHEMES[schemeIndex]
        }
        
        // ====================================================================
        // TERRAIN HEIGHT CALCULATION
        // ====================================================================
        
        const halfWidth = (GRID_WIDTH - 1) * CELL_SIZE / 2
        const baseY = -22
        
        for (let z = 0; z < GRID_DEPTH; z++) {
          const depthFactor = z / GRID_DEPTH
          
          for (let x = 0; x < GRID_WIDTH; x++) {
            const baseWave = Math.sin(x * 0.2 - time * 0.5) * 
                           Math.cos(z * 0.15 + time * 0.3) * 
                           MAX_HEIGHT * 0.4
            
            const distFromCenter = Math.sqrt(
              Math.pow(x - GRID_WIDTH/2, 2) + 
              Math.pow(z - GRID_DEPTH/2, 2)
            )
            const ringPhase = distFromCenter * 0.3 - time * 2
            const bassRing = Math.sin(ringPhase) * music.bassWeight * MAX_HEIGHT * 0.5
            
            const melodyWave = Math.sin(x * 0.3 + time * 1.5) * 
                             music.melodyWeight * MAX_HEIGHT * 0.3
            
            const beatHeight = music.isBeat ? 
              Math.exp(-Math.pow(distFromCenter - 10, 2) / 20) * MAX_HEIGHT * 0.6 : 0
            
            const targetHeight = (baseWave + bassRing + melodyWave + beatHeight) * 
                               (1 - depthFactor * 0.7)
            
            terrainHeights[z][x] = updateSpring(
              heightMotion[z][x],
              targetHeight,
              0.08,
              0.88,
              dt
            )
          }
        }
        
        // ====================================================================
        // RENDER GRID LINES
        // ====================================================================
        
        const posAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
        const colAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array
        const col = colAttr.array as Float32Array
        
        let vertexIndex = 0
        
        // Horizontal lines
        for (let z = 0; z < GRID_DEPTH; z++) {
          const perspScale = getPerspectiveScale(z)
          const depthFade = 1 - (z / GRID_DEPTH) * 0.7
          
          for (let x = 0; x < GRID_WIDTH - 1; x++) {
            const x1 = (x * CELL_SIZE - halfWidth) * perspScale
            const x2 = ((x + 1) * CELL_SIZE - halfWidth) * perspScale
            
            const h1 = terrainHeights[z][x]
            const h2 = terrainHeights[z][x + 1]
            
            const y1 = getPerspectiveY(baseY + h1, z)
            const y2 = getPerspectiveY(baseY + h2, z)
            
            pos[vertexIndex * 3] = x1
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -z * CELL_SIZE
            
            pos[(vertexIndex + 1) * 3] = x2
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -z * CELL_SIZE
            
            const avgHeight = (h1 + h2) / 2
            const heightIntensity = Math.abs(avgHeight) / MAX_HEIGHT
            
            let lineColor: THREE.Color
            if (heightIntensity > 0.6) {
              lineColor = currentScheme.gridAccent
            } else {
              lineColor = currentScheme.gridPrimary
            }
            
            const brightness = (currentScheme.ambient + heightIntensity * 0.5 + 
                              bands.beatIntensity * 0.2) * depthFade
            
            col[vertexIndex * 3] = lineColor.r * brightness
            col[vertexIndex * 3 + 1] = lineColor.g * brightness
            col[vertexIndex * 3 + 2] = lineColor.b * brightness
            col[(vertexIndex + 1) * 3] = lineColor.r * brightness
            col[(vertexIndex + 1) * 3 + 1] = lineColor.g * brightness
            col[(vertexIndex + 1) * 3 + 2] = lineColor.b * brightness
            
            vertexIndex += 2
          }
        }
        
        // Vertical lines (fewer for cleaner look)
        const verticalSpacing = 2
        for (let x = 0; x < GRID_WIDTH; x += verticalSpacing) {
          for (let z = 0; z < GRID_DEPTH - 1; z++) {
            const perspScale1 = getPerspectiveScale(z)
            const perspScale2 = getPerspectiveScale(z + 1)
            
            const x1 = (x * CELL_SIZE - halfWidth) * perspScale1
            const x2 = (x * CELL_SIZE - halfWidth) * perspScale2
            
            const h1 = terrainHeights[z][x]
            const h2 = terrainHeights[z + 1][x]
            
            const y1 = getPerspectiveY(baseY + h1, z)
            const y2 = getPerspectiveY(baseY + h2, z + 1)
            
            pos[vertexIndex * 3] = x1
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -z * CELL_SIZE
            
            pos[(vertexIndex + 1) * 3] = x2
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -(z + 1) * CELL_SIZE
            
            const depthFade = 1 - ((z + 0.5) / GRID_DEPTH) * 0.8
            const avgHeight = (h1 + h2) / 2
            const heightIntensity = Math.abs(avgHeight) / MAX_HEIGHT
            
            const lineColor = heightIntensity > 0.6 ? 
              currentScheme.gridAccent : currentScheme.gridPrimary
            
            const brightness = (currentScheme.ambient * 0.7 + heightIntensity * 0.4) * depthFade
            
            col[vertexIndex * 3] = lineColor.r * brightness
            col[vertexIndex * 3 + 1] = lineColor.g * brightness
            col[vertexIndex * 3 + 2] = lineColor.b * brightness
            col[(vertexIndex + 1) * 3] = lineColor.r * brightness
            col[(vertexIndex + 1) * 3 + 1] = lineColor.g * brightness
            col[(vertexIndex + 1) * 3 + 2] = lineColor.b * brightness
            
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
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}

// ============================================================================
// PUBLIC API FOR MODE SWITCHING (kept for compatibility)
// ============================================================================

export function setTerrainMode(mode: TerrainMode) {
  currentMode = mode
}

export function getTerrainMode(): TerrainMode {
  return currentMode
}

export function setTerrainGradient(_gradient: any) {
  // Kept for compatibility but now uses locked palettes
}
