import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient, sampleGradientByLevel, type GradientPreset } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// CONFIGURATION - AudioMotion-inspired setLedParams() pattern
// ============================================================================

export interface SpectrumConfig {
  // Bar layout
  numBars: number
  barWidth: number
  barGap: number
  maxBarHeight: number
  baseHeight: number
  roundedTops: boolean
  roundRadius: number

  // LED segmentation (like AudioMotion's trueLeds)
  ledBars: boolean
  maxLeds: number
  ledSpaceV: number  // Vertical gap ratio (0-1)
  ledSpaceH: number  // Horizontal gap ratio (0-1)

  // Peak indicators
  showPeaks: boolean
  peakHoldTime: number  // ms
  peakDecayRate: number
  peakHeight: number
  peakGlow: boolean

  // Reflection (reflex effect)
  showReflex: boolean
  reflexRatio: number   // 0-1, portion of height for reflection
  reflexAlpha: number   // 0-1, reflection opacity
  reflexBright: number  // Brightness multiplier

  // Color modes
  colorMode: 'gradient' | 'bar-index' | 'bar-level' | 'frequency'
  gradient: GradientPreset

  // 2D overlay
  showScale: boolean
  showFreqLabels: boolean
  labelColor: string
  labelFont: string

  // Animation
  spinEnabled: boolean
  spinSpeed: number

  // Smoothing
  smoothingFactor: number
}

const DEFAULT_CONFIG: SpectrumConfig = {
  numBars: 64,
  barWidth: 0.7,
  barGap: 0.25,
  maxBarHeight: 28,
  baseHeight: 0.3,
  roundedTops: true,
  roundRadius: 0.15,

  ledBars: true,
  maxLeds: 24,
  ledSpaceV: 0.12,
  ledSpaceH: 0.08,

  showPeaks: true,
  peakHoldTime: 800,
  peakDecayRate: 0.012,
  peakHeight: 0.25,
  peakGlow: true,

  showReflex: true,
  reflexRatio: 0.35,
  reflexAlpha: 0.25,
  reflexBright: 0.7,

  colorMode: 'gradient',
  gradient: builtInGradients.classic,

  showScale: true,
  showFreqLabels: true,
  labelColor: 'rgba(255, 255, 255, 0.5)',
  labelFont: '10px "JetBrains Mono", monospace',

  spinEnabled: false,
  spinSpeed: 0.0005,

  smoothingFactor: 0.25
}

let config: SpectrumConfig = { ...DEFAULT_CONFIG }

// ============================================================================
// STATE
// ============================================================================

interface BarState {
  height: number
  targetHeight: number
  peakHeight: number
  peakHoldTimer: number
  velocity: number
  ledStates: number[]  // Brightness per LED segment
}

const barStates: BarState[] = []

// Three.js objects
let barGroup: THREE.Group | null = null
let reflexGroup: THREE.Group | null = null
let peakGroup: THREE.Group | null = null
let basePlaneMesh: THREE.Mesh | null = null
let glowLayer: THREE.Points | null = null

// Instanced meshes for performance
let barInstancedMesh: THREE.InstancedMesh | null = null
let ledInstancedMesh: THREE.InstancedMesh | null = null
let reflexInstancedMesh: THREE.InstancedMesh | null = null
let peakInstancedMesh: THREE.InstancedMesh | null = null

// 2D Canvas overlay
let canvasTexture: THREE.CanvasTexture | null = null
let overlayMesh: THREE.Mesh | null = null
let overlayCanvas: HTMLCanvasElement | null = null
let overlayCtx: CanvasRenderingContext2D | null = null

// Timing
let lastUpdateTime = 0

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function initBarStates() {
  barStates.length = 0
  for (let i = 0; i < config.numBars; i++) {
    barStates.push({
      height: config.baseHeight,
      targetHeight: config.baseHeight,
      peakHeight: config.baseHeight,
      peakHoldTimer: 0,
      velocity: 0,
      ledStates: new Array(config.maxLeds).fill(0)
    })
  }
}

