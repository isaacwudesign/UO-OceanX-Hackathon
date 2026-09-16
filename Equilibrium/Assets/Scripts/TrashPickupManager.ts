/**
 * Plastic-pollution beat: pinch-to-collect after heat is solved.
 * Kinematic only (no physics bodies). One 2D SFX voice. Locked until Explain ends.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {applyMuteMix, applyPlayMix, applySfxMix} from "./SnapAudio"

const PIECE_PREFIXES = ["Trash_Bottle", "Trash_Can", "Trash_Fruits"]
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
  @hint("Drag the hierarchy Trash_Picking_SFX Audio component here.")
  pickSfx: AudioComponent

  @input
  @allowUndefined
  @hint("Trash_Picking_SFX.mp3 — assigned onto pickSfx at runtime (one 2D voice).")
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
  private explainFinished = false
  private started = false
  private solved = false
  private bound = false
  private onExplainFinishedCallback: (() => void) | null = null
  private onSolveFinishedCallback: (() => void) | null = null
  private headsetVolume = new Map<AudioComponent, number>()
  private pickVoices: AudioComponent[] = []

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this))
  }

  private onStart(): void {
    this.collectPieces()
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
    this.preparePieces()
    this.preparePickVoices()
    this.pickedIds.clear()
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
      print("TrashPickupManager: drag Trash_Picking_SFX onto pickSfx")
    }

    this.armAudio(this.explainAudio)
    this.explainAudio.play(1)
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
    const names = [
      "Trash_Picking_SFX_Voice2",
      "Trash_Picking_SFX_Voice3",
      "Trash_Picking_SFX_Voice4",
      "Trash_Picking_SFX_Voice5",
    ]
    for (let i = 0; i < names.length; i++) {
      const extra = this.cloneSfxVoice(this.pickSfx, names[i])
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
    applySfxMix(audio, PICK_SFX_GAIN)
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
        this.collectPiece(piece)
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
      if (!piece.enabled || this.pickedIds.has(piece.uniqueIdentifier)) {
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

  private collectPiece(piece: SceneObject): void {
    if (!this.explainFinished || this.solved) {
      return
    }
    const id = piece.uniqueIdentifier
    if (this.pickedIds.has(id)) {
      return
    }
    this.pickedIds.add(id)
    piece.enabled = false
    this.playPickSfx()
    if (this.pickedIds.size >= this.pieces.length) {
      this.onAllCollected()
    }
  }

  private onAllCollected(): void {
    if (this.solved) {
      return
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
    this.armAudio(this.solveAudio)
    this.solveAudio.play(1)
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
    for (let i = 0; i < this.pickVoices.length; i++) {
      const audio = this.pickVoices[i]
      if (!audio || audio.isPlaying()) {
        continue
      }
      this.armSfx(audio)
      audio.play(1)
      return
    }
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
