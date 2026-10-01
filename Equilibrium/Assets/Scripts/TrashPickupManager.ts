/**
 * Plastic-pollution beat: pinch a piece, carry it into the Bin, then it fades out.
 * A low toss into the bin still counts. Letting go above the opening drops in too.
 * A miss returns the piece to the water. Kinematic only. Locked until Explain ends.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {applyMuteMix, applyPlayMix, playCapturedSfx, playCapturedVoice} from "./SnapAudio"

const PIECE_PREFIXES = ["Trash_Bottle", "Trash_Can"]
const BIN_NAME = "Bin"
/** Capture radius as a multiple of the bin's world scale. */
const BIN_REACH = 2
/** How many capture-radii above the bin center still count as a drop into the mouth. */
const BIN_DROP_HEIGHT = 3
const FADE_TIME = 0.45
const RETURN_TIME = 0.35
/** Mix-to-Snap treats SFX volume as the Snap level. 1 is still quieter than VO. */
const PICK_SFX_GAIN = 4

interface TrashFloatState {
  piece: SceneObject
  transform: Transform
  restPos: vec3
  restRot: quat
  phase: number
  bobFreq: number
  rockFreq: number
  yawFreq: number
}

interface TrashFade {
  piece: SceneObject
  transform: Transform
  age: number
  startScale: vec3
  startPos: vec3
}

interface TrashReturn {
  state: TrashFloatState
  age: number
  startPos: vec3
  startRot: quat
}

@component
export class TrashPickupManager extends BaseScriptComponent {
  @ui.group_start("Audio")
  @input
  @hint("TrashIssueExplain on the scene root. Do not stop()/pause().")
  explainAudio: AudioComponent

  @input
  @hint("TrashIssueSolveVO on the scene root. Plays after all pieces are collected.")
  solveAudio: AudioComponent

  @input
  @hint("Drag the hierarchy Task_Done_SFX Audio component here.")
  pickSfx: AudioComponent

  @input
  @allowUndefined
  @hint("Task_Done_SFX.mp3 — assigned onto pickSfx at runtime (one 2D voice).")
  pickSfxTrack: AudioTrackAsset
  @ui.group_end

  @ui.group_start("Frames")
  @input
  @allowUndefined
  @hint("Trash facts frame, hidden after Solve VO finishes")
  factsFrame: SceneObject

  @input
  @allowUndefined
  @hint("Trash knowledge frame, hidden after Solve VO finishes")
  knowledgeFrame: SceneObject
  @ui.group_end

  @ui.group_start("Surface Float")
  @input
  @hint("Gentle bob and rock so trash reads as floating on the water.")
  floatOnSurface: boolean = true

  @input
  @hint("Local-Y bob height. 4–8 is a small ripple on this tank scale.")
  @widget(new SliderWidget(0, 20, 0.5))
  bobHeight: number = 5

  @input
  @hint("Pitch/roll in degrees. Keep under ~12 so pinch still feels stable.")
  @widget(new SliderWidget(0, 20, 0.5))
  rockAngle: number = 7

  @input
  @hint("How fast the surface motion cycles, in waves per second.")
  @widget(new SliderWidget(0.1, 1.5, 0.05))
  floatSpeed: number = 0.4
  @ui.group_end

