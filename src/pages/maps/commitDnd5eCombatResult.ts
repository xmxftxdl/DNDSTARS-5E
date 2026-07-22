import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import type { Token } from '../../store/maps'

export interface Dnd5eCombatResultCommitReceipt {
  mapId: string
  characterIds: readonly string[]
  tokenIds: readonly string[]
}

interface Dnd5eCombatResultApplicationPort {
  application: Dnd5eMapResultPlan
  mapId: string
  applyCharacter: (characterId: string, character: Character) => void
  applyToken: (mapId: string, tokenId: string, token: Token) => void
}

interface Dnd5eCombatResultCommitInput extends Dnd5eCombatResultApplicationPort {
  saveCharacters?: () => Promise<unknown>
  saveMap?: () => Promise<unknown>
  /** 区域、召唤等地图级字段变化不一定包含 changedTokenIds。 */
  forceSaveCharacters?: boolean
  forceSaveMap?: boolean
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function prepareCommit(input: Pick<Dnd5eCombatResultApplicationPort, 'application' | 'mapId'>) {
  if (input.application.map.id !== input.mapId) {
    throw new Error(`combat-result-map-mismatch:${input.application.map.id}:${input.mapId}`)
  }
  const characterIds = unique(input.application.changedCharacterIds)
  const tokenIds = unique(input.application.changedTokenIds)
  const characterById = new Map(input.application.characters.map((character) => [character.id, character]))
  const tokenById = new Map(input.application.map.tokens.map((token) => [token.id, token]))
  const missingCharacterId = characterIds.find((id) => !characterById.has(id))
  if (missingCharacterId) throw new Error(`combat-result-character-missing:${missingCharacterId}`)
  const missingTokenId = tokenIds.find((id) => !tokenById.has(id))
  if (missingTokenId) throw new Error(`combat-result-token-missing:${missingTokenId}`)
  return { characterIds, tokenIds, characterById, tokenById }
}

/** 同步应用权威结果；预检完成前不会写入任何 Store。 */
export function applyDnd5eCombatResultApplication(
  input: Dnd5eCombatResultApplicationPort,
): Dnd5eCombatResultCommitReceipt {
  const prepared = prepareCommit(input)
  for (const characterId of prepared.characterIds) {
    input.applyCharacter(characterId, prepared.characterById.get(characterId)!)
  }
  for (const tokenId of prepared.tokenIds) {
    input.applyToken(input.mapId, tokenId, prepared.tokenById.get(tokenId)!)
  }
  return { mapId: input.mapId, characterIds: prepared.characterIds, tokenIds: prepared.tokenIds }
}

/** 应用后等待地图/角色共享快照落盘，调用方再发送动作 ACK 或关闭 Interrupt。 */
export async function commitDnd5eCombatResult(
  input: Dnd5eCombatResultCommitInput,
): Promise<Dnd5eCombatResultCommitReceipt> {
  const receipt = applyDnd5eCombatResultApplication(input)
  const writes: Promise<unknown>[] = []
  if (input.saveCharacters && (input.forceSaveCharacters || receipt.characterIds.length > 0)) {
    writes.push(input.saveCharacters())
  }
  if (input.saveMap && (input.forceSaveMap || receipt.tokenIds.length > 0)) {
    writes.push(input.saveMap())
  }
  await Promise.all(writes)
  return receipt
}
