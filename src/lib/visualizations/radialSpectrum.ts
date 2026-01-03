import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient } from '../gradients'
import * as THREE from 'three'

// Ring configuration
const NUM_RINGS = 8
const SEGMENTS_PER_RING = 64
const BASE_RADIUS = 8
const RING_SPACING = 4
const MAX_BAR_HEIGHT = 15

// Particle distribution
const CORE_PARTICLES = 600
const RING_PARTICLES = 2400
const AMBIENT_PARTICLES = 500
const TOTAL_MANAGED = CORE_PARTICLES + RING_PARTICLES + AMBIENT_PARTICLES

type RadialMode = 'rings' | 'spiral' | 'starburst'
let currentRadialMode: RadialMode = 'rings'
let currentGradient = builtInGradients.synthwave

interface SpiralParticle {
  angle: number
  radius: number
  baseRadius: number
  z: number
  velocity: number
  frequencyBand: number
}

interface StarburstRay {
  angle: number
  length: number
  targetLength: number
  width: number
  hue: number
  velocity: number
}

const spiralParticles: SpiralParticle[] = []
const starburstRays: StarburstRay[] = []

let ringMeshes: THREE.Mesh[] = []
let ringGeometries: THREE.BufferGeometry[] = []
let ringMaterials: THREE.MeshBasicMaterial[] = []
let coreGlowMesh: THREE.Mesh | null = null
let coreGlowMaterial: THREE.MeshBasicMaterial | null = null
let starburstLines: THREE.Line[] = []
let starburstGeometries: THREE.BufferGeometry[] = []
let starburstMaterials: THREE.LineBasicMaterial[] = []

let lastBeatTime = 0
let rotationOffset = 0
let pulsePhase = 0

function initSpiralParticles() {
  spiralParticles.length = 0
  for (let i = 0; i < RING_PARTICLES; i++) {
    const t = i / RING_PARTICLES
    spiralParticles.push({
      angle: t * Math.PI * 8 + Math.random() * 0.3,
      radius: BASE_RADIUS + t * (NUM_RINGS * RING_SPACING),
      baseRadius: BASE_RADIUS + t * (NUM_RINGS * RING_SPACING),
      z: (Math.random() - 0.5) * 3,
      velocity: 0,
      frequencyBand: Math.floor(t * 7)
    })
  }
}

function initStarburstRays() {
  starburstRays.length = 0
  const numRays = 32
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2
    starburstRays.push({ angle, length: 5, targetLength: 5, width: 0.5, hue: i / numRays, velocity: 0 })
  }
}

function getFrequencyForRing(ring: number, bands: AudioBands): number {
  switch (ring) {
    case 0: return bands.subBassSmooth
    case 1: return bands.bassSmooth
    case 2: return bands.bassSmooth * 0.5 + bands.lowMidSmooth * 0.5
    case 3: return bands.lowMidSmooth
    case 4: return bands.midSmooth
    case 5: return bands.highMidSmooth
    case 6: return bands.trebleSmooth
    case 7: return bands.brillianceSmooth
    default: return bands.overallSmooth
  }
}

function getFrequencyForBand(band: number, bands: AudioBands): number {
  switch (band) {
    case 0: return bands.subBassSmooth
    case 1: return bands.bassSmooth
    case 2: return bands.lowMidSmooth
    case 3: return bands.midSmooth
    case 4: return bands.highMidSmooth
    case 5: return bands.trebleSmooth
    case 6: return bands.brillianceSmooth
    default: return bands.overallSmooth
  }
}

