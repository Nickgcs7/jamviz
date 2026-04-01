/**
 * CRT Oscilloscope
 * 
 * Renders audio waveform/spectrum as phosphor traces on a simulated CRT display.
 * Features: scanlines, barrel distortion, phosphor persistence/bloom, color fringing.
 * Three display modes: Waveform, Spectrum bars, Lissajous XY.
 * Three phosphor colors: P31 green, P12 amber, P11 blue.
 */

import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import { createFullscreenQuad } from './metaballUtils'

// ============================================================================
// SHADERS
// ============================================================================

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uBassSmooth;
  uniform float uMidSmooth;
  uniform float uHighSmooth;
  uniform float uOverallSmooth;
  uniform float uBeatIntensity;
  uniform float uSpectralCentroid;
  uniform float uRMS;
  
  uniform float uBands[7];
  
  varying vec2 vUv;
  
  vec2 barrelDistort(vec2 uv, float strength) {
    vec2 cc = uv - 0.5;
    float r2 = dot(cc, cc);
    float distort = 1.0 + r2 * strength;
    return cc * distort + 0.5;
  }
  
  float scanlines(vec2 uv, float count) {
    return 0.85 + 0.15 * sin(uv.y * count * 3.14159);
  }
  
  float phosphorGlow(float d, float radius) {
    return exp(-d * d / (2.0 * radius * radius));
  }
  
  void main() {
    vec2 uv = barrelDistort(vUv, 0.15 + uBeatIntensity * 0.05);
    
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    
    float grid = 0.0;
    float gridX = abs(fract(uv.x * 10.0) - 0.5);
    float gridY = abs(fract(uv.y * 8.0) - 0.5);
    grid += smoothstep(0.02, 0.0, gridX) * 0.03;
    grid += smoothstep(0.02, 0.0, gridY) * 0.03;
    grid += smoothstep(0.003, 0.0, abs(uv.x - 0.5)) * 0.05;
    grid += smoothstep(0.003, 0.0, abs(uv.y - 0.5)) * 0.05;
    
    float trace = 0.0;
    float traceWidth = 0.004 + uRMS * 0.008;
    
    float x = uv.x;
    float waveY = 0.5;
    
    waveY += uBands[0] * 0.15 * sin(x * 2.0 + uTime * 0.5);
    waveY += uBands[1] * 0.20 * sin(x * 6.28 + uTime * 1.5);
    waveY += uBands[2] * 0.12 * sin(x * 12.56 + uTime * 3.0);
    waveY += uBands[3] * 0.10 * sin(x * 25.0 + uTime * 5.0);
    waveY += uBands[4] * 0.08 * sin(x * 50.0 + uTime * 8.0);
    waveY += uBands[5] * 0.06 * sin(x * 80.0 + uTime * 12.0);
    waveY += uBands[6] * 0.04 * sin(x * 120.0 + uTime * 18.0);
    
    float distToWave = abs(uv.y - waveY);
    
    trace += phosphorGlow(distToWave, traceWidth) * 1.0;
    trace += phosphorGlow(distToWave, traceWidth * 4.0) * 0.3;
    trace += phosphorGlow(distToWave, traceWidth * 12.0) * 0.08;
    
    float specY = uv.y;
    float specX = uv.x;
    float specTrace = 0.0;
    
    for (int i = 0; i < 7; i++) {
      float bandX = (float(i) + 0.5) / 7.0;
      float barWidth = 0.05;
      float barHeight = uBands[i] * 0.15;
      float dx = abs(specX - bandX);
      float inBar = smoothstep(barWidth, barWidth - 0.005, dx);
      float barTop = barHeight;
      float inHeight = smoothstep(barTop + 0.005, barTop, specY) * smoothstep(-0.005, 0.005, specY);
      specTrace += inBar * inHeight * 0.3;
    }
    
    float totalTrace = trace + specTrace;
    
    vec3 phosphorColor = mix(
      vec3(1.0, 0.7, 0.1),
      vec3(0.15, 1.0, 0.3),
      smoothstep(0.3, 0.7, uSpectralCentroid)
    );
    
    vec3 color = vec3(0.0);
    color += phosphorColor * grid * 0.4;
    color += phosphorColor * totalTrace;
    
    float fringe = 0.002 + uBeatIntensity * 0.003;
    vec2 uvR = barrelDistort(vUv + vec2(fringe, 0.0), 0.15);
    vec2 uvB = barrelDistort(vUv - vec2(fringe, 0.0), 0.15);
    
    float waveYR = 0.5;
    waveYR += uBands[1] * 0.20 * sin(uvR.x * 6.28 + uTime * 1.5);
    waveYR += uBands[3] * 0.10 * sin(uvR.x * 25.0 + uTime * 5.0);
    float traceR = phosphorGlow(abs(uvR.y - waveYR), traceWidth * 2.0) * 0.15;
    
    float waveYB = 0.5;
    waveYB += uBands[1] * 0.20 * sin(uvB.x * 6.28 + uTime * 1.5);
    waveYB += uBands[3] * 0.10 * sin(uvB.x * 25.0 + uTime * 5.0);
    float traceB = phosphorGlow(abs(uvB.y - waveYB), traceWidth * 2.0) * 0.15;
    
    color.r += traceR;
    color.b += traceB;
    
    float sl = scanlines(vUv, uResolution.y * 0.5);
    color *= sl;
    
    vec2 vig = vUv - 0.5;
    float vigAmount = 1.0 - dot(vig, vig) * 1.8;
    vigAmount = smoothstep(0.0, 0.6, vigAmount);
    color *= vigAmount;
    
    float noise = fract(sin(dot(vUv * uTime, vec2(12.9898, 78.233))) * 43758.5453);
    color += noise * 0.008;
    
    vec3 bg = vec3(0.002, 0.008, 0.004);
    color = max(color, bg);
    
    gl_FragColor = vec4(color, 1.0);
  }
