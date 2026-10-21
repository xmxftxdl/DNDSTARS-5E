import type {Token} from '../../store/maps'
import type {Dnd5eInventoryItemTemplate} from '../../types/inventory'
import {dnd5eInventoryItemTemplate,listDnd5eInventoryItemTemplates} from './items'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'

export function dnd5eMapPhysicalItemTemplate(item: Dnd5eInventoryItemTemplate): boolean {
  return !item.magicItem && !item.resources?.length
}
export function dnd5eMapPhysicalItemTemplates() {
  return listDnd5eInventoryItemTemplates().filter(dnd5eMapPhysicalItemTemplate)
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
