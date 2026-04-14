/**
 * CRT Oscilloscope
 * 
 * Renders audio waveform/spectrum as phosphor traces on a simulated CRT display.
 * Features: scanlines, barrel distortion, phosphor persistence/bloom, color fringing.
 * 
 * Audio mapping:
 *   - 7-band spectrum → waveform shape (each band drives a harmonic)
 *   - spectralCentroid → phosphor color shift (amber→green→cyan)
 *   - rms → trace width & glow radius
 *   - isOnset/onsetIntensity → screen shake + intensity spike
 *   - energyTrend → background brightness ramp on buildups
 *   - beatIntensity → color fringing amount + barrel distortion
 */

import type { VisualizationMode, SceneObjects } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import * as THREE from 'three'
import { createFullscreenQuad } from './metaballUtils'

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
  uniform float uOnsetIntensity;
  uniform float uEnergyTrend;
  
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
    // Screen shake on onsets
    vec2 shake = vec2(
      sin(uTime * 73.0) * uOnsetIntensity * 0.006,
      cos(uTime * 91.0) * uOnsetIntensity * 0.004
    );
    vec2 uv = barrelDistort(vUv + shake, 0.15 + uBeatIntensity * 0.05);
    
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    
    // Grid overlay
    float grid = 0.0;
    float gridX = abs(fract(uv.x * 10.0) - 0.5);
    float gridY = abs(fract(uv.y * 8.0) - 0.5);
    grid += smoothstep(0.02, 0.0, gridX) * 0.03;
    grid += smoothstep(0.02, 0.0, gridY) * 0.03;
    grid += smoothstep(0.003, 0.0, abs(uv.x - 0.5)) * 0.05;
    grid += smoothstep(0.003, 0.0, abs(uv.y - 0.5)) * 0.05;
    
    // Waveform trace — RMS drives width, onset spikes intensity
    float traceWidth = 0.003 + uRMS * 0.010 + uOnsetIntensity * 0.004;
    float intensityBoost = 1.0 + uOnsetIntensity * 0.5;
    
    float x = uv.x;
    float waveY = 0.5;
    
    // Each frequency band drives a harmonic of the waveform
    waveY += uBands[0] * 0.15 * sin(x * 2.0 + uTime * 0.5);
    waveY += uBands[1] * 0.22 * sin(x * 6.28 + uTime * 1.5);
    waveY += uBands[2] * 0.14 * sin(x * 12.56 + uTime * 3.0);
    waveY += uBands[3] * 0.12 * sin(x * 25.0 + uTime * 5.0);
    waveY += uBands[4] * 0.09 * sin(x * 50.0 + uTime * 8.0);
    waveY += uBands[5] * 0.06 * sin(x * 80.0 + uTime * 12.0);
    waveY += uBands[6] * 0.04 * sin(x * 120.0 + uTime * 18.0);
    
    float distToWave = abs(uv.y - waveY);
    
    // Layered phosphor glow: sharp core + medium halo + wide bloom
    float trace = 0.0;
    trace += phosphorGlow(distToWave, traceWidth) * 1.0 * intensityBoost;
    trace += phosphorGlow(distToWave, traceWidth * 4.0) * 0.35;
    trace += phosphorGlow(distToWave, traceWidth * 14.0) * 0.08;
    
    // Spectrum bars at bottom
    float specTrace = 0.0;
    for (int i = 0; i < 7; i++) {
      float bandX = (float(i) + 0.5) / 7.0;
      float barWidth = 0.05;
      float barHeight = uBands[i] * 0.15;
      float dx = abs(uv.x - bandX);
      float inBar = smoothstep(barWidth, barWidth - 0.005, dx);
      float inHeight = smoothstep(barHeight + 0.005, barHeight, uv.y) * smoothstep(-0.005, 0.005, uv.y);
      specTrace += inBar * inHeight * 0.3;
    }
    
    float totalTrace = trace + specTrace;
    
    // Phosphor color: spectralCentroid shifts amber → green → cyan
    vec3 phosphorWarm = vec3(1.0, 0.65, 0.08);  // amber
    vec3 phosphorMid  = vec3(0.15, 1.0, 0.3);   // classic P31 green
    vec3 phosphorCool = vec3(0.1, 0.8, 1.0);     // cyan/blue
    vec3 phosphorColor;
    if (uSpectralCentroid < 0.5) {
      phosphorColor = mix(phosphorWarm, phosphorMid, uSpectralCentroid * 2.0);
    } else {
      phosphorColor = mix(phosphorMid, phosphorCool, (uSpectralCentroid - 0.5) * 2.0);
    }
    
    vec3 color = vec3(0.0);
    color += phosphorColor * grid * 0.4;
    color += phosphorColor * totalTrace;
    
    // Chromatic aberration / color fringing
    float fringe = 0.002 + uBeatIntensity * 0.004 + uOnsetIntensity * 0.002;
    vec2 uvR = barrelDistort(vUv + shake + vec2(fringe, 0.0), 0.15);
    vec2 uvB = barrelDistort(vUv + shake - vec2(fringe, 0.0), 0.15);
    
    float waveYR = 0.5;
    waveYR += uBands[1] * 0.22 * sin(uvR.x * 6.28 + uTime * 1.5);
    waveYR += uBands[3] * 0.12 * sin(uvR.x * 25.0 + uTime * 5.0);
    float traceR = phosphorGlow(abs(uvR.y - waveYR), traceWidth * 2.5) * 0.15;
    
    float waveYB = 0.5;
    waveYB += uBands[1] * 0.22 * sin(uvB.x * 6.28 + uTime * 1.5);
    waveYB += uBands[3] * 0.12 * sin(uvB.x * 25.0 + uTime * 5.0);
    float traceB = phosphorGlow(abs(uvB.y - waveYB), traceWidth * 2.5) * 0.15;
    
    color.r += traceR;
    color.b += traceB;
    
    // Scanlines
    float sl = scanlines(vUv, uResolution.y * 0.5);
    color *= sl;
    
    // Vignette
    vec2 vig = vUv - 0.5;
    float vigAmount = 1.0 - dot(vig, vig) * 1.8;
    vigAmount = smoothstep(0.0, 0.6, vigAmount);
    color *= vigAmount;
    
    // Film grain
    float noise = fract(sin(dot(vUv * uTime, vec2(12.9898, 78.233))) * 43758.5453);
    color += noise * 0.008;
    
    // Background: slightly brighter during buildups
    float trendBg = max(0.0, uEnergyTrend) * 0.015;
    vec3 bg = vec3(0.002 + trendBg, 0.008 + trendBg * 2.0, 0.004 + trendBg);
    color = max(color, bg);
    
    gl_FragColor = vec4(color, 1.0);
  }
`

let displayQuad: THREE.Mesh | null = null
let displayMat: THREE.ShaderMaterial | null = null
const bandsUniform = new Float32Array(7)
let smoothedOnset = 0

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
    smoothedOnset = 0
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
        uOnsetIntensity: { value: 0 }, uEnergyTrend: { value: 0 },
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
        
        // Smooth onset for screen shake decay
        if (bands.isOnset) smoothedOnset = Math.max(smoothedOnset, bands.onsetIntensity)
        smoothedOnset *= 0.85
        
        displayMat.uniforms.uTime.value = time
        displayMat.uniforms.uBassSmooth.value = bands.bassSmooth
        displayMat.uniforms.uMidSmooth.value = bands.midSmooth
        displayMat.uniforms.uHighSmooth.value = bands.highSmooth
        displayMat.uniforms.uOverallSmooth.value = bands.overallSmooth
        displayMat.uniforms.uBeatIntensity.value = bands.beatIntensity
        displayMat.uniforms.uSpectralCentroid.value = bands.spectralCentroid
        displayMat.uniforms.uRMS.value = bands.rms
        displayMat.uniforms.uOnsetIntensity.value = smoothedOnset
        displayMat.uniforms.uEnergyTrend.value = bands.energyTrend
        
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
