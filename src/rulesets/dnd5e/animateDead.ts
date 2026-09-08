import type {
  Dnd5eAnimateDeadDeclarationV1,
  Dnd5eAnimateDeadResolutionV1,
  Dnd5eCreateUndeadKindV1,
} from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function dnd5eAnimateDeadAnimationCapacity(slotLevel: number): number {
  return Number.isInteger(slotLevel) && slotLevel >= 3 && slotLevel <= 9
    ? 1 + (slotLevel - 3) * 2
    : 0
}

export function dnd5eAnimateDeadReassertionCapacity(slotLevel: number): number {
  return Number.isInteger(slotLevel) && slotLevel >= 3 && slotLevel <= 9
    ? 4 + (slotLevel - 3) * 2
    : 0
}

export function dnd5eCreateUndeadCapacity(
  slotLevel: number,
  undeadKind: Dnd5eCreateUndeadKindV1,
): number {
  if (!Number.isInteger(slotLevel) || slotLevel < 6 || slotLevel > 9) return 0
  if (undeadKind === 'ghoul') return slotLevel === 6 ? 3 : slotLevel === 7 ? 4 : slotLevel === 8 ? 5 : 6
  if (undeadKind === 'ghast' || undeadKind === 'wight') return slotLevel === 8 ? 2 : slotLevel === 9 ? 3 : 0
  return undeadKind === 'mummy' && slotLevel === 9 ? 2 : 0
}

export function dnd5eCreateUndeadIsNight(worldMinute: number): boolean {
  if (!Number.isSafeInteger(worldMinute) || worldMinute < 0) return false
  const minuteOfDay = worldMinute % (24 * 60)
  return minuteOfDay < 6 * 60 || minuteOfDay >= 18 * 60
}

export function dnd5eAnimateDeadRemainsKind(
  token: Token,
): 'bone-pile' | 'humanoid-corpse' | undefined {
  if (token.type !== 'obstacle' || token.dnd5eSpellEffect) return undefined
  return normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState)?.remains?.kind
}

export function dnd5eAnimateDeadControlledUndead(
  token: Token,
  sourceCharacterId: string,
): boolean {
  const summon = token.dnd5eSummon
  return token.type === 'enemy' &&
    (token.hp ?? token.maxHp ?? 0) > 0 &&
    summon?.persistent === true &&
    summon.featureId === 'spell:animate-dead' &&
    summon.sourceCharacterId === sourceCharacterId &&
    (token.poolId === 'srd-5.1:skeleton' || token.poolId === 'srd-5.1:zombie')
}

export function dnd5eCreateUndeadControlledUndead(
  token: Token,
  sourceCharacterId: string,
  undeadKind?: Dnd5eCreateUndeadKindV1,
): boolean {
  const summon = token.dnd5eSummon
  const poolKind = token.poolId?.replace(/^srd-5\.1:/, '')
  return token.type === 'enemy' &&
    (token.hp ?? token.maxHp ?? 0) > 0 &&
    summon?.persistent === true &&
    summon.controlEnded !== true &&
    summon.featureId === 'spell:create-undead' &&
    summon.sourceCharacterId === sourceCharacterId &&
    (poolKind === 'ghoul' || poolKind === 'ghast' || poolKind === 'wight' || poolKind === 'mummy') &&
    (undeadKind == null || poolKind === undeadKind)
}

export function normalizeDnd5eAnimateDeadDeclarationV1(
  value: unknown,
): Dnd5eAnimateDeadDeclarationV1 | undefined {
  const raw = record(value)
  if (!raw || raw.schemaVersion !== 1 || (raw.mode !== 'animate' && raw.mode !== 'reassert-control')) {
    return undefined
  }
  const undeadKind = raw.undeadKind
  if (
    undeadKind != null && undeadKind !== 'ghoul' && undeadKind !== 'ghast' &&
    undeadKind !== 'wight' && undeadKind !== 'mummy'
  ) return undefined
  if (!Array.isArray(raw.targets) || raw.targets.length < 1 || raw.targets.length > 16) return undefined
  const targets: Dnd5eAnimateDeadDeclarationV1['targets'] = []
  const seen = new Set<string>()
  for (const entry of raw.targets) {
    const target = record(entry)
    const tokenId = typeof target?.tokenId === 'string' ? target.tokenId : ''
    const targetName = typeof target?.targetName === 'string'
      ? target.targetName.normalize('NFKC').trim().replace(/\s+/g, ' ')
      : ''
    const remainsKind = target?.remainsKind
    if (
      !SAFE_ID.test(tokenId) || seen.has(tokenId) || !targetName || targetName.length > 160 ||
      (raw.mode === 'animate'
        ? remainsKind !== 'bone-pile' && remainsKind !== 'humanoid-corpse'
        : remainsKind != null)
    ) return undefined
    seen.add(tokenId)
    targets.push({
      tokenId,
      targetName,
      ...(raw.mode === 'animate'
        ? { remainsKind: remainsKind as 'bone-pile' | 'humanoid-corpse' }
        : {}),
    })
  }
  return {
    schemaVersion: 1,
    mode: raw.mode,
    ...(undeadKind ? { undeadKind: undeadKind as Dnd5eCreateUndeadKindV1 } : {}),
    targets,
  } as Dnd5eAnimateDeadDeclarationV1
}

export function normalizeDnd5eAnimateDeadResolutionV1(
  value: unknown,
): Dnd5eAnimateDeadResolutionV1 | undefined {
  const raw = record(value)
  if (!raw || raw.schemaVersion !== 1 || typeof raw.targetsConfirmed !== 'boolean') return undefined
  return { schemaVersion: 1, targetsConfirmed: raw.targetsConfirmed }
}
