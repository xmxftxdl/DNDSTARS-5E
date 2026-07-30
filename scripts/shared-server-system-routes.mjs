const SHARED_SERVICE_NAME = 'dndstars-5e-shared'

function normalizedNow(now) {
  return Number.isFinite(now) ? now : Date.now()
}

export function sharedPublicSystemRoute(input) {
  if (input.method !== 'GET') return undefined
  if (input.pathname === '/api/meta') {
    return {
      status: 200,
      body: {
        service: SHARED_SERVICE_NAME,
        rulesetId: input.rulesetId,
        protocolVersion: input.protocolVersion,
        minimumClientProtocol: input.minimumClientProtocol,
        buildId: input.buildId,
        startedAt: input.startedAt,
      },
    }
  }
  if (input.pathname === '/api/healthz') {
    return {
      status: 200,
      body: {
        status: 'ok',
        service: SHARED_SERVICE_NAME,
        protocolVersion: input.protocolVersion,
        buildId: input.buildId,
        uptimeMs: Math.max(0, normalizedNow(input.now) - input.startedAt),
      },
    }
  }
  return undefined
}

export function sharedAuthenticatedSystemRoute(input) {
  if (input.method !== 'GET' || input.pathname !== '/api/time') return undefined
  return {
    status: 200,
    body: { serverNow: normalizedNow(input.now) },
  }
}
