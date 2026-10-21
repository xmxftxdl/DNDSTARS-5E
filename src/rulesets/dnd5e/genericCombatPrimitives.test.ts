import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { validateDeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import {isTokenAlive,isTokenDefeated,decideTurnAction,checkCombatOutcome} from '../../lib/combatTokens'
import type {Token} from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from './character'
import { resolveDnd5eDamageDefenses } from './damageDefenses'
import {
  createDnd5eCombatant,
  applyDnd5eStandardConditionEffect,
  commitDnd5eActivityExecution,
  type Dnd5eAction,
  dnd5eCombatantPairKey,
  dnd5eDeclarativeCompanionProfileUpgrade,
  dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks,
  dnd5eDeclarativeEnvironmentalMovementSpeed,
  dnd5eWeaponClassDamageDefinitions,
  dnd5eSavingThrowRerollFeature,
  dnd5eSavingThrowRerollFeatures,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import {
  dnd5eAlternateResourceSpellsForCharacter,
  dnd5eEffectiveAttacksPerAttackAction,
  dnd5ePluginFeatureDefinition,
  registerDnd5eRulesPlugin,
} from './pluginApi'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 18, cha: 8 } as const

it('enumerates owned rerolls and rejects unavailable explicit selections without changing resources', () => {
  let featureId=''
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.reroll-options',name:'Rerolls',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    featureId=api.registerFeature({id:'focus',name:'Focus',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'focus',name:'Focus',description:'Synthetic',level:1,trigger:{kind:'after-d20-roll'},cost:{economy:'none'},targeting:{kind:'self'},effects:[],mechanic:{kind:'rage-saving-throw-reroll'},automation:'full'}})
  }})
  try {
    const hero=combatant('hero',20,{classId:'barbarian',level:15,classLevels:{barbarian:6,fighter:9},pluginFeatureIds:[featureId],classResources:{fighterIndomitable:{current:1,max:1}}})
    hero.classState.raging=true
    const before=structuredClone(hero)
    expect(dnd5eSavingThrowRerollFeatures(hero).map(option=>option.resourceKey)).toEqual([`rage-saving-throw-reroll:${featureId}`,'fighterIndomitable'])
    expect(dnd5eSavingThrowRerollFeature(hero,'fighterIndomitable')?.name).toBe('不屈')
    expect(dnd5eSavingThrowRerollFeature(hero,'unowned')).toBeUndefined()
    expect(hero).toEqual(before)
    hero.classResources.fighterIndomitable.current=0
    expect(dnd5eSavingThrowRerollFeature(hero,'fighterIndomitable')).toBeUndefined()
    hero.classState.declarativeUsedTurnKeys={[`rage-saving-throw-reroll:${featureId}`]:'used'}
    expect(dnd5eSavingThrowRerollFeatures(hero)).toEqual([])
  } finally {dispose()}
})

it('settles a per-rage failed-save reroll with the actual save mode and persists consumption', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({manifest:{id:'test.rage-save',name:'Save',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    featureId=api.registerFeature({id:'save',name:'Save',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{
      schemaVersion:1,id:'save',name:'Save',description:'Synthetic',level:1,trigger:{kind:'after-d20-roll'},cost:{economy:'none'},targeting:{kind:'self'},
      effects:[],mechanic:{kind:'rage-saving-throw-reroll'},automation:'full',
    }})
  }})
  try { for (const mode of ['normal','advantage','disadvantage'] as const) {
    const target=combatant('target',10,{controller:'dm',pluginFeatureIds:[featureId],savingThrowBonuses:{con:0}})
    target.classState.raging=true
    if(mode!=='normal')target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'save-mode',label:'Save mode',source:{kind:'plugin'},targetId:'target',
      modifiers: mode==='advantage'?{savingThrowAdvantages:['con']}:{savingThrowDisadvantages:['con']}})]
    expect(dnd5eSavingThrowMode(target,'con')).toBe(mode)
    const attacker=combatant('attacker',20,{classId:'monk',level:5,classResources:{'dnd5e-ki':{current:4,max:4}}})
    const state=startDnd5eHeadlessCombat('rage-save',[attacker,target])
    const action:Dnd5eAction={type:'attack',actorId:'attacker',targetId:'target',spendAction:false,attackModifier:20,d20:10,
      stunningStrikeSaveD20:1,stunningStrikeSaveRerollD20:20,...(mode==='normal'?{}:{stunningStrikeSaveD20Second:2,stunningStrikeSaveRerollD20Second:3}),
      classDamageContext:{mode:'melee',finesse:false,strengthBased:true,weaponDamageSides:6,damageType:'bludgeoning',adjacentEnemyOfTarget:false,stunningStrike:true},
      damage:{count:1,sides:6,bonus:0,rolls:[3],type:'bludgeoning'}}
    const result=resolveDnd5eHeadlessAction(state,action)
    expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true)
    if(!result.ok)continue
    expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'target',d20:mode==='disadvantage'?3:20,success:mode!=='disadvantage'}))
    const restored=JSON.parse(JSON.stringify(result.state))
    expect(dnd5eSavingThrowRerollFeature(restored.combatants.target)).toBeUndefined()
    expect(restored.combatants.target.turn.reactionAvailable).toBe(target.turn.reactionAvailable)
    expect(resolveDnd5eHeadlessAction(restored,action).ok).toBe(false)
  }}finally{dispose()}
})

it('gates a raging own-turn creature weapon rider and evaluates class-level bonus', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({manifest:{id:'test.rage-rider',name:'Rider',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    featureId=api.registerFeature({id:'rider',name:'Rider',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{
      schemaVersion:1,id:'rider',name:'Rider',description:'Synthetic',level:3,trigger:{kind:'after-attack-hit'},targeting:{kind:'single-creature',relation:'any'},
      rolls:[{id:'extra',kind:'damage',label:'Extra',dice:{count:1,sides:6,modifier:{kind:'class-level',classId:'barbarian',divisor:2,minimum:0}},damageType:'radiant'}],
      effects:[],limits:{oncePerTurn:true},mechanic:{kind:'weapon-damage-rider',rollId:'extra',requiresRage:true,ownTurnOnly:true,creaturesOnly:true},automation:'full',
    }})
  }})
  try {
    for(const mode of ['allowed','not-raging','other-turn','object'] as const){
      const actor=combatant('actor',30,{pluginFeatureIds:[featureId],classLevels:{barbarian:5,fighter:10}})
      actor.classState.raging=mode!=='not-raging'
      const target=combatant('target',20,{controller:'dm',...(mode==='object'?{objectDamageThreshold:0}:{})})
      const state=startDnd5eHeadlessCombat('rider',[actor,target]);if(mode==='other-turn')state.initiativeIndex=1
      const context={mode:'melee' as const,finesse:false,strengthBased:true,weaponDamageSides:8,damageType:'slashing' as const,adjacentEnemyOfTarget:false}
      const definitions=dnd5eWeaponClassDamageDefinitions({state,actorId:'actor',targetId:'target',context,critical:false}).filter(d=>d.featureId===featureId)
      expect(definitions,mode).toHaveLength(mode==='allowed'?1:0)
      if(mode==='allowed'){
        expect(definitions[0]).toMatchObject({count:1,sides:6,bonus:2,type:'radiant',doubleOnCritical:true})
        const hit=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'actor',targetId:'target',attackModifier:20,d20:10,damage:{count:1,sides:8,bonus:0,rolls:[4],type:'slashing'},classDamageContext:context,classDamageRolls:[{source:'weapon-damage-rider',rolls:[3]}]})
        expect(hit.ok).toBe(true)
        if(hit.ok){
          expect(hit.state.combatants.target.currentHp).toBe(31)
          const restored=JSON.parse(JSON.stringify(hit.state))
          expect(dnd5eWeaponClassDamageDefinitions({state:restored,actorId:'actor',targetId:'target',context,critical:false}).some(d=>d.featureId===featureId)).toBe(false)
        }
      }
    }
  }finally{dispose()}
})

function testCharacter(pluginFeatureIds: string[]): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'generic-primitives-character',
    name: 'Generic Primitives Character',
    player: '',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: '牧师',
    dnd5eClassLevels: { cleric: 14 },
    level: 14,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { ...abilities },
    savingThrows: ['wis', 'cha'],
    skills: [],
    maxHp: 80,
    currentHp: 80,
    tempHp: 0,
    hitDice: '14d8',
    ac: 18,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 16,
    passivePerception: 14,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5ePluginFeatureIds: pluginFeatureIds,
  }
}

