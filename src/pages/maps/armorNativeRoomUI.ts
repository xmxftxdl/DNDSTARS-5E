import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatInterrupt} from '../../lib/combatInterruptQueue'
import type {Character} from '../../types/character'
import {getRoomSession} from '../../lib/roomSession'
import {dnd5ePluginFeatureDefinition} from '../../rulesets/dnd5e/pluginApi'
import {restoreArmorNativeIssuedParent,readArmorNativeIssuedContext} from './armorNativeRoomIssuer'
import {sameActivityParentData} from './postNativeActivityParent'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'mutateCombatInterrupt'>
type Choice={id:string;transactionId:string;mapId:string;actorCharId:string;actor?:Character;pluginId:string;featureId:string;featureName:string;audience:'actor'|'dm';prompt:string;options:{id:string;label:string}[];defaultOptionId:string;timeoutMs:number;phase:'before-hit';context:Record<string,unknown>}
interface Parent {id:string;roomId:string;hostMemberId:string;mapId:string;parentTransactionId:string;targetId:string;targetCharacterId:string;controllerMemberId:string;featureId:string;choiceAttempt?:number;decision:'pending'|'use'|'decline';requestId:string;dependencies:Record<string,number>;raw?:{values:[number];authenticatedSubmitterMemberId:string;transport:string};confirmed?:{values:[number];confirmedBy:string}}
type Journal={schemaVersion:1;parents:Record<string,Parent>;_sync:{revision:number}}
function host(){const session=getRoomSession();if(!session||session.role!=='dm')throw Error('armor-native-ui:host-required');return session}
async function current(id:string,gateway:Gateway){const session=host(),brand=await restoreArmorNativeIssuedParent(id,gateway),context=readArmorNativeIssuedContext(brand),journal=await gateway.loadResource<Journal>('armor-native-parents'),row=journal?.parents[id];if(!row||!journal||row.roomId!==session.roomId||row.hostMemberId!==session.memberId||!sameActivityParentData(row,context.record)||host().roomId!==session.roomId||host().memberId!==session.memberId)throw Error('armor-native-ui:current-original-parent-required');return{session,brand,journal,row,context}}
function binding(record:Record<string,unknown>){return Object.fromEntries(['schemaVersion','parentTransactionId','mapId','combatId','actorId','targetId','targetCharacterId','controllerMemberId','featureId','occurrence'].map(k=>[k,record[k]]).concat([['parentId',record.id]]))}
/** Wake-up values from SharedChoice are hints only. The authenticated server
 * response of the bound original controller is the sole decision fact. */
export async function collectArmorNativeRoomChoice(id:string,gateway:Gateway,ui:{choose:(request:Choice)=>Promise<unknown>;acceptChoice:(parentId:string)=>Promise<void>}){
 const original=await current(id,gateway),{row,session}=original
 if(row.decision!=='pending')return row.decision
 const feature=dnd5ePluginFeatureDefinition(row.featureId);if(!feature)throw Error('armor-native-ui:source-unavailable')
 const receipt='host-armor-choice:'+row.id+':'+(row.choiceAttempt??0),expected=binding(original.context.record)
 const load=async()=>{const queue=await gateway.loadResource<{mapId:string;interrupts:SharedCombatInterrupt[]}>('combat-interrupts');return queue?.mapId===row.mapId?queue.interrupts.find(item=>item.id===receipt):undefined}
 const validate=(choice:SharedCombatInterrupt)=>{if(choice.kind!=='plugin-choice'||choice.mapId!==row.mapId||choice.transactionId!==row.parentTransactionId||choice.actorCharId!==row.targetCharacterId||choice.payload.featureId!==row.featureId||!sameActivityParentData(choice.payload.armorNativeBinding,expected))throw Error('armor-native-ui:choice-binding-mismatch')}
 let choice=await load()
 if(!choice||choice.status==='pending'){
  if(choice)validate(choice)
  await ui.choose({id:receipt,transactionId:row.parentTransactionId,mapId:row.mapId,actorCharId:row.targetCharacterId,pluginId:feature.ownerPluginId,featureId:row.featureId,featureName:feature.name,audience:row.controllerMemberId===session.memberId?'dm':'actor',prompt:'被你诅咒的目标命中了你。是否使用反应投掷一枚六面骰？',options:[{id:'use',label:'使用巫咒盔甲'},{id:'decline',label:'保留反应'},{id:'wait',label:'稍后处理'}],defaultOptionId:'wait',timeoutMs:600000,phase:'before-hit',context:{armorNativeBinding:expected}})
  choice=await load()
 }
 if(!choice)return'pending'
 validate(choice)
 if(choice.status==='answered'){await gateway.mutateCombatInterrupt({operation:'finish',mapId:row.mapId,id:receipt,response:choice.response});choice=await load();if(!choice)throw Error('armor-native-ui:choice-finish-not-persisted');validate(choice)}
 if(choice.status!=='done')return'pending'
 await ui.acceptChoice(id)
 const saved=await current(id,gateway)
 return saved.row.decision
}
type DiceOwner={rollerTokenId:string;rollerCharacterId:string;durableRollRequestId:string;skipChoiceReroll:true}
export async function collectArmorNativeRoomDie(id:string,gateway:Gateway,ui:{roll:(count:number,sides:number,label:string,targetName:string,owner:DiceOwner)=>Promise<readonly number[]>;confirmStored:(values:readonly number[],sides:number,label:string,targetName:string,owner:DiceOwner)=>Promise<readonly number[]>}){
 const {row}=await current(id,gateway)
 if(row.decision!=='use')throw Error('armor-native-ui:actual-use-choice-required')
 if(row.confirmed)return row.confirmed.values[0]
 const owner:DiceOwner={rollerTokenId:row.targetId,rollerCharacterId:row.targetCharacterId,durableRollRequestId:row.requestId,skipChoiceReroll:true}
 const values=row.raw?await ui.confirmStored(row.raw.values,6,'巫咒盔甲','受击者',owner):await ui.roll(1,6,'巫咒盔甲','受击者',owner)
 if(values.length!==1||!Number.isInteger(values[0])||values[0]<1||values[0]>6)throw Error('armor-native-ui:one-d6-required')
 const saved=(await current(id,gateway)).row
 if(!saved.raw||saved.raw.transport!=='authenticated-room-member'||saved.raw.authenticatedSubmitterMemberId!==saved.controllerMemberId||!saved.confirmed||saved.confirmed.confirmedBy!==host().memberId||saved.confirmed.values[0]!==values[0])throw Error('armor-native-ui:actual-confirmation-not-persisted')
 return values[0]
}
/** Called by the actual central Host confirmation hook after it has obtained
 * the original physical raw. The PC first writer must be its own HTTP path. */
