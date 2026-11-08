import {createMasterDuelistRoomChoiceDriver} from './masterDuelistRoomChoices'
import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{Dnd5eHeadlessCombatState}from'../rulesets/dnd5e/headlessCombatEngine'
import{dnd5eIncomingAttackRerollOptions}from'../rulesets/dnd5e/headlessCombatEngine'
import{dnd5ePluginFeatureDefinition}from'../rulesets/dnd5e/plugins/pluginContentCatalog'
import type{IncomingAttackRollFacts,IncomingAttackRerollChoice,IncomingCriticalDiceRequest}from'../rulesets/dnd5e/incomingAttackRerollCheckpoint'
interface ChoiceRequest{id:string;transactionId:string;mapId?:string;actor?:Pick<Character,'id'>;actorCharId?:string;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor'|'target'|'dm';options:Array<{id:string;label:string;description?:string}>;defaultOptionId:string;timeoutMs?:number;phase?:'before-hit'|'before-damage'}
interface DiceOwner{rollerTokenId:string;rollerCharacterId?:string;skipChoiceReroll?:boolean;skipDmConfirmation?:boolean;rollKind?:'attack';durableRollRequestId?:string;d20RollKind?:'attack';d20RollMode?:'normal'|'advantage'|'disadvantage';targetCharacterId?:string;existingRollMode?:'normal'}
/** The page passes its actual SharedChoiceWindow and owner-aware shared dice
 * functions. Reaction consent belongs to the defender; selection and the one
 * replacement die belong to the original attacker, including player attackers. */
export function createSecondChanceRoomChoiceDriver(input:{map:BattleMap;characters:()=>readonly Character[];parentTransactionId?:()=>string|null|undefined;choose:(request:ChoiceRequest)=>Promise<string|undefined>;rollD20:(label:string,targetName:string,owner:DiceOwner)=>Promise<number>;rollDice:(count:number,sides:number,label:string,targetName:string,owner:Omit<DiceOwner,'rollKind'>&{rollKind?:'attack'|'damage'})=>Promise<readonly number[]>;masterDuelist?:Pick<Parameters<typeof createMasterDuelistRoomChoiceDriver>[0],'authorityUnchanged'|'shield'>}){
 const characterFor=(tokenId:string)=>{const token=input.map.tokens.find(row=>row.id===tokenId);return input.characters().find(row=>row.id===token?.characterId)}
 return{
  ...(input.masterDuelist?createMasterDuelistRoomChoiceDriver({...input,...input.masterDuelist,parentTransactionId:input.parentTransactionId??(()=>undefined)}):{}),
  chooseIncomingAttackReroll:async(selection:{facts:IncomingAttackRollFacts;state:Dnd5eHeadlessCombatState;eventId:string;occurrence?:number}):Promise<IncomingAttackRerollChoice|undefined>=>{
   const {facts,state}=selection,defender=characterFor(facts.event.targetId),attacker=characterFor(facts.event.actorId)
   const parentId=input.parentTransactionId?.(),identity=JSON.stringify([parentId,input.map.id,state.combatId,facts.event.actorId,facts.event.targetId,selection.occurrence??0])
   let first=2166136261,second=2246822519;for(let index=0;index<identity.length;index++){first=Math.imul(first^identity.charCodeAt(index),16777619);second=Math.imul(second^identity.charCodeAt(index),3266489917)}
   const eventId=parentId?`second-chance:${(first>>>0).toString(36)}${(second>>>0).toString(36)}`:selection.eventId,transactionId=parentId??eventId
   const options=dnd5eIncomingAttackRerollOptions(state,facts.event),definitions=options.flatMap(option=>{const feature=dnd5ePluginFeatureDefinition(option.featureId);return feature?[{...option,feature}]:[]})
   if(!defender||!definitions.length)throw Error('second-chance-ui:owner-unavailable')
   const choice=await input.choose({id:`${eventId}:reaction`,transactionId,mapId:input.map.id,actor:defender,pluginId:definitions[0].feature.ownerPluginId,featureId:definitions[0].feature.id,featureName:definitions[0].feature.name,prompt:'攻击已命中你。是否使用反应，迫使可见的攻击者重掷其中一枚攻击骰？',audience:'actor',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留反应'},...definitions.map(row=>({id:row.feature.id,label:`使用${row.feature.name}`}))],defaultOptionId:'pending',timeoutMs:60_000,phase:'before-hit'})
   const selected=definitions.find(row=>row.feature.id===choice)
   if(choice==='decline')return undefined
   if(!selected)throw Error('second-chance-ui:reaction-decision-pending')
   let dieIndex=0
   if(facts.dice.length>1){
    const die=await input.choose({id:`${eventId}:original-roller-die`,transactionId,mapId:input.map.id,actor:attacker,pluginId:selected.feature.ownerPluginId,featureId:selected.feature.id,featureName:selected.feature.name,prompt:`对方使用了${selected.feature.name}。选择你原攻击中的一枚骰重新掷，另一枚会保留并按原优势或劣势取值。`,audience:attacker?'actor':'dm',options:[...facts.dice.map((value,index)=>({id:`die:${index}`,label:`第 ${index+1} 枚：${value}`})),{id:'cancel',label:'取消本次反应处理'}],defaultOptionId:'cancel',timeoutMs:60_000,phase:'before-hit'})
    if(die==='cancel'||die==null)throw Error('second-chance-ui:attacker-selection-pending')
    const index=facts.dice.findIndex((_,index)=>die===`die:${index}`)
    if(index<0)throw Error('second-chance-ui:invalid-die-selection');dieIndex=index
   }
   const value=await input.rollD20(`${selected.feature.name}·重掷第 ${dieIndex+1} 枚攻击骰`,state.combatants[facts.event.actorId]?.name??'攻击者',{rollerTokenId:facts.event.actorId,rollerCharacterId:attacker?.id,targetCharacterId:defender.id,rollKind:'attack',skipChoiceReroll:true,existingRollMode:'normal'})
   if(!Number.isInteger(value)||value<1||value>20)throw Error('second-chance-ui:invalid-reroll')
   return{featureId:selected.feature.id,dieIndex,newD20:value}
  },
  rollIncomingCriticalDice:async(request:IncomingCriticalDiceRequest):Promise<readonly number[]>=>{
   const attacker=characterFor(request.actorId)
   const values=await input.rollDice(request.count,request.sides,'花开二度·重击新增伤害骰',input.map.tokens.find(row=>row.id===request.actorId)?.label??'攻击者',{rollerTokenId:request.actorId,rollerCharacterId:attacker?.id,skipChoiceReroll:true})
   if(values.length!==request.count||values.some(value=>!Number.isInteger(value)||value<1||value>request.sides))throw Error('second-chance-ui:invalid-critical-dice')
   return values
  },
 }
}
