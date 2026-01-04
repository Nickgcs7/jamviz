import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient, type GradientPreset } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// CONFIGURATION - Full configuration API (mirrors SpectrumAnalyzer pattern)
// ============================================================================

export interface RoadwayConfig {
  // Road geometry
  laneCount: number
  roadWidth: number
  horizonDistance: number
  roadCurvature: number
  cellSize: number

  // Line animation
  lineSpeed: number
  lineSpeedBoost: number
  lineLength: number
  lineGap: number
  showSidelines: boolean
  lineGlow: number

  // Road markings
  showRoadLines: boolean
  roadLineWidth: number
  roadLineDashLength: number
  roadLineGapLength: number
  roadLineIntensity: number
  roadLineGlow: number

  // Horizon glow
  showHorizonGlow: boolean
  horizonGlowIntensity: number
  horizonGlowHeight: number
  horizonGlowColor: [number, number, number]
  horizonGlowBeatReactivity: number

  // Color configuration
  colorMode: 'gradient' | 'speed-reactive' | 'beat-reactive' | 'frequency'
  gradient: GradientPreset
  colorCycleSpeed: number

  // Visual effects
  beatReactivity: number
  cameraHeight: number
  cameraSway: number
  cameraSwaySpeed: number
  fogDensity: number
  perspectiveIntensity: number

  // Audio response
  bassInfluence: number
  midInfluence: number
  highInfluence: number
  stereoSeparation: number

  // Smoothing
  smoothingFactor: number
}

const DEFAULT_CONFIG: RoadwayConfig = {
  laneCount: 50,
  roadWidth: 50,
  horizonDistance: 100,
  roadCurvature: 0.3,
  cellSize: 1.6,

  lineSpeed: 8,
  lineSpeedBoost: 12,
  lineLength: 1.0,
  lineGap: 0.5,
  showSidelines: true,
  lineGlow: 0.9,

  showRoadLines: true,
  roadLineWidth: 1.2,
  roadLineDashLength: 4,
  roadLineGapLength: 6,
  roadLineIntensity: 0.9,
  roadLineGlow: 0.5,

  showHorizonGlow: true,
  horizonGlowIntensity: 0.5,
  horizonGlowHeight: 15,
  horizonGlowColor: [0.8, 0.6, 1.0],
  horizonGlowBeatReactivity: 1.5,

  colorMode: 'gradient',
  gradient: builtInGradients.synthwave,
  colorCycleSpeed: 0.3,

  beatReactivity: 1.0,
  cameraHeight: -25,
  cameraSway: 2.0,
  cameraSwaySpeed: 3.0,
  fogDensity: 0.008,
  perspectiveIntensity: 0.3,

  bassInfluence: 1.0,
  midInfluence: 1.0,
  highInfluence: 1.0,
  stereoSeparation: 1.0,

  smoothingFactor: 0.15
}

let config: RoadwayConfig = { ...DEFAULT_CONFIG }

// ============================================================================
// STATE
// ============================================================================

const terrainHeights: number[][] = []
const targetHeights: number[][] = []
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null

// Road marking meshes (thick dashed white lines with glow)
let roadLineMeshes: THREE.Mesh[] = []
let roadLineGlowMeshes: THREE.Mesh[] = []
let roadLineMaterial: THREE.MeshBasicMaterial | null = null
let roadLineGlowMaterial: THREE.MeshBasicMaterial | null = null

// Horizon glow
let horizonGlowMesh: THREE.Mesh | null = null
let horizonGlowMaterial: THREE.ShaderMaterial | null = null

let currentCameraY = 0
let smoothedBeatIntensity = 0

// View zones
const VIEW_ZONE_NEAR = 0.15
const VIEW_ZONE_FAR = 0.85
const INTENSITY_NEAR = 0.7
const INTENSITY_VIEW = 1.0
const INTENSITY_FAR = 0.5

