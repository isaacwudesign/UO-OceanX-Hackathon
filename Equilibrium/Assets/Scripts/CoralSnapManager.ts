/**
 * Places corals anywhere on the tank floor (kinematic, no physics).
 * Clamp XZ to the floor rectangle, set Y to floorLocalY, ease, then freeze.
 */
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {SceneManager} from "./SceneManager"

@component
export class CoralSnapManager extends BaseScriptComponent {
  @ui.group_start("References")
  @input
  @hint("Tank root used for floor-stick local space (TouchTank)")
  waterBase: SceneObject

  @input
  @allowUndefined
  @hint("Notifies SceneManager when floor occupancy changes")
  sceneManager: SceneManager

  @input
  @hint("Drag the hierarchy Water_Bubble_SFX Audio component here.")
  snapBubbleSfx: AudioComponent
  @ui.group_end

  @ui.group_start("Floor Stick (no physics)")
  @input
  @hint("Seconds for the coral to ease onto the floor")
  snapDuration: number = 0.35

  @input
  @hint("How many corals must sit on the floor to finish placement (reef pieces only, not tank decorations)")
  requiredPlacements: number = 8

  @input
  @hint("Tank-local floor height (Y). Same value previously measured from SnapHints.")
  floorLocalY: number = -12.78

  @input
  @hint("Tank-local half-width (X). Drop must land inside this rectangle.")
  floorHalfExtentX: number = 95

  @input
  @hint("Tank-local half-depth (Z). Drop must land inside this rectangle.")
  floorHalfExtentZ: number = 80

  @input
  @hint("Extra tank-local margin outside the rectangle that still counts as 'over the tank'")
  floorOutsideMargin: number = 20
  @ui.group_end

  private floorPlacedIds = new Set<string>()
  private snapCancels = new Map<string, CancelSet>()

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
  }

  private onStart(): void {
    if (!this.waterBase) {
      print("CoralSnapManager: waterBase is not assigned")
      return
    }
    if (!this.snapBubbleSfx) {
      print("CoralSnapManager: drag Water_Bubble_SFX onto snapBubbleSfx")
    }
    print(`CoralSnapManager: floor stick only, floorY=${this.floorLocalY.toFixed(2)}`)
  }

  public releaseCoral(coral: SceneObject): void {
    const key = coral.uniqueIdentifier
    if (this.floorPlacedIds.has(key)) {
      this.floorPlacedIds.delete(key)
      this.notifyPlacementChanged()
    }
  }

  public trySnap(
    coral: SceneObject,
    targetWorldRotation: quat,
    targetWorldScale: vec3,
    onComplete?: () => void
  ): boolean {
    return this.tryStickOnFloor(
      coral,
      targetWorldRotation,
      targetWorldScale,
      onComplete
    )
  }

  public cancelActiveSnapTween(coral?: SceneObject): void {
    if (coral) {
      this.cancelCoralSnap(coral.uniqueIdentifier)
      return
    }
    this.cancelAllCoralSnaps()
  }

  private tryStickOnFloor(
    coral: SceneObject,
    targetWorldRotation: quat,
    targetWorldScale: vec3,
    onComplete?: () => void
  ): boolean {
    if (!this.waterBase) {
      return false
    }

    const tankTransform = this.waterBase.getTransform()
    const worldPos = coral.getTransform().getWorldPosition()
    const local = tankTransform.getInvertedWorldTransform().multiplyPoint(worldPos)

    if (
      Math.abs(local.x) > this.floorHalfExtentX + this.floorOutsideMargin ||
      Math.abs(local.z) > this.floorHalfExtentZ + this.floorOutsideMargin
    ) {
      return false
    }

    const stuckLocal = new vec3(
      this.clamp(local.x, -this.floorHalfExtentX, this.floorHalfExtentX),
      this.floorLocalY,
      this.clamp(local.z, -this.floorHalfExtentZ, this.floorHalfExtentZ)
    )
    const targetPos = tankTransform.getWorldTransform().multiplyPoint(stuckLocal)

    const key = coral.uniqueIdentifier
    this.floorPlacedIds.add(key)
    this.playSnapBubbleSfx()
    this.notifyPlacementChanged()
    this.animateCoralTo(
      coral,
      targetPos,
      targetWorldRotation,
      targetWorldScale,
      () => {
        if (!this.floorPlacedIds.has(key)) {
          return
        }
        this.finalizeStickOnFloor(
          coral,
          stuckLocal,
          targetWorldRotation,
          targetWorldScale
        )
        onComplete?.()
      }
    )
    return true
  }

  private cancelCoralSnap(key: string): void {
    const cancel = this.snapCancels.get(key)
    if (cancel) {
      cancel()
      this.snapCancels.delete(key)
    }
  }

  private cancelAllCoralSnaps(): void {
    this.snapCancels.forEach((cancel) => {
      cancel()
    })
    this.snapCancels.clear()
  }

  private animateCoralTo(
    coral: SceneObject,
    targetPos: vec3,
    targetWorldRotation: quat,
    targetWorldScale: vec3,
    ended: () => void
  ): void {
    const coralTransform = coral.getTransform()
    const startPos = coralTransform.getWorldPosition()
    const startRot = coralTransform.getWorldRotation()
    const startScale = coralTransform.getWorldScale()
    const key = coral.uniqueIdentifier

    this.cancelCoralSnap(key)
    const cancelSet = new CancelSet()
    this.snapCancels.set(key, cancelSet)

    animate({
      duration: this.snapDuration,
      easing: "ease-out-cubic",
      cancelSet: cancelSet,
      update: (t: number) => {
        coralTransform.setWorldPosition(vec3.lerp(startPos, targetPos, t))
        coralTransform.setWorldRotation(quat.slerp(startRot, targetWorldRotation, t))
        coralTransform.setWorldScale(
          new vec3(
            startScale.x + (targetWorldScale.x - startScale.x) * t,
            startScale.y + (targetWorldScale.y - startScale.y) * t,
            startScale.z + (targetWorldScale.z - startScale.z) * t
          )
        )
      },
      ended,
    })
  }

  private finalizeStickOnFloor(
    coral: SceneObject,
    localPos: vec3,
    targetWorldRotation: quat,
    targetWorldScale: vec3
  ): void {
    coral.setParent(this.waterBase)
    const coralTransform = coral.getTransform()
    coralTransform.setLocalPosition(localPos)
    coralTransform.setWorldRotation(targetWorldRotation)
    coralTransform.setWorldScale(targetWorldScale)
  }

  private playSnapBubbleSfx(): void {
    if (!this.snapBubbleSfx) {
      return
    }
    this.snapBubbleSfx.play(1)
  }

  private notifyPlacementChanged(): void {
    if (!this.sceneManager) {
      return
    }
    this.sceneManager.onCoralPlacementChanged(
      this.floorPlacedIds.size,
      this.requiredPlacements
    )
  }

  private clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min
    }
    if (value > max) {
      return max
    }
    return value
  }
}
