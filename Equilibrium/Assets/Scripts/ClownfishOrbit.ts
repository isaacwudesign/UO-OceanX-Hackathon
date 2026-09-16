/**
 * Clockwise swim circle. Each fish's head follows the path it is moving along.
 */
interface OrbitingFish {
  transform: Transform
  radius: number
  height: number
  startAngle: number
}

@component
export class ClownfishOrbit extends BaseScriptComponent {
  @ui.group_start("Orbit")
  @input
  @hint("Orbit speed in degrees per second")
  @widget(new SliderWidget(1, 120, 1))
  orbitSpeed: number = 18

  @input
  @allowUndefined
  @hint("Optional: pause orbit while this object is disabled (e.g. VisualParent)")
  visibilityRoot: SceneObject
  @ui.group_end

  private parentTransform: Transform
  private orbitAngleDegrees = 0
  private fish: OrbitingFish[] = []
  private swimPlayers: AnimationPlayer[] = []
  private motionScale = 1

  onAwake(): void {
    this.parentTransform = this.getTransform()
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this))
  }

  public setMotionScale(scale: number): void {
    const next = scale < 0 ? 0 : scale > 1 ? 1 : scale
    if (Math.abs(this.motionScale - next) < 0.001) {
      return
    }
    this.motionScale = next
    this.setSwimPlaybackSpeed(next)
  }

  private onStart(): void {
    const parent = this.getSceneObject()
    const childCount = parent.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const child = parent.getChild(i)
      const transform = child.getTransform()
      const position = transform.getLocalPosition()
      const radius = Math.sqrt(position.x * position.x + position.z * position.z)
      if (radius < 0.01) {
        continue
      }

      this.fish.push({
        transform: transform,
        radius: radius,
        height: position.y,
        startAngle: Math.atan2(position.z, position.x),
      })
    }

    this.collectAnimationPlayers(parent, this.swimPlayers)
    print("[ClownfishOrbit] tracking " + this.fish.length + " fish")
  }

  private collectAnimationPlayers(
    root: SceneObject,
    out: AnimationPlayer[]
  ): void {
    const player = root.getComponent(
      "Component.AnimationPlayer"
    ) as AnimationPlayer
    if (player) {
      out.push(player)
    }

    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      this.collectAnimationPlayers(root.getChild(i), out)
    }
  }

  private setSwimPlaybackSpeed(speed: number): void {
    for (let i = 0; i < this.swimPlayers.length; i++) {
      const player = this.swimPlayers[i]
      if (!player) {
        continue
      }

      const clips = player.clips
      if (clips) {
        for (let c = 0; c < clips.length; c++) {
          clips[c].playbackSpeed = speed
        }
      }
    }
  }

  private onUpdate(): void {
    if (!this.getSceneObject().enabled) {
      return
    }

    if (this.visibilityRoot && !this.visibilityRoot.enabled) {
      return
    }

    if (this.fish.length === 0) {
      return
    }

    // Clockwise on the pool as seen in preview: far → right → near → left.
    this.orbitAngleDegrees += this.orbitSpeed * this.motionScale * getDeltaTime()
    const deltaRadians = this.orbitAngleDegrees * MathUtils.DegToRad
    const step = 0.05

    for (let i = 0; i < this.fish.length; i++) {
      const current = this.fish[i]
      const theta = current.startAngle + deltaRadians
      const localNow = new vec3(
        Math.cos(theta) * current.radius,
        current.height,
        Math.sin(theta) * current.radius
      )
      const localNext = new vec3(
        Math.cos(theta + step) * current.radius,
        current.height,
        Math.sin(theta + step) * current.radius
      )

      current.transform.setLocalPosition(localNow)

      const worldNow = current.transform.getWorldPosition()
      const worldNext = this.parentTransform
        .getWorldTransform()
        .multiplyPoint(localNext)
      const travel = new vec3(
        worldNext.x - worldNow.x,
        0,
        worldNext.z - worldNow.z
      )

      if (travel.length < 0.0001) {
        continue
      }

      // This Sketchfab fish's nose is +Z. Point +Z along travel, belly up.
      const yaw = Math.atan2(travel.x, travel.z)
      current.transform.setWorldRotation(quat.fromEulerAngles(0, yaw, 0))
    }
  }
}
