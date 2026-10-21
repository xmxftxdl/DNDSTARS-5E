import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterWithHeldWeapon, prepareDnd5eCompanionHeldWeapon, prepareDnd5eCompanionCombatWeaponChange, consumeDnd5eCompanionAmmunition } from './companionHeldWeapon'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from './monsterAttackAction'
import { normalizeDnd5eCompanionCarriedObjects, droppedDnd5eCompanionObjects } from './companionCarriedObjects'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eSourceLinkedRelations, resolveDnd5eHeadlessAction, dnd5eTargetArmorClassForAttack } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { DND5E_LONGBOW } from './equipment'
import { prepareDnd5eMapInventoryDrop } from './mapInventoryDrop'
import { prepareDnd5eMapInventoryPickup } from './mapInventoryPickup'
import { dnd5eCompanionWornArmor, dnd5eCompanionSceneWornArmor, prepareDnd5eCompanionArmorChange } from './companionWornArmor'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { reconcileDnd5eSummonedCreatures } from './summonedCreatures'

function fixture(proficient: boolean, spellBonus: number) {
  const actor: Token = { id: 'undead', type: 'enemy', label: 'Skeleton', poolId: 'srd-5.1:skeleton', hp: 13, maxHp: 13,
    x: 25, y: 25, size: 1, color: '', emoji: '',
    dnd5eSummon: { schemaVersion: 1, pluginId: 'local', featureId: 'danse', sourceCharacterId: 'caster', sourceTokenId: 'owner',
      createdRound: 1, expiresAfterRound: 600, side: 'player', weaponAttackBonus: spellBonus, weaponDamageBonus: spellBonus },
    dnd5eCarriedObjects: [{ id: 'sword', pickupReceipt: 'scene-reward', label: 'Longsword', objectState: {
      schemaVersion: 1, wornOrCarried: true, inventoryItem: { templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1, receiptId: 'scene-reward' } } }] }
  actor.dnd5eCarriedObjects = prepareDnd5eCompanionHeldWeapon(actor, 'sword', proficient)!
  const target: Token = { id: 'goblin', type: 'enemy', poolId: 'srd-5.1:goblin', label: 'Target', hp: 100, maxHp: 100,
    x: 75, y: 25, size: 1, color: '', emoji: '' }
  const map: BattleMap = { id: 'held-weapons', name: 'Held', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actor, target] }
  const monster = getDnd5eSrdMonster(actor.poolId!)!
  return { actor, target, monster, input: { map, characters: [], actorTokenId: actor.id, targetTokenId: target.id,
    combatId: 'combat', round: 1, actionIndex: monster.actions.length,
    initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, color: '', emoji: '', roll: 20-index })) } }
}

it('applies only live enchantments on the exact worn armor instance without stacking or reviving stale effects', () => {
  const { actor, monster, input } = fixture(true, 0)
  const granted = applyDnd5eInventoryMutation([normalizeCharacter({ id: 'armor-owner', name: 'Owner' })],
    { type: 'grant', characterId: 'armor-owner', templateId: 'srd-5.1:equipment:dnd5e-chain-mail', quantity: 1 })
  expect(granted.ok).toBe(true)
  const instance = granted.characters[0].dnd5eInventory!.entries.find(entry => entry.templateId === 'srd-5.1:equipment:dnd5e-chain-mail')!
  const effect = createDnd5eMechanicalEffect({ id: 'armor-enchantment', definitionId: 'armor-test', label: 'Armor', targetId: actor.id,
    source: { kind: 'spell', actorId: 'owner', rulesId: 'armor-test' }, duration: { type: 'permanent' },
    modifiers: { armorEnchantment: { armorId: 'dnd5e-chain-mail', inventoryInstanceId: instance.instanceId, armorClassBonus: 2 } } })
  effect.suspendedBy = ['inventory-binding:not-held']
  actor.dnd5eNativeArmorRemoved = true
  actor.dnd5eCarriedObjects = [{ id: 'armor', pickupReceipt: 'armor', label: 'Armor', wornArmor: { proficient: true },
    objectState: { schemaVersion: 1, wornOrCarried: true, inventoryItem: {
      templateId: 'srd-5.1:equipment:dnd5e-chain-mail', quantity: 1, receiptId: 'armor', instance, boundEffects: [effect] } } }]
  const inventory = actor.dnd5eCarriedObjects[0].objectState.inventoryItem!
  const original = structuredClone(actor)
  expect(dnd5eCompanionWornArmor(actor, monster)?.armorClass).toBe(16)
  expect(dnd5eCompanionWornArmor(actor, monster, () => false)?.armorClass).toBe(16)
  expect(dnd5eCompanionWornArmor(actor, monster, () => true)?.armorClass).toBe(18)
  expect(actor).toEqual(original)
  const state = createDnd5eMapCombatSnapshot(input).state
  expect(state.combatants[actor.id].armorClass).toBe(16)
  expect(dnd5eTargetArmorClassForAttack(state, 'goblin', actor.id)).toBe(18)
  expect(dnd5eTargetArmorClassForAttack(state, 'goblin', actor.id)).toBe(18)
  state.combatants[actor.id].magicSuppressed = true
  expect(dnd5eTargetArmorClassForAttack(state, 'goblin', actor.id)).toBe(16)
  state.combatants[actor.id].magicSuppressed = false
  expect(dnd5eTargetArmorClassForAttack(state, 'goblin', actor.id)).toBe(18)
  expect(dnd5eCompanionSceneWornArmor(actor, monster, input.map, [])?.armorClass).toBe(18)
  const attackInput = { ...input, actorTokenId: 'goblin', targetTokenId: actor.id, actionIndex: 0,
    initiativeOrder: [...input.initiativeOrder].reverse() }
  for (const active of [true, false]) {
    effect.duration = active ? { type: 'permanent' } : { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' }
    const attack = prepareDnd5eMonsterAttack(attackInput)
    expect(attack.ok).toBe(true)
    if (!attack.ok) throw Error(attack.reason)
    // Goblin scimitar +4: a total of 17 hits ordinary chain mail, but not +2 mail.
    const settled = resolvePreparedDnd5eMonsterAttack({ prepared: attack.prepared,
      rolls: [{ d20: 13, d20Second: 13, damageRolls: [[4]] }] })
    expect(settled.result.ok).toBe(true)
    expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved',
      actorId: 'goblin', targetId: actor.id, armorClass: active ? 18 : 16, hit: !active }))
    expect(settled.result.state.combatants[actor.id].currentHp).toBe(actor.hp! - (active ? 0 : 6))
  }
  effect.duration = { type: 'permanent' }
  const reloaded = createDnd5eMapCombatSnapshot({ ...input, map: JSON.parse(JSON.stringify(input.map)) }).state
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'goblin', actor.id)).toBe(18)
  const liveEffect = reloaded.companionScene!.map.tokens.find(token => token.id === actor.id)!
    .dnd5eCarriedObjects![0].objectState.inventoryItem!.boundEffects![0]
  liveEffect.duration = { type: 'concentration', sourceActorId: 'goblin', concentrationId: 'armor-test', remainingRounds: 10 }
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'goblin', actor.id)).toBe(16)
  reloaded.combatants.goblin.concentrating = true
  reloaded.combatants.goblin.classState.concentrationSpellId = 'armor-test'
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'goblin', actor.id)).toBe(18)
  reloaded.combatants.goblin.concentrating = false
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'goblin', actor.id)).toBe(16)
  liveEffect.duration = { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' }
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'goblin', actor.id)).toBe(16)
  inventory.boundEffects!.push({ ...structuredClone(effect), id: 'weaker', modifiers: {
    armorEnchantment: { ...effect.modifiers!.armorEnchantment!, armorClassBonus: 1 } } })
  expect(dnd5eCompanionWornArmor(actor, monster, () => true)?.armorClass).toBe(18)
  inventory.boundEffects = [effect]
  effect.suspendedBy = [...effect.suspendedBy, 'persistent-area:antimagic']
  expect(dnd5eCompanionWornArmor(actor, monster, () => true)?.armorClass).toBe(16)
  effect.suspendedBy = []
  effect.modifiers!.armorEnchantment!.inventoryInstanceId = 'another-instance'
  expect(normalizeDnd5eCompanionCarriedObjects(actor.dnd5eCarriedObjects)).toBeUndefined()
  expect(dnd5eCompanionWornArmor(actor, monster, () => true)?.armorClass).toBe(12)
  effect.modifiers!.armorEnchantment!.inventoryInstanceId = instance.instanceId
  effect.modifiers!.armorEnchantment!.armorId = 'dnd5e-plate'
  expect(dnd5eCompanionWornArmor(actor, monster, () => true)?.armorClass).toBe(16)
  actor.dnd5eCarriedObjects[0].wornArmor = undefined
  expect(dnd5eCompanionWornArmor(actor, monster, () => true)?.armorClass).toBe(12)
})

