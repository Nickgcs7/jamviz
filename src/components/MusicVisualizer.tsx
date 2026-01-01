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
import { visualizations, type VisualizationMode, type SceneObjects } from '@/lib/visualizations'

const PARTICLE_COUNT = 10000

// Fine-tuned lerp factors for ultra-smooth motion
const POSITION_LERP_FACTOR = 0.12      // Slower position interpolation
const SIZE_LERP_FACTOR = 0.15          // Slower size changes
const COLOR_LERP_FACTOR = 0.08         // Very smooth color transitions
const CAMERA_LERP_FACTOR = 0.04        // Gentle camera movement
const ROTATION_LERP_FACTOR = 0.06      // Smooth rotation
const POST_PROCESS_LERP = 0.1          // Smooth post-processing changes

interface SceneRefs {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  composer: EffectComposer
  particles: THREE.Points
  originalPositions: Float32Array
  targetPositions: Float32Array
  targetSizes: Float32Array
  targetColors: Float32Array
  currentCameraX: number
  currentCameraY: number
  currentCameraZ: number
  currentRotationSpeed: number
  currentRotationX: number
  afterimagePass: AfterimagePass
  rgbShiftPass: ShaderPass
  bloomPass: UnrealBloomPass
  // Smooth post-processing values
  currentBloom: number
  currentRgbShift: number
  currentAfterimage: number
  // Custom scene objects for visualizations
  customSceneObjects: SceneObjects | null
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
  const [ledText, setLedText] = useState('JAMVIZ')
  const analyzerRef = useRef<AudioAnalyzer | null>(null)
  const sceneRef = useRef<SceneRefs | null>(null)
  const animationRef = useRef<number>(0)

