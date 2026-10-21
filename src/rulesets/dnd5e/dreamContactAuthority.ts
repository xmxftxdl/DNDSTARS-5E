import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { locateDnd5eSamePlaneCreatures } from './creatureSensorTarget'
import { beginDnd5eDreamContact } from './dreamContact'
import type { Dnd5eMapResultPlan } from './mapBridge'

type Room = { maps: readonly BattleMap[]; characters: readonly Character[] }
const failure = (reason: string) => ({ ok: false as const, reason })
export interface Dnd5eDreamContactReceipt { readonly id: string }
const receipts = new WeakMap<Dnd5eDreamContactReceipt, {
  snapshot: string; sourceId: string; targetId: string; sourceTokenId: string; sourceMapId: string
  packageId: string; worldMinute: number
}>()

/** Host-only preparation after casting. Read the live store again after the
 * asynchronous DM decision; never authorize from a caller-supplied plane flag.
 * The caller must publish the returned character with its casting transaction. */
export async function prepareDnd5eDreamContactFromRoom(input: {
  readRoom: () => Room
  sourceCharacterId: string; targetCharacterId: string
  id: string; packageId: string; worldMinute: number
  confirmEligibility: (facts: Readonly<{ sourceName: string; targetName: string }>) => Promise<{
    knowsTarget: boolean; targetCanSleep: boolean
  }>
}) {
  const room = structuredClone(input.readRoom())
  const before = JSON.stringify(room)
  const found = locateDnd5eSamePlaneCreatures(room,
    { tokenId: '', characterId: input.sourceCharacterId }, { tokenId: '', characterId: input.targetCharacterId })
  if (!found.ok) return found
  const source = room.characters.find(character => character.id === input.sourceCharacterId)
  const target = room.characters.find(character => character.id === input.targetCharacterId)
  if (!source || !target) return failure('dream-contact-character-missing')
  const facts = await input.confirmEligibility(Object.freeze({ sourceName: found.actor.label, targetName: found.target.label }))
  if (JSON.stringify(input.readRoom()) !== before) return failure('dream-contact-room-conflict')
  const prepared = beginDnd5eDreamContact({ source, target, id: input.id, packageId: input.packageId,
    worldMinute: input.worldMinute, samePlane: true,
    knowsTarget: facts.knowsTarget, targetCanSleep: facts.targetCanSleep })
  if (!prepared.ok) return prepared
  const receipt = Object.freeze({ id: input.id })
  receipts.set(receipt, { snapshot: before, sourceId: source.id, targetId: target.id,
    sourceTokenId: found.actor.id, sourceMapId: found.actorMap.id, packageId: input.packageId, worldMinute: input.worldMinute })
  return { ...prepared, receipt }
}

/** Merge into an already successful Headless result, never into the pre-cost
 * snapshot. The caller publishes this complete plan under room revisions. */
export function planDnd5eDreamContactPublication(input: {
  room: Room; receipt: Dnd5eDreamContactReceipt; application: Dnd5eMapResultPlan
}) {
  const saved = receipts.get(input.receipt)
  if (!saved || JSON.stringify(input.room) !== saved.snapshot) return failure('dream-contact-room-conflict')
  const sources = input.application.characters.filter(character => character.id === saved.sourceId)
  const targets = input.application.characters.filter(character => character.id === saved.targetId)
  const tokens = input.application.map.tokens.filter(token => token.id === saved.sourceTokenId && token.characterId === saved.sourceId)
  if (sources.length !== 1 || targets.length !== 1 || tokens.length !== 1 || input.application.map.id !== saved.sourceMapId) {
    return failure('dream-contact-publication-participant-missing')
  }
  const started = beginDnd5eDreamContact({ source: sources[0], target: targets[0], id: input.receipt.id,
    packageId: saved.packageId, worldMinute: saved.worldMinute, samePlane: true, knowsTarget: true, targetCanSleep: true })
  if (!started.ok) return started
  const character = started.character
  const tokenPatch = { dnd5eCombatState: { ...tokens[0].dnd5eCombatState, activeEffects: character.dnd5eCombatState?.activeEffects } }
  const characterPatch = { dnd5eDreamContact: character.dnd5eDreamContact, dnd5eCombatState: character.dnd5eCombatState }
  return { ok: true as const, application: { ...input.application,
    characters: input.application.characters.map(value => value.id === character.id ? character : value),
    map: { ...input.application.map, tokens: input.application.map.tokens.map(token => token.id === saved.sourceTokenId ? { ...token, ...tokenPatch } : token) },
    changedCharacterIds: [...new Set([...input.application.changedCharacterIds, character.id])],
    changedTokenIds: [...new Set([...input.application.changedTokenIds, saved.sourceTokenId])],
    characterPatches: { ...input.application.characterPatches, [character.id]: { ...input.application.characterPatches?.[character.id], ...characterPatch } },
    tokenPatches: { ...input.application.tokenPatches, [saved.sourceTokenId]: { ...input.application.tokenPatches?.[saved.sourceTokenId], ...tokenPatch } },
  } satisfies Dnd5eMapResultPlan }
}
