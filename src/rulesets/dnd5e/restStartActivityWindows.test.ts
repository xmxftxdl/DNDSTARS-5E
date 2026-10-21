import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {normalizeSharedCampaignTime} from '../../lib/campaignTime'
import {mutateCampaignTimeState} from '../../../scripts/shared-server-core.mjs'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {createCombatantFromDnd5eCharacter,migrateCharacterToDnd5e} from './character'
import {startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {settleDnd5eRestActivityV1} from './activities/dnd5eRestActivitySettlement'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {openDnd5eRestStartActivityWindow} from './restStartActivityWindows'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'

it.each(['short-rest','long-rest'] as const)('authorizes %s start from the active session and consumes once',kind=>{
  const host={memberId:'host',role:'dm'},context={host,restCharacterIds:['hero']}
  const started=mutateCampaignTimeState(null,{operation:'start-rest-session',id:'rest-1',kind,characterIds:['hero'],expectedWorldMinute:480},1,host,context)
  expect(started.ok).toBe(true);if(!started.ok)throw Error(started.error)
  const clock=normalizeSharedCampaignTime(started.next)
  const owner=normalizeCharacter({id:'hero',name:'Hero',currentHp:20,maxHp:20,dnd5eWorldTimeAppliedMinute:480})
  const window=openDnd5eRestStartActivityWindow(owner,clock)!
  expect(window.event).toBe(`${kind}-started`)
  expect(openDnd5eRestStartActivityWindow({...owner,id:'other'},clock)).toBeUndefined()
  const corrupt=normalizeCharacter({...owner,dnd5eRestStartActivityWindow:{schemaVersion:1,characterId:'hero',sessionId:'rest-1',receipts:{bad:'used'}}})
  expect(openDnd5eRestStartActivityWindow(corrupt,clock)).toBeUndefined()
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'start',name:'Synthetic rest start',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'start'},
    automation:automationCapabilityFromLegacyStatus('full'),invocation:{kind:'triggered',event:window.event,confirmation:'actor-choice',retention:'single-event'},
    outcomes:[{id:'effect',when:{kind:'always'},operations:[{id:'grant',kind:'temporary-hit-points',target:'actor',amount:{kind:'dice',rollId:'grant',count:1,sides:6}}]}]}
  const registration=registerDnd5eActivityPackage({packageId:'test.rest-start',packageVersion:'1.0.0',activities:[activity]})
  try{
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
    actor.pluginFeatureIds=['start']
    const state=startDnd5eHeadlessCombat('rest',[actor]);state.active=false
    const input={state,actorCharacter:owner,clock,combatRevision:1,restEventId:window.eventId,decision:'use' as const,confirmedBy:'actor' as const,authoritativeRolls:{grant:{values:[4]}},
      command:{schemaVersion:1 as const,commandId:'start',packageId:'test.rest-start',packageVersion:'1.0.0',activityId:'start',actorId:'hero',targetIds:['hero'],expectedRevision:1}}
    const invalid=settleDnd5eRestActivityV1({...input,authoritativeRolls:{grant:{values:[99]}}})
    expect(invalid.ok).toBe(false);expect(invalid).not.toHaveProperty('receiptPatch')
    const used=settleDnd5eRestActivityV1(input)
    expect(used.ok,JSON.stringify(used)).toBe(true)
    if(!used.ok||used.outcome!=='used')throw Error('not settled')
    expect(used.resolution.result.state.combatants.hero.temporaryHp).toBe(4)
    expect(used.resolution.result.state.active).toBe(false)
    const saved=normalizeCharacter(JSON.parse(JSON.stringify({...owner,...used.receiptPatch})))
    expect(settleDnd5eRestActivityV1({...input,actorCharacter:saved}).ok).toBe(false)
    const declined=settleDnd5eRestActivityV1({...input,decision:'decline'})
    expect(declined.ok).toBe(true)
    if(declined.ok)expect(settleDnd5eRestActivityV1({...input,actorCharacter:{...owner,...declined.receiptPatch}}).ok).toBe(false)
    for(const operation of ['interrupt-rest-session','complete-rest-session']){
      const result=mutateCampaignTimeState(clock,{operation,id:'rest-1',expectedWorldMinute:480},2,host,context)
      expect(result.ok).toBe(true)
      if(result.ok)expect(settleDnd5eRestActivityV1({...input,clock:normalizeSharedCampaignTime(result.next)}).ok).toBe(false)
    }
    const compiled=compileDnd5eActivityHeadlessAction(activity)
    expect(compiled.resolve!({fail:(reason:string)=>({reason})} as never)).toEqual({reason:'invalid-plugin-action'})
    expect(owner.dnd5eRestStartActivityWindow).toBeUndefined()
  }finally{registration.dispose()}
})
