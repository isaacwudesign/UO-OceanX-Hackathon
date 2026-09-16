/**
 * Specs always Mix-to-Snap and still records the mics. Speakers next to those
 * mics are the echo in phone footage.
 *
 * Voice-overs: mute headset on device; recordingVolume carries the Snap mix.
 * Short SFX: Mix-to-Snap follows volume on these clips, so keep volume at 1
 * or they go missing / whisper-quiet in the recording.
 */

type MixAudio = AudioComponent & {
  mixToSnap: boolean
  recordingVolume: number
}

let snapRecording = false
let muteHeadsetOnDevice = true
const tracked: AudioComponent[] = []
const sfxClips: AudioComponent[] = []
const headsetVolume = new Map<AudioComponent, number>()

export function setMuteHeadsetOnDevice(enabled: boolean): void {
  muteHeadsetOnDevice = enabled
}

export function bindSnapCaptureMute(script: BaseScriptComponent): void {
  script.createEvent("SnapRecordStartEvent").bind(() => {
    snapRecording = true
    applySpeakerGainToTracked()
    print("[SnapAudio] capture started — VO speakers muted, SFX stay mixed")
  })
  script.createEvent("SnapRecordStopEvent").bind(() => {
    snapRecording = false
    applySpeakerGainToTracked()
    print("[SnapAudio] capture stopped — speakers restored")
  })
}

export function speakerGain(volume: number): number {
  if (snapRecording) {
    return 0
  }
  if (muteHeadsetOnDevice && !global.deviceInfoSystem.isEditor()) {
    return 0
  }
  return volume
}

export function applyPlayMix(audio: AudioComponent, volume: number): void {
  if (!audio) {
    return
  }
  track(audio)
  headsetVolume.set(audio, volume)
  const mix = audio as MixAudio
  mix.mixToSnap = true
  mix.volume = speakerGain(volume)
  mix.recordingVolume = 1
}

/** One-shots. Do not mute volume — Specs records these from volume, not recordingVolume. */
export function applySfxMix(audio: AudioComponent, volume: number): void {
  if (!audio) {
    return
  }
  track(audio)
  markSfx(audio)
  const mixLevel = volume > 0 ? volume : 1
  headsetVolume.set(audio, mixLevel)
  const mix = audio as MixAudio
  mix.mixToSnap = true
  mix.volume = mixLevel
  mix.recordingVolume = 1
}

/**
 * Looping bed. Keep speakers on (not VO-muted) and match Snap mix to the same level.
 */
export function applyAmbientMix(audio: AudioComponent, volume: number): void {
  if (!audio) {
    return
  }
  track(audio)
  markSfx(audio)
  const mixLevel = volume > 0 ? volume : 0.5
  headsetVolume.set(audio, mixLevel)
  const mix = audio as MixAudio
  mix.mixToSnap = true
  mix.volume = mixLevel
  mix.recordingVolume = mixLevel
}

export function applyMuteMix(audio: AudioComponent): void {
  if (!audio) {
    return
  }
  const mix = audio as MixAudio
  mix.volume = 0
  mix.recordingVolume = 0
}

export function enableMixToSnap(audio: AudioComponent): void {
  if (!audio) {
    return
  }
  ;(audio as MixAudio).mixToSnap = true
}

function markSfx(audio: AudioComponent): void {
  for (let i = 0; i < sfxClips.length; i++) {
    if (sfxClips[i] === audio) {
      return
    }
  }
  sfxClips.push(audio)
}

function isSfx(audio: AudioComponent): boolean {
  for (let i = 0; i < sfxClips.length; i++) {
    if (sfxClips[i] === audio) {
      return true
    }
  }
  return false
}

function track(audio: AudioComponent): void {
  for (let i = 0; i < tracked.length; i++) {
    if (tracked[i] === audio) {
      return
    }
  }
  tracked.push(audio)
}

function applySpeakerGainToTracked(): void {
  for (let i = 0; i < tracked.length; i++) {
    const audio = tracked[i]
    if (!audio) {
      continue
    }
    const mix = audio as MixAudio
    if (mix.recordingVolume <= 0) {
      mix.volume = 0
      continue
    }
    const cached = headsetVolume.get(audio)
    if (isSfx(audio)) {
      mix.volume = cached !== undefined ? cached : 1
      continue
    }
    mix.volume = speakerGain(cached !== undefined ? cached : 0.5)
  }
}
