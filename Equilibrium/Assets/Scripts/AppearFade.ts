/**
 * Fade a model's materials from clear to solid.
 * Clones materials so the shared asset on disk stays opaque.
 */

const COLOR_KEYS = ["baseColor", "baseColorFactor", "mainColor"]
const FADE_TIME = 0.9

interface StoredColor {
  key: string
  color: vec4
}

interface FadeSlot {
  pass: any
  colors: StoredColor[]
  opaqueBlend: number
  depthWrite: boolean
  opacityKey: string | null
  opacityValue: number
}

export class AppearFade {
  private slots: FadeSlot[] = []
  private prepared = false
  private age = -1
  private blending = false

  /** Snap to invisible, then tick() eases up to solid. */
  play(roots: SceneObject[]): void {
    if (!this.prepared) {
      for (let i = 0; i < roots.length; i++) {
        this.capture(roots[i])
      }
      this.prepared = true
    }
    this.age = 0
    this.blending = false
    this.apply(0)
  }

  tick(dt: number): void {
    if (this.age < 0) {
      return
    }
    this.age += dt
    const u = this.age >= FADE_TIME ? 1 : this.age / FADE_TIME
    const eased = u * u * (3 - 2 * u)
    this.apply(eased)
    if (u >= 1) {
      this.age = -1
    }
  }

  private capture(root: SceneObject): void {
    if (!root) {
      return
    }
    const count = root.getComponentCount("Component.RenderMeshVisual")
    for (let i = 0; i < count; i++) {
      const visual = root.getComponentByIndex(
        "Component.RenderMeshVisual",
        i
      ) as RenderMeshVisual
      this.captureVisual(visual)
    }
    const childCount = root.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      this.capture(root.getChild(i))
    }
  }

  private captureVisual(visual: RenderMeshVisual): void {
    if (!visual || !visual.mainMaterial) {
      return
    }
    const material = visual.mainMaterial.clone()
    visual.mainMaterial = material
    const pass = material.mainPass
    if (!pass) {
      return
    }
    const colors: StoredColor[] = []
    for (let i = 0; i < COLOR_KEYS.length; i++) {
      const key = COLOR_KEYS[i]
      const color = this.readColor(pass, key)
      if (color) {
        colors.push({key: key, color: color})
      }
    }
    if (colors.length === 0) {
      return
    }
    let opacityKey: string | null = null
    let opacityValue = 0
    try {
      if (pass.Port_Opacity_N405 !== undefined && pass.Port_Opacity_N405 !== null) {
        opacityKey = "Port_Opacity_N405"
        opacityValue = pass.Port_Opacity_N405
      }
    } catch (_error) {
      opacityKey = null
    }
    this.slots.push({
      pass: pass,
      colors: colors,
      opaqueBlend: pass.blendMode,
      depthWrite: pass.depthWrite,
      opacityKey: opacityKey,
      opacityValue: opacityValue,
    })
  }

  private readColor(pass: any, key: string): vec4 | null {
    try {
      const value = pass[key]
      if (!value || value.w === undefined) {
        return null
      }
      return new vec4(value.x, value.y, value.z, value.w)
    } catch (_error) {
      return null
    }
  }

  private apply(alpha: number): void {
    const solid = alpha >= 1
    const enterBlend = !solid && !this.blending
    const leaveBlend = solid && this.blending
    if (enterBlend) {
      this.blending = true
    }
    if (leaveBlend) {
      this.blending = false
    }
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]
      try {
        if (enterBlend) {
          slot.pass.blendMode = BlendMode.Normal
        } else if (leaveBlend) {
          slot.pass.blendMode = slot.opaqueBlend
        }
        if (slot.opacityKey) {
          slot.pass[slot.opacityKey] = solid ? slot.opacityValue : alpha
        }
      } catch (_error) {
        // This pass does not expose blend settings.
      }
      for (let c = 0; c < slot.colors.length; c++) {
        const stored = slot.colors[c]
        try {
          slot.pass[stored.key] = new vec4(
            stored.color.x,
            stored.color.y,
            stored.color.z,
            stored.color.w * alpha
          )
        } catch (_error) {
          // Property is not writable on this shader.
        }
      }
    }
  }
}
