# JamViz 🎵

Real-time audio visualizer with WebGL shaders, particle systems, and bloom post-processing.

![JamViz](https://img.shields.io/badge/WebGL-Three.js-purple)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Real-time audio analysis** via Web Audio API (microphone or audio file)
- **10,000+ particles** with custom GLSL shaders
- **Bloom post-processing** for that glowing aesthetic
- **4 visualization modes:**
  - **Nebula** — breathing particle sphere
  - **Vortex** — spiraling energy formation
  - **Terrain** — audio-reactive wave field
  - **Supernova** — bass-driven particle burst
- **Keyboard shortcuts** for immersive experience
- **Drag & drop** audio file support

## Getting Started

```bash
# Clone
git clone https://github.com/nickgcs7/jamviz.git
cd jamviz

# Install
npm install

# Run
npm run dev
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `H` | Toggle UI visibility |
| `1-4` | Switch visualization modes |
| `Space` | Play/pause (file mode) |

## Deploy to Cloudflare Pages

1. Connect your GitHub repo
2. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Deploy!

## Tech Stack

- React 18 + TypeScript
- Vite
- Three.js + WebGL
- GLSL Shaders
- Post-processing (UnrealBloomPass)
- Web Audio API
- Tailwind CSS

## Roadmap

- [ ] More visualization modes
- [ ] Custom color themes
- [ ] Audio waveform timeline
- [ ] Spotify/SoundCloud integration
- [ ] Video export
- [ ] VR/XR support

## License

MIT
