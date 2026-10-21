import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import { createDnd5eMechanicalEffect, effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eCharacterIsSleeping, normalizeDnd5eDreamContact } from './dreamContact'
import { locateDnd5eSamePlaneCreatures } from './creatureSensorTarget'
import { createDnd5eMapCombatSnapshot, prepareDnd5eExplorationActor, planDnd5eMapResultApplication } from './mapBridge'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { dnd5eActivityHostSavingThrowModeV1, savingThrowModeForTarget } from './activities/dnd5eActivityPerTargetRolls'
import type { Dnd5eFormulaRollResult } from './activities/dnd5eFormula'

type Room = { maps: readonly BattleMap[]; characters: readonly Character[] }
export interface Dnd5eDreamNightmareReceipt { readonly sessionId: string }
const receipts = new WeakMap<Dnd5eDreamNightmareReceipt, { snapshot: string; sourceId: string; targetId: string;
  packageId: string; worldMinute: number; hasBodyConnection: boolean; grant: ReturnType<typeof createDnd5eMechanicalEffect> }>()
const reject = (reason: string) => ({ ok: false as const, reason })

/** The Host confirms narrative word limits and material possession; callers
 * cannot serialize those answers into a reusable execution permission. */
export async function prepareDnd5eDreamNightmare(input: {
  readRoom: () => Room; sourceCharacterId: string; packageId: string; worldMinute: number; message: string
  confirm: (facts: Readonly<{ message: string; sourceName: string; targetName: string }>) => Promise<{
    messageWithinTenWords: boolean; hasBodyConnection: boolean
  } | undefined>
}) {
  const room = input.readRoom(), snapshot = JSON.stringify(room)
  const sources = room.characters.filter(character => character.id === input.sourceCharacterId)
  if (sources.length !== 1) return reject('dream-nightmare-source-missing')
  const source = sources[0], session = normalizeDnd5eDreamContact(source.dnd5eDreamContact, source.id)
  if (!session || session.phase !== 'connected' || session.nightmareAttempted ||
    !Number.isSafeInteger(input.worldMinute) || input.worldMinute < session.startedWorldMinute ||
    input.worldMinute >= session.expiresWorldMinute || source.dnd5eWorldTimeAppliedMinute !== input.worldMinute ||
    source.currentHp <= 0) return reject('dream-nightmare-session-unavailable')
  const targets = room.characters.filter(character => character.id === session.targetCharacterId)
  if (targets.length !== 1 || targets[0].dnd5eWorldTimeAppliedMinute !== input.worldMinute ||
    !dnd5eCharacterIsSleeping(targets[0])) return reject('dream-nightmare-target-awake')
  const trance = effectiveDnd5eActiveEffects(source.dnd5eCombatState?.activeEffects).find(effect =>
    effect.id === `dream-trance:${session.id}` && effect.source.rulesId === 'dream' && effect.source.pluginId === input.packageId)
  if (!trance) return reject('dream-nightmare-trance-missing')
  const located = locateDnd5eSamePlaneCreatures(room, { tokenId: '', characterId: source.id },
    { tokenId: '', characterId: session.targetCharacterId })
  if (!located.ok) return located
  const message = typeof input.message === 'string' ? input.message.normalize('NFKC').trim() : ''
  if (!message || message.length > 1000) return reject('dream-nightmare-message-invalid')
  const facts = await input.confirm(Object.freeze({ message, sourceName: source.name, targetName: targets[0].name }))
  if (!facts || facts.messageWithinTenWords !== true || typeof facts.hasBodyConnection !== 'boolean') {
    return reject('dream-nightmare-message-unconfirmed')
  }
  if (JSON.stringify(input.readRoom()) !== snapshot) return reject('dream-nightmare-room-conflict')
  const receipt = Object.freeze({ sessionId: session.id })
  // This grant is for the pending Host snapshot only. It must not be published
  // as an unrestricted permanent ability on the player's character.
  const grant = createDnd5eMechanicalEffect({ id: `dream-nightmare:${session.id}`, definitionId: 'dream-nightmare-permission',
    label: '噩梦讯息', targetId: source.id, source: { kind: 'spell', rulesId: 'dream', pluginId: input.packageId, actorId: source.id },
    duration: { type: 'permanent' }, grantedActivities: ['dream-nightmare'], grantedActivitiesSingleUse: true,
    grantedActivityTargetIds: [located.target.id] })
  receipts.set(receipt, { snapshot, sourceId: source.id, targetId: session.targetCharacterId,
    packageId: input.packageId, worldMinute: input.worldMinute, hasBodyConnection: facts.hasBodyConnection, grant: structuredClone(grant) })
  return { ok: true as const, receipt, grant, sourceTokenId: located.actor.id, targetTokenId: located.target.id,
    saveFactsByTargetId: { [located.target.id]: { 'body-connection': facts.hasBodyConnection } } }
}

