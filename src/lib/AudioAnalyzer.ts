export interface AudioBands {
  bass: number
  mid: number
  high: number
  overall: number
  bassSmooth: number
  midSmooth: number
  highSmooth: number
  overallSmooth: number
  isBeat: boolean
  beatIntensity: number
}

export class AudioAnalyzer {
  analyser: AnalyserNode | null = null
  dataArray: Uint8Array = new Uint8Array(128)
  audioContext: AudioContext | null = null
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null
  private stream: MediaStream | null = null

  // Smoothed values (for gradual transitions)
  private smoothBass = 0
  private smoothMid = 0
  private smoothHigh = 0
  private smoothOverall = 0

  // Beat detection
  private lastBeatTime = 0
  private beatCooldown = 180 // ms between beats
  private energyHistory: number[] = []
  private historySize = 43 // ~0.7 seconds at 60fps
  private currentBeatIntensity = 0

  // Smoothing factors (0-1, lower = smoother)
  private smoothingFactorUp = 0.08    // Slower attack
  private smoothingFactorDown = 0.04  // Even slower release

  async initMic(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.92 // Higher = smoother FFT
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.source.connect(this.analyser)
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
  }

  async initAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.92 // Higher = smoother FFT
    this.source = this.audioContext.createMediaElementSource(audioElement)
    this.source.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
  }

  getFrequencyData(): Uint8Array {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.dataArray)
    }
    return this.dataArray
  }

  private lerp(current: number, target: number, factor: number): number {
    return current + (target - current) * factor
  }

  private getAverageFrequency(startIndex: number, endIndex: number): number {
    const data = this.dataArray
    let sum = 0
    const count = endIndex - startIndex
    for (let i = startIndex; i < endIndex && i < data.length; i++) {
      sum += data[i]
    }
    return count > 0 ? sum / count / 255 : 0
  }

  getBands(): AudioBands {
    this.getFrequencyData()

    // Raw frequency bands (adjusted ranges for better musicality)
    const rawBass = this.getAverageFrequency(0, 6)       // Sub-bass and bass
    const rawMid = this.getAverageFrequency(6, 32)       // Mids
    const rawHigh = this.getAverageFrequency(32, 100)    // Highs
    const rawOverall = this.getAverageFrequency(0, 100)

    // Apply asymmetric smoothing (moderate attack, slow release)
    const bassUp = rawBass > this.smoothBass
    const midUp = rawMid > this.smoothMid
    const highUp = rawHigh > this.smoothHigh
    const overallUp = rawOverall > this.smoothOverall

    this.smoothBass = this.lerp(
      this.smoothBass, 
      rawBass, 
      bassUp ? this.smoothingFactorUp * 1.2 : this.smoothingFactorDown
    )
    this.smoothMid = this.lerp(
      this.smoothMid, 
      rawMid, 
      midUp ? this.smoothingFactorUp : this.smoothingFactorDown
    )
    this.smoothHigh = this.lerp(
      this.smoothHigh, 
      rawHigh, 
      highUp ? this.smoothingFactorUp * 0.8 : this.smoothingFactorDown * 0.6
    )
    this.smoothOverall = this.lerp(
      this.smoothOverall, 
      rawOverall, 
      overallUp ? this.smoothingFactorUp : this.smoothingFactorDown
    )

    // Beat detection using energy comparison
    const currentEnergy = rawBass * 1.8 + rawMid * 0.4
    this.energyHistory.push(currentEnergy)
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift()
    }

    const averageEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const energyVariance = this.energyHistory.reduce((sum, e) => sum + Math.pow(e - averageEnergy, 2), 0) / this.energyHistory.length
    const dynamicThreshold = averageEnergy + Math.sqrt(energyVariance) * 1.5

    const now = performance.now()
    let isBeat = false

    if (
      currentEnergy > dynamicThreshold &&
      currentEnergy > 0.25 &&
      now - this.lastBeatTime > this.beatCooldown
    ) {
      isBeat = true
      this.lastBeatTime = now
      this.currentBeatIntensity = Math.min(1, (currentEnergy - averageEnergy) / 0.4)
    }

    // Decay beat intensity smoothly (slower decay)
    this.currentBeatIntensity *= 0.88

    return {
      bass: rawBass,
      mid: rawMid,
      high: rawHigh,
      overall: rawOverall,
      bassSmooth: this.smoothBass,
      midSmooth: this.smoothMid,
      highSmooth: this.smoothHigh,
      overallSmooth: this.smoothOverall,
      isBeat,
      beatIntensity: this.currentBeatIntensity
    }
  }

  disconnect(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyser = null
    
    // Reset state
    this.smoothBass = 0
    this.smoothMid = 0
    this.smoothHigh = 0
    this.smoothOverall = 0
    this.energyHistory = []
    this.currentBeatIntensity = 0
  }
}
