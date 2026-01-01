// Enhanced vertex shader with depth output
export const particleVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  attribute float alpha;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;
  varying float vSize;
  
  void main() {
    vColor = customColor;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Normalize depth for fog calculation (0 = near, 1 = far)
    vDepth = clamp(-mvPosition.z / 80.0, 0.0, 1.0);
    
    float computedSize = size * (300.0 / -mvPosition.z);
    vSize = computedSize;
    gl_PointSize = computedSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Enhanced fragment shader with depth fog and improved glow
export const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;
  varying float vSize;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Multi-layer glow effect
    float core = smoothstep(0.5, 0.0, dist);
    float innerGlow = smoothstep(0.5, 0.15, dist) * 0.8;
    float outerGlow = exp(-dist * 3.0) * 0.4;
    
    float alpha = (core + innerGlow + outerGlow) * vAlpha;
    
    // Depth fog - particles fade to dark blue/purple in distance
    vec3 fogColor = vec3(0.02, 0.01, 0.05);
    float fogFactor = smoothstep(0.0, 0.8, vDepth);
    vec3 finalColor = mix(vColor, fogColor, fogFactor * 0.6);
    
    // Boost brightness for close particles
    float proximityBoost = 1.0 + (1.0 - vDepth) * 0.3;
    finalColor *= proximityBoost;
    
    gl_FragColor = vec4(finalColor, alpha * (1.0 - fogFactor * 0.3));
  }
`

// Alternative shader with fresnel rim lighting
export const fresnelFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;
  varying float vSize;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Core with hot center
    float core = smoothstep(0.5, 0.0, dist);
    float hotCenter = exp(-dist * 8.0);
    
    // Fresnel-like rim glow
    float rim = smoothstep(0.3, 0.5, dist) * smoothstep(0.55, 0.45, dist);
    
    // Outer halo
    float halo = exp(-dist * 2.5) * 0.3;
    
    float alpha = (core + rim * 0.5 + halo) * vAlpha;
    
    // Color variation based on glow layer
    vec3 coreColor = vColor * (1.0 + hotCenter * 0.5);
    vec3 rimColor = vColor * vec3(1.2, 1.1, 1.3); // Slight purple shift on rim
    vec3 finalColor = mix(coreColor, rimColor, rim);
    
    // Depth fog
    vec3 fogColor = vec3(0.02, 0.01, 0.05);
    float fogFactor = smoothstep(0.0, 0.8, vDepth);
    finalColor = mix(finalColor, fogColor, fogFactor * 0.5);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`

// Legacy shader for reference
export const glowFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Core
    float core = smoothstep(0.5, 0.0, dist);
    
    // Glow
    float glow = exp(-dist * 4.0) * 0.5;
    
    float alpha = (core + glow) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`