function combatant(
  id: string,
  initiative: number,
  patch: Record<string, unknown> = {},
) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 3,
    armorClass: 14,
    currentHp: 40,
    maxHp: 40,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}


it('ends deferred rage death only when independent unconsciousness actually takes effect', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({manifest:{id:'test.rage-death',name:'Death boundary',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    featureId=api.registerFeature({id:'defer',name:'Defer',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{
      schemaVersion:1,id:'defer',name:'Defer',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'none'},targeting:{kind:'self'},
      effects:[],mechanic:{kind:'rage-death-deferral'},automation:'full',
    }})
  }})
  try {
  for(const pending of [false,true])for(const mode of ['active','not-raging','unowned','confirmed-dead','exhausted'] as const){
    const hero=testCharacter(mode==='unowned'?[]:[featureId]);hero.currentHp=0;hero.deathSaveFailures=pending?3:0
    hero.dnd5eCombatState={raging:mode!=='not-raging',...(pending?{declarativeUsedTurnKeys:{'rage-deferred-death':'pending'}}:{}),...(mode==='confirmed-dead'?{deathRound:1}:{})}
    if(mode==='exhausted')hero.exhaustionLevel=6
    const token={id:'hero',characterId:hero.id,type:'player',hp:0,maxHp:80} as Token
    expect(isTokenAlive(token,[hero])).toBe(mode==='active')
    expect(isTokenDefeated(token,[hero],{hp:0,max:80})).toBe(mode!=='active')
    if(mode==='active'){
      expect(decideTurnAction(token,[hero])).toBe('player')
      expect(checkCombatOutcome([token,{id:'foe',type:'enemy',hp:10,maxHp:10} as Token],[hero])).toEqual({ended:false})
    }
  }
  for (const pending of [false,true]) for (const mode of ['active','immune','suspended'] as const) {
    const target=combatant('target',10,{currentHp:0,pluginFeatureIds:[featureId],conditionImmunities:mode==='immune'?['unconscious']:[]})
    target.classState.raging=true
    target.classState.rageTurnsRemaining=5
    target.deathSaves={successes:0,failures:pending?3:0,stable:false,dead:false}
    if(pending)target.classState.declarativeUsedTurnKeys={'rage-deferred-death':'pending'}
    if(mode==='suspended')target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'suspender',label:'Suspender',source:{kind:'plugin'},targetId:target.id,modifiers:{}})]
    const applied=applyDnd5eStandardConditionEffect(target,undefined,{
      rulesId:'independent-unconsciousness',condition:'unconscious',duration:{type:'permanent'},
      ...(mode==='suspended'?{suspendWhileEffectId:'suspender'}:{}),
    },[])
    expect(applied).toBe(mode!=='immune')
    expect(target.classState.raging===true).toBe(mode!=='active')
    expect(target.deathSaves.dead).toBe(mode==='active'&&pending)
    expect(target.conditions.includes('unconscious')).toBe(mode==='active')
  }
  for(const pending of [false,true]){
    const target=combatant('target',10,{currentHp:0,pluginFeatureIds:[featureId]})
    target.classState.raging=true;target.classState.rageTurnsRemaining=5
    target.deathSaves={successes:0,failures:pending?3:0,stable:false,dead:false}
    if(pending)target.classState.declarativeUsedTurnKeys={'rage-deferred-death':'pending'}
    const caster=combatant('caster',20,{classId:'wizard',level:3,classSelections:{'spell-prepared':['sleep']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}}})
    const result=resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('sleep-deferred',[caster,target]),{
      type:'cast-spell',actorId:'caster',targetId:'target',spellId:'sleep',slotLevel:1,effectRolls:[4,4,4,4,4],
    })
    expect(result.ok).toBe(true)
    if(!result.ok)continue
    expect(result.state.combatants.target.classState.raging).not.toBe(true)
    expect(result.state.combatants.target.deathSaves.dead).toBe(pending)
    expect(result.events).toContainEqual(expect.objectContaining({type:'sleep-resolved',affectedTargetIds:['target']}))
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  }}finally{dispose()}
})

