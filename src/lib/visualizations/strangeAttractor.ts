/**
 * Strange Attractor — "Lorenz Dream"
 * 
 * Particles trace a Lorenz strange attractor in real-time.
 * Audio modulates the ODE parameters, morphing shape between order and chaos.
 * 
 * Audio mapping:
 *   - subBass/bass → attractor scale & simulation speed
 *   - mid → rho parameter (wing spread)
 *   - highMid/treble → sigma perturbation (turbulence)
 *   - spectralCentroid → hue rotation (warm→cool timbral shifts)
 *   - energyTrend → chaos level (buildups increase rho toward bifurcation)
 *   - isOnset → particle burst + parameter kick
 *   - rms → overall brightness & trail intensity
 */

import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'

const SCALE = 0.55
const CENTER_Y = -2
const CENTER_Z = -13
const BASE_DT = 0.005
const STEPS_PER_FRAME = 12
const WARMUP_STEPS = 5000
const BASE_SIGMA = 10
const BASE_RHO = 28
const BASE_BETA = 8 / 3

interface Vec3 { x: number; y: number; z: number }
interface LorenzParams { sigma: number; rho: number; beta: number }

function lorenz(s: Vec3, p: LorenzParams): Vec3 {
  return { x: p.sigma * (s.y - s.x), y: s.x * (p.rho - s.z) - s.y, z: s.x * s.y - p.beta * s.z }
}

function rk4Step(state: Vec3, params: LorenzParams, dt: number): Vec3 {
  const k1 = lorenz(state, params)
  const k2 = lorenz({ x: state.x + k1.x * dt * 0.5, y: state.y + k1.y * dt * 0.5, z: state.z + k1.z * dt * 0.5 }, params)
  const k3 = lorenz({ x: state.x + k2.x * dt * 0.5, y: state.y + k2.y * dt * 0.5, z: state.z + k2.z * dt * 0.5 }, params)
  const k4 = lorenz({ x: state.x + k3.x * dt, y: state.y + k3.y * dt, z: state.z + k3.z * dt }, params)
  return {
    x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    z: state.z + (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z)
  }
}

let trailBuffer: Float32Array | null = null
let trailHead = 0
let odeState: Vec3 = { x: 0.1, y: 0.1, z: 0.1 }
let currentSigma = BASE_SIGMA
let currentRho = BASE_RHO
let currentBeta = BASE_BETA
let currentSpeed = 1.0
let onsetPulse = 0
let lastOnsetTime = 0
let smoothedCentroid = 0.5
let smoothedRMS = 0
let smoothedTrend = 0

