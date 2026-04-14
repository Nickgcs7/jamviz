/**
 * Reaction-Diffusion (Gray-Scott Model)
 * 
 * Two virtual chemicals interact to create Turing patterns that evolve in real-time.
 * Audio modulates feed/kill rates to shift between spots, stripes, labyrinths, and chaos.
 * Uses FBO ping-pong rendering (same pattern as fluid simulation).
 * 
 * Audio mapping:
 *   - subBass/bass → feed rate (pattern density)
 *   - mid → kill rate (pattern type: spots vs stripes vs labyrinth)
 *   - treble/brilliance → kill rate fine-tuning
 *   - spectralCentroid → display color palette position
 *   - energyTrend → simulation speed (buildups accelerate pattern evolution)
 *   - isOnset → seed injection (new pattern nucleation sites)
 *   - beatIntensity → display glow intensity
 */

import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import { createFullscreenQuad } from './metaballUtils'

const SIM_RES = 512

const baseVert = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`

const reactionShader = `
  precision highp float;
  uniform sampler2D uState;
  uniform vec2 uTexelSize;
  uniform float uFeed;
  uniform float uKill;
  uniform float uDiffA;
  uniform float uDiffB;
  uniform float uDt;
  varying vec2 vUv;
  void main() {
    vec4 state = texture2D(uState, vUv);
    float A = state.r;
    float B = state.g;
    vec4 sL = texture2D(uState, vUv - vec2(uTexelSize.x, 0.0));
    vec4 sR = texture2D(uState, vUv + vec2(uTexelSize.x, 0.0));
    vec4 sB = texture2D(uState, vUv - vec2(0.0, uTexelSize.y));
    vec4 sT = texture2D(uState, vUv + vec2(0.0, uTexelSize.y));
    float lapA = (sL.r + sR.r + sB.r + sT.r - 4.0 * A);
    float lapB = (sL.g + sR.g + sB.g + sT.g - 4.0 * B);
    float reaction = A * B * B;
    float newA = A + (uDiffA * lapA - reaction + uFeed * (1.0 - A)) * uDt;
    float newB = B + (uDiffB * lapB + reaction - (uKill + uFeed) * B) * uDt;
    newA = clamp(newA, 0.0, 1.0);
    newB = clamp(newB, 0.0, 1.0);
    gl_FragColor = vec4(newA, newB, 0.0, 1.0);
  }
`

const seedShader = `
  precision highp float;
  uniform sampler2D uState;
  uniform vec2 uPoint;
  uniform float uRadius;
  uniform float uAspectRatio;
  varying vec2 vUv;
  void main() {
    vec4 state = texture2D(uState, vUv);
    vec2 p = vUv - uPoint;
    p.x *= uAspectRatio;
    float d = length(p);
    float seed = smoothstep(uRadius, uRadius * 0.3, d);
    state.g = max(state.g, seed);
    state.r = min(state.r, 1.0 - seed * 0.5);
    gl_FragColor = state;
  }
`

const displayShader = `
  precision highp float;
  uniform sampler2D uState;
  uniform float uTime;
  uniform float uSpectralCentroid;
  uniform float uBeatIntensity;
  uniform float uEnergyTrend;
  uniform float uRMS;
  uniform float uOnsetIntensity;
  varying vec2 vUv;
  
  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c * 0.5;
    vec3 rgb;
    float hh = h * 6.0;
    if (hh < 1.0) rgb = vec3(c, x, 0.0);
    else if (hh < 2.0) rgb = vec3(x, c, 0.0);
    else if (hh < 3.0) rgb = vec3(0.0, c, x);
    else if (hh < 4.0) rgb = vec3(0.0, x, c);
    else if (hh < 5.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
  }
  
  void main() {
    vec4 state = texture2D(uState, vUv);
    float B = state.g;
    float pattern = B;
    
    // Edge detection for structural highlighting
    vec2 texel = vec2(1.0 / 512.0);
    float bL = texture2D(uState, vUv - vec2(texel.x, 0.0)).g;
    float bR = texture2D(uState, vUv + vec2(texel.x, 0.0)).g;
    float bU = texture2D(uState, vUv + vec2(0.0, texel.y)).g;
    float bD = texture2D(uState, vUv - vec2(0.0, texel.y)).g;
    float edge = abs(bR - bL) + abs(bU - bD);
    edge = smoothstep(0.0, 0.25, edge);
    
    float lum = smoothstep(0.08, 0.45, pattern);
    
    // Centroid-driven palette: low = warm magenta/amber, high = cool cyan/teal
    float baseHue = fract(uSpectralCentroid * 0.5 + uTime * 0.015);
    float edgeHue = fract(baseHue + edge * 1.5 + 0.1);
    
    vec3 patternColor = hsl2rgb(baseHue, 0.6 + uRMS * 0.3, lum * (0.5 + uRMS * 0.3));
    vec3 edgeColor = hsl2rgb(edgeHue, 0.85, 0.55 + uOnsetIntensity * 0.2);
    
    vec3 color = mix(patternColor, edgeColor, edge * 0.7);
    
    // Beat/onset glow
    color += vec3(0.06, 0.03, 0.09) * uBeatIntensity;
    color += vec3(0.04, 0.06, 0.02) * uOnsetIntensity;
    
    // Background: energy trend brightens on buildups
    float trendBright = max(0.0, uEnergyTrend) * 0.03;
    vec3 bg = vec3(0.01 + trendBright, 0.01 + trendBright * 0.5, 0.02 + trendBright);
    color = mix(bg, color, smoothstep(0.05, 0.15, pattern));
    
    // Vignette
    vec2 center = vUv - 0.5;
    float vig = 1.0 - dot(center, center) * 0.6;
    color *= smoothstep(0.0, 1.0, vig);
    
    gl_FragColor = vec4(color, 1.0);
  }
