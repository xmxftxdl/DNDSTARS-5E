import type { Token } from '../../store/maps'

/** 选中状态只随 Token 真正移除而清空；0 HP／阵亡仍然是可查看的地图实体。 */
export function shouldClearSelectedMapToken(
  selectedTokenId: string | null,
  tokens: readonly Pick<Token, 'id'>[],
): boolean {
  return !!selectedTokenId && !tokens.some((token) => token.id === selectedTokenId)
}
