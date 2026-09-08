import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('opportunity attack d20 ownership wiring', () => {
  it('attributes the d20 to the attacking token instead of the active-turn target', () => {
    const start = workspaceSource.indexOf('const resolveDnd5eOpportunityAttackForMove')
    const end = workspaceSource.indexOf('const resolveDnd5eOpportunityAttacksForMove', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const opportunityAttackFlow = workspaceSource.slice(start, end)
    expect(opportunityAttackFlow).toContain('rollerTokenId: attackerToken.id')
    expect(opportunityAttackFlow).toContain('rollerCharacterId: attackerCharacter?.id')
    expect(opportunityAttackFlow).toContain('existingRollMode: attack.attackMode')
  })
})
