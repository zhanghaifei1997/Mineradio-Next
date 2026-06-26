import type { BeatMap, BeatEvent, PulseBeat } from './types'

export class BeatMapData {
  private _beats: BeatEvent[] = []
  private _kicks: number[] = []
  private _pulseBeats: PulseBeat[] = []
  private _cameraBeats: BeatEvent[] = []
  private _gridStep = 0.5
  private _sectionSteps: number[] = []
  private _tempoSource = 'unknown'
  private _duration = 0
  private _visualBeatCount = 0
  private _analyzedAt = 0
  private _nextBeatIndex = 0
  private _partial = false
  private _partialUntilSec = 0
  private _fullDuration = 0

  get beats(): BeatEvent[] { return this._beats }
  get kicks(): number[] { return this._kicks }
  get pulseBeats(): PulseBeat[] { return this._pulseBeats }
  get cameraBeats(): BeatEvent[] { return this._cameraBeats }
  get gridStep(): number { return this._gridStep }
  get sectionSteps(): number[] { return this._sectionSteps }
  get tempoSource(): string { return this._tempoSource }
  get duration(): number { return this._duration }
  get visualBeatCount(): number { return this._visualBeatCount }
  get analyzedAt(): number { return this._analyzedAt }
  get partial(): boolean { return this._partial }
  get partialUntilSec(): number { return this._partialUntilSec }
  get fullDuration(): number { return this._fullDuration }
  get nextBeatIndex(): number { return this._nextBeatIndex }

  get bpm(): number {
    return this._gridStep > 0 ? 60 / this._gridStep : 0
  }

  static fromBeatMap(map: BeatMap): BeatMapData {
    const beatMap = new BeatMapData()
    beatMap.loadBeatMap(map)
    return beatMap
  }

  loadBeatMap(map: BeatMap): void {
    this._beats = map.beats || []
    this._kicks = map.kicks || []
    this._pulseBeats = map.pulseBeats || []
    this._cameraBeats = map.cameraBeats || []
    this._gridStep = map.gridStep || 0.5
    this._sectionSteps = map.sectionSteps || []
    this._tempoSource = map.tempoSource || 'unknown'
    this._duration = map.duration || 0
    this._visualBeatCount = map.visualBeatCount || 0
    this._analyzedAt = map.analyzedAt || Date.now()
    this._partial = map.partial || false
    this._partialUntilSec = map.partialUntilSec || 0
    this._fullDuration = map.fullDuration || 0
    this._nextBeatIndex = 0
  }

  toBeatMap(): BeatMap {
    return {
      kicks: this._kicks,
      beats: this._beats,
      pulseBeats: this._pulseBeats,
      cameraBeats: this._cameraBeats,
      gridStep: this._gridStep,
      sectionSteps: this._sectionSteps,
      tempoSource: this._tempoSource,
      duration: this._duration,
      visualBeatCount: this._visualBeatCount,
      analyzedAt: this._analyzedAt,
      partial: this._partial,
      partialUntilSec: this._partialUntilSec,
      fullDuration: this._fullDuration,
    }
  }

  getBeatsInRange(startTime: number, endTime: number): BeatEvent[] {
    const result: BeatEvent[] = []
    for (const beat of this._beats) {
      if (beat.time >= startTime && beat.time <= endTime) {
        result.push(beat)
      }
      if (beat.time > endTime) break
    }
    return result
  }

  getNextBeat(currentTime: number): BeatEvent | null {
    while (this._nextBeatIndex < this._beats.length && this._beats[this._nextBeatIndex].time < currentTime) {
      this._nextBeatIndex++
    }
    return this._nextBeatIndex < this._beats.length ? this._beats[this._nextBeatIndex] : null
  }

  getPreviousBeat(currentTime: number): BeatEvent | null {
    let idx = Math.min(this._nextBeatIndex, this._beats.length - 1)
    while (idx > 0 && this._beats[idx].time > currentTime) {
      idx--
    }
    return idx >= 0 && this._beats[idx].time <= currentTime ? this._beats[idx] : null
  }

  getBeatProgress(currentTime: number): number {
    const prev = this.getPreviousBeat(currentTime)
    const next = this.getNextBeat(currentTime)
    if (!prev || !next || next.time === prev.time) return 0
    return (currentTime - prev.time) / (next.time - prev.time)
  }

  resetCursor(): void {
    this._nextBeatIndex = 0
  }

  seekTo(time: number): void {
    this._nextBeatIndex = 0
    while (this._nextBeatIndex < this._beats.length && this._beats[this._nextBeatIndex].time < time) {
      this._nextBeatIndex++
    }
  }

  isEmpty(): boolean {
    return this._beats.length === 0
  }

  clear(): void {
    this._beats = []
    this._kicks = []
    this._pulseBeats = []
    this._cameraBeats = []
    this._gridStep = 0.5
    this._sectionSteps = []
    this._tempoSource = 'unknown'
    this._duration = 0
    this._visualBeatCount = 0
    this._analyzedAt = 0
    this._nextBeatIndex = 0
    this._partial = false
    this._partialUntilSec = 0
    this._fullDuration = 0
  }
}
