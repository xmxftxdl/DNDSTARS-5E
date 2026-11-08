import { liveDnd5eMapInventoryBoundEffects } from '../../rulesets/dnd5e/mapInventoryBoundEffects'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eExecutionEventKey } from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import { reconcileDnd5eInventoryEffectBindings } from '../../rulesets/dnd5e/inventoryEffectBindings'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'

export type PactInventoryOperation = {
  kind: 'destroy-summoned-instance' | 'release-magic-instance-at-owner-feet' |
    'remove-pact-bond' | 'stow-bound-magic-instance' |
    'summon-bound-magic-instance-to-hand' | 'place-new-pact-instance-in-hand'
  inventoryInstanceId: string
  reason?: string
}
export interface PactInventoryDocument {
  schemaVersion: 1
  ownerId: string
  revision: number
  stowed: Dnd5eInventoryEntry[]
  receipts: { transactionId: string; operations: string }[]
}
type Input = {
  /** This is a Host transition result, never an untrusted inventory command. */
  hostClock?: {worldSecond:number;revision:number}
  operations: readonly PactInventoryOperation[]
  document: PactInventoryDocument
  expectedRevision: number
  expectedInventoryRevisions: Readonly<Record<string, number>>
  transactionId: string
  characters: readonly Character[]
  map: BattleMap
}
type Result = { ok: false; reason: string } | {
  ok: true; document: PactInventoryDocument; characters: Character[]; map: BattleMap; deduplicated?: true
}

/** Plans real inventory, equipment, ground and extradimensional changes together.
 * Caller must CAS all returned values with the bound-weapon state/action economy.
 * No caller input is mutated, including when an operation later in the plan fails.
 */
