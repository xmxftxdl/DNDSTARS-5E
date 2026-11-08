import {submitBountifulHostTokenResponse} from './bountifulHostTokenResponse'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {getRoomSession} from '../../lib/roomSession'
import {dnd5ePluginFeatureDefinition} from './plugins/pluginContentCatalog'
import type {createSecondChanceRoomChoiceDriver} from '../../lib/secondChanceRoomChoices'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulResponseId,submitBountifulOriginalReroll,submitBountifulHostConfirmation,type BountifulChoiceContext,type BountifulRollContext} from './bountifulLuckClientCommands'

type Choice=Parameters<Parameters<typeof createSecondChanceRoomChoiceDriver>[0]['choose']>[0]&{context?:Record<string,unknown>}
type Owner={rollerTokenId:string;rollerCharacterId?:string;skipChoiceReroll?:boolean;skipDmConfirmation?:boolean;rollKind?:'attack'|'ability-check'|'saving-throw';existingRollMode?:'normal';durableRollRequestId?:string}
type SavedBountifulChoice={id:string;kind?:string;status:string;response?:Record<string,unknown>;payload?:{bountifulLuck?:BountifulChoiceContext}}
export function createBountifulPersistentRoomUI(input:{nativeLuckyChoiceVersion?:1;map:BattleMap;characters:()=>readonly Character[];gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>&Partial<Pick<SharedRoomGatewayPort,'publishEvent'|'saveResourcesAtomically'>>;round:()=>number;initiativeIndex:()=>number;choose:(request:Choice)=>Promise<string|undefined>;rollD20:(label:string,targetName:string,owner:Owner)=>Promise<number>;confirmRetainedD20:(requestId:string,label:string,targetName:string,raw:number)=>Promise<number>;finishChoice?:(id:string,response:Record<string,unknown>)=>Promise<void>}){
 const finishAnswered=async(receipt:BountifulOriginalDieReceipt,owner?:{ownerId:string;featureId:string})=>{
  if(!input.finishChoice)return
  const queue=await input.gateway.loadResource<{mapId:string;interrupts:readonly SavedBountifulChoice[]}>('combat-interrupts');if(!queue)return;if(queue.mapId!==input.map.id)throw Error('bountiful-ui:foreign-choice-map')
  for(const row of queue.interrupts){const context=row.payload?.bountifulLuck;if(row.kind!=='plugin-choice'||row.status!=='answered'||!context||context.parentId!==receipt.identity.parentId||context.occurrence!==receipt.identity.occurrence||context.combatId!==receipt.identity.combatId||context.actorTokenId!==context.ownerId||receipt.controllers[context.ownerId]?.characterId!==context.characterId)continue
   const actualOwner=owner?context.ownerId===owner.ownerId&&context.featureId===owner.featureId:receipt.ownerDecisions.some(choice=>choice.ownerId===context.ownerId&&choice.featureId===context.featureId)
   if(!actualOwner)continue;if(!row.response)throw Error('bountiful-ui:actual-answered-choice-required');await input.finishChoice(row.id,{...row.response})
  }
 }
 return {
  ...(input.nativeLuckyChoiceVersion===1?{nativeLuckyChoiceVersion:1 as const}:{}),
  async showChoice(receipt:BountifulOriginalDieReceipt){
   const option=nextBountifulOriginalDieOwner(receipt);if(!option)return
   const controller=receipt.controllers[option.ownerId],character=input.characters().find(row=>row.id===controller.characterId),feature=dnd5ePluginFeatureDefinition(option.featureId)
   if(!feature)throw Error('bountiful-ui:feature-unavailable')
   const context:BountifulChoiceContext={parentId:receipt.identity.parentId,occurrence:receipt.identity.occurrence,combatId:receipt.identity.combatId,actorTokenId:option.ownerId,characterId:controller.characterId,ownerId:option.ownerId,featureId:option.featureId}
   const queue=await input.gateway.loadResource<{mapId:string;interrupts:readonly SavedBountifulChoice[]}>('combat-interrupts')
   const existing=queue?.mapId===input.map.id?queue.interrupts.find(row=>(row.status==='pending'||!!input.finishChoice&&(row.status==='answered'||row.status==='done'&&(row.response?.optionId==='decline'||row.response?.optionId===option.featureId)))&&row.payload?.bountifulLuck?.parentId===context.parentId&&row.payload.bountifulLuck.occurrence===context.occurrence&&row.payload.bountifulLuck.ownerId===option.ownerId&&(!input.finishChoice||row.kind==='plugin-choice'&&row.payload.bountifulLuck.featureId===option.featureId&&row.payload.bountifulLuck.characterId===controller.characterId&&row.payload.bountifulLuck.actorTokenId===option.ownerId&&row.payload.bountifulLuck.combatId===receipt.identity.combatId)):undefined
   const id=existing?.id??bountifulResponseId(context,'owner:'+option.ownerId)+':window:'+Date.now().toString(36)
   await input.choose({id,transactionId:context.parentId,mapId:input.map.id,actor:character,pluginId:feature.ownerPluginId,featureId:feature.id,featureName:feature.name,
    prompt:'可见盟友的第 '+(receipt.request.dieIndex+1)+' 枚原始 d20 为 1。使用反应让该盟友重掷并采用新结果？你的幸运暂停至下个自己回合结束。',
    audience:controller.memberId===getRoomSession()?.memberId?'dm':'actor',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留反应'},{id:feature.id,label:'使用慷慨吉运'}],defaultOptionId:'pending',timeoutMs:60_000,phase:'before-hit',context:{bountifulLuck:context}})
   await finishAnswered(receipt,{ownerId:option.ownerId,featureId:option.featureId})
  },
  async requestRoll(receipt:BountifulOriginalDieReceipt,refresh:()=>Promise<BountifulOriginalDieReceipt>){
   const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-ui:host-required')
   await finishAnswered(receipt)
   const roller=receipt.identity.roller,character=input.characters().find(row=>row.id===roller.characterId),name=input.map.tokens.find(row=>row.id===roller.tokenId)?.label??'原掷骰者'
   const requestId=bountifulOriginalDieRollId(receipt)
   if(roller.kind==='host-token'){
    const {publishEvent,saveResourcesAtomically}=input.gateway;if(!publishEvent||!saveResourcesAtomically)throw Error('bountiful-ui:host-token-transport-required')
    const gateway={loadResource:input.gateway.loadResource,publishEvent,saveResourcesAtomically},label='慷慨吉运·生物原骰重掷',scope={mapId:input.map.id,parentId:receipt.identity.parentId,occurrence:receipt.identity.occurrence}
    if(!receipt.rawReroll){const raw=await input.rollD20(label,name,{rollerTokenId:roller.tokenId,skipChoiceReroll:true,skipDmConfirmation:true,rollKind:receipt.request.kind,existingRollMode:'normal',durableRollRequestId:requestId});await submitBountifulHostTokenResponse({...scope,command:{phase:'roll',rollRequestId:requestId,value:raw}},gateway)}
    const fresh=await refresh();if(!fresh.rawReroll)throw Error('bountiful-ui:original-host-token-result-pending')
    const value=await input.confirmRetainedD20(requestId,label,name,fresh.rawReroll.value)
    await submitBountifulHostTokenResponse({...scope,command:{phase:'confirm',rollRequestId:requestId,rawValue:fresh.rawReroll.value,value}},gateway);return
   }
   if(!roller.characterId)throw Error('bountiful-ui:original-character-required')
   const context:BountifulRollContext={parentId:receipt.identity.parentId,occurrence:receipt.identity.occurrence,combatId:receipt.identity.combatId,actorTokenId:roller.tokenId,characterId:roller.characterId,rollRequestId:requestId}
   const label=receipt.request.nativeLucky?'半身人幸运·原骰重掷':'慷慨吉运·盟友原骰重掷'
   let confirmed:number
   if(receipt.rawReroll){
    confirmed=await input.confirmRetainedD20(requestId,label,name,receipt.rawReroll.value)
   }else{
    confirmed=await input.rollD20(label,name,{rollerTokenId:roller.tokenId,rollerCharacterId:character?.id,skipChoiceReroll:true,skipDmConfirmation:roller.memberId===session.memberId,rollKind:receipt.request.kind,existingRollMode:'normal',durableRollRequestId:requestId})
    // Only an actually Host-controlled original roller may be posted here.
    // A player-owned DiceBox posts raw faces from that player's browser first.
    if(roller.memberId===session.memberId){
     await submitBountifulOriginalReroll({mapId:input.map.id,context,values:[confirmed],round:input.round(),initiativeIndex:input.initiativeIndex()},input.gateway)
     const raw=await refresh();if(!raw.rawReroll)throw Error('bountiful-ui:original-host-result-pending')
     confirmed=await input.confirmRetainedD20(requestId,label,name,raw.rawReroll.value)
    }
   }
   const fresh=await refresh()
   if(!fresh.rawReroll)throw Error('bountiful-ui:original-player-result-pending')
   await submitBountifulHostConfirmation({mapId:input.map.id,context,rawValue:fresh.rawReroll.value,value:confirmed,round:input.round(),initiativeIndex:input.initiativeIndex()},input.gateway)
  },
 }
}
