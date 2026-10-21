import {dnd5eWeaponAttackProfile} from './equipment'
import {consumeDnd5eWeaponAmmunition} from './items'
import {it,expect} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eInventoryGrantBundle,applyDnd5eInventoryMutation,expireDnd5eReleasedWeapons,dnd5eInventoryEntryIsActive} from './items'
import {compileDnd5eActivityPatternV1} from './activities/dnd5eActivityPatterns'
import {resolveDnd5eActivity,type Dnd5eActivityActorSnapshot} from './activities/dnd5eActivityExecutor'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {expireDnd5eSourceBoundInventory,releaseDnd5eTemporaryWeapon} from './items'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,endDnd5eConcentration,type Dnd5eCombatEvent} from './headlessCombatEngine'
import {planDnd5eMapResultApplication} from './mapBridge'
import type {BattleMap} from '../../store/maps'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import {resolveAndCommitDnd5eActivityCommand} from './activities/dnd5eActivityHeadlessAuthorityBridge'
const tag='item-lease:11111111-1111-1111-1111-111111111111'
it.each(['discard','release'] as const)('preserves imported recall bindings through %s, reload, expiry and source cleanup',async mode=>{
 const namespace='test.archived-recall'
 const automation=automationCapabilityFromLegacyStatus('full')
 const recall=compileDnd5eActivityPatternV1({schemaVersion:1,id:'recall',name:'Recall',source:{kind:'spell',id:'blade-spell'},activation:{kind:'bonus-action'},target:{kind:'self'},pattern:'conjured-item',item:{target:'actor',templateId:'blade',templateVariants:[{minimumCastLevel:7,templateId:'greater-blade'}],quantity:{kind:'constant',value:1},sourceEffectId:'parent',reuseSourceEffect:true,maximumPerSource:1}})
 const cast=compileDnd5eActivityPatternV1({schemaVersion:1,id:'cast',name:'Create weapon',source:{kind:'spell',id:'blade-spell'},activation:{kind:'bonus-action'},target:{kind:'self'},pattern:'grant-actions',recipient:'actor',actionIds:['recall'],effect:{schemaVersion:1,id:'parent',name:'Synthetic weapon source',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'source-turn-end'},concentration:true},consumption:[{kind:'spell-slot',minimumLevel:3,level:'selected',amount:1,consumeOn:'resolve'}]})
 cast.outcomes=[...cast.outcomes,{id:'weapon',when:{kind:'always'},operations:[{id:'weapon',kind:'grant-inventory-item',target:'actor',templateId:'blade',templateVariants:[{minimumCastLevel:7,templateId:'greater-blade'}],quantity:{kind:'constant',value:1},sourceEffectId:'parent',maximumPerSource:1}]}]
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Synthetic recall',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},definitions:[
  {schemaVersion:1,namespace,version:'1.0.0',kind:'spell',id:'blade-spell',name:'Synthetic blade',automation,payload:{id:'blade-spell',name:'Synthetic blade',level:3,school:'illusion',ritual:false,castingTime:{value:1,unit:'bonus-action'},range:{type:'self'},components:{verbal:true,somatic:true,material:false},duration:{type:'timed',value:1,unit:'minute',concentration:true},classes:['wizard'],description:'Synthetic test spell',automation:{mode:'reference-only'}},activities:[cast,recall]},
  ...['blade','greater-blade'].map((id):Extract<Dnd5eUnifiedContentBundleV1['definitions'][number],{kind:'item'}>=>({schemaVersion:1,namespace,version:'1.0.0',kind:'item',id,name:id,automation,payload:{id,name:id,description:'Synthetic',rulesText:'Synthetic',icon:'sword',category:'equipment',stackable:false,equipment:{slot:'mainWeapon',dnd5e:{kind:'weapon',category:'simple',mode:'melee',attackAbility:'finesse',vanishesAfterRelease:true,damage:{count:id==='blade'?2:5,sides:8,type:'psychic'}}}}}))]}
 const first=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const second=await readDnd5eStarMod(await exportDnd5eStarMod(first.bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(second.bundle))
 try{
  const activity=getRegisteredDnd5eActivity(namespace,'recall')!
  const snapshot:Dnd5eActivityActorSnapshot={id:'actor',controller:'players',level:10,proficiencyBonus:4,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:10,conditions:[],activeEffectDefinitionIds:[{definitionId:'activity:cast:parent',sourceActorId:'actor',tags:[tag],spellLevel:3}]}
  const resolved=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{},castLevel:9})
  expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
  if(!resolved.ok)throw new Error('Recall failed')
  const grants=resolved.proposals.filter(proposal=>proposal.kind==='grant-inventory-item')
  expect(grants).toHaveLength(1)
  expect(grants[0]).toMatchObject({templateId:`${namespace}:blade`,sourceEffectTag:tag})
  const actor=normalizeCharacter({id:'actor',name:'Actor',equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}})
  const created=applyDnd5eInventoryGrantBundle([actor],{characterId:'actor',receiptId:'create',grants})
  expect(created.ok).toBe(true)
  const entry=created.characters[0].dnd5eInventory!.entries[0]
  const equipped=applyDnd5eInventoryMutation(created.characters,{type:'equip',characterId:'actor',instanceId:entry.instanceId})
  expect(equipped.ok).toBe(true)
  const released=mode==='discard'?applyDnd5eInventoryMutation(equipped.characters,{type:'discard',characterId:'actor',instanceId:entry.instanceId,quantity:1}).characters[0]:releaseDnd5eTemporaryWeapon(equipped.characters[0],entry.item.equipment!.id)
  const reloaded:typeof actor=JSON.parse(JSON.stringify(released))
  expect(reloaded.equipment?.mainWeapon).toBeUndefined()
  expect(dnd5eInventoryEntryIsActive(reloaded.dnd5eInventory!.entries[0])).toBe(false)
  expect(applyDnd5eInventoryGrantBundle([reloaded],{characterId:'actor',receiptId:'too-soon',grants}).ok).toBe(false)
  expect(expireDnd5eReleasedWeapons(reloaded,new Set(['other']))).toBe(reloaded)
  const expired=expireDnd5eReleasedWeapons(reloaded,new Set(['actor']))
  expect(expired.dnd5eInventory!.entries).toHaveLength(0)
  const recalled=applyDnd5eInventoryGrantBundle([expired],{characterId:'actor',receiptId:'recall',grants})
  expect(recalled.ok).toBe(true)
  expect(applyDnd5eInventoryGrantBundle(recalled.characters,{characterId:'actor',receiptId:'duplicate',grants}).ok).toBe(false)
  const live=recalled.characters[0]
  expect(expireDnd5eSourceBoundInventory(live,new Set([tag]),new Set(['actor']))).toBe(live)
  const cleaned=expireDnd5eSourceBoundInventory(live,new Set(),new Set(['actor']))
  expect(cleaned.dnd5eInventory!.entries).toHaveLength(0)
  expect(resolveDnd5eActivity({activity,actor:{...snapshot,activeEffectDefinitionIds:[]},targets:[snapshot],rolls:{}}).ok).toBe(false)
  // Exercise the registered Host transaction with real effects and action costs.
  const combatant=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:snapshot.abilities,proficiencyBonus:4,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classResources:{'dnd5e-spell-slot-3':{current:1,max:1}}})
  const initial=startDnd5eHeadlessCombat('recall-authority',[combatant,{...structuredClone(combatant),id:'enemy',controller:'dm',initiative:10}])
  const invoke=(state:typeof initial,owner:typeof actor,activityId:string,commandId:string,castLevel?:number)=>{
   const current=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
   return resolveAndCommitDnd5eActivityCommand(state,{command:{schemaVersion:1,commandId,actorId:'actor',packageId:namespace,packageVersion:'1.0.0',activityId,targetIds:['actor'],castLevel,expectedRevision:0},currentRevision:0,actor:current,targets:[current],authoritativeRolls:{},distanceFeetByTargetId:{actor:0},inventoryOwner:owner,inventoryRoster:[owner]})
  }
  const firstCast=invoke(initial,actor,'cast','host-cast',3)
  expect(firstCast.phase,JSON.stringify(firstCast)).toBe('commit')
  if(firstCast.phase!=='commit'||!firstCast.result.ok)throw new Error(JSON.stringify(firstCast))
  const committed=firstCast.result
  expect(committed.state.combatants.actor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
  expect(committed.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
  expect(committed.state.combatants.actor.concentrating).toBe(true)
  expect(committed.inventoryOwner!.dnd5eInventory!.entries).toHaveLength(1)
  const sourceSnapshot=dnd5eActivityActorSnapshotFromCombatantV1(committed.state.combatants.actor)
  expect(sourceSnapshot.activeEffectDefinitionIds).toEqual(expect.arrayContaining([expect.objectContaining({spellLevel:3})]))
  const hostEntry=committed.inventoryOwner!.dnd5eInventory!.entries[0]
  const hostEquipped=applyDnd5eInventoryMutation([committed.inventoryOwner!],{type:'equip',characterId:'actor',instanceId:hostEntry.instanceId})
  const hostReleased=mode==='discard'?applyDnd5eInventoryMutation(hostEquipped.characters,{type:'discard',characterId:'actor',instanceId:hostEntry.instanceId,quantity:1}).characters[0]:releaseDnd5eTemporaryWeapon(hostEquipped.characters[0],hostEntry.item.equipment!.id)
  const ended=resolveDnd5eHeadlessAction(committed.state,{type:'end-turn',actorId:'actor'})
  expect(ended.ok).toBe(true)
  const cleared=expireDnd5eReleasedWeapons(hostReleased,new Set(ended.events.flatMap(event=>event.type==='turn-ended'?[event.actorId]:[])))
  expect(cleared.dnd5eInventory!.entries).toHaveLength(0)
  const nextTurn=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'enemy'})
  expect(nextTurn.ok).toBe(true)
  expect(dnd5eActivityActorSnapshotFromCombatantV1(nextTurn.state.combatants.actor).activeEffectDefinitionIds,JSON.stringify({initial:sourceSnapshot.activeEffectDefinitionIds,after:nextTurn.state.combatants.actor.classState})).toEqual(expect.arrayContaining([expect.objectContaining({tags:expect.arrayContaining([hostEntry.sourceEffectTag])})]))
  const recalledCommand=invoke(nextTurn.state,cleared,'recall','host-recall',9)
  expect(recalledCommand.phase,JSON.stringify({result:recalledCommand,snapshot:dnd5eActivityActorSnapshotFromCombatantV1(nextTurn.state.combatants.actor),operations:activity.outcomes})).toBe('commit')
  if(recalledCommand.phase!=='commit'||!recalledCommand.result.ok)throw new Error(JSON.stringify(recalledCommand))
  const recalledResult=recalledCommand.result
  expect(recalledResult.inventoryOwner!.dnd5eInventory!.entries).toHaveLength(1)
  expect(recalledResult.inventoryOwner!.dnd5eInventory!.entries[0].templateId).toBe(`${namespace}:blade`)
  expect(recalledResult.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
  expect(recalledResult.state.combatants.actor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
  const replay=invoke(recalledResult.state,recalledResult.inventoryOwner!,'recall','host-recall',9)
  expect(replay).toMatchObject({phase:'commit',result:{ok:true,inventoryDeduplicated:true,events:[]}})
  const duplicate=invoke(recalledResult.state,recalledResult.inventoryOwner!,'recall','host-recall-duplicate',9)
  expect(duplicate.result.ok).toBe(false)
  const depleted=structuredClone(initial)
  depleted.combatants.actor.classResources['dnd5e-spell-slot-3'].current=0
  const rejected=invoke(depleted,actor,'cast','host-no-slot',3)
  expect(rejected.result.ok).toBe(false)
  expect(actor.dnd5eInventory!.entries).toHaveLength(0)
  expect(depleted.combatants.actor.turn.bonusActionAvailable).toBe(true)
  const recalledEntry=recalledResult.inventoryOwner!.dnd5eInventory!.entries[0]
  const lastEquipped=applyDnd5eInventoryMutation([recalledResult.inventoryOwner!],{type:'equip',characterId:'actor',instanceId:recalledEntry.instanceId})
  expect(lastEquipped.ok).toBe(true)
  expect(lastEquipped.characters[0].equipment?.mainWeapon).toBeDefined()
  const stopped=structuredClone(recalledResult.state)
  const events:Dnd5eCombatEvent[]=[]
  endDnd5eConcentration(stopped,stopped.combatants.actor,events)
  expect(stopped.combatants.actor.concentrating).toBe(false)
  const map:BattleMap={id:'recall-map',name:'Map',width:100,height:100,gridSize:10,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'actor',characterId:'actor',label:'Actor',x:0,y:0,color:'',emoji:'',size:1,type:'player',hp:30,maxHp:30},{id:'enemy',label:'Enemy',x:50,y:50,color:'',emoji:'',size:1,type:'enemy',hp:30,maxHp:30}]}
  const applied=planDnd5eMapResultApplication({state:stopped,map,characters:lastEquipped.characters,characterIdByCombatantId:{actor:'actor'},events})
  const persisted=JSON.parse(JSON.stringify(applied.characters[0])) as typeof actor
  expect(persisted.dnd5eInventory!.entries).toHaveLength(0)
  expect(persisted.equipment?.mainWeapon).toBeUndefined()
  expect(applied.characterPatches?.actor.dnd5eInventory?.entries).toHaveLength(0)
  expect(invoke(stopped,persisted,'recall','after-concentration',3).result.ok).toBe(false)
  expect(initial.combatants.actor.classResources['dnd5e-spell-slot-3'].current).toBe(1)
 }finally{dispose()}
})
it('defers disappearance until releasing actor turn end and blocks early or duplicate recall',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.temporary',name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerItem({id:'blade',name:'Blade',description:'Synthetic',rulesText:'Synthetic',icon:'sword',category:'equipment',stackable:false,equipment:{slot:'mainWeapon',dnd5e:{kind:'weapon',category:'simple',mode:'melee',attackAbility:'finesse',damage:{count:2,sides:8,type:'psychic'},vanishesAfterRelease:true}}})}})
 try {
  const actor=normalizeCharacter({id:'actor',name:'Actor',equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}})
  const grant={templateId:'test.temporary:blade',quantity:1,sourceEffectTag:tag,maximumPerSource:1}
  const initial=applyDnd5eInventoryGrantBundle([actor],{characterId:'actor',receiptId:'first',grants:[grant]})
  expect(initial.ok).toBe(true)
  const item=initial.characters[0].dnd5eInventory!.entries[0]
  const equipped=applyDnd5eInventoryMutation(initial.characters,{type:'equip',characterId:'actor',instanceId:item.instanceId})
  const dropped=applyDnd5eInventoryMutation(equipped.characters,{type:'discard',characterId:'actor',instanceId:item.instanceId,quantity:1})
  expect(dropped.ok).toBe(true)
  expect(dropped.characters[0].equipment?.mainWeapon).toBeUndefined()
  expect(dnd5eInventoryEntryIsActive(dropped.characters[0].dnd5eInventory!.entries[0])).toBe(false)
  expect(applyDnd5eInventoryGrantBundle(dropped.characters,{characterId:'actor',receiptId:'early',grants:[grant]}).ok).toBe(false)
  expect(expireDnd5eReleasedWeapons(dropped.characters[0],new Set(['other']))).toBe(dropped.characters[0])
  const ended=expireDnd5eReleasedWeapons(dropped.characters[0],new Set(['actor']))
  expect(ended.dnd5eInventory!.entries).toHaveLength(0)
  const recalled=applyDnd5eInventoryGrantBundle([ended],{characterId:'actor',receiptId:'recall',grants:[grant]})
  expect(recalled.ok).toBe(true)
  expect(applyDnd5eInventoryGrantBundle(recalled.characters,{characterId:'actor',receiptId:'duplicate',grants:[grant]}).ok).toBe(false)
 } finally {dispose()}
})
it('recall uses the source effect slot instead of a caller-supplied upcast',()=>{
 const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'recall',name:'Recall',source:{kind:'spell',id:'synthetic'},activation:{kind:'bonus-action'},target:{kind:'self'},pattern:'conjured-item',item:{target:'actor',templateId:'base',templateVariants:[{minimumCastLevel:7,templateId:'high'}],quantity:{kind:'constant',value:1},sourceEffectId:'parent',reuseSourceEffect:true,maximumPerSource:1}})
 const actor:Dnd5eActivityActorSnapshot={id:'actor',controller:'players',level:10,proficiencyBonus:4,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:10,conditions:[],activeEffectDefinitionIds:[{definitionId:'activity:cast:parent',sourceActorId:'actor',tags:[tag],spellLevel:3}]}
 const resolved=resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{},castLevel:9})
 expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
 if(!resolved.ok)throw new Error(JSON.stringify(resolved))
 expect(resolved.proposals.find(p=>p.kind==='grant-inventory-item')).toMatchObject({templateId:'base',sourceEffectTag:tag})
 expect(resolveDnd5eActivity({activity,actor:{...actor,activeEffectDefinitionIds:[]},targets:[actor],rolls:{}}).ok).toBe(false)
 for(const suffix of ['',':modifiers:0',':extension',':marker']){
  const source={definitionId:`activity:cast:parent${suffix}`,sourceActorId:'actor',tags:[tag],spellLevel:3}
  expect(resolveDnd5eActivity({activity,actor:{...actor,activeEffectDefinitionIds:[source]},targets:[actor],rolls:{},castLevel:9}).ok).toBe(true)
  for(const invalid of [{...source,sourceActorId:'other'},{...source,tags:[]},{...source,definitionId:`activity:cast:not-parent${suffix}`},{...source,definitionId:`activity:cast:parent-extra${suffix}`}]){
   expect(resolveDnd5eActivity({activity,actor:{...actor,activeEffectDefinitionIds:[invalid]},targets:[actor],rolls:{}}).ok).toBe(false)
  }
 }
 for(const id of ['parent:marker','parent:extension','parent:modifiers:0']){
  const named=structuredClone(activity)
  for(const outcome of named.outcomes)for(const operation of outcome.operations)if(operation.kind==='grant-inventory-item')operation.sourceEffectId=id
  expect(resolveDnd5eActivity({activity:named,actor:{...actor,activeEffectDefinitionIds:[{definitionId:id,sourceActorId:'actor',tags:[tag],spellLevel:3}]},targets:[actor],rolls:{}}).ok).toBe(true)
 }
})

