import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'

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
const GRID_X = 64  // Wide display for text scrolling
const GRID_Y = 14  // Double height for better text rendering (7 row font * 2)
const TOTAL_PIXELS = GRID_X * GRID_Y
const CHAR_WIDTH = 5
const CHAR_HEIGHT = 7
const CHAR_SPACING = 1
const SCROLL_SPEED = 15  // Pixels per second

// Current display state
let displayText = 'JAMVIZ'
let scrollOffset = 0
let textBitmap: boolean[][] = []

// Pre-calculate text bitmap for efficient scrolling
function generateTextBitmap(text: string): boolean[][] {
  const upperText = text.toUpperCase()
  const totalWidth = upperText.length * (CHAR_WIDTH + CHAR_SPACING)
  const bitmap: boolean[][] = []
  
  // Initialize bitmap
  for (let y = 0; y < CHAR_HEIGHT; y++) {
    bitmap[y] = new Array(totalWidth).fill(false)
  }
  
  // Render each character
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

// Check if pixel should be lit based on text position
function isPixelLit(gridX: number, gridY: number): boolean {
  if (textBitmap.length === 0) return false
  
  // Map grid position to text bitmap position
  // Center text vertically and handle scrolling horizontally
  const bitmapWidth = textBitmap[0]?.length || 0
  const displayWidth = GRID_X
  
  // Calculate wrapped scroll position
  const scrollX = Math.floor(scrollOffset) % (bitmapWidth + displayWidth)
  const textX = gridX + scrollX - displayWidth
  
  // Map grid Y to font row (grid is 14 high, font is 7 high, so scale by 2)
  const fontRow = Math.floor(gridY / 2)
  
  if (textX >= 0 && textX < bitmapWidth && fontRow >= 0 && fontRow < CHAR_HEIGHT) {
    return textBitmap[fontRow][textX] || false
  }
  
  return false
}

export const ledMatrix: VisualizationMode = {
  id: 'led_matrix',
  name: 'LED Matrix',
  description: 'Times Square style LED wall with scrolling text',
  
  // Text configuration for UI
  textConfig: {
    enabled: true,
    placeholder: 'Enter text to display...',
    defaultText: 'JAMVIZ'
  },
  
  // Method to update displayed text
  setText(text: string) {
    displayText = text || 'JAMVIZ'
    textBitmap = generateTextBitmap(displayText)
    scrollOffset = 0  // Reset scroll when text changes
  },

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    // Initialize text bitmap
    textBitmap = generateTextBitmap(displayText)
    scrollOffset = 0
    
    // Calculate pixels per LED to fill the particle count
    const pixelsPerLed = Math.floor(count / TOTAL_PIXELS)
    const ledSize = 1.0  // Size of each LED pixel
    const gapSize = 0.15  // Gap between LEDs
    const totalLedSize = ledSize + gapSize
    
    // Center the grid
    const offsetX = (GRID_X * totalLedSize) / 2
    const offsetY = (GRID_Y * totalLedSize) / 2
    
    for (let i = 0; i < count; i++) {
      const ledIndex = Math.floor(i / pixelsPerLed) % TOTAL_PIXELS
      const gridX = ledIndex % GRID_X
      const gridY = Math.floor(ledIndex / GRID_X)
      
      // Position within LED (create rectangular pixel effect)
      const localIndex = i % pixelsPerLed
      const localCols = Math.ceil(Math.sqrt(pixelsPerLed))
      const localX = (localIndex % localCols) / localCols * ledSize - ledSize / 2
      const localY = Math.floor(localIndex / localCols) / localCols * ledSize - ledSize / 2
      
      // World position
      positions[i * 3] = gridX * totalLedSize - offsetX + localX + ledSize / 2
      positions[i * 3 + 1] = (GRID_Y - 1 - gridY) * totalLedSize - offsetY + localY + ledSize / 2  // Flip Y
      positions[i * 3 + 2] = 0  // Flat wall
      
      // Initial dim color
      const [r, g, b] = hslToRgb(0.55, 0.7, 0.1)
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
    // Update scroll position
    const bitmapWidth = textBitmap[0]?.length || 0
    const scrollCycleWidth = bitmapWidth + GRID_X
    scrollOffset += SCROLL_SPEED * 0.016 * (1 + bands.overallSmooth * 0.5)  // Audio affects scroll speed
    if (scrollOffset > scrollCycleWidth) {
      scrollOffset = 0
    }
    
    // Get cycling hue
    const cycleHue = getCyclingHue(time)
    const beatPulse = bands.beatIntensity
    
    const pixelsPerLed = Math.floor(count / TOTAL_PIXELS)
    
    for (let i = 0; i < count; i++) {
      const ledIndex = Math.floor(i / pixelsPerLed) % TOTAL_PIXELS
      const gridX = ledIndex % GRID_X
      const gridY = Math.floor(ledIndex / GRID_X)
      
      // Check if this LED should be lit
      const isLit = isPixelLit(gridX, gridY)
      
      // Audio-reactive brightness
      let brightness = 0.05  // Base dim level for "off" LEDs
      let saturation = 0.6
      
      if (isLit) {
        // Lit pixels get full brightness with audio reactivity
        brightness = 0.5 + bands.overallSmooth * 0.3 + beatPulse * 0.2
        saturation = 0.85
        
        // Add wave effect across lit pixels
        const wave = Math.sin(gridX * 0.2 - time * 3) * 0.1
        brightness += wave * bands.bassSmooth
      } else {
        // Dim pixels subtly react to bass
        brightness += bands.bassSmooth * 0.03
      }
      
      // Hue shifts with position and time
      const hue = cycleHue + gridX * 0.005 + (isLit ? bands.highSmooth * 0.1 : 0)
      
      // Size based on brightness
      sizes[i] = isLit ? 2.5 + beatPulse * 0.5 : 1.8
      
      // Color
      const lightness = Math.min(0.6, brightness)
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
      
      // Keep flat (no Z movement)
      positions[i * 3 + 2] = 0
    }
  }
}
