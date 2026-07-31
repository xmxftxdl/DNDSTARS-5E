import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertExternalArtExcludedFromBuild,
  copyBuildPublicAssets,
  findBundledExternalArtFiles,
  isExternalArtAssetRelativePath,
} from '../../scripts/build-public-assets.mjs'

const cleanup: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'stars-public-copy-'))
  cleanup.push(root)
  const sourceRoot = path.join(root, 'public')
  const outputRoot = path.join(root, 'dist')
  await mkdir(path.join(sourceRoot, 'assets', 'portraits'), { recursive: true })
  await mkdir(path.join(sourceRoot, 'assets', 'icons'), { recursive: true })
  await mkdir(path.join(sourceRoot, 'assets', 'vfx'), { recursive: true })
  await mkdir(path.join(sourceRoot, 'runtime-assets'), { recursive: true })
  await writeFile(path.join(sourceRoot, 'index.txt'), 'core')
  await writeFile(path.join(sourceRoot, 'runtime-assets', 'art-asset-pack.json'), '{}')
  await writeFile(path.join(sourceRoot, 'assets', 'portraits', 'variant-token.png'), 'portrait')
  await writeFile(path.join(sourceRoot, 'assets', 'icons', 'spell.png'), 'icon')
  await writeFile(path.join(sourceRoot, 'assets', 'vfx', 'fire.webp'), 'vfx')
  return { sourceRoot, outputRoot }
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })))
})

describe('production public asset boundary', () => {
  it('recognizes only the three external same-origin art directories', () => {
    expect(isExternalArtAssetRelativePath('assets/portraits/goblin-token.png')).toBe(true)
    expect(isExternalArtAssetRelativePath('assets/icons/spell.png')).toBe(true)
    expect(isExternalArtAssetRelativePath('assets/vfx/fire.webp')).toBe(true)
    expect(isExternalArtAssetRelativePath('assets/main-hash.js')).toBe(false)
    expect(isExternalArtAssetRelativePath('runtime-assets/art-asset-pack.json')).toBe(false)
  })

  it('copies the lightweight public tree without copying the external art pack', async () => {
    const { sourceRoot, outputRoot } = await fixture()
    const result = await copyBuildPublicAssets({ sourceRoot, outputRoot })

    expect(result.files).toBe(2)
    await expect(readFile(path.join(outputRoot, 'index.txt'), 'utf8')).resolves.toBe('core')
    await expect(readFile(
      path.join(outputRoot, 'runtime-assets', 'art-asset-pack.json'),
      'utf8',
    )).resolves.toBe('{}')
    await expect(findBundledExternalArtFiles({ outputRoot })).resolves.toEqual([])
    await expect(assertExternalArtExcludedFromBuild({ outputRoot })).resolves.toBeUndefined()
  })

  it('fails the boundary audit when an art file appears in dist', async () => {
    const { outputRoot } = await fixture()
    await mkdir(path.join(outputRoot, 'assets', 'portraits'), { recursive: true })
    await writeFile(path.join(outputRoot, 'assets', 'portraits', 'leak.png'), 'leak')

    await expect(assertExternalArtExcludedFromBuild({ outputRoot }))
      .rejects.toThrow('external-art-bundled-in-dist')
  })
})
