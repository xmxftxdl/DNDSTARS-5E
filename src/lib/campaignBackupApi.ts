import { sharedLobbyApiCandidates } from './sharedApi'
import { getRoomSession } from './roomSession'

export const CAMPAIGN_BUNDLE_FORMAT = 'dndstars5e-campaign'
export const CAMPAIGN_BUNDLE_SCHEMA_VERSION = 1
export const CAMPAIGN_IMPORT_MAX_BYTES = 128 * 1024 * 1024

export interface CampaignSnapshotSummary {
  id: string
  createdAt: number
  kind: 'auto' | 'manual' | 'pre-restore' | string
  stateCount: number
}

export interface CampaignPreflight {
  ok: boolean
  errors: string[]
  warnings: string[]
  roomName: string
  sourceRoomId: string
  stateCount: number
  imageCount: number
  pluginCount: number
  exportedAt: number
}

export class CampaignBackupError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'CampaignBackupError'
    this.code = code
    this.status = status
  }
}

function campaignUrl(api: string, path: string): string {
  const url = new URL(`${api}${path}`)
  const roomId = getRoomSession()?.roomId
  if (roomId) url.searchParams.set('room', roomId)
  return url.toString()
}

async function campaignRequest(path: string, init?: RequestInit): Promise<Response> {
  const session = getRoomSession()
  const accessToken = import.meta.env.VITE_STARS_ACCESS_TOKEN as string | undefined
  if (session && session.role !== 'dm') throw new CampaignBackupError('dm-only', 403)
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(campaignUrl(api, path), {
        ...init,
        headers: {
          ...(init?.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
          ...(session ? { 'X-Stars-Member': session.memberId } : {}),
          ...(accessToken ? { 'X-Stars-Token': accessToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      if (response.ok) return response
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (response.status === 404) continue
      throw new CampaignBackupError(body.error ?? 'request-failed', response.status)
    } catch (error) {
      if (error instanceof CampaignBackupError) throw error
    }
  }
  throw new CampaignBackupError(reachedServer ? 'server-too-old' : 'server-unavailable')
}

export function campaignBackupErrorMessage(error: unknown): string {
  if (!(error instanceof CampaignBackupError)) return error instanceof Error ? error.message : '未知错误'
  if (error.code === 'server-too-old') return '共享服务仍是旧版本，请重启 5273 后再使用战役备份。'
  if (error.code === 'server-unavailable') return '无法连接共享服务。'
  if (error.code === 'campaign-state-corrupted') return '当前战役含损坏状态，服务已阻止生成不完整备份。'
  if (error.code === 'campaign-preflight-failed') return '备份预检失败，未修改当前战役。'
  if (error.code === 'snapshot-not-found') return '这个快照已不存在。'
  if (error.code === 'forbidden' || error.code === 'dm-only') return '只有当前房间的 DM 可以管理备份。'
  return `备份操作失败：${error.code}`
}

export async function listCampaignSnapshots(): Promise<CampaignSnapshotSummary[]> {
  const response = await campaignRequest('/campaign/snapshots')
  const body = await response.json() as { snapshots?: CampaignSnapshotSummary[] }
  return Array.isArray(body.snapshots) ? body.snapshots : []
}

export async function createCampaignSnapshot(): Promise<CampaignSnapshotSummary> {
  const response = await campaignRequest('/campaign/snapshots', { method: 'POST' })
  return await response.json() as CampaignSnapshotSummary
}

export async function restoreCampaignSnapshot(id: string): Promise<void> {
  await campaignRequest(`/campaign/snapshots/${encodeURIComponent(id)}/restore`, { method: 'POST' })
}

export async function downloadCampaignExport(): Promise<void> {
  const response = await campaignRequest('/campaign/export')
  const blob = await response.blob()
  const roomId = getRoomSession()?.roomId ?? 'local'
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `DNDSTARS5E-${roomId}-${new Date().toISOString().slice(0, 10)}.dndstars5e-campaign.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function preflightCampaignFile(file: File): Promise<{ preflight: CampaignPreflight; bundle: unknown }> {
  const errors: string[] = []
  const warnings: string[] = []
  if (file.size > CAMPAIGN_IMPORT_MAX_BYTES) errors.push('文件超过 128 MiB 上限')
  let bundle: unknown = null
  try {
    bundle = JSON.parse(await file.text())
  } catch {
    errors.push('文件不是有效 JSON')
  }
  const root = objectValue(bundle) ? bundle : {}
  const room = objectValue(root.room) ? root.room : {}
  if (root.format !== CAMPAIGN_BUNDLE_FORMAT) errors.push('不是 DNDSTARS 5E 战役包')
  if (root.schemaVersion !== CAMPAIGN_BUNDLE_SCHEMA_VERSION) errors.push('战役包版本不受支持')
  if (room.rulesetId !== 'dnd5e-2014-srd-5.1') errors.push('规则不是 D&D 5e 2014 · SRD 5.1')
  if (!objectValue(root.states)) errors.push('缺少共享状态集合')
  if (!Array.isArray(root.images)) errors.push('地图图片清单损坏')
  if (!Array.isArray(root.plugins)) errors.push('规则包清单损坏')
  const sourceRoomId = typeof room.id === 'string' ? room.id : '未知'
  const currentRoomId = getRoomSession()?.roomId
  if (currentRoomId && sourceRoomId !== currentRoomId) warnings.push(`来源房间为 ${sourceRoomId}，将还原到当前房间 ${currentRoomId}`)
  return {
    bundle,
    preflight: {
      ok: errors.length === 0,
      errors,
      warnings,
      roomName: typeof room.name === 'string' ? room.name : '未命名战役',
      sourceRoomId,
      stateCount: objectValue(root.states) ? Object.keys(root.states).length : 0,
      imageCount: Array.isArray(root.images) ? root.images.length : 0,
      pluginCount: Array.isArray(root.plugins) ? root.plugins.length : 0,
      exportedAt: typeof root.exportedAt === 'number' ? root.exportedAt : 0,
    },
  }
}

export async function importCampaignBundle(bundle: unknown): Promise<void> {
  await campaignRequest('/campaign/import', { method: 'PUT', body: JSON.stringify(bundle) })
}
