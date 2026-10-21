import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_HANDAXE, DND5E_CLUB, DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_HAND_CROSSBOW, DND5E_LIGHT_CROSSBOW, DND5E_LONGBOW, DND5E_OFFHAND_SHORTSWORD, DND5E_SHORTSWORD, defaultEquipmentForDnd5eCharacter } from './equipment'
import {
  dnd5ePreparedEquipmentAttackMagicWeaponBonus,
  dnd5ePreparedEquipmentActivityWeaponDamage,
  dnd5ePreparedEquipmentAttackIsAutomaticCritical,
  dnd5eEquipmentClassDamageDefinitions,
  prepareDnd5eEquipmentAttack,
  buildPreparedDnd5eEquipmentAttackAction,
  dnd5eVisibleEquipmentAttackTargets,
  previewDnd5eEquipmentAttack,
  resolvePreparedDnd5eEquipmentAttack,
} from './equipmentAttackAction'
import { createDnd5eTurnEconomyCounts, spendDnd5eTurnResource } from './turnEconomy'
import { alterDnd5eInventoryItem } from './inventoryItemAlteration'
import { applyDnd5eInventoryMutation, applyDnd5eInventoryGrantBundle, dnd5eInventoryItemTemplate } from './items'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
} from './activeEffects'
import { registerDnd5eRulesPlugin } from './pluginApi'
import {preparedDnd5eEquipmentAttackEffectContext} from './equipmentAttackAction'
import {dnd5eRollDiceRecipes} from './rollDiceModifiers'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import { DND5E_SLING } from './equipment'
import { DND5E_GREATSWORD, DND5E_GREATAXE } from './equipment'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows'
import { dnd5eContextPredicateSatisfiedV1 } from './activities/dnd5eActivityInvocation'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { compileDnd5eActivityPatternV1 } from './activities/dnd5eActivityPatterns'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { prepareDnd5eEquipmentAttackReplacement, resolvePreparedDnd5eEquipmentAttackReplacement } from './activities/dnd5eEquipmentAttackReplacement'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'

