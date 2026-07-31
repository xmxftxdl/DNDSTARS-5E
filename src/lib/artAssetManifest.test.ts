/// <reference types="node" />
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(process.cwd())
const generator = path.join(repositoryRoot, 'scripts', 'generate-art-asset-manifest.mjs')
const temporaryRoots: string[] = []

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-art-manifest-'))
  temporaryRoots.push(root)
  await Promise.all([
    mkdir(path.join(root, 'src', 'lib'), { recursive: true }),
    mkdir(path.join(root, 'public', 'assets', 'portraits'), { recursive: true }),
    mkdir(path.join(root, 'public', 'assets', 'icons'), { recursive: true }),
    mkdir(path.join(root, 'public', 'assets', 'vfx'), { recursive: true }),
  ])
  await writeFile(path.join(root, 'src', 'lib', 'enemyPool.ts'), `
    const presentation = {
      tokenPortrait: '/assets/portraits/wolf-rain-token.png',
      initiativePortrait: '/assets/portraits/wolf-rain-initiative.png',
    }
  `)
  await Promise.all([
    writeFile(path.join(root, 'public', 'assets', 'portraits', 'wolf-rain-token.png'), 'token'),
    writeFile(path.join(root, 'public', 'assets', 'portraits', 'wolf-rain-initiative.png'), 'initiative'),
    writeFile(path.join(root, 'public', 'assets', 'portraits', 'legacy-token.png'), 'legacy token'),
    writeFile(path.join(root, 'public', 'assets', 'portraits', 'legacy-initiative.png'), 'legacy initiative'),
    writeFile(path.join(root, 'public', 'assets', 'portraits', 'wolf-rain-master.png'), 'master'),
    writeFile(path.join(root, 'public', 'assets', 'portraits', 'wolf-rain.png'), 'raw'),
    writeFile(path.join(root, 'public', 'assets', 'icons', 'move-action.png'), 'icon'),
    writeFile(path.join(root, 'public', 'assets', 'vfx', 'thunderwave-fluid.webp'), 'vfx'),
  ])
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

describe('art asset manifest generator', () => {
  it('keeps every checked-in monster portrait and visual variant in the runtime allowlist', async () => {
    const [enemyPool, manifestSource] = await Promise.all([
      readFile(path.join(repositoryRoot, 'src', 'lib', 'enemyPool.ts'), 'utf8'),
      readFile(
        path.join(repositoryRoot, 'public', 'runtime-assets', 'art-asset-pack.json'),
        'utf8',
      ),
    ])
    const manifest = JSON.parse(manifestSource) as {
      files: Array<{ path: string }>
      summary: {
        runtimeFiles: number
        catalogTokenPortraits: number
        catalogInitiativePortraits: number
      }
      collections: {
        authoring: {
          masters: Array<{ path: string }>
          raw: Array<{ path: string }>
        }
      }
    }
    const catalogUrls = [...new Set(
      [...enemyPool.matchAll(/(['"`])(\/assets\/portraits\/[^'"`\r\n]+)\1/g)]
        .map((match) => match[2]),
    )]
    const runtimeUrls = new Set(manifest.files.map((entry) => `/${entry.path}`))

    expect(catalogUrls).not.toHaveLength(0)
    expect(catalogUrls.filter((url) => !runtimeUrls.has(url))).toEqual([])
    expect(manifest.files).toHaveLength(manifest.summary.runtimeFiles)
    expect(manifest.summary.catalogTokenPortraits)
      .toBe(manifest.summary.catalogInitiativePortraits)
    expect([
      ...manifest.collections.authoring.masters,
      ...manifest.collections.authoring.raw,
    ].some((entry) => runtimeUrls.has(entry.path))).toBe(false)
  })

  it('classifies catalog, legacy, authoring, icon and VFX assets', async () => {
    const root = await fixtureRoot()
    execFileSync(
      process.execPath,
      [generator, '--root', root],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    const output = path.join(root, 'public', 'runtime-assets', 'art-asset-pack.json')
    const firstGeneration = await readFile(output, 'utf8')
    execFileSync(
      process.execPath,
      [generator, '--root', root],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    expect(await readFile(output, 'utf8')).toBe(firstGeneration)
    const manifest = JSON.parse(firstGeneration)

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      packId: 'astraltrace.dnd5e-2014.art',
      version: expect.stringMatching(/^content-[a-f0-9]{16}$/),
      assetBasePath: '/assets/',
      summary: {
        totalFiles: 8,
        runtimeFiles: 6,
        authoringFiles: 2,
        catalogTokenPortraits: 1,
        catalogInitiativePortraits: 1,
        legacyTokenDerivatives: 1,
        legacyInitiativeDerivatives: 1,
        authoringMasters: 1,
        authoringRaw: 1,
        icons: 1,
        vfx: 1,
      },
    })
    expect(manifest.collections.runtime.catalogPortraits.token[0].path)
      .toBe('/assets/portraits/wolf-rain-token.png')
    expect(manifest.collections.authoring.masters[0].path)
      .toBe('/assets/portraits/wolf-rain-master.png')
    expect(manifest.files).toHaveLength(6)
    expect(manifest.files).toContainEqual(expect.objectContaining({
      path: 'assets/portraits/wolf-rain-token.png',
      contentType: 'image/png',
    }))
    expect(manifest.files.some((entry: { path: string }) =>
      entry.path.endsWith('-master.png'))).toBe(false)
    expect(manifest.contentSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects unresolved Git LFS pointer files', async () => {
    const root = await fixtureRoot()
    await writeFile(
      path.join(root, 'public', 'assets', 'icons', 'move-action.png'),
      [
        'version https://git-lfs.github.com/spec/v1',
        `oid sha256:${'0'.repeat(64)}`,
        'size 1234',
        '',
      ].join('\n'),
    )
    const result = spawnSync(
      process.execPath,
      [generator, '--root', root],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Git LFS pointer detected')
  })

  it('rejects a missing enemy-pool literal asset before writing a manifest', async () => {
    const root = await fixtureRoot()
    await rm(path.join(root, 'public', 'assets', 'portraits', 'wolf-rain-token.png'))
    const result = spawnSync(
      process.execPath,
      [generator, '--root', root],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('enemyPool references a missing art asset')
  })

  it('fails check mode when the manifest is stale', async () => {
    const root = await fixtureRoot()
    execFileSync(
      process.execPath,
      [generator, '--root', root],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    const output = path.join(root, 'public', 'runtime-assets', 'art-asset-pack.json')
    await writeFile(output, '{}\n')
    const result = spawnSync(
      process.execPath,
      [generator, '--root', root, '--check'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Art asset manifest is stale')
  })
})
