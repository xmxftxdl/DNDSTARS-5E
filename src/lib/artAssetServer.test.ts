import { createHash } from 'node:crypto'
import { createServer, request, type Server } from 'node:http'
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  loadArtAssetPack,
  parseSingleByteRange,
  serveArtAsset,
  type ArtAssetPack,
} from '../../scripts/art-asset-server.mjs'

const temporaryRoots: string[] = []
const servers: Server[] = []

interface TestPack {
  root: string
  bytes: Buffer
  manifestBytes: Buffer
  pack: ArtAssetPack
}

async function temporaryDirectory(prefix: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix))
  temporaryRoots.push(root)
  return root
}

function digest(value: Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

async function createTestPack(): Promise<TestPack> {
  const root = await temporaryDirectory('dndstars-art-pack-')
  const portraits = path.join(root, 'assets', 'portraits')
  const runtimeAssets = path.join(root, 'runtime-assets')
  await mkdir(portraits, { recursive: true })
  await mkdir(runtimeAssets, { recursive: true })
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6])
  await writeFile(path.join(portraits, 'hero-token.png'), bytes)
  await writeFile(path.join(portraits, 'unlisted.png'), Buffer.from('not allowlisted'))
  const manifestBytes = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    packId: 'srd-art',
    version: '2026.07.30',
    files: [{
      path: 'assets/portraits/hero-token.png',
      bytes: bytes.length,
      sha256: digest(bytes),
      contentType: 'image/png',
    }],
  }))
  await writeFile(path.join(runtimeAssets, 'art-asset-pack.json'), manifestBytes)
  const pack = await loadArtAssetPack({
    root,
    expectedManifestSha256: digest(manifestBytes),
  })
  return { root, bytes, manifestBytes, pack }
}

