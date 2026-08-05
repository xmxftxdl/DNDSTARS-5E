import { CombatInterruptCoordinator } from '../../application/combat/interrupt/CombatInterruptCoordinator'
import {
  COMBAT_INTERRUPT_RESOURCE,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from '../../lib/combatInterruptQueue'
import {
  answerSharedCombatInterrupt,
  finishSharedCombatInterrupt,
  publishSharedCombatInterrupt,
  rollbackSharedCombatInterrupt,
  waitSharedCombatInterruptForDm,
} from '../../lib/combatInterruptSync'
import { browserSharedRoomService } from '../browserSharedRoomService'

export function createBrowserCombatInterruptCoordinator(): CombatInterruptCoordinator<
  SharedCombatInterrupt,
  SharedCombatInterruptQueueState
> {
  const {
    loadSharedResource,
    mutateSharedCombatInterrupt,
    saveSharedResource,
  } = browserSharedRoomService
  return new CombatInterruptCoordinator({
    queueMapId: (queue) => queue.mapId,
    queueInterrupts: (queue) => queue.interrupts,
    interruptId: (interrupt) => interrupt.id,
    loadQueue: async () =>
      (await loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)) ?? undefined,
    publish: (interrupt) => publishSharedCombatInterrupt({
      loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, interrupt,
    }),
    answer: (mapId, id, response) => answerSharedCombatInterrupt({
      loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, mapId, id, response,
    }),
    finish: (mapId, id, response) => finishSharedCombatInterrupt({
      loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, mapId, id, response,
    }),
    waitForDm: (mapId, id) => waitSharedCombatInterruptForDm({
      loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, mapId, id,
    }),
    rollback: (mapId, id, response, reason) => rollbackSharedCombatInterrupt({
      loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, mapId, id, response, reason,
    }),
  })
}
