/**
 * Specs writes the lens mix into the video and also records the mics.
 * The speakers sit next to those mics, so anything played out loud shows up
 * again in the video, muffled and late.
 *
 * volume is the glasses speakers. recordingVolume is the clear mix in the file.
 * While a capture is running, every clip keeps its recordingVolume and the
 * speakers go to 0, so the video only has the experience audio.
 */

type MixAudio = AudioComponent & {
  mixToSnap: boolean
  recordingVolume: number
}

let snapRecording = false
const tracked: AudioComponent[] = []
const sfxClips: AudioComponent[] = []
const headsetVolume = new Map<AudioComponent, number>()

type HeldSpeaker = {
  volume: number
  recordingVolume: number
}
const heldSpeakers = new Map<AudioComponent, HeldSpeaker>()

export function bindSnapCaptureMute(script: BaseScriptComponent): void {
  script.createEvent("SnapRecordStartEvent").bind(() => {
    snapRecording = true
    holdSpeakersForCapture(script)
    applySpeakerGainToTracked()
    print("[SnapAudio] capture started — speakers off, mix stays in the recording")
  })
  script.createEvent("SnapRecordStopEvent").bind(() => {
    snapRecording = false
    releaseHeldSpeakers()
    applySpeakerGainToTracked()
    print("[SnapAudio] capture stopped — speakers restored")
  })
}

export function speakerGain(volume: number): number {
  if (snapRecording) {
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

/** One-shots. recordingVolume carries the file. Speakers use volume, and go quiet during a capture. */
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
  mix.recordingVolume = Math.min(1, mixLevel)
  mix.volume = liveSpeakerLevel(audio, mixLevel)
}

/**
 * Play an SFX into the recording even while the speakers are muted.
 * A clip started at volume 0 never enters the Spectacles file.
 * Speakers are silenced again immediately after play() during a capture.
 */
export function playCapturedSfx(audio: AudioComponent, loops: number, speakerVolume: number): void {
  if (!audio) {
    return
  }
  const mixLevel = speakerVolume > 0 ? speakerVolume : 1
  track(audio)
  markSfx(audio)
  headsetVolume.set(audio, mixLevel)
  const mix = audio as MixAudio
  mix.mixToSnap = true
  mix.recordingVolume = Math.min(1, mixLevel)
  const playing = audio.isPlaying()
  if (!playing) {
    mix.volume = mixLevel
    audio.play(loops)
    if (snapRecording) {
      mix.volume = 0
    }
    return
  }
  if (!snapRecording) {
    mix.volume = mixLevel
  }
}

/** Same arming rule for voice-over. Live speaker level is unchanged after this returns. */
export function playCapturedVoice(audio: AudioComponent, speakerVolume: number): void {
  if (!audio) {
    return
  }
  const level = speakerVolume > 0 ? speakerVolume : 1
  track(audio)
  headsetVolume.set(audio, level)
  const mix = audio as MixAudio
  mix.mixToSnap = true
  mix.recordingVolume = 1
  mix.volume = level
  audio.play(1)
  if (snapRecording) {
    mix.volume = 0
  }
}

export function isSnapRecording(): boolean {
  return snapRecording
}

/**
 * Looping bed. Same level in the recording mix. Speakers go quiet during a capture.
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
  mix.recordingVolume = mixLevel
  mix.volume = liveSpeakerLevel(audio, mixLevel)
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

function liveSpeakerLevel(audio: AudioComponent, level: number): number {
  if (snapRecording) {
    return 0
  }
  if (isSfx(audio)) {
    return level
  }
  return speakerGain(level)
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
    const level = cached !== undefined ? cached : 0.5
    mix.volume = liveSpeakerLevel(audio, level)
  }
}

function holdSpeakersForCapture(host: BaseScriptComponent): void {
  const visit = (audio: AudioComponent): void => {
    if (!audio || heldSpeakers.has(audio)) {
      return
    }
    const mix = audio as MixAudio
    const volume = mix.volume
    const recordingVolume = mix.recordingVolume
    if (volume <= 0 && recordingVolume <= 0) {
      return
    }
    heldSpeakers.set(audio, {volume: volume, recordingVolume: recordingVolume})
    mix.mixToSnap = true
    if (recordingVolume <= 0 && volume > 0) {
      mix.recordingVolume = volume
    }
    mix.volume = 0
  }
  walkAudio(host, visit)
}

function releaseHeldSpeakers(): void {
  const entries: {audio: AudioComponent; saved: HeldSpeaker}[] = []
  heldSpeakers.forEach((saved, audio) => {
    entries.push({audio: audio, saved: saved})
  })
  heldSpeakers.clear()
  for (let i = 0; i < entries.length; i++) {
    const audio = entries[i].audio
    const saved = entries[i].saved
    if (!audio) {
      continue
    }
    const mix = audio as MixAudio
    if (mix.recordingVolume <= 0) {
      mix.volume = 0
      continue
    }
    mix.recordingVolume = saved.recordingVolume > 0 ? saved.recordingVolume : mix.recordingVolume
    if (headsetVolume.has(audio)) {
      continue
    }
    mix.volume = saved.volume
  }
}

function walkAudio(host: BaseScriptComponent, visit: (audio: AudioComponent) => void): void {
  const scene = global.scene as unknown as {
    getRootObjectsCount?: () => number
    getRootObject?: (index: number) => SceneObject
  }
  if (scene.getRootObjectsCount && scene.getRootObject) {
    const count = scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      walkAudioTree(scene.getRootObject(i), visit)
    }
    return
  }
  let root = host.getSceneObject()
  let parent = root.getParent()
  while (parent) {
    root = parent
    parent = root.getParent()
  }
  walkAudioTree(root, visit)
}

function walkAudioTree(obj: SceneObject, visit: (audio: AudioComponent) => void): void {
  if (!obj) {
    return
  }
  const audio = obj.getComponent("Component.AudioComponent") as AudioComponent
  if (audio) {
    visit(audio)
  }
  const count = obj.getChildrenCount()
  for (let i = 0; i < count; i++) {
    walkAudioTree(obj.getChild(i), visit)
  }
}
