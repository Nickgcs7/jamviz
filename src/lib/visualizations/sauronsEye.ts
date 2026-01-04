import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { getCyclingHue } from '../colorUtils'
import { builtInGradients, sampleGradient, type GradientPreset } from '../gradients'
import * as THREE from 'three'

// ============================================================================
// CONFIGURATION - Full configuration API (mirrors Roadway/SpectrumAnalyzer)
// ============================================================================

export interface SauronsEyeConfig {
  // Eye geometry
  eyeSize: number
  irisRings: number
  pupilWidth: number
  pupilHeight: number
  ringSegments: number

  // Beam configuration
  beamEnabled: boolean
  beamLength: number
  beamWidth: number
  beamSweepRange: number
  beamSweepSpeed: number
  beamIntensity: number
  beamParticleCount: number
  beamOriginOffset: number  // How far from center the beam starts

  // Ember/ambient particles
  embersEnabled: boolean
  emberCount: number
  emberOrbitSpeed: number
  emberSpread: number

  // Color configuration
  colorMode: 'gradient' | 'pulse' | 'rainbow' | 'fire'
  gradient: GradientPreset
  colorCycleSpeed: number
  glowIntensity: number

  // Audio response
  bassInfluence: number
  midInfluence: number
  highInfluence: number
  beatReactivity: number

  // Animation
  swirlSpeed: number
  pulseSpeed: number
  smoothingFactor: number
}

const DEFAULT_CONFIG: SauronsEyeConfig = {
  eyeSize: 12,
  irisRings: 6,
  pupilWidth: 2.5,
  pupilHeight: 18,
  ringSegments: 64,

  beamEnabled: true,
  beamLength: 60,
  beamWidth: 25,
  beamSweepRange: Math.PI * 0.35,
  beamSweepSpeed: 0.4,
  beamIntensity: 1.0,
  beamParticleCount: 1200,
  beamOriginOffset: 0,  // Start exactly at eye center

  embersEnabled: true,
  emberCount: 250,
  emberOrbitSpeed: 0.12,
  emberSpread: 25,

  colorMode: 'gradient',
  gradient: builtInGradients.fire,
  colorCycleSpeed: 0.15,
  glowIntensity: 1.0,

  bassInfluence: 1.0,
  midInfluence: 1.0,
  highInfluence: 1.0,
  beatReactivity: 1.0,

  swirlSpeed: 0.3,
  pulseSpeed: 2.0,
  smoothingFactor: 0.08
}

let config: SauronsEyeConfig = { ...DEFAULT_CONFIG }

// ============================================================================
// PARTICLE COUNTS (fixed for array sizing)
// ============================================================================

const CORE_PARTICLES = 800
const PUPIL_PARTICLES = 200
const MAX_BEAM_PARTICLES = 1500
const MAX_AMBIENT_PARTICLES = 400
const TOTAL_MANAGED = CORE_PARTICLES + PUPIL_PARTICLES + MAX_BEAM_PARTICLES + MAX_AMBIENT_PARTICLES

// ============================================================================
// STATE
// ============================================================================

interface BeamParticle {
  distance: number
  lateralOffset: number
  verticalOffset: number
  age: number
  maxAge: number
  baseIntensity: number
  speed: number
}

const beamParticles: BeamParticle[] = []
let beamAngle = 0
let beamTargetAngle = 0
let lastBeatTime = 0
let eyeIntensity = 1
let pupilDilation = 1

// Scene objects - improved beam representation
let ringGeometries: THREE.BufferGeometry[] = []
let ringMaterials: THREE.LineBasicMaterial[] = []
let ringLines: THREE.LineLoop[] = []

// Volumetric beam cone using custom shader material
let beamMesh: THREE.Mesh | null = null
let beamMaterial: THREE.ShaderMaterial | null = null

// Inner glow sphere at eye center
let glowSphere: THREE.Mesh | null = null
let glowMaterial: THREE.MeshBasicMaterial | null = null

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function initBeamParticles() {
  beamParticles.length = 0
  const count = Math.min(config.beamParticleCount, MAX_BEAM_PARTICLES)
  
  for (let i = 0; i < count; i++) {
    beamParticles.push({
      distance: Math.random() * config.beamLength,
      lateralOffset: (Math.random() - 0.5) * 2,
      verticalOffset: (Math.random() - 0.5) * 2,
      age: Math.random(),
      maxAge: 0.5 + Math.random() * 0.7,
      baseIntensity: 0.4 + Math.random() * 0.6,
      speed: 30 + Math.random() * 20
    })
  }
}

