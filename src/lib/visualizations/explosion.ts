import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Supernova',
  description: 'Explosive bass-driven energy sphere with depth layers',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = Math.cos(phi)

      // Warm gradient from center
      const t = Math.random()
      const [r, g, b] = hslToRgb(0.08 - t * 0.06, 0.9, 0.55 + t * 0.15)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
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
    const baseRadius = 8
    const bassExpand = bands.bassSmooth * 22
    const breathe = Math.sin(time * 1.5) * 3
    const beatBurst = bands.beatIntensity * 15
    const midPulse = bands.midSmooth * 7
    
    // Get cycling hue offset
    const cycleHue = getCyclingHue(time)

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      const phase = i * 0.001
      const individualPulse = Math.sin(time * 2.5 + phase * 10) * 2
      const individualBeat = bands.isBeat ? Math.sin(phase * 50) * 4 : 0
      
      const radius = baseRadius + bassExpand + breathe + midPulse + individualPulse + beatBurst + individualBeat

      // Add depth layers based on frequency
      const depthOffset = bands.midSmooth * 5 * Math.sin(phase * 20 + time * 2)

      let px = ox * radius
      let py = oy * radius
      let pz = oz * radius + depthOffset

      // High frequency spikes
      const spikeAmount = bands.highSmooth * 6
      const spike = Math.sin(phase * 100 + time * 4) * spikeAmount
      px += ox * spike
      py += oy * spike
      pz += oz * spike

      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz
      
      const distFromCenter = Math.sqrt(px*px + py*py + pz*pz) / radius
      sizes[i] = 1.2 + bands.bassSmooth * 4 + bands.beatIntensity * 5 + (1 - distFromCenter) * 2.5
      
      // Dynamic color with cycling: core is hot, outer is cooler
      const coreHeat = Math.max(0, 1 - distFromCenter * 1.4)
      const hue = cycleHue + coreHeat * 0.1 + bands.bassSmooth * 0.08
      const saturation = 0.85 + bands.beatIntensity * 0.1
      const lightness = 0.4 + coreHeat * 0.3 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  }
}
