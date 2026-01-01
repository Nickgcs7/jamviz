/**
 * Metaball rendering utilities for lava lamp and warp field visualizations
 * Uses shader-based rendering for smooth, organic blob boundaries
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

// Lava Lamp metaball fragment shader
// Creates classic lava lamp effect with distinct colored blobs
export const lavaLampFragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uBlobPositions[5];
  uniform float uBlobSizes[5];
  uniform vec3 uBlobColors[5];
  uniform float uBassSmooth;
  uniform float uBeatIntensity;
  
  varying vec2 vUv;
  
  // Smooth minimum for organic blob merging
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }
  
  void main() {
    // Aspect-corrected coordinates centered at origin
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * 2.0 * aspect;
    
    // Scale to match scene units
    uv *= 30.0;
    
    // Calculate metaball field
    float field = 0.0;
    vec3 colorMix = vec3(0.0);
    float totalWeight = 0.0;
    
    for (int i = 0; i < 5; i++) {
      vec2 blobPos = uBlobPositions[i].xy;
      float blobSize = uBlobSizes[i];
      
      // Distance to blob center
      vec2 diff = uv - blobPos;
      
      // Vertical stretching based on blob velocity (stored in z)
      float velocity = uBlobPositions[i].z;
      float stretch = 1.0 + abs(velocity) * 0.3;
      diff.y /= stretch;
      
      float dist = length(diff);
      
      // Metaball contribution with smoother falloff
      float contribution = (blobSize * blobSize) / (dist * dist + 0.5);
      field += contribution;
      
      // Weight color by contribution
      float colorWeight = contribution * contribution;
      colorMix += uBlobColors[i] * colorWeight;
      totalWeight += colorWeight;
    }
    
    // Normalize color mix
    if (totalWeight > 0.0) {
      colorMix /= totalWeight;
    }
    
    // Threshold for blob boundary with soft edge
    float threshold = 1.0;
    float edge = smoothstep(threshold - 0.3, threshold + 0.1, field);
    
    // Inner glow effect
    float innerGlow = smoothstep(threshold, threshold + 2.0, field);
    
    // Background gradient (dark purple)
    vec3 bgColor = mix(
      vec3(0.05, 0.02, 0.1),
      vec3(0.1, 0.04, 0.15),
      vUv.y + sin(uTime * 0.1) * 0.1
    );
    
    // Blob color with brightness variation
    vec3 blobColor = colorMix;
    blobColor += innerGlow * 0.3; // Brighter center
    blobColor *= 0.8 + uBeatIntensity * 0.4; // Beat response
    
    // Final color with ambient occlusion at edges
    vec3 finalColor = mix(bgColor, blobColor, edge);
    
    // Add subtle edge highlight
    float edgeHighlight = smoothstep(threshold - 0.1, threshold, field) - 
                          smoothstep(threshold, threshold + 0.3, field);
    finalColor += edgeHighlight * 0.2;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// Warp Field fragment shader
// Creates horizontal stripes warped by gravitational attractors
export const warpFieldFragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uAttractorPositions[5];
  uniform float uAttractorStrengths[5];
  uniform vec3 uAttractorColors[5];
  uniform float uBassSmooth;
  uniform float uBeatIntensity;
  
  varying vec2 vUv;
  
  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * 2.0 * aspect;
    uv *= 35.0; // Scale to scene units
    
    // Calculate gravitational displacement
    vec2 totalDisplacement = vec2(0.0);
    float orbGlow = 0.0;
    vec3 orbColor = vec3(0.0);
    
    for (int i = 0; i < 5; i++) {
      vec2 attractorPos = uAttractorPositions[i].xy;
      float strength = uAttractorStrengths[i];
      
      vec2 diff = uv - attractorPos;
      float dist = length(diff);
      
      // Gravitational lensing displacement
      if (dist > 0.5) {
        float influence = strength / (dist * dist + 1.0);
        totalDisplacement += normalize(diff) * influence * 2.0;
      }
      
      // Visible orb glow
      float orbRadius = 1.5 + uBeatIntensity * 0.5;
      float glow = smoothstep(orbRadius + 1.0, orbRadius * 0.3, dist);
      orbGlow = max(orbGlow, glow);
      
      if (glow > 0.01) {
        orbColor = mix(orbColor, uAttractorColors[i], glow);
      }
    }
    
    // Apply displacement to get warped position
    vec2 warpedUv = uv - totalDisplacement;
    
    // Horizontal stripes pattern
    float stripeFreq = 0.8 + uBassSmooth * 0.2;
    float stripes = sin(warpedUv.y * stripeFreq + uTime * 0.3) * 0.5 + 0.5;
    stripes = smoothstep(0.3, 0.7, stripes);
    
    // Stripe color gradient based on warped y position
    float gradientY = (warpedUv.y + 30.0) / 60.0;
    vec3 stripeColor1 = vec3(0.1, 0.05, 0.2); // Dark purple
    vec3 stripeColor2 = vec3(0.2, 0.1, 0.3);  // Lighter purple
    
    // Add displacement-based color variation
    float dispMag = length(totalDisplacement);
    vec3 warpTint = vec3(0.3, 0.1, 0.4) * dispMag * 0.1;
    
    vec3 baseColor = mix(stripeColor1, stripeColor2, stripes);
    baseColor += warpTint;
    baseColor *= 0.7 + gradientY * 0.3;
    
    // Beat pulse on stripes
    baseColor *= 0.9 + uBeatIntensity * 0.2;
    
    // Composite orbs on top
    vec3 finalColor = mix(baseColor, orbColor, orbGlow * 0.9);
    
    // Add orb core brightness
    finalColor += orbGlow * orbGlow * vec3(0.3);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// Helper to create fullscreen quad geometry
export function createFullscreenQuad(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  
  // Fullscreen triangle (more efficient than quad)
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

// Lava lamp blob colors - distinct, saturated colors
export const LAVA_LAMP_COLORS = [
  new THREE.Color(0.2, 0.9, 0.3),   // Green
  new THREE.Color(0.95, 0.3, 0.5),  // Pink
  new THREE.Color(0.95, 0.5, 0.1),  // Orange
  new THREE.Color(0.2, 0.8, 0.9),   // Cyan
  new THREE.Color(0.7, 0.3, 0.9)    // Purple
]

// Interface for blob state
export interface MetaBlob {
  x: number
  y: number
  velocity: number  // Vertical velocity for stretching effect
  phase: number
  baseSize: number
  colorIndex: number
  colorPhase: number  // For independent color cycling
}

// Interface for attractor state  
export interface WarpAttractor {
  x: number
  y: number
  strength: number
  targetStrength: number
  phase: number
  hue: number
}

// Initialize lava lamp blobs
export function initLavaLampBlobs(count: number = 5): MetaBlob[] {
  const blobs: MetaBlob[] = []
  
  for (let i = 0; i < count; i++) {
    blobs.push({
      x: (Math.random() - 0.5) * 30,
      y: (Math.random() - 0.5) * 40,
      velocity: 0,
      phase: Math.random() * Math.PI * 2,
      baseSize: 6 + Math.random() * 3,
      colorIndex: i % LAVA_LAMP_COLORS.length,
      colorPhase: i * 0.7 // Offset color cycling per blob
    })
  }
  
  return blobs
}

// Initialize warp field attractors
export function initWarpAttractors(count: number = 5): WarpAttractor[] {
  const attractors: WarpAttractor[] = []
  
  for (let i = 0; i < count; i++) {
    attractors.push({
      x: (Math.random() - 0.5) * 50,
      y: (Math.random() - 0.5) * 35,
      strength: 5,
      targetStrength: 5,
      phase: Math.random() * Math.PI * 2,
      hue: i / count
    })
  }
  
  return attractors
}

// Get cycling color for blob based on time and its individual phase
export function getBlobColor(blob: MetaBlob, time: number): THREE.Color {
  const baseColor = LAVA_LAMP_COLORS[blob.colorIndex]
  const cycleHue = getCyclingHue(time + blob.colorPhase)
  
  // Convert base color to HSL, shift hue, convert back
  const hsl = { h: 0, s: 0, l: 0 }
  baseColor.getHSL(hsl)
  
  // Apply cycling with blob's individual phase
  const newHue = (hsl.h + cycleHue * 0.5) % 1
  
  const color = new THREE.Color()
  color.setHSL(newHue, Math.min(1, hsl.s * 1.1), hsl.l)
  
  return color
}

// Get attractor color based on hue and time
export function getAttractorColor(attractor: WarpAttractor, time: number): THREE.Color {
  const cycleHue = getCyclingHue(time)
  const hue = (attractor.hue + cycleHue) % 1
  
  const color = new THREE.Color()
  color.setHSL(hue, 0.8, 0.6)
  
  return color
}
