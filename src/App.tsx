import { useState } from 'react'
import LandingPage from '@/components/LandingPage'
import MusicVisualizer from '@/components/MusicVisualizer'

type AppState = 'landing' | 'visualizing'

export default function App() {
  const [state, setState] = useState<AppState>('landing')

  const handleStart = () => {
    setState('visualizing')
  }

  const handleBack = () => {
    setState('landing')
  }

  if (state === 'landing') {
    return <LandingPage onStart={handleStart} />
  }

  return <MusicVisualizer onBack={handleBack} />
}
