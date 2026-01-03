/**
 * Enhanced Audio Analyzer
 * Inspired by AudioMotion Analyzer patterns for professional-grade audio visualization
 */

// A-weighting coefficients for human ear sensitivity
// Based on IEC 61672:2003 standard
function getAWeighting(frequency: number): number {
  const f2 = frequency * frequency
  const f4 = f2 * f2
  
  const num = 12194 * 12194 * f4
  const den = (f2 + 20.6 * 20.6) * 
              Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * 
              (f2 + 12194 * 12194)
  
  const aWeight = num / den
  // Convert to dB and normalize (A-weighting is 0dB at 1kHz)
  return 20 * Math.log10(aWeight) + 2.0
}

// Pre-compute A-weighting table for performance
function buildAWeightingTable(fftSize: number, sampleRate: number): Float32Array {
  const binCount = fftSize / 2
  const table = new Float32Array(binCount)
  
  for (let i = 0; i < binCount; i++) {
    const frequency = (i * sampleRate) / fftSize
    if (frequency < 20) {
      table[i] = -50 // Heavy attenuation below audible range
    } else if (frequency > 20000) {
      table[i] = -20 // Attenuation above audible range
    } else {
      table[i] = getAWeighting(frequency)
    }
  }
  
  return table
}

export interface AudioBands {
  // Raw values (0-1)
  bass: number
  mid: number
  high: number
  overall: number
  
  // Smoothed values (0-1)
  bassSmooth: number
  midSmooth: number
  highSmooth: number
  overallSmooth: number
  
  // Beat detection
  isBeat: boolean
  beatIntensity: number
  
  // Extended frequency bands (0-1)
  subBass: number      // 20-60Hz - rumble, sub drops
  lowMid: number       // 250-500Hz - body, warmth
  highMid: number      // 2000-4000Hz - presence, clarity
  treble: number       // 4000-8000Hz - brightness
  brilliance: number   // 8000-20000Hz - air, sparkle
  
  // Smoothed extended bands
  subBassSmooth: number
  lowMidSmooth: number
  highMidSmooth: number
  trebleSmooth: number
  brillianceSmooth: number
  
  // Peak hold values (stay at max briefly, then decay)
  bassPeak: number
  midPeak: number
  highPeak: number
  overallPeak: number
  
  // Stereo balance (-1 = left, 0 = center, 1 = right)
  stereoBalance: number
  
  // Estimated BPM (0 if not enough data)
  estimatedBPM: number
  
  // Energy in different presets (matching AudioMotion)
  energy: {
    peak: number
    bass: number
    lowMid: number
    mid: number
    highMid: number
    treble: number
  }
}

// Default/empty AudioBands for initialization
export function createDefaultAudioBands(): AudioBands {
  return {
    bass: 0,
    mid: 0,
    high: 0,
    overall: 0,
    bassSmooth: 0,
    midSmooth: 0,
    highSmooth: 0,
    overallSmooth: 0,
    isBeat: false,
    beatIntensity: 0,
    subBass: 0,
    lowMid: 0,
    highMid: 0,
    treble: 0,
    brilliance: 0,
    subBassSmooth: 0,
    lowMidSmooth: 0,
    highMidSmooth: 0,
    trebleSmooth: 0,
    brillianceSmooth: 0,
    bassPeak: 0,
    midPeak: 0,
    highPeak: 0,
    overallPeak: 0,
    stereoBalance: 0,
    estimatedBPM: 0,
    energy: {
      peak: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0
    }
  }
}

export type FrequencyScale = 'linear' | 'log' | 'bark' | 'mel'
export type WeightingFilter = '' | 'A' | 'B' | 'C' | 'D'

export interface AudioAnalyzerOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  useAWeighting?: boolean
  peakHoldTime?: number      // ms to hold peak
  peakDecayRate?: number     // decay per frame (0-1)
  frequencyScale?: FrequencyScale
}

