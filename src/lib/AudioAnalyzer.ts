/**
 * Enhanced Audio Analyzer v2
 * 
 * - Per-band envelope followers with separate attack/release rates
 * - Spectral flux onset detection (better than energy-threshold beats)
 * - Spectral centroid for brightness mapping
 * - RMS energy for perceptually accurate loudness
 * - Energy trend detection for build-up/drop awareness
 * - Raw spectrum access for custom analysis
 */

function getAWeighting(frequency: number): number {
  const f2 = frequency * frequency
  const f4 = f2 * f2
  const num = 12194 * 12194 * f4
  const den = (f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194)
  const aWeight = num / den
  return 20 * Math.log10(aWeight) + 2.0
}

function buildAWeightingTable(fftSize: number, sampleRate: number): Float32Array {
  const binCount = fftSize / 2
  const table = new Float32Array(binCount)
  for (let i = 0; i < binCount; i++) {
    const frequency = (i * sampleRate) / fftSize
    if (frequency < 20) table[i] = -50
    else if (frequency > 20000) table[i] = -20
    else table[i] = getAWeighting(frequency)
  }
  return table
}

interface EnvelopeConfig { attack: number; release: number }

const ENVELOPE_CONFIGS: Record<string, EnvelopeConfig> = {
  subBass:    { attack: 0.25, release: 0.015 },
  bass:       { attack: 0.30, release: 0.020 },
  lowMid:     { attack: 0.35, release: 0.040 },
  mid:        { attack: 0.40, release: 0.060 },
  highMid:    { attack: 0.45, release: 0.080 },
  treble:     { attack: 0.50, release: 0.100 },
  brilliance: { attack: 0.55, release: 0.120 },
  high:       { attack: 0.50, release: 0.100 },
  overall:    { attack: 0.35, release: 0.040 },
}

function envelopeFollow(current: number, target: number, config: EnvelopeConfig): number {
  if (target > current) return current + (target - current) * config.attack
  else return current + (target - current) * config.release
}

export interface AudioBands {
  bass: number; mid: number; high: number; overall: number
  bassSmooth: number; midSmooth: number; highSmooth: number; overallSmooth: number
  isBeat: boolean; beatIntensity: number
  subBass: number; lowMid: number; highMid: number; treble: number; brilliance: number
  subBassSmooth: number; lowMidSmooth: number; highMidSmooth: number
  trebleSmooth: number; brillianceSmooth: number
  bassPeak: number; midPeak: number; highPeak: number; overallPeak: number
  stereoBalance: number
  estimatedBPM: number
  energy: { peak: number; bass: number; lowMid: number; mid: number; highMid: number; treble: number }
  rms: number
  spectralFlux: number
  spectralCentroid: number
  energyTrend: number
  isOnset: boolean
  onsetIntensity: number
  rawSpectrum: Float32Array
}

export function createDefaultAudioBands(): AudioBands {
  return {
    bass: 0, mid: 0, high: 0, overall: 0,
    bassSmooth: 0, midSmooth: 0, highSmooth: 0, overallSmooth: 0,
    isBeat: false, beatIntensity: 0,
    subBass: 0, lowMid: 0, highMid: 0, treble: 0, brilliance: 0,
    subBassSmooth: 0, lowMidSmooth: 0, highMidSmooth: 0, trebleSmooth: 0, brillianceSmooth: 0,
    bassPeak: 0, midPeak: 0, highPeak: 0, overallPeak: 0,
    stereoBalance: 0, estimatedBPM: 0,
    energy: { peak: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 },
    rms: 0, spectralFlux: 0, spectralCentroid: 0, energyTrend: 0,
    isOnset: false, onsetIntensity: 0, rawSpectrum: new Float32Array(0),
  }
}

export type FrequencyScale = 'linear' | 'log' | 'bark' | 'mel'
export type WeightingFilter = '' | 'A' | 'B' | 'C' | 'D'

export interface AudioAnalyzerOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  useAWeighting?: boolean
  peakHoldTime?: number
  peakDecayRate?: number
  frequencyScale?: FrequencyScale
}