it.each([159, 160, 161])('settles armor against the real summon expiry boundary at minute %s without losing possessions', completion => {
  const { actor, input } = fixture(true, 0)
  actor.dnd5eNativeArmorRemoved = true
  actor.dnd5eSummon!.createdWorldMinute = 100
  actor.dnd5eSummon!.animatedCorpse = { ...input.map.tokens[1], id: 'original-body', hp: 0 }
  input.map.tokens.push({ id: 'owner', characterId: 'caster', type: 'player', x: 25, y: 25, size: 1, label: 'Owner', color: '', emoji: '' })
  actor.dnd5eCarriedObjects!.push({ id: 'armor', pickupReceipt: 'armor', label: 'Chain mail', objectState: {
    schemaVersion: 1, wornOrCarried: true, inventoryItem: { templateId: 'srd-5.1:equipment:dnd5e-chain-mail', quantity: 1, receiptId: 'armor' } } })
  const original = structuredClone(input.map)
  const result = prepareDnd5eCompanionArmorChange({ token: actor, itemId: 'armor', proficient: true, combatActive: false,
    startedWorldMinute: completion - 10, completedWorldMinute: completion })!
  expect(result.interrupted).toBe(completion >= 160)
  expect(result.complete).toBe(completion < 160)
  expect(input.map).toEqual(original)
  if (result.complete) actor.dnd5eCarriedObjects = result.carried
  else expect(result.carried).toBeUndefined()
  const expired = reconcileDnd5eSummonedCreatures({ map: input.map, characters: [], round: 1, worldMinute: completion })
  if (completion < 160) {
    expect(expired.removedTokenIds).toEqual([])
    expect(expired.map.tokens.find(token => token.id === actor.id)?.dnd5eCarriedObjects?.find(item => item.id === 'armor')?.wornArmor).toEqual({ proficient: true })
  } else {
    expect(expired.removedTokenIds).toEqual([actor.id])
    expect(expired.map.tokens.find(token => token.id === 'original-body')).toMatchObject({ hp: 0, x: actor.x, y: actor.y })
    expect(expired.map.tokens.filter(token => token.id === 'carried:armor')).toHaveLength(1)
    expect(expired.map.tokens.filter(token => token.id === 'carried:sword')).toHaveLength(1)
    expect(expired.map.tokens.find(token => token.id === 'carried:armor')?.dnd5eObjectState?.wornOrCarried).toBe(false)
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [expired.map] }))).maps[0]
    const retry = reconcileDnd5eSummonedCreatures({ map: restored, characters: [], round: 1, worldMinute: completion })
    expect(retry.removedTokenIds).toEqual([])
    expect(retry.map.tokens.filter(token => token.id === 'carried:armor')).toHaveLength(1)
  }
  expect(prepareDnd5eCompanionArmorChange({ token: original.tokens[0], itemId: 'armor', proficient: true, combatActive: false,
    startedWorldMinute: 160, completedWorldMinute: 170 })).toBeUndefined()
})

it.each([
  ['skeleton', 'leather-armor', 13, 30, false],
  ['skeleton', 'scale-mail', 16, 30, true],
  ['skeleton', 'chain-mail', 16, 20, true],
  ['zombie', 'leather-armor', 9, 20, false],
  ['zombie', 'scale-mail', 12, 20, true],
  ['zombie', 'chain-mail', 16, 20, true],
] as const)('projects worn %s %s from the real armor template', (form, armor, ac, speed, stealth) => {
  const { actor, input } = fixture(true, 0)
  actor.poolId = 'srd-5.1:' + form
  actor.dnd5eCarriedObjects!.push({ id: 'armor', pickupReceipt: 'armor', label: 'Armor', wornArmor: { proficient: false },
    objectState: { schemaVersion: 1, wornOrCarried: true, inventoryItem: {
      templateId: 'srd-5.1:equipment:dnd5e-' + armor, quantity: 1, receiptId: 'armor' } } })
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [input.map] }))).maps[0]
  const snapshot = createDnd5eMapCombatSnapshot({ ...input, map })
  expect(snapshot.state.combatants.undead).toMatchObject({ armorClass: ac, speed, wearingArmor: true,
    wearingUnproficientArmor: true, armorStealthDisadvantage: stealth })
  expect(dnd5eSavingThrowMode(snapshot.state.combatants.undead, 'str')).toBe('disadvantage')
  expect(dnd5eSavingThrowMode(snapshot.state.combatants.undead, 'dex')).toBe('disadvantage')
  expect(dnd5eSavingThrowMode(snapshot.state.combatants.undead, 'con')).toBe('normal')
  const prepared = prepareDnd5eMonsterAttack({ ...input, map, actionIndex: getDnd5eSrdMonster(actor.poolId)!.actions.length })
  if (!prepared.ok) throw Error(prepared.reason)
  expect(prepared.prepared.attackModes[0]).toBe('disadvantage')
  const result = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
    rolls: [{ mode: 'normal', d20: 19, d20Second: 1, damageRolls: [[4]] }] })
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.goblin.currentHp).toBe(100)
  map.tokens[0].dnd5eCarriedObjects!.find(item => item.id === 'armor')!.wornArmor!.proficient = true
  expect(createDnd5eMapCombatSnapshot({ ...input, map }).state.combatants.undead.wearingUnproficientArmor).toBe(false)
})

it.each([['leather-armor', 1, 1], ['scale-mail', 5, 1], ['chain-mail', 10, 5]] as const)(
  'does not equip %s early; replacement includes doffing time and preserves physical possessions', (armor, donMinutes, doffMinutes) => {
    const { actor, input } = fixture(true, 0)
    actor.dnd5eNativeArmorRemoved = true
    actor.dnd5eCarriedObjects!.push({ id: 'armor', pickupReceipt: 'armor', label: 'Armor', objectState: {
      schemaVersion: 1, wornOrCarried: true, inventoryItem: { templateId: 'srd-5.1:equipment:dnd5e-' + armor, quantity: 1, receiptId: 'armor' } } })
    const before = structuredClone(actor)
    const change = { token: actor, itemId: 'armor', proficient: true, combatActive: false, startedWorldMinute: 100 }
    expect(prepareDnd5eCompanionArmorChange({ ...change, completedWorldMinute: 100 + donMinutes - 1 })).toMatchObject({
      minutes: donMinutes, complete: false, carried: undefined,
    })
    expect(actor).toEqual(before)
    const done = prepareDnd5eCompanionArmorChange({ ...change, completedWorldMinute: 100 + donMinutes })!
    expect(done.complete).toBe(true)
    actor.dnd5eCarriedObjects = done.carried
    expect(createDnd5eMapCombatSnapshot(input).state.combatants.undead.wearingUnproficientArmor).toBe(false)
    expect(prepareDnd5eCompanionArmorChange({ ...change, completedWorldMinute: 200 })).toBeUndefined()
    actor.dnd5eCarriedObjects!.push({ id: 'replacement', pickupReceipt: 'replacement', label: 'Replacement', objectState: {
      schemaVersion: 1, wornOrCarried: true, inventoryItem: { templateId: 'srd-5.1:equipment:dnd5e-leather-armor', quantity: 1, receiptId: 'replacement' } } })
    const replace = prepareDnd5eCompanionArmorChange({ ...change, itemId: 'replacement', completedWorldMinute: 100 + doffMinutes + 1 })!
    expect(replace.minutes).toBe(doffMinutes + 1)
    expect(replace.carried!.filter(item => item.wornArmor).map(item => item.id)).toEqual(['replacement'])
    expect(replace.carried!.map(item => item.id)).toEqual(['sword', 'armor', 'replacement'])
    const remove = prepareDnd5eCompanionArmorChange({ ...change, itemId: null, completedWorldMinute: 100 + doffMinutes })!
    expect(remove.minutes).toBe(doffMinutes)
    expect(remove.carried!.some(item => item.wornArmor)).toBe(false)
    expect(prepareDnd5eCompanionArmorChange({ ...change, itemId: null, combatActive: true, completedWorldMinute: 200 })).toBeUndefined()
    actor.hp = 0
    expect(prepareDnd5eCompanionArmorChange({ ...change, itemId: null, completedWorldMinute: 200 })).toBeUndefined()
  })