describe('generic declarative combat primitives', () => {
  it('applies imported condition save advantage only to the owned feature and matching condition', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.condition-save', name: 'Condition save', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      featureId = api.registerFeature({ id: 'defense', name: 'Defense', summary: 'Synthetic.', description: 'Synthetic.', automation: 'full', declarativeAbility: {
        schemaVersion: 1, id: 'defense', name: 'Defense', description: 'Synthetic.', level: 1,
        trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        mechanic: { kind: 'passive-defense', savingThrowAdvantageAgainstConditions: ['poisoned'] },
      } })
    } })
    try {
      const hero = testCharacter([featureId])
      const projected = migrateCharacterToDnd5e(hero)
      expect(dnd5eSavingThrowMode(projected, 'con', { condition: 'poisoned' })).toBe('advantage')
      expect(dnd5eSavingThrowMode(projected, 'con', { condition: '中毒' })).toBe('advantage')
      expect(dnd5eSavingThrowMode(projected, 'wis', { condition: 'frightened' })).toBe('normal')
      expect(dnd5eSavingThrowMode(projected, 'con', { damageType: 'poison' })).toBe('normal')
      expect(projected.conditionImmunities).not.toContain('poisoned')
      const token = createCombatantFromDnd5eCharacter({ character: projected, controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
      const state = startDnd5eHeadlessCombat('condition-defense', [token])
      expect(dnd5eSavingThrowMode(state.combatants[token.id], 'con', { condition: 'poisoned' })).toBe('advantage')
      const removed = migrateCharacterToDnd5e(testCharacter([]))
      expect(dnd5eSavingThrowMode(removed, 'con', { condition: 'poisoned' })).toBe('normal')
    } finally { dispose() }
  })
  it.each(['enemy', 'ally', 'any'] as const)('enforces the imported %s weapon rider relation against the actual attack target', (relation) => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({ manifest: {
      id: `test.rider-relation-${relation}`, name: 'Rider relation', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0',
    }, setup(api) {
      featureId = api.registerFeature({ id: 'rider', name: 'Rider', summary: 'Synthetic.', description: 'Synthetic.', automation: 'full', declarativeAbility: {
        schemaVersion: 1, id: 'rider', name: 'Rider', description: 'Synthetic.', level: 1,
        trigger: { kind: 'after-attack-hit' }, targeting: { kind: 'single-creature', relation },
        rolls: [{ id: 'extra', kind: 'damage', label: 'Extra', dice: { count: 1, sides: 6 }, damageType: 'fire' }],
        effects: [], mechanic: { kind: 'weapon-damage-rider', rollId: 'extra' }, automation: 'full',
      } })
    } })
    try {
      for (const controller of ['player', 'dm'] as const) {
        const actor = combatant('actor', 30, { pluginFeatureIds: [featureId] })
        const target = combatant('target', 20, { controller })
        const state = startDnd5eHeadlessCombat('rider-relation', [actor, target])
        const context = { mode: 'melee' as const, finesse: false, strengthBased: true, weaponDamageSides: 8, damageType: 'slashing' as const, adjacentEnemyOfTarget: false }
        const allowed = relation === 'any' || (relation === 'ally') === (controller === 'player')
        const definitions = dnd5eWeaponClassDamageDefinitions({ state, actorId: actor.id, targetId: target.id, context, critical: false })
        expect(definitions.some(entry => entry.featureId === featureId)).toBe(allowed)
        const result = resolveDnd5eHeadlessAction(state, {
          type: 'attack', actorId: actor.id, targetId: target.id, attackModifier: 20, d20: 10,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' }, classDamageContext: context,
          classDamageRolls: allowed ? [{ source: 'weapon-damage-rider', rolls: [3] }] : [],
        })
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.state.combatants[target.id].currentHp).toBe(40 - 4 - (allowed ? 3 : 0))
      }
    } finally { dispose() }
  })
  it('keeps an animated-creature order across attacks and turn ends, and rejects another caster', () => {
    const owner=combatant('owner',30)
    const companion=combatant('companion',20,{summonedSourceCombatantId:'owner',summonedCommandPolicy:'persistent-order',summonedSourceActivityId:'animate'})
    const enemy=combatant('enemy',10,{controller:'dm',position:{x:5,y:0}})
    const state=startDnd5eHeadlessCombat('persistent-order',[owner,companion,enemy])
    const request={actorId:'owner',activityId:'order',targetIds:['companion'],source:{kind:'spell' as const,id:'animate'},resolution:{ok:true as const,status:'resolved' as const,checks:[],consumptions:[{kind:'action-economy' as const,economy:'bonus-action' as const,amount:1 as const,consumeOn:'resolve' as const}],proposals:[{kind:'command-owned-companion' as const,operationId:'order',targetId:'companion',sourceActivityId:'animate',command:'attack' as const}]}}
    expect(commitDnd5eActivityExecution(state,{...request,actorId:'enemy'}).ok).toBe(false)
    const issued=commitDnd5eActivityExecution(state,request)
    expect(issued.ok).toBe(true)
    if(!issued.ok)return
    expect(issued.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
    issued.state.initiativeIndex=1
    const attack=resolveDnd5eHeadlessAction(issued.state,{type:'attack',actorId:'companion',targetId:'enemy',attackModifier:20,d20:10,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'piercing'}})
    expect(attack.ok).toBe(true)
    if(!attack.ok)return
    expect(attack.state.combatants.companion.classState.companionCommand).toMatchObject({persistentOrder:true,command:'attack'})
    const end=resolveDnd5eHeadlessAction(attack.state,{type:'end-turn',actorId:'companion'})
    expect(end.ok).toBe(true)
    if(end.ok)expect(end.state.combatants.companion.classState.companionCommand?.command).toBe('attack')
  })
  it('opens signed reaction-attack windows for nearby spell casts and enemy attacks against allies', () => {
    let sentinelFeatureId = ''
    let mageSlayerFeatureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.feat-reaction-windows', name: 'Feat Reaction Windows', version: '1.0.0',
        apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        sentinelFeatureId = api.registerFeature({
          id: 'sentinel', name: 'Sentinel', summary: 'Test.', description: 'Test.', automation: 'partial',
          declarativeAbility: {
            schemaVersion: 1, id: 'sentinel', name: 'Sentinel', description: 'Test.', level: 1,
            trigger: { kind: 'after-attack-roll' }, cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 }, effects: [],
            mechanic: { kind: 'reaction-weapon-attack', event: 'enemy-attacks-other' }, automation: 'full',
          },
        })
        mageSlayerFeatureId = api.registerFeature({
          id: 'mage-slayer', name: 'Mage Slayer', summary: 'Test.', description: 'Test.', automation: 'partial',
          declarativeAbility: {
            schemaVersion: 1, id: 'mage-slayer', name: 'Mage Slayer', description: 'Test.', level: 1,
            trigger: { kind: 'after-spell-cast' }, cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 }, effects: [],
            mechanic: { kind: 'reaction-weapon-attack', event: 'nearby-creature-casts-spell' }, automation: 'full',
          },
        })
      },
    })
    try {
      const enemy = combatant('enemy-attacker', 30, { controller: 'dm', position: { x: 5, y: 0 } })
      const ally = combatant('protected-ally', 20, { position: { x: 0, y: 0 } })
      const sentinel = combatant('sentinel-reactor', 10, {
        position: { x: 10, y: 0 }, pluginFeatureIds: [sentinelFeatureId],
      })
      const sentinelState = startDnd5eHeadlessCombat('sentinel-window', [enemy, ally, sentinel])
      sentinelState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(sentinel.id, enemy.id)]: 5,
      }
      const attacked = resolveDnd5eHeadlessAction(sentinelState, {
        type: 'attack', actorId: enemy.id, targetId: ally.id, attackModifier: 5, d20: 2,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      })
      expect(attacked.ok).toBe(true)
      if (!attacked.ok) return
      expect(attacked.state.combatants[sentinel.id].classState
        .declarativeReactionWeaponAttackOpportunities?.[sentinelFeatureId]).toMatchObject({
        targetId: enemy.id, triggerActorId: enemy.id, round: 1,
      })

      const caster = combatant('enemy-caster', 30, {
        controller: 'dm', classId: 'wizard', classLevels: { wizard: 1 },
        classSelections: { 'spell-prepared': ['magic-missile'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
      })
      const mageSlayer = combatant('mage-slayer-reactor', 20, {
        pluginFeatureIds: [mageSlayerFeatureId],
      })
      const spellTarget = combatant('spell-target', 10)
      const mageState = startDnd5eHeadlessCombat('mage-slayer-window', [caster, mageSlayer, spellTarget])
      mageState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(mageSlayer.id, caster.id)]: 5,
      }
      const cast = resolveDnd5eHeadlessAction(mageState, {
        type: 'cast-spell', actorId: caster.id, targetId: spellTarget.id, targetIds: [spellTarget.id],
        projectileTargetIds: [spellTarget.id, spellTarget.id, spellTarget.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1],
      })
      expect(cast.ok).toBe(true)
      if (!cast.ok) return
      expect(cast.state.combatants[mageSlayer.id].classState
        .declarativeReactionWeaponAttackOpportunities?.[mageSlayerFeatureId]).toMatchObject({
        targetId: caster.id, triggerActorId: caster.id, round: 1,
      })
    } finally {
      dispose()
    }
  })

  it('derives environmental movement only from the authoritative scene tag', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.environmental-movement', name: 'Environmental Movement Test', version: '1.0.0',
        apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'outdoor-flight', name: 'Outdoor Flight', summary: 'Test.', description: 'Test.', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'outdoor-flight', name: 'Outdoor Flight', description: 'Test.', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'environmental-movement', environments: ['outdoors'], mode: 'fly', speed: 'walking' },
            automation: 'full',
          },
        })
      },
    })
    try {
      const actor = combatant('environmental-flyer', 20, { speed: 35, pluginFeatureIds: [featureId] })
      expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor, 'outdoors', 'fly')).toBe(35)
      expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor, 'indoors', 'fly')).toBeUndefined()
      expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor, 'outdoors', 'swim')).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('issues and atomically consumes a generic persistent-companion command', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.companion-command', name: 'Companion Command Test', version: '1.0.0',
        apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'command', name: '伙伴指令', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'command', name: '伙伴指令', description: '测试。', level: 1,
            trigger: { kind: 'active-use' },
            targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 60 },
            effects: [{ kind: 'command-owned-companion', target: 'target', command: 'attack' }],
            automation: 'full',
          },
        })
      },
    })
    try {
      const owner = combatant('owner', 30, { pluginFeatureIds: [featureId] })
      const companion = combatant('companion', 20, {
        summonedSourceCombatantId: 'owner', summonedPersistent: true,
      })
      const enemy = combatant('enemy', 10, { controller: 'dm', position: { x: 5, y: 0 } })
      const state = startDnd5eHeadlessCombat('generic-companion-command', [owner, companion, enemy])
      state.initiativeIndex = 1
      const uncommanded = resolveDnd5eHeadlessAction(state, {
        type: 'attack', actorId: 'companion', targetId: 'enemy', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
      })
      expect(uncommanded).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

      state.initiativeIndex = 0
      const issued = commitDnd5eActivityExecution(state, {
        actorId: 'owner', activityId: 'command-companion', targetIds: ['companion'],
        source: { kind: 'feature', id: 'command' },
        resolution: {
          ok: true, status: 'resolved', checks: [],
          consumptions: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
          proposals: [{
            kind: 'command-owned-companion', operationId: 'issue', targetId: 'companion', command: 'attack',
          }],
        },
      })
      expect(issued.ok).toBe(true)
      if (!issued.ok) return
      expect(issued.state.combatants.companion.classState.companionCommand).toMatchObject({
        sourceOwnerId: 'owner', sourceFeatureId: featureId, command: 'attack',
      })
      issued.state.initiativeIndex = 1
      const commanded = resolveDnd5eHeadlessAction(issued.state, {
        type: 'attack', actorId: 'companion', targetId: 'enemy', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
      })
      expect(commanded.ok).toBe(true)
      if (!commanded.ok) return
      expect(commanded.state.combatants.companion.classState.companionCommand).toBeUndefined()
      expect(commanded.state.combatants.enemy.currentHp).toBe(36)
    } finally {
      dispose()
    }
  })

  it('authorizes resource spells from Host definitions and atomically spends their declared resource', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.alternate-resource-spells', name: 'Alternate Resource Spell Test',
        version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'resource-spells', name: '资源施法', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'resource-spells', name: '资源施法', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'alternate-resource-spellcasting', classId: 'monk', ability: 'wis',
              resourceId: 'dnd5e-ki', resourceScope: 'core', ignoreMaterialComponents: true,
              grants: [{ id: 'radiant-cantrip', spellId: 'sacred-flame', castAtLevel: 0, resourceCost: 1 }],
            },
            automation: 'full',
          },
        })
      },
    })
    try {
      const character = {
        ...testCharacter([featureId]),
        charClass: '武僧', level: 3, dnd5eClassLevels: { monk: 3 },
        classResources: { 'dnd5e-ki': { current: 2, max: 3 } },
      }
      expect(dnd5eAlternateResourceSpellsForCharacter(character)).toEqual([
        expect.objectContaining({
          featureId, grantId: 'radiant-cantrip', spellId: 'sacred-flame',
          resourceId: 'dnd5e-ki', castLevelOptions: [{ slotLevel: 0, resourceCost: 1 }],
        }),
      ])

      const monk = combatant('resource-caster', 30, {
        classId: 'monk', classLevels: { monk: 3 }, level: 3,
        pluginFeatureIds: [featureId], classResources: { 'dnd5e-ki': { current: 2, max: 3 } },
      })
      const target = combatant('resource-target', 20, { controller: 'dm' })
      const state = startDnd5eHeadlessCombat('alternate-resource-spell', [monk, target])
      const resolved = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: monk.id, targetId: target.id,
        spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1, effectRolls: [6],
        alternateResourceSpell: { featureId, grantId: 'radiant-cantrip' },
      })
      expect(resolved.ok).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants[monk.id].classResources['dnd5e-ki'].current).toBe(1)
      expect(resolved.state.combatants[target.id].currentHp).toBe(34)
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved', abilityId: featureId, trigger: 'spell-cast',
      }))

      state.combatants[monk.id].pluginFeatureIds = []
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: monk.id, targetId: target.id,
        spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1, effectRolls: [6],
        alternateResourceSpell: { featureId, grantId: 'radiant-cantrip' },
      })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
      expect(state.combatants[monk.id].classResources['dnd5e-ki'].current).toBe(2)
    } finally {
      dispose()
    }
  })

  it('settles imported granted-die weapon damage and reaction AC options atomically', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.granted-die-options', name: 'Granted Die Options Test',
        version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'combat-options', name: '奖励骰战斗选项', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'combat-options', name: '奖励骰战斗选项', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-roll' }, targeting: { kind: 'single-creature', relation: 'ally' },
            effects: [], mechanic: {
              kind: 'granted-die-combat-options', dieState: 'bardic-inspiration',
              addToWeaponDamage: true, addToArmorClassAgainstAttack: true,
            }, automation: 'full',
          },
        })
      },
    })
    try {
      const source = combatant('die-source', 5, { pluginFeatureIds: [featureId] })
      const attacker = combatant('incoming-attacker', 30, {
        controller: 'dm', armorClass: 12, position: { x: 5, y: 0 },
      })
      const defender = combatant('die-defender', 20, {
        armorClass: 14,
        classState: {
          bardicInspirationDie: 6,
          bardicInspirationSourceId: source.id,
          bardicInspirationRoundsRemaining: 10,
        },
      })
      const defense = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('granted-die-defense', [source, attacker, defender]),
        {
          type: 'attack', actorId: attacker.id, targetId: defender.id,
          attackModifier: 5, d20: 10, grantedDieArmorClassRoll: 2,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
        },
      )
      expect(defense.ok).toBe(true)
      if (!defense.ok) return
      expect(defense.state.combatants[defender.id].currentHp).toBe(40)
      expect(defense.state.combatants[defender.id].turn.reactionAvailable).toBe(false)
      expect(defense.state.combatants[defender.id].classState.bardicInspirationDie).toBeUndefined()

      const striker = combatant('die-striker', 30, {
        classState: {
          bardicInspirationDie: 6,
          bardicInspirationSourceId: source.id,
          bardicInspirationRoundsRemaining: 10,
        },
      })
      const victim = combatant('die-victim', 20, { controller: 'dm' })
      const damage = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('granted-die-damage', [source, striker, victim]),
        {
          type: 'attack', actorId: striker.id, targetId: victim.id,
          attackModifier: 20, d20: 10, grantedDieWeaponDamageRoll: 5,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
          classDamageContext: {
            mode: 'melee', finesse: false, strengthBased: true, weaponId: 'test-sword',
            weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
          },
        },
      )
      expect(damage.ok).toBe(true)
      if (!damage.ok) return
      expect(damage.state.combatants[victim.id].currentHp).toBe(31)
      expect(damage.state.combatants[striker.id].classState.bardicInspirationDie).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('settles extra attacks, weapon riders, spell modifiers, passive defenses, and signed reaction attacks', () => {
    let extraAttackFeatureId = ''
    let riderFeatureId = ''
    let spellModifierFeatureId = ''
    let passiveDefenseFeatureId = ''
    let reactionAttackFeatureId = ''
    let formEligibilityFeatureId = ''
    let formControlFeatureId = ''
    let transformedMagicalFeatureId = ''
    let summonBonusFeatureId = ''
    let companionUpgradeFeatureId = ''
    let creatureTraversalFeatureId = ''
    let damageMaximizationFeatureId = ''
    let weaponDamageMaximizationFeatureId = ''
    let featureDamageActionFeatureId = ''
    let weaponDamageMaximizationSubclassId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.generic-combat-primitives',
        name: 'Generic Combat Primitives Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'Test only',
      },
      setup(api) {
        extraAttackFeatureId = api.registerFeature({
          id: 'extra-attack', name: '额外攻击', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'extra-attack', name: '额外攻击', description: '测试。', level: 1,
            trigger: { kind: 'passive' }, targeting: { kind: 'self' },
            mechanic: { kind: 'attacks-per-action', attacks: 2 }, effects: [], automation: 'full',
          },
        })
        riderFeatureId = api.registerFeature({
          id: 'weapon-rider', name: '附伤', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'weapon-rider', name: '附伤', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-hit' },
            targeting: { kind: 'single-creature', relation: 'enemy' },
            rolls: [{
              id: 'rider-damage', kind: 'damage', label: '附伤', damageType: 'radiant',
              dice: { count: 1, sides: 8, scaling: { basis: 'class-level', classId: 'cleric', steps: [{ level: 14, addDice: 1 }] } },
            }],
            effects: [{ kind: 'damage', target: 'target', rollId: 'rider-damage' }],
            limits: { oncePerTurn: true },
            mechanic: { kind: 'weapon-damage-rider', rollId: 'rider-damage' }, automation: 'full',
          },
        })
        spellModifierFeatureId = api.registerFeature({
          id: 'spell-modifier', name: '强力施法', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'spell-modifier', name: '强力施法', description: '测试。', level: 1,
            trigger: { kind: 'after-spell-cast' }, targeting: { kind: 'self' },
            mechanic: { kind: 'spell-damage-ability-modifier', spellcastingClassId: 'cleric', ability: 'wis', maximumSpellLevel: 0 },
            effects: [], automation: 'full',
          },
        })
        passiveDefenseFeatureId = api.registerFeature({
          id: 'passive-defense', name: '被动防御', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'passive-defense', name: '被动防御', description: '测试。', level: 1,
            trigger: { kind: 'before-damage-taken' }, targeting: { kind: 'self' },
            mechanic: {
              kind: 'passive-defense',
              damageResistance: { damageTypes: ['slashing'], delivery: 'weapon-attack', magical: false },
              savingThrowAdvantageAgainstSpells: true,
              hitPointMaximumReductionImmunity: true,
              conditionImmunities: ['charmed'],
              damageReflection: { damageTypes: ['psychic'], multiplier: 1 },
            },
            effects: [], automation: 'full',
          },
        })
        reactionAttackFeatureId = api.registerFeature({
          id: 'reaction-attack', name: '反应攻击', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'reaction-attack', name: '反应攻击', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-hit' }, cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 },
            mechanic: { kind: 'reaction-weapon-attack', event: 'other-creature-hit' },
            effects: [], automation: 'full',
          },
        })
        formEligibilityFeatureId = api.registerFeature({
          id: 'form-eligibility', name: '形态目录', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'form-eligibility', name: '形态目录', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'creature-form-eligibility', system: 'wild-shape', creatureTypes: ['beast'],
              maximumChallengeRating: { kind: 'class-level', classId: 'druid', divisor: 3, minimum: 1 },
              useCoreMovementLimits: true,
            },
            automation: 'full',
          },
        })
        formControlFeatureId = api.registerFeature({
          id: 'form-control', name: '变形控制', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'form-control', name: '变形控制', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'creature-form-control', system: 'wild-shape', activationEconomy: 'bonusAction',
              inFormHealing: {
                economy: 'bonusAction', resource: 'spell-slot',
                dicePerResourceLevel: { count: 1, sides: 8 }, maximumResourceLevel: 9,
              },
            },
            automation: 'full',
          },
        })
        transformedMagicalFeatureId = api.registerFeature({
          id: 'transformed-magical', name: '形态魔法攻击', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'transformed-magical', name: '形态魔法攻击', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-hit' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'passive-defense', weaponAttacksMagical: { while: 'transformed' } },
            automation: 'full',
          },
        })
        summonBonusFeatureId = api.registerFeature({
          id: 'summon-bonus', name: '召唤强化', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'summon-bonus', name: '召唤强化', description: '测试。', level: 1,
            trigger: { kind: 'after-spell-cast' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'summoned-creature-bonus', source: 'spell',
              temporaryHitPoints: { kind: 'fixed', value: 30 },
              maximumHitPointBonus: { kind: 'fixed', value: 5 },
              weaponDamageBonus: { kind: 'proficiency-bonus' },
              spellSchools: ['conjuration'],
            },
            automation: 'full',
          },
        })
        companionUpgradeFeatureId = api.registerFeature({
          id: 'companion-upgrade', name: '伙伴成长', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'companion-upgrade', name: '伙伴成长', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'companion-profile-upgrade', weaponAttacksMagical: true,
              attacksPerAction: 2, shareSelfSpellsRangeFeet: 30,
            },
            automation: 'full',
          },
        })
        creatureTraversalFeatureId = api.registerFeature({
          id: 'creature-traversal', name: '占位穿越', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'creature-traversal', name: '占位穿越', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'creature-space-traversal', minimumLargerSizeRanks: 1 },
            automation: 'full',
          },
        })
        damageMaximizationFeatureId = api.registerFeature({
          id: 'damage-maximization', name: '伤害骰最大化', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'damage-maximization', name: '伤害骰最大化', description: '测试。', level: 1,
            trigger: { kind: 'after-spell-cast' },
            cost: { resources: [{ scope: 'core', resourceId: 'test-maximization', amount: 1 }] },
            targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'damage-roll-maximization', damageTypes: ['thunder'], deliveries: ['spell'] },
            automation: 'full',
          },
        })
        weaponDamageMaximizationSubclassId = api.registerDeclarativeSubclass({
          schemaVersion: 1,
          id: 'weapon-maximizer',
          classId: 'fighter',
          name: '武器最大化测试',
          summary: '测试通用预激活武器伤害最大化。',
          combatHooks: [{
            id: 'arm-weapon-maximization', timing: 'after-attack-hit',
            abilityId: 'weapon-maximization', decision: 'actor-choice',
            activation: 'prearm', retention: 'until-triggered',
          }],
          abilities: [{
            schemaVersion: 1, id: 'weapon-maximization', name: '武器伤害最大化',
            description: '测试。', level: 1, trigger: { kind: 'after-attack-hit' },
            cost: { resources: [{ scope: 'core', resourceId: 'test-weapon-maximization', amount: 1 }] },
            targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'damage-roll-maximization', damageTypes: ['lightning'],
              deliveries: ['weapon-attack', 'feature'],
            },
            automation: 'full',
          }, {
            schemaVersion: 1, id: 'feature-lightning', name: '特性闪电伤害',
            description: '测试。', level: 1, trigger: { kind: 'active-use' },
            cost: { economy: 'action' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
            rolls: [{
              id: 'feature-lightning-damage', kind: 'damage', label: '闪电伤害',
              damageType: 'lightning', dice: { count: 2, sides: 8 },
            }],
            effects: [{ kind: 'damage', target: 'target', rollId: 'feature-lightning-damage' }],
            automation: 'full',
          }],
        })
        weaponDamageMaximizationFeatureId =
          'test.generic-combat-primitives:weapon-maximizer.weapon-maximization'
        featureDamageActionFeatureId =
          'test.generic-combat-primitives:weapon-maximizer.feature-lightning'
      },
    })

    try {
      const character = testCharacter([
        extraAttackFeatureId,
        passiveDefenseFeatureId,
      ])
      expect(dnd5eEffectiveAttacksPerAttackAction(character)).toBe(2)
      const projected = migrateCharacterToDnd5e(character)
      expect(projected).toMatchObject({
        spellSavingThrowAdvantage: true,
        hitPointMaximumReductionImmunity: true,
        conditionImmunities: expect.arrayContaining(['charmed']),
      })
      expect(resolveDnd5eDamageDefenses({
        damage: 9,
        source: { damageType: 'slashing', delivery: 'weapon-attack', magical: false },
        defenses: { damageDefenseRules: projected.damageDefenseRules },
      }).finalDamage).toBe(4)
      expect(resolveDnd5eDamageDefenses({
        damage: 9,
        source: { damageType: 'slashing', delivery: 'weapon-attack', magical: true },
        defenses: { damageDefenseRules: projected.damageDefenseRules },
      }).finalDamage).toBe(9)
      expect(dnd5eSavingThrowMode(projected, 'dex', { sourceIsSpell: true })).toBe('advantage')
      expect(dnd5eSavingThrowMode(projected, 'dex', { sourceIsSpell: false })).toBe('normal')

      const psychicSource = combatant('psychic-source', 30)
      const reflector = combatant('reflector', 30, { controller: 'dm', pluginFeatureIds: [passiveDefenseFeatureId] })
      const reflectionState = startDnd5eHeadlessCombat('generic-reflection', [psychicSource, reflector])
      const reflected = resolveDnd5eHeadlessAction(reflectionState, {
        type: 'attack', actorId: psychicSource.id, targetId: reflector.id,
        attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'psychic' },
      })
      expect(reflected.ok).toBe(true)
      if (!reflected.ok) return
      expect(reflected.state.combatants[reflector.id].currentHp).toBe(32)
      expect(reflected.state.combatants[psychicSource.id].currentHp).toBe(32)
      expect(reflected.events).toContainEqual(expect.objectContaining({
        type: 'declarative-damage-reflected', actorId: reflector.id,
        sourceId: psychicSource.id, amount: 8, damageType: 'psychic',
      }))

      const striker = combatant('striker', 30, {
        classId: 'cleric', level: 14, pluginFeatureIds: [riderFeatureId],
      })
      const riderTarget = combatant('rider-target', 20, { controller: 'dm' })
      const riderState = startDnd5eHeadlessCombat('generic-rider', [striker, riderTarget])
      const riderContext = {
        mode: 'melee' as const, finesse: false, strengthBased: true,
        weaponDamageSides: 8, damageType: 'slashing' as const, adjacentEnemyOfTarget: false,
      }
      expect(dnd5eWeaponClassDamageDefinitions({
        state: riderState, actorId: 'striker', targetId: 'rider-target',
        context: riderContext, critical: false,
      })).toContainEqual(expect.objectContaining({
        source: 'weapon-damage-rider', featureId: riderFeatureId, count: 2, sides: 8, type: 'radiant',
      }))
      const riderAttack = resolveDnd5eHeadlessAction(riderState, {
        type: 'attack', actorId: 'striker', targetId: 'rider-target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
        classDamageContext: riderContext,
        classDamageRolls: [{ source: 'weapon-damage-rider', rolls: [5, 6] }],
      })
      expect(riderAttack.ok).toBe(true)
      if (!riderAttack.ok) return
      expect(riderAttack.state.combatants['rider-target'].currentHp).toBe(25)
      expect(dnd5eWeaponClassDamageDefinitions({
        state: riderAttack.state, actorId: 'striker', targetId: 'rider-target',
        context: riderContext, critical: false,
      })).not.toContainEqual(expect.objectContaining({ featureId: riderFeatureId }))

      const cleric = combatant('cleric', 30, {
        classId: 'cleric', level: 8, abilities: { ...abilities, wis: 18 },
        classSelections: { 'spell-cantrips': ['sacred-flame'] },
        pluginFeatureIds: [spellModifierFeatureId],
      })
      const spellTarget = combatant('spell-target', 20, { controller: 'dm' })
      const spellResult = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('generic-spell-modifier', [cleric, spellTarget]),
        {
          type: 'cast-spell', actorId: 'cleric', targetId: 'spell-target',
          spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1, effectRolls: [4, 4],
        },
      )
      expect(spellResult.ok).toBe(true)
      if (!spellResult.ok) return
      expect(spellResult.state.combatants['spell-target'].currentHp).toBe(28)
      expect(spellResult.events).toContainEqual(expect.objectContaining({
        type: 'spell-damage-feature-bonus-applied',
        featureId: spellModifierFeatureId,
        ability: 'wis',
        amount: 4,
      }))

      const maximizer = combatant('maximizer', 30, {
        classId: 'wizard', classLevels: { wizard: 3 }, level: 3,
        classSelections: { 'spell-prepared': ['shatter'] },
        classResources: {
          'dnd5e-spell-slot-2': { current: 1, max: 1 },
          'test-maximization': { current: 1, max: 1 },
        },
        pluginFeatureIds: [damageMaximizationFeatureId],
      })
      const maximizationTarget = combatant('maximization-target', 20, { controller: 'dm' })
      const maximizationState = startDnd5eHeadlessCombat('generic-damage-maximization', [maximizer, maximizationTarget])
      const forgedMaximization = resolveDnd5eHeadlessAction(maximizationState, {
        type: 'cast-spell', actorId: 'maximizer', targetId: 'maximization-target',
        spellId: 'shatter', slotLevel: 2, savingThrowD20: 1,
        damageMaximizationFeatureId, effectRolls: [1],
      })
      expect(forgedMaximization).toMatchObject({ ok: false, reason: 'invalid-dice' })
      expect(maximizationState.combatants.maximizer.classResources).toMatchObject({
        'dnd5e-spell-slot-2': { current: 1 },
        'test-maximization': { current: 1 },
      })
      const maximized = resolveDnd5eHeadlessAction(maximizationState, {
        type: 'cast-spell', actorId: 'maximizer', targetId: 'maximization-target',
        spellId: 'shatter', slotLevel: 2, savingThrowD20: 1,
        damageMaximizationFeatureId, effectRolls: [],
      })
      expect(maximized.ok).toBe(true)
      if (!maximized.ok) return
      expect(maximized.state.combatants['maximization-target'].currentHp).toBe(16)
      expect(maximized.state.combatants.maximizer.classResources['test-maximization'].current).toBe(0)
      expect(maximized.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved', abilityId: damageMaximizationFeatureId,
        trigger: 'damage-roll',
      }))

      const weaponMaximizer = combatant('weapon-maximizer', 30, {
        classId: 'fighter', classLevels: { fighter: 3 }, level: 3,
        subclassIds: { fighter: weaponDamageMaximizationSubclassId },
        classResources: { 'test-weapon-maximization': { current: 1, max: 1 } },
        pluginFeatureIds: [weaponDamageMaximizationFeatureId],
      })
      const weaponMaxTarget = combatant('weapon-max-target', 20, { controller: 'dm' })
      const weaponMaxState = startDnd5eHeadlessCombat('generic-weapon-damage-maximization', [
        weaponMaximizer, weaponMaxTarget,
      ])
      expect(resolveDnd5eHeadlessAction(weaponMaxState, {
        type: 'attack', actorId: weaponMaximizer.id, targetId: weaponMaxTarget.id,
        attackModifier: 10, d20: 10,
        declarativeIntentFeatureIds: [weaponDamageMaximizationFeatureId],
        damage: { count: 1, sides: 8, bonus: 2, rolls: [7], type: 'lightning' },
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
      const weaponMaximized = resolveDnd5eHeadlessAction(weaponMaxState, {
        type: 'attack', actorId: weaponMaximizer.id, targetId: weaponMaxTarget.id,
        attackModifier: 10, d20: 10,
        declarativeIntentFeatureIds: [weaponDamageMaximizationFeatureId],
        damage: { count: 1, sides: 8, bonus: 2, rolls: [8], type: 'lightning' },
      })
      expect(weaponMaximized.ok).toBe(true)
      if (!weaponMaximized.ok) return
      expect(weaponMaximized.state.combatants[weaponMaxTarget.id].currentHp).toBe(30)
      expect(weaponMaximized.state.combatants[weaponMaximizer.id]
        .classResources['test-weapon-maximization'].current).toBe(0)
      expect(weaponMaximized.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved',
        abilityId: weaponDamageMaximizationFeatureId,
        trigger: 'damage-roll',
      }))

      const featureMaximizer = combatant('feature-maximizer', 30, {
        classId: 'fighter', classLevels: { fighter: 3 }, level: 3,
        subclassIds: { fighter: weaponDamageMaximizationSubclassId },
        classResources: { 'test-weapon-maximization': { current: 1, max: 1 } },
        pluginFeatureIds: [weaponDamageMaximizationFeatureId, featureDamageActionFeatureId],
      })
      const featureMaxTarget = combatant('feature-max-target', 20, { controller: 'dm' })
      const featureMaxState = startDnd5eHeadlessCombat('generic-feature-damage-maximization', [
        featureMaximizer, featureMaxTarget,
      ])
      featureMaxState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(featureMaximizer.id, featureMaxTarget.id)]: 20,
      }
      const featureDamageAction = dnd5ePluginFeatureDefinition(featureDamageActionFeatureId)?.action
      expect(featureDamageAction).toBeDefined()
      if (!featureDamageAction) return
      expect(resolveDnd5eHeadlessAction(featureMaxState, {
        type: 'plugin', pluginId: 'test.generic-combat-primitives',
        actionId: featureDamageAction.id, featureId: featureDamageActionFeatureId,
        transactionId: 'feature-max-forged',
        modifierFeatureIds: [weaponDamageMaximizationFeatureId],
        actorId: featureMaximizer.id, targetId: featureMaxTarget.id, distanceFeet: 20,
        rolls: {
          'feature-lightning-damage': { values: [8, 7], modifier: 0, total: 15 },
        },
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
      const featureMaximized = resolveDnd5eHeadlessAction(featureMaxState, {
        type: 'plugin', pluginId: 'test.generic-combat-primitives',
        actionId: featureDamageAction.id, featureId: featureDamageActionFeatureId,
        transactionId: 'feature-max-valid',
        modifierFeatureIds: [weaponDamageMaximizationFeatureId],
        actorId: featureMaximizer.id, targetId: featureMaxTarget.id, distanceFeet: 20,
        rolls: {
          'feature-lightning-damage': { values: [8, 8], modifier: 0, total: 16 },
        },
      })
      expect(featureMaximized.ok ? 'ok' : featureMaximized.reason).toBe('ok')
      if (!featureMaximized.ok) return
      expect(featureMaximized.state.combatants[featureMaxTarget.id].currentHp).toBe(24)
      expect(featureMaximized.state.combatants[featureMaximizer.id]
        .classResources['test-weapon-maximization'].current).toBe(0)
      expect(featureMaximized.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved',
        abilityId: weaponDamageMaximizationFeatureId,
        trigger: 'damage-roll',
      }))

      const ally = combatant('ally', 30, { position: { x: 0, y: 0 } })
      const enemy = combatant('enemy', 20, { controller: 'dm', position: { x: 5, y: 0 } })
      const reactor = combatant('reactor', 10, {
        position: { x: 10, y: 0 }, pluginFeatureIds: [reactionAttackFeatureId],
      })
      const reactionState = startDnd5eHeadlessCombat('generic-reaction', [ally, enemy, reactor])
      reactionState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey('reactor', 'enemy')]: 5,
      }
      const forged = resolveDnd5eHeadlessAction(reactionState, {
        type: 'opportunity-attack', actorId: 'reactor', targetId: 'enemy',
        reactionFeature: 'declarative-reaction-weapon-attack', reactionFeatureId: reactionAttackFeatureId,
        attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      })
      expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
      const trigger = resolveDnd5eHeadlessAction(reactionState, {
        type: 'attack', actorId: 'ally', targetId: 'enemy', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      })
      expect(trigger.ok).toBe(true)
      if (!trigger.ok) return
      expect(trigger.state.combatants.reactor.classState
        .declarativeReactionWeaponAttackOpportunities?.[reactionAttackFeatureId]).toMatchObject({
        targetId: 'enemy', triggerActorId: 'ally', round: 1,
      })
      const reaction = resolveDnd5eHeadlessAction(trigger.state, {
        type: 'opportunity-attack', actorId: 'reactor', targetId: 'enemy',
        reactionFeature: 'declarative-reaction-weapon-attack', reactionFeatureId: reactionAttackFeatureId,
        attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      })
      expect(reaction.ok).toBe(true)
      if (!reaction.ok) return
      expect(reaction.state.combatants.reactor.turn.reactionAvailable).toBe(false)
      expect(reaction.state.combatants.reactor.classState
        .declarativeReactionWeaponAttackOpportunities?.[reactionAttackFeatureId]).toBeUndefined()

      const shapechanger = combatant('shapechanger', 30, {
        classId: 'druid', classLevels: { druid: 6 }, level: 6,
        classResources: {
          'dnd5e-wild-shape': { current: 2, max: 2 },
          'dnd5e-spell-slot-2': { current: 1, max: 3 },
        },
        classSelections: { 'wild-shape-known-forms': ['srd-5.1:polar-bear'] },
        pluginFeatureIds: [formEligibilityFeatureId, formControlFeatureId, transformedMagicalFeatureId],
      })
      const shaped = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('generic-form-rules', [shapechanger, combatant('form-enemy', 20, { controller: 'dm' })]),
        { type: 'druid-wild-shape', actorId: 'shapechanger', formId: 'srd-5.1:polar-bear' },
      )
      expect(shaped.ok).toBe(true)
      if (!shaped.ok) return
      expect(shaped.state.combatants.shapechanger).toMatchObject({
        statBlockId: 'srd-5.1:polar-bear', weaponAttacksMagical: true,
        turn: { actionAvailable: true, bonusActionAvailable: false },
      })
      shaped.state.combatants.shapechanger.currentHp = 30
      shaped.state.combatants.shapechanger.classState.wildShapeCurrentHp = 30
      shaped.state.combatants.shapechanger.turn.bonusActionAvailable = true
      const maximumState = structuredClone(shaped.state)
      maximumState.combatants.shapechanger.currentHp = 1
      maximumState.combatants.shapechanger.classState.wildShapeCurrentHp = 1
      maximumState.combatants.shapechanger.classState.activeEffects = [createDnd5eMechanicalEffect({
        definitionId: 'maximum', label: 'Maximum', source: { kind: 'plugin' }, targetId: 'shapechanger',
        modifiers: { maximizeHealingDice: true },
      })]
      const maximumHealing = resolveDnd5eHeadlessAction(maximumState, {
        type: 'druid-creature-form-heal', actorId: 'shapechanger', slotLevel: 2, healingRolls: [1, 1],
      })
      expect(maximumHealing.ok).toBe(true)
      expect(maximumHealing.state.combatants.shapechanger.currentHp).toBe(17)
      expect(maximumHealing.state.combatants.shapechanger.classState.wildShapeCurrentHp).toBe(17)
      const formHealing = resolveDnd5eHeadlessAction(shaped.state, {
        type: 'druid-creature-form-heal', actorId: 'shapechanger', slotLevel: 2,
        healingRolls: [8, 7],
      })
      expect(formHealing.ok).toBe(true)
      if (!formHealing.ok) return
      expect(formHealing.state.combatants.shapechanger).toMatchObject({
        currentHp: 42,
        classResources: { 'dnd5e-spell-slot-2': { current: 0, max: 3 } },
        turn: { bonusActionAvailable: false },
        classState: { wildShapeCurrentHp: 42 },
      })

      const summoner = combatant('summoner', 30, { pluginFeatureIds: [summonBonusFeatureId] })
      expect(dnd5eDeclarativeCompanionProfileUpgrade(combatant('companion-owner', 31, {
        pluginFeatureIds: [companionUpgradeFeatureId],
      }))).toEqual({
        weaponAttacksMagical: true,
        attacksPerAction: 2,
        shareSelfSpellsRangeFeet: 30,
      })
      expect(dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks(
        combatant('traverser', 32, { pluginFeatureIds: [creatureTraversalFeatureId] }),
      )).toBe(1)
      const summonResult = commitDnd5eActivityExecution(
        startDnd5eHeadlessCombat('generic-summon-bonus', [summoner, combatant('summon-target', 20, { controller: 'dm' })]),
        {
          actorId: 'summoner', activityId: 'test-summon', targetIds: [],
          source: { kind: 'spell', id: 'flaming-sphere' },
          resolution: {
            ok: true, status: 'resolved', checks: [], consumptions: [],
            proposals: [{
              kind: 'summon', operationId: 'summon-one', monsterId: 'srd-5.1:wolf', count: 1,
              timing: 'immediate', durationRounds: 10, concentration: true, side: 'ally',
            }],
          },
        },
      )
      expect(summonResult.ok ? 'ok' : summonResult.reason).toBe('ok')
      expect(summonResult.activityHandoffs?.summons[0]).toMatchObject({
        temporaryHitPoints: 30,
        maximumHitPointBonus: 5,
        weaponDamageBonus: 3,
      })
    } finally {
      dispose()
    }
  })

  it('intercepts an affecting spell, locks its source, and grants temporary casting through the generic primitive', () => {
    const pluginId = 'test.spell-interception'
    const subclassId = `${pluginId}:spell-thief`
    const featureId = `${subclassId}.spell-thief`
    const usesResourceId = `${pluginId}:decl-spell-thief-spell-thief-uses`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Spell Interception Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        api.registerDeclarativeSubclass({
          schemaVersion: 1, id: 'spell-thief', classId: 'rogue', name: 'Spell Thief', summary: 'Test.',
          spellcasting: {
            progression: 'one-third', learning: 'known', ability: 'int', spellListClassId: 'wizard',
            cantripChoiceGroupId: 'spell-cantrips', spellChoiceGroupId: 'spell-known',
            cantripsKnownByClassLevel: [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
            spellsKnownByClassLevel: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
            allowedSchools: ['enchantment', 'illusion'],
            unrestrictedSpellsKnownByClassLevel: [0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4],
            ritualCasting: false, focus: '无',
          },
          abilities: [{
            schemaVersion: 1, id: 'spell-thief', name: 'Spell Thief', description: 'Test.', level: 17,
            trigger: { kind: 'before-spell-effect' },
            cost: { economy: 'reaction', uses: 1 },
            targeting: { kind: 'self' },
            limits: { uses: { kind: 'fixed', value: 1 }, reset: 'long-rest' },
            effects: [],
            mechanic: {
              kind: 'spell-interception', spellcastingClassId: 'rogue',
              saveAbility: 'int', dcAbility: 'int', minimumSpellLevel: 1,
              maximumSpellLevel: 'actor-maximum-slot', negateForSelf: true,
              grantTemporarySpellAccess: true, prohibitSourceCasting: true,
              durationRounds: 4800,
            },
            automation: 'full',
          }],
        })
      },
    })
    try {
      const caster = combatant('spell-source', 30, {
        controller: 'dm', classId: 'wizard', classLevels: { wizard: 17 }, level: 17,
        abilities: { ...abilities, int: 20 },
        classSelections: { 'spell-prepared': ['magic-missile'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } },
      })
      const thief = combatant('spell-thief', 20, {
        classId: 'rogue', classLevels: { rogue: 17 }, level: 17,
        subclassIds: { rogue: subclassId }, pluginFeatureIds: [featureId],
        abilities: { ...abilities, int: 18 }, proficiencyBonus: 6,
        classResources: {
          'dnd5e-spell-slot-1': { current: 1, max: 1 },
          [usesResourceId]: { current: 1, max: 1 },
        },
      })
      const state = startDnd5eHeadlessCombat('spell-interception', [caster, thief])
      const intercepted = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: caster.id, targetId: thief.id, targetIds: [thief.id],
        projectileTargetIds: [thief.id, thief.id, thief.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [4, 4, 4],
        spellInterceptionReaction: {
          actorId: thief.id, featureId, savingThrowD20: 1,
        },
      } as Dnd5eAction)
      expect(intercepted.ok, intercepted.ok ? undefined : intercepted.reason).toBe(true)
      if (!intercepted.ok) return
      expect(intercepted.state.combatants[thief.id]).toMatchObject({
        currentHp: 40,
        turn: { reactionAvailable: false },
        classResources: { [usesResourceId]: { current: 0, max: 1 } },
        classState: {
          declarativeSpellInterceptionGrants: {
            [featureId]: {
              spellId: 'magic-missile', sourceActorId: caster.id,
              castingClassId: 'rogue', roundsRemaining: 4800,
            },
          },
        },
      })
      expect(intercepted.state.combatants[caster.id].classState.declarativeSpellInterceptionLocks)
        .toMatchObject({
          [featureId]: {
            spellId: 'magic-missile', sourceActorId: thief.id, roundsRemaining: 4800,
          },
        })
      expect(intercepted.events).toContainEqual(expect.objectContaining({
        type: 'spell-interception-resolved', actorId: thief.id, casterId: caster.id,
        featureId, success: false, negatedForSelf: true,
        temporaryAccessGranted: true, sourceCastingProhibited: true,
      }))

      intercepted.state.combatants[caster.id].turn.actionAvailable = true
      const locked = resolveDnd5eHeadlessAction(intercepted.state, {
        type: 'cast-spell', actorId: caster.id, targetId: thief.id, targetIds: [thief.id],
        projectileTargetIds: [thief.id, thief.id, thief.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1],
      })
      expect(locked).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

      intercepted.state.initiativeIndex = 1
      intercepted.state.combatants[thief.id].turn.actionAvailable = true
      const stolenCast = resolveDnd5eHeadlessAction(intercepted.state, {
        type: 'cast-spell', actorId: thief.id, castingClassId: 'rogue',
        targetId: caster.id, targetIds: [caster.id],
        projectileTargetIds: [caster.id, caster.id, caster.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1],
      })
      expect(stolenCast.ok, stolenCast.ok ? undefined : stolenCast.reason).toBe(true)
      if (!stolenCast.ok) return
      expect(stolenCast.state.combatants[caster.id].currentHp).toBe(34)
      expect(stolenCast.state.combatants[thief.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    } finally {
      dispose()
    }
  })
})