const DEFAULT_OPTIONS: Required<AudioAnalyzerOptions> = {
  fftSize: 2048, smoothingTimeConstant: 0.5, useAWeighting: true,
  peakHoldTime: 500, peakDecayRate: 0.95, frequencyScale: 'log'
}

export class AudioAnalyzer {
  analyser: AnalyserNode | null = null
  analyserRight: AnalyserNode | null = null
  dataArray: Uint8Array = new Uint8Array(1024)
  dataArrayRight: Uint8Array = new Uint8Array(1024)
  audioContext: AudioContext | null = null
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private splitter: ChannelSplitterNode | null = null
  private options: Required<AudioAnalyzerOptions>
  private aWeightingTable: Float32Array | null = null
  private sampleRate: number = 44100

  private envBass = 0; private envMid = 0; private envHigh = 0; private envOverall = 0
  private envSubBass = 0; private envLowMid = 0; private envHighMid = 0
  private envTreble = 0; private envBrilliance = 0

  private peakBass = 0; private peakMid = 0; private peakHigh = 0; private peakOverall = 0
  private peakHoldTimers = { bass: 0, mid: 0, high: 0, overall: 0 }

  private lastBeatTime = 0; private beatCooldown = 180
  private energyHistory: number[] = []; private historySize = 30
  private currentBeatIntensity = 0; private smoothedBeatIntensity = 0

  private beatTimestamps: number[] = []; private estimatedBPM = 0; private bpmHistorySize = 16
  private stereoBalance = 0

  private previousSpectrum: Float32Array | null = null
  private fluxHistory: number[] = []; private fluxHistorySize = 30
  private onsetCooldown = 80; private lastOnsetTime = 0
  private currentOnsetIntensity = 0; private smoothedOnsetIntensity = 0

  private smoothedCentroid = 0.5; private smoothedRMS = 0
  private trendHistory: number[] = []; private trendHistorySize = 180; private smoothedTrend = 0
  private rawSpectrumBuffer: Float32Array = new Float32Array(0)

