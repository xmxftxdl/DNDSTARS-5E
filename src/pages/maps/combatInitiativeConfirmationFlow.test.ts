import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(new URL('../MapsWorkspacePage.tsx', import.meta.url), 'utf8')
const dialogSource = readFileSync(
  new URL('../../components/map/CombatInitiativeConfirmationDialog.tsx', import.meta.url),
  'utf8',
)
const dmRosterSource = readFileSync(
  new URL('../../components/character/DMRoster.tsx', import.meta.url),
  'utf8',
)

describe('DM initiative confirmation flow', () => {
  it('stages rolled initiative before the authoritative combat start', () => {
    expect(workspaceSource).toContain('const requestCombatStartConfirmation = async (')
    expect(workspaceSource).toContain('setInitiativeConfirmationDraft({')
    expect(workspaceSource).toContain('const startCombat = async (draft: CombatInitiativeConfirmationDraft) =>')
    expect(workspaceSource).toContain('const order = [...draft.order]')
    expect(workspaceSource).toContain('onConfirm={() => { void startCombat(initiativeConfirmationDraft) }}')
  })

  it('routes both ordinary and surprise starts through DM confirmation', () => {
    expect(workspaceSource).toContain('onStartCombat={() => requestCombatStartConfirmation([], { clearStatuses: false })}')
    expect(workspaceSource).toContain('requestCombatStartConfirmation([...surpriseSelection])')
    expect(dialogSource).toContain('确认前不会发布战斗状态')
  })

  it('prunes a deleted combat token and its turn economy in the same map-combat transaction', () => {
    expect(workspaceSource).toContain('const shouldPruneInitiative = combatActiveRef.current')
    expect(workspaceSource).toContain('pruneInitiativeForToken(previousOrder, previousIndex, tokenId)')
    expect(workspaceSource).toContain("}, '删除战斗单位')")
    expect(workspaceSource).toContain("Object.entries(previousTurnEconomy).filter(([candidateTokenId]) => candidateTokenId !== tokenId)")
  })

  it('reconciles character-roster deletion with the authoritative combat roster', () => {
    expect(dmRosterSource).toContain("loadSharedResource<SharedCombatState>('combat')")
    expect(dmRosterSource).toContain('pruneInitiativeForValidTokens(')
    expect(dmRosterSource).toContain("name: 'maps'")
    expect(dmRosterSource).toContain("name: 'combat'")
    expect(dmRosterSource).toContain("undoLabel: '删除房间角色并清理先攻'")
    expect(workspaceSource).toContain('combat-roster-prune:')
    expect(workspaceSource).toContain('reconcileMissingInitiativeEntries(activeMap.id)')
    expect(workspaceSource).toContain('Reconciliation already selects the next surviving slot.')
  })

  it('stages newly placed enemies for DM confirmation before publishing live initiative', () => {
    expect(workspaceSource).toContain('combat-roster-stage-enemy:')
    expect(workspaceSource).toContain('setLiveInitiativeConfirmationDraftLocked({')
    expect(workspaceSource).toContain('const confirmLiveInitiativeAdditions = async (')
    expect(workspaceSource).toContain('confirmLabel="确认并加入当前战斗"')
    expect(workspaceSource).toContain('dismissible={false}')
  })
})
