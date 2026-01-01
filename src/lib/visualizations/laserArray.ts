import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import * as THREE from 'three'

// Laser fixture configuration
const NUM_FIXTURES = 5
const BEAMS_PER_FIXTURE = 8
const TOTAL_BEAMS = NUM_FIXTURES * BEAMS_PER_FIXTURE

// Trail particles per beam
const TRAIL_PARTICLES_PER_BEAM = 15
const TOTAL_TRAIL_PARTICLES = TOTAL_BEAMS * TRAIL_PARTICLES_PER_BEAM

interface LaserFixture {
  x: number
  y: number
  z: number
  baseHue: number
  beams: LaserBeam[]
}

interface LaserBeam {
  angle: number        // Horizontal sweep angle
  pitch: number        // Vertical angle (how far down it points)
  targetAngle: number
  targetPitch: number
  length: number
  hue: number
  intensity: number
}

interface TrailParticle {
  beamIndex: number
  t: number           // Position along beam (0-1)
  age: number
  maxAge: number
}

const fixtures: LaserFixture[] = []
const trailParticles: TrailParticle[] = []

// Line geometry references
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null

function initFixtures() {
  fixtures.length = 0
  
  // 5 fixtures spread across the top
  const fixtureSpacing = 70 / (NUM_FIXTURES - 1)
  
  for (let f = 0; f < NUM_FIXTURES; f++) {
    const fixture: LaserFixture = {
      x: -35 + f * fixtureSpacing,
      y: 35,  // Top of scene
      z: -10, // Slightly back
      baseHue: f / NUM_FIXTURES, // Each fixture starts with different hue
      beams: []
    }
    
    // Create beams for this fixture
    for (let b = 0; b < BEAMS_PER_FIXTURE; b++) {
      const spreadAngle = ((b / (BEAMS_PER_FIXTURE - 1)) - 0.5) * Math.PI * 0.6
      fixture.beams.push({
        angle: spreadAngle,
        pitch: Math.PI * 0.3 + Math.random() * 0.2, // Pointing downward
        targetAngle: spreadAngle,
        targetPitch: Math.PI * 0.3,
        length: 60 + Math.random() * 20,
        hue: fixture.baseHue + (b / BEAMS_PER_FIXTURE) * 0.15,
        intensity: 0.8
      })
    }
    
    fixtures.push(fixture)
  }
}

function initTrailParticles() {
  trailParticles.length = 0
  
  for (let i = 0; i < TOTAL_TRAIL_PARTICLES; i++) {
    trailParticles.push({
      beamIndex: Math.floor(i / TRAIL_PARTICLES_PER_BEAM),
      t: (i % TRAIL_PARTICLES_PER_BEAM) / TRAIL_PARTICLES_PER_BEAM,
      age: Math.random(),
      maxAge: 0.5 + Math.random() * 0.5
    })
  }
}

