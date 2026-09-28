/**
 * The 3D puck is the only temperature control.
 * The slider bar stays visible, but pinching the track does nothing.
 */
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"

const KNOB_FORWARD = 1
const KNOB_HIT_SIZE = new vec3(7, 7, 5)

@component
export class TemperatureKnobSlider extends BaseScriptComponent {
  private slider: Slider | null = null

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart()
    })
    this.createEvent("UpdateEvent").bind(() => {
      this.onUpdate()
    })
  }

  private onStart(): void {
    this.slider = this.findSlider()
    this.disableOwnInteraction()
  }

  private onUpdate(): void {
    this.disableOwnInteraction()
    this.followSliderKnob()
    this.limitHitTargetToKnob()
  }

  /** This puck is visual. The slider's own hit volume is shrunk onto it. */
  private disableOwnInteraction(): void {
    const interactable = this.getSceneObject().getComponent(
      Interactable.getTypeName()
    ) as Interactable
    if (interactable) {
      interactable.enabled = false
    }
    const manipulation = this.getSceneObject().getComponent(
      InteractableManipulation.getTypeName()
    ) as InteractableManipulation
    if (manipulation) {
      manipulation.enabled = false
    }
    const collider = this.getSceneObject().getComponent(
      "Component.ColliderComponent"
    ) as ColliderComponent
    if (collider) {
      collider.enabled = false
    }
  }

  private followSliderKnob(): void {
    if (!this.slider || !this.slider.knobVisual) {
      return
    }
    const visual = this.slider.knobVisual
    if (visual.renderMeshVisual) {
      visual.renderMeshVisual.enabled = false
    }
    const source = visual.sceneObject.getTransform().getLocalPosition()
    this.getTransform().setLocalPosition(new vec3(source.x, source.y, KNOB_FORWARD))
  }

  /**
   * The UIKit slider collider covers the whole bar.
   * Keep a small hit volume on the puck so the empty track does nothing.
   */
  private limitHitTargetToKnob(): void {
    if (!this.slider || !this.slider.collider || !this.slider.collider.enabled) {
      return
    }
    this.slider.colliderFitElement = false
    this.slider.colliderSize = KNOB_HIT_SIZE
    this.slider.colliderCenter = this.getTransform().getLocalPosition()
  }

  private findSlider(): Slider | null {
    const count = global.scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      const found = this.searchSlider(global.scene.getRootObject(i))
      if (found) {
        return found
      }
    }
    print("TemperatureKnobSlider: Slider not found")
    return null
  }

  private searchSlider(root: SceneObject): Slider | null {
    const component = root.getComponent(Slider.getTypeName()) as Slider
    if (component) {
      return component
    }
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const found = this.searchSlider(root.getChild(i))
      if (found) {
        return found
      }
    }
    return null
  }
}