export const strangeAttractor: VisualizationMode = {
  id: 'strange_attractor',
  name: 'Attractor',
  description: 'Lorenz strange attractor — audio warps the mathematics of chaos',

  postProcessing: {
    bloomStrength: 0.5,
    bloomRadius: 0.35,
    afterimage: 0.88,
    rgbShift: 0.0008,
  },

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    trailBuffer = new Float32Array(count * 3)
    trailHead = 0
    odeState = { x: 0.1, y: 0.1, z: 0.1 }
    smoothedCentroid = 0.5; smoothedRMS = 0; smoothedTrend = 0; onsetPulse = 0
    const warmupParams: LorenzParams = { sigma: BASE_SIGMA, rho: BASE_RHO, beta: BASE_BETA }
    for (let i = 0; i < WARMUP_STEPS; i++) odeState = rk4Step(odeState, warmupParams, BASE_DT)
    for (let i = 0; i < count; i++) {
      odeState = rk4Step(odeState, warmupParams, BASE_DT)
      const idx = i * 3
      trailBuffer[idx] = odeState.x * SCALE
      trailBuffer[idx + 1] = odeState.y * SCALE + CENTER_Y
      trailBuffer[idx + 2] = odeState.z * SCALE + CENTER_Z
      positions[idx] = trailBuffer[idx]
      positions[idx + 1] = trailBuffer[idx + 1]
      positions[idx + 2] = trailBuffer[idx + 2]
      const t = i / count
      colors[idx] = 0.6 + t * 0.4
      colors[idx + 1] = 0.7 + t * 0.3
      colors[idx + 2] = 0.9
    }
    currentSigma = BASE_SIGMA; currentRho = BASE_RHO; currentBeta = BASE_BETA; currentSpeed = 1.0
  },

  animate(positions: Float32Array, _orig: Float32Array, sizes: Float32Array, colors: Float32Array, count: number, bands: AudioBands, time: number) {
    if (!trailBuffer) return

    // Smooth high-level features
    smoothedCentroid += (bands.spectralCentroid - smoothedCentroid) * 0.06
    smoothedRMS += (bands.rms - smoothedRMS) * 0.08
    smoothedTrend += (bands.energyTrend - smoothedTrend) * 0.04

    // ODE parameter mapping — bass/sub drives speed, mid drives shape, treble adds chaos
    const targetSigma = BASE_SIGMA + bands.bassSmooth * 8 - bands.trebleSmooth * 3 + bands.brillianceSmooth * 2
    currentSigma += (targetSigma - currentSigma) * 0.08

    // Rho controls wing spread — buildups (positive energyTrend) push toward chaotic regime
    const trendRhoBoost = Math.max(0, smoothedTrend) * 15
    const targetRho = BASE_RHO + bands.midSmooth * 12 + bands.onsetIntensity * 10 + trendRhoBoost
    currentRho += (targetRho - currentRho) * 0.06

    const targetBeta = BASE_BETA + bands.highMidSmooth * 1.5 + bands.lowMidSmooth * 0.5
    currentBeta += (targetBeta - currentBeta) * 0.08

    // Speed driven by sub-bass weight + overall energy
    const targetSpeed = 0.5 + bands.subBassSmooth * 2 + bands.overallSmooth * 2 + bands.onsetIntensity * 2.5
    currentSpeed += (targetSpeed - currentSpeed) * 0.1

    // Onset pulse — sharper than beat, better for transients
    if (bands.isOnset && time - lastOnsetTime > 0.2) {
      onsetPulse = Math.max(onsetPulse, bands.onsetIntensity)
      lastOnsetTime = time
    }
    onsetPulse *= 0.88

    const params: LorenzParams = {
      sigma: currentSigma + onsetPulse * 6,
      rho: currentRho + onsetPulse * 12,
      beta: currentBeta
    }
    const stepsThisFrame = Math.max(1, Math.round(STEPS_PER_FRAME * currentSpeed))

    for (let step = 0; step < stepsThisFrame; step++) {
      odeState = rk4Step(odeState, params, BASE_DT)
      if (Math.abs(odeState.x) > 200 || Math.abs(odeState.y) > 200 || Math.abs(odeState.z) > 200) {
        odeState = { x: 0.1 + Math.random() * 0.01, y: 0.1, z: 0.1 }
        for (let w = 0; w < 200; w++) odeState = rk4Step(odeState, params, BASE_DT)
      }
      const headIdx = trailHead * 3
      trailBuffer[headIdx] = odeState.x * SCALE
      trailBuffer[headIdx + 1] = odeState.y * SCALE + CENTER_Y
      trailBuffer[headIdx + 2] = odeState.z * SCALE + CENTER_Z
      trailHead = (trailHead + 1) % count
    }

    const cycleHue = getCyclingHue(time)
    // Centroid drives base hue — low centroid = warm (red/orange), high = cool (blue/cyan)
    const centroidHue = smoothedCentroid * 0.6
    // RMS drives overall brightness
    const rmsLit = 0.15 + smoothedRMS * 0.5

    for (let i = 0; i < count; i++) {
      const bufferIdx = ((trailHead + i) % count) * 3
      const pidx = i * 3
      positions[pidx] = trailBuffer[bufferIdx]
      positions[pidx + 1] = trailBuffer[bufferIdx + 1]
      positions[pidx + 2] = trailBuffer[bufferIdx + 2]

      const age = i / count // 0 = oldest, 1 = newest

      // Size: newest particles are biggest, onset pulse inflates head
      const headSize = 2.0 + smoothedRMS * 2.5 + onsetPulse * 4
      sizes[i] = 0.2 + age * age * headSize

      // Color: z-position maps depth, centroid shifts palette, age fades tail
      const z = trailBuffer[bufferIdx + 2] - CENTER_Z
      const zNorm = Math.max(0, Math.min(1, (z / SCALE + 5) / 50))

      // Hue: depth gradient + centroid timbral shift + slow cycle
      const hue = (centroidHue + zNorm * 0.35 + cycleHue * 0.2 + onsetPulse * 0.08) % 1
      const sat = 0.55 + zNorm * 0.3 + onsetPulse * 0.15 + smoothedRMS * 0.1
      const lit = rmsLit + age * 0.4 + onsetPulse * 0.2

      const [r, g, b] = hslToRgb(hue, Math.min(1, sat), Math.min(1, lit))
      // Cubic alpha fade on tail — newest particles fully visible, old ones ghostly
      const alphaMult = age * age * age
      colors[pidx] = r * alphaMult
      colors[pidx + 1] = g * alphaMult
      colors[pidx + 2] = b * alphaMult
    }
  }
}
