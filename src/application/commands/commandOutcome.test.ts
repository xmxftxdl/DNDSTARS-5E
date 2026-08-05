import { describe, expect, it } from 'vitest'
import { executeCommandWithOutcome, projectCommandFailure } from './commandOutcome'

describe('command ACK and failure projection', () => {
  it('projects protocol conflicts without exposing transport internals', () => {
    expect(projectCommandFailure(new Error('shared-state-revision-conflict'))).toEqual({
      status: 'rejected', kind: 'conflict', message: '权威状态已更新，请同步后重试。', retryable: true,
    })
  })

  it('wraps an acknowledged command', async () => {
    await expect(executeCommandWithOutcome(async () => ({ revision: 3 }))).resolves.toEqual({
      status: 'acknowledged', value: { revision: 3 },
    })
  })
})
