import type { Character } from '../types/character'
import { sharedLobbyApiCandidates } from './sharedApi'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocol'
import {
  DND5E_2014_RULESET_ID,
  type RoomPluginRequirement,
  type RoomRulesSnapshot,
} from './roomSession'
import {
  getAccountSession,
  type AccountRecoveryReceipt,
  type AccountSession,
} from './accountSession'

export const ACCOUNT_CHARACTER_SCHEMA_VERSION = 1

export interface AccountCharacterCompatibility {
  rulesetId: typeof DND5E_2014_RULESET_ID
  characterSchemaVersion: number
  minimumGameProtocolVersion: number
  lastSavedGameProtocolVersion: number
  requiredPlugins: RoomPluginRequirement[]
}

export interface AccountCharacterRecord {
  id: string
  name: string
  updatedAt: number
  character: Character
  compatibility: AccountCharacterCompatibility
}

export interface AccountProfile {
  accountId: string
  displayName: string
  createdAt: number
  updatedAt: number
}

export interface CharacterCompatibilityResult {
  compatible: boolean
  errors: string[]
  warnings: string[]
}

export class AccountApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'AccountApiError'
    this.code = code
    this.status = status
  }
}

async function accountRequest<T>(path: string, init?: RequestInit, session = getAccountSession()): Promise<T> {
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Stars-Account-Token': session.sessionToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (response.ok) return body as T
      throw new AccountApiError(body.error ?? 'account-request-failed', response.status)
    } catch (error) {
      if (error instanceof AccountApiError) throw error
      void error
    }
  }
  throw new AccountApiError(reachedServer ? 'account-request-failed' : 'server-unavailable', 0)
}

export async function createAccount(displayName: string, clientId: string): Promise<AccountRecoveryReceipt> {
  return accountRequest<AccountRecoveryReceipt>('/accounts', {
    method: 'POST',
    body: JSON.stringify({ displayName, clientId }),
  }, null)
}

export async function recoverAccount(recoveryCode: string, clientId: string): Promise<AccountSession> {
  const response = await accountRequest<{ session: AccountSession }>('/accounts/recover', {
    method: 'POST',
    body: JSON.stringify({ recoveryCode, clientId }),
  }, null)
  return response.session
}

export async function loadAccountProfile(): Promise<AccountProfile> {
  return accountRequest<AccountProfile>('/accounts/me', { method: 'GET' })
}

export async function loadAccountCharacters(): Promise<AccountCharacterRecord[]> {
  const response = await accountRequest<{ characters: AccountCharacterRecord[] }>('/accounts/me/characters', {
    method: 'GET',
  })
  return Array.isArray(response.characters) ? response.characters : []
}

export async function saveAccountCharacter(record: AccountCharacterRecord): Promise<AccountCharacterRecord> {
  return accountRequest<AccountCharacterRecord>(`/accounts/me/characters/${encodeURIComponent(record.id)}`, {
    method: 'PUT',
    body: JSON.stringify(record),
  })
}

export async function deleteAccountCharacter(characterId: string): Promise<void> {
  await accountRequest<{ ok: true }>(`/accounts/me/characters/${encodeURIComponent(characterId)}`, {
    method: 'DELETE',
  })
}

export function characterCompatibilityForRoom(
  record: Pick<AccountCharacterRecord, 'compatibility'>,
  rules: RoomRulesSnapshot | null,
): CharacterCompatibilityResult {
  const errors: string[] = []
  const warnings: string[] = []
  const compatibility = record.compatibility
  if (compatibility.rulesetId !== DND5E_2014_RULESET_ID) {
    errors.push('角色使用的规则集不是 D&D 5e 2014 / SRD 5.1。')
  }
  if (compatibility.characterSchemaVersion > ACCOUNT_CHARACTER_SCHEMA_VERSION) {
    errors.push(`角色数据版本 ${compatibility.characterSchemaVersion} 高于当前客户端支持的版本 ${ACCOUNT_CHARACTER_SCHEMA_VERSION}。`)
  } else if (compatibility.characterSchemaVersion < ACCOUNT_CHARACTER_SCHEMA_VERSION) {
    warnings.push('角色会在载入后迁移到当前数据版本。')
  }
  if (compatibility.minimumGameProtocolVersion > CLIENT_SHARED_PROTOCOL_VERSION) {
    errors.push(`角色要求游戏协议 v${compatibility.minimumGameProtocolVersion}，当前客户端为 v${CLIENT_SHARED_PROTOCOL_VERSION}。`)
  } else if (compatibility.lastSavedGameProtocolVersion !== CLIENT_SHARED_PROTOCOL_VERSION) {
    warnings.push(`角色上次由游戏协议 v${compatibility.lastSavedGameProtocolVersion} 保存，载入时会重新校验。`)
  }
  if (!rules) {
    errors.push('尚未取得房间规则，不能核对角色兼容性。')
  } else {
    const roomPlugins = new Map(rules.requiredPlugins.map((plugin) => [plugin.id, plugin]))
    for (const plugin of compatibility.requiredPlugins) {
      const installed = roomPlugins.get(plugin.id)
      if (!installed) {
        errors.push(`房间缺少角色需要的插件 ${plugin.id} v${plugin.version}。`)
      } else if (
        installed.version !== plugin.version || installed.integrity !== plugin.integrity ||
        installed.stateSchemaVersion !== plugin.stateSchemaVersion
      ) {
        errors.push(`插件 ${plugin.id} 的版本或文件哈希与角色记录不一致。`)
      }
    }
  }
  return { compatible: errors.length === 0, errors, warnings }
}

export function accountApiErrorMessage(error: unknown): string {
  const code = error instanceof AccountApiError ? error.code : 'account-request-failed'
  const messages: Record<string, string> = {
    'server-unavailable': '无法连接账号与角色库服务。请确认 DM 服务端已启动。',
    'invalid-account-name': '账号称呼必须为 1～24 个字符。',
    'invalid-recovery-code': '恢复码格式不正确或已经失效。',
    'invalid-account-session': '账号会话已经失效，请使用恢复码重新登录。',
    'account-character-not-found': '账号角色库中没有找到这个角色。',
    'invalid-account-character': '角色数据或兼容性清单无效，未写入账号角色库。',
    'account-request-failed': '账号操作失败，请稍后重试。',
  }
  return messages[code] ?? messages['account-request-failed']
}
