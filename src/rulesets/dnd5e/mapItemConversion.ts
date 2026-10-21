import type {BattleMap} from '../../store/maps'
import {cellKey, mapCellExtent, tokenOccupiedCellsAt, tokenFootprintDistanceCells, type GridCell} from '../../lib/gridCombat'
import {mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import type {Dnd5eActivityCapabilityProposal} from './activities/dnd5eActivityExecutor'
import {dnd5eInventoryItemTemplate} from './items'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'

/** Select a physical item identity, never infer a water vial from a token label. */
export function dnd5eMapItemConversionTarget(map: BattleMap, anchorCell: GridCell,
  originalTemplateIds: readonly string[]) {
  const matches = map.tokens.filter(token => token.type === 'obstacle' &&
    originalTemplateIds.includes(token.dnd5eObjectState?.inventoryItem?.templateId ?? '') &&
    tokenOccupiedCellsAt(token, map, token).some(cell => cellKey(cell) === cellKey(anchorCell)))
  return matches.length === 1 ? matches[0] : undefined
}

export function dnd5eMapItemConversionBinding(map: BattleMap, anchorCell: GridCell, originalTemplateIds: readonly string[]) {
  const target = dnd5eMapItemConversionTarget(map, anchorCell, originalTemplateIds)
  return target ? JSON.stringify([target.id,target.x,target.y,target.elevationFeet??0,normalizeDnd5eMapObjectStateV1(target.dnd5eObjectState)]) : undefined
}

export function settleDnd5eMapItemConversion(input: {
  map: BattleMap; actorTokenId: string; activity: Dnd5eActivityDefinitionV1; anchorCell: GridCell; actionId: string
  proposal: Extract<Dnd5eActivityCapabilityProposal, {kind:'convert-map-inventory-item'}>
}): {ok:true; map:BattleMap; changedTokenIds:string[]} | {ok:false} {
  const {map, anchorCell, proposal, activity} = input
  const extent = mapCellExtent(map)
  const actors = map.tokens.filter(token => token.id === input.actorTokenId)
  const source = dnd5eMapItemConversionTarget(map, anchorCell, proposal.originalTemplateIds)
  const object = normalizeDnd5eMapObjectStateV1(source?.dnd5eObjectState)
  const item = object?.inventoryItem
  const originalTemplate = item && dnd5eInventoryItemTemplate(item.templateId)
  const replacement = dnd5eInventoryItemTemplate(proposal.templateId)
  const receiptId = `conversion:${input.actionId}:${proposal.operationId}`
  if (actors.length !== 1 || !source || !object || !item || !originalTemplate || !replacement ||
    !Number.isSafeInteger(anchorCell.col) || !Number.isSafeInteger(anchorCell.row) ||
    anchorCell.col < 0 || anchorCell.row < 0 || anchorCell.col >= extent.cols || anchorCell.row >= extent.rows ||
    !Number.isSafeInteger(proposal.quantity) || proposal.quantity < 1 || proposal.quantity > item.quantity ||
    source.dnd5eSpellEffect || source.dnd5eSummon || object.magical || object.wornOrCarried ||
    object.creation || object.sequester || object.arcaneLock || object.remains || object.undeadCreationProtection || object.vegetation ||
    (item.quantity > proposal.quantity && (object.waterContainer || object.consumable)) ||
    originalTemplate.category === 'container' || replacement.category === 'container' ||
    originalTemplate.magicItem || replacement.magicItem || originalTemplate.resources?.length || replacement.resources?.length ||
    originalTemplate.equipment || replacement.equipment || receiptId.length > 300 ||
    map.tokens.filter(token => token.id === source.id).length !== 1 ||
    map.tokens.some(token => token.dnd5eObjectState?.inventoryItem?.receiptId === receiptId) ||
    activity.target.kind !== 'area' || activity.target.origin !== 'point' ||
    activity.target.shape !== 'rect' || activity.target.widthFeet !== 5 || activity.target.lengthFeet !== 5) return {ok:false}
  const actor = actors[0], geometry = mapGeometryRuntimeForMap(map.id)
  const actorElevation = actor.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, actor)
  const sourceElevation = source.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, source)
  const range = activity.target.placeRangeFeet ?? 0
  if (!Number.isFinite(range) || range < 0 || Math.max(
    tokenFootprintDistanceCells(actor, source, map) * (map.feetPerCell ?? 5), Math.abs(actorElevation-sourceElevation)) > range ||
    mapGeometryLineOfEffectBlocked({map,geometry,from:{x:actor.x,y:actor.y},to:{x:source.x,y:source.y},
      fromElevationFeet:actorElevation,toElevationFeet:sourceElevation})) return {ok:false}
  const converted = {...source, id:item.quantity === proposal.quantity ? source.id : crypto.randomUUID(), label:replacement.name,
    dnd5eObjectState:{...object, schemaVersion:1 as const, magical:false,
      inventoryItem:{templateId:proposal.templateId,quantity:proposal.quantity,receiptId}}}
  const tokens = item.quantity === proposal.quantity
    ? map.tokens.map(token => token.id === source.id ? converted : token)
    : [...map.tokens.map(token => token.id === source.id ? {...token,
      dnd5eObjectState:{...object,inventoryItem:{...item,quantity:item.quantity-proposal.quantity}}} : token),converted]
  return {ok:true,map:{...map,tokens},changedTokenIds:[...new Set([source.id,converted.id])]}
}
