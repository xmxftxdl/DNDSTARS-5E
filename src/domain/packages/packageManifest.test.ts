import { describe, expect, it } from 'vitest'
import { comparePackageVersions, parsePackageManifest, validatePackageManifest } from './packageManifest'

import { packageFixture } from './packageTestFixture'
const context = { appVersion: '0.1.0-beta.1', systemId: 'dnd5e', systemVersion: '2014' }
describe('neutral package manifest', () => {
  it('separates JSON parsing from structural and compatibility validation', () => {
    expect(validatePackageManifest(parsePackageManifest(JSON.stringify(packageFixture())), context)).toEqual([])
    expect(parsePackageManifest('{}')).toEqual({})
    expect(validatePackageManifest({})).not.toEqual([])
    expect(() => parsePackageManifest('{')).toThrow('manifest-json-invalid')
  })
  it.each([
    ['packageId', '', 'package-id-invalid'], ['version', '01.2.3', 'version-invalid'],
    ['permissions', ['native.execute'], 'entry-invalid'], ['minimumStarScarVersion', '1.0.0', 'app-incompatible'],
    ['systemVersion', '2024', 'system-incompatible'],
  ])('rejects invalid %s', (field, value, code) => {
    expect(validatePackageManifest({ ...packageFixture(), [field]: value }, context)).toContainEqual(expect.objectContaining({ code }))
  })
  it('resolves dependency availability, duplicate installation and replacement cycles', () => {
    const a = packageFixture(), b = { ...packageFixture(), packageId: 'community.base' }
    a.dependencies = [{ packageId: b.packageId, minimumVersion: '1.0.0' }]
    expect(validatePackageManifest(a, context)).toContainEqual(expect.objectContaining({ code: 'dependency-unavailable' }))
    expect(validatePackageManifest(a, { ...context, installed: [{ manifest: b, enabled: true }] })).toEqual([])
    expect(validatePackageManifest(a, { ...context, installed: [{ manifest: b, enabled: false }] })).toContainEqual(expect.objectContaining({ code: 'dependency-unavailable' }))
    expect(validatePackageManifest(a, { ...context, installed: [{ manifest: a, enabled: true }] })).toContainEqual(expect.objectContaining({ code: 'package-duplicate' }))
    b.dependencies = [{ packageId: a.packageId, minimumVersion: '1.0.0' }]
    expect(validatePackageManifest(a, { ...context, installed: [{ manifest: b, enabled: true }] })).toContainEqual(expect.objectContaining({ code: 'dependency-cycle' }))
  })
  it('uses SemVer prerelease precedence and ignores build metadata', () => {
    expect(comparePackageVersions('1.0.0-beta.10', '1.0.0-beta.2')).toBe(1)
    expect(comparePackageVersions('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(comparePackageVersions('1.0.0+one', '1.0.0+two')).toBe(0)
    expect(() => comparePackageVersions('1.0', '1.0.0')).toThrow()
  })
})
