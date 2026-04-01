/**
 * GPU Fluid Simulation — "Ink in Water"
 * 
 * Real-time Navier-Stokes fluid dynamics solver running entirely on GPU
 * via Three.js WebGLRenderTarget ping-pong buffers.
 * 
 * Pipeline per frame:
 *   1. Inject velocity + dye splats (audio-reactive)
 *   2. Calculate curl (for vorticity confinement)
 *   3. Apply vorticity confinement force
 *   4. Calculate divergence
 *   5. Solve pressure (Jacobi iteration × 20)
 *   6. Subtract pressure gradient (divergence-free projection)
 *   7. Advect velocity through itself
 *   8. Advect dye through velocity
 *   9. Display dye with color grading
 */

import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import { createFullscreenQuad } from './metaballUtils'

// ============================================================================
// CONFIGURATION
// ============================================================================

const SIM_RES = 256
const DYE_RES = 512
const PRESSURE_ITERATIONS = 20
const CURL_STRENGTH = 35
const VELOCITY_DISSIPATION = 0.98
const DYE_DISSIPATION = 0.97
const PRESSURE_DISSIPATION = 0.8

// ============================================================================
// GLSL SHADERS
// ============================================================================

const baseVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const splatShader = `
  precision highp float;
  
  uniform sampler2D uTarget;
  uniform vec2 uPoint;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uAspectRatio;
  
  varying vec2 vUv;
  
  void main() {
    vec2 p = vUv - uPoint;
    p.x *= uAspectRatio;
    float splat = exp(-dot(p, p) / (2.0 * uRadius * uRadius));
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + uColor * splat, 1.0);
  }
`

const advectionShader = `
  precision highp float;
  
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 uTexelSize;
  uniform float uDt;
  uniform float uDissipation;
  
  varying vec2 vUv;
  
  void main() {
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vec2 coord = vUv - uDt * vel * uTexelSize;
    vec3 result = texture2D(uSource, coord).xyz * uDissipation;
    gl_FragColor = vec4(result, 1.0);
  }
`

const divergenceShader = `
  precision highp float;
  
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  
  varying vec2 vUv;
  
  void main() {
    float L = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    float T = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`

const curlShader = `
  precision highp float;
  
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  
  varying vec2 vUv;
  
  void main() {
    float L = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
    float R = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
    float B = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
    float T = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
    float curl = R - L - T + B;
    gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
  }
`

const vorticityShader = `
  precision highp float;
  
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 uTexelSize;
  uniform float uCurlStrength;
  uniform float uDt;
  
  varying vec2 vUv;
  
  void main() {
    float L = texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x;
    float T = texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x;
    float C = texture2D(uCurl, vUv).x;
    
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    float len = length(force) + 0.0001;
    force = force / len * uCurlStrength * C;
    
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vel += force * uDt;
    
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`

const pressureShader = `
  precision highp float;
  
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexelSize;
  
  varying vec2 vUv;
  
  void main() {
    float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float div = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - div) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`

const gradientSubtractShader = `
  precision highp float;
  
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  
  varying vec2 vUv;
  
  void main() {
    float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vel -= vec2(R - L, T - B) * 0.5;
    
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`

const clearShader = `
  precision highp float;
  
  uniform sampler2D uTexture;
  uniform float uDissipation;
  
  varying vec2 vUv;
  
  void main() {
    gl_FragColor = uDissipation * texture2D(uTexture, vUv);
  }
`