  const initScene = useCallback(() => {
    if (!containerRef.current || sceneRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x010103)
    
    // Add subtle fog for depth
    scene.fog = new THREE.FogExp2(0x010103, 0.008)

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 50

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.8  // Slightly reduced exposure
    containerRef.current.appendChild(renderer.domElement)

    // Post-processing pipeline with reduced bloom
    const composer = new EffectComposer(renderer)
    
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    // Afterimage for smooth trails
    const afterimagePass = new AfterimagePass(0.6)
    composer.addPass(afterimagePass)

    // Reduced bloom for less glow
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.35,   // strength - reduced from 0.6
      0.3,    // radius  
      0.6     // threshold - raised to reduce glow on dimmer particles
    )
    composer.addPass(bloomPass)

    // Subtle RGB shift for depth perception
    const rgbShiftPass = new ShaderPass(RGBShiftShader)
    rgbShiftPass.uniforms['amount'].value = 0.0006
    rgbShiftPass.uniforms['angle'].value = 0.0
    composer.addPass(rgbShiftPass)

    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    // Particle geometry with enhanced attributes
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

    // Initialize custom scene objects if visualization supports them
    let customSceneObjects: SceneObjects | null = null
    if (currentMode.createSceneObjects) {
      customSceneObjects = currentMode.createSceneObjects(scene)
    }

    // Handle hideParticles flag
    if (currentMode.hideParticles) {
      particles.visible = false
    }

    sceneRef.current = {
      scene,
      camera,
      renderer,
      composer,
      particles,
      originalPositions: positions.slice(),
      targetPositions: positions.slice(),
      targetSizes: sizes.slice(),
      targetColors: colors.slice(),
      currentCameraX: 0,
      currentCameraY: 0,
      currentCameraZ: 50,
      currentRotationSpeed: 0.001,
      currentRotationX: 0,
      afterimagePass,
      rgbShiftPass,
      bloomPass,
      currentBloom: 0.35,
      currentRgbShift: 0.0006,
      currentAfterimage: 0.6,
      customSceneObjects
    }
  }, [currentMode])

  const updateParticleLayout = useCallback((mode: VisualizationMode) => {
    if (!sceneRef.current) return

    const { scene, particles, originalPositions, targetPositions, targetSizes, targetColors, customSceneObjects } = sceneRef.current
    const positions = particles.geometry.attributes.position.array as Float32Array
    const colors = particles.geometry.attributes.customColor.array as Float32Array
    const sizes = particles.geometry.attributes.size.array as Float32Array

    // Clean up old custom scene objects
    if (customSceneObjects) {
      customSceneObjects.dispose()
      sceneRef.current.customSceneObjects = null
    }

    mode.initParticles(positions, colors, PARTICLE_COUNT)

    for (let i = 0; i < positions.length; i++) {
      originalPositions[i] = positions[i]
      targetPositions[i] = positions[i]
      targetColors[i] = colors[i]
    }
    
    for (let i = 0; i < sizes.length; i++) {
      targetSizes[i] = sizes[i]
    }

    // Create new custom scene objects if visualization supports them
    if (mode.createSceneObjects) {
      sceneRef.current.customSceneObjects = mode.createSceneObjects(scene)
    }

    // Handle hideParticles flag
    particles.visible = !mode.hideParticles

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
      const { camera, composer, particles, originalPositions, targetPositions, targetSizes, targetColors, rgbShiftPass, afterimagePass, bloomPass, customSceneObjects } = refs
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

      // Reduced dynamic post-processing
      const targetBloom = 0.3 + bands.beatIntensity * 0.2 + bands.bassSmooth * 0.15
      const targetRgbShift = 0.0004 + bands.overallSmooth * 0.001 + bands.beatIntensity * 0.001
      const targetAfterimage = 0.55 + bands.overallSmooth * 0.15
      
      refs.currentBloom = lerp(refs.currentBloom, targetBloom, POST_PROCESS_LERP)
      refs.currentRgbShift = lerp(refs.currentRgbShift, targetRgbShift, POST_PROCESS_LERP)
      refs.currentAfterimage = lerp(refs.currentAfterimage, targetAfterimage, POST_PROCESS_LERP)
      
      bloomPass.strength = refs.currentBloom
      rgbShiftPass.uniforms['amount'].value = refs.currentRgbShift
      afterimagePass.uniforms['damp'].value = refs.currentAfterimage

      // Update custom scene objects if present
      if (customSceneObjects) {
        customSceneObjects.update(bands, time)
      }

      // Run visualization to set targets (only if particles are visible)
      if (particles.visible) {
        currentMode.animate(
          targetPositions,
          originalPositions,
          targetSizes,
          targetColors,
          PARTICLE_COUNT,
          bands,
          time
        )

        // Ultra-smooth interpolation for positions
        for (let i = 0; i < positions.length; i++) {
          positions[i] = lerp(positions[i], targetPositions[i], POSITION_LERP_FACTOR)
        }
        
        // Smooth size transitions
        for (let i = 0; i < sizes.length; i++) {
          sizes[i] = lerp(sizes[i], targetSizes[i], SIZE_LERP_FACTOR)
        }
        
        // Very smooth color transitions
        for (let i = 0; i < colors.length; i++) {
          colors[i] = lerp(colors[i], targetColors[i], COLOR_LERP_FACTOR)
        }

        particles.geometry.attributes.position.needsUpdate = true
        particles.geometry.attributes.size.needsUpdate = true
        particles.geometry.attributes.customColor.needsUpdate = true
      } else {
        // Still run animate for visualizations that use it for state management
        currentMode.animate(
          targetPositions,
          originalPositions,
          targetSizes,
          targetColors,
          PARTICLE_COUNT,
          bands,
          time
        )
      }

      // Smooth camera movement with depth
      // LED Matrix gets reduced camera motion to keep text readable
      const isLedMatrix = currentMode.id === 'led_matrix'
      const cameraIntensity = isLedMatrix ? 0.3 : 1.0
      
      const targetCameraX = (Math.sin(time * 0.08) * 6 + bands.midSmooth * 6 + bands.beatIntensity * 3) * cameraIntensity
      const targetCameraY = (Math.cos(time * 0.1) * 4 + bands.highSmooth * 4) * cameraIntensity
      const targetCameraZ = isLedMatrix ? 55 : 50 + Math.sin(time * 0.05) * 5 - bands.bassSmooth * 8
      
      refs.currentCameraX = lerp(refs.currentCameraX, targetCameraX, CAMERA_LERP_FACTOR)
      refs.currentCameraY = lerp(refs.currentCameraY, targetCameraY, CAMERA_LERP_FACTOR)
      refs.currentCameraZ = lerp(refs.currentCameraZ, targetCameraZ, CAMERA_LERP_FACTOR)
      
      camera.position.x = refs.currentCameraX
      camera.position.y = refs.currentCameraY
      camera.position.z = refs.currentCameraZ
      camera.lookAt(0, 0, 0)

      // Smooth rotation (only for particle-based visualizations, skip for LED Matrix)
      if (particles.visible && !currentMode.hideParticles && !isLedMatrix) {
        const targetRotationSpeed = 0.0003 + bands.overallSmooth * 0.008 + bands.beatIntensity * 0.004
        refs.currentRotationSpeed = lerp(refs.currentRotationSpeed, targetRotationSpeed, ROTATION_LERP_FACTOR)
        
        particles.rotation.y += refs.currentRotationSpeed
        
        const targetRotationX = bands.midSmooth * 0.1
        refs.currentRotationX = lerp(refs.currentRotationX, targetRotationX, ROTATION_LERP_FACTOR)
        particles.rotation.x = refs.currentRotationX
      } else if (isLedMatrix) {
        // Keep LED Matrix flat
        particles.rotation.x = 0
        particles.rotation.y = 0
        particles.rotation.z = 0
      }

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
      // Don't trigger shortcuts if typing in text input
      if (e.target instanceof HTMLInputElement) return
      
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
      if (sceneRef.current) {
        // Clean up custom scene objects
        if (sceneRef.current.customSceneObjects) {
          sceneRef.current.customSceneObjects.dispose()
        }
        if (containerRef.current) {
          sceneRef.current.renderer.dispose()
          containerRef.current.removeChild(sceneRef.current.renderer.domElement)
        }
        sceneRef.current = null
      }
    }
  }, [initScene, isListening, currentMode, updateParticleLayout])

  // Auto-start microphone
  useEffect(() => {
    startMic()
    return () => stopAudio()
  }, [])

  // Update LED text when it changes
  useEffect(() => {
    if (currentMode.setText) {
      currentMode.setText(ledText)
    }
  }, [ledText, currentMode])

  const handleModeChange = useCallback((mode: VisualizationMode) => {
    setCurrentMode(mode)
    updateParticleLayout(mode)
    // Initialize text if switching to LED Matrix
    if (mode.setText) {
      mode.setText(ledText)
    }
  }, [updateParticleLayout, ledText])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    setLedText(newText)
  }, [])

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

        {/* LED Matrix Text Input */}
        {currentMode.textConfig?.enabled && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/60 border border-white/20 backdrop-blur-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <input
                type="text"
                value={ledText}
                onChange={handleTextChange}
                placeholder={currentMode.textConfig.placeholder}
                className="bg-transparent border-none outline-none text-white text-sm w-48 placeholder-white/30"
                maxLength={50}
              />
            </div>
          </div>
        )}

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