it.each(['creature', 'line'] as const)('plans imported %s replacement HP, ammunition and existing attack ledger together', async shape => {
  const input = fixture(75)
  input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
  if (shape === 'line') {
    const other = token({ id: 'other-token', x: 175, y: 25, label: 'Other' })
    input.map.tokens.push(other, token({ id: 'object', x: 125, y: 25, type: 'obstacle' }))
  }
  const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Replacement plan', version: '1.0.0',
    features: [{ id: 'replacement', name: 'Replacement', description: 'Synthetic', summary: 'Synthetic', automation: 'full' }],
    activities: [{ schemaVersion: 1, id: 'replacement', name: 'Replacement', legacySource: { kind: 'feature', id: 'replacement' },
      activation: { kind: 'free' }, target: shape === 'line'
        ? { kind: 'area', origin: 'self', shape: 'line', relation: 'any', lengthFeet: 30, widthFeet: 1,
          requiresLineOfEffect: false, requiresLineOfSight: false }
        : { kind: 'creature', relation: 'any', count: 1 },
      automation: automationCapabilityFromLegacyStatus('full'),
      outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
        amount: { kind: 'constant', value: 0 }, damageType: 'inherit-primary',
        equipmentWeaponDamage: { rollId: 'weapon', weaponBaseIds: ['dnd5e-longbow'] } }] }],
    }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    if (shape === 'line') setMapGeometryRuntime([{ mapId: input.map.id,
      walls: [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 125, y: 0 }, { x: 125, y: 500 }],
        edgeIds: ['wall-edge'], baseHeightFeet: 0, heightFeet: 20, blocksVision: true,
        blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }], doors: [], obstacles: [],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: false, ambientLight: 'bright' }, updatedAt: 1,
    }])
    const ready = prepareDnd5eEquipmentAttackReplacement({
      attack: { ...input, worldMinute: 40, worldSecondRemainder: 0, characters: [input.actor], attacksUsed: 0 },
      packageId: pkg.manifest.id, activityId: 'replacement', areaAimCell: shape === 'line' ? { col: 6, row: 0 } : undefined,
    })
    expect(ready.ok).toBe(true)
    if (!ready.ok) throw Error('prepare failed')
    if (shape === 'creature') expect(ready.prepared.state.combatants[input.actorToken.id].classState.recentCreatureSightings?.[input.targetToken.id]).toMatchObject({ mapId: input.map.id, worldMinute: 40 })
    ready.prepared.state.combatants[input.actorToken.id].pluginFeatureIds = [`${pkg.manifest.id}:replacement`]
    const original = JSON.stringify({ map: input.map, actor: input.actor, state: ready.prepared.state })
    const outcome = resolvePreparedDnd5eEquipmentAttackReplacement({ prepared: ready.prepared,
      areaAimCell: shape === 'line' ? { col: 6, row: 0 } : undefined, activity: {
      combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: { weapon: { values: [3] } },
      command: { schemaVersion: 1, commandId: 'replacement', packageId: pkg.manifest.id, packageVersion: pkg.manifest.version,
        activityId: 'replacement', actorId: input.actorToken.id, targetIds: [input.targetToken.id], expectedRevision: 1 },
    } })
    expect(outcome.result.ok, JSON.stringify(outcome.result)).toBe(true)
    if (shape === 'line' && outcome.result.ok) {
      expect(outcome.result.state.initiativeOrder).not.toContain('other-token')
      expect(outcome.result.events.filter(event => event.type === 'damage-applied').map(event => event.targetId).sort())
        .toEqual(['enemy-token', 'other-token'])
    }
    expect(outcome.attackSlot).toMatchObject({ attackNumber: 1, attacksAllowed: 2, spendsAction: true })
    expect(outcome.application?.changedCharacterIds).toContain(input.actor.id)
    expect(outcome.application?.characters[0].dnd5eInventory?.entries.find(entry => entry.item.ammunitionKind === 'arrow')?.quantity).toBe(19)
    expect(outcome.application?.characterPatches?.[input.actor.id].dnd5eInventory).toBeDefined()
    expect(JSON.stringify({ map: input.map, actor: input.actor, state: ready.prepared.state })).toBe(original)
    input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:replacement`]
    const feature = prepareDnd5ePluginFeatureAction({ ...input, worldMinute: 40, worldSecondRemainder: 0, characters: [input.actor],
      action: { ...input.action, type: 'dnd5e-plugin-action', targetCell: shape === 'line' ? { col: 6, row: 0 } : undefined,
        dnd5ePluginAction: { featureId: `${pkg.manifest.id}:replacement` } },
    })
    expect(feature.ok, JSON.stringify(feature)).toBe(true)
    if (!feature.ok) throw Error('feature preparation failed')
    for (const boundary of ['simple', 'material']) {
    let calls = 0
    const react = (state: typeof feature.prepared.state) => {
      calls++
      const next = structuredClone(state)
      next.combatants['enemy-token'].damageResistances = ['piercing']
      return next
    }
    const featureResult = await resolvePreparedDnd5ePluginFeatureAction({ prepared: feature.prepared, combatRevision: 1,
      resolveDamageBoundary: boundary === 'simple' ? async (state, resolve) => resolve(react(state)) : undefined,
      resolveMaterialDamageBoundary: boundary === 'material' ? async (state, resolve, succeeded) => {
        const result = resolve(react(state))
        expect(succeeded(result)).toBe(true)
        return { result, materialChanges: [] }
      } : undefined,
      rolls: { weapon: { values: [3], modifier: 0, total: 3 } } })
    expect(calls).toBe(1)
    expect(featureResult.result.ok, JSON.stringify(featureResult.result)).toBe(true)
    expect(featureResult.equipmentAttackSlot?.attackNumber).toBe(1)
    expect(featureResult.application?.characters[0].dnd5eInventory?.entries.find(entry => entry.item.ammunitionKind === 'arrow')?.quantity).toBe(19)
    expect(featureResult.result.state.combatants['enemy-token'].currentHp).toBe(18)
    expect(feature.prepared.state.combatants['enemy-token'].damageResistances).not.toContain('piercing')
    }
  } finally { dispose(); setMapGeometryRuntime([]) }
})

it.each([DND5E_CLUB, DND5E_SHORTSWORD, DND5E_GREATSWORD, DND5E_GREATAXE].flatMap(weapon => [18, 20].map(d20 => ({ weapon, d20 }))))('preserves the actual equipment category and original dice through Host attack trigger windows ($weapon.id, $d20)', ({ weapon, d20 }) => {
  const input = fixture(45)
  input.actor.equipment = { mainWeapon: weapon }
  const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
  expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true)
  if (!prepared.ok) return
  const profile = prepared.prepared.profile.damage
  const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20,
    damageRolls: Array.from({ length: profile.count * (d20 === 20 ? 2 : 1) }, () => 2) })
  expect(resolved.result.ok).toBe(true)
  const eventIndex = resolved.result.events.findIndex(event => event.type === 'attack-resolved')
  const event = resolved.result.events[eventIndex]
  expect(event).toMatchObject({ type: 'attack-resolved', weaponCategory: weapon.dnd5e?.kind === 'weapon' ? weapon.dnd5e.category : undefined })
  const windows = dnd5eActivityTriggerContextsFromCombatEventV1(resolved.result.state, event, eventIndex, 'test-category')
  const hit = windows.find(window => window.event === 'attack-hit')!
  expect(hit).toBeDefined()
  expect(hit.source).toMatchObject({ result: d20 === 20 ? 'critical-hit' : 'hit',
    weaponDamageDice: { count: profile.count, sides: profile.sides } })
  if (event.type !== 'attack-resolved' || hit.source.kind !== 'attack') throw Error('expected attack evidence')
  expect(hit.source.weaponDamageDice).not.toBe(event.weaponDamageDice)
  input.actor.equipment = { mainWeapon: DND5E_CLUB }
  expect(JSON.parse(JSON.stringify(hit)).source.weaponDamageDice).toEqual({ count: profile.count, sides: profile.sides })
  for (const category of ['simple', 'martial'] as const) {
    expect(dnd5eContextPredicateSatisfiedV1({ kind: 'attack-weapon-category', categories: [category] },
      JSON.parse(JSON.stringify(hit)))).toBe(weapon.dnd5e?.kind === 'weapon' && weapon.dnd5e.category === category)
  }
})

function fighter(): Character {
  const base: Character = {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 5, background: '士兵', experience: 6500, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 44, currentHp: 44, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
  }
  return applyDnd5eInventoryMutation([base], {
    type: 'grant', characterId: base.id, templateId: 'srd-5.1:item:arrows', quantity: 20,
  }).characters[0]
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 25, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 20, maxHp: 20, ...patch }
}

function fixture(targetX = 75) {
  const actor = fighter()
  const actorToken = token({ id: 'fighter-token', type: 'player', characterId: actor.id, label: actor.name })
  const targetToken = token({ id: 'enemy-token', label: '哥布林', x: targetX })
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, targetToken] }
  const action: SharedPlayerActionState = { id: 'action', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-weapon-attack', actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: targetToken.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actor.name, emoji: '', color: '', roll: 20 },
    { tokenId: targetToken.id, label: targetToken.label, emoji: '', color: '', roll: 10 },
  ]
  return { actor, actorToken, targetToken, map, action, initiativeOrder }
}

it.each(['melee', 'ranged-over-sixty', 'melee-too-far', 'reaction-spent'] as const)(
  'prepares a parent-bound saving throw counter with actual equipment: %s', branch => {
    const featureId = 'test.counter-equipment:path.counter'
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.counter-equipment', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'path', name: 'Path', classId: 'fighter', summary: 'Synthetic',
        abilities: [{ schemaVersion: 1, id: 'counter', name: 'Counter', description: 'Synthetic', level: 1,
          trigger: { kind: 'before-saving-throw' }, cost: { economy: 'reaction' }, targeting: { kind: 'self' },
          effects: [], automation: 'full', mechanic: { kind: 'saving-throw-weapon-counterattack', markEffectDefinitionId: 'prey' } }] }) },
    })
    try {
      const input = fixture()
      input.actor.dnd5eClassChoices = { fighter: { subclass: 'test.counter-equipment:path' } }
      input.actor.dnd5ePluginFeatureIds = [featureId]
      Object.assign(input.actor, normalizeCharacter({ ...input.actor, dnd5eClassLevels: { fighter: 5 } }))
      input.actor.equipment = { mainWeapon: branch === 'ranged-over-sixty' ? DND5E_LONGBOW : DND5E_SHORTSWORD }
      input.actor.dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION, activeEffects: [
        createDnd5eMechanicalEffect({ definitionId: 'prey', label: 'Prey', targetId: input.actorToken.id,
          source: { kind: 'plugin', actorId: input.actorToken.id, pluginId: 'test.counter-equipment' },
          modifiers: { onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary',
            appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true, oncePerTurn: true,
            consumeEffectOnHit: false, boundTargetId: input.targetToken.id } } }),
      ] }
      const initial = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
      expect(initial.ok, initial.ok ? '' : initial.reason).toBe(true)
      if (!initial.ok) return
      const parent = initial.prepared.state
      parent.initiativeIndex = 1
      parent.combatants[input.actorToken.id].turn.actionAvailable = false
      if (branch === 'reaction-spent') parent.combatants[input.actorToken.id].turn.reactionAvailable = false
      if (branch === 'ranged-over-sixty' || branch === 'melee-too-far') input.targetToken.x = 1025
      const before = structuredClone(parent)
      const ready = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 99,
        savingThrowCounterattack: { state: parent, featureId } })
      expect(parent).toEqual(before)
      expect(ready.ok, ready.ok ? '' : JSON.stringify({ reason: ready.reason, actor: {
        features: parent.combatants[input.actorToken.id].pluginFeatureIds,
        subclasses: parent.combatants[input.actorToken.id].subclassIds,
        effects: parent.combatants[input.actorToken.id].classState.activeEffects,
      } })).toBe(branch === 'melee' || branch === 'ranged-over-sixty')
      if (!ready.ok) return
      expect(ready.prepared.spendsAction).toBe(false)
      expect(ready.prepared.countsTowardAttackAction).toBe(false)
      expect(ready.prepared.state.initiativeIndex).toBe(1)
      const args = { prepared: ready.prepared, d20: 15, damageRolls: [3] }
      const attack = buildPreparedDnd5eEquipmentAttackAction(args)
      expect(attack.classDamageContext?.mode).toBe(branch === 'melee' ? 'melee' : 'ranged')
      expect(attack.attackModifier).toBe(ready.prepared.profile.attackModifier)
      expect(attack.damage).toMatchObject({ rolls: [3], sides: ready.prepared.profile.damage.sides })
      expect(resolvePreparedDnd5eEquipmentAttack(args).result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    } finally { dispose() }
  },
)

it('commits an owned pre-attack teleport with the attack and rolls back a rejected attack', async () => {
  const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({
    name: 'Attack teleport', version: '1.0.0',
    features: [{ id: 'step', name: 'Step', description: 'Synthetic', summary: 'Synthetic', automation: 'full',
      declarativeAbility: { schemaVersion: 1, id: 'step', name: 'Step', description: 'Synthetic',
        level: 1, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const input = fixture(175)
    input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:step`]
    input.actor.equipment = { mainWeapon: DND5E_SHORTSWORD }
    const request = { ...input, characters: [input.actor], attacksUsed: 0 }
    expect(prepareDnd5eEquipmentAttack(request).ok).toBe(false)
    input.action.dnd5eWeaponAttackOptions = { attackActionTeleport: { targetCell: { col: 2, row: 0 } } }
    const before = JSON.stringify(request)
    const ready = prepareDnd5eEquipmentAttack(request)
    expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
    if (!ready.ok) throw Error('teleport preparation failed')
    expect(ready.prepared.distanceFeet).toBe(5)
    expect(ready.prepared.state.combatants['fighter-token'].position).toEqual({ x: 125, y: 25 })
    const invalid = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 99, damageRolls: [2] })
    expect(invalid.result.ok).toBe(false)
    expect(invalid.application).toBeUndefined()
    expect(invalid.result.state.combatants['fighter-token'].position).toEqual({ x: 25, y: 25 })
    const done = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 1, damageRolls: [2] })
    expect(done.result.ok, done.result.ok ? '' : done.result.reason).toBe(true)
    expect(done.result.events[0]).toMatchObject({ type: 'teleported', distanceFeet: 10,
      from: { x: 25, y: 25 }, to: { x: 125, y: 25 } })
    expect(done.application?.map.tokens.find(token => token.id === 'fighter-token')).toMatchObject({ x: 125, y: 25 })
    expect(done.result.state.combatants['fighter-token'].turn.actionAvailable).toBe(false)
    expect(done.result.state.combatants['fighter-token'].classState.attackActionHistory?.attacksTaken).toBe(1)
    expect(JSON.stringify(request)).toBe(before)
    if (!done.application) throw Error('missing teleport application')
    const restored = JSON.parse(JSON.stringify(done.application))
    const next = prepareDnd5eEquipmentAttack({ ...request, map: restored.map, characters: restored.characters,
      attacksUsed: 1, action: { ...input.action, id: 'second-attack',
        dnd5eWeaponAttackOptions: { attackActionTeleport: { targetCell: { col: 2, row: 1 } } } } })
    expect(next.ok, next.ok ? '' : next.reason).toBe(true)
    if (!next.ok) throw Error('second teleport preparation failed')
    expect(next.prepared.spendsAction).toBe(false)
    const second = resolvePreparedDnd5eEquipmentAttack({ prepared: next.prepared, d20: 1, damageRolls: [2] })
    expect(second.result.ok).toBe(true)
    expect(second.application?.map.tokens.find(token => token.id === 'fighter-token')).toMatchObject({ x: 125, y: 75 })
    expect(second.result.state.combatants['fighter-token'].classState.attackActionHistory?.attacksTaken).toBe(2)
    const denied = structuredClone(ready.prepared)
    denied.state.combatants['fighter-token'].pluginFeatureIds = []
    expect(resolvePreparedDnd5eEquipmentAttack({ prepared: denied, d20: 1, damageRolls: [2] }).application).toBeUndefined()
    const occupied = structuredClone(ready.prepared)
    occupied.map.tokens.push(token({ id: 'new-occupant', x: 125, y: 25 }))
    const stale = resolvePreparedDnd5eEquipmentAttack({ prepared: occupied, d20: 1, damageRolls: [2] })
    expect(stale.result.ok).toBe(false)
    expect(stale.application).toBeUndefined()
    expect(stale.result.state.combatants['fighter-token'].position).toEqual({ x: 25, y: 25 })
    input.actor.dnd5ePluginFeatureIds = []
    expect(prepareDnd5eEquipmentAttack(request).ok).toBe(false)
    input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:step`]
    input.action.dnd5eWeaponAttackOptions.offHandAttack = true
    expect(prepareDnd5eEquipmentAttack(request).ok).toBe(false)
  } finally { dispose() }
})

it('honors free attack grants after the bonus action is spent without changing paid grants', () => {
  for (const economy of ['none', 'bonus-action'] as const) {
    const input = fixture()
    input.actor.dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activityWeaponAttackGrants: { follow: { schemaVersion: 1, grantId: 'follow', label: 'Follow-up',
        sourceActivityId: 'test-follow', appliedTurnKey: 'combat:1:fighter-token', economy,
        requiredTargetId: 'enemy-token', remainingAttacks: 1, attackActionFollowUp: true } } }
    input.action.dnd5eWeaponAttackOptions = { activityWeaponAttackGrantId: 'follow' }
    const turnEconomy = spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('turn'), 'bonusAction').economy
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 2, turnEconomy })
    expect(prepared.ok).toBe(economy === 'none')
    if (!prepared.ok) continue
    expect(prepared.prepared).toMatchObject({spendsAction: false, spendsBonusAction: false, countsTowardAttackAction: false})
    const result = resolvePreparedDnd5eEquipmentAttack({prepared: prepared.prepared, d20: 15, damageRolls: [3]})
    expect(result.result.ok).toBe(true)
    expect(result.result.events).not.toContainEqual(expect.objectContaining({type: 'turn-resource-spent'}))
    expect(result.result.events).toContainEqual(expect.objectContaining({type: 'attack-resolved', attackOrigin: 'attack-action'}))
    expect(result.result.state.combatants['fighter-token'].classState.activityWeaponAttackGrants?.follow).toBeUndefined()
  }
})

it('keeps the area owner reaction consistent between weapon preview and authoritative settlement', () => {
  const input = fixture()
  input.map.dnd5ePluginAreas = [{ id: 'hawk', pluginId: 'test', featureId: 'totem', label: 'Hawk', color: '#fff',
    sourceTokenId: input.actorToken.id, sourceCharacterId: input.actor.id, cells: [{ col: 1, row: 0 }],
    createdRound: 1, expiresAfterRound: 10, includeSelf: true, relation: 'any', attackAdvantageReaction: 'area-source' }]
  const result = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  const prepared = result.prepared
  expect(previewDnd5eEquipmentAttack(prepared, 2, 18).roll.d20).toBe(2)
  prepared.areaAttackAdvantageReaction = { areaId: 'hawk', sourceId: input.actorToken.id }
  expect(previewDnd5eEquipmentAttack(prepared, 2, 18).roll.d20).toBe(18)
  const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared, d20: 2, d20Second: 18, damageRolls: [3] })
  expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
  expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
  expect(resolved.result.state.combatants[input.actorToken.id].turn.reactionAvailable).toBe(false)
  prepared.areaAttackAdvantageReaction = { areaId: 'forged', sourceId: input.actorToken.id }
  expect(previewDnd5eEquipmentAttack(prepared, 2, 18).roll.d20).toBe(2)
  expect(resolvePreparedDnd5eEquipmentAttack({ prepared, d20: 2, d20Second: 18, damageRolls: [3] }).result.ok).toBe(false)
})

describe('D&D 5e equipment attack authority', () => {
  it.each(['no-attack-check', 'no-attack-slot'] as const)('rejects Activity teleport with %s', async variant => {
    const imported = prepareDnd5eLocalContentJson(JSON.stringify({
      name: 'Invalid Activity teleport', version: '1.0.0',
      features: [{ id: 'bolt', name: 'Bolt', description: 'Synthetic', summary: 'Synthetic', automation: 'full' },
        { id: 'step', name: 'Step', description: 'Synthetic', summary: 'Synthetic', automation: 'full',
          declarativeAbility: { schemaVersion: 1, id: 'step', name: 'Step', description: 'Synthetic',
            level: 1, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
            mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } }],
      activities: [{ schemaVersion: 1, id: 'bolt', name: 'Bolt', legacySource: { kind: 'feature', id: 'bolt' },
        ...(variant === 'no-attack-check' ? { usesAttackActionAttack: true } : {}),
        activation: { kind: 'free' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
        checks: variant === 'no-attack-check' ? [] : [{ id: 'hit', kind: 'attack-roll', attackType: 'spell',
          delivery: 'melee', rollId: 'hit', rollMode: 'normal',
          attackBonus: { kind: 'constant', value: 5 }, scope: 'per-target' }],
        outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage',
          kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 1 } }] }],
        automation: automationCapabilityFromLegacyStatus('full') }],
    }))
    if (variant === 'no-attack-check') {
      await expect(imported).rejects.toThrow('usesAttackActionAttack requires')
      return
    }
    const { package: pkg } = await imported
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      const input = fixture(175)
      input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:bolt`, `${pkg.manifest.id}:step`]
      const result = prepareDnd5ePluginFeatureAction({ ...input, characters: [input.actor],
        turnEconomy: createDnd5eTurnEconomyCounts('combat:1:fighter-token'),
        action: { ...input.action, type: 'dnd5e-plugin-action',
          dnd5ePluginAction: { featureId: `${pkg.manifest.id}:bolt`,
            attackActionTeleport: { targetCell: { col: 2, row: 0 } } } } })
      expect(result).toMatchObject({ ok: false, reason: 'feature-unavailable' })
      expect(input.actorToken).toMatchObject({ x: 25, y: 25 })
    } finally { dispose() }
  })

  it('commits pre-attack teleport with an imported attack Activity and rejects invalid or unowned destinations', async () => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({
      name: 'Activity attack teleport', version: '1.0.0',
      features: [{ id: 'bolt', name: 'Bolt', description: 'Synthetic', summary: 'Synthetic', automation: 'full' },
        { id: 'step', name: 'Step', description: 'Synthetic', summary: 'Synthetic', automation: 'full',
          declarativeAbility: { schemaVersion: 1, id: 'step', name: 'Step', description: 'Synthetic',
            level: 1, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
            mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } }],
      activities: [{ schemaVersion: 1, id: 'bolt', name: 'Bolt', legacySource: { kind: 'feature', id: 'bolt' },
        usesAttackActionAttack: true, activation: { kind: 'free' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
        checks: [{ id: 'hit', kind: 'attack-roll', attackType: 'spell', delivery: 'melee',
          rollId: 'hit', rollMode: 'normal', attackBonus: { kind: 'constant', value: 5 }, scope: 'per-target' }],
        outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'hit', result: 'success' },
          operations: [{ id: 'damage', kind: 'damage', target: 'target', damageType: 'force',
            amount: { kind: 'constant', value: 1 } }] }],
        automation: automationCapabilityFromLegacyStatus('full') }],
    }))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      const input = fixture(175), stepId = `${pkg.manifest.id}:step`
      input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:bolt`, stepId]
      const request = { ...input, characters: [input.actor],
        turnEconomy: createDnd5eTurnEconomyCounts('combat:1:fighter-token'),
        action: { ...input.action, type: 'dnd5e-plugin-action' as const,
          dnd5ePluginAction: { featureId: `${pkg.manifest.id}:bolt`,
            attackActionTeleport: { targetCell: { col: 2, row: 0 } } } } }
      expect(prepareDnd5ePluginFeatureAction({ ...request, action: { ...request.action,
        dnd5ePluginAction: { featureId: `${pkg.manifest.id}:bolt` } } }).ok).toBe(false)
      const before = JSON.stringify(request)
      const ready = prepareDnd5ePluginFeatureAction(request)
      expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
      if (!ready.ok) throw Error('Activity teleport preparation failed')
      expect(ready.prepared.distanceFeet).toBe(5)
      const invalid = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared,
        combatRevision: 1, rolls: { 'hit:enemy-token': { values: [99], modifier: 0, total: 99 } } })
      expect(invalid.result.ok).toBe(false)
      expect(invalid.application).toBeUndefined()
      expect(invalid.result.state.combatants['fighter-token'].position).toEqual({ x: 25, y: 25 })
      const rolls = { 'hit:enemy-token': { values: [1], modifier: 0, total: 1 } }
      const done = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared, combatRevision: 1, rolls })
      expect(done.result.ok, done.result.ok ? '' : done.result.reason).toBe(true)
      expect(done.result.events[0]).toMatchObject({ type: 'teleported', distanceFeet: 10,
        from: { x: 25, y: 25 }, to: { x: 125, y: 25 } })
      expect(done.application?.map.tokens.find(token => token.id === 'fighter-token')).toMatchObject({ x: 125, y: 25 })
      expect(done.equipmentAttackSlot).toMatchObject({ attackNumber: 1, spendsAction: true })
      expect(done.result.state.combatants['fighter-token'].classState.attackActionHistory?.attacksTaken).toBe(1)
      expect(JSON.stringify(request)).toBe(before)
      const occupied = { ...ready.prepared, map: { ...input.map,
        tokens: [...input.map.tokens, token({ id: 'blocker', x: 125, y: 25 })] } }
      expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: occupied, combatRevision: 1, rolls })).result.ok).toBe(false)
      input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:bolt`]
      expect(prepareDnd5ePluginFeatureAction(request).ok).toBe(false)
      const unowned = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared, combatRevision: 1, rolls })
      expect(unowned.result.ok).toBe(false)
      expect(unowned.application).toBeUndefined()
    } finally { dispose() }
  })

  it('charges the next Activity Attack action after a conditional bonus and preserves total attack numbering', async () => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({
      name: 'Distinct mixed budget', version: '1.0.0',
      features: [{ id: 'bolt', name: 'Bolt', description: 'Synthetic', summary: 'Synthetic', automation: 'full' },
        { id: 'distinct', name: 'Distinct', description: 'Synthetic', summary: 'Synthetic', automation: 'full',
          declarativeAbility: { schemaVersion: 1, id: 'distinct', name: 'Distinct', description: 'Synthetic',
            level: 1, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
            mechanic: { kind: 'distinct-target-bonus-attack', minimumDistinctTargets: 2 } } }],
      activities: [{ schemaVersion: 1, id: 'bolt', name: 'Bolt', legacySource: { kind: 'feature', id: 'bolt' },
        usesAttackActionAttack: true, activation: { kind: 'free' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
        checks: [{ id: 'hit', kind: 'attack-roll', attackType: 'spell', delivery: 'ranged',
          rollId: 'hit', rollMode: 'normal', attackBonus: { kind: 'constant', value: 5 }, scope: 'per-target' }],
        outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'hit', result: 'success' },
          operations: [{ id: 'damage', kind: 'damage', target: 'target', damageType: 'force',
            amount: { kind: 'constant', value: 1 } }] }],
        automation: automationCapabilityFromLegacyStatus('full') }],
    }))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      for (const [used, current, allowed, spendsAction] of [
        [3, 1, true, true], [3, 0, false, true], [4, 0, true, false], [5, 1, false, false],
      ] as const) {
        const input = fixture(), turnKey = 'combat:1:fighter-token'
        input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:bolt`]
        input.actor.dnd5eCombatState = { weaponAttackActionTurnKey: turnKey,
          attackActionHistory: { turnKey, actionOrdinal: used === 3 ? 1 : 2, attacksTaken: used === 3 ? 3 : used - 3,
            creatureTargetIds: ['old-a', 'old-b'], restricted: false, bonusAttacksTakenThisTurn: 1,
            usedDistinctTargetBonusFeatureIds: ['test:used'] } }
        const economy = createDnd5eTurnEconomyCounts(turnKey)
        economy.action.max = 2; economy.action.current = current; economy.attacksUsed = used
        const prepared = prepareDnd5ePluginFeatureAction({ ...input, characters: [input.actor], turnEconomy: economy,
          action: { ...input.action, type: 'dnd5e-plugin-action',
            dnd5ePluginAction: { featureId: `${pkg.manifest.id}:bolt` } } })
        expect(prepared.ok, `${used}/${current}`).toBe(allowed)
        if (!prepared.ok) continue
        expect(prepared.prepared.featureAttackBudget?.attacksUsed).toBe(used - 1)
        const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared,
          combatRevision: 1, rolls: { 'hit:enemy-token': { values: [1], modifier: 0, total: 1 } } })
        expect(resolved.result.ok, resolved.result.ok ? '' : resolved.result.reason).toBe(true)
        expect(resolved.equipmentAttackSlot).toMatchObject({ attackNumber: used + 1, spendsAction })
        expect(resolved.result.state.combatants['fighter-token'].classState.attackActionHistory?.bonusAttacksTakenThisTurn).toBe(1)
      }
      const input = fixture(), turnKey = 'combat:1:fighter-token', bonusId = `${pkg.manifest.id}:distinct`
      input.actor.dnd5ePluginFeatureIds = [`${pkg.manifest.id}:bolt`, bonusId]
      input.actor.dnd5eCombatState = { weaponAttackActionTurnKey: turnKey,
        attackActionHistory: { turnKey, actionOrdinal: 1, attacksTaken: 2,
          creatureTargetIds: ['old-a', 'old-b'], restricted: false } }
      const economy = createDnd5eTurnEconomyCounts(turnKey)
      economy.action.current = 0; economy.attacksUsed = 2
      const ready = prepareDnd5ePluginFeatureAction({ ...input, characters: [input.actor], turnEconomy: economy,
        action: { ...input.action, type: 'dnd5e-plugin-action',
          dnd5ePluginAction: { featureId: `${pkg.manifest.id}:bolt` } } })
      expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
      if (!ready.ok) throw Error('conditional Activity preparation failed')
      expect(ready.prepared.distinctTargetBonusAttackFeatureId).toBe(bonusId)
      const rolls = { 'hit:enemy-token': { values: [1], modifier: 0, total: 1 } }
      // Preparation is not authorization: recheck the current action history at commit.
      for (const invalidation of ['repeated-target', 'restricted-action', 'insufficient-targets'] as const) {
        const state = JSON.parse(JSON.stringify(ready.prepared.state))
        const history = state.combatants['fighter-token'].classState.attackActionHistory
        if (invalidation === 'repeated-target') history.creatureTargetIds.push('enemy-token')
        if (invalidation === 'restricted-action') history.restricted = true
        if (invalidation === 'insufficient-targets') history.creatureTargetIds = ['old-a']
        const before = JSON.stringify(state)
        const rejected = await resolvePreparedDnd5ePluginFeatureAction({
          prepared: { ...ready.prepared, state }, combatRevision: 1, rolls,
        })
        expect(rejected.result.ok, invalidation).toBe(false)
        expect(rejected.application, invalidation).toBeUndefined()
        expect(JSON.stringify(state), invalidation).toBe(before)
      }
      const used = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared, combatRevision: 1, rolls })
      expect(used.result.ok, used.result.ok ? '' : used.result.reason).toBe(true)
      expect(used.equipmentAttackSlot).toMatchObject({ attackNumber: 3, spendsAction: false })
      expect(used.result.state.combatants['fighter-token'].classState.attackActionHistory).toMatchObject({
        bonusAttacksTakenThisTurn: 1, usedDistinctTargetBonusFeatureIds: [bonusId],
        creatureTargetIds: ['old-a', 'old-b', 'enemy-token'],
      })
      const replay = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: { ...ready.prepared, state: JSON.parse(JSON.stringify(used.result.state)) }, combatRevision: 2, rolls,
      })
      expect(replay.result.ok).toBe(false)
      expect(replay.application).toBeUndefined()
    } finally { dispose() }
  })
  it('keeps conditional distinct-target attacks separate from the next Attack action budget through map reload', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.distinct-slot', name: 'Distinct slot', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { featureId = api.registerFeature({ id: 'distinct', name: 'Distinct', description: 'Synthetic',
        summary: 'Synthetic', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'distinct',
          name: 'Distinct', description: 'Synthetic', level: 1, trigger: { kind: 'passive' },
          targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'distinct-target-bonus-attack', minimumDistinctTargets: 2 } } }) },
    })
    try {
      const input = fixture()
      input.actor.dnd5ePluginFeatureIds = [featureId]
      const targets = ['enemy-token', 'second', 'third']
      input.map.tokens.push(...targets.slice(1).map(id => ({ ...input.targetToken, id })))
      let map = input.map, characters: readonly Character[] = [input.actor]
      for (let attacksUsed = 0; attacksUsed < 6; attacksUsed++) {
        const extra = attacksUsed % 3 === 2
        const ready = prepareDnd5eEquipmentAttack({ ...input, map, characters, attacksUsed, attackActionsAvailable: 2,
          action: { ...input.action, id: `distinct-${attacksUsed}`, targetTokenId: targets[attacksUsed % 3] } })
        expect(ready.ok, ready.ok ? '' : `${attacksUsed}: ${ready.reason}`).toBe(true)
        if (!ready.ok) throw Error('prepare failed')
        expect(ready.prepared.spendsAction).toBe(attacksUsed % 3 === 0)
        expect(ready.prepared.classDamageContext.distinctTargetBonusAttackFeatureId).toBe(extra ? featureId : undefined)
        // Do not expose this conditional slot as an unconditional Activity replacement budget.
        if (extra) expect(ready.prepared.attackBudget).toBeUndefined()
        const done = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 1,
          damageRolls: Array(ready.prepared.profile.damage.count).fill(2) })
        expect(done.result.ok, done.result.ok ? '' : done.result.reason).toBe(true)
        if (!done.application) throw Error('missing map application')
        const saved = JSON.parse(JSON.stringify(done.application))
        map = saved.map; characters = saved.characters
        expect(characters[0].dnd5eCombatState?.attackActionHistory?.bonusAttacksTakenThisTurn)
          .toBe(Math.floor((attacksUsed + 1) / 3))
      }
      expect(prepareDnd5eEquipmentAttack({ ...input, map, characters, attacksUsed: 6, attackActionsAvailable: 2 }).ok).toBe(false)
    } finally { dispose() }
  })
  it.each([1, 18, 20])('settles only first-turn extra weapon attacks with their own damage, including two Attack actions (d20 %i)', extraD20 => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.first-turn-weapon', name: 'First turn weapon', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        featureId = api.registerFeature({ id: 'ambush', name: 'Ambush', description: 'Synthetic', summary: 'Synthetic',
          automation: 'full',
          declarativeAbility: { schemaVersion: 1, id: 'ambush', name: 'Ambush', description: 'Synthetic', level: 5,
            trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
            mechanic: { kind: 'first-own-turn-extra-weapon-attack', damageDice: { count: 1, sides: 8 } } } })
      },
    })
    try {
      const input = fixture()
      input.actor.dnd5ePluginFeatureIds = [featureId]
      input.targetToken.hp = 100
      input.targetToken.maxHp = 100
      let map = input.map
      let characters: readonly Character[] = [input.actor]
      for (let attacksUsed = 0; attacksUsed < 6; attacksUsed++) {
        const extra = attacksUsed % 3 === 2
        const ready = prepareDnd5eEquipmentAttack({ ...input, map, characters, attacksUsed, attackActionsAvailable: 2,
          action: { ...input.action, id: `attack-${attacksUsed}` } })
        expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
        if (!ready.ok) throw Error('prepare failed')
        expect(ready.prepared.spendsAction).toBe(attacksUsed % 3 === 0)
        expect(ready.prepared.classDamageContext.firstOwnTurnWeaponAttackFeatureId).toBe(extra ? featureId : undefined)
        const critical = extra && extraD20 === 20
        const riders = dnd5eEquipmentClassDamageDefinitions(ready.prepared, critical)
        expect(riders).toHaveLength(extra ? 1 : 0)
        if (extra) expect(riders[0]).toMatchObject({ count: 1, sides: 8,
          type: ready.prepared.profile.damage.type, doubleOnCritical: true })
        const beforeHp = ready.prepared.state.combatants[input.targetToken.id].currentHp
        const done = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared,
          d20: extra ? extraD20 : 1,
          damageRolls: Array(ready.prepared.profile.damage.count * (critical ? 2 : 1)).fill(2),
          classDamageRolls: extra && extraD20 !== 1 ? riders.map(rider => ({
            source: rider.source, rollId: rider.rollId, rolls: Array(critical ? 2 : 1).fill(4),
          })) : [],
        })
        expect(done.result.ok, done.result.ok ? '' : done.result.reason).toBe(true)
        if (!done.application) throw Error('missing map writeback')
        const damage = extra && extraD20 !== 1
          ? ready.prepared.profile.damage.count * (critical ? 4 : 2) + ready.prepared.profile.damage.bonus + (critical ? 8 : 4) : 0
        expect(done.result.state.combatants[input.targetToken.id].currentHp).toBe(beforeHp - damage)
        if (extra) expect(done.result.state.combatants[input.actorToken.id].classState.firstOwnTurnWeaponAttack).toBeUndefined()
        const saved = JSON.parse(JSON.stringify(done.application))
        map = saved.map
        characters = saved.characters
        if (extra) {
          expect(prepareDnd5eEquipmentAttack({ ...input, map, characters, attacksUsed, attackActionsAvailable: 2 }).ok).toBe(false)
          const replay = resolvePreparedDnd5eEquipmentAttack({
            prepared: { ...ready.prepared, state: done.result.state }, d20: 1, damageRolls: [2],
          })
          expect(replay.result.ok).toBe(false)
          if (!replay.result.ok) expect(replay.result.reason).toBe('invalid-class-feature')
          expect(replay.application).toBeUndefined()
        }
      }
      expect(prepareDnd5eEquipmentAttack({ ...input, map, characters, attacksUsed: 6, attackActionsAvailable: 2 }).ok).toBe(false)
      const later = prepareDnd5eEquipmentAttack({ ...input, map, characters, attacksUsed: 2,
        action: { ...input.action, round: 2 } })
      expect(later.ok).toBe(false)
      const haste = fixture()
      haste.actor.dnd5ePluginFeatureIds = [featureId]
      haste.actor.dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
        activeEffects: [createDnd5eMechanicalEffect({ id: 'haste-extra-test', definitionId: 'haste-extra-test',
          label: 'Haste', targetId: haste.actor.id, source: { kind: 'spell', actorId: haste.actor.id, rulesId: 'haste' },
          modifiers: { restrictedExtraAction: { allowedActions: ['weapon-attack'], maximumWeaponAttacks: 1 } } })] }
      const economy = createDnd5eTurnEconomyCounts('combat:1:fighter-token', 30)
      economy.action.current = 0
      const restricted = prepareDnd5eEquipmentAttack({ ...haste, characters: [haste.actor], attacksUsed: 0, turnEconomy: economy })
      expect(restricted.ok).toBe(true)
      if (!restricted.ok) throw Error('Haste preparation failed')
      const restrictedDone = resolvePreparedDnd5eEquipmentAttack({ prepared: restricted.prepared, d20: 1, damageRolls: [2] })
      expect(restrictedDone.result.ok).toBe(true)
      expect(restrictedDone.result.state.combatants[haste.actorToken.id].classState.firstOwnTurnWeaponAttack).toBeUndefined()
      if (!restrictedDone.application) throw Error('Haste writeback missing')
      expect(prepareDnd5eEquipmentAttack({ ...haste, map: restrictedDone.application.map,
        characters: restrictedDone.application.characters, attacksUsed: 2, turnEconomy: economy }).ok).toBe(false)
    } finally { dispose() }
  })

  it('applies filtered magical attacks through actual equipment profiles without enchanting unrelated weapons', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.filtered-magic', name: 'Filtered magic', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) { featureId = api.registerFeature({ id: 'bow', name: 'Bow', summary: 'Synthetic', description: 'Synthetic', automation: 'full',
        declarativeAbility: { schemaVersion: 1, id: 'bow', name: 'Bow', description: 'Synthetic', level: 1,
          trigger: { kind: 'after-attack-hit' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'passive-defense', weaponAttacksMagical: { while: 'always', weaponBaseIds: ['dnd5e-longbow'], attackMode: 'ranged' } } } }) },
    })
    try {
      for (const weapon of [DND5E_LONGBOW, DND5E_SHORTSWORD]) for (const owned of [true, false]) {
        const input = fixture(75)
        input.actor.equipment = { mainWeapon: { ...weapon, id: 'inventory-instance', baseEquipmentId: weapon.id } }
        input.actor.dnd5ePluginFeatureIds = owned ? [featureId] : []
        input.targetToken.poolId = 'srd-5.1:werewolf-hybrid'
        const ready = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
        expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true); if (!ready.ok) continue
        expect(ready.prepared.profile.baseWeaponId).toBe(weapon.id)
        const before = structuredClone(input.actor.equipment)
        const done = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 18, d20Second: 18, damageRolls: [4] })
        expect(done.result.ok, done.result.ok ? '' : done.result.reason).toBe(true)
        const expectedDamage = owned && weapon.id === DND5E_LONGBOW.id ? 4 + ready.prepared.profile.damage.bonus : 0
        expect(done.result.state.combatants[input.targetToken.id].currentHp).toBe(20 - expectedDamage)
        expect(input.actor.equipment).toEqual(before)
      }
    } finally { dispose() }
  })
  it('prepares an attack at zero HP only for an owned active rage death deferral', () => {
    let featureId=''
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.rage-zero',name:'Zero',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      featureId=api.registerFeature({id:'zero',name:'Zero',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'zero',name:'Zero',description:'Synthetic',level:1,trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],mechanic:{kind:'rage-death-deferral'},automation:'full'}})
    }})
    try { for(const scenario of ['active','not-raging','unowned','dead'] as const){
      const input=fixture()
      input.actor.currentHp=0;input.actorToken.hp=0
      input.actor.dnd5ePluginFeatureIds=scenario==='unowned'?[]:[featureId]
      input.actor.dnd5eCombatState={raging:scenario!=='not-raging',rageTurnsRemaining:10}
      if(scenario==='dead')input.actor.deathSaveFailures=3
      const result=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
      expect(result.ok,scenario+':'+JSON.stringify(result.ok?null:result.reason)).toBe(scenario==='active')
    }}finally{dispose()}
  })
  it.each([[2, 2], [3, 3], [4, 3], [5, 4], [6, 4], [7, 5], [9, 5]])('imports a synthetic conjured weapon archive and settles slot %s damage (%s dice) with target lighting', async (slot, count) => {
    const namespace = 'test.archived-weapon'
    const automation = automationCapabilityFromLegacyStatus('full')
    const activity = compileDnd5eActivityPatternV1({ schemaVersion: 1, id: 'forge', name: 'Forge', source: { kind: 'feature', id: 'forge' },
      activation: { kind: 'bonus-action' }, target: { kind: 'self' }, pattern: 'conjured-item', item: { target: 'actor', templateId: 'blade-2',
        templateVariants: [{ minimumCastLevel: 3, templateId: 'blade-3' }, { minimumCastLevel: 5, templateId: 'blade-4' }, { minimumCastLevel: 7, templateId: 'blade-5' }],
        quantity: { kind: 'constant', value: 1 } } })
    const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
      manifest: { id: namespace, name: 'Synthetic weapon', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
      definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'forge', name: 'Forge', automation,
        payload: { id: 'forge', name: 'Forge', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [activity] },
        ...[2, 3, 4, 5].map((dice): Extract<Dnd5eUnifiedContentBundleV1['definitions'][number], { kind: 'item' }> => ({ schemaVersion: 1, namespace, version: '1.0.0', kind: 'item', id: `blade-${dice}`, name: 'Blade', automation,
          payload: { id: `blade-${dice}`, name: 'Blade', description: 'Synthetic', rulesText: 'Synthetic', category: 'equipment', icon: 'sword', weightLb: 0, stackable: false,
            equipment: { slot: 'mainWeapon', allowedSlots: ['mainWeapon', 'offHand'],
              dnd5e: { kind: 'weapon', category: 'simple', mode: 'melee', attackAbility: 'finesse', grantsProficiency: true,
                advantageAgainstUnlitTargets: true, vanishesAfterRelease: true, magical: true,
                damage: { count: dice, sides: 8, type: 'psychic' }, reachFeet: 5, rangeFeet: { normal: 20, long: 60 }, properties: ['灵巧', '轻型', '投掷'] } } } }))] }
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const imported = await readDnd5eStarMod(await exportDnd5eStarMod(decoded.bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(imported.bundle))
    try {
      for (const illumination of ['bright', 'dim', 'darkness'] as const) {
        const input = fixture(45)
        input.actor.charClass = '法师'
        input.actor.abilities = { str: 10, dex: 16, con: 14, int: 18, wis: 10, cha: 10 }
        const actorSnapshot = { id: input.actor.id, controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities: input.actor.abilities, armorClass: 10, conditions: [] }
        const forged = resolveDnd5eActivity({ activity: getRegisteredDnd5eActivity(namespace, 'forge')!, castLevel: slot, rolls: {}, actor: actorSnapshot, targets: [actorSnapshot] })
        expect(forged.ok, JSON.stringify(forged)).toBe(true)
        if (!forged.ok) throw new Error('Forge failed')
        const grants = forged.proposals.filter(proposal => proposal.kind === 'grant-inventory-item')
        expect(grants).toHaveLength(1)
        expect(grants[0]).toMatchObject({ templateId: `${namespace}:blade-${count}` })
        const generated = applyDnd5eInventoryGrantBundle([input.actor], { characterId: input.actor.id, receiptId: `forge-${slot}-${illumination}`, grants })
        expect(generated.ok).toBe(true)
        const item = generated.characters[0].dnd5eInventory!.entries.find(entry => entry.templateId === `${namespace}:blade-${count}`)!
        expect(item.item.equipment?.dnd5e).toMatchObject({ grantsProficiency: true, magical: true, damage: { count, sides: 8, type: 'psychic' }, rangeFeet: { normal: 20, long: 60 } })
        const equipped = applyDnd5eInventoryMutation(generated.characters, { type: 'equip', characterId: input.actor.id, instanceId: item.instanceId })
        expect(equipped.ok).toBe(true)
        input.actor = JSON.parse(JSON.stringify(equipped.characters[0]))
        setMapGeometryRuntime([{ mapId: input.map.id, walls: [], doors: [], obstacles: [], vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: illumination }, updatedAt: 1 }])
        const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
        expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true)
        if (!prepared.ok) throw new Error('Attack preparation failed')
        expect(prepared.prepared.profile.attackModifier).toBe(6)
        expect(prepared.prepared.profile.damage).toMatchObject({ count, sides: 8, type: 'psychic', bonus: 3 })
        expect(prepared.prepared.attackModeResolution?.advantageReasons.includes('武器对暗光目标具有优势')).toBe(illumination !== 'bright')
        const hit = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, d20Second: 15, damageRolls: Array(count).fill(2) })
        expect(hit.result.ok, hit.result.ok ? '' : hit.result.reason).toBe(true)
        expect(hit.result.state.combatants[input.targetToken.id].currentHp).toBe(20 - count * 2 - 3)
        expect(hit.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', damageType: 'psychic' }))
        const ordinary = { ...input.actor, equipment: { mainWeapon: DND5E_SHORTSWORD }, dnd5eInventory: undefined }
        const normalWeapon = prepareDnd5eEquipmentAttack({ ...input, characters: [ordinary], attacksUsed: 0 })
        expect(normalWeapon.ok).toBe(true)
        if (!normalWeapon.ok) throw new Error('Ordinary weapon preparation failed')
        expect(normalWeapon.prepared.profile.damage.type).not.toBe('psychic')
        expect(normalWeapon.prepared.attackModeResolution?.advantageReasons).not.toContain('武器对暗光目标具有优势')
      }
    } finally { setMapGeometryRuntime([]); dispose() }
  })

  it.each([1, 2])('settles bound ammunition inventory independently from enchantment charges (%s remaining)', remainingAttacks => {
    const dispose = registerDnd5eRulesPlugin({manifest:{id:'test.attack-quiver',name:'Quiver',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      api.registerItem({id:'quiver',name:'Quiver',category:'container',icon:'container',description:'Synthetic',rulesText:'Synthetic',stackable:false,containerCapacityWeightLb:10})
    }})
    try {
      const input = fixture(225)
      input.actor.equipment = {mainWeapon:DND5E_LONGBOW}
      const granted = applyDnd5eInventoryMutation([input.actor],{type:'grant',characterId:input.actor.id,templateId:'test.attack-quiver:quiver',quantity:1})
      const quiver = granted.characters[0].dnd5eInventory!.entries.find(entry=>entry.item.category==='container')!
      const arrows = granted.characters[0].dnd5eInventory!.entries.find(entry=>entry.item.ammunitionKind==='arrow')!
      input.actor = applyDnd5eInventoryMutation(granted.characters,{type:'set-container',characterId:input.actor.id,instanceId:arrows.instanceId,containerInstanceId:quiver.instanceId}).characters[0]
      input.actor.dnd5eCombatState = {activeEffects:[createDnd5eMechanicalEffect({id:'bound-flames',definitionId:'synthetic-flames',label:'Flames',targetId:input.actor.id,
        source:{kind:'spell',actorId:input.actor.id},duration:{type:'permanent'},modifiers:{weaponEnchantment:{weaponId:'container:'+quiver.instanceId,inventoryInstanceId:quiver.instanceId,
          ammunitionContainer:true,weaponIds:[DND5E_LONGBOW.id],remainingAttacks,attackAndDamageBonus:0,bonusDamage:{count:1,sides:6,type:'fire'}}}})]}
      const before = structuredClone(input.actor)
      const prepared = prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
      expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true)
      if(!prepared.ok)return
      const riders = dnd5eEquipmentClassDamageDefinitions(prepared.prepared,false)
      expect(riders).toContainEqual(expect.objectContaining({source:'activity-effect-rider',count:1,sides:6,type:'fire'}))
      for(const hit of [true,false]) {
        const resolved = resolvePreparedDnd5eEquipmentAttack({prepared:prepared.prepared,d20:hit?18:1,damageRolls:hit?[3]:[],
          classDamageRolls:hit?riders.map(rider=>({source:rider.source,rollId:rider.rollId,rolls:[4]})):[]})
        expect(resolved.result.ok,resolved.result.ok?'':resolved.result.reason).toBe(true)
        expect(resolved.result.state.combatants[input.targetToken.id].currentHp).toBe(hit?20-3-prepared.prepared.profile.damage.bonus-4:20)
        const actor = resolved.application?.characters.find(character=>character.id===input.actor.id)
        expect(actor?.dnd5eInventory?.entries.find(entry=>entry.instanceId===arrows.instanceId)?.quantity).toBe(19)
        expect(actor?.dnd5eInventory?.entries.some(entry=>entry.instanceId===quiver.instanceId)).toBe(true)
        const effect = actor?.dnd5eCombatState?.activeEffects?.find(effect=>effect.id==='bound-flames')
        if(remainingAttacks===1)expect(effect).toBeUndefined()
        else expect(effect?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(1)
        expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',hit}))
        if(remainingAttacks===1 && actor) {
          const restored:Character=JSON.parse(JSON.stringify(actor))
          const next=prepareDnd5eEquipmentAttack({...input,characters:[restored],attacksUsed:1,action:{...input.action,id:'next-arrow'}})
          expect(next.ok,next.ok?'':next.reason).toBe(true)
          if(next.ok)expect(dnd5eEquipmentClassDamageDefinitions(next.prepared,false).some(rider=>rider.source==='activity-effect-rider')).toBe(false)
        }
      }
      const rejected = resolvePreparedDnd5eEquipmentAttack({prepared:prepared.prepared,d20:18,damageRolls:[99]})
      expect(rejected.result.ok).toBe(false)
      expect(rejected.application).toBeUndefined()
      expect(input.actor).toEqual(before)
    } finally {dispose()}
  })
  it.each(['conjured', 'altered'] as const)('settles transferred source-powered projectiles as spell attacks and consumes only successful submissions (%s)', origin => {
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.projectile', name: 'Projectile', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerItem({ id: 'stone', name: 'Stone', description: 'Synthetic', rulesText: 'Synthetic', icon: 'sword', category: 'equipment', stackable: true,
        equipment: { slot: 'mainWeapon', dnd5e: { kind: 'weapon', category: 'simple', mode: 'ranged', attackAbility: 'dex', grantsProficiency: true,
          usesSourceSpellcastingAbility: true, consumesQuantityOnAttack: true, damage: { count: 1, sides: 6, type: 'bludgeoning' }, rangeFeet: { normal: 60, long: 60 }, slingRangeFeet: { normal: 30, long: 120 } } } })
    } })
    try {
      const input = fixture(225)
      const creator = { ...fighter(), id: 'creator' }
      let granted = applyDnd5eInventoryGrantBundle([creator, input.actor], { characterId: creator.id, receiptId: 'projectile-grant',
        grants: [{ templateId: 'test.projectile:stone', quantity: 3, sourceSpellcastingModifier: 4 }] })
      if (origin === 'altered') {
        const tag = 'item-lease:11111111-1111-1111-1111-111111111111'
        const original = applyDnd5eInventoryMutation([creator], { type: 'grant', characterId: creator.id, templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 3 }).characters[0]
        const entry = original.dnd5eInventory!.entries.find(entry => entry.templateId === 'srd-5.1:item:gold-dust-25gp')!
        const effect = createDnd5eMechanicalEffect({ definitionId: 'synthetic-alteration', label: 'Alteration', targetId: creator.id,
          source: { kind: 'spell', actorId: creator.id }, duration: { type: 'permanent' }, modifiers: {} })
        effect.tags = [tag]
        original.dnd5eCombatState = { activeEffects: [effect] }
        const altered = alterDnd5eInventoryItem(original, { expectedInventoryRevision: original.dnd5eInventory!.revision ?? 0,
          instanceId: entry.instanceId, quantity: 3, replacement: dnd5eInventoryItemTemplate('test.projectile:stone')!,
          sourceEffectTag: tag, sourceEffectOwnerId: creator.id, sourceSpellcastingModifier: 4 })
        if (!altered.ok) throw new Error(altered.reason)
        granted = { ...granted, characters: [altered.character, input.actor] }
      }
      const instance = granted.characters[0].dnd5eInventory!.entries.find(entry => entry.sourceSpellcastingModifier === 4)!
      const transferred = applyDnd5eInventoryMutation(granted.characters, { type: 'transfer', characterId: creator.id, targetCharacterId: input.actor.id, instanceId: instance.instanceId, quantity: 3 })
      const received = transferred.characters[1].dnd5eInventory!.entries.find(entry => entry.sourceSpellcastingModifier === 4)!
      const equipped = applyDnd5eInventoryMutation(transferred.characters, { type: 'equip', characterId: input.actor.id, instanceId: received.instanceId })
      input.actor = equipped.characters[1]
      input.targetToken.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({ definitionId: 'weapon-wind', label: 'Wind', targetId: input.targetToken.id,
        source: { kind: 'spell' }, modifiers: { weaponAttacksAgainstTarget: [{ mode: 'disadvantage', delivery: 'ranged' }] } })] }
      const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: equipped.characters, attacksUsed: 0 })
      expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.classDamageContext.spellAttack).toBe(true)
      expect(prepared.prepared.attackMode).toBe('normal')
      expect(prepared.prepared.profile.attackModifier).toBe(7)
      expect(prepared.prepared.profile.damage.bonus).toBe(4)
      for (const hit of [true, false]) {
        const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: hit ? 18 : 1, damageRolls: hit ? [3] : [] })
        expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
        expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit }))
        expect(resolved.application?.characters.find(character => character.id === input.actor.id)?.dnd5eInventory?.entries.find(entry => entry.sourceSpellcastingModifier === 4)?.quantity).toBe(2)
        expect(resolved.result.state.combatants[input.targetToken.id].currentHp).toBe(hit ? 13 : 20)
        if (origin === 'altered') {
          const inventory = resolved.application!.characters.find(character => character.id === input.actor.id)!.dnd5eInventory!
          expect(inventory.releasedObjects).toHaveLength(1)
          expect(inventory.releasedObjects![0]).toMatchObject({ templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 1 })
          expect(inventory.releasedObjects![0].spellAlteration).toBeUndefined()
          expect(inventory.entries.some(entry => entry.templateId === 'srd-5.1:item:gold-dust-25gp')).toBe(false)
        }
      }
      const rejected = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 18, damageRolls: [9] })
      expect(rejected.result.ok).toBe(false)
      expect(rejected.application).toBeUndefined()
      expect(input.actor.dnd5eInventory?.entries.find(entry => entry.sourceSpellcastingModifier === 4)?.quantity).toBe(3)
      input.action.dnd5eWeaponAttackOptions = { useSling: true }
      expect(prepareDnd5eEquipmentAttack({ ...input, characters: equipped.characters, attacksUsed: 0 }).ok).toBe(false)
      input.actor.equipment = { ...input.actor.equipment, offHand: DND5E_SLING }
      input.targetToken.x = 1025
      input.map.width = 2000
      const sling = prepareDnd5eEquipmentAttack({ ...input, characters: [equipped.characters[0], input.actor], attacksUsed: 0 })
      expect(sling.ok, JSON.stringify(sling)).toBe(true)
      if (!sling.ok) return
      expect(sling.prepared.profile.rangeFeet).toEqual({ normal: 30, long: 120 })
      expect(sling.prepared.classDamageContext).toMatchObject({ spellAttack: true, spellDeliveredByWeapon: true })
      expect(sling.prepared.attackMode).toBe('disadvantage')
      const slingHit = resolvePreparedDnd5eEquipmentAttack({ prepared: sling.prepared, d20: 18, d20Second: 17, damageRolls: [3] })
      expect(slingHit.result.ok, JSON.stringify(slingHit.result)).toBe(true)
      expect(slingHit.result.state.combatants[input.targetToken.id].currentHp).toBe(13)
      expect(slingHit.application?.characters.find(character => character.id === input.actor.id)?.dnd5eInventory?.entries.find(entry => entry.sourceSpellcastingModifier === 4)?.quantity).toBe(2)
      input.targetToken.x = 1275
      expect(prepareDnd5eEquipmentAttack({ ...input, characters: [equipped.characters[0], input.actor], attacksUsed: 0 }).ok).toBe(false)
      input.action.dnd5eWeaponAttackOptions = undefined
      input.targetToken.x = 675
      expect(prepareDnd5eEquipmentAttack({ ...input, characters: [equipped.characters[0], input.actor], attacksUsed: 0 }).ok).toBe(false)
    } finally { dispose() }
  })
  it.each(['melee','ranged'] as const)('shows defender weapon filters before the player rolls a %s attack',delivery=>{
    const input=fixture(delivery==='ranged'?225:75)
    if(delivery==='ranged')input.actor.equipment={mainWeapon:DND5E_LONGBOW}
    input.targetToken.dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({definitionId:'test:wind',label:'Wind',targetId:input.targetToken.id,
      source:{kind:'spell'},modifiers:{weaponAttacksAgainstTarget:[{mode:'disadvantage',delivery:'ranged'}]}})]}
    const prepared=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
    expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true);if(!prepared.ok)return
    expect(prepared.prepared.attackMode).toBe(delivery==='ranged'?'disadvantage':'normal')
    const preview=previewDnd5eEquipmentAttack(prepared.prepared,18,delivery==='ranged'?2:undefined)
    expect(preview.hit).toBe(delivery==='melee')
  })
  it('uses request-bound mandatory attack dice consistently in preview and settlement',()=>{
    const input=fixture()
    input.actor.dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({id:'penalty',definitionId:'penalty',label:'Penalty',source:{kind:'plugin'},targetId:input.actor.id,
      modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['attack']}]}})]}
    const prepared=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
    expect(prepared.ok).toBe(true)
    if(!prepared.ok)return
    const attack=prepared.prepared
    const effectRollDice=Object.fromEntries(dnd5eRollDiceRecipes(preparedDnd5eEquipmentAttackEffectContext(attack)).map(recipe=>[recipe.id,[6]]))
    const d20=attack.targetArmorClass-previewDnd5eEquipmentAttack(attack,10).roll.modifier+1
    expect(d20).toBeGreaterThan(1)
    expect(previewDnd5eEquipmentAttack(attack,d20).hit).toBe(true)
    const preview=previewDnd5eEquipmentAttack(attack,d20,undefined,false,undefined,undefined,0,undefined,effectRollDice)
    expect(preview.hit).toBe(false)
    expect(previewDnd5eEquipmentAttack(attack,20,undefined,false,undefined,undefined,0,undefined,effectRollDice).critical).toBe(true)
    expect(resolvePreparedDnd5eEquipmentAttack({prepared:attack,d20,damageRolls:[]}).result.ok).toBe(false)
    const resolved=resolvePreparedDnd5eEquipmentAttack({prepared:attack,d20,damageRolls:[],effectRollDice})
    expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',hit:false,total:preview.roll.total}))
    expect(resolved.result.transaction?.id).toBe(input.action.id)
    expect(resolved.result.state.combatants[attack.targetToken.id].currentHp).toBe(attack.state.combatants[attack.targetToken.id].currentHp)
    expect(resolvePreparedDnd5eEquipmentAttack({prepared:{...attack,action:{...attack.action,id:'next'}},d20,damageRolls:[],effectRollDice}).result.ok).toBe(false)
  })
  it('shows weapon-only disadvantage in player dice preparation and consumes it on a miss', () => {
    const input = fixture()
    input.actor.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({ definitionId: 'test:frostbite', label: '霜噬', targetId: input.actor.id, source: { kind: 'spell', magical: true }, duration: { type: 'permanent' }, modifiers: { weaponAttackRollDisadvantage: true }, breakOn: ['makes-weapon-attack'] })] }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.reason)
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(prepared.prepared.attackModeResolution?.disadvantageReasons).toContain('霜噬令攻击具有劣势')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 1, 19)).toMatchObject({ roll: { d20: 1 }, hit: false })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 1, d20Second: 19, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: 'makes-weapon-attack' }))
  })
  it('prepares thrown melee weapons at range and rejects a forged throw for a non-thrown weapon', () => {
    const input=fixture(225)
    input.actor.equipment={mainWeapon:{...DND5E_SHORTSWORD,dnd5e:{kind:'weapon',category:'simple',mode:'melee',attackAbility:'finesse',grantsProficiency:true,damage:{count:2,sides:8,type:'psychic'},reachFeet:5,rangeFeet:{normal:20,long:60},properties:['灵巧','轻型','投掷']}}}
    const prepared=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
    if(!prepared.ok)return
    expect(prepared.prepared.profile.mode).toBe('ranged')
    expect(prepared.prepared.distanceFeet).toBe(20)
    const result=resolvePreparedDnd5eEquipmentAttack({prepared:prepared.prepared,d20:15,damageRolls:[3,4]})
    expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
    input.actor.equipment={mainWeapon:DND5E_SHORTSWORD}
    input.action.dnd5eWeaponAttackOptions={thrownAttack:true}
    expect(prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0}).ok).toBe(false)
  })
  it.each(['minotaur', 'berserker'])('rolls both player attack dice against an opted-in %s until its next turn', (slug) => {
    const input = fixture()
    input.targetToken.poolId = `srd-5.1:${slug}`
    input.targetToken.hp = 76
    input.targetToken.maxHp = 76
    input.targetToken.dnd5eCombatState = { recklessAttackTurnKey: 'combat:1:enemy-token' }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
    expect(prepared.prepared.attackModeResolution?.advantageReasons).toContain('目标的鲁莽攻击仍在持续')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 1, 19)).toMatchObject({ roll: { d20: 19 }, hit: true })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 1, d20Second: 19, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, d20: 19 }))
    input.targetToken.dnd5eCombatState.recklessAttackTurnKey = undefined
    const expired = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(expired.ok && expired.prepared.attackMode).toBe('normal')
  })

  it('validates range and resolves equipment damage through the 5e headless engine', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, attackNumber: 1, attacksAllowed: 2, targetArmorClass: 10, spendsAction: true })
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 15)).toMatchObject({ hit: true, critical: false })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((item) => item.id === input.targetToken.id)?.hp).toBe(12)
  })

  it('lets an environmental capability suppress the player equipment underwater attack penalty', () => {
    const input = fixture()
    setMapGeometryRuntime([{
      mapId: input.map.id,
      walls: [],
      doors: [],
      obstacles: [],
      vision: {
        enabled: true,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      environment: 'underwater',
      updatedAt: 1,
    }])
    try {
      const penalized = prepareDnd5eEquipmentAttack({
        ...input,
        characters: [input.actor],
        attacksUsed: 0,
      })
      expect(penalized.ok).toBe(true)
      if (!penalized.ok) return
      expect(penalized.prepared.attackModeResolution?.disadvantageReasons)
        .toContain('水下武器攻击限制')

      input.actor.dnd5eCombatState = {
        schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'freedom-of-movement',
          definitionId: 'srd-5.1:spell:freedom-of-movement',
          label: '行动自如',
          targetId: input.actor.id,
          source: { kind: 'spell', actorId: input.actor.id, rulesId: 'freedom-of-movement' },
          modifiers: {
            environmentalCapabilities: { ignoreUnderwaterAttackPenalty: true },
          },
        })],
      }
      const protectedAttack = prepareDnd5eEquipmentAttack({
        ...input,
        characters: [input.actor],
        attacksUsed: 0,
      })
      expect(protectedAttack.ok).toBe(true)
      if (!protectedAttack.ok) return
      expect(protectedAttack.prepared.attackModeResolution?.disadvantageReasons)
        .not.toContain('水下武器攻击限制')
    } finally {
      setMapGeometryRuntime([])
    }
  })

  it('applies local submersion without changing the map environment', () => {
    const input=fixture()
    setMapGeometryRuntime([])
    input.actor.dnd5eCombatState={schemaVersion:DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects:[createDnd5eMechanicalEffect({definitionId:'local-water',label:'Submerged',targetId:input.actor.id,
        source:{kind:'spell',actorId:'caster'},modifiers:{submerged:true}})]}
    const prepared=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
    expect(prepared.ok).toBe(true)
    if(prepared.ok)expect(prepared.prepared.attackModeResolution?.disadvantageReasons).toContain('水下武器攻击限制')
  })

  it('accepts one Haste weapon attack after the ordinary action is spent', () => {
    const input = fixture()
    input.actor.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: [createDnd5eMechanicalEffect({
        id: 'haste-effect',
        definitionId: 'srd-5.1:spell:haste',
        label: '加速术',
        targetId: input.actor.id,
        source: { kind: 'spell', actorId: input.actor.id, rulesId: 'haste' },
        modifiers: {
          restrictedExtraAction: {
            allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
            maximumWeaponAttacks: 1,
          },
        },
      })],
    }
    const economy = createDnd5eTurnEconomyCounts('combat:1:fighter-token', 30)
    economy.action.current = 0
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
      turnEconomy: economy,
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['fighter-token'].classState.restrictedExtraActionUsesByEffect)
      .toEqual({ 'haste-effect': 'combat:1:fighter-token' })
  })

  it('cancels mutual heavy-obscuration advantage and disadvantage with explicit reasons', () => {
    const input = fixture()
    input.map.dnd5ePluginAreas = [{
      id: 'fog-cloud',
      pluginId: 'srd-5.1',
      featureId: 'spell:fog-cloud',
      sourceKind: 'core-spell',
      coreSpellId: 'fog-cloud',
      label: '云雾术',
      color: '#94a3b8',
      sourceCharacterId: input.actor.id,
      sourceTokenId: input.actorToken.id,
      cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      anchorCell: { col: 0, row: 0 },
      createdRound: 1,
      expiresAfterRound: 600,
      obscuration: { kind: 'heavy' },
    }]
    setMapGeometryRuntime([{
      mapId: input.map.id,
      walls: [],
      doors: [],
      obstacles: [],
      vision: {
        enabled: true,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }])
    try {
      const prepared = prepareDnd5eEquipmentAttack({
        ...input,
        characters: [input.actor],
        attacksUsed: 0,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.attackMode).toBe('normal')
      expect(prepared.prepared.attackModeResolution).toMatchObject({
        advantageReasons: expect.arrayContaining(['目标看不见攻击者']),
        disadvantageReasons: expect.arrayContaining(['攻击者看不见目标']),
      })
    } finally {
      setMapGeometryRuntime([])
    }
  })

  it.each([
    ['actor', 'ordinary', 'advantage'],
    ['target', 'ordinary', 'disadvantage'],
    ['actor', 'truesight', 'advantage'],
    ['target', 'truesight', 'disadvantage'],
    ['actor', 'blindsight', 'normal'],
    ['target', 'blindsight', 'normal'],
  ] as const)('resolves source-only heavy obscuration: %s source, %s observer', (source, sense, mode) => {
    const input = fixture()
    const caster = source === 'actor' ? input.actorToken : input.targetToken
    const observer = source === 'actor' ? input.targetToken : input.actorToken
    if (sense === 'blindsight') observer.blindsightRangeFeet = 10
    if (sense === 'truesight') observer.truesightRangeFeet = 10
    input.map.dnd5ePluginAreas = [{
      id: 'source-shadow', pluginId: 'test', featureId: 'source-shadow',
      label: 'Source shadow', color: '#111111', sourceCharacterId: caster.characterId ?? caster.id,
      sourceTokenId: caster.id, anchorMode: 'source-token',
      cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      createdRound: 1, expiresAfterRound: 11,
      obscuration: { kind: 'heavy', scope: 'source-token' },
    }]
    setMapGeometryRuntime([{
      mapId: input.map.id, walls: [], doors: [], obstacles: [],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: false, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    try {
      const prepare = () => prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
      const prepared = prepare()
      expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.attackMode).toBe(mode)
      input.map.dnd5ePluginAreas = []
      const ended = prepare()
      expect(ended.ok).toBe(true)
      if (ended.ok) expect(ended.prepared.attackMode).toBe('normal')
    } finally {
      setMapGeometryRuntime([])
    }
  })

  it('reports restrained as the attack disadvantage source instead of unseen target', () => {
    const input = fixture()
    const restrained = createDnd5eConditionEffect({
      condition: 'restrained',
      targetId: input.actorToken.id,
      source: { kind: 'dm' },
    })
    input.actor.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: [restrained],
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(prepared.prepared.attackModeResolution?.disadvantageReasons).toContain(
      '攻击者处于束缚状态',
    )
    expect(prepared.prepared.attackModeResolution?.disadvantageReasons).not.toContain(
      '攻击者看不见目标',
    )
  })

  it('grants advantage and doubles the damage pool against an unconscious target within 5 feet', () => {
    const input = fixture()
    const unconscious = createDnd5eConditionEffect({
      condition: 'unconscious',
      targetId: input.targetToken.id,
      source: { kind: 'dm' },
    })
    input.targetToken.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      conditions: ['unconscious'],
      activeEffects: [unconscious],
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(prepared.prepared.attackMode).toBe('advantage')
    expect(dnd5ePreparedEquipmentAttackIsAutomaticCritical(prepared.prepared)).toBe(true)
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 12, 4)).toMatchObject({
      hit: true,
      critical: true,
      roll: { d20: 12, mode: 'advantage' },
    })
    // A provisional condition critical can still miss after an attack penalty.
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 12, 4, false, undefined, undefined, -20))
      .toMatchObject({ hit: false, critical: false })
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 20, 4, false, undefined, undefined, -20))
      .toMatchObject({ hit: true, critical: true })

    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 12,
      d20Second: 4,
      damageRolls: [3, 5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      critical: true,
    }))
    expect(resolved.application?.map.tokens.find((item) =>
      item.id === input.targetToken.id)?.hp).toBe(9)
  })

  it('does not treat a failed roll against an unconscious target as an automatic hit', () => {
    const input = fixture()
    const unconscious = createDnd5eConditionEffect({
      condition: 'unconscious',
      targetId: input.targetToken.id,
      source: { kind: 'dm' },
    })
    input.targetToken.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      conditions: ['unconscious'],
      activeEffects: [unconscious],
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(previewDnd5eEquipmentAttack(prepared.prepared, 2, 3)).toMatchObject({
      hit: false,
      critical: false,
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 2,
      d20Second: 3,
      damageRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      hit: false,
      critical: false,
    }))
  })

  it('resolves an owned natural weapon independently of equipment and rejects lost or forged ownership', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.natural-weapon', name: 'Natural weapon', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      featureId = api.registerFeature({ id: 'claws', name: 'Claws', summary: 'Synthetic.', description: 'Synthetic.', automation: 'full', staticModifiers: {
        naturalWeapons: [{ id: 'claws', name: 'Claws', damageDieSides: 4, damageType: 'slashing' }],
      } })
    } })
    try {
      const input = fixture()
      input.actor.dnd5ePluginFeatureIds = [featureId]
      input.actor.equipment = { mainWeapon: { id: 'focus', name: 'Focus', slot: 'mainWeapon' } }
      input.action.dnd5eWeaponAttackOptions = { naturalWeaponId: `${featureId}:natural:claws` }
      const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
      expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.profile).toMatchObject({ weaponName: 'Claws', attackModifier: 6, damage: { count: 1, sides: 4, bonus: 3, type: 'slashing' } })
      expect(prepared.prepared.damageSource.magical).toBe(false)
      const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 20, damageRolls: [4, 3] })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.application?.map.tokens.find(token => token.id === input.targetToken.id)?.hp).toBe(10)
      input.actor.dnd5ePluginFeatureIds = []
      expect(prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })).toMatchObject({ ok: false, reason: 'no-weapon' })
      input.actor.dnd5ePluginFeatureIds = [featureId]
      input.action.dnd5eWeaponAttackOptions.naturalWeaponId = `${featureId}:natural:invented`
      expect(prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })).toMatchObject({ ok: false, reason: 'no-weapon' })
    } finally { dispose() }
  })

  it('resolves an Alter Self natural-weapon attack while the caster is holding an arcane focus', () => {
    const input = fixture()
    const naturalWeapon = createDnd5eMechanicalEffect({
      definitionId: 'adjudicated:alter-self:natural-weapon',
      label: '变身术·天生武器（魔法爪；1d6挥砍；熟练；攻击与伤害+1）',
      targetId: input.actor.id,
      source: { kind: 'spell', actorId: input.actor.id, rulesId: 'alter-self', magical: true },
      duration: {
        type: 'concentration', sourceActorId: input.actor.id, concentrationId: 'alter-self', remainingRounds: 600,
      },
      tags: ['alter-self', 'alter-self-natural-weapon', 'alter-self-natural-weapon:slashing'],
    })
    input.actor.equipment = {
      mainWeapon: { id: 'dnd5e-arcane-focus', name: '奥术法器', slot: 'mainWeapon' },
    }
    input.actor.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: [naturalWeapon],
    }

    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      profile: {
        weaponName: '变身术·天生武器',
        attackModifier: 7,
        damage: { count: 1, sides: 6, bonus: 4, type: 'slashing' },
      },
      damageSource: {
        weaponId: 'srd-5.1:spell:alter-self:natural-weapon',
        magical: true,
      },
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 20,
      damageRolls: [4, 3],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((item) => item.id === input.targetToken.id)?.hp).toBe(9)
  })

  it('rejects an ordinary ranged projectile that crosses Wind Wall', () => {
    const input = fixture(225)
    input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    input.map = {
      ...input.map,
      dnd5ePluginAreas: [{
        id: 'wind-wall', sourceKind: 'core-spell', coreSpellId: 'wind-wall',
        pluginId: 'srd-5.1', featureId: 'spell:wind-wall', color: '#ffffff',
        label: '风墙术', sourceCharacterId: 'druid', sourceTokenId: 'druid-token',
        slotLevel: 3, sourceSpellSaveDc: 15, createdRound: 1, expiresAfterRound: 11,
        anchorMode: 'fixed', cells: [{ col: 2, row: 0 }],
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 15 },
        blocking: { movement: true, movementMode: 'boundary' },
      }],
    }
    expect(prepareDnd5eEquipmentAttack({
      ...input, characters: [input.actor], attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'projectile-blocked-by-wind-wall' })
  })

  it.each(['active', 'removed', 'advantage', 'melee'])('applies imported area disadvantage to weapon attack preparation (%s)', scenario => {
    const removed = scenario === 'removed'
    const input = fixture(scenario === 'melee' ? 45 : 225)
    input.actor.equipment = { mainWeapon: scenario === 'melee' ? DND5E_SHORTSWORD : DND5E_LONGBOW }
    if (scenario === 'advantage') input.targetToken.dnd5eCombatState = { recklessAttackTurnKey: 'combat:1:enemy-token' }
    input.map.dnd5ePluginAreas = removed ? [] : [{ id: 'imported-wind', pluginId: 'test.wind', featureId: 'wind', label: 'Wind', color: '#ffffff',
      sourceCharacterId: 'caster', sourceTokenId: 'caster-token', slotLevel: 1, sourceSpellSaveDc: 12, createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'fixed', cells: [{ col: 2, row: 0 }], vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
      blocking: { rangedWeaponAttackDisadvantage: 'occupancy' } }]
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe(scenario === 'active' ? 'disadvantage' : 'normal')
    if (!removed && scenario !== 'melee') expect(prepared.prepared.attackModeResolution?.disadvantageReasons).toContain('远程武器攻击轨迹受到区域干扰')
    if (scenario === 'active') {
      const result = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 19, d20Second: 1, damageRolls: [2] })
      expect(result.result.ok).toBe(true)
      expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 1, hit: false }))
    }
  })

  it('uses a versatile weapon one-handed and rejects a true two-handed weapon while maintaining a grapple', () => {
    const input = fixture()
    const grapple = createDnd5eConditionEffect({
      id: 'maintained-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: input.actorToken.id, rulesId: 'basic-action:grapple' },
      targetId: input.targetToken.id,
      duration: { type: 'permanent' },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: input.actorToken.id,
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    input.actor.equipment = { mainWeapon: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon }
    input.map = {
      ...input.map,
      tokens: input.map.tokens.map((entry) => entry.id === input.targetToken.id
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
              conditions: ['grappled'],
              activeEffects: [grapple],
            },
          }
        : entry),
    }
    const versatile = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(versatile.ok).toBe(true)
    if (!versatile.ok) return
    expect(versatile.prepared.profile).toMatchObject({
      weaponId: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon!.id,
      damage: { sides: 8 },
      greatWeaponFighting: false,
    })

    input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'no-weapon' })
  })

  it('authorizes the selected Shillelagh ability and rejects it after the enchanted weapon is changed', () => {
    const input = fixture()
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:shillelagh',
      label: '橡棍术',
      targetId: input.actor.id,
      source: { kind: 'spell', actorId: input.actor.id, rulesId: 'shillelagh' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        shillelagh: {
          weaponId: DND5E_CLUB.id,
          spellcastingAbility: 'wis',
          spellcastingModifier: 4,
        },
      },
    })
    input.actor.equipment = { mainWeapon: DND5E_CLUB }
    input.actor.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: [effect],
    }
    input.action.dnd5eWeaponAttackOptions = { shillelaghAbility: 'spellcasting' }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.profile).toMatchObject({
      attackAbility: 'wis',
      attackModifier: 7,
      damage: { sides: 8, bonus: 4 },
    })
    expect(prepared.prepared.damageSource).toEqual({
      weaponId: DND5E_CLUB.id,
      magical: true,
    })

    input.actor.equipment = DND5E_FIGHTER_STARTING_EQUIPMENT
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('derives damage provenance from equipped weapon data and ignores a forged request payload', () => {
    const input = fixture()
    const weapon = structuredClone(DND5E_SHORTSWORD)
    weapon.id = 'plugin:silvered-magic-shortsword'
    weapon.baseEquipmentId = DND5E_SHORTSWORD.id
    if (weapon.dnd5e?.kind !== 'weapon') throw new Error('test weapon missing rules')
    weapon.dnd5e.magical = true
    weapon.dnd5e.specialMaterial = 'silvered'
    input.actor.equipment = { mainWeapon: weapon }
    const forgedAction = {
      ...input.action,
      damageSource: {
        weaponId: 'forged-ui-id',
        magical: false,
        specialMaterial: 'adamantine',
      },
    } as SharedPlayerActionState

    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      action: forgedAction,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.damageSource).toEqual({
      weaponId: weapon.id,
      magical: true,
      specialMaterial: 'silvered',
    })
  })

  it.each([1, 2, 3] as const)('preserves authoritative Magic Weapon +%s in replacement damage', bonus => {
    const input = fixture()
    input.actor.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:magic-weapon',
        label: '魔化武器',
        targetId: input.actor.id,
        source: { kind: 'spell', actorId: input.actor.id, rulesId: 'magic-weapon', spellLevel: 2 },
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        modifiers: { magicWeapon: { weaponId: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon!.id, bonus } },
      })],
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.damageSource).toEqual({
      weaponId: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon!.id,
      magical: true,
    })
    expect(dnd5ePreparedEquipmentAttackMagicWeaponBonus(prepared.prepared)).toBe(bonus)
    const snapshot = dnd5ePreparedEquipmentActivityWeaponDamage(prepared.prepared)
    expect(snapshot.profile.damage.bonus).toBe(prepared.prepared.profile.damage.bonus + bonus)
    expect(snapshot.source).toEqual(prepared.prepared.damageSource)
    expect(snapshot.source).not.toBe(prepared.prepared.damageSource)
    expect(snapshot.profile.damage).not.toBe(prepared.prepared.profile.damage)
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 10).roll.modifier).toBe(
      prepared.prepared.profile.attackModifier + bonus,
    )
  })

  it('separates weapon proficiency from armor proficiency for a wizard attack', () => {
    const input = fixture()
    input.actor.charClass = '法师'
    input.actor.dnd5eClassLevels = { wizard: 5 }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.profile).toMatchObject({ proficient: false, attackModifier: 3 })
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 18, 2)).toMatchObject({
      roll: { d20: 2 },
      hit: false,
    })
  })

  it('limits a Loading weapon to one shot per action while allowing a second action', () => {
    const input = fixture(125)
    input.actor.equipment = { mainWeapon: DND5E_LIGHT_CROSSBOW }
    input.actor = applyDnd5eInventoryMutation([input.actor], {
      type: 'grant',
      characterId: input.actor.id,
      templateId: 'srd-5.1:item:crossbow-bolts',
      quantity: 20,
    }).characters[0]
    const first = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
      attackActionsAvailable: 1,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.prepared).toMatchObject({ attacksAllowed: 1, spendsAction: true })

    expect(prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 1,
      attackActionsAvailable: 1,
    })).toEqual({ ok: false, reason: 'attack-action-spent' })

    const actionSurgeShot = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 1,
      attackActionsAvailable: 2,
    })
    expect(actionSurgeShot.ok).toBe(true)
    if (!actionSurgeShot.ok) return
    expect(actionSurgeShot.prepared).toMatchObject({ attacksAllowed: 2, spendsAction: true })
  })

  it('derives Loading-property bypass from an equipped character feat snapshot', () => {
    const pluginId = 'local.test.crossbow-expert-loading'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Crossbow Expert loading test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'crossbow-expert',
          name: 'Crossbow Expert',
          summary: 'Synthetic loading-property test feat.',
          description: 'Synthetic loading-property test feat.',
          automation: 'full',
          staticModifiers: { ignoreLoadingWeaponProperty: true },
        })
      },
    })
    try {
      const input = fixture(125)
      input.actor.equipment = { mainWeapon: DND5E_LIGHT_CROSSBOW }
      input.actor.dnd5eFeatIds = [`${pluginId}:crossbow-expert`]
      input.actor = applyDnd5eInventoryMutation([input.actor], {
        type: 'grant',
        characterId: input.actor.id,
        templateId: 'srd-5.1:item:crossbow-bolts',
        quantity: 20,
      }).characters[0]

      const secondShot = prepareDnd5eEquipmentAttack({
        ...input,
        characters: [input.actor],
        attacksUsed: 1,
        attackActionsAvailable: 1,
      })
      expect(secondShot.ok).toBe(true)
      if (!secondShot.ok) return
      expect(secondShot.prepared).toMatchObject({
        attacksAllowed: 2,
        attackNumber: 2,
        spendsAction: false,
      })
    } finally {
      dispose()
    }
  })

  it.each([0, 20])('reuses one authorized missed arrow without a second ammunition cost (%s remaining)', quantity => {
    const input=fixture(125)
    input.actor.equipment={mainWeapon:DND5E_LONGBOW}
    if(quantity) input.actor=applyDnd5eInventoryMutation([input.actor],{type:'grant',characterId:input.actor.id,templateId:'srd-5.1:item:arrows',quantity}).characters[0]
    input.map.tokens.push(token({id:'original',x:175,y:125}))
    input.actor.dnd5eCombatState={schemaVersion:DND5E_COMBAT_STATE_SCHEMA_VERSION,activityWeaponAttackGrants:{redirect:{
      schemaVersion:1,grantId:'redirect',label:'Redirect',sourceActivityId:'redirect',appliedTurnKey:'combat:1:fighter-token',
      economy:'bonus-action',projectileAttackSnapshot:{attackModifier:7,damage:{count:1,sides:8,bonus:2,type:'piercing'}},reusedProjectileWeaponId:DND5E_LONGBOW.id,targetRestriction:{originTargetId:'original',maximumFeet:60},
    }}}
    input.action.dnd5eWeaponAttackOptions={activityWeaponAttackGrantId:'redirect'}
    const prepared=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:1})
    expect(prepared.ok,prepared.ok?undefined:prepared.reason).toBe(true)
    if(!prepared.ok)return
    expect(prepared.prepared.profile).toMatchObject({attackModifier:7,damage:{count:1,sides:8,bonus:2,type:'piercing'}})
    const original=JSON.stringify(input.actor.dnd5eInventory)
    const resolved=resolvePreparedDnd5eEquipmentAttack({prepared:prepared.prepared,d20:15,damageRolls:[4]})
    expect(resolved.result.ok,resolved.result.ok?undefined:resolved.result.reason).toBe(true)
    expect(JSON.stringify(resolved.application?.characters[0].dnd5eInventory)).toBe(original)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',total:22}))
    expect(resolved.result.state.combatants['fighter-token'].classState.activityWeaponAttackGrants).toBeUndefined()
    const restriction=input.actor.dnd5eCombatState!.activityWeaponAttackGrants!.redirect.targetRestriction!
    restriction.maximumFeet=1
    expect(prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:1}).ok).toBe(false)
    restriction.maximumFeet=60
    expect(prepareDnd5eEquipmentAttack({...input,action:{...input.action,targetTokenId:'original'},characters:[input.actor],attacksUsed:1})).toMatchObject({ok:false,reason:'invalid-target'})
    const origin=input.map.tokens.find(token=>token.id==='original')!
    origin.x=5975;origin.y=25;input.targetToken.x=6475
    const farRedirect=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:1})
    expect(farRedirect.ok,farRedirect.ok?undefined:farRedirect.reason).toBe(true)
    if(farRedirect.ok) {
      expect(farRedirect.prepared.distanceFeet).toBe(50)
      const farResult=resolvePreparedDnd5eEquipmentAttack({prepared:farRedirect.prepared,d20:15,damageRolls:[4]})
      expect(farResult.result.ok,farResult.result.ok?undefined:farResult.result.reason).toBe(true)
    }
    input.actor.equipment={mainWeapon:DND5E_HAND_CROSSBOW}
    expect(prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:1}).ok).toBe(false)
  })

  it.each([0,1,2,3])('recomputes redirected bow magic +%s and new target cover without changing the saved base', bonus => {
    for(const cover of ['none','half','three-quarters'] as const) {
      const input=fixture(225)
      input.actor.equipment={mainWeapon:DND5E_LONGBOW}
      input.map.tokens.push(token({id:'original',x:175,y:125}))
      input.actor.dnd5eCombatState={schemaVersion:DND5E_COMBAT_STATE_SCHEMA_VERSION,
        activeEffects:bonus?[createDnd5eMechanicalEffect({definitionId:'test:redirect-magic',label:'Temporary weapon bonus',targetId:input.actor.id,source:{kind:'spell'},modifiers:{magicWeapon:{weaponId:DND5E_LONGBOW.id,bonus:bonus as 1|2|3}}})]:[],
        activityWeaponAttackGrants:{redirect:{schemaVersion:1,grantId:'redirect',label:'Redirect',sourceActivityId:'redirect',appliedTurnKey:'combat:1:fighter-token',economy:'bonus-action',projectileAttackSnapshot:{attackModifier:7,damage:{count:1,sides:8,bonus:2,type:'piercing'}},reusedProjectileWeaponId:DND5E_LONGBOW.id,targetRestriction:{originTargetId:'original',maximumFeet:60}}}}
      input.action.dnd5eWeaponAttackOptions={activityWeaponAttackGrantId:'redirect'}
      const before=JSON.stringify(input)
      const ready=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:1,dmCoverOverride:cover})
      expect(ready.ok,ready.ok?undefined:ready.reason).toBe(true)
      if(!ready.ok)continue
      const prepared=ready.prepared,ac=10+(cover==='half'?2:cover==='three-quarters'?5:0)
      expect(prepared.profile.attackModifier).toBe(7)
      expect(prepared.profile.damage.bonus).toBe(2)
      expect(prepared.targetArmorClass).toBe(ac)
      const preview=previewDnd5eEquipmentAttack(prepared,5)
      expect(preview.roll.total).toBe(12+bonus)
      expect(preview.hit).toBe(12+bonus>=ac)
      const resolved=resolvePreparedDnd5eEquipmentAttack({prepared,d20:5,damageRolls:[4]})
      expect(resolved.result.ok,resolved.result.ok?undefined:resolved.result.reason).toBe(true)
      expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',total:12+bonus,armorClass:ac,hit:12+bonus>=ac,projectileAttackSnapshot:{attackModifier:7,damage:{count:1,sides:8,bonus:2,type:'piercing'}}}))
      const damage=resolved.result.events.filter(e=>e.type==='damage-applied')
      expect(damage).toHaveLength(preview.hit?1:0)
      if(preview.hit)expect(damage[0]).toMatchObject({amount:6+bonus})
      expect(resolved.result.state.combatants['fighter-token'].turn.bonusActionAvailable).toBe(false)
      expect(resolved.result.state.combatants['fighter-token'].classState.activityWeaponAttackGrants).toBeUndefined()
      expect(JSON.stringify(input)).toBe(before)
    }
  })

  it('rebuilds and consumes an Activity-granted off-hand hand-crossbow attack without two-weapon penalties', () => {
    const input = fixture(125)
    const offHandCrossbow = {
      ...structuredClone(DND5E_HAND_CROSSBOW),
      slot: 'offHand' as const,
      allowedSlots: ['mainWeapon', 'offHand'] as const,
    }
    input.actor.equipment = { mainWeapon: DND5E_SHORTSWORD, offHand: offHandCrossbow }
    input.actor.dnd5eCombatState = {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activityWeaponAttackGrants: {
        'crossbow-expert-follow-up': {
          schemaVersion: 1,
          grantId: 'crossbow-expert-follow-up',
          label: '弩术专家 · 手弩攻击',
          sourceActivityId: 'crossbow-expert-follow-up-activity',
          appliedTurnKey: 'combat:1:fighter-token',
          economy: 'bonus-action',
          weaponModes: ['ranged'],
          weaponIds: ['dnd5e-hand-crossbow'],
          weaponSlots: ['off-hand'],
        },
      },
    }
    input.actor = applyDnd5eInventoryMutation([input.actor], {
      type: 'grant', characterId: input.actor.id,
      templateId: 'srd-5.1:item:crossbow-bolts', quantity: 20,
    }).characters[0]
    input.action.dnd5eWeaponAttackOptions = {
      activityWeaponAttackGrantId: 'crossbow-expert-follow-up',
      activityWeaponAttackWeaponSlot: 'off-hand',
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 1,
      turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      spendsAction: false,
      spendsBonusAction: true,
      countsTowardAttackAction: false,
      profile: {
        weaponId: 'dnd5e-hand-crossbow',
        baseWeaponId: 'dnd5e-hand-crossbow',
        handsUsed: 1,
        damage: { sides: 6, bonus: 1 },
      },
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [4],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants['fighter-token'].turn.bonusActionAvailable).toBe(false)
    expect(resolved.result.state.combatants['fighter-token'].classState.activityWeaponAttackGrants).toBeUndefined()
  })

  it('grants half cover from an intervening creature and accepts a DM-only one-attack override', () => {
    const input = fixture(225)
    input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    input.map.tokens.push(token({ id: 'intervening-creature', type: 'player', x: 125, y: 25 }))
    const automatic = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(automatic.ok).toBe(true)
    if (!automatic.ok) return
    expect(automatic.prepared).toMatchObject({
      targetArmorClass: 12,
      cover: { cover: 'half', armorClassBonus: 2, overriddenByDm: false },
    })

    const dmOverride = prepareDnd5eEquipmentAttack({
      ...input,
      action: {
        ...input.action,
        sourceMode: 'dm',
        dnd5eWeaponAttackOptions: { coverOverride: 'none' },
      },
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(dmOverride.ok).toBe(true)
    if (!dmOverride.ok) return
    expect(dmOverride.prepared).toMatchObject({
      targetArmorClass: 10,
      cover: { cover: 'none', armorClassBonus: 0, overriddenByDm: true },
    })
  })

  it('rejects a player request that forges a DM cover override', () => {
    const input = fixture()
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...input.action, dnd5eWeaponAttackOptions: { coverOverride: 'total' } },
      characters: [input.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('accepts a trusted DM-host override while settling a player request', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      dmCoverOverride: 'three-quarters',
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      targetArmorClass: 15,
      cover: { cover: 'three-quarters', armorClassBonus: 5, overriddenByDm: true },
    })
  })

  it('rejects out-of-range melee targets and a spent Attack action', () => {
    const distant = fixture(175)
    expect(prepareDnd5eEquipmentAttack({ ...distant, characters: [distant.actor], attacksUsed: 0 })).toEqual({ ok: false, reason: 'target-out-of-range' })
    const adjacent = fixture()
    expect(prepareDnd5eEquipmentAttack({ ...adjacent, characters: [adjacent.actor], attacksUsed: 2 })).toEqual({ ok: false, reason: 'attack-action-spent' })
  })

  it('uses occupied vertical space when validating melee reach against flying targets', () => {
    const outOfReach = fixture()
    outOfReach.targetToken.elevationFeet = 15
    expect(prepareDnd5eEquipmentAttack({
      ...outOfReach,
      characters: [outOfReach.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'target-out-of-range' })

    const withinReach = fixture()
    withinReach.targetToken.elevationFeet = 10
    const prepared = prepareDnd5eEquipmentAttack({
      ...withinReach,
      characters: [withinReach.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.distanceFeet).toBe(5)
  })

  it('allows long-range weapon attacks with disadvantage and rejects targets beyond long range', () => {
    const longRange = fixture(2025)
    longRange.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    const prepared = prepareDnd5eEquipmentAttack({ ...longRange, characters: [longRange.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 200, attackMode: 'disadvantage' })

    const beyondLongRange = fixture(6075)
    beyondLongRange.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    expect(prepareDnd5eEquipmentAttack({
      ...beyondLongRange,
      characters: [beyondLongRange.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('applies disadvantage to a ranged weapon attack while a hostile creature is within 5 feet', () => {
    const input = fixture(775)
    input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    input.map.tokens.push(token({ id: 'adjacent-enemy', type: 'enemy', x: 75, y: 25 }))
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(prepared.prepared.attackModeResolution?.disadvantageReasons).toContain('远程攻击者 5 尺内有敌人')
  })

  it('prepares the second d20 required when Blur imposes attack disadvantage', () => {
    const input = fixture()
    input.targetToken.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:blur',
        label: '朦胧术：依赖视觉的攻击具有劣势',
        kind: 'buff',
        source: { kind: 'spell', actorId: input.targetToken.id, rulesId: 'blur' },
        targetId: input.targetToken.id,
        duration: { type: 'concentration', sourceActorId: input.targetToken.id, concentrationId: 'blur' },
      })],
      conditions: [],
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
  })

  it('prepares two d20s when an allied Help marker grants attack advantage', () => {
    const input = fixture()
    const helper = token({ id: 'helper-token', type: 'player', x: 75, y: 75 })
    input.targetToken.dnd5eCombatState = {
      helpedAttackSourceId: helper.id,
      helpedAttackSourceTurnKey: '1:helper-token',
    }
    input.map.tokens.push(helper)
    input.initiativeOrder.push({
      tokenId: helper.id, label: helper.label, emoji: '', color: '', roll: 5,
    })
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
  })

  it('grants a second full Attack action after Action Surge', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 2, attackActionsAvailable: 2 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ attackNumber: 3, attacksAllowed: 4 })
  })

  it('spends an action only on the first attack of each Attack action', () => {
    const input = fixture()
    const noAction = spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('turn'), 'action').economy
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
      turnEconomy: noAction,
    })).toEqual({ ok: false, reason: 'attack-action-spent' })

    const extraAttack = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 1,
      turnEconomy: noAction,
    })
    expect(extraAttack.ok).toBe(true)
    if (!extraAttack.ok) return
    expect(extraAttack.prepared.spendsAction).toBe(false)
    expect(resolvePreparedDnd5eEquipmentAttack({
      prepared: extraAttack.prepared,
      d20: 15,
      damageRolls: [5],
    }).result.ok).toBe(true)
  })

  it('allows one light off-hand attack as a bonus action after taking the Attack action', () => {
    const input = fixture()
    const dualWielder: Character = {
      ...input.actor,
      equipment: { mainWeapon: DND5E_SHORTSWORD, offHand: DND5E_OFFHAND_SHORTSWORD },
      dnd5eClassChoices: { fighter: { fightingStyles: ['two-weapon-fighting'] } },
    }
    const first = prepareDnd5eEquipmentAttack({
      ...input, characters: [dualWielder], attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const firstResolved = resolvePreparedDnd5eEquipmentAttack({ prepared: first.prepared, d20: 15, damageRolls: [3] })
    expect(firstResolved.result.ok).toBe(true)
    const saved = firstResolved.application?.characters[0]
    expect(saved?.dnd5eCombatState?.weaponAttackActionTurnKey).toBe('combat:1:fighter-token')
    if (!saved || !firstResolved.application) return

    const offHandAction: SharedPlayerActionState = {
      ...input.action,
      id: 'off-hand-action',
      dnd5eWeaponAttackOptions: { offHandAttack: true },
    }
    const offHand = prepareDnd5eEquipmentAttack({
      ...input,
      action: offHandAction,
      map: firstResolved.application.map,
      characters: [saved],
      attacksUsed: 1,
      turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(offHand.ok).toBe(true)
    if (!offHand.ok) return
    expect(offHand.prepared).toMatchObject({
      offHandAttack: true, spendsAction: false, spendsBonusAction: true, countsTowardAttackAction: false,
      profile: { weaponName: '短剑', damage: { bonus: 3 } },
      damageSource: { weaponId: DND5E_OFFHAND_SHORTSWORD.id, magical: false },
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: offHand.prepared, d20: 15, damageRolls: [2] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'fighter-token', resource: 'bonusAction',
    })
  })

  it('uses the same authoritative weapon path for another SRD class', () => {
    const input = fixture()
    const rogue = {
      ...input.actor,
      charClass: '游荡者',
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游荡者' }),
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [rogue], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ actor: { charClass: '游荡者' }, attacksAllowed: 1 })
  })

  it('applies Rogue Sneak Attack once per turn and persists the use marker', () => {
    const input = fixture()
    const rogue: Character = {
      ...input.actor,
      charClass: '游荡者',
      level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游荡者' }),
    }
    const ally = token({ id: 'ally-token', type: 'player', label: '盟友', x: 75, y: 75 })
    const map = { ...input.map, tokens: [...input.map.tokens, ally] }
    const initiativeOrder = [...input.initiativeOrder, { tokenId: ally.id, label: ally.label, emoji: '', color: '', roll: 5 }]
    const prepared = prepareDnd5eEquipmentAttack({ ...input, map, initiativeOrder, characters: [rogue], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, false)).toEqual([
      { source: 'sneak-attack', count: 3, sides: 6, type: 'piercing', doubleOnCritical: true },
    ])
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [5],
      classDamageRolls: [{ source: 'sneak-attack', rolls: [1, 2, 3] }],
    })
    expect(resolved.result.ok).toBe(true)
    const savedRogue = resolved.application?.characters.find((character) => character.id === rogue.id)
    expect(savedRogue?.dnd5eCombatState?.sneakAttackTurnKey).toBe('combat:1:fighter-token')
    if (!savedRogue || !resolved.application) return
    const second = prepareDnd5eEquipmentAttack({
      ...input,
      map: resolved.application.map,
      initiativeOrder,
      characters: [savedRogue],
      attacksUsed: 1,
      attackActionsAvailable: 2,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(second.prepared, false)).toEqual([])

    const nextRound = prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...input.action, round: 2 },
      map: resolved.application.map,
      initiativeOrder,
      characters: [savedRogue],
      attacksUsed: 0,
    })
    expect(nextRound.ok).toBe(true)
    if (!nextRound.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(nextRound.prepared, false))
      .toContainEqual(expect.objectContaining({ source: 'sneak-attack', count: 3 }))
  })

  it('adds Hunter Colossus Slayer only against an already wounded target', () => {
    const input = fixture()
    const ranger: Character = {
      ...input.actor,
      charClass: '游侠',
      level: 3,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游侠' }),
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['colossus-slayer'] } } },
      },
    }
    const woundedTarget = { ...input.targetToken, hp: 10, maxHp: 20 }
    const map = { ...input.map, tokens: [input.actorToken, woundedTarget] }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, map, characters: [ranger], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, false)).toEqual([
      { source: 'colossus-slayer', count: 1, sides: 8, type: 'piercing', doubleOnCritical: true },
    ])
  })

  it('adds the correct number of Brutal Critical weapon dice without doubling them again', () => {
    const input = fixture()
    const barbarian: Character = {
      ...input.actor,
      charClass: '野蛮人',
      level: 13,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [barbarian], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, true)).toContainEqual({
      source: 'brutal-critical', count: 2, sides: 12, type: 'slashing', doubleOnCritical: false,
    })
  })

  it('applies Improved Divine Smite and optional Divine Smite, spending the slot only on a hit', () => {
    const input = fixture()
    const paladin: Character = {
      ...input.actor,
      charClass: '圣武士',
      level: 11,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '圣武士' }),
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    }
    const undeadTarget = { ...input.targetToken, poolId: 'srd-5.1:skeleton', hp: 50, maxHp: 50 }
    const map = { ...input.map, tokens: [input.actorToken, undeadTarget] }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { divineSmiteSlotLevel: 2 } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, map, characters: [paladin], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, false)).toEqual([
      { source: 'improved-divine-smite', count: 1, sides: 8, type: 'radiant', doubleOnCritical: true },
      { source: 'divine-smite', count: 4, sides: 8, type: 'radiant', doubleOnCritical: true },
    ])
    const hit = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [5],
      classDamageRolls: [
        { source: 'improved-divine-smite', rolls: [4] },
        { source: 'divine-smite', rolls: [1, 2, 3, 4] },
      ],
    })
    expect(hit.result.ok).toBe(true)
    expect(hit.application?.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(0)

    const miss = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 1, damageRolls: [] })
    expect(miss.result.ok).toBe(true)
    expect(miss.application?.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(1)
  })

  it('rejects a Divine Smite request from a non-paladin', () => {
    const input = fixture()
    const action = { ...input.action, dnd5eWeaponAttackOptions: { divineSmiteSlotLevel: 1 } }
    expect(prepareDnd5eEquipmentAttack({ ...input, action, characters: [input.actor], attacksUsed: 0 }))
      .toEqual({ ok: false, reason: 'divine-smite-unavailable' })
  })

  it('authoritatively applies Reckless Attack to the first and subsequent Strength melee attacks this turn', () => {
    const input = fixture()
    const barbarian: Character = {
      ...input.actor,
      charClass: '野蛮人',
      level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
    }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { recklessAttack: true } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, characters: [barbarian], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 2, 18).roll.d20).toBe(18)
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 2,
      d20Second: 18,
      damageRolls: [5],
    })
    expect(resolved.result.ok).toBe(true)
    const saved = resolved.application?.characters[0]
    expect(saved?.dnd5eCombatState?.recklessAttackTurnKey).toBe('combat:1:fighter-token')
    if (!saved || !resolved.application) return

    const subsequent = prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...input.action, dnd5eWeaponAttackOptions: undefined },
      map: resolved.application.map,
      characters: [saved],
      attacksUsed: 1,
    })
    expect(subsequent.ok).toBe(true)
    if (!subsequent.ok) return
    expect(subsequent.prepared.attackMode).toBe('advantage')

    expect(prepareDnd5eEquipmentAttack({ ...input, action, characters: [barbarian], attacksUsed: 1 }))
      .toEqual({ ok: false, reason: 'reckless-attack-unavailable' })
  })

  it('marks a Monk Attack action as eligible for Martial Arts and Flurry of Blows', () => {
    const input = fixture()
    const monk: Character = {
      ...input.actor,
      charClass: '武僧',
      level: 5,
      abilities: { ...input.actor.abilities, str: 10, dex: 16, wis: 16 },
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '武僧' }),
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [monk], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState).toMatchObject({
      monkAttackActionTurnKey: 'combat:1:fighter-token',
      monkMartialArtsTurnKey: 'combat:1:fighter-token',
    })
  })

  it('settles a Berserker Frenzy attack as a bonus action without consuming the Attack action', () => {
    const input = fixture()
    const barbarian: Character = {
      ...input.actor,
      charClass: '野蛮人',
      level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker' } } },
      dnd5eCombatState: {
        raging: true,
        rageTurnsRemaining: 9,
        frenzying: true,
        frenzyStartedTurnKey: 'combat:1:fighter-token',
      },
    }
    const action = {
      ...input.action,
      round: 2,
      dnd5eWeaponAttackOptions: { frenzyAttack: true },
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      action,
      characters: [barbarian],
      attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('combat:2:fighter-token'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction: false, spendsBonusAction: true, countsTowardAttackAction: false })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'fighter-token', resource: 'bonusAction' })

    const sameTurn = prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...action, round: 1 },
      characters: [barbarian],
      attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('combat:1:fighter-token'),
    })
    expect(sameTurn).toEqual({ ok: false, reason: 'frenzy-attack-unavailable' })
  })

  it('applies level-three exhaustion disadvantage to weapon attacks', () => {
    const input = fixture()
    const exhausted = { ...input.actor, exhaustionLevel: 3 }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [exhausted], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 18, 2).roll.d20).toBe(2)
  })

  it('grants Hunter Horde Breaker once per turn against another creature within 5 feet of the original target', () => {
    const input = fixture()
    const ranger: Character = {
      ...input.actor,
      charClass: '游侠',
      level: 3,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游侠' }),
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['horde-breaker'] } } },
      },
    }
    const secondTarget = token({ id: 'second-enemy', label: '第二目标', x: 75, y: 75, hp: 20, maxHp: 20 })
    const map = { ...input.map, tokens: [...input.map.tokens, secondTarget] }
    const initiativeOrder = [
      ...input.initiativeOrder,
      { tokenId: secondTarget.id, label: secondTarget.label, emoji: '', color: '', roll: 5 },
    ]
    const first = prepareDnd5eEquipmentAttack({ ...input, map, initiativeOrder, characters: [ranger], attacksUsed: 0 })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const firstResolved = resolvePreparedDnd5eEquipmentAttack({ prepared: first.prepared, d20: 15, damageRolls: [2] })
    expect(firstResolved.result.ok).toBe(true)
    const savedAfterFirst = firstResolved.application?.characters[0]
    expect(savedAfterFirst?.dnd5eCombatState).toMatchObject({
      hordeBreakerOpportunityTurnKey: 'combat:1:fighter-token',
      hordeBreakerSourceTargetId: 'enemy-token',
    })
    if (!savedAfterFirst || !firstResolved.application) return

    const hordeAction = {
      ...input.action,
      targetTokenId: secondTarget.id,
      dnd5eWeaponAttackOptions: { hordeBreakerAttack: true },
    }
    const horde = prepareDnd5eEquipmentAttack({
      ...input,
      action: hordeAction,
      map: firstResolved.application.map,
      initiativeOrder,
      characters: [savedAfterFirst],
      attacksUsed: 1,
    })
    expect(horde.ok).toBe(true)
    if (!horde.ok) return
    expect(horde.prepared).toMatchObject({ spendsAction: false, spendsBonusAction: false, countsTowardAttackAction: false })
    const hordeResolved = resolvePreparedDnd5eEquipmentAttack({ prepared: horde.prepared, d20: 15, damageRolls: [3] })
    expect(hordeResolved.result.ok).toBe(true)
    const savedAfterHorde = hordeResolved.application?.characters[0]
    expect(savedAfterHorde?.dnd5eCombatState?.hordeBreakerUsedTurnKey).toBe('combat:1:fighter-token')
    if (!savedAfterHorde || !hordeResolved.application) return
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      action: hordeAction,
      map: hordeResolved.application.map,
      initiativeOrder,
      characters: [savedAfterHorde],
      attacksUsed: 1,
    })).toEqual({ ok: false, reason: 'horde-breaker-unavailable' })
  })

  it('spends Ki on a hit for Stunning Strike and persists a failed Constitution save', () => {
    const input = fixture()
    const monk: Character = {
      ...input.actor,
      charClass: '武僧',
      level: 5,
      abilities: { ...input.actor.abilities, str: 10, dex: 16, wis: 16 },
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '武僧' }),
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { stunningStrike: true } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, characters: [monk], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.stunningStrike).toEqual({
      saveDc: 14, saveModifier: 0, saveMode: 'normal', blessed: false, baned: false,
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      stunningStrikeSaveD20: 5,
      damageRolls: [4],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === input.targetToken.id)?.dnd5eCombatState).toMatchObject({
      stunnedByActorId: 'fighter-token',
      stunnedAppliedTurnKey: 'combat:1:fighter-token',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'enemy-token', ability: 'con', dc: 14, success: false,
    }))
    expect(resolved.result.events).toContainEqual({ type: 'condition-applied', actorId: 'fighter-token', targetId: 'enemy-token', condition: '震慑' })
  })

  it('does not spend Stunning Strike Ki when the weapon attack misses', () => {
    const input = fixture()
    const monk: Character = {
      ...input.actor,
      charClass: '武僧', level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '武僧' }),
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { stunningStrike: true } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, characters: [monk], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 1, damageRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 5 })
  })
})

it.each([false, true])('previews bound special attack advantage with disadvantage cancellation %s', poisoned => {
  const input = fixture()
  input.actor.classResources = { ...input.actor.classResources, 'mark-uses': { current: 1, max: 3 } }
  input.actor.dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
    activeEffects: poisoned ? [createDnd5eConditionEffect({ condition: 'poisoned', targetId: input.actor.id, source: { kind: 'system' } })] : [],
    activityWeaponAttackGrants: { special: { schemaVersion: 1, grantId: 'special', label: 'Special',
      sourceActivityId: 'special', appliedTurnKey: 'combat:1:fighter-token', economy: 'bonus-action',
      requiredTargetId: input.action.targetTokenId, attackAdvantage: true, weaponModes: ['melee'],
      damageBonus: 6, attackResourceCost: { resourceId: 'mark-uses', amount: 1 } } } }
  input.action.dnd5eWeaponAttackOptions = { activityWeaponAttackGrantId: 'special' }
  const ready = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 1 })
  expect(ready.ok, JSON.stringify(ready)).toBe(true)
  if (!ready.ok) throw Error(ready.reason)
  expect(ready.prepared.attackMode).toBe(poisoned ? 'normal' : 'advantage')
  expect(ready.prepared.profile.damage.bonus).toBe(9)
  const settled = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 2, d20Second: 18, damageRolls: [4] })
  expect(settled.result.ok, JSON.stringify(settled.result)).toBe(true)
  expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved',
    rollMode: poisoned ? 'normal' : 'advantage', d20: poisoned ? 2 : 18 }))
  expect(settled.result.state.combatants['fighter-token'].classResources['mark-uses'].current).toBe(0)
  expect(settled.result.events.filter(event => event.type === 'class-resource-spent')).toHaveLength(1)
  if (!poisoned) expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'damage-applied', amount: 13 }))
  input.actor.classResources['mark-uses'].current = 0
  expect(prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 1 })).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
  input.actor.classResources['mark-uses'].current = 1
  input.actor.dnd5eCombatState.activityWeaponAttackGrants!.special.requiredTargetId = 'different-target'
  expect(prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 1 })).toMatchObject({ ok: false, reason: 'invalid-target' })
})

it.each(['simple', 'martial'] as const)('previews and settles only the declared %s weapon roll category', category => {
  const input = fixture()
  input.actor.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({ definitionId: 'test:category', label: 'Training', targetId: input.actor.id,
    source: { kind: 'spell' }, modifiers: { weaponCategoryRollModes: [{ mode: 'advantage', categories: [category] }] } })] }
  const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
  if (!prepared.ok) throw Error('Preparation failed')
  const expected = prepared.prepared.classDamageContext.weaponCategory === category ? 'advantage' : 'normal'
  expect(prepared.prepared.attackMode).toBe(expected)
  const settled = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 18, d20Second: 19, damageRolls: [4] })
  expect(settled.result.ok, JSON.stringify(settled.result)).toBe(true)
  expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', rollMode: expected }))
})

it('builds random weapon target candidates from visible creatures and actual reach without changing allegiance', () => {
  const input = fixture(75)
  input.actor.equipment = { mainWeapon: DND5E_SHORTSWORD }
  const ally = token({ id: 'ally', characterId: 'ally-character', type: 'player', label: 'Ally', x: 25, y: 75 })
  const far = token({ id: 'far', x: 425, y: 425 })
  const object = token({ id: 'object', type: 'obstacle', x: 25, y: 75 })
  input.map.tokens.push(ally, far, object)
  const targets = () => dnd5eVisibleEquipmentAttackTargets({ ...input, characters: [input.actor, { ...fighter(), id: 'ally-character' }], attacksUsed: 0 })
  const allyPrepared = prepareDnd5eEquipmentAttack({ ...input, action: { ...input.action, targetTokenId: ally.id }, characters: [input.actor, { ...fighter(), id: 'ally-character' }], attacksUsed: 0 })
  expect(allyPrepared.ok, JSON.stringify(allyPrepared)).toBe(true)
  if (!allyPrepared.ok) throw Error(allyPrepared.reason)
  expect(allyPrepared.prepared.state.initiativeOrder).toEqual(['fighter-token', 'enemy-token'])
  const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: allyPrepared.prepared, d20: 19, damageRolls: [4] })
  expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.result.state.initiativeOrder).toEqual(['fighter-token', 'enemy-token'])
  expect(resolved.application?.characters.find(character => character.id === 'ally-character')?.currentHp).toBeLessThan(44)
  expect(targets().map(candidate => candidate.targetToken.id).sort()).toEqual(['ally', 'enemy-token'])
  expect(ally.type).toBe('player')
  input.actor.dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
    activeEffects: [createDnd5eConditionEffect({ id: 'blind', targetId: input.actorToken.id, condition: 'blinded', source: { kind: 'dm' } })] }
  expect(targets()).toHaveLength(0)
})

it.each(['enemy', 'npc'] as const)('random weapon selection resolves a noninitiative %s without adding a turn', type => {
  const input = fixture(75)
  input.actor.equipment = { mainWeapon: DND5E_SHORTSWORD }
  input.targetToken.type = type
  input.initiativeOrder = input.initiativeOrder.slice(0, 1)
  const candidates = dnd5eVisibleEquipmentAttackTargets({ ...input, characters: [input.actor], attacksUsed: 0 })
  expect(candidates.map(candidate => candidate.targetToken.id)).toEqual(['enemy-token'])
  const result = resolvePreparedDnd5eEquipmentAttack({ prepared: candidates[0], d20: 19, damageRolls: [4] })
  expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
  expect(result.result.state.initiativeOrder).toEqual(['fighter-token'])
  expect(result.application?.map.tokens.find(target => target.id === 'enemy-token')?.hp).toBeLessThan(20)
  input.targetToken.dnd5eCombatState = { activeEffects: [createDnd5eConditionEffect({
    id: 'hidden-creature', targetId: input.targetToken.id, condition: 'invisible', source: { kind: 'dm' },
  })] }
  expect(dnd5eVisibleEquipmentAttackTargets({ ...input, characters: [input.actor], attacksUsed: 0 })).toHaveLength(0)
})

it.each([1, 20, undefined])('settles a weapon-triggered monster Shield casting save: %s', d20 => {
  const input = fixture(75)
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: input.targetToken.id,
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  input.targetToken.poolId = 'srd-5.1:mage'
  input.targetToken.dnd5eCombatState = { activeEffects: [pain], monsterSpellSlots: { 1: { current: 1, max: 1 } } }
  const ready = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
  expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
  if (!ready.ok) return
  const attackD20 = ready.prepared.targetArmorClass + 1 - previewDnd5eEquipmentAttack(ready.prepared, 10).roll.modifier
  const result = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: attackD20,
    damageRolls: d20 === 20 ? [] : Array.from({ length: ready.prepared.profile.damage.count }, () => 2),
    shieldSpellcastingSavingThrows: d20 == null ? undefined : { [input.targetToken.id]: [{ effectId: pain.id, d20 }] } })
  expect(result.result.ok, result.result.ok ? '' : result.result.reason).toBe(d20 != null)
  if (!result.result.ok) {
    expect(result.application).toBeUndefined()
    expect(result.result.state.combatants[input.targetToken.id].classState.monsterSpellSlots?.[1].current).toBe(1)
    return
  }
  const target = result.result.state.combatants[input.targetToken.id]
  expect(target.currentHp).toBe(d20 === 20 ? 20 : 20 - ready.prepared.profile.damage.count * 2 - ready.prepared.profile.damage.bonus)
  expect(target.classState.monsterSpellSlots?.[1].current).toBe(0)
  expect(target.turn.reactionAvailable).toBe(false)
  expect(result.result.events.filter(event => event.type === 'spell-cast' && event.spellId === 'shield')).toHaveLength(1)
  expect(input.targetToken.hp).toBe(20)
})

// Temporary Extra Attack shares the same authoritative budget as class grants.
it.each([['法师',11,2],['战士',5,2],['战士',11,3]] as const)('temporary attack minimum respects %s level %s budget', (charClass,level,limit)=>{
 const input=fixture()
 input.actor.charClass=charClass;input.actor.level=level
 const effect=createDnd5eMechanicalEffect({id:'temporary-attacks',definitionId:'temporary-attacks',label:'Temporary attacks',targetId:input.actor.id,source:{kind:'spell'},modifiers:{attackActionMinimum:2}})
 input.actor.dnd5eCombatState={...input.actor.dnd5eCombatState,activeEffects:[effect]}
 for(let attacksUsed=0;attacksUsed<=limit;attacksUsed++){
  const prepared=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed})
  expect(prepared.ok).toBe(attacksUsed<limit)
  if(!prepared.ok)expect(prepared.reason).toBe('attack-action-spent')
 }
 input.actor.dnd5eCombatState.activeEffects=[{...effect,suspendedBy:['antimagic']}]
 if(charClass==='法师')expect(prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:1})).toMatchObject({ok:false,reason:'attack-action-spent'})
})

it.each([false,true])('derives critical thresholds after classifying thrown attacks (%s)', thrownAttack=>{
 const input=fixture()
 input.actor.equipment={...input.actor.equipment,mainWeapon:structuredClone(DND5E_HANDAXE)}
 input.actor.dnd5eCombatState={...input.actor.dnd5eCombatState,activeEffects:[createDnd5eMechanicalEffect({id:'critical-profile',definitionId:'critical-profile',label:'Critical profile',targetId:input.actor.id,source:{kind:'feature'},modifiers:{attackProfiles:[{attackModes:['melee'],criticalThreshold:19}]}})]}
 input.action.dnd5eWeaponAttackOptions={thrownAttack}
 const ready=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:0})
 expect(ready.ok,JSON.stringify(ready)).toBe(true);if(!ready.ok)return
 expect(ready.prepared.profile.criticalThreshold).toBe(thrownAttack?20:19)
 expect(previewDnd5eEquipmentAttack(ready.prepared,19).critical).toBe(!thrownAttack)
})


it.each([['圣武士',20,3],['战士',11,4]] as const)('adds an attack to each own-turn Attack action for %s without replacing its base (%s)',(charClass,level,total)=>{
 const input=fixture()
 input.actor.charClass=charClass;input.actor.level=level
 const effect=createDnd5eMechanicalEffect({id:'extra-attack',definitionId:'extra-attack',label:'Extra attack',targetId:input.actor.id,source:{kind:'feature'},modifiers:{ownTurnAttackActionBonus:1}})
 input.actor.dnd5eCombatState={...input.actor.dnd5eCombatState,activeEffects:[effect]}
 for(const actions of [1,2])for(let used=0;used<=total*actions;used++){
  const ready=prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:used,attackActionsAvailable:actions})
  expect(ready.ok,JSON.stringify({used,actions,ready})).toBe(used<total*actions)
  if(ready.ok)expect(ready.prepared.spendsAction).toBe(used%total===0)
 }
 input.action.initiativeIndex=1
 expect(prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:total-1}).ok).toBe(false)
 input.action.initiativeIndex=0;input.actor.dnd5eCombatState.activeEffects=[{...effect,suspendedBy:['antimagic']}]
 expect(prepareDnd5eEquipmentAttack({...input,characters:[input.actor],attacksUsed:total-1}).ok).toBe(false)
})
