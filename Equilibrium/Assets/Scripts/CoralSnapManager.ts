/**
 * Places corals anywhere on the tank floor (kinematic, no physics).
 * Clamp XZ to the floor rectangle. A drop on another coral slides to the
 * nearest open patch inside that same rectangle, then eases and freezes.
 */
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {SceneManager} from "./SceneManager"
import {playCapturedSfx} from "./SnapAudio"

/** Extra cm between collider edges so neighbors sit beside each other without touching. */
const EDGE_GAP = 4

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
  private placedLocal = new Map<string, vec3>()
  private placedRadius = new Map<string, number>()
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
      this.placedLocal.delete(key)
      this.placedRadius.delete(key)
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

    const key = coral.uniqueIdentifier
    const radius = this.footprintRadius(coral)
    const stuckLocal = this.findOpenSpot(
      this.clamp(local.x, -this.floorHalfExtentX, this.floorHalfExtentX),
      this.clamp(local.z, -this.floorHalfExtentZ, this.floorHalfExtentZ),
      key,
      radius
    )
    const targetPos = tankTransform.getWorldTransform().multiplyPoint(stuckLocal)

    this.floorPlacedIds.add(key)
    this.placedLocal.set(key, stuckLocal)
    this.placedRadius.set(key, radius)
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

  /** Nearest floor point where this coral's collider sits beside the others, still inside the tank. */
  private findOpenSpot(x: number, z: number, selfId: string, selfRadius: number): vec3 {
    if (this.isSpotClear(x, z, selfId, selfRadius)) {
      return new vec3(x, this.floorLocalY, z)
    }

    const step = 8
    const rings = 24
    for (let ring = 1; ring <= rings; ring++) {
      const radius = step * ring
      const steps = Math.max(8, Math.round((Math.PI * 2 * radius) / step))
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2
        const sx = this.clamp(
          x + Math.cos(angle) * radius,
          -this.floorHalfExtentX,
          this.floorHalfExtentX
        )
        const sz = this.clamp(
          z + Math.sin(angle) * radius,
          -this.floorHalfExtentZ,
          this.floorHalfExtentZ
        )
        if (this.isSpotClear(sx, sz, selfId, selfRadius)) {
          return new vec3(sx, this.floorLocalY, sz)
        }
      }
    }

    return new vec3(x, this.floorLocalY, z)
  }

  private isSpotClear(x: number, z: number, selfId: string, selfRadius: number): boolean {
    let clear = true
    this.placedLocal.forEach((pos, id) => {
      if (!clear || id === selfId) {
        return
      }
      const otherRadius = this.placedRadius.get(id) ?? selfRadius
      const need = selfRadius + otherRadius + EDGE_GAP
      const dx = x - pos.x
      const dz = z - pos.z
      if (dx * dx + dz * dz < need * need) {
        clear = false
      }
    })
    return clear
  }

  /** Half the coral's width on the floor, in tank-local cm. */
  private footprintRadius(coral: SceneObject): number {
    const worldRadius = this.worldFootprint(coral)
    if (!this.waterBase) {
      return worldRadius
    }
    const scale = this.waterBase.getTransform().getWorldScale()
    const tank = Math.max(Math.abs(scale.x), Math.abs(scale.z), 0.001)
    return worldRadius / tank
  }

  private worldFootprint(root: SceneObject): number {
    let half = 0
    this.measureFootprint(root, (radius) => {
      if (radius > half) {
        half = radius
      }
    })
    return half > 1 ? half : 25
  }

  private measureFootprint(root: SceneObject, visit: (radius: number) => void): void {
    const visualCount = root.getComponentCount("Component.RenderMeshVisual")
    for (let i = 0; i < visualCount; i++) {
      const visual = root.getComponentByIndex("Component.RenderMeshVisual", i) as RenderMeshVisual
      if (!visual) {
        continue
      }
      const min = visual.worldAabbMin()
      const max = visual.worldAabbMax()
      const halfX = Math.abs(max.x - min.x) * 0.5
      const halfZ = Math.abs(max.z - min.z) * 0.5
      visit(Math.max(halfX, halfZ))
    }
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      this.measureFootprint(root.getChild(i), visit)
    }
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
    playCapturedSfx(this.snapBubbleSfx, 1, 1)
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