it('requires a DM duration for armor scraps and does not restore their AC after removing replacement armor', () => {
  const { actor, input } = fixture(true, 0)
  expect(createDnd5eMapCombatSnapshot(input).state.combatants.undead).toMatchObject({ armorClass: 13, wearingArmor: true })
  actor.dnd5eCarriedObjects!.push({ id: 'armor', pickupReceipt: 'armor', label: 'Plate', objectState: {
    schemaVersion: 1, wornOrCarried: true, inventoryItem: { templateId: 'srd-5.1:equipment:dnd5e-chain-mail', quantity: 1, receiptId: 'armor' } } })
  const change = { token: actor, itemId: 'armor', proficient: true, combatActive: false, startedWorldMinute: 10, completedWorldMinute: 25 }
  for (const nativeArmorDoffMinutes of [undefined, 0, -1, 1.5, Number.NaN, 61])
    expect(prepareDnd5eCompanionArmorChange({ ...change, nativeArmorDoffMinutes })).toBeUndefined()
  const don = prepareDnd5eCompanionArmorChange({ ...change, nativeArmorDoffMinutes: 5 })!
  expect(don.minutes).toBe(15)
  expect(don.complete).toBe(true)
  actor.dnd5eCarriedObjects = don.carried
  actor.dnd5eNativeArmorRemoved = don.nativeArmorRemoved
  const doff = prepareDnd5eCompanionArmorChange({ ...change, itemId: null, startedWorldMinute: 25, completedWorldMinute: 30 })!
  actor.dnd5eCarriedObjects = doff.carried
  actor.dnd5eNativeArmorRemoved = doff.nativeArmorRemoved
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [input.map] }))).maps[0]
  expect(map.tokens[0].dnd5eNativeArmorRemoved).toBe(true)
  expect(createDnd5eMapCombatSnapshot({ ...input, map }).state.combatants.undead).toMatchObject({
    armorClass: 12, wearingArmor: false, wearingHeavyArmor: false, wearingUnproficientArmor: false, speed: 30,
  })
  expect(map.tokens[0].dnd5eCarriedObjects!.some(item => item.id === 'armor')).toBe(true)
})

it('rejects duplicate worn armor markers and a weapon pretending to be worn armor', () => {
  const { actor } = fixture(true, 0)
  actor.dnd5eCarriedObjects![0].wornArmor = { proficient: true }
  expect(normalizeDnd5eCompanionCarriedObjects(actor.dnd5eCarriedObjects)).toBeUndefined()
  delete actor.dnd5eCarriedObjects![0].wieldedWeapon
  expect(normalizeDnd5eCompanionCarriedObjects(actor.dnd5eCarriedObjects)).toBeUndefined()
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId = 'srd-5.1:equipment:dnd5e-leather-armor'
  const second = structuredClone(actor.dnd5eCarriedObjects![0])
  second.id = 'second'; second.pickupReceipt = 'second'
  actor.dnd5eCarriedObjects!.push(second)
  expect(normalizeDnd5eCompanionCarriedObjects(actor.dnd5eCarriedObjects)).toBeUndefined()
})

it.each([[false, true], [false, false], [true, true]] as const)('carries a real inventory draw through drop, pickup and Host attack (source ended: %s, owner bow: %s)', (ended, ownerHasBow) => {
  const { actor, input } = fixture(true, 3)
  input.map.tokens[1].x = 175
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId = 'srd-5.1:equipment:dnd5e-shortbow'
  let characters = [normalizeCharacter({ id: 'caster', name: 'Caster', currentHp: 20, maxHp: 20,
    equipment: ownerHasBow ? { mainWeapon: DND5E_LONGBOW } : {} })]
  for (const [templateId, quantity] of [['srd-5.1:item:backpack', 1], ['srd-5.1:item:arrows', 3]] as const) {
    const grant = applyDnd5eInventoryMutation(characters, { type: 'grant', characterId: 'caster', templateId, quantity })
    expect(grant.ok).toBe(true)
    characters = grant.characters
  }
  const bag = characters[0].dnd5eInventory!.entries.find(entry => entry.item.category === 'container')!
  const arrow = characters[0].dnd5eInventory!.entries.find(entry => entry.item.ammunitionKind === 'arrow')!
  const contained = applyDnd5eInventoryMutation(characters, { type: 'set-container', characterId: 'caster',
    instanceId: arrow.instanceId, containerInstanceId: bag.instanceId })
  expect(contained.ok).toBe(true)
  characters = contained.characters
  characters[0].concentrating = true
  characters[0].dnd5eCombatState = { schemaVersion: 2, concentrationSpellId: 'ammo-test', activeEffects: [
    createDnd5eMechanicalEffect({ id: 'quiver-effect', definitionId: 'ammo-test', label: 'Ammunition test', targetId: 'caster',
      source: { kind: 'spell', actorId: 'owner', characterId: 'caster', rulesId: 'ammo-test', executionId: 'ammo-execution' },
      duration: { type: 'concentration', sourceActorId: 'owner', concentrationId: 'ammo-test', remainingRounds: 600 },
      modifiers: { weaponEnchantment: { weaponId: 'container:' + bag.instanceId, inventoryInstanceId: bag.instanceId,
        ammunitionContainer: true, consumeOnDraw: true, remainingAttacks: 12, attackAndDamageBonus: 0,
        weaponIds: [DND5E_LONGBOW.id], bonusDamage: { count: 1, sides: 6, type: 'fire' } } } }),
  ] }
  const draw = applyDnd5eInventoryMutation(characters, { type: 'set-container', characterId: 'caster', instanceId: arrow.instanceId,
    containerInstanceId: undefined })
  expect(draw.ok).toBe(true)
  characters = draw.characters
  expect(characters[0].dnd5eCombatState!.activeEffects!.find(effect => effect.id === 'quiver-effect')!.modifiers!.weaponEnchantment!.remainingAttacks).toBe(9)
  expect(characters[0].dnd5eCombatState!.activeEffects!.find(effect => effect.modifiers?.weaponEnchantment?.ammunitionStack)!.modifiers!.weaponEnchantment!.remainingAttacks).toBe(3)
  input.map.tokens.push({ id: 'owner', type: 'player', characterId: 'caster', label: 'Caster', x: 25, y: 25, size: 1, color: '', emoji: '' })
  const drop = prepareDnd5eMapInventoryDrop({ map: input.map, characters, actorTokenId: 'owner', instanceId: arrow.instanceId,
    expectedInventoryRevision: characters[0].dnd5eInventory!.revision ?? 0, requestId: 'drawn-arrow-test', combatActive: false })
  if (!drop.ok) throw Error(drop.reason)
  const picked = prepareDnd5eMapInventoryPickup({ map: drop.map, characters: drop.characters, actorTokenId: actor.id,
    objectTokenId: drop.objectTokenId, expectedReceiptId: drop.objectTokenId, expectedQuantity: 3, combatActive: false })
  if (!picked.ok) throw Error(picked.reason)
  if (ended) {
    picked.characters[0].concentrating = false
    picked.characters[0].dnd5eCombatState!.concentrationSpellId = undefined
    picked.characters[0].dnd5eCombatState!.activeEffects = []
  }
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [picked.map] }))).maps[0]
  const prepared = prepareDnd5eMonsterAttack({ ...input, map, characters: picked.characters,
    initiativeOrder: [...input.initiativeOrder, { tokenId: 'owner', label: 'Caster', color: '', emoji: '', roll: 1 }] })
  if (!prepared.ok) throw Error(prepared.reason)
  expect(prepared.prepared.attacks[0].attack.damage).toHaveLength(ended ? 1 : 2)
  const result = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
    rolls: [{ d20: 19, damageRolls: ended ? [[4]] : [[4], [5]] }] })
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.goblin.currentHp).toBe(ended ? 91 : 86)
  const inventory = result.application!.map.tokens.find(token => token.id === actor.id)!.dnd5eCarriedObjects!
    .find(item => item.objectState.inventoryItem?.instance?.instanceId === arrow.instanceId)!.objectState.inventoryItem!
  expect(inventory.quantity).toBe(2)
  expect(inventory.boundEffects?.[0]?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(ended ? undefined : 2)
  if (!ended) expect(result.application!.characters[0].dnd5eCombatState!.activeEffects!
    .find(effect => effect.id === 'quiver-effect')!.modifiers!.weaponEnchantment!.remainingAttacks).toBe(9)
  const settledMap = result.application!.map
  const possessions = droppedDnd5eCompanionObjects(settledMap.tokens.find(token => token.id === actor.id)!)
  const groundArrow = possessions.find(token => token.dnd5eObjectState?.inventoryItem?.instance?.instanceId === arrow.instanceId)!
  const recovered = prepareDnd5eMapInventoryPickup({ map: { ...settledMap,
    tokens: [...settledMap.tokens.filter(token => token.id !== actor.id), ...possessions] },
    characters: result.application!.characters, actorTokenId: 'owner', objectTokenId: groundArrow.id,
    expectedReceiptId: groundArrow.dnd5eObjectState!.inventoryItem!.receiptId, expectedQuantity: 2, combatActive: false })
  if (!recovered.ok) throw Error(recovered.reason)
  const recoveredOwner = recovered.characters.find(character => character.id === 'caster')!
  expect(recoveredOwner.dnd5eInventory!.entries.find(entry => entry.instanceId === arrow.instanceId)?.quantity).toBe(2)
  expect(recoveredOwner.dnd5eCombatState?.activeEffects?.find(effect => effect.modifiers?.weaponEnchantment?.ammunitionStack)
    ?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(ended ? undefined : 2)
  expect(recovered.map.tokens.some(token => token.id === groundArrow.id)).toBe(false)
})

