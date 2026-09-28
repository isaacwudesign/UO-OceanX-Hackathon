/**
 * Per-coral grab/release. Tank floor-stick first; otherwise ease back to the
 * platform home pose so a missed drop does not hang in the air.
 */
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {CoralSnapManager} from "./CoralSnapManager"
import {applySfxMix} from "./SnapAudio"

const PICK_HINT_NAME = "Pick_Hint_SFX"
/** OceanX cyan mark while the coral is in hand. Texture still shows through. */
const PICK_MARK = new vec4(0.25, 0.78, 1, 1)

let pickHintAudio: AudioComponent | null = null
let pickHintSearched = false

@component
export class CoralSnapPiece extends BaseScriptComponent {
  @input
  @hint("Shared manager on WaterBase")
  snapManager: CoralSnapManager

  @input
  @hint("Drag component on this coral")
  manipulation: InteractableManipulation

  @input
  @hint("Re-parent here when picked up from the tank floor (e.g. VisualParent — not Platform)")
  coralHolder: SceneObject

  @ui.group_start("Platform Home")
  @input
  @hint("If the drop misses the tank, always ease back to this coral's platform spot (no floating).")
  alwaysReturnHome: boolean = true

  @input
  @hint("World-space range to snap home when Always Return Home is OFF. Ignored when that is ON.")
  homeSnapDistance: number = 80
  @ui.group_end

  private sceneObj: SceneObject
  private interactable: Interactable | null = null
  private isSnapped = false
  private interactionLocked = false
  private homeParent: SceneObject | null = null
  private homeLocalPosition: vec3 = vec3.zero()
  private homeLocalRotation: quat = quat.quatIdentity()
  private homeLocalScale: vec3 = new vec3(1, 1, 1)
  private homeWorldRotation: quat = quat.quatIdentity()
  private homeWorldScale: vec3 = new vec3(1, 1, 1)
  private homeTweenCancel = new CancelSet()
  private highlightMaterial: Material | null = null
  private savedFactor: vec4 | null = null
  private highlighted = false

  onAwake(): void {
    this.sceneObj = this.getSceneObject()
    this.createEvent("OnStartEvent").bind(this.cacheHomeTransform.bind(this))

    if (!this.manipulation) {
      this.manipulation = this.sceneObj.getComponent(
        InteractableManipulation.getTypeName()
      ) as InteractableManipulation
    }

    this.interactable = this.sceneObj.getComponent(
      Interactable.getTypeName()
    ) as Interactable

    if (!this.manipulation) {
      print(`CoralSnapPiece: missing InteractableManipulation on ${this.sceneObj.name}`)
      return
    }

    this.manipulation.onManipulationStart.add(this.onGrab.bind(this))
    this.manipulation.onManipulationEnd.add(this.onRelease.bind(this))
  }

  private cacheHomeTransform(): void {
    const transform = this.sceneObj.getTransform()
    this.homeParent = this.sceneObj.getParent()
    this.homeLocalPosition = transform.getLocalPosition()
    this.homeLocalRotation = transform.getLocalRotation()
    this.homeLocalScale = transform.getLocalScale()
    this.homeWorldRotation = transform.getWorldRotation()
    this.homeWorldScale = transform.getWorldScale()
  }

  public getHomeWorldRotation(): quat {
    return this.homeWorldRotation
  }

  public getHomeWorldScale(): vec3 {
    return this.homeWorldScale
  }

  public getHomeLocalRotation(): quat {
    return this.homeLocalRotation
  }

  public getHomeLocalScale(): vec3 {
    return this.homeLocalScale
  }

  public lockInteraction(): void {
    if (this.interactionLocked) {
      return
    }
    this.interactionLocked = true
    this.clearPickHighlight()
    if (this.manipulation) {
      this.manipulation.enabled = false
    }
    if (this.interactable) {
      this.interactable.enabled = false
    }
  }

  public unlockInteraction(): void {
    if (!this.interactionLocked) {
      return
    }
    this.interactionLocked = false
    if (this.manipulation) {
      this.manipulation.enabled = true
    }
    if (this.interactable) {
      this.interactable.enabled = true
    }
  }

  private onGrab(): void {
    if (this.interactionLocked) {
      return
    }

    this.homeTweenCancel()
    this.snapManager?.cancelActiveSnapTween(this.sceneObj)
    this.playPickHint()
    this.showPickHighlight()

    if (!this.isSnapped) {
      return
    }

    this.snapManager?.releaseCoral(this.sceneObj)
    this.isSnapped = false

    const transform = this.sceneObj.getTransform()
    const worldPos = transform.getWorldPosition()
    const worldRot = transform.getWorldRotation()
    const worldScale = transform.getWorldScale()

    if (this.coralHolder) {
      this.sceneObj.setParent(this.coralHolder)
      transform.setWorldPosition(worldPos)
      transform.setWorldRotation(worldRot)
      transform.setWorldScale(worldScale)
    }
  }

  private onRelease(): void {
    this.clearPickHighlight()
    if (this.interactionLocked || !this.snapManager) {
      return
    }

    const snapped = this.snapManager.trySnap(
      this.sceneObj,
      this.homeWorldRotation,
      this.homeWorldScale,
      () => {
        this.isSnapped = true
      }
    )
    if (snapped) {
      this.isSnapped = true
      return
    }

    this.tryReturnHome()
  }