function getFrequencyForBar(barIndex: number, bands: AudioBands): number {
  const t = barIndex / config.numBars

  // Logarithmic frequency mapping for more musical response
  // Maps bars to frequency bands with emphasis on bass/mids
  if (t < 0.08) {
    // Sub-bass region
    const localT = t / 0.08
    return bands.subBassSmooth * (1 - localT) + bands.bassSmooth * localT
  } else if (t < 0.2) {
    // Bass region
    const localT = (t - 0.08) / 0.12
    return bands.bassSmooth * (1 - localT) + bands.lowMidSmooth * localT
  } else if (t < 0.4) {
    // Low-mid region
    const localT = (t - 0.2) / 0.2
    return bands.lowMidSmooth * (1 - localT) + bands.midSmooth * localT
  } else if (t < 0.6) {
    // Mid region
    const localT = (t - 0.4) / 0.2
    return bands.midSmooth * (1 - localT) + bands.highMidSmooth * localT
  } else if (t < 0.8) {
    // High-mid region
    const localT = (t - 0.6) / 0.2
    return bands.highMidSmooth * (1 - localT) + bands.trebleSmooth * localT
  } else {
    // Treble/brilliance region
    const localT = (t - 0.8) / 0.2
    return bands.trebleSmooth * (1 - localT) + bands.brillianceSmooth * localT
  }
}

function getColorForBar(barIndex: number, heightRatio: number, cycleHue: number): [number, number, number] {
  const t = barIndex / config.numBars

  switch (config.colorMode) {
    case 'bar-level':
      return sampleGradientByLevel(config.gradient, heightRatio)

    case 'bar-index': {
      const stops = config.gradient.colorStops
      const stopIndex = barIndex % stops.length
      const stopT = stopIndex / Math.max(1, stops.length - 1)
      return sampleGradient(config.gradient, stopT)
    }

    case 'frequency':
      // Color based on frequency position
      return sampleGradient(config.gradient, t)

    case 'gradient':
    default:
      // Classic gradient with slight height influence and cycle
      return sampleGradient(config.gradient, t * 0.7 + heightRatio * 0.2 + cycleHue * 0.1)
  }
}

function createRoundedBarGeometry(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
  if (!config.roundedTops || radius <= 0) {
    return new THREE.BoxGeometry(width, height, depth)
  }

  // Create a rounded top bar using ExtrudeGeometry
  const shape = new THREE.Shape()
  const hw = width / 2
  const r = Math.min(radius, hw, height / 2)

  shape.moveTo(-hw, 0)
  shape.lineTo(-hw, height - r)
  shape.quadraticCurveTo(-hw, height, -hw + r, height)
  shape.lineTo(hw - r, height)
  shape.quadraticCurveTo(hw, height, hw, height - r)
  shape.lineTo(hw, 0)
  shape.lineTo(-hw, 0)

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: false
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.translate(0, 0, -depth / 2)
  geometry.rotateX(Math.PI / 2)

  return geometry
}

function createLedSegmentGeometry(): THREE.BufferGeometry {
  const ledHeight = (config.maxBarHeight / config.maxLeds) * (1 - config.ledSpaceV)
  const ledWidth = config.barWidth * (1 - config.ledSpaceH)

  if (config.roundedTops) {
    return createRoundedBarGeometry(ledWidth, ledHeight, config.barWidth * 0.4, config.roundRadius * 0.5)
  }
  return new THREE.BoxGeometry(ledWidth, ledHeight, config.barWidth * 0.4)
}

// ============================================================================
// 2D CANVAS OVERLAY
// ============================================================================

function initCanvasOverlay(scene: THREE.Scene): void {
  if (overlayCanvas) return // Already initialized

  overlayCanvas = document.createElement('canvas')
  overlayCanvas.width = 1024
  overlayCanvas.height = 256
  overlayCtx = overlayCanvas.getContext('2d')

  canvasTexture = new THREE.CanvasTexture(overlayCanvas)
  canvasTexture.minFilter = THREE.LinearFilter
  canvasTexture.magFilter = THREE.LinearFilter

  const overlayMaterial = new THREE.MeshBasicMaterial({
    map: canvasTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })

  const totalWidth = config.numBars * (config.barWidth + config.barGap) - config.barGap
  const overlayGeometry = new THREE.PlaneGeometry(totalWidth * 1.2, 8)
  overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial)
  overlayMesh.position.set(0, -4, 5)
  overlayMesh.renderOrder = 999
  scene.add(overlayMesh)
}

