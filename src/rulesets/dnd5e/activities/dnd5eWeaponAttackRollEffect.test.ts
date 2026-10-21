import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, dnd5eActiveAttackRollFlags, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
const abilities = { str: 14, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }
const snapshot = { id: 'source', controller: 'players' as const, level: 1, proficiencyBonus: 2, abilities, armorClass: 12, conditions: [], currentHp: 20, maxHp: 20 }
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'weapon-disadvantage', name: 'Weapon disadvantage', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
  effects: [{ schemaVersion: 1, id: 'chilled', name: 'Chilled', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, stacking: 'replace', modifiers: [{ kind: 'weapon-attack-roll', mode: 'disadvantage' }], breakOn: ['makes-weapon-attack'] }],
  outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'target', effectId: 'chilled' }] }], automation: automationCapabilityFromLegacyStatus('full'),
}
it('preserves ability-scoped advantage through public execution, Host commit and serialization', () => {
  const scoped: Dnd5eActivityDefinitionV1 = {...activity, effects:[{
    ...activity.effects![0], breakOn:[], modifiers:[
      {kind:'attack-roll',mode:'advantage',ability:'str'},
      {kind:'attack-roll',mode:'advantage',ability:'wis'},
    ],
  }]}
  const resolution=resolveDnd5eActivity({activity:scoped,actor:snapshot,targets:[{...snapshot,id:'actor'}],rolls:{},distanceFeetByTargetId:{actor:5}})
  const committed=commitDnd5eActivityExecution(startDnd5eHeadlessCombat('scoped',[make('actor',20),make('target',10)]),{
    actorId:'target',activityId:scoped.id,targetIds:['actor'],resolution,source:{kind:'spell',id:scoped.id},
  })
  expect(committed.ok).toBe(true)
  const serialized=JSON.parse(JSON.stringify(committed.state.combatants.actor.classState.activeEffects))
  expect(validateDnd5eActiveEffectsStrict(serialized)).toMatchObject({ok:true})
  const effects=normalizeDnd5eActiveEffects(serialized)
  expect(effects[0].modifiers?.attackRollAdvantageAbilities).toEqual(['str','wis'])
  for(const ability of ['str','dex','con','int','wis','cha',undefined] as const){
    for(const category of ['weapon','spell'] as const){
      expect(dnd5eActiveAttackRollFlags(effects,ability,category).advantage).toBe(ability==='str'||ability==='wis')
    }
  }
  expect(dnd5eActiveAttackRollFlags([{...effects[0],suspendedBy:['antimagic']}],'str','weapon').advantage).toBe(false)
  serialized[0].modifiers.attackRollAdvantageAbilities=['unknown']
  expect(validateDnd5eActiveEffectsStrict(serialized).ok).toBe(false)
  for(const strengthBased of [true,false]){
    const attacked=resolveDnd5eHeadlessAction(committed.state,{type:'attack',actorId:'actor',targetId:'target',attackModifier:5,d20:4,d20Second:15,
      damage:{count:1,sides:6,bonus:0,rolls:[2]},classDamageContext:{mode:'melee',weaponId:'longsword',strengthBased,finesse:!strengthBased,weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false}})
    expect(attacked.ok).toBe(true)
    expect(attacked.events).toContainEqual(expect.objectContaining({type:'attack-resolved',rollMode:strengthBased?'advantage':'normal'}))
  }
  const unarmed=resolveDnd5eHeadlessAction(committed.state,{type:'attack',actorId:'actor',targetId:'target',attackModifier:5,d20:4,d20Second:15,damage:{count:1,sides:6,bonus:0,rolls:[2]}})
  expect(unarmed.ok).toBe(true)
  expect(unarmed.events).toContainEqual(expect.objectContaining({type:'attack-resolved',attackMode:'unarmed',rollMode:'advantage'}))
})
function make(id: string, initiative: number) { return createDnd5eCombatant({ ...snapshot, id, name: id, controller: id === 'target' ? 'dm' : 'player', initiative, temporaryHp: 0, speed: 30, position: { x: id === 'target' ? 30 : 0, y: 0 }, concentrating: false, classId: 'wizard', classSelections: { 'spell-cantrips': ['fire-bolt'] } }) }

