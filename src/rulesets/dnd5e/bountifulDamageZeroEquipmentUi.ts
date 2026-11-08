import type{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
type Source=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
type Point={x:number;y:number}
/** Original input controls needed by the unchanged Page finisher. No result,
 * event ledger, snapshot or opaque permission is encoded here. The private
 * original book binds these inputs; native/Base and final CAS remain authority. */
export interface BountifulDamageZeroEquipmentUi{schemaVersion:1;shieldAttempted:boolean;shieldSucceeded:boolean;allyRepositionMovementTrace?:{tokenId:string;to:Point;path:readonly Point[]}}
export type BountifulDamageZeroEquipmentUiSource=Source&{hostDamageZeroEquipmentUi:BountifulDamageZeroEquipmentUi}
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const closed=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(key=>keys.includes(key))
const point=(v:unknown):v is Point=>data(v)&&closed(v,['x','y'])&&typeof v.x==='number'&&Number.isFinite(v.x)&&typeof v.y==='number'&&Number.isFinite(v.y)
export function readBountifulDamageZeroEquipmentUi(source:Source):BountifulDamageZeroEquipmentUi{
 const ui=(source as Source&{hostDamageZeroEquipmentUi?:unknown}).hostDamageZeroEquipmentUi
 if(!data(ui)||!closed(ui,['schemaVersion','shieldAttempted','shieldSucceeded','allyRepositionMovementTrace'])||ui.schemaVersion!==1||typeof ui.shieldAttempted!=='boolean'||typeof ui.shieldSucceeded!=='boolean'||ui.shieldSucceeded&&!ui.shieldAttempted)throw Error('damage-zero-equipment-ui:original-input-controls-required')
 const move=ui.allyRepositionMovementTrace
 if(move!==undefined&&(!data(move)||!closed(move,['tokenId','to','path'])||typeof move.tokenId!=='string'||!move.tokenId||!point(move.to)||!Array.isArray(move.path)||move.path.length<1||move.path.length>10000||!move.path.every(point)))throw Error('damage-zero-equipment-ui:original-movement-input-required')
 if(move!==undefined){const actual=move as {tokenId:string;to:Point;path:readonly Point[]};const payloads=Object.values(source.declarativeIntentPayloads??{});if(!payloads.some(payload=>payload.secondaryTargetId===actual.tokenId&&payload.destination?.x===actual.to.x&&payload.destination?.y===actual.to.y)||!source.prepared.map.tokens.some(token=>token.id===actual.tokenId))throw Error('damage-zero-equipment-ui:exact-original-movement-input-required')}
 return structuredClone(ui) as unknown as BountifulDamageZeroEquipmentUi
}
export function withBountifulDamageZeroEquipmentUi(source:Source,ui:BountifulDamageZeroEquipmentUi):BountifulDamageZeroEquipmentUiSource{const out={...source,hostDamageZeroEquipmentUi:structuredClone(ui)};readBountifulDamageZeroEquipmentUi(out);return out}
