import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import * as THREE from 'three'

// Grid configuration
const GRID_WIDTH = 32      // Columns (X axis)
const GRID_DEPTH = 48      // Rows (Z axis) - more depth for perspective
const CELL_SIZE = 2.5      // Size of each grid cell
const HORIZON_Y = 15       // Vanishing point height

// Store terrain heights for smooth animation
const terrainHeights: number[][] = []
const targetHeights: number[][] = []

// Line geometry references
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null

// Initialize terrain height arrays
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

// Calculate perspective Y position (creates vanishing point effect)
function getPerspectiveY(baseY: number, z: number, depth: number): number {
  // Further back = closer to horizon
  const perspectiveFactor = z / depth
  const perspective = Math.pow(perspectiveFactor, 1.5)
  return baseY + (HORIZON_Y - baseY) * perspective
}

// Calculate perspective X scale (narrower towards horizon)
function getPerspectiveScale(z: number, depth: number): number {
  const perspectiveFactor = z / depth
  return 1 - perspectiveFactor * 0.7
}

export const waveField: VisualizationMode = {
  id: 'wave_field',
  name: 'Terrain',
  description: 'Synthwave wireframe landscape with neon glow',
  
  // Hide particles - we use lines only
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initTerrain()
    
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
    // Horizontal lines: GRID_WIDTH-1 segments per row, GRID_DEPTH rows
    // Vertical lines: GRID_DEPTH-1 segments per column, GRID_WIDTH columns
    const horizontalSegments = (GRID_WIDTH - 1) * GRID_DEPTH
    const verticalSegments = (GRID_DEPTH - 1) * GRID_WIDTH
    const totalSegments = horizontalSegments + verticalSegments
    const vertexCount = totalSegments * 2 // 2 vertices per segment
    
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
        
        // Update terrain heights with audio
        const scrollSpeed = 8 + bands.overallSmooth * 6
        const scrollOffset = (time * scrollSpeed) % CELL_SIZE
        
        for (let z = 0; z < GRID_DEPTH; z++) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            // Distance from center for effects
            const centerX = Math.abs(x - GRID_WIDTH / 2) / (GRID_WIDTH / 2)
            
            // Angular, geometric height calculation
            // Bass creates big angular peaks
            const bassWave = Math.floor(Math.sin(x * 0.3 + time * 1.5) * 3) / 3 * bands.bassSmooth * 12
            
            // Mids create medium ridges
            const midRidge = Math.abs(Math.sin(z * 0.2 + time * 2)) * bands.midSmooth * 8
            
            // Highs create sharp spikes
            const highSpike = (Math.random() < 0.02 && bands.highSmooth > 0.3) 
              ? bands.highSmooth * 15 : 0
            
            // Beat pulses create expanding rings
            const distFromCenter = Math.sqrt(Math.pow(x - GRID_WIDTH/2, 2) + Math.pow(z - GRID_DEPTH/2, 2))
            const beatRing = Math.sin(distFromCenter * 0.3 - time * 5) * bands.beatIntensity * 10
            
            // Combine with angular quantization for retro feel
            let totalHeight = bassWave + midRidge + beatRing
            
            // Quantize heights to create stepped, angular look
            totalHeight = Math.round(totalHeight * 2) / 2
            
            // Add persistent spikes
            if (highSpike > 0) {
              targetHeights[z][x] = Math.max(targetHeights[z][x], highSpike)
            }
            
            // Smooth interpolation with decay
            targetHeights[z][x] = Math.max(totalHeight, targetHeights[z][x] * 0.95)
            terrainHeights[z][x] += (targetHeights[z][x] - terrainHeights[z][x]) * 0.15
            
            // Edges should be lower (creates canyon effect)
            const edgeFade = 1 - Math.pow(centerX, 2) * 0.8
            terrainHeights[z][x] *= edgeFade
          }
        }
        
        let vertexIndex = 0
        
        // Draw horizontal lines (along X axis)
        for (let z = 0; z < GRID_DEPTH; z++) {
          const zPos = z * CELL_SIZE - scrollOffset
          const perspectiveScale = getPerspectiveScale(z, GRID_DEPTH)
          const depthFactor = z / GRID_DEPTH
          
          for (let x = 0; x < GRID_WIDTH - 1; x++) {
            const x1World = (x * CELL_SIZE - halfWidth) * perspectiveScale
            const x2World = ((x + 1) * CELL_SIZE - halfWidth) * perspectiveScale
            
            const height1 = terrainHeights[z][x]
            const height2 = terrainHeights[z][x + 1]
            
            const y1 = getPerspectiveY(baseY + height1, z, GRID_DEPTH)
            const y2 = getPerspectiveY(baseY + height2, z, GRID_DEPTH)
            
            // First vertex
            pos[vertexIndex * 3] = x1World
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -zPos
            
            // Second vertex
            pos[(vertexIndex + 1) * 3] = x2World
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -zPos
            
            // Neon synthwave colors
            // Magenta/Cyan gradient based on height and depth
            const avgHeight = (height1 + height2) / 2
            const heightIntensity = Math.min(1, Math.abs(avgHeight) / 10)
            
            // Base hue: magenta (0.85) to cyan (0.5) based on depth
            const baseHue = 0.85 - depthFactor * 0.35
            const hue = baseHue + cycleHue * 0.3 + heightIntensity * 0.1
            
            // Higher = brighter
            const lightness = 0.4 + heightIntensity * 0.3 + bands.beatIntensity * 0.2
            const saturation = 0.9 + bands.overallSmooth * 0.1
            
            // Fade alpha towards horizon
            const alpha = 1 - depthFactor * 0.6
            
            const [r, g, b] = hslToRgb(hue, saturation, lightness)
            col[vertexIndex * 3] = r * alpha
            col[vertexIndex * 3 + 1] = g * alpha
            col[vertexIndex * 3 + 2] = b * alpha
            col[(vertexIndex + 1) * 3] = r * alpha
            col[(vertexIndex + 1) * 3 + 1] = g * alpha
            col[(vertexIndex + 1) * 3 + 2] = b * alpha
            
            vertexIndex += 2
          }
        }
        
        // Draw vertical lines (along Z axis) - creates the receding perspective
        for (let x = 0; x < GRID_WIDTH; x++) {
          for (let z = 0; z < GRID_DEPTH - 1; z++) {
            const z1Pos = z * CELL_SIZE - scrollOffset
            const z2Pos = (z + 1) * CELL_SIZE - scrollOffset
            
            const perspectiveScale1 = getPerspectiveScale(z, GRID_DEPTH)
            const perspectiveScale2 = getPerspectiveScale(z + 1, GRID_DEPTH)
            
            const xWorld1 = (x * CELL_SIZE - halfWidth) * perspectiveScale1
            const xWorld2 = (x * CELL_SIZE - halfWidth) * perspectiveScale2
            
            const height1 = terrainHeights[z][x]
            const height2 = terrainHeights[z + 1][x]
            
            const y1 = getPerspectiveY(baseY + height1, z, GRID_DEPTH)
            const y2 = getPerspectiveY(baseY + height2, z + 1, GRID_DEPTH)
            
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
            const heightIntensity = Math.min(1, Math.abs(avgHeight) / 10)
            
            // Vertical lines more cyan-shifted
            const baseHue = 0.55 - vertDepthFactor * 0.1
            const hue = baseHue + cycleHue * 0.3 + heightIntensity * 0.15
            
            const lightness = 0.35 + heightIntensity * 0.35 + bands.beatIntensity * 0.15
            const saturation = 0.85
            
            const alpha = 1 - vertDepthFactor * 0.7
            
            const [r, g, b] = hslToRgb(hue, saturation, lightness)
            col[vertexIndex * 3] = r * alpha
            col[vertexIndex * 3 + 1] = g * alpha
            col[vertexIndex * 3 + 2] = b * alpha
            col[(vertexIndex + 1) * 3] = r * alpha
            col[(vertexIndex + 1) * 3 + 1] = g * alpha
            col[(vertexIndex + 1) * 3 + 2] = b * alpha
            
            vertexIndex += 2
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