it.each(['hit', 'miss', 'burst', 'other-bow', 'wrong-instance', 'stale-weapon-binding', 'suspended', 'expired', 'ended-source'] as const)(
  'settles a concrete drawn enchanted arrow and its quota (%s)', scenario => {
    const { actor, input } = fixture(true, 3)
    if (scenario === 'burst') actor.dnd5eSummon!.attacksPerAction = 2
    input.map.tokens[1].x = 175
    actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId = 'srd-5.1:equipment:dnd5e-shortbow'
    const owner = normalizeCharacter({ id: 'ammo-owner', name: 'Owner' })
    const instance = applyDnd5eInventoryMutation([owner], { type: 'grant', characterId: owner.id,
      templateId: 'srd-5.1:item:arrows', quantity: 2 }).characters[0].dnd5eInventory!.entries.find(entry => entry.item.ammunitionKind === 'arrow')!
    const effect = createDnd5eMechanicalEffect({ id: 'drawn', definitionId: 'drawn', label: 'Drawn ammunition', targetId: actor.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'test-enchantment' },
      duration: scenario === 'expired' ? { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' } : { type: 'permanent' },
      modifiers: { weaponEnchantment: { weaponId: 'ammunition:' + instance.instanceId,
        inventoryInstanceId: scenario === 'wrong-instance' ? 'other' : instance.instanceId,
        ammunitionStack: true, drawSourceEffectId: 'original', remainingAttacks: 1, attackAndDamageBonus: 1,
        weaponIds: [scenario === 'stale-weapon-binding' ? 'dnd5e-light-crossbow' : scenario === 'other-bow' ? 'dnd5e-longbow' : 'dnd5e-shortbow'],
        bonusDamage: { count: 1, sides: 6, type: 'fire', magical: true } } } })
    if (scenario === 'suspended') effect.suspendedBy = ['test-suppression']
    if (scenario === 'expired' && effect.duration.type === 'rounds') effect.duration.remainingRounds = 0
    if (scenario === 'ended-source') effect.duration = { type: 'concentration', sourceActorId: 'caster', concentrationId: 'test-enchantment', remainingRounds: 10 }
    actor.dnd5eCarriedObjects!.push({ id: 'ammo', pickupReceipt: 'ammo', label: 'Arrow', objectState: {
      schemaVersion: 1, wornOrCarried: true, inventoryItem: { templateId: instance.templateId, instance,
        quantity: 2, receiptId: 'ammo', boundEffects: [effect] } } })
    const before = structuredClone(input)
    const enchanted = scenario === 'hit' || scenario === 'miss' || scenario === 'burst' || scenario === 'other-bow' || scenario === 'stale-weapon-binding'
    const prepared = prepareDnd5eMonsterAttack(input)
    if (scenario === 'wrong-instance') {
      expect(prepared.ok).toBe(false)
      expect(input).toEqual(before)
      return
    }
    if (!prepared.ok) throw Error(prepared.reason)
    expect(prepared.prepared.attacks[0].attack.damage).toHaveLength(enchanted ? 2 : 1)
    const settled = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared, rolls: [{
      d20: scenario === 'miss' ? 1 : 19, damageRolls: enchanted ? [[4], [5]] : [[4]],
    }, ...(scenario === 'burst' ? [{ d20: 19, damageRolls: [[4]] }] : [])] })
    expect(settled.result.ok).toBe(true)
    expect(input).toEqual(before)
    expect(settled.result.state.combatants.goblin.currentHp).toBe(scenario === 'burst' ? 76 : scenario === 'miss' ? 100 : enchanted ? 85 : 91)
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [settled.application!.map] }))).maps[0]
    if (scenario === 'burst') {
      expect(saved.tokens[0].dnd5eCarriedObjects!.some(item => item.id === 'ammo')).toBe(false)
      expect(settled.result.events.filter(event => event.type === 'companion-ammunition-consumed')).toHaveLength(2)
      return
    }
    const remaining = saved.tokens[0].dnd5eCarriedObjects!.find(item => item.id === 'ammo')!.objectState.inventoryItem!
    expect(remaining.quantity).toBe(1)
    expect(remaining.instance!.instanceId).toBe(instance.instanceId)
    const next = prepareDnd5eMonsterAttack({ ...input, map: saved, round: 2 })
    if (!next.ok) throw Error(next.reason)
    expect(next.prepared.attacks[0].attack.damage).toHaveLength(1)
  })

it.each(['srd-5.1:skeleton', 'srd-5.1:zombie'])('projects held and empty hands for %s', poolId => {
  const { actor, input } = fixture(true, 0)
  actor.poolId = poolId
  expect(createDnd5eMapCombatSnapshot(input).state.combatants[actor.id].grappleFreeHandCapacity).toBe(1)
  actor.dnd5eCarriedObjects = prepareDnd5eCompanionHeldWeapon(actor, null, false)
  expect(createDnd5eMapCombatSnapshot(input).state.combatants[actor.id].grappleFreeHandCapacity).toBe(2)
})