/** Build the same private authoritative snapshot for dice preview and settlement. */
function nightmareRuntime(input: { room: Room; receipt: Dnd5eDreamNightmareReceipt }) {
  const saved = receipts.get(input.receipt)
  const receiptPatch = planDnd5eDreamNightmareReceipt(input.room, input.receipt)
  if (!saved || !receiptPatch) return reject('dream-nightmare-receipt-unavailable')
  const activity = getRegisteredDnd5eActivity(saved.packageId, 'dream-nightmare')
  const packageVersion = listRegisteredDnd5eActivityPackages().find(entry => entry.packageId === saved.packageId)?.packageVersion
  if (!activity?.requiresEffectGrant || activity.activation.kind !== 'free' || !packageVersion ||
    activity.target.kind !== 'creature' || activity.target.count !== 1) return reject('dream-nightmare-activity-unavailable')
  const located = locateDnd5eSamePlaneCreatures(input.room, { tokenId: '', characterId: saved.sourceId },
    { tokenId: '', characterId: saved.targetId })
  if (!located.ok) return located
  const source = input.room.characters.find(character => character.id === saved.sourceId)!
  const authorizedSource: Character = { ...source, dnd5eCombatState: { ...source.dnd5eCombatState,
    activeEffects: [...source.dnd5eCombatState?.activeEffects ?? [], structuredClone(saved.grant)] } }
  const rulesMap = { ...located.actorMap, tokens: [located.actor, ...(located.actor.id === located.target.id ? [] : [located.target])] }
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: `dream-nightmare:${input.receipt.sessionId}`, round: 1,
    map: rulesMap,
    characters: input.room.characters.map(character => character.id === source.id ? authorizedSource : character),
    initiativeOrder: [], additionalCreatureTokenIds: [located.actor.id, located.target.id] })
  prepareDnd5eExplorationActor(snapshot.state, located.actor.id)
  return { ok: true as const, saved, receiptPatch, activity, packageVersion, located, authorizedSource, rulesMap, snapshot }
}

/** UI dice requests use the registered check and Host facts, never client modes. */
export function previewDnd5eDreamNightmare(input: { room: Room; receipt: Dnd5eDreamNightmareReceipt }) {
  const runtime = nightmareRuntime(input)
  if (!runtime.ok) return runtime
  const { activity, saved, located, snapshot } = runtime
  const checks = activity.checks ?? []
  if (checks.length !== 1 || checks[0].kind !== 'saving-throw') return reject('dream-nightmare-check-unavailable')
  const check = checks[0]
  const actor = snapshot.state.combatants[located.actor.id], target = snapshot.state.combatants[located.target.id]
  const mode = savingThrowModeForTarget({ check, actor, target,
    saveFactsByTargetId: { [target.id]: { 'body-connection': saved.hasBodyConnection } },
    hostSavingThrowMode: () => dnd5eActivityHostSavingThrowModeV1({ activity, actor, target, check, state: snapshot.state }) })
  return { ok: true as const, mode, count: mode === 'normal' ? 1 : 2, sides: 20 as const,
    rollId: `${check.rollId}:${target.id}`, ability: check.ability,
    targetTokenId: target.id, targetCharacterId: saved.targetId, targetName: target.name }
}

