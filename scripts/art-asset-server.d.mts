import type { IncomingMessage, ServerResponse } from 'node:http'

export const ART_ASSET_MANIFEST_SCHEMA_VERSION: 1
export const DEFAULT_ART_ASSET_PUBLIC_PREFIX: '/assets'
export const DEFAULT_ART_ASSET_DIRECTORIES: readonly [
  'assets/portraits',
  'assets/icons',
  'assets/vfx',
]
export const DEFAULT_ART_ASSET_CACHE_CONTROL: 'public, max-age=0, must-revalidate'
export const IMMUTABLE_ART_ASSET_CACHE_CONTROL: 'public, max-age=31536000, immutable'

export class ArtAssetPackError extends Error {
  code: string
  details?: unknown
  constructor(code: string, details?: unknown)
}

export interface ArtAssetPack {
  readonly schemaVersion: 1
  readonly packId: string
  readonly version: string
  readonly root: string
  readonly manifestPath: string
  readonly manifestSha256: string
  readonly publicPrefix: string
  readonly allowedDirectories: readonly string[]
  readonly cacheControl: string
  readonly contentVerified: boolean
  readonly fileCount: number
}

export interface LoadArtAssetPackOptions {
  root: string
  manifestPath?: string
  expectedManifestSha256?: string
  publicPrefix?: string
  allowedDirectories?: string[]
  cacheControl?: string
  immutable?: boolean
  verifyContent?: boolean
}

export type ParsedByteRange =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'range'; start: number; end: number }

export function loadArtAssetPack(options: LoadArtAssetPackOptions): Promise<ArtAssetPack>

export function parseSingleByteRange(
  value: string | string[] | null | undefined,
  size: number,
): ParsedByteRange

export function serveArtAsset(
  req: Pick<IncomingMessage, 'method' | 'url' | 'headers'>,
  res: ServerResponse,
  pack: ArtAssetPack,
): Promise<boolean>
