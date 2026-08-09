import type { CampaignTimeAdvance } from '../lib/campaignTime'

export function campaignRestReceiptBaselineIds(
  advances: readonly CampaignTimeAdvance[],
): string[] {
  return advances
    .filter((advance) => advance.kind === 'short-rest' || advance.kind === 'long-rest')
    .map((advance) => advance.id)
}

export function campaignRestAdvanceForViewer(
  advance: CampaignTimeAdvance,
  options: {
    isDm: boolean
    playerOwnedCharacterIds: ReadonlySet<string>
  },
): CampaignTimeAdvance | null {
  if (advance.kind !== 'short-rest' && advance.kind !== 'long-rest') return null
  const reports = advance.restRecoveryReports ?? []
  const visibleReports = options.isDm
    ? reports
    : reports.filter((report) => options.playerOwnedCharacterIds.has(report.characterId))
  return visibleReports.length > 0
    ? { ...advance, restRecoveryReports: visibleReports }
    : null
}

export function latestCampaignRestAdvanceForViewer(
  advances: readonly CampaignTimeAdvance[],
  options: {
    isDm: boolean
    playerOwnedCharacterIds: ReadonlySet<string>
    seenIds: ReadonlySet<string>
  },
): CampaignTimeAdvance | null {
  for (let index = advances.length - 1; index >= 0; index -= 1) {
    const advance = advances[index]
    if (options.seenIds.has(advance.id)) continue
    const visible = campaignRestAdvanceForViewer(advance, options)
    if (visible) return visible
  }
  return null
}
