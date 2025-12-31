import type { VisualizationMode, MouseCoords } from './types'
import type { AudioBands } from '../AudioAnalyzer'

// Blob centers for organic clustering
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
    // Initialize blob centers
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

    // Distribute particles in cylinder
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const r = Math.random() * 18
      const y = (Math.random() - 0.5) * 45

      positions[i * 3] = r * Math.cos(theta)
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = r * Math.sin(theta)

      // Deep purple/magenta/violet palette
      const t = Math.random()
      colors[i * 3] = 0.5 + t * 0.4       // R: medium-high
      colors[i * 3 + 1] = 0.1 + t * 0.15  // G: low (purple)
      colors[i * 3 + 2] = 0.6 + t * 0.4   // B: high (violet)
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
    // Update blob positions - MUCH more dramatic movement
    for (let b = 0; b < NUM_BLOBS; b++) {
      const blob = blobs[b]
      
      // Vertical oscillation driven by bass
      const verticalRange = 20 + bands.bassSmooth * 15
      blob.y = Math.sin(time * blob.speed + blob.phase) * verticalRange
      
      // Horizontal drift increases with mids
      const driftSpeed = 0.04 + bands.midSmooth * 0.08
      blob.x += Math.sin(time * 0.5 + blob.phase) * driftSpeed
      blob.z += Math.cos(time * 0.4 + blob.phase * 1.3) * driftSpeed
      
      // Blob size pulses with beat
      blob.size = 12 + bands.bassSmooth * 10 + bands.beatIntensity * 8
      
      // Wrap around bounds
      if (blob.x > 16) blob.x = -16
      if (blob.x < -16) blob.x = 16
      if (blob.z > 16) blob.z = -16
      if (blob.z < -16) blob.z = 16
    }

    // Mouse repulsion
    const mouseX = mouse?.active ? mouse.x * 25 : 0
    const mouseY = mouse?.active ? mouse.y * 30 : 0

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      // Calculate attraction to all blobs
      let attractX = 0, attractY = 0, attractZ = 0
      let totalInfluence = 0
      let nearestBlobDist = 1000

      for (const blob of blobs) {
        const dx = blob.x - ox
        const dy = blob.y - oy
        const dz = blob.z - oz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        nearestBlobDist = Math.min(nearestBlobDist, dist)
        
        if (dist < blob.size) {
          // Strong attraction when inside blob radius
          const influence = Math.pow(1 - dist / blob.size, 1.5) * (1 + bands.bassSmooth * 2)
          const strength = 0.4 + bands.beatIntensity * 0.3
          attractX += dx * influence * strength
          attractY += dy * influence * strength
          attractZ += dz * influence * strength
          totalInfluence += influence
        }
      }

      // Gentle ambient motion
      const drift = Math.sin(time * 0.6 + i * 0.002) * 2
      const wobbleX = Math.sin(time * 1.5 + i * 0.001) * (1 + bands.highSmooth * 2)
      const wobbleZ = Math.cos(time * 1.3 + i * 0.0015) * (1 + bands.highSmooth * 2)

      // Mouse repulsion
      let mouseRepelX = 0, mouseRepelY = 0
      if (mouse?.active) {
        const mdx = (ox + attractX) - mouseX
        const mdy = (oy + attractY) - mouseY
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mDist < 15 && mDist > 0.1) {
          const repelForce = Math.pow(1 - mDist / 15, 2) * 12
          mouseRepelX = (mdx / mDist) * repelForce
          mouseRepelY = (mdy / mDist) * repelForce
        }
      }

      positions[i * 3] = ox + attractX + wobbleX + mouseRepelX
      positions[i * 3 + 1] = oy + attractY + drift + mouseRepelY
      positions[i * 3 + 2] = oz + attractZ + wobbleZ

      // Size: BIG when in blob, small when dispersed
      const inBlob = totalInfluence > 0.3
      const blobSize = inBlob ? 4 + totalInfluence * 6 : 1.5
      sizes[i] = blobSize + bands.overallSmooth * 3 + bands.beatIntensity * 4

      // Color: bright magenta in blobs, deep purple when dispersed
      const heat = Math.min(1, totalInfluence * 1.5)
      colors[i * 3] = 0.5 + heat * 0.5 + bands.beatIntensity * 0.2     // R: magenta
      colors[i * 3 + 1] = 0.05 + heat * 0.2 + bands.midSmooth * 0.15  // G: low
      colors[i * 3 + 2] = 0.6 + heat * 0.3 - bands.bassSmooth * 0.2   // B: violet/purple
    }
  }
}
