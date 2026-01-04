import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient, type GradientPreset } from '../gradients'
import * as THREE from 'three'

export interface LaserArrayConfig {
  laserCount: number
  laserWidth: number
  laserLength: number
  beamsPerLaser: number
  originSpread: number
  originY: number
  originZ: number
  uplightCount: number
  uplightSpread: number
  uplightLength: number
  uplightBeams: number
  sweepSpeed: number
  sweepRange: number
  pulseSpeed: number
  syncToBeats: boolean
  colorMode: 'gradient' | 'bar-level' | 'stereo' | 'rainbow'
  gradient: GradientPreset
  glowIntensity: number
  fogEnabled: boolean
  fogDensity: number
  mirrorMode: boolean
  trailParticles: boolean
  trailDensity: number
  bassInfluence: number
  midInfluence: number
  highInfluence: number
  beatReactivity: number
  smoothingFactor: number
}

const DEFAULT_CONFIG: LaserArrayConfig = {
  laserCount: 5,
  laserWidth: 2,
  laserLength: 80,
  beamsPerLaser: 8,
  originSpread: 60,
  originY: 30,
  originZ: -5,
  uplightCount: 3,
  uplightSpread: 40,
  uplightLength: 55,
  uplightBeams: 5,
  sweepSpeed: 0.6,
  sweepRange: 60,
  pulseSpeed: 2.0,
  syncToBeats: true,
  colorMode: 'gradient',
  gradient: builtInGradients.neon,
  glowIntensity: 1.0,
  fogEnabled: true,
  fogDensity: 0.5,
  mirrorMode: true,
  trailParticles: true,
  trailDensity: 0.6,
  bassInfluence: 1.0,
  midInfluence: 1.0,
  highInfluence: 1.0,
  beatReactivity: 1.0,
  smoothingFactor: 0.1
}

let config: LaserArrayConfig = { ...DEFAULT_CONFIG }

const MAX_FIXTURES = 12
const MAX_BEAMS_PER_FIXTURE = 12
const MAX_BEAMS = MAX_FIXTURES * MAX_BEAMS_PER_FIXTURE
const MAX_UPLIGHTS = 5
const MAX_UPLIGHT_BEAMS = 8
const TRAIL_PARTICLES_PER_BEAM = 15
const MAX_TRAIL_PARTICLES = (MAX_BEAMS + MAX_UPLIGHTS * MAX_UPLIGHT_BEAMS) * TRAIL_PARTICLES_PER_BEAM

interface LaserFixture {
  x: number; y: number; z: number
  baseHue: number; active: boolean; intensity: number; targetIntensity: number
  beams: LaserBeam[]
  isUplight: boolean
}

interface LaserBeam {
  angle: number; pitch: number; targetAngle: number; targetPitch: number
  length: number; targetLength: number; hue: number; intensity: number
  flickerPhase: number; frequencyBand: 'bass' | 'mid' | 'high' | 'treble'
}

interface TrailParticle {
  beamIndex: number; fixtureIndex: number; t: number; age: number; maxAge: number; active: boolean
}

const fixtures: LaserFixture[] = []
const trailParticles: TrailParticle[] = []

let lineGeometry: THREE.BufferGeometry | null = null
let lineMaterial: THREE.LineBasicMaterial | null = null
let lineSegments: THREE.LineSegments | null = null
let glowGeometry: THREE.BufferGeometry | null = null
let glowMaterial: THREE.ShaderMaterial | null = null
let glowPoints: THREE.Points | null = null
let fogGeometry: THREE.BufferGeometry | null = null
let fogMaterial: THREE.PointsMaterial | null = null
let fogPoints: THREE.Points | null = null

let currentActiveFixtures = 5
let sweepPhase = 0

