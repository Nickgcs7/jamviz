/**
 * Flow Field Painter — "Invisible Wind"
 * 
 * Particles trace paths through a curl noise vector field,
 * leaving luminous trails via the afterimage post-processing pass.
 * Audio warps the noise field parameters.
 * 
 * Audio mapping:
 *   - subBass/bass → noise amplitude & field scale (breathing)
 *   - mid → noise evolution speed
 *   - highMid/treble → turbulence octaves
 *   - spectralCentroid → warm/cool color palette (bass paints warm, treble paints cool)
 *   - energyTrend → turbulence level (buildups = chaotic, drops = smooth laminar flow)
 *   - isOnset → color splash injection + field shift
 *   - rms → overall trail brightness & particle size
 *   - stereoBalance → wind bias
 */

import type { VisualizationMode } from './types'
import type { AudioBands } from '../AudioAnalyzer'
import { hslToRgb, getCyclingHue } from '../colorUtils'

const FIELD_SCALE = 0.008
const FLOW_SPEED = 0.4
const NOISE_EVOLUTION = 0.15
const RESPAWN_RATE = 0.002
const PARTICLE_SPREAD = 55
const TRAIL_BRIGHTNESS = 0.85

// Compact 3D simplex noise
const perm = new Uint8Array(512)
const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]]

function initNoise(seed: number) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = seed
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647
    const j = s % (i + 1); const tmp = p[i]; p[i] = p[j]; p[j] = tmp
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
}

function dot3(g: number[], x: number, y: number, z: number): number { return g[0]*x + g[1]*y + g[2]*z }

function noise3d(x: number, y: number, z: number): number {
  const F3 = 1/3, G3 = 1/6
  const s = (x+y+z)*F3, i = Math.floor(x+s), j = Math.floor(y+s), k = Math.floor(z+s)
  const t = (i+j+k)*G3, x0 = x-(i-t), y0 = y-(j-t), z0 = z-(k-t)
  let i1:number,j1:number,k1:number,i2:number,j2:number,k2:number
  if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1}}else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0}}
  const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3,x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3,x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3
  const ii=i&255,jj=j&255,kk=k&255
  const gi0=perm[ii+perm[jj+perm[kk]]]%12,gi1=perm[ii+i1+perm[jj+j1+perm[kk+k1]]]%12,gi2=perm[ii+i2+perm[jj+j2+perm[kk+k2]]]%12,gi3=perm[ii+1+perm[jj+1+perm[kk+1]]]%12
  let n0=0,n1=0,n2=0,n3=0
  let t0=0.6-x0*x0-y0*y0-z0*z0; if(t0>0){t0*=t0;n0=t0*t0*dot3(grad3[gi0],x0,y0,z0)}
  let t1=0.6-x1*x1-y1*y1-z1*z1; if(t1>0){t1*=t1;n1=t1*t1*dot3(grad3[gi1],x1,y1,z1)}
  let t2=0.6-x2*x2-y2*y2-z2*z2; if(t2>0){t2*=t2;n2=t2*t2*dot3(grad3[gi2],x2,y2,z2)}
  let t3=0.6-x3*x3-y3*y3-z3*z3; if(t3>0){t3*=t3;n3=t3*t3*dot3(grad3[gi3],x3,y3,z3)}
  return 32*(n0+n1+n2+n3)
}

function curlNoise(x: number, y: number, z: number): {dx:number,dy:number} {
  const eps = 0.01
  const dndx = (noise3d(x+eps,y,z)-noise3d(x-eps,y,z))/(2*eps)
  const dndy = (noise3d(x,y+eps,z)-noise3d(x,y-eps,z))/(2*eps)
  return { dx: dndy, dy: -dndx }
}