it.each([1, 18])('spell attacks preserve the next weapon penalty; a weapon hit/miss consumes it (%s)', die => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const resolution = resolveDnd5eActivity({ activity, actor: snapshot, targets: [{ ...snapshot, id: 'actor' }], rolls: {}, distanceFeetByTargetId: { actor: 5 } })
  expect(resolution.ok).toBe(true)
  const committed = commitDnd5eActivityExecution(startDnd5eHeadlessCombat('next-weapon', [make('actor', 20), make('target', 10)]), { actorId: 'target', activityId: activity.id, targetIds: ['actor'], resolution, source: { kind: 'spell', id: activity.id } })
  expect(committed.ok).toBe(true)
  const spell = resolveDnd5eHeadlessAction(committed.state, { type: 'cast-spell', actorId: 'actor', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0, d20: 15, effectRolls: [4] })
  expect(spell.ok, JSON.stringify(spell)).toBe(true)
  expect(spell.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', attackMode: 'spell', d20: 15, total: 20 }))
  expect(spell.state.combatants.actor.classState.activeEffects).toHaveLength(1)
  const slingSpell = resolveDnd5eHeadlessAction(committed.state, { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5, d20: 15, damage: { count: 1, sides: 6, bonus: 2, rolls: [4] }, classDamageContext: { spellAttack: true, spellDeliveredByWeapon: true, mode: 'ranged', distanceFeet: 30, normalRangeFeet: 60, longRangeFeet: 120, strengthBased: false, finesse: false, weaponDamageSides: 6, damageType: 'bludgeoning', adjacentEnemyOfTarget: false } })
  expect(slingSpell.ok, JSON.stringify(slingSpell)).toBe(true)
  expect(slingSpell.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', attackCategory: 'spell', rollMode: 'normal' }))
  expect(slingSpell.state.combatants.actor.classState.activeEffects).toHaveLength(1)
  // Fork the authoritative pre-cast state to test the alternative action in the same turn.
  const weapon = resolveDnd5eHeadlessAction(committed.state, { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5, d20: die, d20Second: 19, damage: { count: 1, sides: 6, bonus: 2, rolls: [4] }, classDamageContext: { mode: 'ranged', distanceFeet: 30, normalRangeFeet: 60, longRangeFeet: 120, strengthBased: false, finesse: false, weaponDamageSides: 6, damageType: 'piercing', adjacentEnemyOfTarget: false } })
  expect(weapon.ok, JSON.stringify(weapon)).toBe(true)
  expect(weapon.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', rollMode: 'disadvantage', d20: die }))
  expect(weapon.state.combatants.actor.classState.activeEffects).toBeUndefined()
  expect(weapon.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: 'makes-weapon-attack' }))
})

it('serializes weapon-only flags and excludes spell attacks and suspended effects', () => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'weapon-only', label: 'Chilled', targetId: 'actor', source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { weaponAttackRollDisadvantage: true }, breakOn: ['makes-weapon-attack'] })
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(effects[0].breakOn).toEqual(['makes-weapon-attack'])
  expect(dnd5eActiveAttackRollFlags(effects, 'dex', 'weapon').disadvantage).toBe(true)
  expect(dnd5eActiveAttackRollFlags(effects, undefined, 'spell').disadvantage).toBe(false)
  expect(dnd5eActiveAttackRollFlags([{ ...effect, suspendedBy: ['antimagic'] }], 'dex', 'weapon').disadvantage).toBe(false)
})

it.each(['int','wis'] as const)('native spell attack uses its actual casting ability for %s advantage', ability => {
  const scoped: Dnd5eActivityDefinitionV1 = {...activity,effects:[{
    ...activity.effects![0],breakOn:[],modifiers:[{kind:'attack-roll',mode:'advantage',ability}],
  }]}
  const resolution=resolveDnd5eActivity({activity:scoped,actor:snapshot,targets:[{...snapshot,id:'actor'}],rolls:{},distanceFeetByTargetId:{actor:5}})
  const committed=commitDnd5eActivityExecution(startDnd5eHeadlessCombat('scoped-spell',[make('actor',20),make('target',10)]),{
    actorId:'target',activityId:scoped.id,targetIds:['actor'],resolution,source:{kind:'spell',id:scoped.id},
  })
  const cast=resolveDnd5eHeadlessAction(committed.state,{type:'cast-spell',actorId:'actor',targetId:'target',spellId:'fire-bolt',slotLevel:0,castingClassId:'wizard',d20:4,d20Second:ability==='int'?15:undefined,effectRolls:ability==='int'?[3]:[]})
  expect(cast.ok,JSON.stringify(cast)).toBe(true)
  expect(cast.events).toContainEqual(expect.objectContaining({type:'attack-resolved',d20:ability==='int'?15:4,hit:ability==='int'}))
})





