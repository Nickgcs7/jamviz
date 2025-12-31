import type { VisualizationMode, MouseCoords } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Supernova',
  description: 'Explosive bass-driven energy sphere',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      // Uniform sphere distribution
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = Math.cos(phi)

      // Hot core colors: white/yellow center → orange → red edges
      const r = Math.random()
      colors[i * 3] = 1.0                    // R: always max
      colors[i * 3 + 1] = 0.6 + r * 0.4      // G: yellow-white
      colors[i * 3 + 2] = 0.2 + r * 0.3      // B: warm
    }
  },

  animate(
    positions: Float32Array,
    originalPositions: Float32Array,
    sizes: Float32Array,
    colors: Float32Array,
    count: number,
    bands: AudioBands,
    time: number,
    mouse?: MouseCoords
  ) {
    // DRAMATIC size changes
    const baseRadius = 8
    const bassExpand = bands.bassSmooth * 25        // Was 12 - now HUGE
    const breathe = Math.sin(time * 2) * 3
    const beatBurst = bands.beatIntensity * 20      // Was 8 - explosive on beats
    const midPulse = bands.midSmooth * 8

    // Mouse creates gravity well
    const mouseX = mouse?.active ? mouse.x * 40 : 0
    const mouseY = mouse?.active ? mouse.y * 40 : 0
    const mouseGravity = mouse?.active ? 0.5 : 0

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      // Per-particle variation for organic feel
      const phase = i * 0.001
      const individualPulse = Math.sin(time * 3 + phase * 10) * 2
      const individualBeat = bands.isBeat ? Math.sin(phase * 50) * 5 : 0
      
      const radius = baseRadius + bassExpand + breathe + midPulse + individualPulse + beatBurst + individualBeat

      let px = ox * radius
      let py = oy * radius
      let pz = oz * radius

      // Spiky distortion on highs
      const spikeAmount = bands.highSmooth * 8
      const spike = Math.sin(phase * 100 + time * 5) * spikeAmount
      px += ox * spike
      py += oy * spike
      pz += oz * spike

      // Mouse gravity attraction
      if (mouse?.active) {
        const dx = mouseX - px
        const dy = mouseY - py
        const dist = Math.sqrt(dx * dx + dy * dy + pz * pz)
        
        if (dist > 0.1) {
          const force = mouseGravity * radius / (1 + dist * 0.1)
          px += (dx / dist) * force
          py += (dy / dist) * force
        }
      }

      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz
      
      // Size DRAMATICALLY changes with audio
      const distFromCenter = Math.sqrt(px*px + py*py + pz*pz) / radius
      sizes[i] = 1.5 + bands.bassSmooth * 5 + bands.beatIntensity * 6 + (1 - distFromCenter) * 3
      
      // Color shifts: white-hot core on beats, red outer edge
      const energyBoost = bands.bassSmooth + bands.beatIntensity
      const coreHeat = Math.max(0, 1 - distFromCenter * 1.5) // Brighter at center
      
      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.3 + coreHeat * 0.7 + energyBoost * 0.3  // Yellow-white at core
      colors[i * 3 + 2] = 0.1 + coreHeat * 0.6 + bands.beatIntensity * 0.4  // White-hot on beats
    }
  }
}