function fbmCurl(x: number, y: number, z: number, octaves: number): {dx:number,dy:number} {
  let tdx=0,tdy=0,amp=1,freq=1,total=0
  for(let i=0;i<octaves;i++){
    const c = curlNoise(x*freq,y*freq,z)
    tdx+=c.dx*amp; tdy+=c.dy*amp; total+=amp; amp*=0.5; freq*=2
  }
  return { dx: tdx/total, dy: tdy/total }
}

let noiseTime = 0
let currentNoiseScale = FIELD_SCALE
let currentFlowSpeed = FLOW_SPEED
let currentTurbulence = 2
let onsetFieldShift = 0
let lastOnsetTime = 0
let initialized = false
let particleAge: Float32Array | null = null
let particleHue: Float32Array | null = null
let smoothedCentroid = 0.5
let smoothedRMS = 0
let smoothedTrend = 0
let onsetSplash = 0

export const flowFieldPainter: VisualizationMode = {
  id: 'flow_field',
  name: 'Flow Field',
  description: 'Particles paint through invisible force fields driven by sound',

  postProcessing: {
    bloomStrength: 0.4,
    bloomRadius: 0.3,
    afterimage: 0.93,
    rgbShift: 0.0004,
  },

  initParticles(positions: Float32Array, colors: Float32Array, count: number) {
    initNoise(42)
    particleAge = new Float32Array(count)
    particleHue = new Float32Array(count)
    noiseTime = 0; currentNoiseScale = FIELD_SCALE; currentFlowSpeed = FLOW_SPEED
    currentTurbulence = 2; onsetFieldShift = 0; initialized = true
    smoothedCentroid = 0.5; smoothedRMS = 0; smoothedTrend = 0; onsetSplash = 0
    for (let i = 0; i < count; i++) {
      positions[i*3] = (Math.random()-0.5)*PARTICLE_SPREAD*2
      positions[i*3+1] = (Math.random()-0.5)*PARTICLE_SPREAD*2
      positions[i*3+2] = (Math.random()-0.5)*2
      particleAge[i] = Math.random()*500
      particleHue[i] = Math.random()
      colors[i*3]=0; colors[i*3+1]=0; colors[i*3+2]=0
    }
  },

  animate(positions: Float32Array, _orig: Float32Array, sizes: Float32Array, colors: Float32Array, count: number, bands: AudioBands, time: number) {
    if (!initialized || !particleAge || !particleHue) return

    // Smooth high-level features
    smoothedCentroid += (bands.spectralCentroid - smoothedCentroid) * 0.05
    smoothedRMS += (bands.rms - smoothedRMS) * 0.08
    smoothedTrend += (bands.energyTrend - smoothedTrend) * 0.04

    // Noise field scale breathes with sub-bass
    const targetScale = FIELD_SCALE * (0.5 + bands.subBassSmooth * 1.5 + bands.bassSmooth * 1.5)
    currentNoiseScale += (targetScale - currentNoiseScale) * 0.05

    // Flow speed driven by overall energy + onset punch
    const targetSpeed = FLOW_SPEED * (0.3 + bands.overallSmooth * 4 + bands.onsetIntensity * 3)
    currentFlowSpeed += (targetSpeed - currentFlowSpeed) * 0.08

    // Turbulence octaves: energyTrend drives chaos (buildups → more octaves)
    const trendTurb = Math.max(0, smoothedTrend) * 2
    const targetTurb = 2 + Math.round(bands.highMidSmooth * 2 + bands.trebleSmooth * 1 + trendTurb)
    currentTurbulence += (targetTurb - currentTurbulence) * 0.1

    // Noise evolution speed from mid frequencies
    const evoSpeed = NOISE_EVOLUTION * (0.5 + bands.midSmooth * 3 + bands.lowMidSmooth * 1.5)
    noiseTime += 0.016 * evoSpeed

    // Onset → field disruption + color splash
    if (bands.isOnset && time - lastOnsetTime > 0.2) {
      onsetFieldShift += bands.onsetIntensity * 2.5
      onsetSplash = bands.onsetIntensity
      lastOnsetTime = time
    }
    onsetFieldShift *= 0.94
    onsetSplash *= 0.90

    const windBias = bands.stereoBalance * 15 * bands.overallSmooth
    const cycleHue = getCyclingHue(time)
    const respawnThisFrame = Math.ceil(count * RESPAWN_RATE * (0.5 + bands.overallSmooth))

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const px = positions[idx], py = positions[idx+1]
      particleAge[i]++

      const outOfBounds = Math.abs(px) > PARTICLE_SPREAD || Math.abs(py) > PARTICLE_SPREAD
      const tooOld = particleAge[i] > 300 + Math.random() * 400

      if (outOfBounds || (tooOld && i < respawnThisFrame * 150)) {
        // On onset, cluster some respawns near center for "splash" effect
        if (onsetSplash > 0.3 && Math.random() < onsetSplash * 0.5) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * 15
          positions[idx] = Math.cos(angle) * dist
          positions[idx+1] = Math.sin(angle) * dist
        } else if (bands.overallSmooth > 0.3 && Math.random() < 0.3) {
          positions[idx] = (Math.random()-0.5)*20
          positions[idx+1] = (Math.random()-0.5)*20
        } else {
          const edge = Math.floor(Math.random()*4)
          if(edge===0){positions[idx]=-PARTICLE_SPREAD;positions[idx+1]=(Math.random()-0.5)*PARTICLE_SPREAD*2}
          else if(edge===1){positions[idx]=PARTICLE_SPREAD;positions[idx+1]=(Math.random()-0.5)*PARTICLE_SPREAD*2}
          else if(edge===2){positions[idx]=(Math.random()-0.5)*PARTICLE_SPREAD*2;positions[idx+1]=-PARTICLE_SPREAD}
          else{positions[idx]=(Math.random()-0.5)*PARTICLE_SPREAD*2;positions[idx+1]=PARTICLE_SPREAD}
        }
        positions[idx+2] = (Math.random()-0.5)*1.5
        particleAge[i] = 0
        // New hue on splash: tinted by onset energy
        particleHue[i] = onsetSplash > 0.3 ? (smoothedCentroid + Math.random() * 0.2) % 1 : Math.random()
        continue
      }

      const flow = fbmCurl(px*currentNoiseScale, py*currentNoiseScale, noiseTime+onsetFieldShift, Math.round(currentTurbulence))
      positions[idx] += flow.dx * currentFlowSpeed + windBias * 0.016
      positions[idx+1] += flow.dy * currentFlowSpeed
      positions[idx+2] += (Math.random()-0.5)*0.02

      // Size: rms-driven base + age fade
      const ageNorm = Math.min(1, particleAge[i]/20)
      const fadeOut = particleAge[i] > 500 ? Math.max(0, 1-(particleAge[i]-500)/100) : 1
      sizes[i] = (0.8 + smoothedRMS * 2.0 + onsetSplash * 1.5) * ageNorm * fadeOut

      // Color: spectralCentroid drives warm/cool palette
      // Low centroid (bassy) → warm hues (red/amber 0.0-0.15)
      // High centroid (bright) → cool hues (cyan/blue 0.5-0.7)
      const centroidHue = smoothedCentroid * 0.6
      const posHue = (px+PARTICLE_SPREAD)/(PARTICLE_SPREAD*2)*0.15
      const hue = (centroidHue + particleHue[i]*0.25 + posHue + cycleHue*0.3) % 1
      const sat = 0.55 + smoothedRMS * 0.3 + onsetSplash * 0.15
      const lit = TRAIL_BRIGHTNESS * ageNorm * fadeOut * (0.4 + smoothedRMS * 0.4 + onsetSplash * 0.25)
      const [r,g,b] = hslToRgb(hue, Math.min(1, sat), Math.min(1, lit))
      colors[idx]=r; colors[idx+1]=g; colors[idx+2]=b
    }
  }
}
