import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eCombatantCanSpeakAudibly } from './headlessCombatEngine'
import { dnd5eConditionIncapacitated } from './conditions'
import { dnd5eTokenIntersectsPersistentAreaAt, dnd5eTokenFullyContainedInPersistentAreaAt } from './persistentAreaGeometry'
import { dnd5eCompanionDestinationFitsMap, type Dnd5eCompanionMovementDestination } from './companionMovementDestination'
import { dnd5eCombatantCanHearSource } from './audibility'
import { isDnd5eCompanionReady, type Dnd5eCompanionReady } from './companionReady'
import { dnd5eCompanionObjectExists, normalizeDnd5eCompanionObjectInteraction, type Dnd5eCompanionObjectInteraction } from './companionObjectInteraction'

export type Dnd5eGroveCommand = (({ kind: 'attack'; targetId: string } | { kind: 'dodge' | 'hide' } |
  { kind: 'help'; targetId: string; helpKind: 'attack' | 'ability-check' } |
  { kind: 'use-object'; objectInteraction: Dnd5eCompanionObjectInteraction } |
  { kind: 'ready'; ready: Dnd5eCompanionReady; targetId?: string; objectInteraction?: Dnd5eCompanionObjectInteraction }) &
  { movementDestination?: Dnd5eCompanionMovementDestination }) |
  { kind: 'dash' | 'disengage'; movementDestination: Dnd5eCompanionMovementDestination } | { kind: 'resume-guarding' }

/** Host preparation only; caller authenticates the request and publishes the returned map. */
export function prepareDnd5eGroveCommand(input: {
  map: BattleMap; characters: readonly Character[]; sourceTokenId: string;
  guardianIds: readonly string[]; round: number; command: Dnd5eGroveCommand;
}) {
  const ids = new Set(input.guardianIds)
  if (!ids.size || ids.size > 4 || !Number.isSafeInteger(input.round) || input.round < 1 ||
    !['attack', 'dodge', 'dash', 'disengage', 'hide', 'help', 'ready', 'use-object', 'resume-guarding'].includes(input.command.kind)) return { ok: false as const, reason: 'invalid-command' }
  const ready = input.command.kind === 'ready' ? input.command.ready : undefined
  if (input.command.kind === 'ready' && (!isDnd5eCompanionReady(ready) ||
    (input.command.targetId != null && ready.actionKind !== 'attack'))) return { ok: false as const, reason: 'invalid-command' }
  const object = input.command.kind === 'use-object' || input.command.kind === 'ready' ? input.command.objectInteraction : undefined
  const requiresObject = input.command.kind === 'use-object' || ready?.actionKind === 'interact-object'
  if (requiresObject !== (object != null) || (object && !normalizeDnd5eCompanionObjectInteraction(object))) return { ok: false as const, reason: 'invalid-command' }
  const attackTargetId = input.command.kind === 'attack' || input.command.kind === 'ready' ? input.command.targetId : undefined
  const destination = input.command.kind === 'resume-guarding' ? undefined : input.command.movementDestination
  if (['dash', 'disengage'].includes(input.command.kind) && !destination) return { ok: false as const, reason: 'invalid-destination' }
  const source = input.map.tokens.find(token => token.id === input.sourceTokenId)
  if (!source) return { ok: false as const, reason: 'invalid-source' }
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'grove-command', round: input.round,
    map: input.map, characters: input.characters,
    initiativeOrder: input.map.tokens.filter(token => token.type !== 'obstacle').map(token =>
      ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })) })
  const actor = snapshot.state.combatants[source.id]
  if (object && !dnd5eCompanionObjectExists(snapshot.state, object)) return { ok: false as const, reason: 'invalid-object' }
  if (!actor || actor.currentHp <= 0 || actor.deathSaves.dead || dnd5eConditionIncapacitated(actor) ||
    !dnd5eCombatantCanSpeakAudibly(actor)) return { ok: false as const, reason: 'cannot-speak' }
  const guardians = [...ids].map(id => input.map.tokens.find(token => token.id === id))
  const bindings = new Map<string, string>()
  for (const guardian of guardians) {
    const record = guardian?.dnd5eGroveGuardian
    const boundary = record && input.map.dnd5ePluginAreas?.find(area => area.id === record.boundaryAreaId &&
      area.effectGroup?.castId === record.castId && area.effectGroup.effectId === 'guardians' && area.sourceTokenId === source.id)
    if (!guardian || !record || record.sourceTokenId !== source.id || !boundary ||
      !snapshot.state.combatants[guardian.id] || snapshot.state.combatants[guardian.id].currentHp <= 0 ||
      !dnd5eTokenIntersectsPersistentAreaAt(source, input.map, boundary, source)) return { ok: false as const, reason: 'invalid-guardian' }
    if (!dnd5eCombatantCanHearSource(snapshot.state.combatants[guardian.id], actor, snapshot.state.mapId)) return { ok: false as const, reason: 'cannot-hear' }
    if (destination && (!dnd5eCompanionDestinationFitsMap(input.map, guardian.id, destination) ||
      !dnd5eTokenFullyContainedInPersistentAreaAt(guardian, input.map, boundary, destination))) {
      return { ok: false as const, reason: 'invalid-destination' }
    }
    if (input.command.kind === 'attack' || attackTargetId != null) {
      const target = input.map.tokens.find(token => token.id === attackTargetId)
      if (!target || target.id === guardian.id || !snapshot.state.combatants[target.id] ||
        (target.dnd5eGroveGuardian?.castId === record.castId && target.dnd5eGroveGuardian.sourceTokenId === source.id) ||
        snapshot.state.combatants[target.id].deathSaves.dead || boundary.excludedTargetIds?.includes(target.id) ||
        !dnd5eTokenIntersectsPersistentAreaAt(target, input.map, boundary, target)) return { ok: false as const, reason: 'invalid-target' }
    }
    if (input.command.kind === 'help') {
      const target = snapshot.state.combatants[input.command.targetId]
      if (!target || target.id === guardian.id || target.deathSaves.dead ||
        !['attack', 'ability-check'].includes(input.command.helpKind)) return { ok: false as const, reason: 'invalid-target' }
    }
    bindings.set(guardian.id, boundary.featureId)
  }
  return { ok: true as const, map: { ...input.map, tokens: input.map.tokens.map(token => {
    const featureId = bindings.get(token.id)
    if (!featureId) return token
    return { ...token, dnd5eCombatState: { ...token.dnd5eCombatState,
      companionCommand: input.command.kind === 'resume-guarding' ? undefined : {
        schemaVersion: 1 as const, sourceOwnerId: source.id, sourceFeatureId: featureId,
        persistentOrder: true, issuedRound: input.round, command: input.command.kind,
        movementDestination: destination ? { ...destination } : undefined,
        attackTargetId,
        ready: ready ? { ...ready } : undefined,
        objectInteraction: object ? { ...object } : undefined,
        helpTargetId: input.command.kind === 'help' ? input.command.targetId : undefined,
        helpKind: input.command.kind === 'help' ? input.command.helpKind : undefined,
      },
    } }
  }) } }
}
