import {expect,it} from 'vitest'
import {normalizeCharacter,useCharacterStore} from '../../store/characters'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import {reconcileDnd5eCharacterCampaignTime} from './campaignTimeRules'
import {consumeDnd5eRestActivityWindow,openDnd5eRestActivityWindow,normalizeDnd5eRestActivityWindow,recordDnd5eRestActivityWindow} from './restActivityWindows'
import {applyDnd5eInventoryMutation} from './items'
import {createCombatantFromDnd5eCharacter,migrateCharacterToDnd5e} from './character'
import {startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './activities/dnd5eActivityRegistry'
import {settleDnd5eRestActivityV1} from './activities/dnd5eRestActivitySettlement'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {captureDnd5eLongCasting,beginDnd5eLongCasting,armDnd5eLongCasting} from './longCastingContinuity'
import {captureDnd5eRestCastingWindow} from './restActivityCastingWindow'
import {prepareDnd5eRestActivityCastingV1} from './activities/dnd5eRestActivityCasting'

const clock=(minute=480,kind:'long-rest'|'short-rest'='long-rest'):SharedCampaignTimeState=>({schemaVersion:2,worldMinute:minute,displayMode:'campaign-day',displayMinuteOffset:0,timers:[],updatedAt:1,advances:[{id:`advance-${minute}`,kind,fromWorldMinute:0,toWorldMinute:minute,minutes:minute,reason:'Test',dawnsCrossed:0,expiredTimerIds:[],createdAt:1,beneficiaryCharacterIds:['hero']}]})
const character=()=>normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:1,currentHp:2,maxHp:10,dnd5eWorldTimeAppliedMinute:0,equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}})

