import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eActivePlanarPhase, effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eMapPlaneRelation } from './mapPlane'
import { registerDnd5eHostReceipt } from './hostTransactionClone'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { dnd5eRestSpellSensorActivity } from './activities/dnd5eRestSpellSensor'

type Room = { maps: readonly BattleMap[]; characters: readonly Character[] }
interface Request {
  actorMapId: string; actorTokenId: string; targetMapId: string; targetTokenId: string
  packageId: string; activityId: string; actionId: string; choices: Readonly<Record<string, string>>
}
interface Identity { tokenId: string; characterId?: string }
export interface Dnd5eCreatureSensorTargetReceipt {
  readonly request: Readonly<Request>
  readonly actor: Readonly<Identity>
  readonly target: Readonly<Identity>
  readonly activitySnapshot: string
}
const receipts = new WeakSet<Dnd5eCreatureSensorTargetReceipt>()
const failure = (reason: string) => ({ ok: false as const, reason })

export function locateDnd5eSamePlaneCreatures(room: Room, actorIdentity: Identity, targetIdentity: Identity) {
  const find = (identity: Identity) => room.maps.flatMap(map => map.tokens
    .filter(token => token.type !== 'obstacle' && (identity.characterId ? token.characterId === identity.characterId : token.id === identity.tokenId))
    .map(token => ({ map, token })))
  const actors = find(actorIdentity), targets = find(targetIdentity)
  if (actors.length !== 1 || targets.length !== 1) return failure('sensor-identity-missing-or-ambiguous')
  const actor = actors[0], target = targets[0]
  if (room.maps.some(map => room.maps.filter(other => other.id === map.id).length !== 1) ||
    room.maps.flatMap(map => map.tokens).filter(token => token.id === actor.token.id).length !== 1 ||
    room.maps.flatMap(map => map.tokens).filter(token => token.id === target.token.id).length !== 1) return failure('sensor-identity-missing-or-ambiguous')
  const character = (token: Token) => room.characters.filter(entry => entry.id === token.characterId)
  if ([actor, target].some(({token}) => token.characterId && character(token).length !== 1)) return failure('invalid-sensor-character')
  const effects = (token: Token) => character(token)[0]?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects
  if ([actor, target].some(({token}) => effectiveDnd5eActiveEffects(effects(token)).some(effect => effect.legacyCondition === 'banished'))) return failure('plane-unknown')
  const relation = dnd5eMapPlaneRelation(actor.map, target.map)
  if (relation !== 'same') return failure(relation === 'unknown' ? 'plane-unknown' : 'different-plane')
  const actorPhase = dnd5eActivePlanarPhase(effects(actor.token)).plane
  const targetPhase = dnd5eActivePlanarPhase(effects(target.token)).plane
  if (actorPhase !== targetPhase) return failure('different-plane')
  return { ok: true as const, actorMap: actor.map, targetMap: target.map, actor: actor.token, target: target.token, phase: targetPhase }
}

export function dnd5eCreatureSensorActivity(activity: NonNullable<ReturnType<typeof getRegisteredDnd5eActivity>>): boolean {
  return !(!dnd5eRestSpellSensorActivity(activity) || activity.target.kind !== 'creature' ||
    activity.target.count !== 1 || activity.target.rangeFeet != null || activity.target.requiresLineOfSight || activity.target.requiresLineOfEffect ||
    !activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'create-persistent-area' && operation.effectToken?.followSelectedTarget)) ||
    activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind !== 'apply-effect' &&
      !(operation.kind === 'create-persistent-area' && operation.effectToken?.followSelectedTarget))))
}

/** Knowledge and selected rule facts are confirmed by Host, not player coordinates.
 * This receipt only identifies the target. It never authorizes resource spending. */
export async function authorizeDnd5eCreatureSensorTarget(input: {
  room: Room; request: Request
  confirmKnowledge: (facts: Readonly<{ actorName: string; targetName: string; activityName: string; choices: Readonly<Record<string, string>> }>) => Promise<boolean>
}) {
  const request = structuredClone(input.request)
  const activity = getRegisteredDnd5eActivity(request.packageId, request.activityId)
  if (!request.actionId.trim() || !activity || !dnd5eCreatureSensorActivity(activity)) return failure('unsupported-creature-sensor-activity')
  const choices = activity.choices ?? []
  if (Object.keys(request.choices).length !== choices.length || choices.some(choice =>
    !choice.options?.some(option => option.id === request.choices[choice.id]))) return failure('invalid-sensor-choices')
  const actor = input.room.maps.find(map => map.id === request.actorMapId)?.tokens.find(token => token.id === request.actorTokenId)
  const target = input.room.maps.find(map => map.id === request.targetMapId)?.tokens.find(token => token.id === request.targetTokenId)
  if (!actor || !target) return failure('sensor-target-missing')
  const actorIdentity = { tokenId: actor.id, characterId: actor.characterId }, targetIdentity = { tokenId: target.id, characterId: target.characterId }
  const found = locateDnd5eSamePlaneCreatures(input.room, actorIdentity, targetIdentity)
  if (!found.ok) return found
  const before = JSON.stringify(input.room), activitySnapshot = JSON.stringify(activity)
  if (!await input.confirmKnowledge(Object.freeze({ actorName: actor.label, targetName: target.label, activityName: activity.name,
    choices: Object.freeze({ ...request.choices }) }))) return failure('sensor-target-not-known')
  if (JSON.stringify(input.room) !== before || JSON.stringify(getRegisteredDnd5eActivity(request.packageId, request.activityId)) !== activitySnapshot) return failure('sensor-target-conflict')
  const receipt = registerDnd5eHostReceipt(Object.freeze({ request: Object.freeze({ ...request, choices: Object.freeze(request.choices) }),
    actor: Object.freeze(actorIdentity), target: Object.freeze(targetIdentity), activitySnapshot }))
  receipts.add(receipt)
  return { ok: true as const, receipt }
}

/** Re-resolve after long casting. Moving or changing Token IDs does not change a
 * bound character, but ambiguity, another plane or changed content invalidates it. */
export function resolveDnd5eCreatureSensorTarget(input: { room: Room; receipt: Dnd5eCreatureSensorTargetReceipt;
  actionId: string; packageId: string; activityId: string; choices: Readonly<Record<string, string>> }) {
  const { receipt } = input
  if (!receipts.has(receipt) || input.actionId !== receipt.request.actionId || input.packageId !== receipt.request.packageId ||
    input.activityId !== receipt.request.activityId || JSON.stringify(input.choices) !== JSON.stringify(receipt.request.choices) ||
    JSON.stringify(getRegisteredDnd5eActivity(input.packageId, input.activityId)) !== receipt.activitySnapshot) return failure('invalid-sensor-target-receipt')
  return locateDnd5eSamePlaneCreatures(input.room, receipt.actor, receipt.target)
}