`

interface DoubleFBO {
  read: THREE.WebGLRenderTarget
  write: THREE.WebGLRenderTarget
  swap: () => void
}

function createFBO(w: number, h: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false, stencilBuffer: false
  })
}

function createDoubleFBO(w: number, h: number): DoubleFBO {
  let read = createFBO(w, h); let write = createFBO(w, h)
  return {
    get read() { return read }, get write() { return write },
    swap() { const t = read; read = write; write = t }
  }
}

let stateFBO: DoubleFBO | null = null
let reactionMat: THREE.ShaderMaterial | null = null
let seedMat: THREE.ShaderMaterial | null = null
let displayMat: THREE.ShaderMaterial | null = null
let simScene: THREE.Scene | null = null
let simCamera: THREE.OrthographicCamera | null = null
let simQuad: THREE.Mesh | null = null
let displayQuad: THREE.Mesh | null = null
let lastSeedTime = 0
let initialized = false

function blit(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
  if (!simQuad || !simScene || !simCamera) return
  simQuad.material = material
  renderer.setRenderTarget(target)
  renderer.render(simScene, simCamera)
}

function initializeState(renderer: THREE.WebGLRenderer) {
  if (!stateFBO || !simQuad || !simScene || !simCamera) return
  const initMat = new THREE.ShaderMaterial({
    vertexShader: baseVert,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      void main() {
        float b = 0.0;
        vec2 c = vUv - 0.5;
        if (length(c) < 0.05) b = 1.0;
        float n = fract(sin(dot(floor(vUv * 30.0), vec2(12.9898, 78.233))) * 43758.5453);
        if (n > 0.97 && length(c) < 0.3) b = 1.0;
        gl_FragColor = vec4(1.0, b, 0.0, 1.0);
      }
    `,
    depthTest: false, depthWrite: false
  })
  blit(renderer, initMat, stateFBO.write)
  stateFBO.swap()
  blit(renderer, initMat, stateFBO.write)
  stateFBO.swap()
  initMat.dispose()
  initialized = true
}

