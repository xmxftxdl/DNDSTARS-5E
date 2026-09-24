export const PACKAGE_SCHEMA_VERSION = 1 as const
export const PACKAGE_PERMISSIONS = [
  'compendium.read', 'compendium.write', 'character.read', 'character.write',
  'scene.read', 'scene.write', 'automation.register', 'network.external', 'localStorage', 'ui.extend',
] as const
export type PackagePermission = typeof PACKAGE_PERMISSIONS[number]
export const CONTENT_SOURCE_CATEGORIES = [
  'OfficialOpen', 'StarScarOriginal', 'Community', 'ThirdPartyLicensed', 'UserPrivate', 'RestrictedLicensed',
] as const
export type ContentSourceCategory = typeof CONTENT_SOURCE_CATEGORIES[number]
export interface PackageDependency { packageId: string; minimumVersion: string; versionRange?: string; optional?: boolean }
export interface StarScarPackageManifest {
  schemaVersion: 1
  packageId: string
  name: string
  author: string
  version: string
  minimumStarScarVersion: string
  systemId?: string
  systemVersion?: string
  contentSource: ContentSourceCategory
  license: string
  homepage?: string
  description?: string
  dependencies: readonly PackageDependency[]
  permissions: readonly PackagePermission[]
  localizations: readonly string[]
  /** SHA-256 hex hashes cover every archive file except the manifest itself. */
  files?: Readonly<Record<string, string>>
  distributionPolicy?: 'room-distributable' | 'room-ephemeral' | 'account-entitled' | 'local-only'
}
export interface PackageValidationContext {
  appVersion: string
  systemId?: string
  systemVersion?: string
  installed?: readonly { manifest: StarScarPackageManifest; enabled: boolean }[]
  replacingPackageId?: string
  checkDependencies?: boolean
}
export interface PackageValidationIssue { code: string; path: string; message: string }
export const PACKAGE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
export function isPackageVersion(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 120 && SEMVER.test(value)
}
export function comparePackageVersions(left: string, right: string): number {
  if (!isPackageVersion(left) || !isPackageVersion(right)) throw new Error('invalid-semantic-version')
  const a = SEMVER.exec(left)!, b = SEMVER.exec(right)!
  for (let i = 1; i <= 3; i++) {
    const difference = BigInt(a[i]) - BigInt(b[i])
    if (difference) return difference > 0n ? 1 : -1
  }
  if (!a[4] || !b[4]) return a[4] === b[4] ? 0 : a[4] ? -1 : 1
  const ap = a[4].split('.'), bp = b[4].split('.')
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if (ap[i] == null || bp[i] == null) return ap[i] == null ? -1 : 1
    if (ap[i] === bp[i]) continue
    const an = /^\d+$/.test(ap[i]), bn = /^\d+$/.test(bp[i])
    if (an && bn) return BigInt(ap[i]) > BigInt(bp[i]) ? 1 : -1
    if (an !== bn) return an ? -1 : 1
    return ap[i] > bp[i] ? 1 : -1
  }
  return 0
}
/** Parsing deliberately does not perform installation or compatibility checks. */
export function parsePackageManifest(text: string): unknown {
  try { return JSON.parse(text) } catch { throw new Error('manifest-json-invalid: manifest.json 不是有效 JSON') }
}
export function validatePackageManifest(value: unknown, context?: PackageValidationContext): PackageValidationIssue[] {
  const issues: PackageValidationIssue[] = []
  const fail = (code: string, path: string, message: string) => { issues.push({ code, path, message }) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('manifest-invalid', '', '清单必须为对象'); return issues
  }
  const m = value as Record<string, unknown>
  if (m.schemaVersion !== 1) fail('schema-unsupported', 'schemaVersion', '不支持的清单版本')
  if (typeof m.packageId !== 'string' || !PACKAGE_ID.test(m.packageId)) fail('package-id-invalid', 'packageId', '无效的包 ID')
  for (const field of ['name', 'author', 'license']) {
    if (typeof m[field] !== 'string' || !(m[field] as string).trim() || (m[field] as string).length > 500) fail('metadata-invalid', field, `缺少或无效的 ${field}`)
  }
  for (const field of ['description', 'homepage', 'systemId', 'systemVersion']) {
    if (m[field] != null && (typeof m[field] !== 'string' || !(m[field] as string).trim() || (m[field] as string).length > 8000)) fail('metadata-invalid', field, `无效的 ${field}`)
  }
  if (m.systemVersion != null && m.systemId == null) fail('system-invalid', 'systemId', '规则版本必须声明规则系统')
  for (const field of ['version', 'minimumStarScarVersion']) if (!isPackageVersion(m[field])) fail('version-invalid', field, '必须为有效语义版本')
  if (!(CONTENT_SOURCE_CATEGORIES as readonly unknown[]).includes(m.contentSource)) fail('source-invalid', 'contentSource', '未知来源类别')
  if (m.distributionPolicy != null && !['room-distributable', 'room-ephemeral', 'account-entitled', 'local-only'].includes(String(m.distributionPolicy))) fail('distribution-invalid', 'distributionPolicy', '未知分发策略')
  for (const field of ['permissions', 'localizations']) {
    const values = m[field]
    if (!Array.isArray(values) || values.length > 64 || new Set(values).size !== values.length) {
      fail('list-invalid', field, '需要无重复的列表'); continue
    }
    for (const item of values) {
      if (field === 'permissions' ? !(PACKAGE_PERMISSIONS as readonly unknown[]).includes(item)
        : typeof item !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(item)) fail('entry-invalid', field, `未知或无效的 ${field} 条目`)
    }
  }
  if (!Array.isArray(m.dependencies) || m.dependencies.length > 64) fail('dependencies-invalid', 'dependencies', '依赖必须为列表')
  else {
    const ids = new Set<string>()
    for (const d of m.dependencies) {
      if (!d || typeof d !== 'object' || typeof d.packageId !== 'string' || !PACKAGE_ID.test(d.packageId) || !isPackageVersion(d.minimumVersion) || (d.optional != null && typeof d.optional !== 'boolean') || (d.versionRange != null && !validPackageVersionRange(d.versionRange))) {
        fail('dependency-invalid', 'dependencies', '无效依赖'); continue
      }
      if (ids.has(d.packageId) || d.packageId === m.packageId) fail('dependency-invalid', 'dependencies', '重复或自引用依赖')
      ids.add(d.packageId)
    }
  }
  if (m.files != null && (!m.files || typeof m.files !== 'object' || Array.isArray(m.files) ||
    Object.entries(m.files).some(([path, hash]) => !safePackagePath(path) || path === 'manifest.json' || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)))) fail('files-invalid', 'files', '无效文件完整性表')
  if (issues.length || !context) return issues
  const manifest = value as StarScarPackageManifest
  if (!isPackageVersion(context.appVersion) || comparePackageVersions(context.appVersion, manifest.minimumStarScarVersion) < 0) fail('app-incompatible', 'minimumStarScarVersion', '应用版本过低')
  if (manifest.systemId && (manifest.systemId !== context.systemId || (manifest.systemVersion && manifest.systemVersion !== context.systemVersion))) fail('system-incompatible', 'systemId', '规则系统或版本不兼容')
  if (context.checkDependencies === false) return issues
  const installed = new Map((context.installed ?? []).map(p => [p.manifest.packageId, p]))
  if (installed.has(manifest.packageId) && context.replacingPackageId !== manifest.packageId) fail('package-duplicate', 'packageId', '此包已安装；需要明确执行更新')
  for (const d of manifest.dependencies) {
    const existing = installed.get(d.packageId)
    if (!existing && d.optional) continue
    if (!existing || !existing.enabled || !isPackageVersion(existing.manifest.version) || comparePackageVersions(existing.manifest.version, d.minimumVersion) < 0 || (d.versionRange != null && !packageVersionSatisfies(existing.manifest.version,d.versionRange))) fail('dependency-unavailable', 'dependencies', `依赖未安装、未启用或版本过低：${d.packageId}`)
  }
  const graph = new Map([...installed].map(([id, p]) => [id, p.manifest.dependencies]))
  graph.set(manifest.packageId, manifest.dependencies)
  const active = new Set<string>(), done = new Set<string>()
  const visit = (id: string): boolean => {
    if (active.has(id)) return true
    if (done.has(id)) return false
    active.add(id)
    for (const d of graph.get(id) ?? []) if (graph.has(d.packageId) && visit(d.packageId)) return true
    active.delete(id); done.add(id); return false
  }
  if (visit(manifest.packageId)) fail('dependency-cycle', 'dependencies', '存在循环依赖')
  return issues
}
export function safePackagePath(path: string): boolean {
  return path.length > 0 && path.length <= 240 && !/[\\:]/.test(path) && ![...path].some(c => c.charCodeAt(0) < 32) &&
    path.split('/').every(part => !!part && part !== '.' && part !== '..' && !/[ .]$/.test(part))
}
export function assertPackageManifest(value: unknown, context?: PackageValidationContext): asserts value is StarScarPackageManifest {
  const issues = validatePackageManifest(value, context)
  if (issues.length) throw new Error(issues.map(issue => `${issue.code} (${issue.path}): ${issue.message}`).join('\n'))
}

