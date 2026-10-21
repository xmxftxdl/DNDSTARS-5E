import { describe, expect, it } from 'vitest'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin, dnd5ePluginHeadlessActionDefinition, registeredDnd5ePluginSpells } from './pluginApi'
import { dnd5eSpellbookEntriesWithPlugins } from './spellbook'
import { DND5E_LOCAL_CONTENT_AI_FORMAT_GUIDE } from './localContentAiImport'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

const draft = (id: string) => ({ schemaVersion: 1 as const, assumptions: [] as string[], unsupported: [] as string[], contentJson: JSON.stringify({
  spells: [{ id, name: id, level: 0, school: 'evocation', ritual: false,
    castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
    classes: ['wizard'], description: 'Synthetic local import test.', automation: { mode: 'partial' } }],
  activities: [{ schemaVersion: 1, id: `${id}-heal`, name: 'Heal', activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' }, target: { kind: 'self' },
    outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }],
    automation: { schemaVersion: 1, level: 'full', supportedPhases: ['eligibility', 'cost', 'targeting', 'healing', 'persistence'], manualPhases: [], limitations: [] },
    legacySource: { kind: 'spell', id } }],
}) })
const input = () => ({ id: 'local.pdf.test', name: 'Synthetic PDF', version: '1.0.0', inventoryComplete: true,
  entries: [{ sourceId: 'page-1', name: 'one', draft: draft('one') }, { sourceId: 'page-2', name: 'two', draft: draft('two') }] })

