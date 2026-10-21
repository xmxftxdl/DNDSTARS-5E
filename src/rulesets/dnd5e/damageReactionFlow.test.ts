import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,type Dnd5eAction} from './headlessCombatEngine'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {resolveDnd5eActionWithDamageReactions,resolveDnd5ePreparedWithDamageReactions,type Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {resolveDnd5eActionWithAirborneFallPreview} from './airborneFallActionResolution'
import {listDnd5ePersonalDamageCheckpointActivitiesV1} from './activities/dnd5eActivityTriggerWindows'

it.each(['before-damage', 'reaction-window', 'spell-slot'] as const)('keeps damage checkpoint event and cost boundaries explicit (%s)', mode => {
  const packageId = 'test.checkpoint-boundary'
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'ward', name: 'Synthetic ward', activation: { kind: 'reaction' }, target: { kind: 'self' },
    invocation: { kind: 'triggered', event: mode === 'reaction-window' ? 'reaction-window' : 'before-damage', confirmation: 'actor-choice' },
    legacySource: { kind: 'feature', id: 'ward' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: mode === 'spell-slot' ? [{ kind: 'spell-slot', minimumLevel: 1, level: 'selected', amount: 1, consumeOn: 'resolve' }]
      : [{ kind: 'resource', resourceId: 'test-resource', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [{ id: 'ward', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 2 } }] }],
  }] })
  try {
    const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 12,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const state = startDnd5eHeadlessCombat('boundary', [actor('attacker', 20), actor('defender', 10)])
    state.combatants.defender.classSelections = { spells: [packageId + ':ward'] }
    state.combatants.defender.pluginFeatureIds = [packageId + ':ward']
    state.combatants.defender.classResources = { 'test-resource': { current: 1, max: 1 }, 'dnd5e-spell-slot-1': { current: 2, max: 2 } }
    const before = structuredClone(state)
    const windows = listDnd5ePersonalDamageCheckpointActivitiesV1({ state, eventBatchId: 'boundary',
      checkpoint: { occurrence: 0, targetId: 'defender', sourceId: 'attacker', amount: 6, damageTypes: ['fire'], phase: 'raw-typed-damage-before-defenses' } })
    expect(windows.flatMap(window => window.available).some(entry => entry.packageId === packageId)).toBe(mode === 'before-damage')
    expect(state).toEqual(before)
  } finally { registration.dispose() }
})

it.each((['accept','decline','stale-confirm','stale-roll'] as const).flatMap(mode=>[{mode,facade:false},{mode,facade:true}]))('waits for the remote choice and safely handles %j',async ({mode,facade})=>{
  const registration=registerDnd5eActivityPackage({packageId:'test.remote-ward',packageVersion:'1.0.0',activities:[{
    schemaVersion:1,id:'ward',name:'Ward',activation:{kind:'reaction'},target:{kind:'self'},
    invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},
    legacySource:{kind:'feature',id:'ward'},automation:automationCapabilityFromLegacyStatus('full'),
    consumption:[{kind:'resource',resourceId:'ward-uses',amount:{kind:'constant',value:1},consumeOn:'confirm'}],
    outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'temporary-hit-points',target:'actor',amount:{kind:'dice',count:1,sides:6,rollId:'ward-die'}}]}],
  }]})
  try{
    const actor=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:'player',abilities:{str:14,dex:12,con:12,int:10,wis:10,cha:10},
      proficiencyBonus:2,armorClass:12,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    const state=startDnd5eHeadlessCombat('remote-ward',[actor('attacker',20),actor('defender',10)])
    state.combatants.defender.pluginFeatureIds=['ward']
    state.combatants.defender.classResources['ward-uses']={current:1,max:1}
    const before=structuredClone(state)
    const action:Dnd5eAction={type:'attack',actorId:'attacker',targetId:'defender',d20:18,attackModifier:4,damage:{count:1,sides:6,bonus:2,rolls:[4],type:'fire'}}
    let current=true,rollCount=0
    let answer!:(value:{accepted:boolean})=>void,opened!:()=>void
    const opening=new Promise<void>(resolve=>{opened=resolve})
    const reply=new Promise<{accepted:boolean}>(resolve=>{answer=resolve})
    const options:Dnd5eDamageReactionFlowOptions={combatRevision:1,authorityUnchanged:()=>current,
      confirm:async request=>{
        expect(request.actorId).toBe('defender')
        expect(request.triggerContext.event).toBe('before-damage')
        expect(request.eventId).toBe(request.triggerContext.eventId)
        opened();return reply
      },
      roll:async request=>{
        rollCount++;expect(request).toMatchObject({count:1,sides:6,rollerTokenId:'defender'})
        if(mode==='stale-roll')current=false
        return [4]
      },
    }
    const result=facade
      ? resolveDnd5ePreparedWithDamageReactions(options,{prepared:{state},action},input=>resolveDnd5eActionWithAirborneFallPreview(input.prepared.state,input.action,undefined,{transactionId:'remote-test'})).then(value=>value.result)
      : resolveDnd5eActionWithDamageReactions({...options,state,action,options:{transactionId:'remote-test'}})
    await opening
    expect(state).toEqual(before)
    if(mode==='stale-confirm')current=false
    answer({accepted:mode!=='decline'})
    if(mode.startsWith('stale'))await expect(result).rejects.toThrow('damage-reaction-stale-authority')
    else{
      const settled=await result
      expect(settled.ok,JSON.stringify(settled)).toBe(true)
      expect(settled.state.combatants.defender.currentHp).toBe(mode==='accept'?18:14)
      expect(settled.state.combatants.defender.classResources['ward-uses'].current).toBe(mode==='accept'?0:1)
      expect(settled.state.combatants.defender.turn.reactionAvailable).toBe(mode!=='accept')
      expect(settled.transaction?.id).toBe('remote-test')
    }
    expect(rollCount).toBe(mode==='accept'||mode==='stale-roll'?1:0)
    expect(state).toEqual(before)
  }finally{registration.dispose()}
})
