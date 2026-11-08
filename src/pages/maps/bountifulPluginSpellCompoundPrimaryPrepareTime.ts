import type{PreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{dnd5eTrackableDefinitionIdV1}from'../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import{getRoomSession}from'../../lib/roomSession'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{BountifulPluginSpellCompoundPrimaryBook}from'../../ports/dnd5ePluginSpellCompoundPrimaryTransport'
type Identity={parentId:string;mapId:string;combatId:string}
type Loader=(id:Identity)=>Promise<BountifulPluginSpellCompoundPrimaryBook>
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
/** Re-prepare from current live inputs; only the protected private transaction clock is retained. */
export async function readBountifulPluginSpellCompoundPrimaryPrepareTime(input:{action:PreparedDnd5ePluginSpellCast['action'];mapId:string;spell:PreparedDnd5ePluginSpellCast['spell']},load:Loader):Promise<number|undefined>{
 const{action,spell,mapId}=input
 if(action.type!=='dnd5e-spell-cast'||!action.combatId||spell.automation.mode!=='headless-action'||spell.automation.actionId!=='ice-knife-cast')return undefined
 const session=getRoomSession();if(!session)return undefined
 if(session.role!=='dm')throw Error('ice-knife-primary:private-prepare-host-required')
 let book:BountifulPluginSpellCompoundPrimaryBook
 try{book=await load({parentId:action.id,mapId,combatId:action.combatId})}catch(error){if(error instanceof Error&&error.message==='ice-knife-primary:current-private-primary-required')return undefined;throw error}
 const current=getRoomSession();if(!current||current.role!=='dm'||current.roomId!==session.roomId||current.memberId!==session.memberId||current.roomToken!==session.roomToken)throw Error('ice-knife-primary:current-private-prepare-host-required')
 const source=decodeSecondChanceParentWire(book.source)as{prepared:PreparedDnd5ePluginSpellCast},p=source.prepared,t=p?.transaction
 const definitionId=dnd5eTrackableDefinitionIdV1({namespace:spell.ownerPluginId,kind:'spell',localId:spell.id.startsWith(spell.ownerPluginId+':')?spell.id.slice(spell.ownerPluginId.length+1):spell.id})
 if(book.ok!==true||book.schemaVersion!==1||book.sourceKind!=='plugin-spell-compound-primary-v1'||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||book.parentId!==action.id||book.mapId!==mapId||book.combatId!==action.combatId||!p||signature(p.action)!==signature(action)||signature(p.spell)!==signature(spell)||p.map.id!==mapId||p.state.combatId!==action.combatId||p.actorToken.id!==action.actorTokenId||p.actor.id!==action.characterId||p.activity?.id!=='ice-knife-cast'||p.activityHeadlessAction?.pluginId!==spell.ownerPluginId||p.activityHeadlessAction.actionId!=='ice-knife-cast'||p.activityHeadlessAction.transactionId!==action.id||p.activityHeadlessAction.actorId!==action.actorTokenId||!t||t.schemaVersion!==1||t.id!==action.id||t.actionId!==action.id||t.actorId!==p.actor.id||t.mapId!==mapId||t.combatId!==action.combatId||t.actionKind!=='plugin-spell'||t.status!=='preparing'||t.activity?.schemaVersion!==1||t.activity.definitionId!==definitionId||t.activity.executionId!==action.id||!Number.isSafeInteger(t.createdAt)||t.createdAt<0||t.updatedAt!==t.createdAt||t.rollLedger.entries.length!==0||t.interruptWindows.length!==0)throw Error('ice-knife-primary:exact-private-prepare-transaction-required')
 return t.createdAt
}
