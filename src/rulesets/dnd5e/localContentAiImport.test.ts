import { describe, expect, it, vi } from 'vitest'
import type { AiProviderRuntimeV1 } from '../../lib/aiProvider'
import { AiProviderRegistryV1 } from '../../lib/aiProvider'
import {
  dnd5eLocalContentAiErrorMessage,
  dnd5eLocalContentAiFormatGuide,
  Dnd5eLocalContentAiDraftError,
  generateDnd5eLocalContentAiDraft,
  validateDnd5eLocalContentAiDraft,
  normalizeDnd5eLocalContentAiSyntax,
  readDnd5eLocalContentAiWireDraft,
} from './localContentAiImport'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eContentPackageAutomationCoverageV2 } from './contentPackageV2'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { buildDnd5eCustomMonster } from './customMonsterWorkshop'
import { parseDnd5ePastedMonster } from './monsterStatBlockPaste'
import { DND5E_PASSIVE_SUBCLASS_MECHANIC_KINDS, validateDeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { DND5E_NATIVE_SUBCLASS_REST_EXAMPLE } from './activities/dnd5eNativeSubclassAuthoringExample'
import { dnd5eLocalContentAiSdkGuide } from './localContentAiSdkGuide'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin, dnd5ePluginFeatureDefinition } from './pluginApi'
import { dnd5eFeatureActivityControls } from './activities/dnd5eFeatureActivityControls'

