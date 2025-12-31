import type { VisualizationMode, MouseCoords } from './types'
import type { AudioBands } from '../AudioAnalyzer'

export const explosion: VisualizationMode = {
  id: 'explosion',
  name: 'Supernova',
  description: 'Bass-driven energy burst',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = Math.cos(phi)

      const r = Math.random()
      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.3 + r * 0.5
      colors[i * 3 + 2] = 0.1 + r * 0.2
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
    const baseRadius = 12
    const bassExpand = bands.bassSmooth * 12
    const breathe = Math.sin(time * 1.5) * 1.5
    const beatBurst = bands.beatIntensity * 8

    // Mouse attraction/repulsion parameters
    const mouseX = mouse?.active ? mouse.x * 30 : 0
    const mouseY = mouse?.active ? mouse.y * 30 : 0
    const mouseInfluenceRadius = 25
    const attractionStrength = mouse?.active ? 0.3 : 0

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      // Individual variation
      const individualPhase = Math.sin(time * 1.0 + i * 0.0008) * 1
      const radius = baseRadius + bassExpand + breathe + individualPhase + beatBurst

      let px = ox * radius
      let py = oy * radius
      let pz = oz * radius

      // Mouse attraction effect
      if (mouse?.active) {
        const dx = mouseX - px
        const dy = mouseY - py
        const dist = Math.sqrt(dx * dx + dy * dy + pz * pz)
        
        if (dist < mouseInfluenceRadius && dist > 0.1) {
          const influence = 1 - dist / mouseInfluenceRadius
          const force = influence * influence * attractionStrength * radius
          px += (dx / dist) * force
          py += (dy / dist) * force
        }
      }

      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz
      
      sizes[i] = 1.5 + bands.overallSmooth * 2.5 + bands.beatIntensity * 2
      
      // Subtle color intensification
      const energyBoost = bands.bassSmooth * 0.5 + bands.beatIntensity * 0.5
      colors[i * 3] = Math.min(1, 0.9 + energyBoost * 0.1)
      colors[i * 3 + 1] = 0.3 + bands.midSmooth * 0.3 + bands.beatIntensity * 0.2
      colors[i * 3 + 2] = 0.1 + bands.highSmooth * 0.3
    }
  }
}