function updateCanvasOverlay(bands: AudioBands): void {
  if (!overlayCtx || !overlayCanvas || !canvasTexture) return
  if (!config.showScale && !config.showFreqLabels) return

  const ctx = overlayCtx
  const w = overlayCanvas.width
  const h = overlayCanvas.height

  ctx.clearRect(0, 0, w, h)

  if (config.showScale) {
    // Draw dB scale on right side
    ctx.fillStyle = config.labelColor
    ctx.font = config.labelFont
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const dbLevels = [0, -6, -12, -18, -24, -30]
    dbLevels.forEach((db, i) => {
      const y = 20 + (i / (dbLevels.length - 1)) * (h - 40)
      ctx.fillText(`${db}dB`, w - 10, y)

      // Draw horizontal grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.beginPath()
      ctx.moveTo(60, y)
      ctx.lineTo(w - 60, y)
      ctx.stroke()
    })
  }

  if (config.showFreqLabels) {
    // Draw frequency labels at bottom
    ctx.fillStyle = config.labelColor
    ctx.font = config.labelFont
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const freqLabels = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']
    const padding = 60
    const usableWidth = w - padding * 2

    freqLabels.forEach((freq, i) => {
      // Logarithmic positioning
      const t = i / (freqLabels.length - 1)
      const x = padding + t * usableWidth
      ctx.fillText(freq, x, h - 25)
    })

    ctx.fillText('Hz', w - 30, h - 25)
  }

  // Draw BPM if detected
  if (bands.estimatedBPM > 0) {
    ctx.fillStyle = 'rgba(0, 255, 136, 0.8)'
    ctx.font = 'bold 14px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${bands.estimatedBPM} BPM`, 10, 20)
  }

  canvasTexture.needsUpdate = true
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const spectrumAnalyzer: VisualizationMode = {
  id: 'spectrum_analyzer',
  name: 'Spectrum Analyzer',
  description: 'Professional spectrum analyzer with LED segments, peak hold, and reflection',
  hideParticles: true,  // We use instanced meshes instead

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initBarStates()
    lastUpdateTime = 0

    // Hide all particles (we'll use instanced meshes)
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
    // Cleanup previous
    disposeAll(scene)

    const totalWidth = config.numBars * (config.barWidth + config.barGap) - config.barGap
    const startX = -totalWidth / 2 + config.barWidth / 2

    // Create groups
    barGroup = new THREE.Group()
    reflexGroup = new THREE.Group()
    peakGroup = new THREE.Group()
    scene.add(barGroup)
    scene.add(reflexGroup)
    scene.add(peakGroup)

    // ========================================
    // LED BARS (Instanced Mesh)
    // ========================================
    if (config.ledBars) {
      const ledGeometry = createLedSegmentGeometry()
      const ledMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })

      const totalLeds = config.numBars * config.maxLeds
      ledInstancedMesh = new THREE.InstancedMesh(ledGeometry, ledMaterial, totalLeds)
      ledInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      // Initialize instance colors
      const ledColors = new Float32Array(totalLeds * 3)
      ledInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(ledColors, 3)

      barGroup.add(ledInstancedMesh)
    } else {
      // Solid bars mode
      const barGeometry = createRoundedBarGeometry(config.barWidth, 1, config.barWidth * 0.5, config.roundRadius)
      const barMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })

      barInstancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, config.numBars)
      barInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      const barColors = new Float32Array(config.numBars * 3)
      barInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(barColors, 3)

      barGroup.add(barInstancedMesh)
    }

    // ========================================
    // PEAK INDICATORS
    // ========================================
    if (config.showPeaks) {
      const peakGeometry = new THREE.BoxGeometry(
        config.barWidth * 0.9,
        config.peakHeight,
        config.barWidth * 0.3
      )
      const peakMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })

      peakInstancedMesh = new THREE.InstancedMesh(peakGeometry, peakMaterial, config.numBars)
      peakInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      const peakColors = new Float32Array(config.numBars * 3)
      peakInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(peakColors, 3)

      peakGroup.add(peakInstancedMesh)

      // Glow sprites for peaks
      if (config.peakGlow) {
        const glowPositions = new Float32Array(config.numBars * 3)
        const glowColors = new Float32Array(config.numBars * 3)
        const glowSizes = new Float32Array(config.numBars)

        const glowGeometry = new THREE.BufferGeometry()
        glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3))
        glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3))
        glowGeometry.setAttribute('size', new THREE.BufferAttribute(glowSizes, 1))

        const glowMaterial = new THREE.PointsMaterial({
          size: 3,
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true
        })

        glowLayer = new THREE.Points(glowGeometry, glowMaterial)
        peakGroup.add(glowLayer)
      }
    }

    // ========================================
    // REFLECTION (Reflex)
    // ========================================
    if (config.showReflex) {
      if (config.ledBars) {
        const reflexLedGeometry = createLedSegmentGeometry()
        const reflexLedMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: config.reflexAlpha,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })

        const totalReflexLeds = config.numBars * Math.ceil(config.maxLeds * config.reflexRatio)
        reflexInstancedMesh = new THREE.InstancedMesh(reflexLedGeometry, reflexLedMaterial, totalReflexLeds)
        reflexInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        const reflexColors = new Float32Array(totalReflexLeds * 3)
        reflexInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(reflexColors, 3)

        reflexGroup.add(reflexInstancedMesh)
      }

      // Reflection gradient plane
      const reflexPlaneGeom = new THREE.PlaneGeometry(totalWidth * 1.3, config.maxBarHeight * config.reflexRatio)
      const reflexPlaneMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.15,
        color: 0x111122,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      const reflexPlane = new THREE.Mesh(reflexPlaneGeom, reflexPlaneMat)
      reflexPlane.position.set(0, -(config.maxBarHeight * config.reflexRatio) / 2 - 0.5, -1)
      reflexGroup.add(reflexPlane)
    }

    // ========================================
    // BASE PLANE
    // ========================================
    const basePlaneGeom = new THREE.PlaneGeometry(totalWidth * 1.4, 3)
    const basePlaneMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a15,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    })
    basePlaneMesh = new THREE.Mesh(basePlaneGeom, basePlaneMat)
    basePlaneMesh.rotation.x = -Math.PI / 2
    basePlaneMesh.position.y = -0.3
    scene.add(basePlaneMesh)

    // ========================================
    // 2D CANVAS OVERLAY - Initialize here
    // ========================================
    initCanvasOverlay(scene)

    // Dummy matrix for initialization
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    // Initialize LED positions
    if (config.ledBars && ledInstancedMesh) {
      const ledHeight = config.maxBarHeight / config.maxLeds
      let ledIndex = 0

      for (let bar = 0; bar < config.numBars; bar++) {
        const x = startX + bar * (config.barWidth + config.barGap)

        for (let led = 0; led < config.maxLeds; led++) {
          const y = led * ledHeight + ledHeight / 2
          dummy.position.set(x, y, 0)
          dummy.updateMatrix()
          ledInstancedMesh.setMatrixAt(ledIndex, dummy.matrix)

          const [r, g, b] = sampleGradient(config.gradient, bar / config.numBars)
          color.setRGB(r * 0.1, g * 0.1, b * 0.1)
          ledInstancedMesh.setColorAt(ledIndex, color)

          ledIndex++
        }
      }
      ledInstancedMesh.instanceMatrix.needsUpdate = true
      if (ledInstancedMesh.instanceColor) ledInstancedMesh.instanceColor.needsUpdate = true
    }

    // Initialize peak positions
    if (config.showPeaks && peakInstancedMesh) {
      for (let bar = 0; bar < config.numBars; bar++) {
        const x = startX + bar * (config.barWidth + config.barGap)
        dummy.position.set(x, config.baseHeight, 0)
        dummy.updateMatrix()
        peakInstancedMesh.setMatrixAt(bar, dummy.matrix)
        color.setRGB(1, 1, 1)
        peakInstancedMesh.setColorAt(bar, color)
      }
      peakInstancedMesh.instanceMatrix.needsUpdate = true
      if (peakInstancedMesh.instanceColor) peakInstancedMesh.instanceColor.needsUpdate = true
    }

    return {
      objects: [barGroup, reflexGroup, peakGroup, basePlaneMesh].filter(Boolean) as THREE.Object3D[],

      update: (bands: AudioBands, time: number) => {
        const dt = (time - lastUpdateTime) * 1000
        lastUpdateTime = time
        const cycleHue = getCyclingHue(time)

        const dummy = new THREE.Object3D()
        const color = new THREE.Color()
        const ledHeight = config.maxBarHeight / config.maxLeds

        // Update each bar
        for (let bar = 0; bar < config.numBars; bar++) {
          const state = barStates[bar]
          const freq = getFrequencyForBar(bar, bands)
          const x = startX + bar * (config.barWidth + config.barGap)

          // Calculate target height
          state.targetHeight = config.baseHeight + freq * (config.maxBarHeight - config.baseHeight) + bands.beatIntensity * 2

          // Spring physics for smooth animation
          const spring = config.smoothingFactor * 0.6
          const damping = 0.72
          state.velocity += (state.targetHeight - state.height) * spring
          state.velocity *= damping
          state.height += state.velocity
          state.height = Math.max(config.baseHeight, Math.min(config.maxBarHeight, state.height))

          // Peak hold logic
          if (state.height >= state.peakHeight) {
            state.peakHeight = state.height
            state.peakHoldTimer = config.peakHoldTime
          } else if (state.peakHoldTimer > 0) {
            state.peakHoldTimer -= dt
          } else {
            state.peakHeight -= config.peakDecayRate * (config.maxBarHeight - config.baseHeight)
            state.peakHeight = Math.max(state.height, state.peakHeight)
          }

          const heightRatio = state.height / config.maxBarHeight
          const [r, g, b] = getColorForBar(bar, heightRatio, cycleHue)

          // ========================================
          // UPDATE LEDS
          // ========================================
          if (config.ledBars && ledInstancedMesh) {
            const litLeds = Math.floor((state.height / config.maxBarHeight) * config.maxLeds)

            for (let led = 0; led < config.maxLeds; led++) {
              const ledIndex = bar * config.maxLeds + led
              const y = led * ledHeight + ledHeight / 2
              const isLit = led < litLeds

              // LED brightness with gradient falloff near top
              let brightness = isLit ? 0.85 : 0.05
              if (isLit && led >= litLeds - 2) {
                brightness = 0.95 + bands.beatIntensity * 0.1  // Brighter at tip
              }

              // Smooth LED state
              state.ledStates[led] = state.ledStates[led] * 0.7 + brightness * 0.3

              dummy.position.set(x, y, 0)
              dummy.scale.set(1, 1, 1)
              dummy.updateMatrix()
              ledInstancedMesh.setMatrixAt(ledIndex, dummy.matrix)

              const ledBrightness = state.ledStates[led]
              color.setRGB(r * ledBrightness, g * ledBrightness, b * ledBrightness)
              ledInstancedMesh.setColorAt(ledIndex, color)
            }
          }

          // ========================================
          // UPDATE PEAKS
          // ========================================
          if (config.showPeaks && peakInstancedMesh) {
            const peakY = state.peakHeight + config.peakHeight / 2

            dummy.position.set(x, peakY, 0.2)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            peakInstancedMesh.setMatrixAt(bar, dummy.matrix)

            // Peak color: white when holding, gradient color when falling
            const isHolding = state.peakHoldTimer > 0
            if (isHolding) {
              color.setRGB(1, 1, 1)
            } else {
              const fallProgress = 1 - (state.peakHeight / config.maxBarHeight)
              color.setRGB(
                r + (1 - r) * (1 - fallProgress) * 0.5,
                g + (1 - g) * (1 - fallProgress) * 0.5,
                b + (1 - b) * (1 - fallProgress) * 0.5
              )
            }
            peakInstancedMesh.setColorAt(bar, color)

            // Update glow layer
            if (config.peakGlow && glowLayer) {
              const glowPos = glowLayer.geometry.attributes.position.array as Float32Array
              const glowCol = glowLayer.geometry.attributes.color.array as Float32Array
              const glowSize = glowLayer.geometry.attributes.size.array as Float32Array

              glowPos[bar * 3] = x
              glowPos[bar * 3 + 1] = peakY
              glowPos[bar * 3 + 2] = 0.5

              const glowIntensity = isHolding ? 0.6 : 0.3
              glowCol[bar * 3] = r * glowIntensity
              glowCol[bar * 3 + 1] = g * glowIntensity
              glowCol[bar * 3 + 2] = b * glowIntensity

              glowSize[bar] = isHolding ? 4 : 2.5

              glowLayer.geometry.attributes.position.needsUpdate = true
              glowLayer.geometry.attributes.color.needsUpdate = true
              glowLayer.geometry.attributes.size.needsUpdate = true
            }
          }

          // ========================================
          // UPDATE REFLEX
          // ========================================
          if (config.showReflex && reflexInstancedMesh && config.ledBars) {
            const reflexLeds = Math.ceil(config.maxLeds * config.reflexRatio)
            const litReflexLeds = Math.min(reflexLeds, Math.floor((state.height / config.maxBarHeight) * reflexLeds))

            for (let led = 0; led < reflexLeds; led++) {
              const reflexIndex = bar * reflexLeds + led
              const y = -(led * ledHeight + ledHeight / 2) - 0.5
              const isLit = led < litReflexLeds

              // Fade out with distance from base
              const fadeRatio = 1 - (led / reflexLeds)
              const brightness = isLit ? 0.4 * fadeRatio * config.reflexBright : 0.02 * fadeRatio

              dummy.position.set(x, y, 0)
              dummy.scale.set(1, -1, 1)  // Flip for reflection
              dummy.updateMatrix()
              reflexInstancedMesh.setMatrixAt(reflexIndex, dummy.matrix)

              color.setRGB(r * brightness, g * brightness, b * brightness)
              reflexInstancedMesh.setColorAt(reflexIndex, color)
            }
          }
        }

        // Update instance matrices
        if (ledInstancedMesh) {
          ledInstancedMesh.instanceMatrix.needsUpdate = true
          if (ledInstancedMesh.instanceColor) ledInstancedMesh.instanceColor.needsUpdate = true
        }
        if (peakInstancedMesh) {
          peakInstancedMesh.instanceMatrix.needsUpdate = true
          if (peakInstancedMesh.instanceColor) peakInstancedMesh.instanceColor.needsUpdate = true
        }
        if (reflexInstancedMesh) {
          reflexInstancedMesh.instanceMatrix.needsUpdate = true
          if (reflexInstancedMesh.instanceColor) reflexInstancedMesh.instanceColor.needsUpdate = true
        }

        // Spin animation
        if (config.spinEnabled && barGroup) {
          barGroup.rotation.y += config.spinSpeed * (1 + bands.bassSmooth * 2)
          if (reflexGroup) reflexGroup.rotation.y = barGroup.rotation.y
          if (peakGroup) peakGroup.rotation.y = barGroup.rotation.y
        }

        // Update 2D overlay
        updateCanvasOverlay(bands)
      },

      dispose: () => {
        disposeAll(scene)
      }
    }
  },

  animate(
    positions: Float32Array,
    _originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    _bands: AudioBands,
    _time: number
  ) {
    // Particles are hidden, no animation needed
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
      colors[i * 3] = 0
      colors[i * 3 + 1] = 0
      colors[i * 3 + 2] = 0
    }
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

