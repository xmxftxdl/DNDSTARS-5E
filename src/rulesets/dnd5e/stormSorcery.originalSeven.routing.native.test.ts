import{it,expect}from'vitest'
import{stormOriginalSevenSource}from'./stormSorcery.originalSeven.native.fixture'
import{dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{dnd5eRulesPluginFromUnifiedContentBundleV1}from'./unifiedContent'
import{registerDnd5eRulesPlugin,dnd5eDeclarativeTriggeredActions,dnd5eDeclarativeAttackIntentsForCharacter}from'./pluginApi'
import{registeredDnd5ePluginFeatures}from'./plugins/pluginContentCatalog'
import{growStorm}from'./stormSorcery.growth.native.fixture'
import{normalizeCharacter}from'../../store/characters'
import{createDnd5eMapCombatSnapshot}from'./mapBridge'
it.each(['legacy','unified']as const)('the original seven %s carrier never routes the attacking Sorcerer Fury through generic after-hit actions',async carrier=>{
 const made=await stormOriginalSevenSource(),dispose=registerDnd5eRulesPlugin(carrier==='legacy'?dnd5eRulesPluginFromContentPackageV2(made.pkg):dnd5eRulesPluginFromUnifiedContentBundleV1(made.bundle));try{
 const actor=growStorm(14),target=normalizeCharacter({id:'ordinary-target',name:'Target',charClass:'战士',level:1,dnd5eClassLevels:{fighter:1}}),characters=[actor,target],tokens=characters.map((c,i)=>({id:c.id+'-token',characterId:c.id,type:'player' as const,dnd5eSide:i?'enemy' as const:'player' as const,label:c.name,x:125+i*50,y:125,size:1,color:'',emoji:'',hp:c.currentHp,maxHp:c.maxHp})),map={id:'original-seven-routing',name:'Routing',width:1000,height:800,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens},snapshot=createDnd5eMapCombatSnapshot({map,characters,combatId:'original-seven-routing',initiativeOrder:tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:20-i,color:'',emoji:''})),geometry:null}),native=registeredDnd5ePluginFeatures().find(f=>f.ownerPluginId===made.namespace&&f.declarativeAbility?.mechanic?.kind==='storm-fury');
 expect(native).toBeTruthy();expect(native!.action).toBeTruthy();expect(snapshot.state.combatants[tokens[0].id].pluginFeatureIds).toContain(native!.id);
 const actions=dnd5eDeclarativeTriggeredActions(snapshot.state,{type:'attack-resolved',actorId:tokens[0].id,targetId:tokens[1].id,d20:18,total:20,armorClass:10,hit:true,critical:false,attackMode:'melee'},0);
 expect(actions.filter(a=>a.featureId===native!.id)).toEqual([]);expect(dnd5eDeclarativeAttackIntentsForCharacter(actor).filter(a=>a.feature.id===native!.id)).toEqual([])
 }finally{dispose()}
})