function getPupilShape(t: number, dilation: number): { x: number; y: number } {
  const heightScale = config.pupilHeight * dilation
  const widthScale = config.pupilWidth * (0.4 + dilation * 0.6)
  
  return {
    x: Math.sin(t * Math.PI * 2) * widthScale,
    y: Math.cos(t * Math.PI * 2) * heightScale * 0.5
  }
}

// Volumetric spotlight shader - creates realistic light cone emanating from center
function createBeamShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      lightColor: { value: new THREE.Color(1.0, 0.6, 0.2) },
      spotPosition: { value: new THREE.Vector3(0, 0, 0) },
      attenuation: { value: config.beamLength * 1.2 },
      anglePower: { value: 3.0 },
      intensity: { value: config.beamIntensity },
      time: { value: 0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vDistFromAxis;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        // Calculate distance from cone axis for falloff
        vDistFromAxis = length(position.xy);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vDistFromAxis;
      
      uniform vec3 lightColor;
      uniform vec3 spotPosition;
      uniform float attenuation;
      uniform float anglePower;
      uniform float intensity;
      uniform float time;
      
      void main() {
        // Distance-based attenuation from the origin point
        float distFromSpot = distance(vWorldPosition, spotPosition);
        float distAtten = 1.0 - clamp(distFromSpot / attenuation, 0.0, 1.0);
        distAtten = pow(distAtten, 1.5);
        
        // Angle-based intensity (brighter toward center of cone)
        float rim = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        float angleAtten = pow(rim, anglePower);
        
        // Edge softness based on distance from axis
        float edgeSoftness = 1.0 - smoothstep(0.0, 1.0, vDistFromAxis * 0.15);
        
        // Flickering effect
        float flicker = 0.9 + 0.1 * sin(time * 8.0 + distFromSpot * 0.3);
        
        // Combine all attenuation factors
        float finalIntensity = distAtten * angleAtten * edgeSoftness * intensity * flicker;
        
        // Add subtle color variation along the beam
        vec3 finalColor = mix(lightColor, lightColor * vec3(1.2, 0.9, 0.6), distFromSpot / attenuation);
        
        gl_FragColor = vec4(finalColor * finalIntensity, finalIntensity * 0.6);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  })
}

