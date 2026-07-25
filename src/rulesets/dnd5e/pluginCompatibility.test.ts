import { describe, expect, it } from 'vitest'
import {
  dnd5ePluginCompatibilityReport,
  dnd5ePluginVersionSatisfies,
} from './pluginCompatibility'

describe('D&D 5e 插件版本与兼容性', () => {
  it('支持精确、caret、tilde 和比较器版本范围', () => {
    expect(dnd5ePluginVersionSatisfies('1.4.2', '^1.2.0')).toBe(true)
    expect(dnd5ePluginVersionSatisfies('2.0.0', '^1.2.0')).toBe(false)
    expect(dnd5ePluginVersionSatisfies('1.4.9', '~1.4.0')).toBe(true)
    expect(dnd5ePluginVersionSatisfies('1.5.0', '~1.4.0')).toBe(false)
    expect(dnd5ePluginVersionSatisfies('1.8.0', '>=1.2.0 <2.0.0')).toBe(true)
  })

  it('阻止缺少依赖、冲突和仅本机插件', () => {
    const report = dnd5ePluginCompatibilityReport({
      candidate: {
        id: 'com.example.feature',
        version: '2.0.0',
        dependencies: [{ id: 'com.example.core', versionRange: '^2.0.0' }],
        conflicts: ['com.example.conflict'],
        distributionPolicy: 'local-only',
      },
      installed: [{ id: 'com.example.conflict', version: '1.0.0' }],
    })
    expect(report.compatible).toBe(false)
    expect(report.errors.map((issue) => issue.code)).toEqual([
      'local-only',
      'dependency-missing',
      'plugin-conflict',
    ])
  })

  it('报告更新新增和移除的 Headless capability', () => {
    const report = dnd5ePluginCompatibilityReport({
      candidate: {
        id: 'com.example.rules',
        version: '2.0.0',
        declaredCapabilities: ['damage', 'interrupt'],
      },
      previous: {
        id: 'com.example.rules',
        version: '1.0.0',
        declaredCapabilities: ['damage', 'healing'],
      },
      installed: [],
    })
    expect(report.warnings).toMatchObject([{ code: 'capability-added' }])
    expect(report.information).toMatchObject([{ code: 'capability-removed' }])
  })
})
