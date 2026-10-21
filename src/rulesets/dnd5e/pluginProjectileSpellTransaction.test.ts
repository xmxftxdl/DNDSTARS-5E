import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import { expect, it } from 'vitest'
import { prepareDnd5eRandomTargetPluginSpellCast } from './randomPluginSpellTargets'
import { resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import type { BattleMap, Token } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

it.each([{critical:true,damage:11},{critical:false,damage:6}])('settles imported projectile checks and damage, critical=$critical',async ({critical,damage})=>{
  const content = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Random target test',
    spells: [{ id: 'test', name: 'Test', level: 2, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 30 },
      components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic.', automation: { mode: 'full' } }],
    activityPatterns: [{ schemaVersion: 1, id: 'cast', name: 'Test', source: { kind: 'spell', id: 'test' },
      activation: { kind: 'action', cost: 1 }, target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 30, includeSelf: true, allowDuplicateTargets: true },
      pattern: 'roll-effect', result: { kind: 'damage', damageType: 'cold', amount: { kind: 'constant', value: 2 } } }],
  }), 'random-test.json', { targetCollection: 'spells' })
  const activity=content.package.content.activities![0]
  activity.checks=[{id:'hit',kind:'attack-roll',perProjectile:true,rollId:'hit-d20',scope:'per-target',rollMode:'host-derived',attackBonus:{kind:'constant',value:5}}]
  activity.outcomes=[{id:'hit-damage',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',perProjectile:true,damageType:'cold',critical:'double-dice',amount:{kind:'dice',rollId:'damage',count:1,sides:6}}]}]
  const reimported=await prepareDnd5eLocalContentJson(JSON.stringify(content.package),'projectiles-export.json',{targetCollection:'spells'})
  expect(reimported.package.content.activities).toEqual(content.package.content.activities)
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(reimported.package))
  try {
    const spellId = content.package.manifest.id + ':test'
    const actor = normalizeCharacter({ id: 'owner', name: 'Caster', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
    })
    const effect = createDnd5eMechanicalEffect({ id: 'random', definitionId: 'test:random', label: 'Random', targetId: 'caster',
      source: { kind: 'spell' }, modifiers: { randomVisibleCreatureTargets: true, perceiveVisibleCreaturesAsHostile: true } })
    actor.dnd5eCombatState = { activeEffects: [effect] }
    const token = (id: string, x: number, patch: Partial<Token> = {}): Token => ({ id, label: id, type: 'enemy',
      x, y: 25, color: '', emoji: '', size: 1, hp: 30, maxHp: 30, ...patch })
    const caster = token('caster', 25, { type: 'player', characterId: actor.id })
    const ally = token('ally', 75, { dnd5eSide: 'player' })
    const enemy = token('enemy', 125)
    const hidden = token('hidden', 175, { dnd5eCombatState: { activeEffects: [createDnd5eConditionEffect({
      id: 'invisible', condition: 'invisible', targetId: 'hidden', source: { kind: 'dm' },
    })] } })
    const map: BattleMap = { id: 'random-spell', name: 'Test', width: 1000, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [caster, ally, enemy, hidden, token('far', 825), token('object', 100, { type: 'obstacle' })] }
    const action: SharedPlayerActionState = { id: 'cast', combatId: 'combat', mapId: map.id, type: 'dnd5e-spell-cast',
      sourceMode: 'player', status: 'pending', actorTokenId: caster.id, characterId: actor.id,
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      dnd5eSpellCast: { spellId, slotLevel: 2, castingClassId: 'wizard', targetTokenId: 'enemy', targetTokenIds: ['enemy','ally'] } }
    const prepared=prepareDnd5eRandomTargetPluginSpellCast({action,map,characters:[actor],initiativeOrder:[{tokenId:'caster',label:'Caster',emoji:'',color:'',roll:20}],chooseRandomTarget:()=> 'ally'})
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
    if(!prepared.ok)throw Error(prepared.reason)
    expect(prepared.prepared.activityHeadlessAction?.projectileTargetIds).toEqual(['ally','ally'])
    const retryEffect=createDnd5eMechanicalEffect({id:'damage-retry',definitionId:'test:damage-retry',label:'Damage retry',targetId:'ally',
      source:{kind:'spell',actorId:'caster'},modifiers:{},
      repeatSave:{ability:'int',dc:20,timing:'target-turn-end',onSuccess:'remove',onDamage:{mode:'normal'}},
    })
    prepared.prepared.state.combatants.ally.classState.activeEffects=[retryEffect]

    const rolls:Record<string,{values:number[],modifier:number,total:number}>={
      'hit-d20:projectile:0:ally':{values:[critical?20:1],modifier:0,total:critical?20:1},
      'hit-d20:projectile:1:ally':{values:[19],modifier:0,total:19},
      'damage:projectile:1:ally':{values:[6],modifier:0,total:6},
    }
    if(critical)rolls['damage:projectile:0:ally']={values:[2,3],modifier:0,total:5}
    const resolved=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:rolls}})
    expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.application?.map.tokens.find(t=>t.id==='ally')?.hp).toBe(30-damage)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-2'].current).toBe(0)
    expect(resolved.result.state.combatants.ally.classState.activeEffectDamageSavePendingQueue).toHaveLength(critical?2:1)
    expect(resolved.result.events.filter(event=>event.type==='active-effect-save-required'&&event.timing==='takes-damage')).toHaveLength(critical?2:1)
    if(critical){
      const first=resolveDnd5eHeadlessAction(resolved.result.state,{type:'active-effect-damage-save',actorId:'ally',effectId:retryEffect.id,d20:1},{transactionId:'projectile-save-0'})
      expect(first.ok).toBe(true)
      expect(first.state.combatants.ally.classState.activeEffectDamageSavePendingQueue).toHaveLength(1)
      const second=resolveDnd5eHeadlessAction(first.state,{type:'active-effect-damage-save',actorId:'ally',effectId:retryEffect.id,d20:20},{transactionId:'projectile-save-1'})
      expect(second.ok).toBe(true)
      expect(second.state.combatants.ally.classState.activeEffects?.some(effect=>effect.id===retryEffect.id) ?? false).toBe(false)
      expect(second.state.combatants.ally.classState.activeEffectDamageSavePendingQueue).toBeUndefined()
    }

    const invalid=structuredClone(rolls);delete invalid['damage:projectile:1:ally']
    const refused=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:invalid}})
    expect(refused.result.ok).toBe(false)
    expect(refused.result.state.combatants.caster.classResources['dnd5e-spell-slot-2'].current).toBe(1)
    expect(refused.result.state.combatants.ally.currentHp).toBe(30)
  }finally{dispose()}
})
