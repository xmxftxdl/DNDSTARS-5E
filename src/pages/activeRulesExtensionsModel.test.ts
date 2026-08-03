import { describe, expect, it } from 'vitest'
import type { Dnd5eRulesPluginManifest, InstalledDnd5eRulesPlugin } from '../rulesets/dnd5e'
import { activeRulesExtensionRecords } from './activeRulesExtensionsModel'

const manifest = {
  id: 'local.dm.workshop',
  name: '工坊规则',
  version: '1.0.0',
  apiVersion: 2,
  rulesetId: 'dnd5e-2014-srd-5.1',
  publisher: 'DM',
  license: 'DM 自定义内容',
  stateSchemaVersion: 1,
  distributionPolicy: 'room-distributable',
} satisfies Dnd5eRulesPluginManifest

const installed = {
  id: manifest.id,
  source: 'file',
  fileName: 'workshop.json',
  integrity: 'sha256-workshop',
  enabled: true,
} satisfies InstalledDnd5eRulesPlugin

describe('active rules and extensions inventory', () => {
  it('shows only the exact version activated by the current room', () => {
    expect(activeRulesExtensionRecords({
      installed: [installed],
      active: [manifest],
      restrictToRoom: true,
      roomRequirements: [{
        id: manifest.id,
        version: manifest.version,
        integrity: installed.integrity,
        stateSchemaVersion: 1,
      }],
    })).toHaveLength(1)

    expect(activeRulesExtensionRecords({
      installed: [installed],
      active: [manifest],
      restrictToRoom: true,
      roomRequirements: [{
        id: manifest.id,
        version: '2.0.0',
        integrity: installed.integrity,
        stateSchemaVersion: 1,
      }],
    })).toEqual([])
  })

  it('includes locally active workshop content in offline DM mode', () => {
    expect(activeRulesExtensionRecords({
      installed: [installed],
      active: [manifest],
      restrictToRoom: false,
    })[0]?.manifest.name).toBe('工坊规则')
  })

  it('does not expose installed but inactive or disabled packages', () => {
    expect(activeRulesExtensionRecords({
      installed: [installed],
      active: [],
      restrictToRoom: false,
    })).toEqual([])

    expect(activeRulesExtensionRecords({
      installed: [{ ...installed, enabled: false }],
      active: [manifest],
      restrictToRoom: false,
    })).toEqual([])
  })
})
