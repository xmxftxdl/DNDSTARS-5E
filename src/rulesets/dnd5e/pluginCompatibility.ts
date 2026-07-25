import { CLIENT_SHARED_PROTOCOL_VERSION } from '../../lib/sharedProtocol'
import type {
  Dnd5ePluginDeclaredCapability,
  Dnd5ePluginDependency,
  Dnd5ePluginDistributionPolicy,
} from './pluginApi'

interface SemanticVersion {
  major: number
  minor: number
  patch: number
}

export interface Dnd5eManagedPluginVersion {
  id: string
  name?: string
  version: string
  minimumGameProtocolVersion?: number
  dependencies?: readonly Dnd5ePluginDependency[]
  conflicts?: readonly string[]
  declaredCapabilities?: readonly Dnd5ePluginDeclaredCapability[]
  distributionPolicy?: Dnd5ePluginDistributionPolicy
}

export interface Dnd5ePluginCompatibilityIssue {
  severity: 'error' | 'warning' | 'info'
  code:
    | 'protocol-too-new'
    | 'local-only'
    | 'entitlement-required'
    | 'dependency-missing'
    | 'dependency-version'
    | 'optional-dependency-missing'
    | 'plugin-conflict'
    | 'capability-added'
    | 'capability-removed'
  message: string
  pluginId?: string
}

export interface Dnd5ePluginCompatibilityReport {
  compatible: boolean
  errors: Dnd5ePluginCompatibilityIssue[]
  warnings: Dnd5ePluginCompatibilityIssue[]
  information: Dnd5ePluginCompatibilityIssue[]
}

function parseSemanticVersion(value: string): SemanticVersion | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/.exec(value.trim())
  if (!match) return null
  const version = {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  }
  return Object.values(version).every((part) => Number.isSafeInteger(part) && part >= 0) ? version : null
}

function compareVersions(left: SemanticVersion, right: SemanticVersion): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

function comparatorMatches(version: SemanticVersion, comparator: string): boolean {
  const match = /^(>=|<=|>|<|=)?\s*(v?\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?)$/.exec(comparator.trim())
  if (!match) return false
  const expected = parseSemanticVersion(match[2])
  if (!expected) return false
  const compared = compareVersions(version, expected)
  if (match[1] === '>') return compared > 0
  if (match[1] === '>=') return compared >= 0
  if (match[1] === '<') return compared < 0
  if (match[1] === '<=') return compared <= 0
  return compared === 0
}

function branchMatches(version: SemanticVersion, branch: string): boolean {
  const trimmed = branch.trim()
  if (!trimmed || trimmed === '*') return true
  if (trimmed.startsWith('^') || trimmed.startsWith('~')) {
    const expected = parseSemanticVersion(trimmed.slice(1))
    if (!expected || compareVersions(version, expected) < 0) return false
    if (trimmed.startsWith('~')) {
      return version.major === expected.major && version.minor === expected.minor
    }
    if (expected.major > 0) return version.major === expected.major
    if (expected.minor > 0) return version.major === 0 && version.minor === expected.minor
    return version.major === 0 && version.minor === 0 && version.patch === expected.patch
  }
  const comparators = trimmed.split(/\s+/).filter(Boolean)
  return comparators.length > 0 && comparators.every((comparator) => comparatorMatches(version, comparator))
}

export function dnd5ePluginVersionSatisfies(version: string, range: string): boolean {
  const parsed = parseSemanticVersion(version)
  if (!parsed) return version.trim() === range.trim()
  return range.split('||').some((branch) => branchMatches(parsed, branch))
}

export function dnd5ePluginCompatibilityReport(input: {
  candidate: Dnd5eManagedPluginVersion
  installed: readonly Dnd5eManagedPluginVersion[]
  previous?: Dnd5eManagedPluginVersion
  protocolVersion?: number
}): Dnd5ePluginCompatibilityReport {
  const issues: Dnd5ePluginCompatibilityIssue[] = []
  const protocolVersion = input.protocolVersion ?? CLIENT_SHARED_PROTOCOL_VERSION
  if ((input.candidate.minimumGameProtocolVersion ?? 1) > protocolVersion) {
    issues.push({
      severity: 'error',
      code: 'protocol-too-new',
      message: `需要游戏协议 v${input.candidate.minimumGameProtocolVersion}，当前为 v${protocolVersion}。`,
    })
  }
  if (input.candidate.distributionPolicy === 'local-only') {
    issues.push({
      severity: 'error',
      code: 'local-only',
      message: '该版本声明为仅限本机，不能启用到联网房间。',
    })
  }
  if (input.candidate.distributionPolicy === 'account-entitled') {
    issues.push({
      severity: 'error',
      code: 'entitlement-required',
      message: '该版本要求每位玩家分别持有授权；当前房间自动分发链路不能证明全员授权，因此拒绝启用。',
    })
  }
  const installed = new Map(input.installed.map((plugin) => [plugin.id, plugin]))
  for (const dependency of input.candidate.dependencies ?? []) {
    const resolved = installed.get(dependency.id)
    if (!resolved) {
      issues.push({
        severity: dependency.optional ? 'warning' : 'error',
        code: dependency.optional ? 'optional-dependency-missing' : 'dependency-missing',
        message: `${dependency.optional ? '可选依赖' : '缺少依赖'} ${dependency.id}（${dependency.versionRange}）。`,
        pluginId: dependency.id,
      })
    } else if (!dnd5ePluginVersionSatisfies(resolved.version, dependency.versionRange)) {
      issues.push({
        severity: dependency.optional ? 'warning' : 'error',
        code: 'dependency-version',
        message: `依赖 ${dependency.id} 需要 ${dependency.versionRange}，房间当前为 v${resolved.version}。`,
        pluginId: dependency.id,
      })
    }
  }
  for (const conflictId of input.candidate.conflicts ?? []) {
    if (!installed.has(conflictId)) continue
    issues.push({
      severity: 'error',
      code: 'plugin-conflict',
      message: `与房间插件 ${conflictId} 冲突。`,
      pluginId: conflictId,
    })
  }
  for (const plugin of input.installed) {
    if (!(plugin.conflicts ?? []).includes(input.candidate.id)) continue
    issues.push({
      severity: 'error',
      code: 'plugin-conflict',
      message: `房间插件 ${plugin.id} 声明与该插件冲突。`,
      pluginId: plugin.id,
    })
  }
  if (input.previous) {
    const before = new Set(input.previous.declaredCapabilities ?? [])
    const after = new Set(input.candidate.declaredCapabilities ?? [])
    for (const capability of after) {
      if (!before.has(capability)) issues.push({
        severity: 'warning',
        code: 'capability-added',
        message: `新版本增加 Headless capability：${capability}。`,
      })
    }
    for (const capability of before) {
      if (!after.has(capability)) issues.push({
        severity: 'info',
        code: 'capability-removed',
        message: `新版本不再声明 capability：${capability}。`,
      })
    }
  }
  return {
    compatible: !issues.some((issue) => issue.severity === 'error'),
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    information: issues.filter((issue) => issue.severity === 'info'),
  }
}
