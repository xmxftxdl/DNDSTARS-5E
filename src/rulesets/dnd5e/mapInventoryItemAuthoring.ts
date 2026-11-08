import type {Token} from '../../store/maps'
import type {Dnd5eInventoryEntry,Dnd5eInventoryItemTemplate} from '../../types/inventory'
import {dnd5eInventoryItemTemplate,listDnd5eInventoryItemTemplates} from './items'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'

export function dnd5eMapPhysicalItemTemplate(item: Dnd5eInventoryItemTemplate,instance?:Dnd5eInventoryEntry): boolean {
  if(!item.magicItem)return !item.resources?.length
  // Only transport an already-issued exact Pact physical instance. Catalogue
  // authoring still passes no instance and cannot mint magic objects.
  const marker=(instance as (Dnd5eInventoryEntry&{pactWeaponPhysicalIdentity?:{schemaVersion:number;inventoryInstanceId:string;equipmentId:string}})|undefined)?.pactWeaponPhysicalIdentity
  return instance?.item.equipment?.dnd5e?.kind==='weapon'&&instance?.quantity===1&&instance.templateId===item.id&&marker?.schemaVersion===1&&marker.inventoryInstanceId===instance.instanceId&&/^pact-weapon:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(marker.equipmentId)&&instance.item.equipment?.id===marker.equipmentId
}
export function dnd5eMapPhysicalItemTemplates() {
  return listDnd5eInventoryItemTemplates().filter(item=>dnd5eMapPhysicalItemTemplate(item))
}
/** DM scene authoring only. Never infer a registered item from its display name. */
export function authorDnd5eMapInventoryItem(token:Token,templateId:string,quantity=1):Partial<Token>|undefined {
  if(token.type!=='obstacle'||token.dnd5eSpellEffect||token.dnd5eSummon)return undefined
  const object=normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState)??{schemaVersion:1 as const}
  if(object.creation||object.sequester)return undefined
  if(templateId==='')return {dnd5eObjectState:{...object,inventoryItem:undefined}}
  const template=dnd5eInventoryItemTemplate(templateId)
  if(!template||!dnd5eMapPhysicalItemTemplate(template)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return undefined
  const receiptId=object.inventoryItem?.templateId===templateId?object.inventoryItem.receiptId:
    `dm-map-item:${token.id.slice(0,100)}:${crypto.randomUUID()}`
  return {dnd5eObjectState:{...object,inventoryItem:{templateId,quantity,receiptId}}}
}
