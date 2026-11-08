import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { dnd5eClassDefinitionForCharacter } from '../../rulesets/dnd5e/classes'
import { applyDnd5eInventoryMutation, DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES, normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'
import { spendDnd5eTurnResource } from '../../rulesets/dnd5e/turnEconomy'
import { dnd5eConditionIncapacitated } from '../../rulesets/dnd5e/conditions'
import { dnd5eConditionsFromActiveEffects, normalizeDnd5eActiveEffects } from '../../rulesets/dnd5e/activeEffects'
import { transitionPactWeapon, authorizePactWeaponCreation } from './pactWeaponBinding.mjs'
import { planPactWeaponInventoryTransaction, type PactInventoryDocument } from './pactWeaponInventoryTransaction'
import { establishPactWeaponPhysicalIdentity } from './pactWeaponPhysicalIdentity'

type PactState = NonNullable<ReturnType<typeof import('./pactWeaponBinding.mjs').normalizePactWeaponState>>
type Input = {
  characters: readonly Character[]; map: BattleMap; document: PactInventoryDocument; state: PactState
  actorTokenId: string; templateId?: string; expectedRevision: number; expectedInventoryRevision: number
  transactionId: string; hostClockRevision?:number; worldSecond: number
  combat?: { currentTokenId: string; turnEconomy: Dnd5eTurnEconomyCounts }
  /** Only a Host registry/prerequisite resolver may supply this fact. The command has no entitlement flag. */
  hostEntitlements: { improvedPactWeapon: boolean }
}

/** Host-side composition. The returned state, inventory document, roster, map and
 * action economy must be committed together by the eventual authority adapter.
 * This planner neither accepts client-generated inventory instances nor writes stores.
 */
export function planPactWeaponSummon(input: Input) {
  const fail = (reason: string) => ({ ok: false as const, reason })
  const actors = input.map.tokens.filter(token => token.id === input.actorTokenId)
  const owners = input.characters.filter(character => character.id === actors[0]?.characterId)
  if (actors.length !== 1 || owners.length !== 1) return fail('pact-owner-unavailable')
  const owner = owners[0]
  const level = owner.dnd5eClassLevels?.warlock ?? (dnd5eClassDefinitionForCharacter(owner)?.id === 'warlock' ? owner.level : 0)
  if (level < 3 || !owner.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade')) return fail('blade-pact-required')
  if (owner.id !== input.state.ownerId || owner.id !== input.document.ownerId || input.state.revision !== input.expectedRevision) return fail('pact-owner-or-revision-changed')
  if (owner.currentHp <= 0 || dnd5eConditionIncapacitated({ conditions: [...(owner.conditions ?? []),
    ...dnd5eConditionsFromActiveEffects(normalizeDnd5eActiveEffects(owner.dnd5eCombatState?.activeEffects))] })) return fail('pact-owner-incapacitated')
  const inventory = normalizeDnd5eInventory(owner)
  if (inventory.revision !== input.expectedInventoryRevision) return fail('pact-inventory-changed')
  if (owner.equipment?.mainWeapon && owner.equipment?.offHand) return fail('free-hand-required')
  let turnEconomy = input.combat?.turnEconomy
  if (input.combat) {
    if (input.combat.currentTokenId !== input.actorTokenId) return fail('pact-invalid-turn')
    const spent = spendDnd5eTurnResource(input.combat.turnEconomy, 'action')
    if (!spent.ok) return fail('pact-action-unavailable')
    turnEconomy = spent.economy
  }
  const baseId = (entry: { equipment?: { baseEquipmentId?: string; id: string } }) =>
    (entry.equipment?.baseEquipmentId ?? entry.equipment?.id ?? '').replace(/^dnd5e-/, '')
  // Creation chooses a mundane Weapons-table form, never a shop magic item or
  // another imported item's enchantments. Existing bonded magic weapons below
  // retain their exact instance and use the separate binding/summoning path.
  const catalog = DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES.filter(template => template.equipment?.dnd5e?.kind === 'weapon' && template.equipment.slot === 'mainWeapon')
  const host = { ownerId: owner.id, worldSecond: input.worldSecond, transactionId: input.transactionId,
    hasFreeHand: true, hasBladePact: true, hasImprovedPactWeapon: input.hostEntitlements.improvedPactWeapon,
    weaponCatalog: catalog.map(template => ({ weaponBaseId: baseId(template), isWeapon: true,
      isMelee: template.equipment!.dnd5e!.kind === 'weapon' && template.equipment!.dnd5e!.mode === 'melee' })),
    inventory: [] as { inventoryInstanceId: string; weaponBaseId: string; isWeapon: boolean;
      pactCreationOwnerId?: string; pactCreationTransactionId?: string }[],
    stowedPactInstances: input.document.stowed.map(entry => ({ ownerId: owner.id,
      inventoryInstanceId: entry.instanceId, weaponBaseId: baseId(entry.item) })) }
  let characters = structuredClone([...input.characters])
  let instanceId = input.state.binding?.origin === 'ritually-bound-magic' ? input.state.binding.inventoryInstanceId : undefined
  if (!instanceId) {
    const template = catalog.find(entry => entry.id === input.templateId)
    if (!template || !authorizePactWeaponCreation(host, baseId(template))) return fail('illegal-pact-weapon-form')
    const granted = applyDnd5eInventoryMutation(characters, { type: 'grant', characterId: owner.id, templateId: template.id, quantity: 1 })
    if (!granted.ok) return fail(granted.reason ?? 'pact-inventory-grant-failed')
    const grantedOwner = granted.characters.find(character => character.id === owner.id)!
    const added = normalizeDnd5eInventory(grantedOwner).entries.filter(entry => !inventory.entries.some(old => old.instanceId === entry.instanceId))
    if (added.length !== 1 || added[0].quantity !== 1) return fail('pact-inventory-grant-ambiguous')
    instanceId = added[0].instanceId
    host.inventory.push({ inventoryInstanceId: instanceId, weaponBaseId: baseId(added[0].item), isWeapon: true,
      pactCreationOwnerId: owner.id, pactCreationTransactionId: input.transactionId })
    const identified = establishPactWeaponPhysicalIdentity(granted.characters, owner.id, instanceId)
    if (!identified.ok) return fail(identified.reason)
    characters = identified.characters
  } else {
    for (const character of characters) for (const entry of normalizeDnd5eInventory(character).entries)
      host.inventory.push({ inventoryInstanceId: entry.instanceId, weaponBaseId: baseId(entry.item), isWeapon: entry.item.equipment?.dnd5e?.kind === 'weapon' })
  }
  const transition = transitionPactWeapon(input.state, { ownerId: owner.id, expectedRevision: input.expectedRevision,
    kind: 'summon', inventoryInstanceId: instanceId }, host)
  if (!transition.ok) return fail(transition.reason!)
  const plan = planPactWeaponInventoryTransaction({ hostClock:{worldSecond:input.worldSecond,revision:input.hostClockRevision??-1}, document: input.document, expectedRevision: input.document.revision,
    transactionId: input.transactionId, expectedInventoryRevisions: Object.fromEntries(characters.map(character =>
      [character.id, normalizeDnd5eInventory(character).revision!])), characters, map: input.map, operations: transition.inventoryOperations })
  if (!plan.ok) return plan
  return { ...plan, state: transition.state, turnEconomy }
}