function disposeAll(scene: THREE.Scene): void {
  if (barGroup) {
    scene.remove(barGroup)
    barGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    barGroup = null
  }

  if (reflexGroup) {
    scene.remove(reflexGroup)
    reflexGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    reflexGroup = null
  }

  if (peakGroup) {
    scene.remove(peakGroup)
    peakGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Points) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    peakGroup = null
  }

  if (basePlaneMesh) {
    scene.remove(basePlaneMesh)
    basePlaneMesh.geometry.dispose()
    ;(basePlaneMesh.material as THREE.Material).dispose()
    basePlaneMesh = null
  }

  if (overlayMesh) {
    scene.remove(overlayMesh)
    overlayMesh.geometry.dispose()
    ;(overlayMesh.material as THREE.Material).dispose()
    overlayMesh = null
  }

  if (canvasTexture) {
    canvasTexture.dispose()
    canvasTexture = null
  }

  overlayCanvas = null
  overlayCtx = null
  ledInstancedMesh = null
  barInstancedMesh = null
  reflexInstancedMesh = null
  peakInstancedMesh = null
  glowLayer = null
}

// ============================================================================
// PUBLIC API - Configuration Functions
// ============================================================================

export function setSpectrumConfig(newConfig: Partial<SpectrumConfig>): void {
  config = { ...config, ...newConfig }
  initBarStates()
}