it.each([false,true])('settles a timed rest activity and preserves its new concentration when required: %s',newConcentration=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'timed',name:'Timed',activation:{kind:'minute',value:1},invocation:{kind:'triggered',event:'short-rest-complete',confirmation:'actor-choice',retention:'single-event'},target:{kind:'self'},legacySource:{kind:'feature',id:'timed'},automation:automationCapabilityFromLegacyStatus('partial'),consumption:[{kind:'resource',resourceId:'focus',amount:{kind:'constant',value:1},consumeOn:'resolve'}],outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]}
 const resolvedActivity:Dnd5eActivityDefinitionV1=newConcentration?{...activity,
  spellInvocation:{spellId:'scrying',castAtLevel:5,operationIds:['lasting']},
  effects:[{schemaVersion:1,id:'lasting',name:'Lasting',duration:{kind:'concentration',maximumRounds:10},concentration:true,stacking:'replace',conditions:['blinded']}],
  outcomes:[{...activity.outcomes[0],operations:[...activity.outcomes[0].operations,{id:'lasting',kind:'apply-effect',target:'actor',effectId:'lasting'}]}]}:activity
 registerDnd5eActivityPackage({packageId:'test.rest',packageVersion:'1.0.0',activities:[resolvedActivity]})
 try{
  const startClock=clock(60,'short-rest')
  const owner=reconcileDnd5eCharacterCampaignTime(character(),startClock).character
  const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
  actor.pluginFeatureIds=['timed'];actor.classResources={focus:{current:1,max:1}};actor.campaignWorldMinute=60
  const state=startDnd5eHeadlessCombat('rest',[actor]);state.active=false
  const command={schemaVersion:1 as const,commandId:'timed-cast',packageId:'test.rest',packageVersion:'1.0.0',activityId:'timed',actorId:'hero',targetIds:['hero'],expectedRevision:1}
  const input={state,combatRevision:1,actorCharacter:owner,clock:startClock,restEventId:owner.dnd5eRestActivityWindow!.eventId,decision:'use' as const,confirmedBy:'actor' as const,authoritativeRolls:{},command}
  expect(settleDnd5eRestActivityV1(input)).toEqual({ok:false,reason:'rest-casting-incomplete'})
  const startBefore=structuredClone(state)
  const rejectedState=structuredClone(state);rejectedState.combatants.hero.classResources.focus.current=0
  expect(prepareDnd5eRestActivityCastingV1({...input,state:rejectedState,mapId:'map'})).toEqual({ok:false,reason:'requirement-failed'})
  expect(prepareDnd5eRestActivityCastingV1({...input,mapId:'map',clock:{...startClock,advances:[]}}).ok).toBe(false)
  expect(prepareDnd5eRestActivityCastingV1({...input,mapId:'map',command:{...command,expectedRevision:9}}).ok).toBe(false)
  const casting={requestId:command.commandId,spellId:newConcentration?'scrying':'test.rest:timed',mapId:'map',actorTokenId:'hero',actorCharacterId:'hero'}
  const binding={packageId:command.packageId,packageVersion:command.packageVersion,activityId:command.activityId,restEventId:input.restEventId,casting}
  const make=(seconds:number)=>{
   if(seconds===60){
    const start=prepareDnd5eRestActivityCastingV1({...input,mapId:'map'})
    expect(start.ok,JSON.stringify(start)).toBe(true)
    if(!start.ok)throw Error('start rejected')
    expect(state).toEqual(startBefore)
    expect(start.state.combatants.hero.classResources.focus.current).toBe(1)
    expect(owner.dnd5eRestActivityWindow!.receipts).toEqual({})
    expect(armDnd5eLongCasting(start.castingReceipt,start.castingContinuation.binding.casting,start.state.combatants.hero)).toBe(true)
    start.state.combatants.hero.campaignWorldMinute=61
    return {...input,state:start.state,actorCharacter:{...owner,dnd5eWorldTimeAppliedMinute:61},clock:{...startClock,worldMinute:61},castingContinuation:start.castingContinuation}
   }
   const cast=captureDnd5eLongCasting(casting,actor,undefined,{startedAtWorldMinute:60,requiredSeconds:seconds})!
   const receipt=captureDnd5eRestCastingWindow({character:owner,clock:startClock,binding,castingReceipt:cast})!
   const started=beginDnd5eLongCasting(cast,casting,state)!
   expect(armDnd5eLongCasting(cast,casting,started.combatants.hero)).toBe(true)
   started.combatants.hero.campaignWorldMinute=61
   return {...input,state:started,actorCharacter:{...owner,dnd5eWorldTimeAppliedMinute:61},clock:{...startClock,worldMinute:61},castingContinuation:{receipt,binding}}
  }
  expect(settleDnd5eRestActivityV1(make(6))).toEqual({ok:false,reason:'rest-casting-incomplete'})
  const completion=make(60),before=structuredClone(completion.state)
  expect(settleDnd5eRestActivityV1({...completion,castingContinuation:JSON.parse(JSON.stringify(completion.castingContinuation))}).ok).toBe(false)
  expect(settleDnd5eRestActivityV1({...completion,command:{...command,commandId:'other'}}).ok).toBe(false)
  const exhausted=structuredClone(completion.state);exhausted.combatants.hero.classResources.focus.current=0
  const exhaustedBefore=structuredClone(exhausted)
  expect(settleDnd5eRestActivityV1({...completion,state:exhausted}).ok).toBe(false)
  expect(exhausted).toEqual(exhaustedBefore)
  expect(completion.actorCharacter.dnd5eRestActivityWindow!.receipts).toEqual({})
  const unentitled=structuredClone(completion.state);unentitled.combatants.hero.pluginFeatureIds=[];unentitled.combatants.hero.classSelections={}
  expect(settleDnd5eRestActivityV1({...completion,state:unentitled})).toEqual({ok:false,reason:'rest-activity-unavailable'})
  const used=settleDnd5eRestActivityV1(completion)
  expect(used.ok,JSON.stringify(used)).toBe(true)
  if(!used.ok||used.outcome!=='used'||used.resolution.phase!=='commit'||!used.resolution.result.ok)throw Error('timed rest failed')
  expect(used.resolution.result.state.combatants.hero.classResources.focus.current).toBe(0)
  expect(used.resolution.result.state.combatants.hero.temporaryHp).toBe(3)
  expect(used.resolution.result.state.combatants.hero.concentrating).toBe(newConcentration)
  const concentrationId=used.resolution.result.state.combatants.hero.classState.concentrationSpellId
  if(newConcentration)expect(concentrationId).toBe('scrying')
  else expect(concentrationId).toBeUndefined()
  expect(completion.state).toEqual(before)
  expect(settleDnd5eRestActivityV1({...completion,actorCharacter:{...completion.actorCharacter,...used.receiptPatch}}).ok).toBe(false)
 }finally{clearDnd5eActivityRegistryForTests()}
})

