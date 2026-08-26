/**
 * Registers snap slots on WaterBase and places corals on the nearest free slot when released.
 * Event-driven: work runs on manipulation end, not every frame.
 */
import animate, {CancelSet} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {SceneManager} from "./SceneManager"
type SnapSlot = {
  sceneObject: SceneObject
  transform: Transform
  snapHint: SceneObject | null
  occupant: SceneObject | null
}

@component
export class CoralSnapManager extends BaseScriptComponent {
  @ui.group_start("References")
  @input
  @hint("Parent object whose children are SnapPoint_1 … SnapPoint_4")
  waterBase: SceneObject

  @input
  @allowUndefined
  @hint("Notifies SceneManager when snap slot occupancy changes")
  sceneManager: SceneManager

  @input
  @allowUndefined
  @hint("Bubble SFX played when a coral snaps onto a snap point")
  snapBubbleSfx: AudioComponent

  @ui.group_end

  @ui.group_start("Snap Settings")
  @input
  @hint("Max world-space distance from a snap point to accept placement")
  snapDistance: number = 12

  @input
  @hint("Seconds for the coral to ease into the slot")
  snapDuration: number = 0.35
  @ui.group_end

  private slots: SnapSlot[] = []
  private coralToSlotIndex = new Map<string, number>()
  private tweenCancel = new CancelSet()

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
  }

  private onStart(): void {
    this.buildSlots()
  }

  private buildSlots(): void {
    this.slots = []
    if (!this.waterBase) {
      print("CoralSnapManager: waterBase is not assigned")
      return
    }

    const childCount = this.waterBase.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const child = this.waterBase.getChild(i)
      if (!child.name.startsWith("SnapPoint")) {
        continue
      }
      this.slots.push({
        sceneObject: child,
        transform: child.getTransform(),
        snapHint: this.findSnapHint(child),
        occupant: null,
      })
    }

    this.slots.sort((a, b) => a.sceneObject.name.localeCompare(b.sceneObject.name))
    print(`CoralSnapManager: registered ${this.slots.length} snap slots`)
  }

  public releaseCoral(coral: SceneObject): void {
    const key = coral.uniqueIdentifier
    const slotIndex = this.coralToSlotIndex.get(key)
    if (slotIndex === undefined) {
      return
    }

    const slot = this.slots[slotIndex]
    if (slot && slot.occupant === coral) {
      slot.occupant = null
      this.setHintVisible(slot, true)
    }
    this.coralToSlotIndex.delete(key)
    this.notifySlotStateChanged()
  }

  public trySnap(
    coral: SceneObject,
    targetWorldRotation: quat,
    targetWorldScale: vec3,
    onComplete?: () => void
  ): boolean {
    if (this.slots.length === 0) {
      return false
    }

    const coralPos = coral.getTransform().getWorldPosition()
    const match = this.findClosestOpenSlot(coralPos)
    if (!match) {
      return false
    }

    const slot = this.slots[match.index]
    slot.occupant = coral
    this.coralToSlotIndex.set(coral.uniqueIdentifier, match.index)
    this.setHintVisible(slot, false)
    this.playSnapBubbleSfx()

    const targetPos = slot.transform.getWorldPosition()
    const coralTransform = coral.getTransform()
    const startPos = coralTransform.getWorldPosition()
    const startRot = coralTransform.getWorldRotation()
    const startScale = coralTransform.getWorldScale()

    this.tweenCancel()
    animate({
      duration: this.snapDuration,
      easing: "ease-out-cubic",
      cancelSet: this.tweenCancel,
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
      ended: () => {
        this.finalizeSnap(coral, slot, targetWorldRotation, targetWorldScale)
        onComplete?.()
        this.notifySlotStateChanged()
      },
    })

    return true
  }

  public cancelActiveSnapTween(): void {
    this.tweenCancel()
  }

  private finalizeSnap(
    coral: SceneObject,
    slot: SnapSlot,
    targetWorldRotation: quat,
    targetWorldScale: vec3
  ): void {
    coral.setParent(slot.sceneObject)
    const coralTransform = coral.getTransform()
    coralTransform.setLocalPosition(vec3.zero())
    coralTransform.setWorldRotation(targetWorldRotation)
    coralTransform.setWorldScale(targetWorldScale)
  }

  private findSnapHint(snapPoint: SceneObject): SceneObject | null {
    const childCount = snapPoint.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const child = snapPoint.getChild(i)
      if (child.name.startsWith("SnapHint")) {
        return child
      }
    }
    return null
  }

  private setHintVisible(slot: SnapSlot, visible: boolean): void {
    if (slot.snapHint) {
      slot.snapHint.enabled = visible
    }
  }

  private playSnapBubbleSfx(): void {
    if (!this.snapBubbleSfx) {
      return
    }
    this.snapBubbleSfx.play(1)
  }

  private getFilledSlotCount(): number {
    let count = 0
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].occupant) {
        count++
      }
    }
    return count
  }

  private notifySlotStateChanged(): void {
    if (!this.sceneManager) {
      return
    }
    this.sceneManager.onCoralPlacementChanged(this.getFilledSlotCount(), this.slots.length)
  }

  private findClosestOpenSlot(position: vec3): {index: number; distance: number} | null {
    let bestIndex = -1
    let bestDistance = Number.MAX_VALUE

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]
      if (slot.occupant) {
        continue
      }

      const distance = position.distance(slot.transform.getWorldPosition())
      if (distance <= this.snapDistance && distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }

    if (bestIndex < 0) {
      return null
    }
    return {index: bestIndex, distance: bestDistance}
  }

}