it('preserves both undead grapple hands through the map projection and refuses drawing into occupied hands', () => {
  const { actor, input } = fixture(true, 0)
  actor.dnd5eCarriedObjects = prepareDnd5eCompanionHeldWeapon(actor, null, false)
  const second = { ...input.map.tokens[1], id: 'second-target', y: 50 }
  input.map.tokens.push(second)
  input.initiativeOrder.push({ tokenId: second.id, label: second.label, color: '', emoji: '', roll: 1 })
  const snapshot = createDnd5eMapCombatSnapshot(input)
  expect(snapshot.state.combatants[actor.id].grappleFreeHandCapacity).toBe(2)
  let state = snapshot.state
  for (const targetId of ['goblin', second.id]) {
    const result = resolveDnd5eHeadlessAction(state, { type: 'grapple', actorId: actor.id,
      targetId, actorD20: 20, targetD20: 1, targetDefense: 'athletics', spendAction: false })
    expect(result.ok).toBe(true)
    state = result.state
  }
  const application = planDnd5eMapResultApplication({ state, map: input.map, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId })
  const reloaded = createDnd5eMapCombatSnapshot({ ...input, map: JSON.parse(JSON.stringify(application.map)) })
  const occupiedHands = dnd5eSourceLinkedRelations(reloaded.state, actor.id, 'free-hand').length
  expect(occupiedHands).toBe(2)
  expect(prepareDnd5eCompanionHeldWeapon(actor, 'sword', true, occupiedHands)).toBeUndefined()
  const released = resolveDnd5eHeadlessAction(reloaded.state, { type: 'release-grapple', actorId: actor.id, targetId: 'goblin' })
  expect(released.ok).toBe(true)
  expect(prepareDnd5eCompanionHeldWeapon(actor, 'sword', true,
    dnd5eSourceLinkedRelations(released.state, actor.id, 'free-hand').length)?.[0].wieldedWeapon).toEqual({ proficient: true })
})

it('respects maintained free-hand relations before drawing or spending, while allowing stowing', () => {
  const { actor } = fixture(true, 5)
  actor.dnd5eCarriedObjects = prepareDnd5eCompanionHeldWeapon(actor, null, false)
  const economy = createDnd5eTurnEconomyCounts('combat:1:undead', 30)
  const input = { token: actor, itemId: 'sword', proficient: true, currentTokenId: actor.id, economy }
  const before = structuredClone(input)
  expect(prepareDnd5eCompanionCombatWeaponChange({ ...input, occupiedHands: 1 })?.carried[0].wieldedWeapon).toEqual({ proficient: true })
  for (const occupiedHands of [2, 3, -1, NaN, 0.5]) {
    expect(prepareDnd5eCompanionCombatWeaponChange({ ...input, occupiedHands })).toBeUndefined()
    expect(prepareDnd5eCompanionHeldWeapon(actor, 'sword', true, occupiedHands)).toBeUndefined()
  }
  expect(prepareDnd5eCompanionHeldWeapon(actor, null, false, 2)).toEqual(actor.dnd5eCarriedObjects)
  expect(input).toEqual(before)
})

it('spends one free interaction to stow, then one action to draw, without losing the physical item', () => {
  const { actor } = fixture(true, 5)
  const economy = createDnd5eTurnEconomyCounts('combat:1:undead', 30)
  const before = structuredClone({actor,economy})
  const stow = prepareDnd5eCompanionCombatWeaponChange({token:actor,itemId:null,proficient:false,currentTokenId:actor.id,economy})!
  expect(stow.economy.objectInteraction?.current).toBe(0)
  expect(stow.economy.action.current).toBe(1)
  expect(stow.carried[0].wieldedWeapon).toBeUndefined()
  const draw = prepareDnd5eCompanionCombatWeaponChange({token:{...actor,dnd5eCarriedObjects:stow.carried},itemId:'sword',proficient:true,currentTokenId:actor.id,economy:stow.economy})!
  expect(draw.economy.action.current).toBe(0)
  expect(draw.carried).toEqual(actor.dnd5eCarriedObjects)
  expect(prepareDnd5eCompanionCombatWeaponChange({token:{...actor,dnd5eCarriedObjects:draw.carried},itemId:null,proficient:false,currentTokenId:actor.id,economy:draw.economy})).toBeUndefined()
  expect({actor,economy}).toEqual(before)
})

it('charges both stow and draw for replacement and rejects unavailable, incapacitated or repeated changes atomically', () => {
  const { actor } = fixture(true, 5)
  actor.dnd5eCarriedObjects!.push({...structuredClone(actor.dnd5eCarriedObjects![0]),id:'second',pickupReceipt:'second',wieldedWeapon:undefined})
  const economy = createDnd5eTurnEconomyCounts('combat:1:undead',30)
  const input = {token:actor,itemId:'second',proficient:false,currentTokenId:actor.id,economy}
  const before = structuredClone(input)
  const changed = prepareDnd5eCompanionCombatWeaponChange(input)!
  expect(changed.interactions).toBe(2)
  expect(changed.economy.objectInteraction?.current).toBe(0)
  expect(changed.economy.action.current).toBe(0)
  expect(changed.carried.filter(item=>item.wieldedWeapon).map(item=>item.id)).toEqual(['second'])
  expect(prepareDnd5eCompanionCombatWeaponChange({...input,economy:{...economy,action:{current:0,max:1}}})).toBeUndefined()
  expect(prepareDnd5eCompanionCombatWeaponChange({...input,currentTokenId:'other'})).toBeUndefined()
  expect(prepareDnd5eCompanionCombatWeaponChange({...input,token:{...actor,hp:0}})).toBeUndefined()
  expect(prepareDnd5eCompanionCombatWeaponChange({...input,token:{...actor,dnd5eCombatState:{conditions:['stunned']}}})).toBeUndefined()
  expect(prepareDnd5eCompanionCombatWeaponChange({...input,itemId:'sword'})).toBeUndefined()
  expect(input).toEqual(before)
})

it.each([[true, 5], [false, 5], [true, -2], [false, 0]] as const)('settles held sword with DM proficiency=%s and signed summon bonus=%s', (proficient, spellBonus) => {
  const { actor, input, monster } = fixture(proficient, spellBonus)
  const before = structuredClone(input), original = structuredClone(monster)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [input.map] }))).maps[0]
  expect(saved.tokens[0].dnd5eCarriedObjects?.[0].wieldedWeapon).toEqual({ proficient })
  const prepared = prepareDnd5eMonsterAttack({ ...input, map: saved })
  expect(prepared.ok).toBe(true); if (!prepared.ok) throw Error(prepared.reason)
  const attack = prepared.prepared.attacks[0].attack
  expect(attack.toHit).toBe((proficient ? 2 : 0) + spellBonus)
  expect(attack.damage[0]).toMatchObject({ count: 1, sides: 8, bonus: spellBonus })
  const result = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
    rolls: [{ targetId: 'goblin', d20: 19, damageRolls: [[6]] }] })
  expect(result.result.ok, result.result.ok ? '' : result.result.reason).toBe(true)
  expect(result.result.state.combatants.goblin.currentHp).toBe(100 - Math.max(0, 6 + spellBonus))
  expect(result.result.state.combatants.undead.turn.actionAvailable).toBe(false)
  expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', actorId: actor.id, hit: true }))
  expect(input).toEqual(before); expect(getDnd5eSrdMonster(monster.id)).toEqual(original)
})

it('does not expose an attack after the actual item is lost or switched, and does not mutate the catalog', () => {
  const { actor, monster } = fixture(true, 5)
  expect(dnd5eMonsterWithHeldWeapon(monster, actor)?.actions.slice(monster.actions.length).map(action => action.id))
    .toEqual(['held-weapon:sword', 'held-weapon:sword:two-handed'])
  expect(dnd5eMonsterWithHeldWeapon(monster, { ...actor, dnd5eCarriedObjects: [] })).toBe(monster)
  expect(prepareDnd5eCompanionHeldWeapon(actor, 'forged', true)).toBeUndefined()
  const malformed = structuredClone(actor.dnd5eCarriedObjects!)
  malformed.push({ ...malformed[0], id: 'second', pickupReceipt: 'second' })
  expect(normalizeDnd5eCompanionCarriedObjects(malformed)).toBeUndefined()
})