// Custom shader for circular glowing emitters
const emitterVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  varying vec3 vColor;
  varying float vSize;
  
  void main() {
    vColor = customColor;
    vSize = size;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const emitterFragmentShader = `
  varying vec3 vColor;
  varying float vSize;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Create circular shape with soft glow
    float circle = 1.0 - smoothstep(0.15, 0.4, dist);
    float glow = exp(-dist * 2.5) * 0.9;
    
    // Combine circle and glow
    float alpha = circle + glow;
    
    // Bright center, glowing edges
    vec3 color = vColor * (circle * 1.8 + glow);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(color, alpha);
  }
`

function getGradient(): GradientPreset {
  return config.gradient && config.gradient.colorStops ? config.gradient : builtInGradients.neon
}

function initFixtures() {
  fixtures.length = 0
  
  // Main fixtures (top, will point DOWN)
  for (let f = 0; f < MAX_FIXTURES; f++) {
    const fixture: LaserFixture = {
      x: 0, y: config.originY, z: config.originZ,
      baseHue: f / MAX_FIXTURES,
      active: f < config.laserCount,
      intensity: f < config.laserCount ? 1 : 0,
      targetIntensity: f < config.laserCount ? 1 : 0,
      beams: [],
      isUplight: false
    }
    for (let b = 0; b < MAX_BEAMS_PER_FIXTURE; b++) {
      const spreadAngle = ((b / (config.beamsPerLaser - 1)) - 0.5) * Math.PI * 0.6
      let band: 'bass' | 'mid' | 'high' | 'treble'
      if (b < config.beamsPerLaser * 0.25) band = 'bass'
      else if (b < config.beamsPerLaser * 0.5) band = 'mid'
      else if (b < config.beamsPerLaser * 0.75) band = 'high'
      else band = 'treble'
      fixture.beams.push({
        angle: spreadAngle, 
        pitch: Math.PI * 0.35,  // ~63 degrees from vertical
        targetAngle: spreadAngle, 
        targetPitch: Math.PI * 0.35,
        length: config.laserLength, targetLength: config.laserLength,
        hue: fixture.baseHue + (b / config.beamsPerLaser) * 0.15,
        intensity: 0.8, flickerPhase: Math.random() * Math.PI * 2, frequencyBand: band
      })
    }
    fixtures.push(fixture)
  }
  
  // Uplights (bottom, pointing up)
  for (let u = 0; u < MAX_UPLIGHTS; u++) {
    const fixture: LaserFixture = {
      x: 0, y: -28, z: config.originZ + 5,
      baseHue: (u / MAX_UPLIGHTS + 0.5) % 1,
      active: u < config.uplightCount,
      intensity: u < config.uplightCount ? 0.7 : 0,
      targetIntensity: u < config.uplightCount ? 0.7 : 0,
      beams: [],
      isUplight: true
    }
    for (let b = 0; b < MAX_UPLIGHT_BEAMS; b++) {
      const spreadAngle = ((b / Math.max(1, config.uplightBeams - 1)) - 0.5) * Math.PI * 0.4
      fixture.beams.push({
        angle: spreadAngle, pitch: Math.PI * 0.25,
        targetAngle: spreadAngle, targetPitch: Math.PI * 0.25,
        length: config.uplightLength, targetLength: config.uplightLength,
        hue: fixture.baseHue + (b / config.uplightBeams) * 0.2,
        intensity: 0.6, flickerPhase: Math.random() * Math.PI * 2, 
        frequencyBand: 'bass'
      })
    }
    fixtures.push(fixture)
  }
}

function initTrailParticles() {
  trailParticles.length = 0
  for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
    trailParticles.push({
      fixtureIndex: 0, beamIndex: 0,
      t: Math.random(),
      age: Math.random(), maxAge: 0.4 + Math.random() * 0.4, active: true
    })
  }
}

function updateFixturePositions(activeCount: number) {
  const spacing = config.originSpread / Math.max(1, activeCount - 1)
  const startX = -config.originSpread / 2
  
  for (let f = 0; f < MAX_FIXTURES; f++) {
    if (f < activeCount) {
      fixtures[f].x = activeCount === 1 ? 0 : startX + f * spacing
      fixtures[f].y = config.originY
      fixtures[f].z = config.originZ
      fixtures[f].targetIntensity = 1
    } else {
      fixtures[f].targetIntensity = 0
    }
  }
  
  const uplightSpacing = config.uplightSpread / Math.max(1, config.uplightCount - 1)
  const uplightStartX = -config.uplightSpread / 2
  for (let u = 0; u < MAX_UPLIGHTS; u++) {
    const idx = MAX_FIXTURES + u
    if (u < config.uplightCount) {
      fixtures[idx].x = config.uplightCount === 1 ? 0 : uplightStartX + u * uplightSpacing
      fixtures[idx].y = -28
      fixtures[idx].z = config.originZ + 5
      fixtures[idx].targetIntensity = 0.7
    } else {
      fixtures[idx].targetIntensity = 0
    }
  }
}

