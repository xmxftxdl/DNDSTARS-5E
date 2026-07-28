import type { Character } from '../types/character'
import { useCharacterStore } from '../store/characters'
import {
  ACCOUNT_CHARACTER_SCHEMA_VERSION,
  saveAccountCharacter,
  type AccountCharacterRecord,
} from './accountApi'
import { getAccountSession } from './accountSession'
import { getRoomRulesSnapshot } from './roomRulesState'
import { getRoomSession } from './roomSession'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'

function detachedCharacter(character: Character, accountId: string): Character {
  const detached = { ...character, ownerAccountId: accountId }
  delete detached.roomId
  delete detached.roomMemberId
  return detached
}

export function makeAccountCharacterRecord(
  character: Character,
  accountId: string,
  updatedAt = Date.now(),
): AccountCharacterRecord {
  const rules = getRoomRulesSnapshot()
  const detached = detachedCharacter(character, accountId)
  return {
    id: detached.id,
    name: detached.name,
    updatedAt,
    character: detached,
    compatibility: {
      rulesetId: 'dnd5e-2014-srd-5.1',
      characterSchemaVersion: ACCOUNT_CHARACTER_SCHEMA_VERSION,
      minimumGameProtocolVersion: CLIENT_SHARED_PROTOCOL_VERSION,
      lastSavedGameProtocolVersion: CLIENT_SHARED_PROTOCOL_VERSION,
      requiredPlugins: rules?.requiredPlugins.map((plugin) => ({ ...plugin })) ?? [],
    },
  }
}

export function startAccountCharacterVaultSync(): () => void {
  let timer: number | null = null
  let disposed = false
  let lastSnapshot = ''

  const flush = async () => {
    timer = null
    const account = getAccountSession()
    const room = getRoomSession()
    if (!account || room?.role !== 'player') return
    if (!getRoomRulesSnapshot()) {
      if (!disposed && timer == null) timer = window.setTimeout(() => void flush(), 1_000)
      return
    }
    const characters = useCharacterStore.getState().characters.filter((character) =>
      character.ownerAccountId === account.accountId ||
      (character.roomId === room.roomId && character.roomMemberId === room.memberId))
    const snapshot = JSON.stringify(characters)
    if (snapshot === lastSnapshot) return
    const updatedAt = Date.now()
    const results = await Promise.allSettled(characters.map((character) =>
      saveAccountCharacter(makeAccountCharacterRecord(character, account.accountId, updatedAt))))
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') {
      console.error('[账号角色库同步失败]', failure.reason)
      if (!disposed && timer == null) timer = window.setTimeout(() => void flush(), 5_000)
      return
    }
    lastSnapshot = snapshot
  }

  const schedule = () => {
    if (disposed || timer != null) return
    timer = window.setTimeout(() => void flush(), 800)
  }
  const unsubscribe = useCharacterStore.subscribe(schedule)
  schedule()
  return () => {
    disposed = true
    unsubscribe()
    if (timer != null) window.clearTimeout(timer)
  }
}