it('uses the wielded item for an owned companion attack order', () => {
  const { actor, input, monster } = fixture(true, 5)
  actor.dnd5eSummon!.commandPolicy = 'persistent-order'
  actor.dnd5eCombatState = { companionCommand: { schemaVersion: 1, command: 'attack', attackTargetId: 'goblin',
    sourceOwnerId: 'owner', sourceFeatureId: 'danse', issuedRound: 1, persistentOrder: true } }
  const plan = planDnd5eMonsterTurn(input.map, actor, [], { combatId: input.combatId, round: 1, movementBudgetFeet: 0 })
  expect(plan).toMatchObject({ attacked: true, actionIndex: monster.actions.length, targetTokenId: 'goblin' })
})

it('stows without losing the item and restores native attacks across a map round trip', () => {
  const { actor, input, monster } = fixture(true, 5)
  const before = structuredClone(actor)
  const carried = prepareDnd5eCompanionHeldWeapon(actor, 'sword', true)!
  const stowed = prepareDnd5eCompanionHeldWeapon({ ...actor, dnd5eCarriedObjects: carried }, null, false)!
  expect(stowed).toHaveLength(1)
  expect(stowed[0]).toMatchObject({ id: 'sword', pickupReceipt: 'scene-reward', objectState: before.dnd5eCarriedObjects![0].objectState })
  expect(stowed[0].wieldedWeapon).toBeUndefined()
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map,
    tokens: [{ ...actor, dnd5eCarriedObjects: stowed }, input.map.tokens[1]] }] }))).maps[0]
  expect(dnd5eMonsterWithHeldWeapon(monster, saved.tokens[0])).toBe(monster)
  const fallback = prepareDnd5eMonsterAttack({ ...input, map: saved })
  expect(fallback.ok).toBe(true)
  if (!fallback.ok) throw Error(fallback.reason)
  expect(fallback.prepared.attacks.every(attack => !attack.id.startsWith('held-weapon:'))).toBe(true)
  expect(prepareDnd5eMonsterAttack({ ...input, map: saved, actionIndex: 0 }).ok).toBe(true)
  expect(prepareDnd5eCompanionHeldWeapon(saved.tokens[0], null, false)).toEqual(stowed)
  expect(prepareDnd5eCompanionHeldWeapon(saved.tokens[0], 'sword', true)?.[0].wieldedWeapon).toEqual({ proficient: true })
  expect(actor).toEqual(before)
  expect(prepareDnd5eCompanionHeldWeapon({ ...actor, type: 'player' }, null, false)).toBeUndefined()
})

it.each([
  ['dnd5e-greatsword', 2, 6, [4, 5], 0],
  ['dnd5e-longsword', 1, 10, [9], 1],
] as const)('settles %s two-handed with its own dice and rejects attacking while maintaining a grapple', (weaponId, count, sides, dice, variantOffset) => {
  const { actor, input } = fixture(true, 3)
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId = 'srd-5.1:equipment:' + weaponId
  input.actionIndex += variantOffset
  expect(prepareDnd5eCompanionHeldWeapon(actor, 'sword', true)).toBeDefined()
  const prepared = prepareDnd5eMonsterAttack(input)
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  expect(prepared.prepared.attacks[0].attack.damage[0]).toMatchObject({ count, sides, bonus: 3 })
  const hit = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared, rolls: [{ d20: 19, damageRolls: [dice] }] })
  expect(hit.result.ok).toBe(true)
  expect(hit.result.state.combatants.goblin.currentHp).toBe(88)
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const grapple = resolveDnd5eHeadlessAction(snapshot.state, { type: 'grapple', actorId: actor.id,
    targetId: 'goblin', actorD20: 20, targetD20: 1, targetDefense: 'athletics', spendAction: false })
  expect(grapple.ok).toBe(true)
  const application = planDnd5eMapResultApplication({ state: grapple.state, map: input.map, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId })
  const blocked = prepareDnd5eMonsterAttack({ ...input, map: application.map })
  if (blocked.ok) {
    const rejected = resolvePreparedDnd5eMonsterAttack({ prepared: blocked.prepared, rolls: [{ d20: 19, damageRolls: [dice] }] })
    expect(rejected.result.ok).toBe(false)
    expect(rejected.result.state.combatants.goblin.currentHp).toBe(100)
    expect(rejected.result.state.combatants.undead.turn.actionAvailable).toBe(true)
  }
  const release = resolveDnd5eHeadlessAction(grapple.state, { type: 'release-grapple', actorId: actor.id, targetId: 'goblin' })
  expect(release.ok).toBe(true)
  const freedMap = planDnd5eMapResultApplication({ state: release.state, map: application.map, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId }).map
  const freed = prepareDnd5eMonsterAttack({ ...input, map: freedMap })
  expect(freed.ok).toBe(true)
  if (!freed.ok) throw Error(freed.reason)
  expect(resolvePreparedDnd5eMonsterAttack({ prepared: freed.prepared, rolls: [{ d20: 19, damageRolls: [dice] }] }).result.ok).toBe(true)
})

it('applies small creature heavy-weapon disadvantage in preview and Host settlement even with a normal submitted mode', () => {
  const { actor, input } = fixture(true, 3)
  actor.creatureSize = '小型'
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId = 'srd-5.1:equipment:dnd5e-greatsword'
  const prepared = prepareDnd5eMonsterAttack(input)
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  expect(prepared.prepared.attackModes[0]).toBe('disadvantage')
  const settled = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
    rolls: [{ mode: 'normal', d20: 19, d20Second: 1, damageRolls: [[4, 5]] }] })
  expect(settled.result.ok).toBe(true)
  expect(settled.result.state.combatants.goblin.currentHp).toBe(100)
})

it.each([[3,19], [3,1], [1,19], [0,19]] as const)('settles a bow with %s arrows and d20 %s without inventing ammunition', (quantity, d20) => {
  const { actor, input } = fixture(true, 3)
  input.map.tokens[1].x = 175
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId = 'srd-5.1:equipment:dnd5e-shortbow'
  if (quantity) actor.dnd5eCarriedObjects!.push({ id:'arrows', pickupReceipt:'arrows',label:'Arrows', objectState:{
    schemaVersion:1,wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:arrows',quantity,receiptId:'arrows'} } })
  const before = structuredClone(input)
  const prepared = prepareDnd5eMonsterAttack(input)
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  const settled = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
    rolls:[{d20,d20Second:d20,damageRolls:[[4]]}] })
  expect(settled.result.ok).toBe(quantity > 0)
  expect(input).toEqual(before)
  if (!quantity) {
    expect(settled.result.state.combatants.undead.turn.actionAvailable).toBe(true)
    expect(settled.result.state.combatants.goblin.currentHp).toBe(100)
    expect(settled.application).toBeUndefined()
    return
  }
  expect(settled.result.state.combatants.goblin.currentHp).toBe(d20 === 19 ? 91 : 100)
  expect(settled.result.events).toContainEqual({type:'companion-ammunition-consumed',actorId:actor.id,count:1})
  const saved = migrateMapsState(JSON.parse(JSON.stringify({maps:[settled.application!.map]}))).maps[0]
  expect(saved.tokens.find(token=>token.id===actor.id)?.dnd5eCarriedObjects?.find(item=>item.id==='arrows')?.objectState.inventoryItem?.quantity ?? 0).toBe(quantity-1)
})

it.each([
  ['shortbow','arrows'], ['longbow','arrows'], ['light-crossbow','crossbow-bolts'],
  ['heavy-crossbow','crossbow-bolts'], ['hand-crossbow','crossbow-bolts'],
  ['sling','sling-bullets'], ['blowgun','blowgun-needles'],
] as const)('uses the correct ammunition for %s through Host settlement', (weaponId, ammoId) => {
  const { actor, input } = fixture(true, 3)
  input.map.tokens[1].x=175
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-'+weaponId
  actor.dnd5eCarriedObjects!.push({id:'ammo',pickupReceipt:'ammo',label:'Ammo',objectState:{schemaVersion:1,wornOrCarried:true,
    inventoryItem:{templateId:'srd-5.1:item:'+ammoId,quantity:2,receiptId:'ammo'}}})
  const prepared=prepareDnd5eMonsterAttack(input)
  expect(prepared.ok).toBe(true)
  if(!prepared.ok)throw Error(prepared.reason)
  const result=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{d20:19,damageRolls:[weaponId==='blowgun'?[]:[1]]}]})
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.goblin.currentHp).toBe(94)
  expect(result.application!.map.tokens[0].dnd5eCarriedObjects?.find(item=>item.id==='ammo')?.objectState.inventoryItem?.quantity).toBe(1)
  actor.dnd5eCarriedObjects![1].objectState.inventoryItem!.templateId='srd-5.1:item:'+(ammoId==='arrows'?'crossbow-bolts':'arrows')
  expect(consumeDnd5eCompanionAmmunition(actor,['held-weapon:sword']).ok).toBe(false)
})

