export interface CampaignEnvironmentalExposure {
  id: string
  subjectId: string
  hazard: 'extreme-heat' | 'extreme-cold'
  fromWorldMinute: number
  toWorldMinute: number
  dc: number
  outcome: 'protected' | 'success' | 'failure'
}
export function validCampaignEnvironmentalExposures(value: unknown, worldMinute: number): value is CampaignEnvironmentalExposure[] | undefined
export function appendCampaignEnvironmentalExposure(rows: readonly CampaignEnvironmentalExposure[] | undefined, receipt: CampaignEnvironmentalExposure, worldMinute: number):
  { ok: true; receipts: CampaignEnvironmentalExposure[] } | { ok: false; reason: string }
