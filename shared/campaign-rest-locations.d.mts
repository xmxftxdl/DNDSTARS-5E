export interface CampaignRestLocation {
  characterId: string
  plane: string
  mapId: string
  x: number
  y: number
  elevationFeet: number
  completedAtWorldMinute: number
}
export function validCampaignRestLocations(value: unknown, worldMinute: number): value is CampaignRestLocation[] | undefined
export function recordCampaignLongRestLocations(previous: CampaignRestLocation[] | undefined, maps: readonly unknown[] | undefined, participants: readonly string[] | undefined, completedAtWorldMinute: number): CampaignRestLocation[]