it('gates an activated weapon rider by base type, ranged mode and self-owned effect', () => {
  const ability = {
    schemaVersion: 1, id: 'shot', name: 'Shot', description: 'Synthetic', level: 3,
    trigger: { kind: 'after-attack-hit' }, targeting: { kind: 'single-creature', relation: 'any' },
    rolls: [{ id: 'extra', kind: 'damage', label: 'Extra', dice: { count: 1, sides: 4 }, damageType: 'parent-weapon' }],
    effects: [], mechanic: { kind: 'weapon-damage-rider', rollId: 'extra', ownTurnOnly: true,
      weaponBaseIds: ['dnd5e-longbow'], attackMode: 'ranged', requiredEffectDefinitionId: 'test.shot:active' }, automation: 'full',
  } as const
  validateDeclarativeSubclassAbilityV1(ability)
  for (const patch of [{ weaponBaseIds: [] }, { weaponBaseIds: ['a', 'a'] }, { attackMode: 'spell' }, { requiredEffectDefinitionId: '' }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { ...ability.mechanic, ...patch } })).toThrow()
  }
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.shot', name: 'Shot', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    featureId = api.registerFeature({ id: 'shot', name: 'Shot', summary: 'Synthetic', description: 'Synthetic', automation: 'full', declarativeAbility: ability })
  } })
  try {
    for (const mode of ['active', 'inactive', 'foreign-source', 'wrong-effect', 'wrong-weapon', 'melee', 'spell', 'other-turn', 'unowned'] as const) {
      const actor = combatant('actor', 30, { pluginFeatureIds: mode === 'unowned' ? [] : [featureId] })
      if (mode !== 'inactive') actor.classState.activeEffects = [createDnd5eMechanicalEffect({
        definitionId: mode === 'wrong-effect' ? 'test.shot:other' : 'test.shot:active', label: 'Shot', targetId: 'actor',
        source: { kind: 'plugin', actorId: mode === 'foreign-source' ? 'target' : 'actor' }, modifiers: {},
      })]
      const target = combatant('target', 20, { controller: 'dm' })
      const state = startDnd5eHeadlessCombat('shot', [actor, target])
      if (mode === 'other-turn') state.initiativeIndex = 1
      const context = { mode: mode === 'melee' ? 'melee' as const : 'ranged' as const, finesse: false, strengthBased: false,
        weaponId: 'instance-42', weaponBaseId: mode === 'wrong-weapon' ? 'dnd5e-shortbow' : 'dnd5e-longbow',
        spellAttack: mode === 'spell', weaponDamageSides: 8, damageType: 'piercing' as const, adjacentEnemyOfTarget: false }
      const definitions = () => dnd5eWeaponClassDamageDefinitions({ state, actorId: 'actor', targetId: 'target', context, critical: false }).filter(d => d.featureId === featureId)
      expect(definitions(), mode).toHaveLength(mode === 'active' ? 1 : 0)
      if (mode === 'active') {
        expect(definitions()[0]).toMatchObject({ count: 1, sides: 4, type: 'piercing', doubleOnCritical: true })
        let current = state
        for (let hit = 1; hit <= 2; hit++) {
          const result = resolveDnd5eHeadlessAction(current, { type: 'attack', actorId: 'actor', targetId: 'target', spendAction: false,
            attackModifier: 20, d20: 10, damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'piercing' },
            classDamageContext: context, classDamageRolls: [{ source: 'weapon-damage-rider', rolls: [3] }] })
          expect(result.ok).toBe(true)
          if (!result.ok) throw Error(result.reason)
          expect(result.state.combatants.target.currentHp).toBe(40 - hit * 7)
          current = JSON.parse(JSON.stringify(result.state))
        }
        current.combatants.actor.classState.activeEffects = []
        expect(dnd5eWeaponClassDamageDefinitions({ state: current, actorId: 'actor', targetId: 'target', context, critical: false }).some(d => d.featureId === featureId)).toBe(false)
      }
    }
  } finally { dispose() }
})


