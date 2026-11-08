import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {captureBountifulMonsterOriginalOperation,issueBountifulMonsterOriginalRollSource,bountifulIssuedHostOperation,bountifulIssuedRawDiceRoute,type BountifulHostOperationCapability} from './bountifulHostOperation'
import {persistBountifulHostOperation} from './bountifulHostOperationPersistent'
import {driveBountifulHostMonsterOriginal} from './bountifulHostOperationDriver'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {dnd5eD20ChoiceRerollFeaturesForCharacter} from './pluginApi'

const previews=new WeakMap<BountifulHostOperationCapability,import('./headlessCombatEngine').Dnd5eHeadlessCombatState>()
export function bountifulHostMonsterOriginalPreview(capability:BountifulHostOperationCapability){bountifulIssuedHostOperation(capability);const preview=previews.get(capability);return preview?cloneDnd5eHostTransactionInput(preview):undefined}

type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type NativeOriginalUI=Parameters<typeof driveBountifulHostMonsterOriginal>[2]&{onParentIssued?:(capability:BountifulHostOperationCapability)=>void;confirmSelfReroll?:(input:{parentId:string;sourceOccurrence:number;dieIndex:number;rawRollId:string;originalValue:number;rollMode:'normal'|'advantage'|'disadvantage';actorTokenId:string;characterId:string})=>Promise<number>}

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
/** The actual DiceBox entry prepares this boundary from the concrete native
 * facade before requesting raw dice. The original remains raw in the protected
 * parent; only the already-authorized retained values return to UI preview. */
export function createBountifulHostMonsterRawBoundary(input:{parentId:string;prepared:Source['prepared'];mode:'normal'|'advantage'|'disadvantage';rawCursor:number;initial?:Omit<Source,'prepared'|'transactionId'|'rolls'>;originalRoll?:Omit<Source['rolls'][number],'d20'|'d20Second'|'mode'|'damageRolls'>},gateway:Gateway,ui:NativeOriginalUI){
 const prepared=cloneDnd5eHostTransactionInput(input.prepared)
 let issued:Awaited<ReturnType<typeof issueBountifulMonsterOriginalRollSource>>
 let completedRaw:readonly number[]|undefined
 return {
  getDiceRoute(){return bountifulIssuedRawDiceRoute(issued)},
  async beforeOriginalRequest(rawRollId:string,count:1|2){
   if(count!==(input.mode==='normal'?1:2))throw Error('bountiful-native-boundary:actual-mode-count-required')
   if(issued&&issued.rawRollId!==rawRollId)throw Error('bountiful-native-boundary:original-request-immutable')
   issued=await issueBountifulMonsterOriginalRollSource({parentId:input.parentId,prepared,rawRollId,rawCursor:input.rawCursor,count},gateway)
  },
  async afterOriginalConfirmed(raw:readonly number[],rawRollId:string):Promise<readonly [number,number|undefined]|undefined>{
   if(!issued)return undefined
   if(rawRollId!==issued.rawRollId||raw.length!==(input.mode==='normal'?1:2)||raw.some(value=>!Number.isInteger(value)||value<1||value>20)||completedRaw&&JSON.stringify(completedRaw)!==JSON.stringify(raw))throw Error('bountiful-native-boundary:changed-confirmed-original')
   completedRaw=[...raw]
   const source:Source={...input.initial,prepared,transactionId:input.parentId,rolls:[{...input.originalRoll,d20:raw[0]!,...(raw.length===2?{d20Second:raw[1]}:{}),mode:input.mode,damageRolls:[]}]}
   const capability=captureBountifulMonsterOriginalOperation({parentId:input.parentId,source,rawRollId,rawCursor:input.rawCursor})
   if(!capability)return undefined
   await persistBountifulHostOperation(capability,gateway)
   ui.onParentIssued?.(capability)
   return continueBountifulHostMonsterOriginal(capability,gateway,ui)
  },
 }
}

/** Resume only the actual current private native parent, without requesting its original raw again. */
export async function continueBountifulHostMonsterOriginal(capability:BountifulHostOperationCapability,gateway:Gateway,ui:NativeOriginalUI):Promise<readonly [number,number|undefined]>{
 const facts=bountifulIssuedHostOperation(capability),prepared=facts.source.prepared,rawRollId=facts.operation.rawRollId
   let ready=await driveBountifulHostMonsterOriginal(facts.operation.parentId,gateway,ui)
   const mode=ready.request.rollMode
   if(!mode)throw Error('bountiful-native-boundary:actual-roll-mode-required')
   const actorId=ready.request.actorId,characterId=prepared.characterIdByCombatantId[actorId],character=prepared.characters.find(row=>row.id===characterId)
   if(character)for(let dieIndex=0;dieIndex<ready.request.values.length;dieIndex++){
    if(ready.request.finalizedDice.includes(dieIndex))continue
    const originalValue=ready.request.values[dieIndex]!
    const hasChoice=!!dnd5eCoreInspirationChoiceRerollOption(character,actorId,mode)||dnd5eD20ChoiceRerollFeaturesForCharacter(character,'attack','self-roll',originalValue,{rollMode:mode,attackAbility:ready.request.attackAbility}).some(row=>row.feature.automation==='full'&&row.feature.declarativeAbility?.automation==='full')
    if(!hasChoice)continue
    if(!ui.confirmSelfReroll)throw Error('bountiful-native-boundary:generic-choice-ui-required')
    const selected=await ui.confirmSelfReroll({parentId:facts.operation.parentId,sourceOccurrence:0,dieIndex,rawRollId,originalValue,rollMode:mode,actorTokenId:actorId,characterId:character.id})
    const next=await driveBountifulHostMonsterOriginal(facts.operation.parentId,gateway,ui)
    if(next.request.values[dieIndex]!==selected)throw Error('bountiful-native-boundary:confirmed-generic-source-required')
    ready=next
   }
   previews.set(capability,cloneDnd5eHostTransactionInput(ready.snapshot))
   return [ready.request.values[0]!,ready.request.values[1]]
}