  private pieces: SceneObject[] = []
  private floatStates: TrashFloatState[] = []
  private pickedIds = new Set<string>()
  private heldIds = new Set<string>()
  private fades: TrashFade[] = []
  private returns: TrashReturn[] = []
  private bin: SceneObject | null = null
  private explainFinished = false
  private started = false
  private solved = false
  private bound = false
  private onExplainFinishedCallback: (() => void) | null = null
  private onCollectedCallback: (() => void) | null = null
  private onSolveFinishedCallback: (() => void) | null = null
  private headsetVolume = new Map<AudioComponent, number>()
  private pickVoices: AudioComponent[] = []
  private pickVoiceCursor = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this))
  }

  private onStart(): void {
    this.collectPieces()
    this.findBin()
    this.preparePieces()
    this.cacheHeadsetVolume(this.explainAudio)
    this.cacheHeadsetVolume(this.solveAudio)
    this.cacheHeadsetVolume(this.pickSfx)
    this.preparePickVoices()
    this.setInteractionLocked(true)
  }

  /** SceneManager shows trash billboard copy after Explain ends. */
  public setOnExplainFinished(callback: () => void): void {
    this.onExplainFinishedCallback = callback
  }

  /** SceneManager hides the trash title when the last piece is collected. */
  public setOnCollected(callback: () => void): void {
    this.onCollectedCallback = callback
  }

  /** SceneManager starts overfishing after TrashIssueSolveVO finishes. */
  public setOnSolveFinished(callback: () => void): void {
    this.onSolveFinishedCallback = callback
  }

  /** Drop Mix-to-Snap tails before OverfishingIssueExplain. */
  public muteSolveAudio(): void {
    if (this.explainAudio) {
      this.muteAudio(this.explainAudio)
    }
    if (this.solveAudio) {
      this.muteAudio(this.solveAudio)
    }
  }

  /** Called by SceneManager after temperature Solve VO finishes. */
  public begin(): void {
    if (this.started) {
      return
    }
    this.started = true
    this.collectPieces()
    this.findBin()
    this.preparePieces()
    this.preparePickVoices()
    this.pickedIds.clear()
    this.heldIds.clear()
    this.fades = []
    this.returns = []
    this.explainFinished = false
    this.solved = false
    this.setInteractionLocked(true)
    this.setFramesVisible(true)

    if (this.explainAudio) {
      this.explainAudio.setOnFinish(this.onExplainFinished.bind(this))
    }
    if (this.solveAudio) {
      this.solveAudio.setOnFinish(this.onSolveFinished.bind(this))
    }

    if (!this.explainAudio) {
      print("TrashPickupManager: explainAudio is not assigned")
      this.onExplainFinished()
      return
    }
    if (!this.pickSfx) {
      print("TrashPickupManager: drag Task_Done_SFX onto pickSfx")
    }

    this.armAudio(this.explainAudio)
    playCapturedVoice(this.explainAudio, 1)
  }

  private applyPickSfxTrack(): void {
    if (!this.pickSfx || !this.pickSfxTrack) {
      return
    }
    this.pickSfx.audioTrack = this.pickSfxTrack
  }

  /** Mix-to-Snap only records a new hit on a free AudioComponent. */
  private preparePickVoices(): void {
    this.applyPickSfxTrack()
    if (!this.pickSfx || this.pickVoices.length > 0) {
      return
    }
    this.pickVoices.push(this.pickSfx)
    for (let i = 2; i <= 8; i++) {
      const extra = this.cloneSfxVoice(this.pickSfx, "Task_Done_SFX_Voice" + i)
      if (extra) {
        this.pickVoices.push(extra)
      }
    }
  }

  private cloneSfxVoice(source: AudioComponent, name: string): AudioComponent | null {
    if (!source) {
      return null
    }
    const owner = global.scene.createSceneObject(name)
    const parent = source.getSceneObject()
    if (parent) {
      owner.setParent(parent.getParent())
    }
    const audio = owner.createComponent(
      "Component.AudioComponent"
    ) as AudioComponent
    audio.audioTrack = source.audioTrack
    this.headsetVolume.set(audio, 1)
    this.armSfx(audio)
    return audio
  }

  private armSfx(audio: AudioComponent): void {
    audio.enabled = true
    const owner = audio.getSceneObject()
    if (owner) {
      owner.enabled = true
    }
    audio.playbackMode = Audio.PlaybackMode.LowLatency
  }

  private onExplainFinished(): void {
    if (!this.started || this.solved) {
      return
    }
    this.explainFinished = true
    this.setInteractionLocked(false)
    if (this.onExplainFinishedCallback) {
      this.onExplainFinishedCallback()
    }
  }

  private onSolveFinished(): void {
    if (this.solveAudio) {
      this.muteAudio(this.solveAudio)
    }
    this.setFramesVisible(false)
    if (this.onSolveFinishedCallback) {
      this.onSolveFinishedCallback()
    }
  }

  private collectPieces(): void {
    this.pieces = []
    this.collectPiecesRecursive(this.getSceneObject())
  }

  private collectPiecesRecursive(root: SceneObject): void {
    if (this.isTrashPieceName(root.name)) {
      this.pieces.push(root)
    }
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      this.collectPiecesRecursive(root.getChild(i))
    }
  }

  private isTrashPieceName(name: string): boolean {
    for (let i = 0; i < PIECE_PREFIXES.length; i++) {
      if (name.indexOf(PIECE_PREFIXES[i]) === 0) {
        return true
      }
    }
    return false
  }

  private preparePieces(): void {
    if (this.bound) {
      return
    }
    this.bound = true
    this.floatStates = []
    for (let i = 0; i < this.pieces.length; i++) {
      this.preparePiece(this.pieces[i], i)
    }
  }

  private preparePiece(piece: SceneObject, index: number): void {
    const interactable = piece.getComponent(
      Interactable.getTypeName()
    ) as Interactable
    const manipulation = piece.getComponent(
      InteractableManipulation.getTypeName()
    ) as InteractableManipulation

    if (interactable) {
      interactable.targetingMode = 1
    }
    if (manipulation) {
      manipulation.onManipulationStart.add(() => {
        this.onGrab(piece)
      })
      manipulation.onManipulationEnd.add(() => {
        this.onRelease(piece)
      })
    }

    const transform = piece.getTransform()
    const restPos = transform.getLocalPosition()
    const restRot = transform.getLocalRotation()
    this.floatStates.push({
      piece: piece,
      transform: transform,
      restPos: new vec3(restPos.x, restPos.y, restPos.z),
      restRot: new quat(restRot.w, restRot.x, restRot.y, restRot.z),
      phase: index * 1.73,
      bobFreq: 0.85 + (index % 3) * 0.12,
      rockFreq: 0.7 + (index % 4) * 0.11,
      yawFreq: 0.28 + (index % 5) * 0.05,
    })
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    this.updateFades(dt)
    this.updateReturns(dt)
    this.checkHeldInBin()

    if (!this.floatOnSurface || !this.started || this.solved) {
      return
    }

    const t = getTime()
    const speed = this.floatSpeed
    const bobHeight = this.bobHeight
    const rockRad = this.rockAngle * MathUtils.DegToRad

    for (let i = 0; i < this.floatStates.length; i++) {
      const state = this.floatStates[i]
      const piece = state.piece
      const id = piece.uniqueIdentifier
      if (
        !piece.enabled ||
        this.pickedIds.has(id) ||
        this.heldIds.has(id) ||
        this.isReturning(id)
      ) {
        continue
      }

      const bob = Math.sin(t * speed * state.bobFreq * Math.PI * 2 + state.phase) * bobHeight
      const pitch =
        Math.sin(t * speed * state.rockFreq * Math.PI * 2 + state.phase) * rockRad
      const roll =
        Math.cos(t * speed * state.rockFreq * 0.92 * Math.PI * 2 + state.phase * 1.3) *
        rockRad
      const yaw =
        Math.sin(t * speed * state.yawFreq * Math.PI * 2 + state.phase * 0.6) *
        rockRad *
        0.35

      state.transform.setLocalPosition(
        new vec3(state.restPos.x, state.restPos.y + bob, state.restPos.z)
      )
      const rock = quat.fromEulerAngles(pitch, yaw, roll)
      state.transform.setLocalRotation(rock.multiply(state.restRot))
    }
  }

  private onGrab(piece: SceneObject): void {
    if (!this.explainFinished || this.solved) {
      return
    }
    const id = piece.uniqueIdentifier
    if (this.pickedIds.has(id)) {
      return
    }
    this.heldIds.add(id)
    this.cancelReturn(id)
  }

  private onRelease(piece: SceneObject): void {
    const id = piece.uniqueIdentifier
    this.heldIds.delete(id)
    if (!this.explainFinished || this.solved || this.pickedIds.has(id)) {
      return
    }
    if (this.isInsideBin(piece) || this.isAboveBin(piece)) {
      this.beginFade(piece)
      return
    }
    this.beginReturn(piece)
  }

  /** Deposit as soon as a held piece reaches the bin, before the pinch lets go. */
  private checkHeldInBin(): void {
    if (!this.explainFinished || this.solved) {
      return
    }
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i]
      const id = piece.uniqueIdentifier
      if (!this.heldIds.has(id) || this.pickedIds.has(id)) {
        continue
      }
      if (this.isInsideBin(piece)) {
        this.beginFade(piece)
      }
    }
  }

  private beginFade(piece: SceneObject): void {
    const id = piece.uniqueIdentifier
    if (this.pickedIds.has(id)) {
      return
    }
    this.pickedIds.add(id)
    this.heldIds.delete(id)
    this.cancelReturn(id)

    const manipulation = piece.getComponent(
      InteractableManipulation.getTypeName()
    ) as InteractableManipulation
    const interactable = piece.getComponent(
      Interactable.getTypeName()
    ) as Interactable
    if (manipulation) {
      manipulation.enabled = false
    }
    if (interactable) {
      interactable.enabled = false
    }

    const transform = piece.getTransform()
    const scale = transform.getLocalScale()
    const pos = transform.getWorldPosition()
    this.fades.push({
      piece: piece,
      transform: transform,
      age: 0,
      startScale: new vec3(scale.x, scale.y, scale.z),
      startPos: new vec3(pos.x, pos.y, pos.z),
    })
    this.playPickSfx()
    if (this.pickedIds.size >= this.pieces.length) {
      this.onAllCollected()
    }
  }

  private updateFades(dt: number): void {
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const fade = this.fades[i]
      fade.age += dt
      const u = fade.age / FADE_TIME
      const eased = u >= 1 ? 1 : u * u
      const binPos = this.binWorldPosition()
      fade.transform.setWorldPosition(vec3.lerp(fade.startPos, binPos, eased))
      const remain = 1 - eased
      fade.transform.setLocalScale(
        new vec3(
          fade.startScale.x * remain,
          fade.startScale.y * remain,
          fade.startScale.z * remain
        )
      )
      if (u >= 1) {
        fade.piece.enabled = false
        this.fades.splice(i, 1)
      }
    }
  }

  private beginReturn(piece: SceneObject): void {
    const state = this.floatStateFor(piece)
    if (!state) {
      return
    }
    const id = piece.uniqueIdentifier
    this.cancelReturn(id)
    const pos = state.transform.getLocalPosition()
    const rot = state.transform.getLocalRotation()
    this.returns.push({
      state: state,
      age: 0,
      startPos: new vec3(pos.x, pos.y, pos.z),
      startRot: new quat(rot.w, rot.x, rot.y, rot.z),
    })
  }

  private updateReturns(dt: number): void {
    for (let i = this.returns.length - 1; i >= 0; i--) {
      const trip = this.returns[i]
      const id = trip.state.piece.uniqueIdentifier
      if (this.heldIds.has(id) || this.pickedIds.has(id)) {
        this.returns.splice(i, 1)
        continue
      }
      trip.age += dt
      const u = trip.age / RETURN_TIME
      const eased = u >= 1 ? 1 : u * u * (3 - 2 * u)
      trip.state.transform.setLocalPosition(vec3.lerp(trip.startPos, trip.state.restPos, eased))
      trip.state.transform.setLocalRotation(quat.slerp(trip.startRot, trip.state.restRot, eased))
      if (u >= 1) {
        this.returns.splice(i, 1)
      }
    }
  }

  private isInsideBin(piece: SceneObject): boolean {
    const sample = this.binSample(piece)
    if (!sample) {
      return false
    }
    return (
      sample.dx * sample.dx + sample.dy * sample.dy + sample.dz * sample.dz <=
      sample.reach * sample.reach
    )
  }

  /** Release over the mouth, above the close-in sphere. Still holding does not steal it. */
  private isAboveBin(piece: SceneObject): boolean {
    const sample = this.binSample(piece)
    if (!sample) {
      return false
    }
    const flat = sample.dx * sample.dx + sample.dz * sample.dz
    const dropTop = sample.reach * BIN_DROP_HEIGHT
    return flat <= sample.reach * sample.reach && sample.dy > 0 && sample.dy <= dropTop
  }

  private binSample(piece: SceneObject): {
    dx: number
    dy: number
    dz: number
    reach: number
  } | null {
    if (!this.bin) {
      this.findBin()
    }
    if (!this.bin) {
      return null
    }
    const binPos = this.bin.getTransform().getWorldPosition()
    const trashPos = piece.getTransform().getWorldPosition()
    const scale = this.bin.getTransform().getWorldScale()
    const reach = Math.max(scale.x, Math.max(scale.y, scale.z)) * BIN_REACH
    return {
      dx: trashPos.x - binPos.x,
      dy: trashPos.y - binPos.y,
      dz: trashPos.z - binPos.z,
      reach: reach,
    }
  }

  private binWorldPosition(): vec3 {
    if (!this.bin) {
      return vec3.zero()
    }
    return this.bin.getTransform().getWorldPosition()
  }

  private findBin(): void {
    if (this.bin) {
      return
    }
    this.bin = this.findNamed(this.getSceneObject(), BIN_NAME)
    if (this.bin) {
      return
    }
    const count = global.scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      const found = this.findNamed(global.scene.getRootObject(i), BIN_NAME)
      if (found) {
        this.bin = found
        return
      }
    }
    print("TrashPickupManager: Bin not found")
  }

  private findNamed(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) {
      return root
    }
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const found = this.findNamed(root.getChild(i), name)
      if (found) {
        return found
      }
    }
    return null
  }

  private floatStateFor(piece: SceneObject): TrashFloatState | null {
    const id = piece.uniqueIdentifier
    for (let i = 0; i < this.floatStates.length; i++) {
      if (this.floatStates[i].piece.uniqueIdentifier === id) {
        return this.floatStates[i]
      }
    }
    return null
  }

  private isReturning(id: string): boolean {
    for (let i = 0; i < this.returns.length; i++) {
      if (this.returns[i].state.piece.uniqueIdentifier === id) {
        return true
      }
    }
    return false
  }

  private cancelReturn(id: string): void {
    for (let i = this.returns.length - 1; i >= 0; i--) {
      if (this.returns[i].state.piece.uniqueIdentifier === id) {
        this.returns.splice(i, 1)
      }
    }
  }

  private onAllCollected(): void {
    if (this.solved) {
      return
    }
    if (this.onCollectedCallback) {
      this.onCollectedCallback()
    }
    this.solved = true
    this.setInteractionLocked(true)
    if (this.explainAudio) {
      this.muteAudio(this.explainAudio)
    }
    if (!this.solveAudio) {
      this.onSolveFinished()
      return
    }
    const delay = this.createEvent("DelayedCallbackEvent")
    delay.bind(() => {
      if (!this.solved) {
        return
      }
      this.armAudio(this.solveAudio)
      playCapturedVoice(this.solveAudio, 1)
    })
    delay.reset(1)
  }

  private armAudio(audio: AudioComponent): void {
    audio.enabled = true
    const owner = audio.getSceneObject()
    if (owner) {
      owner.enabled = true
    }
    applyPlayMix(audio, 1)
    audio.playbackMode = Audio.PlaybackMode.LowLatency
  }

  private muteAudio(audio: AudioComponent): void {
    applyMuteMix(audio)
    audio.enabled = false
  }

  private cacheHeadsetVolume(audio: AudioComponent): void {
    if (!audio || this.headsetVolume.has(audio)) {
      return
    }
    const volume = audio.volume
    this.headsetVolume.set(audio, volume > 0 ? volume : 0.5)
  }

  private playbackVolume(audio: AudioComponent): number {
    this.cacheHeadsetVolume(audio)
    const volume = this.headsetVolume.get(audio)
    return volume !== undefined ? volume : 0.5
  }

  private playPickSfx(): void {
    this.preparePickVoices()
    const audio = this.nextFreeVoice(this.pickVoices, this.pickVoiceCursor)
    if (!audio) {
      return
    }
    this.pickVoiceCursor = audio.next
    this.armSfx(audio.component)
    playCapturedSfx(audio.component, 1, PICK_SFX_GAIN)
  }

  private nextFreeVoice(
    voices: AudioComponent[],
    cursor: number
  ): {component: AudioComponent; next: number} | null {
    if (voices.length === 0) {
      return null
    }
    const start = cursor % voices.length
    for (let n = 0; n < voices.length; n++) {
      const index = (start + n) % voices.length
      const audio = voices[index]
      if (!audio || audio.isPlaying()) {
        continue
      }
      return {component: audio, next: index + 1}
    }
    return null
  }

  private setInteractionLocked(locked: boolean): void {
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i]
      if (!piece.enabled) {
        continue
      }
      const manipulation = piece.getComponent(
        InteractableManipulation.getTypeName()
      ) as InteractableManipulation
      const interactable = piece.getComponent(
        Interactable.getTypeName()
      ) as Interactable
      if (manipulation) {
        manipulation.enabled = !locked
      }
      if (interactable) {
        interactable.enabled = !locked
      }
    }
  }

  private setFramesVisible(visible: boolean): void {
    if (this.factsFrame) {
      this.factsFrame.enabled = visible
    }
    if (this.knowledgeFrame) {
      this.knowledgeFrame.enabled = visible
    }
  }
}
