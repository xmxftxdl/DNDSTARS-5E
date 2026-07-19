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
      'resolvePlayerMoveAuthorityPreview',
      'resolveEnemyMoveAuthority',
      'resolveOpportunityAttackAuthority',
    ]) {
      expect(mapsPageSource, `MapsPage must not contain ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('routes requests and lifecycle through D&D 5e Headless resolvers', () => {
    for (const required of [
      'planPlayerActionAuthorityExecution',
      'prepareDnd5ePlayerMove',
      'resolvePreparedDnd5ePlayerMove',
      'prepareDnd5eEquipmentAttack',
      'resolvePreparedDnd5eEquipmentAttack',
      'prepareDnd5eClassFeature',
      'resolvePreparedDnd5eClassFeature',
      'prepareDnd5eSpellCast',
      'resolvePreparedDnd5eSpellCast',
      'resolveDnd5eMonsterMapMove',
      'resolveDnd5eHeadlessAction',
    ]) {
      expect(mapsPageSource, `MapsPage must route through ${required}`).toContain(required)
    }
  })

  it('keeps the dedicated 5e map runtime from branching on legacy ruleset markers', () => {
    for (const forbidden of [
      'turnCharacter.rulesetId',
      'activeChar.rulesetId',
      'attacker.rulesetId',
    ]) {
      expect(mapsPageSource, `MapsPage must not use ${forbidden} to reach an AP fallback`).not.toContain(forbidden)
    }
    expect(mapsPageSource).toContain('currentDnd5eTurnEconomy(currentInitiativeToken.id).movement.current')
    expect(mapsPageSource).toContain('currentDnd5eTurnEconomy(currentInitiativeToken.id).action.current')
  })
})
