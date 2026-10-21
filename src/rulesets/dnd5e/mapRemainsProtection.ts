import type { Token } from '../../store/maps'

export interface Dnd5eMapRemainsProtectionV1 {
  schemaVersion: 1
  minimumPower: 'wish'
  sourceTokenId: string
  sourceActivityId: string
  sourcePackageId: string
  spellLevel: number
  createdWorldMinute: number
  expiresAtWorldMinute: number
}

export function normalizeDnd5eMapRemainsProtectionV1(value: unknown): Dnd5eMapRemainsProtectionV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== 1 || raw.minimumPower !== 'wish' ||
    !['sourceTokenId', 'sourceActivityId', 'sourcePackageId'].every(key =>
      typeof raw[key] === 'string' && (raw[key] as string).length > 0 && (raw[key] as string).length <= 300) ||
    !Number.isInteger(raw.spellLevel) || Number(raw.spellLevel) < 0 || Number(raw.spellLevel) > 9 ||
    !Number.isSafeInteger(raw.createdWorldMinute) || Number(raw.createdWorldMinute) < 0 ||
    !Number.isSafeInteger(raw.expiresAtWorldMinute) || Number(raw.expiresAtWorldMinute) <= Number(raw.createdWorldMinute)) return undefined
  return { schemaVersion: 1, minimumPower: 'wish', sourceTokenId: raw.sourceTokenId as string,
    sourceActivityId: raw.sourceActivityId as string, sourcePackageId: raw.sourcePackageId as string,
    spellLevel: Number(raw.spellLevel), createdWorldMinute: Number(raw.createdWorldMinute),
    expiresAtWorldMinute: Number(raw.expiresAtWorldMinute) }
}

/** Missing Host time cannot prove that a valid ward expired. */
export function dnd5eMapRemainsCreationIsProtected(token: Token, worldMinute: number | undefined): boolean {
  const protection = normalizeDnd5eMapRemainsProtectionV1(token.dnd5eObjectState?.undeadCreationProtection)
  return !!protection && (!Number.isSafeInteger(worldMinute) || Number(worldMinute) < protection.expiresAtWorldMinute)
}

export function expireDnd5eMapRemainsProtection(token: Token, worldMinute: number): Token {
  const protection = normalizeDnd5eMapRemainsProtectionV1(token.dnd5eObjectState?.undeadCreationProtection)
  if (!protection || !Number.isSafeInteger(worldMinute) || worldMinute < protection.expiresAtWorldMinute) return token
  const { undeadCreationProtection: _expired, ...objectState } = token.dnd5eObjectState!
  return { ...token, dnd5eObjectState: objectState }
}