const DEFAULT_OPTIONS: Required<AudioAnalyzerOptions> = {
  fftSize: 2048,  // Increased from 512 for better frequency resolution
  smoothingTimeConstant: 0.5,
  useAWeighting: true,
  peakHoldTime: 500,
  peakDecayRate: 0.95,
  frequencyScale: 'log'
}

export class AudioAnalyzer {
  analyser: AnalyserNode | null = null
  analyserRight: AnalyserNode | null = null  // For stereo
  dataArray: Uint8Array = new Uint8Array(1024)
  dataArrayRight: Uint8Array = new Uint8Array(1024)
  audioContext: AudioContext | null = null
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private splitter: ChannelSplitterNode | null = null
  
  // Options
  private options: Required<AudioAnalyzerOptions>
  private aWeightingTable: Float32Array | null = null
  private sampleRate: number = 44100

  // Smoothed values - primary bands
  private smoothBass = 0
  private smoothMid = 0
  private smoothHigh = 0
  private smoothOverall = 0
  
  // Smoothed values - extended bands
  private smoothSubBass = 0
  private smoothLowMid = 0
  private smoothHighMid = 0
  private smoothTreble = 0
  private smoothBrilliance = 0
  
  // Secondary smoothing layer for ultra-smooth output
  private smoothBass2 = 0
  private smoothMid2 = 0
  private smoothHigh2 = 0
  private smoothOverall2 = 0
  private smoothSubBass2 = 0
  private smoothLowMid2 = 0
  private smoothHighMid2 = 0
  private smoothTreble2 = 0
  private smoothBrilliance2 = 0

  // Peak hold state
  private peakBass = 0
  private peakMid = 0
  private peakHigh = 0
  private peakOverall = 0
  private peakHoldTimers = { bass: 0, mid: 0, high: 0, overall: 0 }

  // Beat detection
  private lastBeatTime = 0
  private beatCooldown = 180
  private energyHistory: number[] = []
  private historySize = 30
  private currentBeatIntensity = 0
  private smoothedBeatIntensity = 0

  // BPM estimation
  private beatTimestamps: number[] = []
  private estimatedBPM = 0
  private bpmHistorySize = 16

  // Smoothing factors
  private smoothingFactorUp = 0.35
  private smoothingFactorDown = 0.12
  private secondarySmoothFactor = 0.2

  // Stereo balance
  private stereoBalance = 0

  constructor(options: AudioAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async initMic(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    })
    
    this.audioContext = new AudioContext()
    this.sampleRate = this.audioContext.sampleRate
    
    // Build A-weighting table
    this.aWeightingTable = buildAWeightingTable(this.options.fftSize, this.sampleRate)
    
    // Create main analyzer
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.options.fftSize
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant
    