function rangeParts(range: unknown): string[][] | undefined {
 if(typeof range !== 'string' || range.length > 500 || !range.trim()) return undefined
 const parts = range.split('||').map(branch => branch.trim().split(/\s+/))
 return parts.every(branch => branch.length && branch.every(token => token === '*' || /^(?:[~^]|>=|<=|>|<|=)?/.test(token) && isPackageVersion(token.replace(/^(?:[~^]|>=|<=|>|<|=)/,'')))) ? parts : undefined
}
export function validPackageVersionRange(range: unknown): range is string { return !!rangeParts(range) }
export function packageVersionSatisfies(version: string, range: string): boolean {
 if (!isPackageVersion(version)) return false
 const parts = rangeParts(range)
 if (!parts) return false
 return parts.some(branch => branch.every(token => {
  if(token === '*') return true
  const operator = /^(?:[~^]|>=|<=|>|<|=)/.exec(token)?.[0] ?? '='
  const expected = token.replace(/^(?:[~^]|>=|<=|>|<|=)/,'')
  const comparison = comparePackageVersions(version,expected)
  if(operator === '>') return comparison > 0
  if(operator === '>=') return comparison >= 0
  if(operator === '<') return comparison < 0
  if(operator === '<=') return comparison <= 0
  if(operator === '=') return comparison === 0
  if(comparison < 0) return false
  const [major,minor,patch] = expected.split(/[.+-]/).slice(0,3).map(BigInt)
  const upper = operator === '~' ? `${major}.${minor+1n}.0` : major > 0n ? `${major+1n}.0.0` : minor > 0n ? `0.${minor+1n}.0` : `0.0.${patch+1n}`
  return comparePackageVersions(version,upper) < 0
 }))
}
