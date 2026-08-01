import { setMapGeometryRuntime } from './mapGeometry'
import { planDnd5eMonsterTurn, type Dnd5eMonsterTurnPlan } from '../rulesets/dnd5e/monsterTurnPlanner'
import { setDnd5eRoomMonsterCatalog } from '../rulesets/dnd5e/roomMonsterCatalog'
import { createDnd5eLearnedMonsterDecisionProvider } from '../rulesets/dnd5e/monsterStrategyLearning'
import type { Dnd5eMonsterTurnWorkerInput } from './dnd5eMonsterTurnWorkerProtocol'

/**
 * Installs the request-owned registries before running the pure planner.
 * This function is intentionally synchronous: it runs inside a dedicated
 * Worker, where its CPU cost cannot block the DM interface.
 */
export function resolveDnd5eMonsterTurnWorkerInput(
  input: Dnd5eMonsterTurnWorkerInput,
): Dnd5eMonsterTurnPlan {
  if (input.geometry && input.geometry.mapId !== input.map.id) {
    throw new Error('Monster planner geometry does not belong to the requested map.')
  }

  setMapGeometryRuntime(input.geometry ? [input.geometry] : [])
  setDnd5eRoomMonsterCatalog(input.monsterCatalog ?? [])
  try {
    return planDnd5eMonsterTurn(input.map, input.enemy, input.characters, {
      ...input.options,
      decisionProvider: input.learnedStrategy
        ? createDnd5eLearnedMonsterDecisionProvider(input.learnedStrategy)
        : undefined,
    })
  } finally {
    // Never let a later request inherit geometry or a room/plugin catalogue
    // from the previous encounter handled by this long-lived Worker.
    setMapGeometryRuntime([])
    setDnd5eRoomMonsterCatalog([])
  }
}
