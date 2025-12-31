import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

interface Panel {
  x: number
  y: number
  brightness: number
  targetBrightness: number
  hue: number
}

const panels: Panel[] = []
const GRID_X = 32
const GRID_Y = 20
const TOTAL_PANELS = GRID_X * GRID_Y

export const ledMatrix: VisualizationMode = {
  id: 'led_matrix',
  name: 'LED Matrix',
  description: 'Concert LED panel grid with wave patterns',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    panels.length = 0
    
    for (let y = 0; y < GRID_Y; y++) {
      for (let x = 0; x < GRID_X; x++) {
        panels.push({
          x: (x - GRID_X / 2) * 2,
          y: (y - GRID_Y / 2) * 2,
          brightness: 0.3,
          targetBrightness: 0.3,
          hue: 0.85
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

      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.2
      colors[i * 3 + 2] = 0.6
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
    const bassWave = bands.bassSmooth * 1.5
    const midWave = bands.midSmooth * 1.2
    const beatPulse = bands.beatIntensity
    
    for (let p = 0; p < TOTAL_PANELS; p++) {
      const panel = panels[p]
      const gridX = p % GRID_X
      const gridY = Math.floor(p / GRID_X)
      
      const nx = gridX / GRID_X
      const ny = gridY / GRID_Y
      
      const verticalWave = Math.sin(ny * Math.PI * 2 - time * 3) * bassWave
      const horizontalWave = Math.sin(nx * Math.PI * 3 + time * 2) * midWave
      const radialWave = Math.sin(Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2)) * 10 - time * 4) * bands.highSmooth
      
      const diagonalSweep = bands.isBeat ? 
        Math.max(0, 1 - Math.abs((nx + ny) - (time % 2))) : 0
      
      panel.targetBrightness = 0.2 + 
        Math.max(0, verticalWave) * 0.4 + 
        Math.max(0, horizontalWave) * 0.3 + 
        Math.max(0, radialWave) * 0.3 + 
        beatPulse * 0.5 +
        diagonalSweep * 0.6
      
      panel.brightness += (panel.targetBrightness - panel.brightness) * 0.4
      panel.hue = 0.85 - bands.beatIntensity * 0.15
    }

    const particlesPerPanel = Math.floor(count / TOTAL_PANELS)
    
    for (let i = 0; i < count; i++) {
      const panelIndex = Math.floor(i / particlesPerPanel) % TOTAL_PANELS
      const panel = panels[panelIndex]
      const localIndex = i % particlesPerPanel
      
      const zPush = panel.brightness * 3 + bands.beatIntensity * 2
      positions[i * 3 + 2] = zPush
      
      sizes[i] = 2 + panel.brightness * 5 + (localIndex === 7 ? bands.beatIntensity * 3 : 0)
      
      const brightness = panel.brightness
      colors[i * 3] = 1.0 * brightness + 0.3
      colors[i * 3 + 1] = 0.2 * brightness + bands.beatIntensity * 0.3
      colors[i * 3 + 2] = 0.7 * brightness
    }
  }
}
