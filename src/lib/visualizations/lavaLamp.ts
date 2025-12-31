import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'

interface Blob {
  x: number
  y: number  
  z: number
  phase: number
  speed: number
  size: number
}

const blobs: Blob[] = []
const NUM_BLOBS = 6

export const lavaLamp: VisualizationMode = {
  id: 'lava_lamp',
  name: 'Lava Lamp',
  description: 'Deep purple organic blobs',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    blobs.length = 0
    for (let b = 0; b < NUM_BLOBS; b++) {
      blobs.push({
        x: (Math.random() - 0.5) * 24,
        y: (Math.random() - 0.5) * 35,
        z: (Math.random() - 0.5) * 24,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5,
        size: 12 + Math.random() * 8
      })
    }

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const r = Math.random() * 18
      const y = (Math.random() - 0.5) * 45

      positions[i * 3] = r * Math.cos(theta)
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = r * Math.sin(theta)

      const t = Math.random()
      colors[i * 3] = 0.5 + t * 0.4
      colors[i * 3 + 1] = 0.1 + t * 0.15
      colors[i * 3 + 2] = 0.6 + t * 0.4
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
    for (let b = 0; b < NUM_BLOBS; b++) {
      const blob = blobs[b]
      
      const verticalRange = 20 + bands.bassSmooth * 15
      blob.y = Math.sin(time * blob.speed + blob.phase) * verticalRange
      
      const driftSpeed = 0.04 + bands.midSmooth * 0.08
      blob.x += Math.sin(time * 0.5 + blob.phase) * driftSpeed
      blob.z += Math.cos(time * 0.4 + blob.phase * 1.3) * driftSpeed
      
      blob.size = 12 + bands.bassSmooth * 10 + bands.beatIntensity * 8
      
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

      for (const blob of blobs) {
        const dx = blob.x - ox
        const dy = blob.y - oy
        const dz = blob.z - oz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if (dist < blob.size) {
          const influence = Math.pow(1 - dist / blob.size, 1.5) * (1 + bands.bassSmooth * 2)
          const strength = 0.4 + bands.beatIntensity * 0.3
          attractX += dx * influence * strength
          attractY += dy * influence * strength
          attractZ += dz * influence * strength
          totalInfluence += influence
        }
      }

      const drift = Math.sin(time * 0.6 + i * 0.002) * 2
      const wobbleX = Math.sin(time * 1.5 + i * 0.001) * (1 + bands.highSmooth * 2)
      const wobbleZ = Math.cos(time * 1.3 + i * 0.0015) * (1 + bands.highSmooth * 2)

      positions[i * 3] = ox + attractX + wobbleX
      positions[i * 3 + 1] = oy + attractY + drift
      positions[i * 3 + 2] = oz + attractZ + wobbleZ

      const inBlob = totalInfluence > 0.3
      const blobSize = inBlob ? 4 + totalInfluence * 6 : 1.5
      sizes[i] = blobSize + bands.overallSmooth * 3 + bands.beatIntensity * 4

      const heat = Math.min(1, totalInfluence * 1.5)
      colors[i * 3] = 0.5 + heat * 0.5 + bands.beatIntensity * 0.2
      colors[i * 3 + 1] = 0.05 + heat * 0.2 + bands.midSmooth * 0.15
      colors[i * 3 + 2] = 0.6 + heat * 0.3 - bands.bassSmooth * 0.2
    }
  }
}
