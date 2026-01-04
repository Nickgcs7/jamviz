/**
 * Enhanced Metaball rendering utilities for lava lamp and warp field visualizations
 * Uses shader-based rendering for smooth, organic blob boundaries
 * Supports dynamic blob counts and improved physics
 */

import * as THREE from 'three'
import { getCyclingHue } from '../colorUtils'

// Metaball vertex shader - simple fullscreen quad
export const metaballVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

// Enhanced Lava Lamp metaball fragment shader
// Tuned for more distinct, separate blobs that occasionally merge
export const lavaLampFragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uBlobPositions[12];
  uniform float uBlobSizes[12];
  uniform vec3 uBlobColors[12];
  uniform int uBlobCount;
  uniform float uBassSmooth;
  uniform float uBeatIntensity;
  uniform float uGravityDirection;
  
  varying vec2 vUv;
  
  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * 2.0 * aspect;
    uv *= 35.0;  // Increased scale for more separation
    
    float field = 0.0;
    vec3 colorMix = vec3(0.0);
    float totalWeight = 0.0;
    
    for (int i = 0; i < 12; i++) {
      if (i >= uBlobCount) break;
      
      vec2 blobPos = uBlobPositions[i].xy;
      float blobSize = uBlobSizes[i];
      
      vec2 diff = uv - blobPos;
      
      // Subtle vertical stretching based on velocity
      float velocity = uBlobPositions[i].z;
      float stretch = 1.0 + abs(velocity) * 0.2;
      diff.y /= stretch;
      
      float dist = length(diff);
      
      // Sharper falloff for more distinct blobs
      // Using smaller exponent and higher base distance
      float contribution = (blobSize * blobSize * 0.8) / (dist * dist + 1.5);
      field += contribution;
      
      // Color weighting - closer blobs have more influence
      float colorWeight = contribution * contribution;
      colorMix += uBlobColors[i] * colorWeight;
      totalWeight += colorWeight;
    }
    
    if (totalWeight > 0.0) {
      colorMix /= totalWeight;
    }
    
    // Higher threshold = blobs need to be closer to merge
    float threshold = 1.8;
    float edge = smoothstep(threshold - 0.4, threshold + 0.15, field);
    float innerGlow = smoothstep(threshold, threshold + 2.0, field);
    
    // Merge highlight - visible when blobs are close
    float mergeZone = smoothstep(threshold + 0.5, threshold + 1.8, field) - 
                      smoothstep(threshold + 1.8, threshold + 3.5, field);
    
    // Deep background gradient
    vec3 bgColor = mix(
      vec3(0.03, 0.01, 0.06),
      vec3(0.06, 0.02, 0.10),
      vUv.y + sin(uTime * 0.08) * 0.05
    );
    
    // Blob color with subtle glow
    vec3 blobColor = colorMix;
    blobColor += innerGlow * 0.25;
    blobColor += mergeZone * vec3(0.12, 0.1, 0.06);
    blobColor *= 0.9 + uBeatIntensity * 0.2;
    
    // Subtle edge highlight
    float edgeHighlight = smoothstep(threshold - 0.15, threshold, field) - 
                          smoothstep(threshold, threshold + 0.3, field);
    
    vec3 finalColor = mix(bgColor, blobColor, edge);
    finalColor += edgeHighlight * 0.08;
    
    // Soft vignette
    float vignette = 1.0 - length(vUv - 0.5) * 0.35;
    finalColor *= vignette;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// Enhanced Warp Field fragment shader with dynamic attractor count
