import { getDnd5eSrdMonster } from './monsters'
import { DND5E_DRAGONBORN_ANCESTRIES, DND5E_RACIAL_RESOURCE_KEYS } from './racialAutomation'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { dnd5ePendingMonsterDeathAreaEffects, resolveDnd5eHeadlessAction, type Dnd5eAction, dnd5eCombatantPairKey, createDnd5eCombatant, resolveDnd5ePersistentAreaTrigger, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions, resolveDnd5ePreparedWithDamageReactions } from './damageReactionFlow'

it.each(['delayed','repeat','area','rebuke','splash','dragonborn','monster-area','solar','azer','salamander','fire-elemental','magma-mephit','steam-mephit','balor'])('reacts before defenses on secondary damage (use=%s)', async use => {
  const packageId = 'test.stored-reaction'
  const automation = automationCapabilityFromLegacyStatus('full')
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'ward', name: 'Synthetic ward', activation: { kind: 'reaction' }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: 'ward' }, automation,
    invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' },
    requirements: [{ kind: 'damage-type', damageTypes: ['fire','acid'] }],
    consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'defense', name: 'Defense', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
      modifiers: [{ kind: 'damage-resistance', damageType: 'fire' }, { kind: 'damage-resistance', damageType: 'acid' }] },
    { schemaVersion: 1, id: 'charge', name: 'Stored follow-up', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
      suspendWhileEffectId: 'defense', grants: ['follow-up'], grantsSingleUse: true }],
    outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [
      { id: 'defense', kind: 'apply-effect', target: 'actor', effectId: 'defense' },
      { id: 'charge', kind: 'apply-effect', target: 'actor', effectId: 'charge' },
    ] }],
  }, {
    schemaVersion: 1, id: 'follow-up', name: 'Synthetic follow-up', activation: { kind: 'free' }, automation,
    legacySource: { kind: 'feature', id: 'ward' }, requiresEffectGrant: true,
    invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'automatic' },
    target: { kind: 'creature', relation: 'any', count: 1 },
    requirements: [{ kind: 'attack-delivery', delivery: 'melee' }, { kind: 'turn-owner', owner: 'actor' }],
    outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [
      { id: 'extra', kind: 'damage', target: 'target', damageType: 'fire', amount: { kind: 'constant', value: 3 } },
    ] }],
  }] })
  try {
    const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const deathSource=['magma-mephit','steam-mephit','balor'].includes(use)
    let state = startDnd5eHeadlessCombat('stored', [actor('attacker', ['splash','dragonborn','monster-area','azer','salamander','fire-elemental'].includes(use) ? 20 : 10), actor('bearer', ['splash','dragonborn','monster-area','azer','salamander','fire-elemental'].includes(use) ? 10 : 20), ...(deathSource ? [actor('killer',30),actor('anchor',1)] : [])])
    state.combatants.bearer.pluginFeatureIds = [packageId + ':ward']
    if (use === 'delayed' || use === 'repeat') state.combatants.bearer.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'secondary', definitionId: use === 'delayed' ? 'srd-5.1:spell:acid-arrow:delayed-damage' : 'test:repeat',
      label: 'Secondary', targetId: 'bearer', source: {kind:'spell',actorId:'attacker',spellLevel:2},
      ...(use === 'delayed' ? {potency:6,appliedTurnKey:'earlier',duration:{type:'until-turn-boundary',boundary:'target-turn-end',appliedTurnKey:'earlier'}} as const
        : {repeatSave:{ability:'con',dc:15,timing:'target-turn-end',onSuccess:'remove',damageOnFailure:{count:1,sides:6,type:'fire'}}} as const),
    })]
    if (use === 'rebuke' || use === 'splash') {
      Object.assign(state.combatants.attacker, {controller:'dm',classId:use==='rebuke'?'warlock':'wizard',level:3,
        classSelections:use==='rebuke'?{'spell-known':['hellish-rebuke']}:{'spell-prepared':['acid-arrow']},
        classResources:use==='rebuke'?{'dnd5e-pact-slot':{current:1,max:1}}:{'dnd5e-spell-slot-2':{current:1,max:1}}})
      state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('attacker','bearer')]:30}
    }
    if (use==='dragonborn') Object.assign(state.combatants.attacker,{controller:'dm',level:3,
      racialRules:{halflingLucky:false,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[],dragonbornAncestry:DND5E_DRAGONBORN_ANCESTRIES.find(ancestry=>ancestry.id==='red')},
      classResources:{[DND5E_RACIAL_RESOURCE_KEYS.dragonbornBreath]:{current:1,max:1}}})
    if (use==='monster-area') Object.assign(state.combatants.attacker,{controller:'dm',statBlockId:'srd-5.1:adult-black-dragon',classState:{monsterRechargeReadyByActionId:{'acid-breath':true}}})
    if(use==='solar'){Object.assign(state.combatants.attacker,{controller:'dm',statBlockId:'srd-5.1:solar',classState:{monsterLegendaryActionPoints:3}});state.combatants.bearer.concentrating=true}
    const monsterAttack=['azer','salamander','fire-elemental'].includes(use)
      ? getDnd5eSrdMonster('srd-5.1:'+use)!.actions.find(action=>action.attack?.damage.some(damage=>damage.type==='fire')) : undefined
    if(monsterAttack){Object.assign(state.combatants.attacker,{controller:'dm',statBlockId:'srd-5.1:'+use});state.combatants.bearer.concentrating=true;
      state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('attacker','bearer')]:5}}
    let deathRequest: Dnd5eAction | undefined
    let deathDamage: number | undefined
    if(deathSource){
      const monster=getDnd5eSrdMonster('srd-5.1:'+use)!
      const rule=monster.traits.find(trait=>trait.rule?.kind==='death-area-saving-throw')!.rule!
      if(rule.kind!=='death-area-saving-throw'||!rule.damage)throw Error('Expected death damage')
      Object.assign(state.combatants.attacker,{controller:'dm',statBlockId:monster.id,currentHp:1,usesDeathSaves:false})
      state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('attacker','bearer')]:5,[dnd5eCombatantPairKey('attacker','killer')]:100,[dnd5eCombatantPairKey('attacker','anchor')]:100}
      const killed=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'killer',targetId:'attacker',attackModifier:30,d20:10,damage:{count:1,sides:4,bonus:1000,rolls:[4],type:'force'}})
      expect(killed.ok).toBe(true);state=killed.state
      const snapshot=dnd5ePendingMonsterDeathAreaEffects(state)[0]
      expect(snapshot.targetIds).toEqual(['bearer'])
      deathRequest={type:'resolve-monster-death-area-effect',actorId:'attacker',snapshotId:snapshot.id,resolution:{schemaVersion:1,targetIds:['bearer'],targetSavingThrows:[{targetId:'bearer',d20:1}],damageRolls:Array(rule.damage.count).fill(1)}}
      deathDamage=Math.floor((rule.damage.count+rule.damage.bonus)/2)
    }
    const original=structuredClone(state)
    let confirmations=0
    const options={combatRevision:1,authorityUnchanged:()=>true,
      confirm:async()=>{confirmations++;return {accepted:true}},roll:async()=>{throw Error('No initial dice')}}
    const incoming=use==='area'
      ? (await resolveDnd5ePreparedWithDamageReactions(options,{prepared:{state}},({prepared})=>({result:resolveDnd5ePersistentAreaTrigger(prepared.state,{
        areaId:'flames',sourceId:'attacker',targetId:'bearer',trigger:{id:'burn',label:'Burn',oncePerTurn:false,timing:'turn-start',damage:{count:1,sides:6,type:'fire'}},damageRolls:[6],
      })}))).result
      : await resolveDnd5eActionWithDamageReactions({...options,state,action:deathRequest ?? (monsterAttack ? {type:'monster-action',actorId:'attacker',actionId:monsterAttack.id,rolls:[{targetId:'bearer',d20:15,d20Second:15,damageRolls:monsterAttack.attack!.damage.map(damage=>Array(damage.count).fill(2)),onHitEffectRolls:monsterAttack.attack!.onHitEffects?.map(effect=>({effectId:effect.id}))}]}
        : use==='solar' ? {type:'monster-area-action',actorId:'attacker',actionId:'searing-burst-costs-2-actions',legendary:true,resolution:{schemaVersion:1,targetIds:['bearer'],targetSavingThrows:[{targetId:'bearer',d20:1}],damageRolls:Array(8).fill(1)}}
        : use==='dragonborn' ? {type:'dragonborn-breath',actorId:'attacker',resolution:{schemaVersion:1,targetIds:['bearer'],targetSavingThrows:[{targetId:'bearer',d20:1}],damageRolls:[3,3]}}
        : use==='monster-area' ? {type:'monster-area-action',actorId:'attacker',actionId:'acid-breath',resolution:{schemaVersion:1,targetIds:['bearer'],targetSavingThrows:[{targetId:'bearer',d20:1}],damageRolls:Array(12).fill(1)}}
        : use==='rebuke'
        ? {type:'hellish-rebuke',actorId:'attacker',targetId:'bearer',slotLevel:2,triggerDamageAmount:5,savingThrowD20:1,effectRolls:[2,2,2]}
        : use==='splash' ? {type:'cast-spell',actorId:'attacker',targetId:'bearer',spellId:'acid-arrow',slotLevel:2,castingClassId:'wizard',d20:1,effectRolls:[3,3,3,3]}
        : {type:'end-turn',actorId:'bearer',
        ...(use==='repeat'?{activeEffectSavingThrows:[{effectId:'secondary',d20:1,damageRolls:[6]}]}:{})})})
    expect(incoming.ok,JSON.stringify(incoming)).toBe(true)
    expect(confirmations).toBe(1)
    if(use==='solar'||monsterAttack)expect(incoming.events.filter(event=>event.type==='concentration-check-required')).toHaveLength(1)
    expect(incoming.state.combatants.bearer.currentHp).toBe(deathDamage!=null?30-deathDamage:monsterAttack?30-monsterAttack.attack!.damage.reduce((sum,damage)=>sum+(damage.type==='fire'?Math.floor((damage.count*2+damage.bonus)/2):damage.count*2+damage.bonus),0):use==='monster-area'||use==='solar'?24:27)
    expect(incoming.state.combatants.bearer.turn.reactionAvailable).toBe(false)
    expect(incoming.state.combatants.bearer.classState.activeEffects?.filter(effect=>effect.grantedActivities?.length)).toHaveLength(1)
    if(deathRequest){expect(dnd5ePendingMonsterDeathAreaEffects(incoming.state)).toHaveLength(0);expect(resolveDnd5eHeadlessAction(incoming.state,deathRequest).ok).toBe(false)}
    expect(state).toEqual(original)
  } finally { registration.dispose() }
})
