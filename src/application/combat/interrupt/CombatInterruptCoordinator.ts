export type CombatInterruptSettlementReason = 'expired' | 'answered'

export interface CombatInterruptCoordinatorPorts<TInterrupt, TQueue> {
  currentMapId?: () => string | undefined
  queueMapId: (queue: TQueue) => string | undefined
  queueInterrupts: (queue: TQueue) => readonly TInterrupt[]
  interruptId: (interrupt: TInterrupt) => string
  loadQueue: () => Promise<TQueue | undefined>
  publish: (interrupt: TInterrupt) => Promise<void>
  answer: (mapId: string, id: string, response: Record<string, unknown>) => Promise<void>
  finish: (mapId: string, id: string, response?: Record<string, unknown>) => Promise<void>
  waitForDm: (mapId: string, id: string) => Promise<void>
  rollback: (
    mapId: string,
    id: string,
    response: Record<string, unknown> | undefined,
    reason: 'timeout',
  ) => Promise<void>
  beforePublish?: (interrupt: TInterrupt) => Promise<void>
}

/**
 * Application-level owner of the shared interrupt lifecycle.
 *
 * React may present or answer an interrupt, but it must not reconstruct the
 * room/map scope or choose between commit and rollback itself. The persistence
 * adapter remains authoritative and revalidates every transition.
 */
export class CombatInterruptCoordinator<TInterrupt, TQueue> {
  private readonly ports: CombatInterruptCoordinatorPorts<TInterrupt, TQueue>

  constructor(ports: CombatInterruptCoordinatorPorts<TInterrupt, TQueue>) {
    this.ports = ports
  }

  async publish(interrupt: TInterrupt): Promise<void> {
    await this.ports.beforePublish?.(interrupt)
    await this.ports.publish(interrupt)
  }

  async load(id: string, mapId = this.ports.currentMapId?.()): Promise<TInterrupt | undefined> {
    if (!mapId) return undefined
    const queue = await this.ports.loadQueue()
    if (!queue || this.ports.queueMapId(queue) !== mapId) return undefined
    return this.ports.queueInterrupts(queue)
      .find((interrupt) => this.ports.interruptId(interrupt) === id)
  }

  async answer(
    id: string,
    response: Record<string, unknown>,
    mapId = this.ports.currentMapId?.(),
  ): Promise<boolean> {
    if (!mapId) return false
    await this.ports.answer(mapId, id, response)
    return true
  }

  async finish(
    id: string,
    response?: Record<string, unknown>,
    mapId = this.ports.currentMapId?.(),
  ): Promise<boolean> {
    if (!mapId) return false
    await this.ports.finish(mapId, id, response)
    return true
  }

  async waitForDm(id: string, mapId = this.ports.currentMapId?.()): Promise<boolean> {
    if (!mapId) return false
    await this.ports.waitForDm(mapId, id)
    return true
  }

  async settle(
    id: string,
    response: Record<string, unknown> | undefined,
    reason: CombatInterruptSettlementReason,
    mapId = this.ports.currentMapId?.(),
  ): Promise<boolean> {
    if (!mapId) return false
    if (reason === 'answered') {
      await this.ports.finish(mapId, id, response)
    } else {
      await this.ports.rollback(mapId, id, response, 'timeout')
    }
    return true
  }
}
