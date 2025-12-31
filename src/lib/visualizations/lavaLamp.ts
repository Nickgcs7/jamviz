import type { VisualizationMode, MouseCoords } from './types'
import type { AudioBands } from '../AudioAnalyzer'

// Blob center storage for organic movement
const blobCenters: { x: number; y: number; z: number; phase: number; speed: number }[] = []
const NUM_BLOBS = 8

export const lavaLamp: VisualizationMode = {
  id: 'lava_lamp',
  name: 'Lava Lamp',
  description: 'Soft rising/falling blobs with organic clustering',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    // Initialize blob centers
    blobCenters.length = 0
    for (let b = 0; b < NUM_BLOBS; b++) {
      blobCenters.push({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 30,
        z: (Math.random() - 0.5) * 20,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.4
      })
    }

    // Distribute particles in a cylindrical volume
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const r = Math.random() * 15
      const y = (Math.random() - 0.5) * 40

      positions[i * 3] = r * Math.cos(theta)
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = r * Math.sin(theta)

      // Warm lava colors: orange to magenta
      const t = Math.random()
      colors[i * 3] = 0.9 + t * 0.1      // Red: high
      colors[i * 3 + 1] = 0.2 + t * 0.3  // Green: low-medium
      colors[i * 3 + 2] = 0.1 + t * 0.4  // Blue: low-medium
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
    // Update blob centers with organic motion
    for (let b = 0; b < NUM_BLOBS; b++) {
      const blob = blobCenters[b]
      const verticalSpeed = blob.speed * (0.8 + bands.bassSmooth * 0.5)
      
      // Sinusoidal vertical motion (rising and falling)
      blob.y = Math.sin(time * verticalSpeed + blob.phase) * 18
      
      // Gentle horizontal drift
      blob.x += Math.sin(time * 0.3 + blob.phase) * 0.02
      blob.z += Math.cos(time * 0.25 + blob.phase * 1.3) * 0.02
      
      // Keep within bounds
      blob.x = Math.max(-12, Math.min(12, blob.x))
      blob.z = Math.max(-12, Math.min(12, blob.z))
    }

    // Mouse influence
    const mouseX = mouse?.active ? mouse.x * 20 : 0
    const mouseY = mouse?.active ? mouse.y * 25 : 0

    for (let i = 0; i < count; i++) {
      const ox = originalPositions[i * 3]
      const oy = originalPositions[i * 3 + 1]
      const oz = originalPositions[i * 3 + 2]

      // Find nearest blob and calculate attraction
      let attractX = 0, attractY = 0, attractZ = 0
      let totalInfluence = 0

      for (const blob of blobCenters) {
        const dx = blob.x - ox
        const dy = blob.y - oy
        const dz = blob.z - oz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if (dist < 18) {
          const influence = Math.pow(1 - dist / 18, 2) * (1 + bands.bassSmooth)
          attractX += dx * influence * 0.15
          attractY += dy * influence * 0.15
          attractZ += dz * influence * 0.15
          totalInfluence += influence
        }
      }

      // Base vertical motion (thermal convection)
      const thermalRise = Math.sin(time * 0.8 + ox * 0.1 + oz * 0.1) * 3 * (1 + bands.midSmooth)
      
      // Gentle wobble
      const wobbleX = Math.sin(time * 1.2 + i * 0.001) * 0.5
      const wobbleZ = Math.cos(time * 1.1 + i * 0.0012) * 0.5

      // Mouse repulsion (lava moves away gently)
      let mouseRepelX = 0, mouseRepelY = 0
      if (mouse?.active) {
        const mdx = ox - mouseX
        const mdy = oy - mouseY
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mDist < 12 && mDist > 0.1) {
          const repelForce = (1 - mDist / 12) * 4
          mouseRepelX = (mdx / mDist) * repelForce
          mouseRepelY = (mdy / mDist) * repelForce
        }
      }

      positions[i * 3] = ox + attractX + wobbleX + mouseRepelX
      positions[i * 3 + 1] = oy + attractY + thermalRise + mouseRepelY
      positions[i * 3 + 2] = oz + attractZ + wobbleZ

      // Size based on clustering (bigger in blob centers)
      const clusterFactor = Math.min(1, totalInfluence * 0.5)
      sizes[i] = 2 + clusterFactor * 3 + bands.overallSmooth * 2 + bands.beatIntensity * 1.5

      // Color shifts: warmer when clustered, cooler when dispersed
      const warmth = 0.5 + clusterFactor * 0.5 + bands.bassSmooth * 0.3
      colors[i * 3] = 0.8 + warmth * 0.2 + bands.beatIntensity * 0.1
      colors[i * 3 + 1] = 0.15 + warmth * 0.25 + bands.midSmooth * 0.15
      colors[i * 3 + 2] = 0.1 + (1 - warmth) * 0.3 + bands.highSmooth * 0.2
    }
  }
}