export const radialSpectrum: VisualizationMode = {
  id: 'radial_spectrum',
  name: 'Radial Spectrum',
  description: 'Circular spectrum analyzer with rings, spiral, and starburst modes',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initSpiralParticles()
    initStarburstRays()
    lastBeatTime = 0
    rotationOffset = 0
    pulsePhase = 0

    for (let i = 0; i < count; i++) {
      if (i < CORE_PARTICLES) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = Math.pow(Math.random(), 0.5) * BASE_RADIUS * 0.8
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi) * 0.3
        const [cr, cg, cb] = sampleGradient(currentGradient, 0.2)
        colors[i * 3] = cr; colors[i * 3 + 1] = cg; colors[i * 3 + 2] = cb
      } else if (i < CORE_PARTICLES + RING_PARTICLES) {
        const idx = i - CORE_PARTICLES
        if (idx < spiralParticles.length) {
          const sp = spiralParticles[idx]
          positions[i * 3] = Math.cos(sp.angle) * sp.radius
          positions[i * 3 + 1] = Math.sin(sp.angle) * sp.radius
          positions[i * 3 + 2] = sp.z
        } else {
          positions[i * 3] = 0; positions[i * 3 + 1] = -200; positions[i * 3 + 2] = 0
        }
        const t = idx / RING_PARTICLES
        const [cr, cg, cb] = sampleGradient(currentGradient, t)
        colors[i * 3] = cr; colors[i * 3 + 1] = cg; colors[i * 3 + 2] = cb
      } else if (i < TOTAL_MANAGED) {
        const theta = Math.random() * Math.PI * 2
        const r = BASE_RADIUS + NUM_RINGS * RING_SPACING + Math.random() * 20
        positions[i * 3] = Math.cos(theta) * r
        positions[i * 3 + 1] = Math.sin(theta) * r
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10
        const [cr, cg, cb] = hslToRgb(Math.random(), 0.5, 0.4)
        colors[i * 3] = cr; colors[i * 3 + 1] = cg; colors[i * 3 + 2] = cb
      } else {
        positions[i * 3] = 0; positions[i * 3 + 1] = -200; positions[i * 3 + 2] = 0
      }
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    ringMeshes.forEach(m => scene.remove(m))
    ringGeometries.forEach(g => g.dispose())
    ringMaterials.forEach(m => m.dispose())
    starburstLines.forEach(l => scene.remove(l))
    starburstGeometries.forEach(g => g.dispose())
    starburstMaterials.forEach(m => m.dispose())
    if (coreGlowMesh) { scene.remove(coreGlowMesh); coreGlowMesh.geometry.dispose() }
    if (coreGlowMaterial) coreGlowMaterial.dispose()

    ringMeshes = []; ringGeometries = []; ringMaterials = []
    starburstLines = []; starburstGeometries = []; starburstMaterials = []

    for (let ring = 0; ring < NUM_RINGS; ring++) {
      const radius = BASE_RADIUS + ring * RING_SPACING
      const geometry = new THREE.TorusGeometry(radius, 0.3, 8, SEGMENTS_PER_RING)
      const [r, g, b] = sampleGradient(currentGradient, ring / NUM_RINGS)
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(r, g, b), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = Math.PI / 2
      scene.add(mesh)
      ringMeshes.push(mesh); ringGeometries.push(geometry); ringMaterials.push(material)
    }

    for (let i = 0; i < 32; i++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(6)
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const [r, g, b] = sampleGradient(currentGradient, i / 32)
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(r, g, b), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
      })
      const line = new THREE.Line(geometry, material)
      scene.add(line)
      starburstLines.push(line); starburstGeometries.push(geometry); starburstMaterials.push(material)
    }

    const coreGeometry = new THREE.SphereGeometry(BASE_RADIUS * 0.5, 32, 32)
    coreGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending
    })
    coreGlowMesh = new THREE.Mesh(coreGeometry, coreGlowMaterial)
    scene.add(coreGlowMesh)

    return {
      objects: [...ringMeshes, ...starburstLines, coreGlowMesh],
      update: (bands: AudioBands, time: number) => {
        const cycleHue = getCyclingHue(time)
        rotationOffset += 0.002 + bands.overallSmooth * 0.01
        pulsePhase += 0.05 + bands.bassSmooth * 0.1

        if (coreGlowMesh && coreGlowMaterial) {
          const coreEnergy = bands.subBassSmooth * 0.5 + bands.bassSmooth * 0.5 + bands.beatIntensity * 0.3
          const scale = 1 + coreEnergy * 1.5 + bands.bassPeak * 0.5
          coreGlowMesh.scale.setScalar(scale)
          const [cr, cg, cb] = sampleGradient(currentGradient, 0.1 + cycleHue * 0.2)
          coreGlowMaterial.color.setRGB(cr, cg, cb)
          coreGlowMaterial.opacity = 0.4 + coreEnergy * 0.4
        }

        if (currentRadialMode === 'rings' || currentRadialMode === 'spiral') {
          for (let ring = 0; ring < NUM_RINGS; ring++) {
            const mesh = ringMeshes[ring]
            const material = ringMaterials[ring]
            if (mesh && material) {
              const freq = getFrequencyForRing(ring, bands)
              const scale = 1 + freq * 0.3 + bands.beatIntensity * 0.2
              const pulseOffset = Math.sin(pulsePhase + ring * 0.5) * 0.1 * freq
              mesh.scale.set(scale + pulseOffset, scale + pulseOffset, 1 + freq * 0.5)
              mesh.rotation.z = rotationOffset * (1 + ring * 0.1) * (ring % 2 === 0 ? 1 : -1)
              const [r, g, b] = sampleGradient(currentGradient, ring / NUM_RINGS + cycleHue * 0.2)
              material.color.setRGB(r, g, b)
              material.opacity = 0.3 + freq * 0.5 + bands.beatIntensity * 0.2
            }
          }
        }

        if (currentRadialMode === 'starburst') {
          for (let i = 0; i < starburstRays.length; i++) {
            const ray = starburstRays[i]
            const line = starburstLines[i]
            const geometry = starburstGeometries[i]
            const material = starburstMaterials[i]
            if (ray && line && geometry && material) {
              const bandIndex = Math.floor((i / starburstRays.length) * 7)
              const freq = getFrequencyForBand(bandIndex, bands)
              ray.targetLength = BASE_RADIUS + freq * MAX_BAR_HEIGHT * 2 + bands.beatIntensity * 10
              ray.velocity += (ray.targetLength - ray.length) * 0.3
              ray.velocity *= 0.8
              ray.length += ray.velocity
              const angle = ray.angle + rotationOffset
              const positions = geometry.attributes.position.array as Float32Array
              positions[0] = Math.cos(angle) * BASE_RADIUS * 0.3
              positions[1] = Math.sin(angle) * BASE_RADIUS * 0.3
              positions[2] = 0
              positions[3] = Math.cos(angle) * ray.length
              positions[4] = Math.sin(angle) * ray.length
              positions[5] = 0
              geometry.attributes.position.needsUpdate = true
              const [r, g, b] = sampleGradient(currentGradient, bandIndex / 7 + cycleHue * 0.3)
              material.color.setRGB(r, g, b)
              material.opacity = 0.5 + freq * 0.4 + bands.beatIntensity * 0.2
            }
          }
        }

        ringMeshes.forEach(m => { m.visible = currentRadialMode !== 'starburst' })
        starburstLines.forEach(l => { l.visible = currentRadialMode === 'starburst' })
      },
      dispose: () => {
        ringMeshes.forEach(m => scene.remove(m))
        ringGeometries.forEach(g => g.dispose())
        ringMaterials.forEach(m => m.dispose())
        starburstLines.forEach(l => scene.remove(l))
        starburstGeometries.forEach(g => g.dispose())
        starburstMaterials.forEach(m => m.dispose())
        if (coreGlowMesh) { scene.remove(coreGlowMesh); coreGlowMesh.geometry.dispose(); coreGlowMesh = null }
        if (coreGlowMaterial) { coreGlowMaterial.dispose(); coreGlowMaterial = null }
        ringMeshes = []; ringGeometries = []; ringMaterials = []
        starburstLines = []; starburstGeometries = []; starburstMaterials = []
      }
    }
  },

  animate(positions: Float32Array, originalPositions: Float32Array, sizes: Float32Array, colors: Float32Array, count: number, bands: AudioBands, time: number) {
    const cycleHue = getCyclingHue(time)
    if (bands.isBeat && time - lastBeatTime > 0.15) lastBeatTime = time

    for (let i = 0; i < Math.min(count, CORE_PARTICLES); i++) {
      const ox = originalPositions[i * 3], oy = originalPositions[i * 3 + 1], oz = originalPositions[i * 3 + 2]
      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const normalizedDist = dist / (BASE_RADIUS * 0.8)
      const pulse = 1 + bands.subBassSmooth * 0.8 + bands.bassSmooth * 0.5 + bands.beatIntensity * 0.5
      const breathe = Math.sin(time * 2 + dist * 0.2) * 0.2
      const scale = pulse + breathe
      positions[i * 3] = ox * scale; positions[i * 3 + 1] = oy * scale; positions[i * 3 + 2] = oz * scale * 0.5
      const intensity = 1 - normalizedDist * 0.6
      const [r, g, b] = sampleGradient(currentGradient, normalizedDist * 0.5 + cycleHue * 0.2)
      const whiteMix = intensity * 0.5 + bands.beatIntensity * 0.3
      colors[i * 3] = r * (1 - whiteMix) + whiteMix
      colors[i * 3 + 1] = g * (1 - whiteMix) + whiteMix * 0.95
      colors[i * 3 + 2] = b * (1 - whiteMix) + whiteMix * 0.8
      sizes[i] = (1.5 + intensity * 2 + bands.beatIntensity * 2 + bands.bassPeak) * pulse
    }

    for (let i = 0; i < RING_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      if (particleIndex >= count) break
      const sp = spiralParticles[i]
      if (!sp) continue
      const freq = getFrequencyForBand(sp.frequencyBand, bands)
      if (currentRadialMode === 'spiral') {
        sp.angle += 0.02 + freq * 0.05 + bands.beatIntensity * 0.1
        const radiusExpand = 1 + freq * 0.5 + bands.beatIntensity * 0.3
        sp.radius = sp.baseRadius * radiusExpand
        positions[particleIndex * 3] = Math.cos(sp.angle) * sp.radius
        positions[particleIndex * 3 + 1] = Math.sin(sp.angle) * sp.radius
        positions[particleIndex * 3 + 2] = sp.z + Math.sin(time * 2 + i * 0.1) * freq * 2
      } else {
        const ringIndex = Math.floor((i / RING_PARTICLES) * NUM_RINGS)
        const ringFreq = getFrequencyForRing(ringIndex, bands)
        const baseRadius = BASE_RADIUS + ringIndex * RING_SPACING
        const radius = baseRadius * (1 + ringFreq * 0.3 + bands.beatIntensity * 0.2)
        const angle = (i / (RING_PARTICLES / NUM_RINGS)) * Math.PI * 2 + rotationOffset * (ringIndex % 2 === 0 ? 1 : -1)
        positions[particleIndex * 3] = Math.cos(angle) * radius
        positions[particleIndex * 3 + 1] = Math.sin(angle) * radius
        positions[particleIndex * 3 + 2] = Math.sin(time + angle * 2) * ringFreq * 3
      }
      const t = i / RING_PARTICLES
      const [r, g, b] = sampleGradient(currentGradient, t + cycleHue * 0.2)
      const brightness = 0.5 + freq * 0.4 + bands.beatIntensity * 0.3
      colors[particleIndex * 3] = r * brightness; colors[particleIndex * 3 + 1] = g * brightness; colors[particleIndex * 3 + 2] = b * brightness
      sizes[particleIndex] = 1 + freq * 2 + bands.beatIntensity * 1.5
    }

    for (let i = 0; i < AMBIENT_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + RING_PARTICLES + i
      if (particleIndex >= count) break
      const ox = originalPositions[particleIndex * 3], oy = originalPositions[particleIndex * 3 + 1], oz = originalPositions[particleIndex * 3 + 2]
      const angle = Math.atan2(oy, ox) + time * 0.1 + i * 0.01
      const dist = Math.sqrt(ox * ox + oy * oy)
      const wobble = Math.sin(time + i * 0.5) * 2
      positions[particleIndex * 3] = Math.cos(angle) * (dist + wobble)
      positions[particleIndex * 3 + 1] = Math.sin(angle) * (dist + wobble)
      positions[particleIndex * 3 + 2] = oz + Math.sin(time * 0.5 + i) * 3
      const twinkle = 0.5 + Math.sin(time * 3 + i * 2) * 0.3
      const [r, g, b] = sampleGradient(currentGradient, (i / AMBIENT_PARTICLES) + cycleHue * 0.3)
      colors[particleIndex * 3] = r * twinkle; colors[particleIndex * 3 + 1] = g * twinkle; colors[particleIndex * 3 + 2] = b * twinkle
      sizes[particleIndex] = (0.5 + bands.highSmooth * 1.5) * twinkle
    }

    for (let i = TOTAL_MANAGED; i < count; i++) { positions[i * 3 + 1] = -200; sizes[i] = 0 }
  }
}

export function setRadialMode(mode: RadialMode) { currentRadialMode = mode }
export function getRadialMode(): RadialMode { return currentRadialMode }
export function setRadialGradient(gradient: typeof currentGradient) { currentGradient = gradient }
