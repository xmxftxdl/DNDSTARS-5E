import type { CampaignTimedLight } from '../../lib/campaignTime'

export const STRONG_WIND_FLAME_RECEIPT_PREFIX = 'wind-flame:'

export function strongWindFlameReceiptKey(light: CampaignTimedLight): string {
  return STRONG_WIND_FLAME_RECEIPT_PREFIX + JSON.stringify([
    light.sourceKind ?? 'custom', light.startedAtWorldMinute ?? null, light.expiresAtWorldMinute ?? null,
    ...(light.flameProtected === true ? [true] : []),
  ])
}

export function isStrongWindFlameReceiptId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 120 || !value.startsWith(STRONG_WIND_FLAME_RECEIPT_PREFIX)) return false
  try {
    const parts: unknown = JSON.parse(value.slice(STRONG_WIND_FLAME_RECEIPT_PREFIX.length))
    return Array.isArray(parts) && (
      (parts.length === 3 && ['lamp', 'hooded-lantern'].includes(parts[0])) ||
      (parts.length === 4 && parts[3] === true && ['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(parts[0]))
    ) && parts.slice(1, 3).every(part => part === null || (Number.isSafeInteger(part) && part >= 0))
  } catch { return false }
}
