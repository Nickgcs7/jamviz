/**
 * Strange Attractor — "Lorenz Dream"
 * 
 * Particles trace a Lorenz strange attractor in real-time.
 * Audio modulates the ODE parameters, morphing shape between order and chaos.
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
let beatPulse = 0
let lastBeatTime = 0

export const strangeAttractor: VisualizationMode = {
  id: 'strange_attractor',
  name: 'Attractor',
  description: 'Lorenz strange attractor — audio warps the mathematics of chaos',

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    trailBuffer = new Float32Array(count * 3)
    trailHead = 0
    odeState = { x: 0.1, y: 0.1, z: 0.1 }
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
    currentSigma = BASE_SIGMA; currentRho = BASE_RHO; currentBeta = BASE_BETA; currentSpeed = 1.0; beatPulse = 0
  },

  animate(positions: Float32Array, _orig: Float32Array, sizes: Float32Array, colors: Float32Array, count: number, bands: AudioBands, time: number) {
    if (!trailBuffer) return

    const targetSigma = BASE_SIGMA + bands.bassSmooth * 8 - bands.trebleSmooth * 3
    currentSigma += (targetSigma - currentSigma) * 0.08
    const targetRho = BASE_RHO + bands.midSmooth * 12 + bands.beatIntensity * 8
    currentRho += (targetRho - currentRho) * 0.06
    const targetBeta = BASE_BETA + bands.highMidSmooth * 1.5
    currentBeta += (targetBeta - currentBeta) * 0.08
    const targetSpeed = 0.5 + bands.overallSmooth * 3 + bands.beatIntensity * 2
    currentSpeed += (targetSpeed - currentSpeed) * 0.1

    if (bands.isBeat && bands.beatIntensity > 0.5 && time - lastBeatTime > 0.3) {
      beatPulse = bands.beatIntensity; lastBeatTime = time
    }
    beatPulse *= 0.92

    const params: LorenzParams = { sigma: currentSigma + beatPulse * 5, rho: currentRho + beatPulse * 10, beta: currentBeta }
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
    for (let i = 0; i < count; i++) {
      const bufferIdx = ((trailHead + i) % count) * 3
      const pidx = i * 3
      positions[pidx] = trailBuffer[bufferIdx]
      positions[pidx + 1] = trailBuffer[bufferIdx + 1]
      positions[pidx + 2] = trailBuffer[bufferIdx + 2]

      const age = i / count
      const headSize = 2.5 + bands.overallSmooth * 2 + bands.beatIntensity * 3
      sizes[i] = 0.3 + age * age * headSize

      const z = trailBuffer[bufferIdx + 2] - CENTER_Z
      const zNorm = Math.max(0, Math.min(1, (z / SCALE + 5) / 50))
      const hue = (0.6 - zNorm * 0.55 + cycleHue * 0.3) % 1
      const sat = 0.5 + zNorm * 0.3 + bands.beatIntensity * 0.2
      const lit = 0.3 + age * 0.45 + bands.beatIntensity * 0.15
      const [r, g, b] = hslToRgb(hue, sat, lit)
      const alphaMult = age * age * age
      colors[pidx] = r * alphaMult
      colors[pidx + 1] = g * alphaMult
      colors[pidx + 2] = b * alphaMult
    }
  }
}