// Road line constants
const ROAD_LINE_COUNT = 30

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFrequencyForLane(x: number, bands: AudioBands): number {
  const normalizedX = x / (config.laneCount - 1)
  const distFromCenter = Math.abs(normalizedX - 0.5) * 2
  
  if (distFromCenter < 0.2) {
    return (bands.bassSmooth * config.bassInfluence + bands.subBassSmooth * config.bassInfluence) * 0.5
  } else if (distFromCenter < 0.4) {
    const t = (distFromCenter - 0.2) / 0.2
    return bands.bassSmooth * config.bassInfluence * (1 - t) + bands.lowMidSmooth * config.midInfluence * t
  } else if (distFromCenter < 0.6) {
    const t = (distFromCenter - 0.4) / 0.2
    return bands.lowMidSmooth * config.midInfluence * (1 - t) + bands.midSmooth * config.midInfluence * t
  } else if (distFromCenter < 0.8) {
    const t = (distFromCenter - 0.6) / 0.2
    return bands.midSmooth * config.midInfluence * (1 - t) + bands.highMidSmooth * config.highInfluence * t
  } else {
    const t = (distFromCenter - 0.8) / 0.2
    return bands.highMidSmooth * config.highInfluence * (1 - t) + bands.trebleSmooth * config.highInfluence * t
  }
}

function getZoneIntensity(z: number): number {
  const normalizedZ = z / config.horizonDistance
  
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
  const normalizedZ = z / config.horizonDistance
  return 1 - normalizedZ * config.perspectiveIntensity
}

function getPerspectiveY(baseY: number, z: number): number {
  const normalizedZ = z / config.horizonDistance
  const horizonLift = Math.pow(normalizedZ, 2.8) * 55
  return baseY + horizonLift + currentCameraY
}

function getColorForPosition(
  lanePosition: number,
  _heightRatio: number,
  cycleHue: number,
  bands: AudioBands,
  speedRatio: number
): [number, number, number] {
  switch (config.colorMode) {
    case 'speed-reactive': {
      const speedT = Math.min(1, speedRatio / 2)
      const adjustedPos = lanePosition + speedT * 0.3
      return sampleGradient(config.gradient, adjustedPos)
    }

    case 'beat-reactive': {
      const beatT = lanePosition + bands.beatIntensity * 0.4 * config.beatReactivity
      return sampleGradient(config.gradient, beatT)
    }

    case 'frequency': {
      return sampleGradient(config.gradient, lanePosition)
    }

    case 'gradient':
    default: {
      const gradientPos = lanePosition + cycleHue * config.colorCycleSpeed
      return sampleGradient(config.gradient, gradientPos)
    }
  }
}

function initRoadway() {
  terrainHeights.length = 0
  targetHeights.length = 0
  
  for (let z = 0; z < config.horizonDistance; z++) {
    terrainHeights[z] = []
    targetHeights[z] = []
    for (let x = 0; x < config.laneCount; x++) {
      terrainHeights[z][x] = 0
      targetHeights[z][x] = 0
    }
  }
}

// Create horizon glow shader with beat reactivity
function createHorizonGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(config.horizonGlowColor[0], config.horizonGlowColor[1], config.horizonGlowColor[2]) },
      intensity: { value: config.horizonGlowIntensity },
      beatIntensity: { value: 0 },
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      uniform float beatIntensity;
      uniform float time;
      varying vec2 vUv;
      
      void main() {
        // Vertical gradient - strongest at bottom (horizon line), fading up
        float gradient = 1.0 - vUv.y;
        gradient = pow(gradient, 1.5);
        
        // Horizontal falloff - fade at edges
        float horizontalFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);
        
        // Beat pulse - expands the glow on beats
        float beatPulse = 1.0 + beatIntensity * 0.8;
        gradient *= beatPulse;
        
        // Subtle ambient pulse
        float pulse = 0.95 + 0.05 * sin(time * 2.0);
        
        // Combined intensity with strong beat response
        float totalIntensity = intensity * (1.0 + beatIntensity * 1.5);
        
        float alpha = gradient * horizontalFade * totalIntensity * pulse;
        
        // Brighten color on beats
        vec3 finalColor = glowColor * (1.0 + beatIntensity * 0.5);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  })
}