export async function recordArmorNativeHostRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Gateway,submit:(payload:{requestId:string;rollerTokenId:string;sides:number;values:readonly number[]})=>Promise<void>){
 if(!input.requestId.startsWith('host-armor-d6:'))return
 const journal=await gateway.loadResource<Journal>('armor-native-parents'),matches=Object.values(journal?.parents??{}).filter(row=>row.requestId===input.requestId)
 if(matches.length!==1)throw Error('armor-native-ui:issued-roll-required')
 const {row,session}=await current(matches[0].id,gateway)
 if(row.decision!=='use'||input.rollerTokenId!==row.targetId||input.sides!==6||input.values.length!==1||!Number.isInteger(input.values[0])||input.values[0]<1||input.values[0]>6)throw Error('armor-native-ui:original-d6-required')
 if(row.raw){if(!sameActivityParentData(row.raw.values,input.values)||row.raw.authenticatedSubmitterMemberId!==row.controllerMemberId||row.raw.transport!=='authenticated-room-member')throw Error('armor-native-ui:locked-owner-raw-required');return}
 if(row.controllerMemberId!==session.memberId)throw Error('armor-native-ui:authenticated-owner-raw-required')
 await submit({requestId:input.requestId,rollerTokenId:row.targetId,sides:6,values:input.values})
 const saved=(await current(row.id,gateway)).row
 if(!sameActivityParentData(saved.raw?.values,input.values)||saved.raw?.authenticatedSubmitterMemberId!==session.memberId||saved.raw.transport!=='authenticated-room-member')throw Error('armor-native-ui:owner-raw-not-persisted')
}
export async function recordArmorNativeHostConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Gateway){
 if(!input.requestId.startsWith('host-armor-d6:'))return
 const journal=await gateway.loadResource<Journal>('armor-native-parents'),matches=Object.values(journal?.parents??{}).filter(row=>row.requestId===input.requestId)
 if(matches.length!==1)throw Error('armor-native-ui:issued-roll-required')
 const {row,session,journal:currentJournal}=await current(matches[0].id,gateway)
 if(row.decision!=='use'||!row.raw||row.raw.authenticatedSubmitterMemberId!==row.controllerMemberId||row.raw.transport!=='authenticated-room-member'||input.rollerTokenId!==row.targetId||input.sides!==6||input.values.length!==1||!Number.isInteger(input.values[0])||input.values[0]<1||input.values[0]>6)throw Error('armor-native-ui:locked-original-d6-required')
 if(row.confirmed){if(row.confirmed.confirmedBy!==session.memberId||!sameActivityParentData(row.confirmed.values,input.values))throw Error('armor-native-ui:confirmed-d6-changed');return}
 const next={...currentJournal,parents:{...currentJournal.parents,[row.id]:{...row,confirmed:{values:[input.values[0]],confirmedBy:session.memberId,confirmedAt:Date.now()}}}}
 await gateway.saveResourcesAtomically([{name:'armor-native-parents',expectedRevision:currentJournal._sync.revision,data:next}],{transactionId:'armor-native-confirm:'+row.requestId,readRevisions:row.dependencies})
}