  constructor(options: AudioAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async initMic(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    })
    this.audioContext = new AudioContext()
    this.sampleRate = this.audioContext.sampleRate
    this.aWeightingTable = buildAWeightingTable(this.options.fftSize, this.sampleRate)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.options.fftSize
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant
    this.splitter = this.audioContext.createChannelSplitter(2)
    this.analyserRight = this.audioContext.createAnalyser()
    this.analyserRight.fftSize = this.options.fftSize
    this.analyserRight.smoothingTimeConstant = this.options.smoothingTimeConstant
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.source.connect(this.splitter)
    this.splitter.connect(this.analyser, 0)
    this.splitter.connect(this.analyserRight, 1)
    const bc = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(bc)
    this.dataArrayRight = new Uint8Array(bc)
    this.previousSpectrum = new Float32Array(bc)
    this.rawSpectrumBuffer = new Float32Array(bc)
  }

  async initAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    this.audioContext = new AudioContext()
    this.sampleRate = this.audioContext.sampleRate
    this.aWeightingTable = buildAWeightingTable(this.options.fftSize, this.sampleRate)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.options.fftSize
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant
    this.source = this.audioContext.createMediaElementSource(audioElement)
    this.source.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    const bc = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(bc)
    this.previousSpectrum = new Float32Array(bc)
    this.rawSpectrumBuffer = new Float32Array(bc)
  }

  getFrequencyData(): Uint8Array {
    if (this.analyser) this.analyser.getByteFrequencyData(this.dataArray)
    return this.dataArray
  }

  private lerp(current: number, target: number, factor: number): number {
    return current + (target - current) * factor
  }

  private freqToBin(freq: number): number {
    return Math.round((freq * this.options.fftSize) / this.sampleRate)
  }

  private getAverageFrequency(startFreq: number, endFreq: number, applyWeighting = true): number {
    const data = this.dataArray
    const startBin = Math.max(0, this.freqToBin(startFreq))
    const endBin = Math.min(data.length - 1, this.freqToBin(endFreq))
    if (startBin >= endBin) return 0
    let sum = 0; let count = 0
    for (let i = startBin; i <= endBin; i++) {
      let value = data[i] / 255
      if (applyWeighting && this.options.useAWeighting && this.aWeightingTable) {
        const wl = Math.pow(10, this.aWeightingTable[i] / 20)
        value *= Math.min(2, Math.max(0.1, wl))
      }
      sum += value; count++
    }
    return count > 0 ? Math.min(1, sum / count) : 0
  }

  getEnergy(preset?: 'peak' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'treble'): number {
    this.getFrequencyData()
    switch (preset) {
      case 'bass': return this.getAverageFrequency(20, 250)
      case 'lowMid': return this.getAverageFrequency(250, 500)
      case 'mid': return this.getAverageFrequency(500, 2000)
      case 'highMid': return this.getAverageFrequency(2000, 4000)
      case 'treble': return this.getAverageFrequency(4000, 16000)
      default: { let m = 0; for (let i = 0; i < this.dataArray.length; i++) if (this.dataArray[i] > m) m = this.dataArray[i]; return m / 255 }
    }
  }

  private updatePeaks(bass: number, mid: number, high: number, overall: number): void {
    const now = performance.now(); const ht = this.options.peakHoldTime; const d = this.options.peakDecayRate
    if (bass >= this.peakBass) { this.peakBass = bass; this.peakHoldTimers.bass = now } else if (now - this.peakHoldTimers.bass > ht) this.peakBass *= d
    if (mid >= this.peakMid) { this.peakMid = mid; this.peakHoldTimers.mid = now } else if (now - this.peakHoldTimers.mid > ht) this.peakMid *= d
    if (high >= this.peakHigh) { this.peakHigh = high; this.peakHoldTimers.high = now } else if (now - this.peakHoldTimers.high > ht) this.peakHigh *= d
    if (overall >= this.peakOverall) { this.peakOverall = overall; this.peakHoldTimers.overall = now } else if (now - this.peakHoldTimers.overall > ht) this.peakOverall *= d
  }

  private updateStereoBalance(): void {
    if (!this.analyserRight) { this.stereoBalance = 0; return }
    this.analyserRight.getByteFrequencyData(this.dataArrayRight)
    let ls = 0; let rs = 0
    for (let i = 0; i < this.dataArray.length; i++) { ls += this.dataArray[i]; rs += this.dataArrayRight[i] }
    const total = ls + rs
    if (total > 0) this.stereoBalance = this.lerp(this.stereoBalance, (rs - ls) / total * 2, 0.15)
  }

  private updateBPMEstimate(isBeat: boolean): void {
    if (!isBeat) return
    const now = performance.now()
    this.beatTimestamps.push(now)
    while (this.beatTimestamps.length > this.bpmHistorySize) this.beatTimestamps.shift()
    if (this.beatTimestamps.length < 4) { this.estimatedBPM = 0; return }
    let tot = 0
    for (let i = 1; i < this.beatTimestamps.length; i++) tot += this.beatTimestamps[i] - this.beatTimestamps[i - 1]
    const avg = tot / (this.beatTimestamps.length - 1)
    if (avg > 0) { const bpm = 60000 / avg; if (bpm >= 60 && bpm <= 200) this.estimatedBPM = this.lerp(this.estimatedBPM, bpm, 0.1) }
  }

  private computeSpectralFlux(): number {
    const data = this.dataArray; const n = data.length
    if (!this.previousSpectrum || this.previousSpectrum.length !== n) this.previousSpectrum = new Float32Array(n)
    let flux = 0
    for (let i = 0; i < n; i++) {
      const c = data[i] / 255; this.rawSpectrumBuffer[i] = c
      const d = c - this.previousSpectrum[i]; if (d > 0) flux += d
      this.previousSpectrum[i] = c
    }
    return flux / n
  }

  private detectOnset(flux: number): { isOnset: boolean; intensity: number } {
    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > this.fluxHistorySize) this.fluxHistory.shift()
    if (this.fluxHistory.length < 5) return { isOnset: false, intensity: 0 }
    const avg = this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length
    const threshold = avg * 2.0 + 0.005
    const now = performance.now()
    if (flux > threshold && now - this.lastOnsetTime > this.onsetCooldown) {
      this.lastOnsetTime = now
      return { isOnset: true, intensity: Math.min(1.0, (flux - avg) / Math.max(0.01, avg)) }
    }
    return { isOnset: false, intensity: 0 }
  }

  private computeSpectralCentroid(): number {
    const data = this.dataArray; let ws = 0; let ms = 0
    for (let i = 1; i < data.length; i++) {
      const m = data[i] / 255; const f = (i * this.sampleRate) / this.options.fftSize
      ws += f * m; ms += m
    }
    if (ms < 0.001) return 0.5
    const cHz = ws / ms; const minL = Math.log(20); const maxL = Math.log(20000)
    return Math.max(0, Math.min(1, (Math.log(Math.max(20, cHz)) - minL) / (maxL - minL)))
  }

  private computeRMS(): number {
    const data = this.dataArray; let ss = 0
    for (let i = 0; i < data.length; i++) { const v = data[i] / 255; ss += v * v }
    return Math.sqrt(ss / data.length)
  }

  private computeEnergyTrend(energy: number): number {
    this.trendHistory.push(energy)
    if (this.trendHistory.length > this.trendHistorySize) this.trendHistory.shift()
    if (this.trendHistory.length < 30) return 0
    const rc = Math.min(30, Math.floor(this.trendHistory.length * 0.2))
    const oc = Math.min(90, Math.floor(this.trendHistory.length * 0.6))
    const len = this.trendHistory.length
    let rs = 0; for (let i = len - rc; i < len; i++) rs += this.trendHistory[i]
    const ra = rs / rc
    const os = Math.max(0, len - rc - oc); const oe = len - rc
    let oSum = 0; for (let i = os; i < oe; i++) oSum += this.trendHistory[i]
    const oa = oSum / Math.max(1, oe - os)
    if (oa < 0.001) return 0
    return Math.max(-1, Math.min(1, (ra / oa - 1) * 3))
  }

  getBands(): AudioBands {
    this.getFrequencyData()
    this.updateStereoBalance()

    const rawSubBass = this.getAverageFrequency(20, 60)
    const rawBass = this.getAverageFrequency(60, 250)
    const rawLowMid = this.getAverageFrequency(250, 500)
    const rawMid = this.getAverageFrequency(500, 2000)
    const rawHighMid = this.getAverageFrequency(2000, 4000)
    const rawTreble = this.getAverageFrequency(4000, 8000)
    const rawBrilliance = this.getAverageFrequency(8000, 20000)
    const rawHigh = this.getAverageFrequency(4000, 20000)
    const rawOverall = this.getAverageFrequency(20, 20000)

    this.envSubBass = envelopeFollow(this.envSubBass, rawSubBass, ENVELOPE_CONFIGS.subBass)
    this.envBass = envelopeFollow(this.envBass, rawBass, ENVELOPE_CONFIGS.bass)
    this.envLowMid = envelopeFollow(this.envLowMid, rawLowMid, ENVELOPE_CONFIGS.lowMid)
    this.envMid = envelopeFollow(this.envMid, rawMid, ENVELOPE_CONFIGS.mid)
    this.envHighMid = envelopeFollow(this.envHighMid, rawHighMid, ENVELOPE_CONFIGS.highMid)
    this.envTreble = envelopeFollow(this.envTreble, rawTreble, ENVELOPE_CONFIGS.treble)
    this.envBrilliance = envelopeFollow(this.envBrilliance, rawBrilliance, ENVELOPE_CONFIGS.brilliance)
    this.envHigh = envelopeFollow(this.envHigh, rawHigh, ENVELOPE_CONFIGS.high)
    this.envOverall = envelopeFollow(this.envOverall, rawOverall, ENVELOPE_CONFIGS.overall)

    this.updatePeaks(rawBass, rawMid, rawHigh, rawOverall)

    const spectralFlux = this.computeSpectralFlux()
    const onset = this.detectOnset(spectralFlux)
    if (onset.isOnset) this.currentOnsetIntensity = onset.intensity
    this.currentOnsetIntensity *= 0.88
    this.smoothedOnsetIntensity = this.lerp(this.smoothedOnsetIntensity, this.currentOnsetIntensity, 0.3)

    const rawCentroid = this.computeSpectralCentroid()
    this.smoothedCentroid = this.lerp(this.smoothedCentroid, rawCentroid, 0.08)
    const rawRMS = this.computeRMS()
    this.smoothedRMS = envelopeFollow(this.smoothedRMS, rawRMS, { attack: 0.3, release: 0.05 })
    const rawTrend = this.computeEnergyTrend(rawOverall)
    this.smoothedTrend = this.lerp(this.smoothedTrend, rawTrend, 0.05)

    const ce = rawSubBass * 2.0 + rawBass * 1.5 + rawMid * 0.5
    this.energyHistory.push(ce)
    if (this.energyHistory.length > this.historySize) this.energyHistory.shift()
    const ae = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const ev = this.energyHistory.reduce((s, e) => s + Math.pow(e - ae, 2), 0) / this.energyHistory.length
    const dt = ae + Math.sqrt(ev) * 1.4
    const now = performance.now()
    let isBeat = false
    if ((ce > dt && ce > 0.15 && now - this.lastBeatTime > this.beatCooldown) || onset.isOnset) {
      isBeat = true; this.lastBeatTime = now
      this.currentBeatIntensity = onset.isOnset
        ? Math.max(this.currentBeatIntensity, onset.intensity)
        : Math.min(1.0, (ce - ae) / 0.4)
    }
    this.updateBPMEstimate(isBeat)
    this.currentBeatIntensity *= 0.9
    this.smoothedBeatIntensity = this.lerp(this.smoothedBeatIntensity, this.currentBeatIntensity, 0.25)

    return {
      bass: rawBass, mid: rawMid, high: rawHigh, overall: rawOverall,
      bassSmooth: this.envBass, midSmooth: this.envMid, highSmooth: this.envHigh, overallSmooth: this.envOverall,
      isBeat, beatIntensity: this.smoothedBeatIntensity,
      subBass: rawSubBass, lowMid: rawLowMid, highMid: rawHighMid, treble: rawTreble, brilliance: rawBrilliance,
      subBassSmooth: this.envSubBass, lowMidSmooth: this.envLowMid, highMidSmooth: this.envHighMid,
      trebleSmooth: this.envTreble, brillianceSmooth: this.envBrilliance,
      bassPeak: this.peakBass, midPeak: this.peakMid, highPeak: this.peakHigh, overallPeak: this.peakOverall,
      stereoBalance: this.stereoBalance, estimatedBPM: Math.round(this.estimatedBPM),
      energy: { peak: Math.max(rawBass, rawMid, rawHigh), bass: rawBass, lowMid: rawLowMid, mid: rawMid, highMid: rawHighMid, treble: rawTreble },
      rms: this.smoothedRMS, spectralFlux, spectralCentroid: this.smoothedCentroid,
      energyTrend: this.smoothedTrend, isOnset: onset.isOnset, onsetIntensity: this.smoothedOnsetIntensity,
      rawSpectrum: this.rawSpectrumBuffer,
    }
  }

  disconnect(): void {
    if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null }
    if (this.source) { this.source.disconnect(); this.source = null }
    if (this.splitter) { this.splitter.disconnect(); this.splitter = null }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null }
    this.analyser = null; this.analyserRight = null
    this.envBass = 0; this.envMid = 0; this.envHigh = 0; this.envOverall = 0
    this.envSubBass = 0; this.envLowMid = 0; this.envHighMid = 0; this.envTreble = 0; this.envBrilliance = 0
    this.peakBass = 0; this.peakMid = 0; this.peakHigh = 0; this.peakOverall = 0
    this.energyHistory = []; this.beatTimestamps = []
    this.currentBeatIntensity = 0; this.smoothedBeatIntensity = 0; this.estimatedBPM = 0; this.stereoBalance = 0
    this.previousSpectrum = null; this.fluxHistory = []
    this.currentOnsetIntensity = 0; this.smoothedOnsetIntensity = 0
    this.smoothedCentroid = 0.5; this.smoothedRMS = 0; this.trendHistory = []; this.smoothedTrend = 0
  }
}
