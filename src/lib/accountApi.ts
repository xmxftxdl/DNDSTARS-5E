import type { Character } from '../types/character'
import { sharedLobbyApiCandidates } from './sharedApi'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'
import {
  DND5E_2014_RULESET_ID,
  type RoomPluginRequirement,
  type RoomRulesSnapshot,
  type RoomSession,
} from './roomSession'
import {
  getAccountSession,
  type AccountRecoveryReceipt,
  type AccountSession,
} from './accountSession'
import type {
  Dnd5ePluginContentCategory,
  Dnd5ePluginDeclaredCapability,
  Dnd5ePluginDependency,
  Dnd5ePluginDistributionPolicy,
} from '../rulesets/dnd5e/pluginApi'

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
  avatar?: string
  username?: string
  contactChannel?: 'email' | 'phone'
  contactLabel?: string
  pluginAdmin?: boolean
  createdAt: number
  updatedAt: number
}

export interface AccountCampaignRoomSummary {
  roomId: string
  roomName: string
  createdAt: number
  closedAt?: number
  hostOnline: boolean
  status: 'online' | 'grace' | 'offline' | 'closed'
}

export interface AccountCampaign {
  schemaVersion: 1
  campaignId: string
  name: string
  description: string
  rulesetId: typeof DND5E_2014_RULESET_ID
  archived: boolean
  roomCount: number
  createdAt: number
  updatedAt: number
  latestRoom?: AccountCampaignRoomSummary
}

export type AccountVerificationChannel = 'email' | 'phone'

export interface AccountAuthConfig {
  schemaVersion: number
  channels: Record<AccountVerificationChannel, boolean>
  developmentDelivery: boolean
  verificationExpiresInSeconds: number
  passwordMinLength: number
}

export interface AccountVerificationChallenge {
  challengeId: string
  channel: AccountVerificationChannel
  destinationLabel: string
  expiresAt: number
  debugCode?: string
}

export interface AccountPluginVersion {
  schemaVersion: 1
  id: string
  name: string
  version: string
  apiVersion: 1 | 2
  rulesetId: typeof DND5E_2014_RULESET_ID
  stateSchemaVersion: number
  manifestSchemaVersion: 1
  minimumGameProtocolVersion: number
  dependencies: Dnd5ePluginDependency[]
  conflicts: string[]
  declaredCapabilities: Dnd5ePluginDeclaredCapability[]
  distributionPolicy: Dnd5ePluginDistributionPolicy
  contentCategory: Dnd5ePluginContentCategory
  publisher: string
  license: string
  description?: string
  workshopOrigin?: {
    kind: 'dm-workshop'
    campaignId?: string
    roomId?: string
    verifiedAt: number
  }
  fileName: string
  integrity: string
  sizeBytes: number
  visibility: 'private'
  createdAt: number
  updatedAt: number
}

export interface AccountPluginLibraryLimits {
  maxVersions: number
  maxTotalBytes: number
  maxPackageBytes: number
}

