/**
 * Rotates ClownFishCircling (and its clownfish children) around the local Y axis.
 * One UpdateEvent on the parent — both fish orbit together with no per-fish logic.
 */
@component
export class ClownfishOrbit extends BaseScriptComponent {
  @ui.group_start("Orbit")
  @input
  @hint("Orbit speed in degrees per second")
  @widget(new SliderWidget(1, 120, 1))
  orbitSpeed: number = 18

  @input
  @hint("When enabled, orbits clockwise (viewed from above)")
  clockwise: boolean = true

  @input
  @allowUndefined
  @hint("Optional: pause orbit while this object is disabled (e.g. VisualParent)")
  visibilityRoot: SceneObject
  @ui.group_end

  private transform: Transform
  private orbitAngleDegrees = 0
  private updateEvent: SceneEvent

  onAwake(): void {
    this.transform = this.getTransform()
    this.updateEvent = this.createEvent("UpdateEvent")
    this.updateEvent.bind(this.onUpdate.bind(this))
  }

  private onUpdate(): void {
    if (!this.getSceneObject().enabled) {
      return
    }

    if (this.visibilityRoot && !this.visibilityRoot.enabled) {
      return
    }

    const direction = this.clockwise ? -1 : 1
    this.orbitAngleDegrees += direction * this.orbitSpeed * getDeltaTime()

    const orbitRadians = this.orbitAngleDegrees * MathUtils.DegToRad
    this.transform.setLocalRotation(quat.angleAxis(orbitRadians, vec3.up()))
  }
}
