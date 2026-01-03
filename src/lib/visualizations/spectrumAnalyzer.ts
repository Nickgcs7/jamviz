import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// SPECTRUM ANALYZER CONFIGURATION
// ============================================================================

const NUM_BARS = 64
const BAR_WIDTH = 0.8
const BAR_GAP = 0.3
const MAX_BAR_HEIGHT = 30
const BASE_HEIGHT = 0.5

const PEAK_HOLD_TIME = 1000
const PEAK_DECAY_RATE = 0.015
const PEAK_WIDTH = BAR_WIDTH * 0.9
const PEAK_HEIGHT = 0.3

const REFLECTION_OPACITY = 0.3
const REFLECTION_SCALE = 0.5

const BAR_PARTICLES = 3200
const PARTICLES_PER_BAR = 50
const REFLECTION_PARTICLES = 1600
const AMBIENT_PARTICLES = 400
const TOTAL_MANAGED = BAR_PARTICLES + REFLECTION_PARTICLES + AMBIENT_PARTICLES

let currentGradient = builtInGradients.classic

interface BarState {
  height: number
  targetHeight: number
  peakHeight: number
  peakHoldTimer: number
  velocity: number
}

const barStates: BarState[] = []

let barMeshes: THREE.Mesh[] = []
let barGeometries: THREE.BoxGeometry[] = []
let barMaterials: THREE.MeshBasicMaterial[] = []
let peakMeshes: THREE.Mesh[] = []
let peakGeometries: THREE.BoxGeometry[] = []
let peakMaterials: THREE.MeshBasicMaterial[] = []
let reflectionMeshes: THREE.Mesh[] = []
let reflectionMaterials: THREE.MeshBasicMaterial[] = []
let basePlaneMesh: THREE.Mesh | null = null
let basePlaneMaterial: THREE.MeshBasicMaterial | null = null

let lastUpdateTime = 0
let smoothingFactor = 0.25

function initBarStates() {
  barStates.length = 0
  for (let i = 0; i < NUM_BARS; i++) {
    barStates.push({
      height: BASE_HEIGHT,
      targetHeight: BASE_HEIGHT,
      peakHeight: BASE_HEIGHT,
      peakHoldTimer: 0,
      velocity: 0
    })
  }
}

function getFrequencyForBar(barIndex: number, bands: AudioBands): number {
  const t = barIndex / NUM_BARS
  
  if (t < 0.1) {
    const localT = t / 0.1
    return bands.subBassSmooth * (1 - localT) + bands.bassSmooth * localT
  } else if (t < 0.25) {
    const localT = (t - 0.1) / 0.15
    return bands.bassSmooth * (1 - localT) + bands.lowMidSmooth * localT
  } else if (t < 0.45) {
    const localT = (t - 0.25) / 0.2
    return bands.lowMidSmooth * (1 - localT) + bands.midSmooth * localT
  } else if (t < 0.65) {
    const localT = (t - 0.45) / 0.2
    return bands.midSmooth * (1 - localT) + bands.highMidSmooth * localT
  } else if (t < 0.85) {
    const localT = (t - 0.65) / 0.2
    return bands.highMidSmooth * (1 - localT) + bands.trebleSmooth * localT
  } else {
    const localT = (t - 0.85) / 0.15
    return bands.trebleSmooth * (1 - localT) + bands.brillianceSmooth * localT
  }
}

