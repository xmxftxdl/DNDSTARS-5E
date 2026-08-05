import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'

export interface Dnd5eCombatResultCommitReceipt {
  mapId: string
  characterIds: readonly string[]
  tokenIds: readonly string[]
}

interface Dnd5eCombatResultApplicationPort {
  application: Dnd5eMapResultPlan
  mapId: string
  applyCharacter: (characterId: string, character: Character, patch?: Partial<Character>) => void
  applyToken: (mapId: string, tokenId: string, token: Token, patch?: Partial<Token>) => void
  /**
   * 地图级事务（召唤、持续区域）使用单次完整地图提交，避免先写 Token、
   * 再写区域时被同步读取到半完成状态。调用方必须先把结果重基线到最新地图。
   */
  applyMap?: (mapId: string, map: BattleMap) => void
  applicationMode?: 'entities' | 'map'
}

interface Dnd5eCombatResultCommitInput extends Dnd5eCombatResultApplicationPort {
  saveCharacters?: () => Promise<unknown>
  saveMap?: () => Promise<unknown>
  saveAll?: (receipt: Dnd5eCombatResultCommitReceipt) => Promise<unknown>
  /** 区域、召唤等地图级字段变化不一定包含 changedTokenIds。 */
  forceSaveCharacters?: boolean
  forceSaveMap?: boolean
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/**
 * Adds a non-Headless authoritative field (for example an inventory reward) to
 * an existing Headless application. Merely replacing `application.characters`
 * is not sufficient: entity commits deliberately apply `characterPatches`
 * when present so stale combat snapshots cannot overwrite newer sheet data.
 */
export function mergeDnd5eCharacterPatchIntoResult(
  application: Dnd5eMapResultPlan,
  characterId: string,
  patch: Partial<Character>,
): Dnd5eMapResultPlan {
  const characterIndex = application.characters.findIndex((character) => character.id === characterId)
  if (characterIndex < 0) throw new Error(`combat-result-character-missing:${characterId}`)
  const characters = [...application.characters]
  characters[characterIndex] = { ...characters[characterIndex], ...patch }
  return {
    ...application,
    characters,
    changedCharacterIds: unique([...application.changedCharacterIds, characterId]),
    characterPatches: {
      ...(application.characterPatches ?? {}),
      [characterId]: {
        ...(application.characterPatches?.[characterId] ?? {}),
        ...patch,
      },
    },
  }
}

/**
 * Headless transactions carry a full character snapshot, but class choices are
 * durable character-sheet data rather than combat-owned state. A transaction
 * that finishes after the sheet changed must not restore its stale copy (most
 * visibly, a wizard's `spell-prepared` selection).
 */
export function mergeDnd5eCombatCharacterResult(
  current: Character,
  resolved: Character,
  patch?: Partial<Character>,
): Character {
  if (patch) return { ...current, ...patch }
  return {
    ...resolved,
    dnd5eClassChoices: current.dnd5eClassChoices,
  }
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
  if (new Set(input.application.map.tokens.map((token) => token.id)).size !== input.application.map.tokens.length) {
    throw new Error('combat-result-token-duplicate')
  }
  return { characterIds, tokenIds, characterById, tokenById }
}

/** 同步应用权威结果；预检完成前不会写入任何 Store。 */
export function applyDnd5eCombatResultApplication(
  input: Dnd5eCombatResultApplicationPort,
): Dnd5eCombatResultCommitReceipt {
  const prepared = prepareCommit(input)
  if (input.applicationMode === 'map' && !input.applyMap) {
    throw new Error('combat-result-map-application-port-missing')
  }
  for (const characterId of prepared.characterIds) {
    input.applyCharacter(
      characterId,
      prepared.characterById.get(characterId)!,
      input.application.characterPatches?.[characterId],
    )
  }
  if (input.applicationMode === 'map') {
    input.applyMap!(input.mapId, input.application.map)
  } else {
    for (const tokenId of prepared.tokenIds) {
      input.applyToken(
        input.mapId,
        tokenId,
        prepared.tokenById.get(tokenId)!,
        input.application.tokenPatches?.[tokenId],
      )
    }
  }
  return { mapId: input.mapId, characterIds: prepared.characterIds, tokenIds: prepared.tokenIds }
}

/** 应用后等待地图/角色共享快照落盘，调用方再发送动作 ACK 或关闭 Interrupt。 */
export async function commitDnd5eCombatResult(
  input: Dnd5eCombatResultCommitInput,
): Promise<Dnd5eCombatResultCommitReceipt> {
  const receipt = applyDnd5eCombatResultApplication(input)
  if (input.saveAll) {
    await input.saveAll(receipt)
    return receipt
  }
  const writes: Promise<unknown>[] = []
  if (input.saveCharacters && (input.forceSaveCharacters || receipt.characterIds.length > 0)) {
    writes.push(input.saveCharacters())
  }
  if (input.saveMap && (input.forceSaveMap || input.applicationMode === 'map' || receipt.tokenIds.length > 0)) {
    writes.push(input.saveMap())
  }
  await Promise.all(writes)
  return receipt
}