export const warpFieldFragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uAttractorPositions[8];
  uniform float uAttractorStrengths[8];
  uniform vec3 uAttractorColors[8];
  uniform int uAttractorCount;
  uniform float uBassSmooth;
  uniform float uBeatIntensity;
  
  varying vec2 vUv;
  
  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * 2.0 * aspect;
    uv *= 35.0;
    
    vec2 totalDisplacement = vec2(0.0);
    float orbGlow = 0.0;
    vec3 orbColor = vec3(0.0);
    
    for (int i = 0; i < 8; i++) {
      if (i >= uAttractorCount) break;
      
      vec2 attractorPos = uAttractorPositions[i].xy;
      float strength = uAttractorStrengths[i];
      
      vec2 diff = uv - attractorPos;
      float dist = length(diff);
      
      // Gravitational lensing
      if (dist > 0.5) {
        float influence = strength / (dist * dist + 1.0);
        totalDisplacement += normalize(diff) * influence * 2.0;
      }
      
      // Visible orb glow
      float orbRadius = 1.8 + uBeatIntensity * 0.6;
      float glow = smoothstep(orbRadius + 1.2, orbRadius * 0.3, dist);
      orbGlow = max(orbGlow, glow);
      
      if (glow > 0.01) {
        orbColor = mix(orbColor, uAttractorColors[i], glow);
      }
    }
    
    vec2 warpedUv = uv - totalDisplacement;
    
    // Stripe pattern
    float stripeFreq = 0.7 + uBassSmooth * 0.25;
    float stripes = sin(warpedUv.y * stripeFreq + uTime * 0.25) * 0.5 + 0.5;
    stripes = smoothstep(0.25, 0.75, stripes);
    
    float gradientY = (warpedUv.y + 30.0) / 60.0;
    vec3 stripeColor1 = vec3(0.08, 0.04, 0.16);
    vec3 stripeColor2 = vec3(0.16, 0.08, 0.24);
    
    float dispMag = length(totalDisplacement);
    vec3 warpTint = vec3(0.25, 0.08, 0.35) * dispMag * 0.08;
    
    vec3 baseColor = mix(stripeColor1, stripeColor2, stripes);
    baseColor += warpTint;
    baseColor *= 0.7 + gradientY * 0.3;
    baseColor *= 0.9 + uBeatIntensity * 0.2;
    
    vec3 finalColor = mix(baseColor, orbColor, orbGlow * 0.9);
    finalColor += orbGlow * orbGlow * vec3(0.25);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// Helper to create fullscreen quad geometry
export function createFullscreenQuad(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  
  const vertices = new Float32Array([
    -1, -1, 0,
     3, -1, 0,
    -1,  3, 0
  ])
  
  const uvs = new Float32Array([
    0, 0,
    2, 0,
    0, 2
  ])
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  
  return geometry
}

// Lava lamp blob colors
export const LAVA_LAMP_COLORS = [
  new THREE.Color(0.2, 0.9, 0.3),
  new THREE.Color(0.95, 0.3, 0.5),
  new THREE.Color(0.95, 0.5, 0.1),
  new THREE.Color(0.2, 0.8, 0.9),
  new THREE.Color(0.7, 0.3, 0.9),
  new THREE.Color(0.9, 0.8, 0.2),
  new THREE.Color(0.3, 0.5, 0.9),
  new THREE.Color(0.9, 0.4, 0.7)
]

// Interface for blob state
export interface MetaBlob {
  x: number
  y: number
  velocity: number
  phase: number
  baseSize: number
  colorIndex: number
  colorPhase: number
}

// Interface for attractor state  
export interface WarpAttractor {
  x: number
  y: number
  strength: number
  targetStrength: number
  phase: number
  hue: number
  orbitRadius: number
  orbitSpeed: number
}

// Initialize lava lamp blobs
export function initLavaLampBlobs(count: number = 5): MetaBlob[] {
  const blobs: MetaBlob[] = []
  
  for (let i = 0; i < count; i++) {
    blobs.push({
      x: (Math.random() - 0.5) * 25,
      y: (Math.random() - 0.5) * 35,
      velocity: (Math.random() - 0.5) * 0.2,
      phase: Math.random() * Math.PI * 2,
      baseSize: 5 + Math.random() * 3,
      colorIndex: i % LAVA_LAMP_COLORS.length,
      colorPhase: i * 0.7
    })
  }
  
  return blobs
}

// Initialize warp field attractors
export function initWarpAttractors(count: number = 5): WarpAttractor[] {
  const attractors: WarpAttractor[] = []
  
  for (let i = 0; i < count; i++) {
    attractors.push({
      x: (Math.random() - 0.5) * 45,
      y: (Math.random() - 0.5) * 30,
      strength: 5,
      targetStrength: 5,
      phase: Math.random() * Math.PI * 2,
      hue: i / count,
      orbitRadius: 12 + Math.random() * 10,
      orbitSpeed: 0.2 + Math.random() * 0.3
    })
  }
  
  return attractors
}

// Get cycling color for blob
export function getBlobColor(blob: MetaBlob, time: number): THREE.Color {
  const baseColor = LAVA_LAMP_COLORS[blob.colorIndex % LAVA_LAMP_COLORS.length]
  const cycleHue = getCyclingHue(time + blob.colorPhase)
  
  const hsl = { h: 0, s: 0, l: 0 }
  baseColor.getHSL(hsl)
  
  const newHue = (hsl.h + cycleHue * 0.4) % 1
  
  const color = new THREE.Color()
  color.setHSL(newHue, Math.min(1, hsl.s * 1.1), hsl.l)
  
  return color
}

// Get attractor color
export function getAttractorColor(attractor: WarpAttractor, time: number): THREE.Color {
  const cycleHue = getCyclingHue(time)
  const hue = (attractor.hue + cycleHue) % 1
  
  const color = new THREE.Color()
  color.setHSL(hue, 0.8, 0.6)
  
  return color
}
