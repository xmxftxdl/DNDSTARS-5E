import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {createSecondChanceRoomChoiceDriver} from '../../lib/secondChanceRoomChoices'
import {getRoomSession} from '../../lib/roomSession'
import type {BountifulEquipmentD20Receipt} from './bountifulEquipmentD20Receipt'
import {bountifulEquipmentD20RollId} from './bountifulEquipmentD20Receipt'
import {bountifulResponseId,submitBountifulEquipmentReroll,submitBountifulEquipmentHostConfirmation,type BountifulEquipmentContext} from './bountifulLuckClientCommands'

type Choice=Parameters<Parameters<typeof createSecondChanceRoomChoiceDriver>[0]['choose']>[0]&{context?:Record<string,unknown>}
type Owner={rollerTokenId:string;rollerCharacterId?:string;skipChoiceReroll:true;skipDmConfirmation?:boolean;rollKind:'attack';existingRollMode:'normal';durableRollRequestId:string}
export function createBountifulEquipmentRoomUI(input:{map:BattleMap;characters:()=>readonly Character[];gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>;round:()=>number;initiativeIndex:()=>number;choose:(request:Choice)=>Promise<string|undefined>;rollD20:(label:string,targetName:string,owner:Owner)=>Promise<number>;confirmRetainedD20:(requestId:string,label:string,targetName:string,raw:number)=>Promise<number>}){
 const context=(receipt:BountifulEquipmentD20Receipt):BountifulEquipmentContext=>({parentId:receipt.identity.parentId,occurrence:receipt.identity.sourceOccurrence,combatId:receipt.identity.combatId,actorTokenId:receipt.identity.roller.tokenId,characterId:receipt.identity.roller.characterId,promptId:receipt.id,rollRequestId:bountifulEquipmentD20RollId(receipt)})
 return {
  async showChoice(receipt:BountifulEquipmentD20Receipt){
   const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-equipment-ui:host-required')
   const bound=context(receipt),character=input.characters().find(row=>row.id===bound.characterId)
   if(!character)throw Error('bountiful-equipment-ui:original-character-unavailable')
   const queue=await input.gateway.loadResource<{mapId:string;interrupts:readonly {id:string;status:string;payload?:{bountifulEquipment?:BountifulEquipmentContext}}[]}>('combat-interrupts')
   const existing=queue?.mapId===input.map.id?queue.interrupts.find(row=>row.status==='pending'&&row.payload?.bountifulEquipment?.promptId===receipt.id):undefined
   const id=existing?.id??bountifulResponseId(bound,'equipment-window:'+receipt.id)+':window:'+Date.now().toString(36)
   await input.choose({id,transactionId:bound.parentId,mapId:input.map.id,actor:character,pluginId:'dndstars.host.inventory',featureId:'equipment-attack-roll-reroll',featureName:'装备重掷攻击骰',
    prompt:'可以消耗装备充能，重掷尚未被替换的一枚原攻击 d20。必须采用新结果。',audience:receipt.identity.roller.memberId===session.memberId?'dm':'actor',
    options:[{id:'pending',label:'稍后处理'},{id:'keep',label:'保留当前结果',description:'当前攻击骰：'+receipt.ready.values.join('、')},...receipt.candidates.flatMap(candidate=>candidate.dieIndices.map(dieIndex=>({id:JSON.stringify(['reroll',candidate.instanceId,candidate.effectId,candidate.resourceId,dieIndex]),label:'用'+candidate.itemName+'重掷第 '+(dieIndex+1)+' 枚 d20',description:'当前为 '+receipt.ready.values[dieIndex]+'；消耗 1 点装备充能，采用新结果。'})))],
    defaultOptionId:'pending',timeoutMs:60_000,phase:'before-hit',context:{bountifulEquipment:bound}})
  },
  async requestRoll(receipt:BountifulEquipmentD20Receipt,refresh:()=>Promise<BountifulEquipmentD20Receipt>){
   const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-equipment-ui:host-required')
   const roller=receipt.identity.roller,character=input.characters().find(row=>row.id===roller.characterId)
   if(!character)throw Error('bountiful-equipment-ui:original-character-unavailable')
   const bound=context(receipt),requestId=bountifulEquipmentD20RollId(receipt),name=input.map.tokens.find(row=>row.id===roller.tokenId)?.label??character.name
   const choice=receipt.choice
   const candidate=choice?.decision==='reroll'?receipt.candidates.find(row=>row.instanceId===choice.instanceId&&row.effectId===choice.effectId):undefined
   const label=(candidate?.itemName??'装备')+'·重掷原攻击骰'
   let confirmed:number
   if(receipt.raw)confirmed=await input.confirmRetainedD20(requestId,label,name,receipt.raw.value)
   else{
    const own=roller.memberId===session.memberId
    confirmed=await input.rollD20(label,name,{rollerTokenId:roller.tokenId,rollerCharacterId:roller.characterId,skipChoiceReroll:true,skipDmConfirmation:own,rollKind:'attack',existingRollMode:'normal',durableRollRequestId:requestId})
    if(own){
     await submitBountifulEquipmentReroll({mapId:input.map.id,context:bound,values:[confirmed],round:input.round(),initiativeIndex:input.initiativeIndex()},input.gateway)
     const raw=await refresh();if(!raw.raw)throw Error('bountiful-equipment-ui:original-host-result-pending')
     confirmed=await input.confirmRetainedD20(requestId,label,name,raw.raw.value)
    }
   }
   const fresh=await refresh()
   if(!fresh.raw)throw Error('bountiful-equipment-ui:original-player-result-pending')
   await submitBountifulEquipmentHostConfirmation({mapId:input.map.id,context:bound,rawValue:fresh.raw.value,value:confirmed,round:input.round(),initiativeIndex:input.initiativeIndex()},input.gateway)
  },
 }
}