it('activates an imported weapon focus with a bonus action and expires it at the current turn end', async () => {
  const focusId = 'test.focus:focus'
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: 'test.focus', name: 'Focus', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace: 'test.focus', version: '1.0.0', kind: 'feature', id: 'focus', name: 'Focus', automation,
      payload: { id: 'focus', name: 'Focus', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'focus', name: 'Focus', automation, legacySource: { kind: 'feature', id: 'focus' },
        activation: { kind: 'bonus-action', cost: 1 }, target: { kind: 'self' },
        effects: [{ schemaVersion: 1, id: 'focused', name: 'Focused', stacking: 'replace',
          duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end', includeCreationTurn: true }, modifiers: [] }],
        outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'focused' }] }],
      }] }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const actor = combatant('actor', 30, { classId: 'monk', level: 3, classLevels: { monk: 3 }, subclassIds: { monk: 'test.focus:focus' }, pluginFeatureIds: [focusId] }), target = combatant('target', 20)
    const state = startDnd5eHeadlessCombat('focus', [actor, target])
    const action = { id: 'focus' }
    const command = { type: 'plugin' as const, pluginId: 'test.focus', actionId: action.id, featureId: focusId,
      actorId: 'actor', targetId: 'actor', distanceFeet: 0, rolls: {} }
    const applied = resolveDnd5eHeadlessAction(state, command)
    expect(applied.ok, JSON.stringify(applied)).toBe(true)
    if (!applied.ok) throw Error(applied.reason)
    const effects = applied.state.combatants.actor.classState.activeEffects!
    expect(effects).toHaveLength(1)
    expect(effects[0].source.actorId).toBe('actor')
    expect(resolveDnd5eHeadlessAction(applied.state, command).ok).toBe(false)
    const ended = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(applied.state)), { type: 'end-turn', actorId: 'actor' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) throw Error(ended.reason)
    expect(ended.state.combatants.actor.classState.activeEffects ?? []).toHaveLength(0)
  } finally { dispose() }
})
