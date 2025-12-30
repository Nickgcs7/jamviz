# JamViz 🎵

Real-time music visualizer built with React, Three.js, and WebGL shaders.

## Features

- **Real-time audio analysis** via Web Audio API
- **Multiple visualization modes:**
  - Sphere Pulse - breathing particle sphere
  - Galaxy Spiral - three-arm spiral galaxy
  - Wave Field - audio-reactive terrain
  - Explosion - bass-driven particle bursts
- **Custom GLSL shaders** for smooth particle rendering
- **8,000+ particles** with additive blending

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Usage

1. Click "Start Mic" to enable audio input
2. Play music or make sounds
3. Switch between visualization modes
4. Watch particles react to bass, mids, and highs

## Tech Stack

- React 18 + TypeScript
- Vite
- Three.js + WebGL
- Web Audio API
- Tailwind CSS

## Roadmap

- [ ] Audio file upload support
- [ ] More visualization modes
- [ ] Post-processing effects (bloom, chromatic aberration)
- [ ] Beat detection
- [ ] Color theme presets
- [ ] Fullscreen mode
- [ ] Recording/export

## License

MIT