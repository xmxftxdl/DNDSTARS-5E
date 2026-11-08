import{buildActivityCumulativeScene}from'./bountifulActivityCumulative.scene.fixture'
import{normalizeCharacter}from'../../../store/characters'
import{syncDnd5eHitPoints}from'../hitPoints'
import{restoreClassResources}from'../../../lib/classResources'
import{applyDnd5eLevelAdvancement}from'../levelAdvancement'
import{dnd5eCharacterHasPluginFeature}from'../pluginApi'
import{registeredDnd5ePluginFeatures}from'../plugins/pluginContentCatalog'
import type{BattleMap,Token}from'../../../store/maps'
import{prepareDnd5eInitiativeOriginal}from'../initiativeOriginal'
export async function genuineInitiativePreparation(rolls:readonly number[]=[1]){const setup=await buildActivityCumulativeScene();try{
 const fighter=(id:string,race:string)=>restoreClassResources(syncDnd5eHitPoints(normalizeCharacter({id,name:id,rulesetId:'dnd5e-2014-srd-5.1',level:1,charClass:'战士',hitPointMaximumMode:'fixed',dnd5eClassLevels:{fighter:1},dnd5eRaceId:race,abilities:{str:10,dex:12,con:14,int:10,wis:10,cha:10},dnd5eClassChoices:{fighter:{fightingStyles:['archery']}}})),'long-rest')
 const actor=fighter('init-actor','human');let helper=fighter('init-helper','halfling');const featId='local.xge.repaired.archer93:bountiful-luck';for(let level=2;level<=4;level++){const grown=applyDnd5eLevelAdvancement(helper,{schemaVersion:1,classId:'fighter',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],...(level>=3?{subclassId:'champion'}:{}),fighterFightingStyles:['archery'],asiChoices:level===4?[{classLevel:4,choice:{kind:'feat',featId}}]:[]});if(!grown.ok)throw Error(grown.reason);helper=restoreClassResources(grown.character,'long-rest')}
 const feature=registeredDnd5ePluginFeatures().find(f=>f.sourceFeatId===featId&&f.declarativeAbility?.mechanic?.kind==='ally-natural-one-reroll');if(!feature||!dnd5eCharacterHasPluginFeature(helper,feature.id)||(helper.dnd5ePluginFeatureIds??[]).length)throw Error('Actual native acquired B helper required')
 const characters=[actor,helper],tokens:Token[]=characters.map((c,i)=>({id:c.id+'-token',type:'player',characterId:c.id,label:c.name,x:525+i*50,y:325,size:1,color:'',emoji:'I',hp:c.currentHp,maxHp:c.maxHp})),map:BattleMap={id:'actual-initiative-map',name:'Actual pre-combat initiative',width:1500,height:1500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens},input={map,characters,actorTokenId:tokens[0].id,scene:{mapId:map.id,active:false as const,preparationId:'actual-initiative-map:combat:preparation-1',phase:'combat-start' as const},rolls},prepared=prepareDnd5eInitiativeOriginal(input)
 return{dispose:setup.dispose,input,prepared,featureId:feature.id,helperLevel:helper.level,helperNoCopiedFeatureIds:true}
 }catch(error){setup.dispose();throw error}}
