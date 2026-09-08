import { getDnd5eCoreSpellAreaDeclaration } from '../../rulesets/dnd5e/coreSpellAreas'
import {
  dnd5eSpellcastingClassIdForSpell,
  dnd5eSustainedSpellControlLabel,
  getDnd5eSrdCombatSpell,
} from '../../rulesets/dnd5e'
import type { Dnd5eSustainedSpellControlId } from '../../lib/sharedCombatTypes'
import { dnd5eUtilityProjectionMovementEconomy } from '../../rulesets/dnd5e/utilityProjection'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5ePluginFeatureDefinition } from '../../rulesets/dnd5e/pluginApi'
import {
  effectiveDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
} from '../../rulesets/dnd5e/activeEffects'
import { DND5E_SRD_AUDITED_SPELL_PACKAGE_ID } from '../../rulesets/dnd5e/activities/dnd5eSrdAuditedSpellActivities'
import {
  collectDnd5ePersistentAreaTriggers,
  dnd5eFirstGreaseMovementCheckpoint,
  type Dnd5eGreaseMovementCheckpoint,
} from '../../rulesets/dnd5e/pluginAreas'

/**
 * Player movement is submitted to the Host, but an on-enter Grease save can
 * take long enough to open a remote roll prompt before the final ACK snapshot
 * reaches the player. Detect that specific post-move trigger from the same
 * authoritative path so the player can project the movement animation first.
 */
export function playerMovementFirstGreaseCheckpoint(input: {
  map: BattleMap
  token: BattleMap['tokens'][number]
  to: { x: number; y: number }
  path: readonly { x: number; y: number }[]
  pathElevationsFeet?: readonly number[]
  round: number
}): Dnd5eGreaseMovementCheckpoint | undefined {
  const candidates = collectDnd5ePersistentAreaTriggers({
    map: input.map,
    timing: 'on-enter',
    round: input.round,
    turnKey: `${input.round}:${input.token.id}:player-move-preview`,
    movement: {
      token: input.token,
      to: input.to,
      path: input.path,
      pathElevationsFeet: input.pathElevationsFeet,
    },
  })
  return dnd5eFirstGreaseMovementCheckpoint({
    map: input.map,
    token: input.token,
    candidates,
  })
}

export function playerMovementEntersGrease(
  input: Parameters<typeof playerMovementFirstGreaseCheckpoint>[0],
): boolean {
  return playerMovementFirstGreaseCheckpoint(input) != null
}

export function playerMapMovablePersistentAreas(map: BattleMap, character: Character) {
  return (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    const movement = area.movement ?? (area.coreSpellId
      ? getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)?.movement
      : undefined)
    return area.sourceCharacterId === character.id &&
      movement
        ? [{
            id: area.id,
            label: area.label,
            economy: area.coreSpellId
              ? dnd5eUtilityProjectionMovementEconomy(character, area.coreSpellId, movement.economy)
              : movement.economy,
             maximumFeet: movement.maximumFeet,
             ...(area.coreSpellId === 'major-image' && movement.maximumDistanceFromSourceFeet != null
               ? { destinationRangeFeet: movement.maximumDistanceFromSourceFeet }
               : {}),
             coreSpellId: area.coreSpellId,
          }]
        : []
  })
}

export interface PlayerMapGrantedActivityControl {
  areaId?: string
  effectId?: string
  /** Effect source used as the natural counterparty for target-owned controls. */
  sourceActorTokenId?: string
  featureId: string
  activityId: string
  label: string
  economy: 'action' | 'bonus-action' | 'reaction' | 'none'
  targeting: 'self' | 'creature' | 'area'
  oncePerTurnKeys?: readonly string[]
}

function effectGrantedActivityControls(
  activeEffects: readonly Dnd5eActiveEffectInstance[] | undefined,
): PlayerMapGrantedActivityControl[] {
  return effectiveDnd5eActiveEffects(activeEffects).flatMap((effect) => {
    const packageId = effect.source.pluginId ?? (effect.source.kind === 'spell'
      ? DND5E_SRD_AUDITED_SPELL_PACKAGE_ID
      : undefined)
    if (!packageId) return []
    return (effect.grantedActivities ?? []).flatMap((activityId) => {
      if (
        effect.tags?.includes('externally-usable-activity') &&
        activityId === 'spell:disguise-self:inspect'
      ) return []
      const featureId = `${packageId}:effect-control.${activityId}`
      const feature = dnd5ePluginFeatureDefinition(featureId)
      const action = feature?.action
      if (!action || action.id !== activityId) return []
      return [{
        effectId: effect.id,
        sourceActorTokenId: effect.source.actorId,
        featureId,
        activityId,
        label: action.label,
        economy: action.economy === 'bonusAction' ? 'bonus-action' as const : action.economy,
        targeting: action.targeting.kind === 'self'
          ? 'self' as const
          : action.targeting.kind === 'area'
            ? 'area' as const
            : 'creature' as const,
        oncePerTurnKeys: action.oncePerTurnKeys,
      }]
    })
  })
}

