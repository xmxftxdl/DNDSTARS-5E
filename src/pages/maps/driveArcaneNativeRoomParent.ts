import type{ArcaneSpellSaveInput}from'./arcaneSpellSaveCheckpoint'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {captureArcaneNativeIssuedParent,captureArcaneMonsterIssuedParent,captureArcaneSpellSaveIssuedParent,captureArcaneSpellAttackIssuedParent,captureArcanePluginAttackIssuedParent,captureArcaneClassAttackIssuedParent,captureArcaneClassSaveIssuedParent,persistArcaneNativeIssuedParent} from './arcaneNativeRoomIssuer'
import {publishArcaneNativeRoomParent} from './arcaneNativeRoomSettlement'
import type {ArcaneEquipmentInput,ArcaneMonsterInput,ArcaneSpellAttackInput} from './arcanePreparedCheckpoint'
import {readArcaneNativePublishedSettlement} from './arcaneNativeMapsSettlement'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
/** Opens a genuine original equipment or Monster parent or recovers its private ID.
 * Owner choices are submitted by the owner's separate authenticated browser.
 * There is deliberately no callback accepting a SharedChoice return value. */
export async function driveArcaneNativeRoomParent(input:{id:string}|ArcaneEquipmentInput|{kind:'monster';input:ArcaneMonsterInput;hostParentTransactionId:string}|{kind:'spell-save';input:ArcaneSpellSaveInput}|{kind:'spell-attack';input:ArcaneSpellAttackInput}|{kind:'plugin-attack';input:Parameters<typeof captureArcanePluginAttackIssuedParent>[0]}|{kind:'class-attack';input:Parameters<typeof captureArcaneClassAttackIssuedParent>[0]}|{kind:'class-save';input:Parameters<typeof captureArcaneClassSaveIssuedParent>[0]},gateway:Gateway,prefixPorts?:Parameters<typeof publishArcaneNativeRoomParent>[2]){
 let id:string
 if('id'in input)id=input.id
 else{
  const brand='kind'in input?input.kind==='monster'?await captureArcaneMonsterIssuedParent(input,gateway):input.kind==='spell-save'?await captureArcaneSpellSaveIssuedParent(input.input,gateway):input.kind==='spell-attack'?await captureArcaneSpellAttackIssuedParent(input.input,gateway):input.kind==='plugin-attack'?await captureArcanePluginAttackIssuedParent(input.input,gateway):input.kind==='class-attack'?await captureArcaneClassAttackIssuedParent(input.input,gateway):await captureArcaneClassSaveIssuedParent(input.input,gateway):await captureArcaneNativeIssuedParent(input,gateway)
  const row=await persistArcaneNativeIssuedParent(brand,gateway)
  if(typeof row.id!=='string'||!row.id)throw Error('arcane-maps:issued-original-id-required')
  id=row.id
 }
 let result:Awaited<ReturnType<typeof publishArcaneNativeRoomParent>>
 try{result=await publishArcaneNativeRoomParent(id,gateway,prefixPorts)}catch(error){if(error instanceof Error&&(error.message==='arcane-prefix:original-confirmation-pending'||error.message==='combat-dice-cancelled'))return{status:'pending-concentration' as const,parentId:id};throw error}
 if(result.status==='published')return {...result,parentId:id,settlement:readArcaneNativePublishedSettlement(result.settlement)}
 return {...result,parentId:id}
}
