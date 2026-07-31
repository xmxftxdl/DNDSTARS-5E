export const EXTERNAL_ART_DIRECTORIES: readonly [
  'assets/icons',
  'assets/portraits',
  'assets/vfx',
]

export function isExternalArtAssetRelativePath(relativePath: string): boolean

export function copyBuildPublicAssets(options?: {
  sourceRoot?: string
  outputRoot?: string
}): Promise<{ files: number; bytes: number }>

export function findBundledExternalArtFiles(options?: {
  outputRoot?: string
}): Promise<string[]>

export function assertExternalArtExcludedFromBuild(options?: {
  outputRoot?: string
}): Promise<void>
