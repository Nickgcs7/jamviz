import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb } from '../colorUtils'

interface Blob {
  x: number
  y: number  
  z: number
  phase: number
  speed: number
  size: number
  hueOffset: number
}

const blobs: Blob[] = []
const NUM_BLOBS = 7

export const lavaLamp: VisualizationMode = {
  id: 'lava_lamp',
  name: 'Lava Lamp',
  description: 'Deep purple organic blobs with depth motion',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    blobs.length = 0
    for (let b = 0; b < NUM_BLOBS; b++) {
      blobs.push({
        x: (Math.random() - 0.5) * 24,
        y: (Math.random() - 0.5) * 35,
        z: (Math.random() - 0.5) * 24,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.4,
        size: 12 + Math.random() * 8,
        hueOffset: Math.random() * 0.1
      })
    }

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const r = Math.random() * 18
      const y = (Math.random() - 0.5) * 45

      positions[i * 3] = r * Math.cos(theta)
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = r * Math.sin(theta)

      // Purple-magenta gradient
      const t = Math.random()
      const [cr, cg, cb] = hslToRgb(0.82 + t * 0.1, 0.75, 0.45 + t * 0.15)
      colors[i * 3] = cr
      colors[i * 3 + 1] = cg
      colors[i * 3 + 2] = cb
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
    // Animate blobs with more depth movement
    for (let b = 0; b < NUM_BLOBS; b++) {
      const blob = blobs[b]
      
      const verticalRange = 18 + bands.bassSmooth * 12
      blob.y = Math.sin(time * blob.speed + blob.phase) * verticalRange
      
      const driftSpeed = 0.03 + bands.midSmooth * 0.06
      blob.x += Math.sin(time * 0.4 + blob.phase) * driftSpeed
      blob.z += Math.cos(time * 0.35 + blob.phase * 1.3) * driftSpeed
      
      // Depth pulsing
      blob.z += Math.sin(time * 0.8 + blob.phase * 2) * bands.highSmooth * 3
      
      blob.size = 11 + bands.bassSmooth * 8 + bands.beatIntensity * 4
      
      if (blob.x > 16) blob.x = -16
      if (blob.x < -16) blob.x = 16
      if (blob.z > 16) blob.z = -16
      if (blob.z < -16) blob.z = 16
    }

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      let attractX = 0, attractY = 0, attractZ = 0
      let totalInfluence = 0
      let dominantBlobHue = 0

      for (const blob of blobs) {
        const dx = blob.x - ox
        const dy = blob.y - oy
        const dz = blob.z - oz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if (dist < blob.size) {
          const influence = Math.pow(1 - dist / blob.size, 1.4) * (1 + bands.bassSmooth * 1.5)
          const strength = 0.35 + bands.beatIntensity * 0.15
          attractX += dx * influence * strength
          attractY += dy * influence * strength
          attractZ += dz * influence * strength
          totalInfluence += influence
          dominantBlobHue += blob.hueOffset * influence
        }
      }

      const drift = Math.sin(time * 0.5 + i * 0.002) * 1.5
      const wobbleX = Math.sin(time * 1.2 + i * 0.001) * (1 + bands.highSmooth * 1.5)
      const wobbleZ = Math.cos(time * 1.0 + i * 0.0015) * (1 + bands.highSmooth * 1.5)

      positions[i * 3] = ox + attractX + wobbleX
      positions[i * 3 + 1] = oy + attractY + drift
      positions[i * 3 + 2] = oz + attractZ + wobbleZ

      const inBlob = totalInfluence > 0.3
      const blobSize = inBlob ? 3.5 + totalInfluence * 5 : 1.3
      sizes[i] = blobSize + bands.overallSmooth * 2.5 + bands.beatIntensity * 2

      // Rich purple-magenta-pink color space
      const heat = Math.min(1, totalInfluence * 1.3)
      const normalizedHue = totalInfluence > 0 ? dominantBlobHue / totalInfluence : 0
      const hue = 0.82 + normalizedHue + heat * 0.08 - bands.bassSmooth * 0.05
      const saturation = 0.7 + heat * 0.2 + bands.beatIntensity * 0.1
      const lightness = 0.4 + heat * 0.25 + bands.beatIntensity * 0.1
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  }
}
