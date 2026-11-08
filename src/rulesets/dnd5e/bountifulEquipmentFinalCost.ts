import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {Dnd5eInventoryEntry} from '../../types/inventory'
import type {BountifulEquipmentD20Receipt} from './bountifulEquipmentD20Receipt'
import {normalizeDnd5eInventory} from './items'

function entries(character:Character|undefined,map:BattleMap,instanceId:string):Dnd5eInventoryEntry[]{
 const carried=character?normalizeDnd5eInventory(character).entries.filter(entry=>entry.instanceId===instanceId):[]
 const physical=map.tokens.flatMap(token=>{
  const objects=[token.dnd5eObjectState,...(token.dnd5eCarriedObjects??[]).map(held=>held.objectState)]
  return objects.flatMap(object=>[object?.inventoryItem?.instance,...(object?.inventoryItem?.contents??[])].filter((entry):entry is Dnd5eInventoryEntry=>!!entry&&entry.instanceId===instanceId))
 })
 return [...carried,...physical]
}
/** Normal Maps postprocessing may place the same thrown item on the map. Keep
 * its charged physical instance, rather than demanding it stay equipped. A
 * vanished/consumed source cannot be restored with its old charge either. */
export function assertBountifulEquipmentFinalCost(receipt:BountifulEquipmentD20Receipt|undefined,resolved:{characters:readonly Character[];map:BattleMap},final:{characters:readonly Character[];map:BattleMap}){
 if(!receipt||receipt.choice?.decision!=='reroll'||!receipt.confirmed)return
 const choice=receipt.choice,characterId=receipt.identity.roller.characterId
 const sourceInventory:ReturnType<typeof normalizeDnd5eInventory>=JSON.parse(receipt.inventorySignature)
 const source=sourceInventory.entries.find(entry=>entry.instanceId===choice.instanceId)?.resources?.[choice.resourceId]
 if(!source||!Number.isInteger(source.current)||source.current<1)throw Error('bountiful-ack:equipment-cost-not-in-final-snapshot')
 const expected=entries(resolved.characters.find(row=>row.id===characterId),resolved.map,choice.instanceId)
 const actual=entries(final.characters.find(row=>row.id===characterId),final.map,choice.instanceId)
 if(!expected.length){if(actual.length)throw Error('bountiful-ack:equipment-cost-not-in-final-snapshot');return}
 const resource=expected[0]?.resources?.[choice.resourceId],held=actual[0]?.resources?.[choice.resourceId]
 if(expected.length!==1||actual.length!==1||!resource||!held||expected[0].templateId!==actual[0].templateId||JSON.stringify(expected[0].item)!==JSON.stringify(actual[0].item)||resource.current!==source.current-1||held.current!==source.current-1||held.maximum!==source.maximum||resource.maximum!==source.maximum)throw Error('bountiful-ack:equipment-cost-not-in-final-snapshot')
}