// Create cone geometry that starts from a point (the eye center)
function createBeamGeometry(): THREE.BufferGeometry {
  // ConeGeometry(radius, height, radialSegments, heightSegments, openEnded)
  // Creates a cone with apex at top (+Y), base at bottom (-Y)
  const geometry = new THREE.ConeGeometry(
    config.beamWidth,         // radius at base
    config.beamLength,        // height
    32,                       // radialSegments - smooth circle
    1,                        // heightSegments
    true                      // openEnded - no cap at base
  )
  
  // Default cone: apex at +Y, base at -Y, centered at origin
  // We want: apex at origin (eye center), opening toward -Z (into the scene)
  // Rotate -90 degrees around X axis to point along Z
  geometry.rotateX(-Math.PI / 2)
  
  // Now apex is at +Z, base at -Z, but centered at origin
  // Translate so the apex (tip) is at origin
  geometry.translate(0, 0, -config.beamLength / 2)
  
  return geometry
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const sauronsEye: VisualizationMode = {
  id: 'saurons_eye',
  name: "Sauron's Eye",
  description: 'The all-seeing eye with a searching beam that pulses to the music',
  hideParticles: false,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initBeamParticles()
    beamAngle = 0
    beamTargetAngle = 0
    lastBeatTime = 0
    eyeIntensity = 1
    pupilDilation = 1

    // Initialize iris particles (fiery ring)
    for (let i = 0; i < CORE_PARTICLES; i++) {
      const angle = (i / CORE_PARTICLES) * Math.PI * 2
      const radiusFactor = 0.3 + Math.pow(Math.random(), 0.5) * 0.7
      const radius = config.eyeSize * radiusFactor
      
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2
      
      const temp = 1 - radiusFactor
      const [r, g, b] = sampleGradient(config.gradient, temp)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    // Initialize pupil particles (dark vertical slit)
    for (let i = 0; i < PUPIL_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      const t = i / PUPIL_PARTICLES
      const pupilShape = getPupilShape(t, 1)
      
      positions[particleIndex * 3] = pupilShape.x
      positions[particleIndex * 3 + 1] = pupilShape.y
      positions[particleIndex * 3 + 2] = 0.5
      
      colors[particleIndex * 3] = 0.05
      colors[particleIndex * 3 + 1] = 0.0
      colors[particleIndex * 3 + 2] = 0.0
    }

    // Initialize beam particles (positioned along the beam)
    const beamCount = Math.min(config.beamParticleCount, MAX_BEAM_PARTICLES)
    for (let i = 0; i < beamCount; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
      positions[particleIndex * 3] = 0
      positions[particleIndex * 3 + 1] = -200  // Hidden initially
      positions[particleIndex * 3 + 2] = 0
      colors[particleIndex * 3] = 1.0
      colors[particleIndex * 3 + 1] = 0.7
      colors[particleIndex * 3 + 2] = 0.3
    }

    // Initialize ambient embers
    const emberCount = Math.min(config.emberCount, MAX_AMBIENT_PARTICLES)
    for (let i = 0; i < emberCount; i++) {
      const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + MAX_BEAM_PARTICLES + i
      const radius = config.eyeSize + 5 + Math.random() * config.emberSpread
      const angle = Math.random() * Math.PI * 2
      positions[particleIndex * 3] = Math.cos(angle) * radius
      positions[particleIndex * 3 + 1] = Math.sin(angle) * radius
      positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * 10
      
      const [r, g, b] = sampleGradient(config.gradient, 0.7 + Math.random() * 0.3)
      colors[particleIndex * 3] = r
      colors[particleIndex * 3 + 1] = g
      colors[particleIndex * 3 + 2] = b
    }

    // Hide unused particles
    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -200
      positions[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    // Clean up existing objects
    ringGeometries.forEach(g => g.dispose())
    ringMaterials.forEach(m => m.dispose())
    ringLines.forEach(l => scene.remove(l))
    ringGeometries = []
    ringMaterials = []
    ringLines = []

    if (beamMesh) {
      beamMesh.geometry.dispose()
      scene.remove(beamMesh)
      beamMesh = null
    }
    if (beamMaterial) {
      beamMaterial.dispose()
      beamMaterial = null
    }
    if (glowSphere) {
      glowSphere.geometry.dispose()
      scene.remove(glowSphere)
      glowSphere = null
    }
    if (glowMaterial) {
      glowMaterial.dispose()
      glowMaterial = null
    }

    // Create iris rings for detail
    for (let r = 0; r < config.irisRings; r++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array((config.ringSegments + 1) * 3)
      const radiusFactor = 0.4 + (r / config.irisRings) * 0.6
      const radius = config.eyeSize * radiusFactor
      
      for (let j = 0; j <= config.ringSegments; j++) {
        const angle = (j / config.ringSegments) * Math.PI * 2
        positions[j * 3] = Math.cos(angle) * radius
        positions[j * 3 + 1] = Math.sin(angle) * radius
        positions[j * 3 + 2] = 0
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      const material = new THREE.LineBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        linewidth: 2
      })
      
      const line = new THREE.LineLoop(geometry, material)
      scene.add(line)
      
      ringGeometries.push(geometry)
      ringMaterials.push(material)
      ringLines.push(line)
    }

    // Create central glow sphere at eye center
    const glowGeometry = new THREE.SphereGeometry(config.eyeSize * 0.3, 16, 16)
    glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    })
    glowSphere = new THREE.Mesh(glowGeometry, glowMaterial)
    glowSphere.position.set(0, 0, 0)
    scene.add(glowSphere)

    // Create volumetric beam cone if enabled
    if (config.beamEnabled) {
      beamMaterial = createBeamShaderMaterial()
      const beamGeometry = createBeamGeometry()
      beamMesh = new THREE.Mesh(beamGeometry, beamMaterial)
      // Position at eye center - the geometry is already set up to emanate from origin
      beamMesh.position.set(0, 0, 0)
      scene.add(beamMesh)
    }

    return {
      objects: [...ringLines, beamMesh, glowSphere].filter(Boolean) as THREE.Object3D[],
      update: (bands: AudioBands, time: number) => {
        const cycleHue = getCyclingHue(time)
        
        // Bass makes the eye more intense
        const targetIntensity = 0.7 + 
          bands.bassSmooth * 0.4 * config.bassInfluence + 
          bands.beatIntensity * 0.3 * config.beatReactivity
        eyeIntensity += (targetIntensity - eyeIntensity) * config.smoothingFactor
        
        // Pupil dilates with high frequencies
        const targetDilation = 0.5 + 
          bands.highSmooth * 0.5 * config.highInfluence + 
          bands.brillianceSmooth * 0.3 * config.highInfluence
        pupilDilation += (targetDilation - pupilDilation) * config.smoothingFactor
        
        // Beat causes eye to flare
        if (bands.isBeat && time - lastBeatTime > 0.2) {
          lastBeatTime = time
          eyeIntensity = Math.min(1.5, eyeIntensity + bands.beatIntensity * 0.5 * config.beatReactivity)
        }
        
        // Beam searches - sweeps back and forth
        const sweepSpeed = config.beamSweepSpeed * (1 + bands.midSmooth * 0.8 * config.midInfluence)
        beamTargetAngle = Math.sin(time * sweepSpeed) * config.beamSweepRange * 
          (0.6 + bands.overallSmooth * 0.5)
        
        // Beats cause beam to snap to new angles
        if (bands.beatIntensity > 0.5) {
          beamTargetAngle += (Math.random() - 0.5) * config.beamSweepRange * 0.4 * config.beatReactivity
        }
        
        beamAngle += (beamTargetAngle - beamAngle) * 0.06
        
        // Update beam mesh
        if (beamMesh && beamMaterial) {
          // Rotate beam around Y axis (sweeping left/right)
          beamMesh.rotation.y = beamAngle
          
          // Update shader uniforms
          beamMaterial.uniforms.time.value = time
          beamMaterial.uniforms.intensity.value = config.beamIntensity * 
            (0.6 + bands.bassSmooth * 0.4 * config.bassInfluence + bands.beatIntensity * 0.3 * config.beatReactivity)
          
          // Update beam color based on gradient
          const temp = 0.3 + bands.bassSmooth * 0.3
          const [r, g, b] = sampleGradient(config.gradient, temp)
          beamMaterial.uniforms.lightColor.value.setRGB(r, g, b)
        }
        
        // Update glow sphere
        if (glowSphere && glowMaterial) {
          const glowScale = 1 + bands.bassSmooth * 0.3 + bands.beatIntensity * 0.2
          glowSphere.scale.setScalar(glowScale)
          glowMaterial.opacity = (0.3 + bands.beatIntensity * 0.4) * config.glowIntensity
          
          const [gr, gg, gb] = sampleGradient(config.gradient, 0.2 + cycleHue * 0.1)
          glowMaterial.color.setRGB(gr * 1.5, gg, gb)
        }
        
        // Update iris rings
        for (let r = 0; r < config.irisRings; r++) {
          const material = ringMaterials[r]
          const line = ringLines[r]
          const geometry = ringGeometries[r]
          
          // Pulsing scale based on audio
          const pulse = 1 + Math.sin(time * config.pulseSpeed + r * 0.5) * 0.05 * bands.midSmooth * config.midInfluence
          const beatPulse = bands.beatIntensity * 0.15 * config.beatReactivity
          line.scale.setScalar(pulse + beatPulse)
          
          // Color shifts with audio
          const temp = (r / config.irisRings) * 0.5 + cycleHue * config.colorCycleSpeed + bands.bassSmooth * 0.2
          const [r2, g2, b2] = sampleGradient(config.gradient, temp)
          material.color.setRGB(r2, g2, b2)
          
          // Opacity pulses
          const ringIntensity = eyeIntensity * (0.3 + (1 - r / config.irisRings) * 0.5) * config.glowIntensity
          material.opacity = ringIntensity * (0.4 + bands.bassSmooth * 0.3)
          
          // Add waviness to rings
          const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
          const positions = posAttr.array as Float32Array
          const radiusFactor = 0.4 + (r / config.irisRings) * 0.6
          const baseRadius = config.eyeSize * radiusFactor
          
          for (let j = 0; j <= config.ringSegments; j++) {
            const angle = (j / config.ringSegments) * Math.PI * 2
            const wave = Math.sin(angle * 4 + time * 2) * 0.3 * bands.highSmooth * config.highInfluence
            const radius = baseRadius + wave
            positions[j * 3] = Math.cos(angle) * radius
            positions[j * 3 + 1] = Math.sin(angle) * radius
          }
          posAttr.needsUpdate = true
        }
      },
      dispose: () => {
        ringGeometries.forEach(g => g.dispose())
        ringMaterials.forEach(m => m.dispose())
        ringLines.forEach(l => scene.remove(l))
        
        if (beamMesh) {
          beamMesh.geometry.dispose()
          scene.remove(beamMesh)
        }
        if (beamMaterial) beamMaterial.dispose()
        if (glowSphere) {
          glowSphere.geometry.dispose()
          scene.remove(glowSphere)
        }
        if (glowMaterial) glowMaterial.dispose()
        
        ringGeometries = []
        ringMaterials = []
        ringLines = []
        beamMesh = null
        beamMaterial = null
        glowSphere = null
        glowMaterial = null
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

    // Animate iris particles
    for (let i = 0; i < Math.min(count, CORE_PARTICLES); i++) {
      const angle = (i / CORE_PARTICLES) * Math.PI * 2
      const radiusFactor = 0.3 + Math.pow((i % 100) / 100, 0.5) * 0.7
      
      // Pulsing radius
      const basePulse = Math.sin(time * config.pulseSpeed + radiusFactor * 3) * 0.15
      const beatPulse = bands.beatIntensity * 0.3 * config.beatReactivity
      const bassExpand = bands.bassSmooth * 0.4 * config.bassInfluence
      const radius = config.eyeSize * radiusFactor * (1 + basePulse + beatPulse + bassExpand)
      
      // Swirling motion
      const swirl = time * config.swirlSpeed + radiusFactor * 2
      const finalAngle = angle + swirl
      
      positions[i * 3] = Math.cos(finalAngle) * radius
      positions[i * 3 + 1] = Math.sin(finalAngle) * radius
      positions[i * 3 + 2] = Math.sin(time * 2 + i * 0.1) * 1.5 * bands.midSmooth * config.midInfluence
      
      // Color based on distance from center
      const temp = (1 - radiusFactor) * 0.6 + cycleHue * config.colorCycleSpeed
      const [r, g, b] = sampleGradient(config.gradient, temp)
      const brightness = eyeIntensity * (0.7 + radiusFactor * 0.3) * config.glowIntensity
      colors[i * 3] = r * brightness
      colors[i * 3 + 1] = g * brightness
      colors[i * 3 + 2] = b * brightness
      
      sizes[i] = (2 + radiusFactor * 3 + bands.beatIntensity * 2 * config.beatReactivity) * eyeIntensity
    }

    // Animate pupil (vertical slit)
    for (let i = 0; i < PUPIL_PARTICLES; i++) {
      const particleIndex = CORE_PARTICLES + i
      if (particleIndex >= count) break
      
      const t = i / PUPIL_PARTICLES
      const pupilShape = getPupilShape(t, pupilDilation)
      
      positions[particleIndex * 3] = pupilShape.x
      positions[particleIndex * 3 + 1] = pupilShape.y
      positions[particleIndex * 3 + 2] = 0.5 + Math.sin(time * 4 + i) * 0.2
      
      // Dark pupil with slight red glow on edges
      const edgeFactor = Math.abs(t - 0.5) * 2
      colors[particleIndex * 3] = 0.05 + edgeFactor * 0.15 * eyeIntensity
      colors[particleIndex * 3 + 1] = 0.0
      colors[particleIndex * 3 + 2] = 0.0
      
      sizes[particleIndex] = 3 + edgeFactor * 2
    }

    // Animate beam particles - these should emanate FROM the eye center
    if (config.beamEnabled) {
      const beamCount = Math.min(config.beamParticleCount, MAX_BEAM_PARTICLES)
      for (let i = 0; i < beamCount; i++) {
        const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
        if (particleIndex >= count) break
        
        const bp = beamParticles[i]
        
        // Age particles
        bp.age += dt / bp.maxAge
        if (bp.age > 1) {
          // Reset particle to start from eye center
          bp.age = 0
          bp.distance = config.beamOriginOffset
          bp.maxAge = 0.4 + Math.random() * 0.6
          bp.baseIntensity = 0.4 + Math.random() * 0.6
          bp.lateralOffset = (Math.random() - 0.5) * 2
          bp.verticalOffset = (Math.random() - 0.5) * 2
          bp.speed = 25 + Math.random() * 25
        }
        
        // Move along beam direction (away from eye)
        const speed = bp.speed + bands.bassSmooth * 30 * config.bassInfluence + bands.beatIntensity * 15 * config.beatReactivity
        bp.distance += dt * speed
        
        if (bp.distance > config.beamLength) {
          bp.age = 1 // Reset
          continue
        }
        
        // Calculate beam spread - starts narrow at eye, widens with distance
        const beamProgress = bp.distance / config.beamLength
        const spreadRadius = config.beamWidth * beamProgress * 0.5  // Cone spreads out
        
        // Position in local beam space
        const localX = bp.lateralOffset * spreadRadius
        const localY = bp.verticalOffset * spreadRadius
        const localZ = -bp.distance  // Negative Z = into the scene
        
        // Rotate by beam angle (sweeping)
        const cosA = Math.cos(beamAngle)
        const sinA = Math.sin(beamAngle)
        
        // Rotate around Y axis
        const rotatedX = localX * cosA - localZ * sinA
        const rotatedZ = localX * sinA + localZ * cosA
        
        positions[particleIndex * 3] = rotatedX
        positions[particleIndex * 3 + 1] = localY
        positions[particleIndex * 3 + 2] = rotatedZ
        
        // Color fades along beam
        const life = 1 - bp.age
        const distanceFade = 1 - beamProgress * 0.5  // Fade toward end
        const temp = 0.1 + beamProgress * 0.4
        const [r, g, b] = sampleGradient(config.gradient, temp)
        const brightness = bp.baseIntensity * life * distanceFade * eyeIntensity * config.glowIntensity
        
        colors[particleIndex * 3] = r * brightness
        colors[particleIndex * 3 + 1] = g * brightness
        colors[particleIndex * 3 + 2] = b * brightness
        
        sizes[particleIndex] = (1.5 + bands.beatIntensity * 2 * config.beatReactivity) * life * distanceFade
      }
    } else {
      // Hide beam particles if disabled
      for (let i = 0; i < MAX_BEAM_PARTICLES; i++) {
        const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + i
        if (particleIndex >= count) break
        positions[particleIndex * 3 + 1] = -200
        sizes[particleIndex] = 0
      }
    }

    // Animate ambient embers
    if (config.embersEnabled) {
      const emberCount = Math.min(config.emberCount, MAX_AMBIENT_PARTICLES)
      for (let i = 0; i < emberCount; i++) {
        const particleIndex = CORE_PARTICLES + PUPIL_PARTICLES + MAX_BEAM_PARTICLES + i
        if (particleIndex >= count) break
        
        const orbitSpeed = config.emberOrbitSpeed + (i % 10) * 0.02
        const orbitPhase = time * orbitSpeed + i * 0.5
        const radius = config.eyeSize + 5 + (i % 20)
        
        positions[particleIndex * 3] = Math.cos(orbitPhase) * radius
        positions[particleIndex * 3 + 1] = Math.sin(orbitPhase) * radius
        positions[particleIndex * 3 + 2] = Math.sin(time + i * 0.3) * 5
        
        const [r, g, b] = sampleGradient(config.gradient, 0.7 + (i % 30) / 100)
        const flicker = 0.5 + Math.sin(time * 3 + i) * 0.3 + Math.random() * 0.2
        colors[particleIndex * 3] = r * flicker * config.glowIntensity
        colors[particleIndex * 3 + 1] = g * flicker * config.glowIntensity
        colors[particleIndex * 3 + 2] = b * flicker * config.glowIntensity
        
        sizes[particleIndex] = (0.8 + Math.sin(time * 2 + i) * 0.4) * (1 + bands.highSmooth * config.highInfluence)
      }
    }

    // Hide unused particles
    for (let i = TOTAL_MANAGED; i < count; i++) {
      positions[i * 3 + 1] = -200
      sizes[i] = 0
    }
  }
}

// ============================================================================
// PUBLIC API - Configuration Functions (mirrors Roadway pattern)
// ============================================================================

export function setSauronsEyeConfig(newConfig: Partial<SauronsEyeConfig>): void {
  config = { ...config, ...newConfig }
  // Reinitialize beam particles if count changed
  if (newConfig.beamParticleCount !== undefined || newConfig.beamLength !== undefined) {
    initBeamParticles()
  }
}

export function getSauronsEyeConfig(): SauronsEyeConfig {
  return { ...config }
}

export function setSauronsEyeGradient(gradient: GradientPreset): void {
  config.gradient = gradient
}

export function setSauronsEyeColorMode(mode: SauronsEyeConfig['colorMode']): void {
  config.colorMode = mode
}

export function setSauronsEyeGeometry(params: {
  eyeSize?: number
  irisRings?: number
  pupilWidth?: number
  pupilHeight?: number
  ringSegments?: number
}): void {
  if (params.eyeSize !== undefined) config.eyeSize = params.eyeSize
  if (params.irisRings !== undefined) config.irisRings = params.irisRings
  if (params.pupilWidth !== undefined) config.pupilWidth = params.pupilWidth
  if (params.pupilHeight !== undefined) config.pupilHeight = params.pupilHeight
  if (params.ringSegments !== undefined) config.ringSegments = params.ringSegments
}

export function setSauronsEyeBeam(params: {
  beamEnabled?: boolean
  beamLength?: number
  beamWidth?: number
  beamSweepRange?: number
  beamSweepSpeed?: number
  beamIntensity?: number
  beamParticleCount?: number
}): void {
  if (params.beamEnabled !== undefined) config.beamEnabled = params.beamEnabled
  if (params.beamLength !== undefined) config.beamLength = params.beamLength
  if (params.beamWidth !== undefined) config.beamWidth = params.beamWidth
  if (params.beamSweepRange !== undefined) config.beamSweepRange = params.beamSweepRange
  if (params.beamSweepSpeed !== undefined) config.beamSweepSpeed = params.beamSweepSpeed
  if (params.beamIntensity !== undefined) config.beamIntensity = params.beamIntensity
  if (params.beamParticleCount !== undefined) {
    config.beamParticleCount = params.beamParticleCount
    initBeamParticles()
  }
}

export function setSauronsEyeEmbers(params: {
  embersEnabled?: boolean
  emberCount?: number
  emberOrbitSpeed?: number
  emberSpread?: number
}): void {
  if (params.embersEnabled !== undefined) config.embersEnabled = params.embersEnabled
  if (params.emberCount !== undefined) config.emberCount = params.emberCount
  if (params.emberOrbitSpeed !== undefined) config.emberOrbitSpeed = params.emberOrbitSpeed
  if (params.emberSpread !== undefined) config.emberSpread = params.emberSpread
}

export function setSauronsEyeAudioResponse(params: {
  bassInfluence?: number
  midInfluence?: number
  highInfluence?: number
  beatReactivity?: number
  smoothingFactor?: number
}): void {
  if (params.bassInfluence !== undefined) config.bassInfluence = params.bassInfluence
  if (params.midInfluence !== undefined) config.midInfluence = params.midInfluence
  if (params.highInfluence !== undefined) config.highInfluence = params.highInfluence
  if (params.beatReactivity !== undefined) config.beatReactivity = params.beatReactivity
  if (params.smoothingFactor !== undefined) config.smoothingFactor = params.smoothingFactor
}

export function setSauronsEyeAnimation(params: {
  swirlSpeed?: number
  pulseSpeed?: number
  colorCycleSpeed?: number
  glowIntensity?: number
}): void {
  if (params.swirlSpeed !== undefined) config.swirlSpeed = params.swirlSpeed
  if (params.pulseSpeed !== undefined) config.pulseSpeed = params.pulseSpeed
  if (params.colorCycleSpeed !== undefined) config.colorCycleSpeed = params.colorCycleSpeed
  if (params.glowIntensity !== undefined) config.glowIntensity = params.glowIntensity
}

export function resetSauronsEyeConfig(): void {
  config = { ...DEFAULT_CONFIG }
  initBeamParticles()
}
