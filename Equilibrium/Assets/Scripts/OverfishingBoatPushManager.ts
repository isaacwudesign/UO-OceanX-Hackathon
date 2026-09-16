/**
 * Overfishing beat: open-palm shove boats off the tank water.
 * Kinematic only. No pinch. Locked until OverfishingIssueExplain ends.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import {applyMuteMix, applyPlayMix, applySfxMix} from "./SnapAudio"

const BOAT_PREFIX = "Fishboat_"
const HAND_NAMES: Array<"left" | "right"> = ["left", "right"]

class BoatRuntime {
  obj: SceneObject
  waterWorldY: number
  velocityX: number
  velocityZ: number
  gone: boolean
  slotIndex: number
  wasInside: boolean
  palmTouching: boolean
  restRot: quat
  phase: number
  bobFreq: number
  rockFreq: number
  yawFreq: number
}

@component
export class OverfishingBoatPushManager extends BaseScriptComponent {
  @ui.group_start("Audio")
  @input
  @hint("OverfishingIssueExplain. Do not stop()/pause().")
  explainAudio: AudioComponent

  @input
  @hint("OverfishingIssueSolveVO. Plays after all boats leave the tank.")
  solveAudio: AudioComponent

  @input
  @allowUndefined
  @hint("Fishboats_shovingSFX. Plays on each new palm contact. Do not stop()/pause().")
  shoveSfx: AudioComponent

  @input
  @allowUndefined
  @hint("Fishboats_shovingSFX.mp3 — assigned onto shove voices.")
  shoveSfxTrack: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Fishboats_Shoving_Done_SFX. Plays when a boat leaves the tank. Do not stop()/pause().")
  doneSfx: AudioComponent

  @input
  @allowUndefined
  @hint("Fishboats_Shoving_Done_SFX.mp3 — assigned onto done voices.")
  doneSfxTrack: AudioTrackAsset
  @ui.group_end

  @ui.group_start("Tank")
  @input
  @hint("TouchTank — boats stay on this water plane and leave in tank-local XZ.")
  tankRoot: SceneObject

  @input
  @hint("Tank-local half-width. Match CoralSnapManager (TouchTank is scaled 0.2).")
  tankHalfExtentX: number = 160

  @input
  @hint("Tank-local half-depth. Match CoralSnapManager (TouchTank is scaled 0.2).")
  tankHalfExtentZ: number = 160

  @input
  @hint("Extra tank-local distance past the rectangle that counts as off the water.")
  exitMargin: number = 25
  @ui.group_end

  @ui.group_start("Palm shove (heavy water)")
  @input
  @hint("cm. Palm must be this close to the hull — not a wide magnet bubble.")
  pushRadius: number = 22

  @input
  @hint("While touching, boat matches this fraction of palm speed (lower = heavier).")
  palmFollow: number = 0.32

  @input
  @hint("Max slide speed in cm/s. Stops teleport flicks.")
  maxSpeed: number = 36

  @input
  @hint("Water drag (1/s). Higher = boats die sooner after a sweep.")
  waterDrag: number = 2.4

  @input
  @hint("Pull toward tank center / reef (cm/s²). They creep in unless you sweep them out.")
  inwardAccel: number = 16

  @input
  @hint("World-cm hull radius. Not multiplied by boat scale (scale 2.3 would yeet them off the tank).")
  hullSeparation: number = 22
  @ui.group_end

  @ui.group_start("Frames")
  @input
  @allowUndefined
  @hint("Overfishing facts frame, hidden after Solve VO finishes")
  factsFrame: SceneObject

  @input
  @allowUndefined
  @hint("Overfishing knowledge frame, hidden after Solve VO finishes")
  knowledgeFrame: SceneObject
  @ui.group_end

  @ui.group_start("Surface Float")
  @input
  @hint("Gentle bob and rock so boats read as sitting on the water.")
  floatOnSurface: boolean = true

  @input
  @hint("World-Y bob height in cm. 1.5–3 is a small swell on this tank.")
  @widget(new SliderWidget(0, 10, 0.25))
  bobHeight: number = 2

  @input
  @hint("Pitch/roll in degrees. Keep under ~10 so shove still feels solid.")
  @widget(new SliderWidget(0, 20, 0.5))
  rockAngle: number = 6

  @input
  @hint("How fast the surface motion cycles, in waves per second.")
  @widget(new SliderWidget(0.1, 1.5, 0.05))
  floatSpeed: number = 0.4
  @ui.group_end

  private boats: BoatRuntime[] = []
  private started = false
  private explainFinished = false
  private solved = false
  private pendingSolve = false
  private pushEnabled = false
  private handProvider: HandInputData | null = null
  private lastPalm = new Map<string, vec3>()
  private onExplainFinishedCallback: (() => void) | null = null
  private onBoatsClearedCallback: (() => void) | null = null
  private onSolveFinishedCallback: (() => void) | null = null
  private shoveVoices: AudioComponent[] = []
  private doneVoices: AudioComponent[] = []
  private lastDoneVoice: AudioComponent | null = null
  private headsetVolume = new Map<AudioComponent, number>()

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this))
  }

  private onStart(): void {
    this.handProvider = HandInputData.getInstance()
    this.collectBoats()
    this.stripPinchGrab()
    this.prepareSfx()
    this.setPushEnabled(false)
  }

  public setOnExplainFinished(callback: () => void): void {
    this.onExplainFinishedCallback = callback
  }

  public setOnBoatsCleared(callback: () => void): void {
    this.onBoatsClearedCallback = callback
  }

  public setOnSolveFinished(callback: () => void): void {
    this.onSolveFinishedCallback = callback
  }

  /** Drop Mix-to-Snap tails before EndingVO. */
  public muteSolveAudio(): void {
    this.muteAudio(this.explainAudio)
    this.muteAudio(this.solveAudio)
  }

  /** SceneManager calls this after TrashIssueSolveVO finishes. */
  public begin(): void {
    if (this.started) {
      return
    }
    this.started = true
    this.explainFinished = false
    this.solved = false
    this.pendingSolve = false
    this.pushEnabled = false
    this.lastPalm.clear()
    if (!this.handProvider) {
      this.handProvider = HandInputData.getInstance()
    }
    this.collectBoats()
    this.stripPinchGrab()
    this.prepareSfx()
    this.setPushEnabled(false)
    this.setFramesVisible(true)

    if (this.explainAudio) {
      this.explainAudio.setOnFinish(this.onExplainFinished.bind(this))
    }
    if (this.solveAudio) {
      this.solveAudio.setOnFinish(this.onSolveVoFinished.bind(this))
    }

    if (!this.tankRoot) {
      print("[OverfishingBoatPushManager] tankRoot (TouchTank) is not assigned")
    }
    if (!this.explainAudio) {
      print("[OverfishingBoatPushManager] explainAudio is not assigned")
      this.onExplainFinished()
      return
    }
    this.armAudio(this.explainAudio)
    this.explainAudio.play(1)
  }

  private onExplainFinished(): void {
    if (!this.started || this.solved) {
      return
    }
    this.explainFinished = true
    this.muteAudio(this.explainAudio)
    if (this.pendingSolve) {
      this.playSolveVo()
      return
    }
    this.setPushEnabled(true)
    if (this.onExplainFinishedCallback) {
      this.onExplainFinishedCallback()
    }
  }

  private collectBoats(): void {
    this.boats = []
    this.collectBoatsRecursive(this.getSceneObject())
    print("[OverfishingBoatPushManager] tracking " + this.boats.length + " boats")
  }

  private collectBoatsRecursive(root: SceneObject): void {
    if (root.name.indexOf(BOAT_PREFIX) === 0) {
      const transform = root.getTransform()
      const world = transform.getWorldPosition()
      const restRot = transform.getLocalRotation()
      const index = this.boats.length
      const runtime = new BoatRuntime()
      runtime.obj = root
      runtime.waterWorldY = world.y
      runtime.velocityX = 0
      runtime.velocityZ = 0
      runtime.gone = false
      runtime.slotIndex = index
      runtime.wasInside = true
      runtime.palmTouching = false
      runtime.restRot = new quat(restRot.w, restRot.x, restRot.y, restRot.z)
      runtime.phase = index * 1.73
      runtime.bobFreq = 0.85 + (index % 3) * 0.12
      runtime.rockFreq = 0.7 + (index % 4) * 0.11
      runtime.yawFreq = 0.28 + (index % 5) * 0.05
      this.boats.push(runtime)
      if (this.isOffTank(world)) {
        this.placeOnWater(runtime)
      }
    }
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      this.collectBoatsRecursive(root.getChild(i))
    }
  }

  /**
   * Pinch grab would steal this beat. Direct only, no yellow cursor.
   * Leave Interactable enabled so SIK does not fall through to an Indirect ray.
   */
  private stripPinchGrab(): void {
    this.applyDirectNoCursor(this.getSceneObject())
    for (let i = 0; i < this.boats.length; i++) {
      const boat = this.boats[i].obj
      const manipulation = boat.getComponent(
        InteractableManipulation.getTypeName()
      ) as InteractableManipulation
      if (manipulation) {
        manipulation.enabled = false
      }
    }
  }

  private applyDirectNoCursor(root: SceneObject): void {
    const interactable = root.getComponent(
      Interactable.getTypeName()
    ) as Interactable
    if (interactable) {
      interactable.enabled = true
      interactable.targetingMode = 1
      interactable.targetingVisual = 0
      interactable.ignoreInteractionPlane = true
    }

    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      this.applyDirectNoCursor(root.getChild(i))
    }
  }

  private setPushEnabled(enabled: boolean): void {
    this.pushEnabled = enabled
  }

  private onUpdate(): void {
    if (!this.started || this.solved) {
      return
    }
    const dt = getDeltaTime()
    if (dt <= 0) {
      return
    }

    for (let i = 0; i < this.boats.length; i++) {
      this.updateBoat(this.boats[i], dt)
    }
    this.separateBoats()
    this.applySurfaceFloat()

    for (let h = 0; h < HAND_NAMES.length; h++) {
      const name = HAND_NAMES[h]
      const palm = this.readPalm(name)
      if (palm) {
        this.lastPalm.set(name, palm)
      } else {
        this.lastPalm.delete(name)
      }
    }
  }

  private readPalm(handName: "left" | "right"): vec3 | null {
    if (!this.handProvider) {
      return null
    }
    const hand = this.handProvider.getHand(handName)
    if (!hand || !hand.isTracked()) {
      return null
    }
    const wrist = hand.wrist.position
    const index = hand.indexTip.position
    return new vec3(
      (wrist.x + index.x) * 0.5,
      (wrist.y + index.y) * 0.5,
      (wrist.z + index.z) * 0.5
    )
  }

  private updateBoat(boat: BoatRuntime, dt: number): void {
    if (boat.gone || !boat.obj.enabled) {
      return
    }

    const transform = boat.obj.getTransform()
    const pos = transform.getWorldPosition()

    if (this.pushEnabled) {
      this.applyPalmFollow(boat, pos, dt)
      this.applyReefHunger(boat, pos, dt)
    }

    const drag = Math.exp(-this.waterDrag * dt)
    boat.velocityX *= drag
    boat.velocityZ *= drag
    this.clampSpeed(boat)

    pos.x += boat.velocityX * dt
    pos.z += boat.velocityZ * dt
    pos.y = boat.waterWorldY
    transform.setWorldPosition(pos)

    if (!this.pushEnabled) {
      return
    }
    if (!this.isOffTank(pos)) {
      boat.wasInside = true
    } else if (boat.wasInside) {
      this.clearBoat(boat)
    }
  }

  /** Palm on the hull: lerp velocity toward a fraction of palm speed. */
  private applyPalmFollow(boat: BoatRuntime, pos: vec3, dt: number): void {
    let palmVelX = 0
    let palmVelZ = 0
    let touching = false

    for (let h = 0; h < HAND_NAMES.length; h++) {
      const name = HAND_NAMES[h]
      const palm = this.readPalm(name)
      if (!palm) {
        continue
      }
      const dx = palm.x - pos.x
      const dz = palm.z - pos.z
      const horiz = Math.sqrt(dx * dx + dz * dz)
      const vert = Math.abs(palm.y - pos.y)
      if (horiz > this.pushRadius || vert > this.pushRadius) {
        continue
      }
      const prev = this.lastPalm.get(name)
      if (!prev) {
        continue
      }
      palmVelX += (palm.x - prev.x) / dt
      palmVelZ += (palm.z - prev.z) / dt
      touching = true
    }

    if (touching && !boat.palmTouching) {
      this.playOneShot(this.shoveVoices)
    }
    boat.palmTouching = touching

    if (!touching) {
      return
    }

    const blend = 1 - Math.exp(-10 * dt)
    boat.velocityX +=
      (palmVelX * this.palmFollow - boat.velocityX) * blend
    boat.velocityZ +=
      (palmVelZ * this.palmFollow - boat.velocityZ) * blend
  }

  /** Pull toward a personal reef slot, not one shared point, so hulls cannot stack. */
  private applyReefHunger(boat: BoatRuntime, worldPos: vec3, dt: number): void {
    if (!this.tankRoot) {
      return
    }
    const tankTransform = this.tankRoot.getTransform()
    const local = tankTransform.getInvertedWorldTransform().multiplyPoint(worldPos)
    const anchor = this.reefSlotLocal(boat.slotIndex)
    const dx = anchor.x - local.x
    const dz = anchor.z - local.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 10) {
      return
    }
    const inwardLocal = new vec3(dx / dist, 0, dz / dist)
    const inwardWorld = tankTransform.getWorldTransform().multiplyDirection(
      inwardLocal
    )
    boat.velocityX += inwardWorld.x * this.inwardAccel * dt
    boat.velocityZ += inwardWorld.z * this.inwardAccel * dt
  }

  private reefSlotLocal(slotIndex: number): vec3 {
    const count = Math.max(1, this.boats.length)
    if (count === 1) {
      return new vec3(0, 0, 0)
    }
    const angle = (slotIndex / count) * Math.PI * 2
    const spread = 38
    return new vec3(Math.cos(angle) * spread, 0, Math.sin(angle) * spread)
  }

  /** Soft hull-hull push so boats cannot occupy the same water. */
  private separateBoats(): void {
    for (let i = 0; i < this.boats.length; i++) {
      const a = this.boats[i]
      if (a.gone || !a.obj.enabled) {
        continue
      }
      for (let j = i + 1; j < this.boats.length; j++) {
        const b = this.boats[j]
        if (b.gone || !b.obj.enabled) {
          continue
        }
        const transformA = a.obj.getTransform()
        const transformB = b.obj.getTransform()
        const posA = transformA.getWorldPosition()
        const posB = transformB.getWorldPosition()
        const dx = posB.x - posA.x
        const dz = posB.z - posA.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        const need = this.boatRadius(a) + this.boatRadius(b)
        if (dist >= need) {
          continue
        }
        const nx = dist < 0.5 ? 1 : dx / dist
        const nz = dist < 0.5 ? 0 : dz / dist
        const overlap = need - Math.max(dist, 0.5)
        const push = overlap * 0.5
        posA.x -= nx * push
        posA.z -= nz * push
        posB.x += nx * push
        posB.z += nz * push
        posA.y = a.waterWorldY
        posB.y = b.waterWorldY
        transformA.setWorldPosition(posA)
        transformB.setWorldPosition(posB)

        const closing = (b.velocityX - a.velocityX) * nx + (b.velocityZ - a.velocityZ) * nz
        if (closing < 0) {
          a.velocityX += nx * closing
          a.velocityZ += nz * closing
          b.velocityX -= nx * closing
          b.velocityZ -= nz * closing
        }
      }
    }
  }

  private boatRadius(_boat: BoatRuntime): number {
    return this.hullSeparation
  }

  /** Bob and rock after slide/separation so hulls still sit on the water plane. */
  private applySurfaceFloat(): void {
    if (!this.floatOnSurface) {
      return
    }

    const t = getTime()
    const speed = this.floatSpeed
    const bobHeight = this.bobHeight
    const rockRad = this.rockAngle * MathUtils.DegToRad

    for (let i = 0; i < this.boats.length; i++) {
      const boat = this.boats[i]
      if (boat.gone || !boat.obj.enabled) {
        continue
      }

      const transform = boat.obj.getTransform()
      const pos = transform.getWorldPosition()
      const bob =
        Math.sin(t * speed * boat.bobFreq * Math.PI * 2 + boat.phase) * bobHeight
      const pitch =
        Math.sin(t * speed * boat.rockFreq * Math.PI * 2 + boat.phase) * rockRad
      const roll =
        Math.cos(t * speed * boat.rockFreq * 0.92 * Math.PI * 2 + boat.phase * 1.3) *
        rockRad
      const yaw =
        Math.sin(t * speed * boat.yawFreq * Math.PI * 2 + boat.phase * 0.6) *
        rockRad *
        0.35

      pos.y = boat.waterWorldY + bob
      transform.setWorldPosition(pos)
      const rock = quat.fromEulerAngles(pitch, yaw, roll)
      transform.setLocalRotation(rock.multiply(boat.restRot))
    }
  }

  private placeOnWater(boat: BoatRuntime): void {
    if (!this.tankRoot) {
      return
    }
    const tankTransform = this.tankRoot.getTransform()
    const slot = this.reefSlotLocal(boat.slotIndex)
    const world = tankTransform.getWorldTransform().multiplyPoint(slot)
    world.y = boat.waterWorldY
    boat.obj.getTransform().setWorldPosition(world)
    boat.wasInside = true
  }

  private clampSpeed(boat: BoatRuntime): void {
    const speed = Math.sqrt(
      boat.velocityX * boat.velocityX + boat.velocityZ * boat.velocityZ
    )
    if (speed <= this.maxSpeed || speed <= 0.001) {
      return
    }
    const scale = this.maxSpeed / speed
    boat.velocityX *= scale
    boat.velocityZ *= scale
  }

  private isOffTank(worldPos: vec3): boolean {
    if (!this.tankRoot) {
      return false
    }
    const local = this.tankRoot
      .getTransform()
      .getInvertedWorldTransform()
      .multiplyPoint(worldPos)
    return (
      Math.abs(local.x) > this.tankHalfExtentX + this.exitMargin ||
      Math.abs(local.z) > this.tankHalfExtentZ + this.exitMargin
    )
  }

  private clearBoat(boat: BoatRuntime): void {
    if (boat.gone) {
      return
    }
    boat.gone = true
    boat.obj.enabled = false
    boat.palmTouching = false
    this.lastDoneVoice = this.playOneShot(this.doneVoices)
    let remaining = 0
    for (let i = 0; i < this.boats.length; i++) {
      if (!this.boats[i].gone) {
        remaining += 1
      }
    }
    if (remaining === 0) {
      this.onAllCleared()
    }
  }

  private onAllCleared(): void {
    if (this.pendingSolve || this.solved) {
      return
    }
    this.pendingSolve = true
    this.pushEnabled = false
    if (this.onBoatsClearedCallback) {
      this.onBoatsClearedCallback()
    }
    if (!this.explainFinished) {
      return
    }
    this.beginSolveAfterDoneSfx()
  }

  private beginSolveAfterDoneSfx(): void {
    const voice = this.lastDoneVoice
    if (voice && voice.isPlaying()) {
      voice.setOnFinish(this.onDoneSfxFinished.bind(this))
      return
    }
    this.playSolveVo()
  }

  private onDoneSfxFinished(): void {
    if (this.lastDoneVoice) {
      this.lastDoneVoice.setOnFinish(() => {})
    }
    if (!this.pendingSolve || this.solved || !this.explainFinished) {
      return
    }
    this.playSolveVo()
  }

  private playSolveVo(): void {
    if (this.solved) {
      return
    }
    this.solved = true
    this.pushEnabled = false
    this.muteAudio(this.explainAudio)
    if (!this.solveAudio) {
      this.onSolveVoFinished()
      return
    }
    this.armAudio(this.solveAudio)
    this.solveAudio.play(1)
  }

  private prepareSfx(): void {
    this.cacheHeadsetVolume(this.explainAudio)
    this.cacheHeadsetVolume(this.solveAudio)
    this.cacheHeadsetVolume(this.shoveSfx)
    this.cacheHeadsetVolume(this.doneSfx)
    if (this.shoveSfx && this.shoveSfxTrack) {
      this.shoveSfx.audioTrack = this.shoveSfxTrack
    }
    if (this.doneSfx && this.doneSfxTrack) {
      this.doneSfx.audioTrack = this.doneSfxTrack
    }
    if (this.shoveVoices.length === 0 && this.shoveSfx) {
      this.shoveVoices.push(this.shoveSfx)
      const shoveNames = [
        "Fishboats_shovingSFX_Voice2",
        "Fishboats_shovingSFX_Voice3",
      ]
      for (let i = 0; i < shoveNames.length; i++) {
        const extra = this.cloneSfxVoice(this.shoveSfx, shoveNames[i])
        if (extra) {
          this.shoveVoices.push(extra)
        }
      }
    }
    if (this.doneVoices.length === 0 && this.doneSfx) {
      this.doneVoices.push(this.doneSfx)
      const doneNames = [
        "Fishboats_Shoving_Done_SFX_Voice2",
        "Fishboats_Shoving_Done_SFX_Voice3",
      ]
      for (let i = 0; i < doneNames.length; i++) {
        const extra = this.cloneSfxVoice(this.doneSfx, doneNames[i])
        if (extra) {
          this.doneVoices.push(extra)
        }
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
    this.headsetVolume.set(audio, this.playbackVolume(source))
    this.armSfx(audio)
    return audio
  }

  /** Play on a free voice so a new hit does not cut a clip that is still ringing. */
  private playOneShot(voices: AudioComponent[]): AudioComponent | null {
    for (let i = 0; i < voices.length; i++) {
      const audio = voices[i]
      if (!audio || audio.isPlaying()) {
        continue
      }
      this.armSfx(audio)
      audio.play(1)
      return audio
    }
    return null
  }

  private armSfx(audio: AudioComponent): void {
    audio.enabled = true
    const owner = audio.getSceneObject()
    if (owner) {
      owner.enabled = true
    }
    applySfxMix(audio, 1)
    audio.playbackMode = Audio.PlaybackMode.LowLatency
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

  private muteAudio(audio: AudioComponent): void {
    if (!audio) {
      return
    }
    applyMuteMix(audio)
    audio.enabled = false
  }

  private onSolveVoFinished(): void {
    this.muteAudio(this.solveAudio)
    this.setFramesVisible(false)
    if (this.onSolveFinishedCallback) {
      this.onSolveFinishedCallback()
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
