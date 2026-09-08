import { createHash, sign as signPackage } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(projectRoot, 'dist')
const outputRoot = path.join(projectRoot, 'artifacts', 'desktop-client')
const config = JSON.parse(await readFile(path.join(projectRoot, 'desktop', 'release-config.json'), 'utf8'))
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))

async function collectFiles(root, relative = '') {
  const files = {}
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    const nextRelative = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) Object.assign(files, await collectFiles(root, nextRelative))
    else if (entry.isFile()) files[nextRelative] = new Uint8Array(await readFile(path.join(root, ...nextRelative.split('/'))))
  }
  return files
}

async function optionalSigningKey() {
  const configured = String(process.env.ASTRALTRACE_DESKTOP_RELEASE_PRIVATE_KEY ?? '').trim()
  if (!configured) return null
  if (configured.includes('BEGIN PRIVATE KEY')) return configured.replaceAll('\\n', '\n')
  return readFile(path.resolve(configured), 'utf8')
}

const protocolSource = await readFile(path.join(projectRoot, 'src', 'lib', 'sharedProtocolVersion.ts'), 'utf8')
const sourceProtocolVersion = Number(protocolSource.match(/CLIENT_SHARED_PROTOCOL_VERSION\s*=\s*(\d+)/)?.[1])
if (sourceProtocolVersion !== config.protocolVersion) {
  throw new Error(`desktop protocol ${config.protocolVersion} does not match client protocol ${sourceProtocolVersion}`)
}
if (packageJson.version !== config.shellVersion) {
  throw new Error(`desktop shell version ${config.shellVersion} does not match package version ${packageJson.version}`)
}
await stat(path.join(distRoot, 'index.html'))
const archive = Buffer.from(zipSync(await collectFiles(distRoot), { level: 9 }))
const sha256 = createHash('sha256').update(archive).digest('hex')
const signingKey = await optionalSigningKey()
const signature = signingKey ? signPackage(null, archive, signingKey).toString('base64') : undefined
const archiveName = 'AstralTrace-client-win32-x64.zip'
const manifest = {
  schemaVersion: 1,
  service: 'astraltrace-desktop-client',
  channel: config.channel,
  platform: 'win32',
  arch: 'x64',
  version: config.clientVersion,
  protocolVersion: config.protocolVersion,
  minimumShellVersion: config.shellVersion,
  publishedAt: new Date().toISOString(),
  package: {
    url: `https://github.com/xmxftxdl/DNDSTARS-5E/releases/latest/download/${archiveName}`,
    sha256,
    ...(signature ? { signature } : {}),
  },
}

await mkdir(outputRoot, { recursive: true })
await writeFile(path.join(outputRoot, archiveName), archive)
await writeFile(
  path.join(outputRoot, 'desktop-client-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
)
console.log(`Desktop client ${manifest.version}: ${Math.round(archive.length / 1024 / 1024)} MiB`)
console.log(`SHA-256: ${sha256}`)