export const laserArray: VisualizationMode = {
  id: 'laser_array',
  name: 'Laser Array',
  description: 'Concert stage lasers with crisp beams and trails',
  
  // We still use particles for the glowing trail effect
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initFixtures()
    initTrailParticles()
    
    // Initialize trail particles along beams
    for (let i = 0; i < count; i++) {
      if (i < TOTAL_TRAIL_PARTICLES) {
        const tp = trailParticles[i]
        const fixtureIndex = Math.floor(tp.beamIndex / BEAMS_PER_FIXTURE)
        const beamInFixture = tp.beamIndex % BEAMS_PER_FIXTURE
        
        if (fixtureIndex < fixtures.length) {
          const fixture = fixtures[fixtureIndex]
          const beam = fixture.beams[beamInFixture]
          
          // Position along beam
          const r = tp.t * beam.length
          const x = fixture.x + Math.sin(beam.angle) * Math.sin(beam.pitch) * r
          const y = fixture.y - Math.cos(beam.pitch) * r
          const z = fixture.z + Math.cos(beam.angle) * Math.sin(beam.pitch) * r
          
          positions[i * 3] = x
          positions[i * 3 + 1] = y
          positions[i * 3 + 2] = z
        }
      } else {
        // Extra particles - hide them
        positions[i * 3] = 0
        positions[i * 3 + 1] = -100
        positions[i * 3 + 2] = 0
      }
      
      // Bright laser colors
      const [cr, cg, cb] = hslToRgb(0.5, 0.9, 0.6)
      colors[i * 3] = cr
      colors[i * 3 + 1] = cg
      colors[i * 3 + 2] = cb
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    // Create line geometry for crisp laser beams
    // Each beam is 2 vertices (start and end point)
    const vertexCount = TOTAL_BEAMS * 2
    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 3)
    
    lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      linewidth: 1, // Note: linewidth > 1 only works on some platforms
    })
    
    lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)
    
    return {
      objects: [lineSegments],
      update: (bands: AudioBands, time: number) => {
        if (!lineGeometry) return
        
        const cycleHue = getCyclingHue(time)
        const posAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
        const colAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array
        const col = colAttr.array as Float32Array
        
        let vertexIndex = 0
        
        for (let f = 0; f < fixtures.length; f++) {
          const fixture = fixtures[f]
          
          // Animate fixture hue
          fixture.baseHue = cycleHue + f * 0.12
          
          for (let b = 0; b < fixture.beams.length; b++) {
            const beam = fixture.beams[b]
            const beamGlobalIndex = f * BEAMS_PER_FIXTURE + b
            
            // Animate beam sweep based on audio
            const sweepSpeed = 0.8 + bands.midSmooth * 1.5
            const sweepAmount = 0.3 + bands.bassSmooth * 0.4
            const baseSweep = ((b / (BEAMS_PER_FIXTURE - 1)) - 0.5) * Math.PI * 0.6
            
            beam.targetAngle = baseSweep + 
              Math.sin(time * sweepSpeed + f * 0.8 + b * 0.3) * sweepAmount +
              bands.beatIntensity * Math.sin(beamGlobalIndex * 1.7) * 0.3
            
            beam.targetPitch = Math.PI * 0.25 + 
              Math.sin(time * 0.6 + f * 0.5) * 0.15 +
              bands.bassSmooth * 0.2 +
              bands.beatIntensity * 0.1
            
            // Smooth interpolation
            beam.angle += (beam.targetAngle - beam.angle) * 0.08
            beam.pitch += (beam.targetPitch - beam.pitch) * 0.06
            
            // Dynamic length based on audio
            beam.length = 55 + bands.overallSmooth * 25 + bands.beatIntensity * 15
            beam.intensity = 0.7 + bands.overallSmooth * 0.25 + bands.beatIntensity * 0.2
            
            // Hue with cycling
            beam.hue = fixture.baseHue + (b / BEAMS_PER_FIXTURE) * 0.1 + bands.highSmooth * 0.1
            
            // Calculate beam end point
            const r = beam.length
            const endX = fixture.x + Math.sin(beam.angle) * Math.sin(beam.pitch) * r
            const endY = fixture.y - Math.cos(beam.pitch) * r
            const endZ = fixture.z + Math.cos(beam.angle) * Math.sin(beam.pitch) * r
            
            // Start vertex (fixture position)
            pos[vertexIndex * 3] = fixture.x
            pos[vertexIndex * 3 + 1] = fixture.y
            pos[vertexIndex * 3 + 2] = fixture.z
            
            // Start color (brighter at source)
            const [sr, sg, sb] = hslToRgb(beam.hue, 0.95, 0.7 * beam.intensity)
            col[vertexIndex * 3] = sr
            col[vertexIndex * 3 + 1] = sg
            col[vertexIndex * 3 + 2] = sb
            vertexIndex++
            
            // End vertex
            pos[vertexIndex * 3] = endX
            pos[vertexIndex * 3 + 1] = endY
            pos[vertexIndex * 3 + 2] = endZ
            
            // End color (slightly dimmer)
            const [er, eg, eb] = hslToRgb(beam.hue + 0.02, 0.9, 0.5 * beam.intensity)
            col[vertexIndex * 3] = er
            col[vertexIndex * 3 + 1] = eg
            col[vertexIndex * 3 + 2] = eb
            vertexIndex++
          }
        }
        
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      },
      dispose: () => {
        if (lineGeometry) lineGeometry.dispose()
        if (lineMaterial) lineMaterial.dispose()
        if (lineSegments) {
          scene.remove(lineSegments)
        }
        lineGeometry = null
        lineMaterial = null
        lineSegments = null
      }
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
    const dt = 0.016
    
    // Animate trail particles along beams
    for (let i = 0; i < Math.min(count, TOTAL_TRAIL_PARTICLES); i++) {
      const tp = trailParticles[i]
      const fixtureIndex = Math.floor(tp.beamIndex / BEAMS_PER_FIXTURE)
      const beamInFixture = tp.beamIndex % BEAMS_PER_FIXTURE
      
      if (fixtureIndex >= fixtures.length) continue
      
      const fixture = fixtures[fixtureIndex]
      const beam = fixture.beams[beamInFixture]
      
      // Age particle
      tp.age += dt / tp.maxAge
      if (tp.age > 1) {
        tp.age = 0
        tp.t = Math.random() * 0.3 // Respawn near source
        tp.maxAge = 0.3 + Math.random() * 0.4
      }
      
      // Move along beam
      const speed = 0.8 + bands.overallSmooth * 1.2 + bands.beatIntensity * 0.8
      tp.t += dt * speed
      if (tp.t > 1) tp.t = 0
      
      // Position along beam with some scatter
      const r = tp.t * beam.length
      const scatter = (1 - tp.t) * 2 * (Math.sin(i * 3.7 + time * 4) * 0.5 + 0.5)
      
      const x = fixture.x + Math.sin(beam.angle) * Math.sin(beam.pitch) * r + Math.sin(i * 2.3) * scatter
      const y = fixture.y - Math.cos(beam.pitch) * r + Math.cos(i * 1.9) * scatter
      const z = fixture.z + Math.cos(beam.angle) * Math.sin(beam.pitch) * r + Math.sin(i * 1.7 + time) * scatter
      
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      
      // Size: larger near source, fades along beam
      const lifeFade = 1 - tp.age
      const beamFade = 1 - tp.t * 0.7
      sizes[i] = (2 + bands.overallSmooth * 3 + bands.beatIntensity * 4) * lifeFade * beamFade
      
      // Color matches beam with life fade
      const [r2, g, b] = hslToRgb(beam.hue, 0.9, 0.5 + lifeFade * 0.3)
      colors[i * 3] = r2 * lifeFade * beam.intensity
      colors[i * 3 + 1] = g * lifeFade * beam.intensity
      colors[i * 3 + 2] = b * lifeFade * beam.intensity
    }
    
    // Hide extra particles
    for (let i = TOTAL_TRAIL_PARTICLES; i < count; i++) {
      positions[i * 3 + 1] = -100
      sizes[i] = 0
    }
  }
}