it.each(['accessible','missing','ethereal','released','cycle','wrong-kind'] as const)('checks carried ammunition container ancestry through Host (%s)', scenario => {
  const {actor,input}=fixture(true,0)
  input.map.tokens[1].x=175
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-shortbow'
  let characters=[normalizeCharacter({id:'inventory-owner',name:'Inventory',dnd5eInventory:{schemaVersion:1,entries:[]}})]
  for(const templateId of ['srd-5.1:item:backpack','srd-5.1:item:arrows']) {
    characters=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'inventory-owner',templateId,quantity:1}).characters
  }
  const entries=characters[0].dnd5eInventory!.entries
  const bag=entries.find(entry=>entry.item.category==='container')!, arrow=entries.find(entry=>entry.item.ammunitionKind==='arrow')!
  arrow.containerInstanceId=bag.instanceId
  if(scenario==='ethereal')bag.planarState='ethereal'
  if(scenario==='released')bag.releasedByCharacterId='someone'
  if(scenario==='cycle')bag.containerInstanceId=bag.instanceId
  if(scenario==='wrong-kind')bag.item.category='adventuring-gear'
  for(const entry of entries.filter(entry=>scenario!=='missing'||entry!==bag)) actor.dnd5eCarriedObjects!.push({
    id:entry.instanceId,pickupReceipt:entry.instanceId,label:entry.item.name,objectState:{schemaVersion:1,wornOrCarried:true,
      inventoryItem:{templateId:entry.templateId,quantity:1,receiptId:entry.instanceId,instance:entry}}})
  const before=structuredClone(input)
  const prepared=prepareDnd5eMonsterAttack(input)
  if(!prepared.ok)throw Error(prepared.reason)
  const result=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{d20:19,damageRolls:[[1]]}]})
  expect(result.result.ok).toBe(scenario==='accessible')
  expect(input).toEqual(before)
  if(scenario==='accessible') {
    const carried=result.application!.map.tokens[0].dnd5eCarriedObjects!
    expect(carried.some(item=>item.id===arrow.instanceId)).toBe(false)
    expect(carried.some(item=>item.id===bag.instanceId)).toBe(true)
  } else {
    expect(result.result.state.combatants.undead.turn.actionAvailable).toBe(true)
    expect(result.application).toBeUndefined()
  }
})

it('keeps blowgun fixed damage unchanged on a critical hit and consumes the needle', () => {
  const {actor,input}=fixture(true,3)
  input.map.tokens[1].x=175
  actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-blowgun'
  actor.dnd5eCarriedObjects!.push({id:'needle',pickupReceipt:'needle',label:'Needle',objectState:{schemaVersion:1,wornOrCarried:true,
    inventoryItem:{templateId:'srd-5.1:item:blowgun-needles',quantity:1,receiptId:'needle'}}})
  const prepared=prepareDnd5eMonsterAttack(input)
  if(!prepared.ok)throw Error(prepared.reason)
  expect(prepared.prepared.attacks[0].attack.damage[0]).toMatchObject({count:0,bonus:6})
  const result=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{d20:20,damageRolls:[[]]}]})
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.goblin.currentHp).toBe(94)
  expect(result.application!.map.tokens[0].dnd5eCarriedObjects).toHaveLength(1)
})

it('reserves enough arrows for repeated shots but enforces loading and preserves input on rejection', () => {
  const {actor}=fixture(true,0)
  const held=actor.dnd5eCarriedObjects![0]
  held.objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-shortbow'
  actor.dnd5eCarriedObjects!.push({id:'ammo',pickupReceipt:'ammo',label:'Ammo',objectState:{schemaVersion:1,wornOrCarried:true,
    weightPounds:2,inventoryItem:{templateId:'srd-5.1:item:arrows',quantity:2,receiptId:'ammo'}}})
  const before=structuredClone(actor)
  const two=consumeDnd5eCompanionAmmunition(actor,['held-weapon:sword','held-weapon:sword'])
  expect(two.ok && two.consumed).toBe(2)
  expect(two.ok && two.carried?.some(item=>item.id==='ammo')).toBe(false)
  expect(consumeDnd5eCompanionAmmunition(actor,Array(3).fill('held-weapon:sword')).ok).toBe(false)
  expect(actor).toEqual(before)
  held.objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-light-crossbow'
  actor.dnd5eCarriedObjects![1].objectState.inventoryItem!.templateId='srd-5.1:item:crossbow-bolts'
  expect(consumeDnd5eCompanionAmmunition(actor,['held-weapon:sword']).ok).toBe(true)
  expect(consumeDnd5eCompanionAmmunition(actor,['held-weapon:sword','held-weapon:sword']).ok).toBe(false)
})

it('uses finesse from the creature and exposes ordinary ranged weapon definitions', () => {
  const { actor, monster } = fixture(true, 0)
  const held = actor.dnd5eCarriedObjects![0]
  held.objectState.inventoryItem!.templateId = 'srd-5.1:equipment:dnd5e-dagger'
  expect(dnd5eMonsterWithHeldWeapon(monster, actor)?.actions.at(-1)?.attack).toMatchObject({ toHit: 4, attackAbility: 'dex', damage: [{ count: 1, sides: 4, bonus: 2 }] })
  for (const id of ['dnd5e-shortbow']) {
    held.objectState.inventoryItem!.templateId = 'srd-5.1:equipment:' + id
    expect(prepareDnd5eCompanionHeldWeapon(actor, held.id, true)).toBeDefined()
    expect(dnd5eMonsterWithHeldWeapon(monster, actor)?.actions.at(-1)?.attack?.mode).toBe('ranged')
  }
})


