import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

interface Panel {
  x: number
  y: number
  brightness: number
  targetBrightness: number
  hue: number
  targetHue: number
  depth: number
}

const panels: Panel[] = []
const GRID_X = 32
const GRID_Y = 20
const TOTAL_PANELS = GRID_X * GRID_Y

export const ledMatrix: VisualizationMode = {
  id: 'led_matrix',
  name: 'LED Matrix',
  description: 'Concert LED panel grid with wave patterns and depth',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    panels.length = 0
    
    for (let y = 0; y < GRID_Y; y++) {
      for (let x = 0; x < GRID_X; x++) {
        panels.push({
          x: (x - GRID_X / 2) * 2,
          y: (y - GRID_Y / 2) * 2,
          brightness: 0.3,
          targetBrightness: 0.3,
          hue: 0.92,
          targetHue: 0.92,
          depth: 0
        })
      }
    }

    const particlesPerPanel = Math.floor(count / TOTAL_PANELS)
    
    for (let i = 0; i < count; i++) {
      const panelIndex = Math.floor(i / particlesPerPanel) % TOTAL_PANELS
      const panel = panels[panelIndex]
      const localIndex = i % particlesPerPanel
      
      const localX = (localIndex % 4) * 0.35 - 0.5
      const localY = Math.floor(localIndex / 4) * 0.35 - 0.5
      
      positions[i * 3] = panel.x + localX
      positions[i * 3 + 1] = panel.y + localY
      positions[i * 3 + 2] = 0

      const [r, g, b] = hslToRgb(0.92, 0.85, 0.5)
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
    const bassWave = bands.bassSmooth * 1.3
    const midWave = bands.midSmooth * 1.1
    const beatPulse = bands.beatIntensity
    
    for (let p = 0; p < TOTAL_PANELS; p++) {
      const panel = panels[p]
      const gridX = p % GRID_X
      const gridY = Math.floor(p / GRID_X)
      
      const nx = gridX / GRID_X
      const ny = gridY / GRID_Y
      
      // Multi-layered wave patterns
      const verticalWave = Math.sin(ny * Math.PI * 2 - time * 2.5) * bassWave
      const horizontalWave = Math.sin(nx * Math.PI * 2.5 + time * 1.8) * midWave
      const radialWave = Math.sin(Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2)) * 8 - time * 3.5) * bands.highSmooth
      const diagonalWave = Math.sin((nx + ny) * Math.PI * 2 - time * 2) * bands.midSmooth * 0.5
      
      const diagonalSweep = bands.isBeat ? 
        Math.max(0, 1 - Math.abs((nx + ny) - (time % 2))) * 0.5 : 0
      
      panel.targetBrightness = 0.15 + 
        Math.max(0, verticalWave) * 0.35 + 
        Math.max(0, horizontalWave) * 0.25 + 
        Math.max(0, radialWave) * 0.25 + 
        Math.max(0, diagonalWave) * 0.2 +
        beatPulse * 0.25 +
        diagonalSweep * 0.35
      
      // Hue shifts with frequency - bass pushes red, treble pushes blue
      panel.targetHue = 0.92 - bands.bassSmooth * 0.12 + bands.highSmooth * 0.1
      
      // Depth based on brightness
      panel.depth = panel.brightness * 3 + beatPulse * 1.5
      
      // Smooth transitions
      panel.brightness += (panel.targetBrightness - panel.brightness) * 0.12
      panel.hue += (panel.targetHue - panel.hue) * 0.08
    }

    const particlesPerPanel = Math.floor(count / TOTAL_PANELS)
    
    for (let i = 0; i < count; i++) {
      const panelIndex = Math.floor(i / particlesPerPanel) % TOTAL_PANELS
      const panel = panels[panelIndex]
      const localIndex = i % particlesPerPanel
      
      // Depth push based on brightness
      positions[i * 3 + 2] = panel.depth + (localIndex === 7 ? bands.beatIntensity * 0.8 : 0)
      
      sizes[i] = 1.8 + panel.brightness * 3.5 + (localIndex === 7 ? bands.beatIntensity * 1.5 : 0)
      
      // HSL coloring
      const saturation = 0.75 + panel.brightness * 0.2
      const lightness = 0.35 + panel.brightness * 0.4
      const [r, g, b] = hslToRgb(panel.hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  }
}
