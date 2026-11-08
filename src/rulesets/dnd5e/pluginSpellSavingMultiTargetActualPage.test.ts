import{trueMultiSavingSource as trueHalfSource}from'./testFixtures/bountifulMultiSaving.scene.fixture'
import{createDnd5ePluginSpellSavingOriginalCollector,createDnd5ePluginSpellSavingOriginalCollectorFromBook}from'./pluginSpellSavingOriginalOperation'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import {it,expect,vi} from 'vitest'
import ts from 'typescript'
import page from '../../pages/MapsWorkspacePage?raw'
import * as rules from '../../application/combat/dnd5eCombatRules'
import {resolvePreparedDnd5ePluginSpellCast} from './pluginSpellTransaction'
import {dnd5ePluginHeadlessActionDefinition} from './plugins/pluginHeadlessRuntimeRegistry'
import {dnd5eHostSaveFactsV1} from './activities/dnd5eActivitySaveFacts'
import {dnd5eActivityHostSavingThrowModeV1} from './activities/dnd5eActivityPerTargetRolls'
import {dnd5eSavingThrowMode} from './passiveDefenses'
import {withDnd5eOriginalD20ReadyObserver} from './allyNaturalOneCheckpoint'
import {activityEffectDiceRecipes} from '../../presentation/maps/activityEffectDice'
import {activitySavingThrowPreview} from '../../presentation/maps/activitySavingThrowPreview'
import {collectDnd5eActivityRetainedSaveChoice} from '../../pages/maps/dnd5eActivityRetainedSaveChoice'
import {canObserveBountifulPluginSpellSavingOriginal,createBountifulPluginSpellSavingRoomCollector,restoreBountifulPluginSpellSavingInitialSource} from '../../pages/maps/bountifulPluginSpellSavingOriginalCollector'
import {readBountifulPluginSpellSavingOriginalDiceRoute} from '../../pages/maps/bountifulPluginSpellSavingOriginalRaw'
import {damageZeroNormalAckHttpFixture} from './pluginSpellSavingOriginal.http.support'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import fs from 'node:fs'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

