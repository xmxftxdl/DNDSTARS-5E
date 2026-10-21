import { normalizeDnd5eMapInventoryContents } from './mapInventoryContents'
import { normalizeDnd5eStructureObjectBinding, type Dnd5eStructureObjectBinding } from './structureObjectBinding'
import {normalizeDnd5eMapObjectSurface,type Dnd5eMapObjectSurface} from './mapObjectSurface'
import { normalizeDnd5eMapObjectCombatProfile, type Dnd5eMapObjectCombatProfile } from './mapObjectCombatProfile'
import { normalizeDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { normalizeDnd5eMapRemainsProtectionV1 } from './mapRemainsProtection'
import {
  normalizeDnd5eCreationObjectStateV1,
  type Dnd5eCreationObjectStateV1,
} from './creation'
import {
  normalizeDnd5eWaterContainerStateV1,
  type Dnd5eWaterContainerStateV1,
} from './createOrDestroyWater'

export interface Dnd5eArcaneLockStateV1 {
  schemaVersion: 1
  sourceTokenId: string
  sourceActivityId: string
  spellLevel: number
  /** The ordinary lock state restored when the magic is dispelled. */
  previousLocked: boolean
  /** Host-validated creatures designated by the caster when the spell is cast. */
  authorizedTokenIds?: readonly string[]
  /** Normalized one-way digest. The spoken password is never persisted. */
  passwordDigest?: string
  suppression?:
    | { kind: 'campaign-time'; untilWorldMinute: number }
    | { kind: 'combat-round'; combatId: string; throughRound: number }
}

export type Dnd5eArcaneLockSuppressionV1 = NonNullable<Dnd5eArcaneLockStateV1['suppression']>

export interface Dnd5eSequesteredObjectStateV1 {
  schemaVersion: 1
  sourceTokenId: string
  sourceCharacterId: string
  sourceActionId: string
  slotLevel: number
  endingCondition?: string
}

const DND5E_ARCANE_LOCK_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const DND5E_ARCANE_LOCK_PASSWORD_DIGEST = /^fnv1a32:[0-9a-f]{8}$/

function normalizedArcaneLockPassword(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

/**
 * Stable non-cryptographic digest used to avoid persisting a table password in
 * room/map state. This is a rules credential, not an authentication secret.
 */
export function hashDnd5eArcaneLockPasswordV1(value: string): string | undefined {
  const normalized = normalizedArcaneLockPassword(value)
  if (!normalized || normalized.length > 120) return undefined
  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`
}

export function dnd5eArcaneLockPasswordMatchesV1(
  lock: Dnd5eArcaneLockStateV1 | undefined,
  spokenPassword: string,
): boolean {
  const digest = hashDnd5eArcaneLockPasswordV1(spokenPassword)
  return !!digest && !!lock?.passwordDigest && digest === lock.passwordDigest
}

export function dnd5eArcaneLockAuthorizedTokenV1(
  lock: Dnd5eArcaneLockStateV1 | undefined,
  tokenId: string,
): boolean {
  return !!lock && (lock.sourceTokenId === tokenId || lock.authorizedTokenIds?.includes(tokenId) === true)
}

/** Generic Dispel Magic gate used by map-object magic consumers. */
export function dnd5eArcaneLockDispelSucceedsV1(input: {
  lock: Dnd5eArcaneLockStateV1
  dispelSlotLevel: number
  abilityCheckTotal?: number
}): boolean {
  if (!Number.isInteger(input.dispelSlotLevel) || input.dispelSlotLevel < 3 || input.dispelSlotLevel > 9) return false
  if (input.dispelSlotLevel >= input.lock.spellLevel) return true
  return Number.isFinite(input.abilityCheckTotal) && Number(input.abilityCheckTotal) >= 10 + input.lock.spellLevel
}

export interface Dnd5eMapObjectStateV1 {
  surfaceProfile?: Dnd5eMapObjectSurface
  structureBinding?: Dnd5eStructureObjectBinding
  /** Explicit DM-authored attack defense; omitted means no automatic attack profile. */
  combatProfile?: Dnd5eMapObjectCombatProfile
  /** Host-owned time-bound ward on an explicitly classified corpse. */
  undeadCreationProtection?: import('./mapRemainsProtection').Dnd5eMapRemainsProtectionV1
  schemaVersion: 1
  /** DM-classified noncreature vegetation. Death does not remove its physical obstacle. */
  vegetation?: 'living' | 'dead'
  /** Explicit scene feature; never inferred from image, name, or vegetation life. */
  naturalFeature?: 'tree' | 'undergrowth' | 'rock'
  /** Mundane crafted output with a durable inventory transaction identity. */
  inventoryItem?: { templateId: string; quantity: number; receiptId: string; identified?: boolean;
    /** Host-owned physical instance; ammunition may retain its exact stack identity. */
    instance?: import('../../types/inventory').Dnd5eInventoryEntry;
    boundEffects?: Dnd5eActiveEffectInstance[];
    contents?: import('../../types/inventory').Dnd5eInventoryEntry[] }
  /** Magical objects are excluded from Shatter's unattended-object damage. */
  magical?: boolean
  /** A map object currently worn or carried by a creature is not unattended. */
  wornOrCarried?: boolean
  /** Physical attachment is independent of the animated creature's locomotion. */
  attached?: boolean
  /** Host-owned binding while a commanded area carries this object. */
  areaCapture?: { mapId:string; areaId:string; sourceTokenId:string }
  /** Explicit current carrier; absent while carried means ownership is unknown. */
  carrierTokenId?: string
  /** DM-authored total object/stack weight. Omitted means unknown, never an inferred zero. */
  weightPounds?: number
  /** Last Host-settled ground strike. Terrain destruction is not inferred from missing HP. */
  groundImpact?: { actionId: string; operationId: string; surfaceId: string; damage: number; x: number; y: number; elevationFeet: number }
  /** DM-authored physical profile used when Animate Objects targets this object. */
  animateObjects?: {
    size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
    mobility: 'walk' | 'fly-hover' | 'fixed'
    damageType: 'bludgeoning' | 'piercing' | 'slashing'
  }
  locked?: boolean
  arcaneLock?: Dnd5eArcaneLockStateV1
  /** Host-owned food/drink object payload used by purification and ingestion rules. */
  consumable?: {
    kind: 'food' | 'drink' | 'food-and-drink'
    contaminants: readonly ('poison' | 'disease')[]
  }
  /** DM-classified physical remains. Only the explicit humanoid profile qualifies for corpse animation. */
  remains?: {
    kind: 'bone-pile' | 'humanoid-corpse' | 'creature-corpse'
    /** Animate Dead accepts only Small or Medium humanoid corpses. */
    creatureSize?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
    creatureType?: string
  }
  /** Sequester makes the object invisible and immune to divination targeting until ended. */
  sequester?: Dnd5eSequesteredObjectStateV1
  /** Temporary nonliving object created by Creation; campaign time removes it at expiry. */
  creation?: Dnd5eCreationObjectStateV1
  /** DM-authored open/closed container and exact water volume for Create or Destroy Water. */
  waterContainer?: Dnd5eWaterContainerStateV1
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function normalizeDnd5eArcaneLockStateV1(
  value: unknown,
): Dnd5eArcaneLockStateV1 | undefined {
  const raw = record(value)
  if (
    !raw || raw.schemaVersion !== 1 ||
    typeof raw.sourceTokenId !== 'string' || !raw.sourceTokenId || raw.sourceTokenId.length > 160 ||
    typeof raw.sourceActivityId !== 'string' || !raw.sourceActivityId || raw.sourceActivityId.length > 200 ||
    !Number.isInteger(raw.spellLevel) || Number(raw.spellLevel) < 0 || Number(raw.spellLevel) > 9 ||
    typeof raw.previousLocked !== 'boolean'
  ) return undefined
  const suppressionRaw = record(raw.suppression)
  const authorizedTokenIds = Array.isArray(raw.authorizedTokenIds) && raw.authorizedTokenIds.length <= 256 &&
    raw.authorizedTokenIds.every((id) => typeof id === 'string' && DND5E_ARCANE_LOCK_ID.test(id)) &&
    new Set(raw.authorizedTokenIds).size === raw.authorizedTokenIds.length
    ? raw.authorizedTokenIds as string[]
    : undefined
  if (raw.authorizedTokenIds != null && !authorizedTokenIds) return undefined
  const passwordDigest = typeof raw.passwordDigest === 'string' && DND5E_ARCANE_LOCK_PASSWORD_DIGEST.test(raw.passwordDigest)
    ? raw.passwordDigest
    : undefined
  if (raw.passwordDigest != null && !passwordDigest) return undefined
  const suppression = suppressionRaw?.kind === 'campaign-time' &&
    Number.isSafeInteger(suppressionRaw.untilWorldMinute) && Number(suppressionRaw.untilWorldMinute) >= 0
    ? { kind: 'campaign-time' as const, untilWorldMinute: Number(suppressionRaw.untilWorldMinute) }
    : suppressionRaw?.kind === 'combat-round' &&
      typeof suppressionRaw.combatId === 'string' && !!suppressionRaw.combatId && suppressionRaw.combatId.length <= 200 &&
      Number.isInteger(suppressionRaw.throughRound) && Number(suppressionRaw.throughRound) >= 0
      ? {
          kind: 'combat-round' as const,
          combatId: suppressionRaw.combatId,
          throughRound: Number(suppressionRaw.throughRound),
        }
      : undefined
  if (raw.suppression != null && !suppression) return undefined
  return {
    schemaVersion: 1,
    sourceTokenId: raw.sourceTokenId,
    sourceActivityId: raw.sourceActivityId,
    spellLevel: Number(raw.spellLevel),
    previousLocked: raw.previousLocked,
    authorizedTokenIds: authorizedTokenIds ? [...authorizedTokenIds] : undefined,
    passwordDigest,
    suppression,
  }
}

export function normalizeDnd5eMapObjectStateV1(
  value: unknown,
): Dnd5eMapObjectStateV1 | undefined {
  const raw = record(value)
  if (
    !raw || raw.schemaVersion !== 1 ||
    (raw.magical != null && typeof raw.magical !== 'boolean') ||
    (raw.wornOrCarried != null && typeof raw.wornOrCarried !== 'boolean') ||
    (raw.attached != null && typeof raw.attached !== 'boolean') ||
    (raw.carrierTokenId != null && (typeof raw.carrierTokenId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(raw.carrierTokenId) || raw.wornOrCarried !== true)) ||
    (raw.weightPounds != null && (typeof raw.weightPounds !== 'number' || !Number.isFinite(raw.weightPounds) || raw.weightPounds < 0)) ||
    (raw.locked != null && typeof raw.locked !== 'boolean')
  ) {
    return undefined
  }
  const undeadCreationProtection = normalizeDnd5eMapRemainsProtectionV1(raw.undeadCreationProtection)
  const capture=record(raw.areaCapture)
  if(raw.areaCapture!=null&&(!capture||Object.keys(capture).some(k=>!['mapId','areaId','sourceTokenId'].includes(k))||
    ['mapId','areaId','sourceTokenId'].some(k=>typeof capture[k]!=='string'||!String(capture[k]).trim()||String(capture[k]).length>1024)))return undefined
  const surfaceProfile=normalizeDnd5eMapObjectSurface(raw.surfaceProfile)
  if(raw.surfaceProfile!=null&&!surfaceProfile)return undefined
  if (raw.undeadCreationProtection != null && !undeadCreationProtection) return undefined
  const arcaneLock = normalizeDnd5eArcaneLockStateV1(raw.arcaneLock)
  if (raw.arcaneLock != null && !arcaneLock) return undefined
  const animateObjectsRaw = record(raw.animateObjects)
  const animateObjects: Dnd5eMapObjectStateV1['animateObjects'] | null = animateObjectsRaw == null
    ? undefined
    : ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'].includes(String(animateObjectsRaw.size)) &&
      (animateObjectsRaw.mobility === 'walk' || animateObjectsRaw.mobility === 'fly-hover' || animateObjectsRaw.mobility === 'fixed') &&
      (animateObjectsRaw.damageType === 'bludgeoning' || animateObjectsRaw.damageType === 'piercing' || animateObjectsRaw.damageType === 'slashing')
      ? {
          size: animateObjectsRaw.size as NonNullable<Dnd5eMapObjectStateV1['animateObjects']>['size'],
          mobility: animateObjectsRaw.mobility,
          damageType: animateObjectsRaw.damageType,
        }
      : null
  if (animateObjectsRaw != null && animateObjects == null) return undefined
  const consumableRaw = record(raw.consumable)
  if (raw.vegetation != null && raw.vegetation !== 'living' && raw.vegetation !== 'dead') return undefined
  if (raw.naturalFeature != null && (typeof raw.naturalFeature !== 'string' || !['tree', 'undergrowth', 'rock'].includes(raw.naturalFeature))) return undefined
  const contaminants = consumableRaw == null
    ? undefined
    : Array.isArray(consumableRaw.contaminants) &&
        ['food', 'drink', 'food-and-drink'].includes(String(consumableRaw.kind)) &&
        consumableRaw.contaminants.every((entry) => entry === 'poison' || entry === 'disease')
      ? [...new Set(consumableRaw.contaminants)] as ('poison' | 'disease')[]
      : undefined
  if (raw.consumable != null && contaminants == null) return undefined
  const sequesterRaw = record(raw.sequester)
  const sequester = sequesterRaw == null
    ? undefined
    : sequesterRaw.schemaVersion === 1 &&
      typeof sequesterRaw.sourceTokenId === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(sequesterRaw.sourceTokenId) &&
      typeof sequesterRaw.sourceCharacterId === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(sequesterRaw.sourceCharacterId) &&
      typeof sequesterRaw.sourceActionId === 'string' && sequesterRaw.sourceActionId.length >= 1 && sequesterRaw.sourceActionId.length <= 200 &&
      Number.isInteger(sequesterRaw.slotLevel) && Number(sequesterRaw.slotLevel) >= 7 && Number(sequesterRaw.slotLevel) <= 9 &&
      (sequesterRaw.endingCondition == null || (
        typeof sequesterRaw.endingCondition === 'string' &&
        sequesterRaw.endingCondition.normalize('NFKC').trim().length >= 1 &&
        sequesterRaw.endingCondition.normalize('NFKC').trim().length <= 500
      ))
      ? {
          schemaVersion: 1 as const,
          sourceTokenId: sequesterRaw.sourceTokenId,
          sourceCharacterId: sequesterRaw.sourceCharacterId,
          sourceActionId: sequesterRaw.sourceActionId,
          slotLevel: Number(sequesterRaw.slotLevel),
          endingCondition: typeof sequesterRaw.endingCondition === 'string'
            ? sequesterRaw.endingCondition.normalize('NFKC').trim().replace(/\s+/g, ' ')
            : undefined,
        }
      : null
  if (sequesterRaw != null && sequester == null) return undefined
  const creation = normalizeDnd5eCreationObjectStateV1(raw.creation)
  let structureBinding = normalizeDnd5eStructureObjectBinding(raw.structureBinding)
  if (raw.structureBinding != null && !structureBinding) return undefined
  if (raw.creation != null && !creation) return undefined
  const combatProfile = normalizeDnd5eMapObjectCombatProfile(raw.combatProfile)
  if (raw.combatProfile != null && !combatProfile) return undefined
  const inventoryItemRaw = record(raw.inventoryItem)
  if (raw.inventoryItem != null && (!inventoryItemRaw ||
    typeof inventoryItemRaw.templateId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(inventoryItemRaw.templateId) ||
    !Number.isSafeInteger(inventoryItemRaw.quantity) || Number(inventoryItemRaw.quantity) < 1 || Number(inventoryItemRaw.quantity) > 1000 ||
    typeof inventoryItemRaw.receiptId !== 'string' || !inventoryItemRaw.receiptId || inventoryItemRaw.receiptId.length > 300)) return undefined
  if (inventoryItemRaw?.identified != null && typeof inventoryItemRaw.identified !== 'boolean') return undefined
  const instanceRaw = record(inventoryItemRaw?.instance)
  const instanceBinding = normalizeDnd5eStructureObjectBinding(instanceRaw?.structureBinding)
  if (instanceRaw?.structureBinding != null && !instanceBinding) return undefined
  if (structureBinding && instanceBinding && (structureBinding.mapId !== instanceBinding.mapId ||
    structureBinding.structureId !== instanceBinding.structureId)) return undefined
  structureBinding ??= instanceBinding
  // Shape validation stays independent of the runtime item catalog. Pickup
  // and carried-inventory authority separately verify the registered template.
  const ammunitionStack = ['arrow', 'crossbow-bolt', 'sling-bullet', 'blowgun-needle']
    .includes(String(record(instanceRaw?.item)?.ammunitionKind ?? ''))
  if (inventoryItemRaw?.instance != null && (!instanceRaw || (inventoryItemRaw.quantity !== 1 && !ammunitionStack) ||
    typeof instanceRaw.instanceId !== 'string' || !instanceRaw.instanceId || instanceRaw.instanceId.length > 300 ||
    instanceRaw.templateId !== inventoryItemRaw.templateId || instanceRaw.quantity !== inventoryItemRaw.quantity || !record(instanceRaw.item))) return undefined
  const contents = normalizeDnd5eMapInventoryContents(instanceRaw as unknown as import('../../types/inventory').Dnd5eInventoryEntry | undefined, inventoryItemRaw?.contents)
  if (!contents) return undefined
  const physicalIds = new Set([instanceRaw?.instanceId, ...contents.map(entry => entry.instanceId)])
  // A spent round duration must not be clamped back to one round during item restoration.
  const boundEffectCandidates = Array.isArray(inventoryItemRaw?.boundEffects)
    ? inventoryItemRaw.boundEffects.filter(value => {
      const duration = record(record(value)?.duration)
      return !(duration?.type === 'rounds' && duration.remainingRounds === 0)
    }) : inventoryItemRaw?.boundEffects
  const boundEffects = normalizeDnd5eActiveEffects(boundEffectCandidates)
  if (inventoryItemRaw?.boundEffects != null && (!instanceRaw || !Array.isArray(inventoryItemRaw.boundEffects) ||
    boundEffects.length !== (boundEffectCandidates as unknown[]).length || boundEffects.some(effect =>
      !physicalIds.has(effect.modifiers?.weaponEnchantment?.inventoryInstanceId ?? effect.modifiers?.armorEnchantment?.inventoryInstanceId)))) return undefined
  const inventoryItem = inventoryItemRaw ? { templateId: inventoryItemRaw.templateId as string,
    quantity: inventoryItemRaw.quantity as number, receiptId: inventoryItemRaw.receiptId as string,
    ...(instanceRaw ? { instance: structuredClone(instanceRaw) as unknown as import('../../types/inventory').Dnd5eInventoryEntry } : {}),
    ...(boundEffects.length ? { boundEffects } : {}),
    ...(contents.length ? { contents } : {}),
    ...(inventoryItemRaw.identified != null ? { identified: inventoryItemRaw.identified as boolean } : {}) } : undefined
  const waterContainer = normalizeDnd5eWaterContainerStateV1(raw.waterContainer)
  const groundImpactRaw = record(raw.groundImpact)
  if (raw.groundImpact != null && (!groundImpactRaw ||
    !['actionId', 'operationId', 'surfaceId'].every(key => typeof groundImpactRaw[key] === 'string' &&
      (groundImpactRaw[key] as string).length > 0 && (groundImpactRaw[key] as string).length <= 300) ||
    !['damage', 'x', 'y', 'elevationFeet'].every(key => typeof groundImpactRaw[key] === 'number' && Number.isFinite(groundImpactRaw[key])) ||
    Number(groundImpactRaw.damage) < 0)) return undefined
  const groundImpact: Dnd5eMapObjectStateV1['groundImpact'] = groundImpactRaw ? {
    actionId: groundImpactRaw.actionId as string, operationId: groundImpactRaw.operationId as string,
    surfaceId: groundImpactRaw.surfaceId as string, damage: groundImpactRaw.damage as number,
    x: groundImpactRaw.x as number, y: groundImpactRaw.y as number, elevationFeet: groundImpactRaw.elevationFeet as number,
  } : undefined
  if (raw.waterContainer != null && !waterContainer) return undefined
  const remainsRaw = record(raw.remains)
  const remains: Dnd5eMapObjectStateV1['remains'] | null = remainsRaw == null
    ? undefined
    : remainsRaw.kind === 'bone-pile' && remainsRaw.creatureSize == null
      ? { kind: 'bone-pile' as const }
      : remainsRaw.kind === 'humanoid-corpse' &&
        (remainsRaw.creatureSize === 'small' || remainsRaw.creatureSize === 'medium')
        ? {
            kind: 'humanoid-corpse' as const,
            creatureSize: remainsRaw.creatureSize as 'small' | 'medium',
          }
        : remainsRaw.kind === 'creature-corpse' &&
          ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'].includes(String(remainsRaw.creatureSize)) &&
          (remainsRaw.creatureType == null || (typeof remainsRaw.creatureType === 'string' &&
            remainsRaw.creatureType.trim().length > 0 && remainsRaw.creatureType.length <= 100))
          ? { kind: 'creature-corpse', creatureSize: remainsRaw.creatureSize as NonNullable<Dnd5eMapObjectStateV1['remains']>['creatureSize'],
              ...(typeof remainsRaw.creatureType === 'string' ? { creatureType: remainsRaw.creatureType.trim() } : {}) }
          : null
  if (remainsRaw != null && remains == null) return undefined
  return {
    schemaVersion: 1,
    undeadCreationProtection,
    surfaceProfile,
    combatProfile,
    magical: raw.magical === true ? true : raw.magical === false ? false : undefined,
    vegetation: raw.vegetation === 'living' || raw.vegetation === 'dead' ? raw.vegetation : undefined,
    ...(raw.naturalFeature != null ? { naturalFeature: raw.naturalFeature as 'tree' | 'undergrowth' | 'rock' } : {}),
    attached: typeof raw.attached === 'boolean' ? raw.attached : undefined,
    ...(capture?{areaCapture:{mapId:String(capture.mapId),areaId:String(capture.areaId),sourceTokenId:String(capture.sourceTokenId)}}:{}),
    carrierTokenId: typeof raw.carrierTokenId === 'string' ? raw.carrierTokenId : undefined,
    wornOrCarried: raw.wornOrCarried === true ? true : raw.wornOrCarried === false ? false : undefined,
    weightPounds: typeof raw.weightPounds === 'number' ? raw.weightPounds : undefined,
    groundImpact,
    animateObjects: animateObjects ?? undefined,
    locked: raw.locked === true ? true : raw.locked === false ? false : undefined,
    arcaneLock,
    consumable: consumableRaw && contaminants
      ? {
          kind: consumableRaw.kind as 'food' | 'drink' | 'food-and-drink',
          contaminants,
        }
      : undefined,
    remains: remains ?? undefined,
    sequester: sequester ?? undefined,
    creation,
    structureBinding,
    waterContainer,
    inventoryItem,
  }
}

export function dnd5eArcaneLockIsSuppressed(input: {
  lock?: Dnd5eArcaneLockStateV1
  worldMinute?: number
  combatId?: string
  round?: number
}): boolean {
  const suppression = input.lock?.suppression
  if (!suppression) return false
  if (suppression.kind === 'campaign-time') {
    return Number.isFinite(input.worldMinute) && Number(input.worldMinute) < suppression.untilWorldMinute
  }
  return input.combatId === suppression.combatId && Number.isInteger(input.round) &&
    Number(input.round) <= suppression.throughRound
}

export function dnd5eArcaneLockIsActive(input: {
  lock?: Dnd5eArcaneLockStateV1
  worldMinute?: number
  combatId?: string
  round?: number
}): boolean {
  return !!input.lock && !dnd5eArcaneLockIsSuppressed(input)
}
