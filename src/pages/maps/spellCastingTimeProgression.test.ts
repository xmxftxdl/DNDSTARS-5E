import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('spell casting campaign-time progression', () => {
  it('atomically advances audited plugin long casts and preserves effects that begin at completion', () => {
    expect(workspaceSource).toContain('advanceCampaignTimeSnapshot')
    expect(workspaceSource).toContain('advanceId: `campaign-time:${action.id}`')
    expect(workspaceSource).toContain('compensateDnd5eCompletedLongCastApplication')
    expect(workspaceSource).toContain('dnd5ePluginSpellElapsedCastingMinutes')
    expect(workspaceSource).toContain('campaignTime: completionCampaignTime')
    expect(workspaceSource).toContain(
      'const settlementWorldMinute = completionCampaignTime?.worldMinute ?? campaignTimeBeforeCast.worldMinute',
    )
  })
})
