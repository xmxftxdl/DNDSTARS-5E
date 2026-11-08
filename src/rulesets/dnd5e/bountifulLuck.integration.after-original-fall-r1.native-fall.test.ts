import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {beforeAll,afterAll,expect,it} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registeredDnd5ePluginFeatures} from './plugins/pluginContentCatalog'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,dnd5eCombatantPairKey,dnd5eFeatherFallReactionOption,type Dnd5eAction} from './headlessCombatEngine'
import {createDnd5eDamageCommitSession} from './damageCommitSession'
import {resolveDnd5eActionWithDamageReactions} from './damageReactionFlow'
import {resolveDnd5eActionWithAirborneFallPreview} from './airborneFallActionResolution'
import {Dnd5eAfterOriginalFallDecisionRequired,dnd5eAfterOriginalFallsWereSettled} from './afterOriginalFallCheckpoint'
import {originalD20ReplaySourceKey,type OriginalD20ReplayFacts} from './allyNaturalOneCheckpoint'

let featureId:string,dispose:()=>void
beforeAll(async()=>{const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent);dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));const feature=registeredDnd5ePluginFeatures().find(row=>row.ownerPluginId===pkg.manifest.id&&row.declarativeAbility?.mechanic?.kind==='ally-natural-one-reroll');if(!feature)throw Error('Real imported feat mechanic feature missing');featureId=feature.id})
afterAll(()=>dispose?.())
function fixture(){
 const make=(id:string,initiative:number,extra:Partial<Parameters<typeof createDnd5eCombatant>[0]>={})=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:16,dex:14,con:14,int:16,wis:12,cha:10},proficiencyBonus:3,armorClass:16,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,...extra})
 const caster=(id:string,initiative:number,feat:boolean)=>make(id,initiative,{classId:'wizard',level:5,classSelections:{'spell-prepared':['feather-fall']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}},racialRules:{halflingLucky:true,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[]},pluginFeatureIds:feat?[featureId]:[]})
 const actors=[make('shover',20),make('flyer',15,{controller:'dm',position:{x:5,y:0},elevationFeet:30,groundElevationFeet:0,airborne:true,movementSpeeds:{walk:30,fly:60}}),caster('owner',10,true),caster('other-caster',5,false)]
 const state=startDnd5eHeadlessCombat('after-original-fall',actors)
 state.distanceFeetByCombatantPair=Object.fromEntries(actors.flatMap((left,i)=>actors.slice(i+1).map(right=>[dnd5eCombatantPairKey(left.id,right.id),5])))
 const action:Dnd5eAction={type:'shove',actorId:'shover',targetId:'flyer',actorD20:1,targetD20:1,targetDefense:'acrobatics',outcome:'prone'}
 return {state,action}
}
function pendingFall(){
 const {state,action}=fixture(),before=structuredClone(state),session=createDnd5eDamageCommitSession(state,action,()=>false)
 const first=session.run(state);expect(first.status).toBe('pending-ally-natural-one')
 if(first.status!=='pending-ally-natural-one')throw Error('Actual native shove did not reach Bountiful original die')
 const fall=session.resumeAllyNaturalOne(state,first.occurrence,first.request,{ownerId:'owner',featureId,replacement:20})
 expect(fall.status).toBe('pending-after-original-fall')
 if(fall.status!=='pending-after-original-fall')throw Error('Actual native shove did not reach pre-fall settlement')
 expect(fall.snapshot.combatants.owner.turn.reactionAvailable).toBe(false)
 expect(fall.snapshot.combatants['other-caster'].turn.reactionAvailable).toBe(true)
 expect(fall.request.falls).toEqual([{combatantId:'flyer',fromElevationFeet:30,groundElevationFeet:0,fallDistanceFeet:30,fallingDamageDice:3}])
 expect(state).toEqual(before)
 return {state,before,session,fall}
}
it('continues the actual native shove after Bountiful through another caster Feather Fall at the real pre-fall state',()=>{
 const {state,before,session,fall}=pendingFall()
 const final=session.resumeAfterOriginalFall(state,fall.occurrence,fall.request,{featherFalls:[{casterId:'other-caster',targetIds:['flyer']}],rollsByCombatantId:{}})
 expect(final.status).toBe('resolved');if(final.status!=='resolved')throw Error('Missing real final action')
 expect(final.result.ok,final.result.ok?'':final.result.reason).toBe(true)
 expect(final.result.state.combatants.flyer.currentHp).toBe(20)
 expect(final.result.state.combatants['other-caster'].classResources['dnd5e-spell-slot-1'].current).toBe(0)
 expect(final.result.state.combatants['other-caster'].turn.reactionAvailable).toBe(false)
 expect(final.result.state.combatants.owner.turn.reactionAvailable).toBe(false)
 expect(final.result.events.filter(event=>event.type==='ally-natural-one-rerolled')).toHaveLength(1)
 expect(final.result.events.filter(event=>event.type==='spell-cast'&&event.spellId==='feather-fall')).toHaveLength(1)
 expect(final.result.state.combatants.flyer.classState.activeEffects).toContainEqual(expect.objectContaining({source:expect.objectContaining({rulesId:'feather-fall'})}))
 expect(final.result.events.some(event=>event.type==='damage-applied'&&event.targetId==='flyer')).toBe(false)
 expect(dnd5eAfterOriginalFallsWereSettled(final.result.state)).toBe(true)
 expect(state).toEqual(before)
})
it('does not let the already-spent Bountiful owner also cast Feather Fall',()=>{
 const {state,before,session,fall}=pendingFall()
 const final=session.resumeAfterOriginalFall(state,fall.occurrence,fall.request,{featherFalls:[{casterId:'owner',targetIds:['flyer']}],rollsByCombatantId:{}})
 expect(final.status).toBe('resolved');if(final.status!=='resolved')throw Error('Missing real rejection')
 expect(final.result.ok).toBe(false);expect(state).toEqual(before)
})
it('uses the actual three d6s only after the pre-fall choice and rejects changed checkpoint facts',()=>{
 const {state,before,session,fall}=pendingFall()
 expect(session.resumeAfterOriginalFall(state,fall.occurrence,{...fall.request,actorId:'other-caster'},{featherFalls:[],rollsByCombatantId:{flyer:[2,3,4]}})).toMatchObject({status:'rejected',reason:'changed-reaction'})
 const final=session.resumeAfterOriginalFall(state,fall.occurrence,fall.request,{featherFalls:[],rollsByCombatantId:{flyer:[2,3,4]}})
 expect(final.status).toBe('resolved');if(final.status!=='resolved')throw Error('Missing true fall')
 expect(final.result.ok).toBe(true);expect(final.result.state.combatants.flyer.currentHp).toBe(11)
 expect(final.result.events).toContainEqual(expect.objectContaining({type:'falling-damage-resolved',actorId:'flyer',rolls:[2,3,4],damage:9}))
 expect(state).toEqual(before)
})
it('keeps a missing actual Host pre-fall callback pending instead of discarding original damage or assuming decline',async()=>{
 const {state,action}=fixture(),before=structuredClone(state)
 await expect(resolveDnd5eActionWithDamageReactions({state,action,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseAllyNaturalOne:async()=>({ownerId:'owner',featureId,replacement:20})})).rejects.toBeInstanceOf(Dnd5eAfterOriginalFallDecisionRequired)
 expect(state).toEqual(before)
})
it('preserves the exact ordinary no-Bountiful preview/dice contract',()=>{
 const {state}=fixture();state.combatants.owner.pluginFeatureIds=[]
 const action:Dnd5eAction={type:'shove',actorId:'shover',targetId:'flyer',actorD20:20,targetD20:1,targetDefense:'acrobatics',outcome:'prone'}
 const before=structuredClone(state),preview=resolveDnd5eActionWithAirborneFallPreview(state,action)
 expect(preview.result).toMatchObject({ok:false,reason:'invalid-dice'});expect(preview.airborneFalls).toHaveLength(1)
 const final=resolveDnd5eActionWithAirborneFallPreview(state,action,{flyer:[2,3,4]})
 expect(final.result.ok).toBe(true);expect(final.result.state.combatants.flyer.currentHp).toBe(11)
 expect(dnd5eAfterOriginalFallsWereSettled(final.result.state)).toBe(false)
 expect(state).toEqual(before)
})
it('checks Feather Fall after a real same-parent Shield and native Ankheg grapple, preserving the spent defender reaction',()=>{
 const {state}=fixture(),snake=state.combatants.shover,flyer=state.combatants.flyer
 snake.statBlockId='srd-5.1:ankheg';snake.abilities={str:17,dex:11,con:13,int:1,wis:13,cha:6};snake.sizeRank=3
 flyer.classId='wizard';flyer.level=5;flyer.classLevels={wizard:5};flyer.classSelections={'spell-prepared':['shield','feather-fall']};flyer.classResources={'dnd5e-spell-slot-1':{current:2,max:2}};flyer.armorClass=10
 const action:Dnd5eAction={type:'monster-action',actorId:'shover',actionId:'bite',rolls:[{targetId:'flyer',d20:1,shieldSpellReaction:true,damageRolls:[[1,1],[1]],onHitEffectRolls:[{effectId:'bite-grapple'}]}]}
 const parentId='native-fall-parent'
 const before=structuredClone(state),session=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:parentId},undefined,undefined,parentId),first=session.run(state)
 expect(first.status).toBe('pending-ally-natural-one');if(first.status!=='pending-ally-natural-one')throw Error('Native monster raw attack did not reach real original die')
 const fall=session.resumeAllyNaturalOne(state,first.occurrence,first.request,{ownerId:'owner',featureId,replacement:15})
 expect(fall.status).toBe('pending-after-original-fall');if(fall.status!=='pending-after-original-fall')throw Error('Native grapple did not trigger actual unsupported fall')
 expect(fall.snapshot.combatants.flyer.turn.reactionAvailable).toBe(false)
 expect(fall.snapshot.combatants.flyer.classResources['dnd5e-spell-slot-1'].current).toBe(1)
 expect(dnd5eFeatherFallReactionOption(fall.snapshot.combatants.flyer)).toBeUndefined()
 expect(fall.snapshot.combatants.flyer.conditions).toContain('grappled')
 const final=session.resumeAfterOriginalFall(state,fall.occurrence,fall.request,{featherFalls:[{casterId:'other-caster',targetIds:['flyer']}],rollsByCombatantId:{}})
 expect(final.status).toBe('resolved');if(final.status!=='resolved')throw Error('Missing real final monster result')
 expect(final.result.ok,final.result.ok?'':final.result.reason).toBe(true)
 expect(final.result.state.combatants.flyer.currentHp).toBe(14)
 expect(final.result.events.filter(event=>event.type==='spell-cast'&&event.spellId==='shield')).toHaveLength(1)
 expect(final.result.events.filter(event=>event.type==='spell-cast'&&event.spellId==='feather-fall')).toHaveLength(1)
 expect(final.result.state.combatants.flyer.turn.reactionAvailable).toBe(false)
 expect(state).toEqual(before)
 const wire:OriginalD20ReplayFacts=JSON.parse(JSON.stringify({parentId,effectTimestamp:session.originalEffectTimestamp(),sourceKey:originalD20ReplaySourceKey(parentId,state,action,session.originalEffectTimestamp()),facts:[{occurrence:first.occurrence,request:first.request,decision:{ownerId:'owner',featureId,replacement:15}}],afterOriginalFalls:session.afterOriginalFallFacts()}))
 const restored=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:parentId,originalD20Replay:wire})
 const replay=restored.run(state)
 expect(replay.status).toBe('resolved');if(replay.status!=='resolved')throw Error('Actual saved fall facts did not resume')
 expect(replay.result.ok).toBe(true)
 expect(replay.result.state).toEqual(final.result.state)
 const changedClock=structuredClone(wire);changedClock.effectTimestamp=(changedClock.effectTimestamp??0)+1
 expect(()=>createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:parentId,originalD20Replay:changedClock})).toThrow('original-d20-replay-source-mismatch')
 const foreignParent=structuredClone(wire);foreignParent.parentId='foreign-parent'
 expect(()=>createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:parentId,originalD20Replay:foreignParent})).toThrow('original-d20-replay-source-mismatch')
 expect(replay.result.events.filter(event=>event.type==='spell-cast'&&event.spellId==='feather-fall')).toHaveLength(1)
 const changed=structuredClone(wire),changedFall=changed.afterOriginalFalls?.[0];if(!changedFall)throw Error('Real saved fall fact missing');changedFall.snapshotSignature+='changed'
 const rejected=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:parentId,originalD20Replay:changed}).run(state)
 expect(rejected).toMatchObject({status:'rejected',reason:'changed-reaction'})
 expect(state).toEqual(before)
})
