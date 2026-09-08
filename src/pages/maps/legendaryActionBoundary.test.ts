import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('legendary action end-turn authority boundary', () => {
  it('keeps every DM-adjudicated transaction behind the explicit combat resume gate', () => {
    const helperStart = workspaceSource.indexOf(
      'const holdDmAdjudicationUntilCombatResumes = async',
    )
    const helperEnd = workspaceSource.indexOf(
      'const pauseCombatFlowManually = async',
      helperStart,
    )
    const helper = workspaceSource.slice(helperStart, helperEnd)

    expect(helperStart).toBeGreaterThan(-1)
    expect(helperEnd).toBeGreaterThan(helperStart)
    expect(helper).toContain('const result = await adjudication')
    expect(helper).toContain('await waitForDmAdjudicationResume({ id: interruptId })')

    const adjudicationRequests = [
      'const requestSharedDmAdjudication = async',
      'const requestSharedPostSpellRandomTableAdjudication = async',
      'const requestSharedMapInteractionAdjudication = async',
      'const requestSharedBasicActionAdjudication = async',
      'async function requestSharedPersistentAreaAdjudication',
      'const requestSharedMonsterLegendaryActionAdjudication = async',
      'const requestSharedActivityBoundaryAdjudication = async',
    ]
    for (const [index, requestName] of adjudicationRequests.entries()) {
      const start = workspaceSource.indexOf(requestName)
      const nextName = adjudicationRequests[index + 1]
      const end = nextName
        ? workspaceSource.indexOf(nextName, start + requestName.length)
        : workspaceSource.indexOf(
            'const requestRegisteredDnd5eActivityTriggerChoice',
            start,
          )
      const requestSource = workspaceSource.slice(start, end)
      expect(start, requestName).toBeGreaterThan(-1)
      expect(end, requestName).toBeGreaterThan(start)
      expect(requestSource, requestName).toContain(
        'holdDmAdjudicationUntilCombatResumes(id, requestAndWaitForCombatInterrupt({',
      )
    }
  })

  it('settles the chosen action inside the authority lane that owns the boundary', () => {
    const start = workspaceSource.indexOf(
      'const settleLegendaryActionWindowSelection = async',
    )
    const end = workspaceSource.indexOf(
      '/**\n   * End-turn advances',
      start,
    )
    const selectionHandler = workspaceSource.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(selectionHandler).toContain(
      'await finishEnemyAreaActionUnsafe(plan)',
    )
    expect(selectionHandler).toContain(
      'await finishEnemyAttackUnsafe(result)',
    )
    expect(selectionHandler).not.toContain(
      'await finishEnemyAreaAction(plan)',
    )
    expect(selectionHandler).not.toContain(
      'await finishEnemyAttack(result, targetCharacter)',
    )
  })

  it("marks a legendary monster's claw d20 as the monster's own roll", () => {
    const attackStart = workspaceSource.indexOf(
      'async function finishEnemyAttackUnsafe',
    )
    const attackEnd = workspaceSource.indexOf(
      'async function finishEnemyTargetedConditionActionUnsafe',
      attackStart,
    )
    const attackSettlement = workspaceSource.slice(attackStart, attackEnd)

    expect(attackStart).toBeGreaterThan(-1)
    expect(attackEnd).toBeGreaterThan(attackStart)
    expect(attackSettlement).toContain(
      'rollerTokenId: monsterAttack.actorToken.id',
    )
    expect(attackSettlement).toContain(
      'rollerCharacterId: actorCharacter?.id',
    )
    expect(attackSettlement).toContain(
      'monsterAttackRollContext',
    )
  })
})