export interface AccountPluginLibrary {
  plugins: AccountPluginVersion[]
  limits: AccountPluginLibraryLimits
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

async function accountBinaryRequest(path: string, init?: RequestInit): Promise<Response> {
  const session = getAccountSession()
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          ...(session ? { 'X-Stars-Account-Token': session.sessionToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      if (response.ok) return response
      const body = await response.json().catch(() => ({})) as { error?: string }
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

export async function loadAccountAuthConfig(): Promise<AccountAuthConfig> {
  return accountRequest<AccountAuthConfig>('/accounts/auth/config', { method: 'GET' }, null)
}

export async function requestAccountVerification(
  channel: AccountVerificationChannel,
  destination: string,
): Promise<AccountVerificationChallenge> {
  return accountRequest<AccountVerificationChallenge>('/accounts/auth/verification', {
    method: 'POST',
    body: JSON.stringify({ channel, destination }),
  }, null)
}

export async function registerAccount(input: {
  challengeId: string
  verificationCode: string
  username: string
  password: string
  clientId: string
}): Promise<AccountSession> {
  const response = await accountRequest<{ session: AccountSession }>('/accounts/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }, null)
  return response.session
}

export async function loginAccount(
  identifier: string,
  password: string,
  clientId: string,
): Promise<AccountSession> {
  const response = await accountRequest<{ session: AccountSession }>('/accounts/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, clientId }),
  }, null)
  return response.session
}

export async function logoutAccount(): Promise<void> {
  await accountRequest<{ ok: true }>('/accounts/auth/logout', { method: 'POST' })
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

export async function updateAccountProfile(input: {
  displayName: string
  avatar?: string
}): Promise<AccountProfile> {
  return accountRequest<AccountProfile>('/accounts/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function changeAccountPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  await accountRequest<{ ok: true }>('/accounts/me/password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function loadAccountCampaigns(): Promise<AccountCampaign[]> {
  const response = await accountRequest<{ campaigns: AccountCampaign[] }>('/accounts/me/campaigns', {
    method: 'GET',
  })
  return Array.isArray(response.campaigns) ? response.campaigns : []
}

export async function createAccountCampaign(input: {
  name: string
  description?: string
  rulesetId?: typeof DND5E_2014_RULESET_ID
}): Promise<AccountCampaign> {
  return accountRequest<AccountCampaign>('/accounts/me/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? '',
      rulesetId: input.rulesetId ?? DND5E_2014_RULESET_ID,
    }),
  })
}

export async function updateAccountCampaign(
  campaignId: string,
  patch: { name?: string; description?: string; archived?: boolean },
): Promise<AccountCampaign> {
  return accountRequest<AccountCampaign>(
    `/accounts/me/campaigns/${encodeURIComponent(campaignId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
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

export async function loadAccountPlugins(): Promise<AccountPluginLibrary> {
  const response = await accountRequest<AccountPluginLibrary>('/accounts/me/plugins', { method: 'GET' })
  return {
    plugins: Array.isArray(response.plugins) ? response.plugins : [],
    limits: response.limits,
  }
}

export async function uploadAccountPlugin(input: {
  manifest: {
    id: string
    name: string
    version: string
    apiVersion: 1 | 2
    rulesetId: typeof DND5E_2014_RULESET_ID
    stateSchemaVersion?: number
    manifestSchemaVersion?: 1
    minimumGameProtocolVersion?: number
    dependencies?: readonly Dnd5ePluginDependency[]
    conflicts?: readonly string[]
    declaredCapabilities?: readonly Dnd5ePluginDeclaredCapability[]
    distributionPolicy?: Dnd5ePluginDistributionPolicy
    contentCategory?: Dnd5ePluginContentCategory
    publisher: string
    license: string
    description?: string
  }
  fileName: string
  integrity: string
  bytes: ArrayBuffer
  authority?: {
    kind: 'dm-workshop'
    campaignId?: string
    room?: Pick<RoomSession, 'roomId' | 'memberId' | 'roomToken'>
  }
}): Promise<AccountPluginVersion> {
  if (input.manifest.distributionPolicy === 'local-only') {
    throw new AccountApiError('plugin-local-only', 409)
  }
  if (input.manifest.distributionPolicy === 'room-ephemeral') {
    throw new AccountApiError('plugin-ephemeral-room-only', 409)
  }
  const response = await accountBinaryRequest(
    `/accounts/me/plugins/${encodeURIComponent(input.manifest.id)}/versions/${encodeURIComponent(input.manifest.version)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Stars-Plugin-Version': input.manifest.version,
        'X-Stars-Plugin-Integrity': input.integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(input.fileName),
        'X-Stars-Plugin-Name': encodeURIComponent(input.manifest.name),
        'X-Stars-Plugin-Publisher': encodeURIComponent(input.manifest.publisher),
        'X-Stars-Plugin-License': encodeURIComponent(input.manifest.license),
        'X-Stars-Plugin-State-Schema': String(input.manifest.stateSchemaVersion ?? 1),
        'X-Stars-Plugin-Api-Version': String(input.manifest.apiVersion),
        'X-Stars-Plugin-Ruleset': input.manifest.rulesetId,
        'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
          manifestSchemaVersion: input.manifest.manifestSchemaVersion ?? 1,
          minimumGameProtocolVersion: input.manifest.minimumGameProtocolVersion ?? 1,
          dependencies: input.manifest.dependencies ?? [],
          conflicts: input.manifest.conflicts ?? [],
          declaredCapabilities: input.manifest.declaredCapabilities ?? [],
          distributionPolicy: input.manifest.distributionPolicy ?? 'room-distributable',
          contentCategory: input.manifest.contentCategory ?? 'mixed',
        })),
        ...(input.authority ? {
          'X-Stars-Plugin-Origin': input.authority.kind,
          ...(input.authority.campaignId
            ? { 'X-Stars-Campaign-Id': input.authority.campaignId }
            : {}),
          ...(input.authority.room ? {
            'X-Stars-Room-Id': input.authority.room.roomId,
            'X-Stars-Member': input.authority.room.memberId,
            'X-Stars-Room-Token': input.authority.room.roomToken,
          } : {}),
        } : {}),
        ...(input.manifest.description
          ? { 'X-Stars-Plugin-Description': encodeURIComponent(input.manifest.description) }
          : {}),
      },
      body: input.bytes,
    },
  )
  return response.json() as Promise<AccountPluginVersion>
}

