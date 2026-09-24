export interface DiceDragSample { x: number; y: number; time: number }

/** Recent pointer motion becomes tabletop velocity; pausing releases a drop. */
export function diceThrowMotion(samples: readonly DiceDragSample[], releasedAt: number, radius: number) {
  const last = samples.at(-1)
  const recent = samples.filter((sample) => releasedAt - sample.time <= 100)
  const first = recent[0]
  let x = 0
  let y = 0
  if (last && first && releasedAt - last.time < 80 && last.time > first.time) {
    const seconds = (last.time - first.time) / 1000
    x = (last.x - first.x) / seconds
    y = (last.y - first.y) / seconds
    const scale = Math.min(1, 1600 / Math.max(1, Math.hypot(x, y)))
    x *= scale
    y *= scale
  }
  const speed = Math.hypot(x, y)
  const rollRadius = Math.max(35, radius)
  return {
    velocity: { x, y, z: Math.min(350, speed * 0.15) },
    angularVelocity: {
      x: Math.max(-16, Math.min(16, -y / rollRadius)),
      y: Math.max(-16, Math.min(16, x / rollRadius)),
      z: 0,
    },
  }
}