export const spectrumAnalyzer: VisualizationMode = {
  id: 'spectrum_analyzer',
  name: 'Spectrum Analyzer',
  description: 'Classic vertical bar spectrum with peak hold indicators and reflection',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initBarStates()
    lastUpdateTime = 0

    const totalWidth = NUM_BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP
    const startX = -totalWidth / 2 + BAR_WIDTH / 2

    for (let i = 0; i < count; i++) {
      if (i < BAR_PARTICLES) {
        const barIndex = Math.floor(i / PARTICLES_PER_BAR)
        const vertIndex = i % PARTICLES_PER_BAR
        
        if (barIndex < NUM_BARS) {
          const x = startX + barIndex * (BAR_WIDTH + BAR_GAP)
          const y = (vertIndex / PARTICLES_PER_BAR) * MAX_BAR_HEIGHT
          const z = (Math.random() - 0.5) * BAR_WIDTH * 0.3
          
          positions[i * 3] = x + (Math.random() - 0.5) * BAR_WIDTH * 0.8
          positions[i * 3 + 1] = y
          positions[i * 3 + 2] = z
        } else {
          positions[i * 3] = 0
          positions[i * 3 + 1] = -200
          positions[i * 3 + 2] = 0
        }
        
        const t = (barIndex % NUM_BARS) / NUM_BARS
        const [r, g, b] = sampleGradient(currentGradient, t)
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      } else if (i < BAR_PARTICLES + REFLECTION_PARTICLES) {
        const idx = i - BAR_PARTICLES
        const barIndex = Math.floor(idx / (PARTICLES_PER_BAR / 2))
        const vertIndex = idx % (PARTICLES_PER_BAR / 2)
        
        if (barIndex < NUM_BARS) {
          const x = startX + barIndex * (BAR_WIDTH + BAR_GAP)
          const y = -(vertIndex / (PARTICLES_PER_BAR / 2)) * MAX_BAR_HEIGHT * REFLECTION_SCALE
          const z = (Math.random() - 0.5) * BAR_WIDTH * 0.3
          
          positions[i * 3] = x + (Math.random() - 0.5) * BAR_WIDTH * 0.8
          positions[i * 3 + 1] = y - 1
          positions[i * 3 + 2] = z
        } else {
          positions[i * 3] = 0
          positions[i * 3 + 1] = -200
          positions[i * 3 + 2] = 0
        }
        
        const t = (barIndex % NUM_BARS) / NUM_BARS
        const [r, g, b] = sampleGradient(currentGradient, t)
        colors[i * 3] = r * REFLECTION_OPACITY
        colors[i * 3 + 1] = g * REFLECTION_OPACITY
        colors[i * 3 + 2] = b * REFLECTION_OPACITY
      } else if (i < TOTAL_MANAGED) {
        positions[i * 3] = (Math.random() - 0.5) * totalWidth * 1.5
        positions[i * 3 + 1] = Math.random() * MAX_BAR_HEIGHT * 1.2
        positions[i * 3 + 2] = (Math.random() - 0.5) * 15
        
        const [r, g, b] = hslToRgb(Math.random(), 0.5, 0.4)
        colors[i * 3] = r * 0.5
        colors[i * 3 + 1] = g * 0.5
        colors[i * 3 + 2] = b * 0.5
      } else {
        positions[i * 3] = 0
        positions[i * 3 + 1] = -200
        positions[i * 3 + 2] = 0
      }
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    barMeshes.forEach(m => scene.remove(m))
    barGeometries.forEach(g => g.dispose())
    barMaterials.forEach(m => m.dispose())
    peakMeshes.forEach(m => scene.remove(m))
    peakGeometries.forEach(g => g.dispose())
    peakMaterials.forEach(m => m.dispose())
    reflectionMeshes.forEach(m => scene.remove(m))
    reflectionMaterials.forEach(m => m.dispose())
    if (basePlaneMesh) { scene.remove(basePlaneMesh); basePlaneMesh.geometry.dispose() }
    if (basePlaneMaterial) basePlaneMaterial.dispose()

    barMeshes = []
    barGeometries = []
    barMaterials = []
    peakMeshes = []
    peakGeometries = []
    peakMaterials = []
    reflectionMeshes = []
    reflectionMaterials = []

    const totalWidth = NUM_BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP
    const startX = -totalWidth / 2 + BAR_WIDTH / 2

    for (let i = 0; i < NUM_BARS; i++) {
      const barGeom = new THREE.BoxGeometry(BAR_WIDTH, BASE_HEIGHT, BAR_WIDTH * 0.5)
      const [r, g, b] = sampleGradient(currentGradient, i / NUM_BARS)
      const barMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(r, g, b),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      })
      const barMesh = new THREE.Mesh(barGeom, barMat)
      barMesh.position.set(startX + i * (BAR_WIDTH + BAR_GAP), BASE_HEIGHT / 2, 0)
      scene.add(barMesh)
      
      barMeshes.push(barMesh)
      barGeometries.push(barGeom)
      barMaterials.push(barMat)

      const peakGeom = new THREE.BoxGeometry(PEAK_WIDTH, PEAK_HEIGHT, BAR_WIDTH * 0.3)
      const peakMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1, 1, 1),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      })
      const peakMesh = new THREE.Mesh(peakGeom, peakMat)
      peakMesh.position.set(startX + i * (BAR_WIDTH + BAR_GAP), BASE_HEIGHT, 0)
      scene.add(peakMesh)
      
      peakMeshes.push(peakMesh)
      peakGeometries.push(peakGeom)
      peakMaterials.push(peakMat)

      const refMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(r * 0.5, g * 0.5, b * 0.5),
        transparent: true,
        opacity: REFLECTION_OPACITY,
        blending: THREE.AdditiveBlending
      })
      const refMesh = new THREE.Mesh(barGeom.clone(), refMat)
      refMesh.position.set(startX + i * (BAR_WIDTH + BAR_GAP), -BASE_HEIGHT / 2 - 1, 0)
      refMesh.scale.y = -REFLECTION_SCALE
      scene.add(refMesh)
      
      reflectionMeshes.push(refMesh)
      reflectionMaterials.push(refMat)
    }

    const planeGeom = new THREE.PlaneGeometry(totalWidth * 1.5, 5)
    basePlaneMaterial = new THREE.MeshBasicMaterial({
      color: 0x111122,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    })
    basePlaneMesh = new THREE.Mesh(planeGeom, basePlaneMaterial)
    basePlaneMesh.rotation.x = -Math.PI / 2
    basePlaneMesh.position.y = -0.5
    scene.add(basePlaneMesh)

    return {
      objects: [...barMeshes, ...peakMeshes, ...reflectionMeshes, basePlaneMesh],
      update: (bands: AudioBands, time: number) => {
        const dt = (time - lastUpdateTime) * 1000
        lastUpdateTime = time
        const cycleHue = getCyclingHue(time)

        for (let i = 0; i < NUM_BARS; i++) {
          const state = barStates[i]
          const freq = getFrequencyForBar(i, bands)
          
          state.targetHeight = BASE_HEIGHT + freq * (MAX_BAR_HEIGHT - BASE_HEIGHT) + bands.beatIntensity * 3
          
          const spring = 0.15
          const damping = 0.7
          state.velocity += (state.targetHeight - state.height) * spring
          state.velocity *= damping
          state.height += state.velocity
          state.height = Math.max(BASE_HEIGHT, Math.min(MAX_BAR_HEIGHT, state.height))

          if (state.height >= state.peakHeight) {
            state.peakHeight = state.height
            state.peakHoldTimer = PEAK_HOLD_TIME
          } else if (state.peakHoldTimer > 0) {
            state.peakHoldTimer -= dt
          } else {
            state.peakHeight -= PEAK_DECAY_RATE * (MAX_BAR_HEIGHT - BASE_HEIGHT)
            state.peakHeight = Math.max(state.height, state.peakHeight)
          }

          const barMesh = barMeshes[i]
          const barMat = barMaterials[i]
          if (barMesh && barMat) {
            barMesh.scale.y = state.height / BASE_HEIGHT
            barMesh.position.y = state.height / 2
            
            const heightRatio = state.height / MAX_BAR_HEIGHT
            const [r, g, b] = sampleGradient(currentGradient, (i / NUM_BARS) * 0.7 + heightRatio * 0.3 + cycleHue * 0.1)
            barMat.color.setRGB(r, g, b)
            barMat.opacity = 0.6 + heightRatio * 0.3 + bands.beatIntensity * 0.1
          }

          const peakMesh = peakMeshes[i]
          const peakMat = peakMaterials[i]
          if (peakMesh && peakMat) {
            peakMesh.position.y = state.peakHeight + PEAK_HEIGHT / 2
            
            const peakActive = state.peakHoldTimer > 0
            const [pr, pg, pb] = sampleGradient(currentGradient, i / NUM_BARS + cycleHue * 0.2)
            peakMat.color.setRGB(
              peakActive ? 1 : pr,
              peakActive ? 1 : pg,
              peakActive ? 1 : pb
            )
            peakMat.opacity = peakActive ? 0.95 : 0.6
          }

          const refMesh = reflectionMeshes[i]
          const refMat = reflectionMaterials[i]
          if (refMesh && refMat) {
            refMesh.scale.y = -(state.height / BASE_HEIGHT) * REFLECTION_SCALE
            refMesh.position.y = -(state.height * REFLECTION_SCALE) / 2 - 0.5
            
            const [r, g, b] = sampleGradient(currentGradient, i / NUM_BARS + cycleHue * 0.1)
            refMat.color.setRGB(r * 0.4, g * 0.4, b * 0.4)
          }
        }
      },
      dispose: () => {
        barMeshes.forEach(m => scene.remove(m))
        barGeometries.forEach(g => g.dispose())
        barMaterials.forEach(m => m.dispose())
        peakMeshes.forEach(m => scene.remove(m))
        peakGeometries.forEach(g => g.dispose())
        peakMaterials.forEach(m => m.dispose())
        reflectionMeshes.forEach(m => scene.remove(m))
        reflectionMaterials.forEach(m => m.dispose())
        if (basePlaneMesh) { scene.remove(basePlaneMesh); basePlaneMesh.geometry.dispose(); basePlaneMesh = null }
        if (basePlaneMaterial) { basePlaneMaterial.dispose(); basePlaneMaterial = null }
        
        barMeshes = []
        barGeometries = []
        barMaterials = []
        peakMeshes = []
        peakGeometries = []
        peakMaterials = []
        reflectionMeshes = []
        reflectionMaterials = []
      }
    }
  },

  animate(
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number
  ) {
    const cycleHue = getCyclingHue(time)
    const totalWidth = NUM_BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP
    const startX = -totalWidth / 2 + BAR_WIDTH / 2

    for (let i = 0; i < BAR_PARTICLES; i++) {
      const barIndex = Math.floor(i / PARTICLES_PER_BAR)
      const vertIndex = i % PARTICLES_PER_BAR
      
      if (barIndex < NUM_BARS) {
        const state = barStates[barIndex]
        const verticalPosition = (vertIndex / PARTICLES_PER_BAR) * MAX_BAR_HEIGHT
        const x = startX + barIndex * (BAR_WIDTH + BAR_GAP)
        
        const visible = verticalPosition <= state.height
        
        if (visible) {
          positions[i * 3] = x + (Math.random() - 0.5) * BAR_WIDTH * 0.6
          positions[i * 3 + 1] = verticalPosition
          positions[i * 3 + 2] = (Math.random() - 0.5) * BAR_WIDTH * 0.3
          
          const heightRatio = verticalPosition / MAX_BAR_HEIGHT
          const [r, g, b] = sampleGradient(currentGradient, (barIndex / NUM_BARS) * 0.6 + heightRatio * 0.4 + cycleHue * 0.1)
          const brightness = 0.6 + (1 - heightRatio) * 0.3 + bands.beatIntensity * 0.2
          colors[i * 3] = r * brightness
          colors[i * 3 + 1] = g * brightness
          colors[i * 3 + 2] = b * brightness
          
          sizes[i] = 1.2 + bands.beatIntensity * 0.5
        } else {
          positions[i * 3 + 1] = -200
          sizes[i] = 0
        }
      }
    }

    for (let i = 0; i < REFLECTION_PARTICLES; i++) {
      const particleIndex = BAR_PARTICLES + i
      const barIndex = Math.floor(i / (PARTICLES_PER_BAR / 2))
      const vertIndex = i % (PARTICLES_PER_BAR / 2)
      
      if (barIndex < NUM_BARS && particleIndex < count) {
        const state = barStates[barIndex]
        const reflectedHeight = state.height * REFLECTION_SCALE
        const verticalPosition = (vertIndex / (PARTICLES_PER_BAR / 2)) * reflectedHeight
        const x = startX + barIndex * (BAR_WIDTH + BAR_GAP)
        
        positions[particleIndex * 3] = x + (Math.random() - 0.5) * BAR_WIDTH * 0.6
        positions[particleIndex * 3 + 1] = -verticalPosition - 0.5
        positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * BAR_WIDTH * 0.3
        
        const fade = 1 - (vertIndex / (PARTICLES_PER_BAR / 2))
        const [r, g, b] = sampleGradient(currentGradient, barIndex / NUM_BARS + cycleHue * 0.1)
        colors[particleIndex * 3] = r * fade * REFLECTION_OPACITY
        colors[particleIndex * 3 + 1] = g * fade * REFLECTION_OPACITY
        colors[particleIndex * 3 + 2] = b * fade * REFLECTION_OPACITY
        
        sizes[particleIndex] = 0.8 * fade
      }
    }

    for (let i = 0; i < AMBIENT_PARTICLES; i++) {
      const particleIndex = BAR_PARTICLES + REFLECTION_PARTICLES + i
      if (particleIndex >= count) break
      
      const ox = originalPositions[particleIndex * 3]
      const oy = originalPositions[particleIndex * 3 + 1]
      const oz = originalPositions[particleIndex * 3 + 2]
      
      const drift = Math.sin(time + i * 0.3) * 2
      const rise = Math.sin(time * 0.5 + i * 0.1) * 1.5
      
      positions[particleIndex * 3] = ox + drift
      positions[particleIndex * 3 + 1] = oy + rise
      positions[particleIndex * 3 + 2] = oz + Math.sin(time * 0.3 + i * 0.2)
      
      const twinkle = 0.3 + Math.sin(time * 4 + i * 2.5) * 0.2
      const [r, g, b] = sampleGradient(currentGradient, (i / AMBIENT_PARTICLES) + cycleHue * 0.3)
      colors[particleIndex * 3] = r * twinkle
      colors[particleIndex * 3 + 1] = g * twinkle
      colors[particleIndex * 3 + 2] = b * twinkle
      
      sizes[particleIndex] = 0.6 + bands.overallSmooth * 0.3
    }

    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}

export function setSpectrumGradient(gradient: typeof currentGradient) {
  currentGradient = gradient
}

export function setSpectrumSmoothing(factor: number) {
  smoothingFactor = Math.max(0.05, Math.min(0.5, factor))
}