  private tryReturnHome(): void {
    if (!this.homeParent) {
      return
    }

    const homeWorldPos = this.getHomeWorldPosition()
    if (!this.alwaysReturnHome) {
      const releasePos = this.sceneObj.getTransform().getWorldPosition()
      if (releasePos.distance(homeWorldPos) > this.homeSnapDistance) {
        return
      }
    }

    const coralTransform = this.sceneObj.getTransform()
    const startPos = coralTransform.getWorldPosition()
    const startRot = coralTransform.getWorldRotation()
    const startScale = coralTransform.getWorldScale()
    const targetRot = this.getHomeWorldRotationLive()
    const targetScale = this.getHomeWorldScaleLive()
    const duration = this.snapManager ? this.snapManager.snapDuration : 0.35

    this.homeTweenCancel()
    animate({
      duration: duration,
      easing: "ease-out-cubic",
      cancelSet: this.homeTweenCancel,
      update: (t: number) => {
        coralTransform.setWorldPosition(vec3.lerp(startPos, homeWorldPos, t))
        coralTransform.setWorldRotation(quat.slerp(startRot, targetRot, t))
        coralTransform.setWorldScale(
          new vec3(
            startScale.x + (targetScale.x - startScale.x) * t,
            startScale.y + (targetScale.y - startScale.y) * t,
            startScale.z + (targetScale.z - startScale.z) * t
          )
        )
      },
      ended: () => {
        this.finalizeHome()
      },
    })
  }

  private finalizeHome(): void {
    if (!this.homeParent) {
      return
    }
    this.sceneObj.setParent(this.homeParent)
    const transform = this.sceneObj.getTransform()
    transform.setLocalPosition(this.homeLocalPosition)
    transform.setLocalRotation(this.homeLocalRotation)
    transform.setLocalScale(this.homeLocalScale)
    this.isSnapped = false
  }

  private playPickHint(): void {
    const audio = this.getPickHintAudio()
    if (!audio) {
      return
    }
    audio.enabled = true
    const owner = audio.getSceneObject()
    if (owner) {
      owner.enabled = true
    }
    applySfxMix(audio, 1)
    audio.playbackMode = Audio.PlaybackMode.LowLatency
    audio.play(1)
  }

  private getPickHintAudio(): AudioComponent | null {
    if (pickHintSearched) {
      return pickHintAudio
    }
    pickHintSearched = true
    const owner = this.findSceneObjectByName(PICK_HINT_NAME)
    if (!owner) {
      print("[CoralSnapPiece] Pick_Hint_SFX not found")
      return null
    }
    pickHintAudio = owner.getComponent(
      "Component.AudioComponent"
    ) as AudioComponent
    if (!pickHintAudio) {
      print("[CoralSnapPiece] Pick_Hint_SFX has no AudioComponent")
    }
    return pickHintAudio
  }

  private showPickHighlight(): void {
    const visual = this.sceneObj.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual
    if (!visual || !visual.mainMaterial) {
      return
    }
    if (!this.highlightMaterial) {
      this.highlightMaterial = visual.mainMaterial.clone()
      visual.mainMaterial = this.highlightMaterial
    }
    const pass = this.highlightMaterial.mainPass
    if (!this.savedFactor) {
      this.savedFactor = this.readFactor(pass)
    }
    const mark = new vec4(
      PICK_MARK.x,
      PICK_MARK.y,
      PICK_MARK.z,
      this.savedFactor.w
    )
    this.writeFactor(pass, mark)
    this.highlighted = true
  }

  private clearPickHighlight(): void {
    if (!this.highlighted || !this.highlightMaterial || !this.savedFactor) {
      return
    }
    this.writeFactor(this.highlightMaterial.mainPass, this.savedFactor)
    this.highlighted = false
  }

  private readFactor(pass: Pass): vec4 {
    const keys = ["baseColorFactor", "baseColor", "mainColor"]
    for (let i = 0; i < keys.length; i++) {
      try {
        const value = pass[keys[i]] as vec4
        if (value) {
          return new vec4(value.x, value.y, value.z, value.w)
        }
      } catch (_error) {
        // This shader uses a different color property.
      }
    }
    return new vec4(1, 1, 1, 1)
  }

  private writeFactor(pass: Pass, color: vec4): void {
    const rgb = new vec3(color.x, color.y, color.z)
    const keys = ["baseColorFactor", "baseColor", "mainColor", "Port_Albedo_N405"]
    for (let i = 0; i < keys.length; i++) {
      try {
        pass[keys[i]] = keys[i] === "Port_Albedo_N405" ? rgb : color
      } catch (_error) {
        // Property is not on this shader.
      }
    }
  }

  private findSceneObjectByName(name: string): SceneObject | null {
    const rootCount = global.scene.getRootObjectsCount()
    for (let i = 0; i < rootCount; i++) {
      const found = this.findNamedChild(global.scene.getRootObject(i), name)
      if (found) {
        return found
      }
    }
    return null
  }

  private findNamedChild(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) {
      return obj
    }
    const childCount = obj.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const found = this.findNamedChild(obj.getChild(i), name)
      if (found) {
        return found
      }
    }
    return null
  }

  private getHomeWorldPosition(): vec3 {
    if (!this.homeParent) {
      return this.homeLocalPosition
    }
    return this.homeParent
      .getTransform()
      .getWorldTransform()
      .multiplyPoint(this.homeLocalPosition)
  }

  private getHomeWorldRotationLive(): quat {
    if (!this.homeParent) {
      return this.homeLocalRotation
    }
    return this.homeParent
      .getTransform()
      .getWorldRotation()
      .multiply(this.homeLocalRotation)
  }

  private getHomeWorldScaleLive(): vec3 {
    if (!this.homeParent) {
      return this.homeLocalScale
    }
    const parentScale = this.homeParent.getTransform().getWorldScale()
    return new vec3(
      parentScale.x * this.homeLocalScale.x,
      parentScale.y * this.homeLocalScale.y,
      parentScale.z * this.homeLocalScale.z
    )
  }
}
