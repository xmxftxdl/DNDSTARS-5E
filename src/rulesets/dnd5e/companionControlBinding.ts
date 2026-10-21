import type { BattleMap, Token } from '../../store/maps'

/** Command authority without giving animated objects a summoned creature's deletion lifecycle. */
export function dnd5eCompanionControlBinding(map: BattleMap, token: Token | undefined, allowPlayerHint = false):
  Pick<NonNullable<Token['dnd5eSummon']>, 'pluginId' | 'sourceTokenId' | 'sourceCharacterId' | 'featureId' | 'commandPolicy' | 'controlEnded'> | undefined {
  if (token?.dnd5eSummon) return token.dnd5eSummon
  const grove = token?.dnd5eGroveGuardian ?? (allowPlayerHint ? token?.dnd5eGroveControl : undefined)
  const boundary = grove && map.dnd5ePluginAreas?.find(area => area.id === grove.boundaryAreaId &&
    area.sourceTokenId === grove.sourceTokenId && area.effectGroup?.castId === grove.castId &&
    area.effectGroup.effectId === 'guardians')
  return grove && boundary ? { sourceTokenId: grove.sourceTokenId, featureId: boundary.featureId,
    sourceCharacterId: boundary.sourceCharacterId, pluginId: boundary.pluginId,
    commandPolicy: 'persistent-order' } : undefined
}