const displayShader = `
  precision highp float;
  
  uniform sampler2D uDye;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uBassSmooth;
  uniform float uBeatIntensity;
  
  varying vec2 vUv;
  
  void main() {
    vec3 dye = texture2D(uDye, vUv).rgb;
    
    // Tone mapping
    dye = pow(dye, vec3(0.85));
    
    // Subtle brightness boost on beat
    dye *= 1.0 + uBeatIntensity * 0.3;
    
    // Background: deep ocean void
    vec3 bg = vec3(0.005, 0.003, 0.015);
    
    // Add subtle noise grain for depth
    float grain = fract(sin(dot(vUv * uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    bg += grain * 0.008;
    
    // Mix: show background where dye is absent
    float dyeAmount = length(dye);
    vec3 color = mix(bg, dye, smoothstep(0.0, 0.08, dyeAmount));
    
    // Vignette
    vec2 center = vUv - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.8;
    vignette = smoothstep(0.0, 1.0, vignette);
    color *= vignette;
    
    // Subtle bass-reactive edge glow
    float edgeGlow = smoothstep(0.45, 0.5, length(center)) * uBassSmooth * 0.06;
    color += vec3(0.05, 0.02, 0.1) * edgeGlow;
    
    gl_FragColor = vec4(color, 1.0);
  }
`

// ============================================================================
// TYPES & HELPERS
// ============================================================================

interface DoubleFBO {
  read: THREE.WebGLRenderTarget
  write: THREE.WebGLRenderTarget
  swap: () => void
}

interface SplatEmitter {
  angle: number
  orbitRadius: number
  orbitSpeed: number
  color: THREE.Vector3
  bandIndex: number
  baseRadius: number
  lastSplatTime: number
}

function createFBO(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false
  })
}

function createDoubleFBO(width: number, height: number): DoubleFBO {
  let read = createFBO(width, height)
  let write = createFBO(width, height)
  return {
    get read() { return read },
    get write() { return write },
    swap() { const temp = read; read = write; write = temp }
  }
}

function createMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: baseVertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false })
}

// ============================================================================
// SPLAT EMITTER PALETTE
// ============================================================================

const SPLAT_COLORS = [
  new THREE.Vector3(0.08, 0.85, 0.95),
  new THREE.Vector3(0.95, 0.15, 0.45),
  new THREE.Vector3(1.0, 0.65, 0.05),
  new THREE.Vector3(0.2, 0.25, 0.95),
  new THREE.Vector3(0.75, 0.08, 0.92),
  new THREE.Vector3(0.1, 0.95, 0.4),
]

function createEmitters(): SplatEmitter[] {
  return [
    { angle: Math.PI * 1.5, orbitRadius: 0.28, orbitSpeed: 0.15, color: SPLAT_COLORS[0], bandIndex: 0, baseRadius: 0.015, lastSplatTime: 0 },
    { angle: Math.PI * 1.2, orbitRadius: 0.22, orbitSpeed: -0.2, color: SPLAT_COLORS[1], bandIndex: 1, baseRadius: 0.012, lastSplatTime: 0 },
    { angle: 0, orbitRadius: 0.18, orbitSpeed: 0.25, color: SPLAT_COLORS[2], bandIndex: 2, baseRadius: 0.010, lastSplatTime: 0 },
    { angle: Math.PI * 0.7, orbitRadius: 0.20, orbitSpeed: -0.18, color: SPLAT_COLORS[3], bandIndex: 3, baseRadius: 0.008, lastSplatTime: 0 },
    { angle: Math.PI * 0.5, orbitRadius: 0.15, orbitSpeed: 0.30, color: SPLAT_COLORS[4], bandIndex: 4, baseRadius: 0.006, lastSplatTime: 0 },
  ]
}

// ============================================================================
// STATE
// ============================================================================

let velocity: DoubleFBO | null = null
let pressure: DoubleFBO | null = null
let dye: DoubleFBO | null = null
let divergenceTarget: THREE.WebGLRenderTarget | null = null
let curlTarget: THREE.WebGLRenderTarget | null = null

let splatMat: THREE.ShaderMaterial | null = null
let advectionMat: THREE.ShaderMaterial | null = null
let divergenceMat: THREE.ShaderMaterial | null = null
let curlMat: THREE.ShaderMaterial | null = null
let vorticityMat: THREE.ShaderMaterial | null = null
let pressureMat: THREE.ShaderMaterial | null = null
let gradSubtractMat: THREE.ShaderMaterial | null = null
let clearMat: THREE.ShaderMaterial | null = null
let displayMat: THREE.ShaderMaterial | null = null

