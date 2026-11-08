import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {it,expect} from 'vitest'
import {prepareDnd5eLocalContentJson} from '../../../src/rulesets/dnd5e/localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from '../../../src/rulesets/dnd5e/contentPackageV2'
import {registerDnd5eRulesPlugin} from '../../../src/rulesets/dnd5e/pluginApi'
import {normalizeCharacter} from '../../../src/store/characters'
import {prepareDnd5eBountifulLuckyDeferral} from '../../../src/rulesets/dnd5e/bountifulLuckPreparation'
import type {BattleMap} from '../../../src/store/maps'
import {createDnd5eConditionEffect} from '../../../src/rulesets/dnd5e/activeEffects'

it.each(['eligible','copied-human','no-feat','spent-reaction','over30','blinded','plain-ability'] as const)('real Map preparation qualifies %s before deferring any native Lucky die',async boundary=>{
  const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try{
    const make=(id:string,race:string,feats:string[])=>normalizeCharacter({id,name:id,race,dnd5eRaceId:race,charClass:'战士',level:4,dnd5eClassLevels:{fighter:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},maxHp:30,currentHp:30,dnd5eFeatIds:feats,equipment:{}})
    const ally=make('ally','halfling',[]),owner=make('owner',boundary==='copied-human'?'human':'halfling',boundary==='no-feat'?[]:[pkg.manifest.id+':bountiful-luck'])
    if(boundary==='blinded')owner.dnd5eCombatState={...owner.dnd5eCombatState,activeEffects:[createDnd5eConditionEffect({condition:'blinded',targetId:owner.id,source:{kind:'dm'}})]}
    const map:BattleMap={id:'map',name:'Map',width:1000,height:700,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'ally-token',characterId:ally.id,type:'player',label:'Ally',x:325,y:325,size:1,color:'',emoji:''},{id:'owner-token',characterId:owner.id,type:'player',label:'Owner',x:boundary==='over30'?675:625,y:325,size:1,color:'',emoji:''}]}
    const result=prepareDnd5eBountifulLuckyDeferral({map,characters:[ally,owner],combatId:'map-deferral',round:1,initiativeOrder:[{tokenId:'ally-token',label:'Ally',emoji:'',color:'',roll:20},{tokenId:'owner-token',label:'Owner',emoji:'',color:'',roll:10}],actorId:'ally-token',kind:boundary==='plain-ability'?'ability-check':'saving-throw',initiativeIndex:0,reactionAvailableByCombatantId:{'ally-token':true,'owner-token':boundary!=='spent-reaction'}})
    expect(result.defer).toBe((boundary==='eligible'||boundary==='plain-ability'))
    expect(result.options?.length??0).toBe((boundary==='eligible'||boundary==='plain-ability')?1:0)
    if(boundary==='copied-human')expect(result.state.combatants['owner-token'].pluginFeatureIds).not.toContain(pkg.manifest.id+':feat-bountiful-luck')
    expect(result.state.combatants['owner-token'].turn.reactionAvailable).toBe(boundary!=='spent-reaction')
  }finally{dispose()}
})
