import { dnd5eInventoryItemTemplate } from './items'
import { normalizeDnd5eMapObjectStateV1, type Dnd5eMapObjectStateV1 } from './mapObjectState'
import type { BattleMap, Token } from '../../store/maps'

export interface Dnd5eCompanionCarriedObject {
  id: string
  pickupReceipt: string
  label: string
  objectState: Dnd5eMapObjectStateV1
  /** Host decision for a newly issued, currently wielded weapon. */
  wieldedWeapon?: { proficient: boolean }
  /** Host-set only after the armor's donning time has completed. */
  wornArmor?: { proficient: boolean }
}

export function normalizeDnd5eCompanionCarriedObjects(value: unknown): Dnd5eCompanionCarriedObject[] | undefined {
  if (!Array.isArray(value) || value.length > 1000) return undefined
  const ids=new Set<string>(), receipts=new Set<string>()
  const result:Dnd5eCompanionCarriedObject[]=[]
  for(const entry of value){
    if(!entry || typeof entry!=='object' || typeof entry.id!=='string' || !entry.id || entry.id.length>160 ||
      typeof entry.pickupReceipt!=='string' || !entry.pickupReceipt || entry.pickupReceipt.length>340 ||
      typeof entry.label!=='string' || entry.label.length>300 || ids.has(entry.id) || receipts.has(entry.pickupReceipt)) return undefined
    const objectState=normalizeDnd5eMapObjectStateV1(entry.objectState)
    if(!objectState?.inventoryItem || (objectState.inventoryItem.quantity!==1 &&
      !dnd5eInventoryItemTemplate(objectState.inventoryItem.templateId)?.ammunitionKind)) return undefined
    ids.add(entry.id);receipts.add(entry.pickupReceipt)
    if (entry.wieldedWeapon != null && (typeof entry.wieldedWeapon !== 'object' ||
      typeof entry.wieldedWeapon.proficient !== 'boolean' || result.some(item => item.wieldedWeapon))) return undefined
    if (entry.wornArmor != null && (typeof entry.wornArmor !== 'object' ||
      typeof entry.wornArmor.proficient !== 'boolean' || result.some(item => item.wornArmor) || entry.wieldedWeapon ||
      dnd5eInventoryItemTemplate(objectState.inventoryItem.templateId)?.equipment?.dnd5e?.kind !== 'armor')) return undefined
    // Possessions are carried by their bearer, never by a previous map area.
    result.push({id:entry.id,pickupReceipt:entry.pickupReceipt,label:entry.label,objectState:{...objectState,areaCapture:undefined},
      ...(entry.wieldedWeapon ? { wieldedWeapon: { proficient: entry.wieldedWeapon.proficient } } : {}),
      ...(entry.wornArmor ? { wornArmor: { proficient: entry.wornArmor.proficient } } : {})})
  }
  return result.length?result:undefined
}

/** Physical possessions survive the effect which animated their bearer. */
export function droppedDnd5eCompanionObjects(token: Token): Token[] {
  return (normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)??[]).map(item=>({
    id:'carried:'+item.id,label:item.label,type:'obstacle',size:1,x:token.x,y:token.y,
    elevationFeet:token.elevationFeet,color:'',emoji:'',
    dnd5eObjectState:{...structuredClone(item.objectState),wornOrCarried:false,
      inventoryItem:{...item.objectState.inventoryItem!,receiptId:'carried:'+item.id}},
  }))
}

/** A map object's explicit weight describes the whole represented stack. */
export function dnd5eMapInventoryUnitWeightPounds(object: Dnd5eMapObjectStateV1): number {
  if (object.weightPounds != null) return object.weightPounds / Math.max(1, object.inventoryItem?.quantity ?? 1)
  const contentsWeight = (object.inventoryItem?.contents ?? []).reduce((sum, entry) =>
    sum + Math.max(0, Number(dnd5eInventoryItemTemplate(entry.templateId)?.weightLb) || 0) * entry.quantity, 0)
  return Math.max(0, Number(dnd5eInventoryItemTemplate(object.inventoryItem?.templateId ?? '')?.weightLb) || 0) + contentsWeight
}

/** Removing a bearer does not delete the physical possessions it was holding. */
export function removeDnd5eMapTokenPreservingPossessions(map: BattleMap, tokenId: string): BattleMap {
  const token=map.tokens.find(candidate=>candidate.id===tokenId)
  if(!token)return map
  const remaining=map.tokens.filter(candidate=>candidate.id!==tokenId)
  const drops=droppedDnd5eCompanionObjects(token)
  if(drops.some(drop=>remaining.some(candidate=>candidate.id===drop.id)))throw Error('carried-object-drop-conflict')
  return {...map,tokens:[...remaining,...drops]}
}

/** Prefer Host-authored physical weight over the ordinary template default. */
export function dnd5eCompanionCarriedWeightPounds(value: unknown): number {
  return (normalizeDnd5eCompanionCarriedObjects(value)??[]).reduce((total,entry)=>
    total+dnd5eMapInventoryUnitWeightPounds(entry.objectState) * entry.objectState.inventoryItem!.quantity,0)
}
