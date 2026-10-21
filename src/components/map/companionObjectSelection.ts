import type { Token } from '../../store/maps'
import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import type { Dnd5eCompanionObjectInteraction } from '../../rulesets/dnd5e/companionObjectInteraction'
import type { MapGeometryDoor } from '../../lib/mapGeometry'
import type { OrchestratedScene } from '../../lib/sceneOrchestration'

export function companionObjectOperationIds(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return [...new Set(activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.requiresObjectInteraction ? [operation.id] : [])) ?? [])]
}

export async function requestCompanionObjectSelections(input: {
  mapId: string; operationIds: readonly string[]; doors: readonly MapGeometryDoor[]; pickupObjects?: readonly Token[]
  scenes?: readonly OrchestratedScene[]
  choose: (input: { title: string; message: string; options: { id: string; label: string }[] }) => Promise<string | null>
}): Promise<Record<string, Dnd5eCompanionObjectInteraction> | null> {
  const objects=input.pickupObjects?.filter(token=>token.type==='obstacle' && token.dnd5eObjectState?.inventoryItem)??[]
  const points = input.scenes?.filter(scene => scene.mapId === input.mapId).flatMap(scene => scene.interactionPoints
    .filter(point => point.enabled && point.visibleToPlayers).map(point => ({ scene, point, id: `scene-point:${scene.id}:${point.id}` }))) ?? []
  if (!input.doors.length && !objects.length && !points.length) return null
  const selections: Record<string, Dnd5eCompanionObjectInteraction> = {}
  for (const id of input.operationIds) {
    const doorId = await input.choose({ title: '选择要操作的物件', message: '召唤物移动后执行，届时检查距离和操作条件。',
      options: [...input.doors.map((door, index) => ({ id: door.id, label: `${door.label || '门'}（${index + 1}）` })),
        ...objects.map(token=>({id:'pickup-item:'+token.id,label:`拾取：${token.label}`})),
        ...points.map(({ point, id }) => ({ id, label: `交互：${point.name}` }))] })
    const point = points.find(entry => entry.id === doorId)
    if (point) { selections[id] = { mapId: input.mapId, operation: 'interact-point', sceneId: point.scene.id, interactionPointId: point.point.id }; continue }
    const object=objects.find(token=>'pickup-item:'+token.id===doorId)
    if(object){const item=object.dnd5eObjectState!.inventoryItem!;selections[id]={mapId:input.mapId,operation:'pickup-item',objectTokenId:object.id,expectedReceiptId:item.receiptId,expectedQuantity:item.quantity};continue}
    if (!doorId || !input.doors.some(door => door.id === doorId)) return null
    const operation = await input.choose({ title: '选择操作', message: '优先使用本回合的物件交互机会；已用完时消耗动作。',
      options: [{ id: 'open', label: '打开' }, { id: 'close', label: '关闭' }, { id: 'break', label: '强行破门（动作检定）' }] })
    if (operation !== 'open' && operation !== 'close' && operation !== 'break') return null
    selections[id] = { mapId: input.mapId, doorId, operation }
  }
  return selections
}