let simScene: THREE.Scene | null = null
let simCamera: THREE.OrthographicCamera | null = null
let simQuad: THREE.Mesh | null = null
let displayQuad: THREE.Mesh | null = null
let emitters: SplatEmitter[] = []
let lastBeatTime = 0

function blit(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
  if (!simQuad || !simScene || !simCamera) return
  simQuad.material = material
  renderer.setRenderTarget(target)
  renderer.render(simScene, simCamera)
}

function splat(renderer: THREE.WebGLRenderer, target: DoubleFBO, x: number, y: number, _dx: number, _dy: number, color: THREE.Vector3, radius: number, aspectRatio: number) {
  if (!splatMat) return
  splatMat.uniforms.uTarget.value = target.read.texture
  splatMat.uniforms.uPoint.value.set(x, y)
  splatMat.uniforms.uColor.value.copy(color)
  splatMat.uniforms.uRadius.value = radius
  splatMat.uniforms.uAspectRatio.value = aspectRatio
  blit(renderer, splatMat, target.write)
  target.swap()
}

function getBandValue(bands: AudioBands, index: number): number {
  switch (index) {
    case 0: return bands.bassSmooth
    case 1: return bands.lowMidSmooth
    case 2: return bands.midSmooth
    case 3: return bands.highMidSmooth
    case 4: return bands.trebleSmooth
    default: return bands.overallSmooth
  }
}

// ============================================================================
// VISUALIZATION EXPORT
// ============================================================================