function actualPageNodes(){
 const tree=ts.createSourceFile('Page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),out:Record<string,string>={}
 function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isArrowFunction(node.initializer)){
   if(node.name.text==='currentSpellPerTargetDeclarations')out.declarations=node.initializer.getText(tree)
   if(node.name.text==='rollDeclaration'&&node.initializer.getText(tree).includes('pluginSpellSavingOriginal'))out.roll=node.initializer.getText(tree)
  }
  ts.forEachChild(node,visit)
 }
 visit(tree);expect(Object.keys(out).sort()).toEqual(['declarations','roll']);return out
}
function bind(text:string,scope:Record<string,unknown>){
 const code=ts.transpileModule('const value='+text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 return Function(...Object.keys(scope),code+';return value;')(...Object.values(scope))
}


it('actual lawful Wizard3 upcast Cause Fear collects two independent Brave target pools through actual Page and cold private book',async()=>{
 const f=await trueHalfSource(),http=await damageZeroNormalAckHttpFixture();let collector:ReturnType<typeof createBountifulPluginSpellSavingRoomCollector>|undefined
 try{
  const pluginCast=f.prepared,state=pluginCast.state,action=pluginCast.action,foe=pluginCast.characters.find(c=>c.id==='foe')!,target=state.combatants['foe-token']
  expect(foe.dnd5eRaceId).toBe('halfling');expect(foe.dnd5eClassLevels).toEqual({fighter:1});expect(foe.currentHp).toBe(10);expect(foe.dnd5ePluginFeatureIds??[]).toEqual([])
  expect(target.racialSavingThrowAdvantages?.conditions).toContain('frightened');expect(target.classState.activeEffects??[]).toEqual([])
  expect(dnd5eSavingThrowMode(target,'wis',{condition:'frightened',sourceIsSpell:true})).toBe('advantage')
  const check=pluginCast.activity?.checks?.[0];if(check?.kind!=='saving-throw')throw Error('Actual registered initial saving required')
  expect(check.rollMode).toBe('host-derived');expect(check.automaticSuccessIfConditionImmune).toBeUndefined()
  const activityActor=state.combatants[pluginCast.actorToken.id],actor=rules.dnd5eActivityActorSnapshotFromCombatantV1(activityActor,activityActor,state),targets=pluginCast.targets.map(t=>rules.dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[t.token.id],activityActor))
  const definition=dnd5ePluginHeadlessActionDefinition(pluginCast.spell.ownerPluginId,pluginCast.spell.automation.mode==='headless-action'?pluginCast.spell.automation.actionId:'');if(!definition)throw Error('Actual registered Cause Fear definition required')
  const economies=Object.fromEntries(Object.entries(state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+(state.initiativeOrder[state.initiativeIndex]===id?(state.initiativeSlotIds?.[state.initiativeIndex]??id):id),a.speed),a.turn,a.speed)]))
  const data:Record<string,any>={characters:{characters:pluginCast.characters},maps:{maps:[pluginCast.map]},combat:{active:true,mapId:pluginCast.map.id,combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:state.initiativeOrder.map(tokenId=>({tokenId})),dnd5eTurnEconomyByToken:economies},'map-geometry':{maps:[]},'campaign-time':{clock:0},'player-action-requests':{requests:[action]},'player-action-processed':{actionIds:[]}}
  for(const doc of Object.values(data))doc._sync={revision:1,schemaVersion:1,writerId:'host',writtenAt:1}
  const identity={parentId:action.id,mapId:pluginCast.map.id,combatId:state.combatId}
  const read=async()=>{const response=await http.state('POST','bountiful-plugin-spell-saving-original/source',identity,data,'host');if(response.status!==200)throw Error((response.payload as any).error);return response.payload}
  const gateway={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel:string,payload:unknown)=>{const answer=await http.event(channel,payload,data,'host');expect(answer.status,JSON.stringify(answer.payload)).toBe(200)},saveResourcesAtomically:async()=>{throw Error('Non1 original must not mint a B receipt')}}
  const physical:unknown[]=[],originalRolls:Record<string,any>={},scope:Record<string,any>={...rules,canObserveBountifulPluginSpellSavingOriginal,pluginCast,activityActor,spellCounterState:state,activityActorSnapshot:actor,activityTargetSnapshots:targets,activityActionDefinition:definition,rollTargets:pluginCast.targets.map((t,i)=>({id:t.token.id,statBlockId:targets[i].statBlockId,name:t.token.label,controller:targets[i].controller==='dm'?'dm':'players',creatureType:targets[i].creatureType,abilities:targets[i].abilities,sizeRank:targets[i].sizeRank,canHearActivitySource:targets[i].canHearActivitySource,canSeeActivitySource:targets[i].canSeeActivitySource})),dnd5eHostSaveFactsV1,restoredPluginTempestuousSource:undefined,pluginTempestuousRetainedSource:undefined,restoredPluginSpellSavingSource:undefined,activityEffectDiceRecipes,activityEffectRollDice:{},action,spellAuthority:{exploration:false},thoughtNativeResolver:resolvePreparedDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast,activitySavingThrowPreview,collectDnd5eActivityRetainedSaveChoice,spellRetainedSaveDice:{},promptedSpellRetainedSaves:new Set(),requestDnd5eOptionalBonusDieUse:async()=>undefined,pluginSpellAbilityGateway:gateway,loadBountifulPluginSpellSavingOriginalSource:read,pluginSpellAbilityOriginalNow:Date.now(),pluginSpellAbilityOriginalRolls:originalRolls,currentLongCastingCombatState:undefined,spellcastingSavingThrows:undefined,sourceActionInterruptionReaction:undefined,useMapStore:{getState:()=>({maps:data.maps.maps})},useCharacterStore:{getState:()=>({characters:data.characters.characters})},pluginSpellCompoundPrimary:undefined,pluginSpellSavingCollector:undefined,createBountifulPluginSpellSavingRoomCollector:(value:Parameters<typeof createBountifulPluginSpellSavingRoomCollector>[0])=>(collector=createBountifulPluginSpellSavingRoomCollector(value)),authorityMap:pluginCast.map}
  const nodes=actualPageNodes(),declarations=bind(nodes.declarations,scope)(),declaration=declarations.find((d:any)=>d.d20RollKind==='saving-throw'&&d.rollerTokenId==='foe-token')
  const probe=createDnd5ePluginSpellSavingOriginalCollector({prepared:pluginCast,currentRoom:{maps:[pluginCast.map],characters:pluginCast.characters},rolls:{activityRolls:{}}});try{const stage=probe.run();fs.writeFileSync('.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-saving-multi-target-r349-r1/target-order-observed-r1.json',JSON.stringify({targets:pluginCast.targets.map(t=>t.token.id),declarations,stage},null,2))}finally{probe.cancel()}
  expect(declaration).toMatchObject({count:2,sides:20,d20RollMode:'advantage'})
  scope.rollDiceBoxValues=async(count:number,sides:number,label:string,_name:string,options:any)=>{
   const spec=await readBountifulPluginSpellSavingOriginalDiceRoute(options.bountifulActivityOriginalDice);physical.push({count,sides,spec})
   expect(spec).toMatchObject({count:2,sides:20,mode:'advantage',rollerTokenId:options.rollerTokenId})
   const request={...identity,requestId:spec.requestId,rollerTokenId:spec.rollerTokenId,targetCharacterId:spec.targetCharacterId,kind:'dice',count,sides,label,targetName:'Foe',values:[],rollKind:'saving-throw',sourceMode:'dm',delivery:'player-roll-request',eventId:'actual-brave-original-pool',updatedAt:1}
   expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200)
   for(const delivery of ['player-roll-start','player-roll-result'])expect((await http.event('dice-roll-request-player-to-dm',{...request,delivery,sourceMode:'player',values:[4,7]},data,spec.memberId)).status).toBe(200)
   expect((await read()).rows.find((row:any)=>row.requestId===spec.requestId).raw.values).toEqual([4,7])
   expect((await http.event('bountiful-native-raw-source-dm-to-host',{sourceKind:'plugin-spell-saving-original-v1',phase:'confirm',...identity,requestId:spec.requestId,rawValues:[4,7],values:[2,3]},data,'host')).status).toBe(200)
   return[2,3]
  }
  const roll=bind(nodes.roll,scope),values=await roll(declaration);expect(values).toEqual([2,3]);const second=declarations.find((d:any)=>d.d20RollKind==='saving-throw'&&d.rollerTokenId==='helper-token');expect(second).toMatchObject({count:2,sides:20,d20RollMode:'advantage'});expect(await roll(second)).toEqual([2,3]);expect(physical).toHaveLength(2)
  const book=await read();expect(book.rows).toHaveLength(2);expect(book.rows[0]).toMatchObject({count:2,mode:'advantage',raw:{values:[4,7]},confirmed:{values:[2,3]}});expect(data.combat.bountifulOriginalParents).toBeUndefined()
  const guard=createDnd5ePluginSpellSavingOriginalCollector({prepared:pluginCast,currentRoom:{maps:[pluginCast.map],characters:pluginCast.characters},rolls:{activityRolls:{}}})
  try{const frontier=guard.operation(guard.run()),plain=decodeSecondChanceParentWire(book.source)as any
   const wrongMetadata=structuredClone(plain);wrongMetadata.rolls.activityRolls[declaration.id].modifier=1
   expect(()=>createDnd5ePluginSpellSavingOriginalCollectorFromBook(frontier,{...book,source:encodeSecondChanceParentWire(wrongMetadata)})).toThrow('matching-frontier-source-required')
   const wrongAction=structuredClone(plain);wrongAction.prepared.action.seq++
   expect(()=>createDnd5ePluginSpellSavingOriginalCollectorFromBook(frontier,{...book,source:encodeSecondChanceParentWire(wrongAction)})).toThrow('matching-frontier-source-required')
   const wrongFaces=structuredClone(plain);wrongFaces.rolls.activityRolls[declaration.id].values=[5,6]
   expect(()=>createDnd5ePluginSpellSavingOriginalCollectorFromBook(frontier,{...book,source:encodeSecondChanceParentWire(wrongFaces)})).toThrow('changed-adopted-prefix')
  }finally{guard.cancel()}
  collector?.close()
  const restored=await restoreBountifulPluginSpellSavingInitialSource(pluginCast,read);expect(restored).toBeDefined()
  scope.restoredPluginSpellSavingSource=restored;scope.pluginSpellAbilityOriginalRolls={}
  expect(await bind(nodes.roll,scope)(declaration)).toEqual([2,3]);expect(physical).toHaveLength(2)
  const observed:unknown[]=[],result=withDnd5eOriginalD20ReadyObserver(value=>observed.push(value),()=>resolvePreparedDnd5ePluginSpellCast({prepared:pluginCast,currentRoom:{maps:[pluginCast.map],characters:pluginCast.characters},rolls:{activityRolls:originalRolls}}))
  expect(result.result.ok).toBe(true);expect(observed).toContainEqual(expect.objectContaining({actorId:'foe-token',kind:'saving-throw',originalRolls:[2,3],rollMode:'advantage'}))
  expect(result.result.state.combatants['foe-token'].classState.activeEffects?.some(effect=>effect.source.rulesId?.endsWith('cause-fear'))).toBe(true)
  expect(result.application?.characters.find(c=>c.id==='support')?.classResources?.['dnd5e-spell-slot-2'].current).toBe(1)
  const successful=resolvePreparedDnd5ePluginSpellCast({prepared:pluginCast,currentRoom:{maps:[pluginCast.map],characters:pluginCast.characters},rolls:{activityRolls:{...originalRolls,[declaration.id]:{values:[2,17],modifier:0,total:19}}}})
  expect(successful.result.ok).toBe(true);expect(successful.result.state.combatants['foe-token'].classState.activeEffects??[]).toEqual([])
 }finally{collector?.close();await http.close();f.dispose()}
},180000)

