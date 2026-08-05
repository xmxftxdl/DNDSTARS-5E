import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { createSharedServerContext } from '../../scripts/shared-server-context.mjs'

describe('shared server composition root', () => {
  it('creates isolated transport adapters while sharing one explicit storage root', () => {
    const context = createSharedServerContext({
      sharedRoot: path.join('tmp', 'astraltrace'),
      legacyRoot: path.join('tmp', 'legacy'),
      serverInstanceId: 'server-test',
      serverStartedAt: 100,
      serverBuildId: 'build-test',
    })
    expect(context).toMatchObject({
      serverInstanceId: 'server-test',
      serverStartedAt: 100,
      serverBuildId: 'build-test',
    })
    expect(context.stateRoot).toBe(path.resolve('tmp', 'astraltrace', 'state'))
    expect(context.legacyStateRoot).toBe(path.resolve('tmp', 'legacy', 'state'))
    expect(context.eventClients).toBeInstanceOf(Map)
  })
})
