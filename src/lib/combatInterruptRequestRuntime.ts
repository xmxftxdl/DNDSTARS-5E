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
  /** null keeps an authoritative DM pause open until it is explicitly resolved. */
  timeoutMs?: number | null
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
    let settled = false
    const timer = input.timeoutMs === null
      ? undefined
      : globalThis.setTimeout(() => {
          if (settled) return
          settled = true
          if (input.channel.current?.id === input.id) input.channel.current = null
          reject(new Error(`combat-interrupt-timeout:${input.id}`))
        }, Math.max(1_000, input.timeoutMs ?? 310_000))
    const resolveOnce = (value: Value) => {
      if (settled) return
      settled = true
      if (timer !== undefined) globalThis.clearTimeout(timer)
      resolve(value)
    }
    input.channel.current = { id: input.id, ...input.metadata, resolve: resolveOnce }
    if (decision.type === 'wait') return

    let interrupt: SharedCombatInterrupt
    try {
      interrupt = input.create()
    } catch (error) {
      if (input.channel.current?.id === input.id) input.channel.current = null
      settled = true
      if (timer !== undefined) globalThis.clearTimeout(timer)
      reject(error)
      return
    }
    void input.publish(interrupt).catch((error) => {
      if (input.channel.current?.id === input.id) input.channel.current = null
      settled = true
      if (timer !== undefined) globalThis.clearTimeout(timer)
      reject(error)
    })
  })
}
