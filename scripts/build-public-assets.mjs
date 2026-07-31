import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

export const EXTERNAL_ART_DIRECTORIES = Object.freeze([
  'assets/icons',
  'assets/portraits',
  'assets/vfx',
])

function portableRelativePath(value) {
  return value.split(path.sep).join('/').replace(/^\/+|\/+$/g, '')
}

export function isExternalArtAssetRelativePath(relativePath) {
  const portable = portableRelativePath(relativePath)
  return EXTERNAL_ART_DIRECTORIES.some((directory) =>
    portable === directory || portable.startsWith(`${directory}/`))
}

async function copyDirectory(sourceRoot, outputRoot, relativeDirectory, summary) {
  const sourceDirectory = relativeDirectory
    ? path.join(sourceRoot, relativeDirectory)
    : sourceRoot
  const entries = await readdir(sourceDirectory, { withFileTypes: true })
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, entry.name)
      : entry.name
    if (isExternalArtAssetRelativePath(relativePath)) continue

    const sourcePath = path.join(sourceRoot, relativePath)
    const outputPath = path.join(outputRoot, relativePath)
    if (entry.isSymbolicLink()) {
      throw new Error(`public-copy-refuses-symbolic-link:${portableRelativePath(relativePath)}`)
    }
    if (entry.isDirectory()) {
      await mkdir(outputPath, { recursive: true })
      await copyDirectory(sourceRoot, outputRoot, relativePath, summary)
      continue
    }
    if (!entry.isFile()) continue

    await mkdir(path.dirname(outputPath), { recursive: true })
    await copyFile(sourcePath, outputPath)
    const info = await lstat(sourcePath)
    summary.files += 1
    summary.bytes += info.size
  }
}

export async function copyBuildPublicAssets({
  sourceRoot = path.resolve(process.cwd(), 'public'),
  outputRoot = path.resolve(process.cwd(), 'dist'),
} = {}) {
  const resolvedSource = path.resolve(sourceRoot)
  const resolvedOutput = path.resolve(outputRoot)
  const summary = { files: 0, bytes: 0 }
  await mkdir(resolvedOutput, { recursive: true })
  await copyDirectory(resolvedSource, resolvedOutput, '', summary)
  return summary
}

export async function findBundledExternalArtFiles({
  outputRoot = path.resolve(process.cwd(), 'dist'),
} = {}) {
  const resolvedOutput = path.resolve(outputRoot)
  const found = []
  for (const directory of EXTERNAL_ART_DIRECTORIES) {
    const absoluteDirectory = path.join(resolvedOutput, ...directory.split('/'))
    let entries
    try {
      entries = await readdir(absoluteDirectory, { recursive: true, withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      found.push(`${directory}/${entry.name}`)
    }
  }
  return found.sort()
}

export async function assertExternalArtExcludedFromBuild(options) {
  const found = await findBundledExternalArtFiles(options)
  if (found.length > 0) {
    throw new Error(`external-art-bundled-in-dist:${found.slice(0, 10).join(',')}`)
  }
}
