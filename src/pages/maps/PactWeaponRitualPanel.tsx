import {pactWeaponHasImprovedInvocation} from '../../rulesets/dnd5e/pactWeaponEntitlement'
import {DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES} from '../../rulesets/dnd5e/items'
import {useState}from'react'
import type{Character}from'../../types/character'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import {normalizeDnd5eInventory}from'../../rulesets/dnd5e/items'
import {dnd5eClassDefinitionForCharacter}from'../../rulesets/dnd5e/classes'
import {appRoomAuthorityScheduler}from'../../lib/roomAuthorityScheduler'
import {commitPactWeaponRitual}from'../../rulesets/dnd5e/pactWeaponRitualHost'
import {submitPactWeaponRequest,type PactRoomCommand}from'./pactWeaponRoomRequests'
type Status={revision:number;status:string;origin?:string;reviewedMagicInstances?:string[];ritual?:{kind:string;startedSecond:number}}
type ViewCharacter=Character&{dnd5ePactWeaponStatus?:Status;dnd5ePactWeaponAuthority?:{state:{revision:number;binding?:{status:string;origin:string};ritual?:unknown}}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'appendPlayerActionRequest'>
export default function PactWeaponRitualPanel({character,mapId,actorTokenId,isDm,gateway,onCommitted}:{character:ViewCharacter;mapId?:string;actorTokenId?:string;isDm:boolean;gateway:Gateway;onCommitted:()=>Promise<void>}){
 const [form,setForm]=useState('srd-5.1:equipment:dnd5e-longsword'),[selected,setSelected]=useState(''),[consentedInstance,setConsentedInstance]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const level=character.dnd5eClassLevels?.warlock??(dnd5eClassDefinitionForCharacter(character)?.id==='warlock'?character.level:0)
 if(!mapId||!actorTokenId||level<3||!character.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade'))return null
 const improved=pactWeaponHasImprovedInvocation(character)
 const forms=DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES.filter(template=>template.equipment?.dnd5e?.kind==='weapon'&&template.equipment.slot==='mainWeapon'&&(template.equipment.dnd5e.mode==='melee'||improved&&['shortbow','longbow','light-crossbow','heavy-crossbow'].includes((template.equipment.baseEquipmentId??template.equipment.id).replace(/^dnd5e-/,''))))
 const formId=forms.some(template=>template.id===form)?form:forms[0]?.id
 const entries=normalizeDnd5eInventory(character).entries.filter(entry=>entry.quantity===1&&entry.item.magicItem&&entry.item.magicItem.rarity!=='artifact'&&entry.item.equipment?.dnd5e?.kind==='weapon'&&(entry.equippedSlot==='mainWeapon'||entry.equippedSlot==='offHand'))
 const entry=entries.find(row=>row.instanceId===selected)??entries[0],privateState=character.dnd5ePactWeaponAuthority?.state,status=character.dnd5ePactWeaponStatus,revision=privateState?.revision??status?.revision??0,ritual=privateState?.ritual??status?.ritual,binding=privateState?.binding??status
 const review=async()=>{
  if(!entry||consentedInstance!==entry.instanceId)return
  setBusy(true);setNotice('')
  try{await appRoomAuthorityScheduler.run('pact-review:'+character.id,()=>commitPactWeaponRitual({kind:'attest-item',mapId,ownerCharacterId:character.id,inventoryInstanceId:entry.instanceId,sentient:false,expectedPactRevision:revision,transactionId:'review:'+crypto.randomUUID()},gateway));await onCommitted();setNotice('已确认此件物品，可开始绑定。')}catch{setNotice('确认未保存，请重新检查物品。')}finally{setBusy(false)}
 }
 const run=async(command:PactRoomCommand)=>{
  setBusy(true);setNotice('')
  try{
   if(isDm){
    await appRoomAuthorityScheduler.run('pact-panel:'+character.id,async()=>{
     if(command.kind==='start-binding'){if(consentedInstance!==entry?.instanceId)throw Error('review-required');await commitPactWeaponRitual({kind:'attest-item',mapId,ownerCharacterId:character.id,inventoryInstanceId:command.inventoryInstanceId,sentient:false,expectedPactRevision:revision,transactionId:'review:'+crypto.randomUUID()},gateway)}
     // The same authenticated append path serves the explicit player request;
     // DM direct ritual start is a trusted Host command, not a forged principal.
     if(command.kind==='start-binding'||command.kind==='start-release'||command.kind==='complete')await commitPactWeaponRitual({mapId,ownerCharacterId:character.id,transactionId:'panel:'+crypto.randomUUID(),...command},gateway)
     else if(command.kind==='dismiss'){const{commitPactWeaponLifecycle}=await import('../../rulesets/dnd5e/pactWeaponLifecycleHost');await commitPactWeaponLifecycle({mapId,ownerCharacterId:character.id,expectedPactRevision:revision,transactionId:'panel:'+crypto.randomUUID(),kind:'dismiss'},gateway)}
     else{const{commitPactWeaponSummon}=await import('../../rulesets/dnd5e/pactWeaponSummonHost');await commitPactWeaponSummon({mapId,actorTokenId,templateId:command.templateId,expectedPactRevision:revision,transactionId:'panel:'+crypto.randomUUID()},gateway)}
    })
    await onCommitted();setNotice('已保存。')
   }else{await submitPactWeaponRequest({mapId,actorTokenId,characterId:character.id,requestId:crypto.randomUUID(),command},gateway);setNotice('已发送给 DM。')}
  }catch{setNotice('暂未完成，请检查物品持有状态，并请 DM 确认该物品是否可绑定。')}finally{setBusy(false)}
 }
 return <section className="mt-3 rounded-xl border border-violet-300/20 p-3" data-testid="pact-weapon-ritual-panel">
  <h4 className="text-sm font-semibold">契约武器</h4>
  <p className="mt-1 text-xs text-slate-400">绑定或解除魔法武器需要一小时；绑定期间须持续持有，可与短休同时进行。</p>
  {ritual?<><p className="mt-2 text-sm">仪式进行中，满一小时后由 DM 自动结算。</p><button type="button" disabled={busy} onClick={()=>void run({kind:'complete',expectedPactRevision:revision})}>检查仪式完成</button></>:<>
   {binding?.origin!=='ritually-bound-magic'&&<div className="mt-2 space-y-2">
    <label className="block text-xs">塑造契约武器<select aria-label="契约武器形态" value={formId??''} disabled={busy} onChange={event=>setForm(event.target.value)}>{forms.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
    <button type="button" disabled={busy||!formId} onClick={()=>void run({kind:'summon',templateId:formId,expectedPactRevision:revision})}>{binding?.status==='present'?'重新塑造契约武器':'创造契约武器'}</button>
    <p className="text-xs text-slate-400">在空着的手中创造武器；战斗中消耗一个动作。</p>
   </div>}
   {!!entries.length&&<><select aria-label="选择待绑定魔法武器" value={entry?.instanceId??''} disabled={busy} onChange={event=>{setSelected(event.target.value);setConsentedInstance('')}}>{entries.map(row=><option key={row.instanceId} value={row.instanceId}>{row.item.name}</option>)}</select>
   {isDm&&<label className="mt-2 block text-xs"><input type="checkbox" checked={consentedInstance===entry?.instanceId} onChange={event=>setConsentedInstance(event.target.checked?entry!.instanceId:'')}/> 我确认此件实物武器不具智能。</label>}
   {isDm&&<button type="button" disabled={busy||consentedInstance!==entry?.instanceId} onClick={()=>void review()}>确认物品资格</button>}
   <button type="button" disabled={busy||!entry||(isDm?consentedInstance!==entry.instanceId:!status?.reviewedMagicInstances?.includes(entry.instanceId))} onClick={()=>void run({kind:'start-binding',inventoryInstanceId:entry!.instanceId,expectedPactRevision:revision})}>开始绑定仪式</button>
   {!isDm&&entry&&!status?.reviewedMagicInstances?.includes(entry.instanceId)&&<p className="text-xs text-slate-400">请先由 DM 确认此件物品可绑定。</p>}</>}
   {binding?.status==='dismissed'&&<button type="button" disabled={busy} onClick={()=>void run({kind:'summon',expectedPactRevision:revision})}>召回契约武器</button>}
   {binding?.status==='present'&&<button type="button" disabled={busy} onClick={()=>void run({kind:'dismiss',expectedPactRevision:revision})}>收存契约武器</button>}
   {binding?.origin==='ritually-bound-magic'&&<button type="button" disabled={busy} onClick={()=>void run({kind:'start-release',expectedPactRevision:revision})}>开始解除仪式</button>}
  </>}
  {notice&&<p role="status" className="mt-2 text-xs">{notice}</p>}
 </section>
}
