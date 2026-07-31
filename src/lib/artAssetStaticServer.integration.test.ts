/// <reference types="node" />
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(__dirname, '..', '..')
const staticServerScript = path.join(repositoryRoot, 'scripts', 'static-server.mjs')
const manifestGeneratorScript = path.join(
  repositoryRoot,
  'scripts',
  'generate-art-asset-manifest.mjs',
)
const host = '127.0.0.1'

interface RunningServer {
  process: ChildProcess
  baseUrl: string
  stderr: () => string
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function availablePort() {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, host, resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Failed to reserve an integration-test port')
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

async function runNode(script: string, argumentsList: string[], cwd: string) {
  const child = spawn(process.execPath, [script, ...argumentsList], {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
  child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  const code = await new Promise<number | null>((resolve) => child.once('exit', resolve))
  if (code !== 0) {
    throw new Error(`Node command failed (${code}):\n${stdout}\n${stderr}`)
  }
}

async function startStaticServer(options: {
  distRoot: string
  sharedRoot: string
  artRoot?: string
  manifestPath?: string
  manifestSha256?: string
  required?: boolean
}) {
  const port = await availablePort()
  const child = spawn(process.execPath, [
    staticServerScript,
    '--host',
    host,
    '--port',
    String(port),
    '--root',
    options.distRoot,
  ], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      STARS_ACCOUNT_STORAGE: 'json',
      STARS_SECURITY_MODE: 'development',
      STARS_SHARED_ROOT: options.sharedRoot,
      STARS_ART_ASSET_ROOT: options.artRoot ?? '',
      STARS_ART_ASSET_MANIFEST_PATH: options.manifestPath ?? '',
      STARS_ART_ASSET_MANIFEST_SHA256: options.manifestSha256 ?? '',
      STARS_REQUIRE_ART_ASSET_PACK: options.required ? 'true' : 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  child.stdout?.resume()
  const baseUrl = `http://${host}:${port}`
  const deadline = Date.now() + 10_000
  for (;;) {
    if (child.exitCode != null) {
      throw new Error(`Static server exited before readiness (${child.exitCode}):\n${stderr}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/readyz`)
      if (response.ok) break
    } catch {
      // Startup races are expected while the child validates its fixture pack.
    }
    if (Date.now() >= deadline) {
      child.kill('SIGTERM')
      throw new Error(`Static server did not become ready:\n${stderr}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return { process: child, baseUrl, stderr: () => stderr } satisfies RunningServer
}

async function stopStaticServer(server: RunningServer | undefined) {
  if (!server || server.process.exitCode != null) return
  const exited = new Promise<void>((resolve) => server.process.once('exit', () => resolve()))
  server.process.kill('SIGTERM')
  await Promise.race([
    exited,
    new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
  ])
}

let fixtureRoot = ''
let runningServer: RunningServer | undefined
let tokenBytes = Buffer.alloc(0)

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-art-static-'))
  const sourceRoot = path.join(fixtureRoot, 'src', 'lib')
  const publicRoot = path.join(fixtureRoot, 'public')
  const portraitRoot = path.join(publicRoot, 'assets', 'portraits')
  const distRoot = path.join(fixtureRoot, 'dist')
  const sharedRoot = path.join(fixtureRoot, 'shared')
  await Promise.all([
    mkdir(sourceRoot, { recursive: true }),
    mkdir(portraitRoot, { recursive: true }),
    mkdir(path.join(publicRoot, 'assets', 'icons'), { recursive: true }),
    mkdir(path.join(publicRoot, 'assets', 'vfx'), { recursive: true }),
    mkdir(path.join(distRoot, 'runtime-assets'), { recursive: true }),
    mkdir(sharedRoot, { recursive: true }),
  ])

  tokenBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x74, 0x6f, 0x6b, 0x65, 0x6e, 0x2d, 0x61, 0x72, 0x74,
  ])
  const initiativeBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x69, 0x6e, 0x69, 0x74, 0x69, 0x61, 0x74, 0x69, 0x76, 0x65,
  ])
  await Promise.all([
    writeFile(
      path.join(sourceRoot, 'enemyPool.ts'),
      [
        "export const fixtureMonster = {",
        "  tokenImage: '/assets/portraits/fixture-token.png',",
        "  initiativeImage: '/assets/portraits/fixture-initiative.png',",
        '}',
        '',
      ].join('\n'),
    ),
    writeFile(path.join(portraitRoot, 'fixture-token.png'), tokenBytes),
    writeFile(path.join(portraitRoot, 'fixture-initiative.png'), initiativeBytes),
    writeFile(path.join(distRoot, 'index.html'), '<!doctype html><title>fixture</title>'),
  ])

  await runNode(manifestGeneratorScript, ['--root', fixtureRoot], repositoryRoot)
  const generatedManifest = path.join(
    publicRoot,
    'runtime-assets',
    'art-asset-pack.json',
  )
  const pinnedManifest = path.join(distRoot, 'runtime-assets', 'art-asset-pack.json')
  await copyFile(generatedManifest, pinnedManifest)
  const manifestBytes = await readFile(pinnedManifest)

  runningServer = await startStaticServer({
    distRoot,
    sharedRoot,
    artRoot: publicRoot,
    manifestPath: pinnedManifest,
    manifestSha256: sha256(manifestBytes),
    required: true,
  })
}, 30_000)

afterAll(async () => {
  await stopStaticServer(runningServer)
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
})

describe('external art pack static-server integration', () => {
  it('serves unchanged /assets URLs with GET, HEAD, range and conditional caching', async () => {
    const assetUrl = `${runningServer!.baseUrl}/assets/portraits/fixture-token.png`
    const getResponse = await fetch(assetUrl)
    expect(getResponse.status).toBe(200)
    expect(Buffer.from(await getResponse.arrayBuffer())).toEqual(tokenBytes)
    expect(getResponse.headers.get('content-type')).toBe('image/png')
    expect(getResponse.headers.get('content-length')).toBe(String(tokenBytes.length))
    const etag = getResponse.headers.get('etag')
    expect(etag).toBe(`"sha256-${sha256(tokenBytes)}"`)

    const headResponse = await fetch(assetUrl, { method: 'HEAD' })
    expect(headResponse.status).toBe(200)
    expect(headResponse.headers.get('content-length')).toBe(String(tokenBytes.length))
    expect(await headResponse.text()).toBe('')

    const rangeResponse = await fetch(assetUrl, {
      headers: { Range: 'bytes=2-6' },
    })
    expect(rangeResponse.status).toBe(206)
    expect(rangeResponse.headers.get('content-range')).toBe(
      `bytes 2-6/${tokenBytes.length}`,
    )
    expect(Buffer.from(await rangeResponse.arrayBuffer())).toEqual(tokenBytes.subarray(2, 7))

    const notModified = await fetch(assetUrl, {
      headers: { 'If-None-Match': etag! },
    })
    expect(notModified.status).toBe(304)
    expect(await notModified.text()).toBe('')
  })

  it('returns a real 404 for an unlisted controlled asset instead of the SPA shell', async () => {
    const response = await fetch(
      `${runningServer!.baseUrl}/assets/portraits/missing-token.png`,
    )
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found')
  })

  it('reports only non-sensitive pack health in readyz', async () => {
    const response = await fetch(`${runningServer!.baseUrl}/api/readyz`)
    expect(response.status).toBe(200)
    const payload = await response.json() as Record<string, unknown>
    expect(payload).toMatchObject({
      status: 'ready',
      artAssets: {
        status: 'ready',
        required: true,
        packId: 'astraltrace.dnd5e-2014.art',
        fileCount: 2,
        contentVerified: true,
      },
    })
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain(fixtureRoot)
    expect(serialized).not.toContain('art-asset-pack.json')
  })
})

describe('required art pack startup boundary', () => {
  it('keeps the app diagnosable but returns 503 for art when an optional configured pack is unavailable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'stars-art-optional-'))
    let server: RunningServer | undefined
    try {
      const distRoot = path.join(root, 'dist')
      const artRoot = path.join(root, 'public')
      const sharedRoot = path.join(root, 'shared')
      await Promise.all([
        mkdir(distRoot, { recursive: true }),
        mkdir(artRoot, { recursive: true }),
        mkdir(sharedRoot, { recursive: true }),
      ])
      await writeFile(path.join(distRoot, 'index.html'), '<title>diagnostic shell</title>')
      server = await startStaticServer({
        distRoot,
        sharedRoot,
        artRoot,
        required: false,
      })

      const ready = await fetch(`${server.baseUrl}/api/readyz`)
      expect(ready.status).toBe(200)
      await expect(ready.json()).resolves.toMatchObject({
        status: 'ready',
        artAssets: {
          status: 'unavailable',
          required: false,
          error: 'art-asset-manifest-unavailable',
        },
      })
      const asset = await fetch(
        `${server.baseUrl}/assets/portraits/missing-pack-token.png`,
      )
      expect(asset.status).toBe(503)
      expect(await asset.text()).toBe('Art Asset Pack Unavailable')
    } finally {
      await stopStaticServer(server)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails before listening when a required pack cannot be loaded', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'stars-art-required-'))
    try {
      const distRoot = path.join(root, 'dist')
      const artRoot = path.join(root, 'public')
      const sharedRoot = path.join(root, 'shared')
      await Promise.all([
        mkdir(distRoot, { recursive: true }),
        mkdir(artRoot, { recursive: true }),
        mkdir(sharedRoot, { recursive: true }),
      ])
      await writeFile(path.join(distRoot, 'index.html'), '<title>must not start</title>')
      const port = await availablePort()
      const child = spawn(process.execPath, [
        staticServerScript,
        '--host',
        host,
        '--port',
        String(port),
        '--root',
        distRoot,
      ], {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          STARS_ACCOUNT_STORAGE: 'json',
          STARS_SECURITY_MODE: 'development',
          STARS_SHARED_ROOT: sharedRoot,
          STARS_ART_ASSET_ROOT: artRoot,
          STARS_ART_ASSET_MANIFEST_PATH: '',
          STARS_ART_ASSET_MANIFEST_SHA256: '',
          STARS_REQUIRE_ART_ASSET_PACK: 'true',
        },
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
      const code = await Promise.race([
        new Promise<number | null>((resolve) => child.once('exit', resolve)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Required-pack server unexpectedly stayed alive')), 5_000)),
      ])
      expect(code).not.toBe(0)
      expect(stderr).toContain('art-asset-manifest-unavailable')
      await expect(fetch(`http://${host}:${port}/api/readyz`)).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