it('rejects a missing rest portal destination before spending resource or recording use',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'return',name:'Return',activation:{kind:'free'},invocation:{kind:'triggered',event:'short-rest-complete',confirmation:'actor-choice',retention:'single-event'},target:{kind:'area',origin:'self',shape:'sphere',radiusFeet:5,relation:'any',includeSelf:true},legacySource:{kind:'feature',id:'return'},automation:automationCapabilityFromLegacyStatus('full'),consumption:[{kind:'resource',resourceId:'focus',amount:{kind:'constant',value:1},consumeOn:'resolve'}],outcomes:[{id:'portal',when:{kind:'always'},operations:[{id:'portal',kind:'create-persistent-area',label:'Portal',durationRounds:1,concentration:false,teleportationPortal:{destination:'last-long-rest'}}]}]}
 registerDnd5eActivityPackage({packageId:'test.rest',packageVersion:'1.0.0',activities:[activity]})
 try{
  const owner=reconcileDnd5eCharacterCampaignTime(character(),clock(60,'short-rest')).character
  const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
  actor.pluginFeatureIds=['return'];actor.classResources={focus:{current:1,max:1}}
  const state=startDnd5eHeadlessCombat('rest',[actor])
  const input={state,combatRevision:1,actorCharacter:owner,clock:clock(60,'short-rest'),restEventId:owner.dnd5eRestActivityWindow!.eventId,decision:'use' as const,confirmedBy:'actor' as const,authoritativeRolls:{},command:{schemaVersion:1 as const,commandId:'return',packageId:'test.rest',packageVersion:'1.0.0',activityId:'return',actorId:'hero',targetIds:[],expectedRevision:1}}
  const before=structuredClone(input)
  expect(settleDnd5eRestActivityV1(input)).toEqual({ok:false,reason:'rest-destination-unavailable'})
  expect(input).toEqual(before)
  expect(state.combatants.hero.classResources.focus.current).toBe(1)
  expect(owner.dnd5eRestActivityWindow?.receipts).toEqual({})
 }finally{clearDnd5eActivityRegistryForTests()}
})

it('production store reconciliation persists the rest event and does not recreate a declined choice',()=>{
 const previous=useCharacterStore.getState()
 try{
  useCharacterStore.setState({characters:[character()],selectedId:'hero'})
  expect(useCharacterStore.getState().reconcileCampaignTime(clock()).longRestsApplied).toBe(1)
  const current=useCharacterStore.getState().characters[0]
  const declined=consumeDnd5eRestActivityWindow(current,{worldMinute:480,eventId:current.dnd5eRestActivityWindow!.eventId,packageId:'test.rest',activityId:'bless',outcome:'declined'})!
  useCharacterStore.setState({characters:[normalizeCharacter(JSON.parse(JSON.stringify(declined)))]})
  expect(useCharacterStore.getState().reconcileCampaignTime(clock()).longRestsApplied).toBe(0)
  expect(useCharacterStore.getState().characters[0].dnd5eRestActivityWindow).toEqual(declined.dnd5eRestActivityWindow)
 }finally{useCharacterStore.setState(previous)}
})

it('only successful current rest produces a persisted one-use choice; refresh and historical baselines do not reopen it',()=>{
 const source=character(),result=reconcileDnd5eCharacterCampaignTime(source,clock())
 expect(result.longRestsApplied).toBe(1)
 const window=openDnd5eRestActivityWindow(result.character,480)!
 expect(window.event).toBe('long-rest-complete')
 const consumed=consumeDnd5eRestActivityWindow(result.character,{worldMinute:480,eventId:window.eventId,packageId:'test.rest',activityId:'bless',outcome:'used'})!
 const saved=normalizeCharacter(JSON.parse(JSON.stringify(consumed)))
 const refreshed=reconcileDnd5eCharacterCampaignTime(saved,clock())
 expect(refreshed.longRestsApplied).toBe(0)
 expect(consumeDnd5eRestActivityWindow(refreshed.character,{worldMinute:480,eventId:window.eventId,packageId:'test.rest',activityId:'bless',outcome:'used'})).toBeUndefined()
 expect(source.dnd5eRestActivityWindow).toBeUndefined()
 expect(reconcileDnd5eCharacterCampaignTime({...source,dnd5eWorldTimeAppliedMinute:undefined},clock()).character.dnd5eRestActivityWindow).toBeUndefined()
 const blocked=reconcileDnd5eCharacterCampaignTime(saved,clock(960))
 expect(blocked.longRestsBlocked).toBe(1)
 expect(openDnd5eRestActivityWindow(blocked.character,960)).toBeUndefined()
 expect(recordDnd5eRestActivityWindow(saved,'long-rest-complete',480).dnd5eRestActivityWindow).toEqual(saved.dnd5eRestActivityWindow)
})

