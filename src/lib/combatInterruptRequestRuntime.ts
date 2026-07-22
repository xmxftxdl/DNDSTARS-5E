import type { SharedCombatInterrupt } from './combatInterruptQueue'

export interface PendingCombatInterruptRequestChannel<
  Value,
  Metadata extends Record<string, unknown> = Record<string, never>,
> {
  current: ({
    id: string
    resolve: (value: Value) => void
  } & Metadata) | null
}

export type ExistingCombatInterruptDecision<Value> =
  | { type: 'resolve'; value: Value }
  | { type: 'wait' }
  | { type: 'publish' }

interface RequestAndWaitForCombatInterruptInput<
  Value,
  Metadata extends Record<string, unknown>,
> {
  id: string
  channel: PendingCombatInterruptRequestChannel<Value, Metadata>
  metadata: Metadata
  loadExisting?: () => Promise<SharedCombatInterrupt | undefined>
  decideExisting?: (existing: SharedCombatInterrupt | undefined) => ExistingCombatInterruptDecision<Value>
  create: () => SharedCombatInterrupt
  publish: (interrupt: SharedCombatInterrupt) => Promise<void>
}

/**
 * 在发布前先登记 resolver，避免快速 SSE 回包先于页面进入等待状态。
 * 重连时可复用服务端已有的 pending Interrupt；终态则直接恢复原事务。
 */
export async function requestAndWaitForCombatInterrupt<
  Value,
  Metadata extends Record<string, unknown>,
>(input: RequestAndWaitForCombatInterruptInput<Value, Metadata>): Promise<Value> {
  const existing = input.loadExisting ? await input.loadExisting() : undefined
  const decision = input.decideExisting?.(existing) ?? { type: 'publish' as const }
  if (decision.type === 'resolve') return decision.value

  return new Promise<Value>((resolve, reject) => {
    input.channel.current = { id: input.id, ...input.metadata, resolve }
    if (decision.type === 'wait') return

    let interrupt: SharedCombatInterrupt
    try {
      interrupt = input.create()
    } catch (error) {
      if (input.channel.current?.id === input.id) input.channel.current = null
      reject(error)
      return
    }
    void input.publish(interrupt).catch((error) => {
      if (input.channel.current?.id === input.id) input.channel.current = null
      reject(error)
    })
  })
}