it.each(['advantage', 'disadvantage'] as const)('limits %s to declared equipment categories after execution and reload', mode => {
  const scoped: Dnd5eActivityDefinitionV1 = { ...activity, effects: [{ ...activity.effects![0], breakOn: [],
    modifiers: [{ kind: 'weapon-attack-roll', mode, weaponCategories: ['simple', 'martial'] }],
  }] }
  expect(validateDnd5eActivityDefinitionV1(scoped)).toEqual([])
  const resolution = resolveDnd5eActivity({ activity: scoped, actor: snapshot, targets: [{ ...snapshot, id: 'actor' }], rolls: {}, distanceFeetByTargetId: { actor: 5 } })
  const committed = commitDnd5eActivityExecution(startDnd5eHeadlessCombat('categories', [make('actor', 20), make('target', 10)]), {
    actorId: 'target', activityId: scoped.id, targetIds: ['actor'], resolution, source: { kind: 'spell', id: scoped.id },
  })
  expect(committed.ok).toBe(true)
  const loaded = JSON.parse(JSON.stringify(committed.state)) as typeof committed.state
  const effects = normalizeDnd5eActiveEffects(loaded.combatants.actor.classState.activeEffects)
  expect(validateDnd5eActiveEffectsStrict(effects)).toMatchObject({ ok: true })
  expect(effects[0].modifiers?.weaponCategoryRollModes).toEqual([{ mode, categories: ['simple', 'martial'] }])
  for (const weaponCategory of [undefined, 'simple', 'martial'] as const) {
    for (const category of ['weapon', 'spell'] as const) {
      expect(dnd5eActiveAttackRollFlags(effects, 'str', category, weaponCategory)[mode]).toBe(category === 'weapon' && weaponCategory != null)
    }
    for (const suspended of [false, true]) {
      const state = structuredClone(loaded)
      state.combatants.actor.classState.activeEffects = effects.map(effect => ({ ...effect, suspendedBy: suspended ? ['antimagic'] : undefined }))
      const before = structuredClone(state)
      const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5, d20: 4, d20Second: 15,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [2] }, classDamageContext: { mode: 'melee', weaponCategory, weaponId: 'test-weapon', strengthBased: true, finesse: false, weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false } })
      expect(attack.ok, JSON.stringify(attack)).toBe(true)
      expect(attack.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', rollMode: weaponCategory && !suspended ? mode : 'normal' }))
      expect(state).toEqual(before)
    }
  }
  const unarmed = resolveDnd5eHeadlessAction(loaded, { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5, d20: 4, d20Second: 15, damage: { count: 1, sides: 6, bonus: 0, rolls: [2] } })
  expect(unarmed.ok).toBe(true)
  expect(unarmed.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', attackMode: 'unarmed', rollMode: 'normal' }))
  for (const categories of [[], ['simple', 'simple'], ['natural'], null]) {
    const invalid = structuredClone(scoped)
    invalid.effects![0].modifiers = [{ kind: 'weapon-attack-roll', mode, weaponCategories: categories } as never]
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('weaponCategories'))).toBe(true)
    expect(validateDnd5eActiveEffectsStrict([{ ...effects[0], modifiers: { weaponCategoryRollModes: [{ mode, categories }] } }]).ok).toBe(false)
  }
})

it('exports category constraints and installs the same declarative Activity twice', async () => {
  const namespace = 'test.weapon-category-effects'
  const scoped: Dnd5eActivityDefinitionV1 = { ...activity, legacySource: { kind: 'feature', id: 'training' }, effects: [{ ...activity.effects![0],
    modifiers: [{ kind: 'weapon-attack-roll', mode: 'advantage', weaponCategories: ['simple', 'martial'] }],
  }] }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Synthetic weapon categories', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'training', name: 'Training', automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'training', name: 'Training', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [scoped] }],
  }
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const registered = getRegisteredDnd5eActivity(namespace, scoped.id)!
      expect(registered.effects![0].modifiers).toEqual(scoped.effects![0].modifiers)
      const resolution = resolveDnd5eActivity({ activity: registered, actor: snapshot, targets: [{ ...snapshot, id: 'actor' }], rolls: {}, distanceFeetByTargetId: { actor: 5 } })
      const committed = commitDnd5eActivityExecution(startDnd5eHeadlessCombat('imported', [make('actor', 20), make('target', 10)]), {
        actorId: 'target', activityId: registered.id, targetIds: ['actor'], resolution, source: { kind: 'spell', id: registered.id },
      })
      expect(committed.ok).toBe(true)
      expect(committed.state.combatants.actor.classState.activeEffects?.[0].modifiers?.weaponCategoryRollModes).toEqual([{ mode: 'advantage', categories: ['simple', 'martial'] }])
    } finally { dispose() }
    archive = await exportDnd5eStarMod(decoded.bundle)
  }
})
