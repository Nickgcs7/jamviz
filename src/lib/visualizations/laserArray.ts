import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import * as THREE from 'three'

// ============================================================================
// LASER ARRAY CONFIGURATION
// ============================================================================

// Fixture configuration - now dynamic based on audio
const BASE_FIXTURES = 5
const MAX_FIXTURES = 9
const BEAMS_PER_FIXTURE = 8
const MAX_BEAMS = MAX_FIXTURES * BEAMS_PER_FIXTURE

// Trail particles per beam
const TRAIL_PARTICLES_PER_BEAM = 20
const MAX_TRAIL_PARTICLES = MAX_BEAMS * TRAIL_PARTICLES_PER_BEAM

// Mirror mode state
const mirrorMode = true

// Color mode: 'gradient' | 'bar-level' | 'stereo'
type ColorMode = 'gradient' | 'bar-level' | 'stereo'
let colorMode: ColorMode = 'gradient'

// ============================================================================
// INTERFACES
// ============================================================================

interface LaserFixture {
  x: number
  y: number
  z: number
  baseHue: number
  active: boolean
  intensity: number
  targetIntensity: number
  beams: LaserBeam[]
}

interface LaserBeam {
  angle: number
  pitch: number
  targetAngle: number
  targetPitch: number
  length: number
  targetLength: number
  hue: number
  intensity: number
  flickerPhase: number
  // New: per-beam audio response
  frequencyBand: 'bass' | 'mid' | 'high' | 'treble'
}

interface TrailParticle {
  beamIndex: number
  fixtureIndex: number
  t: number
  age: number
  maxAge: number
  active: boolean
}

// ============================================================================
// STATE
// ============================================================================

const fixtures: LaserFixture[] = []
const trailParticles: TrailParticle[] = []

// Scene references
let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null

// Glow mesh for fixture sources
let glowGeometry: THREE.BufferGeometry | null = null
let glowMaterial: THREE.PointsMaterial | null = null
let glowPoints: THREE.Points | null = null

// Animation state
let currentActiveFixtures = BASE_FIXTURES
let lastBeatTime = 0
let sweepPhase = 0

// ============================================================================
// INITIALIZATION
// ============================================================================

function initFixtures() {
  fixtures.length = 0
  
  for (let f = 0; f < MAX_FIXTURES; f++) {
    const fixture: LaserFixture = {
      x: 0, // Will be positioned dynamically
      y: 35,
      z: -10,
      baseHue: f / MAX_FIXTURES,
      active: f < BASE_FIXTURES,
      intensity: f < BASE_FIXTURES ? 1 : 0,
      targetIntensity: f < BASE_FIXTURES ? 1 : 0,
      beams: []
    }
    
    // Create beams with varied frequency response
    for (let b = 0; b < BEAMS_PER_FIXTURE; b++) {
      const spreadAngle = ((b / (BEAMS_PER_FIXTURE - 1)) - 0.5) * Math.PI * 0.7
      
      // Assign frequency bands to beams
      let band: 'bass' | 'mid' | 'high' | 'treble'
      if (b < 2) band = 'bass'
      else if (b < 4) band = 'mid'
      else if (b < 6) band = 'high'
      else band = 'treble'
      
      fixture.beams.push({
        angle: spreadAngle,
        pitch: Math.PI * 0.3 + Math.random() * 0.15,
        targetAngle: spreadAngle,
        targetPitch: Math.PI * 0.3,
        length: 50,
        targetLength: 50,
        hue: fixture.baseHue + (b / BEAMS_PER_FIXTURE) * 0.15,
        intensity: 0.8,
        flickerPhase: Math.random() * Math.PI * 2,
        frequencyBand: band
      })
    }
    
    fixtures.push(fixture)
  }
}

function initTrailParticles() {
  trailParticles.length = 0
  
  for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
    const fixtureIndex = Math.floor(i / (BEAMS_PER_FIXTURE * TRAIL_PARTICLES_PER_BEAM))
    const beamIndex = Math.floor((i % (BEAMS_PER_FIXTURE * TRAIL_PARTICLES_PER_BEAM)) / TRAIL_PARTICLES_PER_BEAM)
    
    trailParticles.push({
      fixtureIndex,
      beamIndex,
      t: (i % TRAIL_PARTICLES_PER_BEAM) / TRAIL_PARTICLES_PER_BEAM,
      age: Math.random(),
      maxAge: 0.4 + Math.random() * 0.4,
      active: true
    })
  }
}

// Position fixtures based on active count
function updateFixturePositions(activeCount: number) {
  const spacing = 80 / Math.max(1, activeCount - 1)
  const startX = -40
  
  for (let f = 0; f < fixtures.length; f++) {
    if (f < activeCount) {
      fixtures[f].x = activeCount === 1 ? 0 : startX + f * spacing
      fixtures[f].targetIntensity = 1
    } else {
      fixtures[f].targetIntensity = 0
    }
  }
}

