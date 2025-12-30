import { useState, useRef } from 'react'
import LandingPage from '@/components/LandingPage'
import MusicVisualizer from '@/components/MusicVisualizer'

type AppState = 'landing' | 'visualizing'
type AudioSource = 'mic' | 'file'

export default function App() {
  const [state, setState] = useState<AppState>('landing')
  const [audioSource, setAudioSource] = useState<AudioSource>('mic')
  const audioFileRef = useRef<File | null>(null)

  const handleStart = (source: AudioSource, file?: File) => {
    setAudioSource(source)
    if (file) {
      audioFileRef.current = file
    }
    setState('visualizing')
  }

  const handleBack = () => {
    setState('landing')
    audioFileRef.current = null
  }

  if (state === 'landing') {
    return <LandingPage onStart={handleStart} />
  }

  return (
    <MusicVisualizer
      audioSource={audioSource}
      audioFile={audioFileRef.current}
      onBack={handleBack}
    />
  )
}