import { describe, expect, it } from 'vitest'
import {
  sharedAuthenticatedSystemRoute,
  sharedPublicSystemRoute,
} from '../../scripts/shared-server-system-routes.mjs'

const publicInput = {
  method: 'GET',
  rulesetId: 'dnd5e-2014-srd-5.1',
  protocolVersion: 5,
  minimumClientProtocol: 5,
  buildId: 'test-build',
  startedAt: 1_000,
  now: 1_250,
}

describe('shared server system routes', () => {
  it('builds public metadata and health responses', () => {
    expect(sharedPublicSystemRoute({
      ...publicInput,
      pathname: '/api/meta',
    })).toEqual({
      status: 200,
      body: {
        service: 'dndstars-5e-shared',
        rulesetId: 'dnd5e-2014-srd-5.1',
        protocolVersion: 5,
        minimumClientProtocol: 5,
        buildId: 'test-build',
        startedAt: 1_000,
      },
    })
    expect(sharedPublicSystemRoute({
      ...publicInput,
      pathname: '/api/healthz',
    })?.body.uptimeMs).toBe(250)
  })

  it('keeps server time behind the authenticated route phase', () => {
    expect(sharedPublicSystemRoute({
      ...publicInput,
      pathname: '/api/time',
    })).toBeUndefined()
    expect(sharedAuthenticatedSystemRoute({
      method: 'GET',
      pathname: '/api/time',
      now: 9_876,
    })).toEqual({
      status: 200,
      body: { serverNow: 9_876 },
    })
  })

  it('does not claim unsupported methods or paths', () => {
    expect(sharedPublicSystemRoute({
      ...publicInput,
      method: 'POST',
      pathname: '/api/healthz',
    })).toBeUndefined()
    expect(sharedAuthenticatedSystemRoute({
      method: 'GET',
      pathname: '/api/rooms',
      now: 1,
    })).toBeUndefined()
  })
})