export function getSpectrumConfig(): SpectrumConfig {
  return { ...config }
}

export function setSpectrumGradient(gradient: GradientPreset): void {
  config.gradient = gradient
}

export function setSpectrumSmoothing(factor: number): void {
  config.smoothingFactor = Math.max(0.05, Math.min(0.5, factor))
}

export function setSpectrumColorMode(mode: SpectrumConfig['colorMode']): void {
  config.colorMode = mode
}

export function setSpectrumSpin(enabled: boolean, speed?: number): void {
  config.spinEnabled = enabled
  if (speed !== undefined) {
    config.spinSpeed = speed
  }
  // Reset rotation when disabling
  if (!enabled && barGroup) {
    barGroup.rotation.y = 0
    if (reflexGroup) reflexGroup.rotation.y = 0
    if (peakGroup) peakGroup.rotation.y = 0
  }
}

export function setLedParams(params: {
  maxLeds?: number
  spaceV?: number
  spaceH?: number
  enabled?: boolean
}): void {
  if (params.maxLeds !== undefined) config.maxLeds = params.maxLeds
  if (params.spaceV !== undefined) config.ledSpaceV = params.spaceV
  if (params.spaceH !== undefined) config.ledSpaceH = params.spaceH
  if (params.enabled !== undefined) config.ledBars = params.enabled
  initBarStates()
}

