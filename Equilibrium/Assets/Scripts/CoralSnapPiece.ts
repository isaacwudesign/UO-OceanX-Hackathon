/**
 * Per-coral snap behavior. Hooks SIK InteractableManipulation release to CoralSnapManager.
 */
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
  @hint("Re-parent here when picked up from a snap point (e.g. VisualParent — not Platform)")
  coralHolder: SceneObject

  private sceneObj: SceneObject
  private interactable: Interactable | null = null
  private isSnapped = false
  private interactionLocked = false
  private homeLocalRotation: quat = quat.quatIdentity()
  private homeLocalScale: vec3 = new vec3(1, 1, 1)
  private homeWorldRotation: quat = quat.quatIdentity()
  private homeWorldScale: vec3 = new vec3(1, 1, 1)

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
    if (this.interactionLocked || !this.isSnapped) {
      return
    }

    this.snapManager?.cancelActiveSnapTween()
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
    })
    if (snapped) {
      this.isSnapped = true
    }
  }
}