it('retains the creator modifier after transfer and spends one stack unit per attack',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.stone',name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerItem({id:'stone',name:'Stone',description:'Synthetic',rulesText:'Synthetic',icon:'sword',category:'equipment',stackable:true,equipment:{slot:'mainWeapon',dnd5e:{kind:'weapon',category:'simple',mode:'ranged',attackAbility:'dex',grantsProficiency:true,usesSourceSpellcastingAbility:true,consumesQuantityOnAttack:true,damage:{count:1,sides:6,type:'bludgeoning'},rangeFeet:{normal:60,long:60}}}})}})
 try{
  const chars=['caster','user'].map(id=>normalizeCharacter({id,name:id,level:3,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}}))
  const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'stones',name:'Stones',source:{kind:'spell',id:'synthetic'},activation:{kind:'bonus-action'},target:{kind:'self'},pattern:'conjured-item',item:{target:'actor',templateId:'test.stone:stone',quantity:{kind:'constant',value:3},captureSpellcastingModifier:true}})
  const caster:Dnd5eActivityActorSnapshot={id:'caster',controller:'players',level:3,proficiencyBonus:2,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},spellcastingAbility:'int',spellcastingAbilityModifier:4,armorClass:10,conditions:[]}
  const cast=resolveDnd5eActivity({activity,actor:caster,targets:[caster],rolls:{}})
  expect(cast.ok,JSON.stringify(cast)).toBe(true)
  if(!cast.ok)throw new Error('expected item grant')
  const proposal=cast.proposals.find(p=>p.kind==='grant-inventory-item')
  if(!proposal||proposal.kind!=='grant-inventory-item')throw new Error('missing item grant')
  expect(proposal).toMatchObject({quantity:3,sourceSpellcastingModifier:4})
  const granted=applyDnd5eInventoryGrantBundle(chars,{characterId:'caster',receiptId:'stones',grants:[{...proposal,sourceEffectTag:tag}]})
  const moved=applyDnd5eInventoryMutation(granted.characters,{type:'transfer',characterId:'caster',targetCharacterId:'user',instanceId:granted.characters[0].dnd5eInventory!.entries[0].instanceId,quantity:3})
  const equipped=applyDnd5eInventoryMutation(moved.characters,{type:'equip',characterId:'user',instanceId:moved.characters[1].dnd5eInventory!.entries[0].instanceId})
  const user=equipped.characters[1], profile=dnd5eWeaponAttackProfile(user)!
  expect(profile.attackModifier).toBe(6)
  expect(profile.damage.bonus).toBe(4)
  expect(profile.rangeFeet).toEqual({normal:60,long:60})
  const spent=consumeDnd5eWeaponAmmunition(user,profile.weaponId)
  expect(spent.ok).toBe(true)
  expect(spent.character.dnd5eInventory!.entries[0].quantity).toBe(2)
  expect(spent.character.equipment?.mainWeapon).toBeDefined()
 } finally {dispose()}
})
