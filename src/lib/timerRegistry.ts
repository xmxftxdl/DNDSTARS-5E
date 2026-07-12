export class TimerRegistry {
  private timers = new Set<number>()

  add(timer: number): number {
    this.timers.add(timer)
    return timer
  }

  delete(timer: number): void {
    this.timers.delete(timer)
  }

  clear(clearTimer: (timer: number) => void = globalThis.clearTimeout): void {
    for (const timer of this.timers) clearTimer(timer)
    this.timers.clear()
  }

  get size(): number {
    return this.timers.size
  }
}
