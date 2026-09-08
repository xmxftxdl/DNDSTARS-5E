export type MapTokenStatusInstanceKind =
  | 'active-effect'
  | 'spell-effect'
  | 'concentration'
  | 'flight'
  | 'shillelagh'
  | 'token-marker'
  | 'monster-trait'
  | 'monster-state'

/**
 * One clickable badge instance on the map. The id identifies the concrete
 * source instance rather than the visual status type, so two casters can
 * independently apply the same condition without being collapsed together.
 */
export interface MapTokenStatusInstance {
  id: string
  tokenId: string
  kind: MapTokenStatusInstanceKind
  title: string
  description: string
  statusId?: string
  activeEffectId?: string
  sourceActorId?: string
  sourceLabel?: string
  authority: 'headless' | 'geometry' | 'dm-annotation'
}
