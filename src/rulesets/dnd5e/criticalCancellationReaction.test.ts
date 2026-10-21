import {expect,it} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,dnd5eCombatantPairKey,dnd5eDirectedCombatantPairKey,dnd5eCriticalCancellationOptions,resolveDnd5eCriticalCancellation,type Dnd5eCombatEvent} from './headlessCombatEngine'
import {buildDnd5eCustomMonster,createDnd5eCustomMonsterDraft,createDnd5eCustomMonsterMechanicDraft} from './customMonsterWorkshop'
import {setDnd5eRoomMonsterCatalog} from './monsters'
import {createDnd5eConditionEffect,dnd5eConditionsFromActiveEffects} from './activeEffects'
import {resolveDnd5eHeadlessAction,type Dnd5eAction} from './headlessCombatEngine'
import {withDnd5eCriticalCancellationCheckpoints} from './criticalCancellationCheckpoint'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {resolveRegisteredDnd5eActivityInCombatV1} from './activities/dnd5eActivityCombatAuthority'
import {dnd5eInventoryEffectRollKey} from './inventoryHeadlessRuntime'
import {resolveDnd5eActionWithDamageReactions} from './damageReactionFlow'
import {createDnd5eCriticalCancellationSession} from './criticalCancellationSession'

it.each([
 {protects:'any',relation:'any',includeSelf:true},
 {protects:'self',relation:'any',includeSelf:true},
 {protects:'ally-or-self',relation:'any',includeSelf:true},
 {protects:'any',relation:'ally',includeSelf:true},
 {protects:'any',relation:'enemy',includeSelf:true},
 {protects:'any',relation:'any',includeSelf:false},
] as const)('authorizes critical cancellation with %j and spends owned resources atomically',({protects,relation,includeSelf})=>{
 const ns='test.critical-cancel',featureId=ns+':guardian.cancel',resource=ns+':cancel-uses'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:ns,name:'Critical guard',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'guardian',classId:'cleric',name:'Guardian',summary:'Synthetic',resources:[{id:'cancel-uses',label:'Uses',maximum:{kind:'fixed',value:3},resetOn:'long-rest'}],abilities:[{schemaVersion:1,id:'cancel',name:'Cancel',description:'Synthetic',level:6,trigger:{kind:'after-attack-roll'},cost:{economy:'reaction',resources:[{resourceId:'cancel-uses',amount:1}]},targeting:{kind:'single-creature',relation,includeSelf,rangeFeet:30,requiresSight:true},mechanic:{kind:'critical-hit-cancellation',protects},effects:[],automation:'partial'}]})}})
 try{
 for(const mode of ['valid','self','enemy-victim','noncritical','miss','far','unknown-distance','hidden','empty','no-reaction','unowned','incapacitated','stunned','dead'] as const){
  const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='enemy'?'dm':'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},proficiencyBonus:3,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const protector=make('protector',10);protector.pluginFeatureIds=mode==='unowned'?[]:[featureId];protector.classResources[resource]={current:mode==='empty'?0:1,max:3}
  if(mode==='incapacitated'||mode==='stunned')protector.classState.activeEffects=[createDnd5eConditionEffect({condition:mode,targetId:protector.id,source:{kind:'feature'}})]
  protector.conditions=dnd5eConditionsFromActiveEffects(protector.classState.activeEffects)
  const state=startDnd5eHeadlessCombat('cancel',[make('enemy',20),protector,make('victim',5)])
  if(mode==='enemy-victim')state.combatants.victim.controller='dm'
  if(mode==='no-reaction')state.combatants.protector.turn.reactionAvailable=false
  if(mode==='dead')state.combatants.protector.deathSaves.dead=true
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('protector','enemy')]:100,...mode==='unknown-distance'?{}:{[dnd5eCombatantPairKey('protector','victim')]:mode==='far'?31:30}}
  if(mode==='hidden')state.physicalLineOfSightBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('protector','victim')]:true}
  const event:Extract<Dnd5eCombatEvent,{type:'attack-resolved'}>={type:'attack-resolved',actorId:'enemy',targetId:mode==='self'?'protector':'victim',hit:mode!=='miss',critical:mode!=='noncritical',d20:20,total:25,armorClass:10}
  const before=structuredClone(state)
  const eligible=(mode==='valid'||mode==='self'||mode==='enemy-victim') &&
   (mode!=='self'||includeSelf) && (protects!=='self'||mode==='self') &&
   (protects!=='ally-or-self'||mode!=='enemy-victim') &&
   (relation!=='ally'||mode!=='enemy-victim') && (relation!=='enemy'||mode==='enemy-victim')
  expect(dnd5eCriticalCancellationOptions(state,event).length,mode).toBe(eligible?1:0)
  const result=resolveDnd5eCriticalCancellation(state,event,{protectorId:'protector',featureId})
  expect(result.ok,mode).toBe(eligible);expect(state).toEqual(before)
  if(!result.ok)continue
  expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.protector.classResources[resource].current).toBe(0)
  expect(result.state.combatants.victim.currentHp).toBe(30)
  expect(resolveDnd5eCriticalCancellation(result.state,event,{protectorId:'protector',featureId}).ok).toBe(false)
 }
 }finally{dispose()}
})

