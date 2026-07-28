import { sharedEventApiCandidates } from './sharedApi'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'

export { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'

export interface SharedServerMeta {
  service: 'dndstars-5e-shared'
  rulesetId: 'dnd5e-2014-srd-5.1'
  protocolVersion: number
  minimumClientProtocol: number
  buildId: string
  startedAt: number
}

export type SharedProtocolStatus =
  | { kind: 'compatible'; meta: SharedServerMeta; endpoint: string }
  | { kind: 'legacy'; endpoint?: string }
  | { kind: 'incompatible'; meta: SharedServerMeta; endpoint: string }
  | { kind: 'offline' }

export function parseSharedServerMeta(value: unknown): SharedServerMeta | null {
  if (!value || typeof value !== 'object') return null
  const meta = value as Partial<SharedServerMeta>
  if (
    meta.service !== 'dndstars-5e-shared' ||
    meta.rulesetId !== 'dnd5e-2014-srd-5.1' ||
    !Number.isInteger(meta.protocolVersion) ||
    !Number.isInteger(meta.minimumClientProtocol) ||
    typeof meta.buildId !== 'string' ||
    !Number.isFinite(meta.startedAt)
  ) return null
  return meta as SharedServerMeta
}

export function sharedProtocolCompatible(meta: SharedServerMeta): boolean {
  return meta.protocolVersion >= CLIENT_SHARED_PROTOCOL_VERSION &&
    meta.minimumClientProtocol <= CLIENT_SHARED_PROTOCOL_VERSION
}

export async function inspectSharedProtocol(): Promise<SharedProtocolStatus> {
  let reachedLegacyEndpoint: string | undefined
  for (const api of sharedEventApiCandidates()) {
    try {
      const response = await fetch(`${api}/meta`, { cache: 'no-store' })
      if (response.status === 404) {
        reachedLegacyEndpoint ??= api
        continue
      }
      if (!response.ok) continue
      const meta = parseSharedServerMeta(await response.json().catch(() => null))
      if (!meta) {
        reachedLegacyEndpoint ??= api
        continue
      }
      return sharedProtocolCompatible(meta)
        ? { kind: 'compatible', meta, endpoint: api }
        : { kind: 'incompatible', meta, endpoint: api }
    } catch {
      // Try the next configured shared endpoint.
    }
  }
  return reachedLegacyEndpoint ? { kind: 'legacy', endpoint: reachedLegacyEndpoint } : { kind: 'offline' }
}