it('authored saving condition context preserves normal nonfear, no Brave and unrelated outcomes',async()=>{
 const f=await trueHalfSource()
 try{
  const p=f.prepared,activity=p.activity!,actor=p.state.combatants[p.actorToken.id],target=p.state.combatants['foe-token'],check=activity.checks?.[0]
  if(check?.kind!=='saving-throw')throw Error('Genuine check required')
  const mode=(a=activity,t=target,c=check)=>dnd5eActivityHostSavingThrowModeV1({activity:a,actor,target:t,check:c,state:p.state})
  expect(mode()).toBe('advantage')
  expect(mode(activity,{...target,racialSavingThrowAdvantages:undefined})).toBe('normal')
  expect(mode({...activity,outcomes:[]})).toBe('normal')
  expect(mode({...activity,effects:activity.effects?.map(effect=>({...effect,conditions:['prone' as const]}))})).toBe('normal')
  expect(mode({...activity,outcomes:activity.outcomes.map(outcome=>({...outcome,when:{kind:'check' as const,checkId:'unrelated-check',result:'failure' as const}}))})).toBe('normal')
  expect(mode({...activity,outcomes:[...activity.outcomes,...activity.outcomes]})).toBe('normal')
  expect(mode({...activity,outcomes:activity.outcomes.map(outcome=>({...outcome,operations:[...outcome.operations,...outcome.operations]}))})).toBe('normal')
 }finally{f.dispose()}
},180000)
