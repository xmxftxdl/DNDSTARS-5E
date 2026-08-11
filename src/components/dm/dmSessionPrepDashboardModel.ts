import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'

export function calculateDmPrepReadiness(analysis: PdfCampaignAnalysisV2 | null): number {
  if (!analysis) return 10
  const checks = [
    analysis.overview.trim().length > 0,
    analysis.people.length > 0,
    analysis.scenes.length > 0,
    analysis.clues.length > 0,
    analysis.encounters.length > 0 || analysis.importCandidates.some((entry) => entry.kind === 'monster'),
    analysis.timelineEvents?.some((entry) => entry.gameTimeWorldMinute != null) ?? false,
    analysis.warnings.length === 0,
    analysis.importCandidates.some((entry) => entry.automation !== 'manual'),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