export function setReflexParams(params: {
  enabled?: boolean
  ratio?: number
  alpha?: number
  brightness?: number
}): void {
  if (params.enabled !== undefined) config.showReflex = params.enabled
  if (params.ratio !== undefined) config.reflexRatio = params.ratio
  if (params.alpha !== undefined) config.reflexAlpha = params.alpha
  if (params.brightness !== undefined) config.reflexBright = params.brightness
}

export function setPeakParams(params: {
  enabled?: boolean
  holdTime?: number
  decayRate?: number
  glow?: boolean
}): void {
  if (params.enabled !== undefined) config.showPeaks = params.enabled
  if (params.holdTime !== undefined) config.peakHoldTime = params.holdTime
  if (params.decayRate !== undefined) config.peakDecayRate = params.decayRate
  if (params.glow !== undefined) config.peakGlow = params.glow
}

export function setOverlayParams(params: {
  showScale?: boolean
  showFreqLabels?: boolean
  labelColor?: string
  labelFont?: string
}): void {
  if (params.showScale !== undefined) config.showScale = params.showScale
  if (params.showFreqLabels !== undefined) config.showFreqLabels = params.showFreqLabels
  if (params.labelColor !== undefined) config.labelColor = params.labelColor
  if (params.labelFont !== undefined) config.labelFont = params.labelFont
}