describe('PDF portable content module', () => {
  it('includes fresh source preflight failures in the portable report without claiming behavioral certification',async()=>{
    const value=input()
    const exported=await exportPdfContentModule({...value,entries:[{...value.entries[0],source:{kind:'spell',id:'page-1',name:'one',documentName:'Synthetic',startPage:1,endPage:1,text:'one\n1环塑能系\n持续时间：立即'}}]})
    expect(exported.report).toMatchObject({roundTripVerified:true,sourcePreflightCount:1,behaviorVerified:false,sourceCoverageVerified:false})
    expect(exported.report.entries[0].sourcePreflight).toMatchObject({status:'blocked',behaviorVerified:false})
    expect(exported.report.executionWarnings.join('\n')).toContain('法术环级与原文不一致')
  })
  it('keeps completeness metadata while installing a spell without activities as reference only', async () => {
    const source = input()
    const data = JSON.parse(source.entries[0].draft.contentJson)
    data.activities = []
    source.entries = [{ ...source.entries[0], draft: { ...source.entries[0].draft, contentJson: JSON.stringify(data) } }]
    const exported = await exportPdfContentModule(source)
    expect(exported.report.executionWarnings).toHaveLength(1)
    const imported = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    expect(imported.content.spells[0].automation?.mode).toBe('partial')
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported))
    try {
      expect(registeredDnd5ePluginSpells().find(s => s.id === 'local.pdf.test:one')?.automation.mode).toBe('reference-only')
    } finally { dispose() }
  })
  it('reimports two spells and a feature and registers spell Headless actions without the source cache', async () => {
    const source = input()
    source.entries.push({ sourceId: 'page-3', name: 'feature', draft: { schemaVersion: 1, assumptions: [], unsupported: [], contentJson: JSON.stringify({
      features: [{ id: 'test-feature', name: 'Test feature', summary: 'Synthetic', description: 'Synthetic feature', automation: 'manual' }],
    }) } })
    const exported = await exportPdfContentModule(source)
    expect(exported.report).toMatchObject({ roundTripVerified: true, behaviorVerified: false, counts: { spells: 2, features: 1 } })
    const imported = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    expect(imported.content.features[0].description).toBe('Synthetic feature')
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported))
    try {
      for (const id of ['one', 'two']) {
        expect(dnd5eSpellbookEntriesWithPlugins([], registeredDnd5ePluginSpells()).find(e => e.id === `local.pdf.test:${id}`)?.classes).toContain('wizard')
        expect(dnd5ePluginHeadlessActionDefinition("local.pdf.test", `${id}-heal`)).toBeDefined()
        const spellId = `local.pdf.test:${id}`
        const actor: Character = {
          rulesetId: 'dnd5e-2014-srd-5.1', id: 'wizard', name: 'Wizard', player: '', avatar: '', accent: '',
          race: '人类', charClass: '法师', level: 5, background: '', experience: 0, reputation: 0,
          abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, savingThrows: [], skills: [],
          maxHp: 30, currentHp: 20, tempHp: 0, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 0,
          saveDC: 15, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
          dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': [spellId] } } } },
        }
        const caster = { id: 'caster', label: 'Wizard', x: 25, y: 25, color: '', emoji: '', size: 1, type: 'player' as const, characterId: actor.id, hp: 20, maxHp: 30 }
        const map = { id: 'test', name: 'test', width: 500, height: 500, gridSize: 50, tokens: [caster] } as BattleMap
        const action = { id: 'cast', mapId: map.id, type: 'dnd5e-spell-cast', sourceMode: 'player', status: 'pending', actorTokenId: caster.id, characterId: actor.id, targetTokenId: caster.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1, dnd5eSpellCast: { spellId, slotLevel: 0, castingClassId: 'wizard', targetTokenId: caster.id } } as SharedPlayerActionState
        const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: [actor], initiativeOrder: [{ tokenId: caster.id, label: caster.label, emoji: '', color: '', roll: 20 }] })
        expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
        if (!prepared.ok) throw new Error(prepared.reason)
        const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
        expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
        expect(resolved.result.state.combatants.caster.currentHp).toBe(21)
      }
    } finally { dispose() }
  })
  it('blocks incomplete inventory, failed drafts, repeated sources and ID collisions', async () => {
    await expect(exportPdfContentModule({ ...input(), inventoryComplete: false })).rejects.toThrow('清单')
    await expect(exportPdfContentModule({ ...input(), entries: [{ sourceId: 'a', name: 'missing' }] })).rejects.toThrow('missing')
    const duplicate = input(); duplicate.entries[1] = duplicate.entries[0]
    await expect(exportPdfContentModule(duplicate)).rejects.toThrow('重复来源')
    duplicate.entries[1] = { ...duplicate.entries[0], sourceId: 'different' }
    await expect(exportPdfContentModule(duplicate)).rejects.toThrow('冲突')
    await expect(exportPdfContentModule({ ...input(), expectedCounts: { spells: 3 } })).rejects.toThrow('目录数量不一致')
  })
  it('preserves unresolved warnings instead of treating a portable package as certified', async () => {
    const source = input(); source.entries[0].draft.unsupported = ['未实现期限']
    const exported = await exportPdfContentModule(source)
    expect(exported.report.entries[0].unsupported).toEqual(['未实现期限'])
    expect(exported.report.behaviorVerified).toBe(false)
  })
  it('rejects malformed spell mechanics and duration before export reaches the recipient', async () => {
    const source = input()
    const content = JSON.parse(source.entries[0].draft.contentJson)
    content.spells[0].mechanics = { kind: 'damage', resolution: 'automatic', damage: { type: 'fire' } }
    source.entries[0].draft.contentJson = JSON.stringify(content)
    await expect(exportPdfContentModule(source)).rejects.toThrow('damage.dice')
    delete content.spells[0].mechanics
    content.spells[0].duration = { type: 'concentration', concentration: true }
    source.entries[0].draft.contentJson = JSON.stringify(content)
    await expect(exportPdfContentModule(source)).rejects.toThrow('duration.type')
  })
  it('round-trips passive subclass reference text without accepting a false automation claim', async () => {
    const content = { subclasses: [{ schemaVersion: 1, id: 'test-school', classId: 'wizard', name: 'Test school', summary: 'Synthetic', abilities: [{
      schemaVersion: 1, id: 'test-passive', name: 'Passive reference', description: 'Needs a mechanical implementation.', level: 2,
      trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'manual',
    }] }] }
    const entry = { sourceId: 'subclass', name: 'Test school', draft: { schemaVersion: 1 as const, assumptions: [], unsupported: ['被动机制未实现'], contentJson: JSON.stringify(content) } }
    const exported = await exportPdfContentModule({ ...input(), entries: [entry] })
    expect(exported.report.counts.subclasses).toBe(1)
    expect(exported.report.behaviorVerified).toBe(false)
    content.subclasses[0].abilities[0].automation = 'full'
    entry.draft.contentJson = JSON.stringify(content)
    await expect(exportPdfContentModule({ ...input(), entries: [entry] })).rejects.toThrow('被动资料')
  })
  it('executes the AI guide template after export/import with save success, failure and upcasting', async () => {
    const line = DND5E_LOCAL_CONTENT_AI_FORMAT_GUIDE.split('\n').find(line => line.startsWith('通用即时伤害 Activity 示例'))!
    const activity = JSON.parse(line.slice(line.indexOf('{'), line.indexOf('。必须'))) as Dnd5eActivityDefinitionV1
    activity.scaling = [{ basis: 'slot-level', baseLevel: 2, adjustments: [{ operationId: 'damage', diceCountPerStep: 1 }, { operationId: 'half', diceCountPerStep: 1 }] }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const value = draft('custom-blast')
    const content = JSON.parse(value.contentJson)
    content.spells[0].level = 2; content.activities = [activity]; value.contentJson = JSON.stringify(content)
    const exported = await exportPdfContentModule({ ...input(), entries: [{ sourceId: 'sample', name: 'sample', draft: value }] })
    const imported = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    const actor = { id: 'caster', controller: 'player', level: 5, proficiencyBonus: 3, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, armorClass: 15, currentHp: 30, maxHp: 30, conditions: [], spellSaveDc: 15 }
    for (const [save, amount] of [[1, 9], [20, 4]] as const) {
      const result = resolveDnd5eActivity({ activity: imported.content.activities![0], actor,
        targets: [{ ...actor, id: 'target', controller: 'dm' }], castLevel: 3,
        rolls: { 'save:target': { values: [save] }, damage: { values: [2, 3, 4] } },
        distanceFeetByTargetId: { target: 5 }, areaPlacement: { x: 5, y: 5, angleDegrees: 0 }, areaPlacementDistanceFeet: 10,
      })
      expect(result, JSON.stringify(result)).toMatchObject({ ok: true, proposals: [{ kind: 'deal-damage', targetId: 'target', amount }] })
    }
  })
})