    // Create stereo splitter and right channel analyzer
    this.splitter = this.audioContext.createChannelSplitter(2)
    this.analyserRight = this.audioContext.createAnalyser()
    this.analyserRight.fftSize = this.options.fftSize
    this.analyserRight.smoothingTimeConstant = this.options.smoothingTimeConstant
    
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    
    // Connect: source -> splitter -> analyzers
    this.source.connect(this.splitter)
    this.splitter.connect(this.analyser, 0)  // Left channel
    this.splitter.connect(this.analyserRight, 1)  // Right channel
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.dataArrayRight = new Uint8Array(this.analyser.frequencyBinCount)
  }

  async initAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    this.audioContext = new AudioContext()
    this.sampleRate = this.audioContext.sampleRate
    
    // Build A-weighting table
    this.aWeightingTable = buildAWeightingTable(this.options.fftSize, this.sampleRate)
    
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.options.fftSize
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant
    
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

  // Convert frequency to FFT bin index
  private freqToBin(freq: number): number {
    return Math.round((freq * this.options.fftSize) / this.sampleRate)
  }

  // Get average frequency in a range, optionally applying A-weighting
  private getAverageFrequency(startFreq: number, endFreq: number, applyWeighting = true): number {
    const data = this.dataArray
    const startBin = Math.max(0, this.freqToBin(startFreq))
    const endBin = Math.min(data.length - 1, this.freqToBin(endFreq))
    
    if (startBin >= endBin) return 0
    
    let sum = 0
    let weightSum = 0
    
    for (let i = startBin; i <= endBin; i++) {
      let value = data[i] / 255
      
      // Apply A-weighting if enabled
      if (applyWeighting && this.options.useAWeighting && this.aWeightingTable) {
        const weightDb = this.aWeightingTable[i]
        const weightLinear = Math.pow(10, weightDb / 20)
        value *= Math.min(2, Math.max(0.1, weightLinear))
      }
      
      sum += value
      weightSum++
    }
    
    return weightSum > 0 ? Math.min(1, sum / weightSum) : 0
  }

  // Get energy for specific preset (matching AudioMotion API)
  getEnergy(preset?: 'peak' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'treble'): number {
    this.getFrequencyData()
    
    switch (preset) {
      case 'bass':
        return this.getAverageFrequency(20, 250)
      case 'lowMid':
        return this.getAverageFrequency(250, 500)
      case 'mid':
        return this.getAverageFrequency(500, 2000)
      case 'highMid':
        return this.getAverageFrequency(2000, 4000)
      case 'treble':
        return this.getAverageFrequency(4000, 16000)
      case 'peak':
      default:
        // Return max value across spectrum
        let max = 0
        for (let i = 0; i < this.dataArray.length; i++) {
          if (this.dataArray[i] > max) max = this.dataArray[i]
        }
        return max / 255
    }
  }

  // Update peak hold values
  private updatePeaks(bass: number, mid: number, high: number, overall: number): void {
    const now = performance.now()
    const holdTime = this.options.peakHoldTime
    const decay = this.options.peakDecayRate
    
    // Bass peak
    if (bass >= this.peakBass) {
      this.peakBass = bass
      this.peakHoldTimers.bass = now
    } else if (now - this.peakHoldTimers.bass > holdTime) {
      this.peakBass *= decay
    }
    
    // Mid peak
    if (mid >= this.peakMid) {
      this.peakMid = mid
      this.peakHoldTimers.mid = now
    } else if (now - this.peakHoldTimers.mid > holdTime) {
      this.peakMid *= decay
    }
    
    // High peak
    if (high >= this.peakHigh) {
      this.peakHigh = high
      this.peakHoldTimers.high = now
    } else if (now - this.peakHoldTimers.high > holdTime) {
      this.peakHigh *= decay
    }
    
    // Overall peak
    if (overall >= this.peakOverall) {
      this.peakOverall = overall
      this.peakHoldTimers.overall = now
    } else if (now - this.peakHoldTimers.overall > holdTime) {
      this.peakOverall *= decay
    }
  }

  // Calculate stereo balance
  private updateStereoBalance(): void {
    if (!this.analyserRight) {
      this.stereoBalance = 0
      return
    }
    
    this.analyserRight.getByteFrequencyData(this.dataArrayRight)
    
    let leftSum = 0
    let rightSum = 0
    
    for (let i = 0; i < this.dataArray.length; i++) {
      leftSum += this.dataArray[i]
      rightSum += this.dataArrayRight[i]
    }
    
    const total = leftSum + rightSum
    if (total > 0) {
      // -1 = full left, 0 = center, 1 = full right
      this.stereoBalance = this.lerp(
        this.stereoBalance,
        (rightSum - leftSum) / total * 2,
        0.15
      )
    }
  }

  // Estimate BPM from beat intervals
  private updateBPMEstimate(isBeat: boolean): void {
    if (!isBeat) return
    
    const now = performance.now()
    this.beatTimestamps.push(now)
    
    // Keep only recent beats
    while (this.beatTimestamps.length > this.bpmHistorySize) {
      this.beatTimestamps.shift()
    }
    
    if (this.beatTimestamps.length < 4) {
      this.estimatedBPM = 0
      return
    }
    
    // Calculate average interval
    let totalInterval = 0
    for (let i = 1; i < this.beatTimestamps.length; i++) {
      totalInterval += this.beatTimestamps[i] - this.beatTimestamps[i - 1]
    }
    
    const avgInterval = totalInterval / (this.beatTimestamps.length - 1)
    
    // Convert to BPM (ms per beat -> beats per minute)
    if (avgInterval > 0) {
      const rawBPM = 60000 / avgInterval
      // Clamp to reasonable range and snap to common values
      if (rawBPM >= 60 && rawBPM <= 200) {
        this.estimatedBPM = this.lerp(this.estimatedBPM, rawBPM, 0.1)
      }
    }
  }

  getBands(): AudioBands {
    this.getFrequencyData()
    this.updateStereoBalance()

    // Extended frequency bands
    const rawSubBass = this.getAverageFrequency(20, 60)
    const rawBass = this.getAverageFrequency(60, 250)
    const rawLowMid = this.getAverageFrequency(250, 500)
    const rawMid = this.getAverageFrequency(500, 2000)
    const rawHighMid = this.getAverageFrequency(2000, 4000)
    const rawTreble = this.getAverageFrequency(4000, 8000)
    const rawBrilliance = this.getAverageFrequency(8000, 20000)
    const rawHigh = this.getAverageFrequency(4000, 20000)
    const rawOverall = this.getAverageFrequency(20, 20000)

    // First layer: asymmetric smoothing (fast attack, slow release)
    const applySmoothing = (current: number, target: number, factorUp: number, factorDown: number) => {
      const isRising = target > current
      return this.lerp(current, target, isRising ? factorUp : factorDown)
    }

    // Primary bands
    this.smoothBass = applySmoothing(this.smoothBass, rawBass, this.smoothingFactorUp * 1.1, this.smoothingFactorDown)
    this.smoothMid = applySmoothing(this.smoothMid, rawMid, this.smoothingFactorUp, this.smoothingFactorDown)
    this.smoothHigh = applySmoothing(this.smoothHigh, rawHigh, this.smoothingFactorUp * 0.8, this.smoothingFactorDown * 0.6)
    this.smoothOverall = applySmoothing(this.smoothOverall, rawOverall, this.smoothingFactorUp, this.smoothingFactorDown)
    
    // Extended bands
    this.smoothSubBass = applySmoothing(this.smoothSubBass, rawSubBass, this.smoothingFactorUp * 1.2, this.smoothingFactorDown * 0.8)
    this.smoothLowMid = applySmoothing(this.smoothLowMid, rawLowMid, this.smoothingFactorUp, this.smoothingFactorDown)
    this.smoothHighMid = applySmoothing(this.smoothHighMid, rawHighMid, this.smoothingFactorUp * 0.9, this.smoothingFactorDown * 0.7)
    this.smoothTreble = applySmoothing(this.smoothTreble, rawTreble, this.smoothingFactorUp * 0.8, this.smoothingFactorDown * 0.6)
    this.smoothBrilliance = applySmoothing(this.smoothBrilliance, rawBrilliance, this.smoothingFactorUp * 0.7, this.smoothingFactorDown * 0.5)
    
    // Second layer: uniform smoothing for extra silkiness
    this.smoothBass2 = this.lerp(this.smoothBass2, this.smoothBass, this.secondarySmoothFactor)
    this.smoothMid2 = this.lerp(this.smoothMid2, this.smoothMid, this.secondarySmoothFactor)
    this.smoothHigh2 = this.lerp(this.smoothHigh2, this.smoothHigh, this.secondarySmoothFactor)
    this.smoothOverall2 = this.lerp(this.smoothOverall2, this.smoothOverall, this.secondarySmoothFactor)
    this.smoothSubBass2 = this.lerp(this.smoothSubBass2, this.smoothSubBass, this.secondarySmoothFactor)
    this.smoothLowMid2 = this.lerp(this.smoothLowMid2, this.smoothLowMid, this.secondarySmoothFactor)
    this.smoothHighMid2 = this.lerp(this.smoothHighMid2, this.smoothHighMid, this.secondarySmoothFactor)
    this.smoothTreble2 = this.lerp(this.smoothTreble2, this.smoothTreble, this.secondarySmoothFactor)
    this.smoothBrilliance2 = this.lerp(this.smoothBrilliance2, this.smoothBrilliance, this.secondarySmoothFactor)

    // Update peak hold values
    this.updatePeaks(rawBass, rawMid, rawHigh, rawOverall)

    // Beat detection with improved algorithm
    const currentEnergy = rawSubBass * 2.0 + rawBass * 1.5 + rawMid * 0.5
    this.energyHistory.push(currentEnergy)
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift()
    }

    const averageEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const energyVariance = this.energyHistory.reduce((sum, e) => sum + Math.pow(e - averageEnergy, 2), 0) / this.energyHistory.length
    const dynamicThreshold = averageEnergy + Math.sqrt(energyVariance) * 1.4

    const now = performance.now()
    let isBeat = false

    if (
      currentEnergy > dynamicThreshold &&
      currentEnergy > 0.15 &&
      now - this.lastBeatTime > this.beatCooldown
    ) {
      isBeat = true
      this.lastBeatTime = now
      this.currentBeatIntensity = Math.min(1.0, (currentEnergy - averageEnergy) / 0.4)
    }

    // Update BPM estimate
    this.updateBPMEstimate(isBeat)

    // Smooth beat decay
    this.currentBeatIntensity *= 0.9
    this.smoothedBeatIntensity = this.lerp(this.smoothedBeatIntensity, this.currentBeatIntensity, 0.25)

    return {
      // Raw values
      bass: rawBass,
      mid: rawMid,
      high: rawHigh,
      overall: rawOverall,
      
      // Smoothed primary
      bassSmooth: this.smoothBass2,
      midSmooth: this.smoothMid2,
      highSmooth: this.smoothHigh2,
      overallSmooth: this.smoothOverall2,
      
      // Beat
      isBeat,
      beatIntensity: this.smoothedBeatIntensity,
      
      // Extended bands (raw)
      subBass: rawSubBass,
      lowMid: rawLowMid,
      highMid: rawHighMid,
      treble: rawTreble,
      brilliance: rawBrilliance,
      
      // Extended bands (smoothed)
      subBassSmooth: this.smoothSubBass2,
      lowMidSmooth: this.smoothLowMid2,
      highMidSmooth: this.smoothHighMid2,
      trebleSmooth: this.smoothTreble2,
      brillianceSmooth: this.smoothBrilliance2,
      
      // Peak hold
      bassPeak: this.peakBass,
      midPeak: this.peakMid,
      highPeak: this.peakHigh,
      overallPeak: this.peakOverall,
      
      // Stereo
      stereoBalance: this.stereoBalance,
      
      // BPM
      estimatedBPM: Math.round(this.estimatedBPM),
      
      // Energy presets (for AudioMotion compatibility)
      energy: {
        peak: Math.max(rawBass, rawMid, rawHigh),
        bass: rawBass,
        lowMid: rawLowMid,
        mid: rawMid,
        highMid: rawHighMid,
        treble: rawTreble
      }
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
    if (this.splitter) {
      this.splitter.disconnect()
      this.splitter = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyser = null
    this.analyserRight = null
    
    // Reset all state
    this.smoothBass = 0
    this.smoothMid = 0
    this.smoothHigh = 0
    this.smoothOverall = 0
    this.smoothBass2 = 0
    this.smoothMid2 = 0
    this.smoothHigh2 = 0
    this.smoothOverall2 = 0
    this.smoothSubBass = 0
    this.smoothLowMid = 0
    this.smoothHighMid = 0
    this.smoothTreble = 0
    this.smoothBrilliance = 0
    this.smoothSubBass2 = 0
    this.smoothLowMid2 = 0
    this.smoothHighMid2 = 0
    this.smoothTreble2 = 0
    this.smoothBrilliance2 = 0
    this.peakBass = 0
    this.peakMid = 0
    this.peakHigh = 0
    this.peakOverall = 0
    this.energyHistory = []
    this.beatTimestamps = []
    this.currentBeatIntensity = 0
    this.smoothedBeatIntensity = 0
    this.estimatedBPM = 0
    this.stereoBalance = 0
  }
}