function getBeamColor(beam: LaserBeam, fixture: LaserFixture, bands: AudioBands, cycleHue: number, progress: number): [number, number, number] {
  let r: number, g: number, b: number
  const gradient = getGradient()
  
  switch (config.colorMode) {
    case 'bar-level': {
      let amplitude: number
      switch (beam.frequencyBand) {
        case 'bass': amplitude = bands.bassSmooth; break
        case 'mid': amplitude = bands.midSmooth; break
        case 'high': amplitude = bands.highSmooth; break
        case 'treble': amplitude = bands.trebleSmooth; break
      }
      ;[r, g, b] = hslToRgb(0.7 - amplitude * 0.5, 0.9, (0.4 + amplitude * 0.35) * (1 - progress * 0.3))
      break
    }
    case 'stereo': {
      const balance = bands.stereoBalance
      const hue = balance < -0.1 ? 0.55 + Math.abs(balance) * 0.1 : balance > 0.1 ? 0.85 + balance * 0.1 : 0.25 + cycleHue * 0.2
      ;[r, g, b] = hslToRgb(hue, 0.85, (0.5 + bands.overallSmooth * 0.2) * (1 - progress * 0.3))
      break
    }
    case 'rainbow': {
      ;[r, g, b] = hslToRgb((cycleHue + fixture.baseHue + beam.hue * 0.5 + progress * 0.2) % 1, 0.95, 0.55 * (1 - progress * 0.3) * beam.intensity)
      break
    }
    default: {
      ;[r, g, b] = sampleGradient(gradient, progress * 0.5 + cycleHue * 0.3 + fixture.baseHue * 0.2)
      const fade = 1 - progress * 0.3
      r *= fade * beam.intensity * config.glowIntensity
      g *= fade * beam.intensity * config.glowIntensity
      b *= fade * beam.intensity * config.glowIntensity
    }
  }
  if (bands.beatIntensity > 0.3) {
    const flash = bands.beatIntensity * 0.3 * config.beatReactivity
    r = Math.min(1, r + flash); g = Math.min(1, g + flash); b = Math.min(1, b + flash)
  }
  return [r, g, b]
}

