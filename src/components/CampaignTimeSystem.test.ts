import { describe, expect, it } from 'vitest'
import type { CampaignTimeAdvance } from '../lib/campaignTime'
import {
  campaignRestAdvanceForViewer,
  campaignRestReceiptBaselineIds,
  latestCampaignRestAdvanceForViewer,
} from './campaignRestNotificationModel'

function restAdvance(
  id: string,
  createdAt: number,
  reports: Array<{ characterId: string; characterName: string }>,
): CampaignTimeAdvance {
  return {
    id,
    kind: 'long-rest',
    fromWorldMinute: 480,
    toWorldMinute: 960,
    minutes: 480,
    reason: 'DM 安排队伍长休',
    dawnsCrossed: 0,
    expiredTimerIds: [],
    createdAt,
    restRecoveryReports: reports.map((report) => ({ ...report, entries: [{
      category: 'feature-resource',
      label: '法术位',
      outcome: 'restored',
      before: 0,
      after: 1,
      maximum: 1,
    }] })),
  }
}

describe('CampaignTimeSystem rest notification projection', () => {
  const ownId = 'player-wizard'
  const otherId = 'other-wizard'

  it('does not replay rest settlements created before this room session mounted', () => {
    const history = [restAdvance('historical-rest', 900, [{ characterId: ownId, characterName: '本角色' }])]
    const candidate = latestCampaignRestAdvanceForViewer(history, {
      isDm: false,
      playerOwnedCharacterIds: new Set([ownId]),
      seenIds: new Set(campaignRestReceiptBaselineIds(history)),
    })

    expect(candidate).toBeNull()
  })

  it('shows a player only reports for characters owned by that room member', () => {
    const projected = campaignRestAdvanceForViewer(
      restAdvance('current-rest', 1_100, [
        { characterId: ownId, characterName: '本角色' },
        { characterId: otherId, characterName: '另一名法师' },
      ]),
      { isDm: false, playerOwnedCharacterIds: new Set([ownId]) },
    )

    expect(projected?.restRecoveryReports?.map((report) => report.characterId)).toEqual([ownId])
  })

  it('keeps the full party report for the DM and selects only the latest new settlement', () => {
    const older = restAdvance('older-new-rest', 1_100, [{ characterId: ownId, characterName: '本角色' }])
    const latest = restAdvance('latest-new-rest', 1_200, [
      { characterId: ownId, characterName: '本角色' },
      { characterId: otherId, characterName: '另一名法师' },
    ])
    const candidate = latestCampaignRestAdvanceForViewer([older, latest], {
      isDm: true,
      playerOwnedCharacterIds: new Set(),
      seenIds: new Set(),
    })

    expect(candidate?.id).toBe(latest.id)
    expect(candidate?.restRecoveryReports).toHaveLength(2)
  })
})
