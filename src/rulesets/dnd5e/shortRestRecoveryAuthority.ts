import { SHORT_REST_RECOVERY_RECEIPT_LIMIT, validShortRestRecoveryJournal } from '../../../shared/short-rest-recovery.mjs'
import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import type { CampaignTimeAdvance } from '../../lib/campaignTime'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { resolveDnd5eShortRestHitDice } from './hitPoints'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5eBardSongOfRestDie } from './classes'

export interface Dnd5eShortRestRecoveryCommand {
  id: string
  advanceId: string
  characterId: string
  mapId: string
  tokenId: string
  poolIndex: number
  expectedPoolCurrent: number
  songOfRestBardId?: string
}
export interface Dnd5eShortRestRecoveryReceipt {
  command: Dnd5eShortRestRecoveryCommand
  hitDiceHealing: number
  songOfRestHealing: number
  healingApplied: number
}
export interface Dnd5eShortRestRecoveryJournal {
  schemaVersion: 1
  receipts: readonly Dnd5eShortRestRecoveryReceipt[]
}

/** Host-only operation. Persist character and journal together; dice and eligibility
 * are supplied by authority, never copied from the player's command payload. */
export function settleDnd5eShortRestRecovery(input: {
  command: Dnd5eShortRestRecoveryCommand
  controlledCharacterIds: readonly string[]
  characters: readonly Character[]
  advances: readonly CampaignTimeAdvance[]
  map: BattleMap
  round: number
  worldMinute: number
  combatActive: boolean
  geometry?: MapGeometryState | null
  journal: Dnd5eShortRestRecoveryJournal
  hitDieRoll: number
  songOfRestRoll?: number
  /** Host established that these bards provided an audible Song of Rest. */
  songOfRestEligibleBardIds: readonly string[]
}): { ok: true; character: Character; journal: Dnd5eShortRestRecoveryJournal;
  receipt: Dnd5eShortRestRecoveryReceipt; deduplicated: boolean } | { ok: false; reason: string } {
  if (!validShortRestRecoveryJournal(input.journal)) return { ok: false, reason: 'invalid-rest-journal' }
  const command = input.command
  if (!command.id || command.id.length > 160 || !Number.isInteger(command.poolIndex) || command.poolIndex < 0 ||
    !Number.isInteger(command.expectedPoolCurrent) || command.expectedPoolCurrent < 1) return { ok: false, reason: 'invalid-command' }
  if (!input.controlledCharacterIds.includes(command.characterId)) return { ok: false, reason: 'character-owner-mismatch' }
  const character = input.characters.find(row => row.id === command.characterId)
  if (!character) return { ok: false, reason: 'character-not-found' }
  const prior = input.journal.receipts.find(row => row.command.id === command.id)
  if (prior) {
    const keys: (keyof Dnd5eShortRestRecoveryCommand)[] = ['id', 'advanceId', 'characterId', 'mapId', 'tokenId', 'poolIndex', 'expectedPoolCurrent', 'songOfRestBardId']
    if (keys.some(key => prior.command[key] !== command[key])) return { ok: false, reason: 'command-id-conflict' }
    return { ok: true, character, journal: input.journal, receipt: prior, deduplicated: true }
  }
  if (input.journal.receipts.length >= SHORT_REST_RECOVERY_RECEIPT_LIMIT) return { ok: false, reason: 'rest-journal-full' }
  if (input.combatActive) return { ok: false, reason: 'rest-during-combat' }
  const advance = input.advances.find(row => row.id === command.advanceId)
  if (!advance || advance.kind !== 'short-rest' || advance.minutes < 60 ||
    !Number.isFinite(input.worldMinute) || input.worldMinute !== advance.toWorldMinute ||
    advance.toWorldMinute - advance.fromWorldMinute !== advance.minutes ||
    (advance.beneficiaryCharacterIds != null && !advance.beneficiaryCharacterIds.includes(character.id))) {
    return { ok: false, reason: 'invalid-rest-receipt' }
  }
  if (input.map.id !== command.mapId || !input.map.tokens.some(token =>
    token.id === command.tokenId && token.characterId === character.id && token.type === 'player')) {
    return { ok: false, reason: 'invalid-rest-location' }
  }
  if (!Number.isInteger(input.round) || input.round < 0) return { ok: false, reason: 'invalid-scene-round' }
  const pool = character.hitPointDice?.[command.poolIndex]
  if (!pool || pool.current !== command.expectedPoolCurrent) return { ok: false, reason: 'hit-dice-conflict' }
  let songOfRest: { dieSides: 6 | 8 | 10 | 12; roll: number } | undefined
  if (command.songOfRestBardId) {
    if (input.journal.receipts.some(row => row.command.advanceId === advance.id &&
      row.command.characterId === character.id && row.command.songOfRestBardId)) return { ok: false, reason: 'song-of-rest-already-used' }
    const bard = input.characters.find(row => row.id === command.songOfRestBardId)
    const level = bard ? dnd5eCharacterClassLevel(bard, 'bard') : 0
    if (!bard || level < 2 || !input.songOfRestEligibleBardIds.includes(bard.id) ||
      (advance.beneficiaryCharacterIds != null && !advance.beneficiaryCharacterIds.includes(bard.id))) {
      return { ok: false, reason: 'song-of-rest-unavailable' }
    }
    const sides = dnd5eBardSongOfRestDie(level)
    if (![6, 8, 10, 12].includes(sides) || input.songOfRestRoll == null) return { ok: false, reason: 'invalid-song-roll' }
    songOfRest = { dieSides: sides as 6 | 8 | 10 | 12, roll: input.songOfRestRoll }
  } else if (input.songOfRestRoll != null) return { ok: false, reason: 'unexpected-song-roll' }
  try {
    const resolved = resolveDnd5eShortRestHitDice({ character,
      spends: [{ poolIndex: command.poolIndex, rolls: [input.hitDieRoll] }], songOfRest,
      healingContext: { map: input.map, ownerTokenId: command.tokenId, round: input.round,
        worldMinute: input.worldMinute, geometry: input.geometry },
    })
    const receipt: Dnd5eShortRestRecoveryReceipt = { command: { ...command }, hitDiceHealing: resolved.hitDiceHealing,
      songOfRestHealing: resolved.songOfRestHealing, healingApplied: resolved.healingApplied }
    return { ok: true, character: resolved.character, journal: { schemaVersion: 1,
      receipts: [...input.journal.receipts, receipt] }, receipt, deduplicated: false }
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, reason: 'invalid-rest-dice' }
    throw error
  }
}