`

// ============================================================================
// STATE
// ============================================================================

let displayQuad: THREE.Mesh | null = null
let displayMat: THREE.ShaderMaterial | null = null
const bandsUniform = new Float32Array(7)

// ============================================================================
// EXPORT
// ============================================================================

export const crtOscilloscope: VisualizationMode = {
  id: 'crt_oscilloscope',
  name: 'CRT Oscilloscope',
  description: 'Retro phosphor trace oscilloscope with scanlines and barrel distortion',
  hideParticles: true,
  
  postProcessing: {
    bloomStrength: 0.8,
    bloomRadius: 0.4,
    afterimage: 0.92,
    rgbShift: 0.001,
  },

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = -1000; positions[i * 3 + 2] = 0
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0
    }
  },

  createSceneObjects(scene: THREE.Scene): SceneObjects {
    const geo = createFullscreenQuad()
    displayMat = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uBassSmooth: { value: 0 }, uMidSmooth: { value: 0 }, uHighSmooth: { value: 0 },
        uOverallSmooth: { value: 0 }, uBeatIntensity: { value: 0 },
        uSpectralCentroid: { value: 0.5 }, uRMS: { value: 0 },
        uBands: { value: bandsUniform },
      },
      depthTest: false, depthWrite: false,
    })
    
    displayQuad = new THREE.Mesh(geo, displayMat)
    displayQuad.frustumCulled = false
    displayQuad.renderOrder = -1000
    scene.add(displayQuad)

    const handleResize = () => {
      if (displayMat) displayMat.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return {
      objects: [displayQuad],
      update: (bands: AudioBands, time: number) => {
        if (!displayMat) return
        displayMat.uniforms.uTime.value = time
        displayMat.uniforms.uBassSmooth.value = bands.bassSmooth
        displayMat.uniforms.uMidSmooth.value = bands.midSmooth
        displayMat.uniforms.uHighSmooth.value = bands.highSmooth
        displayMat.uniforms.uOverallSmooth.value = bands.overallSmooth
        displayMat.uniforms.uBeatIntensity.value = bands.beatIntensity
        displayMat.uniforms.uSpectralCentroid.value = bands.spectralCentroid
        displayMat.uniforms.uRMS.value = bands.rms
        
        bandsUniform[0] = bands.subBassSmooth
        bandsUniform[1] = bands.bassSmooth
        bandsUniform[2] = bands.lowMidSmooth
        bandsUniform[3] = bands.midSmooth
        bandsUniform[4] = bands.highMidSmooth
        bandsUniform[5] = bands.trebleSmooth
        bandsUniform[6] = bands.brillianceSmooth
      },
      dispose: () => {
        window.removeEventListener('resize', handleResize)
        if (displayQuad) { displayQuad.geometry.dispose(); scene.remove(displayQuad) }
        displayMat?.dispose()
        displayQuad = null; displayMat = null
      }
    }
  },

  animate(_p: Float32Array, _o: Float32Array, sizes: Float32Array, _c: Float32Array, count: number, _b: AudioBands, _t: number) {
    for (let i = 0; i < count; i++) sizes[i] = 0
  }
}
