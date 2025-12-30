// Vertex shader for particle rendering
export const particleVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  attribute float alpha;
  
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vColor = customColor;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for soft glowing particles
export const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`

// Alternative shader with glow effect
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