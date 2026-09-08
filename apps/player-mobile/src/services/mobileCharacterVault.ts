import type {
  MobileAccountCharacterRecord,
  MobileRoomRules,
} from '../../../../packages/mobile-protocol/src'

export const MOBILE_CHARACTER_SCHEMA_VERSION = 1
export const MOBILE_GAME_PROTOCOL_VERSION = 5

export interface MobileCharacterCompatibilityResult {
  compatible: boolean
  errors: string[]
  warnings: string[]
}

export function mobileCharacterCompatibilityForRoom(
  record: Pick<MobileAccountCharacterRecord, 'compatibility'>,
  rules: MobileRoomRules | null,
): MobileCharacterCompatibilityResult {
  const errors: string[] = []
  const warnings: string[] = []
  const compatibility = record.compatibility
  if (compatibility.rulesetId !== 'dnd5e-2014-srd-5.1') errors.push('角色不是 D&D 5e 2014 / SRD 5.1 角色。')
  if (compatibility.characterSchemaVersion > MOBILE_CHARACTER_SCHEMA_VERSION) {
    errors.push(`角色数据 v${compatibility.characterSchemaVersion} 高于手机端支持的 v${MOBILE_CHARACTER_SCHEMA_VERSION}。`)
  } else if (compatibility.characterSchemaVersion < MOBILE_CHARACTER_SCHEMA_VERSION) {
    warnings.push('角色将在载入后迁移到当前数据版本。')
  }
  if (compatibility.minimumGameProtocolVersion > MOBILE_GAME_PROTOCOL_VERSION) {
    errors.push(`角色要求游戏协议 v${compatibility.minimumGameProtocolVersion}，当前为 v${MOBILE_GAME_PROTOCOL_VERSION}。`)
  } else if (compatibility.lastSavedGameProtocolVersion !== MOBILE_GAME_PROTOCOL_VERSION) {
    warnings.push(`角色上次由游戏协议 v${compatibility.lastSavedGameProtocolVersion} 保存。`)
  }
  if (!rules) errors.push('尚未取得房间规则，不能核对角色。')
  else {
    const installed = new Map(rules.requiredPlugins.map((plugin) => [plugin.id, plugin]))
    for (const required of compatibility.requiredPlugins) {
      const current = installed.get(required.id)
      if (!current) errors.push(`房间缺少插件 ${required.id} v${required.version}。`)
      else if (
        current.version !== required.version ||
        current.integrity !== required.integrity ||
        current.stateSchemaVersion !== required.stateSchemaVersion
      ) errors.push(`插件 ${required.id} 的版本或哈希不匹配。`)
    }
  }
  return { compatible: errors.length === 0, errors, warnings }
}

