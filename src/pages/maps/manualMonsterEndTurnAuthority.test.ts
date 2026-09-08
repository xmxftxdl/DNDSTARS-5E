import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('manual monster end-turn authority boundary', () => {
  it('preflights Headless restrictions before rolling boundary dice', () => {
    const settlementStart = workspaceSource.indexOf(
      'const settleDnd5eMonsterEndTurn = async',
    )
    const settlementEnd = workspaceSource.indexOf(
      'const advanceInitiativeCore =',
      settlementStart,
    )
    const settlement = workspaceSource.slice(settlementStart, settlementEnd)

    expect(settlementStart).toBeGreaterThan(-1)
    expect(settlementEnd).toBeGreaterThan(settlementStart)
    expect(settlement).toContain(
      'const turnEconomy = currentDnd5eTurnEconomy(latestEnemy.id, previousRound)',
    )
    expect(settlement).toContain('initiativeOrder: initiativeOrderRef.current,\n        turnEconomy,')
    expect(settlement).toContain('dnd5eHeadlessEndTurnRestrictionFailure(')
    expect(settlement.indexOf('dnd5eHeadlessEndTurnRestrictionFailure('))
      .toBeLessThan(settlement.indexOf('for (const requirement of prepared.prepared.activeEffectSavingThrows)'))
  })

  it('never bypasses a rejected Headless end turn with a raw initiative advance', () => {
    const manualStart = workspaceSource.indexOf(
      'const settleManualHeadlessTurn =',
    )
    const manualEnd = workspaceSource.indexOf(
      'const advanceInitiative =',
      manualStart,
    )
    const manualSettlement = workspaceSource.slice(manualStart, manualEnd)

    expect(manualStart).toBeGreaterThan(-1)
    expect(manualEnd).toBeGreaterThan(manualStart)
    expect(manualSettlement).toContain('await settleDnd5eMonsterEndTurn(token)')
    expect(manualSettlement).not.toContain('requestAdvance()')
  })

  it('holds a synchronous UI lock across the complete manual advance transaction', () => {
    const advanceStart = workspaceSource.indexOf(
      'const advanceInitiative = async',
    )
    const advanceEnd = workspaceSource.indexOf(
      'const acknowledgePlayerAction =',
      advanceStart,
    )
    const advance = workspaceSource.slice(advanceStart, advanceEnd)

    expect(advanceStart).toBeGreaterThan(-1)
    expect(advanceEnd).toBeGreaterThan(advanceStart)
    expect(advance).toContain('if (\n      manualInitiativeAdvancePendingRef.current ||')
    expect(advance).toContain('setManualInitiativeAdvancePendingLocked(true)')
    expect(advance).toContain('await settleManualHeadlessTurn(currentInitiativeToken)')
    expect(advance).toContain('await appRoomAuthorityScheduler.run(')
    expect(advance).toContain('setManualInitiativeAdvancePendingLocked(false)')
    expect(workspaceSource).toContain("manualInitiativeAdvancePending || dnd5eTurnStartSettlementPending ? '推进中…' : '下一位'")
  })
})