// Create road line dash meshes (box geometry for thickness)
function createRoadLineMeshes(scene: THREE.Scene): void {
  // Clear existing meshes
  roadLineMeshes.forEach(mesh => {
    mesh.geometry.dispose()
    scene.remove(mesh)
  })
  roadLineGlowMeshes.forEach(mesh => {
    mesh.geometry.dispose()
    scene.remove(mesh)
  })
  roadLineMeshes = []
  roadLineGlowMeshes = []
  
  if (roadLineMaterial) roadLineMaterial.dispose()
  if (roadLineGlowMaterial) roadLineGlowMaterial.dispose()
  
  // Main line material (bright white)
  roadLineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: config.roadLineIntensity,
    blending: THREE.AdditiveBlending
  })
  
  // Glow material (softer, larger, blue tint for reflective look)
  roadLineGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xaaccff,
    transparent: true,
    opacity: config.roadLineGlow,
    blending: THREE.AdditiveBlending
  })
  
  // Create meshes for each dash
  for (let i = 0; i < ROAD_LINE_COUNT; i++) {
    // Main dash (box geometry)
    const dashGeometry = new THREE.BoxGeometry(
      config.roadLineWidth,
      0.3,
      config.roadLineDashLength
    )
    const dashMesh = new THREE.Mesh(dashGeometry, roadLineMaterial)
    scene.add(dashMesh)
    roadLineMeshes.push(dashMesh)
    
    // Glow layer (larger, softer)
    const glowGeometry = new THREE.BoxGeometry(
      config.roadLineWidth * 3,
      0.2,
      config.roadLineDashLength
    )
    const glowMesh = new THREE.Mesh(glowGeometry, roadLineGlowMaterial)
    scene.add(glowMesh)
    roadLineGlowMeshes.push(glowMesh)
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
    smoothedBeatIntensity = 0
    
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
    
    const horizontalSegments = (config.laneCount - 1) * config.horizonDistance
    const verticalSegments = (config.horizonDistance - 1) * config.laneCount
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
      opacity: config.lineGlow,
      blending: THREE.AdditiveBlending,
    })
    
    lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)
    
    // Create road marking meshes
    if (config.showRoadLines) {
      createRoadLineMeshes(scene)
    }
    
    // Create horizon glow
    if (config.showHorizonGlow) {
      const glowGeometry = new THREE.PlaneGeometry(200, config.horizonGlowHeight)
      horizonGlowMaterial = createHorizonGlowMaterial()
      horizonGlowMesh = new THREE.Mesh(glowGeometry, horizonGlowMaterial)
      
      const horizonZ = -config.horizonDistance * config.cellSize
      const horizonY = getPerspectiveY(config.cameraHeight, config.horizonDistance - 1) + config.horizonGlowHeight / 2
      horizonGlowMesh.position.set(0, horizonY, horizonZ + 5)
      
      scene.add(horizonGlowMesh)
    }
    
    // Update fog density
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = config.fogDensity
    }
    
    const allObjects: THREE.Object3D[] = [lineSegments]
    if (horizonGlowMesh) allObjects.push(horizonGlowMesh)
    roadLineMeshes.forEach(m => allObjects.push(m))
    roadLineGlowMeshes.forEach(m => allObjects.push(m))
    
    return {
      objects: allObjects,
      update: (bands: AudioBands, time: number) => {
        if (!lineGeometry) return
        
        const cycleHue = getCyclingHue(time)
        const posAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
        const colAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array
        const col = colAttr.array as Float32Array
        
        const halfWidth = (config.laneCount - 1) * config.cellSize / 2
        
        // Constant speed - no audio reactivity
        const currentSpeed = config.lineSpeed
        const speedRatio = 1.0
        
        // Smooth beat intensity for horizon glow
        const targetBeat = bands.beatIntensity * config.horizonGlowBeatReactivity
        smoothedBeatIntensity += (targetBeat - smoothedBeatIntensity) * 0.15
        
        const targetCameraY = Math.sin(time * config.cameraSwaySpeed) * 
          bands.midSmooth * config.cameraSway * config.midInfluence + 
          bands.beatIntensity * 3 * config.beatReactivity
        currentCameraY += (targetCameraY - currentCameraY) * 0.08
        
        const scrollOffset = (time * currentSpeed) % config.cellSize
        
        for (let z = 0; z < config.horizonDistance; z++) {
          const zoneIntensity = getZoneIntensity(z)
          const normalizedZ = z / config.horizonDistance
          
          for (let x = 0; x < config.laneCount; x++) {
            const freqValue = getFrequencyForLane(x, bands)
            let height = freqValue * 12 * zoneIntensity
            
            const travelWave = Math.sin(z * 0.2 - time * 4) * bands.midSmooth * 5 * zoneIntensity * config.midInfluence
            height += travelWave
            
            const distFromCenter = Math.abs(x - config.laneCount / 2)
            const beatRing = Math.sin((distFromCenter * config.roadCurvature + z * 0.15) - time * 8) * 
              bands.beatIntensity * 8 * zoneIntensity * config.beatReactivity
            height += beatRing
            
            if (config.showSidelines && (x % 8 === 0 || x % 8 === 7)) {
              height += bands.highSmooth * 3 * zoneIntensity * config.highInfluence
            }
            if (Math.abs(x - config.laneCount / 2) < 2) {
              height += bands.bassSmooth * 4 * zoneIntensity * config.bassInfluence
            }
            
            const stereoEffect = bands.stereoBalance * (x - config.laneCount / 2) / config.laneCount * 8 * config.stereoSeparation
            height += stereoEffect * zoneIntensity
            
            if (normalizedZ > VIEW_ZONE_NEAR && normalizedZ < VIEW_ZONE_FAR) {
              if (Math.random() < 0.005 && bands.brillianceSmooth > 0.4) {
                height += bands.brillianceSmooth * 12 * config.highInfluence
              }
            }
            
            height = Math.round(height * 2) / 2
            targetHeights[z][x] = height
            terrainHeights[z][x] += (targetHeights[z][x] - terrainHeights[z][x]) * config.smoothingFactor
          }
        }
        
        let vertexIndex = 0
        
        // Horizontal lines
        for (let z = 0; z < config.horizonDistance; z++) {
          const zPos = z * config.cellSize - scrollOffset
          const perspScale = getPerspectiveScale(z)
          const zoneIntensity = getZoneIntensity(z)
          
          for (let x = 0; x < config.laneCount - 1; x++) {
            const x1World = (x * config.cellSize - halfWidth) * perspScale
            const x2World = ((x + 1) * config.cellSize - halfWidth) * perspScale
            
            const height1 = terrainHeights[z][x]
            const height2 = terrainHeights[z][x + 1]
            
            const y1 = getPerspectiveY(config.cameraHeight + height1, z)
            const y2 = getPerspectiveY(config.cameraHeight + height2, z)
            
            pos[vertexIndex * 3] = x1World
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -zPos
            
            pos[(vertexIndex + 1) * 3] = x2World
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -zPos
            
            const lanePosition = x / (config.laneCount - 1)
            const avgHeight = (height1 + height2) / 2
            const heightRatio = Math.min(1, Math.abs(avgHeight) / 15)
            
            const [r, g, b] = getColorForPosition(lanePosition, heightRatio, cycleHue, bands, speedRatio)
            
            const brightness = (0.3 + heightRatio * 0.5 + bands.beatIntensity * 0.2 * config.beatReactivity) * zoneIntensity
            
            col[vertexIndex * 3] = r * brightness
            col[vertexIndex * 3 + 1] = g * brightness
            col[vertexIndex * 3 + 2] = b * brightness
            col[(vertexIndex + 1) * 3] = r * brightness
            col[(vertexIndex + 1) * 3 + 1] = g * brightness
            col[(vertexIndex + 1) * 3 + 2] = b * brightness
            
            vertexIndex += 2
          }
        }
        
        // Vertical lines
        for (let x = 0; x < config.laneCount; x++) {
          const lanePosition = x / (config.laneCount - 1)
          
          for (let z = 0; z < config.horizonDistance - 1; z++) {
            const z1Pos = z * config.cellSize - scrollOffset
            const z2Pos = (z + 1) * config.cellSize - scrollOffset
            
            const perspScale1 = getPerspectiveScale(z)
            const perspScale2 = getPerspectiveScale(z + 1)
            
            const xWorld1 = (x * config.cellSize - halfWidth) * perspScale1
            const xWorld2 = (x * config.cellSize - halfWidth) * perspScale2
            
            const height1 = terrainHeights[z][x]
            const height2 = terrainHeights[z + 1][x]
            
            const y1 = getPerspectiveY(config.cameraHeight + height1, z)
            const y2 = getPerspectiveY(config.cameraHeight + height2, z + 1)
            
            pos[vertexIndex * 3] = xWorld1
            pos[vertexIndex * 3 + 1] = y1
            pos[vertexIndex * 3 + 2] = -z1Pos
            
            pos[(vertexIndex + 1) * 3] = xWorld2
            pos[(vertexIndex + 1) * 3 + 1] = y2
            pos[(vertexIndex + 1) * 3 + 2] = -z2Pos
            
            const zoneIntensity = (getZoneIntensity(z) + getZoneIntensity(z + 1)) / 2
            const avgHeight = (height1 + height2) / 2
            const heightRatio = Math.min(1, Math.abs(avgHeight) / 15)
            
            const [r, g, b] = getColorForPosition(lanePosition + 0.15, heightRatio, cycleHue, bands, speedRatio)
            
            const brightness = (0.25 + heightRatio * 0.4 + bands.beatIntensity * 0.15 * config.beatReactivity) * zoneIntensity
            
            col[vertexIndex * 3] = r * brightness
            col[vertexIndex * 3 + 1] = g * brightness
            col[vertexIndex * 3 + 2] = b * brightness
            col[(vertexIndex + 1) * 3] = r * brightness
            col[(vertexIndex + 1) * 3 + 1] = g * brightness
            col[(vertexIndex + 1) * 3 + 2] = b * brightness
            
            vertexIndex += 2
          }
        }
        
        // Update road line meshes (thick dashed white lines)
        if (config.showRoadLines && roadLineMeshes.length > 0) {
          const dashCycle = config.roadLineDashLength + config.roadLineGapLength
          const roadScrollOffset = (time * currentSpeed) % dashCycle
          
          for (let i = 0; i < ROAD_LINE_COUNT; i++) {
            const dashCenterZ = i * dashCycle - roadScrollOffset + config.roadLineDashLength / 2
            
            // Get perspective for this dash
            const zIndex = Math.max(0, Math.min(config.horizonDistance - 1, Math.floor(dashCenterZ / config.cellSize)))
            const perspScale = getPerspectiveScale(zIndex)
            const zoneIntensity = getZoneIntensity(zIndex)
            
            // Get height at center of road
            const centerLane = Math.floor(config.laneCount / 2)
            const height = terrainHeights[zIndex] ? terrainHeights[zIndex][centerLane] || 0 : 0
            
            const y = getPerspectiveY(config.cameraHeight + height + 0.5, zIndex)
            
            // Hide dashes that are behind camera or too far
            const visible = dashCenterZ > 0 && dashCenterZ < config.horizonDistance * config.cellSize
            
            // Update main dash mesh
            const dashMesh = roadLineMeshes[i]
            dashMesh.position.set(0, y, -dashCenterZ)
            dashMesh.scale.set(perspScale, 1, 1)
            dashMesh.visible = visible
            
            // Update glow mesh
            const glowMesh = roadLineGlowMeshes[i]
            glowMesh.position.set(0, y - 0.1, -dashCenterZ)
            glowMesh.scale.set(perspScale, 1, 1)
            glowMesh.visible = visible
          }
          
          // Update material opacity based on audio
          if (roadLineMaterial) {
            roadLineMaterial.opacity = config.roadLineIntensity * (0.8 + bands.bassSmooth * 0.2)
          }
          if (roadLineGlowMaterial) {
            roadLineGlowMaterial.opacity = config.roadLineGlow * (0.6 + bands.bassSmooth * 0.4)
          }
        }
        
        // Update horizon glow with beat reactivity
        if (horizonGlowMesh && horizonGlowMaterial) {
          horizonGlowMaterial.uniforms.time.value = time
          horizonGlowMaterial.uniforms.intensity.value = config.horizonGlowIntensity
          horizonGlowMaterial.uniforms.beatIntensity.value = smoothedBeatIntensity
          
          // Update glow color from gradient
          const [gr, gg, gb] = sampleGradient(config.gradient, 0.7 + cycleHue * 0.1)
          horizonGlowMaterial.uniforms.glowColor.value.setRGB(gr, gg, gb)
          
          // Update position to follow camera sway
          const horizonY = getPerspectiveY(config.cameraHeight, config.horizonDistance - 1) + config.horizonGlowHeight / 2 - 5
          horizonGlowMesh.position.y = horizonY
        }
        
        // Update material opacity
        if (lineMaterial) {
          lineMaterial.opacity = config.lineGlow
        }
        
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      },
      dispose: () => {
        if (lineGeometry) lineGeometry.dispose()
        if (lineMaterial) lineMaterial.dispose()
        if (lineSegments) scene.remove(lineSegments)
        
        roadLineMeshes.forEach(mesh => {
          mesh.geometry.dispose()
          scene.remove(mesh)
        })
        roadLineGlowMeshes.forEach(mesh => {
          mesh.geometry.dispose()
          scene.remove(mesh)
        })
        if (roadLineMaterial) roadLineMaterial.dispose()
        if (roadLineGlowMaterial) roadLineGlowMaterial.dispose()
        
        if (horizonGlowMesh) {
          horizonGlowMesh.geometry.dispose()
          scene.remove(horizonGlowMesh)
        }
        if (horizonGlowMaterial) horizonGlowMaterial.dispose()
        
        lineGeometry = null
        lineMaterial = null
        lineSegments = null
        roadLineMeshes = []
        roadLineGlowMeshes = []
        roadLineMaterial = null
        roadLineGlowMaterial = null
        horizonGlowMesh = null
        horizonGlowMaterial = null
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

// ============================================================================
// PUBLIC API - Configuration Functions
// ============================================================================

export function setRoadwayConfig(newConfig: Partial<RoadwayConfig>): void {
  config = { ...config, ...newConfig }
  initRoadway()
}

export function getRoadwayConfig(): RoadwayConfig {
  return { ...config }
}

export function setRoadwayGradient(gradient: GradientPreset): void {
  config.gradient = gradient
}

export function setRoadwayColorMode(mode: RoadwayConfig['colorMode']): void {
  config.colorMode = mode
}

export function setRoadwayLaneParams(params: {
  laneCount?: number
  roadWidth?: number
  horizonDistance?: number
  roadCurvature?: number
  cellSize?: number
}): void {
  if (params.laneCount !== undefined) config.laneCount = params.laneCount
  if (params.roadWidth !== undefined) config.roadWidth = params.roadWidth
  if (params.horizonDistance !== undefined) config.horizonDistance = params.horizonDistance
  if (params.roadCurvature !== undefined) config.roadCurvature = params.roadCurvature
  if (params.cellSize !== undefined) config.cellSize = params.cellSize
  initRoadway()
}

export function setRoadwayLineParams(params: {
  lineSpeed?: number
  lineSpeedBoost?: number
  lineLength?: number
  lineGap?: number
  showSidelines?: boolean
  lineGlow?: number
}): void {
  if (params.lineSpeed !== undefined) config.lineSpeed = params.lineSpeed
  if (params.lineSpeedBoost !== undefined) config.lineSpeedBoost = params.lineSpeedBoost
  if (params.lineLength !== undefined) config.lineLength = params.lineLength
  if (params.lineGap !== undefined) config.lineGap = params.lineGap
  if (params.showSidelines !== undefined) config.showSidelines = params.showSidelines
  if (params.lineGlow !== undefined) config.lineGlow = params.lineGlow
}

export function setRoadwayEffects(params: {
  beatReactivity?: number
  cameraHeight?: number
  cameraSway?: number
  cameraSwaySpeed?: number
  fogDensity?: number
  perspectiveIntensity?: number
}): void {
  if (params.beatReactivity !== undefined) config.beatReactivity = params.beatReactivity
  if (params.cameraHeight !== undefined) config.cameraHeight = params.cameraHeight
  if (params.cameraSway !== undefined) config.cameraSway = params.cameraSway
  if (params.cameraSwaySpeed !== undefined) config.cameraSwaySpeed = params.cameraSwaySpeed
  if (params.fogDensity !== undefined) config.fogDensity = params.fogDensity
  if (params.perspectiveIntensity !== undefined) config.perspectiveIntensity = params.perspectiveIntensity
}

export function setRoadwayAudioResponse(params: {
  bassInfluence?: number
  midInfluence?: number
  highInfluence?: number
  stereoSeparation?: number
  smoothingFactor?: number
}): void {
  if (params.bassInfluence !== undefined) config.bassInfluence = params.bassInfluence
  if (params.midInfluence !== undefined) config.midInfluence = params.midInfluence
  if (params.highInfluence !== undefined) config.highInfluence = params.highInfluence
  if (params.stereoSeparation !== undefined) config.stereoSeparation = params.stereoSeparation
  if (params.smoothingFactor !== undefined) config.smoothingFactor = params.smoothingFactor
}

export function setRoadwayRoadLines(params: {
  showRoadLines?: boolean
  roadLineWidth?: number
  roadLineDashLength?: number
  roadLineGapLength?: number
  roadLineIntensity?: number
  roadLineGlow?: number
}): void {
  if (params.showRoadLines !== undefined) config.showRoadLines = params.showRoadLines
  if (params.roadLineWidth !== undefined) config.roadLineWidth = params.roadLineWidth
  if (params.roadLineDashLength !== undefined) config.roadLineDashLength = params.roadLineDashLength
  if (params.roadLineGapLength !== undefined) config.roadLineGapLength = params.roadLineGapLength
  if (params.roadLineIntensity !== undefined) config.roadLineIntensity = params.roadLineIntensity
  if (params.roadLineGlow !== undefined) config.roadLineGlow = params.roadLineGlow
}

export function setRoadwayHorizonGlow(params: {
  showHorizonGlow?: boolean
  horizonGlowIntensity?: number
  horizonGlowHeight?: number
  horizonGlowColor?: [number, number, number]
  horizonGlowBeatReactivity?: number
}): void {
  if (params.showHorizonGlow !== undefined) config.showHorizonGlow = params.showHorizonGlow
  if (params.horizonGlowIntensity !== undefined) config.horizonGlowIntensity = params.horizonGlowIntensity
  if (params.horizonGlowHeight !== undefined) config.horizonGlowHeight = params.horizonGlowHeight
  if (params.horizonGlowColor !== undefined) config.horizonGlowColor = params.horizonGlowColor
  if (params.horizonGlowBeatReactivity !== undefined) config.horizonGlowBeatReactivity = params.horizonGlowBeatReactivity
}

export function resetRoadwayConfig(): void {
  config = { ...DEFAULT_CONFIG }
  initRoadway()
}
