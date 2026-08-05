export type CommandFailureKind =
  | 'forbidden'
  | 'invalid'
  | 'conflict'
  | 'unavailable'
  | 'network'
  | 'unknown'

export type CommandOutcome<T> =
  | { status: 'acknowledged'; value: T }
  | { status: 'rejected'; kind: CommandFailureKind; message: string; retryable: boolean }

export class CommandRejectedError extends Error {
  readonly kind: CommandFailureKind
  readonly retryable: boolean

  constructor(rejection: Extract<CommandOutcome<never>, { status: 'rejected' }>) {
    super(rejection.message)
    this.name = 'CommandRejectedError'
    this.kind = rejection.kind
    this.retryable = rejection.retryable
  }
}

const text = (error: unknown) => error instanceof Error ? error.message : String(error ?? '')

/** Keeps transport/protocol vocabulary out of React presentation code. */
export function projectCommandFailure(error: unknown): Extract<CommandOutcome<never>, { status: 'rejected' }> {
  const message = text(error)
  const normalized = message.toLowerCase()
  if (normalized.includes('forbidden') || normalized.includes('unauthorized')) {
    return { status: 'rejected', kind: 'forbidden', message: '当前身份没有执行此操作的权限。', retryable: false }
  }
  if (normalized.includes('conflict') || normalized.includes('revision')) {
    return { status: 'rejected', kind: 'conflict', message: '权威状态已更新，请同步后重试。', retryable: true }
  }
  if (normalized.includes('invalid') || normalized.includes('schema')) {
    return { status: 'rejected', kind: 'invalid', message: '操作数据未通过权威校验。', retryable: false }
  }
  if (normalized.includes('timeout') || normalized.includes('unavailable') || normalized.includes('503')) {
    return { status: 'rejected', kind: 'unavailable', message: '房间权威服务暂时不可用，请稍后重试。', retryable: true }
  }
  if (normalized.includes('fetch') || normalized.includes('network') || normalized.includes('offline')) {
    return { status: 'rejected', kind: 'network', message: '网络连接中断，操作未确认。', retryable: true }
  }
  return { status: 'rejected', kind: 'unknown', message: message || '操作未完成。', retryable: true }
}

export async function executeCommandWithOutcome<T>(operation: () => Promise<T>): Promise<CommandOutcome<T>> {
  try {
    return { status: 'acknowledged', value: await operation() }
  } catch (error) {
    return projectCommandFailure(error)
  }
}

export async function requireCommandAcknowledgement<T>(operation: () => Promise<T>): Promise<T> {
  const outcome = await executeCommandWithOutcome(operation)
  if (outcome.status === 'rejected') throw new CommandRejectedError(outcome)
  return outcome.value
}