it('cancels native weapon critical damage before dice validation and rolls back suspended or invalid attacks',async()=>{
 const ns='test.native-critical-cancel',featureId=ns+':guardian.cancel',resource=ns+':uses'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:ns,name:'Native critical guard',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'guardian',classId:'cleric',name:'Guardian',summary:'Synthetic',resources:[{id:'uses',label:'Uses',maximum:{kind:'fixed',value:1},resetOn:'long-rest'}],abilities:[{schemaVersion:1,id:'cancel',name:'Cancel',description:'Synthetic',level:6,trigger:{kind:'after-attack-roll'},cost:{economy:'reaction',resources:[{resourceId:'uses',amount:1}]},targeting:{kind:'single-creature',relation:'any',includeSelf:true,rangeFeet:30,requiresSight:true},mechanic:{kind:'critical-hit-cancellation',protects:'any'},effects:[],automation:'partial'}]})}})
 const intentNs='test.critical-intent',intentId=intentNs+':rider.strike'
 const disposeIntent=registerDnd5eRulesPlugin({manifest:{id:intentNs,name:'Critical intent',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'rider',classId:'fighter',name:'Rider',summary:'Synthetic',resources:[{id:'focus',label:'Focus',maximum:{kind:'fixed',value:1},resetOn:'long-rest',die:{sides:6}}],combatHooks:[{id:'strike',timing:'after-attack-hit',abilityId:'strike',decision:'actor-choice',activation:'prearm',retention:'until-triggered'}],abilities:[{schemaVersion:1,id:'strike',name:'Strike',description:'Synthetic',level:1,trigger:{kind:'after-attack-hit'},cost:{economy:'none',resources:[{resourceId:'focus',amount:1}]},targeting:{kind:'single-creature',relation:'any'},rolls:[{id:'damage',kind:'damage',label:'Damage',dice:{count:1,sides:6},damageType:'force',hostRoll:{timing:'on-trigger',die:{kind:'resource-die',resourceId:'focus'},critical:'double-dice'}}],effects:[{kind:'damage',target:'target',rollId:'damage'}],automation:'full'}]})}})
 const activityNamespace='test.critical-activity',automation=automationCapabilityFromLegacyStatus('full')
 const disposeActivity=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1({format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:activityNamespace,name:'Critical activity',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only'},definitions:[{schemaVersion:1,namespace:activityNamespace,version:'1.0.0',kind:'feature',id:'attack',name:'Attack',automation,payload:{id:'attack',name:'Attack',summary:'Test',description:'Test',automation:'full'},activities:[{schemaVersion:1,id:'attack',name:'Attack',legacySource:{kind:'feature',id:'attack'},activation:{kind:'free'},automation,target:{kind:'creature',count:1,relation:'any',rangeFeet:30},checks:[{id:'hit',kind:'attack-roll',rollId:'hit',scope:'per-target',rollMode:'normal',attackBonus:{kind:'constant',value:5}}],outcomes:[{id:'hit',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'fire',critical:'double-dice',amount:{kind:'dice',rollId:'damage',count:1,sides:6}}]}]}]}]}))
 try{
  for(const mode of ['accept','decline','suspend','invalid-selection','invalid-dice','self','spell','rays','monster','monster-spell','flurry','redirect','return','activity','registered','session-accept','session-decline','session-stale','session-cancel','native-session','savage','invalid-savage','brutal','invalid-brutal','monster-extra','invalid-monster-extra','flow-accept','flow-decline','flow-stale','inventory','invalid-inventory','intent','invalid-intent','redirect-brutal','invalid-redirect-brutal','mechanic','invalid-mechanic'] as const){
   const make=(id:string)=>createDnd5eCombatant({id,name:id,initiative:id==='enemy'?20:10,controller:id==='enemy'?'dm':'player',abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},proficiencyBonus:3,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
   const protector=make('protector');protector.pluginFeatureIds=[featureId];protector.classResources[resource]={current:1,max:1}
   const state=startDnd5eHeadlessCombat('native-cancel',[make('enemy'),protector,make('victim')])
   const targetId=mode==='self'?'protector':'victim'
   state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('enemy',targetId)]:5,[dnd5eCombatantPairKey('protector','victim')]:30}
   let action:Dnd5eAction={type:'attack',actorId:'enemy',targetId,d20:20,attackModifier:5,damage:{count:1,sides:6,rolls:mode==='decline'?[3,3]:mode==='invalid-dice'?[99]:[3],bonus:0,type:'slashing'},classDamageContext:{mode:'melee',weaponId:'sword',finesse:false,strengthBased:true,weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false}}
   if(mode==='accept'||mode==='native-session'||mode.startsWith('flow-'))action.damage.rolls=[3,5]
   if(mode==='invalid-dice')action.damage.rolls=[3,99]
   if(mode==='accept')action.damage.bonus=2
   if(mode==='savage'||mode==='invalid-savage'){state.combatants.enemy.racialRules={innateSpells:[],halflingLucky:false,halfOrcRelentlessEndurance:false,...state.combatants.enemy.racialRules,halfOrcSavageAttacks:true};action.damage.rolls=[3,5];action.savageAttacksRoll=mode==='savage'?6:99}
   if(mode==='brutal'||mode==='invalid-brutal'){
    Object.assign(state.combatants.enemy,{classId:'barbarian',level:9})
    action.damage.rolls=[3,5];action.classDamageRolls=[{source:'brutal-critical',rolls:[mode==='brutal'?6:99]}]
   }
   if(mode==='monster-extra'||mode==='invalid-monster-extra'){
    const draft=createDnd5eCustomMonsterDraft()
    draft.actions[0].damageDice='1d6+2'
    draft.actions[0].criticalExtraDamage=[{id:'extra',dice:'1d6',damageType:'slashing'}]
    const monster=buildDnd5eCustomMonster(draft);setDnd5eRoomMonsterCatalog([monster])
    state.combatants.enemy.statBlockId=monster.id
    action={type:'monster-action',actorId:'enemy',actionId:monster.actions[0].id,rolls:[{targetId,d20:20,damageRolls:[[3,5],[mode==='monster-extra'?6:99]]}]}
   }
   if((mode==='inventory'||mode==='invalid-inventory') && action.type==='attack'){
    const resources={charges:{id:'charges',label:'Charges',current:2,maximum:2,resetOn:'long-rest' as const}}
    state.combatants.enemy.inventoryHeadlessEffects=[{instanceId:'item-1',templateId:'test:weapon',itemName:'Flame weapon',equipmentId:'sword',equippedSlot:'mainWeapon',effectId:'flame',resources:structuredClone(resources),effect:{schemaVersion:1,id:'flame',kind:'on-hit-bonus-damage',trigger:'after-attack-hit',appliesTo:'attacks-with-this-weapon',damage:{count:1,sides:6,bonus:2},damageType:'fire',doubleDiceOnCritical:true,resourceId:'charges',resourceCost:1}}]
    state.combatants.enemy.inventoryResourceSnapshots=[{instanceId:'item-1',resources:structuredClone(resources)}]
    state.combatants.enemy.inventoryRevision=0
    action.damage.rolls=[3,5];action.inventoryEffectRolls={[dnd5eInventoryEffectRollKey('item-1','flame')]:[4,mode==='inventory'?5:99]}
   }
   if((mode==='intent'||mode==='invalid-intent') && action.type==='attack'){
    Object.assign(state.combatants.enemy,{classId:'fighter',level:3,subclassId:intentNs+':rider',classLevels:{fighter:3},subclassIds:{fighter:intentNs+':rider'},pluginFeatureIds:[intentId],classResources:{[intentNs+':focus']:{current:1,max:1}}})
    action.damage.rolls=[3,5];action.declarativeIntentFeatureIds=[intentId]
    const second=mode==='intent'?5:99
    action.declarativeIntentRolls={[intentId]:{damage:{values:[4,second],modifier:0,total:4+second}}}
   }
   if(mode==='spell'||mode==='rays'){
    state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('enemy',targetId)]=30
    Object.assign(state.combatants.enemy,{classId:'wizard',level:3,classSelections:{'spell-cantrips':['fire-bolt'],'spell-prepared':['scorching-ray']},classResources:{'dnd5e-spell-slot-2':{current:1,max:1}}})
    action=mode==='spell'?{type:'cast-spell',actorId:'enemy',targetId,spellId:'fire-bolt',slotLevel:0,d20:20,effectRolls:[3,5]}:
     {type:'cast-spell',actorId:'enemy',targetId,spellId:'scorching-ray',slotLevel:2,effectRolls:[],projectileTargetIds:[targetId,targetId,targetId],targetAttacks:[{targetId,d20:20,effectRolls:[2,2,5,5]},{targetId,d20:20,effectRolls:[2,2,2,2]},{targetId,d20:1,effectRolls:[]}]}
   }
   if(mode==='monster'||mode==='monster-spell'){
    state.combatants.enemy.statBlockId=mode==='monster'?'srd-5.1:centaur':'srd-5.1:mage'
    state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('enemy',targetId)]=30
    action=mode==='monster'?{type:'monster-action',actorId:'enemy',actionId:'multiattack-longbow',rolls:[{targetId,d20:20,damageRolls:[[4,7]]},{targetId,d20:20,damageRolls:[[4,4]]}]}:
     {type:'monster-core-spell',actorId:'enemy',spellId:'fire-bolt',slotLevel:0,resolution:{schemaVersion:1,targetIds:[targetId],d20:20,effectRolls:[[3,3,7,7]]}}
   }
   if(mode==='flurry'){
    Object.assign(state.combatants.enemy,{classId:'monk',level:3,classResources:{'dnd5e-ki':{current:2,max:2}}})
    state.combatants.enemy.classState.monkAttackActionTurnKey='native-cancel:1:enemy'
    action={type:'monk-unarmed-bonus',actorId:'enemy',mode:'flurry',attackModifier:5,reachFeet:5,damageType:'bludgeoning',damage:{count:1,sides:4,bonus:0},attacks:[{targetId,d20:20,damageRolls:[3,4]},{targetId,d20:20,damageRolls:[3,3]}]}
   }
   if(mode==='redirect'||mode==='redirect-brutal'||mode==='invalid-redirect-brutal'){
    Object.assign(state.combatants.protector,{armorClass:15,classId:'ranger',subclassId:'hunter',level:15,classSelections:{'superior-hunters-defense':['stand-against-tide']}})
    state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('enemy','protector')]=5
    state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('protector','victim')]=5
    // A different protector must spend the cancellation reaction: the hunter already redirects.
    state.combatants.victim.pluginFeatureIds=[featureId]
    state.combatants.victim.classResources[resource]={current:1,max:1}
    action={type:'attack',actorId:'enemy',targetId:'protector',d20:2,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[],type:'slashing'},classDamageContext:{mode:'melee',finesse:false,strengthBased:true,weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false},standAgainstTide:{targetId,distanceFeet:5,d20:20,damageRolls:[[3,5]]}}
   }
   if((mode==='redirect-brutal'||mode==='invalid-redirect-brutal') && action.type==='attack' && action.standAgainstTide){
    Object.assign(state.combatants.enemy,{classId:'barbarian',level:9})
    action.standAgainstTide.classDamageRolls=[{source:'brutal-critical',rolls:[mode==='redirect-brutal'?6:99]}]
   }
   if(mode==='mechanic'||mode==='invalid-mechanic'){
    const draft=createDnd5eCustomMonsterDraft()
    draft.headlessMechanics=[{...createDnd5eCustomMonsterMechanicDraft(),id:'intercept',name:'Intercept',trigger:'movement',triggerSubject:'hostile-within',triggerRadiusFeet:30,movementComparison:'at-least',movementFeet:20,effectKind:'attack',effectTarget:'selected-subject',attackToHit:6,attackEconomy:'reaction',healingDice:'1d6+2',damageType:'piercing',hpPercentageAtOrBelow:undefined,limit:'once-per-turn'}]
    const monster=buildDnd5eCustomMonster(draft);setDnd5eRoomMonsterCatalog([monster]);state.combatants.enemy.statBlockId=monster.id
    state.initiativeIndex=2
    const moved=resolveDnd5eHeadlessAction(state,{type:'move',actorId:targetId,to:{x:4,y:0},distance:20})
    if(!moved.ok)throw Error(JSON.stringify(moved))
    const pending=moved.events.find(event=>event.type==='monster-mechanic-trigger-pending')
    if(!pending||pending.type!=='monster-mechanic-trigger-pending')throw Error('Missing mechanic snapshot')
    Object.assign(state,moved.state)
    action={type:'resolve-monster-mechanic-trigger',actorId:'enemy',snapshotId:pending.snapshot.id,roll:{actorId:'enemy',mechanicId:'intercept',targetId,attackRolls:[{effectId:'effect-0',targetId,d20:20,damageRolls:[3,mode==='mechanic'?5:99]}]}}
   }
   if(mode==='return'){
    state.initiativeIndex=2
    Object.assign(state.combatants.enemy,{classId:'monk',level:3,classResources:{'dnd5e-ki':{current:2,max:2}}})
    Object.assign(state.combatants.enemy.classState,{deflectMissilesCatchTurnKey:'native-cancel:1:victim',deflectMissilesCatchSourceId:'victim',deflectMissilesCatchDamageType:'piercing'})
    action={type:'monk-deflect-missiles-return',actorId:'enemy',targetId,distanceFeet:5,d20:20,damageRolls:[3,4]}
   }
   if(mode==='activity'||mode==='registered'||mode.startsWith('session-')){
    state.combatants.enemy.pluginFeatureIds=[activityNamespace+':attack']
    action={type:'plugin',pluginId:activityNamespace,actionId:'attack',featureId:activityNamespace+':attack',actorId:'enemy',targetId,targetIds:[targetId],distanceFeet:5,rolls:{'hit:victim':{values:[20],modifier:0,total:20},damage:{values:[3,5],modifier:0,total:8}}}
   }
   const original=structuredClone(state),pause=new Error('critical-choice-required')
   if(mode.startsWith('flow-')){
    let current=true,confirmations=0
    const pending=resolveDnd5eActionWithDamageReactions({state,action,combatRevision:1,authorityUnchanged:()=>current,
     confirm:async request=>{confirmations++;expect(request.actorId).toBe('protector');expect(request.targetIds).toEqual(['victim']);if(mode==='flow-stale')current=false;return {accepted:mode!=='flow-decline'}},
     roll:async()=>{throw Error('Critical protection does not roll dice')}})
    if(mode==='flow-stale')await expect(pending).rejects.toThrow('stale-authority')
    else{const result=await pending;expect(result.ok,result.ok?'':result.reason).toBe(true);expect(result.state.combatants.victim.currentHp).toBe(mode==='flow-decline'?22:27);expect(result.state.combatants.protector.classResources[resource].current).toBe(mode==='flow-decline'?1:0)}
    expect(confirmations).toBe(1);expect(state).toEqual(original);continue
   }
   if(mode.startsWith('session-')||mode==='native-session'){
    const frozenAction=structuredClone(action)
    const session=createDnd5eCriticalCancellationSession(state,snapshot=>resolveDnd5eHeadlessAction(snapshot,frozenAction))
    const pending=session.run(state)
    expect(pending.status).toBe('pending')
    if(pending.status!=='pending')throw Error('Expected critical checkpoint')
    pending.snapshot.combatants.protector.classResources[resource].current=0
    expect(session.resume(state,pending.occurrence+1,pending.event)).toMatchObject({status:'rejected',reason:'stale-checkpoint'})
    expect(session.resume(state,pending.occurrence,pending.event,{protectorId:'enemy',featureId})).toMatchObject({status:'rejected',reason:'invalid-selection'})
    if(mode==='session-stale'){
     const changed=structuredClone(state);changed.combatants.victim.currentHp--
     expect(session.resume(changed,pending.occurrence,pending.event)).toMatchObject({status:'rejected',reason:'stale-state'})
    }else if(mode==='session-cancel'){
     session.cancel()
     expect(session.resume(state,pending.occurrence,pending.event)).toMatchObject({status:'rejected',reason:'session-ended'})
    }else{
     const result=session.resume(state,pending.occurrence,pending.event,mode==='session-decline'?undefined:{protectorId:'protector',featureId})
     expect(result.status).toBe('resolved')
     if(result.status!=='resolved'||!result.result.ok)throw Error('Expected completed attack')
     expect(result.result.state.combatants.victim.currentHp).toBe(mode==='session-decline'?22:27)
     expect(result.result.state.combatants.protector.classResources[resource].current).toBe(mode==='session-decline'?1:0)
     expect(session.resume(state,pending.occurrence,pending.event)).toMatchObject({status:'rejected',reason:'session-ended'})
    }
    expect(state).toEqual(original)
    continue
   }
   const run=()=>withDnd5eCriticalCancellationCheckpoints((event,snapshot)=>{
    expect(event.critical).toBe(true);expect(event.targetId).toBe(targetId)
    snapshot.combatants.victim.currentHp=1 // Inspection cannot mutate the authoritative transaction.
    if(mode==='suspend')throw pause
    if(mode==='decline')return
    if(['rays','monster','flurry'].includes(mode)&&dnd5eCriticalCancellationOptions(snapshot,event).length===0)return
    return {protectorId:mode==='invalid-selection'?'enemy':(mode==='redirect'||mode==='redirect-brutal'||mode==='invalid-redirect-brutal')?'victim':'protector',featureId}
   },()=>mode==='registered'?resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,confirmedBy:'actor',authoritativeRolls:{'hit:victim':{values:[20]},damage:{values:[3,5]}},command:{schemaVersion:1,commandId:'critical-test',actorId:'enemy',packageId:activityNamespace,packageVersion:'1.0.0',activityId:'attack',targetIds:[targetId],expectedRevision:1}}).result:resolveDnd5eHeadlessAction(state,action))
   if(mode==='suspend')expect(run).toThrow(pause)
   else{
    const result=run()
    expect(result.ok,mode+JSON.stringify(result.ok?{}:result)).toBe(mode!=='invalid-selection'&&mode!=='invalid-dice'&&mode!=='invalid-savage'&&mode!=='invalid-brutal'&&mode!=='invalid-monster-extra'&&mode!=='invalid-inventory'&&mode!=='invalid-intent'&&mode!=='invalid-redirect-brutal'&&mode!=='invalid-mechanic')
    if(result.ok){
     expect(result.state.combatants[targetId].currentHp,mode+JSON.stringify(result.events)).toBe(mode==='decline'||mode==='monster-spell'?24:mode==='rays'?18:mode==='monster'?14:mode==='flurry'||mode==='inventory'?21:mode==='accept'||mode==='monster-extra'||mode==='mechanic'?25:mode==='intent'?23:27)
     expect(result.state.combatants.protector.turn.reactionAvailable).toBe(mode==='decline')
     expect(result.state.combatants[(mode==='redirect'||mode==='redirect-brutal'||mode==='invalid-redirect-brutal')?'victim':'protector'].classResources[resource].current).toBe(mode==='decline'?1:0)
     if(mode==='mechanic'&&action.type==='resolve-monster-mechanic-trigger'){
      expect(result.state.combatants.enemy.turn.reactionAvailable).toBe(false)
      expect(result.state.pendingMonsterMechanicTriggers?.[action.snapshotId]).toBeUndefined()
      expect(resolveDnd5eHeadlessAction(result.state,action).ok).toBe(false)
     }
     if(mode==='intent')expect(result.state.combatants.enemy.classResources[intentNs+':focus'].current).toBe(0)
     if(mode==='inventory')expect(result.state.combatants.enemy.inventoryResourceSnapshots?.[0].resources.charges.current).toBe(1)
     if(mode==='savage')expect(result.events.some(event=>event.type==='savage-attacks-applied')).toBe(false)
     expect(result.events.find(event=>event.type==='attack-resolved'&&event.hit)).toMatchObject({hit:true,critical:mode==='decline'})
    }
   }
   expect(state).toEqual(original)
  }
 }finally{setDnd5eRoomMonsterCatalog([]);disposeIntent();disposeActivity();dispose()}
})