/** Resolve only the registered recipe against the original authorized pair.
 * The temporary combined map is a rules snapshot, never a scene to publish. */
export function settleDnd5eDreamNightmare(input: {
  room: Room; receipt: Dnd5eDreamNightmareReceipt; combatRevision: number
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
}) {
  const runtime = nightmareRuntime(input)
  if (!runtime.ok) return runtime
  const { saved, receiptPatch, packageVersion, located, authorizedSource, rulesMap, snapshot } = runtime
  const resolution = resolveRegisteredDnd5eActivityInCombatV1({ state: snapshot.state, combatRevision: input.combatRevision,
    actorCharacter: authorizedSource, worldMinute: saved.worldMinute, confirmedBy: 'dm',
    authoritativeRolls: input.authoritativeRolls,
    saveFactsByTargetId: { [located.target.id]: { 'body-connection': saved.hasBodyConnection } },
    command: { schemaVersion: 1, commandId: `nightmare:${input.receipt.sessionId}`, actorId: located.actor.id,
      packageId: saved.packageId, packageVersion, activityId: 'dream-nightmare', grantEffectId: saved.grant.id,
      targetIds: [located.target.id], expectedRevision: input.combatRevision } })
  if (resolution.phase !== 'commit' || !resolution.result.ok) return { ok: false as const, reason: 'dream-nightmare-settlement-rejected', resolution }
  const plan = planDnd5eMapResultApplication({ state: structuredClone(resolution.result.state), map: rulesMap,
    characters: input.room.characters, characterIdByCombatantId: snapshot.characterIdByCombatantId,
    events: [...resolution.result.events] })
  const characterPatches = { ...plan.characterPatches,
    [saved.sourceId]: { ...plan.characterPatches?.[saved.sourceId], ...receiptPatch } }
  // Merge only patches into the real scene roster. Never publish rulesMap,
  // which temporarily contains a creature from a different map.
  const publication = {
    characters: input.room.characters.map(character => characterPatches[character.id]
      ? { ...character, ...characterPatches[character.id] } : character),
    maps: input.room.maps.map(map => {
      if (map.id !== located.actorMap.id && map.id !== located.targetMap.id) return map
      return { ...map, tokens: map.tokens.map(token => plan.tokenPatches?.[token.id]
        ? { ...token, ...plan.tokenPatches[token.id] } : token) }
    }),
    characterPatches, tokenPatches: plan.tokenPatches,
    changedCharacterIds: [...new Set([...plan.changedCharacterIds, saved.sourceId])],
    changedMapIds: [...new Set([located.actorMap.id, located.targetMap.id])],
  }
  return { ok: true as const, resolution, receiptPatch, sourceCharacterId: saved.sourceId, targetCharacterId: saved.targetId,
    sourceMapId: located.actorMap.id, targetMapId: located.targetMap.id, characterIdByCombatantId: snapshot.characterIdByCombatantId,
    publication }
}

/** Include this source patch only with a successful authoritative nightmare
 * settlement, irrespective of whether the target passed its saving throw. */
export function planDnd5eDreamNightmareReceipt(room: Room, receipt: Dnd5eDreamNightmareReceipt): Partial<Character> | undefined {
  const saved = receipts.get(receipt)
  if (!saved || JSON.stringify(room) !== saved.snapshot) return undefined
  const source = room.characters.find(character => character.id === saved.sourceId)
  const session = normalizeDnd5eDreamContact(source?.dnd5eDreamContact, saved.sourceId)
  if (!session || session.id !== receipt.sessionId || session.targetCharacterId !== saved.targetId || session.nightmareAttempted) return undefined
  return { dnd5eDreamContact: { ...session, nightmareAttempted: true } }
}
