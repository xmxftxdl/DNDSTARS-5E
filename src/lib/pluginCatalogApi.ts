import { sharedLobbyApiCandidates } from './sharedApi'
import { getAccountSession } from './accountSession'
import {
  AccountApiError,
  type AccountPluginVersion,
} from './accountApi'

export type PluginPublicationVisibility = 'public' | 'unlisted' | 'private'
export type PluginPublicationStatus = 'pending' | 'published' | 'rejected' | 'suspended' | 'withdrawn'

export interface PluginCatalogPublisher {
  accountId: string
  displayName: string
}

export interface PluginCatalogVersion extends Omit<AccountPluginVersion, 'schemaVersion' | 'name' | 'publisher' |
  'description' | 'apiVersion' | 'rulesetId' | 'createdAt' | 'updatedAt' | 'visibility'> {
  changelog: string
  visibility: Exclude<PluginPublicationVisibility, 'private'>
  status: PluginPublicationStatus
  submittedAt: number
  publishedAt?: number
  moderationNote?: string
}

export interface PluginCatalogEntry {
  schemaVersion: 1
  id: string
  name: string
  description: string
  publisher: PluginCatalogPublisher
  contentCategory: AccountPluginVersion['contentCategory']
  tags: string[]
  versions: PluginCatalogVersion[]
  createdAt: number
  updatedAt: number
}

async function catalogRequest<T>(path: string, init?: RequestInit, accountRequired = false): Promise<T> {
  const session = getAccountSession()
  if (accountRequired && !session) throw new AccountApiError('invalid-account-session', 401)
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
      throw new AccountApiError(body.error ?? 'plugin-catalog-request-failed', response.status)
    } catch (error) {
      if (error instanceof AccountApiError) throw error
    }
  }
  throw new AccountApiError(reachedServer ? 'plugin-catalog-request-failed' : 'server-unavailable')
}

export async function loadPluginCatalog(input: {
  query?: string
  category?: string
  publisher?: string
} = {}): Promise<PluginCatalogEntry[]> {
  const params = new URLSearchParams()
  if (input.query?.trim()) params.set('q', input.query.trim())
  if (input.category?.trim()) params.set('category', input.category.trim())
  if (input.publisher?.trim()) params.set('publisher', input.publisher.trim())
  const response = await catalogRequest<{ plugins: PluginCatalogEntry[] }>(
    `/plugins/catalog${params.size ? `?${params.toString()}` : ''}`,
  )
  return Array.isArray(response.plugins) ? response.plugins : []
}

export async function loadPluginCatalogEntry(pluginId: string): Promise<PluginCatalogEntry> {
  const response = await catalogRequest<{ plugin: PluginCatalogEntry }>(
    `/plugins/catalog/${encodeURIComponent(pluginId)}`,
  )
  return response.plugin
}

export async function loadPluginPublisher(accountId: string): Promise<{
  publisher: PluginCatalogPublisher
  plugins: PluginCatalogEntry[]
}> {
  return catalogRequest(`/plugins/publishers/${encodeURIComponent(accountId)}`)
}

export async function publishAccountPluginVersion(
  plugin: Pick<AccountPluginVersion, 'id' | 'version'>,
  input: { visibility: PluginPublicationVisibility; changelog?: string; tags?: string[] },
): Promise<{ publication: unknown; status?: PluginPublicationStatus }> {
  return catalogRequest(
    `/accounts/me/plugins/${encodeURIComponent(plugin.id)}/versions/${encodeURIComponent(plugin.version)}/publication`,
    { method: 'POST', body: JSON.stringify(input) },
    true,
  )
}

export async function downloadPublicPlugin(
  pluginId: string,
  version: Pick<PluginCatalogVersion, 'version' | 'integrity' | 'fileName'>,
): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(
        `${api}/plugins/catalog/${encodeURIComponent(pluginId)}/versions/${encodeURIComponent(version.version)}/download`,
      )
      reachedServer = true
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new AccountApiError(body.error ?? 'plugin-catalog-request-failed', response.status)
      }
      if (response.headers.get('X-Stars-Plugin-Integrity') !== version.integrity) {
        throw new AccountApiError('public-plugin-integrity-mismatch', 409)
      }
      let fileName = version.fileName || `${pluginId}.dndstars5e`
      try {
        fileName = decodeURIComponent(response.headers.get('X-Stars-Plugin-Filename') ?? '') || fileName
      } catch {
        // File names are cosmetic; identity remains the signed manifest and integrity.
      }
      return { bytes: await response.arrayBuffer(), fileName }
    } catch (error) {
      if (error instanceof AccountApiError) throw error
    }
  }
  throw new AccountApiError(reachedServer ? 'plugin-catalog-request-failed' : 'server-unavailable')
}

export async function reportPublicPlugin(input: {
  pluginId: string
  version: string
  category: 'security' | 'copyright' | 'malware' | 'misleading' | 'other'
  details: string
}): Promise<void> {
  await catalogRequest(
    `/plugins/catalog/${encodeURIComponent(input.pluginId)}/reports`,
    {
      method: 'POST',
      body: JSON.stringify({
        version: input.version,
        category: input.category,
        details: input.details,
      }),
    },
    true,
  )
}

export interface PluginModerationQueue {
  pending: Array<{
    plugin: Pick<PluginCatalogEntry, 'id' | 'name' | 'publisher'>
    version: PluginCatalogVersion
  }>
  reports: Array<{
    id: string
    pluginId: string
    version: string
    category: string
    details: string
    reporterAccountId: string
    status: string
    createdAt: number
  }>
}

export async function loadPluginModerationQueue(): Promise<PluginModerationQueue> {
  return catalogRequest('/plugins/moderation', { method: 'GET' }, true)
}

export async function moderatePluginVersion(input: {
  pluginId: string
  version: string
  action: 'approve' | 'reject' | 'suspend'
  note?: string
}): Promise<void> {
  await catalogRequest(
    `/plugins/catalog/${encodeURIComponent(input.pluginId)}/versions/${encodeURIComponent(input.version)}/moderate`,
    {
      method: 'POST',
      body: JSON.stringify({ action: input.action, note: input.note }),
    },
    true,
  )
}
