import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { AudioAnalyzer, type AudioBands } from '@/lib/AudioAnalyzer'
import { particleVertexShader, particleFragmentShader } from '@/lib/shaders'
import { visualizations, type VisualizationMode } from '@/lib/visualizations'
import Controls from './Controls'

const PARTICLE_COUNT = 8000

interface SceneRefs {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  particles: THREE.Points
  originalPositions: Float32Array
}

interface MusicVisualizerProps {
  audioSource: 'mic' | 'file'
  audioFile: File | null
  onBack: () => void
}

export default function MusicVisualizer({ audioSource, audioFile, onBack }: MusicVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMode, setCurrentMode] = useState<VisualizationMode>(visualizations[0])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const analyzerRef = useRef<AudioAnalyzer | null>(null)
  const sceneRef = useRef<SceneRefs | null>(null)
  const animationRef = useRef<number>(0)

  const initScene = useCallback(() => {
    if (!containerRef.current || sceneRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050508)

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 50

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const alphas = new Float32Array(PARTICLE_COUNT)

    currentMode.initParticles(positions, colors, PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 1 + Math.random() * 2
      alphas[i] = 0.3 + Math.random() * 0.7
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
      particles,
      originalPositions: positions.slice()
    }
  }, [currentMode])

  const updateParticleLayout = useCallback((mode: VisualizationMode) => {
    if (!sceneRef.current) return

    const { particles, originalPositions } = sceneRef.current
    const positions = particles.geometry.attributes.position.array as Float32Array
    const colors = particles.geometry.attributes.customColor.array as Float32Array

    mode.initParticles(positions, colors, PARTICLE_COUNT)

    for (let i = 0; i < positions.length; i++) {
      originalPositions[i] = positions[i]
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

      const { scene, camera, renderer, particles, originalPositions } = sceneRef.current
      const positions = particles.geometry.attributes.position.array as Float32Array
      const sizes = particles.geometry.attributes.size.array as Float32Array
      const colors = particles.geometry.attributes.customColor.array as Float32Array

      let bands: AudioBands = { bass: 0.1, mid: 0.1, high: 0.1, overall: 0.1 }
      if (analyzerRef.current && (isListening || isPlaying)) {
        bands = analyzerRef.current.getBands()
      }

      currentMode.animate(
        positions,
        originalPositions,
        sizes,
        colors,
        PARTICLE_COUNT,
        bands,
        time
      )

      particles.geometry.attributes.position.needsUpdate = true
      particles.geometry.attributes.size.needsUpdate = true

      particles.rotation.y += 0.002 + bands.overall * 0.01
      particles.rotation.x += 0.001

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!containerRef.current || !sceneRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      sceneRef.current.camera.aspect = width / height
      sceneRef.current.camera.updateProjectionMatrix()
      sceneRef.current.renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
      if (sceneRef.current && containerRef.current) {
        sceneRef.current.renderer.dispose()
        containerRef.current.removeChild(sceneRef.current.renderer.domElement)
        sceneRef.current = null
      }
    }
  }, [initScene, isListening, isPlaying, currentMode])

  // Auto-start based on audio source
  useEffect(() => {
    if (audioSource === 'mic') {
      startMic()
    } else if (audioSource === 'file' && audioFile) {
      startFile(audioFile)
    }

    return () => {
      stopAudio()
    }
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
      setError('Microphone access denied. Please allow microphone access.')
    }
  }

  const startFile = async (file: File) => {
    try {
      setFileName(file.name)
      const url = URL.createObjectURL(file)
      const audio = new Audio(url)
      audio.crossOrigin = 'anonymous'
      audioRef.current = audio

      analyzerRef.current = new AudioAnalyzer()
      await analyzerRef.current.initAudioElement(audio)

      audio.play()
      setIsPlaying(true)
      setError(null)

      audio.onended = () => setIsPlaying(false)
    } catch (err) {
      console.error('Audio file error:', err)
      setError('Failed to load audio file.')
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    analyzerRef.current?.disconnect()
    analyzerRef.current = null
    setIsListening(false)
    setIsPlaying(false)
  }

  const togglePlayback = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className="w-full h-screen bg-[#050508] flex flex-col relative">
      <Controls
        isListening={isListening}
        isPlaying={isPlaying}
        audioSource={audioSource}
        fileName={fileName}
        currentMode={currentMode}
        modes={visualizations}
        error={error}
        onTogglePlayback={togglePlayback}
        onModeChange={handleModeChange}
        onBack={onBack}
      />

      <div className="absolute bottom-4 left-4 z-10 text-white/30 text-xs tracking-widest">
        {isListening ? 'LISTENING' : isPlaying ? 'PLAYING' : 'PAUSED'}
      </div>

      <div ref={containerRef} className="flex-1" />
    </div>
  )
}