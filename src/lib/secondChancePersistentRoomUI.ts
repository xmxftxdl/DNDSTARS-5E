import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{SharedRoomGatewayPort}from'../ports/sharedRoomGateway'
import{getRoomSession}from'../lib/roomSession'
import{dnd5ePluginFeatureDefinition}from'../rulesets/dnd5e/plugins/pluginContentCatalog'
import{secondChancePhaseRequestId,submitSecondChanceHostConfirmation,type SecondChanceChoiceContext,type SecondChanceRollContext}from'./secondChanceClientCommands'
import type{SecondChancePersistentRoomUI}from'../pages/maps/secondChancePersistentRoomDriver'
import type{createSecondChanceRoomChoiceDriver}from'./secondChanceRoomChoices'
type Choice=Parameters<Parameters<typeof createSecondChanceRoomChoiceDriver>[0]['choose']>[0]&{context?:Record<string,unknown>}
type Owner={rollerTokenId:string;rollerCharacterId?:string;skipChoiceReroll?:boolean;skipDmConfirmation?:boolean;rollKind?:'attack';existingRollMode?:'normal';durableRollRequestId?:string}
/** The same owner SharedChoiceWindow and owner DiceBox used by Maps. The
 * responding client appends its authenticated command; Host strings and
 * delegated-player dice returned here are never converted into player identity. */
export function createSecondChancePersistentRoomUI(input:{map:BattleMap;characters:()=>readonly Character[];choose:(request:Choice)=>Promise<string|undefined>;rollD20:(label:string,targetName:string,owner:Owner)=>Promise<number>;rollDice:(count:number,sides:number,label:string,targetName:string,owner:Owner)=>Promise<readonly number[]>;gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>;round:()=>number;initiativeIndex:()=>number;prepareFollowups?:SecondChancePersistentRoomUI['prepareFollowups'];settlePostNative?:SecondChancePersistentRoomUI['settlePostNative'];confirmStoredRoll?:(values:readonly number[],sides:number,label:string,targetName:string,owner:Owner)=>Promise<readonly number[]>}):SecondChancePersistentRoomUI{
 return{
  prepareFollowups:input.prepareFollowups,
  settlePostNative:input.settlePostNative,
  showChoice:async({receipt,context})=>{
   const feature=dnd5ePluginFeatureDefinition(receipt.featureId),character=input.characters().find(row=>row.id===context.characterId)
   if(!feature)throw Error('second-chance-ui:feature-unavailable')
   const queue=await input.gateway.loadResource<{mapId:string;interrupts:Array<{id:string;status:string;payload?:{secondChance?:SecondChanceChoiceContext}}>} >('combat-interrupts')
   const existing=queue?.mapId===input.map.id?queue.interrupts.find(row=>row.status==='pending'&&row.payload?.secondChance?.attackReceiptId===receipt.attack.id&&row.payload.secondChance.phase===context.phase):undefined
   const windowId=existing?.id??`${secondChancePhaseRequestId(receipt.attack.id,context.phase)}:window:${Date.now().toString(36)}`
   await input.choose({id:windowId,transactionId:receipt.attack.transactionId,mapId:input.map.id,actor:character,pluginId:feature.ownerPluginId,featureId:feature.id,featureName:feature.name,
    prompt:context.phase==='reaction'?'攻击已命中你。使用反应迫使攻击者重掷一枚攻击骰？':'对方使用了花开二度。请选择原攻击的一枚骰重掷，另一枚保留。',
    audience:(context.phase==='reaction'?receipt.attack.targetControllerMemberId:receipt.attack.rollerControllerMemberId)===getRoomSession()?.memberId?'dm':character?'actor':'dm',options:context.phase==='reaction'?[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留反应'},{id:feature.id,label:`使用${feature.name}`}]:[{id:'pending',label:'稍后投掷'},...receipt.attack.dice.map((die,index)=>({id:`die:${index}`,label:`第 ${index+1} 枚：${die}`}))],defaultOptionId:'pending',timeoutMs:60_000,phase:'before-hit',context:{secondChance:context}})
  },
  requestRoll:async({receipt,rollRequestId,supplement})=>{
   const attacker=input.characters().find(row=>row.id===receipt.attack.rollerCharacterId),owner:Owner={rollerTokenId:receipt.attack.rollerTokenId,rollerCharacterId:attacker?.id,skipChoiceReroll:true,existingRollMode:'normal',durableRollRequestId:rollRequestId},name=input.map.tokens.find(row=>row.id===receipt.attack.rollerTokenId)?.label??'攻击者'
   const session=getRoomSession()
   const current=await input.gateway.loadResource<import('./secondChanceHostState').SecondChanceCombat>('combat'),saved=current?.secondChanceAttacks?.[receipt.attack.id]
   if(!saved||saved.attack.transactionId!==receipt.attack.transactionId||saved.attack.mapId!==input.map.id||saved.attack.rollerTokenId!==receipt.attack.rollerTokenId||saved.hostControllerMemberId!==session?.memberId)throw Error('second-chance-ui:current-parent-required')
   if (supplement ? rollRequestId!==supplement.id || saved.pendingCriticalDiceRequests?.[supplement.id]?.count!==supplement.count || saved.pendingCriticalDiceRequests?.[supplement.id]?.sides!==supplement.sides : saved.rollRequestId!==rollRequestId) throw Error('second-chance-ui:current-roll-request-required')
   const raw=supplement?saved.criticalDice?.[supplement.id]:saved.rollerD20?[saved.rollerD20.value]:undefined
   const label=supplement?'花开二度·重击新增骰':'花开二度·强制重掷攻击骰'
   let values:readonly number[]
   if(raw){
    if(!input.confirmStoredRoll)throw Error('second-chance-ui:stored-confirmation-required')
    values=await input.confirmStoredRoll(raw,supplement?.sides??20,label,name,owner)
   }else values=supplement?await input.rollDice(supplement.count,supplement.sides,label,name,owner):[await input.rollD20(label,name,{...owner,rollKind:'attack'})]
   if(session?.role!=='dm')throw Error('second-chance-ui:host-room-required')
   // A player-owned DiceBox posts from handlePlayerDiceRoll in that player's
   // browser. Only an actually DM-controlled roll can be posted here.
   const context:SecondChanceRollContext={attackReceiptId:receipt.attack.id,combatId:receipt.attack.combatId,actorTokenId:receipt.attack.rollerTokenId,characterId:attacker?.id??receipt.attack.rollerTokenId,rollRequestId,count:supplement?.count??1,sides:supplement?.sides??20,supplementRequestId:supplement?.id}
   if(receipt.attack.rollerControllerMemberId===session.memberId){
    const saved=await input.gateway.loadResource<import('./secondChanceHostState').SecondChanceCombat>('combat'),current=saved?.secondChanceAttacks?.[receipt.attack.id],raw=supplement?current?.criticalDice?.[supplement.id]:current?.rollerD20
    if(!raw)throw Error('second-chance-ui:owned-raw-not-locked')
   }
   if(receipt.hostControllerMemberId)await submitSecondChanceHostConfirmation({mapId:input.map.id,context,values,round:input.round(),initiativeIndex:input.initiativeIndex()},input.gateway)
  },
 }
}
