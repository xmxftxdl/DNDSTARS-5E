/** Physical layers relevant to Detect Magic, independent of optical opacity. */
export interface MagicDetectionBarrier {
  material: 'stone' | 'metal' | 'wood-earth' | 'other'
  thicknessFeet: number
  leadLined: boolean
}

export function normalizeMagicDetectionBarrier(value: unknown): MagicDetectionBarrier | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (!['stone', 'metal', 'wood-earth', 'other'].includes(String(raw.material)) ||
    typeof raw.thicknessFeet !== 'number' || !Number.isFinite(raw.thicknessFeet) ||
    raw.thicknessFeet < 0 || raw.thicknessFeet > 10000 || typeof raw.leadLined !== 'boolean') return undefined
  return {material: raw.material as MagicDetectionBarrier['material'], thicknessFeet: raw.thicknessFeet, leadLined: raw.leadLined}
}

export function magicDetectionBarrierBlocks(barrier: MagicDetectionBarrier): boolean {
  if (barrier.leadLined) return true
  const threshold = {stone: 1, metal: 1 / 12, 'wood-earth': 3, other: Infinity}[barrier.material]
  return barrier.thicknessFeet >= threshold
}
