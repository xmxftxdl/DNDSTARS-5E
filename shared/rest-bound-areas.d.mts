import type { BattleMap } from '../src/store/maps'
import type { SharedCampaignTimeState } from '../src/lib/campaignTime'
import type { CampaignRestSession } from './campaign-rest-sessions.mjs'
export function validRestAreaSessionId(value: unknown): value is string
export function activeRestAreaSession(clock: SharedCampaignTimeState | undefined, characterId: string, eventId: string | undefined): CampaignRestSession | undefined
export function expireRestBoundAreas(map: BattleMap, clock: SharedCampaignTimeState): BattleMap
