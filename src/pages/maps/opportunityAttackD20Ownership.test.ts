import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('opportunity attack d20 ownership wiring', () => {
  it('attributes the d20 to the attacking token instead of the active-turn target', () => {
    const start = workspaceSource.indexOf('const collectDnd5ePreparedOpportunityRolls')
    const end = workspaceSource.indexOf('const resolveDnd5eOpportunityAttackForMove', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const opportunityAttackFlow = workspaceSource.slice(start, end)
    expect(opportunityAttackFlow).toContain('rollerTokenId: attackerToken.id')
    expect(opportunityAttackFlow).toContain('rollerCharacterId: attackerCharacter?.id')
    expect(opportunityAttackFlow).toContain('effectiveAttackMode = dnd5eOpportunityAttackModeResolution(attack).mode')
    expect(opportunityAttackFlow).toContain('existingRollMode: effectiveAttackMode')
    expect(opportunityAttackFlow).toContain('attack.targetName, effectiveAttackMode, attackRollContext')
    const callerEnd = workspaceSource.indexOf('const resolveDnd5eOpportunityAttacksForMove', end)
    expect(workspaceSource.slice(end, callerEnd)).toMatch(/await collectDnd5ePreparedOpportunityRolls\(attack,\s*`opportunity:\$\{crypto.randomUUID\(\)\}`\)/)
  })
})
