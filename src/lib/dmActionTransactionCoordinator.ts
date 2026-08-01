import {
  commitCombatTransaction,
  createCombatTransaction,
  rollbackCombatTransaction,
  type CombatTransaction,
} from './combatTransaction'
import {
  appRoomAuthorityScheduler,
  type RoomAuthorityScheduler,
} from './roomAuthorityScheduler'

export interface DmAuthoritativeActionTransactionInput {
  id: string
  mapId: string
  combatId?: string
  actorId: string
  actionId: string
  actionKind: string
  now?: number
}

export type DmAuthoritativeActionOutcome =
  | { status: 'accepted' }
  | { status: 'rejected'; reason: string }
  | { status: 'ignored' }

export class DmActionTransactionCoordinator {
  private queue: Promise<void> = Promise.resolve()
  private inFlight = new Map<string, Promise<void>>()
  private transactions = new Map<string, CombatTransaction>()
  private readonly authorityScheduler: RoomAuthorityScheduler

  constructor(
    authorityScheduler: RoomAuthorityScheduler = appRoomAuthorityScheduler,
  ) {
    this.authorityScheduler = authorityScheduler
  }

  enqueue(run: () => Promise<void>, recover: (error: unknown) => Promise<void>): Promise<void> {
    const task = this.queue.then(async () => {
      try {
        await run()
      } catch (error) {
        await recover(error)
        throw error
      }
    })
    this.queue = task.catch(() => undefined)
    return task
  }

  /** 同一共享动作 ID 在当前 DM 权威进程中只能进入一次结算链。 */
  enqueueTransaction(
    transactionId: string,
    run: () => Promise<void>,
    recover: (error: unknown) => Promise<void>,
  ): Promise<void> {
    const existing = this.inFlight.get(transactionId)
    if (existing) return existing
    const task = this.enqueue(run, recover)
    this.inFlight.set(transactionId, task)
    void task.finally(() => {
      if (this.inFlight.get(transactionId) === task) this.inFlight.delete(transactionId)
    }).catch(() => undefined)
    return task
  }

  enqueueCombatTransaction(
    input: DmAuthoritativeActionTransactionInput,
    run: (transaction: CombatTransaction) => Promise<DmAuthoritativeActionOutcome>,
    recover: (error: unknown, transaction: CombatTransaction) => Promise<void>,
  ): Promise<void> {
    const existing = this.inFlight.get(input.id)
    if (existing) return existing

    const previousTransaction = this.transactions.get(input.id)
    const transaction = createCombatTransaction(input)
    this.transactions.set(input.id, transaction)
    return this.enqueueTransaction(
      input.id,
      async () => {
        const outcome = await this.authorityScheduler.run(input.id, () => run(transaction))
        const current = this.transactions.get(input.id) ?? transaction
        if (outcome.status === 'ignored') {
          if (previousTransaction) this.transactions.set(input.id, previousTransaction)
          else this.transactions.delete(input.id)
          return
        }
        this.transactions.set(input.id, outcome.status === 'accepted'
          ? commitCombatTransaction(current)
          : rollbackCombatTransaction(current, outcome.reason))
      },
      async (error) => {
        const current = this.transactions.get(input.id) ?? transaction
        if (current.status !== 'committed' && current.status !== 'rolled-back') {
          this.transactions.set(input.id, rollbackCombatTransaction(current, 'authority-execution-failed'))
        }
        await recover(error, this.transactions.get(input.id) ?? current)
      },
    )
  }

  isLocked(transactionId: string): boolean {
    return this.inFlight.has(transactionId)
  }

  transaction(transactionId: string): CombatTransaction | undefined {
    return this.transactions.get(transactionId)
  }
}