it.each(['hit','miss','last','ethereal-container','ethereal-arrow','enchanted-stack'] as const)('uses actual packed ammunition through Headless: %s',scenario=>{
 const {actor,input}=fixture(true,0);input.map.tokens[1].x=175
 actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-shortbow'
 let characters=[normalizeCharacter({id:'packer',name:'Packer',equipment:{}})]
 for(const [templateId,quantity] of [['srd-5.1:item:backpack',1],['srd-5.1:item:arrows',scenario==='last'?1:2]] as const){
  const grant=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'packer',templateId,quantity});expect(grant.ok).toBe(true);characters=grant.characters
 }
 const bag=characters[0].dnd5eInventory!.entries.find(e=>e.item.category==='container')!,arrows=characters[0].dnd5eInventory!.entries.find(e=>e.item.ammunitionKind==='arrow')!
 arrows.containerInstanceId=bag.instanceId
 if(scenario==='ethereal-container')bag.planarState='ethereal'
 if(scenario==='ethereal-arrow')arrows.planarState='ethereal'
 const effect=createDnd5eMechanicalEffect({id:'packed-drawn',definitionId:'packed-drawn',label:'Packed drawn arrows',targetId:actor.id,
  source:{kind:'spell',actorId:'caster',rulesId:'test'},duration:{type:'permanent'},modifiers:{weaponEnchantment:{weaponId:'ammunition:'+arrows.instanceId,
   inventoryInstanceId:arrows.instanceId,ammunitionStack:true,drawSourceEffectId:'draw',remainingAttacks:1,attackAndDamageBonus:1}}})
 const weight=(bag.item.weightLb??0)+(arrows.item.weightLb??0)*arrows.quantity
 actor.dnd5eCarriedObjects!.push({id:'pack',label:'Pack',pickupReceipt:'pack',objectState:{schemaVersion:1,wornOrCarried:true,weightPounds:weight,
  inventoryItem:{templateId:bag.templateId,quantity:1,receiptId:'pack',instance:bag,contents:[arrows],boundEffects:scenario==='enchanted-stack'?[effect]:undefined}}})
 const before=structuredClone(input)
 const prepared=prepareDnd5eMonsterAttack(input);if(!prepared.ok)throw Error(prepared.reason)
 const result=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{d20:scenario==='miss'?1:19,damageRolls:[[4]]}]})
 const blocked=scenario.startsWith('ethereal')
 expect(result.result.ok).toBe(!blocked);expect(input).toEqual(before)
 if(blocked){expect(result.application).toBeUndefined();expect(result.result.state.combatants.undead.turn.actionAvailable).toBe(true);return}
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.application!.map]}))).maps[0]
 const pack=saved.tokens.find(t=>t.id===actor.id)!.dnd5eCarriedObjects!.find(i=>i.id==='pack')!
 expect(pack.objectState.weightPounds).toBeCloseTo(weight-(arrows.item.weightLb??0))
 expect(pack.objectState.inventoryItem!.instance!.instanceId).toBe(bag.instanceId)
 expect(pack.objectState.inventoryItem!.contents??[]).toHaveLength(scenario==='last'?0:1)
 if(scenario!=='last')expect(pack.objectState.inventoryItem!.contents![0]).toMatchObject({instanceId:arrows.instanceId,quantity:1,containerInstanceId:bag.instanceId})
 if(scenario==='enchanted-stack')expect(pack.objectState.inventoryItem!.boundEffects??[]).toHaveLength(0)
 expect(result.result.state.combatants.goblin.currentHp).toBe(scenario==='miss'?100:scenario==='enchanted-stack'?93:94)
})


it.each(['active','miss','exhausted','ended-source','suppressed','burst'] as const)('draws from a transferred enchanted container at the Host boundary: %s',scenario=>{
 const {actor,input}=fixture(true,0);input.map.tokens[1].x=175
 if(scenario==='burst')actor.dnd5eSummon!.attacksPerAction=2
 actor.dnd5eCarriedObjects![0].objectState.inventoryItem!.templateId='srd-5.1:equipment:dnd5e-shortbow'
 let characters=[normalizeCharacter({id:'caster',name:'Caster',currentHp:20,maxHp:20,equipment:{}})]
 for(const [templateId,quantity] of [['srd-5.1:item:backpack',1],['srd-5.1:item:arrows',3]] as const){
  const r=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'caster',templateId,quantity});expect(r.ok).toBe(true);characters=r.characters
 }
 const bag=characters[0].dnd5eInventory!.entries.find(e=>e.item.category==='container')!,arrow=characters[0].dnd5eInventory!.entries.find(e=>e.item.ammunitionKind==='arrow')!
 const packed=applyDnd5eInventoryMutation(characters,{type:'set-container',characterId:'caster',instanceId:arrow.instanceId,containerInstanceId:bag.instanceId});expect(packed.ok).toBe(true);characters=packed.characters
 const effect=createDnd5eMechanicalEffect({id:'carried-quiver',definitionId:'quiver',label:'Quiver',targetId:'caster',
  source:{kind:'spell',actorId:'owner',characterId:'caster',rulesId:'quiver'},duration:{type:'concentration',sourceActorId:'owner',concentrationId:'quiver',remainingRounds:600},
  modifiers:{weaponEnchantment:{weaponId:'container:'+bag.instanceId,inventoryInstanceId:bag.instanceId,ammunitionContainer:true,consumeOnDraw:true,
   remainingAttacks:scenario==='exhausted'?1:scenario==='burst'?2:12,attackAndDamageBonus:0,bonusDamage:{count:1,sides:6,type:'fire'}}}})
 if(scenario==='suppressed')effect.suspendedBy=['audit-suppression']
 characters[0].concentrating=true;characters[0].dnd5eCombatState={schemaVersion:2,concentrationSpellId:'quiver',activeEffects:[effect]}
 input.map.tokens.push({id:'owner',characterId:'caster',type:'player',label:'Caster',x:25,y:25,size:1,color:'',emoji:''})
 const drop=prepareDnd5eMapInventoryDrop({map:input.map,characters,actorTokenId:'owner',instanceId:bag.instanceId,expectedInventoryRevision:characters[0].dnd5eInventory!.revision!,requestId:'enchanted-bag',combatActive:false})
 if(!drop.ok)throw Error(drop.reason)
 const picked=prepareDnd5eMapInventoryPickup({map:drop.map,characters:drop.characters,actorTokenId:actor.id,objectTokenId:drop.objectTokenId,expectedReceiptId:drop.objectTokenId,expectedQuantity:1,combatActive:false})
 if(!picked.ok)throw Error(picked.reason)
 if(scenario==='ended-source'){picked.characters[0].concentrating=false;picked.characters[0].dnd5eCombatState!.concentrationSpellId=undefined}
 const withRider=scenario==='active'||scenario==='miss'||scenario==='burst'
 const source=structuredClone(picked)
 const prepared=prepareDnd5eMonsterAttack({...input,map:picked.map,characters:picked.characters,initiativeOrder:[...input.initiativeOrder,{tokenId:'owner',label:'Caster',color:'',emoji:'',roll:0}]})
 if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.attacks[0].attack.damage).toHaveLength(withRider?2:1)
 const result=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{d20:scenario==='miss'?1:19,damageRolls:withRider?[[4],[3]]:[[4]]},...(scenario==='burst'?[{d20:19,damageRolls:[[4]]}]:[])]})
 expect(result.result.ok).toBe(true);expect(picked).toEqual(source)
 expect(result.result.state.combatants.goblin.currentHp).toBe(scenario==='miss'?100:scenario==='burst'?85:withRider?91:94)
 const carried=result.application!.map.tokens.find(t=>t.id===actor.id)!.dnd5eCarriedObjects!.find(i=>i.objectState.inventoryItem?.instance?.instanceId===bag.instanceId)!
 expect(carried.objectState.inventoryItem!.contents!.find(e=>e.instanceId===arrow.instanceId)?.quantity).toBe(scenario==='burst'?1:2)
 const remaining=carried.objectState.inventoryItem!.boundEffects?.find(e=>e.id==='carried-quiver')?.modifiers?.weaponEnchantment?.remainingAttacks
 expect(remaining).toBe(scenario==='exhausted'||scenario==='ended-source'||scenario==='burst'?undefined:scenario==='suppressed'?12:11)
 if(scenario==='exhausted'||scenario==='burst')expect(result.result.state.combatants.owner.concentrating).toBe(false)
 const after=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.application!.map]}))).maps[0]
 const bearer=after.tokens.find(t=>t.id===actor.id)!,drops=droppedDnd5eCompanionObjects(bearer)
 const bagDrop=drops.find(t=>t.dnd5eObjectState?.inventoryItem?.instance?.instanceId===bag.instanceId)!
 const recovered=prepareDnd5eMapInventoryPickup({map:{...after,tokens:[...after.tokens.filter(t=>t.id!==actor.id),...drops]},characters:result.application!.characters,
  actorTokenId:'owner',objectTokenId:bagDrop.id,expectedReceiptId:bagDrop.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:1,combatActive:false})
 if(!recovered.ok)throw Error(recovered.reason)
 const owner=recovered.characters.find(c=>c.id==='caster')!
 expect(owner.dnd5eInventory!.entries.find(e=>e.instanceId===arrow.instanceId)).toMatchObject({quantity:scenario==='burst'?1:2,containerInstanceId:bag.instanceId})
 expect(owner.dnd5eCombatState?.activeEffects?.find(e=>e.id==='carried-quiver')?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(remaining)
})