export const laserArray: VisualizationMode = {
  id: 'laser_array',
  name: 'Laser Array',
  description: 'Concert lasers with top-down beams and stage uplights',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    if (!config.gradient || !config.gradient.colorStops) {
      config.gradient = builtInGradients.neon
    }
    initFixtures(); initTrailParticles(); updateFixturePositions(config.laserCount)
    currentActiveFixtures = config.laserCount; sweepPhase = 0
    const gradient = getGradient()
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = i < MAX_TRAIL_PARTICLES && config.trailParticles ? config.originY : -200
      positions[i * 3 + 2] = i < MAX_TRAIL_PARTICLES && config.trailParticles ? config.originZ : 0
      const [cr, cg, cb] = sampleGradient(gradient, Math.random())
      colors[i * 3] = cr; colors[i * 3 + 1] = cg; colors[i * 3 + 2] = cb
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    if (!config.gradient || !config.gradient.colorStops) {
      config.gradient = builtInGradients.neon
    }
    
    const totalBeams = MAX_BEAMS + MAX_UPLIGHTS * MAX_UPLIGHT_BEAMS
    const vertexCount = totalBeams * 2 * 2
    lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3))
    lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
    lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)

    const totalFixtures = MAX_FIXTURES + MAX_UPLIGHTS
    glowGeometry = new THREE.BufferGeometry()
    glowGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(totalFixtures * 3), 3))
    glowGeometry.setAttribute('customColor', new THREE.BufferAttribute(new Float32Array(totalFixtures * 3), 3))
    glowGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(totalFixtures), 1))
    
    glowMaterial = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: emitterVertexShader,
      fragmentShader: emitterFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    glowPoints = new THREE.Points(glowGeometry, glowMaterial)
    scene.add(glowPoints)

    const fogCount = 500
    const fogPos = new Float32Array(fogCount * 3), fogCol = new Float32Array(fogCount * 3)
    for (let i = 0; i < fogCount; i++) {
      fogPos[i * 3] = (Math.random() - 0.5) * 100; fogPos[i * 3 + 1] = Math.random() * 60 - 30; fogPos[i * 3 + 2] = (Math.random() - 0.5) * 40
      fogCol[i * 3] = 0.3; fogCol[i * 3 + 1] = 0.3; fogCol[i * 3 + 2] = 0.4
    }
    fogGeometry = new THREE.BufferGeometry()
    fogGeometry.setAttribute('position', new THREE.BufferAttribute(fogPos, 3))
    fogGeometry.setAttribute('color', new THREE.BufferAttribute(fogCol, 3))
    fogMaterial = new THREE.PointsMaterial({ size: 2, vertexColors: true, transparent: true, opacity: config.fogEnabled ? config.fogDensity * 0.3 : 0, blending: THREE.AdditiveBlending, sizeAttenuation: true })
    fogPoints = new THREE.Points(fogGeometry, fogMaterial)
    scene.add(fogPoints)

    return {
      objects: [lineSegments, glowPoints, fogPoints],
      update: (bands: AudioBands, time: number) => {
        if (!lineGeometry || !glowGeometry) return
        const gradient = getGradient()
        const cycleHue = getCyclingHue(time)
        const posAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
        const colAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array, col = colAttr.array as Float32Array
        const glowPosAttr = glowGeometry.getAttribute('position') as THREE.BufferAttribute
        const glowColAttr = glowGeometry.getAttribute('customColor') as THREE.BufferAttribute
        const glowSizeAttr = glowGeometry.getAttribute('size') as THREE.BufferAttribute
        const glowPos = glowPosAttr.array as Float32Array
        const glowCol = glowColAttr.array as Float32Array
        const glowSize = glowSizeAttr.array as Float32Array

        const targetFixtures = Math.min(MAX_FIXTURES, config.laserCount + Math.floor(bands.overallSmooth * 4 * config.beatReactivity))
        if (targetFixtures !== currentActiveFixtures) { currentActiveFixtures = targetFixtures; updateFixturePositions(currentActiveFixtures) }
        sweepPhase += 0.02 * config.sweepSpeed * (1 + bands.midSmooth * config.midInfluence * 0.5)

        let vi = 0
        for (let f = 0; f < fixtures.length; f++) {
          const fix = fixtures[f]
          fix.intensity += (fix.targetIntensity - fix.intensity) * config.smoothingFactor
          
          glowPos[f * 3] = fix.x
          glowPos[f * 3 + 1] = fix.y
          glowPos[f * 3 + 2] = fix.z
          
          const gi = fix.intensity * (0.5 + bands.overallSmooth * 0.5) * config.glowIntensity
          const [gr, gg, gb] = sampleGradient(gradient, cycleHue + fix.baseHue * 0.3)
          glowCol[f * 3] = gr * gi
          glowCol[f * 3 + 1] = gg * gi
          glowCol[f * 3 + 2] = gb * gi
          
          const baseSize = fix.isUplight ? 8 : 10
          glowSize[f] = baseSize * fix.intensity * (1 + bands.beatIntensity * 0.5 * config.beatReactivity)
          
          if (fix.intensity < 0.1) continue
          fix.baseHue = cycleHue + (f % MAX_FIXTURES) * 0.08
          
          const activeBeams = fix.isUplight ? Math.min(fix.beams.length, config.uplightBeams) : Math.min(fix.beams.length, config.beamsPerLaser)
          const beamLength = fix.isUplight ? config.uplightLength : config.laserLength
          
          for (let b = 0; b < activeBeams; b++) {
            const beam = fix.beams[b]
            let bandSmooth: number
            switch (beam.frequencyBand) {
              case 'bass': bandSmooth = bands.bassSmooth * config.bassInfluence; break
              case 'mid': bandSmooth = bands.midSmooth * config.midInfluence; break
              case 'high': bandSmooth = bands.highSmooth * config.highInfluence; break
              case 'treble': bandSmooth = bands.trebleSmooth * config.highInfluence; break
            }
            
            if (fix.isUplight) {
              // Uplights: pointing UP
              const baseSweep = ((b / Math.max(1, activeBeams - 1)) - 0.5) * Math.PI * 0.35
              beam.targetAngle = baseSweep + Math.sin(sweepPhase * 0.8 + f * 0.5 + b * 0.3) * 0.2 * (1 + bandSmooth)
              beam.targetPitch = Math.PI * 0.25 + bandSmooth * 0.1
              beam.targetLength = beamLength * (0.7 + bandSmooth * 0.4 + bands.beatIntensity * 0.3 * config.beatReactivity)
            } else {
              // Main lasers: pointing DOWN
              const baseSweep = ((b / (activeBeams - 1)) - 0.5) * Math.PI * (config.sweepRange / 90)
              beam.targetAngle = baseSweep + Math.sin(sweepPhase * 0.6 + f * 0.7 + b * 0.25) * (0.25 + bandSmooth * 0.35)
              if (config.syncToBeats && bands.isBeat) beam.targetAngle += bands.beatIntensity * Math.sin((f * MAX_BEAMS_PER_FIXTURE + b) * 1.5) * 0.25 * config.beatReactivity
              beam.targetPitch = Math.PI * 0.35 + Math.sin(time * 0.5 + f * 0.4) * 0.1 + bandSmooth * 0.1
              beam.targetLength = beamLength * (0.7 + bandSmooth * 0.4 + bands.beatIntensity * 0.2 * config.beatReactivity)
            }
            
            beam.angle += (beam.targetAngle - beam.angle) * config.smoothingFactor
            beam.pitch += (beam.targetPitch - beam.pitch) * config.smoothingFactor * 0.8
            beam.length += (beam.targetLength - beam.length) * config.smoothingFactor * 1.2
            beam.intensity = (0.6 + bandSmooth * 0.35 + bands.beatIntensity * 0.15 * config.beatReactivity) * (1 + Math.sin(time * 20 + beam.flickerPhase) * 0.05 * bands.highSmooth * config.highInfluence) * fix.intensity
            
            const r = beam.length
            const sinP = Math.sin(beam.pitch)
            const cosP = Math.cos(beam.pitch)
            const sinA = Math.sin(beam.angle)
            const cosA = Math.cos(beam.angle)
            
            const endX = fix.x + sinA * sinP * r
            // Uplights go UP (+Y), main lasers go DOWN (-Y)
            const yDirection = fix.isUplight ? 1 : -1
            const endY = fix.y + yDirection * cosP * r
            const endZ = fix.z + cosA * sinP * r * 0.3
            
            pos[vi * 3] = fix.x; pos[vi * 3 + 1] = fix.y; pos[vi * 3 + 2] = fix.z
            const [sr, sg, sb] = getBeamColor(beam, fix, bands, cycleHue, 0)
            col[vi * 3] = sr; col[vi * 3 + 1] = sg; col[vi * 3 + 2] = sb; vi++
            pos[vi * 3] = endX; pos[vi * 3 + 1] = endY; pos[vi * 3 + 2] = endZ
            const [er, eg, eb] = getBeamColor(beam, fix, bands, cycleHue, 1)
            col[vi * 3] = er; col[vi * 3 + 1] = eg; col[vi * 3 + 2] = eb; vi++
            
            if (config.mirrorMode && !fix.isUplight) {
              const mx = fix.x - sinA * sinP * r
              pos[vi * 3] = fix.x; pos[vi * 3 + 1] = fix.y; pos[vi * 3 + 2] = fix.z
              col[vi * 3] = sr; col[vi * 3 + 1] = sg; col[vi * 3 + 2] = sb; vi++
              pos[vi * 3] = mx; pos[vi * 3 + 1] = endY; pos[vi * 3 + 2] = endZ
              col[vi * 3] = er; col[vi * 3 + 1] = eg; col[vi * 3 + 2] = eb; vi++
            }
          }
        }
        while (vi < pos.length / 3) { pos[vi * 3 + 1] = -200; vi++ }
        
        if (fogGeometry && fogMaterial) {
          fogMaterial.opacity = config.fogEnabled ? config.fogDensity * 0.3 * (0.5 + bands.overallSmooth * 0.5) : 0
          const fp = (fogGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
          const fc = (fogGeometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array
          for (let i = 0; i < fp.length / 3; i++) {
            fp[i * 3] += Math.sin(time * 0.2 + i * 0.1) * 0.02; fp[i * 3 + 1] += Math.cos(time * 0.15 + i * 0.15) * 0.015
            if (fp[i * 3] > 50) fp[i * 3] = -50; if (fp[i * 3] < -50) fp[i * 3] = 50
            if (fp[i * 3 + 1] > 30) fp[i * 3 + 1] = -30; if (fp[i * 3 + 1] < -30) fp[i * 3 + 1] = 30
            const [fr, fg, fb] = sampleGradient(gradient, cycleHue + i * 0.001)
            fc[i * 3] = fr * 0.3; fc[i * 3 + 1] = fg * 0.3; fc[i * 3 + 2] = fb * 0.4
          }
          ;(fogGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
          ;(fogGeometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
        }
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
        glowPosAttr.needsUpdate = true
        glowColAttr.needsUpdate = true
        glowSizeAttr.needsUpdate = true
      },
      dispose: () => {
        [lineGeometry, glowGeometry, fogGeometry].forEach(g => g?.dispose())
        ;[lineMaterial, glowMaterial, fogMaterial].forEach(m => m?.dispose())
        ;[lineSegments, glowPoints, fogPoints].forEach(o => o && scene.remove(o))
        lineGeometry = lineMaterial = lineSegments = glowGeometry = glowMaterial = glowPoints = fogGeometry = fogMaterial = fogPoints = null
      }
    }
  },

  animate(positions: Float32Array, _orig: Float32Array, sizes: Float32Array, colors: Float32Array, count: number, bands: AudioBands, time: number) {
    if (!config.trailParticles) { for (let i = 0; i < count; i++) { positions[i * 3 + 1] = -200; sizes[i] = 0 } return }
    const gradient = getGradient()
    const dt = 0.016, cycleHue = getCyclingHue(time)
    let pi = 0
    for (let f = 0; f < fixtures.length; f++) {
      const fix = fixtures[f]
      const activeBeams = fix.isUplight ? config.uplightBeams : config.beamsPerLaser
      for (let b = 0; b < activeBeams && b < fix.beams.length; b++) {
        const beam = fix.beams[b], pCount = Math.floor(TRAIL_PARTICLES_PER_BEAM * config.trailDensity)
        for (let p = 0; p < pCount; p++) {
          if (pi >= count) break
          const tp = trailParticles[pi]
          if (!tp || fix.intensity < 0.1) { positions[pi * 3 + 1] = -200; sizes[pi] = 0; pi++; continue }
          tp.age += dt / tp.maxAge
          if (tp.age > 1) { tp.age = 0; tp.t = Math.random() * 0.25; tp.maxAge = 0.25 + Math.random() * 0.35 }
          tp.t += dt * (0.7 + bands.overallSmooth * config.bassInfluence + bands.beatIntensity * 0.6 * config.beatReactivity)
          if (tp.t > 1) tp.t = 0
          const r = tp.t * beam.length, scatter = (1 - tp.t) * 1.5 * (Math.sin(pi * 3.7 + time * 4) * 0.5 + 0.5)
          const sinP = Math.sin(beam.pitch), cosP = Math.cos(beam.pitch)
          const sinA = Math.sin(beam.angle), cosA = Math.cos(beam.angle)
          const bx = fix.x + sinA * sinP * r
          const yDir = fix.isUplight ? 1 : -1
          const by = fix.y + yDir * cosP * r
          const bz = fix.z + cosA * sinP * r * 0.3
          positions[pi * 3] = bx + Math.sin(pi * 2.3) * scatter
          positions[pi * 3 + 1] = by + Math.cos(pi * 1.9) * scatter
          positions[pi * 3 + 2] = bz + Math.sin(pi * 1.7 + time) * scatter
          const lf = 1 - tp.age, bf = 1 - tp.t * 0.6
          sizes[pi] = (1.8 + bands.overallSmooth * 2.5 + bands.beatIntensity * 3 * config.beatReactivity) * lf * bf * fix.intensity
          const [pr, pg, pb] = sampleGradient(gradient, beam.hue + cycleHue * 0.3)
          colors[pi * 3] = pr * lf * beam.intensity * config.glowIntensity
          colors[pi * 3 + 1] = pg * lf * beam.intensity * config.glowIntensity
          colors[pi * 3 + 2] = pb * lf * beam.intensity * config.glowIntensity
          pi++
        }
      }
    }
    for (let i = pi; i < count; i++) { positions[i * 3 + 1] = -200; sizes[i] = 0 }
  }
}

// PUBLIC API
export function setLaserArrayConfig(c: Partial<LaserArrayConfig>) { 
  config = { ...config, ...c }
  if (!config.gradient || !config.gradient.colorStops) config.gradient = builtInGradients.neon
  initFixtures(); updateFixturePositions(config.laserCount) 
}
export function getLaserArrayConfig(): LaserArrayConfig { return { ...config } }
export function setLaserArrayGradient(g: GradientPreset) { if (g && g.colorStops) config.gradient = g }
export function setLaserArrayColorMode(m: LaserArrayConfig['colorMode']) { config.colorMode = m }
export function setLaserArrayLasers(p: { laserCount?: number; laserWidth?: number; laserLength?: number; beamsPerLaser?: number }) {
  if (p.laserCount !== undefined) config.laserCount = p.laserCount
  if (p.laserWidth !== undefined) config.laserWidth = p.laserWidth
  if (p.laserLength !== undefined) config.laserLength = p.laserLength
  if (p.beamsPerLaser !== undefined) config.beamsPerLaser = p.beamsPerLaser
  initFixtures(); updateFixturePositions(config.laserCount)
}
export function setLaserArrayUplights(p: { uplightCount?: number; uplightSpread?: number; uplightLength?: number; uplightBeams?: number }) {
  if (p.uplightCount !== undefined) config.uplightCount = p.uplightCount
  if (p.uplightSpread !== undefined) config.uplightSpread = p.uplightSpread
  if (p.uplightLength !== undefined) config.uplightLength = p.uplightLength
  if (p.uplightBeams !== undefined) config.uplightBeams = p.uplightBeams
  initFixtures(); updateFixturePositions(config.laserCount)
}
export function setLaserArrayOrigin(p: { originSpread?: number; originY?: number; originZ?: number }) {
  if (p.originSpread !== undefined) config.originSpread = p.originSpread
  if (p.originY !== undefined) config.originY = p.originY
  if (p.originZ !== undefined) config.originZ = p.originZ
  updateFixturePositions(config.laserCount)
}
export function setLaserArrayAnimation(p: { sweepSpeed?: number; sweepRange?: number; pulseSpeed?: number; syncToBeats?: boolean }) {
  if (p.sweepSpeed !== undefined) config.sweepSpeed = p.sweepSpeed
  if (p.sweepRange !== undefined) config.sweepRange = p.sweepRange
  if (p.pulseSpeed !== undefined) config.pulseSpeed = p.pulseSpeed
  if (p.syncToBeats !== undefined) config.syncToBeats = p.syncToBeats
}
export function setLaserArrayEffects(p: { fogEnabled?: boolean; fogDensity?: number; mirrorMode?: boolean; trailParticles?: boolean; trailDensity?: number; glowIntensity?: number }) {
  if (p.fogEnabled !== undefined) config.fogEnabled = p.fogEnabled
  if (p.fogDensity !== undefined) config.fogDensity = p.fogDensity
  if (p.mirrorMode !== undefined) config.mirrorMode = p.mirrorMode
  if (p.trailParticles !== undefined) config.trailParticles = p.trailParticles
  if (p.trailDensity !== undefined) config.trailDensity = p.trailDensity
  if (p.glowIntensity !== undefined) config.glowIntensity = p.glowIntensity
}
export function setLaserArrayAudioResponse(p: { bassInfluence?: number; midInfluence?: number; highInfluence?: number; beatReactivity?: number; smoothingFactor?: number }) {
  if (p.bassInfluence !== undefined) config.bassInfluence = p.bassInfluence
  if (p.midInfluence !== undefined) config.midInfluence = p.midInfluence
  if (p.highInfluence !== undefined) config.highInfluence = p.highInfluence
  if (p.beatReactivity !== undefined) config.beatReactivity = p.beatReactivity
  if (p.smoothingFactor !== undefined) config.smoothingFactor = p.smoothingFactor
}
export function resetLaserArrayConfig() { 
  config = { ...DEFAULT_CONFIG }
  config.gradient = builtInGradients.neon
  initFixtures(); updateFixturePositions(config.laserCount) 
}
