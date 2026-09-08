import { describe, expect, it } from 'vitest'
import {
  sharedAuthenticatedSystemRoute,
  sharedPublicSystemRoute,
} from '../../scripts/shared-server-system-routes.mjs'
import { desktopReleaseManifestFromEnvironment } from '../../scripts/desktop-release-manifest.mjs'

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

  it('publishes an optional signed desktop client release without requiring room authentication', () => {
    const desktopRelease = desktopReleaseManifestFromEnvironment({
      STARS_DESKTOP_CHANNEL: 'beta',
      STARS_DESKTOP_CLIENT_VERSION: '0.1.0-beta.2',
      STARS_DESKTOP_MINIMUM_SHELL_VERSION: '0.1.0-beta.1',
      STARS_DESKTOP_CLIENT_URL: 'https://downloads.example/AstralTrace-client-win32-x64.zip',
      STARS_DESKTOP_CLIENT_SHA256: 'a'.repeat(64),
      STARS_DESKTOP_CLIENT_SIGNATURE: 'signed-package',
    }, 5)
    expect(sharedPublicSystemRoute({
      ...publicInput,
      pathname: '/api/desktop/releases/latest',
      desktopRelease,
    })).toEqual({
      status: 200,
      body: expect.objectContaining({
        available: true,
        service: 'astraltrace-desktop-client',
        version: '0.1.0-beta.2',
        protocolVersion: 5,
        package: expect.objectContaining({ sha256: 'a'.repeat(64) }),
      }),
    })
  })

  it('keeps the desktop release endpoint available but disables downloads when not configured', () => {
    expect(desktopReleaseManifestFromEnvironment({}, 5)).toMatchObject({
      available: false,
      platform: 'win32',
      arch: 'x64',
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