export const reactionDiffusion: VisualizationMode = {
  id: 'reaction_diffusion',
  name: 'Reaction-Diffusion',
  description: 'Turing patterns that morph with the music',
  hideParticles: true,
  
  postProcessing: {
    bloomStrength: 0.6,
    bloomRadius: 0.3,
    afterimage: 0.80,
    rgbShift: 0.0005,
  },

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = -1000; positions[i * 3 + 2] = 0
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    simScene = new THREE.Scene()
    simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), undefined)
    simScene.add(simQuad)

    stateFBO = createDoubleFBO(SIM_RES, SIM_RES)
    const texel = new THREE.Vector2(1.0 / SIM_RES, 1.0 / SIM_RES)

    reactionMat = new THREE.ShaderMaterial({
      vertexShader: baseVert, fragmentShader: reactionShader,
      uniforms: {
        uState: { value: null }, uTexelSize: { value: texel },
        uFeed: { value: 0.037 }, uKill: { value: 0.06 },
        uDiffA: { value: 1.0 }, uDiffB: { value: 0.5 }, uDt: { value: 1.0 },
      },
      depthTest: false, depthWrite: false
    })

    seedMat = new THREE.ShaderMaterial({
      vertexShader: baseVert, fragmentShader: seedShader,
      uniforms: {
        uState: { value: null }, uPoint: { value: new THREE.Vector2() },
        uRadius: { value: 0.03 }, uAspectRatio: { value: 1.0 },
      },
      depthTest: false, depthWrite: false
    })

    const displayGeo = createFullscreenQuad()
    displayMat = new THREE.ShaderMaterial({
      vertexShader: baseVert, fragmentShader: displayShader,
      uniforms: {
        uState: { value: null }, uTime: { value: 0 },
        uSpectralCentroid: { value: 0.5 }, uBeatIntensity: { value: 0 },
        uEnergyTrend: { value: 0 }, uRMS: { value: 0 }, uOnsetIntensity: { value: 0 },
      },
      depthTest: false, depthWrite: false
    })
    
    displayQuad = new THREE.Mesh(displayGeo, displayMat)
    displayQuad.frustumCulled = false
    displayQuad.renderOrder = -1000
    scene.add(displayQuad)
    initialized = false
    lastSeedTime = 0

    return {
      objects: [displayQuad],
      update: (bands: AudioBands, time: number, renderer?: THREE.WebGLRenderer) => {
        if (!renderer || !stateFBO || !reactionMat || !seedMat || !displayMat) return
        if (!initialized) initializeState(renderer)

        const aspect = window.innerWidth / window.innerHeight
        
        // Feed rate: subBass + bass drive pattern density
        const baseFeed = 0.028 + bands.subBassSmooth * 0.012 + bands.bassSmooth * 0.015
        // Kill rate: mid sets pattern type, treble/brilliance fine-tune
        const baseKill = 0.052 + bands.midSmooth * 0.018 + bands.trebleSmooth * 0.005 + bands.brillianceSmooth * 0.003
        
        reactionMat.uniforms.uState.value = stateFBO.read.texture
        reactionMat.uniforms.uFeed.value = baseFeed
        reactionMat.uniforms.uKill.value = baseKill
        
        // Simulation speed: buildups (positive energyTrend) accelerate evolution
        const trendSpeed = Math.max(0, bands.energyTrend) * 6
        const stepsPerFrame = 8 + Math.floor(bands.overallSmooth * 8 + trendSpeed)
        for (let i = 0; i < stepsPerFrame; i++) {
          reactionMat.uniforms.uState.value = stateFBO.read.texture
          blit(renderer, reactionMat, stateFBO.write)
          stateFBO.swap()
        }

        // Onset → seed injection (new pattern nucleation)
        if (bands.isOnset && time - lastSeedTime > 0.4) {
          lastSeedTime = time
          seedMat.uniforms.uState.value = stateFBO.read.texture
          seedMat.uniforms.uPoint.value.set(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6)
          seedMat.uniforms.uRadius.value = 0.015 + bands.onsetIntensity * 0.05
          seedMat.uniforms.uAspectRatio.value = aspect
          blit(renderer, seedMat, stateFBO.write)
          stateFBO.swap()
        }

        displayMat.uniforms.uState.value = stateFBO.read.texture
        displayMat.uniforms.uTime.value = time
        displayMat.uniforms.uSpectralCentroid.value = bands.spectralCentroid
        displayMat.uniforms.uBeatIntensity.value = bands.beatIntensity
        displayMat.uniforms.uEnergyTrend.value = bands.energyTrend
        displayMat.uniforms.uRMS.value = bands.rms
        displayMat.uniforms.uOnsetIntensity.value = bands.onsetIntensity
        renderer.setRenderTarget(null)
      },
      dispose: () => {
        stateFBO?.read.dispose(); stateFBO?.write.dispose(); stateFBO = null
        reactionMat?.dispose(); seedMat?.dispose(); displayMat?.dispose()
        reactionMat = null; seedMat = null; displayMat = null
        if (simQuad) { simQuad.geometry.dispose(); simScene?.remove(simQuad) }
        simQuad = null; simScene = null; simCamera = null
        if (displayQuad) { displayQuad.geometry.dispose(); scene.remove(displayQuad) }
        displayQuad = null; initialized = false
      }
    }
  },

  animate(_p: Float32Array, _o: Float32Array, sizes: Float32Array, _c: Float32Array, count: number, _b: AudioBands, _t: number) {
    for (let i = 0; i < count; i++) sizes[i] = 0
  }
}
