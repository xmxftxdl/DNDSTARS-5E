import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mapsPageSource = readFileSync(new URL('../pages/MapsPage.tsx', import.meta.url), 'utf8')

describe('headless migration boundary', () => {
  it('keeps engine resolvers and the removed mutation pipeline out of MapsPage', () => {
    for (const forbidden of [
      'resolveHeadlessDmAction',
      'resolveHeadlessDmAuthorityAction',
      'startHeadlessCombat(',
      'CombatResolutionRunner',
      'executeCombatMutationsAuthority',
    ]) {
      expect(mapsPageSource, `MapsPage must not contain ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('routes requests and lifecycle through domain authority helpers', () => {
    for (const required of [
      'planPlayerActionAuthorityExecution',
      'resolvePlayerFeatureActivationAuthority',
      'resolveSimpleHeadlessPlayerAuthority',
      'resolvePreparedAttackAuthority',
      'resolvePreparedAoeAttackAuthority',
      'resolvePlayerMoveAuthorityPreview',
      'resolveEnemyAttackAuthority',
      'resolveEnemyMoveAuthority',
      'startHeadlessDmCombatAuthority',
      'endHeadlessDmCombatAuthority',
    ]) {
      expect(mapsPageSource, `MapsPage must route through ${required}`).toContain(required)
    }
  })
})