it('imports the native rest example supplied to the converter into an executable subclass control', async () => {
  const guide = dnd5eLocalContentAiSdkGuide('subclass', '长休之后选择一个物品', { mechanics: [], needsActivities: true, needsAreas: false })
  expect(guide).toContain(JSON.stringify(DND5E_NATIVE_SUBCLASS_REST_EXAMPLE))
  const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({
    name: 'Native example', version: '1.0.0', activities: [DND5E_NATIVE_SUBCLASS_REST_EXAMPLE],
    subclasses: [{ schemaVersion: 1, id: 'example-school', classId: 'fighter', name: 'Example school', summary: 'Synthetic', abilities: [{
      schemaVersion: 1, id: 'example-gift', name: 'Example gift', description: 'Synthetic', level: 3,
      trigger: { kind: 'long-rest-complete' }, targeting: { kind: 'self' }, effects: [], automation: 'manual',
    }] }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(prepared.package))
  try {
    const feature = dnd5ePluginFeatureDefinition(`${prepared.package.manifest.id}:example-school.example-gift`)
    expect(feature).toBeDefined()
    const controls = dnd5eFeatureActivityControls(feature!)
    expect(controls.map(control => control.activity.id)).toContain('example-rest-armor')
    expect(controls.find(control => control.activity.id === 'example-rest-armor')?.activity.effects).toEqual(DND5E_NATIVE_SUBCLASS_REST_EXAMPLE.effects)
  } finally { dispose() }
})

it('preserves executable passive mechanics through AI normalization and package preparation', async () => {
  const mechanics = [
    { kind: 'passive-defense', armorClassBonus: { value: 1, requiresHeavyArmor: true } },
    { kind: 'attacks-per-action', attacks: 2 },
    { kind: 'revival-material-waiver' },
  ]
  const abilities = mechanics.map((mechanic, index) => ({
    schemaVersion: 1, id: `passive-${index}`, name: `Passive ${index}`, description: 'Supported passive mechanism.',
    level: 6, trigger: { kind: 'passive' }, cost: { economy: 'none' }, targeting: { kind: 'self' },
    rolls: [], effects: [], automation: 'full', mechanic,
  }))
  const normalized = normalizeDnd5eLocalContentAiSyntax({ schemaVersion: 1, assumptions: [], unsupported: [], contentJson: JSON.stringify({
    name: 'Passive import', version: '1.0.0', subclasses: [{ schemaVersion: 1, id: 'passive-school', classId: 'fighter', name: 'Passive school', summary: 'Supported mechanics.', resources: [], abilities }],
  }) })
  const actual = JSON.parse(normalized.contentJson).subclasses[0].abilities
  expect(actual).toEqual(abilities)
  actual.forEach((entry: unknown) => validateDeclarativeSubclassAbilityV1(entry))
  const prepared = await prepareDnd5eLocalContentJson(normalized.contentJson)
  expect(prepared.package.content.subclasses[0].abilities).toEqual(abilities)
  const guide = dnd5eLocalContentAiFormatGuide('subclass', '被动能力')
  for (const kind of DND5E_PASSIVE_SUBCLASS_MECHANIC_KINDS) expect(guide).toContain(kind)
  expect(guide).not.toContain('passive 仅用于保留尚未实现')
})

it('fills a mapped damage base only from explicit valid types without hiding malformed mappings', () => {
  const operations = [
    {kind:'damage',damageTypeFromRoll:{types:['cold','fire']}},
    {kind:'damage',damageType:'acid',damageTypeFromRoll:{types:['cold','fire']}},
    {kind:'damage',damageTypeFromRoll:{types:['invalid']}},
    {kind:'damage'},
    {kind:'damage',damageTypeFromRoll:{types:[]}},
    {kind:'damage',damageTypeChoiceId:'other',damageTypeFromRoll:{types:['cold']}},
  ]
  const draft={schemaVersion:1 as const,assumptions:[],unsupported:['unchanged limitation'],contentJson:JSON.stringify({activities:[{outcomes:[{operations}]}]})}
  const normalized=normalizeDnd5eLocalContentAiSyntax(draft)
  const actual=JSON.parse(normalized.contentJson).activities[0].outcomes[0].operations
  expect(actual[0]).toEqual({...operations[0],damageType:'cold'})
  expect(actual.slice(1)).toEqual(operations.slice(1))
  expect(normalized.unsupported).toEqual(draft.unsupported)
  expect(normalized.assumptions.join(' ')).toContain('缺失或非法骰值继续拒绝')
  expect(JSON.parse(draft.contentJson).activities[0].outcomes[0].operations).toEqual(operations)
})

it('includes creature authoring contracts for spell dependencies only when stat block evidence is supplied', () => {
  expect(dnd5eLocalContentAiFormatGuide('spell', '普通法术原文')).not.toContain('怪物最少需要')
  expect(dnd5eLocalContentAiFormatGuide('spell', '[相关属性块原文]\n护甲等级 12\n生命值 8')).toContain('armorClass:{value:数值')
  expect(dnd5eLocalContentAiFormatGuide('spell', '[相关属性块原文]\n没有属性块')).not.toContain('怪物最少需要')
})

it('fills only the fixed reaction cost of an explicitly declared mitigation interrupt', () => {
  const ability = { trigger: { kind: 'before-damage-taken' }, mechanic: { kind: 'damage-mitigation-interrupt' } }
  const draft = { schemaVersion: 1 as const, assumptions: [], unsupported: ['other rule missing'], contentJson: JSON.stringify({ subclasses: [{ abilities: [ability, { ...ability, cost: { economy: 'action' } }] }] }) }
  const normalized = normalizeDnd5eLocalContentAiSyntax(draft)
  const abilities = JSON.parse(normalized.contentJson).subclasses[0].abilities
  expect(abilities[0].cost).toEqual({ economy: 'reaction' })
  expect(abilities[1].cost).toEqual({ economy: 'action' })
  expect(normalized.unsupported).toEqual(draft.unsupported)
  expect(JSON.parse(draft.contentJson).subclasses[0].abilities[0].cost).toBeUndefined()
})

it('fills only presentation targeting for empty manual passives without making them executable', () => {
  const passive = { trigger: { kind: 'passive' }, automation: 'manual', effects: [] }
  const entries = [passive, { ...passive, automation: 'full' }, { ...passive, trigger: { kind: 'active-use' } },
    { ...passive, effects: [{ kind: 'damage' }] }, { ...passive, cost: { economy: 'action' } },
    { ...passive, targeting: { kind: 'multiple-creatures' } }]
  const draft = { schemaVersion: 1 as const, assumptions: [], unsupported: ['Still manual'], contentJson: JSON.stringify({subclasses:[{abilities:entries}]}) }
  const normalized = normalizeDnd5eLocalContentAiSyntax(draft)
  const actual = JSON.parse(normalized.contentJson).subclasses[0].abilities
  expect(actual[0].targeting).toEqual({kind:'self'})
  expect(actual[0].automation).toBe('manual')
  expect(actual.slice(1)).toEqual(entries.slice(1))
  expect(normalized.unsupported).toEqual(['Still manual'])
  expect(JSON.parse(draft.contentJson).subclasses[0].abilities[0].targeting).toBeUndefined()
})

it('normalizes authoring aliases without inventing rule values or converting arbitrary target choices', () => {
  const draft = { schemaVersion: 1 as const, assumptions: [], unsupported: ['unimplemented effect'], contentJson: JSON.stringify({ activities: [
    { invocation: { kind: 'active-use' }, target: { kind: 'area', origin: 'self', shape: 'line', lengthFeet: 30, selection: 'choose-direction' } },
    { target: { kind: 'area', origin: 'point', shape: 'sphere', selection: 'choose-direction' } },
  ] }) }
  const normalized = normalizeDnd5eLocalContentAiSyntax(draft)
  const activities = JSON.parse(normalized.contentJson).activities
  expect(activities[0]).toEqual({ invocation: { kind: 'active' }, target: { kind: 'area', origin: 'self', shape: 'line', lengthFeet: 30, rotatable: true } })
  expect(activities[1].target.selection).toBe('choose-direction')
  expect(normalized.unsupported).toEqual(['unimplemented effect'])
  expect(JSON.parse(draft.contentJson).activities[0].invocation.kind).toBe('active-use')
})

it('completes equal cube dimensions but does not guess the height of rectangular volumes', () => {
 const draft = {schemaVersion:1 as const, assumptions:[],unsupported:[],contentJson:JSON.stringify({activities:[
  {target:{kind:'area',shape:'cube',lengthFeet:20}},
  {target:{kind:'area',shape:'cube',lengthFeet:20,widthFeet:10}},
 ]})}
 const data=JSON.parse(normalizeDnd5eLocalContentAiSyntax(draft).contentJson)
 expect(data.activities[0].target).toMatchObject({lengthFeet:20,widthFeet:20,heightFeet:20})
 expect(data.activities[1].target.heightFeet).toBeUndefined()
})

it('resolves contradictory capability metadata conservatively without deleting manual limitations or rule operations', () => {
  const activity = { id: 'one', automation: { schemaVersion: 1, level: 'full', supportedPhases: ['damage', 'targeting'], manualPhases: ['damage'], limitations: ['Missing terrain facts'] }, outcomes: [{ id: 'unchanged' }] }
  const result = normalizeDnd5eLocalContentAiSyntax({ schemaVersion: 1, contentJson: JSON.stringify({ activities: [activity] }), assumptions: [], unsupported: ['Source limitation'] })
  const normalized = JSON.parse(result.contentJson).activities[0]
  expect(normalized.automation).toMatchObject({ level: 'assisted', supportedPhases: ['targeting'], manualPhases: ['damage'], limitations: ['Missing terrain facts'] })
  expect(normalized.outcomes).toEqual(activity.outcomes)
  expect(result.unsupported).toEqual(['Source limitation'])
})

it('keeps manual movement manual when normalizing its capability phase alias', () => {
  const result = normalizeDnd5eLocalContentAiSyntax({ schemaVersion: 1, assumptions: [], unsupported: ['Movement needs geometry'], contentJson: JSON.stringify({
    activities: [{ automation: { schemaVersion: 1, level: 'full', supportedPhases: ['effects'], manualPhases: ['movement'], limitations: ['Missing geometry'] } }],
  }) })
  expect(JSON.parse(result.contentJson).activities[0].automation).toMatchObject({ level: 'assisted', supportedPhases: [], manualPhases: ['effects'], limitations: ['Missing geometry'] })
  expect(result.unsupported).toEqual(['Movement needs geometry'])
})

it('maps legacy manual capability spelling without changing phases, limitations or operations', () => {
 const automation={schemaVersion:1,level:'manual',supportedPhases:['targeting'],manualPhases:['effects'],limitations:['Requires DM']}
 const outcomes=[{id:'manual',when:{kind:'always'},operations:[{kind:'manual-adjudication',id:'adjudicate',prompt:'Review',reason:'Requires DM',requiresDmApproval:true}]}]
 const draft={schemaVersion:1 as const,assumptions:[],unsupported:['Unimplemented'],contentJson:JSON.stringify({activities:[{automation,outcomes}]})}
 const normalized=normalizeDnd5eLocalContentAiSyntax(draft)
 expect(JSON.parse(normalized.contentJson).activities[0]).toEqual({automation:{...automation,level:'dm-adjudication'},outcomes})
 expect(normalized.unsupported).toEqual(draft.unsupported)
 expect(JSON.parse(draft.contentJson).activities[0].automation.level).toBe('manual')
})

it('retains misplaced unsupported notes and ignores parent-level certification claims', () => {
  const draft = { schemaVersion: 1 as const, assumptions: [], unsupported: ['existing'], contentJson: JSON.stringify({
    subclasses: [{ id: 'school', name: 'School', automation: 'full', unsupported: ['missing resource'], abilities: [{ id: 'ability', name: 'Ability', automation: 'manual', unsupported: ['missing effect'] }] }],
  }) }
  const normalized = normalizeDnd5eLocalContentAiSyntax(draft)
  expect(normalized.unsupported).toEqual(expect.arrayContaining(['existing', 'School：missing resource', 'Ability：missing effect']))
  const subclass = JSON.parse(normalized.contentJson).subclasses[0]
  expect(subclass.automation).toBeUndefined()
  expect(subclass.abilities[0].automation).toBe('manual')
})

it('normalizes partial Activity metadata conservatively without inventing coverage', () => {
  const draft = {schemaVersion: 1 as const, assumptions: [], unsupported: ['missing lifecycle'], contentJson: JSON.stringify({activities: [{automation: {schemaVersion: 1, level: 'partial', supportedPhases: ['damage'], manualPhases: ['persistence'], limitations: ['missing lifecycle']}}]})}
  const normalized = normalizeDnd5eLocalContentAiSyntax(draft)
  expect(JSON.parse(normalized.contentJson).activities[0].automation).toEqual({schemaVersion: 1, level: 'assisted', supportedPhases: ['damage'], manualPhases: ['persistence'], limitations: ['missing lifecycle']})
  expect(normalized.unsupported).toEqual(draft.unsupported)
  expect(draft.contentJson).toContain('partial')
})

function runtime(output: unknown): AiProviderRuntimeV1 {
  return {
    descriptor: {
      schemaVersion: 1,
      id: 'local-test',
      displayName: 'Local Test',
      description: 'Synthetic local test runtime.',
      transport: 'local-bridge',
      status: 'ready',
      dataBoundary: 'local-only',
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
      pricing: {
        mode: 'free-local',
        creditsPerMillionInput: 0,
        creditsPerMillionOutput: 0,
        minimumCredits: 0,
      },
    },
    listModels: async () => [{
      schemaVersion: 1,
      providerId: 'local-test',
      id: 'local-test:model',
      displayName: 'Test Model',
      contextWindowTokens: 32_768,
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
    }],
    generateStructured: vi.fn(async (request) => ({
      schemaVersion: 1 as const,
      jobId: request.jobId,
      providerId: 'local-test',
      modelId: 'local-test:model',
      output,
    })),
  }
}

it('retains a rejected draft and sends its complete repair context as data instead of truncated instructions', async () => {
  const rejected = {schemaVersion: 1 as const, assumptions: ['preserve'], unsupported: ['still missing'], contentJson: JSON.stringify({name: 'Rejected', features: [{id: 'broken', description: 'x'.repeat(4_000) + 'TAIL-MUST-SURVIVE'}]})}
  const first = new AiProviderRegistryV1(); first.register(runtime(rejected))
  let captured: unknown
  try { await generateDnd5eLocalContentAiDraft({sourceText: 'Synthetic feature', targetKind: 'feature', registry: first, selection}) } catch (error) { captured = error }
  expect(captured).toBeInstanceOf(Dnd5eLocalContentAiDraftError)
  const failed = captured as Dnd5eLocalContentAiDraftError
  expect(failed.rejectedDraft?.contentJson).toContain('TAIL-MUST-SURVIVE')
  const fixed = {schemaVersion: 1 as const, assumptions: [], unsupported: ['still missing'], contentJson: JSON.stringify({name: 'Fixed', features: [{id: 'valid', name: 'Valid', summary: 'Example', description: 'Example', automation: 'manual'}]})}
  const provider = runtime(fixed), second = new AiProviderRegistryV1(); second.register(provider)
  const feedback = failed.message + '\n' + 'diagnostic '.repeat(500) + 'FINAL-ENTRY-FAILURE'
  await generateDnd5eLocalContentAiDraft({sourceText: 'Synthetic feature', targetKind: 'feature', registry: second, selection, repairFeedback: feedback, repairDraft: failed.rejectedDraft})
  const request = vi.mocked(provider.generateStructured).mock.calls[0][0]
  const document = request.documents?.find(doc => doc.id === 'rejected-rule-draft')
  expect(JSON.parse(document!.text)).toEqual(failed.rejectedDraft)
  expect(request.userPrompt).not.toContain('TAIL-MUST-SURVIVE')
  expect(request.documents?.find(doc => doc.id === 'host-validation-feedback')?.text).toBe(feedback)
  expect(request.userPrompt).not.toContain('FINAL-ENTRY-FAILURE')
})

it.each([true, false])('falls back from advisory retrieval without bypassing the Host gate (valid=%s)', async valid => {
  const draft = { schemaVersion: 1, assumptions: [], unsupported: ['Narrative only'], contentJson: JSON.stringify({
    name: 'Synthetic', features: [{ id: 'sample', ...(valid ? { name: 'Sample', summary: 'Example', description: 'Example', automation: 'manual' } : {}) }],
  }) }
  const provider = runtime(draft)
  vi.mocked(provider.generateStructured).mockRejectedValueOnce(new Error('synthetic retrieval failure'))
  const registry = new AiProviderRegistryV1(); registry.register(provider)
  const conversion = generateDnd5eLocalContentAiDraft({ sourceText: 'Synthetic narrative feature.', targetKind: 'feature', registry, selection, planMechanisms: true })
  if (valid) {
    const result = await conversion
    expect(result.mechanismPlan).toBeUndefined()
    expect(result.draft.assumptions).toContain('协议检索计划失败；本次使用完整 Host 协议进行转换，仍通过同一配置校验。')
    expect(result.draft.unsupported).toEqual(['Narrative only'])
  } else {
    await expect(conversion).rejects.toBeInstanceOf(Dnd5eLocalContentAiDraftError)
  }
  expect(provider.generateStructured).toHaveBeenCalledTimes(2)
  const request = vi.mocked(provider.generateStructured).mock.calls[1][0]
  expect(request.userPrompt).toContain('export interface DeclarativeWardPoolMechanicV1')
  expect(request.userPrompt).toContain('export interface DeclarativeDamageMitigationInterruptMechanicV1')
  expect(request.documents?.[0].text).toBe('Synthetic narrative feature.')
})

function routedExternalRuntime(outputs: Record<string, unknown>): AiProviderRuntimeV1 {
  const modelIds = Object.keys(outputs)
  return {
    descriptor: {
      schemaVersion: 1,
      id: 'external-account',
      displayName: 'External Test',
      description: 'Synthetic routed API runtime.',
      transport: 'external-server',
      status: 'ready',
      dataBoundary: 'cloud-processing',
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
      pricing: {
        mode: 'external-account',
        creditsPerMillionInput: 0,
        creditsPerMillionOutput: 0,
        minimumCredits: 0,
      },
    },
    listModels: async () => modelIds.map((id) => ({
      schemaVersion: 1 as const,
      providerId: 'external-account',
      id,
      displayName: id.includes('luna') ? 'GPT-5.6 Luna' : id.includes('terra') ? 'GPT-5.6 Terra' : id,
      contextWindowTokens: 128_000,
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
    })),
    generateStructured: vi.fn(async (request, context) => ({
      schemaVersion: 1 as const,
      jobId: request.jobId,
      providerId: 'external-account',
      modelId: context.model?.id,
      output: outputs[context.model?.id ?? ''],
    })),
  }
}

const selection = {
  schemaVersion: 1 as const,
  providerId: 'local-test',
  modelId: 'local-test:model',
  allowPaidFallback: false,
  maxCreditsPerTask: 0,
}

describe('natural-language local content AI import', () => {
  it('returns the unmodified rejected draft when generated roll scopes contradict explicit source constraints', async () => {
    const draft = { schemaVersion: 1, assumptions: [], unsupported: [], contentJson: JSON.stringify({
      spells: [{ id: 'scope-example' }],
      activities: [{ id: 'scope-cast', legacySource: { kind: 'spell', id: 'scope-example' },
        target: { kind: 'area' }, checks: [{ kind: 'saving-throw' }], effects: [{ modifiers: [{
          kind: 'roll-dice', dice: { count: 1, sides: 6, direction: 'subtract', appliesTo: ['attack', 'ability-check', 'saving-throw'] },
        }] }],
      }],
    }) }
    const registry = new AiProviderRegistryV1()
    registry.register(runtime(draft))
    let caught: unknown
    try {
      await generateDnd5eLocalContentAiDraft({ registry, selection, targetKind: 'spell',
        sourceText: '投掷一个d6，每次它进行攻击检定、属性检定和因为维持专注进行体质豁免检定时，它都要从结果上减去这个数值。',
      })
    } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(Dnd5eLocalContentAiDraftError)
    expect((caught as Error).message).toContain('不能扩大为普通 saving-throw')
    expect(JSON.parse((caught as Dnd5eLocalContentAiDraftError).rejectedDraft!.contentJson).activities[0].effects)
      .toEqual(JSON.parse(draft.contentJson).activities[0].effects)
  })
  it('accepts structured objects without JSON strings and rejects ambiguous envelopes', async () => {
    const output = { schemaVersion: 1, content: { features: [{ id: 'wire-feature', name: 'Wire', summary: 'Synthetic', description: 'Synthetic', automation: 'manual' }] }, assumptions: [], unsupported: [] }
    const registry = new AiProviderRegistryV1()
    registry.register(runtime(output))
    const result = await generateDnd5eLocalContentAiDraft({ registry, selection, sourceText: 'Synthetic feature.' })
    expect(JSON.parse(result.draft.contentJson).features[0].id).toBe('wire-feature')
    expect(readDnd5eLocalContentAiWireDraft({ ...output, contentJson: '{}' })).toBeNull()
    expect(readDnd5eLocalContentAiWireDraft({ ...output, content: [] })).toBeNull()
  })
  it('rejects completeness claims without a bound execution activity', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({ schemaVersion: 1, assumptions: [], unsupported: [], contentJson: JSON.stringify({ spells: [{
      id: 'claimed', name: 'Claimed', level: 1, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
      components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic', automation: { mode: 'partial' },
    }] }) }))
    await expect(generateDnd5eLocalContentAiDraft({ registry, selection, targetKind: 'spell', sourceText: 'Synthetic spell.' })).rejects.toThrow('Activity')
  })
  it('returns a preview draft without installing or executing it', async () => {
    const registry = new AiProviderRegistryV1()
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'Draft',
        features: [{
          id: 'steady-focus', name: 'Steady Focus', summary: 'Summary',
          description: 'Concise paraphrase.', automation: 'manual',
        }],
      }),
      assumptions: ['Converted feet without changing the value.'],
      unsupported: ['An ambiguous reaction trigger needs DM review.'],
    })
    registry.register(provider)
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: 'Synthetic rule source.',
      registry,
      selection,
    })
    expect(result).toMatchObject({
      provider: { id: 'local-test', dataBoundary: 'local-only' },
      model: { id: 'local-test:model' },
      estimatedCredits: 0,
      fallback: false,
      draft: {
        assumptions: expect.any(Array),
        unsupported: expect.any(Array),
      },
    })
    expect(provider.generateStructured).toHaveBeenCalledOnce()
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 16_384 }),
      expect.any(Object),
    )
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.features).toContainEqual(expect.objectContaining({
      id: 'steady-focus',
      automation: 'manual',
    }))
  })

  it('accepts a feature draft with an auxiliary unified Activity', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'Unified Activity draft',
        features: [{
          id: 'restorative-pulse', name: 'Restorative Pulse', summary: 'Restore vitality.',
          description: 'Uses the shared Activity execution contract.', automation: 'full',
        }],
        activities: [{
          schemaVersion: 1,
          id: 'restorative-pulse-activity',
          name: 'Restorative Pulse',
          activation: { kind: 'action', cost: 1 },
          invocation: { kind: 'active', confirmation: 'actor-choice' },
          target: { kind: 'self' },
          outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{
            id: 'healing', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 },
          }] }],
          automation: {
            schemaVersion: 1, level: 'full',
            supportedPhases: ['eligibility', 'cost', 'targeting', 'healing', 'persistence'],
            manualPhases: [], limitations: [],
          },
          legacySource: { kind: 'feature', id: 'restorative-pulse' },
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))

    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: 'Create a restorative feature that uses an action.',
      registry,
      selection,
      targetKind: 'feature',
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(result.fallback).toBe(false)
    expect(prepared.package.content.features).toEqual([
      expect.objectContaining({ id: 'restorative-pulse', automation: 'full' }),
    ])
    expect(prepared.package.content.activities).toEqual([
      expect.objectContaining({
        id: 'restorative-pulse-activity',
        legacySource: { kind: 'feature', id: 'restorative-pulse' },
      }),
    ])
  })

  it('uses the fixed Luna route and rejects an empty draft without upgrading to Terra', async () => {
    const lunaId = 'external:gpt-5.6-luna'
    const terraId = 'external:synthesis:gpt-5.6-terra'
    const provider = routedExternalRuntime({
      [lunaId]: {
        schemaVersion: 1,
        contentJson: JSON.stringify({
          name: '空草稿', version: '1.0.0', races: [], backgrounds: [], features: [], feats: [],
          spells: [], items: [], abilityGenerationMethods: [], headlessActions: [], subclasses: [], monsters: [],
        }),
        assumptions: [],
        unsupported: [],
      },
      [terraId]: {
        schemaVersion: 1,
        contentJson: JSON.stringify({
          name: '升级草稿', version: '1.0.0',
          features: [{
            id: 'ember-focus', name: '余烬专注', summary: '受到火焰伤害后保持专注。',
            description: '由 DM 核对触发条件。', automation: 'manual',
          }],
        }),
        assumptions: [],
        unsupported: [],
      },
    })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)

    await expect(generateDnd5eLocalContentAiDraft({
      sourceText: '新增一个名为余烬专注的自定义特性。',
      registry,
      selection: {
        schemaVersion: 1,
        providerId: 'external-account',
        modelId: terraId,
        allowPaidFallback: false,
        maxCreditsPerTask: 0,
      },
    })).rejects.toThrow('模型没有生成任何可导入条目')

    expect(provider.generateStructured).toHaveBeenCalledOnce()
    expect(vi.mocked(provider.generateStructured).mock.calls[0][1].model?.id).toBe(lunaId)
  })

  it('does not call Terra when the Luna draft passes the Host gate', async () => {
    const lunaId = 'external:gpt-5.6-luna'
    const terraId = 'external:synthesis:gpt-5.6-terra'
    const validDraft = {
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'Luna 草稿', version: '1.0.0',
        features: [{
          id: 'steady-focus', name: '稳定专注', summary: '保持稳定。',
          description: '由 DM 核对。', automation: 'manual',
        }],
      }),
      assumptions: [],
      unsupported: [],
    }
    const provider = routedExternalRuntime({ [lunaId]: validDraft, [terraId]: validDraft })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: '新增稳定专注特性。',
      registry,
      selection: {
        schemaVersion: 1,
        providerId: 'external-account',
        modelId: terraId,
        allowPaidFallback: false,
        maxCreditsPerTask: 0,
      },
    })

    expect(provider.generateStructured).toHaveBeenCalledOnce()
    expect(vi.mocked(provider.generateStructured).mock.calls[0][1].model?.id).toBe(lunaId)
    expect(result).toMatchObject({
      model: { id: lunaId },
      routing: { fallbackUsed: false },
    })
  })

  it('uses the selected spell interface and rejects a model that returns the wrong collection', async () => {
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '错误分类',
        features: [{
          id: 'frost-bolt', name: '霜箭', summary: '错误分类。',
          description: '应当是法术。', automation: 'manual',
        }],
      }),
      assumptions: [],
      unsupported: [],
    })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)

    await expect(generateDnd5eLocalContentAiDraft({
      sourceText: '一个名为霜箭的法术。',
      registry,
      selection,
      targetKind: 'spell',
    })).rejects.toThrow('模型没有生成所选“法术”内容')

    expect(vi.mocked(provider.generateStructured).mock.calls[0][0].userPrompt).toContain('DM 选择的分析接口：法术')
  })

  it('imports a selected declarative class through the V2 Host gate', async () => {
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '职业草稿',
        classes: [{
          schemaVersion: 1,
          id: 'rune-warden',
          name: '符文守卫',
          summary: '使用符文保护同伴的自定义职业。',
          hitDie: 10,
          primaryAbilities: ['str'],
          savingThrows: ['str', 'con'],
          armorProficiencies: ['轻甲', '中甲', '盾牌'],
          weaponProficiencies: ['简易武器', '军用武器'],
          skills: { choiceCount: 2, options: 'any' },
          features: [],
        }],
      }),
      assumptions: [],
      unsupported: [],
    })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)

    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: '创建符文守卫职业。',
      registry,
      selection,
      targetKind: 'class',
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)

    expect(result.targetKind).toBe('class')
    expect(prepared.package.content.classes).toEqual([
      expect.objectContaining({ id: 'rune-warden', hitDie: 10 }),
    ])
    expect(dnd5eContentDefinitionsFromPackageV2(prepared.package)).toContainEqual(
      expect.objectContaining({ kind: 'class', payload: expect.objectContaining({ id: 'rune-warden' }) }),
    )
  })

  it('rejects malformed model output before it reaches the package parser', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({ schemaVersion: 1, contentJson: '{}' }))
    await expect(generateDnd5eLocalContentAiDraft({
      sourceText: 'Synthetic rule source.',
      registry,
      selection,
    })).rejects.toThrow('provider-output-invalid')
  })

  it('uses the Host monster compiler when AI misclassifies one stat block as manual features', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'DM 本地规则',
        version: '1.0.0',
        races: [], backgrounds: [],
        features: [{
          id: 'ilifa-staff-strike',
          name: '法杖敲击',
          summary: '近战攻击。',
          description: '模型错误地把怪物动作放进了普通特性。',
          automation: 'manual',
        }],
        feats: [], spells: [], items: [], abilityGenerationMethods: [],
        headlessActions: [], subclasses: [], monsters: [],
      }),
      assumptions: [],
      unsupported: [],
    }))
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: `Ilifa
Medium humanoid, neutral
Armor Class 14
Hit Points 36 (8d8)
Speed 30 ft.
STR DEX CON INT WIS CHA
16 (+3) 12 (+1) 10 (+0) 11 (+0) 13 (+1) 14 (+2)
Senses passive Perception 11
Languages Common
Challenge 2 (450 XP)
不屈战志。当生命值低于10时，其造成的所有伤害额外增加1d6。
Actions
Staff Strike. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 4) bludgeoning damage.`,
      registry,
      selection,
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.features).toEqual([])
    expect(prepared.package.content.monsters).toEqual([
      expect.objectContaining({
        id: 'room-monster:ilifa',
        name: 'Ilifa',
        actions: [expect.objectContaining({
          name: 'Staff Strike',
          automation: 'headless',
          attack: expect.objectContaining({ toHit: 6 }),
        })],
        headlessMechanics: [expect.objectContaining({
          schemaVersion: 2,
          trigger: { event: 'after-dealt-damage' },
          predicates: expect.objectContaining({ hpBelow: 10 }),
          automation: 'full',
        })],
      }),
    ])
    expect(dnd5eContentPackageAutomationCoverageV2(prepared.package).categories['monster-mechanic'])
      .toMatchObject({ total: 2, full: 2, partial: 0, manual: 0 })
    expect(result.draft.assumptions.join('\n')).toContain('Host 已把单一怪物属性块编译为 monsters[0]')
  })

  it('replaces an invalid bare AI monster id with a room-monster id for Chinese AC and HP labels', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '伊利法本地怪物',
        version: '1.0.0',
        races: [], backgrounds: [], features: [], feats: [], spells: [], items: [],
        abilityGenerationMethods: [], headlessActions: [], subclasses: [],
        monsters: [{
          id: 'ilifa-commander-phantom',
          slug: 'ilifa-commander-phantom',
          name: '伊利法统领虚体',
          size: 'Medium',
          armorClass: 14,
          hitPoints: 35,
          skills: {},
          challenge: '3',
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
技能：说服+6，察觉+2，洞悉+2，隐匿+3，运动+6
挑战等级：3
动作
法杖敲击：近战武器攻击，单一目标，命中+6，伤害：8（1d6+4）钝击伤害`,
      registry,
      selection,
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.monsters).toEqual([
      expect.objectContaining({
        id: 'room-monster:ilifa-commander-phantom',
        slug: 'ilifa-commander-phantom',
        size: '中型',
        creatureType: '类人生物（红龙裔）',
        alignment: '守序中立',
        armorClass: { value: 14, note: '法师护甲' },
        hitPoints: { average: 35, dice: '5d8+10' },
        challenge: { rating: '3', xp: 700 },
        skills: [
          expect.objectContaining({ key: 'persuasion', bonus: 6 }),
          expect.objectContaining({ key: 'perception', bonus: 2 }),
          expect.objectContaining({ key: 'insight', bonus: 2 }),
          expect.objectContaining({ key: 'stealth', bonus: 3 }),
          expect.objectContaining({ key: 'athletics', bonus: 6 }),
        ],
      }),
    ])
    expect(result.draft.assumptions.join('\n')).toContain('未通过 Host 校验')
  })

  it('Host-compiles an invalid namespaced monster even when the AI adds a shorthand manifest', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '伊利法本地怪物',
        version: '1.0.0',
        manifest: { publisher: 'Local Test' },
        races: [], backgrounds: [], features: [], feats: [], spells: [], items: [],
        abilityGenerationMethods: [], headlessActions: [], subclasses: [],
        monsters: [{
          id: 'room-monster:ilifa-commanding-wraith',
          slug: 'ilifa-commanding-wraith',
          name: '伊利法统领虚体',
          size: 'Medium',
          creatureType: '',
          alignment: '',
          armorClass: 14,
          hitPoints: 35,
          skills: {},
          senses: {},
          challenge: '3',
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
感官：被动察觉12
语言：通用语，龙语
挑战等级：3
动作
法杖敲击：近战武器攻击，命中+6，伤害：8（1d6+4）钝击伤害`,
      registry,
      selection,
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.monsters).toEqual([expect.objectContaining({
      id: 'room-monster:ilifa-commanding-wraith',
      size: '中型',
      creatureType: '类人生物（红龙裔）',
      alignment: '守序中立',
      armorClass: { value: 14, note: '法师护甲' },
      hitPoints: { average: 35, dice: '5d8+10' },
      senses: expect.any(Array),
      challenge: { rating: '3', xp: 700 },
    })])
    expect(result.draft.assumptions.join('\n')).toContain('未通过 Host 校验')
  })

  it('merges valid AI monster traits that were split at Chinese soft wraps', async () => {
    const sourceText = `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
挑战等级：3
吐息武器：他可以使用动作呼出破坏性的能
量。使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失
败者将受到2d6点伤害。豁免成功则伤害减 半。
动作
法杖敲击：近战武器攻击，命中+6，伤害：8（1d6+4）钝击伤害`
    const parsed = parseDnd5ePastedMonster(sourceText)
    parsed.draft.slug = 'ilifa-commander-phantom'
    parsed.draft.id = 'room-monster:ilifa-commander-phantom'
    const validMonster = buildDnd5eCustomMonster(parsed.draft)
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '伊利法本地怪物', version: '1.0.0', races: [], backgrounds: [], features: [], feats: [],
        spells: [], items: [], abilityGenerationMethods: [], headlessActions: [], subclasses: [],
        monsters: [{
          ...validMonster,
          traits: [
            { name: '吐息武器', description: '他可以使用动作呼出破坏性的能', automation: 'dm-adjudication' },
            { name: '量', description: '使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失', automation: 'dm-adjudication' },
            { name: '败者将受到2d6点伤害', description: '豁免成功则伤害减 半。', automation: 'dm-adjudication' },
          ],
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))

    const result = await generateDnd5eLocalContentAiDraft({ sourceText, registry, selection })
    const content = JSON.parse(result.draft.contentJson) as { monsters: Array<{ traits: Array<{ name: string; description: string }> }> }
    expect(content.monsters[0].traits).toEqual([expect.objectContaining({
      name: '吐息武器',
      description: '他可以使用动作呼出破坏性的能量。使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失败者将受到2d6点伤害。豁免成功则伤害减半。',
    })])
    expect(result.draft.assumptions.join('\n')).toContain('中文换行误拆的 2 个怪物特性片段')
  })

  it('bounds the draft envelope', () => {
    expect(validateDnd5eLocalContentAiDraft({
      schemaVersion: 1,
      contentJson: '{}',
      assumptions: [],
      unsupported: [],
    })).toBe(true)
    expect(validateDnd5eLocalContentAiDraft({
      schemaVersion: 1,
      contentJson: '{}',
      assumptions: new Array(101).fill('x'),
      unsupported: [],
    })).toBe(false)
  })

  it('shows the concrete upstream HTTP 400 reason when the Bridge provides it', () => {
    expect(dnd5eLocalContentAiErrorMessage(new Error(
      "provider-execution-failed:upstream-400:Unsupported parameter: 'max_tokens'. | unsupported_parameter",
    ))).toBe(
      "模型 API 拒绝了转换请求（HTTP 400）：Unsupported parameter: 'max_tokens'. | unsupported_parameter",
    )
    expect(dnd5eLocalContentAiErrorMessage(new Error(
      'provider-execution-failed:upstream-400',
    ))).toContain('重启 Local AI Bridge')
  })
})
