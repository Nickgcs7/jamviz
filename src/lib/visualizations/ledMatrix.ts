import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import * as THREE from 'three'

// ============================================================================
// LED MATRIX CONFIGURATION
// ============================================================================

// 5x7 bitmap font for uppercase letters, numbers, and common punctuation
const FONT: Record<string, number[]> = {
  'A': [0x7C, 0x12, 0x11, 0x12, 0x7C],
  'B': [0x7F, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7F, 0x41, 0x41, 0x22, 0x1C],
  'E': [0x7F, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
  'G': [0x3E, 0x41, 0x49, 0x49, 0x7A],
  'H': [0x7F, 0x08, 0x08, 0x08, 0x7F],
  'I': [0x00, 0x41, 0x7F, 0x41, 0x00],
  'J': [0x20, 0x40, 0x41, 0x3F, 0x01],
  'K': [0x7F, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7F, 0x02, 0x0C, 0x02, 0x7F],
  'N': [0x7F, 0x04, 0x08, 0x10, 0x7F],
  'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
  'P': [0x7F, 0x09, 0x09, 0x09, 0x06],
  'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E],
  'R': [0x7F, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7F, 0x01, 0x01],
  'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
  'V': [0x1F, 0x20, 0x40, 0x20, 0x1F],
  'W': [0x3F, 0x40, 0x38, 0x40, 0x3F],
  'X': [0x63, 0x14, 0x08, 0x14, 0x63],
  'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
  'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
  '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
  '1': [0x00, 0x42, 0x7F, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x00, 0x00, 0x5F, 0x00, 0x00],
  '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  ',': [0x00, 0x80, 0x60, 0x00, 0x00],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '+': [0x08, 0x08, 0x3E, 0x08, 0x08],
  '=': [0x14, 0x14, 0x14, 0x14, 0x14],
  '/': [0x20, 0x10, 0x08, 0x04, 0x02],
  '<': [0x08, 0x14, 0x22, 0x41, 0x00],
  '>': [0x00, 0x41, 0x22, 0x14, 0x08],
  '@': [0x3E, 0x41, 0x5D, 0x55, 0x1E],
  '#': [0x14, 0x7F, 0x14, 0x7F, 0x14],
  '$': [0x24, 0x2A, 0x7F, 0x2A, 0x12],
  '%': [0x23, 0x13, 0x08, 0x64, 0x62],
  '&': [0x36, 0x49, 0x55, 0x22, 0x50],
  '*': [0x14, 0x08, 0x3E, 0x08, 0x14],
  '(': [0x00, 0x1C, 0x22, 0x41, 0x00],
  ')': [0x00, 0x41, 0x22, 0x1C, 0x00],
  "'": [0x00, 0x00, 0x07, 0x00, 0x00],
  '"': [0x00, 0x07, 0x00, 0x07, 0x00],
  '_': [0x40, 0x40, 0x40, 0x40, 0x40],
  '^': [0x04, 0x02, 0x01, 0x02, 0x04],
  '~': [0x04, 0x02, 0x04, 0x08, 0x04],
  '[': [0x00, 0x7F, 0x41, 0x41, 0x00],
  ']': [0x00, 0x41, 0x41, 0x7F, 0x00],
  '{': [0x00, 0x08, 0x36, 0x41, 0x00],
  '}': [0x00, 0x41, 0x36, 0x08, 0x00],
  '|': [0x00, 0x00, 0x7F, 0x00, 0x00],
  '\\': [0x02, 0x04, 0x08, 0x10, 0x20],
  ';': [0x00, 0x80, 0x56, 0x00, 0x00]
}

// Matrix dimensions
const GRID_X = 64
const GRID_Y = 14
const TOTAL_PIXELS = GRID_X * GRID_Y
const CHAR_WIDTH = 5
const CHAR_HEIGHT = 7
const CHAR_SPACING = 1

// Display modes
type DisplayMode = 'text' | 'spectrum' | 'hybrid'
let displayMode: DisplayMode = 'text'

// LED appearance settings (matching AudioMotion setLedParams)
interface LedParams {
  maxLeds: number
  spaceH: number  // Horizontal gap ratio
  spaceV: number  // Vertical gap ratio
  glowSize: number
  glowIntensity: number
}

const ledParams: LedParams = {
  maxLeds: TOTAL_PIXELS,
  spaceH: 0.15,
  spaceV: 0.15,
  glowSize: 2.5,
  glowIntensity: 0.6
}

// Current state
let displayText = 'JAMVIZ'
let scrollOffset = 0
let textBitmap: boolean[][] = []
let scrollSpeed = 12

// Spectrum analyzer state
const spectrumBars = new Float32Array(GRID_X)
const spectrumPeaks = new Float32Array(GRID_X)
const peakHoldTimes = new Float32Array(GRID_X)

// Glow effect meshes
let glowGeometry: THREE.BufferGeometry | null = null
let glowMaterial: THREE.PointsMaterial | null = null
let glowPoints: THREE.Points | null = null

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateTextBitmap(text: string): boolean[][] {
  const upperText = text.toUpperCase()
  const totalWidth = upperText.length * (CHAR_WIDTH + CHAR_SPACING)
  const bitmap: boolean[][] = []
  
  for (let y = 0; y < CHAR_HEIGHT; y++) {
    bitmap[y] = new Array(totalWidth).fill(false)
  }
  
  let xOffset = 0
  for (const char of upperText) {
    const charData = FONT[char] || FONT[' ']
    for (let col = 0; col < CHAR_WIDTH; col++) {
      const columnBits = charData[col]
      for (let row = 0; row < CHAR_HEIGHT; row++) {
        if (columnBits & (1 << row)) {
          bitmap[row][xOffset + col] = true
        }
      }
    }
    xOffset += CHAR_WIDTH + CHAR_SPACING
  }
  
  return bitmap
}

function isTextPixelLit(gridX: number, gridY: number): boolean {
  if (textBitmap.length === 0) return false
  
  const bitmapWidth = textBitmap[0]?.length || 0
  const displayWidth = GRID_X
  
  const scrollX = Math.floor(scrollOffset) % (bitmapWidth + displayWidth)
  const textX = gridX + scrollX - displayWidth
  const fontRow = Math.floor(gridY / 2)
  
  if (textX >= 0 && textX < bitmapWidth && fontRow >= 0 && fontRow < CHAR_HEIGHT) {
    return textBitmap[fontRow][textX] || false
  }
  
  return false
}

function getSpectrumHeight(gridX: number, bands: AudioBands): number {
  // Map grid columns to frequency spectrum
  // Using log scale for more musical response
  const normalizedX = gridX / GRID_X
  const logX = Math.pow(normalizedX, 0.7) // Compress higher frequencies
  
  // Interpolate between frequency bands
  let value: number
  if (logX < 0.15) {
    // Sub-bass to bass
    value = bands.subBassSmooth * (1 - logX / 0.15) + bands.bassSmooth * (logX / 0.15)
  } else if (logX < 0.3) {
    // Bass to low-mid
    const t = (logX - 0.15) / 0.15
    value = bands.bassSmooth * (1 - t) + bands.lowMidSmooth * t
  } else if (logX < 0.5) {
    // Low-mid to mid
    const t = (logX - 0.3) / 0.2
    value = bands.lowMidSmooth * (1 - t) + bands.midSmooth * t
  } else if (logX < 0.7) {
    // Mid to high-mid
    const t = (logX - 0.5) / 0.2
    value = bands.midSmooth * (1 - t) + bands.highMidSmooth * t
  } else if (logX < 0.85) {
    // High-mid to treble
    const t = (logX - 0.7) / 0.15
    value = bands.highMidSmooth * (1 - t) + bands.trebleSmooth * t
  } else {
    // Treble to brilliance
    const t = (logX - 0.85) / 0.15
    value = bands.trebleSmooth * (1 - t) + bands.brillianceSmooth * t
  }
  
  return value
}

function updateSpectrumBars(bands: AudioBands, dt: number) {
  for (let x = 0; x < GRID_X; x++) {
    const targetHeight = getSpectrumHeight(x, bands)
    
    // Fast attack, slower decay
    if (targetHeight > spectrumBars[x]) {
      spectrumBars[x] += (targetHeight - spectrumBars[x]) * 0.4
    } else {
      spectrumBars[x] += (targetHeight - spectrumBars[x]) * 0.15
    }
    
    // Peak hold and decay
    if (spectrumBars[x] >= spectrumPeaks[x]) {
      spectrumPeaks[x] = spectrumBars[x]
      peakHoldTimes[x] = 500 // ms
    } else {
      peakHoldTimes[x] -= dt * 1000
      if (peakHoldTimes[x] <= 0) {
        spectrumPeaks[x] *= 0.95 // Decay
      }
    }
  }
}

function isSpectrumPixelLit(gridX: number, gridY: number): boolean {
  const barHeight = spectrumBars[gridX] * GRID_Y
  const invertedY = GRID_Y - 1 - gridY // Bars grow upward
  return invertedY < barHeight
}

function isPeakPixelLit(gridX: number, gridY: number): boolean {
  const peakRow = Math.floor(spectrumPeaks[gridX] * (GRID_Y - 1))
  const invertedY = GRID_Y - 1 - gridY
  return invertedY === peakRow && spectrumPeaks[gridX] > 0.05
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const ledMatrix: VisualizationMode = {
  id: 'led_matrix',
  name: 'LED Matrix',
  description: 'Times Square style LED wall with spectrum analyzer and scrolling text',
  
  textConfig: {
    enabled: true,
    placeholder: 'Enter text to display...',
    defaultText: 'JAMVIZ'
  },
  
  setText(text: string) {
    displayText = text || 'JAMVIZ'
    textBitmap = generateTextBitmap(displayText)
    scrollOffset = 0
  },

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    textBitmap = generateTextBitmap(displayText)
    scrollOffset = 0
    displayMode = 'text'
    
    // Reset spectrum state
    spectrumBars.fill(0)
    spectrumPeaks.fill(0)
    peakHoldTimes.fill(0)
    
    const pixelsPerLed = Math.floor(count / TOTAL_PIXELS)
    const ledSize = 1.0
    const gapSize = ledParams.spaceH
    const totalLedSize = ledSize + gapSize
    
    const offsetX = (GRID_X * totalLedSize) / 2
    const offsetY = (GRID_Y * totalLedSize) / 2
    
    for (let i = 0; i < count; i++) {
      const ledIndex = Math.floor(i / pixelsPerLed) % TOTAL_PIXELS
      const gridX = ledIndex % GRID_X
      const gridY = Math.floor(ledIndex / GRID_X)
      
      const localIndex = i % pixelsPerLed
      const localCols = Math.ceil(Math.sqrt(pixelsPerLed))
      const localX = (localIndex % localCols) / localCols * ledSize - ledSize / 2
      const localY = Math.floor(localIndex / localCols) / localCols * ledSize - ledSize / 2
      
      positions[i * 3] = gridX * totalLedSize - offsetX + localX + ledSize / 2
      positions[i * 3 + 1] = (GRID_Y - 1 - gridY) * totalLedSize - offsetY + localY + ledSize / 2
      positions[i * 3 + 2] = 0
      
      const [r, g, b] = hslToRgb(0.55, 0.7, 0.1)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    // Create glow layer behind LEDs
    const glowCount = TOTAL_PIXELS
    const glowPositions = new Float32Array(glowCount * 3)
    const glowColors = new Float32Array(glowCount * 3)
    
    const ledSize = 1.0
    const gapSize = ledParams.spaceH
    const totalLedSize = ledSize + gapSize
    const offsetX = (GRID_X * totalLedSize) / 2
    const offsetY = (GRID_Y * totalLedSize) / 2
    
    for (let i = 0; i < glowCount; i++) {
      const gridX = i % GRID_X
      const gridY = Math.floor(i / GRID_X)
      
      glowPositions[i * 3] = gridX * totalLedSize - offsetX + ledSize / 2
      glowPositions[i * 3 + 1] = (GRID_Y - 1 - gridY) * totalLedSize - offsetY + ledSize / 2
      glowPositions[i * 3 + 2] = -0.5 // Slightly behind
      
      glowColors[i * 3] = 0
      glowColors[i * 3 + 1] = 0
      glowColors[i * 3 + 2] = 0
    }
    
    glowGeometry = new THREE.BufferGeometry()
    glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3))
    glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3))
    
    glowMaterial = new THREE.PointsMaterial({
      size: ledParams.glowSize,
      vertexColors: true,
      transparent: true,
      opacity: ledParams.glowIntensity,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    })
    
    glowPoints = new THREE.Points(glowGeometry, glowMaterial)
    scene.add(glowPoints)
    
    let lastModeSwitch = 0
    
    return {
      objects: [glowPoints],
      update: (bands: AudioBands, time: number) => {
        if (!glowGeometry) return
        
        const colAttr = glowGeometry.getAttribute('color') as THREE.BufferAttribute
        const glowCol = colAttr.array as Float32Array
        const cycleHue = getCyclingHue(time)
        
        // Auto-switch display mode based on audio
        // Switch to spectrum on sustained high energy, back to text when quiet
        if (bands.overallSmooth > 0.5 && time - lastModeSwitch > 3) {
          if (displayMode === 'text') {
            displayMode = 'hybrid'
            lastModeSwitch = time
          }
        } else if (bands.overallSmooth < 0.15 && displayMode !== 'text' && time - lastModeSwitch > 5) {
          displayMode = 'text'
          lastModeSwitch = time
        }
        
        // Sync scroll speed to BPM if available
        if (bands.estimatedBPM > 0) {
          scrollSpeed = bands.estimatedBPM / 8 // Roughly 1 char per beat at 120bpm
        }
        
        // Update glow colors
        for (let i = 0; i < TOTAL_PIXELS; i++) {
          const gridX = i % GRID_X
          const gridY = Math.floor(i / GRID_X)
          
          let isLit = false
          let isPeak = false
          let intensity = 0
          
          switch (displayMode) {
            case 'text':
              isLit = isTextPixelLit(gridX, gridY)
              intensity = isLit ? 0.7 + bands.overallSmooth * 0.3 : 0.05
              break
              
            case 'spectrum':
              isLit = isSpectrumPixelLit(gridX, gridY)
              isPeak = isPeakPixelLit(gridX, gridY)
              intensity = isPeak ? 1.0 : (isLit ? 0.6 + bands.beatIntensity * 0.3 : 0.03)
              break
              
            case 'hybrid':
              const textLit = isTextPixelLit(gridX, gridY)
              const specLit = isSpectrumPixelLit(gridX, gridY)
              isPeak = isPeakPixelLit(gridX, gridY)
              isLit = textLit || specLit
              // Text is brighter than spectrum
              intensity = isPeak ? 1.0 : (textLit ? 0.8 : (specLit ? 0.5 : 0.03))
              break
          }
          
          // Color based on position and mode
          let hue: number
          if (displayMode === 'spectrum' || (displayMode === 'hybrid' && !isTextPixelLit(gridX, gridY))) {
            // Spectrum: color by frequency (column position)
            hue = gridX / GRID_X * 0.3 + cycleHue
          } else {
            // Text: uniform color cycling
            hue = cycleHue + gridX * 0.003
          }
          
          // Peak pixels are white/bright
          const saturation = isPeak ? 0.3 : 0.85
          const lightness = isLit ? Math.min(0.7, intensity * 0.6) : 0.02
          
          const [r, g, b] = hslToRgb(hue, saturation, lightness)
          glowCol[i * 3] = r * intensity
          glowCol[i * 3 + 1] = g * intensity
          glowCol[i * 3 + 2] = b * intensity
        }
        
        colAttr.needsUpdate = true
      },
      dispose: () => {
        if (glowGeometry) glowGeometry.dispose()
        if (glowMaterial) glowMaterial.dispose()
        if (glowPoints) scene.remove(glowPoints)
        glowGeometry = null
        glowMaterial = null
        glowPoints = null
      }
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
    
    // Update scroll position with BPM-synced speed
    const bitmapWidth = textBitmap[0]?.length || 0
    const scrollCycleWidth = bitmapWidth + GRID_X
    scrollOffset += scrollSpeed * dt * (1 + bands.overallSmooth * 0.3)
    if (scrollOffset > scrollCycleWidth) {
      scrollOffset = 0
    }
    
    // Update spectrum bars
    updateSpectrumBars(bands, dt)
    
    const cycleHue = getCyclingHue(time)
    const beatPulse = bands.beatIntensity
    
    const pixelsPerLed = Math.floor(count / TOTAL_PIXELS)
    
    for (let i = 0; i < count; i++) {
      const ledIndex = Math.floor(i / pixelsPerLed) % TOTAL_PIXELS
      const gridX = ledIndex % GRID_X
      const gridY = Math.floor(ledIndex / GRID_X)
      
      // Determine if LED is lit based on display mode
      let isLit = false
      let isPeak = false
      
      switch (displayMode) {
        case 'text':
          isLit = isTextPixelLit(gridX, gridY)
          break
        case 'spectrum':
          isLit = isSpectrumPixelLit(gridX, gridY)
          isPeak = isPeakPixelLit(gridX, gridY)
          break
        case 'hybrid':
          isLit = isTextPixelLit(gridX, gridY) || isSpectrumPixelLit(gridX, gridY)
          isPeak = isPeakPixelLit(gridX, gridY)
          break
      }
      
      // Calculate brightness
      let brightness = 0.03
      let saturation = 0.6
      
      if (isLit) {
        if (isPeak) {
          brightness = 0.85 + beatPulse * 0.15
          saturation = 0.3 // Peaks are whiter
        } else {
          brightness = 0.45 + bands.overallSmooth * 0.25 + beatPulse * 0.15
          saturation = 0.85
        }
        
        // Wave effect across lit pixels
        if (displayMode !== 'spectrum') {
          const wave = Math.sin(gridX * 0.15 - time * 2.5) * 0.08
          brightness += wave * bands.bassSmooth
        }
      } else {
        // Dim pixels subtly react to bass
        brightness += bands.bassSmooth * 0.02
      }
      
      // Hue calculation
      let hue: number
      if (displayMode === 'spectrum' || (displayMode === 'hybrid' && isSpectrumPixelLit(gridX, gridY) && !isTextPixelLit(gridX, gridY))) {
        // Spectrum bars: color by frequency position
        hue = (gridX / GRID_X) * 0.35 + cycleHue
      } else {
        // Text: cycling hue with subtle position variation
        hue = cycleHue + gridX * 0.004 + (isLit ? bands.highSmooth * 0.08 : 0)
      }
      
      // Size based on brightness
      sizes[i] = isLit ? (isPeak ? 3.2 : 2.6 + beatPulse * 0.4) : 1.8
      
      // Color
      const lightness = Math.min(0.65, brightness)
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
      
      // Keep flat
      positions[i * 3 + 2] = 0
    }
  }
}
