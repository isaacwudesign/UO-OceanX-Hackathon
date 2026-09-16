/**
 * Per-coral grab/release. Tank floor-stick first; otherwise ease back to the
 * platform home pose so a missed drop does not hang in the air.
 */
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {CoralSnapManager} from "./CoralSnapManager"

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
