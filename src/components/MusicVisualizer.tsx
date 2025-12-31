import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { AudioAnalyzer, type AudioBands } from '@/lib/AudioAnalyzer'
import { particleVertexShader, particleFragmentShader } from '@/lib/shaders'
import { visualizations, type VisualizationMode } from '@/lib/visualizations'

const PARTICLE_COUNT = 10000
const POSITION_LERP_FACTOR = 0.45
const SIZE_LERP_FACTOR = 0.55
const CAMERA_LERP_FACTOR = 0.08
const ROTATION_LERP_FACTOR = 0.15

interface SceneRefs {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  composer: EffectComposer
  particles: THREE.Points
  originalPositions: Float32Array
  targetPositions: Float32Array
  targetSizes: Float32Array
  currentCameraX: number
  currentCameraY: number
  currentRotationSpeed: number
  afterimagePass: AfterimagePass
  rgbShiftPass: ShaderPass
  bloomPass: UnrealBloomPass
}

interface MusicVisualizerProps {
  onBack: () => void
}

function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor
}

export default function MusicVisualizer({ onBack }: MusicVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [currentMode, setCurrentMode] = useState<VisualizationMode>(visualizations[0])
  const [showUI, setShowUI] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const analyzerRef = useRef<AudioAnalyzer | null>(null)
  const sceneRef = useRef<SceneRefs | null>(null)
  const animationRef = useRef<number>(0)

  const initScene = useCallback(() => {
    if (!containerRef.current || sceneRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x010103)

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 50

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.75
    containerRef.current.appendChild(renderer.domElement)

    // Post-processing
    const composer = new EffectComposer(renderer)
    
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const afterimagePass = new AfterimagePass(0.55)
    composer.addPass(afterimagePass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.5,
      0.3,
      0.5
    )
    composer.addPass(bloomPass)

    const rgbShiftPass = new ShaderPass(RGBShiftShader)
    rgbShiftPass.uniforms['amount'].value = 0.001
    rgbShiftPass.uniforms['angle'].value = 0.0
    composer.addPass(rgbShiftPass)

    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    // Particle geometry
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const alphas = new Float32Array(PARTICLE_COUNT)

    currentMode.initParticles(positions, colors, PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 1 + Math.random() * 2
      alphas[i] = 0.5 + Math.random() * 0.4
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

    const material = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    const particles = new THREE.Points(geometry, material)
    scene.add(particles)

    sceneRef.current = {
      scene,
      camera,
      renderer,
      composer,
      particles,
      originalPositions: positions.slice(),
      targetPositions: positions.slice(),
      targetSizes: sizes.slice(),
      currentCameraX: 0,
      currentCameraY: 0,
      currentRotationSpeed: 0.001,
      afterimagePass,
      rgbShiftPass,
      bloomPass
    }
  }, [currentMode])

  const updateParticleLayout = useCallback((mode: VisualizationMode) => {
    if (!sceneRef.current) return

    const { particles, originalPositions, targetPositions, targetSizes } = sceneRef.current
    const positions = particles.geometry.attributes.position.array as Float32Array
    const colors = particles.geometry.attributes.customColor.array as Float32Array
    const sizes = particles.geometry.attributes.size.array as Float32Array

    mode.initParticles(positions, colors, PARTICLE_COUNT)

    for (let i = 0; i < positions.length; i++) {
      originalPositions[i] = positions[i]
      targetPositions[i] = positions[i]
    }
    
    for (let i = 0; i < sizes.length; i++) {
      targetSizes[i] = sizes[i]
    }

    particles.geometry.attributes.position.needsUpdate = true
    particles.geometry.attributes.customColor.needsUpdate = true
  }, [])

  // Animation loop
  useEffect(() => {
    initScene()

    let time = 0

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      time += 0.016

      if (!sceneRef.current) return

      const refs = sceneRef.current
      const { camera, composer, particles, originalPositions, targetPositions, targetSizes, rgbShiftPass, afterimagePass, bloomPass } = refs
      const positions = particles.geometry.attributes.position.array as Float32Array
      const sizes = particles.geometry.attributes.size.array as Float32Array
      const colors = particles.geometry.attributes.customColor.array as Float32Array

      // Get audio data
      let bands: AudioBands = { 
        bass: 0, mid: 0, high: 0, overall: 0,
        bassSmooth: 0, midSmooth: 0, highSmooth: 0, overallSmooth: 0,
        isBeat: false, beatIntensity: 0
      }
      if (analyzerRef.current && isListening) {
        bands = analyzerRef.current.getBands()
      }

      // Dynamic post-processing
      rgbShiftPass.uniforms['amount'].value = 0.0006 + bands.overallSmooth * 0.003 + bands.beatIntensity * 0.006
      afterimagePass.uniforms['damp'].value = 0.5 + bands.overallSmooth * 0.25
      bloomPass.strength = 0.4 + bands.beatIntensity * 0.8 + bands.bassSmooth * 0.4

      // Run visualization
      currentMode.animate(
        targetPositions,
        originalPositions,
        targetSizes,
        colors,
        PARTICLE_COUNT,
        bands,
        time
      )

      // Interpolate positions
      for (let i = 0; i < positions.length; i++) {
        positions[i] = lerp(positions[i], targetPositions[i], POSITION_LERP_FACTOR)
      }
      
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] = lerp(sizes[i], targetSizes[i], SIZE_LERP_FACTOR)
      }

      particles.geometry.attributes.position.needsUpdate = true
      particles.geometry.attributes.size.needsUpdate = true
      particles.geometry.attributes.customColor.needsUpdate = true

      // Camera movement
      const targetCameraX = Math.sin(time * 0.1) * 5 + bands.midSmooth * 8 + bands.beatIntensity * 6
      const targetCameraY = Math.cos(time * 0.12) * 3 + bands.highSmooth * 5
      refs.currentCameraX = lerp(refs.currentCameraX, targetCameraX, CAMERA_LERP_FACTOR)
      refs.currentCameraY = lerp(refs.currentCameraY, targetCameraY, CAMERA_LERP_FACTOR)
      camera.position.x = refs.currentCameraX
      camera.position.y = refs.currentCameraY
      camera.lookAt(0, 0, 0)

      // Rotation
      const targetRotationSpeed = 0.0004 + bands.overallSmooth * 0.01 + bands.beatIntensity * 0.008
      refs.currentRotationSpeed = lerp(refs.currentRotationSpeed, targetRotationSpeed, ROTATION_LERP_FACTOR)
      particles.rotation.y += refs.currentRotationSpeed
      particles.rotation.x += refs.currentRotationSpeed * 0.15

      composer.render()
    }

    animate()

    const handleResize = () => {
      if (!containerRef.current || !sceneRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      sceneRef.current.camera.aspect = width / height
      sceneRef.current.camera.updateProjectionMatrix()
      sceneRef.current.renderer.setSize(width, height)
      sceneRef.current.composer.setSize(width, height)
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') setShowUI(prev => !prev)
      const num = parseInt(e.key)
      if (num >= 1 && num <= visualizations.length) {
        const mode = visualizations[num - 1]
        setCurrentMode(mode)
        updateParticleLayout(mode)
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyPress)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyPress)
      if (sceneRef.current && containerRef.current) {
        sceneRef.current.renderer.dispose()
        containerRef.current.removeChild(sceneRef.current.renderer.domElement)
        sceneRef.current = null
      }
    }
  }, [initScene, isListening, currentMode, updateParticleLayout])

  // Auto-start microphone
  useEffect(() => {
    startMic()
    return () => stopAudio()
  }, [])

  const handleModeChange = useCallback((mode: VisualizationMode) => {
    setCurrentMode(mode)
    updateParticleLayout(mode)
  }, [updateParticleLayout])

  const startMic = async () => {
    try {
      analyzerRef.current = new AudioAnalyzer()
      await analyzerRef.current.initMic()
      setIsListening(true)
      setError(null)
    } catch (err) {
      console.error('Microphone error:', err)
      setError('Microphone access denied')
    }
  }

  const stopAudio = () => {
    analyzerRef.current?.disconnect()
    analyzerRef.current = null
    setIsListening(false)
  }

  return (
    <div className="w-full h-screen bg-[#010103] relative overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 
                       border border-white/10 text-white/60 hover:text-white text-sm transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Exit
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
            <span className="text-white/60 text-sm">Microphone</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="flex flex-col gap-1">
            {visualizations.map((mode, i) => (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
                  currentMode.id === mode.id
                    ? 'bg-gradient-to-r from-emerald-600/40 to-teal-600/40 text-white border border-emerald-500/30'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <span className="text-white/30 text-xs font-mono">{i + 1}</span>
                {mode.name}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 text-white/20 text-xs space-y-1 text-right pointer-events-auto">
          <p><span className="text-white/40">H</span> toggle UI</p>
          <p><span className="text-white/40">1-7</span> switch modes</p>
        </div>

        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