async function listen(pack: ArtAssetPack) {
  const server = createServer((req, res) => {
    void serveArtAsset(req, res, pack).then((handled) => {
      if (handled) return
      res.writeHead(418, { 'Content-Type': 'text/plain' })
      res.end('unhandled')
    }).catch((error) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(String(error))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('test server did not bind')
  return address.port
}

function httpRequest(
  port: number,
  requestPath: string,
  options: { method?: string; headers?: Record<string, string> } = {},
) {
  return new Promise<{
    status: number
    headers: Record<string, string | string[] | undefined>
    body: Buffer
  }>((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method: options.method ?? 'GET',
      headers: {
        Connection: 'close',
        ...options.headers,
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))))
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

describe('art asset pack manifest', () => {
  it('loads a pinned manifest and exposes only non-sensitive pack metadata', async () => {
    const { pack, manifestBytes } = await createTestPack()
    expect(pack).toMatchObject({
      schemaVersion: 1,
      packId: 'srd-art',
      version: '2026.07.30',
      manifestSha256: digest(manifestBytes),
      publicPrefix: '/assets',
      allowedDirectories: ['assets/portraits', 'assets/icons', 'assets/vfx'],
      cacheControl: 'public, max-age=0, must-revalidate',
      contentVerified: true,
      fileCount: 1,
    })
    expect(Object.isFrozen(pack)).toBe(true)
  })

  it('rejects a bad manifest digest, duplicate path, size mismatch, and MIME mismatch', async () => {
    const { root, bytes } = await createTestPack()
    await expect(loadArtAssetPack({
      root,
      expectedManifestSha256: '0'.repeat(64),
    })).rejects.toMatchObject({ code: 'art-asset-manifest-digest-mismatch' })

    const cases = [
      {
        files: [
          {
            path: 'assets/portraits/hero-token.png',
            bytes: bytes.length,
            sha256: digest(bytes),
            contentType: 'image/png',
          },
          {
            path: 'assets/portraits/hero-token.png',
            bytes: bytes.length,
            sha256: digest(bytes),
            contentType: 'image/png',
          },
        ],
        code: 'duplicate-art-asset-path',
      },
      {
        files: [{
          path: 'assets/portraits/hero-token.png',
          bytes: bytes.length + 1,
          sha256: digest(bytes),
          contentType: 'image/png',
        }],
        code: 'art-asset-size-mismatch',
      },
      {
        files: [{
          path: 'assets/portraits/hero-token.png',
          bytes: bytes.length,
          sha256: digest(bytes),
          contentType: 'image/webp',
        }],
        code: 'invalid-art-asset-content-type',
      },
    ]
    for (const testCase of cases) {
      await writeFile(path.join(root, 'runtime-assets', 'art-asset-pack.json'), JSON.stringify({
        schemaVersion: 1,
        packId: 'srd-art',
        version: 'test',
        files: testCase.files,
      }))
      await expect(loadArtAssetPack({ root })).rejects.toMatchObject({ code: testCase.code })
    }
  })

  it('hashes file contents and rejects same-size tampering by default', async () => {
    const { root, bytes } = await createTestPack()
    const tampered = Buffer.from(bytes)
    tampered[tampered.length - 1] ^= 0xff
    await writeFile(path.join(root, 'assets', 'portraits', 'hero-token.png'), tampered)
    await expect(loadArtAssetPack({ root }))
      .rejects.toMatchObject({ code: 'art-asset-digest-mismatch' })

    await expect(loadArtAssetPack({ root, verifyContent: false }))
      .resolves.toMatchObject({ contentVerified: false, fileCount: 1 })
  })

  it('allows an explicitly trusted external manifest but rejects asset symlinks outside the root', async () => {
    const { root, bytes } = await createTestPack()
    const outside = await temporaryDirectory('dndstars-art-outside-')
    const outsideManifest = path.join(outside, 'outside-manifest.json')
    await writeFile(outsideManifest, JSON.stringify({
      schemaVersion: 1,
      packId: 'outside',
      version: 'test',
      files: [{
        path: 'assets/portraits/hero-token.png',
        bytes: bytes.length,
        sha256: digest(bytes),
        contentType: 'image/png',
      }],
    }))
    await expect(loadArtAssetPack({
      root,
      manifestPath: outsideManifest,
    })).resolves.toMatchObject({ packId: 'outside', fileCount: 1 })

    await mkdir(path.join(outside, 'files'), { recursive: true })
    await writeFile(path.join(outside, 'files', 'escaped.png'), bytes)
    const linkPath = path.join(root, 'assets', 'portraits', 'escape')
    try {
      await symlink(
        path.join(outside, 'files'),
        linkPath,
        process.platform === 'win32' ? 'junction' : 'dir',
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') return
      throw error
    }
    await writeFile(path.join(root, 'runtime-assets', 'art-asset-pack.json'), JSON.stringify({
      schemaVersion: 1,
      packId: 'srd-art',
      version: 'test',
      files: [{
        path: 'assets/portraits/escape/escaped.png',
        bytes: bytes.length,
        sha256: digest(bytes),
        contentType: 'image/png',
      }],
    }))
    await expect(loadArtAssetPack({ root }))
      .rejects.toMatchObject({ code: 'art-asset-symlink-outside-root' })
  })
})

describe('single byte range parser', () => {
  it.each([
    [undefined, 10, { kind: 'none' }],
    ['bytes=0-0', 10, { kind: 'range', start: 0, end: 0 }],
    ['bytes=3-', 10, { kind: 'range', start: 3, end: 9 }],
    ['bytes=-4', 10, { kind: 'range', start: 6, end: 9 }],
    ['bytes=3-99', 10, { kind: 'range', start: 3, end: 9 }],
    ['bytes=10-', 10, { kind: 'invalid' }],
    ['bytes=4-3', 10, { kind: 'invalid' }],
    ['bytes=0-1,4-5', 10, { kind: 'invalid' }],
    ['items=0-1', 10, { kind: 'invalid' }],
  ] as const)('parses %s against %i bytes', (header, size, expected) => {
    expect(parseSingleByteRange(header, size)).toEqual(expected)
  })
})

describe('art asset HTTP serving', () => {
  it('serves GET/HEAD with MIME, length, strong ETag, and conditional 304', async () => {
    const { pack, bytes } = await createTestPack()
    const port = await listen(pack)
    const full = await httpRequest(port, '/assets/portraits/hero-token.png?cache-bust=1')
    expect(full.status).toBe(200)
    expect(full.body).toEqual(bytes)
    expect(full.headers['content-type']).toBe('image/png')
    expect(full.headers['content-length']).toBe(String(bytes.length))
    expect(full.headers['accept-ranges']).toBe('bytes')
    expect(full.headers['cache-control']).toBe('public, max-age=0, must-revalidate')
    expect(full.headers.etag).toBe(`"sha256-${digest(bytes)}"`)
    expect(full.headers['x-content-type-options']).toBe('nosniff')

    const head = await httpRequest(port, '/assets/portraits/hero-token.png', {
      method: 'HEAD',
    })
    expect(head.status).toBe(200)
    expect(head.body).toHaveLength(0)
    expect(head.headers['content-length']).toBe(String(bytes.length))

    const notModified = await httpRequest(port, '/assets/portraits/hero-token.png', {
      headers: { 'If-None-Match': `W/"sha256-${digest(bytes)}"` },
    })
    expect(notModified.status).toBe(304)
    expect(notModified.body).toHaveLength(0)
  })

  it('serves a single range and rejects invalid or multipart ranges', async () => {
    const { pack, bytes } = await createTestPack()
    const port = await listen(pack)
    const partial = await httpRequest(port, '/assets/portraits/hero-token.png', {
      headers: { Range: 'bytes=2-5' },
    })
    expect(partial.status).toBe(206)
    expect(partial.body).toEqual(bytes.subarray(2, 6))
    expect(partial.headers['content-range']).toBe(`bytes 2-5/${bytes.length}`)
    expect(partial.headers['content-length']).toBe('4')

    const suffix = await httpRequest(port, '/assets/portraits/hero-token.png', {
      headers: { Range: 'bytes=-3' },
    })
    expect(suffix.status).toBe(206)
    expect(suffix.body).toEqual(bytes.subarray(bytes.length - 3))

    for (const range of ['bytes=999-', 'bytes=4-2', 'bytes=0-1,4-5']) {
      const invalid = await httpRequest(port, '/assets/portraits/hero-token.png', {
        headers: { Range: range },
      })
      expect(invalid.status).toBe(416)
      expect(invalid.headers['content-range']).toBe(`bytes */${bytes.length}`)
      expect(invalid.body).toHaveLength(0)
    }

    const ignored = await httpRequest(port, '/assets/portraits/hero-token.png', {
      headers: {
        Range: 'bytes=0-1',
        'If-Range': '"different-etag"',
      },
    })
    expect(ignored.status).toBe(200)
    expect(ignored.body).toEqual(bytes)
  })

  it('returns explicit errors for controlled paths and leaves Vite chunks unhandled', async () => {
    const { pack } = await createTestPack()
    const port = await listen(pack)
    expect((await httpRequest(port, '/assets/portraits/unlisted.png')).status).toBe(404)
    expect((await httpRequest(port, '/assets/main-build-hash.js')).status).toBe(418)

    const method = await httpRequest(port, '/assets/portraits/hero-token.png', {
      method: 'POST',
    })
    expect(method.status).toBe(405)
    expect(method.headers.allow).toBe('GET, HEAD')

    for (const invalidPath of [
      '/assets/portraits/%2e%2e/secret.png',
      '/assets/portraits%2f..%2fsecret.png',
      '/assets/portraits/%255csecret.png',
      '/assets/portraits/%00secret.png',
    ]) {
      expect((await httpRequest(port, invalidPath)).status).toBe(400)
    }
  })

  it('fails closed if an allowlisted file changes size after startup', async () => {
    const { pack, root } = await createTestPack()
    const port = await listen(pack)
    await writeFile(path.join(root, 'assets', 'portraits', 'hero-token.png'), Buffer.from('changed'))
    const response = await httpRequest(port, '/assets/portraits/hero-token.png')
    expect(response.status).toBe(503)
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('fails closed if an allowlisted file changes with the same size after startup', async () => {
    const { pack, root, bytes } = await createTestPack()
    const port = await listen(pack)
    const tampered = Buffer.from(bytes)
    tampered[0] ^= 0xff
    const filename = path.join(root, 'assets', 'portraits', 'hero-token.png')
    await writeFile(filename, tampered)
    const future = new Date(Date.now() + 5_000)
    await utimes(filename, future, future)
    const response = await httpRequest(port, '/assets/portraits/hero-token.png')
    expect(response.status).toBe(503)
    expect(response.headers['cache-control']).toBe('no-store')
  })
})