export function planPactWeaponInventoryTransaction(input: Input): Result {
  const fail = (reason: string): Result => ({ ok: false, reason })
  if (!input.transactionId || input.transactionId.length > 180 || input.document.schemaVersion !== 1 ||
    !Number.isSafeInteger(input.document.revision) || input.document.revision < 0 ||
    input.characters.filter(c => c.id === input.document.ownerId).length !== 1) return fail('invalid-pact-transaction')
  const fingerprint = JSON.stringify(input.operations)
  const prior = input.document.receipts.find(receipt => receipt.transactionId === input.transactionId)
  if (prior) return prior.operations === fingerprint
    ? { ok: true, document: structuredClone(input.document), characters: structuredClone([...input.characters]),
      map: structuredClone(input.map), deduplicated: true }
    : fail('pact-transaction-id-conflict')
  if (input.document.revision !== input.expectedRevision) return fail('pact-inventory-revision-changed')
  const ownerId = input.document.ownerId
  let characters = structuredClone([...input.characters])
  const map = structuredClone(input.map)
  const document = structuredClone(input.document)
  const touched = new Set<string>()
  const inventory = (character: Character) => normalizeDnd5eInventory(character)
  // Verify the entire loaded roster. A duplicate in another inventory must never
  // become a silent second copy when the first instance is stowed or summoned.
  const located = (instanceId: string) => {
    const carried = characters.flatMap(character => inventory(character).entries
      .filter(entry => entry.instanceId === instanceId).map(entry => ({ entry, character })))
    const ground = map.tokens.filter(token => token.dnd5eObjectState?.inventoryItem?.instance?.instanceId === instanceId)
    const nested = map.tokens.some(token => token.dnd5eObjectState?.inventoryItem?.contents?.some(entry => entry.instanceId === instanceId) ||
      token.dnd5eCarriedObjects?.some(held => held.objectState.inventoryItem?.instance?.instanceId === instanceId ||
        held.objectState.inventoryItem?.contents?.some(entry => entry.instanceId === instanceId)))
    const stowed = document.stowed.filter(entry => entry.instanceId === instanceId)
    return { carried, ground, stowed, nested, count: carried.length + ground.length + stowed.length + Number(nested) }
  }
  const checkRevision = (character: Character) => {
    if (touched.has(character.id)) return true
    if (input.expectedInventoryRevisions[character.id] !== inventory(character).revision) return false
    touched.add(character.id)
    return true
  }
  const extract = (instanceId: string): Dnd5eInventoryEntry | undefined => {
    const found = located(instanceId)
    if (found.count !== 1 || found.nested) return undefined
    if (found.stowed.length) {
      const entry = found.stowed[0]
      document.stowed = document.stowed.filter(item => item.instanceId !== instanceId)
      return entry
    }
    if (found.carried.length) {
      const { character, entry } = found.carried[0]
      if (!checkRevision(character) || entry.quantity !== 1 || entry.containerInstanceId ||
        (character.id !== ownerId && entry.attuned === true) ||
        inventory(character).entries.some(child => child.containerInstanceId === instanceId)) return undefined
      const removed = applyDnd5eInventoryMutation(characters,
        { type: 'discard', characterId: character.id, instanceId, quantity: 1 })
      if (!removed.ok) return undefined
      characters = removed.characters
      return { ...entry, equippedSlot: undefined, containerInstanceId: undefined }
    }
    const token = found.ground[0]
    if (token.dnd5eObjectState?.inventoryItem?.contents?.length) return undefined
    const entry = token.dnd5eObjectState!.inventoryItem!.instance!
    map.tokens = map.tokens.filter(item => item.id !== token.id)
    return { ...entry, equippedSlot: undefined, containerInstanceId: undefined }
  }
  const putInHand = (entry: Dnd5eInventoryEntry): boolean => {
    const ownerIndex = characters.findIndex(c => c.id === ownerId)
    const owner = characters[ownerIndex]
    if (!checkRevision(owner) || entry.quantity !== 1 || entry.condition?.destroyed ||
      entry.item.equipment?.dnd5e?.kind !== 'weapon') return false
    const slot = !owner.equipment?.mainWeapon ? 'mainWeapon' : !owner.equipment?.offHand ? 'offHand' : undefined
    if (!slot) return false
    const current = inventory(owner)
    characters[ownerIndex] = { ...owner, dnd5eInventory: { ...current, revision: current.revision! + 1,
      entries: [...current.entries, { ...entry, equippedSlot: undefined, containerInstanceId: undefined }] } }
    const equipped = applyDnd5eInventoryMutation(characters, { type: 'equip', characterId: ownerId, instanceId: entry.instanceId, slot })
    if (!equipped.ok) return false
    characters = equipped.characters
    return true
  }
  for (const operation of input.operations) {
    if (!operation.inventoryInstanceId || operation.inventoryInstanceId.length > 320) return fail('invalid-pact-instance')
    const found = located(operation.inventoryInstanceId)
    if (found.count > 1 || found.nested) return fail('pact-instance-conflict-or-unsupported-location')
    if (operation.kind === 'remove-pact-bond') {
      if (found.count !== 1 || found.stowed.length) return fail('bound-instance-unavailable')
      continue
    }
    // Destroying an already dismissed summoned instance is intentionally a no-op:
    // its bond remains in the rule state until another weapon is created.
    if (operation.kind === 'destroy-summoned-instance' && found.count === 0) continue
    const dormantAnchorId = `pact-stow:${dnd5eExecutionEventKey(operation.inventoryInstanceId)}`
    const groundEffects = liveDnd5eMapInventoryBoundEffects(found.ground[0]?.dnd5eObjectState?.inventoryItem?.boundEffects ?? [],map,characters)
    const clockRecords = (map as BattleMap & {dnd5ePactGroundEffectClocks?:{instanceId:string;tokenId:string;effectId:string;observedSecond:number;clockRevision:number;expired:boolean}[]}).dnd5ePactGroundEffectClocks ?? []
    if (groundEffects.some(effect => effect.duration.type !== 'permanent' && !clockRecords.some(record =>
      record.instanceId===operation.inventoryInstanceId && record.tokenId===found.ground[0]?.id && record.effectId===effect.id && !record.expired &&
      record.observedSecond===input.hostClock?.worldSecond && record.clockRevision===input.hostClock?.revision))) return fail('pact-ground:authoritative-clock-proof-required')
    const boundEffects = [...characters.flatMap(actor => (actor.dnd5eCombatState?.activeEffects ?? []).filter(effect =>
      (effect.modifiers?.weaponEnchantment?.inventoryInstanceId ?? effect.modifiers?.armorEnchantment?.inventoryInstanceId) === operation.inventoryInstanceId
    ).map(effect => ({ characterId: actor.id, effect }))), ...groundEffects.map(effect => ({characterId:ownerId,effect}))]
    const entry = extract(operation.inventoryInstanceId)
    if (!entry) return fail('pact-instance-unavailable-or-inventory-changed')
    if (operation.kind === 'destroy-summoned-instance') continue
    if (operation.kind === 'stow-bound-magic-instance') {
      document.stowed.push(entry)
      for (const captured of boundEffects) {
        const actor = characters.find(row => row.id === captured.characterId)!
        const effects = actor.dnd5eCombatState?.activeEffects ?? []
        const anchor = createDnd5eMechanicalEffect({id:dormantAnchorId,definitionId:'pact-weapon.extradimensional-storage',label:'Pact weapon in extradimensional storage',targetId:actor.id,source:{kind:'feature',actorId:ownerId},duration:{type:'permanent'},modifiers:{}})
        actor.dnd5eCombatState = {...actor.dnd5eCombatState,schemaVersion:2,activeEffects:[...effects.filter(effect => effect.id !== captured.effect.id && effect.id !== dormantAnchorId),anchor,{...captured.effect,suspendedBy:[...new Set([...(captured.effect.suspendedBy ?? []),dormantAnchorId])]}]}
      }
      continue
    }
    if (operation.kind === 'summon-bound-magic-instance-to-hand' || operation.kind === 'place-new-pact-instance-in-hand') {
      // Read only the currently live effects. Nothing is restored from a frozen inventory snapshot.
      for (const actor of characters) if (actor.dnd5eCombatState) actor.dnd5eCombatState = {...actor.dnd5eCombatState,activeEffects:actor.dnd5eCombatState.activeEffects?.filter(effect => effect.id !== dormantAnchorId && !boundEffects.some(row => row.effect.id === effect.id))}
      if (!putInHand(entry)) return fail('pact-hand-or-inventory-unavailable')
      const recipient = characters.find(actor => actor.id === ownerId)!
      recipient.dnd5eCombatState = {...recipient.dnd5eCombatState,schemaVersion:2,activeEffects:[...(recipient.dnd5eCombatState?.activeEffects ?? []),...boundEffects.map(({effect}) => ({...effect,targetId:ownerId,suspendedBy:effect.suspendedBy?.filter(id => id !== dormantAnchorId)}))]}
      characters = reconcileDnd5eInventoryEffectBindings(characters)
      continue
    }
    if (operation.kind !== 'release-magic-instance-at-owner-feet') return fail('unsupported-pact-inventory-operation')
    if (boundEffects.some(row => row.effect.duration.type !== 'permanent') && (!input.hostClock || input.hostClock.revision<0)) return fail('pact-ground:authoritative-clock-proof-required')
    for (const actor of characters) if (actor.dnd5eCombatState) actor.dnd5eCombatState = {...actor.dnd5eCombatState,activeEffects:actor.dnd5eCombatState.activeEffects?.filter(effect => effect.id !== dormantAnchorId && !boundEffects.some(row => row.effect.id === effect.id))}
    const owners = map.tokens.filter(token => token.characterId === ownerId)
    const tokenId = `pact-release:${input.transactionId}:${operation.inventoryInstanceId}`
    if (owners.length !== 1 || ![owners[0].x, owners[0].y].every(Number.isFinite) || map.tokens.some(token => token.id === tokenId))
      return fail('pact-owner-location-unavailable')
    const owner = owners[0]
    const token: Token = { id: tokenId, type: 'obstacle', label: entry.item.name,
      x: owner.x, y: owner.y, elevationFeet: owner.elevationFeet, size: 1, color: '', emoji: '',
      dnd5eObjectState: { schemaVersion: 1, wornOrCarried: false, weightPounds: entry.item.weightLb,
        inventoryItem: { templateId: entry.templateId, quantity: 1, receiptId: tokenId,
          identified: entry.identified, instance: entry, boundEffects: boundEffects.map(({effect}) => ({...effect,targetId:tokenId,suspendedBy:effect.suspendedBy?.filter(id => id !== dormantAnchorId)})) } } }
    map.tokens.push(token)
  }
  document.revision += 1
  document.receipts.push({ transactionId: input.transactionId, operations: fingerprint })
  return { ok: true, document, characters, map }
}

