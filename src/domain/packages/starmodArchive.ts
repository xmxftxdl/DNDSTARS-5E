import { Unzip, UnzipInflate, strToU8, strFromU8, zipSync } from 'fflate'
import { assertPackageManifest, parsePackageManifest, safePackagePath, type StarScarPackageManifest } from './packageManifest'
import { validateCompendiumEntries, type CompendiumEntry } from './compendium'

const MAX_ARCHIVE = 32 * 1024 * 1024
const MAX_EXPANDED = 48 * 1024 * 1024
const MAX_FILE = 8 * 1024 * 1024
function validateZipDirectory(bytes: ArrayBuffer): void {
  const view = new DataView(bytes), input = new Uint8Array(bytes)
  let end = -1
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65557); offset--) {
    if (view.getUint32(offset,true) === 0x06054b50 && offset + 22 + view.getUint16(offset+20,true) === bytes.byteLength) { end=offset; break }
  }
  if (end < 0 || view.getUint16(end+4,true) || view.getUint16(end+6,true)) throw new Error('archive-directory-invalid')
  const count=view.getUint16(end+10,true), size=view.getUint32(end+12,true), start=view.getUint32(end+16,true)
  if (!count || count > 4096 || count !== view.getUint16(end+8,true) || start+size !== end) throw new Error('archive-directory-invalid')
  let offset=start, expanded=0
  const names=new Set<string>()
  for(let i=0;i<count;i++) {
    if(offset+46 > end || view.getUint32(offset,true) !== 0x02014b50) throw new Error('archive-directory-invalid')
    const flags=view.getUint16(offset+8,true), method=view.getUint16(offset+10,true)
    const length=view.getUint16(offset+28,true), extra=view.getUint16(offset+30,true), comment=view.getUint16(offset+32,true)
    const original=view.getUint32(offset+24,true), local=view.getUint32(offset+42,true)
    if(original>MAX_FILE) throw new Error('archive-file-too-large')
    if(offset+46+length+extra+comment > end || (flags&1) || ![0,8].includes(method) || local+30>start || view.getUint32(local,true)!==0x04034b50) throw new Error('archive-entry-invalid')
    const path=strFromU8(input.subarray(offset+46,offset+46+length)), name=path.replace(/\/$/,'')
    const localLength=view.getUint16(local+26,true), localExtra=view.getUint16(local+28,true)
    const localName=strFromU8(input.subarray(local+30,local+30+localLength))
    const mode=(view.getUint32(offset+38,true)>>>16)&0xf000
    if (!safePackagePath(name) || names.has(name.toLowerCase()) || localName!==path || mode===0xa000 || local+30+localLength+localExtra+view.getUint32(offset+20,true)>start) throw new Error('archive-path-invalid-or-duplicate')
    names.add(name.toLowerCase()); expanded+=original
    if(expanded>MAX_EXPANDED) throw new Error('archive-expanded-too-large')
    offset+=46+length+extra+comment
  }
  if(offset!==end) throw new Error('archive-directory-invalid')
}
export interface StarModPackage {
  compatibility?: unknown
  manifest: StarScarPackageManifest
  entries: readonly CompendiumEntry[]
  localizations: Readonly<Record<string, Readonly<Record<string, string>>>>
  assets: Readonly<Record<string, Uint8Array>>
}
export function isStarModArchive(bytes: ArrayBuffer): boolean {
  const b = new Uint8Array(bytes)
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b
}
async function hash(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
export async function readStarModArchive(bytes: ArrayBuffer): Promise<StarModPackage> {
  if (!isStarModArchive(bytes) || bytes.byteLength > MAX_ARCHIVE) throw new Error('archive-invalid-or-too-large')
  validateZipDirectory(bytes)
  const files = new Map<string, Uint8Array>(), names = new Set<string>()
  let total = 0, pending = 0, failure: Error | undefined
  const unzip = new Unzip(file => {
    const directory = file.name.endsWith('/')
    const name = directory ? file.name.slice(0, -1) : file.name
    const key = name.toLowerCase()
    if (!safePackagePath(name) || names.has(key) || names.size >= 4096) throw new Error('archive-path-invalid-or-duplicate')
    names.add(key)
    if (directory) { file.terminate(); return }
    if (file.originalSize != null && file.originalSize > MAX_FILE) throw new Error('archive-file-too-large')
    pending++
    let size = 0
    const chunks: Uint8Array[] = []
    file.ondata = (error, data, final) => {
      if (error) { failure = error; return }
      size += data.length; total += data.length
      if (size > MAX_FILE || total > MAX_EXPANDED) { file.terminate(); throw new Error('archive-expanded-too-large') }
      chunks.push(data)
      if (final) {
        const joined = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length }
        files.set(name, joined); pending--
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  const input = new Uint8Array(bytes)
  for (let offset = 0; offset < input.length; offset += 4096) {
    unzip.push(input.subarray(offset, offset + 4096), offset + 4096 >= input.length)
    if (failure) throw failure
  }
  if (pending || !files.has('manifest.json')) throw new Error('archive-incomplete-or-manifest-missing')
  const manifest = parsePackageManifest(strFromU8(files.get('manifest.json')!))
  assertPackageManifest(manifest)
  const automationFiles = new Map<string, CompendiumEntry['automationData']>()
  let compatibility: unknown
  const entries: CompendiumEntry[] = [], localizations: Record<string, Record<string, string>> = Object.create(null), assets: Record<string, Uint8Array> = Object.create(null)
  for (const [path, data] of files) {
    if (path === 'manifest.json') continue
    if (!manifest.files?.[path] || await hash(data) !== manifest.files[path]) throw new Error(`archive-integrity-failed: ${path}`)
    if (path === 'compatibility/dnd5e-content-v2.json') {
      compatibility = JSON.parse(strFromU8(data))
    } else if (/^compendium\/[a-z-]+\.json$/.test(path)) {
      const parsed: unknown = JSON.parse(strFromU8(data))
      validateCompendiumEntries(parsed, manifest.packageId)
      entries.push(...parsed)
    } else if (/^automation\/[a-z0-9._-]+\.json$/.test(path)) {
      automationFiles.set(path, JSON.parse(strFromU8(data)))
    } else if (/^localization\/[A-Za-z0-9-]+\.json$/.test(path)) {
      const locale = path.slice('localization/'.length, -5)
      if (!manifest.localizations.includes(locale)) throw new Error('localization-undeclared')
      const parsed = JSON.parse(strFromU8(data))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.entries(parsed).some(([key, v]) => key.length > 300 || typeof v !== 'string' || v.length > 100000)) throw new Error('localization-invalid')
      localizations[locale] = parsed
    } else if (/^assets\/.+\.(png|jpg|jpeg|webp)$/.test(path)) assets[path] = data
    else throw new Error(`archive-file-unsupported: ${path}`)
  }
  for (const path of Object.keys(manifest.files ?? {})) if (!files.has(path)) throw new Error(`archive-file-missing: ${path}`)
  for (const locale of manifest.localizations) if (!localizations[locale]) throw new Error(`localization-missing: ${locale}`)
  for (const entry of entries) {
    if (!entry.automationFile) continue
    const data = automationFiles.get(entry.automationFile)
    if (!data) throw new Error('automation-file-missing')
    delete entry.automationFile
    entry.automationData = data
  }
  validateCompendiumEntries(entries, manifest.packageId)
  for (const entry of entries) {
    if (manifest.systemId && entry.systemId !== manifest.systemId) throw new Error('entry-system-mismatch')
    for (const path of entry.assetReferences) if (!assets[path]) throw new Error('entry-asset-missing')
  }
  return { manifest, entries, localizations, assets, ...(compatibility == null ? {} : { compatibility }) }
}
export async function writeStarModArchive(value: StarModPackage): Promise<ArrayBuffer> {
  assertPackageManifest(value.manifest)
  validateCompendiumEntries(value.entries, value.manifest.packageId)
  const files: Record<string, Uint8Array> = Object.create(null)
  const storedEntries = value.entries.map(entry => {
    if (!entry.automationData) return entry
    const path = `automation/${entry.type.toLowerCase()}-${entry.id}.json`
    files[path] = strToU8(JSON.stringify(entry.automationData))
    const rest = {...entry}
    delete rest.automationData
    return {...rest,automationFile:path}
  })
  files['compendium/entries.json'] = strToU8(JSON.stringify(storedEntries))
  for (const [locale, dictionary] of Object.entries(value.localizations)) {
    if (!value.manifest.localizations.includes(locale)) throw new Error('localization-undeclared')
    files[`localization/${locale}.json`] = strToU8(JSON.stringify(dictionary))
  }
  for (const [path, data] of Object.entries(value.assets)) {
    if (!safePackagePath(path) || !/^assets\/.+\.(png|jpg|jpeg|webp)$/.test(path)) throw new Error('asset-path-invalid')
    files[path] = data
  }
  if (value.compatibility != null) files['compatibility/dnd5e-content-v2.json'] = strToU8(JSON.stringify(value.compatibility))
  const hashes: Record<string, string> = {}
  for (const [path, data] of Object.entries(files)) hashes[path] = await hash(data)
  files['manifest.json'] = strToU8(JSON.stringify({ ...value.manifest, files: hashes }))
  const bytes = new Uint8Array(zipSync(files, { level: 6 })).buffer
  await readStarModArchive(bytes)
  return bytes
}