it('excludes non-beneficiaries, expires after time advances and fails closed on corrupt or copied ledgers',()=>{
 const current=reconcileDnd5eCharacterCampaignTime(character(),clock()).character
 expect(reconcileDnd5eCharacterCampaignTime({...character(),id:'other'},clock()).character.dnd5eRestActivityWindow).toBeUndefined()
 expect(openDnd5eRestActivityWindow(current,481)).toBeUndefined()
 expect(openDnd5eRestActivityWindow({...current,id:'other'},480)).toBeUndefined()
 const malformed={...current.dnd5eRestActivityWindow!,receipts:{bad:'used'}}
 expect(normalizeDnd5eRestActivityWindow(malformed,'hero')).toBeUndefined()
 expect(openDnd5eRestActivityWindow({...current,dnd5eLastLongRestWorldMinute:0},480)).toBeUndefined()
 const short=reconcileDnd5eCharacterCampaignTime(character(),clock(60,'short-rest')).character
 expect(openDnd5eRestActivityWindow(short,60)?.event).toBe('short-rest-complete')
})

it('derives rest authorization from Host clock and commits a single inventory binding with a replay receipt',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'bless',name:'Bless',activation:{kind:'free'},invocation:{kind:'triggered',event:'long-rest-complete',confirmation:'actor-choice',retention:'single-event'},target:{kind:'self'},legacySource:{kind:'feature',id:'bless'},automation:automationCapabilityFromLegacyStatus('full'),consumption:[{kind:'resource',resourceId:'focus',amount:{kind:'constant',value:1},consumeOn:'resolve'}],effects:[{schemaVersion:1,id:'bound',name:'Bound',stacking:'replace',duration:{kind:'permanent'},breakOn:['source-long-rest-complete'],modifiers:[{kind:'armor-enchantment',itemSelection:'inventory-item',requiresNonmagical:true,armorClassBonus:{kind:'constant',value:1}}]}],outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'bind',kind:'apply-effect',target:'actor',effectId:'bound'}]}]}
 registerDnd5eActivityPackage({packageId:'test.rest',packageVersion:'1.0.0',activities:[activity]})
 try{
  const compiled=compileDnd5eActivityHeadlessAction(activity)
  if(!compiled.resolve)throw Error('compiled rest action is missing its resolver')
  const rejectedTransport=compiled.resolve({fail:(reason:string)=>({rejected:reason})} as never)
  expect(rejectedTransport).toEqual({rejected:'invalid-plugin-action'})
  const granted=applyDnd5eInventoryMutation([character()],{type:'grant',characterId:'hero',templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1})
  const owner=reconcileDnd5eCharacterCampaignTime(granted.characters[0],clock()).character
  const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
  actor.pluginFeatureIds=['bless'];actor.classResources={focus:{current:1,max:1}}
  const state=startDnd5eHeadlessCombat('rest',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1,pluginFeatureIds:[]}])
  const input={state,combatRevision:1,actorCharacter:owner,clock:clock(),restEventId:owner.dnd5eRestActivityWindow!.eventId,decision:'use' as const,confirmedBy:'actor' as const,inventoryOwner:owner,inventoryRoster:[owner],authoritativeRolls:{},command:{schemaVersion:1 as const,commandId:'rest-bless',packageId:'test.rest',packageVersion:'1.0.0',activityId:'bless',actorId:'hero',targetIds:['hero'],expectedRevision:1,inventoryOwnerId:'hero',inventoryInstanceId:owner.dnd5eInventory!.entries[0].instanceId,expectedInventoryRevision:owner.dnd5eInventory!.revision??0}}
  const before=structuredClone(input)
  expect(settleDnd5eRestActivityV1({...input,clock:{...clock(),advances:[]}}).ok).toBe(false)
  expect(settleDnd5eRestActivityV1({...input,clock:{...clock(),worldMinute:481}}).ok).toBe(false)
  expect(settleDnd5eRestActivityV1({...input,command:{...input.command,expectedInventoryRevision:999}}).ok).toBe(false)
  expect(input).toEqual(before)
  const used=settleDnd5eRestActivityV1(input)
  expect(used.ok,JSON.stringify(used)).toBe(true)
  if(!used.ok||used.outcome!=='used'||used.resolution.phase!=='commit'||!used.resolution.result.ok)throw Error('rest settlement failed')
  expect(used.resolution.result.state.combatants.hero.classResources?.focus.current).toBe(0)
  expect(used.resolution.result.state.combatants.hero.classState.activeEffects?.[0].source.lastLongRestWorldMinute).toBe(480)
  const committedOwner={...owner,...used.receiptPatch}
  expect(settleDnd5eRestActivityV1({...input,actorCharacter:committedOwner}).ok).toBe(false)
  const declined=settleDnd5eRestActivityV1({...input,decision:'decline'})
  expect(declined.ok).toBe(true)
  if(!declined.ok)throw Error('decline failed')
  expect(settleDnd5eRestActivityV1({...input,actorCharacter:{...owner,...declined.receiptPatch}}).ok).toBe(false)
 }finally{clearDnd5eActivityRegistryForTests()}
})
