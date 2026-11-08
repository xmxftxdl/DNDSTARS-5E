import{it,expect}from'vitest'
import{nativeMasterDuelistBundle,growMasterRogue}from'./masterDuelist.native.fixture'
import{registerDnd5eRulesPlugin,dnd5eCharacterHasPluginFeature,dnd5ePluginResourceDefinition}from'./pluginApi'
import{dnd5eRulesPluginFromUnifiedContentBundleV1}from'./unifiedContent'
import{createDnd5eMapCombatSnapshot}from'./mapBridge'
import{normalizeCharacter}from'../../store/characters'
import{masterDuelistOptions,masterDuelistRerollMode,withMasterDuelistCheckpoints,visitMasterDuelistFinalMiss}from'./masterDuelistCheckpoint'
import{resolveDnd5eRollMode}from'./rollMode'
it('real native Swash source acquires Master only through lawful Rogue1-to17 advancement and its actual short-rest resource',async()=>{
 const bundle=await nativeMasterDuelistBundle(),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle));try{
 const ns=bundle.manifest.id,lower=growMasterRogue(ns,16),hero=growMasterRogue(ns,17),fid=ns+':swashbuckler.master-duelist';expect(dnd5eCharacterHasPluginFeature(lower,fid)).toBe(false);expect(dnd5eCharacterHasPluginFeature(hero,fid)).toBe(true);expect(hero.dnd5ePluginFeatureIds??[]).toEqual([])
 const target=normalizeCharacter({id:'target',name:'Target',charClass:'fighter',level:1,dnd5eClassLevels:{fighter:1}}),characters=[hero,target]
 const map:any={id:'master-map',name:'Master',width:400,height:400,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,i)=>({id:c.id+'-token',characterId:c.id,type:i?'enemy':'player',label:c.name,x:25+i*50,y:25,size:1,color:'',emoji:''}))}
 const snapshot=createDnd5eMapCombatSnapshot({map,characters,combatId:'master-native-source',round:1,initiativeOrder:map.tokens.map((t:any,i:number)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))})
 const options=masterDuelistOptions(snapshot.state,'rogue-token'),resource=dnd5ePluginResourceDefinition(ns+':master-duelist');expect(options).toEqual([{featureId:fid,resourceId:ns+':master-duelist'}]);expect(resource?.resetOn).toBe('short-rest')
 const before=structuredClone(snapshot.state);expect(()=>withMasterDuelistCheckpoints('native-source-negative',()=>{throw Error('must not reach a listener without actual native original')},()=>visitMasterDuelistFinalMiss({state:snapshot.state,actorId:'rogue-token',targetId:'target-token',attack:{roll:{d20:2,total:2}} as any,hit:false,armorClass:20,events:[],spendResource:()=>true}))).toThrow('master-duelist:actual-native-attack-required');expect(snapshot.state).toEqual(before)
 }finally{dispose()}
})
it('canonical source reasons preserve cancellation and existing disadvantage for the whole new pool',()=>{
 const both=resolveDnd5eRollMode({advantage:[{active:true,reason:'actual-advantage'}],disadvantage:[{active:true,reason:'actual-disadvantage'}]});expect(masterDuelistRerollMode(both,true).mode).toBe('normal')
 const disadvantage=resolveDnd5eRollMode({disadvantage:[{active:true,reason:'actual-disadvantage'}]});expect(masterDuelistRerollMode(disadvantage,true).mode).toBe('normal')
 const normal=resolveDnd5eRollMode({});expect(masterDuelistRerollMode(normal,true).mode).toBe('advantage');expect(masterDuelistRerollMode(normal,false).mode).toBe('normal')
})