// Get color based on mode and audio
function getBeamColor(
  beam: LaserBeam, 
  fixture: LaserFixture, 
  bands: AudioBands, 
  cycleHue: number,
  isStart: boolean
): [number, number, number] {
  let hue: number
  let saturation: number
  let lightness: number
  
  switch (colorMode) {
    case 'bar-level': {
      // Color based on current amplitude of beam's frequency band
      let amplitude: number
      switch (beam.frequencyBand) {
        case 'bass': amplitude = bands.bassSmooth; break
        case 'mid': amplitude = bands.midSmooth; break
        case 'high': amplitude = bands.highSmooth; break
        case 'treble': amplitude = bands.trebleSmooth; break
      }
      // Hot colors (red/orange) for high amplitude, cool (blue/purple) for low
      hue = 0.7 - amplitude * 0.5
      saturation = 0.9
      lightness = 0.4 + amplitude * 0.35
      break
    }
    
    case 'stereo': {
      // Color based on stereo balance
      const balance = bands.stereoBalance
      if (balance < -0.1) {
        // Left channel dominant - cyan/blue
        hue = 0.55 + Math.abs(balance) * 0.1
      } else if (balance > 0.1) {
        // Right channel dominant - magenta/red
        hue = 0.85 + balance * 0.1
      } else {
        // Center - green/yellow
        hue = 0.25 + cycleHue * 0.2
      }
      saturation = 0.85
      lightness = 0.5 + bands.overallSmooth * 0.2
      break
    }
    
    case 'gradient':
    default: {
      // Original cycling gradient behavior
      hue = cycleHue + fixture.baseHue * 0.3 + beam.hue * 0.2
      saturation = 0.95
      lightness = isStart ? 0.7 * beam.intensity : 0.5 * beam.intensity
      break
    }
  }
  
  // Add beat flash
  if (bands.beatIntensity > 0.3) {
    lightness = Math.min(0.9, lightness + bands.beatIntensity * 0.3)
  }
  
  return hslToRgb(hue % 1, saturation, lightness)
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const laserArray: VisualizationMode = {
  id: 'laser_array',
  name: 'Laser Array',
  description: 'Concert stage lasers with mirror mode, stereo response, and frequency-mapped beams',
  
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initFixtures()
    initTrailParticles()
    updateFixturePositions(BASE_FIXTURES)
    currentActiveFixtures = BASE_FIXTURES
    lastBeatTime = 0
    sweepPhase = 0
    
    // Initialize trail particles
    for (let i = 0; i < count; i++) {
      if (i < MAX_TRAIL_PARTICLES) {
        positions[i * 3] = 0
        positions[i * 3 + 1] = 35
        positions[i * 3 + 2] = -10
      } else {
        positions[i * 3] = 0
        positions[i * 3 + 1] = -200
        positions[i * 3 + 2] = 0
      }
      
      const [cr, cg, cb] = hslToRgb(0.5, 0.9, 0.6)
      colors[i * 3] = cr
      colors[i * 3 + 1] = cg
      colors[i * 3 + 2] = cb
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    // Create line geometry for laser beams
    const vertexCount = MAX_BEAMS * 2 * 2 // *2 for mirror mode
    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 3)
    
    lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      linewidth: 2,
    })
    
    lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)
    
    // Create glow points at fixture sources
    const glowPositions = new Float32Array(MAX_FIXTURES * 3)
    const glowColors = new Float32Array(MAX_FIXTURES * 3)
    
    glowGeometry = new THREE.BufferGeometry()
    glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3))
    glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3))
    
    glowMaterial = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    })
    
    glowPoints = new THREE.Points(glowGeometry, glowMaterial)
    scene.add(glowPoints)
    
    return {
      objects: [lineSegments, glowPoints],
      update: (bands: AudioBands, time: number) => {
        if (!lineGeometry || !glowGeometry) return
        
        const cycleHue = getCyclingHue(time)
        const posAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
        const colAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array
        const col = colAttr.array as Float32Array
        
        const glowPosAttr = glowGeometry.getAttribute('position') as THREE.BufferAttribute
        const glowColAttr = glowGeometry.getAttribute('color') as THREE.BufferAttribute
        const glowPos = glowPosAttr.array as Float32Array
        const glowCol = glowColAttr.array as Float32Array
        
        // Update active fixture count based on sustained energy
        const targetFixtures = Math.min(
          MAX_FIXTURES,
          BASE_FIXTURES + Math.floor(bands.overallSmooth * 4)
        )
        
        if (targetFixtures !== currentActiveFixtures) {
          currentActiveFixtures = targetFixtures
          updateFixturePositions(currentActiveFixtures)
        }
        
        // Cycle color mode on strong beats occasionally
        if (bands.isBeat && bands.beatIntensity > 0.7 && time - lastBeatTime > 2) {
          lastBeatTime = time
          const modes: ColorMode[] = ['gradient', 'bar-level', 'stereo']
          colorMode = modes[(modes.indexOf(colorMode) + 1) % modes.length]
        }
        
        // Update sweep phase
        sweepPhase += 0.02 * (1 + bands.midSmooth * 0.5)
        
        let vertexIndex = 0
        
        for (let f = 0; f < fixtures.length; f++) {
          const fixture = fixtures[f]
          
          // Smooth fixture intensity
          fixture.intensity += (fixture.targetIntensity - fixture.intensity) * 0.1
          
          // Update glow position and color
          glowPos[f * 3] = fixture.x
          glowPos[f * 3 + 1] = fixture.y
          glowPos[f * 3 + 2] = fixture.z
          
          const glowIntensity = fixture.intensity * (0.5 + bands.overallSmooth * 0.5)
          const [gr, gg, gb] = hslToRgb(cycleHue + fixture.baseHue * 0.3, 0.8, glowIntensity * 0.6)
          glowCol[f * 3] = gr
          glowCol[f * 3 + 1] = gg
          glowCol[f * 3 + 2] = gb
          
          if (fixture.intensity < 0.1) continue
          
          // Animate fixture hue
          fixture.baseHue = cycleHue + f * 0.08
          
          for (let b = 0; b < fixture.beams.length; b++) {
            const beam = fixture.beams[b]
            const beamGlobalIndex = f * BEAMS_PER_FIXTURE + b
            
            // Get band-specific audio data
            let bandSmooth: number
            switch (beam.frequencyBand) {
              case 'bass':
                bandSmooth = bands.bassSmooth
                break
              case 'mid':
                bandSmooth = bands.midSmooth
                break
              case 'high':
                bandSmooth = bands.highSmooth
                break
              case 'treble':
                bandSmooth = bands.trebleSmooth
                break
            }
            
            // Animate beam sweep with band-specific response
            const baseSweep = ((b / (BEAMS_PER_FIXTURE - 1)) - 0.5) * Math.PI * 0.65
            const sweepSpeed = 0.6 + bandSmooth * 1.2
            const sweepAmount = 0.25 + bandSmooth * 0.35
            
            beam.targetAngle = baseSweep + 
              Math.sin(sweepPhase * sweepSpeed + f * 0.7 + b * 0.25) * sweepAmount +
              bands.beatIntensity * Math.sin(beamGlobalIndex * 1.5) * 0.25
            
            beam.targetPitch = Math.PI * 0.28 + 
              Math.sin(time * 0.5 + f * 0.4) * 0.12 +
              bandSmooth * 0.15 +
              bands.beatIntensity * 0.08
            
            // Beam length responds to its frequency band
            beam.targetLength = 45 + bandSmooth * 30 + bands.beatIntensity * 20
            
            // Smooth interpolation
            beam.angle += (beam.targetAngle - beam.angle) * 0.1
            beam.pitch += (beam.targetPitch - beam.pitch) * 0.08
            beam.length += (beam.targetLength - beam.length) * 0.12
            
            // Flicker effect on high energy
            const flicker = 1 + Math.sin(time * 20 + beam.flickerPhase) * 0.05 * bands.highSmooth
            beam.intensity = (0.6 + bandSmooth * 0.35 + bands.beatIntensity * 0.15) * flicker * fixture.intensity
            
            // Calculate beam endpoints
            const r = beam.length
            const endX = fixture.x + Math.sin(beam.angle) * Math.sin(beam.pitch) * r
            const endY = fixture.y - Math.cos(beam.pitch) * r
            const endZ = fixture.z + Math.cos(beam.angle) * Math.sin(beam.pitch) * r
            
            // Draw primary beam
            pos[vertexIndex * 3] = fixture.x
            pos[vertexIndex * 3 + 1] = fixture.y
            pos[vertexIndex * 3 + 2] = fixture.z
            
            const [sr, sg, sb] = getBeamColor(beam, fixture, bands, cycleHue, true)
            col[vertexIndex * 3] = sr
            col[vertexIndex * 3 + 1] = sg
            col[vertexIndex * 3 + 2] = sb
            vertexIndex++
            
            pos[vertexIndex * 3] = endX
            pos[vertexIndex * 3 + 1] = endY
            pos[vertexIndex * 3 + 2] = endZ
            
            const [er, eg, eb] = getBeamColor(beam, fixture, bands, cycleHue, false)
            col[vertexIndex * 3] = er
            col[vertexIndex * 3 + 1] = eg
            col[vertexIndex * 3 + 2] = eb
            vertexIndex++
            
            // Draw mirrored beam if mirror mode is on
            if (mirrorMode) {
              const mirrorEndX = fixture.x - Math.sin(beam.angle) * Math.sin(beam.pitch) * r
              
              pos[vertexIndex * 3] = fixture.x
              pos[vertexIndex * 3 + 1] = fixture.y
              pos[vertexIndex * 3 + 2] = fixture.z
              col[vertexIndex * 3] = sr
              col[vertexIndex * 3 + 1] = sg
              col[vertexIndex * 3 + 2] = sb
              vertexIndex++
              
              pos[vertexIndex * 3] = mirrorEndX
              pos[vertexIndex * 3 + 1] = endY
              pos[vertexIndex * 3 + 2] = endZ
              col[vertexIndex * 3] = er
              col[vertexIndex * 3 + 1] = eg
              col[vertexIndex * 3 + 2] = eb
              vertexIndex++
            }
          }
        }
        
        // Hide unused vertices
        while (vertexIndex < pos.length / 3) {
          pos[vertexIndex * 3 + 1] = -200
          vertexIndex++
        }
        
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
        glowPosAttr.needsUpdate = true
        glowColAttr.needsUpdate = true
      },
      dispose: () => {
        if (lineGeometry) lineGeometry.dispose()
        if (lineMaterial) lineMaterial.dispose()
        if (lineSegments) scene.remove(lineSegments)
        if (glowGeometry) glowGeometry.dispose()
        if (glowMaterial) glowMaterial.dispose()
        if (glowPoints) scene.remove(glowPoints)
        lineGeometry = null
        lineMaterial = null
        lineSegments = null
        glowGeometry = null
        glowMaterial = null
        glowPoints = null
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
    const cycleHue = getCyclingHue(time)
    
    // Animate trail particles along beams
    let particleIndex = 0
    
    for (let f = 0; f < fixtures.length; f++) {
      const fixture = fixtures[f]
      
      for (let b = 0; b < fixture.beams.length; b++) {
        const beam = fixture.beams[b]
        
        for (let p = 0; p < TRAIL_PARTICLES_PER_BEAM; p++) {
          if (particleIndex >= count) break
          
          const tp = trailParticles[particleIndex]
          if (!tp) {
            particleIndex++
            continue
          }
          
          // Skip if fixture not active
          if (fixture.intensity < 0.1) {
            positions[particleIndex * 3 + 1] = -200
            sizes[particleIndex] = 0
            particleIndex++
            continue
          }
          
          // Age particle
          tp.age += dt / tp.maxAge
          if (tp.age > 1) {
            tp.age = 0
            tp.t = Math.random() * 0.25
            tp.maxAge = 0.25 + Math.random() * 0.35
          }
          
          // Move along beam with audio-reactive speed
          const speed = 0.7 + bands.overallSmooth * 1.0 + bands.beatIntensity * 0.6
          tp.t += dt * speed
          if (tp.t > 1) tp.t = 0
          
          // Position along beam with scatter
          const r = tp.t * beam.length
          const scatter = (1 - tp.t) * 1.5 * (Math.sin(particleIndex * 3.7 + time * 4) * 0.5 + 0.5)
          
          const baseX = fixture.x + Math.sin(beam.angle) * Math.sin(beam.pitch) * r
          const baseY = fixture.y - Math.cos(beam.pitch) * r
          const baseZ = fixture.z + Math.cos(beam.angle) * Math.sin(beam.pitch) * r
          
          positions[particleIndex * 3] = baseX + Math.sin(particleIndex * 2.3) * scatter
          positions[particleIndex * 3 + 1] = baseY + Math.cos(particleIndex * 1.9) * scatter
          positions[particleIndex * 3 + 2] = baseZ + Math.sin(particleIndex * 1.7 + time) * scatter
          
          // Size: larger near source, fades along beam
          const lifeFade = 1 - tp.age
          const beamFade = 1 - tp.t * 0.6
          sizes[particleIndex] = (1.8 + bands.overallSmooth * 2.5 + bands.beatIntensity * 3) * lifeFade * beamFade * fixture.intensity
          
          // Color matches beam
          const [r2, g, b2] = hslToRgb(
            beam.hue + cycleHue * 0.3, 
            0.85, 
            0.45 + lifeFade * 0.3
          )
          colors[particleIndex * 3] = r2 * lifeFade * beam.intensity
          colors[particleIndex * 3 + 1] = g * lifeFade * beam.intensity
          colors[particleIndex * 3 + 2] = b2 * lifeFade * beam.intensity
          
          particleIndex++
        }
      }
    }
    
    // Hide extra particles
    for (let i = particleIndex; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}
