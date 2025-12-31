import { useEffect, useRef, useState } from 'react'

interface LandingPageProps {
  onStart: () => void
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const [isHovering, setIsHovering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const waveformRef = useRef<number[]>(Array(64).fill(0))

  // Animated waveform background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let time = 0

    const animate = () => {
      time += 0.015
      ctx.fillStyle = '#06060a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Update waveform with smooth noise
      waveformRef.current = waveformRef.current.map((_, i) => {
        const noise = Math.sin(time * 2 + i * 0.3) * 0.3 +
                     Math.sin(time * 1.3 + i * 0.5) * 0.2 +
                     Math.sin(time * 0.7 + i * 0.8) * 0.15
        return 0.3 + noise * (isHovering ? 1.5 : 1)
      })

      // Draw flowing waveform ribbons - forest green to teal
      const centerY = canvas.height * 0.5
      const ribbonCount = 3
      
      for (let r = 0; r < ribbonCount; r++) {
        const offset = (r - 1) * 60
        const alpha = 0.08 - r * 0.02
        
        ctx.beginPath()
        ctx.moveTo(0, centerY + offset)
        
        for (let i = 0; i <= 64; i++) {
          const x = (i / 64) * canvas.width
          const waveVal = waveformRef.current[Math.min(i, 63)] || 0
          const y = centerY + offset + waveVal * 80 * Math.sin(time + i * 0.1 + r)
          
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        
        // Updated gradient: forest green -> emerald -> teal (#009aca)
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
        gradient.addColorStop(0, `rgba(34, 139, 34, ${alpha})`)
        gradient.addColorStop(0.5, `rgba(16, 185, 129, ${alpha * 1.5})`)
        gradient.addColorStop(1, `rgba(0, 154, 202, ${alpha})`)
        
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Floating particles - updated to green/teal
      const particleCount = 40
      for (let i = 0; i < particleCount; i++) {
        const px = ((i * 137.5) % canvas.width + time * 20) % canvas.width
        const py = ((i * 91.3) % canvas.height + Math.sin(time + i) * 30)
        const size = 1 + Math.sin(time * 2 + i) * 0.5
        const alpha = 0.1 + Math.sin(time + i * 0.5) * 0.05
        
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, size * 4)
        gradient.addColorStop(0, `rgba(16, 185, 129, ${alpha})`)
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(px, py, size * 4, 0, Math.PI * 2)
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [isHovering])

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight
    })
  }

  return (
    <div
      className="relative w-full h-screen bg-[#06060a] flex overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Animated canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Gradient orb following mouse */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(0,154,202,0.05) 40%, transparent 70%)',
          left: `${mousePos.x * 100}%`,
          top: `${mousePos.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), top 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
          filter: 'blur(40px)'
        }}
      />

      {/* Main content */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center px-6">
        
        {/* Logo section */}
        <div className="flex flex-col items-center gap-2 mb-12">
          {/* Waveform icon */}
          <div className="flex items-center gap-[3px] mb-4">
            {[0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 0.75, 0.45].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-emerald-600 to-teal-500 rounded-full"
                style={{
                  height: `${h * 32}px`,
                  animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`
                }}
              />
            ))}
          </div>
          
          {/* Logo text */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
              Jam
            </span>
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Viz
            </span>
          </h1>
          
          <p className="text-white/40 text-sm md:text-base tracking-[0.2em] uppercase mt-2">
            Audio Reactive Visuals
          </p>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={onStart}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="group relative px-12 py-4 rounded-full overflow-hidden transition-all duration-500"
          >
            {/* Button gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 opacity-90 group-hover:opacity-100 transition-opacity" />
            
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            
            {/* Button text */}
            <span className="relative text-white font-semibold tracking-wide">
              Start Visualizer
            </span>
          </button>

          {/* Microphone indicator */}
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <MicIcon />
            <span>Uses your microphone</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <p className="text-white/20 text-xs tracking-wider">
          WebGL Visualizer • Built with Three.js
        </p>
      </div>

      {/* Keyframes for pulsing bars */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scaleY(1); opacity: 0.7; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
