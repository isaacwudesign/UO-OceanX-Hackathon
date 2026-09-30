/**
 * Waits that still count on Spectacles.
 * DelayedCallbackEvent created after startup often fires immediately on device.
 */
interface PendingDelay {
  remaining: number
  action: () => void
}

export class DeviceDelay {
  private pending: PendingDelay[] = []

  constructor(host: BaseScriptComponent) {
    host.createEvent("UpdateEvent").bind(() => {
      this.tick(getDeltaTime())
    })
  }

  after(seconds: number, action: () => void): void {
    this.pending.push({remaining: seconds, action: action})
  }

  private tick(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const item = this.pending[i]
      item.remaining -= dt
      if (item.remaining > 0) {
        continue
      }
      this.pending.splice(i, 1)
      item.action()
    }
  }
}
