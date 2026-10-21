import {dnd5eRollDiceRecipes} from './rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from './rollDiceTransaction'
import { resolveAndCommitDnd5eActivityCommand } from './activities/dnd5eActivityHeadlessAuthorityBridge'
import { dnd5eActivityActorSnapshotFromCombatantV1, resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { prepareDnd5eMonsterSpecialAction, resolvePreparedDnd5eMonsterSpecialAction } from './monsterSpecialAction'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from './monsterAttackAction'
import type { BattleMap } from '../../store/maps'
import { getDnd5eSrdMonster } from './monsters'
import { expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { dnd5ePostD20AdjustmentPreviewModifier, createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, previewDnd5eSavingThrowCounterattack, dnd5eSavingThrowCounterattackOptions, dnd5eTurnStartGazeRequirements, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, type Dnd5eAction } from './headlessCombatEngine'
import {
  declarativeAbilityCompatibilityV1,
  validateDeclarativeSubclassAbilityV1,
  type DeclarativeSubclassAbilityV1,
} from './declarativeSubclassAbility'

const declaration: DeclarativeSubclassAbilityV1 = {
  schemaVersion: 1, id: 'counter', name: 'Counter', description: 'Synthetic pre-save weapon reaction',
  level: 15, trigger: { kind: 'before-saving-throw' }, cost: { economy: 'reaction' },
  targeting: { kind: 'self' }, effects: [], automation: 'full',
  mechanic: { kind: 'saving-throw-weapon-counterattack', markEffectDefinitionId: 'prey-hit' },
}

it('accepts a bound-mark counter declaration without advertising an unwired effect as full automation', () => {
  expect(() => validateDeclarativeSubclassAbilityV1(declaration)).not.toThrow()
  expect(declarativeAbilityCompatibilityV1(declaration).effective).toBe('manual')
})

it.each([
  { trigger: { kind: 'after-d20-roll' } },
  { cost: { economy: 'action' } },
  { cost: { economy: 'reaction', uses: 1 } },
  { cost: { economy: 'reaction', movementFeet: 5 } },
  { targeting: { kind: 'single-creature', rangeFeet: 60, relation: 'enemy' } },
  { mechanic: { kind: 'saving-throw-weapon-counterattack', markEffectDefinitionId: '' } },
  { mechanic: { kind: 'saving-throw-weapon-counterattack', markEffectDefinitionId: 'prey', rangeFeet: 60 } },
])('rejects incompatible or invented counter constraints %#', patch => {
  expect(() => validateDeclarativeSubclassAbilityV1({ ...declaration, ...patch })).toThrow()
})

it.each(['hit', 'miss', 'miss-no-dice', 'forged-zero', 'wrong-prey', 'wrong-plugin', 'spent', 'low-level', 'unused', 'duplicate', 'invalid-damage',
  'wrapped', 'wrong-activity', 'suffix-collision', 'wrong-owner'].flatMap(branch =>
    (['miss-no-dice', 'forged-zero'].includes(branch) ? ['special', 'special-facade', 'terminal-facade', 'wing', 'repeat', 'repeat-start', 'periodic', 'gaze', 'periodic-repeat'] : ['single', 'targets', 'activity', 'monster', 'monster-facade', 'special', 'special-facade', 'terminal-facade', 'wing', 'repeat', 'repeat-start', 'periodic', 'gaze', 'periodic-repeat']).map(saveShape => ({ branch, saveShape })) ).concat(
      ['hit','miss','wrong-prey','invalid-damage','unused','duplicate','bridge-cost','bridge-stale','bridge-prerequisite-miss','bridge-immune'].map(branch=>({branch,saveShape:'bridge'})),
      ['hit','miss','wrong-prey','invalid-damage','unused','duplicate','bridge-cost','bridge-stale','bridge-prerequisite-miss','bridge-immune'].map(branch=>({branch,saveShape:'registered'})),
      ['bridge','registered'].map(saveShape=>({branch:'shield-resource-conflict',saveShape})),
      ['hit','miss'].map(branch=>({branch,saveShape:'registered-projectile'})),
      ['wing-next-alive','wing-next-lethal'].map(branch=>({branch,saveShape:'wing'})),
      ['negate-valid','negate-empty','negate-normal','negate-invalid-damage'].map(branch=>({branch,saveShape:'repeat'})),
      ['ward-pass','ward-fail','ward-missing','ward-invalid'].map(branch=>({branch,saveShape:'repeat'})),
      ['attempt-pass','attempt-fail','attempt-missing','attempt-invalid','attempt-invalid-damage'].map(branch=>({branch,saveShape:'repeat'})),
      ['area-valid','area-spent','area-self','area-invalid-damage'].map(branch=>({branch,saveShape:'repeat'})),
      ['post-add','post-subtract','post-spent','post-self'].map(branch=>({branch,saveShape:'repeat'})),
      ['effect-add','effect-subtract','effect-missing','effect-extra','effect-stale','effect-no-event'].map(branch=>({branch,saveShape:'repeat'})),
      ['hit','miss','sequence-stopped'].map(branch=>({branch,saveShape:'registered-sequential'})),
      ['hit','miss','sequence-stopped'].map(branch=>({branch,saveShape:'activity-sequential'})),
      ['multi-hit','multi-reversed','multi-first-miss'].map(branch=>({branch,saveShape:'activity-sequential'})),
      ['multi-hit','multi-reversed','multi-first-miss'].map(branch=>({branch,saveShape:'registered-sequential'})),
      ['hit','miss','prerequisite-miss','forged-zero'].map(branch=>({branch,saveShape:'activity-dependent'})),
      ['shield-block', 'shield-hit', 'shield-forged-zero', 'dodge', 'inspiration', 'cutting-words', 'protection-block', 'protection-cancel'].map(branch => ({branch,saveShape:'repeat'})),
      ['inactive-check', 'wrong-ability', 'forged-success', 'forged-no-dice', 'immune-save', 'excluded-save', 'choice-save', 'wrong-choice-save', 'allied-save', 'willing-save', 'lethal-source', 'occluded-source'].map(branch => ({ branch, saveShape: 'activity' })),
      ['monster', 'monster-facade', 'repeat', 'repeat-start', 'periodic', 'gaze'].map(saveShape => ({branch:'hit-bless',saveShape}))))(
  'resolves a counterattack before the source save: $branch/$saveShape', ({ branch, saveShape }) => {
    const wrapped = ['wrapped', 'wrong-activity', 'suffix-collision', 'wrong-owner'].includes(branch)
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'save-test', name: 'Save test',
      activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
      automation: automationCapabilityFromLegacyStatus('full'),
      checks: [{ id: 'save', kind: 'saving-throw', rollId: 'save-d20', scope: 'per-target',
        ability: 'dex', dc: { kind: 'constant', value: 15 } }],
      outcomes: [false, true].map(success => ({ id: success ? 'success' : 'failure',
        when: { kind: 'check', checkId: 'save', result: success ? 'success' : 'failure' },
        operations: [{ id: success ? 'half-damage' : 'damage', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: success ? 6 : 12 }, damageType: 'fire' }] })),
    }
    if (saveShape.startsWith('registered')) activity.legacySource = { kind: 'feature', id: 'save-test' }
    if (saveShape.endsWith('-sequential')) {
      Object.assign(activity.target,{count:2})
      Object.assign(activity.checks![0],{stopAfterFirstFailure:true})
    }
    if (saveShape === 'registered-projectile') {
      activity.legacySource = {kind:'spell',id:'save-test'}
      Object.assign(activity.target, {count:2,allowDuplicateTargets:true})
      Object.assign(activity.checks![0], {perProjectile:true})
      for (const outcome of activity.outcomes) for (const operation of outcome.operations) Object.assign(operation,{perProjectile:true})
    }
    if (saveShape === 'activity-dependent' || branch === 'bridge-prerequisite-miss') {
      Object.assign(activity.checks![0], {appliesWhenCheck:{checkId:'attack',result:'success'}})
      activity.checks = [{id:'attack',kind:'attack-roll',rollId:'attack',scope:'per-target',attackBonus:{kind:'constant',value:5},delivery:'melee',rollMode:'normal'},...activity.checks!]
    }
    if (branch === 'bridge-cost') activity.consumption = [{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}]
    if (branch === 'shield-resource-conflict') activity.consumption = [{kind:'resource',resourceId:'dnd5e-spell-slot-1',amount:{kind:'constant',value:1},consumeOn:'resolve'}]
    if (branch === 'inactive-check') {
      activity.choices = [{ id: 'mode', label: 'Mode', defaultOptionId: 'off',
        options: [{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }] }]
      Object.assign(activity.checks![0], { appliesWhenChoice: { choiceId: 'mode', optionIds: ['on'] } })
    }
    if (branch === 'lethal-source' || branch === 'occluded-source') Object.assign(activity.target, { requiresLineOfSight: true })
    if (branch === 'allied-save') Object.assign(activity.checks![0], { automaticFailureIfAllied: true })
    if (branch === 'willing-save') Object.assign(activity.checks![0], { allowWillingFailure: true })
    if (branch === 'wrong-ability') Object.assign(activity.checks![0], { ability: 'wis' })
    if (branch === 'immune-save' || branch === 'bridge-immune') Object.assign(activity.checks![0], { automaticSuccessIfConditionImmune: 'frightened' })
    if (branch === 'excluded-save') Object.assign(activity.checks![0], { excludedCreatureTypes: ['undead'] })
    if (branch === 'choice-save' || branch === 'wrong-choice-save') Object.assign(activity.checks![0], { ability: 'wis', abilityOptions: ['wis', 'dex'] })
    const registration = registerDnd5eActivityPackage({ packageId: 'test.counter', packageVersion: '1.0.0', activities: [activity] })
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.counter', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'hunter', name: 'Hunter', classId: 'ranger', summary: 'Synthetic',
        abilities: [{ ...declaration, mechanic: { kind: 'saving-throw-weapon-counterattack',
          markEffectDefinitionId: 'prey-hit', ...(wrapped ? { markActivityId: 'prey' } : {}) } }, {
          schemaVersion:1,id:'adjust',name:'Adjust',description:'Synthetic counter adjustment',level:15,
          trigger:{kind:'after-d20-roll'},cost:{economy:'reaction'},
          targeting:{kind:'single-creature',relation:'any',rangeFeet:30,requiresSight:true,includeSelf:true},
          mechanic:{kind:'post-d20-adjustment',rollKinds:['attack'],dieSides:6,directions:['add','subtract']},
          effects:[],automation:'full',
        }, {
          schemaVersion:1,id:'negate',name:'Negate',description:'Synthetic counter negation',level:15,
          trigger:{kind:'active-use'},targeting:{kind:'self'},effects:[],automation:'full',
          cost:{economy:'none',resources:[{resourceId:'dnd5e-ki',scope:'core',amount:2}]},
          mechanic:{kind:'d20-disadvantage-negation',rollKinds:['attack']},
        }] })
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
        api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic',
          automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
      },
    })
    try {
      const actor = (id: string, initiative: number) => createDnd5eCombatant({
        id, name: id, initiative, controller: id === 'source' ? 'dm' : 'player',
        abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
        proficiencyBonus: 3, armorClass: 12, currentHp: 50, maxHp: 50, temporaryHp: 0,
        speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      })
      const source = actor('source', 20), hunter = actor('hunter', 10)
      if (branch === 'allied-save') hunter.controller = source.controller
      source.classId = 'wizard'; source.level = 1; source.classLevels = { wizard: 1 }
      source.classSelections = { 'spell-prepared': ['burning-hands'] }
      if (saveShape === 'registered-projectile') source.classSelections['spell-prepared'].push('test.counter:save-test')
      source.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 1 } }
      source.pluginFeatureIds = ['test.counter:save-test']
      hunter.classId = 'ranger'; hunter.level = branch === 'low-level' ? 14 : 15
      hunter.classLevels = { ranger: hunter.level }; hunter.subclassIds = { ranger: 'test.counter:hunter' }
      hunter.pluginFeatureIds = ['test.counter:hunter.counter']
      if (branch === 'immune-save' || branch === 'bridge-immune') hunter.conditionImmunities = ['frightened']
      if (branch === 'excluded-save') hunter.creatureType = 'undead'
      if (branch === 'choice-save') hunter.savingThrowBonuses = { ...hunter.savingThrowBonuses, dex: 8 }
      if (branch === 'wrong-choice-save') hunter.savingThrowBonuses = { ...hunter.savingThrowBonuses, wis: 8 }
      const mark = createDnd5eMechanicalEffect({
        definitionId: wrapped ? `activity:test.counter:prey:prey-hit:modifiers:${branch === 'suffix-collision' ? '0:unrelated' : '0'}` : 'prey-hit',
        label: 'Prey', source: { kind: 'plugin', pluginId: branch === 'wrong-plugin' ? 'other' : 'test.counter',
          actorId: branch === 'wrong-owner' ? 'other' : 'hunter',
          rulesId: wrapped ? `test.counter:${branch === 'wrong-activity' ? 'other' : 'prey'}` : undefined },
        targetId: 'hunter', modifiers: { onHitBonusDamage: {
          count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
          doubleDiceOnCritical: true, oncePerTurn: true, consumeEffectOnHit: false,
          boundTargetId: branch === 'wrong-prey' ? 'other' : 'source',
        } },
      })
      hunter.classState.activeEffects = [mark]
      const state = startDnd5eHeadlessCombat('counter-save',
        saveShape === 'targets' || saveShape.endsWith('-sequential') ? [source, hunter, actor('bystander', 5)] : [source, hunter])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('source', 'hunter')]: 5 }
      if (saveShape.endsWith('-sequential')) state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('source','bystander')] = 5
      if (branch === 'lethal-source') state.combatants.source.currentHp = 1
      if (branch === 'occluded-source') state.physicalLineOfSightBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('source', 'hunter')]: true }
      if (branch === 'spent') state.combatants.hunter.turn.reactionAvailable = false
      const attack: Extract<Dnd5eAction, { type: 'attack' }> = {
        type: 'attack', actorId: 'hunter', targetId: 'source', d20: branch === 'miss' || branch === 'miss-no-dice' ? 1 : 15, attackModifier: 5,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [branch === 'invalid-damage' ? 7 : 2], type: 'slashing' },
        classDamageContext: { mode: 'melee', weaponId: 'sword', finesse: false, strengthBased: true,
          weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false },
        classDamageRolls: branch === 'miss' || branch === 'miss-no-dice' ? [] : [{ source: 'activity-effect-rider', rollId: 'activity-on-hit:' + mark.id, rolls: [4] }],
      }
      const use: NonNullable<Dnd5eAction['savingThrowCounterattacks']>[number] = { targetId: 'hunter', sourceId: 'source', ability: 'dex' as const,
        occurrence: branch === 'unused' ? 1 : 0, featureId: 'test.counter:hunter.counter', attack }
      const ghoul = getDnd5eSrdMonster('srd-5.1:ghoul')!
      const claws = ghoul.actions.find(action => action.attack?.onHitEffects?.length)!
      if (saveShape.startsWith('monster')) { state.combatants.source.statBlockId = ghoul.id; use.ability = 'con' }
      if (branch === 'hit-bless') {
        const priest = actor('priest', 1)
        priest.concentrating = true
        priest.classState.concentrationSpellId = 'bless'
        priest.classState.concentrationTargetIds = ['hunter']
        state.combatants.priest = priest
        state.combatants.hunter.classState.concentrationEffectsBySource = {priest:'bless'}
        attack.blessRoll = 1
      }
      if (saveShape.startsWith('special')) { state.combatants.source.statBlockId = 'srd-5.1:mummy'; use.ability = 'wis' }
      const dragon = getDnd5eSrdMonster('srd-5.1:adult-black-dragon')!
      const wing = dragon.legendaryActions!.find(action => action.rule?.kind === 'legendary-wing-attack')!
      const wingRule = wing.rule!
      if (wingRule.kind !== 'legendary-wing-attack') throw Error('wing fixture')
      if (saveShape === 'wing') {
        state.combatants.source.statBlockId = dragon.id
        state.combatants.source.classState.monsterLegendaryActionPoints = 3
        state.initiativeIndex = state.initiativeOrder.indexOf('hunter')
      }
      if (saveShape.startsWith('repeat') || saveShape === 'periodic-repeat') {
        state.initiativeIndex = state.initiativeOrder.indexOf('hunter')
        state.combatants.hunter.classState.activeEffects!.push(createDnd5eMechanicalEffect({
          definitionId: 'repeat-test', label: 'Repeat', source: {kind:'monster',actorId:'source',rulesId:'repeat-test'},
          targetId: 'hunter', modifiers: {},
          repeatSave: {ability:'dex',dc:15,timing:saveShape === 'repeat-start' ? 'target-turn-start' : 'target-turn-end',onSuccess:'remove'},
        }))
      }
      if (saveShape === 'gaze') {
        state.combatants.source.statBlockId = 'srd-5.1:basilisk'
        state.initiativeIndex = state.initiativeOrder.indexOf('hunter')
        use.ability = 'con'
      }
      if (saveShape === 'periodic' || saveShape === 'periodic-repeat') {
        state.initiativeIndex = state.initiativeOrder.indexOf('hunter')
        state.combatants.hunter.classState.activeEffects!.push(createDnd5eMechanicalEffect({
          definitionId:'periodic-test',label:'Periodic',source:{kind:'monster',actorId:'source',rulesId:'periodic-test'},
          targetId:'hunter',modifiers:{},periodicDamage:{timing:'target-turn-end',count:1,sides:6,type:'fire',
            savingThrow:{ability:'dex',dc:15,damageOnSuccessfulSave:'none'}},
        }))
      }
      if (saveShape === 'periodic-repeat') use.occurrence = branch === 'unused' ? 2 : 1
      if (branch.startsWith('shield-')) {
        state.combatants.source.classSelections = {'spell-prepared':['shield']}
        attack.shieldSpellReaction = true
        attack.d20 = branch === 'shield-hit' ? 18 : 10
        if (branch !== 'shield-hit') { attack.damage.rolls = []; attack.classDamageRolls = [] }
      }
      if (branch.startsWith('protection-')) {
        const protector = actor('protector', 1)
        protector.controller = 'dm'
        protector.hasShield = true
        protector.classSelections = {'fighting-style':['protection']}
        state.combatants.protector = protector
        state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('protector','source')] = 5
        attack.protectionReactionActorId = 'protector'
        attack.d20 = 18
        attack.d20Second = 2
        if (branch === 'protection-cancel') attack.mode = 'advantage'
        else {attack.damage.rolls = [];attack.classDamageRolls = []}
      }
      if (branch === 'dodge') {
        state.combatants.source.classId = 'rogue'
        state.combatants.source.level = 5
        state.combatants.source.classLevels = {rogue:5}
        attack.uncannyDodge = true
      }
      if (branch === 'inspiration') {
        state.combatants.hunter.classState.bardicInspirationDie = 6
        state.combatants.hunter.classState.bardicInspirationRoundsRemaining = 10
        attack.d20 = 5
        attack.bardicInspirationRoll = 3
      }
      if (branch === 'cutting-words') {
        const bard = actor('bard', 1)
        bard.classId = 'bard'; bard.subclassId = 'lore'; bard.level = 5; bard.classLevels = {bard:5}
        bard.classResources = {'dnd5e-bardic-inspiration':{current:3,max:4}}
        state.combatants.bard = bard
        attack.d20 = 8
        attack.cuttingWords = {bardId:'bard',roll:3,distanceFeet:5}
        attack.damage.rolls = []; attack.classDamageRolls = []
      }
      if (saveShape === 'terminal-facade') {
        state.combatants.source.statBlockId = 'srd-5.1:sea-hag'
        state.combatants.hunter.conditions = [...state.combatants.hunter.conditions, 'frightened']
        state.combatants.hunter.classState.activeEffects!.push(createDnd5eConditionEffect({
          condition:'frightened',source:{kind:'monster',actorId:'source'},targetId:'hunter',
        }))
        use.ability = 'wis'
        attack.mode = 'disadvantage'
        attack.d20Second = attack.d20
      }
      if (branch === 'bridge-cost') state.combatants.source.turn.actionAvailable = false
      if (saveShape === 'registered-projectile') use.occurrence = 1
      if (branch.startsWith('multi-')) {
        const other = structuredClone(state.combatants.hunter)
        other.id = 'bystander'
        other.name = 'Second hunter'
        for (const effect of other.classState.activeEffects ?? []) {
          effect.id = `bystander-${effect.id}`
          effect.source.actorId = 'bystander'
        }
        state.combatants.bystander = other
      }
      if (branch.startsWith('wing-next-')) {
        const next = structuredClone(state.combatants.hunter)
        next.id = 'bystander'
        for (const effect of next.classState.activeEffects ?? []) {
          effect.id = `next-${effect.id}`
          effect.source.actorId = next.id
        }
        state.combatants.bystander = next
        state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('source','bystander')] = 5
        if (branch === 'wing-next-lethal') state.combatants.source.currentHp = 1
        expect(dnd5eSavingThrowCounterattackOptions(state,'bystander','source')).toHaveLength(1)
        const preview = previewDnd5eSavingThrowCounterattack(state,use)!
        expect(preview.hit).toBe(true)
        expect(preview.state.combatants.source.currentHp).toBe(branch === 'wing-next-lethal' ? 0 : 44)
        expect(dnd5eSavingThrowCounterattackOptions(preview.state,'bystander','source'))
          .toHaveLength(branch === 'wing-next-lethal' ? 0 : 1)
      }
      if (branch.startsWith('effect-')) {
        const effect = createDnd5eMechanicalEffect({id:'counter-die',definitionId:'counter-die',label:'Counter die',
          source:{kind:'spell',actorId:'source'},targetId:'hunter',
          modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:branch==='effect-subtract'?'subtract':'add',appliesTo:['attack']}]}})
        state.combatants.hunter.classState.activeEffects!.push(effect)
        use.effectDiceEventId = 'counter-effect-test'
        const recipes = dnd5eRollDiceRecipes({actorId:'hunter',effects:state.combatants.hunter.classState.activeEffects,kind:'attack',
          eventId:dnd5eRollDiceOccurrenceId(use.effectDiceEventId,'hunter','attack',0)})
        attack.effectRollDice = Object.fromEntries(recipes.map(recipe=>[recipe.id,[3]]))
        attack.d20 = branch==='effect-subtract'?8:6
        if (branch==='effect-subtract') {attack.damage.rolls=[];attack.classDamageRolls=[]}
        if (branch==='effect-missing') attack.effectRollDice={}
        if (branch==='effect-extra') attack.effectRollDice={...attack.effectRollDice,unexpected:[3]}
        if (branch==='effect-stale') effect.appliedAt=(effect.appliedAt??0)+1
        if (branch==='effect-no-event') delete use.effectDiceEventId
      }
      if (branch.startsWith('post-')) {
        const reactor=structuredClone(state.combatants.hunter)
        reactor.id='adjuster';reactor.name='Adjuster';reactor.classState.activeEffects=[]
        reactor.pluginFeatureIds=['test.counter:hunter.adjust']
        state.combatants.adjuster=reactor
        state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('adjuster','hunter')]=5
        attack.postD20Adjustment={sourceId:'adjuster',featureId:'test.counter:hunter.adjust',direction:branch==='post-add'?'add':'subtract',roll:3}
        if(branch==='post-spent') reactor.turn.reactionAvailable=false
        if(branch==='post-self') {
          state.combatants.hunter.pluginFeatureIds=[...state.combatants.hunter.pluginFeatureIds,'test.counter:hunter.adjust']
          attack.postD20Adjustment.sourceId='hunter'
          expect(dnd5ePostD20AdjustmentPreviewModifier({state,affectedId:'hunter',targetId:'source',attackMode:'melee',rollKind:'attack',use:attack.postD20Adjustment})).toBe(-3)
        }
        attack.d20=branch==='post-add'?6:8
        if(branch==='post-subtract'){attack.damage.rolls=[];attack.classDamageRolls=[]}
      }
      if(branch.startsWith('negate-')) {
        state.combatants.hunter.pluginFeatureIds=[...state.combatants.hunter.pluginFeatureIds,'test.counter:hunter.negate']
        state.combatants.hunter.classResources['dnd5e-ki']={current:branch==='negate-empty'?1:3,max:3}
        attack.mode=branch==='negate-normal'?'normal':'disadvantage'
        attack.d20=18;attack.d20Second=1
        if(branch==='negate-invalid-damage') attack.damage.rolls=[7]
        use.disadvantageNegationChoice={featureId:'test.counter:hunter.negate',rollId:'counter-negate',transactionId:'counter-transaction'}
      }
      if (branch.startsWith('ward-')) {
        state.combatants.source.classState.tranquilityActive = true
        if (branch !== 'ward-missing') attack.tranquilitySave = {d20: branch === 'ward-pass' ? 20 : branch === 'ward-invalid' ? 21 : 1}
        if (branch === 'ward-fail') { attack.d20 = 0; attack.damage.rolls = []; attack.classDamageRolls = [] }
      }
      if (branch.startsWith('attempt-')) {
        const effect = createDnd5eMechanicalEffect({definitionId:'test-attack-ward',label:'Attack ward',targetId:'source',
          source:{kind:'feature',actorId:'source'},attackAttemptWard:{ability:'wis',dc:10,frequency:'once-per-turn',onFailure:'cannot-target-this-turn'}})
        state.combatants.source.classState.activeEffects = [...state.combatants.source.classState.activeEffects ?? [],effect]
        if (branch !== 'attempt-missing') attack.attackAttemptWardSaves = [{effectId:effect.id,d20:branch==='attempt-fail'?1:branch==='attempt-invalid'?21:20}]
        if (branch === 'attempt-fail') {attack.d20=0;attack.damage.rolls=[];attack.classDamageRolls=[]}
        if (branch === 'attempt-invalid-damage') attack.damage.rolls=[7]
      }
      if (branch.startsWith('area-')) {
        const owner=actor('area-owner',1)
        state.combatants[owner.id]=owner
        const sourceId=branch==='area-self'?'hunter':owner.id
        state.combatants.source.persistentAreaAttackAdvantageSources=[{areaId:'test-hawk',sourceId}]
        attack.areaAttackAdvantageReaction={areaId:'test-hawk',sourceId}
        attack.d20=2;attack.d20Second=18
        if(branch==='area-spent')owner.turn.reactionAvailable=false
        if(branch==='area-invalid-damage')attack.damage.rolls=[7]
      }
      const before = structuredClone(state)
      if (branch === 'shield-resource-conflict') {
        const preview = previewDnd5eSavingThrowCounterattack(state, use)
        expect(preview?.hit).toBe(false)
        expect(preview?.state.combatants.source.classResources['dnd5e-spell-slot-1'].current).toBe(0)
        expect(preview?.state.combatants.source.turn.reactionAvailable).toBe(false)
        expect(state).toEqual(before)
      }
      if (branch === 'hit' || branch === 'miss' || branch === 'wrapped') {
        const preview = previewDnd5eSavingThrowCounterattack(state, use)
        expect(preview?.hit).toBe(branch !== 'miss')
        expect(preview?.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(state).toEqual(before)
      }
      let result = resolveDnd5eHeadlessAction(state, saveShape === 'gaze' ? {
        type: 'begin-turn', actorId: 'hunter',
        turnStartGazeResolutions: dnd5eTurnStartGazeRequirements(state, 'hunter').map(requirement => ({
          sourceId: requirement.sourceId, targetId: requirement.targetId, ruleId: requirement.ruleId,
          sourceUsesGaze: true, choice: 'face-gaze', save: {d20: branch === 'miss' ? 1 : 0},
        })),
        savingThrowCounterattacks: branch === 'forged-zero' ? undefined : branch === 'duplicate' ? [use, use] : [use],
      } : saveShape === 'periodic-repeat' ? {
        type: 'end-turn', actorId: 'hunter', deferNextTurnStart: true,
        activeEffectPeriodicDamageRolls: [{targetId:'hunter',effectId:state.combatants.hunter.classState.activeEffects!.find(effect=>effect.definitionId==='periodic-test')!.id,rolls:[3],d20:1}],
        activeEffectSavingThrows: [{targetId:'hunter',effectId:state.combatants.hunter.classState.activeEffects!.find(effect=>effect.definitionId==='repeat-test')!.id,d20:branch==='miss'||branch==='shield-block'||branch==='cutting-words'||branch==='protection-block'||branch==='effect-subtract'||branch==='post-subtract'||branch==='ward-fail'||branch==='attempt-fail'?1:0}],
        savingThrowCounterattacks:branch==='forged-zero'?undefined:branch==='duplicate'?[use,use]:[use],
      } : saveShape === 'periodic' ? {
        type:'end-turn',actorId:'hunter',deferNextTurnStart:true,
        activeEffectPeriodicDamageRolls:[{targetId:'hunter',effectId:state.combatants.hunter.classState.activeEffects!.find(effect=>effect.definitionId==='periodic-test')!.id,rolls:[3],d20:branch==='miss'||branch==='shield-block'||branch==='cutting-words'||branch==='protection-block'||branch==='effect-subtract'||branch==='post-subtract'||branch==='ward-fail'||branch==='attempt-fail'?1:0}],
        savingThrowCounterattacks:branch==='forged-zero'?undefined:branch==='duplicate'?[use,use]:[use],
      } : saveShape.startsWith('repeat') ? {
        type: saveShape === 'repeat-start' ? 'begin-turn' : 'end-turn', actorId: 'hunter', deferNextTurnStart: true,
        ...(saveShape === 'repeat-start' ? {turnStartActiveEffectSavingThrows: [{targetId:'hunter',effectId:state.combatants.hunter.classState.activeEffects!.find(effect=>effect.definitionId==='repeat-test')!.id,d20:branch==='miss'||branch==='shield-block'||branch==='cutting-words'||branch==='protection-block'||branch==='effect-subtract'||branch==='post-subtract'||branch==='ward-fail'||branch==='attempt-fail'?1:0}]} : {activeEffectSavingThrows: [{targetId:'hunter',effectId:state.combatants.hunter.classState.activeEffects!.find(effect=>effect.definitionId==='repeat-test')!.id,d20:branch==='miss'||branch==='shield-block'||branch==='cutting-words'||branch==='protection-block'||branch==='effect-subtract'||branch==='post-subtract'||branch==='ward-fail'||branch==='attempt-fail'?1:0}]}),
        savingThrowCounterattacks: branch === 'forged-zero' ? undefined : branch === 'duplicate' ? [use,use] : [use],
      } : saveShape === 'wing' ? {
        type: 'monster-adjudicated-action', actorId: 'source', actionId: wing.id, legendary: true, effects: [],
        targetSavingThrows: [{targetId:'hunter',d20:branch === 'miss' ? 1 : 0},...(branch.startsWith('wing-next-') ? [{targetId:'bystander',d20:20}] : [])],
        damageRolls: Array(wingRule.damage.count).fill(1),
        savingThrowCounterattacks: branch === 'forged-zero' ? undefined : branch === 'duplicate' ? [use,use] : [use],
      } : saveShape.startsWith('special') ? {
        type:'monster-special-action',actorId:'source',targetId:'hunter',actionId:'dreadful-glare',
        d20:branch === 'miss' ? 1 : 0,
        savingThrowCounterattacks:branch === 'forged-zero' ? undefined : branch === 'duplicate' ? [use,use] : [use],
      } : saveShape.startsWith('monster') ? {
        type: 'monster-action', actorId: 'source', actionId: claws.id,
        rolls: [{ targetId: 'hunter', d20: 18, damageRolls: [[2, 2]],
          onHitEffectRolls: claws.attack!.onHitEffects!.map(effect => ({effectId: effect.id, d20: branch === 'miss' ? 1 : 0})) }],
        savingThrowCounterattacks: branch === 'duplicate' ? [use, use] : [use],
      } : saveShape.startsWith('activity') ? {
        type: 'plugin', pluginId: 'test.counter', actionId: activity.id, featureId: 'test.counter:save-test',
        actorId: 'source', targetId: 'hunter', targetIds: ['hunter'], distanceFeet: 5,
        rolls: saveShape === 'activity-dependent' ? { 'attack:hunter':{values:[branch==='prerequisite-miss'?1:18],modifier:0,total:branch==='prerequisite-miss'?1:18}, ...(branch==='miss'?{'save-d20:hunter':{values:[1],modifier:0,total:1}}:{}) } : branch === 'hit' || branch === 'wrapped' || branch === 'forged-no-dice' || branch === 'choice-save' || branch === 'lethal-source' ? {} :
          { 'save-d20:hunter': { values: [1], modifier: 0, total: 1 } },
        savingThrowCounterattacks: branch.startsWith('forged-') ? undefined : branch === 'duplicate' ? [use, use] : [use],
        payload: branch.startsWith('forged-') ? { weaponCounterattackSuccessCheckKeys: ['save:hunter'] } :
          branch === 'willing-save' ? { activityWillingTargetIds: ['hunter'] } :
          branch === 'inactive-check' ? { activityChoices: { mode: 'off' } } : undefined,
      } : {
        type: 'cast-spell', actorId: 'source', targetId: 'hunter',
        targetIds: saveShape === 'targets' ? ['hunter', 'bystander'] : ['hunter'],
        spellId: 'burning-hands', slotLevel: 1, effectRolls: [4, 4, 4],
        ...(saveShape === 'single'
          ? { savingThrowD20: branch === 'hit' || branch === 'wrapped' ? 0 : 1 }
          : { targetSavingThrows: [
            { targetId: 'hunter', d20: branch === 'hit' || branch === 'wrapped' ? 0 : 1 },
            { targetId: 'bystander', d20: 1 },
          ] }),
        savingThrowCounterattacks: branch === 'duplicate' ? [use, use] : [use],
      })
      if (saveShape === 'monster-facade' || saveShape === 'special-facade' || saveShape === 'terminal-facade') {
        const map: BattleMap = { id: 'counter-map', name: 'Counter', width: 100, height: 100,
          gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
          tokens: Object.keys(state.combatants).map((id, index) => ({ id, label: id, type: 'enemy',
            poolId: state.combatants.source.statBlockId, dnd5eSide: index === 0 ? 'enemy' : 'player', x: 5 + index * 10, y: 5, hp: 50, maxHp: 50,
            color: '', emoji: '', size: 1 })) }
        if (saveShape === 'special-facade' || saveShape === 'terminal-facade') {
          const prepared = prepareDnd5eMonsterSpecialAction({ combatId: state.combatId, map, characters: [],
            initiativeOrder: map.tokens.map((token, index) => ({tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:20-index})),
            actorTokenId: 'source', targetTokenId: 'hunter', actionId: saveShape === 'terminal-facade' ? 'death-glare' : 'dreadful-glare' })
          expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true)
          if (!prepared.ok) return
          prepared.prepared.state = state
          result = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared,
            savingThrow: { d20: branch === 'miss' ? 1 : 0 },
            savingThrowCounterattacks: branch === 'forged-zero' ? undefined : branch === 'duplicate' ? [use, use] : [use],
          }).result
        } else {
        const prepared = prepareDnd5eMonsterAttack({ combatId: state.combatId, map, characters: [],
          initiativeOrder: map.tokens.map((token, index) => ({tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:20-index})),
          actorTokenId: 'source', targetTokenId: 'hunter', actionIndex: ghoul.actions.indexOf(claws) })
        expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true)
        if (!prepared.ok) return
        prepared.prepared.state = state
        result = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
          rolls: [{ targetId: 'hunter', d20: 18, damageRolls: [[2, 2]],
            onHitEffectRolls: claws.attack!.onHitEffects!.map(effect => ({ effectId: effect.id,
              d20: branch === 'miss' ? 1 : 0 })) }],
          savingThrowCounterattacks: branch === 'duplicate' ? [use, use] : [use],
        }).result
        }
      }
      if (saveShape === 'activity-sequential') {
        if (branch.startsWith('multi-')) {
          const firstUse = structuredClone(use)
          firstUse.targetId = 'bystander'
          firstUse.attack.actorId = 'bystander'
          firstUse.attack.classDamageRolls = [{source:'activity-effect-rider',rollId:`activity-on-hit:bystander-${mark.id}`,rolls:[4]}]
          if (branch === 'multi-first-miss') {
            firstUse.attack.d20 = 1
            firstUse.attack.classDamageRolls = []
          }
          result = resolveDnd5eHeadlessAction(state,{
            type:'plugin',pluginId:'test.counter',actionId:activity.id,featureId:'test.counter:save-test',
            actorId:'source',targetId:'bystander',targetIds:['bystander','hunter'],distanceFeet:5,
            rolls:branch === 'multi-first-miss' ? {'save-d20:bystander':{values:[1],modifier:0,total:1}} : {},
            savingThrowCounterattacks:branch === 'multi-reversed' ? [use,firstUse] : [firstUse,use],
          })
          expect(state).toEqual(before)
          expect(result.ok,JSON.stringify(result)).toBe(branch !== 'multi-first-miss')
          if (!result.ok) {expect(result.state).toEqual(before);expect(result.events).toEqual([]);return}
          expect(result.state.combatants.source.currentHp).toBe(38)
          for (const id of ['bystander','hunter']) {
            expect(result.state.combatants[id].currentHp).toBe(44)
            expect(result.state.combatants[id].turn.reactionAvailable).toBe(false)
          }
          expect(result.events.filter(event=>event.type==='attack-resolved').map(event=>event.actorId)).toEqual(['bystander','hunter'])
          return
        }
        const firstD20 = branch === 'sequence-stopped' ? 1 : 20
        result = resolveDnd5eHeadlessAction(state,{
          type:'plugin',pluginId:'test.counter',actionId:activity.id,featureId:'test.counter:save-test',
          actorId:'source',targetId:'bystander',targetIds:['bystander','hunter'],distanceFeet:5,
          rolls:{'save-d20:bystander':{values:[firstD20],modifier:0,total:firstD20},
            ...(branch === 'miss' ? {'save-d20:hunter':{values:[1],modifier:0,total:1}} : {})},
          savingThrowCounterattacks:[use],
        })
        expect(state).toEqual(before)
        expect(result.ok,JSON.stringify(result)).toBe(branch !== 'sequence-stopped')
        if (!result.ok) {expect(result.state).toEqual(before);expect(result.events).toEqual([]);return}
        expect(result.state.combatants.bystander.currentHp).toBe(44)
        expect(result.state.combatants.hunter.currentHp).toBe(branch === 'hit' ? 44 : 38)
        expect(result.state.combatants.source.currentHp).toBe(branch === 'hit' ? 44 : 50)
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        return
      }
      if (saveShape === 'bridge' || saveShape.startsWith('registered')) {
        const authority: Parameters<typeof resolveAndCommitDnd5eActivityCommand>[1] = {
          command:{schemaVersion:1 as const,commandId:'counter-bridge',packageId:'test.counter',packageVersion:'1.0.0',activityId:activity.id,
            actorId:'source',targetIds:['hunter'],expectedRevision:branch==='bridge-stale'?1:0},
          currentRevision:0,actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.source),
          targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.hunter)],distanceFeetByTargetId:{hunter:5},
          authoritativeRolls:branch==='bridge-prerequisite-miss'?{'attack:hunter':{values:[1]}}:branch!=='hit'?{'save-d20:hunter':{values:[1]}}:{},
          savingThrowCounterattacks:branch==='duplicate'?[use,use]:[use],
        }
        if (saveShape === 'registered-projectile') {
          authority.command = {...authority.command,projectileTargetIds:['hunter','hunter']}
          authority.authoritativeRolls = {
            'save-d20:projectile:0:hunter':{values:[1]},
            ...(branch === 'miss' ? {'save-d20:projectile:1:hunter':{values:[1]}} : {}),
          }
        }
        if (saveShape === 'registered-sequential') {
          authority.command = {...authority.command,targetIds:['bystander','hunter']}
          authority.authoritativeRolls = {
            'save-d20:bystander':{values:[branch === 'sequence-stopped' ? 1 : 20]},
            ...(branch === 'miss' ? {'save-d20:hunter':{values:[1]}} : {}),
          }
        }
        if (saveShape === 'registered-sequential' && branch.startsWith('multi-')) {
          const firstUse = structuredClone(use)
          firstUse.targetId = 'bystander'
          firstUse.attack.actorId = 'bystander'
          firstUse.attack.classDamageRolls = [{source:'activity-effect-rider',rollId:`activity-on-hit:bystander-${mark.id}`,rolls:[4]}]
          if (branch === 'multi-first-miss') {
            firstUse.attack.d20 = 1
            firstUse.attack.classDamageRolls = []
          }
          authority.authoritativeRolls = branch === 'multi-first-miss' ? {'save-d20:bystander':{values:[1]}} : {}
          authority.savingThrowCounterattacks = branch === 'multi-reversed' ? [use,firstUse] : [firstUse,use]
          const outcome = resolveRegisteredDnd5eActivityInCombatV1({...authority,state,combatRevision:0,confirmedBy:'actor'})
          expect(state).toEqual(before)
          if (branch === 'multi-first-miss') {
            expect(outcome.result.ok).toBe(false)
            if (outcome.phase === 'commit') {
              expect(outcome.result.state).toEqual(before)
              expect(outcome.result.events).toEqual([])
            }
            return
          }
          expect(outcome.phase,JSON.stringify(outcome.result)).toBe('commit')
          if (outcome.phase !== 'commit') throw Error('Expected committed counters')
          expect(outcome.result.ok,JSON.stringify(outcome.result)).toBe(true)
          expect(outcome.result.state.combatants.source.currentHp).toBe(38)
          for (const id of ['bystander','hunter']) {
            expect(outcome.result.state.combatants[id].currentHp).toBe(44)
            expect(outcome.result.state.combatants[id].turn.reactionAvailable).toBe(false)
          }
          expect(outcome.result.events.filter(event=>event.type==='attack-resolved').map(event=>event.actorId)).toEqual(['bystander','hunter'])
          return
        }
        const bridged = saveShape.startsWith('registered')
          ? resolveRegisteredDnd5eActivityInCombatV1({ ...authority, state, combatRevision: 0, confirmedBy: 'actor' })
          : resolveAndCommitDnd5eActivityCommand(state, authority)
        if (branch === 'shield-resource-conflict') expect(bridged.phase, JSON.stringify(bridged.result)).toBe('commit')
        if (bridged.phase !== 'commit') {
          expect(bridged.result.ok).toBe(false)
          expect(['hit','miss'].includes(branch), JSON.stringify(bridged.result)).toBe(false)
          expect(state).toEqual(before)
          return
        }
        if ((branch === 'bridge-cost' || branch === 'shield-resource-conflict') && !bridged.result.ok) expect(bridged.result.events).toEqual([])
        result = bridged.result
        if (saveShape === 'registered-sequential') {
          expect(state).toEqual(before)
          expect(result.ok,JSON.stringify(result)).toBe(true)
          expect(result.state.combatants.bystander.currentHp).toBe(44)
          expect(result.state.combatants.hunter.currentHp).toBe(branch === 'hit' ? 44 : 38)
          expect(result.state.combatants.source.currentHp).toBe(branch === 'hit' ? 44 : 50)
          expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
          return
        }
        if (saveShape === 'registered-projectile') {
          expect(state).toEqual(before)
          expect(result.ok, JSON.stringify(result)).toBe(true)
          expect(result.state.combatants.hunter.currentHp).toBe(branch === 'hit' ? 32 : 26)
          expect(result.state.combatants.source.currentHp).toBe(branch === 'hit' ? 44 : 50)
          expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
          expect(result.events.filter(event=>event.type==='saving-throw-counterattack-resolved')).toHaveLength(1)
          return
        }
      }
      expect(state).toEqual(before)
      if (branch.startsWith('wing-next-')) {
        expect(result.ok,JSON.stringify(result)).toBe(true)
        expect(result.state.combatants.source.currentHp).toBe(branch === 'wing-next-lethal' ? 0 : 44)
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.bystander.turn.reactionAvailable).toBe(true)
        expect(result.state.combatants.bystander.currentHp).toBe(50)
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'bystander',d20:20,success:true}))
        expect(result.events.filter(event=>event.type==='saving-throw-counterattack-resolved')).toHaveLength(1)
        return
      }
      if (branch.startsWith('area-')) {
        expect(result.ok,JSON.stringify(result)).toBe(branch==='area-valid')
        if(!result.ok){expect(result.state).toEqual(before);expect(result.events).toEqual([]);return}
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants['area-owner'].turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.source.currentHp).toBe(44)
        expect(result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',actorId:'hunter',d20:18,hit:true}))
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hunter',success:true}))
        return
      }
      if (branch.startsWith('attempt-')) {
        expect(result.ok,JSON.stringify(result)).toBe(branch==='attempt-pass'||branch==='attempt-fail')
        if (!result.ok) {expect(result.state).toEqual(before);expect(result.events).toEqual([]);return}
        const passed=branch==='attempt-pass'
        expect(result.state.combatants.source.currentHp).toBe(passed?44:50)
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.events.filter(event=>event.type==='attack-resolved')).toHaveLength(passed?1:0)
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hunter',ability:'wis',success:passed}))
        expect(result.state.combatants.source.classState.activeEffects?.find(effect=>effect.definitionId==='test-attack-ward')?.attackAttemptWardReceipts).toEqual([expect.objectContaining({attackerId:'hunter',success:passed})])
        expect(result.state.combatants.hunter.classState.activeEffects?.some(effect=>effect.definitionId==='repeat-test')).toBe(!passed)
        return
      }
      if (branch.startsWith('ward-')) {
        const accepted = branch === 'ward-pass' || branch === 'ward-fail'
        expect(result.ok, JSON.stringify(result)).toBe(accepted)
        if (!result.ok) { expect(result.state).toEqual(before); expect(result.events).toEqual([]); return }
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.source.currentHp).toBe(branch === 'ward-pass' ? 44 : 50)
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hunter',ability:'wis',success:branch === 'ward-pass'}))
        expect(result.events.filter(event=>event.type==='attack-resolved')).toHaveLength(branch === 'ward-pass' ? 1 : 0)
        expect(result.state.combatants.hunter.classState.activeEffects?.some(effect=>effect.definitionId==='repeat-test')).toBe(branch === 'ward-fail')
        return
      }
      if(branch.startsWith('negate-')) {
        expect(result.ok).toBe(branch==='negate-valid')
        if(!result.ok){expect(result.state).toEqual(before);expect(result.events).toEqual([]);return}
        expect(result.state.combatants.hunter.classResources['dnd5e-ki'].current).toBe(1)
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.source.currentHp).toBe(44)
        expect(result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',actorId:'hunter',hit:true}))
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hunter',success:true}))
        return
      }
      if (branch.startsWith('post-')) {
        if(branch==='post-spent'||branch==='post-self') {
          expect(result.ok).toBe(false)
          expect(result.state).toEqual(before)
          expect(result.events).toEqual([])
          return
        }
        expect(result.ok,JSON.stringify(result)).toBe(true)
        expect(result.state.combatants.adjuster.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.source.currentHp).toBe(branch==='post-add'?44:50)
        expect(result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',actorId:'hunter',hit:branch==='post-add'}))
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hunter',success:branch==='post-add'}))
        return
      }
      if (branch.startsWith('effect-')) {
        const accepted=branch==='effect-add'||branch==='effect-subtract'
        expect(result.ok,JSON.stringify(result)).toBe(accepted)
        if (!accepted) {expect(result.state).toEqual(before);expect(result.events).toEqual([]);return}
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.source.currentHp).toBe(branch==='effect-add'?44:50)
        expect(result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',actorId:'hunter',total:branch==='effect-add'?14:10,hit:branch==='effect-add'}))
        expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hunter',success:branch==='effect-add'}))
        return
      }
      expect(result.ok, result.ok ? '' : result.reason).toBe((['repeat-start', 'gaze'].includes(saveShape) && branch === 'spent') || ['shield-block','shield-hit','dodge','inspiration','cutting-words','protection-block','protection-cancel'].includes(branch) || branch === 'hit-bless' || branch === 'hit' || branch === 'wrapped' || branch === 'miss' || branch === 'forged-success' || branch === 'choice-save' || branch === 'lethal-source')
      if (!result.ok) { if (saveShape !== 'bridge' || 'state' in result) expect(result.state).toEqual(before); return }
      if (branch === 'forged-success') {
        expect(result.state.combatants.source.currentHp).toBe(50)
        expect(result.state.combatants.hunter.currentHp).toBe(38)
        expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(true)
        expect(result.events.some(event => event.type === 'saving-throw-counterattack-resolved')).toBe(false)
        return
      }
      const hit = branch !== 'miss' && branch !== 'shield-block' && branch !== 'cutting-words' && branch !== 'protection-block'
      if (saveShape.startsWith('special')) expect(result.state.combatants.hunter.conditions.includes('frightened')).toBe(!hit)
      expect(result.state.combatants.source.currentHp).toBe(branch === 'lethal-source' ? 0 : branch === 'dodge' ? 47 : hit ? 44 : 50)
      expect(result.state.combatants.hunter.currentHp).toBe(saveShape === 'terminal-facade' ? (hit ? 50 : 0) : saveShape === 'periodic-repeat' ? 47 : saveShape === 'periodic' ? (hit ? 50 : 47) : (saveShape.startsWith('repeat') || saveShape === 'gaze') ? 50 : saveShape === 'wing' ? (hit ? 50 : 50-wingRule.damage.count-wingRule.damage.bonus) : saveShape.startsWith('special') ? 50 : saveShape.startsWith('monster') ? 44 : hit ? 44 : 38)
      if (saveShape.startsWith('repeat')) expect(result.state.combatants.hunter.classState.activeEffects?.some(effect=>effect.definitionId==='repeat-test')).toBe(!hit)
      if (saveShape === 'wing') { expect(result.state.combatants.hunter.conditions.includes('prone')).toBe(!hit); expect(result.state.combatants.source.classState.monsterLegendaryActionPoints).toBe(3-(wing.legendaryCost ?? 1)) }
      if (saveShape === 'gaze') expect(result.state.combatants.hunter.conditions.includes('restrained')).toBe(!hit)
      if (saveShape.startsWith('monster')) expect(result.state.combatants.hunter.conditions.includes('paralyzed')).toBe(!hit)
      expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
      expect(result.state.combatants.hunter.turn.actionAvailable).toBe(true)
      if (saveShape === 'targets') {
        expect(result.state.combatants.bystander.currentHp).toBe(38)
        expect(result.events.find(e => e.type === 'saving-throw-resolved' && e.targetId === 'bystander'))
          .toMatchObject({ d20: 1, success: false })
      }
      if (saveShape === 'periodic-repeat') {
        expect(result.events.filter(event => event.type === 'saving-throw-resolved' && event.targetId === 'hunter')).toHaveLength(2)
        expect(result.events.find(event => event.type === 'saving-throw-resolved' && event.targetId === 'hunter')).toMatchObject({d20: 1, success: false})
        expect(result.state.combatants.hunter.classState.activeEffects!.some(effect => effect.definitionId === 'repeat-test')).toBe(!hit)
      }
      if (branch.startsWith('shield-') || branch === 'dodge') {
        expect(result.state.combatants.source.turn.reactionAvailable).toBe(false)
        if (branch.startsWith('shield-')) expect(result.state.combatants.source.classResources['dnd5e-spell-slot-1'].current).toBe(0)
        expect(result.state.combatants.hunter.classState.activeEffects!.some(effect => effect.definitionId === 'repeat-test')).toBe(!hit)
      }
      if (branch === 'inspiration') expect(result.state.combatants.hunter.classState.bardicInspirationDie).toBeUndefined()
      if (branch === 'cutting-words') {
        expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(2)
      }
      if (branch.startsWith('protection-')) expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
      const attackIndex = result.events.findIndex(e => e.type === 'attack-resolved')
      const saveIndex = result.events.findIndex((e, index) => index > attackIndex && e.type === 'saving-throw-resolved' && e.targetId === 'hunter')
      expect(attackIndex).toBeGreaterThanOrEqual(0); expect(saveIndex).toBeGreaterThan(attackIndex)
      const save = result.events[saveIndex]
      expect(save).toMatchObject({ success: hit })
      if (hit) expect(save).toMatchObject({ automaticOutcome: 'weapon-counterattack-success', d20: 0 })
    } finally { dispose(); registration.dispose() }
  },
)