/** Projects effect-granted controls owned by an unlinked map creature. */
export function mapTokenGrantedActivityControls(
  token: BattleMap['tokens'][number],
  map?: BattleMap,
  characters: readonly Character[] = [],
): readonly PlayerMapGrantedActivityControl[] {
  const owned = effectGrantedActivityControls(token.dnd5eCombatState?.activeEffects)
  if (!map) return owned
  const external = map.tokens.flatMap((target) => {
    if (target.id === token.id || target.type === 'obstacle') return []
    const linkedTarget = target.characterId
      ? characters.find((character) => character.id === target.characterId)
      : undefined
    return effectiveDnd5eActiveEffects(
      linkedTarget?.dnd5eCombatState?.activeEffects ?? target.dnd5eCombatState?.activeEffects,
    ).flatMap((effect) => {
      if (!effect.tags?.includes('externally-usable-activity')) return []
      const packageId = effect.source.pluginId ?? (effect.source.kind === 'spell'
        ? DND5E_SRD_AUDITED_SPELL_PACKAGE_ID
        : undefined)
      if (!packageId) return []
      return (effect.grantedActivities ?? []).flatMap((activityId) => {
        if (activityId !== 'spell:disguise-self:inspect') return []
        const featureId = `${packageId}:effect-control.${activityId}`
        const feature = dnd5ePluginFeatureDefinition(featureId)
        const action = feature?.action
        if (!action || action.id !== activityId || action.targeting.kind !== 'single-creature') return []
        return [{
          effectId: effect.id,
          sourceActorTokenId: target.id,
          featureId,
          activityId,
          label: `${action.label} · ${target.label}`,
          economy: action.economy === 'bonusAction' ? 'bonus-action' as const : action.economy,
          targeting: 'creature' as const,
          oncePerTurnKeys: action.oncePerTurnKeys,
        }]
      })
    })
  })
  return [...owned, ...external]
}

/** Projects active controls from the Host-owned area instead of character ownership. */
export function playerMapGrantedActivityControls(
  map: BattleMap,
  character: Character,
): readonly PlayerMapGrantedActivityControl[] {
  const areaControls: PlayerMapGrantedActivityControl[] = (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (area.sourceCharacterId !== character.id) return []
    return (area.grantedActivities ?? []).flatMap((grant) => {
      const featureId = `${area.pluginId}:area-control.${grant.activityId}`
      const feature = dnd5ePluginFeatureDefinition(featureId)
      const action = feature?.action
      if (!action || action.id !== grant.activityId) return []
      return [{
        areaId: area.id,
        featureId,
        activityId: grant.activityId,
        label: grant.label ?? action.label,
        economy: grant.activateOnCreate === true &&
          !area.grantedActivityUseReceipts?.includes(grant.activityId)
          ? 'none' as const
          : action.economy === 'bonusAction' ? 'bonus-action' as const : action.economy,
        targeting: action.targeting.kind === 'self'
          ? 'self' as const
          : action.targeting.kind === 'area'
            ? 'area' as const
            : 'creature' as const,
        oncePerTurnKeys: action.oncePerTurnKeys,
      }]
    })
  })
  const effectControls = effectGrantedActivityControls(character.dnd5eCombatState?.activeEffects)
  return [...areaControls, ...effectControls]
}

export interface PlayerMapSustainedAreaControl {
  areaId: string
  spellId: string
  castingClassId: string
  slotLevel: number
  controlId: Dnd5eSustainedSpellControlId
  label: string
  economy: 'action' | 'bonus-action'
  targeting: 'area' | 'creature'
}

/**
 * Projects reusable spell actions from the authoritative map entity.  Keeping
 * this separate from spellbook availability prevents the UI from recreating a
 * control after its Spiritual Weapon or Call Lightning area has been removed.
 */
export function playerMapSustainedAreaControls(
  map: BattleMap,
  character: Character,
): readonly PlayerMapSustainedAreaControl[] {
  return (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (
      area.sourceKind !== 'core-spell' ||
      area.sourceCharacterId !== character.id ||
      !area.coreSpellId ||
      !area.slotLevel
    ) return []
    const spell = getDnd5eSrdCombatSpell(area.coreSpellId)
    const control = spell?.sustainedAttack
    if (!spell || !control || control.origin === 'caster') return []
    const castingClassId = area.castingClassId ??
      dnd5eSpellcastingClassIdForSpell(character, spell.id, undefined, spell.classes)
    if (!castingClassId) return []
    return [{
      areaId: area.id,
      spellId: spell.id,
      castingClassId,
      slotLevel: area.slotLevel,
      controlId: control.id,
      label: dnd5eSustainedSpellControlLabel(control.id),
      economy: control.economy,
      targeting: control.resolution === 'saving-throw' ? 'area' as const : 'creature' as const,
    }]
  })
}