export async function downloadAccountPlugin(
  plugin: Pick<AccountPluginVersion, 'id' | 'version' | 'integrity'>,
): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  const response = await accountBinaryRequest(
    `/accounts/me/plugins/${encodeURIComponent(plugin.id)}/versions/${encodeURIComponent(plugin.version)}`,
    { method: 'GET' },
  )
  if (
    response.headers.get('X-Stars-Plugin-Version') !== plugin.version ||
    response.headers.get('X-Stars-Plugin-Integrity') !== plugin.integrity
  ) throw new AccountApiError('account-plugin-integrity-mismatch', 409)
  const encodedName = response.headers.get('X-Stars-Plugin-Filename') ?? ''
  let fileName = `${plugin.id}.dndstars5e`
  try {
    fileName = decodeURIComponent(encodedName) || fileName
  } catch {
    // 文件名不参与权威校验；损坏时回退到插件 ID。
  }
  return { bytes: await response.arrayBuffer(), fileName }
}

export async function deleteAccountPluginVersion(
  plugin: Pick<AccountPluginVersion, 'id' | 'version'>,
): Promise<void> {
  await accountRequest<{ ok: true }>(
    `/accounts/me/plugins/${encodeURIComponent(plugin.id)}/versions/${encodeURIComponent(plugin.version)}`,
    { method: 'DELETE' },
  )
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
    'invalid-account-username': '用户名需为 3～24 个中文、字母、数字、下划线或连字符。',
    'invalid-account-password': '密码长度至少为 8 个字符，最多 128 个字符。',
    'invalid-account-current-password': '当前密码不正确。',
    'invalid-account-avatar': '头像格式不正确或文件过大。',
    'registered-account-required': '这个旧版账号尚未设置密码，暂时不能使用修改密码功能。',
    'invalid-account-credentials': '用户名、邮箱、手机号或密码不正确。',
    'invalid-verification-destination': '请输入有效的邮箱地址或带国家区号的手机号。',
    'invalid-verification-code': '验证码不正确。',
    'verification-code-expired': '验证码已经过期，请重新发送。',
    'verification-attempt-limit': '验证码错误次数过多，请重新发送。',
    'verification-provider-unavailable': '当前服务器尚未配置该验证码发送渠道。',
    'verification-delivery-failed': '验证码发送失败，请稍后重试。',
    'account-auth-rate-limit': '请求过于频繁，请稍后再试。',
    'account-contact-exists': '该邮箱或手机号已经注册。',
    'account-username-exists': '该用户名已经被使用。',
    'account-identity-exists': '用户名或联系方式已经被使用。',
    'legacy-account-creation-disabled': '旧版恢复码账号创建入口已停用，请使用注册页面。',
    'invalid-recovery-code': '恢复码格式不正确或已经失效。',
    'invalid-account-session': '账号会话已经失效，请重新输入用户名和密码登录。',
    'account-character-not-found': '账号角色库中没有找到这个角色。',
    'invalid-account-character': '角色数据或兼容性清单无效，未写入账号角色库。',
    'invalid-campaign-name': '战役名称必须为 1～60 个字符。',
    'invalid-campaign-description': '战役简介不能超过 800 个字符。',
    'invalid-campaign-id': '战役标识无效。',
    'account-campaign-not-found': '账号中没有找到这个战役。',
    'account-campaign-limit': '账号保存的战役数量已达到上限。',
    'campaign-archived': '这个战役已归档，请先恢复后再开房。',
    'invalid-account-plugin': '插件清单或版本格式无效，未写入账号插件库。',
    'account-plugin-file-empty': '插件文件为空。',
    'account-plugin-not-found': '账号插件库中没有找到这个版本。',
    'account-plugin-file-not-found': '插件文件已经丢失，请重新上传。',
    'account-plugin-integrity-mismatch': '插件文件的 SHA-256 与版本记录不一致。',
    'account-plugin-version-conflict': '同一个插件版本已经存在不同文件；请提升插件版本号。',
    'account-plugin-version-limit': '账号插件版本数量已达到上限。',
    'account-plugin-storage-limit': '账号插件库空间已达到上限。',
    'account-plugin-in-use': '该插件版本仍被账号角色或发布记录引用，不能删除。',
    'invalid-plugin-upload-origin': '插件上传来源无效。',
    'dm-workshop-authority-required': '只有目标战役的所有者账号或已验证的当前房间 DM 才能从工坊上传插件。',
    'plugin-local-only': 'local-only 内容包只能保存在当前设备，不能上传到账号云库、房间或市场。',
    'plugin-ephemeral-room-only': 'room-ephemeral 合集只能临时导入当前房间，不能保存到账号云库或市场。',
    'public-plugin-must-be-declarative-json': '公开目录只接受声明式 JSON 规则包，不接受 JavaScript 插件。',
    'invalid-public-plugin-package': '规则包未通过公开发布结构校验。',
    'plugin-not-publicly-distributable': '该版本的分发策略不允许发布到公共目录。',
    'plugin-id-owned-by-other-publisher': '这个插件 ID 已由其他发布者登记。',
    'public-plugin-not-found': '公开目录中没有找到这个插件版本。',
    'public-plugin-integrity-mismatch': '公开插件文件的 SHA-256 校验失败。',
    'plugin-admin-required': '当前账号没有插件审核权限。',
    'invalid-creator-application': '创作者申请资料、政策版本或实名认证核验引用无效。',
    'creator-already-verified': '当前账号已经通过创作者实名认证。',
    'creator-account-suspended': '当前账号的创作者权限已暂停，请联系平台处理。',
    'verified-creator-required': '设置付费价格前，需要先在创作者中心完成实名认证。',
    'marketplace-rights-manifest-required': '公开商品必须提交权利清单。',
    'invalid-marketplace-rights-manifest': '权利清单不完整，请检查来源、许可证和创作者声明。',
    'marketplace-ai-disclosure-required': '包含 AI 辅助内容时必须填写公开披露说明。',
    'marketplace-art-rights-required': '插件包包含图标或美术素材，请勾选美术素材并提交对应的分发权声明。',
    'invalid-marketplace-price': '商品价格无效；付费商品价格范围为 ¥1～¥99。',
    'marketplace-paid-commerce-disabled': '当前为免费扩展市场 Beta，付费发布和购买尚未开放。',
    'invalid-marketplace-installation': '插件安装状态无效，未写入市场统计。',
    'marketplace-store-description-required': '商品详情至少需要 20 个字符。',
    'marketplace-automated-analysis-blocked': '自动解析发现疑似可执行内容，不能提交市场审核。',
    'marketplace-entitlement-required': '当前账号没有这个付费商品的有效使用许可。',
    'paid-marketplace-product-not-found': '没有找到可授权的已发布付费商品。',
    'marketplace-entitlement-not-found': '没有找到这条市场授权记录。',
    'invalid-entitlement-status': '市场授权状态无效。',
    'invalid-marketplace-order': '订单参数无效，请重新发起购买。',
    'marketplace-order-not-found': '没有找到该订单。',
    'marketplace-order-not-payable': '订单已失效或不能再次支付。',
    'marketplace-order-not-cancelable': '该订单当前不能取消。',
    'marketplace-order-not-reversible': '该订单当前不能退款或转为争议状态。',
    'marketplace-idempotency-conflict': '重复请求对应了不同商品，已拒绝创建订单。',
    'marketplace-product-already-owned': '当前账号已经拥有这个商品。',
    'marketplace-product-owned-by-account': '发布者无需购买自己发布的商品。',
    'marketplace-pending-order-limit': '待支付订单过多，请先完成或取消已有订单。',
    'marketplace-payment-amount-mismatch': '支付金额或币种与订单不一致。',
    'marketplace-provider-order-mismatch': '支付渠道订单号与平台订单不一致。',
    'invalid-marketplace-settlement': '商品分账设置无效，暂时无法创建订单。',
    'invalid-payment-webhook-signature': '支付回调签名无效。',
    'invalid-payment-webhook': '支付回调内容无效。',
    'invalid-marketplace-net-receipts': '支付渠道提供的净到账金额无效。',
    'marketplace-checkout-unavailable': '支付渠道尚未开放。',
    'marketplace-checkout-provider-unavailable': '暂时无法连接支付渠道。',
    'marketplace-checkout-provider-rejected': '支付渠道拒绝创建付款页面。',
    'invalid-marketplace-checkout-response': '支付渠道返回了无效的付款地址。',
    'marketplace-order-changed': '订单状态已经变化，请刷新后重试。',
    'marketplace-creator-required': '当前账号尚未开通创作者权限。',
    'invalid-marketplace-payout': '提现金额、币种或请求标识无效；人民币最低提现 ¥100。',
    'marketplace-payout-insufficient-balance': '当前可提现余额不足；结算保留期内的收入暂时不能提取。',
    'marketplace-payout-not-found': '没有找到这笔提现申请。',
    'invalid-payout-moderation': '提现审核操作无效。',
    'payout-moderation-note-required': '拒绝提现时必须填写原因。',
    'payout-transfer-reference-required': '确认打款时必须填写支付平台或银行流水号。',
    'invalid-payout-status-transition': '这笔提现的当前状态不允许执行该操作。',
    'marketplace-signature-verification-failed': '平台商品签名生成或验证失败。',
    'marketplace-signature-required': '这个付费商品缺少平台数字签名，已拒绝下载。',
    'marketplace-signature-invalid': '商品签名无效或商品信息被修改，已拒绝下载。',
    'plugin-catalog-request-failed': '插件目录请求失败，请稍后再试。',
    'account-request-failed': '账号操作失败，请稍后重试。',
  }
  return messages[code] ?? messages['account-request-failed']
}