export const fluidSimulation: VisualizationMode = {
  id: 'fluid_simulation',
  name: 'Fluid',
  description: 'GPU-accelerated fluid dynamics reacting to every frequency',
  hideParticles: true,

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = -1000; positions[i * 3 + 2] = 0
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    simScene = new THREE.Scene()
    simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const planeGeo = new THREE.PlaneGeometry(2, 2)
    simQuad = new THREE.Mesh(planeGeo, undefined)
    simScene.add(simQuad)

    velocity = createDoubleFBO(SIM_RES, SIM_RES)
    pressure = createDoubleFBO(SIM_RES, SIM_RES)
    dye = createDoubleFBO(DYE_RES, DYE_RES)
    divergenceTarget = createFBO(SIM_RES, SIM_RES)
    curlTarget = createFBO(SIM_RES, SIM_RES)

    const simTexel = new THREE.Vector2(1.0 / SIM_RES, 1.0 / SIM_RES)

    splatMat = createMaterial(splatShader, { uTarget: { value: null }, uPoint: { value: new THREE.Vector2() }, uColor: { value: new THREE.Vector3() }, uRadius: { value: 0.01 }, uAspectRatio: { value: 1.0 } })
    advectionMat = createMaterial(advectionShader, { uVelocity: { value: null }, uSource: { value: null }, uTexelSize: { value: simTexel }, uDt: { value: 0.016 }, uDissipation: { value: VELOCITY_DISSIPATION } })
    divergenceMat = createMaterial(divergenceShader, { uVelocity: { value: null }, uTexelSize: { value: simTexel } })
    curlMat = createMaterial(curlShader, { uVelocity: { value: null }, uTexelSize: { value: simTexel } })
    vorticityMat = createMaterial(vorticityShader, { uVelocity: { value: null }, uCurl: { value: null }, uTexelSize: { value: simTexel }, uCurlStrength: { value: CURL_STRENGTH }, uDt: { value: 0.016 } })
    pressureMat = createMaterial(pressureShader, { uPressure: { value: null }, uDivergence: { value: null }, uTexelSize: { value: simTexel } })
    gradSubtractMat = createMaterial(gradientSubtractShader, { uPressure: { value: null }, uVelocity: { value: null }, uTexelSize: { value: simTexel } })
    clearMat = createMaterial(clearShader, { uTexture: { value: null }, uDissipation: { value: PRESSURE_DISSIPATION } })

    const displayGeo = createFullscreenQuad()
    displayMat = new THREE.ShaderMaterial({ vertexShader: baseVertexShader, fragmentShader: displayShader, uniforms: { uDye: { value: null }, uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, uTime: { value: 0 }, uBassSmooth: { value: 0 }, uBeatIntensity: { value: 0 } }, depthTest: false, depthWrite: false })
    displayQuad = new THREE.Mesh(displayGeo, displayMat)
    displayQuad.frustumCulled = false
    displayQuad.renderOrder = -1000
    scene.add(displayQuad)

    emitters = createEmitters()
    lastBeatTime = 0

    const handleResize = () => { if (displayMat) displayMat.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight) }
    window.addEventListener('resize', handleResize)

    return {
      objects: [displayQuad],
      update: (bands: AudioBands, time: number, renderer?: THREE.WebGLRenderer) => {
        if (!renderer || !velocity || !pressure || !dye || !divergenceTarget || !curlTarget) return
        if (!splatMat || !advectionMat || !divergenceMat || !curlMat || !vorticityMat || !pressureMat || !gradSubtractMat || !clearMat || !displayMat) return

        const aspect = window.innerWidth / window.innerHeight
        const dt = 0.016

        // 1. INJECT AUDIO-REACTIVE SPLATS
        for (const emitter of emitters) {
          const bandVal = getBandValue(bands, emitter.bandIndex)
          if (bandVal < 0.05) continue
          emitter.angle += emitter.orbitSpeed * dt * (1 + bandVal * 2)
          const ex = 0.5 + Math.cos(emitter.angle) * emitter.orbitRadius
          const ey = 0.5 + Math.sin(emitter.angle) * emitter.orbitRadius
          const speed = bandVal * 400
          const dx = -Math.sin(emitter.angle) * speed + bands.stereoBalance * 100
          const dy = Math.cos(emitter.angle) * speed
          const velColor = new THREE.Vector3(dx * dt, dy * dt, 0)
          const splatRadius = emitter.baseRadius * (1 + bandVal * 3)
          splat(renderer, velocity, ex, ey, dx, dy, velColor, splatRadius, aspect)
          const dyeColor = emitter.color.clone().multiplyScalar(bandVal * 0.8)
          splat(renderer, dye, ex, ey, dx, dy, dyeColor, splatRadius * 1.5, aspect)
        }

        // Beat splat
        if (bands.isBeat && bands.beatIntensity > 0.4 && time - lastBeatTime > 0.3) {
          lastBeatTime = time
          const bx = 0.5 + (Math.random() - 0.5) * 0.4
          const by = 0.5 + (Math.random() - 0.5) * 0.4
          const bAngle = Math.random() * Math.PI * 2
          const bSpeed = bands.beatIntensity * 800
          const bdx = Math.cos(bAngle) * bSpeed
          const bdy = Math.sin(bAngle) * bSpeed
          splat(renderer, velocity, bx, by, bdx, bdy, new THREE.Vector3(bdx * dt, bdy * dt, 0), 0.012 + bands.beatIntensity * 0.02, aspect)
          const beatDyeColor = SPLAT_COLORS[Math.floor(Math.random() * SPLAT_COLORS.length)].clone().multiplyScalar(bands.beatIntensity * 1.2)
          splat(renderer, dye, bx, by, bdx, bdy, beatDyeColor, (0.012 + bands.beatIntensity * 0.02) * 2, aspect)
        }

        // 2. CURL
        curlMat.uniforms.uVelocity.value = velocity.read.texture
        blit(renderer, curlMat, curlTarget)

        // 3. VORTICITY CONFINEMENT
        vorticityMat.uniforms.uVelocity.value = velocity.read.texture
        vorticityMat.uniforms.uCurl.value = curlTarget.texture
        vorticityMat.uniforms.uCurlStrength.value = CURL_STRENGTH + bands.overallSmooth * 20
        vorticityMat.uniforms.uDt.value = dt
        blit(renderer, vorticityMat, velocity.write)
        velocity.swap()

        // 4. DIVERGENCE
        divergenceMat.uniforms.uVelocity.value = velocity.read.texture
        blit(renderer, divergenceMat, divergenceTarget)

        // 5. PRESSURE
        clearMat.uniforms.uTexture.value = pressure.read.texture
        clearMat.uniforms.uDissipation.value = PRESSURE_DISSIPATION
        blit(renderer, clearMat, pressure.write)
        pressure.swap()
        pressureMat.uniforms.uDivergence.value = divergenceTarget.texture
        for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
          pressureMat.uniforms.uPressure.value = pressure.read.texture
          blit(renderer, pressureMat, pressure.write)
          pressure.swap()
        }

        // 6. GRADIENT SUBTRACT
        gradSubtractMat.uniforms.uPressure.value = pressure.read.texture
        gradSubtractMat.uniforms.uVelocity.value = velocity.read.texture
        blit(renderer, gradSubtractMat, velocity.write)
        velocity.swap()

        // 7. ADVECT VELOCITY
        advectionMat.uniforms.uVelocity.value = velocity.read.texture
        advectionMat.uniforms.uSource.value = velocity.read.texture
        advectionMat.uniforms.uTexelSize.value.set(1.0 / SIM_RES, 1.0 / SIM_RES)
        advectionMat.uniforms.uDt.value = dt
        advectionMat.uniforms.uDissipation.value = VELOCITY_DISSIPATION
        blit(renderer, advectionMat, velocity.write)
        velocity.swap()

        // 8. ADVECT DYE
        advectionMat.uniforms.uVelocity.value = velocity.read.texture
        advectionMat.uniforms.uSource.value = dye.read.texture
        advectionMat.uniforms.uTexelSize.value.set(1.0 / DYE_RES, 1.0 / DYE_RES)
        advectionMat.uniforms.uDissipation.value = DYE_DISSIPATION
        blit(renderer, advectionMat, dye.write)
        dye.swap()

        // 9. DISPLAY
        displayMat.uniforms.uDye.value = dye.read.texture
        displayMat.uniforms.uTime.value = time
        displayMat.uniforms.uBassSmooth.value = bands.bassSmooth
        displayMat.uniforms.uBeatIntensity.value = bands.beatIntensity
        renderer.setRenderTarget(null)
      },
      dispose: () => {
        window.removeEventListener('resize', handleResize)
        velocity?.read.dispose(); velocity?.write.dispose()
        pressure?.read.dispose(); pressure?.write.dispose()
        dye?.read.dispose(); dye?.write.dispose()
        divergenceTarget?.dispose(); curlTarget?.dispose()
        velocity = null; pressure = null; dye = null; divergenceTarget = null; curlTarget = null
        ;[splatMat, advectionMat, divergenceMat, curlMat, vorticityMat, pressureMat, gradSubtractMat, clearMat, displayMat].forEach(m => m?.dispose())
        splatMat = null; advectionMat = null; divergenceMat = null; curlMat = null; vorticityMat = null; pressureMat = null; gradSubtractMat = null; clearMat = null; displayMat = null
        if (simQuad) { simQuad.geometry.dispose(); simScene?.remove(simQuad) }
        simQuad = null; simScene = null; simCamera = null
        if (displayQuad) { displayQuad.geometry.dispose(); scene.remove(displayQuad) }
        displayQuad = null; emitters = []
      }
    }
  },

  animate(_p: Float32Array, _o: Float32Array, sizes: Float32Array, _c: Float32Array, count: number, _b: AudioBands, _t: number) {
    for (let i = 0; i < count; i++) sizes[i] = 0
  }
}
