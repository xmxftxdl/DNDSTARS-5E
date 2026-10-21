import type { BattleMap, Token } from '../../store/maps'
import { droppedDnd5eCompanionObjects } from './companionCarriedObjects'

/** Ending animation never waits for a terrain/rooting adjudication. */
export function reconcileDnd5eGroveGuardians(map: BattleMap): BattleMap {
  let changed = false
  const tokens = map.tokens.flatMap((token): Token[] => {
    const record = token.dnd5eGroveGuardian
    if (!record || map.dnd5ePluginAreas?.some(area => area.id === record.boundaryAreaId &&
      area.sourceTokenId === record.sourceTokenId && area.effectGroup?.castId === record.castId &&
      area.effectGroup.effectId === 'guardians')) return [token]
    changed = true
    const dead = token.hp != null && token.hp <= 0
    return [{ ...structuredClone(record.originalTree), id: token.id, type: 'obstacle',
      x: token.x, y: token.y, elevationFeet: token.elevationFeet,
      // The spell does not restore lost HP or revive a slain tree.
      hp: dead ? 0 : token.hp, maxHp: token.maxHp,
      poolId: undefined, dnd5eSummon: undefined, dnd5eCombatState: undefined, dnd5eGroveGuardian: undefined,
      dnd5eCarriedObjects: undefined,
      dnd5eGroveRooting: dead ? undefined : 'pending',
      dnd5eObjectState: { ...record.originalTree.dnd5eObjectState, schemaVersion: 1, vegetation: dead ? 'dead' : 'living' },
    }, ...droppedDnd5eCompanionObjects(token)]
  })
  return changed ? { ...map, tokens } : map
}

/** Host supplies the terrain fact. The object is already inanimate in either outcome. */
export function settleDnd5eGroveRooting(map: BattleMap, tokenId: string, canRoot: boolean): BattleMap | undefined {
  if (typeof canRoot !== 'boolean') return undefined
  const tree = map.tokens.find(token => token.id === tokenId)
  if (tree?.type !== 'obstacle' || tree.dnd5eGroveRooting !== 'pending' || tree.dnd5eGroveGuardian ||
    tree.dnd5eObjectState?.vegetation !== 'living' || (tree.hp != null && tree.hp <= 0)) return undefined
  return { ...map, tokens: map.tokens.map(token => token.id === tokenId
    ? { ...token, dnd5eGroveRooting: canRoot ? 'rooted' : 'unrooted' } : token) }
}
